/**
 * Gerenciador de Prompts Multi-Tenant
 *
 * Estrutura:
 * - Prompts Globais: data/prompts/global/ (todos escritórios)
 * - Prompts por Parceiro: data/prompts/partners/{partnerId}/ (específico)
 *
 * Hierarquia de Acesso:
 * - master_admin: Edita prompts globais E prompts de qualquer parceiro
 * - partner_admin: Edita prompts do SEU parceiro
 * - admin: Edita prompts do SEU parceiro
 * - user: Apenas usa (não edita)
 *
 * Prioridade de Prompt:
 * Partner-specific > Global
 * (Se escritório tem prompt customizado, usa. Senão, usa global)
 */

const fs = require('fs');
const path = require('path');
const autoMigrate = require('./prompts-auto-migrate.js');

class PromptsManager {
  constructor() {
    // Usar diretório correto (disco persistente em produção, data/prompts em dev)
    const baseDir = autoMigrate.getPromptsDirectory();
    this.promptsDir = path.join(baseDir, 'global');
    this.partnerPromptsDir = path.join(baseDir, 'partners');

    console.log('📝 [PromptsManager] Inicializado:', {
      baseDir,
      globalDir: this.promptsDir,
      partnerDir: this.partnerPromptsDir,
      isPersistent: baseDir.includes('/var/data')
    });

    this.ensureDirectories();
  }

  ensureDirectories() {
    if (!fs.existsSync(this.promptsDir)) {
      fs.mkdirSync(this.promptsDir, { recursive: true });
    }
    if (!fs.existsSync(this.partnerPromptsDir)) {
      fs.mkdirSync(this.partnerPromptsDir, { recursive: true });
    }
  }

  /**
   * Lista todos os prompts disponíveis para um usuário
   * @param {string} partnerId - ID do parceiro
   * @param {string} userRole - Papel do usuário (master_admin, partner_admin, user)
   * @returns {Object} Prompts globais e específicos do parceiro
   */
  listarPrompts(partnerId, userRole) {
    const prompts = {
      global: [],
      partner: [],
      canEditGlobal: userRole === 'master_admin',
      canEditPartner: ['admin', 'partner_admin', 'master_admin'].includes(userRole)
    };

    // Listar prompts globais
    try {
      const globalFiles = fs.readdirSync(this.promptsDir).filter(f => f.endsWith('.md'));
      prompts.global = globalFiles.map(file => {
        const content = fs.readFileSync(path.join(this.promptsDir, file), 'utf8');
        return {
          id: file.replace('.md', ''),
          filename: file,
          name: this.extractName(content) || file.replace('.md', ''),
          type: 'global',
          path: `global/${file}`,
          editable: userRole === 'master_admin',
          size: content.length,
          lastModified: fs.statSync(path.join(this.promptsDir, file)).mtime
        };
      });
    } catch (error) {
      console.error('Erro ao listar prompts globais:', error);
    }

    // Listar prompts específicos do parceiro
    const partnerDir = path.join(this.partnerPromptsDir, partnerId);
    if (fs.existsSync(partnerDir)) {
      try {
        const partnerFiles = fs.readdirSync(partnerDir).filter(f => f.endsWith('.md'));
        prompts.partner = partnerFiles.map(file => {
          const content = fs.readFileSync(path.join(partnerDir, file), 'utf8');
          return {
            id: file.replace('.md', ''),
            filename: file,
            name: this.extractName(content) || file.replace('.md', ''),
            type: 'partner',
            partnerId,
            path: `partner/${partnerId}/${file}`,
            editable: ['admin', 'partner_admin', 'master_admin'].includes(userRole),
            size: content.length,
            lastModified: fs.statSync(path.join(partnerDir, file)).mtime,
            overridesGlobal: prompts.global.some(g => g.filename === file)
          };
        });
      } catch (error) {
        console.error(`Erro ao listar prompts do parceiro ${partnerId}:`, error);
      }
    }

    return prompts;
  }

