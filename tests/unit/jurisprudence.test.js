/**
 * Testes Unitários - Jurisprudência
 *
 * Testa funcionalidades de busca, análise, formatação e citação
 * de jurisprudências dos tribunais brasileiros
 */

import { describe, it, before } from 'node:test';
import assert from 'node:assert';
import crypto from 'crypto';

// ============================================================
// TESTES DE PARSING DE ACÓRDÃOS
// ============================================================

describe('Jurisprudence - Acórdão Parsing', () => {
  function parseAcordao(text) {
    const result = {
      numeroProcesso: null,
      tribunal: null,
      relator: null,
      dataJulgamento: null,
      ementa: null,
      decisao: null
    };

    // Extrair número do processo
    const processoMatch = text.match(/(?:Processo|Recurso|REsp|RE|AI|AREsp)[\s:]+([\d.-]+)/i);
    if (processoMatch) {
      result.numeroProcesso = processoMatch[1];
    }

    // Extrair tribunal
    const tribunalMatch = text.match(/(STF|STJ|TST|TRF\d|TJ[A-Z]{2}|TRT\d+)/);
    if (tribunalMatch) {
      result.tribunal = tribunalMatch[1];
    }

    // Extrair relator
    const relatorMatch = text.match(/Relator[\s:]+([^\n]+)/i);
    if (relatorMatch) {
      result.relator = relatorMatch[1].trim();
    }

    // Extrair data
    const dataMatch = text.match(/Data\s+do\s+Julgamento[\s:]+(\d{2}\/\d{2}\/\d{4})/i);
    if (dataMatch) {
      result.dataJulgamento = dataMatch[1];
    }

    // Extrair ementa
    const ementaMatch = text.match(/EMENTA[\s:]+([\s\S]+?)(?=\n\n|ACÓRDÃO|VOTO)/i);
    if (ementaMatch) {
      result.ementa = ementaMatch[1].trim();
    }

    // Extrair decisão
    const decisaoMatch = text.match(/(?:DECISÃO|ACÓRDÃO)[\s:]+([\s\S]+?)$/i);
    if (decisaoMatch) {
      result.decisao = decisaoMatch[1].trim().substring(0, 500);
    }

    return result;
  }

  it('deve extrair número do processo', () => {
    const text = 'REsp 1.234.567-SP';
    const result = parseAcordao(text);

    assert.ok(result.numeroProcesso);
    assert.ok(result.numeroProcesso.includes('1.234.567'));
  });

  it('deve extrair tribunal', () => {
    const text = 'STJ - Superior Tribunal de Justiça\nProcesso: 123456';
    const result = parseAcordao(text);

    assert.strictEqual(result.tribunal, 'STJ');
  });

  it('deve extrair relator', () => {
    const text = 'Relator: Min. João Silva';
    const result = parseAcordao(text);

    assert.strictEqual(result.relator, 'Min. João Silva');
  });

  it('deve extrair data de julgamento', () => {
    const text = 'Data do Julgamento: 21/01/2026';
    const result = parseAcordao(text);

    assert.strictEqual(result.dataJulgamento, '21/01/2026');
  });

  it('deve extrair ementa', () => {
    const text = `EMENTA: DIREITO CIVIL. RESPONSABILIDADE CIVIL. DANO MORAL.
Comprovados os elementos da responsabilidade civil...

ACÓRDÃO: Por unanimidade...`;

    const result = parseAcordao(text);

    assert.ok(result.ementa);
    assert.ok(result.ementa.includes('DIREITO CIVIL'));
    assert.ok(result.ementa.includes('RESPONSABILIDADE CIVIL'));
  });

  it('deve retornar campos vazios para texto sem informações', () => {
    const text = 'Texto sem informações relevantes';
    const result = parseAcordao(text);

    assert.strictEqual(result.numeroProcesso, null);
    assert.strictEqual(result.tribunal, null);
    assert.strictEqual(result.relator, null);
  });
});

// ============================================================
// TESTES DE FORMATAÇÃO ABNT DE CITAÇÕES
// ============================================================

