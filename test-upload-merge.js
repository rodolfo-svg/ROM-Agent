#!/usr/bin/env node
/**
 * Test script for chunked upload + merge
 * Tests the 10-minute timeout fix
 */

import https from 'https';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import FormData from 'form-data';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const API_BASE = 'https://rom-agent-ia.onrender.com';
const CHUNK_SIZE = 40 * 1024 * 1024; // 40MB

// Test files
const TEST_FILES = [
  '/Users/rodolfootaviopereiradamotaoliveira/Desktop/I4 Motors/Report01774896048819_OCR.pdf',
  '/Users/rodolfootaviopereiradamotaoliveira/Desktop/I4 Motors/Report01775045279900_OCR.pdf',
  '/Users/rodolfootaviopereiradamotaoliveira/Desktop/Clientes/Pneuaco/Agravos_Resp/PDFs_Processo/Parte 2 pneuaço.pdf',
  '/Users/rodolfootaviopereiradamotaoliveira/Desktop/Clientes/Pneuaco/Agravos_Resp/PDFs_Processo/Petição - AResp 985.486 GO.pdf'
];

let cookies = '';

// Helper to make HTTP requests
function makeRequest(url, options, data = null) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const isHttps = urlObj.protocol === 'https:';
    const lib = isHttps ? https : http;

    const req = lib.request(url, options, (res) => {
      let body = '';

      // Capture cookies
      if (res.headers['set-cookie']) {
        cookies = res.headers['set-cookie'].map(c => c.split(';')[0]).join('; ');
      }

      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: body
        });
      });
    });

    req.on('error', reject);

    if (data) {
      if (data.pipe) {
        data.pipe(req);
      } else {
        req.write(data);
        req.end();
      }
    } else {
      req.end();
    }
  });
}

// Step 1: Register test user
async function registerUser() {
  console.log('\n📝 [1/7] Registrando usuário de teste...');

  const userData = JSON.stringify({
    email: 'test-upload@rom.adv.br',
    password: 'TestUpload2026!@#',
    name: 'Test Upload User',
    oab: 'SP123456'
  });

  try {
    const response = await makeRequest(`${API_BASE}/api/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(userData)
      }
    }, userData);

    const result = JSON.parse(response.body);

    if (response.statusCode === 201 || response.statusCode === 400) {
      console.log('✅ Usuário criado ou já existe');
      return true;
    } else {
      console.log(`⚠️ Status: ${response.statusCode}`, result);
      return true; // Continue anyway
    }
  } catch (error) {
    console.error('❌ Erro ao registrar:', error.message);
    return false;
  }
}

// Step 2: Login
async function login() {
  console.log('\n🔐 [2/7] Fazendo login...');

  const loginData = JSON.stringify({
    email: 'test-upload@rom.adv.br',
    password: 'TestUpload2026!@#'
  });

  try {
    const response = await makeRequest(`${API_BASE}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(loginData)
      }
    }, loginData);

    const result = JSON.parse(response.body);

    if (response.statusCode === 200) {
      console.log('✅ Login bem-sucedido');
      console.log('🍪 Cookies:', cookies.substring(0, 50) + '...');
      return true;
    } else {
      console.log(`❌ Falha no login: ${response.statusCode}`, result);
      return false;
    }
  } catch (error) {
    console.error('❌ Erro no login:', error.message);
    return false;
  }
}

// Step 3-6: Upload files with chunking
async function uploadFile(filePath, fileIndex) {
  const fileName = path.basename(filePath);
  const fileSize = fs.statSync(filePath).size;
  const sizeMB = (fileSize / 1024 / 1024).toFixed(2);

  console.log(`\n📤 [${3 + fileIndex}/7] Upload ${fileIndex + 1}/4: ${fileName} (${sizeMB}MB)`);

  // For files >80MB, use chunked upload
  if (fileSize > 80 * 1024 * 1024) {
    return await uploadChunked(filePath, fileName, fileSize);
  } else {
    // Direct upload for smaller files
    return await uploadDirect(filePath, fileName);
  }
}

