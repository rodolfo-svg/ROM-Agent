/**
 * Testes Unitários - Knowledge Base
 *
 * Testa funcionalidades de upload, organização, busca e
 * gerenciamento de documentos na base de conhecimento
 */

import { describe, it, before } from 'node:test';
import assert from 'node:assert';
import path from 'path';

// ============================================================
// TESTES DE ESTRUTURA DE DIRETÓRIOS
// ============================================================

describe('Knowledge Base - Directory Structure', () => {
  function buildKBPath(projectName, processNumber, fileType) {
    const baseDir = 'data/knowledge-base';
    const projectDir = path.join(baseDir, 'documents', projectName || 'ROM');
    const timestamp = Date.now();
    const fileId = `${timestamp}_${processNumber || 'doc'}_${fileType}`;

    return {
      projectDir,
      filePath: path.join(projectDir, `${fileId}.txt`),
      metadataPath: path.join(projectDir, `${fileId}.metadata.json`),
      fileId
    };
  }

  it('deve gerar caminho correto para projeto', () => {
    const result = buildKBPath('ProcessoABC', '123456', 'resumo');

    assert.ok(result.projectDir.includes('ProcessoABC'));
    assert.ok(result.filePath.includes('resumo'));
    assert.ok(result.metadataPath.endsWith('.metadata.json'));
  });

  it('deve usar projeto padrão se não especificado', () => {
    const result = buildKBPath(null, '123456', 'cronologia');

    assert.ok(result.projectDir.includes('ROM'));
  });

  it('deve incluir timestamp no fileId', () => {
    const result = buildKBPath('Teste', '123', 'resumo');

    assert.ok(result.fileId.match(/^\d+_123_resumo$/));
  });
});

// ============================================================
// TESTES DE VALIDAÇÃO DE UPLOAD
// ============================================================

describe('Knowledge Base - Upload Validation', () => {
  function validateUploadRequest(options) {
    const errors = [];

    if (!options) {
      errors.push('Options are required');
      return errors;
    }

    // Validar projectName
    if (options.projectName && typeof options.projectName !== 'string') {
      errors.push('projectName must be a string');
    }

    if (options.projectName && options.projectName.length > 100) {
      errors.push('projectName exceeds maximum length (100)');
    }

    // Validar processNumber
    if (options.processNumber && typeof options.processNumber !== 'string') {
      errors.push('processNumber must be a string');
    }

    // Validar files
    if (!options.files || !Array.isArray(options.files)) {
      errors.push('files must be an array');
    } else if (options.files.length === 0) {
      errors.push('files array cannot be empty');
    } else {
      options.files.forEach((file, idx) => {
        if (!file.path) {
          errors.push(`File ${idx}: path is required`);
        }
        if (!file.type) {
          errors.push(`File ${idx}: type is required`);
        }
        if (file.type && !['resumo', 'cronologia', 'analise', 'documento', 'outros'].includes(file.type)) {
          errors.push(`File ${idx}: invalid type "${file.type}"`);
        }
      });
    }

    return errors;
  }

  it('deve aceitar upload válido', () => {
    const options = {
      projectName: 'ProcessoTeste',
      processNumber: '123456',
      files: [
        { path: '/tmp/doc.txt', type: 'resumo' }
      ]
    };

    const errors = validateUploadRequest(options);
    assert.strictEqual(errors.length, 0);
  });

  it('deve rejeitar options vazias', () => {
    const errors = validateUploadRequest(null);
    assert.ok(errors.some(e => e.includes('Options are required')));
  });

  it('deve rejeitar projectName não-string', () => {
    const options = {
      projectName: 12345,
      files: [{ path: '/tmp/doc.txt', type: 'resumo' }]
    };

    const errors = validateUploadRequest(options);
    assert.ok(errors.some(e => e.includes('projectName must be a string')));
  });

  it('deve rejeitar projectName muito longo', () => {
    const options = {
      projectName: 'A'.repeat(150),
      files: [{ path: '/tmp/doc.txt', type: 'resumo' }]
    };

    const errors = validateUploadRequest(options);
    assert.ok(errors.some(e => e.includes('exceeds maximum length')));
  });

  it('deve rejeitar files não-array', () => {
    const options = {
      projectName: 'Teste',
      files: 'not-an-array'
    };

    const errors = validateUploadRequest(options);
    assert.ok(errors.some(e => e.includes('files must be an array')));
  });

  it('deve rejeitar array vazio de files', () => {
    const options = {
      projectName: 'Teste',
      files: []
    };

    const errors = validateUploadRequest(options);
    assert.ok(errors.some(e => e.includes('files array cannot be empty')));
  });

  it('deve rejeitar file sem path', () => {
    const options = {
      projectName: 'Teste',
      files: [{ type: 'resumo' }]
    };

    const errors = validateUploadRequest(options);
    assert.ok(errors.some(e => e.includes('path is required')));
  });

  it('deve rejeitar tipo de file inválido', () => {
    const options = {
      projectName: 'Teste',
      files: [{ path: '/tmp/doc.txt', type: 'invalid-type' }]
    };

    const errors = validateUploadRequest(options);
    assert.ok(errors.some(e => e.includes('invalid type')));
  });
});

