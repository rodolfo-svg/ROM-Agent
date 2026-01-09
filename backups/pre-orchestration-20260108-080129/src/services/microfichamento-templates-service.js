/**
 * Serviço de Templates de Microfichamento
 *
 * Templates JSON estruturados para diferentes tipos de documentos processuais.
 * Cada template define campos que devem ser extraídos de forma estruturada.
 *
 * Integra com Layer 3 do ROM Case Processor Service
 *
 * @version 1.0.0
 */

import fs from 'fs/promises';
import path from 'path';

class MicrofichamentoTemplatesService {
  constructor() {
    this.templates = {};
    this.initialized = false;
  }

  /**
   * Inicializar serviço carregando templates
   */
  async init() {
    try {
      // Carregar templates padrão
      this.loadDefaultTemplates();
      this.initialized = true;
      console.log('✅ Microfichamento Templates Service inicializado');
      return true;
    } catch (error) {
      console.error('❌ Erro ao inicializar Microfichamento Templates:', error);
      return false;
    }
  }

  /**
   * Carregar templates padrão
   */
  loadDefaultTemplates() {
    // Template para Petição Inicial
    this.templates['peticao-inicial'] = {
      id: 'peticao-inicial',
      nome: 'Petição Inicial',
      descricao: 'Template para extração estruturada de petição inicial',
      campos: {
        qualificacao: {
          autor: {
            nome: { type: 'string', required: true },
            cpf_cnpj: { type: 'string', required: false },
            endereco: { type: 'string', required: false },
            nacionalidade: { type: 'string', required: false },
            estadoCivil: { type: 'string', required: false },
            profissao: { type: 'string', required: false }
          },
          reu: {
            nome: { type: 'string', required: true },
            cpf_cnpj: { type: 'string', required: false },
            endereco: { type: 'string', required: false }
          },
          advogado: {
            nome: { type: 'string', required: true },
            oab: { type: 'string', required: true },
            endereco: { type: 'string', required: false },
            email: { type: 'string', required: false },
            telefone: { type: 'string', required: false }
          }
        },
        fatos: {
          descricao: { type: 'array', required: true, items: { type: 'string' } },
          dataOcorrencia: { type: 'date', required: false },
          local: { type: 'string', required: false },
          testemunhas: { type: 'array', required: false, items: { type: 'string' } }
        },
        fundamentacao: {
          tesesJuridicas: { type: 'array', required: true, items: { type: 'string' } },
          normasAplicaveis: { type: 'array', required: true, items: {
            type: 'object',
            properties: {
              lei: { type: 'string' },
              artigo: { type: 'string' },
              descricao: { type: 'string' }
            }
          }},
          jurisprudencia: { type: 'array', required: false, items: {
            type: 'object',
            properties: {
              tribunal: { type: 'string' },
              numero: { type: 'string' },
              ementa: { type: 'string' },
              relevancia: { type: 'string' }
            }
          }}
        },
        provas: {
          documentos: { type: 'array', required: false, items: { type: 'string' } },
          testemunhas: { type: 'array', required: false, items: { type: 'string' } },
          pericias: { type: 'array', required: false, items: { type: 'string' } }
        },
        pedidos: {
          principais: { type: 'array', required: true, items: { type: 'string' } },
          subsidiarios: { type: 'array', required: false, items: { type: 'string' } },
          valorCausa: { type: 'number', required: false },
          tutela: {
            urgencia: { type: 'boolean', required: false },
            evidencia: { type: 'boolean', required: false },
            fundamentacao: { type: 'string', required: false }
          }
        },
        metadata: {
          dataProtocolo: { type: 'date', required: false },
          numeroProcesso: { type: 'string', required: false },
          vara: { type: 'string', required: false },
          comarca: { type: 'string', required: false }
        }
      }
    };

    // Template para Contestação
    this.templates['contestacao'] = {
      id: 'contestacao',
      nome: 'Contestação',
      descricao: 'Template para extração estruturada de contestação',
      campos: {
        qualificacao: {
          reu: {
            nome: { type: 'string', required: true },
            cpf_cnpj: { type: 'string', required: false },
            endereco: { type: 'string', required: false }
          },
          advogado: {
            nome: { type: 'string', required: true },
            oab: { type: 'string', required: true }
          }
        },
        preliminares: {
          incompetencia: { type: 'boolean', required: false },
          ilegitimidade: { type: 'boolean', required: false },
          decadencia: { type: 'boolean', required: false },
          prescricao: { type: 'boolean', required: false },
          litispendencia: { type: 'boolean', required: false },
          coisaJulgada: { type: 'boolean', required: false },
          fundamentacao: { type: 'array', required: false, items: { type: 'string' } }
        },
        merito: {
          impugnacaoFatos: { type: 'array', required: false, items: { type: 'string' } },
          fatosModerativos: { type: 'array', required: false, items: { type: 'string' } },
          fatosExtintivos: { type: 'array', required: false, items: { type: 'string' } },
          fatosImpeditivos: { type: 'array', required: false, items: { type: 'string' } }
        },
        fundamentacao: {
          tesesDefesa: { type: 'array', required: true, items: { type: 'string' } },
          normasAplicaveis: { type: 'array', required: true, items: {
            type: 'object',
            properties: {
              lei: { type: 'string' },
              artigo: { type: 'string' },
              descricao: { type: 'string' }
            }
          }},
          jurisprudencia: { type: 'array', required: false, items: {
            type: 'object',
            properties: {
              tribunal: { type: 'string' },
              numero: { type: 'string' },
              ementa: { type: 'string' }
            }
          }}
        },
        provas: {
          documentos: { type: 'array', required: false, items: { type: 'string' } },
          testemunhas: { type: 'array', required: false, items: { type: 'string' } },
          contraprovas: { type: 'array', required: false, items: { type: 'string' } }
        },
        pedidos: {
          acolhimentoPreliminares: { type: 'boolean', required: false },
          improcedencia: { type: 'boolean', required: true },
          subsidiarios: { type: 'array', required: false, items: { type: 'string' } }
        },
        metadata: {
          dataProtocolo: { type: 'date', required: false },
          numeroProcesso: { type: 'string', required: false },
          prazo: { type: 'number', required: false, description: 'Prazo em dias' }
        }
      }
    };

    // Template para Decisão Judicial
    this.templates['decisao'] = {
      id: 'decisao',
      nome: 'Decisão Judicial',
      descricao: 'Template para extração estruturada de decisão judicial',
      campos: {
        identificacao: {
          tipo: { type: 'string', required: true, enum: ['despacho', 'decisao-interlocutoria', 'sentenca', 'acordao'] },
          juiz: { type: 'string', required: false },
          vara: { type: 'string', required: false },
          tribunal: { type: 'string', required: false },
          dataPublicacao: { type: 'date', required: false }
        },
        relatorio: {
          resumoAutos: { type: 'string', required: false },
          partesEnvolvidas: { type: 'array', required: false, items: { type: 'string' } },
          questaoControvertida: { type: 'string', required: false }
        },
        fundamentacao: {
          analiseProvas: { type: 'string', required: false },
          tesesAcolhidas: { type: 'array', required: false, items: { type: 'string' } },
          tesesRejeitadas: { type: 'array', required: false, items: { type: 'string' } },
          normativa: { type: 'array', required: false, items: {
            type: 'object',
            properties: {
              lei: { type: 'string' },
              artigo: { type: 'string' }
            }
          }},
          jurisprudencia: { type: 'array', required: false, items: { type: 'string' } }
        },
        dispositivo: {
          decisao: { type: 'string', required: true },
          procedencia: { type: 'string', required: false, enum: ['total', 'parcial', 'improcedente'] },
          determinacoes: { type: 'array', required: false, items: { type: 'string' } },
          prazos: { type: 'array', required: false, items: {
            type: 'object',
            properties: {
              acao: { type: 'string' },
              prazo: { type: 'number' },
              unidade: { type: 'string', enum: ['dias', 'meses'] }
            }
          }}
        },
        recursabilidade: {
          cabivel: { type: 'boolean', required: false },
          tipoRecurso: { type: 'string', required: false },
          prazoRecurso: { type: 'number', required: false }
        },
        metadata: {
          numeroProcesso: { type: 'string', required: false },
          numeroDecisao: { type: 'string', required: false }
        }
      }
    };

    // Template para Sentença
    this.templates['sentenca'] = {
      id: 'sentenca',
      nome: 'Sentença',
      descricao: 'Template para extração estruturada de sentença',
      campos: {
        identificacao: {
          juiz: { type: 'string', required: true },
          vara: { type: 'string', required: true },
          comarca: { type: 'string', required: true },
          dataPublicacao: { type: 'date', required: false },
          dataTransitoJulgado: { type: 'date', required: false }
        },
        relatorio: {
          qualificacaoPartes: {
            autor: { type: 'string', required: true },
            reu: { type: 'string', required: true }
          },
          pedidoAutor: { type: 'string', required: true },
          defesaReu: { type: 'string', required: false },
          instrucao: { type: 'string', required: false }
        },
        fundamentacao: {
          questoesPrevias: { type: 'array', required: false, items: { type: 'string' } },
          merito: {
            analiseProvas: { type: 'string', required: true },
            fatos: { type: 'string', required: true },
            direito: { type: 'string', required: true }
          },
          tesesAcolhidas: { type: 'array', required: true, items: { type: 'string' } },
          tesesRejeitadas: { type: 'array', required: false, items: { type: 'string' } },
          normasAplicadas: { type: 'array', required: true, items: {
            type: 'object',
            properties: {
              lei: { type: 'string' },
              artigo: { type: 'string' }
            }
          }},
          jurisprudencia: { type: 'array', required: false, items: {
            type: 'object',
            properties: {
              tribunal: { type: 'string' },
              numero: { type: 'string' },
              ementa: { type: 'string' }
            }
          }}
        },
        dispositivo: {
          julgamento: { type: 'string', required: true, enum: ['procedente', 'parcialmente-procedente', 'improcedente'] },
          condenacao: {
            valor: { type: 'number', required: false },
            descricao: { type: 'string', required: false },
            correcao: { type: 'string', required: false },
            juros: { type: 'string', required: false }
          },
          honorarios: {
            sucumbencia: { type: 'string', required: false },
            percentual: { type: 'number', required: false },
            valor: { type: 'number', required: false }
          },
          custas: { type: 'string', required: false },
          determinacoes: { type: 'array', required: false, items: { type: 'string' } }
        },
        recursabilidade: {
          prazoApelacao: { type: 'number', required: false, default: 15 },
          intimacoes: { type: 'array', required: false, items: { type: 'string' } }
        },
        metadata: {
          numeroProcesso: { type: 'string', required: true },
          numeroSentenca: { type: 'string', required: false }
        }
      }
    };

    // Template para Recurso
    this.templates['recurso'] = {
      id: 'recurso',
      nome: 'Recurso',
      descricao: 'Template para extração estruturada de recursos',
      campos: {
        identificacao: {
          tipo: { type: 'string', required: true, enum: ['apelacao', 'agravo', 'embargos-declaracao', 'recurso-especial', 'recurso-extraordinario'] },
          recorrente: { type: 'string', required: true },
          recorrido: { type: 'string', required: true },
          advogado: {
            nome: { type: 'string', required: true },
            oab: { type: 'string', required: true }
          }
        },
        decisaoRecorrida: {
          tipo: { type: 'string', required: true },
          data: { type: 'date', required: false },
          juiz: { type: 'string', required: false },
          tribunal: { type: 'string', required: false },
          sintese: { type: 'string', required: true }
        },
        fundamentosRecurso: {
          errosFormais: { type: 'array', required: false, items: { type: 'string' } },
          errosMateriais: { type: 'array', required: false, items: { type: 'string' } },
          violacaoLei: { type: 'array', required: false, items: {
            type: 'object',
            properties: {
              lei: { type: 'string' },
              artigo: { type: 'string' },
              fundamentacao: { type: 'string' }
            }
          }},
          divergenciaJurisprudencial: { type: 'array', required: false, items: {
            type: 'object',
            properties: {
              tribunal: { type: 'string' },
              acordao: { type: 'string' },
              ementa: { type: 'string' }
            }
          }},
          prequestionamento: { type: 'array', required: false, items: { type: 'string' } }
        },
        teses: {
          principais: { type: 'array', required: true, items: { type: 'string' } },
          subsidiarias: { type: 'array', required: false, items: { type: 'string' } }
        },
        pedidos: {
          principal: { type: 'string', required: true },
          subsidiarios: { type: 'array', required: false, items: { type: 'string' } },
          efeitoSuspensivo: { type: 'boolean', required: false },
          tutelaRecursal: { type: 'boolean', required: false }
        },
        provas: {
          novasProvas: { type: 'boolean', required: false },
          justificativa: { type: 'string', required: false },
          documentos: { type: 'array', required: false, items: { type: 'string' } }
        },
        metadata: {
          numeroProcessoOrigem: { type: 'string', required: true },
          numeroRecurso: { type: 'string', required: false },
          dataProtocolo: { type: 'date', required: false },
          prazo: { type: 'number', required: false }
        }
      }
    };

    console.log(`✅ ${Object.keys(this.templates).length} templates carregados`);
  }

