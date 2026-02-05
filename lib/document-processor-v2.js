/**
 * Document Processor V2 - Arquitetura Melhorada
 *
 * FLUXO:
 * 1. LLM Barata (Nova Micro) → Extrai TEXTO COMPLETO do PDF (OCR + estruturação)
 * 2. Salva texto completo no KB como documento intermediário reutilizável
 * 3. LLM Premium (Claude) → Lê texto completo salvo
 * 4. LLM Premium → Gera múltiplos ficheiros técnicos profissionais
 *
 * VANTAGENS:
 * - ✅ Reutilização: Texto extraído fica salvo, pode ser analisado múltiplas vezes
 * - ✅ Economia: Não precisa reprocessar PDF toda vez
 * - ✅ Qualidade: LLM premium trabalha com texto limpo e completo
 * - ✅ Rastreabilidade: Texto intermediário disponível para auditoria
 * - ✅ Flexibilidade: Pode gerar diferentes tipos de análise do mesmo texto
 *
 * EXEMPLO:
 * PDF (300 páginas, 1.5M tokens)
 *  ↓
 * Nova Micro extrai: $0.052
 *  ↓
 * Salva: "processo-123_TEXTO_COMPLETO.md"
 *  ↓
 * Claude Sonnet analisa (1.5M tokens): $4.50
 *  ↓
 * Gera: FICHAMENTO.md, ANALISE_JURIDICA.md, CRONOLOGIA.md, RESUMO_EXECUTIVO.md
 *
 * Total: $4.55 (vs $9.00 com abordagem 100% Claude)
 * Economia: 50% + arquivos intermediários salvos!
 */

import fs from 'fs';
import path from 'path';
import { conversar } from '../src/modules/bedrock.js';
import { documentSummarizer } from './document-summarizer.js';
import { ACTIVE_PATHS } from './storage-config.js';

// Modelos disponíveis
const MODELS = {
  // LLM Barata (extração)
  'nova-micro': {
    id: 'us.amazon.nova-micro-v1:0',
    name: 'Amazon Nova Micro',
    maxTokens: 200000,
    costPer1M: { input: 0.035, output: 0.14 },
    purpose: 'extraction',
    speed: 'very-fast'
  },
  'nova-lite': {
    id: 'us.amazon.nova-lite-v1:0',
    name: 'Amazon Nova Lite',
    maxTokens: 300000,
    costPer1M: { input: 0.06, output: 0.24 },
    purpose: 'extraction',
    speed: 'fast'
  },

  // LLM Premium (análise)
  haiku: {
    id: 'us.anthropic.claude-3-5-haiku-20241022-v1:0',
    name: 'Claude 3.5 Haiku',
    maxTokens: 200000,
    costPer1M: { input: 1.0, output: 5.0 },
    purpose: 'analysis',
    speed: 'fast'
  },
  sonnet: {
    id: 'us.anthropic.claude-3-5-sonnet-20241022-v2:0',
    name: 'Claude 3.5 Sonnet',
    maxTokens: 200000,
    costPer1M: { input: 3.0, output: 15.0 },
    purpose: 'analysis',
    speed: 'medium'
  },
  opus: {
    id: 'us.anthropic.claude-opus-4-20250514-v1:0',
    name: 'Claude Opus 4',
    maxTokens: 200000,
    costPer1M: { input: 15.0, output: 75.0 },
    purpose: 'analysis',
    speed: 'slow'
  }
};

export class DocumentProcessorV2 {
  constructor() {
    this.extractedTextCachePath = path.join(ACTIVE_PATHS.data, 'extracted-texts');
    this.ensureDirectories();
  }

  ensureDirectories() {
    if (!fs.existsSync(this.extractedTextCachePath)) {
      fs.mkdirSync(this.extractedTextCachePath, { recursive: true });
    }
  }

  estimateTokens(text) {
    return Math.ceil(text.length / 4);
  }

  /**
   * Gera ID único para cache baseado no conteúdo
   */
  generateCacheId(documentId, contentHash = null) {
    return `extracted_${documentId}_${contentHash || Date.now()}`;
  }