  /**
   * Obtém um prompt específico (partner-specific tem prioridade)
   * @param {string} promptId - ID do prompt
   * @param {string} partnerId - ID do parceiro
   * @returns {Object} Conteúdo do prompt e metadados
   */
  obterPrompt(promptId, partnerId) {
    const filename = promptId.endsWith('.md') ? promptId : `${promptId}.md`;

    // 1. Verificar se existe versão específica do parceiro (PRIORIDADE)
    const partnerPath = path.join(this.partnerPromptsDir, partnerId, filename);
    if (fs.existsSync(partnerPath)) {
      const content = fs.readFileSync(partnerPath, 'utf8');
      return {
        id: promptId,
        filename,
        content,
        type: 'partner',
        partnerId,
        path: partnerPath,
        isOverride: true,
        lastModified: fs.statSync(partnerPath).mtime
      };
    }

    // 2. Usar prompt global (FALLBACK)
    const globalPath = path.join(this.promptsDir, filename);
    if (fs.existsSync(globalPath)) {
      const content = fs.readFileSync(globalPath, 'utf8');
      return {
        id: promptId,
        filename,
        content,
        type: 'global',
        path: globalPath,
        isOverride: false,
        lastModified: fs.statSync(globalPath).mtime
      };
    }

    throw new Error(`Prompt '${promptId}' não encontrado`);
  }

  /**
   * Salva ou atualiza um prompt
   * @param {string} promptId - ID do prompt
   * @param {string} content - Conteúdo do prompt
   * @param {string} partnerId - ID do parceiro (null para global)
   * @param {string} userRole - Papel do usuário
   * @returns {Object} Resultado da operação
   */
  salvarPrompt(promptId, content, partnerId, userRole) {
    // Validar permissões
    const isGlobal = !partnerId || partnerId === 'global';

    if (isGlobal && userRole !== 'master_admin') {
      throw new Error('Apenas master_admin pode editar prompts globais');
    }

    if (!isGlobal && !['admin', 'partner_admin', 'master_admin'].includes(userRole)) {
      throw new Error('Apenas admin, partner_admin ou master_admin podem editar prompts do parceiro');
    }

    const filename = promptId.endsWith('.md') ? promptId : `${promptId}.md`;

    try {
      let filePath;
      let tipo;

      if (isGlobal) {
        // Salvar como global
        filePath = path.join(this.promptsDir, filename);
        tipo = 'global';
      } else {
        // Salvar como específico do parceiro
        const partnerDir = path.join(this.partnerPromptsDir, partnerId);
        if (!fs.existsSync(partnerDir)) {
          fs.mkdirSync(partnerDir, { recursive: true });
        }
        filePath = path.join(partnerDir, filename);
        tipo = 'partner';
      }

      fs.writeFileSync(filePath, content, 'utf8');

      // Registrar modificação
      this.registrarModificacao({
        promptId,
        partnerId: partnerId || 'global',
        tipo,
        acao: 'update',
        userRole,
        timestamp: new Date().toISOString()
      });

      return {
        success: true,
        message: `Prompt '${promptId}' salvo com sucesso`,
        tipo,
        partnerId: partnerId || 'global',
        path: filePath
      };
    } catch (error) {
      console.error('Erro ao salvar prompt:', error);
      throw error;
    }
  }

  /**
   * Cria uma cópia customizada de um prompt global para o parceiro
   * @param {string} promptId - ID do prompt global
   * @param {string} partnerId - ID do parceiro
   * @param {string} userRole - Papel do usuário
   * @returns {Object} Resultado
   */
  criarOverride(promptId, partnerId, userRole) {
    if (!['admin', 'partner_admin', 'master_admin'].includes(userRole)) {
      throw new Error('Apenas admin, partner_admin ou master_admin podem criar override de prompts');
    }

    const filename = promptId.endsWith('.md') ? promptId : `${promptId}.md`;

    // Obter prompt global
    const globalPath = path.join(this.promptsDir, filename);
    if (!fs.existsSync(globalPath)) {
      throw new Error(`Prompt global '${promptId}' não encontrado`);
    }

    const globalContent = fs.readFileSync(globalPath, 'utf8');

    // Adicionar cabeçalho indicando override
    const overrideHeader = `<!-- PROMPT CUSTOMIZADO DO PARCEIRO: ${partnerId.toUpperCase()} -->
<!-- ORIGINAL: data/prompts/global/${filename} -->
<!-- Data de Criação: ${new Date().toISOString()} -->

`;

    const partnerContent = overrideHeader + globalContent;

    // Salvar como específico do parceiro
    const partnerDir = path.join(this.partnerPromptsDir, partnerId);
    if (!fs.existsSync(partnerDir)) {
      fs.mkdirSync(partnerDir, { recursive: true });
    }

    const partnerPath = path.join(partnerDir, filename);
    fs.writeFileSync(partnerPath, partnerContent, 'utf8');

    this.registrarModificacao({
      promptId,
      partnerId,
      tipo: 'partner',
      acao: 'create_override',
      userRole,
      timestamp: new Date().toISOString()
    });

    return {
      success: true,
      message: `Override criado com sucesso para '${promptId}'`,
      path: partnerPath,
      canEdit: true
    };
  }

