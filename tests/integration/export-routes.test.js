/**
 * Testes de Integração - Export Routes
 *
 * Testa os endpoints REST de exportação
 *
 * NOTA: Estes testes requerem que o servidor esteja rodando
 * Execute com: npm run test:integration
 */

import { describe, it, before } from 'node:test';
import assert from 'node:assert';
import { sampleLegalBrief, sampleJurisprudence } from '../fixtures/export-test-data.js';

const BASE_URL = process.env.TEST_SERVER_URL || 'http://localhost:3000';
const API_URL = `${BASE_URL}/api/export`;

// Helper para fazer requests
async function makeRequest(endpoint, data) {
  const response = await fetch(`${API_URL}${endpoint}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(data)
  });

  return response;
}

// Verifica se servidor está rodando
async function isServerRunning() {
  try {
    const response = await fetch(`${API_URL}/status`);
    return response.ok;
  } catch (error) {
    return false;
  }
}

// ============================================================
// TESTES DE STATUS DO SERVIÇO
// ============================================================

describe('Export Routes - Service Status', () => {
  it('GET /api/export/status deve retornar status operacional', async () => {
    const serverRunning = await isServerRunning();

    if (!serverRunning) {
      console.warn('⚠️  Servidor não está rodando - teste pulado');
      console.warn('   Execute: npm start (em outro terminal)');
      return;
    }

    const response = await fetch(`${API_URL}/status`);
    assert.strictEqual(response.ok, true);

    const data = await response.json();

    assert.strictEqual(data.service, 'export');
    assert.strictEqual(data.status, 'operational');
    assert.ok(Array.isArray(data.formats));
    assert.ok(data.formats.includes('docx'));
    assert.ok(data.formats.includes('pdf'));
    assert.ok(data.formats.includes('html'));
    assert.ok(data.formats.includes('markdown'));
    assert.ok(data.formats.includes('txt'));
    assert.ok(Array.isArray(data.templates));
    assert.strictEqual(typeof data.puppeteer, 'boolean');
  });
});

// ============================================================
// TESTES DE EXPORTAÇÃO TXT
// ============================================================

describe('Export Routes - TXT Export', () => {
  it('POST /api/export/txt deve exportar para TXT', async () => {
    if (!await isServerRunning()) {
      console.warn('⚠️  Servidor não está rodando - teste pulado');
      return;
    }

    const response = await makeRequest('/txt', {
      content: sampleLegalBrief.content,
      title: sampleLegalBrief.title,
      type: sampleLegalBrief.type,
      metadata: sampleLegalBrief.metadata
    });

    assert.strictEqual(response.ok, true);
    assert.strictEqual(response.headers.get('content-type'), 'text/plain; charset=utf-8');

    const text = await response.text();
    assert.ok(text.length > 0);
    assert.ok(text.includes('PETIÇÃO INICIAL'));
  });

  it('POST /api/export/txt sem conteúdo deve retornar erro 400', async () => {
    if (!await isServerRunning()) {
      console.warn('⚠️  Servidor não está rodando - teste pulado');
      return;
    }

    const response = await makeRequest('/txt', {
      title: 'Teste sem conteúdo'
      // content ausente
    });

    assert.strictEqual(response.status, 400);

    const data = await response.json();
    assert.ok(data.error);
  });
});

// ============================================================
// TESTES DE EXPORTAÇÃO MARKDOWN
// ============================================================

describe('Export Routes - Markdown Export', () => {
  it('POST /api/export/markdown deve exportar para Markdown', async () => {
    if (!await isServerRunning()) {
      console.warn('⚠️  Servidor não está rodando - teste pulado');
      return;
    }

    const response = await makeRequest('/markdown', {
      content: 'Conteúdo de teste',
      title: 'Documento Teste',
      metadata: {
        author: 'Autor Teste'
      }
    });

    assert.strictEqual(response.ok, true);
    assert.strictEqual(response.headers.get('content-type'), 'text/markdown; charset=utf-8');

    const markdown = await response.text();
    assert.ok(markdown.includes('# Documento Teste'));
    assert.ok(markdown.includes('**Autor:** Autor Teste'));
  });
});

// ============================================================
// TESTES DE EXPORTAÇÃO HTML
// ============================================================

describe('Export Routes - HTML Export', () => {
  it('POST /api/export/html deve exportar para HTML', async () => {
    if (!await isServerRunning()) {
      console.warn('⚠️  Servidor não está rodando - teste pulado');
      return;
    }

    const response = await makeRequest('/html', {
      content: '# Título\n\nConteúdo de teste',
      title: 'Documento HTML'
    });

    assert.strictEqual(response.ok, true);
    assert.strictEqual(response.headers.get('content-type'), 'text/html; charset=utf-8');

    const html = await response.text();
    assert.ok(html.includes('<!DOCTYPE html>'));
    assert.ok(html.includes('Documento HTML'));
  });
});

// ============================================================
// TESTES DE EXPORTAÇÃO DOCX
// ============================================================

describe('Export Routes - DOCX Export', () => {
  it('POST /api/export/docx deve exportar para Word', async () => {
    if (!await isServerRunning()) {
      console.warn('⚠️  Servidor não está rodando - teste pulado');
      return;
    }

    const response = await makeRequest('/docx', {
      content: sampleLegalBrief.content,
      title: sampleLegalBrief.title,
      type: sampleLegalBrief.type,
      metadata: sampleLegalBrief.metadata,
      template: 'oab'
    });

    assert.strictEqual(response.ok, true);
    assert.strictEqual(
      response.headers.get('content-type'),
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    );

    const buffer = await response.arrayBuffer();
    assert.ok(buffer.byteLength > 0);
    assert.ok(buffer.byteLength > 1000); // DOCX deve ter tamanho razoável
  });

  it('POST /api/export/docx com template ABNT', async () => {
    if (!await isServerRunning()) {
      console.warn('⚠️  Servidor não está rodando - teste pulado');
      return;
    }

    const response = await makeRequest('/docx', {
      content: 'Conteúdo acadêmico',
      title: 'Artigo Científico',
      template: 'abnt'
    });

    assert.strictEqual(response.ok, true);

    const buffer = await response.arrayBuffer();
    assert.ok(buffer.byteLength > 0);
  });
});

// ============================================================
// TESTES DE EXPORTAÇÃO PDF
// ============================================================

describe('Export Routes - PDF Export', () => {
  it('POST /api/export/pdf deve exportar para PDF', async function() {
    // PDF pode ser lento
    this.timeout = 30000;

    if (!await isServerRunning()) {
      console.warn('⚠️  Servidor não está rodando - teste pulado');
      return;
    }

    const response = await makeRequest('/pdf', {
      content: sampleJurisprudence.content,
      title: sampleJurisprudence.title,
      type: sampleJurisprudence.type,
      metadata: sampleJurisprudence.metadata,
      template: 'oab'
    });

    assert.strictEqual(response.ok, true);
    assert.strictEqual(response.headers.get('content-type'), 'application/pdf');

    const buffer = await response.arrayBuffer();
    assert.ok(buffer.byteLength > 0);

    // Verifica assinatura PDF
    const view = new Uint8Array(buffer);
    const header = String.fromCharCode(...view.slice(0, 4));
    assert.strictEqual(header, '%PDF');
  });
});

// ============================================================
// TESTES DE ENDPOINT GENÉRICO
// ============================================================

describe('Export Routes - Generic Endpoint', () => {
  it('POST /api/export/:format deve aceitar qualquer formato válido', async () => {
    if (!await isServerRunning()) {
      console.warn('⚠️  Servidor não está rodando - teste pulado');
      return;
    }

    const formats = ['txt', 'markdown', 'html'];

    for (const format of formats) {
      const response = await makeRequest(`/${format}`, {
        content: 'Teste genérico',
        title: `Teste ${format.toUpperCase()}`
      });

      assert.strictEqual(response.ok, true, `Formato ${format} falhou`);
    }
  });

  it('POST /api/export/invalid deve retornar erro 400', async () => {
    if (!await isServerRunning()) {
      console.warn('⚠️  Servidor não está rodando - teste pulado');
      return;
    }

    const response = await makeRequest('/invalid_format', {
      content: 'Teste',
      title: 'Teste'
    });

    assert.strictEqual(response.status, 400);

    const data = await response.json();
    assert.ok(data.error);
    assert.ok(data.details.includes('inválido'));
  });
});

// ============================================================
// TESTES DE VALIDAÇÃO
// ============================================================

describe('Export Routes - Validation', () => {
  it('deve rejeitar conteúdo muito grande (> 10MB)', async () => {
    if (!await isServerRunning()) {
      console.warn('⚠️  Servidor não está rodando - teste pulado');
      return;
    }

    const hugeContent = 'A'.repeat(11 * 1024 * 1024); // 11MB

    const response = await makeRequest('/txt', {
      content: hugeContent,
      title: 'Teste Grande'
    });

    assert.strictEqual(response.status, 413);

    const data = await response.json();
    assert.ok(data.error);
  });

  it('deve usar título padrão se não fornecido', async () => {
    if (!await isServerRunning()) {
      console.warn('⚠️  Servidor não está rodando - teste pulado');
      return;
    }

    const response = await makeRequest('/txt', {
      content: 'Teste sem título'
      // title ausente
    });

    assert.strictEqual(response.ok, true);
  });
});

// ============================================================
// TESTES DE HEADERS DE RESPOSTA
// ============================================================

describe('Export Routes - Response Headers', () => {
  it('deve incluir Content-Disposition com filename', async () => {
    if (!await isServerRunning()) {
      console.warn('⚠️  Servidor não está rodando - teste pulado');
      return;
    }

    const response = await makeRequest('/txt', {
      content: 'Teste',
      title: 'Meu Documento'
    });

    assert.strictEqual(response.ok, true);

    const disposition = response.headers.get('content-disposition');
    assert.ok(disposition);
    assert.ok(disposition.includes('attachment'));
    assert.ok(disposition.includes('filename'));
  });

  it('deve sanitizar nomes de arquivo', async () => {
    if (!await isServerRunning()) {
      console.warn('⚠️  Servidor não está rodando - teste pulado');
      return;
    }

    const response = await makeRequest('/txt', {
      content: 'Teste',
      title: 'Arquivo <com> "caracteres" inválidos/'
    });

    assert.strictEqual(response.ok, true);

    const disposition = response.headers.get('content-disposition');
    // Deve ter sanitizado os caracteres inválidos
    assert.ok(!disposition.includes('<'));
    assert.ok(!disposition.includes('>'));
  });
});

// ============================================================
// TESTES DE TEMPLATES
// ============================================================

describe('Export Routes - Templates', () => {
  const templates = ['oab', 'abnt', 'moderno', 'compacto', 'classico'];

  templates.forEach(template => {
    it(`deve aceitar template ${template}`, async () => {
      if (!await isServerRunning()) {
        console.warn('⚠️  Servidor não está rodando - teste pulado');
        return;
      }

      const response = await makeRequest('/html', {
        content: 'Teste de template',
        title: `Documento ${template}`,
        template
      });

      assert.strictEqual(response.ok, true);
    });
  });
});

// ============================================================
// TESTES DE PERFORMANCE
// ============================================================

describe('Export Routes - Performance', () => {
  it('deve responder TXT em menos de 1 segundo', async () => {
    if (!await isServerRunning()) {
      console.warn('⚠️  Servidor não está rodando - teste pulado');
      return;
    }

    const start = Date.now();

    const response = await makeRequest('/txt', {
      content: sampleLegalBrief.content,
      title: 'Performance Test'
    });

    const duration = Date.now() - start;

    assert.strictEqual(response.ok, true);
    assert.ok(duration < 1000, `Request levou ${duration}ms`);
  });

  it('deve responder Markdown em menos de 1 segundo', async () => {
    if (!await isServerRunning()) {
      console.warn('⚠️  Servidor não está rodando - teste pulado');
      return;
    }

    const start = Date.now();

    const response = await makeRequest('/markdown', {
      content: sampleLegalBrief.content,
      title: 'Performance Test'
    });

    const duration = Date.now() - start;

    assert.strictEqual(response.ok, true);
    assert.ok(duration < 1000, `Request levou ${duration}ms`);
  });
});

console.log('✅ Testes de integração das rotas de export carregados');
console.log('💡 Para executar, certifique-se de que o servidor está rodando em', BASE_URL);
