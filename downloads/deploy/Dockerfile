# ROM Agent - Dockerfile para Deploy em Cloud
#
# Funciona em: AWS ECS, Google Cloud Run, Azure, Railway, Render, etc.
#
# BUILD:
#   docker build -t rom-agent -f mobile-access/deploy/Dockerfile .
#
# RUN LOCAL:
#   docker run -p 3000:3000 --env-file .env rom-agent
#
# PUSH PARA REGISTRY:
#   docker tag rom-agent:latest seu-registry/rom-agent:latest
#   docker push seu-registry/rom-agent:latest

FROM node:20-slim

# Instalar dependências do sistema para OCR e PDF
RUN apt-get update && apt-get install -y \
    poppler-utils \
    tesseract-ocr \
    tesseract-ocr-por \
    pandoc \
    && rm -rf /var/lib/apt/lists/*

# Criar diretório da aplicação
WORKDIR /app

# Copiar package.json primeiro (para cache de camadas)
COPY package*.json ./

# Instalar dependências
RUN npm ci --only=production

# Copiar código da aplicação
COPY . .

# Criar pastas necessárias
RUN mkdir -p upload extracted processed logs

# Expor porta
EXPOSE 3000

# Variáveis de ambiente padrão
ENV NODE_ENV=production
ENV PORT=3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:3000/api/info || exit 1

# Iniciar servidor
CMD ["npm", "run", "web"]
