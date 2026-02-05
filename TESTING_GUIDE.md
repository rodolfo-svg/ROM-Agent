# 🧪 GUIA DE TESTE - Progress Tracking System

## ✅ SISTEMA IMPLEMENTADO E PRONTO

### Componentes Instalados:
- ✅ Tabela `extraction_jobs` criada no PostgreSQL
- ✅ Backend: ExtractionJob model + ExtractionProgressService
- ✅ API REST: 5 endpoints em /api/extraction-jobs
- ✅ WebSocket: Socket.IO configurado e funcionando
- ✅ Frontend: ExtractionProgressBar component (React)
- ✅ Integration: KB tab com progress tracking

---

## 📋 TESTE 1: Upload de Documento Simples

### Passo a Passo:
1. Acesse: https://iarom.com.br
2. Faça login com suas credenciais
3. Vá para a aba **Knowledge Base**
4. Faça upload de um PDF (qualquer tamanho)
5. Clique em **"Analisar"**

### O que você deve ver:

#### Durante o Processamento:
```
┌─────────────────────────────────────────────────┐
│ 📄 Extrações em Andamento                      │
├─────────────────────────────────────────────────┤
│ 📄 documento.pdf                                │
│ ━━━━━━━━━━━━━━━━━━━━━━━ 45%                   │
│ 🔄 Processando chunk 2/4...                     │
│ ⏱️  Tempo estimado: 1min 30s                    │
│ 💰 Custo parcial: $0.15                         │
│ [Cancelar]                                       │
└─────────────────────────────────────────────────┘
```

#### Após Completar:
```
┌─────────────────────────────────────────────────┐
│ ✅ documento.pdf                                │
│ ━━━━━━━━━━━━━━━━━━━━━━━ 100%                  │
│ ✅ Concluído • 4 chunks processados             │
│ ⏱️  Tempo total: 2min 15s                       │
│ 💰 Custo total: $0.32                           │
│ [Remover]                                        │
└─────────────────────────────────────────────────┘
```

---

## 📋 TESTE 2: Múltiplos Jobs Simultâneos

### Passo a Passo:
1. Faça upload de 3 documentos diferentes
2. Clique "Analisar" nos 3 rapidamente
3. Observe todos processando simultaneamente

### O que você deve ver:
```
┌─────────────────────────────────────────────────┐
│ 📄 Extrações em Andamento (3)                   │
├─────────────────────────────────────────────────┤
│ 📄 doc1.pdf                                     │
│ ━━━━━━━━━━━━━━━━━━━━━━━ 75%                   │
│                                                  │
│ 📄 doc2.pdf                                     │
│ ━━━━━━━━━━━━━━━━━━━━━━━ 30%                   │
│                                                  │
│ 📄 doc3.pdf                                     │
│ ━━━━━━━━━━━━━━━━━━━━━━━ 10%                   │
└─────────────────────────────────────────────────┘
```

---

## 🔍 VERIFICAÇÕES TÉCNICAS

### Backend Health Check:
```bash
curl https://iarom.com.br/health
```

Resposta esperada:
```json
{
  "status": "healthy",
  "database": {
    "postgres": {
      "available": true,
      "latency": 2
    }
  }
}
```

### WebSocket Health Check:
```bash
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

### Verificar Tabela no Banco:
```sql
-- No Render Shell:
psql $DATABASE_URL -c "SELECT COUNT(*) FROM extraction_jobs;"
psql $DATABASE_URL -c "SELECT id, document_name, status, progress FROM extraction_jobs LIMIT 5;"
```

---

## 🐛 TROUBLESHOOTING

### Progress Bar não aparece?
1. Verifique console do navegador (F12)
2. Procure por erros de Socket.IO
3. Confirme que o endpoint /api/extraction-jobs/active retorna 200

### Job fica travado em "processing"?
1. Verifique logs do servidor: `pm2 logs rom-agent`
2. Procure por erros no document-processor-v2.js
3. Verifique se ExtractionProgressService está inicializado

### Custo não aparece?
- Normal se o modelo usado não reportar custo
- Verifique metadata do job no banco

---

## 📊 MÉTRICAS PARA MONITORAR

### No PostgreSQL:
```sql
-- Jobs por status
SELECT status, COUNT(*) FROM extraction_jobs GROUP BY status;

-- Jobs mais recentes
SELECT document_name, status, created_at
FROM extraction_jobs
ORDER BY created_at DESC
LIMIT 10;

-- Jobs falhados (para debug)
SELECT document_name, error_message, created_at
FROM extraction_jobs
WHERE status = 'failed'
ORDER BY created_at DESC;
```

---

## ✅ CHECKLIST FINAL

- [ ] Servidor rodando (https://iarom.com.br/health = 200)
- [ ] WebSocket funcionando (/api/health/websocket = 200)
- [ ] Tabela extraction_jobs criada (14 colunas)
- [ ] Upload de documento funciona
- [ ] Progress bar aparece durante extração
- [ ] Job completa com sucesso
- [ ] Múltiplos jobs funcionam simultaneamente
- [ ] Cancelar job funciona
- [ ] Jobs persistem no banco até deletados

---

**Status Atual:** ✅ PRONTO PARA TESTES EM PRODUÇÃO
**Ambiente:** https://iarom.com.br
**Data:** 2026-02-05
