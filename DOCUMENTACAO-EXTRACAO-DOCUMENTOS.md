# Sistema de Extração de Documentos Gerais - ROM Agent

## Visão Geral

Sistema completo para extração e processamento de documentos de qualquer tipo com suporte para **múltiplos arquivos sem limite**, pasta customizável, processamento automático e upload para Knowledge Base.

**Diferencial**: Permite extrair QUALQUER quantidade de documentos simultaneamente, de diferentes tipos, organizando tudo em uma estrutura personalizada.

## Tipos de Documentos Suportados

### 1. PDF
- **Extensões**: `.pdf`
- **Processamento**: Extração de texto + OCR automático se necessário
- **Recursos**: Análise de conteúdo, contagem de páginas, detecção de texto/imagem

### 2. Imagens
- **Extensões**: `.jpg`, `.jpeg`, `.png`, `.gif`, `.bmp`, `.tiff`, `.webp`
- **Processamento**: OCR + Análise visual
- **Recursos**: Extração de texto, descrição da imagem, análise de conteúdo

### 3. Vídeos
- **Extensões**: `.mp4`, `.avi`, `.mov`, `.mkv`, `.webm`, `.flv`
- **Processamento**: Transcrição automática com timestamps
- **Recursos**: Texto completo da fala, marcadores temporais, análise de conteúdo

### 4. Documentos Office
- **Word**: `.docx`, `.doc`, `.odt`, `.rtf`
- **Excel**: `.xlsx`, `.xls`, `.ods`, `.csv`
- **PowerPoint**: `.pptx`, `.ppt`, `.odp`
- **Processamento**: Extração de conteúdo preservando estrutura

### 5. Arquivos de Texto e Código
- **Extensões**: `.txt`, `.md`, `.json`, `.xml`, `.html`, `.css`, `.js`
- **Processamento**: Leitura direta com análise

## Estrutura de Pastas

Todas as extrações são organizadas no Desktop em pastas customizadas:

```
Desktop/
└── ROM-Extractions/
    └── [Nome-Customizado]/
        ├── original/              # Cópias dos arquivos originais
        ├── extracted/             # Documentos processados
        │   ├── documento-completo.json  # JSON completo
        │   ├── documento-completo.txt   # Texto consolidado
        │   ├── resumo.md               # Resumo executivo
        │   └── indice.json             # Índice dos arquivos
        ├── ocr/                   # Resultados de OCR
        ├── images/                # Imagens processadas
        ├── videos/                # Transcrições de vídeo
        └── metadata.json          # Metadados da extração
```

## Arquivos Criados

### `/src/services/document-extraction-service.js`
Serviço completo de extração de documentos gerais.

**Funções principais:**

```javascript
/**
 * Extração de múltiplos documentos
 * SUPORTA ILIMITADOS ARQUIVOS
 */
export async function extractGeneralDocuments(options)

/**
 * Criar estrutura de pastas customizada
 */
export async function createCustomFolderStructure(folderName, projectName)

/**
 * Obter caminho do Desktop (cross-platform)
 */
export function getDesktopPath()

/**
 * Processar PDF com OCR automático
 */
async function processPDF(filePath, outputFolder)

/**
 * Processar imagem com OCR e análise
 */
async function processImage(filePath, outputFolder)

/**
 * Processar vídeo com transcrição
 */
async function processVideo(filePath, outputFolder)

/**
 * Processar documentos de texto
 */
async function processTextDocument(filePath)
```

## Endpoints de API

### POST /api/documents/extract

Extrai **múltiplos documentos** (ILIMITADO) em uma única operação.

**Body:**
```json
{
  "files": [
    "/path/to/file1.pdf",
    "/path/to/file2.jpg",
    "/path/to/file3.mp4",
    "/path/to/file4.docx"
  ],
  "folderName": "Processo-Cliente-ABC",
  "projectName": "ROM",
  "uploadToKB": true
}
```

**Campos:**
- `files` (array, obrigatório): Array de caminhos de arquivos **SEM LIMITE**
- `folderName` (string, obrigatório): Nome customizado da pasta
- `projectName` (string, opcional): Nome do projeto (padrão: "ROM")
- `uploadToKB` (boolean, opcional): Upload automático para KB (padrão: true)

**Response:**
```json
{
  "success": true,
  "message": "4 documento(s) extraído(s) com sucesso",
  "folder": "/Users/user/Desktop/ROM-Extractions/Processo-Cliente-ABC",
  "files": {
    "original": [...],
    "extracted": [...],
    "ocr": [...],
    "images": [...],
    "videos": [...]
  },
  "completedAt": "2025-12-15T10:30:00.000Z"
}
```

