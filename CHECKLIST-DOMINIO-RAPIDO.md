# ✅ CHECKLIST RÁPIDO - Configuração iarom.com.br

## 🎯 PASSOS ESSENCIAIS (10 minutos)

### 1️⃣ NO RENDER.COM
```
✅ Login: https://dashboard.render.com
✅ Selecionar serviço: rom-agent
✅ Settings → Custom Domains
✅ Adicionar: iarom.com.br
✅ Adicionar: www.iarom.com.br
✅ ANOTAR os valores DNS fornecidos:

   Exemplo:
   A    @    216.24.57.1
   A    @    216.24.57.253
   CNAME www iarom.com.br
```

---

### 2️⃣ NO REGISTRO.BR
```
✅ Login: https://registro.br
✅ Painel de Controle
✅ Selecionar: iarom.com.br
✅ Menu: DNS → Editar Zona
✅ Adicionar registros (usar valores do Render):

   Tipo: A
   Nome: @ (deixar vazio)
   Valor: [IP1 do Render]
   TTL: 3600

   Tipo: A
   Nome: @ (deixar vazio)
   Valor: [IP2 do Render]
   TTL: 3600

   Tipo: CNAME
   Nome: www
   Valor: iarom.com.br
   TTL: 3600

✅ SALVAR alterações
```

---

### 3️⃣ AGUARDAR PROPAGAÇÃO
```
⏳ Tempo mínimo: 30 minutos
⏳ Tempo máximo: 48 horas
⏳ Média: 2-6 horas

✅ Testar: https://dnschecker.org
   → Digitar: iarom.com.br
   → Verificar IPs em múltiplos servidores
```

---

### 4️⃣ VALIDAR TUDO FUNCIONANDO
```
✅ Acessar: http://iarom.com.br
   → Deve redirecionar para HTTPS

✅ Acessar: https://iarom.com.br
   → Deve mostrar ROM Agent
   → Cadeado verde 🔒

✅ Acessar: www.iarom.com.br
   → Deve redirecionar

✅ Testar API:
   curl https://iarom.com.br/api/info
```

---

## 🔧 VALORES TÍPICOS DO RENDER

**Você receberá algo assim**:

```
┌─────────────────────────────────────┐
│ DNS Records to Add:                 │
├─────────────────────────────────────┤
│ Type    Name    Value               │
├─────────────────────────────────────┤
│ A       @       216.24.57.1        │
│ A       @       216.24.57.253      │
├─────────────────────────────────────┤
│ CNAME   www     iarom.com.br       │
└─────────────────────────────────────┘
```

**IMPORTANTE**: Use os valores EXATOS fornecidos pelo Render!

---

## 🚨 SE ALGO DER ERRADO

### DNS não propaga após 2 horas?
```bash
# Limpar cache DNS local
sudo dscacheutil -flushcache
sudo killall -HUP mDNSResponder
```

### SSL não ativa?
```
1. Aguardar mais tempo (até 24h)
2. No Render: remover e adicionar domínio novamente
3. Verificar se DNS está correto
```

### Site não carrega?
```
1. Verificar se service está rodando no Render
2. Verificar logs no Render
3. Testar URL direta do Render: rom-agent-xyz.onrender.com
```

---

## 📞 SUPORTE RÁPIDO

**Render**: https://render.com/support
**Registro.br**: 0800 887 0140

---

## ✅ CHECKLIST FINAL

- [ ] Adicionei iarom.com.br no Render
- [ ] Adicionei www.iarom.com.br no Render
- [ ] Anotei os valores DNS do Render
- [ ] Configurei registros A no Registro.br
- [ ] Configurei CNAME www no Registro.br
- [ ] Salvei alterações no Registro.br
- [ ] Aguardei propagação (mín. 30 min)
- [ ] Testei http://iarom.com.br (redireciona HTTPS)
- [ ] Testei https://iarom.com.br (funciona)
- [ ] Verifiquei SSL (cadeado verde)
- [ ] Testei APIs funcionando

**🎉 TUDO PRONTO!**

---

**Data**: 13/12/2024
**Tempo**: ~10 min configuração + 30 min-48h propagação
**Custo**: R$ 0,00 (SSL gratuito via Let's Encrypt)
