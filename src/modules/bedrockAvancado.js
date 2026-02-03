/**
 * ROM Agent - Módulo AWS Bedrock Avançado
 * Ferramentas adicionais: Embeddings, Reranking, Multimodal, Imagem, Áudio, Vídeo
 *
 * @version 1.0.0
 */

import {
  BedrockRuntimeClient,
  InvokeModelCommand,
  ConverseCommand
} from '@aws-sdk/client-bedrock-runtime';

import * as fs from 'fs';
import * as path from 'path';

// Retry logic with exponential backoff
import { retryAwsCommand } from '../utils/retry-with-backoff.js';

// ============================================================
// CONFIGURAÇÃO
// ============================================================

const CONFIG = {
  region: process.env.AWS_REGION || 'us-west-2'
};

let client = null;

function getClient() {
  if (!client) {
    client = new BedrockRuntimeClient({ region: CONFIG.region });
  }
  return client;
}

// ============================================================
// MODELOS DISPONÍVEIS
// ============================================================

export const MODELOS_AVANCADOS = {
  embeddings: {
    'cohere-embed-v4': 'cohere.embed-v4:0',
    'cohere-multilingual': 'cohere.embed-multilingual-v3',
    'titan-embed-text': 'amazon.titan-embed-text-v2:0',
    'titan-embed-image': 'amazon.titan-embed-image-v1',
    'nova-embed': 'amazon.nova-2-multimodal-embeddings-v1:0'
  },
  reranking: {
    'cohere-rerank': 'cohere.rerank-v3-5:0'
  },
  multimodal: {
    'claude-sonnet-4': 'us.anthropic.claude-sonnet-4-20250514-v1:0',
    'claude-sonnet-4.5': 'us.anthropic.claude-sonnet-4-5-20250929-v1:0',
    'nova-pro': 'amazon.nova-pro-v1:0',
    'nova-premier': 'amazon.nova-premier-v1:0'
  },
  imagem: {
    'stable-upscale': 'stability.stable-fast-upscale-v1:0',
    'stable-remove-bg': 'stability.stable-image-remove-background-v1:0',
    'stable-inpaint': 'stability.stable-image-inpaint-v1:0',
    'stable-outpaint': 'stability.stable-outpaint-v1:0',
    'titan-image': 'amazon.titan-image-generator-v2:0',
    'nova-canvas': 'amazon.nova-canvas-v1:0'
  },
  audio: {
    'nova-sonic': 'amazon.nova-sonic-v1:0',
    'voxtral-mini': 'mistral.voxtral-mini-3b-2507',
    'voxtral-small': 'mistral.voxtral-small-24b-2507'
  },
  video: {
    'pegasus': 'twelvelabs.pegasus-1-2-v1:0',
    'marengo-embed': 'twelvelabs.marengo-embed-3-0-v1:0'
  }
};

// ============================================================
// 1. EMBEDDINGS - BUSCA SEMÂNTICA
// ============================================================

/**
 * Gera embeddings (vetores) para texto - útil para busca semântica
 * @param {string|string[]} textos - Texto(s) para gerar embeddings
 * @param {object} options - Opções
 * @returns {Promise<object>} Embeddings gerados
 */
export async function gerarEmbeddings(textos, options = {}) {
  const {
    modelo = 'cohere.embed-multilingual-v3',
    inputType = 'search_document' // search_document, search_query, classification, clustering
  } = options;

  const client = getClient();
  const textosArray = Array.isArray(textos) ? textos : [textos];

  try {
    // Cohere Embed
    if (modelo.includes('cohere')) {
      const body = JSON.stringify({
        texts: textosArray,
        input_type: inputType,
        truncate: 'END'
      });

      const command = new InvokeModelCommand({
        modelId: modelo,
        contentType: 'application/json',
        accept: 'application/json',
        body
      });

      const response = await retryAwsCommand(client, command, {
        modelId: modelo,
        operation: 'embedding'
      });
      const result = JSON.parse(new TextDecoder().decode(response.body));

      return {
        sucesso: true,
        embeddings: result.embeddings,
        dimensoes: result.embeddings[0]?.length || 0,
        modelo,
        textos: textosArray.length
      };
    }

    // Titan Embed
    if (modelo.includes('titan')) {
      const embeddings = [];

      for (const texto of textosArray) {
        const body = JSON.stringify({
          inputText: texto
        });

        const command = new InvokeModelCommand({
          modelId: modelo,
          contentType: 'application/json',
          accept: 'application/json',
          body
        });

        const response = await retryAwsCommand(client, command, {
          modelId: modelo,
          operation: 'embedding_batch'
        });
        const result = JSON.parse(new TextDecoder().decode(response.body));
        embeddings.push(result.embedding);
      }

      return {
        sucesso: true,
        embeddings,
        dimensoes: embeddings[0]?.length || 0,
        modelo,
        textos: textosArray.length
      };
    }

    return { sucesso: false, erro: 'Modelo de embedding não suportado' };
  } catch (error) {
    return { sucesso: false, erro: error.message };
  }
}

