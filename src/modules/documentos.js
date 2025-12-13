/**
 * ROM Agent - Módulo de Formatação e Documentos
 * Criação de documentos, tabelas, fluxos, linhas do tempo e formatação
 */

import { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
         Header, Footer, ImageRun, AlignmentType, BorderStyle,
         WidthType, HeadingLevel, PageBreak } from 'docx';
import PDFDocument from 'pdfkit';
import * as fs from 'fs';
import * as path from 'path';

// Configurações padrão de papel timbrado
const PAPEL_TIMBRADO_CONFIG = {
  margens: {
    top: 720,    // 0.5 inch em twips
    bottom: 720,
    left: 1080,  // 0.75 inch
    right: 1080
  },
  fonte: {
    principal: 'Times New Roman',
    secundaria: 'Arial',
    tamanho: {
      titulo: 14,
      subtitulo: 12,
      corpo: 12,
      citacao: 11,
      rodape: 10
    }
  },
  espacamento: {
    linha: 1.5,
    paragrafo: {
      antes: 0,
      depois: 120
    }
  }
};

// Estruturas de peças jurídicas
const ESTRUTURAS_PECAS = {
  peticao_inicial: [
    'enderecamento',
    'qualificacao_partes',
    'dos_fatos',
    'do_direito',
    'dos_pedidos',
    'do_valor_da_causa',
    'fechamento'
  ],
  contestacao: [
    'enderecamento',
    'qualificacao',
    'preliminares',
    'do_merito',
    'dos_pedidos',
    'fechamento'
  ],
  recurso_apelacao: [
    'enderecamento',
    'qualificacao',
    'tempestividade',
    'preparo',
    'razoes',
    'do_cabimento',
    'dos_fatos',
    'do_direito',
    'dos_pedidos',
    'fechamento'
  ],
  habeas_corpus: [
    'enderecamento',
    'qualificacao_paciente',
    'qualificacao_autoridade',
    'dos_fatos',
    'do_direito',
    'do_constrangimento_ilegal',
    'dos_pedidos',
    'fechamento'
  ],
  agravo: [
    'enderecamento',
    'qualificacao',
    'tempestividade',
    'da_decisao_agravada',
    'das_razoes',
    'dos_pedidos',
    'fechamento'
  ]
};

/**
 * Criar documento DOCX com papel timbrado
 */
export async function criarDocumentoTimbrado(conteudo, opcoes = {}) {
  const {
    titulo = 'Documento Jurídico',
    timbrado = null,
    rodape = null,
    margens = PAPEL_TIMBRADO_CONFIG.margens
  } = opcoes;

  const children = [];

  // Adicionar título
  children.push(
    new Paragraph({
      children: [
        new TextRun({
          text: titulo.toUpperCase(),
          bold: true,
          size: 28,
          font: PAPEL_TIMBRADO_CONFIG.fonte.principal
        })
      ],
      alignment: AlignmentType.CENTER,
      spacing: { after: 400 }
    })
  );

  // Adicionar conteúdo
  if (typeof conteudo === 'string') {
    const paragrafos = conteudo.split('\n\n');
    for (const paragrafo of paragrafos) {
      children.push(
        new Paragraph({
          children: [
            new TextRun({
              text: paragrafo,
              size: 24,
              font: PAPEL_TIMBRADO_CONFIG.fonte.principal
            })
          ],
          alignment: AlignmentType.JUSTIFIED,
          spacing: {
            line: 360, // 1.5 linhas
            after: 200
          },
          indent: {
            firstLine: 720 // Recuo de primeira linha
          }
        })
      );
    }
  }

  const doc = new Document({
    sections: [{
      properties: {
        page: {
          margin: margens
        }
      },
      headers: timbrado ? {
        default: new Header({
          children: [
            new Paragraph({
              children: [
                new TextRun({ text: timbrado })
              ],
              alignment: AlignmentType.CENTER
            })
          ]
        })
      } : undefined,
      footers: rodape ? {
        default: new Footer({
          children: [
            new Paragraph({
              children: [
                new TextRun({ text: rodape, size: 20 })
              ],
              alignment: AlignmentType.CENTER
            })
          ]
        })
      } : undefined,
      children
    }]
  });

  return doc;
}

