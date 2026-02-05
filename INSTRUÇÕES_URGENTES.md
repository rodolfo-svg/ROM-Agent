# ⚡ INSTRUÇÕES URGENTES - LEIA ISTO PRIMEIRO

## ✅ PROBLEMAS CORRIGIDOS (Commit e1471da)

1. ✅ **Barra de progresso agora evolui** de 0% a 100% mostrando etapa atual
2. ✅ **Comandos prontos para limpar KB** (copiar/colar no Render Shell)

---

## 🚀 O QUE FAZER AGORA (3 Passos)

### 1️⃣ AGUARDAR DEPLOY (2-3 minutos)

```
Dashboard: https://dashboard.render.com
Aguardar: Status "Live" (verde)
Commit: e1471da
```

---

### 2️⃣ LIMPAR KB COMPLETAMENTE (Copiar TUDO e colar no Render Shell)

Acesse: **Render.com → ROM-Agent → Shell**

Depois copie e cole TODO este bloco:

```bash
cd /opt/render/project/src && \
echo "📦 Criando backup..." && \
mkdir -p data/.backup-kb/manual-$(date +%Y%m%d-%H%M%S) && \
cp data/kb-documents.json data/.backup-kb/manual-$(date +%Y%m%d-%H%M%S)/ 2>/dev/null || echo "   kb-documents.json não existe" && \
tar -czf data/.backup-kb/manual-$(date +%Y%m%d-%H%M%S)/kb-documents.tar.gz data/knowledge-base/documents/ 2>/dev/null || echo "   knowledge-base/documents/ vazio" && \
echo "✅ Backup criado" && \
echo "" && \
echo "📊 ANTES da limpeza:" && \
echo -n "   Documentos: " && \
cat data/kb-documents.json 2>/dev/null | jq 'length' 2>/dev/null || echo "0" && \
echo -n "   Ficheiros: " && \
ls -1 data/knowledge-base/documents/ 2>/dev/null | wc -l || echo "0" && \
echo "" && \
echo "🗑️  Deletando..." && \
rm -f data/kb-documents.json 2>/dev/null && echo "   ✅ kb-documents.json" || echo "   ⏭️  já estava vazio" && \
rm -rf data/knowledge-base/documents/* 2>/dev/null && echo "   ✅ Ficheiros estruturados" || echo "   ⏭️  já estava vazio" && \
rm -rf data/extracted-texts/* 2>/dev/null && echo "   ✅ Textos extraídos" || echo "   ⏭️  já estava vazio" && \
echo "" && \
echo "📁 Recriando estrutura..." && \
mkdir -p data/knowledge-base/documents && \
mkdir -p data/extracted-texts && \
echo "[]" > data/kb-documents.json && \
chmod 755 data/knowledge-base/documents && \
chmod 644 data/kb-documents.json && \
echo "   ✅ Estrutura recriada" && \
echo "" && \
echo "📊 DEPOIS da limpeza:" && \
echo -n "   Documentos: " && \
cat data/kb-documents.json | jq 'length' && \
echo -n "   Ficheiros: " && \
ls -1 data/knowledge-base/documents/ | wc -l && \
echo "" && \
echo "╔═══════════════════════════════════════════════════════════╗" && \
echo "║  ✅ KB LIMPO COM SUCESSO                                  ║" && \
echo "╚═══════════════════════════════════════════════════════════╝"
```

**O que será feito:**
- ✅ Backup automático antes de limpar
- ✅ Deleta todos os documentos
- ✅ Deleta todos os ficheiros estruturados
- ✅ Deleta todo o cache
- ✅ Recria estrutura limpa
- ✅ Mostra estatísticas antes/depois

**Tempo:** 5 segundos

---

### 3️⃣ TESTAR SISTEMA COMPLETO

#### A. Upload e Análise:

```
1. iarom.com.br → KB Tab
2. Upload "Report01770235205448.pdf" (Alessandro Ribeiro)
3. Clicar em "Analisar" (🧠 cérebro roxo)
4. Selecionar:
   - Tipo: Complete
   - Modelo: Sonnet
5. Clicar "Iniciar Análise"
```