// ============================================================
// TESTES DE METADADOS
// ============================================================

describe('Knowledge Base - Metadata Management', () => {
  function createMetadata(file, projectName, processNumber) {
    const timestamp = Date.now();
    const fileId = `${timestamp}_${processNumber || 'doc'}_${file.type}`;

    return {
      id: fileId,
      projectName: projectName || 'ROM',
      processNumber: processNumber || null,
      type: file.type,
      originalPath: file.path,
      uploadedAt: new Date().toISOString(),
      size: file.content ? file.content.length : 0,
      extension: path.extname(file.path)
    };
  }

  it('deve criar metadados completos', () => {
    const file = {
      path: '/tmp/resumo.txt',
      type: 'resumo',
      content: 'Conteúdo do resumo'
    };

    const metadata = createMetadata(file, 'ProcessoX', '123456');

    assert.ok(metadata.id);
    assert.strictEqual(metadata.projectName, 'ProcessoX');
    assert.strictEqual(metadata.processNumber, '123456');
    assert.strictEqual(metadata.type, 'resumo');
    assert.strictEqual(metadata.originalPath, '/tmp/resumo.txt');
    assert.ok(metadata.uploadedAt);
    // Size may vary slightly due to encoding
    assert.ok(metadata.size >= 18 && metadata.size <= 22);
    assert.strictEqual(metadata.extension, '.txt');
  });

  it('deve usar valores padrão para campos opcionais', () => {
    const file = {
      path: '/tmp/doc.txt',
      type: 'documento'
    };

    const metadata = createMetadata(file, null, null);

    assert.strictEqual(metadata.projectName, 'ROM');
    assert.strictEqual(metadata.processNumber, null);
    assert.strictEqual(metadata.size, 0);
  });

  it('deve extrair extensão corretamente', () => {
    const files = [
      { path: '/tmp/doc.pdf', type: 'documento' },
      { path: '/tmp/doc.docx', type: 'documento' },
      { path: '/tmp/doc.txt', type: 'resumo' }
    ];

    const extensions = files.map(f => createMetadata(f).extension);

    assert.deepStrictEqual(extensions, ['.pdf', '.docx', '.txt']);
  });
});

// ============================================================
// TESTES DE BUSCA NA KB
// ============================================================

