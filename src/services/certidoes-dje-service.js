/**
 * Serviço de Certidões do Diário da Justiça Eletrônico (DJe/DJEN)
 * Integração com CNJ para download e análise de certidões
 *
 * @version 1.0.0
 */

import https from 'https';
import http from 'http';
import fs from 'fs/promises';
import path from 'path';
import { ACTIVE_PATHS } from '../../lib/storage-config.js';

class CertidoesDJEService {
  constructor() {
    this.initialized = false;
    this.certidoesPath = null;

    // URLs base das APIs do CNJ
    this.cnjApiBase = 'https://www.cnj.jus.br/diario-justica-eletronico';
    this.djenApiBase = 'https://www.cnj.jus.br/djen';
  }

  /**
   * Inicializar serviço
   */
  async init() {
    try {
      // Criar diretório para certidões
      this.certidoesPath = path.join(ACTIVE_PATHS.data, 'certidoes-dje');
      await fs.mkdir(this.certidoesPath, { recursive: true });

      this.initialized = true;
      console.log('✅ Serviço de Certidões DJe/DJEN inicializado');
      return true;
    } catch (error) {
      console.error('❌ Erro ao inicializar serviço de certidões:', error);
      return false;
    }
  }

  /**
   * Baixar certidão do DJe/DJEN
   *
   * @param {object} params - Parâmetros da busca
   * @param {string} params.numeroProcesso - Número do processo (CNJ)
   * @param {string} params.tribunal - Sigla do tribunal (ex: TJSP, TJRJ, STJ)
   * @param {string} params.dataPublicacao - Data da publicação (DD/MM/YYYY)
   * @param {string} params.tipo - Tipo de certidão (dje, djen, intimacao)
   * @param {string} params.projectId - ID do projeto (opcional, para adicionar ao KB)
   * @param {boolean} params.adicionarAoKB - Se deve adicionar automaticamente ao KB (padrão: true)
   * @returns {object} Dados da certidão baixada
   */
  async baixarCertidao(params) {
    try {
      if (!this.initialized) await this.init();

      const {
        numeroProcesso,
        tribunal,
        dataPublicacao,
        tipo = 'dje',
        projectId = '1', // Projeto ROM por padrão
        adicionarAoKB = true
      } = params;

      // Validar parâmetros obrigatórios
      if (!numeroProcesso) {
        throw new Error('Número do processo é obrigatório');
      }

      console.log(`📄 Buscando certidão ${tipo.toUpperCase()} - Processo: ${numeroProcesso}`);

      // Construir URL da API do CNJ
      const url = this.construirUrlCertidao({ numeroProcesso, tribunal, dataPublicacao, tipo });

      // Fazer download da certidão
      const certidaoData = await this.downloadCertidao(url);

      // Processar e salvar certidão
      const certidao = await this.processarCertidao({
        ...certidaoData,
        numeroProcesso,
        tribunal,
        dataPublicacao,
        tipo
      });

      console.log(`✅ Certidão baixada com sucesso - Nº: ${certidao.numeroCertidao}`);

      // Adicionar ao KB do projeto ROM se solicitado
      if (adicionarAoKB && projectId) {
        await this.adicionarCertidaoAoKB(certidao, projectId);
      }

      return certidao;

    } catch (error) {
      console.error('❌ Erro ao baixar certidão:', error);
      throw error;
    }
  }

