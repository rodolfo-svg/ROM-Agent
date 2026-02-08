/**
 * ROM Agent - Bedrock Tool Use Integration
 *
 * Integra AWS Bedrock Tool Use com funcionalidades do ROM Agent:
 * - Pesquisa automática de jurisprudência
 * - Consulta de legislação
 * - Extração de dados de documentos
 *
 * @version 1.0.0
 */

// ✅ ATUALIZADO: Usar serviço NOVO com Google Search + DataJud + JusBrasil
// Importa instância singleton (já instanciada)
import jurisprudenceService from '../services/jurisprudence-search-service.js';
import doctrineSearchService from '../services/doctrine-search-service.js';
import { pesquisarSumulas } from './jurisprudencia.js';
import { ACTIVE_PATHS } from '../../lib/storage-config.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ============================================================
// DEDUPLICAÇÃO DE RESULTADOS
// ============================================================

/**
 * Deduplica resultados de jurisprudência por hash
 * Evita duplicação entre Google Search, DataJud, JusBrasil
 */
function deduplicateResults(results) {
  if (!results || !Array.isArray(results)) return [];

  const seen = new Set();

  return results.filter(result => {
    // Hash baseado em: número do processo + tribunal + tipo
    const numero = (result.numero || '').toLowerCase().trim();
    const tribunal = (result.tribunal || '').toLowerCase().trim();
    const tipo = (result.tipo || '').toLowerCase().trim();
    const hashKey = `${numero}_${tribunal}_${tipo}`;

    if (seen.has(hashKey)) {
      console.log(`⚠️ [Dedup] Resultado duplicado removido: ${result.numero || result.titulo}`);
      return false;
    }

    seen.add(hashKey);
    return true;
  });
}

// ============================================================
// DEFINIÇÃO DAS TOOLS
// ============================================================

/**
 * Configuração das tools disponíveis para o Bedrock
 */