/**
 * Criar tabela formatada
 */
export function criarTabela(dados, opcoes = {}) {
  const {
    cabecalho = true,
    bordas = true,
    larguras = null
  } = opcoes;

  if (!dados || dados.length === 0) {
    throw new Error('Dados da tabela não podem estar vazios');
  }

  const rows = [];
  const numColunas = dados[0].length;
  const larguraColuna = larguras || Array(numColunas).fill(Math.floor(9000 / numColunas));

  for (let i = 0; i < dados.length; i++) {
    const cells = dados[i].map((celula, j) => {
      return new TableCell({
        children: [
          new Paragraph({
            children: [
              new TextRun({
                text: String(celula),
                bold: cabecalho && i === 0,
                size: 22
              })
            ],
            alignment: AlignmentType.CENTER
          })
        ],
        width: {
          size: larguraColuna[j],
          type: WidthType.DXA
        },
        borders: bordas ? {
          top: { style: BorderStyle.SINGLE, size: 1 },
          bottom: { style: BorderStyle.SINGLE, size: 1 },
          left: { style: BorderStyle.SINGLE, size: 1 },
          right: { style: BorderStyle.SINGLE, size: 1 }
        } : undefined
      });
    });

    rows.push(new TableRow({ children: cells }));
  }

  return new Table({ rows });
}

/**
 * Criar linha do tempo (timeline)
 */
export function criarLinhaDoTempo(eventos) {
  const elementos = [];

  elementos.push(
    new Paragraph({
      children: [
        new TextRun({
          text: 'LINHA DO TEMPO DOS FATOS',
          bold: true,
          size: 26
        })
      ],
      alignment: AlignmentType.CENTER,
      spacing: { after: 400 }
    })
  );

  for (let i = 0; i < eventos.length; i++) {
    const evento = eventos[i];

    // Data do evento
    elementos.push(
      new Paragraph({
        children: [
          new TextRun({
            text: `${evento.data || `Evento ${i + 1}`}`,
            bold: true,
            size: 24
          })
        ],
        spacing: { before: 200 }
      })
    );

    // Descrição do evento
    elementos.push(
      new Paragraph({
        children: [
          new TextRun({
            text: `→ ${evento.descricao}`,
            size: 22
          })
        ],
        indent: { left: 720 },
        spacing: { after: 100 }
      })
    );

    // Linha conectora (exceto no último)
    if (i < eventos.length - 1) {
      elementos.push(
        new Paragraph({
          children: [
            new TextRun({
              text: '│',
              size: 22
            })
          ],
          indent: { left: 360 }
        })
      );
    }
  }

  return elementos;
}

/**
 * Criar quadro resumo
 */
export function criarQuadroResumo(dados) {
  const rows = [];

  // Título do quadro
  rows.push(
    new TableRow({
      children: [
        new TableCell({
          children: [
            new Paragraph({
              children: [
                new TextRun({
                  text: dados.titulo || 'QUADRO RESUMO',
                  bold: true,
                  size: 24
                })
              ],
              alignment: AlignmentType.CENTER
            })
          ],
          columnSpan: 2,
          shading: { fill: 'E0E0E0' }
        })
      ]
    })
  );

  // Itens do quadro
  for (const [chave, valor] of Object.entries(dados.itens || {})) {
    rows.push(
      new TableRow({
        children: [
          new TableCell({
            children: [
              new Paragraph({
                children: [
                  new TextRun({
                    text: chave,
                    bold: true,
                    size: 22
                  })
                ]
              })
            ],
            width: { size: 3000, type: WidthType.DXA }
          }),
          new TableCell({
            children: [
              new Paragraph({
                children: [
                  new TextRun({
                    text: String(valor),
                    size: 22
                  })
                ]
              })
            ],
            width: { size: 6000, type: WidthType.DXA }
          })
        ]
      })
    );
  }

  return new Table({ rows });
}

