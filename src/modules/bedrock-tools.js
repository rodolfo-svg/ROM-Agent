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
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
      description: 'Pesquisa jurisprudência nos tribunais brasileiros (STF, STJ, CNJ DataJud) e retorna precedentes relevantes com ementas completas. Use esta ferramenta quando precisar de precedentes judiciais, súmulas, acórdãos ou decisões para fundamentar argumentos jurídicos.',
      inputSchema: {
        json: {
          type: 'object',
          properties: {
            termo: {
              type: 'string',
              description: 'Termo de busca, palavras-chave ou assunto jurídico (ex: "prisão preventiva", "indenização moral", "LGPD")'
            },
            tribunal: {
              type: 'string',
              description: 'Tribunal específico para filtrar (opcional). Valores: "STF", "STJ", "TST", "TSE". Se não informado, busca em todos.',
              enum: ['STF', 'STJ', 'TST', 'TSE', null]
            },
            limite: {
              type: 'number',
              description: 'Número máximo de resultados a retornar (padrão: 5)',
              default: 5
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
      description: 'Consulta processo judicial específico na base do CNJ DataJud (Conselho Nacional de Justiça). Use quando tiver um número de processo e precisar de informações oficiais sobre ele. Fonte 100% oficial e verificável.',
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
      description: 'Pesquisa súmulas dos tribunais superiores (STF, STJ, TST, TSE). Use quando precisar de orientações jurisprudenciais consolidadas sobre determinado tema. Fontes oficiais.',
      inputSchema: {
        json: {
          type: 'object',
          properties: {
            tema: {
              type: 'string',
              description: 'Tema ou palavras-chave para buscar súmulas (ex: "prescrição", "honorários advocatícios")'
            },
            tribunal: {
              type: 'string',
              description: 'Tribunal específico (opcional). Valores: "STF", "STJ", "TST", "TSE"',
              enum: ['STF', 'STJ', 'TST', 'TSE', null]
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
      description: 'Consulta documentos já processados na Knowledge Base do usuário. Use quando o usuário mencionar "o documento que enviei", "o contrato", "a petição anterior" ou qualquer referência a arquivos enviados. Os documentos foram extraídos automaticamente (33 ferramentas, $0.00) e estão prontos para consulta.',
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
        const { termo, tribunal, limite = 5 } = toolInput;

        // ✅ ATUALIZADO: Usar serviço novo (Google Search + DataJud + JusBrasil)
        const resultado = await jurisprudenceService.searchAll(termo, {
          limit: limite,
          tribunal: tribunal || null,
          enableCache: true
        });

        // ✅ ATUALIZADO: Formatar resultado do serviço novo
        let respostaFormatada = `\n📊 **Pesquisa de Jurisprudência: "${termo}"**\n\n`;

        // Informações gerais
        respostaFormatada += `Total de resultados: ${resultado.totalResults || 0}\n`;
        respostaFormatada += `Fontes consultadas: ${Object.keys(resultado.sources || {}).length}\n`;
        if (tribunal) respostaFormatada += `Tribunal filtrado: ${tribunal}\n`;
        respostaFormatada += `\n---\n\n`;

        // Resultados do DataJud CNJ
        if (resultado.sources?.datajud?.success && resultado.sources.datajud.results?.length > 0) {
          respostaFormatada += `\n🏛️ **CNJ DataJud (${resultado.sources.datajud.count} resultados oficiais)**\n\n`;

          resultado.sources.datajud.results.slice(0, 3).forEach((item, idx) => {
            respostaFormatada += `**[${idx + 1}] ${item.numero || item.titulo || 'Decisão'}**\n`;
            if (item.tribunal) respostaFormatada += `Tribunal: ${item.tribunal}\n`;
            if (item.classe) respostaFormatada += `Classe: ${item.classe}\n`;
            if (item.relator) respostaFormatada += `Relator: ${item.relator}\n`;
            if (item.data) respostaFormatada += `Data: ${item.data}\n`;
            if (item.ementa) respostaFormatada += `Ementa: ${item.ementa.substring(0, 300)}...\n`;
            if (item.link) respostaFormatada += `Link: ${item.link}\n`;
            respostaFormatada += '\n';
          });

          respostaFormatada += '---\n\n';
        }

        // Resultados do JusBrasil
        if (resultado.sources?.jusbrasil?.success && resultado.sources.jusbrasil.results?.length > 0) {
          respostaFormatada += `\n📚 **JusBrasil (${resultado.sources.jusbrasil.count} resultados)**\n\n`;

          resultado.sources.jusbrasil.results.slice(0, 3).forEach((item, idx) => {
            respostaFormatada += `**[${idx + 1}] ${item.titulo || 'Documento'}**\n`;
            if (item.tribunal) respostaFormatada += `Tribunal: ${item.tribunal}\n`;
            if (item.data) respostaFormatada += `Data: ${item.data}\n`;
            if (item.ementa) respostaFormatada += `Ementa: ${item.ementa.substring(0, 300)}...\n`;
            if (item.link) respostaFormatada += `Link: ${item.link}\n`;
            respostaFormatada += '\n';
          });

          respostaFormatada += '---\n\n';
        }

        // Resultados da Web Search (Google)
        if (resultado.sources?.websearch?.success && resultado.sources.websearch.results?.length > 0) {
          respostaFormatada += `\n🔍 **Web Search - Google (${resultado.sources.websearch.count} resultados)**\n\n`;

          resultado.sources.websearch.results.slice(0, 3).forEach((item, idx) => {
            respostaFormatada += `**[${idx + 1}] ${item.titulo || item.title || 'Resultado'}**\n`;
            if (item.snippet) respostaFormatada += `${item.snippet.substring(0, 200)}...\n`;
            if (item.link) respostaFormatada += `Link: ${item.link}\n`;
            respostaFormatada += '\n';
          });

          respostaFormatada += '---\n\n';
        }

        respostaFormatada += '\n✅ **Pesquisa concluída**\n';
        respostaFormatada += `Timestamp: ${resultado.searchedAt || new Date().toISOString()}\n`;

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
        const { query, limite = 3 } = toolInput;

        console.log(`📚 [KB] Consultando documentos: "${query}"`);

        try {
          // Ler documentos da KB
          const kbDocsPath = path.join(process.cwd(), 'data', 'kb-documents.json');

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

          // Buscar documentos relevantes (busca simples por texto)
          const queryLower = query.toLowerCase();
          const relevantDocs = allDocs
            .filter(doc => {
              const nameMatch = doc.name.toLowerCase().includes(queryLower);
              const textMatch = doc.extractedText?.toLowerCase().includes(queryLower);
              const typeMatch = doc.metadata?.documentType?.toLowerCase().includes(queryLower);
              return nameMatch || textMatch || typeMatch;
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
    maxTokens = 4096,
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

2. **consultar_cnj_datajud**: Consulta processo específico no CNJ DataJud (fonte 100% oficial)
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
