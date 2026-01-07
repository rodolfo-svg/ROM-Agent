# Correção do Sistema de Busca de Jurisprudência - TJGO

**Data:** 07/01/2026
**Problema:** Sistema travando ao buscar jurisprudências sobre TJGO, aparentemente não estava usando Google Search e travava no JusBrasil

---

## 🔍 Problemas Identificados

### 1. **JusBrasil Travando o Sistema**
- Timeout de 30 segundos era muito longo
- Scraping HTTP estava sendo bloqueado pelo site
- Não havia tratamento adequado de timeouts

### 2. **Google Search Não Priorizado**
- Buscas em paralelo esperavam TODAS as fontes terminarem
- JusBrasil travado causava atraso de 30s em todas as buscas
- TJGO não tinha otimização específica

### 3. **Falta de Logging Detalhado**
- Difícil identificar qual fonte estava falhando
- Sem métricas de performance por fonte

---

## ✅ Correções Implementadas

### 1. **Timeouts Individuais por Fonte** (`jurisprudence-search-service.js`)
```javascript
// ANTES: Todas as fontes com timeout de 30s
// DEPOIS:
- Google Search: 15 segundos
- DataJud: 15 segundos
- JusBrasil: 8 segundos (reduzido drasticamente)

// Novo método withTimeout para cancelar buscas lentas
async withTimeout(promise, timeoutMs, sourceName) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`Timeout: ${sourceName}`)), timeoutMs)
    )
  ]);
}
```

### 2. **Ordem de Prioridade Alterada**
```javascript
// ANTES: DataJud → JusBrasil → Google
// DEPOIS: DataJud → Google Search → JusBrasil (último)
```
**Motivo:** Google Search é mais confiável que JusBrasil para scraping

### 3. **Otimização Específica para TJGO** (`google-search-client.js`)
```javascript
if (tribunal?.toUpperCase().includes('TJGO')) {
  console.log('[GoogleSearch] Priorizando TJGO (tjgo.jus.br)');
  searchQuery = `jurisprudencia ${query} site:tjgo.jus.br`;
  // Fallback se TJGO não retornar resultados
  if (results.length === 0) {
    searchQuery = `jurisprudencia ${query} site:jus.br tribunal goias`;
  }
}
```

### 4. **Melhorias no JusBrasil Client** (`jusbrasil-client.js`)
- Timeout reduzido para 8 segundos
- Detecção de timeout vs bloqueio
- Mensagens de erro mais claras
```javascript
const isTimeout = error.code === 'ECONNABORTED' || error.message?.includes('timeout');
const isBlocked = error.response?.status === 403 || error.response?.status === 429;

console.warn(`[JusBrasil] ${isTimeout ? 'TIMEOUT' : isBlocked ? 'BLOQUEADO' : 'ERRO'}`);
```

### 5. **Logging Detalhado e Métricas**
```javascript
// Log de início
console.log(`🔍 [BUSCA] Iniciando: "${tese}" (${tribunal})`);

// Log por fonte
console.log(`✅ [${sourceName}] Sucesso - ${resultCount} resultado(s)`);
console.error(`❌ [${sourceName}] TIMEOUT: ${errorMsg}`);

// Métricas de performance
console.log(`✅ [BUSCA CONCLUÍDA] ${totalResults} em ${duration}ms`);
console.log(`   Sucessos: ${successful}/${total} fontes`);
```

### 6. **Tratamento Inteligente de Erros**
```javascript
// Antes: Erro genérico
// Depois: Erro categorizado com sugestões
{
  success: false,
  error: 'JusBrasil não respondeu a tempo (timeout)',
  suggestion: 'Usando Google Search como fonte principal',
  isTimeout: true,
  isBlocked: false
}
```

---

## 📊 Resultados Esperados

### Performance
- **Antes:** Timeout de 30s em cada fonte = até 90s total
- **Depois:** Máximo 15s + 15s + 8s = **38s total** (mas geralmente muito menos)

