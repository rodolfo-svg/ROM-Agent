/**
 * ROM Agent - Cache de Análises JSON
 *
 * Evita reprocessar decisões idênticas reduzindo custos de Bedrock.
 *
 * BENEFÍCIOS:
 * - Cache de 24h para ementas idênticas
 * - Economia de 100% em análises repetidas
 * - Persistent storage em disco (sobrevive a reinícios)
 * - LRU eviction para limitar tamanho
 *
 * USO TÍPICO:
 * - Jurisprudência: mesma ementa analisada múltiplas vezes
 * - Decisões recorrentes em diferentes processos
 * - Análises batch de decisões similares
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { logger } from './logger.js';

const CACHE_DIR = path.join(process.cwd(), 'data', 'cache', 'analyses');
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 horas
const MAX_CACHE_SIZE = 10000; // Máximo de 10k análises em cache
const CACHE_INDEX_FILE = path.join(CACHE_DIR, 'index.json');

// Stats
let cacheHits = 0;
let cacheMisses = 0;
let cacheWrites = 0;

/**
 * Garantir que diretório de cache existe
 */
function ensureCacheDir() {
  if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
    logger.info('[AnalysisCache] Cache directory created', { path: CACHE_DIR });
  }
}

/**
 * Gerar hash MD5 de uma ementa
 */
export function generateHash(ementaCompleta) {
  if (!ementaCompleta || typeof ementaCompleta !== 'string') {
    return null;
  }

  // Normalizar: lowercase + remover espaços extras
  const normalized = ementaCompleta.toLowerCase().replace(/\s+/g, ' ').trim();

  return crypto
    .createHash('md5')
    .update(normalized)
    .digest('hex');
}

/**
 * Carregar índice de cache
 */
function loadCacheIndex() {
  try {
    if (fs.existsSync(CACHE_INDEX_FILE)) {
      const data = fs.readFileSync(CACHE_INDEX_FILE, 'utf-8');
      const index = JSON.parse(data);
      return index;
    }
  } catch (error) {
    logger.warn('[AnalysisCache] Failed to load index', { error: error.message });
  }

  return {
    entries: {},
    totalEntries: 0,
    createdAt: new Date().toISOString()
  };
}

/**
 * Salvar índice de cache
 */
function saveCacheIndex(index) {
  try {
    ensureCacheDir();
    fs.writeFileSync(CACHE_INDEX_FILE, JSON.stringify(index, null, 2));
  } catch (error) {
    logger.error('[AnalysisCache] Failed to save index', { error: error.message });
  }
}

/**
 * Obter análise do cache
 *
 * @param {string} ementaHash - Hash MD5 da ementa
 * @returns {Object|null} Análise cached ou null
 */
export function getCachedAnalysis(ementaHash) {
  if (!ementaHash) {
    return null;
  }

  ensureCacheDir();

  try {
    // Verificar índice primeiro
    const index = loadCacheIndex();

    if (!index.entries[ementaHash]) {
      cacheMisses++;
      return null;
    }

    const entry = index.entries[ementaHash];

    // Verificar TTL
    const age = Date.now() - new Date(entry.cachedAt).getTime();
    if (age > CACHE_TTL) {
      logger.debug('[AnalysisCache] Entry expired', {
        hash: ementaHash.substring(0, 8),
        age: Math.round(age / 1000 / 60 / 60) + 'h'
      });

      // Remover entrada expirada
      delete index.entries[ementaHash];
      index.totalEntries--;
      saveCacheIndex(index);

      cacheMisses++;
      return null;
    }

    // Carregar análise do arquivo
    const cacheFile = path.join(CACHE_DIR, `${ementaHash}.json`);

    if (!fs.existsSync(cacheFile)) {
      logger.warn('[AnalysisCache] Index points to missing file', {
        hash: ementaHash.substring(0, 8)
      });

      delete index.entries[ementaHash];
      index.totalEntries--;
      saveCacheIndex(index);

      cacheMisses++;
      return null;
    }

    const data = fs.readFileSync(cacheFile, 'utf-8');
    const cached = JSON.parse(data);

    // Atualizar lastAccessed
    entry.lastAccessed = new Date().toISOString();
    entry.hits++;
    saveCacheIndex(index);

    cacheHits++;

    logger.info('[AnalysisCache] HIT', {
      hash: ementaHash.substring(0, 8),
      age: Math.round(age / 1000 / 60) + 'min',
      hits: entry.hits
    });

    return cached.analise;
  } catch (error) {
    logger.error('[AnalysisCache] Failed to get cached analysis', {
      error: error.message,
      hash: ementaHash.substring(0, 8)
    });

    cacheMisses++;
    return null;
  }
}

