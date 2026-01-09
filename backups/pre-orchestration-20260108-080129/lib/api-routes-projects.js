/**
 * API ROUTES - PROJECTS & CODE EXECUTION
 * Rotas REST para sistema de projetos e execução de código
 */

import express from 'express';
import multer from 'multer';
import projectsManager from './projects-manager.js';
import codeExecutor from './code-executor.js';

const router = express.Router();

// Configurar multer para upload de arquivos
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 100 * 1024 * 1024 // 100 MB
  }
});

// ═══════════════════════════════════════════════════════════════
// ROTAS DE PROJETOS
// ═══════════════════════════════════════════════════════════════

/**
 * GET /api/projects
 * Listar todos os projetos
 */
router.get('/projects', async (req, res) => {
  try {
    const { owner, search, limit, offset } = req.query;

    const result = projectsManager.listProjects({
      owner,
      search,
      limit: limit ? parseInt(limit) : undefined,
      offset: offset ? parseInt(offset) : undefined
    });

    res.json(result);
  } catch (error) {
    res.status(500).json({
      error: error.message,
      message: 'Erro ao listar projetos'
    });
  }
});

/**
 * GET /api/projects/:id
 * Obter projeto específico
 */
router.get('/projects/:id', async (req, res) => {
  try {
    const project = projectsManager.getProject(req.params.id);
    res.json(project);
  } catch (error) {
    res.status(404).json({
      error: error.message,
      message: 'Projeto não encontrado'
    });
  }
});

/**
 * POST /api/projects
 * Criar novo projeto
 */
router.post('/projects', async (req, res) => {
  try {
    const {
      name,
      description,
      customInstructions,
      icon,
      color,
      owner
    } = req.body;

    if (!name) {
      return res.status(400).json({
        error: 'Nome do projeto é obrigatório'
      });
    }

    const project = projectsManager.createProject({
      name,
      description,
      customInstructions,
      icon,
      color,
      owner: owner || 'default'
    });

    res.status(201).json(project);
  } catch (error) {
    res.status(400).json({
      error: error.message,
      message: 'Erro ao criar projeto'
    });
  }
});

/**
 * PUT /api/projects/:id
 * Atualizar projeto
 */
router.put('/projects/:id', async (req, res) => {
  try {
    const updates = req.body;
    const project = projectsManager.updateProject(req.params.id, updates);

    res.json(project);
  } catch (error) {
    res.status(400).json({
      error: error.message,
      message: 'Erro ao atualizar projeto'
    });
  }
});

/**
 * DELETE /api/projects/:id
 * Deletar projeto
 */
router.delete('/projects/:id', async (req, res) => {
  try {
    projectsManager.deleteProject(req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(400).json({
      error: error.message,
      message: 'Erro ao deletar projeto'
    });
  }
});

/**
 * POST /api/projects/:id/duplicate
 * Duplicar projeto
 */
router.post('/projects/:id/duplicate', async (req, res) => {
  try {
    const { name, owner } = req.body;
    const duplicate = projectsManager.duplicateProject(
      req.params.id,
      name,
      owner
    );

    res.status(201).json(duplicate);
  } catch (error) {
    res.status(400).json({
      error: error.message,
      message: 'Erro ao duplicar projeto'
    });
  }
});

/**
 * GET /api/projects/:id/context
 * Obter contexto do projeto (custom instructions + KB)
 */
router.get('/projects/:id/context', async (req, res) => {
  try {
    const context = projectsManager.getProjectContext(req.params.id);
    res.json({ context });
  } catch (error) {
    res.status(404).json({
      error: error.message
    });
  }
});

// ═══════════════════════════════════════════════════════════════
// ROTAS DE KNOWLEDGE BASE
// ═══════════════════════════════════════════════════════════════

/**
 * POST /api/projects/:id/knowledge-base
 * Adicionar arquivo à knowledge base
 */
router.post('/projects/:id/knowledge-base', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        error: 'Nenhum arquivo enviado'
      });
    }

    const fileData = {
      originalName: req.file.originalname,
      buffer: req.file.buffer,
      size: req.file.size,
      type: req.file.mimetype,
      uploadedBy: req.body.uploadedBy || 'unknown'
    };

    const file = await projectsManager.addToKnowledgeBase(
      req.params.id,
      fileData
    );

    res.status(201).json(file);
  } catch (error) {
    res.status(400).json({
      error: error.message,
      message: 'Erro ao adicionar arquivo'
    });
  }
});

/**
 * DELETE /api/projects/:id/knowledge-base/:fileId
 * Remover arquivo da knowledge base
 */
router.delete('/projects/:id/knowledge-base/:fileId', async (req, res) => {
  try {
    projectsManager.removeFromKnowledgeBase(
      req.params.id,
      req.params.fileId
    );

    res.json({ success: true });
  } catch (error) {
    res.status(400).json({
      error: error.message,
      message: 'Erro ao remover arquivo'
    });
  }
});

