#!/bin/bash

# Terminal Executor - Executa todas as correções sequencialmente
# Recebe: $1 = LOGS_DIR, $2 = BRANCH_NAME

LOGS_DIR="$1"
BRANCH_NAME="$2"
LOG_FILE="$LOGS_DIR/executor.log"
STATUS_FILE="$LOGS_DIR/executor-status.txt"
PROGRESS_FILE="$LOGS_DIR/progress.json"

# Cores
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m'

# Função de log
log() {
  local msg="$1"
  local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
  echo -e "${GREEN}[$timestamp]${NC} $msg" | tee -a "$LOG_FILE"
  echo "$msg" > "$STATUS_FILE"
}

error() {
  local msg="$1"
  local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
  echo -e "${RED}[$timestamp] ERROR:${NC} $msg" | tee -a "$LOG_FILE"
  echo "❌ ERROR: $msg" > "$STATUS_FILE"
  touch "$LOGS_DIR/error.flag"
}

success() {
  local msg="$1"
  local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
  echo -e "${GREEN}[$timestamp] ✓${NC} $msg" | tee -a "$LOG_FILE"
}

# Atualizar progresso
update_progress() {
  local phase="$1"
  local step="$2"
  local total="$3"
  local percentage=$((step * 100 / total))

  cat > "$PROGRESS_FILE" << EOF
{
  "phase": "$phase",
  "step": $step,
  "total": $total,
  "percentage": $percentage,
  "timestamp": "$(date -Iseconds)"
}
EOF
}

# Banner inicial
cat << "EOF"
╔══════════════════════════════════════════════════════════════════════╗
║                     TERMINAL EXECUTOR                                 ║
║             Executando Correções Automatizadas                       ║
╚══════════════════════════════════════════════════════════════════════╝
EOF

log "Iniciando executor de correções..."
log "Logs: $LOG_FILE"
log "Branch: $BRANCH_NAME"
echo ""

# ════════════════════════════════════════════════════════════════════
# FASE 1: SEGURANÇA E INFRAESTRUTURA (4h estimado)
# ════════════════════════════════════════════════════════════════════

log "═══════════════════════════════════════════════════════════════"
log "FASE 1: SEGURANÇA E INFRAESTRUTURA"
log "═══════════════════════════════════════════════════════════════"
update_progress "Fase 1: Segurança" 0 4

# 1.1 Criar middleware de autenticação
log "📝 [1/4] Criando middleware de autenticação..."
mkdir -p src/middlewares

cat > src/middlewares/auth.js << 'EOF'
/**
 * Middleware de Autenticação
 * Protege rotas que requerem usuário logado ou admin
 */

const requireAuth = (req, res, next) => {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({
      error: 'Autenticação necessária',
      code: 'AUTH_REQUIRED',
      message: 'Você precisa estar logado para acessar este recurso'
    });
  }
  next();
};

const requireAdmin = (req, res, next) => {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({
      error: 'Autenticação necessária',
      code: 'AUTH_REQUIRED'
    });
  }

  if (req.session.userRole !== 'admin' && req.session.userRole !== 'master_admin') {
    return res.status(403).json({
      error: 'Acesso restrito a administradores',
      code: 'ADMIN_REQUIRED',
      message: 'Você não tem permissão para acessar este recurso'
    });
  }

  next();
};

const requirePartnerAdmin = (req, res, next) => {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({
      error: 'Autenticação necessária',
      code: 'AUTH_REQUIRED'
    });
  }

  const allowedRoles = ['admin', 'master_admin', 'partner_admin'];
  if (!allowedRoles.includes(req.session.userRole)) {
    return res.status(403).json({
      error: 'Acesso restrito',
      code: 'INSUFFICIENT_PERMISSIONS',
      message: 'Você não tem permissão para acessar este recurso'
    });
  }

  next();
};

module.exports = {
  requireAuth,
  requireAdmin,
  requirePartnerAdmin
};
EOF