  /**
   * Adicionar certidão ao Knowledge Base do projeto
   *
   * @param {object} certidao - Dados da certidão
   * @param {string} projectId - ID do projeto
   * @returns {Promise<object>} Resultado da adição ao KB
   */
  async adicionarCertidaoAoKB(certidao, projectId = '1') {
    try {
      console.log(`📚 Adicionando certidão ${certidao.numeroCertidao} ao KB do projeto ${projectId}`);

      // Validar que ACTIVE_PATHS.kb existe
      if (!ACTIVE_PATHS.kb) {
        throw new Error('ACTIVE_PATHS.kb não está definido');
      }

      // Criar diretórios do KB se não existirem
      const kbDocsPath = path.join(ACTIVE_PATHS.kb, 'documents');
      await fs.mkdir(kbDocsPath, { recursive: true });

      // Gerar conteúdo formatado da certidão
      const conteudoKB = this.gerarConteudoParaKB(certidao);

      // Nome do arquivo (sem caracteres especiais)
      const baseFilename = `certidao_${certidao.numeroCertidao.replace(/[^a-zA-Z0-9-]/g, '_')}_${Date.now()}`;

      // Salvar arquivo .txt no KB (formato que o sistema lê)
      const txtFilePath = path.join(kbDocsPath, `${baseFilename}.txt`);
      await fs.writeFile(txtFilePath, conteudoKB, 'utf-8');

      // Salvar metadados em arquivo JSON separado
      const metadataPath = path.join(kbDocsPath, `${baseFilename}.json`);
      const metadata = {
        id: certidao.id,
        numeroCertidao: certidao.numeroCertidao,
        numeroProcesso: certidao.numeroProcesso,
        tribunal: certidao.tribunal,
        tipo: 'certidao-dje',
        dataPublicacao: certidao.informacoesPrincipais.dataPublicacao,
        tipoDecisao: certidao.informacoesPrincipais.tipoDecisao,
        orgaoJulgador: certidao.informacoesPrincipais.orgaoJulgador,
        magistrado: certidao.informacoesPrincipais.magistrado,
        partes: certidao.informacoesPrincipais.partes,
        origem: 'CNJ/DJe-DJEN',
        dataDownload: certidao.dataDownload,
        projectId: projectId,
        originalFilename: `${baseFilename}.txt`
      };

      await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2), 'utf-8');

      console.log(`✅ Certidão adicionada ao KB com sucesso: ${baseFilename}.txt`);

