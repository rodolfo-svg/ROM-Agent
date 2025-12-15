/**
 * STORAGE CONFIGURATION - Armazenamento Persistente
 * Configuração centralizada de diretórios de armazenamento
 *
 * NO RENDER:
 * - /var/data/ = Disco persistente (1GB, mantido após reiniciar)
 * - /opt/render/project/src/ = Efêmero (perdido ao reiniciar)
 *
 * @version 1.0.0
 */

import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Detectar se estamos no Render
const isRender = process.env.RENDER === 'true' || process.env.IS_PULL_REQUEST === 'true';

// Base do disco persistente
const PERSISTENT_BASE = isRender ? '/var/data' : path.join(__dirname, '../var-data-local');

// Base do projeto
const PROJECT_BASE = path.join(__dirname, '..');

/**
 * Estrutura de diretórios
 */
export const STORAGE_PATHS = {
  // ═══ DISCO PERSISTENTE (mantido após reiniciar) ═══
  persistent: {
    base: PERSISTENT_BASE,
    upload: path.join(PERSISTENT_BASE, 'upload'),
    processed: path.join(PERSISTENT_BASE, 'processed'),
    extracted: path.join(PERSISTENT_BASE, 'extracted'),
    data: path.join(PERSISTENT_BASE, 'data'),
    kb: path.join(PERSISTENT_BASE, 'data', 'knowledge-base'),
    backups: path.join(PERSISTENT_BASE, 'backups'),
    logs: path.join(PERSISTENT_BASE, 'logs'),
    partners: path.join(PERSISTENT_BASE, 'public', 'img', 'partners')
  },

  // ═══ DISCO EFÊMERO (fallback local) ═══
  ephemeral: {
    base: PROJECT_BASE,
    upload: path.join(PROJECT_BASE, 'upload'),
    processed: path.join(PROJECT_BASE, 'processed'),
    extracted: path.join(PROJECT_BASE, 'extracted'),
    data: path.join(PROJECT_BASE, 'data'),
    kb: path.join(PROJECT_BASE, 'data', 'knowledge-base'),
    backups: path.join(PROJECT_BASE, 'backups'),
    logs: path.join(PROJECT_BASE, 'logs'),
    partners: path.join(PROJECT_BASE, 'public', 'img', 'partners')
  }
};

/**
 * Retorna caminhos ativos (persistente em produção, efêmero em dev)
 */
export const ACTIVE_PATHS = isRender ? STORAGE_PATHS.persistent : STORAGE_PATHS.ephemeral;

/**
 * Informações do ambiente
 */
export const STORAGE_INFO = {
  isRender,
  isPersistent: isRender,
  environment: isRender ? 'production' : 'development',
  basePath: isRender ? PERSISTENT_BASE : PROJECT_BASE,
  diskSize: isRender ? '1 GB (persistente)' : 'ilimitado (local)'
};

/**
 * Criar estrutura de diretórios
 */
export function ensureStorageStructure() {
  const paths = ACTIVE_PATHS;

  // Criar todos os diretórios
  Object.values(paths).forEach(dirPath => {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
      console.log(`📁 Diretório criado: ${dirPath}`);
    }
  });

  // Criar subdiretórios da KB
  const kbSubdirs = ['documents', 'indexes', 'metadata'];
  kbSubdirs.forEach(subdir => {
    const fullPath = path.join(paths.kb, subdir);
    if (!fs.existsSync(fullPath)) {
      fs.mkdirSync(fullPath, { recursive: true });
      console.log(`📁 Subdiretório KB criado: ${fullPath}`);
    }
  });

  console.log(`✅ Estrutura de armazenamento configurada`);
  console.log(`   Ambiente: ${STORAGE_INFO.environment}`);
  console.log(`   Base: ${STORAGE_INFO.basePath}`);
  console.log(`   Persistente: ${STORAGE_INFO.isPersistent ? 'SIM' : 'NÃO'}`);
}

