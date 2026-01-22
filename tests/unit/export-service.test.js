/**
 * Testes Unitários - Export Service
 *
 * Testa todas as funcionalidades do serviço de exportação
 */

import { describe, it, before } from 'node:test';
import assert from 'node:assert';
import { createRequire } from 'module';
import {
  sampleLegalBrief,
  sampleJurisprudence,
  sampleAnalysis,
  sampleContract,
  sampleGeneric,
  getFixture,
  getAllFixtures
} from '../fixtures/export-test-data.js';

// Import do serviço a ser testado
const require = createRequire(import.meta.url);
let ExportService;

before(async () => {
  // Carrega o módulo dinamicamente
  const module = await import('../../src/services/export-service.js');
  ExportService = module.default;
});

// ============================================================
// TESTES DE DETECÇÃO DE TIPO DE CONTEÚDO
// ============================================================

describe('ExportService - Content Type Detection', () => {
  it('deve detectar legal_brief (petição)', () => {
    const content = 'EXCELENTÍSSIMO SENHOR DOUTOR JUIZ DE DIREITO';
    const type = ExportService.detectContentType(content, 'generic');
    assert.strictEqual(type, 'legal_brief');
  });

  it('deve detectar legal_brief por REQUERENTE', () => {
    const content = 'REQUERENTE: João da Silva\nREQUERIDO: Empresa XYZ';
    const type = ExportService.detectContentType(content, 'generic');
    assert.strictEqual(type, 'legal_brief');
  });

  it('deve detectar jurisprudence (jurisprudência)', () => {
    const content = 'STJ - REsp 1.234.567\nRelator: Min. João Silva\nEmenta: Direito Civil';
    const type = ExportService.detectContentType(content, 'generic');
    assert.strictEqual(type, 'jurisprudence');
  });

  it('deve detectar analysis (análise processual)', () => {
    const content = 'Layer 1: Identificação\nAnálise do processo 123456\nTimeline processual';
    const type = ExportService.detectContentType(content, 'generic');
    assert.strictEqual(type, 'analysis');
  });

  it('deve detectar contract (contrato)', () => {
    const content = 'CLÁUSULA PRIMEIRA\nCONTRATANTE: Fulano\nCONTRATADO: Ciclano';
    const type = ExportService.detectContentType(content, 'generic');
    assert.strictEqual(type, 'contract');
  });

  it('deve retornar hint quando fornecido', () => {
    const content = 'Conteúdo qualquer';
    const type = ExportService.detectContentType(content, 'legal_brief');
    assert.strictEqual(type, 'legal_brief');
  });

  it('deve retornar generic para conteúdo sem padrão', () => {
    const content = 'Apenas um texto simples sem padrões específicos';
    const type = ExportService.detectContentType(content, 'generic');
    assert.strictEqual(type, 'generic');
  });
});

// ============================================================
// TESTES DE FORMATAÇÃO POR TIPO
// ============================================================

describe('ExportService - Content Formatting', () => {
  it('deve formatar legal_brief com partes em maiúsculas', () => {
    const formatted = ExportService.formatLegalBrief(sampleLegalBrief.content);
    assert.ok(formatted.includes('**REQUERENTE:'));
    assert.ok(formatted.includes('**REQUERIDO:'));
  });

  it('deve formatar case_analysis com layers', () => {
    const formatted = ExportService.formatCaseAnalysis(sampleAnalysis.content);
    // Verifica se aplicou formatação de layers
    assert.ok(formatted.length > 0);
  });

  it('deve formatar contract com cláusulas', () => {
    const formatted = ExportService.formatContract(sampleContract.content);
    assert.ok(formatted.includes('CLÁUSULA'));
  });
});

// ============================================================
// TESTES DE APLICAÇÃO DE TEMPLATES ABNT
// ============================================================

describe('ExportService - ABNT Template Application', () => {
  it('deve aplicar template OAB por padrão', () => {
    const result = ExportService.applyABNTTemplate('Conteúdo teste');
    assert.ok(result.template);
    assert.ok(result.docxConfig);
    assert.ok(result.css);
    assert.strictEqual(result.content, 'Conteúdo teste');
  });

  it('deve aplicar template ABNT quando solicitado', () => {
    const result = ExportService.applyABNTTemplate('Conteúdo teste', 'abnt');
    assert.ok(result.template);
  });

  it('deve usar OAB como fallback para template inválido', () => {
    const result = ExportService.applyABNTTemplate('Conteúdo teste', 'inexistente');
    assert.ok(result.template);
  });
});

