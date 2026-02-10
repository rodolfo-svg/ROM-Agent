# ROM Agent v2.0 - Script de Instalação para Windows (PowerShell)
#
# Execute como Administrador:
# powershell -ExecutionPolicy Bypass -File setup-extracao-v2.ps1

param(
    [switch]$SkipTest = $false
)

# Cores para output
$ColorReset = "`e[0m"
$ColorRed = "`e[31m"
$ColorGreen = "`e[32m"
$ColorYellow = "`e[33m"
$ColorBlue = "`e[34m"
$ColorCyan = "`e[36m"
$ColorBold = "`e[1m"

function Print-Header {
    param([string]$Message)
    Write-Host ""
    Write-Host "$ColorCyan===============================================================$ColorReset"
    Write-Host "$ColorCyan$ColorBold $Message$ColorReset"
    Write-Host "$ColorCyan===============================================================$ColorReset"
    Write-Host ""
}

function Print-Success {
    param([string]$Message)
    Write-Host "$ColorGreen✓$ColorReset $Message"
}

function Print-Error {
    param([string]$Message)
    Write-Host "$ColorRed✗$ColorReset $Message"
}

function Print-Warning {
    param([string]$Message)
    Write-Host "$ColorYellow⚠$ColorReset $Message"
}

function Print-Info {
    param([string]$Message)
    Write-Host "$ColorBlue ℹ$ColorReset $Message"
}

# Banner
Clear-Host
Write-Host "$ColorCyan"
Write-Host "╔═══════════════════════════════════════════════════════════════╗"
Write-Host "║                    ROM AGENT v2.0                              ║"
Write-Host "║               EXTRAÇÃO COM 18 FICHEIROS                       ║"
Write-Host "║                    SETUP WINDOWS                              ║"
Write-Host "╚═══════════════════════════════════════════════════════════════╝"
Write-Host "$ColorReset"
Start-Sleep -Seconds 1

# 1. Verificar Windows
Print-Header "1. VERIFICANDO SISTEMA OPERACIONAL"
$OSInfo = Get-CimInstance Win32_OperatingSystem
Print-Success "Windows detectado: $($OSInfo.Caption)"
Print-Info "Versão: $($OSInfo.Version)"
Print-Info "Usuário: $env:USERNAME"

# 2. Verificar Node.js
Print-Header "2. VERIFICANDO NODE.JS E NPM"

try {
    $NodeVersion = node --version 2>$null
    if ($NodeVersion) {
        Print-Success "Node.js instalado: $NodeVersion"

        $NodeMajor = [int]($NodeVersion -replace 'v(\d+)\..*','$1')
        if ($NodeMajor -lt 18) {
            Print-Warning "Node.js v18+ recomendado. Versão atual: $NodeVersion"
        }
    } else {
        throw "Node.js não encontrado"
    }
} catch {
    Print-Error "Node.js não encontrado!"
    Print-Info "Instale Node.js 18+ de: https://nodejs.org/"
    Print-Info "Ou use: winget install OpenJS.NodeJS.LTS"
    exit 1
}

try {
    $NpmVersion = npm --version 2>$null
    if ($NpmVersion) {
        Print-Success "npm instalado: v$NpmVersion"
    }
} catch {
    Print-Error "npm não encontrado!"
    exit 1
}

# 3. Verificar Python (opcional)
Print-Header "3. VERIFICANDO PYTHON (OPCIONAL)"

try {
    $PythonVersion = python --version 2>$null
    if ($PythonVersion) {
        Print-Success "Python instalado: $PythonVersion"
    }
} catch {
    Print-Warning "Python não encontrado (opcional para scrapers)"
    Print-Info "Instale de: https://www.python.org/downloads/"
}

# 4. Verificar AWS CLI (opcional)
Print-Header "4. VERIFICANDO AWS CLI (OPCIONAL)"

try {
    $AwsVersion = aws --version 2>$null
    if ($AwsVersion) {
        Print-Success "AWS CLI instalado: $AwsVersion"
    }
} catch {
    Print-Warning "AWS CLI não encontrado (opcional)"
    Print-Info "Instale de: https://aws.amazon.com/cli/"
}

# 5. Criar diretórios de saída
Print-Header "5. CRIANDO DIRETÓRIOS DE SAÍDA"

# Detectar melhor localização (Windows)
$DesktopPath = [Environment]::GetFolderPath("Desktop")
$DocumentsPath = [Environment]::GetFolderPath("MyDocuments")

