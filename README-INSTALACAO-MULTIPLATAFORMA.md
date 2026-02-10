# ROM Agent v2.0 - Instalação Multi-Plataforma

## 🌍 SUPORTE COMPLETO

O sistema funciona em:
- ✅ **Windows** 10/11
- ✅ **macOS** (Intel e Apple Silicon)
- ✅ **Linux** (Ubuntu, Debian, Fedora, CentOS, Arch)

---

## 📦 MÉTODO 1: INSTALAÇÃO AUTOMÁTICA

### 🪟 Windows

```powershell
# 1. Abrir PowerShell como Administrador
# 2. Navegar até a pasta ROM-Agent
cd C:\caminho\para\ROM-Agent

# 3. Executar script de instalação
powershell -ExecutionPolicy Bypass -File scripts\setup-extracao-v2.ps1
```

**Resultado**: Sistema configurado automaticamente com:
- Verificação de Node.js 18+
- Instalação de dependências
- Criação de diretórios
- Configuração do .env
- Detecção automática do Desktop/Documents

---

### 🍎 macOS

```bash
# 1. Abrir Terminal
# 2. Navegar até a pasta ROM-Agent
cd /caminho/para/ROM-Agent

# 3. Executar script de instalação
bash scripts/setup-extracao-v2.sh
```

**Resultado**: Sistema configurado com:
- Verificação de Node.js, Python, AWS CLI
- Instalação automática de dependências
- Detecção automática do Desktop
- Configuração completa

---

### 🐧 Linux

```bash
# 1. Abrir Terminal
# 2. Navegar até a pasta ROM-Agent
cd /caminho/para/ROM-Agent

# 3. Executar script de instalação
bash scripts/setup-extracao-v2-linux.sh
```

**Suporta**:
- Ubuntu/Debian (apt-get)
- Fedora/CentOS/RHEL (dnf/yum)
- Arch Linux (pacman)

**Instala automaticamente**: Node.js se não estiver presente

---

## 📦 MÉTODO 2: PACOTE PARA WHATSAPP

### Criar Pacote ZIP

```bash
# Gerar pacote otimizado (< 100MB)
cd ROM-Agent
bash scripts/criar-pacote-whatsapp.sh
```

**Saída**: `ROM-Agent-v2-Extracao-18-Ficheiros-[TIMESTAMP].zip`

### Distribuir

1. Envie o ZIP via WhatsApp, Telegram, Email
2. Receptor extrai o arquivo
3. Receptor executa o script de setup para seu SO
4. Sistema pronto para uso!

---

## ⚙️ CONFIGURAÇÃO PÓS-INSTALAÇÃO

### 1. Configurar AWS Bedrock

Edite o arquivo `.env`:

**Windows**:
```powershell
notepad .env
```

**macOS/Linux**:
```bash
nano .env
# ou
vim .env
```

Configure suas credenciais:
```env
AWS_ACCESS_KEY_ID=sua_chave_aqui
AWS_SECRET_ACCESS_KEY=sua_chave_secreta_aqui
AWS_REGION=us-east-1
```

### 2. Testar o Sistema

**Todos os sistemas**:
```bash
node scripts/test-extraction-v2.js /caminho/documento.pdf
```

---

## 📂 DIRETÓRIOS DE SAÍDA (Detecção Automática)

### Windows
- **Preferência 1**: `C:\Users\[Usuario]\Desktop\ROM-Extractions-v2\`
- **Preferência 2**: `C:\Users\[Usuario]\Documents\ROM-Extractions-v2\`
- **Fallback**: `C:\Users\[Usuario]\ROM-Extractions-v2\`

### macOS
- **Preferência 1**: `/Users/[usuario]/Desktop/ROM-Extractions-v2/`
- **Preferência 2**: `/Users/[usuario]/Documents/ROM-Extractions-v2/`
- **Fallback**: `/Users/[usuario]/ROM-Extractions-v2/`

### Linux
- **Preferência 1**: `/home/[usuario]/Desktop/ROM-Extractions-v2/`
- **Preferência 2**: `/home/[usuario]/Área de Trabalho/ROM-Extractions-v2/`
- **Preferência 3**: `/home/[usuario]/Documents/ROM-Extractions-v2/`
- **Fallback**: `/home/[usuario]/ROM-Extractions-v2/`

**Configuração manual**: Defina `OUTPUT_BASE_DIR` no arquivo `.env`

---

## 🚀 COMO USAR APÓS INSTALAÇÃO

### Via CLI (Linha de Comando)

```bash
# Extrair um documento
node scripts/test-extraction-v2.js /caminho/documento.pdf Nome_Pasta_Saida

# Exemplo Windows:
node scripts\test-extraction-v2.js C:\Users\User\Documents\peticao.pdf Peticao_Caso_ABC

# Exemplo macOS/Linux:
node scripts/test-extraction-v2.js ~/Documents/peticao.pdf Peticao_Caso_ABC
```

### Via API REST

```bash
# 1. Iniciar servidor
npm start

# 2. Fazer requisição (Windows PowerShell)
$file = "C:\caminho\documento.pdf"
Invoke-RestMethod -Uri http://localhost:3000/api/extraction/v2/extract `
  -Method Post -Form @{file=Get-Item $file; async='true'}

