/**
 * Sistema de Limpeza Automática do Knowledge Base
 *
 * Funcionalidades:
 * - Remove arquivos específicos do KB após aprovação da peça
 * - Mantém registro de peças aprovadas
 * - Limpa arquivos órfãos
 * - Gerencia espaço em disco
 */

const fs = require('fs');
const path = require('path');

class KBCleaner {
  constructor(options = {}) {
    this.kbPath = options.kbPath || path.join(__dirname, '../KB');
    this.kbDocsPath = path.join(this.kbPath, 'documents');
    this.kbIndexPath = path.join(this.kbPath, 'index.json');
    this.approvedPiecesPath = path.join(this.kbPath, 'approved_pieces.json');

    // Estatísticas
    this.stats = {
      filesDeleted: 0,
      spaceSaved: 0,
      documentsRemoved: 0
    };

    this.ensureFiles();
  }

  ensureFiles() {
    if (!fs.existsSync(this.kbPath)) {
      fs.mkdirSync(this.kbPath, { recursive: true });
    }

    // Criar registro de peças aprovadas
    if (!fs.existsSync(this.approvedPiecesPath)) {
      fs.writeFileSync(this.approvedPiecesPath, JSON.stringify({
        pieces: [],
        lastCleaned: new Date().toISOString(),
        totalSpaceSaved: 0
      }, null, 2));
    }
  }

  /**
   * Registrar peça aprovada e limpar arquivos usados
   * @param {Object} pieceData - Dados da peça aprovada
   * @returns {Object} Resultado da limpeza
   */
  approveAndCleanup(pieceData) {
    const {
      pieceId,
      pieceName,
      documentIds = [], // IDs dos documentos usados
      processNumber = null,
      partiesInfo = null,
      approvedBy,
      approvedAt = new Date().toISOString()
    } = pieceData;

    console.log(`🧹 Iniciando limpeza após aprovação da peça: ${pieceName}`);

    const cleanupResult = {
      pieceId,
      pieceName,
      documentsRemoved: 0,
      filesDeleted: 0,
      spaceSaved: 0,
      removedDocuments: []
    };

    // Remover cada documento usado
    documentIds.forEach(docId => {
      const result = this.removeDocument(docId);
      if (result.success) {
        cleanupResult.documentsRemoved++;
        cleanupResult.filesDeleted += result.filesDeleted;
        cleanupResult.spaceSaved += result.spaceSaved;
        cleanupResult.removedDocuments.push({
          docId,
          files: result.files,
          size: result.spaceSaved
        });
      }
    });

    // Registrar peça aprovada
    this.registerApprovedPiece({
      pieceId,
      pieceName,
      documentIds,
      processNumber,
      partiesInfo,
      approvedBy,
      approvedAt,
      cleanup: {
        documentsRemoved: cleanupResult.documentsRemoved,
        spaceSaved: cleanupResult.spaceSaved
      }
    });

    // Atualizar estatísticas globais
    this.stats.filesDeleted += cleanupResult.filesDeleted;
    this.stats.spaceSaved += cleanupResult.spaceSaved;
    this.stats.documentsRemoved += cleanupResult.documentsRemoved;

    console.log(`✅ Limpeza concluída: ${cleanupResult.documentsRemoved} documentos removidos, ${this.formatBytes(cleanupResult.spaceSaved)} liberados`);

    return cleanupResult;
  }

  /**
   * Remover documento específico do KB
   * @param {string} docId - ID do documento
   * @returns {Object} Resultado
   */
  removeDocument(docId) {
    const docFolder = path.join(this.kbDocsPath, docId);

    if (!fs.existsSync(docFolder)) {
      console.warn(`⚠️ Documento ${docId} não encontrado`);
      return { success: false, error: 'Documento não encontrado' };
    }

    // Calcular espaço ocupado
    let spaceSaved = 0;
    const files = [];

    const filesInFolder = fs.readdirSync(docFolder);
    filesInFolder.forEach(file => {
      const filePath = path.join(docFolder, file);
      const stats = fs.statSync(filePath);
      spaceSaved += stats.size;
      files.push({
        name: file,
        size: stats.size
      });
    });

    // Deletar pasta inteira
    fs.rmSync(docFolder, { recursive: true, force: true });

    // Remover do índice
    this.removeFromIndex(docId);

    console.log(`🗑️ Documento ${docId} removido (${files.length} arquivos, ${this.formatBytes(spaceSaved)})`);

    return {
      success: true,
      filesDeleted: files.length,
      spaceSaved,
      files
    };
  }

