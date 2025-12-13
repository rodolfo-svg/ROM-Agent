/**
 * ROM Agent - Módulo AWS Bedrock
 * Integração com modelos de IA da AWS (Claude, Nova, Llama, etc)
 *
 * @version 1.0.0
 */

import {
  BedrockRuntimeClient,
  ConverseCommand,
  ConverseStreamCommand,
  InvokeModelCommand
} from '@aws-sdk/client-bedrock-runtime';

import {
  BedrockClient,
  ListFoundationModelsCommand,
  ListInferenceProfilesCommand
} from '@aws-sdk/client-bedrock';

// ============================================================
// CONFIGURAÇÃO
// ============================================================

const CONFIG = {
  region: process.env.AWS_REGION || 'us-east-1',
  defaultModel: 'amazon.nova-pro-v1:0',
  maxTokens: 4096,
  temperature: 0.7
};

// Modelos disponíveis organizados por provedor
export const MODELOS_BEDROCK = {
  amazon: {
    'nova-premier': 'amazon.nova-premier-v1:0',
    'nova-pro': 'amazon.nova-pro-v1:0',
    'nova-lite': 'amazon.nova-lite-v1:0',
    'nova-micro': 'amazon.nova-micro-v1:0',
    'titan-text': 'amazon.titan-text-express-v1'
  },
  anthropic: {
    'claude-opus-4.5': 'anthropic.claude-opus-4-5-20251101-v1:0',
    'claude-sonnet-4.5': 'anthropic.claude-sonnet-4-5-20250929-v1:0',
    'claude-sonnet-4': 'anthropic.claude-sonnet-4-20250514-v1:0',
    'claude-haiku-4.5': 'anthropic.claude-haiku-4-5-20251001-v1:0',
    'claude-3.5-sonnet': 'anthropic.claude-3-5-sonnet-20241022-v2:0',
    'claude-3.5-haiku': 'anthropic.claude-3-5-haiku-20241022-v1:0',
    'claude-3-opus': 'anthropic.claude-3-opus-20240229-v1:0',
    'claude-3-sonnet': 'anthropic.claude-3-sonnet-20240229-v1:0',
    'claude-3-haiku': 'anthropic.claude-3-haiku-20240307-v1:0'
  },
  meta: {
    'llama-4-scout': 'meta.llama4-scout-17b-instruct-v1:0',
    'llama-4-maverick': 'meta.llama4-maverick-17b-instruct-v1:0',
    'llama-3.3-70b': 'meta.llama3-3-70b-instruct-v1:0',
    'llama-3.2-90b': 'meta.llama3-2-90b-instruct-v1:0',
    'llama-3.2-11b': 'meta.llama3-2-11b-instruct-v1:0',
    'llama-3.1-70b': 'meta.llama3-1-70b-instruct-v1:0',
    'llama-3.1-8b': 'meta.llama3-1-8b-instruct-v1:0'
  },
  mistral: {
    'mistral-large-3': 'mistral.mistral-large-3-675b-instruct',
    'pixtral-large': 'mistral.pixtral-large-2502-v1:0',
    'ministral-14b': 'mistral.ministral-3-14b-instruct',
    'ministral-8b': 'mistral.ministral-3-8b-instruct'
  },
  deepseek: {
    'r1': 'deepseek.r1-v1:0',
    'deepseek-r1': 'deepseek.r1-v1:0'
  },
  cohere: {
    'command-r-plus': 'cohere.command-r-plus-v1:0',
    'command-r': 'cohere.command-r-v1:0'
  }
};