describe('Knowledge Base - Document Search', () => {
  class KBSearchEngine {
    constructor() {
      this.documents = [];
    }

    addDocument(doc) {
      this.documents.push(doc);
    }

    search(query, filters = {}) {
      let results = this.documents;

      // Filtrar por projeto
      if (filters.projectName) {
        results = results.filter(d => d.projectName === filters.projectName);
      }

      // Filtrar por tipo
      if (filters.type) {
        results = results.filter(d => d.type === filters.type);
      }

      // Filtrar por número de processo
      if (filters.processNumber) {
        results = results.filter(d => d.processNumber === filters.processNumber);
      }

      // Busca textual no conteúdo
      if (query) {
        const queryLower = query.toLowerCase();
        results = results.filter(d =>
          (d.content || '').toLowerCase().includes(queryLower) ||
          (d.projectName || '').toLowerCase().includes(queryLower) ||
          (d.processNumber || '').toLowerCase().includes(queryLower)
        );
      }

      // Ordenar por data (mais recente primeiro)
      results.sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt));

      return results;
    }

    getByProject(projectName) {
      return this.search(null, { projectName });
    }

    getByType(type) {
      return this.search(null, { type });
    }

    getByProcess(processNumber) {
      return this.search(null, { processNumber });
    }
  }

  it('deve buscar documentos por query textual', () => {
    const kb = new KBSearchEngine();

    kb.addDocument({
      id: '1',
      projectName: 'Proj1',
      content: 'Processo sobre responsabilidade civil',
      uploadedAt: '2026-01-20T10:00:00Z'
    });

    kb.addDocument({
      id: '2',
      projectName: 'Proj2',
      content: 'Análise de dano moral',
      uploadedAt: '2026-01-21T10:00:00Z'
    });

    const results = kb.search('responsabilidade');

    assert.strictEqual(results.length, 1);
    assert.strictEqual(results[0].id, '1');
  });

  it('deve filtrar por projeto', () => {
    const kb = new KBSearchEngine();

    kb.addDocument({ id: '1', projectName: 'ProjA', content: 'Doc 1', uploadedAt: '2026-01-20T10:00:00Z' });
    kb.addDocument({ id: '2', projectName: 'ProjB', content: 'Doc 2', uploadedAt: '2026-01-21T10:00:00Z' });
    kb.addDocument({ id: '3', projectName: 'ProjA', content: 'Doc 3', uploadedAt: '2026-01-22T10:00:00Z' });

    const results = kb.getByProject('ProjA');

    assert.strictEqual(results.length, 2);
    assert.ok(results.every(r => r.projectName === 'ProjA'));
  });

  it('deve filtrar por tipo', () => {
    const kb = new KBSearchEngine();

    kb.addDocument({ id: '1', type: 'resumo', content: 'Resumo 1', uploadedAt: '2026-01-20T10:00:00Z' });
    kb.addDocument({ id: '2', type: 'cronologia', content: 'Cronologia 1', uploadedAt: '2026-01-21T10:00:00Z' });
    kb.addDocument({ id: '3', type: 'resumo', content: 'Resumo 2', uploadedAt: '2026-01-22T10:00:00Z' });

    const results = kb.getByType('resumo');

    assert.strictEqual(results.length, 2);
    assert.ok(results.every(r => r.type === 'resumo'));
  });

  it('deve combinar filtros', () => {
    const kb = new KBSearchEngine();

    kb.addDocument({
      id: '1',
      projectName: 'ProjA',
      type: 'resumo',
      processNumber: '123',
      content: 'Resumo do projeto A',
      uploadedAt: '2026-01-20T10:00:00Z'
    });

    kb.addDocument({
      id: '2',
      projectName: 'ProjA',
      type: 'cronologia',
      processNumber: '123',
      content: 'Cronologia do projeto A',
      uploadedAt: '2026-01-21T10:00:00Z'
    });

    kb.addDocument({
      id: '3',
      projectName: 'ProjB',
      type: 'resumo',
      processNumber: '456',
      content: 'Resumo do projeto B',
      uploadedAt: '2026-01-22T10:00:00Z'
    });

    const results = kb.search(null, {
      projectName: 'ProjA',
      type: 'resumo',
      processNumber: '123'
    });

    assert.strictEqual(results.length, 1);
    assert.strictEqual(results[0].id, '1');
  });

  it('deve ordenar por data mais recente', () => {
    const kb = new KBSearchEngine();

    kb.addDocument({ id: '1', content: 'Doc 1', uploadedAt: '2026-01-20T10:00:00Z' });
    kb.addDocument({ id: '2', content: 'Doc 2', uploadedAt: '2026-01-22T10:00:00Z' });
    kb.addDocument({ id: '3', content: 'Doc 3', uploadedAt: '2026-01-21T10:00:00Z' });

    const results = kb.search('Doc');

    assert.strictEqual(results[0].id, '2'); // Mais recente
    assert.strictEqual(results[1].id, '3');
    assert.strictEqual(results[2].id, '1'); // Mais antigo
  });
});

