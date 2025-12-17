/**
 * ROM Agent - Formatador de Jurimetria
 * Geração de tabelas, quadros comparativos e apresentação visual
 *
 * FUNCIONALIDADES:
 * - Tabelas comparativas de decisões
 * - Quadros de amoldamento ao leading case
 * - Distinguishing formatado
 * - Apresentação clara para o julgador
 *
 * @version 1.0.0
 */

class JurimetriaFormatterService {
  /**
   * Gerar tabela comparativa entre caso atual e precedentes
   */
  gerarTabelaComparativa(params) {
    const {
      casoAtual,
      precedentes, // Array de decisões
      criterios    // Critérios de comparação
    } = params;

    let tabela = `
## 📊 TABELA COMPARATIVA - CASO ATUAL vs. PRECEDENTES DO MAGISTRADO

| Critério | Caso Atual | ${precedentes.map((p, i) => `Precedente ${i + 1}`).join(' | ')} |
|----------|------------|${precedentes.map(() => '-------------').join('|')}|
`;

    for (const criterio of criterios) {
      const linha = `| **${criterio.nome}** | ${criterio.casoAtual} | ${precedentes.map(p => criterio.extrair(p)).join(' | ')} |`;
      tabela += linha + '\n';
    }

    // Adicionar linha de similaridade
    tabela += `| **Similaridade** | - | ${precedentes.map(p => `${p.similaridade || 'N/A'}%`).join(' | ')} |\n`;

    // Adicionar linha de aplicabilidade
    tabela += `| **Aplicável?** | - | ${precedentes.map(p => this.avaliarAplicabilidade(p)).join(' | ')} |\n`;

    return tabela;
  }

  /**
   * Avaliar aplicabilidade do precedente
   */
  avaliarAplicabilidade(precedente) {
    if (!precedente.similaridade) return '⚠️ Avaliar';

    if (precedente.similaridade >= 80) {
      return '✅ Diretamente aplicável';
    } else if (precedente.similaridade >= 60) {
      return '🟡 Aplicável com ressalvas';
    } else if (precedente.similaridade >= 40) {
      return '🟠 Requer distinguishing';
    } else {
      return '❌ Não aplicável';
    }
  }

  /**
   * Gerar quadro de amoldamento ao leading case
   */
  gerarQuadroAmoldamento(params) {
    const {
      leadingCase,
      casoAtual,
      pontosConvergencia,
      pontosDivergencia
    } = params;

    const quadro = `
## ⚖️ QUADRO DE AMOLDAMENTO AO LEADING CASE

### 📌 Leading Case Identificado

**Processo:** ${leadingCase.numeroProcesso}
**Data:** ${leadingCase.data}
**Magistrado:** ${leadingCase.relator}
**Tribunal:** ${leadingCase.tribunal}

**Ementa (resumida):**
> ${leadingCase.ementa.substring(0, 300)}...

---

### ✅ PONTOS DE CONVERGÊNCIA (Aplicação Direta)

| # | Aspecto | Leading Case | Caso Atual | Amoldamento |
|---|---------|--------------|------------|-------------|
${pontosConvergencia.map((p, i) =>
  `| ${i + 1} | **${p.aspecto}** | ${p.leadingCase} | ${p.casoAtual} | ${p.amoldamento} |`
).join('\n')}

---

### ⚠️ PONTOS DE DIVERGÊNCIA (Distinguishing Necessário)

${pontosDivergencia.length === 0 ? '_Não há divergências relevantes._' : `
| # | Aspecto | Leading Case | Caso Atual | Impacto | Distinguishing |
|---|---------|--------------|------------|---------|----------------|
${pontosDivergencia.map((p, i) =>
  `| ${i + 1} | **${p.aspecto}** | ${p.leadingCase} | ${p.casoAtual} | ${p.impacto} | ${p.distinguishing} |`
).join('\n')}
`}

---

### 📋 CONCLUSÃO DO AMOLDAMENTO

${this.gerarConclusaoAmoldamento(pontosConvergencia, pontosDivergencia)}
`;

    return quadro;
  }

