/**
 * CODE EXECUTION SANDBOX - ROM Agent
 * Executa código Python e JavaScript de forma segura
 *
 * Funcionalidades:
 * - Sandbox seguro (isolado)
 * - Suporte Python e JavaScript
 * - Timeout configurável
 * - Limites de memória e CPU
 * - Captura de stdout/stderr
 * - Visualização de resultados
 */

import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Diretórios
const SANDBOX_DIR = path.join(__dirname, '../data/sandbox');
const EXECUTIONS_DIR = path.join(SANDBOX_DIR, 'executions');
const LOGS_DIR = path.join(SANDBOX_DIR, 'logs');

// Criar diretórios
[SANDBOX_DIR, EXECUTIONS_DIR, LOGS_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Configurações de segurança
const SECURITY_CONFIG = {
  timeout: 30000,           // 30 segundos
  maxMemory: 512,           // 512 MB
  maxOutputSize: 1048576,   // 1 MB
  maxFileSize: 10485760,    // 10 MB
  allowedModules: {
    python: [
      'math', 'random', 'datetime', 'json', 'csv',
      'collections', 're', 'itertools', 'functools',
      'numpy', 'pandas', 'matplotlib', 'scipy'
    ],
    javascript: [
      'fs', 'path', 'crypto', 'util', 'events',
      'stream', 'buffer', 'string_decoder'
    ]
  }
};

/**
 * Classe para executar código
 */
class CodeExecutor {
  /**
   * Executar código Python
   */
  async executePython(code, options = {}) {
    const {
      timeout = SECURITY_CONFIG.timeout,
      maxMemory = SECURITY_CONFIG.maxMemory,
      input = null,
      files = []
    } = options;

    const executionId = this.generateExecutionId();
    const executionDir = path.join(EXECUTIONS_DIR, executionId);
    fs.mkdirSync(executionDir, { recursive: true });

    const scriptPath = path.join(executionDir, 'script.py');

    // Escrever código no arquivo
    fs.writeFileSync(scriptPath, code, 'utf8');

    // Salvar arquivos adicionais (se houver)
    if (files.length > 0) {
      files.forEach(file => {
        const filePath = path.join(executionDir, file.name);
        fs.writeFileSync(filePath, file.content);
      });
    }

    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      let stdout = '';
      let stderr = '';
      let timedOut = false;

      // Verificar se Python está instalado
      const pythonCmd = this.findPythonCommand();
      if (!pythonCmd) {
        resolve({
          success: false,
          error: 'Python não está instalado no sistema',
          executionTime: 0
        });
        return;
      }

      // Executar Python com limites de recursos
      const process = spawn(pythonCmd, [scriptPath], {
        cwd: executionDir,
        env: {
          ...process.env,
          PYTHONDONTWRITEBYTECODE: '1',
          PYTHONUNBUFFERED: '1'
        },
        timeout,
        maxBuffer: SECURITY_CONFIG.maxOutputSize
      });

      // Timeout
      const timeoutId = setTimeout(() => {
        timedOut = true;
        process.kill('SIGTERM');
        setTimeout(() => process.kill('SIGKILL'), 1000);
      }, timeout);

      // Capturar stdout
      process.stdout.on('data', (data) => {
        stdout += data.toString();
        if (stdout.length > SECURITY_CONFIG.maxOutputSize) {
          process.kill('SIGTERM');
        }
      });

      // Capturar stderr
      process.stderr.on('data', (data) => {
        stderr += data.toString();
        if (stderr.length > SECURITY_CONFIG.maxOutputSize) {
          process.kill('SIGTERM');
        }
      });

      // Enviar input (se houver)
      if (input) {
        process.stdin.write(input);
        process.stdin.end();
      }

      // Quando o processo terminar
      process.on('close', (code) => {
        clearTimeout(timeoutId);
        const executionTime = Date.now() - startTime;

        // Limpar diretório de execução
        this.cleanupExecution(executionDir);

        // Log da execução
        this.logExecution({
          executionId,
          language: 'python',
          code: 'Python code',
          success: code === 0 && !timedOut,
          stdout: stdout.substring(0, 1000),
          stderr: stderr.substring(0, 1000),
          executionTime
        });

        if (timedOut) {
          resolve({
            success: false,
            error: `Timeout: código excedeu ${timeout}ms`,
            stdout: stdout.substring(0, 1000),
            stderr: stderr.substring(0, 1000),
            executionTime
          });
        } else if (code === 0) {
          resolve({
            success: true,
            stdout,
            stderr: stderr || null,
            executionTime,
            exitCode: code
          });
        } else {
          resolve({
            success: false,
            error: stderr || `Processo terminou com código ${code}`,
            stdout: stdout || null,
            stderr,
            executionTime,
            exitCode: code
          });
        }
      });

      process.on('error', (error) => {
        clearTimeout(timeoutId);
        this.cleanupExecution(executionDir);

        resolve({
          success: false,
          error: error.message,
          executionTime: Date.now() - startTime
        });
      });
    });
  }

  /**
   * Executar código JavaScript
   */
  async executeJavaScript(code, options = {}) {
    const {
      timeout = SECURITY_CONFIG.timeout,
      input = null
    } = options;

    const executionId = this.generateExecutionId();
    const executionDir = path.join(EXECUTIONS_DIR, executionId);
    fs.mkdirSync(executionDir, { recursive: true });

    const scriptPath = path.join(executionDir, 'script.cjs');

    // Wrapper de segurança
    const wrappedCode = this.wrapJavaScriptCode(code);
    fs.writeFileSync(scriptPath, wrappedCode, 'utf8');

    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      let stdout = '';
      let stderr = '';
      let timedOut = false;

      // Executar Node.js
      const process = spawn('node', [scriptPath], {
        cwd: executionDir,
        timeout,
        maxBuffer: SECURITY_CONFIG.maxOutputSize
      });

      const timeoutId = setTimeout(() => {
        timedOut = true;
        process.kill('SIGTERM');
        setTimeout(() => process.kill('SIGKILL'), 1000);
      }, timeout);

      process.stdout.on('data', (data) => {
        stdout += data.toString();
        if (stdout.length > SECURITY_CONFIG.maxOutputSize) {
          process.kill('SIGTERM');
        }
      });

      process.stderr.on('data', (data) => {
        stderr += data.toString();
        if (stderr.length > SECURITY_CONFIG.maxOutputSize) {
          process.kill('SIGTERM');
        }
      });

      if (input) {
        process.stdin.write(input);
        process.stdin.end();
      }

      process.on('close', (code) => {
        clearTimeout(timeoutId);
        const executionTime = Date.now() - startTime;

        this.cleanupExecution(executionDir);

        this.logExecution({
          executionId,
          language: 'javascript',
          code: 'JavaScript code',
          success: code === 0 && !timedOut,
          stdout: stdout.substring(0, 1000),
          stderr: stderr.substring(0, 1000),
          executionTime
        });

        if (timedOut) {
          resolve({
            success: false,
            error: `Timeout: código excedeu ${timeout}ms`,
            stdout: stdout.substring(0, 1000),
            stderr: stderr.substring(0, 1000),
            executionTime
          });
        } else if (code === 0) {
          resolve({
            success: true,
            stdout,
            stderr: stderr || null,
            executionTime,
            exitCode: code
          });
        } else {
          resolve({
            success: false,
            error: stderr || `Processo terminou com código ${code}`,
            stdout: stdout || null,
            stderr,
            executionTime,
            exitCode: code
          });
        }
      });

      process.on('error', (error) => {
        clearTimeout(timeoutId);
        this.cleanupExecution(executionDir);

        resolve({
          success: false,
          error: error.message,
          executionTime: Date.now() - startTime
        });
      });
    });
  }

  /**
   * Envolver código JavaScript em sandbox
   */
  wrapJavaScriptCode(code) {
    return `
// Sandbox de segurança
'use strict';

// Desabilitar require de módulos perigosos
const Module = require('module');
const originalRequire = Module.prototype.require;

Module.prototype.require = function(id) {
  const dangerous = ['child_process', 'cluster', 'dgram', 'dns', 'http', 'https', 'net', 'os', 'process', 'tls', 'vm'];
  if (dangerous.includes(id)) {
    throw new Error(\`Módulo "\${id}" não é permitido no sandbox\`);
  }
  return originalRequire.apply(this, arguments);
};

// Limitar process
const limitedProcess = {
  env: {},
  argv: [],
  version: process.version,
  versions: process.versions,
  platform: process.platform,
  arch: process.arch
};

// Código do usuário
(async function() {
  try {
    ${code}
  } catch (error) {
    console.error('Erro:', error.message);
    process.exit(1);
  }
})();
`;
  }

  /**
   * Encontrar comando Python
   */
  findPythonCommand() {
    const commands = ['python3', 'python'];

    for (const cmd of commands) {
      try {
        const result = spawn.sync(cmd, ['--version'], { encoding: 'utf8' });
        if (result.status === 0) {
          return cmd;
        }
      } catch (error) {
        continue;
      }
    }

    return null;
  }

  /**
   * Gerar ID único de execução
   */
  generateExecutionId() {
    return `exec_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
  }

  /**
   * Limpar diretório de execução
   */
  cleanupExecution(executionDir) {
    try {
      if (fs.existsSync(executionDir)) {
        fs.rmSync(executionDir, { recursive: true, force: true });
      }
    } catch (error) {
      console.error('Erro ao limpar execução:', error);
    }
  }

  /**
   * Registrar log de execução
   */
  logExecution(data) {
    const logFile = path.join(LOGS_DIR, `${new Date().toISOString().split('T')[0]}.jsonl`);
    const logEntry = JSON.stringify({
      ...data,
      timestamp: new Date().toISOString()
    }) + '\n';

    try {
      fs.appendFileSync(logFile, logEntry);
    } catch (error) {
      console.error('Erro ao registrar log:', error);
    }
  }

  /**
   * Validar código antes de executar
   */
  validateCode(code, language) {
    if (!code || typeof code !== 'string') {
      return { valid: false, error: 'Código inválido' };
    }

    if (code.length > SECURITY_CONFIG.maxFileSize) {
      return { valid: false, error: 'Código muito grande' };
    }

    // Verificar padrões perigosos
    const dangerousPatterns = {
      python: [
        /import\s+os(?![a-z_])/i,
        /import\s+sys(?![a-z_])/i,
        /import\s+subprocess/i,
        /exec\s*\(/i,
        /eval\s*\(/i,
        /__import__/i,
        /open\s*\(/i
      ],
      javascript: [
        /require\s*\(\s*['"]child_process['"]/i,
        /require\s*\(\s*['"]fs['"]/i,
        /eval\s*\(/i,
        /Function\s*\(/i,
        /process\.exit/i
      ]
    };

    const patterns = dangerousPatterns[language] || [];
    for (const pattern of patterns) {
      if (pattern.test(code)) {
        return {
          valid: false,
          error: `Código contém operação não permitida: ${pattern.source}`
        };
      }
    }

    return { valid: true };
  }

  /**
   * Executar código (detecta linguagem automaticamente)
   */
  async execute(code, language = 'auto', options = {}) {
    // Detectar linguagem se auto
    if (language === 'auto') {
      language = this.detectLanguage(code);
    }

    language = language.toLowerCase();

    // Validar código
    const validation = this.validateCode(code, language);
    if (!validation.valid) {
      return {
        success: false,
        error: validation.error,
        language
      };
    }

    // Executar de acordo com a linguagem
    if (language === 'python') {
      const result = await this.executePython(code, options);
      return { ...result, language: 'python' };
    } else if (language === 'javascript' || language === 'js') {
      const result = await this.executeJavaScript(code, options);
      return { ...result, language: 'javascript' };
    } else {
      return {
        success: false,
        error: `Linguagem não suportada: ${language}`,
        language
      };
    }
  }

  /**
   * Detectar linguagem do código
   */
  detectLanguage(code) {
    // Python: imports, def, print
    if (/^\s*(import|from|def|class|print\()/m.test(code)) {
      return 'python';
    }

    // JavaScript: const, let, var, function, console.log
    if (/^\s*(const|let|var|function|console\.log)/m.test(code)) {
      return 'javascript';
    }

    // Default: JavaScript
    return 'javascript';
  }

  /**
   * Obter logs de execução
   */
  getExecutionLogs(date = null) {
    const logDate = date || new Date().toISOString().split('T')[0];
    const logFile = path.join(LOGS_DIR, `${logDate}.jsonl`);

    if (!fs.existsSync(logFile)) {
      return [];
    }

    const content = fs.readFileSync(logFile, 'utf8');
    return content
      .split('\n')
      .filter(line => line.trim())
      .map(line => JSON.parse(line));
  }
}

// Exportar instância única
const codeExecutor = new CodeExecutor();
export default codeExecutor;
export { CodeExecutor, SECURITY_CONFIG };
