/**
 * ROM Agent - Sistema de Templates Jurídicos
 * Templates Handlebars para geração de peças jurídicas
 */

import Handlebars from 'handlebars';
import { DateTime } from 'luxon';
import { formatadores } from './analiseAvancada.js';

// ============================================================================
// HELPERS HANDLEBARS PERSONALIZADOS
// ============================================================================

// Formatar data
Handlebars.registerHelper('dataFormatada', function(data, formato) {
  if (!data) return DateTime.now().setLocale('pt-BR').toFormat("d 'de' MMMM 'de' yyyy");
  if (formato === 'extenso') {
    return DateTime.fromFormat(data, 'dd/MM/yyyy').setLocale('pt-BR').toFormat("d 'de' MMMM 'de' yyyy");
  }
  return data;
});

// Data atual
Handlebars.registerHelper('dataAtual', function(formato) {
  const dt = DateTime.now().setLocale('pt-BR');
  if (formato === 'extenso') {
    return dt.toFormat("d 'de' MMMM 'de' yyyy");
  }
  return dt.toFormat('dd/MM/yyyy');
});

// Formatar CPF
Handlebars.registerHelper('cpf', function(cpf) {
  return formatadores.formatarCPF(cpf || '');
});

// Formatar CNPJ
Handlebars.registerHelper('cnpj', function(cnpj) {
  return formatadores.formatarCNPJ(cnpj || '');
});

// Formatar processo CNJ
Handlebars.registerHelper('processoCNJ', function(numero) {
  return formatadores.formatarProcessoCNJ(numero || '');
});

// Capitalizar nome
Handlebars.registerHelper('nome', function(nome) {
  return formatadores.capitalizarNome(nome || '');
});

// Formatar moeda
Handlebars.registerHelper('moeda', function(valor) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(valor || 0);
});

// Maiúsculas
Handlebars.registerHelper('maiusculas', function(texto) {
  return (texto || '').toUpperCase();
});

// Minúsculas
Handlebars.registerHelper('minusculas', function(texto) {
  return (texto || '').toLowerCase();
});

// Condicional se igual
Handlebars.registerHelper('seIgual', function(a, b, options) {
  return a === b ? options.fn(this) : options.inverse(this);
});

// Condicional se não vazio
Handlebars.registerHelper('sePreenchido', function(valor, options) {
  return valor && valor.trim() ? options.fn(this) : options.inverse(this);
});

// Iterador com índice
Handlebars.registerHelper('cadaComIndice', function(arr, options) {
  let result = '';
  for (let i = 0; i < arr.length; i++) {
    result += options.fn({ ...arr[i], indice: i + 1, primeiro: i === 0, ultimo: i === arr.length - 1 });
  }
  return result;
});

// Número romano
Handlebars.registerHelper('romano', function(numero) {
  const romanos = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X',
    'XI', 'XII', 'XIII', 'XIV', 'XV', 'XVI', 'XVII', 'XVIII', 'XIX', 'XX'];
  return romanos[numero] || numero;
});

// Alínea
Handlebars.registerHelper('alinea', function(numero) {
  return String.fromCharCode(96 + numero); // a, b, c, d...
});

// ============================================================================
// TEMPLATES JURÍDICOS
// ============================================================================

