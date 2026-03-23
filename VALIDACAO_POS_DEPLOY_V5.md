# VALIDAÇÃO PÓS-DEPLOY IAROM V5.0

**Usar após:** Deploy completado no Render
**Objetivo:** Garantir que tudo está funcionando corretamente

---

## VALIDAÇÃO 1: INFRAESTRUTURA (5 min)

### 1.1 Health Check

```bash
# Deve retornar: {"status":"ok"}
curl https://iarom.com.br/health

# Ou com detalhes
curl https://iarom.com.br/health | jq '.'
```

**Esperado:**
```json
{
  "status": "ok",
  "uptime": 123456,
  "timestamp": "2026-03-23T12:00:00.000Z"
}
```

### 1.2 API Info

```bash
# Informações do sistema
curl https://iarom.com.br/api/info | jq '.'
```

**Esperado:**
```json
{
  "name": "ROM Agent",
  "version": "2.8.0",
  "iarom_version": "5.0.0",
  "node_version": "25.2.1",
  "environment": "production",
  "uptime": 123456
}
```

### 1.3 Logs do Render

**Via Dashboard:**
1. Acessar: https://dashboard.render.com/web/srv-d4ueaf2li9vc73d3rj00/logs
2. Verificar últimas 50 linhas
3. Procurar por erros (palavras: ERROR, FATAL, CRASH)

**Esperado:**
- Sem linhas de ERROR críticos
- Sem crashes ou restarts inesperados
- Mensagens de "Server started" ou "Listening on port 10000"

---

## VALIDAÇÃO 2: PROMPTS (10 min)

### 2.1 Listar Prompts Disponíveis

```bash
# Listar todos os prompts
curl https://iarom.com.br/api/prompts | jq '.prompts | length'

# Esperado: 92 ou mais
```

### 2.2 Verificar Nomenclatura

```bash
# Ver primeiros 10 prompts
curl https://iarom.com.br/api/prompts | jq '.prompts[0:10] | .[] | .name'

# Esperado: Nomes no formato "PROMPT_NOME_v1.0.txt"
# SEM: V5_0, V5.0, ou outros formatos inconsistentes
```

**Exemplo esperado:**
```
"PROMPT_PETICAO_INICIAL_CIVEL_v1.0.txt"
"PROMPT_CONTESTACAO_TRABALHISTA_v1.0.txt"
"PROMPT_RECURSO_APELACAO_v1.0.txt"
...
```

### 2.3 Verificar Conteúdo de Prompt

```bash
# Pegar conteúdo de um prompt específico
curl https://iarom.com.br/api/prompts/PROMPT_PETICAO_INICIAL_CIVEL_v1.0.txt | jq '.content' | head -50

# Verificar:
# - SEM emojis (❌, ✅, 📋, etc)
# - SEM elementos decorativos (═══, ───, ╔═╗)
# - Português correto
# - Formatação profissional
```

### 2.4 Buscar Prompt por Categoria

```bash
# Buscar prompts trabalhistas
curl https://iarom.com.br/api/prompts?category=trabalhista | jq '.prompts | length'

# Buscar prompts criminais
curl https://iarom.com.br/api/prompts?category=criminal | jq '.prompts | length'
```

---

## VALIDAÇÃO 3: MÓDULOS IAROM (10 min)

### 3.1 Listar Módulos

```bash
# Listar módulos disponíveis
curl https://iarom.com.br/api/knowledge-base/modules | jq '.modules | length'

# Esperado: 8 ou mais
```

### 3.2 Verificar Módulos Específicos

```bash
# Ver nomes dos módulos
curl https://iarom.com.br/api/knowledge-base/modules | jq '.modules[] | .name'

# Esperado:
# - IAROM_MASTER_CORE_v1.0.txt
# - IAROM_MOD_FUNDAMENTOS_LEGAIS_v1.0.txt
# - IAROM_MOD_VALIDACAO_v1.0.txt
# - IAROM_MOD_TRANSCRICAO_v1.0.txt
# - IAROM_MOD_FORMATACAO_v1.0.txt
# - IAROM_MOD_PREQUESTIONAMENTO_STJ_v1.0.txt
# - IAROM_MOD_DOUTRINA_v1.0.txt
# - PROMPT_ANALISE_PROCESSUAL_V5.0.txt
```