export const BEDROCK_TOOLS = [
  {
    toolSpec: {
      name: 'pesquisar_jurisprudencia',
      description: 'Pesquisa jurisprudência em TODOS os tribunais brasileiros: Superiores (STF, STJ, TST, TSE), Estaduais (TJGO, TJSP, TJRJ, etc), Federais (TRF1-6) e via CNJ DataJud. Busca também em JusBrasil, Conjur e Migalhas. Retorna precedentes com ementas completas e análise semântica. Use quando precisar de precedentes judiciais, súmulas, acórdãos ou decisões.',
      inputSchema: {
        json: {
          type: 'object',
          properties: {
            termo: {
              type: 'string',
              description: 'Termo de busca, palavras-chave ou assunto jurídico (ex: "prisão preventiva", "indenização moral", "LGPD", "Súmula 63")'
            },
            tribunal: {
              type: 'string',
              description: 'Tribunal específico (opcional). Superiores: STF, STJ, TST, TSE, STM. Federais: TRF1, TRF2, TRF3, TRF4, TRF5, TRF6. Estaduais: TJAC, TJAL, TJAM, TJAP, TJBA, TJCE, TJDF, TJES, TJGO, TJMA, TJMG, TJMS, TJMT, TJPA, TJPB, TJPE, TJPI, TJPR, TJRJ, TJRN, TJRO, TJRR, TJRS, TJSC, TJSE, TJSP, TJTO. Se não informado, busca em todos os tribunais .jus.br.',
              enum: [
                // Superiores
                'STF', 'STJ', 'TST', 'TSE', 'STM',
                // Federais
                'TRF1', 'TRF2', 'TRF3', 'TRF4', 'TRF5', 'TRF6',
                // Estaduais
                'TJAC', 'TJAL', 'TJAM', 'TJAP', 'TJBA', 'TJCE', 'TJDF', 'TJES',
                'TJGO', 'TJMA', 'TJMG', 'TJMS', 'TJMT', 'TJPA', 'TJPB', 'TJPE',
                'TJPI', 'TJPR', 'TJRJ', 'TJRN', 'TJRO', 'TJRR', 'TJRS', 'TJSC',
                'TJSE', 'TJSP', 'TJTO',
                null
              ]
            },
            limite: {
              type: 'number',
              description: 'Número máximo de resultados a retornar (padrão: 5)',
              default: 5
            },
            forcar_puppeteer: {
              type: 'boolean',
              description: 'MODO TESTE: Força uso do Puppeteer/Browserless.io mesmo se HTTP funcionar. Use apenas para testar conexão Browserless.',
              default: false
            }
          },
          required: ['termo']
        }
      }
    }
  },
  // ❌ JusBrasil DESABILITADO - 100% bloqueio anti-bot
  // Usar Google Custom Search que indexa JusBrasil sem bloqueios
  // {
  //   toolSpec: {
  //     name: 'pesquisar_jusbrasil',
  //     description: 'Pesquisa jurisprudência e doutrina no Jusbrasil, maior banco de dados jurídicos do Brasil. Use para encontrar acórdãos, artigos jurídicos, notícias e peças processuais. Fonte oficial e confiável.',
  //     inputSchema: {
  //       json: {
  //         type: 'object',
  //         properties: {
  //           termo: {
  //             type: 'string',
  //             description: 'Termo de busca jurídica (ex: "usucapião", "IPTU")'
  //           },
  //           limite: {
  //             type: 'number',
  //             description: 'Número máximo de resultados (padrão: 10)',
  //             default: 10
  //           }
  //         },
  //         required: ['termo']
  //       }
  //     }
  //   }
  // },
  {
    toolSpec: {
      name: 'consultar_cnj_datajud',
      description: 'Consulta processo judicial especifico na base do CNJ DataJud (Conselho Nacional de Justica). Use quando tiver um numero de processo e precisar de informacoes oficiais sobre ele. Requer DATAJUD_API_TOKEN configurado.',
      inputSchema: {
        json: {
          type: 'object',
          properties: {
            numeroProcesso: {
              type: 'string',
              description: 'Número do processo no formato CNJ (ex: "0000000-00.0000.0.00.0000")'
            }
          },
          required: ['numeroProcesso']
        }
      }
    }
  },
  {
    toolSpec: {
      name: 'pesquisar_sumulas',
      description: 'Pesquisa súmulas, temas, IRDR e teses jurisprudenciais em TODOS os tribunais brasileiros: Superiores (STF, STJ, TST, TSE) e Estaduais (TJGO, TJSP, etc). Use quando precisar de orientações jurisprudenciais consolidadas, súmulas vinculantes, temas de repercussão geral, teses fixadas ou súmulas de tribunais estaduais. Fontes oficiais via Google Search nos sites .jus.br.',
      inputSchema: {
        json: {
          type: 'object',
          properties: {
            tema: {
              type: 'string',
              description: 'Tema, número ou palavras-chave para buscar súmulas/teses (ex: "prescrição", "Súmula 63", "honorários advocatícios")'
            },
            tribunal: {
              type: 'string',
              description: 'Tribunal específico (opcional). Superiores: STF, STJ, TST, TSE, STM. Federais: TRF1-6. Estaduais: TJAC a TJTO (incluindo TJGO). Se não informado, busca em todos.',
              enum: [
                // Superiores
                'STF', 'STJ', 'TST', 'TSE', 'STM',
                // Federais
                'TRF1', 'TRF2', 'TRF3', 'TRF4', 'TRF5', 'TRF6',
                // Estaduais (principais)
                'TJAC', 'TJAL', 'TJAM', 'TJAP', 'TJBA', 'TJCE', 'TJDF', 'TJES',
                'TJGO', 'TJMA', 'TJMG', 'TJMS', 'TJMT', 'TJPA', 'TJPB', 'TJPE',
                'TJPI', 'TJPR', 'TJRJ', 'TJRN', 'TJRO', 'TJRR', 'TJRS', 'TJSC',
                'TJSE', 'TJSP', 'TJTO',
                null
              ]
            }
          },
          required: ['tema']
        }
      }
    }
  },
  {
    toolSpec: {
      name: 'consultar_kb',
      description: 'Consulta documentos já processados na Knowledge Base do usuário. Use quando o usuário mencionar "o documento que enviei", "o contrato", "a petição anterior" ou qualquer referência a arquivos enviados. Os documentos foram extraídos automaticamente (91 ferramentas, $0.00) e estão prontos para consulta.',
      inputSchema: {
        json: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'Termo de busca ou contexto do documento (ex: "contrato", "petição anterior", "procuração")'
            },
            limite: {
              type: 'number',
              description: 'Número máximo de documentos a retornar (padrão: 3)',
              default: 3
            }
          },
          required: ['query']
        }
      }
    }
  },
  {
    toolSpec: {
      name: 'pesquisar_doutrina',
      description: 'Busca artigos jurídicos, análises doutrinárias, teses e dissertações em fontes especializadas (Google Scholar, Conjur, Migalhas, JOTA). Use quando precisar de fundamentação doutrinária, artigos de especialistas, análises acadêmicas ou posicionamento de autores renomados sobre determinado tema jurídico.',
      inputSchema: {
        json: {
          type: 'object',
          properties: {
            termo: {
              type: 'string',
              description: 'Termo de busca ou tema jurídico (ex: "LGPD proteção dados", "responsabilidade civil médica")'
            },
            tipo: {
              type: 'string',
              description: 'Tipo de doutrina a buscar (opcional). Valores: "academico" (Google Scholar), "artigos" (Conjur/Migalhas), "analises" (JOTA), "todos" (padrão)',
              enum: ['academico', 'artigos', 'analises', 'todos'],
              default: 'todos'
            },
            limite: {
              type: 'number',
              description: 'Número máximo de resultados a retornar (padrão: 10)',
              default: 10
            }
          },
          required: ['termo']
        }
      }
    }
  },
  {
    toolSpec: {
      name: 'analisar_documento_kb',
      description: 'Analisa documentos da Knowledge Base gerando fichamentos técnicos profissionais (FICHAMENTO, ANALISE_JURIDICA, CRONOLOGIA, RESUMO_EXECUTIVO). IMPORTANTE: Use SEMPRE que usuário solicitar "analisar", "processar", "gerar fichamentos" ou "análise completa" de documento da KB, mesmo que informações já existam - a ferramenta gera versão atualizada.',
      inputSchema: {
        json: {
          type: 'object',
          properties: {
            document_name: {
              type: 'string',
              description: 'Nome do documento da KB para analisar (ex: "0000793-05.2018.4.01.3504.pdf")'
            },
            analysis_type: {
              type: 'string',
              description: 'Tipo de análise: "complete" (análise completa com ficheiros), "extract_only" (extração de texto), "custom" (análise personalizada)',
              enum: ['complete', 'extract_only', 'custom'],
              default: 'complete'
            },
            custom_prompt: {
              type: 'string',
              description: 'Instruções específicas para análise personalizada'
            },
            model: {
              type: 'string',
              description: 'Modelo de análise: "haiku" (rápido), "sonnet" (padrão), "opus" (máxima qualidade)',
              enum: ['haiku', 'sonnet', 'opus'],
              default: 'sonnet'
            },
            mode: {
              type: 'string',
              description: 'Modo de processamento (geralmente deixar em "auto")',
              enum: ['auto', 'multipass', 'summary'],
              default: 'auto'
            }
          },
          required: ['document_name']
        }
      }
    }
  },
  {
    toolSpec: {
      name: 'create_artifact',
      description: 'Cria um artifact (documento estruturado) que aparece em painel lateral para download. Use SEMPRE que o usuário pedir para "gerar documento", "exportar para Word", "criar peça", "fazer arquivo", etc. O artifact permite download em DOCX, PDF, HTML e Markdown.',
      inputSchema: {
        json: {
          type: 'object',
          properties: {
            title: {
              type: 'string',
              description: 'Título do documento (ex: "Petição Inicial", "Análise do Caso", "Resumo da Audiência")'
            },
            content: {
              type: 'string',
              description: 'Conteúdo COMPLETO do documento em formato Markdown. Inclua TODO o texto que deve aparecer no arquivo final.'
            },
            type: {
              type: 'string',
              description: 'Tipo do artifact',
              enum: ['document', 'code', 'table', 'chart'],
              default: 'document'
            },
            language: {
              type: 'string',
              description: 'Linguagem (para type=code)',
              default: 'markdown'
            }
          },
          required: ['title', 'content']
        }
      }
    }
  }
];

// ============================================================
// EXECUTOR DE TOOLS
// ============================================================

/**
 * Executa uma tool chamada pela IA
 * @param {string} toolName - Nome da tool
 * @param {object} toolInput - Parâmetros da tool
 * @returns {Promise<object>} Resultado da execução
 */
