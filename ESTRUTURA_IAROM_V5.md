# ESTRUTURA IAROM V5.0 - DIAGRAMA COMPLETO

---

## ORIGEM: Desktop (IAROM_PROMPTS_REFATORADOS_CLAUDE_AI)

```
~/Desktop/IAROM_PROMPTS_REFATORADOS_CLAUDE_AI/
│
├── 01_PROMPT_MASTER/                           # 5 arquivos | 7 KB
│   ├── IAROM_PROMPT_MASTER_v1.0.txt           → KB Claude.AI + ROM-Agent
│   ├── IAROM_ORQUESTRADOR_MULTIAGENTE_v1.0.txt → KB Claude.AI + ROM-Agent
│   ├── CUSTOM_INSTRUCTIONS_V5.0.txt            → KB Claude.AI + ROM-Agent
│   ├── COMPARATIVO_CUSTOM_INSTRUCTIONS.md
│   └── RELATORIO_ATUALIZACAO_CUSTOM_INSTRUCTIONS.md
│
├── 02_MODULOS/                                 # 8 arquivos | 140 KB
│   ├── IAROM_MASTER_CORE_v1.0.txt             → KB Claude.AI + ROM-Agent
│   ├── IAROM_MOD_FUNDAMENTOS_LEGAIS_v1.0.txt  → KB Claude.AI + ROM-Agent
│   ├── IAROM_MOD_VALIDACAO_v1.0.txt           → KB Claude.AI + ROM-Agent
│   ├── IAROM_MOD_TRANSCRICAO_v1.0.txt         → KB Claude.AI + ROM-Agent
│   ├── IAROM_MOD_FORMATACAO_v1.0.txt          → KB Claude.AI + ROM-Agent
│   ├── IAROM_MOD_PREQUESTIONAMENTO_STJ_v1.0.txt → KB Claude.AI + ROM-Agent
│   ├── IAROM_MOD_DOUTRINA_v1.0.txt            → KB Claude.AI + ROM-Agent
│   └── PROMPT_ANALISE_PROCESSUAL_V5.0.txt     → KB Claude.AI + ROM-Agent
│
├── 03_PROMPTS_ESPECIFICOS/                     # 92 arquivos .txt | 150 KB
│   ├── A_FORENSE/                             → ROM-Agent
│   ├── B_ANALISE_REVISAO/                     → ROM-Agent
│   ├── B_RECURSOS_CIVEIS/                     → ROM-Agent
│   ├── C_RECURSOS_CRIMINAIS/                  → ROM-Agent
│   ├── C_SISTEMA_ROM/                         → ROM-Agent
│   ├── C_TRABALHISTAS/                        → ROM-Agent
│   ├── D_INSTRUCOES_GUIAS/                    → ROM-Agent
│   ├── D_PETICOES_INICIAIS/                   → ROM-Agent
│   ├── E_EXTRAJUDICIAIS/                      → ROM-Agent
│   └── F_CRIMINAIS/                           → ROM-Agent
│
├── 04_RELATORIOS/                              # 7 arquivos .md | 80 KB
│   ├── ANALISE_SISTEMA_ROM_COMPLETA.md        → ROM-Agent/docs
│   ├── COMPARATIVO_PROMPT_FORENSE_UNIVERSAL.md → ROM-Agent/docs
│   ├── FICHA_AVALIACAO_PROMPT_FORENSE_UNIVERSAL.md → ROM-Agent/docs
│   ├── MATRIZ_COMPARATIVA_8_PROMPTS.md        → ROM-Agent/docs
│   ├── RELATORIO_CONSOLIDADO_MULTIAGENTE_V5.0.md → ROM-Agent/docs
│   ├── RELATORIO_CRIACAO_PROMPTS_V5.0.md      → ROM-Agent/docs
│   └── RELATORIO_FINAL_MULTIAGENTE_V5.0.md    → ROM-Agent/docs
│
├── 05_DOCUMENTACAO/                            # 10 arquivos .md | 70 KB
│   ├── INDICE_GERAL_SISTEMA_IAROM.md          → ROM-Agent/docs
│   ├── CATALOGO_MESTRE_PROMPTS_V5.0.md        → ROM-Agent/docs
│   ├── MATRIZ_COMPATIBILIDADE_PROMPTS.md      → ROM-Agent/docs
│   ├── IAROM_GU001_WORKFLOWS_ESPECIFICOS.txt  → ROM-Agent/docs
│   ├── IAROM_GUIA_MESTRE_USO_v2.0.txt         → ROM-Agent/docs
│   ├── 00_INDICE_CATALOGACAO_AGENTE_2.md      → ROM-Agent/docs
│   ├── COMPARATIVO_GUIAS.md                   → ROM-Agent/docs
│   ├── FICHA_AVALIACAO_GUIAS.md               → ROM-Agent/docs
│   ├── README_REFATORACAO_GUIAS.md            → ROM-Agent/docs
│   └── RESUMO_EXECUTIVO_CATALOGACAO.md        → ROM-Agent/docs
│
├── 99_BACKUP_PRE_V5/                           # Backup (não migrar)
└── README.md                                   → ROM-Agent/docs

TOTAL: 122 arquivos | ~300 KB
```

