/**
 * ROM Agent - Knowledge Base Module
 * Gerencia upload e organização de documentos na Knowledge Base
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { extractTextFromPDF } from './textract.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Diretório base da Knowledge Base
const KB_BASE_DIR = process.env.KB_BASE_DIR || path.join(__dirname, '../../data/knowledge-base');

/**
 * Extrai texto de arquivos baseado no tipo
 * @param {string} filePath - Caminho do arquivo
 * @returns {Promise<string>} Texto extraído
 */
async function extractTextFromFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();

  try {
    // Arquivos de texto simples
    if (['.txt', '.md', '.json', '.csv', '.log'].includes(ext)) {
      return await fs.readFile(filePath, 'utf-8');
    }

    // PDFs
    if (ext === '.pdf') {
      const result = await extractTextFromPDF(filePath);
      return result.text || '';
    }

    // Word documents (DOCX)
    if (['.doc', '.docx'].includes(ext)) {
      const mammoth = await import('mammoth');
      const buffer = await fs.readFile(filePath);
      const result = await mammoth.extractRawText({ buffer });
      return result.value || '';
    }

    // Outros formatos não suportados - tentar ler como texto
    try {
      return await fs.readFile(filePath, 'utf-8');
    } catch {
      throw new Error(`Tipo de arquivo não suportado para extração: ${ext}`);
    }

  } catch (error) {
    throw new Error(`Erro ao extrair texto de ${path.basename(filePath)}: ${error.message}`);
  }
}

/**
 * Upload de arquivos para a Knowledge Base
 * @param {Object} options - Opções de upload
 * @param {string} options.projectName - Nome do projeto
 * @param {string} options.processNumber - Número do processo
 * @param {Array} options.files - Array de arquivos para upload
 * @param {string} options.files[].path - Caminho do arquivo
 * @param {string} options.files[].type - Tipo do arquivo (resumo, cronologia, etc)
 * @returns {Promise<Object>} Resultado do upload
 */
export async function uploadToKnowledgeBase(options) {
  const { projectName, processNumber, files = [] } = options;

  try {
    // Criar estrutura de diretórios da KB
    const projectDir = path.join(KB_BASE_DIR, 'documents', projectName || 'ROM');
    await fs.mkdir(projectDir, { recursive: true });

    const uploadResults = {
      success: true,
      uploadIds: [],
      errors: [],
      timestamp: new Date().toISOString()
    };

    // Upload de cada arquivo
    for (const file of files) {
      try {
        // Verificar se arquivo existe
        await fs.access(file.path);

        // Extrair texto do arquivo (suporta PDF, DOCX, TXT, etc)
        const content = await extractTextFromFile(file.path);

        // Gerar ID único para o arquivo
        const timestamp = Date.now();
        const fileId = `${timestamp}_${processNumber || 'doc'}_${file.type}`;

        // Caminho de destino
        const destPath = path.join(projectDir, `${fileId}.txt`);
        const metadataPath = path.join(projectDir, `${fileId}.metadata.json`);

        // Salvar arquivo
        await fs.writeFile(destPath, content, 'utf-8');

        // Salvar metadados
        const metadata = {
          id: fileId,
          projectName,
          processNumber,
          type: file.type,
          originalPath: file.path,
          uploadedAt: new Date().toISOString(),
          size: content.length,
          extension: path.extname(file.path)
        };

        await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2), 'utf-8');

        uploadResults.uploadIds.push(fileId);

        console.log(`✅ KB Upload: ${fileId} (${file.type})`);

      } catch (fileError) {
        uploadResults.errors.push({
          file: file.path,
          type: file.type,
          error: fileError.message
        });
        console.error(`❌ KB Upload failed: ${file.path}`, fileError.message);
      }
    }

    // Se todos falharam, marcar como falha
    if (uploadResults.uploadIds.length === 0 && files.length > 0) {
      uploadResults.success = false;
    }

    return uploadResults;

  } catch (error) {
    console.error('❌ Knowledge Base upload error:', error);
    return {
      success: false,
      uploadIds: [],
      errors: [error.message],
      timestamp: new Date().toISOString()
    };
  }
}

