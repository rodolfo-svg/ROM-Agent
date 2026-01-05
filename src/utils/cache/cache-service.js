/**
 * Sistema de Cache Inteligente com Invalidação por Hash
 *
 * Estratégia:
 * - Cache persistente em disco (output/cache/)
 * - Invalidação automática quando documentos mudam (SHA256)
 * - Cache por camada (metadata, microfichamento, consolidacoes)
 * - Economia de 60% em tokens e tempo
 */

import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class CacheService {
  constructor() {
    this.initialized = false;
    this.cacheBasePath = path.join(process.cwd(), 'data', 'cache');
  }

  /**
   * Inicializar serviço de cache
   */
  async init() {
    try {
      await fs.mkdir(this.cacheBasePath, { recursive: true });
      this.initialized = true;
      console.log('✅ Cache Service inicializado:', this.cacheBasePath);
      return true;
    } catch (error) {
      console.error('❌ Erro ao inicializar Cache Service:', error);
      return false;
    }
  }

  /**
   * Gerar hash SHA256 de um arquivo usando streams (OPTIMIZED v2.7.1)
   * Evita carregar arquivo inteiro em memória - eficiente para arquivos grandes
   * @param {string} filePath - Caminho do arquivo
   * @returns {Promise<string>} Hash SHA256
   */
  async generateFileHash(filePath) {
    return new Promise((resolve, reject) => {
      try {
        const hash = crypto.createHash('sha256');
        const stream = fsSync.createReadStream(filePath);

        stream.on('data', (chunk) => {
          hash.update(chunk);
        });

        stream.on('end', () => {
          resolve(hash.digest('hex'));
        });

        stream.on('error', (error) => {
          console.error(`Erro ao gerar hash de ${filePath}:`, error);
          reject(error);
        });
      } catch (error) {
        console.error(`Erro ao gerar hash de ${filePath}:`, error);
        reject(error);
      }
    });
  }

  /**
   * Gerar hash de múltiplos arquivos (para cache de conjunto)
   * @param {string[]} filePaths - Array de caminhos
   * @returns {Promise<string>} Hash combinado
   */
  async generateMultiFileHash(filePaths) {
    try {
      const hashes = await Promise.all(
        filePaths.map(fp => this.generateFileHash(fp))
      );

      const combinedHash = hashes.filter(h => h !== null).join('-');
      return crypto.createHash('sha256').update(combinedHash).digest('hex');
    } catch (error) {
      console.error('Erro ao gerar hash múltiplo:', error);
      return null;
    }
  }

  /**
   * Obter caminho do arquivo de cache
   * @param {string} casoId - ID do caso
   * @param {string} cacheKey - Chave do cache (ex: 'metadata', 'microfichamento-layer3')
   * @returns {string} Caminho do arquivo de cache
   */
  getCachePath(casoId, cacheKey) {
    const sanitizedKey = cacheKey.replace(/[^a-z0-9-_]/gi, '-');
    return path.join(this.cacheBasePath, casoId, `${sanitizedKey}.json`);
  }

  /**
   * Verificar se cache existe e é válido
   * @param {string} casoId - ID do caso
   * @param {string} cacheKey - Chave do cache
   * @param {string|string[]} sourceFiles - Arquivo(s) fonte para validação
   * @returns {Promise<{valid: boolean, data: any}>}
   */
  async checkCache(casoId, cacheKey, sourceFiles) {
    try {
      const cachePath = this.getCachePath(casoId, cacheKey);

      // Verificar se arquivo de cache existe
      try {
        await fs.access(cachePath);
      } catch {
        return { valid: false, data: null };
      }

      // Ler cache
      const cacheContent = await fs.readFile(cachePath, 'utf-8');
      const cache = JSON.parse(cacheContent);

      // Gerar hash atual dos arquivos fonte
      const currentHash = Array.isArray(sourceFiles)
        ? await this.generateMultiFileHash(sourceFiles)
        : await this.generateFileHash(sourceFiles);

      // Validar hash
      if (cache.sourceHash === currentHash) {
        return {
          valid: true,
          data: cache.data,
          cachedAt: cache.cachedAt,
          sourceHash: cache.sourceHash
        };
      }

      return { valid: false, data: null };
    } catch (error) {
      console.error(`Erro ao verificar cache ${cacheKey}:`, error);
      return { valid: false, data: null };
    }
  }

  /**
   * Salvar dados no cache
   * @param {string} casoId - ID do caso
   * @param {string} cacheKey - Chave do cache
   * @param {any} data - Dados a cachear
   * @param {string|string[]} sourceFiles - Arquivo(s) fonte
   * @param {object} metadata - Metadados adicionais (opcional)
   * @returns {Promise<boolean>}
   */
  async saveCache(casoId, cacheKey, data, sourceFiles, metadata = {}) {
    try {
      const cachePath = this.getCachePath(casoId, cacheKey);

      // Criar diretório se não existir
      await fs.mkdir(path.dirname(cachePath), { recursive: true });

      // Gerar hash dos arquivos fonte
      const sourceHash = Array.isArray(sourceFiles)
        ? await this.generateMultiFileHash(sourceFiles)
        : await this.generateFileHash(sourceFiles);

      // Estrutura do cache
      const cacheData = {
        cacheKey,
        casoId,
        sourceHash,
        cachedAt: new Date().toISOString(),
        data,
        metadata
      };

      // Salvar arquivo
      await fs.writeFile(cachePath, JSON.stringify(cacheData, null, 2), 'utf-8');

      return true;
    } catch (error) {
      console.error(`Erro ao salvar cache ${cacheKey}:`, error);
      return false;
    }
  }

  /**
   * Limpar cache de um caso específico
   * @param {string} casoId - ID do caso
   * @returns {Promise<boolean>}
   */
  async clearCaseCache(casoId) {
    try {
      const caseCachePath = path.join(this.cacheBasePath, casoId);
      await fs.rm(caseCachePath, { recursive: true, force: true });
      console.log(`✅ Cache do caso ${casoId} limpo`);
      return true;
    } catch (error) {
      console.error(`Erro ao limpar cache do caso ${casoId}:`, error);
      return false;
    }
  }

  /**
   * Limpar cache específico
   * @param {string} casoId - ID do caso
   * @param {string} cacheKey - Chave do cache
   * @returns {Promise<boolean>}
   */
  async clearSpecificCache(casoId, cacheKey) {
    try {
      const cachePath = this.getCachePath(casoId, cacheKey);
      await fs.unlink(cachePath);
      console.log(`✅ Cache ${cacheKey} do caso ${casoId} limpo`);
      return true;
    } catch (error) {
      console.error(`Erro ao limpar cache ${cacheKey}:`, error);
      return false;
    }
  }

  /**
   * Listar todos os caches de um caso
   * @param {string} casoId - ID do caso
   * @returns {Promise<string[]>} Array de chaves de cache
   */
  async listCaseCache(casoId) {
    try {
      const caseCachePath = path.join(this.cacheBasePath, casoId);
      const files = await fs.readdir(caseCachePath);
      return files.filter(f => f.endsWith('.json')).map(f => f.replace('.json', ''));
    } catch (error) {
      return [];
    }
  }

  /**
   * Obter estatísticas do cache
   * @param {string} casoId - ID do caso (opcional)
   * @returns {Promise<object>} Estatísticas
   */
  async getStats(casoId = null) {
    try {
      if (casoId) {
        // Stats de um caso específico
        const caches = await this.listCaseCache(casoId);
        const caseCachePath = path.join(this.cacheBasePath, casoId);

        let totalSize = 0;
        const cacheDetails = [];

        for (const cacheKey of caches) {
          const cachePath = path.join(caseCachePath, `${cacheKey}.json`);
          const stats = await fs.stat(cachePath);
          const content = JSON.parse(await fs.readFile(cachePath, 'utf-8'));

          totalSize += stats.size;
          cacheDetails.push({
            key: cacheKey,
            size: stats.size,
            cachedAt: content.cachedAt,
            sourceHash: content.sourceHash
          });
        }

        return {
          casoId,
          totalCaches: caches.length,
          totalSize,
          totalSizeMB: (totalSize / 1024 / 1024).toFixed(2),
          caches: cacheDetails
        };
      } else {
        // Stats globais
        const casos = await fs.readdir(this.cacheBasePath);
        let totalCaches = 0;
        let totalSize = 0;

        for (const caso of casos) {
          const caseStats = await this.getStats(caso);
          totalCaches += caseStats.totalCaches;
          totalSize += caseStats.totalSize;
        }

        return {
          totalCasos: casos.length,
          totalCaches,
          totalSize,
          totalSizeMB: (totalSize / 1024 / 1024).toFixed(2)
        };
      }
    } catch (error) {
      console.error('Erro ao obter stats do cache:', error);
      return null;
    }
  }

  /**
   * Limpar todo o cache (usar com cuidado!)
   * @returns {Promise<boolean>}
   */
  async clearAllCache() {
    try {
      await fs.rm(this.cacheBasePath, { recursive: true, force: true });
      await fs.mkdir(this.cacheBasePath, { recursive: true });
      console.log('⚠️  TODO cache limpo!');
      return true;
    } catch (error) {
      console.error('Erro ao limpar todo cache:', error);
      return false;
    }
  }
}

// Singleton
const cacheService = new CacheService();

export default cacheService;
