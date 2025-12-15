# ✅ CHECKLIST COMPLETO DE DEPLOY AUTOMÁTICO

## 🎯 Sistema de Preservação de Progresso

Este documento garante que **TODO o progresso seja preservado** em TODAS as plataformas.

---

## 1️⃣ GITHUB (Código-Fonte) - AUTOMÁTICO ✅

### Como funciona:
```bash
# Ao fazer commit e push:
git add .
git commit -m "✨ Nova feature"
git push origin main

# GitHub recebe automaticamente:
✅ Todo o código atualizado
✅ Histórico completo de commits
✅ Branches e tags
✅ Issues e PRs
```

### Verificar:
- ✅ GitHub Actions rodando (ver tab "Actions")
- ✅ Último commit visível no repositório
- ✅ Arquivos atualizados

**Status**: ✅ **AUTOMÁTICO via git push**

---

## 2️⃣ RENDER (Deploy em Produção) - AUTO-DEPLOY ✅

### Como funciona:
```
Push para GitHub → Render detecta → Deploy automático

Sequência:
1. Você faz git push origin main
2. Render detecta mudança no GitHub
3. Executa: npm ci --only=production
4. Inicia: npm run web:enhanced
5. Deploy completo em ~2-3 minutos
```

### Configuração Render (Fazer UMA VEZ):

#### A. Auto-Deploy
- ✅ Já está ativo no `render.yaml`: `autoDeploy: true`

#### B. Variáveis de Ambiente (IMPORTANTE! ⚠️)
No Dashboard do Render → Environment:

```bash
AWS_ACCESS_KEY_ID=(copiar do .env local)
AWS_SECRET_ACCESS_KEY=(copiar do .env local)
AWS_REGION=us-east-1
CNJ_DATAJUD_API_KEY=(copiar do .env local)
NODE_ENV=production
PORT=10000
```

#### C. Domínio iarom.com.br
1. No Render → Settings → Custom Domains
2. Adicionar: `iarom.com.br` e `www.iarom.com.br`
3. Copiar valores DNS fornecidos
4. Configurar no Registro.br (DNS):
   ```
   Tipo: A
   Nome: @
   Valor: (IP fornecido pelo Render)

   Tipo: CNAME
   Nome: www
   Valor: iarom.com.br
   ```
5. Aguardar propagação (24-48h)

**Status Atual**:
- ✅ Auto-deploy configurado
- ⚠️  Variáveis precisam ser adicionadas manualmente
- ⚠️  Domínio precisa DNS no Registro.br

---

## 3️⃣ AWS BEDROCK (IA) - SEMPRE ATIVO ✅

### Como funciona:
- **Não precisa deploy!** AWS Bedrock é um serviço gerenciado
- Suas credenciais (configuradas no Render) conectam automaticamente
- Modelos sempre disponíveis:
  - ✅ Claude Haiku
  - ✅ Claude Sonnet 4.5
  - ✅ Claude Opus

### Verificar:
```bash
# Testar conexão AWS:
curl https://iarom.com.br/api/info
# Deve retornar: "aws": {"configured": true}
```

**Status**: ✅ **SEMPRE ATIVO** (não requer deploy)

---

## 4️⃣ DOMÍNIO iarom.com.br - CONFIGURAÇÃO DNS 🌐

### Status Atual:
- ✅ Configurado no `render.yaml`
- ⚠️  Aguardando configuração DNS

### Passos para ativar:

1. **No Render Dashboard**:
   - Settings → Custom Domains
   - Já deve estar listado: `iarom.com.br`
   - Copiar o valor fornecido (IP ou CNAME)

2. **No Registro.br**:
   - Login em registro.br
   - Meus Domínios → iarom.com.br → Editar Zona DNS
   - Adicionar registros:
     ```
     @    A      (IP do Render)
     www  CNAME  iarom.com.br
     ```
   - Salvar

3. **Aguardar**: 2-48 horas para propagação

4. **Testar**:
   ```bash
   dig iarom.com.br
   curl https://iarom.com.br/api/info
   ```

**Status**: ⚠️ **AGUARDANDO configuração DNS**

---

## 5️⃣ MOBILE - VIA DOMÍNIO 📱

### Como funciona:
- Quando `iarom.com.br` estiver ativo, mobile acessa automaticamente
- PWA instalável no celular
- Interface responsiva funciona em qualquer dispositivo

### Testar:
1. Abrir `https://iarom.com.br` no celular
2. Funcionalidades:
   - ✅ Chat com IA
   - ✅ Upload de documentos
   - ✅ Calculadora de tarifação (`/tarifa.html`)
   - ✅ Timbrado de documentos

**Status**: ⏳ **DEPENDE do domínio** estar ativo

---

## 🔄 FLUXO COMPLETO DE DEPLOY AUTOMÁTICO

