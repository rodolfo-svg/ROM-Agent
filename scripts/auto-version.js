#!/usr/bin/env node
/**
 * AUTO-VERSIONAMENTO
 * Garante que a versão no package.json sempre reflete o código atual
 * Roda automaticamente antes de git push
 */

import fs from 'fs/promises';
import { execSync } from 'child_process';

const VERSION_FILE = './package.json';
const SERVER_FILE = './src/server-enhanced.js';

async function getFeatureCount() {
  try {
    const content = await fs.readFile(SERVER_FILE, 'utf-8');

    // Contar endpoints
    const endpoints = (content.match(/app\.(get|post|put|delete|patch)\(/g) || []).length;

    // Detectar features principais
    const features = {
      chat: content.includes('/api/chat'),
      projects: content.includes('/api/projects'),
      pricing: content.includes('/api/pricing'),
      upload: content.includes('/api/upload/chunked'),
      team: content.includes('/api/team'),
      datajud: content.includes('datajud'),
      websearch: content.includes('web-search'),
      correction: content.includes('language/correct')
    };

    const featureCount = Object.values(features).filter(Boolean).length;

    return { endpoints, features, featureCount };
  } catch (error) {
    console.error('❌ Erro ao analisar features:', error.message);
    return { endpoints: 0, features: {}, featureCount: 0 };
  }
}

async function calculateVersion() {
  const { endpoints, featureCount } = await getFeatureCount();

  // Versão baseada em features
  // Major: sempre 2 (v2)
  // Minor: número de features principais (8 features = 2.8)
  // Patch: número de endpoints / 10 (113 endpoints = .11)

  const major = 2;
  const minor = featureCount;
  const patch = Math.floor(endpoints / 10);

  return `${major}.${minor}.${patch}`;
}

async function updateVersion() {
  try {
    // Ler package.json
    const pkgContent = await fs.readFile(VERSION_FILE, 'utf-8');
    const pkg = JSON.parse(pkgContent);

    // Calcular nova versão
    const newVersion = await calculateVersion();
    const oldVersion = pkg.version;

    // Se versão mudou, atualizar
    if (newVersion !== oldVersion) {
      console.log(`📦 Atualizando versão: ${oldVersion} → ${newVersion}`);

      pkg.version = newVersion;

      await fs.writeFile(
        VERSION_FILE,
        JSON.stringify(pkg, null, 2) + '\n',
        'utf-8'
      );

      // Add package.json ao git
      execSync('git add package.json', { stdio: 'inherit' });

      console.log('✅ Versão atualizada automaticamente');
      return true;
    } else {
      console.log(`✅ Versão já está correta: ${oldVersion}`);
      return false;
    }
  } catch (error) {
    console.error('❌ Erro ao atualizar versão:', error.message);
    return false;
  }
}

async function verifyServerFile() {
  try {
    await fs.access(SERVER_FILE);
    return true;
  } catch {
    console.error('❌ ERRO: src/server-enhanced.js não encontrado!');
    return false;
  }
}

// Executar
console.log('🔍 Verificando versão do sistema...\n');

if (await verifyServerFile()) {
  const updated = await updateVersion();
  const { endpoints, featureCount } = await getFeatureCount();

  console.log(`\n📊 Status do Sistema:`);
  console.log(`   - Features: ${featureCount}`);
  console.log(`   - Endpoints: ${endpoints}`);
  console.log(`   - Versão: ${await calculateVersion()}`);

  if (updated) {
    console.log('\n⚠️  VERSÃO ATUALIZADA - Commit necessário');
    process.exit(1); // Força re-add antes do push
  } else {
    console.log('\n✅ Sistema pronto para deploy');
    process.exit(0);
  }
} else {
  process.exit(1);
}