export const TEMPLATES = {
  // ========================================================================
  // CABEÇALHO PADRÃO
  // ========================================================================
  cabecalho: `EXCELENTÍSSIMO(A) SENHOR(A) DOUTOR(A) {{cargo}} {{tribunal}}

{{#if numeroProcesso}}
Processo nº {{processoCNJ numeroProcesso}}
{{/if}}

`,

  // ========================================================================
  // QUALIFICAÇÃO DAS PARTES
  // ========================================================================
  qualificacaoAutor: `{{nome nomeAutor}}, {{nacionalidadeAutor}}, {{estadoCivilAutor}}, {{profissaoAutor}}, inscrito(a) no CPF sob nº {{cpf cpfAutor}}{{#sePreenchido rgAutor}}, RG nº {{rgAutor}}{{/sePreenchido}}, residente e domiciliado(a) em {{enderecoAutor}}`,

  qualificacaoReu: `{{nome nomeReu}}, {{nacionalidadeReu}}, {{estadoCivilReu}}, {{profissaoReu}}, inscrito(a) no CPF sob nº {{cpf cpfReu}}{{#sePreenchido rgReu}}, RG nº {{rgReu}}{{/sePreenchido}}, residente e domiciliado(a) em {{enderecoReu}}`,

  qualificacaoPJ: `{{nome razaoSocial}}, pessoa jurídica de direito privado, inscrita no CNPJ sob nº {{cnpj cnpj}}, com sede em {{endereco}}`,

  // ========================================================================
  // PETIÇÃO INICIAL
  // ========================================================================
  peticaoInicial: `EXCELENTÍSSIMO(A) SENHOR(A) DOUTOR(A) JUIZ(A) DE DIREITO DA {{maiusculas vara}} DA COMARCA DE {{maiusculas comarca}}/{{uf}}








{{nome nomeAutor}}, {{nacionalidadeAutor}}, {{estadoCivilAutor}}, {{profissaoAutor}}, inscrito(a) no CPF sob nº {{cpf cpfAutor}}{{#sePreenchido rgAutor}}, RG nº {{rgAutor}}{{/sePreenchido}}, residente e domiciliado(a) em {{enderecoAutor}}, por seu(sua) advogado(a) que esta subscreve (procuração anexa), com escritório profissional em {{enderecoAdvogado}}, onde recebe intimações, vem, respeitosamente, à presença de Vossa Excelência, com fundamento {{fundamentoLegal}}, propor a presente

{{maiusculas tipoAcao}}

em face de {{nome nomeReu}}, {{nacionalidadeReu}}, {{estadoCivilReu}}, {{profissaoReu}}, inscrito(a) no CPF sob nº {{cpf cpfReu}}, residente e domiciliado(a) em {{enderecoReu}}, pelos fatos e fundamentos a seguir expostos:

I - DOS FATOS

{{fatos}}

II - DO DIREITO

{{direito}}

{{#sePreenchido danoMoral}}
III - DO DANO MORAL

{{danoMoral}}

{{/sePreenchido}}
{{#sePreenchido danoMaterial}}
{{#sePreenchido danoMoral}}IV{{else}}III{{/sePreenchido}} - DO DANO MATERIAL

{{danoMaterial}}

{{/sePreenchido}}
{{romano ultimaSecao}} - DOS PEDIDOS

Ante o exposto, requer a Vossa Excelência:

{{#cadaComIndice pedidos}}
{{alinea indice}}) {{this.texto}};
{{/cadaComIndice}}

{{#sePreenchido tutela}}
{{romano penultimaSecao}} - DA TUTELA DE URGÊNCIA

{{tutela}}

{{/sePreenchido}}
Requer, ainda:

a) a citação do(a) réu(ré) para, querendo, contestar a presente ação, sob pena de revelia e confissão;
b) a produção de todas as provas admitidas em direito, especialmente a documental, testemunhal e pericial, se necessário;
c) a condenação do(a) réu(ré) ao pagamento das custas processuais e honorários advocatícios.

Dá-se à causa o valor de {{moeda valorCausa}} ({{valorCausaExtenso}}).

Termos em que,
Pede deferimento.

{{comarca}}/{{uf}}, {{dataAtual 'extenso'}}.



_______________________________
{{nome nomeAdvogado}}
OAB/{{ufAdvogado}} {{numeroOAB}}
`,

  // ========================================================================
  // CONTESTAÇÃO
  // ========================================================================
  contestacao: `EXCELENTÍSSIMO(A) SENHOR(A) DOUTOR(A) JUIZ(A) DE DIREITO DA {{maiusculas vara}} DA COMARCA DE {{maiusculas comarca}}/{{uf}}

Processo nº {{processoCNJ numeroProcesso}}

{{nome nomeReu}}, já qualificado(a) nos autos do processo em epígrafe que lhe move {{nome nomeAutor}}, vem, respeitosamente, por seu(sua) advogado(a) que esta subscreve, apresentar

CONTESTAÇÃO

nos termos do art. 335 e seguintes do Código de Processo Civil, pelos fatos e fundamentos a seguir expostos:

I - SÍNTESE DA INICIAL

{{sinteseInicial}}

{{#sePreenchido preliminares}}
II - DAS PRELIMINARES

{{#cadaComIndice preliminares}}
{{romano indice}}. {{this.titulo}}

{{this.texto}}

{{/cadaComIndice}}
{{/sePreenchido}}

{{#sePreenchido prejudiciais}}
{{#sePreenchido preliminares}}III{{else}}II{{/sePreenchido}} - DAS PREJUDICIAIS DE MÉRITO

{{#cadaComIndice prejudiciais}}
{{romano indice}}. {{this.titulo}}

{{this.texto}}

{{/cadaComIndice}}
{{/sePreenchido}}

{{romano secaoMerito}} - DO MÉRITO

{{merito}}

{{romano ultimaSecao}} - DOS PEDIDOS

Ante o exposto, requer:

a) o acolhimento das preliminares arguidas, com a extinção do processo sem resolução do mérito;
b) subsidiariamente, a improcedência total dos pedidos autorais;
c) a condenação do(a) autor(a) ao pagamento das custas processuais e honorários advocatícios.

Protesta por todos os meios de prova admitidos em direito.

Termos em que,
Pede deferimento.

{{comarca}}/{{uf}}, {{dataAtual 'extenso'}}.



_______________________________
{{nome nomeAdvogado}}
OAB/{{ufAdvogado}} {{numeroOAB}}
`,

  // ========================================================================
  // HABEAS CORPUS
  // ========================================================================
  habeasCorpus: `EXCELENTÍSSIMO(A) SENHOR(A) DOUTOR(A) DESEMBARGADOR(A) PRESIDENTE DO EGRÉGIO TRIBUNAL DE JUSTIÇA DO ESTADO DE {{maiusculas uf}}

HABEAS CORPUS
COM PEDIDO DE LIMINAR

Paciente: {{maiusculas nomePaciente}}
Autoridade Coatora: {{autoridadeCoatora}}
Processo de Origem: {{processoCNJ processoOrigem}}

{{nome nomeImpetrante}}, advogado(a) inscrito(a) na OAB/{{ufAdvogado}} sob nº {{numeroOAB}}, com escritório profissional em {{enderecoAdvogado}}, vem, respeitosamente, à presença de Vossa Excelência, com fundamento no art. 5º, inciso LXVIII, da Constituição Federal, e nos artigos 647 e seguintes do Código de Processo Penal, impetrar a presente ordem de

HABEAS CORPUS
COM PEDIDO DE LIMINAR

em favor de {{nome nomePaciente}}, {{nacionalidadePaciente}}, {{estadoCivilPaciente}}, {{profissaoPaciente}}, inscrito(a) no CPF sob nº {{cpf cpfPaciente}}, atualmente {{situacaoPaciente}}, apontando como autoridade coatora o(a) {{autoridadeCoatora}}, pelos fatos e fundamentos a seguir expostos:

I - DOS FATOS

{{fatos}}

II - DO CONSTRANGIMENTO ILEGAL

{{constrangimentoIlegal}}

III - DO CABIMENTO DO HABEAS CORPUS

O presente writ encontra amparo no art. 5º, inciso LXVIII, da Constituição Federal, que assegura que "conceder-se-á habeas corpus sempre que alguém sofrer ou se achar ameaçado de sofrer violência ou coação em sua liberdade de locomoção, por ilegalidade ou abuso de poder".

{{#sePreenchido hipoteseCabimento}}
{{hipoteseCabimento}}
{{/sePreenchido}}

IV - DO FUMUS BONI IURIS E PERICULUM IN MORA

{{fumusBoniIuris}}

V - DOS PEDIDOS

Ante o exposto, requer:

a) LIMINARMENTE, {{pedidoLiminar}};
b) a notificação da autoridade coatora para prestar informações no prazo legal;
c) a oitiva do Ministério Público;
d) no mérito, a CONCESSÃO DEFINITIVA DA ORDEM para {{pedidoDefinitivo}}.

{{#sePreenchido pedidoSubsidiario}}
Subsidiariamente, requer {{pedidoSubsidiario}}.
{{/sePreenchido}}

Termos em que,
Pede deferimento.

{{comarca}}/{{uf}}, {{dataAtual 'extenso'}}.



_______________________________
{{nome nomeImpetrante}}
OAB/{{ufAdvogado}} {{numeroOAB}}
`,

  // ========================================================================
  // CONTRATO DE HONORÁRIOS
  // ========================================================================
  contratoHonorarios: `CONTRATO DE HONORÁRIOS ADVOCATÍCIOS

Pelo presente instrumento particular, de um lado,

CONTRATANTE: {{nome nomeContratante}}, {{nacionalidadeContratante}}, {{estadoCivilContratante}}, {{profissaoContratante}}, inscrito(a) no CPF sob nº {{cpf cpfContratante}}, residente e domiciliado(a) em {{enderecoContratante}};

CONTRATADO: {{nome nomeAdvogado}}, advogado(a) inscrito(a) na OAB/{{ufAdvogado}} sob nº {{numeroOAB}}, com escritório profissional em {{enderecoEscritorio}};

Têm entre si justo e contratado o seguinte:

CLÁUSULA PRIMEIRA - DO OBJETO
O(A) CONTRATADO(A) se obriga a prestar serviços advocatícios ao(à) CONTRATANTE, consistentes em {{objetoContrato}}.

CLÁUSULA SEGUNDA - DOS HONORÁRIOS
Pelos serviços prestados, o(a) CONTRATANTE pagará ao(à) CONTRATADO(A):

{{#sePreenchido honorariosFixos}}
a) Honorários fixos no valor de {{moeda honorariosFixos}} ({{honorariosFixosExtenso}}), {{formaPagementoFixos}};
{{/sePreenchido}}

{{#sePreenchido honorariosExito}}
b) Honorários de êxito correspondentes a {{percentualExito}}% ({{percentualExitoExtenso}} por cento) sobre o proveito econômico obtido, devidos ao final da demanda;
{{/sePreenchido}}

{{#sePreenchido honorariosSucumbencia}}
c) Honorários sucumbenciais, que pertencem exclusivamente ao(à) advogado(a);
{{/sePreenchido}}

CLÁUSULA TERCEIRA - DAS DESPESAS
As despesas processuais, tais como custas, emolumentos, honorários periciais, deslocamentos e outras, correrão por conta do(a) CONTRATANTE, {{condicoesDespesas}}.

CLÁUSULA QUARTA - DAS OBRIGAÇÕES DO CONTRATANTE
O(A) CONTRATANTE se obriga a:
a) fornecer todos os documentos e informações necessários à defesa de seus interesses;
b) comparecer aos atos processuais quando convocado(a);
c) manter seus dados cadastrais atualizados;
d) pagar pontualmente os honorários e despesas contratados.

CLÁUSULA QUINTA - DAS OBRIGAÇÕES DO CONTRATADO
O(A) CONTRATADO(A) se obriga a:
a) defender os interesses do(a) CONTRATANTE com zelo, diligência e sigilo profissional;
b) manter o(a) CONTRATANTE informado(a) sobre o andamento do processo;
c) praticar os atos processuais necessários nos prazos legais.

CLÁUSULA SEXTA - DA RESCISÃO
O presente contrato poderá ser rescindido:
a) por acordo entre as partes;
b) por revogação do mandato pelo(a) CONTRATANTE, caso em que serão devidos os honorários proporcionais aos serviços prestados;
c) por renúncia do(a) CONTRATADO(A), nos termos do art. 5º do Código de Ética da OAB.

CLÁUSULA SÉTIMA - DO FORO
Fica eleito o foro da Comarca de {{comarcaForo}}/{{ufForo}} para dirimir quaisquer dúvidas oriundas do presente contrato.

E por estarem assim justas e contratadas, as partes assinam o presente instrumento em duas vias de igual teor e forma.

{{comarca}}/{{uf}}, {{dataAtual 'extenso'}}.



_______________________________
CONTRATANTE: {{nome nomeContratante}}
CPF: {{cpf cpfContratante}}



_______________________________
CONTRATADO(A): {{nome nomeAdvogado}}
OAB/{{ufAdvogado}} {{numeroOAB}}
`,

  // ========================================================================
  // PROCURAÇÃO AD JUDICIA
  // ========================================================================
  procuracao: `PROCURAÇÃO AD JUDICIA

OUTORGANTE: {{nome nomeOutorgante}}, {{nacionalidadeOutorgante}}, {{estadoCivilOutorgante}}, {{profissaoOutorgante}}, inscrito(a) no CPF sob nº {{cpf cpfOutorgante}}{{#sePreenchido rgOutorgante}}, RG nº {{rgOutorgante}}{{/sePreenchido}}, residente e domiciliado(a) em {{enderecoOutorgante}}.

OUTORGADO(A): {{nome nomeAdvogado}}, advogado(a) inscrito(a) na OAB/{{ufAdvogado}} sob nº {{numeroOAB}}, com escritório profissional em {{enderecoEscritorio}}.

PODERES: O(A) OUTORGANTE nomeia e constitui seu(sua) bastante procurador(a) o(a) advogado(a) acima qualificado(a), a quem confere amplos poderes para o foro em geral, com a cláusula "ad judicia", para representá-lo(a) em qualquer Juízo, Instância ou Tribunal, podendo propor contra quem de direito as ações competentes e defendê-lo(a) nas contrárias, seguindo umas e outras, até final decisão, usando os recursos legais e acompanhando-os, conferindo-lhe, ainda, poderes especiais para {{poderesEspeciais}}, dando tudo por bom, firme e valioso, especialmente para {{objetoProcuracao}}.

{{comarca}}/{{uf}}, {{dataAtual 'extenso'}}.



_______________________________
{{nome nomeOutorgante}}
CPF: {{cpf cpfOutorgante}}
`
};

