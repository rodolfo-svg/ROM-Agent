# 🧪 Testes - Sistema de Exportação ROM Agent

Documentação completa dos testes unitários e de integração para o sistema de exportação multi-formato.

## 📁 Estrutura de Diretórios

```
tests/
├── unit/                           # Testes unitários
│   ├── export-service.test.js     # Testes do ExportService
│   └── pdf-generator-service.test.js # Testes do PDFGenerator
├── integration/                    # Testes de integração
│   └── export-routes.test.js      # Testes dos endpoints REST
├── fixtures/                       # Dados de teste
│   └── export-test-data.js        # Fixtures de documentos
├── helpers/                        # Utilitários
│   └── test-utils.js              # Funções auxiliares
└── run-export-tests.js            # Runner principal
```

## 🚀 Como Executar

### Testes Unitários (Recomendado)

```bash
# Todos os testes unitários
npm run test:unit

# Apenas export-service
node --test tests/unit/export-service.test.js

# Apenas pdf-generator
node --test tests/unit/pdf-generator-service.test.js

# Watch mode (re-executa ao salvar)
npm run test:watch
```

### Testes de Integração

**IMPORTANTE:** Requer servidor rodando!

```bash
# Terminal 1: Inicie o servidor
npm start

# Terminal 2: Execute os testes
npm run test:integration
```

### Todos os Testes

```bash
npm run test:all
```

### Teste Rápido do Sistema de Exportação

```bash
npm run test:export
```

## 📊 Cobertura de Testes

### ExportService (tests/unit/export-service.test.js)

**Funcionalidades Testadas:**

✅ **Detecção de Tipo de Conteúdo**
- Legal brief (petições)
- Jurisprudência (acórdãos)
- Análise processual
- Contratos
- Documentos genéricos

✅ **Formatação por Tipo**
- Formatação de petições (MAIÚSCULAS para partes)
- Formatação de análise (layers)
- Formatação de contratos (cláusulas)

✅ **Templates ABNT**
- OAB (padrão)
- ABNT (acadêmico)
- Moderno, Compacto, Clássico
- Fallback para template inválido

✅ **Exportação TXT**
- Remoção de formatação Markdown
- Remoção de links
- Remoção de tags HTML

✅ **Exportação Markdown**
- Inclusão de metadados
- Formatação com separadores
- Informações de tribunal

✅ **Exportação HTML**
- HTML válido (DOCTYPE, tags)
- CSS ABNT incluído
- Conversão Markdown → HTML
- Metadados e rodapé

✅ **Helpers**
- stripFormatting
- cssMargins
- formatDate
- buildHeader/buildFooter

✅ **Validação**
- Erro para formato inválido
- Tratamento de Markdown inválido

✅ **Performance**
- TXT < 100ms
- Markdown < 100ms
- HTML < 200ms

**Total:** ~50 testes unitários

### PDFGenerator (tests/unit/pdf-generator-service.test.js)

**Funcionalidades Testadas:**

✅ **Disponibilidade Puppeteer**
- Verifica se está instalado

✅ **Geração de PDF**
- HTML simples → PDF
- Margens personalizadas
- Formatos de página (A4, Letter)
- Headers e footers

✅ **HTML Complexo**
- CSS styling
- Múltiplas páginas
- Caracteres especiais (UTF-8)

✅ **Screenshot**
- PNG generation
- Opções customizadas

✅ **Margens ABNT**
- 3cm esquerda, 2.5cm demais

✅ **Performance**
- PDF < 5 segundos

**Total:** ~15 testes unitários

**NOTA:** Testes de PDF podem ser pulados se Puppeteer não estiver disponível.

### Export Routes (tests/integration/export-routes.test.js)

**Endpoints Testados:**

✅ **GET /api/export/status**
- Retorna status operacional
- Lista formatos suportados
- Lista templates disponíveis
- Status do Puppeteer

✅ **POST /api/export/txt**
- Exportação TXT
- Content-Type correto
- Erro 400 sem conteúdo

✅ **POST /api/export/markdown**
- Exportação Markdown
- Inclusão de metadados

✅ **POST /api/export/html**
- Exportação HTML
- HTML válido

✅ **POST /api/export/docx**
- Exportação DOCX
- MIME type correto
- Templates (OAB, ABNT)

✅ **POST /api/export/pdf**
- Exportação PDF
- Assinatura PDF válida
- MIME type correto

✅ **Validação**
- Rejeita conteúdo > 10MB
- Título padrão
- Formato inválido → 400

✅ **Headers**
- Content-Disposition
- Filename sanitização

✅ **Templates**
- OAB, ABNT, Moderno, Compacto, Clássico

✅ **Performance**
- TXT < 1s
- Markdown < 1s

**Total:** ~25 testes de integração

## 🎯 Fixtures de Teste

Os arquivos em `tests/fixtures/export-test-data.js` contêm documentos de amostra:

### Disponíveis

