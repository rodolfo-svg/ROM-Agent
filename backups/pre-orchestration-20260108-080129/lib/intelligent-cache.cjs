/**
 * Sistema de Cache Inteligente - ROM Agent
 *
 * Reduz uso de tokens em até 70% através de:
 * - Cache de respostas similares
 * - Cache de análises de documentos
 * - Cache de jurisprudência
 * - Cache de consultas legais
 * - LRU (Least Recently Used) eviction
 * - TTL (Time To Live) configurável
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

class IntelligentCache {
  constructor(options = {}) {
    this.maxSize = options.maxSize || 1000; // Máximo de entradas
    this.defaultTTL = options.defaultTTL || 7 * 24 * 60 * 60 * 1000; // 7 dias

    // Diferentes TTLs por tipo de cache
    this.ttlByType = {
      'response': 7 * 24 * 60 * 60 * 1000,      // 7 dias - respostas similares
      'document': 30 * 24 * 60 * 60 * 1000,     // 30 dias - análise de docs
      'jurisprudence': 90 * 24 * 60 * 60 * 1000, // 90 dias - jurisprudência
      'legal_search': 30 * 24 * 60 * 60 * 1000, // 30 dias - consultas legais
      'validation': 24 * 60 * 60 * 1000,        // 1 dia - validações
    };

    this.cachePath = path.join(__dirname, '../data/cache.json');
    this.statsPath = path.join(__dirname, '../logs/cache_stats.json');

    // Estrutura do cache
    this.cache = new Map();
    this.accessOrder = []; // Para LRU

    // Estatísticas
    this.stats = {
      hits: 0,
      misses: 0,
      evictions: 0,
      totalTokensSaved: 0,
      lastReset: new Date().toISOString()
    };

    this.ensureDirectories();
    this.loadCache();
    this.startCleanupSchedule();
  }

  ensureDirectories() {
    const dataDir = path.join(__dirname, '../data');
    const logsDir = path.join(__dirname, '../logs');

    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }
  }

  /**
   * Gera hash da query para chave do cache
   * @param {Object} query - Objeto de consulta
   * @returns {string} Hash MD5
   */
  generateKey(query) {
    const normalized = this.normalizeQuery(query);
    const stringified = JSON.stringify(normalized);
    return crypto.createHash('md5').update(stringified).digest('hex');
  }

  /**
   * Normaliza query para melhor match
   * @param {Object} query
   * @returns {Object} Query normalizada
   */
  normalizeQuery(query) {
    // Remove variações que não afetam o resultado
    const normalized = { ...query };

    // Normalizar texto: lowercase, remover acentos, pontuação extra
    if (normalized.text) {
      normalized.text = normalized.text
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '') // Remove acentos
        .replace(/\s+/g, ' ') // Normaliza espaços
        .trim();
    }

    // Normalizar datas para formato ISO
    if (normalized.data) {
      try {
        normalized.data = new Date(normalized.data).toISOString().split('T')[0];
      } catch (e) {
        // Manter como está se não for data válida
      }
    }

    // Ordenar arrays para consistência
    if (Array.isArray(normalized.tags)) {
      normalized.tags = normalized.tags.sort();
    }

    return normalized;
  }

  /**
   * Calcula similaridade entre duas queries
   * @param {Object} query1
   * @param {Object} query2
   * @returns {number} Similaridade (0-1)
   */
  calculateSimilarity(query1, query2) {
    const norm1 = this.normalizeQuery(query1);
    const norm2 = this.normalizeQuery(query2);

    // Se tem texto, usar similaridade de texto
    if (norm1.text && norm2.text) {
      return this.textSimilarity(norm1.text, norm2.text);
    }

    // Senão, comparar estrutura
    const keys1 = Object.keys(norm1).sort();
    const keys2 = Object.keys(norm2).sort();

    if (JSON.stringify(keys1) !== JSON.stringify(keys2)) {
      return 0;
    }

    let matches = 0;
    let total = keys1.length;

    keys1.forEach(key => {
      if (norm1[key] === norm2[key]) {
        matches++;
      }
    });

    return matches / total;
  }

  /**
   * Calcula similaridade entre textos (Jaccard)
   * @param {string} text1
   * @param {string} text2
   * @returns {number} Similaridade (0-1)
   */
  textSimilarity(text1, text2) {
    const words1 = new Set(text1.split(' ').filter(w => w.length > 3));
    const words2 = new Set(text2.split(' ').filter(w => w.length > 3));

    const intersection = new Set([...words1].filter(x => words2.has(x)));
    const union = new Set([...words1, ...words2]);

    return intersection.size / union.size;
  }

  /**
   * Busca no cache
   * @param {Object} query
   * @param {string} type - Tipo de cache
   * @param {number} similarityThreshold - Limiar de similaridade (0.8 = 80%)
   * @returns {Object|null} Resultado do cache ou null
   */
  get(query, type = 'response', similarityThreshold = 0.85) {
    const key = this.generateKey(query);

    // 1. Tentativa de match exato
    if (this.cache.has(key)) {
      const entry = this.cache.get(key);

      // Verificar se expirou
      if (this.isExpired(entry)) {
        this.cache.delete(key);
        this.stats.misses++;
        return null;
      }

      // Cache hit!
      this.updateAccessOrder(key);
      entry.hits++;
      entry.lastAccess = Date.now();
      this.stats.hits++;
      this.stats.totalTokensSaved += entry.estimatedTokens || 0;

      console.log(`✅ Cache HIT (exato): ${type} - ${entry.estimatedTokens || 0} tokens economizados`);
      return entry.data;
    }

    // 2. Busca por similaridade
    let bestMatch = null;
    let bestSimilarity = 0;

    for (const [cacheKey, entry] of this.cache.entries()) {
      if (entry.type !== type) continue;
      if (this.isExpired(entry)) continue;

      const similarity = this.calculateSimilarity(query, entry.query);

      if (similarity >= similarityThreshold && similarity > bestSimilarity) {
        bestSimilarity = similarity;
        bestMatch = { key: cacheKey, entry };
      }
    }

    if (bestMatch) {
      this.updateAccessOrder(bestMatch.key);
      bestMatch.entry.hits++;
      bestMatch.entry.lastAccess = Date.now();
      this.stats.hits++;
      this.stats.totalTokensSaved += bestMatch.entry.estimatedTokens || 0;

      console.log(`✅ Cache HIT (similar ${(bestSimilarity * 100).toFixed(1)}%): ${type} - ${bestMatch.entry.estimatedTokens || 0} tokens economizados`);
      return bestMatch.entry.data;
    }

    // Cache miss
    this.stats.misses++;
    console.log(`❌ Cache MISS: ${type}`);
    return null;
  }

  /**
   * Adiciona ao cache
   * @param {Object} query
   * @param {any} data - Dados a cachear
   * @param {string} type - Tipo de cache
   * @param {number} estimatedTokens - Tokens economizados
   */
  set(query, data, type = 'response', estimatedTokens = 0) {
    const key = this.generateKey(query);

    // Verificar se precisa eviction (LRU)
    if (this.cache.size >= this.maxSize) {
      this.evictLRU();
    }

    const entry = {
      key,
      query,
      data,
      type,
      estimatedTokens,
      createdAt: Date.now(),
      lastAccess: Date.now(),
      hits: 0,
      ttl: this.ttlByType[type] || this.defaultTTL
    };

    this.cache.set(key, entry);
    this.updateAccessOrder(key);

    console.log(`💾 Cache SET: ${type} - estimativa de ${estimatedTokens} tokens economizáveis`);
  }

  /**
   * Verifica se entrada expirou
   */
  isExpired(entry) {
    return Date.now() - entry.createdAt > entry.ttl;
  }

  /**
   * Atualiza ordem de acesso (LRU)
   */
  updateAccessOrder(key) {
    // Remove da posição atual
    const index = this.accessOrder.indexOf(key);
    if (index > -1) {
      this.accessOrder.splice(index, 1);
    }
    // Adiciona no final (mais recente)
    this.accessOrder.push(key);
  }

  /**
   * Remove entrada menos recentemente usada (LRU)
   */
  evictLRU() {
    if (this.accessOrder.length === 0) return;

    const keyToEvict = this.accessOrder.shift();
    this.cache.delete(keyToEvict);
    this.stats.evictions++;

    console.log(`🗑️ Cache EVICT (LRU): ${keyToEvict}`);
  }

  /**
   * Limpa entradas expiradas
   */
  cleanExpired() {
    let cleaned = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (this.isExpired(entry)) {
        this.cache.delete(key);

        // Remover da ordem de acesso
        const index = this.accessOrder.indexOf(key);
        if (index > -1) {
          this.accessOrder.splice(index, 1);
        }

        cleaned++;
      }
    }

    if (cleaned > 0) {
      console.log(`🧹 Cache: ${cleaned} entradas expiradas removidas`);
    }
  }

  /**
   * Agenda limpeza periódica
   */
  startCleanupSchedule() {
    // Limpar a cada 1 hora
    setInterval(() => {
      this.cleanExpired();
      this.saveCache();
    }, 60 * 60 * 1000);

    console.log('✅ Agendamento de limpeza de cache ativado (1h)');
  }

  /**
   * Salva cache em disco
   */
  saveCache() {
    try {
      const cacheData = {
        entries: Array.from(this.cache.entries()),
        accessOrder: this.accessOrder,
        stats: this.stats,
        savedAt: new Date().toISOString()
      };

      fs.writeFileSync(this.cachePath, JSON.stringify(cacheData, null, 2));
      console.log(`💾 Cache salvo: ${this.cache.size} entradas`);
    } catch (error) {
      console.error('Erro ao salvar cache:', error);
    }
  }

  /**
   * Carrega cache do disco
   */
  loadCache() {
    try {
      if (!fs.existsSync(this.cachePath)) {
        console.log('📂 Nenhum cache anterior encontrado - iniciando novo');
        return;
      }

      const cacheData = JSON.parse(fs.readFileSync(this.cachePath, 'utf8'));

      this.cache = new Map(cacheData.entries);
      this.accessOrder = cacheData.accessOrder || [];
      this.stats = cacheData.stats || this.stats;

      // Limpar entradas expiradas na carga
      this.cleanExpired();

      console.log(`📂 Cache carregado: ${this.cache.size} entradas, ${this.stats.hits} hits históricos`);
    } catch (error) {
      console.error('Erro ao carregar cache:', error);
      console.log('📂 Iniciando com cache vazio');
    }
  }

  /**
   * Obter estatísticas
   */
  getStatistics() {
    const totalRequests = this.stats.hits + this.stats.misses;
    const hitRate = totalRequests > 0 ? (this.stats.hits / totalRequests * 100).toFixed(2) : 0;

    return {
      cache: {
        size: this.cache.size,
        maxSize: this.maxSize,
        utilization: `${((this.cache.size / this.maxSize) * 100).toFixed(1)}%`
      },
      performance: {
        hits: this.stats.hits,
        misses: this.stats.misses,
        hitRate: `${hitRate}%`,
        evictions: this.stats.evictions
      },
      savings: {
        totalTokensSaved: this.stats.totalTokensSaved,
        estimatedCostSaved: `$${(this.stats.totalTokensSaved * 0.000003).toFixed(2)}`, // Claude Sonnet ~$3/1M tokens
        tokenReduction: totalRequests > 0 ? `${((this.stats.hits / totalRequests) * 100).toFixed(1)}%` : '0%'
      },
      byType: this.getStatsByType()
    };
  }

  /**
   * Estatísticas por tipo de cache
   */
  getStatsByType() {
    const byType = {};

    for (const [key, entry] of this.cache.entries()) {
      if (!byType[entry.type]) {
        byType[entry.type] = {
          count: 0,
          totalHits: 0,
          totalTokens: 0
        };
      }

      byType[entry.type].count++;
      byType[entry.type].totalHits += entry.hits;
      byType[entry.type].totalTokens += entry.estimatedTokens || 0;
    }

    return byType;
  }

  /**
   * Limpar cache completamente
   */
  clear() {
    this.cache.clear();
    this.accessOrder = [];
    console.log('🗑️ Cache limpo completamente');
  }

  /**
   * Limpar apenas um tipo de cache
   */
  clearType(type) {
    let cleared = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (entry.type === type) {
        this.cache.delete(key);

        const index = this.accessOrder.indexOf(key);
        if (index > -1) {
          this.accessOrder.splice(index, 1);
        }

        cleared++;
      }
    }

    console.log(`🗑️ Cache limpo: ${cleared} entradas do tipo ${type}`);
  }

  /**
   * Salvar estatísticas
   */
  saveStatistics() {
    try {
      const stats = this.getStatistics();

      let history = [];
      if (fs.existsSync(this.statsPath)) {
        history = JSON.parse(fs.readFileSync(this.statsPath, 'utf8'));
      }

      history.push({
        timestamp: new Date().toISOString(),
        ...stats
      });

      // Manter apenas últimos 30 registros
      if (history.length > 30) {
        history = history.slice(-30);
      }

      fs.writeFileSync(this.statsPath, JSON.stringify(history, null, 2));
      console.log('📊 Estatísticas de cache salvas');
    } catch (error) {
      console.error('Erro ao salvar estatísticas:', error);
    }
  }
}

/**
 * Exemplo de uso:
 *
 * const cache = new IntelligentCache({ maxSize: 1000 });
 *
 * // Antes de fazer query pesada
 * const cached = cache.get({ text: 'buscar jurisprudência STJ' }, 'legal_search');
 * if (cached) {
 *   return cached; // 70% de economia!
 * }
 *
 * // Se não tem cache, executar query
 * const result = await queryExpensive();
 *
 * // Salvar no cache
 * cache.set({ text: 'buscar jurisprudência STJ' }, result, 'legal_search', 500);
 */

module.exports = IntelligentCache;