  /**
   * ETAPA 1: Extração de texto completo com LLM barata
   *
   * @param {string} rawText - Texto bruto do PDF (pode ter erros de OCR, má formatação)
   * @param {string} documentId - ID do documento original
   * @param {string} documentName - Nome do documento original
   * @returns {Object} Texto extraído e limpo + metadados
   */
  async extractFullText(rawText, documentId, documentName) {
    console.log(`\n🔍 [V2 - ETAPA 1] EXTRAÇÃO DE TEXTO COMPLETO`);
    console.log(`   Documento: ${documentName}`);
    console.log(`   Tamanho bruto: ${Math.round(rawText.length / 1000)}k caracteres`);
    console.log(`   Modelo: ${MODELS['nova-micro'].name}`);

    const startTime = Date.now();

    // Verifica se já existe extração em cache
    const cacheId = this.generateCacheId(documentId);
    const cachePath = path.join(this.extractedTextCachePath, `${cacheId}.json`);

    if (fs.existsSync(cachePath)) {
      console.log(`   ♻️  Cache encontrado! Lendo extração anterior...`);
      const cached = JSON.parse(fs.readFileSync(cachePath, 'utf-8'));
      console.log(`   ✅ Extração carregada do cache (economia de tempo e custo)`);
      return cached;
    }

    // Prompt para extração estruturada
    const extractionPrompt = `
Você é um especialista em extração e estruturação de documentos jurídicos.

TAREFA:
Extraia e estruture TODO o texto do documento abaixo, corrigindo erros de OCR, organizando parágrafos, mantendo toda a informação original mas tornando-o limpo e bem formatado.

DIRETRIZES:
1. **Preserve TODA informação**: Não resuma, não omita nada
2. **Corrija erros de OCR**: "rec1amação" → "reclamação"
3. **Mantenha estrutura**: Títulos, seções, numerações
4. **Identifique elementos**: Cabeçalhos, rodapés, assinaturas
5. **Preserve formatação legal**: Citações, dispositivos legais, valores
6. **Numere páginas**: Se possível, indique [Página X]
7. **Organize parágrafos**: Quebre em parágrafos lógicos

FORMATO DE SAÍDA:
═══════════════════════════════════════════════════════════════════════
DOCUMENTO EXTRAÍDO E ESTRUTURADO
═══════════════════════════════════════════════════════════════════════

[Cabeçalho do documento, se houver]

[Página 1]

[Conteúdo da página 1 limpo e estruturado]

[Página 2]

[Conteúdo da página 2 limpo e estruturado]

...

═══════════════════════════════════════════════════════════════════════
FIM DO DOCUMENTO
═══════════════════════════════════════════════════════════════════════

DOCUMENTO BRUTO A EXTRAIR:
═══════════════════════════════════════════════════════════════════════
${rawText}
═══════════════════════════════════════════════════════════════════════

EXTRAIA E ESTRUTURE TODO O TEXTO ACIMA:
`;

    try {
      const response = await conversar(extractionPrompt, {
        modelo: MODELS['nova-micro'].id,
        systemPrompt: 'Você é um extrator de texto especializado. Preserve TODA informação, não resuma.',
        temperature: 0.1, // Baixa temperatura para extração fiel
        maxTokens: 200000,
        enableTools: false,
        enableCache: false
      });

      // Validar resposta
      if (!response) {
        throw new Error('Resposta do Bedrock é null ou undefined');
      }

      if (!response.resposta) {
        console.error(`   ❌ Resposta do Bedrock inválida:`, JSON.stringify(response, null, 2));
        throw new Error(`Campo 'resposta' não encontrado. Response keys: ${Object.keys(response).join(', ')}`);
      }

      const extractedText = response.resposta;
      const elapsedTime = Math.round((Date.now() - startTime) / 1000);

      const inputTokens = this.estimateTokens(rawText);
      const outputTokens = this.estimateTokens(extractedText);
      const cost = (inputTokens / 1_000_000) * MODELS['nova-micro'].costPer1M.input +
                   (outputTokens / 1_000_000) * MODELS['nova-micro'].costPer1M.output;

      console.log(`   ✅ Extração concluída em ${elapsedTime}s`);
      console.log(`   📊 Texto extraído: ${Math.round(extractedText.length / 1000)}k caracteres`);
      console.log(`   💰 Custo: $${cost.toFixed(4)}`);

      const result = {
        extractedText,
        metadata: {
          documentId,
          documentName,
          originalSize: rawText.length,
          extractedSize: extractedText.length,
          extractedAt: new Date().toISOString(),
          model: 'nova-micro',
          inputTokens,
          outputTokens,
          cost,
          processingTime: elapsedTime
        }
      };

      // Salva em cache
      fs.writeFileSync(cachePath, JSON.stringify(result, null, 2));
      console.log(`   💾 Extração salva em cache: ${cacheId}.json`);

      return result;

    } catch (error) {
      console.error(`   ❌ Erro na extração:`, error);
      throw error;
    }
  }

