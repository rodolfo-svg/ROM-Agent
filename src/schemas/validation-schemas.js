import { z } from 'zod';

export const userSchema = z.object({
  username: z.string().min(3).max(50),
  password: z.string().min(8),
  email: z.string().email().optional()
});

export const uploadSchema = z.object({
  files: z.array(z.any()).min(1),
  processType: z.enum(['extract', 'analyze', 'both']).default('both')
});

export const chatSchema = z.object({
  message: z.string().min(1).max(10000),
  context: z.any().optional()
});
