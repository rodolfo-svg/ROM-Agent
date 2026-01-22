/**
 * Utilitários para Testes
 *
 * Funções auxiliares compartilhadas entre os testes
 */

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * Verifica se um processo está rodando
 */
export async function isProcessRunning(processName) {
  try {
    const { stdout } = await execAsync(`ps aux | grep "${processName}" | grep -v grep`);
    return stdout.trim().length > 0;
  } catch (error) {
    return false;
  }
}

/**
 * Aguarda um determinado tempo
 */
export function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Verifica se servidor está respondendo
 */
export async function waitForServer(url, timeout = 30000) {
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        return true;
      }
    } catch (error) {
      // Servidor ainda não está pronto
    }

    await sleep(1000);
  }

  return false;
}

/**
 * Compara buffers (útil para testes de PDF/DOCX)
 */
export function buffersEqual(buf1, buf2) {
  if (buf1.length !== buf2.length) {
    return false;
  }

  for (let i = 0; i < buf1.length; i++) {
    if (buf1[i] !== buf2[i]) {
      return false;
    }
  }

  return true;
}

/**
 * Verifica se buffer é um PDF válido
 */
export function isPDFBuffer(buffer) {
  const header = buffer.toString('utf8', 0, 4);
  return header === '%PDF';
}

/**
 * Verifica se buffer é um DOCX válido (ZIP file)
 */
export function isDOCXBuffer(buffer) {
  const header = buffer.toString('hex', 0, 4);
  return header === '504b0304'; // PK.. (ZIP signature)
}

/**
 * Formata bytes em formato legível
 */
export function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

/**
 * Cria um mock de objeto Request (para testes de middleware)
 */
export function createMockRequest(options = {}) {
  return {
    body: options.body || {},
    params: options.params || {},
    query: options.query || {},
    headers: options.headers || {},
    method: options.method || 'GET',
    url: options.url || '/',
    path: options.path || '/',
    ...options
  };
}

/**
 * Cria um mock de objeto Response (para testes de middleware)
 */
export function createMockResponse() {
  const res = {
    statusCode: 200,
    headers: {},
    body: null,

    status(code) {
      this.statusCode = code;
      return this;
    },

    json(data) {
      this.body = data;
      return this;
    },

    send(data) {
      this.body = data;
      return this;
    },

    setHeader(key, value) {
      this.headers[key] = value;
      return this;
    },

    getHeader(key) {
      return this.headers[key];
    }
  };

  return res;
}

/**
 * Extrai estatísticas de um texto
 */
export function getTextStats(text) {
  return {
    length: text.length,
    lines: text.split('\n').length,
    words: text.split(/\s+/).filter(w => w.length > 0).length,
    characters: text.replace(/\s/g, '').length,
    paragraphs: text.split(/\n\n+/).length
  };
}

/**
 * Valida estrutura HTML básica
 */
export function isValidHTML(html) {
  const hasDoctype = html.includes('<!DOCTYPE') || html.includes('<!doctype');
  const hasHtmlTag = html.includes('<html') && html.includes('</html>');
  const hasBodyTag = html.includes('<body') && html.includes('</body>');

  return hasDoctype && hasHtmlTag && hasBodyTag;
}

/**
 * Extrai título de documento HTML
 */
export function extractHTMLTitle(html) {
  const match = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  return match ? match[1] : null;
}

/**
 * Conta ocorrências de uma string em texto
 */
export function countOccurrences(text, search) {
  return (text.match(new RegExp(search, 'g')) || []).length;
}

/**
 * Reporter customizado para testes
 */
export class TestReporter {
  constructor() {
    this.passed = 0;
    this.failed = 0;
    this.skipped = 0;
    this.startTime = Date.now();
  }

  onTestPass(test) {
    this.passed++;
    console.log(`  ✅ ${test.name}`);
  }

  onTestFail(test, error) {
    this.failed++;
    console.log(`  ❌ ${test.name}`);
    console.log(`     ${error.message}`);
  }

  onTestSkip(test) {
    this.skipped++;
    console.log(`  ⏭️  ${test.name}`);
  }

  summary() {
    const duration = Date.now() - this.startTime;

    console.log('\n' + '='.repeat(60));
    console.log('📊 RESUMO DOS TESTES');
    console.log('='.repeat(60));
    console.log(`✅ Passou:  ${this.passed}`);
    console.log(`❌ Falhou:  ${this.failed}`);
    console.log(`⏭️  Pulado:  ${this.skipped}`);
    console.log(`⏱️  Duração: ${duration}ms`);
    console.log('='.repeat(60));

    return this.failed === 0;
  }
}

/**
 * Gera um ID único para testes
 */
export function generateTestId() {
  return `test_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Limpa diretório de outputs de teste
 */
export async function cleanTestOutputs(dir = './tests/output') {
  try {
    await execAsync(`rm -rf ${dir}/*`);
    console.log(`✅ Diretório de outputs limpo: ${dir}`);
  } catch (error) {
    console.warn(`⚠️  Erro ao limpar outputs: ${error.message}`);
  }
}

export default {
  isProcessRunning,
  sleep,
  waitForServer,
  buffersEqual,
  isPDFBuffer,
  isDOCXBuffer,
  formatBytes,
  createMockRequest,
  createMockResponse,
  getTextStats,
  isValidHTML,
  extractHTMLTitle,
  countOccurrences,
  TestReporter,
  generateTestId,
  cleanTestOutputs
};
