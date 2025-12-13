/**
 * ROM - Redator de Obras Magistrais
 * Agente de IA para Redação de Peças Jurídicas com Excelência
 *
 * Integra:
 * - Legislação nacional e internacional completa
 * - Jurisprudência de todos os tribunais brasileiros
 * - Web search jurídico e científico
 * - Correção de português e estilo jurídico
 * - Formatação profissional de documentos
 * - Extração e processamento de processos judiciais
 */

import Anthropic from '@anthropic-ai/sdk';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

// Importar módulos jurídicos
import legislacao from './modules/legislacao.js';
import tribunais from './modules/tribunais.js';
import webSearch from './modules/webSearch.js';
import portugues from './modules/portugues.js';
import documentos from './modules/documentos.js';
import extracao from './modules/extracao.js';
import prompts from './modules/prompts.js';
import promptsCompletos from './modules/promptsCompletos.js';
import resumoExecutivo from './modules/resumoExecutivo.js';

// Importar ferramentas SDK
import sdkTools from './modules/sdkTools.js';

// Importar módulos avançados
import analiseAvancada from './modules/analiseAvancada.js';
import templates from './modules/templates.js';
import ocrAvancado from './modules/ocrAvancado.js';
import { SubagentManager, SUBAGENTES } from './modules/subagents.js';

// Importar módulos AWS Bedrock
import bedrock from './modules/bedrock.js';
import bedrockAvancado from './modules/bedrockAvancado.js';

// Importar módulo de Jurisprudência
import jurisprudencia from './modules/jurisprudencia.js';

// Importar módulo Jusbrasil Autenticado (Puppeteer)
import jusbrasilAuth from './modules/jusbrasilAuth.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuração do agente
const CONFIG = {
  nome: 'ROM',
  versao: '2.0.0',
  descricao: 'Redator de Obras Magistrais - Agente de IA para Redação de Peças Jurídicas com Excelência',
  modelo: 'claude-sonnet-4-20250514',
  maxTokens: 200000,
  temperatura: 0.7,

  // Caminhos
  promptsPath: '/Users/rodolfootaviopereiradamotaoliveira/Library/CloudStorage/OneDrive-Pessoal/Prompt',
  kbPath: '/Users/rodolfootaviopereiradamotaoliveira/Library/CloudStorage/OneDrive-Pessoal/Prompt/KB_REDATOR_ROM',

  // Capacidades
  capacidades: [
    'Redação de peças jurídicas (cíveis, criminais, trabalhistas, etc)',
    'Pesquisa de legislação nacional e internacional',
    'Consulta de jurisprudência em todos os tribunais',
    'Análise e extração de processos judiciais',
    'Correção ortográfica e gramatical',
    'Formatação profissional com papel timbrado',
    'Criação de tabelas, fluxogramas e linhas do tempo',
    'Busca de artigos científicos jurídicos'
  ]
};

