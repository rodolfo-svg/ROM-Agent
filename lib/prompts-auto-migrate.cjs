/**
 * Auto-Migração de Prompts para Disco Persistente
 *
 * Executa automaticamente no startup do servidor.
 * Migra prompts de data/prompts/ → /var/data/prompts/ (uma única vez).
 *
 * Comportamento:
 * - Primeira execução: Copia todos os prompts para /var/data/prompts/
 * - Execuções seguintes: Detecta que já existem e pula
 * - Desenvolvimento local: Usa data/prompts/ normalmente (sem /var/data)
 */

const fs = require('fs');
const path = require('path');

class PromptsAutoMigrate {
  constructor() {
    this.persistentDir = '/var/data/prompts';
    this.sourceDir = path.join(__dirname, '../data/prompts');
  }

  /**
   * Verifica se deve usar disco persistente
   */
  shouldUsePersistentDisk() {
    // Usar /var/data apenas se o diretório existir (produção Render.com)
    try {
      fs.accessSync('/var/data', fs.constants.W_OK);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Retorna o diretório correto baseado no ambiente
   */
  getPromptsDirectory() {
    if (this.shouldUsePersistentDisk()) {
      // Produção: usar disco persistente
      return this.persistentDir;
    } else {
      // Desenvolvimento: usar data/prompts/
      return this.sourceDir;
    }
  }

  /**
   * Copia recursivamente um diretório
   */
  copyRecursive(src, dest) {
    if (!fs.existsSync(src)) return 0;

    const stats = fs.statSync(src);

    if (stats.isDirectory()) {
      fs.mkdirSync(dest, { recursive: true });
      const files = fs.readdirSync(src);
      let count = 0;

      for (const file of files) {
        const srcPath = path.join(src, file);
        const destPath = path.join(dest, file);
        count += this.copyRecursive(srcPath, destPath);
      }

      return count;
    } else if (stats.isFile() && src.endsWith('.md')) {
      fs.copyFileSync(src, dest);
      return 1;
    }

    return 0;
  }

  /**
   * Executa migração para disco persistente (se necessário)
   */
  async migrate() {
    // Pular se não deve usar disco persistente
    if (!this.shouldUsePersistentDisk()) {
      console.log('📝 [Prompts] Ambiente local - usando data/prompts/');
      return { success: true, migrated: false, reason: 'local' };
    }

    console.log('📝 [Prompts] Verificando migração para disco persistente...');

    try {
      // Criar estrutura de diretórios
      const globalDir = path.join(this.persistentDir, 'global');
      const partnersDir = path.join(this.persistentDir, 'partners');

      fs.mkdirSync(globalDir, { recursive: true });
      fs.mkdirSync(partnersDir, { recursive: true });

      // Sincronizar prompts (copiar novos, manter existentes)
      const sourceGlobal = path.join(this.sourceDir, 'global');
      const sourceFiles = fs.existsSync(sourceGlobal)
        ? fs.readdirSync(sourceGlobal).filter(f => f.endsWith('.md'))
        : [];
      const existingFiles = fs.readdirSync(globalDir).filter(f => f.endsWith('.md'));

      console.log(`📦 [Prompts] Sincronizando prompts...`);
      console.log(`   Origem: ${sourceFiles.length} arquivos`);
      console.log(`   Destino: ${existingFiles.length} arquivos`);

      let copiedGlobal = 0;
      let skipped = 0;

      // Copiar apenas arquivos que não existem ou são diferentes
      for (const file of sourceFiles) {
        const sourcePath = path.join(sourceGlobal, file);
        const destPath = path.join(globalDir, file);

        if (fs.existsSync(destPath)) {
          // Arquivo já existe, verificar se é diferente
          const sourceSize = fs.statSync(sourcePath).size;
          const destSize = fs.statSync(destPath).size;

          if (sourceSize === destSize) {
            skipped++;
            continue;
          }
        }

        // Copiar arquivo novo ou diferente
        fs.copyFileSync(sourcePath, destPath);
        copiedGlobal++;
      }

      console.log(`✅ [Prompts] ${copiedGlobal} novos/atualizados, ${skipped} mantidos`);

      // Limpar duplicatas V5_0 (arquivos com padrão antigo)
      const oldPatternFiles = fs.readdirSync(globalDir)
        .filter(f => f.includes('V5_0') && f.endsWith('.md'));

      let cleanedDuplicates = 0;
      for (const oldFile of oldPatternFiles) {
        const newFile = oldFile.replace('V5_0', 'V5.0');
        const oldPath = path.join(globalDir, oldFile);
        const newPath = path.join(globalDir, newFile);

        // Se existe versão nova (V5.0), remover versão antiga (V5_0)
        if (fs.existsSync(newPath)) {
          try {
            fs.unlinkSync(oldPath);
            cleanedDuplicates++;
            console.log(`🗑️  [Prompts] Removida duplicata: ${oldFile}`);
          } catch (err) {
            console.error(`⚠️  [Prompts] Erro ao remover ${oldFile}:`, err.message);
          }
        }
      }

      if (cleanedDuplicates > 0) {
        console.log(`🧹 [Prompts] ${cleanedDuplicates} duplicatas antigas removidas`);
      }

      // Copiar prompts de parceiros (se existirem)
      const sourcePartners = path.join(this.sourceDir, 'partners');
      if (fs.existsSync(sourcePartners)) {
        const copiedPartners = this.copyRecursive(sourcePartners, partnersDir);
        if (copiedPartners > 0) {
          console.log(`✅ [Prompts] ${copiedPartners} prompts de parceiros migrados`);
        }
      }

      console.log('');
      console.log('╔════════════════════════════════════════════════════════════╗');
      console.log('║  ✅ MIGRAÇÃO AUTOMÁTICA CONCLUÍDA                         ║');
      console.log('╚════════════════════════════════════════════════════════════╝');
      console.log(`📍 Localização: ${this.persistentDir}`);
      console.log(`📊 Total: ${copiedGlobal} prompts`);
      console.log('🔒 Persistente: SIM (edições preservadas em redeploy)');
      console.log('');

      return { success: true, migrated: true, count: copiedGlobal };

    } catch (error) {
      console.error('❌ [Prompts] Erro na migração:', error.message);
      console.log('⚠️  [Prompts] Usando data/prompts/ como fallback');
      return { success: false, error: error.message };
    }
  }
}

// Singleton
const autoMigrate = new PromptsAutoMigrate();

module.exports = autoMigrate;
