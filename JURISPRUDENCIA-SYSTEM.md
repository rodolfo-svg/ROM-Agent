# Sistema de Consulta de Jurisprudências - ROM Agent

## Visão Geral

Sistema completo de consulta e integração com múltiplas fontes oficiais de jurisprudência brasileira.

## Fontes Integradas

### 1. **DataJud (CNJ)** - Oficial
- **Arquivo**: `/src/services/datajud-service.js`
- **API**: https://datajud-api.cnj.jus.br/api_publica
- **Status**: Implementado (requer token de autenticação)
- **Funcionalidades**:
  - Busca de processos por tribunal, número, classe, assunto
  - Consulta de decisões e acórdãos
  - Busca de movimentações processuais
  - Validação de número de processo (padrão CNJ)
  - Cache de 1 hora para consultas

### 2. **JusBrasil**
- **Módulo**: `/src/modules/webSearch.js` (já existente)
- **URL**: https://www.jusbrasil.com.br
- **Tipos de busca**:
  - Jurisprudência
  - Notícias jurídicas
  - Artigos
  - Petições e modelos

### 3. **WebSearch Oficial**
- **Implementação**: Usa Google Search API ou busca direta nos sites dos tribunais
- **Fontes**:
  - Tribunais Superiores (STF, STJ, TST, TSE, STM)
  - Tribunais Regionais Federais (TRF1 a TRF6)
  - Tribunais de Justiça Estaduais
  - Tribunais Regionais do Trabalho

### 4. **JusIA** (Possível integração futura)
- Aguardando API pública ou parceria

## Arquivos Criados

```
/src/services/
├── datajud-service.js       # Integração com DataJud (CNJ)

/src/modules/ (já existentes)
├── tribunais.js              # Lista e informações de tribunais
├── webSearch.js              # Integração com sites jurídicos
├── legislacao.js             # Busca de legislação
```

## Como Usar

### 1. DataJud - Buscar Processos

```javascript
import { buscarProcessos } from './src/services/datajud-service.js';

// Buscar processos no STF
const resultado = await buscarProcessos({
  tribunal: 'STF',
  classe: 'Ação Direta de Inconstitucionalidade',
  assunto: 'Direitos Fundamentais',
  limit: 50
});
```

### 2. DataJud - Buscar Decisões

```javascript
import { buscarDecisoes } from './src/services/datajud-service.js';

const decisoes = await buscarDecisoes({
  tribunal: 'STJ',
  termo: 'responsabilidade civil',
  dataInicio: '2024-01-01',
  dataFim: '2024-12-31'
});
```

### 3. DataJud - Validar Número de Processo

```javascript
import { validarNumeroProcesso } from './src/services/datajud-service.js';

const validacao = validarNumeroProcesso('0000001-23.2024.8.02.0001');
console.log(validacao);
// {
//   valido: true,
//   sequencial: "0000001",
//   digito: "23",
//   ano: "2024",
//   segmento: "8",
//   tribunal: "02",
//   origem: "0001",
//   segmentoDescricao: "Justiça Estadual"
// }
```

### 4. Busca no JusBrasil

```javascript
import { buscarJusBrasil } from './src/modules/webSearch.js';

const resultado = await buscarJusBrasil('dano moral', 'jurisprudencia');
// Retorna URL de busca formatada para JusBrasil
```

### 5. Busca em Múltiplos Tribunais

```javascript
import { buscarJurisprudenciaMultipla } from './src/modules/tribunais.js';

const resultados = await buscarJurisprudenciaMultipla('ADI', ['STF', 'STJ']);
```

## Configuração

### Token DataJud

Para usar a API oficial do DataJud, configure o token no arquivo `.env`:

```env
DATAJUD_API_TOKEN=seu_token_aqui
```

**Como obter o token:**
1. Acesse https://datajud-wiki.cnj.jus.br/
2. Faça cadastro institucional
3. Solicite credenciais de acesso à API
4. Configure o token no ambiente

## Endpoints API Disponíveis

### GET /api/jurisprudencia/buscar
Busca jurisprudência em múltiplas fontes

**Query Params:**
- `termo` (string): Termo de busca
- `tribunal` (string): Sigla do tribunal (STF, STJ, etc.)
- `fonte` (string): datajud, jusbrasil, websearch, todas
- `dataInicio` (date): Filtro de data inicial
- `dataFim` (date): Filtro de data final
- `limit` (number): Limite de resultados

**Exemplo:**
```bash
curl "https://iarom.com.br/api/jurisprudencia/buscar?termo=dano+moral&tribunal=STJ&fonte=datajud"
```

