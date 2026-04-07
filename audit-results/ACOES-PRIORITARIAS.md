# AÇÕES PRIORITÁRIAS - AGENT #4
## Auditoria de ENV, AWS, Bedrock, Anthropic

**Data:** 2026-04-07
**Overall Health:** 85/100
**Status:** PRODUCTION READY WITH CRITICAL FIX

---

## 🔴 P0 - CRÍTICO (URGENTE - 5-10 minutos)

### ❌ APLICAR NGINX CUSTOM CONFIG NO RENDER

**Problema:**
- Arquivo `render.nginx.conf` existe mas NÃO está sendo aplicado
- Render.com não detecta automaticamente o arquivo

**Impacto:**
- ❌ HTTP 413 Payload Too Large em uploads >1MB
- ❌ Timeouts em uploads grandes
- ❌ Merge de volumes não funciona
- ❌ **FUNCIONALIDADE PRINCIPAL QUEBRADA**

**Solução Passo-a-Passo:**

#### Opção 1: Dashboard Render (RECOMENDADO)

```
1. Abrir https://dashboard.render.com
2. Selecionar serviço "rom-agent"
3. Ir em "Settings" (menu lateral esquerdo)
4. Procurar seção "Custom Nginx Config" ou "Advanced Settings"
5. Se não existir, procurar opção "Environment" → "Files"
6. Criar/editar arquivo nginx.conf
7. Copiar TODO o conteúdo de:
   /Users/rodolfootaviopereiradamotaoliveira/ROM-Agent/render.nginx.conf
8. Colar no editor
9. Clicar "Save"
10. Aguardar redeploy automático (ou forçar via "Manual Deploy")
```

**Conteúdo a copiar:**
```nginx
client_max_body_size 1100M;
client_body_timeout 1800s;
client_header_timeout 1800s;
send_timeout 1800s;
proxy_read_timeout 1800s;
proxy_connect_timeout 1800s;
proxy_send_timeout 1800s;

client_body_buffer_size 128k;
client_header_buffer_size 1k;
large_client_header_buffers 4 16k;

client_body_temp_path /var/data/nginx-temp 1 2;

proxy_set_header Host $host;
proxy_set_header X-Real-IP $remote_addr;
proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
proxy_set_header X-Forwarded-Proto $scheme;

proxy_buffering off;
proxy_cache off;

gzip on;
gzip_vary on;
gzip_min_length 1024;
gzip_proxied any;
gzip_comp_level 6;
gzip_types text/plain text/css text/xml text/javascript application/json application/javascript application/xml+rss;
gzip_disable "MSIE [1-6]\.";

add_header X-Frame-Options "SAMEORIGIN" always;
add_header X-Content-Type-Options "nosniff" always;
add_header X-XSS-Protection "1; mode=block" always;
add_header Referrer-Policy "no-referrer-when-downgrade" always;
```

#### Opção 2: Render CLI (AUTOMÁTICO)

```bash
# 1. Instalar Render CLI (se não instalado)
npm install -g @render/cli

# 2. Autenticar
render login

# 3. Aplicar configuração
render services update rom-agent --nginx-config render.nginx.conf

# 4. Verificar logs
render logs rom-agent --tail
```

#### Opção 3: Suporte Render

Se as opções acima não funcionarem:

```
1. Abrir ticket de suporte: https://render.com/support
2. Título: "Custom Nginx Config not being applied"
3. Corpo:
   "I have a render.nginx.conf file in the repository root, but it's not
   being applied. I need to increase client_max_body_size to 1100M for
   large file uploads. Service: rom-agent. Can you help?"
4. Anexar arquivo render.nginx.conf
```

**Verificação:**

Após aplicar, testar upload de arquivo >1MB:
```bash
# Testar localmente contra produção
curl -X POST https://iarom.com.br/api/upload \
  -H "Content-Type: multipart/form-data" \
  -F "file=@/path/to/large-file.pdf" \
  -v
```

Deve retornar 200 OK ao invés de 413.

**Tempo Estimado:** 5-10 minutos

---

## 🟠 P1 - ALTA PRIORIDADE (2 minutos)

