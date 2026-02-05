/**
 * Diagnostic endpoint for testing Bedrock models in production
 */

import express from 'express';
import { conversar } from '../modules/bedrock.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

/**
 * GET /api/diagnostic/models
 *
 * Testa todos os modelos disponíveis com prompt simples
 */
router.get('/', requireAuth, async (req, res) => {
  const results = [];

  // Modelos para testar
  const modelsToTest = [
    {
      name: 'Nova Micro (cross-region)',
      id: 'us.amazon.nova-micro-v1:0'
    },
    {
      name: 'Nova Micro (us-west-2)',
      id: 'amazon.nova-micro-v1:0'
    },
    {
      name: 'Nova Lite (cross-region)',
      id: 'us.amazon.nova-lite-v1:0'
    },
    {
      name: 'Nova Lite (us-west-2)',
      id: 'amazon.nova-lite-v1:0'
    },
    {
      name: 'Haiku 3.5 (cross-region)',
      id: 'us.anthropic.claude-3-5-haiku-20241022-v1:0'
    },
    {
      name: 'Haiku 3.5 (us-west-2)',
      id: 'anthropic.claude-3-5-haiku-20241022-v1:0'
    },
    {
      name: 'Sonnet 3.5 (cross-region)',
      id: 'us.anthropic.claude-3-5-sonnet-20241022-v2:0'
    },
    {
      name: 'Sonnet 3.5 (us-west-2)',
      id: 'anthropic.claude-3-5-sonnet-20241022-v2:0'
    }
  ];

  const testPrompt = 'Responda apenas: OK';

  console.log('\n🔍 [Diagnostic] Testando modelos Bedrock...\n');

  for (const model of modelsToTest) {
    console.log(`   Testando: ${model.name} (${model.id})...`);

    try {
      const startTime = Date.now();

      const response = await conversar(testPrompt, {
        modelo: model.id,
        systemPrompt: 'Você é um assistente de teste.',
        temperature: 0.1,
        maxTokens: 100,
        enableTools: false,
        enableCache: false
      });

      const elapsedTime = Date.now() - startTime;

      if (response.sucesso === true) {
        console.log(`   ✅ SUCESSO em ${elapsedTime}ms`);
        results.push({
          name: model.name,
          id: model.id,
          status: 'success',
          response: response.resposta?.substring(0, 50),
          latency: elapsedTime,
          tokens: response.uso
        });
      } else {
        console.log(`   ❌ FALHOU: ${response.erro}`);
        results.push({
          name: model.name,
          id: model.id,
          status: 'failed',
          error: response.erro,
          statusCode: response.statusCode
        });
      }
    } catch (error) {
      console.log(`   ❌ EXCEPTION: ${error.message}`);
      results.push({
        name: model.name,
        id: model.id,
        status: 'exception',
        error: error.message
      });
    }
  }

  console.log('\n✅ [Diagnostic] Testes concluídos\n');

  // Resumo
  const successful = results.filter(r => r.status === 'success');
  const failed = results.filter(r => r.status === 'failed' || r.status === 'exception');

  res.json({
    success: true,
    summary: {
      total: results.length,
      successful: successful.length,
      failed: failed.length,
      successRate: `${Math.round((successful.length / results.length) * 100)}%`
    },
    environment: {
      awsRegion: process.env.AWS_REGION || 'not set',
      hasAccessKey: !!process.env.AWS_ACCESS_KEY_ID,
      hasSecretKey: !!process.env.AWS_SECRET_ACCESS_KEY
    },
    workingModels: successful.map(r => ({ name: r.name, id: r.id, latency: r.latency })),
    failedModels: failed.map(r => ({ name: r.name, id: r.id, error: r.error })),
    detailedResults: results
  });
});

/**
 * POST /api/diagnostic/models/test
 *
 * Testa um modelo específico com prompt customizado
 */
router.post('/test', requireAuth, async (req, res) => {
  const { modelId, prompt = 'Diga apenas: OK' } = req.body;

  if (!modelId) {
    return res.status(400).json({
      success: false,
      error: 'modelId é obrigatório'
    });
  }

  console.log(`\n🔍 [Diagnostic] Testando modelo específico: ${modelId}\n`);

  try {
    const startTime = Date.now();

    const response = await conversar(prompt, {
      modelo: modelId,
      systemPrompt: 'Você é um assistente de teste.',
      temperature: 0.1,
      maxTokens: 1000,
      enableTools: false,
      enableCache: false
    });

    const elapsedTime = Date.now() - startTime;

    if (response.sucesso === true) {
      res.json({
        success: true,
        modelId,
        response: response.resposta,
        latency: elapsedTime,
        usage: response.uso
      });
    } else {
      res.json({
        success: false,
        modelId,
        error: response.erro,
        statusCode: response.statusCode,
        latency: elapsedTime
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      modelId,
      error: error.message,
      stack: error.stack
    });
  }
});

/**
 * GET /api/diagnostic/models/env
 *
 * Verifica variáveis de ambiente AWS
 */
router.get('/env', requireAuth, async (req, res) => {
  const awsEnv = {
    AWS_REGION: process.env.AWS_REGION || null,
    AWS_DEFAULT_REGION: process.env.AWS_DEFAULT_REGION || null,
    AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID ? `${process.env.AWS_ACCESS_KEY_ID.substring(0, 4)}***` : null,
    AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY ? '***SET***' : null,
    NODE_ENV: process.env.NODE_ENV,
    RENDER: process.env.RENDER || null,
    RENDER_SERVICE_NAME: process.env.RENDER_SERVICE_NAME || null
  };

  // Verificar qual região está sendo usada
  let effectiveRegion = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || 'not set';

  // Verificar se as credenciais estão configuradas
  const credentialsConfigured = !!(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY);

  res.json({
    success: true,
    environment: awsEnv,
    analysis: {
      effectiveRegion,
      credentialsConfigured,
      isProduction: process.env.NODE_ENV === 'production',
      isRender: !!process.env.RENDER,
      recommendations: [
        effectiveRegion === 'us-west-2' ? '✅ Região us-west-2 (Oregon) configurada' : `⚠️  Região ${effectiveRegion} - verifique se os modelos estão disponíveis`,
        credentialsConfigured ? '✅ Credenciais AWS configuradas' : '❌ Credenciais AWS NÃO configuradas',
        'Para Nova Micro e Haiku em us-west-2, use IDs sem prefixo "us.":',
        '  - amazon.nova-micro-v1:0',
        '  - amazon.nova-lite-v1:0',
        '  - anthropic.claude-3-5-haiku-20241022-v1:0',
        '  - anthropic.claude-3-5-sonnet-20241022-v2:0'
      ]
    }
  });
});

export default router;
