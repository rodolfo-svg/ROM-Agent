# 🧪 TESTE DATAJUD CNJ - PRODUÇÃO (iarom.com.br)

## ✅ STATUS DA INTEGRAÇÃO

### Backend Verificado:
- ✅ **Login funcional** (HTTP 200)
- ✅ **DataJud CNJ configurado** (39 tribunais)
- ✅ **Endpoint `/api/chat` ativo** (usa BedrockAgent)
- ✅ **jurisprudence-search-service.js** modificado
- ✅ **Circuit Breaker implementado**
- ✅ **Timeout 5s configurado**

### Fluxo Completo:
```
Usuário
  ↓
/api/chat (POST)
  ↓
BedrockAgent.enviar()
  ↓
bedrock-tools.js (detecção semântica)
  ↓
jurisprudence-search-service.js
  ↓
1. DataJud CNJ (5s) - PRIORIDADE
2. Google Search (fallback)
  ↓
Resultados → SSE Streaming → Usuário
```

---

## 🧪 COMO TESTAR AGORA

### 1. Acesse o Sistema

**URL:** https://iarom.com.br

**Login:**
- Email: `rodolfo@rom.adv.br`
- Senha: `Mota@2323`

### 2. Teste no Chat

Digite qualquer uma destas frases no chat:

```
"Busque jurisprudência sobre dano moral"
```

```
"Mostre precedentes do STJ sobre responsabilidade civil"
```

```
"Jurisprudência recente sobre direito do consumidor"
```

```
"Decisões do TJSP sobre indenização por acidente de trabalho"
```

```
"Precedentes sobre prescrição em ação indenizatória"
```

### 3. O Que Esperar

Você deve ver em tempo real (SSE streaming):

```
💬 Você: Busque jurisprudência sobre dano moral

🤖 ROM Agent:
🔍 Buscando jurisprudência no DataJud CNJ...

[2-5 segundos de processamento]

✅ Encontrados 8 resultados nos tribunais:
- STF: 2 resultados
- STJ: 3 resultados
- TJSP: 2 resultados
- TJRJ: 1 resultado

📄 Processando ementas completas...

[Exibe resultados formatados com:]
- Número do processo
- Tribunal
- Data da decisão
- Ementa completa
- Relator
- Link para acórdão
```

---

## ⚡ Performance Esperada

| Métrica | Valor |
|---------|-------|
| **Tempo de resposta** | 3-5 segundos |
| **Timeout DataJud** | 5s MAX |
| **Timeout Google Fallback** | 10s MAX |
| **Chat travado?** | ❌ Não (SSE streaming mantido) |
| **Tribunais consultados** | Top 5 por padrão (STF, STJ, TJSP, TJRJ, TJMG) |

---

## 🔍 Como Verificar se DataJud Está Sendo Usado

### Método 1: Observar o Chat

Se o chat mencionar:
- "Buscando no DataJud CNJ..."
- "Fonte: DataJud (CNJ)"
- Número de processos CNJ (formato oficial)

✅ **DataJud está ativo!**

### Método 2: Developer Tools (Console do Browser)

1. Abra DevTools (F12)
2. Vá em **Console**
3. Digite sua mensagem no chat
4. Observe os logs:

```javascript
// Se DataJud estiver ativo, você verá:
[DATAJUD] Buscando "dano moral"...
[DATAJUD] Retornou 8 resultado(s)
```

### Método 3: Network Tab

1. Abra DevTools (F12)
2. Vá em **Network**
3. Filtre por `/api/chat`
4. Envie mensagem
5. Veja a resposta SSE em tempo real

---

## 🔄 Circuit Breaker (Proteção Automática)

Se DataJud falhar 3 vezes consecutivas, o sistema automaticamente:

1. ❌ **Abre o circuito** (para de tentar DataJud)
2. 🔄 **Usa Google Search como principal**
3. ⏰ **Aguarda 60 segundos**
4. ✅ **Tenta DataJud novamente** (half-open)
5. ✅ **Reseta contador** se sucesso

**Você verá no chat:**
```
⚠️ DataJud temporariamente indisponível
🔍 Buscando via Google Search...
✅ Encontrados 10 resultados
```

---