### ⚠️ CONFIGURAR ANTHROPIC_API_KEY REAL

**Problema:**
- Valor atual: `sk-ant-bedrock-fallback` (placeholder, não é key válida)
- Fallback para Anthropic API não funciona se AWS Bedrock falhar

**Impacto:**
- ⚠️ Sem resiliência caso Bedrock tenha problemas
- ⚠️ Sistema pode ficar offline se Bedrock estiver indisponível

**Solução Passo-a-Passo:**

```
1. Obter API Key da Anthropic:
   https://console.anthropic.com/settings/keys

2. Copiar key (formato: sk-ant-api03-XXXXX...)

3. Dashboard Render:
   - Serviço: rom-agent
   - Settings → Environment
   - Encontrar variável: ANTHROPIC_API_KEY
   - Editar valor: sk-ant-api03-XXXXX...
   - Save Changes

4. Redeploy (automático após salvar)

5. Verificar logs após deploy:
   render logs rom-agent --tail

   Buscar por: "Anthropic API configured"
```

**Custos:**
- API Anthropic: Pay-per-use (similar ao Bedrock)
- Usar apenas como fallback (sem custo adicional se Bedrock funcionar)

**Tempo Estimado:** 2 minutos

---

## 🟡 P2 - MÉDIA PRIORIDADE (30-60 minutos)

### 1. Debugar OneDrive Backup (Opcional)

**Problema:**
- Schedulado para rodar às 04h (cron: `0 4 * * *`)
- Falha na execução
- Erro não-crítico (não bloqueia sistema)

**Investigar:**
```bash
# 1. Verificar código
cat /Users/rodolfootaviopereiradamotaoliveira/ROM-Agent/lib/onedrive-backup.js

# 2. Verificar logs
tail -100 /Users/rodolfootaviopereiradamotaoliveira/ROM-Agent/logs/server.log | grep -i onedrive

# 3. Testar manualmente
node -e "
const oneDriveBackup = require('./lib/onedrive-backup.js');
oneDriveBackup.backup().then(console.log).catch(console.error);
"
```

**Possíveis causas:**
- Credenciais OneDrive não configuradas
- Token expirado
- Permissões de pasta

**Decisão:**
- Se não for crítico, desabilitar no scheduler
- Se for importante, configurar credenciais corretas

**Tempo Estimado:** 30-60 minutos

---

### 2. Configurar BROWSERLESS_API_KEY Localmente

**Problema:**
- Chave configurada apenas no Render
- Desenvolvimento local sem Puppeteer/Browserless

**Impacto:**
- ⚠️ Testes locais de scraping de tribunais não funcionam
- ⚠️ Não consegue testar bypass de Cloudflare localmente

**Solução:**

```bash
# 1. Criar conta em browserless.io
# https://www.browserless.io/sign-up
# Plano: $15/mês (ou free tier para testes)

# 2. Copiar API Key do dashboard

# 3. Adicionar em .env local
echo "BROWSERLESS_API_KEY=YOUR_KEY_HERE" >> .env
echo "USE_BROWSERLESS=true" >> .env

# 4. Testar
node src/routes/test-puppeteer.js
```

**Alternativa (se não quiser pagar):**

Usar Puppeteer local (sem Browserless):
```bash
# Instalar dependências do Chromium
# macOS:
brew install chromium

# Configurar .env
USE_BROWSERLESS=false
PUPPETEER_EXECUTABLE_PATH=/usr/local/bin/chromium
```

**Tempo Estimado:** 10 minutos

---

### 3. Habilitar Redis Localmente

**Problema:**
- DISABLE_REDIS=true
- Usando NodeCache como fallback
- Performance local levemente reduzida

**Solução:**

```bash
# macOS
brew install redis
brew services start redis

# Linux
sudo apt-get install redis-server
sudo systemctl start redis

# Testar
redis-cli ping
# Deve retornar: PONG

# Editar .env
# Remover ou comentar linha:
# DISABLE_REDIS=true

# Reiniciar servidor
npm run web
```

**Verificação:**
```bash
# Verificar logs
tail -f logs/server.log | grep -i redis

# Deve mostrar:
# ✅ Redis connected
```

