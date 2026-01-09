/**
 * ROM Agent - Formatação de Citações Jurídicas em Padrão ABNT
 *
 * Formata citações de:
 * - Jurisprudência (acórdãos, súmulas)
 * - Doutrina (livros, artigos)
 * - Legislação
 *
 * Padrão ABNT NBR 6023:2018 (Referências) e NBR 10520:2002 (Citações)
 *
 * @version 1.0.0
 */

// ============================================================
// JURISPRUDÊNCIA - ACÓRDÃOS
// ============================================================

/**
 * Formata acórdão em padrão ABNT
 *
 * Formato ABNT para jurisprudência:
 * TRIBUNAL. Órgão julgador. Tipo e número do recurso. Relator: Nome. Local, data. Ementa...
 * Disponível em: <URL>. Acesso em: data.
 *
 * @param {object} acordao - Dados do acórdão
 * @returns {string} Citação formatada em ABNT com link clicável
 */
function formatarAcordaoABNT(acordao) {
  const {
    tribunal = '',
    orgaoJulgador = '',
    classe = '',
    numero = '',
    relator = '',
    local = '',
    data = '',
    dataJulgamento = '',
    ementa = '',
    link = '',
    dj = '',  // Data de julgamento alternativa
    djPublicacao = '' // Data de publicação
  } = acordao;

  // Determinar data a usar (prioridade: data > dataJulgamento > dj)
  const dataFinal = data || dataJulgamento || dj || djPublicacao || '';

  // Formatar partes da citação
  const partes = [];

  // 1. Tribunal (em maiúsculas)
  if (tribunal) {
    partes.push(tribunal.toUpperCase());
  }

  // 2. Órgão julgador (se disponível)
  if (orgaoJulgador) {
    partes.push(orgaoJulgador);
  }

  // 3. Classe e número
  if (classe && numero) {
    partes.push(`${classe} ${numero}`);
  } else if (numero) {
    partes.push(numero);
  }

  // 4. Relator
  if (relator) {
    // Remover "Min.", "Des.", etc. se já estiver no nome
    const relatorLimpo = relator.replace(/^(Min\.|Des\.|Juiz|Juíza|Desembargador|Desembargadora)\s*/i, '');
    partes.push(`Relator: ${relatorLimpo}`);
  }

  // 5. Local e data
  if (local && dataFinal) {
    partes.push(`${local}, ${dataFinal}`);
  } else if (dataFinal) {
    partes.push(dataFinal);
  }

  // Montar primeira linha (cabeçalho)
  const cabecalho = partes.join('. ') + (partes.length > 0 ? '.' : '');

  // 6. Ementa (NÃO TRUNCAR - EMENTA COMPLETA)
  let ementaCompleta = '';
  if (ementa) {
    // Limpar ementa (remover múltiplos espaços e quebras)
    ementaCompleta = ementa
      .replace(/\s+/g, ' ')
      .trim();

    // Adicionar "Ementa: " se não tiver
    if (!ementaCompleta.toLowerCase().startsWith('ementa')) {
      ementaCompleta = `Ementa: ${ementaCompleta}`;
    }
  }

  // 7. Link (disponível em)
  let linkFormatado = '';
  if (link) {
    const dataAcesso = new Date().toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    }).replace('.', '');

    linkFormatado = `Disponível em: <a href="${link}" target="_blank" rel="noopener noreferrer" style="color: #D4AF37; text-decoration: underline;">${link}</a>. Acesso em: ${dataAcesso}.`;
  }

  // Montar citação completa
  const citacao = [
    cabecalho,
    ementaCompleta,
    linkFormatado
  ].filter(Boolean).join(' ');

  return citacao;
}

/**
 * Formata súmula em padrão ABNT
 *
 * Formato ABNT:
 * TRIBUNAL. Súmula nº XXX. Texto da súmula. Disponível em: <URL>. Acesso em: data.
 */
