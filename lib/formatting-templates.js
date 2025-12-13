/**
 * Sistema de Templates de Formatação para Documentos
 * Permite que cada parceiro tenha sua própria formatação para peças jurídicas
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TEMPLATES_FILE = path.join(__dirname, '../config/formatting-templates.json');

// Criar diretório se não existir
if (!fs.existsSync(path.dirname(TEMPLATES_FILE))) {
  fs.mkdirSync(path.dirname(TEMPLATES_FILE), { recursive: true });
}

/**
 * Presets de formatação padrão
 */
const FORMATTING_PRESETS = {
  // Padrão ABNT (Associação Brasileira de Normas Técnicas)
  abnt: {
    id: 'abnt',
    name: 'ABNT (Acadêmico)',
    description: 'Formatação padrão ABNT para documentos acadêmicos',
    font: {
      family: 'Arial',
      size: 12,
      color: '#000000'
    },
    paragraph: {
      alignment: 'justify', // left, right, center, justify
      lineSpacing: 1.5,
      spaceBefore: 0,
      spaceAfter: 0,
      firstLineIndent: 1.25, // cm
      hanging: 0
    },
    margins: {
      top: 3.0,    // cm
      bottom: 2.0,
      left: 3.0,
      right: 2.0
    },
    page: {
      size: 'A4',
      orientation: 'portrait' // portrait ou landscape
    },
    headings: {
      h1: { size: 14, bold: true, uppercase: true, spaceBefore: 12, spaceAfter: 6 },
      h2: { size: 13, bold: true, spaceBefore: 12, spaceAfter: 6 },
      h3: { size: 12, bold: true, spaceBefore: 6, spaceAfter: 3 }
    }
  },

  // Padrão OAB (Ordem dos Advogados do Brasil)
  oab: {
    id: 'oab',
    name: 'OAB (Petições)',
    description: 'Formatação tradicional OAB para peças processuais',
    font: {
      family: 'Times New Roman',
      size: 12,
      color: '#000000'
    },
    paragraph: {
      alignment: 'justify',
      lineSpacing: 1.5,
      spaceBefore: 6,
      spaceAfter: 6,
      firstLineIndent: 2.0,
      hanging: 0
    },
    margins: {
      top: 2.5,
      bottom: 2.5,
      left: 3.0,
      right: 2.0
    },
    page: {
      size: 'A4',
      orientation: 'portrait'
    },
    headings: {
      h1: { size: 14, bold: true, uppercase: true, alignment: 'center', spaceBefore: 12, spaceAfter: 12 },
      h2: { size: 12, bold: true, uppercase: false, spaceBefore: 12, spaceAfter: 6 },
      h3: { size: 12, bold: true, uppercase: false, spaceBefore: 6, spaceAfter: 3 }
    },
    numbering: {
      enabled: true,
      style: 'decimal', // decimal, roman, letter
      separator: '.'
    }
  },

  // Moderno/Minimalista
  modern: {
    id: 'modern',
    name: 'Moderno',
    description: 'Formatação moderna e clean',
    font: {
      family: 'Calibri',
      size: 11,
      color: '#2d3748'
    },
    paragraph: {
      alignment: 'left',
      lineSpacing: 1.3,
      spaceBefore: 3,
      spaceAfter: 3,
      firstLineIndent: 0,
      hanging: 0
    },
    margins: {
      top: 2.0,
      bottom: 2.0,
      left: 2.5,
      right: 2.5
    },
    page: {
      size: 'A4',
      orientation: 'portrait'
    },
    headings: {
      h1: { size: 16, bold: true, color: '#1a365d', spaceBefore: 12, spaceAfter: 6 },
      h2: { size: 14, bold: true, color: '#2c5282', spaceBefore: 9, spaceAfter: 6 },
      h3: { size: 12, bold: true, color: '#4a5568', spaceBefore: 6, spaceAfter: 3 }
    }
  },

  // Compacto (para documentos longos)
  compact: {
    id: 'compact',
    name: 'Compacto',
    description: 'Formatação compacta, economiza espaço',
    font: {
      family: 'Arial',
      size: 10,
      color: '#000000'
    },
    paragraph: {
      alignment: 'justify',
      lineSpacing: 1.15,
      spaceBefore: 0,
      spaceAfter: 3,
      firstLineIndent: 1.0,
      hanging: 0
    },
    margins: {
      top: 1.5,
      bottom: 1.5,
      left: 2.0,
      right: 2.0
    },
    page: {
      size: 'A4',
      orientation: 'portrait'
    },
    headings: {
      h1: { size: 12, bold: true, spaceBefore: 6, spaceAfter: 3 },
      h2: { size: 11, bold: true, spaceBefore: 6, spaceAfter: 3 },
      h3: { size: 10, bold: true, spaceBefore: 3, spaceAfter: 0 }
    }
  },

  // Clássico (tradicional)
  classic: {
    id: 'classic',
    name: 'Clássico',
    description: 'Formatação clássica e elegante',
    font: {
      family: 'Garamond',
      size: 12,
      color: '#000000'
    },
    paragraph: {
      alignment: 'justify',
      lineSpacing: 2.0, // espaçamento duplo
      spaceBefore: 0,
      spaceAfter: 0,
      firstLineIndent: 2.5,
      hanging: 0
    },
    margins: {
      top: 3.0,
      bottom: 3.0,
      left: 3.5,
      right: 2.5
    },
    page: {
      size: 'A4',
      orientation: 'portrait'
    },
    headings: {
      h1: { size: 14, bold: true, alignment: 'center', spaceBefore: 18, spaceAfter: 12 },
      h2: { size: 13, bold: true, spaceBefore: 12, spaceAfter: 6 },
      h3: { size: 12, bold: false, italic: true, spaceBefore: 6, spaceAfter: 3 }
    }
  }
};

