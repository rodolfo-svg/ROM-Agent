# 🚀 Sistema de Deploy Automático - Setup Completo

Sistema de deploy programado implementado com sucesso!

## ✅ O Que Foi Implementado

### 1. Sistema de Scheduler (node-cron)
- ✅ Agendador de tarefas baseado em cron
- ✅ Deploy automático diário às 02h (horário de Brasília)
- ✅ Health check a cada hora
- ✅ Gerenciamento de jobs em tempo real

### 2. Job de Deploy Automático
- ✅ Verificação de janela de deploy (02h-05h)
- ✅ Detecção automática de mudanças (Git)
- ✅ Backup automático antes de cada deploy
- ✅ Commit, pull, install, test, push automatizado
- ✅ Histórico de deploys em JSON

### 3. Sistema de Logging
- ✅ Logs coloridos no console
- ✅ Persistência em arquivos diários
- ✅ Rotação automática (30 dias)
- ✅ Níveis: ERROR, WARN, INFO, DEBUG

### 4. API REST Completa
- ✅ Status do scheduler e jobs
- ✅ Status e histórico de deploys
- ✅ Execução manual de deploys
- ✅ Acesso a logs via API

### 5. Documentação
- ✅ Documentação completa em `/docs/DEPLOY-AUTOMATICO.md`
- ✅ Exemplos de uso e troubleshooting
- ✅ Scripts de monitoramento

## 📁 Estrutura de Arquivos Criados

```
ROM-Agent/
├── src/
│   ├── jobs/
│   │   ├── scheduler.js         # Sistema de agendamento
│   │   └── deploy-job.js        # Lógica de deploy
│   ├── utils/
│   │   └── logger.js            # Sistema de logging
│   └── server.js                # Servidor atualizado com APIs
├── docs/
│   └── DEPLOY-AUTOMATICO.md     # Documentação completa
├── test-deploy-system.js        # Script de testes
└── logs/
    ├── YYYY-MM-DD.log           # Logs diários (criados automaticamente)
    └── deploys/                 # Histórico de deploys (criado no primeiro deploy)
        └── deploy-history.json
```

## 🔧 Dependências Instaladas

```bash
npm install node-cron @types/node-cron
```

## 🚀 Como Usar

### Iniciar o Servidor

```bash
npm start
```

O scheduler será iniciado automaticamente e você verá:

```
Iniciando sistema de deploy automático...
Sistema de deploy automático configurado para 02h-05h (horário de Brasília)
```

### Testar o Sistema

```bash
node test-deploy-system.js
```

Resultado esperado:
```
✅ Logger funcionando
✅ Deploy job funcionando
✅ Scheduler funcionando
✅ Scheduler iniciado
✅ Jobs listados
✅ Verificação concluída
✅ Histórico acessível
✅ Scheduler parado
=== Todos os testes concluídos com sucesso! ===
```

### Verificar Status

```bash
# Status do scheduler
curl http://localhost:3000/api/scheduler/status

# Status do deploy
curl http://localhost:3000/api/deploy/status

# Histórico de deploys
curl http://localhost:3000/api/deploy/history?limit=5
```

### Deploy Manual

```bash
curl -X POST http://localhost:3000/api/deploy/execute
```

## 📊 APIs Disponíveis

### Scheduler
- `GET /api/scheduler/status` - Status do scheduler
- `GET /api/scheduler/jobs` - Lista jobs agendados
- `POST /api/scheduler/run/:jobName` - Executa job manualmente

### Deploy
- `GET /api/deploy/status` - Status do último deploy
- `GET /api/deploy/history?limit=10` - Histórico de deploys
- `POST /api/deploy/execute` - Executa deploy manual

### Logs
- `GET /api/logs?date=YYYY-MM-DD` - Logs de uma data
- `GET /api/logs/files` - Lista arquivos de log

## ⏰ Agendamento

### Deploy Automático
- **Horário**: 02h00 (horário de Brasília)
- **Frequência**: Diariamente
- **Timezone**: America/Sao_Paulo
- **Cron**: `0 2 * * *`