export async function executeTool(toolName, toolInput) {
  console.log(`🔧 [Tool Use] Executando: ${toolName}`, toolInput);

  try {
    switch (toolName) {
      case 'pesquisar_jurisprudencia': {
        const { termo, tribunal, limite = 5, forcar_puppeteer = false } = toolInput;

        // ✅ ATUALIZADO: Usar serviço novo (Google Search + DataJud + JusBrasil)
        const resultado = await jurisprudenceService.searchAll(termo, {
          limit: limite,
          tribunal: tribunal || null,
          enableCache: true,
          forcarPuppeteer: forcar_puppeteer  // Modo de teste Browserless
        });

        // ✅ DEDUPLICAÇÃO: Remover duplicatas de cada fonte
        if (resultado.sources?.datajud?.results) {
          resultado.sources.datajud.results = deduplicateResults(resultado.sources.datajud.results);
        }
        if (resultado.sources?.jusbrasil?.results) {
          resultado.sources.jusbrasil.results = deduplicateResults(resultado.sources.jusbrasil.results);
        }
        if (resultado.sources?.websearch?.results) {
          resultado.sources.websearch.results = deduplicateResults(resultado.sources.websearch.results);
        }

        // ✅ ATUALIZADO: Formatar resultado do serviço novo
        let respostaFormatada = `\n📊 **Pesquisa de Jurisprudência: "${termo}"**\n\n`;

        // ⚠️ INSTRUÇÃO CRÍTICA NO INÍCIO - LLM DEVE LER ANTES DE RESPONDER
        respostaFormatada += '═══════════════════════════════════════════════════════════════════════\n';
        respostaFormatada += '⚠️ ATENÇÃO: NÃO RESUMA! COPIE AS EMENTAS COMPLETAS FORNECIDAS ABAIXO!\n';
        respostaFormatada += '⚠️ PROIBIDO escrever "Com base nas buscas, encontrei..." sem mostrar ementas\n';
        respostaFormatada += '═══════════════════════════════════════════════════════════════════════\n\n';

        // Informações gerais
        respostaFormatada += `Total de resultados: ${resultado.totalResults || 0}\n`;
        respostaFormatada += `Fontes consultadas: ${Object.keys(resultado.sources || {}).length}\n`;
        if (tribunal) respostaFormatada += `Tribunal filtrado: ${tribunal}\n`;
        respostaFormatada += `\n---\n\n`;

        // Resultados do DataJud CNJ
        if (resultado.sources?.datajud?.success && resultado.sources.datajud.results?.length > 0) {
          respostaFormatada += `\n🏛️ **CNJ DataJud (${resultado.sources.datajud.count} resultados oficiais)**\n\n`;

          // ✅ CORREÇÃO: Mostrar TODOS os resultados, não apenas 3 (até limite de 10)
          resultado.sources.datajud.results.slice(0, Math.min(10, resultado.sources.datajud.results.length)).forEach((item, idx) => {
            respostaFormatada += `**[${idx + 1}] ${item.numero || item.titulo || 'Decisão'}**\n`;
            if (item.tribunal) respostaFormatada += `📍 Tribunal: ${item.tribunal}\n`;
            if (item.classe) respostaFormatada += `Classe: ${item.classe}\n`;

            // ✅ METADADOS (incluindo scraped metadata se disponível)
            if (item.numeroProcesso) respostaFormatada += `📋 Processo: ${item.numeroProcesso}\n`;
            if (item.relator) respostaFormatada += `👨‍⚖️ Relator: ${item.relator}\n`;
            if (item.orgaoJulgador) respostaFormatada += `🏛️ Órgão Julgador: ${item.orgaoJulgador}\n`;
            if (item.dataJulgamento) respostaFormatada += `📅 Data de Julgamento: ${item.dataJulgamento}\n`;
            if (item.dataPublicacao) respostaFormatada += `📰 Data de Publicação (DJE): ${item.dataPublicacao}\n`;
            if (item.data && !item.dataJulgamento) respostaFormatada += `Data: ${item.data}\n`;

            if (item.ementa) respostaFormatada += `Ementa: ${item.ementa.substring(0, 400)}...\n`;
            if (item.link) respostaFormatada += `Link: ${item.link}\n`;
            respostaFormatada += '\n';
          });

          if (resultado.sources.datajud.results.length > 10) {
            respostaFormatada += `... e mais ${resultado.sources.datajud.results.length - 10} resultados disponíveis\n`;
          }

          respostaFormatada += '---\n\n';
        }

        // Resultados do JusBrasil
        if (resultado.sources?.jusbrasil?.success && resultado.sources.jusbrasil.results?.length > 0) {
          respostaFormatada += `\n📚 **JusBrasil (${resultado.sources.jusbrasil.count} resultados)**\n\n`;

          // ✅ CORREÇÃO: Mostrar TODOS os resultados, não apenas 3 (até limite de 10)
          resultado.sources.jusbrasil.results.slice(0, Math.min(10, resultado.sources.jusbrasil.results.length)).forEach((item, idx) => {
            respostaFormatada += `**[${idx + 1}] ${item.titulo || 'Documento'}**\n`;
            if (item.tribunal) respostaFormatada += `📍 Tribunal: ${item.tribunal}\n`;

            // ✅ METADADOS (incluindo scraped metadata se disponível)
            if (item.numeroProcesso) respostaFormatada += `📋 Processo: ${item.numeroProcesso}\n`;
            if (item.relator) respostaFormatada += `👨‍⚖️ Relator: ${item.relator}\n`;
            if (item.orgaoJulgador) respostaFormatada += `🏛️ Órgão Julgador: ${item.orgaoJulgador}\n`;
            if (item.dataJulgamento) respostaFormatada += `📅 Data de Julgamento: ${item.dataJulgamento}\n`;
            if (item.dataPublicacao) respostaFormatada += `📰 Data de Publicação (DJE): ${item.dataPublicacao}\n`;
            if (item.data && !item.dataJulgamento) respostaFormatada += `Data: ${item.data}\n`;

            if (item.ementa) respostaFormatada += `Ementa: ${item.ementa.substring(0, 400)}...\n`;
            if (item.link) respostaFormatada += `Link: ${item.link}\n`;
            respostaFormatada += '\n';
          });

          if (resultado.sources.jusbrasil.results.length > 10) {
            respostaFormatada += `... e mais ${resultado.sources.jusbrasil.results.length - 10} resultados disponíveis\n`;
          }

          respostaFormatada += '---\n\n';
        }

        // Resultados da Web Search (Google) - COM ENRIQUECIMENTO
        if (resultado.sources?.websearch?.success && resultado.sources.websearch.results?.length > 0) {
          respostaFormatada += `\n🔍 **Web Search - Google (${resultado.sources.websearch.count} resultados)**\n\n`;

          // ✅ NOVO: Mostrar ementas completas + análise semântica quando disponível
          resultado.sources.websearch.results.slice(0, Math.min(10, resultado.sources.websearch.results.length)).forEach((item, idx) => {
            respostaFormatada += `**[${idx + 1}] ${item.titulo || item.title || 'Resultado'}**\n`;
            if (item.tribunal) respostaFormatada += `📍 Tribunal: ${item.tribunal}\n`;

            // ✅ METADADOS EXTRAÍDOS (processo, relator, câmara, datas)
            if (item.numeroProcesso) respostaFormatada += `📋 Processo: ${item.numeroProcesso}\n`;
            if (item.relator) respostaFormatada += `👨‍⚖️ Relator: ${item.relator}\n`;
            if (item.orgaoJulgador) respostaFormatada += `🏛️ Órgão Julgador: ${item.orgaoJulgador}\n`;
            if (item.dataJulgamento) respostaFormatada += `📅 Data de Julgamento: ${item.dataJulgamento}\n`;
            if (item.dataPublicacao) respostaFormatada += `📰 Data de Publicação (DJE): ${item.dataPublicacao}\n`;

            // ✅ DIFERENCIAL: Mostrar ementa COMPLETA se disponível (scraping)
            if (item.ementaCompleta && item.ementaCompleta.length > 500) {
              respostaFormatada += `\n📝 **Ementa Completa** (${item.ementaCompleta.length} caracteres):\n`;
              respostaFormatada += `${item.ementaCompleta.substring(0, 1500)}...\n`;
              if (item.scraped) {
                respostaFormatada += `✅ Scraped do tribunal oficial\n`;
              }
            } else if (item.snippet) {
              respostaFormatada += `${item.snippet.substring(0, 250)}...\n`;
            }

            // ✅ DIFERENCIAL: Mostrar análise semântica se disponível (Bedrock)
            if (item.analise) {
              respostaFormatada += `\n🧠 **Análise Semântica Automática**:\n`;

              if (item.analise.teseJuridica) {
                respostaFormatada += `\n💡 Tese Central:\n"${item.analise.teseJuridica}"\n`;
              }

              if (item.analise.resultado) {
                respostaFormatada += `\n⚖️ Resultado: ${item.analise.resultado}\n`;
              }

              if (item.analise.fundamentosLegais?.length > 0) {
                respostaFormatada += `\n📚 Fundamentos Legais:\n`;
                item.analise.fundamentosLegais.slice(0, 5).forEach(f => {
                  respostaFormatada += `  • ${f}\n`;
                });
                if (item.analise.fundamentosLegais.length > 5) {
                  respostaFormatada += `  ... e mais ${item.analise.fundamentosLegais.length - 5}\n`;
                }
              }

              if (item.analise.sumulas?.length > 0) {
                respostaFormatada += `\n⚖️ Súmulas Citadas:\n`;
                item.analise.sumulas.forEach(s => {
                  respostaFormatada += `  • ${s}\n`;
                });
              }

              if (item.analise.precedentes?.length > 0) {
                respostaFormatada += `\n📖 Precedentes:\n`;
                item.analise.precedentes.slice(0, 3).forEach(p => {
                  respostaFormatada += `  • ${p}\n`;
                });
              }

              if (item.analise.relevanciaParaCaso) {
                respostaFormatada += `\n🎯 Relevância para o caso: ${item.analise.relevanciaParaCaso}/100\n`;
              }

              if (item.analise.resumoExecutivo) {
                respostaFormatada += `\n📋 Resumo Executivo:\n${item.analise.resumoExecutivo.substring(0, 400)}...\n`;
              }
            }

            if (item.link) respostaFormatada += `\n🔗 Link: ${item.link}\n`;
            respostaFormatada += '\n---\n\n';
          });

          if (resultado.sources.websearch.results.length > 10) {
            respostaFormatada += `... e mais ${resultado.sources.websearch.results.length - 10} resultados disponíveis\n\n`;
          }
        }

        // ✅ Indicador de enrichment
        if (resultado.enriched) {
          respostaFormatada += '\n🎯 **DIFERENCIAL ROM AGENT**\n';
          respostaFormatada += '✅ Ementas completas extraídas via scraping\n';
          respostaFormatada += '✅ Análise semântica com IA (tese + fundamentos)\n';
          respostaFormatada += '✅ Relevância calculada automaticamente\n';
        } else if (resultado.enrichError) {
          respostaFormatada += `\n⚠️ Enriquecimento parcial: ${resultado.enrichError}\n`;
        }

        respostaFormatada += '\n✅ **Pesquisa concluída**\n';
        respostaFormatada += `Timestamp: ${resultado.searchedAt || new Date().toISOString()}\n`;

        // ✅ INSTRUÇÃO CRÍTICA PARA O LLM - VERSÃO REFORÇADA
        respostaFormatada += '\n\n';
        respostaFormatada += '═══════════════════════════════════════════════════════════════════════\n';
        respostaFormatada += '⚠️ ⚠️ ⚠️  INSTRUÇÃO OBRIGATÓRIA - LEIA COM ATENÇÃO  ⚠️ ⚠️ ⚠️\n';
        respostaFormatada += '═══════════════════════════════════════════════════════════════════════\n\n';

        respostaFormatada += 'Ao responder ao usuário sobre estes resultados, você é OBRIGADO a:\n\n';

        respostaFormatada += '✅ PERMITIDO (FAÇA ISSO):\n';
        respostaFormatada += '- Copiar LITERALMENTE as ementas completas fornecidas acima\n';
        respostaFormatada += '- Manter TODA a formatação markdown (📝, 🧠, 💡, etc)\n';
        respostaFormatada += '- Incluir TODOS os detalhes: tribunal, relator, número do processo\n';
        respostaFormatada += '- Mostrar a seção "📝 Ementa Completa (X caracteres)" INTEIRA\n';
        respostaFormatada += '- Incluir a seção "🧠 Análise Semântica Automática" COMPLETA\n\n';

        respostaFormatada += '❌ PROIBIDO (NÃO FAÇA ISSO):\n';
        respostaFormatada += '- Criar "resumos consolidados" genéricos\n';
        respostaFormatada += '- Parafrasear ou reformular as ementas\n';
        respostaFormatada += '- Reduzir ementas de 10.000 chars para 500 chars\n';
        respostaFormatada += '- Escrever "Com base nas buscas, encontrei..." sem mostrar as ementas\n';
        respostaFormatada += '- Substituir conteúdo por análises próprias\n\n';

        respostaFormatada += '🎯 DIFERENCIAL: O usuário quer ver EMENTAS COMPLETAS (não resumos).\n';
        respostaFormatada += 'Se uma ementa tem 15.000 caracteres acima, mostre pelo menos 1.500 chars dela.\n\n';

        respostaFormatada += '═══════════════════════════════════════════════════════════════════════\n';

        console.log(`✅ [Tool Use] pesquisar_jurisprudencia executada com sucesso`);

        return {
          success: true,
          content: respostaFormatada,
          metadata: {
            termo,
            tribunal,
            totalFontes: Object.keys(resultado.sources || {}).length,
            totalResultados: resultado.totalResults || 0
          }
        };
      }

      // ❌ DESABILITADO: JusBrasil com 100% bloqueio anti-bot
      // Google Custom Search agora indexa JusBrasil sem bloqueios
      // case 'pesquisar_jusbrasil': {
      //   const { termo, limite = 10 } = toolInput;
      //   console.log(`🔍 [Jusbrasil] Pesquisando: ${termo}`);
      //   const resultado = await jurisprudenceService.searchJusBrasil(termo, { limit: limite });
      //   if (!resultado.success && !resultado.results) {
      //     return {
      //       success: false,
      //       error: resultado.error || 'Erro desconhecido',
      //       content: `Erro ao buscar no Jusbrasil: ${resultado.error || 'Erro desconhecido'}`
      //     };
      //   }
      //   const totalResultados = resultado.results?.length || 0;
      //   let respostaFormatada = `\n📚 **Jusbrasil - "${termo}"** (${totalResultados} resultados)\n\n`;
      //   if (resultado.results && resultado.results.length > 0) {
      //     resultado.results.slice(0, 5).forEach((item, idx) => {
      //       respostaFormatada += `**[${idx + 1}] ${item.titulo || item.title || 'Documento'}**\n`;
      //       if (item.tribunal) respostaFormatada += `Tribunal: ${item.tribunal}\n`;
      //       if (item.data) respostaFormatada += `Data: ${item.data}\n`;
      //       if (item.ementa) respostaFormatada += `Ementa: ${item.ementa.substring(0, 300)}...\n`;
      //       if (item.link) respostaFormatada += `Link: ${item.link}\n`;
      //       respostaFormatada += '\n';
      //     });
      //   }
      //   console.log(`✅ [Jusbrasil] ${totalResultados} resultados encontrados`);
      //   return {
      //     success: true,
      //     content: respostaFormatada,
      //     metadata: {
      //       termo,
      //       fonte: 'Jusbrasil',
      //       totalResultados
      //     }
      //   };
      // }

      case 'consultar_cnj_datajud': {
        const { numeroProcesso } = toolInput;

        console.log(`🏛️ [CNJ DataJud] Consultando processo: ${numeroProcesso}`);

        // ✅ ATUALIZADO: Importar datajud-service diretamente (busca por número de processo)
        const datajudService = (await import('../services/datajud-service.js')).default;
        const resultado = await datajudService.buscarProcessos({ numero: numeroProcesso });

        if (!resultado.success && !resultado.processos) {
          return {
            success: false,
            error: resultado.error || 'Erro ao consultar processo',
            content: `Erro ao consultar CNJ DataJud: ${resultado.error || 'Processo não encontrado'}`
          };
        }

        // Formatar resultado
        let respostaFormatada = `\n🏛️ **CNJ DataJud - Processo ${numeroProcesso}**\n\n`;

        if (resultado.processos && resultado.processos.length > 0) {
          const proc = resultado.processos[0]; // Primeiro resultado
          respostaFormatada += `**Número**: ${proc.numero || numeroProcesso}\n`;
          if (proc.classe) respostaFormatada += `**Classe**: ${proc.classe}\n`;
          if (proc.assunto) respostaFormatada += `**Assunto**: ${proc.assunto}\n`;
          if (proc.orgaoJulgador) respostaFormatada += `**Órgão Julgador**: ${proc.orgaoJulgador}\n`;
          if (proc.dataDistribuicao) respostaFormatada += `**Data de Distribuição**: ${proc.dataDistribuicao}\n`;
          if (proc.tribunal) respostaFormatada += `**Tribunal**: ${proc.tribunal}\n`;

          if (proc.movimentos && proc.movimentos.length > 0) {
            respostaFormatada += `\n**Últimas Movimentações** (${proc.movimentos.length} total):\n`;
            proc.movimentos.slice(0, 5).forEach((mov, idx) => {
              respostaFormatada += `${idx + 1}. ${mov.data || ''} - ${mov.descricao || mov.nome || ''}\n`;
            });
            if (proc.movimentos.length > 5) {
              respostaFormatada += `... e mais ${proc.movimentos.length - 5} movimentações\n`;
            }
          }
        } else {
          respostaFormatada += 'Nenhum processo encontrado com este número.\n';
        }

        respostaFormatada += '\n✅ **Fonte**: CNJ DataJud (API Oficial)\n';

        console.log(`✅ [CNJ DataJud] Consulta realizada com sucesso`);

        return {
          success: true,
          content: respostaFormatada,
          metadata: {
            numeroProcesso,
            fonte: 'CNJ DataJud (Oficial)'
          }
        };
      }

      case 'pesquisar_sumulas': {
        const { tema, tribunal } = toolInput;

        console.log(`📋 [Súmulas] Pesquisando: ${tema}${tribunal ? ` (${tribunal})` : ''}`);

        const resultado = await pesquisarSumulas(tema, { tribunal });

        if (!resultado.sucesso) {
          return {
            success: false,
            error: resultado.erro,
            content: `Erro ao buscar súmulas: ${resultado.erro}`
          };
        }

        // Formatar resultado
        let respostaFormatada = `\n📋 **Súmulas sobre "${tema}"**${tribunal ? ` - ${tribunal}` : ''}\n\n`;

        if (resultado.sumulas && resultado.sumulas.length > 0) {
          resultado.sumulas.forEach((sumula, idx) => {
            respostaFormatada += `**Súmula ${sumula.numero || ''} - ${sumula.tribunal || ''}**\n`;
            if (sumula.vinculante) respostaFormatada += `⚠️ VINCULANTE\n`;
            respostaFormatada += `${sumula.texto || ''}\n\n`;
          });
        } else {
          respostaFormatada += 'Nenhuma súmula encontrada para este tema.\n';
        }

        respostaFormatada += '\n✅ **Fonte**: Tribunais Superiores (Oficial)\n';

        console.log(`✅ [Súmulas] ${resultado.sumulas?.length || 0} súmulas encontradas`);

        return {
          success: true,
          content: respostaFormatada,
          metadata: {
            tema,
            tribunal,
            totalSumulas: resultado.sumulas?.length || 0
          }
        };
      }

      case 'consultar_kb': {
        const { query, limite = 10 } = toolInput; // ⬆️ AUMENTADO DE 3 PARA 10

        console.log(`📚 [KB] Consultando documentos: "${query}"`);

        try {
          // ✅ CRÍTICO: Usar ACTIVE_PATHS para acessar disco persistente no Render
          // Antes usava process.cwd() que é efêmero e perdido a cada deploy
          const kbDocsPath = path.join(ACTIVE_PATHS.data, 'kb-documents.json');

          if (!fs.existsSync(kbDocsPath)) {
            return {
              success: false,
              content: 'Nenhum documento encontrado na Knowledge Base. Faça upload de documentos primeiro.'
            };
          }

          const data = fs.readFileSync(kbDocsPath, 'utf8');
          const allDocs = JSON.parse(data);

          if (allDocs.length === 0) {
            return {
              success: false,
              content: 'Knowledge Base vazia. Faça upload de documentos primeiro.'
            };
          }

          // Buscar documentos relevantes (busca por palavras individuais)
          // ✅ MELHORADO: Divide query em palavras e procura cada uma
          const queryLower = query.toLowerCase();
          const queryWords = queryLower
            .split(/\s+/)
            .filter(word => word.length > 3); // Ignora palavras muito curtas (de, da, os, etc)

          const relevantDocs = allDocs
            .filter(doc => {
              const docName = doc.name.toLowerCase();
              const docText = doc.extractedText?.toLowerCase() || '';
              const docType = doc.metadata?.documentType?.toLowerCase() || '';
              const combinedText = `${docName} ${docText} ${docType}`;

              // Se query tem palavras, procura por QUALQUER palavra
              if (queryWords.length > 0) {
                return queryWords.some(word => combinedText.includes(word));
              }

              // Se query é muito curta, busca string completa (fallback)
              return combinedText.includes(queryLower);
            })
            .sort((a, b) => {
              // ⭐ ORDENAR POR DATA: Mais recentes primeiro
              const dateA = new Date(a.uploadedAt || 0).getTime();
              const dateB = new Date(b.uploadedAt || 0).getTime();
              return dateB - dateA; // Decrescente (mais recente primeiro)
            })
            .slice(0, limite);

          if (relevantDocs.length === 0) {
            return {
              success: false,
              content: `Nenhum documento encontrado para "${query}". Documentos disponíveis: ${allDocs.length}`
            };
          }

          // Formatar resultado
          let respostaFormatada = `\n📚 **Knowledge Base - "${query}"** (${relevantDocs.length} documento(s) encontrado(s))\n\n`;

          relevantDocs.forEach((doc, idx) => {
            respostaFormatada += `**[${idx + 1}] ${doc.name}**\n`;
            respostaFormatada += `Tipo: ${doc.metadata?.documentType || 'Não identificado'}\n`;
            respostaFormatada += `Tamanho: ${Math.round(doc.textLength / 1000)}k caracteres\n`;
            respostaFormatada += `Upload: ${new Date(doc.uploadedAt).toLocaleDateString('pt-BR')}\n`;

            // Extrair texto COMPLETO (sem limitação!)
            if (doc.extractedText) {
              // CORREÇÃO CRÍTICA: Retornar texto completo sempre
              // Sonnet 4.5 suporta 200k tokens de saída
              const textoCompleto = doc.extractedText.trim();

              respostaFormatada += `\nConteúdo COMPLETO do documento (${Math.round(doc.textLength/1000)}k caracteres):\n${textoCompleto}\n`;

              // Informar tamanho do documento
              respostaFormatada += `\n✅ Documento carregado integralmente (${Math.round(doc.textLength/1000)}k caracteres, ${Math.round(doc.textLength/4)} tokens aproximadamente)\n`;
            }

            if (doc.metadata?.processNumber) {
              respostaFormatada += `\nProcesso: ${doc.metadata.processNumber}\n`;
            }
            if (doc.metadata?.parties) {
              respostaFormatada += `Partes: ${doc.metadata.parties}\n`;
            }

            respostaFormatada += '\n---\n\n';
          });

          respostaFormatada += `✅ **Total de documentos na KB**: ${allDocs.length}\n`;

          console.log(`✅ [KB] ${relevantDocs.length} documento(s) encontrado(s)`);

          return {
            success: true,
            content: respostaFormatada,
            metadata: {
              query,
              totalEncontrados: relevantDocs.length,
              totalNaKB: allDocs.length
            }
          };

        } catch (error) {
          console.error(`❌ [KB] Erro:`, error);
          return {
            success: false,
            error: error.message,
            content: `Erro ao consultar Knowledge Base: ${error.message}`
          };
        }
      }

      case 'pesquisar_doutrina': {
        const { termo, tipo = 'todos', limite = 10 } = toolInput;

        console.log(`📚 [Doutrina] Pesquisando: "${termo}" (tipo: ${tipo}, limite: ${limite})`);

        try {
          const resultado = await doctrineSearchService.search(termo, {
            tipo,
            limite
          });

          // Formatar resultados usando o método do serviço
          const respostaFormatada = doctrineSearchService.formatResults(resultado);

          console.log(`✅ [Doutrina] ${resultado.resultados?.length || 0} resultados encontrados`);

          return {
            success: resultado.sucesso,
            content: respostaFormatada,
            metadata: {
              termo,
              tipo,
              totalResultados: resultado.resultados?.length || 0,
              fontes: resultado.estatisticas?.fontes || [],
              timestamp: resultado.timestamp
            }
          };

        } catch (error) {
          console.error(`❌ [Doutrina] Erro:`, error);
          return {
            success: false,
            error: error.message,
            content: `Erro ao buscar doutrina: ${error.message}`
          };
        }
      }

      case 'analisar_documento_kb': {
        const {
          document_name,
          analysis_type = 'complete',
          custom_prompt = '',
          model = 'sonnet'
        } = toolInput;

        console.log(`🔍 [analisar_documento_kb V2] Documento: "${document_name}"`);
        console.log(`   Tipo de análise: ${analysis_type}`);
        console.log(`   Modelo: ${model}`);

        try {
          // Importar document-processor-v2
          const { documentProcessorV2 } = await import('../../lib/document-processor-v2.js');

          // Buscar documento na KB
          const kbDocsPath = path.join(ACTIVE_PATHS.data, 'kb-documents.json');

          if (!fs.existsSync(kbDocsPath)) {
            return {
              success: false,
              content: 'Knowledge Base vazia. Faça upload de documentos primeiro.'
            };
          }

          const allDocs = JSON.parse(fs.readFileSync(kbDocsPath, 'utf8'));

          // LOG DETALHADO para debug
          console.log(`\n   🔍 DEBUG - Buscando documento: "${document_name}"`);
          console.log(`   📚 Total de documentos na KB: ${allDocs.length}`);
          console.log(`   🔎 Primeiros 5 documentos:`);
          allDocs.slice(0, 5).forEach((d, i) => {
            console.log(`      ${i+1}. name: "${d.name}" | originalName: "${d.originalName}" | id: "${d.id}"`);
          });

          // CORREÇÃO: Busca melhorada - procura em múltiplos campos
          const doc = allDocs.find(d => {
            const searchName = document_name.toLowerCase();

            // Busca em: name, originalName, metadata.parentDocument
            const matchName = d.name?.toLowerCase().includes(searchName);
            const matchOriginal = d.originalName?.toLowerCase().includes(searchName);
            const matchParent = d.metadata?.parentDocument?.toLowerCase().includes(searchName);
            const matchId = d.id?.toLowerCase().includes(searchName);

            const found = matchName || matchOriginal || matchParent || matchId;

            // Log de cada tentativa
            if (found) {
              console.log(`   ✅ MATCH encontrado!`);
              console.log(`      - matchName: ${matchName} (${d.name})`);
              console.log(`      - matchOriginal: ${matchOriginal} (${d.originalName})`);
              console.log(`      - matchParent: ${matchParent}`);
              console.log(`      - matchId: ${matchId}`);
            }

            return found;
          });

          if (!doc) {
            // Lista documentos disponíveis de forma mais útil
            const availableDocs = allDocs
              .filter(d => !d.metadata?.isStructuredDocument) // Exclui fichamentos
              .slice(0, 10)
              .map(d => `- ${d.originalName || d.name || d.id}`)
              .join('\n');

            console.log(`   ❌ NENHUM MATCH encontrado para "${document_name}"`);

            return {
              success: false,
              content: `Documento "${document_name}" não encontrado na KB.\n\nDocumentos disponíveis (primeiros 10):\n${availableDocs}\n\nTotal de documentos: ${allDocs.length}`
            };
          }

          console.log(`   ✅ Documento encontrado: ${doc.name || doc.originalName}`);
          console.log(`   📊 Tamanho: ${Math.round((doc.textLength || doc.size) / 1000)}k caracteres`);
          console.log(`   📂 Path do documento: ${doc.path}`);
          console.log(`   🔍 Estrutura completa do documento:`);
          console.log(JSON.stringify(doc, null, 2));

          // Ler texto completo do documento
          if (!doc.path || !fs.existsSync(doc.path)) {
            console.log(`   ❌ ERRO: Arquivo não encontrado!`);
            console.log(`      - doc.path: ${doc.path}`);
            console.log(`      - fs.existsSync: ${doc.path ? fs.existsSync(doc.path) : 'N/A'}`);

            return {
              success: false,
              content: `Arquivo do documento "${doc.name}" não encontrado no disco. Path: ${doc.path || 'não definido'}`
            };
          }

          console.log(`   ✅ Arquivo existe no disco!`);

          const rawText = fs.readFileSync(doc.path, 'utf-8');

          // Processar com DocumentProcessorV2
          console.log(`   ⚙️ Iniciando processamento V2...`);

          let result;

          if (analysis_type === 'complete') {
            // MODO COMPLETO: Todas as 4 etapas + ficheiros técnicos
            result = await documentProcessorV2.processComplete(
              rawText,
              doc.id,
              doc.name || doc.originalName,
              {
                extractionModel: 'nova-micro',
                analysisModel: model,
                generateFiles: true,
                saveToKB: true
              }
            );

          } else if (analysis_type === 'extract_only') {
            // MODO EXTRAÇÃO: Só extrai texto completo
            const extraction = await documentProcessorV2.extractFullText(
              rawText,
              doc.id,
              doc.name || doc.originalName
            );

            const intermediateDoc = await documentProcessorV2.saveExtractedTextToKB(
              extraction.extractedText,
              doc.id,
              doc.name || doc.originalName
            );

            result = {
              success: true,
              extraction: extraction.metadata,
              intermediateDoc,
              technicalFiles: null,
              metadata: {
                totalTime: extraction.metadata.processingTime,
                totalCost: extraction.metadata.cost,
                extractionCost: extraction.metadata.cost,
                analysisCost: 0,
                filesGenerated: 0
              }
            };

          } else if (analysis_type === 'custom') {
            // MODO CUSTOM: Extração + análise customizada
            const extraction = await documentProcessorV2.extractFullText(
              rawText,
              doc.id,
              doc.name || doc.originalName
            );

            const analysis = await documentProcessorV2.analyzeWithPremiumLLM(
              extraction.extractedText,
              custom_prompt || 'Faça uma análise completa e detalhada do documento.',
              model,
              'Você é um assistente jurídico especializado em análise de documentos processuais brasileiros.'
            );

            result = {
              success: analysis.success,
              extraction: extraction.metadata,
              customAnalysis: analysis.analysis,
              metadata: {
                totalTime: extraction.metadata.processingTime + (analysis.metadata?.processingTime || 0),
                totalCost: extraction.metadata.cost + (analysis.metadata?.cost || 0),
                extractionCost: extraction.metadata.cost,
                analysisCost: analysis.metadata?.cost || 0
              }
            };
          }

          if (!result.success) {
            return {
              success: false,
              content: `Erro no processamento V2: ${result.error}`
            };
          }

          // Formatar resposta
          let responseContent = `\n📄 **Análise Completa V2: ${doc.name || doc.originalName}**\n\n`;
          responseContent += `═══════════════════════════════════════════════════════════════════════\n`;
          responseContent += `🔬 ARQUITETURA V2 - Extração Inteligente + Análise Premium\n`;
          responseContent += `═══════════════════════════════════════════════════════════════════════\n\n`;

          responseContent += `**Tipo de Análise:** ${analysis_type.toUpperCase()}\n`;
          responseContent += `**Modelo de Extração:** Amazon Nova Micro\n`;
          responseContent += `**Modelo de Análise:** ${model.toUpperCase()}\n`;
          responseContent += `**Tempo Total:** ${result.metadata.totalTime}s\n`;
          responseContent += `**Custo de Extração:** $${result.metadata.extractionCost.toFixed(4)}\n`;
          responseContent += `**Custo de Análise:** $${result.metadata.analysisCost.toFixed(4)}\n`;
          responseContent += `**Custo Total:** $${result.metadata.totalCost.toFixed(4)}\n`;

          if (result.metadata.filesGenerated > 0) {
            responseContent += `**Ficheiros Gerados:** ${result.metadata.filesGenerated}\n`;
          }

          responseContent += `\n═══════════════════════════════════════════════════════════════════════\n`;

          if (analysis_type === 'complete' && result.technicalFiles) {
            responseContent += `\n## 📋 FICHEIROS TÉCNICOS GERADOS:\n\n`;

            if (result.technicalFiles.RESUMO_EXECUTIVO) {
              responseContent += `### 📝 RESUMO EXECUTIVO\n\n`;
              responseContent += result.technicalFiles.RESUMO_EXECUTIVO;
              responseContent += `\n\n---\n\n`;
            }

            if (result.technicalFiles.FICHAMENTO) {
              responseContent += `### 📄 FICHAMENTO ESTRUTURADO\n\n`;
              responseContent += result.technicalFiles.FICHAMENTO;
              responseContent += `\n\n---\n\n`;
            }

            if (result.technicalFiles.CRONOLOGIA) {
              responseContent += `### 📅 CRONOLOGIA DETALHADA\n\n`;
              responseContent += result.technicalFiles.CRONOLOGIA;
              responseContent += `\n\n---\n\n`;
            }

            if (result.technicalFiles.ANALISE_JURIDICA) {
              responseContent += `### ⚖️ ANÁLISE JURÍDICA TÉCNICA\n\n`;
              responseContent += result.technicalFiles.ANALISE_JURIDICA;
              responseContent += `\n\n---\n\n`;
            }

          } else if (analysis_type === 'extract_only') {
            responseContent += `\n✅ Texto completo extraído e salvo no KB como:\n`;
            responseContent += `**${result.intermediateDoc.name}**\n\n`;
            responseContent += `ID: \`${result.intermediateDoc.id}\`\n`;
            responseContent += `Tamanho: ${Math.round(result.intermediateDoc.size / 1000)}k caracteres\n\n`;
            responseContent += `💡 O texto extraído está agora disponível na KB para análises futuras sem custo adicional de extração.\n`;

          } else if (analysis_type === 'custom') {
            responseContent += `\n## 🔍 ANÁLISE CUSTOMIZADA\n\n`;
            responseContent += result.customAnalysis;
          }

          responseContent += `\n\n═══════════════════════════════════════════════════════════════════════\n`;
          responseContent += `✅ Processamento V2 concluído com sucesso\n`;
          responseContent += `💡 Economia vs abordagem 100% Claude: ~50%\n`;
          responseContent += `💾 Texto extraído salvo no KB para reutilização\n`;

          console.log(`   ✅ Análise V2 concluída: $${result.metadata.totalCost.toFixed(4)} em ${result.metadata.totalTime}s`);

          return {
            success: true,
            content: responseContent,
            metadata: {
              documentName: doc.name || doc.originalName,
              model,
              analysisType: analysis_type,
              totalCost: result.metadata.totalCost,
              totalTime: result.metadata.totalTime,
              filesGenerated: result.metadata.filesGenerated || 0,
              version: 'v2'
            }
          };

        } catch (error) {
          console.error(`❌ [analisar_documento_kb V2] Erro:`, error);
          return {
            success: false,
            error: error.message,
            content: `Erro ao analisar documento (V2): ${error.message}\n\nStack trace:\n${error.stack}`
          };
        }
      }

      case 'create_artifact': {
        const { title, content, type = 'document', language = 'markdown' } = toolInput;

        console.log(`📄 [Artifact] Criando: "${title}" (${type})`);
        console.log(`   📋 toolInput recebido:`, JSON.stringify(toolInput, null, 2)); // 🆕 LOG COMPLETO
        console.log(`   📊 Parâmetros extraídos:`, { title, type, language, contentLength: content?.length || 0 }); // 🆕 LOG DOS PARAMS

        // Retorna objeto artifact que será enviado ao frontend
        return {
          success: true,
          artifact: {
            title,
            content,
            type,
            language,
            createdAt: new Date().toISOString()
          },
          message: `✅ Artifact "${title}" criado com sucesso. O documento aparecerá no painel lateral para download em DOCX, PDF, HTML e Markdown.`
        };
      }

      default:
        throw new Error(`Tool não implementada: ${toolName}`);
    }
  } catch (error) {
    console.error(`❌ [Tool Use] Erro ao executar ${toolName}:`, error);

    return {
      success: false,
      error: error.message,
      content: `Erro ao executar a ferramenta ${toolName}: ${error.message}`
    };
  }
}

