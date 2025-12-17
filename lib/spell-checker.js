/**
 * Spell Checker Service - BACKSPEC BETA ETAPA 4
 *
 * Sistema de correção ortográfica e gramatical para documentos jurídicos.
 * Suporta múltiplos providers:
 * - Hunspell (local - mais rápido, offline)
 * - LanguageTool (local - mais completo, offline)
 * - LanguageTool API (online - fallback)
 *
 * Controlado pela feature flag: spellcheck.enabled
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import featureFlags from './feature-flags.js';

const execAsync = promisify(exec);

class SpellChecker {
  constructor() {
    this.provider = null;
    this.initialized = false;
    this.dictPath = path.join(process.cwd(), 'config', 'dictionaries');
  }

  /**
   * Inicializa o spell checker detectando provider disponível
   */
  async initialize() {
    if (this.initialized) {
      return;
    }

    // Verificar se spell check está habilitado
    if (!featureFlags.isEnabled('spellcheck.enabled')) {
      console.log('⚠️  Spell check está desabilitado via feature flag');
      this.provider = 'disabled';
      this.initialized = true;
      return;
    }

    const preferredProvider = featureFlags.get('spellcheck.provider', 'hunspell');

    try {
      // Tentar provider preferido primeiro
      if (preferredProvider === 'hunspell') {
        if (await this.checkHunspell()) {
          this.provider = 'hunspell';
          console.log('✅ Spell checker inicializado: Hunspell (local)');
          this.initialized = true;
          return;
        }
      }

      if (preferredProvider === 'languagetool') {
        if (await this.checkLanguageTool()) {
          this.provider = 'languagetool';
          console.log('✅ Spell checker inicializado: LanguageTool (local)');
          this.initialized = true;
          return;
        }
      }

      // Fallback: tentar outros providers
      if (await this.checkHunspell()) {
        this.provider = 'hunspell';
        console.log('✅ Spell checker inicializado: Hunspell (local - fallback)');
      } else if (await this.checkLanguageTool()) {
        this.provider = 'languagetool';
        console.log('✅ Spell checker inicializado: LanguageTool (local - fallback)');
      } else {
        // Usar API online como último recurso
        this.provider = 'languagetool-api';
        console.log('⚠️  Nenhum spell checker local encontrado');
        console.log('✅ Spell checker inicializado: LanguageTool API (online - fallback)');
      }

      this.initialized = true;
    } catch (error) {
      console.error('❌ Erro ao inicializar spell checker:', error);
      this.provider = 'disabled';
      this.initialized = true;
    }
  }

  /**
   * Verifica se Hunspell está disponível
   */
  async checkHunspell() {
    try {
      await execAsync('which hunspell');
      // Verificar se dicionário pt_BR está disponível
      const { stdout } = await execAsync('hunspell -D 2>&1 | grep pt_BR || true');
      return stdout.includes('pt_BR');
    } catch (error) {
      return false;
    }
  }

  /**
   * Verifica se LanguageTool está disponível
   */
  async checkLanguageTool() {
    try {
      // Verificar se languagetool command está disponível
      await execAsync('which languagetool');
      return true;
    } catch (error) {
      // Verificar se há jar do LanguageTool local
      try {
        const ltPath = path.join(process.cwd(), 'tools', 'languagetool');
        const stats = await fs.stat(path.join(ltPath, 'languagetool-commandline.jar'));
        return stats.isFile();
      } catch {
        return false;
      }
    }
  }

  /**
   * Corrige texto usando o provider disponível
   * @param {string} text - Texto para corrigir
   * @param {Object} options - Opções de correção
   * @returns {Object} - Resultado da correção
   */
  async checkText(text, options = {}) {
    await this.initialize();

    if (this.provider === 'disabled') {
      return {
        checked: false,
        reason: 'Spell check desabilitado',
        originalText: text,
        correctedText: text,
        suggestions: []
      };
    }

    const {
      language = 'pt-BR',
      autoCorrect = featureFlags.get('spellcheck.autoCorrect', false)
    } = options;

    try {
      let result;

      switch (this.provider) {
        case 'hunspell':
          result = await this.checkWithHunspell(text, language);
          break;
        case 'languagetool':
          result = await this.checkWithLanguageTool(text, language);
          break;
        case 'languagetool-api':
          result = await this.checkWithLanguageToolAPI(text, language);
          break;
        default:
          throw new Error(`Provider desconhecido: ${this.provider}`);
      }

      // Auto-correção se habilitada
      if (autoCorrect && result.suggestions.length > 0) {
        result.correctedText = this.applyCorrections(text, result.suggestions);
        result.autoCorrected = true;
      }

      return result;
    } catch (error) {
      console.error('❌ Erro ao verificar texto:', error);
      return {
        checked: false,
        error: error.message,
        originalText: text,
        correctedText: text,
        suggestions: []
      };
    }
  }

  /**
   * Verifica texto com Hunspell
   */
  async checkWithHunspell(text, language) {
    const tmpFile = path.join('/tmp', `spellcheck-${Date.now()}.txt`);
    await fs.writeFile(tmpFile, text);

    try {
      const { stdout } = await execAsync(`hunspell -d pt_BR -l < ${tmpFile}`);
      const misspelledWords = stdout.trim().split('\n').filter(w => w.length > 0);

      // Hunspell only lists misspelled words, no suggestions by default
      const suggestions = misspelledWords.map(word => ({
        word,
        offset: text.indexOf(word),
        length: word.length,
        suggestions: [], // Hunspell -l doesn't provide suggestions
        type: 'spelling'
      }));

      return {
        checked: true,
        provider: 'hunspell',
        originalText: text,
        correctedText: text,
        suggestions,
        misspelledCount: misspelledWords.length,
        autoCorrected: false
      };
    } finally {
      await fs.unlink(tmpFile).catch(() => {});
    }
  }

  /**
   * Verifica texto com LanguageTool local
   */
  async checkWithLanguageTool(text, language) {
    const tmpFile = path.join('/tmp', `spellcheck-${Date.now()}.txt`);
    await fs.writeFile(tmpFile, text);

    try {
      // Tentar command languagetool primeiro
      let command = `languagetool -l ${language} ${tmpFile}`;

      // Se não existir, tentar jar local
      const ltJar = path.join(process.cwd(), 'tools', 'languagetool', 'languagetool-commandline.jar');
      try {
        await fs.access(ltJar);
        command = `java -jar ${ltJar} -l ${language} ${tmpFile}`;
      } catch {}

      const { stdout } = await execAsync(command);

      // Parse LanguageTool output
      const suggestions = this.parseLanguageToolOutput(stdout, text);

      return {
        checked: true,
        provider: 'languagetool',
        originalText: text,
        correctedText: text,
        suggestions,
        errorsCount: suggestions.length,
        autoCorrected: false
      };
    } finally {
      await fs.unlink(tmpFile).catch(() => {});
    }
  }

  /**
   * Verifica texto com LanguageTool API (online)
   */
  async checkWithLanguageToolAPI(text, language) {
    const url = 'https://api.languagetool.org/v2/check';

    const params = new URLSearchParams({
      text,
      language,
      enabledOnly: 'false'
    });

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: params
      });

      if (!response.ok) {
        throw new Error(`LanguageTool API error: ${response.status}`);
      }

      const data = await response.json();

      const suggestions = data.matches.map(match => ({
        offset: match.offset,
        length: match.length,
        word: text.substring(match.offset, match.offset + match.length),
        message: match.message,
        suggestions: match.replacements.map(r => r.value),
        type: match.rule.category.id,
        rule: match.rule.id
      }));

      return {
        checked: true,
        provider: 'languagetool-api',
        originalText: text,
        correctedText: text,
        suggestions,
        errorsCount: suggestions.length,
        autoCorrected: false
      };
    } catch (error) {
      throw new Error(`LanguageTool API error: ${error.message}`);
    }
  }

  /**
   * Parse output do LanguageTool
   */
  parseLanguageToolOutput(output, originalText) {
    const suggestions = [];
    const lines = output.split('\n');

    for (const line of lines) {
      // Format: "Line X, column Y: message"
      const match = line.match(/Line (\d+), column (\d+): (.+)/);
      if (match) {
        const [, lineNum, col, message] = match;
        suggestions.push({
          line: parseInt(lineNum),
          column: parseInt(col),
          message,
          type: 'grammar'
        });
      }
    }

    return suggestions;
  }

  /**
   * Aplica correções automaticamente
   */
  applyCorrections(text, suggestions) {
    let corrected = text;

    // Ordenar por offset decrescente para não invalidar posições
    const sorted = [...suggestions].sort((a, b) => b.offset - a.offset);

    for (const suggestion of sorted) {
      if (suggestion.suggestions && suggestion.suggestions.length > 0) {
        const replacement = suggestion.suggestions[0]; // Usar primeira sugestão
        corrected =
          corrected.substring(0, suggestion.offset) +
          replacement +
          corrected.substring(suggestion.offset + suggestion.length);
      }
    }

    return corrected;
  }

  /**
   * Obtém informações sobre o provider atual
   */
  getInfo() {
    return {
      provider: this.provider,
      initialized: this.initialized,
      enabled: featureFlags.isEnabled('spellcheck.enabled'),
      autoCorrect: featureFlags.get('spellcheck.autoCorrect', false),
      language: 'pt-BR'
    };
  }
}

// Exportar instância singleton
const spellChecker = new SpellChecker();

export default spellChecker;
