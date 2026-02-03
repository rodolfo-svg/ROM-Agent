/**
 * Continuation Manager - Sistema de Geração Multi-Step para Documentos Grandes
 *
 * Permite geração de documentos >35 páginas dividindo em múltiplas etapas
 *
 * @module continuation-manager
 */

import { logger } from '../utils/logger.js';

export class ContinuationManager {
  constructor() {
    this.MAX_SINGLE_PASS_PAGES = 35; // Limite validado em testes
    this.PAGES_PER_STEP = 20; // Páginas por etapa em multi-step
    this.MIN_PAGES_FOR_MULTI_STEP = 36; // Mínimo para acionar multi-step
  }

  /**
   * Verifica se documento requer geração multi-step
   * @param {number} totalPages - Total de páginas desejadas
   * @returns {boolean} true se requer multi-step
   */
  requiresMultiStep(totalPages) {
    return totalPages > this.MAX_SINGLE_PASS_PAGES;
  }

  /**
   * Divide documento grande em múltiplas etapas
   * @param {number} totalPages - Total de páginas desejadas
   * @param {string} documentType - Tipo de peça
   * @returns {Array} Array de objetos com configuração de cada etapa
   */
  splitIntoSteps(totalPages, documentType) {
    if (!this.requiresMultiStep(totalPages)) {
      logger.info(`[ContinuationManager] ${totalPages} páginas não requer multi-step`);
      return [{
        step: 1,
        totalSteps: 1,
        pages: totalPages,
        isFirstStep: true,
        isLastStep: true,
        isComplete: true,
        estimatedMinutes: this.estimateTime(totalPages)
      }];
    }

    const steps = [];
    let remainingPages = totalPages;
    let stepNumber = 1;

    while (remainingPages > 0) {
      const pagesToGenerate = Math.min(remainingPages, this.PAGES_PER_STEP);
      const isFirstStep = stepNumber === 1;
      const isLastStep = remainingPages <= this.PAGES_PER_STEP;

      steps.push({
        step: stepNumber,
        totalSteps: Math.ceil(totalPages / this.PAGES_PER_STEP),
        pages: pagesToGenerate,
        isFirstStep,
        isLastStep,
        isComplete: false,
        estimatedMinutes: this.estimateTime(pagesToGenerate),
        sectionDescription: this.getSectionDescription(stepNumber, isFirstStep, isLastStep)
      });

      remainingPages -= pagesToGenerate;
      stepNumber++;
    }

    logger.info(`[ContinuationManager] ${totalPages} páginas dividido em ${steps.length} etapas`);
    return steps;
  }

  /**
   * Estima tempo de geração baseado em páginas
   * @param {number} pages - Número de páginas
   * @returns {number} Tempo estimado em minutos
   */
  estimateTime(pages) {
    if (pages <= 15) return 1;
    if (pages <= 20) return 6;
    if (pages <= 25) return 9;
    if (pages <= 30) return 12;
    if (pages <= 35) return 15;
    return 12; // Por padrão para etapas de 20 páginas
  }

  /**
   * Retorna descrição da seção para cada etapa
   * @param {number} stepNumber - Número da etapa
   * @param {boolean} isFirstStep - Se é primeira etapa
   * @param {boolean} isLastStep - Se é última etapa
   * @returns {string} Descrição da seção
   */
  getSectionDescription(stepNumber, isFirstStep, isLastStep) {
    if (isFirstStep) {
      return 'Preliminares + Primeira metade do mérito';
    }
    if (isLastStep) {
      return 'Segunda metade do mérito + Jurisprudência + Doutrina + Pedidos';
    }
    return `Continuação do mérito (parte ${stepNumber})`;
  }

  /**
   * Gera prompt otimizado para cada etapa
   * @param {object} options - Configurações da etapa
   * @returns {string} Prompt otimizado para a etapa
   */
  buildStepPrompt(options) {
    const {
      step,
      pages,
      documentType,
      theme,
      isFirstStep,
      isLastStep,
      additionalInstructions = ''
    } = options;

    let prompt = '';

    if (isFirstStep) {
      // Primeira etapa: Preliminares + Primeira metade do mérito
      prompt = `Elabore primeira parte (preliminares + primeira metade do mérito) de ${documentType} sobre ${theme}. ${pages} páginas.`;

      if (additionalInstructions) {
        prompt += ` ${additionalInstructions}`;
      }

      prompt += ' Gere o máximo possível dentro do limite de 64K tokens.';

      // Instrução especial para multi-step
      prompt += ' IMPORTANTE: Esta é a PRIMEIRA PARTE de um documento maior. Gere preliminares completas e desenvolva a primeira metade do mérito. NÃO inclua pedidos finais ainda.';

    } else if (isLastStep) {
      // Última etapa: Resto do mérito + Jurisprudência + Doutrina + Pedidos
      prompt = `Continue ${documentType} anterior gerando segunda metade do mérito, jurisprudência, doutrina e pedidos completos. ${pages} páginas.`;

      if (additionalInstructions) {
        prompt += ` ${additionalInstructions}`;
      }

      prompt += ' Gere o máximo possível dentro do limite de 64K tokens.';

      // Instrução especial para multi-step
      prompt += ' IMPORTANTE: Esta é a ÚLTIMA PARTE do documento. Continue de onde a parte anterior parou, desenvolva a segunda metade do mérito, adicione jurisprudência e doutrina, e FINALIZE com pedidos completos e fecho.';

    } else {
      // Etapas intermediárias (se houver mais de 2 etapas)
      prompt = `Continue ${documentType} anterior desenvolvendo próxima seção do mérito. ${pages} páginas.`;

      if (additionalInstructions) {
        prompt += ` ${additionalInstructions}`;
      }

      prompt += ' Gere o máximo possível dentro do limite de 64K tokens.';

      // Instrução especial para multi-step
      prompt += ` IMPORTANTE: Esta é a PARTE ${step} de um documento maior. Continue de onde parou e desenvolva próxima seção do mérito. NÃO inclua pedidos finais ainda.`;
    }

    return prompt;
  }

