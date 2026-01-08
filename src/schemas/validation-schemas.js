/**
 * Schemas de validação Zod
 */
import { z } from 'zod';

// Upload de arquivos
export const uploadSchema = z.object({
  files: z.array(z.string()).min(1).max(100),
  folderName: z.string().regex(/^[a-zA-Z0-9_-]+$/),
  projectName: z.string().optional(),
  uploadToKB: z.boolean().optional()
});

// Criação de usuário
export const createUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(2).max(100),
  role: z.enum(['admin', 'user', 'viewer']),
  oab: z.string().optional()
});

// Atualização de usuário
export const updateUserSchema = z.object({
  email: z.string().email().optional(),
  password: z.string().min(8).optional(),
  name: z.string().min(2).max(100).optional(),
  role: z.enum(['admin', 'user', 'viewer']).optional(),
  oab: z.string().optional()
});

// Criação de parceiro
export const createPartnerSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  phone: z.string().optional(),
  company: z.string().optional()
});

// Documento extraction
export const extractSchema = z.object({
  files: z.array(z.string()).min(1).max(100),
  folderName: z.string().regex(/^[a-zA-Z0-9_-]+$/),
  projectName: z.string().optional(),
  uploadToKB: z.boolean().optional()
});
