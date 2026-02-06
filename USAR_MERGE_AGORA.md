# ⚡ COMO MESCLAR VOLUMES E PETICIONAR HOJE

## 🎯 SEU CASO: Processo Extenso com Múltiplos Volumes

Você tem 3 opções AGORA (sem esperar frontend):

---

## ✅ OPÇÃO 1: ilovepdf.com (MAIS RÁPIDO - 2 minutos)

### Passo a Passo:

```
1. Ir em: https://www.ilovepdf.com/pt/unir_pdf

2. Arrastar os 3 (ou mais) volumes:
   - Alessandro_Vol1.pdf
   - Alessandro_Vol2.pdf
   - Alessandro_Vol3.pdf

3. Verificar ordem (Vol1 → Vol2 → Vol3)

4. Clicar "Unir PDF"

5. Download: Alessandro_Completo.pdf

6. iarom.com.br → KB Tab → Upload do PDF mesclado

7. Clicar "Analisar" → Complete → Sonnet

8. Aguardar 3-4 minutos

9. Ir para Chat e começar a peticionar!
```

**Tempo total:** 5-7 minutos
**Custo:** $2.80 (não $8.40)

---

## ✅ OPÇÃO 2: PDFtk no Mac (Terminal - 1 minuto)

### Se você tem os PDFs no Mac:

```bash
# 1. Instalar PDFtk (só precisa 1 vez)
brew install pdftk-java

# 2. Ir para pasta dos PDFs
cd /caminho/para/pasta

# 3. Mesclar (ajuste nomes conforme necessário)
pdftk Alessandro_Vol1.pdf Alessandro_Vol2.pdf Alessandro_Vol3.pdf \
  cat output Alessandro_Completo.pdf

# 4. Upload do Alessandro_Completo.pdf em iarom.com.br
```

**Tempo:** 1 minuto (após install)

---

## ✅ OPÇÃO 3: API do Sistema (Para quem sabe usar Postman)

O backend JÁ ESTÁ PRONTO! (Deploy em andamento)

### Com Postman:

```
POST https://iarom.com.br/api/kb/merge-volumes

Headers:
- Cookie: connect.sid={seu-cookie-de-sessao}

Body (form-data):
- files[]: Alessandro_Vol1.pdf (seleção múltipla)
- files[]: Alessandro_Vol2.pdf
- files[]: Alessandro_Vol3.pdf
- processName: "Alessandro Ribeiro"

Response:
{
  "success": true,
  "mergedDocument": {
    "id": "merged-1738801234567",
    "name": "1738801234567_Alessandro_Ribeiro_Completo.pdf",
    "volumesCount": 3,
    "totalPages": 530
  }
}
```

Depois ir no KB e o documento mesclado já estará lá!

---

## 🚨 RECOMENDAÇÃO PARA HOJE

Use a **OPÇÃO 1** (ilovepdf.com) - é a mais rápida e confiável.

**5 minutos e você estará peticionando!**

---

## 💬 DEPOIS QUE MESCLAR E ANALISAR

Você poderá perguntar no chat:

```
"Com base no processo completo do Alessandro Ribeiro, elabore petição
de contestação aos embargos à execução, com os seguintes fundamentos:

1. Quanto ao empréstimo, conforme depoimento da Elaine nos movimentos 1 e 14...
2. Se o juiz glosar os juros por usura, apresente pedido subsidiário...
3. Elabore 2 memórias de cálculo..."
```

E o sistema vai:
- ✅ Carregar FICHAMENTO completo (530 páginas)
- ✅ Carregar CRONOLOGIA unificada
- ✅ Acessar TODOS os movimentos (1, 14, etc.)
- ✅ Elaborar peça com base no processo COMPLETO

---

## 📊 COMPARAÇÃO

| Método | Tempo | Custo | Ficheiros | Status |
|--------|-------|-------|-----------|--------|
| **3 uploads separados** | 12 min | $8.40 | Fragmentados ❌ | Não recomendado |
| **ilovepdf + 1 upload** | 5 min | $2.80 | Unificados ✅ | ⭐ RECOMENDADO |
| **PDFtk + 1 upload** | 2 min | $2.80 | Unificados ✅ | Alternativa |
| **API Merge (Postman)** | 1 min | $2.80 | Unificados ✅ | Avançado |

---

## ⏰ LINHA DO TEMPO COMPLETA

```
Agora → 2 min: Mesclar PDFs (ilovepdf)
       ↓
+3 min → Upload em iarom.com.br
       ↓
+1 min → Clicar "Analisar" (Complete + Sonnet)
       ↓
+4 min → Aguardar análise (barra de progresso evolui!)
       ↓
+0 min → PRONTO! Começar a peticionar no chat
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Total: 10 minutos do zero até estar peticionando
```

---

## 🎓 EXEMPLO DE USO NO CHAT

Depois que análise terminar (status "Concluído"):

### Consulta Simples:
```
"Liste todos os empréstimos mencionados no processo Alessandro Ribeiro"
```

### Elaboração de Peça:
```
"Elabore contestação aos embargos à execução do processo Alessandro Ribeiro,
argumentando que:

1. Foram duas operações primitivas distintas (R$ 450 + R$ 550)
2. Taxa de 6% ao mês foi acordada entre as partes
3. Após novação, totalizaram R$ 1.300
4. Cheques de bancos diferentes comprovam pagamento
5. Documentos nos movimentos 1 e 14

Se juiz glosar juros por usura:
- Pedido subsidiário: pagar principal + juros 1% a.m.
- Deduzir valores já pagos (atualizados desde vencimento)
- Apresentar 2 memórias de cálculo (com e sem glosa)

Use tom formal ABNT/OAB, cite jurisprudência do STJ sobre novação."
```

Claude vai elaborar uma contestação de **15-25 páginas** com:
- ✅ Preliminares
- ✅ Mérito
- ✅ Fundamentação legal
- ✅ Jurisprudência do STJ
- ✅ 2 memórias de cálculo
- ✅ Pedidos principal e subsidiário

---

## ❓ FAQ

**P: E se eu tiver 4 ou 5 volumes?**
R: Mesmo processo! ilovepdf aceita até 100 arquivos de uma vez.

**P: O sistema detecta a ordem automaticamente?**
R: Sim, se os nomes tiverem Vol1, Vol2, Volume 1, v1, etc.

**P: E se a nomenclatura for diferente?**
R: No ilovepdf você pode arrastar e reordenar manualmente.

**P: Quanto tempo leva a análise?**
R: ~3-4 minutos para processo de 500 páginas.

**P: Posso usar documentos já mesclados antes?**
R: Sim! Se você já tem o PDF completo, só fazer upload direto.

---

## 🆘 SE TIVER DÚVIDA

Me envie:
1. Quantos volumes você tem?
2. Nomenclatura dos arquivos (ex: "Alessandro_Vol1.pdf")
3. Tamanho total aproximado

E eu te oriento especificamente! 🎯

---

**Criado:** 2026-02-06 00:45 UTC
**Status Backend:** ✅ Deploy em andamento (commit 14ed878)
**Frontend:** Em desenvolvimento (não urgente, use opção 1)

**AÇÃO AGORA:** Use ilovepdf.com para mesclar e começar a peticionar! ⚡