// Definição das ferramentas do agente
const TOOLS = [
  // Ferramentas de Legislação
  {
    name: 'buscar_legislacao',
    description: 'Busca legislação brasileira e internacional por termo ou código específico',
    input_schema: {
      type: 'object',
      properties: {
        termo: { type: 'string', description: 'Termo de busca ou sigla do código (CF, CC, CP, CPC, CPP, CLT, CDC, etc)' },
        categoria: { type: 'string', description: 'Categoria: constitucional, infraconstitucional, internacional, complementar' }
      },
      required: ['termo']
    }
  },
  {
    name: 'obter_artigo',
    description: 'Obtém artigo específico de um código ou lei',
    input_schema: {
      type: 'object',
      properties: {
        codigo: { type: 'string', description: 'Sigla do código (CF, CC, CP, CPC, CPP, CLT, CDC, CTN, ECA, LEP, etc)' },
        artigo: { type: 'string', description: 'Número do artigo' }
      },
      required: ['codigo', 'artigo']
    }
  },
  {
    name: 'buscar_sumulas',
    description: 'Busca súmulas de tribunais superiores',
    input_schema: {
      type: 'object',
      properties: {
        tribunal: { type: 'string', description: 'Tribunal (STF, STJ, TST, TSE)' },
        termo: { type: 'string', description: 'Termo de busca opcional' }
      },
      required: ['tribunal']
    }
  },

  // Ferramentas de Tribunais
  {
    name: 'buscar_jurisprudencia',
    description: 'Busca jurisprudência em tribunal específico',
    input_schema: {
      type: 'object',
      properties: {
        tribunal: { type: 'string', description: 'Sigla do tribunal (STF, STJ, TST, STM, TRF1-6, TJSP, TJRJ, etc)' },
        termo: { type: 'string', description: 'Termo de busca' }
      },
      required: ['tribunal', 'termo']
    }
  },
  {
    name: 'consultar_processo',
    description: 'Consulta informações de processo pelo número',
    input_schema: {
      type: 'object',
      properties: {
        numero_processo: { type: 'string', description: 'Número do processo (formato CNJ: NNNNNNN-DD.AAAA.J.TR.OOOO)' },
        tribunal: { type: 'string', description: 'Tribunal (opcional, será inferido do número)' }
      },
      required: ['numero_processo']
    }
  },
  {
    name: 'listar_tribunais',
    description: 'Lista todos os tribunais disponíveis para consulta',
    input_schema: {
      type: 'object',
      properties: {}
    }
  },

  // Ferramentas de Web Search
  {
    name: 'buscar_jusbrasil',
    description: 'Busca no JusBrasil (jurisprudência, artigos, notícias, modelos)',
    input_schema: {
      type: 'object',
      properties: {
        termo: { type: 'string', description: 'Termo de busca' },
        tipo: { type: 'string', description: 'Tipo: jurisprudencia, noticias, artigos, peticoes, modelos, tudo' }
      },
      required: ['termo']
    }
  },
  {
    name: 'buscar_artigos_cientificos',
    description: 'Busca artigos científicos em bases acadêmicas',
    input_schema: {
      type: 'object',
      properties: {
        termo: { type: 'string', description: 'Termo de busca' },
        area: { type: 'string', description: 'Área: direito, medicina, engenharia, multidisciplinar' }
      },
      required: ['termo']
    }
  },
  {
    name: 'buscar_noticias_juridicas',
    description: 'Busca notícias em sites jurídicos (Conjur, Migalhas, Jota)',
    input_schema: {
      type: 'object',
      properties: {
        termo: { type: 'string', description: 'Termo de busca' }
      },
      required: ['termo']
    }
  },

  // Ferramentas de Português
  {
    name: 'verificar_gramatica',
    description: 'Verifica gramática e erros comuns em texto jurídico',
    input_schema: {
      type: 'object',
      properties: {
        texto: { type: 'string', description: 'Texto a ser verificado' }
      },
      required: ['texto']
    }
  },
  {
    name: 'sugerir_sinonimos',
    description: 'Sugere sinônimos jurídicos para um termo',
    input_schema: {
      type: 'object',
      properties: {
        termo: { type: 'string', description: 'Termo para buscar sinônimos' }
      },
      required: ['termo']
    }
  },
  {
    name: 'consultar_dicionario_juridico',
    description: 'Consulta significado de termo jurídico ou latinismo',
    input_schema: {
      type: 'object',
      properties: {
        termo: { type: 'string', description: 'Termo jurídico ou latinismo' }
      },
      required: ['termo']
    }
  },
  {
    name: 'analisar_estilo',
    description: 'Analisa estilo e formalidade do texto jurídico',
    input_schema: {
      type: 'object',
      properties: {
        texto: { type: 'string', description: 'Texto a ser analisado' }
      },
      required: ['texto']
    }
  },

  // Ferramentas de Documentos
  {
    name: 'gerar_estrutura_peca',
    description: 'Gera estrutura/template de peça jurídica',
    input_schema: {
      type: 'object',
      properties: {
        tipo_peca: { type: 'string', description: 'Tipo: peticao_inicial, contestacao, recurso_apelacao, habeas_corpus, agravo' }
      },
      required: ['tipo_peca']
    }
  },
  {
    name: 'criar_tabela',
    description: 'Cria tabela formatada para documento',
    input_schema: {
      type: 'object',
      properties: {
        dados: { type: 'array', description: 'Array de arrays com dados da tabela' },
        cabecalho: { type: 'boolean', description: 'Se primeira linha é cabeçalho' }
      },
      required: ['dados']
    }
  },
  {
    name: 'criar_linha_do_tempo',
    description: 'Cria linha do tempo de eventos',
    input_schema: {
      type: 'object',
      properties: {
        eventos: { type: 'array', description: 'Array de objetos {data, descricao}' }
      },
      required: ['eventos']
    }
  },
  {
    name: 'criar_fluxograma',
    description: 'Cria fluxograma em formato Mermaid',
    input_schema: {
      type: 'object',
      properties: {
        etapas: { type: 'array', description: 'Array de objetos {nome, condicao}' }
      },
      required: ['etapas']
    }
  },
  {
    name: 'listar_estruturas_pecas',
    description: 'Lista tipos de peças jurídicas disponíveis',
    input_schema: {
      type: 'object',
      properties: {}
    }
  },

  // Ferramentas de Extração
  {
    name: 'extrair_processo_pdf',
    description: 'Extrai e processa texto de PDF de processo judicial',
    input_schema: {
      type: 'object',
      properties: {
        caminho_arquivo: { type: 'string', description: 'Caminho completo do arquivo PDF' }
      },
      required: ['caminho_arquivo']
    }
  },
  {
    name: 'listar_ferramentas_extracao',
    description: 'Lista as 33 ferramentas de processamento e 10 processadores de otimização',
    input_schema: {
      type: 'object',
      properties: {}
    }
  },

  // Ferramentas de Prompts e Peças
  {
    name: 'obter_prompt_peca',
    description: 'Obtém o prompt/template completo para um tipo de peça jurídica',
    input_schema: {
      type: 'object',
      properties: {
        tipo_peca: { type: 'string', description: 'Tipo da peça: peticao_inicial, contestacao, habeas_corpus, apelacao_criminal, contrato_social, etc' }
      },
      required: ['tipo_peca']
    }
  },
  {
    name: 'listar_todas_pecas',
    description: 'Lista todas as peças processuais e extraprocessuais disponíveis',
    input_schema: {
      type: 'object',
      properties: {}
    }
  },

  // Ferramentas de Prompts Completos ROM V3.0
  {
    name: 'obter_prompt_completo',
    description: 'Obtém prompt completo com toda riqueza do KB ROM V3.0 (master, peticao_inicial, habeas_corpus, contestacao, alegacoes_finais, apelacao_criminal, resposta_acusacao, revisao_criminal, embargos_declaracao, agravo_interno)',
    input_schema: {
      type: 'object',
      properties: {
        tipo: { type: 'string', description: 'Tipo: master, peticao_inicial, habeas_corpus, contestacao, alegacoes_finais, apelacao_criminal, resposta_acusacao, revisao_criminal, embargos_declaracao, agravo_interno' }
      },
      required: ['tipo']
    }
  },
  {
    name: 'gerar_instrucao_completa',
    description: 'Gera instrução completa formatada para redação de peça jurídica seguindo padrão ROM V3.0',
    input_schema: {
      type: 'object',
      properties: {
        tipo: { type: 'string', description: 'Tipo da peça jurídica' }
      },
      required: ['tipo']
    }
  },
  {
    name: 'obter_master_rom',
    description: 'Obtém o MASTER ROM V3.0 com identidade do escritório, formatação, vocabulário, vocativos, extensão recomendada e checklist universal',
    input_schema: {
      type: 'object',
      properties: {}
    }
  },
  {
    name: 'listar_prompts_completos',
    description: 'Lista todos os prompts completos disponíveis no KB ROM V3.0',
    input_schema: {
      type: 'object',
      properties: {}
    }
  },

  // Ferramentas de Resumo Executivo
  {
    name: 'gerar_resumo_executivo',
    description: 'Gera resumo executivo completo de processo (Camadas 1, 2 ou 3)',
    input_schema: {
      type: 'object',
      properties: {
        camada: { type: 'number', description: 'Camada de análise: 1 (básico), 2 (denso), 3 (aprimorado com prequestionamento)' }
      },
      required: ['camada']
    }
  },
  {
    name: 'obter_template_leading_case',
    description: 'Obtém template para análise de leading case e precedentes',
    input_schema: {
      type: 'object',
      properties: {}
    }
  },
  {
    name: 'obter_template_prequestionamento',
    description: 'Obtém template estruturado de prequestionamento',
    input_schema: {
      type: 'object',
      properties: {}
    }
  },
  {
    name: 'obter_template_prazos',
    description: 'Obtém template para análise de prescrição, decadência e preclusão',
    input_schema: {
      type: 'object',
      properties: {}
    }
  },
  {
    name: 'listar_bases_precedentes',
    description: 'Lista bases de precedentes (súmulas vinculantes, temas repetitivos, IRDR, ADI, ADPF, etc)',
    input_schema: {
      type: 'object',
      properties: {}
    }
  },

  // ========================================================================
  // FERRAMENTAS AWS BEDROCK
  // ========================================================================
  {
    name: 'bedrock_conversar',
    description: 'Envia mensagem para modelo AWS Bedrock (Nova, Claude, Llama, Mistral, etc)',
    input_schema: {
      type: 'object',
      properties: {
        prompt: { type: 'string', description: 'Mensagem para o modelo' },
        modelo: { type: 'string', description: 'ID do modelo (amazon.nova-pro-v1:0, anthropic.claude-3-haiku-20240307-v1:0, etc). Padrão: nova-pro' },
        systemPrompt: { type: 'string', description: 'Instrução de sistema (opcional)' },
        maxTokens: { type: 'number', description: 'Máximo de tokens na resposta (padrão: 4096)' },
        temperature: { type: 'number', description: 'Temperatura 0-1 (padrão: 0.7)' }
      },
      required: ['prompt']
    }
  },
  {
    name: 'bedrock_listar_modelos',
    description: 'Lista todos os modelos disponíveis no AWS Bedrock',
    input_schema: {
      type: 'object',
      properties: {}
    }
  },
  {
    name: 'bedrock_gerar_texto_juridico',
    description: 'Gera texto jurídico usando Bedrock (petição, HC, contestação, etc)',
    input_schema: {
      type: 'object',
      properties: {
        tipo: { type: 'string', description: 'Tipo de peça: peticao_inicial, habeas_corpus, contestacao, apelacao, etc' },
        contexto: { type: 'string', description: 'Fatos e contexto do caso' },
        modelo: { type: 'string', description: 'Modelo a usar (padrão: nova-pro)' }
      },
      required: ['tipo', 'contexto']
    }
  },
  {
    name: 'bedrock_analisar_processo',
    description: 'Analisa documentos de processo judicial e gera resumo estruturado',
    input_schema: {
      type: 'object',
      properties: {
        documentos: { type: 'string', description: 'Conteúdo dos documentos do processo' },
        modelo: { type: 'string', description: 'Modelo a usar (padrão: nova-pro)' }
      },
      required: ['documentos']
    }
  },
  {
    name: 'bedrock_pesquisar_jurisprudencia',
    description: 'Pesquisa jurisprudência sobre um tema usando Bedrock',
    input_schema: {
      type: 'object',
      properties: {
        tema: { type: 'string', description: 'Tema jurídico para pesquisar precedentes' },
        modelo: { type: 'string', description: 'Modelo a usar (padrão: nova-pro)' }
      },
      required: ['tema']
    }
  },
  {
    name: 'bedrock_analisar_raciocinio',
    description: 'Análise jurídica profunda com DeepSeek R1 (modelo de raciocínio). Ideal para teses complexas, análise de precedentes e fundamentação detalhada.',
    input_schema: {
      type: 'object',
      properties: {
        questao: { type: 'string', description: 'Questão jurídica para análise profunda' },
        maxTokens: { type: 'number', description: 'Máximo de tokens (padrão: 2000)' }
      },
      required: ['questao']
    }
  },

  // ========================================================================
  // FERRAMENTAS BEDROCK AVANÇADO - Embeddings, Imagens, Áudio, Vídeo
  // ========================================================================

  // EMBEDDINGS - Busca Semântica
  {
    name: 'bedrock_gerar_embeddings',
    description: 'Gera vetores de embedding para busca semântica em documentos jurídicos',
    input_schema: {
      type: 'object',
      properties: {
        textos: { type: 'array', items: { type: 'string' }, description: 'Lista de textos para gerar embeddings' },
        modelo: { type: 'string', description: 'Modelo: cohere.embed-multilingual-v3 (padrão), amazon.titan-embed-text-v2:0' }
      },
      required: ['textos']
    }
  },
  {
    name: 'bedrock_busca_semantica',
    description: 'Busca semântica em documentos - encontra textos similares usando IA',
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Termo ou frase para buscar' },
        documentos: { type: 'array', items: { type: 'string' }, description: 'Lista de documentos para buscar' },
        topK: { type: 'number', description: 'Número de resultados (padrão: 5)' }
      },
      required: ['query', 'documentos']
    }
  },
  {
    name: 'bedrock_buscar_jurisprudencia_similar',
    description: 'Busca jurisprudência similar ao caso usando embeddings',
    input_schema: {
      type: 'object',
      properties: {
        casoAtual: { type: 'string', description: 'Descrição do caso atual' },
        jurisprudencias: { type: 'array', items: { type: 'string' }, description: 'Lista de jurisprudências para comparar' },
        topK: { type: 'number', description: 'Número de precedentes (padrão: 5)' }
      },
      required: ['casoAtual', 'jurisprudencias']
    }
  },

  // RERANKING
  {
    name: 'bedrock_reordenar_resultados',
    description: 'Reordena resultados de busca por relevância usando Cohere Rerank',
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Consulta original' },
        documentos: { type: 'array', items: { type: 'string' }, description: 'Documentos para reordenar' },
        topK: { type: 'number', description: 'Número de resultados (padrão: 10)' }
      },
      required: ['query', 'documentos']
    }
  },

  // MULTIMODAL - Análise de Imagens
  {
    name: 'bedrock_analisar_imagem',
    description: 'Analisa imagem com IA (Claude/Nova) - útil para documentos escaneados',
    input_schema: {
      type: 'object',
      properties: {
        imagemPath: { type: 'string', description: 'Caminho da imagem ou URL' },
        prompt: { type: 'string', description: 'O que analisar na imagem' },
        modelo: { type: 'string', description: 'Modelo (padrão: amazon.nova-pro-v1:0)' }
      },
      required: ['imagemPath', 'prompt']
    }
  },
  {
    name: 'bedrock_analisar_documento_escaneado',
    description: 'Analisa documento jurídico escaneado extraindo informações estruturadas',
    input_schema: {
      type: 'object',
      properties: {
        imagemPath: { type: 'string', description: 'Caminho da imagem do documento' }
      },
      required: ['imagemPath']
    }
  },
  {
    name: 'bedrock_analisar_contrato_escaneado',
    description: 'Analisa contrato escaneado extraindo cláusulas, partes, valores, etc.',
    input_schema: {
      type: 'object',
      properties: {
        imagemPath: { type: 'string', description: 'Caminho da imagem do contrato' }
      },
      required: ['imagemPath']
    }
  },
  {
    name: 'bedrock_extrair_texto_imagem',
    description: 'OCR avançado - extrai texto de imagem mantendo formatação',
    input_schema: {
      type: 'object',
      properties: {
        imagemPath: { type: 'string', description: 'Caminho da imagem' }
      },
      required: ['imagemPath']
    }
  },

  // PROCESSAMENTO DE IMAGEM
  {
    name: 'bedrock_melhorar_imagem',
    description: 'Melhora qualidade de imagem (upscale) - útil para documentos de baixa resolução',
    input_schema: {
      type: 'object',
      properties: {
        imagemPath: { type: 'string', description: 'Caminho da imagem' },
        outputPath: { type: 'string', description: 'Caminho para salvar (opcional)' }
      },
      required: ['imagemPath']
    }
  },
  {
    name: 'bedrock_remover_fundo',
    description: 'Remove fundo de imagem - útil para extrair assinaturas',
    input_schema: {
      type: 'object',
      properties: {
        imagemPath: { type: 'string', description: 'Caminho da imagem' },
        outputPath: { type: 'string', description: 'Caminho para salvar (opcional)' }
      },
      required: ['imagemPath']
    }
  },
  {
    name: 'bedrock_gerar_imagem',
    description: 'Gera imagem a partir de texto - útil para diagramas e fluxogramas',
    input_schema: {
      type: 'object',
      properties: {
        prompt: { type: 'string', description: 'Descrição da imagem a gerar' },
        outputPath: { type: 'string', description: 'Caminho para salvar (opcional)' }
      },
      required: ['prompt']
    }
  },

  // ÁUDIO
  {
    name: 'bedrock_transcrever_audio',
    description: 'Transcreve áudio para texto - útil para audiências e depoimentos',
    input_schema: {
      type: 'object',
      properties: {
        audioPath: { type: 'string', description: 'Caminho do arquivo de áudio (mp3, wav, m4a)' },
        idioma: { type: 'string', description: 'Idioma (padrão: pt-BR)' }
      },
      required: ['audioPath']
    }
  },
  {
    name: 'bedrock_transcrever_audiencia',
    description: 'Transcreve audiência com identificação de falantes',
    input_schema: {
      type: 'object',
      properties: {
        audioPath: { type: 'string', description: 'Caminho do arquivo de áudio' },
        idioma: { type: 'string', description: 'Idioma (padrão: pt-BR)' }
      },
      required: ['audioPath']
    }
  },

  // VÍDEO
  {
    name: 'bedrock_analisar_video',
    description: 'Analisa vídeo e extrai informações',
    input_schema: {
      type: 'object',
      properties: {
        videoPath: { type: 'string', description: 'Caminho do vídeo (mp4, mov)' },
        prompt: { type: 'string', description: 'O que analisar no vídeo' }
      },
      required: ['videoPath', 'prompt']
    }
  },
  {
    name: 'bedrock_analisar_video_prova',
    description: 'Analisa vídeo como prova/evidência judicial com descrição detalhada',
    input_schema: {
      type: 'object',
      properties: {
        videoPath: { type: 'string', description: 'Caminho do vídeo' }
      },
      required: ['videoPath']
    }
  },

  // COMPARAÇÃO
  {
    name: 'bedrock_comparar_documentos',
    description: 'Compara dois documentos escaneados para verificar alterações',
    input_schema: {
      type: 'object',
      properties: {
        imagem1Path: { type: 'string', description: 'Caminho da primeira imagem' },
        imagem2Path: { type: 'string', description: 'Caminho da segunda imagem' }
      },
      required: ['imagem1Path', 'imagem2Path']
    }
  },

  // ========================================================================
  // FERRAMENTAS DE JURISPRUDÊNCIA - Pesquisa integrada multi-fonte
  // ========================================================================

  // Pesquisa por fonte específica
  {
    name: 'juris_pesquisar_jusbrasil',
    description: 'Pesquisa jurisprudência no Jusbrasil via web scraping',
    input_schema: {
      type: 'object',
      properties: {
        termo: { type: 'string', description: 'Termo de busca' },
        tribunal: { type: 'string', description: 'Filtrar por tribunal (stf, stj, tjsp, etc)' },
        pagina: { type: 'number', description: 'Página de resultados (padrão: 1)' },
        limite: { type: 'number', description: 'Máximo de resultados (padrão: 10)' }
      },
      required: ['termo']
    }
  },
  {
    name: 'juris_pesquisar_stf',
    description: 'Pesquisa jurisprudência no STF (Supremo Tribunal Federal)',
    input_schema: {
      type: 'object',
      properties: {
        termo: { type: 'string', description: 'Termo de busca' },
        base: { type: 'string', description: 'Base: ACOR (acórdãos), SJUR (súmulas), PRES (presidência)' },
        pagina: { type: 'number', description: 'Página de resultados' },
        limite: { type: 'number', description: 'Máximo de resultados' }
      },
      required: ['termo']
    }
  },
  {
    name: 'juris_pesquisar_stj',
    description: 'Pesquisa jurisprudência no STJ (Superior Tribunal de Justiça)',
    input_schema: {
      type: 'object',
      properties: {
        termo: { type: 'string', description: 'Termo de busca' },
        tipo: { type: 'string', description: 'Tipo: ACOR (acórdãos), SUMU (súmulas)' },
        pagina: { type: 'number', description: 'Página de resultados' },
        limite: { type: 'number', description: 'Máximo de resultados' }
      },
      required: ['termo']
    }
  },
  {
    name: 'juris_pesquisar_datajud',
    description: 'Pesquisa processos no CNJ Datajud (requer CNJ_DATAJUD_API_KEY)',
    input_schema: {
      type: 'object',
      properties: {
        numeroProcesso: { type: 'string', description: 'Número CNJ do processo (NNNNNNN-DD.AAAA.J.TR.OOOO)' },
        tribunal: { type: 'string', description: 'Código do tribunal (opcional, inferido do número)' }
      },
      required: ['numeroProcesso']
    }
  },

  // Pesquisa via IA (mais confiável)
  {
    name: 'juris_pesquisar_ia',
    description: 'Pesquisa jurisprudência usando IA Bedrock - mais confiável que scraping, retorna precedentes formatados',
    input_schema: {
      type: 'object',
      properties: {
        termo: { type: 'string', description: 'Tema jurídico para buscar precedentes' },
        tribunal: { type: 'string', description: 'Filtrar por tribunal (STF, STJ, etc) - opcional' },
        modelo: { type: 'string', description: 'Modelo Bedrock (padrão: nova-pro)' }
      },
      required: ['termo']
    }
  },

  // Pesquisa unificada
  {
    name: 'juris_pesquisar_unificada',
    description: 'Pesquisa jurisprudência em múltiplas fontes simultaneamente (IA, STF, STJ)',
    input_schema: {
      type: 'object',
      properties: {
        termo: { type: 'string', description: 'Termo de busca' },
        fontes: { type: 'array', items: { type: 'string' }, description: 'Fontes: jusbrasil, stf, stj (padrão: todas)' },
        limite: { type: 'number', description: 'Máximo de resultados por fonte (padrão: 10)' }
      },
      required: ['termo']
    }
  },
  {
    name: 'juris_pesquisar_sumulas',
    description: 'Pesquisa súmulas do STF e STJ sobre um tema',
    input_schema: {
      type: 'object',
      properties: {
        tema: { type: 'string', description: 'Tema jurídico para buscar súmulas' },
        tribunais: { type: 'array', items: { type: 'string' }, description: 'Tribunais: stf, stj (padrão: ambos)' }
      },
      required: ['tema']
    }
  },

  // Análise com IA
  {
    name: 'juris_analisar_ia',
    description: 'Pesquisa e analisa jurisprudência com IA - identifica tese predominante, argumentos favoráveis/contrários',
    input_schema: {
      type: 'object',
      properties: {
        tese: { type: 'string', description: 'Tese ou argumento jurídico para analisar' },
        fontes: { type: 'array', items: { type: 'string' }, description: 'Fontes para pesquisar (padrão: stf, stj)' },
        limite: { type: 'number', description: 'Máximo de decisões por fonte' },
        modelo: { type: 'string', description: 'Modelo Bedrock para análise (padrão: nova-pro)' }
      },
      required: ['tese']
    }
  },
  {
    name: 'juris_buscar_precedentes',
    description: 'Busca e formata precedentes relevantes para fundamentação de peça jurídica',
    input_schema: {
      type: 'object',
      properties: {
        tema: { type: 'string', description: 'Tema jurídico' },
        tipoPeca: { type: 'string', description: 'Tipo da peça (habeas_corpus, apelacao, recurso_especial, etc)' },
        limite: { type: 'number', description: 'Máximo de precedentes' }
      },
      required: ['tema', 'tipoPeca']
    }
  },

  // Monitoramento
  {
    name: 'juris_monitorar_tese',
    description: 'Configura monitoramento de tese jurídica para alertas de novas decisões',
    input_schema: {
      type: 'object',
      properties: {
        tese: { type: 'string', description: 'Tese jurídica para monitorar' },
        tribunais: { type: 'array', items: { type: 'string' }, description: 'Tribunais para monitorar' }
      },
      required: ['tese']
    }
  },

  // Utilitários
  {
    name: 'juris_limpar_cache',
    description: 'Limpa cache de pesquisas de jurisprudência',
    input_schema: {
      type: 'object',
      properties: {}
    }
  },

  // ========================================================================
  // JUSBRASIL AUTENTICADO (Puppeteer)
  // ========================================================================

  {
    name: 'jusbrasil_login',
    description: 'Faz login no Jusbrasil com email e senha para acesso autenticado',
    input_schema: {
      type: 'object',
      properties: {
        email: { type: 'string', description: 'Email da conta Jusbrasil' },
        senha: { type: 'string', description: 'Senha da conta Jusbrasil' }
      },
      required: ['email', 'senha']
    }
  },
  {
    name: 'jusbrasil_configurar_credenciais',
    description: 'Configura credenciais do Jusbrasil em memória para uso posterior',
    input_schema: {
      type: 'object',
      properties: {
        email: { type: 'string', description: 'Email da conta Jusbrasil' },
        senha: { type: 'string', description: 'Senha da conta Jusbrasil' }
      },
      required: ['email', 'senha']
    }
  },
  {
    name: 'jusbrasil_verificar_login',
    description: 'Verifica status do login no Jusbrasil',
    input_schema: {
      type: 'object',
      properties: {}
    }
  },
  {
    name: 'jusbrasil_pesquisar_autenticado',
    description: 'Pesquisa jurisprudência no Jusbrasil com acesso autenticado (requer login)',
    input_schema: {
      type: 'object',
      properties: {
        termo: { type: 'string', description: 'Termo de busca' },
        tribunal: { type: 'string', description: 'Filtrar por tribunal (STF, STJ, TJSP, etc)' },
        pagina: { type: 'number', description: 'Página de resultados (padrão: 1)' },
        limite: { type: 'number', description: 'Máximo de resultados (padrão: 10)' }
      },
      required: ['termo']
    }
  },
  {
    name: 'jusbrasil_obter_inteiro_teor',
    description: 'Obtém o inteiro teor/conteúdo completo de uma decisão do Jusbrasil',
    input_schema: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'URL da decisão no Jusbrasil' }
      },
      required: ['url']
    }
  },
  {
    name: 'jusbrasil_pesquisar_pecas',
    description: 'Pesquisa peças processuais (petições, contratos, recursos) no Jusbrasil',
    input_schema: {
      type: 'object',
      properties: {
        termo: { type: 'string', description: 'Termo de busca' },
        tipo: { type: 'string', description: 'Tipo: peticao, contrato, recurso, etc' },
        limite: { type: 'number', description: 'Máximo de resultados' }
      },
      required: ['termo']
    }
  },
  {
    name: 'jusbrasil_jus_ia',
    description: 'Faz pergunta ao Jus IA do Jusbrasil (se disponível no plano)',
    input_schema: {
      type: 'object',
      properties: {
        pergunta: { type: 'string', description: 'Pergunta jurídica para o Jus IA' }
      },
      required: ['pergunta']
    }
  },
  {
    name: 'jusbrasil_fechar',
    description: 'Fecha o navegador do Jusbrasil e salva cookies',
    input_schema: {
      type: 'object',
      properties: {}
    }
  },

  // ========================================================================
  // FERRAMENTAS SDK - Clone do Claude AI Reference Implementation
  // ========================================================================

  // Ferramentas de Arquivo
  {
    name: 'file_read',
    description: 'Lê um arquivo do sistema de arquivos local. Suporta offset e limit para arquivos grandes.',
    input_schema: {
      type: 'object',
      properties: {
        file_path: { type: 'string', description: 'Caminho absoluto para o arquivo a ser lido' },
        offset: { type: 'number', description: 'Número da linha para começar a leitura (opcional)' },
        limit: { type: 'number', description: 'Número de linhas para ler (opcional, padrão: 2000)' }
      },
      required: ['file_path']
    }
  },
  {
    name: 'file_write',
    description: 'Escreve conteúdo em um arquivo. Cria o arquivo e diretórios se não existirem.',
    input_schema: {
      type: 'object',
      properties: {
        file_path: { type: 'string', description: 'Caminho absoluto para o arquivo a ser escrito' },
        content: { type: 'string', description: 'Conteúdo a ser escrito no arquivo' }
      },
      required: ['file_path', 'content']
    }
  },
  {
    name: 'file_edit',
    description: 'Realiza substituições exatas de strings em arquivos.',
    input_schema: {
      type: 'object',
      properties: {
        file_path: { type: 'string', description: 'Caminho absoluto para o arquivo a ser modificado' },
        old_string: { type: 'string', description: 'Texto a ser substituído' },
        new_string: { type: 'string', description: 'Texto substituto' },
        replace_all: { type: 'boolean', description: 'Se true, substitui todas as ocorrências (padrão: false)' }
      },
      required: ['file_path', 'old_string', 'new_string']
    }
  },
  {
    name: 'list_directory',
    description: 'Lista conteúdo de um diretório com informações de tamanho e data.',
    input_schema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Caminho do diretório a listar' },
        recursive: { type: 'boolean', description: 'Listar recursivamente (padrão: false)' }
      },
      required: ['path']
    }
  },
  {
    name: 'copy_file',
    description: 'Copia um arquivo de origem para destino.',
    input_schema: {
      type: 'object',
      properties: {
        source: { type: 'string', description: 'Caminho do arquivo de origem' },
        destination: { type: 'string', description: 'Caminho de destino' }
      },
      required: ['source', 'destination']
    }
  },
  {
    name: 'move_file',
    description: 'Move ou renomeia um arquivo.',
    input_schema: {
      type: 'object',
      properties: {
        source: { type: 'string', description: 'Caminho atual do arquivo' },
        destination: { type: 'string', description: 'Novo caminho do arquivo' }
      },
      required: ['source', 'destination']
    }
  },
  {
    name: 'delete_file',
    description: 'Remove um arquivo ou diretório.',
    input_schema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Caminho do arquivo/diretório a remover' },
        recursive: { type: 'boolean', description: 'Remover recursivamente (para diretórios)' }
      },
      required: ['path']
    }
  },

  // Ferramentas de Busca
  {
    name: 'glob',
    description: 'Busca arquivos usando padrões glob como "**/*.js" ou "src/**/*.ts".',
    input_schema: {
      type: 'object',
      properties: {
        pattern: { type: 'string', description: 'Padrão glob para buscar arquivos' },
        path: { type: 'string', description: 'Diretório base para a busca (opcional)' }
      },
      required: ['pattern']
    }
  },
  {
    name: 'grep',
    description: 'Busca padrões em arquivos usando expressões regulares (similar ao ripgrep).',
    input_schema: {
      type: 'object',
      properties: {
        pattern: { type: 'string', description: 'Expressão regular para buscar' },
        path: { type: 'string', description: 'Arquivo ou diretório para buscar' },
        glob: { type: 'string', description: 'Filtro glob para arquivos (ex: "*.js")' },
        output_mode: { type: 'string', enum: ['content', 'files_with_matches', 'count'], description: 'Modo de saída' },
        case_insensitive: { type: 'boolean', description: 'Busca case-insensitive' },
        context_lines: { type: 'number', description: 'Linhas de contexto antes e depois' }
      },
      required: ['pattern']
    }
  },

  // Ferramentas de Sistema
  {
    name: 'bash',
    description: 'Executa comandos bash no terminal. Suporta timeout configurável.',
    input_schema: {
      type: 'object',
      properties: {
        command: { type: 'string', description: 'Comando a ser executado' },
        timeout: { type: 'number', description: 'Timeout em milissegundos (máx: 600000, padrão: 120000)' },
        description: { type: 'string', description: 'Descrição curta do comando' },
        working_directory: { type: 'string', description: 'Diretório de trabalho para execução' }
      },
      required: ['command']
    }
  },

  // Ferramentas Web
  {
    name: 'web_fetch',
    description: 'Busca conteúdo de uma URL e converte HTML para markdown.',
    input_schema: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'URL para buscar conteúdo' },
        prompt: { type: 'string', description: 'Prompt para processar o conteúdo' }
      },
      required: ['url', 'prompt']
    }
  },
  {
    name: 'web_search',
    description: 'Realiza busca na web e retorna resultados com filtro por domínios.',
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Query de busca' },
        allowed_domains: { type: 'array', items: { type: 'string' }, description: 'Apenas incluir resultados destes domínios' },
        blocked_domains: { type: 'array', items: { type: 'string' }, description: 'Excluir resultados destes domínios' }
      },
      required: ['query']
    }
  },

  // Ferramentas de Organização
  {
    name: 'todo_write',
    description: 'Gerencia lista de tarefas para planejamento e rastreamento de progresso.',
    input_schema: {
      type: 'object',
      properties: {
        todos: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              content: { type: 'string', description: 'Descrição da tarefa' },
              status: { type: 'string', enum: ['pending', 'in_progress', 'completed'], description: 'Estado da tarefa' },
              activeForm: { type: 'string', description: 'Forma ativa da tarefa' }
            },
            required: ['content', 'status', 'activeForm']
          },
          description: 'Lista de tarefas atualizada'
        }
      },
      required: ['todos']
    }
  },
  {
    name: 'ask_user',
    description: 'Faz perguntas ao usuário para coletar preferências ou clarificar instruções.',
    input_schema: {
      type: 'object',
      properties: {
        questions: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              question: { type: 'string', description: 'A pergunta a fazer' },
              header: { type: 'string', description: 'Rótulo curto (máx 12 chars)' },
              options: { type: 'array', items: { type: 'object' }, description: 'Opções de resposta' },
              multiSelect: { type: 'boolean', description: 'Permitir múltiplas seleções' }
            },
            required: ['question', 'header', 'options']
          },
          description: 'Perguntas a fazer (1-4)'
        }
      },
      required: ['questions']
    }
  }
];