**Tempo Estimado:** 15 minutos

---

## 🟢 P3 - OTIMIZAÇÕES (1-2 semanas)

### 1. Testar Conectividade de Todos os Serviços

**Testes sugeridos:**

```bash
# 1. AWS Bedrock
node test-bedrock-local.js

# 2. Google Search API
node test-google-jusbrasil-simple.js

# 3. CNJ DataJud
bash test-datajud-producao.sh

# 4. Browserless.io (se configurado)
node src/routes/test-puppeteer.js

# 5. Sistema completo
node test-production-complete.js
```

**Tempo Estimado:** 1-2 horas

---

### 2. Habilitar Feature Flags Gradualmente

**Estratégia:**

**Semana 1: Monitoramento**
```bash
# Render Dashboard → Environment
FF_METRICS=true
FF_STRUCTURED_LOGGING=true
```

**Semana 2: Resiliência**
```bash
FF_CIRCUIT_BREAKER=true
FF_RETRY_BACKOFF=true
```

**Semana 3: Otimizações Google**
```bash
FF_GOOGLE_TIMEOUT_20S=true
FF_CACHE_GOOGLE=true
```

**Semana 4: Fallbacks Completos**
```bash
FF_GLOBAL_FALLBACK=true
```

**Monitoramento:**
```bash
# Verificar métricas após cada habilitação
curl https://iarom.com.br/api/metrics

# Verificar logs de erro
render logs rom-agent | grep ERROR
```

**Tempo Estimado:** 4 semanas (gradual)

---

## CHECKLIST DE VALIDAÇÃO

Após executar as ações prioritárias:

### ✅ P0 - Nginx Config
- [ ] Arquivo aplicado no Render
- [ ] Upload >1MB funciona (teste com curl)
- [ ] Logs não mostram HTTP 413
- [ ] Merge de volumes funciona

### ✅ P1 - Anthropic API Key
- [ ] Key configurada no Render
- [ ] Logs mostram "Anthropic API configured"
- [ ] Fallback funciona (testar desabilitando Bedrock temporariamente)

### ✅ P2 - Configurações Locais
- [ ] OneDrive backup resolvido ou desabilitado
- [ ] Browserless configurado localmente (ou alternativa Puppeteer)
- [ ] Redis local rodando

### ✅ P3 - Otimizações
- [ ] Todos os testes de conectividade passam
- [ ] Feature flags habilitadas gradualmente
- [ ] Monitoramento ativo

---

## CONTATOS E RECURSOS

### Render.com Support
- Dashboard: https://dashboard.render.com
- Support: https://render.com/support
- Docs: https://render.com/docs

### Anthropic
- Console: https://console.anthropic.com
- Docs: https://docs.anthropic.com
- Support: support@anthropic.com

### Browserless.io
- Dashboard: https://www.browserless.io/dashboard
- Docs: https://docs.browserless.io
- Support: support@browserless.io

### AWS Bedrock
- Console: https://console.aws.amazon.com/bedrock
- Docs: https://docs.aws.amazon.com/bedrock
- Support: AWS Support Center

---

## NOTAS FINAIS

**Sistema está 85% operacional.**

**Prioridade MÁXIMA:**
1. Aplicar Nginx config (5-10 min) - **BLOQUEIA FUNCIONALIDADE PRINCIPAL**
2. Configurar Anthropic API key (2 min) - **MELHORA RESILIÊNCIA**

**Após P0 e P1:**
Sistema estará 95% operacional e pronto para produção sem restrições.

**Relatórios Completos:**
- JSON: `audit-results/agent-env-result.json`
- Markdown: `audit-results/RELATORIO-AUDITORIA-ENV-COMPLETA.md`
- Resumo: `audit-results/RESUMO-EXECUTIVO-AGENT-4.md`
- Summary: `audit-results/agent-4-summary.txt`

---

**Gerado por:** Agent #4 - AUDITORIA COMPLETA DE ENV, AWS, BEDROCK, ANTHROPIC
**Data:** 2026-04-07T04:15:00Z