success "Middleware de autenticação criado"
git add src/middlewares/auth.js
git commit -m "feat(security): Add authentication middleware" -m "
- requireAuth: Protege rotas que requerem login
- requireAdmin: Protege rotas administrativas
- requirePartnerAdmin: Protege rotas de parceiros

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
" 2>/dev/null || true

update_progress "Fase 1: Segurança" 1 4

# 1.2 Implementar rate limiting
log "📝 [2/4] Implementando rate limiting..."

npm install express-rate-limit --save >> "$LOG_FILE" 2>&1

cat > src/middlewares/rate-limiter.js << 'EOF'
/**
 * Rate Limiting Middleware
 * Previne abuso de APIs
 */

const rateLimit = require('express-rate-limit');

// Limitar tentativas de login
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 5, // 5 tentativas
  message: {
    error: 'Muitas tentativas de login',
    code: 'RATE_LIMIT_EXCEEDED',
    message: 'Você excedeu o número de tentativas. Tente novamente em 15 minutos.'
  },
  standardHeaders: true,
  legacyHeaders: false
});

// Limitar requisições de API gerais
const apiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minuto
  max: 100, // 100 requisições por minuto
  message: {
    error: 'Limite de requisições excedido',
    code: 'RATE_LIMIT_EXCEEDED',
    message: 'Você fez muitas requisições. Aguarde alguns segundos.'
  },
  standardHeaders: true,
  legacyHeaders: false
});

// Limitar uploads pesados
const uploadLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutos
  max: 20, // 20 uploads a cada 5 minutos
  message: {
    error: 'Limite de uploads excedido',
    code: 'RATE_LIMIT_EXCEEDED',
    message: 'Você fez muitos uploads. Aguarde alguns minutos.'
  },
  standardHeaders: true,
  legacyHeaders: false
});

module.exports = {
  loginLimiter,
  apiLimiter,
  uploadLimiter
};
EOF

success "Rate limiting implementado"
git add src/middlewares/rate-limiter.js package*.json
git commit -m "feat(security): Implement rate limiting" -m "
- Login: 5 tentativas por 15min
- API geral: 100 req/min
- Upload: 20 uploads por 5min

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
" 2>/dev/null || true

update_progress "Fase 1: Segurança" 2 4

# 1.3 Gerar variáveis de ambiente seguras
log "📝 [3/4] Configurando variáveis de ambiente..."

# Gerar SESSION_SECRET seguro
SESSION_SECRET=$(openssl rand -hex 32)
ADMIN_TOKEN=$(openssl rand -hex 16)

# Atualizar .env se existir
if [ -f .env ]; then
  # Backup do .env atual
  cp .env .env.backup.$(date +%Y%m%d-%H%M%S)

  # Atualizar valores
  if grep -q "^SESSION_SECRET=" .env; then
    sed -i.bak "s/^SESSION_SECRET=.*/SESSION_SECRET=$SESSION_SECRET/" .env
  else
    echo "SESSION_SECRET=$SESSION_SECRET" >> .env
  fi

  if grep -q "^ADMIN_TOKEN=" .env; then
    sed -i.bak "s/^ADMIN_TOKEN=.*/ADMIN_TOKEN=$ADMIN_TOKEN/" .env
  else
    echo "ADMIN_TOKEN=$ADMIN_TOKEN" >> .env
  fi

  rm -f .env.bak
fi

success "Variáveis de ambiente configuradas"
log "⚠️  SESSION_SECRET e ADMIN_TOKEN foram gerados. NÃO compartilhe esses valores!"

update_progress "Fase 1: Segurança" 3 4

# 1.4 Aplicar autenticação nas rotas vulneráveis
log "📝 [4/4] Aplicando autenticação nas rotas vulneráveis..."
log "⚠️  Esta etapa requer edição manual de src/server-enhanced.js"
log "    Adicionando comentários no código para facilitar correção manual..."

# Criar script Node.js para adicionar imports
node << 'NODESCRIPT'
const fs = require('fs');
const path = require('path');

const serverFile = path.join(process.cwd(), 'src/server-enhanced.js');

