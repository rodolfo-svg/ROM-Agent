/**
 * API ROUTES - Configurações de Escritórios Parceiros
 * Permite que cada escritório escolha sua estratégia de IA com alertas de custo
 */

import express from 'express';
import partnerSettings, { ESTRATEGIAS_IA } from './partner-office-settings.js';

const router = express.Router();

// ═══════════════════════════════════════════════════════════════
// ENDPOINTS DE ESTRATÉGIAS
// ═══════════════════════════════════════════════════════════════

/**
 * GET /api/partner/strategies
 * Listar todas as estratégias disponíveis
 */
router.get('/partner/strategies', (req, res) => {
  try {
    const strategies = partnerSettings.listarEstrategias();
    const comparison = partnerSettings.compararEstrategias();

    res.json({
      success: true,
      strategies,
      comparison,
      totalStrategies: strategies.length
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/partner/:officeId/settings
 * Obter configurações de um escritório
 */
router.get('/partner/:officeId/settings', (req, res) => {
  try {
    const { officeId } = req.params;
    const settings = partnerSettings.getSettings(officeId);

    res.json({
      success: true,
      settings
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/partner/:officeId/settings
 * Criar ou atualizar configurações de um escritório
 */
router.post('/partner/:officeId/settings', (req, res) => {
  try {
    const { officeId } = req.params;
    const {
      officeName,
      estrategia = 'balanceado',
      limitesMensais = null,
      alertas = true
    } = req.body;

    if (!officeName) {
      return res.status(400).json({
        success: false,
        error: 'officeName é obrigatório'
      });
    }

    const result = partnerSettings.createOfficeSettings({
      officeId,
      officeName,
      estrategia,
      limitesMensais,
      alertas
    });

    res.json({
      success: result.success,
      message: 'Configurações criadas com sucesso',
      settings: partnerSettings.getSettings(officeId)
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * PUT /api/partner/:officeId/strategy
 * Atualizar estratégia de um escritório
 */
router.put('/partner/:officeId/strategy', (req, res) => {
  try {
    const { officeId } = req.params;
    const { estrategia } = req.body;

    if (!estrategia) {
      return res.status(400).json({
        success: false,
        error: 'estrategia é obrigatória'
      });
    }

    const result = partnerSettings.updateEstrategia(officeId, estrategia);

    if (!result.success) {
      return res.status(400).json(result);
    }

    res.json({
      success: true,
      message: `Estratégia atualizada para: ${estrategia}`,
      settings: partnerSettings.getSettings(officeId)
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * PUT /api/partner/:officeId/limits
 * Atualizar limites de custo de um escritório
 */
router.put('/partner/:officeId/limits', (req, res) => {
  try {
    const { officeId } = req.params;
    const novosLimites = req.body;

    const result = partnerSettings.updateLimites(officeId, novosLimites);

    if (!result.success) {
      return res.status(400).json(result);
    }

    res.json({
      success: true,
      message: 'Limites atualizados com sucesso',
      settings: partnerSettings.getSettings(officeId)
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/partner/:officeId/operation
 * Registrar operação e calcular custo
 */
router.post('/partner/:officeId/operation', (req, res) => {
  try {
    const { officeId } = req.params;
    const {
      modelo,
      inputTokens,
      outputTokens,
      custo,
      tier
    } = req.body;

    if (!modelo || !custo || !tier) {
      return res.status(400).json({
        success: false,
        error: 'modelo, custo e tier são obrigatórios'
      });
    }

    const result = partnerSettings.registrarOperacao(officeId, {
      modelo,
      inputTokens,
      outputTokens,
      custo,
      tier
    });

    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/partner/:officeId/statistics
 * Obter estatísticas de uso de um escritório
 */
router.get('/partner/:officeId/statistics', (req, res) => {
  try {
    const { officeId } = req.params;
    const stats = partnerSettings.getEstatisticas(officeId);

    res.json({
      success: true,
      statistics: stats
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/partner/:officeId/recommended-model
 * Obter modelo recomendado baseado na estratégia configurada
 */
router.get('/partner/:officeId/recommended-model', (req, res) => {
  try {
    const { officeId } = req.params;
    const { complexity = 2 } = req.query;

    const modelo = partnerSettings.getModeloRecomendado(
      officeId,
      parseInt(complexity)
    );

    const settings = partnerSettings.getSettings(officeId);

    res.json({
      success: true,
      officeId,
      complexity: parseInt(complexity),
      recommendedModel: modelo,
      strategy: {
        id: settings.estrategia,
        nome: settings.estrategiaConfig.nome,
        icone: settings.estrategiaConfig.icone
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ═══════════════════════════════════════════════════════════════
// ENDPOINT COM ALERTA DE CUSTO
// ═══════════════════════════════════════════════════════════════

/**
 * POST /api/partner/:officeId/chat-with-cost-alert
 * Processar mensagem com alerta de custo em tempo real
 */
router.post('/partner/:officeId/chat-with-cost-alert', async (req, res) => {
  try {
    const { officeId } = req.params;
    const { message, complexity = null } = req.body;

    if (!message) {
      return res.status(400).json({
        success: false,
        error: 'message é obrigatória'
      });
    }

    // Obter configurações do escritório
    const settings = partnerSettings.getSettings(officeId);

    // Obter modelo recomendado
    const detectedComplexity = complexity || 2; // Auto-detect ou default
    const modelo = partnerSettings.getModeloRecomendado(officeId, detectedComplexity);

    // Estimar custo ANTES de executar
    const inputTokens = Math.ceil(message.length / 4);
    const outputTokens = 2000; // Estimativa

    // Calcular custo estimado (simplificado)
    const tierCosts = {
      1: 0.0003,  // Gratuito/barato
      2: 0.0008,  // Econômico
      3: 0.0030,  // Intermediário
      4: 0.0150   // Premium
    };

    const tier = settings.estrategiaConfig.distribuicao.premium > 50 ? 4 :
                 settings.estrategiaConfig.distribuicao.intermediarios > 30 ? 3 :
                 settings.estrategiaConfig.distribuicao.economicos > 30 ? 2 : 1;

    const custoEstimado = (inputTokens + outputTokens) * tierCosts[tier];

    // Verificar limite
    const stats = partnerSettings.getEstatisticas(officeId);
    const custoAtual = parseFloat(stats.custo.total);
    const limiteMax = parseFloat(stats.custo.limite);
    const custoAposOperacao = custoAtual + custoEstimado;
    const percentualApos = (custoAposOperacao / limiteMax * 100).toFixed(1);

    // Criar alerta se necessário
    let alerta = null;
    if (percentualApos >= 95) {
      alerta = {
        nivel: 'critico',
        icone: '🚨',
        cor: '#f56565',
        mensagem: `CRÍTICO: ${percentualApos}% do limite mensal ($${custoAposOperacao.toFixed(2)} de $${limiteMax.toFixed(2)})`,
        recomendacao: 'Considere usar estratégia de Economia Máxima ou aumentar limite'
      };
    } else if (percentualApos >= 80) {
      alerta = {
        nivel: 'alerta',
        icone: '⚠️',
        cor: '#ed8936',
        mensagem: `ALERTA: ${percentualApos}% do limite mensal ($${custoAposOperacao.toFixed(2)} de $${limiteMax.toFixed(2)})`,
        recomendacao: 'Monitore o uso. Considere ajustar estratégia se necessário'
      };
    } else if (percentualApos >= 50) {
      alerta = {
        nivel: 'info',
        icone: 'ℹ️',
        cor: '#4299e1',
        mensagem: `INFO: ${percentualApos}% do limite mensal ($${custoAposOperacao.toFixed(2)} de $${limiteMax.toFixed(2)})`,
        recomendacao: 'Uso normal. Continue monitorando'
      };
    }

    // Retornar informação de custo SEM executar ainda
    // (O frontend pode mostrar e pedir confirmação do usuário)
    res.json({
      success: true,
      preview: {
        message: 'Prévia de custo calculada. Execute para processar.',
        officeId,
        modelo,
        complexity: detectedComplexity,
        tier,
        custoEstimado: custoEstimado.toFixed(6),
        custoAtual: custoAtual.toFixed(2),
        custoAposOperacao: custoAposOperacao.toFixed(2),
        limiteMax: limiteMax.toFixed(2),
        percentualApos: percentualApos + '%',
        alerta,
        estrategia: {
          id: settings.estrategia,
          nome: settings.estrategiaConfig.nome,
          icone: settings.estrategiaConfig.icone
        }
      },
      // Para executar, frontend deve chamar /api/chat/cascade ou /api/chat com confirmação
      executeUrl: '/api/chat/cascade',
      confirmRequired: alerta && alerta.nivel === 'critico'
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ═══════════════════════════════════════════════════════════════
// EXPORTAR
// ═══════════════════════════════════════════════════════════════

export default router;