// ============================================================
// CONVERSAR COM TOOL USE
// ============================================================

/**
 * Função de conversação com suporte a Tool Use
 * Automaticamente chama tools quando a IA solicita
 *
 * @param {string} prompt - Mensagem do usuário
 * @param {object} options - Opções
 * @returns {Promise<object>} Resposta completa
 */
export async function conversarComTools(prompt, options = {}) {
  const {
    modelo = 'amazon.nova-pro-v1:0',
    systemPrompt = null,
    historico = [],
    maxTokens = 16384,
    temperature = 0.7,
    maxIteracoes = 5 // Máximo de loops tool use (prevenir loops infinitos)
  } = options;

  const { conversar } = await import('./bedrock.js');

  let iteracao = 0;
  let conversaAtual = [...historico];
  let promptAtual = prompt;
  let toolsUsadas = [];

  // Loop de tool use
  while (iteracao < maxIteracoes) {
    iteracao++;

    console.log(`🔄 [Tool Use] Iteração ${iteracao}/${maxIteracoes}`);

    // Chamar Bedrock (sem tool use nativo ainda - faremos manual)
    const systemPromptComTools = `${systemPrompt || ''}

FERRAMENTAS DISPONÍVEIS (FONTES OFICIAIS E VERIFICÁVEIS):

1. **pesquisar_jurisprudencia**: Pesquisa jurisprudência nos tribunais brasileiros (STF, STJ, CNJ DataJud)
   Parâmetros:
   - termo (obrigatório): string - termo de busca
   - tribunal (opcional): "STF" | "STJ" | "TST" | "TSE"
   - limite (opcional): número (padrão: 5)

2. **consultar_cnj_datajud**: Consulta processo especifico no CNJ DataJud (requer DATAJUD_API_TOKEN)
   Parâmetros:
   - numeroProcesso (obrigatório): string - número do processo CNJ

4. **pesquisar_sumulas**: Pesquisa súmulas dos tribunais superiores (STF, STJ, TST, TSE)
   Parâmetros:
   - tema (obrigatório): string - tema ou palavras-chave
   - tribunal (opcional): "STF" | "STJ" | "TST" | "TSE"

5. **consultar_kb**: Consulta documentos já processados na Knowledge Base do usuário
   Parâmetros:
   - query (obrigatório): string - termo de busca ou contexto do documento
   - limite (opcional): número (padrão: 3)

   Use quando o usuário mencionar:
   - "o documento que enviei"
   - "o contrato"
   - "a petição anterior"
   - "os arquivos que enviei"
   - qualquer referência a documentos enviados

IMPORTANTE: Quando precisar usar uma ferramenta, responda EXATAMENTE no formato:
<tool_use>
<tool>nome_da_ferramenta</tool>
<params>{"parametro": "valor"}</params>
</tool_use>

Escolha a ferramenta mais apropriada para cada necessidade:
- Jurisprudência geral → pesquisar_jurisprudencia (inclui JusBrasil via Google)
- Consultar processo específico → consultar_cnj_datajud
- Súmulas e orientações consolidadas → pesquisar_sumulas
- Documentos enviados pelo usuário → consultar_kb

Depois de receber os resultados, continue sua resposta normalmente incorporando as informações.`;

    const resposta = await conversar(promptAtual, {
      modelo,
      systemPrompt: systemPromptComTools,
      historico: conversaAtual,
      maxTokens,
      temperature
    });

    if (!resposta.sucesso) {
      return resposta;
    }

    const conteudo = resposta.resposta;

    // Verificar se a IA quer usar tools (detectar TODAS as tags tool_use)
    const toolUseRegex = /<tool_use>\s*<tool>(.*?)<\/tool>\s*<params>(.*?)<\/params>\s*<\/tool_use>/gs;
    const toolMatches = [...conteudo.matchAll(toolUseRegex)];

    if (toolMatches.length > 0) {
      // Executar tools em PARALELO (3-5x mais rápido)
      console.log(`🚀 Executando ${toolMatches.length} tools em PARALELO...`);

      const toolPromises = toolMatches.map(async (match) => {
        const toolName = match[1].trim();
        let toolInput;

        try {
          toolInput = JSON.parse(match[2].trim());
        } catch (e) {
          console.error('❌ [Tool Use] Erro ao parsear params:', e);
          return {
            toolName,
            error: e.message,
            result: { success: false, error: e.message, content: `Erro ao parsear parâmetros: ${e.message}` }
          };
        }

        // Executar tool e capturar erros
        const result = await executeTool(toolName, toolInput).catch(err => ({
          success: false,
          error: err.message,
          content: `Erro ao executar ${toolName}: ${err.message}`
        }));

        return {
          toolName,
          toolInput,
          result
        };
      });

      // Aguardar TODAS as tools em paralelo
      const toolResults = await Promise.all(toolPromises);

      // Adicionar todas as tools usadas
      toolResults.forEach(({ toolName, toolInput, result }) => {
        toolsUsadas.push({
          name: toolName,
          input: toolInput,
          result: result
        });
      });

      // Adicionar resultado ao histórico
      conversaAtual.push({
        role: 'user',
        content: promptAtual
      });

      conversaAtual.push({
        role: 'assistant',
        content: `Vou buscar essas informações usando ${toolResults.length} ferramenta(s).`
      });

      // Próxima iteração com resultado de TODAS as tools
      const allResults = toolResults.map(({ toolName, result }) =>
        `**Resultado da ferramenta ${toolName}:**\n\n${result.content}`
      ).join('\n\n---\n\n');

      promptAtual = `${allResults}\n\nAgora responda ao usuário incorporando essas informações de forma natural.`;

    } else {
      // Não há mais tool use, retornar resposta final
      return {
        ...resposta,
        toolsUsadas,
        iteracoes: iteracao
      };
    }
  }

  // Máximo de iterações atingido
  console.warn('⚠️ [Tool Use] Máximo de iterações atingido');
  return {
    sucesso: false,
    erro: 'Máximo de iterações de tool use atingido',
    toolsUsadas,
    iteracoes: iteracao
  };
}

// ============================================================
// EXPORTAÇÕES
// ============================================================

export default {
  BEDROCK_TOOLS,
  executeTool,
  conversarComTools
};
