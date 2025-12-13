# 📦 CAPACIDADE DE ARMAZENAMENTO - KB ROM AGENT

**Versão**: 2.6.0
**Data**: 13 de dezembro de 2024

---

## 📊 LIMITES ATUAIS

### 1. Limite por Arquivo
```
✅ 50 MB por arquivo individual
```
- Configurado no multer (src/server-enhanced.js:120)
- Suficiente para:
  - PDFs de processos (normalmente 5-20 MB)
  - DOCX com imagens (até 30 MB)
  - Imagens escaneadas (10-15 MB cada)

### 2. Upload em Lote
```
✅ 10 arquivos por vez
✅ Total máximo: 500 MB por upload (10 x 50MB)
```
- Configurado em `upload.array('files', 10)` no backend
- Permite enviar processo completo em uma única operação

### 3. Armazenamento por Projeto
```
🔹 Ilimitado (limitado apenas pelo espaço total)
```
- Cada projeto tem seu próprio diretório isolado
- Estrutura: `KB/projetos/projeto_XXX/documentos/`

---

## 💾 CAPACIDADES DO SERVIDOR

### Local (Desenvolvimento)
```
📍 Espaço disponível: 29 GB de 228 GB
📂 KB atual: 8 KB (praticamente vazio)
✅ Capacidade: ~58.000 arquivos de 500KB cada
```

### Render.com (Produção)
```
📦 Plano FREE: 1 GB de disco persistente
📦 Plano STARTER ($7/mês): 10 GB
📦 Plano STANDARD ($25/mês): 50 GB
📦 Plano PRO ($85/mês): 100 GB
```

**Render.yaml atual (linha 66):**
```yaml
disk:
  name: rom-storage
  mountPath: /var/data
  sizeGB: 1  # ← Plano FREE
```

---

## 📈 CAPACIDADE ESTIMADA POR PLANO

### Plano FREE (1 GB) - Atual
```
Processo completo médio: 15-30 MB
Capacidade estimada: 30-60 processos completos

Exemplo de processo típico:
├── Petição inicial (5 MB)
├── Documentos (10 MB)
├── Jurisprudência (5 MB)
├── Fotos/provas (10 MB)
└── TOTAL: ~30 MB
```

### Plano STARTER (10 GB)
```
Capacidade: 300-600 processos completos
Ideal para: Escritório pequeno/médio
```

### Plano STANDARD (50 GB)
```
Capacidade: 1.500-3.000 processos completos
Ideal para: Escritório grande
```

### Plano PRO (100 GB)
```
Capacidade: 3.000-6.000 processos completos
Ideal para: Grande volume
```

---

## 🗂️ ESTRUTURA DO KB POR PROJETO

```
KB/
├── projetos/
│   ├── projeto_001_caso_silva/
│   │   ├── documentos/              ← Arquivos originais
│   │   │   ├── peticao_inicial.pdf (5 MB)
│   │   │   ├── contrato.pdf (3 MB)
│   │   │   ├── recibos.pdf (2 MB)
│   │   │   ├── prints_whatsapp.pdf (8 MB)
│   │   │   └── laudo_medico.pdf (12 MB)
│   │   │   └── TOTAL: ~30 MB
│   │   │
│   │   ├── extraidos/               ← Dados extraídos (JSON)
│   │   │   ├── contrato_extraido.json (50 KB)
│   │   │   ├── recibos_extraido.json (20 KB)
│   │   │   └── TOTAL: ~100 KB
│   │   │
│   │   ├── analise.json             ← Análise da IA (5 KB)
│   │   ├── metadata.json            ← Metadados (2 KB)
│   │   └── chat_history.json        ← Histórico chat (50 KB)
│   │
│   ├── projeto_002_indenizacao/
│   │   └── ... (~25 MB)
│   │
│   └── projeto_003_hc_joao/
│       └── ... (~20 MB)
│
└── TOTAL EXEMPLO: ~75 MB (3 projetos)
```

---

## 🔧 OTIMIZAÇÕES IMPLEMENTADAS

### 1. Limpeza Automática
```javascript
// KB Auto-Cleanup (lib/kb-cleaner.cjs)
- Remove arquivos órfãos (sem projeto)
- Remove documentos de projetos excluídos
- Agenda limpeza automática a cada 24h
```

### 2. Compressão de Dados Extraídos
```javascript
// JSON extraído é muito menor que PDFs
Exemplo:
- contrato.pdf: 3 MB
- contrato_extraido.json: 50 KB (60x menor)
```

