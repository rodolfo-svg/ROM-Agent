# PJe Scraper - Justica Federal (TRF1-5)

## Visao Geral

O PJe Scraper e uma ferramenta profissional para extracao automatizada de dados processuais do sistema PJe (Processo Judicial Eletronico) da Justica Federal brasileira, cobrindo todos os cinco Tribunais Regionais Federais (TRF1 a TRF5).

## Caracteristicas Principais

### Autenticacao
- **Certificado Digital A1**: Suporte a arquivos .pfx/.p12
- **Certificado Digital A3**: Suporte via token/smartcard (requer OpenSSL)
- **Usuario/Senha**: Login alternativo quando disponivel
- **Cache de Sessao**: Reutilizacao de sessoes autenticadas (TTL 1 hora)
- **Gerenciamento de Expiracao**: Verificacao automatica de validade do certificado

### Busca Unificada
- **Por Numero CNJ**: Auto-deteccao do TRF pelo numero do processo
- **Por CPF**: Busca processos onde a pessoa e parte
- **Por CNPJ**: Busca processos onde a empresa e parte
- **Por OAB**: Busca processos por advogado
- **Multi-TRF**: Busca simultanea em todos os TRFs

### Extracao de Dados
- Dados basicos do processo (classe, assunto, valor da causa)
- Partes processuais (autores, reus, terceiros interessados)
- Advogados com OAB
- Linha do tempo completa de movimentacoes
- Lista de documentos com metadados
- Intimacoes pendentes com prazos

### Download de Documentos
- Download de peticoes, sentencas, decisoes
- Validacao de integridade (MD5 e SHA256)
- Suporte a documentos PDF

### Resiliencia
- **Retry com Backoff Exponencial**: 2^n segundos (maximo 3 tentativas)
- **Circuit Breaker**: Protecao contra falhas em cascata
- **Rate Limiting**: 1 requisicao por segundo (rigoroso)
- **Fallback entre TRFs**: Se aplicavel

## Tribunais Suportados

| TRF | URL Base | Estados Cobertos |
|-----|----------|------------------|
| TRF1 | https://pje1g.trf1.jus.br | DF, GO, MT, TO, AC, AM, AP, BA, MA, MG, PA, PI, RO, RR |
| TRF2 | https://pje.trf2.jus.br | RJ, ES |
| TRF3 | https://pje1g.trf3.jus.br | SP, MS |
| TRF4 | https://pje1g.trf4.jus.br | PR, RS, SC |
| TRF5 | https://pje.trf5.jus.br | AL, CE, PB, PE, RN, SE |

## Instalacao

### Requisitos Minimos
```bash
pip install requests beautifulsoup4
```

### Requisitos Completos (com certificado digital)
```bash
pip install requests beautifulsoup4 cryptography pyOpenSSL
```

## Uso Basico

### Via Python

```python
from pje_scraper import PJeScraper

# Inicializa o scraper
scraper = PJeScraper()

# Busca processo por numero (auto-detecta TRF)
processo = scraper.buscar_por_numero("0000001-23.2024.4.01.3400")

# Busca em TRF especifico
processo = scraper.buscar_por_numero("0000001-23.2024.4.01.3400", trf="TRF1")

# Acessa dados do processo
print(processo.numero_processo)
print(processo.classe)
print(processo.valor_causa)
print(processo.orgao_julgador)

# Lista partes
for parte in processo.partes:
    print(f"{parte['tipo']}: {parte['nome']}")

# Lista movimentacoes
for mov in processo.movimentacoes:
    print(f"{mov['data']}: {mov['descricao']}")
```

### Busca por Documentos

```python
# Busca por CPF
processos = scraper.buscar_por_cpf("123.456.789-00")

# Busca por CNPJ
processos = scraper.buscar_por_cnpj("00.000.000/0001-00")

# Busca por OAB
processos = scraper.buscar_por_oab("12345", "SP")

# Busca em TRF especifico
processos = scraper.buscar_por_cpf("123.456.789-00", trf="TRF1")
```

### Login com Certificado Digital

