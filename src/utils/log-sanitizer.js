/**
 * LOG SANITIZER
 *
 * Remove dados sensíveis dos logs antes de gravar
 * Previne vazamento de:
 * - Tokens de API (AWS, Anthropic, etc)
 * - Senhas e credenciais
 * - CPF, RG, PIS, CNH
 * - Números de cartão de crédito
 * - Emails e telefones
 * - Dados jurídicos sensíveis
 *
 * @module log-sanitizer
 * @version 1.0.0
 */

/**
 * Padrões de dados sensíveis (regex)
 */
const SENSITIVE_PATTERNS = {
  // AWS Credentials
  awsAccessKey: /AKIA[0-9A-Z]{16}/gi,
  awsSecretKey: /[A-Za-z0-9/+=]{40}/g,

  // Anthropic API Key
  anthropicKey: /sk-ant-[a-zA-Z0-9-_]{95}/gi,

  // Generic API Keys/Tokens
  apiKey: /api[_-]?key["\s:=]+["']?([a-zA-Z0-9_\-]{20,})/gi,
  bearerToken: /Bearer\s+[a-zA-Z0-9\-._~+/]+=*/gi,
  jwtToken: /eyJ[a-zA-Z0-9_-]*\.eyJ[a-zA-Z0-9_-]*\.[a-zA-Z0-9_-]*/gi,

  // Senhas
  password: /password["\s:=]+["']?([^\s"']+)/gi,
  senha: /senha["\s:=]+["']?([^\s"']+)/gi,

  // Documentos Brasileiros
  cpf: /\d{3}\.?\d{3}\.?\d{3}-?\d{2}/g,
  cnpj: /\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}/g,
  rg: /\d{1,2}\.?\d{3}\.?\d{3}-?[0-9xX]/g,
  pis: /\d{3}\.?\d{5}\.?\d{2}-?\d/g,
  cnh: /\d{11}/g,  // Pode ter falsos positivos

  // Cartão de Crédito (Luhn algorithm patterns)
  creditCard: /\b(?:\d{4}[\s-]?){3}\d{4}\b/g,

  // Email
  email: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,

  // Telefone Brasileiro
  phone: /(?:\+55\s?)?\(?[1-9]{2}\)?\s?9?\d{4}-?\d{4}/g,

  // IP Privados (menos importante, mas pode vazar topologia)
  privateIp: /\b(?:10|172\.(?:1[6-9]|2\d|3[01])|192\.168)\.\d{1,3}\.\d{1,3}\b/g,

  // Dados Jurídicos Sensíveis
  processoNumero: /\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}/g,  // Processo CNJ
  oab: /OAB[\/\s-]?[A-Z]{2}\s?\d{4,6}/gi,
};

/**
 * Campos que sempre devem ser sanitizados (independente do valor)
 */
const SENSITIVE_FIELD_NAMES = [
  'password',
  'senha',
  'secret',
  'token',
  'apiKey',
  'api_key',
  'access_key',
  'secret_key',
  'private_key',
  'authorization',
  'auth',
  'credential',
  'credentials',
  'cpf',
  'rg',
  'cnpj',
  'pis',
  'cnh',
  'credit_card',
  'card_number',
  'cvv',
  'pin'
];

/**
 * Mascara string com redação parcial
 * Ex: "abc123def" -> "abc***def"
 */
function maskString(str, keepStart = 3, keepEnd = 3) {
  if (!str || typeof str !== 'string') return str;
  if (str.length <= keepStart + keepEnd) return '***';

  const start = str.substring(0, keepStart);
  const end = str.substring(str.length - keepEnd);
  return `${start}***${end}`;
}

/**
 * Mascara CPF: 123.456.789-01 -> 123.***.***-01
 */
function maskCPF(cpf) {
  return cpf.replace(/(\d{3})\.?\d{3}\.?\d{3}(-?\d{2})/, '$1.***.***$2');
}

/**
 * Mascara CNPJ: 12.345.678/0001-01 -> 12.***.***/**01-01
 */
function maskCNPJ(cnpj) {
  return cnpj.replace(/(\d{2})\.?\d{3}\.?\d{3}(\/?\d{4}-?\d{2})/, '$1.***.**$2');
}

/**
 * Mascara cartão de crédito: 1234 5678 9012 3456 -> **** **** **** 3456
 */
function maskCreditCard(card) {
  return card.replace(/\d{4}(\s?-?)\d{4}(\s?-?)\d{4}(\s?-?)\d{4}/, '**** **** **** $3');
}

/**
 * Mascara email: usuario@dominio.com -> u***o@d***.com
 */
function maskEmail(email) {
  return email.replace(/([a-zA-Z0-9])[a-zA-Z0-9._%+-]*([a-zA-Z0-9])@([a-zA-Z0-9])[a-zA-Z0-9.-]*\.([a-zA-Z]{2,})/, '$1***$2@$3***.$4');
}