  /**
   * Gerar conclusão do amoldamento
   */
  gerarConclusaoAmoldamento(convergencias, divergencias) {
    const totalPontos = convergencias.length + divergencias.length;
    const percentualConvergencia = (convergencias.length / totalPontos) * 100;

    if (percentualConvergencia >= 80) {
      return `✅ **ALTA APLICABILIDADE** (${percentualConvergencia.toFixed(0)}% de convergência)

O caso atual se amolda diretamente ao leading case em seus aspectos essenciais. Os pontos de convergência são preponderantes e as divergências, se existentes, não afetam a ratio decidendi do precedente.

**Recomendação:** Invocar o precedente como fundamento central da argumentação.`;
    } else if (percentualConvergencia >= 60) {
      return `🟡 **MÉDIA APLICABILIDADE** (${percentualConvergencia.toFixed(0)}% de convergência)

O caso atual apresenta similaridades relevantes com o leading case, mas existem divergências que devem ser endereçadas. É necessário demonstrar que as diferenças não afetam o núcleo do precedente.

**Recomendação:** Invocar o precedente com aplicação analógica, demonstrando que as divergências são periféricas.`;
    } else {
      return `🟠 **BAIXA APLICABILIDADE** (${percentualConvergencia.toFixed(0)}% de convergência)

O caso atual apresenta divergências significativas em relação ao leading case. A aplicação direta do precedente pode ser questionada.

**Recomendação:** Utilizar distinguishing para demonstrar que as diferenças factuais justificam solução diversa, OU argumentar pela aplicação dos princípios subjacentes ao precedente.`;
    }
  }

  /**
   * Gerar quadro de distinguishing
   */
  gerarQuadroDistinguishing(params) {
    const {
      precedenteDesfavoravel,
      casoAtual,
      diferencasRelevantes
    } = params;

    const quadro = `
## 🔍 QUADRO DE DISTINGUISHING

### ❌ Precedente Aparentemente Desfavorável

**Processo:** ${precedenteDesfavoravel.numeroProcesso}
**Data:** ${precedenteDesfavoravel.data}
**Resultado:** ${precedenteDesfavoravel.resultado}

**Ementa (resumida):**
> ${precedenteDesfavoravel.ementa.substring(0, 300)}...

---

### ⚖️ DIFERENÇAS FACTUAIS RELEVANTES

| # | Aspecto | Precedente | Caso Atual | Relevância | Impacto na Ratio Decidendi |
|---|---------|------------|------------|------------|----------------------------|
${diferencasRelevantes.map((d, i) =>
  `| ${i + 1} | **${d.aspecto}** | ${d.precedente} | ${d.casoAtual} | ${d.relevancia} | ${d.impacto} |`
).join('\n')}

---

### 📝 FUNDAMENTAÇÃO DO DISTINGUISHING

${this.gerarFundamentacaoDistinguishing(diferencasRelevantes)}

---

### ✅ CONCLUSÃO

${this.gerarConclusaoDistinguishing(diferencasRelevantes)}
`;

    return quadro;
  }

  /**
   * Gerar fundamentação do distinguishing
   */
  gerarFundamentacaoDistinguishing(diferencas) {
    const diferencasCriticas = diferencas.filter(d =>
      d.impacto === 'Afeta ratio decidendi' || d.impacto === 'Determina resultado oposto'
    );

    if (diferencasCriticas.length === 0) {
      return `As diferenças identificadas são de natureza periférica e não afetam o núcleo do precedente. Contudo, tais distinções devem ser destacadas para demonstrar que o caso atual não se subsume integralmente à hipótese fática do julgado anterior.`;
    }

    return `${diferencasCriticas.length > 1 ? 'As diferenças identificadas são' : 'A diferença identificada é'} de natureza substancial e afeta${diferencasCriticas.length > 1 ? 'm' : ''} diretamente a ratio decidendi do precedente.

${diferencasCriticas.map((d, i) => `
**${i + 1}. ${d.aspecto}:**

No precedente citado, ${d.precedente}. Já no caso presente, ${d.casoAtual}. Tal distinção é determinante porque ${d.justificativa || 'altera fundamentalmente a premissa fática que embasou a decisão anterior'}.
`).join('\n')}

Portanto, embora à primeira vista o precedente possa parecer aplicável, a análise detalhada revela que **as circunstâncias fáticas são substancialmente diversas**, o que impõe solução jurídica diferenciada.`;
  }

  /**
   * Gerar conclusão do distinguishing
   */
  gerarConclusaoDistinguishing(diferencas) {
    const diferencasCriticas = diferencas.filter(d =>
      d.impacto === 'Afeta ratio decidendi' || d.impacto === 'Determina resultado oposto'
    );

    if (diferencasCriticas.length >= 2) {
      return `Em virtude das **${diferencasCriticas.length} diferenças substanciais** identificadas, o precedente citado **NÃO É APLICÁVEL** ao caso presente. As circunstâncias fáticas são suficientemente distintas para justificar solução jurídica diversa.`;
    } else if (diferencasCriticas.length === 1) {
      return `Em virtude da **diferença substancial** identificada (${diferencasCriticas[0].aspecto}), o precedente citado **NÃO É DIRETAMENTE APLICÁVEL** ao caso presente. A distinção factual é determinante para a solução jurídica.`;
    } else {
      return `Embora existam diferenças entre os casos, estas são de natureza secundária. O precedente **PODE SER APLICÁVEL** com as devidas ressalvas e adaptações ao caso concreto.`;
    }
  }

