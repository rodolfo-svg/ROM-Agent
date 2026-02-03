/**
 * Multi-Step Generation Routes
 *
 * Endpoints para geração de documentos grandes em múltiplas etapas
 */

import express from 'express';
import { continuationManager } from '../modules/continuation-manager.js';
import { conversar } from '../modules/bedrock.js';
import { logger } from '../utils/logger.js';

const router = express.Router();

/**
 * POST /api/generate/multi-step/plan
 * Planeja geração multi-step sem executar
 * Retorna número de etapas e tempo estimado
 */
router.post('/plan', async (req, res) => {
  try {
    const { documentType, totalPages } = req.body;

    if (!documentType || !totalPages) {
      return res.status(400).json({
        success: false,
        error: 'Parâmetros obrigatórios: documentType, totalPages'
      });
    }

    if (totalPages <= 35) {
      return res.json({
        success: true,
        requiresMultiStep: false,
        message: 'Documento pode ser gerado em passe único (até 35 páginas)',
        recommendation: 'Use endpoint normal de geração (/api/chat)',
        totalPages,
        estimatedMinutes: continuationManager.estimateTime(totalPages)
      });
    }

    // Planeja etapas
    const steps = continuationManager.splitIntoSteps(totalPages, documentType);
    const totalTime = steps.reduce((sum, step) => sum + step.estimatedMinutes, 0);

    res.json({
      success: true,
      requiresMultiStep: true,
      totalSteps: steps.length,
      totalPages,
      estimatedMinutes: totalTime,
      steps: steps.map(s => ({
        step: s.step,
        pages: s.pages,
        estimatedMinutes: s.estimatedMinutes,
        section: s.sectionDescription
      })),
      message: `Documento será gerado em ${steps.length} etapas (~${totalTime} minutos total)`
    });

  } catch (error) {
    logger.error('[Multi-Step Plan] Erro:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/generate/multi-step/execute
 * Executa geração multi-step completa
 * Gera documento em múltiplas etapas e retorna documento completo
 */
router.post('/execute', async (req, res) => {
  try {
    const {
      documentType,
      theme,
      totalPages,
      partnerId = 'rom',
      conversationId,
      additionalInstructions = ''
    } = req.body;

    // Validações
    if (!documentType || !theme || !totalPages) {
      return res.status(400).json({
        success: false,
        error: 'Parâmetros obrigatórios: documentType, theme, totalPages'
      });
    }

    if (totalPages <= 35) {
      return res.status(400).json({
        success: false,
        error: 'Para documentos até 35 páginas, use endpoint normal. Multi-step é apenas para >35 páginas.',
        recommendation: 'Use /api/chat com prompt minimalista'
      });
    }

    // Planeja etapas
    const steps = continuationManager.splitIntoSteps(totalPages, documentType);
    logger.info(`[Multi-Step Execute] Iniciando geração de ${totalPages} páginas em ${steps.length} etapas`);

    const parts = [];
    const stepResults = [];
    let currentConversationId = conversationId || `multi_${Date.now()}`;

    // Gera cada etapa
    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];

      logger.info(`[Multi-Step Execute] Etapa ${step.step}/${steps.length} - ${step.pages} páginas`);

      // Gera prompt para esta etapa
      const prompt = continuationManager.buildStepPrompt({
        step: step.step,
        pages: step.pages,
        documentType,
        theme,
        isFirstStep: step.isFirstStep,
        isLastStep: step.isLastStep,
        additionalInstructions
      });

      logger.info(`[Multi-Step Execute] Prompt etapa ${step.step}: ${prompt.substring(0, 100)}...`);

      const startTime = Date.now();

      try {
        // Chama Bedrock para gerar esta parte
        const result = await conversar(prompt, currentConversationId, partnerId);

        const elapsedTime = Math.round((Date.now() - startTime) / 1000);

        // Extrai resposta
        const response = result.response || result;

        parts.push(response);

        stepResults.push({
          step: step.step,
          pages: step.pages,
          success: true,
          elapsedSeconds: elapsedTime,
          characterCount: response.length,
          estimatedTokens: Math.round(response.length / 4)
        });

        logger.info(`[Multi-Step Execute] Etapa ${step.step} concluída em ${elapsedTime}s - ${response.length} caracteres`);

      } catch (error) {
        logger.error(`[Multi-Step Execute] Erro na etapa ${step.step}:`, error);

        stepResults.push({
          step: step.step,
          pages: step.pages,
          success: false,
          error: error.message
        });

        // Em caso de erro, retorna o que foi gerado até agora
        return res.status(500).json({
          success: false,
          error: `Erro na etapa ${step.step}: ${error.message}`,
          partialResult: {
            stepsCompleted: i,
            totalSteps: steps.length,
            partsGenerated: parts.length,
            stepResults
          }
        });
      }
    }

    // Valida partes geradas
    const validation = continuationManager.validateParts(parts, steps.length);

    if (!validation.isValid) {
      logger.error('[Multi-Step Execute] Validação falhou:', validation.errors);
    }

    // Mescla partes em documento único
    const finalDocument = continuationManager.mergeParts(parts, {
      documentType,
      removeHeaders: true
    });

    // Calcula estatísticas
    const statistics = continuationManager.getStatistics(steps, parts);

    logger.info('[Multi-Step Execute] Concluído com sucesso');
    logger.info(`[Multi-Step Execute] Estatísticas:`, statistics);

    res.json({
      success: true,
      document: finalDocument,
      metadata: {
        documentType,
        theme,
        totalPages,
        totalSteps: steps.length,
        stepsCompleted: steps.length,
        conversationId: currentConversationId,
        partnerId
      },
      statistics,
      stepResults,
      validation: {
        isValid: validation.isValid,
        warnings: validation.warnings
      },
      message: `Documento de ${totalPages} páginas gerado com sucesso em ${steps.length} etapas`
    });

  } catch (error) {
    logger.error('[Multi-Step Execute] Erro geral:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/generate/multi-step/step
 * Gera apenas uma etapa específica (para geração incremental no frontend)
 */
router.post('/step', async (req, res) => {
  try {
    const {
      documentType,
      theme,
      totalPages,
      stepNumber,
      previousParts = [],
      partnerId = 'rom',
      conversationId,
      additionalInstructions = ''
    } = req.body;

    if (!documentType || !theme || !totalPages || !stepNumber) {
      return res.status(400).json({
        success: false,
        error: 'Parâmetros obrigatórios: documentType, theme, totalPages, stepNumber'
      });
    }

    // Planeja etapas
    const steps = continuationManager.splitIntoSteps(totalPages, documentType);

    // Valida número da etapa
    if (stepNumber < 1 || stepNumber > steps.length) {
      return res.status(400).json({
        success: false,
        error: `stepNumber inválido. Deve estar entre 1 e ${steps.length}`
      });
    }

    const step = steps[stepNumber - 1];

    // Gera prompt para esta etapa
    const prompt = continuationManager.buildStepPrompt({
      step: step.step,
      pages: step.pages,
      documentType,
      theme,
      isFirstStep: step.isFirstStep,
      isLastStep: step.isLastStep,
      additionalInstructions
    });

    logger.info(`[Multi-Step Step] Gerando etapa ${stepNumber}/${steps.length}`);

    const startTime = Date.now();

    // Chama Bedrock
    const result = await conversar(
      prompt,
      conversationId || `multi_${Date.now()}`,
      partnerId
    );

    const elapsedTime = Math.round((Date.now() - startTime) / 1000);
    const response = result.response || result;

    logger.info(`[Multi-Step Step] Etapa ${stepNumber} concluída em ${elapsedTime}s`);

    res.json({
      success: true,
      step: stepNumber,
      totalSteps: steps.length,
      pages: step.pages,
      content: response,
      isFirstStep: step.isFirstStep,
      isLastStep: step.isLastStep,
      elapsedSeconds: elapsedTime,
      characterCount: response.length,
      estimatedTokens: Math.round(response.length / 4),
      nextStep: stepNumber < steps.length ? stepNumber + 1 : null
    });

  } catch (error) {
    logger.error('[Multi-Step Step] Erro:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/generate/multi-step/merge
 * Mescla múltiplas partes geradas separadamente
 */
router.post('/merge', async (req, res) => {
  try {
    const { parts, documentType, removeHeaders = true } = req.body;

    if (!parts || !Array.isArray(parts) || parts.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Parâmetro obrigatório: parts (array de strings)'
      });
    }

    logger.info(`[Multi-Step Merge] Mesclando ${parts.length} partes`);

    // Valida partes
    const validation = continuationManager.validateParts(parts, parts.length);

    // Mescla
    const finalDocument = continuationManager.mergeParts(parts, {
      documentType,
      removeHeaders
    });

    res.json({
      success: true,
      document: finalDocument,
      partsCount: parts.length,
      totalCharacters: finalDocument.length,
      estimatedTokens: Math.round(finalDocument.length / 4),
      validation: {
        isValid: validation.isValid,
        warnings: validation.warnings,
        errors: validation.errors
      }
    });

  } catch (error) {
    logger.error('[Multi-Step Merge] Erro:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;