/**
 * Criar fluxograma em texto (Mermaid syntax)
 */
export function criarFluxograma(etapas) {
  let mermaid = 'graph TD\n';

  for (let i = 0; i < etapas.length; i++) {
    const etapa = etapas[i];
    const id = `A${i}`;
    const nextId = i < etapas.length - 1 ? `A${i + 1}` : null;

    mermaid += `    ${id}[${etapa.nome}]\n`;

    if (nextId) {
      const conexao = etapa.condicao ? `-->|${etapa.condicao}|` : '-->';
      mermaid += `    ${id} ${conexao} ${nextId}\n`;
    }
  }

  return {
    tipo: 'mermaid',
    codigo: mermaid,
    instrucao: 'Use este código Mermaid para gerar o fluxograma visual'
  };
}

/**
 * Aplicar formatação ABNT
 */
export function aplicarFormatacaoABNT(opcoes = {}) {
  return {
    fonte: 'Times New Roman',
    tamanho: 12,
    espacamento: 1.5,
    margens: {
      superior: '3cm',
      inferior: '2cm',
      esquerda: '3cm',
      direita: '2cm'
    },
    recuoParagrafo: '1.25cm',
    citacaoLonga: {
      recuo: '4cm',
      tamanho: 10,
      espacamento: 1.0
    },
    referencias: {
      espacamento: 1.0,
      alinhamento: 'esquerda'
    }
  };
}

/**
 * Gerar estrutura de peça jurídica
 */
export function gerarEstruturaPeca(tipoPeca) {
  const estrutura = ESTRUTURAS_PECAS[tipoPeca];

  if (!estrutura) {
    throw new Error(`Tipo de peça "${tipoPeca}" não encontrado. Disponíveis: ${Object.keys(ESTRUTURAS_PECAS).join(', ')}`);
  }

  return {
    tipo: tipoPeca,
    secoes: estrutura,
    modelo: estrutura.map(secao => ({
      secao,
      titulo: secao.replace(/_/g, ' ').toUpperCase(),
      conteudo: `[Inserir conteúdo de ${secao}]`
    }))
  };
}

/**
 * Exportar documento
 */
export async function exportarDocumento(doc, caminho, formato = 'docx') {
  if (formato === 'docx') {
    const buffer = await Packer.toBuffer(doc);
    fs.writeFileSync(caminho, buffer);
    return { sucesso: true, caminho, formato };
  }

  throw new Error(`Formato ${formato} não suportado. Use: docx`);
}

/**
 * Inserir imagem no documento
 */
export async function inserirImagem(caminhoImagem, opcoes = {}) {
  const {
    largura = 400,
    altura = 300,
    alinhamento = 'center'
  } = opcoes;

  const imageBuffer = fs.readFileSync(caminhoImagem);

  return new Paragraph({
    children: [
      new ImageRun({
        data: imageBuffer,
        transformation: {
          width: largura,
          height: altura
        }
      })
    ],
    alignment: alinhamento === 'center' ? AlignmentType.CENTER :
               alinhamento === 'right' ? AlignmentType.RIGHT : AlignmentType.LEFT
  });
}

/**
 * Listar estruturas de peças disponíveis
 */
export function listarEstruturasPecas() {
  return Object.entries(ESTRUTURAS_PECAS).map(([tipo, secoes]) => ({
    tipo,
    nome: tipo.replace(/_/g, ' ').toUpperCase(),
    secoes
  }));
}

export default {
  criarDocumentoTimbrado,
  criarTabela,
  criarLinhaDoTempo,
  criarQuadroResumo,
  criarFluxograma,
  aplicarFormatacaoABNT,
  gerarEstruturaPeca,
  exportarDocumento,
  inserirImagem,
  listarEstruturasPecas,
  PAPEL_TIMBRADO_CONFIG,
  ESTRUTURAS_PECAS
};