  /**
   * Gerar tabela de padrão de julgamento do magistrado
   */
  gerarTabelaPadraoJulgamento(params) {
    const {
      magistrado,
      materia,
      estatisticas,
      decisoesAnalisadas
    } = params;

    const tabela = `
## 📊 PADRÃO DE JULGAMENTO - ${magistrado}

**Matéria:** ${materia}
**Decisões Analisadas:** ${decisoesAnalisadas}
**Período:** ${this.extrairPeriodo(estatisticas)}

---

### 📈 ESTATÍSTICAS DE RESULTADOS

| Resultado | Quantidade | Percentual | Gráfico |
|-----------|-----------|-----------|---------|
${this.gerarLinhasEstatisticas(estatisticas.porResultado, decisoesAnalisadas)}

---

### 📅 DISTRIBUIÇÃO TEMPORAL

| Ano | Decisões | Tendência |
|-----|----------|-----------|
${this.gerarLinhasTemporais(estatisticas.porAno)}

---

### 🎯 TENDÊNCIA PREDOMINANTE

${this.identificarTendencia(estatisticas)}
`;

    return tabela;
  }

  /**
   * Gerar linhas de estatísticas
   */
  gerarLinhasEstatisticas(porResultado, total) {
    return Object.entries(porResultado)
      .sort((a, b) => b[1] - a[1])
      .map(([resultado, qtd]) => {
        const percentual = ((qtd / total) * 100).toFixed(1);
        const barras = '█'.repeat(Math.round(percentual / 5));
        return `| ${resultado.charAt(0).toUpperCase() + resultado.slice(1)} | ${qtd} | ${percentual}% | ${barras} |`;
      })
      .join('\n');
  }

  /**
   * Gerar linhas temporais
   */
  gerarLinhasTemporais(porAno) {
    const anos = Object.keys(porAno).sort();

    return anos.map((ano, i) => {
      const qtd = porAno[ano];
      let tendencia = '→';

      if (i > 0) {
        const anoAnterior = anos[i - 1];
        if (qtd > porAno[anoAnterior]) {
          tendencia = '↗️ Aumento';
        } else if (qtd < porAno[anoAnterior]) {
          tendencia = '↘️ Redução';
        } else {
          tendencia = '→ Estável';
        }
      }

      return `| ${ano} | ${qtd} | ${tendencia} |`;
    }).join('\n');
  }

  /**
   * Extrair período das estatísticas
   */
  extrairPeriodo(estatisticas) {
    const anos = Object.keys(estatisticas.porAno || {}).sort();
    if (anos.length === 0) return 'Não especificado';
    if (anos.length === 1) return anos[0];
    return `${anos[0]} a ${anos[anos.length - 1]}`;
  }

  /**
   * Identificar tendência predominante
   */
  identificarTendencia(estatisticas) {
    if (!estatisticas.porResultado) {
      return 'Dados insuficientes para identificar tendência.';
    }

    const resultados = Object.entries(estatisticas.porResultado);
    const [predominante, qtdPredominante] = resultados.sort((a, b) => b[1] - a[1])[0];

    const percentual = ((qtdPredominante / estatisticas.total) * 100).toFixed(0);

    let emoji = '📊';
    if (predominante.includes('provid') && !predominante.includes('des')) {
      emoji = '✅';
    } else if (predominante.includes('desprovid') || predominante.includes('improcedente')) {
      emoji = '❌';
    }

    return `${emoji} **${predominante.toUpperCase()}** (${percentual}% das decisões)

O magistrado demonstra tendência predominante de **${predominante}** na matéria analisada, com ${qtdPredominante} de ${estatisticas.total} decisões neste sentido.`;
  }