---

## DESTINO: ROM-Agent (GitHub/Render)

```
~/ROM-Agent/
│
├── data/
│   ├── prompts/
│   │   ├── global/                            ◄── 92 prompts .txt (flat)
│   │   │   ├── PROMPT_PETICAO_INICIAL_CIVEL_v1.0.txt
│   │   │   ├── PROMPT_CONTESTACAO_TRABALHISTA_v1.0.txt
│   │   │   ├── PROMPT_RECURSO_APELACAO_v1.0.txt
│   │   │   ├── [...88 prompts...]
│   │   │   └── README.md                      ◄── Índice de prompts
│   │   │
│   │   └── partners/                          ◄── MANTER (prompts parceiros)
│   │
│   ├── knowledge-base/                        ◄── Sistema IAROM
│   │   ├── modules/                           ◄── 8 módulos
│   │   │   ├── IAROM_MASTER_CORE_v1.0.txt
│   │   │   ├── IAROM_MOD_FUNDAMENTOS_LEGAIS_v1.0.txt
│   │   │   ├── IAROM_MOD_VALIDACAO_v1.0.txt
│   │   │   ├── IAROM_MOD_TRANSCRICAO_v1.0.txt
│   │   │   ├── IAROM_MOD_FORMATACAO_v1.0.txt
│   │   │   ├── IAROM_MOD_PREQUESTIONAMENTO_STJ_v1.0.txt
│   │   │   ├── IAROM_MOD_DOUTRINA_v1.0.txt
│   │   │   └── PROMPT_ANALISE_PROCESSUAL_V5.0.txt
│   │   │
│   │   └── master/                            ◄── 2 master prompts
│   │       ├── IAROM_PROMPT_MASTER_v1.0.txt
│   │       └── IAROM_ORQUESTRADOR_MULTIAGENTE_v1.0.txt
│   │
│   ├── custom-instructions/                   ◄── MANTER + adicionar V5.0
│   │   ├── [...arquivos existentes...]
│   │   └── CUSTOM_INSTRUCTIONS_V5.0.txt       ◄── NOVO
│   │
│   └── [outras pastas mantidas]
│       ├── cache/
│       ├── casos/
│       ├── conversations.json
│       ├── extracted-texts/
│       ├── extractions/
│       ├── processos-extraidos/
│       ├── projects/
│       ├── sandbox/
│       └── uploads/
│
├── docs/
│   ├── iarom/                                 ◄── NOVA pasta documentação IAROM
│   │   ├── README_IAROM.md                    ◄── Índice geral
│   │   ├── INDICE_GERAL_SISTEMA_IAROM.md
│   │   ├── CATALOGO_MESTRE_PROMPTS_V5.0.md
│   │   ├── MATRIZ_COMPATIBILIDADE_PROMPTS.md
│   │   ├── IAROM_GU001_WORKFLOWS_ESPECIFICOS.txt
│   │   ├── IAROM_GUIA_MESTRE_USO_v2.0.txt
│   │   ├── 00_INDICE_CATALOGACAO_AGENTE_2.md
│   │   ├── COMPARATIVO_GUIAS.md
│   │   ├── FICHA_AVALIACAO_GUIAS.md
│   │   ├── README_REFATORACAO_GUIAS.md
│   │   ├── RESUMO_EXECUTIVO_CATALOGACAO.md
│   │   │
│   │   └── relatorios/                        ◄── Relatórios técnicos
│   │       ├── ANALISE_SISTEMA_ROM_COMPLETA.md
│   │       ├── COMPARATIVO_PROMPT_FORENSE_UNIVERSAL.md
│   │       ├── FICHA_AVALIACAO_PROMPT_FORENSE_UNIVERSAL.md
│   │       ├── MATRIZ_COMPARATIVA_8_PROMPTS.md
│   │       ├── RELATORIO_CONSOLIDADO_MULTIAGENTE_V5.0.md
│   │       ├── RELATORIO_CRIACAO_PROMPTS_V5.0.md
│   │       └── RELATORIO_FINAL_MULTIAGENTE_V5.0.md
│   │
│   └── [docs existentes mantidas]
│       ├── API.md
│       ├── ARCHITECTURE.md
│       ├── DEPLOYMENT.md
│       └── [...]
│
├── scripts/
│   ├── deploy-iarom-v5.sh                     ◄── NOVO script de deploy
│   └── [scripts existentes mantidos]
│
├── PLANO_DEPLOY_IAROM_V5.md                   ◄── NOVO plano completo
├── DEPLOY_V5_RESUMO_EXECUTIVO.md              ◄── NOVO resumo
├── CHECKLIST_DEPLOY_V5.md                     ◄── NOVO checklist
├── QUICK_START_DEPLOY_V5.md                   ◄── NOVO quick start
├── ESTRUTURA_IAROM_V5.md                      ◄── NOVO (este arquivo)
│
└── [arquivos existentes mantidos]
    ├── src/
    ├── frontend/
    ├── config/
    ├── render.yaml
    ├── package.json
    ├── README.md
    └── [...]
```

