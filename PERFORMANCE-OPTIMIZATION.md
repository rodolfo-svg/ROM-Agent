# ⚡ Plano de Otimização de Performance - ROM Agent

**Baseline Atual**: 6.2 segundos por resposta
**Meta**: < 3 segundos por resposta
**Ganho esperado**: ~50% mais rápido

---

## 📊 Análise Atual

### ✅ O que já está otimizado:
- AWS Bedrock nativo (sem overhead de Anthropic API)
- Compression Gzip/Brotli ativado
- Rate limiting implementado
- Cache em memória (30min TTL)
- Apenas 3 processos Node rodando

### ⚠️ Gargalos identificados:
1. **Sem streaming de respostas** (esperando resposta completa)
2. **Modelo pesado** (Nova Pro vs Nova Lite)
3. **Histórico não limitado** (cresce infinitamente)
4. **Sem cache de respostas similares**
5. **Conexões HTTP/1.1** (sem keep-alive otimizado)
6. **Parser JSON síncrono** (bloqueia event loop)
7. **Sem pré-aquecimento de conexões**
8. **Queries sequenciais** (poderia ser paralelo)

---

## 🚀 Otimizações Propostas (Ordem de Impacto)

### 1. **STREAMING DE RESPOSTAS** 🌊
**Impacto**: -60% tempo percebido pelo usuário
**Implementação**: Já existe código, basta usar!

#### Mudança:
```javascript
// ANTES (atual):
const resultado = await agent.enviar(message);
// Usuário espera 6s para ver QUALQUER coisa

// DEPOIS (streaming):
app.post('/api/chat-stream', async (req, res) => {
  // Usuário começa a ver resposta em < 1s
  await conversarStream(message, (chunk) => {
    res.write(`data: ${JSON.stringify({ chunk })}\\n\\n`);
  });
});
```

#### Arquivo: `src/server-enhanced.js:389-453`
**Status**: ✅ Já implementado, só precisa ser o método padrão

---

### 2. **MODELO MAIS RÁPIDO** ⚡
**Impacto**: -40% tempo de processamento
**Custo**: Qualidade ligeiramente menor (aceitável para chat)

#### Mudança:
```javascript
// ANTES:
modelo: 'amazon.nova-pro-v1:0'  // Mais lento, mais inteligente
// Tempo: ~6s

// DEPOIS:
modelo: 'amazon.nova-lite-v1:0' // Mais rápido, ainda bom
// Tempo: ~3.5s

// OU (ultra rápido):
modelo: 'amazon.nova-micro-v1:0' // Rápido, respostas curtas
// Tempo: ~2s
```

#### Arquivo: `src/server-enhanced.js:212`

**Recomendação**:
- Usar **Nova Lite** como padrão
- Permitir usuário escolher modelo no frontend
- Auto-switch: perguntas simples → Lite, complexas → Pro

---

### 3. **CACHE DE RESPOSTAS SIMILARES** 💾
**Impacto**: -90% em perguntas repetidas
**Implementação**: Redis ou Map() em memória

#### Código:
```javascript
// lib/response-cache.js
import crypto from 'crypto';

class ResponseCache {
  constructor() {
    this.cache = new Map();
    this.ttl = 3600000; // 1 hora
  }

  hashQuery(query) {
    return crypto.createHash('md5').update(query.toLowerCase()).digest('hex');
  }

  get(query) {
    const hash = this.hashQuery(query);
    const cached = this.cache.get(hash);

    if (cached && Date.now() - cached.timestamp < this.ttl) {
      console.log(`✅ Cache HIT: ${query.substring(0, 50)}`);
      return cached.response;
    }

    this.cache.delete(hash);
    return null;
  }

  set(query, response) {
    const hash = this.hashQuery(query);
    this.cache.set(hash, {
      response,
      timestamp: Date.now()
    });
  }
}

export default new ResponseCache();
```

#### Uso no servidor:
```javascript
import responseCache from '../lib/response-cache.js';

app.post('/api/chat', async (req, res) => {
  // Verificar cache primeiro
  const cached = responseCache.get(req.body.message);
  if (cached) {
    return res.json({ response: cached, cached: true });
  }

  // Processar normalmente
  const resultado = await agent.enviar(message);

  // Salvar no cache
  responseCache.set(message, resultado.resposta);

  res.json({ response: resultado.resposta });
});
```

**Tempo**: < 50ms para cache hits!

---

### 4. **LIMITAR HISTÓRICO** 📜
**Impacto**: -10% tempo de processamento
**Razão**: Menos tokens enviados ao modelo

#### Mudança:
```javascript
// ANTES:
const history = getHistory(req.session.id);
// Histórico cresce infinitamente

// DEPOIS:
const history = getHistory(req.session.id).slice(-10); // Últimas 10 msgs
// Ou: slice(-20) para contexto maior
```

#### Arquivo: `src/server-enhanced.js:241`

**Cálculo**:
- 10 mensagens = ~2000 tokens
- 100 mensagens = ~20000 tokens
- Diferença: -90% tokens de entrada!

---

### 5. **PARALELIZAÇÃO DE OPERAÇÕES** 🔀
**Impacto**: -30% tempo em operações múltiplas
**Uso**: Pesquisa de jurisprudência, análises

#### Código:
```javascript
// ANTES (sequencial):
const legislacao = await buscarLegislacao(tema);
const jurisprudencia = await buscarJurisprudencia(tema);
const doutrina = await buscarDoutrina(tema);
// Tempo total: 15s

// DEPOIS (paralelo):
const [legislacao, jurisprudencia, doutrina] = await Promise.all([
  buscarLegislacao(tema),
  buscarJurisprudencia(tema),
  buscarDoutrina(tema)
]);
// Tempo total: 5s (70% mais rápido!)
```