// Processador de ferramentas
async function processarFerramenta(nome, input) {
  switch (nome) {
    // Legislação
    case 'buscar_legislacao':
      return await legislacao.buscarLegislacao(input.termo, input.categoria);
    case 'obter_artigo':
      return await legislacao.obterArtigo(input.codigo, input.artigo);
    case 'buscar_sumulas':
      return await legislacao.buscarSumulas(input.tribunal, input.termo);

    // Tribunais
    case 'buscar_jurisprudencia':
      return await tribunais.buscarJurisprudencia(input.tribunal, input.termo);
    case 'consultar_processo':
      return await tribunais.consultarProcesso(input.numero_processo, input.tribunal);
    case 'listar_tribunais':
      return tribunais.listarTribunais();

    // Web Search
    case 'buscar_jusbrasil':
      return await webSearch.buscarJusBrasil(input.termo, input.tipo);
    case 'buscar_artigos_cientificos':
      return await webSearch.buscarArtigosCientificos(input.termo, input.area);
    case 'buscar_noticias_juridicas':
      return await webSearch.buscarNoticiasJuridicas(input.termo);

    // Português
    case 'verificar_gramatica':
      return await portugues.verificarGramatica(input.texto);
    case 'sugerir_sinonimos':
      return portugues.sugerirSinonimos(input.termo);
    case 'consultar_dicionario_juridico':
      return portugues.consultarDicionario(input.termo);
    case 'analisar_estilo':
      return portugues.analisarEstilo(input.texto);

    // Documentos
    case 'gerar_estrutura_peca':
      return documentos.gerarEstruturaPeca(input.tipo_peca);
    case 'criar_tabela':
      return { tipo: 'tabela', dados: input.dados, instrucao: 'Tabela gerada para inclusão no documento' };
    case 'criar_linha_do_tempo':
      return { tipo: 'linha_do_tempo', eventos: input.eventos, instrucao: 'Linha do tempo gerada' };
    case 'criar_fluxograma':
      return documentos.criarFluxograma(input.etapas);
    case 'listar_estruturas_pecas':
      return documentos.listarEstruturasPecas();

    // Extração
    case 'extrair_processo_pdf':
      return await extracao.pipelineCompleto(input.caminho_arquivo);
    case 'listar_ferramentas_extracao':
      return {
        ferramentas: extracao.FERRAMENTAS_PROCESSAMENTO,
        processadores: extracao.PROCESSADORES_OTIMIZACAO
      };

    // ========================================================================
    // AWS BEDROCK
    // ========================================================================
    case 'bedrock_conversar':
      return await bedrock.conversar(input.prompt, {
        modelo: input.modelo,
        systemPrompt: input.systemPrompt,
        maxTokens: input.maxTokens,
        temperature: input.temperature
      });
    case 'bedrock_listar_modelos':
      return await bedrock.listarModelos();
    case 'bedrock_gerar_texto_juridico':
      return await bedrock.gerarTextoJuridico(input.tipo, input.contexto, {
        modelo: input.modelo
      });
    case 'bedrock_analisar_processo':
      return await bedrock.analisarProcesso(input.documentos, {
        modelo: input.modelo
      });
    case 'bedrock_pesquisar_jurisprudencia':
      return await bedrock.pesquisarJurisprudencia(input.tema, {
        modelo: input.modelo
      });
    case 'bedrock_analisar_raciocinio':
      return await bedrock.analisarComRaciocinio(input.questao, {
        maxTokens: input.maxTokens
      });

    // ========================================================================
    // BEDROCK AVANÇADO - Embeddings, Imagens, Áudio, Vídeo
    // ========================================================================

    // Embeddings
    case 'bedrock_gerar_embeddings':
      return await bedrockAvancado.gerarEmbeddings(input.textos, {
        modelo: input.modelo
      });
    case 'bedrock_busca_semantica':
      return await bedrockAvancado.buscaSemantica(input.query, input.documentos, {
        topK: input.topK
      });
    case 'bedrock_buscar_jurisprudencia_similar':
      return await bedrockAvancado.buscarJurisprudenciaSimilar(input.casoAtual, input.jurisprudencias, {
        topK: input.topK
      });

    // Reranking
    case 'bedrock_reordenar_resultados':
      return await bedrockAvancado.reordenarResultados(input.query, input.documentos, {
        topK: input.topK
      });

    // Multimodal - Imagens
    case 'bedrock_analisar_imagem':
      return await bedrockAvancado.analisarImagem(input.imagemPath, input.prompt, {
        modelo: input.modelo
      });
    case 'bedrock_analisar_documento_escaneado':
      return await bedrockAvancado.analisarDocumentoEscaneado(input.imagemPath);
    case 'bedrock_analisar_contrato_escaneado':
      return await bedrockAvancado.analisarContratoEscaneado(input.imagemPath);
    case 'bedrock_extrair_texto_imagem':
      return await bedrockAvancado.extrairTextoImagem(input.imagemPath);

    // Processamento de Imagem
    case 'bedrock_melhorar_imagem':
      return await bedrockAvancado.melhorarImagem(input.imagemPath, {
        outputPath: input.outputPath
      });
    case 'bedrock_remover_fundo':
      return await bedrockAvancado.removerFundo(input.imagemPath, input.outputPath);
    case 'bedrock_gerar_imagem':
      return await bedrockAvancado.gerarImagem(input.prompt, {
        outputPath: input.outputPath
      });

    // Áudio
    case 'bedrock_transcrever_audio':
      return await bedrockAvancado.transcreverAudio(input.audioPath, {
        idioma: input.idioma
      });
    case 'bedrock_transcrever_audiencia':
      return await bedrockAvancado.transcreverAudiencia(input.audioPath, {
        idioma: input.idioma
      });

    // Vídeo
    case 'bedrock_analisar_video':
      return await bedrockAvancado.analisarVideo(input.videoPath, input.prompt);
    case 'bedrock_analisar_video_prova':
      return await bedrockAvancado.analisarVideoProva(input.videoPath);

    // Comparação
    case 'bedrock_comparar_documentos':
      return await bedrockAvancado.compararDocumentos(input.imagem1Path, input.imagem2Path);

    // ========================================================================
    // JURISPRUDÊNCIA
    // ========================================================================

    // Pesquisa por fonte
    case 'juris_pesquisar_jusbrasil':
      return await jurisprudencia.pesquisarJusbrasil(input.termo, {
        tribunal: input.tribunal,
        pagina: input.pagina,
        limite: input.limite
      });
    case 'juris_pesquisar_stf':
      return await jurisprudencia.pesquisarSTF(input.termo, {
        base: input.base,
        pagina: input.pagina,
        limite: input.limite
      });
    case 'juris_pesquisar_stj':
      return await jurisprudencia.pesquisarSTJ(input.termo, {
        tipo: input.tipo,
        pagina: input.pagina,
        limite: input.limite
      });
    case 'juris_pesquisar_datajud':
      return await jurisprudencia.pesquisarDatajud(input.numeroProcesso, {
        tribunal: input.tribunal
      });

    // Pesquisa via IA
    case 'juris_pesquisar_ia':
      return await jurisprudencia.pesquisarViaIA(input.termo, {
        tribunal: input.tribunal,
        modelo: input.modelo
      });

    // Pesquisa unificada
    case 'juris_pesquisar_unificada':
      return await jurisprudencia.pesquisarJurisprudencia(input.termo, {
        fontes: input.fontes,
        limite: input.limite
      });
    case 'juris_pesquisar_sumulas':
      return await jurisprudencia.pesquisarSumulas(input.tema, {
        tribunais: input.tribunais
      });

    // Análise com IA
    case 'juris_analisar_ia':
      return await jurisprudencia.analisarJurisprudenciaIA(input.tese, {
        fontes: input.fontes,
        limite: input.limite,
        modelo: input.modelo
      });
    case 'juris_buscar_precedentes':
      return await jurisprudencia.buscarPrecedentes(input.tema, input.tipoPeca, {
        limite: input.limite
      });

    // Monitoramento
    case 'juris_monitorar_tese':
      return await jurisprudencia.monitorarTese(input.tese, {
        tribunais: input.tribunais
      });

    // Utilitários
    case 'juris_limpar_cache':
      jurisprudencia.limparCache();
      return { sucesso: true, mensagem: 'Cache de jurisprudência limpo' };

    // ========================================================================
    // JUSBRASIL AUTENTICADO (Puppeteer)
    // ========================================================================

    case 'jusbrasil_login':
      return await jusbrasilAuth.login(input.email, input.senha);
    case 'jusbrasil_configurar_credenciais':
      return jusbrasilAuth.configurarCredenciais(input.email, input.senha);
    case 'jusbrasil_verificar_login':
      return await jusbrasilAuth.verificarLogin();
    case 'jusbrasil_pesquisar_autenticado':
      return await jusbrasilAuth.pesquisarJurisprudencia(input.termo, {
        tribunal: input.tribunal,
        pagina: input.pagina,
        limite: input.limite
      });
    case 'jusbrasil_obter_inteiro_teor':
      return await jusbrasilAuth.obterInteiroTeor(input.url);
    case 'jusbrasil_pesquisar_pecas':
      return await jusbrasilAuth.pesquisarPecas(input.termo, input.tipo, {
        limite: input.limite
      });
    case 'jusbrasil_jus_ia':
      return await jusbrasilAuth.perguntarJusIA(input.pergunta);
    case 'jusbrasil_fechar':
      return await jusbrasilAuth.fecharNavegador();

    // Prompts e Peças
    case 'obter_prompt_peca':
      // Primeiro tenta no módulo completo, senão usa o básico
      const promptCompleto = promptsCompletos.obterPromptCompleto(input.tipo_peca);
      if (promptCompleto) return promptCompleto;
      return prompts.obterPromptCompleto(input.tipo_peca);
    case 'listar_todas_pecas':
      return prompts.listarTodasPecas();
    case 'obter_prompt_completo':
      return promptsCompletos.obterPromptCompleto(input.tipo);
    case 'gerar_instrucao_completa':
      return promptsCompletos.gerarInstrucaoCompleta(input.tipo);
    case 'obter_master_rom':
      return promptsCompletos.MASTER_ROM;
    case 'listar_prompts_completos':
      return promptsCompletos.listarPromptsDisponiveis();

    // Resumo Executivo
    case 'gerar_resumo_executivo':
      return {
        estrutura: resumoExecutivo.ESTRUTURA_RESUMO[`camada${input.camada}`],
        prompt: resumoExecutivo.PROMPT_RESUMO_EXECUTIVO,
        instrucao: `Use o prompt de resumo executivo para gerar análise Camada ${input.camada}`
      };
    case 'obter_template_leading_case':
      return resumoExecutivo.TEMPLATE_LEADING_CASE;
    case 'obter_template_prequestionamento':
      return resumoExecutivo.TEMPLATE_PREQUESTIONAMENTO;
    case 'obter_template_prazos':
      return resumoExecutivo.TEMPLATE_PRAZOS;
    case 'listar_bases_precedentes':
      return resumoExecutivo.BASES_PRECEDENTES;

    // ========================================================================
    // FERRAMENTAS SDK
    // ========================================================================

    // Ferramentas de Arquivo
    case 'file_read':
      return await sdkTools.executeTool('file_read', input);
    case 'file_write':
      return await sdkTools.executeTool('file_write', input);
    case 'file_edit':
      return await sdkTools.executeTool('file_edit', input);
    case 'list_directory':
      return await sdkTools.executeTool('list_directory', input);
    case 'copy_file':
      return await sdkTools.executeTool('copy_file', input);
    case 'move_file':
      return await sdkTools.executeTool('move_file', input);
    case 'delete_file':
      return await sdkTools.executeTool('delete_file', input);

    // Ferramentas de Busca
    case 'glob':
      return await sdkTools.executeTool('glob', input);
    case 'grep':
      return await sdkTools.executeTool('grep', input);

    // Ferramentas de Sistema
    case 'bash':
      return await sdkTools.executeTool('bash', input);

    // Ferramentas Web
    case 'web_fetch':
      return await sdkTools.executeTool('web_fetch', input);
    case 'web_search':
      return await sdkTools.executeTool('web_search', input);

    // Ferramentas de Organização
    case 'todo_write':
      return await sdkTools.executeTool('todo_write', input);
    case 'ask_user':
      return await sdkTools.executeTool('ask_user', input);

    default:
      throw new Error(`Ferramenta não reconhecida: ${nome}`);
  }
}