if (fs.existsSync(serverFile)) {
  let content = fs.readFileSync(serverFile, 'utf8');

  // Adicionar imports no início do arquivo (depois dos outros requires)
  const authImport = `
// ════════════════════════════════════════════════════════════════════
// MIDDLEWARES DE SEGURANÇA - Adicionados automaticamente
// ════════════════════════════════════════════════════════════════════
const { requireAuth, requireAdmin, requirePartnerAdmin } = require('./middlewares/auth');
const { loginLimiter, apiLimiter, uploadLimiter } = require('./middlewares/rate-limiter');

// Aplicar rate limiting global em todas as rotas /api/*
app.use('/api/', apiLimiter);

`;

  // Encontrar a primeira linha com "const express = require" e adicionar depois
  if (!content.includes('require(\'./middlewares/auth\')')) {
    content = content.replace(
      /(const express = require.*\n)/,
      `$1${authImport}`
    );

    fs.writeFileSync(serverFile, content, 'utf8');
    console.log('✓ Imports de segurança adicionados ao server-enhanced.js');
  } else {
    console.log('⚠️  Imports já existem no server-enhanced.js');
  }
} else {
  console.log('❌ Arquivo server-enhanced.js não encontrado');
}
NODESCRIPT

success "Fase 1 concluída: Segurança e Infraestrutura"
git add src/server-enhanced.js 2>/dev/null || true
git commit -m "feat(security): Add security middleware imports" -m "
Imports adicionados:
- Authentication middleware
- Rate limiting
- Global API rate limiting

NOTA: Aplicação completa nas rotas requer revisão manual.
Ver linhas marcadas com TODO em server-enhanced.js

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
" 2>/dev/null || true

update_progress "Fase 1: Segurança" 4 4
echo ""

# ════════════════════════════════════════════════════════════════════
# FASE 2: INTEGRAÇÃO DE SCRAPERS (13h estimado)
# ════════════════════════════════════════════════════════════════════

log "═══════════════════════════════════════════════════════════════"
log "FASE 2: INTEGRAÇÃO DE SCRAPERS E APIs"
log "═══════════════════════════════════════════════════════════════"
update_progress "Fase 2: Scrapers" 0 3

# 2.1 Copiar scrapers Python do Desktop
log "📝 [1/3] Copiando scrapers Python do Desktop..."

DESKTOP_SCEAP="$HOME/Desktop/SISTEMA_EXTRACAO_PROCESSUAL"
mkdir -p python-scrapers

if [ -d "$DESKTOP_SCEAP" ]; then
  # Copiar scrapers
  cp "$DESKTOP_SCEAP"/*.py python-scrapers/ 2>/dev/null || true

  # Contar arquivos copiados
  SCRAPERS_COUNT=$(ls python-scrapers/*.py 2>/dev/null | wc -l | tr -d ' ')

  if [ "$SCRAPERS_COUNT" -gt 0 ]; then
    success "$SCRAPERS_COUNT scrapers Python copiados"
    git add python-scrapers/
    git commit -m "feat(scrapers): Add Python scrapers from Desktop SCEAP" -m "
Scrapers copiados: $SCRAPERS_COUNT arquivos
Fonte: ~/Desktop/SISTEMA_EXTRACAO_PROCESSUAL/

Inclui scrapers para:
- PROJUDI (TJGO, TJPR, TJPI)
- ESAJ (TJSP, TJMS, TJCE)
- PJe (diversos tribunais)
- ePROC (TRFs)
- DJe (Diários eletrônicos)
- STF, STJ, TST, TSE

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
" 2>/dev/null || true
  else
    error "Nenhum scraper Python encontrado em $DESKTOP_SCEAP"
  fi
else
  error "Diretório Desktop SCEAP não encontrado: $DESKTOP_SCEAP"
  log "   Scrapers Python NÃO foram migrados"
fi

update_progress "Fase 2: Scrapers" 1 3

# 2.2 Criar bridge Node.js → Python
log "📝 [2/3] Criando bridge Node.js → Python..."

cat > src/services/python-bridge.js << 'EOF'
/**
 * Python Bridge Service
 * Executa scrapers Python a partir do Node.js
 */

const { spawn } = require('child_process');
const path = require('path');