/**
 * Template padrão ROM
 */
const DEFAULT_TEMPLATE = {
  partnerId: 'rom',
  templateId: 'oab',
  customizations: {
    // Customizações específicas do ROM (se houver)
  }
};

/**
 * Classe para gerenciar templates de formatação
 */
class FormattingTemplates {
  constructor() {
    this.templates = this.loadTemplates();
    this.presets = FORMATTING_PRESETS;
  }

  /**
   * Carregar templates do arquivo
   */
  loadTemplates() {
    try {
      if (fs.existsSync(TEMPLATES_FILE)) {
        const data = fs.readFileSync(TEMPLATES_FILE, 'utf8');
        return JSON.parse(data);
      }
    } catch (error) {
      console.error('Erro ao carregar templates:', error);
    }

    // Se não existir, criar com template padrão
    const defaultData = {
      rom: DEFAULT_TEMPLATE
    };
    this.saveTemplates(defaultData);
    return defaultData;
  }

  /**
   * Salvar templates no arquivo
   */
  saveTemplates(data = null) {
    try {
      const dataToSave = data || this.templates;
      fs.writeFileSync(TEMPLATES_FILE, JSON.stringify(dataToSave, null, 2), 'utf8');
      return true;
    } catch (error) {
      console.error('Erro ao salvar templates:', error);
      return false;
    }
  }

  /**
   * Obter template de formatação de um parceiro
   */
  getTemplate(partnerId = 'rom') {
    const partnerTemplate = this.templates[partnerId] || DEFAULT_TEMPLATE;
    const presetId = partnerTemplate.templateId || 'oab';
    const preset = this.presets[presetId] || this.presets.oab;

    // Mesclar preset com customizações
    return this.mergeTemplates(preset, partnerTemplate.customizations || {});
  }

  /**
   * Mesclar preset com customizações
   */
  mergeTemplates(preset, customizations) {
    return {
      ...preset,
      font: { ...preset.font, ...customizations.font },
      paragraph: { ...preset.paragraph, ...customizations.paragraph },
      margins: { ...preset.margins, ...customizations.margins },
      page: { ...preset.page, ...customizations.page },
      headings: {
        h1: { ...preset.headings.h1, ...customizations.headings?.h1 },
        h2: { ...preset.headings.h2, ...customizations.headings?.h2 },
        h3: { ...preset.headings.h3, ...customizations.headings?.h3 }
      }
    };
  }

  /**
   * Listar todos os presets disponíveis
   */
  listPresets() {
    return Object.values(this.presets).map(preset => ({
      id: preset.id,
      name: preset.name,
      description: preset.description
    }));
  }

  /**
   * Obter detalhes de um preset
   */
  getPreset(presetId) {
    return this.presets[presetId] || null;
  }

  /**
   * Configurar template de um parceiro
   */
  setPartnerTemplate(partnerId, templateId, customizations = {}) {
    // Validar se preset existe
    if (!this.presets[templateId]) {
      throw new Error(`Preset '${templateId}' não encontrado`);
    }

    this.templates[partnerId] = {
      partnerId,
      templateId,
      customizations,
      updatedAt: new Date().toISOString()
    };

    this.saveTemplates();
    return this.getTemplate(partnerId);
  }

  /**
   * Atualizar customizações de um parceiro
   */
  updateCustomizations(partnerId, customizations) {
    if (!this.templates[partnerId]) {
      this.templates[partnerId] = { ...DEFAULT_TEMPLATE, partnerId };
    }

    this.templates[partnerId].customizations = {
      ...this.templates[partnerId].customizations,
      ...customizations
    };

    this.templates[partnerId].updatedAt = new Date().toISOString();

    this.saveTemplates();
    return this.getTemplate(partnerId);
  }

