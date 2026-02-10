# ROM Agent - Extração v2.0 com 18 Ficheiros Completos

## 🎯 Visão Geral

O sistema de extração v2.0 substitui os **resumos simplórios** anteriores por uma **análise jurídica profunda e completa**, gerando **18 ficheiros estruturados** com informações acionáveis.

### ❌ Problema Anterior (v1.0)

- Apenas 6-8 arquivos básicos
- Resumos genéricos e inúteis
- Sem análise jurídica real
- Sem extração de entidades
- Sem recomendações práticas
- Perda do processo completo em TXT

### ✅ Solução v2.0

- **18 ficheiros completos** organizados em 7 categorias
- **Análise jurídica profunda** com IA (Claude Sonnet)
- **Extração inteligente de entidades** (partes, valores, datas, leis)
- **Resumos executivos** em múltiplos níveis
- **Análise de risco** com recomendações estratégicas
- **Texto completo preservado** (original + normalizado)
- **Estratégia de custos**: Haiku (barato) + Sonnet (premium)

---

## 📂 Estrutura dos 18 Ficheiros

```
ROM-Extractions-v2/[NOME-DO-DOCUMENTO]/
│
├── 01_NUCLEO/                                  # TEXTO BASE
│   ├── 01_texto_completo_original.txt         # Texto bruto extraído (INTOCÁVEL)
│   └── 02_texto_normalizado.txt               # Texto após 91 ferramentas
│
├── 02_RESUMOS/                                 # RESUMOS EXECUTIVOS
│   ├── 03_resumo_executivo.md                 # Resumo completo 1-2 páginas
│   ├── 04_resumo_ultra_curto.md               # 1 parágrafo + palavras-chave
│   └── 05_pontos_criticos.md                  # Alertas e pontos de atenção
│
├── 03_ANALISES/                                # ANÁLISES ANALÍTICAS
│   ├── 06_analise_completa.md                 # Análise jurídica profunda
│   ├── 07_analise_juridica.json               # Análise estruturada JSON
│   └── 08_analise_temporal.md                 # Cronologia de eventos
│
├── 04_ENTIDADES/                               # ENTIDADES EXTRAÍDAS
│   ├── 09_entidades.json                      # Todas entidades identificadas
│   ├── 10_partes_envolvidas.json              # CPF, CNPJ, OAB, partes
│   ├── 11_valores_monetarios.json             # Valores financeiros
│   └── 12_datas_importantes.json              # Datas e prazos
│
├── 05_JURIDICO/                                # ANÁLISE JURÍDICA
│   ├── 13_citacoes_legais.json                # Leis, artigos citados
│   ├── 14_classificacao_documental.json       # Tipo, área, complexidade
│   └── 15_analise_risco.md                    # Riscos e recomendações
│
├── 06_METADADOS/                               # METADADOS E ESTATÍSTICAS
│   ├── 16_metadata_completo.json              # Metadados enriquecidos
│   ├── 17_estatisticas_processamento.json     # Logs de processamento
│   └── 18_indice_navegacao.md                 # Índice navegável (START HERE)
│
└── 07_ANEXOS/                                  # ANEXOS
    ├── images/                                 # Imagens extraídas
    ├── audio/                                  # Transcrições
    └── attachments/                            # Anexos diversos
```

---

## 🚀 Como Usar

### Opção 1: Via API REST

```bash
# Enviar documento para extração assíncrona
curl -X POST http://localhost:3000/api/extraction/v2/extract \
  -F "file=@documento.pdf" \
  -F "outputFolderName=Caso_XYZ" \
  -F "projectName=Escritorio_ABC" \
  -F "uploadToKB=true" \
  -F "async=true"

# Resposta:
{
  "success": true,
  "jobId": "job-1234567890-abc123",
  "statusUrl": "/api/extraction/v2/status/job-1234567890-abc123",
  "resultUrl": "/api/extraction/v2/result/job-1234567890-abc123"
}

# Verificar status
curl http://localhost:3000/api/extraction/v2/status/job-1234567890-abc123

# Obter resultado
curl http://localhost:3000/api/extraction/v2/result/job-1234567890-abc123
```

### Opção 2: Via JavaScript

```javascript
import { extractDocumentWithFullAnalysis } from './src/services/document-extraction-service.js';

const resultado = await extractDocumentWithFullAnalysis({
  filePath: '/caminho/para/documento.pdf',
  outputFolderName: 'Caso_XYZ_2026',
  projectName: 'Escritorio_ABC',
  uploadToKB: true,
  useHaikuForExtraction: true,   // Usar Haiku (barato) para extração
  useSonnetForAnalysis: true     // Usar Sonnet (premium) para análise
});

console.log('Arquivos gerados:', resultado.totalArquivos);
console.log('Pasta:', resultado.pastaBase);
console.log('Resumo executivo:', resultado.arquivosPrincipais.resumoExecutivo);
```

