# Scripts para Análise de Logs do Render

Dois scripts para baixar e analisar logs de build do Render.

---

## Opção 1: Download Automático via API (Requer API Key)

### Pré-requisito: Obter API Key do Render

1. Acesse: https://dashboard.render.com/account/settings
2. Clique em **"API Keys"** → **"Create API Key"**
3. Copie a key gerada

### Uso:

```bash
# 1. Exportar API Key
export RENDER_API_KEY='rnd_xxxxxxxxxxxxxxxxxxxxx'

# 2. Executar script
bash scripts/download-render-logs.sh
```

**Resultado:**
- Baixa logs de `01:39:00` até `01:43:00` (período do build)
- Salva em: `render-build-logs-YYYYMMDD-HHMMSS.txt`
- Cria versão filtrada: `render-build-filtered-YYYYMMDD-HHMMSS.txt`
- Mostra preview das primeiras 30 linhas relevantes

---

## Opção 2: Processar Logs Copiados Manualmente (Sem API Key)

### Passo a Passo:

#### 1. Copiar logs do Dashboard:

```
1. Abra: https://dashboard.render.com/web/srv-d5aqg0hr0fns73dmiis0/logs
2. No filtro de tempo: 01:39:00 até 01:43:00
3. Selecione TUDO (Cmd+A ou Ctrl+A)
4. Copie (Cmd+C ou Ctrl+C)
```

#### 2. Salvar em arquivo:

```bash
# Cole os logs e salve
nano render-logs.txt
# (Cole com Cmd+V, salve com Ctrl+X, Y, Enter)
```

#### 3. Processar logs:

```bash
bash scripts/process-render-logs.sh render-logs.txt
```

**Resultado:**
- Extrai informações do build
- Busca menções a qpdf
- Lista erros e avisos
- Mostra status final do build
- Salva análise em: `build-analysis-YYYYMMDD-HHMMSS.txt`

---

## O que Procurar nos Logs

### ✅ SUCESSO - qpdf instalado corretamente:

```
📄 [2.5/7] Instalando qpdf para merge de PDFs grandes...
   ⚙️ qpdf não encontrado, instalando via binário...
   📦 Baixando qpdf 11.3.0 (Ubuntu 22.04)...
   📂 Extraindo binários...
   ✅ qpdf instalado em: /home/render/.local/bin/qpdf
   ✅ qpdf confirmado: /home/render/.local/bin/qpdf
```

**E no início do servidor:**
```
✅ qpdf disponível: /home/render/.local/bin/qpdf
qpdf version 11.3.0
```

### ❌ PROBLEMA - qpdf não foi instalado:

```
⚠️ qpdf não encontrado - merge usará pdf-lib (alto uso de memória)
```

---

## Verificação Rápida (Sem Scripts)

Se o servidor já está rodando, teste diretamente:

```bash
curl https://iarom.com.br/api/kb/merge-volumes/check-tools
```

**Resposta esperada (SUCESSO):**
```json
{
  "success": true,
  "tools": {
    "qpdf": {
      "installed": true,
      "version": "qpdf version 11.3.0",
      "path": "/home/render/.local/bin/qpdf"
    }
  },
  "recommendation": "qpdf available"
}
```

**Resposta de FALHA:**
```json
{
  "success": true,
  "tools": {
    "qpdf": {
      "installed": false,
      "error": "qpdf: not found"
    }
  },
  "recommendation": "No native tools available - will use pdf-lib (high memory usage)"
}
```

---

## Troubleshooting

### Problema: Nenhuma menção a qpdf nos logs

**Causa:** Build script não foi executado ou commit errado deployado

**Solução:**
```bash
# Verificar último commit deployado
git log --oneline -1

# Deve mostrar:
# 253357d 🔧 Instalar qpdf via binário no build

# Se não for este commit, fazer deploy manual:
git push origin main
```

### Problema: qpdf instalado mas check-tools mostra false

**Causa:** PATH não está configurado no runtime

**Solução:** Verificar se `scripts/start-with-qpdf.sh` está sendo usado:
```bash
# No render.yaml deve ter:
startCommand: bash scripts/start-with-qpdf.sh
```

### Problema: Build demorou muito (>10 min)

**Causa:** Download do qpdf pode falhar por timeout

**Solução:** Redeploy ou verificar conectividade do Render com Ubuntu repositories

---

## Análise Completa - Checklist

- [ ] Logs mostram `[2.5/7] Instalando qpdf`
- [ ] Logs mostram `qpdf instalado em: /home/render/.local/bin/qpdf`
- [ ] Servidor inicia com `✅ qpdf disponível`
- [ ] `/check-tools` retorna `installed: true`
- [ ] Merge de 3 volumes (246MB) funciona sem OOM

Se **TODOS** os itens estão OK → Sistema funcionando perfeitamente!