### Health Check
- **Horário**: A cada hora
- **Cron**: `0 * * * *`

## 🔒 Segurança e Confiabilidade

### Verificações Antes do Deploy
1. ✅ Verifica se está na janela de deploy (02h-05h)
2. ✅ Verifica se há mudanças para fazer deploy
3. ✅ Cria backup automático

### Processo de Deploy
1. Commit de mudanças locais
2. Pull do remote
3. Instalação de dependências
4. Execução de testes
5. Push para remote
6. Log do resultado

### Backups
- Criados automaticamente em `backups/YYYY-MM-DDTHH-mm-ss/`
- Inclui: package.json, package-lock.json, .env
- Mantidos permanentemente para rollback

### Logs
- Logs diários em `logs/YYYY-MM-DD.log`
- Histórico de deploys em `logs/deploys/deploy-history.json`
- Rotação automática após 30 dias

## 📈 Monitoramento

### Console
O servidor exibe logs coloridos em tempo real:
- 🔴 Erros críticos
- 🟡 Avisos
- 🔵 Informações
- ⚪ Debug

### Arquivos
- `logs/YYYY-MM-DD.log` - Logs diários
- `logs/deploys/deploy-history.json` - Histórico

### API
Use as rotas de API para monitoramento programático:

```javascript
// Exemplo de monitoramento
setInterval(async () => {
  const res = await fetch('http://localhost:3000/api/deploy/status');
  const status = await res.json();
  console.log('Deploy status:', status);
}, 60000); // A cada minuto
```

## 🔧 Configuração

### Alterar Horário de Deploy

Edite `src/jobs/scheduler.js`:

```javascript
// Linha ~23
this.scheduleJob('deploy-madrugada', '0 2 * * *', ...);
//                                    ^ Altere aqui
// Formato: segundos minutos horas dia mês dia-semana
```

### Alterar Janela de Deploy

Edite `src/jobs/deploy-job.js`:

```javascript
// Linha ~16
this.deployWindow = {
  start: 2,  // Hora de início
  end: 5     // Hora de fim
};
```

### Alterar Timezone

Edite `src/jobs/scheduler.js`:

```javascript
// Linha ~27
timezone: 'America/Sao_Paulo',  // Altere para seu timezone
```

Timezones disponíveis: https://en.wikipedia.org/wiki/List_of_tz_database_time_zones

## 🎯 Próximos Passos

### Recomendado
1. ✅ Testar deploy manual: `curl -X POST http://localhost:3000/api/deploy/execute`
2. ✅ Monitorar logs durante o primeiro deploy
3. ✅ Verificar backups em `backups/`
4. ✅ Configurar notificações (opcional)

### Melhorias Futuras
- [ ] Interface web para monitoramento
- [ ] Notificações via email/Slack
- [ ] Rollback automático em caso de falha
- [ ] Métricas de deploy (tempo, sucesso rate, etc.)
- [ ] Deploy condicional baseado em branches
- [ ] Integração com CI/CD

## 📚 Documentação Adicional

Consulte `/docs/DEPLOY-AUTOMATICO.md` para:
- Guia completo de uso
- Exemplos de integração
- Troubleshooting detalhado
- Scripts de monitoramento

## ✅ Testes Realizados

Todos os testes passaram com sucesso:

```
✅ Logger funcionando
✅ Deploy job funcionando
✅ Scheduler funcionando
✅ Scheduler iniciado
✅ Jobs agendados corretamente
✅ Verificação de janela de deploy funcionando
✅ Histórico acessível
✅ Graceful shutdown implementado
```

## 🎉 Sistema Pronto!

O sistema de deploy automático está completamente implementado e testado.

Para começar a usar:
```bash
npm start
```

O próximo deploy automático será executado às **02h00** do próximo dia (horário de Brasília).

---

**Implementado em**: 15/12/2025
**Versão**: ROM Agent v2.7.0
**Status**: ✅ Produção

Para suporte ou dúvidas, consulte `/docs/DEPLOY-AUTOMATICO.md`
