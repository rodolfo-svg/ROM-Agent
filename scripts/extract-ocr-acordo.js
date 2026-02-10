import fs from 'fs';
import { extractTextFromPDF } from '../src/modules/textract.js';

async function extractWithOCR() {
  const pdfPath = '/Users/rodolfootaviopereiradamotaoliveira/Desktop/Sandro Lobo/acordoassinado08.08.23.pdf';
  const outputPath = '/Users/rodolfootaviopereiradamotaoliveira/Desktop/Sandro Lobo/acordoassinado08.08.23_OCR_COMPLETO.txt';
  
  console.log('🔍 Iniciando extração com OCR...');
  console.log('📄 Arquivo:', pdfPath);
  
  try {
    // Extrair texto (OCR automático se necessário)
    const texto = await extractTextFromPDF(pdfPath);
    
    console.log('✅ Extração concluída!');
    console.log('📊 Caracteres extraídos:', texto.length);
    console.log('📊 Linhas:', texto.split('\n').length);
    
    // Salvar texto completo
    fs.writeFileSync(outputPath, texto, 'utf-8');
    console.log('💾 Texto salvo em:', outputPath);
    
    // Mostrar preview
    console.log('\n' + '='.repeat(70));
    console.log('PREVIEW (primeiras 50 linhas):');
    console.log('='.repeat(70));
    console.log(texto.split('\n').slice(0, 50).join('\n'));
    console.log('\n' + '='.repeat(70));
    console.log('... [texto completo salvo no arquivo]');
    console.log('='.repeat(70));
    
  } catch (erro) {
    console.error('❌ Erro na extração:', erro.message);
    process.exit(1);
  }
}

extractWithOCR();
