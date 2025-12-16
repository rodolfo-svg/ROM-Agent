#!/usr/bin/env node

/**
 * ROM Case Processor Job
 *
 * Script completo para processamento end-to-end de casos jurídicos
 * Pode ser executado via CLI ou agendado via cron/scheduler
 *
 * Uso:
 *   node src/jobs/case-processor-job.js --caso CASO_001 --docs "/path/doc1.pdf,/path/doc2.pdf"
 *   npm run process-case -- --caso CASO_001 --docs "./casos/CASO_001/*.pdf" --level medium
 *
 * @version 1.0.0
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { glob } from 'glob';

// Serviços
import romCaseProcessorService from '../services/processors/rom-case-processor-service.js';
import documentExtractionService from '../services/document-extraction-service.js';
import extractionService from '../services/extraction-service.js';
import microfichamentoTemplatesService from '../services/microfichamento-templates-service.js';
import jurisprudenceSearchService from '../services/jurisprudence-search-service.js';
import cacheService from '../utils/cache/cache-service.js';
import romProjectService from '../services/rom-project-service.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Configuração padrão do job
 */
const DEFAULT_CONFIG = {
  indexLevel: 'quick',
  generateDocument: false,
  documentType: 'peticao-inicial',
  uploadToKB: false,
  verbose: true,
  outputDir: path.join(process.cwd(), 'data', 'output', 'case-processor')
};

/**
 * Classe principal do Job
 */
class CaseProcessorJob {
  constructor(config = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.startTime = Date.now();
    this.log = [];
  }

  /**
   * Log de mensagens
   */
  logMessage(message, level = 'info') {
    const timestamp = new Date().toISOString();
    const logEntry = { timestamp, level, message };

    this.log.push(logEntry);

    if (this.config.verbose) {
      const prefix = {
        info: '✓',
        warn: '⚠',
        error: '✗',
        success: '✓'
      }[level] || 'ℹ';

      console.log(`${prefix} [${timestamp}] ${message}`);
    }
  }

  /**
   * Inicializar todos os serviços
   */
  async initializeServices() {
    this.logMessage('Inicializando serviços...', 'info');

    try {
      // Inicializar serviços em paralelo
      await Promise.all([
        romCaseProcessorService.init(),
        cacheService.init(),
        microfichamentoTemplatesService.init(),
        jurisprudenceSearchService.init(),
        romProjectService.init()
      ]);

      this.logMessage('Todos os serviços inicializados com sucesso', 'success');
      return true;
    } catch (error) {
      this.logMessage(`Erro ao inicializar serviços: ${error.message}`, 'error');
      throw error;
    }
  }

  /**
   * Validar e preparar documentos
   */
  async prepareDocuments(documentPaths) {
    this.logMessage('Preparando documentos...', 'info');

    const files = [];

    for (const pathPattern of documentPaths) {
      try {
        // Suporte para glob patterns
        if (pathPattern.includes('*')) {
          const matchedFiles = await glob(pathPattern);
          files.push(...matchedFiles);
        } else {
          // Verificar se arquivo existe
          await fs.access(pathPattern);
          files.push(pathPattern);
        }
      } catch (error) {
        this.logMessage(`Arquivo não encontrado: ${pathPattern}`, 'warn');
      }
    }

    if (files.length === 0) {
      throw new Error('Nenhum documento válido encontrado');
    }

    this.logMessage(`${files.length} documento(s) preparado(s)`, 'success');
    return files;
  }

  /**
   * Executar processamento completo
   */
  async run(casoId, documentPaths, options = {}) {
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('    ROM CASE PROCESSOR - PROCESSAMENTO END-TO-END');
    console.log('═══════════════════════════════════════════════════════════\n');

    try {
      // Merge options
      const jobOptions = { ...this.config, ...options };

      // Passo 1: Inicializar serviços
      await this.initializeServices();

      // Passo 2: Preparar documentos
      const files = await this.prepareDocuments(documentPaths);
      this.logMessage(`Processando caso: ${casoId}`, 'info');

      // Passo 3: Configurar serviços de busca
      const searchServices = {
        dataJud: jurisprudenceSearchService.config.datajud.enabled ? jurisprudenceSearchService : null,
        jusBrasil: jurisprudenceSearchService.config.jusbrasil.enabled ? jurisprudenceSearchService : null,
        webSearch: jurisprudenceSearchService.config.websearch.enabled ? jurisprudenceSearchService : null
      };

      // Passo 4: Processar caso completo
      this.logMessage('Iniciando processamento das 5 layers...', 'info');

      const result = await romCaseProcessorService.processCaso(casoId, {
        documentPaths: files,
        extractorService: extractionService,
        searchServices,
        indexLevel: jobOptions.indexLevel,
        generateDocument: jobOptions.generateDocument,
        documentType: jobOptions.documentType
      });

      // Passo 5: Salvar resultados
      if (result.success) {
        await this.saveResults(casoId, result, jobOptions);
      }

      // Passo 6: Gerar relatório
      const report = this.generateReport(casoId, result);

      // Passo 7: Exibir sumário
      this.displaySummary(report);

      return {
        success: true,
        casoId,
        result,
        report,
        log: this.log
      };

    } catch (error) {
      this.logMessage(`Erro fatal no processamento: ${error.message}`, 'error');
      console.error(error);

      return {
        success: false,
        error: error.message,
        stack: error.stack,
        log: this.log
      };
    }
  }