// Inference Profiles para modelos que requerem
export const INFERENCE_PROFILES = {
  // Meta Llama
  'meta.llama3-3-70b-instruct-v1:0': 'us.meta.llama3-3-70b-instruct-v1:0',
  'meta.llama3-2-90b-instruct-v1:0': 'us.meta.llama3-2-90b-instruct-v1:0',
  'meta.llama3-2-11b-instruct-v1:0': 'us.meta.llama3-2-11b-instruct-v1:0',
  'meta.llama3-1-70b-instruct-v1:0': 'us.meta.llama3-1-70b-instruct-v1:0',
  'meta.llama3-1-8b-instruct-v1:0': 'us.meta.llama3-1-8b-instruct-v1:0',
  'meta.llama4-scout-17b-instruct-v1:0': 'us.meta.llama4-scout-17b-instruct-v1:0',
  'meta.llama4-maverick-17b-instruct-v1:0': 'us.meta.llama4-maverick-17b-instruct-v1:0',

  // Anthropic Claude (modelos que requerem inference profile)
  'anthropic.claude-3-opus-20240229-v1:0': 'us.anthropic.claude-3-opus-20240229-v1:0',
  'anthropic.claude-3-5-haiku-20241022-v1:0': 'us.anthropic.claude-3-5-haiku-20241022-v1:0',
  'anthropic.claude-3-5-sonnet-20241022-v2:0': 'us.anthropic.claude-3-5-sonnet-20241022-v2:0',
  'anthropic.claude-3-7-sonnet-20250219-v1:0': 'us.anthropic.claude-3-7-sonnet-20250219-v1:0',
  'anthropic.claude-sonnet-4-20250514-v1:0': 'us.anthropic.claude-sonnet-4-20250514-v1:0',
  'anthropic.claude-sonnet-4-5-20250929-v1:0': 'us.anthropic.claude-sonnet-4-5-20250929-v1:0',
  'anthropic.claude-opus-4-20250514-v1:0': 'us.anthropic.claude-opus-4-20250514-v1:0',
  'anthropic.claude-opus-4-5-20251101-v1:0': 'us.anthropic.claude-opus-4-5-20251101-v1:0',
  'anthropic.claude-haiku-4-5-20251001-v1:0': 'us.anthropic.claude-haiku-4-5-20251001-v1:0',

  // Amazon Nova
  'amazon.nova-premier-v1:0': 'us.amazon.nova-premier-v1:0',

  // DeepSeek
  'deepseek.r1-v1:0': 'us.deepseek.r1-v1:0',

  // Mistral
  'mistral.mistral-large-3-675b-instruct': 'us.mistral.mistral-large-3-675b-instruct',
  'mistral.pixtral-large-2502-v1:0': 'us.mistral.pixtral-large-2502-v1:0'
};

// ============================================================
// CLIENTE BEDROCK
// ============================================================

let runtimeClient = null;
let managementClient = null;

function getBedrockRuntimeClient() {
  if (!runtimeClient) {
    runtimeClient = new BedrockRuntimeClient({ region: CONFIG.region });
  }
  return runtimeClient;
}

function getBedrockManagementClient() {
  if (!managementClient) {
    managementClient = new BedrockClient({ region: CONFIG.region });
  }
  return managementClient;
}

// ============================================================
// FUNÇÕES PRINCIPAIS
// ============================================================

/**
 * Envia mensagem para modelo Bedrock usando a API Converse
 * @param {string} prompt - Mensagem do usuário
 * @param {object} options - Opções de configuração
 * @returns {Promise<object>} Resposta do modelo
 */
export async function conversar(prompt, options = {}) {
  const {
    modelo = CONFIG.defaultModel,
    systemPrompt = null,
    historico = [],
    maxTokens = CONFIG.maxTokens,
    temperature = CONFIG.temperature,
    topP = 0.9
  } = options;

  const client = getBedrockRuntimeClient();

  // Construir mensagens
  const messages = [
    ...historico.map(msg => ({
      role: msg.role,
      content: [{ text: msg.content }]
    })),
    {
      role: 'user',
      content: [{ text: prompt }]
    }
  ];

  // Configurar inferência
  // Nota: Claude 4.5 não suporta temperature/topP
  const modeloId = INFERENCE_PROFILES[modelo] || modelo;
  const isClaude45 = modeloId.includes('claude-haiku-4-5') ||
                     modeloId.includes('claude-sonnet-4-5') ||
                     modeloId.includes('claude-opus-4-5');

  const inferenceConfig = isClaude45
    ? { maxTokens }
    : { maxTokens, temperature, topP };

  // Montar comando
  const commandParams = {
    modelId: INFERENCE_PROFILES[modelo] || modelo,
    messages,
    inferenceConfig
  };

  // Adicionar system prompt se fornecido
  if (systemPrompt) {
    commandParams.system = [{ text: systemPrompt }];
  }

  try {
    const command = new ConverseCommand(commandParams);
    const response = await client.send(command);

    // Extrair resposta (suporte a modelos de raciocínio como DeepSeek R1)
    const content = response.output.message.content[0];
    let resposta = '';
    let raciocinio = null;

    if (content.text) {
      // Resposta normal (Claude, Nova, Llama, etc)
      resposta = content.text;
    } else if (content.reasoningContent) {
      // Modelo de raciocínio (DeepSeek R1)
      raciocinio = content.reasoningContent.reasoningText?.text || '';
      resposta = raciocinio;
    }

    return {
      sucesso: true,
      resposta,
      raciocinio, // Pensamento do modelo (DeepSeek R1)
      modelo,
      uso: {
        tokensEntrada: response.usage.inputTokens,
        tokensSaida: response.usage.outputTokens,
        tokensTotal: response.usage.totalTokens
      },
      latencia: response.metrics?.latencyMs || null,
      motivoParada: response.stopReason
    };
  } catch (error) {
    return {
      sucesso: false,
      erro: error.message,
      codigo: error.name,
      modelo
    };
  }
}

