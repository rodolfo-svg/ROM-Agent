/**
 * Script de migração completa de todos os prompts para o Projeto ROM
 *
 * Este script converte TODOS os prompts de prompts.js e promptsCompletos.js
 * para arquivos JSON no formato do Projeto ROM
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Importar prompts existentes
import * as prompts from '../src/modules/prompts.js';
import * as promptsCompletos from '../src/modules/promptsCompletos.js';

const ROM_PROJECT_PATH = path.join(__dirname, '../data/rom-project');

/**
 * Converte um prompt do formato antigo para o novo formato JSON
 */
function convertToROMFormat(id, prompt, source) {
  const basePrompt = {
    id,
    nome: prompt.nome || id,
    categoria: prompt.categoria || 'geral',
    subcategoria: prompt.subcategoria || 'outros',
    version: prompt.version || '1.0',
    updated: new Date().toISOString(),
    autoUpdateable: true,
    descricao: prompt.descricao || `Prompt para ${prompt.nome || id}`,
    tags: prompt.tags || [],
    source: source // Indicar de onde veio (prompts.js ou promptsCompletos.js)
  };

  // Adicionar estrutura se existir
  if (prompt.estrutura) {
    basePrompt.estrutura = prompt.estrutura;
  }

  // Adicionar instruções se existir
  if (prompt.instrucoes) {
    basePrompt.instrucoes = prompt.instrucoes;
  }

  // Adicionar fundamentos se existir
  if (prompt.fundamentos) {
    basePrompt.fundamentos = prompt.fundamentos;
  }

  // Adicionar formatação se existir
  if (prompt.formatacao) {
    basePrompt.formatacao = prompt.formatacao;
  }

  // Adicionar checklist se existir
  if (prompt.checklist || prompt.checklistQualidade) {
    basePrompt.checklistQualidade = prompt.checklist || prompt.checklistQualidade;
  }

  // Adicionar extensão se existir
  if (prompt.extensao) {
    basePrompt.extensao = prompt.extensao;
  }

  // Adicionar requisitos se existir
  if (prompt.requisitos) {
    basePrompt.requisitos = prompt.requisitos;
  }

  // Adicionar modalidades se existir (habeas corpus)
  if (prompt.modalidades) {
    basePrompt.modalidades = prompt.modalidades;
  }

  // Adicionar hipóteses de cabimento se existir
  if (prompt.hipotesesCabimento || prompt.hipoteses_cabimento) {
    basePrompt.hipotesesCabimento = prompt.hipotesesCabimento || prompt.hipoteses_cabimento;
  }

  // Adicionar competência se existir
  if (prompt.competencia) {
    basePrompt.competencia = prompt.competencia;
  }

  // Adicionar documentação se existir
  if (prompt.documentacao || prompt.documentacaoEssencial) {
    basePrompt.documentacaoEssencial = prompt.documentacao || prompt.documentacaoEssencial;
  }

  // Adicionar dados do paciente se existir (habeas corpus)
  if (prompt.dadosPaciente) {
    basePrompt.dadosPaciente = prompt.dadosPaciente;
  }

  // Adicionar não cabe se existir
  if (prompt.naoCabe || prompt.nao_cabe) {
    basePrompt.naoCabe = prompt.naoCabe || prompt.nao_cabe;
  }

  // Adicionar proibições se existir
  if (prompt.proibicoes) {
    basePrompt.proibicoes = prompt.proibicoes;
  }

  // Adicionar perfil se existir
  if (prompt.perfil) {
    basePrompt.perfil = prompt.perfil;
  }

  // Adicionar vocabulário se existir
  if (prompt.vocabulario) {
    basePrompt.vocabulario = prompt.vocabulario;
  }

  // Adicionar destaques se existir
  if (prompt.destaques) {
    basePrompt.destaques = prompt.destaques;
  }

  // Adicionar extensão se existir
  if (prompt.extensao) {
    basePrompt.extensao = prompt.extensao;
  }

  // Adicionar técnicas se existir (contestação)
  if (prompt.tecnicas) {
    basePrompt.tecnicas = prompt.tecnicas;
  }

  // Adicionar preliminares se existir
  if (prompt.preliminares) {
    basePrompt.preliminares = prompt.preliminares;
  }

  // Adicionar prejudiciais se existir
  if (prompt.prejudiciais) {
    basePrompt.prejudiciais = prompt.prejudiciais;
  }

  // Adicionar absolvição se existir (alegações finais criminais)
  if (prompt.absolvicao) {
    basePrompt.absolvicao = prompt.absolvicao;
  }

  // Adicionar teses se existir
  if (prompt.teses) {
    basePrompt.teses = prompt.teses;
  }

  // Adicionar observações DNRC se existir
  if (prompt.observacoesDNRC) {
    basePrompt.observacoesDNRC = prompt.observacoesDNRC;
  }

  // Adicionar tipos de alteração se existir
  if (prompt.tiposAlteracao) {
    basePrompt.tiposAlteracao = prompt.tiposAlteracao;
  }

  // Adicionar consolidação se existir
  if (prompt.consolidacao) {
    basePrompt.consolidacao = prompt.consolidacao;
  }

  // Adicionar modelo preâmbulo se existir
  if (prompt.modeloPreambulo) {
    basePrompt.modeloPreambulo = prompt.modeloPreambulo;
  }

  // Adicionar modelo encerramento se existir
  if (prompt.modeloEncerramento) {
    basePrompt.modeloEncerramento = prompt.modeloEncerramento;
  }

  // Adicionar checklist ante cadastro se existir
  if (prompt.checklistAntesCadastro) {
    basePrompt.checklistAntesCadastro = prompt.checklistAntesCadastro;
  }

  // Adicionar prazos de registro se existir
  if (prompt.prazosRegistro) {
    basePrompt.prazosRegistro = prompt.prazosRegistro;
  }

  // Adicionar requisitos formais se existir
  if (prompt.requisitosFormais) {
    basePrompt.requisitosFormais = prompt.requisitosFormais;
  }

  // Adicionar escritório se existir (master)
  if (prompt.escritorio) {
    basePrompt.escritorio = prompt.escritorio;
  }

  // Adicionar vocativos se existir
  if (prompt.vocativos) {
    basePrompt.vocativos = prompt.vocativos;
  }

  // Adicionar citações se existir
  if (prompt.citacoes) {
    basePrompt.citacoes = prompt.citacoes;
  }

  // Adicionar precedentes se existir
  if (prompt.precedentes) {
    basePrompt.precedentes = prompt.precedentes;
  }

  // Adicionar checklist universal se existir
  if (prompt.checklist_universal) {
    basePrompt.checklistUniversal = prompt.checklist_universal;
  }

  return basePrompt;
}

