/**
 * Sistema de Versionamento e Sincronização de Prompts
 *
 * Funcionalidades:
 * 1. Controla versões de prompts globais
 * 2. Notifica parceiros quando prompts globais são atualizados
 * 3. Permite parceiros sincronizarem (ou não) com versão global
 * 4. Mantém histórico de mudanças
 *
 * Fluxo:
 * - Master admin atualiza prompt global → Versão incrementa → Notificação para todos os parceiros com override
 * - Partner admin vê notificação → Decide: (1) Sincronizar com global OU (2) Manter override
 * - Auto-evolução aplica-se a prompts globais automaticamente
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

class PromptsVersioning {
  constructor() {
    this.versionsPath = path.join(__dirname, '../logs/prompts_versions.json');
    this.notificationsPath = path.join(__dirname, '../logs/prompts_notifications.json');
    this.globalPromptsDir = path.join(__dirname, '../data/prompts/global');
    this.partnerPromptsDir = path.join(__dirname, '../data/prompts/partners');

    this.ensureFiles();
  }

  ensureFiles() {
    const logsDir = path.join(__dirname, '../logs');
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }

    if (!fs.existsSync(this.versionsPath)) {
      fs.writeFileSync(this.versionsPath, JSON.stringify({}, null, 2));
    }

    if (!fs.existsSync(this.notificationsPath)) {
      fs.writeFileSync(this.notificationsPath, JSON.stringify([], null, 2));
    }
  }

  /**
   * Calcula hash MD5 do conteúdo (para detectar mudanças)
   */
  calcularHash(content) {
    return crypto.createHash('md5').update(content).digest('hex');
  }

  /**
   * Obtém versão atual de um prompt global
   */
  obterVersaoGlobal(promptId) {
    const versions = JSON.parse(fs.readFileSync(this.versionsPath, 'utf8'));
    return versions[promptId] || {
      version: '1.0.0',
      hash: null,
      lastUpdate: null,
      changeLog: []
    };
  }

  /**
   * Registra nova versão de prompt global
   * @param {string} promptId - ID do prompt
   * @param {string} content - Novo conteúdo
   * @param {string} changelog - Descrição das mudanças
   * @param {string} updatedBy - Quem atualizou (userId)
   * @returns {Object} Nova versão
   */
  registrarVersaoGlobal(promptId, content, changelog, updatedBy) {
    const versions = JSON.parse(fs.readFileSync(this.versionsPath, 'utf8'));
    const currentVersion = versions[promptId] || {
      version: '1.0.0',
      hash: null,
      lastUpdate: null,
      changeLog: []
    };

    const newHash = this.calcularHash(content);

    // Se hash é diferente, houve mudança real
    if (newHash !== currentVersion.hash) {
      const versionParts = currentVersion.version.split('.').map(Number);

      // Incrementar versão (major.minor.patch)
      // Se changelog indica "breaking change" → major
      // Se changelog indica "feature" → minor
      // Senão → patch
      if (changelog.toLowerCase().includes('breaking')) {
        versionParts[0]++;
        versionParts[1] = 0;
        versionParts[2] = 0;
      } else if (changelog.toLowerCase().includes('feature') || changelog.toLowerCase().includes('novo')) {
        versionParts[1]++;
        versionParts[2] = 0;
      } else {
        versionParts[2]++;
      }

      const newVersion = versionParts.join('.');

      // Atualizar registro
      versions[promptId] = {
        version: newVersion,
        hash: newHash,
        lastUpdate: new Date().toISOString(),
        updatedBy,
        changeLog: [
          {
            version: newVersion,
            date: new Date().toISOString(),
            changes: changelog,
            updatedBy
          },
          ...currentVersion.changeLog.slice(0, 49) // Manter últimas 50 mudanças
        ]
      };

      fs.writeFileSync(this.versionsPath, JSON.stringify(versions, null, 2));

      // Criar notificações para parceiros com override
      this.criarNotificacoesParceiros(promptId, newVersion, changelog);

      return versions[promptId];
    }

    return currentVersion;
  }

  /**
   * Cria notificações para parceiros que têm override do prompt
   */
  criarNotificacoesParceiros(promptId, newVersion, changelog) {
    const filename = promptId.endsWith('.md') ? promptId : `${promptId}.md`;

    // Verificar quais parceiros têm override
    if (!fs.existsSync(this.partnerPromptsDir)) return;

    const partners = fs.readdirSync(this.partnerPromptsDir);
    const notifications = JSON.parse(fs.readFileSync(this.notificationsPath, 'utf8'));

    partners.forEach(partnerId => {
      const partnerPromptPath = path.join(this.partnerPromptsDir, partnerId, filename);

      if (fs.existsSync(partnerPromptPath)) {
        // Parceiro tem override → criar notificação
        notifications.push({
          id: `notif-${Date.now()}-${partnerId}-${promptId}`,
          partnerId,
          promptId,
          newVersion,
          changelog,
          createdAt: new Date().toISOString(),
          read: false,
          synced: false
        });
      }
    });

    fs.writeFileSync(this.notificationsPath, JSON.stringify(notifications, null, 2));
  }

  /**
   * Obtém notificações de um parceiro
   */
  obterNotificacoesParceiro(partnerId, onlyUnread = false) {
    const notifications = JSON.parse(fs.readFileSync(this.notificationsPath, 'utf8'));

    let filtered = notifications.filter(n => n.partnerId === partnerId);

    if (onlyUnread) {
      filtered = filtered.filter(n => !n.read);
    }

    return filtered.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  /**
   * Marca notificação como lida
   */
  marcarComoLida(notificationId) {
    const notifications = JSON.parse(fs.readFileSync(this.notificationsPath, 'utf8'));
    const notif = notifications.find(n => n.id === notificationId);

    if (notif) {
      notif.read = true;
      fs.writeFileSync(this.notificationsPath, JSON.stringify(notifications, null, 2));
      return { success: true };
    }

    return { success: false, error: 'Notificação não encontrada' };
  }

  /**
   * Sincroniza override do parceiro com versão global
   * (Sobrescreve override com prompt global atualizado)
   */
  sincronizarComGlobal(promptId, partnerId) {
    const filename = promptId.endsWith('.md') ? promptId : `${promptId}.md`;

    const globalPath = path.join(this.globalPromptsDir, filename);
    const partnerPath = path.join(this.partnerPromptsDir, partnerId, filename);

    if (!fs.existsSync(globalPath)) {
      throw new Error('Prompt global não encontrado');
    }

    if (!fs.existsSync(partnerPath)) {
      throw new Error('Override não encontrado');
    }

    // Copiar prompt global para override do parceiro
    const globalContent = fs.readFileSync(globalPath, 'utf8');

    // Adicionar header indicando sincronização
    const syncHeader = `<!-- SINCRONIZADO COM VERSÃO GLOBAL -->
<!-- Data de Sincronização: ${new Date().toISOString()} -->
<!-- Versão: ${this.obterVersaoGlobal(promptId).version} -->

`;

    fs.writeFileSync(partnerPath, syncHeader + globalContent, 'utf8');

    // Marcar notificações como sincronizadas
    const notifications = JSON.parse(fs.readFileSync(this.notificationsPath, 'utf8'));
    notifications.forEach(n => {
      if (n.partnerId === partnerId && n.promptId === promptId && !n.synced) {
        n.synced = true;
        n.syncedAt = new Date().toISOString();
      }
    });
    fs.writeFileSync(this.notificationsPath, JSON.stringify(notifications, null, 2));

    return {
      success: true,
      message: 'Override sincronizado com versão global',
      version: this.obterVersaoGlobal(promptId).version
    };
  }

  /**
   * Compara override do parceiro com versão global
   * @returns {Object} Diferenças e recomendações
   */
  compararComGlobal(promptId, partnerId) {
    const filename = promptId.endsWith('.md') ? promptId : `${promptId}.md`;

    const globalPath = path.join(this.globalPromptsDir, filename);
    const partnerPath = path.join(this.partnerPromptsDir, partnerId, filename);

    if (!fs.existsSync(globalPath)) {
      return { erro: 'Prompt global não encontrado' };
    }

    if (!fs.existsSync(partnerPath)) {
      return { erro: 'Override não encontrado', usandoGlobal: true };
    }

    const globalContent = fs.readFileSync(globalPath, 'utf8');
    const partnerContent = fs.readFileSync(partnerPath, 'utf8');

    const globalHash = this.calcularHash(globalContent);
    const partnerHash = this.calcularHash(partnerContent);

    const versaoGlobal = this.obterVersaoGlobal(promptId);

    return {
      identico: globalHash === partnerHash,
      versaoGlobal: versaoGlobal.version,
      hashGlobal: globalHash,
      hashPartner: partnerHash,
      ultimaAtualizacaoGlobal: versaoGlobal.lastUpdate,
      recomendacao: globalHash !== partnerHash ?
        'Há diferenças entre seu override e a versão global. Revise as mudanças.' :
        'Seu override está sincronizado com a versão global.'
    };
  }

  /**
   * Obtém changelog completo de um prompt
   */
  obterChangelog(promptId) {
    const versao = this.obterVersaoGlobal(promptId);
    return {
      promptId,
      versaoAtual: versao.version,
      ultimaAtualizacao: versao.lastUpdate,
      historico: versao.changeLog || []
    };
  }

  /**
   * Propaga atualização de auto-evolução para prompt global
   * (Usado pelo PromptUpdater quando atualiza automaticamente)
   */
  propagarAutoEvolucao(promptId, content, motivo) {
    return this.registrarVersaoGlobal(
      promptId,
      content,
      `[AUTO-EVOLUÇÃO] ${motivo}`,
      'sistema-auto-atualizacao'
    );
  }
}

module.exports = PromptsVersioning;
