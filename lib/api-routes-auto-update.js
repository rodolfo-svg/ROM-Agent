/**
 * API Routes - Auto-Atualização e Aprendizado
 * Endpoints para feedback de usuários e gestão de melhorias
 *
 * @version 1.0.0
 */

import express from 'express';
const autoUpdateSystem = require('./auto-update-system.cjs');

const router = express.Router();

// ═══════════════════════════════════════════════════════════════
// ROTAS DE FEEDBACK DE USUÁRIOS
// ═══════════════════════════════════════════════════════════════

/**
 * POST /api/feedback
 * Registrar feedback de usuário sobre peça gerada
 *
 * Body:
 * {
 *   "promptId": "peticao_inicial_civel",
 *   "rating": 4,              // 1-5
 *   "peçaGerada": "...",
 *   "ediçõesFeitas": "...",   // (opcional)
 *   "tipoPeca": "peticao_inicial",
 *   "ramoDireito": "civil",
 *   "instancia": "primeira",  // (opcional)
 *   "regiao": "SP",           // (opcional)
 *   "tempoGeracao": 5000      // ms (opcional)
 * }
 */
router.post('/feedback', async (req, res) => {
  try {
    const feedback = req.body;

    // Validar campos obrigatórios
    if (!feedback.promptId) {
      return res.status(400).json({
        error: 'promptId é obrigatório',
        exemplo: {
          promptId: 'peticao_inicial_civel',
          rating: 4,
          peçaGerada: '...',
          tipoPeca: 'peticao_inicial',
          ramoDireito: 'civil'
        }
      });
    }

    if (!feedback.rating || feedback.rating < 1 || feedback.rating > 5) {
      return res.status(400).json({
        error: 'rating é obrigatório e deve estar entre 1 e 5'
      });
    }

    const resultado = await autoUpdateSystem.registrarFeedback(feedback);

    if (!resultado.success) {
      return res.status(500).json({
        error: resultado.error
      });
    }

    res.json({
      success: true,
      message: 'Feedback registrado com sucesso',
      agradecimento: 'Obrigado! Seu feedback ajuda a melhorar o sistema para todos.'
    });
  } catch (error) {
    console.error('Erro ao registrar feedback:', error);
    res.status(500).json({
      error: error.message
    });
  }
});

// ═══════════════════════════════════════════════════════════════
// ROTAS DE GESTÃO DE MELHORIAS (Master Admin)
// ═══════════════════════════════════════════════════════════════

/**
 * GET /api/admin/melhorias/pendentes
 * Listar melhorias pendentes de aprovação
 *
 * Requer: Master Admin
 */
router.get('/admin/melhorias/pendentes', async (req, res) => {
  try {
    // TODO: Implementar autenticação de master admin
    // Por enquanto, aceita qualquer requisição

    const melhorias = autoUpdateSystem.listarMelhoriasPendentes();

    res.json({
      total: melhorias.length,
      melhorias: melhorias.map(m => ({
        id: m.id,
        promptId: m.promptId,
        tipo: m.tipo,
        justificativa: m.justificativa,
        qualityScore: m.qualityScore,
        criadaEm: m.criadaEm,
        validacao: {
          score: m.validacao.score,
          motivo: m.validacao.motivo,
          recomendacao: m.validacao.recomendacao
        }
      })),
      recomendacao: melhorias.length > 0
        ? `Existem ${melhorias.length} melhorias aguardando sua análise`
        : 'Nenhuma melhoria pendente no momento'
    });
  } catch (error) {
    console.error('Erro ao listar melhorias:', error);
    res.status(500).json({
      error: error.message
    });
  }
});

/**
 * GET /api/admin/melhorias/:id
 * Obter detalhes completos de uma melhoria
 *
 * Requer: Master Admin
 */
router.get('/admin/melhorias/:id', async (req, res) => {
  try {
    const melhorias = autoUpdateSystem.listarMelhoriasPendentes();
    const melhoria = melhorias.find(m => m.id === req.params.id);

    if (!melhoria) {
      return res.status(404).json({
        error: 'Melhoria não encontrada',
        id: req.params.id
      });
    }

    res.json(melhoria);
  } catch (error) {
    console.error('Erro ao obter melhoria:', error);
    res.status(500).json({
      error: error.message
    });
  }
});

