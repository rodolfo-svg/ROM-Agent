/**
 * Process Segmenter
 * Segmenta processos judiciais por evento, folha ou tipo de peça
 *
 * Funções:
 * - Identificar eventos (petições, decisões, despachos)
 * - Segmentar por número de folha
 * - Extrair peças processuais individuais
 */

import fs from 'fs';
import path from 'path';

export class ProcessSegmenter {
  constructor() {
    // Padrões de identificação de eventos
    this.eventPatterns = {
      peticao: /(?:petição|inicial|contestação|recurso|agravo|apelação)/i,
      decisao: /(?:decisão|sentença|acórdão|despacho judicial)/i,
      despacho: /(?:despacho|certidão|intimação)/i,
      manifestacao: /(?:manifestação|impugnação|réplica|tréplica)/i,
      juntada: /(?:juntada|anexação|documento|comprovante)/i
    };

    // Padrões de numeração de folhas
    this.folhaPatterns = [
      /(?:fls?\.?\s*(\d+))/i,                    // fl. 123, fls. 123
      /(?:folhas?\s*(\d+))/i,                     // folha 123
      /(?:página\s*(\d+))/i,                      // página 123
      /(?:\[(\d+)\])/,                            // [123]
      /^(\d+)\s*[-–]\s*(?:EVENTO|PEÇA)/im        // 123 - EVENTO
    ];

    // Padrões de numeração de eventos
    this.eventoPatterns = [
      /(?:evento\s*(?:nº|n\.?|número)?\s*(\d+))/i,
      /(?:EVENTO\s+(\d+))/,
      /^(\d+)\s*[-–]\s*(.+?)(?:\n|$)/m           // 123 - Descrição
    ];
  }

  /**
   * Segmentar processo por eventos
   */
  segmentByEvent(text) {
    const segments = [];
    let currentEvent = null;
    let currentText = '';
    let eventNumber = 0;

    const lines = text.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Tentar identificar início de novo evento
      let isNewEvent = false;
      let eventType = null;
      let eventNum = null;

      // Verificar padrões de evento
      for (const pattern of this.eventoPatterns) {
        const match = line.match(pattern);
        if (match) {
          eventNum = match[1];
          isNewEvent = true;
          break;
        }
      }

      // Verificar tipo de peça
      if (!eventType) {
        for (const [type, pattern] of Object.entries(this.eventPatterns)) {
          if (pattern.test(line)) {
            eventType = type;
            break;
          }
        }
      }

      // Se encontrou novo evento e já tinha um anterior
      if (isNewEvent && currentEvent) {
        segments.push({
          type: 'event',
          eventNumber: currentEvent.number,
          eventType: currentEvent.type,
          title: currentEvent.title,
          content: currentText.trim(),
          startLine: currentEvent.startLine,
          endLine: i - 1,
          wordCount: currentText.split(/\s+/).length
        });

        currentText = '';
      }

      // Iniciar novo evento
      if (isNewEvent) {
        eventNumber++;
        currentEvent = {
          number: eventNum || eventNumber,
          type: eventType || 'unknown',
          title: line.trim(),
          startLine: i
        };
      }

      // Adicionar linha ao evento atual
      currentText += line + '\n';
    }

    // Adicionar último evento
    if (currentEvent && currentText) {
      segments.push({
        type: 'event',
        eventNumber: currentEvent.number,
        eventType: currentEvent.type,
        title: currentEvent.title,
        content: currentText.trim(),
        startLine: currentEvent.startLine,
        endLine: lines.length - 1,
        wordCount: currentText.split(/\s+/).length
      });
    }

