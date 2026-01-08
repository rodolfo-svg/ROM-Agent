# 🚀 COMO EXECUTAR: Sistema de 2 Terminais

## 📋 RESUMO

Sistema automatizado que executa todas as correções identificadas na auditoria forense usando **apenas 2 terminais**:

- **Terminal 1 (EXECUTOR)**: Executa todas as correções sequencialmente
- **Terminal 2 (MONITOR)**: Monitoramento em tempo real com streaming visual

Após conclusão, o sistema automaticamente:
1. ✅ Realiza auditoria final
2. ✅ Cria commit no Git
3. ✅ Faz deploy (push + PR)

---

## ⚡ EXECUÇÃO RÁPIDA

```bash
cd /Users/rodolfootaviopereiradamotaoliveira/ROM-Agent

# Dar permissão de execução (só precisa fazer uma vez)
chmod +x scripts/*.sh

# Executar sistema
./scripts/run-orchestrator-simple.sh
```

**Pronto!** O sistema abrirá 2 terminais e começará a trabalhar automaticamente.

---

## 📊 O QUE ACONTECE

### Terminal 1: EXECUTOR 🚀

Executa automaticamente:

#### Fase 1: Segurança (4h)
- ✅ Cria middleware de autenticação (requireAuth, requireAdmin)
- ✅ Implementa rate limiting (express-rate-limit)
- ✅ Gera SESSION_SECRET e ADMIN_TOKEN seguros
- ✅ Adiciona imports de segurança no server-enhanced.js

#### Fase 2: Scrapers (13h)
- ✅ Copia scrapers Python do Desktop
- ✅ Cria bridge Node.js → Python
- ✅ Integra PROJUDI, ESAJ, PJe, ePROC, DJe, STF, STJ, TST, TSE

#### Fase 3: Validação (1h)
- ✅ Instala/atualiza dependências (npm install)
- ✅ Executa linter (npm run lint)
- ✅ Executa testes (npm test)

#### Fase 4: Commit & Deploy
- ✅ Auditoria final
- ✅ Git commit com mensagem detalhada
- ✅ Git push para origin
- ✅ Cria Pull Request (se gh CLI disponível)

### Terminal 2: MONITOR 📺

Exibe em tempo real:
- 📊 Dashboard visual com barra de progresso
- 📝 Streaming das últimas 15 linhas do log
- 📈 Estatísticas (erros, avisos, sucessos)
- ⏱️ Atualização automática a cada 2 segundos
- ✅ Notificação de conclusão

---

## 🎯 PRÉ-REQUISITOS

### Obrigatório
- ✅ Node.js v25+
- ✅ npm
- ✅ Git
- ✅ macOS (para `osascript` abrir terminais)

### Opcional mas Recomendado
- Python 3.8+ (para scrapers)
- gh CLI (para criar PR automaticamente)
- jq (para parsing JSON no monitor)

### Instalar dependências (macOS):
```bash
brew install node python3 jq gh
```

---

## 📁 ESTRUTURA DE ARQUIVOS

```
ROM-Agent/
├── scripts/
│   ├── run-orchestrator-simple.sh  ← EXECUTAR ESTE
│   ├── terminal-executor.sh        (Terminal 1)
│   ├── terminal-monitor.sh         (Terminal 2)
│   ├── commit-and-deploy.sh        (Automático após executor)
│   └── common.sh                   (Funções compartilhadas)
│
├── logs/
│   └── orchestrator-TIMESTAMP/
│       ├── executor.log            (Log completo)
│       ├── executor-status.txt     (Status atual)
│       ├── progress.json           (Progresso em JSON)
│       ├── deploy.log              (Log de deploy)
│       ├── RESUMO_EXECUCAO.md      (Resumo final)
│       ├── commit-info.txt         (Info do commit)
│       └── deploy-info.txt         (Info do deploy)
│
├── AUDITORIA_FORENSE_COMPLETA_2026-01-08.md
├── PLANO_GLOBAL_CORRECAO_2026-01-08.md
├── ESTRATEGIA_GIT_PARALELO.md
└── RESUMO_AUDITORIA_E_PLANO.md
```

---

## 🎬 PASSO A PASSO DETALHADO

### 1. Preparação

