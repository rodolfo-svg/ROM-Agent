/**
 * ROM Agent - Análise Jurídica Profunda com IA
 *
 * Usa AWS Bedrock (Claude) para gerar análises profundas de documentos jurídicos:
 * - Resumo executivo completo
 * - Resumo ultra curto (1 parágrafo)
 * - Pontos críticos e alertas
 * - Análise completa estruturada
 * - Análise de risco
 * - Classificação documental
 * - Cronologia de eventos
 *
 * @version 2.0
 */

import bedrock from '../modules/bedrock.js';
import logger from '../../lib/logger.js';

/**
 * Mapeia nomes simples de modelos para IDs completos do AWS Bedrock
 */
const MODELOS = {
  'haiku': 'us.anthropic.claude-haiku-4-5-20251001-v1:0',
  'sonnet': 'us.anthropic.claude-sonnet-4-5-20250929-v1:0',
  'opus': 'us.anthropic.claude-opus-4-5-20251101-v1:0'
};

function mapearModelo(modelo) {
  // Se já é um ID completo, retornar como está
  if (modelo && modelo.includes('anthropic')) {
    return modelo;
  }

  // Mapear nome simples para ID completo
  return MODELOS[modelo] || MODELOS['sonnet'];
}

/**
 * Gerar resumo executivo completo (1-2 páginas)
 */
export async function gerarResumoExecutivo(texto, entidades, opcoes = {}) {
  const { modelo = 'haiku' } = opcoes;

  const prompt = `Você é um especialista em análise de documentos jurídicos brasileiros.

TAREFA: Analise o documento jurídico abaixo e gere um RESUMO EXECUTIVO COMPLETO.

DOCUMENTO:
${texto.substring(0, 100000)}

ENTIDADES IDENTIFICADAS:
- Processos: ${entidades.processosJudiciais.map(p => p.numero).join(', ')}
- Valores: ${entidades.valoresMonetarios.slice(0, 5).map(v => v.valorFormatado).join(', ')}
- Datas principais: ${entidades.datas.slice(0, 5).map(d => d.dataFormatada).join(', ')}
- Leis citadas: ${entidades.citacoesLegais.leis.slice(0, 5).map(l => l.lei).join(', ')}

ESTRUTURA OBRIGATÓRIA DO RESUMO:

## Identificação do Documento
- Tipo de documento (petição, sentença, despacho, etc.)
- Número do processo
- Vara/Tribunal
- Partes envolvidas (autor e réu)

## Objeto Principal
Descrever em 2-3 parágrafos o que o documento trata.

## Valores Envolvidos
Listar todos os valores monetários relevantes com contexto.

## Principais Argumentos
Listar os argumentos principais apresentados (usar bullets com ✅/❌/⚠️).

## Pontos Críticos
Destacar pontos que merecem atenção especial.

## Status Processual
Descrever a situação atual do processo.

## Recomendações
Sugestões práticas baseadas na análise.

IMPORTANTE:
- Seja OBJETIVO e PRECISO
- Use linguagem jurídica correta
- Destaque informações CRÍTICAS
- Forneça INSIGHTS acionáveis
- NÃO invente informações que não estão no texto
- Se algo não estiver claro, indique "[Não identificado no documento]"`;

  try {
    const resultado = await bedrock.conversar(prompt, {
      modelo: mapearModelo(modelo),
      temperature: 0.3,
      maxTokens: 4000
    });

    if (!resultado.sucesso) {
      throw new Error(resultado.erro || 'Erro ao gerar resumo executivo');
    }

    return resultado.resposta;
  } catch (error) {
    logger.error('Erro ao gerar resumo executivo', { error: error.message });
    throw error;
  }
}

/**
 * Gerar resumo ultra curto (1 parágrafo)
 */