## 🎯 Tribunais Disponíveis (39)

### Superiores (5):
- STF, STJ, STM, TSE, TST

### Federais (6):
- TRF1, TRF2, TRF3, TRF4, TRF5, TRF6

### Estaduais (28):
- TJSP, TJRJ, TJMG, TJRS, TJPR, TJSC, TJBA, TJCE, TJPE, TJGO, TJDFT, TJES, TJPA, TJMA, TJMT, TJMS, TJAM, TJAL, TJPB, TJRN, TJPI, TJSE, TJAC, TJAP, TJRO, TJRR, TJTO, TJDF

---

## 🐛 Troubleshooting

### Problema: "Não encontrei jurisprudência"

**Possíveis causas:**
1. DataJud não retornou resultados para o termo buscado
2. Circuit breaker está aberto (3 falhas anteriores)
3. Google Search também não encontrou

**Solução:** Tente buscar um termo mais específico ou mencione um tribunal:
```
"Jurisprudência do STJ sobre [tema]"
```

### Problema: Chat demora muito

**Possíveis causas:**
1. Timeout de 5s foi excedido
2. Google Search fallback ativo (até 10s)

**Isso é normal:** O sistema não trava, apenas leva mais tempo em casos complexos.

### Problema: "Erro ao buscar jurisprudência"

**Possíveis causas:**
1. DataJud API CNJ temporariamente offline
2. Credenciais expiradas
3. Circuit breaker aberto

**Solução:** O sistema automaticamente usa Google Search como fallback. Se persistir, verifique logs do Render.

---

## 📊 Logs no Render.com

Acesse o dashboard do Render e procure por:

```bash
# Sucesso:
[DATAJUD] Buscando "dano moral"...
[DATAJUD] Retornou 8 resultado(s)
✅ [DATAJUD] Sucesso! Resetando circuit breaker

# Fallback:
[DATAJUD] Timeout após 5s
[FALLBACK] Ativando Google Search...
✅ [GOOGLE] Fallback retornou 10 resultado(s)

# Circuit Breaker:
⚠️ [CIRCUIT BREAKER] Falha 2/3
🔴 [CIRCUIT BREAKER] ABERTO! DataJud desabilitado por 60s
```

---

## ✅ Checklist de Validação

Após testar no chat, marque:

- [ ] Login funcionou
- [ ] Chat carregou normalmente
- [ ] Mensagem "Busque jurisprudência sobre [tema]" foi enviada
- [ ] SSE streaming mostrou progresso em tempo real
- [ ] Resposta veio em 3-5 segundos
- [ ] Chat não travou durante busca
- [ ] Resultados incluem:
  - [ ] Número de processo (formato CNJ)
  - [ ] Tribunal
  - [ ] Ementa
  - [ ] Data da decisão
- [ ] Fonte mencionada (DataJud CNJ ou Google Search)

**Se todos ✅ = INTEGRAÇÃO 100% FUNCIONAL!**

---

## 🎉 Resultado Esperado

### Antes:
❌ Sem DataJud CNJ
❌ Apenas Google Search (não oficial)
❌ Travava o chat (18s)

### Agora:
✅ **DataJud CNJ como prioridade** (fonte oficial)
✅ **39 tribunais** disponíveis
✅ **3-5 segundos** de resposta
✅ **SSE streaming** mantido
✅ **Circuit Breaker** protegendo
✅ **Google Search fallback** confiável

---

## 📞 Suporte

**Documentação Completa:**
- `DATAJUD-CHAT-INTEGRATION.md` - Guia completo
- `DATAJUD-QUICKSTART.md` - Guia rápido
- `TESTE-DEPLOY-DATAJUD.md` - Testes pós-deploy

**Commits Aplicados:**
- `0305bd1` - Fix: Export TRIBUNAL_ALIASES
- `941a631` - Feat: Integrate real DataJud CNJ service
- `cbd6ada` - Perf: Circuit Breaker + aggressive timeouts
- `f06fefb` - Docs: Complete integration guide

---

**Status:** ✅ **PRONTO PARA TESTE EM PRODUÇÃO**

**Teste agora em:** https://iarom.com.br

---

*Última atualização: 2026-02-12*
*Versão: 2.0.0*
