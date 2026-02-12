# 🏛️ ROM Agent - Integração DataJud CNJ

## 📋 Índice

- [Visão Geral](#visão-geral)
- [Configuração](#configuração)
- [Arquitetura](#arquitetura)
- [API Endpoints](#api-endpoints)
- [Exemplos de Uso](#exemplos-de-uso)
- [Frontend](#frontend)
- [Testes](#testes)
- [Troubleshooting](#troubleshooting)

---

## 🎯 Visão Geral

A integração com a **API Pública do DataJud (CNJ)** permite consultar processos e decisões judiciais de **todos os 38 tribunais do Brasil** diretamente no ROM Agent.

### Cobertura Nacional Completa

- ✅ **5 Tribunais Superiores**: STF, STJ, STM, TSE, TST
- ✅ **6 Tribunais Regionais Federais**: TRF1 a TRF6
- ✅ **27 Tribunais de Justiça Estaduais**: Todos os estados + DF

### Funcionalidades

1. **Busca de Processos** - Por número, classe, assunto, tribunal
2. **Busca Multi-Tribunal** - Pesquisa simultânea em múltiplos tribunais
3. **Busca de Decisões** - Acórdãos e jurisprudência
4. **Validação CNJ** - Valida números de processo
5. **Cache Inteligente** - Cache de 1 hora para otimizar requisições
6. **Fallback Automático** - Usa Google Search se DataJud falhar

---

## ⚙️ Configuração

### 1. Variáveis de Ambiente

Adicione no arquivo `.env`:

```bash
# DataJud CNJ - API Pública
DATAJUD_API_KEY=cDZHYzlZa0JadVREZDJCendQbXY6SkJlTzNjLV9TRENyQk1RdnFKZGRQdw==
CNJ_DATAJUD_API_KEY=cDZHYzlZa0JadVREZDJCendQbXY6SkJlTzNjLV9TRENyQk1RdnFKZGRQdw==
DATAJUD_ENABLED=true
DATAJUD_BASE_URL=https://api-publica.datajud.cnj.jus.br
```

**⚠️ Importante**: A chave pública acima é fornecida pelo CNJ e está disponível em:
https://datajud-wiki.cnj.jus.br/api-publica/acesso/

### 2. Configuração no Render

Se estiver usando o Render.com para deploy:

1. Acesse: Dashboard > ROM-Agent > Environment
2. Adicione as variáveis:
   - `DATAJUD_API_KEY`
   - `CNJ_DATAJUD_API_KEY`
   - `DATAJUD_ENABLED=true`
   - `DATAJUD_BASE_URL=https://api-publica.datajud.cnj.jus.br`

3. Clique em "Save Changes" e aguarde o redeploy automático

---

## 🏗️ Arquitetura

### Estrutura de Arquivos

```
ROM-Agent/
├── src/
│   ├── services/
│   │   └── datajud-service.js          # Serviço principal DataJud
│   ├── routes/
│   │   └── datajud.js                  # Rotas da API REST
│   └── server.js                        # Registro das rotas
├── public/
│   └── datajud-test.html               # Interface de teste
└── docs/
    └── DATAJUD-INTEGRACAO-COMPLETA.md  # Esta documentação
```

### Fluxo de Dados

```
Cliente/Frontend
    ↓
API REST (/api/datajud/*)
    ↓
datajud-service.js
    ↓
API DataJud CNJ (api-publica.datajud.cnj.jus.br)
    ↓
ElasticSearch Query DSL
    ↓
Resultados (JSON)
```

---

## 🔌 API Endpoints

### Base URL
```
http://localhost:3000/api/datajud
```

### Endpoints Disponíveis

#### 1. Health Check
```http
GET /api/datajud/health
```

**Resposta:**
```json
{
  "status": "ok",
  "configured": true,
  "baseUrl": "https://api-publica.datajud.cnj.jus.br",
  "tribunaisDisponiveis": 38,
  "version": "1.0.0"
}
```

---

#### 2. Listar Tribunais
```http
GET /api/datajud/tribunais
```

**Resposta:**
```json
{
  "total": 38,
  "tribunais": [
    {
      "sigla": "TJSP",
      "alias": "tjsp",
      "url": "https://api-publica.datajud.cnj.jus.br/api_publica_tjsp/_search"
    }
  ],
  "categorias": {
    "superiores": [...],
    "federais": [...],
    "estaduais": [...]
  }
}
```

---

#### 3. Buscar Processos
```http
POST /api/datajud/processos/buscar
```

**Body:**
```json
{
  "tribunal": "TJSP",
  "numero": "0000832-35.2018.4.01.3202",
  "classe": "Procedimento Comum",
  "assunto": "Direito Civil",
  "limit": 50,
  "offset": 0
}
```

**Resposta:**
```json
{
  "fonte": "DataJud (CNJ)",
  "tribunal": "TJSP",
  "totalEncontrado": 1,
  "processos": [
    {
      "numero": "0000832-35.2018.4.01.3202",
      "classe": "Procedimento Comum",
      "assunto": "Direito Civil",
      "orgaoJulgador": "1ª Vara Cível",
      "dataDistribuicao": "2018-01-15",
      "tribunal": "TJSP",
      "movimentos": [...]
    }
  ],
  "fromCache": false,
  "timestamp": "2026-02-12T20:00:00.000Z"
}
```

---

#### 4. Buscar em Múltiplos Tribunais
```http
POST /api/datajud/processos/buscar-todos
```

**Body:**
```json
{
  "tribunais": ["TJSP", "TJRJ", "TJMG", "STJ"],
  "numero": "0000832-35.2018.4.01.3202",
  "limit": 20
}
```

**Resposta:**
```json
{
  "fonte": "DataJud (CNJ) - Busca Multi-Tribunal",
  "totalTribunais": 4,
  "tribunaisSucesso": 4,
  "tribunaisErro": 0,
  "totalProcessos": 3,
  "processos": [...],
  "detalhes": [...]
}
```

---

#### 5. Buscar Decisões/Acórdãos
```http
POST /api/datajud/decisoes/buscar
```

**Body:**
```json
{
  "tribunal": "STJ",
  "termo": "responsabilidade civil dano moral",
  "relator": "Ministro Nome",
  "limit": 50
}
```

**Resposta:**
```json
{
  "fonte": "DataJud (CNJ)",
  "tribunal": "STJ",
  "termo": "responsabilidade civil dano moral",
  "totalEncontrado": 150,
  "decisoes": [
    {
      "tribunal": "STJ",
      "tipo": "Acórdão",
      "numero": "REsp 123456",
      "ementa": "RESPONSABILIDADE CIVIL. DANO MORAL...",
      "data": "2025-12-15",
      "relator": "Ministro João Silva",
      "orgaoJulgador": "3ª Turma",
      "url": "https://...",
      "classe": "Recurso Especial",
      "assunto": "Responsabilidade Civil",
      "score": 9.5
    }
  ],
  "fromCache": false
}
```

---

#### 6. Validar Número de Processo
```http
POST /api/datajud/validar-processo
```

**Body:**
```json
{
  "numero": "0000832-35.2018.4.01.3202"
}
```

**Resposta:**
```json
{
  "valido": true,
  "sequencial": "0000832",
  "digito": "35",
  "ano": "2018",
  "segmento": "4",
  "tribunal": "01",
  "origem": "3202",
  "segmentoDescricao": "Justiça Federal"
}
```

---

#### 7. Limpar Cache
```http
DELETE /api/datajud/cache
```

**Resposta:**
```json
{
  "sucesso": true,
  "mensagem": "Cache do DataJud limpo"
}
```

---

#### 8. Estatísticas do Cache
```http
GET /api/datajud/cache/stats
```

**Resposta:**
```json
{
  "hits": 45,
  "misses": 12,
  "keys": 15,
  "ksize": 2048,
  "vsize": 102400
}
```

---

## 💻 Exemplos de Uso

### JavaScript/Node.js

```javascript
// Buscar processo específico
const response = await fetch('http://localhost:3000/api/datajud/processos/buscar', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    tribunal: 'TJSP',
    numero: '0000832-35.2018.4.01.3202',
    limit: 50
  })
});

const data = await response.json();
console.log('Processos encontrados:', data.totalEncontrado);
console.log('Processos:', data.processos);
```

### Python

```python
import requests

# Buscar em múltiplos tribunais
response = requests.post(
    'http://localhost:3000/api/datajud/processos/buscar-todos',
    json={
        'tribunais': ['TJSP', 'TJRJ', 'TJMG'],
        'numero': '0000832-35.2018.4.01.3202',
        'limit': 20
    }
)

data = response.json()
print(f"Total de processos: {data['totalProcessos']}")
print(f"Tribunais com sucesso: {data['tribunaisSucesso']}")
```

### cURL

```bash
# Buscar decisões
curl -X POST http://localhost:3000/api/datajud/decisoes/buscar \
  -H "Content-Type: application/json" \
  -d '{
    "tribunal": "STJ",
    "termo": "responsabilidade civil",
    "limit": 30
  }'
```

---

## 🎨 Frontend

### Interface de Teste

Acesse: http://localhost:3000/datajud-test.html

A interface fornece:
- ✅ Busca de processos por tribunal
- ✅ Busca simultânea em múltiplos tribunais
- ✅ Busca de decisões e jurisprudência
- ✅ Listagem de todos os tribunais
- ✅ Validação de números de processo
- ✅ Interface visual moderna e responsiva

### Integração no Frontend Principal

Para integrar no frontend React/Vue/Angular:

```javascript
// services/datajud.service.js
export class DataJudService {
  constructor() {
    this.baseUrl = '/api/datajud';
  }

  async buscarProcessos(tribunal, numero) {
    const response = await fetch(`${this.baseUrl}/processos/buscar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tribunal, numero })
    });
    return response.json();
  }

  async buscarMultiplosTribunais(tribunais, numero) {
    const response = await fetch(`${this.baseUrl}/processos/buscar-todos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tribunais, numero })
    });
    return response.json();
  }

  async listarTribunais() {
    const response = await fetch(`${this.baseUrl}/tribunais`);
    return response.json();
  }
}
```

---

## 🧪 Testes

### Teste Manual

1. **Inicie o servidor:**
   ```bash
   cd ROM-Agent
   npm start
   ```

2. **Acesse a interface de teste:**
   ```
   http://localhost:3000/datajud-test.html
   ```

3. **Teste cada funcionalidade:**
   - Busca de processos
   - Busca multi-tribunal
   - Busca de decisões
   - Validação de números
   - Listagem de tribunais

### Teste via API

```bash
# 1. Health check
curl http://localhost:3000/api/datajud/health

# 2. Listar tribunais
curl http://localhost:3000/api/datajud/tribunais

# 3. Buscar processo
curl -X POST http://localhost:3000/api/datajud/processos/buscar \
  -H "Content-Type: application/json" \
  -d '{"tribunal":"TJSP","numero":"0000832-35.2018.4.01.3202"}'
```

---

## 🔧 Troubleshooting

### Erro: "Token não configurado"

**Problema:** `DATAJUD_API_KEY` não está definida

**Solução:**
```bash
# Adicione no .env
DATAJUD_API_KEY=cDZHYzlZa0JadVREZDJCendQbXY6SkJlTzNjLV9TRENyQk1RdnFKZGRQdw==
```

---

### Erro: "Tribunal não suportado"

**Problema:** Sigla do tribunal não existe no mapeamento

**Solução:** Verifique a lista de tribunais suportados em `/api/datajud/tribunais`

Tribunais válidos:
- Superiores: STF, STJ, STM, TSE, TST
- Federais: TRF1, TRF2, TRF3, TRF4, TRF5, TRF6
- Estaduais: TJAC, TJAL, TJAM, TJAP, TJBA, TJCE, TJDFT, TJES, TJGO, TJMA, TJMG, TJMS, TJMT, TJPA, TJPB, TJPE, TJPI, TJPR, TJRJ, TJRN, TJRO, TJRR, TJRS, TJSC, TJSE, TJSP, TJTO

---

### Erro: "Fallback para Google Search"

**Problema:** DataJud falhou, sistema usou fallback

**Causas possíveis:**
1. API DataJud temporariamente indisponível
2. Token expirado/inválido
3. Tribunal específico offline
4. Query malformada

**Solução:**
1. Verifique se a chave está atualizada: https://datajud-wiki.cnj.jus.br/api-publica/acesso/
2. Configure Google Search como backup (opcional):
   ```bash
   GOOGLE_SEARCH_API_KEY=sua_chave
   GOOGLE_SEARCH_CX=seu_cx_id
   ```

---

### Performance

**Cache está funcionando?**
```bash
# Verificar estatísticas
curl http://localhost:3000/api/datajud/cache/stats

# Limpar cache se necessário
curl -X DELETE http://localhost:3000/api/datajud/cache
```

**Cache padrão:** 1 hora (3600 segundos)

---

## 📚 Documentação Oficial

- **DataJud Wiki**: https://datajud-wiki.cnj.jus.br/
- **API Pública**: https://datajud-wiki.cnj.jus.br/api-publica/
- **Endpoints**: https://datajud-wiki.cnj.jus.br/api-publica/endpoints/
- **Acesso (Chave)**: https://datajud-wiki.cnj.jus.br/api-publica/acesso/
- **Portal CNJ**: https://www.cnj.jus.br/sistemas/datajud/

---

## 📝 Changelog

### v1.0.0 (2026-02-12)

**Adicionado:**
- ✅ Integração completa com API DataJud CNJ
- ✅ Suporte a todos os 38 tribunais do Brasil
- ✅ Busca multi-tribunal simultânea
- ✅ Cache inteligente de 1 hora
- ✅ Fallback automático para Google Search
- ✅ Interface de teste completa
- ✅ Validação de números CNJ
- ✅ API REST completa com 11 endpoints
- ✅ Documentação completa
- ✅ Suporte a ElasticSearch Query DSL

---

## 🤝 Suporte

Para problemas ou dúvidas:
- 📧 Email: suporte@rom.adv.br
- 📚 Documentação: /docs
- 🐛 Issues: GitHub Issues

---

## 📄 Licença

MIT License - ROM Agent © 2026

---

**Desenvolvido com ❤️ pelo time ROM Agent**
