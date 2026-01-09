/**
 * ROM Agent - Sistema de Versionamento de Documentos
 * Gerencia histórico de versões, diffs e restauração
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Classe para gerenciar versionamento de documentos
 */
class DocumentVersioning {
  constructor() {
    this.versionsPath = path.join(__dirname, '../data/versions.json');
    this.versions = this.loadVersions();
  }

  /**
   * Carregar versões do arquivo
   */
  loadVersions() {
    try {
      if (fs.existsSync(this.versionsPath)) {
        const data = fs.readFileSync(this.versionsPath, 'utf8');
        return JSON.parse(data);
      }
    } catch (error) {
      console.error('Erro ao carregar versões:', error);
    }
    return {};
  }

  /**
   * Salvar versões no arquivo
   */
  saveVersions() {
    try {
      const dataDir = path.dirname(this.versionsPath);
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }
      fs.writeFileSync(this.versionsPath, JSON.stringify(this.versions, null, 2));
      return { success: true };
    } catch (error) {
      console.error('Erro ao salvar versões:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Criar nova versão de um documento
   * @param {string} documentId - ID do documento
   * @param {string} content - Conteúdo do documento
   * @param {Object} metadata - Metadados (autor, comentário, etc)
   */
  createVersion(documentId, content, metadata = {}) {
    if (!this.versions[documentId]) {
      this.versions[documentId] = {
        documentId,
        createdAt: new Date().toISOString(),
        versions: []
      };
    }

    const versionNumber = this.versions[documentId].versions.length + 1;
    const contentHash = this.generateHash(content);

    // Verificar se o conteúdo mudou
    if (this.versions[documentId].versions.length > 0) {
      const lastVersion = this.versions[documentId].versions[this.versions[documentId].versions.length - 1];
      if (lastVersion.contentHash === contentHash) {
        return {
          success: false,
          message: 'Conteúdo não foi alterado desde a última versão',
          currentVersion: versionNumber - 1
        };
      }
    }

    const version = {
      version: versionNumber,
      content,
      contentHash,
      createdAt: new Date().toISOString(),
      author: metadata.author || 'Sistema',
      comment: metadata.comment || 'Versão criada automaticamente',
      size: content.length,
      metadata: metadata
    };

    this.versions[documentId].versions.push(version);
    this.versions[documentId].currentVersion = versionNumber;
    this.versions[documentId].lastModified = version.createdAt;

    this.saveVersions();

    return {
      success: true,
      version: versionNumber,
      documentId,
      createdAt: version.createdAt
    };
  }

  /**
   * Obter versão específica de um documento
   * @param {string} documentId - ID do documento
   * @param {number} version - Número da versão (null = última versão)
   */
  getVersion(documentId, version = null) {
    if (!this.versions[documentId]) {
      return { success: false, error: 'Documento não encontrado' };
    }

    const doc = this.versions[documentId];

    if (version === null) {
      version = doc.currentVersion;
    }

    const versionData = doc.versions.find(v => v.version === version);

    if (!versionData) {
      return { success: false, error: `Versão ${version} não encontrada` };
    }

    return {
      success: true,
      documentId,
      version: versionData.version,
      content: versionData.content,
      createdAt: versionData.createdAt,
      author: versionData.author,
      comment: versionData.comment,
      size: versionData.size,
      metadata: versionData.metadata
    };
  }

  /**
   * Listar todas as versões de um documento
   * @param {string} documentId - ID do documento
   */
  listVersions(documentId) {
    if (!this.versions[documentId]) {
      return { success: false, error: 'Documento não encontrado' };
    }

    const doc = this.versions[documentId];

    return {
      success: true,
      documentId,
      currentVersion: doc.currentVersion,
      totalVersions: doc.versions.length,
      versions: doc.versions.map(v => ({
        version: v.version,
        createdAt: v.createdAt,
        author: v.author,
        comment: v.comment,
        size: v.size,
        contentHash: v.contentHash
      }))
    };
  }

  /**
   * Comparar duas versões (diff)
   * @param {string} documentId - ID do documento
   * @param {number} version1 - Primeira versão
   * @param {number} version2 - Segunda versão
   */
  compareVersions(documentId, version1, version2) {
    const v1 = this.getVersion(documentId, version1);
    const v2 = this.getVersion(documentId, version2);

    if (!v1.success || !v2.success) {
      return { success: false, error: 'Uma ou ambas as versões não foram encontradas' };
    }

    // Calcular diferenças
    const diff = this.calculateDiff(v1.content, v2.content);

    return {
      success: true,
      documentId,
      version1: {
        version: v1.version,
        createdAt: v1.createdAt,
        author: v1.author
      },
      version2: {
        version: v2.version,
        createdAt: v2.createdAt,
        author: v2.author
      },
      diff,
      changes: {
        added: diff.added.length,
        removed: diff.removed.length,
        modified: diff.modified.length
      }
    };
  }

  /**
   * Restaurar versão anterior
   * @param {string} documentId - ID do documento
   * @param {number} version - Versão a ser restaurada
   * @param {Object} metadata - Metadados da restauração
   */
  restoreVersion(documentId, version, metadata = {}) {
    const versionData = this.getVersion(documentId, version);

    if (!versionData.success) {
      return versionData;
    }

    // Criar nova versão com o conteúdo restaurado
    const result = this.createVersion(
      documentId,
      versionData.content,
      {
        author: metadata.author || 'Sistema',
        comment: `Restaurado da versão ${version}`,
        restored: true,
        restoredFrom: version,
        ...metadata
      }
    );

    if (result.success) {
      return {
        success: true,
        documentId,
        restoredFrom: version,
        newVersion: result.version,
        message: `Versão ${version} restaurada como versão ${result.version}`
      };
    }

    return result;
  }

  /**
   * Excluir documento e todas as suas versões
   * @param {string} documentId - ID do documento
   */
  deleteDocument(documentId) {
    if (!this.versions[documentId]) {
      return { success: false, error: 'Documento não encontrado' };
    }

    const versionsCount = this.versions[documentId].versions.length;
    delete this.versions[documentId];
    this.saveVersions();

    return {
      success: true,
      documentId,
      deletedVersions: versionsCount,
      message: `Documento e ${versionsCount} versões excluídos`
    };
  }

  /**
   * Excluir versões antigas (manter apenas últimas N versões)
   * @param {string} documentId - ID do documento
   * @param {number} keepLast - Número de versões recentes a manter
   */
  pruneVersions(documentId, keepLast = 10) {
    if (!this.versions[documentId]) {
      return { success: false, error: 'Documento não encontrado' };
    }

    const doc = this.versions[documentId];
    const totalVersions = doc.versions.length;

    if (totalVersions <= keepLast) {
      return {
        success: true,
        documentId,
        message: 'Nenhuma versão foi removida',
        totalVersions,
        keptVersions: totalVersions
      };
    }

    // Manter apenas as últimas N versões
    doc.versions = doc.versions.slice(-keepLast);

    // Atualizar números de versão
    doc.versions.forEach((v, index) => {
      v.version = index + 1;
    });

    doc.currentVersion = doc.versions.length;
    this.saveVersions();

    return {
      success: true,
      documentId,
      totalVersions,
      keptVersions: keepLast,
      removedVersions: totalVersions - keepLast
    };
  }

  /**
   * Obter estatísticas de versionamento
   */
  getStatistics() {
    const documents = Object.keys(this.versions).length;
    let totalVersions = 0;
    let totalSize = 0;

    for (const docId in this.versions) {
      const doc = this.versions[docId];
      totalVersions += doc.versions.length;
      totalSize += doc.versions.reduce((sum, v) => sum + v.size, 0);
    }

    const avgVersionsPerDoc = documents > 0 ? Math.round(totalVersions / documents) : 0;

    return {
      totalDocuments: documents,
      totalVersions,
      avgVersionsPerDoc,
      totalSize,
      totalSizeFormatted: this.formatBytes(totalSize),
      avgSizePerVersion: totalVersions > 0 ? Math.round(totalSize / totalVersions) : 0,
      storageLocation: this.versionsPath
    };
  }

  /**
   * Gerar hash do conteúdo
   */
  generateHash(content) {
    return crypto.createHash('sha256').update(content).digest('hex').substring(0, 16);
  }

  /**
   * Calcular diff simples entre dois textos
   */
  calculateDiff(text1, text2) {
    const lines1 = text1.split('\n');
    const lines2 = text2.split('\n');

    const added = [];
    const removed = [];
    const modified = [];

    // Algoritmo simples de diff linha por linha
    const maxLines = Math.max(lines1.length, lines2.length);

    for (let i = 0; i < maxLines; i++) {
      const line1 = lines1[i];
      const line2 = lines2[i];

      if (line1 === undefined && line2 !== undefined) {
        added.push({ line: i + 1, content: line2 });
      } else if (line1 !== undefined && line2 === undefined) {
        removed.push({ line: i + 1, content: line1 });
      } else if (line1 !== line2) {
        modified.push({ line: i + 1, old: line1, new: line2 });
      }
    }

    return { added, removed, modified };
  }

  /**
   * Formatar bytes
   */
  formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  }
}

// Instância singleton
const documentVersioning = new DocumentVersioning();

export default documentVersioning;
export { DocumentVersioning };