/**
 * Calcula similaridade entre dois vetores (cosseno)
 */
export function calcularSimilaridade(vetor1, vetor2) {
  if (vetor1.length !== vetor2.length) {
    throw new Error('Vetores devem ter mesmo tamanho');
  }

  let dotProduct = 0;
  let norm1 = 0;
  let norm2 = 0;

  for (let i = 0; i < vetor1.length; i++) {
    dotProduct += vetor1[i] * vetor2[i];
    norm1 += vetor1[i] * vetor1[i];
    norm2 += vetor2[i] * vetor2[i];
  }

  return dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2));
}

/**
 * Busca semântica em documentos
 * @param {string} query - Consulta
 * @param {string[]} documentos - Lista de documentos para buscar
 * @param {object} options - Opções
 */
export async function buscaSemantica(query, documentos, options = {}) {
  const { topK = 5, modelo = 'cohere.embed-multilingual-v3' } = options;

  // Gerar embedding da query
  const queryEmbed = await gerarEmbeddings(query, {
    modelo,
    inputType: 'search_query'
  });

  if (!queryEmbed.sucesso) {
    return queryEmbed;
  }

  // Gerar embeddings dos documentos
  const docsEmbed = await gerarEmbeddings(documentos, {
    modelo,
    inputType: 'search_document'
  });

  if (!docsEmbed.sucesso) {
    return docsEmbed;
  }

  // Calcular similaridades
  const resultados = documentos.map((doc, i) => ({
    documento: doc,
    indice: i,
    similaridade: calcularSimilaridade(queryEmbed.embeddings[0], docsEmbed.embeddings[i])
  }));

  // Ordenar por similaridade
  resultados.sort((a, b) => b.similaridade - a.similaridade);

  return {
    sucesso: true,
    query,
    resultados: resultados.slice(0, topK),
    totalDocumentos: documentos.length
  };
}

// ============================================================
// 2. RERANKING - REORDENAÇÃO DE RESULTADOS
// ============================================================

/**
 * Reordena resultados de busca por relevância
 * @param {string} query - Consulta original
 * @param {string[]} documentos - Documentos para reordenar
 * @param {object} options - Opções
 */
export async function reordenarResultados(query, documentos, options = {}) {
  const {
    topK = 10,
    modelo = 'cohere.rerank-v3-5:0'
  } = options;

  const client = getClient();

  try {
    const body = JSON.stringify({
      query,
      documents: documentos.map(d => typeof d === 'string' ? { text: d } : d),
      top_n: topK,
      return_documents: true
    });

    const command = new InvokeModelCommand({
      modelId: modelo,
      contentType: 'application/json',
      accept: 'application/json',
      body
    });

    const response = await retryAwsCommand(client, command, { modelId: modelo, operation: 'rerank' });
    const result = JSON.parse(new TextDecoder().decode(response.body));

    return {
      sucesso: true,
      resultados: result.results.map(r => ({
        indice: r.index,
        relevancia: r.relevance_score,
        documento: documentos[r.index]
      })),
      query,
      modelo
    };
  } catch (error) {
    return { sucesso: false, erro: error.message };
  }
}

// ============================================================
// 3. MULTIMODAL - ANÁLISE DE IMAGENS
// ============================================================

/**
 * Analisa imagem com texto (Claude, Nova)
 * @param {string} imagemPath - Caminho da imagem ou URL
 * @param {string} prompt - O que analisar na imagem
 * @param {object} options - Opções
 */
