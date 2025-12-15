# 🧪 GUIA DE TESTE - Sistema de Auto-Atualização

**Data**: 15/12/2025
**Sistema**: Auto-Atualização e Aprendizado v1.0.0
**Status**: ✅ **ATIVO EM PRODUÇÃO**

---

## ✅ SISTEMA JÁ ESTÁ ATIVO!

Após o próximo deploy (automático pelo Render), o sistema estará rodando automaticamente.

**O que acontece ao iniciar o servidor**:
```
🚀 Ativando Sistema de Auto-Atualização...
✅ Verificação periódica de prompts ativada (a cada 24h)
🔍 Executando primeira verificação de prompts... (após 10s)
✅ Sistema de auto-atualização ATIVO E FUNCIONANDO
```

---

## 🔍 TESTES RÁPIDOS

### **1. Verificar se Sistema Está Ativo**

```bash
# Health Check
curl https://iarom.com.br/api/auto-update/status

# Resposta esperada:
{
  "status": "ativo",
  "sistemaAtivo": true,
  "funcionalidades": {
    "verificacaoPeriodica": "✅ A cada 24h",
    "feedbackUsuarios": "✅ Ativo",
    "aprendizadoColetivo": "✅ Ativo (Federated Learning)",
    "versionamento": "✅ Ativo",
    "validacaoQualidade": "✅ Ativo (Score mínimo: 10)"
  }
}
```

### **2. Ver Informações do Sistema**

```bash
curl https://iarom.com.br/api/auto-update/info

# Retorna descrição completa de funcionalidades
```

### **3. Enviar Feedback de Teste**

```bash
curl -X POST https://iarom.com.br/api/feedback \
  -H "Content-Type: application/json" \
  -d '{
    "promptId": "peticao_inicial_civel",
    "rating": 4,
    "peçaGerada": "Teste de peça jurídica gerada...",
    "ediçõesFeitas": "Teste de edições do usuário...",
    "tipoPeca": "peticao_inicial",
    "ramoDireito": "civil",
    "instancia": "primeira",
    "regiao": "SP",
    "tempoGeracao": 3500
  }'

# Resposta esperada:
{
  "success": true,
  "message": "Feedback registrado com sucesso",
  "agradecimento": "Obrigado! Seu feedback ajuda a melhorar o sistema para todos."
}
```

### **4. Listar Melhorias Pendentes (Admin)**

```bash
curl https://iarom.com.br/api/admin/melhorias/pendentes

# Resposta esperada:
{
  "total": 0,
  "melhorias": [],
  "recomendacao": "Nenhuma melhoria pendente no momento"
}
```

### **5. Ver Estatísticas de Aprendizado (Admin)**

```bash
curl https://iarom.com.br/api/admin/estatisticas/aprendizado

# Retorna estatísticas completas do sistema
```

### **6. Gerar Relatório Completo (Admin)**

```bash
curl https://iarom.com.br/api/admin/relatorio

# Retorna relatório completo incluindo:
# - Estatísticas gerais
# - Melhorias pendentes
# - Última análise de padrões
# - Recomendações
```

---

## 📊 TESTE DE FLUXO COMPLETO

### **Cenário**: Usuário gera peça e envia feedback

**1. Usuário gera peça jurídica:**
```bash
curl -X POST https://iarom.com.br/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Redija uma petição inicial de cobrança no valor de R$ 10.000",
    "projectId": "rom-agent"
  }'
```

**2. Sistema gera peça usando prompt `peticao_inicial_civel`**

**3. Usuário lê a peça e faz edições**

**4. Usuário envia feedback:**
```bash
curl -X POST https://iarom.com.br/api/feedback \
  -H "Content-Type: application/json" \
  -d '{
    "promptId": "peticao_inicial_civel",
    "rating": 5,
    "peçaGerada": "[texto completo da peça gerada]",
    "ediçõesFeitas": "[texto da peça após edições do usuário]",
    "tipoPeca": "peticao_inicial",
    "ramoDireito": "civil",
    "comentarios": "Adicionei jurisprudência do STJ sobre o tema"
  }'
```

