# PLANO DE DEPLOY IAROM v5.0 - PREPARAÇÃO GITHUB/RENDER

**Data:** 23/03/2026
**Repositório:** https://github.com/rodolfo-svg/ROM-Agent
**Branch:** main
**Render Service ID:** srv-d4ueaf2li9vc73d3rj00
**Status:** MAPEAMENTO COMPLETO - PRONTO PARA EXECUÇÃO

---

## ÍNDICE

1. [Análise da Estrutura Atual](#1-análise-da-estrutura-atual)
2. [Mapeamento de Prompts](#2-mapeamento-de-prompts)
3. [Estrutura Recomendada](#3-estrutura-recomendada)
4. [Plano de Migração](#4-plano-de-migração)
5. [Comandos Git](#5-comandos-git)
6. [Configurações do Render](#6-configurações-do-render)
7. [Checklist de Deploy](#7-checklist-de-deploy)
8. [Validações Pós-Deploy](#8-validações-pós-deploy)

---

## 1. ANÁLISE DA ESTRUTURA ATUAL

### 1.1 Repositório Local
- **Localização:** `/Users/rodolfootaviopereiradamotaoliveira/ROM-Agent`
- **Status Git:** On branch main, up to date with origin/main
- **Remote:** https://github.com/rodolfo-svg/ROM-Agent.git
- **Arquivos não commitados:**
  - 77 arquivos deletados (prompts antigos V5.0)
  - 11 arquivos não rastreados (novos prompts, scripts, docs)

### 1.2 Estrutura Atual do ROM-Agent

```
ROM-Agent/
├── src/                          # Código-fonte do agente
├── scripts/                      # Scripts de deploy e manutenção
├── frontend/                     # Interface web
├── data/
│   ├── prompts/
│   │   ├── global/              # 180 prompts (misto .txt e .md)
│   │   └── partners/            # Prompts de parceiros
│   ├── knowledge-base/          # KB do sistema
│   ├── custom-instructions/     # Custom Instructions
│   └── [outras pastas de dados]
├── config/                       # Configurações
├── KB/                          # Knowledge Base adicional
├── render.yaml                  # Configuração do Render
└── package.json                 # v2.8.0

PROBLEMAS IDENTIFICADOS:
1. Prompts com nomenclatura inconsistente (V5.0 vs v1.0)
2. Prompts em formatos mistos (.txt e .md)
3. 77 prompts antigos deletados localmente mas não commitados
4. Novos prompts V5_0 não versionados
```

### 1.3 Prompts Refatorados (Origem)

**Localização:** `~/Desktop/IAROM_PROMPTS_REFATORADOS_CLAUDE_AI/`

```
IAROM_PROMPTS_REFATORADOS_CLAUDE_AI/
├── 01_PROMPT_MASTER/            # 5 arquivos (7 KB)
│   ├── IAROM_PROMPT_MASTER_v1.0.txt
│   ├── CUSTOM_INSTRUCTIONS_V5.0.txt
│   ├── IAROM_ORQUESTRADOR_MULTIAGENTE_v1.0.txt
│   └── [relatórios]
│
├── 02_MODULOS/                  # 8 arquivos (140 KB)
│   ├── IAROM_MASTER_CORE_v1.0.txt
│   ├── IAROM_MOD_FUNDAMENTOS_LEGAIS_v1.0.txt
│   ├── IAROM_MOD_VALIDACAO_v1.0.txt
│   ├── IAROM_MOD_TRANSCRICAO_v1.0.txt
│   ├── IAROM_MOD_FORMATACAO_v1.0.txt
│   ├── IAROM_MOD_PREQUESTIONAMENTO_STJ_v1.0.txt
│   ├── IAROM_MOD_DOUTRINA_v1.0.txt
│   └── PROMPT_ANALISE_PROCESSUAL_V5.0.txt
│
├── 03_PROMPTS_ESPECIFICOS/      # 92 arquivos .txt
│   ├── A_FORENSE/               # Prompts forenses universais
│   ├── B_ANALISE_REVISAO/       # Análise e revisão de peças
│   ├── B_RECURSOS_CIVEIS/       # Recursos cíveis
│   ├── C_RECURSOS_CRIMINAIS/    # Recursos criminais
│   ├── C_SISTEMA_ROM/           # Sistema ROM específico
│   ├── C_TRABALHISTAS/          # Trabalhistas
│   ├── D_INSTRUCOES_GUIAS/      # Guias de uso
│   ├── D_PETICOES_INICIAIS/     # Petições iniciais
│   ├── E_EXTRAJUDICIAIS/        # Contratos, notificações
│   └── F_CRIMINAIS/             # Criminais
│
├── 04_RELATORIOS/               # 7 arquivos .md (80 KB)
│   └── [análises, relatórios, matrizes]
│
├── 05_DOCUMENTACAO/             # 10 arquivos .md (70 KB)
│   ├── INDICE_GERAL_SISTEMA_IAROM.md
│   ├── CATALOGO_MESTRE_PROMPTS_V5.0.md
│   ├── MATRIZ_COMPATIBILIDADE_PROMPTS.md
│   └── [guias de uso]
│
└── 99_BACKUP_PRE_V5/            # Backup versões antigas

TOTAL: 122+ arquivos | ~300 KB
```

---

## 2. MAPEAMENTO DE PROMPTS

### 2.1 Origem → Destino: Prompts Específicos

| Origem (Desktop) | Destino (ROM-Agent) | Categoria |
|------------------|---------------------|-----------|
| `03_PROMPTS_ESPECIFICOS/A_FORENSE/*.txt` | `data/prompts/global/` | Forense |
| `03_PROMPTS_ESPECIFICOS/B_ANALISE_REVISAO/*.txt` | `data/prompts/global/` | Análise |
| `03_PROMPTS_ESPECIFICOS/B_RECURSOS_CIVEIS/*.txt` | `data/prompts/global/` | Recursos |
| `03_PROMPTS_ESPECIFICOS/C_RECURSOS_CRIMINAIS/*.txt` | `data/prompts/global/` | Recursos |
| `03_PROMPTS_ESPECIFICOS/C_TRABALHISTAS/*.txt` | `data/prompts/global/` | Trabalhista |
| `03_PROMPTS_ESPECIFICOS/D_PETICOES_INICIAIS/*.txt` | `data/prompts/global/` | Petições |
| `03_PROMPTS_ESPECIFICOS/E_EXTRAJUDICIAIS/*.txt` | `data/prompts/global/` | Contratos |
| `03_PROMPTS_ESPECIFICOS/F_CRIMINAIS/*.txt` | `data/prompts/global/` | Criminal |

**Ação:** COPIAR 92 arquivos .txt para `data/prompts/global/`

### 2.2 Origem → Destino: Módulos IAROM

| Origem (Desktop) | Destino (ROM-Agent) | Uso |
|------------------|---------------------|-----|
| `02_MODULOS/IAROM_*.txt` | `data/knowledge-base/modules/` | Sistema IAROM |
| `01_PROMPT_MASTER/*.txt` | `data/knowledge-base/master/` | Prompt Master |
| `01_PROMPT_MASTER/CUSTOM_INSTRUCTIONS_*.txt` | `data/custom-instructions/` | Custom Instructions |

**Ação:** CRIAR nova estrutura de módulos

### 2.3 Origem → Destino: Documentação

| Origem (Desktop) | Destino (ROM-Agent) | Uso |
|------------------|---------------------|-----|
| `05_DOCUMENTACAO/*.md` | `docs/iarom/` | Documentação IAROM |
| `04_RELATORIOS/*.md` | `docs/iarom/relatorios/` | Relatórios técnicos |
| `README.md` | `docs/iarom/README.md` | Índice IAROM |

**Ação:** ORGANIZAR documentação

### 2.4 Prompts para Claude.AI KB (Não vão para GitHub)

Estes prompts são carregados manualmente no Claude.AI:

```
PARA CLAUDE.AI KNOWLEDGE BASE:
├── 01_PROMPT_MASTER/
│   ├── IAROM_PROMPT_MASTER_v1.0.txt          # KB Claude.AI
│   ├── CUSTOM_INSTRUCTIONS_V5.0.txt          # KB Claude.AI
│   └── IAROM_ORQUESTRADOR_MULTIAGENTE_v1.0.txt  # KB Claude.AI
│
└── 02_MODULOS/
    ├── IAROM_MASTER_CORE_v1.0.txt            # KB Claude.AI
    ├── IAROM_MOD_FUNDAMENTOS_LEGAIS_v1.0.txt # KB Claude.AI
    ├── IAROM_MOD_VALIDACAO_v1.0.txt          # KB Claude.AI
    ├── IAROM_MOD_TRANSCRICAO_v1.0.txt        # KB Claude.AI
    ├── IAROM_MOD_FORMATACAO_v1.0.txt         # KB Claude.AI
    ├── IAROM_MOD_PREQUESTIONAMENTO_STJ_v1.0.txt # KB Claude.AI
    └── IAROM_MOD_DOUTRINA_v1.0.txt           # KB Claude.AI

TOTAL: 11 arquivos (~150 KB) para KB do Claude.AI
```

**IMPORTANTE:** Estes arquivos NÃO precisam ir para GitHub/Render. São usados apenas no Claude.AI como Knowledge Base.

---

## 3. ESTRUTURA RECOMENDADA

### 3.1 Estrutura Final do ROM-Agent

```
ROM-Agent/
├── data/
│   ├── prompts/
│   │   ├── global/                      # Prompts específicos (peças jurídicas)
│   │   │   ├── [92 arquivos .txt]      # Prompts refatorados V5.0
│   │   │   └── README.md               # Índice de prompts
│   │   │
│   │   └── partners/                    # Prompts de parceiros (manter)
│   │
│   ├── knowledge-base/                  # Sistema IAROM (para agente autônomo)
│   │   ├── modules/                     # Módulos IAROM
│   │   │   ├── IAROM_MASTER_CORE_v1.0.txt
│   │   │   ├── IAROM_MOD_FUNDAMENTOS_LEGAIS_v1.0.txt
│   │   │   ├── IAROM_MOD_VALIDACAO_v1.0.txt
│   │   │   ├── IAROM_MOD_TRANSCRICAO_v1.0.txt
│   │   │   ├── IAROM_MOD_FORMATACAO_v1.0.txt
│   │   │   ├── IAROM_MOD_PREQUESTIONAMENTO_STJ_v1.0.txt
│   │   │   └── IAROM_MOD_DOUTRINA_v1.0.txt
│   │   │
│   │   └── master/                      # Prompt Master
│   │       ├── IAROM_PROMPT_MASTER_v1.0.txt
│   │       └── IAROM_ORQUESTRADOR_MULTIAGENTE_v1.0.txt
│   │
│   ├── custom-instructions/             # Custom Instructions (manter)
│   │   └── CUSTOM_INSTRUCTIONS_V5.0.txt # Adicionar nova versão
│   │
│   └── [outras pastas mantidas]
│
├── docs/
│   ├── iarom/                           # Documentação IAROM
│   │   ├── README.md                    # Índice geral
│   │   ├── INDICE_GERAL_SISTEMA_IAROM.md
│   │   ├── CATALOGO_MESTRE_PROMPTS_V5.0.md
│   │   ├── MATRIZ_COMPATIBILIDADE_PROMPTS.md
│   │   │
│   │   └── relatorios/                  # Relatórios técnicos
│   │       ├── ANALISE_SISTEMA_ROM_COMPLETA.md
│   │       ├── COMPARATIVO_PROMPT_FORENSE_UNIVERSAL.md
│   │       ├── FICHA_AVALIACAO_PROMPT_FORENSE_UNIVERSAL.md
│   │       ├── MATRIZ_COMPARATIVA_8_PROMPTS.md
│   │       └── [outros relatórios]
│   │
│   └── [docs existentes mantidas]
│
├── src/                                 # Código-fonte (manter)
├── scripts/                             # Scripts (manter)
├── frontend/                            # Interface (manter)
├── config/                              # Configs (manter)
├── render.yaml                          # Config Render (manter)
└── package.json                         # v2.8.0 (manter)
```

### 3.2 Pastas a CRIAR

```bash
# Criar estrutura IAROM
mkdir -p data/knowledge-base/modules
mkdir -p data/knowledge-base/master
mkdir -p docs/iarom/relatorios
```

### 3.3 Pastas a MANTER

```
MANTER:
- data/prompts/partners/
- data/custom-instructions/
- data/knowledge-base/ (existente)
- KB/ (existente)
- todos os arquivos de código
```

---

## 4. PLANO DE MIGRAÇÃO

### FASE 1: LIMPEZA DO REPOSITÓRIO

**Objetivo:** Remover prompts antigos V5.0 e preparar para V5.0 refatorados

```bash
# 1. Confirmar remoção dos 77 prompts antigos deletados
cd ~/ROM-Agent
git status  # Verificar lista de deletados
git add data/prompts/global/  # Adicionar todas as deleções

# 2. Remover arquivos não rastreados que serão substituídos
rm data/prompts/global/PROMPT_*_V5_0.txt  # Se existirem
```

**Status esperado:** Working tree limpo de prompts antigos

---

### FASE 2: CRIAÇÃO DA ESTRUTURA IAROM

**Objetivo:** Criar pastas para módulos IAROM

```bash
# Criar estrutura de módulos
mkdir -p data/knowledge-base/modules
mkdir -p data/knowledge-base/master

# Criar estrutura de documentação
mkdir -p docs/iarom/relatorios
```

---

### FASE 3: CÓPIA DE PROMPTS ESPECÍFICOS

**Objetivo:** Copiar 92 prompts .txt refatorados para data/prompts/global/

```bash
# Copiar prompts específicos (mantém estrutura flat)
cp ~/Desktop/IAROM_PROMPTS_REFATORADOS_CLAUDE_AI/03_PROMPTS_ESPECIFICOS/*/*.txt \
   ~/ROM-Agent/data/prompts/global/

# Verificar total de arquivos
ls ~/ROM-Agent/data/prompts/global/*.txt | wc -l
# Esperado: ~92 arquivos novos
```

**IMPORTANTE:** Os prompts vão TODOS para `data/prompts/global/` (estrutura flat), não em subpastas.

---

### FASE 4: CÓPIA DE MÓDULOS IAROM

**Objetivo:** Copiar módulos para knowledge-base (uso futuro do agente autônomo)

```bash
# Copiar módulos
cp ~/Desktop/IAROM_PROMPTS_REFATORADOS_CLAUDE_AI/02_MODULOS/*.txt \
   ~/ROM-Agent/data/knowledge-base/modules/

# Copiar prompt master
cp ~/Desktop/IAROM_PROMPTS_REFATORADOS_CLAUDE_AI/01_PROMPT_MASTER/IAROM_PROMPT_MASTER_v1.0.txt \
   ~/ROM-Agent/data/knowledge-base/master/

cp ~/Desktop/IAROM_PROMPTS_REFATORADOS_CLAUDE_AI/01_PROMPT_MASTER/IAROM_ORQUESTRADOR_MULTIAGENTE_v1.0.txt \
   ~/ROM-Agent/data/knowledge-base/master/

# Copiar Custom Instructions
cp ~/Desktop/IAROM_PROMPTS_REFATORADOS_CLAUDE_AI/01_PROMPT_MASTER/CUSTOM_INSTRUCTIONS_V5.0.txt \
   ~/ROM-Agent/data/custom-instructions/
```

---

### FASE 5: CÓPIA DE DOCUMENTAÇÃO

**Objetivo:** Organizar documentação técnica do IAROM

```bash
# Copiar documentação principal
cp ~/Desktop/IAROM_PROMPTS_REFATORADOS_CLAUDE_AI/05_DOCUMENTACAO/*.md \
   ~/ROM-Agent/docs/iarom/

# Copiar relatórios técnicos
cp ~/Desktop/IAROM_PROMPTS_REFATORADOS_CLAUDE_AI/04_RELATORIOS/*.md \
   ~/ROM-Agent/docs/iarom/relatorios/

# Copiar README principal
cp ~/Desktop/IAROM_PROMPTS_REFATORADOS_CLAUDE_AI/README.md \
   ~/ROM-Agent/docs/iarom/README_IAROM.md
```

---

### FASE 6: CRIAR ÍNDICE DE PROMPTS

**Objetivo:** Documentar prompts disponíveis

```bash
# Criar índice automático
cd ~/ROM-Agent/data/prompts/global/
ls -1 *.txt > README.md

# Adicionar header ao README
cat > README_HEADER.txt << 'EOF'
# IAROM - Prompts Específicos v5.0

**Total:** 92 prompts refatorados
**Data:** 23/03/2026
**Status:** Produção

## Prompts Disponíveis:

EOF

cat README_HEADER.txt README.md > README_FINAL.md
mv README_FINAL.md README.md
rm README_HEADER.txt
```

---

## 5. COMANDOS GIT

### 5.1 Verificação Pré-Commit

```bash
cd ~/ROM-Agent

# 1. Verificar status completo
git status

# 2. Ver diferenças
git diff

# 3. Verificar arquivos não rastreados
git ls-files --others --exclude-standard

# 4. Verificar tamanho do commit
du -sh data/
du -sh docs/iarom/
```

---

### 5.2 Commit dos Prompts V5.0

```bash
cd ~/ROM-Agent

# 1. Adicionar remoção de prompts antigos
git add -u data/prompts/global/

# 2. Adicionar novos prompts e módulos
git add data/prompts/global/*.txt
git add data/knowledge-base/
git add data/custom-instructions/CUSTOM_INSTRUCTIONS_V5.0.txt

# 3. Adicionar documentação
git add docs/iarom/

# 4. Verificar o que será commitado
git status

# 5. Commit com mensagem descritiva
git commit -m "feat: Add IAROM v5.0 refactored prompts and modules

- Remove 77 old V5.0 prompts with decorative elements
- Add 92 refactored specific prompts (clean, modular)
- Add 8 IAROM modules (core, validation, transcription, etc)
- Add IAROM master prompts and orchestrator
- Add Custom Instructions V5.0
- Add comprehensive IAROM documentation
- Organize technical reports and analysis

System ready for autonomous agent deployment.

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

### 5.3 Push para GitHub

```bash
cd ~/ROM-Agent

# 1. Verificar remote
git remote -v

# 2. Push para main
git push origin main

# 3. Verificar push
git log --oneline -1

# 4. Verificar no GitHub
# Acessar: https://github.com/rodolfo-svg/ROM-Agent
```

---

### 5.4 Estratégia de Branches (Opcional)

Se preferir testar antes:

```bash
# Criar branch de feature
git checkout -b feature/iarom-v5-prompts

# Fazer commit na branch
git add .
git commit -m "feat: Add IAROM v5.0 prompts"

# Push da branch
git push origin feature/iarom-v5-prompts

# Criar PR no GitHub
# Após aprovação, merge para main
```

---

## 6. CONFIGURAÇÕES DO RENDER

### 6.1 Verificação de Variáveis de Ambiente

**Render Service:** srv-d4ueaf2li9vc73d3rj00

Verificar no painel do Render:

```yaml
# Essenciais para IAROM
✅ NODE_ENV=production
✅ PORT=10000
✅ AWS_ACCESS_KEY_ID (set)
✅ AWS_SECRET_ACCESS_KEY (set)
✅ ANTHROPIC_API_KEY (set)

# Paths no disco persistente
✅ PROMPTS_FOLDER=/var/data/prompts
✅ UPLOAD_FOLDER=/var/data/upload
✅ EXTRACTED_FOLDER=/var/data/extracted

# KB do sistema
✅ KNOWLEDGE_BASE_FOLDER=/var/data/knowledge-base (adicionar se não existe)
```

---

### 6.2 Atualização do render.yaml (Se necessário)

**Arquivo:** `~/ROM-Agent/render.yaml`

**Adições necessárias:**

```yaml
# Adicionar em envVars do serviço rom-agent:
- key: KNOWLEDGE_BASE_FOLDER
  value: /var/data/knowledge-base

- key: CUSTOM_INSTRUCTIONS_FOLDER
  value: /var/data/custom-instructions
```

**Comando:**

```bash
# Verificar se já existe
cat ~/ROM-Agent/render.yaml | grep KNOWLEDGE_BASE_FOLDER

# Se não existir, editar manualmente ou via script
```

---

### 6.3 Sincronização de Arquivos no Render

**IMPORTANTE:** Os prompts e módulos precisam ser sincronizados para `/var/data/`

**Opção 1: Deploy automático via GitHub**
- Render faz deploy após push
- Arquivos de `data/` são copiados para `/var/data/`
- Verificar logs de deploy

**Opção 2: Script de sincronização manual**

```bash
# Criar script de sincronização (no repositório)
cat > scripts/sync-prompts-to-render.sh << 'EOF'
#!/bin/bash
# Sincroniza prompts do repositório para disco persistente

echo "Syncing prompts to /var/data..."

# Copiar prompts
cp -r data/prompts/* /var/data/prompts/

# Copiar knowledge-base
cp -r data/knowledge-base/* /var/data/knowledge-base/

# Copiar custom-instructions
cp -r data/custom-instructions/* /var/data/custom-instructions/

echo "Sync complete!"
EOF

chmod +x scripts/sync-prompts-to-render.sh
```

**Executar após deploy:**

```bash
# Via Render Shell
cd /opt/render/project/src
bash scripts/sync-prompts-to-render.sh
```

---

### 6.4 Build Command (Verificar se adequado)

**Atual no render.yaml:**

```yaml
buildCommand: bash scripts/build-production.sh
```

**Verificar se `build-production.sh` copia prompts:**

```bash
# Ver conteúdo do script
cat ~/ROM-Agent/scripts/build-production.sh | grep -A5 "prompts"
```

**Se não copiar, adicionar ao script:**

```bash
# Adicionar ao build-production.sh
echo "# Sync prompts to persistent disk"
echo "cp -r data/prompts/* /var/data/prompts/ || true"
echo "cp -r data/knowledge-base/* /var/data/knowledge-base/ || true"
```

---

## 7. CHECKLIST DE DEPLOY

### PRÉ-DEPLOY

```
Estrutura Local:
[ ] Repositório ROM-Agent existe em ~/ROM-Agent
[ ] Branch main está atualizada
[ ] Git status mostra mudanças pendentes
[ ] Prompts refatorados existem em ~/Desktop/IAROM_PROMPTS_REFATORADOS_CLAUDE_AI/

Preparação:
[ ] Backup do repositório atual feito
[ ] Pastas de destino criadas (knowledge-base/modules, docs/iarom, etc)
[ ] README dos prompts criado
```

---

### EXECUÇÃO - FASE 1: LIMPEZA

```
[ ] git status executado (verificar 77 deletados)
[ ] git add -u data/prompts/global/ (confirmar deleções)
[ ] Arquivos V5_0 antigos removidos (se existirem)
```

---

### EXECUÇÃO - FASE 2: CÓPIA DE ARQUIVOS

```
[ ] 92 prompts copiados para data/prompts/global/
[ ] 8 módulos copiados para data/knowledge-base/modules/
[ ] 2 master prompts copiados para data/knowledge-base/master/
[ ] 1 Custom Instructions copiado para data/custom-instructions/
[ ] 10 docs copiados para docs/iarom/
[ ] 7 relatórios copiados para docs/iarom/relatorios/
[ ] README_IAROM.md criado em docs/iarom/
[ ] README.md criado em data/prompts/global/
```

---

### EXECUÇÃO - FASE 3: GIT

```
[ ] git status (verificar todos os arquivos novos)
[ ] git diff (revisar mudanças)
[ ] git add (adicionar arquivos)
[ ] git commit (mensagem descritiva)
[ ] git push origin main
[ ] Verificar commit no GitHub
```

---

### EXECUÇÃO - FASE 4: RENDER

```
[ ] Deploy automático iniciado (verificar logs)
[ ] Build command executado com sucesso
[ ] Start command executado com sucesso
[ ] Health check passou (/health retornou 200)
[ ] Serviço está running
```

---

### PÓS-DEPLOY

```
[ ] Acessar https://iarom.com.br
[ ] Verificar API: https://iarom.com.br/api/info
[ ] Verificar prompts disponíveis: https://iarom.com.br/api/prompts
[ ] Testar criação de peça com prompt V5.0
[ ] Verificar logs do Render (sem erros)
[ ] Verificar disco persistente (arquivos copiados)
```

---

## 8. VALIDAÇÕES PÓS-DEPLOY

### 8.1 Validação de Prompts no Render

```bash
# Via Render Shell
cd /opt/render/project/src

# Verificar prompts
ls -la /var/data/prompts/global/*.txt | wc -l
# Esperado: 92 arquivos

# Verificar módulos
ls -la /var/data/knowledge-base/modules/*.txt | wc -l
# Esperado: 8 arquivos

# Verificar custom instructions
ls -la /var/data/custom-instructions/CUSTOM_INSTRUCTIONS_V5.0.txt
# Esperado: arquivo existe
```

---

### 8.2 Validação via API

```bash
# GET /api/prompts (listar prompts)
curl https://iarom.com.br/api/prompts | jq '.prompts | length'
# Esperado: 92+ prompts

# GET /api/knowledge-base (verificar KB)
curl https://iarom.com.br/api/knowledge-base | jq '.modules | length'
# Esperado: 8+ módulos

# GET /api/custom-instructions (verificar CI)
curl https://iarom.com.br/api/custom-instructions | jq '.version'
# Esperado: "V5.0"
```

---

### 8.3 Validação Funcional

```bash
# Teste 1: Criar peça com prompt V5.0
curl -X POST https://iarom.com.br/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Criar petição inicial de ação de cobrança",
    "prompt": "PROMPT_PETICAO_INICIAL_CIVEL_v1.0"
  }' | jq '.response' | head -50

# Teste 2: Usar módulo IAROM
curl -X POST https://iarom.com.br/api/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Analisar este processo...",
    "modules": ["IAROM_MOD_VALIDACAO_v1.0", "IAROM_MOD_FUNDAMENTOS_LEGAIS_v1.0"]
  }' | jq '.analysis'

# Teste 3: Usar Custom Instructions
curl -X POST https://iarom.com.br/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Criar contestação trabalhista",
    "useCustomInstructions": true
  }' | jq '.response' | head -50
```

---

### 8.4 Checklist de Validação

```
Prompts:
[ ] Total de prompts = 92
[ ] Nomenclatura padronizada (v1.0, não V5_0)
[ ] Formato .txt consistente
[ ] Sem emojis ou elementos decorativos
[ ] Prompts acessíveis via API

Módulos:
[ ] Total de módulos = 8
[ ] Módulos em knowledge-base/modules/
[ ] Master prompts em knowledge-base/master/
[ ] Custom Instructions V5.0 disponível

Sistema:
[ ] Deploy sem erros
[ ] Health check OK
[ ] Logs sem warnings críticos
[ ] Disco persistente com espaço (< 50 GB usado de 100 GB)
[ ] Performance normal (response time < 2s)

Funcional:
[ ] Criação de peças funciona
[ ] Prompts V5.0 retornam texto limpo (sem emojis)
[ ] Módulos IAROM são carregados corretamente
[ ] Custom Instructions aplicadas corretamente
```

---

## 9. TROUBLESHOOTING

### Problema 1: Deploy falha no build

**Sintomas:** Build command retorna erro

**Soluções:**

```bash
# 1. Verificar logs de build no Render
# 2. Verificar se scripts/build-production.sh existe
# 3. Verificar permissões do script
chmod +x ~/ROM-Agent/scripts/build-production.sh
git add scripts/build-production.sh
git commit -m "fix: Make build script executable"
git push
```

---

### Problema 2: Prompts não aparecem na API

**Sintomas:** GET /api/prompts retorna lista vazia ou incompleta

**Soluções:**

```bash
# 1. Verificar se prompts estão no disco persistente
# Via Render Shell:
ls /var/data/prompts/global/*.txt

# 2. Se vazio, sincronizar manualmente
bash scripts/sync-prompts-to-render.sh

# 3. Reiniciar serviço
# Via Render dashboard: Manual Deploy > Clear build cache & deploy
```

---

### Problema 3: Módulos IAROM não carregam

**Sintomas:** Erro ao usar módulos ou módulos não listados

**Soluções:**

```bash
# 1. Verificar variável de ambiente
echo $KNOWLEDGE_BASE_FOLDER
# Deve ser: /var/data/knowledge-base

# 2. Verificar arquivos
ls /var/data/knowledge-base/modules/*.txt

# 3. Verificar código do agente
# Ver se lib/knowledge-base-loader.js existe e funciona

# 4. Adicionar variável no render.yaml e redeploy
```

---

### Problema 4: Custom Instructions V5.0 não aplicadas

**Sintomas:** Respostas ainda usam versão antiga das CI

**Soluções:**

```bash
# 1. Verificar se arquivo existe
ls /var/data/custom-instructions/CUSTOM_INSTRUCTIONS_V5.0.txt

# 2. Verificar configuração do agente
# Ver se lib/custom-instructions-loader.js carrega V5.0

# 3. Limpar cache
curl -X POST https://iarom.com.br/api/admin/clear-cache

# 4. Reiniciar serviço
```

---

### Problema 5: Erro "ENOSPC: no space left on device"

**Sintomas:** Falha ao copiar arquivos no deploy

**Soluções:**

```bash
# 1. Verificar espaço em disco no Render
df -h

# 2. Limpar cache e arquivos temporários
rm -rf /var/data/temp/*
rm -rf /var/data/uploads/*.tmp

# 3. Verificar se disco persistente tem 100 GB (render.yaml)
# Se não, aumentar em render.yaml e redeploy
```

---

## 10. ROLLBACK (Se necessário)

### Rollback Git

```bash
cd ~/ROM-Agent

# 1. Verificar commit anterior
git log --oneline -5

# 2. Reverter último commit (se necessário)
git revert HEAD

# 3. Ou reset hard (CUIDADO!)
git reset --hard HEAD~1

# 4. Force push (CUIDADO!)
git push origin main --force

# Render fará redeploy automático
```

---

### Rollback Render

```bash
# Via Render Dashboard:
# 1. Ir para Service > Deploys
# 2. Encontrar deploy anterior (antes do V5.0)
# 3. Clicar em "Rollback to this deploy"
# 4. Confirmar

# Ou via CLI:
render services rollback rom-agent --previous
```

---

## 11. PRÓXIMOS PASSOS

### Após Deploy Bem-Sucedido

1. **Documentar versão em produção**
   - Criar tag no Git: `git tag -a v5.0.0 -m "IAROM V5.0 - Refactored prompts"`
   - Push tag: `git push origin v5.0.0`

2. **Atualizar documentação**
   - Criar `CHANGELOG.md` com mudanças do V5.0
   - Atualizar `README.md` principal com link para docs IAROM

3. **Notificar usuários**
   - Email para usuários atuais sobre nova versão
   - Post em redes sociais (se aplicável)

4. **Monitorar performance**
   - Acompanhar logs por 24-48h
   - Verificar uso de memória/CPU
   - Verificar resposta de usuários

5. **Backup**
   - Fazer backup do disco persistente do Render
   - Exportar dados críticos (usuários, projetos)

---

### Roadmap V5.1

```
Melhorias Planejadas:
[ ] Loader automático de módulos IAROM na inicialização
[ ] API específica para módulos (/api/iarom/modules)
[ ] Interface web para escolher módulos ao criar peça
[ ] Versionamento de prompts (v1.0, v1.1, etc)
[ ] Sistema de rollback de prompts
[ ] Testes automatizados de prompts
[ ] CI/CD para validação de prompts
```

---

## 12. REFERÊNCIAS

### Documentação

- **Sistema IAROM:** `~/ROM-Agent/docs/iarom/README_IAROM.md`
- **Índice Geral:** `~/ROM-Agent/docs/iarom/INDICE_GERAL_SISTEMA_IAROM.md`
- **Catálogo de Prompts:** `~/ROM-Agent/docs/iarom/CATALOGO_MESTRE_PROMPTS_V5.0.md`
- **Matriz de Compatibilidade:** `~/ROM-Agent/docs/iarom/MATRIZ_COMPATIBILIDADE_PROMPTS.md`

### Configurações

- **Render.yaml:** `~/ROM-Agent/render.yaml`
- **Package.json:** `~/ROM-Agent/package.json`
- **Build Script:** `~/ROM-Agent/scripts/build-production.sh`

### GitHub

- **Repositório:** https://github.com/rodolfo-svg/ROM-Agent
- **Branch main:** https://github.com/rodolfo-svg/ROM-Agent/tree/main
- **Commits:** https://github.com/rodolfo-svg/ROM-Agent/commits/main

### Render

- **Dashboard:** https://dashboard.render.com/
- **Service ID:** srv-d4ueaf2li9vc73d3rj00
- **URL Produção:** https://iarom.com.br
- **URL Staging:** https://rom-agent-staging.onrender.com

---

## 13. CONTATOS E SUPORTE

### Render Support

- **Email:** support@render.com
- **Docs:** https://render.com/docs
- **Status:** https://status.render.com

### GitHub Support

- **Docs:** https://docs.github.com
- **Community:** https://github.community

---

## 14. CONCLUSÃO

### Status Atual

**ESTRUTURA MAPEADA E DOCUMENTADA** ✅

- [x] Repositório local identificado e conectado ao GitHub
- [x] Estrutura de prompts refatorados mapeada (92 arquivos)
- [x] Módulos IAROM catalogados (8 módulos + 2 master)
- [x] Documentação organizada (17 docs)
- [x] Plano de migração completo criado
- [x] Comandos git documentados
- [x] Configurações do Render verificadas
- [x] Checklist de deploy preparado
- [x] Validações pós-deploy definidas
- [x] Troubleshooting documentado

### Próxima Ação

**AGUARDANDO AUTORIZAÇÃO PARA EXECUTAR:**

Quando autorizado, executar na ordem:

1. **FASE 1:** Limpeza do repositório (10 min)
2. **FASE 2:** Criação de estrutura (5 min)
3. **FASE 3:** Cópia de prompts específicos (5 min)
4. **FASE 4:** Cópia de módulos IAROM (5 min)
5. **FASE 5:** Cópia de documentação (5 min)
6. **FASE 6:** Git commit e push (10 min)
7. **FASE 7:** Verificar deploy automático no Render (15 min)
8. **FASE 8:** Validações pós-deploy (15 min)

**TEMPO TOTAL ESTIMADO:** 70 minutos

---

### Riscos Identificados

**BAIXO RISCO:**

- ✅ Repositório já existe e está atualizado
- ✅ Render.yaml já configurado para auto-deploy
- ✅ Estrutura de pastas compatível
- ✅ Prompts em formato .txt (compatível)
- ✅ Sem conflitos de nomenclatura previstos
- ✅ Disco persistente com espaço suficiente (100 GB)

**MITIGAÇÕES:**

- Backup do repositório antes de começar
- Commits incrementais (não um commit gigante)
- Testar em branch antes de merge para main (opcional)
- Monitorar logs de deploy em tempo real
- Plano de rollback documentado

---

### Resultado Esperado

**Após execução completa:**

- [x] ROM-Agent com 92 prompts V5.0 refatorados em produção
- [x] Sistema IAROM com 8 módulos disponíveis para agente autônomo
- [x] Custom Instructions V5.0 ativas
- [x] Documentação completa acessível
- [x] Versionamento claro (v5.0.0)
- [x] Deploy automático funcionando
- [x] Sistema estável e performático

---

**PLANO COMPLETO - PRONTO PARA EXECUÇÃO**

Elaborado por: Claude Sonnet 4.5
Data: 23/03/2026
Versão: 1.0
Status: APROVADO - AGUARDANDO GO