export async function analisarImagem(imagemPath, prompt, options = {}) {
  const {
    modelo = 'amazon.nova-pro-v1:0',
    maxTokens = 16000
  } = options;

  const client = getClient();

  try {
    let imageData;
    let mediaType;

    // Carregar imagem
    if (imagemPath.startsWith('http')) {
      // URL - baixar imagem
      const response = await fetch(imagemPath);
      const buffer = await response.arrayBuffer();
      imageData = Buffer.from(buffer).toString('base64');
      mediaType = response.headers.get('content-type') || 'image/jpeg';
    } else {
      // Arquivo local
      const buffer = fs.readFileSync(imagemPath);
      imageData = buffer.toString('base64');
      const ext = path.extname(imagemPath).toLowerCase();
      mediaType = ext === '.png' ? 'image/png' : ext === '.gif' ? 'image/gif' : 'image/jpeg';
    }

    // Usar API Converse para multimodal
    const command = new ConverseCommand({
      modelId: modelo,
      messages: [{
        role: 'user',
        content: [
          {
            image: {
              format: mediaType.split('/')[1],
              source: { bytes: Buffer.from(imageData, 'base64') }
            }
          },
          { text: prompt }
        ]
      }],
      inferenceConfig: { maxTokens }
    });

    const response = await retryAwsCommand(client, command, { modelId: modelo, operation: 'vision_image' });

    return {
      sucesso: true,
      analise: response.output.message.content[0].text,
      modelo,
      tokens: response.usage.totalTokens
    };
  } catch (error) {
    return { sucesso: false, erro: error.message };
  }
}

/**
 * Analisa documento escaneado (PDF convertido em imagens)
 */
export async function analisarDocumentoEscaneado(imagemPath, options = {}) {
  const prompt = `Analise este documento jurídico escaneado e extraia:
1. Tipo de documento (petição, sentença, contrato, etc.)
2. Partes envolvidas
3. Data do documento
4. Principais informações e cláusulas
5. Assinaturas identificadas
6. Qualquer informação relevante para análise jurídica

Seja preciso e detalhado na extração.`;

  return analisarImagem(imagemPath, prompt, {
    ...options,
    modelo: options.modelo || 'amazon.nova-pro-v1:0'
  });
}

/**
 * Extrai texto de imagem (OCR avançado)
 */
export async function extrairTextoImagem(imagemPath, options = {}) {
  const prompt = `Extraia TODO o texto visível nesta imagem, mantendo a formatação original o máximo possível.
Inclua cabeçalhos, parágrafos, listas, tabelas, assinaturas e quaisquer anotações.
Se houver texto ilegível, indique com [ilegível].`;

  return analisarImagem(imagemPath, prompt, {
    ...options,
    modelo: options.modelo || 'amazon.nova-pro-v1:0',
    maxTokens: 32000
  });
}

// ============================================================
// 4. PROCESSAMENTO DE IMAGEM (Stability AI)
// ============================================================

/**
 * Melhora qualidade de imagem (upscale)
 */
export async function melhorarImagem(imagemPath, options = {}) {
  const {
    modelo = 'stability.stable-fast-upscale-v1:0',
    outputPath = null
  } = options;

  const client = getClient();

  try {
    const imageBuffer = fs.readFileSync(imagemPath);
    const imageBase64 = imageBuffer.toString('base64');

    const body = JSON.stringify({
      image: imageBase64,
      output_format: 'png'
    });

    const command = new InvokeModelCommand({
      modelId: modelo,
      contentType: 'application/json',
      accept: 'application/json',
      body
    });

    const response = await retryAwsCommand(client, command, { modelId: modelo, operation: 'generate_image' });
    const result = JSON.parse(new TextDecoder().decode(response.body));

    if (result.image) {
      const outputBuffer = Buffer.from(result.image, 'base64');

      if (outputPath) {
        fs.writeFileSync(outputPath, outputBuffer);
        return { sucesso: true, arquivo: outputPath };
      }

      return { sucesso: true, imagem: result.image };
    }

    return { sucesso: false, erro: 'Falha ao processar imagem' };
  } catch (error) {
    return { sucesso: false, erro: error.message };
  }
}

/**
 * Remove fundo de imagem (útil para assinaturas)
 */
export async function removerFundo(imagemPath, outputPath = null) {
  const client = getClient();

  try {
    const imageBuffer = fs.readFileSync(imagemPath);
    const imageBase64 = imageBuffer.toString('base64');

    const body = JSON.stringify({
      image: imageBase64,
      output_format: 'png'
    });

    const command = new InvokeModelCommand({
      modelId: 'stability.stable-image-remove-background-v1:0',
      contentType: 'application/json',
      accept: 'application/json',
      body
    });

    const response = await retryAwsCommand(client, command, { modelId: 'stability.stable-image-remove-background-v1:0', operation: 'remove_background' });
    const result = JSON.parse(new TextDecoder().decode(response.body));

    if (result.image) {
      const outputBuffer = Buffer.from(result.image, 'base64');

      if (outputPath) {
        fs.writeFileSync(outputPath, outputBuffer);
        return { sucesso: true, arquivo: outputPath };
      }

      return { sucesso: true, imagem: result.image };
    }

    return { sucesso: false, erro: 'Falha ao remover fundo' };
  } catch (error) {
    return { sucesso: false, erro: error.message };
  }
}

