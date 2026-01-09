/**
 * ROM Agent - Busca Semântica Local
 * Implementa busca semântica usando TF-IDF (100% gratuito, sem gastar tokens)
 * Usa biblioteca 'natural' para processamento de linguagem natural
 */

import natural from 'natural';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TfIdf = natural.TfIdf;
const tokenizer = new natural.WordTokenizer();

/**
 * Classe para gerenciar busca semântica no Knowledge Base
 */
class SemanticSearch {
  constructor() {
    this.tfidf = new TfIdf();
    this.documents = [];
    this.index = null;
    this.indexPath = path.join(__dirname, '../data/semantic-index.json');
  }

  /**
   * Adicionar documento ao índice
   * @param {Object} document - Documento a ser indexado
   * @param {string} document.id - ID do documento
   * @param {string} document.text - Texto do documento
   * @param {Object} document.metadata - Metadados do documento
   */
  addDocument(document) {
    const { id, text, metadata = {} } = document;

    // Preprocessar texto (lowercase, remover pontuação)
    const processedText = this.preprocessText(text);

    // Adicionar ao TF-IDF
    this.tfidf.addDocument(processedText);

    // Armazenar documento
    this.documents.push({
      id,
      text,
      processedText,
      metadata,
      addedAt: new Date().toISOString()
    });

    return { success: true, documentId: id, documentsCount: this.documents.length };
  }

  /**
   * Adicionar múltiplos documentos de uma vez
   * @param {Array} documents - Array de documentos
   */
  addDocuments(documents) {
    const results = documents.map(doc => this.addDocument(doc));
    this.saveIndex();
    return { success: true, added: results.length, total: this.documents.length };
  }

  /**
   * Buscar documentos similares
   * @param {string} query - Consulta de busca
   * @param {number} limit - Número máximo de resultados
   * @returns {Array} Documentos ordenados por relevância
   */
  search(query, limit = 10) {
    if (!query || query.trim() === '') {
      return [];
    }

    const processedQuery = this.preprocessText(query);
    const results = [];

    // Calcular TF-IDF para a query
    this.tfidf.tfidfs(processedQuery, (i, measure) => {
      if (measure > 0 && this.documents[i]) {
        results.push({
          document: this.documents[i],
          score: measure,
          relevance: this.calculateRelevance(measure)
        });
      }
    });

    // Ordenar por score (maior primeiro)
    results.sort((a, b) => b.score - a.score);

    // Limitar resultados
    const limitedResults = results.slice(0, limit);

    return limitedResults.map(result => ({
      id: result.document.id,
      text: result.document.text,
      metadata: result.document.metadata,
      score: result.score,
      relevance: result.relevance,
      excerpt: this.generateExcerpt(result.document.text, query)
    }));
  }

  /**
   * Buscar documentos similares a um documento existente
   * @param {string} documentId - ID do documento de referência
   * @param {number} limit - Número máximo de resultados
   */
  findSimilar(documentId, limit = 5) {
    const document = this.documents.find(doc => doc.id === documentId);
    if (!document) {
      return [];
    }

    return this.search(document.processedText, limit + 1)
      .filter(result => result.id !== documentId)
      .slice(0, limit);
  }

  /**
   * Preprocessar texto para análise
   */
  preprocessText(text) {
    if (!text) return '';

    // Lowercase
    let processed = text.toLowerCase();

    // Remover pontuação (manter espaços)
    processed = processed.replace(/[^\w\sáàâãéêíóôõúç]/g, '');

    // Remover números
    processed = processed.replace(/\d+/g, '');

    // Remover espaços múltiplos
    processed = processed.replace(/\s+/g, ' ').trim();

    // Tokenizar e remover stopwords (em português)
    const tokens = tokenizer.tokenize(processed);
    const stopwords = this.getPortugueseStopwords();
    const filteredTokens = tokens.filter(token => !stopwords.includes(token));

    return filteredTokens.join(' ');
  }

  /**
   * Calcular relevância (0-100%)
   */
  calculateRelevance(score) {
    // Normalizar score para 0-100%
    // TF-IDF scores geralmente variam de 0 a ~5
    const normalized = Math.min(score / 5, 1);
    return Math.round(normalized * 100);
  }

  /**
   * Gerar trecho relevante do documento
   */
  generateExcerpt(text, query, contextLength = 150) {
    const queryTerms = this.preprocessText(query).split(' ');
    const lowerText = text.toLowerCase();

    // Encontrar primeira ocorrência de qualquer termo
    let startIndex = -1;
    for (const term of queryTerms) {
      const index = lowerText.indexOf(term);
      if (index !== -1 && (startIndex === -1 || index < startIndex)) {
        startIndex = index;
      }
    }

    if (startIndex === -1) {
      return text.substring(0, contextLength) + '...';
    }

    // Extrair contexto ao redor
    const excerptStart = Math.max(0, startIndex - contextLength / 2);
    const excerptEnd = Math.min(text.length, startIndex + contextLength / 2);
    let excerpt = text.substring(excerptStart, excerptEnd);

    // Adicionar elipses
    if (excerptStart > 0) excerpt = '...' + excerpt;
    if (excerptEnd < text.length) excerpt = excerpt + '...';

    return excerpt;
  }