if (Test-Path $DesktopPath) {
    $OutputBase = Join-Path $DesktopPath "ROM-Extractions-v2"
    Print-Info "Usando Desktop para saídas"
} elseif (Test-Path $DocumentsPath) {
    $OutputBase = Join-Path $DocumentsPath "ROM-Extractions-v2"
    Print-Info "Usando Documentos para saídas"
} else {
    $OutputBase = Join-Path $env:USERPROFILE "ROM-Extractions-v2"
    Print-Info "Usando perfil do usuário para saídas"
}

New-Item -ItemType Directory -Force -Path $OutputBase | Out-Null
Print-Success "Diretório de saída criado: $OutputBase"

# Criar diretórios de trabalho
$WorkDirs = @(
    "temp\uploads",
    "logs",
    "data\extractions",
    "data\processos-extraidos"
)

foreach ($dir in $WorkDirs) {
    New-Item -ItemType Directory -Force -Path $dir | Out-Null
    Print-Success "Criado: $dir"
}

# 6. Configurar variáveis de ambiente
Print-Header "6. CONFIGURANDO VARIÁVEIS DE AMBIENTE"

$EnvFile = ".env"
$CreateEnv = $false

if (Test-Path $EnvFile) {
    Print-Warning "Arquivo .env já existe"
    $response = Read-Host "Deseja sobrescrever? (s/n)"
    if ($response -eq 's' -or $response -eq 'S') {
        $BackupName = ".env.backup.$(Get-Date -Format 'yyyyMMdd_HHmmss')"
        Move-Item $EnvFile $BackupName
        Print-Info "Backup criado: $BackupName"
        $CreateEnv = $true
    } else {
        Print-Info "Mantendo .env existente"
    }
} else {
    $CreateEnv = $true
}

if ($CreateEnv) {
    $EnvContent = @"
# ROM Agent v2.0 - Configuração de Ambiente
# Gerado automaticamente em $(Get-Date)

# AWS Bedrock (obrigatório para análise com IA)
AWS_ACCESS_KEY_ID=your_access_key_here
AWS_SECRET_ACCESS_KEY=your_secret_key_here
AWS_REGION=us-east-1

# Configurações do sistema
NODE_ENV=development
PORT=3000

# Diretório de saída para extrações (Windows)
OUTPUT_BASE_DIR=$($OutputBase -replace '\\','/')

# Configurações de modelos
DEFAULT_EXTRACTION_MODEL=haiku
DEFAULT_ANALYSIS_MODEL=sonnet

# Configurações de processamento
MAX_FILE_SIZE_MB=50
MAX_CONCURRENT_JOBS=5

# Knowledge Base (opcional)
KNOWLEDGE_BASE_ENABLED=false
KNOWLEDGE_BASE_ID=

# Logs
LOG_LEVEL=info
LOG_FILE=logs/extraction.log
"@

    Set-Content -Path $EnvFile -Value $EnvContent -Encoding UTF8
    Print-Success "Arquivo .env criado"
    Print-Warning "IMPORTANTE: Configure suas credenciais AWS no arquivo .env"
}

# 7. Instalar dependências npm
Print-Header "7. INSTALANDO DEPENDÊNCIAS NPM"

if (Test-Path "package.json") {
    Print-Info "Instalando pacotes..."
    npm install
    Print-Success "Dependências instaladas"
} else {
    Print-Error "package.json não encontrado!"
    Print-Info "Certifique-se de estar no diretório ROM-Agent"
    exit 1
}

# 8. Verificar dependências críticas
Print-Header "8. VERIFICANDO DEPENDÊNCIAS CRÍTICAS"

$CriticalDeps = @(
    "@aws-sdk/client-bedrock-runtime",
    "express",
    "multer"
)

foreach ($dep in $CriticalDeps) {
    try {
        npm list $dep 2>$null | Out-Null
        if ($LASTEXITCODE -eq 0) {
            Print-Success "$dep instalado"
        } else {
            Print-Warning "$dep não encontrado"
        }
    } catch {
        Print-Warning "$dep não encontrado"
    }
}

# 9. Testar módulos
Print-Header "9. TESTANDO MÓDULOS"

Print-Info "Verificando módulos de extração..."

$CriticalFiles = @(
    "src\services\entidades-extractor.js",
    "src\services\analise-juridica-profunda.js",
    "src\services\gerador-18-ficheiros.js",
    "src\services\document-extraction-service.js",
    "src\routes\extraction-v2.js",
    "scripts\test-extraction-v2.js"
)

