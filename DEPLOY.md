# Guia de Deploy - ROM Agent Web

Este guia contém instruções para fazer deploy da aplicação web ROM Agent em diferentes plataformas.

## 🚀 Funcionalidades da Versão Web Melhorada

- ✅ Upload de arquivos (PDF, DOCX, TXT)
- ✅ Histórico de conversas persistente
- ✅ Formatação Markdown nas respostas
- ✅ Tema dark/light (salvado localmente)
- ✅ Autenticação básica de usuários
- ✅ Interface responsiva e moderna
- ✅ Animações e transições suaves

## 📋 Pré-requisitos

- Node.js 20 ou superior
- Chave API da Anthropic (Claude)

## 🏠 Executar Localmente

### Versão Básica
```bash
npm run web
```

### Versão Melhorada (Recomendado)
```bash
npm run web:enhanced
```

Acesse: http://localhost:3000

## ☁️ Deploy em Plataformas Cloud

### 1. Render (Recomendado - Grátis)

#### Via Dashboard:
1. Acesse [render.com](https://render.com) e crie uma conta
2. Clique em "New +" → "Web Service"
3. Conecte seu repositório GitHub/GitLab
4. Configure:
   - **Name**: rom-agent
   - **Environment**: Node
   - **Build Command**: `npm install`
   - **Start Command**: `npm run web:enhanced`
   - **Plan**: Free

#### Variáveis de Ambiente:
- `ANTHROPIC_API_KEY`: Sua chave da API Anthropic
- `SESSION_SECRET`: Uma string aleatória para sessões
- `NODE_ENV`: production
- `PORT`: 10000 (Render usa esta porta)

#### Via render.yaml (Automático):
```bash
# O arquivo render.yaml já está configurado
# Apenas conecte seu repositório no Render
```

### 2. Railway (Fácil e Rápido)

1. Acesse [railway.app](https://railway.app)
2. Clique em "New Project"
3. Selecione "Deploy from GitHub repo"
4. Configure as variáveis de ambiente:
   - `ANTHROPIC_API_KEY`
   - `SESSION_SECRET`
   - `NODE_ENV=production`

Railway detectará automaticamente o `railway.json` e configurará tudo.

### 3. Vercel (Serverless)

```bash
# Instalar Vercel CLI
npm i -g vercel

# Deploy
vercel

# Deploy para produção
vercel --prod
```

Configure as variáveis de ambiente no dashboard da Vercel.

### 4. Heroku

```bash
# Criar app
heroku create rom-agent-app

# Configurar variáveis
heroku config:set ANTHROPIC_API_KEY=sua_chave
heroku config:set SESSION_SECRET=secret_aleatorio
heroku config:set NODE_ENV=production

# Deploy
git push heroku main
```

### 5. Docker (Qualquer Plataforma)

```bash
# Build da imagem
docker build -t rom-agent .

# Rodar container
docker run -d \
  -p 3000:3000 \
  -e ANTHROPIC_API_KEY=sua_chave \
  -e SESSION_SECRET=secret \
  -e NODE_ENV=production \
  --name rom-agent \
  rom-agent

# Verificar logs
docker logs -f rom-agent
```

### 6. AWS EC2 / DigitalOcean / VPS

```bash
# No servidor
git clone seu-repositorio
cd ROM-Agent

# Instalar dependências
npm install --production

# Configurar .env
cp .env.example .env
nano .env  # Adicionar ANTHROPIC_API_KEY

# Iniciar com PM2 (gerenciador de processos)
npm install -g pm2
pm2 start npm --name rom-agent -- run web:enhanced
pm2 save
pm2 startup

# Configurar Nginx como proxy reverso (opcional)
sudo nano /etc/nginx/sites-available/rom-agent
```

Exemplo de configuração Nginx:
```nginx
server {
    listen 80;
    server_name seu-dominio.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

## 🔒 Segurança em Produção

### 1. Variáveis de Ambiente
Nunca commite o arquivo `.env`. Use variáveis de ambiente da plataforma.

### 2. HTTPS
Configure SSL/TLS:
- **Render/Railway/Vercel**: SSL automático
- **VPS**: Use Certbot (Let's Encrypt)
  ```bash
  sudo certbot --nginx -d seu-dominio.com
  ```

### 3. Autenticação
A versão atual tem autenticação básica demonstrativa. Para produção:
- Implemente JWT ou OAuth2
- Use bcrypt para hash de senhas
- Configure rate limiting
- Adicione CSRF protection

### 4. Limitação de Taxa
Adicione rate limiting para prevenir abuso:
```bash
npm install express-rate-limit
```

### 5. Monitoramento
Configure logs e monitoramento:
- **Render**: Logs integrados
- **VPS**: PM2 logs, Grafana, Prometheus

## 🌍 Domínio Customizado

### Render/Railway/Vercel:
1. Acesse as configurações do projeto
2. Adicione domínio customizado
3. Configure DNS:
   - **Tipo**: CNAME
   - **Nome**: @ ou www
   - **Valor**: URL fornecida pela plataforma

### Cloudflare (Recomendado):
1. Adicione seu domínio ao Cloudflare
2. Configure DNS para apontar para a plataforma
3. Ative proxy do Cloudflare (nuvem laranja)
4. Benefícios: CDN, DDoS protection, SSL grátis

## 📊 Monitoramento e Analytics

### Logs
```bash
# Render
render logs -f

# Railway
railway logs

# Heroku
heroku logs --tail

# Docker
docker logs -f rom-agent

# PM2
pm2 logs rom-agent
```

### Métricas
Configure monitoramento:
- New Relic (APM)
- Datadog
- Sentry (erros)
- Google Analytics (frontend)

## 🔧 Manutenção

### Atualizar Aplicação
```bash
git pull origin main
npm install
npm run web:enhanced

# Com PM2
pm2 restart rom-agent

# Docker
docker-compose down
docker-compose up -d --build
```

### Backup
Importante fazer backup de:
- Configurações (`.env`)
- Arquivos uploadados (`/upload`)
- Logs (`/logs`)
- Dados de sessão (se persistentes)

## 🐛 Troubleshooting

### Erro: "API Key não configurada"
```bash
# Verificar variável de ambiente
echo $ANTHROPIC_API_KEY

# Configurar (se vazio)
export ANTHROPIC_API_KEY=sua_chave
```

### Erro: "Cannot find module"
```bash
# Reinstalar dependências
rm -rf node_modules package-lock.json
npm install
```

### Erro: "Port already in use"
```bash
# Encontrar processo usando a porta
lsof -i :3000

# Matar processo
kill -9 PID
```

### Erro de Upload
```bash
# Verificar permissões da pasta
chmod -R 755 upload/
```

## 📝 Checklist de Deploy

- [ ] Código commitado no GitHub/GitLab
- [ ] `.env.example` atualizado (sem chaves reais)
- [ ] Variáveis de ambiente configuradas na plataforma
- [ ] `NODE_ENV=production` configurado
- [ ] `SESSION_SECRET` gerado (aleatório)
- [ ] HTTPS configurado
- [ ] Domínio customizado (opcional)
- [ ] Monitoramento configurado
- [ ] Backup configurado
- [ ] Documentação atualizada

## 🎯 Recomendações por Caso de Uso

### Desenvolvimento/Teste
- **Render (Free)** ou **Railway (Free)**: Perfeito para testes

### Produção - Pequeno/Médio
- **Render (Paid)** ou **Railway (Pro)**: Gerenciamento fácil, SSL automático

### Produção - Grande Escala
- **AWS ECS/Fargate** ou **Google Cloud Run**: Escalabilidade automática

### Self-Hosted
- **VPS (DigitalOcean/Linode)** com **Docker**: Controle total

## 💰 Custos Estimados

| Plataforma | Plano Free | Plano Pago | Notas |
|------------|------------|------------|-------|
| Render | ✅ 750h/mês | $7/mês | Sleep após inatividade (free) |
| Railway | ✅ $5 crédito | $5-20/mês | Pay per use |
| Vercel | ✅ | $20/mês | Serverless, pode ter cold starts |
| Heroku | ❌ | $7/mês | Descontinuou plano free |
| DigitalOcean | ❌ | $6/mês | VPS básico |

## 🆘 Suporte

- GitHub Issues: [seu-repositorio/issues]
- Email: contato@rom.adv.br
- Documentação: [docs.rom.adv.br]

---

**Nota**: Este é um projeto educacional. Para uso em produção com dados sensíveis, implemente medidas de segurança adicionais e consulte um especialista em segurança.
