# Checklist de Validação de Deploy

Este checklist é **obrigatório** para todos os deploys futuros.

---

## PRÉ-DEPLOY

- [ ] **Código testado localmente**
  ```bash
  npm run dev
  # Testar funcionalidades principais manualmente
  ```

- [ ] **CSP validado (se cross-origin)**
  ```bash
  # Verificar configuração CSP no código
  grep -r "Content-Security-Policy" .
  # Verificar se recursos externos estão permitidos
  ```

- [ ] **Serviço correto identificado**
  ```bash
  render services list
  # Confirmar o service ID do backend
  ```

- [ ] **Branch correta**
  ```bash
  git branch
  # Confirmar que está na branch main/master ou branch de deploy
  ```

- [ ] **Tests passando**
  ```bash
  npm test
  # Todos os testes devem passar
  ```

- [ ] **Dependências atualizadas**
  ```bash
  npm install
  # Verificar se não há vulnerabilidades críticas
  npm audit
  ```

- [ ] **Variáveis de ambiente configuradas**
  ```bash
  # Verificar .env e configurações no Render
  render services env list -s <service-id>
  ```

---

## DURANTE DEPLOY

- [ ] **Monitorar logs em tempo real**
  ```bash
  render services logs -s <service-id> --tail
  ```

- [ ] **Build completou sem erros**
  ```bash
  # Verificar output do build no dashboard do Render
  # Ou via CLI:
  render deploys list -s <service-id>
  ```

- [ ] **Health check passou**
  ```bash
  # Aguardar confirmação no dashboard do Render
  # Status deve mudar para "Live"
  ```

- [ ] **Nenhum erro crítico nos logs**
  ```bash
  render services logs -s <service-id> | grep -i error
  ```

---

## PÓS-DEPLOY

- [ ] **Bundle atualizado no servidor**
  ```bash
  # Verificar timestamp do último deploy
  render deploys list -s <service-id>
  ```

- [ ] **CSP headers corretos**
  ```bash
  curl -I https://seu-servico.onrender.com
  # Verificar se Content-Security-Policy está presente e correto
  ```

- [ ] **Endpoints respondendo**
  ```bash
  # Health check endpoint
  curl https://seu-servico.onrender.com/health

  # Endpoint principal
  curl https://seu-servico.onrender.com/api/extract
  ```

- [ ] **Teste manual com arquivo pequeno**
  ```bash
  # Upload de PDF pequeno (<1MB)
  # Verificar resposta e logs
  ```

- [ ] **Teste manual com arquivo grande**
  ```bash
  # Upload de PDF grande (>5MB)
  # Verificar timeout, memória e resposta
  ```

- [ ] **Logs sem erros**
  ```bash
  render services logs -s <service-id> --tail
  # Verificar últimos 50-100 logs
  ```

- [ ] **Métricas de performance**
  ```bash
  # Verificar no dashboard do Render:
  # - Uso de memória
  # - CPU
  # - Tempo de resposta
  ```

- [ ] **Teste de integração frontend-backend**
  ```bash
  # Testar fluxo completo da aplicação
  # Frontend -> Backend -> Resposta
  ```

---

## ROLLBACK (se falhar)

- [ ] **Identificar último commit bom**
  ```bash
  git log --oneline -10
  # Identificar hash do último commit funcional
  ```

- [ ] **Fazer revert**
  ```bash
  # Opção 1: Revert do commit problemático
  git revert <commit-hash>
  git push origin main

  # Opção 2: Reset hard (cuidado!)
  git reset --hard <commit-hash-bom>
  git push origin main --force

  # Opção 3: Via Render (redeploy de versão anterior)
  render deploys list -s <service-id>
  # Identificar deploy anterior e redeploy via dashboard
  ```

- [ ] **Validar que rollback funcionou**
  ```bash
  # Repetir checklist PÓS-DEPLOY
  curl -I https://seu-servico.onrender.com
  render services logs -s <service-id> --tail
  ```

- [ ] **Documentar problema**
  ```bash
  # Criar issue no GitHub com:
  # - Descrição do erro
  # - Logs relevantes
  # - Commits problemáticos
  # - Solução aplicada
  ```

- [ ] **Notificar equipe**
  ```bash
  # Comunicar sobre o rollback e status do serviço
  ```

---

## NOTAS IMPORTANTES

### Service IDs Conhecidos
```bash
# Backend PDF Extraction
# Atualizar com o service ID real após primeiro deploy
SERVICE_ID_BACKEND="srv-xxxxx"
```

### Comandos Úteis
```bash
# Login no Render
render login

# Listar todos os serviços
render services list

# Ver logs específicos
render services logs -s <service-id> --tail --num 100

# Ver status do serviço
render services get <service-id>

# Forçar novo deploy
render deploys create -s <service-id>
```

### Links Úteis
- Dashboard Render: https://dashboard.render.com
- Documentação Render: https://render.com/docs
- Status Render: https://status.render.com

---

**Data de criação**: 2026-04-02
**Última atualização**: 2026-04-02
