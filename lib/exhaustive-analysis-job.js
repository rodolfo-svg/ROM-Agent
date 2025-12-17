/**
 * EXHAUSTIVE ANALYSIS JOB - MODO EXAUSTIVO
 * Job assíncrono para análise exaustiva de processos
 *
 * Ativado automaticamente quando o usuário solicita:
 * - "exaustivamente"
 * - "integralidade"
 * - "todos os arquivos"
 * - "processo completo"
 * - "analisando todos"
 *
 * Fluxo:
 * 1. Inventariar todos os documentos do projeto/KB
 * 2. Sumarizar cada documento (map)
 * 3. Consolidar por tema/decisão (reduce)
 * 4. Gerar resumo executivo + tabelas + citações
 * 5. Exportar resultado completo
 * 6. Chat recebe: status + link para export
 */

import fs from 'fs/promises';
import path from 'path';
import { EventEmitter } from 'events';
import bedrockQueue from './bedrock-queue-manager.js';
import { conversar } from '../src/modules/bedrock.js';
import modelRouter from './model-profile-router.js';

class ExhaustiveAnalysisJob extends EventEmitter {
  constructor(config) {
    super();

    this.jobId = config.jobId;
    this.projectId = config.projectId;
    this.userId = config.userId;
    this.traceId = config.traceId;
    this.request = config.request; // Pedido do usuário
    this.metadata = config.metadata || {};

    // Configuração
    this.kbPath = config.kbPath || process.env.KB_PATH || './KB';
    this.outputPath = config.outputPath || './exports';

    // Estado
    this.status = 'pending'; // pending, running, completed, failed
    this.progress = {
      currentStep: 0,
      totalSteps: 5,
      percentage: 0,
      message: 'Iniciando análise exaustiva...'
    };

    // Resultados
    this.results = {
      documents: [],
      summaries: [],
      consolidation: null,
      executiveSummary: null,
      tables: [],
      citations: [],
      exportPath: null
    };

    this.startedAt = null;
    this.completedAt = null;
    this.error = null;
  }

  /**
   * Executa job completo
   */
  async execute() {
    this.status = 'running';
    this.startedAt = Date.now();

    console.info('🔍 Iniciando análise exaustiva', {
      jobId: this.jobId,
      projectId: this.projectId,
      userId: this.userId,
      traceId: this.traceId,
      request: this.request.substring(0, 100)
    });

    this.emit('started', { jobId: this.jobId, projectId: this.projectId });

    try {
      // ETAPA 1: Inventariar documentos
      await this.updateProgress(1, 'Inventariando documentos do processo...');
      const documents = await this.inventoryDocuments();
      this.results.documents = documents;

      console.info(`📚 Inventário concluído: ${documents.length} documentos`, {
        jobId: this.jobId,
        count: documents.length
      });

      // ETAPA 2: Sumarizar cada documento (MAP)
      await this.updateProgress(2, `Analisando ${documents.length} documentos detalhadamente...`);
      const summaries = await this.summarizeDocuments(documents);
      this.results.summaries = summaries;

      console.info(`📝 Sumarização concluída: ${summaries.length} sumários`, {
        jobId: this.jobId,
        count: summaries.length
      });

      // ETAPA 3: Consolidar por tema/decisão (REDUCE)
      await this.updateProgress(3, 'Consolidando análises por tema e decisão...');
      const consolidation = await this.consolidateByTheme(summaries);
      this.results.consolidation = consolidation;

      console.info('🔗 Consolidação concluída', {
        jobId: this.jobId,
        themes: Object.keys(consolidation.themes).length
      });

      // ETAPA 4: Gerar resumo executivo + tabelas
      await this.updateProgress(4, 'Gerando resumo executivo e tabelas estruturadas...');
      const executiveSummary = await this.generateExecutiveSummary(consolidation);
      this.results.executiveSummary = executiveSummary;
      this.results.tables = executiveSummary.tables;
      this.results.citations = executiveSummary.citations;

      console.info('📊 Resumo executivo gerado', {
        jobId: this.jobId,
        sections: executiveSummary.sections.length,
        tables: executiveSummary.tables.length,
        citations: executiveSummary.citations.length
      });

      // ETAPA 5: Exportar resultado completo
      await this.updateProgress(5, 'Exportando resultado completo...');
      const exportPath = await this.exportResults();
      this.results.exportPath = exportPath;

      console.info('💾 Export concluído', {
        jobId: this.jobId,
        exportPath
      });

      // Conclusão
      this.status = 'completed';
      this.completedAt = Date.now();
      const duration = this.completedAt - this.startedAt;

      await this.updateProgress(5, 'Análise exaustiva concluída com sucesso!');

      console.info('✅ Análise exaustiva concluída', {
        jobId: this.jobId,
        projectId: this.projectId,
        duration,
        documentsAnalyzed: documents.length,
        exportPath
      });

      this.emit('completed', {
        jobId: this.jobId,
        results: this.results,
        duration
      });

      return this.results;

    } catch (error) {
      this.status = 'failed';
      this.error = error.message;
      this.completedAt = Date.now();

      console.error('❌ Análise exaustiva falhou', {
        jobId: this.jobId,
        projectId: this.projectId,
        error: error.message,
        stack: error.stack
      });

      this.emit('failed', {
        jobId: this.jobId,
        error: error.message
      });

      throw error;
    }
  }

