import express from 'express';
import { jurisprudenciaClient } from '../modules/jurisprudencia/jurisprudencia-client.js';

const router = express.Router();

// Busca simples
router.get('/search', async (req, res) => {
  try {
    const { query, tribunal = 'stj' } = req.query;

    if (!query) {
      return res.status(400).json({
        error: 'Query parameter is required'
      });
    }

    const resultados = await jurisprudenciaClient.buscar(query, tribunal);
    res.json(resultados);
  } catch (error) {
    console.error('Jurisprudência search error:', error);
    res.status(500).json({
      error: 'Search failed',
      message: error.message
    });
  }
});

// Busca com streaming (SSE)
router.get('/search/stream', async (req, res) => {
  try {
    const { query, tribunal = 'stj' } = req.query;

    if (!query) {
      return res.status(400).json({
        error: 'Query parameter is required'
      });
    }

    // Setup SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    await jurisprudenciaClient.buscarStream(query, tribunal, (data) => {
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    });

    res.write('data: [DONE]\n\n');
    res.end();
  } catch (error) {
    console.error('Jurisprudência stream error:', error);
    res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
    res.end();
  }
});

export default router;