// ============================================================================
// COMPILADOR DE TEMPLATES
// ============================================================================

class TemplateEngine {
  constructor() {
    this.templateCache = new Map();
  }

  /**
   * Compila um template
   */
  compilar(nomeTemplate) {
    if (this.templateCache.has(nomeTemplate)) {
      return this.templateCache.get(nomeTemplate);
    }

    const template = TEMPLATES[nomeTemplate];
    if (!template) {
      throw new Error(`Template não encontrado: ${nomeTemplate}`);
    }

    const compilado = Handlebars.compile(template);
    this.templateCache.set(nomeTemplate, compilado);
    return compilado;
  }

  /**
   * Renderiza um template com dados
   */
  renderizar(nomeTemplate, dados) {
    const template = this.compilar(nomeTemplate);
    return template(dados);
  }

  /**
   * Lista templates disponíveis
   */
  listarTemplates() {
    return Object.keys(TEMPLATES);
  }

  /**
   * Adiciona template personalizado
   */
  adicionarTemplate(nome, template) {
    TEMPLATES[nome] = template;
    this.templateCache.delete(nome);
  }

  /**
   * Renderiza petição inicial completa
   */
  renderizarPeticaoInicial(dados) {
    // Calcular seções
    let secaoAtual = 2; // I - FATOS, II - DIREITO
    if (dados.danoMoral) secaoAtual++;
    if (dados.danoMaterial) secaoAtual++;
    dados.ultimaSecao = secaoAtual + 1;
    dados.penultimaSecao = secaoAtual;

    return this.renderizar('peticaoInicial', dados);
  }

  /**
   * Renderiza contestação completa
   */
  renderizarContestacao(dados) {
    let secaoMerito = 2;
    if (dados.preliminares && dados.preliminares.length > 0) secaoMerito++;
    if (dados.prejudiciais && dados.prejudiciais.length > 0) secaoMerito++;
    dados.secaoMerito = secaoMerito;
    dados.ultimaSecao = secaoMerito + 1;

    return this.renderizar('contestacao', dados);
  }

  /**
   * Renderiza habeas corpus completo
   */
  renderizarHabeasCorpus(dados) {
    return this.renderizar('habeasCorpus', dados);
  }

  /**
   * Renderiza contrato de honorários
   */
  renderizarContratoHonorarios(dados) {
    return this.renderizar('contratoHonorarios', dados);
  }

  /**
   * Renderiza procuração
   */
  renderizarProcuracao(dados) {
    return this.renderizar('procuracao', dados);
  }
}

// ============================================================================
// EXPORTAÇÃO
// ============================================================================

export const templateEngine = new TemplateEngine();

export default {
  TEMPLATES,
  templateEngine,
  Handlebars
};
