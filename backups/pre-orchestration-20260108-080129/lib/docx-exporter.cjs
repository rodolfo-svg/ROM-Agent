/**
 * ROM Agent - Exportador DOCX Profissional
 *
 * Exporta documentos jurídicos em formato .docx com:
 * - Formatação profissional (Times New Roman 12pt)
 * - Papel timbrado (header personalizado)
 * - Margens ABNT (3cm esquerda, 2cm demais)
 * - Espaçamento 1.5
 * - Parágrafos justificados com recuo
 * - Citações ABNT formatadas
 * - Rodapé com informações do escritório
 *
 * @version 1.0.0
 */

const {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  PageBreak,
  Header,
  Footer,
  ImageRun,
  ExternalHyperlink,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
  convertInchesToTwip,
  UnderlineType
} = require('docx');

const fs = require('fs');
const path = require('path');

// ============================================================
// CONFIGURAÇÕES PADRÃO
// ============================================================

const DEFAULT_CONFIG = {
  // Fontes
  fontFamily: 'Calibri',
  fontSize: 24, // 12pt (half-points)

  // Margens ABNT (em twips: 1440 twips = 1 inch = 2.54cm)
  margins: {
    top: convertInchesToTwip(0.79),    // 2cm
    right: convertInchesToTwip(0.79),  // 2cm
    bottom: convertInchesToTwip(0.79), // 2cm
    left: convertInchesToTwip(1.18)    // 3cm (ABNT)
  },

  // Espaçamento
  spacing: {
    line: 360,  // 1.5 linhas (240 = 1 linha, 360 = 1.5 linhas)
    before: 0,
    after: 240  // Espaço após parágrafo
  },

  // Recuo de parágrafo (2cm = 1134 twips)
  indent: {
    firstLine: convertInchesToTwip(0.79) // 2cm
  }
};

// ============================================================
// CLASSE PRINCIPAL
// ============================================================