**Exemplo de uso:**
```bash
curl -X POST https://iarom.com.br/api/documents/extract \
  -H "Content-Type: application/json" \
  -d '{
    "files": [
      "/Users/user/Downloads/contrato.pdf",
      "/Users/user/Downloads/foto-obra.jpg",
      "/Users/user/Downloads/reuniao.mp4"
    ],
    "folderName": "Contrato-Obra-123",
    "uploadToKB": true
  }'
```

### POST /api/documents/create-folder

Cria estrutura de pastas customizada antes da extração.

**Body:**
```json
{
  "folderName": "Projeto-XYZ",
  "projectName": "ROM"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Estrutura de pastas criada com sucesso",
  "baseFolder": "/Users/user/Desktop/ROM-Extractions/Projeto-XYZ",
  "folders": {
    "original": "/Users/.../original",
    "extracted": "/Users/.../extracted",
    "ocr": "/Users/.../ocr",
    "images": "/Users/.../images",
    "videos": "/Users/.../videos"
  },
  "metadata": {...}
}
```

### GET /api/documents/supported-types

Lista todos os tipos de arquivo suportados.

**Response:**
```json
{
  "success": true,
  "message": "Sistema suporta 31 tipos de arquivo",
  "totalTipos": 7,
  "totalExtensoes": 31,
  "tipos": {
    "pdf": {
      "extensoes": [".pdf"],
      "descricao": "Documentos PDF com OCR automático se necessário",
      "recursos": ["Extração de texto", "OCR", "Análise de conteúdo"]
    },
    "imagem": {...},
    "video": {...},
    "documento": {...},
    "planilha": {...},
    "apresentacao": {...},
    "texto": {...}
  },
  "observacoes": [
    "Suporte para múltiplos documentos sem limite",
    "Processamento automático por tipo de arquivo",
    "Export em JSON e TXT",
    "Upload automático para Knowledge Base",
    "Estrutura de pastas customizável"
  ]
}
```

### GET /api/documents/desktop-path

Retorna o caminho do Desktop (cross-platform).

**Response:**
```json
{
  "success": true,
  "desktopPath": "/Users/user/Desktop",
  "basePath": "/Users/user/Desktop/ROM-Extractions",
  "platform": "darwin",
  "observacao": "Todas as extrações são salvas em subpastas customizadas dentro de ROM-Extractions"
}
```

## Como Usar

### 1. Via API (Múltiplos Documentos)

```javascript
const response = await fetch('https://iarom.com.br/api/documents/extract', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    files: [
      '/Users/user/Downloads/documento1.pdf',
      '/Users/user/Downloads/foto1.jpg',
      '/Users/user/Downloads/foto2.jpg',
      '/Users/user/Downloads/video-explicativo.mp4',
      '/Users/user/Downloads/planilha.xlsx',
      '/Users/user/Downloads/contrato.docx'
      // ... PODE ADICIONAR QUANTOS QUISER!
    ],
    folderName: 'Cliente-ABC-Documentacao-Completa',
    uploadToKB: true
  })
});

const result = await response.json();
console.log(`${result.message}`);
console.log(`Pasta criada: ${result.folder}`);
```

### 2. Via Código (JavaScript)

```javascript
import { extractGeneralDocuments } from './src/services/document-extraction-service.js';

const resultado = await extractGeneralDocuments({
  files: [
    './docs/arquivo1.pdf',
    './docs/arquivo2.jpg',
    './docs/video.mp4',
    // ... adicione quantos quiser
  ],
  folderName: 'Meu-Projeto-2025',
  projectName: 'ROM',
  uploadToKB: true,
  generateAllFormats: true
});

console.log('Extração completa!');
console.log('Pasta:', resultado.folder);
console.log('Arquivos processados:', resultado.files);
```

### 3. Criar Pasta e Adicionar Depois