/**
 * Determina a categoria (pasta) do prompt
 */
function getCategoryFolder(prompt) {
  const categoria = (prompt.categoria || 'geral').toLowerCase();

  if (['civel', 'criminal', 'trabalhista', 'processual'].includes(categoria)) {
    return 'judiciais';
  }

  if (['empresarial', 'contratos', 'procuracoes', 'notificacoes', 'pareceres', 'termos', 'declaracoes'].includes(categoria)) {
    return 'extrajudiciais';
  }

  return 'gerais';
}

/**
 * Migra todos os prompts de prompts.js
 */
async function migratePromptsJS() {
  console.log('\n📦 Migrando prompts de prompts.js...\n');

  const allPrompts = {
    ...prompts.PECAS_CIVEIS,
    ...prompts.PECAS_CRIMINAIS,
    ...prompts.PECAS_TRABALHISTAS,
    ...prompts.PECAS_EXTRAPROCESSUAIS
  };

  let count = 0;

  for (const [id, prompt] of Object.entries(allPrompts)) {
    const romPrompt = convertToROMFormat(id, prompt, 'prompts.js');
    const categoryFolder = getCategoryFolder(romPrompt);

    const filePath = path.join(ROM_PROJECT_PATH, 'prompts', categoryFolder, `${id}.json`);

    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, JSON.stringify(romPrompt, null, 2));

    console.log(`✅ Migrado: ${categoryFolder}/${id}.json`);
    count++;
  }

  console.log(`\n📊 Total de prompts migrados de prompts.js: ${count}`);
  return count;
}

/**
 * Migra todos os prompts de promptsCompletos.js
 */