export async function gerarResumoUltraCurto(texto, entidades, opcoes = {}) {
  const { modelo = 'haiku' } = opcoes;

  const prompt = `Você é um especialista em síntese de documentos jurídicos.

TAREFA: Gere um resumo ULTRA CURTO (1 único parágrafo) do documento abaixo.

DOCUMENTO:
${texto.substring(0, 50000)}

REQUISITOS:
1. Máximo de 150 palavras
2. Incluir: tipo de documento, número do processo, partes, objeto principal, valores
3. Linguagem clara e objetiva
4. Ao final, adicionar 5 palavras-chave separadas por vírgula

FORMATO:
[Parágrafo único de resumo]

**Palavras-chave**: palavra1, palavra2, palavra3, palavra4, palavra5`;

  try {
    const resultado = await bedrock.conversar(prompt, {
      modelo: mapearModelo(modelo),
      temperature: 0.3,
      maxTokens: 500
    });

    if (!resultado.sucesso) {
      throw new Error(resultado.erro || 'Erro ao gerar resumo ultra curto');
    }

    return resultado.resposta;
  } catch (error) {
    logger.error('Erro ao gerar resumo ultra curto', { error: error.message });
    throw error;
  }
}

/**
 * Gerar pontos críticos e alertas
 */
export async function gerarPontosCriticos(texto, entidades, opcoes = {}) {
  const { modelo = 'haiku' } = opcoes;

  const prompt = `Você é um consultor jurídico especializado em análise de riscos.

TAREFA: Identifique PONTOS CRÍTICOS e ALERTAS no documento jurídico abaixo.

DOCUMENTO:
${texto.substring(0, 80000)}

VALORES IDENTIFICADOS: ${entidades.valoresMonetarios.slice(0, 3).map(v => v.valorFormatado).join(', ')}

ESTRUTURA OBRIGATÓRIA:

## 🔴 ALERTAS VERMELHOS (Atenção Imediata)
Liste 3-5 pontos que exigem atenção URGENTE.

## 🟡 ALERTAS AMARELOS (Monitoramento)
Liste 3-5 pontos que devem ser MONITORADOS.

## 🟢 PONTOS POSITIVOS
Liste 3-5 aspectos FAVORÁVEIS identificados.

## 📊 PROBABILIDADE DE ÊXITO
Estime a probabilidade de êxito (%) com base nos elementos identificados.
Formato: **Estimativa**: X% favorável a [parte]
**Base**: [justificativa concisa]

IMPORTANTE:
- Seja REALISTA na avaliação de riscos
- Use emojis apenas conforme indicado (🔴🟡🟢📊)
- Indique riscos CONCRETOS, não genéricos
- Base as estimativas em FATOS do documento`;

  try {
    const resultado = await bedrock.conversar(prompt, {
      modelo: mapearModelo(modelo),
      temperature: 0.3,
      maxTokens: 2000
    });

    if (!resultado.sucesso) {
      throw new Error(resultado.erro || 'Erro na análise jurídica');
    }

    return resultado.resposta;
  } catch (error) {
    logger.error('Erro ao gerar pontos críticos', { error: error.message });
    throw error;
  }
}

/**
 * Gerar análise completa estruturada
 */
