# 🔧 CORREÇÃO DO EXTRATOR DE DOCUMENTOS

**Data:** 17/12/2025
**Problema:** Duplicação de documentos + Falta de segmentação de peças processuais
**Impacto:** CRÍTICO - KB inoperante para análise jurídica

---

## 🔴 PROBLEMAS IDENTIFICADOS (Confirmados pelo Usuário)

### 1. Duplicação de Documentos
**Sintoma:**
- 3 cópias idênticas de "processo íntegra Castilho.pdf"
- Todos com mesmo conteúdo (2.079k caracteres cada)
- Tipo: "Não identificado"

**Causa Raiz:**
- Falta de hash MD5/SHA256 para deduplicação
- Sem verificação de duplicatas antes de indexar
- Upload múltiplo do mesmo arquivo

### 2. Sem Segmentação de Peças Processuais
**Sintoma:**
- Sistema indexa apenas o PDF completo
- NÃO gera documentos individuais:
  - ❌ Petição inicial
  - ❌ Contestação
  - ❌ Decisões/sentenças
  - ❌ Manifestações
  - ❌ Índice de peças

**Causa Raiz:**
- Extrator não identifica seções do processo
- Falta parser de estrutura processual
- Sem classificação automática de documentos

### 3. Tipo "Não Identificado"
**Sintoma:**
- Documentos sem classificação de tipo
- Metadados incompletos

**Causa Raiz:**
- Parser não reconhece tipos jurídicos
- Falta de regras de classificação

---

## ✅ SOLUÇÃO PROPOSTA

### MÓDULO 1: Sistema de Deduplicação
```javascript
// lib/document-deduplicator.js

import crypto from 'crypto';

export class DocumentDeduplicator {
  constructor() {
    this.hashCache = new Map(); // hash -> docId
  }

  /**
   * Calcular hash SHA256 do conteúdo
   */
  calculateHash(content) {
    return crypto
      .createHash('sha256')
      .update(content)
      .digest('hex');
  }

  /**
   * Verificar se documento já existe
   */
  isDuplicate(content) {
    const hash = this.calculateHash(content);
    return this.hashCache.has(hash);
  }

  /**
   * Registrar documento
   */
  register(docId, content) {
    const hash = this.calculateHash(content);
    this.hashCache.set(hash, docId);
    return hash;
  }

  /**
   * Obter documento original de uma duplicata
   */
  getOriginal(content) {
    const hash = this.calculateHash(content);
    return this.hashCache.get(hash);
  }
}
```

