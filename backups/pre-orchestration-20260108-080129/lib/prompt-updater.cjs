/**
 * Sistema de Auto-Atualização de Prompts
 *
 * Responsável por:
 * 1. Verificar atualidade de dispositivos legais
 * 2. Buscar jurisprudência recente
 * 3. Atualizar prompts automaticamente
 * 4. Aprender com feedback de uso
 */

const fs = require('fs');
const path = require('path');
const PromptsVersioning = require('./prompts-versioning.cjs');

class PromptUpdater {
  constructor() {
    this.promptsDir = path.join(__dirname, '../config/system_prompts');
    this.updateLogPath = path.join(__dirname, '../logs/prompt_updates.json');
    this.feedbackPath = path.join(__dirname, '../logs/user_feedback.json');

    // Inicializar sistema de versionamento
    this.versioning = new PromptsVersioning();

    // Garantir que diretórios existam
    this.ensureDirectories();
  }

  ensureDirectories() {
    const logsDir = path.join(__dirname, '../logs');
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }
  }

  /**
   * Verifica se dispositivo legal está atualizado
   * @param {string} dispositivo - Ex: "Art. 319 do CPC"
   * @returns {Object} { valid: boolean, warning: string, suggestion: string }
   */
  async verificarDispositivoLegal(dispositivo) {
    // Aqui implementaríamos integração com APIs de legislação
    // Por ora, retorna estrutura base

    const warnings = {
      'Lei 13.105/2015': { valid: true, note: 'CPC vigente' },
      'Lei 10.406/2002': { valid: true, note: 'Código Civil vigente' },
      'Decreto-Lei 3.689/1941': { valid: true, note: 'CPP com alterações' },
      'Decreto-Lei 2.848/1940': { valid: true, note: 'CP com alterações' },
    };

    // Extrair lei do dispositivo
    const leiMatch = dispositivo.match(/Lei\s+[\d.\/]+|Decreto-Lei\s+[\d.\/]+/);
    if (leiMatch) {
      const lei = leiMatch[0];
      return warnings[lei] || { valid: true, note: 'Verificar vigência' };
    }

    return { valid: true, note: 'OK' };
  }

  /**
   * Busca jurisprudência recente para tema
   * @param {string} tema - Ex: "tutela provisória"
   * @returns {Array} Lista de precedentes recentes
   */
  async buscarJurisprudenciaRecente(tema) {
    // Aqui implementaríamos integração com API do STF/STJ
    // Por ora, retorna estrutura base

    const mockPrecedentes = {
      'tutela provisória': [
        {
          tribunal: 'STF',
          numero: 'RE 123456',
          ementa: 'Tutela provisória. Requisitos. Probabilidade do direito e perigo de dano.',
          data: '2024-01-15',
          relevancia: 'alta'
        }
      ],
      'honorários advocatícios': [
        {
          tribunal: 'STJ',
          numero: 'REsp 654321',
          ementa: 'Honorários. Cumprimento de sentença. 10% sobre o valor (Art. 523, § 1º, CPC).',
          data: '2024-02-10',
          relevancia: 'alta'
        }
      ]
    };

    return mockPrecedentes[tema] || [];
  }

  /**
   * Analisa prompt e identifica pontos para atualização
   * @param {string} promptContent - Conteúdo do prompt
   * @returns {Object} Análise com sugestões
   */
  analisarPrompt(promptContent) {
    const analise = {
      dispositivosLegais: [],
      jurisprudenciaCitada: [],
      datasEncontradas: [],
      sugestoesAtualizacao: []
    };

    // Extrair dispositivos legais (Art. XXX)
    const dispositivosRegex = /Art\.?\s+\d+[ºª°]?(?:[-,]\s*[ºª°]?\d+)*(?:\s+do\s+[A-Z]{2,})?/gi;
    const dispositivos = promptContent.match(dispositivosRegex) || [];
    analise.dispositivosLegais = [...new Set(dispositivos)];

    // Extrair referências a leis
    const leisRegex = /Lei\s+n?[º°]?\s*[\d.]+\/\d{4}|Decreto-Lei\s+n?[º°]?\s*[\d.]+\/\d{4}/gi;
    const leis = promptContent.match(leisRegex) || [];
    analise.leisCitadas = [...new Set(leis)];

    // Extrair referências a jurisprudência
    const jurisRegex = /STF|STJ|REsp|RE|AgInt|HC|RHC|MS|IRDR|IAC|Súmula\s+\d+/gi;
    const juris = promptContent.match(jurisRegex) || [];
    analise.jurisprudenciaCitada = [...new Set(juris)];

    // Verificar se há data de atualização
    const dataRegex = /\d{4}-\d{2}-\d{2}/g;
    const datas = promptContent.match(dataRegex) || [];
    analise.datasEncontradas = datas;

    // Sugestões baseadas em heurísticas
    if (dispositivos.length > 0 && juris.length === 0) {
      analise.sugestoesAtualizacao.push('Adicionar jurisprudência para fundamentar dispositivos legais');
    }

    if (datas.length === 0) {
      analise.sugestoesAtualizacao.push('Adicionar metadados de data de atualização');
    }

    return analise;
  }

  /**
   * Atualiza prompt com base em análise e dados novos
   * @param {string} promptPath - Caminho do arquivo
   * @param {Object} updates - Atualizações a aplicar
   */
  async atualizarPrompt(promptPath, updates) {
    try {
      let content = fs.readFileSync(promptPath, 'utf8');

      // Aplicar atualizações
      if (updates.substituirDispositivo) {
        const { antigo, novo } = updates.substituirDispositivo;
        content = content.replace(new RegExp(antigo, 'g'), novo);
      }

      if (updates.adicionarJurisprudencia) {
        // Adicionar seção de jurisprudência se não existir
        if (!content.includes('## Jurisprudência')) {
          content += '\n\n## Jurisprudência Recente\n\n';
        }
        content += updates.adicionarJurisprudencia + '\n';
      }

      if (updates.atualizarData) {
        // Atualizar data de última modificação
        const dataAtual = new Date().toISOString().split('T')[0];
        content = content.replace(
          /Última Atualização:\s*\d{4}-\d{2}-\d{2}/,
          `Última Atualização: ${dataAtual}`
        );
      }

      // Salvar arquivo atualizado
      fs.writeFileSync(promptPath, content, 'utf8');

      // Registrar atualização
      this.registrarAtualizacao({
        arquivo: path.basename(promptPath),
        data: new Date().toISOString(),
        updates: Object.keys(updates),
        tipo: 'automatica'
      });

      // 🔄 PROPAGAR AUTO-EVOLUÇÃO (notificar parceiros com override)
      const promptId = path.basename(promptPath, '.md');
      const motivoAtualizacao = Object.keys(updates).join(', ');
      this.versioning.propagarAutoEvolucao(
        promptId,
        content,
        motivoAtualizacao
      );

      console.log(`✅ Prompt ${promptId} atualizado e versão propagada para parceiros`);

      return { success: true, message: 'Prompt atualizado com sucesso' };
    } catch (error) {
      console.error('Erro ao atualizar prompt:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Registra atualização no log
   */
  registrarAtualizacao(update) {
    let updates = [];
    if (fs.existsSync(this.updateLogPath)) {
      updates = JSON.parse(fs.readFileSync(this.updateLogPath, 'utf8'));
    }

    updates.push(update);

    // Manter apenas últimas 1000 atualizações
    if (updates.length > 1000) {
      updates = updates.slice(-1000);
    }

    fs.writeFileSync(this.updateLogPath, JSON.stringify(updates, null, 2));
  }

  /**
   * Processa feedback do usuário e aprende
   * @param {Object} feedback - { promptId, peçaGerada, ediçõesFeitas, rating }
   */
  async processarFeedback(feedback) {
    try {
      let feedbacks = [];
      if (fs.existsSync(this.feedbackPath)) {
        feedbacks = JSON.parse(fs.readFileSync(this.feedbackPath, 'utf8'));
      }

      feedbacks.push({
        ...feedback,
        data: new Date().toISOString()
      });

      fs.writeFileSync(this.feedbackPath, JSON.stringify(feedbacks, null, 2));

      // Analisar padrões de edição
      await this.analisarPadroesDeEdicao(feedbacks);

      return { success: true };
    } catch (error) {
      console.error('Erro ao processar feedback:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Analisa padrões nas edições dos usuários
   */
  async analisarPadroesDeEdicao(feedbacks) {
    // Análise simplificada - em produção seria mais sofisticada
    const padroes = {
      tonsPreferidos: {},
      extensaoPreferida: {},
      estruturasComuns: {}
    };

    feedbacks.forEach(fb => {
      if (fb.ediçõesFeitas) {
        // Detectar se usuário deixa peça mais curta ou mais longa
        const delta = fb.ediçõesFeitas.length - fb.peçaGerada.length;
        if (delta < -100) padroes.extensaoPreferida['curta'] = (padroes.extensaoPreferida['curta'] || 0) + 1;
        if (delta > 100) padroes.extensaoPreferida['longa'] = (padroes.extensaoPreferida['longa'] || 0) + 1;
      }
    });

    // Salvar padrões aprendidos
    const padroesPath = path.join(__dirname, '../logs/padroes_aprendidos.json');
    fs.writeFileSync(padroesPath, JSON.stringify(padroes, null, 2));

    return padroes;
  }

  /**
   * Executa verificação periódica de todos os prompts
   */
  async verificarTodosPrompts() {
    console.log('🔍 Iniciando verificação de prompts...');

    const files = fs.readdirSync(this.promptsDir).filter(f => f.endsWith('.md'));
    const resultados = [];

    for (const file of files) {
      const filePath = path.join(this.promptsDir, file);
      const content = fs.readFileSync(filePath, 'utf8');
      const analise = this.analisarPrompt(content);

      resultados.push({
        arquivo: file,
        analise,
        status: analise.sugestoesAtualizacao.length === 0 ? 'OK' : 'ATENÇÃO'
      });
    }

    console.log(`✅ Verificados ${files.length} prompts`);

    // Salvar relatório
    const relatorioPath = path.join(__dirname, '../logs/verificacao_prompts.json');
    fs.writeFileSync(relatorioPath, JSON.stringify({
      data: new Date().toISOString(),
      resultados
    }, null, 2));

    return resultados;
  }

  /**
   * Agenda verificação periódica
   */
  iniciarVerificacaoPeriodica() {
    // Verificar a cada 24 horas
    const INTERVALO_24H = 24 * 60 * 60 * 1000;

    setInterval(async () => {
      console.log('🤖 Executando verificação automática de prompts...');
      await this.verificarTodosPrompts();
    }, INTERVALO_24H);

    console.log('✅ Sistema de auto-atualização ativado (verificação a cada 24h)');
  }
}

module.exports = PromptUpdater;
