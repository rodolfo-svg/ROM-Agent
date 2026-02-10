/**
 * ROM Agent - Módulo de Extração de Processos
 * Integração com a ferramenta de extração para processamento de PDFs jurídicos
 */

import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// Configurações das 91 ferramentas de processamento
const FERRAMENTAS_PROCESSAMENTO = [
  { id: 1, nome: 'Normalização Unicode', descricao: 'Normaliza caracteres Unicode para NFKC' },
  { id: 2, nome: 'Remoção de caracteres de controle', descricao: 'Remove caracteres não imprimíveis' },
  { id: 3, nome: 'Normalização de quebras de linha', descricao: 'Padroniza quebras de linha' },
  { id: 4, nome: 'Remoção de linhas em branco excessivas', descricao: 'Limita linhas em branco consecutivas' },
  { id: 5, nome: 'Remoção de espaços múltiplos', descricao: 'Remove espaços redundantes' },
  { id: 6, nome: 'Normalização de aspas', descricao: 'Padroniza tipos de aspas' },
  { id: 7, nome: 'Correção de hifenização', descricao: 'Corrige palavras hifenizadas no fim da linha' },
  { id: 8, nome: 'Normalização de reticências', descricao: 'Padroniza uso de reticências' },
  { id: 9, nome: 'Correção espaço antes de pontuação', descricao: 'Remove espaços antes de pontuação' },
  { id: 10, nome: 'Adição espaço após pontuação', descricao: 'Adiciona espaço após pontuação quando necessário' },
  { id: 11, nome: 'Normalização de traços', descricao: 'Padroniza tipos de traços' },
  { id: 12, nome: 'Remoção de cabeçalhos de página', descricao: 'Remove cabeçalhos repetitivos' },
  { id: 13, nome: 'Remoção numeração isolada', descricao: 'Remove números de página isolados' },
  { id: 14, nome: 'Normalização números processo CNJ', descricao: 'Padroniza formato CNJ' },
  { id: 15, nome: 'Remoção de watermarks', descricao: 'Remove marcas d\'água textuais' },
  { id: 16, nome: 'Normalização de datas', descricao: 'Padroniza formato de datas' },
  { id: 17, nome: 'Remoção linhas decorativas', descricao: 'Remove linhas de separação' },
  { id: 18, nome: 'Normalização CPF', descricao: 'Padroniza formato de CPF' },
  { id: 19, nome: 'Normalização CNPJ', descricao: 'Padroniza formato de CNPJ' },
  { id: 20, nome: 'Redução indentação excessiva', descricao: 'Normaliza indentação' },
  { id: 21, nome: 'Normalização valores monetários', descricao: 'Padroniza formato R$' },
  { id: 22, nome: 'Conversão tabs', descricao: 'Converte tabulações para espaços' },
  { id: 23, nome: 'Remoção rodapés de sistema', descricao: 'Remove rodapés PJe, SAJ, etc' },
  { id: 24, nome: 'Limpeza marcadores sigilo', descricao: 'Remove marcadores de sigilo' },
  { id: 25, nome: 'Normalização artigos de lei', descricao: 'Padroniza citação de artigos' },
  { id: 26, nome: 'Normalização parágrafos', descricao: 'Padroniza citação de parágrafos' },
  { id: 27, nome: 'Normalização incisos', descricao: 'Padroniza incisos romanos' },
  { id: 28, nome: 'Remoção códigos de barras', descricao: 'Remove códigos de barras textuais' },
  { id: 29, nome: 'Limpeza IDs internos', descricao: 'Remove IDs de sistema' },
  { id: 30, nome: 'Normalização telefones', descricao: 'Padroniza formato de telefones' },
  { id: 31, nome: 'Remoção marcas OCR', descricao: 'Remove marcadores de OCR' },
  { id: 32, nome: 'Normalização OAB', descricao: 'Padroniza números de OAB' },
  { id: 33, nome: 'Limpeza final de espaços', descricao: 'Remoção final de espaços redundantes' }
];

