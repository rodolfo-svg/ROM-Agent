# 📚 Guia do Usuário - Sistema de Custom Instructions

**Data:** 03/02/2026
**Versão:** 1.0
**Autor:** ROM Agent Team
**Para:** Administradores e Usuários do ROM Agent

---

## 📋 Índice

1. [Visão Geral](#visão-geral)
2. [Conceitos Fundamentais](#conceitos-fundamentais)
3. [Hierarquia de Permissões](#hierarquia-de-permissões)
4. [Como Usar - Passo a Passo](#como-usar---passo-a-passo)
5. [Editor de Custom Instructions](#editor-de-custom-instructions)
6. [Sistema de Sugestões de IA](#sistema-de-sugestões-de-ia)
7. [Versionamento e Histórico](#versionamento-e-histórico)
8. [Casos de Uso Práticos](#casos-de-uso-práticos)
9. [Troubleshooting](#troubleshooting)
10. [FAQ - Perguntas Frequentes](#faq---perguntas-frequentes)

---

## 🎯 Visão Geral

O **Sistema de Custom Instructions** permite que você personalize completamente o comportamento do ROM Agent ao gerar peças jurídicas, criando instruções customizadas que são aplicadas **ANTES** de qualquer outro prompt.

### Por que usar Custom Instructions?

- ✅ **Padronização**: Garanta que todas as peças sigam o mesmo padrão do seu escritório
- ✅ **Qualidade**: Defina regras específicas de formatação, estilo e conteúdo
- ✅ **Controle**: Tenha controle total sobre o comportamento do agente
- ✅ **Evolução**: Sistema de IA sugere melhorias automáticas baseadas no uso
- ✅ **Hierarquia**: Cada escritório parceiro tem suas próprias instruções

### Onde as Custom Instructions são aplicadas?

- 📝 **Geração de Peças**: Petições, contestações, recursos, etc.
- 💬 **Chat**: Conversas gerais com o agente (configurável)
- 🔄 **Revisões**: Ao revisar e melhorar documentos existentes

---

## 🧩 Conceitos Fundamentais

### 3 Componentes Obrigatórios

O sistema de Custom Instructions é dividido em **3 componentes** que são aplicados **nesta ordem**:

#### 1️⃣ **Custom Instructions Gerais**
**O que é:** Instruções base sobre identidade, comportamento e proibições do agente.

**Exemplo de uso:**
```
Você é o ROM Agent, especialista em Direito Processual Civil.

COMPORTAMENTO OBRIGATÓRIO:
- SEMPRE pesquise jurisprudência antes de citar
- NUNCA use emojis em peças formais
- SEMPRE siga estrutura I, II, III → 1, 2, 3 → a, b, c

EXTENSÃO MÍNIMA:
- Petição Inicial: 15-20 páginas
- Contestação: 15-25 páginas
```

#### 2️⃣ **Método de Formatação**
**O que é:** Regras específicas de formatação ABNT/OAB.

**Exemplo de uso:**
```
FONTE: Calibri 12pt (corpo), 11pt (citações longas)
MARGENS: Superior/Inferior 2,5cm, Esquerda/Direita 3,0cm
ESPAÇAMENTO: 1,5 entre linhas
CITAÇÕES LONGAS: Recuo de 4cm à esquerda
```

#### 3️⃣ **Método de Versionamento e Redação**
**O que é:** Técnicas de redação persuasiva e metodologia.

**Exemplo de uso:**
```
ESTRUTURA ARGUMENTATIVA:
1. Apresentação do tema
2. Contextualização fática
3. Base legal
4. Precedentes judiciais
5. Síntese conclusiva

ORDEM DE MATÉRIAS (Art. 337 CPC):
I - Inexistência ou nulidade de citação (SEMPRE PRIMEIRO!)
II - Incompetência absoluta e relativa
III - Inépcia da petição inicial
...
```

### Sequência de Aplicação

```
┌─────────────────────────────────────────────────────┐
│  1. Custom Instructions Gerais                      │
│  ↓                                                   │
│  2. Método de Formatação                            │
│  ↓                                                   │
│  3. Método de Versionamento e Redação               │
│  ↓                                                   │
│  4. Prompt Base do Sistema (OPTIMIZED_SYSTEM_PROMPT)│
│  ↓                                                   │
│  5. Prompt Específico da Peça (ex: petição inicial)│
│  ↓                                                   │
│  6. Mensagem do Usuário                             │
└─────────────────────────────────────────────────────┘
```

**IMPORTANTE:** As Custom Instructions são **SEMPRE** aplicadas primeiro, garantindo que suas regras sejam respeitadas.

---

## 👥 Hierarquia de Permissões

### Administrador Geral (master_admin)

**Quem:** Você (ROM)

**Pode:**
- ✅ Editar Custom Instructions do escritório ROM
- ✅ Editar Custom Instructions de **TODOS** os escritórios parceiros
- ✅ Fazer rollback de versões
- ✅ Aprovar/Rejeitar sugestões de IA
- ✅ Configurar análise periódica
- ✅ Ver histórico completo de versões

**Acesso:** Todas as páginas e funcionalidades

---

### Administrador de Parceiro (partner_admin)

**Quem:** Administradores de escritórios parceiros (Parceiro 1, Parceiro 2, etc.)

**Pode:**
- ✅ Editar Custom Instructions **do próprio escritório**
- ✅ Aprovar/Rejeitar sugestões de IA do próprio escritório
- ✅ Ver histórico de versões do próprio escritório
- ❌ NÃO pode editar outros escritórios
- ❌ NÃO pode fazer rollback (apenas master_admin)

**Acesso:** Custom Instructions e Sugestões do próprio partnerId

---

### Usuário (user)

**Quem:** Advogados e usuários regulares

**Pode:**
- ✅ Visualizar Custom Instructions (somente leitura)
- ✅ Desabilitar Custom Instructions para si (se permitido)
- ❌ NÃO pode editar
- ❌ NÃO pode aprovar sugestões

**Acesso:** Visualização apenas

---

## 📝 Como Usar - Passo a Passo

### Passo 1: Acessar o Editor

1. Faça login em: **https://iarom.com.br**
2. No menu lateral, clique em **"Admin"** → **"Custom Instructions"**
3. Ou acesse diretamente: **https://iarom.com.br/admin/custom-instructions**

### Passo 2: Entender a Interface

Você verá:

```
┌─────────────────────────────────────────────────────┐
│  Custom Instructions                   [Preview] [Salvar] │
├─────────────────────────────────────────────────────┤
│  ℹ️ Sequência: 1º CI → 2º Formatação → 3º Versionamento │
│  Versão: 1.0 | Última atualização: 03/02/2026 01:30 │
│  Total: 1,200 tokens                                │
├─────────────────────────────────────────────────────┤
│  [1. Custom Instructions] [2. Formatação] [3. Versionamento] │
├─────────────────────────────────────────────────────┤
│  [Editor de Texto]                                  │
│                                                     │
│  Você é o ROM Agent...                             │
│                                                     │
│                                                     │
├─────────────────────────────────────────────────────┤
│  Palavras: 450 | Caracteres: 2,800 | Tokens: 420   │
└─────────────────────────────────────────────────────┘
```

### Passo 3: Editar Componentes

1. **Clique na aba** que deseja editar (1, 2 ou 3)
2. **Edite o texto** diretamente no editor
3. **Veja as estatísticas** atualizarem em tempo real
4. **Clique em "Salvar Alterações"**

**💡 Dica:** Comece pelo componente 1 (Custom Instructions Gerais) e depois ajuste os outros.

### Passo 4: Ver Preview

Antes de salvar, veja como ficará o texto final:

1. Clique em **"Preview Compilado"**
2. Verá os 3 componentes concatenados na ordem correta
3. Verifique se está tudo correto
4. Feche o preview e salve

### Passo 5: Configurar Aplicação

Na seção **"Configurações de Aplicação"**, você pode:

- ☑️ **Aplicar em conversas de chat** - Usar CI no chat geral
- ☑️ **Aplicar em geração de peças** - Usar CI em peças jurídicas
- ☑️ **Permitir override** - Usuários podem desabilitar para si

**Recomendação:** Deixe **todas marcadas** para máxima consistência.

---

## ✏️ Editor de Custom Instructions

### Interface Detalhada

```
┌──────────────────────────────────────────────────────────┐
│  Componente: Custom Instructions Gerais                  │
│  Instruções base aplicadas a todas as conversas e peças  │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  [Área de Texto - Editor]                               │
│                                                          │
│  Você é o ROM Agent, especialista em geração de peças   │
│  jurídicas brasileiras.                                 │
│                                                          │
│  ═══════════════════════════════════════                 │
│  IDENTIDADE                                             │
│  ═══════════════════════════════════                     │
│                                                          │
│  ...                                                     │
│                                                          │
├──────────────────────────────────────────────────────────┤
│  Palavras: 450 | Caracteres: 2,800 | Tokens: 420        │
└──────────────────────────────────────────────────────────┘
```

### Boas Práticas de Edição

#### ✅ O que fazer:

1. **Seja Específico**
   ```
   ✅ BOM: "SEMPRE cite STJ, REsp completo, Rel. Min. NOME, data"
   ❌ RUIM: "Cite jurisprudência"
   ```

2. **Use Estrutura Hierárquica**
   ```
   ═══════════════════
   SEÇÃO PRINCIPAL
   ═══════════════════

   Subseção:
   • Item 1
   • Item 2
   ```

3. **Defina Proibições Claras**
   ```
   ✗ NUNCA use emojis em peças formais
   ✗ NUNCA use markdown (**, ###, ```)
   ✗ NUNCA cite sem pesquisar primeiro
   ```

4. **Estabeleça Limites de Extensão**
   ```
   EXTENSÃO MÍNIMA:
   • Petição Inicial: 15-20 páginas
   • Contestação: 15-25 páginas
   ```

#### ❌ O que evitar:

- ❌ Instruções vagas ("seja bom", "faça direito")
- ❌ Contradições entre os 3 componentes
- ❌ Textos muito longos (> 2.000 tokens por componente)
- ❌ Caracteres especiais que quebram JSON

### Controle de Tokens

**Por que importa?**
- Cada token custa dinheiro na API
- Mais tokens = mais tempo de processamento
- Limite prático: ~2.000 tokens por componente

**Como otimizar:**
- Use abreviações quando possível
- Remova redundâncias
- Seja conciso mas completo

**Indicadores:**
```
🟢 Verde (< 500 tokens): Ótimo
🟡 Amarelo (500-1.000): Bom
🟠 Laranja (1.000-2.000): Aceitável
🔴 Vermelho (> 2.000): Revisar
```

---

## 🤖 Sistema de Sugestões de IA

### O que são Sugestões de IA?

O sistema analisa automaticamente:
- 📊 Métricas de uso (conversas, peças geradas)
- 🐛 Erros comuns (formatação, estrutura)
- 📈 Taxa de revisões necessárias
- ⚠️ Problemas recorrentes

E gera **sugestões de melhoria** usando Claude AI.

### Como Funciona?

#### Análise Automática (Cron Job)

O sistema executa análise **automaticamente**:

- **Semanal**: Toda segunda-feira às 02:00
- **Mensal**: Todo dia 1 do mês às 02:00

**Você não precisa fazer nada!** As sugestões aparecerão automaticamente.

#### Análise Manual (Trigger)

Você também pode forçar análise imediata:

1. Acesse: **https://iarom.com.br/admin/suggestions**
2. Clique em **"Executar Análise"**
3. Aguarde 1-2 minutos
4. Sugestões aparecerão na lista

### Interface de Sugestões

```
┌──────────────────────────────────────────────────────────┐
│  🌟 Sugestões de IA               [Executar Análise]     │
├──────────────────────────────────────────────────────────┤
│  📊 Total Pendente: 3 | ⚠️ Alta Prioridade: 1            │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  ┌────────────────────────────────────────────────────┐ │
│  │ Custom Instructions Gerais   [Alta Prioridade] [Adicionar] │
│  │                                   [Aplicar] [Rejeitar] │
│  ├────────────────────────────────────────────────────┤ │
│  │ Problema: Citações sem fonte identificadas em 23   │ │
│  │ peças (15% do total)                               │ │
│  ├────────────────────────────────────────────────────┤ │
│  │ Texto Sugerido:                                    │ │
│  │ ┌──────────────────────────────────────────────┐   │ │
│  │ │ OBRIGATORIEDADE DE FONTES:                   │   │ │
│  │ │ ✓ TODA citação DEVE ter fonte                │   │ │
│  │ │ ✓ Formato: (Autor, ano, p. X)               │   │ │
│  │ │ ✓ Jurisprudência: (STJ, REsp X, Rel. ...)   │   │ │
│  │ └──────────────────────────────────────────────┘   │ │
│  ├────────────────────────────────────────────────────┤ │
│  │ Justificativa: Detectadas 23 citações sem fonte    │ │
│  │ em 150 peças analisadas (taxa de 15%). Adicionar  │ │
│  │ esta regra explícita deve reduzir erros.          │ │
│  ├────────────────────────────────────────────────────┤ │
│  │ 📈 Melhoria Esperada: Reduzir citações sem fonte  │ │
│  │ de 15% para 2% (-87% de erro)                     │ │
│  └────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────┘
```

### Como Avaliar Sugestões

#### 1. **Ler o Problema**
Entenda qual erro/problema foi identificado.

#### 2. **Revisar o Texto Sugerido**
- Está claro?
- Faz sentido?
- Não contradiz outras regras?

#### 3. **Analisar Justificativa**
- Baseada em números reais?
- Problema relevante?
- Melhoria esperada é realista?

#### 4. **Decidir**

**Aplicar ✅** se:
- Problema é real e significativo
- Texto sugerido é claro e útil
- Melhoria esperada é desejável

**Rejeitar ❌** se:
- Problema não é relevante
- Texto sugerido não ajuda
- Contradiz outras regras existentes

### Prioridades das Sugestões

#### 🔴 **Alta Prioridade**
- Problemas que afetam > 10% das peças
- Erros críticos de formatação/estrutura
- Questões de compliance ABNT/OAB

**Recomendação:** Revisar e aplicar o mais rápido possível.

#### 🟡 **Média Prioridade**
- Problemas que afetam 5-10% das peças
- Melhorias de qualidade
- Otimizações de estilo

**Recomendação:** Revisar quando tiver tempo.

#### 🟢 **Baixa Prioridade**
- Problemas que afetam < 5% das peças
- Sugestões de melhoria incremental
- Ajustes estéticos

**Recomendação:** Opcional, avaliar se vale a pena.

---

## 📚 Versionamento e Histórico

### Como Funciona o Versionamento?

Toda vez que você salva, o sistema:

1. **Incrementa a versão** automaticamente (1.0 → 1.1 → 1.2)
2. **Salva snapshot** da versão anterior em `/versions/`
3. **Registra quem fez** a alteração e quando

### Ver Histórico

1. Na página de Custom Instructions
2. Clique em **"Histórico (X)"** no canto superior direito
3. Verá lista de todas as versões:

```
┌──────────────────────────────────────────────────┐
│  Histórico de Versões                            │
├──────────────────────────────────────────────────┤
│  v1.2                                            │
│  03/02/2026 14:30                                │
│  Por: master_admin (você)                        │
│  [Ver Detalhes]                                  │
├──────────────────────────────────────────────────┤
│  v1.1                                            │
│  03/02/2026 02:15                                │
│  Por: system_ai (auto-atualização)               │
│  [Ver Detalhes]                                  │
├──────────────────────────────────────────────────┤
│  v1.0                                            │
│  03/02/2026 01:30                                │
│  Por: system (criação inicial)                   │
│  [Ver Detalhes]                                  │
└──────────────────────────────────────────────────┘
```

### Rollback (Apenas master_admin)

Se você precisa voltar para uma versão anterior:

**⚠️ ATENÇÃO:** Apenas **Administrador Geral (você)** pode fazer rollback.

1. Acesse o histórico
2. Clique em **"Ver Detalhes"** da versão desejada
3. Clique em **"Fazer Rollback para esta versão"**
4. Confirme a operação

**O que acontece:**
- Sistema cria **nova versão** baseada na antiga
- **NÃO sobrescreve** (preserva histórico)
- Exemplo: v1.5 → rollback v1.2 → cria v1.6 (cópia da v1.2)

---

## 💼 Casos de Uso Práticos

### Caso 1: Padronizar Citações

**Problema:** Peças com citações inconsistentes.

**Solução:**

1. Acesse Custom Instructions → Componente 1
2. Adicione seção:

```
═══════════════════════════════════
PADRÃO DE CITAÇÕES OBRIGATÓRIO
═══════════════════════════════════

JURISPRUDÊNCIA (formato inline):
(TRIBUNAL, TIPO n. XXX/UF, Rel. Min./Des. NOME SOBRENOME, Xª T., j. DD/MM/AAAA, DJe DD/MM/AAAA)

EXEMPLOS:
✓ (STJ, REsp 1.234.567/GO, Rel. Min. HERMAN BENJAMIN, 2ª T., j. 15/03/2023, DJe 20/03/2023)
✓ (STF, RE 987.654/DF, Rel. Min. LUÍS ROBERTO BARROSO, Pleno, j. 10/12/2022, DJe 15/12/2022)

DOUTRINA:
(AUTOR, ano, p. X)

EXEMPLO:
✓ (THEODORO JÚNIOR, 2020, p. 45)

PROIBIDO:
✗ Citar sem fonte
✗ Fonte incompleta
✗ Formato diferente do padrão
```

3. Salve
4. Próximas peças seguirão o padrão!

---

### Caso 2: Garantir Extensão Mínima

**Problema:** Peças muito curtas (< 10 páginas).

**Solução:**

1. Acesse Custom Instructions → Componente 1
2. Adicione/modifique:

```
═══════════════════════════════════
EXTENSÃO MÍNIMA OBRIGATÓRIA
═══════════════════════════════════

IMPORTANTE: Peças muito curtas indicam análise superficial.

LIMITES:
• Petição Inicial: 15-20 páginas (MÍNIMO 15)
• Contestação: 15-25 páginas (MÍNIMO 15)
• Apelação: 20-30 páginas (MÍNIMO 20)
• Recurso Especial: 20-25 páginas (MÍNIMO 20)

Se a peça ficou < 10 páginas:
⚠️ REESCREVA com mais detalhes, argumentos e fundamentação.
```

3. Salve
4. Peças curtas serão automaticamente expandidas!

---

### Caso 3: Proibir Markdown em Peças

**Problema:** Agente usa **, ###, ``` em documentos formais.

**Solução:**

1. Acesse Custom Instructions → Componente 1
2. Adicione em "PROIBIÇÕES ABSOLUTAS":

```
✗ NUNCA use markdown em peças jurídicas:
   - Proibido: **, __, ###, ```, - [ ]
   - Usar apenas formatação ABNT/OAB padrão
   - Títulos em MAIÚSCULAS NEGRITO
   - Listas com • ou I, II, III

✗ NUNCA use emojis em documentos formais:
   - Proibido: 😀, ✅, ❌, 🚀, etc.
   - Usar apenas texto formal
```

3. Salve
4. Markdown eliminado das peças!

---

### Caso 4: Ordem Correta de Preliminares

**Problema:** Contestações com ordem errada de matérias.

**Solução:**

1. Acesse Custom Instructions → Componente 3 (Versionamento)
2. Adicione/reforce:

```
═══════════════════════════════════
ORDEM DE MATÉRIAS (Art. 337 CPC)
═══════════════════════════════════

EM CONTESTAÇÕES, SEGUIR RIGOROSAMENTE:

I - INEXISTÊNCIA OU NULIDADE DE CITAÇÃO
    ⚠️ SEMPRE PRIMEIRO, se aplicável!

II - INCOMPETÊNCIA ABSOLUTA E RELATIVA
     a) Incompetência absoluta (matéria, pessoa, função)
     b) Incompetência territorial (relativa)

III - INCORREÇÃO DO VALOR DA CAUSA

IV - INÉPCIA DA PETIÇÃO INICIAL

V - PEREMPÇÃO

VI - LITISPENDÊNCIA

VII - COISA JULGADA

VIII - AUSÊNCIA DE LEGITIMIDADE, INTERESSE PROCESSUAL

XIII - MÉRITO PROPRIAMENTE DITO
      ⚠️ Somente APÓS todas as preliminares!

PROIBIDO:
✗ Tratar mérito antes das preliminares
✗ Inverter a ordem das preliminares
✗ Pular preliminares aplicáveis
```

3. Salve
4. Ordem sempre correta!

---

## 🔧 Troubleshooting

### Problema 1: Não Consigo Editar

**Sintoma:** Botão "Salvar" desabilitado ou erro de permissão.

**Possíveis Causas:**

1. **Não está autenticado**
   - Solução: Faça login novamente

2. **Não tem permissão**
   - Se você é `user`: Não pode editar (somente visualizar)
   - Se você é `partner_admin`: Pode editar apenas seu escritório
   - Solução: Verifique com administrador

3. **Tentando editar outro escritório**
   - `partner_admin` só edita próprio escritório
   - Solução: Acesse `/admin/custom-instructions?partnerId=SEU_ID`

**Como Verificar Permissão:**

```bash
# Fazer request para API
curl -s "https://iarom.com.br/api/custom-instructions/rom" \
  -H "Cookie: connect.sid=SEU_COOKIE"

# Se retornar 403: Sem permissão
# Se retornar 200: Tem permissão
```

---

### Problema 2: Alterações Não Aparecem nas Peças

**Sintoma:** Salvei Custom Instructions mas peças ainda não seguem.

**Possíveis Causas:**

1. **Cache do navegador**
   - Solução: Ctrl+Shift+R (hard refresh)

2. **Deploy ainda não completou**
   - Se acabou de fazer push, aguarde 5-10 min
   - Solução: Verifique status em dashboard.render.com

3. **Settings desabilitadas**
   - Verifique "Aplicar em geração de peças" está ☑️
   - Solução: Marque checkbox e salve novamente

4. **Versão antiga em cache do servidor**
   - Cache de 5min
   - Solução: Aguarde 5 minutos ou reinicie servidor

**Como Testar:**

1. Acesse `/admin/custom-instructions/rom/preview`
2. Copie o texto compilado
3. Verifique se suas alterações estão lá
4. Se SIM: Problema no PromptBuilder
5. Se NÃO: Problema no salvamento

---

### Problema 3: Sugestões de IA Não Aparecem

**Sintoma:** Clico em "Executar Análise" mas nada acontece.

**Possíveis Causas:**

1. **Análise ainda processando**
   - Demora 1-2 minutos
   - Solução: Aguarde e recarregue página

2. **Erro na API Bedrock**
   - Claude API pode estar fora
   - Solução: Tente novamente em 5 minutos

3. **Nenhum problema detectado**
   - Sistema não encontrou problemas para sugerir
   - Solução: Normal, significa que está tudo OK!

**Como Depurar:**

```bash
# Ver logs do servidor
tail -f /var/data/logs/server.log | grep "CustomInstructions Analyzer"

# Verificar se análise foi executada
curl -s "https://iarom.com.br/api/custom-instructions/rom/suggestions"
```

---

### Problema 4: Rollback Não Funciona

**Sintoma:** Erro ao tentar fazer rollback.

**Possíveis Causas:**

1. **Não é master_admin**
   - Apenas você (ROM) pode fazer rollback
   - `partner_admin` não tem essa permissão
   - Solução: Pedir para master_admin

2. **Versão não encontrada**
   - Arquivo de versão foi deletado
   - Solução: Usar versão mais recente disponível

**Rollback Manual (Emergência):**

```bash
# 1. Ir para diretório de versões
cd /var/data/data/custom-instructions/rom/versions

# 2. Listar versões
ls -la

# 3. Copiar versão desejada para arquivo principal
cp v1.2.json ../custom-instructions.json

# 4. Reiniciar servidor
pm2 restart rom-agent
```

---

### Problema 5: Texto Muito Longo (> 2.000 tokens)

**Sintoma:** Warning de tokens alto.

**Solução:**

1. **Identifique seções redundantes**
   - Leia o texto e encontre repetições
   - Remova exemplos duplicados

2. **Use abreviações**
   ```
   ❌ ANTES: "Código de Processo Civil"
   ✅ DEPOIS: "CPC"

   ❌ ANTES: "Superior Tribunal de Justiça"
   ✅ DEPOIS: "STJ"
   ```

3. **Condensar listas**
   ```
   ❌ ANTES:
   • Petição Inicial: 15-20 páginas
   • Petição de Recurso: 20-30 páginas
   • Petição de Apelação: 20-30 páginas

   ✅ DEPOIS:
   • Petições: 15-30 páginas (varia por tipo)
   ```

4. **Dividir entre componentes**
   - Mova formatação para Componente 2
   - Mova técnicas de redação para Componente 3
   - Mantenha apenas identidade/comportamento no Componente 1

---

## ❓ FAQ - Perguntas Frequentes

### Q1: Posso ter Custom Instructions diferentes por tipo de peça?

**R:** Não diretamente. As Custom Instructions são aplicadas **globalmente** a todas as peças.

**Alternativa:** Use condicionais no texto:
```
Para PETIÇÕES INICIAIS:
- Extensão: 15-20 páginas
- ...

Para CONTESTAÇÕES:
- Extensão: 15-25 páginas
- ...
```

---

### Q2: Quanto tempo demora para análise de IA?

**R:**
- **Análise manual (trigger):** 1-2 minutos
- **Análise automática (cron):** Executa segunda 02:00 ou dia 1 02:00

---

### Q3: Posso desabilitar análise automática?

**R:** Sim!

1. Edite `/var/data/data/custom-instructions/rom/custom-instructions.json`
2. Altere:
   ```json
   "aiSuggestions": {
     "enabled": false
   }
   ```
3. Salve e reinicie servidor

**OU** (mais fácil):

Use API:
```bash
curl -X PUT "https://iarom.com.br/api/custom-instructions/rom" \
  -H "Content-Type: application/json" \
  -d '{"settings": {"aiSuggestions": {"enabled": false}}}'
```

---

### Q4: O que acontece se eu rejeitar uma sugestão por engano?

**R:** Sem problema! Você pode:

1. Executar nova análise (trigger manual)
2. Sistema pode gerar a mesma sugestão novamente
3. Ou editar manualmente as Custom Instructions

Sugestões rejeitadas **não são perdidas**, ficam marcadas como "rejected" no histórico.

---

### Q5: Posso copiar Custom Instructions de outro escritório?

**R:** Sim, se você for `master_admin`:

1. Acesse `/admin/custom-instructions?partnerId=parceiro1`
2. Copie o texto dos 3 componentes
3. Acesse `/admin/custom-instructions?partnerId=parceiro2`
4. Cole o texto
5. Salve

**ATENÇÃO:** Isso sobrescreverá as Custom Instructions do parceiro2!

---

### Q6: Custom Instructions afetam o custo da API?

**R:** Sim, mas minimamente.

**Cálculo:**
- Custom Instructions: ~1.200 tokens (média)
- Prompt específico da peça: ~500 tokens
- Mensagem do usuário: ~200 tokens
- **Total input:** ~1.900 tokens

**Custo adicional:**
- Sonnet 4.5: ~$0.003 por request (adicional ~$0.0036)
- **Impacto:** < 1% do custo total

**Vale a pena?** **SIM!** Qualidade muito superior justifica custo mínimo.

---

### Q7: Posso usar Custom Instructions em outros projetos?

**R:** As Custom Instructions são **globais** ao sistema ROM Agent.

Se você quer instruções específicas para um projeto/cliente:
- Use campo "Contexto Adicional" ao gerar peça
- Ou crie prompts específicos em `/prompts`

---

### Q8: Como desfazer uma alteração?

**R:** Use o sistema de versionamento:

1. Acesse Histórico
2. Encontre a versão anterior à alteração
3. Clique em "Fazer Rollback" (master_admin only)

**OU** edite manualmente e desfaça as mudanças.

---

### Q9: Sugestões de IA são aplicadas automaticamente?

**R:** **NÃO!** Todas as sugestões requerem **aprovação manual**.

O sistema:
1. Gera sugestões automaticamente (cron)
2. Salva como "pending"
3. Aguarda você revisar e decidir (Apply/Reject)
4. Apenas depois de "Apply" é que a alteração é feita

**Segurança:** Você sempre tem controle total!

---

### Q10: Posso editar Custom Instructions via API?

**R:** Sim! Veja documentação de API:

```bash
# Listar Custom Instructions
GET /api/custom-instructions/rom

# Atualizar Custom Instructions
PUT /api/custom-instructions/rom
Body: {
  "components": {
    "customInstructions": {
      "content": {
        "text": "Novo texto..."
      }
    }
  }
}

# Ver preview
GET /api/custom-instructions/rom/preview

# Ver versões
GET /api/custom-instructions/rom/versions
```

---

## 📞 Suporte

### Precisa de Ajuda?

- **Documentação Técnica:** Ver `KB-CORRECOES-COMPLETAS-REFERENCIA.md`
- **Issues no GitHub:** https://github.com/rodolfo-svg/ROM-Agent/issues
- **Email:** [seu email de suporte]

---

## 🎓 Treinamento Recomendado

### Para Novos Administradores:

1. **Dia 1:** Ler este guia completo (30 min)
2. **Dia 2:** Fazer edição simples (adicionar proibição)
3. **Dia 3:** Testar geração de peça e validar alteração
4. **Dia 4:** Executar análise manual e revisar sugestões
5. **Dia 5:** Configurar análise automática

### Para Usuários Regulares:

1. Ler seções: "Visão Geral" e "Conceitos Fundamentais"
2. Entender que Custom Instructions **sempre** são aplicadas
3. Saber que podem desabilitar se necessário (se permitido)

---

**Última atualização:** 03/02/2026
**Versão do Guia:** 1.0
**Sistema:** Custom Instructions v1.0

---

*Este guia será atualizado conforme novas funcionalidades forem adicionadas ao sistema.*