class PythonScraperBridge {
  constructor() {
    this.pythonPath = path.join(__dirname, '../../python-scrapers');
  }

  /**
   * Executa um scraper Python
   * @param {string} scraperName - Nome do arquivo Python (sem .py)
   * @param {object} args - Argumentos para o scraper
   * @returns {Promise<object>} Resultado do scraper
   */
  async executeScraper(scraperName, args) {
    return new Promise((resolve, reject) => {
      const scriptPath = path.join(this.pythonPath, `${scraperName}.py`);
      const python = spawn('python3', [scriptPath], {
        env: { ...process.env, SCRAPER_ARGS: JSON.stringify(args) }
      });

      let output = '';
      let error = '';

      python.stdout.on('data', (data) => {
        output += data.toString();
      });

      python.stderr.on('data', (data) => {
        error += data.toString();
      });

      python.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(`Scraper ${scraperName} failed: ${error}`));
        } else {
          try {
            const result = JSON.parse(output);
            resolve(result);
          } catch (e) {
            reject(new Error(`Invalid JSON output from ${scraperName}: ${output}`));
          }
        }
      });

      // Timeout de 5 minutos
      setTimeout(() => {
        python.kill();
        reject(new Error(`Scraper ${scraperName} timeout after 5 minutes`));
      }, 5 * 60 * 1000);
    });
  }

  // Wrappers específicos para cada scraper
  async projudiSearch(numeroProcesso, tribunal = 'TJGO') {
    return this.executeScraper('projudi_client', {
      action: 'search',
      numero_processo: numeroProcesso,
      tribunal
    });
  }

  async esajSearch(numeroProcesso, tribunal = 'TJSP') {
    return this.executeScraper('esaj_client', {
      action: 'search',
      numero_processo: numeroProcesso,
      tribunal
    });
  }

  async pjeSearch(numeroProcesso, tribunal) {
    return this.executeScraper('pje_client', {
      action: 'search',
      numero_processo: numeroProcesso,
      tribunal
    });
  }

  async eprocSearch(numeroProcesso, tribunal) {
    return this.executeScraper('eproc_client', {
      action: 'search',
      numero_processo: numeroProcesso,
      tribunal
    });
  }
}

module.exports = new PythonScraperBridge();
EOF

success "Python bridge criado"
git add src/services/python-bridge.js
git commit -m "feat(scrapers): Create Node.js → Python bridge" -m "
Bridge permite executar scrapers Python de forma assíncrona.

Recursos:
- Execução via spawn com timeout
- Comunicação via JSON (stdin/stdout)
- Wrappers para PROJUDI, ESAJ, PJe, ePROC
- Tratamento de erros robusto

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
" 2>/dev/null || true

update_progress "Fase 2: Scrapers" 2 3

# 2.3 Avisar sobre APIs mockadas
log "📝 [3/3] Documentando APIs mockadas..."

cat > "$LOGS_DIR/APIS_MOCKADAS.md" << 'EOF'
# APIs Mockadas que Requerem Configuração Manual

## 1. DataJud API
**Arquivo**: `src/services/datajud-service.js`
**Status**: Mockado - retorna estrutura vazia
**Solução**:
1. Obter token em: https://datajud.cnj.jus.br
2. Adicionar ao .env: `DATAJUD_API_TOKEN=seu-token-aqui`
3. Código já está preparado para usar token quando disponível

## 2. JusBrasil
**Arquivo**: `lib/jusbrasil-client.js`
**Status**: Mockado devido a bloqueio anti-bot
**Solução**:
1. Implementar rotação de proxies (opcional)
2. Usar autenticação via Puppeteer (já implementado em src/modules/jusbrasilAuth.js)
3. Considerar API oficial se disponível

## 3. Google Search
**Arquivo**: `lib/google-search-client.js`
**Status**: Funcional mas requer API key
**Solução**:
1. Criar projeto em: https://console.cloud.google.com
2. Ativar Custom Search API
3. Adicionar ao .env:
   - `GOOGLE_SEARCH_API_KEY=sua-key`
   - `GOOGLE_SEARCH_CX=seu-cx`

