# 🧪 Teste de Peça Grande (40 Páginas)

**Data**: 2026-02-03
**Objetivo**: Validar limites aumentados para geração de documentos extensos
**Status**: ⏳ **EM ANDAMENTO**

---

## 📋 Especificações do Teste

### Tipo de Documento
**Recurso de Apelação Cível Complexo**

### Extensão Esperada
**~40 páginas** (~80.000 tokens)

### Complexidade
- **Preliminares**: 4 teses extensas (cerceamento, nulidades, violações)
- **Mérito**: 5 capítulos principais com subcapítulos
- **Análise de Provas**: 12 documentos + 5 testemunhas + perícia
- **Entregas**: 25 deliverables analisados
- **Jurisprudência**: 33 precedentes (15 STJ + 10 TJSP + 8 outros)
- **Doutrina**: 5 autores + comentários aos artigos
- **Pedidos**: Detalhados e fundamentados

### Valor da Causa
R$ 850.000,00 (cobrança de serviços de consultoria)

---

## 🎯 O Que Estamos Testando

### 1. Token Limits
✅ **Limite Configurado**: 100K tokens (padrão)
- Peça de 40 páginas ≈ 80K tokens
- Deve gerar SEM truncamento
- Deve completar com fecho, pedidos e assinatura

### 2. Timeouts
✅ **Timeout HTTP**: 20 minutos
✅ **Timeout Bedrock**: 15 minutos
- Estimativa de geração: 6-12 minutos
- Deve completar SEM timeout
- Streaming deve funcionar até o final

### 3. Qualidade
✅ **Estrutura**: Hierárquica (I, II, III → 1, 2, 3 → a, b, c)
✅ **Formatação**: ABNT/OAB
✅ **Conteúdo**: Exaustivo, técnico, persuasivo
✅ **Citações**: Precedentes pesquisados
✅ **Sem Markdown**: Zero emojis, asteriscos, ou markdown

### 4. Estabilidade
- ❌ Sistema NÃO deve travar
- ❌ Streaming NÃO deve quebrar
- ❌ NÃO deve haver erros de memória
- ✅ Servidor deve permanecer responsivo

---

## 📊 Limites Anteriores vs. Novos

| Aspecto | Antes | Agora | Teste |
|---------|-------|-------|-------|
| **Tokens Output** | 32K (~15 pág) | 100K (~50 pág) | 80K (~40 pág) ✅ |
| **Timeout HTTP** | 10 min | 20 min | ~10 min ✅ |
| **Timeout Bedrock** | 3 min ⚠️ | 15 min | ~10 min ✅ |
| **Extensão Máxima** | ~30 páginas | ~50 páginas | 40 páginas ✅ |

---

## ⏱️ Timeline Esperada

```
┌─────────────────────────────────────────────────┐
│  Geração de Peça de 40 Páginas (~80K tokens)   │
├─────────────────────────────────────────────────┤
│  00:00 - 00:30  │  Análise do pedido           │
│  00:30 - 02:00  │  Preliminares (4 teses)      │
│  02:00 - 08:00  │  Mérito (5 capítulos densos) │
│  08:00 - 10:00  │  Jurisprudência (33 prec.)   │
│  10:00 - 11:00  │  Doutrina (5 autores)        │
│  11:00 - 12:00  │  Pedidos + Fecho             │
├─────────────────────────────────────────────────┤
│  TOTAL ESTIMADO: 10-12 minutos                  │
└─────────────────────────────────────────────────┘
```

**Limites de Segurança**:
- ⏰ Timeout máximo: 15 min (Bedrock) / 20 min (HTTP)
- 📄 Token máximo: 100K (limite configurado)

---

## 🔍 Como Acompanhar o Progresso

### Opção 1: Tail do Output (Recomendado)
```bash
tail -f /tmp/teste-peca-40-paginas.json
```

### Opção 2: Verificar Status do Background Task
```bash
# Task ID: bff244e
# Output file: /tmp/claude/-Users-rodolfootaviopereiradamotaoliveira/tasks/bff244e.output
```

### Opção 3: Logs do Servidor
```bash
pm2 logs rom-agent --lines 50
```