/**
 * Buscar documentos na Knowledge Base
 * @param {Object} options - Opções de busca
 * @param {string} options.projectName - Nome do projeto
 * @param {string} options.processNumber - Número do processo
 * @param {string} options.type - Tipo do documento
 * @returns {Promise<Array>} Lista de documentos encontrados
 */
export async function searchKnowledgeBase(options) {
  const { projectName, processNumber, type } = options;

  try {
    const projectDir = path.join(KB_BASE_DIR, 'documents', projectName || 'ROM');

    // Verificar se diretório existe
    try {
      await fs.access(projectDir);
    } catch {
      return [];
    }

    // Listar arquivos de metadados
    const files = await fs.readdir(projectDir);
    const metadataFiles = files.filter(f => f.endsWith('.metadata.json'));

    const results = [];

    for (const metaFile of metadataFiles) {
      const metaPath = path.join(projectDir, metaFile);
      const metadata = JSON.parse(await fs.readFile(metaPath, 'utf-8'));

      // Filtrar por critérios
      let matches = true;
      if (processNumber && metadata.processNumber !== processNumber) matches = false;
      if (type && metadata.type !== type) matches = false;

      if (matches) {
        // Ler conteúdo do documento
        const docPath = path.join(projectDir, `${metadata.id}.txt`);
        try {
          const content = await fs.readFile(docPath, 'utf-8');
          results.push({
            ...metadata,
            content: content.substring(0, 500) // Preview
          });
        } catch {
          // Arquivo pode não existir mais
        }
      }
    }

    return results;

  } catch (error) {
    console.error('❌ Knowledge Base search error:', error);
    return [];
  }
}

/**
 * Deletar documento da Knowledge Base
 * @param {string} documentId - ID do documento
 * @param {string} projectName - Nome do projeto
 * @returns {Promise<boolean>} Sucesso
 */
export async function deleteFromKnowledgeBase(documentId, projectName = 'ROM') {
  try {
    const projectDir = path.join(KB_BASE_DIR, 'documents', projectName);

    const docPath = path.join(projectDir, `${documentId}.txt`);
    const metaPath = path.join(projectDir, `${documentId}.metadata.json`);

    // Deletar ambos os arquivos
    await Promise.all([
      fs.unlink(docPath).catch(() => {}),
      fs.unlink(metaPath).catch(() => {})
    ]);

    console.log(`🗑️  KB Delete: ${documentId}`);
    return true;

  } catch (error) {
    console.error('❌ Knowledge Base delete error:', error);
    return false;
  }
}

/**
 * Listar estatísticas da Knowledge Base
 * @param {string} projectName - Nome do projeto
 * @returns {Promise<Object>} Estatísticas
 */
export async function getKnowledgeBaseStats(projectName = 'ROM') {
  try {
    const projectDir = path.join(KB_BASE_DIR, 'documents', projectName);

    try {
      await fs.access(projectDir);
    } catch {
      return {
        totalDocuments: 0,
        totalSize: 0,
        byType: {}
      };
    }

    const files = await fs.readdir(projectDir);
    const metadataFiles = files.filter(f => f.endsWith('.metadata.json'));

    const stats = {
      totalDocuments: metadataFiles.length,
      totalSize: 0,
      byType: {}
    };

    for (const metaFile of metadataFiles) {
      const metaPath = path.join(projectDir, metaFile);
      const metadata = JSON.parse(await fs.readFile(metaPath, 'utf-8'));

      stats.totalSize += metadata.size || 0;
      stats.byType[metadata.type] = (stats.byType[metadata.type] || 0) + 1;
    }

    return stats;

  } catch (error) {
    console.error('❌ Knowledge Base stats error:', error);
    return {
      totalDocuments: 0,
      totalSize: 0,
      byType: {},
      error: error.message
    };
  }
}

export default {
  uploadToKnowledgeBase,
  searchKnowledgeBase,
  deleteFromKnowledgeBase,
  getKnowledgeBaseStats
};