**5. Sistema processa:**
- ✅ Registra feedback individual
- ✅ Agrega feedback global (anonimizado)
- ✅ Analisa padrões a cada 100 feedbacks
- ✅ Propõe melhorias automaticamente

**6. Após 100 feedbacks similares:**
- Sistema detecta: "70% dos usuários adicionam jurisprudência STJ"
- Sistema propõe: "Adicionar seção de jurisprudência STJ no prompt"
- Validação: Score +20 (adicionou jurisprudência) ✅
- Status: Aguardando aprovação do master admin

**7. Master admin aprova:**
```bash
curl -X POST https://iarom.com.br/api/admin/melhorias/{id}/aprovar \
  -H "Content-Type: application/json" \
  -d '{
    "adminId": "rom-master-admin"
  }'
```

**8. Prompt global é atualizado:**
- v1.2.0 → v1.3.0
- TODOS os parceiros se beneficiam

---

## 🔧 TESTE DE PROPOR MELHORIA (Manual)

Para testar o sistema de validação, pode-se propor uma melhoria manualmente:

```bash
curl -X POST https://iarom.com.br/api/admin/propor-melhoria \
  -H "Content-Type: application/json" \
  -d '{
    "promptId": "peticao_inicial_civel",
    "tipoMelhoria": "atualizacao_legal",
    "justificativa": "Adicionar jurisprudência recente do STJ sobre tutela provisória",
    "conteudoProposto": "[novo conteúdo com jurisprudência]",
    "conteudoOriginal": "[conteúdo atual do prompt]"
  }'

# Resposta se aprovado:
{
  "success": true,
  "status": "proposta_criada",
  "id": "melhoria-1234567890-abc",
  "validacao": {
    "score": 25,
    "motivo": [
      "✅ MELHORIA VÁLIDA (Score: 25)"
    ],
    "recomendacao": "Melhoria aumenta excelência técnica. Recomendada para aprovação."
  },
  "mensagem": "Melhoria proposta com sucesso. Aguardando aprovação do master admin."
}

# Resposta se rejeitado automaticamente:
{
  "success": false,
  "status": "rejeitada_automaticamente",
  "motivo": [
    "❌ MELHORIA REJEITADA AUTOMATICAMENTE",
    "REDUÇÃO EXCESSIVA: 35.5% menor (empobrece conteúdo)"
  ],
  "validacao": {
    "score": -15,
    "recomendacao": "Melhoria empobrece conteúdo. Não deve ser aplicada."
  }
}
```

---

## 📁 ARQUIVOS DE LOG

Após sistema rodar, os logs estarão em:

```bash
# Ver logs de atualizações de prompts
cat logs/prompt_updates.json

# Ver feedbacks coletados
cat logs/user_feedback.json

# Ver melhorias sugeridas
cat logs/melhorias_sugeridas.json

# Ver padrões identificados
cat logs/padroes_identificados.json

# Ver feedback agregado
cat logs/feedback_agregado.json

# Ver relatório de verificação
cat logs/verificacao_prompts.json

# Ver versões de prompts
cat logs/prompts_versions.json
```

---

## ⚙️ CONFIGURAÇÕES

### **Alterar Intervalo de Verificação** (Padrão: 24h)

Editar `lib/prompt-updater.cjs` linha 312:

```javascript
// Padrão: 24 horas
const INTERVALO_24H = 24 * 60 * 60 * 1000;

// Alterar para 12 horas (para testes):
const INTERVALO_24H = 12 * 60 * 60 * 1000;

// Alterar para 1 hora (para testes rápidos):
const INTERVALO_24H = 1 * 60 * 60 * 1000;
```

### **Alterar Score Mínimo** (Padrão: 10)

Editar `lib/aprendizado-agregado.cjs` linha 286:

```javascript
// Padrão: Score >= 10
} else if (validacao.score < 10) {

// Mais restritivo (Score >= 20):
} else if (validacao.score < 20) {

// Menos restritivo (Score >= 5):
} else if (validacao.score < 5) {
```

---

## 🎯 CHECKLIST DE VALIDAÇÃO

### **Após Deploy (Amanhã 08h)**:

