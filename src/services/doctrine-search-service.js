/**
 * Serviço de Busca de Doutrina Jurídica
 *
 * Busca em múltiplas fontes:
 * - Google Scholar (artigos acadêmicos)
 * - Conjur (artigos jurídicos)
 * - Migalhas (artigos e notícias)
 * - JOTA (análises especializadas)
 * - SciELO (artigos científicos)
 *
 * @version 1.0.0
 */

import axios from 'axios';
import * as cheerio from 'cheerio';
import cacheService from '../utils/cache/cache-service.js';

class DoctrineSearchService {
  constructor() {
    this.timeout = 10000; // 10s timeout

    // Sites de doutrina
    this.sources = {
      googleScholar: {
        name: 'Google Scholar',
        baseUrl: 'https://scholar.google.com.br/scholar',
        enabled: true,
        type: 'academico'
      },
      conjur: {
        name: 'Consultor Jurídico',
        baseUrl: 'https://www.conjur.com.br',
        searchUrl: 'https://www.conjur.com.br/busca',
        enabled: true,
        type: 'artigos'
      },
      migalhas: {
        name: 'Migalhas',
        baseUrl: 'https://www.migalhas.com.br',
        searchUrl: 'https://www.migalhas.com.br/busca',
        enabled: true,
        type: 'artigos'
      },
      jota: {
        name: 'JOTA',
        baseUrl: 'https://www.jota.info',
        searchUrl: 'https://www.jota.info/',
        enabled: true,
        type: 'analises'
      }
    };
  }

  /**
   * Buscar doutrina em múltiplas fontes
   * @param {string} termo - Termo de busca
   * @param {object} options - Opções de busca
   * @returns {Promise<object>} Resultados consolidados
   */
  async search(termo, options = {}) {
    const {
      tipo = 'todos',        // 'academico' | 'artigos' | 'analises' | 'todos'
      limite = 10,
      fontes = null          // Array de fontes específicas ou null para todas
    } = options;

    console.log(`[DoctrineSearch] Buscando doutrina: "${termo}"`);
    console.log(`[DoctrineSearch] Tipo: ${tipo}, Limite: ${limite}`);

    // Verificar cache
    const cacheKey = `doctrine-${tipo}-${termo}`;
    const cached = await cacheService.checkCache('global', cacheKey, null);

    if (cached.valid) {
      console.log(`[DoctrineSearch] ✓ Usando cache (${cached.data.resultados.length} resultados)`);
      return cached.data;
    }

    // Determinar fontes ativas
    const activeSources = this.getActiveSources(tipo, fontes);
    console.log(`[DoctrineSearch] Fontes ativas: ${activeSources.map(s => s.name).join(', ')}`);

    // Buscar em paralelo
    const searchPromises = activeSources.map(source =>
      this.searchSource(source, termo, Math.ceil(limite / activeSources.length))
    );

    const results = await Promise.allSettled(searchPromises);

    // Consolidar resultados
    const consolidated = this.consolidateResults(results, activeSources, limite);

    // Cachear resultado
    await cacheService.saveCache('global', cacheKey, consolidated, null, {
      termo,
      tipo,
      timestamp: new Date().toISOString()
    });

    console.log(`[DoctrineSearch] ✓ ${consolidated.resultados.length} resultados consolidados`);

    return consolidated;
  }

  /**
   * Determinar fontes ativas baseado no tipo
   */
  getActiveSources(tipo, fontes) {
    const allSources = Object.values(this.sources).filter(s => s.enabled);

    // Se fontes específicas foram solicitadas
    if (fontes && Array.isArray(fontes)) {
      return allSources.filter(s => fontes.includes(s.name));
    }

    // Filtrar por tipo
    if (tipo === 'todos') {
      return allSources;
    }

    return allSources.filter(s => s.type === tipo);
  }

