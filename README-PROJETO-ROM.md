# Projeto ROM - Redator de Obras Magistrais

## Sistema de Custom Instructions, Prompts e Templates Autoatualizáveis

Versão: 2.7.0
Última atualização: 15 de dezembro de 2025

---

## 📋 Índice

1. [Visão Geral](#visão-geral)
2. [Estrutura do Projeto](#estrutura-do-projeto)
3. [Custom Instructions](#custom-instructions)
4. [Sistema de Prompts](#sistema-de-prompts)
5. [Templates](#templates)
6. [Knowledge Base Multi-Extensão](#knowledge-base-multi-extensão)
7. [API Endpoints](#api-endpoints)
8. [Como Usar](#como-usar)
9. [Atualização e Manutenção](#atualização-e-manutenção)

---

## 🎯 Visão Geral

O **Projeto ROM** é um sistema completo de gerenciamento de instruções personalizadas (custom instructions), prompts jurídicos e templates para redação de peças processuais e documentos extrajudiciais.

### Características Principais

- ✅ **Custom Instructions Configuráveis**: Instruções personalizadas que definem o comportamento do assistente jurídico
- ✅ **Prompts Autoatualizáveis**: Biblioteca de prompts em JSON que podem ser atualizados manual ou automaticamente
- ✅ **Biblioteca Organizada**: Prompts organizados por categoria (judiciais, extrajudiciais, gerais)
- ✅ **Templates Handlebars**: Sistema de templates reutilizáveis para geração de peças
- ✅ **Knowledge Base Multi-Extensão**: Aceita qualquer tipo de arquivo (PDFs, DOCXs, imagens, vídeos, etc.)
- ✅ **API RESTful**: Endpoints para gerenciar prompts, templates e configurações
- ✅ **Conformidade DNRC**: Instruções específicas para atos societários conforme normas do DNRC

---

## 📁 Estrutura do Projeto

```
data/rom-project/
├── custom-instructions.json          # Instruções personalizadas do sistema
├── prompts/                           # Biblioteca de prompts
│   ├── judiciais/                    # Peças judiciais
│   │   ├── peticao-inicial.json
│   │   ├── habeas-corpus.json
│   │   ├── contestacao.json
│   │   └── ...
│   ├── extrajudiciais/               # Peças extrajudiciais
│   │   ├── alteracao-contratual.json
│   │   ├── contrato-social.json
│   │   ├── procuracao.json
│   │   └── ...
│   └── gerais/                       # Configurações gerais
│       ├── master-rom.json
│       └── ...
├── templates/                         # Templates Handlebars
│   ├── peticao-inicial.hbs
│   ├── contestacao.hbs
│   └── ...
└── kb/                                # Knowledge Base
    └── uploads/                       # Arquivos enviados

src/services/
└── rom-project-service.js             # Serviço de gerenciamento
```

---

## ⚙️ Custom Instructions

As custom instructions definem como o assistente jurídico ROM deve se comportar.

### Arquivo: `custom-instructions.json`

```json
{
  "project": "ROM-Agent",
  "version": "1.0.0",
  "systemInstructions": {
    "role": "Assistente jurídico especializado",
    "expertise": [
      "Redação de peças judiciais",
      "Redação de peças extrajudiciais",
      "Conformidade com normas DNRC"
    ],
    "tone": "Formal, técnico-jurídico, preciso e objetivo",
    "formatting": {
      "font": "Arial ou Times New Roman, 12pt",
      "margins": "3cm superior, 2cm inferior, 3cm esquerda, 2cm direita",
      "spacing": "1,5 linhas"
    }
  },
  "specializedAreas": {
    "empresarial": {
      "dnrcCompliance": true,
      "sociedadesTypes": ["LTDA", "SA", "EIRELI", "SLU"]
    }
  }
}
```

### Como Atualizar

```javascript
import romProjectService from './src/services/rom-project-service.js';

// Atualizar custom instructions
await romProjectService.updateCustomInstructions({
  systemInstructions: {
    tone: "Formal e objetivo"
  }
});
```

---

## 📚 Sistema de Prompts

Os prompts são organizados em três categorias e armazenados em arquivos JSON.

### Estrutura de um Prompt

```json
{
  "id": "peticao-inicial",
  "nome": "Petição Inicial Cível",
  "categoria": "civel",
  "version": "1.1",
  "updated": "2025-12-15T00:00:00.000Z",
  "autoUpdateable": true,
  "descricao": "Petição inicial completa conforme art. 319, CPC",
  "tags": ["petição", "inicial", "cível"],
  "estrutura": [
    "ENDEREÇAMENTO",
    "QUALIFICAÇÃO DAS PARTES",
    "I. DOS FATOS",
    "II. DO DIREITO",
    "III. DOS PEDIDOS"
  ],
  "instrucoes": "...",
  "fundamentos": {...},
  "formatacao": {...}
}
```

### Categorias

#### 1. Prompts Judiciais (`prompts/judiciais/`)

- Petição Inicial
- Habeas Corpus
- Contestação
- Réplica
- Recursos (Apelação, Agravo, REsp, RE)
- Embargos de Declaração
- Alegações Finais
- E muitos outros...

#### 2. Prompts Extrajudiciais (`prompts/extrajudiciais/`)

- Alteração Contratual (DNRC)
- Contrato Social
- Distrato Social
- Procurações
- Substabelecimentos
- Contratos (prestação de serviços, honorários, locação)
- Notificações

#### 3. Prompts Gerais (`prompts/gerais/`)

- Master ROM v3.0 (formatação e identidade)
- Configurações globais
- Vocabulário jurídico

---

## 🎨 Templates

Templates Handlebars para geração automática de peças.

### Exemplo de Template

```handlebars
EXCELENTÍSSIMO SENHOR DOUTOR JUIZ DE DIREITO DA {{maiusculas vara}} DA COMARCA DE {{maiusculas comarca}}/{{uf}}

{{nome nomeAutor}}, {{nacionalidadeAutor}}, {{estadoCivilAutor}}, inscrito no CPF sob nº {{cpf cpfAutor}},
vem, respeitosamente, propor a presente

{{maiusculas tipoAcao}}

em face de {{nome nomeReu}}, pelos fatos e fundamentos a seguir expostos:

I - DOS FATOS

{{fatos}}

II - DO DIREITO

{{direito}}

III - DOS PEDIDOS

{{#cadaComIndice pedidos}}
{{alinea indice}}) {{this.texto}};
{{/cadaComIndice}}
```

### Helpers Disponíveis

- `{{dataFormatada data 'extenso'}}` - Formata datas
- `{{cpf cpfNumero}}` - Formata CPF
- `{{cnpj cnpjNumero}}` - Formata CNPJ
- `{{processoCNJ numero}}` - Formata número de processo CNJ
- `{{moeda valor}}` - Formata valores monetários
- `{{maiusculas texto}}` - Converte para maiúsculas
- `{{romano numero}}` - Converte para numeração romana

---

## 📂 Knowledge Base Multi-Extensão

O sistema aceita upload de **qualquer tipo de arquivo** para o Knowledge Base.

### Extensões Suportadas

- **Documentos**: PDF, DOCX, DOC, TXT, RTF, MD
- **Imagens**: JPG, PNG, GIF, BMP, TIFF
- **Vídeos**: MP4, AVI, MOV, WMV
- **Planilhas**: XLSX, XLS, CSV
- **Apresentações**: PPTX, PPT
- **Áudio**: MP3, WAV
- **Código**: JS, PY, JAVA, C, CPP
- **Dados**: JSON, XML, YAML
- **E muito mais...**

### Upload para KB

```javascript
// Via API
POST /api/rom-project/kb/upload

// Body (multipart/form-data)
{
  "files": [arquivo1, arquivo2, ...],
  "projectName": "ROM",
  "category": "processos"
}
```

---

## 🔌 API Endpoints

### Prompts

```bash
# Listar todos os prompts
GET /api/rom-project/prompts

# Listar prompts de uma categoria
GET /api/rom-project/prompts?category=judiciais

# Obter prompt específico
GET /api/rom-project/prompts/judiciais/peticao-inicial

# Criar/atualizar prompt
POST /api/rom-project/prompts/judiciais/peticao-inicial
{
  "nome": "Petição Inicial Cível",
  "categoria": "civel",
  "instrucoes": "...",
  ...
}

# Deletar prompt
DELETE /api/rom-project/prompts/judiciais/peticao-inicial

# Buscar prompts por palavra-chave
GET /api/rom-project/prompts/search?keyword=habeas
```

### Custom Instructions

```bash
# Obter custom instructions
GET /api/rom-project/custom-instructions

# Atualizar custom instructions
PUT /api/rom-project/custom-instructions
{
  "systemInstructions": {...},
  "specializedAreas": {...}
}
```

### Templates

```bash
# Listar templates
GET /api/rom-project/templates

# Obter template específico
GET /api/rom-project/templates/peticao-inicial

# Salvar template
POST /api/rom-project/templates/peticao-inicial
{
  "content": "{{templateContent}}"
}
```

### Projeto

```bash
# Exportar projeto completo
GET /api/rom-project/export

# Importar projeto
POST /api/rom-project/import
{
  "customInstructions": {...},
  "prompts": {...},
  "templates": {...}
}

# Estatísticas
GET /api/rom-project/stats
```

---

## 🚀 Como Usar

### 1. Inicializar o Serviço

```javascript
import romProjectService from './src/services/rom-project-service.js';

// Inicializar (carrega tudo automaticamente)
await romProjectService.init();
```

### 2. Obter Prompt para Uso no Chat

```javascript
// Obter prompt completo com custom instructions
const fullPrompt = romProjectService.generateFullPrompt(
  'judiciais',
  'peticao-inicial',
  {
    comarca: 'Goiânia',
    vara: '1ª Vara Cível'
  }
);

// Usar no chat
const response = await chat(fullPrompt);
```

### 3. Criar Novo Prompt

```javascript
await romProjectService.savePrompt('judiciais', 'novo-prompt', {
  nome: 'Meu Novo Prompt',
  categoria: 'civel',
  version: '1.0',
  descricao: 'Descrição do prompt',
  instrucoes: 'Instruções detalhadas...',
  estrutura: ['SEÇÃO 1', 'SEÇÃO 2'],
  tags: ['tag1', 'tag2']
});
```

### 4. Atualizar Prompt Existente

```javascript
const prompt = romProjectService.getPrompt('judiciais', 'peticao-inicial');
prompt.version = '1.2';
prompt.instrucoes += '\n\nNova instrução...';

await romProjectService.savePrompt('judiciais', 'peticao-inicial', prompt);
```

---

## 🔄 Atualização e Manutenção

### Prompts Autoatualizáveis

Todos os prompts têm a propriedade `autoUpdateable: true`, permitindo:

1. **Atualização Manual**: Edite o arquivo JSON diretamente
2. **Atualização via API**: Use os endpoints para modificar programaticamente
3. **Versionamento**: Cada prompt mantém seu histórico de versões
4. **Backup Automático**: O sistema mantém backups antes de atualizar

### Boas Práticas

1. **Sempre incrementar a versão** ao fazer alterações significativas
2. **Documentar mudanças** na propriedade `updated`
3. **Testar prompts** antes de usar em produção
4. **Manter backup** regular do diretório `data/rom-project/`
5. **Usar tags** para facilitar buscas

### Exemplo de Atualização

```javascript
// 1. Obter prompt existente
const prompt = romProjectService.getPrompt('judiciais', 'habeas-corpus');

// 2. Atualizar
prompt.version = '2.1';
prompt.instrucoes += '\n\nNOVA INSTRUÇÃO: Sempre verificar prazo decadencial...';
prompt.updated = new Date().toISOString();

// 3. Salvar
await romProjectService.savePrompt('judiciais', 'habeas-corpus', prompt);

console.log('✅ Prompt atualizado para versão 2.1');
```

---

## 📊 Estatísticas

```javascript
const stats = romProjectService.getStatistics();

console.log(stats);
// {
//   customInstructions: 'loaded',
//   prompts: {
//     judiciais: 25,
//     extrajudiciais: 15,
//     gerais: 3,
//     total: 43
//   },
//   templates: 18,
//   lastUpdated: '2025-12-15T00:00:00.000Z',
//   version: '2.7.0'
// }
```

---

## 🛠️ Integração com o Sistema ROM Agent

O Projeto ROM se integra perfeitamente com:

1. **Chat Interface**: Prompts são usados automaticamente no chat
2. **Extração de Documentos**: Documentos extraídos são adicionados ao KB
3. **Sistema de Jurisprudência**: Integração com DataJud, JusBrasil, WebSearch
4. **Sistema de Parceiros**: Custom instructions por parceiro
5. **Sistema Multi-Tenant**: Diferentes configurações por parceiro

---

## 📝 Licença e Uso

Este sistema é parte do **ROM Agent** e destina-se exclusivamente ao uso profissional jurídico, respeitando:

- Lei Geral de Proteção de Dados (LGPD)
- Código de Ética da OAB
- Normas do DNRC (IN DREI 81/2020)
- Direitos autorais

---

## 📞 Suporte

Para dúvidas ou problemas:
- Email: contato@rom.adv.br
- Telefone: (62) 3293-2323
- Site: www.rom.adv.br

---

**© 2025 - ROM Agent - Redator de Obras Magistrais**