function formatarSumulaABNT(sumula) {
  const {
    tribunal = '',
    numero = '',
    texto = '',
    enunciado = '',
    link = '',
    tipo = 'Súmula' // 'Súmula' ou 'Súmula Vinculante'
  } = sumula;

  const textoFinal = texto || enunciado || '';

  const partes = [];

  // 1. Tribunal
  if (tribunal) {
    partes.push(tribunal.toUpperCase());
  }

  // 2. Tipo e número
  if (numero) {
    partes.push(`${tipo} nº ${numero}`);
  } else {
    partes.push(tipo);
  }

  // 3. Texto completo
  if (textoFinal) {
    partes.push(textoFinal);
  }

  // 4. Link
  if (link) {
    const dataAcesso = new Date().toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    }).replace('.', '');

    partes.push(`Disponível em: <a href="${link}" target="_blank" rel="noopener noreferrer" style="color: #D4AF37; text-decoration: underline;">${link}</a>. Acesso em: ${dataAcesso}.`);
  }

  return partes.join('. ') + '.';
}

// ============================================================
// DOUTRINA - LIVROS
// ============================================================

/**
 * Formata referência de livro em padrão ABNT
 *
 * Formato ABNT NBR 6023:
 * SOBRENOME, Nome. Título do livro. Edição. Local: Editora, ano. p. XXX-XXX.
 */
function formatarLivroABNT(livro) {
  const {
    autores = [],
    autor = '',  // Alternativa: string única
    titulo = '',
    edicao = '',
    local = '',
    editora = '',
    ano = '',
    paginas = '',
    link = ''
  } = livro;

  const partes = [];

  // 1. Autor(es)
  const autoresList = autores.length > 0 ? autores : (autor ? [autor] : []);
  if (autoresList.length > 0) {
    const autoresFormatados = autoresList.map(a => {
      // Separar sobrenome do nome
      const nomes = a.trim().split(/\s+/);
      if (nomes.length > 1) {
        const sobrenome = nomes[nomes.length - 1].toUpperCase();
        const nome = nomes.slice(0, -1).join(' ');
        return `${sobrenome}, ${nome}`;
      }
      return a.toUpperCase();
    });

    if (autoresFormatados.length === 1) {
      partes.push(autoresFormatados[0]);
    } else if (autoresFormatados.length === 2) {
      partes.push(`${autoresFormatados[0]}; ${autoresFormatados[1]}`);
    } else if (autoresFormatados.length > 2) {
      partes.push(`${autoresFormatados[0]} et al.`);
    }
  }

  // 2. Título (em negrito ou itálico)
  if (titulo) {
    partes.push(`<strong>${titulo}</strong>`);
  }

  // 3. Edição
  if (edicao) {
    partes.push(`${edicao} ed.`);
  }

  // 4. Local, editora, ano
  const localEditora = [];
  if (local) localEditora.push(local);
  if (editora) localEditora.push(editora);
  if (localEditora.length > 0) {
    const localEditoraStr = localEditora.join(': ');
    if (ano) {
      partes.push(`${localEditoraStr}, ${ano}`);
    } else {
      partes.push(localEditoraStr);
    }
  } else if (ano) {
    partes.push(ano);
  }

  // 5. Páginas
  if (paginas) {
    partes.push(`p. ${paginas}`);
  }

  // 6. Link (se disponível)
  if (link) {
    const dataAcesso = new Date().toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    }).replace('.', '');

    partes.push(`Disponível em: <a href="${link}" target="_blank" rel="noopener noreferrer" style="color: #D4AF37; text-decoration: underline;">${link}</a>. Acesso em: ${dataAcesso}.`);
  }

  return partes.join('. ') + '.';
}

// ============================================================
// DOUTRINA - ARTIGOS
// ============================================================

/**
 * Formata referência de artigo em padrão ABNT
 *
 * Formato ABNT NBR 6023:
 * SOBRENOME, Nome. Título do artigo. Nome da Revista, Local, v. X, n. Y, p. XXX-XXX, ano.
 */
