/**
 * ROM Agent - Gerenciador de Templates Personalizados
 * CRUD de templates com variáveis substituíveis e preview
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Classe para gerenciar templates personalizados
 */
class TemplatesManager {
  constructor() {
    this.templatesPath = path.join(__dirname, '../data/templates.json');
    this.templates = this.loadTemplates();
  }

  /**
   * Carregar templates do arquivo
   */
  loadTemplates() {
    try {
      if (fs.existsSync(this.templatesPath)) {
        const data = fs.readFileSync(this.templatesPath, 'utf8');
        return JSON.parse(data);
      }
    } catch (error) {
      console.error('Erro ao carregar templates:', error);
    }
    return this.getDefaultTemplates();
  }

  /**
   * Salvar templates no arquivo
   */
  saveTemplates() {
    try {
      const dataDir = path.dirname(this.templatesPath);
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }
      fs.writeFileSync(this.templatesPath, JSON.stringify(this.templates, null, 2));
      return { success: true };
    } catch (error) {
      console.error('Erro ao salvar templates:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Obter templates padrão
   */
  getDefaultTemplates() {
    return {
      'peticao_inicial': {
        id: 'peticao_inicial',
        name: 'Petição Inicial',
        category: 'Petições',
        description: 'Template padrão para petições iniciais',
        variables: ['autor', 'reu', 'vara', 'comarca', 'valor', 'fatos', 'pedidos'],
        content: `EXCELENTÍSSIMO(A) SENHOR(A) DOUTOR(A) JUIZ(A) DE DIREITO DA {{vara}} DA COMARCA DE {{comarca}}

{{autor}}, já qualificado(a) nos autos, por seu advogado que esta subscreve, vem, respeitosamente, à presença de Vossa Excelência, com fundamento nos artigos 319 e seguintes do Código de Processo Civil, propor a presente

AÇÃO DE [TIPO DA AÇÃO]

em face de {{reu}}, também já qualificado(a), pelos fatos e fundamentos jurídicos que passa a expor:

I - DOS FATOS

{{fatos}}

II - DO DIREITO

[Fundamentação jurídica]

III - DOS PEDIDOS

Diante do exposto, requer-se:

{{pedidos}}

Dá-se à causa o valor de {{valor}}.

Termos em que,
Pede e espera deferimento.

{{comarca}}, {{data}}.

_______________________
[Nome do Advogado]
OAB/{{estado}} nº {{oab}}`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        usageCount: 0
      },
      'recurso_apelacao': {
        id: 'recurso_apelacao',
        name: 'Recurso de Apelação',
        category: 'Recursos',
        description: 'Template para recursos de apelação',
        variables: ['apelante', 'apelado', 'processo', 'vara', 'comarca', 'sentenca_data', 'razoes'],
        content: `EXCELENTÍSSIMO(A) SENHOR(A) DESEMBARGADOR(A) RELATOR(A) DO TRIBUNAL DE JUSTIÇA DO ESTADO DE {{estado}}

{{apelante}}, nos autos do processo nº {{processo}}, que tramita perante a {{vara}} da Comarca de {{comarca}}, vem, por seu advogado que esta subscreve, tempestivamente, interpor o presente

RECURSO DE APELAÇÃO

em face da sentença proferida em {{sentenca_data}}, que julgou [improcedente/procedente] o pedido, pelos motivos que passa a expor:

I - DA TEMPESTIVIDADE

O presente recurso é tempestivo, uma vez que foi interposto dentro do prazo legal de 15 (quinze) dias.

II - DO CABIMENTO

O presente recurso é cabível nos termos do artigo 1.009 do Código de Processo Civil.

III - DAS RAZÕES RECURSAIS

{{razoes}}

IV - DOS PEDIDOS

Diante do exposto, requer-se:

a) O conhecimento e provimento do presente recurso;
b) A reforma da sentença recorrida;
c) [Outros pedidos específicos]

Termos em que,
Pede e espera deferimento.

{{comarca}}, {{data}}.

_______________________
[Nome do Advogado]
OAB/{{estado}} nº {{oab}}`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        usageCount: 0
      },
      'contestacao': {
        id: 'contestacao',
        name: 'Contestação',
        category: 'Defesa',
        description: 'Template para contestações',
        variables: ['reu', 'autor', 'processo', 'vara', 'comarca', 'argumentos'],
        content: `EXCELENTÍSSIMO(A) SENHOR(A) DOUTOR(A) JUIZ(A) DE DIREITO DA {{vara}} DA COMARCA DE {{comarca}}

Processo nº {{processo}}

{{reu}}, já qualificado(a) nos autos da ação proposta por {{autor}}, vem, por seu advogado que esta subscreve, tempestivamente, apresentar a presente

CONTESTAÇÃO

pelos fatos e fundamentos jurídicos que passa a expor:

I - PRELIMINARMENTE

[Preliminares, se houver]

II - DO MÉRITO

{{argumentos}}

III - DOS PEDIDOS

Diante do exposto, requer-se:

a) O acolhimento da presente contestação;
b) A improcedência total dos pedidos do autor;
c) A condenação do autor ao pagamento das custas processuais e honorários advocatícios.

Termos em que,
Pede e espera deferimento.

{{comarca}}, {{data}}.

_______________________
[Nome do Advogado]
OAB/{{estado}} nº {{oab}}

Protesta provar o alegado por todos os meios de prova em direito admitidos.`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        usageCount: 0
      }
    };
  }

  /**
   * Criar novo template
   */
  createTemplate(templateData) {
    const { id, name, category, description, variables, content } = templateData;

    if (!id || !name || !content) {
      return { success: false, error: 'ID, nome e conteúdo são obrigatórios' };
    }

    if (this.templates[id]) {
      return { success: false, error: 'Template com este ID já existe' };
    }

    this.templates[id] = {
      id,
      name,
      category: category || 'Outros',
      description: description || '',
      variables: variables || this.extractVariables(content),
      content,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      usageCount: 0
    };

    this.saveTemplates();

    return { success: true, template: this.templates[id] };
  }

  /**
   * Atualizar template existente
   */
  updateTemplate(id, updates) {
    if (!this.templates[id]) {
      return { success: false, error: 'Template não encontrado' };
    }

    const template = this.templates[id];

    if (updates.name) template.name = updates.name;
    if (updates.category) template.category = updates.category;
    if (updates.description) template.description = updates.description;
    if (updates.content) {
      template.content = updates.content;
      template.variables = updates.variables || this.extractVariables(updates.content);
    }

    template.updatedAt = new Date().toISOString();

    this.saveTemplates();

    return { success: true, template };
  }

  /**
   * Excluir template
   */
  deleteTemplate(id) {
    if (!this.templates[id]) {
      return { success: false, error: 'Template não encontrado' };
    }

    delete this.templates[id];
    this.saveTemplates();

    return { success: true, message: `Template ${id} excluído` };
  }

  /**
   * Obter template por ID
   */
  getTemplate(id) {
    if (!this.templates[id]) {
      return { success: false, error: 'Template não encontrado' };
    }

    return { success: true, template: this.templates[id] };
  }

  /**
   * Listar todos os templates
   */
  listTemplates(category = null) {
    let templates = Object.values(this.templates);

    if (category) {
      templates = templates.filter(t => t.category === category);
    }

    return {
      success: true,
      templates: templates.map(t => ({
        id: t.id,
        name: t.name,
        category: t.category,
        description: t.description,
        variablesCount: t.variables.length,
        usageCount: t.usageCount,
        updatedAt: t.updatedAt
      })),
      total: templates.length
    };
  }

  /**
   * Listar categorias disponíveis
   */
  listCategories() {
    const categories = new Set();
    for (const template of Object.values(this.templates)) {
      categories.add(template.category);
    }

    return {
      success: true,
      categories: Array.from(categories).sort(),
      total: categories.size
    };
  }

  /**
   * Renderizar template com variáveis
   */
  render(id, variables = {}) {
    const result = this.getTemplate(id);
    if (!result.success) {
      return result;
    }

    const template = result.template;
    let rendered = template.content;

    // Substituir variáveis
    for (const [key, value] of Object.entries(variables)) {
      const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
      rendered = rendered.replace(regex, value || `[${key}]`);
    }

    // Adicionar data atual se não fornecida
    if (!variables.data) {
      const today = new Date().toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: 'long',
        year: 'numeric'
      });
      rendered = rendered.replace(/\{\{data\}\}/g, today);
    }

    // Incrementar contador de uso
    template.usageCount++;
    this.saveTemplates();

    // Encontrar variáveis não preenchidas
    const missingVars = template.variables.filter(v => {
      return !variables[v] && rendered.includes(`{{${v}}}`);
    });

    return {
      success: true,
      rendered,
      missingVariables: missingVars,
      templateId: id,
      templateName: template.name
    };
  }