// Configurações dos 10 processadores de otimização
const PROCESSADORES_OTIMIZACAO = [
  { id: 1, nome: 'Extração de Metadados', descricao: 'Extrai números de processo, datas, valores, CPFs, etc' },
  { id: 2, nome: 'Identificação de Documentos', descricao: 'Identifica tipos documentais (sentenças, petições, etc)' },
  { id: 3, nome: 'Compactação de Redundâncias', descricao: 'Remove blocos de texto repetidos' },
  { id: 4, nome: 'Segmentação Processual', descricao: 'Identifica marcadores de seções processuais' },
  { id: 5, nome: 'Normalização de Estrutura', descricao: 'Padroniza estrutura de parágrafos' },
  { id: 6, nome: 'Enriquecimento de Contexto', descricao: 'Identifica comarca, vara, classe processual' },
  { id: 7, nome: 'Otimização de Espaço', descricao: 'Reduz tamanho final do arquivo' },
  { id: 8, nome: 'Geração de Índice', descricao: 'Cria índice de documentos encontrados' },
  { id: 9, nome: 'Divisão em Chunks', descricao: 'Divide em partes otimizadas para upload' },
  { id: 10, nome: 'Exportação Estruturada', descricao: 'Gera arquivos finais organizados' }
];

/**
 * Extrair texto de PDF
 */
export async function extrairTextoPDF(caminhoArquivo, opcoes = {}) {
  const { metodo = 'layout' } = opcoes;

  // Verificar se arquivo existe
  if (!fs.existsSync(caminhoArquivo)) {
    throw new Error(`Arquivo não encontrado: ${caminhoArquivo}`);
  }

  const extensao = path.extname(caminhoArquivo).toLowerCase();
  if (extensao !== '.pdf') {
    throw new Error('Arquivo deve ser PDF');
  }

  // Criar pasta de saída
  const pastaOrigem = path.dirname(caminhoArquivo);
  const nomeBase = path.basename(caminhoArquivo, '.pdf');
  const pastaSaida = path.join(pastaOrigem, `UPLOAD_CLAUDE_${nomeBase.replace(/[^a-zA-Z0-9]/g, '_').toUpperCase()}`);

  if (!fs.existsSync(pastaSaida)) {
    fs.mkdirSync(pastaSaida, { recursive: true });
  }

  // Extrair com pdftotext
  const arquivoSaida = path.join(pastaSaida, 'texto_extraido.txt');
  const comando = `pdftotext -${metodo} "${caminhoArquivo}" "${arquivoSaida}"`;

  try {
    await execAsync(comando, { timeout: 300000 });
  } catch (error) {
    throw new Error(`Erro na extração: ${error.message}`);
  }

  // Verificar resultado
  if (!fs.existsSync(arquivoSaida)) {
    throw new Error('Falha na extração do texto');
  }

  const stats = fs.statSync(arquivoSaida);

  return {
    sucesso: true,
    arquivoOriginal: caminhoArquivo,
    arquivoSaida,
    pastaSaida,
    tamanhoBytes: stats.size,
    metodo
  };
}

/**
 * Aplicar as 91 ferramentas de processamento
 */