$AllFilesOk = $true
foreach ($file in $CriticalFiles) {
    if (Test-Path $file) {
        Print-Success $file
    } else {
        Print-Error "$file NÃO ENCONTRADO"
        $AllFilesOk = $false
    }
}

if (-not $AllFilesOk) {
    Print-Error "Alguns arquivos críticos estão faltando!"
    exit 1
}

# 10. Criar arquivo de configuração
Print-Header "10. CRIANDO CONFIGURAÇÃO DO SISTEMA"

New-Item -ItemType Directory -Force -Path "config" | Out-Null

$ConfigContent = @{
    version = "2.0"
    system = @{
        os = "Windows"
        user = $env:USERNAME
        homeDir = $env:USERPROFILE
        outputBaseDir = $OutputBase
    }
    paths = @{
        temp = "temp/uploads"
        logs = "logs"
        extractions = "data/extractions"
        processos = "data/processos-extraidos"
    }
    models = @{
        extraction = "haiku"
        analysis = "sonnet"
    }
    limits = @{
        maxFileSizeMB = 50
        maxConcurrentJobs = 5
        timeoutSeconds = 600
    }
    features = @{
        uploadToKB = $false
        asyncProcessing = $true
        generateAll18Files = $true
    }
    installedAt = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
}

$ConfigContent | ConvertTo-Json -Depth 10 | Set-Content "config\extraction-v2.json" -Encoding UTF8
Print-Success "Configuração criada: config\extraction-v2.json"

# 11. Resumo final
Print-Header "11. RESUMO DA INSTALAÇÃO"

Write-Host ""
Write-Host "$ColorBold INSTALAÇÃO CONCLUÍDA COM SUCESSO!$ColorReset"
Write-Host ""
Write-Host "$ColorCyan Configurações:$ColorReset"
Write-Host "  • Diretório de saída: $ColorGreen$OutputBase$ColorReset"
Write-Host "  • Logs: ${ColorGreen}logs\extraction.log$ColorReset"
Write-Host "  • Configuração: $ColorGreen$EnvFile$ColorReset"
Write-Host ""
Write-Host "$ColorCyan Próximos passos:$ColorReset"
Write-Host ""
Write-Host "${ColorYellow}1.$ColorReset Configure suas credenciais AWS no arquivo ${ColorBold}.env$ColorReset:"
Write-Host "   ${ColorBlue}notepad .env$ColorReset"
Write-Host ""
Write-Host "${ColorYellow}2.$ColorReset Teste o sistema com um documento:"
Write-Host "   ${ColorBlue}node scripts\test-extraction-v2.js C:\caminho\documento.pdf$ColorReset"
Write-Host ""
Write-Host "${ColorYellow}3.$ColorReset Ou inicie o servidor:"
Write-Host "   ${ColorBlue}npm start$ColorReset"
Write-Host ""
Write-Host "${ColorYellow}4.$ColorReset Leia a documentação:"
Write-Host "   ${ColorBlue}notepad EXTRACAO-V2-README.md$ColorReset"
Write-Host ""

if ((Get-Content $EnvFile -Raw) -match "your_access_key_here") {
    Write-Host "$ColorRed⚠ ATENÇÃO:$ColorReset Configure as credenciais AWS antes de usar o sistema!"
    Write-Host ""
}

Print-Info "Para mais informações, consulte: EXTRACAO-V2-README.md"
Write-Host ""

if (-not $SkipTest) {
    $testResponse = Read-Host "Deseja executar um teste rápido do sistema? (s/n)"
    if ($testResponse -eq 's' -or $testResponse -eq 'S') {
        Print-Header "EXECUTANDO TESTE RÁPIDO"

        $PdfFiles = Get-ChildItem -Path . -Filter *.pdf -File
        if ($PdfFiles.Count -gt 0) {
            $TestPdf = $PdfFiles[0].FullName
            Print-Info "Encontrado PDF para teste: $TestPdf"
            Print-Warning "Isso consumirá créditos AWS se configurado!"

            $continueTest = Read-Host "Continuar com o teste? (s/n)"
            if ($continueTest -eq 's' -or $continueTest -eq 'S') {
                $TestFolder = "Teste_Setup_$(Get-Date -Format 'yyyyMMdd_HHmmss')"
                node scripts\test-extraction-v2.js $TestPdf $TestFolder
            }
        } else {
            Print-Info "Nenhum PDF encontrado no diretório atual para teste"
            Print-Info "Execute manualmente: node scripts\test-extraction-v2.js <arquivo.pdf>"
        }
    }
}

Write-Host ""
Print-Success "Setup concluído! Sistema pronto para uso."
Write-Host ""