function formatarArtigoABNT(artigo) {
  const {
    autores = [],
    autor = '',
    titulo = '',
    revista = '',
    periodico = '',
    local = '',
    volume = '',
    numero = '',
    paginas = '',
    ano = '',
    mes = '',
    link = '',
    doi = ''
  } = artigo;

  const partes = [];

  // 1. Autor(es) - mesmo formato que livro
  const autoresList = autores.length > 0 ? autores : (autor ? [autor] : []);
  if (autoresList.length > 0) {
    const autoresFormatados = autoresList.map(a => {
      const nomes = a.trim().split(/\s+/);
      if (nomes.length > 1) {
        const sobrenome = nomes[nomes.length - 1].toUpperCase();
        const nome = nomes.slice(0, -1).join(' ');
        return `${sobrenome}, ${nome}`;
      }
      return a.toUpperCase();
    });

    if (autoresFormatados.length === 1) {
      partes.push(autoresFormatados[0]);
    } else if (autoresFormatados.length === 2) {
      partes.push(`${autoresFormatados[0]}; ${autoresFormatados[1]}`);
    } else if (autoresFormatados.length > 2) {
      partes.push(`${autoresFormatados[0]} et al.`);
    }
  }

  // 2. Título do artigo (sem formatação especial)
  if (titulo) {
    partes.push(titulo);
  }

  // 3. Nome da revista/periódico (em negrito)
  const nomeRevista = revista || periodico || '';
  if (nomeRevista) {
    const revistaInfo = [`<strong>${nomeRevista}</strong>`];

    // Local
    if (local) revistaInfo.push(local);

    // Volume
    if (volume) revistaInfo.push(`v. ${volume}`);

    // Número
    if (numero) revistaInfo.push(`n. ${numero}`);

    // Páginas
    if (paginas) revistaInfo.push(`p. ${paginas}`);

    // Mês e ano
    if (mes && ano) {
      revistaInfo.push(`${mes}. ${ano}`);
    } else if (ano) {
      revistaInfo.push(ano);
    }

    partes.push(revistaInfo.join(', '));
  }

  // 4. DOI (se disponível)
  if (doi) {
    partes.push(`DOI: <a href="https://doi.org/${doi}" target="_blank" rel="noopener noreferrer" style="color: #D4AF37; text-decoration: underline;">${doi}</a>`);
  }

  // 5. Link (se disponível e não tiver DOI)
  if (link && !doi) {
    const dataAcesso = new Date().toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    }).replace('.', '');

    partes.push(`Disponível em: <a href="${link}" target="_blank" rel="noopener noreferrer" style="color: #D4AF37; text-decoration: underline;">${link}</a>. Acesso em: ${dataAcesso}.`);
  }

  return partes.join('. ') + '.';
}

// ============================================================
// LEGISLAÇÃO
// ============================================================

/**
 * Formata referência de legislação em padrão ABNT
 *
 * Formato ABNT NBR 6023:
 * BRASIL. Lei nº X, de DD de mês de AAAA. Ementa. Diário Oficial da União, Local, data, seção, página.
 */
function formatarLegislacaoABNT(legislacao) {
  const {
    pais = 'BRASIL',
    tipo = 'Lei',  // Lei, Decreto, Portaria, etc.
    numero = '',
    data = '',
    ementa = '',
    publicacao = 'Diário Oficial da União',
    localPublicacao = 'Brasília, DF',
    dataPublicacao = '',
    secao = '',
    pagina = '',
    link = ''
  } = legislacao;

  const partes = [];

  // 1. País/Estado/Município (em maiúsculas)
  partes.push(pais.toUpperCase());

  // 2. Tipo e número
  if (numero && data) {
    partes.push(`${tipo} nº ${numero}, de ${data}`);
  } else if (numero) {
    partes.push(`${tipo} nº ${numero}`);
  }

  // 3. Ementa (completa)
  if (ementa) {
    partes.push(ementa);
  }

  // 4. Publicação
  const pubInfo = [publicacao];
  if (localPublicacao) pubInfo.push(localPublicacao);
  if (dataPublicacao) pubInfo.push(dataPublicacao);
  if (secao) pubInfo.push(`Seção ${secao}`);
  if (pagina) pubInfo.push(`p. ${pagina}`);

  if (pubInfo.length > 1) {
    partes.push(pubInfo.join(', '));
  }

  // 5. Link
  if (link) {
    const dataAcesso = new Date().toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    }).replace('.', '');

    partes.push(`Disponível em: <a href="${link}" target="_blank" rel="noopener noreferrer" style="color: #D4AF37; text-decoration: underline;">${link}</a>. Acesso em: ${dataAcesso}.`);
  }

  return partes.join('. ') + '.';
}

