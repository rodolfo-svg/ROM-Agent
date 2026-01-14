/**
 * EXTRACTION SERVICE - Serviço de Extração de Processos Judiciais
 * Integra scrapers Python com banco de dados e API REST
 *
 * Suporta:
 * - PROJUDI (TJGO)
 * - ESAJ (TJSP - 1ª e 2ª instância)
 * - PJe (TRF1-5 - Justiça Federal)
 *
 * @version 1.0.0
 */

import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import logger from '../../lib/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class ExtractionService {
  constructor() {
    this.pythonPath = path.join(__dirname, '../../python-scrapers');
    this.dataPath = path.join(__dirname, '../../data/processos-extraidos');

    // Criar diretório de dados se não existir
    if (!fs.existsSync(this.dataPath)) {
      fs.mkdirSync(this.dataPath, { recursive: true });
      logger.info('📁 Diretório de processos extraídos criado', { path: this.dataPath });
    }
  }

  /**
   * Detecta tribunal a partir do número do processo
   */
  detectarTribunal(numeroProcesso) {
    // Formato CNJ: NNNNNNN-DD.AAAA.J.TR.OOOO
    // J = Segmento (4=JF, 8=Estadual)
    // TR = Tribunal

    const match = numeroProcesso.match(/d{7}-d{2}.d{4}.(d).(d{2}).d{4}/);

    if (!match) {
      throw new Error('Número de processo inválido (formato CNJ esperado)');
    }

    const segmento = match[1];
    const codigoTribunal = match[2];

    // Justiça Federal (segmento 4)
    if (segmento === '4') {
      if (codigoTribunal === '01') return { sistema: 'pje', tribunal: 'TRF1', nome: 'TRF1 - Justiça Federal' };
      if (codigoTribunal === '02') return { sistema: 'pje', tribunal: 'TRF2', nome: 'TRF2 - Justiça Federal' };
      if (codigoTribunal === '03') return { sistema: 'pje', tribunal: 'TRF3', nome: 'TRF3 - Justiça Federal' };
      if (codigoTribunal === '04') return { sistema: 'pje', tribunal: 'TRF4', nome: 'TRF4 - Justiça Federal' };
      if (codigoTribunal === '05') return { sistema: 'pje', tribunal: 'TRF5', nome: 'TRF5 - Justiça Federal' };
    }

    // Justiça Estadual (segmento 8)
    if (segmento === '8') {
      if (codigoTribunal === '09') return { sistema: 'projudi', tribunal: 'TJGO', nome: 'TJGO - Tribunal de Justiça de Goiás' };
      if (codigoTribunal === '26') return { sistema: 'esaj', tribunal: 'TJSP', nome: 'TJSP - Tribunal de Justiça de São Paulo' };
    }

    throw new Error(`Tribunal não suportado: segmento=${segmento}, código=${codigoTribunal}`);
  }

  /**
   * Executa scraper Python diretamente (importando módulo)
   */
  async executarScraper(scraperName, numeroProcesso, options = {}) {
    return new Promise((resolve, reject) => {
      // Script Python que importa e executa o scraper
      const pythonScript = `
import sys
import json
sys.path.insert(0, '${this.pythonPath}')

try:
    # Importar scraper
    import ${scraperName}
    
    # Criar instância
    if '${scraperName}' == 'projudi_scraper':
        scraper = ${scraperName}.ProjudiScraper()
    elif '${scraperName}' == 'esaj_scraper':
        scraper = ${scraperName}.ESAJScraper()
    elif '${scraperName}' == 'pje_scraper':
        scraper = ${scraperName}.PJeScraper()
    else:
        raise Exception('Scraper desconhecido')
    
    # Extrair processo
    resultado = scraper.extrair_processo_completo('${numeroProcesso}')
    
    # Converter dataclass para dict
    if hasattr(resultado, '__dict__'):
        dados = resultado.__dict__
    else:
        dados = resultado
    
    # Converter para JSON
    print(json.dumps(dados, default=str, ensure_ascii=False))
    
except Exception as e:
    import traceback
    print(json.dumps({
        'error': str(e),
        'traceback': traceback.format_exc()
    }), file=sys.stderr)
    sys.exit(1)
`;

      logger.info('🐍 Executando scraper Python', {
        scraper: scraperName,
        numeroProcesso
      });

      const python = spawn('python3', ['-c', pythonScript], {
        env: { ...process.env }
      });

      let stdout = '';
      let stderr = '';

      python.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      python.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      python.on('error', (error) => {
        logger.error('Erro ao executar Python', { error: error.message });
        reject(new Error(`Erro ao executar scraper: ${error.message}`));
      });

      python.on('close', (code) => {
        if (code !== 0) {
          logger.error('Scraper falhou', { code, stderr: stderr.substring(0, 500) });
          reject(new Error(`Scraper falhou: ${stderr}`));
          return;
        }

        try {
          const result = JSON.parse(stdout);
          
          if (result.error) {
            reject(new Error(`Erro no scraper: ${result.error}`));
            return;
          }
          
          logger.info('✅ Scraper executado com sucesso', {
            numeroProcesso,
            hasData: !!result.numero
          });
          resolve(result);
        } catch (error) {
          logger.error('Erro ao parsear JSON', {
            error: error.message,
            stdout: stdout.substring(0, 500)
          });
          reject(new Error(`Resposta inválida do scraper: ${error.message}`));
        }
      });

      // Timeout de 5 minutos
      setTimeout(() => {
        python.kill('SIGTERM');
        reject(new Error('Timeout: scraper demorou mais de 5 minutos'));
      }, 5 * 60 * 1000);
    });
  }

  /**
   * Extrai processo judicial completo
   */
  async extrairProcesso(numeroProcesso, options = {}) {
    try {
      // Normalizar número do processo
      const numeroNormalizado = numeroProcesso.replace(/[^d-]/g, '');

      logger.info('📄 Iniciando extração de processo', {
        numero: numeroNormalizado,
        options
      });

      // Detectar tribunal
      const { sistema, tribunal, nome } = this.detectarTribunal(numeroNormalizado);

      logger.info('🏛️ Tribunal detectado', {
        sistema,
        tribunal,
        nome
      });

      // Selecionar scraper apropriado
      let scraperName;
      switch (sistema) {
        case 'projudi':
          scraperName = 'projudi_scraper';
          break;
        case 'esaj':
          scraperName = 'esaj_scraper';
          break;
        case 'pje':
          scraperName = 'pje_scraper';
          break;
        default:
          throw new Error(`Sistema ${sistema} não implementado`);
      }

      // Executar scraper
      const startTime = Date.now();
      const dados = await this.executarScraper(scraperName, numeroNormalizado, options);
      const duracao = Date.now() - startTime;

      // Adicionar metadados
      const resultado = {
        ...dados,
        _metadata: {
          tribunal,
          sistema,
          nomeTribunal: nome,
          numeroProcesso: numeroNormalizado,
          dataExtracao: new Date().toISOString(),
          duracaoMs: duracao,
          versao: '1.0.0'
        }
      };

      // Salvar em arquivo
      await this.salvarProcesso(numeroNormalizado, resultado);

      logger.info('✅ Processo extraído com sucesso', {
        numero: numeroNormalizado,
        tribunal,
        duracao: `${duracao}ms`
      });

      return resultado;

    } catch (error) {
      logger.error('❌ Erro na extração', {
        erro: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * Salva processo extraído em arquivo JSON
   */
  async salvarProcesso(numeroProcesso, dados) {
    try {
      const filename = `${numeroProcesso.replace(/[^d]/g, '')}.json`;
      const filepath = path.join(this.dataPath, filename);

      await fs.promises.writeFile(
        filepath,
        JSON.stringify(dados, null, 2),
        'utf8'
      );

      logger.info('💾 Processo salvo', { filepath });

      return filepath;
    } catch (error) {
      logger.error('Erro ao salvar processo', { error: error.message });
      throw error;
    }
  }

  /**
   * Lista processos extraídos
   */
  async listarProcessos() {
    try {
      const files = await fs.promises.readdir(this.dataPath);
      const processos = [];

      for (const file of files) {
        if (file.endsWith('.json')) {
          const filepath = path.join(this.dataPath, file);
          const stat = await fs.promises.stat(filepath);
          const content = await fs.promises.readFile(filepath, 'utf8');
          const data = JSON.parse(content);

          processos.push({
            numeroProcesso: data._metadata?.numeroProcesso || file.replace('.json', ''),
            tribunal: data._metadata?.tribunal || 'Desconhecido',
            dataExtracao: data._metadata?.dataExtracao || stat.mtime,
            tamanho: stat.size,
            arquivo: file
          });
        }
      }

      // Ordenar por data (mais recente primeiro)
      processos.sort((a, b) => new Date(b.dataExtracao) - new Date(a.dataExtracao));

      return processos;
    } catch (error) {
      logger.error('Erro ao listar processos', { error: error.message });
      return [];
    }
  }

  /**
   * Busca processo extraído por número
   */
  async buscarProcesso(numeroProcesso) {
    try {
      const numeroLimpo = numeroProcesso.replace(/[^d]/g, '');
      const filename = `${numeroLimpo}.json`;
      const filepath = path.join(this.dataPath, filename);

      if (!fs.existsSync(filepath)) {
        return null;
      }

      const content = await fs.promises.readFile(filepath, 'utf8');
      return JSON.parse(content);
    } catch (error) {
      logger.error('Erro ao buscar processo', { error: error.message });
      return null;
    }
  }

  /**
   * Health check dos scrapers
   */
  async healthCheck() {
    const results = {};

    // Testar cada scraper
    const scrapers = [
      { name: 'PROJUDI', module: 'projudi_scraper' },
      { name: 'ESAJ', module: 'esaj_scraper' },
      { name: 'PJe', module: 'pje_scraper' }
    ];

    for (const scraper of scrapers) {
      try {
        const scriptPath = path.join(this.pythonPath, `${scraper.module}.py`);

        // Verificar se arquivo existe
        if (!fs.existsSync(scriptPath)) {
          results[scraper.name] = {
            status: 'error',
            message: 'Arquivo não encontrado'
          };
          continue;
        }

        // Tentar importar e testar health_check
        const pythonScript = `
import sys
import json
sys.path.insert(0, '${this.pythonPath}')

try:
    import ${scraper.module}
    
    if '${scraper.module}' == 'projudi_scraper':
        s = ${scraper.module}.ProjudiScraper()
    elif '${scraper.module}' == 'esaj_scraper':
        s = ${scraper.module}.ESAJScraper()
    elif '${scraper.module}' == 'pje_scraper':
        s = ${scraper.module}.PJeScraper()
    
    result = s.health_check()
    print(json.dumps(result, default=str))
except Exception as e:
    print(json.dumps({'status': 'error', 'message': str(e)}))
`;

        const python = spawn('python3', ['-c', pythonScript]);

        const result = await new Promise((resolve) => {
          let output = '';
          python.stdout.on('data', (data) => output += data);
          python.on('close', () => {
            try {
              resolve(JSON.parse(output));
            } catch {
              resolve({ status: 'error', message: 'Resposta inválida' });
            }
          });

          // Timeout de 10 segundos
          setTimeout(() => {
            python.kill();
            resolve({ status: 'error', message: 'Timeout' });
          }, 10000);
        });

        results[scraper.name] = result;

      } catch (error) {
        results[scraper.name] = {
          status: 'error',
          message: error.message
        };
      }
    }

    return results;
  }
}

// Singleton
export default new ExtractionService();
