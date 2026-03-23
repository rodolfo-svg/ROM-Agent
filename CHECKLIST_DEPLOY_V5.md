# CHECKLIST DE DEPLOY IAROM V5.0

**Data de início:** ___/___/2026
**Responsável:** ____________________
**Status:** ⬜ NÃO INICIADO | ⬜ EM ANDAMENTO | ⬜ CONCLUÍDO

---

## PRÉ-REQUISITOS

### Verificações Iniciais

- [ ] Repositório ROM-Agent existe em `~/ROM-Agent`
- [ ] Repositório conectado ao GitHub (rodolfo-svg/ROM-Agent)
- [ ] Branch main está atualizada (`git pull origin main`)
- [ ] Prompts refatorados existem em `~/Desktop/IAROM_PROMPTS_REFATORADOS_CLAUDE_AI/`
- [ ] Acesso ao Render Dashboard (https://dashboard.render.com)
- [ ] Acesso ao GitHub (https://github.com/rodolfo-svg/ROM-Agent)

### Backups (IMPORTANTE!)

- [ ] Backup do repositório ROM-Agent criado
  - Comando: `cp -r ~/ROM-Agent ~/ROM-Agent-backup-$(date +%Y%m%d)`
- [ ] Backup dos prompts refatorados criado
  - Comando: `cp -r ~/Desktop/IAROM_PROMPTS_REFATORADOS_CLAUDE_AI ~/Desktop/IAROM_PROMPTS_BACKUP`

---

## EXECUÇÃO MANUAL (Opção 1)

### FASE 1: Limpeza (10 min)

- [ ] Executado: `cd ~/ROM-Agent`
- [ ] Verificado: `git status`
- [ ] Confirmadas deleções: `git add -u data/prompts/global/`
- [ ] Resultado: ___ arquivos deletados confirmados

### FASE 2: Criação de Estrutura (5 min)

- [ ] Criada: `mkdir -p data/knowledge-base/modules`
- [ ] Criada: `mkdir -p data/knowledge-base/master`
- [ ] Criada: `mkdir -p docs/iarom/relatorios`
- [ ] Verificado: `ls -la data/knowledge-base/`

### FASE 3: Cópia de Prompts Específicos (5 min)

- [ ] Executado comando de cópia (92 prompts)
- [ ] Verificado: `ls data/prompts/global/*.txt | wc -l`
- [ ] Resultado: ___ prompts no total

### FASE 4: Cópia de Módulos IAROM (5 min)

- [ ] Copiados 8 módulos para `data/knowledge-base/modules/`
- [ ] Copiados 2 master prompts para `data/knowledge-base/master/`
- [ ] Copiada Custom Instructions V5.0
- [ ] Verificado: `ls data/knowledge-base/modules/*.txt | wc -l`
- [ ] Resultado: ___ módulos

### FASE 5: Cópia de Documentação (5 min)

- [ ] Copiados docs para `docs/iarom/`
- [ ] Copiados relatórios para `docs/iarom/relatorios/`
- [ ] Copiado README_IAROM.md
- [ ] Verificado: `ls docs/iarom/*.md | wc -l`
- [ ] Resultado: ___ documentos

### FASE 6: Criar Índice (2 min)

- [ ] README.md criado em `data/prompts/global/`
- [ ] Índice lista todos os prompts

### FASE 7: Git Commit e Push (10 min)

- [ ] Executado: `git add data/ docs/`
- [ ] Verificado: `git status`
- [ ] Executado: `git commit -m "feat: Add IAROM v5.0..."`
- [ ] Verificado: `git log --oneline -1`
- [ ] Executado: `git push origin main`
- [ ] Confirmado push no GitHub

### FASE 8: Validação Deploy (30 min)

- [ ] Deploy automático iniciado no Render
- [ ] Build completado sem erros
- [ ] Start completado sem erros
- [ ] Health check passou (verde)
- [ ] Serviço está "running"

---

## EXECUÇÃO AUTOMATIZADA (Opção 2)

### Script Automático

- [ ] Script existe: `~/ROM-Agent/scripts/deploy-iarom-v5.sh`
- [ ] Script é executável: `chmod +x scripts/deploy-iarom-v5.sh`
- [ ] Executado: `bash scripts/deploy-iarom-v5.sh`
- [ ] Todas as fases completadas sem erros
- [ ] Deploy finalizado com sucesso

**Duração do script:** ___ minutos

---

## VALIDAÇÕES PÓS-DEPLOY

### Verificações Técnicas

- [ ] **API Health:**
  - URL testada: https://iarom.com.br/health
  - Status HTTP: ___ (esperado: 200)
  - Resposta: {"status": "ok"}

- [ ] **API Info:**
  - URL testada: https://iarom.com.br/api/info
  - Versão retornada: ___
  - Uptime: ___

- [ ] **Prompts Disponíveis:**
  - URL testada: https://iarom.com.br/api/prompts
  - Total de prompts: ___ (esperado: 92+)
  - Nomenclatura padronizada: v1.0 ✅ | ❌

- [ ] **Knowledge Base:**
  - URL testada: https://iarom.com.br/api/knowledge-base
  - Total de módulos: ___ (esperado: 8+)

### Teste Funcional

- [ ] **Teste 1: Criação de Peça**
  - Prompt usado: ___________________________
  - Peça criada com sucesso: ✅ | ❌
  - Sem emojis na resposta: ✅ | ❌
  - Formatação correta: ✅ | ❌
  - Tempo de resposta: ___ segundos

- [ ] **Teste 2: Uso de Módulo IAROM**
  - Módulo testado: ___________________________
  - Módulo carregado: ✅ | ❌
  - Funcionalidade OK: ✅ | ❌

- [ ] **Teste 3: Custom Instructions V5.0**
  - CI V5.0 aplicadas: ✅ | ❌
  - Resposta conforme CI: ✅ | ❌

### Verificações no Render

- [ ] **Logs:**
  - Acessados em: https://dashboard.render.com/web/srv-d4ueaf2li9vc73d3rj00/logs
  - Sem erros críticos: ✅ | ❌
  - Warnings encontrados: ___ (listar se houver)

- [ ] **Recursos:**
  - Uso de CPU: ___% (normal < 70%)
  - Uso de RAM: ___% (normal < 80%)
  - Uso de disco: ___GB de 100GB (normal < 50GB)

- [ ] **Disco Persistente:**
  - Path verificado: `/var/data/prompts/global/`
  - Total de arquivos: ___ prompts
  - Path verificado: `/var/data/knowledge-base/modules/`
  - Total de módulos: ___ módulos

### Verificações no GitHub

- [ ] **Commit:**
  - Visível em: https://github.com/rodolfo-svg/ROM-Agent/commits/main
  - Hash do commit: ___________________________
  - Mensagem correta: ✅ | ❌

- [ ] **Arquivos:**
  - `data/prompts/global/` contém 92+ arquivos
  - `data/knowledge-base/modules/` contém 8+ arquivos
  - `docs/iarom/` contém documentação

---

## PROBLEMAS ENCONTRADOS

### Durante Deploy

| Problema | Fase | Solução Aplicada | Resolvido? |
|----------|------|------------------|------------|
| | | | ⬜ Sim ⬜ Não |
| | | | ⬜ Sim ⬜ Não |
| | | | ⬜ Sim ⬜ Não |

### Pós-Deploy

| Problema | Severidade | Solução Aplicada | Resolvido? |
|----------|------------|------------------|------------|
| | ⬜ Baixa ⬜ Média ⬜ Alta | | ⬜ Sim ⬜ Não |
| | ⬜ Baixa ⬜ Média ⬜ Alta | | ⬜ Sim ⬜ Não |

---

## ROLLBACK (Se necessário)

### Decisão de Rollback

- [ ] Rollback necessário: ⬜ SIM | ⬜ NÃO
- [ ] Motivo: ________________________________________________

### Execução de Rollback

- [ ] **Git:**
  - [ ] Executado: `git revert HEAD`
  - [ ] Push forçado: `git push origin main`
  - [ ] Confirmado no GitHub

- [ ] **Render:**
  - [ ] Acessado: Dashboard > Deploys
  - [ ] Rollback para deploy anterior executado
  - [ ] Serviço rodando versão anterior

- [ ] **Validação Pós-Rollback:**
  - [ ] Sistema funcionando na versão anterior
  - [ ] Sem erros críticos

---

## PÓS-DEPLOY (Após 24-48h)

### Monitoramento

- [ ] **Dia 1 (24h após deploy):**
  - Data/hora: ___/___/___ às ___:___
  - Logs verificados: ✅ | ❌
  - Erros encontrados: ___ (listar se houver)
  - Performance OK: ✅ | ❌
  - Usuários relataram problemas: ⬜ SIM | ⬜ NÃO

- [ ] **Dia 2 (48h após deploy):**
  - Data/hora: ___/___/___ às ___:___
  - Logs verificados: ✅ | ❌
  - Sistema estável: ✅ | ❌
  - Deploy considerado sucesso: ⬜ SIM | ⬜ NÃO

### Documentação

- [ ] Changelog criado (CHANGELOG.md)
- [ ] README.md principal atualizado
- [ ] Tag de versão criada no Git:
  - [ ] `git tag -a v5.0.0 -m "IAROM V5.0"`
  - [ ] `git push origin v5.0.0`

### Backup Final

- [ ] Backup do disco persistente do Render realizado
- [ ] Exportação de dados críticos realizada
- [ ] Documentação arquivada

---

## ROADMAP V5.1

### Melhorias Planejadas

- [ ] API específica para módulos IAROM (`/api/iarom/modules`)
- [ ] Interface web para seleção de módulos
- [ ] Sistema de rollback de prompts via UI
- [ ] Testes automatizados de prompts
- [ ] CI/CD para validação de prompts
- [ ] Versionamento semântico de prompts (v1.0, v1.1, etc)

---

## ASSINATURAS

### Responsável pelo Deploy

**Nome:** ____________________________
**Data:** ___/___/2026
**Hora:** ___:___
**Assinatura:** ____________________________

### Validador (Se aplicável)

**Nome:** ____________________________
**Data:** ___/___/2026
**Hora:** ___:___
**Assinatura:** ____________________________

---

## MÉTRICAS FINAIS

### Arquivos Migrados

- Prompts específicos: ___ arquivos
- Módulos IAROM: ___ arquivos
- Master prompts: ___ arquivos
- Documentos: ___ arquivos
- Relatórios: ___ arquivos
- **TOTAL:** ___ arquivos | ___KB

### Tempo de Execução

- Preparação: ___ minutos
- Cópia de arquivos: ___ minutos
- Git commit/push: ___ minutos
- Deploy no Render: ___ minutos
- Validações: ___ minutos
- **TOTAL:** ___ minutos

### Resultado Final

- [ ] ✅ **SUCESSO COMPLETO** - Deploy finalizado sem problemas
- [ ] ⚠️ **SUCESSO PARCIAL** - Deploy OK mas com warnings
- [ ] ❌ **FALHA** - Rollback necessário

**Observações finais:**
_______________________________________________________________
_______________________________________________________________
_______________________________________________________________

---

**Checklist criado em:** 23/03/2026
**Versão:** 1.0
**Baseado em:** PLANO_DEPLOY_IAROM_V5.md
