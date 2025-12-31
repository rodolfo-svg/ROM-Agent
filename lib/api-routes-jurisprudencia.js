/**
 * Jurisprudência Routes
 * Endpoints para busca de jurisprudência e processos
 */

import express from 'express';
import datajudService from '../src/services/datajud-service.js';
import { buscarJusBrasil } from '../src/modules/webSearch.js';
import { obterInfoTribunal } from '../src/modules/tribunais.js';
import { logger } from '../src/utils/logger.js';

const router = express.Router();

/**
 * GET /jurisprudencia/buscar
 * Buscar jurisprudência em múltiplas fontes
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

    const resultados = {
      termo,
      tribunal,
      timestamp: new Date().toISOString(),
      fontes: []
    };

    // Buscar no DataJud (CNJ)
    if (fonte === 'datajud' || fonte === 'todas') {
      try {
        const datajud = await datajudService.buscarDecisoes({
          tribunal,
          termo,
          dataInicio,
          dataFim,
          limit: parseInt(limit)
        });
        resultados.fontes.push({ fonte: 'DataJud (CNJ)', ...datajud });
      } catch (error) {
        resultados.fontes.push({
          fonte: 'DataJud (CNJ)',
          erro: true,
          mensagem: error.message
        });
      }
    }

    // Buscar no JusBrasil
    if (fonte === 'jusbrasil' || fonte === 'todas') {
      try {
        const jusbrasil = await buscarJusBrasil(termo, 'jurisprudencia');
        resultados.fontes.push({ fonte: 'JusBrasil', ...jusbrasil });
      } catch (error) {
        resultados.fontes.push({
          fonte: 'JusBrasil',
          erro: true,
          mensagem: error.message
        });
      }
    }

    // Buscar via WebSearch (tribunais oficiais)
    if (fonte === 'websearch' || fonte === 'todas') {
      try {
        if (tribunal) {
          const tribunalInfo = obterInfoTribunal(tribunal);
          if (tribunalInfo) {
            resultados.fontes.push({
              fonte: 'WebSearch Oficial',
              tribunal: tribunalInfo,
              termo,
              instrucao: `Acesse o site oficial do tribunal para buscar "${termo}"`
            });
          }
        }
      } catch (error) {
        resultados.fontes.push({
          fonte: 'WebSearch Oficial',
          erro: true,
          mensagem: error.message
        });
      }
    }

    res.json({
      success: true,
      totalFontes: resultados.fontes.length,
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