### MÓDULO 2: Segmentador de Peças Processuais
```javascript
// lib/process-segmenter.js

export class ProcessSegmenter {
  constructor() {
    // Padrões para identificar início de peças
    this.patterns = {
      peticaoInicial: [
        /EXCELENT[IÍ]SSIMO.*JUIZ/i,
        /PETIC[AÃ]O INICIAL/i,
        /VEM.*PRESENC[AÇ]A.*PROPOR/i
      ],
      contestacao: [
        /CONTESTAC[AÃ]O/i,
        /DEFESA/i,
        /VEM.*CONTESTAR/i
      ],
      decisao: [
        /SENTENC[AÇ]A/i,
        /DECISAO.*INTERLOCUT[OÓ]RIA/i,
        /DESPACHO/i,
        /AC[OÓ]RD[AÃ]O/i
      ],
      manifestacao: [
        /MANIFESTAC[AÃ]O/i,
        /R[ÉE]PLICA/i,
        /IMPUGNAC[AÃ]O/i,
        /MEMORIAIS/i
      ],
      recurso: [
        /RECURSO/i,
        /APELAC[AÃ]O/i,
        /AGRAVO/i,
        /EMBARGOS/i
      ]
    };
  }

  /**
   * Detectar tipo de documento
   */
  detectType(text) {
    const firstPage = text.substring(0, 5000); // Primeiros 5k chars

    for (const [tipo, patterns] of Object.entries(this.patterns)) {
      if (patterns.some(pattern => pattern.test(firstPage))) {
        return tipo;
      }
    }

    return 'documento_generico';
  }

  /**
   * Segmentar processo em peças individuais
   */
  segment(fullText) {
    const pieces = [];
    const lines = fullText.split('\n');

    let currentPiece = null;
    let currentContent = [];
    let pieceNumber = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Detectar início de nova peça
      const detectedType = this.detectTypeFromLine(line);

      if (detectedType && currentPiece) {
        // Salvar peça anterior
        pieces.push({
          number: pieceNumber++,
          type: currentPiece,
          content: currentContent.join('\n'),
          startLine: currentPiece.startLine,
          endLine: i - 1
        });

        // Iniciar nova peça
        currentPiece = { type: detectedType, startLine: i };
        currentContent = [line];
      } else if (detectedType && !currentPiece) {
        // Primeira peça
        currentPiece = { type: detectedType, startLine: i };
        currentContent = [line];
      } else if (currentPiece) {
        // Continuar peça atual
        currentContent.push(line);
      }
    }

    // Salvar última peça
    if (currentPiece && currentContent.length > 0) {
      pieces.push({
        number: pieceNumber++,
        type: currentPiece.type,
        content: currentContent.join('\n'),
        startLine: currentPiece.startLine,
        endLine: lines.length - 1
      });
    }

    return pieces;
  }

  /**
   * Detectar tipo de peça a partir de uma linha
   */
  detectTypeFromLine(line) {
    for (const [tipo, patterns] of Object.entries(this.patterns)) {
      if (patterns.some(pattern => pattern.test(line))) {
        return tipo;
      }
    }
    return null;
  }

  /**
   * Gerar índice de peças
   */
  generateIndex(pieces) {
    return {
      totalPieces: pieces.length,
      pieces: pieces.map(p => ({
        number: p.number,
        type: p.type,
        startLine: p.startLine,
        endLine: p.endLine,
        size: p.content.length,
        preview: p.content.substring(0, 200)
      }))
    };
  }
}
```

### MÓDULO 3: Classificador Automático
```javascript
// lib/document-classifier.js

export class DocumentClassifier {
  /**
   * Classificar documento baseado em conteúdo e nome
   */
  classify(doc) {
    const { name, extractedText } = doc;
    const nameLower = name.toLowerCase();
    const textSample = (extractedText || '').substring(0, 10000).toLowerCase();

    // Classificações por nome
    if (nameLower.includes('petição') || nameLower.includes('peticao')) {
      return 'Petição';
    }
    if (nameLower.includes('sentença') || nameLower.includes('sentenca')) {
      return 'Sentença';
    }
    if (nameLower.includes('acórdão') || nameLower.includes('acordao')) {
      return 'Acórdão';
    }
    if (nameLower.includes('contestação') || nameLower.includes('contestacao')) {
      return 'Contestação';
    }
    if (nameLower.includes('decisão') || nameLower.includes('decisao')) {
      return 'Decisão';
    }
    if (nameLower.includes('recurso')) {
      return 'Recurso';
    }
    if (nameLower.includes('embargos')) {
      return 'Embargos';
    }
    if (nameLower.includes('manifesta')) {
      return 'Manifestação';
    }

    // Classificações por conteúdo
    if (textSample.includes('excelentíssimo') && textSample.includes('requer')) {
      return 'Petição';
    }
    if (textSample.includes('isto posto') || textSample.includes('dispositivo')) {
      return 'Sentença/Decisão';
    }
    if (textSample.includes('vistos') && textSample.includes('relatados')) {
      return 'Acórdão';
    }
    if (textSample.includes('não conhecer') || textSample.includes('dar provimento')) {
      return 'Acórdão';
    }

    // Padrão: verificar se é processo completo
    if (textSample.includes('processo') && textSample.includes('íntegra')) {
      return 'Processo Completo';
    }

    return 'Documento Jurídico';
  }

  /**
   * Extrair metadados do documento
   */
  extractMetadata(extractedText) {
    const metadata = {};

    // Número do processo
    const processMatch = extractedText.match(/\d{7}-?\d{2}\.?\d{4}\.?\d\.?\d{2}\.?\d{4}/);
    if (processMatch) {
      metadata.processNumber = processMatch[0];
    }

    // Partes
    const parteMatch = extractedText.match(/(?:Autor|Requerente):\s*([^\n]+)/i);
    if (parteMatch) {
      metadata.autor = parteMatch[1].trim();
    }

    const reuMatch = extractedText.match(/(?:Réu|Requerido):\s*([^\n]+)/i);
    if (reuMatch) {
      metadata.reu = reuMatch[1].trim();
    }

    // Juízo
    const juizoMatch = extractedText.match(/(?:Juízo|Vara):\s*([^\n]+)/i);
    if (juizoMatch) {
      metadata.juizo = juizoMatch[1].trim();
    }

    // Valor da causa
    const valorMatch = extractedText.match(/Valor\s*da\s*causa:\s*R\$\s*([\d.,]+)/i);
    if (valorMatch) {
      metadata.valorCausa = valorMatch[1];
    }

    // Data de distribuição
    const dataMatch = extractedText.match(/Distribu[íi][çd]o.*?(\d{2}\/\d{2}\/\d{4})/i);
    if (dataMatch) {
      metadata.dataDistribuicao = dataMatch[1];
    }

    return metadata;
  }
}
```