  /**
   * ETAPA 1: Inventariar documentos do projeto/KB
   */
  async inventoryDocuments() {
    // Buscar documentos do projeto no KB
    const projectPath = path.join(this.kbPath, this.projectId);
    const documents = [];

    try {
      // Verificar se pasta do projeto existe
      const projectExists = await this.fileExists(projectPath);

      if (projectExists) {
        // Ler todos os arquivos do projeto
        const files = await this.readDirectoryRecursive(projectPath);

        for (const file of files) {
          // Ignorar arquivos de sistema
          if (file.includes('.DS_Store') || file.includes('Thumbs.db')) continue;

          // Ler metadados se existir
          const metadata = await this.readFileMetadata(file);

          documents.push({
            path: file,
            relativePath: file.replace(projectPath, ''),
            name: path.basename(file),
            type: this.detectDocumentType(file),
            size: metadata.size,
            modified: metadata.modified,
            metadata
          });
        }
      }

      // Também buscar em KB global (documentos referenciados)
      const kbGlobalDocs = await this.searchKBGlobal();
      documents.push(...kbGlobalDocs);

      // Ordenar por data (mais recente primeiro)
      documents.sort((a, b) => b.modified - a.modified);

      return documents;

    } catch (error) {
      console.error('Erro ao inventariar documentos', {
        jobId: this.jobId,
        projectId: this.projectId,
        error: error.message
      });
      return [];
    }
  }

  /**
   * ETAPA 2: Sumarizar cada documento (MAP)
   */
  async summarizeDocuments(documents) {
    const summaries = [];

    for (const doc of documents) {
      try {
        // Ler conteúdo do documento
        const content = await this.readDocumentContent(doc.path);

        if (!content || content.length < 50) {
          console.warn(`Documento vazio ou muito pequeno: ${doc.name}`);
          continue;
        }

        // Sumarizar via Bedrock Queue (com retry/backoff automático)
        const summary = await bedrockQueue.enqueue({
          projectId: this.projectId,
          userId: this.userId,
          traceId: this.traceId,
          layerRunId: `exhaustive_${this.jobId}_doc_${summaries.length}`,
          priority: 7, // Alta prioridade
          maxRetries: 5,
          fn: async () => {
            return await this.summarizeDocument(doc, content);
          },
          metadata: {
            documentName: doc.name,
            documentType: doc.type
          }
        });

        summaries.push({
          document: doc,
          summary: summary.text,
          keyPoints: summary.keyPoints,
          dates: summary.dates,
          values: summary.values,
          parties: summary.parties,
          decisions: summary.decisions
        });

        // Emitir progresso parcial
        this.emit('document-summarized', {
          jobId: this.jobId,
          documentName: doc.name,
          progress: summaries.length / documents.length
        });

      } catch (error) {
        console.error(`Erro ao sumarizar documento: ${doc.name}`, {
          jobId: this.jobId,
          error: error.message
        });
        // Continuar mesmo com erro em um documento
      }
    }

    return summaries;
  }