  /**
   * Salvar resultados em disco
   */
  async saveResults(casoId, result, options) {
    try {
      const outputDir = path.join(options.outputDir, casoId);
      await fs.mkdir(outputDir, { recursive: true });

      // Salvar resultado completo (JSON)
      const resultPath = path.join(outputDir, 'resultado-completo.json');
      await fs.writeFile(
        resultPath,
        JSON.stringify(result, null, 2),
        'utf-8'
      );
      this.logMessage(`Resultado salvo: ${resultPath}`, 'success');

      // Salvar índice progressivo
      if (result.results.progressiveIndex) {
        const indexPath = path.join(outputDir, `indice-${result.results.progressiveIndex.level}.json`);
        await fs.writeFile(
          indexPath,
          JSON.stringify(result.results.progressiveIndex, null, 2),
          'utf-8'
        );
        this.logMessage(`Índice salvo: ${indexPath}`, 'success');
      }

      // Salvar análises (Layer 3)
      if (result.results.analysis) {
        const analysisPath = path.join(outputDir, 'analises.json');
        await fs.writeFile(
          analysisPath,
          JSON.stringify(result.results.analysis, null, 2),
          'utf-8'
        );
        this.logMessage(`Análises salvas: ${analysisPath}`, 'success');
      }

      // Salvar jurisprudência (Layer 4)
      if (result.results.jurisprudence) {
        const jurisPath = path.join(outputDir, 'jurisprudencia.json');
        await fs.writeFile(
          jurisPath,
          JSON.stringify(result.results.jurisprudence, null, 2),
          'utf-8'
        );
        this.logMessage(`Jurisprudência salva: ${jurisPath}`, 'success');
      }

      // Salvar documento gerado (Layer 5)
      if (result.results.document) {
        const docPath = path.join(outputDir, 'documento-gerado.json');
        await fs.writeFile(
          docPath,
          JSON.stringify(result.results.document, null, 2),
          'utf-8'
        );
        this.logMessage(`Documento salvo: ${docPath}`, 'success');
      }

      return true;
    } catch (error) {
      this.logMessage(`Erro ao salvar resultados: ${error.message}`, 'error');
      return false;
    }
  }

  /**
   * Gerar relatório de processamento
   */
  generateReport(casoId, result) {
    const endTime = Date.now();
    const duration = ((endTime - this.startTime) / 1000 / 60).toFixed(2);

    return {
      casoId,
      processedAt: new Date().toISOString(),
      duration: `${duration} minutos`,
      success: result.success,
      layers: {
        layer1: result.results?.extraction ? '✓ Completo' : '✗ Falhou',
        layer2: result.results?.indexes ? '✓ Completo' : '✗ Falhou',
        layer3: result.results?.analysis ? '✓ Completo' : '✗ Falhou',
        layer4: result.results?.jurisprudence ? '✓ Completo' : '✗ Não executado',
        layer5: result.results?.document ? '✓ Completo' : '✗ Não executado'
      },
      stats: {
        totalDocuments: result.results?.extraction?.length || 0,
        indexLevel: result.results?.progressiveIndex?.level || 'unknown',
        microfichamentos: result.results?.analysis?.microfichamentos?.length || 0,
        tesesIdentificadas: result.results?.analysis?.consolidacoes?.teses?.length || 0,
        precedentesEncontrados: result.results?.jurisprudence?.totalPrecedentes || 0,
        cacheHitRate: result.cacheHitRate || '0%'
      },
      log: this.log
    };
  }