describe('Jurisprudence - ABNT Citation Formatting', () => {
  function formatarCitacaoABNT(acordao) {
    const partes = [];

    // Tribunal
    if (acordao.tribunal) {
      partes.push(acordao.tribunal.toUpperCase());
    }

    // Número do processo
    if (acordao.numeroProcesso) {
      partes.push(`Processo ${acordao.numeroProcesso}`);
    }

    // Relator
    if (acordao.relator) {
      partes.push(`Relator: ${acordao.relator}`);
    }

    // Data
    if (acordao.dataJulgamento) {
      partes.push(`Julgado em ${acordao.dataJulgamento}`);
    }

    // Órgão julgador
    if (acordao.orgao) {
      partes.push(acordao.orgao);
    }

    return partes.join('. ') + '.';
  }

  it('deve formatar citação completa em ABNT', () => {
    const acordao = {
      tribunal: 'STJ',
      numeroProcesso: 'REsp 1.234.567/SP',
      relator: 'Min. João Silva',
      dataJulgamento: '21/01/2026',
      orgao: 'Terceira Turma'
    };

    const citacao = formatarCitacaoABNT(acordao);

    assert.strictEqual(
      citacao,
      'STJ. Processo REsp 1.234.567/SP. Relator: Min. João Silva. Julgado em 21/01/2026. Terceira Turma.'
    );
  });

  it('deve formatar com informações parciais', () => {
    const acordao = {
      tribunal: 'TJSP',
      numeroProcesso: '1234567-20.2025.8.26.0100'
    };

    const citacao = formatarCitacaoABNT(acordao);

    assert.strictEqual(
      citacao,
      'TJSP. Processo 1234567-20.2025.8.26.0100.'
    );
  });

  it('deve lidar com dados vazios', () => {
    const acordao = {};
    const citacao = formatarCitacaoABNT(acordao);

    // Retorna '.' se não houver nenhuma informação
    assert.ok(citacao.length <= 1);
  });
});

// ============================================================
// TESTES DE VALIDAÇÃO DE TERMOS DE BUSCA
// ============================================================

describe('Jurisprudence - Search Term Validation', () => {
  function validateSearchTerm(term) {
    const errors = [];

    if (!term || typeof term !== 'string') {
      errors.push('Search term must be a non-empty string');
      return errors;
    }

    const trimmed = term.trim();

    if (trimmed.length === 0) {
      errors.push('Search term cannot be empty');
    } else if (trimmed.length < 3) {
      errors.push('Search term must be at least 3 characters');
    } else if (trimmed.length > 500) {
      errors.push('Search term exceeds maximum length (500 characters)');
    }

    // Detectar termos muito genéricos
    const genericTerms = ['lei', 'art', 'codigo', 'direito', 'processo'];
    if (genericTerms.includes(trimmed.toLowerCase()) && trimmed.length < 10) {
      errors.push('Search term is too generic, please be more specific');
    }

    return errors;
  }

  it('deve aceitar termo de busca válido', () => {
    const errors = validateSearchTerm('responsabilidade civil por dano moral');
    assert.strictEqual(errors.length, 0);
  });

  it('deve rejeitar termo vazio', () => {
    const errors = validateSearchTerm('   ');
    assert.ok(errors.some(e => e.includes('cannot be empty')));
  });

  it('deve rejeitar termo muito curto', () => {
    const errors = validateSearchTerm('ab');
    assert.ok(errors.some(e => e.includes('at least 3 characters')));
  });

  it('deve rejeitar termo muito longo', () => {
    const errors = validateSearchTerm('A'.repeat(600));
    assert.ok(errors.some(e => e.includes('exceeds maximum length')));
  });

  it('deve rejeitar termo genérico', () => {
    const errors = validateSearchTerm('lei');
    assert.ok(errors.some(e => e.includes('too generic')));
  });

  it('deve aceitar termo genérico se for específico', () => {
    const errors = validateSearchTerm('lei de responsabilidade civil');
    assert.strictEqual(errors.length, 0);
  });
});

// ============================================================
// TESTES DE CACHE DE RESULTADOS
// ============================================================

