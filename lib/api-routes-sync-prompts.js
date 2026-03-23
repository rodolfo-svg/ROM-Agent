/**
 * Endpoint temporário para forçar sincronização de prompts V5.0
 * Criado para debugging do deploy
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function setupSyncPromptsRoutes(app) {

  // POST /api/admin/sync-prompts-v5 - Força sincronização
  app.post('/api/admin/sync-prompts-v5', async (req, res) => {
    try {
      const SOURCE_DIR = path.join(__dirname, '../data/prompts/global');
      const DEST_DIR = process.env.RENDER ? '/var/data/prompts/global' : SOURCE_DIR;

      console.log('🔄 Iniciando sincronização forçada de prompts V5.0');
      console.log(`📂 Origem: ${SOURCE_DIR}`);
      console.log(`📂 Destino: ${DEST_DIR}`);

      if (SOURCE_DIR === DEST_DIR) {
        return res.json({
          success: true,
          message: 'Ambiente local - sincronização não necessária',
          skipped: true
        });
      }

      // Criar diretório se não existir
      if (!fs.existsSync(DEST_DIR)) {
        fs.mkdirSync(DEST_DIR, { recursive: true });
      }

      // Listar arquivos V5.0
      const sourceFiles = fs.readdirSync(SOURCE_DIR)
        .filter(f => f.includes('V5') && f.endsWith('.md'));

      let copied = 0;
      let skipped = 0;
      let errors = [];

      for (const file of sourceFiles) {
        try {
          const sourcePath = path.join(SOURCE_DIR, file);
          const destPath = path.join(DEST_DIR, file);

          // Verificar se já existe
          if (fs.existsSync(destPath)) {
            const sourceSize = fs.statSync(sourcePath).size;
            const destSize = fs.statSync(destPath).size;

            if (sourceSize === destSize) {
              skipped++;
              continue;
            }
          }

          // Copiar
          fs.copyFileSync(sourcePath, destPath);
          copied++;

        } catch (error) {
          errors.push({ file, error: error.message });
        }
      }

      // Verificar total de arquivos no destino
      const totalFiles = fs.readdirSync(DEST_DIR).filter(f => f.endsWith('.md')).length;
      const v5Files = fs.readdirSync(DEST_DIR).filter(f => f.includes('V5') && f.endsWith('.md')).length;

      console.log(`✅ Sincronização concluída: ${copied} copiados, ${skipped} ignorados`);

      res.json({
        success: true,
        copied,
        skipped,
        errors: errors.length,
        errorDetails: errors,
        totalInDest: totalFiles,
        v5InDest: v5Files,
        sourceDir: SOURCE_DIR,
        destDir: DEST_DIR
      });

    } catch (error) {
      console.error('❌ Erro na sincronização:', error);
      res.status(500).json({
        success: false,
        error: error.message,
        stack: error.stack
      });
    }
  });

  // GET /api/admin/check-prompts-v5 - Verifica prompts V5.0
  app.get('/api/admin/check-prompts-v5', (req, res) => {
    try {
      const SOURCE_DIR = path.join(__dirname, '../data/prompts/global');
      const DEST_DIR = process.env.RENDER ? '/var/data/prompts/global' : SOURCE_DIR;

      const sourceExists = fs.existsSync(SOURCE_DIR);
      const destExists = fs.existsSync(DEST_DIR);

      const sourceFiles = sourceExists ? fs.readdirSync(SOURCE_DIR).filter(f => f.includes('V5') && f.endsWith('.md')) : [];
      const destFiles = destExists ? fs.readdirSync(DEST_DIR).filter(f => f.includes('V5') && f.endsWith('.md')) : [];

      res.json({
        source: {
          dir: SOURCE_DIR,
          exists: sourceExists,
          v5Files: sourceFiles.length,
          files: sourceFiles.slice(0, 10)
        },
        dest: {
          dir: DEST_DIR,
          exists: destExists,
          v5Files: destFiles.length,
          files: destFiles.slice(0, 10)
        },
        isRender: !!process.env.RENDER,
        needsSync: sourceFiles.length > destFiles.length
      });

    } catch (error) {
      res.status(500).json({
        error: error.message
      });
    }
  });

  // POST /api/admin/cleanup-v5-duplicates - Remove arquivos V5_0 duplicados
  app.post('/api/admin/cleanup-v5-duplicates', async (req, res) => {
    try {
      const DEST_DIR = process.env.RENDER ? '/var/data/prompts/global' : path.join(__dirname, '../data/prompts/global');

      console.log('🧹 Iniciando limpeza de duplicatas V5_0');
      console.log(`📂 Diretório: ${DEST_DIR}`);

      if (!process.env.RENDER) {
        return res.json({
          success: true,
          message: 'Ambiente local - limpeza não necessária',
          skipped: true
        });
      }

      // Listar arquivos com padrão V5_0 (antigo)
      const oldPatternFiles = fs.readdirSync(DEST_DIR)
        .filter(f => f.includes('V5_0') && f.endsWith('.md'));

      let deleted = 0;
      let errors = [];
      const deletedFiles = [];

      for (const file of oldPatternFiles) {
        try {
          const filePath = path.join(DEST_DIR, file);

          // Verificar se existe versão V5.0 (nova) do mesmo arquivo
          const newVersionFile = file.replace('V5_0', 'V5.0');
          const newVersionPath = path.join(DEST_DIR, newVersionFile);

          if (fs.existsSync(newVersionPath)) {
            // Deletar versão antiga
            fs.unlinkSync(filePath);
            deleted++;
            deletedFiles.push(file);
            console.log(`🗑️  Deletado: ${file}`);
          }

        } catch (error) {
          errors.push({ file, error: error.message });
          console.error(`❌ Erro ao deletar ${file}:`, error.message);
        }
      }

      console.log(`✅ Limpeza concluída: ${deleted} arquivos removidos`);

      res.json({
        success: true,
        deleted,
        deletedFiles,
        errors: errors.length,
        errorDetails: errors
      });

    } catch (error) {
      console.error('❌ Erro na limpeza:', error);
      res.status(500).json({
        success: false,
        error: error.message,
        stack: error.stack
      });
    }
  });
}