  /**
   * Resetar template de um parceiro para o padrão
   */
  resetTemplate(partnerId) {
    if (partnerId === 'rom') {
      this.templates[partnerId] = DEFAULT_TEMPLATE;
    } else {
      this.templates[partnerId] = {
        partnerId,
        templateId: 'oab',
        customizations: {}
      };
    }

    this.saveTemplates();
    return this.getTemplate(partnerId);
  }

  /**
   * Criar preset customizado (avançado)
   */
  createCustomPreset(partnerId, presetData) {
    const customPresetId = `custom_${partnerId}_${Date.now()}`;

    const newPreset = {
      id: customPresetId,
      name: presetData.name || 'Template Customizado',
      description: presetData.description || 'Template personalizado',
      ...presetData,
      custom: true,
      partnerId
    };

    // Salvar no templates como preset customizado
    this.templates[`${partnerId}_custom`] = {
      partnerId,
      templateId: 'custom',
      customPreset: newPreset,
      updatedAt: new Date().toISOString()
    };

    this.saveTemplates();
    return newPreset;
  }

  /**
   * Converter template para configuração DOCX
   */
  toDocxConfig(partnerId = 'rom') {
    const template = this.getTemplate(partnerId);

    return {
      // Configurações para biblioteca docx
      font: template.font.family,
      fontSize: template.font.size * 2, // docx usa half-points
      color: template.font.color.replace('#', ''),

      alignment: template.paragraph.alignment,
      spacing: {
        before: template.paragraph.spaceBefore * 20, // twips
        after: template.paragraph.spaceAfter * 20,
        line: Math.round(template.paragraph.lineSpacing * 240)
      },
      indent: {
        firstLine: template.paragraph.firstLineIndent * 567, // twips (1cm = 567 twips)
        hanging: template.paragraph.hanging * 567
      },

      margins: {
        top: template.margins.top * 567,
        bottom: template.margins.bottom * 567,
        left: template.margins.left * 567,
        right: template.margins.right * 567
      },

      page: {
        size: template.page.size,
        orientation: template.page.orientation
      }
    };
  }

  /**
   * Converter template para CSS
   */
  toCSS(partnerId = 'rom') {
    const template = this.getTemplate(partnerId);

    return `
/* Template de Formatação - ${template.name} */
.document-content {
  font-family: ${template.font.family}, serif;
  font-size: ${template.font.size}pt;
  color: ${template.font.color};
  text-align: ${template.paragraph.alignment};
  line-height: ${template.paragraph.lineSpacing};
}

.document-content p {
  margin-top: ${template.paragraph.spaceBefore}pt;
  margin-bottom: ${template.paragraph.spaceAfter}pt;
  text-indent: ${template.paragraph.firstLineIndent}cm;
}

.document-page {
  max-width: 21cm; /* A4 */
  margin: ${template.margins.top}cm ${template.margins.right}cm ${template.margins.bottom}cm ${template.margins.left}cm;
  padding: 20px;
  background: white;
}

.document-content h1 {
  font-size: ${template.headings.h1.size}pt;
  font-weight: ${template.headings.h1.bold ? 'bold' : 'normal'};
  ${template.headings.h1.uppercase ? 'text-transform: uppercase;' : ''}
  text-align: ${template.headings.h1.alignment || template.paragraph.alignment};
  margin-top: ${template.headings.h1.spaceBefore}pt;
  margin-bottom: ${template.headings.h1.spaceAfter}pt;
  color: ${template.headings.h1.color || template.font.color};
}

.document-content h2 {
  font-size: ${template.headings.h2.size}pt;
  font-weight: ${template.headings.h2.bold ? 'bold' : 'normal'};
  ${template.headings.h2.uppercase ? 'text-transform: uppercase;' : ''}
  margin-top: ${template.headings.h2.spaceBefore}pt;
  margin-bottom: ${template.headings.h2.spaceAfter}pt;
  color: ${template.headings.h2.color || template.font.color};
}

.document-content h3 {
  font-size: ${template.headings.h3.size}pt;
  font-weight: ${template.headings.h3.bold ? 'bold' : 'normal'};
  ${template.headings.h3.italic ? 'font-style: italic;' : ''}
  margin-top: ${template.headings.h3.spaceBefore}pt;
  margin-bottom: ${template.headings.h3.spaceAfter}pt;
  color: ${template.headings.h3.color || template.font.color};
}
`;
  }

  /**
   * Validar template
   */
  validateTemplate(template) {
    const required = ['font', 'paragraph', 'margins', 'page', 'headings'];

    for (const field of required) {
      if (!template[field]) {
        return { valid: false, error: `Campo obrigatório faltando: ${field}` };
      }
    }

    // Validar valores numéricos
    if (template.font.size < 8 || template.font.size > 72) {
      return { valid: false, error: 'Tamanho de fonte deve estar entre 8 e 72pt' };
    }

    return { valid: true };
  }
}

// Exportar instância única
const formattingTemplates = new FormattingTemplates();
export default formattingTemplates;
export { FORMATTING_PRESETS };
