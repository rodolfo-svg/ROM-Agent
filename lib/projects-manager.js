/**
 * SISTEMA DE PROJETOS - ROM Agent
 * Igual ao Claude AI: Projetos com custom instructions e knowledge base
 *
 * Funcionalidades:
 * - Criar/editar/deletar projetos
 * - Custom instructions por projeto
 * - Knowledge base (arquivos) por projeto
 * - Compartilhamento de contexto entre conversas
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Diretórios
const PROJECTS_DIR = path.join(__dirname, '../data/projects');
const PROJECTS_INDEX_FILE = path.join(PROJECTS_DIR, 'projects-index.json');
const PROJECTS_KB_DIR = path.join(__dirname, '../data/knowledge-base');

// Criar diretórios se não existirem
[PROJECTS_DIR, PROJECTS_KB_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

/**
 * Classe para gerenciar projetos
 */
class ProjectsManager {
  constructor() {
    this.projects = this.loadProjects();
    this.initializeDefaultProjects();
  }

  /**
   * Carregar projetos do arquivo
   */
  loadProjects() {
    try {
      if (fs.existsSync(PROJECTS_INDEX_FILE)) {
        const data = fs.readFileSync(PROJECTS_INDEX_FILE, 'utf8');
        return JSON.parse(data);
      }
    } catch (error) {
      console.error('Erro ao carregar projetos:', error);
    }
    return {};
  }

  /**
   * Salvar projetos no arquivo
   */
  saveProjects() {
    try {
      fs.writeFileSync(
        PROJECTS_INDEX_FILE,
        JSON.stringify(this.projects, null, 2),
        'utf8'
      );
      return true;
    } catch (error) {
      console.error('Erro ao salvar projetos:', error);
      return false;
    }
  }