export async function gerarAnaliseCompleta(texto, entidades, opcoes = {}) {
  const { modelo = 'sonnet' } = opcoes;

  const prompt = `Você é um advogado especialista com 20 anos de experiência em análise de documentos jurídicos.

TAREFA: Gere uma ANÁLISE COMPLETA E PROFUNDA do documento abaixo.

DOCUMENTO:
${texto.substring(0, 150000)}

ENTIDADES:
- Processos: ${JSON.stringify(entidades.processosJudiciais.slice(0, 3))}
- Valores: ${JSON.stringify(entidades.valoresMonetarios.slice(0, 5))}
- Leis: ${JSON.stringify(entidades.citacoesLegais.leis.slice(0, 10))}

ESTRUTURA OBRIGATÓRIA:

# ANÁLISE COMPLETA DO DOCUMENTO

## 1. CONTEXTO PROCESSUAL

### 1.1 Natureza da Ação
Identificar tipo de ação, fundamento legal, fase processual.

### 1.2 Histórico Processual
Descrever linha do tempo do processo (principais marcos).

### 1.3 Partes Processuais
Identificar e descrever autor, réu, intervenientes, advogados.

---

## 2. ANÁLISE DOS CONTRATOS/DOCUMENTOS BASE

Se houver contratos ou documentos relevantes, analisar:
- Características principais
- Cláusulas relevantes
- Observações importantes
- Vícios aparentes

---

## 3. ANÁLISE JURÍDICA ESPECÍFICA

Conforme o tipo de documento, analisar:
- Teses jurídicas apresentadas
- Fundamentos legais
- Jurisprudência citada ou aplicável
- Força dos argumentos

---

## 4. ANÁLISE DE RISCOS

### 4.1 Riscos para cada parte
Identificar riscos específicos para autor e réu.

### 4.2 Pontos de atenção
Destacar aspectos que merecem cuidado especial.

---

## 5. CONCLUSÃO ANALÍTICA

### Força dos Argumentos
Avaliar (FORTE/MODERADA/FRACA) cada tese principal.

### Probabilidade de Êxito
Estimativa percentual com justificativa.

### Próximos Passos Processuais Prováveis
Listar 3-5 próximos passos esperados.

---

IMPORTANTE:
- Análise PROFUNDA e TÉCNICA
- Use linguagem jurídica apropriada
- Cite artigos de lei quando relevante
- Seja OBJETIVO e IMPARCIAL
- Base conclusões em FATOS e DIREITO
- Máximo 3000 palavras`;

  try {
    const resultado = await bedrock.conversar(prompt, {
      modelo: mapearModelo(modelo),
      temperature: 0.2,
      maxTokens: 8000
    });

    if (!resultado.sucesso) {
      throw new Error(resultado.erro || 'Erro na análise jurídica');
    }

    return resultado.resposta;
  } catch (error) {
    logger.error('Erro ao gerar análise completa', { error: error.message });
    throw error;
  }
}

/**
 * Gerar análise temporal (cronologia)
 */
export async function gerarAnaliseTemporal(texto, entidades, opcoes = {}) {
  const { modelo = 'sonnet' } = opcoes;

  const datas = entidades.datas
    .filter(d => d.ano >= 2015)  // Only relevant recent dates
    .slice(0, 30)
    .map(d => `${d.dataFormatada}: ${d.contexto.substring(0, 90)}`)
    .join('\n');

  const prompt = `Gere uma cronologia jurídica completa do processo abaixo. Comece DIRETAMENTE com o conteúdo, sem introduções.

DOCUMENTO:
${texto.substring(0, 50000)}

DATAS:
${datas}

INSTRUÇÕES:
- Comece com "# CRONOLOGIA DE EVENTOS"
- NÃO escreva frases como "Vou gerar", "Perfeito", etc.
- Organize por ano em ordem cronológica
- Use emojis: 📄 (documentos), ⚖️ (decisões), 💰 (valores), 📋 (petições)

ESTRUTURA OBRIGATÓRIA:

# CRONOLOGIA DE EVENTOS

## LINHA DO TEMPO PROCESSUAL

\`\`\`
ANO
  │
  ├─ DD/MM/AAAA ────► 📄 EVENTO
  │                   └─ Descrição breve
  │
  ├─ DD/MM/AAAA ────► ⚖️ EVENTO JUDICIAL
  │                   └─ Descrição breve
  │
  [...]
  │
  ▼
STATUS ATUAL
\`\`\`

## MARCOS TEMPORAIS CRÍTICOS

### Fase Pré-Processual
Listar eventos antes do processo.

### Fase Processual
Listar eventos do processo.

### Próximos Marcos Esperados
Estimar próximos eventos.

## ANÁLISE TEMPORAL

### Tempo Decorrido
Calcular períodos relevantes.

### Impactos Temporais
Destacar impactos de prazos (prescrição, juros, etc.).

IMPORTANTE:
- Use emojis: 📄 (documentos), ⚖️ (decisões judiciais), 📋 (petições)
- Ordem CRONOLÓGICA crescente
- Indique "[Identificar]" se data não estiver no texto
- Ao final, estime próximos passos com datas aproximadas`;

  try {
    const resultado = await bedrock.conversar(prompt, {
      modelo: mapearModelo(modelo),
      temperature: 0.3,
      maxTokens: 3000
    });

    if (!resultado.sucesso) {
      throw new Error(resultado.erro || 'Erro na análise jurídica');
    }

    return resultado.resposta;
  } catch (error) {
    logger.error('Erro ao gerar análise temporal', { error: error.message });
    throw error;
  }
}