// Carregar prompts do Knowledge Base
function carregarPrompts() {
  const prompts = {};
  const kbPath = CONFIG.kbPath;

  if (fs.existsSync(kbPath)) {
    const arquivos = fs.readdirSync(kbPath).filter(f => f.endsWith('.txt'));
    for (const arquivo of arquivos) {
      const conteudo = fs.readFileSync(path.join(kbPath, arquivo), 'utf-8');
      prompts[arquivo.replace('.txt', '')] = conteudo;
    }
  }

  return prompts;
}

// System prompt do ROM
function gerarSystemPrompt(promptsKB) {
  return `# ROM - Redator de Obras Magistrais v${CONFIG.versao}

Você é o ROM, um agente de IA especializado em redação de peças jurídicas com excelência.

## Suas Capacidades:
${CONFIG.capacidades.map(c => `- ${c}`).join('\n')}

## Instruções Gerais:
1. Sempre utilize português jurídico formal e escorreito
2. Cite legislação e jurisprudência de forma precisa
3. Mantenha estrutura lógica e coerência argumentativa
4. Utilize as ferramentas disponíveis para pesquisar antes de afirmar
5. Formate documentos com profissionalismo
6. Corrija erros gramaticais e de concordância
7. Sugira melhorias quando apropriado

## Knowledge Base Carregado:
${Object.keys(promptsKB).map(k => `- ${k}`).join('\n')}

## Ferramentas Disponíveis:

### Ferramentas Jurídicas:
- Legislação: buscar_legislacao, obter_artigo, buscar_sumulas
- Tribunais: buscar_jurisprudencia, consultar_processo, listar_tribunais
- Pesquisa: buscar_jusbrasil, buscar_artigos_cientificos, buscar_noticias_juridicas
- Português: verificar_gramatica, sugerir_sinonimos, consultar_dicionario_juridico, analisar_estilo
- Documentos: gerar_estrutura_peca, criar_tabela, criar_linha_do_tempo, criar_fluxograma
- Extração: extrair_processo_pdf, listar_ferramentas_extracao
- Prompts: obter_prompt_peca, listar_todas_pecas
- Resumo Executivo: gerar_resumo_executivo, obter_template_leading_case, obter_template_prequestionamento, obter_template_prazos, listar_bases_precedentes

### Ferramentas de Jurisprudência (Multi-fonte):
- Por fonte: juris_pesquisar_jusbrasil, juris_pesquisar_stf, juris_pesquisar_stj, juris_pesquisar_datajud
- Via IA: juris_pesquisar_ia (RECOMENDADO - mais confiável)
- Unificada: juris_pesquisar_unificada, juris_pesquisar_sumulas
- Análise IA: juris_analisar_ia, juris_buscar_precedentes
- Monitoramento: juris_monitorar_tese

### Jusbrasil Autenticado (Puppeteer):
- Login: jusbrasil_login, jusbrasil_configurar_credenciais, jusbrasil_verificar_login
- Pesquisa: jusbrasil_pesquisar_autenticado, jusbrasil_obter_inteiro_teor, jusbrasil_pesquisar_pecas
- Jus IA: jusbrasil_jus_ia
- Controle: jusbrasil_fechar

### Ferramentas SDK (Clone do Claude AI):
- Arquivos: file_read, file_write, file_edit, list_directory, copy_file, move_file, delete_file
- Busca: glob, grep
- Sistema: bash
- Web: web_fetch, web_search
- Organização: todo_write, ask_user

## Comportamento Esperado:
1. Utilize sempre as ferramentas para fundamentar suas respostas com dados precisos
2. Use todo_write para planejamento de tarefas complexas
3. Use file_read para ler arquivos antes de editar
4. Use grep e glob para encontrar arquivos relevantes
5. Use bash para executar comandos quando necessário
6. Use web_fetch e web_search para pesquisas atualizadas`;
}