# 2. Fazer requisição (macOS/Linux)
curl -X POST http://localhost:3000/api/extraction/v2/extract \
  -F "file=@/caminho/documento.pdf" \
  -F "async=true"
```

### Via JavaScript

```javascript
import { extractDocumentWithFullAnalysis } from './src/services/document-extraction-service.js';

// Funciona em todos os SOs
const resultado = await extractDocumentWithFullAnalysis({
  filePath: '/caminho/documento.pdf',  // Ajustar para o SO
  outputFolderName: 'Caso_XYZ_2026'
});

console.log('Saída:', resultado.pastaBase);
```

---

## 🔧 REQUISITOS DO SISTEMA

### Todos os sistemas operacionais

| Requisito | Mínimo | Recomendado |
|-----------|--------|-------------|
| **Node.js** | 16.x | 18.x ou superior |
| **RAM** | 4 GB | 8 GB+ |
| **Disco** | 5 GB livre | 10 GB+ |
| **Internet** | Necessária | Banda larga |

### Windows
- Windows 10 ou superior
- PowerShell 5.1+

### macOS
- macOS 10.15 (Catalina) ou superior
- Terminal

### Linux
- Kernel 4.x ou superior
- Distribuições suportadas: Ubuntu, Debian, Fedora, CentOS, Arch

---

## 💰 CUSTOS ESTIMADOS (AWS Bedrock)

| Tamanho do Documento | Custo Estimado | Tempo |
|----------------------|----------------|-------|
| Pequeno (< 10 págs) | $0.05-$0.15 | 30-60s |
| Médio (10-50 págs) | $0.15-$0.50 | 1-3min |
| Grande (50-200 págs) | $0.50-$2.00 | 3-10min |
| Muito Grande (> 200 págs) | $2.00-$5.00 | 10-30min |

**Estratégia de custos**:
- **Haiku** (barato): Extração, normalização, entidades
- **Sonnet** (premium): Análises jurídicas, resumos, riscos

---

## 🐛 TROUBLESHOOTING

### Windows

**Erro: Execução de scripts desabilitada**
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

**Erro: Node não encontrado**
```powershell
# Instalar via winget
winget install OpenJS.NodeJS.LTS

# Ou baixar de: https://nodejs.org/
```

### macOS

**Erro: Permissão negada**
```bash
chmod +x scripts/*.sh
```

**Erro: Node não encontrado**
```bash
# Instalar via Homebrew
brew install node

# Ou via nvm
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
nvm install 18
```

### Linux

**Erro: Node não encontrado**
```bash
# Ubuntu/Debian
curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
sudo apt-get install -y nodejs

# Fedora/CentOS
curl -fsSL https://rpm.nodesource.com/setup_lts.x | sudo bash -
sudo dnf install -y nodejs

# Arch
sudo pacman -S nodejs npm
```

**Erro: AWS CLI não encontrado**
```bash
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
unzip awscliv2.zip
sudo ./aws/install
```

### Todos os SOs

**Erro: "Bedrock not configured"**
- Verifique credenciais no `.env`
- Teste: `aws sts get-caller-identity`
- Configure: `aws configure`

**Erro: Out of memory**
```bash
# Aumentar limite de memória
node --max-old-space-size=4096 scripts/test-extraction-v2.js documento.pdf
```

---

## 📚 DOCUMENTAÇÃO ADICIONAL

- **`EXTRACAO-V2-README.md`** - Manual completo do sistema
- **`IMPLEMENTACAO-COMPLETA.md`** - Detalhes técnicos da implementação
- **`18_indice_navegacao.md`** - Gerado em cada extração (guia dos 18 ficheiros)

---

## 📞 SUPORTE

### Logs

**Windows**: `logs\extraction.log`
**macOS/Linux**: `logs/extraction.log`

### Verificar Status

```bash
# Ver últimas 50 linhas do log
tail -50 logs/extraction.log  # macOS/Linux
Get-Content logs\extraction.log -Tail 50  # Windows PowerShell
```

---

## 🎯 PRÓXIMOS PASSOS

1. ✅ Execute o script de instalação para seu SO
2. ✅ Configure AWS Bedrock no `.env`
3. ✅ Teste com um documento: `node scripts/test-extraction-v2.js documento.pdf`
4. ✅ Veja os 18 ficheiros gerados em `ROM-Extractions-v2/`
5. ✅ Leia `18_indice_navegacao.md` para entender a estrutura

---

## ⭐ RECURSOS DO SISTEMA

- ✅ **18 ficheiros completos** por documento
- ✅ **Análise jurídica profunda** com IA
- ✅ **Extração de entidades** (partes, valores, datas, leis)
- ✅ **Resumos executivos** em múltiplos níveis
- ✅ **Análise de risco** com recomendações
- ✅ **Classificação automática** de documentos
- ✅ **Cronologia de eventos**
- ✅ **Detecção automática** de SO e diretórios
- ✅ **Multi-plataforma** (Windows, macOS, Linux)
- ✅ **API REST** completa
- ✅ **Processamento assíncrono**

---

**ROM Agent v2.0** - Sistema Multi-Plataforma de Extração com Análise Profunda
© 2026 - Todos os direitos reservados
