/**
 * ROM Agent - Bedrock Helper
 * Utilitário simplificado para chamadas ao AWS Bedrock
 */

import { BedrockRuntimeClient, ConverseCommand } from "@aws-sdk/client-bedrock-runtime";

// __ROM_METRICS_WRAP_BEDROCK_SEND__

import promClient from 'prom-client';
const { Counter, register } = promClient;

function __romGetOrCreateCounter(name, help) {
  const existing = register.getSingleMetric && register.getSingleMetric(name);
  if (existing) return existing;
  try {
    const counter = new Counter({ name, help });
    console.log(`[bedrock-helper] Counter created: ${name}`);
    return counter;
  } catch (err) {
    console.error(`[bedrock-helper] Failed to create counter ${name}:`, err.message);
    return register.getSingleMetric(name);
  }
}
const __romBedrockReq = __romGetOrCreateCounter('bedrock_requests_total', 'Total Bedrock API requests');
const __romBedrockErr = __romGetOrCreateCounter('bedrock_errors_total', 'Total Bedrock API errors');

const client = new BedrockRuntimeClient({
  region: process.env.AWS_REGION ?? "us-west-2",
});

/**
 * Resolve model ID to use inference profile ARN if configured
 *
 * Supports:
 * - amazon.nova-lite-v1:0 (standard)
 * - us.amazon.nova-lite-v1:0 (regional, used in fallback chain)
 * - amazon.nova-pro-v1:0 (standard)
 * - us.amazon.nova-pro-v1:0 (regional, used in fallback chain)
 *
 * Environment variables (priority order):
 * - NOVA_LITE_PROFILE_ARN (correct spelling)
 * - NOVA_LITE_PROLIFE_ARN (typo variant, compatibility)
 * - NOVA_PRO_PROFILE_ARN (correct spelling)
 * - NOVA_PRO_PROLIFE_ARN (typo variant, compatibility)
 *
 * @param {string} modelId - Original model ID
 * @returns {string} Resolved model ID (inference profile ARN or original)
 */
export function resolveBedrockModelId(modelId) {
  if (!modelId || typeof modelId !== "string") return modelId;

  // Se já for ARN, não mexe
  if (modelId.startsWith("arn:aws:bedrock:")) return modelId;

  // Normaliza prefixo regional ("us.")
  const normalized = modelId.replace(/^us\./, "");

  const novaLiteArn =
    process.env.NOVA_LITE_PROFILE_ARN ||
    process.env.NOVA_LITE_PROLIFE_ARN; // compat

  const novaProArn =
    process.env.NOVA_PRO_PROFILE_ARN ||
    process.env.NOVA_PRO_PROLIFE_ARN; // compat

  // Auto-resolve para inference profiles (correção AWS 2025)
  if (normalized === "amazon.nova-lite-v1:0") {
    return novaLiteArn || "us.amazon.nova-lite-v1:0";
  }
  if (normalized === "amazon.nova-pro-v1:0") {
    return novaProArn || "us.amazon.nova-pro-v1:0";
  }

  // (opcional) se você usar micro/premier depois:
  // if (normalized === "amazon.nova-micro-v1:0" && process.env.NOVA_MICRO_PROFILE_ARN) return process.env.NOVA_MICRO_PROFILE_ARN;
  // if (normalized === "amazon.nova-premier-v1:0" && process.env.NOVA_PREMIER_PROFILE_ARN) return process.env.NOVA_PREMIER_PROFILE_ARN;

  return modelId;
}

// __ROM_METRICS_WRAP_BEDROCK_SEND__ hook
try {
  const __romOrigSend = client.send.bind(client);
  client.send = async (command, ...args) => {
    try { __romBedrockReq.inc(); } catch (_) {}
    try {
      return await __romOrigSend(command, ...args);
    } catch (err) {
      try { __romBedrockErr.inc(); } catch (_) {}
      throw err;
    }
  };
} catch (_) {}

/**
 * Realizar conversa com Bedrock (interface simplificada)
 *
 * @param {Object} options - Opções da conversa
 * @param {string} options.modelId - ID do modelo (ex: "anthropic.claude-sonnet-4-5-20250929-v1:0")
 * @param {string} options.prompt - Prompt do usuário
 * @param {number} [options.maxTokens=1024] - Máximo de tokens na resposta
 * @param {number} [options.temperature=0.2] - Temperatura (0-1)
 * @param {number} [options.topP=0.9] - Top P para sampling
 * @returns {Promise<string>} Texto da resposta do modelo
 */
export async function bedrockConverse({
  modelId,
  prompt,
  maxTokens = 1024,
  temperature = 0.2,
  topP = 0.9,
}) {
  // Resolve model ID to inference profile ARN if configured
  const resolvedModelId = resolveBedrockModelId(modelId);

  const command = new ConverseCommand({
    modelId: resolvedModelId,
    messages: [
      {
        role: "user",
        content: [{ text: prompt }],
      },
    ],
    inferenceConfig: { maxTokens, temperature, topP },
  });

  const response = await client.send(command);

  // Texto de saída (padrão do Converse)
  return response.output.message.content[0].text;
}

/**
 * Exportar client para uso avançado
 */
export { client as bedrockClient };