/**
 * Migrar arquivos do sistema efêmero para persistente
 */
export function migrateToPersistent() {
  if (!isRender) {
    console.log('ℹ️ Ambiente local - migração não necessária');
    return;
  }

  const sourcePaths = STORAGE_PATHS.ephemeral;
  const targetPaths = STORAGE_PATHS.persistent;

  // Diretórios a migrar
  const dirsToMigrate = ['upload', 'processed', 'extracted', 'data'];

  dirsToMigrate.forEach(dir => {
    const source = sourcePaths[dir];
    const target = targetPaths[dir];

    if (fs.existsSync(source)) {
      console.log(`🔄 Migrando ${dir}: ${source} → ${target}`);

      // Copiar arquivos
      try {
        const files = fs.readdirSync(source);
        files.forEach(file => {
          const srcFile = path.join(source, file);
          const tgtFile = path.join(target, file);

          if (fs.statSync(srcFile).isFile()) {
            fs.copyFileSync(srcFile, tgtFile);
            console.log(`  ✓ ${file}`);
          }
        });
        console.log(`✅ Migração de ${dir} concluída: ${files.length} arquivos`);
      } catch (err) {
        console.error(`❌ Erro ao migrar ${dir}:`, err.message);
      }
    }
  });
}

/**
 * Informações de uso do disco
 */
export function getStorageUsage() {
  const paths = ACTIVE_PATHS;
  const usage = {};

  Object.entries(paths).forEach(([name, dirPath]) => {
    if (fs.existsSync(dirPath)) {
      try {
        const files = fs.readdirSync(dirPath);
        let totalSize = 0;

        files.forEach(file => {
          const filePath = path.join(dirPath, file);
          if (fs.statSync(filePath).isFile()) {
            totalSize += fs.statSync(filePath).size;
          }
        });

        usage[name] = {
          files: files.length,
          size: totalSize,
          sizeFormatted: formatBytes(totalSize),
          path: dirPath
        };
      } catch (err) {
        usage[name] = {
          error: err.message,
          path: dirPath
        };
      }
    } else {
      usage[name] = {
        files: 0,
        size: 0,
        sizeFormatted: '0 B',
        path: dirPath,
        exists: false
      };
    }
  });

  return usage;
}

/**
 * Formatar bytes em formato legível
 */
function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Limpar arquivos antigos (mais de X dias)
 */
export function cleanOldFiles(directory, daysOld = 30) {
  if (!fs.existsSync(directory)) return { deleted: 0, freed: 0 };

  const cutoffDate = Date.now() - (daysOld * 24 * 60 * 60 * 1000);
  let deleted = 0;
  let freed = 0;

  try {
    const files = fs.readdirSync(directory);

    files.forEach(file => {
      const filePath = path.join(directory, file);
      const stats = fs.statSync(filePath);

      if (stats.isFile() && stats.mtimeMs < cutoffDate) {
        freed += stats.size;
        fs.unlinkSync(filePath);
        deleted++;
      }
    });

    console.log(`🧹 Limpeza ${directory}: ${deleted} arquivos, ${formatBytes(freed)} liberados`);
    return { deleted, freed, freedFormatted: formatBytes(freed) };
  } catch (err) {
    console.error(`❌ Erro na limpeza de ${directory}:`, err.message);
    return { deleted: 0, freed: 0, error: err.message };
  }
}

// Inicializar estrutura ao carregar módulo
if (isRender) {
  console.log('🚀 Ambiente Render detectado - Usando armazenamento persistente');
  ensureStorageStructure();
} else {
  console.log('💻 Ambiente local detectado - Usando armazenamento local');
  ensureStorageStructure();
}

export default {
  STORAGE_PATHS,
  ACTIVE_PATHS,
  STORAGE_INFO,
  ensureStorageStructure,
  migrateToPersistent,
  getStorageUsage,
  cleanOldFiles,
  formatBytes
};