---

## ✅ Critérios de Sucesso

### Obrigatórios (Pass/Fail)
- [ ] Peça gerada completamente (sem truncamento)
- [ ] Extensão: 35-45 páginas (tolerância ±5)
- [ ] Sem timeouts
- [ ] Sem erros no servidor
- [ ] Streaming funcionou até o final
- [ ] Fecho e assinatura presentes

### Qualidade (Desejável)
- [ ] Estrutura hierárquica correta (I→II→III)
- [ ] Formatação ABNT/OAB aplicada
- [ ] Todas as 4 preliminares abordadas
- [ ] Todos os 5 capítulos do mérito abordados
- [ ] Jurisprudência pesquisada (mínimo 15 precedentes)
- [ ] Doutrina citada (mínimo 3 autores)
- [ ] Pedidos detalhados e fundamentados
- [ ] Zero markdown/emojis

---

## 📈 Métricas Coletadas

### Performance
- **Tempo de geração**: ___ minutos (meta: <12 min)
- **Tokens gerados**: ___ tokens (meta: 75K-85K)
- **Páginas geradas**: ___ páginas (meta: 35-45)

### Qualidade
- **Truncamento**: ❌ Sim / ✅ Não (meta: Não)
- **Timeout**: ❌ Sim / ✅ Não (meta: Não)
- **Streaming quebrado**: ❌ Sim / ✅ Não (meta: Não)
- **Erros de servidor**: ❌ Sim / ✅ Não (meta: Não)

### Conteúdo
- **Preliminares abordadas**: ___ / 4 (meta: 4/4)
- **Capítulos do mérito**: ___ / 5 (meta: 5/5)
- **Precedentes citados**: ___ (meta: ≥15)
- **Autores citados**: ___ (meta: ≥3)
- **Estrutura correta**: ❌ Não / ✅ Sim (meta: Sim)
- **Formatação ABNT**: ❌ Não / ✅ Sim (meta: Sim)

---

## 🚨 Problemas Conhecidos a Monitorar

### P0 - Críticos (Impedem Uso)
- ⚠️ **Timeout em 3 minutos** → ✅ CORRIGIDO (15 min)
- ⚠️ **Truncamento em 32K tokens** → ✅ CORRIGIDO (100K)

### P1 - Importantes (Degradam Experiência)
- ⚠️ Streaming pode congelar em peças muito longas
- ⚠️ Servidor pode ficar unresponsive durante geração

### P2 - Desejáveis (Melhorias)
- Falta de indicador de progresso visual para usuário
- Não há estimativa de tempo restante

---

## 📝 Notas de Execução

**Início**: 2026-02-03 às [HORA_INICIO]
**Task ID**: bff244e
**Output File**: /tmp/teste-peca-40-paginas.json
**Background Task Output**: /tmp/claude/-Users-rodolfootaviopereiradamotaoliveira/tasks/bff244e.output

**Status Atual**: ⏳ Gerando peça...

---

## 🎯 Expectativas

### Se Tudo Funcionar (✅ Sucesso)
1. Peça completa de 40 páginas gerada
2. Tempo de geração: 8-12 minutos
3. Sem truncamento, sem timeout, sem erros
4. Arquivo JSON com resposta completa
5. Sistema permanece estável e responsivo

### Se Houver Problemas (⚠️ Investigar)

**Truncamento em ~40 páginas:**
- Aumentar maxTokens de 100K para 120K
- Verificar se há limite hard-coded em outro módulo

**Timeout antes de completar:**
- Aumentar timeouts além de 15/20 min
- Otimizar streaming (chunks maiores)

**Servidor trava/congela:**
- Aumentar recursos de CPU/memória
- Implementar rate limiting mais inteligente
- Adicionar circuit breaker

**Qualidade baixa (resposta genérica):**
- Problema não é de limites, mas de prompt
- Custom Instructions podem precisar de ajuste

---

**Atualização em tempo real**: Este documento será atualizado quando o teste completar.

---

**Status**: ⏳ **AGUARDANDO CONCLUSÃO** (10-12 minutos estimados)
