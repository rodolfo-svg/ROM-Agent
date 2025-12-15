# Sistema de Deploy Automático ROM Agent

Sistema de deploy programado com agendamento automático entre 02h-05h da manhã (horário de Brasília).

## 📋 Índice

- [Visão Geral](#visão-geral)
- [Funcionalidades](#funcionalidades)
- [Arquitetura](#arquitetura)
- [Configuração](#configuração)
- [API Endpoints](#api-endpoints)
- [Uso](#uso)
- [Monitoramento](#monitoramento)
- [Troubleshooting](#troubleshooting)

## 🎯 Visão Geral

O sistema de deploy automático foi desenvolvido para realizar deploys de forma segura e automatizada durante a madrugada, minimizando o impacto aos usuários. O sistema:

- ✅ Executa deploys automaticamente às 02h (horário de Brasília)
- ✅ Verifica se há mudanças antes de fazer deploy
- ✅ Cria backups automáticos antes de cada deploy
- ✅ Mantém logs detalhados de todas as operações
- ✅ Permite execução manual via API
- ✅ Fornece status em tempo real

## 🚀 Funcionalidades

### Deploy Automático

- **Janela de Deploy**: 02h-05h (horário de Brasília)
- **Frequência**: Diária, às 02h
- **Verificação Inteligente**: Só faz deploy se houver mudanças
- **Backup Automático**: Cria backup antes de cada deploy
- **Rollback**: Backups disponíveis em `backups/`

### Sistema de Logs

- Logs coloridos no console
- Persistência em arquivos diários
- Rotação automática (mantém 30 dias)
- Níveis: ERROR, WARN, INFO, DEBUG

### Monitoramento

- Status do scheduler em tempo real
- Histórico de deploys
- Logs acessíveis via API
- Health checks periódicos

## 🏗️ Arquitetura

```
src/
├── jobs/
│   ├── scheduler.js      # Gerenciador de jobs com node-cron
│   └── deploy-job.js     # Lógica de deploy automático
├── utils/
│   └── logger.js         # Sistema de logging
└── server.js             # Servidor principal com rotas de API

logs/
├── YYYY-MM-DD.log        # Logs diários
└── deploys/
    └── deploy-history.json  # Histórico de deploys

backups/
└── YYYY-MM-DDTHH-mm-ss/  # Backups automáticos
    ├── package.json
    ├── package-lock.json
    └── .env
```

## ⚙️ Configuração

### Instalação

As dependências já foram instaladas:

```bash
npm install node-cron @types/node-cron
```

### Inicialização

O sistema é iniciado automaticamente quando o servidor é iniciado:

```bash
npm start
```

### Variáveis de Ambiente

Nenhuma configuração adicional é necessária. O sistema usa as configurações do Git existentes.

### Customização

Para alterar a janela de deploy, edite `src/jobs/deploy-job.js`:

```javascript
this.deployWindow = {
  start: 2, // Hora de início (02h)
  end: 5    // Hora de fim (05h)
};
```

Para alterar o agendamento, edite `src/jobs/scheduler.js`:

```javascript
// Formato: segundos minutos horas dia mês dia-da-semana
this.scheduleJob('deploy-madrugada', '0 2 * * *', ...);
```

## 🔌 API Endpoints

### Scheduler

#### GET `/api/scheduler/status`
Retorna o status do scheduler

**Resposta:**
```json
{
  "isRunning": true,
  "totalJobs": 2,
  "jobs": [
    {
      "name": "deploy-madrugada",
      "cron": "0 2 * * *",
      "description": "Deploy automático de madrugada (02h-05h)",
      "timezone": "America/Sao_Paulo",
      "createdAt": "2025-12-15T10:30:00.000Z"
    }
  ]
}
```

#### GET `/api/scheduler/jobs`
Lista todos os jobs agendados

#### POST `/api/scheduler/run/:jobName`
Executa um job manualmente

**Exemplo:**
```bash
curl -X POST http://localhost:3000/api/scheduler/run/deploy-madrugada
```

### Deploy

#### GET `/api/deploy/status`
Retorna o status do deploy

**Resposta:**
```json
{
  "isRunning": false,
  "lastExecution": "2025-12-15T02:00:00.000Z",
  "lastResult": {
    "status": "success",
    "timestamp": "2025-12-15T02:05:30.000Z",
    "backupPath": "/path/to/backup"
  },
  "deployWindow": {
    "start": 2,
    "end": 5
  },
  "isInDeployWindow": false
}
```

#### GET `/api/deploy/history?limit=10`
Retorna o histórico de deploys

**Resposta:**
```json
{
  "history": [
    {
      "timestamp": "2025-12-15T02:00:00.000Z",
      "status": "success",
      "message": "Deploy automático concluído com sucesso"
    },
    {
      "timestamp": "2025-12-14T02:00:00.000Z",
      "status": "skipped",
      "reason": "no_changes"
    }
  ]
}
```

#### POST `/api/deploy/execute`
Executa um deploy manual (não respeita a janela de horário)

**Resposta:**
```json
{
  "success": true,
  "message": "Deploy iniciado em background. Use /api/deploy/status para acompanhar."
}
```

### Logs

#### GET `/api/logs?date=YYYY-MM-DD`
Retorna os logs de uma data específica (hoje se não especificado)

#### GET `/api/logs/files`
Lista todos os arquivos de log disponíveis

## 📖 Uso

### Deploy Automático

O deploy automático é executado diariamente às 02h. O sistema:

1. Verifica se está na janela de deploy (02h-05h)
2. Verifica se há mudanças para fazer deploy
3. Cria um backup dos arquivos principais
4. Commita mudanças locais (se houver)
5. Sincroniza com o remote
6. Instala dependências
7. Executa testes (se existirem)
8. Faz push para o remote
9. Salva log do deploy

### Deploy Manual

Para executar um deploy manual:

```bash
curl -X POST http://localhost:3000/api/deploy/execute
```

Ou via interface web (a ser implementada):

```javascript
fetch('/api/deploy/execute', { method: 'POST' })
  .then(res => res.json())
  .then(data => console.log(data));
```

### Verificar Status

```bash
# Status do scheduler
curl http://localhost:3000/api/scheduler/status

# Status do último deploy
curl http://localhost:3000/api/deploy/status

# Histórico de deploys
curl http://localhost:3000/api/deploy/history?limit=5
```

### Ver Logs

```bash
# Logs de hoje
curl http://localhost:3000/api/logs

# Logs de uma data específica
curl http://localhost:3000/api/logs?date=2025-12-15

# Listar todos os arquivos de log
curl http://localhost:3000/api/logs/files
```

## 📊 Monitoramento

### Health Check

O scheduler executa um health check a cada hora para garantir que está funcionando:

```
[INFO] Scheduler health check - Todos os jobs ativos
```

### Logs em Tempo Real

Os logs são exibidos no console com cores:

- 🔴 **ERROR**: Erros críticos
- 🟡 **WARN**: Avisos
- 🔵 **INFO**: Informações gerais
- ⚪ **DEBUG**: Debug detalhado

### Arquivos de Log

Os logs são salvos em:
- `logs/YYYY-MM-DD.log`: Logs diários
- `logs/deploys/deploy-history.json`: Histórico de deploys

### Backups

Backups são criados em:
- `backups/YYYY-MM-DDTHH-mm-ss/`: Um backup por deploy

## 🔧 Troubleshooting

### Deploy Não Está Executando

1. Verifique se o servidor está rodando:
   ```bash
   curl http://localhost:3000/api/scheduler/status
   ```

2. Verifique os logs:
   ```bash
   curl http://localhost:3000/api/logs
   ```

3. Verifique se está na janela de deploy:
   ```bash
   curl http://localhost:3000/api/deploy/status
   ```

### Deploy Falhou

1. Verifique o último resultado:
   ```bash
   curl http://localhost:3000/api/deploy/status
   ```

2. Verifique o histórico:
   ```bash
   curl http://localhost:3000/api/deploy/history
   ```

3. Verifique os logs detalhados em `logs/deploys/deploy-history.json`

4. Se necessário, restaure o backup:
   ```bash
   cp -r backups/YYYY-MM-DDTHH-mm-ss/* .
   ```

### Scheduler Não Está Rodando

1. Reinicie o servidor:
   ```bash
   npm restart
   ```

2. Verifique se há erros no console

3. Verifique os logs em `logs/`

### Forçar Deploy Fora da Janela

Para executar um deploy fora da janela de 02h-05h:

```bash
curl -X POST http://localhost:3000/api/deploy/execute
```

### Desabilitar Deploy Automático

Para desabilitar temporariamente:

1. Edite `src/server.js` e comente a linha:
   ```javascript
   // scheduler.start();
   ```

2. Reinicie o servidor

## 📝 Exemplos de Uso

### Script para Monitoramento

```bash
#!/bin/bash
# monitor-deploy.sh

echo "=== Status do Scheduler ==="
curl -s http://localhost:3000/api/scheduler/status | jq

echo ""
echo "=== Status do Deploy ==="
curl -s http://localhost:3000/api/deploy/status | jq

echo ""
echo "=== Últimos 5 Deploys ==="
curl -s http://localhost:3000/api/deploy/history?limit=5 | jq
```

### Script para Deploy Manual

```bash
#!/bin/bash
# manual-deploy.sh

echo "Iniciando deploy manual..."
curl -X POST http://localhost:3000/api/deploy/execute | jq

echo ""
echo "Aguardando 5 segundos..."
sleep 5

echo ""
echo "Status atual:"
curl -s http://localhost:3000/api/deploy/status | jq
```

### Integração com Monitoring

```javascript
// monitoring.js
const CHECK_INTERVAL = 60000; // 1 minuto

async function checkDeployHealth() {
  const response = await fetch('http://localhost:3000/api/deploy/status');
  const status = await response.json();

  if (status.lastResult?.status === 'failed') {
    console.error('⚠️ ALERTA: Último deploy falhou!');
    // Enviar notificação (email, Slack, etc.)
  }

  if (status.isRunning) {
    console.log('🔄 Deploy em andamento...');
  }
}

setInterval(checkDeployHealth, CHECK_INTERVAL);
```

## 🔐 Segurança

- ✅ Backups automáticos antes de cada deploy
- ✅ Logs detalhados de todas as operações
- ✅ Verificação de mudanças antes de fazer deploy
- ✅ Graceful shutdown para evitar perda de dados
- ✅ Rotação automática de logs
- ✅ Deploy apenas em horário de baixo tráfego

## 🎨 Próximas Melhorias

- [ ] Interface web para monitoramento
- [ ] Notificações via email/Slack
- [ ] Rollback automático em caso de falha
- [ ] Testes automatizados antes do deploy
- [ ] Deploy condicional baseado em métricas
- [ ] Integração com CI/CD
- [ ] Deploy em múltiplos ambientes

## 📞 Suporte

Para problemas ou dúvidas:

1. Verifique os logs em `logs/`
2. Verifique o status via API
3. Consulte esta documentação
4. Entre em contato com a equipe de desenvolvimento

---

**ROM Agent v2.7.0** - Sistema de Deploy Automático
© 2025 Rodolfo Otávio Mota Advogados Associados