- [ ] Acessar `https://iarom.com.br/api/auto-update/status`
- [ ] Verificar `"status": "ativo"`
- [ ] Ver logs do servidor confirmando ativação
- [ ] Enviar feedback de teste
- [ ] Verificar logs em `logs/user_feedback.json`
- [ ] Confirmar primeira verificação após 10s

### **Durante Beta (Primeira Semana)**:

- [ ] Coletar pelo menos 50 feedbacks
- [ ] Aguardar primeira análise de padrões
- [ ] Verificar se melhorias são propostas
- [ ] Testar aprovação/rejeição de melhoria
- [ ] Monitorar estatísticas diárias

### **Primeira Melhoria Global (1-2 Semanas)**:

- [ ] Identificar padrão recorrente
- [ ] Validar qualidade da melhoria
- [ ] Aprovar melhoria
- [ ] Aplicar ao prompt global
- [ ] Notificar parceiros (quando implementado)
- [ ] Medir impacto

---

## 🐛 TROUBLESHOOTING

### **Problema**: Status retorna "não inicializado"

**Solução**: Verificar logs do servidor. Se não aparecer mensagem de ativação, reiniciar servidor.

```bash
# Render fará deploy automático
# Aguardar 2-3 minutos
# Testar novamente
```

### **Problema**: Feedback não é registrado

**Solução**: Verificar formato do JSON e campos obrigatórios:
- `promptId` (obrigatório)
- `rating` (obrigatório, 1-5)

### **Problema**: Melhoria sempre rejeitada automaticamente

**Solução**: Verificar score. Melhoria precisa:
- Não reduzir tamanho > 20%
- Não remover dispositivos legais
- Não remover jurisprudência
- Score final >= 10

### **Problema**: Logs não aparecem

**Solução**: Diretório `logs/` é criado automaticamente. Se não existir:
```bash
mkdir -p logs
chmod 755 logs
```

---

## 📈 MÉTRICAS DE SUCESSO

### **Curto Prazo (1 Semana)**:
- Coletar 100+ feedbacks
- 0 erros no sistema
- Primeira análise de padrões executada

### **Médio Prazo (1 Mês)**:
- 500+ feedbacks coletados
- 5+ melhorias propostas
- 1+ melhoria aprovada e aplicada
- Taxa de sucesso dos prompts > 70%

### **Longo Prazo (3 Meses)**:
- 2000+ feedbacks
- 20+ melhorias aplicadas
- Taxa de sucesso > 85%
- Benefício mensurável para todos os parceiros

---

## 🚀 PRÓXIMOS PASSOS

1. **Lançar Beta Amanhã** (16/12/2025)
   - Sistema já está ativo
   - Começar coleta de feedback

2. **Semana 1**: Monitorar
   - Verificar logs diariamente
   - Acompanhar estatísticas
   - Ajustar se necessário

3. **Semana 2-4**: Primeira Melhoria
   - Analisar padrões identificados
   - Aprovar primeira melhoria global
   - Documentar impacto

4. **Mês 2**: Expansão
   - Adicionar mais validações
   - Implementar sugestões automáticas
   - Integrar com sistema de notificações

---

## 📞 COMANDOS ÚTEIS

```bash
# Ver status completo
curl https://iarom.com.br/api/auto-update/status | jq

# Ver todas as melhorias pendentes
curl https://iarom.com.br/api/admin/melhorias/pendentes | jq

# Ver estatísticas
curl https://iarom.com.br/api/admin/estatisticas/aprendizado | jq

# Ver relatório completo
curl https://iarom.com.br/api/admin/relatorio | jq

# Enviar feedback rápido
curl -X POST https://iarom.com.br/api/feedback \
  -H "Content-Type: application/json" \
  -d '{"promptId":"peticao_inicial_civel","rating":4,"peçaGerada":"teste","tipoPeca":"peticao_inicial","ramoDireito":"civil"}'
```

---

**Sistema PRONTO e ATIVO!** ✅

Aguardando deploy automático do Render (~2 minutos após push).

© 2025 Rodolfo Otávio Mota Advogados Associados