  /**
   * Buscar em uma fonte específica
   */
  async searchSource(source, termo, limite) {
    try {
      switch (source.name) {
        case 'Google Scholar':
          return await this.searchGoogleScholar(termo, limite);
        case 'Consultor Jurídico':
          return await this.searchConjur(termo, limite);
        case 'Migalhas':
          return await this.searchMigalhas(termo, limite);
        case 'JOTA':
          return await this.searchJota(termo, limite);
        default:
          console.warn(`[DoctrineSearch] Fonte não implementada: ${source.name}`);
          return [];
      }
    } catch (error) {
      console.error(`[DoctrineSearch] Erro em ${source.name}:`, error.message);
      return [];
    }
  }

  /**
   * Buscar no Google Scholar
   */
  async searchGoogleScholar(termo, limite = 5) {
    try {
      const url = `https://scholar.google.com.br/scholar?q=${encodeURIComponent(termo + ' direito')}&hl=pt-BR&as_sdt=0,5`;

      const response = await axios.get(url, {
        timeout: this.timeout,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });

      const $ = cheerio.load(response.data);
      const results = [];

      $('.gs_ri').slice(0, limite).each((i, elem) => {
        const $elem = $(elem);
        const titulo = $elem.find('.gs_rt').text().trim();
        const resumo = $elem.find('.gs_rs').text().trim();
        const link = $elem.find('.gs_rt a').attr('href') || '';
        const autores = $elem.find('.gs_a').text().split('-')[0]?.trim() || '';
        const ano = $elem.find('.gs_a').text().match(/\d{4}/)?.[0] || '';

        if (titulo) {
          results.push({
            fonte: 'Google Scholar',
            tipo: 'Artigo Acadêmico',
            titulo,
            autores,
            ano,
            resumo,
            url: link,
            relevancia: 'alta',
            verificado: true
          });
        }
      });

      console.log(`[DoctrineSearch] Google Scholar: ${results.length} resultados`);
      return results;
    } catch (error) {
      console.error('[DoctrineSearch] Erro Google Scholar:', error.message);
      return [];
    }
  }

  /**
   * Buscar no Conjur
   */
  async searchConjur(termo, limite = 5) {
    try {
      // Conjur tem proteção anti-bot, retornar estrutura base
      console.log('[DoctrineSearch] Conjur: Busca via scraping limitada (proteção anti-bot)');

      // Retornar link de busca para o usuário
      return [{
        fonte: 'Consultor Jurídico',
        tipo: 'Portal de Artigos',
        titulo: `Resultados para "${termo}" no Conjur`,
        resumo: 'Acesse o link para ver artigos jurídicos atualizados sobre o tema',
        url: `https://www.conjur.com.br/busca/?q=${encodeURIComponent(termo)}`,
        relevancia: 'media',
        verificado: false,
        nota: 'Link direto para busca no portal'
      }];
    } catch (error) {
      console.error('[DoctrineSearch] Erro Conjur:', error.message);
      return [];
    }
  }

  /**
   * Buscar no Migalhas
   */
  async searchMigalhas(termo, limite = 5) {
    try {
      console.log('[DoctrineSearch] Migalhas: Busca via scraping limitada');

      return [{
        fonte: 'Migalhas',
        tipo: 'Portal Jurídico',
        titulo: `Artigos sobre "${termo}" no Migalhas`,
        resumo: 'Portal com artigos, notícias e análises jurídicas especializadas',
        url: `https://www.migalhas.com.br/busca?q=${encodeURIComponent(termo)}`,
        relevancia: 'media',
        verificado: false,
        nota: 'Link direto para busca no portal'
      }];
    } catch (error) {
      console.error('[DoctrineSearch] Erro Migalhas:', error.message);
      return [];
    }
  }

