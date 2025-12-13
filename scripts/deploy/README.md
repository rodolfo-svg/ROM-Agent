# 🛠️ Scripts de Deploy e Automação

Estes scripts facilitam o processo de deploy e configuração do ROM Agent.

---

## 📜 Scripts Disponíveis

### 1. `deploy-render.sh` - Deploy Automatizado

Prepara e faz deploy no Render.

**Uso:**
```bash
./scripts/deploy/deploy-render.sh
```

**O que faz:**
- ✅ Verifica estrutura do projeto
- ✅ Confirma arquivos necessários
- ✅ Verifica configuração Git
- ✅ Commita mudanças pendentes (opcional)
- ✅ Faz push para GitHub
- ✅ Mostra instruções para Render

**Quando usar:** Antes de fazer deploy inicial ou atualizar código.

---

### 2. `check-dns.sh` - Verificador de DNS

Testa configuração DNS completa.

**Uso:**
```bash
./scripts/deploy/check-dns.sh agente.rom.adv.br
```

**O que verifica:**
- ✅ Existência do domínio
- ✅ Nameservers (Cloudflare)
- ✅ Records DNS (A/CNAME)
- ✅ SSL/HTTPS funcionando
- ✅ Certificado válido
- ✅ Redirecionamento HTTP → HTTPS
- ✅ Tempo de resposta
- ✅ Headers de segurança
- ✅ Propagação global

**Quando usar:** Após configurar DNS ou quando site não carregar.

**Exemplo de Output:**
```
============================================
  Verificador de DNS - ROM Agent
============================================

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. Verificando existência do domínio...
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✓ Domínio existe e responde

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
2. Verificando Nameservers...
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✓ Nameservers apontam para Cloudflare
  → amber.ns.cloudflare.com
  → hugo.ns.cloudflare.com

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
3. Verificando tipo de DNS record...
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✓ CNAME encontrado
  → agente.rom.adv.br aponta para rom-agent.onrender.com
✓ Aponta para plataforma de hosting reconhecida

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
4. Verificando SSL/HTTPS...
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✓ HTTPS funciona (site responde)
✓ Certificado SSL válido
  Expira: Feb 15 2025
✓ Protegido pelo Cloudflare

... (continua)
```

---

## 🚀 Fluxo Completo de Deploy

### Primeira Vez

```bash
# 1. Preparar e fazer deploy
./scripts/deploy/deploy-render.sh

# 2. Aguardar deploy no Render (3-5 min)

# 3. Configurar DNS no Cloudflare
#    (Ver: CLOUDFLARE-PASSO-A-PASSO.md)

# 4. Aguardar propagação (2-6h)

# 5. Verificar configuração
./scripts/deploy/check-dns.sh agente.rom.adv.br
```

### Atualizações

```bash
# Fazer mudanças no código
git add .
git commit -m "Nova funcionalidade"

# Deploy automático
./scripts/deploy/deploy-render.sh

# Render detecta push e faz deploy automático
```

---

## 🔧 Requisitos

### Sistema Operacional

**Linux/Mac:** Funciona nativamente

**Windows:** Use WSL (Windows Subsystem for Linux)
```powershell
# Instalar WSL
wsl --install

# Depois use os scripts normalmente
```

### Ferramentas Necessárias

```bash
# Verificar se estão instaladas
which git
which dig
which curl
which openssl

# Se faltarem, instalar:
# Ubuntu/Debian
sudo apt update
sudo apt install git dnsutils curl openssl

# Mac (com Homebrew)
brew install git bind curl openssl
```

---

## 📊 Interpretando Resultados

### check-dns.sh

#### ✓ Tudo Verde
```
✓ Domínio existe e responde
✓ Nameservers apontam para Cloudflare
✓ HTTPS funciona
✓ Certificado SSL válido
```
**Significado:** Tudo configurado corretamente!

#### ⚠ Avisos Amarelos
```
⚠ Nameservers NÃO são do Cloudflare
⚠ HTTP não redireciona para HTTPS
```
**Ação:** Aguarde propagação ou ajuste configurações.

#### ✗ Erros Vermelhos
```
✗ Domínio não encontrado
✗ HTTPS não responde
```
**Ação:** Verificar configuração ou aguardar mais tempo.

---

## 🆘 Troubleshooting

### Script não executa

```bash
# Problema: Permission denied

# Solução:
chmod +x scripts/deploy/*.sh
```

### Comando 'dig' não encontrado

```bash
# Ubuntu/Debian
sudo apt install dnsutils

# Mac
brew install bind
```

### DNS ainda não propagou

```bash
# Normal! Aguarde 2-6 horas (até 48h)

# Verificar propagação global:
./scripts/deploy/check-dns.sh seu-dominio.com.br

# Online:
https://dnschecker.org
```

---

## 📝 Customização

### Adicionar Seus Próprios Checks

Edite `check-dns.sh`:

```bash
# Adicionar verificação customizada
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "9. Verificando minha API..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if curl -s https://$DOMAIN/api/status | grep -q "ok"; then
    print_success "API respondendo corretamente"
else
    print_error "API não responde"
fi
```

---

## 🎯 Boas Práticas

### 1. Antes de Deploy

```bash
# Testar localmente primeiro
npm run web:enhanced

# Verificar se tudo funciona
# Depois fazer deploy
```

### 2. Após Deploy

```bash
# Sempre verificar DNS após mudanças
./scripts/deploy/check-dns.sh seu-dominio.com

# Testar no navegador
# Verificar logs no Render
```

### 3. Monitoramento

```bash
# Agendar verificação periódica (cron)
# Executar a cada 6 horas:

crontab -e

# Adicionar:
0 */6 * * * /caminho/para/scripts/deploy/check-dns.sh agente.rom.adv.br >> /var/log/rom-dns-check.log 2>&1
```

---

## 📚 Ver Também

- **DEPLOY-RENDER-PASSO-A-PASSO.md** - Guia detalhado Render
- **CLOUDFLARE-PASSO-A-PASSO.md** - Guia detalhado Cloudflare
- **DOMINIO-GUIDE.md** - Guia completo de domínios
- **DEPLOY.md** - Guia geral de deploy

---

**Scripts criados para facilitar sua vida! 🚀**

Dúvidas? Abra uma issue no GitHub.
