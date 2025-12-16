/**
 * ROM Agent - Serviço de Gerenciamento do Projeto ROM
 * Sistema completo de custom instructions, prompts e templates autoatualizáveis
 *
 * @version 2.7.0
 * @author ROM Agent
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Caminho base do projeto ROM
const ROM_PROJECT_PATH = path.join(__dirname, '../../data/rom-project');

/**
 * Classe de gerenciamento do Projeto ROM
 */
class ROMProjectService {
  constructor() {
    this.customInstructions = null;
    this.prompts = {
      judiciais: {},
      extrajudiciais: {},
      gerais: {}
    };
    this.templates = {};
    this.initialized = false;
  }

  /**
   * Inicializa o serviço
   */
  async init() {
    if (this.initialized) return;

    try {
      // Carregar custom instructions
      await this.loadCustomInstructions();

      // Carregar prompts
      await this.loadAllPrompts();

      // Carregar templates
      await this.loadTemplates();

      this.initialized = true;
      console.log('✅ ROM Project Service inicializado');
    } catch (error) {
      console.error('❌ Erro ao inicializar ROM Project Service:', error);
      throw error;
    }
  }

  /**
   * Carrega custom instructions
   */
  async loadCustomInstructions() {
    const filePath = path.join(ROM_PROJECT_PATH, 'custom-instructions.json');

    try {
      const content = await fs.readFile(filePath, 'utf8');
      this.customInstructions = JSON.parse(content);
      console.log('✅ Custom instructions carregadas');
    } catch (error) {
      console.warn('⚠️  Custom instructions não encontradas, usando padrão');
      this.customInstructions = this.getDefaultCustomInstructions();
    }
  }

  /**
   * Carrega todos os prompts
   */
  async loadAllPrompts() {
    await Promise.all([
      this.loadPromptCategory('judiciais'),
      this.loadPromptCategory('extrajudiciais'),
      this.loadPromptCategory('gerais')
    ]);
  }

  /**
   * Carrega uma categoria de prompts
   */
  async loadPromptCategory(category) {
    const categoryPath = path.join(ROM_PROJECT_PATH, 'prompts', category);

    try {
      await fs.access(categoryPath);
      const files = await fs.readdir(categoryPath);

      for (const file of files) {
        if (file.endsWith('.json')) {
          const filePath = path.join(categoryPath, file);
          const content = await fs.readFile(filePath, 'utf8');
          const promptId = file.replace('.json', '');
          this.prompts[category][promptId] = JSON.parse(content);
        }
      }

      console.log(`✅ Prompts ${category} carregados: ${Object.keys(this.prompts[category]).length}`);
    } catch (error) {
      console.warn(`⚠️  Pasta de prompts ${category} não encontrada`);
      this.prompts[category] = {};
    }
  }

  /**
   * Carrega templates
   */
  async loadTemplates() {
    const templatesPath = path.join(ROM_PROJECT_PATH, 'templates');

    try {
      await fs.access(templatesPath);
      const files = await fs.readdir(templatesPath);

      for (const file of files) {
        if (file.endsWith('.hbs') || file.endsWith('.handlebars')) {
          const filePath = path.join(templatesPath, file);
          const content = await fs.readFile(filePath, 'utf8');
          const templateId = file.replace(/\.(hbs|handlebars)$/, '');
          this.templates[templateId] = content;
        }
      }

      console.log(`✅ Templates carregados: ${Object.keys(this.templates).length}`);
    } catch (error) {
      console.warn('⚠️  Pasta de templates não encontrada');
      this.templates = {};
    }
  }

  /**
   * Obtém as custom instructions
   */
  getCustomInstructions() {
    return this.customInstructions;
  }

  /**
   * Atualiza as custom instructions
   */
  async updateCustomInstructions(instructions) {
    this.customInstructions = {
      ...this.customInstructions,
      ...instructions,
      updated: new Date().toISOString()
    };

    const filePath = path.join(ROM_PROJECT_PATH, 'custom-instructions.json');
    await fs.writeFile(filePath, JSON.stringify(this.customInstructions, null, 2));

    console.log('✅ Custom instructions atualizadas');
    return this.customInstructions;
  }

  /**
   * Obtém um prompt específico
   */
  getPrompt(category, promptId) {
    if (!['judiciais', 'extrajudiciais', 'gerais'].includes(category)) {
      throw new Error(`Categoria inválida: ${category}`);
    }

    return this.prompts[category][promptId] || null;
  }

  /**
   * Lista todos os prompts de uma categoria
   */
  listPrompts(category) {
    if (!category) {
      return {
        judiciais: Object.keys(this.prompts.judiciais),
        extrajudiciais: Object.keys(this.prompts.extrajudiciais),
        gerais: Object.keys(this.prompts.gerais)
      };
    }

    return Object.keys(this.prompts[category] || {});
  }