### 3.3 Carregar Módulo

```bash
# Testar carregamento de módulo
curl https://iarom.com.br/api/knowledge-base/modules/IAROM_MASTER_CORE_v1.0.txt | jq '.content' | head -50

# Verificar:
# - Conteúdo retornado
# - Sem erros de leitura
# - Formatação correta
```

---

## VALIDAÇÃO 4: CUSTOM INSTRUCTIONS (5 min)

### 4.1 Verificar Custom Instructions V5.0

```bash
# Listar custom instructions
curl https://iarom.com.br/api/custom-instructions | jq '.instructions[] | .version'

# Esperado: Incluir "V5.0"
```

### 4.2 Verificar Conteúdo

```bash
# Pegar conteúdo da V5.0
curl https://iarom.com.br/api/custom-instructions/V5.0 | jq '.content' | head -100

# Verificar:
# - Sem emojis
# - Português profissional
# - Instruções claras
```

---

## VALIDAÇÃO 5: FUNCIONAL (20 min)

### 5.1 Criar Peça com Prompt V5.0

```bash
# Criar petição inicial
curl -X POST https://iarom.com.br/api/chat \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer SEU_TOKEN" \
  -d '{
    "message": "Criar petição inicial de ação de cobrança no valor de R$ 10.000,00 contra João da Silva",
    "prompt": "PROMPT_PETICAO_INICIAL_CIVEL_v1.0",
    "useCustomInstructions": true
  }' | jq '.response' | head -100

# Verificar na resposta:
# - Peça foi criada
# - SEM emojis na resposta
# - Formatação profissional
# - Português correto
# - Estrutura jurídica adequada
```

### 5.2 Usar Módulo IAROM

```bash
# Análise com módulo de validação
curl -X POST https://iarom.com.br/api/analyze \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer SEU_TOKEN" \
  -d '{
    "text": "COMARCA DE GOIÂNIA\nJUÍZO DA 1ª VARA CÍVEL\nProcesso nº 1234567-89.2024.8.09.0051\n...",
    "modules": ["IAROM_MOD_VALIDACAO_v1.0"]
  }' | jq '.analysis'

# Verificar:
# - Análise foi retornada
# - Módulo foi carregado corretamente
# - Sem erros
```

### 5.3 Teste de Stress (Opcional)

```bash
# Criar 10 peças simultâneas
for i in {1..10}; do
  curl -X POST https://iarom.com.br/api/chat \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer SEU_TOKEN" \
    -d '{
      "message": "Criar contestação trabalhista",
      "prompt": "PROMPT_CONTESTACAO_TRABALHISTA_v1.0"
    }' &
done

# Aguardar conclusão
wait

# Verificar:
# - Todas as 10 peças foram criadas
# - Sem timeout
# - Performance aceitável (< 30s por peça)
```

---

## VALIDAÇÃO 6: DISCO PERSISTENTE (5 min)

### 6.1 Verificar Arquivos no Render

**Via Render Shell:**

```bash
# Acessar shell do Render
# Dashboard > Service > Shell

# Verificar prompts
ls /var/data/prompts/global/*.txt | wc -l
# Esperado: 92+

# Verificar módulos
ls /var/data/knowledge-base/modules/*.txt | wc -l
# Esperado: 8

# Verificar master prompts
ls /var/data/knowledge-base/master/*.txt | wc -l
# Esperado: 2

# Verificar custom instructions
ls /var/data/custom-instructions/CUSTOM_INSTRUCTIONS_V5.0.txt
# Esperado: arquivo existe

# Verificar espaço em disco
df -h /var/data
# Esperado: < 1 GB usado de 100 GB
```

### 6.2 Verificar Permissões

```bash
# Permissões dos arquivos
ls -la /var/data/prompts/global/*.txt | head -5

# Esperado:
# - Arquivos legíveis (r)
# - Sem arquivos vazios (tamanho > 0)
```

---

## VALIDAÇÃO 7: PERFORMANCE (10 min)