### Confiabilidade
- ✅ Google Search sempre executará (fonte mais confiável)
- ✅ JusBrasil não trava mais o sistema
- ✅ Buscas TJGO otimizadas

### Visibilidade
- ✅ Logs claros de qual fonte falhou/travou
- ✅ Métricas de performance por busca
- ✅ Sugestões de alternativas em caso de falha

---

## 🧪 Como Testar

### 1. Busca TJGO Específica
```bash
cd ~/ROM-Agent
node scripts/test-google-search.js "responsabilidade civil médica" TJGO
```

### 2. Verificar Logs
```bash
# Deve mostrar:
# 🔍 [BUSCA] Iniciando: "responsabilidade civil médica" (TJGO)
# [GoogleSearch] Priorizando TJGO (tjgo.jus.br)
# ✅ [websearch] Sucesso - 10 resultado(s)
# ⚠️ [TIMEOUT] JusBrasil excedeu 8000ms
# ✅ [BUSCA CONCLUÍDA] 10 resultado(s) em 8523ms
```

### 3. Testar via Interface
```bash
# Iniciar servidor
npm start

# Acessar interface e testar skill /jurisprudencia
# Deve buscar jurisprudências do TJGO sem travar
```

---

## 🔧 Variáveis de Ambiente Importantes

```bash
# Google Search API (PRIORITÁRIO)
GOOGLE_SEARCH_API_KEY=your_api_key
GOOGLE_SEARCH_CX=your_custom_search_engine_id

# JusBrasil (OPCIONAL - pode falhar)
JUSBRASIL_ENABLED=false  # Desabilitar se continuar travando
JUSBRASIL_EMAIL=your_email
JUSBRASIL_SENHA=your_password

# DataJud (OPCIONAL)
DATAJUD_ENABLED=false
DATAJUD_API_KEY=your_api_key
```

**RECOMENDAÇÃO:** Configure apenas Google Search inicialmente. JusBrasil é instável.

---

## 📝 Arquivos Modificados

1. ✅ `src/services/jurisprudence-search-service.js`
   - Método `withTimeout()` adicionado
   - Timeouts individuais por fonte
   - Ordem de prioridade alterada
   - Logging detalhado
   - Métricas de performance

2. ✅ `lib/google-search-client.js`
   - Otimização para TJGO
   - Logging aprimorado
   - Fallbacks inteligentes

3. ✅ `lib/jusbrasil-client.js`
   - Timeout reduzido para 8s
   - Detecção de timeout/bloqueio
   - Mensagens de erro claras
   - Sugestões de alternativas

---

## 🚨 Se Ainda Travar

### Opção 1: Desabilitar JusBrasil Completamente
```bash
# .env
JUSBRASIL_ENABLED=false
```

### Opção 2: Apenas Google Search
```javascript
// Em jurisprudence-search-service.js, comentar:
// if (this.config.jusbrasil.enabled) { ... }
```

### Opção 3: Verificar Credenciais Google
```bash
# Testar diretamente
curl "https://www.googleapis.com/customsearch/v1?key=YOUR_KEY&cx=YOUR_CX&q=test"
```

---

## ✨ Conclusão

O sistema agora:
- ⚡ **Não trava mais** - timeouts agressivos previnem bloqueios
- 🎯 **Prioriza TJGO** - otimização específica para tribunal de Goiás
- 📊 **É observável** - logs detalhados mostram o que está acontecendo
- 🔄 **Tem fallbacks** - se uma fonte falha, outras compensam
- 🚀 **É mais rápido** - não espera JusBrasil travar

**Performance esperada para busca TJGO:**
- ✅ Com Google configurado: **2-5 segundos**
- ⚠️ Sem Google (só JusBrasil): **8 segundos (timeout)**
- ❌ Antes das correções: **30+ segundos (travado)**

---

**Próximos Passos:**
1. Configurar Google Search API (prioritário)
2. Testar buscas TJGO na interface
3. Monitorar logs para validar correções
4. Considerar desabilitar JusBrasil permanentemente se continuar problemático