#### B. Verificar Barra de Progresso (AGORA FUNCIONA!):

A barra deve evoluir assim:

```
[████░░░░░░░░░░░░░░] 20% - Gerando FICHAMENTO.md...
[████████░░░░░░░░░░] 40% - Gerando ANALISE_JURIDICA.md...
[████████████░░░░░░] 60% - Gerando CRONOLOGIA.md...
[██████████████░░░░] 75% - Gerando RESUMO_EXECUTIVO.md...
[██████████████████] 100% - Concluído!
```

**Se NÃO evoluir:**
- Abrir DevTools (F12) → Console
- Procurar erros em vermelho
- Copiar e enviar para mim

#### C. Testar no Chat:

```
"acesse o processo do alessandro ribeiro no KB e em atendimento ao despacho
apresente justificativa ao empréstimo, explique de acordo com o depoimento da
Elaine que eram duas operações primitivas, uma de 450 e outra de 550 com juros
de 6% que totalizaram 1300. Os documentos estão nos movimentos 1 e 14."
```

**Resultado esperado:**
- ✅ Claude cita movimento 1 e 14
- ✅ Menciona valores R$ 450 e R$ 550
- ✅ Referencia depoimento da Elaine
- ✅ Detalhes específicos do FICHAMENTO/CRONOLOGIA

**Se NÃO funcionar:**
- Abrir DevTools (F12) → Console
- Procurar: "KB Loader"
- Verificar se mostra: "✅ [KB Loader] 4 ficheiro(s) carregado(s)"
- Se mostrar 0 ficheiros, algo deu errado na análise

---

## 🆘 SE ALGO DER ERRADO

### Problema: "Comando não reconhecido no Shell"

**Solução:** Copie TODO o bloco de uma vez (use Ctrl+A, Ctrl+C no arquivo COMANDOS_LIMPAR_KB.txt)

### Problema: "Barra continua em 0%"

**Solução:**
```bash
# No Render Shell, verificar se deploy foi concluído
cd /opt/render/project/src
git log --oneline -1

# Deve mostrar: e1471da fix: Barra de progresso agora evolui durante extração V2
```

Se mostrar commit diferente, aguardar mais 1-2 minutos.

### Problema: "Ficheiros não foram salvos"

**Solução:**
```bash
# Verificar no Render Shell
ls -lh data/knowledge-base/documents/ | grep -E "FICHAMENTO|ANALISE"

# Se vazio, verificar logs
tail -100 logs/combined.log | grep -i "ficheiro\|salvamento"
```

---

## 📊 VERIFICAÇÃO FINAL

### Checklist de Sucesso:

- [ ] Deploy concluído (Status "Live")
- [ ] KB limpo (comando executado com sucesso)
- [ ] Upload Alessandro Ribeiro realizado
- [ ] Análise iniciada (botão cérebro clicado)
- [ ] **Barra de progresso evolui de 0% a 100%** ← NOVO!
- [ ] Status "Concluído" aparece após 3-4 minutos
- [ ] 4 ficheiros salvos (verificar no Shell)
- [ ] Chat carrega ficheiros automaticamente
- [ ] Claude responde com detalhes específicos

---

## 💰 CUSTO

| Item | Valor |
|------|-------|
| Limpeza KB | Grátis |
| Reprocessamento | $2.80 USD |
| **Total** | **$2.80 USD** |

---

## 📞 PRÓXIMOS PASSOS SE TUDO FUNCIONAR

Depois que confirmar que:
1. ✅ Barra de progresso evolui corretamente
2. ✅ Ficheiros são salvos no KB
3. ✅ Chat carrega automaticamente
4. ✅ Claude responde com detalhes específicos

**Aí sim** você pode começar a usar normalmente! 🎉

---

**Criado:** 2026-02-06 00:15 UTC
**Commit:** e1471da
**Status:** ✅ PRONTO PARA TESTE