// Classe principal do Agente ROM
export class ROMAgent {
  constructor(apiKey) {
    this.client = new Anthropic({ apiKey });
    this.prompts = carregarPrompts();
    this.systemPrompt = gerarSystemPrompt(this.prompts);
    this.conversationHistory = [];
  }

  async processar(mensagem) {
    this.conversationHistory.push({
      role: 'user',
      content: mensagem
    });

    let response = await this.client.messages.create({
      model: CONFIG.modelo,
      max_tokens: CONFIG.maxTokens,
      system: this.systemPrompt,
      tools: TOOLS,
      messages: this.conversationHistory
    });

    // Loop de tool use
    while (response.stop_reason === 'tool_use') {
      const toolUseBlocks = response.content.filter(block => block.type === 'tool_use');
      const toolResults = [];

      for (const toolUse of toolUseBlocks) {
        try {
          const resultado = await processarFerramenta(toolUse.name, toolUse.input);
          toolResults.push({
            type: 'tool_result',
            tool_use_id: toolUse.id,
            content: JSON.stringify(resultado, null, 2)
          });
        } catch (error) {
          toolResults.push({
            type: 'tool_result',
            tool_use_id: toolUse.id,
            content: `Erro: ${error.message}`,
            is_error: true
          });
        }
      }

      this.conversationHistory.push({
        role: 'assistant',
        content: response.content
      });

      this.conversationHistory.push({
        role: 'user',
        content: toolResults
      });

      response = await this.client.messages.create({
        model: CONFIG.modelo,
        max_tokens: CONFIG.maxTokens,
        system: this.systemPrompt,
        tools: TOOLS,
        messages: this.conversationHistory
      });
    }

    // Extrair texto da resposta final
    const textoResposta = response.content
      .filter(block => block.type === 'text')
      .map(block => block.text)
      .join('\n');

    this.conversationHistory.push({
      role: 'assistant',
      content: response.content
    });

    return textoResposta;
  }

