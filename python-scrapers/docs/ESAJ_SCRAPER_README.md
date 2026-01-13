# ESAJ Scraper - Tribunal de Justica de Sao Paulo

## Visao Geral

O ESAJ Scraper e uma ferramenta profissional para extracao automatizada de dados processuais do sistema e-SAJ do Tribunal de Justica de Sao Paulo (TJSP).

## Funcionalidades

### Busca de Processos
- **Por numero CNJ**: Consulta unificada no formato CNJ (NNNNNNN-DD.AAAA.J.TR.OOOO)
- **Por CPF**: Busca processos onde a pessoa e parte
- **Por CNPJ**: Busca processos onde a empresa e parte
- **Paginacao**: Suporte automatico para resultados paginados
- **Filtros**: Por comarca e vara

### Extracao de Dados

#### 1o Grau (cpopg)
- Numero do processo
- Classe e assunto
- Comarca, foro e vara
- Juiz responsavel
- Data de distribuicao
- Valor da causa
- Area (civel, criminal, etc.)
- Lista de partes (autores, reus, terceiros)
- Advogados de cada parte (com OAB)
- Movimentacoes processuais completas
- Lista de documentos disponiveis
- Audiencias agendadas

#### 2o Grau (cposg)
- Todos os dados do 1o grau
- Orgao julgador
- Desembargador relator
- Turma julgadora
- Acordaos e decisoes

### Download de Documentos
- Peticoes iniciais
- Sentencas
- Decisoes interlocutorias
- Acordaos
- Certidoes
- Identificacao e alerta de documentos sigilosos

### Seguranca e Compliance
- Deteccao automatica de segredo de justica
- Respeito a processos sigilosos
- Rate limiting rigoroso (1 req/s)
- Backoff exponencial em caso de erro
- Deteccao de bloqueio temporario

### Performance
- Cache de consultas (TTL 1 hora)
- Cache persistente em JSON
- Invalidacao de cache sob demanda

## Instalacao

### Requisitos
```bash
pip install requests beautifulsoup4
```

### Requisitos Opcionais (para OCR de CAPTCHA)
```bash
pip install pillow pytesseract
```

## Uso Basico

### Via Python

```python
from esaj_scraper import ESAJScraper

# Inicializa o scraper
scraper = ESAJScraper()

# Busca processo por numero (1o grau)
processo = scraper.buscar_por_numero("1000000-00.2024.8.26.0100", instancia="1")

# Busca processo por numero (2o grau)
processo_2g = scraper.buscar_por_numero("2000000-00.2024.8.26.0000", instancia="2")

# Busca processos por CPF
processos = scraper.buscar_por_cpf("123.456.789-00")

# Busca processos por CNPJ
processos = scraper.buscar_por_cnpj("00.000.000/0001-00")

# Baixa documentos do processo
arquivos = scraper.baixar_documentos(processo, output_dir="./documentos")

# Acessa dados do processo
print(processo.numero_processo)
print(processo.classe)
print(processo.valor_causa)
for parte in processo.partes:
    print(f"{parte['tipo']}: {parte['nome']}")
```

### Via Linha de Comando

```bash
# Buscar processo de 1o grau
python esaj_scraper.py --numero 1000000-00.2024.8.26.0100

# Buscar processo de 2o grau
python esaj_scraper.py --numero 2000000-00.2024.8.26.0000 --instancia 2

# Buscar por CPF
python esaj_scraper.py --cpf 123.456.789-00

# Buscar por CNPJ
python esaj_scraper.py --cnpj 00.000.000/0001-00

# Baixar documentos
python esaj_scraper.py --numero 1000000-00.2024.8.26.0100 --baixar-docs --output ./docs

# Saida em JSON
python esaj_scraper.py --numero 1000000-00.2024.8.26.0100 --json

# Verificar status
python esaj_scraper.py --status

# Limpar cache
python esaj_scraper.py --limpar-cache

# Modo debug
python esaj_scraper.py --numero 1000000-00.2024.8.26.0100 --debug
```