### 7.1 Tempo de Resposta

```bash
# Medir tempo de resposta do health check
time curl https://iarom.com.br/health

# Esperado: < 500ms
```

### 7.2 Tempo de Carregamento de Prompt

```bash
# Medir tempo para listar prompts
time curl https://iarom.com.br/api/prompts | jq '.prompts | length'

# Esperado: < 2s
```

### 7.3 Tempo de Criação de Peça

```bash
# Medir tempo para criar peça simples
time curl -X POST https://iarom.com.br/api/chat \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer SEU_TOKEN" \
  -d '{
    "message": "Criar petição inicial simples",
    "prompt": "PROMPT_PETICAO_INICIAL_CIVEL_v1.0"
  }' | jq '.response' > /dev/null

# Esperado: < 30s
```

---

## VALIDAÇÃO 8: MONITORAMENTO (Contínuo)

### 8.1 Métricas do Render

**Via Dashboard:**
1. Acessar: https://dashboard.render.com/web/srv-d4ueaf2li9vc73d3rj00
2. Ver "Metrics":
   - CPU: < 70% em média
   - Memory: < 3 GB de 4 GB
   - Requests: Estável
   - Response time: < 2s em média

### 8.2 Logs em Tempo Real

```bash
# Via Render Dashboard > Logs
# Ou via Render CLI (se instalado)
render logs -s srv-d4ueaf2li9vc73d3rj00 --tail

# Monitorar por 5-10 minutos
# Verificar:
# - Sem erros recorrentes
# - Sem warnings críticos
# - Sem restarts inesperados
```

---

## CHECKLIST RÁPIDO

### Infraestrutura

- [ ] Health check OK (status 200)
- [ ] API info retorna versão 2.8.0 + IAROM 5.0.0
- [ ] Logs sem erros críticos
- [ ] Serviço está "running" no Render

### Prompts

- [ ] Total de prompts = 92+
- [ ] Nomenclatura padronizada (v1.0)
- [ ] Conteúdo sem emojis
- [ ] Conteúdo sem decoração

### Módulos

- [ ] Total de módulos = 8
- [ ] Módulos carregam corretamente
- [ ] Master prompts disponíveis (2)

### Custom Instructions

- [ ] V5.0 disponível
- [ ] Conteúdo sem emojis
- [ ] Aplicadas corretamente

### Funcional

- [ ] Criação de peça funciona
- [ ] Resposta limpa (sem emojis)
- [ ] Módulos IAROM funcionam
- [ ] Performance aceitável (< 30s)

### Disco Persistente

- [ ] 92+ prompts em /var/data/prompts/global/
- [ ] 8 módulos em /var/data/knowledge-base/modules/
- [ ] 2 master em /var/data/knowledge-base/master/
- [ ] Custom Instructions V5.0 existe
- [ ] Espaço em disco OK (< 50 GB de 100 GB)

### Performance

- [ ] Health check < 500ms
- [ ] Listar prompts < 2s
- [ ] Criar peça < 30s
- [ ] CPU < 70%
- [ ] Memory < 3 GB

---

## PROBLEMAS COMUNS E SOLUÇÕES

### Problema: API retorna 404

**Causa:** Deploy ainda em andamento ou falhou

**Solução:**
```bash
# Verificar status do deploy
curl https://dashboard.render.com/api/services/srv-d4ueaf2li9vc73d3rj00

# Aguardar mais 2-5 minutos
# Verificar logs do Render
```

### Problema: Prompts não listados (0 prompts)

**Causa:** Arquivos não copiados para disco persistente

**Solução:**
```bash
# Via Render Shell
cp -r /opt/render/project/src/data/prompts/global/* /var/data/prompts/global/

# Reiniciar serviço
# Dashboard > Manual Deploy > Clear build cache & deploy
```

### Problema: Módulos não carregam

**Causa:** Variável KNOWLEDGE_BASE_FOLDER não configurada

**Solução:**
```bash
# Via Render Dashboard
# Environment > Add Environment Variable
# Key: KNOWLEDGE_BASE_FOLDER
# Value: /var/data/knowledge-base

# Redeploy
```

