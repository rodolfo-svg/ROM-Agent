# 🔧 PLANO DE CORREÇÕES - UI e Funcionalidades

**Data**: 13 de dezembro de 2024
**Versão**: 2.6.1

---

## 📋 Problemas Identificados

### 1. Estética Diferente do Claude.ai
**Problema**: Botões com emojis e cores não combinam com Claude.ai
**Solução**:
- Remover emojis dos botões
- Usar apenas ícones SVG minimalistas
- Cores neutras (cinza/preto) exceto botão principal (dourado)
- Espaçamento idêntico ao Claude.ai
- Border-radius mais sutil

### 2. Ferramentas de Exportação Não Funcionam
**Problema**: `downloadDOCX()` chama `/api/export/docx` que não existe
**Solução**:
- Criar endpoint `/api/export/docx` no backend
- Usar `lib/docx-exporter.cjs` que já existe
- Implementar conversão HTML → DOCX
- Retornar arquivo binário para download

### 3. Falta KB no Projeto ROM
**Problema**: ROM não tem Knowledge Base própria
**Solução**:
- Criar pasta `KB/ROM` para conhecimento específico
- Adicionar botão "📚 Knowledge Base" no card ROM
- Permitir upload de documentos para KB/ROM
- Consultar KB/ROM durante redação

---

## ✅ Implementação

### FASE 1: Ajustar Estética (30min)
- [ ] Remover emojis dos botões
- [ ] Adicionar ícones SVG minimalistas
- [ ] Ajustar cores para match Claude.ai
- [ ] Ajustar espaçamento e padding
- [ ] Testar em dark mode

### FASE 2: Corrigir Exportação (1h)
- [ ] Criar endpoint POST `/api/export/docx`
- [ ] Integrar com `lib/docx-exporter.cjs`
- [ ] Converter HTML para formato compatível
- [ ] Testar download DOCX
- [ ] Testar outros formatos (PDF, TXT, HTML)

### FASE 3: Implementar KB ROM (1h30)
- [ ] Criar estrutura de pastas KB/ROM
- [ ] Adicionar botão KB no card ROM
- [ ] Criar modal de upload para KB
- [ ] Implementar listagem de documentos KB
- [ ] Integrar KB na consulta do agente
- [ ] Adicionar badge de contagem de docs

---

## 🎨 Novo Design dos Botões (Claude.ai-like)

```html
<!-- ANTES (com emojis): -->
<button>📥 Baixar</button>

<!-- DEPOIS (minimalista): -->
<button class="action-btn">
  <svg>...</svg>
  Baixar
</button>
```

**Cores**:
- Botão principal: `#D4AF37` (dourado)
- Botões secundários: `transparent` com border
- Hover: Leve background cinza

---

## 🔌 Novo Endpoint de Exportação

```javascript
// POST /api/export/docx
router.post('/export/docx', async (req, res) => {
  const { content, projectId } = req.body;

  // Usar lib/docx-exporter.cjs
  const { exportToDocx } = require('../lib/docx-exporter.cjs');

  const buffer = await exportToDocx({
    conteudoHTML: content,
    titulo: 'Documento ROM Agent'
  });

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
  res.setHeader('Content-Disposition', 'attachment; filename=documento.docx');
  res.send(buffer);
});
```

---

## 📚 Estrutura KB ROM

```
KB/
├── ROM/                    # KB específica do projeto ROM
│   ├── modelos/           # Modelos de peças
│   ├── legislacao/        # Legislação frequente
│   ├── jurisprudencia/    # Precedentes salvos
│   └── doutrina/          # Artigos e livros
└── projects/              # KB por projeto (já existe)
```

---

## 🚀 Ordem de Implementação

1. **PRIMEIRO**: Ajustar estética (urgente - está feio)
2. **SEGUNDO**: Corrigir exportação DOCX (funcionalidade crítica)
3. **TERCEIRO**: Implementar KB ROM (melhoria importante)

---

## 📝 Checklist de Teste

### Estética:
- [ ] Botões parecem com Claude.ai
- [ ] Cores neutras em lugar de emojis
- [ ] Espaçamento correto
- [ ] Hover funciona suavemente
- [ ] Dark mode funciona

### Exportação:
- [ ] DOCX baixa corretamente
- [ ] PDF funciona
- [ ] TXT funciona
- [ ] HTML funciona
- [ ] Nomes dos arquivos corretos

### KB ROM:
- [ ] Pasta KB/ROM criada
- [ ] Upload funciona
- [ ] Listagem exibe documentos
- [ ] Consulta KB durante redação
- [ ] Badge mostra quantidade

---

**Prioridade**: ALTA
**Tempo Estimado**: 3 horas total
**Impacto**: Alto na usabilidade
