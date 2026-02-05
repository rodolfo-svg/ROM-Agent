# 🚀 Deploy Instructions - Real-time Progress Tracking System

## Status: ✅ PRONTO PARA DEPLOY

Todas as mudanças foram commitadas e enviadas para o repositório remoto.

## 📝 Commits Realizados

```
2307f68 - feat: Integrate extraction progress tracking in KB UI
054ed3d - feat: Add React components for real-time extraction progress tracking
e5f4315 - feat: Add REST API endpoints and job tracking infrastructure
f768e07 - feat: Add real-time progress tracking for V2 extractions
```

## 🔧 Passos para Deploy em Produção (iarom.com.br)

### 1. Conectar ao Servidor de Produção

```bash
# Via SSH ou painel de controle (Render/Railway/Vercel/etc)
ssh user@iarom.com.br
# OU use o dashboard do seu provider
```

### 2. Atualizar Código

```bash
cd /path/to/ROM-Agent
git pull origin main
```

### 3. Instalar Novas Dependências

```bash
npm install
```

**Nova dependência instalada:**
- `socket.io-client@^4.7.2` (para WebSocket no frontend)

### 4. Rodar Migração do Banco de Dados ⚠️ **CRÍTICO**

Execute a migração para criar a tabela `extraction_jobs`:

```bash
psql $DATABASE_URL < db/migrations/005_create_extraction_jobs.sql
```

**OU via script Node.js:**

```bash
node -e "
const { Pool } = require('pg');
const fs = require('fs');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const sql = fs.readFileSync('db/migrations/005_create_extraction_jobs.sql', 'utf8');
pool.query(sql)
  .then(() => { console.log('✅ Migration successful!'); pool.end(); })
  .catch(err => { console.error('❌ Migration failed:', err); pool.end(); });
"
```

**Verificar se funcionou:**

```bash
psql $DATABASE_URL -c "SELECT table_name FROM information_schema.tables WHERE table_name = 'extraction_jobs';"
```

Deve retornar:
```
 table_name
-----------------
 extraction_jobs
```

### 5. Reiniciar Serviços

```bash
# Se estiver usando PM2
pm2 restart rom-agent

# Se estiver usando systemd
sudo systemctl restart rom-agent

# Se estiver em container (Docker)
docker-compose restart

# Se estiver no Render/Railway/Vercel
# O deploy automático já reinicia após git push
```

### 6. Verificar Logs

```bash
# PM2
pm2 logs rom-agent --lines 50

# Docker
docker-compose logs -f --tail=50

# Systemd
journalctl -u rom-agent -f -n 50
```

**Procure por:**
```
✅ [SERVER] Servidor iniciado em 0.0.0.0:3000
✅ [SERVER] WebSocket server inicializado
✅ [SERVER] Database já inicializado - session store configurado
✅ [ROUTES] /api/extraction-jobs registrado
[WebSocket] Extraction progress service initialized
```

## 🧪 Testes em Produção

### Teste 1: Health Check

```bash
# Backend API
curl https://iarom.com.br/api/health

# WebSocket
curl https://iarom.com.br/api/health/websocket
```

Resposta esperada:
```json
{
  "success": true,
  "websocket": {
    "connected": 0,
    "rooms": []
  }
}
```

### Teste 2: Extraction Jobs API

```bash
# Listar jobs (precisa estar autenticado)
curl -H "Cookie: connect.sid=YOUR_SESSION_COOKIE" \
  https://iarom.com.br/api/extraction-jobs

# Jobs ativos
curl -H "Cookie: connect.sid=YOUR_SESSION_COOKIE" \
  https://iarom.com.br/api/extraction-jobs/active
```

### Teste 3: Upload e Extração com Progress Tracking

1. Acesse https://iarom.com.br
2. Faça login
3. Vá para a aba **Knowledge Base**
4. Faça upload de um documento PDF grande (>1MB)
5. Clique em "Analisar"
6. **Observe:**
   - Job aparece na lista de "Extrações em Andamento"
   - Barra de progresso atualiza a cada 5 segundos
   - Ícone animado de loading
   - Contador de chunks (se documento for grande)
   - Ao completar: status muda para verde com ✓
   - Lista de documentos é atualizada automaticamente

### Teste 4: Múltiplos Jobs Simultâneos

1. Faça upload de 3 documentos
2. Clique "Analisar" em todos os 3 rapidamente
3. **Observe:**
   - Todos os 3 jobs aparecem simultaneamente
   - Cada um tem sua própria barra de progresso
   - Progresso independente para cada job
   - Completam em ordem de processamento

## 🔍 Troubleshooting

### Problema: Tabela extraction_jobs não existe