  /**
   * Executa chamada ao Bedrock com fallback automático
   */
  async executeWithFallback(prompt, options = {}) {
    const { profile = 'PADRAO', maxTokens = 16384, temperature = 0.3, stepName = 'operation' } = options;

    let lastError = null;
    let attemptCount = 0;
    const maxAttempts = 3;

    while (attemptCount < maxAttempts) {
      try {
        attemptCount++;

        // Selecionar modelo
        const modelSelection = await modelRouter.selectModel({
          profile,
          taskType: 'texto',
          context: {
            userMessage: options.context || `Executing ${stepName}`,
            isDeliverable: options.isDeliverable || false,
            attemptNumber: attemptCount
          }
        });

        // Executar
        const response = await conversar(prompt, {
          modelo: modelSelection.modelId,
          maxTokens,
          temperature
        });

        // Log de sucesso
        console.log(`✅ ${stepName} completed`, {
          jobId: this.jobId,
          modelId: modelSelection.modelId,
          profile: modelSelection.profile,
          isFallback: modelSelection.isFallback,
          traceId: this.traceId,
          attempt: attemptCount
        });

        return response;

      } catch (error) {
        lastError = error;
        const is429 = error.message?.includes('Too many requests') || error.message?.includes('ThrottlingException');
        const isTimeout = error.message?.includes('timeout') || error.message?.includes('timed out');

        console.warn(`⚠️ ${stepName} failed (attempt ${attemptCount}/${maxAttempts})`, {
          jobId: this.jobId,
          error: error.message,
          is429,
          isTimeout,
          traceId: this.traceId
        });

        if (attemptCount < maxAttempts && (is429 || isTimeout)) {
          // Esperar antes de tentar novamente (backoff exponencial)
          const backoffMs = Math.min(1000 * Math.pow(2, attemptCount), 10000);
          console.log(`⏳ Waiting ${backoffMs}ms before retry...`);
          await new Promise(resolve => setTimeout(resolve, backoffMs));
          continue;
        }

        throw lastError;
      }
    }

    throw lastError;
  }

  /**
   * Sumariza um documento individual
   */
  async summarizeDocument(doc, content) {
    // Prompt especializado para sumarização exaustiva
    const prompt = `Analise EXAUSTIVAMENTE o seguinte documento do processo jurídico:

DOCUMENTO: ${doc.name}
TIPO: ${doc.type}

CONTEÚDO:
${content.substring(0, 50000)} ${content.length > 50000 ? '...(truncado)' : ''}

TAREFA - Análise Técnica Completa:

1. RESUMO EXECUTIVO (máx. 3 parágrafos)
   - Natureza do documento
   - Principais acontecimentos/decisões
   - Relevância para o processo

2. PONTOS-CHAVE
   - Liste TODOS os pontos juridicamente relevantes
   - Argumentos das partes
   - Fundamentos jurídicos citados

3. INFORMAÇÕES ESTRUTURADAS
   - Datas importantes (formato: DD/MM/AAAA)
   - Valores/quantias mencionados
   - Partes/pessoas citadas
   - Decisões/determinações

4. DECISÕES E FUNDAMENTOS
   - Se houver decisão judicial, cite integralmente
   - Fundamentos legais (artigos, leis, jurisprudência)
   - Efeitos práticos da decisão

Responda em JSON:
{
  "text": "resumo executivo",
  "keyPoints": ["ponto 1", "ponto 2", ...],
  "dates": [{"date": "DD/MM/AAAA", "event": "descrição"}, ...],
  "values": [{"amount": "R$ X", "description": "descrição"}, ...],
  "parties": ["parte 1", "parte 2", ...],
  "decisions": [{"decision": "texto", "legal_basis": "fundamento"}, ...]
}`;

    // Executar com fallback automático
    const response = await this.executeWithFallback(prompt, {
      profile: 'PADRAO',
      maxTokens: 16384,
      temperature: 0.3,
      stepName: `Document summarization: ${doc.name}`,
      context: `Summarizing document: ${doc.name}`,
      isDeliverable: false
    });

    // Parse JSON response
    try {
      const content = response.content?.[0]?.text || response;
      return JSON.parse(content);
    } catch (e) {
      // Se não for JSON válido, estruturar manualmente
      const content = response.content?.[0]?.text || response;
      return {
        text: content,
        keyPoints: [],
        dates: [],
        values: [],
        parties: [],
        decisions: []
      };
    }
  }

