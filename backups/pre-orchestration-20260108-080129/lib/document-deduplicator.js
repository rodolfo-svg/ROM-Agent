/**
 * Document Deduplicator
 *
 * Sistema de deduplicação usando hash SHA256
 * Evita indexação de documentos duplicados no KB
 */

import crypto from 'crypto';

export class DocumentDeduplicator {
  constructor() {
    this.hashCache = new Map(); // hash -> {docId, filename, uploadedAt}
  }

  /**
   * Calcular hash SHA256 do conteúdo
   */
  calculateHash(content) {
    if (!content) {
      return null;
    }

    // Normalizar conteúdo (remover espaços extras, line breaks)
    const normalized = content
      .replace(/\s+/g, ' ')
      .trim();

    return crypto
      .createHash('sha256')
      .update(normalized)
      .digest('hex');
  }

  /**
   * Verificar se documento já existe
   */
  isDuplicate(content) {
    const hash = this.calculateHash(content);
    if (!hash) return false;

    return this.hashCache.has(hash);
  }

  /**
   * Registrar documento
   */
  register(docId, content, filename) {
    const hash = this.calculateHash(content);
    if (!hash) return null;

    this.hashCache.set(hash, {
      docId,
      filename,
      uploadedAt: new Date().toISOString(),
      contentLength: content.length
    });

    return hash;
  }

  /**
   * Obter documento original de uma duplicata
   */
  getOriginal(content) {
    const hash = this.calculateHash(content);
    if (!hash) return null;

    return this.hashCache.get(hash);
  }

  /**
   * Limpar cache
   */
  clear() {
    this.hashCache.clear();
  }

  /**
   * Estatísticas
   */
  getStats() {
    return {
      totalUnique: this.hashCache.size,
      hashes: Array.from(this.hashCache.entries()).map(([hash, info]) => ({
        hash,
        ...info
      }))
    };
  }
}

export default DocumentDeduplicator;