---

### 6. **HTTP/2 + KEEP-ALIVE** 🔌
**Impacto**: -10% tempo de conexão
**Implementação**: Configurar Express/Node

#### Código:
```javascript
// src/server-enhanced.js
import http2 from 'http2';
import fs from 'fs';

// Criar servidor HTTP/2 (requer HTTPS)
const options = {
  key: fs.readFileSync('ssl/key.pem'),
  cert: fs.readFileSync('ssl/cert.pem'),
  allowHTTP1: true // Fallback para HTTP/1.1
};

const server = http2.createSecureServer(options, app);
server.listen(3000);
```

**Alternativa** (sem SSL, dev):
```javascript
// Melhorar keep-alive HTTP/1.1
app.use((req, res, next) => {
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Keep-Alive', 'timeout=5, max=100');
  next();
});
```

---

### 7. **PRÉ-AQUECIMENTO DE CONEXÕES** 🔥
**Impacto**: -15% cold start
**Status**: ✅ Já implementado (linha 3875-3900)

#### Melhorias:
```javascript
// ANTES:
await conversar('ping', { modelo, maxTokens: 10 });
// Aguarda resposta completa

// DEPOIS (mais rápido):
const warmup = conversar('ping', { modelo, maxTokens: 5 });
// Não aguarda, faz em background
setTimeout(() => warmup, 0);
```

---

### 8. **PARSER JSON ASSÍNCRONO** 📝
**Impacto**: -5% em payloads grandes
**Implementação**: Usar stream parser

#### Código:
```javascript
import { JSONParser } from '@streamparser/json';

app.use(express.json({
  limit: '50mb',
  verify: (req, res, buf) => {
    // Parse assíncrono para payloads > 1MB
    if (buf.length > 1024 * 1024) {
      const parser = new JSONParser();
      parser.write(buf);
      req.bodyParsed = parser.value;
    }
  }
}));
```

---

## 🎯 Implementação Recomendada (Prioridade)

### **FASE 1 - Ganho Rápido** (30 min)
1. ✅ Trocar para modelo Nova Lite (1 linha)
2. ✅ Limitar histórico a 10 mensagens (1 linha)
3. ✅ Usar streaming como padrão (mudar rota)

**Ganho esperado**: 6.2s → **3.5s** (-43%)

### **FASE 2 - Otimização Avançada** (2h)
4. ✅ Implementar cache de respostas
5. ✅ Paralelizar operações DB/API
6. ✅ HTTP/2 ou Keep-Alive melhorado

**Ganho esperado**: 3.5s → **2.2s** (-37%)

### **FASE 3 - Polimento** (1h)
7. ✅ Otimizar pré-aquecimento
8. ✅ Parser JSON assíncrono

**Ganho esperado**: 2.2s → **1.8s** (-18%)

---

## 📊 Resultados Esperados

| Fase | Tempo | Ganho | Status |
|------|-------|-------|--------|
| Baseline | 6.2s | - | ✅ Medido |
| Fase 1 | 3.5s | -43% | ⏳ Pendente |
| Fase 2 | 2.2s | -37% | ⏳ Pendente |
| Fase 3 | 1.8s | -18% | ⏳ Pendente |
| **TOTAL** | **1.8s** | **-71%** | 🎯 Meta |

---

## 🚀 Começar Agora - Comandos Rápidos

### 1. Trocar para Nova Lite:
```bash
# Editar src/server-enhanced.js linha 212
sed -i '' 's/amazon.nova-pro-v1:0/amazon.nova-lite-v1:0/g' src/server-enhanced.js
```

### 2. Limitar histórico:
```bash
# Editar src/server-enhanced.js linha 241
# Adicionar .slice(-10) após getHistory()
```

### 3. Testar velocidade:
```bash
time curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message":"teste"}'
```

### 4. Usar streaming:
```bash
# Frontend: mudar de /api/chat para /api/chat-stream
# Backend: já implementado em linha 389-453
```

---

## 📝 Checklist de Implementação

- [ ] Fase 1.1: Trocar modelo padrão para Nova Lite
- [ ] Fase 1.2: Limitar histórico a 10 mensagens
- [ ] Fase 1.3: Ativar streaming como padrão
- [ ] Fase 1.4: Testar e medir tempo
- [ ] Fase 2.1: Implementar cache de respostas
- [ ] Fase 2.2: Paralelizar operações
- [ ] Fase 2.3: Configurar keep-alive
- [ ] Fase 2.4: Testar e medir tempo
- [ ] Fase 3.1: Otimizar pré-aquecimento
- [ ] Fase 3.2: Parser JSON assíncrono
- [ ] Fase 3.3: Teste final e documentar

---

## 💡 Dicas Extras

### Monitorar Performance:
```javascript
// Adicionar middleware de timing
app.use((req, res, next) => {
  req.startTime = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - req.startTime;
    console.log(`${req.method} ${req.path} - ${duration}ms`);
  });
  next();
});
```

### Benchmarking:
```bash
# Testar 10 requisições
for i in {1..10}; do
  time curl -s -X POST http://localhost:3000/api/chat \
    -H "Content-Type: application/json" \
    -d "{\"message\":\"teste $i\"}"
done
```

### Profiling:
```bash
# Detectar gargalos
node --prof src/server-enhanced.js
# Após teste, processar:
node --prof-process isolate-*.log > profile.txt
```

---

**Última atualização**: 14/12/2025
**Autor**: Claude Code
**Versão**: 1.0.0