  /**
   * ETAPA 3: Consolidar por tema/decisão (REDUCE)
   */
  async consolidateByTheme(summaries) {
    // Agregar todos os sumários
    const allText = summaries.map(s => s.summary).join('\n\n---\n\n');
    const allKeyPoints = summaries.flatMap(s => s.keyPoints);
    const allDates = summaries.flatMap(s => s.dates);
    const allValues = summaries.flatMap(s => s.values);
    const allDecisions = summaries.flatMap(s => s.decisions);

    // Consolidar via Bedrock Queue
    const consolidation = await bedrockQueue.enqueue({
      projectId: this.projectId,
      userId: this.userId,
      traceId: this.traceId,
      layerRunId: `exhaustive_${this.jobId}_consolidation`,
      priority: 8,
      maxRetries: 5,
      fn: async () => {
        return await this.consolidateAnalysis(summaries, {
          allText,
          allKeyPoints,
          allDates,
          allValues,
          allDecisions
        });
      }
    });

    return consolidation;
  }

  /**
   * Consolida análises por tema
   */
  async consolidateAnalysis(summaries, aggregated) {
    const prompt = `Com base na análise EXAUSTIVA de ${summaries.length} documentos do processo, consolide as informações por TEMAS JURÍDICOS.

TODOS OS RESUMOS:
${aggregated.allText.substring(0, 80000)}

TAREFA - Consolidação Temática:

1. Identificar TODOS os temas jurídicos tratados no processo
2. Para cada tema, consolidar:
   - Fatos relevantes
   - Argumentos de cada parte
   - Decisões relacionadas
   - Fundamentos legais
   - Cronologia

3. Identificar a ÚLTIMA DECISÃO e seus fundamentos

4. Preparar timeline completo do processo

Responda em JSON:
{
  "themes": {
    "tema1": { "facts": [...], "arguments": {...}, "decisions": [...], "legal_basis": [...] },
    ...
  },
  "lastDecision": {
    "date": "DD/MM/AAAA",
    "decision": "texto integral",
    "legalBasis": ["art. X", ...],
    "effects": "efeitos práticos"
  },
  "timeline": [{"date": "DD/MM/AAAA", "event": "..."}, ...],
  "parties": {"autor": "...", "reu": "...", "others": [...]}
}`;

    // Executar com fallback automático
    const response = await this.executeWithFallback(prompt, {
      profile: 'PADRAO',
      maxTokens: 24576,
      temperature: 0.3,
      stepName: `Theme consolidation (${summaries.length} docs)`,
      context: `Consolidating ${summaries.length} document analyses`,
      isDeliverable: false
    });

    try {
      const content = response.content?.[0]?.text || response;
      return JSON.parse(content);
    } catch (e) {
      return {
        themes: {},
        lastDecision: null,
        timeline: [],
        parties: {}
      };
    }
  }