describe('Jurisprudence - Result Caching', () => {
  class JurisprudenceCache {
    constructor() {
      this.cache = new Map();
      this.ttl = 24 * 60 * 60 * 1000; // 24 horas
    }

    hash(tese) {
      return crypto.createHash('md5').update(tese).digest('hex');
    }

    set(tese, results) {
      const key = this.hash(tese);
      this.cache.set(key, {
        results,
        timestamp: Date.now()
      });
    }

    get(tese) {
      const key = this.hash(tese);
      const entry = this.cache.get(key);

      if (!entry) {
        return { valid: false, data: null };
      }

      // Verificar expiração
      const age = Date.now() - entry.timestamp;
      if (age > this.ttl) {
        this.cache.delete(key);
        return { valid: false, data: null };
      }

      return {
        valid: true,
        data: entry.results,
        age: age
      };
    }

    clear() {
      this.cache.clear();
    }

    size() {
      return this.cache.size;
    }
  }

  it('deve armazenar resultados em cache', () => {
    const cache = new JurisprudenceCache();
    const results = [{ id: 1, ementa: 'Teste' }];

    cache.set('responsabilidade civil', results);

    assert.strictEqual(cache.size(), 1);
  });

  it('deve recuperar resultados do cache', () => {
    const cache = new JurisprudenceCache();
    const results = [{ id: 1, ementa: 'Teste' }];

    cache.set('dano moral', results);
    const cached = cache.get('dano moral');

    assert.strictEqual(cached.valid, true);
    assert.deepStrictEqual(cached.data, results);
  });

  it('deve retornar invalid para termo não cacheado', () => {
    const cache = new JurisprudenceCache();
    const cached = cache.get('termo inexistente');

    assert.strictEqual(cached.valid, false);
    assert.strictEqual(cached.data, null);
  });

  it('deve expirar cache após TTL', () => {
    const cache = new JurisprudenceCache();
    cache.ttl = 100; // 100ms para teste

    cache.set('teste ttl', [{ id: 1 }]);

    // Esperar TTL expirar
    return new Promise(resolve => setTimeout(resolve, 150)).then(() => {
      const cached = cache.get('teste ttl');
      assert.strictEqual(cached.valid, false);
    });
  });

  it('deve gerar hash consistente', () => {
    const cache = new JurisprudenceCache();
    const hash1 = cache.hash('teste');
    const hash2 = cache.hash('teste');

    assert.strictEqual(hash1, hash2);
  });

  it('deve gerar hashes diferentes para termos diferentes', () => {
    const cache = new JurisprudenceCache();
    const hash1 = cache.hash('termo1');
    const hash2 = cache.hash('termo2');

    assert.notStrictEqual(hash1, hash2);
  });
});

// ============================================================
// TESTES DE CLASSIFICAÇÃO POR RELEVÂNCIA
// ============================================================

describe('Jurisprudence - Relevance Ranking', () => {
  function calculateRelevance(result, searchTerms) {
    let score = 0;

    const ementa = (result.ementa || '').toLowerCase();
    const decisao = (result.decisao || '').toLowerCase();
    const combined = `${ementa} ${decisao}`;

    searchTerms.forEach(term => {
      const termLower = term.toLowerCase();

      // Peso maior para match na ementa
      const ementaMatches = (ementa.match(new RegExp(termLower, 'g')) || []).length;
      score += ementaMatches * 3;

      // Peso médio para match na decisão
      const decisaoMatches = (decisao.match(new RegExp(termLower, 'g')) || []).length;
      score += decisaoMatches * 2;

      // Bonus se termo aparece no início da ementa
      if (ementa.indexOf(termLower) < 100) {
        score += 5;
      }
    });

    // Bonus por data recente (últimos 2 anos)
    if (result.dataJulgamento) {
      const year = parseInt(result.dataJulgamento.split('/')[2]);
      if (year >= new Date().getFullYear() - 2) {
        score += 10;
      }
    }

    // Bonus por tribunal superior
    if (['STF', 'STJ', 'TST'].includes(result.tribunal)) {
      score += 5;
    }

    return score;
  }

  function rankResults(results, searchTerms) {
    return results
      .map(r => ({
        ...r,
        relevanceScore: calculateRelevance(r, searchTerms)
      }))
      .sort((a, b) => b.relevanceScore - a.relevanceScore);
  }

  it('deve calcular relevância baseada em matches', () => {
    const result = {
      ementa: 'Responsabilidade civil por dano moral. Responsabilidade objetiva.',
      decisao: 'Negou provimento ao recurso.',
      tribunal: 'TJSP'
    };

    const score = calculateRelevance(result, ['responsabilidade', 'civil']);

    // 2 matches de "responsabilidade" na ementa (3*2=6)
    // 1 match de "civil" na ementa (3*1=3)
    // Bonus por aparecer no início (5)
    // Total: 6 + 3 + 5 = 14
    assert.ok(score >= 14);
  });

  it('deve dar peso maior para ementa que decisão', () => {
    const r1 = {
      ementa: 'dano moral',
      decisao: '',
      tribunal: 'TJSP'
    };

    const r2 = {
      ementa: '',
      decisao: 'dano moral',
      tribunal: 'TJSP'
    };

    const score1 = calculateRelevance(r1, ['dano', 'moral']);
    const score2 = calculateRelevance(r2, ['dano', 'moral']);

    assert.ok(score1 > score2);
  });

  it('deve dar bonus para tribunal superior', () => {
    const r1 = {
      ementa: 'teste',
      tribunal: 'STJ',
      dataJulgamento: '01/01/2026'
    };

    const r2 = {
      ementa: 'teste',
      tribunal: 'TJSP',
      dataJulgamento: '01/01/2026'
    };

    const score1 = calculateRelevance(r1, ['teste']);
    const score2 = calculateRelevance(r2, ['teste']);

    assert.ok(score1 > score2);
  });

  it('deve ordenar resultados por relevância', () => {
    const results = [
      { id: 1, ementa: 'outro assunto', tribunal: 'TJSP' },
      { id: 2, ementa: 'dano moral dano moral dano moral', tribunal: 'STJ' },
      { id: 3, ementa: 'dano moral', tribunal: 'TJSP' }
    ];

    const ranked = rankResults(results, ['dano', 'moral']);

    // Mais relevante deve ser id:2 (mais matches + tribunal superior)
    assert.strictEqual(ranked[0].id, 2);
    assert.ok(ranked[0].relevanceScore > ranked[1].relevanceScore);
  });
});

