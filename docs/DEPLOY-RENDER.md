# 🚀 Guia de Deploy no Render.com

## Status Atual do Sistema

### ✅ Funcionando 100% Localmente

**Local**: http://localhost:3000

**APIs Testadas e Funcionando:**
- ✅ `/api/info` - Informações do sistema
- ✅ `/api/chat` - Chat com IA
- ✅ `/api/semantic-search` - Busca semântica (TF-IDF local)
- ✅ `/api/templates/list` - Lista de templates (2 templates disponíveis)
- ✅ `/api/backup/status` - Status de backups
- ✅ Frontend completo em português

**Último Commit:** `49bdba08` (incluindo remoção de auth e traduções)

---

## 🌐 Deploy no Render.com

### Passo 1: Criar Conta no Render

1. Acesse: https://render.com
2. Clique em **"Get Started for Free"**
3. Faça login com GitHub (recomendado)

### Passo 2: Conectar Repositório

1. No dashboard do Render, clique em **"New +"**
2. Selecione **"Web Service"**
3. Conecte seu repositório GitHub: `rodolfo-svg/ROM-Agent`
4. Autorize o Render a acessar o repositório

### Passo 3: Configurar o Serviço

O Render irá detectar automaticamente o arquivo `render.yaml` na raiz do projeto.

**Configurações automáticas do `render.yaml`:**
- **Nome**: rom-agent
- **Runtime**: Node.js
- **Plan**: Free
- **Build**: `npm ci --only=production`
- **Start**: `npm run web:enhanced`
- **Health Check**: `/api/info`

### Passo 4: Configurar Variáveis de Ambiente

No dashboard do Render, adicione as seguintes variáveis de ambiente:

#### Obrigatórias (AWS Bedrock):

```bash
AWS_ACCESS_KEY_ID=AKIA... (sua chave AWS)
AWS_SECRET_ACCESS_KEY=... (sua secret key AWS)
AWS_REGION=us-east-1
```

#### Opcionais:

```bash
# Anthropic (se quiser usar Claude diretamente)
ANTHROPIC_API_KEY=sk-ant-...

# DataJud (para consultas jurisprudência)
DATAJUD_API_KEY=...

# SESSION_SECRET (será gerado automaticamente)
```

### Passo 5: Deploy

1. Clique em **"Create Web Service"**
2. O Render começará o build automaticamente
3. Aguarde 5-10 minutos para o primeiro deploy
4. Você receberá uma URL tipo: `https://rom-agent.onrender.com`

---

## 📋 Checklist Pós-Deploy

### Testes Básicos:

```bash
# URL base (substitua pela sua URL do Render)
URL="https://rom-agent.onrender.com"

# 1. Testar health check
curl $URL/api/info

# 2. Testar frontend
curl $URL | head -20

# 3. Testar semantic search
curl -X POST $URL/api/semantic-search \
  -H "Content-Type: application/json" \
  -d '{"query":"direito","limit":5}'

# 4. Testar templates
curl $URL/api/templates/list

# 5. Testar backup status
curl $URL/api/backup/status
```

### Validações:

- [ ] Health check `/api/info` retorna JSON com status "healthy"
- [ ] Frontend carrega corretamente (logo ROM Agent visível)
- [ ] Chat funciona (envia mensagem e recebe resposta)
- [ ] Menu lateral "Avançado (ROM Only)" está visível
- [ ] Busca Semântica abre e funciona
- [ ] Templates lista 2 templates (Petição Inicial, Recurso de Apelação)
- [ ] Analytics dashboard abre em nova aba

---

## 🔧 Troubleshooting

### Problema: Build falha com "Cannot find module"

**Solução:**
```bash
# Localmente, teste o build de produção:
npm ci --only=production
npm run web:enhanced
```

### Problema: "Error: listen EADDRINUSE"

**Causa:** Porta já em uso
**Solução no Render:** Render define automaticamente `PORT=10000`, nenhuma ação necessária

### Problema: "AWS credentials not found"

**Solução:**
1. Vá em Settings > Environment
2. Adicione `AWS_ACCESS_KEY_ID` e `AWS_SECRET_ACCESS_KEY`
3. Clique em "Save Changes"
4. Faça um novo deploy manual

### Problema: APIs retornam erro 500

**Solução:**
1. Vá em Logs no dashboard do Render
2. Procure por erros no console
3. Verifique se todas as variáveis de ambiente estão configuradas
4. Verifique se o health check `/api/info` está funcionando

