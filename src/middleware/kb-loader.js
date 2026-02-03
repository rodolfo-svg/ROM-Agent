/**
 * KB Loader Middleware
 *
 * Carrega automaticamente ficheiros estruturados do Knowledge Base
 * quando um número de processo é mencionado na mensagem.
 *
 * Ficheiros carregados:
 * - 01_FICHAMENTO.md
 * - 02_INDICE_CRONOLOGICO.md
 * - 03_INDICE_POR_TIPO.md
 * - 04_ENTIDADES.json
 * - 05_ANALISE_PEDIDOS.md
 * - 06_FATOS_RELEVANTES.md
 * - 07_LEGISLACAO_CITADA.md
 */

import { searchKnowledgeBase } from '../modules/knowledgeBase.js';
import fs from 'fs/promises';
import path from 'path';
import logger from '../../lib/logger.js';
import { ACTIVE_PATHS } from '../../lib/storage-config.js';

/**
 * Regex para detectar números de processo no formato CNJ
 * NNNNNNN-DD.AAAA.J.TR.OOOO
 */
const PROCESSO_REGEX = /\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}/g;

/**
 * Buscar documentos no KB que contenham o número do processo
 * Como metadata não tem campo processNumber, busca no conteúdo dos arquivos .txt
 */
async function searchDocumentsByProcessNumber(partnerId, processNumber) {
  try {
    const kbDir = path.join(ACTIVE_PATHS.data, 'knowledge-base', 'documents');

    // Verificar se diretório existe
    try {
      await fs.access(kbDir);
    } catch {
      return [];
    }

    // Listar todos os arquivos .txt
    const files = await fs.readdir(kbDir);
    const txtFiles = files.filter(f => f.endsWith('.txt'));

    const matchingDocs = [];

    // Buscar processo em cada arquivo .txt
    for (const txtFile of txtFiles) {
      try {
        const txtPath = path.join(kbDir, txtFile);
        const content = await fs.readFile(txtPath, 'utf-8');

        // Verificar se o conteúdo contém o número do processo
        if (content.includes(processNumber)) {
          // Buscar metadata correspondente
          const baseName = txtFile.replace('.txt', '');
          const metadataPath = path.join(kbDir, `${baseName}.metadata.json`);

          try {
            const metadataContent = await fs.readFile(metadataPath, 'utf-8');
            const metadata = JSON.parse(metadataContent);

            // Adicionar aos resultados
            matchingDocs.push({
              ...metadata,
              txtFile,
              txtPath,
              processNumber
            });
          } catch (metaErr) {
            logger.debug(`   Metadata não encontrado para ${txtFile}`);
          }
        }
      } catch (readErr) {
        logger.debug(`   Erro ao ler ${txtFile}:`, readErr.message);
      }
    }

    return matchingDocs;
  } catch (error) {
    logger.error(`❌ [KB Search] Erro ao buscar processo ${processNumber}:`, error.message);
    return [];
  }
}

/**
 * Middleware para carregar ficheiros estruturados do KB
 */