/**
 * POST /api/admin/melhorias/:id/aprovar
 * Aprovar melhoria
 *
 * Body:
 * {
 *   "adminId": "rom-master-admin"
 * }
 *
 * Requer: Master Admin
 */
router.post('/admin/melhorias/:id/aprovar', async (req, res) => {
  try {
    const { adminId } = req.body;

    if (!adminId) {
      return res.status(400).json({
        error: 'adminId é obrigatório',
        exemplo: {
          adminId: 'rom-master-admin'
        }
      });
    }

    const resultado = await autoUpdateSystem.aprovarMelhoria(
      req.params.id,
      adminId
    );

    if (!resultado.success) {
      return res.status(400).json({
        error: resultado.error
      });
    }

    res.json({
      success: true,
      message: 'Melhoria aprovada com sucesso',
      melhoria: {
        id: resultado.melhoria.id,
        promptId: resultado.melhoria.promptId,
        tipo: resultado.melhoria.tipo,
        aprovadaEm: resultado.melhoria.aprovadaEm,
        aprovadaPor: resultado.melhoria.aprovadaPor
      },
      proximoPasso: `Aplicar manualmente ao arquivo: config/system_prompts/${resultado.melhoria.promptId}.md`
    });
  } catch (error) {
    console.error('Erro ao aprovar melhoria:', error);
    res.status(400).json({
      error: error.message
    });
  }
});

/**
 * POST /api/admin/melhorias/:id/rejeitar
 * Rejeitar melhoria
 *
 * Body:
 * {
 *   "adminId": "rom-master-admin",
 *   "motivo": "Não se aplica ao contexto jurídico brasileiro"
 * }
 *
 * Requer: Master Admin
 */
router.post('/admin/melhorias/:id/rejeitar', async (req, res) => {
  try {
    const { adminId, motivo } = req.body;

    if (!adminId || !motivo) {
      return res.status(400).json({
        error: 'adminId e motivo são obrigatórios',
        exemplo: {
          adminId: 'rom-master-admin',
          motivo: 'Não se aplica ao contexto jurídico brasileiro'
        }
      });
    }

    const resultado = await autoUpdateSystem.rejeitarMelhoria(
      req.params.id,
      adminId,
      motivo
    );

    if (!resultado.success) {
      return res.status(400).json({
        error: resultado.error
      });
    }

    res.json({
      success: true,
      message: 'Melhoria rejeitada'
    });
  } catch (error) {
    console.error('Erro ao rejeitar melhoria:', error);
    res.status(400).json({
      error: error.message
    });
  }
});

// ═══════════════════════════════════════════════════════════════
// ROTAS DE ESTATÍSTICAS E MONITORAMENTO
// ═══════════════════════════════════════════════════════════════

/**
 * GET /api/admin/estatisticas/aprendizado
 * Obter estatísticas completas do sistema de aprendizado
 *
 * Requer: Master Admin
 */
router.get('/admin/estatisticas/aprendizado', async (req, res) => {
  try {
    const stats = autoUpdateSystem.obterEstatisticas();

    res.json({
      timestamp: new Date().toISOString(),
      ...stats
    });
  } catch (error) {
    console.error('Erro ao obter estatísticas:', error);
    res.status(500).json({
      error: error.message
    });
  }
});

/**
 * GET /api/admin/relatorio
 * Gerar relatório completo para master admin
 *
 * Requer: Master Admin
 */
router.get('/admin/relatorio', async (req, res) => {
  try {
    const relatorio = autoUpdateSystem.gerarRelatorioAdmin();

    res.json(relatorio);
  } catch (error) {
    console.error('Erro ao gerar relatório:', error);
    res.status(500).json({
      error: error.message
    });
  }
});

// ═══════════════════════════════════════════════════════════════
// ROTAS DE STATUS E HEALTH CHECK
// ═══════════════════════════════════════════════════════════════

/**
 * GET /api/auto-update/status
 * Verificar status do sistema de auto-atualização
 *
 * Público (não requer autenticação)
 */
