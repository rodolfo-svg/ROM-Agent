/**
 * Python Bridge Service
 * Executa scrapers Python a partir do Node.js
 */

const { spawn } = require('child_process');
const path = require('path');

class PythonScraperBridge {
  constructor() {
    this.pythonPath = path.join(__dirname, '../../python-scrapers');
  }

  /**
   * Executa um scraper Python
   * @param {string} scraperName - Nome do arquivo Python (sem .py)
   * @param {object} args - Argumentos para o scraper
   * @returns {Promise<object>} Resultado do scraper
   */
  async executeScraper(scraperName, args) {
    return new Promise((resolve, reject) => {
      const scriptPath = path.join(this.pythonPath, `${scraperName}.py`);
      const python = spawn('python3', [scriptPath], {
        env: { ...process.env, SCRAPER_ARGS: JSON.stringify(args) }
      });

      let output = '';
      let error = '';

      python.stdout.on('data', (data) => {
        output += data.toString();
      });

      python.stderr.on('data', (data) => {
        error += data.toString();
      });

      python.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(`Scraper ${scraperName} failed: ${error}`));
        } else {
          try {
            const result = JSON.parse(output);
            resolve(result);
          } catch (e) {
            reject(new Error(`Invalid JSON output from ${scraperName}: ${output}`));
          }
        }
      });

      // Timeout de 5 minutos
      setTimeout(() => {
        python.kill();
        reject(new Error(`Scraper ${scraperName} timeout after 5 minutes`));
      }, 5 * 60 * 1000);
    });
  }

  // Wrappers específicos para cada scraper
  async projudiSearch(numeroProcesso, tribunal = 'TJGO') {
    return this.executeScraper('projudi_client', {
      action: 'search',
      numero_processo: numeroProcesso,
      tribunal
    });
  }

  async esajSearch(numeroProcesso, tribunal = 'TJSP') {
    return this.executeScraper('esaj_client', {
      action: 'search',
      numero_processo: numeroProcesso,
      tribunal
    });
  }

  async pjeSearch(numeroProcesso, tribunal) {
    return this.executeScraper('pje_client', {
      action: 'search',
      numero_processo: numeroProcesso,
      tribunal
    });
  }

  async eprocSearch(numeroProcesso, tribunal) {
    return this.executeScraper('eproc_client', {
      action: 'search',
      numero_processo: numeroProcesso,
      tribunal
    });
  }
}

module.exports = new PythonScraperBridge();