  /**
   * Cria ou atualiza um prompt
   */
  async savePrompt(category, promptId, promptData) {
    if (!['judiciais', 'extrajudiciais', 'gerais'].includes(category)) {
      throw new Error(`Categoria inválida: ${category}`);
    }

    // Adicionar metadados
    const prompt = {
      ...promptData,
      id: promptId,
      category,
      version: promptData.version || '1.0',
      updated: new Date().toISOString(),
      autoUpdateable: true
    };

    // Salvar em memória
    this.prompts[category][promptId] = prompt;

    // Salvar em arquivo
    const categoryPath = path.join(ROM_PROJECT_PATH, 'prompts', category);
    await fs.mkdir(categoryPath, { recursive: true });

    const filePath = path.join(categoryPath, `${promptId}.json`);
    await fs.writeFile(filePath, JSON.stringify(prompt, null, 2));

    console.log(`✅ Prompt ${category}/${promptId} salvo`);
    return prompt;
  }

  /**
   * Deleta um prompt
   */
  async deletePrompt(category, promptId) {
    if (!this.prompts[category] || !this.prompts[category][promptId]) {
      throw new Error(`Prompt não encontrado: ${category}/${promptId}`);
    }

    delete this.prompts[category][promptId];

    const filePath = path.join(ROM_PROJECT_PATH, 'prompts', category, `${promptId}.json`);
    try {
      await fs.unlink(filePath);
      console.log(`✅ Prompt ${category}/${promptId} deletado`);
    } catch (error) {
      console.warn(`⚠️  Erro ao deletar arquivo do prompt: ${error.message}`);
    }

    return true;
  }

  /**
   * Obtém um template
   */
  getTemplate(templateId) {
    return this.templates[templateId] || null;
  }

  /**
   * Lista todos os templates
   */
  listTemplates() {
    return Object.keys(this.templates);
  }

  /**
   * Salva um template
   */
  async saveTemplate(templateId, templateContent) {
    this.templates[templateId] = templateContent;

    const templatesPath = path.join(ROM_PROJECT_PATH, 'templates');
    await fs.mkdir(templatesPath, { recursive: true });

    const filePath = path.join(templatesPath, `${templateId}.hbs`);
    await fs.writeFile(filePath, templateContent);

    console.log(`✅ Template ${templateId} salvo`);
    return { id: templateId, content: templateContent };
  }

  /**
   * Busca prompts por palavra-chave
   */
  searchPrompts(keyword) {
    const results = {
      judiciais: [],
      extrajudiciais: [],
      gerais: []
    };

    const keywordLower = keyword.toLowerCase();

    for (const category of ['judiciais', 'extrajudiciais', 'gerais']) {
      for (const [id, prompt] of Object.entries(this.prompts[category])) {
        const nome = (prompt.nome || '').toLowerCase();
        const descricao = (prompt.descricao || '').toLowerCase();
        const tags = (prompt.tags || []).join(' ').toLowerCase();

        if (nome.includes(keywordLower) ||
            descricao.includes(keywordLower) ||
            tags.includes(keywordLower)) {
          results[category].push({
            id,
            nome: prompt.nome,
            descricao: prompt.descricao,
            categoria: prompt.categoria
          });
        }
      }
    }

    return results;
  }

  /**
   * Exporta todo o projeto ROM para JSON
   */
  async exportProject() {
    return {
      customInstructions: this.customInstructions,
      prompts: this.prompts,
      templates: this.templates,
      exportedAt: new Date().toISOString(),
      version: '2.7.0'
    };
  }

  /**
   * Importa projeto ROM de JSON
   */
  async importProject(projectData) {
    if (projectData.customInstructions) {
      await this.updateCustomInstructions(projectData.customInstructions);
    }

    if (projectData.prompts) {
      for (const category of ['judiciais', 'extrajudiciais', 'gerais']) {
        if (projectData.prompts[category]) {
          for (const [id, prompt] of Object.entries(projectData.prompts[category])) {
            await this.savePrompt(category, id, prompt);
          }
        }
      }
    }

    if (projectData.templates) {
      for (const [id, content] of Object.entries(projectData.templates)) {
        await this.saveTemplate(id, content);
      }
    }

    console.log('✅ Projeto ROM importado com sucesso');
    return { success: true, message: 'Projeto importado com sucesso' };
  }

  /**
   * Gera prompt completo para uso no chat
   */
  generateFullPrompt(category, promptId, context = {}) {
    const prompt = this.getPrompt(category, promptId);
    if (!prompt) {
      throw new Error(`Prompt não encontrado: ${category}/${promptId}`);
    }

    // Combinar custom instructions com prompt específico
    const fullPrompt = {
      systemInstructions: this.customInstructions?.systemInstructions || {},
      prompt: prompt,
      context: context,
      formatting: this.customInstructions?.formatting || {},
      rules: {
        prohibitions: this.customInstructions?.prohibitions || [],
        guidelines: this.customInstructions?.guidelines || []
      }
    };

    return fullPrompt;
  }