---

## RENDER (Produção - Disco Persistente)

```
/var/data/                                      ◄── Disco persistente 100GB
│
├── prompts/
│   └── global/                                ◄── 92 prompts .txt
│       ├── PROMPT_PETICAO_INICIAL_CIVEL_v1.0.txt
│       ├── PROMPT_CONTESTACAO_TRABALHISTA_v1.0.txt
│       └── [...90 prompts...]
│
├── knowledge-base/
│   ├── modules/                               ◄── 8 módulos IAROM
│   │   ├── IAROM_MASTER_CORE_v1.0.txt
│   │   ├── IAROM_MOD_FUNDAMENTOS_LEGAIS_v1.0.txt
│   │   └── [...6 módulos...]
│   │
│   └── master/                                ◄── 2 master prompts
│       ├── IAROM_PROMPT_MASTER_v1.0.txt
│       └── IAROM_ORQUESTRADOR_MULTIAGENTE_v1.0.txt
│
├── custom-instructions/
│   └── CUSTOM_INSTRUCTIONS_V5.0.txt           ◄── Custom Instructions V5.0
│
├── upload/                                    ◄── Uploads de usuários
├── extracted/                                 ◄── PDFs extraídos
└── processed/                                 ◄── Processados
```

---

## CLAUDE.AI (Knowledge Base Manual)

```
Claude.AI Project KB                           ◄── Carregar MANUALMENTE
│
├── IAROM_PROMPT_MASTER_v1.0.txt              ◄── 1. Prompt Master
├── IAROM_ORQUESTRADOR_MULTIAGENTE_v1.0.txt   ◄── 2. Orquestrador
├── CUSTOM_INSTRUCTIONS_V5.0.txt               ◄── 3. Custom Instructions
│
├── IAROM_MASTER_CORE_v1.0.txt                ◄── 4. Módulo Core
├── IAROM_MOD_FUNDAMENTOS_LEGAIS_v1.0.txt     ◄── 5. Fundamentos Legais
├── IAROM_MOD_VALIDACAO_v1.0.txt              ◄── 6. Validação
├── IAROM_MOD_TRANSCRICAO_v1.0.txt            ◄── 7. Transcrição
├── IAROM_MOD_FORMATACAO_v1.0.txt             ◄── 8. Formatação
├── IAROM_MOD_PREQUESTIONAMENTO_STJ_v1.0.txt  ◄── 9. Prequestionamento
├── IAROM_MOD_DOUTRINA_v1.0.txt               ◄── 10. Doutrina
└── PROMPT_ANALISE_PROCESSUAL_V5.0.txt        ◄── 11. Análise Processual

TOTAL: 11 arquivos | ~150 KB
USAR PARA: Análise forense manual no Claude.AI
NÃO PRECISA: Ir para GitHub/Render
```

---

## FLUXO DE DADOS

### 1. Prompts Específicos (92 arquivos)

```
Desktop/03_PROMPTS_ESPECIFICOS/*/*.txt
         ↓
ROM-Agent/data/prompts/global/
         ↓
GitHub: rodolfo-svg/ROM-Agent
         ↓
Render Deploy (Auto)
         ↓
/var/data/prompts/global/
         ↓
API: GET /api/prompts
         ↓
Frontend: Seleção de prompt
         ↓
Agente: Geração de peça
```

### 2. Módulos IAROM (8 arquivos)

```
Desktop/02_MODULOS/*.txt
         ↓
ROM-Agent/data/knowledge-base/modules/
         ↓
GitHub: rodolfo-svg/ROM-Agent
         ↓
Render Deploy (Auto)
         ↓
/var/data/knowledge-base/modules/
         ↓
API: GET /api/knowledge-base
         ↓
Agente: Carregamento sob demanda
         ↓
Análise/Processamento
```

### 3. Documentação (17 arquivos)

```
Desktop/05_DOCUMENTACAO/*.md + 04_RELATORIOS/*.md
         ↓
ROM-Agent/docs/iarom/
         ↓
GitHub: rodolfo-svg/ROM-Agent
         ↓
Documentação acessível via:
  - GitHub web interface
  - Clone local
  - Render (código-fonte)
```

