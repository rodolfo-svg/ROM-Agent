# 🚀 Deploy Guide - Real-time Progress Tracking

## ✅ Status: Pronto para Deploy

**Commits pushed:** 4 commits (f768e07...2307f68)

## 📋 Checklist de Deploy

### 1. Atualizar Código em Produção
```bash
git pull origin main
npm install
```

### 2. Rodar Migração do Banco ⚠️ OBRIGATÓRIO
```bash
# Opção 1: Via script
./scripts/run-migration.sh

# Opção 2: Direto
psql $DATABASE_URL < db/migrations/005_create_extraction_jobs.sql
```

### 3. Reiniciar Servidor
```bash
pm2 restart rom-agent
# OU
sudo systemctl restart rom-agent
```

### 4. Verificar Logs
```bash
pm2 logs rom-agent --lines 50
```

Procure por:
- `✅ [SERVER] WebSocket server inicializado`
- `✅ [ROUTES] /api/extraction-jobs registrado`
- `[WebSocket] Extraction progress service initialized`

## 🧪 Testes em Produção

### Teste 1: Health Check
```bash
curl https://iarom.com.br/api/health
curl https://iarom.com.br/api/health/websocket
```

### Teste 2: Upload com Progress Tracking
1. Acesse https://iarom.com.br
2. Vá para Knowledge Base
3. Upload documento PDF
4. Clique "Analisar"
5. Observe barra de progresso em tempo real

## 🎯 Funcionalidades Novas

- ✅ Progress tracking em tempo real
- ✅ WebSocket para atualizações instantâneas
- ✅ 5 endpoints REST para gerenciar jobs
- ✅ UI com barra de progresso animada
- ✅ Suporte a múltiplos jobs simultâneos
- ✅ Background processing (não bloqueia)

## 🔧 Troubleshooting

**Problema:** Tabela não existe
```bash
psql $DATABASE_URL < db/migrations/005_create_extraction_jobs.sql
```

**Problema:** Progress bar não aparece
1. Verificar `npm list socket.io-client`
2. Verificar logs do navegador (F12)
3. Testar `/api/extraction-jobs/active`

---

**Deploy Date:** 2026-02-05
**Version:** 4.1.0