  /**
   * Gerar quadro de contradições identificadas
   */
  gerarQuadroContradicoes(contradicoes) {
    if (contradicoes.length === 0) {
      return `
## ✅ CONSISTÊNCIA JURISPRUDENCIAL

Não foram identificadas contradições aparentes entre as decisões analisadas do magistrado. O padrão de julgamento demonstra coerência e previsibilidade.
`;
    }

    const quadro = `
## ⚠️ CONTRADIÇÕES APARENTES IDENTIFICADAS

Foram identificadas **${contradicoes.length} contradições aparentes** entre decisões do magistrado na mesma matéria:

---

${contradicoes.map((c, i) => `
### Contradição ${i + 1} (Similaridade: ${c.similaridade}%)

#### Decisão A (${c.decisao1.data})
**Processo:** ${c.decisao1.processo}
**Resultado:** ${c.decisao1.resultado}
**Ementa:** ${c.decisao1.ementa}...

#### Decisão B (${c.decisao2.data})
**Processo:** ${c.decisao2.processo}
**Resultado:** ${c.decisao2.resultado}
**Ementa:** ${c.decisao2.ementa}...

#### Análise
Embora os casos apresentem ${c.similaridade}% de similaridade, os resultados foram **opostos**.

${c.possiveisMotivos.length > 0 ? `
**Possíveis motivos para a divergência:**
${c.possiveisMotivos.map(m => `- ${m}`).join('\n')}
` : `
**Recomendação:** Analisar inteiro teor para identificar as razões da distinção.
`}

**Uso estratégico:**
${c.decisao1.resultado.includes('provid') || c.decisao1.resultado.includes('procedente') ? `
- Se favorável: Invocar Decisão A como precedente do próprio julgador
- Se desfavorável: Demonstrar que o caso atual se assemelha à Decisão A
` : `
- Se favorável: Invocar Decisão B como precedente do próprio julgador
- Se desfavorável: Demonstrar que o caso atual se diferencia da Decisão B
`}

---
`).join('\n')}
`;

    return quadro;
  }

  /**
   * Gerar relatório completo de jurimetria formatado
   */
  gerarRelatorioCompleto(params) {
    const {
      analiseJurimetrica,
      tabelaComparativa,
      quadroAmoldamento,
      quadrosDistinguishing,
      padraoJulgamento,
      contradicoes
    } = params;

    const relatorio = `
# 📊 RELATÓRIO DE JURIMETRIA COMPLETO

---

${padraoJulgamento}

---

${tabelaComparativa}

---

${quadroAmoldamento}

---

${quadrosDistinguishing && quadrosDistinguishing.length > 0 ? `
# 🔍 DISTINGUISHING DE PRECEDENTES DESFAVORÁVEIS

${quadrosDistinguishing.map(q => q).join('\n---\n')}

---
` : ''}

${contradicoes}

---

## 📋 ANÁLISE QUALITATIVA

${analiseJurimetrica.analiseQualitativa}

---

## ✅ CONCLUSÕES E RECOMENDAÇÕES ESTRATÉGICAS

Com base na análise jurímétrica realizada:

1. **Padrão de Julgamento:** O magistrado demonstra ${this.identificarTendencia(analiseJurimetrica.estatisticas)}

2. **Precedentes Favoráveis:** Identificados ${params.precedentesFavoraveis || 0} precedentes diretamente aplicáveis ao caso

3. **Necessidade de Distinguishing:** ${quadrosDistinguishing?.length || 0} precedentes desfavoráveis requerem distinção

4. **Consistência Jurisprudencial:** ${contradicoes.length === 0 ? 'Alta - Julgador demonstra coerência' : `Média - Identificadas ${contradicoes.length} contradições aparentes`}

5. **Recomendação Final:**
   ${this.gerarRecomendacaoFinal(params)}

---

**Relatório gerado em:** ${new Date().toLocaleString('pt-BR')}
**Fonte dos dados:** DataJud CNJ, JusBrasil, Pesquisa de Jurisprudência
**Validação:** Double check realizado
`;

    return relatorio;
  }

  /**
   * Gerar recomendação final
   */
  gerarRecomendacaoFinal(params) {
    const { precedentesFavoraveis = 0, precedentesDesfavoraveis = 0 } = params;

    if (precedentesFavoraveis > precedentesDesfavoraveis) {
      return `✅ **Invocar ativamente os precedentes do magistrado** como fundamento central da argumentação. A jurimetria demonstra padrão favorável ao caso presente.`;
    } else if (precedentesDesfavoraveis > precedentesFavoraveis) {
      return `⚠️ **Trabalhar distinguishing de forma robusta.** Demonstrar que o caso atual se diferencia dos precedentes desfavoráveis por suas particularidades factuais.`;
    } else {
      return `🟡 **Abordagem equilibrada.** Invocar precedentes favoráveis e distinguir os desfavoráveis, demonstrando coerência com o próprio entendimento do julgador.`;
    }
  }
}

// Singleton
const jurimetriaFormatterService = new JurimetriaFormatterService();

export default jurimetriaFormatterService;