```python
# Inicializa com certificado
scraper = PJeScraper(
    certificado_path="/caminho/certificado.pfx",
    certificado_senha="senha_do_certificado"
)

# Login automatico ao buscar (se necessario)
processo = scraper.buscar_por_numero("0000001-23.2024.4.01.3400")

# Login manual
scraper.login("TRF1")

# Extrair intimacoes (requer autenticacao)
intimacoes = scraper.extrair_intimacoes("0000001-23.2024.4.01.3400")
```

### Login com Usuario/Senha

```python
scraper = PJeScraper()

# Login com CPF e senha
scraper.login("TRF1", usuario="12345678900", senha="minha_senha")
```

### Download de Documentos

```python
# Busca processo
processo = scraper.buscar_por_numero("0000001-23.2024.4.01.3400")

# Baixa todos os documentos
arquivos = scraper.baixar_documentos(processo, output_dir="./documentos")

# Baixa tipos especificos
arquivos = scraper.baixar_documentos(
    processo,
    output_dir="./documentos",
    tipos=["peticao_inicial", "sentenca"]
)

# Baixa documento individual
scraper.baixar_documento(
    doc_id="12345",
    output_path="./documentos/peticao.pdf",
    trf="TRF1"
)
```

### Via Linha de Comando

```bash
# Buscar processo (auto-detecta TRF)
python pje_scraper.py --numero 0000001-23.2024.4.01.3400

# Buscar em TRF especifico
python pje_scraper.py --numero 0000001-23.2024.4.01.3400 --trf TRF1

# Buscar por CPF
python pje_scraper.py --cpf 123.456.789-00

# Buscar por CNPJ
python pje_scraper.py --cnpj 00.000.000/0001-00

# Buscar por OAB
python pje_scraper.py --oab-numero 12345 --oab-estado SP

# Com certificado digital
python pje_scraper.py --cert /caminho/certificado.pfx --cert-senha senha --numero 0000001-23.2024.4.01.3400

# Baixar documentos
python pje_scraper.py --numero 0000001-23.2024.4.01.3400 --baixar-docs --output ./docs

# Saida em JSON
python pje_scraper.py --numero 0000001-23.2024.4.01.3400 --json

# Health check
python pje_scraper.py --health-check

# Verificar status de todos TRFs
python pje_scraper.py --status

# Modo debug
python pje_scraper.py --numero 0000001-23.2024.4.01.3400 --debug

# Limpar cache
python pje_scraper.py --limpar-cache
```

### Funcao Async

```python
import asyncio
from pje_scraper import extrair_processo_pje

async def main():
    dados = await extrair_processo_pje(
        numero_processo="0000001-23.2024.4.01.3400",
        baixar_docs=True,
        output_dir="./output"
    )
    print(dados)

asyncio.run(main())
```

## Estrutura de Dados

### ProcessoPJe

```json
{
  "numero_processo": "0000001-23.2024.4.01.3400",
  "tribunal": "TRF1",
  "sistema": "PJe",
  "instancia": "1",
  "classe": "Procedimento Comum",
  "assunto": "Contribuicoes Sociais",
  "valor_causa": 50000.0,
  "moeda": "BRL",
  "orgao_julgador": "1a Vara Federal de Brasilia",
  "vara": "1a Vara Federal",
  "secao_judiciaria": "SJDF",
  "data_distribuicao": "2024-01-15",
  "data_autuacao": "2024-01-15",
  "ultima_atualizacao": "2024-01-20",
  "partes": [
    {
      "tipo": "autor",
      "nome": "Empresa XYZ Ltda",
      "documento": "00.000.000/0001-00",
      "tipo_documento": "CNPJ",
      "advogados": [
        {
          "nome": "Dr. Advogado Teste",
          "oab_numero": "12345",
          "oab_estado": "DF"
        }
      ]
    },
    {
      "tipo": "reu",
      "nome": "Uniao Federal",
      "documento": null,
      "tipo_documento": null,
      "advogados": []
    }
  ],
  "advogados": [
    {
      "nome": "Dr. Advogado Teste",
      "oab_numero": "12345",
      "oab_estado": "DF",
      "email": null
    }
  ],
  "movimentacoes": [
    {
      "data": "2024-01-15",
      "hora": "14:30:00",
      "descricao": "Distribuido por sorteio",
      "tipo": null,
      "responsavel": "Sistema",
      "documento_vinculado": null
    }
  ],
  "documentos": [
    {
      "id": "12345",
      "tipo": "peticao_inicial",
      "nome": "Peticao Inicial",
      "data": "2024-01-15",
      "url": "/pje/documento.seam?idDoc=12345",
      "sigiloso": false
    }
  ],
  "intimacoes": [
    {
      "tipo": "vista",
      "status": "pendente",
      "data_disponibilizacao": "2024-01-20",
      "prazo_dias": 15,
      "data_limite": "2024-02-05",
      "descricao": "Prazo para manifestacao"
    }
  ],
  "segredo_justica": false,
  "justica_gratuita": false,
  "situacao": "ativo",
  "timestamp_extracao": "2026-01-12T15:30:00Z"
}
```

