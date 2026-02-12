/**
 * ROM Agent - Rotas da API DataJud (CNJ)
 * Endpoints para consulta de processos e decisões judiciais
 *
 * @version 1.0.0
 * @created 2026-02-12
 */

import express from 'express';
import * as datajudService from '../services/datajud-service.js';
import { logger } from '../utils/logger.js';

const router = express.Router();

/**
 * GET /api/datajud/health
 * Verifica status da API DataJud
 */
router.get('/health', async (req, res) => {
  try {
    const apiKey = process.env.DATAJUD_API_KEY || process.env.CNJ_DATAJUD_API_KEY;
    const baseUrl = process.env.DATAJUD_BASE_URL;

    res.json({
      status: 'ok',
      configured: !!apiKey,
      baseUrl: baseUrl || 'https://api-publica.datajud.cnj.jus.br',
      tribunaisDisponiveis: Object.keys(datajudService.TRIBUNAL_ALIASES).length,
      version: '1.0.0'
    });
  } catch (error) {
    logger.error('[DataJud API] Health check error:', error);
    res.status(500).json({
      status: 'error',
      error: error.message
    });
  }
});

/**
 * GET /api/datajud/tribunais
 * Lista todos os tribunais disponíveis
 */
router.get('/tribunais', (req, res) => {
  try {
    const tribunais = Object.entries(datajudService.TRIBUNAL_ALIASES).map(([sigla, alias]) => ({
      sigla,
      alias,
      url: `https://api-publica.datajud.cnj.jus.br/api_publica_${alias}/_search`
    }));

    res.json({
      total: tribunais.length,
      tribunais,
      categorias: {
        superiores: tribunais.filter(t => ['STF', 'STJ', 'STM', 'TSE', 'TST'].includes(t.sigla)),
        federais: tribunais.filter(t => t.sigla.startsWith('TRF')),
        estaduais: tribunais.filter(t => t.sigla.startsWith('TJ'))
      }
    });
  } catch (error) {
    logger.error('[DataJud API] Tribunais error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/datajud/processos/buscar
 * Busca processos em um tribunal específico
 *
 * Body: {
 *   tribunal: 'TJSP',
 *   numero: '0000832-35.2018.4.01.3202',
 *   classe: 'Procedimento Comum',
 *   assunto: 'Direito Civil',
 *   limit: 50,
 *   offset: 0
 * }
 */
router.post('/processos/buscar', async (req, res) => {
  try {
    const filtros = req.body;

    if (!filtros.tribunal && !filtros.numero) {
      return res.status(400).json({
        error: 'Tribunal ou número do processo são obrigatórios'
      });
    }

    logger.info('[DataJud API] Buscando processos:', filtros);

    const resultado = await datajudService.buscarProcessos(filtros);

    res.json(resultado);
  } catch (error) {
    logger.error('[DataJud API] Buscar processos error:', error);
    res.status(500).json({
      error: error.message,
      fonte: 'DataJud (CNJ)'
    });
  }
});

/**
 * POST /api/datajud/processos/buscar-todos
 * Busca processos em MÚLTIPLOS tribunais simultaneamente
 *
 * Body: {
 *   tribunais: ['TJSP', 'TJRJ', 'TJMG'],
 *   numero: '0000832-35.2018.4.01.3202',
 *   limit: 20
 * }
 */
router.post('/processos/buscar-todos', async (req, res) => {
  try {
    const filtros = req.body;

    logger.info('[DataJud API] Buscando em múltiplos tribunais:', filtros);

    const resultado = await datajudService.buscarTodosTribunais(filtros);

    res.json(resultado);
  } catch (error) {
    logger.error('[DataJud API] Buscar todos tribunais error:', error);
    res.status(500).json({
      error: error.message,
      fonte: 'DataJud (CNJ)'
    });
  }
});

/**
 * POST /api/datajud/decisoes/buscar
 * Busca decisões/acórdãos
 *
 * Body: {
 *   tribunal: 'STJ',
 *   termo: 'responsabilidade civil',
 *   relator: 'Ministro Nome',
 *   limit: 50
 * }
 */
router.post('/decisoes/buscar', async (req, res) => {
  try {
    const filtros = req.body;

    if (!filtros.tribunal || !filtros.termo) {
      return res.status(400).json({
        error: 'Tribunal e termo de busca são obrigatórios'
      });
    }

    logger.info('[DataJud API] Buscando decisões:', filtros);

    const resultado = await datajudService.buscarDecisoes(filtros);

    res.json(resultado);
  } catch (error) {
    logger.error('[DataJud API] Buscar decisões error:', error);
    res.status(500).json({
      error: error.message,
      fonte: 'DataJud (CNJ)'
    });
  }
});

/**
 * GET /api/datajud/processo/:numero/movimentacoes
 * Busca movimentações de um processo específico
 */
router.get('/processo/:numero/movimentacoes', async (req, res) => {
  try {
    const { numero } = req.params;

    logger.info('[DataJud API] Buscando movimentações:', numero);

    const resultado = await datajudService.buscarMovimentacoes(numero);

    res.json(resultado);
  } catch (error) {
    logger.error('[DataJud API] Buscar movimentações error:', error);
    res.status(500).json({
      error: error.message,
      fonte: 'DataJud (CNJ)'
    });
  }
});

/**
 * GET /api/datajud/classes
 * Lista classes processuais
 */
router.get('/classes', async (req, res) => {
  try {
    const resultado = await datajudService.listarClasses();
    res.json(resultado);
  } catch (error) {
    logger.error('[DataJud API] Listar classes error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/datajud/assuntos
 * Lista assuntos processuais
 * Query: ?area=civel|trabalhista|penal
 */
router.get('/assuntos', async (req, res) => {
  try {
    const { area } = req.query;
    const resultado = await datajudService.listarAssuntos(area);
    res.json(resultado);
  } catch (error) {
    logger.error('[DataJud API] Listar assuntos error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/datajud/tribunal/:sigla
 * Obter informações de um tribunal específico
 */
router.get('/tribunal/:sigla', (req, res) => {
  try {
    const { sigla } = req.params;
    const resultado = datajudService.obterTribunal(sigla);

    if (!resultado) {
      return res.status(404).json({
        error: 'Tribunal não encontrado',
        sigla
      });
    }

    res.json(resultado);
  } catch (error) {
    logger.error('[DataJud API] Obter tribunal error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/datajud/validar-processo
 * Valida número de processo no padrão CNJ
 *
 * Body: {
 *   numero: '0000832-35.2018.4.01.3202'
 * }
 */
router.post('/validar-processo', (req, res) => {
  try {
    const { numero } = req.body;

    if (!numero) {
      return res.status(400).json({
        error: 'Número do processo é obrigatório'
      });
    }

    const resultado = datajudService.validarNumeroProcesso(numero);
    res.json(resultado);
  } catch (error) {
    logger.error('[DataJud API] Validar processo error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /api/datajud/cache
 * Limpa cache do DataJud
 */
router.delete('/cache', (req, res) => {
  try {
    const resultado = datajudService.limparCache();
    logger.info('[DataJud API] Cache limpo');
    res.json(resultado);
  } catch (error) {
    logger.error('[DataJud API] Limpar cache error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/datajud/cache/stats
 * Estatísticas do cache
 */
router.get('/cache/stats', (req, res) => {
  try {
    const stats = datajudService.estatisticasCache();
    res.json(stats);
  } catch (error) {
    logger.error('[DataJud API] Cache stats error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/datajud/busca-avancada
 * Busca avançada com query ElasticSearch personalizada
 *
 * Body: {
 *   tribunal: 'TJSP',
 *   query: {
 *     query: {
 *       bool: {
 *         must: [
 *           { match: { numeroProcesso: '123456' } }
 *         ]
 *       }
 *     },
 *     size: 100
 *   }
 * }
 */
router.post('/busca-avancada', async (req, res) => {
  try {
    const { tribunal, query } = req.body;

    if (!tribunal || !query) {
      return res.status(400).json({
        error: 'Tribunal e query são obrigatórios'
      });
    }

    // Esta é uma função avançada que permite queries personalizadas
    // Implementar conforme necessidade
    res.json({
      message: 'Endpoint de busca avançada - em desenvolvimento',
      tribunal,
      queryRecebida: query
    });
  } catch (error) {
    logger.error('[DataJud API] Busca avançada error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/datajud/docs
 * Documentação da API
 */
router.get('/docs', (req, res) => {
  res.json({
    api: 'DataJud CNJ - API Pública',
    version: '1.0.0',
    documentacao: 'https://datajud-wiki.cnj.jus.br/api-publica/',
    endpoints: [
      {
        method: 'GET',
        path: '/api/datajud/health',
        description: 'Verifica status da API'
      },
      {
        method: 'GET',
        path: '/api/datajud/tribunais',
        description: 'Lista todos os tribunais disponíveis'
      },
      {
        method: 'POST',
        path: '/api/datajud/processos/buscar',
        description: 'Busca processos em um tribunal',
        body: {
          tribunal: 'string (obrigatório)',
          numero: 'string',
          classe: 'string',
          assunto: 'string',
          limit: 'number',
          offset: 'number'
        }
      },
      {
        method: 'POST',
        path: '/api/datajud/processos/buscar-todos',
        description: 'Busca em múltiplos tribunais simultaneamente',
        body: {
          tribunais: 'string[] (array de siglas)',
          numero: 'string',
          limit: 'number'
        }
      },
      {
        method: 'POST',
        path: '/api/datajud/decisoes/buscar',
        description: 'Busca decisões/acórdãos',
        body: {
          tribunal: 'string (obrigatório)',
          termo: 'string (obrigatório)',
          relator: 'string',
          limit: 'number'
        }
      },
      {
        method: 'GET',
        path: '/api/datajud/processo/:numero/movimentacoes',
        description: 'Busca movimentações de um processo'
      },
      {
        method: 'GET',
        path: '/api/datajud/classes',
        description: 'Lista classes processuais'
      },
      {
        method: 'GET',
        path: '/api/datajud/assuntos',
        description: 'Lista assuntos processuais',
        query: 'area=civel|trabalhista|penal'
      },
      {
        method: 'GET',
        path: '/api/datajud/tribunal/:sigla',
        description: 'Informações de um tribunal'
      },
      {
        method: 'POST',
        path: '/api/datajud/validar-processo',
        description: 'Valida número de processo',
        body: {
          numero: 'string (obrigatório)'
        }
      },
      {
        method: 'DELETE',
        path: '/api/datajud/cache',
        description: 'Limpa cache'
      },
      {
        method: 'GET',
        path: '/api/datajud/cache/stats',
        description: 'Estatísticas do cache'
      }
    ],
    exemplos: {
      buscarProcesso: {
        url: 'POST /api/datajud/processos/buscar',
        body: {
          tribunal: 'TJSP',
          numero: '0000832-35.2018.4.01.3202',
          limit: 50
        }
      },
      buscarMultiplosTribunais: {
        url: 'POST /api/datajud/processos/buscar-todos',
        body: {
          tribunais: ['TJSP', 'TJRJ', 'TJMG', 'STJ'],
          numero: '0000832-35.2018.4.01.3202',
          limit: 20
        }
      },
      buscarDecisoes: {
        url: 'POST /api/datajud/decisoes/buscar',
        body: {
          tribunal: 'STJ',
          termo: 'responsabilidade civil dano moral',
          limit: 30
        }
      }
    }
  });
});

export default router;