/**
 * Salvar análise no cache
 *
 * @param {string} ementaHash - Hash MD5 da ementa
 * @param {Object} analise - Análise estruturada
 * @param {Object} metadata - Metadata adicional
 */
export function setCachedAnalysis(ementaHash, analise, metadata = {}) {
  if (!ementaHash || !analise) {
    return;
  }

  ensureCacheDir();

  try {
    // Carregar índice
    let index = loadCacheIndex();

    // Verificar se precisa fazer LRU eviction
    if (index.totalEntries >= MAX_CACHE_SIZE) {
      logger.info('[AnalysisCache] Max size reached, evicting LRU entries');
      index = evictLRUEntries(index, Math.floor(MAX_CACHE_SIZE * 0.1)); // Remover 10%
    }

    // Salvar análise em arquivo
    const cacheFile = path.join(CACHE_DIR, `${ementaHash}.json`);

    const cacheData = {
      ementaHash,
      analise,
      metadata,
      cachedAt: new Date().toISOString(),
      version: '1.0'
    };

    fs.writeFileSync(cacheFile, JSON.stringify(cacheData, null, 2));

    // Atualizar índice
    index.entries[ementaHash] = {
      hash: ementaHash,
      cachedAt: cacheData.cachedAt,
      lastAccessed: cacheData.cachedAt,
      hits: 0,
      size: Buffer.byteLength(JSON.stringify(cacheData))
    };

    index.totalEntries = Object.keys(index.entries).length;
    saveCacheIndex(index);

    cacheWrites++;

    logger.debug('[AnalysisCache] Cached', {
      hash: ementaHash.substring(0, 8),
      size: Math.round(index.entries[ementaHash].size / 1024) + 'KB'
    });
  } catch (error) {
    logger.error('[AnalysisCache] Failed to cache analysis', {
      error: error.message,
      hash: ementaHash.substring(0, 8)
    });
  }
}

/**
 * Remover entradas LRU (Least Recently Used)
 */
function evictLRUEntries(index, count) {
  const entries = Object.values(index.entries);

  // Ordenar por lastAccessed (mais antigos primeiro)
  entries.sort((a, b) => {
    return new Date(a.lastAccessed).getTime() - new Date(b.lastAccessed).getTime();
  });

  // Remover count entradas
  const toRemove = entries.slice(0, count);

  for (const entry of toRemove) {
    // Remover arquivo
    const cacheFile = path.join(CACHE_DIR, `${entry.hash}.json`);
    try {
      if (fs.existsSync(cacheFile)) {
        fs.unlinkSync(cacheFile);
      }
    } catch (error) {
      logger.warn('[AnalysisCache] Failed to delete cache file', {
        hash: entry.hash.substring(0, 8),
        error: error.message
      });
    }

    // Remover do índice
    delete index.entries[entry.hash];
  }

  index.totalEntries = Object.keys(index.entries).length;

  logger.info('[AnalysisCache] Evicted LRU entries', {
    evicted: toRemove.length,
    remaining: index.totalEntries
  });

  return index;
}

/**
 * Limpar entradas expiradas
 */