  /**
   * Obter template por ID
   */
  getTemplate(templateId) {
    if (!this.templates[templateId]) {
      throw new Error(`Template não encontrado: ${templateId}`);
    }
    return this.templates[templateId];
  }

  /**
   * Listar todos os templates disponíveis
   */
  listTemplates() {
    return Object.keys(this.templates).map(id => ({
      id,
      nome: this.templates[id].nome,
      descricao: this.templates[id].descricao
    }));
  }

  /**
   * Detectar tipo de documento automaticamente baseado no conteúdo
   */
  detectDocumentType(text) {
    const textLower = text.toLowerCase();

    // Petição Inicial
    if (textLower.includes('petição inicial') ||
        textLower.includes('peticao inicial') ||
        (textLower.includes('excelentíssimo') && textLower.includes('requer'))) {
      return 'peticao-inicial';
    }

    // Contestação
    if (textLower.includes('contestação') ||
        textLower.includes('contestacao') ||
        textLower.includes('defesa')) {
      return 'contestacao';
    }

    // Sentença
    if (textLower.includes('sentença') ||
        textLower.includes('sentenca') ||
        (textLower.includes('julgo') && textLower.includes('procedente'))) {
      return 'sentenca';
    }

    // Recurso
    if (textLower.includes('apelação') ||
        textLower.includes('apelacao') ||
        textLower.includes('agravo') ||
        textLower.includes('embargos') ||
        textLower.includes('recurso especial') ||
        textLower.includes('recurso extraordinário')) {
      return 'recurso';
    }

    // Decisão
    if (textLower.includes('decisão') ||
        textLower.includes('decisao') ||
        textLower.includes('despacho')) {
      return 'decisao';
    }

    // Default
    return 'desconhecido';
  }