```bash
# Navegar para o diretório do projeto
cd /Users/rodolfootaviopereiradamotaoliveira/ROM-Agent

# Verificar que está no diretório correto
pwd
# Deve mostrar: /Users/rodolfootaviopereiradamotaoliveira/ROM-Agent

# Fazer backup manual (recomendado)
git add -A
git commit -m "Checkpoint before orchestration"
git push  # Opcional mas recomendado
```

### 2. Dar Permissões de Execução

```bash
# Dar permissão para todos os scripts (só precisa fazer uma vez)
chmod +x scripts/*.sh

# Verificar permissões
ls -lah scripts/*.sh
# Deve mostrar: -rwxr-xr-x
```

### 3. Executar Sistema

```bash
# Executar orquestrador
./scripts/run-orchestrator-simple.sh
```

**O que acontece:**
1. Banner de boas-vindas aparece
2. Sistema verifica dependências
3. Cria backup automático
4. Cria branch Git: `orchestration/auto-fix-TIMESTAMP`
5. Abre Terminal 1 (EXECUTOR)
6. Abre Terminal 2 (MONITOR)
7. Terminal inicial pode ser fechado

### 4. Acompanhar Execução

**Terminal 1 (EXECUTOR)**:
- Mostra logs detalhados de cada ação
- Executa correções fase por fase
- Cria commits Git incrementais
- Ao final, chama script de deploy

**Terminal 2 (MONITOR)**:
- Dashboard visual atualizado a cada 2 segundos
- Barra de progresso
- Últimas 15 linhas do log (coloridas)
- Estatísticas em tempo real

### 5. Aguardar Conclusão

**Tempo estimado**: 4-8 horas (depende da máquina)

**Você pode**:
- ☕ Tomar café enquanto monitora
- 💻 Trabalhar em outra janela
- 📱 Sair e voltar depois (terminais continuam rodando)

**Quando terminar**:
- Terminal EXECUTOR mostrará "EXECUÇÃO CONCLUÍDA"
- Terminal MONITOR mostrará "✅ TODAS AS OPERAÇÕES CONCLUÍDAS"
- Deploy será executado automaticamente

---

## 📊 LOGS E RELATÓRIOS

Todos os logs ficam em:
```
logs/orchestrator-TIMESTAMP/
```

### Logs Disponíveis

| Arquivo | Descrição |
|---------|-----------|
| `executor.log` | Log completo de toda execução |
| `executor-status.txt` | Status atual (usado pelo monitor) |
| `progress.json` | Progresso em formato JSON |
| `deploy.log` | Log do processo de deploy |
| `RESUMO_EXECUCAO.md` | Resumo legível das alterações |
| `commit-info.txt` | Informações do commit criado |
| `deploy-info.txt` | Informações do deploy |
| `APIS_MOCKADAS.md` | Lista de APIs que requerem config |

### Visualizar Logs em Tempo Real

```bash
# Em outro terminal, você pode acompanhar:
tail -f logs/orchestrator-*/executor.log

# Ou ver progresso JSON:
watch -n 1 'cat logs/orchestrator-*/progress.json | jq'
```

---

## ✅ APÓS CONCLUSÃO

### O que foi feito automaticamente:

1. **Código Corrigido**:
   - ✅ Middleware de autenticação criado
   - ✅ Rate limiting implementado
   - ✅ Scrapers Python integrados
   - ✅ Variáveis de ambiente configuradas

2. **Git**:
   - ✅ Commits criados (um por fase)
   - ✅ Branch criado: `orchestration/auto-fix-TIMESTAMP`
   - ✅ Push para origin

3. **Deploy**:
   - ✅ Pull Request criado (se gh CLI disponível)
   - ✅ Relatórios gerados

### O que fazer manualmente:

1. **Revisar Pull Request**:
   ```bash
   # Se PR foi criado automaticamente:
   gh pr view --web

   # Ou acessar diretamente:
   # https://github.com/seu-usuario/ROM-Agent/pulls
   ```

2. **Configurar APIs**:
   Ver arquivo `logs/orchestrator-*/APIS_MOCKADAS.md` para:
   - DataJud API token
   - Google Search API key
   - Outras configurações necessárias

3. **Testar Sistema**:
   ```bash
   # Fazer checkout do branch
   git checkout orchestration/auto-fix-TIMESTAMP

   # Iniciar servidor
   npm start

   # Testar extração de processo
   # (usar interface web ou API)
   ```

4. **Merge para Produção**:
   ```bash
   # Após testes, fazer merge
   git checkout main
   git merge orchestration/auto-fix-TIMESTAMP
   git push
   ```