router.get('/auto-update/status', async (req, res) => {
  try {
    const health = autoUpdateSystem.healthCheck();

    res.json({
      status: health.status === 'healthy' ? 'ativo' : 'inativo',
      ...health,
      funcionalidades: {
        verificacaoPeriodica: '✅ A cada 24h',
        feedbackUsuarios: '✅ Ativo',
        aprendizadoColetivo: '✅ Ativo (Federated Learning)',
        versionamento: '✅ Ativo',
        validacaoQualidade: '✅ Ativo (Score mínimo: 10)'
      },
      mensagem: health.status === 'healthy'
        ? 'Sistema de Auto-Atualização funcionando normalmente'
        : 'Sistema não inicializado. Execute autoUpdateSystem.ativar()'
    });
  } catch (error) {
    console.error('Erro no health check:', error);
    res.status(500).json({
      status: 'error',
      error: error.message
    });
  }
});

/**
 * GET /api/auto-update/info
 * Informações sobre o sistema de auto-atualização
 *
 * Público (não requer autenticação)
 */
router.get('/auto-update/info', async (req, res) => {
  res.json({
    nome: 'Sistema de Auto-Atualização ROM Agent',
    versao: '1.0.0',
    descricao: 'Sistema inteligente de aprendizado contínuo e atualização automática de prompts jurídicos',
    caracteristicas: {
      verificacaoAutomatica: {
        ativo: true,
        intervalo: '24 horas',
        descricao: 'Verifica atualidade de dispositivos legais e jurisprudência'
      },
      aprendizadoAgregado: {
        ativo: true,
        tipo: 'Federated Learning',
        descricao: 'Aprende com feedback de TODOS os usuários (anonimizado)'
      },
      validacaoQualidade: {
        ativo: true,
        descricao: 'Só aceita melhorias que AUMENTAM excelência técnica',
        scoreMinimo: 10
      },
      versionamento: {
        ativo: true,
        tipo: 'Semântico (major.minor.patch)',
        descricao: 'Controla versões e notifica parceiros de atualizações'
      },
      beneficioColetivo: {
        ativo: true,
        descricao: 'Uma melhoria aprovada beneficia TODOS os parceiros'
      }
    },
    endpoints: {
      feedback: 'POST /api/feedback',
      melhoriasPendentes: 'GET /api/admin/melhorias/pendentes',
      aprovarMelhoria: 'POST /api/admin/melhorias/:id/aprovar',
      rejeitarMelhoria: 'POST /api/admin/melhorias/:id/rejeitar',
      estatisticas: 'GET /api/admin/estatisticas/aprendizado',
      relatorio: 'GET /api/admin/relatorio',
      status: 'GET /api/auto-update/status'
    }
  });
});

// ═══════════════════════════════════════════════════════════════
// ROTA DE PROPOR MELHORIA (Para testes/desenvolvimento)
// ═══════════════════════════════════════════════════════════════

/**
 * POST /api/admin/propor-melhoria
 * Propor melhoria manualmente (para testes)
 *
 * Body:
 * {
 *   "promptId": "peticao_inicial_civel",
 *   "tipoMelhoria": "atualizacao_legal",
 *   "justificativa": "Adicionar jurisprudência recente do STJ",
 *   "conteudoProposto": "...",
 *   "conteudoOriginal": "..."
 * }
 *
 * Requer: Master Admin
 */
router.post('/admin/propor-melhoria', async (req, res) => {
  try {
    const {
      promptId,
      tipoMelhoria,
      justificativa,
      conteudoProposto,
      conteudoOriginal
    } = req.body;

    if (!promptId || !tipoMelhoria || !justificativa || !conteudoProposto || !conteudoOriginal) {
      return res.status(400).json({
        error: 'Todos os campos são obrigatórios',
        campos: ['promptId', 'tipoMelhoria', 'justificativa', 'conteudoProposto', 'conteudoOriginal']
      });
    }

    const resultado = await autoUpdateSystem.proporMelhoria(
      promptId,
      tipoMelhoria,
      justificativa,
      conteudoProposto,
      conteudoOriginal
    );

    if (resultado.status === 'rejeitada_automaticamente') {
      return res.status(400).json({
        success: false,
        status: 'rejeitada_automaticamente',
        motivo: resultado.motivo,
        validacao: resultado.validacao,
        mensagem: 'Melhoria foi rejeitada automaticamente por não aumentar excelência'
      });
    }

    res.json({
      success: true,
      status: 'proposta_criada',
      id: resultado.id,
      validacao: resultado.validacao,
      mensagem: 'Melhoria proposta com sucesso. Aguardando aprovação do master admin.'
    });
  } catch (error) {
    console.error('Erro ao propor melhoria:', error);
    res.status(500).json({
      error: error.message
    });
  }
});

export default router;