**Erro:**
```
relation "extraction_jobs" does not exist
```

**Solução:**
```bash
psql $DATABASE_URL < db/migrations/005_create_extraction_jobs.sql
```

### Problema: Socket.IO não conecta

**Sintoma:**
- Progress bar não atualiza
- Console do navegador mostra erro de conexão

**Verificações:**
1. WebSocket está habilitado no proxy reverso (Nginx/Caddy)?
2. Porta está aberta no firewall?
3. CORS configurado corretamente?

**Solução para Nginx:**
```nginx
location /socket.io/ {
    proxy_pass http://localhost:3000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
}
```

### Problema: Progress bar não aparece

**Verificações:**
1. `socket.io-client` está instalado? (`npm list socket.io-client`)
2. Componente `ExtractionProgressBar` existe?
3. Rota `/api/extraction-jobs/active` retorna 200?

**Debug no Console do Navegador:**
```javascript
// Abra DevTools (F12) e cole:
fetch('/api/extraction-jobs/active', {credentials: 'include'})
  .then(r => r.json())
  .then(console.log)
```

### Problema: Jobs ficam "stuck" em processing

**Causa:** Servidor reiniciou durante processamento

**Solução:** Adicionar job recovery no startup:
```javascript
// Adicionar em server-enhanced.js depois do listen()
ExtractionJob.update(
  { status: 'failed', errorMessage: 'Server restarted during processing' },
  { where: { status: ['pending', 'processing'] } }
);
```

## 📊 Monitoramento em Produção

### Métricas para Observar

1. **Número de jobs ativos:** `GET /api/extraction-jobs/active`
2. **Conexões WebSocket:** `GET /api/health/websocket`
3. **Tempo médio de extração:** Logs do document-processor-v2
4. **Taxa de erro:** Jobs com status `failed`
5. **Custos de IA:** Metadata dos jobs completados

### Logs Importantes

```bash
# Jobs criados
[ExtractionProgress] Created job <uuid> for document <name>

# Jobs iniciados
[ExtractionProgress] Started job <uuid> with method=chunking, chunks=4

# Progresso
[ExtractionProgress] Job <uuid> completed chunk 2/4

# Conclusão
[ExtractionProgress] Job <uuid> completed successfully

# Erros
[ExtractionProgress] Job <uuid> failed: <error>
```

## 🎯 Checklist de Deploy

- [ ] Código atualizado (git pull)
- [ ] Dependências instaladas (npm install)
- [ ] Migração executada (extraction_jobs table criada)
- [ ] Serviço reiniciado
- [ ] Health checks passando
- [ ] WebSocket funcionando
- [ ] Upload de documento testado
- [ ] Progress bar aparecendo
- [ ] Jobs completando com sucesso
- [ ] Logs sem erros

## ✅ Validação Final

Execute este script para validar tudo:

```bash
#!/bin/bash

echo "🔍 Validando deploy do sistema de progress tracking..."

# 1. Verificar tabela
echo "1. Verificando tabela extraction_jobs..."
psql $DATABASE_URL -c "\d extraction_jobs" > /dev/null 2>&1 && echo "✅ Tabela existe" || echo "❌ Tabela NÃO existe"

# 2. Verificar API
echo "2. Verificando API..."
curl -s https://iarom.com.br/api/health | grep -q "success" && echo "✅ API funcionando" || echo "❌ API com problema"

# 3. Verificar WebSocket
echo "3. Verificando WebSocket..."
curl -s https://iarom.com.br/api/health/websocket | grep -q "websocket" && echo "✅ WebSocket configurado" || echo "❌ WebSocket com problema"

# 4. Verificar logs
echo "4. Verificando logs..."
pm2 logs rom-agent --nostream --lines 20 | grep -q "WebSocket server inicializado" && echo "✅ Logs OK" || echo "⚠️  Verificar logs manualmente"

echo ""
echo "🎯 Deploy validation complete!"
```

## 📞 Suporte

Se algo não funcionar:
1. Verifique os logs do servidor
2. Verifique o console do navegador (F12)
3. Teste os endpoints manualmente com `curl`
4. Revise o troubleshooting acima

**Arquivos de referência:**
- Backend: `src/server-enhanced.js`, `lib/document-processor-v2.js`
- API: `src/routes/extraction-jobs.js`
- Frontend: `frontend/src/components/extraction/ExtractionProgressBar.tsx`
- Migration: `db/migrations/005_create_extraction_jobs.sql`

---

**Data do Deploy:** 2026-02-05
**Versão:** 4.1.0 (Real-time Progress Tracking)
**Status:** ✅ Pronto para produção