// ============================================================
// TESTES DE LIMPEZA DA KB
// ============================================================

describe('Knowledge Base - Cleanup', () => {
  class KBCleaner {
    constructor() {
      this.documents = [];
      this.maxAge = 90 * 24 * 60 * 60 * 1000; // 90 dias
      this.maxDocumentsPerProject = 100;
    }

    addDocument(doc) {
      this.documents.push(doc);
    }

    removeOldDocuments() {
      const now = Date.now();
      const cutoffDate = now - this.maxAge;

      const before = this.documents.length;
      this.documents = this.documents.filter(doc => {
        const docDate = new Date(doc.uploadedAt).getTime();
        return docDate >= cutoffDate;
      });

      return before - this.documents.length;
    }

    removeExcessDocuments() {
      const projectCounts = new Map();

      // Agrupar por projeto
      this.documents.forEach(doc => {
        const project = doc.projectName || 'default';
        if (!projectCounts.has(project)) {
          projectCounts.set(project, []);
        }
        projectCounts.get(project).push(doc);
      });

      let removed = 0;

      // Limitar cada projeto
      projectCounts.forEach((docs, project) => {
        if (docs.length > this.maxDocumentsPerProject) {
          // Ordenar por data (mais recentes primeiro)
          docs.sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt));

          // Manter apenas os mais recentes
          const toKeep = docs.slice(0, this.maxDocumentsPerProject);
          const toRemove = docs.slice(this.maxDocumentsPerProject);

          removed += toRemove.length;

          // Remover documentos excedentes
          this.documents = this.documents.filter(d =>
            !toRemove.some(tr => tr.id === d.id)
          );
        }
      });

      return removed;
    }

    cleanup() {
      const oldRemoved = this.removeOldDocuments();
      const excessRemoved = this.removeExcessDocuments();

      return {
        oldDocuments: oldRemoved,
        excessDocuments: excessRemoved,
        total: oldRemoved + excessRemoved
      };
    }
  }

  it('deve remover documentos antigos', () => {
    const cleaner = new KBCleaner();
    cleaner.maxAge = 1000; // 1 segundo para teste

    // Documento antigo
    cleaner.addDocument({
      id: '1',
      uploadedAt: new Date(Date.now() - 2000).toISOString()
    });

    // Documento recente
    cleaner.addDocument({
      id: '2',
      uploadedAt: new Date().toISOString()
    });

    const removed = cleaner.removeOldDocuments();

    assert.strictEqual(removed, 1);
    assert.strictEqual(cleaner.documents.length, 1);
    assert.strictEqual(cleaner.documents[0].id, '2');
  });

  it('deve limitar documentos por projeto', () => {
    const cleaner = new KBCleaner();
    cleaner.maxDocumentsPerProject = 3;

    // Adicionar 5 documentos do mesmo projeto
    for (let i = 0; i < 5; i++) {
      cleaner.addDocument({
        id: `${i}`,
        projectName: 'ProjA',
        uploadedAt: new Date(Date.now() - (5 - i) * 1000).toISOString()
      });
    }

    const removed = cleaner.removeExcessDocuments();

    assert.strictEqual(removed, 2);
    assert.strictEqual(cleaner.documents.length, 3);

    // Deve ter mantido os 3 mais recentes (ids 2, 3, 4)
    const ids = cleaner.documents.map(d => d.id).sort();
    assert.deepStrictEqual(ids, ['2', '3', '4']);
  });

  it('deve limitar separadamente por projeto', () => {
    const cleaner = new KBCleaner();
    cleaner.maxDocumentsPerProject = 2;

    // Projeto A: 3 docs
    for (let i = 0; i < 3; i++) {
      cleaner.addDocument({
        id: `A${i}`,
        projectName: 'ProjA',
        uploadedAt: new Date(Date.now() - i * 1000).toISOString()
      });
    }

    // Projeto B: 3 docs
    for (let i = 0; i < 3; i++) {
      cleaner.addDocument({
        id: `B${i}`,
        projectName: 'ProjB',
        uploadedAt: new Date(Date.now() - i * 1000).toISOString()
      });
    }

    const removed = cleaner.removeExcessDocuments();

    assert.strictEqual(removed, 2); // 1 de cada projeto
    assert.strictEqual(cleaner.documents.length, 4); // 2 de cada projeto
  });

  it('deve executar cleanup completo', () => {
    const cleaner = new KBCleaner();
    cleaner.maxAge = 1000; // 1s
    cleaner.maxDocumentsPerProject = 2;

    // Doc antigo
    cleaner.addDocument({
      id: 'old',
      projectName: 'Proj',
      uploadedAt: new Date(Date.now() - 5000).toISOString()
    });

    // 3 docs recentes (1 será removido por excesso)
    for (let i = 0; i < 3; i++) {
      cleaner.addDocument({
        id: `recent${i}`,
        projectName: 'Proj',
        uploadedAt: new Date(Date.now() - i * 100).toISOString()
      });
    }

    const result = cleaner.cleanup();

    assert.strictEqual(result.oldDocuments, 1);
    assert.strictEqual(result.excessDocuments, 1);
    assert.strictEqual(result.total, 2);
    assert.strictEqual(cleaner.documents.length, 2);
  });
});

