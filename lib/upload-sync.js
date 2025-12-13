/**
 * Sistema de Upload e Sincronização Automática
 *
 * Funcionalidades:
 * - Monitora pasta no Desktop (local de origem)
 * - Detecta novos arquivos automaticamente
 * - Processa arquivos SEM usar tokens (via worker)
 * - Sincroniza para KB do projeto automaticamente
 * - Indexa para busca rápida
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const chokidar = require('chokidar');
const ParallelProcessor = require('./parallel-processor.js');

class UploadSync {
  constructor(options = {}) {
    // Caminhos
    this.desktopPath = path.join(os.homedir(), 'Desktop');
    this.uploadFolderName = options.uploadFolderName || 'ROM_Upload';
    this.uploadPath = path.join(this.desktopPath, this.uploadFolderName);

    this.kbPath = options.kbPath || path.join(__dirname, '../KB');
    this.kbDocsPath = path.join(this.kbPath, 'documents');
    this.kbIndexPath = path.join(this.kbPath, 'index.json');

    // Processador paralelo
    this.processor = new ParallelProcessor({ numWorkers: 8 });

    // Estado
    this.watcher = null;
    this.processing = new Map();
    this.processedFiles = new Set();

    // Estatísticas
    this.stats = {
      filesUploaded: 0,
      filesProcessed: 0,
      filesFailed: 0,
      totalBytes: 0
    };

    this.ensureDirectories();
  }

  /**
   * Garantir que diretórios existam
   */
  ensureDirectories() {
    // Criar pasta de upload no Desktop
    if (!fs.existsSync(this.uploadPath)) {
      fs.mkdirSync(this.uploadPath, { recursive: true });
      console.log(`📁 Pasta de upload criada: ${this.uploadPath}`);

      // Criar arquivo README
      const readmeContent = `# ROM Agent - Pasta de Upload Automático

Esta pasta é monitorada automaticamente pelo ROM Agent.

## Como usar:
1. Arraste ou copie arquivos para esta pasta
2. O sistema detectará automaticamente
3. Arquivos serão processados SEM usar tokens da API
4. Conteúdo extraído será indexado no Knowledge Base
5. Você poderá buscar e usar os documentos no ROM Agent

## Tipos de arquivo suportados:
- PDF (.pdf)
- Word (.docx, .doc)
- Texto (.txt)

## Status:
✅ Monitoramento ATIVO
🔄 Sincronização automática para KB

## Notas:
- Arquivos processados permanecem aqui
- Não há limite de tamanho (mas arquivos muito grandes podem demorar)
- Processamento é feito localmente (sem usar API)
`;

      fs.writeFileSync(
        path.join(this.uploadPath, 'README.md'),
        readmeContent
      );
    }

    // Criar diretórios do KB
    if (!fs.existsSync(this.kbPath)) {
      fs.mkdirSync(this.kbPath, { recursive: true });
    }

    if (!fs.existsSync(this.kbDocsPath)) {
      fs.mkdirSync(this.kbDocsPath, { recursive: true });
    }

    // Criar índice se não existir
    if (!fs.existsSync(this.kbIndexPath)) {
      fs.writeFileSync(this.kbIndexPath, JSON.stringify({
        documents: [],
        lastUpdated: new Date().toISOString(),
        totalDocuments: 0
      }, null, 2));
    }
  }

  /**
   * Iniciar monitoramento
   */
  async start() {
    console.log(`🚀 Iniciando monitoramento de upload...`);
    console.log(`📂 Pasta monitorada: ${this.uploadPath}`);
    console.log(`💾 KB de destino: ${this.kbPath}`);

    // Inicializar processador paralelo
    await this.processor.initialize();

    // Configurar watcher
    this.watcher = chokidar.watch(this.uploadPath, {
      ignored: /(^|[\/\\])\../, // Ignorar arquivos ocultos
      persistent: true,
      ignoreInitial: false,
      awaitWriteFinish: {
        stabilityThreshold: 2000, // Aguardar 2s após última modificação
        pollInterval: 100
      }
    });

    // Eventos do watcher
    this.watcher
      .on('add', filePath => this.handleFileAdded(filePath))
      .on('change', filePath => this.handleFileChanged(filePath))
      .on('unlink', filePath => this.handleFileRemoved(filePath))
      .on('error', error => console.error(`❌ Erro no watcher:`, error));

    console.log(`✅ Monitoramento iniciado`);
  }

  /**
   * Arquivo adicionado
   * @param {string} filePath
   */
  async handleFileAdded(filePath) {
    // Ignorar README e arquivos já processados
    if (path.basename(filePath) === 'README.md') {
      return;
    }

    if (this.processedFiles.has(filePath)) {
      return;
    }

    // Verificar se é tipo suportado
    const ext = path.extname(filePath).toLowerCase();
    if (!['.pdf', '.docx', '.doc', '.txt'].includes(ext)) {
      console.log(`⚠️ Tipo de arquivo não suportado ignorado: ${path.basename(filePath)}`);
      return;
    }

    console.log(`📥 Novo arquivo detectado: ${path.basename(filePath)}`);

    await this.processFile(filePath);
  }

  /**
   * Arquivo modificado
   * @param {string} filePath
   */
  async handleFileChanged(filePath) {
    console.log(`🔄 Arquivo modificado: ${path.basename(filePath)}`);

    // Reprocessar arquivo
    this.processedFiles.delete(filePath);
    await this.processFile(filePath);
  }

  /**
   * Arquivo removido
   * @param {string} filePath
   */
  handleFileRemoved(filePath) {
    console.log(`🗑️ Arquivo removido: ${path.basename(filePath)}`);

    this.processedFiles.delete(filePath);

    // Remover do índice
    this.removeFromIndex(filePath);
  }

  /**
   * Processar arquivo
   * @param {string} filePath
   */
  async processFile(filePath) {
    if (this.processing.has(filePath)) {
      console.log(`⏳ Arquivo já está sendo processado: ${path.basename(filePath)}`);
      return;
    }

    this.processing.set(filePath, true);

    try {
      const startTime = Date.now();
      const fileSize = fs.statSync(filePath).size;

      console.log(`🔨 Processando: ${path.basename(filePath)} (${(fileSize / 1024).toFixed(2)} KB)`);

      // Determinar tipo de processamento
      const ext = path.extname(filePath).toLowerCase();
      let taskType;

      if (ext === '.pdf') {
        taskType = 'extract_pdf';
      } else if (ext === '.docx' || ext === '.doc') {
        taskType = 'extract_docx';
      } else if (ext === '.txt') {
        taskType = 'extract_txt';
      }

      // Processar via worker (SEM usar tokens da API)
      const result = await this.processor.addTask({
        type: taskType,
        data: { filePath }
      });

      // Analisar texto extraído
      const analysis = await this.processor.addTask({
        type: 'analyze_text',
        data: { text: result.text }
      });

      // Salvar no KB
      await this.saveToKB(filePath, result, analysis);

      // Indexar
      await this.addToIndex(filePath, result, analysis);

      const processingTime = Date.now() - startTime;

      console.log(`✅ Processado com sucesso: ${path.basename(filePath)} (${processingTime}ms)`);

      this.stats.filesProcessed++;
      this.stats.filesUploaded++;
      this.stats.totalBytes += fileSize;
      this.processedFiles.add(filePath);
    } catch (error) {
      console.error(`❌ Erro ao processar ${path.basename(filePath)}:`, error.message);
      this.stats.filesFailed++;
    } finally {
      this.processing.delete(filePath);
    }
  }

  /**
   * Salvar arquivo processado no KB
   * @param {string} originalPath
   * @param {Object} extractedData
   * @param {Object} analysis
   */
  async saveToKB(originalPath, extractedData, analysis) {
    const fileName = path.basename(originalPath);
    const docId = `doc-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const docFolder = path.join(this.kbDocsPath, docId);

    // Criar pasta do documento
    fs.mkdirSync(docFolder, { recursive: true });

    // Copiar arquivo original
    const destPath = path.join(docFolder, fileName);
    fs.copyFileSync(originalPath, destPath);

    // Salvar texto extraído
    const textPath = path.join(docFolder, 'extracted.txt');
    fs.writeFileSync(textPath, extractedData.text);

    // Salvar metadados
    const metadataPath = path.join(docFolder, 'metadata.json');
    fs.writeFileSync(metadataPath, JSON.stringify({
      id: docId,
      originalFile: fileName,
      originalPath,
      extractedAt: new Date().toISOString(),
      fileSize: fs.statSync(originalPath).size,
      pageCount: extractedData.pages || null,
      wordCount: analysis.statistics.wordCount,
      charCount: analysis.statistics.charCount,
      extracted: analysis.extracted,
      statistics: analysis.statistics
    }, null, 2));

    console.log(`💾 Salvo no KB: ${docId}`);
  }

  /**
   * Adicionar ao índice
   * @param {string} filePath
   * @param {Object} extractedData
   * @param {Object} analysis
   */
  async addToIndex(filePath, extractedData, analysis) {
    const index = JSON.parse(fs.readFileSync(this.kbIndexPath, 'utf8'));

    const fileName = path.basename(filePath);
    const docId = `doc-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Criar entrada no índice
    const indexEntry = {
      id: docId,
      fileName,
      filePath,
      uploadedAt: new Date().toISOString(),
      fileSize: fs.statSync(filePath).size,
      type: path.extname(filePath).toLowerCase().substring(1),
      wordCount: analysis.statistics.wordCount,
      // Criar "snippets" para busca
      snippets: this.createSnippets(extractedData.text, 5),
      // Tags baseadas na análise
      tags: this.generateTags(analysis),
      // Metadata para busca
      metadata: {
        processNumbers: analysis.extracted.processNumbers,
        tribunals: analysis.extracted.tribunais,
        articles: analysis.extracted.artigos,
        dates: analysis.extracted.dates
      }
    };

    // Adicionar ao índice
    index.documents.push(indexEntry);
    index.totalDocuments = index.documents.length;
    index.lastUpdated = new Date().toISOString();

    fs.writeFileSync(this.kbIndexPath, JSON.stringify(index, null, 2));

    console.log(`📇 Indexado: ${fileName}`);
  }

  /**
   * Remover do índice
   * @param {string} filePath
   */
  removeFromIndex(filePath) {
    const index = JSON.parse(fs.readFileSync(this.kbIndexPath, 'utf8'));

    index.documents = index.documents.filter(doc => doc.filePath !== filePath);
    index.totalDocuments = index.documents.length;
    index.lastUpdated = new Date().toISOString();

    fs.writeFileSync(this.kbIndexPath, JSON.stringify(index, null, 2));
  }

  /**
   * Criar snippets para busca
   * @param {string} text
   * @param {number} count
   * @returns {Array} Snippets
   */
  createSnippets(text, count = 5) {
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 20);

    // Pegar primeiras sentenças
    return sentences.slice(0, count).map(s => s.trim());
  }

  /**
   * Gerar tags baseadas na análise
   * @param {Object} analysis
   * @returns {Array} Tags
   */
  generateTags(analysis) {
    const tags = [];

    // Tags baseadas em tribunais
    if (analysis.extracted.tribunais.length > 0) {
      tags.push(...analysis.extracted.tribunais.map(t => `tribunal:${t}`));
    }

    // Tags baseadas em tipo de documento (inferido)
    const text = analysis.extracted;

    if (text.processNumbers && text.processNumbers.length > 0) {
      tags.push('processo');
    }

    if (text.artigos && text.artigos.length > 0) {
      tags.push('legislacao');
    }

    // Tags genéricas
    if (analysis.statistics.wordCount > 5000) {
      tags.push('documento-longo');
    } else if (analysis.statistics.wordCount < 500) {
      tags.push('documento-curto');
    }

    return tags;
  }

  /**
   * Buscar documento no índice
   * @param {string} query
   * @returns {Array} Resultados
   */
  search(query) {
    const index = JSON.parse(fs.readFileSync(this.kbIndexPath, 'utf8'));

    const lowerQuery = query.toLowerCase();

    return index.documents.filter(doc => {
      // Buscar no nome do arquivo
      if (doc.fileName.toLowerCase().includes(lowerQuery)) {
        return true;
      }

      // Buscar nos snippets
      if (doc.snippets.some(s => s.toLowerCase().includes(lowerQuery))) {
        return true;
      }

      // Buscar nas tags
      if (doc.tags.some(t => t.toLowerCase().includes(lowerQuery))) {
        return true;
      }

      // Buscar em números de processo
      if (doc.metadata.processNumbers.some(p => p.includes(query))) {
        return true;
      }

      return false;
    });
  }

  /**
   * Obter estatísticas
   * @returns {Object} Estatísticas
   */
  getStatistics() {
    const index = JSON.parse(fs.readFileSync(this.kbIndexPath, 'utf8'));

    return {
      uploadFolder: this.uploadPath,
      kbFolder: this.kbPath,
      filesInKB: index.totalDocuments,
      filesUploaded: this.stats.filesUploaded,
      filesProcessed: this.stats.filesProcessed,
      filesFailed: this.stats.filesFailed,
      totalBytes: this.stats.totalBytes,
      totalMB: (this.stats.totalBytes / 1024 / 1024).toFixed(2),
      processing: this.processing.size,
      lastUpdate: index.lastUpdated
    };
  }

  /**
   * Parar monitoramento
   */
  async stop() {
    console.log('🛑 Parando monitoramento...');

    if (this.watcher) {
      await this.watcher.close();
    }

    await this.processor.shutdown();

    console.log('✅ Monitoramento parado');
  }
}

module.exports = UploadSync;
