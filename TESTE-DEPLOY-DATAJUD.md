# 🧪 TESTE APÓS DEPLOY - DataJud CNJ

## ⏰ QUANDO O DEPLOY TERMINAR

Seu deploy está usando:
- ✅ **AWS Bedrock** (credenciais corretas)
- ✅ **DataJud CNJ** (chave pública configurada)
- ✅ **server-enhanced.js** (produção)

---

## 🔍 VERIFICAÇÕES RÁPIDAS

### 1️⃣ Sistema Online
```bash
curl https://SEU-DOMINIO.onrender.com/api/health
```
**Deve retornar:** Status 200 OK

---

### 2️⃣ DataJud Health Check
```bash
curl https://SEU-DOMINIO.onrender.com/api/datajud/health
```

**Resposta esperada:**
```json
{
  "status": "ok",
  "configured": true,
  "baseUrl": "https://api-publica.datajud.cnj.jus.br",
  "tribunaisDisponiveis": 38,
  "version": "1.0.0"
}
```

✅ **SE VOCÊ VER ISSO = TUDO FUNCIONANDO!**

---

### 3️⃣ Interface de Teste (Mais Fácil)
Abra no navegador:
```
https://SEU-DOMINIO.onrender.com/datajud-test.html
```

**O que você vai ver:**
- 🟢 Interface visual moderna
- 🔍 Formulários de busca
- 📊 Estatísticas dos tribunais
- 🧪 Testes interativos

**Teste agora:**
1. Selecione tribunal: **TJSP**
2. Digite número: **0000832-35.2018.4.01.3202**
3. Clique em **"🔍 Buscar Processo"**
4. Aguarde resultado

---

## 🤖 TESTE AUTOMÁTICO (Script Pronto)

Execute este comando:
```bash
bash test-datajud-producao.sh SEU-DOMINIO.onrender.com
```

**O script testa:**
- ✅ Health check
- ✅ Lista de tribunais (38 tribunais)
- ✅ Busca de processo
- ✅ Busca multi-tribunal
- ✅ Busca de decisões
- ✅ Validação CNJ
- ✅ Classes processuais
- ✅ Assuntos
- ✅ Cache stats

**Resultado:**
```
✅ 9/9 testes passaram = TUDO OK!
❌ Algum teste falhou = Ver logs
```

---

## 📱 TESTE MANUAL (Postman/Insomnia)

### Request 1: Buscar Processo
```http
POST https://SEU-DOMINIO.onrender.com/api/datajud/processos/buscar
Content-Type: application/json

{
  "tribunal": "TJSP",
  "numero": "0000832-35.2018.4.01.3202",
  "limit": 50
}
```

### Request 2: Buscar Múltiplos Tribunais
```http
POST https://SEU-DOMINIO.onrender.com/api/datajud/processos/buscar-todos
Content-Type: application/json

{
  "tribunais": ["TJSP", "TJRJ", "TJMG", "STJ"],
  "numero": "0000832-35.2018.4.01.3202",
  "limit": 20
}
```

### Request 3: Buscar Decisões
```http
POST https://SEU-DOMINIO.onrender.com/api/datajud/decisoes/buscar
Content-Type: application/json

{
  "tribunal": "STJ",
  "termo": "responsabilidade civil dano moral",
  "limit": 30
}
```

---

## 🔧 SE ALGO DER ERRADO

### Problema 1: "status": "error"
**Causa:** DataJud API Key pode estar incorreta

**Solução:**
1. Verifique no Render: `DATAJUD_API_KEY`
2. Valor correto: `cDZHYzlZa0JadVREZDJCendQbXY6SkJlTzNjLV9TRENyQk1RdnFKZGRQdw==`
3. **SEM aspas duplas**
4. Save Changes e aguarde redeploy

---

### Problema 2: "configured": false
**Causa:** Variável não está no Render