  /**
   * Aplicar template para extrair campos estruturados de um documento
   *
   * @param {string} documentText - Texto do documento
   * @param {string} templateId - ID do template (opcional, auto-detecta se não fornecido)
   * @param {object} options - Opções adicionais
   * @returns {object} Dados estruturados extraídos
   */
  async applyTemplate(documentText, templateId = null, options = {}) {
    try {
      // Auto-detectar tipo se não fornecido
      if (!templateId) {
        templateId = this.detectDocumentType(documentText);

        if (templateId === 'desconhecido') {
          console.warn('⚠️ Tipo de documento não identificado, usando template genérico');
          return this.applyGenericTemplate(documentText);
        }
      }

      const template = this.getTemplate(templateId);

      // Estrutura de retorno baseada no template
      const extractedData = {
        templateId,
        templateNome: template.nome,
        documentType: templateId,
        extractedAt: new Date().toISOString(),
        campos: this.extractFieldsFromText(documentText, template.campos),
        metadata: {
          confidence: 'medium', // TODO: Implementar análise de confiança
          source: 'text-extraction',
          textLength: documentText.length
        }
      };

      return extractedData;

    } catch (error) {
      console.error('Erro ao aplicar template:', error);
      return {
        error: error.message,
        extractedAt: new Date().toISOString(),
        campos: {}
      };
    }
  }