### GET /api/jurisprudencia/processo/:numero
Busca processo específico por número CNJ

**Exemplo:**
```bash
curl "https://iarom.com.br/api/jurisprudencia/processo/0000001-23.2024.8.02.0001"
```

### GET /api/jurisprudencia/tribunais
Lista todos os tribunais disponíveis

### GET /api/jurisprudencia/classes
Lista classes processuais

### GET /api/jurisprudencia/assuntos
Lista assuntos processuais por área

## Tribunais Suportados

### Superiores
- STF - Supremo Tribunal Federal
- STJ - Superior Tribunal de Justiça
- STM - Superior Tribunal Militar
- TSE - Tribunal Superior Eleitoral
- TST - Tribunal Superior do Trabalho

### Regionais Federais
- TRF1 a TRF6

### Justiça Estadual
- Todos os 27 TJs (TJSP, TJRJ, TJMG, etc.)

### Justiça do Trabalho
- TRT1 a TRT24

## Cache

O sistema implementa cache automático de 1 hora para:
- Consultas ao DataJud
- Listas de classes e assuntos
- Informações de tribunais

Para limpar o cache:

```javascript
import { limparCache } from './src/services/datajud-service.js';
limparCache();
```

## Integração com Chat

O sistema está pronto para ser integrado ao chat do ROM Agent. Quando o usuário perguntar sobre jurisprudências, o agente pode:

1. Identificar termos de busca na mensagem
2. Consultar automaticamente as fontes relevantes
3. Apresentar resultados estruturados
4. Sugerir refinamentos de busca

## Próximos Passos

### Implementar
1. ✅ Serviço DataJud (CNJ)
2. ✅ Integração com JusBrasil (via módulo existente)
3. ✅ WebSearch para tribunais
4. ✅ Endpoints API REST (implementados em server.js:218-437)
5. ⏳ Integração com o chat
6. ⏳ Interface web para busca visual
7. ⏳ Exportação de resultados (PDF, DOCX)

### Melhorias Futuras
- Scraping com Puppeteer para tribunais sem API
- Integração com DOMJud (assinatura digital)
- Integração com Eproc
- Sistema de alertas de jurisprudência
- Análise de jurisprudência com IA
- Comparação de julgados
- Extração de ementas e teses

## Exemplo de Uso Completo

```javascript
// server.js ou onde você configurar os endpoints

import datajudService from './src/services/datajud-service.js';
import { buscarJurisprudencia } from './src/modules/tribunais.js';
import { buscarJusBrasil } from './src/modules/webSearch.js';

// Endpoint de busca unificada
app.get('/api/jurisprudencia/buscar', async (req, res) => {
  const { termo, tribunal, fonte = 'todas' } = req.query;

  const resultados = {
    termo,
    tribunal,
    fontes: []
  };

  try {
    // Buscar no DataJud
    if (fonte === 'datajud' || fonte === 'todas') {
      const datajud = await datajudService.buscarDecisoes({
        tribunal,
        termo
      });
      resultados.fontes.push({ fonte: 'DataJud (CNJ)', ...datajud });
    }

    // Buscar no JusBrasil
    if (fonte === 'jusbrasil' || fonte === 'todas') {
      const jusbrasil = await buscarJusBrasil(termo, 'jurisprudencia');
      resultados.fontes.push({ fonte: 'JusBrasil', ...jusbrasil });
    }

    // Buscar via WebSearch nos sites dos tribunais
    if (fonte === 'websearch' || fonte === 'todas') {
      const websearch = await buscarJurisprudencia(tribunal, termo);
      resultados.fontes.push({ fonte: 'WebSearch', ...websearch });
    }

    res.json({
      success: true,
      totalFontes: resultados.fontes.length,
      ...resultados
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});
```

## Notas Técnicas

- **Rate Limiting**: Implementar controles para não sobrecarregar APIs públicas
- **Autenticação**: DataJud requer token oficial (solicitar ao CNJ)
- **Scraping Ético**: Respeitar robots.txt e termos de uso dos sites
- **Caching**: Usar Redis em produção para melhor performance
- **Monitoramento**: Logs de todas as consultas para auditoria

## Licença e Uso

Este sistema é parte do **ROM Agent** e destina-se exclusivamente ao uso profissional jurídico, respeitando:
- Lei Geral de Proteção de Dados (LGPD)
- Código de Ética da OAB
- Termos de uso das fontes consultadas
- Direitos autorais das decisões judiciais

**© 2025 - ROM Agent - Sistema de Jurisprudência**