/**
 * Classificar documento (tipo, área do direito, complexidade)
 */
export async function classificarDocumento(texto, entidades, opcoes = {}) {
  const { modelo = 'haiku' } = opcoes;

  const prompt = `Você é um classificador especializado de documentos jurídicos.

TAREFA: Classifique o documento jurídico abaixo.

DOCUMENTO (primeiras 10000 caracteres):
${texto.substring(0, 10000)}

LEIS CITADAS: ${entidades.citacoesLegais.leis.map(l => l.lei).join(', ')}

Retorne APENAS um objeto JSON válido com a seguinte estrutura:

{
  "tipo_documento": "petição_inicial|sentença|despacho|acórdão|manifestação|outro",
  "tipo_documento_especifico": "descrição específica",
  "natureza_acao": "monitória|execução|cautelar|ordinária|outro",
  "area_direito": "civil|penal|trabalhista|tributário|administrativo|outro",
  "sub_area": "contratos|família|sucessões|empresarial|outro",
  "complexidade": "baixa|média|alta",
  "urgencia": "baixa|média|alta",
  "fase_processual": "conhecimento|execução|recursal|cumprimento_sentença",
  "valor_causa_estimado": número ou null,
  "palavras_chave": ["palavra1", "palavra2", "palavra3", "palavra4", "palavra5"],
  "resumo_10_palavras": "resumo em até 10 palavras"
}

NÃO inclua markdown, explicações ou texto adicional. Apenas o JSON.`;

  try {
    const resultado = await bedrock.conversar(prompt, {
      modelo: mapearModelo(modelo),
      temperature: 0.1,
      maxTokens: 1000  // ✅ FIX: Aumentado de 500 para 1000 tokens
    });

    // ✅ FIX: Corrigido de resposta.text para resultado.resposta
    if (!resultado.sucesso) {
      throw new Error(resultado.erro || 'Erro ao classificar documento');
    }

    // Extrair JSON da resposta
    const jsonMatch = resultado.resposta.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }

    throw new Error('Não foi possível extrair JSON da resposta');
  } catch (error) {
    logger.error('Erro ao classificar documento', { error: error.message });

    // Retornar classificação padrão em caso de erro
    return {
      tipo_documento: 'outro',
      tipo_documento_especifico: 'Não classificado',
      natureza_acao: 'não_identificada',
      area_direito: 'não_identificada',
      sub_area: 'não_identificada',
      complexidade: 'média',
      urgencia: 'média',
      fase_processual: 'não_identificada',
      valor_causa_estimado: null,
      palavras_chave: [],
      resumo_10_palavras: 'Documento jurídico não classificado automaticamente'
    };
  }
}

/**
 * Gerar análise de risco completa
 */
