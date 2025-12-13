# ROM - Redator de Obras Magistrais

Agente de IA para Redação de Peças Jurídicas com Excelência.

## Instalação

```bash
cd ROM-Agent
npm install
```

## Configuração

1. Copie o arquivo de exemplo:
```bash
cp .env.example .env
```

2. Edite o arquivo `.env` e adicione sua chave da API Anthropic:
```
ANTHROPIC_API_KEY=sua_chave_aqui
```

## Uso

### CLI Interativo
```bash
npm run cli
```

### Como Módulo
```javascript
import { ROMAgent } from './src/index.js';

const agent = new ROMAgent(process.env.ANTHROPIC_API_KEY);
const resposta = await agent.processar('Redija uma petição inicial');
console.log(resposta);
```

## Capacidades

- ✅ Redação de peças jurídicas (cíveis, criminais, trabalhistas)
- ✅ Pesquisa de legislação nacional e internacional
- ✅ Consulta de jurisprudência em todos os tribunais
- ✅ Análise e extração de processos judiciais (PDF)
- ✅ Correção ortográfica e gramatical
- ✅ Formatação profissional com papel timbrado
- ✅ Criação de tabelas, fluxogramas e linhas do tempo
- ✅ Busca de artigos científicos jurídicos

## Ferramentas Integradas

### Legislação
- Constituição Federal + 132 Emendas
- Códigos: CC, CPC, CP, CPP, CLT, CDC, CTN, ECA, LEP, e mais
- Tratados internacionais (DUDH, CADH, etc.)
- Súmulas do STF, STJ, TST, TSE

### Tribunais
- Superiores: STF, STJ, TST, TSE, STM
- TRFs: 1ª a 6ª Região
- TJs: Todos os 27 estados
- TRTs: 24 regiões
- Justiça Militar e Desportiva

### Web Search
- JusBrasil
- Conjur, Migalhas, JOTA
- SciELO, BDTD, Google Scholar
- PubMed, IEEE, Scopus

### Extração de PDFs
- 33 ferramentas de processamento
- 10 processadores de otimização
- Divisão inteligente em chunks
- Extração de metadados jurídicos

## Estrutura do Projeto

```
ROM-Agent/
├── src/
│   ├── index.js        # Agente principal
│   ├── cli.js          # Interface de linha de comando
│   └── modules/
│       ├── legislacao.js   # Legislação e códigos
│       ├── tribunais.js    # Integração com tribunais
│       ├── webSearch.js    # Busca web jurídica
│       ├── portugues.js    # Correção e estilo
│       ├── documentos.js   # Formatação de documentos
│       └── extracao.js     # Extração de PDFs
├── config/
├── templates/
├── package.json
└── README.md
```

## Comandos do CLI

| Comando | Descrição |
|---------|-----------|
| `/ajuda` | Exibe ajuda |
| `/limpar` | Limpa histórico |
| `/prompts` | Lista prompts |
| `/tribunais` | Lista tribunais |
| `/codigos` | Lista códigos |
| `/pecas` | Lista tipos de peças |
| `/extrair [pdf]` | Extrai texto de PDF |
| `/sair` | Encerra |

## Licença

MIT
