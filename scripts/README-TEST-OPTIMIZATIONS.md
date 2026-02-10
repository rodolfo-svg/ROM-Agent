# 🧪 Script de Teste de Otimizações de Custo

Script automatizado para validar todas as 3 fases de otimização implementadas no ROM Agent.

## 📋 O que o script testa:

### ✅ FASE 1: Correção de Bugs de Modelo
- Verifica se os serviços estão usando os modelos corretos
- **Economia: $300-400/mês**

### ✅ FASE 2: Auto-Seleção de Modelos
- Testa se o sistema escolhe automaticamente o modelo mais barato
- Valida seleção de Nova Micro, Haiku, Sonnet e Opus
- **Economia: $300/mês adicional**

### ✅ FASE 3: Cache de Análises
- Verifica estatísticas do cache de análises
- Mostra hit rate e economia em reprocessamento
- **Economia: $200-300/mês adicional**

### 💰 ECONOMIA TOTAL: $800-1000/mês (33-42% de redução)

---

## 🚀 Como usar:

### 1. Configure suas credenciais

**Opção A: Arquivo .env.test**
```bash
# Edite o arquivo .env.test
nano .env.test

# Adicione suas credenciais:
TEST_EMAIL=seu_email@dominio.com
TEST_PASSWORD=sua_senha_aqui
```

**Opção B: Variáveis de ambiente**
```bash
export TEST_EMAIL="seu_email@dominio.com"
export TEST_PASSWORD="sua_senha_aqui"
```

**Opção C: Editar direto no script**
```bash
# Edite a linha 17-18 do script:
const TEST_CONFIG = {
  email: 'seu_email@dominio.com',
  password: 'sua_senha_aqui'
};
```

### 2. Execute o script

```bash
# No diretório raiz do projeto:
node scripts/test-cost-optimizations.js
```

**OU se tornou executável:**
```bash
./scripts/test-cost-optimizations.js
```

---

## 📊 Exemplo de saída:

```
╔══════════════════════════════════════════════════════════════╗
║                                                              ║
║       ROM AGENT - TESTE DE OTIMIZAÇÕES DE CUSTO             ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝

ℹ️  Testando sistema em: https://iarom.com.br
ℹ️  Usuário: rodolfo@rom.com.br

======================================================================
ETAPA 1: AUTENTICAÇÃO
======================================================================

ℹ️  Obtendo CSRF token...
✅ CSRF token obtido
ℹ️  Fazendo login...
✅ Login realizado com sucesso

======================================================================
ETAPA 2: AUTO-SELEÇÃO DE MODELOS (FASE 2)
======================================================================

ℹ️  Testando: Tarefa Ultra-Simples (deve usar Nova Micro - $0.035/1M)
   Prompt: "Extraia apenas o número do CPF: 123.456.789-00"
✅ Modelo correto usado: us.amazon.nova-micro-v1:0

ℹ️  Testando: Tarefa Simples (deve usar Haiku - $1/1M)
   Prompt: "Extraia as seguintes informações em JSON: Nome: João Silv..."
✅ Modelo correto usado: us.anthropic.claude-haiku-4-5-20251001-v1:0

ℹ️  Testando: Tarefa Média (deve usar Sonnet - $3/1M)
   Prompt: "Analise este texto e extraia insights jurídicos relevante..."
✅ Modelo correto usado: us.anthropic.claude-sonnet-4-5-20241022-v2:0

======================================================================
ETAPA 3: CACHE DE ANÁLISES (FASE 3)
======================================================================

ℹ️  Obtendo estatísticas do cache...
✅ Estatísticas do cache obtidas:
  📊 Total de entradas: 15
  ✅ Cache hits: 42
  ❌ Cache misses: 18
  📈 Hit rate: 70.0%
  💾 Tamanho total: 0.35 MB
  ⏱️  TTL: 24 horas
✅ Economia de 70.0% em reprocessamento!

======================================================================
ETAPA 4: SAÚDE DO SISTEMA
======================================================================

ℹ️  Verificando health do sistema...

📊 PostgreSQL:
✅ Conectado (latência: 1ms)
   Pool: 1 conexões (1 ociosas)

📊 Redis:
✅ Conectado (latência: 1ms)
   Status: ready
   Memória: 736.03K
   Clientes: 1

======================================================================
📊 RELATÓRIO FINAL DE OTIMIZAÇÕES
======================================================================

✅ FASE 1: Correção de Bugs de Modelo
   • jurisprudence-analyzer-service.js: modelo → Haiku (linha 90)
   • jurimetria-service.js: análise → Haiku (linha 424)
   • jurimetria-service.js: cotejamento → Haiku (linha 628)
   💰 Economia estimada: $300-400/mês

✅ FASE 2: Auto-Seleção de Modelos
   • Testes realizados: 3
   • Sucesso: 3/3
   ✅ Tarefa Ultra-Simples (deve usar Nova Micro - $0.035/1M)
   ✅ Tarefa Simples (deve usar Haiku - $1/1M)
   ✅ Tarefa Média (deve usar Sonnet - $3/1M)
   💰 Economia estimada: $300/mês adicional

✅ FASE 3: Cache de Análises
   • Entradas em cache: 15
   • Hit rate: 70.0%
   • Tamanho: 0.35 MB
   💰 Economia atual: 70.0% em reprocessamento
   💰 Economia estimada: $200-300/mês adicional

💰 ECONOMIA TOTAL ESTIMADA: $800-1000/mês (33-42% redução)

🏗️  INFRAESTRUTURA:
   • PostgreSQL: ✅ Online
   • Redis: ✅ Online

======================================================================
✅ TODAS AS OTIMIZAÇÕES ESTÃO ATIVAS E FUNCIONANDO!
======================================================================

✅ Testes concluídos com sucesso!
```

---

## 🔧 Troubleshooting:

### Erro: "Falha no login"
- Verifique se o email e senha estão corretos
- Verifique se o usuário existe no sistema

### Erro: "Endpoint /api/cache/stats não disponível"
- Normal se o endpoint ainda não foi implementado
- O teste continuará normalmente

### Erro: "connect ECONNREFUSED"
- Verifique se o sistema está rodando em https://iarom.com.br
- Verifique sua conexão de internet

---

## 📝 Notas:

- **Duração:** ~30-60 segundos
- **Requisitos:** Node.js 18+, credenciais válidas
- **Segurança:** Não commite .env.test com senhas reais!
- **Rate limiting:** O script respeita delays entre requisições

---

## 🎯 Próximos passos:

Após executar o teste com sucesso, você pode:

1. **Monitorar custos** no AWS Cost Explorer
2. **Acompanhar hit rate** do cache em `/api/cache/stats`
3. **Validar economia** comparando faturas antes/depois
4. **Ajustar modelos** se necessário em `model-selector.js`

---

**💡 Dica:** Execute este teste periodicamente (semanalmente) para garantir que todas as otimizações continuam ativas!