export function cleanExpiredEntries() {
  ensureCacheDir();

  try {
    const index = loadCacheIndex();
    let cleaned = 0;

    const now = Date.now();

    for (const [hash, entry] of Object.entries(index.entries)) {
      const age = now - new Date(entry.cachedAt).getTime();

      if (age > CACHE_TTL) {
        // Remover arquivo
        const cacheFile = path.join(CACHE_DIR, `${hash}.json`);
        if (fs.existsSync(cacheFile)) {
          fs.unlinkSync(cacheFile);
        }

        // Remover do índice
        delete index.entries[hash];
        cleaned++;
      }
    }

    if (cleaned > 0) {
      index.totalEntries = Object.keys(index.entries).length;
      saveCacheIndex(index);

      logger.info('[AnalysisCache] Cleaned expired entries', {
        cleaned,
        remaining: index.totalEntries
      });
    }

    return cleaned;
  } catch (error) {
    logger.error('[AnalysisCache] Failed to clean expired entries', {
      error: error.message
    });
    return 0;
  }
}

/**
 * Obter estatísticas do cache
 */
export function getCacheStats() {
  ensureCacheDir();

  try {
    const index = loadCacheIndex();

    const entries = Object.values(index.entries);
    const totalSize = entries.reduce((sum, e) => sum + (e.size || 0), 0);
    const avgHits = entries.length > 0
      ? entries.reduce((sum, e) => sum + (e.hits || 0), 0) / entries.length
      : 0;

    const hitRate = (cacheHits + cacheMisses) > 0
      ? ((cacheHits / (cacheHits + cacheMisses)) * 100).toFixed(1)
      : 0;

    return {
      totalEntries: index.totalEntries,
      maxEntries: MAX_CACHE_SIZE,
      utilizationPct: ((index.totalEntries / MAX_CACHE_SIZE) * 100).toFixed(1),
      totalSizeMB: (totalSize / 1024 / 1024).toFixed(2),
      avgHits: avgHits.toFixed(1),
      cacheHits,
      cacheMisses,
      cacheWrites,
      hitRate: parseFloat(hitRate),
      ttlHours: CACHE_TTL / 1000 / 60 / 60,
      oldestEntry: entries.length > 0
        ? entries.sort((a, b) => new Date(a.cachedAt).getTime() - new Date(b.cachedAt).getTime())[0].cachedAt
        : null,
      newestEntry: entries.length > 0
        ? entries.sort((a, b) => new Date(b.cachedAt).getTime() - new Date(a.cachedAt).getTime())[0].cachedAt
        : null
    };
  } catch (error) {
    logger.error('[AnalysisCache] Failed to get stats', { error: error.message });
    return {
      totalEntries: 0,
      error: error.message
    };
  }
}

/**
 * Limpar todo o cache
 */
export function clearCache() {
  ensureCacheDir();

  try {
    const index = loadCacheIndex();
    let cleared = 0;

    // Remover todos os arquivos
    for (const hash of Object.keys(index.entries)) {
      const cacheFile = path.join(CACHE_DIR, `${hash}.json`);
      if (fs.existsSync(cacheFile)) {
        fs.unlinkSync(cacheFile);
        cleared++;
      }
    }

    // Resetar índice
    const newIndex = {
      entries: {},
      totalEntries: 0,
      createdAt: new Date().toISOString()
    };
    saveCacheIndex(newIndex);

    // Resetar stats
    cacheHits = 0;
    cacheMisses = 0;
    cacheWrites = 0;

    logger.info('[AnalysisCache] Cache cleared', { cleared });

    return cleared;
  } catch (error) {
    logger.error('[AnalysisCache] Failed to clear cache', { error: error.message });
    return 0;
  }
}

export default {
  generateHash,
  getCachedAnalysis,
  setCachedAnalysis,
  cleanExpiredEntries,
  getCacheStats,
  clearCache
};