  limparHistorico() {
    this.conversationHistory = [];
  }

  obterPrompt(nome) {
    return this.prompts[nome] || null;
  }

  listarPrompts() {
    return Object.keys(this.prompts);
  }
}

// Função principal
async function main() {
  console.log(`
╔══════════════════════════════════════════════════════════════╗
║                                                              ║
║   ██████╗  ██████╗ ███╗   ███╗                              ║
║   ██╔══██╗██╔═══██╗████╗ ████║                              ║
║   ██████╔╝██║   ██║██╔████╔██║                              ║
║   ██╔══██╗██║   ██║██║╚██╔╝██║                              ║
║   ██║  ██║╚██████╔╝██║ ╚═╝ ██║                              ║
║   ╚═╝  ╚═╝ ╚═════╝ ╚═╝     ╚═╝                              ║
║                                                              ║
║   Redator de Obras Magistrais v${CONFIG.versao}                       ║
║   Agente de IA para Redação de Peças Jurídicas              ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝
`);

  console.log('Capacidades:');
  CONFIG.capacidades.forEach(c => console.log(`  ✓ ${c}`));
  console.log('\nPara usar o ROM, configure ANTHROPIC_API_KEY e importe a classe ROMAgent.\n');
}

// Exportações
export {
  CONFIG,
  TOOLS,
  processarFerramenta,
  carregarPrompts,
  gerarSystemPrompt,
  sdkTools,
  // Módulos avançados
  analiseAvancada,
  templates,
  ocrAvancado,
  SubagentManager,
  SUBAGENTES,
  // Prompts completos com riqueza total
  promptsCompletos,
  // AWS Bedrock
  bedrock,
  bedrockAvancado,
  // Jurisprudência - Pesquisa integrada
  jurisprudencia,
  // Jusbrasil Autenticado
  jusbrasilAuth
};

export default ROMAgent;

// Executar se chamado diretamente
main();