  /**
   * Exibir sumário no console
   */
  displaySummary(report) {
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('                   RELATÓRIO FINAL');
    console.log('═══════════════════════════════════════════════════════════\n');

    console.log(`Caso ID: ${report.casoId}`);
    console.log(`Status: ${report.success ? '✓ SUCESSO' : '✗ FALHOU'}`);
    console.log(`Duração: ${report.duration}`);
    console.log('');

    console.log('Camadas Processadas:');
    for (const [layer, status] of Object.entries(report.layers)) {
      console.log(`  ${layer.toUpperCase()}: ${status}`);
    }
    console.log('');

    console.log('Estatísticas:');
    console.log(`  Documentos: ${report.stats.totalDocuments}`);
    console.log(`  Índice: ${report.stats.indexLevel}`);
    console.log(`  Microfichamentos: ${report.stats.microfichamentos}`);
    console.log(`  Teses Identificadas: ${report.stats.tesesIdentificadas}`);
    console.log(`  Precedentes: ${report.stats.precedentesEncontrados}`);
    console.log(`  Cache Hit Rate: ${report.stats.cacheHitRate}`);
    console.log('');

    console.log('═══════════════════════════════════════════════════════════\n');
  }
}

/**
 * Parsear argumentos da linha de comando
 */
function parseArgs() {
  const args = process.argv.slice(2);
  const config = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--caso' || arg === '-c') {
      config.casoId = args[++i];
    } else if (arg === '--docs' || arg === '-d') {
      config.documentPaths = args[++i].split(',').map(p => p.trim());
    } else if (arg === '--level' || arg === '-l') {
      config.indexLevel = args[++i];
    } else if (arg === '--generate-doc' || arg === '-g') {
      config.generateDocument = true;
    } else if (arg === '--doc-type' || arg === '-t') {
      config.documentType = args[++i];
    } else if (arg === '--output' || arg === '-o') {
      config.outputDir = args[++i];
    } else if (arg === '--quiet' || arg === '-q') {
      config.verbose = false;
    } else if (arg === '--help' || arg === '-h') {
      displayHelp();
      process.exit(0);
    }
  }

  return config;
}

/**
 * Exibir ajuda
 */
function displayHelp() {
  console.log(`
ROM Case Processor Job - Processamento End-to-End

USO:
  node src/jobs/case-processor-job.js [opções]

OPÇÕES:
  --caso, -c <id>          ID do caso (obrigatório)
  --docs, -d <paths>       Caminhos dos documentos separados por vírgula (obrigatório)
  --level, -l <level>      Nível do índice: quick|medium|full (padrão: quick)
  --generate-doc, -g       Gerar documento final (Layer 5)
  --doc-type, -t <type>    Tipo de documento: peticao-inicial|contestacao|recurso
  --output, -o <dir>       Diretório de saída (padrão: data/output/case-processor)
  --quiet, -q              Modo silencioso (sem logs verbose)
  --help, -h               Exibir esta ajuda

EXEMPLOS:
  # Processamento básico
  node src/jobs/case-processor-job.js \\
    --caso CASO_001 \\
    --docs "/casos/CASO_001/doc1.pdf,/casos/CASO_001/doc2.pdf"

  # Com glob pattern
  node src/jobs/case-processor-job.js \\
    --caso CASO_002 \\
    --docs "/casos/CASO_002/*.pdf" \\
    --level medium

  # Gerar documento final
  node src/jobs/case-processor-job.js \\
    --caso CASO_003 \\
    --docs "/casos/CASO_003/*.pdf" \\
    --level full \\
    --generate-doc \\
    --doc-type peticao-inicial

MAIS INFORMAÇÕES:
  Documentação: docs/CASE-PROCESSOR-ARCHITECTURE.md
  Site: https://iarom.com.br
`);
}

/**
 * Executar job via CLI
 */
async function main() {
  const config = parseArgs();

  // Validações
  if (!config.casoId) {
    console.error('❌ Erro: --caso é obrigatório');
    displayHelp();
    process.exit(1);
  }

  if (!config.documentPaths || config.documentPaths.length === 0) {
    console.error('❌ Erro: --docs é obrigatório');
    displayHelp();
    process.exit(1);
  }

  // Criar e executar job
  const job = new CaseProcessorJob(config);

  try {
    const result = await job.run(config.casoId, config.documentPaths, config);

    // Exit code baseado no resultado
    process.exit(result.success ? 0 : 1);
  } catch (error) {
    console.error('❌ Erro fatal:', error);
    process.exit(1);
  }
}

// Executar se chamado diretamente
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}

// Exportar para uso programático
export default CaseProcessorJob;
export { CaseProcessorJob, parseArgs };