// ============================================================
// TESTES DE DETECÇÃO DE TRIBUNAL
// ============================================================

describe('Jurisprudence - Tribunal Detection', () => {
  function detectTribunal(text) {
    const patterns = {
      'STF': /\b(STF|Supremo\s+Tribunal\s+Federal)\b/i,
      'STJ': /\b(STJ|Superior\s+Tribunal\s+de\s+Justi[cç]a)\b/i,
      'TST': /\b(TST|Tribunal\s+Superior\s+do\s+Trabalho)\b/i,
      'TRF1': /\b(TRF\s*1|Tribunal\s+Regional\s+Federal\s+da\s+1[aª]\s+Regi[aã]o)\b/i,
      'TRF2': /\b(TRF\s*2|Tribunal\s+Regional\s+Federal\s+da\s+2[aª]\s+Regi[aã]o)\b/i,
      'TRF3': /\b(TRF\s*3|Tribunal\s+Regional\s+Federal\s+da\s+3[aª]\s+Regi[aã]o)\b/i,
      'TRF4': /\b(TRF\s*4|Tribunal\s+Regional\s+Federal\s+da\s+4[aª]\s+Regi[aã]o)\b/i,
      'TRF5': /\b(TRF\s*5|Tribunal\s+Regional\s+Federal\s+da\s+5[aª]\s+Regi[aã]o)\b/i,
      'TJSP': /\b(TJSP|Tribunal\s+de\s+Justi[cç]a\s+de\s+S[aã]o\s+Paulo)\b/i,
      'TJRJ': /\b(TJRJ|Tribunal\s+de\s+Justi[cç]a\s+do\s+Rio\s+de\s+Janeiro)\b/i,
      'TJMG': /\b(TJMG|Tribunal\s+de\s+Justi[cç]a\s+de\s+Minas\s+Gerais)\b/i
    };

    for (const [tribunal, pattern] of Object.entries(patterns)) {
      if (pattern.test(text)) {
        return tribunal;
      }
    }

    return null;
  }

  it('deve detectar STF', () => {
    assert.strictEqual(detectTribunal('STF - Processo 123456'), 'STF');
    assert.strictEqual(detectTribunal('Supremo Tribunal Federal'), 'STF');
  });

  it('deve detectar STJ', () => {
    assert.strictEqual(detectTribunal('STJ - REsp 1234567'), 'STJ');
    assert.strictEqual(detectTribunal('Superior Tribunal de Justiça'), 'STJ');
  });

  it('deve detectar TRF com número', () => {
    assert.strictEqual(detectTribunal('TRF1 - Apelação 123'), 'TRF1');
    assert.strictEqual(detectTribunal('Tribunal Regional Federal da 3ª Região'), 'TRF3');
  });

  it('deve detectar TJ estadual', () => {
    assert.strictEqual(detectTribunal('TJSP - Apelação 123'), 'TJSP');
    assert.strictEqual(detectTribunal('Tribunal de Justiça de São Paulo'), 'TJSP');
  });

  it('deve retornar null para texto sem tribunal', () => {
    assert.strictEqual(detectTribunal('Processo comum sem tribunal'), null);
  });
});

// ============================================================
// TESTES DE EXTRAÇÃO DE TESE JURÍDICA
// ============================================================