async function migratePromptsCompletosJS() {
  console.log('\n📦 Migrando prompts de promptsCompletos.js...\n');

  const prompts = {
    'master-rom': promptsCompletos.MASTER_ROM,
    'peticao-inicial-completa': promptsCompletos.PROMPT_PETICAO_INICIAL,
    'habeas-corpus-completo': promptsCompletos.PROMPT_HABEAS_CORPUS,
    'contestacao-completa': promptsCompletos.PROMPT_CONTESTACAO,
    'alegacoes-finais': promptsCompletos.PROMPT_ALEGACOES_FINAIS,
    'apelacao-criminal': promptsCompletos.PROMPT_APELACAO_CRIMINAL,
    'resposta-acusacao': promptsCompletos.PROMPT_RESPOSTA_ACUSACAO,
    'revisao-criminal': promptsCompletos.PROMPT_REVISAO_CRIMINAL,
    'embargos-declaracao-completo': promptsCompletos.PROMPT_EMBARGOS_DECLARACAO,
    'agravo-interno': promptsCompletos.PROMPT_AGRAVO_INTERNO
  };

  let count = 0;

  for (const [id, prompt] of Object.entries(prompts)) {
    if (!prompt) continue;

    const romPrompt = convertToROMFormat(id, prompt, 'promptsCompletos.js');
    const categoryFolder = getCategoryFolder(romPrompt);

    const filePath = path.join(ROM_PROJECT_PATH, 'prompts', categoryFolder, `${id}.json`);

    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, JSON.stringify(romPrompt, null, 2));

    console.log(`✅ Migrado: ${categoryFolder}/${id}.json`);
    count++;
  }

  console.log(`\n📊 Total de prompts migrados de promptsCompletos.js: ${count}`);
  return count;
}

/**
 * Gera relatório de migração
 */
async function generateReport(totalPromptsJS, totalPromptsCompletos) {
  const report = {
    dataMigracao: new Date().toISOString(),
    totalPromptsMigrados: totalPromptsJS + totalPromptsCompletos,
    fontes: {
      'prompts.js': totalPromptsJS,
      'promptsCompletos.js': totalPromptsCompletos
    },
    estrutura: {
      judiciais: (await fs.readdir(path.join(ROM_PROJECT_PATH, 'prompts', 'judiciais'))).length,
      extrajudiciais: (await fs.readdir(path.join(ROM_PROJECT_PATH, 'prompts', 'extrajudiciais'))).length,
      gerais: (await fs.readdir(path.join(ROM_PROJECT_PATH, 'prompts', 'gerais'))).length
    }
  };

  const reportPath = path.join(ROM_PROJECT_PATH, 'migration-report.json');
  await fs.writeFile(reportPath, JSON.stringify(report, null, 2));

  console.log('\n📊 RELATÓRIO DE MIGRAÇÃO');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`Data: ${report.dataMigracao}`);
  console.log(`Total migrado: ${report.totalPromptsMigrados} prompts`);
  console.log(`\nPor fonte:`);
  console.log(`  - prompts.js: ${report.fontes['prompts.js']}`);
  console.log(`  - promptsCompletos.js: ${report.fontes['promptsCompletos.js']}`);
  console.log(`\nPor categoria:`);
  console.log(`  - Judiciais: ${report.estrutura.judiciais} arquivos`);
  console.log(`  - Extrajudiciais: ${report.estrutura.extrajudiciais} arquivos`);
  console.log(`  - Gerais: ${report.estrutura.gerais} arquivos`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log(`📄 Relatório salvo em: ${reportPath}\n`);

  return report;
}

/**
 * Executa a migração completa
 */
async function runMigration() {
  console.log('\n🚀 MIGRAÇÃO COMPLETA DE PROMPTS PARA PROJETO ROM');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  try {
    // Migrar de prompts.js
    const totalPromptsJS = await migratePromptsJS();

    // Migrar de promptsCompletos.js
    const totalPromptsCompletos = await migratePromptsCompletosJS();

    // Gerar relatório
    const report = await generateReport(totalPromptsJS, totalPromptsCompletos);

    console.log('✅ MIGRAÇÃO CONCLUÍDA COM SUCESSO!\n');

    return report;

  } catch (error) {
    console.error('❌ Erro durante a migração:', error);
    throw error;
  }
}

// Executar migração se chamado diretamente
if (import.meta.url === `file://${process.argv[1]}`) {
  runMigration()
    .then(() => {
      console.log('👍 Pronto para uso!\n');
      process.exit(0);
    })
    .catch(error => {
      console.error('\n💥 Falha na migração:', error.message);
      process.exit(1);
    });
}

export default runMigration;
export { migratePromptsJS, migratePromptsCompletosJS, convertToROMFormat };
