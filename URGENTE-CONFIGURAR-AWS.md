# 🚨 URGENTE: CONFIGURAR AWS NO RENDER

**Status**: ❌ **IA NÃO VAI FUNCIONAR SEM ISSO**
**Tempo**: 5 minutos
**Quando**: **AGORA** (enquanto Render faz build)

---

## ⚡ PASSO A PASSO RÁPIDO

### 1️⃣ Abrir Render Dashboard
```
https://dashboard.render.com
```

### 2️⃣ Selecionar Serviço
- Clicar em: **"rom-agent"** (ou nome do seu serviço)

### 3️⃣ Ir em Environment
- Menu lateral esquerdo
- Clicar em: **"Environment"**

### 4️⃣ Adicionar Variáveis (uma por uma)

#### Variável 1: AWS_ACCESS_KEY_ID
```
Key: AWS_ACCESS_KEY_ID
Value: (abrir arquivo .env local e copiar o valor)
```

**Como copiar do .env:**
```bash
# No terminal:
grep AWS_ACCESS_KEY_ID .env

# Copiar o valor depois do =
# Exemplo: AKIAIOSFODNN7EXAMPLE
```

#### Variável 2: AWS_SECRET_ACCESS_KEY
```
Key: AWS_SECRET_ACCESS_KEY
Value: (copiar do .env local)
```

```bash
# No terminal:
grep AWS_SECRET_ACCESS_KEY .env

# Copiar o valor depois do =
# Exemplo: wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
```

#### Variável 3: AWS_REGION
```
Key: AWS_REGION
Value: us-east-1
```
*(Sempre us-east-1)*

#### Variável 4: CNJ_DATAJUD_API_KEY (opcional mas recomendado)
```
Key: CNJ_DATAJUD_API_KEY
Value: (copiar do .env se tiver)
```

```bash
# No terminal:
grep CNJ_DATAJUD_API_KEY .env

# Se não tiver, pode pular por enquanto
```

### 5️⃣ Salvar
- Clicar em: **"Save Changes"** ou **"Add"** (para cada variável)

### 6️⃣ Aguardar Redeploy
- Render vai automaticamente fazer redeploy
- Aguardar ~2-3 minutos
- Ver progresso em **"Logs"**

---

## 📋 CHECKLIST

```
RENDER DASHBOARD:
- [ ] Abrir https://dashboard.render.com
- [ ] Selecionar serviço "rom-agent"
- [ ] Clicar em "Environment"
- [ ] Adicionar AWS_ACCESS_KEY_ID (do .env)
- [ ] Adicionar AWS_SECRET_ACCESS_KEY (do .env)
- [ ] Adicionar AWS_REGION=us-east-1
- [ ] Adicionar CNJ_DATAJUD_API_KEY (se tiver)
- [ ] Salvar
- [ ] Aguardar redeploy (~3 min)

VERIFICAÇÃO:
- [ ] Ir em "Logs" no Render
- [ ] Ver mensagem "Live at: https://..."
- [ ] Testar: https://iarom.com.br/api/info
- [ ] Verificar: "aws": {"configured": true}
```

---

## 🔍 COMO SABER SE DEU CERTO

### Teste 1: API Info
```bash
curl https://iarom.com.br/api/info
```

**Deve retornar:**
```json
{
  "success": true,
  "version": "2.4.13",
  "aws": {
    "configured": true,    ← ISSO AQUI!
    "region": "us-east-1"
  }
}
```

### Teste 2: Chat
```bash
curl -X POST https://iarom.com.br/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message":"teste","model":"haiku"}'
```

**Deve retornar:** Resposta da IA (não erro 500)

---

## ❌ ERROS COMUNS

### Erro 1: "Could not load credentials"
**Causa:** Variáveis não foram adicionadas ou estão incorretas

**Solução:**
1. Verificar se TODAS as 3 variáveis AWS foram adicionadas
2. Verificar se valores estão corretos (sem espaços extras)
3. Fazer redeploy manual: "Manual Deploy" → "Deploy latest commit"

### Erro 2: Logs mostram erro de sintaxe
**Causa:** Valor da variável tem caracteres especiais não escapados

**Solução:**
1. Copiar valor exatamente do .env
2. Não adicionar aspas extras
3. Apenas o valor puro

### Erro 3: Site continua com versão antiga
**Causa:** Build ainda não terminou ou falhou

**Solução:**
1. Ver Logs do Render
2. Aguardar mensagem "Live at..."
3. Se falhou, verificar erro nos logs
4. Fazer redeploy manual se necessário

---

## 🎯 RESULTADO ESPERADO

Após adicionar as variáveis:

```
✅ AWS Bedrock conectado
✅ IA funcionando (Claude Haiku/Sonnet/Opus)
✅ Chat respondendo
✅ Todas as 113+ APIs ativas
✅ Projeto ROM Agent carregando
✅ DataJud integration ativa
✅ Sistema de correção de português funcionando
```

---

## ⏱️ LINHA DO TEMPO

| Momento | Ação | Status |
|---------|------|--------|
| Agora | Código v2.4.13 no GitHub | ✅ Feito |
| +1 min | Render detecta push | ⏳ Automático |
| +2 min | Build iniciando | ⏳ Automático |
| +3 min | **VOCÊ ADICIONA VARIÁVEIS** | ⚠️ **FAÇA AGORA** |
| +5 min | Redeploy com variáveis | ⏳ Automático |
| +8 min | Site atualizado e funcionando | ✅ Pronto |

---

## 📞 ONDE ESTÃO AS CREDENCIAIS?

### Arquivo local:
```bash
# Está no arquivo .env na raiz do projeto
cat .env | grep AWS

# Deve mostrar:
# AWS_ACCESS_KEY_ID=AKIA...
# AWS_SECRET_ACCESS_KEY=wJal...
# AWS_REGION=us-east-1
```

### Se não tiver .env:
```bash
# Criar .env com as credenciais AWS Bedrock
# Obter em: https://console.aws.amazon.com/iam/
```

---

## 🔐 SEGURANÇA

⚠️ **IMPORTANTE:**
- NUNCA commitar .env no git (já está no .gitignore)
- NUNCA compartilhar credenciais AWS publicamente
- Usar apenas no Render Dashboard (ambiente seguro)
- Render criptografa variáveis de ambiente automaticamente

---

## 💡 DICA PRO

Depois de adicionar as variáveis pela primeira vez, elas ficam salvas no Render.

**Você NUNCA mais vai precisar fazer isso novamente!**

Daqui para frente:
- `git push` → Render auto-deploys → Tudo funciona
- Zero configuração manual
- Zero intervenção
- 100% automático

---

**PRÓXIMO PASSO AGORA:**
1. Abrir: https://dashboard.render.com
2. Environment
3. Adicionar 3 variáveis AWS
4. Aguardar 3 minutos
5. Testar: https://iarom.com.br/api/info

---

**Data**: 15/12/2025
**Prioridade**: 🔴 **CRÍTICA**
**Tempo**: 5 minutos
**Impacto**: Todo o sistema de IA depende disso