---

## 🚨 RESOLUÇÃO DE PROBLEMAS

### Problema: "Permission denied"

**Solução**:
```bash
chmod +x scripts/*.sh
```

### Problema: "osascript: command not found"

**Causa**: Não está no macOS

**Solução**: Executar scripts individualmente em terminais separados:
```bash
# Terminal 1
./scripts/terminal-executor.sh "$(pwd)/logs/manual" "orchestration/manual"

# Terminal 2
./scripts/terminal-monitor.sh "$(pwd)/logs/manual"
```

### Problema: Erros durante execução

**Verificar logs**:
```bash
cat logs/orchestrator-*/executor.log | grep ERROR
```

**Rollback**:
```bash
# Voltar para estado anterior
git checkout main
git branch -D orchestration/auto-fix-*

# Restaurar backup
cp -r backups/pre-orchestration-*/* ./
```

### Problema: Testes falhando

**O deploy será abortado automaticamente** se os testes falharem.

**Verificar**:
```bash
npm test
```

**Corrigir manualmente** e continuar:
```bash
# Após correções
git add -A
git commit -m "fix: Correções manuais"
./scripts/commit-and-deploy.sh "$(pwd)/logs/manual" "orchestration/manual"
```

---

## 🎛️ OPÇÕES AVANÇADAS

### Executar Apenas uma Fase

Se quiser executar apenas partes específicas:

```bash
# Apenas executar (sem monitoramento)
./scripts/terminal-executor.sh "$(pwd)/logs/manual" "orchestration/test"

# Apenas monitorar logs existentes
./scripts/terminal-monitor.sh "$(pwd)/logs/orchestrator-TIMESTAMP"
```

### Pause/Resume

Se precisar pausar:
1. Pressione Ctrl+C no Terminal EXECUTOR
2. Sistema criará checkpoint
3. Para retomar, execute novamente (detectará checkpoints)

### Debug Mode

Para mais logs de debug:
```bash
# Adicionar antes de executar:
export DEBUG=true
./scripts/run-orchestrator-simple.sh
```

---

## 📞 SUPORTE

### Logs Importantes

Sempre inclua ao reportar problemas:
- `logs/orchestrator-*/executor.log`
- `logs/orchestrator-*/deploy.log`
- Output do comando: `npm test`
- Output do comando: `git status`

### Comandos Úteis

```bash
# Ver branches criados
git branch | grep orchestration

# Ver commits do branch
git log orchestration/auto-fix-*

# Ver diferenças
git diff main orchestration/auto-fix-*

# Limpar branches antigos
git branch -D $(git branch | grep orchestration)
```

---

## ✨ RESULTADO ESPERADO

Após execução bem-sucedida:

### Sistema ROM-Agent estará:

✅ **Seguro**
- Middleware de autenticação implementado
- Rate limiting ativo
- Secrets configurados

✅ **Funcional**
- 10+ scrapers Python integrados
- Bridge Node.js → Python operacional
- APIs documentadas

✅ **Testado**
- Testes passando
- Linter limpo
- Build OK

✅ **Documentado**
- Logs completos
- Relatórios gerados
- Commits descritivos

✅ **Pronto para Deploy**
- Branch criado
- PR criado (opcional)
- Merge pode ser feito

---

## 🎉 SUCESSO!

Se você chegou até aqui e tudo funcionou:

1. ✅ Sistema está corrigido
2. ✅ Código está comitado
3. ✅ Deploy foi realizado
4. ✅ Documentação está completa

**Próximos passos**:
- Fazer merge para produção
- Configurar APIs que ainda estão mockadas
- Testar extração real de processos
- Monitorar logs de produção

---

**Criado por**: Claude Opus 4.5
**Data**: 2026-01-08
**Versão**: 2.0.0 (Sistema de 2 Terminais)
**Status**: ✅ Pronto para uso

---

## 🔗 DOCUMENTOS RELACIONADOS

- `AUDITORIA_FORENSE_COMPLETA_2026-01-08.md` - Auditoria completa
- `PLANO_GLOBAL_CORRECAO_2026-01-08.md` - Plano detalhado
- `ESTRATEGIA_GIT_PARALELO.md` - Estratégia Git (não usado nesta versão)
- `RESUMO_AUDITORIA_E_PLANO.md` - Resumo geral

**BOM TRABALHO! 🚀**
