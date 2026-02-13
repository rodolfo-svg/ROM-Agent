/**
 * ROM Agent - Logger com Winston
 * Sistema de logs estruturados com arquivos rotativos
 * Logs coloridos para desenvolvimento
 */

import winston from 'winston';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { sanitizeString, sanitizeObject } from '../src/utils/log-sanitizer.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Garantir que o diretório de logs existe
const logsDir = path.join(__dirname, '../logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

/**
 * Formato de sanitização (APLICADO PRIMEIRO para proteger dados sensíveis)
 */
const sanitizeFormat = winston.format((info) => {
  // Sanitizar mensagem
  if (typeof info.message === 'string') {
    info.message = sanitizeString(info.message);
  }

  // Sanitizar metadata/objetos
  if (info.metadata && typeof info.metadata === 'object') {
    info.metadata = sanitizeObject(info.metadata);
  }

  // Sanitizar propriedades extras
  const sensitiveKeys = Object.keys(info).filter(key =>
    !['level', 'message', 'timestamp', 'metadata'].includes(key)
  );

  for (const key of sensitiveKeys) {
    if (typeof info[key] === 'string') {
      info[key] = sanitizeString(info[key]);
    } else if (typeof info[key] === 'object') {
      info[key] = sanitizeObject(info[key]);
    }
  }

  return info;
})();

/**
 * Formato customizado para logs
 */
const customFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  sanitizeFormat,  // SANITIZAR ANTES DE SERIALIZAR!
  winston.format.metadata(),
  winston.format.json()
);

/**
 * Formato colorido para console (dev)
 */
const consoleFormat = winston.format.combine(
  winston.format.colorize({ all: true }),
  winston.format.timestamp({ format: 'HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    let metaStr = '';
    if (Object.keys(meta).length > 0 && meta.metadata && Object.keys(meta.metadata).length > 0) {
      metaStr = '\n' + JSON.stringify(meta.metadata, null, 2);
    }
    return `[${timestamp}] ${level}: ${message}${metaStr}`;
  })
);

/**
 * Configuração de transports (destinos dos logs)
 */
const transports = [
  // Console (colorido, para desenvolvimento)
  new winston.transports.Console({
    level: process.env.LOG_LEVEL || 'info',
    format: consoleFormat
  }),

  // Arquivo de erros (apenas erros)
  new winston.transports.File({
    filename: path.join(logsDir, 'error.log'),
    level: 'error',
    format: customFormat,
    maxsize: 5242880, // 5MB
    maxFiles: 5
  }),

  // Arquivo de logs gerais (info e acima)
  new winston.transports.File({
    filename: path.join(logsDir, 'combined.log'),
    level: 'info',
    format: customFormat,
    maxsize: 10485760, // 10MB
    maxFiles: 7
  }),

  // Arquivo de logs de aplicação
  new winston.transports.File({
    filename: path.join(logsDir, 'app.log'),
    level: 'debug',
    format: customFormat,
    maxsize: 10485760, // 10MB
    maxFiles: 3
  })
];

/**
 * Criar logger principal
 */
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: customFormat,
  transports,
  exceptionHandlers: [
    new winston.transports.File({
      filename: path.join(logsDir, 'exceptions.log'),
      maxsize: 5242880,
      maxFiles: 5
    })
  ],
  rejectionHandlers: [
    new winston.transports.File({
      filename: path.join(logsDir, 'rejections.log'),
      maxsize: 5242880,
      maxFiles: 5
    })
  ]
});

/**
 * Logger específico para requisições HTTP
 */
export const httpLogger = winston.createLogger({
  level: 'info',
  format: customFormat,
  transports: [
    new winston.transports.File({
      filename: path.join(logsDir, 'http.log'),
      format: customFormat,
      maxsize: 10485760, // 10MB
      maxFiles: 7
    })
  ]
});

/**
 * Logger específico para operações de AI/Bedrock
 */
export const aiLogger = winston.createLogger({
  level: 'info',
  format: customFormat,
  transports: [
    new winston.transports.File({
      filename: path.join(logsDir, 'ai-operations.log'),
      format: customFormat,
      maxsize: 10485760, // 10MB
      maxFiles: 7
    })
  ]
});

/**
 * Logger específico para uploads e KB
 */