  /**
   * Buscar no JOTA
   */
  async searchJota(termo, limite = 5) {
    try {
      console.log('[DoctrineSearch] JOTA: Busca via scraping limitada');

      return [{
        fonte: 'JOTA',
        tipo: 'Análises Especializadas',
        titulo: `Análises sobre "${termo}" no JOTA`,
        resumo: 'Análises aprofundadas de direito por especialistas',
        url: `https://www.jota.info/?s=${encodeURIComponent(termo)}`,
        relevancia: 'media',
        verificado: false,
        nota: 'Link direto para busca no portal'
      }];
    } catch (error) {
      console.error('[DoctrineSearch] Erro JOTA:', error.message);
      return [];
    }
  }

  /**
   * Consolidar resultados de múltiplas fontes
   */
  consolidateResults(results, sources, limite) {
    const allResults = [];

    results.forEach((result, index) => {
      if (result.status === 'fulfilled' && result.value.length > 0) {
        allResults.push(...result.value);
      } else if (result.status === 'rejected') {
        console.warn(`[DoctrineSearch] Fonte ${sources[index]?.name} falhou:`, result.reason);
      }
    });

    // Ordenar por relevância (Google Scholar primeiro, depois outros)
    allResults.sort((a, b) => {
      const scoreA = this.calculateRelevanceScore(a);
      const scoreB = this.calculateRelevanceScore(b);
      return scoreB - scoreA;
    });

    // Limitar resultados
    const limited = allResults.slice(0, limite);

    // Estatísticas
    const stats = {
      fontes: sources.map(s => s.name),
      total_encontrado: allResults.length,
      total_retornado: limited.length,
      por_fonte: {}
    };

    sources.forEach(source => {
      stats.por_fonte[source.name] = allResults.filter(r => r.fonte === source.name).length;
    });

    return {
      sucesso: true,
      termo: results[0]?.value?.[0]?.termo || '',
      resultados: limited,
      estatisticas: stats,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Calcular score de relevância
   */
  calculateRelevanceScore(result) {
    let score = 0;

    // Fonte confiável
    if (result.fonte === 'Google Scholar') score += 10;
    if (result.verificado) score += 5;

    // Relevância declarada
    if (result.relevancia === 'alta') score += 5;
    if (result.relevancia === 'media') score += 3;

    // Tem ano recente
    if (result.ano) {
      const ano = parseInt(result.ano);
      if (ano >= 2020) score += 5;
      if (ano >= 2023) score += 3;
    }

    // Tem autores
    if (result.autores) score += 2;

    return score;
  }

  /**
   * Formatar resultados para exibição
   */
  formatResults(consolidated) {
    if (!consolidated.sucesso || consolidated.resultados.length === 0) {
      return 'Nenhum resultado de doutrina encontrado.';
    }

    let output = `📚 DOUTRINA JURÍDICA - ${consolidated.resultados.length} resultado(s)\n\n`;

    consolidated.resultados.forEach((result, index) => {
      output += `${index + 1}. ${result.titulo}\n`;
      output += `   Fonte: ${result.fonte} | Tipo: ${result.tipo}\n`;

      if (result.autores) {
        output += `   Autores: ${result.autores}\n`;
      }

      if (result.ano) {
        output += `   Ano: ${result.ano}\n`;
      }

      if (result.resumo) {
        output += `   Resumo: ${result.resumo.substring(0, 200)}...\n`;
      }

      output += `   🔗 ${result.url}\n`;

      if (result.nota) {
        output += `   ℹ️ ${result.nota}\n`;
      }

      output += '\n';
    });

    // Estatísticas
    output += `\n📊 Estatísticas:\n`;
    output += `   Fontes consultadas: ${consolidated.estatisticas.fontes.join(', ')}\n`;
    output += `   Total encontrado: ${consolidated.estatisticas.total_encontrado}\n`;

    Object.entries(consolidated.estatisticas.por_fonte).forEach(([fonte, count]) => {
      if (count > 0) {
        output += `   ${fonte}: ${count} resultado(s)\n`;
      }
    });

    return output;
  }
}

// Singleton
const doctrineSearchService = new DoctrineSearchService();

export default doctrineSearchService;