  /**
   * Obtém estatísticas do projeto
   */
  getStatistics() {
    return {
      customInstructions: this.customInstructions ? 'loaded' : 'not loaded',
      prompts: {
        judiciais: Object.keys(this.prompts.judiciais).length,
        extrajudiciais: Object.keys(this.prompts.extrajudiciais).length,
        gerais: Object.keys(this.prompts.gerais).length,
        total: Object.keys(this.prompts.judiciais).length +
               Object.keys(this.prompts.extrajudiciais).length +
               Object.keys(this.prompts.gerais).length
      },
      templates: Object.keys(this.templates).length,
      lastUpdated: this.customInstructions?.updated || 'unknown',
      version: this.customInstructions?.version || 'unknown'
    };
  }

  /**
   * Custom instructions padrão
   */
  getDefaultCustomInstructions() {
    return {
      project: "ROM-Agent",
      version: "1.0.0",
      updated: new Date().toISOString(),
      description: "Custom Instructions para o Projeto ROM - Redator de Obras Magistrais",
      systemInstructions: {
        role: "Assistente jurídico especializado em redação de peças processuais e documentos extrajudiciais",
        expertise: [
          "Redação de peças judiciais (petições, contestações, recursos, embargos)",
          "Redação de peças extrajudiciais (contratos, alterações contratuais DNRC, substabelecimentos)",
          "Conhecimento profundo de normas processuais (CPC, CPP, CLT)",
          "Conhecimento de Direito Empresarial e normas DNRC",
          "Conhecimento de formatação técnica e ABNT",
          "Análise de jurisprudência e legislação"
        ],
        tone: "Formal, técnico-jurídico, preciso e objetivo",
        guidelines: [
          "Sempre usar linguagem jurídica adequada ao tipo de peça",
          "Citar legislação e jurisprudência quando relevante",
          "Seguir rigorosamente as normas de formatação jurídica",
          "Aplicar as regras do DNRC em alterações contratuais e atos societários",
          "Verificar prazos processuais antes de sugerir prazos",
          "Sempre incluir fundamentação legal completa",
          "Utilizar parágrafos numerados quando apropriado",
          "Manter consistência terminológica em todo o documento",
          "Adaptar linguagem ao público-alvo (juiz, parte contrária, órgão registral)",
          "Nunca inventar jurisprudência ou legislação - sempre verificar"
        ],
        formatting: {
          font: "Arial ou Times New Roman, tamanho 12",
          margins: "3cm superior, 2cm inferior, 3cm esquerda, 2cm direita",
          spacing: "1,5 linhas",
          paragraphIndent: "1,25cm na primeira linha",
          titles: "Negrito, centralizado ou alinhado à esquerda conforme tipo de peça",
          citations: "Recuo de 4cm, fonte 10, espaçamento simples para citações longas"
        },
        prohibitions: [
          "Nunca criar jurisprudência falsa",
          "Não usar linguagem coloquial em peças formais",
          "Não omitir fundamentação legal obrigatória",
          "Não descumprir normas do DNRC em atos societários",
          "Não utilizar modelos genéricos sem adaptação ao caso concreto",
          "Não incluir informações pessoais sem autorização"
        ]
      },
      processingRules: {
        extractedDocuments: {
          autoImport: true,
          formatPreservation: true,
          metadataExtraction: true,
          useInContext: true
        },
        promptSelection: {
          auto: true,
          basedOnKeywords: true,
          allowManualOverride: true
        },
        qualityControl: {
          legalCitationVerification: true,
          formatCompliance: true,
          grammarCheck: true,
          consistencyCheck: true
        }
      },
      integrations: {
        knowledgeBase: {
          enabled: true,
          autoUpload: true,
          acceptAllExtensions: true,
          indexing: true
        },
        jurisprudence: {
          datajud: true,
          jusBrasil: true,
          tribunalSites: true
        },
        legislation: {
          planalto: true,
          senado: true,
          camara: true
        }
      },
      specializedAreas: {
        empresarial: {
          enabled: true,
          dnrcCompliance: true,
          sociedadesTypes: ["LTDA", "SA", "EIRELI", "SLU"],
          atos: ["alteracao-contratual", "distrato", "transformacao", "fusao", "cisao", "incorporacao"]
        },
        processual: {
          enabled: true,
          areas: ["civil", "trabalhista", "penal", "tributario"],
          pecas: ["peticao-inicial", "contestacao", "replica", "recursos", "embargos", "agravo"]
        },
        contratos: {
          enabled: true,
          types: ["compra-venda", "prestacao-servicos", "locacao", "comodato", "doacao", "permuta"],
          clauses: ["rescisao", "multa", "foro", "vigencia", "pagamento"]
        },
        procuracoes: {
          enabled: true,
          types: ["ad-judicia", "ad-negotia", "especial"],
          substabelecimentos: true
        }
      }
    };
  }
}

// Instância singleton
const romProjectService = new ROMProjectService();

export default romProjectService;
export { ROMProjectService };