export const kbLogger = winston.createLogger({
  level: 'info',
  format: customFormat,
  transports: [
    new winston.transports.File({
      filename: path.join(logsDir, 'kb-operations.log'),
      format: customFormat,
      maxsize: 10485760, // 10MB
      maxFiles: 7
    })
  ]
});

/**
 * Logger específico para autenticação
 */
export const authLogger = winston.createLogger({
  level: 'info',
  format: customFormat,
  transports: [
    new winston.transports.File({
      filename: path.join(logsDir, 'auth.log'),
      format: customFormat,
      maxsize: 5242880, // 5MB
      maxFiles: 10 // Guardar mais logs de autenticação
    })
  ]
});

/**
 * Middleware Express para logging de requisições HTTP
 */
export function requestLogger(req, res, next) {
  const startTime = Date.now();

  // Log no fim da resposta
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    const logData = {
      method: req.method,
      url: req.originalUrl || req.url,
      status: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip || req.connection.remoteAddress,
      userAgent: req.get('user-agent') || 'unknown'
    };

    // Log com nível baseado no status
    if (res.statusCode >= 500) {
      httpLogger.error('HTTP Request Error', logData);
    } else if (res.statusCode >= 400) {
      httpLogger.warn('HTTP Request Warning', logData);
    } else {
      httpLogger.info('HTTP Request', logData);
    }
  });

  next();
}

/**
 * Helper para logar operações de AI
 */
export function logAIOperation(operation, data) {
  aiLogger.info(`AI Operation: ${operation}`, {
    operation,
    ...data,
    timestamp: new Date().toISOString()
  });
}

/**
 * Helper para logar operações de KB
 */
export function logKBOperation(operation, data) {
  kbLogger.info(`KB Operation: ${operation}`, {
    operation,
    ...data,
    timestamp: new Date().toISOString()
  });
}

/**
 * Helper para logar autenticação
 */
export function logAuthEvent(event, data) {
  authLogger.info(`Auth Event: ${event}`, {
    event,
    ...data,
    timestamp: new Date().toISOString()
  });
}

/**
 * Obter estatísticas de logs
 */
export function getLogStats() {
  const stats = {};

  const logFiles = [
    'error.log',
    'combined.log',
    'app.log',
    'http.log',
    'ai-operations.log',
    'kb-operations.log',
    'auth.log',
    'exceptions.log',
    'rejections.log'
  ];

  for (const file of logFiles) {
    const filePath = path.join(logsDir, file);
    if (fs.existsSync(filePath)) {
      const stat = fs.statSync(filePath);
      stats[file] = {
        size: stat.size,
        sizeFormatted: formatBytes(stat.size),
        modified: stat.mtime
      };
    }
  }

  return {
    logsDirectory: logsDir,
    files: stats,
    totalSize: Object.values(stats).reduce((sum, s) => sum + s.size, 0),
    totalSizeFormatted: formatBytes(Object.values(stats).reduce((sum, s) => sum + s.size, 0))
  };
}

/**
 * Limpar logs antigos
 */
export function cleanOldLogs(daysOld = 30) {
  const files = fs.readdirSync(logsDir);
  const now = Date.now();
  const maxAge = daysOld * 24 * 60 * 60 * 1000;
  let cleaned = 0;

  for (const file of files) {
    const filePath = path.join(logsDir, file);
    const stat = fs.statSync(filePath);
    const age = now - stat.mtime.getTime();

    if (age > maxAge) {
      try {
        if (stat.isDirectory()) {
          // Remover diretório recursivamente
          fs.rmSync(filePath, { recursive: true, force: true });
        } else {
          // Remover arquivo
          fs.unlinkSync(filePath);
        }
        cleaned++;
        logger.info(`Log antigo removido: ${file}`, { age: Math.floor(age / (24 * 60 * 60 * 1000)), daysOld });
      } catch (error) {
        logger.warn(`Erro ao remover log antigo: ${file}`, { error: error.message });
      }
    }
  }

  return { cleaned, daysOld };
}

/**
 * Formatar bytes para leitura humana
 */
function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

// Exportar logger principal
export default logger;

// Agendar limpeza automática de logs antigos (executa diariamente)
setInterval(() => {
  cleanOldLogs(30);
}, 24 * 60 * 60 * 1000);

// Log de inicialização
logger.info('Sistema de logs inicializado', {
  logsDir,
  level: process.env.LOG_LEVEL || 'info'
});
