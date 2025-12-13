#!/usr/bin/env node

/**
 * ROM CLI Advanced - Interface de Linha de Comando Completa
 * Com suporte a todos os sinalizadores, subagentes e workflows
 */

import readline from 'readline';
import { ROMAgent, CONFIG, TOOLS, processarFerramenta } from './index.js';
import { SubagentManager, SUBAGENTES } from './modules/subagents.js';
import dotenv from 'dotenv';
import fs from 'fs/promises';
import path from 'path';

dotenv.config();

// ============================================================================
// CONSTANTES E CONFIGURAÇÃO
// ============================================================================

const VERSION = '2.0.0';

const CORES = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  underscore: '\x1b[4m',
  blink: '\x1b[5m',
  reverse: '\x1b[7m',
  hidden: '\x1b[8m',
  black: '\x1b[30m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  bgBlack: '\x1b[40m',
  bgRed: '\x1b[41m',
  bgGreen: '\x1b[42m',
  bgYellow: '\x1b[43m',
  bgBlue: '\x1b[44m',
  bgMagenta: '\x1b[45m',
  bgCyan: '\x1b[46m',
  bgWhite: '\x1b[47m'
};

// ============================================================================
// FUNÇÕES UTILITÁRIAS
// ============================================================================

function log(cor, texto) {
  console.log(`${cor}${texto}${CORES.reset}`);
}

function parseArgs(args) {
  const parsed = {
    command: null,
    subcommand: null,
    flags: {},
    positional: []
  };

  let i = 0;
  while (i < args.length) {
    const arg = args[i];

    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const nextArg = args[i + 1];

      if (nextArg && !nextArg.startsWith('-')) {
        parsed.flags[key] = nextArg;
        i += 2;
      } else {
        parsed.flags[key] = true;
        i++;
      }
    } else if (arg.startsWith('-')) {
      const key = arg.slice(1);
      const nextArg = args[i + 1];

      if (nextArg && !nextArg.startsWith('-')) {
        parsed.flags[key] = nextArg;
        i += 2;
      } else {
        parsed.flags[key] = true;
        i++;
      }
    } else {
      if (!parsed.command) {
        parsed.command = arg;
      } else if (!parsed.subcommand) {
        parsed.subcommand = arg;
      } else {
        parsed.positional.push(arg);
      }
      i++;
    }
  }

  return parsed;
}

// ============================================================================
// BANNER E AJUDA
// ============================================================================

function exibirBanner() {
  console.log(`
${CORES.cyan}╔══════════════════════════════════════════════════════════════╗
║                                                              ║
║   ${CORES.bright}${CORES.yellow}██████╗  ██████╗ ███╗   ███╗${CORES.reset}${CORES.cyan}                              ║
║   ${CORES.bright}${CORES.yellow}██╔══██╗██╔═══██╗████╗ ████║${CORES.reset}${CORES.cyan}                              ║
║   ${CORES.bright}${CORES.yellow}██████╔╝██║   ██║██╔████╔██║${CORES.reset}${CORES.cyan}                              ║
║   ${CORES.bright}${CORES.yellow}██╔══██╗██║   ██║██║╚██╔╝██║${CORES.reset}${CORES.cyan}                              ║
║   ${CORES.bright}${CORES.yellow}██║  ██║╚██████╔╝██║ ╚═╝ ██║${CORES.reset}${CORES.cyan}                              ║
║   ${CORES.bright}${CORES.yellow}╚═╝  ╚═╝ ╚═════╝ ╚═╝     ╚═╝${CORES.reset}${CORES.cyan}                              ║
║                                                              ║
║   ${CORES.white}Redator de Obras Magistrais v${VERSION}${CORES.cyan}                       ║
║   ${CORES.dim}Agente de IA para Redação de Peças Jurídicas${CORES.reset}${CORES.cyan}              ║
║   ${CORES.dim}Clone do Claude AI Reference Implementation${CORES.reset}${CORES.cyan}               ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝${CORES.reset}
`);
}