### Opção 3: Via Linha de Comando

```bash
# Criar script de teste
node scripts/test-extraction-v2.js /caminho/para/documento.pdf
```

---

## 📊 Estratégia de Custos (Haiku vs Sonnet)

### Tarefas com Haiku (Barato - ~$0.25/1M tokens input)

✅ Extração inicial de texto
✅ Normalização (91 ferramentas)
✅ Extração de entidades (regex + patterns)
✅ Classificação básica do documento
✅ Resumo ultra curto
✅ Análise temporal (cronologia)

### Tarefas com Sonnet (Premium - ~$3/1M tokens input)

✅ Resumo executivo completo
✅ Pontos críticos e alertas
✅ Análise jurídica profunda
✅ Análise de risco com recomendações
✅ Insights estratégicos

### Custo Estimado por Documento

| Tamanho do Documento | Custo Estimado | Tempo Estimado |
|----------------------|----------------|----------------|
| **Pequeno** (< 10 páginas) | $0.05 - $0.15 | 30-60s |
| **Médio** (10-50 páginas) | $0.15 - $0.50 | 1-3min |
| **Grande** (50-200 páginas) | $0.50 - $2.00 | 3-10min |
| **Muito grande** (> 200 páginas) | $2.00 - $5.00 | 10-30min |

---

## 📖 Detalhamento dos Principais Ficheiros

### 03_resumo_executivo.md

Resumo completo em 1-2 páginas contendo:

- Identificação do documento (tipo, processo, partes)
- Objeto principal
- Valores envolvidos
- Principais argumentos
- Pontos críticos
- Status processual
- Recomendações práticas

**Público-alvo**: Advogados, gestores de escritório

### 05_pontos_criticos.md

Análise de alertas estruturada em:

- 🔴 **Alertas Vermelhos**: Atenção IMEDIATA
- 🟡 **Alertas Amarelos**: Monitoramento
- 🟢 **Pontos Positivos**: Aspectos favoráveis
- 📊 **Probabilidade de Êxito**: Estimativa percentual

**Público-alvo**: Tomadores de decisão

### 06_analise_completa.md

Análise jurídica profunda com:

1. Contexto processual (natureza, histórico, partes)
2. Análise de contratos/documentos base
3. Análise jurídica específica (teses, fundamentos)
4. Análise de riscos para cada parte
5. Conclusão analítica com probabilidade de êxito

**Público-alvo**: Advogados seniores, pareceristas

### 09_entidades.json

Todas as entidades extraídas:

```json
{
  "processosJudiciais": [...],
  "cpfs": [...],
  "cnpjs": [...],
  "oabs": [...],
  "valoresMonetarios": [...],
  "datas": [...],
  "citacoesLegais": {
    "leis": [...],
    "artigos": [...],
    "paragrafos": [...]
  },
  "estatisticas": {...}
}
```

**Público-alvo**: Sistemas automatizados, análise quantitativa

### 15_analise_risco.md

Análise estratégica de riscos:

- Matriz de riscos (críticos, moderados, baixos)
- Riscos por parte processual
- Cenários prováveis (otimista, realista, pessimista)
- Recomendações estratégicas
- Pontos de atenção imediatos

**Público-alvo**: Gestão estratégica, clientes

### 18_indice_navegacao.md

**START HERE** - Índice completo com:

- Links para todos os 18 arquivos
- Estatísticas rápidas
- Navegação guiada por perfil de usuário
- Informações técnicas do processamento

**Público-alvo**: TODOS - ponto de entrada

---

## 🔧 Integração com Sistema Existente

### Registrar a rota no app.js

```javascript
// app.js ou index.js
import extractionV2Routes from './src/routes/extraction-v2.js';

app.use('/api/extraction/v2', extractionV2Routes);
```

### Usar no código existente

```javascript
// Migração gradual - usar v2.0 para novos documentos
import { pipelineCompletoV2 } from './src/modules/extracao.js';

// Exemplo de uso
const resultado = await pipelineCompletoV2('/caminho/documento.pdf', {
  outputFolderName: 'Processo_ABC',
  projectName: 'Escritorio_XYZ',
  uploadToKB: true
});
```

---

## 📈 Melhorias em Relação à v1.0