  /**
   * ETAPA 4: Gerar resumo executivo + tabelas
   */
  async generateExecutiveSummary(consolidation) {
    // Gerar resumo executivo via Bedrock Queue
    const executiveSummary = await bedrockQueue.enqueue({
      projectId: this.projectId,
      userId: this.userId,
      traceId: this.traceId,
      layerRunId: `exhaustive_${this.jobId}_executive`,
      priority: 9,
      maxRetries: 5,
      fn: async () => {
        return await this.createExecutiveSummary(consolidation);
      }
    });

    return executiveSummary;
  }

  /**
   * Cria resumo executivo
   */
  async createExecutiveSummary(consolidation) {
    const prompt = `Com base na consolidação temática do processo, gere um RESUMO EXECUTIVO COMPLETO para subsidiar a redação de EMBARGOS DE DECLARAÇÃO.

CONSOLIDAÇÃO:
${JSON.stringify(consolidation, null, 2).substring(0, 80000)}

TAREFA - Resumo Executivo para Embargos:

1. SÍNTESE DO PROCESSO (máx. 2 páginas)
   - Partes e advogados
   - Objeto da ação
   - Principais fatos
   - Cronologia resumida

2. ANÁLISE DA ÚLTIMA DECISÃO
   - Data e tipo de decisão
   - Dispositivo integral
   - Fundamentos utilizados
   - Possíveis omissões
   - Possíveis contradições
   - Possíveis obscuridades

3. TABELAS ESTRUTURADAS
   - Timeline completo (data, evento, documento)
   - Valores e quantias (data, valor, natureza)
   - Prazos processuais (prazo, data-limite, status)

4. CITAÇÕES INTERNAS
   - Trechos relevantes com localização exata no processo

Responda em JSON estruturado.`;

    // Executar com fallback automático (PREMIUM para entrega final)
    const response = await this.executeWithFallback(prompt, {
      profile: 'PREMIUM',
      maxTokens: 32768,
      temperature: 0.2,
      stepName: 'Executive summary generation',
      context: 'Generating executive summary - final deliverable',
      isDeliverable: true
    });

    try {
      const content = response.content?.[0]?.text || response;
      return JSON.parse(content);
    } catch (e) {
      return {
        sections: [],
        tables: [],
        citations: []
      };
    }
  }

  /**
   * ETAPA 5: Exportar resultado completo
   */
  async exportResults() {
    const timestamp = new Date().toISOString().replace(/:/g, '-').split('.')[0];
    const exportDir = path.join(this.outputPath, this.projectId);
    const exportFile = path.join(exportDir, `analise-exaustiva-${timestamp}.json`);
    const exportMd = path.join(exportDir, `analise-exaustiva-${timestamp}.md`);

    // Criar diretório se não existir
    await fs.mkdir(exportDir, { recursive: true });

    // Exportar JSON completo
    const exportData = {
      jobId: this.jobId,
      projectId: this.projectId,
      userId: this.userId,
      traceId: this.traceId,
      request: this.request,
      startedAt: this.startedAt,
      completedAt: this.completedAt,
      duration: this.completedAt - this.startedAt,
      results: this.results
    };

    await fs.writeFile(exportFile, JSON.stringify(exportData, null, 2), 'utf8');

    // Exportar Markdown formatado
    const markdown = this.generateMarkdownReport(exportData);
    await fs.writeFile(exportMd, markdown, 'utf8');

    console.info('📄 Resultados exportados', {
      jobId: this.jobId,
      jsonPath: exportFile,
      mdPath: exportMd
    });

    return {
      json: exportFile,
      markdown: exportMd,
      directory: exportDir
    };
  }