  /**
   * Obter stopwords em português
   */
  getPortugueseStopwords() {
    return [
      'a', 'o', 'e', 'é', 'de', 'da', 'do', 'em', 'um', 'uma', 'os', 'as',
      'dos', 'das', 'ao', 'à', 'no', 'na', 'nos', 'nas', 'com', 'por', 'para',
      'que', 'se', 'mais', 'como', 'mas', 'foi', 'ao', 'ele', 'ela', 'seu',
      'sua', 'ou', 'quando', 'muito', 'há', 'nos', 'já', 'está', 'eu', 'também',
      'só', 'pelo', 'pela', 'até', 'isso', 'ela', 'entre', 'era', 'depois',
      'sem', 'mesmo', 'aos', 'ter', 'seus', 'quem', 'nas', 'me', 'esse', 'eles',
      'você', 'essa', 'num', 'nem', 'suas', 'meu', 'às', 'minha', 'numa', 'pelos',
      'elas', 'qual', 'nós', 'lhe', 'deles', 'essas', 'esses', 'pelas', 'este',
      'dele', 'tu', 'te', 'vocês', 'vos', 'lhes', 'meus', 'minhas', 'teu', 'tua',
      'teus', 'tuas', 'nosso', 'nossa', 'nossos', 'nossas'
    ];
  }

  /**
   * Salvar índice em arquivo
   */
  saveIndex() {
    try {
      const dataDir = path.dirname(this.indexPath);
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }

      const indexData = {
        documents: this.documents,
        lastUpdated: new Date().toISOString(),
        documentsCount: this.documents.length
      };

      fs.writeFileSync(this.indexPath, JSON.stringify(indexData, null, 2));
      return { success: true, documentsCount: this.documents.length };
    } catch (error) {
      console.error('Erro ao salvar índice:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Carregar índice de arquivo
   */
  loadIndex() {
    try {
      if (!fs.existsSync(this.indexPath)) {
        return { success: false, message: 'Índice não encontrado' };
      }

      const data = JSON.parse(fs.readFileSync(this.indexPath, 'utf8'));
      this.documents = data.documents || [];

      // Reconstruir TF-IDF
      this.tfidf = new TfIdf();
      for (const doc of this.documents) {
        this.tfidf.addDocument(doc.processedText);
      }

      return { success: true, documentsCount: this.documents.length, lastUpdated: data.lastUpdated };
    } catch (error) {
      console.error('Erro ao carregar índice:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Limpar índice
   */
  clearIndex() {
    this.tfidf = new TfIdf();
    this.documents = [];
    if (fs.existsSync(this.indexPath)) {
      fs.unlinkSync(this.indexPath);
    }
    return { success: true, message: 'Índice limpo' };
  }

  /**
   * Obter estatísticas do índice
   */
  getStatistics() {
    const totalDocuments = this.documents.length;
    const totalWords = this.documents.reduce((sum, doc) => {
      return sum + doc.processedText.split(' ').length;
    }, 0);

    const avgWordsPerDoc = totalDocuments > 0 ? Math.round(totalWords / totalDocuments) : 0;

    // Calcular tamanho do índice
    let indexSize = 0;
    if (fs.existsSync(this.indexPath)) {
      indexSize = fs.statSync(this.indexPath).size;
    }

    return {
      totalDocuments,
      totalWords,
      avgWordsPerDoc,
      indexSize,
      indexSizeFormatted: this.formatBytes(indexSize),
      indexPath: this.indexPath,
      algorithm: 'TF-IDF',
      language: 'Portuguese',
      cost: 'R$ 0,00 (100% local)'
    };
  }

  /**
   * Formatar bytes
   */
  formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  }

  /**
   * Reindexar todos os documentos (útil após mudanças)
   */
  reindex() {
    const docs = [...this.documents];
    this.clearIndex();

    for (const doc of docs) {
      this.addDocument({
        id: doc.id,
        text: doc.text,
        metadata: doc.metadata
      });
    }

    this.saveIndex();
    return { success: true, reindexed: docs.length };
  }
}

// Instância singleton
const semanticSearch = new SemanticSearch();

// Carregar índice existente na inicialização
semanticSearch.loadIndex();

export default semanticSearch;
export { SemanticSearch };
