/**
 * Jurisprudência Routes
 * Endpoints para busca de jurisprudência e processos
 */

import express from 'express';
import jurisprudenceSearchService from '../src/services/jurisprudence-search-service.js';
import { logger } from '../src/utils/logger.js';

const router = express.Router();

/**
 * GET /jurisprudencia/buscar
 * Buscar jurisprudência em múltiplas fontes (Google Search + DataJud + JusBrasil)
 *
 * Query params:
 *   termo: string (obrigatório) - Termo de busca
 *   tribunal: string (opcional) - Sigla do tribunal (ex: TJGO, STJ, STF)
 *   fonte: string (opcional) - Fonte específica ou 'todas' (default)
 *   dataInicio: string (opcional) - Data inicial (YYYY-MM-DD)
 *   dataFim: string (opcional) - Data final (YYYY-MM-DD)
 *   limit: number (opcional) - Limite de resultados (default: 50)
 */
router.get('/jurisprudencia/buscar', async (req, res) => {
  try {
    const { termo, tribunal, fonte = 'todas', dataInicio, dataFim, limit = 50 } = req.query;

    if (!termo) {
      return res.status(400).json({
        success: false,
        error: 'Parâmetro "termo" é obrigatório'
      });
    }

    logger.info('[Jurisprudência API] Busca solicitada', {
      termo,
      tribunal,
      fonte,
      limit
    });

    // ✅ CORREÇÃO: Usar jurisprudence-search-service com Google Search + TJGO
    const resultados = await jurisprudenceSearchService.searchJurisprudence({
      query: termo,
      tribunal,
      dataInicio,
      dataFim,
      maxResults: parseInt(limit) || 50
    });

    logger.info('[Jurisprudência API] Busca concluída', {
      totalResultados: resultados.results?.length || 0,
      fontes: resultados.sources || []
    });

    res.json({
      success: true,
      termo,
      tribunal,
      timestamp: new Date().toISOString(),
      ...resultados
    });

  } catch (error) {
    logger.error('Erro ao buscar jurisprudência:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /jurisprudencia/processo/:numero
 * Buscar processo específico por número CNJ
 */
router.get('/jurisprudencia/processo/:numero', async (req, res) => {
  try {
    const { numero } = req.params;

    // Validar número do processo
    const validacao = datajudService.validarNumeroProcesso(numero);
    if (!validacao.valido) {
      return res.status(400).json({
        success: false,
        error: validacao.mensagem
      });
    }

    // Buscar processo no DataJud
    const resultado = await datajudService.buscarProcessos({
      numero
    });

    res.json({
      success: true,
      validacao,
      ...resultado
    });

  } catch (error) {
    logger.error('Erro ao buscar processo:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /jurisprudencia/tribunais
 * Listar todos os tribunais disponíveis
 */
router.get('/jurisprudencia/tribunais', (req, res) => {
  try {
    const tribunais = Object.entries(datajudService.TRIBUNAIS_DATAJUD).map(([sigla, codigo]) => ({
      sigla,
      codigo,
      nome: obterInfoTribunal(sigla)?.nome || sigla
    }));

    res.json({
      success: true,
      total: tribunais.length,
      tribunais
    });
  } catch (error) {
    logger.error('Erro ao listar tribunais:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /jurisprudencia/classes
 * Listar classes processuais
 */
router.get('/jurisprudencia/classes', async (req, res) => {
  try {
    const resultado = await datajudService.listarClasses();
    res.json({
      success: true,
      ...resultado
    });
  } catch (error) {
    logger.error('Erro ao listar classes:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /jurisprudencia/assuntos
 * Listar assuntos processuais
 */
router.get('/jurisprudencia/assuntos', async (req, res) => {
  try {
    const { area } = req.query;
    const resultado = await datajudService.listarAssuntos(area);
    res.json({
      success: true,
      ...resultado
    });
  } catch (error) {
    logger.error('Erro ao listar assuntos:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /jurisprudencia/cache/clear
 * Limpar cache do DataJud
 */
router.post('/jurisprudencia/cache/clear', (req, res) => {
  try {
    const resultado = datajudService.limparCache();
    res.json({
      success: true,
      ...resultado
    });
  } catch (error) {
    logger.error('Erro ao limpar cache:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /jurisprudencia/cache/stats
 * Estatísticas do cache
 */
router.get('/jurisprudencia/cache/stats', (req, res) => {
  try {
    const stats = datajudService.estatisticasCache();
    res.json({
      success: true,
      cache: stats
    });
  } catch (error) {
    logger.error('Erro ao obter estatísticas do cache:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;