export async function loadStructuredFilesFromKB(req, res, next) {
  const { message } = req.body;

  try {
    // Verificar se há mensagem
    if (!message || typeof message !== 'string') {
      return next();
    }

    // Detectar números de processo na mensagem
    const processosMatch = message.match(PROCESSO_REGEX);

    if (!processosMatch || processosMatch.length === 0) {
      // Nenhum processo detectado, continuar normalmente
      return next();
    }

    // Remover duplicatas
    const processNumbers = [...new Set(processosMatch)];
    const partnerId = req.user?.partnerId || 'ROM';

    logger.info(`🔍 [KB Loader] Detectados ${processNumbers.length} processo(s):`, processNumbers);

    // Buscar documentos para cada processo
    let allStructuredFiles = [];
    let totalDocsFound = 0;

    for (const processNumber of processNumbers) {
      try {
        // Buscar documentos que contenham o número do processo
        // Como o metadata não tem campo processNumber, vamos buscar no conteúdo dos arquivos .txt
        const kbDocs = await searchDocumentsByProcessNumber(partnerId, processNumber);

        if (kbDocs.length > 0) {
          totalDocsFound += kbDocs.length;
          logger.info(`✅ [KB Loader] Processo ${processNumber}: ${kbDocs.length} documento(s) encontrado(s)`);

          // Carregar ficheiros estruturados do metadata
          for (const doc of kbDocs) {
            // Verificar se há ficheiros estruturados no metadata
            if (doc.structuredDocsInKB && Array.isArray(doc.structuredDocsInKB)) {
              for (const structFile of doc.structuredDocsInKB) {
                try {
                  const content = await fs.readFile(structFile.path, 'utf-8');

                  allStructuredFiles.push({
                    processNumber,
                    name: structFile.name,
                    type: structFile.type,
                    path: structFile.path,
                    content
                  });

                  logger.debug(`   📄 Carregado: ${structFile.name}`);
                } catch (readErr) {
                  logger.warn(`⚠️ [KB Loader] Não foi possível ler ${structFile.name}:`, readErr.message);
                }
              }
            }
          }
        } else {
          logger.info(`ℹ️ [KB Loader] Processo ${processNumber}: Nenhum documento encontrado no KB`);
        }
      } catch (searchErr) {
        logger.error(`❌ [KB Loader] Erro ao buscar processo ${processNumber}:`, searchErr.message);
      }
    }

    // Se encontrou ficheiros estruturados, adicionar ao contexto
    if (allStructuredFiles.length > 0) {
      const kbContext = formatStructuredFilesContext(allStructuredFiles);

      // Adicionar ao request (concatenar se já houver kbContext)
      const existingKbContext = req.body.kbContext || '';
      req.body.kbContext = existingKbContext
        ? existingKbContext + '\n\n' + kbContext
        : kbContext;

      // Log de resumo
      logger.info(`✅ [KB Loader] ${allStructuredFiles.length} ficheiro(s) estruturado(s) carregado(s)`);

      const fileTypes = {
        'FICHAMENTO': allStructuredFiles.filter(f => f.name.includes('FICHAMENTO')).length > 0,
        'CRONOLOGICO': allStructuredFiles.filter(f => f.name.includes('CRONOLOGICO')).length > 0,
        'TIPO': allStructuredFiles.filter(f => f.name.includes('TIPO')).length > 0,
        'ENTIDADES': allStructuredFiles.filter(f => f.name.includes('ENTIDADES')).length > 0,
        'PEDIDOS': allStructuredFiles.filter(f => f.name.includes('PEDIDOS')).length > 0,
        'RELEVANTES': allStructuredFiles.filter(f => f.name.includes('RELEVANTES')).length > 0,
        'LEGISLACAO': allStructuredFiles.filter(f => f.name.includes('LEGISLACAO')).length > 0
      };

      logger.info('   Ficheiros disponíveis:', fileTypes);
    } else {
      logger.info(`ℹ️ [KB Loader] Nenhum ficheiro estruturado encontrado para os processos mencionados`);
    }

    next();
  } catch (error) {
    logger.error('❌ [KB Loader] Erro geral:', error.message, error.stack);
    // Continuar mesmo se falhar - não bloquear o chat
    next();
  }
}

/**
 * Formatar ficheiros estruturados para o contexto do chat
 * @param {Array} files - Array de ficheiros {processNumber, name, type, content}
 * @returns {string} Contexto formatado
 */
function formatStructuredFilesContext(files) {
  // Agrupar por processo
  const byProcess = {};
  files.forEach(file => {
    if (!byProcess[file.processNumber]) {
      byProcess[file.processNumber] = [];
    }
    byProcess[file.processNumber].push(file);
  });

  let context = '';

  // Formatar cada processo
  Object.keys(byProcess).forEach(processNumber => {
    const processFiles = byProcess[processNumber];

    context += `\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    context += `📚 FICHEIROS ESTRUTURADOS DO KB - Processo ${processNumber}\n`;
    context += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;

    // Ordem lógica de apresentação
    const order = ['FICHAMENTO', 'CRONOLOGICO', 'TIPO', 'ENTIDADES', 'PEDIDOS', 'RELEVANTES', 'LEGISLACAO'];

    // Ordenar ficheiros pela sequência lógica
    const sortedFiles = processFiles.sort((a, b) => {
      const aIndex = order.findIndex(o => a.name.toUpperCase().includes(o));
      const bIndex = order.findIndex(o => b.name.toUpperCase().includes(o));
      return (aIndex === -1 ? 999 : aIndex) - (bIndex === -1 ? 999 : bIndex);
    });

    sortedFiles.forEach((file, i) => {
      context += `\n### 📄 ${i + 1}. ${file.name.replace(/^\d+_/, '').replace(/\.\w+$/, '')}\n\n`;

      // Verificar tamanho do conteúdo e truncar se muito grande
      const maxChars = 50000; // 50k chars por ficheiro
      let content = file.content;

      if (content.length > maxChars) {
        content = content.substring(0, maxChars) + '\n\n[... conteúdo truncado por limite de tamanho ...]';
        logger.warn(`⚠️ [KB Loader] Ficheiro ${file.name} truncado de ${file.content.length} para ${maxChars} chars`);
      }

      context += `${content}\n\n`;
      context += `---\n\n`;
    });

    context += `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    context += `✅ Total de ficheiros carregados: ${processFiles.length}\n`;
    context += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
  });

  return context;
}

export default {
  loadStructuredFilesFromKB
};