## Configuracao Avancada

### Parametros do PJeScraper

```python
scraper = PJeScraper(
    # Certificado digital
    certificado_path="/caminho/certificado.pfx",
    certificado_senha="senha",

    # Cache
    cache_dir="./cache/pje",
    cache_enabled=True,

    # Logs
    log_dir="./logs",
    log_level=logging.INFO,

    # Requisicoes
    rate_limit=1.0,        # Segundos entre requisicoes
    timeout=30,            # Timeout em segundos
    max_retries=3,         # Tentativas maximas
    verificar_ssl=True,    # Verificar certificados SSL
)
```

## Tratamento de Erros

### Excecoes Disponiveis

```python
from pje_scraper import (
    PJeError,                    # Erro generico
    PJeConnectionError,          # Erro de conexao
    PJeAuthenticationError,      # Erro de autenticacao
    PJeCertificateError,         # Erro de certificado
    PJeProcessoNaoEncontrado,    # Processo nao encontrado
    PJeSegredoJustica,           # Processo sigiloso
    PJeRateLimitError,           # Rate limit excedido
    PJeValidationError,          # Erro de validacao
    PJeCircuitBreakerOpenError,  # Circuit breaker aberto
)

try:
    processo = scraper.buscar_por_numero("0000001-23.2024.4.01.3400")
except PJeProcessoNaoEncontrado:
    print("Processo nao encontrado")
except PJeSegredoJustica:
    print("Processo em segredo de justica")
except PJeAuthenticationError:
    print("Erro de autenticacao - verifique credenciais")
except PJeCertificateError:
    print("Certificado invalido ou expirado")
except PJeConnectionError:
    print("Erro de conexao com o PJe")
except PJeCircuitBreakerOpenError:
    print("Servico temporariamente indisponivel")
except PJeValidationError:
    print("Numero de processo invalido")
```

## Sistema de Cache

O cache utiliza dois TTLs diferentes:
- **Sessao**: 1 hora (autenticacao)
- **Consultas**: 30 minutos (dados de processos)

### Operacoes de Cache

```python
# Limpar todo o cache
scraper.limpar_cache()

# Verificar tamanho do cache
print(f"Entradas no cache: {scraper.cache.size}")

# Invalidar entrada especifica
scraper.cache.invalidate("processo:0000001-23.2024.4.01.3400:TRF1")

# Invalidar sessao de um TRF
scraper.cache.invalidate_session("TRF1")
```

## Rate Limiting e Backoff

### Rate Limiting
O scraper respeita limite de 1 requisicao por segundo para evitar sobrecarga nos servidores do PJe.

### Backoff Exponencial
Em caso de erro, aplica backoff exponencial:
- 1o erro: 2 segundos
- 2o erro: 4 segundos
- 3o erro: 8 segundos
- Maximo: 60 segundos

### Circuit Breaker
Apos 5 erros consecutivos em um TRF, o circuit breaker abre e bloqueia requisicoes por 60 segundos.

```python
# Verificar estado do circuit breaker
status = scraper.health_check("TRF1")
print(f"Circuit breaker TRF1: {status['trfs']['TRF1']['circuit_breaker']}")

# Resetar circuit breaker manualmente
scraper.circuit_breakers["TRF1"].reset()
```

## Logs

Os logs sao gravados no diretorio configurado com rotacao automatica.

### Niveis de Log
- **DEBUG**: Detalhes de cada requisicao
- **INFO**: Operacoes normais
- **WARNING**: Rate limit, circuit breaker, etc.
- **ERROR**: Falhas recuperaveis
- **CRITICAL**: Falhas criticas

