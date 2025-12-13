# Dockerfile para ROM Agent
FROM node:20-alpine

# Instalar dependências do sistema
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    cairo-dev \
    jpeg-dev \
    pango-dev \
    giflib-dev \
    pixman-dev

# Criar diretório de trabalho
WORKDIR /app

# Copiar package.json e package-lock.json
COPY package*.json ./

# Instalar dependências
RUN npm ci --only=production

# Copiar código fonte
COPY . .

# Criar diretórios necessários
RUN mkdir -p upload downloads logs processed extracted

# Expor porta
EXPOSE 3000

# Variável de ambiente
ENV NODE_ENV=production

# Comando de inicialização
CMD ["npm", "run", "web:enhanced"]
