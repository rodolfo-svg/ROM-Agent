/**
 * Endpoint simples para verificar variáveis ENV
 */

import express from 'express';

const router = express.Router();

router.get('/test-env', (req, res) => {
  const result = {
    timestamp: new Date().toISOString(),
    env: {
      USE_BROWSERLESS: process.env.USE_BROWSERLESS,
      USE_BROWSERLESS_type: typeof process.env.USE_BROWSERLESS,
      HAS_BROWSERLESS_KEY: !!process.env.BROWSERLESS_API_KEY,
      BROWSERLESS_KEY_LENGTH: process.env.BROWSERLESS_API_KEY?.length || 0,
      NODE_ENV: process.env.NODE_ENV,
      RENDER: process.env.RENDER
    }
  };

  res.json(result);
});

export default router;