### Formato do Log
```
2026-01-12T15:30:00-0300 | INFO     | pje_scraper | GET https://pje1g.trf1.jus.br/pje/ConsultaPublica -> 200 (245ms)
```

## Health Check

```python
# Verificar todos os TRFs
status = scraper.health_check()

# Verificar TRF especifico
status = scraper.health_check("TRF1")

# Resultado
{
  "timestamp": "2026-01-12T15:30:00Z",
  "overall": "healthy",  # healthy, degraded, unhealthy
  "trfs": {
    "TRF1": {
      "status": "online",
      "status_code": 200,
      "latency_ms": 245.5,
      "circuit_breaker": "closed"
    },
    ...
  }
}
```

## Testes

### Executar Testes Unitarios
```bash
cd python-scrapers
python -m pytest tests/test_pje_scraper.py -v
```

### Cobertura de Testes
Os testes cobrem (50+ testes):
- Validacao de numeros (CNJ, CPF, CNPJ, OAB)
- Parsing de dados (valores, datas, HTML)
- Dataclasses e serializacao
- Sistema de cache
- Rate limiter
- Circuit breaker
- Deteccao de TRF
- Tratamento de excecoes
- Performance

## Diagrama de Fluxo

```
+------------------+     +----------------+     +------------------+
|                  |     |                |     |                  |
|  Cliente/API     +---->+  PJeScraper    +---->+  PJe TRF1-5      |
|                  |     |                |     |                  |
+------------------+     +-------+--------+     +------------------+
                                 |
                    +------------+------------+
                    |            |            |
              +-----+----+ +-----+----+ +-----+----+
              |          | |          | |          |
              |  Cache   | |   Rate   | | Circuit  |
              | Manager  | | Limiter  | | Breaker  |
              |          | |          | |          |
              +----------+ +----------+ +----------+
```

## Formato do Numero CNJ

O numero de processo no formato CNJ e composto por:

```
NNNNNNN-DD.AAAA.J.TR.OOOO

NNNNNNN = Numero sequencial (7 digitos)
DD      = Digito verificador (2 digitos)
AAAA    = Ano de ajuizamento (4 digitos)
J       = Segmento de Justica (1 digito)
          - 4 = Justica Federal
TR      = Tribunal (2 digitos)
          - 01 = TRF1
          - 02 = TRF2
          - 03 = TRF3
          - 04 = TRF4
          - 05 = TRF5
OOOO    = Origem/Secao Judiciaria (4 digitos)
```

## Troubleshooting

### "Processo nao encontrado"
- Verifique se o numero esta correto (formato CNJ com 20 digitos)
- Confirme se e processo da Justica Federal (segmento 4)
- O processo pode ter sido migrado ou arquivado

### "Segredo de justica"
- O processo e sigiloso
- Acesso apenas com certificado digital de advogado cadastrado
- O scraper nao tenta acessar dados restritos

### "Erro de conexao"
- Verifique sua conexao com a internet
- O servidor do PJe pode estar indisponivel
- Verifique se o circuit breaker esta aberto
- Tente novamente em alguns minutos

### "Certificado invalido"
- Verifique se o caminho do arquivo esta correto
- Confirme que a senha esta correta
- O certificado pode estar expirado

### "Circuit breaker aberto"
- O TRF esta com problemas de disponibilidade
- Aguarde 60 segundos e tente novamente
- Ou resete manualmente: `scraper.circuit_breakers["TRF1"].reset()`

### Rate limit excedido
- O scraper ja gerencia isso automaticamente
- Se necessario, aumente o intervalo entre requisicoes

## Dependencias

### Obrigatorias
- Python 3.8+
- requests >= 2.25.0
- beautifulsoup4 >= 4.9.0

### Opcionais
- cryptography >= 3.4.0 (para certificados A1)
- pyOpenSSL >= 20.0.0 (para certificados A3)

## Licenca

Este scraper e fornecido para uso educacional e de pesquisa juridica. O uso deve respeitar os termos de uso do PJe e as normas de acesso a informacoes processuais.

## Contato

Para suporte ou duvidas, consulte a documentacao do ROM-Agent ou abra uma issue no repositorio.