      return {
        success: true,
        kbPath: txtFilePath,
        metadataPath,
        filename: `${baseFilename}.txt`,
        message: 'Certidão adicionada ao KB e disponível para consulta'
      };

    } catch (error) {
      console.error(`❌ Erro ao adicionar certidão ao KB:`, error);
      // Não falhar o processo principal se houver erro ao adicionar ao KB
      return { success: false, error: error.message };
    }
  }

  /**
   * Gerar conteúdo formatado da certidão para o KB
   *
   * @private
   * @param {object} certidao - Dados da certidão
   * @returns {string} Conteúdo formatado em Markdown
   */
  gerarConteudoParaKB(certidao) {
    const info = certidao.informacoesPrincipais;

    return `# Certidão de Publicação - DJe/DJEN

## Identificação

- **Número da Certidão:** ${certidao.numeroCertidao}
- **Número do Processo:** ${certidao.numeroProcesso}
- **Tribunal:** ${certidao.tribunal}
- **Tipo:** ${certidao.tipo.toUpperCase()}

## Informações da Publicação

- **Data de Publicação:** ${info.dataPublicacao}
- **Tipo de Decisão:** ${info.tipoDecisao}
- **Órgão Julgador:** ${info.orgaoJulgador}
- **Magistrado/Relator:** ${info.magistrado}

## Partes do Processo

- **Autor/Requerente:** ${info.partes.autor}
- **Réu/Requerido:** ${info.partes.reu}
${info.partes.advogados && info.partes.advogados.length > 0 ? `- **Advogados:** ${info.partes.advogados.join(', ')}` : ''}

## Resumo

${info.resumo}

## Fundamentação Legal

Conforme disposto na **Lei nº 11.419/2006**, Art. 4º, §3º e §4º:

> "Considera-se realizada a intimação no dia em que o advogado efetuou a consulta eletrônica ao teor da intimação, certificando-se nos autos a sua realização."

**Contagem de Prazo:**
- **Publicação:** ${info.dataPublicacao}
- **Início do Prazo:** 1º dia útil APÓS a publicação (excluindo sábados, domingos e feriados)

## Recomendações

✅ **JUNTADA RECOMENDADA:** Esta certidão deve ser juntada aos autos do processo.

✅ **TRANSCRIÇÃO:** Transcrever as informações principais na petição de juntada, informando o número da certidão.

✅ **VERIFICAÇÃO DE PRAZO:** Verificar prazo processual aplicável e eventual prazo em dobro (Fazenda Pública, Defensoria, litisconsortes).

---

*Certidão baixada em: ${new Date(certidao.dataDownload).toLocaleString('pt-BR')}*
*Origem: CNJ - Conselho Nacional de Justiça (Diário da Justiça Eletrônico)*
`;
  }

  /**
   * Construir URL da certidão no CNJ
   *
   * @private
   * @param {object} params - Parâmetros
   * @returns {string} URL da certidão
   */
  construirUrlCertidao(params) {
    const { numeroProcesso, tribunal, dataPublicacao, tipo } = params;

    // Limpar número do processo (remover pontos e traços)
    const processoLimpo = numeroProcesso.replace(/[.\-]/g, '');

    // Construir URL conforme tipo
    if (tipo === 'djen') {
      return `${this.djenApiBase}/api/v1/certidao?processo=${processoLimpo}&tribunal=${tribunal || ''}`;
    }

    // DJe padrão
    return `${this.cnjApiBase}/api/v1/certidao?processo=${processoLimpo}&tribunal=${tribunal || ''}&data=${dataPublicacao || ''}`;
  }

  /**
   * Download da certidão via HTTPS
   *
   * @private
   * @param {string} url - URL da certidão
   * @returns {Promise<object>} Dados da certidão
   */
  downloadCertidao(url) {
    return new Promise((resolve, reject) => {
      const protocol = url.startsWith('https') ? https : http;

      const req = protocol.get(url, (res) => {
        let data = '';

        // Verificar status
        if (res.statusCode !== 200) {
          reject(new Error(`Erro HTTP ${res.statusCode}: ${res.statusMessage}`));
          return;
        }

        // Acumular dados
        res.on('data', (chunk) => {
          data += chunk;
        });

        // Processar resposta completa
        res.on('end', () => {
          try {
            // Se resposta é JSON
            if (res.headers['content-type']?.includes('application/json')) {
              const json = JSON.parse(data);
              resolve(json);
            }
            // Se resposta é HTML/texto
            else {
              resolve({ html: data, contentType: res.headers['content-type'] });
            }
          } catch (error) {
            reject(new Error(`Erro ao processar resposta: ${error.message}`));
          }
        });
      });

      req.on('error', (error) => {
        reject(new Error(`Erro na requisição: ${error.message}`));
      });

      // Timeout de 30 segundos
      req.setTimeout(30000, () => {
        req.destroy();
        reject(new Error('Timeout ao baixar certidão'));
      });
    });
  }

  /**
   * Processar dados da certidão
   *
   * @private
   * @param {object} certidaoData - Dados brutos da certidão
   * @returns {object} Certidão processada
   */
  async processarCertidao(certidaoData) {
    try {
      const timestamp = new Date().toISOString();
      const certidaoId = `cert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // Extrair informações principais
      const certidao = {
        id: certidaoId,
        numeroCertidao: certidaoData.numeroCertidao || this.gerarNumeroCertidao(),
        numeroProcesso: certidaoData.numeroProcesso,
        tribunal: certidaoData.tribunal || 'Não especificado',
        tipo: certidaoData.tipo,
        dataPublicacao: certidaoData.dataPublicacao || new Date().toLocaleDateString('pt-BR'),
        dataDownload: timestamp,

        // Informações extraídas
        informacoesPrincipais: this.extrairInformacoesPrincipais(certidaoData),

        // Dados brutos
        dadosBrutos: certidaoData,

        // Arquivos
        arquivos: []
      };

      // Salvar certidão em disco
      await this.salvarCertidao(certidao);

      return certidao;

    } catch (error) {
      console.error('❌ Erro ao processar certidão:', error);
      throw error;
    }
  }

  /**
   * Extrair informações principais da certidão
   *
   * @private
   * @param {object} data - Dados da certidão
   * @returns {object} Informações extraídas
   */
  extrairInformacoesPrincipais(data) {
    const info = {
      dataPublicacao: data.dataPublicacao || 'Não informado',
      tipoDecisao: this.identificarTipoDecisao(data),
      partes: this.extrairPartes(data),
      orgaoJulgador: data.orgaoJulgador || data.tribunal || 'Não informado',
      magistrado: data.magistrado || data.relator || 'Não informado',
      resumo: this.gerarResumo(data)
    };

    return info;
  }

  /**
   * Identificar tipo de decisão
   *
   * @private
   * @param {object} data - Dados da certidão
   * @returns {string} Tipo de decisão
   */
  identificarTipoDecisao(data) {
    const texto = JSON.stringify(data).toLowerCase();

    if (texto.includes('sentença')) return 'Sentença';
    if (texto.includes('acórdão')) return 'Acórdão';
    if (texto.includes('decisão interlocutória')) return 'Decisão Interlocutória';
    if (texto.includes('despacho')) return 'Despacho';
    if (texto.includes('intimação')) return 'Intimação';
    if (texto.includes('citação')) return 'Citação';
    if (texto.includes('publicação')) return 'Publicação';

    return 'Ato processual';
  }

  /**
   * Extrair partes do processo
   *
   * @private
   * @param {object} data - Dados da certidão
   * @returns {object} Partes identificadas
   */
  extrairPartes(data) {
    return {
      autor: data.autor || data.requerente || 'Não informado',
      reu: data.reu || data.requerido || 'Não informado',
      advogados: data.advogados || []
    };
  }

  /**
   * Gerar resumo da certidão
   *
   * @private
   * @param {object} data - Dados da certidão
   * @returns {string} Resumo
   */
  gerarResumo(data) {
    const tipo = this.identificarTipoDecisao(data);
    const dataPublicacao = data.dataPublicacao || 'data não informada';

    return `${tipo} publicada no DJe/DJEN em ${dataPublicacao}`;
  }

  /**
   * Gerar número de certidão
   *
   * @private
   * @returns {string} Número da certidão
   */
  gerarNumeroCertidao() {
    const ano = new Date().getFullYear();
    const timestamp = Date.now().toString().slice(-8);
    return `CERT-${ano}-${timestamp}`;
  }

  /**
   * Salvar certidão em disco
   *
   * @private
   * @param {object} certidao - Dados da certidão
   */
  async salvarCertidao(certidao) {
    try {
      const filename = `${certidao.numeroCertidao.replace(/[^a-zA-Z0-9-]/g, '_')}.json`;
      const filepath = path.join(this.certidoesPath, filename);

      await fs.writeFile(filepath, JSON.stringify(certidao, null, 2), 'utf-8');

      console.log(`💾 Certidão salva: ${filename}`);

    } catch (error) {
      console.error('❌ Erro ao salvar certidão:', error);
      throw error;
    }
  }

  /**
   * Gerar recomendação de juntada
   *
   * @param {object} certidao - Dados da certidão
   * @param {object} options - Opções de formatação
   * @returns {object} Recomendação formatada
   */
  gerarRecomendacaoJuntada(certidao, options = {}) {
    const { formato = 'peticao', incluirTranscricao = true } = options;

    const info = certidao.informacoesPrincipais;

    // Texto da recomendação
    let recomendacao = {
      tipo: 'juntada',
      numeroCertidao: certidao.numeroCertidao,
      numeroProcesso: certidao.numeroProcesso,

      textoRecomendacao: `
**RECOMENDAÇÃO DE JUNTADA - CERTIDÃO DJe/DJEN**

Recomenda-se a JUNTADA da certidão de publicação nº **${certidao.numeroCertidao}** aos autos do processo nº **${certidao.numeroProcesso}**.

**INFORMAÇÕES DA CERTIDÃO:**

- **Número da Certidão:** ${certidao.numeroCertidao}
- **Data de Publicação:** ${info.dataPublicacao}
- **Tipo de Decisão:** ${info.tipoDecisao}
- **Órgão Julgador:** ${info.orgaoJulgador}
- **Magistrado:** ${info.magistrado}

${incluirTranscricao ? this.gerarTranscricao(certidao) : ''}

**FUNDAMENTAÇÃO LEGAL:**

Conforme disposto na Lei nº 11.419/2006, Art. 4º, §3º e §4º, a intimação por meio eletrônico considera-se realizada no dia em que o advogado efetuou a consulta eletrônica ao teor da intimação, ou no dia em que se esgotou o prazo para a referida consulta.

A presente certidão comprova a publicação e o início do prazo processual, conforme Resolução CNJ nº 234/2016 (DJEN).
      `.trim(),

      peticaoModelo: formato === 'peticao' ? this.gerarPeticaoJuntada(certidao) : null
    };

    return recomendacao;
  }

  /**
   * Gerar transcrição das informações principais
   *
   * @private
   * @param {object} certidao - Dados da certidão
   * @returns {string} Transcrição formatada
   */
  gerarTranscricao(certidao) {
    const info = certidao.informacoesPrincipais;

    return `
**TRANSCRIÇÃO DAS INFORMAÇÕES PRINCIPAIS:**

> "${info.resumo}"
>
> **Partes:**
> - Autor/Requerente: ${info.partes.autor}
> - Réu/Requerido: ${info.partes.reu}
>
> Publicado no Diário da Justiça Eletrônico em ${info.dataPublicacao}.
    `.trim();
  }

  /**
   * Gerar modelo de petição de juntada
   *
   * @private
   * @param {object} certidao - Dados da certidão
   * @returns {string} Petição formatada
   */
  gerarPeticaoJuntada(certidao) {
    const info = certidao.informacoesPrincipais;

    return `
**EXCELENTÍSSIMO(A) SENHOR(A) DOUTOR(A) JUIZ(A) DE DIREITO DA [VARA]**

Processo nº: ${certidao.numeroProcesso}

**[NOME DO ADVOGADO]**, [qualificação], advogado(a) inscrito(a) na OAB/[UF] sob o nº [número], vem, respeitosamente, à presença de Vossa Excelência, nos autos do processo em epígrafe, requerer a **JUNTADA DE CERTIDÃO DE PUBLICAÇÃO**, nos termos que seguem:

## I - DA JUNTADA

Requer-se a juntada aos autos da **Certidão de Publicação nº ${certidao.numeroCertidao}**, expedida pelo Diário da Justiça Eletrônico (DJe/DJEN), que comprova a publicação de ${info.tipoDecisao} em ${info.dataPublicacao}.

**Informações da Certidão:**
- **Número:** ${certidao.numeroCertidao}
- **Data de Publicação:** ${info.dataPublicacao}
- **Tipo:** ${info.tipoDecisao}
- **Órgão:** ${info.orgaoJulgador}

## II - DA FUNDAMENTAÇÃO

A presente juntada fundamenta-se na Lei nº 11.419/2006, que dispõe sobre a informatização do processo judicial, especialmente em seu Art. 4º, que regulamenta a intimação eletrônica e suas consequências processuais.

Nos termos da Resolução CNJ nº 234/2016, a certidão de publicação constitui prova inequívoca da data de disponibilização da decisão no Diário da Justiça Eletrônico Nacional (DJEN).

## III - DOS PEDIDOS

Diante do exposto, requer-se:

a) A **juntada** da certidão de publicação nº **${certidao.numeroCertidao}** aos autos;

b) O **deferimento** do pedido.