  /**
   * Remover documento do índice
   * @param {string} docId - ID do documento
   */
  removeFromIndex(docId) {
    if (!fs.existsSync(this.kbIndexPath)) {
      return;
    }

    const index = JSON.parse(fs.readFileSync(this.kbIndexPath, 'utf8'));

    index.documents = index.documents.filter(doc => doc.id !== docId);
    index.totalDocuments = index.documents.length;
    index.lastUpdated = new Date().toISOString();

    fs.writeFileSync(this.kbIndexPath, JSON.stringify(index, null, 2));
  }

  /**
   * Registrar peça aprovada
   * @param {Object} pieceData - Dados da peça
   */
  registerApprovedPiece(pieceData) {
    const approved = JSON.parse(fs.readFileSync(this.approvedPiecesPath, 'utf8'));

    approved.pieces.push({
      ...pieceData,
      registeredAt: new Date().toISOString()
    });

    approved.lastCleaned = new Date().toISOString();
    approved.totalSpaceSaved += pieceData.cleanup.spaceSaved;

    fs.writeFileSync(this.approvedPiecesPath, JSON.stringify(approved, null, 2));
  }

  /**
   * Limpar arquivos órfãos (documentos sem referência no índice)
   * @returns {Object} Resultado
   */
  cleanOrphanedFiles() {
    console.log('🔍 Buscando arquivos órfãos...');

    if (!fs.existsSync(this.kbDocsPath)) {
      return { orphansFound: 0, orphansRemoved: 0 };
    }

    // Obter todos os documentos no índice
    let indexedDocs = new Set();
    if (fs.existsSync(this.kbIndexPath)) {
      const index = JSON.parse(fs.readFileSync(this.kbIndexPath, 'utf8'));
      indexedDocs = new Set(index.documents.map(doc => doc.id));
    }

    // Verificar pastas na KB/documents
    const folders = fs.readdirSync(this.kbDocsPath);
    const orphans = folders.filter(folder => !indexedDocs.has(folder));

    console.log(`📊 Encontrados ${orphans.length} documentos órfãos`);

    let totalSpaceSaved = 0;
    let filesDeleted = 0;

    orphans.forEach(docId => {
      const result = this.removeDocument(docId);
      if (result.success) {
        totalSpaceSaved += result.spaceSaved;
        filesDeleted += result.filesDeleted;
      }
    });

    console.log(`✅ Limpeza de órfãos concluída: ${orphans.length} documentos, ${this.formatBytes(totalSpaceSaved)} liberados`);

    return {
      orphansFound: orphans.length,
      orphansRemoved: orphans.length,
      spaceSaved: totalSpaceSaved,
      filesDeleted
    };
  }

  /**
   * Limpar documentos antigos (mais de X dias)
   * @param {number} daysOld - Dias de idade
   * @returns {Object} Resultado
   */
  cleanOldDocuments(daysOld = 30) {
    console.log(`🔍 Buscando documentos com mais de ${daysOld} dias...`);

    if (!fs.existsSync(this.kbIndexPath)) {
      return { oldDocsFound: 0, oldDocsRemoved: 0 };
    }

    const index = JSON.parse(fs.readFileSync(this.kbIndexPath, 'utf8'));
    const now = new Date();
    const cutoffDate = new Date(now.getTime() - (daysOld * 24 * 60 * 60 * 1000));

    const oldDocs = index.documents.filter(doc => {
      const uploadDate = new Date(doc.uploadedAt);
      return uploadDate < cutoffDate;
    });

    console.log(`📊 Encontrados ${oldDocs.length} documentos antigos`);

    let totalSpaceSaved = 0;
    let filesDeleted = 0;

    oldDocs.forEach(doc => {
      const result = this.removeDocument(doc.id);
      if (result.success) {
        totalSpaceSaved += result.spaceSaved;
        filesDeleted += result.filesDeleted;
      }
    });

    console.log(`✅ Limpeza de documentos antigos concluída: ${oldDocs.length} documentos, ${this.formatBytes(totalSpaceSaved)} liberados`);

    return {
      oldDocsFound: oldDocs.length,
      oldDocsRemoved: oldDocs.length,
      spaceSaved: totalSpaceSaved,
      filesDeleted
    };
  }