```
┌─────────────┐
│  VOCÊ FAZ   │
│  git push   │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│   GITHUB    │ ← Código salvo AQUI
│  (origem)   │
└──────┬──────┘
       │ (webhook automático)
       ▼
┌─────────────┐
│   RENDER    │ ← Deploy AUTOMÁTICO
│  (produção) │    1. npm ci
└──────┬──────┘    2. npm run web:enhanced
       │            3. Logs disponíveis
       ▼
┌─────────────┐
│ AWS BEDROCK │ ← Conectado via credenciais
│     (IA)    │    Sempre disponível
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ iarom.com.br│ ← Domínio (após DNS)
│   (domínio) │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│   MOBILE    │ ← Acesso via domínio
│  (usuários) │
└─────────────┘
```

---

## 📋 CHECKLIST RÁPIDO

### Fazer AGORA (uma única vez):

- [ ] **Render Environment**:
  ```
  1. https://dashboard.render.com → ROM Agent
  2. Environment → Add Environment Variable
  3. Adicionar: AWS_ACCESS_KEY_ID (copiar do .env)
  4. Adicionar: AWS_SECRET_ACCESS_KEY (copiar do .env)
  5. Adicionar: AWS_REGION=us-east-1
  6. Adicionar: CNJ_DATAJUD_API_KEY (copiar do .env)
  ```

- [ ] **DNS do Domínio**:
  ```
  1. Render → Settings → Custom Domains
  2. Copiar IP/CNAME do iarom.com.br
  3. registro.br → Editar zona DNS
  4. Adicionar registros A e CNAME
  5. Aguardar 24h
  ```

### Daqui pra frente (AUTOMÁTICO):

- [x] **Git push** → GitHub atualiza automaticamente
- [x] **GitHub** → Render deploya automaticamente
- [x] **Render** → Conecta com AWS Bedrock automaticamente
- [x] **AWS Bedrock** → Modelos sempre disponíveis
- [ ] **Domínio** → Ativo após DNS propagar
- [ ] **Mobile** → Funciona via domínio

---

## 🎉 RESULTADO FINAL

Após configurar as variáveis e o DNS **UMA ÚNICA VEZ**:

### Você faz:
```bash
git add .
git commit -m "Nova feature"
git push origin main
```

### Sistema faz AUTOMATICAMENTE:
```
✅ GitHub salva código
✅ Render detecta mudança
✅ Render faz build
✅ Render faz deploy
✅ AWS Bedrock conecta
✅ iarom.com.br atualiza
✅ Mobile funciona
```

**Tempo total**: ~2-3 minutos do push até produção ✨

---

## 🔍 COMO VERIFICAR SE ESTÁ TUDO FUNCIONANDO

### 1. GitHub
```bash
git log -1  # Ver último commit
# Ir em https://github.com/rodolfo-svg/ROM-Agent
# Verificar se commit está lá
```

### 2. Render
```bash
# Ver logs em tempo real:
# https://dashboard.render.com → ROM Agent → Logs
```

### 3. Produção
```bash
# Testar API:
curl https://(seu-app).onrender.com/api/info

# Após DNS configurado:
curl https://iarom.com.br/api/info
```

### 4. Mobile
```
Abrir no celular: https://iarom.com.br
Testar: Upload, Chat, Tarifação
```

---

## 🆘 TROUBLESHOOTING

### "Render não está fazendo deploy automático"
```bash
# Verificar:
1. render.yaml tem `autoDeploy: true`? ✅
2. GitHub conectado no Render? Ver Settings → GitHub
3. Logs de deploy: Dashboard → Logs
```

### "Erro de credenciais AWS"
```bash
# Verificar:
1. Environment variables configuradas no Render?
2. Valores corretos? (copiar do .env local)
3. Reiniciar serviço após adicionar variáveis
```

### "Domínio não funciona"
```bash
# Verificar:
1. DNS propagou? dig iarom.com.br
2. SSL ativo? (Render configura automaticamente)
3. Aguardar até 48h para propagação completa
```

---

## 📞 STATUS ATUAL

| Item | Status | Ação Necessária |
|------|--------|-----------------|
| GitHub | ✅ Funcionando | Nenhuma (automático) |
| GitHub Actions | ✅ Configurado | Nenhuma (roda no push) |
| Render Auto-Deploy | ✅ Ativo | Nenhuma (automático) |
| Variáveis Ambiente | ⚠️ Faltando | **Adicionar no Dashboard** |
| AWS Bedrock | ✅ Pronto | Depende das variáveis |
| Domínio iarom.com.br | ⚠️ Aguardando | **Configurar DNS** |
| Mobile | ⏳ Aguardando | Depende do domínio |

---

## 🎯 RESUMO

**Já está funcionando AUTOMATICAMENTE**:
- ✅ Git push → GitHub
- ✅ GitHub → Render deploy
- ✅ Código sempre preservado

**Precisa configurar UMA VEZ** (no Dashboard):
- ⚠️ Variáveis de ambiente
- ⚠️ DNS do domínio

**Depois disso**: 🚀 **100% AUTOMÁTICO!**

---

**Última atualização**: 15/12/2025
**Versão**: v2.7.0