/**
 * GET /api/projects/:id/knowledge-base/:fileId
 * Download de arquivo da knowledge base
 */
router.get('/projects/:id/knowledge-base/:fileId', async (req, res) => {
  try {
    const filePath = projectsManager.getKnowledgeBaseFilePath(
      req.params.id,
      req.params.fileId
    );

    res.download(filePath);
  } catch (error) {
    res.status(404).json({
      error: error.message,
      message: 'Arquivo não encontrado'
    });
  }
});

// ═══════════════════════════════════════════════════════════════
// ROTAS DE COLABORAÇÃO
// ═══════════════════════════════════════════════════════════════

/**
 * POST /api/projects/:id/collaborators
 * Adicionar colaborador
 */
router.post('/projects/:id/collaborators', async (req, res) => {
  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({
        error: 'userId é obrigatório'
      });
    }

    const project = projectsManager.addCollaborator(req.params.id, userId);
    res.json(project);
  } catch (error) {
    res.status(400).json({
      error: error.message
    });
  }
});

/**
 * DELETE /api/projects/:id/collaborators/:userId
 * Remover colaborador
 */
router.delete('/projects/:id/collaborators/:userId', async (req, res) => {
  try {
    const project = projectsManager.removeCollaborator(
      req.params.id,
      req.params.userId
    );

    res.json(project);
  } catch (error) {
    res.status(400).json({
      error: error.message
    });
  }
});

// ═══════════════════════════════════════════════════════════════
// ROTAS DE CODE EXECUTION
// ═══════════════════════════════════════════════════════════════

/**
 * POST /api/execute/code
 * Executar código
 */
router.post('/execute/code', async (req, res) => {
  try {
    const {
      code,
      language = 'auto',
      timeout,
      input,
      files
    } = req.body;

    if (!code) {
      return res.status(400).json({
        error: 'Código é obrigatório'
      });
    }

    const result = await codeExecutor.execute(code, language, {
      timeout,
      input,
      files
    });

    res.json(result);
  } catch (error) {
    res.status(500).json({
      error: error.message,
      message: 'Erro ao executar código'
    });
  }
});

/**
 * POST /api/execute/python
 * Executar código Python
 */
router.post('/execute/python', async (req, res) => {
  try {
    const { code, timeout, input, files } = req.body;

    if (!code) {
      return res.status(400).json({
        error: 'Código é obrigatório'
      });
    }

    const result = await codeExecutor.executePython(code, {
      timeout,
      input,
      files
    });

    res.json(result);
  } catch (error) {
    res.status(500).json({
      error: error.message,
      message: 'Erro ao executar Python'
    });
  }
});

/**
 * POST /api/execute/javascript
 * Executar código JavaScript
 */
router.post('/execute/javascript', async (req, res) => {
  try {
    const { code, timeout, input } = req.body;

    if (!code) {
      return res.status(400).json({
        error: 'Código é obrigatório'
      });
    }

    const result = await codeExecutor.executeJavaScript(code, {
      timeout,
      input
    });

    res.json(result);
  } catch (error) {
    res.status(500).json({
      error: error.message,
      message: 'Erro ao executar JavaScript'
    });
  }
});

/**
 * GET /api/execute/logs
 * Obter logs de execução
 */
router.get('/execute/logs', async (req, res) => {
  try {
    const { date } = req.query;
    const logs = codeExecutor.getExecutionLogs(date);

    res.json({
      logs,
      total: logs.length,
      date: date || new Date().toISOString().split('T')[0]
    });
  } catch (error) {
    res.status(500).json({
      error: error.message,
      message: 'Erro ao obter logs'
    });
  }
});

/**
 * POST /api/execute/validate
 * Validar código antes de executar
 */
router.post('/execute/validate', async (req, res) => {
  try {
    const { code, language } = req.body;

    if (!code) {
      return res.status(400).json({
        error: 'Código é obrigatório'
      });
    }

    const validation = codeExecutor.validateCode(code, language || 'auto');
    res.json(validation);
  } catch (error) {
    res.status(500).json({
      error: error.message
    });
  }
});

// ═══════════════════════════════════════════════════════════════
// ROTA DE INFO
// ═══════════════════════════════════════════════════════════════

/**
 * GET /api/projects/info
 * Informações sobre o sistema de projetos
 */
router.get('/info/projects', async (req, res) => {
  try {
    const allProjects = projectsManager.listProjects({ limit: 1000 });

    res.json({
      features: {
        projects: true,
        customInstructions: true,
        knowledgeBase: true,
        collaboration: true,
        codeExecution: true
      },
      stats: {
        totalProjects: allProjects.total,
        totalFiles: allProjects.projects.reduce((sum, p) => sum + p.knowledgeBase.length, 0)
      },
      supportedLanguages: ['python', 'javascript'],
      version: '1.0.0'
    });
  } catch (error) {
    res.status(500).json({
      error: error.message
    });
  }
});

export default router;