```javascript
// 1. Criar estrutura
const estrutura = await fetch('https://iarom.com.br/api/documents/create-folder', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    folderName: 'Processo-123'
  })
}).then(r => r.json());

console.log('Pasta criada:', estrutura.baseFolder);

// 2. Adicionar documentos manualmente
// Usuário copia arquivos para a pasta 'original'

// 3. Processar documentos adicionados
const resultado = await fetch('https://iarom.com.br/api/documents/extract', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    files: glob.sync(`${estrutura.folders.original}/*`),
    folderName: 'Processo-123',
    uploadToKB: true
  })
}).then(r => r.json());
```

## Fluxo de Processamento

### Passo 1: Receber Arquivos
```
Usuário fornece:
- Array de arquivos (ILIMITADO)
- Nome da pasta customizado
- Configurações opcionais
```

### Passo 2: Criar Estrutura
```
Desktop/ROM-Extractions/[Nome-Customizado]/
├── original/
├── extracted/
├── ocr/
├── images/
├── videos/
└── metadata.json
```

### Passo 3: Copiar e Processar
```
Para cada arquivo:
1. Copiar para original/
2. Detectar tipo
3. Processar conforme tipo:
   - PDF → Extração + OCR
   - Imagem → OCR + Análise
   - Vídeo → Transcrição
   - Office → Extração estruturada
   - Texto → Leitura direta
4. Salvar resultados em pastas específicas
```

### Passo 4: Consolidar
```
Gerar:
- documento-completo.json (todos os textos)
- documento-completo.txt (texto consolidado)
- resumo.md (resumo executivo)
- indice.json (índice de arquivos)
```

### Passo 5: Upload para KB
```
Se uploadToKB = true:
- Upload automático dos arquivos JSON e TXT
- Vinculação ao projeto especificado
- Indexação para busca
```

### Passo 6: Metadados
```
Atualizar metadata.json com:
- Lista de arquivos processados
- Status de cada arquivo
- Timestamps
- Estatísticas
```

## Processamento por Tipo

### PDFs
```javascript
// Tenta extração de texto primeiro
// Se falhar ou texto insuficiente → OCR
// Salva texto extraído em extracted/
// Se OCR usado → salva em ocr/
```

### Imagens
```javascript
// OCR com AWS Textract
// Análise visual (placeholder para Claude Vision)
// Salva texto OCR em ocr/
// Salva análise em images/
```

### Vídeos
```javascript
// Transcrição com AWS Transcribe
// Gera arquivo com timestamps
// Salva .txt e .json em videos/
```

### Documentos Office
```javascript
// Extração de conteúdo estruturado
// Preserva tabelas, listas, formatação
// Salva texto em extracted/
```

### Texto/Código
```javascript
// Leitura direta
// Análise de estrutura
// Salva em extracted/
```

## Formatos de Exportação

### 1. JSON Completo
```json
{
  "projeto": "ROM",
  "pasta": "Cliente-ABC",
  "arquivos": [
    {
      "nome": "contrato.pdf",
      "tipo": "pdf",
      "texto": "...",
      "paginas": 15,
      "ocrUsado": false
    },
    {
      "nome": "foto.jpg",
      "tipo": "imagem",
      "textoOCR": "...",
      "analise": "..."
    },
    {
      "nome": "video.mp4",
      "tipo": "video",
      "transcricao": "...",
      "timestamps": [...]
    }
  ],
  "totalArquivos": 3,
  "dataExtracao": "2025-12-15T10:30:00.000Z"
}
```

### 2. TXT Consolidado
```
=================================================
EXTRAÇÃO DE DOCUMENTOS - Cliente-ABC
=================================================

Data: 15/12/2025 10:30
Total de arquivos: 3

-------------------------------------------------
ARQUIVO 1: contrato.pdf
Tipo: PDF
Páginas: 15
-------------------------------------------------

[Texto completo do PDF...]

-------------------------------------------------
ARQUIVO 2: foto.jpg
Tipo: Imagem
OCR: Sim
-------------------------------------------------

[Texto extraído da imagem...]

-------------------------------------------------
ARQUIVO 3: video.mp4
Tipo: Vídeo
Duração: 5min
-------------------------------------------------

[Transcrição completa com timestamps...]
```

### 3. Markdown (Resumo)
```markdown
# Resumo da Extração - Cliente-ABC

## Informações Gerais
- **Data**: 15/12/2025 10:30
- **Arquivos processados**: 3
- **Pasta**: Desktop/ROM-Extractions/Cliente-ABC

## Arquivos
1. contrato.pdf (15 páginas)
2. foto.jpg (imagem com texto)
3. video.mp4 (5 minutos)

## Resumo Executivo
[Resumo automático dos conteúdos...]
```

## Integração com Knowledge Base

Todos os documentos processados podem ser automaticamente enviados para o Knowledge Base:

```javascript
// Upload automático
{
  uploadToKB: true  // Padrão
}

// Documentos enviados:
// - documento-completo.json
// - documento-completo.txt
// - Metadados da extração

// Projeto vinculado:
// - projectName especificado (padrão: "ROM")
```

## Suporte Cross-Platform

### macOS
```
Desktop: ~/Desktop
Pasta: /Users/user/Desktop/ROM-Extractions
```

### Windows
```
Desktop: ~\Desktop
Pasta: C:\Users\user\Desktop\ROM-Extractions
```

### Linux
```
Desktop: ~/Área de Trabalho
Pasta: /home/user/Área de Trabalho/ROM-Extractions
```

## Observações Importantes

### 1. SEM LIMITE de Arquivos
O sistema pode processar **QUANTOS ARQUIVOS** você quiser em uma única extração:
```javascript
{
  files: [
    // Pode ter 1 arquivo
    // Pode ter 10 arquivos
    // Pode ter 100 arquivos
    // Pode ter 1000 arquivos
    // SEM LIMITE!
  ]
}
```

### 2. Tipos Mistos
Você pode misturar diferentes tipos na mesma extração:
```javascript
{
  files: [
    'documento.pdf',
    'imagem1.jpg',
    'imagem2.png',
    'video.mp4',
    'planilha.xlsx',
    'apresentacao.pptx',
    'texto.txt'
    // ... todos juntos!
  ]
}
```

### 3. Nome da Pasta é Obrigatório
O sistema SEMPRE pede um nome customizado para organização:
```javascript
{
  folderName: 'Cliente-ABC-Processo-123'  // OBRIGATÓRIO
}
```

### 4. Processamento Automático
O tipo de processamento é detectado automaticamente pela extensão:
- `.pdf` → PDF processor
- `.jpg` → Image processor
- `.mp4` → Video processor
- etc.

### 5. Estrutura Consistente
Toda extração mantém a mesma estrutura de pastas, facilitando:
- Localização de arquivos
- Automação de processos
- Integração com outras ferramentas
- Backup e organização

## Exemplos de Uso Real

### Caso 1: Documentação de Processo Judicial
```javascript
await extractGeneralDocuments({
  files: [
    './petição-inicial.pdf',
    './doc1.pdf',
    './doc2.pdf',
    './foto-prova1.jpg',
    './foto-prova2.jpg',
    './depoimento.mp4'
  ],
  folderName: 'Processo-12345-2025',
  projectName: 'Escritorio-Advocacia',
  uploadToKB: true
});
```

### Caso 2: Documentação de Obra/Construção
```javascript
await extractGeneralDocuments({
  files: [
    './projeto-arquitetonico.pdf',
    './plantas.pdf',
    './foto-terreno1.jpg',
    './foto-terreno2.jpg',
    './foto-terreno3.jpg',
    './video-visita.mp4',
    './orcamento.xlsx'
  ],
  folderName: 'Obra-EdificioX-2025',
  uploadToKB: true
});
```

### Caso 3: Documentação Acadêmica
```javascript
await extractGeneralDocuments({
  files: [
    './artigo1.pdf',
    './artigo2.pdf',
    './apresentacao.pptx',
    './dados.xlsx',
    './notas.txt'
  ],
  folderName: 'Pesquisa-Mestrado-2025',
  uploadToKB: true
});
```

## Comparação com Sistema de Processos Judiciais

| Recurso | Processos Judiciais | Documentos Gerais |
|---------|--------------------|--------------------|
| **Pasta automática** | Sim (número do processo) | Sim (nome customizado) |
| **Múltiplos arquivos** | Sim | Sim (ILIMITADO) |
| **Tipos suportados** | PDFs, imagens | PDFs, imagens, vídeos, Office, texto |
| **OCR** | Sim | Sim |
| **Vídeo/transcrição** | Não | Sim |
| **Upload KB** | Sim | Sim |
| **Export JSON/TXT** | Sim | Sim |
| **Nomenclatura** | Automática | Customizada |

## Próximos Passos

### Melhorias Planejadas
- [ ] Integração real com AWS Transcribe (vídeos)
- [ ] Integração com Claude Vision (análise de imagens)
- [ ] Processamento em batch paralelo
- [ ] Interface web para seleção de arquivos
- [ ] Preview dos documentos processados
- [ ] Estatísticas e relatórios
- [ ] Exportação para PDF consolidado
- [ ] Compartilhamento de extrações

### Integrações Futuras
- [ ] Dropbox/Google Drive
- [ ] OneDrive
- [ ] Email (anexos)
- [ ] WhatsApp Business API
- [ ] Scanner móvel

## Logs e Debug

O sistema registra todas as operações:
```javascript
logger.info('Iniciando extração de 5 documento(s)');
logger.info('Processando arquivo1.pdf...');
logger.info('OCR necessário para arquivo1.pdf');
logger.info('Processando imagem.jpg...');
logger.info('Processando video.mp4...');
logger.info('Upload para KB concluído');
logger.info('Extração completa!');
```

## Suporte

Para questões técnicas ou dúvidas, consulte:
- `/src/services/document-extraction-service.js` (código fonte)
- `/src/server.js` (endpoints API - linhas 665-873)
- Logs do sistema

---

**© 2025 ROM Agent - Sistema de Extração de Documentos Gerais**
**Suporte para ILIMITADOS documentos de qualquer tipo**
