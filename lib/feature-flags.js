/**
 * Feature Flags System - BACKSPEC BETA
 *
 * Sistema de controle de funcionalidades que permite ativar/desativar features
 * sem necessidade de deploy. Essencial para o BETA interno com 6 usuários.
 *
 * Funcionalidades controladas:
 * - Spell check externo (hunspell/LanguageTool)
 * - Sistema de tracing distribuído
 * - Auto-atualização de prompts
 * - Layer 4.5 (Jurimetria)
 * - Sistema de cache
 * - Upload sync automático
 * - Índice progressivo (quick/medium/full)
 * - Exportação de resultados
 * - Multi-Agent Pipeline
 * - Validação de qualidade
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class FeatureFlagsManager {
  constructor() {
    this.configPath = path.join(process.cwd(), 'config', 'feature-flags.json');
    this.flags = {};
    this.listeners = new Map(); // Listeners para mudanças de flags
    this.load();
  }

  /**
   * Carrega feature flags do arquivo de configuração
   */
  load() {
    try {
      if (fs.existsSync(this.configPath)) {
        const data = fs.readFileSync(this.configPath, 'utf8');
        this.flags = JSON.parse(data);
        console.log(`🚩 Feature Flags carregados: ${Object.keys(this.flags).length} flags`);
      } else {
        // Criar arquivo com flags padrão
        this.flags = this.getDefaultFlags();
        this.save();
        console.log('🚩 Feature Flags inicializados com valores padrão');
      }
    } catch (error) {
      console.error('❌ Erro ao carregar feature flags:', error);
      this.flags = this.getDefaultFlags();
    }
  }

  /**
   * Retorna as feature flags padrão
   */
  getDefaultFlags() {
    return {
      // Sistema de Tracing
      'tracing.enabled': true,
      'tracing.persist': true,
      'tracing.verbose': false,

      // Spell Check Externo
      'spellcheck.enabled': false, // Desabilitado por padrão (ETAPA 4)
      'spellcheck.provider': 'hunspell', // 'hunspell' ou 'languagetool'
      'spellcheck.autoCorrect': false,

      // Auto-Atualização de Prompts
      'auto-update.enabled': true,
      'auto-update.interval': 24, // horas
      'auto-update.feedbackCollection': true,

      // Layer 4.5 - Jurimetria
      'jurimetria.enabled': true,
      'jurimetria.autoRun': true,
      'jurimetria.minDecisions': 5, // Mínimo de decisões para análise

      // Sistema de Cache
      'cache.enabled': true,
      'cache.ttl': 3600, // segundos (1h)
      'cache.maxSize': 1024, // MB

      // Upload Sync Automático
      'upload-sync.enabled': true,
      'upload-sync.watchDesktop': true,
      'upload-sync.autoProcess': false,

      // Índice Progressivo
      'index.enabled': true,
      'index.defaultLevel': 'quick', // 'quick', 'medium', 'full'
      'index.autoUpgrade': false, // Auto-upgrade de quick para medium

      // Exportação de Resultados
      'export.enabled': true,
      'export.autoExport': true,
      'export.formats': ['json', 'md', 'docx'],

      // Multi-Agent Pipeline
      'pipeline.enabled': true,
      'pipeline.maxConcurrent': 3,
      'pipeline.chunkSize': 100, // páginas por chunk

      // Validação de Qualidade
      'validation.enabled': true,
      'validation.strictMode': false,
      'validation.autoRetry': true,

      // KB Management
      'kb.autoCleanup': true,
      'kb.orphanCheckInterval': 24, // horas
      'kb.maxDocuments': 1000,

      // Sistema de Backup
      'backup.enabled': true,
      'backup.schedule': '03:00', // Horário do backup diário
      'backup.retention': 7, // dias

      // Desenvolvimento/Debug
      'debug.enabled': false,
      'debug.verbose': false,
      'debug.logToFile': true,

      // BETA Features (podem ser desabilitadas)
      'beta.newUI': false,
      'beta.experimentalFeatures': false
    };
  }

  /**
   * Salva feature flags no arquivo de configuração
   */
  save() {
    try {
      const dir = path.dirname(this.configPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      fs.writeFileSync(
        this.configPath,
        JSON.stringify(this.flags, null, 2),
        'utf8'
      );

      console.log('✅ Feature Flags salvos');
      return true;
    } catch (error) {
      console.error('❌ Erro ao salvar feature flags:', error);
      return false;
    }
  }

  /**
   * Verifica se uma feature está habilitada
   * @param {string} flagName - Nome da feature flag
   * @returns {boolean}
   */
  isEnabled(flagName) {
    if (!(flagName in this.flags)) {
      console.warn(`⚠️ Feature flag não encontrada: ${flagName}`);
      return false;
    }
    return this.flags[flagName] === true;
  }

  /**
   * Obtém o valor de uma feature flag
   * @param {string} flagName - Nome da feature flag
   * @param {*} defaultValue - Valor padrão se flag não existir
   * @returns {*}
   */
  get(flagName, defaultValue = null) {
    return this.flags[flagName] ?? defaultValue;
  }

  /**
   * Define o valor de uma feature flag
   * @param {string} flagName - Nome da feature flag
   * @param {*} value - Novo valor
   * @param {boolean} persist - Se deve salvar no arquivo
   */
  set(flagName, value, persist = true) {
    const oldValue = this.flags[flagName];
    this.flags[flagName] = value;

    console.log(`🚩 Feature flag atualizada: ${flagName} = ${value}`);

    // Notificar listeners
    this.notifyListeners(flagName, value, oldValue);

    if (persist) {
      this.save();
    }

    return true;
  }

  /**
   * Define múltiplas feature flags de uma vez
   * @param {Object} flags - Objeto com flags para atualizar
   * @param {boolean} persist - Se deve salvar no arquivo
   */
  setMultiple(flags, persist = true) {
    Object.entries(flags).forEach(([flagName, value]) => {
      this.set(flagName, value, false);
    });

    if (persist) {
      this.save();
    }
  }

  /**
   * Retorna todas as feature flags
   */
  getAll() {
    return { ...this.flags };
  }

  /**
   * Retorna feature flags por categoria
   * @param {string} category - Categoria (ex: 'tracing', 'cache', 'spellcheck')
   */
  getByCategory(category) {
    const prefix = `${category}.`;
    const categoryFlags = {};

    Object.entries(this.flags).forEach(([key, value]) => {
      if (key.startsWith(prefix)) {
        const shortKey = key.substring(prefix.length);
        categoryFlags[shortKey] = value;
      }
    });

    return categoryFlags;
  }

  /**
   * Registra um listener para mudanças em feature flags
   * @param {string} flagName - Nome da flag (ou '*' para todas)
   * @param {Function} callback - Callback (newValue, oldValue)
   */
  on(flagName, callback) {
    if (!this.listeners.has(flagName)) {
      this.listeners.set(flagName, []);
    }
    this.listeners.get(flagName).push(callback);
  }

  /**
   * Remove um listener
   */
  off(flagName, callback) {
    if (this.listeners.has(flagName)) {
      const callbacks = this.listeners.get(flagName);
      const index = callbacks.indexOf(callback);
      if (index > -1) {
        callbacks.splice(index, 1);
      }
    }
  }

  /**
   * Notifica listeners sobre mudança de flag
   */
  notifyListeners(flagName, newValue, oldValue) {
    // Notificar listeners específicos da flag
    if (this.listeners.has(flagName)) {
      this.listeners.get(flagName).forEach(callback => {
        try {
          callback(newValue, oldValue, flagName);
        } catch (error) {
          console.error(`❌ Erro no listener de ${flagName}:`, error);
        }
      });
    }

    // Notificar listeners globais
    if (this.listeners.has('*')) {
      this.listeners.get('*').forEach(callback => {
        try {
          callback(newValue, oldValue, flagName);
        } catch (error) {
          console.error('❌ Erro no listener global:', error);
        }
      });
    }
  }

  /**
   * Reseta todas as flags para os valores padrão
   */
  reset() {
    this.flags = this.getDefaultFlags();
    this.save();
    console.log('🔄 Feature Flags resetados para valores padrão');
  }

  /**
   * Valida as feature flags
   */
  validate() {
    const errors = [];
    const warnings = [];

    // Validar spell check provider
    const spellcheckProvider = this.get('spellcheck.provider');
    if (spellcheckProvider && !['hunspell', 'languagetool'].includes(spellcheckProvider)) {
      errors.push(`Spell check provider inválido: ${spellcheckProvider}`);
    }

    // Validar index default level
    const indexLevel = this.get('index.defaultLevel');
    if (indexLevel && !['quick', 'medium', 'full'].includes(indexLevel)) {
      errors.push(`Index level inválido: ${indexLevel}`);
    }

    // Avisar se tracing está desabilitado
    if (!this.isEnabled('tracing.enabled')) {
      warnings.push('Sistema de tracing está desabilitado');
    }

    // Avisar se cache está desabilitado
    if (!this.isEnabled('cache.enabled')) {
      warnings.push('Sistema de cache está desabilitado - pode impactar performance');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Retorna estatísticas sobre as feature flags
   */
  getStats() {
    const total = Object.keys(this.flags).length;
    const enabled = Object.values(this.flags).filter(v => v === true).length;
    const disabled = Object.values(this.flags).filter(v => v === false).length;
    const other = total - enabled - disabled;

    return {
      total,
      enabled,
      disabled,
      other,
      percentEnabled: Math.round((enabled / total) * 100)
    };
  }
}

// Exportar instância singleton
const featureFlags = new FeatureFlagsManager();

export default featureFlags;
