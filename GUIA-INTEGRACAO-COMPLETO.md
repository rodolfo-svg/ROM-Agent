# 🔗 GUIA DE INTEGRAÇÃO COMPLETO - ROM AGENT

**Versão**: 2.3.0
**Data**: 13 de dezembro de 2024
**Status**: Produção

---

## 📋 ÍNDICE

1. [Visão Geral](#visão-geral)
2. [AWS Bedrock](#aws-bedrock)
3. [GitHub](#github)
4. [Render.com](#rendercom)
5. [Domínio (Registro.br)](#domínio-registrobr)
6. [Variáveis de Ambiente](#variáveis-de-ambiente)
7. [CI/CD Pipeline](#cicd-pipeline)
8. [Monitoramento](#monitoramento)
9. [Troubleshooting](#troubleshooting)

---

## 🎯 VISÃO GERAL

### Arquitetura da Solução

```
┌─────────────────────────────────────────────────────────────┐
│                    ROM AGENT - ARQUITETURA                  │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌──────────────┐      ┌──────────────┐      ┌──────────┐ │
│  │   GitHub     │─────▶│  Render.com  │─────▶│  Usuário │ │
│  │  (Código)    │      │  (Hosting)   │      │  (Web)   │ │
│  └──────────────┘      └──────┬───────┘      └──────────┘ │
│                               │                            │
│                               ▼                            │
│                     ┌──────────────────┐                   │
│                     │   AWS Bedrock    │                   │
│                     │  Claude Sonnet   │                   │
│                     └──────────────────┘                   │
│                               │                            │
│                               ▼                            │
│                     ┌──────────────────┐                   │
│                     │    DataJud API   │                   │
│                     │   (CNJ/STF)      │                   │
│                     └──────────────────┘                   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Fluxo de Deploy Automático

```
┌─────────┐    git push    ┌─────────┐    webhook    ┌────────┐    build    ┌────────┐
│  Local  │───────────────▶│ GitHub  │──────────────▶│ Render │────────────▶│  Live  │
└─────────┘                └─────────┘                └────────┘             └────────┘
     │                            │                         │                     │
     │                            ▼                         ▼                     ▼
     │                    GitHub Actions            npm ci + start         Health Check
     │                    (CI/CD Pipeline)          (3-5 minutos)          (API /info)
```

---

## ☁️ AWS BEDROCK

### 1. Criar Conta AWS

1. Acesse: https://aws.amazon.com
2. Clique em "Create an AWS Account"
3. Preencha: email, senha, account name
4. **Método de pagamento**: Adicionar cartão (não será cobrado no Free Tier)
5. **Verificação**: SMS/Phone

### 2. Ativar AWS Bedrock

#### 2.1 Acessar Console Bedrock
```
AWS Console → Services → Bedrock
ou
https://us-east-1.console.aws.amazon.com/bedrock
```

#### 2.2 Solicitar Acesso aos Modelos
1. No console Bedrock, vá em **"Model access"** (menu lateral)
2. Clique em **"Manage model access"**
3. Marque:
   - ✅ **Anthropic / Claude 3.5 Sonnet**
   - ✅ **Anthropic / Claude 3 Haiku** (backup)
4. Clique em **"Request model access"**
5. Aguarde aprovação (geralmente instantâneo)

#### 2.3 Criar Access Keys

1. AWS Console → IAM → Users → Create user
2. Nome: `rom-agent-bedrock`
3. **Attach policies directly**:
   - `AmazonBedrockFullAccess`
4. Clique em "Create user"
5. Vá em: User → **Security credentials** → **Create access key**
6. Use case: "Application running on AWS compute service"
7. **Salve**:
   - `AWS_ACCESS_KEY_ID`: AKIA...
   - `AWS_SECRET_ACCESS_KEY`: wJalrX...

### 3. Verificar Limites (Service Quotas)

```bash
# Via AWS CLI
aws service-quotas list-service-quotas \
  --service-code bedrock \
  --region us-east-1 | grep Claude
```

**Limites Padrão**:
- Requests por minuto: 10-50
- Tokens por minuto: 10,000-50,000
- Requests por hora: 1,000

**Solicitar Aumento**:
1. AWS Console → Service Quotas
2. Amazon Bedrock
3. "InvokeModel requests per minute" → Request increase
4. Valor sugerido: 100 req/min

---

## 🐙 GITHUB

### 1. Criar Repositório

```bash
# Se ainda não existe
gh repo create ROM-Agent --public --source=. --remote=origin

# Ou via web
# https://github.com/new
```

### 2. Configurar Secrets

**GitHub Repo → Settings → Secrets and variables → Actions**

```yaml
# Secrets necessários (se quiser usar no CI/CD)
AWS_ACCESS_KEY_ID: AKIA...
AWS_SECRET_ACCESS_KEY: wJalr...
ANTHROPIC_API_KEY: sk-ant-...
DATAJUD_API_KEY: sua_chave...
```

### 3. GitHub Actions

**Arquivo**: `.github/workflows/ci-cd.yml` (já criado ✅)

**Jobs**:
1. **Test**: Validação e testes
2. **Build**: Build de produção
3. **Docker**: Build de imagem Docker (opcional)
4. **Deploy**: Trigger deploy no Render
5. **Notify**: Notificação de status

**Trigger**: Push para `main` ou `develop`

### 4. Proteção de Branches

```bash
# Via GitHub CLI
gh api repos/:owner/:repo/branches/main/protection \
  --method PUT \
  --field required_status_checks='{"strict":true,"contexts":["test"]}' \
  --field enforce_admins=true \
  --field required_pull_request_reviews='{"required_approving_review_count":1}'
```

Ou via Web:
- Settings → Branches → Add rule
- Branch name pattern: `main`
- ✅ Require pull request reviews before merging
- ✅ Require status checks to pass

---

## 🚀 RENDER.COM

### 1. Criar Conta

1. Acesse: https://render.com
2. Sign up with GitHub
3. Autorize acesso ao repositório ROM-Agent

### 2. Criar Web Service

#### Método 1: Via Dashboard (Manual)

1. Dashboard → **New +** → **Web Service**
2. Connect repository: `ROM-Agent`
3. Configurações:
   ```yaml
   Name: rom-agent-ia
   Region: Ohio (us-east-2)
   Branch: main
   Runtime: Node
   Build Command: npm ci --only=production
   Start Command: npm run web:enhanced
   Instance Type: Free
   ```

#### Método 2: Via render.yaml (Automático) ✅

**Arquivo**: `render.yaml` (já configurado ✅)

O Render detecta automaticamente e usa as configurações do arquivo.

### 3. Configurar Variáveis de Ambiente

**Render Dashboard → Service → Environment**

```bash
# Obrigatórias
NODE_ENV=production
PORT=10000
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=wJalr...
AWS_REGION=us-east-1

# Opcionais
ANTHROPIC_API_KEY=sk-ant-...
DATAJUD_API_KEY=...
SESSION_SECRET=(auto-gerado pelo Render)
RATE_LIMIT_PER_MINUTE=10
RATE_LIMIT_PER_HOUR=100
```

**Importante**: Clique em **"Save Changes"** após adicionar cada variável.

### 4. Deploy Manual

```bash
# Via Render Dashboard
Service → Manual Deploy → Deploy latest commit

# Ou via Git
git push origin main
# Deploy automático em 30-60 segundos
```

### 5. Custom Domain (Opcional)

**Depois de configurar no Registro.br**:

1. Render Dashboard → Service → Settings
2. Custom Domains → **Add Custom Domain**
3. Domain: `iarom.com.br`
4. Render fornecerá um CNAME target: `rom-agent-ia.onrender.com`

---

## 🌐 DOMÍNIO (REGISTRO.BR)

### 1. Registrar Domínio

1. Acesse: https://registro.br
2. Buscar: `iarom.com.br`
3. Se disponível: Adicionar ao carrinho
4. Preencher dados do titular
5. Pagar (R$ 40/ano aproximadamente)

### 2. Configurar DNS

**Registro.br → Meus Domínios → iarom.com.br → DNS**

#### Opção A: Usar Nameservers do Render (Recomendado)

1. Render → Service → Settings → Custom Domain
2. Copiar nameservers fornecidos
3. Registro.br → Servidores DNS:
   ```
   Servidor 1: ns1.render.com
   Servidor 2: ns2.render.com
   ```

#### Opção B: Usar Endereçamento Próprio

**Entrada Principal (root domain)**:
```
Tipo: A
Nome: @
Valor: 216.24.57.1
TTL: 3600
```

**WWW (subdomínio)**:
```
Tipo: CNAME
Nome: www
Valor: rom-agent-ia.onrender.com
TTL: 3600
```

### 3. Aguardar Propagação

- **Tempo**: 30 minutos a 2 horas
- **Verificar**: `nslookup iarom.com.br`

```bash
# Verificar DNS
dig iarom.com.br
dig www.iarom.com.br

# Teste direto
curl -I https://iarom.com.br
```

---

## 🔐 VARIÁVEIS DE AMBIENTE

### Configuração Local

**Arquivo**: `.env` (criar a partir de `.env.example`)

```bash
cp .env.example .env
```

**Editar** `.env`:
```bash
# AWS Bedrock (obrigatório)
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=wJalr...
AWS_REGION=us-east-1

# Anthropic (alternativo)
ANTHROPIC_API_KEY=sk-ant-...

# DataJud
DATAJUD_API_KEY=sua_chave

# Servidor
PORT=3000
NODE_ENV=development
```

### Configuração Render

Ver seção [Render.com → Configurar Variáveis de Ambiente](#3-configurar-variáveis-de-ambiente)

### Hierarquia de Prioridade

```
1. Variáveis de ambiente do sistema (mais alta)
2. Arquivo .env
3. Valores padrão no código (menor)
```

---

## ⚙️ CI/CD PIPELINE

### GitHub Actions Workflow

**Arquivo**: `.github/workflows/ci-cd.yml` ✅

```yaml
Trigger: Push para main/develop ou Pull Request

Jobs:
┌─────────────────────────────────────────────┐
│ 1. Test (🧪)                                │
│    - Checkout código                        │
│    - Setup Node.js                          │
│    - npm ci                                 │
│    - Lint, Tests, Validate                 │
└─────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────┐
│ 2. Build (🏗️)                               │
│    - Build produção                         │
│    - Otimizar assets                        │
│    - Upload artifacts                       │
└─────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────┐
│ 3. Docker (🐳) [opcional]                   │
│    - Build imagem                           │
│    - Push para GHCR                         │
└─────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────┐
│ 4. Deploy (🚀)                              │
│    - Trigger Render deploy                  │
│    - Atualizar .render-deploy               │
└─────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────┐
│ 5. Notify (📢)                              │
│    - Status final                           │
│    - Link para produção                     │
└─────────────────────────────────────────────┘
```

### Deploy Manual (sem CI/CD)

```bash
# Método 1: Via Git (recomendado)
git add .
git commit -m "feat: nova feature"
git push origin main
# Render detecta automaticamente

# Método 2: Via Render Dashboard
Render → Service → Manual Deploy

# Método 3: Via API Render
curl -X POST https://api.render.com/v1/services/[SERVICE-ID]/deploys \
  -H "Authorization: Bearer $RENDER_API_KEY"
```

---

## 📊 MONITORAMENTO

### 1. Render Metrics (Built-in)

**Render Dashboard → Service → Metrics**

- ✅ CPU Usage
- ✅ Memory Usage
- ✅ Bandwidth
- ✅ Request Count
- ✅ Response Time

### 2. Health Check

**Endpoint**: `/api/info`

**Configuração**: `render.yaml` → `healthCheckPath: /api/info`

**Response esperado**:
```json
{
  "name": "ROM Agent",
  "version": "2.3.0",
  "status": "operational",
  "uptime": 12345,
  "features": [...]
}
```

**Testar localmente**:
```bash
curl http://localhost:3000/api/info
```

**Testar produção**:
```bash
curl https://rom-agent-ia.onrender.com/api/info
```

### 3. Logs

#### Render Logs (Real-time)
```bash
# Via Dashboard
Render → Service → Logs

# Via CLI (se instalado)
render logs -f rom-agent-ia
```

#### Logs Locais
```bash
# Ver logs do servidor
tail -f logs/web-enhanced.log

# Ver logs de erro
tail -f logs/error.log

# Filtrar por nível
grep "ERROR" logs/*.log
```

### 4. AWS CloudWatch (Bedrock)

```bash
# Via AWS Console
CloudWatch → Logs → Log groups → /aws/bedrock/...

# Métricas importantes:
- InvocationCount (número de chamadas)
- InvocationLatency (latência)
- InvocationErrors (erros)
- InputTokenCount (tokens consumidos)
- OutputTokenCount (tokens gerados)
```

### 5. Uptime Monitoring (Opcional)

**Serviços gratuitos recomendados**:
- UptimeRobot: https://uptimerobot.com
- Freshping: https://www.freshworks.com/website-monitoring
- StatusCake: https://www.statuscake.com

**Configuração**:
```
Monitor Type: HTTP(s)
URL: https://rom-agent-ia.onrender.com/api/info
Interval: 5 minutes
Expected Status Code: 200
```

---

## 🔧 TROUBLESHOOTING

### Problema: Deploy falhou no Render

**Sintomas**: Build failed, App crashed

**Diagnóstico**:
```bash
# Ver logs
Render → Logs

# Erros comuns:
- "Module not found" → npm ci falhou
- "Port already in use" → Variável PORT não configurada
- "ECONNREFUSED" → AWS keys inválidas
```

**Solução**:
1. Verificar `render.yaml` está correto
2. Verificar variáveis de ambiente
3. Re-deploy manual

### Problema: AWS Rate Limit

**Sintoma**: "Too Many Requests"

**Solução**: Ver `SOLUCAO-RATE-LIMIT-AWS.md`

Resumo:
1. Aguardar 10 minutos
2. Verificar rate limiter está ativo
3. Solicitar aumento de quota na AWS

### Problema: Domínio não resolve

**Sintoma**: `ERR_NAME_NOT_RESOLVED`

**Diagnóstico**:
```bash
dig iarom.com.br
nslookup iarom.com.br
```

**Solução**:
1. Verificar configuração DNS no Registro.br
2. Aguardar propagação (até 2 horas)
3. Limpar cache DNS local:
   ```bash
   # Mac
   sudo dscacheutil -flushcache; sudo killall -HUP mDNSResponder

   # Linux
   sudo systemd-resolve --flush-caches

   # Windows
   ipconfig /flushdns
   ```

### Problema: Interface desatualizada

**Sintoma**: Vendo versão antiga do HTML

**Solução**:
```bash
# Limpar cache do navegador
Ctrl+Shift+R (Windows/Linux)
Cmd+Shift+R (Mac)

# Ou modo anônimo
Ctrl+Shift+N (Chrome)
Cmd+Shift+N (Safari)
```

### Problema: GitHub Actions falhou

**Sintoma**: Red X no commit

**Diagnóstico**:
```bash
# Ver workflow
GitHub → Actions → Failed workflow → Ver logs
```

**Solução**:
1. Verificar `.github/workflows/ci-cd.yml`
2. Verificar secrets configurados
3. Re-run workflow

---

## 📚 RECURSOS ADICIONAIS

### Documentação Oficial

- **AWS Bedrock**: https://docs.aws.amazon.com/bedrock
- **Render**: https://render.com/docs
- **GitHub Actions**: https://docs.github.com/actions
- **Registro.br**: https://registro.br/tecnologia

### Ferramentas Úteis

```bash
# AWS CLI
brew install awscli
aws configure

# Render CLI
npm install -g @render/cli
render login

# GitHub CLI
brew install gh
gh auth login
```

### Contatos de Suporte

- **AWS Support**: https://console.aws.amazon.com/support
- **Render Support**: support@render.com
- **Registro.br**: atendimento@registro.br

---

## ✅ CHECKLIST DE DEPLOY COMPLETO

### Fase 1: Configuração Inicial
- [ ] Conta AWS criada
- [ ] Bedrock ativado e modelos aprovados
- [ ] Access keys criadas
- [ ] Repositório GitHub criado
- [ ] Conta Render criada

### Fase 2: Configuração de Serviços
- [ ] Render Web Service configurado
- [ ] Variáveis de ambiente adicionadas
- [ ] GitHub Actions configurado
- [ ] `.env` local criado

### Fase 3: Deploy e Teste
- [ ] Primeiro deploy concluído
- [ ] Health check OK (`/api/info`)
- [ ] Interface carregando
- [ ] Chat funcionando
- [ ] AWS Bedrock respondendo

### Fase 4: Domínio (Opcional)
- [ ] Domínio registrado no Registro.br
- [ ] DNS configurado
- [ ] Propagação concluída
- [ ] HTTPS funcionando

### Fase 5: Monitoramento
- [ ] Render Metrics ativo
- [ ] CloudWatch configurado
- [ ] Uptime monitor configurado
- [ ] Logs monitorados

---

**🎉 Integração Completa! Todas as plataformas configuradas e integradas.**

**Acesso**: https://rom-agent-ia.onrender.com
**Domínio** (quando configurado): https://iarom.com.br
