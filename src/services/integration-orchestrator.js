#!/usr/bin/env node

/**
 * Integration Orchestrator
 * Gerencia 8 agentes paralelos para integração completa de 86 ferramentas
 * Com streaming SSE em tempo real
 */

import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs/promises';
import { EventEmitter } from 'events';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class IntegrationOrchestrator extends EventEmitter {
  constructor(options = {}) {
    super();
    this.agents = options.agents || 'all';
    this.model = options.model || 'opus';
    this.parallel = options.parallel !== 'false';
    this.logsDir = options.logsDir || path.join(__dirname, '../../logs/integration');
    this.totalTasks = 106; // 86 ferramentas + 20 tarefas de infraestrutura
    this.completedTasks = 0;
    this.startTime = Date.now();
    this.agentProcesses = [];
    this.toolsStatus = [];
  }

  async execute() {
    console.log('🚀 Iniciando orquestração da integração...\n');

    // Criar diretório de logs
    await fs.mkdir(this.logsDir, { recursive: true });

    // Determinar quais agentes executar
    const agentsToRun = this.getAgentsToRun();
    console.log(`📋 Agentes a executar: ${agentsToRun.join(', ')}\n`);

    // Executar agentes
    if (this.parallel) {
      await this.executeParallel(agentsToRun);
    } else {
      await this.executeSequential(agentsToRun);
    }

    // Gerar relatório final
    await this.generateFinalReport();

    console.log('\n✅ Orquestração concluída!');
  }

  getAgentsToRun() {
    const allAgents = [
      'aws-bedrock',
      'google-search',
      'datajud',
      'projudi',
      'esaj',
      'pje',
      'eproc',
      'monitor'
    ];

    if (this.agents === 'all') {
      return allAgents;
    }

    return this.agents.split(',').map(a => a.trim());
  }

  async executeParallel(agents) {
    console.log('⚡ Executando agentes em PARALELO\n');

    const promises = agents.map(agentId => this.executeAgent(agentId));

    try {
      await Promise.all(promises);
      console.log('\n✅ Todos os agentes concluídos com sucesso!');
    } catch (error) {
      console.error('\n❌ Erro na execução paralela:', error.message);
      throw error;
    }
  }

  async executeSequential(agents) {
    console.log('🔄 Executando agentes SEQUENCIALMENTE\n');

    for (const agentId of agents) {
      await this.executeAgent(agentId);
    }

    console.log('\n✅ Todos os agentes concluídos com sucesso!');
  }

  async executeAgent(agentId) {
    console.log(`\n${'='.repeat(70)}`);
    console.log(`🤖 Iniciando Agente: ${agentId.toUpperCase()}`);
    console.log(`${'='.repeat(70)}\n`);

    const taskFile = path.join(__dirname, 'agents', `${agentId}-tasks.json`);

    // Verificar se arquivo de tarefas existe
    let tasks = [];
    try {
      const content = await fs.readFile(taskFile, 'utf-8');
      tasks = JSON.parse(content);
    } catch (error) {
      console.log(`⚠️  Arquivo de tarefas não encontrado para ${agentId}, usando tarefas padrão`);
      tasks = this.getDefaultTasks(agentId);
    }

    // Executar via Claude Code Task tool
    return new Promise((resolve, reject) => {
      const claudeProcess = spawn('claude', [
        'task',
        '--subagent-type', 'general-purpose',
        '--model', this.model,
        '--description', `Integração ${agentId}`,
        '--prompt', this.buildAgentPrompt(agentId, tasks)
      ], {
        cwd: path.join(__dirname, '../..'),
        stdio: ['pipe', 'pipe', 'pipe']
      });

      let output = '';
      let errorOutput = '';

      claudeProcess.stdout.on('data', (data) => {
        const chunk = data.toString();
        output += chunk;
        process.stdout.write(chunk);

        // Detectar progresso
        this.parseProgress(agentId, chunk);
      });

      claudeProcess.stderr.on('data', (data) => {
        errorOutput += data.toString();
        process.stderr.write(data);
      });

      claudeProcess.on('close', async (code) => {
        if (code === 0) {
          console.log(`\n✅ Agente ${agentId} concluído com sucesso`);

          // Salvar output
          await fs.writeFile(
            path.join(this.logsDir, `agent-${agentId}.log`),
            output
          );

          resolve({ agentId, success: true, output });
        } else {
          console.error(`\n❌ Agente ${agentId} falhou com código ${code}`);
          reject(new Error(`Agent ${agentId} failed with code ${code}`));
        }
      });

      this.agentProcesses.push(claudeProcess);
    });
  }

  buildAgentPrompt(agentId, tasks) {
    const prompts = {
      'aws-bedrock': `
# AGENTE 1: AWS Bedrock Configuration

Configure TODAS as 17 funções do AWS Bedrock para ficarem operacionais.

## Tarefas (17):
${tasks.map((t, i) => `${i + 1}. ${t}`).join('\n')}

## Arquivos a modificar:
- src/modules/bedrock.js
- src/modules/bedrockAvancado.js
- lib/bedrock-queue-manager.js

## Validação:
- Testar cada modelo individualmente
- Validar embeddings
- Testar geração de texto, imagens, áudio, vídeo
- Criar testes unitários

## Output esperado:
✅ 17 funções operacionais
✅ Testes passando
✅ Documentação atualizada
      `.trim(),

      'google-search': `
# AGENTE 2: Google Custom Search Configuration

Configure a Google Custom Search API para jurisprudência e doutrina.

## Tarefas (8):
${tasks.map((t, i) => `${i + 1}. ${t}`).join('\n')}

## Arquivos a modificar:
- lib/google-search-client.js
- src/services/jurisprudence-search-service.js

## Variáveis necessárias:
- GOOGLE_SEARCH_API_KEY
- GOOGLE_SEARCH_CX

## Validação:
- Testar busca de jurisprudência
- Testar busca de doutrina
- Validar resultados

## Output esperado:
✅ Google Search operacional
✅ Testes passando
      `.trim(),

      'datajud': `
# AGENTE 3: DataJud CNJ Configuration

Configure DataJud CNJ e sistema de certidões.

## Tarefas (12):
${tasks.map((t, i) => `${i + 1}. ${t}`).join('\n')}

## Arquivos a modificar:
- python-scrapers/datajud_cnj.py
- python-scrapers/cnj_certidoes_api.py
- src/services/datajud-service.js

## Variáveis necessárias:
- DATAJUD_API_KEY
- CNJ_USUARIO
- CNJ_SENHA

## Validação:
- Testar busca de processos
- Testar emissão de certidão
- Testar validação de certidão

## Output esperado:
✅ DataJud operacional
✅ Certidões funcionando
✅ Cache implementado
      `.trim(),

      'projudi': `
# AGENTE 4: PROJUDI Scraper

Implemente scraper completo do PROJUDI (TJGO).

## Tarefas (15):
${tasks.map((t, i) => `${i + 1}. ${t}`).join('\n')}

## Criar novo arquivo:
- python-scrapers/projudi_scraper.py

## Funcionalidades:
- Login automatizado
- Busca de processos
- Extração de metadados
- Download de documentos
- Detecção de status (ativo/arquivado)
- Superação de CAPTCHA (se houver)

## Validação:
- Testar com processo real
- Validar todos os campos extraídos

## Output esperado:
✅ Scraper PROJUDI operacional
✅ Testes passando
✅ Documentação completa
      `.trim(),

      'esaj': `
# AGENTE 5: ESAJ Scraper

Implemente scraper completo do ESAJ (TJSP).

## Tarefas (15):
${tasks.map((t, i) => `${i + 1}. ${t}`).join('\n')}

## Criar novo arquivo:
- python-scrapers/esaj_scraper.py

## Funcionalidades:
- Busca por número de processo
- Busca por CPF/CNPJ
- Extração 1º e 2º grau
- Download de documentos
- Andamentos processuais
- Detecção de segredo de justiça
- Superação de CAPTCHA

## Validação:
- Testar com processo real do TJSP

## Output esperado:
✅ Scraper ESAJ operacional
✅ Suporte 1º e 2º grau
✅ Testes passando
      `.trim(),

      'pje': `
# AGENTE 6: PJe Scraper

Implemente scraper do PJe (Justiça Federal).

## Tarefas (15):
${tasks.map((t, i) => `${i + 1}. ${t}`).join('\n')}

## Criar novo arquivo:
- python-scrapers/pje_scraper.py

## Funcionalidades:
- Login com certificado digital
- Busca unificada
- Extração por tribunal
- Download de autos digitais
- Timeline processual
- Detecção de intimações
- Suporte TRF1-5

## Validação:
- Testar em múltiplos TRFs

## Output esperado:
✅ Scraper PJe operacional
✅ Suporte a múltiplos tribunais
✅ Testes passando
      `.trim(),

      'eproc': `
# AGENTE 7: ePROC Scraper

Implemente scraper do ePROC (TRFs antigos).

## Tarefas (12):
${tasks.map((t, i) => `${i + 1}. ${t}`).join('\n')}

## Criar novo arquivo:
- python-scrapers/eproc_scraper.py

## Funcionalidades:
- Busca de processos
- Extração de dados
- Download de documentos
- Detecção de status

## Validação:
- Testar com processo real

## Output esperado:
✅ Scraper ePROC operacional
✅ Testes passando
      `.trim(),

      'monitor': `
# AGENTE 8: Monitor & Progress Tracker

Implemente sistema de monitoramento em tempo real.

## Tarefas (12):
${tasks.map((t, i) => `${i + 1}. ${t}`).join('\n')}

## Criar novos arquivos:
- src/services/progress-sse-server.js
- frontend/src/components/IntegrationDashboard.tsx
- frontend/src/pages/IntegrationPage.tsx

## Funcionalidades:
- Servidor SSE
- Progress tracking
- Dashboard com gráficos
- Notificações real-time
- Health check de agentes
- Métricas de performance

## Validação:
- Testar streaming SSE
- Validar dashboard

## Output esperado:
✅ Sistema de monitoramento operacional
✅ Dashboard funcional
✅ SSE funcionando
      `.trim()
    };

    return prompts[agentId] || `Execute tarefas do agente ${agentId}`;
  }

  getDefaultTasks(agentId) {
    const defaultTasks = {
      'aws-bedrock': [
        'Validar credenciais AWS',
        'Testar conexão Bedrock',
        'Configurar Claude Opus 4.5',
        'Configurar Claude Sonnet 4.5',
        'Configurar Claude Haiku 4.5',
        'Configurar Titan Text',
        'Configurar Titan Embeddings',
        'Testar embeddings',
        'Testar geração de texto',
        'Testar análise de imagens',
        'Testar conversão de áudio',
        'Testar processamento de vídeo',
        'Configurar rate limits',
        'Criar health checks',
        'Implementar fallbacks',
        'Adicionar retry logic',
        'Criar testes unitários'
      ],
      'google-search': [
        'Criar projeto Google Cloud',
        'Ativar Custom Search API',
        'Gerar API Key',
        'Criar Search Engine (CX)',
        'Adicionar ao .env',
        'Testar busca jurisprudência',
        'Testar busca doutrina',
        'Validar resultados'
      ],
      'datajud': [
        'Obter API Key DataJud',
        'Configurar autenticação',
        'Implementar /processos/buscar',
        'Implementar /processos/{id}',
        'Implementar /certidoes/emitir',
        'Implementar /certidoes/validar',
        'Configurar CNJ credenciais',
        'Testar emissão certidão',
        'Testar validação certidão',
        'Implementar cache',
        'Adicionar rate limiting',
        'Documentar endpoints'
      ],
      'projudi': [
        'Analisar estrutura PROJUDI',
        'Implementar login',
        'Implementar busca',
        'Implementar extração metadados',
        'Implementar download documentos',
        'Implementar CAPTCHA',
        'Detecção ativo/arquivado',
        'Implementar retry',
        'Adicionar logs',
        'Criar testes unitários',
        'Criar testes integração',
        'Implementar cache sessão',
        'Adicionar proxy rotation',
        'Documentar API',
        'Validar produção'
      ],
      'esaj': [
        'Analisar estrutura ESAJ',
        'Implementar busca número',
        'Implementar busca CPF/CNPJ',
        'Extração 1º grau',
        'Extração 2º grau',
        'Download documentos',
        'Andamentos processuais',
        'Detecção segredo justiça',
        'Superação CAPTCHA',
        'Rate limiting',
        'Criar testes',
        'Implementar cache',
        'Adicionar logs',
        'Documentar',
        'Validar'
      ],
      'pje': [
        'Analisar portais PJe',
        'Login certificado digital',
        'Busca unificada',
        'Extração por tribunal',
        'Download autos digitais',
        'Timeline processual',
        'Detecção intimações',
        'Suporte múltiplos tribunais',
        'Retry logic',
        'Criar testes',
        'Adicionar logs',
        'Implementar cache',
        'Documentar API',
        'Validar TRF1-5',
        'Produção'
      ],
      'eproc': [
        'Analisar estrutura ePROC',
        'Implementar busca',
        'Implementar extração',
        'Download documentos',
        'Detecção status',
        'Implementar retry',
        'Criar testes',
        'Adicionar logs',
        'Documentar',
        'Validar TRFs',
        'Cache',
        'Produção'
      ],
      'monitor': [
        'Criar servidor SSE',
        'Progress tracking',
        'Dashboard frontend',
        'Gráficos Chart.js',
        'Notificações real-time',
        'Logs agregados',
        'Health check agentes',
        'Restart automático',
        'Métricas performance',
        'Relatório final',
        'Documentar sistema',
        'Deploy dashboard'
      ]
    };

    return defaultTasks[agentId] || [];
  }

  parseProgress(agentId, output) {
    // Detectar conclusão de tarefas no output
    const taskCompletedPattern = /✅|completed|done|success/i;

    if (taskCompletedPattern.test(output)) {
      this.completedTasks++;
      const percentage = (this.completedTasks / this.totalTasks) * 100;

      // Emitir evento de progresso
      this.emit('progress', {
        agentId,
        completedTasks: this.completedTasks,
        totalTasks: this.totalTasks,
        percentage: percentage.toFixed(1),
        timestamp: Date.now()
      });
    }
  }

  async generateFinalReport() {
    const endTime = Date.now();
    const duration = ((endTime - this.startTime) / 1000 / 60).toFixed(1); // minutos

    const report = `
# RELATÓRIO FINAL DE INTEGRAÇÃO
## Data: ${new Date().toISOString()}

---

## Estatísticas

- **Tarefas Concluídas**: ${this.completedTasks}/${this.totalTasks}
- **Percentual**: ${((this.completedTasks / this.totalTasks) * 100).toFixed(1)}%
- **Tempo Total**: ${duration} minutos
- **Modelo Utilizado**: ${this.model}
- **Execução**: ${this.parallel ? 'Paralela' : 'Sequential'}

## Agentes Executados

${this.agentProcesses.map((p, i) => `- Agente ${i + 1}: Concluído`).join('\n')}

## Status das Ferramentas

Total de ferramentas: 86
- ✅ Operacionais: ${this.completedTasks}
- 🔧 Em configuração: 0
- ❌ Com problemas: ${86 - this.completedTasks}

## Próximos Passos

1. Validar todas as 86 ferramentas individualmente
2. Executar testes de integração
3. Deploy em produção
4. Monitorar métricas

---

**Relatório gerado automaticamente pelo Integration Orchestrator**
    `.trim();

    const reportPath = path.join(this.logsDir, 'RELATORIO_FINAL.md');
    await fs.writeFile(reportPath, report);

    console.log(`\n📄 Relatório final salvo em: ${reportPath}`);

    // Salvar status JSON
    const statusData = {
      completedTasks: this.completedTasks,
      totalTasks: this.totalTasks,
      percentage: ((this.completedTasks / this.totalTasks) * 100).toFixed(1),
      duration,
      model: this.model,
      parallel: this.parallel,
      timestamp: new Date().toISOString(),
      tools: this.toolsStatus
    };

    await fs.writeFile(
      path.join(this.logsDir, 'tools-status.json'),
      JSON.stringify(statusData, null, 2)
    );
  }

  killAllAgents() {
    console.log('\n⚠️  Terminando todos os agentes...');
    this.agentProcesses.forEach(p => p.kill());
  }
}

// CLI Execution
const isMainModule = import.meta.url === `file://${process.argv[1]}`;
if (isMainModule) {
  const args = process.argv.slice(2);
  const options = {};

  args.forEach(arg => {
    if (arg.startsWith('--')) {
      const [key, value] = arg.substring(2).split('=');
      options[key] = value;
    }
  });

  const orchestrator = new IntegrationOrchestrator(options);

  // Graceful shutdown
  process.on('SIGINT', () => {
    console.log('\n\n⚠️  Interrompido pelo usuário');
    orchestrator.killAllAgents();
    process.exit(1);
  });

  orchestrator.execute()
    .then(() => {
      console.log('\n✅ Orquestração concluída com sucesso!');
      process.exit(0);
    })
    .catch(error => {
      console.error('\n❌ Erro na orquestração:', error);
      orchestrator.killAllAgents();
      process.exit(1);
    });
}

export default IntegrationOrchestrator;
