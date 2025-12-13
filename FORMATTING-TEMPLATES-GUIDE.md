# 📝 Guia de Templates de Formatação

Sistema completo para personalizar a formatação de documentos jurídicos por parceiro.

---

## 📋 Índice

1. [Visão Geral](#visão-geral)
2. [Presets Disponíveis](#presets-disponíveis)
3. [Como Usar](#como-usar)
4. [Configuração por Parceiro](#configuração-por-parceiro)
5. [Customizações Avançadas](#customizações-avançadas)
6. [API Reference](#api-reference)
7. [Integração com Documentos](#integração-com-documentos)

---

## 🎯 Visão Geral

### O Que É

O sistema de templates de formatação permite que cada escritório parceiro configure sua própria formatação para documentos gerados pelo ROM Agent, incluindo:

- **Fonte:** Família, tamanho e cor
- **Parágrafos:** Alinhamento, entrelinhas, recuos e espaçamentos
- **Margens:** Superior, inferior, esquerda e direita
- **Títulos:** Formatação personalizada para H1, H2, H3
- **Página:** Tamanho (A4, Letter) e orientação

### Por Que Usar

- ✅ Cada parceiro mantém sua identidade visual
- ✅ Conformidade com padrões (ABNT, OAB)
- ✅ Personalização sem programar
- ✅ Templates prontos + customização
- ✅ Preview antes de aplicar

---

## 📚 Presets Disponíveis

### 1. ABNT (Acadêmico)

**Quando usar:** Pareceres, artigos, trabalhos acadêmicos

```
Fonte:          Arial 12pt
Alinhamento:    Justificado
Entrelinhas:    1.5
Recuo 1ª linha: 1.25cm
Margens:        Superior 3cm, Inferior 2cm, Esquerda 3cm, Direita 2cm
```

**Características:**
- Padrão ABNT para documentos acadêmicos
- Títulos em maiúsculas e negrito
- Espaçamento duplo entre seções

### 2. OAB (Petições)

**Quando usar:** Petições iniciais, recursos, contestações

```
Fonte:          Times New Roman 12pt
Alinhamento:    Justificado
Entrelinhas:    1.5
Recuo 1ª linha: 2.0cm
Margens:        Superior 2.5cm, Inferior 2.5cm, Esquerda 3cm, Direita 2cm
```

**Características:**
- Formatação tradicional OAB
- Títulos centralizados e em maiúsculas
- Numeração de parágrafos disponível
- Recuo maior para distinguir parágrafos

### 3. Moderno

**Quando usar:** Contratos modernos, documentos empresariais

```
Fonte:          Calibri 11pt
Alinhamento:    Esquerda
Entrelinhas:    1.3
Recuo 1ª linha: 0cm (sem recuo)
Margens:        Todas 2.5cm
```

**Características:**
- Visual limpo e contemporâneo
- Cores customizadas nos títulos
- Espaçamentos menores
- Ideal para documentos digitais

### 4. Compacto

**Quando usar:** Documentos longos, relatórios extensos

```
Fonte:          Arial 10pt
Alinhamento:    Justificado
Entrelinhas:    1.15
Recuo 1ª linha: 1.0cm
Margens:        Todas reduzidas
```

**Características:**
- Economiza papel e espaço
- Mantém legibilidade
- Ideal para anexos e rascunhos

### 5. Clássico

**Quando usar:** Documentos formais, tradicionais

```
Fonte:          Garamond 12pt
Alinhamento:    Justificado
Entrelinhas:    2.0 (duplo)
Recuo 1ª linha: 2.5cm
Margens:        Superior 3cm, Inferior 3cm, Esquerda 3.5cm, Direita 2.5cm
```

**Características:**
- Estilo elegante e tradicional
- Espaçamento duplo
- Margens generosas
- Títulos centralizados

---

## 🚀 Como Usar

### Acesso Rápido

1. Acesse: `https://seu-dominio.com/admin-formatting.html`
2. Faça login como administrador
3. Selecione o parceiro
4. Escolha um preset ou personalize
5. Salve e visualize

### Passo a Passo Completo

#### 1. Acessar Interface de Formatação

```
URL: https://agente.rom.adv.br/admin-formatting.html
```

#### 2. Selecionar Parceiro

No dropdown "Selecionar Parceiro", escolha o escritório que deseja configurar.

#### 3. Escolher Preset Base

Na coluna esquerda, clique em um dos presets:

- **ABNT** - Para documentos acadêmicos
- **OAB** - Para peças processuais (padrão)
- **Moderno** - Para contratos e documentos empresariais
- **Compacto** - Para economizar espaço
- **Clássico** - Para documentos formais tradicionais

#### 4. Personalizar (Opcional)

Na coluna direita, ajuste:

**Fonte:**
- Família (Arial, Times, Calibri, etc.)
- Tamanho (8-24pt)
- Cor (seletor de cor)

**Parágrafo:**
- Alinhamento (esquerda, centro, direita, justificado)
- Entrelinhas (1.0 a 3.0)
- Recuo da primeira linha (0-5cm)
- Espaço antes/depois (0-24pt)

**Margens:**
- Superior, Inferior, Esquerda, Direita (0-10cm)

**Títulos:**
- Tamanho, negrito, maiúsculas
- Configuração para H1, H2, H3

#### 5. Visualizar

Clique em **"👁️ Visualizar"** para ver como ficará o documento.

#### 6. Salvar

Clique em **"💾 Salvar Configurações"** para aplicar.

---

## ⚙️ Configuração por Parceiro

### Exemplo: Configurar para um Parceiro

**Cenário:** Silva & Associados quer usar formatação OAB com fonte menor.

1. Selecione "Silva & Associados" no dropdown
2. Clique no preset "OAB"
3. Altere tamanho da fonte de 12pt para 11pt
4. Clique em "Salvar Configurações"

**Resultado:** Todos os documentos gerados para Silva & Associados usarão OAB com fonte 11pt.

### Múltiplos Parceiros

Cada parceiro tem sua configuração independente:

```
ROM (Padrão)          → OAB 12pt
Silva & Associados    → OAB 11pt
Advocacia Moderna     → Moderno (Calibri)
Dr. João Silva        → Clássico (Garamond)
```

---

## 🎨 Customizações Avançadas

### Via Interface Web

A interface permite ajustar todos os parâmetros visualmente.

### Via API

Para customizações programáticas:

```javascript
// Configurar template
const response = await fetch('/api/formatting/template/silva-associados', {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    templateId: 'oab',
    customizations: {
      font: {
        size: 11
      },
      paragraph: {
        lineSpacing: 1.3
      }
    }
  })
});
```

### Customizações Comuns

#### 1. Ajustar apenas o tamanho da fonte

```json
{
  "font": {
    "size": 11
  }
}
```

#### 2. Mudar alinhamento para esquerda

```json
{
  "paragraph": {
    "alignment": "left",
    "firstLineIndent": 0
  }
}
```

#### 3. Reduzir margens

```json
{
  "margins": {
    "top": 2.0,
    "bottom": 2.0,
    "left": 2.0,
    "right": 2.0
  }
}
```

#### 4. Títulos coloridos

```json
{
  "headings": {
    "h1": {
      "color": "#1a365d"
    }
  }
}
```

---

## 📡 API Reference

### Listar Presets

```http
GET /api/formatting/presets
```

**Response:**
```json
{
  "presets": [
    {
      "id": "abnt",
      "name": "ABNT (Acadêmico)",
      "description": "Formatação padrão ABNT para documentos acadêmicos"
    },
    ...
  ]
}
```

### Obter Detalhes de um Preset

```http
GET /api/formatting/presets/:presetId
```

**Response:**
```json
{
  "preset": {
    "id": "oab",
    "name": "OAB (Petições)",
    "font": { "family": "Times New Roman", "size": 12, "color": "#000000" },
    "paragraph": { ... },
    "margins": { ... },
    "headings": { ... }
  }
}
```

### Obter Template de um Parceiro

```http
GET /api/formatting/template/:partnerId
```

**Response:**
```json
{
  "template": {
    "id": "oab",
    "name": "OAB (Petições)",
    "font": { ... },
    "paragraph": { ... },
    "margins": { ... },
    "headings": { ... }
  }
}
```

### Configurar Template

```http
PUT /api/formatting/template/:partnerId
Content-Type: application/json

{
  "templateId": "oab",
  "customizations": {
    "font": {
      "size": 11
    }
  }
}
```

### Atualizar Customizações

```http
PATCH /api/formatting/template/:partnerId
Content-Type: application/json

{
  "customizations": {
    "font": {
      "size": 11
    }
  }
}
```

### Resetar Template

```http
DELETE /api/formatting/template/:partnerId
```

### Obter Config DOCX

```http
GET /api/formatting/docx-config/:partnerId
```

**Response:**
```json
{
  "config": {
    "font": "Times New Roman",
    "fontSize": 24,
    "color": "000000",
    "alignment": "justify",
    "spacing": { ... },
    "indent": { ... },
    "margins": { ... }
  }
}
```

### Obter CSS

```http
GET /api/formatting/css/:partnerId
```

**Response:** CSS pronto para uso

---

## 🔗 Integração com Documentos

### Gerar Documento DOCX

```javascript
import formattingTemplates from './lib/formatting-templates.js';

// Obter configuração do parceiro
const docxConfig = formattingTemplates.toDocxConfig('silva-associados');

// Usar com biblioteca docx
const doc = new Document({
  sections: [{
    properties: {
      page: {
        size: docxConfig.page.size,
        orientation: docxConfig.page.orientation
      },
      margin: {
        top: docxConfig.margins.top,
        bottom: docxConfig.margins.bottom,
        left: docxConfig.margins.left,
        right: docxConfig.margins.right
      }
    },
    children: [
      new Paragraph({
        text: "Conteúdo do documento",
        spacing: docxConfig.spacing,
        indent: docxConfig.indent,
        alignment: docxConfig.alignment
      })
    ]
  }]
});
```

### Preview Web (HTML/CSS)

```javascript
// Obter CSS do parceiro
const css = formattingTemplates.toCSS('silva-associados');

// Aplicar no HTML
document.getElementById('documentPreview').innerHTML = `
  <style>${css}</style>
  <div class="document-content">
    <h1>Título do Documento</h1>
    <p>Conteúdo do documento...</p>
  </div>
`;
```

### Validar Template

```javascript
const validation = formattingTemplates.validateTemplate(template);

if (!validation.valid) {
  console.error('Erro no template:', validation.error);
}
```

---

## 🛠️ Arquitetura

### Estrutura de Arquivos

```
lib/
  formatting-templates.js     # Sistema de templates
config/
  formatting-templates.json   # Configurações salvas
public/
  admin-formatting.html       # Interface admin
src/
  server-enhanced.js          # API endpoints
```

### Fluxo de Dados

```
1. Usuário seleciona preset no admin-formatting.html
2. Frontend envia customizações via API
3. formattingTemplates.js salva em config/formatting-templates.json
4. Ao gerar documento, sistema busca template do parceiro
5. Template é convertido para DOCX config ou CSS
6. Documento é gerado com formatação aplicada
```

---

## 💡 Boas Práticas

### 1. Começar com Preset

Sempre comece com um preset próximo do que deseja e customize, em vez de criar do zero.

### 2. Testar Preview

Sempre clique em "Visualizar" antes de salvar para ver como ficará.

### 3. Documentar Mudanças

Mantenha registro de qual preset e customizações cada parceiro usa.

### 4. Backup

As configurações ficam em `config/formatting-templates.json`. Faça backup regularmente.

### 5. Padrão Conservador

Quando em dúvida, use o preset OAB - é o mais aceito universalmente.

---

## 🔧 Troubleshooting

### Template não está aplicando

1. Verifique se salvou as configurações
2. Limpe o cache do navegador
3. Verifique se o parceirId está correto
4. Veja logs do servidor

### Preview não aparece

1. Verifique se o servidor está rodando
2. Abra console do navegador (F12) e veja erros
3. Teste a API: `curl http://localhost:3000/api/formatting/css/rom`

### Fonte não muda

1. Verifique se a fonte está instalada no sistema
2. Use fontes web-safe: Arial, Times New Roman, Calibri, Georgia
3. Para fontes customizadas, configure Google Fonts

---

## 📊 Comparação de Presets

| Característica | ABNT | OAB | Moderno | Compacto | Clássico |
|---------------|------|-----|---------|----------|----------|
| **Fonte** | Arial 12pt | Times 12pt | Calibri 11pt | Arial 10pt | Garamond 12pt |
| **Entrelinhas** | 1.5 | 1.5 | 1.3 | 1.15 | 2.0 |
| **Recuo 1ª linha** | 1.25cm | 2.0cm | 0cm | 1.0cm | 2.5cm |
| **Alinhamento** | Justificado | Justificado | Esquerda | Justificado | Justificado |
| **Estilo** | Acadêmico | Tradicional | Moderno | Compacto | Elegante |
| **Uso ideal** | Pareceres | Petições | Contratos | Relatórios | Docs Formais |

---

## 🎓 Tutoriais

### Tutorial 1: Configurar Parceiro Novo

1. Cadastre o parceiro em `/admin-partners.html`
2. Acesse `/admin-formatting.html`
3. Selecione o parceiro no dropdown
4. Escolha preset "OAB" (padrão recomendado)
5. Clique em "Salvar Configurações"
6. Teste gerando um documento

### Tutorial 2: Customizar OAB para Fonte Menor

1. Acesse `/admin-formatting.html`
2. Selecione o parceiro
3. Clique no preset "OAB"
4. Altere "Tamanho (pt)" de 12 para 11
5. Clique em "Visualizar" para ver resultado
6. Se satisfeito, clique em "Salvar Configurações"

### Tutorial 3: Criar Estilo Personalizado

1. Comece com preset mais próximo (ex: "Moderno")
2. Customize fonte: Calibri → Arial
3. Ajuste margens: todas para 2cm
4. Configure entrelinhas: 1.5
5. Títulos: H1 em 14pt negrito, H2 em 12pt negrito
6. Visualize e salve

---

## 📝 Changelog

### Versão 1.0 (Atual)

**Adicionado:**
- Sistema completo de templates de formatação
- 5 presets prontos (ABNT, OAB, Moderno, Compacto, Clássico)
- Interface web de configuração
- API REST completa
- Conversão para DOCX config e CSS
- Preview em tempo real
- Salvamento por parceiro

**Próximas versões:**
- Mais presets (Internacional, Minimalista)
- Import/Export de templates
- Templates compartilhados entre parceiros
- Histórico de versões
- Templates para tipos específicos (Habeas Corpus, Apelação, etc.)

---

## 🆘 Suporte

### Problemas Comuns

**"Template não encontrado"**
- Causa: Preset inválido ou parceiro não existe
- Solução: Verifique presetId e partnerId

**"Validação falhou"**
- Causa: Valores fora dos limites (ex: fonte 100pt)
- Solução: Use valores razoáveis (fonte 8-24pt)

### Contato

- **Email:** contato@rom.adv.br
- **GitHub Issues:** Para bugs e sugestões
- **Documentação:** Este arquivo e IMPLEMENTADO.md

---

## 📚 Ver Também

- **BRANDING-GUIDE.md** - Sistema de parceiros e logos
- **IMPLEMENTADO.md** - Todas as funcionalidades
- **GUIA-COMPLETO-DEPLOY.md** - Deploy e configuração
- **lib/formatting-templates.js** - Código fonte do sistema

---

**Criado por:** Rodolfo Otávio Mota - OAB/GO 21.841
**Atualizado:** 2024
**Versão:** 1.0
