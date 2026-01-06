#!/usr/bin/env node

/**
 * Garante que o frontend está buildado antes de iniciar o servidor
 * Roda automaticamente antes do startCommand
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dirname, '..');
const frontendDir = path.join(projectRoot, 'frontend');
const distDir = path.join(frontendDir, 'dist');
const indexHtmlPath = path.join(distDir, 'index.html');

console.log('🔍 Verificando build do frontend...');
console.log(`   Frontend: ${frontendDir}`);
console.log(`   Dist: ${distDir}`);

// Verificar se frontend/dist existe e tem index.html
const needsBuild = !fs.existsSync(distDir) || !fs.existsSync(indexHtmlPath);

if (needsBuild) {
  console.log('🏗️  Frontend precisa ser buildado!');
  console.log('');

  try {
    // Entrar na pasta frontend
    process.chdir(frontendDir);
    console.log(`📂 Entrando em: ${frontendDir}`);

    // Instalar dependências
    console.log('📦 Instalando dependências do frontend...');
    execSync('npm ci', { stdio: 'inherit' });

    // Buildar
    console.log('🔨 Buildando frontend...');
    execSync('npm run build', { stdio: 'inherit' });

    // Voltar para raiz
    process.chdir(projectRoot);

    // Verificar se build foi bem-sucedido
    if (fs.existsSync(indexHtmlPath)) {
      const assetsDir = path.join(distDir, 'assets');
      const jsFiles = fs.existsSync(assetsDir)
        ? fs.readdirSync(assetsDir).filter(f => f.endsWith('.js'))
        : [];

      console.log('');
      console.log('✅ Frontend buildado com sucesso!');
      console.log(`   📁 ${distDir}`);
      console.log(`   📄 ${jsFiles.length} arquivos JS gerados`);
      console.log('');
    } else {
      throw new Error('Build falhou - index.html não foi gerado');
    }
  } catch (error) {
    console.error('');
    console.error('❌ Erro ao buildar frontend:');
    console.error(error.message);
    console.error('');
    process.exit(1);
  }
} else {
  // Verificar se build está atualizado
  const assetsDir = path.join(distDir, 'assets');
  const jsFiles = fs.existsSync(assetsDir)
    ? fs.readdirSync(assetsDir).filter(f => f.endsWith('.js'))
    : [];

  console.log('✅ Frontend já está buildado');
  console.log(`   📁 ${distDir}`);
  console.log(`   📄 ${jsFiles.length} arquivos JS`);
  console.log('');
}