  /**
   * Remove override e volta a usar prompt global
   * @param {string} promptId - ID do prompt
   * @param {string} partnerId - ID do parceiro
   * @param {string} userRole - Papel do usuário
   * @returns {Object} Resultado
   */
  removerOverride(promptId, partnerId, userRole) {
    if (!['admin', 'partner_admin', 'master_admin'].includes(userRole)) {
      throw new Error('Apenas admin, partner_admin ou master_admin podem remover override');
    }

    const filename = promptId.endsWith('.md') ? promptId : `${promptId}.md`;
    const partnerPath = path.join(this.partnerPromptsDir, partnerId, filename);

    if (!fs.existsSync(partnerPath)) {
      throw new Error('Override não encontrado');
    }

    fs.unlinkSync(partnerPath);

    this.registrarModificacao({
      promptId,
      partnerId,
      tipo: 'partner',
      acao: 'delete_override',
      userRole,
      timestamp: new Date().toISOString()
    });

    return {
      success: true,
      message: `Override removido. Agora usa prompt global.`
    };
  }

  /**
   * Extrai nome do prompt do conteúdo
   */
  extractName(content) {
    const match = content.match(/^#\s+(.+)$/m);
    return match ? match[1] : null;
  }

  /**
   * Registra modificações para auditoria
   */
  registrarModificacao(modificacao) {
    const logPath = path.join(__dirname, '../logs/prompts_modifications.json');
    let logs = [];

    if (fs.existsSync(logPath)) {
      logs = JSON.parse(fs.readFileSync(logPath, 'utf8'));
    }

    logs.push(modificacao);

    // Manter apenas últimas 1000 modificações
    if (logs.length > 1000) {
      logs = logs.slice(-1000);
    }

    fs.writeFileSync(logPath, JSON.stringify(logs, null, 2));
  }

  /**
   * Obtém estatísticas de uso de prompts
   */
  obterEstatisticas(partnerId) {
    const stats = {
      totalGlobal: 0,
      totalPartner: 0,
      overrides: 0,
      lastModified: null
    };

    // Contar prompts globais
    if (fs.existsSync(this.promptsDir)) {
      stats.totalGlobal = fs.readdirSync(this.promptsDir).filter(f => f.endsWith('.md')).length;
    }

    // Contar prompts específicos do parceiro
    const partnerDir = path.join(this.partnerPromptsDir, partnerId);
    if (fs.existsSync(partnerDir)) {
      const partnerFiles = fs.readdirSync(partnerDir).filter(f => f.endsWith('.md'));
      stats.totalPartner = partnerFiles.length;

      // Contar overrides (prompts que existem tanto em global quanto partner)
      partnerFiles.forEach(file => {
        if (fs.existsSync(path.join(this.promptsDir, file))) {
          stats.overrides++;
        }
      });
    }

    return stats;
  }

  /**
   * Obtém System Prompts compilados para integração com PromptBuilder
   * Hierarquia: Global → Partner (partner sobrescreve global)
   *
   * @param {string} partnerId - ID do parceiro
   * @param {object} options - Opções de compilação
   * @param {boolean} options.includeGlobal - Incluir prompts globais (padrão: true)
   * @param {boolean} options.includePartner - Incluir prompts do parceiro (padrão: true)
   * @param {string[]} options.specificPrompts - IDs específicos de prompts a incluir
   * @returns {object} { text: string, metadata: object, prompts: array }
   */
  getCompiledSystemPrompts(partnerId = 'global', options = {}) {
    const {
      includeGlobal = true,
      includePartner = true,
      specificPrompts = null
    } = options;

    const compiledParts = [];
    const usedPrompts = [];
    let totalTokens = 0;

    try {
      // ETAPA 1: Carregar prompts globais
      if (includeGlobal) {
        const globalFiles = fs.existsSync(this.promptsDir)
          ? fs.readdirSync(this.promptsDir).filter(f => f.endsWith('.md'))
          : [];

        for (const file of globalFiles) {
          const promptId = file.replace('.md', '');

          // Se specificPrompts definido, filtrar
          if (specificPrompts && !specificPrompts.includes(promptId)) {
            continue;
          }

          try {
            const filePath = path.join(this.promptsDir, file);
            const content = fs.readFileSync(filePath, 'utf8');

            compiledParts.push({
              id: promptId,
              type: 'global',
              content: content.trim(),
              tokens: Math.ceil(content.length / 4)
            });

            usedPrompts.push({ id: promptId, type: 'global', file });
            totalTokens += Math.ceil(content.length / 4);
          } catch (error) {
            console.error(`[PromptsManager] Erro ao ler prompt global ${file}:`, error.message);
          }
        }
      }

      // ETAPA 2: Carregar prompts do parceiro (sobrescreve global se existir)
      if (includePartner && partnerId !== 'global') {
        const partnerDir = path.join(this.partnerPromptsDir, partnerId);

        if (fs.existsSync(partnerDir)) {
          const partnerFiles = fs.readdirSync(partnerDir).filter(f => f.endsWith('.md'));

          for (const file of partnerFiles) {
            const promptId = file.replace('.md', '');

            // Se specificPrompts definido, filtrar
            if (specificPrompts && !specificPrompts.includes(promptId)) {
              continue;
            }

            try {
              const filePath = path.join(partnerDir, file);
              const content = fs.readFileSync(filePath, 'utf8');

              // Remover global se existir (partner sobrescreve)
              const globalIndex = compiledParts.findIndex(p => p.id === promptId && p.type === 'global');
              if (globalIndex !== -1) {
                totalTokens -= compiledParts[globalIndex].tokens;
                compiledParts.splice(globalIndex, 1);
                usedPrompts.splice(usedPrompts.findIndex(p => p.id === promptId && p.type === 'global'), 1);
              }

              compiledParts.push({
                id: promptId,
                type: 'partner',
                partnerId,
                content: content.trim(),
                tokens: Math.ceil(content.length / 4),
                overridesGlobal: globalIndex !== -1
              });

              usedPrompts.push({
                id: promptId,
                type: 'partner',
                partnerId,
                file,
                overridesGlobal: globalIndex !== -1
              });
              totalTokens += Math.ceil(content.length / 4);
            } catch (error) {
              console.error(`[PromptsManager] Erro ao ler prompt partner ${file}:`, error.message);
            }
          }
        }
      }

      // ETAPA 3: Compilar texto final
      const compiledText = compiledParts.length > 0
        ? compiledParts.map(p => p.content).join('\n\n═══════════════════════════════════════\n\n')
        : '';

      return {
        text: compiledText,
        metadata: {
          partnerId,
          totalPrompts: compiledParts.length,
          globalPrompts: compiledParts.filter(p => p.type === 'global').length,
          partnerPrompts: compiledParts.filter(p => p.type === 'partner').length,
          overrides: compiledParts.filter(p => p.overridesGlobal).length,
          estimatedTokens: totalTokens
        },
        prompts: usedPrompts
      };

    } catch (error) {
      console.error('[PromptsManager] Erro ao compilar system prompts:', error);
      return {
        text: '',
        metadata: { error: error.message, partnerId, totalPrompts: 0 },
        prompts: []
      };
    }
  }

  /**
   * Verifica se existem System Prompts para um parceiro
   * @param {string} partnerId - ID do parceiro
   * @returns {boolean}
   */
  hasSystemPrompts(partnerId = 'global') {
    const hasGlobal = fs.existsSync(this.promptsDir) &&
      fs.readdirSync(this.promptsDir).some(f => f.endsWith('.md'));

    if (partnerId === 'global') {
      return hasGlobal;
    }

    const partnerDir = path.join(this.partnerPromptsDir, partnerId);
    const hasPartner = fs.existsSync(partnerDir) &&
      fs.readdirSync(partnerDir).some(f => f.endsWith('.md'));

    return hasGlobal || hasPartner;
  }
}

// Exportar instância singleton (não a classe)
module.exports = new PromptsManager();