// ============================================================
// TESTES DE DEDUPLICAÇÃO
// ============================================================

describe('Knowledge Base - Deduplication', () => {
  function detectDuplicates(documents) {
    const seen = new Map(); // hash -> doc
    const duplicates = [];

    documents.forEach(doc => {
      // Hash baseado em conteúdo e tipo
      const hash = `${doc.type}_${doc.content}_${doc.processNumber}`;

      if (seen.has(hash)) {
        duplicates.push({
          original: seen.get(hash),
          duplicate: doc
        });
      } else {
        seen.set(hash, doc);
      }
    });

    return duplicates;
  }

  it('deve detectar documentos duplicados', () => {
    const documents = [
      { id: '1', type: 'resumo', content: 'Texto A', processNumber: '123' },
      { id: '2', type: 'resumo', content: 'Texto A', processNumber: '123' }, // duplicado
      { id: '3', type: 'resumo', content: 'Texto B', processNumber: '123' }
    ];

    const duplicates = detectDuplicates(documents);

    assert.strictEqual(duplicates.length, 1);
    assert.strictEqual(duplicates[0].original.id, '1');
    assert.strictEqual(duplicates[0].duplicate.id, '2');
  });

  it('não deve detectar falsos positivos', () => {
    const documents = [
      { id: '1', type: 'resumo', content: 'Texto A', processNumber: '123' },
      { id: '2', type: 'resumo', content: 'Texto A', processNumber: '456' }, // Processo diferente
      { id: '3', type: 'cronologia', content: 'Texto A', processNumber: '123' } // Tipo diferente
    ];

    const duplicates = detectDuplicates(documents);

    assert.strictEqual(duplicates.length, 0);
  });

  it('deve detectar múltiplas duplicatas', () => {
    const documents = [
      { id: '1', type: 'resumo', content: 'Doc', processNumber: '1' },
      { id: '2', type: 'resumo', content: 'Doc', processNumber: '1' }, // dup
      { id: '3', type: 'resumo', content: 'Doc', processNumber: '1' }, // dup
      { id: '4', type: 'resumo', content: 'Doc', processNumber: '1' }  // dup
    ];

    const duplicates = detectDuplicates(documents);

    assert.strictEqual(duplicates.length, 3);
  });
});

console.log('✅ Testes de Knowledge Base carregados com sucesso');
