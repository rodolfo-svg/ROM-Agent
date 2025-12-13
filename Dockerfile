# ═══════════════════════════════════════════════════════════════
# ROM AGENT - DOCKERFILE OTIMIZADO
# ═══════════════════════════════════════════════════════════════
# Multi-stage build para reduzir tamanho da imagem final
# ═══════════════════════════════════════════════════════════════

# ═══════════════════════════════════════════
# STAGE 1: Build e Dependências
# ═══════════════════════════════════════════
FROM node:20-alpine AS builder

# Instalar dependências de build
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    cairo-dev \
    jpeg-dev \
    pango-dev \
    giflib-dev \
    pixman-dev

WORKDIR /app

# Copiar apenas package files primeiro (cache layer)
COPY package*.json ./

# Instalar TODAS as dependências (incluindo devDependencies)
RUN npm ci

# Copiar código fonte
COPY . .

# Fazer build se necessário
# RUN npm run build --if-present

# ═══════════════════════════════════════════
# STAGE 2: Produção (imagem final menor)
# ═══════════════════════════════════════════
FROM node:20-alpine

# Instalar apenas runtime dependencies
RUN apk add --no-cache \
    cairo \
    jpeg \
    pango \
    giflib \
    pixman \
    tini

# Criar usuário não-root para segurança
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

WORKDIR /app

# Copiar apenas node_modules de produção do builder
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./

# Copiar código fonte
COPY --chown=nodejs:nodejs . .

# Criar diretórios necessários com permissões corretas
RUN mkdir -p upload downloads logs processed extracted KB && \
    chown -R nodejs:nodejs /app

# Mudar para usuário não-root
USER nodejs

# Expor porta
EXPOSE 3000

# Variáveis de ambiente
ENV NODE_ENV=production \
    PORT=3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/api/info', (res) => { process.exit(res.statusCode === 200 ? 0 : 1); })" || exit 1

# Usar tini como init system (proper signal handling)
ENTRYPOINT ["/sbin/tini", "--"]

# Comando de inicialização
CMD ["npm", "run", "web:enhanced"]
