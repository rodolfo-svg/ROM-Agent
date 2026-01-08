# PLANO GLOBAL DE CORREÇÃO - ROM-Agent v2.8.0
## Data: 2026-01-08
## Estratégia de Resolução Completa

---

## 📊 SUMÁRIO EXECUTIVO

Este documento detalha o plano completo de correção de todos os problemas identificados na auditoria forense do sistema ROM-Agent. O plano está dividido em **4 FASES** e será executado por um **SISTEMA ORQUESTRADOR** que coordenará múltiplos terminais para correção paralela.

### Escopo Total
- **Problemas Críticos**: 4
- **Problemas de Segurança**: 3 (40+ rotas vulneráveis)
- **APIs Mockadas**: 7
- **Scrapers a Migrar**: 10
- **TODOs Pendentes**: 60+
- **Tempo Estimado Total**: 12-16 horas de desenvolvimento

---

## 🎯 FASE 1: SEGURANÇA E INFRAESTRUTURA (PRIORIDADE P0)

### Objetivo
Resolver vulnerabilidades críticas de segurança e garantir que o sistema tenha autenticação adequada.

### Tarefas

#### 1.1 Adicionar Autenticação em Rotas Vulneráveis
**Arquivo**: `src/server-enhanced.js`
**Linhas**: 3339-3914 (40+ rotas)

**Estratégia**:
```javascript
// Criar middleware de autenticação robusto
const requireAuth = (req, res, next) => {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({
      error: 'Autenticação necessária',
      code: 'AUTH_REQUIRED'
    });
  }
  next();
};

const requireAdmin = (req, res, next) => {
  if (!req.session || !req.session.userRole || req.session.userRole !== 'admin') {
    return res.status(403).json({
      error: 'Acesso restrito a administradores',
      code: 'ADMIN_REQUIRED'
    });
  }
  next();
};

// Aplicar em TODAS as rotas identificadas
app.get('/api/admin/users', requireAdmin, (req, res) => {
  // código existente
});
```

**Rotas a Proteger**:
1. `/api/admin/*` - Requer admin
2. `/api/prompts/system/*` - Requer admin
3. `/api/kb/*` - Requer auth
4. `/api/conversations/*` - Requer auth
5. `/api/rom-project/*` - Requer auth
6. `/api/case-processor/*` - Requer auth

**Estimativa**: 2 horas

#### 1.2 Configurar Variáveis de Ambiente Críticas
**Arquivo**: `.env`

**Ações**:
1. Gerar `SESSION_SECRET` seguro (32+ caracteres aleatórios)
2. Gerar `ADMIN_TOKEN` seguro
3. Configurar `DATABASE_URL` para PostgreSQL
4. Configurar `REDIS_URL` para cache
5. Validar `AWS_*` credentials
6. Validar `ANTHROPIC_API_KEY`

**Script de Validação**:
```bash
#!/bin/bash
# scripts/validate-env.sh

required_vars=(
  "SESSION_SECRET"
  "ADMIN_TOKEN"
  "DATABASE_URL"
  "ANTHROPIC_API_KEY"
  "AWS_ACCESS_KEY_ID"
  "AWS_SECRET_ACCESS_KEY"
  "AWS_REGION"
)

for var in "${required_vars[@]}"; do
  if [ -z "${!var}" ]; then
    echo "❌ Variável $var não configurada"
    exit 1
  fi
done

echo "✅ Todas as variáveis críticas estão configuradas"
```

**Estimativa**: 1 hora

#### 1.3 Implementar Rate Limiting
**Arquivo**: `src/middlewares/rate-limiter.js` (criar)

**Código**:
```javascript
const rateLimit = require('express-rate-limit');

// Limitar requisições de login
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 5, // 5 tentativas
  message: 'Muitas tentativas de login. Tente novamente em 15 minutos.'
});

// Limitar requisições de API gerais
const apiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minuto
  max: 100, // 100 requisições por minuto
  message: 'Limite de requisições excedido. Tente novamente em breve.'
});

module.exports = { loginLimiter, apiLimiter };
```

**Aplicar em**:
- `/api/auth/login` - loginLimiter
- `/api/*` - apiLimiter

**Estimativa**: 1 hora

---

## 🔌 FASE 2: INTEGRAÇÃO DE SCRAPERS E APIs (PRIORIDADE P0)

