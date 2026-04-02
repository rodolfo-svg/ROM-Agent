/**
 * Sistema de Tokens JWT para Upload Chunked Cross-Origin
 *
 * Resolve o problema de autenticação entre domínios diferentes:
 * - Frontend em iarom.com.br
 * - Backend em rom-agent-ia.onrender.com
 *
 * Cookies de sessão não funcionam cross-origin, então usamos tokens JWT
 * temporários com validade curta (1 hora).
 */

import jwt from 'jsonwebtoken';
import crypto from 'crypto';

// ✅ Secret para assinar tokens (em produção, usar variável de ambiente)
const UPLOAD_TOKEN_SECRET = process.env.UPLOAD_TOKEN_SECRET ||
  crypto.randomBytes(32).toString('hex');

const TOKEN_EXPIRY = '1h'; // Tokens expiram em 1 hora

/**
 * Gera um token JWT para upload chunked
 * @param {Object} user - Usuário autenticado
 * @returns {string} Token JWT assinado
 */
function generateUploadToken(user) {
  if (!user || !user.id || !user.email) {
    throw new Error('Usuário inválido para geração de token');
  }

  const payload = {
    userId: user.id,
    email: user.email,
    purpose: 'chunked-upload',
    iat: Math.floor(Date.now() / 1000),
  };

  const token = jwt.sign(payload, UPLOAD_TOKEN_SECRET, {
    expiresIn: TOKEN_EXPIRY,
    issuer: 'rom-agent-api',
    subject: user.id.toString(),
  });

  console.log(`🎫 [UploadToken] Token gerado para ${user.email} (válido por ${TOKEN_EXPIRY})`);

  return token;
}

/**
 * Middleware para validar token de upload
 * Usado nas rotas de chunked upload para autenticação cross-origin
 */
function requireUploadToken(req, res, next) {
  try {
    // ✅ Aceitar token via header Authorization
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.warn('⚠️ [UploadToken] Token ausente ou formato inválido');
      return res.status(401).json({
        success: false,
        error: 'Token de upload ausente ou inválido',
        message: 'Use o endpoint /api/upload/get-upload-token para obter um token válido'
      });
    }

    const token = authHeader.substring(7); // Remove "Bearer "

    // ✅ Verificar e decodificar token
    const decoded = jwt.verify(token, UPLOAD_TOKEN_SECRET, {
      issuer: 'rom-agent-api',
    });

    // ✅ Validar propósito do token
    if (decoded.purpose !== 'chunked-upload') {
      console.warn('⚠️ [UploadToken] Token com propósito inválido:', decoded.purpose);
      return res.status(403).json({
        success: false,
        error: 'Token inválido',
        message: 'Este token não é válido para upload'
      });
    }

    // ✅ Anexar dados do usuário ao request
    req.user = {
      id: decoded.userId,
      email: decoded.email,
    };

    console.log(`✅ [UploadToken] Token válido para ${decoded.email}`);
    next();

  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      console.warn('⚠️ [UploadToken] Token expirado');
      return res.status(401).json({
        success: false,
        error: 'Token expirado',
        message: 'Por favor, obtenha um novo token de upload'
      });
    }

    if (error.name === 'JsonWebTokenError') {
      console.warn('⚠️ [UploadToken] Token inválido:', error.message);
      return res.status(401).json({
        success: false,
        error: 'Token inválido',
        message: error.message
      });
    }

    console.error('❌ [UploadToken] Erro ao validar token:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro ao validar token de upload',
      message: error.message
    });
  }
}

export {
  generateUploadToken,
  requireUploadToken,
  UPLOAD_TOKEN_SECRET,
};