---

## 🔧 INTEGRAÇÃO NO SISTEMA EXISTENTE

### Passo 1: Modificar upload de documentos
```javascript
// Em src/server-enhanced.js ou onde faz upload

import { DocumentDeduplicator } from '../lib/document-deduplicator.js';
import { ProcessSegmenter } from '../lib/process-segmenter.js';
import { DocumentClassifier } from '../lib/document-classifier.js';

const deduplicator = new DocumentDeduplicator();
const segmenter = new ProcessSegmenter();
const classifier = new DocumentClassifier();

async function processUploadedDocument(file, extractedText) {
  // 1. Verificar duplicação
  if (deduplicator.isDuplicate(extractedText)) {
    const originalId = deduplicator.getOriginal(extractedText);
    console.log(`⚠️ Documento duplicado - referência ao original: ${originalId}`);
    return {
      isDuplicate: true,
      originalId,
      message: 'Documento já existe no sistema'
    };
  }

  // 2. Classificar documento
  const documentType = classifier.classify({ name: file.name, extractedText });

  // 3. Extrair metadados
  const metadata = classifier.extractMetadata(extractedText);

  // 4. Segmentar se for processo completo
  let pieces = [];
  if (documentType === 'Processo Completo') {
    pieces = segmenter.segment(extractedText);
    console.log(`📄 Processo segmentado em ${pieces.length} peças`);
  }

  // 5. Registrar documento
  const docId = generateDocumentId();
  const hash = deduplicator.register(docId, extractedText);

  // 6. Salvar no KB
  const documents = [];

  if (pieces.length > 0) {
    // Salvar processo completo + peças individuais
    documents.push({
      id: docId,
      name: file.name,
      type: documentType,
      extractedText,
      metadata: { ...metadata, hash, isPrimaryDocument: true },
      uploadedAt: new Date(),
      textLength: extractedText.length
    });

    // Salvar cada peça separadamente
    pieces.forEach((piece, idx) => {
      documents.push({
        id: `${docId}_piece_${idx}`,
        name: `${file.name} - ${piece.type} (${idx + 1})`,
        type: piece.type,
        extractedText: piece.content,
        metadata: {
          ...metadata,
          parentDocumentId: docId,
          pieceNumber: piece.number,
          startLine: piece.startLine,
          endLine: piece.endLine
        },
        uploadedAt: new Date(),
        textLength: piece.content.length
      });
    });

    // Salvar índice
    documents.push({
      id: `${docId}_index`,
      name: `${file.name} - Índice de Peças`,
      type: 'Índice',
      extractedText: JSON.stringify(segmenter.generateIndex(pieces), null, 2),
      metadata: {
        ...metadata,
        parentDocumentId: docId,
        isIndex: true
      },
      uploadedAt: new Date()
    });

  } else {
    // Documento simples
    documents.push({
      id: docId,
      name: file.name,
      type: documentType,
      extractedText,
      metadata: { ...metadata, hash },
      uploadedAt: new Date(),
      textLength: extractedText.length
    });
  }

  return {
    success: true,
    documents,
    message: `${documents.length} documento(s) indexado(s) com sucesso`
  };
}
```