| Aspecto | v1.0 (Antiga) | v2.0 (Nova) |
|---------|---------------|-------------|
| **Arquivos gerados** | 6-8 básicos | 18 completos |
| **Resumo executivo** | Genérico | Estruturado e acionável |
| **Análise jurídica** | ❌ Não existe | ✅ Profunda com IA |
| **Entidades extraídas** | ❌ Não | ✅ Completa (partes, valores, datas, leis) |
| **Análise de risco** | ❌ Não | ✅ Com recomendações |
| **Classificação** | ❌ Manual | ✅ Automática |
| **Cronologia** | ❌ Não | ✅ Linha do tempo completa |
| **Texto original** | ⚠️ Sobrescrito | ✅ Preservado + normalizado |
| **Custo por documento** | ~$0.50 | ~$0.15-2.00 (otimizado) |
| **Tempo processamento** | 2-5 min | 1-10 min (paralelizado) |
| **Insights acionáveis** | ❌ Não | ✅ Sim |

---

## 🧪 Testes

### Executar teste básico

```bash
# Testar com documento de exemplo
node scripts/test-extraction-v2.js ./docs/exemplo.pdf

# Verificar saída
ls -la ~/Desktop/ROM-Extractions-v2/
```

### Validar arquivos gerados

```bash
# Verificar se todos os 18 arquivos foram criados
ls -la ~/Desktop/ROM-Extractions-v2/[PASTA]/*/

# Deve mostrar:
# - 01_NUCLEO/ (2 arquivos)
# - 02_RESUMOS/ (3 arquivos)
# - 03_ANALISES/ (3 arquivos)
# - 04_ENTIDADES/ (4 arquivos)
# - 05_JURIDICO/ (3 arquivos)
# - 06_METADADOS/ (3 arquivos)
# - 07_ANEXOS/ (3 pastas)
```

---

## 🐛 Troubleshooting

### Erro: "Bedrock not configured"

```bash
# Verificar variáveis de ambiente
echo $AWS_ACCESS_KEY_ID
echo $AWS_SECRET_ACCESS_KEY
echo $AWS_REGION

# Configurar se necessário
export AWS_REGION=us-east-1
```

### Erro: "Out of memory"

Para documentos muito grandes (> 500 páginas), aumentar limite de memória:

```bash
node --max-old-space-size=4096 scripts/test-extraction-v2.js documento-grande.pdf
```

### Arquivos não gerados

Verificar logs:

```bash
# Ver logs de erro
tail -f logs/extraction.log

# Ver log específico do processamento
cat ~/Desktop/ROM-Extractions-v2/[PASTA]/06_METADADOS/17_estatisticas_processamento.json
```

---

## 📚 Exemplos de Uso

### Exemplo 1: Extração simples

```javascript
const resultado = await extractDocumentWithFullAnalysis({
  filePath: './peticao.pdf',
  outputFolderName: 'Peticao_Inicial_2026'
});

console.log('Resumo:', resultado.arquivosPrincipais.resumoExecutivo);
```

### Exemplo 2: Com upload para Knowledge Base

```javascript
const resultado = await extractDocumentWithFullAnalysis({
  filePath: './sentenca.pdf',
  outputFolderName: 'Sentenca_Processo_ABC',
  projectName: 'Escritorio_Silva_Advogados',
  uploadToKB: true  // Upload automático
});
```

### Exemplo 3: Lote de documentos

```javascript
const documentos = [
  './doc1.pdf',
  './doc2.pdf',
  './doc3.pdf'
];

for (const doc of documentos) {
  const nome = path.basename(doc, '.pdf');
  await extractDocumentWithFullAnalysis({
    filePath: doc,
    outputFolderName: `Lote_${Date.now()}_${nome}`
  });
}
```

---

## 🎯 Próximos Passos

1. ✅ Ler o arquivo `18_indice_navegacao.md` para entender a estrutura
2. ✅ Começar pelo `03_resumo_executivo.md` para visão geral
3. ✅ Consultar `05_pontos_criticos.md` para alertas
4. ✅ Revisar `15_analise_risco.md` para decisões estratégicas
5. ✅ Explorar entidades em `04_ENTIDADES/` conforme necessidade

---

## 📞 Suporte

Para dúvidas ou problemas:

1. Consulte este README
2. Verifique logs em `17_estatisticas_processamento.json`
3. Entre em contato com a equipe de desenvolvimento

---

**ROM Agent v2.0** - Extração Inteligente de Documentos Jurídicos
© 2026 - Todos os direitos reservados