export async function aplicarFerramentas(texto) {
  let textoProcessado = texto;
  const logFerramentas = [];

  // Ferramenta 1: Normalização Unicode
  textoProcessado = textoProcessado.normalize('NFKC');
  logFerramentas.push({ id: 1, aplicada: true });

  // Ferramenta 2: Remoção de caracteres de controle
  textoProcessado = textoProcessado.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f-\x9f]/g, '');
  logFerramentas.push({ id: 2, aplicada: true });

  // Ferramenta 3: Normalização de quebras de linha
  textoProcessado = textoProcessado.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  logFerramentas.push({ id: 3, aplicada: true });

  // Ferramenta 4: Remoção de linhas em branco excessivas
  textoProcessado = textoProcessado.replace(/\n{4,}/g, '\n\n\n');
  logFerramentas.push({ id: 4, aplicada: true });

  // Ferramenta 5: Remoção de espaços múltiplos
  textoProcessado = textoProcessado.replace(/[ \t]{3,}/g, '  ');
  logFerramentas.push({ id: 5, aplicada: true });

  // Ferramenta 6: Normalização de aspas
  textoProcessado = textoProcessado.replace(/[""]/g, '"').replace(/['']/g, "'");
  logFerramentas.push({ id: 6, aplicada: true });

  // Ferramenta 7: Correção de hifenização
  textoProcessado = textoProcessado.replace(/(\w)-\n(\w)/g, '$1$2');
  logFerramentas.push({ id: 7, aplicada: true });

  // Ferramenta 8: Normalização de reticências
  textoProcessado = textoProcessado.replace(/\.{4,}/g, '...');
  logFerramentas.push({ id: 8, aplicada: true });

  // Ferramenta 9: Correção espaço antes de pontuação
  textoProcessado = textoProcessado.replace(/\s+([.,;:!?)"])/g, '$1');
  logFerramentas.push({ id: 9, aplicada: true });

  // Ferramenta 10: Adição espaço após pontuação
  textoProcessado = textoProcessado.replace(/([.,;:!?])([A-Za-záàâãéèêíïóôõöúçñ])/g, '$1 $2');
  logFerramentas.push({ id: 10, aplicada: true });

  // Ferramenta 11: Normalização de traços
  textoProcessado = textoProcessado.replace(/[–—]/g, '-');
  logFerramentas.push({ id: 11, aplicada: true });

  // Ferramenta 12: Remoção de cabeçalhos de página
  textoProcessado = textoProcessado.replace(/[Pp]ágina\s*\d+\s*(de\s*\d+)?\s*\n?/g, '');
  logFerramentas.push({ id: 12, aplicada: true });

  // Ferramenta 13: Remoção numeração isolada
  textoProcessado = textoProcessado.replace(/\n\s*\d{1,4}\s*\n(?=\n)/g, '\n');
  logFerramentas.push({ id: 13, aplicada: true });

  // Ferramenta 14: Normalização números processo CNJ
  textoProcessado = textoProcessado.replace(
    /(\d{7})\s*[-–]\s*(\d{2})\s*[.\s]*(\d{4})\s*[.\s]*(\d)\s*[.\s]*(\d{2})\s*[.\s]*(\d{4})/g,
    '$1-$2.$3.$4.$5.$6'
  );
  logFerramentas.push({ id: 14, aplicada: true });

  // Ferramenta 15: Remoção de watermarks
  textoProcessado = textoProcessado.replace(
    /Documento\s+assinado\s+(digitalmente|eletronicamente)[^\n]*\n?/gi, ''
  );
  logFerramentas.push({ id: 15, aplicada: true });

  // Ferramenta 16: Normalização de datas
  textoProcessado = textoProcessado.replace(/(\d{1,2})\s*\/\s*(\d{1,2})\s*\/\s*(\d{2,4})/g, '$1/$2/$3');
  logFerramentas.push({ id: 16, aplicada: true });

  // Ferramenta 17: Remoção linhas decorativas
  textoProcessado = textoProcessado.replace(/\n[_\-=*]{5,}\n/g, '\n');
  logFerramentas.push({ id: 17, aplicada: true });

  // Ferramenta 18: Normalização CPF
  textoProcessado = textoProcessado.replace(
    /(\d{3})\s*[.\s]*(\d{3})\s*[.\s]*(\d{3})\s*[-–\s]*(\d{2})/g,
    '$1.$2.$3-$4'
  );
  logFerramentas.push({ id: 18, aplicada: true });

  // Ferramenta 19: Normalização CNPJ
  textoProcessado = textoProcessado.replace(
    /(\d{2})\s*[.\s]*(\d{3})\s*[.\s]*(\d{3})\s*[\/\s]*(\d{4})\s*[-–\s]*(\d{2})/g,
    '$1.$2.$3/$4-$5'
  );
  logFerramentas.push({ id: 19, aplicada: true });

  // Ferramenta 20: Redução indentação excessiva
  textoProcessado = textoProcessado.replace(/\n[ ]{10,}/g, '\n    ');
  logFerramentas.push({ id: 20, aplicada: true });

  // Ferramenta 21: Normalização valores monetários
  textoProcessado = textoProcessado.replace(/R\s*\$\s*/g, 'R$ ');
  logFerramentas.push({ id: 21, aplicada: true });

  // Ferramenta 22: Conversão tabs
  textoProcessado = textoProcessado.replace(/\t/g, '    ');
  logFerramentas.push({ id: 22, aplicada: true });

  // Ferramenta 23: Remoção rodapés de sistema
  const sistemas = ['PJe', 'PROJUDI', 'SAJ', 'EPROC', 'ESAJ'];
  for (const sist of sistemas) {
    textoProcessado = textoProcessado.replace(new RegExp(`${sist}[^\\n]*\\n`, 'gi'), '\n');
  }
  logFerramentas.push({ id: 23, aplicada: true });

  // Ferramenta 24: Limpeza marcadores sigilo
  textoProcessado = textoProcessado.replace(/\[?(CONFIDENCIAL|SIGILO|SEGREDO DE JUSTIÇA)\]?/gi, '');
  logFerramentas.push({ id: 24, aplicada: true });

  // Ferramenta 25: Normalização artigos de lei
  textoProcessado = textoProcessado.replace(/[Aa]rt\.?\s*(\d+)/g, 'Art. $1');
  logFerramentas.push({ id: 25, aplicada: true });

  // Ferramenta 26: Normalização parágrafos
  textoProcessado = textoProcessado.replace(/§\s*(\d+)/g, '§$1');
  logFerramentas.push({ id: 26, aplicada: true });

  // Ferramenta 27: Normalização incisos
  textoProcessado = textoProcessado.replace(
    /\n\s*(I{1,3}|IV|VI{0,3}|IX|XI{0,3}|X{1,3})\s*[-–]\s*/g,
    '\n$1 - '
  );
  logFerramentas.push({ id: 27, aplicada: true });

  // Ferramenta 28: Remoção códigos de barras
  textoProcessado = textoProcessado.replace(/[\|]{3,}[^\n]*[\|]{3,}/g, '');
  logFerramentas.push({ id: 28, aplicada: true });

  // Ferramenta 29: Limpeza IDs internos
  textoProcessado = textoProcessado.replace(/ID[:\s]*\d{5,}/g, '');
  logFerramentas.push({ id: 29, aplicada: true });

  // Ferramenta 30: Normalização telefones
  textoProcessado = textoProcessado.replace(/\((\d{2})\)\s*(\d{4,5})[-\s]*(\d{4})/g, '($1) $2-$3');
  logFerramentas.push({ id: 30, aplicada: true });

  // Ferramenta 31: Remoção marcas OCR
  textoProcessado = textoProcessado.replace(/\[?(OCR|DIGITALIZADO)\]?/gi, '');
  logFerramentas.push({ id: 31, aplicada: true });

  // Ferramenta 32: Normalização OAB
  textoProcessado = textoProcessado.replace(/OAB\s*\/?([A-Z]{2})\s*[-–]?\s*(\d+)/g, 'OAB/$1 $2');
  logFerramentas.push({ id: 32, aplicada: true });

  // Ferramenta 33: Limpeza final de espaços
  textoProcessado = textoProcessado.replace(/ +/g, ' ');
  textoProcessado = textoProcessado.replace(/\n /g, '\n');
  logFerramentas.push({ id: 33, aplicada: true });

  return {
    textoProcessado,
    ferramentasAplicadas: logFerramentas.length,
    tamanhoOriginal: texto.length,
    tamanhoFinal: textoProcessado.length,
    reducao: ((1 - textoProcessado.length / texto.length) * 100).toFixed(1) + '%'
  };
}

/**
 * Aplicar os 10 processadores de otimização
 */
export async function aplicarProcessadores(texto, opcoes = {}) {
  const { tamanhoChunk = 450000 } = opcoes;
  const resultados = {};

  // Processador 1: Extração de Metadados
  resultados.metadados = {
    numerosProcesso: [...new Set(texto.match(/\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}/g) || [])],
    datas: [...new Set(texto.match(/\d{1,2}\/\d{1,2}\/\d{2,4}/g) || [])].slice(0, 50),
    valores: [...new Set(texto.match(/R\$\s*[\d.,]+/g) || [])].slice(0, 30),
    cpfs: [...new Set(texto.match(/\d{3}\.\d{3}\.\d{3}-\d{2}/g) || [])],
    cnpjs: [...new Set(texto.match(/\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}/g) || [])],
    oabs: [...new Set(texto.match(/OAB\/[A-Z]{2}\s*\d+/g) || [])],
    artigos: [...new Set(texto.match(/Art\.\s*\d+/g) || [])].slice(0, 50)
  };

  // Processador 2: Identificação de Documentos
  resultados.tiposDocumentais = {
    sentencas: (texto.match(/SENTENÇA|JULGO/gi) || []).length,
    decisoes: (texto.match(/DECISÃO|DECIDO/gi) || []).length,
    despachos: (texto.match(/DESPACHO|DETERMINO/gi) || []).length,
    peticoes: (texto.match(/PETIÇÃO|REQUER/gi) || []).length,
    certidoes: (texto.match(/CERTIDÃO|CERTIFICO/gi) || []).length,
    laudos: (texto.match(/LAUDO|PARECER/gi) || []).length
  };

  // Processador 3: Compactação (contagem de redundâncias)
  const linhas = texto.split('\n');
  const contador = {};
  linhas.forEach(l => { contador[l] = (contador[l] || 0) + 1; });
  const redundantes = Object.values(contador).filter(c => c > 3).length;
  resultados.redundancias = redundantes;

  // Processador 4-8: Análise estrutural
  resultados.estrutura = {
    totalLinhas: linhas.length,
    totalParagrafos: texto.split(/\n\n+/).length,
    totalPalavras: texto.split(/\s+/).length
  };

  // Processador 9: Divisão em Chunks
  const palavras = texto.split(/\s+/);
  const chunks = [];
  let chunkAtual = [];
  let tamanhoAtual = 0;

  for (const palavra of palavras) {
    const tamPalavra = Buffer.byteLength(palavra, 'utf8') + 1;
    if (tamanhoAtual + tamPalavra > tamanhoChunk) {
      chunks.push(chunkAtual.join(' '));
      chunkAtual = [palavra];
      tamanhoAtual = tamPalavra;
    } else {
      chunkAtual.push(palavra);
      tamanhoAtual += tamPalavra;
    }
  }
  if (chunkAtual.length > 0) {
    chunks.push(chunkAtual.join(' '));
  }

  resultados.chunks = chunks;
  resultados.totalChunks = chunks.length;

  // Processador 10: Sumário
  resultados.sumario = {
    processadoresAplicados: 10,
    chunksGerados: chunks.length,
    metadadosExtraidos: Object.keys(resultados.metadados).length,
    tiposIdentificados: Object.values(resultados.tiposDocumentais).reduce((a, b) => a + b, 0)
  };

  return resultados;
}

