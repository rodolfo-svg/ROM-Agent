# 🚀 INÍCIO RÁPIDO - ROM-AGENT

**Como iniciar trabalho conectado a tudo de uma vez**

---

## 📋 MÉTODO 1: PROMPT AUTOMÁTICO (MAIS FÁCIL)

Quando abrir uma nova sessão do Claude Code, **copie e cole isto**:

```
Estou no projeto ROM-Agent localizado em ~/Desktop/ROM-Agent.

Por favor, leia o arquivo .claude/CLAUDE.md e execute as verificações de inicialização:

1. Verificar conexões (GitHub, Render, site iarom.com.br)
2. Confirmar status do repositório (branch, commits, alterações)
3. Verificar ambiente (.env, node_modules)
4. Resumir status de todas as integrações

Depois me dê um resumo completo e aguarde instruções.
```

**O Claude Code vai automaticamente:**
- ✅ Ler o arquivo `.claude/CLAUDE.md`
- ✅ Executar todas as verificações
- ✅ Te dar um resumo completo do status
- ✅ Ficar pronto para trabalhar conectado a tudo

---

## 📋 MÉTODO 2: SCRIPT SHELL (MAIS RÁPIDO)

Abra o terminal e execute:

```bash
cd ~/Desktop/ROM-Agent
source .claude/init.sh
```

**Isso vai verificar automaticamente:**
- GitHub (autenticação e usuário)
- Git (branch, commits, alterações)
- Render CLI (autenticação e serviços)
- Site (iarom.com.br online?)
- Node.js (node_modules, .env)
- Versões de todas as ferramentas

**Resultado:** Resumo completo em 2 segundos!

---

## 📋 MÉTODO 3: PROMPT CURTO

Se quiser algo mais direto, cole isto:

```
Projeto: ROM-Agent em ~/Desktop/ROM-Agent

Verifique e conecte:
- GitHub (rodolfo-svg)
- Render (serviço iarom)
- Site: https://iarom.com.br
- Git: status e branch
- Ambiente: .env e node_modules

Resumo rápido e aguarde.
```

---

## 🎯 O QUE CADA MÉTODO FAZ

Todos os métodos verificam:

### 1. **GitHub**
- ✅ Autenticado como rodolfo-svg?
- ✅ Token válido?
- ✅ Acesso ao repositório ROM-Agent?

### 2. **Git Local**
- ✅ Branch atual
- ✅ Último commit
- ✅ Alterações não commitadas
- ✅ Sincronizado com remote?

### 3. **Render**
- ✅ CLI autenticado?
- ✅ Serviço "iarom" detectado?
- ✅ Status do último deploy
- ✅ Logs disponíveis?

### 4. **Site/API**
- ✅ https://iarom.com.br online?
- ✅ API respondendo?
- ✅ Status HTTP 200?

### 5. **Ambiente Node**
- ✅ node_modules instalado?
- ✅ .env configurado?
- ✅ Variáveis críticas presentes?

---

## 💡 EXEMPLO DE USO COMPLETO

### Cenário: Você quer corrigir um bug

**1. Abra o Claude Code:**
```bash
claude
```

**2. Cole o prompt de inicialização:**
```
Estou no projeto ROM-Agent localizado em ~/Desktop/ROM-Agent.
Leia .claude/CLAUDE.md e execute verificações de inicialização.
Depois resumir status e aguardar.
```

**3. O Claude responde:**
```
✅ AMBIENTE ROM-AGENT VERIFICADO

GitHub: ✅ Autenticado como rodolfo-svg
Git: ✅ Branch main, limpo, sem alterações
Render: ✅ Autenticado, serviço iarom online
Site: ✅ https://iarom.com.br respondendo (200 OK)
Node: ✅ node_modules instalado, .env configurado

Último commit: feat: adicionar validação de login (2h atrás)

Tudo pronto! Qual tarefa deseja realizar?
```

**4. Você pede:**
```
Corrija o bug de timeout na API de jurisprudência
```

**5. Claude trabalha conectado:**
- Lê o código
- Identifica o problema
- Faz as correções
- Comita automaticamente via git
- Faz push para GitHub
- Abre PR se necessário
- Faz deploy no Render se você pedir

---

## 🔧 CONFIGURAÇÃO INICIAL (FAZER UMA VEZ)

Se esta é a primeira vez, configure:

### 1. **Render CLI**
```bash
npm install -g render-cli
render login
```

### 2. **Variáveis de Ambiente**
```bash
cd ~/Desktop/ROM-Agent
cp .env.example .env
# Editar .env com suas chaves
```

### 3. **Dependências**
```bash
npm install
```

**Depois disso, nunca mais precisa configurar!**

---

## 📊 CHECKLIST PÓS-INICIALIZAÇÃO

Após executar o prompt/script, você deve ver:

- [ ] ✅ GitHub autenticado (rodolfo-svg)
- [ ] ✅ Git: branch conhecido, status claro
- [ ] ✅ Render: autenticado, serviço listado
- [ ] ✅ Site: online (200 OK)
- [ ] ✅ Node: modules e .env presentes
- [ ] ✅ Claude confirmou "tudo pronto"

**Se todos ✅ = PRONTO PARA TRABALHAR!**

---

## 🆘 TROUBLESHOOTING

### "GitHub não autenticado"
```bash
gh auth login
```

### "Render não autenticado"
```bash
render login
```

### "node_modules não encontrado"
```bash
npm install
```

### ".env não encontrado"
```bash
cp .env.example .env
# Editar e adicionar suas chaves
```

### "Site offline"
- Verificar Render Dashboard
- Ver logs: `render logs -f`
- Verificar último deploy: `render deploys list`

---

## 🎯 RESUMO - COMEÇAR AGORA

**Copie este prompt e cole no Claude Code:**

```
Projeto ROM-Agent em ~/Desktop/ROM-Agent.
Leia .claude/CLAUDE.md e verifique todas as conexões.
Resumo de status e aguarde instruções.
```

**OU execute no terminal:**

```bash
cd ~/Desktop/ROM-Agent && source .claude/init.sh
```

**Pronto! 🎉**

---

**Última atualização:** 23/04/2026
**Versão Claude Code:** 2.1.1
**Repositório:** rodolfo-svg/ROM-Agent
