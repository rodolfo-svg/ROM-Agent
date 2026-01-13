#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
PJe Scraper - Justica Federal (TRF1-5)
Extracao automatizada de processos do sistema PJe (Processo Judicial Eletronico)

Este modulo fornece uma implementacao completa e profissional para:
- Login com certificado digital A1/A3 ou usuario/senha
- Busca unificada de processos por numero CNJ, CPF/CNPJ ou OAB
- Auto-deteccao do TRF correto pelo numero do processo
- Extracao completa de dados processuais
- Download de documentos PDF com validacao de integridade
- Deteccao de intimacoes pendentes
- Extracaoo da linha do tempo processual
- Suporte multi-tribunal (TRF1 a TRF5)
- Retry com backoff exponencial e circuit breaker
- Rate limiting rigoroso (1 req/s)
- Cache de sessao e consultas
- Logs estruturados detalhados

URLs base por TRF:
- TRF1: https://pje1g.trf1.jus.br (1a Regiao - DF, GO, MT, TO, AC, AM, AP, BA, MA, MG, PA, PI, RO, RR)
- TRF2: https://pje.trf2.jus.br (2a Regiao - RJ, ES)
- TRF3: https://pje1g.trf3.jus.br (3a Regiao - SP, MS)
- TRF4: https://pje1g.trf4.jus.br (4a Regiao - PR, RS, SC)
- TRF5: https://pje.trf5.jus.br (5a Regiao - AL, CE, PB, PE, RN, SE)