### Objetivo
Substituir APIs mockadas por implementações reais e migrar scrapers Python.

### Tarefas

#### 2.1 Integrar Scrapers Python via Child Process
**Estratégia**: Criar bridge Node.js → Python para reutilizar código existente

**Arquivo**: `src/services/python-bridge.js` (criar)

**Código**:
```javascript
const { spawn } = require('child_process');
const path = require('path');

class PythonScraperBridge {
  constructor() {
    this.pythonPath = path.join(__dirname, '../../python-scrapers');
  }

  async executeScraper(scraperName, args) {
    return new Promise((resolve, reject) => {
      const scriptPath = path.join(this.pythonPath, `${scraperName}.py`);
      const python = spawn('python3', [scriptPath, JSON.stringify(args)]);

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
          reject(new Error(`Scraper failed: ${error}`));
        } else {
          try {
            resolve(JSON.parse(output));
          } catch (e) {
            reject(new Error(`Invalid JSON output: ${output}`));
          }
        }
      });
    });
  }

  // Scrapers específicos
  async projudiSearch(numeroProcesso, tribunal) {
    return this.executeScraper('projudi_client', {
      action: 'search',
      numero_processo: numeroProcesso,
      tribunal
    });
  }

  async esajSearch(numeroProcesso, tribunal) {
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
}

module.exports = new PythonScraperBridge();
```

**Migrar Scrapers**:
1. Copiar arquivos Python de `Desktop/SISTEMA_EXTRACAO_PROCESSUAL/` para `ROM-Agent/python-scrapers/`
2. Adaptar scrapers para aceitar argumentos JSON via stdin
3. Retornar resultados como JSON via stdout
4. Criar wrapper Node.js para cada scraper

**Estimativa**: 6 horas

#### 2.2 Implementar DataJud API Real
**Arquivo**: `src/services/datajud-service.js`

**Passos**:
1. Obter token de API do DataJud (https://datajud.cnj.jus.br)
2. Configurar `DATAJUD_API_TOKEN` no .env
3. Substituir funções mockadas por chamadas reais

**Código**:
```javascript
async buscarProcessos(params) {
  const { numero, tribunal, dtInicial, dtFinal } = params;

  if (!process.env.DATAJUD_API_TOKEN) {
    throw new Error('DATAJUD_API_TOKEN não configurado');
  }

  const response = await fetch('https://api-publica.datajud.cnj.jus.br/api_publica_processo/_search', {
    method: 'POST',
    headers: {
      'Authorization': `ApiKey ${process.env.DATAJUD_API_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      query: {
        bool: {
          must: [
            numero ? { match: { numeroProcesso: numero } } : null,
            tribunal ? { match: { tribunal: tribunal } } : null,
            dtInicial ? { range: { dataAjuizamento: { gte: dtInicial } } } : null,
            dtFinal ? { range: { dataAjuizamento: { lte: dtFinal } } } : null
          ].filter(Boolean)
        }
      }
    })
  });

  if (!response.ok) {
    throw new Error(`DataJud API error: ${response.statusText}`);
  }

  const data = await response.json();
  return this.formatarResultados(data);
}
```

**Estimativa**: 3 horas

#### 2.3 Resolver Bloqueio Anti-Bot do JusBrasil
**Arquivo**: `lib/jusbrasil-client.js`

**Estratégia**:
1. Implementar rotação de User-Agents
2. Adicionar delays aleatórios entre requisições
3. Usar proxy rotation (opcional)
4. Implementar retry com backoff exponencial

**Código**:
```javascript
const userAgents = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36'
];

async searchWithRetry(query, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      // Delay aleatório entre 1-3 segundos
      await this.sleep(1000 + Math.random() * 2000);

      const userAgent = userAgents[Math.floor(Math.random() * userAgents.length)];

      const response = await fetch(this.buildSearchUrl(query), {
        headers: {
          'User-Agent': userAgent,
          'Accept': 'text/html,application/xhtml+xml',
          'Accept-Language': 'pt-BR,pt;q=0.9',
          'Referer': 'https://www.jusbrasil.com.br'
        }
      });

      if (response.status === 429) {
        // Rate limited, wait longer
        await this.sleep(5000 * (i + 1));
        continue;
      }

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      return await this.parseSearchResults(await response.text());
    } catch (error) {
      if (i === maxRetries - 1) throw error;
    }
  }
}
```

**Estimativa**: 4 horas

---

## 🎨 FASE 3: FRONTEND E UI (PRIORIDADE P1)

### Objetivo
Reconstruir/localizar arquivos do frontend e garantir funcionalidade completa.

### Tarefas

#### 3.1 Localizar ou Reconstruir Arquivos TSX
**Diretório**: `frontend/src/`

**Opções**:
1. **Se arquivos foram apenas movidos**: Localizar e restaurar
2. **Se foram deletados**: Reconstruir baseado em `public/` (HTML buildado)
3. **Se não foram comitados**: Recuperar de backup ou reescrever

**Script de Verificação**:
```bash
#!/bin/bash
# scripts/check-frontend.sh