describe('Jurisprudence - Thesis Extraction', () => {
  function extractThesis(ementa) {
    // Tese geralmente está após palavras-chave
    const thesisMarkers = [
      /TESE[\s:]+([\s\S]+?)(?=\.|$)/i,
      /(?:Entendimento|Orientação)[\s:]+([\s\S]+?)(?=\.|$)/i,
      /(?:Firmou-se|Consolidou-se)[\s:]+(?:o\s+)?(?:entendimento|jurisprudência)[\s:]+([\s\S]+?)(?=\.|$)/i
    ];

    for (const marker of thesisMarkers) {
      const match = ementa.match(marker);
      if (match) {
        return match[1].trim();
      }
    }

    // Se não encontrou marcador, pegar primeira frase
    const firstSentence = ementa.match(/^(.+?\.)/);
    if (firstSentence) {
      return firstSentence[1].trim();
    }

    return ementa.substring(0, 200).trim();
  }

  it('deve extrair tese marcada explicitamente', () => {
    const ementa = 'TESE: A responsabilidade é objetiva nos casos de dano ambiental.';
    const tese = extractThesis(ementa);

    assert.strictEqual(tese, 'A responsabilidade é objetiva nos casos de dano ambiental');
  });

  it('deve extrair entendimento jurisprudencial', () => {
    const ementa = 'Entendimento: Cabível a indenização por danos morais.';
    const tese = extractThesis(ementa);

    assert.ok(tese.includes('Cabível a indenização'));
  });

  it('deve extrair primeira frase se não houver marcador', () => {
    const ementa = 'Responsabilidade civil. Dano moral. Configurado o dano, devida a indenização.';
    const tese = extractThesis(ementa);

    assert.ok(tese.includes('Responsabilidade civil'));
  });
});

// ============================================================
// TESTES DE FILTRAGEM POR DATA
// ============================================================

describe('Jurisprudence - Date Filtering', () => {
  function filterByDate(results, dataInicio, dataFim) {
    if (!dataInicio && !dataFim) return results;

    return results.filter(r => {
      if (!r.dataJulgamento) return false;

      const [dia, mes, ano] = r.dataJulgamento.split('/').map(Number);
      const dataJulgamento = new Date(ano, mes - 1, dia);

      if (dataInicio) {
        const [diaI, mesI, anoI] = dataInicio.split('/').map(Number);
        const inicio = new Date(anoI, mesI - 1, diaI);
        if (dataJulgamento < inicio) return false;
      }

      if (dataFim) {
        const [diaF, mesF, anoF] = dataFim.split('/').map(Number);
        const fim = new Date(anoF, mesF - 1, diaF);
        if (dataJulgamento > fim) return false;
      }

      return true;
    });
  }

  it('deve filtrar por data de início', () => {
    const results = [
      { id: 1, dataJulgamento: '01/01/2020' },
      { id: 2, dataJulgamento: '01/01/2025' },
      { id: 3, dataJulgamento: '01/01/2026' }
    ];

    const filtered = filterByDate(results, '01/01/2025', null);

    assert.strictEqual(filtered.length, 2);
    assert.ok(filtered.every(r => r.id >= 2));
  });

  it('deve filtrar por data de fim', () => {
    const results = [
      { id: 1, dataJulgamento: '01/01/2020' },
      { id: 2, dataJulgamento: '01/01/2025' },
      { id: 3, dataJulgamento: '01/01/2026' }
    ];

    const filtered = filterByDate(results, null, '31/12/2025');

    assert.strictEqual(filtered.length, 2);
    assert.ok(filtered.every(r => r.id <= 2));
  });

  it('deve filtrar por intervalo de datas', () => {
    const results = [
      { id: 1, dataJulgamento: '01/01/2020' },
      { id: 2, dataJulgamento: '01/06/2025' },
      { id: 3, dataJulgamento: '01/01/2026' }
    ];

    const filtered = filterByDate(results, '01/01/2025', '31/12/2025');

    assert.strictEqual(filtered.length, 1);
    assert.strictEqual(filtered[0].id, 2);
  });

  it('deve retornar todos se sem filtro de data', () => {
    const results = [
      { id: 1, dataJulgamento: '01/01/2020' },
      { id: 2, dataJulgamento: '01/01/2025' }
    ];

    const filtered = filterByDate(results, null, null);

    assert.strictEqual(filtered.length, 2);
  });
});

console.log('✅ Testes de jurisprudência carregados com sucesso');