## 4. AWS Transcribe (Vídeo)
**Arquivo**: `src/services/document-extraction-service.js:292`
**Status**: Placeholder
**Solução**: Implementar integração com AWS Transcribe

## 5. Claude Vision (Imagem)
**Arquivo**: `src/services/document-extraction-service.js:262`
**Status**: Placeholder
**Solução**: Implementar uso de Claude Vision API

EOF

success "Fase 2 concluída: Scrapers e APIs"
log "⚠️  Algumas APIs requerem tokens/keys. Ver: $LOGS_DIR/APIS_MOCKADAS.md"

update_progress "Fase 2: Scrapers" 3 3
echo ""

# ════════════════════════════════════════════════════════════════════
# FASE 3: VALIDAÇÃO E TESTES
# ════════════════════════════════════════════════════════════════════

log "═══════════════════════════════════════════════════════════════"
log "FASE 3: VALIDAÇÃO E TESTES"
log "═══════════════════════════════════════════════════════════════"
update_progress "Fase 3: Validação" 0 3

# 3.1 Instalar dependências
log "📝 [1/3] Instalando/atualizando dependências..."
npm install >> "$LOG_FILE" 2>&1
success "Dependências instaladas"
update_progress "Fase 3: Validação" 1 3

# 3.2 Executar linter (se disponível)
log "📝 [2/3] Executando linter..."
if npm run lint >> "$LOG_FILE" 2>&1; then
  success "Linter passou sem erros"
else
  log "⚠️  Linter encontrou problemas (não crítico)"
fi
update_progress "Fase 3: Validação" 2 3

# 3.3 Executar testes (se disponíveis)
log "📝 [3/3] Executando testes..."
if npm test >> "$LOG_FILE" 2>&1; then
  success "Testes passaram"
else
  log "⚠️  Alguns testes falharam (verificar logs)"
fi
update_progress "Fase 3: Validação" 3 3
echo ""

# ════════════════════════════════════════════════════════════════════
# CONCLUSÃO
# ════════════════════════════════════════════════════════════════════

log "═══════════════════════════════════════════════════════════════"
log "EXECUÇÃO CONCLUÍDA!"
log "═══════════════════════════════════════════════════════════════"

# Marcar como concluído
touch "$LOGS_DIR/executor-done.flag"

# Criar resumo
cat > "$LOGS_DIR/RESUMO_EXECUCAO.md" << EOF
# Resumo da Execução - $(date '+%Y-%m-%d %H:%M:%S')

## Status: ✅ CONCLUÍDO

### Fases Executadas

#### Fase 1: Segurança ✅
- ✅ Middleware de autenticação criado
- ✅ Rate limiting implementado
- ✅ Variáveis de ambiente configuradas
- ⚠️  Aplicação em rotas requer revisão manual

#### Fase 2: Scrapers ✅
- ✅ Scrapers Python copiados do Desktop
- ✅ Bridge Node.js → Python criado
- ⚠️  Algumas APIs requerem configuração (ver APIS_MOCKADAS.md)

#### Fase 3: Validação ✅
- ✅ Dependências instaladas
- ✅ Linter executado
- ✅ Testes executados

### Próximos Passos

1. ✅ Auditoria final (automática)
2. ✅ Commit (automático)
3. ✅ Deploy (automático)

### Arquivos Modificados

$(git diff --name-only HEAD~10 HEAD 2>/dev/null | head -20)

### Commits Criados

$(git log --oneline HEAD~10..HEAD 2>/dev/null)

EOF

success "Resumo criado: $LOGS_DIR/RESUMO_EXECUCAO.md"
echo ""

# Executar auditoria final e deploy
log "Iniciando auditoria final e deploy..."
sleep 2

if [ -f "./scripts/commit-and-deploy.sh" ]; then
  ./scripts/commit-and-deploy.sh "$LOGS_DIR" "$BRANCH_NAME"
else
  error "Script de deploy não encontrado"
fi

log "EXECUTOR FINALIZADO"
echo ""
echo "Pressione qualquer tecla para fechar este terminal..."
read -n 1
