# ⚡ Quick Start - Force Deploy

Guia rápido para forçar deploy no Render.

## 🚀 Uso Rápido (3 passos)

### 1️⃣ Obter API Key

```bash
# 1. Acesse: https://dashboard.render.com/u/settings
# 2. Clique em "API Keys" → "Create API Key"
# 3. Copie a key e cole abaixo:

export RENDER_API_KEY="rnd_xxxxxxxxxxxxx"
```

### 2️⃣ Descobrir Service ID (primeira vez apenas)

```bash
# Executar script auxiliar
./scripts/get-render-services.sh
```

**Output:**
```
📦 Serviço: rom-agent-api
   ID: srv-xxxxxxxxxxxxx
   Tipo: web_service

   💡 Para usar este serviço:
      export RENDER_SERVICE_ID="srv-xxxxxxxxxxxxx"
```

Copie e execute o comando `export` mostrado.

### 3️⃣ Forçar Deploy

```bash
# Deploy normal (usa cache)
./scripts/force-render-deploy.sh

# OU com clear cache (mais lento mas resolve problemas)
./scripts/force-render-deploy.sh --clear-cache
```

## 📊 O que acontece

```
═══════════════════════════════════════════════════════════
  🚀 Force Render Deploy
═══════════════════════════════════════════════════════════

✅ RENDER_API_KEY configurada
✅ RENDER_SERVICE_ID: srv-xxxxx

🚀 Iniciando deploy forçado...
✅ Deploy iniciado!

⏳ Monitorando deploy...
[16:10:00] 📦 Deploy criado
[16:10:10] 🔨 Build em progresso...
[16:12:30] 🚀 Deploy em progresso...
[16:13:00] ✅ Deploy COMPLETO!

🔗 Acesse: https://iarom.com.br
```

## 🔄 Para usar novamente

Uma vez configurado, basta:

```bash
./scripts/force-render-deploy.sh
```

As variáveis ficam salvas na sessão do terminal.

## ❓ Problemas?

Leia: [README-FORCE-DEPLOY.md](./README-FORCE-DEPLOY.md)

---

**Tempo estimado:** 2 minutos (primeira vez) | 30 segundos (próximas)