  /**
   * Preview do template (sem incrementar uso)
   */
  preview(id, variables = {}) {
    const result = this.getTemplate(id);
    if (!result.success) {
      return result;
    }

    const template = result.template;
    let preview = template.content;

    // Substituir variáveis com placeholder se não fornecidas
    for (const varName of template.variables) {
      const value = variables[varName] || `[${varName.toUpperCase()}]`;
      const regex = new RegExp(`\\{\\{${varName}\\}\\}`, 'g');
      preview = preview.replace(regex, value);
    }

    // Adicionar data de exemplo
    const today = new Date().toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    });
    preview = preview.replace(/\{\{data\}\}/g, variables.data || today);

    return {
      success: true,
      preview,
      variables: template.variables,
      providedVariables: Object.keys(variables),
      missingVariables: template.variables.filter(v => !variables[v])
    };
  }

  /**
   * Extrair variáveis de um template ({{variavel}})
   */
  extractVariables(content) {
    const regex = /\{\{([a-zA-Z0-9_]+)\}\}/g;
    const variables = new Set();
    let match;

    while ((match = regex.exec(content)) !== null) {
      variables.add(match[1]);
    }

    return Array.from(variables);
  }

  /**
   * Validar template
   */
  validateTemplate(content) {
    const variables = this.extractVariables(content);

    // Verificar sintaxe básica
    const unclosedBraces = (content.match(/\{\{/g) || []).length !== (content.match(/\}\}/g) || []).length;

    return {
      valid: !unclosedBraces,
      variables,
      variablesCount: variables.length,
      errors: unclosedBraces ? ['Chaves {{ }} não estão balanceadas'] : []
    };
  }

  /**
   * Clonar template
   */
  cloneTemplate(id, newId, newName) {
    const result = this.getTemplate(id);
    if (!result.success) {
      return result;
    }

    if (this.templates[newId]) {
      return { success: false, error: 'Template com o novo ID já existe' };
    }

    const original = result.template;

    return this.createTemplate({
      id: newId,
      name: newName || `${original.name} (Cópia)`,
      category: original.category,
      description: `Clonado de ${original.name}`,
      variables: [...original.variables],
      content: original.content
    });
  }

  /**
   * Obter estatísticas
   */
  getStatistics() {
    const templates = Object.values(this.templates);
    const totalTemplates = templates.length;
    const totalUsage = templates.reduce((sum, t) => sum + t.usageCount, 0);
    const avgUsage = totalTemplates > 0 ? Math.round(totalUsage / totalTemplates) : 0;

    const byCategory = {};
    for (const template of templates) {
      byCategory[template.category] = (byCategory[template.category] || 0) + 1;
    }

    const mostUsed = templates
      .sort((a, b) => b.usageCount - a.usageCount)
      .slice(0, 5)
      .map(t => ({ id: t.id, name: t.name, usageCount: t.usageCount }));

    return {
      totalTemplates,
      totalUsage,
      avgUsage,
      categories: Object.keys(byCategory).length,
      byCategory,
      mostUsed
    };
  }
}

// Instância singleton
const templatesManager = new TemplatesManager();

export default templatesManager;
export { TemplatesManager };