/**
 * Gera imagem a partir de texto (diagramas, fluxogramas)
 */
export async function gerarImagem(prompt, options = {}) {
  const {
    modelo = 'amazon.nova-canvas-v1:0',
    width = 1024,
    height = 1024,
    outputPath = null
  } = options;

  const client = getClient();

  try {
    const body = JSON.stringify({
      taskType: 'TEXT_IMAGE',
      textToImageParams: {
        text: prompt
      },
      imageGenerationConfig: {
        width,
        height,
        numberOfImages: 1
      }
    });

    const command = new InvokeModelCommand({
      modelId: modelo,
      contentType: 'application/json',
      accept: 'application/json',
      body
    });

    const response = await retryAwsCommand(client, command, { modelId: modelo, operation: 'edit_image' });
    const result = JSON.parse(new TextDecoder().decode(response.body));

    if (result.images && result.images[0]) {
      const outputBuffer = Buffer.from(result.images[0], 'base64');

      if (outputPath) {
        fs.writeFileSync(outputPath, outputBuffer);
        return { sucesso: true, arquivo: outputPath };
      }

      return { sucesso: true, imagem: result.images[0] };
    }

    return { sucesso: false, erro: 'Falha ao gerar imagem' };
  } catch (error) {
    return { sucesso: false, erro: error.message };
  }
}

// ============================================================
// 5. ÁUDIO/VOZ - TRANSCRIÇÃO
// ============================================================

/**
 * Transcreve áudio para texto
 * @param {string} audioPath - Caminho do arquivo de áudio
 * @param {object} options - Opções
 */
export async function transcreverAudio(audioPath, options = {}) {
  const {
    modelo = 'amazon.nova-sonic-v1:0',
    idioma = 'pt-BR'
  } = options;

  const client = getClient();

  try {
    const audioBuffer = fs.readFileSync(audioPath);
    const audioBase64 = audioBuffer.toString('base64');
    const ext = path.extname(audioPath).toLowerCase();

    // Determinar formato
    let format = 'mp3';
    if (ext === '.wav') format = 'wav';
    else if (ext === '.m4a') format = 'm4a';
    else if (ext === '.ogg') format = 'ogg';

    const body = JSON.stringify({
      audio: {
        format,
        data: audioBase64
      },
      language: idioma
    });

    const command = new InvokeModelCommand({
      modelId: modelo,
      contentType: 'application/json',
      accept: 'application/json',
      body
    });

    const response = await retryAwsCommand(client, command, { modelId: modelo, operation: 'generate_audio' });
    const result = JSON.parse(new TextDecoder().decode(response.body));

    return {
      sucesso: true,
      transcricao: result.transcript || result.text,
      idioma,
      modelo
    };
  } catch (error) {
    return { sucesso: false, erro: error.message };
  }
}

/**
 * Transcreve audiência/depoimento com identificação de falantes
 */
export async function transcreverAudiencia(audioPath, options = {}) {
  const {
    modelo = 'mistral.voxtral-small-24b-2507',
    idioma = 'pt-BR'
  } = options;

  // Voxtral suporta diarização (identificação de falantes)
  return transcreverAudio(audioPath, {
    ...options,
    modelo
  });
}

// ============================================================
// 6. ANÁLISE DE VÍDEO
// ============================================================

/**
 * Analisa vídeo e extrai informações
 * @param {string} videoPath - Caminho do vídeo
 * @param {string} prompt - O que analisar no vídeo
 */
export async function analisarVideo(videoPath, prompt, options = {}) {
  const {
    modelo = 'amazon.nova-pro-v1:0',
    maxTokens = 16000
  } = options;

  const client = getClient();

  try {
    const videoBuffer = fs.readFileSync(videoPath);
    const videoBase64 = videoBuffer.toString('base64');
    const ext = path.extname(videoPath).toLowerCase();

    let format = 'mp4';
    if (ext === '.mov') format = 'mov';
    else if (ext === '.avi') format = 'avi';
    else if (ext === '.webm') format = 'webm';

    const command = new ConverseCommand({
      modelId: modelo,
      messages: [{
        role: 'user',
        content: [
          {
            video: {
              format,
              source: { bytes: videoBuffer }
            }
          },
          { text: prompt }
        ]
      }],
      inferenceConfig: { maxTokens }
    });

    const response = await retryAwsCommand(client, command, { modelId: modelo, operation: 'analyze_video' });

    return {
      sucesso: true,
      analise: response.output.message.content[0].text,
      modelo,
      tokens: response.usage.totalTokens
    };
  } catch (error) {
    return { sucesso: false, erro: error.message };
  }
}