function exibirAjuda() {
  console.log(`
${CORES.cyan}${CORES.bright}USO:${CORES.reset}
  rom [comando] [opções] [argumentos]

${CORES.cyan}${CORES.bright}COMANDOS:${CORES.reset}
  ${CORES.green}chat${CORES.reset}         Iniciar chat interativo com o ROM
  ${CORES.green}analisar${CORES.reset}     Analisar processo jurídico
  ${CORES.green}resumo${CORES.reset}       Gerar resumo executivo (Camada 1, 2 ou 3)
  ${CORES.green}redigir${CORES.reset}      Redigir peça jurídica
  ${CORES.green}pesquisar${CORES.reset}    Pesquisar jurisprudência
  ${CORES.green}extrair${CORES.reset}      Extrair texto de PDF (33 ferramentas + 10 processadores)
  ${CORES.green}revisar${CORES.reset}      Revisar português jurídico
  ${CORES.green}contrato${CORES.reset}     Elaborar contrato
  ${CORES.green}agents${CORES.reset}       Gerenciar subagentes
  ${CORES.green}workflow${CORES.reset}     Executar workflow completo
  ${CORES.green}config${CORES.reset}       Gerenciar configurações

${CORES.cyan}${CORES.bright}FLAGS GLOBAIS:${CORES.reset}
  ${CORES.yellow}-h, --help${CORES.reset}              Exibe ajuda
  ${CORES.yellow}-v, --version${CORES.reset}           Exibe versão
  ${CORES.yellow}-V, --verbose${CORES.reset}           Modo verboso
  ${CORES.yellow}-q, --quiet${CORES.reset}             Modo silencioso
  ${CORES.yellow}-m, --model${CORES.reset} <modelo>    Modelo (sonnet|opus|haiku)
  ${CORES.yellow}-t, --max-tokens${CORES.reset} <n>    Máximo de tokens
  ${CORES.yellow}-o, --output${CORES.reset} <arquivo>  Arquivo de saída
  ${CORES.yellow}-f, --format${CORES.reset} <formato>  Formato (md|pdf|docx|html)

${CORES.cyan}${CORES.bright}FLAGS DE AGENTE:${CORES.reset}
  ${CORES.yellow}-a, --agent${CORES.reset} <nome>      Subagente específico
  ${CORES.yellow}-w, --workflow${CORES.reset} <nome>   Workflow a executar
  ${CORES.yellow}-l, --camada${CORES.reset} <1|2|3>    Camada do resumo

${CORES.cyan}${CORES.bright}FLAGS DE DOCUMENTO:${CORES.reset}
  ${CORES.yellow}-p, --tipo-peca${CORES.reset} <tipo>  Tipo de peça jurídica
  ${CORES.yellow}--timbrado${CORES.reset}              Incluir papel timbrado
  ${CORES.yellow}--tribunal${CORES.reset} <sigla>      Tribunal para pesquisa

${CORES.cyan}${CORES.bright}SUBAGENTES DISPONÍVEIS:${CORES.reset}
  analise-processual    Análise exaustiva de processos
  resumo-executivo      Resumos em 3 camadas
  jurisprudencia        Pesquisa de jurisprudência
  leading-case          Análise de precedentes
  prequestionamento     Elaboração de prequestionamento
  prazos                Análise de prescrição/decadência
  redator-civel         Redação de peças cíveis
  redator-criminal      Redação de peças criminais
  redator-trabalhista   Redação de peças trabalhistas
  contratos             Elaboração de contratos
  revisor-portugues     Revisão de português
  extrator              Extração de PDFs
  calculista            Cálculos judiciais

${CORES.cyan}${CORES.bright}WORKFLOWS DISPONÍVEIS:${CORES.reset}
  analise-completa      Pipeline completo de análise
  redacao-civel         Pipeline de redação cível
  redacao-criminal      Pipeline de redação criminal

${CORES.cyan}${CORES.bright}EXEMPLOS:${CORES.reset}
  ${CORES.dim}# Chat interativo${CORES.reset}
  rom chat

  ${CORES.dim}# Analisar processo com resumo Camada 3${CORES.reset}
  rom analisar processo.pdf --camada 3

  ${CORES.dim}# Redigir apelação e salvar como DOCX${CORES.reset}
  rom redigir --tipo-peca apelacao -o apelacao.docx

  ${CORES.dim}# Pesquisar jurisprudência no STJ${CORES.reset}
  rom pesquisar "dano moral" --tribunal STJ

  ${CORES.dim}# Usar subagente específico${CORES.reset}
  rom --agent resumo-executivo --camada 3

  ${CORES.dim}# Executar workflow completo${CORES.reset}
  rom workflow analise-completa processo.pdf

${CORES.cyan}${CORES.bright}COMANDOS INTERATIVOS:${CORES.reset}
  /ajuda       Exibe ajuda
  /limpar      Limpa histórico
  /agents      Lista subagentes
  /agent <n>   Usa subagente
  /workflow    Executa workflow
  /pecas       Lista peças jurídicas
  /prompts     Lista prompts
  /sair        Encerra
`);
}

function exibirVersao() {
  console.log(`ROM - Redator de Obras Magistrais v${VERSION}`);
  console.log('Clone do Claude AI Reference Implementation');
  console.log('Ferramentas SDK: 41 | Subagentes: 14 | Workflows: 3');
}

// ============================================================================
// CLASSE CLI
// ============================================================================