Termos em que,
Pede deferimento.

[Local], [data].

[Nome do Advogado]
OAB/[UF] nº [número]
    `.trim();
  }

  /**
   * Listar certidões salvas
   *
   * @param {object} filtros - Filtros de busca
   * @returns {Array} Lista de certidões
   */
  async listarCertidoes(filtros = {}) {
    try {
      if (!this.initialized) await this.init();

      const arquivos = await fs.readdir(this.certidoesPath);
      const certidoes = [];

      for (const arquivo of arquivos) {
        if (arquivo.endsWith('.json')) {
          const filepath = path.join(this.certidoesPath, arquivo);
          const conteudo = await fs.readFile(filepath, 'utf-8');
          const certidao = JSON.parse(conteudo);

          // Aplicar filtros
          if (filtros.numeroProcesso && certidao.numeroProcesso !== filtros.numeroProcesso) {
            continue;
          }

          if (filtros.tribunal && certidao.tribunal !== filtros.tribunal) {
            continue;
          }

          certidoes.push(certidao);
        }
      }

      // Ordenar por data de download (mais recente primeiro)
      certidoes.sort((a, b) => new Date(b.dataDownload) - new Date(a.dataDownload));

      return certidoes;

    } catch (error) {
      console.error('❌ Erro ao listar certidões:', error);
      return [];
    }
  }

  /**
   * Obter certidão por ID
   *
   * @param {string} certidaoId - ID da certidão
   * @returns {object|null} Certidão encontrada
   */
  async obterCertidao(certidaoId) {
    try {
      const certidoes = await this.listarCertidoes();
      return certidoes.find(c => c.id === certidaoId || c.numeroCertidao === certidaoId) || null;
    } catch (error) {
      console.error('❌ Erro ao obter certidão:', error);
      return null;
    }
  }

  /**
   * Deletar certidão
   *
   * @param {string} certidaoId - ID da certidão
   */
  async deletarCertidao(certidaoId) {
    try {
      const certidao = await this.obterCertidao(certidaoId);

      if (!certidao) {
        throw new Error('Certidão não encontrada');
      }

      const filename = `${certidao.numeroCertidao.replace(/[^a-zA-Z0-9-]/g, '_')}.json`;
      const filepath = path.join(this.certidoesPath, filename);

      await fs.unlink(filepath);

      console.log(`🗑️  Certidão deletada: ${certidao.numeroCertidao}`);
      return true;

    } catch (error) {
      console.error('❌ Erro ao deletar certidão:', error);
      return false;
    }
  }
}

// Singleton
const certidoesDJEService = new CertidoesDJEService();

export default certidoesDJEService;