  /**
   * Extrair campos do texto baseado na estrutura do template
   *
   * NOTA: Esta é uma implementação básica. Para extração precisa,
   * integrar com Claude via bedrock.js para análise inteligente do texto.
   */
  extractFieldsFromText(text, templateCampos) {
    // Implementação básica - placeholder para integração futura com IA
    const extracted = {};

    // TODO: Integrar com Claude para extração inteligente
    // Por enquanto, retorna estrutura vazia baseada no template
    for (const [campo, config] of Object.entries(templateCampos)) {
      if (config.type === 'object' && config.properties) {
        extracted[campo] = this.extractFieldsFromText(text, config.properties);
      } else if (config.type === 'array') {
        extracted[campo] = [];
      } else {
        extracted[campo] = null;
      }
    }

    return extracted;
  }

  /**
   * Aplicar template genérico quando tipo não é identificado
   */
  applyGenericTemplate(documentText) {
    return {
      templateId: 'generico',
      templateNome: 'Documento Genérico',
      documentType: 'generico',
      extractedAt: new Date().toISOString(),
      campos: {
        textoCompleto: documentText,
        analise: 'Análise estruturada requer identificação do tipo de documento'
      },
      metadata: {
        confidence: 'low',
        source: 'text-extraction',
        textLength: documentText.length,
        warning: 'Tipo de documento não identificado - use template específico para melhor extração'
      }
    };
  }

