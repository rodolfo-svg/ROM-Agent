/**
 * Paradigmas Manager - Sistema de Peças Paradigmas (Approved Pieces)
 * BACKSPEC BETA - PRÉ MULTIUSUÁRIOS
 *
 * Gerencia peças jurídicas exemplares criadas manualmente para:
 * - Conhecimento: Aprendizado com melhores peças
 * - Utilização: Referência para novas peças
 * - Padrão de qualidade: Benchmark
 *
 * Funcionalidades:
 * - CRUD completo de paradigmas
 * - Categorização (tipo, área, tribunal, matéria)
 * - Busca e filtragem avançada
 * - Versionamento de paradigmas
 * - Extração automática de melhores peças
 * - Integração com Case Processor
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';
import featureFlags from './feature-flags.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class ParadigmasManager {
  constructor() {
    // Caminhos de armazenamento
    this.kbPath = path.join(process.cwd(), 'KB');
    this.paradigmasFile = path.join(this.kbPath, 'approved_pieces.json');
    this.paradigmasDir = path.join(this.kbPath, 'paradigmas');

    // Cache em memória
    this.paradigmas = [];
    this.initialized = false;

    // Categorias suportadas
    this.categories = {
      tipo: [
        'peticao_inicial', 'contestacao', 'recurso_apelacao', 'agravo_instrumento',
        'embargos_declaracao', 'embargos_execucao', 'mandado_seguranca',
        'habeas_corpus', 'acao_rescisoria', 'reconvencao', 'replica',
        'impugnacao', 'alegacoes_finais', 'memoriais', 'parecer'
      ],
      area: [
        'civel', 'criminal', 'trabalhista', 'tributario', 'administrativo',
        'previdenciario', 'familia', 'sucessoes', 'consumidor', 'ambiental',
        'empresarial', 'contratual'
      ],
      tribunal: [
        'STF', 'STJ', 'TST', 'TSE', 'STM',
        'TJ', 'TRF', 'TRT', 'TRE',
        'Primeiro Grau', 'Juizado Especial'
      ],
      materia: [
        'responsabilidade_civil', 'contratos', 'direito_consumidor',
        'familia', 'sucessoes', 'penal', 'trabalhista', 'tributario'
      ]
    };
  }

  /**
   * Inicializa o sistema de paradigmas
   */
  async initialize() {
    if (this.initialized) return;

    try {
      // Garantir que diretórios existem
      await fs.mkdir(this.kbPath, { recursive: true });
      await fs.mkdir(this.paradigmasDir, { recursive: true });

      // Carregar paradigmas existentes
      await this.load();

      this.initialized = true;
      console.log(`✅ Paradigmas Manager inicializado: ${this.paradigmas.length} paradigmas carregados`);
    } catch (error) {
      console.error('❌ Erro ao inicializar Paradigmas Manager:', error);
      this.paradigmas = [];
      this.initialized = true;
    }
  }

  /**
   * Carrega paradigmas do arquivo
   */
  async load() {
    try {
      const data = await fs.readFile(this.paradigmasFile, 'utf8');
      const parsed = JSON.parse(data);

      // Compatibilidade com formato antigo
      if (parsed.pieces) {
        this.paradigmas = parsed.pieces;
      } else if (Array.isArray(parsed)) {
        this.paradigmas = parsed;
      } else {
        this.paradigmas = [];
      }

      console.log(`📚 ${this.paradigmas.length} paradigmas carregados`);
    } catch (error) {
      if (error.code === 'ENOENT') {
        // Arquivo não existe, criar vazio
        this.paradigmas = [];
        await this.save();
      } else {
        throw error;
      }
    }
  }

  /**
   * Salva paradigmas no arquivo
   */
  async save() {
    try {
      const data = {
        version: '2.0',
        updatedAt: new Date().toISOString(),
        totalParadigmas: this.paradigmas.length,
        paradigmas: this.paradigmas
      };

      await fs.writeFile(
        this.paradigmasFile,
        JSON.stringify(data, null, 2),
        'utf8'
      );

      console.log(`💾 ${this.paradigmas.length} paradigmas salvos`);
      return true;
    } catch (error) {
      console.error('❌ Erro ao salvar paradigmas:', error);
      return false;
    }
  }

  /**
   * Adiciona um novo paradigma
   * @param {Object} paradigma - Dados do paradigma
   * @returns {Object} - Paradigma criado
   */
  async add(paradigma) {
    await this.initialize();

    // Validar campos obrigatórios
    const required = ['titulo', 'tipo', 'area', 'conteudo'];
    for (const field of required) {
      if (!paradigma[field]) {
        throw new Error(`Campo obrigatório ausente: ${field}`);
      }
    }

    // Criar paradigma completo
    const newParadigma = {
      id: randomUUID(),
      ...paradigma,

      // Metadados
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      version: 1,

      // Estatísticas de uso
      stats: {
        timesUsed: 0,
        lastUsedAt: null,
        avgQualityScore: 0,
        feedbackCount: 0
      },

      // Categorização
      categorias: {
        tipo: paradigma.tipo,
        area: paradigma.area,
        tribunal: paradigma.tribunal || null,
        materia: paradigma.materia || null,
        tags: paradigma.tags || []
      },

      // Status
      status: paradigma.status || 'active', // 'active', 'archived', 'deprecated'
      qualityScore: paradigma.qualityScore || 0,
      approvedBy: paradigma.approvedBy || null,
      approvedAt: paradigma.approvedAt || new Date().toISOString()
    };

    // Salvar conteúdo completo em arquivo separado
    const fileName = `${newParadigma.id}.json`;
    const filePath = path.join(this.paradigmasDir, fileName);
    await fs.writeFile(filePath, JSON.stringify(newParadigma, null, 2), 'utf8');

    // Adicionar ao cache (sem conteúdo para economizar memória)
    const { conteudo, ...paradigmaMetadata } = newParadigma;
    this.paradigmas.push({
      ...paradigmaMetadata,
      filePath
    });

    await this.save();

    console.log(`✅ Paradigma criado: ${newParadigma.titulo} (${newParadigma.id})`);
    return newParadigma;
  }

  /**
   * Busca um paradigma por ID
   * @param {string} id - ID do paradigma
   * @param {boolean} includeContent - Se deve incluir conteúdo completo
   * @returns {Object|null} - Paradigma encontrado
   */
  async get(id, includeContent = false) {
    await this.initialize();

    const paradigma = this.paradigmas.find(p => p.id === id);
    if (!paradigma) {
      return null;
    }

    if (includeContent && paradigma.filePath) {
      try {
        const content = await fs.readFile(paradigma.filePath, 'utf8');
        return JSON.parse(content);
      } catch (error) {
        console.error(`❌ Erro ao ler conteúdo do paradigma ${id}:`, error);
        return paradigma;
      }
    }

    return paradigma;
  }

  /**
   * Lista todos os paradigmas com filtros
   * @param {Object} filters - Filtros de busca
   * @returns {Array} - Lista de paradigmas
   */
  async list(filters = {}) {
    await this.initialize();

    let results = [...this.paradigmas];

    // Filtrar por tipo
    if (filters.tipo) {
      results = results.filter(p => p.categorias.tipo === filters.tipo);
    }

    // Filtrar por área
    if (filters.area) {
      results = results.filter(p => p.categorias.area === filters.area);
    }

    // Filtrar por tribunal
    if (filters.tribunal) {
      results = results.filter(p => p.categorias.tribunal === filters.tribunal);
    }

    // Filtrar por matéria
    if (filters.materia) {
      results = results.filter(p => p.categorias.materia === filters.materia);
    }

    // Filtrar por status
    if (filters.status) {
      results = results.filter(p => p.status === filters.status);
    }

    // Filtrar por tags
    if (filters.tags) {
      const tags = Array.isArray(filters.tags) ? filters.tags : [filters.tags];
      results = results.filter(p =>
        tags.some(tag => p.categorias.tags.includes(tag))
      );
    }

    // Busca textual no título
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      results = results.filter(p =>
        p.titulo.toLowerCase().includes(searchLower) ||
        (p.descricao && p.descricao.toLowerCase().includes(searchLower))
      );
    }

    // Ordenar
    const sortBy = filters.sortBy || 'createdAt';
    const sortOrder = filters.sortOrder || 'desc';

    results.sort((a, b) => {
      let aVal = a[sortBy];
      let bVal = b[sortBy];

      if (sortBy.includes('.')) {
        const [obj, key] = sortBy.split('.');
        aVal = a[obj]?.[key];
        bVal = b[obj]?.[key];
      }

      if (sortOrder === 'asc') {
        return aVal > bVal ? 1 : -1;
      } else {
        return aVal < bVal ? 1 : -1;
      }
    });

    // Paginação
    const page = filters.page || 1;
    const limit = filters.limit || 50;
    const start = (page - 1) * limit;
    const end = start + limit;

    return {
      total: results.length,
      page,
      limit,
      pages: Math.ceil(results.length / limit),
      results: results.slice(start, end)
    };
  }

  /**
   * Atualiza um paradigma
   * @param {string} id - ID do paradigma
   * @param {Object} updates - Campos para atualizar
   * @returns {Object} - Paradigma atualizado
   */
  async update(id, updates) {
    await this.initialize();

    const index = this.paradigmas.findIndex(p => p.id === id);
    if (index === -1) {
      throw new Error(`Paradigma não encontrado: ${id}`);
    }

    // Carregar conteúdo completo
    const paradigma = await this.get(id, true);

    // Atualizar campos
    const updated = {
      ...paradigma,
      ...updates,
      updatedAt: new Date().toISOString(),
      version: (paradigma.version || 1) + 1
    };

    // Salvar arquivo
    await fs.writeFile(paradigma.filePath, JSON.stringify(updated, null, 2), 'utf8');

    // Atualizar cache
    const { conteudo, ...metadata } = updated;
    this.paradigmas[index] = metadata;

    await this.save();

    console.log(`✅ Paradigma atualizado: ${updated.titulo} (${id})`);
    return updated;
  }

  /**
   * Remove um paradigma
   * @param {string} id - ID do paradigma
   * @returns {boolean} - Sucesso
   */
  async delete(id) {
    await this.initialize();

    const index = this.paradigmas.findIndex(p => p.id === id);
    if (index === -1) {
      throw new Error(`Paradigma não encontrado: ${id}`);
    }

    const paradigma = this.paradigmas[index];

    // Remover arquivo
    if (paradigma.filePath) {
      try {
        await fs.unlink(paradigma.filePath);
      } catch (error) {
        console.warn(`⚠️ Erro ao remover arquivo do paradigma ${id}:`, error);
      }
    }

    // Remover do cache
    this.paradigmas.splice(index, 1);

    await this.save();

    console.log(`🗑️ Paradigma removido: ${id}`);
    return true;
  }

  /**
   * Registra uso de um paradigma
   * @param {string} id - ID do paradigma
   */
  async registerUse(id) {
    await this.initialize();

    const paradigma = await this.get(id, true);
    if (!paradigma) return;

    paradigma.stats.timesUsed++;
    paradigma.stats.lastUsedAt = new Date().toISOString();

    await this.update(id, { stats: paradigma.stats });

    console.log(`📊 Uso registrado: ${paradigma.titulo} (total: ${paradigma.stats.timesUsed})`);
  }

  /**
   * Adiciona feedback a um paradigma
   * @param {string} id - ID do paradigma
   * @param {Object} feedback - Feedback (score, comentário, etc)
   */
  async addFeedback(id, feedback) {
    await this.initialize();

    const paradigma = await this.get(id, true);
    if (!paradigma) return;

    // Atualizar score médio
    const currentTotal = paradigma.stats.avgQualityScore * paradigma.stats.feedbackCount;
    paradigma.stats.feedbackCount++;
    paradigma.stats.avgQualityScore =
      (currentTotal + (feedback.score || 0)) / paradigma.stats.feedbackCount;

    // Adicionar feedback à lista
    if (!paradigma.feedbacks) paradigma.feedbacks = [];
    paradigma.feedbacks.push({
      ...feedback,
      timestamp: new Date().toISOString()
    });

    await this.update(id, {
      stats: paradigma.stats,
      feedbacks: paradigma.feedbacks
    });

    console.log(`💬 Feedback adicionado ao paradigma: ${paradigma.titulo}`);
  }

  /**
   * Retorna estatísticas gerais dos paradigmas
   */
  async getStatistics() {
    await this.initialize();

    const stats = {
      total: this.paradigmas.length,
      byTipo: {},
      byArea: {},
      byTribunal: {},
      byStatus: {},
      mostUsed: [],
      recentlyAdded: [],
      topRated: []
    };

    // Contagens por categoria
    this.paradigmas.forEach(p => {
      // Por tipo
      const tipo = p.categorias.tipo;
      stats.byTipo[tipo] = (stats.byTipo[tipo] || 0) + 1;

      // Por área
      const area = p.categorias.area;
      stats.byArea[area] = (stats.byArea[area] || 0) + 1;

      // Por tribunal
      const tribunal = p.categorias.tribunal;
      if (tribunal) {
        stats.byTribunal[tribunal] = (stats.byTribunal[tribunal] || 0) + 1;
      }

      // Por status
      const status = p.status;
      stats.byStatus[status] = (stats.byStatus[status] || 0) + 1;
    });

    // Top 10 mais usados
    stats.mostUsed = [...this.paradigmas]
      .sort((a, b) => (b.stats?.timesUsed || 0) - (a.stats?.timesUsed || 0))
      .slice(0, 10)
      .map(p => ({
        id: p.id,
        titulo: p.titulo,
        timesUsed: p.stats?.timesUsed || 0
      }));

    // 10 mais recentes
    stats.recentlyAdded = [...this.paradigmas]
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 10)
      .map(p => ({
        id: p.id,
        titulo: p.titulo,
        createdAt: p.createdAt
      }));

    // Top 10 melhor avaliados
    stats.topRated = [...this.paradigmas]
      .filter(p => p.stats?.feedbackCount > 0)
      .sort((a, b) => (b.stats?.avgQualityScore || 0) - (a.stats?.avgQualityScore || 0))
      .slice(0, 10)
      .map(p => ({
        id: p.id,
        titulo: p.titulo,
        avgQualityScore: p.stats?.avgQualityScore || 0,
        feedbackCount: p.stats?.feedbackCount || 0
      }));

    return stats;
  }

  /**
   * Retorna categorias disponíveis
   */
  getCategories() {
    return this.categories;
  }
}

// Exportar instância singleton
const paradigmasManager = new ParadigmasManager();

export default paradigmasManager;