**Solução:**
Adicione no Render → Environment:
```bash
DATAJUD_API_KEY=cDZHYzlZa0JadVREZDJCendQbXY6SkJlTzNjLV9TRENyQk1RdnFKZGRQdw==
DATAJUD_BASE_URL=https://api-publica.datajud.cnj.jus.br
DATAJUD_ENABLED=true
```

---

### Problema 3: 404 Not Found
**Causa:** Rota não registrada

**Solução:**
1. Verificar logs do Render
2. Ver se `src/routes/datajud.js` existe
3. Ver se está registrado em `src/server.js`

---

### Problema 4: Timeout
**Causa:** API DataJud CNJ pode estar lenta

**Solução:**
- É normal em primeira requisição
- Tente novamente
- Cache vai acelerar próximas buscas

---

## ✅ CHECKLIST DE SUCESSO

Marque conforme testa:

- [ ] Deploy concluído no Render
- [ ] `/api/health` retorna 200 OK
- [ ] `/api/datajud/health` retorna status "ok"
- [ ] `/api/datajud/tribunais` lista 38 tribunais
- [ ] `/datajud-test.html` carrega interface
- [ ] Busca de processo funciona
- [ ] Busca multi-tribunal funciona
- [ ] Busca de decisões funciona
- [ ] Cache stats mostra dados

**Se todos ✅ = INTEGRAÇÃO 100% FUNCIONANDO!**

---

## 📊 MÉTRICAS ESPERADAS

### Primeira Requisição:
- ⏱️ Tempo: 2-5 segundos (sem cache)
- 📦 Tamanho: ~5-50 KB JSON
- ✅ Status: 200 OK

### Requisições Subsequentes (Cache):
- ⏱️ Tempo: <100ms (com cache)
- 📦 Tamanho: ~5-50 KB JSON
- ✅ Status: 200 OK
- 🔥 Header: `fromCache: true`

---

## 🎯 PRÓXIMOS PASSOS

Depois de validar:

1. **Integrar no Frontend Principal**
   - Adicionar botão "Consultar DataJud"
   - Criar modal de busca
   - Exibir resultados formatados

2. **Adicionar ao Sistema ROM**
   - Usar em redação de peças
   - Citar processos automaticamente
   - Buscar precedentes

3. **Monitoramento**
   - Ver `/api/datajud/cache/stats`
   - Monitorar taxa de cache hit
   - Otimizar queries mais usadas

---

## 📞 SUPORTE

**Documentação:**
- Guia Rápido: `DATAJUD-QUICKSTART.md`
- Docs Completa: `docs/DATAJUD-INTEGRACAO-COMPLETA.md`
- Script Teste: `test-datajud-producao.sh`

**Logs do Render:**
- Dashboard → SEU-APP → Logs
- Procure por: `[DataJud]`

**Correções Aplicadas:**
- `.env.render-corrected` (referência)
- `ENV-CORRECOES-URGENTES.md` (guia)

---

## 🎉 RESULTADO ESPERADO

```bash
$ bash test-datajud-producao.sh seu-app.onrender.com

══════════════════════════════════════════════════════════════
🧪 TESTANDO DATAJUD EM PRODUÇÃO
══════════════════════════════════════════════════════════════

📋 TESTE: 1. Health Check DataJud
   Status: ✅ 200 OK
   Resposta: {"status":"ok","configured":true,...}

📋 TESTE: 2. Listar Todos os Tribunais
   Status: ✅ 200 OK
   Resposta: {"total":38,"tribunais":[...]}

📋 TESTE: 3. Buscar Processo no TJSP
   Status: ✅ 200 OK
   Resposta: {"fonte":"DataJud (CNJ)","totalEncontrado":1,...}

... [todos os 9 testes] ...

══════════════════════════════════════════════════════════════
✅ TESTES CONCLUÍDOS!
══════════════════════════════════════════════════════════════
```

---

**🚀 Boa sorte com o deploy!**
**📧 Qualquer dúvida, consulte a documentação.**

---

*Última atualização: 2026-02-12*
*Versão: 1.0.0*
