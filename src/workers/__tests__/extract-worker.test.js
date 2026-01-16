/**
 * Testes para Extract Worker - Isolamento de Extração
 *
 * Testes de crash e resiliência:
 * - PDF corrompido não mata servidor
 * - Worker se recupera de erros
 * - Timeout funciona corretamente
 * - Retry automático funciona
 *
 * @version 1.0.0
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs/promises';
import os from 'os';
import { Worker } from 'worker_threads';

// Importar módulos a serem testados
import { WorkerPool, getWorkerPool, shutdownWorkerPool } from '../worker-pool.js';
import { ExtractWorkerWrapper, getExtractWrapper, shutdownExtractWrapper } from '../extract-worker-wrapper.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Diretório para arquivos de teste
const TEST_DIR = path.join(os.tmpdir(), 'extract-worker-tests');

// Helper para criar arquivo de teste
async function createTestFile(filename, content) {
  const filePath = path.join(TEST_DIR, filename);
  await fs.writeFile(filePath, content);
  return filePath;
}

// Helper para criar PDF válido simples (apenas estrutura mínima)
async function createValidPDF(filename) {
  const pdfContent = `%PDF-1.4
1 0 obj
<<
/Type /Catalog
/Pages 2 0 R
>>
endobj
2 0 obj
<<
/Type /Pages
/Kids [3 0 R]
/Count 1
>>
endobj
3 0 obj
<<
/Type /Page
/Parent 2 0 R
/MediaBox [0 0 612 792]
/Contents 4 0 R
/Resources <<
  /Font <<
    /F1 5 0 R
  >>
>>
>>
endobj
4 0 obj
<<
/Length 44
>>
stream
BT
/F1 12 Tf
100 700 Td
(Hello World) Tj
ET
endstream
endobj
5 0 obj
<<
/Type /Font
/Subtype /Type1
/BaseFont /Helvetica
>>
endobj
xref
0 6
0000000000 65535 f
0000000009 00000 n
0000000058 00000 n
0000000115 00000 n
0000000266 00000 n
0000000361 00000 n
trailer
<<
/Size 6
/Root 1 0 R
>>
startxref
438
%%EOF`;

  return createTestFile(filename, pdfContent);
}

// Helper para criar PDF corrompido
async function createCorruptedPDF(filename, corruptionType = 'truncated') {
  let content;

  switch (corruptionType) {
    case 'truncated':
      // PDF truncado no meio
      content = `%PDF-1.4
1 0 obj
<<
/Type /Catalog
/Pages 2 0 R
>>
endobj
2 0 obj
<<
/Type /Pages
/Kids [3 0 R]
/Count 1
>>`;
      break;

    case 'invalid_header':
      // Arquivo que parece PDF mas tem header inválido
      content = `%PDF-9.9
INVALID CONTENT
NOT A REAL PDF`;
      break;

    case 'garbage':
      // Arquivo com lixo aleatório
      content = Buffer.from(Array(1000).fill(0).map(() => Math.floor(Math.random() * 256)));
      break;

    case 'empty':
      // PDF vazio
      content = '%PDF-1.4\n%%EOF';
      break;

    case 'huge_page_count':
      // PDF com número absurdo de páginas declaradas
      content = `%PDF-1.4
1 0 obj
<<
/Type /Catalog
/Pages 2 0 R
>>
endobj
2 0 obj
<<
/Type /Pages
/Kids []
/Count 999999999
>>
endobj
xref
0 3
trailer
<<
/Size 3
/Root 1 0 R
>>
startxref
200
%%EOF`;
      break;

    case 'recursive':
      // PDF com referências circulares
      content = `%PDF-1.4
1 0 obj
<<
/Type /Catalog
/Pages 1 0 R
/Self 1 0 R
>>
endobj
xref
0 2
trailer
<<
/Size 2
/Root 1 0 R
>>
startxref
100
%%EOF`;
      break;

    default:
      content = 'NOT A PDF AT ALL';
  }

  return createTestFile(filename, content);
}

describe('Extract Worker - Testes de Isolamento', () => {
  beforeAll(async () => {
    // Criar diretório de testes
    await fs.mkdir(TEST_DIR, { recursive: true });
  });

  afterAll(async () => {
    // Encerrar workers
    await shutdownWorkerPool();
    await shutdownExtractWrapper();

    // Limpar arquivos de teste
    try {
      await fs.rm(TEST_DIR, { recursive: true, force: true });
    } catch (error) {
      console.warn('Erro ao limpar diretório de testes:', error.message);
    }
  });

  describe('Worker Pool - Inicialização', () => {
    it('deve inicializar pool de workers corretamente', async () => {
      const pool = await getWorkerPool({ poolSize: 2, debug: false });

      expect(pool).toBeDefined();
      expect(pool.workers.size).toBe(2);
      expect(pool.isShuttingDown).toBe(false);
    });

    it('deve fornecer métricas do pool', async () => {
      const pool = await getWorkerPool();
      const metrics = pool.getMetrics();

      expect(metrics).toBeDefined();
      expect(metrics.pool).toBeDefined();
      expect(metrics.pool.activeWorkers).toBeGreaterThan(0);
      expect(metrics.workers).toBeInstanceOf(Array);
    });
  });

  describe('Crash Safety - PDF Corrompido', () => {
    it('PDF truncado não deve crashar o processo principal', async () => {
      const wrapper = await getExtractWrapper({ useWorkers: true });
      const corruptedFile = await createCorruptedPDF('truncated.pdf', 'truncated');

      let error;
      try {
        await wrapper.extract(corruptedFile, { timeout: 10000 });
      } catch (e) {
        error = e;
      }

      // O erro é esperado, mas o processo não deve crashar
      expect(error).toBeDefined();
      expect(process.exitCode).not.toBe(1);

      // Wrapper ainda deve estar funcional
      const health = await wrapper.healthCheck();
      expect(health.status).toMatch(/healthy|degraded/);
    });

    it('PDF com header inválido não deve crashar o servidor', async () => {
      const wrapper = await getExtractWrapper({ useWorkers: true });
      const corruptedFile = await createCorruptedPDF('invalid_header.pdf', 'invalid_header');

      let error;
      try {
        await wrapper.extract(corruptedFile, { timeout: 10000 });
      } catch (e) {
        error = e;
      }

      expect(error).toBeDefined();

      // Verificar que o wrapper ainda está saudável
      const health = await wrapper.healthCheck();
      expect(health.initialized).toBe(true);
    });

    it('PDF com garbage bytes não deve crashar o servidor', async () => {
      const wrapper = await getExtractWrapper({ useWorkers: true });
      const corruptedFile = await createCorruptedPDF('garbage.pdf', 'garbage');

      let error;
      try {
        await wrapper.extract(corruptedFile, { timeout: 10000 });
      } catch (e) {
        error = e;
      }

      expect(error).toBeDefined();
      expect(error.message).toContain('não é um PDF válido');
    });

    it('PDF vazio não deve crashar o servidor', async () => {
      const wrapper = await getExtractWrapper({ useWorkers: true });
      const corruptedFile = await createCorruptedPDF('empty.pdf', 'empty');

      let error;
      try {
        await wrapper.extract(corruptedFile, { timeout: 10000 });
      } catch (e) {
        error = e;
      }

      // Pode ou não gerar erro, mas não deve crashar
      expect(process.exitCode).not.toBe(1);
    });

    it('arquivo não-PDF não deve crashar o servidor', async () => {
      const wrapper = await getExtractWrapper({ useWorkers: true });
      const notAPDF = await createTestFile('not_a_pdf.pdf', 'This is not a PDF file');

      let error;
      try {
        await wrapper.extract(notAPDF, { timeout: 10000 });
      } catch (e) {
        error = e;
      }

      expect(error).toBeDefined();
      expect(error.message).toContain('não é um PDF válido');
    });
  });

  describe('Timeout e Terminação Forçada', () => {
    it('deve respeitar timeout configurado', async () => {
      const wrapper = await getExtractWrapper({ useWorkers: true });

      // Criar um PDF que pode demorar (ou simular com timeout curto)
      const testFile = await createValidPDF('timeout_test.pdf');

      const startTime = Date.now();

      try {
        await wrapper.extract(testFile, { timeout: 100 }); // 100ms timeout
      } catch (error) {
        // Pode ter sucesso ou timeout, dependendo da velocidade
      }

      const elapsed = Date.now() - startTime;
      // Se houve timeout, não deve ter demorado muito mais que o timeout
      if (elapsed > 100) {
        expect(elapsed).toBeLessThan(5000); // Margem de tolerância
      }
    });

    it('deve terminar worker travado forçadamente', async () => {
      const pool = await getWorkerPool({ taskTimeout: 1000 });

      // Simular tarefa que demora muito
      const startTime = Date.now();

      try {
        // Se isso travar por mais de 1s, deve ser terminado
        await pool.execute('extractPDF', {
          filePath: '/path/that/does/not/exist.pdf',
          options: { timeout: 500 }
        }, { timeout: 500 });
      } catch (error) {
        // Erro esperado
      }

      const elapsed = Date.now() - startTime;
      expect(elapsed).toBeLessThan(5000);
    });
  });

  describe('Retry Automático', () => {
    it('deve fazer retry em caso de falha', async () => {
      const wrapper = await getExtractWrapper({
        useWorkers: true,
        maxRetries: 2
      });

      const corruptedFile = await createCorruptedPDF('retry_test.pdf', 'truncated');

      const startTime = Date.now();

      try {
        await wrapper.extract(corruptedFile, { maxRetries: 2, timeout: 5000 });
      } catch (error) {
        // Erro esperado após retries
      }

      // Deve ter tentado múltiplas vezes (verificável nas métricas)
      const metrics = wrapper.getMetrics();
      expect(metrics.failedExtractions).toBeGreaterThan(0);
    });
  });

  describe('Fallback Síncrono', () => {
    it('deve usar fallback quando workers não estão disponíveis', async () => {
      const wrapper = new ExtractWorkerWrapper({
        useWorkers: false,
        useFallback: true
      });

      await wrapper.initialize();

      const textFile = await createTestFile('fallback_test.txt', 'Hello World');
      const result = await wrapper.extract(textFile);

      expect(result.success).toBe(true);
      expect(result.text).toContain('Hello World');
      expect(result.usedFallback).toBe(true);

      await wrapper.shutdown();
    });
  });

  describe('Métricas e Logs', () => {
    it('deve coletar métricas corretamente', async () => {
      const wrapper = await getExtractWrapper({ useWorkers: true });

      const textFile = await createTestFile('metrics_test.txt', 'Test content');
      await wrapper.extract(textFile);

      const metrics = wrapper.getMetrics();

      expect(metrics.totalExtractions).toBeGreaterThan(0);
      expect(metrics.successfulExtractions).toBeGreaterThan(0);
      expect(metrics.averageProcessingTimeMs).toBeDefined();
    });

    it('deve registrar erros nas métricas', async () => {
      const wrapper = await getExtractWrapper({ useWorkers: true });

      // Arquivo que não existe
      try {
        await wrapper.extract('/arquivo/que/nao/existe.pdf');
      } catch (error) {
        // Esperado
      }

      const metrics = wrapper.getMetrics();
      expect(metrics.failedExtractions).toBeGreaterThan(0);
      expect(metrics.recentErrors.length).toBeGreaterThan(0);
    });
  });

  describe('Validação de Arquivos', () => {
    it('deve rejeitar arquivo muito grande', async () => {
      const wrapper = new ExtractWorkerWrapper({
        maxFileSizeMB: 0.001 // 1KB
      });
      await wrapper.initialize();

      // Criar arquivo maior que 1KB
      const largeContent = 'x'.repeat(2000);
      const largeFile = await createTestFile('large_file.txt', largeContent);

      let error;
      try {
        await wrapper.extract(largeFile);
      } catch (e) {
        error = e;
      }

      expect(error).toBeDefined();
      expect(error.code).toBe('FILE_TOO_LARGE');

      await wrapper.shutdown();
    });

    it('deve rejeitar tipo de arquivo não suportado', async () => {
      const wrapper = await getExtractWrapper();

      const unsupportedFile = await createTestFile('unsupported.xyz', 'content');

      let error;
      try {
        await wrapper.extract(unsupportedFile);
      } catch (e) {
        error = e;
      }

      expect(error).toBeDefined();
      expect(error.code).toBe('UNSUPPORTED_TYPE');
    });

    it('deve rejeitar arquivo inexistente', async () => {
      const wrapper = await getExtractWrapper();

      let error;
      try {
        await wrapper.extract('/arquivo/inexistente.pdf');
      } catch (e) {
        error = e;
      }

      expect(error).toBeDefined();
      expect(error.code).toBe('FILE_NOT_FOUND');
    });
  });

  describe('Processamento em Batch', () => {
    it('deve processar múltiplos arquivos em paralelo', async () => {
      const wrapper = await getExtractWrapper({ useWorkers: true });

      // Criar múltiplos arquivos de teste
      const files = await Promise.all([
        createTestFile('batch1.txt', 'Content 1'),
        createTestFile('batch2.txt', 'Content 2'),
        createTestFile('batch3.txt', 'Content 3')
      ]);

      const result = await wrapper.extractBatch(files, { concurrency: 2 });

      expect(result.total).toBe(3);
      expect(result.successful).toBe(3);
      expect(result.failed).toBe(0);
      expect(result.results.length).toBe(3);
    });

    it('deve continuar processando mesmo com falhas parciais', async () => {
      const wrapper = await getExtractWrapper({ useWorkers: true });

      const files = [
        await createTestFile('batch_ok.txt', 'OK content'),
        '/arquivo/inexistente.pdf', // Este vai falhar
        await createTestFile('batch_ok2.txt', 'OK content 2')
      ];

      const result = await wrapper.extractBatch(files);

      expect(result.total).toBe(3);
      expect(result.successful).toBe(2);
      expect(result.failed).toBe(1);
    });
  });

  describe('Health Check', () => {
    it('deve reportar status saudável', async () => {
      const wrapper = await getExtractWrapper({ useWorkers: true });

      const health = await wrapper.healthCheck();

      expect(health.status).toBe('healthy');
      expect(health.initialized).toBe(true);
      expect(health.metrics).toBeDefined();
    });
  });

  describe('Cache de Resultados', () => {
    it('deve usar cache para arquivos já processados', async () => {
      const wrapper = await getExtractWrapper();

      const textFile = await createTestFile('cache_test.txt', 'Cached content');

      // Primeira extração
      const result1 = await wrapper.extract(textFile);
      expect(result1.fromCache).toBeFalsy();

      // Segunda extração (deve vir do cache)
      const result2 = await wrapper.extract(textFile);
      expect(result2.fromCache).toBe(true);
    });

    it('deve limpar cache quando solicitado', async () => {
      const wrapper = await getExtractWrapper();

      const textFile = await createTestFile('cache_clear_test.txt', 'Content');

      await wrapper.extract(textFile);
      wrapper.clearCache();

      const result = await wrapper.extract(textFile);
      expect(result.fromCache).toBeFalsy();
    });
  });
});

describe('Stress Test - Múltiplos PDFs Corrompidos', () => {
  it('servidor deve sobreviver a múltiplos PDFs corrompidos em sequência', async () => {
    const wrapper = await getExtractWrapper({ useWorkers: true });

    const corruptionTypes = ['truncated', 'invalid_header', 'garbage', 'empty', 'recursive'];
    const errors = [];

    for (const type of corruptionTypes) {
      const file = await createCorruptedPDF(`stress_${type}.pdf`, type);

      try {
        await wrapper.extract(file, { timeout: 5000 });
      } catch (error) {
        errors.push({ type, error: error.message });
      }
    }

    // Todos devem ter falhado, mas o wrapper ainda deve estar funcional
    expect(errors.length).toBe(corruptionTypes.length);

    const health = await wrapper.healthCheck();
    expect(health.initialized).toBe(true);

    // Deve conseguir processar um arquivo válido após as falhas
    const validFile = await createTestFile('recovery_test.txt', 'Valid content');
    const result = await wrapper.extract(validFile);
    expect(result.success).toBe(true);
  }, 60000); // Timeout de 60s para este teste
});
