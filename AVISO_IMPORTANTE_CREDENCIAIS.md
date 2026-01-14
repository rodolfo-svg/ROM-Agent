# ⚠️ AVISO IMPORTANTE: VARIÁVEIS DE AMBIENTE

## 🚨 LIMITAÇÃO DETECTADA

A integração está executando, mas **algumas variáveis de ambiente críticas estão faltando**:

### ❌ Faltando

```bash
AWS_ACCESS_KEY_ID         ← CRÍTICO para 17 ferramentas Bedrock
AWS_SECRET_ACCESS_KEY     ← CRÍTICO para 17 ferramentas Bedrock
GOOGLE_SEARCH_API_KEY     ← CRÍTICO para jurisprudência
GOOGLE_SEARCH_CX          ← CRÍTICO para jurisprudência
```

---

## 📊 IMPACTO

### O que VAI funcionar (49 ferramentas)
- ✅ Pipeline de extração local (33 ferramentas)
- ✅ OCR completo (Tesseract, Sharp)
- ✅ Upload de 500 MB
- ✅ Streaming SSE
- ✅ Sistema de monitoramento
- ✅ Skills Claude (11)
- ✅ Módulos backend locais

### O que NÃO vai funcionar (29 ferramentas)
- ❌ **AWS Bedrock** (17 funções): Embeddings, Claude Opus/Sonnet/Haiku via Bedrock, Titan
- ❌ **Google Search** (8 funções): Busca de jurisprudência, busca de doutrina
- ❌ **DataJud** (4 funções): API oficial CNJ (se não tiver key)

### O que PODE ser implementado (8 ferramentas)
- ✅ **Scrapers de tribunais** (não dependem de APIs externas):
  - PROJUDI (15 tarefas)
  - ESAJ (15 tarefas)
  - PJe (15 tarefas)
  - ePROC (12 tarefas)

---

## 🎯 RESULTADO ESPERADO

**Sem as credenciais**:
- 49 ferramentas operacionais (já funcionam)
- +8 scrapers implementados
- **Total: 57/86 ferramentas (66%)**

**Com as credenciais completas**:
- 49 ferramentas operacionais
- +17 Bedrock
- +8 Google Search
- +4 DataJud
- +8 Scrapers
- **Total: 86/86 ferramentas (100%)**

---

## 🔧 COMO CORRIGIR

### 1. Obter Credenciais AWS

```bash
# Criar/acessar conta AWS
# Ir para IAM → Users → Security Credentials
# Criar Access Key

# Adicionar ao .env
echo "AWS_ACCESS_KEY_ID=AKIAXXXXXXXXXXXXXXXX" >> .env
echo "AWS_SECRET_ACCESS_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxx" >> .env
echo "AWS_REGION=us-west-2" >> .env
```

### 2. Obter API Key Google

```bash
# Ir para: https://console.cloud.google.com
# Criar projeto
# Ativar "Custom Search API"
# Criar credenciais (API Key)
# Criar Search Engine em: https://programmablesearchengine.google.com

# Adicionar ao .env
echo "GOOGLE_SEARCH_API_KEY=AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX" >> .env
echo "GOOGLE_SEARCH_CX=xxxxxxxxxxxxxxxxxxxx:xxxxxxxxxxxxx" >> .env
```

### 3. Obter API Key DataJud (Opcional)

```bash
# Ir para: https://datajud.cnj.jus.br
# Solicitar acesso
# Obter API Key

# Adicionar ao .env
echo "DATAJUD_API_KEY=xxxxxxxxxxxxxxxxxxxxxxxxx" >> .env
```

### 4. Re-executar Integração

```bash
# Após adicionar as credenciais, re-executar:
./scripts/run-integration.sh --agents="aws-bedrock,google-search,datajud" --model=opus
```

---

## 💡 O QUE FAZER AGORA

### Opção 1: Continuar Sem as Credenciais (Atual)
A integração está rodando e vai implementar **os scrapers de tribunais** que não dependem de APIs externas. Resultado: **57/86 ferramentas (66%)**.

### Opção 2: Parar, Configurar Credenciais e Re-executar
1. Parar execução atual
2. Adicionar credenciais ao .env
3. Re-executar integração completa
4. Resultado: **86/86 ferramentas (100%)**

---

## 📋 CHECKLIST DE CONFIGURAÇÃO

- [ ] AWS_ACCESS_KEY_ID configurado
- [ ] AWS_SECRET_ACCESS_KEY configurado
- [ ] AWS_REGION configurado
- [ ] GOOGLE_SEARCH_API_KEY configurado
- [ ] GOOGLE_SEARCH_CX configurado
- [ ] DATAJUD_API_KEY configurado (opcional)
- [ ] CNJ_USUARIO configurado (opcional)
- [ ] CNJ_SENHA configurado (opcional)

---

**Criado em**: 2026-01-10 19:49
**Status da Integração**: Rodando (mas limitada)
**Próxima Ação Recomendada**: Configurar credenciais e re-executar para 100%
