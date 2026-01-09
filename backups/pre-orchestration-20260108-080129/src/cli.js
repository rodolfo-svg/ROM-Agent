#!/usr/bin/env node

/**
 * ROM CLI - Interface de Linha de Comando
 * Interaja com o agente ROM diretamente pelo terminal
 */

import readline from 'readline';
import { ROMAgent, CONFIG } from './index.js';
import dotenv from 'dotenv';

dotenv.config();

const CORES = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

function log(cor, texto) {
  console.log(`${cor}${texto}${CORES.reset}`);
}

function exibirBanner() {
  console.log(`
${CORES.cyan}╔══════════════════════════════════════════════════════════════╗
║                                                              ║
║   ${CORES.bright}██████╗  ██████╗ ███╗   ███╗${CORES.reset}${CORES.cyan}                              ║
║   ${CORES.bright}██╔══██╗██╔═══██╗████╗ ████║${CORES.reset}${CORES.cyan}                              ║
║   ${CORES.bright}██████╔╝██║   ██║██╔████╔██║${CORES.reset}${CORES.cyan}                              ║
║   ${CORES.bright}██╔══██╗██║   ██║██║╚██╔╝██║${CORES.reset}${CORES.cyan}                              ║
║   ${CORES.bright}██║  ██║╚██████╔╝██║ ╚═╝ ██║${CORES.reset}${CORES.cyan}                              ║
║   ${CORES.bright}╚═╝  ╚═╝ ╚═════╝ ╚═╝     ╚═╝${CORES.reset}${CORES.cyan}                              ║
║                                                              ║
║   ${CORES.yellow}Redator de Obras Magistrais v${CONFIG.versao}${CORES.cyan}                       ║
║   ${CORES.dim}Agente de IA para Redação de Peças Jurídicas${CORES.reset}${CORES.cyan}              ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝${CORES.reset}
`);
}

function exibirAjuda() {
  console.log(`
${CORES.cyan}Comandos disponíveis:${CORES.reset}
  ${CORES.green}/ajuda${CORES.reset}      - Exibe esta ajuda
  ${CORES.green}/limpar${CORES.reset}     - Limpa o histórico da conversa
  ${CORES.green}/prompts${CORES.reset}    - Lista prompts disponíveis
  ${CORES.green}/prompt${CORES.reset} [nome] - Exibe um prompt específico
  ${CORES.green}/tribunais${CORES.reset}  - Lista tribunais disponíveis
  ${CORES.green}/codigos${CORES.reset}    - Lista códigos e leis disponíveis
  ${CORES.green}/pecas${CORES.reset}      - Lista tipos de peças jurídicas
  ${CORES.green}/extrair${CORES.reset} [caminho] - Extrai texto de PDF
  ${CORES.green}/sair${CORES.reset}       - Encerra o programa

${CORES.cyan}Exemplos de uso:${CORES.reset}
  - "Redija uma petição inicial de indenização por danos morais"
  - "Busque jurisprudência do STJ sobre responsabilidade civil"
  - "Qual o prazo prescricional do art. 206 do Código Civil?"
  - "Verifique a gramática: O réu foram citados"
`);
}