echo "Verificando frontend..."

# Verificar se existe build
if [ -d "public/assets" ]; then
  echo "✅ Build do frontend existe"
else
  echo "❌ Build do frontend não encontrado"
fi

# Verificar arquivos fonte
tsx_count=$(find frontend/src -name "*.tsx" 2>/dev/null | wc -l)
if [ "$tsx_count" -gt 0 ]; then
  echo "✅ Encontrados $tsx_count arquivos TSX"
else
  echo "❌ Nenhum arquivo TSX encontrado - RECONSTRUÇÃO NECESSÁRIA"
fi

# Verificar package.json
if [ -f "frontend/package.json" ]; then
  echo "✅ frontend/package.json existe"
else
  echo "❌ frontend/package.json não encontrado"
fi
```

**Se reconstrução for necessária**:
1. Analisar estrutura HTML em `public/*.html`
2. Identificar componentes necessários
3. Reescrever usando React + TypeScript + Tailwind
4. Conectar com APIs do backend

**Estimativa**: 8 horas (se reconstrução completa)

#### 3.2 Implementar Testes de Frontend
**Framework**: Vitest + Testing Library

**Arquivo**: `frontend/src/__tests__/App.test.tsx` (criar)

**Código**:
```typescript
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import App from '../App';

describe('App', () => {
  it('deve renderizar sem erros', () => {
    render(<App />);
    expect(screen.getByRole('main')).toBeInTheDocument();
  });

  it('deve exibir tela de login quando não autenticado', () => {
    render(<App />);
    expect(screen.getByText(/login/i)).toBeInTheDocument();
  });
});
```

**Estimativa**: 4 horas

---

## 🚀 FASE 4: FUNCIONALIDADES AVANÇADAS (PRIORIDADE P2)

### Objetivo
Implementar recursos avançados que estão como placeholders.

### Tarefas

#### 4.1 Implementar AWS Transcribe para Vídeos
**Arquivo**: `src/services/document-extraction-service.js`
**Linha**: 292

**Código**:
```javascript
const AWS = require('aws-sdk');
const transcribe = new AWS.TranscribeService({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION
});

async processVideo(filePath) {
  const jobName = `transcribe-${Date.now()}`;

  // Upload para S3 primeiro
  const s3Url = await this.uploadToS3(filePath);

  // Iniciar job de transcrição
  await transcribe.startTranscriptionJob({
    TranscriptionJobName: jobName,
    LanguageCode: 'pt-BR',
    Media: {
      MediaFileUri: s3Url
    },
    OutputBucketName: process.env.AWS_S3_BUCKET
  }).promise();

  // Aguardar conclusão (polling)
  const result = await this.waitForTranscription(jobName);

  return {
    text: result.results.transcripts[0].transcript,
    metadata: {
      duration: result.results.duration,
      language: result.results.language_code
    }
  };
}
```

**Estimativa**: 3 horas

#### 4.2 Implementar Claude Vision para Análise de Imagens
**Arquivo**: `src/services/document-extraction-service.js`
**Linha**: 262

**Código**:
```javascript
const Anthropic = require('@anthropic-ai/sdk');
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
});

async processImage(imageBuffer, mimeType) {
  const base64Image = imageBuffer.toString('base64');

  const message = await anthropic.messages.create({
    model: 'claude-3-5-sonnet-20241022',
    max_tokens: 4096,
    messages: [{
      role: 'user',
      content: [
        {
          type: 'image',
          source: {
            type: 'base64',
            media_type: mimeType,
            data: base64Image
          }
        },
        {
          type: 'text',
          text: 'Analise esta imagem e extraia todo o texto, tabelas e informações relevantes. Se for um documento jurídico, identifique partes, números de processo, datas, etc.'
        }
      ]
    }]
  });

  return {
    text: message.content[0].text,
    metadata: {
      model: message.model,
      tokens: {
        input: message.usage.input_tokens,
        output: message.usage.output_tokens
      }
    }
  };
}
```

**Estimativa**: 2 horas

#### 4.3 Implementar Sistema de Jurimetria
**Arquivo**: `src/services/jurimetria-service.js`

**Funcionalidades**:
1. Análise estatística de decisões
2. Taxa de sucesso por tipo de ação
3. Tempo médio de tramitação
4. Distribuição por magistrado
5. Análise de valores de condenação

**Estimativa**: 8 horas

---

## 🔄 FASE 5: REFATORAÇÃO E OTIMIZAÇÃO (PRIORIDADE P3)

### Objetivo
Limpar código duplicado, resolver TODOs e otimizar performance.

### Tarefas

#### 5.1 Unificar server.js e server-enhanced.js
**Problema**: Código duplicado entre dois arquivos de servidor

**Estratégia**:
1. Identificar rotas duplicadas
2. Mover lógica compartilhada para módulos separados
3. Manter apenas um arquivo de servidor principal
4. Criar sistema de plugins para extensões

**Estimativa**: 4 horas

#### 5.2 Resolver 60+ TODOs
**Script para Listar**:
```bash
#!/bin/bash
# scripts/list-todos.sh

echo "=== TODOs no código ==="
grep -rn "TODO" src/ lib/ --exclude-dir=node_modules | wc -l
echo ""
echo "Detalhes:"
grep -rn "TODO" src/ lib/ --exclude-dir=node_modules | head -20
```

**Priorizar**:
1. TODOs de segurança (auth, validação)
2. TODOs de funcionalidade core
3. TODOs de melhorias

**Estimativa**: 6 horas

#### 5.3 Adicionar Testes Automatizados
**Framework**: Jest

**Cobertura Mínima**:
- Services: 80%
- Routes: 70%
- Utilities: 90%

**Estimativa**: 12 horas

---

## 🎛️ SISTEMA ORQUESTRADOR MULTI-TERMINAL

### Arquitetura

O sistema orquestrador coordenará a execução paralela de todas as correções utilizando múltiplos terminais.

### Componentes

#### Terminal 1: Orquestrador Principal
**Responsabilidade**: Coordenar, monitorar e reportar progresso

**Arquivo**: `scripts/orchestrator.sh`

```bash
#!/bin/bash

# Cores para output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Diretório de logs
LOGS_DIR="./logs/orchestrator-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$LOGS_DIR"

# Função de log
log() {
  echo -e "${GREEN}[$(date +%H:%M:%S)]${NC} $1" | tee -a "$LOGS_DIR/main.log"
}

error() {
  echo -e "${RED}[$(date +%H:%M:%S)] ERROR:${NC} $1" | tee -a "$LOGS_DIR/main.log"
}

warn() {
  echo -e "${YELLOW}[$(date +%H:%M:%S)] WARN:${NC} $1" | tee -a "$LOGS_DIR/main.log"
}

# Banner
cat << "EOF"
╔══════════════════════════════════════════════════════════════╗
║         ROM-Agent Orchestrator v1.0.0                         ║
║         Sistema de Correção Automatizada                      ║
╚══════════════════════════════════════════════════════════════╝
EOF

log "Iniciando orquestração de correções..."
log "Logs salvos em: $LOGS_DIR"

# Iniciar terminais de trabalho
log "Iniciando Terminal 2: Segurança..."
osascript -e 'tell app "Terminal" to do script "cd '$PWD' && ./scripts/terminal-security.sh"' &
TERM2_PID=$!

log "Iniciando Terminal 3: Scrapers..."
osascript -e 'tell app "Terminal" to do script "cd '$PWD' && ./scripts/terminal-scrapers.sh"' &
TERM3_PID=$!

log "Iniciando Terminal 4: Frontend..."
osascript -e 'tell app "Terminal" to do script "cd '$PWD' && ./scripts/terminal-frontend.sh"' &
TERM4_PID=$!

log "Iniciando Terminal 5: Refatoração..."
osascript -e 'tell app "Terminal" to do script "cd '$PWD' && ./scripts/terminal-refactor.sh"' &
TERM5_PID=$!

# Monitorar progresso
while true; do
  clear

  echo "╔══════════════════════════════════════════════════════════════╗"
  echo "║         STATUS DA ORQUESTRAÇÃO                                ║"
  echo "╚══════════════════════════════════════════════════════════════╝"
  echo ""

  echo "Terminal 2 (Segurança):    $(cat $LOGS_DIR/terminal2-status.txt 2>/dev/null || echo 'Iniciando...')"
  echo "Terminal 3 (Scrapers):     $(cat $LOGS_DIR/terminal3-status.txt 2>/dev/null || echo 'Iniciando...')"
  echo "Terminal 4 (Frontend):     $(cat $LOGS_DIR/terminal4-status.txt 2>/dev/null || echo 'Iniciando...')"
  echo "Terminal 5 (Refatoração):  $(cat $LOGS_DIR/terminal5-status.txt 2>/dev/null || echo 'Iniciando...')"
  echo ""

  # Verificar se todos terminaram
  if [ -f "$LOGS_DIR/all-done.flag" ]; then
    log "Todas as correções concluídas!"
    break
  fi

  sleep 5
done

# Gerar relatório final
log "Gerando relatório final..."
./scripts/generate-report.sh "$LOGS_DIR"

log "Orquestração concluída com sucesso!"
```

#### Terminal 2: Segurança e Infraestrutura
**Arquivo**: `scripts/terminal-security.sh`

```bash
#!/bin/bash
source ./scripts/common.sh

STATUS_FILE="$LOGS_DIR/terminal2-status.txt"

update_status() {
  echo "$1" > "$STATUS_FILE"
}

echo "Terminal 2: Iniciando correções de segurança..."
update_status "🔒 Adicionando autenticação (0/40)"

# Adicionar autenticação nas rotas
node scripts/add-auth-middleware.js
update_status "🔒 Autenticação adicionada (40/40)"

# Configurar variáveis de ambiente
update_status "⚙️ Configurando variáveis de ambiente..."
./scripts/setup-env.sh
update_status "⚙️ Variáveis configuradas ✓"

# Implementar rate limiting
update_status "🚦 Implementando rate limiting..."
npm install express-rate-limit
node scripts/add-rate-limiting.js
update_status "🚦 Rate limiting implementado ✓"

update_status "✅ Todas as correções de segurança concluídas"
```

#### Terminal 3: Scrapers e APIs
**Arquivo**: `scripts/terminal-scrapers.sh`

```bash
#!/bin/bash
source ./scripts/common.sh

STATUS_FILE="$LOGS_DIR/terminal3-status.txt"

update_status() {
  echo "$1" > "$STATUS_FILE"
}

update_status "🕷️ Copiando scrapers Python..."

# Copiar scrapers do Desktop
mkdir -p python-scrapers
cp ~/Desktop/SISTEMA_EXTRACAO_PROCESSUAL/*.py ./python-scrapers/
update_status "🕷️ Scrapers copiados ✓"

# Criar bridge Node.js → Python
update_status "🌉 Criando bridge Node.js..."
node scripts/create-python-bridge.js
update_status "🌉 Bridge criado ✓"

# Implementar DataJud real
update_status "📊 Implementando DataJud..."
node scripts/implement-datajud.js
update_status "📊 DataJud implementado ✓"

# Resolver bloqueio JusBrasil
update_status "🤖 Resolvendo anti-bot JusBrasil..."
node scripts/fix-jusbrasil.js
update_status "🤖 JusBrasil corrigido ✓"

update_status "✅ Todas as correções de scrapers concluídas"
```

#### Terminal 4: Frontend
**Arquivo**: `scripts/terminal-frontend.sh`

```bash
#!/bin/bash
source ./scripts/common.sh

STATUS_FILE="$LOGS_DIR/terminal4-status.txt"

update_status() {
  echo "$1" > "$STATUS_FILE"
}

update_status "🎨 Verificando arquivos TSX..."

# Verificar se precisa reconstruir
if [ ! -d "frontend/src" ] || [ -z "$(ls -A frontend/src)" ]; then
  update_status "🎨 Reconstruindo frontend..."
  node scripts/rebuild-frontend.js
else
  update_status "🎨 Frontend fonte encontrado ✓"
fi

# Instalar dependências
update_status "📦 Instalando dependências..."
cd frontend && npm install
update_status "📦 Dependências instaladas ✓"

# Build
update_status "🔨 Buildando frontend..."
npm run build
update_status "🔨 Build concluído ✓"

# Testes
update_status "🧪 Executando testes..."
npm run test
update_status "🧪 Testes concluídos ✓"

update_status "✅ Todas as correções de frontend concluídas"
```

#### Terminal 5: Refatoração
**Arquivo**: `scripts/terminal-refactor.sh`

```bash
#!/bin/bash
source ./scripts/common.sh

STATUS_FILE="$LOGS_DIR/terminal5-status.txt"

update_status() {
  echo "$1" > "$STATUS_FILE"
}

update_status "🔧 Unificando servidores..."

# Unificar server.js e server-enhanced.js
node scripts/merge-servers.js
update_status "🔧 Servidores unificados ✓"

# Resolver TODOs
update_status "📝 Resolvendo TODOs (0/60)..."
node scripts/resolve-todos.js
update_status "📝 TODOs resolvidos (60/60) ✓"

# Remover código duplicado
update_status "🧹 Removendo duplicatas..."
node scripts/remove-duplicates.js
update_status "🧹 Duplicatas removidas ✓"

# Adicionar testes
update_status "🧪 Adicionando testes..."
node scripts/generate-tests.js
update_status "🧪 Testes adicionados ✓"

update_status "✅ Todas as refatorações concluídas"
```

---

## 📊 CRONOGRAMA DE EXECUÇÃO

| Fase | Duração Estimada | Terminais |
|------|------------------|-----------|
| **Fase 1: Segurança** | 4 horas | Terminal 2 |
| **Fase 2: Scrapers** | 13 horas | Terminal 3 |
| **Fase 3: Frontend** | 12 horas | Terminal 4 |
| **Fase 4: Avançado** | 13 horas | Terminal 3, 4 |
| **Fase 5: Refatoração** | 22 horas | Terminal 5 |
| **TOTAL** | **64 horas** | **Paralelo: ~16-20 horas** |

---

## ✅ CRITÉRIOS DE SUCESSO

### Segurança
- [ ] Todas as 40+ rotas protegidas com autenticação
- [ ] Rate limiting implementado
- [ ] Variáveis de ambiente configuradas
- [ ] Testes de segurança passando

### Scrapers
- [ ] 10 scrapers Python migrados e funcionais
- [ ] DataJud retornando dados reais
- [ ] JusBrasil sem bloqueio anti-bot
- [ ] Testes de integração passando

### Frontend
- [ ] Arquivos TSX localizados ou reconstruídos
- [ ] Build sem erros
- [ ] Todos os componentes funcionais
- [ ] Testes de UI passando

### Funcionalidades
- [ ] AWS Transcribe implementado
- [ ] Claude Vision implementado
- [ ] Jurimetria funcional
- [ ] Sem APIs mockadas

### Qualidade
- [ ] Zero TODOs críticos
- [ ] Cobertura de testes > 70%
- [ ] Performance otimizada
- [ ] Documentação atualizada

---

## 📝 COMANDOS DE EXECUÇÃO

### Iniciar Orquestração Completa
```bash
./scripts/orchestrator.sh
```

### Executar Fases Individuais
```bash
# Fase 1: Segurança
./scripts/terminal-security.sh

# Fase 2: Scrapers
./scripts/terminal-scrapers.sh

# Fase 3: Frontend
./scripts/terminal-frontend.sh

# Fase 5: Refatoração
./scripts/terminal-refactor.sh
```

### Monitorar Progresso
```bash
# Ver status de todos os terminais
tail -f logs/orchestrator-*/terminal*-status.txt

# Ver logs principais
tail -f logs/orchestrator-*/main.log
```

---

## 🚨 PLANO DE ROLLBACK

Se algo der errado durante a execução:

1. **Backup automático** criado antes de iniciar
2. **Git commits** a cada fase concluída
3. **Rollback script** disponível:

```bash
./scripts/rollback.sh <backup-timestamp>
```

---

## 📧 NOTIFICAÇÕES

Sistema enviará notificações via:
- [ ] Slack webhook (configurar `SLACK_WEBHOOK_URL`)
- [ ] Email (configurar SMTP)
- [ ] Desktop notifications (macOS)

---

**Documento criado em**: 2026-01-08
**Versão**: 1.0.0
**Status**: Pronto para execução
