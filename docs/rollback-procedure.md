# Procedimento de Rollback

## Quando fazer rollback

Execute um rollback imediatamente nas seguintes situações:

- **Erro 401/403 persistente após deploy** - Indica problema de autenticação/autorização que impede uso do sistema
- **Upload quebrado por >30min** - Funcionalidade crítica indisponível afetando usuários
- **CSP bloqueando requests** - Content Security Policy impedindo requests necessários
- **Qualquer erro que afete produção** - Bugs críticos, crashes, perda de dados, ou degradação severa de performance

## Como fazer rollback rápido

### Opção 1: Reverter commit específico (recomendado)

```bash
# 1. Identificar último commit bom
git log --oneline -20

# 2. Fazer rollback do commit problemático
git revert <commit-ruim> --no-edit
git push origin staging

# 3. Verificar deploy automático
# O sistema deve fazer deploy automaticamente após o push
```

### Opção 2: Resetar para commit específico (use com cautela)

```bash
# 1. Identificar commit bom para voltar
git log --online -20

# 2. Resetar para o commit bom
git reset --hard <commit-bom>

# 3. Force push (ATENÇÃO: sobrescreve histórico)
git push origin staging --force

# 4. Verificar deploy automático
```

**IMPORTANTE:** A Opção 2 reescreve o histórico do Git. Use apenas quando:
- A Opção 1 não for viável
- Você tiver certeza de que ninguém mais está trabalhando na branch
- Os commits sendo removidos não foram mergeados para outras branches

## Commits de referência

Mantenha esta lista atualizada com commits importantes:

- **Último conhecido funcional:** `ca537f3` (antes de JWT)
- **Primeiro com JWT:** `99b1b88`
- **Com CSP fix:** `ee6e865`

### Como atualizar commits de referência

```bash
# Após confirmar que um deploy está estável, adicione-o aqui
git log --oneline -1

# Adicione à lista acima com descrição clara do estado
```

## Validação pós-rollback

Execute esta checklist após cada rollback:

### 1. Deploy completou
```bash
# Verificar status do deploy
# Se usando GitHub Actions, verificar em:
# https://github.com/<seu-usuario>/ROM-Agent/actions

# Se usando outro CI/CD, verificar logs apropriados
```

### 2. Bundle correto no servidor
```bash
# Verificar se os arquivos foram atualizados
# Checar timestamp dos arquivos
# Confirmar versão do código
```

### 3. Upload de arquivo pequeno funciona
- [ ] Fazer login no sistema
- [ ] Selecionar arquivo < 1MB
- [ ] Confirmar upload completo
- [ ] Verificar arquivo disponível/processado

### 4. Upload de arquivo grande funciona
- [ ] Fazer login no sistema
- [ ] Selecionar arquivo > 10MB
- [ ] Confirmar upload completo sem timeout
- [ ] Verificar processamento correto

### 5. Verificações adicionais
- [ ] Autenticação funcionando (login/logout)
- [ ] Nenhum erro 401/403 nos logs
- [ ] Nenhum erro de CSP no console do browser
- [ ] Performance aceitável (página carrega em < 3s)

## Comunicação

Após executar rollback:

1. **Notifique a equipe** sobre o rollback e motivo
2. **Documente o problema** que causou necessidade de rollback
3. **Crie issue** para investigar e corrigir o problema
4. **Atualize esta documentação** se necessário

## Troubleshooting

### Rollback não resolve o problema

Se após rollback o problema persistir:

1. Volte para commit ainda mais antigo
2. Verifique se o problema é de infraestrutura, não código
3. Revise configurações do servidor/ambiente
4. Verifique logs do servidor para erros não relacionados ao código

### Conflitos durante revert

```bash
# Se git revert causar conflitos
git status  # Ver arquivos em conflito
# Resolver conflitos manualmente
git add <arquivos-resolvidos>
git revert --continue
```

### Deploy automático não ativou

```bash
# Verificar se webhook está configurado
# Triggerar deploy manual se necessário
# Verificar logs do CI/CD para erros
```

## Prevenção

Para minimizar necessidade de rollbacks:

- **Teste localmente** antes de fazer push
- **Use staging** antes de produção
- **Monitore logs** após deploy
- **Faça deploys incrementais** (pequenas mudanças por vez)
- **Mantenha testes automatizados** atualizados
- **Documente mudanças** significativas

## Referências

- [Git Revert Documentation](https://git-scm.com/docs/git-revert)
- [Git Reset Documentation](https://git-scm.com/docs/git-reset)
- Deploy logs: Verificar no CI/CD configurado
- Monitoring: Verificar ferramentas de monitoramento configuradas
