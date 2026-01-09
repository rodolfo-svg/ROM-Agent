/**
 * DIAGNOSTIC BEDROCK ROUTE
 * Endpoint para diagnosticar problemas com Bedrock
 */

import express from 'express';
import { BedrockRuntimeClient, ConverseCommand } from '@aws-sdk/client-bedrock-runtime';

const router = express.Router();

router.get('/test', async (req, res) => {
  const results = [];
  const region = process.env.AWS_REGION || 'us-west-2';

  results.push({
    step: 'Config',
    region,
    hasAccessKey: !!process.env.AWS_ACCESS_KEY_ID,
    hasSecretKey: !!process.env.AWS_SECRET_ACCESS_KEY
  });

  const modelsToTest = [
    'anthropic.claude-3-5-sonnet-20241022-v2:0',
    'anthropic.claude-sonnet-4-5-20250929-v1:0',
    'us.anthropic.claude-3-5-sonnet-20241022-v2:0',
    'global.anthropic.claude-sonnet-4-5-20250929-v1:0'
  ];

  for (const modelId of modelsToTest) {
    try {
      const client = new BedrockRuntimeClient({ region });
      const command = new ConverseCommand({
        modelId,
        messages: [{
          role: 'user',
          content: [{ text: 'Responda: OK' }]
        }],
        inferenceConfig: {
          maxTokens: 10,
          temperature: 0
        }
      });

      const startTime = Date.now();
      const response = await client.send(command);
      const latency = Date.now() - startTime;

      results.push({
        step: 'Test Model',
        modelId,
        success: true,
        latency: `${latency}ms`,
        response: response.output?.message?.content?.[0]?.text || 'OK'
      });

      break; // Se funcionou, não precisa testar outros
    } catch (error) {
      results.push({
        step: 'Test Model',
        modelId,
        success: false,
        error: error.name,
        message: error.message,
        code: error.$metadata?.httpStatusCode || error.code
      });
    }
  }

  res.json({
    timestamp: new Date().toISOString(),
    results
  });
});

export default router;