// ============================================================
// TESTES DE EXPORTAÇÃO TXT
// ============================================================

describe('ExportService - TXT Export', () => {
  it('deve exportar TXT sem formatação Markdown', async () => {
    const result = await ExportService.export({
      content: '# Título\n\n**Negrito** e *itálico*',
      format: 'txt',
      title: 'Teste TXT'
    });

    assert.ok(typeof result === 'string');
    assert.ok(!result.includes('#'));
    assert.ok(!result.includes('**'));
    assert.ok(!result.includes('*'));
    assert.ok(result.includes('Título'));
  });

  it('deve remover links Markdown', async () => {
    const result = await ExportService.export({
      content: '[Link](https://example.com)',
      format: 'txt',
      title: 'Teste Links'
    });

    assert.ok(result.includes('Link'));
    assert.ok(!result.includes('https://'));
  });

  it('deve remover tags HTML', async () => {
    const result = await ExportService.export({
      content: '<p>Parágrafo</p><strong>Negrito</strong>',
      format: 'txt',
      title: 'Teste HTML'
    });

    assert.ok(result.includes('Parágrafo'));
    assert.ok(result.includes('Negrito'));
    assert.ok(!result.includes('<p>'));
    assert.ok(!result.includes('</p>'));
  });
});

// ============================================================
// TESTES DE EXPORTAÇÃO MARKDOWN
// ============================================================

describe('ExportService - Markdown Export', () => {
  it('deve exportar Markdown com metadados', async () => {
    const result = await ExportService.export({
      content: 'Conteúdo teste',
      format: 'markdown',
      title: 'Documento Teste',
      metadata: {
        author: 'Autor Teste',
        date: new Date('2026-01-21')
      }
    });

    assert.ok(typeof result === 'string');
    assert.ok(result.includes('# Documento Teste'));
    assert.ok(result.includes('**Autor:** Autor Teste'));
    assert.ok(result.includes('**Data:**'));
    assert.ok(result.includes('ROM Agent'));
  });

  it('deve incluir tribunal se for jurisprudência', async () => {
    const result = await ExportService.export({
      content: sampleJurisprudence.content,
      format: 'markdown',
      title: sampleJurisprudence.title,
      type: 'jurisprudence',
      metadata: sampleJurisprudence.metadata
    });

    assert.ok(result.includes('**Tribunal:**'));
  });

  it('deve incluir separador horizontal', async () => {
    const result = await ExportService.export({
      content: 'Teste',
      format: 'markdown',
      title: 'Teste'
    });

    assert.ok(result.includes('---'));
  });
});

// ============================================================
// TESTES DE EXPORTAÇÃO HTML
// ============================================================

describe('ExportService - HTML Export', () => {
  it('deve exportar HTML válido', async () => {
    const result = await ExportService.export({
      content: '# Título\n\nParágrafo de teste',
      format: 'html',
      title: 'Documento HTML'
    });

    assert.ok(typeof result === 'string');
    assert.ok(result.includes('<!DOCTYPE html>'));
    assert.ok(result.includes('<html lang="pt-BR">'));
    assert.ok(result.includes('</html>'));
  });

  it('deve incluir CSS ABNT', async () => {
    const result = await ExportService.export({
      content: 'Teste',
      format: 'html',
      title: 'Teste CSS',
      template: 'oab'
    });

    assert.ok(result.includes('<style>'));
    assert.ok(result.includes('</style>'));
  });

  it('deve converter Markdown para HTML', async () => {
    const result = await ExportService.export({
      content: '# Título\n\n**Negrito**',
      format: 'html',
      title: 'Teste Markdown'
    });

    assert.ok(result.includes('<h1>'));
    assert.ok(result.includes('<strong>'));
  });

  it('deve incluir metadados quando fornecidos', async () => {
    const result = await ExportService.export({
      content: 'Conteúdo',
      format: 'html',
      title: 'Teste Metadados',
      metadata: {
        author: 'Autor Teste',
        date: new Date('2026-01-21')
      }
    });

    assert.ok(result.includes('Autor Teste'));
  });

  it('deve incluir rodapé com ROM Agent', async () => {
    const result = await ExportService.export({
      content: 'Teste',
      format: 'html',
      title: 'Teste Footer'
    });

    assert.ok(result.includes('ROM Agent'));
  });
});

// ============================================================
// TESTES DE HELPERS
// ============================================================