### Funcao Async

```python
import asyncio
from esaj_scraper import extrair_processo_esaj

# Uso async
async def main():
    dados = await extrair_processo_esaj(
        numero_processo="1000000-00.2024.8.26.0100",
        instancia="1",
        baixar_docs=True,
        output_dir="./output"
    )
    print(dados)

asyncio.run(main())
```

## Estrutura de Dados

### ProcessoESAJ

```json
{
  "numero_processo": "1000000-00.2024.8.26.0100",
  "tribunal": "TJSP",
  "sistema": "ESAJ",
  "instancia": "1",
  "comarca": "Sao Paulo",
  "foro": "Foro Central Civel",
  "vara": "1a Vara Civel",
  "classe": "Procedimento Comum Civel",
  "assunto": "Responsabilidade Civil",
  "area": "Civel",
  "data_distribuicao": "2024-01-15",
  "valor_causa": 100000.0,
  "moeda": "BRL",
  "partes": [
    {
      "tipo": "autor",
      "nome": "Joao da Silva",
      "documento": "123.456.789-00",
      "tipo_documento": "CPF",
      "advogados": ["Dr. Advogado 1 (OAB/SP 123456)"]
    }
  ],
  "movimentacoes": [
    {
      "data": "2024-01-15",
      "descricao": "Distribuido por sorteio",
      "documento_vinculado": null
    }
  ],
  "documentos": [
    {
      "tipo": "peticao_inicial",
      "data": "2024-01-15",
      "url": "https://esaj.tjsp.jus.br/...",
      "sigiloso": false
    }
  ],
  "audiencias": [],
  "segredo_justica": false,
  "timestamp_extracao": "2026-01-12T21:45:00Z"
}
```

### Campos de 2o Grau

```json
{
  "instancia": "2",
  "orgao_julgador": "10a Camara de Direito Privado",
  "relator": "Des. Fulano de Tal",
  "turma": null,
  "processo_origem": "1000000-00.2024.8.26.0100"
}
```

## Configuracao

### Parametros do ESAJScraper

```python
scraper = ESAJScraper(
    cache_dir="./cache/esaj",      # Diretorio de cache
    log_dir="./logs",              # Diretorio de logs
    cache_enabled=True,            # Habilitar cache
    cache_ttl=3600,                # TTL do cache em segundos (1 hora)
    rate_limit=1.0,                # Segundos entre requisicoes
    timeout=30,                    # Timeout das requisicoes
    max_retries=3,                 # Tentativas em caso de erro
    log_level=logging.INFO,        # Nivel de log
    verificar_ssl=True             # Verificar certificados SSL
)
```

## Tratamento de Erros

### Excecoes Disponiveis

```python
from esaj_scraper import (
    ESAJError,                # Erro generico
    ESAJConnectionError,      # Erro de conexao
    ESAJCaptchaError,         # CAPTCHA detectado
    ESAJProcessoNaoEncontrado,# Processo nao encontrado
    ESAJSegredoJustica,       # Processo sigiloso
    ESAJValidationError,      # Erro de validacao
)

try:
    processo = scraper.buscar_por_numero("1000000-00.2024.8.26.0100")
except ESAJProcessoNaoEncontrado:
    print("Processo nao encontrado")
except ESAJSegredoJustica:
    print("Processo em segredo de justica")
except ESAJCaptchaError:
    print("CAPTCHA detectado - tente novamente mais tarde")
except ESAJConnectionError:
    print("Erro de conexao com o TJSP")
except ESAJValidationError:
    print("Numero de processo invalido")
```

## Cache

O cache e armazenado em arquivos JSON no diretorio configurado.

### Operacoes de Cache