  /**
   * Validar dados extraídos contra o template
   */
  validateExtractedData(extractedData, templateId) {
    const template = this.getTemplate(templateId);
    const errors = [];
    const warnings = [];

    const validateFields = (data, schema, path = '') => {
      for (const [field, config] of Object.entries(schema)) {
        const fieldPath = path ? `${path}.${field}` : field;
        const value = data[field];

        // Verificar campos obrigatórios
        if (config.required && (value === null || value === undefined || value === '')) {
          errors.push(`Campo obrigatório ausente: ${fieldPath}`);
        }

        // Verificar tipos
        if (value !== null && value !== undefined) {
          if (config.type === 'array' && !Array.isArray(value)) {
            errors.push(`Campo ${fieldPath} deveria ser array`);
          } else if (config.type === 'object' && typeof value !== 'object') {
            errors.push(`Campo ${fieldPath} deveria ser objeto`);
          } else if (config.type === 'number' && typeof value !== 'number') {
            warnings.push(`Campo ${fieldPath} deveria ser número`);
          }
        }

        // Validação recursiva para objetos
        if (config.type === 'object' && config.properties && value) {
          validateFields(value, config.properties, fieldPath);
        }
      }
    };

    validateFields(extractedData.campos, template.campos);

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Obter estatísticas do serviço
   */
  getStats() {
    return {
      initialized: this.initialized,
      totalTemplates: Object.keys(this.templates).length,
      templates: this.listTemplates(),
      version: '1.0.0'
    };
  }
}

// Singleton
const microfichamentoTemplatesService = new MicrofichamentoTemplatesService();

export default microfichamentoTemplatesService;