  /**
   * Gera relatório em Markdown
   */
  generateMarkdownReport(data) {
    const { results } = data;
    const duration = ((data.completedAt - data.startedAt) / 1000).toFixed(2);

    let md = `# ANÁLISE EXAUSTIVA DO PROCESSO\n\n`;
    md += `**Job ID**: ${this.jobId}\n`;
    md += `**Projeto**: ${this.projectId}\n`;
    md += `**Data**: ${new Date().toLocaleString('pt-BR')}\n`;
    md += `**Duração**: ${duration}s\n\n`;
    md += `---\n\n`;

    // Documentos analisados
    md += `## 📚 DOCUMENTOS ANALISADOS (${results.documents.length})\n\n`;
    for (const doc of results.documents) {
      md += `- **${doc.name}** (${doc.type})\n`;
    }
    md += `\n---\n\n`;

    // Resumo executivo
    if (results.executiveSummary) {
      md += `## 📊 RESUMO EXECUTIVO\n\n`;
      md += JSON.stringify(results.executiveSummary, null, 2);
      md += `\n\n---\n\n`;
    }

    // Consolidação
    if (results.consolidation) {
      md += `## 🔗 CONSOLIDAÇÃO TEMÁTICA\n\n`;
      md += JSON.stringify(results.consolidation, null, 2);
      md += `\n\n---\n\n`;
    }

    // Citações
    if (results.citations && results.citations.length > 0) {
      md += `## 📑 CITAÇÕES RELEVANTES\n\n`;
      for (const citation of results.citations) {
        md += `> ${citation.text}\n`;
        md += `*Fonte: ${citation.source}*\n\n`;
      }
    }

    return md;
  }

  /**
   * Atualiza progresso
   */
  async updateProgress(step, message) {
    this.progress.currentStep = step;
    this.progress.totalSteps = 5;
    this.progress.percentage = (step / 5) * 100;
    this.progress.message = message;

    this.emit('progress', {
      jobId: this.jobId,
      progress: this.progress
    });

    console.info(`📈 Progresso: ${this.progress.percentage}%`, {
      jobId: this.jobId,
      step,
      message
    });
  }

  /**
   * Helpers
   */
  async fileExists(filePath) {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  async readDirectoryRecursive(dir) {
    const files = [];
    const entries = await fs.readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        files.push(...await this.readDirectoryRecursive(fullPath));
      } else {
        files.push(fullPath);
      }
    }

    return files;
  }

  async readFileMetadata(filePath) {
    const stats = await fs.stat(filePath);
    return {
      size: stats.size,
      modified: stats.mtimeMs,
      created: stats.birthtimeMs
    };
  }

  detectDocumentType(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    const typeMap = {
      '.pdf': 'PDF',
      '.docx': 'Word',
      '.doc': 'Word',
      '.txt': 'Texto',
      '.md': 'Markdown',
      '.json': 'JSON'
    };
    return typeMap[ext] || 'Desconhecido';
  }

  async readDocumentContent(filePath) {
    try {
      // Por enquanto, apenas ler arquivos de texto
      // TODO: Integrar com PDF extractor
      const content = await fs.readFile(filePath, 'utf8');
      return content;
    } catch (error) {
      console.warn(`Não foi possível ler ${filePath}: ${error.message}`);
      return '';
    }
  }

  async searchKBGlobal() {
    // TODO: Buscar documentos no KB global relacionados ao projeto
    return [];
  }

  /**
   * Obtém status do job
   */
  getStatus() {
    return {
      jobId: this.jobId,
      projectId: this.projectId,
      userId: this.userId,
      status: this.status,
      progress: this.progress,
      startedAt: this.startedAt,
      completedAt: this.completedAt,
      duration: this.completedAt ? this.completedAt - this.startedAt : Date.now() - this.startedAt,
      error: this.error,
      resultsAvailable: this.status === 'completed',
      exportPath: this.results.exportPath
    };
  }
}

export default ExhaustiveAnalysisJob;