describe('ExportService - Helper Functions', () => {
  it('stripFormatting deve remover formatação', () => {
    const input = '# Título\n**Negrito** e *itálico*';
    const output = ExportService.stripFormatting(input);

    assert.ok(!output.includes('#'));
    assert.ok(!output.includes('**'));
    assert.ok(!output.includes('*'));
  });

  it('cssMargins deve formatar margens corretamente', () => {
    const margins = { top: 2.5, right: 2, bottom: 2.5, left: 3 };
    const css = ExportService.cssMargins(margins);

    assert.strictEqual(css, '2.5cm 2cm 2.5cm 3cm');
  });

  it('formatDate deve formatar data em pt-BR', () => {
    const date = new Date('2026-01-21T12:00:00Z');
    const formatted = ExportService.formatDate(date);

    // Verifica que retornou uma string de data válida
    assert.ok(typeof formatted === 'string');
    assert.ok(formatted.length > 0);
    // Deve conter ano
    assert.ok(formatted.includes('2026') || formatted.includes('26'));
  });

  it('formatDate deve aceitar string de data', () => {
    const formatted = ExportService.formatDate('2026-01-21');
    assert.ok(typeof formatted === 'string');
    assert.ok(formatted.length > 0);
  });

  it('formatDate deve retornar data atual se undefined', () => {
    const formatted = ExportService.formatDate();
    assert.ok(typeof formatted === 'string');
    assert.ok(formatted.length > 0);
  });

  it('buildHeader deve gerar HTML do header', () => {
    const header = ExportService.buildHeader({ title: 'Teste' });
    assert.ok(header.includes('Teste'));
    assert.ok(header.includes('<div'));
  });

  it('buildFooter deve incluir número de página', () => {
    const footer = ExportService.buildFooter({});
    assert.ok(footer.includes('pageNumber'));
    assert.ok(footer.includes('totalPages'));
    assert.ok(footer.includes('ROM Agent'));
  });
});

// ============================================================
// TESTES COM TODOS OS FIXTURES
// ============================================================

describe('ExportService - All Fixtures Integration', () => {
  const formats = ['txt', 'markdown', 'html'];

  getAllFixtures().forEach(fixture => {
    formats.forEach(format => {
      it(`deve exportar ${fixture.type} para ${format.toUpperCase()}`, async () => {
        const result = await ExportService.export({
          content: fixture.content,
          format,
          title: fixture.title,
          type: fixture.type,
          metadata: fixture.metadata
        });

        assert.ok(result);
        assert.ok(result.length > 0);

        if (format === 'html') {
          assert.ok(result.includes('<!DOCTYPE html>'));
        } else if (format === 'markdown') {
          assert.ok(result.includes(fixture.title));
        } else if (format === 'txt') {
          assert.ok(typeof result === 'string');
        }
      });
    });
  });
});

// ============================================================
// TESTES DE VALIDAÇÃO E ERROS
// ============================================================

describe('ExportService - Error Handling', () => {
  it('deve lançar erro para formato inválido', async () => {
    await assert.rejects(
      async () => {
        await ExportService.export({
          content: 'Teste',
          format: 'formato_invalido',
          title: 'Teste'
        });
      },
      {
        message: /Formato não suportado/
      }
    );
  });

  it('deve tratar markdown inválido gracefully', () => {
    const invalidMarkdown = '```unclosed code block';
    const html = ExportService.markdownToHTML(invalidMarkdown);

    // Deve retornar algo, mesmo que não seja perfeito
    assert.ok(typeof html === 'string');
  });
});

// ============================================================
// TESTES DE PERFORMANCE
// ============================================================

describe('ExportService - Performance', () => {
  it('deve exportar TXT rapidamente (< 100ms)', async () => {
    const start = Date.now();

    await ExportService.export({
      content: sampleLegalBrief.content,
      format: 'txt',
      title: 'Performance Test'
    });

    const duration = Date.now() - start;
    assert.ok(duration < 100, `Exportação TXT levou ${duration}ms`);
  });

  it('deve exportar Markdown rapidamente (< 100ms)', async () => {
    const start = Date.now();

    await ExportService.export({
      content: sampleLegalBrief.content,
      format: 'markdown',
      title: 'Performance Test'
    });

    const duration = Date.now() - start;
    assert.ok(duration < 100, `Exportação Markdown levou ${duration}ms`);
  });

  it('deve exportar HTML rapidamente (< 200ms)', async () => {
    const start = Date.now();

    await ExportService.export({
      content: sampleLegalBrief.content,
      format: 'html',
      title: 'Performance Test'
    });

    const duration = Date.now() - start;
    assert.ok(duration < 200, `Exportação HTML levou ${duration}ms`);
  });
});

console.log('✅ Testes do ExportService carregados com sucesso');