  /**
   * Mescla múltiplos documentos gerados em documento único
   * @param {Array} parts - Array de strings com documentos parciais
   * @param {object} options - Opções de mesclagem
   * @returns {string} Documento completo mesclado
   */
  mergeParts(parts, options = {}) {
    const { documentType = '', removeHeaders = true } = options;

    if (parts.length === 0) {
      throw new Error('Nenhuma parte para mesclar');
    }

    if (parts.length === 1) {
      return parts[0];
    }

    logger.info(`[ContinuationManager] Mesclando ${parts.length} partes`);

    const merged = parts.map((part, index) => {
      if (index === 0) {
        // Primeira parte: mantém tudo (cabeçalho, preliminares, mérito)
        return part.trim();
      }

      // Partes subsequentes: remove cabeçalho/preliminares duplicados
      let cleanedPart = part.trim();

      if (removeHeaders) {
        // Remove cabeçalhos típicos de peças jurídicas
        cleanedPart = cleanedPart.replace(/^[\s\S]*?(EXCELENTÍSSIMO|EGRÉGIO|COLENDO)/im, '');

        // Remove identificação de partes duplicada
        cleanedPart = cleanedPart.replace(/^[\s\S]*?(Autor:|Réu:|Recorrente:|Recorrido:)/im, '');

        // Remove endereçamento duplicado
        cleanedPart = cleanedPart.replace(/^[\s\S]*?(Processo n[º°]|Ação:|Comarca:)/im, '');
      }

      // Remove texto de introdução/continuação se houver
      cleanedPart = cleanedPart.replace(/^(Continuando|Dando continuidade|Prosseguindo)[\s\S]*?(?=\n\n)/im, '');

      return cleanedPart.trim();
    }).filter(part => part.length > 0);

    const finalDocument = merged.join('\n\n');

    logger.info(`[ContinuationManager] Documento final: ${finalDocument.length} caracteres`);

    return finalDocument;
  }

  /**
   * Valida se partes foram geradas corretamente
   * @param {Array} parts - Array de documentos parciais
   * @param {number} expectedParts - Número esperado de partes
   * @returns {object} Resultado da validação
   */
  validateParts(parts, expectedParts) {
    const validation = {
      isValid: true,
      errors: [],
      warnings: []
    };

    // Verifica se número de partes está correto
    if (parts.length !== expectedParts) {
      validation.isValid = false;
      validation.errors.push(
        `Número de partes incorreto. Esperado: ${expectedParts}, Obtido: ${parts.length}`
      );
    }

    // Verifica se cada parte tem conteúdo mínimo
    parts.forEach((part, index) => {
      if (!part || part.trim().length < 500) {
        validation.isValid = false;
        validation.errors.push(
          `Parte ${index + 1} vazia ou muito curta (${part?.length || 0} caracteres)`
        );
      }
    });

    // Verifica se primeira parte tem preliminares
    if (parts[0] && !parts[0].match(/preliminar/i)) {
      validation.warnings.push('Primeira parte pode não conter preliminares');
    }

    // Verifica se última parte tem pedidos
    const lastPart = parts[parts.length - 1];
    if (lastPart && !lastPart.match(/pedido|requer/i)) {
      validation.warnings.push('Última parte pode não conter pedidos');
    }

    logger.info(`[ContinuationManager] Validação: ${validation.isValid ? 'OK' : 'FALHA'}`);
    if (validation.errors.length > 0) {
      logger.error(`[ContinuationManager] Erros: ${validation.errors.join(', ')}`);
    }
    if (validation.warnings.length > 0) {
      logger.warn(`[ContinuationManager] Avisos: ${validation.warnings.join(', ')}`);
    }

    return validation;
  }

  /**
   * Calcula estatísticas do processo multi-step
   * @param {Array} steps - Array de etapas
   * @param {Array} parts - Array de documentos gerados
   * @returns {object} Estatísticas
   */
  getStatistics(steps, parts) {
    const totalPages = steps.reduce((sum, step) => sum + step.pages, 0);
    const totalTime = steps.reduce((sum, step) => sum + step.estimatedMinutes, 0);
    const totalChars = parts.reduce((sum, part) => sum + part.length, 0);
    const avgCharsPerPage = Math.round(totalChars / totalPages);
    const estimatedTokens = Math.round(totalChars / 4); // Aproximação: 1 token ≈ 4 chars

    return {
      totalSteps: steps.length,
      totalPages,
      totalTimeMinutes: totalTime,
      totalCharacters: totalChars,
      avgCharactersPerPage: avgCharsPerPage,
      estimatedTokens,
      partsGenerated: parts.length,
      avgCharsPerPart: Math.round(totalChars / parts.length)
    };
  }
}

// Singleton
export const continuationManager = new ContinuationManager();
