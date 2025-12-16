/**
 * ROM Agent - Módulo de Extração de Texto de PDFs
 *
 * Usa pdf-parse para extrair texto de documentos PDF
 */

import fs from 'fs/promises';
import pdfParse from 'pdf-parse';

/**
 * Extrair texto de um PDF
 * @param {string} filePath - Caminho do arquivo PDF
 * @returns {Promise<{success: boolean, text: string, pages: number, pageCount: number, info: object}>}
 */
export async function extractTextFromPDF(filePath) {
  try {
    // Ler o arquivo PDF
    const dataBuffer = await fs.readFile(filePath);

    // Parse do PDF
    const data = await pdfParse(dataBuffer);

    return {
      success: true,
      text: data.text || '',
      pages: data.numpages,
      pageCount: data.numpages,
      info: data.info || {},
      metadata: data.metadata || null
    };

  } catch (error) {
    console.error(`Erro ao extrair texto do PDF ${filePath}:`, error);
    return {
      success: false,
      text: '',
      pages: 0,
      pageCount: 0,
      info: {},
      error: error.message
    };
  }
}

/**
 * Extrair texto de um PDF com detalhes por página
 * @param {string} filePath - Caminho do arquivo PDF
 * @returns {Promise<{success: boolean, text: string, pages: array, pageCount: number}>}
 */
export async function extractTextFromPDFWithPages(filePath) {
  try {
    const dataBuffer = await fs.readFile(filePath);
    const data = await pdfParse(dataBuffer);

    // pdf-parse retorna todo o texto junto, então vamos dividir por páginas aproximadamente
    const textLines = data.text.split('\n');
    const linesPerPage = Math.ceil(textLines.length / data.numpages);

    const pages = [];
    for (let i = 0; i < data.numpages; i++) {
      const start = i * linesPerPage;
      const end = Math.min((i + 1) * linesPerPage, textLines.length);
      const pageText = textLines.slice(start, end).join('\n');

      pages.push({
        pageNumber: i + 1,
        text: pageText
      });
    }

    return {
      success: true,
      text: data.text || '',
      pages: pages,
      pageCount: data.numpages,
      info: data.info || {},
      metadata: data.metadata || null
    };

  } catch (error) {
    console.error(`Erro ao extrair texto do PDF ${filePath}:`, error);
    return {
      success: false,
      text: '',
      pages: [],
      pageCount: 0,
      info: {},
      error: error.message
    };
  }
}

export default {
  extractTextFromPDF,
  extractTextFromPDFWithPages
};
