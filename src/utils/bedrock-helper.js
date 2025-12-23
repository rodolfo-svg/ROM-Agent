/**
 * ROM Agent - Bedrock Helper
 * Utilitário simplificado para chamadas ao AWS Bedrock
 */

import { BedrockRuntimeClient, ConverseCommand } from "@aws-sdk/client-bedrock-runtime";

const client = new BedrockRuntimeClient({
  region: process.env.AWS_REGION ?? "us-west-2",
});

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
  const command = new ConverseCommand({
    modelId,
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