### 4. KB Claude.AI (11 arquivos - Manual)

```
Desktop/01_PROMPT_MASTER/*.txt + 02_MODULOS/*.txt
         ↓
COPIAR MANUALMENTE para Claude.AI
         ↓
Claude.AI Project > Knowledge Base
         ↓
Análise forense manual
         ↓
Revisão de processos
```

---

## SEPARAÇÃO DE RESPONSABILIDADES

### ROM-Agent (Agente Autônomo)

**Usa:**
- 92 prompts específicos (criação de peças)
- 8 módulos IAROM (análise automática)
- Custom Instructions V5.0 (comportamento)

**Não usa:**
- Documentação (apenas referência)
- Relatórios (apenas referência)

**Finalidade:**
- Sistema autônomo em produção
- Criação automatizada de peças
- API pública

### Claude.AI KB (Uso Manual)

**Usa:**
- 11 arquivos core do IAROM
- Prompt Master + Orquestrador
- Módulos de análise

**Não usa:**
- 92 prompts específicos (muito grande para KB)
- Documentação (já está em docs/)

**Finalidade:**
- Análise forense profunda
- Revisão manual de processos
- Consultoria especializada

---

## TAMANHOS E LIMITES

### Origem (Desktop)

```
01_PROMPT_MASTER/         7 KB
02_MODULOS/              140 KB
03_PROMPTS_ESPECIFICOS/  150 KB
04_RELATORIOS/            80 KB
05_DOCUMENTACAO/          70 KB
────────────────────────────
TOTAL:                   447 KB
```

### Destino (ROM-Agent/GitHub)

```
data/prompts/global/              150 KB  (92 prompts)
data/knowledge-base/              140 KB  (10 módulos)
data/custom-instructions/           5 KB  (1 arquivo)
docs/iarom/                       150 KB  (17 docs)
────────────────────────────────────────
TOTAL:                            445 KB
```

### Render (Disco Persistente)

```
/var/data/prompts/                150 KB
/var/data/knowledge-base/         140 KB
/var/data/custom-instructions/      5 KB
────────────────────────────────────────
TOTAL:                            295 KB

Espaço disponível: 100 GB
Uso adicional: 0.0003% (insignificante)
```

### Claude.AI KB

```
11 arquivos IAROM                 150 KB

Limite KB Claude.AI: 10 MB por arquivo
Total permitido: ~100 MB por projeto
Uso: 0.15 MB de 100 MB (0.15%)
```

---

## COMPATIBILIDADE

### Formatos de Arquivo

```
✅ .txt  → Prompts e módulos (padrão)
✅ .md   → Documentação (padrão)
❌ .pdf  → Não usar (não versionável)
❌ .docx → Não usar (binário)
```

### Nomenclatura

```
✅ CORRETO:  PROMPT_NOME_v1.0.txt
✅ CORRETO:  IAROM_MOD_NOME_v1.0.txt
❌ ERRADO:   PROMPT_NOME_V5_0.txt
❌ ERRADO:   prompt-nome-v5.0.txt
```

### Codificação

```
✅ UTF-8 (padrão)
❌ Latin1/ISO-8859-1 (evitar)
❌ Windows-1252 (evitar)
```

---

## VERSIONAMENTO

### Git Tags

```
v5.0.0  ← Deploy IAROM V5.0 (esta versão)
v5.0.1  ← Correções menores
v5.1.0  ← Novas features
v6.0.0  ← Breaking changes
```

### Branches

```
main        ← Produção (protegida)
staging     ← Testes (auto-deploy)
feature/*   ← Desenvolvimento
fix/*       ← Correções urgentes
```

---

## RESUMO VISUAL

```
DESKTOP                    ROM-AGENT                  RENDER                CLAUDE.AI
────────                   ─────────                  ──────                ─────────

92 prompts     ──────►    data/prompts/    ──────►  /var/data/prompts/
.txt                      global/                    global/

8 módulos      ──────►    data/knowledge-  ──────►  /var/data/           ──────►  KB Project
.txt                      base/modules/              knowledge-base/              (manual)

2 master       ──────►    data/knowledge-  ──────►  /var/data/           ──────►  KB Project
prompts                   base/master/               knowledge-base/              (manual)

1 Custom       ──────►    data/custom-     ──────►  /var/data/           ──────►  KB Project
Instructions              instructions/              custom-instructions/         (manual)

17 docs        ──────►    docs/iarom/      ──────►  (código-fonte)
.md

                          │
                          ├─► GitHub       ──────►  Render Auto-Deploy
                          │   (versionado)
                          │
                          └─► API Pública
                              https://iarom.com.br
```

---

**Estrutura documentada em:** 23/03/2026
**Versão:** 1.0
**Total de arquivos migrados:** 122 arquivos | ~445 KB
**Impacto no Render:** +0.0003% de disco (insignificante)