### Problema: Resposta com emojis

**Causa:** Custom Instructions antigas sendo usadas

**Solução:**
```bash
# Verificar qual CI está ativa
curl https://iarom.com.br/api/custom-instructions/current

# Se não for V5.0, atualizar default
# Via código ou API admin
```

### Problema: Performance lenta (> 30s)

**Causa:** CPU/RAM sobrecarregados

**Solução:**
```bash
# Verificar métricas no Render
# Se CPU > 80% ou Memory > 3.5 GB:
# - Reduzir WEB_CONCURRENCY de 2 para 1
# - Ou aumentar plano (Pro -> Pro Plus)
```

---

## RELATÓRIO DE VALIDAÇÃO

### Template para preencher

```
VALIDAÇÃO PÓS-DEPLOY IAROM V5.0
Data: ___/___/2026
Hora: ___:___
Responsável: __________________

INFRAESTRUTURA:
✅ | ❌  Health check
✅ | ❌  API info
✅ | ❌  Logs limpos
✅ | ❌  Serviço running

PROMPTS:
✅ | ❌  Total: ___ prompts (esperado: 92+)
✅ | ❌  Nomenclatura padronizada
✅ | ❌  Sem emojis
✅ | ❌  Sem decoração

MÓDULOS:
✅ | ❌  Total: ___ módulos (esperado: 8)
✅ | ❌  Carregam corretamente
✅ | ❌  Master prompts (2)

CUSTOM INSTRUCTIONS:
✅ | ❌  V5.0 disponível
✅ | ❌  Sem emojis
✅ | ❌  Aplicadas corretamente

FUNCIONAL:
✅ | ❌  Criação de peça OK
✅ | ❌  Resposta limpa
✅ | ❌  Módulos funcionam
✅ | ❌  Performance < 30s

DISCO PERSISTENTE:
✅ | ❌  92+ prompts
✅ | ❌  8 módulos
✅ | ❌  2 master prompts
✅ | ❌  CI V5.0
✅ | ❌  Espaço OK

PERFORMANCE:
✅ | ❌  Health < 500ms (medido: ___ms)
✅ | ❌  Listar < 2s (medido: ___s)
✅ | ❌  Criar peça < 30s (medido: ___s)
✅ | ❌  CPU < 70% (medido: ___%)
✅ | ❌  Memory < 3 GB (medido: ___GB)

PROBLEMAS ENCONTRADOS:
_______________________________________________
_______________________________________________
_______________________________________________

RESULTADO FINAL:
⬜ APROVADO - Todas as validações OK
⬜ APROVADO COM RESSALVAS - Warnings não críticos
⬜ REPROVADO - Problemas críticos encontrados

AÇÕES NECESSÁRIAS:
_______________________________________________
_______________________________________________
_______________________________________________

Assinatura: _____________________
```

---

## PRÓXIMOS PASSOS APÓS VALIDAÇÃO

### Se APROVADO:

1. **Criar tag de versão:**
   ```bash
   cd ~/ROM-Agent
   git tag -a v5.0.0 -m "IAROM V5.0 - Refactored prompts and modules"
   git push origin v5.0.0
   ```

2. **Atualizar CHANGELOG:**
   - Documentar mudanças do V5.0
   - Listar melhorias e correções

3. **Notificar stakeholders:**
   - Email/mensagem para equipe
   - Atualizar status em boards/tickets

4. **Monitorar por 24-48h:**
   - Verificar logs 2x ao dia
   - Acompanhar métricas de performance
   - Coletar feedback de usuários

### Se REPROVADO:

1. **Executar rollback:**
   - Ver: `PLANO_DEPLOY_IAROM_V5.md` seção "Rollback"

2. **Investigar causa raiz:**
   - Analisar logs detalhadamente
   - Verificar configurações
   - Testar localmente

3. **Corrigir e redeployar:**
   - Aplicar correções
   - Testar novamente
   - Executar deploy incremental

---

**Validação documentada em:** 23/03/2026
**Versão:** 1.0
**Tempo estimado:** 60-90 minutos
**Criticidade:** ALTA (validar antes de considerar deploy concluído)