Autor: ROM-Agent Integration System
Data: 2026-01-12
Versao: 1.0.0
"""

import asyncio
import hashlib
import json
import logging
import os
import re
import ssl
import sys
import time
import unicodedata
from dataclasses import dataclass, field, asdict
from datetime import datetime, timedelta, timezone
from enum import Enum
from logging.handlers import RotatingFileHandler
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional, Tuple, Union
from urllib.parse import urljoin, urlencode, parse_qs, urlparse, quote

# Dependencias externas
try:
    import requests
    from requests.adapters import HTTPAdapter
    from urllib3.util.retry import Retry
    REQUESTS_AVAILABLE = True
except ImportError:
    REQUESTS_AVAILABLE = False
    requests = None

try:
    from bs4 import BeautifulSoup, Tag
    BS4_AVAILABLE = True
except ImportError:
    BS4_AVAILABLE = False
    BeautifulSoup = None
    Tag = None

# Tentar importar cryptography para certificados digitais
try:
    from cryptography import x509
    from cryptography.hazmat.backends import default_backend
    from cryptography.hazmat.primitives.serialization import pkcs12
    CRYPTO_AVAILABLE = True
except ImportError:
    CRYPTO_AVAILABLE = False

# Tentar importar OpenSSL para conexoes com certificado
try:
    import OpenSSL
    OPENSSL_AVAILABLE = True
except ImportError:
    OPENSSL_AVAILABLE = False
    OpenSSL = None


# =============================================================================
# CONSTANTES E CONFIGURACOES
# =============================================================================

# URLs base por TRF
TRF_URLS = {
    "TRF1": "https://pje1g.trf1.jus.br",
    "TRF2": "https://pje.trf2.jus.br",
    "TRF3": "https://pje1g.trf3.jus.br",
    "TRF4": "https://pje1g.trf4.jus.br",
    "TRF5": "https://pje.trf5.jus.br",
}

# Codigos de tribunal por TRF (formato CNJ)
TRIBUNAL_CODES = {
    "01": "TRF1",  # 4.01 = TRF1
    "02": "TRF2",  # 4.02 = TRF2
    "03": "TRF3",  # 4.03 = TRF3
    "04": "TRF4",  # 4.04 = TRF4
    "05": "TRF5",  # 4.05 = TRF5
}

# Estados por TRF
TRF_ESTADOS = {
    "TRF1": ["DF", "GO", "MT", "TO", "AC", "AM", "AP", "BA", "MA", "MG", "PA", "PI", "RO", "RR"],
    "TRF2": ["RJ", "ES"],
    "TRF3": ["SP", "MS"],
    "TRF4": ["PR", "RS", "SC"],
    "TRF5": ["AL", "CE", "PB", "PE", "RN", "SE"],
}

# Endpoints do PJe (padrao CNJ)
PJE_ENDPOINTS = {
    "login": "/pje/login.seam",
    "logout": "/pje/logout.seam",
    "painel": "/pje/Painel/painel_usuario/advogado.seam",
    "consulta_publica": "/pje/ConsultaPublica/listView.seam",
    "detalhe_processo": "/pje/ConsultaPublica/DetalheProcessoConsultaPublica/listView.seam",
    "consulta_processo": "/pje/Processo/ConsultaProcesso/listView.seam",
    "documento": "/pje/Processo/ConsultaProcesso/documento.seam",
    "intimacoes": "/pje/Processo/Intimacao/listView.seam",
    "movimentacoes": "/pje/Processo/ConsultaProcesso/movimentacoes.seam",
}

# Configuracoes padrao
DEFAULT_TIMEOUT = 30  # segundos
DEFAULT_MAX_RETRIES = 3
DEFAULT_RATE_LIMIT = 1.0  # segundos entre requisicoes
DEFAULT_CACHE_TTL_SESSION = 3600  # 1 hora para sessao
DEFAULT_CACHE_TTL_CONSULTA = 1800  # 30 minutos para consultas
DEFAULT_BACKOFF_BASE = 2  # base do backoff exponencial (2^n)
DEFAULT_CIRCUIT_BREAKER_THRESHOLD = 5  # erros consecutivos para abrir circuito
DEFAULT_CIRCUIT_BREAKER_TIMEOUT = 60  # segundos para tentar reabrir circuito
DEFAULT_LOG_MAX_SIZE = 10 * 1024 * 1024  # 10 MB
DEFAULT_LOG_BACKUP_COUNT = 5

# User-Agent realista
DEFAULT_USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
)

# Headers padrao
DEFAULT_HEADERS = {
    "User-Agent": DEFAULT_USER_AGENT,
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    "Accept-Language": "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7",
    "Accept-Encoding": "gzip, deflate, br",
    "Connection": "keep-alive",
    "Upgrade-Insecure-Requests": "1",
    "Cache-Control": "no-cache",
    "Pragma": "no-cache",
}

# Padroes regex para validacao e extracao
CNJ_PATTERN = re.compile(
    r'^(\d{7})-?(\d{2})\.?(\d{4})\.?(\d{1})\.?(\d{2})\.?(\d{4})$'
)
CPF_PATTERN = re.compile(r'^\d{3}\.?\d{3}\.?\d{3}-?\d{2}$')
CNPJ_PATTERN = re.compile(r'^\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}$')
OAB_PATTERN = re.compile(r'OAB[/\s]*([A-Z]{2})\s*(\d+)', re.IGNORECASE)
VALOR_PATTERN = re.compile(r'R\$\s*([\d.,]+)', re.IGNORECASE)
DATA_PATTERN = re.compile(r'(\d{2})/(\d{2})/(\d{4})')
DATA_ISO_PATTERN = re.compile(r'(\d{4})-(\d{2})-(\d{2})')
DATETIME_PATTERN = re.compile(r'(\d{2})/(\d{2})/(\d{4})\s+(\d{2}):(\d{2}):?(\d{2})?')


# =============================================================================
# ENUMS E TIPOS
# =============================================================================

class TRF(str, Enum):
    """Tribunais Regionais Federais"""
    TRF1 = "TRF1"
    TRF2 = "TRF2"
    TRF3 = "TRF3"
    TRF4 = "TRF4"
    TRF5 = "TRF5"


class Instancia(str, Enum):
    """Instancias do PJe"""
    PRIMEIRO_GRAU = "1"
    SEGUNDO_GRAU = "2"
    TURMAS_RECURSAIS = "TR"


class TipoBusca(str, Enum):
    """Tipos de busca disponiveis"""
    NUMERO_PROCESSO = "numero_processo"
    CPF = "cpf"
    CNPJ = "cnpj"
    OAB = "oab"
    NOME_PARTE = "nome_parte"


class TipoParte(str, Enum):
    """Tipos de parte no processo"""
    AUTOR = "autor"
    REU = "reu"
    REQUERENTE = "requerente"
    REQUERIDO = "requerido"
    APELANTE = "apelante"
    APELADO = "apelado"
    AGRAVANTE = "agravante"
    AGRAVADO = "agravado"
    RECORRENTE = "recorrente"
    RECORRIDO = "recorrido"
    EMBARGANTE = "embargante"
    EMBARGADO = "embargado"
    EXEQUENTE = "exequente"
    EXECUTADO = "executado"
    TERCEIRO = "terceiro_interessado"
    ASSISTENTE = "assistente"
    LITISCONSORTE = "litisconsorte"
    ADVOGADO = "advogado"
    MINISTERIO_PUBLICO = "ministerio_publico"
    DEFENSOR = "defensor_publico"
    JUIZ = "juiz"
    PERITO = "perito"
    TESTEMUNHA = "testemunha"
    OUTRO = "outro"


class TipoIntimacao(str, Enum):
    """Tipos de intimacao"""
    CARGA = "carga"
    VISTA = "vista"
    CITACAO = "citacao"
    INTIMACAO = "intimacao"
    NOTIFICACAO = "notificacao"
    OUTRO = "outro"


class StatusIntimacao(str, Enum):
    """Status da intimacao"""
    PENDENTE = "pendente"
    CIENCIA_EXPRESSA = "ciencia_expressa"
    CIENCIA_TACITA = "ciencia_tacita"
    EXPIRADA = "expirada"


class TipoDocumento(str, Enum):
    """Tipos de documento processual"""
    PETICAO_INICIAL = "peticao_inicial"
    CONTESTACAO = "contestacao"
    REPLICA = "replica"
    SENTENCA = "sentenca"
    DESPACHO = "despacho"
    DECISAO = "decisao"
    ACORDAO = "acordao"
    RECURSO = "recurso"
    CERTIDAO = "certidao"
    ATA = "ata"
    LAUDO = "laudo"
    PARECER = "parecer"
    OFICIO = "oficio"
    MANDADO = "mandado"
    PROCURACAO = "procuracao"
    DOCUMENTO = "documento"
    OUTRO = "outro"


class CircuitBreakerState(str, Enum):
    """Estados do circuit breaker"""
    CLOSED = "closed"
    OPEN = "open"
    HALF_OPEN = "half_open"


# =============================================================================
# DATACLASSES
# =============================================================================

@dataclass
class Advogado:
    """Dados de um advogado"""
    nome: str
    oab_numero: Optional[str] = None
    oab_estado: Optional[str] = None
    email: Optional[str] = None

    def __str__(self) -> str:
        if self.oab_numero and self.oab_estado:
            return f"{self.nome} (OAB/{self.oab_estado} {self.oab_numero})"
        return self.nome

    def to_dict(self) -> Dict:
        return {
            "nome": self.nome,
            "oab_numero": self.oab_numero,
            "oab_estado": self.oab_estado,
            "email": self.email,
        }


@dataclass
class Parte:
    """Dados de uma parte processual"""
    tipo: str
    nome: str
    documento: Optional[str] = None
    tipo_documento: Optional[str] = None  # CPF ou CNPJ
    advogados: List[Dict] = field(default_factory=list)
    endereco: Optional[str] = None
    email: Optional[str] = None
    telefone: Optional[str] = None

    def to_dict(self) -> Dict:
        return {
            "tipo": self.tipo,
            "nome": self.nome,
            "documento": self.documento,
            "tipo_documento": self.tipo_documento,
            "advogados": self.advogados,
            "endereco": self.endereco,
            "email": self.email,
            "telefone": self.telefone,
        }


@dataclass
class Movimentacao:
    """Dados de uma movimentacao processual"""
    data: str
    hora: Optional[str] = None
    descricao: str = ""
    tipo: Optional[str] = None
    complemento: Optional[str] = None
    responsavel: Optional[str] = None
    documento_vinculado: Optional[str] = None  # ID do documento
    documento_url: Optional[str] = None

    def to_dict(self) -> Dict:
        return {
            "data": self.data,
            "hora": self.hora,
            "descricao": self.descricao,
            "tipo": self.tipo,
            "complemento": self.complemento,
            "responsavel": self.responsavel,
            "documento_vinculado": self.documento_vinculado,
            "documento_url": self.documento_url,
        }


@dataclass
class Documento:
    """Dados de um documento processual"""
    id: Optional[str] = None
    tipo: str = TipoDocumento.OUTRO.value
    nome: Optional[str] = None
    data: Optional[str] = None
    descricao: Optional[str] = None
    url: Optional[str] = None
    tamanho_bytes: Optional[int] = None
    hash_md5: Optional[str] = None
    hash_sha256: Optional[str] = None
    arquivo_local: Optional[str] = None
    sigiloso: bool = False

    def to_dict(self) -> Dict:
        return {
            "id": self.id,
            "tipo": self.tipo,
            "nome": self.nome,
            "data": self.data,
            "descricao": self.descricao,
            "url": self.url,
            "tamanho_bytes": self.tamanho_bytes,
            "hash_md5": self.hash_md5,
            "hash_sha256": self.hash_sha256,
            "arquivo_local": self.arquivo_local,
            "sigiloso": self.sigiloso,
        }


@dataclass
class Intimacao:
    """Dados de uma intimacao"""
    id: Optional[str] = None
    tipo: str = TipoIntimacao.INTIMACAO.value
    status: str = StatusIntimacao.PENDENTE.value
    data_disponibilizacao: Optional[str] = None
    data_ciencia: Optional[str] = None
    prazo_dias: Optional[int] = None
    data_limite: Optional[str] = None
    descricao: Optional[str] = None
    documento_vinculado: Optional[str] = None

    def to_dict(self) -> Dict:
        return {
            "id": self.id,
            "tipo": self.tipo,
            "status": self.status,
            "data_disponibilizacao": self.data_disponibilizacao,
            "data_ciencia": self.data_ciencia,
            "prazo_dias": self.prazo_dias,
            "data_limite": self.data_limite,
            "descricao": self.descricao,
            "documento_vinculado": self.documento_vinculado,
        }


@dataclass
class ProcessoPJe:
    """
    Dados completos de um processo do PJe

    Estrutura padrao para armazenar todas as informacoes
    extraidas de um processo do PJe da Justica Federal.
    """
    numero_processo: str
    tribunal: str = "JF"  # TRF1, TRF2, etc
    sistema: str = "PJe"
    instancia: str = "1"  # "1", "2", "TR"

    # Dados basicos
    classe: Optional[str] = None
    assunto: Optional[str] = None
    assuntos_secundarios: List[str] = field(default_factory=list)
    valor_causa: Optional[float] = None
    moeda: str = "BRL"

    # Localizacao
    orgao_julgador: Optional[str] = None
    vara: Optional[str] = None
    secao_judiciaria: Optional[str] = None
    subsecao: Optional[str] = None

    # Datas
    data_distribuicao: Optional[str] = None
    data_autuacao: Optional[str] = None
    ultima_atualizacao: Optional[str] = None

    # Partes e advogados
    partes: List[Dict] = field(default_factory=list)
    advogados: List[Dict] = field(default_factory=list)

    # Movimentacoes e documentos
    movimentacoes: List[Dict] = field(default_factory=list)
    documentos: List[Dict] = field(default_factory=list)

    # Intimacoes
    intimacoes: List[Dict] = field(default_factory=list)

    # Processos relacionados
    processo_principal: Optional[str] = None
    processos_apensados: List[str] = field(default_factory=list)

    # Status e controle
    segredo_justica: bool = False
    justica_gratuita: bool = False
    prioridade: Optional[str] = None  # idoso, deficiente, etc.
    situacao: Optional[str] = None  # ativo, arquivado, suspenso, etc.

    # Metadados da extracao
    timestamp_extracao: Optional[str] = None
    url_consulta: Optional[str] = None
    codigo_processo: Optional[str] = None  # Codigo interno do PJe

    # Dados extras
    metadata: Dict = field(default_factory=dict)

    # Erros durante extracao
    erros: List[str] = field(default_factory=list)

    def __post_init__(self):
        """Inicializacao pos-criacao"""
        if self.timestamp_extracao is None:
            self.timestamp_extracao = datetime.now(timezone.utc).isoformat()

    def to_dict(self) -> Dict:
        """Converte para dicionario"""
        return asdict(self)

    def to_json(self, indent: int = 2) -> str:
        """Converte para JSON"""
        return json.dumps(self.to_dict(), indent=indent, ensure_ascii=False)

    @property
    def numero_formatado(self) -> str:
        """Retorna o numero no formato CNJ padrao"""
        numero_limpo = re.sub(r'\D', '', self.numero_processo)
        if len(numero_limpo) == 20:
            return f"{numero_limpo[:7]}-{numero_limpo[7:9]}.{numero_limpo[9:13]}.{numero_limpo[13]}.{numero_limpo[14:16]}.{numero_limpo[16:20]}"
        return self.numero_processo


# =============================================================================
# EXCECOES CUSTOMIZADAS
# =============================================================================

class PJeError(Exception):
    """Excecao base para erros do PJe"""
    pass


class PJeConnectionError(PJeError):
    """Erro de conexao com o PJe"""
    pass


class PJeAuthenticationError(PJeError):
    """Erro de autenticacao"""
    pass


class PJeCertificateError(PJeError):
    """Erro com certificado digital"""
    pass


class PJeProcessoNaoEncontrado(PJeError):
    """Processo nao encontrado"""
    pass


class PJeSegredoJustica(PJeError):
    """Processo em segredo de justica"""
    pass


class PJeRateLimitError(PJeError):
    """Erro de rate limit"""
    pass


class PJeValidationError(PJeError):
    """Erro de validacao de dados"""
    pass


class PJeCircuitBreakerOpenError(PJeError):
    """Circuit breaker esta aberto"""
    pass


# =============================================================================
# UTILITARIOS
# =============================================================================

def normalizar_texto(texto: str) -> str:
    """Normaliza texto removendo acentos e caracteres especiais"""
    if not texto:
        return ""
    texto = unicodedata.normalize('NFKD', texto)
    texto = texto.encode('ASCII', 'ignore').decode('ASCII')
    texto = ' '.join(texto.split())
    return texto.strip()


def limpar_html(texto: str) -> str:
    """Remove tags HTML e limpa o texto"""
    if not texto:
        return ""
    texto = re.sub(r'<[^>]+>', ' ', texto)
    texto = re.sub(r'&[a-z]+;', ' ', texto)
    texto = re.sub(r'&nbsp;', ' ', texto)
    texto = re.sub(r'\s+', ' ', texto)
    return texto.strip()


def formatar_numero_cnj(numero: str) -> str:
    """Formata numero de processo no padrao CNJ"""
    numero_limpo = re.sub(r'\D', '', numero)
    if len(numero_limpo) != 20:
        return numero
    return f"{numero_limpo[:7]}-{numero_limpo[7:9]}.{numero_limpo[9:13]}.{numero_limpo[13]}.{numero_limpo[14:16]}.{numero_limpo[16:20]}"


def validar_numero_cnj(numero: str) -> bool:
    """Valida se o numero esta no formato CNJ"""
    numero_limpo = re.sub(r'\D', '', numero)
    return len(numero_limpo) == 20


def extrair_componentes_cnj(numero: str) -> Dict[str, str]:
    """
    Extrai componentes do numero CNJ.

    Formato: NNNNNNN-DD.AAAA.J.TR.OOOO
    - NNNNNNN: Numero sequencial (7 digitos)
    - DD: Digito verificador (2 digitos)
    - AAAA: Ano (4 digitos)
    - J: Segmento de Justica (1 digito) - 4 = Federal
    - TR: Tribunal (2 digitos) - 01-05 para TRFs
    - OOOO: Origem (4 digitos) - Secao/Subsecao Judiciaria
    """
    numero_limpo = re.sub(r'\D', '', numero)
    if len(numero_limpo) != 20:
        raise PJeValidationError(f"Numero de processo invalido: {numero}")

    return {
        "numero_sequencial": numero_limpo[:7],
        "digito_verificador": numero_limpo[7:9],
        "ano": numero_limpo[9:13],
        "segmento_justica": numero_limpo[13],
        "tribunal": numero_limpo[14:16],
        "origem": numero_limpo[16:20],
        "numero_formatado": formatar_numero_cnj(numero_limpo),
        "numero_completo": numero_limpo
    }


def validar_cpf(cpf: str) -> bool:
    """Valida CPF"""
    cpf_limpo = re.sub(r'\D', '', cpf)
    if len(cpf_limpo) != 11:
        return False
    if cpf_limpo == cpf_limpo[0] * 11:
        return False
    soma = sum(int(cpf_limpo[i]) * (10 - i) for i in range(9))
    resto = soma % 11
    digito1 = 0 if resto < 2 else 11 - resto
    soma = sum(int(cpf_limpo[i]) * (11 - i) for i in range(10))
    resto = soma % 11
    digito2 = 0 if resto < 2 else 11 - resto
    return cpf_limpo[-2:] == f"{digito1}{digito2}"


def validar_cnpj(cnpj: str) -> bool:
    """Valida CNPJ"""
    cnpj_limpo = re.sub(r'\D', '', cnpj)
    if len(cnpj_limpo) != 14:
        return False
    if cnpj_limpo == cnpj_limpo[0] * 14:
        return False
    pesos1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
    soma = sum(int(cnpj_limpo[i]) * pesos1[i] for i in range(12))
    resto = soma % 11
    digito1 = 0 if resto < 2 else 11 - resto
    pesos2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
    soma = sum(int(cnpj_limpo[i]) * pesos2[i] for i in range(13))
    resto = soma % 11
    digito2 = 0 if resto < 2 else 11 - resto
    return cnpj_limpo[-2:] == f"{digito1}{digito2}"


def validar_oab(oab: str) -> bool:
    """Valida formato de OAB"""
    return bool(OAB_PATTERN.search(oab))


def formatar_cpf(cpf: str) -> str:
    """Formata CPF no padrao XXX.XXX.XXX-XX"""
    cpf_limpo = re.sub(r'\D', '', cpf)
    if len(cpf_limpo) != 11:
        return cpf
    return f"{cpf_limpo[:3]}.{cpf_limpo[3:6]}.{cpf_limpo[6:9]}-{cpf_limpo[9:11]}"


def formatar_cnpj(cnpj: str) -> str:
    """Formata CNPJ no padrao XX.XXX.XXX/XXXX-XX"""
    cnpj_limpo = re.sub(r'\D', '', cnpj)
    if len(cnpj_limpo) != 14:
        return cnpj
    return f"{cnpj_limpo[:2]}.{cnpj_limpo[2:5]}.{cnpj_limpo[5:8]}/{cnpj_limpo[8:12]}-{cnpj_limpo[12:14]}"


def parsear_valor_monetario(texto: str) -> Optional[float]:
    """Converte texto de valor monetario para float"""
    if not texto:
        return None
    match = VALOR_PATTERN.search(texto)
    if match:
        valor_str = match.group(1)
        valor_str = valor_str.replace('.', '').replace(',', '.')
        try:
            return float(valor_str)
        except ValueError:
            pass
    return None


def parsear_data(texto: str) -> Optional[str]:
    """Converte data para formato ISO"""
    if not texto:
        return None
    match = DATA_PATTERN.search(texto)
    if match:
        dia, mes, ano = match.groups()
        return f"{ano}-{mes}-{dia}"
    match = DATA_ISO_PATTERN.search(texto)
    if match:
        return match.group(0)
    return texto


def parsear_datetime(texto: str) -> Tuple[Optional[str], Optional[str]]:
    """Converte datetime para data e hora separados"""
    if not texto:
        return None, None
    match = DATETIME_PATTERN.search(texto)
    if match:
        groups = match.groups()
        dia, mes, ano = groups[0], groups[1], groups[2]
        hora, minuto = groups[3], groups[4]
        segundo = groups[5] if groups[5] else "00"
        return f"{ano}-{mes}-{dia}", f"{hora}:{minuto}:{segundo}"
    return parsear_data(texto), None


def calcular_hash_arquivo(caminho: str, algoritmo: str = "md5") -> str:
    """Calcula hash de um arquivo"""
    if algoritmo == "md5":
        h = hashlib.md5()
    elif algoritmo == "sha256":
        h = hashlib.sha256()
    else:
        raise ValueError(f"Algoritmo nao suportado: {algoritmo}")

    with open(caminho, "rb") as f:
        for chunk in iter(lambda: f.read(8192), b""):
            h.update(chunk)
    return h.hexdigest()


def gerar_hash_cache(chave: str) -> str:
    """Gera hash para chave de cache"""
    return hashlib.md5(chave.encode('utf-8')).hexdigest()


# =============================================================================
# SISTEMA DE CACHE
# =============================================================================

class CacheManager:
    """
    Gerenciador de cache para consultas do PJe

    Implementa:
    - Cache de sessao autenticada (1 hora)
    - Cache de consultas (30 minutos)
    - Invalidacao automatica por TTL
    - Persistencia em arquivo JSON
    """

    def __init__(
        self,
        cache_dir: str = "./cache/pje",
        ttl_session: int = DEFAULT_CACHE_TTL_SESSION,
        ttl_consulta: int = DEFAULT_CACHE_TTL_CONSULTA,
        enabled: bool = True
    ):
        self.cache_dir = Path(cache_dir)
        self.ttl_session = ttl_session
        self.ttl_consulta = ttl_consulta
        self.enabled = enabled
        self._cache_file = self.cache_dir / "cache.json"
        self._session_file = self.cache_dir / "session.json"
        self._cache: Dict[str, Dict] = {}
        self._session_cache: Dict[str, Dict] = {}
        self._load_cache()

    def _load_cache(self):
        """Carrega cache dos arquivos"""
        if not self.enabled:
            return

        try:
            self.cache_dir.mkdir(parents=True, exist_ok=True)

            # Cache de consultas
            if self._cache_file.exists():
                with open(self._cache_file, 'r', encoding='utf-8') as f:
                    self._cache = json.load(f)
                self._cleanup()

            # Cache de sessao
            if self._session_file.exists():
                with open(self._session_file, 'r', encoding='utf-8') as f:
                    self._session_cache = json.load(f)
                self._cleanup_session()

        except Exception:
            self._cache = {}
            self._session_cache = {}

    def _save_cache(self):
        """Salva cache no arquivo"""
        if not self.enabled:
            return
        try:
            self.cache_dir.mkdir(parents=True, exist_ok=True)
            with open(self._cache_file, 'w', encoding='utf-8') as f:
                json.dump(self._cache, f, ensure_ascii=False, indent=2)
        except Exception:
            pass

    def _save_session(self):
        """Salva cache de sessao no arquivo"""
        if not self.enabled:
            return
        try:
            self.cache_dir.mkdir(parents=True, exist_ok=True)
            with open(self._session_file, 'w', encoding='utf-8') as f:
                json.dump(self._session_cache, f, ensure_ascii=False, indent=2)
        except Exception:
            pass

    def _cleanup(self):
        """Remove entradas expiradas do cache de consultas"""
        now = time.time()
        expired_keys = [
            key for key, value in self._cache.items()
            if now - value.get('timestamp', 0) > self.ttl_consulta
        ]
        for key in expired_keys:
            del self._cache[key]
        if expired_keys:
            self._save_cache()

    def _cleanup_session(self):
        """Remove sessoes expiradas"""
        now = time.time()
        expired_keys = [
            key for key, value in self._session_cache.items()
            if now - value.get('timestamp', 0) > self.ttl_session
        ]
        for key in expired_keys:
            del self._session_cache[key]
        if expired_keys:
            self._save_session()

    def get(self, key: str) -> Optional[Dict]:
        """Recupera valor do cache"""
        if not self.enabled:
            return None
        hash_key = gerar_hash_cache(key)
        entry = self._cache.get(hash_key)
        if entry is None:
            return None
        if time.time() - entry.get('timestamp', 0) > self.ttl_consulta:
            del self._cache[hash_key]
            self._save_cache()
            return None
        return entry.get('data')

    def set(self, key: str, value: Dict):
        """Armazena valor no cache"""
        if not self.enabled:
            return
        hash_key = gerar_hash_cache(key)
        self._cache[hash_key] = {
            'timestamp': time.time(),
            'key': key,
            'data': value
        }
        self._save_cache()

    def get_session(self, trf: str) -> Optional[Dict]:
        """Recupera sessao do cache"""
        if not self.enabled:
            return None
        entry = self._session_cache.get(trf)
        if entry is None:
            return None
        if time.time() - entry.get('timestamp', 0) > self.ttl_session:
            del self._session_cache[trf]
            self._save_session()
            return None
        return entry.get('data')

    def set_session(self, trf: str, session_data: Dict):
        """Armazena sessao no cache"""
        if not self.enabled:
            return
        self._session_cache[trf] = {
            'timestamp': time.time(),
            'trf': trf,
            'data': session_data
        }
        self._save_session()

    def invalidate(self, key: str):
        """Invalida entrada do cache"""
        hash_key = gerar_hash_cache(key)
        if hash_key in self._cache:
            del self._cache[hash_key]
            self._save_cache()

    def invalidate_session(self, trf: str):
        """Invalida sessao de um TRF"""
        if trf in self._session_cache:
            del self._session_cache[trf]
            self._save_session()

    def clear(self):
        """Limpa todo o cache"""
        self._cache = {}
        self._session_cache = {}
        self._save_cache()
        self._save_session()

    @property
    def size(self) -> int:
        """Retorna numero de entradas no cache"""
        return len(self._cache)


# =============================================================================
# SISTEMA DE LOGS
# =============================================================================

class LogManager:
    """
    Gerenciador de logs estruturados

    Implementa:
    - Niveis configuriveis (DEBUG, INFO, WARNING, ERROR, CRITICAL)
    - Timestamps precisos em ISO 8601
    - Rotacao de arquivos
    - Saida para console e arquivo
    """

    def __init__(
        self,
        name: str = "pje_scraper",
        log_dir: str = "./logs",
        level: int = logging.INFO,
        console_output: bool = True,
        file_output: bool = True,
        max_size: int = DEFAULT_LOG_MAX_SIZE,
        backup_count: int = DEFAULT_LOG_BACKUP_COUNT
    ):
        self.log_dir = Path(log_dir)
        self.logger = logging.getLogger(name)
        self.logger.setLevel(level)
        self.logger.handlers = []

        formatter = logging.Formatter(
            fmt='%(asctime)s | %(levelname)-8s | %(name)s | %(message)s',
            datefmt='%Y-%m-%dT%H:%M:%S%z'
        )

        if console_output:
            console_handler = logging.StreamHandler(sys.stdout)
            console_handler.setLevel(level)
            console_handler.setFormatter(formatter)
            self.logger.addHandler(console_handler)

        if file_output:
            try:
                self.log_dir.mkdir(parents=True, exist_ok=True)
                log_file = self.log_dir / f"{name}.log"
                file_handler = RotatingFileHandler(
                    log_file,
                    maxBytes=max_size,
                    backupCount=backup_count,
                    encoding='utf-8'
                )
                file_handler.setLevel(level)
                file_handler.setFormatter(formatter)
                self.logger.addHandler(file_handler)
            except Exception as e:
                self.logger.warning(f"Nao foi possivel criar arquivo de log: {e}")

    def debug(self, msg: str, **kwargs):
        self._log(logging.DEBUG, msg, **kwargs)

    def info(self, msg: str, **kwargs):
        self._log(logging.INFO, msg, **kwargs)

    def warning(self, msg: str, **kwargs):
        self._log(logging.WARNING, msg, **kwargs)

    def error(self, msg: str, **kwargs):
        self._log(logging.ERROR, msg, **kwargs)

    def critical(self, msg: str, **kwargs):
        self._log(logging.CRITICAL, msg, **kwargs)

    def _log(self, level: int, msg: str, **kwargs):
        if kwargs:
            extra_info = ' | '.join(f"{k}={v}" for k, v in kwargs.items())
            msg = f"{msg} | {extra_info}"
        self.logger.log(level, msg)

    def log_request(self, method: str, url: str, status_code: Optional[int] = None, duration_ms: Optional[float] = None):
        """Log de requisicao HTTP"""
        msg = f"{method} {url}"
        if status_code:
            msg += f" -> {status_code}"
        if duration_ms:
            msg += f" ({duration_ms:.0f}ms)"
        self.info(msg)

    def log_retry(self, attempt: int, max_attempts: int, error: str, wait_seconds: float):
        """Log de retry"""
        self.warning(f"Retry {attempt}/{max_attempts} apos {wait_seconds:.1f}s: {error}")


# =============================================================================
# RATE LIMITER
# =============================================================================

class RateLimiter:
    """
    Controlador de taxa de requisicoes

    Implementa:
    - Rate limiting rigoroso
    - Backoff exponencial em caso de erro
    - Deteccao de bloqueio temporario
    """

    def __init__(
        self,
        rate: float = DEFAULT_RATE_LIMIT,
        backoff_base: int = DEFAULT_BACKOFF_BASE,
        max_backoff: float = 60.0
    ):
        self.rate = rate
        self.backoff_base = backoff_base
        self.max_backoff = max_backoff
        self._last_request: float = 0.0
        self._request_count: int = 0
        self._error_count: int = 0
        self._consecutive_errors: int = 0
        self._current_backoff: float = rate
        self._blocked_until: float = 0.0

    def wait(self):
        """Aguarda tempo necessario antes da proxima requisicao"""
        now = time.time()

        if now < self._blocked_until:
            wait_time = self._blocked_until - now
            time.sleep(wait_time)
            now = time.time()

        elapsed = now - self._last_request
        if elapsed < self._current_backoff:
            wait_time = self._current_backoff - elapsed
            time.sleep(wait_time)

        self._last_request = time.time()
        self._request_count += 1

    def success(self):
        """Registra requisicao bem sucedida"""
        self._consecutive_errors = 0
        self._current_backoff = self.rate

    def error(self, blocked: bool = False) -> float:
        """
        Registra erro e calcula backoff

        Returns:
            Tempo de espera em segundos
        """
        self._error_count += 1
        self._consecutive_errors += 1

        if blocked:
            self._blocked_until = time.time() + 60.0
            wait_time = 60.0
        else:
            # Backoff exponencial: 2^n segundos
            wait_time = min(
                self.backoff_base ** self._consecutive_errors,
                self.max_backoff
            )
            self._current_backoff = wait_time

        return wait_time

    @property
    def request_count(self) -> int:
        return self._request_count

    @property
    def error_count(self) -> int:
        return self._error_count

    @property
    def consecutive_errors(self) -> int:
        return self._consecutive_errors

    @property
    def is_blocked(self) -> bool:
        return time.time() < self._blocked_until


# =============================================================================
# CIRCUIT BREAKER
# =============================================================================

class CircuitBreaker:
    """
    Circuit breaker para protecao contra falhas

    Estados:
    - CLOSED: Normal, requisicoes passam
    - OPEN: Bloqueado apos muitos erros
    - HALF_OPEN: Tentando reabrir
    """

    def __init__(
        self,
        threshold: int = DEFAULT_CIRCUIT_BREAKER_THRESHOLD,
        timeout: int = DEFAULT_CIRCUIT_BREAKER_TIMEOUT,
        logger: Optional[LogManager] = None
    ):
        self.threshold = threshold
        self.timeout = timeout
        self.logger = logger
        self._state = CircuitBreakerState.CLOSED
        self._failure_count = 0
        self._last_failure_time: Optional[float] = None
        self._success_count = 0

    @property
    def state(self) -> CircuitBreakerState:
        """Retorna estado atual do circuit breaker"""
        if self._state == CircuitBreakerState.OPEN:
            # Verifica se deve tentar reabrir
            if self._last_failure_time and time.time() - self._last_failure_time > self.timeout:
                self._state = CircuitBreakerState.HALF_OPEN
                if self.logger:
                    self.logger.info("Circuit breaker mudou para HALF_OPEN")
        return self._state

    def allow_request(self) -> bool:
        """Verifica se pode fazer requisicao"""
        state = self.state
        if state == CircuitBreakerState.CLOSED:
            return True
        if state == CircuitBreakerState.HALF_OPEN:
            return True
        return False

    def record_success(self):
        """Registra sucesso"""
        if self._state == CircuitBreakerState.HALF_OPEN:
            self._success_count += 1
            if self._success_count >= 2:  # Duas requisicoes bem-sucedidas para fechar
                self._state = CircuitBreakerState.CLOSED
                self._failure_count = 0
                self._success_count = 0
                if self.logger:
                    self.logger.info("Circuit breaker fechado")
        else:
            self._failure_count = 0

    def record_failure(self):
        """Registra falha"""
        self._failure_count += 1
        self._last_failure_time = time.time()
        self._success_count = 0

        if self._state == CircuitBreakerState.HALF_OPEN:
            self._state = CircuitBreakerState.OPEN
            if self.logger:
                self.logger.warning("Circuit breaker reaberto para OPEN")
        elif self._failure_count >= self.threshold:
            self._state = CircuitBreakerState.OPEN
            if self.logger:
                self.logger.warning(f"Circuit breaker aberto apos {self._failure_count} falhas")

    def reset(self):
        """Reseta o circuit breaker"""
        self._state = CircuitBreakerState.CLOSED
        self._failure_count = 0
        self._success_count = 0
        self._last_failure_time = None


# =============================================================================
# GERENCIADOR DE CERTIFICADO DIGITAL
# =============================================================================

class CertificateManager:
    """
    Gerenciador de certificados digitais A1/A3

    Suporta:
    - Certificados A1 (arquivo .pfx/.p12)
    - Verificacao de validade
    - Extracao de dados do certificado
    """

    def __init__(self, logger: Optional[LogManager] = None):
        self.logger = logger
        self._cert_path: Optional[str] = None
        self._cert_password: Optional[str] = None
        self._cert_data: Optional[Dict] = None

    def carregar_certificado_a1(self, cert_path: str, password: str) -> bool:
        """
        Carrega certificado A1 de arquivo

        Args:
            cert_path: Caminho para o arquivo .pfx ou .p12
            password: Senha do certificado

        Returns:
            True se carregado com sucesso
        """
        if not CRYPTO_AVAILABLE:
            if self.logger:
                self.logger.error("cryptography nao esta instalado")
            raise PJeCertificateError("Biblioteca cryptography nao disponivel")

        try:
            with open(cert_path, 'rb') as f:
                pfx_data = f.read()

            private_key, certificate, additional_certs = pkcs12.load_key_and_certificates(
                pfx_data,
                password.encode('utf-8'),
                default_backend()
            )

            # Verifica validade
            if certificate:
                not_valid_after = certificate.not_valid_after_utc
                if datetime.now(timezone.utc) > not_valid_after:
                    raise PJeCertificateError("Certificado expirado")

                # Extrai dados do certificado
                self._cert_data = {
                    "subject": certificate.subject.rfc4514_string(),
                    "issuer": certificate.issuer.rfc4514_string(),
                    "serial_number": certificate.serial_number,
                    "not_valid_before": certificate.not_valid_before_utc.isoformat(),
                    "not_valid_after": certificate.not_valid_after_utc.isoformat(),
                }

            self._cert_path = cert_path
            self._cert_password = password

            if self.logger:
                self.logger.info(f"Certificado carregado: {self._cert_data.get('subject', 'N/A')}")

            return True

        except Exception as e:
            if self.logger:
                self.logger.error(f"Erro ao carregar certificado: {e}")
            raise PJeCertificateError(f"Erro ao carregar certificado: {e}")

    def is_valid(self) -> bool:
        """Verifica se o certificado e valido"""
        if not self._cert_data:
            return False

        not_valid_after = datetime.fromisoformat(self._cert_data["not_valid_after"])
        return datetime.now(timezone.utc) < not_valid_after

    @property
    def cert_path(self) -> Optional[str]:
        return self._cert_path

    @property
    def cert_password(self) -> Optional[str]:
        return self._cert_password

    @property
    def cert_data(self) -> Optional[Dict]:
        return self._cert_data


# =============================================================================
# SCRAPER PRINCIPAL
# =============================================================================

class PJeScraper:
    """
    Scraper completo do PJe (Justica Federal)

    Suporta:
    - Login com certificado digital A1/A3
    - Login com usuario/senha (quando disponivel)
    - Busca unificada across TRF1-5
    - Auto-deteccao do TRF pelo numero do processo
    - Extracao de dados completos
    - Download de documentos com validacao
    - Deteccao de intimacoes
    - Linha do tempo processual
    - Retry com backoff exponencial
    - Circuit breaker para erros consecutivos
    - Rate limiting e cache
    """

    def __init__(
        self,
        certificado_path: Optional[str] = None,
        certificado_senha: Optional[str] = None,
        cache_dir: str = "./cache/pje",
        log_dir: str = "./logs",
        cache_enabled: bool = True,
        rate_limit: float = DEFAULT_RATE_LIMIT,
        timeout: int = DEFAULT_TIMEOUT,
        max_retries: int = DEFAULT_MAX_RETRIES,
        log_level: int = logging.INFO,
        verificar_ssl: bool = True
    ):
        """
        Inicializa o scraper

        Args:
            certificado_path: Caminho para certificado digital A1 (.pfx/.p12)
            certificado_senha: Senha do certificado
            cache_dir: Diretorio para cache
            log_dir: Diretorio para logs
            cache_enabled: Se cache esta habilitado
            rate_limit: Taxa limite (segundos entre requisicoes)
            timeout: Timeout das requisicoes
            max_retries: Numero maximo de tentativas
            log_level: Nivel de log
            verificar_ssl: Se deve verificar certificados SSL
        """
        # Logger
        self.logger = LogManager(
            name="pje_scraper",
            log_dir=log_dir,
            level=log_level
        )

        # Cache
        self.cache = CacheManager(
            cache_dir=cache_dir,
            enabled=cache_enabled
        )

        # Rate Limiter
        self.rate_limiter = RateLimiter(rate=rate_limit)

        # Circuit Breakers (um por TRF)
        self.circuit_breakers: Dict[str, CircuitBreaker] = {
            trf: CircuitBreaker(logger=self.logger) for trf in TRF_URLS.keys()
        }

        # Configuracoes
        self.timeout = timeout
        self.max_retries = max_retries
        self.verificar_ssl = verificar_ssl

        # Certificado digital
        self.cert_manager = CertificateManager(logger=self.logger)
        if certificado_path and certificado_senha:
            try:
                self.cert_manager.carregar_certificado_a1(certificado_path, certificado_senha)
            except Exception as e:
                self.logger.warning(f"Certificado nao carregado: {e}")

        # Sessoes HTTP (uma por TRF)
        self._sessions: Dict[str, requests.Session] = {}
        self._authenticated: Dict[str, bool] = {trf: False for trf in TRF_URLS.keys()}

        self.logger.info(
            "PJeScraper inicializado",
            cache_enabled=cache_enabled,
            rate_limit=rate_limit,
            certificado="sim" if certificado_path else "nao"
        )

    def _get_session(self, trf: str) -> requests.Session:
        """Obtem ou cria sessao HTTP para um TRF"""
        if not REQUESTS_AVAILABLE:
            raise ImportError("requests nao esta instalado")

        if trf not in self._sessions:
            session = requests.Session()
            session.headers.update(DEFAULT_HEADERS)

            # Configura retry
            retry_strategy = Retry(
                total=self.max_retries,
                backoff_factor=0.5,
                status_forcelist=[500, 502, 503, 504],
            )
            adapter = HTTPAdapter(max_retries=retry_strategy)
            session.mount("https://", adapter)
            session.mount("http://", adapter)

            # Configura certificado se disponivel
            if self.cert_manager.cert_path:
                session.cert = (
                    self.cert_manager.cert_path,
                    self.cert_manager.cert_password
                )

            self._sessions[trf] = session

            # Restaura sessao do cache se disponivel
            cached_session = self.cache.get_session(trf)
            if cached_session:
                for name, value in cached_session.get('cookies', {}).items():
                    session.cookies.set(name, value)
                self._authenticated[trf] = cached_session.get('authenticated', False)
                self.logger.debug(f"Sessao restaurada do cache para {trf}")

        return self._sessions[trf]

    def _fazer_requisicao(
        self,
        trf: str,
        url: str,
        method: str = "GET",
        params: Optional[Dict] = None,
        data: Optional[Dict] = None,
        headers: Optional[Dict] = None,
        allow_redirects: bool = True
    ) -> requests.Response:
        """
        Faz requisicao HTTP com rate limiting, retry e circuit breaker

        Args:
            trf: TRF alvo (TRF1, TRF2, etc)
            url: URL da requisicao
            method: Metodo HTTP
            params: Parametros de query
            data: Dados para POST
            headers: Headers adicionais
            allow_redirects: Se permite redirects

        Returns:
            Response da requisicao

        Raises:
            PJeConnectionError: Se falhar apos todas as tentativas
            PJeCircuitBreakerOpenError: Se circuit breaker esta aberto
            PJeRateLimitError: Se bloqueado por rate limit
        """
        # Verifica circuit breaker
        cb = self.circuit_breakers.get(trf)
        if cb and not cb.allow_request():
            raise PJeCircuitBreakerOpenError(f"Circuit breaker aberto para {trf}")

        # Aplica rate limit
        self.rate_limiter.wait()

        # Prepara headers
        req_headers = DEFAULT_HEADERS.copy()
        if headers:
            req_headers.update(headers)

        session = self._get_session(trf)
        tentativas = 0
        ultimo_erro = None

        while tentativas < self.max_retries:
            tentativas += 1

            try:
                start_time = time.time()

                if method.upper() == "GET":
                    response = session.get(
                        url,
                        params=params,
                        headers=req_headers,
                        timeout=self.timeout,
                        allow_redirects=allow_redirects,
                        verify=self.verificar_ssl
                    )
                else:
                    response = session.post(
                        url,
                        params=params,
                        data=data,
                        headers=req_headers,
                        timeout=self.timeout,
                        allow_redirects=allow_redirects,
                        verify=self.verificar_ssl
                    )

                duration_ms = (time.time() - start_time) * 1000
                self.logger.log_request(method, url, response.status_code, duration_ms)

                # Verifica status
                if response.status_code == 429:
                    wait_time = self.rate_limiter.error(blocked=True)
                    self.logger.warning(f"Rate limit detectado - aguardando {wait_time}s")
                    time.sleep(wait_time)
                    continue

                if response.status_code >= 500:
                    wait_time = self.rate_limiter.error()
                    if cb:
                        cb.record_failure()
                    self.logger.log_retry(tentativas, self.max_retries, f"HTTP {response.status_code}", wait_time)
                    time.sleep(wait_time)
                    continue

                # Sucesso
                self.rate_limiter.success()
                if cb:
                    cb.record_success()
                return response

            except requests.exceptions.Timeout as e:
                wait_time = self.rate_limiter.error()
                if cb:
                    cb.record_failure()
                self.logger.log_retry(tentativas, self.max_retries, f"Timeout: {e}", wait_time)
                ultimo_erro = e
                time.sleep(wait_time)

            except requests.exceptions.ConnectionError as e:
                wait_time = self.rate_limiter.error()
                if cb:
                    cb.record_failure()
                self.logger.log_retry(tentativas, self.max_retries, f"Connection: {e}", wait_time)
                ultimo_erro = e
                time.sleep(wait_time)

            except Exception as e:
                self.logger.error(f"Erro inesperado: {e}")
                ultimo_erro = e
                if cb:
                    cb.record_failure()
                break

        raise PJeConnectionError(f"Falha apos {tentativas} tentativas: {ultimo_erro}")

    # =========================================================================
    # AUTENTICACAO
    # =========================================================================

    def login(
        self,
        trf: str,
        usuario: Optional[str] = None,
        senha: Optional[str] = None,
        force: bool = False
    ) -> bool:
        """
        Realiza login no PJe

        Tenta login com certificado digital primeiro (se disponivel),
        depois com usuario/senha.

        Args:
            trf: TRF alvo (TRF1, TRF2, etc)
            usuario: Usuario para login (CPF)
            senha: Senha do usuario
            force: Forca novo login mesmo se ja autenticado

        Returns:
            True se login bem-sucedido

        Raises:
            PJeAuthenticationError: Se login falhar
        """
        if trf not in TRF_URLS:
            raise PJeValidationError(f"TRF invalido: {trf}")

        self.logger.info(f"Iniciando login em {trf}")

        # Verifica se ja esta autenticado
        if not force and self._authenticated.get(trf):
            self.logger.info(f"Ja autenticado em {trf}")
            return True

        # Verifica cache de sessao
        if not force:
            cached = self.cache.get_session(trf)
            if cached and cached.get('authenticated'):
                session = self._get_session(trf)
                for name, value in cached.get('cookies', {}).items():
                    session.cookies.set(name, value)
                self._authenticated[trf] = True
                self.logger.info(f"Sessao restaurada do cache para {trf}")
                return True

        base_url = TRF_URLS[trf]
        login_url = urljoin(base_url, PJE_ENDPOINTS["login"])

        try:
            # Acessa pagina inicial para obter cookies
            session = self._get_session(trf)
            response = self._fazer_requisicao(trf, base_url)

            # Tenta login com certificado se disponivel
            if self.cert_manager.is_valid():
                success = self._login_certificado(trf, session, login_url)
                if success:
                    self._salvar_sessao(trf)
                    return True

            # Tenta login com usuario/senha
            if usuario and senha:
                success = self._login_usuario_senha(trf, session, login_url, usuario, senha)
                if success:
                    self._salvar_sessao(trf)
                    return True

            raise PJeAuthenticationError("Falha no login - credenciais invalidas ou certificado nao aceito")

        except PJeAuthenticationError:
            raise
        except Exception as e:
            self.logger.error(f"Erro durante login: {e}")
            raise PJeAuthenticationError(f"Erro durante login: {e}")

    def _login_certificado(self, trf: str, session: requests.Session, login_url: str) -> bool:
        """Login com certificado digital"""
        try:
            # O certificado ja esta configurado na sessao
            response = self._fazer_requisicao(trf, login_url)

            # Verifica se login foi bem-sucedido
            if self._verificar_login_sucesso(response):
                self._authenticated[trf] = True
                self.logger.info(f"Login com certificado bem-sucedido em {trf}")
                return True

            return False

        except Exception as e:
            self.logger.debug(f"Login com certificado falhou: {e}")
            return False

    def _login_usuario_senha(
        self,
        trf: str,
        session: requests.Session,
        login_url: str,
        usuario: str,
        senha: str
    ) -> bool:
        """Login com usuario e senha"""
        try:
            # Prepara dados do formulario
            form_data = {
                'username': usuario,
                'password': senha,
                'login-form': 'login-form',
            }

            response = self._fazer_requisicao(
                trf,
                login_url,
                method="POST",
                data=form_data
            )

            # Verifica se login foi bem-sucedido
            if self._verificar_login_sucesso(response):
                self._authenticated[trf] = True
                self.logger.info(f"Login com usuario/senha bem-sucedido em {trf}")
                return True

            return False

        except Exception as e:
            self.logger.debug(f"Login com usuario/senha falhou: {e}")
            return False

    def _verificar_login_sucesso(self, response: requests.Response) -> bool:
        """Verifica se o login foi bem-sucedido"""
        html = response.text.lower()

        # Indicadores de sucesso
        success_indicators = [
            'painel',
            'usuario logado',
            'sair',
            'logout',
            'meus processos',
            'intimacoes',
            'bem-vindo'
        ]

        # Indicadores de falha
        failure_indicators = [
            'erro',
            'falha',
            'usuario ou senha',
            'credenciais invalidas',
            'acesso negado',
            'nao autorizado'
        ]

        has_success = any(ind in html for ind in success_indicators)
        has_failure = any(ind in html for ind in failure_indicators)

        if has_failure:
            return False
        if has_success:
            return True

        # Verifica URL final
        final_url = str(response.url).lower()
        if 'painel' in final_url or 'principal' in final_url:
            return True

        return False

    def _salvar_sessao(self, trf: str):
        """Salva sessao no cache"""
        session = self._sessions.get(trf)
        if session:
            session_data = {
                'cookies': dict(session.cookies),
                'authenticated': self._authenticated.get(trf, False),
                'timestamp': time.time()
            }
            self.cache.set_session(trf, session_data)

    def logout(self, trf: str) -> bool:
        """Realiza logout do TRF"""
        if trf not in TRF_URLS:
            return False

        try:
            base_url = TRF_URLS[trf]
            logout_url = urljoin(base_url, PJE_ENDPOINTS["logout"])
            self._fazer_requisicao(trf, logout_url)
        except Exception:
            pass

        self._authenticated[trf] = False
        self.cache.invalidate_session(trf)

        if trf in self._sessions:
            self._sessions[trf].cookies.clear()

        self.logger.info(f"Logout realizado em {trf}")
        return True

    # =========================================================================
    # DETECCAO DE TRF
    # =========================================================================

    def detectar_trf(self, numero_processo: str) -> str:
        """
        Detecta o TRF correto pelo numero do processo

        O numero CNJ contem o codigo do tribunal:
        - NNNNNNN-DD.AAAA.4.TR.OOOO
        - Onde TR indica o TRF (01-05)

        Args:
            numero_processo: Numero do processo (formato CNJ)

        Returns:
            TRF detectado (TRF1, TRF2, etc)

        Raises:
            PJeValidationError: Se numero invalido ou nao e Justica Federal
        """
        try:
            componentes = extrair_componentes_cnj(numero_processo)
        except PJeValidationError:
            raise

        # Verifica se e Justica Federal (segmento 4)
        if componentes["segmento_justica"] != "4":
            raise PJeValidationError(
                f"Processo nao e da Justica Federal (segmento {componentes['segmento_justica']})"
            )

        tribunal = componentes["tribunal"]
        if tribunal not in TRIBUNAL_CODES:
            raise PJeValidationError(f"Codigo de tribunal invalido: {tribunal}")

        trf = TRIBUNAL_CODES[tribunal]
        self.logger.debug(f"TRF detectado: {trf} para processo {numero_processo}")
        return trf

    # =========================================================================
    # BUSCA DE PROCESSOS
    # =========================================================================

    def buscar_por_numero(
        self,
        numero_processo: str,
        trf: Optional[str] = None
    ) -> ProcessoPJe:
        """
        Busca processo por numero CNJ

        Args:
            numero_processo: Numero do processo (formato CNJ)
            trf: TRF especifico (opcional, auto-detecta se nao fornecido)

        Returns:
            ProcessoPJe com dados do processo

        Raises:
            PJeProcessoNaoEncontrado: Se processo nao encontrado
            PJeSegredoJustica: Se processo em segredo de justica
            PJeValidationError: Se numero invalido
        """
        # Valida numero
        if not validar_numero_cnj(numero_processo):
            raise PJeValidationError(f"Numero de processo invalido: {numero_processo}")

        # Detecta TRF se nao fornecido
        if not trf:
            trf = self.detectar_trf(numero_processo)

        self.logger.info(f"Buscando processo {numero_processo} em {trf}")

        # Formata numero
        numero_formatado = formatar_numero_cnj(numero_processo)

        # Verifica cache
        cache_key = f"processo:{numero_formatado}:{trf}"
        cached = self.cache.get(cache_key)
        if cached:
            self.logger.info("Retornando resultado do cache")
            return ProcessoPJe(**cached)

        # Busca no PJe
        base_url = TRF_URLS[trf]
        consulta_url = urljoin(base_url, PJE_ENDPOINTS["consulta_publica"])

        params = {
            'numeroProcesso': numero_formatado.replace('-', '').replace('.', ''),
        }

        try:
            response = self._fazer_requisicao(trf, consulta_url, params=params)
            html = response.text

            # Verifica segredo de justica
            if self._detectar_segredo_justica(html):
                raise PJeSegredoJustica(f"Processo {numero_formatado} em segredo de justica")

            # Verifica se encontrou
            if self._processo_nao_encontrado(html):
                raise PJeProcessoNaoEncontrado(f"Processo {numero_formatado} nao encontrado")

            # Extrai dados
            processo = self._extrair_dados_processo(html, numero_formatado, trf)

            # Salva no cache
            self.cache.set(cache_key, processo.to_dict())

            return processo

        except (PJeProcessoNaoEncontrado, PJeSegredoJustica):
            raise
        except Exception as e:
            self.logger.error(f"Erro ao buscar processo: {e}")
            raise

    def buscar_por_cpf(
        self,
        cpf: str,
        trf: Optional[str] = None
    ) -> List[ProcessoPJe]:
        """
        Busca processos por CPF

        Args:
            cpf: CPF da parte
            trf: TRF especifico (None busca em todos)

        Returns:
            Lista de ProcessoPJe encontrados

        Raises:
            PJeValidationError: Se CPF invalido
        """
        if not validar_cpf(cpf):
            raise PJeValidationError(f"CPF invalido: {cpf}")

        cpf_limpo = re.sub(r'\D', '', cpf)
        self.logger.info(f"Buscando processos por CPF {cpf_limpo[:3]}***")

        processos = []
        trfs_para_buscar = [trf] if trf else list(TRF_URLS.keys())

        for trf_atual in trfs_para_buscar:
            try:
                processos_trf = self._buscar_por_documento(trf_atual, cpf_limpo, "CPF")
                processos.extend(processos_trf)
            except Exception as e:
                self.logger.warning(f"Erro ao buscar em {trf_atual}: {e}")

        self.logger.info(f"Total de processos encontrados: {len(processos)}")
        return processos

    def buscar_por_cnpj(
        self,
        cnpj: str,
        trf: Optional[str] = None
    ) -> List[ProcessoPJe]:
        """
        Busca processos por CNPJ

        Args:
            cnpj: CNPJ da parte
            trf: TRF especifico (None busca em todos)

        Returns:
            Lista de ProcessoPJe encontrados
        """
        if not validar_cnpj(cnpj):
            raise PJeValidationError(f"CNPJ invalido: {cnpj}")

        cnpj_limpo = re.sub(r'\D', '', cnpj)
        self.logger.info(f"Buscando processos por CNPJ {cnpj_limpo[:8]}***")

        processos = []
        trfs_para_buscar = [trf] if trf else list(TRF_URLS.keys())

        for trf_atual in trfs_para_buscar:
            try:
                processos_trf = self._buscar_por_documento(trf_atual, cnpj_limpo, "CNPJ")
                processos.extend(processos_trf)
            except Exception as e:
                self.logger.warning(f"Erro ao buscar em {trf_atual}: {e}")

        return processos

    def buscar_por_oab(
        self,
        oab_numero: str,
        oab_estado: str,
        trf: Optional[str] = None
    ) -> List[ProcessoPJe]:
        """
        Busca processos por OAB do advogado

        Args:
            oab_numero: Numero da OAB
            oab_estado: Estado da OAB (UF)
            trf: TRF especifico (None busca em todos)

        Returns:
            Lista de ProcessoPJe encontrados
        """
        oab_numero_limpo = re.sub(r'\D', '', oab_numero)
        oab_estado_upper = oab_estado.upper()

        self.logger.info(f"Buscando processos por OAB/{oab_estado_upper} {oab_numero_limpo}")

        processos = []
        trfs_para_buscar = [trf] if trf else list(TRF_URLS.keys())

        for trf_atual in trfs_para_buscar:
            try:
                base_url = TRF_URLS[trf_atual]
                consulta_url = urljoin(base_url, PJE_ENDPOINTS["consulta_publica"])

                params = {
                    'numeroOAB': oab_numero_limpo,
                    'ufOAB': oab_estado_upper,
                }

                response = self._fazer_requisicao(trf_atual, consulta_url, params=params)
                processos_trf = self._extrair_lista_processos(response.text, trf_atual)
                processos.extend(processos_trf)

            except Exception as e:
                self.logger.warning(f"Erro ao buscar em {trf_atual}: {e}")

        return processos

    def _buscar_por_documento(
        self,
        trf: str,
        documento: str,
        tipo_doc: str
    ) -> List[ProcessoPJe]:
        """Busca processos por documento (CPF/CNPJ)"""
        base_url = TRF_URLS[trf]
        consulta_url = urljoin(base_url, PJE_ENDPOINTS["consulta_publica"])

        params = {
            'numeroDocumento': documento,
        }

        response = self._fazer_requisicao(trf, consulta_url, params=params)
        return self._extrair_lista_processos(response.text, trf)

    def _extrair_lista_processos(self, html: str, trf: str) -> List[ProcessoPJe]:
        """Extrai lista de processos do HTML de resultados"""
        processos = []

        if not BS4_AVAILABLE:
            return processos

        soup = BeautifulSoup(html, 'html.parser')

        # Procura links de processos
        links = soup.find_all('a', href=re.compile(r'processo|numero'))

        for link in links:
            texto = limpar_html(link.get_text())
            # Tenta extrair numero CNJ
            match = re.search(r'\d{7}-?\d{2}\.?\d{4}\.?\d\.?\d{2}\.?\d{4}', texto)
            if match:
                numero = formatar_numero_cnj(match.group())
                try:
                    processo = ProcessoPJe(
                        numero_processo=numero,
                        tribunal=trf
                    )
                    processos.append(processo)
                except Exception:
                    pass

        return processos

    # =========================================================================
    # EXTRACAO DE DADOS
    # =========================================================================

    def _extrair_dados_processo(self, html: str, numero: str, trf: str) -> ProcessoPJe:
        """Extrai todos os dados do processo do HTML"""
        if not BS4_AVAILABLE:
            return ProcessoPJe(numero_processo=numero, tribunal=trf)

        soup = BeautifulSoup(html, 'html.parser')

        processo = ProcessoPJe(
            numero_processo=numero,
            tribunal=trf,
            sistema="PJe",
        )

        try:
            # Dados basicos
            processo.classe = self._extrair_campo(soup, ['classe', 'classeProcessual'])
            processo.assunto = self._extrair_campo(soup, ['assunto', 'assuntoPrincipal'])
            processo.orgao_julgador = self._extrair_campo(soup, ['orgaoJulgador', 'vara', 'unidade'])
            processo.vara = self._extrair_campo(soup, ['vara', 'unidadeJudicial'])

            # Datas
            data_dist = self._extrair_campo(soup, ['dataDistribuicao', 'distribuicao'])
            if data_dist:
                processo.data_distribuicao = parsear_data(data_dist)

            # Valor da causa
            valor_str = self._extrair_campo(soup, ['valorCausa', 'valor'])
            if valor_str:
                processo.valor_causa = parsear_valor_monetario(valor_str)

            # Partes
            processo.partes = self._extrair_partes(soup)

            # Advogados
            processo.advogados = self._extrair_advogados(soup)

            # Movimentacoes
            processo.movimentacoes = self._extrair_movimentacoes(soup)

            # Documentos
            processo.documentos = self._extrair_documentos(soup)

            # Segredo de justica
            processo.segredo_justica = self._detectar_segredo_justica(html)

        except Exception as e:
            self.logger.warning(f"Erro ao extrair dados: {e}")
            processo.erros.append(str(e))

        return processo

    def _extrair_campo(self, soup: BeautifulSoup, nomes: List[str]) -> Optional[str]:
        """Extrai valor de um campo por possiveis nomes/IDs"""
        for nome in nomes:
            # Por ID
            elem = soup.find(id=re.compile(nome, re.I))
            if elem:
                valor = limpar_html(elem.get_text())
                if valor:
                    return valor

            # Por classe
            elem = soup.find(class_=re.compile(nome, re.I))
            if elem:
                valor = limpar_html(elem.get_text())
                if valor:
                    return valor

            # Por label
            label = soup.find(string=re.compile(nome, re.I))
            if label:
                parent = label.parent
                if parent:
                    next_elem = parent.find_next_sibling() or parent.find_next()
                    if next_elem:
                        valor = limpar_html(next_elem.get_text())
                        if valor:
                            return valor

        return None

    def _extrair_partes(self, soup: BeautifulSoup) -> List[Dict]:
        """Extrai partes do processo"""
        partes = []

        # Mapeamento de tipos
        tipo_map = {
            'autor': TipoParte.AUTOR.value,
            'requerente': TipoParte.REQUERENTE.value,
            'exequente': TipoParte.EXEQUENTE.value,
            'embargante': TipoParte.EMBARGANTE.value,
            'reu': TipoParte.REU.value,
            're': TipoParte.REU.value,
            'requerido': TipoParte.REQUERIDO.value,
            'executado': TipoParte.EXECUTADO.value,
            'embargado': TipoParte.EMBARGADO.value,
        }

        # Procura tabela de partes
        tabela = soup.find('table', id=re.compile(r'parte|polo', re.I))
        if tabela:
            rows = tabela.find_all('tr')
            for row in rows:
                cols = row.find_all('td')
                if len(cols) >= 2:
                    tipo_text = limpar_html(cols[0].get_text()).lower()
                    nome = limpar_html(cols[1].get_text())

                    tipo = TipoParte.OUTRO.value
                    for key, value in tipo_map.items():
                        if key in tipo_text:
                            tipo = value
                            break

                    if nome:
                        # Extrai documento
                        documento = None
                        tipo_doc = None
                        cpf_match = CPF_PATTERN.search(cols[1].get_text())
                        if cpf_match:
                            documento = formatar_cpf(cpf_match.group())
                            tipo_doc = "CPF"
                        else:
                            cnpj_match = CNPJ_PATTERN.search(cols[1].get_text())
                            if cnpj_match:
                                documento = formatar_cnpj(cnpj_match.group())
                                tipo_doc = "CNPJ"

                        parte = Parte(
                            tipo=tipo,
                            nome=nome,
                            documento=documento,
                            tipo_documento=tipo_doc
                        )
                        partes.append(parte.to_dict())

        return partes

    def _extrair_advogados(self, soup: BeautifulSoup) -> List[Dict]:
        """Extrai advogados do processo"""
        advogados = []

        # Procura mencoes a OAB
        for match in OAB_PATTERN.finditer(str(soup)):
            oab_estado = match.group(1).upper()
            oab_numero = match.group(2)

            # Tenta encontrar nome do advogado proximo
            nome = "Advogado"  # Padrao
            parent = soup.find(string=re.compile(f"OAB.*{oab_estado}.*{oab_numero}", re.I))
            if parent:
                texto_completo = limpar_html(parent.parent.get_text() if parent.parent else str(parent))
                # Remove a parte da OAB para pegar so o nome
                nome_match = re.match(r'^([^(OAB)]+)', texto_completo)
                if nome_match:
                    nome = nome_match.group(1).strip()

            adv = Advogado(
                nome=nome,
                oab_numero=oab_numero,
                oab_estado=oab_estado
            )
            advogados.append(adv.to_dict())

        return advogados

    def _extrair_movimentacoes(self, soup: BeautifulSoup) -> List[Dict]:
        """Extrai movimentacoes do processo"""
        movimentacoes = []

        # Procura tabela de movimentacoes
        tabela = soup.find('table', id=re.compile(r'moviment|andamento', re.I))
        if not tabela:
            tabela = soup.find('div', id=re.compile(r'moviment|andamento', re.I))

        if tabela:
            rows = tabela.find_all('tr') or tabela.find_all('div', class_=re.compile(r'linha|item', re.I))

            for row in rows:
                cols = row.find_all('td') or row.find_all('span')

                if len(cols) >= 2:
                    data_texto = limpar_html(cols[0].get_text())
                    descricao = limpar_html(cols[1].get_text())

                    data, hora = parsear_datetime(data_texto)

                    if data and descricao:
                        # Verifica documento vinculado
                        doc_link = row.find('a', href=True)
                        doc_url = None
                        doc_id = None
                        if doc_link:
                            href = doc_link.get('href', '')
                            if 'documento' in href.lower():
                                doc_url = href
                                doc_match = re.search(r'idDoc=(\d+)', href)
                                if doc_match:
                                    doc_id = doc_match.group(1)

                        mov = Movimentacao(
                            data=data,
                            hora=hora,
                            descricao=descricao,
                            documento_vinculado=doc_id,
                            documento_url=doc_url
                        )
                        movimentacoes.append(mov.to_dict())

        # Ordena por data (mais recente primeiro)
        movimentacoes.sort(key=lambda x: x.get('data', ''), reverse=True)

        return movimentacoes

    def _extrair_documentos(self, soup: BeautifulSoup) -> List[Dict]:
        """Extrai lista de documentos do processo"""
        documentos = []

        # Procura links de documentos
        for link in soup.find_all('a', href=True):
            href = link.get('href', '')
            if 'documento' in href.lower() or 'download' in href.lower() or '.pdf' in href.lower():
                texto = limpar_html(link.get_text())

                # Identifica tipo
                tipo = TipoDocumento.OUTRO.value
                texto_lower = texto.lower()

                tipo_map = {
                    'peticao inicial': TipoDocumento.PETICAO_INICIAL.value,
                    'contestacao': TipoDocumento.CONTESTACAO.value,
                    'sentenca': TipoDocumento.SENTENCA.value,
                    'acordao': TipoDocumento.ACORDAO.value,
                    'despacho': TipoDocumento.DESPACHO.value,
                    'decisao': TipoDocumento.DECISAO.value,
                    'certidao': TipoDocumento.CERTIDAO.value,
                }

                for key, value in tipo_map.items():
                    if key in texto_lower:
                        tipo = value
                        break

                # Extrai ID do documento
                doc_id = None
                id_match = re.search(r'idDoc=(\d+)', href)
                if id_match:
                    doc_id = id_match.group(1)

                doc = Documento(
                    id=doc_id,
                    tipo=tipo,
                    nome=texto,
                    url=href,
                    sigiloso='sigilo' in texto_lower or 'restrito' in texto_lower
                )
                documentos.append(doc.to_dict())

        return documentos

    def extrair_movimentacoes(self, processo_id: str, trf: Optional[str] = None) -> List[Dict]:
        """
        Extrai linha do tempo completa do processo

        Args:
            processo_id: Numero do processo
            trf: TRF especifico (auto-detecta se nao fornecido)

        Returns:
            Lista de movimentacoes ordenadas cronologicamente
        """
        processo = self.buscar_por_numero(processo_id, trf)
        return processo.movimentacoes

    def extrair_intimacoes(self, processo_id: str, trf: Optional[str] = None) -> List[Dict]:
        """
        Extrai intimacoes pendentes do processo

        Args:
            processo_id: Numero do processo
            trf: TRF especifico

        Returns:
            Lista de intimacoes
        """
        if not trf:
            trf = self.detectar_trf(processo_id)

        # Requer autenticacao
        if not self._authenticated.get(trf):
            self.logger.warning(f"Extracaoo de intimacoes requer login em {trf}")
            return []

        base_url = TRF_URLS[trf]
        intimacoes_url = urljoin(base_url, PJE_ENDPOINTS["intimacoes"])

        try:
            response = self._fazer_requisicao(trf, intimacoes_url, params={
                'numeroProcesso': processo_id.replace('-', '').replace('.', '')
            })

            return self._extrair_intimacoes_html(response.text)

        except Exception as e:
            self.logger.error(f"Erro ao extrair intimacoes: {e}")
            return []

    def _extrair_intimacoes_html(self, html: str) -> List[Dict]:
        """Extrai intimacoes do HTML"""
        intimacoes = []

        if not BS4_AVAILABLE:
            return intimacoes

        soup = BeautifulSoup(html, 'html.parser')

        # Procura tabela de intimacoes
        tabela = soup.find('table', id=re.compile(r'intimac', re.I))
        if tabela:
            rows = tabela.find_all('tr')[1:]  # Pula header

            for row in rows:
                cols = row.find_all('td')
                if len(cols) >= 3:
                    tipo_text = limpar_html(cols[0].get_text()).lower()
                    data = parsear_data(cols[1].get_text())
                    descricao = limpar_html(cols[2].get_text())

                    # Identifica tipo
                    tipo = TipoIntimacao.INTIMACAO.value
                    if 'carga' in tipo_text:
                        tipo = TipoIntimacao.CARGA.value
                    elif 'vista' in tipo_text:
                        tipo = TipoIntimacao.VISTA.value
                    elif 'citacao' in tipo_text:
                        tipo = TipoIntimacao.CITACAO.value

                    # Extrai prazo se disponivel
                    prazo = None
                    prazo_match = re.search(r'(\d+)\s*dias?', descricao)
                    if prazo_match:
                        prazo = int(prazo_match.group(1))

                    intimacao = Intimacao(
                        tipo=tipo,
                        data_disponibilizacao=data,
                        prazo_dias=prazo,
                        descricao=descricao
                    )
                    intimacoes.append(intimacao.to_dict())

        return intimacoes

    # =========================================================================
    # DOWNLOAD DE DOCUMENTOS
    # =========================================================================

    def baixar_documento(
        self,
        doc_id: str,
        output_path: str,
        trf: str,
        validar_integridade: bool = True
    ) -> bool:
        """
        Baixa documento do processo

        Args:
            doc_id: ID do documento no PJe
            output_path: Caminho para salvar o arquivo
            trf: TRF do processo
            validar_integridade: Se deve calcular hashes MD5/SHA256

        Returns:
            True se download bem-sucedido
        """
        base_url = TRF_URLS[trf]
        doc_url = urljoin(base_url, f"{PJE_ENDPOINTS['documento']}?idDoc={doc_id}")

        self.logger.info(f"Baixando documento {doc_id} de {trf}")

        try:
            response = self._fazer_requisicao(trf, doc_url)

            if response.status_code != 200:
                self.logger.error(f"Erro ao baixar documento: HTTP {response.status_code}")
                return False

            # Verifica tipo de conteudo
            content_type = response.headers.get('content-type', '')
            if 'pdf' not in content_type.lower() and 'octet' not in content_type.lower():
                self.logger.warning(f"Tipo de conteudo inesperado: {content_type}")

            # Salva arquivo
            output_file = Path(output_path)
            output_file.parent.mkdir(parents=True, exist_ok=True)

            with open(output_file, 'wb') as f:
                f.write(response.content)

            # Valida integridade
            if validar_integridade:
                hash_md5 = calcular_hash_arquivo(str(output_file), "md5")
                hash_sha256 = calcular_hash_arquivo(str(output_file), "sha256")
                self.logger.debug(f"Documento salvo | MD5: {hash_md5} | SHA256: {hash_sha256[:16]}...")

            self.logger.info(f"Documento salvo: {output_path}")
            return True

        except Exception as e:
            self.logger.error(f"Erro ao baixar documento: {e}")
            return False

    def baixar_documentos(
        self,
        processo: ProcessoPJe,
        output_dir: str = "./output",
        tipos: Optional[List[str]] = None
    ) -> List[str]:
        """
        Baixa documentos do processo

        Args:
            processo: ProcessoPJe com lista de documentos
            output_dir: Diretorio para salvar documentos
            tipos: Lista de tipos de documento a baixar (None = todos)

        Returns:
            Lista de caminhos dos arquivos baixados
        """
        if processo.segredo_justica:
            self.logger.warning("Processo em segredo de justica - nao e possivel baixar documentos")
            return []

        arquivos_baixados = []
        output_path = Path(output_dir)
        output_path.mkdir(parents=True, exist_ok=True)

        numero_limpo = re.sub(r'\D', '', processo.numero_processo)

        for doc in processo.documentos:
            # Filtra por tipo
            if tipos and doc.get('tipo') not in tipos:
                continue

            # Verifica se e sigiloso
            if doc.get('sigiloso'):
                self.logger.info(f"Pulando documento sigiloso: {doc.get('nome')}")
                continue

            doc_id = doc.get('id')
            if not doc_id:
                continue

            # Gera nome do arquivo
            tipo = doc.get('tipo', 'documento')
            data = doc.get('data', datetime.now().strftime('%Y%m%d'))
            nome_arquivo = f"{numero_limpo}_{tipo}_{data}_{doc_id}.pdf"
            nome_arquivo = re.sub(r'[^\w\-_\.]', '_', nome_arquivo)

            caminho = output_path / nome_arquivo

            if self.baixar_documento(doc_id, str(caminho), processo.tribunal):
                arquivos_baixados.append(str(caminho))

        self.logger.info(f"Documentos baixados: {len(arquivos_baixados)}")
        return arquivos_baixados

    # =========================================================================
    # DETECCAO DE ESTADOS
    # =========================================================================

    def _detectar_segredo_justica(self, html: str) -> bool:
        """Detecta se processo esta em segredo de justica"""
        indicadores = [
            'segredo de justica',
            'segredo de justiça',
            'processo sigiloso',
            'acesso restrito',
            'identificacao necessaria',
            'login necessario para visualizar',
        ]
        html_lower = html.lower()
        return any(ind in html_lower for ind in indicadores)

    def _processo_nao_encontrado(self, html: str) -> bool:
        """Detecta se processo nao foi encontrado"""
        indicadores = [
            'nao encontrado',
            'não encontrado',
            'nenhum processo',
            'nao existem dados',
            'não existem dados',
            'nenhum resultado',
        ]
        html_lower = html.lower()
        return any(ind in html_lower for ind in indicadores)

    # =========================================================================
    # HEALTH CHECK
    # =========================================================================

    def health_check(self, trf: Optional[str] = None) -> Dict[str, Any]:
        """
        Verifica disponibilidade do PJe.

        Formato padronizado de resposta compatível com validador.

        Args:
            trf: TRF específico para testar. Se None, testa todos.

        Returns:
            Dict com status padronizado:
            - Se trf específico: formato simples {status, latency_ms, trf}
            - Se None: formato detalhado {status, trfs, overall}

        Example:
            >>> scraper = PJeScraper()
            >>> health = scraper.health_check(trf="TRF1")
            >>> print(health['status'])
            'ok'
        """
        # Se TRF específico, formato simples
        if trf:
            try:
                base_url = TRF_URLS[trf]
                start_time = time.time()
                response = self._fazer_requisicao(trf, base_url)
                latency_ms = int((time.time() - start_time) * 1000)

                if response.status_code == 200:
                    self.logger.info(f"Health check OK | trf={trf} | latencia={latency_ms}ms")
                    return {
                        'status': 'ok',
                        'latency_ms': latency_ms,
                        'trf': trf,
                        'url': base_url
                    }
                else:
                    self.logger.warning(f"Health check falhou | trf={trf} | status={response.status_code}")
                    return {
                        'status': 'error',
                        'latency_ms': latency_ms,
                        'trf': trf,
                        'message': f'HTTP {response.status_code}'
                    }

            except Exception as e:
                self.logger.error(f"Health check erro | trf={trf}: {e}")
                return {
                    'status': 'error',
                    'latency_ms': 0,
                    'trf': trf,
                    'message': str(e)
                }

        # Se None, formato detalhado (todos os TRFs)
        status = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "trfs": {}
        }

        for trf_atual in list(TRF_URLS.keys()):
            try:
                base_url = TRF_URLS[trf_atual]
                start_time = time.time()
                response = self._fazer_requisicao(trf_atual, base_url)
                latency_ms = int((time.time() - start_time) * 1000)

                status["trfs"][trf_atual] = {
                    "status": "ok" if response.status_code == 200 else "error",
                    "status_code": response.status_code,
                    "latency_ms": latency_ms,
                    "circuit_breaker": self.circuit_breakers[trf_atual].state.value,
                }

            except Exception as e:
                status["trfs"][trf_atual] = {
                    "status": "error",
                    "error": str(e),
                    "circuit_breaker": self.circuit_breakers[trf_atual].state.value,
                }

        # Status geral
        online_count = sum(1 for t in status["trfs"].values() if t.get("status") == "ok")
        total_count = len(status["trfs"])
        status["status"] = "ok" if online_count == total_count else (
            "degraded" if online_count > 0 else "error"
        )
        status["online_count"] = online_count
        status["total_count"] = total_count

        return status

    def verificar_status(self) -> Dict[str, Any]:
        """Alias para health_check"""
        return self.health_check()

    def limpar_cache(self):
        """Limpa todo o cache"""
        self.cache.clear()
        self.logger.info("Cache limpo")


# =============================================================================
# FUNCAO PRINCIPAL PARA USO VIA API
# =============================================================================

async def extrair_processo_pje(
    numero_processo: str,
    trf: Optional[str] = None,
    baixar_docs: bool = False,
    output_dir: str = "./output",
    cache_enabled: bool = True
) -> Dict:
    """
    Funcao principal para extracao de processo do PJe

    Args:
        numero_processo: Numero do processo (formato CNJ)
        trf: TRF especifico (None para auto-detectar)
        baixar_docs: Se deve baixar documentos
        output_dir: Diretorio para salvar documentos
        cache_enabled: Se deve usar cache

    Returns:
        Dict com todos os dados do processo

    Raises:
        PJeProcessoNaoEncontrado: Se processo nao encontrado
        PJeSegredoJustica: Se processo em segredo de justica
        PJeValidationError: Se numero invalido
    """
    scraper = PJeScraper(cache_enabled=cache_enabled)

    try:
        processo = scraper.buscar_por_numero(numero_processo, trf)

        if baixar_docs and not processo.segredo_justica:
            arquivos = scraper.baixar_documentos(processo, output_dir)
            # Atualiza documentos com caminhos locais
            for i, doc in enumerate(processo.documentos):
                if i < len(arquivos):
                    doc['arquivo_local'] = arquivos[i]

        return processo.to_dict()

    except PJeSegredoJustica:
        return {
            "numero_processo": numero_processo,
            "tribunal": trf or "JF",
            "sistema": "PJe",
            "segredo_justica": True,
            "erros": ["Processo em segredo de justica - acesso restrito"],
            "timestamp_extracao": datetime.now(timezone.utc).isoformat()
        }


def extrair_processo_pje_sync(
    numero_processo: str,
    trf: Optional[str] = None,
    baixar_docs: bool = False,
    output_dir: str = "./output",
    cache_enabled: bool = True
) -> Dict:
    """
    Versao sincrona da funcao de extracao

    Args:
        numero_processo: Numero do processo (formato CNJ)
        trf: TRF especifico (None para auto-detectar)
        baixar_docs: Se deve baixar documentos
        output_dir: Diretorio para salvar documentos
        cache_enabled: Se deve usar cache

    Returns:
        Dict com todos os dados do processo
    """
    return asyncio.run(extrair_processo_pje(
        numero_processo,
        trf,
        baixar_docs,
        output_dir,
        cache_enabled
    ))


# =============================================================================
# INTERFACE DE LINHA DE COMANDO
# =============================================================================

def main():
    """Funcao principal para execucao via CLI"""
    import argparse

    parser = argparse.ArgumentParser(
        description="PJe Scraper - Extrator de processos da Justica Federal",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Exemplos de uso:

  # Buscar processo por numero (auto-detecta TRF)
  python pje_scraper.py --numero 0000000-00.2024.4.01.0000

  # Buscar em TRF especifico
  python pje_scraper.py --numero 0000000-00.2024.4.01.0000 --trf TRF1

  # Buscar por CPF
  python pje_scraper.py --cpf 123.456.789-00

  # Buscar por CNPJ
  python pje_scraper.py --cnpj 00.000.000/0001-00

  # Buscar por OAB
  python pje_scraper.py --oab-numero 123456 --oab-estado SP

  # Login com certificado digital
  python pje_scraper.py --cert /caminho/certificado.pfx --cert-senha senha

  # Baixar documentos
  python pje_scraper.py --numero 0000000-00.2024.4.01.0000 --baixar-docs --output ./docs

  # Saida em JSON
  python pje_scraper.py --numero 0000000-00.2024.4.01.0000 --json

  # Health check
  python pje_scraper.py --health-check

  # Verificar status de todos os TRFs
  python pje_scraper.py --status
        """
    )

    # Busca
    parser.add_argument("--numero", "-n", help="Numero do processo (formato CNJ)")
    parser.add_argument("--trf", "-t", choices=["TRF1", "TRF2", "TRF3", "TRF4", "TRF5"],
                        help="TRF especifico")
    parser.add_argument("--cpf", help="CPF para busca")
    parser.add_argument("--cnpj", help="CNPJ para busca")
    parser.add_argument("--oab-numero", help="Numero da OAB")
    parser.add_argument("--oab-estado", help="Estado da OAB (UF)")

    # Autenticacao
    parser.add_argument("--cert", help="Caminho do certificado digital A1 (.pfx/.p12)")
    parser.add_argument("--cert-senha", help="Senha do certificado")
    parser.add_argument("--usuario", "-u", help="Usuario (CPF) para login")
    parser.add_argument("--senha", "-s", help="Senha para login")

    # Download
    parser.add_argument("--baixar-docs", "-d", action="store_true",
                        help="Baixar documentos do processo")
    parser.add_argument("--output", "-o", default="./output",
                        help="Diretorio para salvar documentos")

    # Cache e configuracoes
    parser.add_argument("--sem-cache", action="store_true", help="Desabilitar cache")
    parser.add_argument("--limpar-cache", action="store_true", help="Limpar cache e sair")
    parser.add_argument("--debug", action="store_true", help="Habilitar logs de debug")

    # Status
    parser.add_argument("--status", action="store_true", help="Verificar status do scraper")
    parser.add_argument("--health-check", action="store_true", help="Health check dos TRFs")

    # Saida
    parser.add_argument("--json", action="store_true", help="Saida em formato JSON")

    args = parser.parse_args()

    # Configura log
    log_level = logging.DEBUG if args.debug else logging.INFO

    # Inicializa scraper
    scraper = PJeScraper(
        certificado_path=args.cert,
        certificado_senha=args.cert_senha,
        cache_enabled=not args.sem_cache,
        log_level=log_level
    )

    try:
        # Limpar cache
        if args.limpar_cache:
            scraper.limpar_cache()
            print("Cache limpo com sucesso!")
            return

        # Health check
        if args.health_check or args.status:
            status = scraper.health_check(args.trf)
            if args.json:
                print(json.dumps(status, indent=2, ensure_ascii=False))
            else:
                print(f"\n{'='*60}")
                print("  PJe Scraper - Health Check")
                print(f"{'='*60}")
                print(f"\nStatus Geral: {status['overall'].upper()}")
                print(f"\nTRFs:")
                for trf_name, trf_status in status["trfs"].items():
                    status_icon = "OK" if trf_status.get("status") == "online" else "FALHA"
                    latency = trf_status.get("latency_ms", "N/A")
                    print(f"  {trf_name}: [{status_icon}] {trf_status.get('status')} | Latencia: {latency}ms")
            return

        # Login se credenciais fornecidas
        if args.usuario and args.senha:
            trf_login = args.trf or "TRF1"
            scraper.login(trf_login, args.usuario, args.senha)

        resultado = None

        # Busca por numero
        if args.numero:
            processo = scraper.buscar_por_numero(args.numero, args.trf)

            if args.baixar_docs and not processo.segredo_justica:
                scraper.baixar_documentos(processo, args.output)

            resultado = processo.to_dict()

        # Busca por CPF
        elif args.cpf:
            processos = scraper.buscar_por_cpf(args.cpf, args.trf)
            resultado = [p.to_dict() for p in processos]

        # Busca por CNPJ
        elif args.cnpj:
            processos = scraper.buscar_por_cnpj(args.cnpj, args.trf)
            resultado = [p.to_dict() for p in processos]

        # Busca por OAB
        elif args.oab_numero and args.oab_estado:
            processos = scraper.buscar_por_oab(args.oab_numero, args.oab_estado, args.trf)
            resultado = [p.to_dict() for p in processos]

        else:
            parser.print_help()
            return

        # Exibe resultado
        if resultado:
            if args.json:
                print(json.dumps(resultado, indent=2, ensure_ascii=False))
            else:
                if isinstance(resultado, list):
                    print(f"\n{'='*60}")
                    print(f"  {len(resultado)} processos encontrados")
                    print(f"{'='*60}\n")
                    for proc in resultado[:20]:  # Limita a 20
                        print(f"  - {proc['numero_processo']}: {proc.get('classe', 'N/A')}")
                    if len(resultado) > 20:
                        print(f"\n  ... e mais {len(resultado) - 20} processos")
                else:
                    print(f"\n{'='*60}")
                    print(f"  Processo {resultado['numero_processo']}")
                    print(f"{'='*60}")
                    print(f"\n  Tribunal: {resultado['tribunal']}")
                    print(f"  Sistema: {resultado['sistema']}")
                    print(f"  Classe: {resultado.get('classe', 'N/A')}")
                    print(f"  Assunto: {resultado.get('assunto', 'N/A')}")
                    print(f"  Orgao Julgador: {resultado.get('orgao_julgador', 'N/A')}")
                    print(f"  Valor da Causa: R$ {resultado.get('valor_causa', 'N/A')}")
                    print(f"  Partes: {len(resultado.get('partes', []))}")
                    print(f"  Movimentacoes: {len(resultado.get('movimentacoes', []))}")
                    print(f"  Documentos: {len(resultado.get('documentos', []))}")
                    if resultado.get('segredo_justica'):
                        print("\n  *** PROCESSO EM SEGREDO DE JUSTICA ***")

    except PJeProcessoNaoEncontrado as e:
        print(f"\nErro: {e}")
        sys.exit(1)

    except PJeSegredoJustica as e:
        print(f"\nAviso: {e}")
        print("Processo em segredo de justica - dados restritos")

    except PJeValidationError as e:
        print(f"\nErro de validacao: {e}")
        sys.exit(1)

    except PJeAuthenticationError as e:
        print(f"\nErro de autenticacao: {e}")
        sys.exit(1)

    except PJeConnectionError as e:
        print(f"\nErro de conexao: {e}")
        sys.exit(1)

    except Exception as e:
        print(f"\nErro inesperado: {e}")
        if args.debug:
            import traceback
            traceback.print_exc()
        sys.exit(1)


# =============================================================================
# PONTO DE ENTRADA
# =============================================================================

if __name__ == "__main__":
    main()