- **sampleLegalBrief** - Petição inicial completa
- **sampleJurisprudence** - Acórdão do STJ
- **sampleAnalysis** - Análise processual (5 layers)
- **sampleContract** - Contrato de prestação de serviços
- **sampleGeneric** - Documento genérico

### Uso

```javascript
import { sampleLegalBrief, getFixture } from '../fixtures/export-test-data.js';

// Usar fixture específico
const data = sampleLegalBrief;

// Obter por tipo
const brief = getFixture('legal_brief');

// Todos os fixtures
import { getAllFixtures } from '../fixtures/export-test-data.js';
const allFixtures = getAllFixtures();
```

## 🛠️ Utilitários de Teste

Arquivo `tests/helpers/test-utils.js` contém funções úteis:

### Verificação de Servidor

```javascript
import { isServerRunning, waitForServer } from './helpers/test-utils.js';

const running = await isServerRunning();
await waitForServer('http://localhost:3000', 30000);
```

### Validação de Buffers

```javascript
import { isPDFBuffer, isDOCXBuffer } from './helpers/test-utils.js';

const pdf = await response.arrayBuffer();
assert.ok(isPDFBuffer(Buffer.from(pdf)));
```

### HTML Validation

```javascript
import { isValidHTML, extractHTMLTitle } from './helpers/test-utils.js';

assert.ok(isValidHTML(htmlString));
const title = extractHTMLTitle(htmlString);
```

### Estatísticas de Texto

```javascript
import { getTextStats } from './helpers/test-utils.js';

const stats = getTextStats(document);
// { length, lines, words, characters, paragraphs }
```

## 📝 Escrevendo Novos Testes

### Template de Teste Unitário

```javascript
import { describe, it, before } from 'node:test';
import assert from 'node:assert';

let MyService;

before(async () => {
  const module = await import('../../src/services/my-service.js');
  MyService = module.default;
});

describe('MyService - Feature Name', () => {
  it('deve fazer algo específico', async () => {
    const result = await MyService.doSomething();
    assert.strictEqual(result, expected);
  });

  it('deve lançar erro em caso inválido', async () => {
    await assert.rejects(
      async () => await MyService.doInvalid(),
      { message: /Expected error/ }
    );
  });
});
```

### Template de Teste de Integração

```javascript
describe('API Endpoint - POST /api/my-endpoint', () => {
  it('deve retornar sucesso', async () => {
    if (!await isServerRunning()) {
      console.warn('⚠️  Servidor não está rodando - teste pulado');
      return;
    }

    const response = await fetch('http://localhost:3000/api/my-endpoint', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: 'test' })
    });

    assert.strictEqual(response.ok, true);
    const json = await response.json();
    assert.ok(json.success);
  });
});
```

## 🔍 Debugging Testes

### Verbose Mode

```bash
NODE_OPTIONS='--trace-warnings' npm run test:unit
```

### Rodar Teste Específico

```bash
node --test tests/unit/export-service.test.js --test-name-pattern="detectar legal_brief"
```

### Logs de Teste

```javascript
// Dentro do teste
console.log('Debug info:', data);
```

### Timeout Customizado

```javascript
it('teste que demora', async function() {
  this.timeout = 60000; // 60 segundos
  // ...
});
```

## ⚙️ Configuração

### Variáveis de Ambiente

```bash
# URL do servidor para testes de integração
export TEST_SERVER_URL=http://localhost:3000

# Modo de teste
export NODE_ENV=test
```

### Requisitos

- Node.js 18+
- Puppeteer instalado (para testes de PDF)
- Servidor rodando (para testes de integração)

## 📈 CI/CD Integration

### GitHub Actions

```yaml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm install
      - run: npm run test:unit
```

## 🐛 Troubleshooting

### Puppeteer não funciona

```bash
# Linux
sudo apt-get install -y chromium-browser

# Mac
brew install chromium

# Ou use flag
export PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
```

### Testes de integração falhando

1. Verifique se servidor está rodando: `curl http://localhost:3000/api/export/status`
2. Verifique porta: `lsof -i :3000`
3. Logs do servidor: `npm start`

### Timeouts

Aumente timeout nos testes:

```javascript
this.timeout = 30000; // 30 segundos
```

## 📚 Recursos

- [Node.js Test Runner](https://nodejs.org/api/test.html)
- [Assert API](https://nodejs.org/api/assert.html)
- [Puppeteer Docs](https://pptr.dev/)

## 🎉 Contribuindo

Para adicionar novos testes:

1. Crie arquivo em `tests/unit/` ou `tests/integration/`
2. Use fixtures existentes ou crie novos em `tests/fixtures/`
3. Siga padrões de nomenclatura: `*.test.js`
4. Execute testes: `npm run test:unit`
5. Documente no README

---

**Última atualização:** 21 de janeiro de 2026
**Versão:** 1.0.0
**Mantido por:** ROM Agent Development Team