/**
 * Envia mensagem com streaming
 * @param {string} prompt - Mensagem do usuário
 * @param {function} onChunk - Callback para cada chunk
 * @param {object} options - Opções de configuração
 */
export async function conversarStream(prompt, onChunk, options = {}) {
  const {
    modelo = CONFIG.defaultModel,
    systemPrompt = null,
    historico = [],
    maxTokens = CONFIG.maxTokens,
    temperature = CONFIG.temperature
  } = options;

  const client = getBedrockRuntimeClient();

  const messages = [
    ...historico.map(msg => ({
      role: msg.role,
      content: [{ text: msg.content }]
    })),
    {
      role: 'user',
      content: [{ text: prompt }]
    }
  ];

  const commandParams = {
    modelId: INFERENCE_PROFILES[modelo] || modelo,
    messages,
    inferenceConfig: { maxTokens, temperature }
  };

  if (systemPrompt) {
    commandParams.system = [{ text: systemPrompt }];
  }

  try {
    const command = new ConverseStreamCommand(commandParams);
    const response = await client.send(command);

    let textoCompleto = '';

    for await (const event of response.stream) {
      if (event.contentBlockDelta?.delta?.text) {
        const chunk = event.contentBlockDelta.delta.text;
        textoCompleto += chunk;
        onChunk(chunk);
      }
    }

    return {
      sucesso: true,
      resposta: textoCompleto,
      modelo
    };
  } catch (error) {
    return {
      sucesso: false,
      erro: error.message,
      modelo
    };
  }
}

/**
 * Lista modelos disponíveis na conta
 */
export async function listarModelos() {
  const client = getBedrockManagementClient();

  try {
    const command = new ListFoundationModelsCommand({});
    const response = await client.send(command);

    return response.modelSummaries.map(model => ({
      id: model.modelId,
      nome: model.modelName,
      provedor: model.providerName,
      modalidades: model.inputModalities,
      streaming: model.responseStreamingSupported
    }));
  } catch (error) {
    return { erro: error.message };
  }
}

/**
 * Lista inference profiles ativos
 */
export async function listarInferenceProfiles() {
  const client = getBedrockManagementClient();

  try {
    const command = new ListInferenceProfilesCommand({});
    const response = await client.send(command);

    return response.inferenceProfileSummaries.map(profile => ({
      id: profile.inferenceProfileId,
      nome: profile.inferenceProfileName,
      status: profile.status,
      tipo: profile.type
    }));
  } catch (error) {
    return { erro: error.message };
  }
}

// ============================================================
// FUNÇÕES ESPECÍFICAS PARA ROM AGENT
// ============================================================

/**
 * Gera texto jurídico usando Bedrock
 * @param {string} tipo - Tipo de peça (peticao_inicial, habeas_corpus, etc)
 * @param {string} contexto - Contexto/fatos do caso
 * @param {object} options - Opções adicionais
 */
export async function gerarTextoJuridico(tipo, contexto, options = {}) {
  const systemPrompt = `Você é o ROM - Redator de Obras Magistrais, um assistente jurídico especializado em redação de peças processuais brasileiras.

REGRAS OBRIGATÓRIAS:
- NUNCA use emojis
- NUNCA use markdown
- Use formatação profissional para documentos jurídicos
- Cite legislação e jurisprudência quando aplicável
- Siga a estrutura técnica adequada ao tipo de peça
- Use linguagem formal e técnica do direito brasileiro`;

  const prompt = `Elabore uma ${tipo} com base no seguinte contexto:

${contexto}

Siga a estrutura técnica adequada e inclua fundamentação legal e jurisprudencial.`;

  return conversar(prompt, {
    ...options,
    systemPrompt,
    modelo: options.modelo || MODELOS_BEDROCK.amazon['nova-pro']
  });
}