---

## 🧪 TESTE DE VALIDAÇÃO

```javascript
// test-document-processing.js

import { DocumentDeduplicator } from './lib/document-deduplicator.js';
import { ProcessSegmenter } from './lib/process-segmenter.js';
import { DocumentClassifier } from './lib/document-classifier.js';

async function testSystem() {
  const deduplicator = new DocumentDeduplicator();
  const segmenter = new ProcessSegmenter();
  const classifier = new DocumentClassifier();

  // Teste 1: Deduplicação
  const content1 = "Conteúdo do processo...";
  const content2 = "Conteúdo do processo..."; // Duplicata
  const content3 = "Outro processo...";

  console.log('=== TESTE 1: DEDUPLICAÇÃO ===');
  console.log('Doc 1 é duplicado?', deduplicator.isDuplicate(content1)); // false
  deduplicator.register('doc1', content1);
  console.log('Doc 2 é duplicado?', deduplicator.isDuplicate(content2)); // true
  console.log('Doc 3 é duplicado?', deduplicator.isDuplicate(content3)); // false

  // Teste 2: Classificação
  console.log('\n=== TESTE 2: CLASSIFICAÇÃO ===');
  const doc1 = { name: 'petição inicial.pdf', extractedText: 'EXCELENTÍSSIMO SENHOR...' };
  const doc2 = { name: 'processo íntegra Castilho.pdf', extractedText: 'Processo 5362905-58...' };
  console.log('Tipo doc1:', classifier.classify(doc1)); // "Petição"
  console.log('Tipo doc2:', classifier.classify(doc2)); // "Processo Completo"

  // Teste 3: Segmentação
  console.log('\n=== TESTE 3: SEGMENTAÇÃO ===');
  const processoCompleto = `
EXCELENTÍSSIMO SENHOR DOUTOR JUIZ...
PETIÇÃO INICIAL
...

CONTESTAÇÃO
O réu vem...

SENTENÇA
ISTO POSTO...
  `;
  const pieces = segmenter.segment(processoCompleto);
  console.log(`Peças encontradas: ${pieces.length}`);
  pieces.forEach(p => {
    console.log(`- ${p.type}: ${p.content.length} caracteres`);
  });

  console.log('\n✅ TESTES CONCLUÍDOS');
}

testSystem();
```

---

## ✅ RESULTADO ESPERADO

**ANTES (PROBLEMA):**
```
KB Castilho:
- processo íntegra Castilho.pdf (cópia 1) - 2.079k chars - Tipo: Não identificado
- processo íntegra Castilho.pdf (cópia 2) - 2.079k chars - Tipo: Não identificado
- processo íntegra Castilho.pdf (cópia 3) - 2.079k chars - Tipo: Não identificado
Total: 3 documentos (todos duplicados)
```

**DEPOIS (CORRIGIDO):**
```
KB Castilho:
- processo íntegra Castilho.pdf - 2.079k chars - Tipo: Processo Completo ✅
  ├── Petição Inicial - 450k chars - Tipo: Petição ✅
  ├── Contestação - 380k chars - Tipo: Contestação ✅
  ├── Decisão Interlocutória - 120k chars - Tipo: Decisão ✅
  ├── Sentença - 280k chars - Tipo: Sentença ✅
  ├── Manifestação Autor - 150k chars - Tipo: Manifestação ✅
  └── Índice de Peças - 5k chars - Tipo: Índice ✅
Total: 7 documentos (1 original + 5 peças + 1 índice)
```

---

## 🚀 PRÓXIMOS PASSOS

1. **Criar os 3 módulos** (deduplicador, segmentador, classificador)
2. **Integrar no upload** (modificar endpoint de upload)
3. **Limpar KB atual** (remover duplicatas existentes)
4. **Re-indexar Processo Castilho** (com nova lógica)
5. **Testar consulta KB** (validar que retorna peças individuais)
6. **Deploy e validação** (usuário testa com caso real)

---

**STATUS:** Solução projetada - Aguardando aprovação para implementar
**Tempo estimado:** 1-2 horas de implementação