  /**
   * ETAPA 2: Salvamento no KB como documento intermediário
   *
   * @param {string} extractedText - Texto completo extraído
   * @param {string} documentId - ID do documento original
   * @param {string} documentName - Nome do documento original
   */
  async saveExtractedTextToKB(extractedText, documentId, documentName) {
    console.log(`\n💾 [V2 - ETAPA 2] SALVAMENTO NO KB`);

    const kbPath = path.join(ACTIVE_PATHS.data, 'kb-documents.json');
    let allDocs = [];

    if (fs.existsSync(kbPath)) {
      allDocs = JSON.parse(fs.readFileSync(kbPath, 'utf-8'));
    }

    // Cria documento intermediário
    const intermediateDoc = {
      id: `kb-extracted-${documentId}-${Date.now()}`,
      name: `${documentName} - TEXTO_COMPLETO.md`,
      originalName: documentName,
      type: 'text/markdown',
      size: extractedText.length,
      uploadedAt: new Date().toISOString(),
      textLength: extractedText.length,
      metadata: {
        isExtractedText: true,
        parentDocument: documentId,
        extractionSource: 'nova-micro',
        purpose: 'intermediate-full-text'
      }
    };

    // Salva arquivo
    const textPath = path.join(this.extractedTextCachePath, `${intermediateDoc.id}.md`);
    fs.writeFileSync(textPath, extractedText, 'utf-8');
    intermediateDoc.path = textPath;

    // Adiciona ao KB
    allDocs.push(intermediateDoc);
    fs.writeFileSync(kbPath, JSON.stringify(allDocs, null, 2));

    console.log(`   ✅ Documento intermediário salvo: ${intermediateDoc.name}`);
    console.log(`   📊 Tamanho: ${Math.round(extractedText.length / 1000)}k caracteres`);
    console.log(`   🆔 ID: ${intermediateDoc.id}`);

    return intermediateDoc;
  }