/**
 * Analisa vídeo de prova/evidência
 */
export async function analisarVideoProva(videoPath, options = {}) {
  const prompt = `Analise este vídeo como evidência/prova judicial:
1. Descreva cronologicamente os eventos mostrados
2. Identifique pessoas visíveis (aparência, roupas, características)
3. Identifique objetos relevantes
4. Descreva o ambiente/local
5. Note qualquer ação suspeita ou relevante
6. Indique timestamps importantes
7. Avalie a qualidade e autenticidade aparente do vídeo

Seja objetivo e detalhado como um laudo pericial.`;

  return analisarVideo(videoPath, prompt, options);
}

// ============================================================
// FUNÇÕES JURÍDICAS ESPECIALIZADAS
// ============================================================

/**
 * Busca jurisprudência similar usando embeddings
 */
export async function buscarJurisprudenciaSimilar(casoAtual, jurisprudencias, options = {}) {
  const { topK = 5 } = options;

  const resultado = await buscaSemantica(casoAtual, jurisprudencias, { topK });

  if (resultado.sucesso) {
    return {
      sucesso: true,
      precedentes: resultado.resultados.map(r => ({
        texto: r.documento,
        relevancia: (r.similaridade * 100).toFixed(1) + '%'
      }))
    };
  }

  return resultado;
}

/**
 * Analisa contrato escaneado
 */
export async function analisarContratoEscaneado(imagemPath, options = {}) {
  const prompt = `Analise este contrato escaneado e forneça:
1. TIPO DE CONTRATO
2. PARTES CONTRATANTES (nomes, qualificação se visível)
3. OBJETO DO CONTRATO
4. VALOR E FORMA DE PAGAMENTO
5. PRAZO/VIGÊNCIA
6. CLÁUSULAS PRINCIPAIS (resumo de cada)
7. CLÁUSULAS DE RESCISÃO
8. PENALIDADES
9. FORO DE ELEIÇÃO
10. DATA E ASSINATURAS

Se alguma parte estiver ilegível, indique [ilegível].
Destaque cláusulas potencialmente abusivas ou problemáticas.`;

  return analisarImagem(imagemPath, prompt, {
    ...options,
    maxTokens: 32000
  });
}

/**
 * Compara documentos para verificar alterações
 */
export async function compararDocumentos(imagem1Path, imagem2Path, options = {}) {
  const [doc1, doc2] = await Promise.all([
    extrairTextoImagem(imagem1Path, options),
    extrairTextoImagem(imagem2Path, options)
  ]);

  if (!doc1.sucesso || !doc2.sucesso) {
    return { sucesso: false, erro: 'Falha ao extrair texto de um ou ambos documentos' };
  }

  // Usar embedding para comparar
  const similarity = await buscaSemantica(doc1.analise, [doc2.analise]);

  return {
    sucesso: true,
    documento1: doc1.analise.substring(0, 500) + '...',
    documento2: doc2.analise.substring(0, 500) + '...',
    similaridade: similarity.sucesso ? similarity.resultados[0]?.similaridade : null,
    identicos: similarity.sucesso && similarity.resultados[0]?.similaridade > 0.95
  };
}

// ============================================================
// EXPORTS
// ============================================================

export default {
  // Configuração
  MODELOS_AVANCADOS,

  // Embeddings
  gerarEmbeddings,
  calcularSimilaridade,
  buscaSemantica,

  // Reranking
  reordenarResultados,

  // Multimodal
  analisarImagem,
  analisarDocumentoEscaneado,
  extrairTextoImagem,

  // Processamento de Imagem
  melhorarImagem,
  removerFundo,
  gerarImagem,

  // Áudio
  transcreverAudio,
  transcreverAudiencia,

  // Vídeo
  analisarVideo,
  analisarVideoProva,

  // Funções Jurídicas
  buscarJurisprudenciaSimilar,
  analisarContratoEscaneado,
  compararDocumentos
};