/**
 * Analisa processo judicial
 */
export async function analisarProcesso(documentos, options = {}) {
  const systemPrompt = `Você é um analista jurídico especializado. Analise os documentos do processo e forneça:
1. Resumo dos fatos
2. Partes envolvidas
3. Pedidos/pretensões
4. Fundamentos jurídicos
5. Pontos críticos
6. Sugestões de estratégia`;

  return conversar(documentos, {
    ...options,
    systemPrompt,
    modelo: options.modelo || MODELOS_BEDROCK.amazon['nova-pro']
  });
}

/**
 * Análise jurídica profunda com DeepSeek R1 (modelo de raciocínio)
 * Ideal para: teses complexas, análise de precedentes, fundamentação
 */
export async function analisarComRaciocinio(questao, options = {}) {
  const systemPrompt = `Você é um jurista brasileiro especializado em análise jurídica profunda.
Analise a questão apresentada com raciocínio detalhado, considerando:
1. Legislação aplicável (CF, códigos, leis especiais)
2. Jurisprudência relevante (STF, STJ, tribunais estaduais)
3. Doutrina majoritária
4. Argumentos favoráveis e contrários
5. Conclusão fundamentada

Seja preciso nas citações legais e jurisprudenciais.`;

  const resultado = await conversar(questao, {
    ...options,
    systemPrompt,
    modelo: 'deepseek.r1-v1:0',
    maxTokens: options.maxTokens || 2000
  });

  return {
    ...resultado,
    tipo: 'analise_raciocinio',
    modelo: 'DeepSeek R1'
  };
}

/**
 * Pesquisa jurisprudência
 */
export async function pesquisarJurisprudencia(tema, options = {}) {
  const systemPrompt = `Você é um pesquisador jurídico especializado em jurisprudência brasileira.
Forneça precedentes relevantes sobre o tema, indicando:
- Tribunal
- Número do processo
- Relator
- Data do julgamento
- Tese firmada

IMPORTANTE: Indique que os precedentes devem ser verificados nas fontes oficiais.`;

  return conversar(`Pesquise jurisprudência sobre: ${tema}`, {
    ...options,
    systemPrompt,
    modelo: options.modelo || MODELOS_BEDROCK.amazon['nova-pro']
  });
}

// ============================================================
// CLASSE PRINCIPAL
// ============================================================

export class BedrockAgent {
  constructor(options = {}) {
    this.modelo = options.modelo || CONFIG.defaultModel;
    this.region = options.region || CONFIG.region;
    this.systemPrompt = options.systemPrompt || null;
    this.historico = [];
  }

  async enviar(mensagem, options = {}) {
    const resultado = await conversar(mensagem, {
      modelo: this.modelo,
      systemPrompt: this.systemPrompt,
      historico: this.historico,
      ...options
    });

    if (resultado.sucesso) {
      this.historico.push({ role: 'user', content: mensagem });
      this.historico.push({ role: 'assistant', content: resultado.resposta });
    }

    return resultado;
  }

  async enviarStream(mensagem, onChunk, options = {}) {
    return conversarStream(mensagem, onChunk, {
      modelo: this.modelo,
      systemPrompt: this.systemPrompt,
      historico: this.historico,
      ...options
    });
  }

  limparHistorico() {
    this.historico = [];
  }

  setModelo(modelo) {
    this.modelo = modelo;
  }

  setSystemPrompt(prompt) {
    this.systemPrompt = prompt;
  }
}

// ============================================================
// EXPORTS
// ============================================================

export default {
  // Configuração
  CONFIG,
  MODELOS_BEDROCK,
  INFERENCE_PROFILES,

  // Funções principais
  conversar,
  conversarStream,
  listarModelos,
  listarInferenceProfiles,

  // Funções ROM Agent
  gerarTextoJuridico,
  analisarProcesso,
  pesquisarJurisprudencia,
  analisarComRaciocinio, // DeepSeek R1

  // Classe
  BedrockAgent
};