// ============================================================
// FORMATAÇÃO DE LISTA DE REFERÊNCIAS
// ============================================================

/**
 * Formata lista completa de referências em ordem alfabética
 *
 * @param {Array} referencias - Array de objetos de referência
 * @returns {string} Lista formatada em HTML
 */
function formatarListaReferenciasABNT(referencias) {
  if (!referencias || referencias.length === 0) {
    return '<p>Nenhuma referência disponível.</p>';
  }

  // Ordenar alfabeticamente pelo primeiro autor/tribunal
  const refsOrdenadas = referencias.slice().sort((a, b) => {
    const nomeA = a.tribunal || a.autores?.[0] || a.autor || '';
    const nomeB = b.tribunal || b.autores?.[0] || b.autor || '';
    return nomeA.localeCompare(nomeB, 'pt-BR');
  });

  // Formatar cada referência
  const refsFormatadas = refsOrdenadas.map(ref => {
    let citacao = '';

    // Identificar tipo e formatar adequadamente
    if (ref.tribunal || ref.ementa) {
      citacao = formatarAcordaoABNT(ref);
    } else if (ref.tipo === 'sumula' || ref.enunciado) {
      citacao = formatarSumulaABNT(ref);
    } else if (ref.revista || ref.periodico) {
      citacao = formatarArtigoABNT(ref);
    } else if (ref.tipo === 'lei' || ref.tipo === 'legislacao') {
      citacao = formatarLegislacaoABNT(ref);
    } else if (ref.editora || ref.titulo) {
      citacao = formatarLivroABNT(ref);
    } else {
      // Fallback genérico
      citacao = JSON.stringify(ref);
    }

    return `<p style="margin-bottom: 12px; text-align: justify; text-indent: -2em; padding-left: 2em;">${citacao}</p>`;
  });

  return `
<div style="margin-top: 30px; page-break-before: always;">
  <h2 style="text-align: center; font-size: 14pt; font-weight: bold; margin-bottom: 20px; text-transform: uppercase;">
    REFERÊNCIAS
  </h2>
  <div style="font-size: 12pt; line-height: 1.5;">
    ${refsFormatadas.join('\n')}
  </div>
</div>
`;
}

// ============================================================
// CITAÇÃO NO TEXTO (NBR 10520)
// ============================================================

/**
 * Formata citação curta no texto (sistema autor-data)
 *
 * Exemplos:
 * - (BRASIL, 2015)
 * - (STF, 2020)
 * - (SILVA, 2018, p. 45)
 */
function formatarCitacaoTexto(ref, opcoes = {}) {
  const {
    pagina = '',
    apud = false,  // Citação indireta
    autorSecundario = ''
  } = opcoes;

  // Identificar autor principal
  let autor = '';
  if (ref.tribunal) {
    autor = ref.tribunal.toUpperCase();
  } else if (ref.autores && ref.autores.length > 0) {
    const primeiroAutor = ref.autores[0].split(/\s+/);
    autor = primeiroAutor[primeiroAutor.length - 1].toUpperCase();
  } else if (ref.autor) {
    const nomes = ref.autor.split(/\s+/);
    autor = nomes[nomes.length - 1].toUpperCase();
  } else if (ref.pais) {
    autor = ref.pais.toUpperCase();
  }

  // Ano
  const ano = ref.ano || ref.data?.match(/\d{4}/)?.[0] || ref.dataJulgamento?.match(/\d{4}/)?.[0] || '';

  // Montar citação
  const partes = [autor, ano];

  if (pagina) {
    partes.push(`p. ${pagina}`);
  }

  let citacao = `(${partes.filter(Boolean).join(', ')})`;

  // Se for apud
  if (apud && autorSecundario) {
    citacao = `(${autor} apud ${autorSecundario}, ${ano})`;
  }

  return citacao;
}

// ============================================================
// EXPORTAÇÕES
// ============================================================

module.exports = {
  // Formatação individual
  formatarAcordaoABNT,
  formatarSumulaABNT,
  formatarLivroABNT,
  formatarArtigoABNT,
  formatarLegislacaoABNT,

  // Formatação de listas
  formatarListaReferenciasABNT,

  // Citação no texto
  formatarCitacaoTexto
};
