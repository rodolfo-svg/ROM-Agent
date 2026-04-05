import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const kbPath = path.join(__dirname, 'data', 'kb-documents.json');

if (fs.existsSync(kbPath)) {
  const docs = JSON.parse(fs.readFileSync(kbPath, 'utf8'));
  console.log('📊 Total documentos no KB:', docs.length);
  console.log('');

  // Mostrar primeiros 5 documentos
  docs.slice(0, 5).forEach((doc, i) => {
    console.log(`Documento ${i+1}:`);
    console.log('  Nome:', doc.name);
    console.log('  userId:', doc.userId || 'UNDEFINED');
    console.log('  uploadedAt:', doc.uploadedAt);
    console.log('');
  });

  // Estatisticas de userId
  const comUserId = docs.filter(d => d.userId).length;
  const semUserId = docs.filter(d => !d.userId).length;
  console.log('📈 Estatísticas userId:');
  console.log('  Com userId:', comUserId);
  console.log('  Sem userId:', semUserId);

  // Mostrar userIds únicos
  const userIds = [...new Set(docs.map(d => d.userId).filter(Boolean))];
  console.log('  UserIds únicos:', userIds);
} else {
  console.log('❌ Arquivo kb-documents.json não encontrado');
}
