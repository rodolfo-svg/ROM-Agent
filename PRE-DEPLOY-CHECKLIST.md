# ✅ CHECKLIST PRÉ-DEPLOY

> **OBRIGATÓRIO:** Execute este checklist ANTES de cada deploy

**Data:** ___/___/______
**Deploy para:** [ ] Staging [ ] Production
**Responsável:** _________________

---

## 📋 VALIDAÇÕES OBRIGATÓRIAS

### 1. Código e Build

- [ ] Consultei `LESSONS-LEARNED.md` antes de começar
- [ ] Executei `rm -rf frontend/dist` antes do build
- [ ] Build completou sem erros: `npm run build`
- [ ] Não há arquivos antigos em `frontend/dist/`
- [ ] Commit message é descritivo e inclui:
  ```
  Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
  ```

### 2. Testes Automatizados

- [ ] Executei: `./scripts/autonomous-test-fix-loop.sh`
- [ ] Resultado: `✅ SUCESSO TOTAL!`
- [ ] Executei: `./scripts/test-kb-end-to-end.sh`
- [ ] Nenhum erro crítico detectado

### 3. Segurança

- [ ] CSP inclui backend URL (`rom-agent-ia.onrender.com`)
- [ ] Validei headers: `curl -I https://rom-agent-ia.onrender.com/ | grep content-security-policy`
- [ ] Nenhum secret gerado dinamicamente no código
- [ ] Variáveis de ambiente corretas no Render:
  - [ ] `UPLOAD_TOKEN_SECRET`
  - [ ] `SESSION_SECRET`
  - [ ] Outras necessárias

### 4. Autenticação

- [ ] API routes retornam 401 JSON (não 302)
- [ ] Frontend detecta sessão expirada
- [ ] Tested logout/login flow
- [ ] Session timeout apropriado para operações longas

### 5. Upload e KB

- [ ] `kb-cache.js` suporta formatos: `[]` e `{documents:[]}`
- [ ] Logs não mostram "undefined documentos"
- [ ] Chunked upload testado localmente
- [ ] JWT authentication funcionando

### 6. Testes Manuais CRÍTICOS

- [ ] **Upload Pequeno (< 1MB)**
  - Upload: ___________
  - Extração: ___________
  - Aparece no KB: ___________

- [ ] **Upload Grande (> 100MB)**
  - Upload: ___________
  - Chunks mesclados: ___________
  - Extração: ___________

- [ ] **Persistência**
  - Fiz upload: ___________
  - Fiz logout: ___________
  - Fiz login: ___________
  - Documentos AINDA visíveis: ___________

- [ ] **Chat com KB**
  - Chat aberto: ___________
  - Pergunta relacionada a docs: ___________
  - Chat usou KB: ___________
  - Resposta correta: ___________

### 7. Deploy

- [ ] Push para branch correto
- [ ] Aguardei deploy completo (status: Live)
- [ ] Aguardei 2-3 minutos para todos workers atualizarem
- [ ] Verifiquei commit hash no Render:
  ```bash
  render deploys list srv-d51ppfmuk2gs73a1qlkg | head -2
  ```
- [ ] Hash corresponde ao commit local: __________

### 8. Validação Pós-Deploy

- [ ] Endpoint principal: `curl https://rom-agent-ia.onrender.com/`
  - Status: _____ (esperado: 200)

- [ ] Logs sem erros:
  ```bash
  render logs -r srv-d51ppfmuk2gs73a1qlkg --tail -n 50
  ```
  - [ ] Sem "undefined documentos"
  - [ ] Sem "Failed to fetch"
  - [ ] Sem "error 502"

- [ ] KB Cache:
  ```bash
  render logs -r srv-d51ppfmuk2gs73a1qlkg --text "KB Cache" | grep "$(date +%Y-%m-%d)"
  ```
  - Mostra: "___ documentos carregados" (não "undefined")

- [ ] CSP correto:
  ```bash
  curl -I https://rom-agent-ia.onrender.com/ | grep -i content-security-policy
  ```
  - Inclui: `rom-agent-ia.onrender.com`

### 9. Regressão Testing

- [ ] **Funcionalidades que DEVEM continuar funcionando:**
  - [ ] Login/Logout
  - [ ] Upload de arquivos
  - [ ] Extração de PDF
  - [ ] Chat básico (sem KB)
  - [ ] Chat com KB
  - [ ] Dashboard "Upload & KB"
  - [ ] Listagem de documentos

### 10. Monitoramento

- [ ] Monitor contínuo iniciado:
  ```bash
  ./scripts/continuous-monitor.sh &
  echo $! > /tmp/rom-monitor.pid
  ```
- [ ] PID salvo: ______

- [ ] Alertas verificados após 5 minutos:
  ```bash
  cat /tmp/rom-agent-alerts.log
  ```
  - [ ] Sem alertas críticos

---

## 🚨 SE ALGO FALHAR

### Rollback Imediato se:

- ❌ Upload de arquivos falha
- ❌ KB mostra "undefined documentos"
- ❌ Chat não responde
- ❌ Login não funciona
- ❌ CSP blocking requests

### Passos de Rollback:

1. Identificar último deploy funcionando:
   ```bash
   render deploys list srv-d51ppfmuk2gs73a1qlkg
   ```

2. Fazer revert do commit:
   ```bash
   git revert HEAD
   git push origin staging
   ```

3. Aguardar novo deploy

4. Validar que sistema voltou ao normal

5. **DOCUMENTAR O ERRO EM `LESSONS-LEARNED.md`**

---

## 📝 ASSINATURAS

**Checklist completado por:** _______________________

**Data/Hora:** ___/___/______ às ____:____

**Deploy aprovado por:** _______________________

**Observações:**
```
[Espaço para notas adicionais]
```

---

## 🔗 RECURSOS

- **Logs:** `render logs -r srv-d51ppfmuk2gs73a1qlkg --tail`
- **Deploys:** `render deploys list srv-d51ppfmuk2gs73a1qlkg`
- **Testes:** `./scripts/autonomous-test-fix-loop.sh`
- **Monitor:** `./scripts/continuous-monitor.sh`
- **Documentação:** `LESSONS-LEARNED.md`

---

**LEMBRE-SE:**
- ⏰ Checklist leva ~15 minutos
- 🐛 Evita horas de debug
- 💾 Salve uma cópia deste checklist preenchido para cada deploy

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