---

## 🎯 Domínio Customizado (Opcional)

### Passo 1: Comprar Domínio

Recomendações:
- **Registro.br** (para .br): https://registro.br
- **Namecheap**: https://namecheap.com
- **Google Domains**: https://domains.google

Sugestões de domínio:
- `iarom.com.br`
- `romagent.com.br`
- `agenterom.com.br`

### Passo 2: Configurar DNS

No painel do seu registrador de domínio, adicione:

**Tipo A** para domínio principal:
```
Host: @
Value: (IP fornecido pelo Render)
TTL: 3600
```

**CNAME** para www:
```
Host: www
Value: rom-agent.onrender.com
TTL: 3600
```

### Passo 3: Adicionar Domínio no Render

1. No dashboard do Render, vá em Settings
2. Clique em "Custom Domain"
3. Adicione: `iarom.com.br` e `www.iarom.com.br`
4. Aguarde propagação DNS (até 48h, geralmente 1-2h)

---

## 📊 Monitoramento

### Logs em Tempo Real:

No dashboard do Render:
1. Clique no serviço "rom-agent"
2. Vá na aba "Logs"
3. Veja logs em tempo real

### Métricas:

1. Acesse: `https://seu-dominio.onrender.com/analytics.html`
2. Veja métricas de:
   - Total de consultas
   - Tempo médio de resposta
   - Cache hit rate
   - Uso de modelos AI
   - Performance das Fases 4 & 5

---

## 💾 Backups

### Backups Automáticos:

- **Frequência**: Diário às 03:00
- **Retenção**: 7 dias
- **Localização**: `/var/data/backups` (disco persistente do Render)

### Backup Manual:

```bash
# Via API
curl -X POST https://seu-dominio.onrender.com/api/backup/create

# Ou via interface
# Vá em: Administração > Painel Admin > Criar Backup Manual
```

### Download de Backup:

```bash
curl -O https://seu-dominio.onrender.com/api/backup/download/rom-backup-2025-12-13.zip
```

---

## 🔐 Segurança

### Proteções Ativas:

- ✅ **Rate Limiting**: 10 req/min, 100 req/hora
- ✅ **CORS**: Configurado para domínio específico
- ✅ **Helmet.js**: Headers de segurança
- ✅ **Input Validation**: Sanitização de inputs
- ✅ **Session Secret**: Gerado automaticamente

### Recomendações:

1. **Não commitar** credentials no Git
2. Usar apenas variáveis de ambiente no Render
3. Rotacionar AWS keys regularmente (a cada 90 dias)
4. Monitorar logs para atividade suspeita

---

## 📈 Escalabilidade

### Plano Free do Render:

- ✅ **CPU**: Compartilhada
- ✅ **RAM**: 512 MB
- ✅ **Disco**: 1 GB persistente
- ✅ **Bandwidth**: 100 GB/mês
- ⚠️ **Sleep**: Após 15min de inatividade

### Quando Escalar:

Considere upgrade para plano pago ($7/mês) se:
- Mais de 100 usuários simultâneos
- Sleep mode inaceitável
- Precisar de mais RAM/CPU
- Backup > 1 GB

### Plano Starter ($7/mês):

- ✅ Sem sleep mode
- ✅ RAM: 512 MB (dedicado)
- ✅ CPU: Dedicado
- ✅ Disco: 1 GB

---

## ✅ Status Final

### Local (Desenvolvimento):
- ✅ **http://localhost:3000**
- ✅ Frontend 100% funcional
- ✅ Todas as APIs funcionando
- ✅ Interface em português
- ✅ Fases 1-5 implementadas

### Produção (Render.com):
- ⏳ **Aguardando deploy**
- ⏳ Configurar variáveis de ambiente
- ⏳ Adicionar domínio customizado (opcional)

---

## 🎉 Próximos Passos

1. ✅ Código está no GitHub
2. ⏳ Deploy no Render.com (siga Passo 1-5 acima)
3. ⏳ Configurar variáveis AWS
4. ⏳ Testar em produção (use checklist acima)
5. ⏳ Adicionar domínio customizado (opcional)

---

**Data de criação**: 13/12/2025
**Versão ROM Agent**: v2.7.0
**Última atualização**: Remoção de autenticação APIs públicas
**Commit**: `49bdba08`
