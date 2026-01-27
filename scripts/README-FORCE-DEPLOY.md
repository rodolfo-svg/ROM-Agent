# 🚀 Force Render Deploy

Script para forçar rebuild/deploy no Render via API.

## 📋 Pré-requisitos

### 1. Obter API Key do Render

1. Acesse: https://dashboard.render.com/u/settings
2. Menu lateral → **API Keys**
3. Clique em **Create API Key**
4. Nomeie: "Deploy Script" ou similar
5. Copie a key (formato: `rnd_xxxxx...`)

### 2. Obter Service ID

1. Acesse: https://dashboard.render.com
2. Clique no seu serviço **ROM-Agent** (ou nome configurado)
3. A URL será: `https://dashboard.render.com/web/srv-XXXXXX`
4. Copie o `srv-XXXXXX`

## 🔧 Uso

### Opção 1: Exportar variáveis (recomendado)

```bash
# Configurar credenciais (uma vez por sessão)
export RENDER_API_KEY="rnd_xxxxxxxxxxxxx"
export RENDER_SERVICE_ID="srv-xxxxxxxxxxxxx"

# Executar deploy
./scripts/force-render-deploy.sh
```

### Opção 2: Inline (uso único)

```bash
RENDER_API_KEY="rnd_xxx" RENDER_SERVICE_ID="srv-xxx" ./scripts/force-render-deploy.sh
```

### Opção 3: Deploy com Clear Cache

Use quando houver mudanças em dependências ou problemas de cache:

```bash
./scripts/force-render-deploy.sh --clear-cache
```

## 📊 Output Esperado

```
═══════════════════════════════════════════════════════════
  🚀 Force Render Deploy
═══════════════════════════════════════════════════════════

✅ RENDER_API_KEY configurada
✅ RENDER_SERVICE_ID: srv-xxxxx

📊 Obtendo informações do serviço...
✅ Serviço encontrado:
   Nome: rom-agent-api
   Tipo: web_service
   Auto-deploy: enabled

🚀 Iniciando deploy forçado...
✅ Deploy normal (usa cache)

✅ Deploy iniciado!
   ID: dep-xxxxx
   Status: created

🔗 Acompanhe em:
   https://dashboard.render.com/web/srv-xxxxx

⏳ Monitorando deploy (Ctrl+C para sair)...

[16:10:00] 📦 Deploy criado, aguardando início...
[16:10:10] 🔨 Build em progresso...
[16:12:30] 🚀 Deploy em progresso...
[16:13:00] ✅ Deploy COMPLETO! Serviço está LIVE!

═══════════════════════════════════════════════════════════
  🎉 SUCESSO!
═══════════════════════════════════════════════════════════

🔗 Acesse: https://iarom.com.br
```

## ⚠️ Problemas Comuns

### 1. "RENDER_API_KEY não configurada"

**Solução:**
```bash
export RENDER_API_KEY="rnd_xxxxx"
```

### 2. "RENDER_SERVICE_ID não configurada"

**Solução:**
```bash
export RENDER_SERVICE_ID="srv-xxxxx"
```

### 3. "jq não está instalado"

**Solução:**
```bash
# macOS
brew install jq

# Ubuntu/Debian
sudo apt install jq

# Windows (Git Bash)
# Baixar de: https://stedolan.github.io/jq/download/
```

### 4. "Falha ao obter informações do serviço"

**Causas possíveis:**
- API Key inválida ou expirada
- Service ID incorreto
- Sem permissão para acessar o serviço

**Solução:**
1. Verifique a API Key no dashboard
2. Confirme o Service ID na URL do navegador
3. Gere uma nova API Key se necessário

### 5. Deploy fica em "build_in_progress" por muito tempo

**Normal:** Builds podem demorar 2-5 minutos

**Se > 10 minutos:**
- Verifique logs no dashboard
- Pode haver erro de build (dependências, sintaxe)
- Considere usar `--clear-cache`

## 🔄 Quando Usar

### Use o script quando:

1. ✅ **Auto-deploy não está funcionando**
   - GitHub webhook não configurado
   - Render não detectou o push

2. ✅ **Precisa forçar rebuild**
   - Mudanças em variáveis de ambiente
   - Problemas de cache
   - Deploy anterior falhou

3. ✅ **Teste rápido de deploy**
   - Validar se API key funciona
   - Confirmar que serviço está respondendo

### NÃO use quando:

1. ❌ **Auto-deploy está funcionando**
   - Deixe o Render fazer automaticamente
   - Mais eficiente e seguro

2. ❌ **Deploy em progresso**
   - Aguarde completar
   - Múltiplos deploys podem causar conflitos

## 📝 Salvando Credenciais (Opcional)

Para não precisar exportar toda vez:

### Opção 1: .bashrc / .zshrc (permanente)

```bash
# Adicionar ao final de ~/.bashrc ou ~/.zshrc
export RENDER_API_KEY="rnd_xxxxx"
export RENDER_SERVICE_ID="srv-xxxxx"

# Recarregar
source ~/.bashrc  # ou source ~/.zshrc
```

### Opção 2: .env local (projeto)

```bash
# Criar arquivo .env.local (NÃO comitar!)
echo "RENDER_API_KEY=rnd_xxxxx" >> .env.local
echo "RENDER_SERVICE_ID=srv-xxxxx" >> .env.local

# Adicionar ao .gitignore
echo ".env.local" >> .gitignore

# Usar com:
source .env.local && ./scripts/force-render-deploy.sh
```

## 🔐 Segurança

**IMPORTANTE:**

- ✅ **NUNCA** comitar API keys no Git
- ✅ **NUNCA** compartilhar API keys publicamente
- ✅ **REVOGUE** keys antigas quando gerar novas
- ✅ **USE** variáveis de ambiente
- ✅ **ADICIONE** .env.local ao .gitignore

## 📚 Referências

- [Render API Documentation](https://api-docs.render.com/)
- [Render Deploy API](https://api-docs.render.com/reference/create-deploy)
- [Render Dashboard](https://dashboard.render.com)

---

**Criado para ROM-Agent**
Versão: 1.0.0
Data: 2026-01-27