### 3. Deduplicação (Futuro)
```javascript
// Detectar documentos duplicados via hash
- Economiza até 30% de espaço
- Evita processar mesmo documento 2x
```

---

## 📊 MONITORAMENTO

### API de Estatísticas
```
GET /api/upload/stats
```

Retorna:
```json
{
  "totalFiles": 120,
  "totalSize": "1.2 GB",
  "totalProjects": 25,
  "avgProjectSize": "48 MB",
  "freeSpace": "8.8 GB"
}
```

### Dashboard Visual (Implementar)
```
📊 Espaço usado: 1.2 GB / 10 GB (12%)
📁 Projetos: 25
📄 Arquivos: 120
⚠️ Alerta quando > 80%
```

---

## 🚀 RECOMENDAÇÕES

### Para Plano FREE (1 GB)
✅ **Suficiente para:**
- 30-60 processos pequenos/médios
- Testes e desenvolvimento
- Escritório individual

❌ **Não recomendado para:**
- Processos com muitas fotos/vídeos
- Grande volume de casos simultâneos

### Para Produção (Upgrade necessário)
🎯 **Recomendação: Plano STARTER (10 GB)**
- Custo: $7/mês
- Capacidade: 300-600 processos
- Ideal para escritório médio

### Tipos de Arquivo e Tamanhos Típicos
```
PDF texto simples:     1-5 MB
PDF com imagens:       5-20 MB
PDF escaneado:         10-30 MB
DOCX texto:            100 KB - 2 MB
DOCX com imagens:      2-10 MB
Imagem JPG:            500 KB - 3 MB
Imagem PNG:            1-5 MB
Vídeo curto (prova):   50-200 MB (considerar YouTube/Vimeo)
```

---

## 🔄 UPGRADE DE CAPACIDADE

### Como aumentar no Render.com:

1. **Via Dashboard:**
   ```
   Render Dashboard → rom-agent → Settings → Disk
   → Aumentar sizeGB → Save
   ```

2. **Via render.yaml:**
   ```yaml
   disk:
     name: rom-storage
     mountPath: /var/data
     sizeGB: 10  # ← Alterar de 1 para 10
   ```

3. **Via CLI:**
   ```bash
   render services update rom-agent --disk-size 10
   ```

---

## 📝 BOAS PRÁTICAS

### 1. Organize por Projeto
✅ Sempre use o sistema de projetos
✅ Nunca jogue arquivos soltos no KB

### 2. Comprima Antes de Upload
✅ PDFs muito grandes → comprimir online
✅ Imagens → reduzir resolução se possível
✅ Use ferramentas como:
   - iLovePDF (compressão PDF)
   - TinyPNG (imagens)

### 3. Exclua Projetos Antigos
✅ Projetos encerrados → fazer backup → excluir
✅ Libera espaço automaticamente

### 4. Use Links para Vídeos
❌ Não fazer upload de vídeos longos
✅ Enviar link do YouTube/Google Drive
✅ Sistema pode gerar QR code no PDF

---

## 🔮 FUTURO (v2.7.0+)

### Integração AWS S3
```
✅ Armazenamento ilimitado
✅ Custo: ~$0.023/GB/mês
✅ Backup automático
✅ CDN integrado
```

### Integração Google Drive
```
✅ Cliente já usa Drive
✅ Sincronização bidirecional
✅ Sem limite de espaço
```

### Compressão Inteligente
```
✅ Detecta PDFs já comprimidos
✅ Comprime automaticamente
✅ Reduz até 70% tamanho
```

---

## 📞 SUPORTE

Dúvidas sobre capacidade:
- Verificar espaço usado: `GET /api/upload/stats`
- Dashboard: `/dashboard-v2.html`
- Limpar KB: `DELETE /api/kb/cleanup`

---

**🎯 RESUMO EXECUTIVO:**

| Plano | Espaço | Processos | Custo | Recomendação |
|-------|--------|-----------|-------|--------------|
| FREE | 1 GB | 30-60 | $0 | Teste/Dev |
| STARTER | 10 GB | 300-600 | $7/mês | ✅ **Produção** |
| STANDARD | 50 GB | 1500-3000 | $25/mês | Grande volume |
| PRO | 100 GB | 3000-6000 | $85/mês | Enterprise |

**Limite por arquivo: 50 MB** (pode aumentar se necessário)
**Upload em lote: 10 arquivos** (500 MB total por operação)