class ROMCLI {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.agent = new ROMAgent(apiKey);
    this.subagentManager = new SubagentManager(apiKey);
    this.currentAgent = null;
    this.verbose = false;
  }

  // Lista subagentes
  listarAgents() {
    console.log(`\n${CORES.cyan}${CORES.bright}SUBAGENTES DISPONÍVEIS:${CORES.reset}\n`);

    const subagents = this.subagentManager.listarSubagentes();

    subagents.forEach((agent, index) => {
      console.log(`  ${CORES.green}${index + 1}. ${agent.name}${CORES.reset}`);
      console.log(`     ${CORES.dim}ID: ${agent.id}${CORES.reset}`);
      console.log(`     ${CORES.dim}${agent.description}${CORES.reset}`);
      console.log(`     ${CORES.yellow}Tipo: ${agent.type}${CORES.reset}\n`);
    });
  }

  // Lista workflows
  listarWorkflows() {
    console.log(`\n${CORES.cyan}${CORES.bright}WORKFLOWS DISPONÍVEIS:${CORES.reset}\n`);

    const workflows = [
      {
        id: 'analise-completa',
        name: 'Análise Completa',
        description: 'Pipeline completo: extração → análise → resumo → jurisprudência → leading cases → prazos',
        steps: 6
      },
      {
        id: 'redacao-civel',
        name: 'Redação Cível',
        description: 'Pipeline de redação: análise → pesquisa → redação → revisão',
        steps: 4
      },
      {
        id: 'redacao-criminal',
        name: 'Redação Criminal',
        description: 'Pipeline de redação criminal: análise → pesquisa → redação → revisão',
        steps: 4
      }
    ];

    workflows.forEach((wf, index) => {
      console.log(`  ${CORES.green}${index + 1}. ${wf.name}${CORES.reset}`);
      console.log(`     ${CORES.dim}ID: ${wf.id}${CORES.reset}`);
      console.log(`     ${CORES.dim}${wf.description}${CORES.reset}`);
      console.log(`     ${CORES.yellow}Etapas: ${wf.steps}${CORES.reset}\n`);
    });
  }

  // Lista peças jurídicas
  listarPecas() {
    console.log(`\n${CORES.cyan}${CORES.bright}PEÇAS JURÍDICAS DISPONÍVEIS:${CORES.reset}\n`);

    const categorias = {
      'CÍVEIS': [
        'peticao_inicial', 'contestacao', 'replica', 'impugnacao',
        'embargos_declaracao', 'apelacao', 'agravo_instrumento',
        'recurso_especial', 'recurso_extraordinario', 'mandado_seguranca'
      ],
      'CRIMINAIS': [
        'habeas_corpus', 'resposta_acusacao', 'alegacoes_finais',
        'memoriais', 'apelacao_criminal', 'revisao_criminal',
        'rese', 'embargos_infringentes'
      ],
      'TRABALHISTAS': [
        'reclamacao_trabalhista', 'contestacao_trabalhista',
        'recurso_ordinario', 'agravo_peticao', 'recurso_revista'
      ],
      'EXTRAPROCESSUAIS': [
        'contrato_social', 'contrato_honorarios', 'procuracao',
        'substabelecimento', 'notificacao', 'parecer'
      ]
    };

    Object.entries(categorias).forEach(([cat, pecas]) => {
      console.log(`  ${CORES.green}${cat}:${CORES.reset}`);
      pecas.forEach(p => console.log(`    ${CORES.dim}- ${p}${CORES.reset}`));
      console.log();
    });
  }

  // Executa workflow
  async executarWorkflow(workflowId, input) {
    console.log(`\n${CORES.cyan}Executando workflow: ${workflowId}${CORES.reset}\n`);

    try {
      const result = await this.subagentManager.executarWorkflow(
        workflowId,
        input,
        (progress) => {
          console.log(`${CORES.yellow}[${progress.step}/${progress.total}] ${progress.action}...${CORES.reset}`);
        }
      );

      console.log(`\n${CORES.green}✓ Workflow concluído!${CORES.reset}\n`);
      console.log(result.finalResult);

      return result;
    } catch (error) {
      console.log(`${CORES.red}✗ Erro no workflow: ${error.message}${CORES.reset}`);
    }
  }

  // Processa comando interativo
  async processarComando(input) {
    const cmd = input.toLowerCase().split(' ')[0];
    const args = input.slice(cmd.length).trim();

    switch (cmd) {
      case '/ajuda':
      case '/help':
        exibirAjuda();
        break;

      case '/limpar':
      case '/clear':
        this.agent.limparHistorico();
        console.log(`${CORES.green}✓ Histórico limpo${CORES.reset}`);
        break;

      case '/agents':
      case '/agentes':
        this.listarAgents();
        break;

      case '/agent':
        if (args) {
          const subagent = this.subagentManager.obterSubagente(args);
          if (subagent) {
            this.currentAgent = args;
            console.log(`${CORES.green}✓ Usando subagente: ${subagent.name}${CORES.reset}`);
          } else {
            console.log(`${CORES.red}✗ Subagente não encontrado: ${args}${CORES.reset}`);
          }
        } else {
          console.log(`${CORES.yellow}Uso: /agent <nome-do-agente>${CORES.reset}`);
        }
        break;

      case '/workflow':
        if (args) {
          const [wfId, ...wfArgs] = args.split(' ');
          await this.executarWorkflow(wfId, wfArgs.join(' '));
        } else {
          this.listarWorkflows();
        }
        break;

      case '/pecas':
        this.listarPecas();
        break;

      case '/prompts':
        const prompts = this.agent.listarPrompts();
        console.log(`\n${CORES.cyan}Prompts disponíveis:${CORES.reset}`);
        prompts.forEach(p => console.log(`  ${CORES.dim}- ${p}${CORES.reset}`));
        break;

      case '/resumo':
        const camada = parseInt(args) || 3;
        console.log(`${CORES.cyan}Gerando resumo executivo Camada ${camada}...${CORES.reset}`);
        return await this.subagentManager.invocarSubagente('resumo-executivo', `Gere um resumo executivo Camada ${camada} do processo em análise.`);

      case '/sair':
      case '/exit':
      case '/quit':
        console.log(`\n${CORES.cyan}Até logo! ROM - Redator de Obras Magistrais${CORES.reset}\n`);
        process.exit(0);

      default:
        return null; // Não é um comando, processar como mensagem
    }

    return { handled: true };
  }

  // Chat interativo
  async chat() {
    exibirBanner();
    log(CORES.green, '✓ ROM Agent inicializado com 41 ferramentas e 14 subagentes!\n');
    log(CORES.dim, 'Digite /ajuda para ver os comandos disponíveis.\n');

    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    const prompt = () => {
      const agentIndicator = this.currentAgent ? `[${this.currentAgent}]` : '';
      rl.question(`${CORES.cyan}ROM${agentIndicator}>${CORES.reset} `, async (input) => {
        const inputTrimmed = input.trim();

        if (!inputTrimmed) {
          prompt();
          return;
        }

        // Verificar se é comando
        if (inputTrimmed.startsWith('/')) {
          const result = await this.processarComando(inputTrimmed);
          if (result?.handled) {
            prompt();
            return;
          }
        }

        // Processar como mensagem
        try {
          console.log(`\n${CORES.dim}Processando...${CORES.reset}\n`);

          let resposta;
          if (this.currentAgent) {
            const result = await this.subagentManager.invocarSubagente(this.currentAgent, inputTrimmed);
            resposta = result.response;
          } else {
            resposta = await this.agent.processar(inputTrimmed);
          }

          console.log(`${CORES.green}ROM:${CORES.reset}\n${resposta}\n`);
        } catch (error) {
          console.log(`${CORES.red}Erro: ${error.message}${CORES.reset}\n`);
        }

        prompt();
      });
    };

    prompt();
  }
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  const args = process.argv.slice(2);
  const parsed = parseArgs(args);

  // Verificar API key
  const apiKey = process.env.ANTHROPIC_API_KEY;

  // Flags globais
  if (parsed.flags.help || parsed.flags.h) {
    exibirAjuda();
    return;
  }

  if (parsed.flags.version || parsed.flags.v) {
    exibirVersao();
    return;
  }

  if (!apiKey) {
    log(CORES.red, '\n⚠ ERRO: ANTHROPIC_API_KEY não configurada!');
    log(CORES.yellow, 'Configure a variável de ambiente ou crie um arquivo .env');
    console.log('\nExemplo:\nexport ANTHROPIC_API_KEY=sua_chave_aqui\n');
    process.exit(1);
  }

  const cli = new ROMCLI(apiKey);
  cli.verbose = parsed.flags.verbose || parsed.flags.V;

  // Processar comando
  const command = parsed.command || 'chat';

  switch (command) {
    case 'chat':
      await cli.chat();
      break;

    case 'agents':
      cli.listarAgents();
      break;

    case 'workflows':
      cli.listarWorkflows();
      break;

    case 'pecas':
      cli.listarPecas();
      break;

    case 'workflow':
      if (parsed.subcommand) {
        await cli.executarWorkflow(parsed.subcommand, parsed.positional.join(' '));
      } else {
        cli.listarWorkflows();
      }
      break;

    default:
      // Comando não reconhecido, iniciar chat
      await cli.chat();
  }
}

main().catch(console.error);