async function uploadChunked(filePath, fileName, fileSize) {
  const uploadId = `test_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const totalChunks = Math.ceil(fileSize / CHUNK_SIZE);

  console.log(`   📦 Upload chunked: ${totalChunks} chunks de ${CHUNK_SIZE / 1024 / 1024}MB`);

  const uploadedPaths = [];

  for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
    const start = chunkIndex * CHUNK_SIZE;
    const end = Math.min(start + CHUNK_SIZE, fileSize);
    const chunkSize = end - start;

    const readStream = fs.createReadStream(filePath, { start, end: end - 1 });

    const form = new FormData();
    form.append('chunk', readStream, {
      filename: fileName,
      contentType: 'application/pdf'
    });
    form.append('uploadId', uploadId);
    form.append('chunkIndex', chunkIndex.toString());
    form.append('totalChunks', totalChunks.toString());
    form.append('fileName', fileName);

    try {
      const response = await makeRequest(`${API_BASE}/api/chunked-upload/chunk`, {
        method: 'POST',
        headers: {
          ...form.getHeaders(),
          'Cookie': cookies
        }
      }, form);

      const result = JSON.parse(response.body);

      if (response.statusCode === 200 && result.success) {
        console.log(`   ✅ Chunk ${chunkIndex + 1}/${totalChunks} enviado (${(chunkSize / 1024 / 1024).toFixed(2)}MB)`);

        if (result.filePath) {
          uploadedPaths.push(result.filePath);
        }
      } else {
        console.log(`   ❌ Falha chunk ${chunkIndex + 1}: ${response.statusCode}`, result);
        return null;
      }
    } catch (error) {
      console.error(`   ❌ Erro chunk ${chunkIndex + 1}:`, error.message);
      return null;
    }
  }

  console.log(`   ✅ Upload chunked completo: ${uploadedPaths.length} path(s)`);
  return uploadedPaths.length > 0 ? uploadedPaths[uploadedPaths.length - 1] : null;
}

async function uploadDirect(filePath, fileName) {
  const form = new FormData();
  form.append('files', fs.createReadStream(filePath), {
    filename: fileName,
    contentType: 'application/pdf'
  });

  try {
    const response = await makeRequest(`${API_BASE}/api/kb/merge-volumes`, {
      method: 'POST',
      headers: {
        ...form.getHeaders(),
        'Cookie': cookies
      }
    }, form);

    const result = JSON.parse(response.body);

    if (response.statusCode === 200 && result.success) {
      console.log(`   ✅ Upload direto completo: ${result.filePath}`);
      return result.filePath;
    } else {
      console.log(`   ❌ Falha upload direto: ${response.statusCode}`, result);
      return null;
    }
  } catch (error) {
    console.error(`   ❌ Erro upload direto:`, error.message);
    return null;
  }
}

// Step 7: Merge volumes
async function mergeVolumes(uploadedPaths) {
  console.log('\n🔀 [7/7] Executando merge dos volumes...');
  console.log(`   📁 Total de arquivos: ${uploadedPaths.length}`);

  const mergeData = JSON.stringify({
    paths: uploadedPaths,
    processName: 'Test Merge - 4 PDFs Large'
  });

  const startTime = Date.now();

  try {
    const response = await makeRequest(`${API_BASE}/api/kb/merge-volumes/from-paths`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(mergeData),
        'Cookie': cookies
      }
    }, mergeData);

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
    const result = JSON.parse(response.body);

    if (response.statusCode === 200 && result.success) {
      console.log(`   ✅ Merge completo em ${elapsed}s`);
      console.log(`   📄 Arquivo final: ${result.filePath}`);
      console.log(`   📊 Páginas: ${result.totalPages}`);
      console.log(`   💾 Tamanho: ${(result.fileSize / 1024 / 1024).toFixed(2)}MB`);
      return true;
    } else {
      console.log(`   ❌ Falha no merge após ${elapsed}s: ${response.statusCode}`, result);
      return false;
    }
  } catch (error) {
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
    console.error(`   ❌ Erro no merge após ${elapsed}s:`, error.message);
    return false;
  }
}

// Main execution
async function main() {
  console.log('═'.repeat(70));
  console.log('🧪 TESTE DE UPLOAD CHUNKED + MERGE (Validação Timeout 10min)');
  console.log('═'.repeat(70));

  // Check files exist
  console.log('\n📋 Arquivos de teste:');
  const validFiles = [];
  for (const file of TEST_FILES) {
    if (fs.existsSync(file)) {
      const size = fs.statSync(file).size;
      const sizeMB = (size / 1024 / 1024).toFixed(2);
      console.log(`   ✅ ${path.basename(file)} (${sizeMB}MB)`);
      validFiles.push(file);
    } else {
      console.log(`   ❌ Não encontrado: ${path.basename(file)}`);
    }
  }

  if (validFiles.length === 0) {
    console.log('\n❌ Nenhum arquivo válido encontrado');
    process.exit(1);
  }

  const totalSize = validFiles.reduce((sum, file) => sum + fs.statSync(file).size, 0);
  console.log(`\n📊 Total: ${validFiles.length} arquivos, ${(totalSize / 1024 / 1024).toFixed(2)}MB`);

  // Step 1: Register
  if (!await registerUser()) {
    console.log('\n❌ Falha ao registrar usuário');
    process.exit(1);
  }

  // Step 2: Login
  if (!await login()) {
    console.log('\n❌ Falha ao fazer login');
    process.exit(1);
  }

  // Step 3-6: Upload files
  const uploadedPaths = [];
  for (let i = 0; i < validFiles.length; i++) {
    const filePath = await uploadFile(validFiles[i], i);
    if (filePath) {
      uploadedPaths.push(filePath);
    } else {
      console.log(`\n❌ Falha no upload do arquivo ${i + 1}`);
    }
  }

  if (uploadedPaths.length === 0) {
    console.log('\n❌ Nenhum arquivo foi enviado com sucesso');
    process.exit(1);
  }

  console.log(`\n✅ ${uploadedPaths.length}/${validFiles.length} arquivos enviados`);

  // Step 7: Merge
  const mergeSuccess = await mergeVolumes(uploadedPaths);

  console.log('\n' + '═'.repeat(70));
  if (mergeSuccess) {
    console.log('✅ TESTE CONCLUÍDO COM SUCESSO');
    console.log('✅ Timeout de 10min funcionou corretamente');
  } else {
    console.log('❌ TESTE FALHOU');
    console.log('⚠️  Verificar logs do Render para detalhes');
  }
  console.log('═'.repeat(70));
}

main().catch(error => {
  console.error('\n💥 Erro fatal:', error);
  process.exit(1);
});
