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

import { pesquisarJurisprudencia } from './jurisprudencia.js';

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

        // Determinar fontes com base no tribunal
        const fontes = tribunal
          ? ['ia']
          : ['ia', 'stf', 'stj'];

        const resultado = await pesquisarJurisprudencia(termo, {
          fontes,
          limite,
          paralelo: true,
          tribunal
        });

        // Formatar resultado para a IA
        let respostaFormatada = '';

        // Resultado da IA (sempre presente, mais confiável)
        if (resultado.fontes.ia && resultado.fontes.ia.sucesso) {
          respostaFormatada += `\n📊 **Análise Jurisprudencial sobre "${termo}"**\n\n`;
          respostaFormatada += resultado.fontes.ia.resultados;
          respostaFormatada += '\n\n---\n';
        }

        // Resultados do STF (se disponível)
        if (resultado.fontes.stf && resultado.fontes.stf.sucesso) {
          respostaFormatada += `\n⚖️ **Supremo Tribunal Federal (${resultado.fontes.stf.totalEncontrados} resultados)**\n\n`;

          resultado.fontes.stf.resultados.slice(0, 3).forEach((item, idx) => {
            respostaFormatada += `**[${idx + 1}] ${item.classe || 'Acórdão'} ${item.numero || ''}**\n`;
            respostaFormatada += `Relator: ${item.relator || 'Não informado'}\n`;
            respostaFormatada += `Data: ${item.data || 'Não informada'}\n`;
            respostaFormatada += `Ementa: ${item.ementa ? item.ementa.substring(0, 300) : 'Não disponível'}...\n`;
            if (item.link) respostaFormatada += `Link: ${item.link}\n`;
            respostaFormatada += '\n';
          });

          respostaFormatada += '---\n';
        }

        // Resultados do STJ (se disponível)
        if (resultado.fontes.stj && resultado.fontes.stj.sucesso) {
          respostaFormatada += `\n⚖️ **Superior Tribunal de Justiça (${resultado.fontes.stj.totalEncontrados} resultados)**\n\n`;

          resultado.fontes.stj.resultados.slice(0, 3).forEach((item, idx) => {
            respostaFormatada += `**[${idx + 1}] ${item.classe || 'Acórdão'} ${item.numero || ''}**\n`;
            respostaFormatada += `Relator: ${item.relator || 'Não informado'}\n`;
            respostaFormatada += `Data: ${item.data || 'Não informada'}\n`;
            respostaFormatada += `Ementa: ${item.ementa ? item.ementa.substring(0, 300) : 'Não disponível'}...\n`;
            if (item.link) respostaFormatada += `Link: ${item.link}\n`;
            respostaFormatada += '\n';
          });

          respostaFormatada += '---\n';
        }

        respostaFormatada += '\n✅ **Pesquisa concluída com sucesso**\n';
        respostaFormatada += `Total de fontes consultadas: ${Object.keys(resultado.fontes).length}\n`;
        respostaFormatada += `Timestamp: ${resultado.timestamp}\n`;

        console.log(`✅ [Tool Use] pesquisar_jurisprudencia executada com sucesso`);

        return {
          success: true,
          content: respostaFormatada,
          metadata: {
            termo,
            tribunal,
            totalFontes: Object.keys(resultado.fontes).length,
            totalResultados: resultado.totalGeral
          }
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

FERRAMENTAS DISPONÍVEIS:

1. **pesquisar_jurisprudencia**: Pesquisa jurisprudência nos tribunais brasileiros
   Parâmetros:
   - termo (obrigatório): string - termo de busca
   - tribunal (opcional): "STF" | "STJ" | "TST" | "TSE"
   - limite (opcional): número (padrão: 5)

IMPORTANTE: Quando você precisar buscar jurisprudência, responda EXATAMENTE no formato:
<tool_use>
<tool>pesquisar_jurisprudencia</tool>
<params>{"termo": "...", "tribunal": "...", "limite": 5}</params>
</tool_use>

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

    // Verificar se a IA quer usar uma tool
    const toolUseMatch = conteudo.match(/<tool_use>\s*<tool>(.*?)<\/tool>\s*<params>(.*?)<\/params>\s*<\/tool_use>/s);

    if (toolUseMatch) {
      const toolName = toolUseMatch[1].trim();
      let toolInput;

      try {
        toolInput = JSON.parse(toolUseMatch[2].trim());
      } catch (e) {
        console.error('❌ [Tool Use] Erro ao parsear params:', e);
        break;
      }

      // Executar tool
      const toolResult = await executeTool(toolName, toolInput);
      toolsUsadas.push({
        name: toolName,
        input: toolInput,
        result: toolResult
      });

      // Adicionar resultado ao histórico
      conversaAtual.push({
        role: 'user',
        content: promptAtual
      });

      conversaAtual.push({
        role: 'assistant',
        content: `Vou buscar essa informação usando a ferramenta ${toolName}.`
      });

      // Próxima iteração com resultado da tool
      promptAtual = `Resultado da ferramenta ${toolName}:\n\n${toolResult.content}\n\nAgora responda ao usuário incorporando essas informações de forma natural.`;

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