```python
# Limpar todo o cache
scraper.limpar_cache()

# Verificar tamanho do cache
print(f"Entradas no cache: {scraper.cache.size}")

# Invalidar entrada especifica
scraper.cache.invalidate("processo:1000000-00.2024.8.26.0100:1")
```

## Logs

Os logs sao gravados no diretorio configurado com rotacao automatica.

### Niveis de Log
- DEBUG: Detalhes de cada requisicao
- INFO: Operacoes normais
- WARNING: CAPTCHA detectado, rate limit, etc.
- ERROR: Falhas recuperaveis
- CRITICAL: Falhas criticas

### Formato do Log
```
2026-01-12T21:45:00-0300 | INFO     | esaj_scraper | Buscando processo | numero=1000000-00.2024.8.26.0100
```

## Rate Limiting

O scraper respeita rigorosamente o limite de 1 requisicao por segundo para evitar sobrecarga no servidor do TJSP.

### Backoff Exponencial
Em caso de erro, o scraper aplica backoff exponencial:
- 1o erro: 2s de espera
- 2o erro: 4s de espera
- 3o erro: 8s de espera
- Maximo: 60s

### Deteccao de Bloqueio
Se o servidor retornar 429 (Too Many Requests), o scraper aguarda automaticamente antes de tentar novamente.

## CAPTCHA

O ESAJ pode apresentar CAPTCHA em algumas consultas.

### Deteccao Automatica
O scraper detecta automaticamente a presenca de CAPTCHA.

### Resolucao OCR (Opcional)
Se `pytesseract` estiver instalado, o scraper tenta resolver CAPTCHAs simples automaticamente.

### Fallback Manual
Se a resolucao automatica falhar, o scraper pode solicitar intervencao manual (modo CLI).

## Troubleshooting

### "Processo nao encontrado"
- Verifique se o numero esta correto (formato CNJ)
- Confirme a instancia (1o ou 2o grau)
- O processo pode ter sido migrado ou arquivado

### "CAPTCHA detectado"
- Aguarde alguns minutos e tente novamente
- O TJSP pode estar sob alta demanda
- Considere usar horarios de menor movimento

### "Erro de conexao"
- Verifique sua conexao com a internet
- O servidor do TJSP pode estar indisponivel
- Tente novamente em alguns minutos

### "Segredo de justica"
- O processo e sigiloso
- Acesso apenas para partes e advogados cadastrados
- O scraper nao tenta acessar dados restritos

### Rate limit excedido
- O scraper ja gerencia isso automaticamente
- Se necessario, aumente o intervalo entre requisicoes

## Testes

### Executar Testes Unitarios
```bash
python -m unittest tests.test_esaj_scraper -v
```

### Cobertura de Testes
Os testes cobrem:
- Validacao de numeros (CNJ, CPF, CNPJ)
- Parsing de dados (valores, datas, HTML)
- Dataclasses e conversoes
- Sistema de cache
- Rate limiter
- Handler de CAPTCHA
- Tratamento de excecoes
- Performance

## Endpoints Mapeados

### 1o Grau (cpopg)
- `https://esaj.tjsp.jus.br/cpopg/open.do` - Pagina inicial
- `https://esaj.tjsp.jus.br/cpopg/search.do` - Busca de processos
- `https://esaj.tjsp.jus.br/cpopg/show.do` - Detalhes do processo

### 2o Grau (cposg)
- `https://esaj.tjsp.jus.br/cposg/open.do` - Pagina inicial
- `https://esaj.tjsp.jus.br/cposg/search.do` - Busca de recursos
- `https://esaj.tjsp.jus.br/cposg/show.do` - Detalhes do recurso

## Licenca

Este scraper e fornecido para uso educacional e de pesquisa juridica. O uso deve respeitar os termos de uso do TJSP e as normas de acesso a informacoes processuais.

## Contato

Para suporte ou duvidas, consulte a documentacao do ROM-Agent ou abra uma issue no repositorio.