class DOCXExporter {
  constructor(config = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Cria documento jurídico completo
   *
   * @param {object} options - Opções do documento
   * @returns {Promise<Buffer>} Buffer do arquivo DOCX
   */
  async createLegalDocument(options) {
    const {
      titulo = 'DOCUMENTO JURÍDICO',
      subtitulo = '',
      conteudo = '',
      conteudoHTML = '',
      citacoes = [],
      referencias = [],
      timbrado = {
        escritorio: 'Rodolfo Otávio Mota Advogados Associados',
        oab: 'OAB/MG',
        endereco: 'Belo Horizonte - MG',
        email: 'contato@rom.adv.br',
        telefone: '',
        site: ''
      },
      metadata = {
        autor: 'ROM Agent v2.6.0',
        assunto: '',
        palavrasChave: []
      }
    } = options;

    // Criar seções do documento
    const sections = [];

    // ===== PRIMEIRA PÁGINA COM TIMBRADO =====
    const firstPageChildren = [];

    // Logo/Timbrado (simulado com texto formatado)
    firstPageChildren.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 240 },
        children: [
          new TextRun({
            text: timbrado.escritorio.toUpperCase(),
            font: this.config.fontFamily,
            size: 28, // 14pt
            bold: true,
            color: 'D4AF37' // Dourado
          })
        ]
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 240 },
        children: [
          new TextRun({
            text: `${timbrado.oab} • ${timbrado.endereco}`,
            font: this.config.fontFamily,
            size: 20, // 10pt
            color: '666666'
          })
        ]
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 480 }, // Espaço maior
        children: [
          new TextRun({
            text: timbrado.email,
            font: this.config.fontFamily,
            size: 20,
            color: '666666'
          })
        ]
      })
    );

    // Linha separadora
    firstPageChildren.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 480 },
        border: {
          bottom: {
            color: 'D4AF37',
            space: 1,
            value: 'single',
            size: 6
          }
        }
      })
    );

    // Título do documento
    firstPageChildren.push(
      new Paragraph({
        text: titulo.toUpperCase(),
        heading: HeadingLevel.HEADING_1,
        alignment: AlignmentType.CENTER,
        spacing: { before: 240, after: 240 },
        children: [
          new TextRun({
            text: titulo.toUpperCase(),
            font: this.config.fontFamily,
            size: 28, // 14pt
            bold: true
          })
        ]
      })
    );

    // Subtítulo (se houver)
    if (subtitulo) {
      firstPageChildren.push(
        new Paragraph({
          text: subtitulo,
          heading: HeadingLevel.HEADING_2,
          alignment: AlignmentType.CENTER,
          spacing: { after: 480 },
          children: [
            new TextRun({
              text: subtitulo,
              font: this.config.fontFamily,
              size: 24, // 12pt
              italics: true
            })
          ]
        })
      );
    }

    // Conteúdo principal
    const contentParagraphs = this.parseContent(conteudo || conteudoHTML);
    firstPageChildren.push(...contentParagraphs);

    // Citações (se houver)
    if (citacoes && citacoes.length > 0) {
      firstPageChildren.push(
        new Paragraph({
          text: '',
          pageBreakBefore: true
        }),
        new Paragraph({
          text: 'CITAÇÕES',
          heading: HeadingLevel.HEADING_1,
          alignment: AlignmentType.CENTER,
          spacing: { before: 240, after: 480 },
          children: [
            new TextRun({
              text: 'CITAÇÕES',
              font: this.config.fontFamily,
              size: 28,
              bold: true
            })
          ]
        })
      );

      citacoes.forEach((citacao, index) => {
        firstPageChildren.push(
          new Paragraph({
            spacing: { after: 240 },
            indent: { left: convertInchesToTwip(0.5) },
            children: [
              new TextRun({
                text: `[${index + 1}] `,
                font: this.config.fontFamily,
                size: this.config.fontSize,
                bold: true
              }),
              new TextRun({
                text: citacao,
                font: this.config.fontFamily,
                size: this.config.fontSize
              })
            ]
          })
        );
      });
    }

    // Referências bibliográficas (se houver)
    if (referencias && referencias.length > 0) {
      firstPageChildren.push(
        new Paragraph({
          text: '',
          pageBreakBefore: true
        }),
        new Paragraph({
          text: 'REFERÊNCIAS',
          heading: HeadingLevel.HEADING_1,
          alignment: AlignmentType.CENTER,
          spacing: { before: 240, after: 480 },
          children: [
            new TextRun({
              text: 'REFERÊNCIAS',
              font: this.config.fontFamily,
              size: 28,
              bold: true
            })
          ]
        })
      );

      // Ordenar alfabeticamente
      const refsOrdenadas = referencias.slice().sort((a, b) => {
        const nomeA = a.tribunal || a.autor || a.autores?.[0] || '';
        const nomeB = b.tribunal || b.autor || b.autores?.[0] || '';
        return nomeA.localeCompare(nomeB, 'pt-BR');
      });

      refsOrdenadas.forEach(ref => {
        const refFormatada = this.formatarReferenciaABNT(ref);
        firstPageChildren.push(
          new Paragraph({
            spacing: { after: 240 },
            indent: { left: convertInchesToTwip(0), hanging: convertInchesToTwip(0.79) }, // Recuo pendente
            children: [
              new TextRun({
                text: refFormatada,
                font: this.config.fontFamily,
                size: this.config.fontSize
              })
            ]
          })
        );
      });
    }

    // Criar seção
    sections.push({
      properties: {
        page: {
          margin: this.config.margins
        }
      },
      headers: {
        default: new Header({
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [
                new TextRun({
                  text: timbrado.escritorio,
                  font: this.config.fontFamily,
                  size: 18,
                  color: '999999'
                })
              ]
            })
          ]
        })
      },
      footers: {
        default: new Footer({
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [
                new TextRun({
                  text: `${timbrado.escritorio} • ${timbrado.oab} • ${timbrado.email}`,
                  font: this.config.fontFamily,
                  size: 18,
                  color: '999999'
                })
              ]
            }),
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [
                new TextRun({
                  text: 'Página ',
                  font: this.config.fontFamily,
                  size: 18,
                  color: '999999'
                }),
                new TextRun({
                  children: ['PAGE_NUMBER'],
                  font: this.config.fontFamily,
                  size: 18,
                  color: '999999'
                }),
                new TextRun({
                  text: ' de ',
                  font: this.config.fontFamily,
                  size: 18,
                  color: '999999'
                }),
                new TextRun({
                  children: ['NUMPAGES'],
                  font: this.config.fontFamily,
                  size: 18,
                  color: '999999'
                })
              ]
            })
          ]
        })
      },
      children: firstPageChildren
    });

    // Criar documento
    const doc = new Document({
      creator: metadata.autor || 'ROM Agent v2.6.0',
      title: titulo,
      description: metadata.assunto || '',
      keywords: metadata.palavrasChave?.join(', ') || '',
      sections: sections
    });

    // Gerar buffer
    const buffer = await Packer.toBuffer(doc);
    return buffer;
  }

  /**
   * Parseia conteúdo em parágrafos formatados
   */
  parseContent(content) {
    const paragraphs = [];

    // Dividir por parágrafos
    const lines = content.split(/\n\n+/);

    for (const line of lines) {
      if (!line.trim()) continue;

      // Detectar títulos (linhas em MAIÚSCULAS)
      const isTitle = line === line.toUpperCase() && line.length < 100;

      if (isTitle) {
        paragraphs.push(
          new Paragraph({
            text: line.trim(),
            heading: HeadingLevel.HEADING_2,
            alignment: AlignmentType.CENTER,
            spacing: { before: 480, after: 240 },
            children: [
              new TextRun({
                text: line.trim(),
                font: this.config.fontFamily,
                size: 26, // 13pt
                bold: true
              })
            ]
          })
        );
      } else {
        // Parágrafo normal
        paragraphs.push(
          new Paragraph({
            alignment: AlignmentType.JUSTIFIED,
            spacing: this.config.spacing,
            indent: this.config.indent,
            children: [
              new TextRun({
                text: line.trim(),
                font: this.config.fontFamily,
                size: this.config.fontSize
              })
            ]
          })
        );
      }
    }

    return paragraphs;
  }

  /**
   * Formata referência em ABNT (texto simples para DOCX)
   */
  formatarReferenciaABNT(ref) {
    const partes = [];

    // Tribunal/Autor
    if (ref.tribunal) {
      partes.push(ref.tribunal.toUpperCase());
    } else if (ref.autores && ref.autores.length > 0) {
      const autor = ref.autores[0];
      const nomes = autor.split(/\s+/);
      if (nomes.length > 1) {
        const sobrenome = nomes[nomes.length - 1].toUpperCase();
        const nome = nomes.slice(0, -1).join(' ');
        partes.push(`${sobrenome}, ${nome}`);
      } else {
        partes.push(autor.toUpperCase());
      }
    } else if (ref.autor) {
      partes.push(ref.autor.toUpperCase());
    }

    // Título/Número
    if (ref.classe && ref.numero) {
      partes.push(`${ref.classe} ${ref.numero}`);
    } else if (ref.numero) {
      partes.push(ref.numero);
    } else if (ref.titulo) {
      partes.push(ref.titulo);
    }

    // Relator
    if (ref.relator) {
      partes.push(`Relator: ${ref.relator}`);
    }

    // Data
    if (ref.data) {
      partes.push(ref.data);
    }

    // Ementa (resumida para referências)
    if (ref.ementa && ref.ementa.length > 200) {
      partes.push(ref.ementa.substring(0, 200) + '...');
    } else if (ref.ementa) {
      partes.push(ref.ementa);
    }

    // Link
    if (ref.link) {
      partes.push(`Disponível em: ${ref.link}. Acesso em: ${new Date().toLocaleDateString('pt-BR')}`);
    }

    return partes.join('. ') + '.';
  }

  /**
   * Salva arquivo DOCX no sistema de arquivos
   */
  async saveToFile(buffer, filename) {
    const filepath = path.resolve(filename);
    fs.writeFileSync(filepath, buffer);
    return filepath;
  }
}

// ============================================================
// FUNÇÃO DE CONVENIÊNCIA
// ============================================================

/**
 * Exporta documento jurídico para DOCX
 *
 * @param {object} options - Opções do documento
 * @param {string} outputPath - Caminho de saída (opcional)
 * @returns {Promise<Buffer|string>} Buffer ou caminho do arquivo
 */
async function exportToDocx(options, outputPath = null) {
  const exporter = new DOCXExporter();
  const buffer = await exporter.createLegalDocument(options);

  if (outputPath) {
    const filepath = await exporter.saveToFile(buffer, outputPath);
    return filepath;
  }

  return buffer;
}

// ============================================================
// EXPORTAÇÕES
// ============================================================

module.exports = {
  DOCXExporter,
  exportToDocx,
  DEFAULT_CONFIG
};