export async function gerarAnaliseRisco(texto, entidades, classificacao, opcoes = {}) {
  const { modelo = 'sonnet' } = opcoes;

  const prompt = `Você é um consultor jurídico especializado em gestão de riscos processuais.

TAREFA: Gere uma ANÁLISE DE RISCO completa do documento jurídico.

DOCUMENTO:
${texto.substring(0, 100000)}

CLASSIFICAÇÃO:
${JSON.stringify(classificacao, null, 2)}

VALORES EM JOGO:
${entidades.valoresMonetarios.slice(0, 5).map(v => `${v.valorFormatado} - ${v.contexto}`).join('\n')}

ESTRUTURA OBRIGATÓRIA:

# ANÁLISE DE RISCO

## 1. RESUMO EXECUTIVO DE RISCOS

Parágrafo resumindo os principais riscos identificados.

## 2. MATRIZ DE RISCOS

### Riscos Críticos (Alta Probabilidade + Alto Impacto)
1. **[Nome do Risco]**
   - Probabilidade: Alta/Média/Baixa
   - Impacto: Alto/Médio/Baixo
   - Descrição: [detalhes]
   - Mitigação: [sugestões]

### Riscos Moderados
[mesma estrutura]

### Riscos Baixos
[mesma estrutura]

## 3. ANÁLISE POR PARTE PROCESSUAL

### Riscos para a Parte Autora
Listar e detalhar.

### Riscos para a Parte Ré
Listar e detalhar.

## 4. CENÁRIOS PROVÁVEIS

### Cenário Otimista (30-40%)
Descrever resultado favorável.

### Cenário Realista (40-50%)
Descrever resultado mais provável.

### Cenário Pessimista (20-30%)
Descrever resultado desfavorável.

## 5. RECOMENDAÇÕES ESTRATÉGICAS

Listar 5-8 recomendações práticas e acionáveis:
1. [Recomendação específica]
2. [Recomendação específica]
[...]

## 6. PONTOS DE ATENÇÃO IMEDIATOS

Listar ações que devem ser tomadas IMEDIATAMENTE.

---

IMPORTANTE:
- Seja REALISTA e OBJETIVO
- Base análise em FATOS do processo
- Considere JURISPRUDÊNCIA aplicável
- Indique PRAZOS quando relevante
- Forneça recomendações PRÁTICAS`;

  try {
    const resultado = await bedrock.conversar(prompt, {
      modelo: mapearModelo(modelo),
      temperature: 0.2,
      maxTokens: 6000
    });

    if (!resultado.sucesso) {
      throw new Error(resultado.erro || 'Erro na análise jurídica');
    }

    return resultado.resposta;
  } catch (error) {
    logger.error('Erro ao gerar análise de risco', { error: error.message });
    throw error;
  }
}

/**
 * Pipeline completo de análise jurídica
 */
export async function analisarDocumentoCompleto(texto, entidades, opcoes = {}) {
  const { usarCache = true } = opcoes;

  logger.info('🔍 Iniciando análise jurídica profunda', {
    tamanhoTexto: texto.length,
    totalEntidades: entidades.estatisticas?.totalEntidades || 0
  });

  try {
    // Classificação (mais rápida)
    logger.info('📋 Classificando documento...');
    const classificacao = await classificarDocumento(texto, entidades, opcoes);

    // Resumos (paralelo para otimizar tempo)
    logger.info('📝 Gerando resumos...');
    const [resumoExecutivo, resumoUltraCurto, pontosCriticos] = await Promise.all([
      gerarResumoExecutivo(texto, entidades, opcoes),
      gerarResumoUltraCurto(texto, entidades, opcoes),
      gerarPontosCriticos(texto, entidades, opcoes)
    ]);

    // Análises detalhadas (sequencial - mais pesadas)
    logger.info('🔬 Gerando análise completa...');
    const analiseCompleta = await gerarAnaliseCompleta(texto, entidades, opcoes);

    logger.info('⏱️ Gerando análise temporal...');
    const analiseTemporal = await gerarAnaliseTemporal(texto, entidades, opcoes);

    logger.info('⚠️ Gerando análise de risco...');
    const analiseRisco = await gerarAnaliseRisco(texto, entidades, classificacao, opcoes);

    logger.info('✅ Análise jurídica profunda concluída');

    return {
      classificacao,
      resumoExecutivo,
      resumoUltraCurto,
      pontosCriticos,
      analiseCompleta,
      analiseTemporal,
      analiseRisco,
      metadados: {
        dataAnalise: new Date().toISOString(),
        tamanhoTextoAnalisado: texto.length,
        totalEntidades: entidades.estatisticas?.totalEntidades || 0,
        modeloUsado: opcoes.modelo || 'sonnet'
      }
    };
  } catch (error) {
    logger.error('❌ Erro na análise jurídica profunda', {
      error: error.message,
      stack: error.stack
    });
    throw error;
  }
}

export default {
  gerarResumoExecutivo,
  gerarResumoUltraCurto,
  gerarPontosCriticos,
  gerarAnaliseCompleta,
  gerarAnaliseTemporal,
  classificarDocumento,
  gerarAnaliseRisco,
  analisarDocumentoCompleto
};