    return {
      success: true,
      totalEvents: segments.length,
      segments
    };
  }

  /**
   * Segmentar processo por folhas
   */
  segmentByFolha(text) {
    const segments = [];
    let currentFolha = null;
    let currentText = '';

    const lines = text.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Tentar identificar número de folha
      let folhaNum = null;

      for (const pattern of this.folhaPatterns) {
        const match = line.match(pattern);
        if (match) {
          folhaNum = parseInt(match[1], 10);
          break;
        }
      }

      // Se encontrou nova folha e já tinha uma anterior
      if (folhaNum && currentFolha !== null && folhaNum !== currentFolha) {
        segments.push({
          type: 'folha',
          folhaNumber: currentFolha,
          content: currentText.trim(),
          wordCount: currentText.split(/\s+/).length
        });

        currentText = '';
        currentFolha = folhaNum;
      }

      // Iniciar primeira folha
      if (folhaNum && currentFolha === null) {
        currentFolha = folhaNum;
      }

      // Adicionar linha à folha atual
      currentText += line + '\n';
    }

    // Adicionar última folha
    if (currentFolha !== null && currentText) {
      segments.push({
        type: 'folha',
        folhaNumber: currentFolha,
        content: currentText.trim(),
        wordCount: currentText.split(/\s+/).length
      });
    }

    return {
      success: true,
      totalFolhas: segments.length,
      segments
    };
  }

  /**
   * Extrair peças processuais específicas
   */
  extractPieces(text) {
    const pieces = [];

    // Padrões de peças importantes
    const piecePatterns = {
      'Petição Inicial': /PETIÇÃO\s+INICIAL|EXORDIAL/i,
      'Contestação': /CONTESTAÇÃO|RESPOSTA\s+DO\s+RÉU/i,
      'Sentença': /SENTENÇA/i,
      'Acórdão': /ACÓRDÃO/i,
      'Recurso': /(?:APELAÇÃO|AGRAVO|RECURSO)/i,
      'Despacho': /DESPACHO/i,
      'Decisão Interlocutória': /DECISÃO\s+INTERLOCUTÓRIA/i
    };

    for (const [pieceName, pattern] of Object.entries(piecePatterns)) {
      const matches = [...text.matchAll(new RegExp(pattern.source + '([\\s\\S]{0,5000}?)(?=\\n\\n[A-Z]{3,}|$)', 'gi'))];

      for (let i = 0; i < matches.length; i++) {
        const match = matches[i];
        const content = match[0];

        pieces.push({
          type: 'piece',
          pieceName,
          content: content.trim(),
          wordCount: content.split(/\s+/).length,
          index: i + 1
        });
      }
    }

    return {
      success: true,
      totalPieces: pieces.length,
      pieces
    };
  }

  /**
   * Segmentação completa (eventos + folhas + peças)
   */
  async segmentComplete(text, options = {}) {
    const result = {
      success: true,
      byEvent: null,
      byFolha: null,
      pieces: null,
      summary: {}
    };

    // Segmentar por eventos
    if (options.includeEvents !== false) {
      result.byEvent = this.segmentByEvent(text);
      result.summary.totalEvents = result.byEvent.totalEvents;
    }

    // Segmentar por folhas
    if (options.includeFolhas !== false) {
      result.byFolha = this.segmentByFolha(text);
      result.summary.totalFolhas = result.byFolha.totalFolhas;
    }

    // Extrair peças
    if (options.includePieces !== false) {
      result.pieces = this.extractPieces(text);
      result.summary.totalPieces = result.pieces.totalPieces;
    }

    return result;
  }

  /**
   * Salvar segmentos em arquivos separados
   */
  async saveSegments(segments, outputDir, baseName) {
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const savedFiles = [];

    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i];

      let filename;
      if (segment.type === 'event') {
        filename = `${baseName}_evento_${segment.eventNumber}_${segment.eventType}.txt`;
      } else if (segment.type === 'folha') {
        filename = `${baseName}_folha_${segment.folhaNumber}.txt`;
      } else if (segment.type === 'piece') {
        filename = `${baseName}_${segment.pieceName.replace(/\s+/g, '_')}_${segment.index}.txt`;
      } else {
        filename = `${baseName}_segment_${i + 1}.txt`;
      }

      const filepath = path.join(outputDir, filename);
      fs.writeFileSync(filepath, segment.content, 'utf8');
      savedFiles.push(filepath);
    }

    return {
      success: true,
      filesCreated: savedFiles.length,
      files: savedFiles
    };
  }
}

export default ProcessSegmenter;
