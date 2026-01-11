/**
 * ROM Agent - Testes do Tesseract OCR Service
 *
 * Testes de qualidade e performance do servico de OCR com Tesseract.js
 *
 * Execucao: node --test tests/ocr-tesseract.test.js
 */

import { describe, it, before, after, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Importar modulos de OCR
let TesseractOCRService, getTesseractOCRService, quickOCR, ocrPDF;
let performOCROnPDF, performOCROnImage, needsOCR, smartOCR;
let sharp;

// Configuracao de teste
const TEST_CONFIG = {
  timeout: 120000, // 2 minutos
  performanceTargetPerPage: 5000, // 5 segundos por pagina
  minConfidence: 50, // Confianca minima aceitavel
  testImagesDir: path.join(__dirname, 'fixtures', 'images'),
  testOutputDir: path.join(__dirname, 'output', 'ocr-tests')
};

// Helper para criar imagem de teste
async function createTestImage(text, outputPath) {
  // Criar uma imagem simples com texto usando sharp
  // Como sharp nao suporta renderizacao de texto diretamente,
  // vamos criar uma imagem em branco para testes basicos

  const width = 800;
  const height = 600;

  // Criar imagem PNG em branco
  const imageBuffer = await sharp({
    create: {
      width,
      height,
      channels: 4,
      background: { r: 255, g: 255, b: 255, alpha: 1 }
    }
  })
  .png()
  .toBuffer();

  await fs.writeFile(outputPath, imageBuffer);
  return outputPath;
}

// Helper para verificar se modulos estao disponiveis
async function loadModules() {
  try {
    const tesseractService = await import('../src/services/tesseract-ocr-service.js');
    TesseractOCRService = tesseractService.TesseractOCRService;
    getTesseractOCRService = tesseractService.getTesseractOCRService;
    quickOCR = tesseractService.quickOCR;
    ocrPDF = tesseractService.ocrPDF;

    const ocrService = await import('../src/services/ocr-service.js');
    performOCROnPDF = ocrService.performOCROnPDF;
    performOCROnImage = ocrService.performOCROnImage;
    needsOCR = ocrService.needsOCR;
    smartOCR = ocrService.smartOCR;

    sharp = (await import('sharp')).default;

    return true;
  } catch (error) {
    console.error('Erro ao carregar modulos:', error.message);
    return false;
  }
}

// ===========================================================================
// TESTES DE INICIALIZACAO
// ===========================================================================

describe('TesseractOCRService - Inicializacao', async () => {
  let modulesLoaded = false;

  before(async () => {
    modulesLoaded = await loadModules();

    // Criar diretorios de teste
    await fs.mkdir(TEST_CONFIG.testImagesDir, { recursive: true });
    await fs.mkdir(TEST_CONFIG.testOutputDir, { recursive: true });
  });

  it('deve carregar modulos corretamente', () => {
    assert.ok(modulesLoaded, 'Modulos nao puderam ser carregados');
    assert.ok(TesseractOCRService, 'TesseractOCRService nao encontrado');
    assert.ok(getTesseractOCRService, 'getTesseractOCRService nao encontrado');
  });

  it('deve criar instancia do TesseractOCRService', () => {
    const service = new TesseractOCRService(2);
    assert.ok(service, 'Falha ao criar instancia');
    assert.strictEqual(service.workerCount, 2, 'workerCount incorreto');
    assert.strictEqual(service.isInitialized, false, 'Nao deve estar inicializado');
  });

  it('deve inicializar com worker pool', async function() {
    this.timeout = TEST_CONFIG.timeout;

    const service = new TesseractOCRService(2);
    await service.initialize({ language: 'por', verbose: false });

    assert.ok(service.isInitialized, 'Service nao foi inicializado');
    assert.strictEqual(service.workers.length, 2, 'Numero de workers incorreto');
    assert.ok(service.scheduler, 'Scheduler nao foi criado');

    await service.terminate();
    assert.strictEqual(service.isInitialized, false, 'Service deveria estar encerrado');
  });

  it('deve usar singleton com getTesseractOCRService', () => {
    const service1 = getTesseractOCRService(4);
    const service2 = getTesseractOCRService(4);

    assert.strictEqual(service1, service2, 'Deveria retornar a mesma instancia');
  });
});

// ===========================================================================
// TESTES DE PRE-PROCESSAMENTO DE IMAGEM
// ===========================================================================

describe('TesseractOCRService - Preprocessamento', async () => {
  let service;
  let testImagePath;

  before(async () => {
    await loadModules();
    service = new TesseractOCRService(2);

    // Criar imagem de teste
    testImagePath = path.join(TEST_CONFIG.testImagesDir, 'test-preprocess.png');
    await createTestImage('Teste de preprocessamento', testImagePath);
  });

  after(async () => {
    if (service && service.isInitialized) {
      await service.terminate();
    }

    // Limpar arquivos de teste
    try {
      await fs.unlink(testImagePath);
    } catch (e) {}
  });

  it('deve preprocessar imagem a partir de buffer', async function() {
    this.timeout = TEST_CONFIG.timeout;

    const imageBuffer = await fs.readFile(testImagePath);
    const processedBuffer = await service.preprocessImage(imageBuffer);

    assert.ok(Buffer.isBuffer(processedBuffer), 'Resultado deve ser um Buffer');
    assert.ok(processedBuffer.length > 0, 'Buffer nao deve estar vazio');
  });

  it('deve aplicar opcoes de preprocessamento', async function() {
    this.timeout = TEST_CONFIG.timeout;

    const imageBuffer = await fs.readFile(testImagePath);

    const processed = await service.preprocessImage(imageBuffer, {
      width: 1000,
      height: 1500,
      grayscale: true,
      normalize: true,
      sharpen: true
    });

    assert.ok(Buffer.isBuffer(processed), 'Resultado deve ser um Buffer');

    // Verificar que a imagem foi processada
    const metadata = await sharp(processed).metadata();
    assert.ok(metadata.width <= 1000, 'Largura deve ser <= 1000');
    assert.ok(metadata.height <= 1500, 'Altura deve ser <= 1500');
  });

  it('deve aplicar threshold se solicitado', async function() {
    this.timeout = TEST_CONFIG.timeout;

    const imageBuffer = await fs.readFile(testImagePath);

    const processed = await service.preprocessImage(imageBuffer, {
      threshold: true
    });

    assert.ok(Buffer.isBuffer(processed), 'Resultado deve ser um Buffer');
  });
});

// ===========================================================================
// TESTES DE OCR EM IMAGEM
// ===========================================================================

describe('TesseractOCRService - OCR em Imagem', async () => {
  let service;
  let testImagePath;

  before(async () => {
    await loadModules();
    service = new TesseractOCRService(2);
    await service.initialize({ language: 'por', verbose: false });

    testImagePath = path.join(TEST_CONFIG.testImagesDir, 'test-ocr.png');
    await createTestImage('Texto para OCR', testImagePath);
  });

  after(async () => {
    if (service) {
      await service.terminate();
    }

    try {
      await fs.unlink(testImagePath);
    } catch (e) {}
  });

  it('deve executar OCR em buffer de imagem', async function() {
    this.timeout = TEST_CONFIG.timeout;

    const imageBuffer = await fs.readFile(testImagePath);
    const result = await service.performOCR(imageBuffer);

    assert.ok(result, 'Resultado nao deve ser nulo');
    assert.ok('success' in result, 'Resultado deve ter propriedade success');
    assert.ok('text' in result, 'Resultado deve ter propriedade text');
    assert.ok('confidence' in result, 'Resultado deve ter propriedade confidence');
    assert.ok('processingTime' in result, 'Resultado deve ter propriedade processingTime');
  });

  it('deve executar OCR em caminho de arquivo', async function() {
    this.timeout = TEST_CONFIG.timeout;

    const result = await service.performOCR(testImagePath);

    assert.ok(result, 'Resultado nao deve ser nulo');
    assert.ok('success' in result, 'Resultado deve ter propriedade success');
  });

  it('deve retornar palavras e linhas', async function() {
    this.timeout = TEST_CONFIG.timeout;

    const imageBuffer = await fs.readFile(testImagePath);
    const result = await service.performOCR(imageBuffer);

    assert.ok(Array.isArray(result.words), 'words deve ser um array');
    assert.ok(Array.isArray(result.lines), 'lines deve ser um array');
    assert.ok(Array.isArray(result.blocks), 'blocks deve ser um array');
  });

  it('deve respeitar threshold de confianca', async function() {
    this.timeout = TEST_CONFIG.timeout;

    const imageBuffer = await fs.readFile(testImagePath);
    const result = await service.performOCR(imageBuffer, {
      confidenceThreshold: 80
    });

    // Todas as palavras retornadas devem ter confianca >= 80
    for (const word of result.words) {
      assert.ok(word.confidence >= 80, `Palavra "${word.text}" tem confianca ${word.confidence} < 80`);
    }
  });
});

// ===========================================================================
// TESTES DE OCR EM BATCH
// ===========================================================================

describe('TesseractOCRService - OCR em Batch', async () => {
  let service;
  let testImages = [];

  before(async () => {
    await loadModules();
    service = new TesseractOCRService(2);
    await service.initialize({ language: 'por', verbose: false });

    // Criar multiplas imagens de teste
    for (let i = 0; i < 3; i++) {
      const imagePath = path.join(TEST_CONFIG.testImagesDir, `test-batch-${i}.png`);
      await createTestImage(`Pagina ${i + 1}`, imagePath);
      testImages.push(imagePath);
    }
  });

  after(async () => {
    if (service) {
      await service.terminate();
    }

    for (const img of testImages) {
      try {
        await fs.unlink(img);
      } catch (e) {}
    }
  });

  it('deve processar multiplas imagens em batch', async function() {
    this.timeout = TEST_CONFIG.timeout;

    const imageBuffers = await Promise.all(
      testImages.map(img => fs.readFile(img))
    );

    const result = await service.performOCRBatch(imageBuffers);

    assert.ok(result, 'Resultado nao deve ser nulo');
    assert.strictEqual(result.totalPages, 3, 'Total de paginas deve ser 3');
    assert.ok(result.processedPages >= 0, 'Paginas processadas deve ser >= 0');
    assert.ok(Array.isArray(result.pages), 'pages deve ser um array');
    assert.strictEqual(result.pages.length, 3, 'Deve ter 3 resultados de pagina');
    assert.ok('fullText' in result, 'Deve ter fullText');
    assert.ok('averageConfidence' in result, 'Deve ter averageConfidence');
    assert.ok('processingTime' in result, 'Deve ter processingTime');
  });

  it('deve chamar callback de progresso', async function() {
    this.timeout = TEST_CONFIG.timeout;

    const imageBuffers = await Promise.all(
      testImages.map(img => fs.readFile(img))
    );

    let progressCalls = 0;
    const onProgress = (progress) => {
      progressCalls++;
      assert.ok('current' in progress, 'Progresso deve ter current');
      assert.ok('total' in progress, 'Progresso deve ter total');
      assert.ok('percentage' in progress, 'Progresso deve ter percentage');
    };

    await service.performOCRBatch(imageBuffers, { onProgress });

    assert.strictEqual(progressCalls, 3, 'Deve ter chamado progresso 3 vezes');
  });
});

// ===========================================================================
// TESTES DE PERFORMANCE
// ===========================================================================

describe('TesseractOCRService - Performance', async () => {
  let service;
  let testImagePath;

  before(async () => {
    await loadModules();
    service = new TesseractOCRService(4); // 4 workers para performance
    await service.initialize({ language: 'por', verbose: false });

    testImagePath = path.join(TEST_CONFIG.testImagesDir, 'test-perf.png');

    // Criar imagem maior para teste de performance
    const imageBuffer = await sharp({
      create: {
        width: 2480, // A4 width at 300 DPI
        height: 3508, // A4 height at 300 DPI
        channels: 4,
        background: { r: 255, g: 255, b: 255, alpha: 1 }
      }
    })
    .png()
    .toBuffer();

    await fs.writeFile(testImagePath, imageBuffer);
  });

  after(async () => {
    if (service) {
      await service.terminate();
    }

    try {
      await fs.unlink(testImagePath);
    } catch (e) {}
  });

  it('deve processar imagem A4 em tempo aceitavel (< 5s)', async function() {
    this.timeout = TEST_CONFIG.timeout;

    const startTime = Date.now();
    const imageBuffer = await fs.readFile(testImagePath);
    const result = await service.performOCR(imageBuffer);
    const elapsed = Date.now() - startTime;

    console.log(`  Tempo de processamento: ${elapsed}ms`);

    assert.ok(elapsed < TEST_CONFIG.performanceTargetPerPage,
      `Processamento demorou ${elapsed}ms, esperado < ${TEST_CONFIG.performanceTargetPerPage}ms`);
  });

  it('deve retornar metricas de performance', () => {
    const metrics = service.getMetrics();

    assert.ok('totalProcessed' in metrics, 'Deve ter totalProcessed');
    assert.ok('totalTime' in metrics, 'Deve ter totalTime');
    assert.ok('averageTime' in metrics, 'Deve ter averageTime');
    assert.ok('errors' in metrics, 'Deve ter errors');
    assert.ok('workersAtivos' in metrics, 'Deve ter workersAtivos');
    assert.ok('inicializado' in metrics, 'Deve ter inicializado');

    console.log(`  Metricas: ${JSON.stringify(metrics, null, 2)}`);
  });

  it('deve processar em paralelo com worker pool', async function() {
    this.timeout = TEST_CONFIG.timeout;

    // Criar 4 imagens para processamento paralelo
    const images = [];
    for (let i = 0; i < 4; i++) {
      const imgPath = path.join(TEST_CONFIG.testImagesDir, `test-parallel-${i}.png`);
      await fs.writeFile(imgPath, await fs.readFile(testImagePath));
      images.push(imgPath);
    }

    const startTime = Date.now();
    const buffers = await Promise.all(images.map(img => fs.readFile(img)));
    const result = await service.performOCRBatch(buffers);
    const elapsed = Date.now() - startTime;

    console.log(`  Tempo para 4 imagens: ${elapsed}ms`);
    console.log(`  Tempo medio por imagem: ${elapsed / 4}ms`);

    // Limpar
    for (const img of images) {
      try { await fs.unlink(img); } catch (e) {}
    }

    // Com worker pool, 4 imagens nao devem demorar 4x mais que uma
    // Esperamos algo como 1.5x a 2.5x
    assert.ok(elapsed < TEST_CONFIG.performanceTargetPerPage * 3,
      `Processamento paralelo demorou ${elapsed}ms, esperado < ${TEST_CONFIG.performanceTargetPerPage * 3}ms`);
  });
});

// ===========================================================================
// TESTES DE INTEGRACAO COM OCR-SERVICE
// ===========================================================================

describe('OCR Service - Integracao', async () => {
  let testImagePath;

  before(async () => {
    await loadModules();

    testImagePath = path.join(TEST_CONFIG.testImagesDir, 'test-integration.png');
    await createTestImage('Teste de integracao', testImagePath);
  });

  after(async () => {
    try {
      await fs.unlink(testImagePath);
    } catch (e) {}
  });

  it('performOCROnImage deve funcionar', async function() {
    this.timeout = TEST_CONFIG.timeout;

    const result = await performOCROnImage(testImagePath, 1, {
      confidenceThreshold: 50
    });

    assert.ok(result, 'Resultado nao deve ser nulo');
    assert.ok('success' in result, 'Deve ter success');
    assert.ok('text' in result, 'Deve ter text');
    assert.ok('pageNumber' in result, 'Deve ter pageNumber');
    assert.strictEqual(result.pageNumber, 1, 'pageNumber deve ser 1');
  });

  it('deve aceitar imagem base64', async function() {
    this.timeout = TEST_CONFIG.timeout;

    const imageBuffer = await fs.readFile(testImagePath);
    const base64 = imageBuffer.toString('base64');

    const result = await performOCROnImage(base64, 1, {
      isBase64: true,
      confidenceThreshold: 50
    });

    assert.ok(result, 'Resultado nao deve ser nulo');
  });

  it('deve aceitar buffer de imagem', async function() {
    this.timeout = TEST_CONFIG.timeout;

    const imageBuffer = await fs.readFile(testImagePath);

    const result = await performOCROnImage(imageBuffer, 1, {
      confidenceThreshold: 50
    });

    assert.ok(result, 'Resultado nao deve ser nulo');
  });
});

// ===========================================================================
// TESTES DE TRATAMENTO DE ERRO
// ===========================================================================

describe('TesseractOCRService - Tratamento de Erros', async () => {
  let service;

  before(async () => {
    await loadModules();
    service = new TesseractOCRService(2);
    await service.initialize({ language: 'por', verbose: false });
  });

  after(async () => {
    if (service) {
      await service.terminate();
    }
  });

  it('deve retornar erro para arquivo inexistente', async function() {
    this.timeout = TEST_CONFIG.timeout;

    const result = await service.performOCR('/caminho/inexistente/imagem.png');

    assert.strictEqual(result.success, false, 'success deve ser false');
    assert.ok(result.error, 'Deve ter mensagem de erro');
  });

  it('deve retornar erro para buffer invalido', async function() {
    this.timeout = TEST_CONFIG.timeout;

    const invalidBuffer = Buffer.from('nao e uma imagem');
    const result = await service.performOCR(invalidBuffer);

    assert.strictEqual(result.success, false, 'success deve ser false');
    assert.ok(result.error, 'Deve ter mensagem de erro');
  });

  it('deve incrementar contador de erros nas metricas', () => {
    const metrics = service.getMetrics();
    assert.ok(metrics.errors > 0, 'Contador de erros deve ser > 0');
  });
});

// ===========================================================================
// TESTES DE LIMPEZA DE RECURSOS
// ===========================================================================

describe('TesseractOCRService - Limpeza de Recursos', async () => {
  it('deve encerrar workers corretamente', async function() {
    this.timeout = TEST_CONFIG.timeout;

    await loadModules();
    const service = new TesseractOCRService(2);
    await service.initialize({ language: 'por', verbose: false });

    assert.ok(service.isInitialized, 'Deve estar inicializado');
    assert.strictEqual(service.workers.length, 2, 'Deve ter 2 workers');

    await service.terminate();

    assert.strictEqual(service.isInitialized, false, 'Nao deve estar inicializado');
    assert.strictEqual(service.workers.length, 0, 'Nao deve ter workers');
    assert.strictEqual(service.scheduler, null, 'Scheduler deve ser null');
  });

  it('deve permitir re-inicializacao apos terminate', async function() {
    this.timeout = TEST_CONFIG.timeout;

    await loadModules();
    const service = new TesseractOCRService(2);

    // Primeira inicializacao
    await service.initialize({ language: 'por', verbose: false });
    assert.ok(service.isInitialized);

    // Encerrar
    await service.terminate();
    assert.strictEqual(service.isInitialized, false);

    // Re-inicializar
    await service.initialize({ language: 'por', verbose: false });
    assert.ok(service.isInitialized);
    assert.strictEqual(service.workers.length, 2);

    await service.terminate();
  });
});

// ===========================================================================
// RELATORIO DE TESTES
// ===========================================================================

describe('Relatorio de Testes OCR', async () => {
  it('deve gerar relatorio de testes', async function() {
    const report = {
      timestamp: new Date().toISOString(),
      environment: {
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch
      },
      configuration: TEST_CONFIG,
      status: 'completed'
    };

    const reportPath = path.join(TEST_CONFIG.testOutputDir, 'ocr-test-report.json');

    try {
      await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
      console.log(`\nRelatorio salvo em: ${reportPath}`);
    } catch (e) {
      console.log('Aviso: Nao foi possivel salvar relatorio');
    }

    assert.ok(report, 'Relatorio deve ser criado');
  });
});