  /**
   * Inicializar projetos padrão
   */
  initializeDefaultProjects() {
    // Projeto ROM padrão (se não existir)
    if (!this.projects['rom-agent']) {
      this.createProject({
        id: 'rom-agent',
        name: 'ROM Agent',
        description: 'Projeto principal do ROM - Redator de Obras Magistrais',
        customInstructions: `Você é o ROM (Redator de Obras Magistrais), um assistente jurídico especializado em direito brasileiro.

ESPECIALIDADES:
- Redação de petições jurídicas (cível, criminal, trabalhista, etc)
- Formatação técnica ABNT e CNJ
- Pesquisa de legislação e jurisprudência brasileira
- Análise de processos judiciais
- Correção técnica jurídica especializada

SEMPRE:
- Use linguagem técnica jurídica apropriada
- Cite legislação e jurisprudência quando relevante
- Formate documentos segundo ABNT/CNJ
- Aplique timbrado personalizado quando solicitado
- Valide referências legais (lei, artigo, parágrafo, inciso)

KNOWLEDGE BASE:
Este projeto contém:
- Modelos de petições (70+ tipos)
- Legislação brasileira atualizada
- Jurisprudência dos tribunais superiores
- Manuais de formatação técnica`,
        knowledgeBase: [],
        icon: '⚖️',
        color: '#1a365d',
        isDefault: true,
        owner: 'rom',
        collaborators: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
    }
  }

  /**
   * Gerar ID único para projeto
   */
  generateProjectId(name) {
    const baseId = name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');

    let projectId = baseId;
    let counter = 1;

    while (this.projects[projectId]) {
      projectId = `${baseId}-${counter}`;
      counter++;
    }

    return projectId;
  }

  /**
   * Criar novo projeto
   */
  createProject(params) {
    const {
      id,
      name,
      description = '',
      customInstructions = '',
      knowledgeBase = [],
      icon = '📁',
      color = '#667eea',
      owner = 'default',
      collaborators = [],
      isDefault = false
    } = params;

    const projectId = id || this.generateProjectId(name);

    if (this.projects[projectId] && !id) {
      throw new Error('Projeto com este nome já existe');
    }

    const project = {
      id: projectId,
      name,
      description,
      customInstructions,
      knowledgeBase,
      icon,
      color,
      isDefault,
      owner,
      collaborators,
      settings: {
        shareWithTeam: false,
        allowEditing: true,
        defaultModel: 'sonnet'
      },
      stats: {
        conversations: 0,
        messages: 0,
        lastUsed: null
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    this.projects[projectId] = project;
    this.saveProjects();

    // Criar diretório para knowledge base do projeto
    const projectKBDir = path.join(PROJECTS_KB_DIR, projectId);
    if (!fs.existsSync(projectKBDir)) {
      fs.mkdirSync(projectKBDir, { recursive: true });
    }

    return project;
  }

  /**
   * Obter projeto por ID
   */
  getProject(projectId) {
    const project = this.projects[projectId];
    if (!project) {
      throw new Error('Projeto não encontrado');
    }
    return { ...project };
  }

  /**
   * Listar todos os projetos
   */
  listProjects(filters = {}) {
    const { owner, search, limit = 100, offset = 0 } = filters;

    let projects = Object.values(this.projects);

    // Filtrar por owner
    if (owner) {
      projects = projects.filter(p => p.owner === owner || p.collaborators.includes(owner));
    }

    // Busca por nome/descrição
    if (search) {
      const searchLower = search.toLowerCase();
      projects = projects.filter(p =>
        p.name.toLowerCase().includes(searchLower) ||
        p.description.toLowerCase().includes(searchLower)
      );
    }

    // Ordenar por última atualização
    projects.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));

    // Paginação
    const total = projects.length;
    projects = projects.slice(offset, offset + limit);

    return {
      projects,
      total,
      limit,
      offset
    };
  }

  /**
   * Atualizar projeto
   */
  updateProject(projectId, updates) {
    const project = this.getProject(projectId);

    // Campos que podem ser atualizados
    const allowedFields = [
      'name', 'description', 'customInstructions',
      'icon', 'color', 'collaborators', 'settings'
    ];

    allowedFields.forEach(field => {
      if (updates[field] !== undefined) {
        project[field] = updates[field];
      }
    });

    project.updatedAt = new Date().toISOString();
    this.projects[projectId] = project;
    this.saveProjects();

    return project;
  }

  /**
   * Deletar projeto
   */
  deleteProject(projectId) {
    const project = this.getProject(projectId);

    if (project.isDefault) {
      throw new Error('Não é possível deletar o projeto padrão');
    }

    // Deletar knowledge base do projeto
    const projectKBDir = path.join(PROJECTS_KB_DIR, projectId);
    if (fs.existsSync(projectKBDir)) {
      fs.rmSync(projectKBDir, { recursive: true, force: true });
    }

    delete this.projects[projectId];
    this.saveProjects();

    return true;
  }

  /**
   * Adicionar arquivo à knowledge base do projeto
   */
  async addToKnowledgeBase(projectId, fileData) {
    const project = this.getProject(projectId);
    const projectKBDir = path.join(PROJECTS_KB_DIR, projectId);

    const fileId = crypto.randomBytes(16).toString('hex');
    const fileName = fileData.originalName || fileData.name;
    const ext = path.extname(fileName);
    const savedFileName = `${fileId}${ext}`;
    const filePath = path.join(projectKBDir, savedFileName);

    // Salvar arquivo
    if (fileData.buffer) {
      fs.writeFileSync(filePath, fileData.buffer);
    } else if (fileData.path) {
      fs.copyFileSync(fileData.path, filePath);
    } else {
      throw new Error('Dados de arquivo inválidos');
    }

    const fileEntry = {
      id: fileId,
      name: fileName,
      path: savedFileName,
      size: fileData.size || fs.statSync(filePath).size,
      type: fileData.type || fileData.mimetype,
      uploadedAt: new Date().toISOString(),
      uploadedBy: fileData.uploadedBy || 'unknown'
    };

    project.knowledgeBase.push(fileEntry);
    project.updatedAt = new Date().toISOString();
    this.projects[projectId] = project;
    this.saveProjects();

    return fileEntry;
  }

  /**
   * Remover arquivo da knowledge base
   */
  removeFromKnowledgeBase(projectId, fileId) {
    const project = this.getProject(projectId);
    const fileIndex = project.knowledgeBase.findIndex(f => f.id === fileId);

    if (fileIndex === -1) {
      throw new Error('Arquivo não encontrado na knowledge base');
    }

    const file = project.knowledgeBase[fileIndex];
    const projectKBDir = path.join(PROJECTS_KB_DIR, projectId);
    const filePath = path.join(projectKBDir, file.path);

    // Deletar arquivo físico
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    // Remover do array
    project.knowledgeBase.splice(fileIndex, 1);
    project.updatedAt = new Date().toISOString();
    this.projects[projectId] = project;
    this.saveProjects();

    return true;
  }

  /**
   * Obter caminho de arquivo da knowledge base
   */
  getKnowledgeBaseFilePath(projectId, fileId) {
    const project = this.getProject(projectId);
    const file = project.knowledgeBase.find(f => f.id === fileId);

    if (!file) {
      throw new Error('Arquivo não encontrado');
    }

    const projectKBDir = path.join(PROJECTS_KB_DIR, projectId);
    return path.join(projectKBDir, file.path);
  }

  /**
   * Obter custom instructions do projeto para injetar no prompt
   */
  getProjectContext(projectId) {
    const project = this.getProject(projectId);

    let context = '';

    if (project.customInstructions) {
      context += `# Instruções do Projeto: ${project.name}\n\n`;
      context += project.customInstructions + '\n\n';
    }

    if (project.knowledgeBase.length > 0) {
      context += `# Knowledge Base\n\n`;
      context += `Este projeto tem ${project.knowledgeBase.length} arquivo(s) na knowledge base:\n`;
      project.knowledgeBase.forEach(file => {
        context += `- ${file.name} (${(file.size / 1024).toFixed(1)} KB)\n`;
      });
      context += '\n';
    }

    return context;
  }

  /**
   * Incrementar estatísticas de uso
   */
  incrementStats(projectId, type = 'message') {
    const project = this.getProject(projectId);

    if (type === 'conversation') {
      project.stats.conversations++;
    } else if (type === 'message') {
      project.stats.messages++;
    }

    project.stats.lastUsed = new Date().toISOString();
    project.updatedAt = new Date().toISOString();
    this.projects[projectId] = project;
    this.saveProjects();
  }

  /**
   * Adicionar colaborador ao projeto
   */
  addCollaborator(projectId, userId) {
    const project = this.getProject(projectId);

    if (!project.collaborators.includes(userId)) {
      project.collaborators.push(userId);
      project.updatedAt = new Date().toISOString();
      this.projects[projectId] = project;
      this.saveProjects();
    }

    return project;
  }

  /**
   * Remover colaborador
   */
  removeCollaborator(projectId, userId) {
    const project = this.getProject(projectId);

    const index = project.collaborators.indexOf(userId);
    if (index > -1) {
      project.collaborators.splice(index, 1);
      project.updatedAt = new Date().toISOString();
      this.projects[projectId] = project;
      this.saveProjects();
    }

    return project;
  }

  /**
   * Verificar se usuário tem acesso ao projeto
   */
  hasAccess(projectId, userId) {
    const project = this.getProject(projectId);
    return project.owner === userId || project.collaborators.includes(userId);
  }

  /**
   * Duplicar projeto
   */
  duplicateProject(projectId, newName, owner) {
    const original = this.getProject(projectId);

    const duplicate = this.createProject({
      name: newName || `${original.name} (Cópia)`,
      description: original.description,
      customInstructions: original.customInstructions,
      icon: original.icon,
      color: original.color,
      owner: owner || original.owner,
      settings: { ...original.settings }
    });

    // Copiar knowledge base
    if (original.knowledgeBase.length > 0) {
      const originalKBDir = path.join(PROJECTS_KB_DIR, projectId);
      const duplicateKBDir = path.join(PROJECTS_KB_DIR, duplicate.id);

      original.knowledgeBase.forEach(file => {
        const originalPath = path.join(originalKBDir, file.path);
        const newFileId = crypto.randomBytes(16).toString('hex');
        const ext = path.extname(file.name);
        const newFileName = `${newFileId}${ext}`;
        const duplicatePath = path.join(duplicateKBDir, newFileName);

        if (fs.existsSync(originalPath)) {
          fs.copyFileSync(originalPath, duplicatePath);
          duplicate.knowledgeBase.push({
            ...file,
            id: newFileId,
            path: newFileName,
            uploadedAt: new Date().toISOString()
          });
        }
      });

      this.projects[duplicate.id] = duplicate;
      this.saveProjects();
    }

    return duplicate;
  }
}

// Exportar instância única
const projectsManager = new ProjectsManager();
export default projectsManager;
export { ProjectsManager, PROJECTS_DIR, PROJECTS_KB_DIR };