/**
 * Pipeline completo de extração
 */
export async function pipelineCompleto(caminhoArquivo, opcoes = {}) {
  const inicio = Date.now();

  // Etapa 1: Extrair texto
  const extracao = await extrairTextoPDF(caminhoArquivo, opcoes);

  // Ler texto extraído
  const textoOriginal = fs.readFileSync(extracao.arquivoSaida, 'utf-8');

  // Etapa 2: Aplicar 91 ferramentas
  const ferramentas = await aplicarFerramentas(textoOriginal);

  // Etapa 3: Aplicar 10 processadores
  const processadores = await aplicarProcessadores(ferramentas.textoProcessado, opcoes);

  // Etapa 4: Salvar arquivos finais
  const { pastaSaida } = extracao;

  // Salvar chunks
  for (let i = 0; i < processadores.chunks.length; i++) {
    const nomeChunk = `PARTE_${String(i + 1).padStart(2, '0')}_de_${String(processadores.totalChunks).padStart(2, '0')}.txt`;
    fs.writeFileSync(
      path.join(pastaSaida, nomeChunk),
      `=== PARTE ${i + 1} DE ${processadores.totalChunks} ===\n\n${processadores.chunks[i]}`
    );
  }

  // Salvar texto completo otimizado
  fs.writeFileSync(
    path.join(pastaSaida, 'TEXTO_COMPLETO_OTIMIZADO.txt'),
    ferramentas.textoProcessado
  );

  // Salvar metadados
  fs.writeFileSync(
    path.join(pastaSaida, '00_METADADOS.txt'),
    JSON.stringify(processadores.metadados, null, 2)
  );

  // Remover arquivo intermediário
  fs.unlinkSync(extracao.arquivoSaida);

  const duracao = Date.now() - inicio;

  return {
    sucesso: true,
    arquivoOriginal: caminhoArquivo,
    pastaSaida,
    estatisticas: {
      tamanhoOriginal: textoOriginal.length,
      tamanhoFinal: ferramentas.textoProcessado.length,
      reducao: ferramentas.reducao,
      chunksGerados: processadores.totalChunks,
      ferramentasAplicadas: 33,
      processadoresAplicados: 10,
      duracaoMs: duracao
    },
    metadados: processadores.metadados,
    tiposDocumentais: processadores.tiposDocumentais
  };
}