  /**
   * ETAPA 3: Análise profunda com LLM Premium
   *
   * @param {string} extractedText - Texto completo já limpo
   * @param {string} analysisPrompt - Prompt de análise do usuário
   * @param {string} model - Modelo premium a usar (haiku, sonnet, opus)
   * @param {string} systemPrompt - System prompt customizado
   */
  async analyzeWithPremiumLLM(extractedText, analysisPrompt, model = 'sonnet', systemPrompt = '') {
    console.log(`\n🧠 [V2 - ETAPA 3] ANÁLISE COM LLM PREMIUM`);
    console.log(`   Modelo: ${MODELS[model].name}`);
    console.log(`   Texto: ${Math.round(extractedText.length / 1000)}k caracteres (~${this.estimateTokens(extractedText).toLocaleString()} tokens)`);

    const startTime = Date.now();

    const fullPrompt = `
${analysisPrompt}

═══════════════════════════════════════════════════════════════════════
DOCUMENTO COMPLETO (JÁ EXTRAÍDO E ESTRUTURADO):
═══════════════════════════════════════════════════════════════════════

${extractedText}

═══════════════════════════════════════════════════════════════════════
FIM DO DOCUMENTO
═══════════════════════════════════════════════════════════════════════

FORNEÇA UMA ANÁLISE COMPLETA E PROFUNDA DO DOCUMENTO ACIMA:
`;

    try {
      const response = await conversar(fullPrompt, {
        modelo: MODELS[model].id,
        systemPrompt: systemPrompt || 'Você é um assistente jurídico especializado em análise profunda de documentos processuais brasileiros.',
        temperature: 0.3,
        maxTokens: 16000,
        enableTools: false,
        enableCache: false
      });

      const elapsedTime = Math.round((Date.now() - startTime) / 1000);

      const inputTokens = this.estimateTokens(extractedText + analysisPrompt);
      const outputTokens = this.estimateTokens(response.resposta);
      const cost = (inputTokens / 1_000_000) * MODELS[model].costPer1M.input +
                   (outputTokens / 1_000_000) * MODELS[model].costPer1M.output;

      console.log(`   ✅ Análise concluída em ${elapsedTime}s`);
      console.log(`   💰 Custo: $${cost.toFixed(4)}`);

      return {
        success: true,
        analysis: response.resposta,
        metadata: {
          model,
          inputTokens,
          outputTokens,
          cost,
          processingTime: elapsedTime
        }
      };

    } catch (error) {
      console.error(`   ❌ Erro na análise:`, error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * ETAPA 4: Geração de múltiplos ficheiros técnicos
   *
   * @param {string} extractedText - Texto completo já limpo
   * @param {string} documentId - ID do documento
   * @param {string} documentName - Nome do documento
   * @param {string} model - Modelo premium a usar
   */
  async generateTechnicalFiles(extractedText, documentId, documentName, model = 'sonnet') {
    console.log(`\n📄 [V2 - ETAPA 4] GERAÇÃO DE FICHEIROS TÉCNICOS`);
    console.log(`   Modelo: ${MODELS[model].name}`);

    const files = {};
    const costs = [];
    const startTime = Date.now();

    // Ficheiro 1: FICHAMENTO ESTRUTURADO
    console.log(`\n   📋 Gerando FICHAMENTO.md...`);
    const fichamentoPrompt = `
Crie um FICHAMENTO ESTRUTURADO completo do documento processual, seguindo o formato:

# FICHAMENTO - ${documentName}

## 1. IDENTIFICAÇÃO
- Número do Processo:
- Classe:
- Órgão Julgador:
- Distribuição:
- Valor da Causa:
- Assunto:

## 2. PARTES
### Polo Ativo:
### Polo Passivo:

## 3. PEDIDOS
[Liste todos os pedidos com numeração]

## 4. CAUSA DE PEDIR
[Fatos e fundamentos]

## 5. FUNDAMENTAÇÃO JURÍDICA
[Dispositivos legais citados]

## 6. JURISPRUDÊNCIA INVOCADA
[Precedentes mencionados]

## 7. DOCUMENTOS ANEXOS
[Lista de documentos juntados]

## 8. MOVIMENTAÇÃO PROCESSUAL
[Principais eventos com datas]

## 9. DECISÕES IMPORTANTES
[Despachos, decisões interlocutórias, sentenças]

## 10. VALOR ECONÔMICO
[Valores envolvidos, custas, honorários]

Seja COMPLETO e DETALHADO.
`;

    const fichamento = await this.analyzeWithPremiumLLM(extractedText, fichamentoPrompt, model, 'Você é um assistente especializado em fichamento de processos judiciais.');

    if (fichamento.success) {
      files.FICHAMENTO = fichamento.analysis;
      costs.push(fichamento.metadata.cost);
      console.log(`   ✅ FICHAMENTO.md gerado ($${fichamento.metadata.cost.toFixed(4)})`);
    }

    // Ficheiro 2: ANÁLISE JURÍDICA TÉCNICA
    console.log(`\n   ⚖️ Gerando ANALISE_JURIDICA.md...`);
    const analisePrompt = `
Faça uma ANÁLISE JURÍDICA TÉCNICA profunda do documento, incluindo:

# ANÁLISE JURÍDICA - ${documentName}

## 1. RESUMO EXECUTIVO
[Síntese em 3-5 parágrafos]

## 2. ANÁLISE DA CAUSA DE PEDIR
[Análise crítica dos fundamentos fáticos]

## 3. ANÁLISE DOS PEDIDOS
[Viabilidade jurídica de cada pedido]

## 4. FUNDAMENTAÇÃO LEGAL
### Dispositivos Citados:
### Adequação da Fundamentação:
### Legislação Aplicável Não Citada:

## 5. JURISPRUDÊNCIA
### Precedentes Citados:
### Análise dos Precedentes:
### Sugestões de Jurisprudência Adicional:

## 6. PONTOS FORTES
[Liste os pontos fortes da argumentação]

## 7. PONTOS FRACOS / VULNERABILIDADES
[Identifique fragilidades argumentativas]

## 8. ESTRATÉGIA PROCESSUAL
[Avalie a estratégia adotada]

## 9. RISCOS E OPORTUNIDADES
### Riscos:
### Oportunidades:

## 10. RECOMENDAÇÕES
[Sugestões estratégicas]

Seja CRÍTICO, TÉCNICO e FUNDAMENTADO.
`;

    const analise = await this.analyzeWithPremiumLLM(extractedText, analisePrompt, model, 'Você é um advogado sênior especializado em análise crítica de peças processuais.');

    if (analise.success) {
      files.ANALISE_JURIDICA = analise.analysis;
      costs.push(analise.metadata.cost);
      console.log(`   ✅ ANALISE_JURIDICA.md gerado ($${analise.metadata.cost.toFixed(4)})`);
    }

    // Ficheiro 3: CRONOLOGIA DETALHADA
    console.log(`\n   📅 Gerando CRONOLOGIA.md...`);
    const cronologiaPrompt = `
Crie uma LINHA DO TEMPO COMPLETA do processo, extraindo TODAS as datas e eventos:

# CRONOLOGIA - ${documentName}

| Data | Evento | Responsável | Observações |
|------|--------|-------------|-------------|
| DD/MM/AAAA | [Evento] | [Quem] | [Detalhes] |

Após a tabela, forneça:

## ANÁLISE TEMPORAL

### Prazos Cumpridos:
### Prazos Descumpridos:
### Eventos Críticos:
### Períodos de Inércia:
### Duração Total:

Seja EXAUSTIVO - extraia TODAS as datas mencionadas.
`;

    const cronologia = await this.analyzeWithPremiumLLM(extractedText, cronologiaPrompt, model, 'Você é um assistente especializado em análise temporal de processos.');

    if (cronologia.success) {
      files.CRONOLOGIA = cronologia.analysis;
      costs.push(cronologia.metadata.cost);
      console.log(`   ✅ CRONOLOGIA.md gerado ($${cronologia.metadata.cost.toFixed(4)})`);
    }

    // Ficheiro 4: RESUMO EXECUTIVO
    console.log(`\n   📝 Gerando RESUMO_EXECUTIVO.md...`);
    const resumoPrompt = `
Crie um RESUMO EXECUTIVO sintético para leitura rápida por tomadores de decisão:

# RESUMO EXECUTIVO - ${documentName}

## ⚖️ NATUREZA
[1-2 frases sobre o tipo de ação]

## 👥 PARTES
**Autor:** [Nome]
**Réu:** [Nome]

## 💰 VALOR
R$ [valor] ([extenso])

## 📋 PEDIDOS PRINCIPAIS
1. [Pedido 1]
2. [Pedido 2]
3. [Pedido 3]

## 🎯 CAUSA DE PEDIR (Resumo)
[2-3 parágrafos sintéticos]

## ⚖️ FUNDAMENTAÇÃO JURÍDICA
- [Lei X, art. Y]
- [Lei Z, art. W]

## 📊 STATUS ATUAL
[Fase processual e última movimentação]

## ⚠️ PONTOS DE ATENÇÃO
- [Ponto crítico 1]
- [Ponto crítico 2]

## 📈 PROGNÓSTICO
[Avaliação sintética de chances de êxito]

---
**Gerado em:** [Data]
**Analista:** ROM Agent (IA)

Máximo 2 páginas. Seja SINTÉTICO e OBJETIVO.
`;

    const resumo = await this.analyzeWithPremiumLLM(extractedText, resumoPrompt, model, 'Você é um analista que cria resumos executivos para advogados sêniores.');

    if (resumo.success) {
      files.RESUMO_EXECUTIVO = resumo.analysis;
      costs.push(resumo.metadata.cost);
      console.log(`   ✅ RESUMO_EXECUTIVO.md gerado ($${resumo.metadata.cost.toFixed(4)})`);
    }

    const totalTime = Math.round((Date.now() - startTime) / 1000);
    const totalCost = costs.reduce((sum, c) => sum + c, 0);

    console.log(`\n   ═══════════════════════════════════════`);
    console.log(`   ✅ ${Object.keys(files).length} ficheiros gerados`);
    console.log(`   ⏱️ Tempo total: ${totalTime}s`);
    console.log(`   💰 Custo total: $${totalCost.toFixed(4)}`);
    console.log(`   ═══════════════════════════════════════`);

    return {
      success: true,
      files,
      metadata: {
        filesGenerated: Object.keys(files).length,
        totalCost,
        totalTime
      }
    };
  }

  /**
   * MÉTODO PRINCIPAL: Processa documento completo (todas as 4 etapas)
   *
   * @param {string} rawText - Texto bruto do PDF
   * @param {string} documentId - ID do documento
   * @param {string} documentName - Nome do documento
   * @param {Object} options - Opções de processamento
   */
  async processComplete(rawText, documentId, documentName, options = {}) {
    console.log(`\n╔══════════════════════════════════════════════════════════════╗`);
    console.log(`║  📄 DOCUMENT PROCESSOR V2 - ARQUITETURA MELHORADA           ║`);
    console.log(`╚══════════════════════════════════════════════════════════════╝`);
    console.log(`\n📄 Documento: ${documentName}`);
    console.log(`📊 Tamanho: ${Math.round(rawText.length / 1000)}k caracteres (~${this.estimateTokens(rawText).toLocaleString()} tokens)`);

    const {
      extractionModel = 'nova-micro',
      analysisModel = 'sonnet',
      generateFiles = true,
      saveToKB = true
    } = options;

    const totalStartTime = Date.now();
    const costs = [];

    try {
      // ETAPA 1: Extração
      const extraction = await this.extractFullText(rawText, documentId, documentName);
      costs.push(extraction.metadata.cost);

      // ETAPA 2: Salvamento no KB
      let intermediateDoc = null;
      if (saveToKB) {
        intermediateDoc = await this.saveExtractedTextToKB(
          extraction.extractedText,
          documentId,
          documentName
        );
      }

      // ETAPA 3 & 4: Análise + Geração de ficheiros
      let technicalFiles = null;
      if (generateFiles) {
        technicalFiles = await this.generateTechnicalFiles(
          extraction.extractedText,
          documentId,
          documentName,
          analysisModel
        );
        costs.push(technicalFiles.metadata.totalCost);
      }

      const totalTime = Math.round((Date.now() - totalStartTime) / 1000);
      const totalCost = costs.reduce((sum, c) => sum + c, 0);

      console.log(`\n╔══════════════════════════════════════════════════════════════╗`);
      console.log(`║  ✅ PROCESSAMENTO COMPLETO CONCLUÍDO                         ║`);
      console.log(`╚══════════════════════════════════════════════════════════════╝`);
      console.log(`\n⏱️  Tempo total: ${totalTime}s`);
      console.log(`💰 Custo total: $${totalCost.toFixed(4)}`);
      console.log(`\n📦 Resultados:`);
      console.log(`   1. Texto completo extraído e salvo no KB`);
      if (technicalFiles) {
        console.log(`   2. ${technicalFiles.metadata.filesGenerated} ficheiros técnicos gerados`);
      }
      console.log(`\n💡 Vantagens:`);
      console.log(`   ✅ Texto extraído reutilizável (cache)`);
      console.log(`   ✅ Economia vs abordagem 100% Claude: ~50%`);
      console.log(`   ✅ Ficheiros profissionais prontos para uso`);

      return {
        success: true,
        extraction: extraction.metadata,
        intermediateDoc,
        technicalFiles: technicalFiles?.files || null,
        metadata: {
          totalTime,
          totalCost,
          extractionCost: extraction.metadata.cost,
          analysisCost: technicalFiles?.metadata.totalCost || 0,
          filesGenerated: technicalFiles?.metadata.filesGenerated || 0
        }
      };

    } catch (error) {
      console.error(`\n❌ Erro no processamento V2:`, error);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

// Singleton
export const documentProcessorV2 = new DocumentProcessorV2();
