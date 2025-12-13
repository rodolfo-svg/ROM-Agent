# ROM Agent - Acesso Mobile

## Opções de Acesso via Smartphone

### 1. Rede Local (mais rápido)
```bash
./scripts/start-server.sh
```
Acesse `http://SEU_IP:3000` de qualquer dispositivo na mesma Wi-Fi.

### 2. Internet (ngrok)
```bash
./scripts/start-ngrok.sh
```
Gera URL pública para acesso de qualquer lugar.

### 3. PWA (App no Smartphone)
1. Acesse o servidor pelo navegador do smartphone
2. Clique em "Adicionar à tela inicial"
3. O ROM Agent vira um app!

### 4. Bot Telegram
```bash
node telegram-bot/bot.js
```
Use o ROM Agent diretamente pelo Telegram.

**Configuração:**
1. Fale com @BotFather no Telegram
2. Crie um bot: `/newbot`
3. Copie o token para `.env`: `TELEGRAM_BOT_TOKEN=seu_token`

### 5. Deploy em Cloud (acesso permanente)

**Render.com (gratuito):**
1. Push para GitHub
2. Conecte no render.com
3. O `render.yaml` configura tudo automaticamente

**Railway.app:**
1. Push para GitHub
2. Conecte no railway.app
3. Deploy automático

**Docker:**
```bash
docker build -t rom-agent -f deploy/Dockerfile .
docker run -p 3000:3000 --env-file .env rom-agent
```

## Estrutura de Arquivos

```
mobile-access/
├── scripts/
│   ├── start-server.sh    # Inicia servidor local
│   └── start-ngrok.sh     # Expõe para internet
├── telegram-bot/
│   └── bot.js             # Bot do Telegram
├── deploy/
│   ├── Dockerfile         # Container Docker
│   ├── render.yaml        # Deploy Render.com
│   └── railway.json       # Deploy Railway
└── pwa/
    └── (arquivos PWA em ../public/)
```

## Variáveis de Ambiente Necessárias

```env
# API Keys
ANTHROPIC_API_KEY=sk-...
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=...
AWS_REGION=us-east-1

# Telegram (opcional)
TELEGRAM_BOT_TOKEN=123456:ABC...
```

## Portas

- **3000**: Servidor Web
- **443**: HTTPS (ngrok/cloud)

## Suporte

Escritório: Rodolfo Otávio Mota - Advogados Associados
OAB/GO: 21.841