/**
 * Mascara telefone: (11) 98765-4321 -> (11) ****-4321
 */
function maskPhone(phone) {
  return phone.replace(/(\d{2})\)?\s?9?\d{4}(-?\d{4})/, '$1) ****$2');
}

/**
 * Sanitiza string removendo dados sensíveis
 */
export function sanitizeString(str) {
  if (!str || typeof str !== 'string') return str;

  let sanitized = str;

  // AWS Keys
  sanitized = sanitized.replace(SENSITIVE_PATTERNS.awsAccessKey, 'AKIA***[REDACTED]');
  sanitized = sanitized.replace(SENSITIVE_PATTERNS.awsSecretKey, (match) =>
    match.length === 40 ? '***[AWS_SECRET_KEY_REDACTED]***' : match
  );

  // Anthropic Key
  sanitized = sanitized.replace(SENSITIVE_PATTERNS.anthropicKey, 'sk-ant-***[REDACTED]***');

  // Generic API Keys/Tokens
  sanitized = sanitized.replace(SENSITIVE_PATTERNS.apiKey, 'api_key="***[REDACTED]***"');
  sanitized = sanitized.replace(SENSITIVE_PATTERNS.bearerToken, 'Bearer ***[REDACTED]***');
  sanitized = sanitized.replace(SENSITIVE_PATTERNS.jwtToken, 'eyJ***[JWT_REDACTED]***');

  // Senhas
  sanitized = sanitized.replace(SENSITIVE_PATTERNS.password, 'password="***"');
  sanitized = sanitized.replace(SENSITIVE_PATTERNS.senha, 'senha="***"');

  // Documentos
  sanitized = sanitized.replace(SENSITIVE_PATTERNS.cpf, (match) => maskCPF(match));
  sanitized = sanitized.replace(SENSITIVE_PATTERNS.cnpj, (match) => maskCNPJ(match));
  sanitized = sanitized.replace(SENSITIVE_PATTERNS.rg, '**.***.***.**.***.**');

  // Cartão de crédito
  sanitized = sanitized.replace(SENSITIVE_PATTERNS.creditCard, (match) => maskCreditCard(match));

  // Email
  sanitized = sanitized.replace(SENSITIVE_PATTERNS.email, (match) => maskEmail(match));

  // Telefone
  sanitized = sanitized.replace(SENSITIVE_PATTERNS.phone, (match) => maskPhone(match));

  // Número de processo
  sanitized = sanitized.replace(SENSITIVE_PATTERNS.processoNumero, '***PROCESSO***');

  // OAB
  sanitized = sanitized.replace(SENSITIVE_PATTERNS.oab, 'OAB/**-***');

  return sanitized;
}

/**
 * Sanitiza objeto recursivamente
 */
export function sanitizeObject(obj, depth = 0) {
  if (!obj || typeof obj !== 'object') {
    return typeof obj === 'string' ? sanitizeString(obj) : obj;
  }

  // Prevenir loop infinito
  if (depth > 10) return '[MAX_DEPTH_EXCEEDED]';

  // Array
  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item, depth + 1));
  }

  // Object
  const sanitized = {};

  for (const [key, value] of Object.entries(obj)) {
    const lowerKey = key.toLowerCase();

    // Campo sensível -> sempre mascarar
    if (SENSITIVE_FIELD_NAMES.some(field => lowerKey.includes(field))) {
      sanitized[key] = typeof value === 'string' ? maskString(value) : '***';
      continue;
    }

    // Valor string -> sanitizar
    if (typeof value === 'string') {
      sanitized[key] = sanitizeString(value);
    }
    // Objeto/Array -> recursivo
    else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeObject(value, depth + 1);
    }
    // Outros tipos -> manter
    else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

/**
 * Middleware para sanitizar logs antes de gravar
 * Usado pelo structured-logger
 */
export function sanitizeLogEntry(level, message, meta = {}) {
  return {
    level,
    message: sanitizeString(message),
    meta: sanitizeObject(meta),
    timestamp: new Date().toISOString()
  };
}

/**
 * Validar se string contém dados sensíveis (para alertas)
 */
export function containsSensitiveData(str) {
  if (!str || typeof str !== 'string') return false;

  for (const [name, pattern] of Object.entries(SENSITIVE_PATTERNS)) {
    if (pattern.test(str)) {
      return { found: true, type: name };
    }
  }

  return { found: false };
}

/**
 * Export padrão
 */
export default {
  sanitizeString,
  sanitizeObject,
  sanitizeLogEntry,
  containsSensitiveData,
  maskString,
  maskCPF,
  maskCNPJ,
  maskEmail,
  maskPhone,
  maskCreditCard
};
