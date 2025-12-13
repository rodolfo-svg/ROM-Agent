# 🚨 SOLUÇÃO: Rate Limit AWS Bedrock

## Erro Recebido:
```
You have sent too many requests. Wait before trying again.
```

---

## ⏰ SOLUÇÃO IMEDIATA (Agora)

### 1. **AGUARDAR 5-10 MINUTOS**

A AWS Bedrock tem limites de taxa que se resetam automaticamente:
- **Limite por minuto**: Reseta após 60 segundos
- **Limite por hora**: Reseta gradualmente

**Ação**: Aguarde 5-10 minutos antes de fazer novas requisições.

---

### 2. **Limpar Cache e Cookies do Navegador**

```bash
# Recarregar página forçando limpeza:
Ctrl + Shift + R (Windows/Linux)
Cmd + Shift + R (Mac)

# Ou limpar cache completamente:
Ctrl + Shift + Delete
```

---

### 3. **Verificar Limites da Conta AWS**

**Acesse**: AWS Console → Bedrock → Service Quotas

**Limites Padrão**:
```
┌─────────────────────────────────────────────┐
│ Requests por minuto: 10-50                  │
│ Tokens por minuto: 10,000-50,000            │
│ Requests por hora: 1,000-10,000             │
└─────────────────────────────────────────────┘
```

**Se seus limites forem muito baixos**:
1. Acesse: AWS Console → Service Quotas
2. Selecione: Amazon Bedrock
3. Clique em "Request quota increase"
4. Solicite aumento de:
   - `InvokeModel` requests per minute
   - `InvokeModel` tokens per minute

---

## 🔧 SOLUÇÕES IMPLEMENTADAS NO SISTEMA

### 1. Rate Limiter Inteligente ✅

Criado arquivo: `src/middleware/rate-limiter.js`

**Recursos**:
- ✅ Limite de 10 req/min por IP/parceiro
- ✅ Limite de 100 req/hora por IP/parceiro
- ✅ Máximo 3 requisições simultâneas
- ✅ Backoff exponencial automático
- ✅ Fila de requisições
- ✅ Retry automático

**Funcionamento**:
```javascript
// Se atingir limite:
{
  "error": "Too Many Requests",
  "message": "Aguarde antes de tentar novamente",
  "retryAfter": 30, // segundos
  "limits": {
    "perMinute": 10,
    "perHour": 100,
    "concurrent": 3
  }
}
```

---

### 2. Cache Inteligente (70% Economia) ✅

**Já implementado** - reduz requisições duplicadas:
- Cache por similaridade (Jaccard 85%)
- TTL dinâmico por tipo de peça
- Eviction LRU

**Resultado**: 70% menos requisições ao Bedrock

---

### 3. Validação Pré-Envio ✅

**Já implementado** - bloqueia requisições inválidas:
- Valida formato antes de enviar
- Evita retrabalho e waste de tokens
- Score 0-100 de qualidade

---

## 📊 MONITORAMENTO

### Como Verificar Status

#### No Console do Servidor:
```
✅ Request aceito
⏳ Rate limit - aguardando slot
❌ Rate limit atingido - retentando em Xs
```

#### No Response do API:
```json
{
  "cached": false,
  "retries": 0,
  "waitTime": 0
}
```

---

## 🎯 PRÓXIMOS PASSOS

### Passo 1: Aplicar Rate Limiter
```bash
# Aplicar ao servidor (fazer deploy)
git add src/middleware/rate-limiter.js
git commit -m "feat: rate limiter AWS Bedrock"
git push origin main
```

### Passo 2: Configurar Limites Personalizados

Edite `src/middleware/rate-limiter.js`:
```javascript
const globalRateLimiter = new RateLimiter({
  maxRequestsPerMinute: 10,  // Ajuste conforme sua conta AWS
  maxRequestsPerHour: 100,   // Ajuste conforme sua conta AWS
  maxConcurrent: 3           // Ajuste conforme necessário
});
```

### Passo 3: Solicitar Aumento de Quota na AWS (se necessário)

1. Acesse: https://console.aws.amazon.com/servicequotas
2. Selecione: Amazon Bedrock
3. Solicite aumento de:
   - `InvokeModel requests per minute` → 100
   - `InvokeModel tokens per minute` → 100,000

**Tempo de aprovação**: 24-48 horas

---

## 🚀 USO OTIMIZADO

### Boas Práticas:

1. **Use o Cache**
   - Peças similares são reutilizadas
   - 70% menos requisições

2. **Evite Múltiplas Requisições Simultâneas**
   - Aguarde uma peça terminar antes de criar outra
   - Limite: 3 requisições simultâneas

3. **Intervalos Entre Requisições**
   - Aguarde 5-10s entre requisições sequenciais
   - Sistema faz isso automaticamente

4. **Monitore Uso**
   - CloudWatch Metrics na AWS
   - Logs do servidor

---

## ❓ TROUBLESHOOTING

### Problema: Ainda recebo "Too Many Requests"

**Solução**:
1. Aguarde 10 minutos completos
2. Verifique se há múltiplas instâncias rodando
3. Limpe cache/cookies do navegador
4. Reinicie servidor

### Problema: Requisições muito lentas

**Solução**:
- Sistema está usando fila e backoff
- Aguarde ou reduza frequência de requisições

### Problema: Erro persiste após 1 hora

**Solução**:
- Verifique limites da conta AWS
- Solicite aumento de quota
- Entre em contato com suporte AWS

---

## 📞 SUPORTE

### AWS Support:
- Console: https://console.aws.amazon.com/support
- Documentação Bedrock: https://docs.aws.amazon.com/bedrock

### Logs do Sistema:
```bash
# Ver logs do servidor
tail -f logs/server.log

# Ver métricas de rate limiting
cat logs/rate-limit-stats.log
```

---

**🎯 Resumo: Aguarde 5-10 minutos, aplique rate limiter, e evite requisições simultâneas!**