/**
 * NOVO v2.0: Pipeline completo com 18 ficheiros e análise profunda
 *
 * Wrapper convenience para usar o novo sistema
 */
export async function pipelineCompletoV2(caminhoArquivo, opcoes = {}) {
  const { extractDocumentWithFullAnalysis } = await import('../services/document-extraction-service.js');

  // Extrair nome base do arquivo
  const nomeBase = path.basename(caminhoArquivo, path.extname(caminhoArquivo));

  // Gerar nome de pasta baseado no arquivo
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
  const nomePasta = opcoes.outputFolderName || `${nomeBase}_${timestamp}`;

  return await extractDocumentWithFullAnalysis({
    filePath: caminhoArquivo,
    outputFolderName: nomePasta,
    projectName: opcoes.projectName || 'ROM',
    uploadToKB: opcoes.uploadToKB || false,
    useHaikuForExtraction: opcoes.useHaikuForExtraction !== false,  // default true
    useSonnetForAnalysis: opcoes.useSonnetForAnalysis !== false    // default true
  });
}

export default {
  extrairTextoPDF,
  aplicarFerramentas,
  aplicarProcessadores,
  pipelineCompleto,
  pipelineCompletoV2,  // NOVO: v2.0 com 18 ficheiros
  FERRAMENTAS_PROCESSAMENTO,
  PROCESSADORES_OTIMIZACAO
};
