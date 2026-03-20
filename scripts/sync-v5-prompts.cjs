#!/usr/bin/env node

/**
 * Script para sincronizar prompts V5.0 para o disco persistente
 * Copia apenas os arquivos V5.0 que ainda não existem no destino
 */

const fs = require('fs');
const path = require('path');

const SOURCE_DIR = path.join(__dirname, '../data/prompts/global');
const DEST_DIR = process.env.RENDER ? '/var/data/prompts/global' : SOURCE_DIR;

console.log('═══════════════════════════════════════════════════════════');
console.log('🔄 SINCRONIZANDO PROMPTS V5.0');
console.log('═══════════════════════════════════════════════════════════\n');

console.log(`📂 Origem: ${SOURCE_DIR}`);
console.log(`📂 Destino: ${DEST_DIR}`);
console.log('');

if (SOURCE_DIR === DEST_DIR) {
  console.log('⚠️  Ambiente local detectado - sincronização não necessária');
  process.exit(0);
}

try {
  // Criar diretório de destino se não existir
  if (!fs.existsSync(DEST_DIR)) {
    fs.mkdirSync(DEST_DIR, { recursive: true });
    console.log('✅ Diretório criado');
  }

  // Listar arquivos V5.0 na origem
  const sourceFiles = fs.readdirSync(SOURCE_DIR)
    .filter(f => f.includes('V5') && f.endsWith('.md'));

  console.log(`📊 Encontrados ${sourceFiles.length} arquivos V5.0 na origem\n`);

  let copied = 0;
  let skipped = 0;
  let errors = 0;

  for (const file of sourceFiles) {
    const sourcePath = path.join(SOURCE_DIR, file);
    const destPath = path.join(DEST_DIR, file);

    try {
      // Verificar se arquivo já existe no destino
      if (fs.existsSync(destPath)) {
        // Comparar tamanhos para decidir se atualiza
        const sourceSize = fs.statSync(sourcePath).size;
        const destSize = fs.statSync(destPath).size;

        if (sourceSize === destSize) {
          skipped++;
          console.log(`⏭️  ${file} (já existe, mesmo tamanho)`);
          continue;
        } else {
          console.log(`🔄 ${file} (atualizando: ${destSize} → ${sourceSize} bytes)`);
        }
      } else {
        console.log(`✅ ${file} (novo)`);
      }

      // Copiar arquivo
      fs.copyFileSync(sourcePath, destPath);
      copied++;

    } catch (error) {
      console.error(`❌ ${file}: ${error.message}`);
      errors++;
    }
  }

  console.log('');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('📊 RESUMO DA SINCRONIZAÇÃO');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`✅ Copiados/Atualizados: ${copied}`);
  console.log(`⏭️  Ignorados (iguais): ${skipped}`);
  console.log(`❌ Erros: ${errors}`);
  console.log(`📁 Total no destino: ${fs.readdirSync(DEST_DIR).filter(f => f.endsWith('.md')).length}`);
  console.log('═══════════════════════════════════════════════════════════\n');

  if (errors > 0) {
    process.exit(1);
  }

} catch (error) {
  console.error('❌ ERRO FATAL:', error.message);
  process.exit(1);
}