  /**
   * Obter peças aprovadas
   * @param {Object} filters - Filtros
   * @returns {Array} Peças aprovadas
   */
  getApprovedPieces(filters = {}) {
    const approved = JSON.parse(fs.readFileSync(this.approvedPiecesPath, 'utf8'));

    let pieces = approved.pieces;

    // Filtrar por processo
    if (filters.processNumber) {
      pieces = pieces.filter(p => p.processNumber === filters.processNumber);
    }

    // Filtrar por usuário
    if (filters.approvedBy) {
      pieces = pieces.filter(p => p.approvedBy === filters.approvedBy);
    }

    // Filtrar por data
    if (filters.dateFrom) {
      const dateFrom = new Date(filters.dateFrom);
      pieces = pieces.filter(p => new Date(p.approvedAt) >= dateFrom);
    }

    if (filters.dateTo) {
      const dateTo = new Date(filters.dateTo);
      pieces = pieces.filter(p => new Date(p.approvedAt) <= dateTo);
    }

    return pieces;
  }

  /**
   * Obter estatísticas do KB
   * @returns {Object} Estatísticas
   */
  getStatistics() {
    // Estatísticas do índice
    let totalDocs = 0;
    let totalSize = 0;

    if (fs.existsSync(this.kbIndexPath)) {
      const index = JSON.parse(fs.readFileSync(this.kbIndexPath, 'utf8'));
      totalDocs = index.totalDocuments;
    }

    // Calcular tamanho total em disco
    if (fs.existsSync(this.kbDocsPath)) {
      const folders = fs.readdirSync(this.kbDocsPath);
      folders.forEach(folder => {
        const folderPath = path.join(this.kbDocsPath, folder);
        const files = fs.readdirSync(folderPath);
        files.forEach(file => {
          const filePath = path.join(folderPath, file);
          try {
            const stats = fs.statSync(filePath);
            totalSize += stats.size;
          } catch (err) {
            // Ignorar erros
          }
        });
      });
    }

    // Estatísticas de peças aprovadas
    const approved = JSON.parse(fs.readFileSync(this.approvedPiecesPath, 'utf8'));

    return {
      kb: {
        totalDocuments: totalDocs,
        totalSize: this.formatBytes(totalSize),
        totalSizeBytes: totalSize
      },
      approved: {
        totalPieces: approved.pieces.length,
        totalSpaceSaved: this.formatBytes(approved.totalSpaceSaved),
        lastCleaned: approved.lastCleaned
      },
      session: {
        filesDeleted: this.stats.filesDeleted,
        documentsRemoved: this.stats.documentsRemoved,
        spaceSaved: this.formatBytes(this.stats.spaceSaved)
      }
    };
  }

  /**
   * Formatar bytes em formato legível
   * @param {number} bytes
   * @returns {string}
   */
  formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Agendar limpeza automática
   * @param {Object} options - Opções de agendamento
   */
  scheduleAutoCleaning(options = {}) {
    const {
      cleanOrphans = true,
      orphansInterval = 24 * 60 * 60 * 1000, // 24h
      cleanOldDocs = false,
      oldDocsInterval = 7 * 24 * 60 * 60 * 1000, // 7 dias
      oldDocsAge = 30 // dias
    } = options;

    console.log('📅 Agendando limpeza automática do KB');

    // Limpeza de órfãos
    if (cleanOrphans) {
      setInterval(() => {
        console.log('🕐 Executando limpeza automática de órfãos...');
        this.cleanOrphanedFiles();
      }, orphansInterval);

      // Executar primeira limpeza
      setTimeout(() => this.cleanOrphanedFiles(), 5000);
    }

    // Limpeza de documentos antigos
    if (cleanOldDocs) {
      setInterval(() => {
        console.log('🕐 Executando limpeza automática de documentos antigos...');
        this.cleanOldDocuments(oldDocsAge);
      }, oldDocsInterval);
    }
  }
}

/**
 * Exemplo de uso:
 *
 * const cleaner = new KBCleaner();
 *
 * // Ao aprovar uma peça
 * cleaner.approveAndCleanup({
 *   pieceId: 'piece-123',
 *   pieceName: 'Petição Inicial - João da Silva',
 *   documentIds: ['doc-123', 'doc-456'], // Docs usados
 *   processNumber: '1234567-12.2025.8.02.0001',
 *   partiesInfo: { author: 'João da Silva', defendant: 'Maria Santos' },
 *   approvedBy: 'user-001',
 *   approvedAt: new Date().toISOString()
 * });
 *
 * // Limpeza de órfãos
 * cleaner.cleanOrphanedFiles();
 *
 * // Limpeza de documentos antigos
 * cleaner.cleanOldDocuments(30); // mais de 30 dias
 *
 * // Estatísticas
 * const stats = cleaner.getStatistics();
 */

module.exports = KBCleaner;