async function main() {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    log(CORES.red, '\n⚠ ERRO: ANTHROPIC_API_KEY não configurada!');
    log(CORES.yellow, 'Configure a variável de ambiente ou crie um arquivo .env');
    console.log('\nExemplo:\nexport ANTHROPIC_API_KEY=sua_chave_aqui\n');
    process.exit(1);
  }

  exibirBanner();

  const agent = new ROMAgent(apiKey);
  log(CORES.green, '✓ Agente ROM inicializado com sucesso!\n');
  log(CORES.dim, 'Digite /ajuda para ver os comandos disponíveis.\n');

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  const prompt = () => {
    rl.question(`${CORES.cyan}ROM>${CORES.reset} `, async (input) => {
      const inputTrimmed = input.trim();

      if (!inputTrimmed) {
        prompt();
        return;
      }

      // Comandos especiais
      if (inputTrimmed.startsWith('/')) {
        const [comando, ...args] = inputTrimmed.slice(1).split(' ');

        switch (comando.toLowerCase()) {
          case 'sair':
          case 'exit':
          case 'quit':
            log(CORES.yellow, '\n👋 Até logo! O ROM está sempre à disposição.\n');
            rl.close();
            process.exit(0);
            break;

          case 'ajuda':
          case 'help':
            exibirAjuda();
            break;

          case 'limpar':
          case 'clear':
            agent.limparHistorico();
            log(CORES.green, '✓ Histórico limpo!\n');
            break;

          case 'prompts':
            const prompts = agent.listarPrompts();
            log(CORES.cyan, '\nPrompts disponíveis:');
            prompts.forEach(p => console.log(`  - ${p}`));
            console.log('');
            break;

          case 'prompt':
            if (args.length > 0) {
              const promptConteudo = agent.obterPrompt(args.join(' '));
              if (promptConteudo) {
                console.log(`\n${promptConteudo.substring(0, 1000)}...\n`);
              } else {
                log(CORES.red, 'Prompt não encontrado.');
              }
            } else {
              log(CORES.yellow, 'Uso: /prompt [nome]');
            }
            break;

          case 'tribunais':
            const { listarTribunais } = await import('./modules/tribunais.js');
            const tribunaisLista = listarTribunais();
            log(CORES.cyan, '\nTribunais disponíveis:');
            console.log('  Superiores:', tribunaisLista.superiores.join(', '));
            console.log('  TRFs:', tribunaisLista.trfs.join(', '));
            console.log('  TJs: (27 tribunais estaduais)');
            console.log('  TRTs: (24 regiões)');
            console.log('');
            break;

          case 'codigos':
            const { CODIGOS } = await import('./modules/legislacao.js');
            log(CORES.cyan, '\nCódigos disponíveis:');
            for (const [sigla, info] of Object.entries(CODIGOS)) {
              console.log(`  ${CORES.green}${sigla}${CORES.reset} - ${info.nome}`);
            }
            console.log('');
            break;

          case 'pecas':
            const { listarEstruturasPecas } = await import('./modules/documentos.js');
            const pecas = listarEstruturasPecas();
            log(CORES.cyan, '\nTipos de peças jurídicas:');
            pecas.forEach(p => console.log(`  - ${p.nome}`));
            console.log('');
            break;

          case 'extrair':
            if (args.length > 0) {
              const caminho = args.join(' ');
              log(CORES.yellow, `\nExtraindo: ${caminho}...`);
              try {
                const { pipelineCompleto } = await import('./modules/extracao.js');
                const resultado = await pipelineCompleto(caminho);
                log(CORES.green, '\n✓ Extração concluída!');
                console.log(`  Pasta: ${resultado.pastaSaida}`);
                console.log(`  Chunks: ${resultado.estatisticas.chunksGerados}`);
                console.log(`  Redução: ${resultado.estatisticas.reducao}`);
              } catch (error) {
                log(CORES.red, `Erro: ${error.message}`);
              }
            } else {
              log(CORES.yellow, 'Uso: /extrair [caminho do PDF]');
            }
            break;

          default:
            log(CORES.red, `Comando desconhecido: /${comando}`);
            log(CORES.dim, 'Digite /ajuda para ver os comandos disponíveis.');
        }

        prompt();
        return;
      }

      // Processar mensagem com o agente
      log(CORES.dim, '\n⏳ Processando...\n');

      try {
        const resposta = await agent.processar(inputTrimmed);
        console.log(`\n${CORES.green}ROM:${CORES.reset}\n${resposta}\n`);
      } catch (error) {
        log(CORES.red, `\n❌ Erro: ${error.message}\n`);
      }

      prompt();
    });
  };

  prompt();
}

main().catch(console.error);
