#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
ESAJ Scraper - Tribunal de Justica de Sao Paulo
Extracao automatizada de processos do sistema e-SAJ

Este modulo fornece uma implementacao completa e profissional para:
- Busca de processos por numero CNJ (1o e 2o grau)
- Busca de processos por CPF/CNPJ
- Extracao completa de dados processuais
- Download de documentos publicos
- Deteccao de segredo de justica
- Tratamento de CAPTCHA com fallback
- Rate limiting rigoroso (1 req/s)
- Cache de consultas recentes
- Logs estruturados detalhados

Endpoints mapeados:
- cpopg: Consulta Processual de 1o Grau
- cposg: Consulta Processual de 2o Grau
- cjpg: Consulta de Julgados 1o Grau (sentencas)
- cjsg: Consulta de Julgados 2o Grau (acordaos)

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
    import httpx
    HTTPX_AVAILABLE = True
except ImportError:
    HTTPX_AVAILABLE = False
    httpx = None

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

# Tentar importar PIL/Pillow para OCR de CAPTCHA
try:
    from PIL import Image
    import io
    PIL_AVAILABLE = True
except ImportError:
    PIL_AVAILABLE = False
    Image = None

# Tentar importar pytesseract para OCR
try:
    import pytesseract
    TESSERACT_AVAILABLE = True
except ImportError:
    TESSERACT_AVAILABLE = False
    pytesseract = None


# =============================================================================
# CONSTANTES E CONFIGURACOES
# =============================================================================

# URLs base do ESAJ TJSP
BASE_URL_ESAJ = "https://esaj.tjsp.jus.br"
BASE_URL_1G = f"{BASE_URL_ESAJ}/cpopg"
BASE_URL_2G = f"{BASE_URL_ESAJ}/cposg"
BASE_URL_CJPG = f"{BASE_URL_ESAJ}/cjpg"
BASE_URL_CJSG = f"{BASE_URL_ESAJ}/cjsg"
BASE_URL_SAJ = f"{BASE_URL_ESAJ}/esaj"

# Endpoints especificos
ENDPOINTS_1G = {
    "open": f"{BASE_URL_1G}/open.do",
    "search": f"{BASE_URL_1G}/search.do",
    "show": f"{BASE_URL_1G}/show.do",
    "abrirDocumento": f"{BASE_URL_1G}/abrirDocumentoVinculadoMovimentacao.do",
}

ENDPOINTS_2G = {
    "open": f"{BASE_URL_2G}/open.do",
    "search": f"{BASE_URL_2G}/search.do",
    "show": f"{BASE_URL_2G}/show.do",
    "abrirDocumento": f"{BASE_URL_2G}/abrirDocumentoVinculadoMovimentacao.do",
}

# Configuracoes padrao
DEFAULT_TIMEOUT = 30  # segundos
DEFAULT_MAX_RETRIES = 3
DEFAULT_RATE_LIMIT = 1.0  # segundos entre requisicoes (RIGOROSO)
DEFAULT_CACHE_TTL = 3600  # 1 hora em segundos
DEFAULT_BACKOFF_FACTOR = 2.0  # fator de backoff exponencial
DEFAULT_LOG_MAX_SIZE = 10 * 1024 * 1024  # 10 MB
DEFAULT_LOG_BACKUP_COUNT = 5

# User-Agent realista (simular Chrome)
DEFAULT_USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
)

# Headers padrao para requisicoes
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

# Comarcas conhecidas do TJSP
COMARCAS_TJSP = {
    "0100": "Sao Paulo",
    "0001": "Aguai",
    "0002": "Aguas de Lindoia",
    # ... outras comarcas podem ser adicionadas
}

# Codigo do foro (TJSP sempre 8.26)
CODIGO_JUSTICA_ESTADUAL = "8"
CODIGO_TJSP = "26"


# =============================================================================
# ENUMS E TIPOS
# =============================================================================

class Instancia(str, Enum):
    """Instancias do TJSP"""
    PRIMEIRO_GRAU = "1"
    SEGUNDO_GRAU = "2"


class TipoBusca(str, Enum):
    """Tipos de busca disponiveis"""
    NUMERO_PROCESSO = "numero_processo"
    CPF = "cpf"
    CNPJ = "cnpj"
    NOME_PARTE = "nome_parte"
    OAB = "oab"


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
    TERCEIRO = "terceiro"
    INTERESSADO = "interessado"
    ADVOGADO = "advogado"
    MINISTÉRIO_PUBLICO = "ministerio_publico"
    JUIZ = "juiz"
    PERITO = "perito"
    TESTEMUNHA = "testemunha"
    OUTRO = "outro"


class TipoDocumento(str, Enum):
    """Tipos de documento processual"""
    PETICAO_INICIAL = "peticao_inicial"
    CONTESTACAO = "contestacao"
    REPLICA = "replica"
    SENTENCA = "sentenca"
    DESPACHO = "despacho"
    DECISAO = "decisao"
    ACORDAO = "acordao"
    EMBARGO = "embargo"
    RECURSO = "recurso"
    CERTIDAO = "certidao"
    ATA = "ata"
    LAUDO = "laudo"
    PARECER = "parecer"
    OFICIO = "oficio"
    MANDADO = "mandado"
    PROCURACAO = "procuracao"
    SUBSTABELECIMENTO = "substabelecimento"
    OUTRO = "outro"


class StatusCaptcha(str, Enum):
    """Status do CAPTCHA"""
    NAO_DETECTADO = "nao_detectado"
    DETECTADO = "detectado"
    RESOLVIDO = "resolvido"
    FALHA = "falha"
    MANUAL_NECESSARIO = "manual_necessario"


# =============================================================================
# DATACLASSES
# =============================================================================

@dataclass
class Parte:
    """Dados de uma parte processual"""
    tipo: str
    nome: str
    documento: Optional[str] = None
    tipo_documento: Optional[str] = None  # CPF ou CNPJ
    advogados: List[str] = field(default_factory=list)
    endereco: Optional[str] = None
    email: Optional[str] = None
    telefone: Optional[str] = None

    def to_dict(self) -> Dict:
        """Converte para dicionario"""
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
    descricao: str
    tipo: Optional[str] = None
    complemento: Optional[str] = None
    documento_vinculado: Optional[str] = None  # URL do documento

    def to_dict(self) -> Dict:
        """Converte para dicionario"""
        return {
            "data": self.data,
            "descricao": self.descricao,
            "tipo": self.tipo,
            "complemento": self.complemento,
            "documento_vinculado": self.documento_vinculado,
        }


@dataclass
class Documento:
    """Dados de um documento processual"""
    tipo: str
    data: Optional[str] = None
    descricao: Optional[str] = None
    url: Optional[str] = None
    tamanho_kb: Optional[int] = None
    arquivo_local: Optional[str] = None
    sigiloso: bool = False

    def to_dict(self) -> Dict:
        """Converte para dicionario"""
        return {
            "tipo": self.tipo,
            "data": self.data,
            "descricao": self.descricao,
            "url": self.url,
            "tamanho_kb": self.tamanho_kb,
            "arquivo_local": self.arquivo_local,
            "sigiloso": self.sigiloso,
        }


@dataclass
class Audiencia:
    """Dados de uma audiencia"""
    data: str
    hora: Optional[str] = None
    tipo: Optional[str] = None
    local: Optional[str] = None
    situacao: Optional[str] = None  # realizada, adiada, cancelada, etc.

    def to_dict(self) -> Dict:
        """Converte para dicionario"""
        return {
            "data": self.data,
            "hora": self.hora,
            "tipo": self.tipo,
            "local": self.local,
            "situacao": self.situacao,
        }


@dataclass
class ProcessoESAJ:
    """
    Dados completos de um processo do ESAJ

    Estrutura padrao para armazenar todas as informacoes
    extraidas de um processo do TJSP via sistema ESAJ.
    """
    numero_processo: str
    tribunal: str = "TJSP"
    sistema: str = "ESAJ"
    instancia: str = "1"  # "1" ou "2"

    # Dados basicos
    comarca: Optional[str] = None
    foro: Optional[str] = None
    vara: Optional[str] = None
    classe: Optional[str] = None
    assunto: Optional[str] = None
    assuntos_secundarios: List[str] = field(default_factory=list)
    area: Optional[str] = None

    # Datas
    data_distribuicao: Optional[str] = None
    data_ajuizamento: Optional[str] = None
    ultima_atualizacao: Optional[str] = None

    # Valores
    valor_causa: Optional[float] = None
    moeda: str = "BRL"

    # Partes
    partes: List[Dict] = field(default_factory=list)

    # Movimentacoes
    movimentacoes: List[Dict] = field(default_factory=list)

    # Documentos
    documentos: List[Dict] = field(default_factory=list)

    # Audiencias
    audiencias: List[Dict] = field(default_factory=list)

    # Dados de 2o grau (recursos)
    orgao_julgador: Optional[str] = None
    relator: Optional[str] = None
    turma: Optional[str] = None

    # Processos relacionados
    processo_origem: Optional[str] = None
    processos_dependentes: List[str] = field(default_factory=list)

    # Status e controle
    segredo_justica: bool = False
    justica_gratuita: bool = False
    prioridade: Optional[str] = None  # idoso, deficiente, etc.
    situacao: Optional[str] = None  # ativo, arquivado, suspenso, etc.

    # Metadados da extracao
    timestamp_extracao: Optional[str] = None
    url_consulta: Optional[str] = None
    codigo_processo: Optional[str] = None  # Codigo interno do ESAJ

    # Erros
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
        match = CNJ_PATTERN.match(self.numero_processo.replace(".", "").replace("-", ""))
        if match:
            n, d, a, j, t, o = match.groups()
            return f"{n}-{d}.{a}.{j}.{t}.{o}"
        return self.numero_processo


# =============================================================================
# EXCECOES CUSTOMIZADAS
# =============================================================================

class ESAJError(Exception):
    """Excecao base para erros do ESAJ"""
    pass


class ESAJConnectionError(ESAJError):
    """Erro de conexao com o ESAJ"""
    pass


class ESAJCaptchaError(ESAJError):
    """Erro relacionado a CAPTCHA"""
    pass


class ESAJProcessoNaoEncontrado(ESAJError):
    """Processo nao encontrado"""
    pass


class ESAJSegredoJustica(ESAJError):
    """Processo em segredo de justica"""
    pass


class ESAJRateLimitError(ESAJError):
    """Erro de rate limit"""
    pass


class ESAJValidationError(ESAJError):
    """Erro de validacao de dados"""
    pass


# =============================================================================
# UTILITARIOS
# =============================================================================

def normalizar_texto(texto: str) -> str:
    """Normaliza texto removendo acentos e caracteres especiais"""
    if not texto:
        return ""
    # Remove acentos
    texto = unicodedata.normalize('NFKD', texto)
    texto = texto.encode('ASCII', 'ignore').decode('ASCII')
    # Remove espacos extras
    texto = ' '.join(texto.split())
    return texto.strip()


def limpar_html(texto: str) -> str:
    """Remove tags HTML e limpa o texto"""
    if not texto:
        return ""
    # Remove tags HTML
    texto = re.sub(r'<[^>]+>', ' ', texto)
    # Remove entidades HTML
    texto = re.sub(r'&[a-z]+;', ' ', texto)
    # Remove espacos extras
    texto = ' '.join(texto.split())
    return texto.strip()


def formatar_numero_cnj(numero: str) -> str:
    """Formata numero de processo no padrao CNJ"""
    # Remove caracteres nao numericos
    numero_limpo = re.sub(r'\D', '', numero)

    if len(numero_limpo) != 20:
        return numero

    # Formato: NNNNNNN-DD.AAAA.J.TR.OOOO
    return f"{numero_limpo[:7]}-{numero_limpo[7:9]}.{numero_limpo[9:13]}.{numero_limpo[13]}.{numero_limpo[14:16]}.{numero_limpo[16:20]}"


def validar_numero_cnj(numero: str) -> bool:
    """Valida se o numero esta no formato CNJ"""
    numero_limpo = re.sub(r'\D', '', numero)
    return len(numero_limpo) == 20


def validar_cpf(cpf: str) -> bool:
    """Valida CPF"""
    cpf_limpo = re.sub(r'\D', '', cpf)
    if len(cpf_limpo) != 11:
        return False

    # Verifica se todos os digitos sao iguais
    if cpf_limpo == cpf_limpo[0] * 11:
        return False

    # Calcula primeiro digito verificador
    soma = sum(int(cpf_limpo[i]) * (10 - i) for i in range(9))
    resto = soma % 11
    digito1 = 0 if resto < 2 else 11 - resto

    # Calcula segundo digito verificador
    soma = sum(int(cpf_limpo[i]) * (11 - i) for i in range(10))
    resto = soma % 11
    digito2 = 0 if resto < 2 else 11 - resto

    return cpf_limpo[-2:] == f"{digito1}{digito2}"


def validar_cnpj(cnpj: str) -> bool:
    """Valida CNPJ"""
    cnpj_limpo = re.sub(r'\D', '', cnpj)
    if len(cnpj_limpo) != 14:
        return False

    # Verifica se todos os digitos sao iguais
    if cnpj_limpo == cnpj_limpo[0] * 14:
        return False

    # Calcula primeiro digito verificador
    pesos1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
    soma = sum(int(cnpj_limpo[i]) * pesos1[i] for i in range(12))
    resto = soma % 11
    digito1 = 0 if resto < 2 else 11 - resto

    # Calcula segundo digito verificador
    pesos2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
    soma = sum(int(cnpj_limpo[i]) * pesos2[i] for i in range(13))
    resto = soma % 11
    digito2 = 0 if resto < 2 else 11 - resto

    return cnpj_limpo[-2:] == f"{digito1}{digito2}"


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
        # Remove pontos de milhar e converte virgula para ponto
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

    # Tenta formato brasileiro (DD/MM/YYYY)
    match = DATA_PATTERN.search(texto)
    if match:
        dia, mes, ano = match.groups()
        return f"{ano}-{mes}-{dia}"

    # Tenta formato ISO
    match = DATA_ISO_PATTERN.search(texto)
    if match:
        return match.group(0)

    return texto


def gerar_hash_cache(chave: str) -> str:
    """Gera hash para chave de cache"""
    return hashlib.md5(chave.encode('utf-8')).hexdigest()


# =============================================================================
# SISTEMA DE CACHE
# =============================================================================

class CacheManager:
    """
    Gerenciador de cache para consultas do ESAJ

    Implementa cache em arquivo JSON com TTL configuravel.
    Evita requisicoes duplicadas e melhora performance.
    """

    def __init__(
        self,
        cache_dir: str = "./cache/esaj",
        ttl: int = DEFAULT_CACHE_TTL,
        enabled: bool = True
    ):
        """
        Inicializa o gerenciador de cache

        Args:
            cache_dir: Diretorio para armazenar cache
            ttl: Tempo de vida do cache em segundos
            enabled: Se o cache esta habilitado
        """
        self.cache_dir = Path(cache_dir)
        self.ttl = ttl
        self.enabled = enabled
        self._cache_file = self.cache_dir / "cache.json"
        self._cache: Dict[str, Dict] = {}
        self._load_cache()

    def _load_cache(self):
        """Carrega cache do arquivo"""
        if not self.enabled:
            return

        try:
            self.cache_dir.mkdir(parents=True, exist_ok=True)
            if self._cache_file.exists():
                with open(self._cache_file, 'r', encoding='utf-8') as f:
                    self._cache = json.load(f)
                # Limpa entradas expiradas ao carregar
                self._cleanup()
        except Exception:
            self._cache = {}

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

    def _cleanup(self):
        """Remove entradas expiradas do cache"""
        now = time.time()
        expired_keys = [
            key for key, value in self._cache.items()
            if now - value.get('timestamp', 0) > self.ttl
        ]
        for key in expired_keys:
            del self._cache[key]

        if expired_keys:
            self._save_cache()

    def get(self, key: str) -> Optional[Dict]:
        """
        Recupera valor do cache

        Args:
            key: Chave do cache

        Returns:
            Valor armazenado ou None se nao encontrado/expirado
        """
        if not self.enabled:
            return None

        hash_key = gerar_hash_cache(key)
        entry = self._cache.get(hash_key)

        if entry is None:
            return None

        # Verifica se expirou
        if time.time() - entry.get('timestamp', 0) > self.ttl:
            del self._cache[hash_key]
            self._save_cache()
            return None

        return entry.get('data')

    def set(self, key: str, value: Dict):
        """
        Armazena valor no cache

        Args:
            key: Chave do cache
            value: Valor a armazenar
        """
        if not self.enabled:
            return

        hash_key = gerar_hash_cache(key)
        self._cache[hash_key] = {
            'timestamp': time.time(),
            'key': key,
            'data': value
        }
        self._save_cache()

    def invalidate(self, key: str):
        """
        Invalida entrada do cache

        Args:
            key: Chave a invalidar
        """
        hash_key = gerar_hash_cache(key)
        if hash_key in self._cache:
            del self._cache[hash_key]
            self._save_cache()

    def clear(self):
        """Limpa todo o cache"""
        self._cache = {}
        self._save_cache()

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

    Implementa logging com:
    - Niveis configuriveis (DEBUG, INFO, WARNING, ERROR, CRITICAL)
    - Timestamps precisos em ISO 8601
    - Rotacao de arquivos
    - Saida para console e arquivo
    """

    def __init__(
        self,
        name: str = "esaj_scraper",
        log_dir: str = "./logs",
        level: int = logging.INFO,
        console_output: bool = True,
        file_output: bool = True,
        max_size: int = DEFAULT_LOG_MAX_SIZE,
        backup_count: int = DEFAULT_LOG_BACKUP_COUNT
    ):
        """
        Inicializa o gerenciador de logs

        Args:
            name: Nome do logger
            log_dir: Diretorio para arquivos de log
            level: Nivel minimo de log
            console_output: Se deve exibir no console
            file_output: Se deve salvar em arquivo
            max_size: Tamanho maximo do arquivo de log
            backup_count: Numero de backups a manter
        """
        self.log_dir = Path(log_dir)
        self.logger = logging.getLogger(name)
        self.logger.setLevel(level)

        # Remove handlers existentes
        self.logger.handlers = []

        # Formato estruturado
        formatter = logging.Formatter(
            fmt='%(asctime)s | %(levelname)-8s | %(name)s | %(message)s',
            datefmt='%Y-%m-%dT%H:%M:%S%z'
        )

        # Handler de console
        if console_output:
            console_handler = logging.StreamHandler(sys.stdout)
            console_handler.setLevel(level)
            console_handler.setFormatter(formatter)
            self.logger.addHandler(console_handler)

        # Handler de arquivo com rotacao
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
        """Log de debug"""
        self._log(logging.DEBUG, msg, **kwargs)

    def info(self, msg: str, **kwargs):
        """Log de info"""
        self._log(logging.INFO, msg, **kwargs)

    def warning(self, msg: str, **kwargs):
        """Log de warning"""
        self._log(logging.WARNING, msg, **kwargs)

    def error(self, msg: str, **kwargs):
        """Log de erro"""
        self._log(logging.ERROR, msg, **kwargs)

    def critical(self, msg: str, **kwargs):
        """Log critico"""
        self._log(logging.CRITICAL, msg, **kwargs)

    def _log(self, level: int, msg: str, **kwargs):
        """Log interno com dados extras"""
        if kwargs:
            extra_info = ' | '.join(f"{k}={v}" for k, v in kwargs.items())
            msg = f"{msg} | {extra_info}"
        self.logger.log(level, msg)


# =============================================================================
# RATE LIMITER
# =============================================================================

class RateLimiter:
    """
    Controlador de taxa de requisicoes

    Implementa:
    - Rate limiting rigoroso (max 1 req/s por padrao)
    - Backoff exponencial em caso de erro
    - Deteccao de bloqueio temporario
    """

    def __init__(
        self,
        rate: float = DEFAULT_RATE_LIMIT,
        backoff_factor: float = DEFAULT_BACKOFF_FACTOR,
        max_backoff: float = 60.0
    ):
        """
        Inicializa o rate limiter

        Args:
            rate: Intervalo minimo entre requisicoes (segundos)
            backoff_factor: Fator de multiplicacao para backoff
            max_backoff: Tempo maximo de backoff (segundos)
        """
        self.rate = rate
        self.backoff_factor = backoff_factor
        self.max_backoff = max_backoff
        self._last_request: float = 0.0
        self._request_count: int = 0
        self._error_count: int = 0
        self._current_backoff: float = rate
        self._blocked_until: float = 0.0

    def wait(self):
        """Aguarda tempo necessario antes da proxima requisicao"""
        now = time.time()

        # Verifica se esta bloqueado
        if now < self._blocked_until:
            wait_time = self._blocked_until - now
            time.sleep(wait_time)
            now = time.time()

        # Calcula tempo desde ultima requisicao
        elapsed = now - self._last_request

        # Aguarda se necessario
        if elapsed < self._current_backoff:
            wait_time = self._current_backoff - elapsed
            time.sleep(wait_time)

        self._last_request = time.time()
        self._request_count += 1

    def success(self):
        """Registra requisicao bem sucedida"""
        self._error_count = 0
        self._current_backoff = self.rate

    def error(self, blocked: bool = False):
        """
        Registra erro e aplica backoff

        Args:
            blocked: Se detectou bloqueio temporario
        """
        self._error_count += 1

        if blocked:
            # Bloqueio temporario: aguarda mais tempo
            self._blocked_until = time.time() + 60.0
            self._current_backoff = min(self._current_backoff * 2, self.max_backoff)
        else:
            # Erro normal: aplica backoff exponencial
            self._current_backoff = min(
                self._current_backoff * self.backoff_factor,
                self.max_backoff
            )

    @property
    def request_count(self) -> int:
        """Retorna numero total de requisicoes"""
        return self._request_count

    @property
    def error_count(self) -> int:
        """Retorna numero de erros"""
        return self._error_count

    @property
    def is_blocked(self) -> bool:
        """Verifica se esta bloqueado"""
        return time.time() < self._blocked_until


# =============================================================================
# CAPTCHA HANDLER
# =============================================================================

class CaptchaHandler:
    """
    Manipulador de CAPTCHA do ESAJ

    Implementa:
    - Deteccao automatica de CAPTCHA
    - OCR para CAPTCHAs simples (se pytesseract disponivel)
    - Fallback para resolucao manual
    """

    def __init__(self, logger: Optional[LogManager] = None):
        """
        Inicializa o handler de CAPTCHA

        Args:
            logger: Logger para registrar eventos
        """
        self.logger = logger or LogManager()
        self._ocr_available = PIL_AVAILABLE and TESSERACT_AVAILABLE
        self._attempts: int = 0
        self._successes: int = 0

    def detectar_captcha(self, html: str) -> bool:
        """
        Detecta presenca de CAPTCHA na pagina

        Args:
            html: HTML da pagina

        Returns:
            True se CAPTCHA detectado
        """
        indicadores = [
            'captcha',
            'CAPTCHA',
            'imagemCaptcha',
            'codigoCaptcha',
            'recaptcha',
            'g-recaptcha',
            'Digite o codigo',
            'Digite o texto da imagem',
            'Verificacao de seguranca',
        ]

        for indicador in indicadores:
            if indicador in html:
                self.logger.warning("CAPTCHA detectado na pagina")
                return True

        return False

    def extrair_url_captcha(self, html: str) -> Optional[str]:
        """
        Extrai URL da imagem do CAPTCHA

        Args:
            html: HTML da pagina

        Returns:
            URL da imagem ou None
        """
        if not BS4_AVAILABLE:
            return None

        soup = BeautifulSoup(html, 'html.parser')

        # Procura imagem de CAPTCHA
        captcha_img = soup.find('img', {'id': re.compile(r'captcha', re.I)})
        if not captcha_img:
            captcha_img = soup.find('img', {'class': re.compile(r'captcha', re.I)})
        if not captcha_img:
            captcha_img = soup.find('img', {'src': re.compile(r'captcha', re.I)})

        if captcha_img and captcha_img.get('src'):
            return captcha_img['src']

        return None

    def resolver_captcha(
        self,
        imagem_bytes: bytes,
        tentativas: int = 3
    ) -> Optional[str]:
        """
        Tenta resolver CAPTCHA usando OCR

        Args:
            imagem_bytes: Bytes da imagem do CAPTCHA
            tentativas: Numero de tentativas

        Returns:
            Texto do CAPTCHA ou None se falhar
        """
        if not self._ocr_available:
            self.logger.warning("OCR nao disponivel - CAPTCHA requer resolucao manual")
            return None

        self._attempts += 1

        try:
            # Carrega imagem
            imagem = Image.open(io.BytesIO(imagem_bytes))

            # Pre-processamento
            imagem = imagem.convert('L')  # Converte para escala de cinza

            # OCR
            texto = pytesseract.image_to_string(
                imagem,
                config='--psm 7 -c tessedit_char_whitelist=0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'
            ).strip()

            if texto:
                self._successes += 1
                self.logger.info(f"CAPTCHA resolvido via OCR: {texto[:3]}...")
                return texto

        except Exception as e:
            self.logger.error(f"Erro ao resolver CAPTCHA: {e}")

        return None

    def solicitar_manual(self, url_imagem: str) -> str:
        """
        Solicita resolucao manual do CAPTCHA

        Args:
            url_imagem: URL da imagem do CAPTCHA

        Returns:
            Texto digitado pelo usuario
        """
        self.logger.warning(f"CAPTCHA requer resolucao manual: {url_imagem}")
        print(f"\n{'='*60}")
        print("CAPTCHA DETECTADO - RESOLUCAO MANUAL NECESSARIA")
        print(f"{'='*60}")
        print(f"Imagem: {url_imagem}")
        print("\nAbra a URL acima em um navegador e digite o codigo:")

        while True:
            codigo = input("Codigo do CAPTCHA: ").strip()
            if codigo:
                return codigo
            print("Codigo nao pode ser vazio. Tente novamente.")

    @property
    def stats(self) -> Dict[str, int]:
        """Estatisticas de resolucao"""
        return {
            "tentativas": self._attempts,
            "sucessos": self._successes,
            "taxa_sucesso": (self._successes / self._attempts * 100) if self._attempts > 0 else 0
        }


# =============================================================================
# SCRAPER PRINCIPAL
# =============================================================================

class ESAJScraper:
    """
    Scraper completo do ESAJ (TJSP)

    Suporta:
    - Consulta de 1o e 2o grau
    - Busca por numero de processo, CPF/CNPJ
    - Extracao de dados completos
    - Download de documentos
    - Deteccao de segredo de justica
    - Rate limiting e cache
    """

    def __init__(
        self,
        cache_dir: str = "./cache/esaj",
        log_dir: str = "./logs",
        cache_enabled: bool = True,
        cache_ttl: int = DEFAULT_CACHE_TTL,
        rate_limit: float = DEFAULT_RATE_LIMIT,
        timeout: int = DEFAULT_TIMEOUT,
        max_retries: int = DEFAULT_MAX_RETRIES,
        log_level: int = logging.INFO,
        verificar_ssl: bool = True
    ):
        """
        Inicializa o scraper

        Args:
            cache_dir: Diretorio para cache
            log_dir: Diretorio para logs
            cache_enabled: Se cache esta habilitado
            cache_ttl: TTL do cache em segundos
            rate_limit: Taxa limite (segundos entre requisicoes)
            timeout: Timeout das requisicoes
            max_retries: Numero maximo de tentativas
            log_level: Nivel de log
            verificar_ssl: Se deve verificar certificados SSL
        """
        # Componentes
        self.logger = LogManager(
            name="esaj_scraper",
            log_dir=log_dir,
            level=log_level
        )
        self.cache = CacheManager(
            cache_dir=cache_dir,
            ttl=cache_ttl,
            enabled=cache_enabled
        )
        self.rate_limiter = RateLimiter(rate=rate_limit)
        self.captcha_handler = CaptchaHandler(logger=self.logger)

        # Configuracoes
        self.timeout = timeout
        self.max_retries = max_retries
        self.verificar_ssl = verificar_ssl

        # Sessao HTTP
        self._session: Optional[requests.Session] = None
        self._init_session()

        self.logger.info(
            "ESAJScraper inicializado",
            cache_enabled=cache_enabled,
            cache_ttl=cache_ttl,
            rate_limit=rate_limit
        )

    def _init_session(self):
        """Inicializa sessao HTTP com retry"""
        if not REQUESTS_AVAILABLE:
            raise ImportError("requests nao esta instalado. Execute: pip install requests")

        self._session = requests.Session()
        self._session.headers.update(DEFAULT_HEADERS)

        # Configura retry
        retry_strategy = Retry(
            total=self.max_retries,
            backoff_factor=0.5,
            status_forcelist=[500, 502, 503, 504],
        )
        adapter = HTTPAdapter(max_retries=retry_strategy)
        self._session.mount("https://", adapter)
        self._session.mount("http://", adapter)

    def _fazer_requisicao(
        self,
        url: str,
        method: str = "GET",
        params: Optional[Dict] = None,
        data: Optional[Dict] = None,
        headers: Optional[Dict] = None,
        allow_redirects: bool = True
    ) -> requests.Response:
        """
        Faz requisicao HTTP com rate limiting

        Args:
            url: URL da requisicao
            method: Metodo HTTP
            params: Parametros de query
            data: Dados para POST
            headers: Headers adicionais
            allow_redirects: Se permite redirects

        Returns:
            Response da requisicao

        Raises:
            ESAJConnectionError: Se falhar apos todas as tentativas
            ESAJRateLimitError: Se bloqueado por rate limit
        """
        # Aplica rate limit
        self.rate_limiter.wait()

        # Merge headers
        req_headers = DEFAULT_HEADERS.copy()
        if headers:
            req_headers.update(headers)

        self.logger.debug(f"Requisicao: {method} {url}", params=params)

        tentativas = 0
        ultimo_erro = None

        while tentativas < self.max_retries:
            tentativas += 1

            try:
                if method.upper() == "GET":
                    response = self._session.get(
                        url,
                        params=params,
                        headers=req_headers,
                        timeout=self.timeout,
                        allow_redirects=allow_redirects,
                        verify=self.verificar_ssl
                    )
                else:
                    response = self._session.post(
                        url,
                        params=params,
                        data=data,
                        headers=req_headers,
                        timeout=self.timeout,
                        allow_redirects=allow_redirects,
                        verify=self.verificar_ssl
                    )

                # Verifica status
                if response.status_code == 429:
                    # Rate limit
                    self.rate_limiter.error(blocked=True)
                    self.logger.warning("Rate limit detectado - aguardando...")
                    continue

                if response.status_code >= 500:
                    # Erro do servidor
                    self.rate_limiter.error()
                    self.logger.warning(f"Erro do servidor: {response.status_code}")
                    continue

                # Sucesso
                self.rate_limiter.success()
                return response

            except requests.exceptions.Timeout as e:
                self.logger.warning(f"Timeout na tentativa {tentativas}: {e}")
                ultimo_erro = e
                self.rate_limiter.error()

            except requests.exceptions.ConnectionError as e:
                self.logger.warning(f"Erro de conexao na tentativa {tentativas}: {e}")
                ultimo_erro = e
                self.rate_limiter.error()

            except Exception as e:
                self.logger.error(f"Erro inesperado: {e}")
                ultimo_erro = e
                break

        raise ESAJConnectionError(f"Falha apos {tentativas} tentativas: {ultimo_erro}")

    def _extrair_dados_basicos(self, soup: BeautifulSoup, instancia: str) -> Dict:
        """
        Extrai dados basicos do processo

        Args:
            soup: BeautifulSoup do HTML
            instancia: "1" ou "2"

        Returns:
            Dict com dados basicos
        """
        dados = {}

        # Mapeamento de labels para campos
        mapeamento = {
            "Classe": "classe",
            "Assunto": "assunto",
            "Foro": "foro",
            "Vara": "vara",
            "Juiz": "juiz",
            "Distribuicao": "data_distribuicao",
            "Distribuição": "data_distribuicao",
            "Area": "area",
            "Área": "area",
            "Valor da acao": "valor_causa",
            "Valor da ação": "valor_causa",
            "Outros assuntos": "assuntos_secundarios",
            "Situacao": "situacao",
            "Situação": "situacao",
            # 2o grau
            "Orgao julgador": "orgao_julgador",
            "Órgão julgador": "orgao_julgador",
            "Relator": "relator",
            "Relator(a)": "relator",
        }

        # Extrai dados da tabela de informacoes
        tabela = soup.find('table', {'id': 'tableTodasPartes'})
        if not tabela:
            tabela = soup.find('table', {'class': 'secaoFormBody'})

        # Procura em divs e spans
        for label_text, campo in mapeamento.items():
            # Tenta encontrar label
            label = soup.find(string=re.compile(f'^{re.escape(label_text)}', re.I))
            if label:
                parent = label.parent
                if parent:
                    # Procura valor proximo
                    value_elem = parent.find_next_sibling() or parent.find_next()
                    if value_elem:
                        valor = limpar_html(value_elem.get_text())
                        if valor:
                            dados[campo] = valor

            # Tenta tambem em format de span/td
            span = soup.find('span', {'id': re.compile(campo, re.I)})
            if span:
                dados[campo] = limpar_html(span.get_text())

        # Processa campos especificos
        if 'valor_causa' in dados:
            dados['valor_causa'] = parsear_valor_monetario(dados['valor_causa'])

        if 'data_distribuicao' in dados:
            dados['data_distribuicao'] = parsear_data(dados['data_distribuicao'])

        return dados

    def _extrair_partes(self, soup: BeautifulSoup) -> List[Dict]:
        """
        Extrai informacoes das partes do processo

        Args:
            soup: BeautifulSoup do HTML

        Returns:
            Lista de partes
        """
        partes = []

        # Procura tabela de partes
        tabela_partes = soup.find('table', {'id': 'tableTodasPartes'})
        if not tabela_partes:
            tabela_partes = soup.find('table', {'id': 'tablePartesPrincipais'})

        if tabela_partes:
            rows = tabela_partes.find_all('tr')

            tipo_atual = None

            for row in rows:
                cols = row.find_all('td')
                if len(cols) >= 2:
                    # Primeira coluna: tipo da parte
                    tipo_text = limpar_html(cols[0].get_text()).lower()
                    if tipo_text:
                        # Mapeia tipos de parte
                        tipo_map = {
                            'autor': TipoParte.AUTOR.value,
                            'autora': TipoParte.AUTOR.value,
                            'requerente': TipoParte.REQUERENTE.value,
                            'reu': TipoParte.REU.value,
                            're': TipoParte.REU.value,
                            'requerido': TipoParte.REQUERIDO.value,
                            'requerida': TipoParte.REQUERIDO.value,
                            'apelante': TipoParte.APELANTE.value,
                            'apelado': TipoParte.APELADO.value,
                            'agravante': TipoParte.AGRAVANTE.value,
                            'agravado': TipoParte.AGRAVADO.value,
                            'recorrente': TipoParte.RECORRENTE.value,
                            'recorrido': TipoParte.RECORRIDO.value,
                            'terceiro': TipoParte.TERCEIRO.value,
                            'interessado': TipoParte.INTERESSADO.value,
                        }
                        for key, value in tipo_map.items():
                            if key in tipo_text:
                                tipo_atual = value
                                break
                        else:
                            tipo_atual = TipoParte.OUTRO.value

                    # Segunda coluna: nome e advogados
                    info_text = cols[1].get_text('\n', strip=True)
                    linhas = info_text.split('\n')

                    if linhas:
                        nome = limpar_html(linhas[0])
                        advogados = []

                        # Procura advogados
                        for linha in linhas[1:]:
                            linha = limpar_html(linha)
                            if 'advogad' in linha.lower() or OAB_PATTERN.search(linha):
                                advogados.append(linha)

                        # Procura CPF/CNPJ
                        documento = None
                        tipo_doc = None
                        cpf_match = CPF_PATTERN.search(info_text)
                        if cpf_match:
                            documento = formatar_cpf(cpf_match.group())
                            tipo_doc = "CPF"
                        else:
                            cnpj_match = CNPJ_PATTERN.search(info_text)
                            if cnpj_match:
                                documento = formatar_cnpj(cnpj_match.group())
                                tipo_doc = "CNPJ"

                        parte = Parte(
                            tipo=tipo_atual or TipoParte.OUTRO.value,
                            nome=nome,
                            documento=documento,
                            tipo_documento=tipo_doc,
                            advogados=advogados
                        )
                        partes.append(parte.to_dict())

        # Se nao encontrou tabela, tenta outros seletores
        if not partes:
            # Tenta encontrar partes em divs
            for tipo_id in ['autores', 'reqtes', 'reus', 'reqdos', 'apelantes', 'apelados']:
                div = soup.find('div', {'id': re.compile(tipo_id, re.I)})
                if div:
                    tipo = 'autor' if 'autor' in tipo_id or 'reqte' in tipo_id else 'reu'
                    nome = limpar_html(div.get_text())
                    if nome:
                        partes.append({
                            'tipo': tipo,
                            'nome': nome,
                            'documento': None,
                            'tipo_documento': None,
                            'advogados': []
                        })

        return partes

    def _extrair_movimentacoes(self, soup: BeautifulSoup) -> List[Dict]:
        """
        Extrai movimentacoes processuais

        Args:
            soup: BeautifulSoup do HTML

        Returns:
            Lista de movimentacoes ordenadas por data
        """
        movimentacoes = []

        # Procura tabela de movimentacoes
        tabela_mov = soup.find('table', {'id': 'tabelaTodasMovimentacoes'})
        if not tabela_mov:
            tabela_mov = soup.find('table', {'id': 'tabelaUltimasMovimentacoes'})

        if tabela_mov:
            rows = tabela_mov.find_all('tr')

            for row in rows:
                cols = row.find_all('td')
                if len(cols) >= 2:
                    # Primeira coluna: data
                    data_text = limpar_html(cols[0].get_text())
                    data = parsear_data(data_text)

                    # Segunda coluna: descricao
                    descricao = limpar_html(cols[1].get_text())

                    # Verifica se tem documento vinculado
                    doc_link = cols[1].find('a', href=True)
                    doc_url = None
                    if doc_link:
                        href = doc_link.get('href', '')
                        if href and 'abrirDocumento' in href:
                            doc_url = urljoin(BASE_URL_ESAJ, href)

                    if data and descricao:
                        mov = Movimentacao(
                            data=data,
                            descricao=descricao,
                            documento_vinculado=doc_url
                        )
                        movimentacoes.append(mov.to_dict())

        # Ordena por data (mais recente primeiro)
        movimentacoes.sort(key=lambda x: x.get('data', ''), reverse=True)

        return movimentacoes

    def _extrair_documentos(self, soup: BeautifulSoup) -> List[Dict]:
        """
        Extrai lista de documentos do processo

        Args:
            soup: BeautifulSoup do HTML

        Returns:
            Lista de documentos
        """
        documentos = []

        # Procura links para documentos
        for link in soup.find_all('a', href=True):
            href = link.get('href', '')

            # Identifica links de documentos
            if 'abrirDocumento' in href or 'baixarArquivo' in href:
                texto = limpar_html(link.get_text())

                # Tenta identificar tipo do documento
                tipo = TipoDocumento.OUTRO.value
                texto_lower = texto.lower()

                tipo_map = {
                    'peticao inicial': TipoDocumento.PETICAO_INICIAL.value,
                    'petição inicial': TipoDocumento.PETICAO_INICIAL.value,
                    'contestacao': TipoDocumento.CONTESTACAO.value,
                    'contestação': TipoDocumento.CONTESTACAO.value,
                    'sentenca': TipoDocumento.SENTENCA.value,
                    'sentença': TipoDocumento.SENTENCA.value,
                    'acordao': TipoDocumento.ACORDAO.value,
                    'acórdão': TipoDocumento.ACORDAO.value,
                    'despacho': TipoDocumento.DESPACHO.value,
                    'decisao': TipoDocumento.DECISAO.value,
                    'decisão': TipoDocumento.DECISAO.value,
                    'certidao': TipoDocumento.CERTIDAO.value,
                    'certidão': TipoDocumento.CERTIDAO.value,
                }

                for key, value in tipo_map.items():
                    if key in texto_lower:
                        tipo = value
                        break

                # Verifica se e sigiloso
                sigiloso = 'sigilo' in texto_lower or 'restrito' in texto_lower

                doc = Documento(
                    tipo=tipo,
                    descricao=texto,
                    url=urljoin(BASE_URL_ESAJ, href),
                    sigiloso=sigiloso
                )
                documentos.append(doc.to_dict())

        return documentos

    def _extrair_audiencias(self, soup: BeautifulSoup) -> List[Dict]:
        """
        Extrai audiencias agendadas

        Args:
            soup: BeautifulSoup do HTML

        Returns:
            Lista de audiencias
        """
        audiencias = []

        # Procura secao de audiencias
        secao_aud = soup.find('div', {'id': 'audienciasPlaceholder'})
        if not secao_aud:
            secao_aud = soup.find('table', {'id': 'tabelaAudiencias'})

        if secao_aud:
            rows = secao_aud.find_all('tr')

            for row in rows:
                cols = row.find_all('td')
                if len(cols) >= 2:
                    texto = limpar_html(' '.join(col.get_text() for col in cols))

                    # Extrai data
                    data_match = DATA_PATTERN.search(texto)
                    if data_match:
                        data = f"{data_match.group(3)}-{data_match.group(2)}-{data_match.group(1)}"

                        # Extrai hora
                        hora_match = re.search(r'(\d{2}):(\d{2})', texto)
                        hora = f"{hora_match.group(1)}:{hora_match.group(2)}" if hora_match else None

                        aud = Audiencia(
                            data=data,
                            hora=hora,
                            tipo=texto,
                        )
                        audiencias.append(aud.to_dict())

        return audiencias

    def detectar_segredo_justica(self, html: str) -> bool:
        """
        Detecta se processo tem segredo de justica

        Args:
            html: HTML da pagina

        Returns:
            True se processo em segredo de justica
        """
        indicadores = [
            'segredo de justica',
            'segredo de justiça',
            'Segredo de Justica',
            'Segredo de Justiça',
            'SEGREDO DE JUSTICA',
            'SEGREDO DE JUSTIÇA',
            'processo sigiloso',
            'Processo sigiloso',
            'PROCESSO SIGILOSO',
            'acesso restrito',
            'Acesso restrito',
            'ACESSO RESTRITO',
            'necessario login',
            'necessário login',
            'identificacao necessaria',
            'identificação necessária',
        ]

        for indicador in indicadores:
            if indicador in html:
                return True

        return False

    def _parsear_numero_processo(self, numero: str) -> Dict[str, str]:
        """
        Parseia numero de processo no formato CNJ

        Args:
            numero: Numero do processo

        Returns:
            Dict com componentes do numero
        """
        numero_limpo = re.sub(r'\D', '', numero)

        if len(numero_limpo) != 20:
            raise ESAJValidationError(f"Numero de processo invalido: {numero}")

        return {
            "numero_sequencial": numero_limpo[:7],
            "digito_verificador": numero_limpo[7:9],
            "ano": numero_limpo[9:13],
            "segmento_justica": numero_limpo[13],
            "tribunal": numero_limpo[14:16],
            "foro_origem": numero_limpo[16:20],
            "numero_formatado": formatar_numero_cnj(numero_limpo),
            "numero_completo": numero_limpo
        }

    # =========================================================================
    # METODOS PUBLICOS DE BUSCA
    # =========================================================================

    def buscar_por_numero(
        self,
        numero_processo: str,
        instancia: str = "1"
    ) -> ProcessoESAJ:
        """
        Busca processo por numero CNJ

        Args:
            numero_processo: Numero do processo (formato CNJ)
            instancia: "1" para 1o grau, "2" para 2o grau

        Returns:
            ProcessoESAJ com dados do processo

        Raises:
            ESAJProcessoNaoEncontrado: Se processo nao encontrado
            ESAJSegredoJustica: Se processo em segredo de justica
            ESAJValidationError: Se numero invalido
        """
        self.logger.info(
            f"Buscando processo por numero",
            numero=numero_processo,
            instancia=instancia
        )

        # Valida numero
        if not validar_numero_cnj(numero_processo):
            raise ESAJValidationError(f"Numero de processo invalido: {numero_processo}")

        # Parseia numero
        componentes = self._parsear_numero_processo(numero_processo)
        numero_formatado = componentes["numero_formatado"]

        # Verifica cache
        cache_key = f"processo:{numero_formatado}:{instancia}"
        cached = self.cache.get(cache_key)
        if cached:
            self.logger.info("Retornando resultado do cache")
            return ProcessoESAJ(**cached)

        # Determina endpoint baseado na instancia
        if instancia == "1":
            return self.extrair_1g(numero_processo)
        else:
            return self.extrair_2g(numero_processo)

    def buscar_por_cpf(
        self,
        cpf: str,
        comarca: Optional[str] = None,
        max_resultados: int = 100
    ) -> List[ProcessoESAJ]:
        """
        Busca processos por CPF da parte

        Args:
            cpf: CPF da parte
            comarca: Codigo da comarca (opcional)
            max_resultados: Numero maximo de resultados

        Returns:
            Lista de ProcessoESAJ encontrados

        Raises:
            ESAJValidationError: Se CPF invalido
        """
        self.logger.info(f"Buscando processos por CPF", cpf=cpf[:6] + "***", comarca=comarca)

        # Valida CPF
        if not validar_cpf(cpf):
            raise ESAJValidationError(f"CPF invalido: {cpf}")

        return self._buscar_por_documento(cpf, "CPF", comarca, max_resultados)

    def buscar_por_cnpj(
        self,
        cnpj: str,
        comarca: Optional[str] = None,
        max_resultados: int = 100
    ) -> List[ProcessoESAJ]:
        """
        Busca processos por CNPJ da parte

        Args:
            cnpj: CNPJ da parte
            comarca: Codigo da comarca (opcional)
            max_resultados: Numero maximo de resultados

        Returns:
            Lista de ProcessoESAJ encontrados

        Raises:
            ESAJValidationError: Se CNPJ invalido
        """
        self.logger.info(f"Buscando processos por CNPJ", cnpj=cnpj[:8] + "***", comarca=comarca)

        # Valida CNPJ
        if not validar_cnpj(cnpj):
            raise ESAJValidationError(f"CNPJ invalido: {cnpj}")

        return self._buscar_por_documento(cnpj, "CNPJ", comarca, max_resultados)

    def _buscar_por_documento(
        self,
        documento: str,
        tipo_doc: str,
        comarca: Optional[str],
        max_resultados: int
    ) -> List[ProcessoESAJ]:
        """
        Busca processos por documento (CPF ou CNPJ)

        Args:
            documento: Numero do documento
            tipo_doc: "CPF" ou "CNPJ"
            comarca: Codigo da comarca
            max_resultados: Limite de resultados

        Returns:
            Lista de ProcessoESAJ
        """
        processos = []
        doc_limpo = re.sub(r'\D', '', documento)

        # Monta parametros de busca
        params = {
            "conversationId": "",
            "cbPesquisa": "DOCPARTE",
            "dadosConsulta.valorConsulta": doc_limpo,
            "paginaConsulta": "1",
        }

        if comarca:
            params["dadosConsulta.localPesquisa.cdLocal"] = comarca

        pagina = 1
        total_encontrado = 0

        while total_encontrado < max_resultados:
            params["paginaConsulta"] = str(pagina)

            try:
                # Faz requisicao de busca
                response = self._fazer_requisicao(
                    ENDPOINTS_1G["search"],
                    params=params
                )

                if response.status_code != 200:
                    break

                html = response.text

                # Verifica CAPTCHA
                if self.captcha_handler.detectar_captcha(html):
                    self.logger.warning("CAPTCHA detectado na busca por documento")
                    # Tentar resolver ou pular
                    break

                # Parseia resultados
                soup = BeautifulSoup(html, 'html.parser')

                # Procura links de processos
                links_processos = soup.find_all('a', href=re.compile(r'processo\.codigo='))

                if not links_processos:
                    break

                for link in links_processos:
                    if total_encontrado >= max_resultados:
                        break

                    # Extrai numero do processo
                    href = link.get('href', '')
                    texto = limpar_html(link.get_text())

                    # Procura numero CNJ no texto
                    match = re.search(r'\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}', texto)
                    if match:
                        numero = match.group()
                        try:
                            processo = self.extrair_1g(numero)
                            processos.append(processo)
                            total_encontrado += 1
                        except Exception as e:
                            self.logger.warning(f"Erro ao extrair processo {numero}: {e}")

                # Verifica se ha proxima pagina
                link_prox = soup.find('a', string=re.compile('proxim|>>'))
                if not link_prox:
                    break

                pagina += 1

            except ESAJConnectionError as e:
                self.logger.error(f"Erro de conexao na busca: {e}")
                break

        self.logger.info(f"Busca concluida: {len(processos)} processos encontrados")
        return processos

    def extrair_1g(self, numero_processo: str) -> ProcessoESAJ:
        """
        Extrai dados completos de processo de 1o grau

        Args:
            numero_processo: Numero do processo

        Returns:
            ProcessoESAJ com todos os dados
        """
        self.logger.info(f"Extraindo dados de 1o grau", numero=numero_processo)

        # Parseia numero
        componentes = self._parsear_numero_processo(numero_processo)
        numero_formatado = componentes["numero_formatado"]

        # Verifica cache
        cache_key = f"processo:{numero_formatado}:1"
        cached = self.cache.get(cache_key)
        if cached:
            self.logger.info("Retornando resultado do cache")
            return ProcessoESAJ(**cached)

        # Monta URL de consulta
        params = {
            "conversationId": "",
            "dadosConsulta.localPesquisa.cdLocal": "-1",
            "cbPesquisa": "NUMPROC",
            "dadosConsulta.valorConsulta": numero_formatado,
            "dadosConsulta.tipoNuProcesso": "UNIFICADO",
        }

        # Primeira requisicao: busca
        response = self._fazer_requisicao(
            ENDPOINTS_1G["search"],
            params=params
        )

        html = response.text

        # Verifica CAPTCHA
        if self.captcha_handler.detectar_captcha(html):
            raise ESAJCaptchaError("CAPTCHA detectado - resolucao manual necessaria")

        # Verifica segredo de justica
        if self.detectar_segredo_justica(html):
            raise ESAJSegredoJustica(f"Processo {numero_formatado} em segredo de justica")

        # Verifica se encontrou processo
        if "Nao existem informacoes" in html or "Não existem informações" in html:
            raise ESAJProcessoNaoEncontrado(f"Processo {numero_formatado} nao encontrado")

        # Parseia HTML
        soup = BeautifulSoup(html, 'html.parser')

        # Se redirecionou para pagina de selecao, pega primeiro resultado
        link_processo = soup.find('a', href=re.compile(r'processo\.codigo='))
        if link_processo:
            href = link_processo.get('href', '')
            response = self._fazer_requisicao(urljoin(BASE_URL_ESAJ, href))
            html = response.text
            soup = BeautifulSoup(html, 'html.parser')

        # Extrai dados
        dados_basicos = self._extrair_dados_basicos(soup, "1")
        partes = self._extrair_partes(soup)
        movimentacoes = self._extrair_movimentacoes(soup)
        documentos = self._extrair_documentos(soup)
        audiencias = self._extrair_audiencias(soup)

        # Cria objeto do processo
        processo = ProcessoESAJ(
            numero_processo=numero_formatado,
            tribunal="TJSP",
            sistema="ESAJ",
            instancia="1",
            comarca=dados_basicos.get("foro"),
            foro=dados_basicos.get("foro"),
            vara=dados_basicos.get("vara"),
            classe=dados_basicos.get("classe"),
            assunto=dados_basicos.get("assunto"),
            area=dados_basicos.get("area"),
            data_distribuicao=dados_basicos.get("data_distribuicao"),
            valor_causa=dados_basicos.get("valor_causa"),
            partes=partes,
            movimentacoes=movimentacoes,
            documentos=documentos,
            audiencias=audiencias,
            situacao=dados_basicos.get("situacao"),
            segredo_justica=False,
            url_consulta=response.url,
        )

        # Salva no cache
        self.cache.set(cache_key, processo.to_dict())

        self.logger.info(
            f"Extracao concluida",
            numero=numero_formatado,
            partes=len(partes),
            movimentacoes=len(movimentacoes),
            documentos=len(documentos)
        )

        return processo

    def extrair_2g(self, numero_processo: str) -> ProcessoESAJ:
        """
        Extrai dados completos de processo de 2o grau (recurso)

        Args:
            numero_processo: Numero do processo/recurso

        Returns:
            ProcessoESAJ com todos os dados
        """
        self.logger.info(f"Extraindo dados de 2o grau", numero=numero_processo)

        # Parseia numero
        componentes = self._parsear_numero_processo(numero_processo)
        numero_formatado = componentes["numero_formatado"]

        # Verifica cache
        cache_key = f"processo:{numero_formatado}:2"
        cached = self.cache.get(cache_key)
        if cached:
            self.logger.info("Retornando resultado do cache")
            return ProcessoESAJ(**cached)

        # Monta URL de consulta
        params = {
            "conversationId": "",
            "paginaConsulta": "1",
            "localPesquisa.cdLocal": "-1",
            "cbPesquisa": "NUMPROC",
            "tipoNuProcesso": "UNIFICADO",
            "numeroDigitoAnoUnificado": numero_formatado.split('.')[0],
            "foroNumeroUnificado": componentes["foro_origem"],
            "dePesquisaNuUnificado": numero_formatado,
            "dePesquisa": "",
        }

        # Requisicao de busca
        response = self._fazer_requisicao(
            ENDPOINTS_2G["search"],
            params=params
        )

        html = response.text

        # Verifica CAPTCHA
        if self.captcha_handler.detectar_captcha(html):
            raise ESAJCaptchaError("CAPTCHA detectado - resolucao manual necessaria")

        # Verifica segredo de justica
        if self.detectar_segredo_justica(html):
            raise ESAJSegredoJustica(f"Processo {numero_formatado} em segredo de justica")

        # Verifica se encontrou processo
        if "Nao existem informacoes" in html or "Não existem informações" in html:
            raise ESAJProcessoNaoEncontrado(f"Processo {numero_formatado} nao encontrado no 2o grau")

        # Parseia HTML
        soup = BeautifulSoup(html, 'html.parser')

        # Se redirecionou para pagina de selecao, pega primeiro resultado
        link_processo = soup.find('a', href=re.compile(r'processo\.codigo='))
        if link_processo:
            href = link_processo.get('href', '')
            response = self._fazer_requisicao(urljoin(BASE_URL_ESAJ, href))
            html = response.text
            soup = BeautifulSoup(html, 'html.parser')

        # Extrai dados
        dados_basicos = self._extrair_dados_basicos(soup, "2")
        partes = self._extrair_partes(soup)
        movimentacoes = self._extrair_movimentacoes(soup)
        documentos = self._extrair_documentos(soup)

        # Cria objeto do processo
        processo = ProcessoESAJ(
            numero_processo=numero_formatado,
            tribunal="TJSP",
            sistema="ESAJ",
            instancia="2",
            classe=dados_basicos.get("classe"),
            assunto=dados_basicos.get("assunto"),
            orgao_julgador=dados_basicos.get("orgao_julgador"),
            relator=dados_basicos.get("relator"),
            partes=partes,
            movimentacoes=movimentacoes,
            documentos=documentos,
            segredo_justica=False,
            url_consulta=response.url,
        )

        # Salva no cache
        self.cache.set(cache_key, processo.to_dict())

        self.logger.info(
            f"Extracao de 2o grau concluida",
            numero=numero_formatado,
            orgao=dados_basicos.get("orgao_julgador"),
            relator=dados_basicos.get("relator")
        )

        return processo

    def baixar_documentos(
        self,
        processo: ProcessoESAJ,
        output_dir: str = "./output",
        tipos: Optional[List[str]] = None
    ) -> List[str]:
        """
        Baixa documentos publicos do processo

        Args:
            processo: ProcessoESAJ com lista de documentos
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
            # Verifica tipo
            if tipos and doc.get('tipo') not in tipos:
                continue

            # Verifica se e sigiloso
            if doc.get('sigiloso'):
                self.logger.info(f"Pulando documento sigiloso: {doc.get('descricao')}")
                continue

            url = doc.get('url')
            if not url:
                continue

            self.logger.info(f"Baixando documento: {doc.get('descricao')}")

            try:
                response = self._fazer_requisicao(url)

                if response.status_code == 200:
                    # Determina nome do arquivo
                    tipo = doc.get('tipo', 'documento')
                    data = doc.get('data', datetime.now().strftime('%Y%m%d'))
                    nome_arquivo = f"{tipo}_{numero_limpo}_{data}.pdf"
                    nome_arquivo = re.sub(r'[^\w\-_\.]', '_', nome_arquivo)

                    caminho = output_path / nome_arquivo

                    with open(caminho, 'wb') as f:
                        f.write(response.content)

                    arquivos_baixados.append(str(caminho))
                    self.logger.info(f"Documento salvo: {caminho}")

            except Exception as e:
                self.logger.error(f"Erro ao baixar documento: {e}")

        return arquivos_baixados

    def obter_movimentacoes_completas(
        self,
        numero_processo: str,
        instancia: str = "1"
    ) -> List[Dict]:
        """
        Obtem lista completa de movimentacoes do processo

        Args:
            numero_processo: Numero do processo
            instancia: "1" ou "2"

        Returns:
            Lista de movimentacoes
        """
        processo = self.buscar_por_numero(numero_processo, instancia)
        return processo.movimentacoes

    def verificar_status(self) -> Dict[str, Any]:
        """
        Verifica status do scraper e conectividade

        Returns:
            Dict com informacoes de status
        """
        status = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "conectividade": False,
            "rate_limiter": {
                "requisicoes": self.rate_limiter.request_count,
                "erros": self.rate_limiter.error_count,
                "bloqueado": self.rate_limiter.is_blocked,
            },
            "cache": {
                "habilitado": self.cache.enabled,
                "entradas": self.cache.size,
            },
            "captcha": self.captcha_handler.stats,
        }

        # Testa conectividade
        try:
            response = self._fazer_requisicao(ENDPOINTS_1G["open"])
            status["conectividade"] = response.status_code == 200
        except Exception as e:
            status["erro_conectividade"] = str(e)

        return status

    def limpar_cache(self):
        """Limpa todo o cache"""
        self.cache.clear()
        self.logger.info("Cache limpo")

    def health_check(self, instancia: str = "1") -> Dict[str, Any]:
        """
        Verifica conectividade com o portal ESAJ.

        Realiza requisição simples para testar disponibilidade.

        Args:
            instancia: "1" para 1ª instância, "2" para 2ª instância

        Returns:
            Dict com status e latência:
            - status: 'ok' se conectou, 'error' se falhou
            - latency_ms: Latência da requisição em milissegundos
            - instancia: Instância testada
            - url: URL testada
            - message: Mensagem descritiva (se erro)

        Example:
            >>> scraper = ESAJScraper()
            >>> health = scraper.health_check(instancia="1")
            >>> print(health['status'])
            'ok'
        """
        import time

        url = BASE_URL_1G if instancia == "1" else BASE_URL_2G

        try:
            start_time = time.time()

            # Requisição simples para página inicial
            response = self._session.get(
                url,
                timeout=10.0
            )

            latency_ms = int((time.time() - start_time) * 1000)

            if response.status_code == 200:
                self.logger.info(f"Health check OK | instancia={instancia} | latencia={latency_ms}ms")
                return {
                    'status': 'ok',
                    'latency_ms': latency_ms,
                    'instancia': instancia,
                    'url': url
                }
            else:
                self.logger.warning(f"Health check falhou | instancia={instancia} | status={response.status_code}")
                return {
                    'status': 'error',
                    'latency_ms': latency_ms,
                    'instancia': instancia,
                    'message': f'HTTP {response.status_code}'
                }

        except Exception as e:
            self.logger.error(f"Health check erro | instancia={instancia}: {e}")
            return {
                'status': 'error',
                'latency_ms': 0,
                'instancia': instancia,
                'message': str(e)
            }


# =============================================================================
# FUNCAO PRINCIPAL PARA USO VIA API
# =============================================================================

async def extrair_processo_esaj(
    numero_processo: str,
    instancia: str = "1",
    baixar_docs: bool = False,
    output_dir: str = "./output",
    cache_enabled: bool = True
) -> Dict:
    """
    Funcao principal para extracao de processo do ESAJ

    Esta funcao pode ser chamada de forma assincrona para integracao
    com APIs e sistemas externos.

    Args:
        numero_processo: Numero do processo (formato CNJ)
        instancia: "1" para 1o grau, "2" para 2o grau
        baixar_docs: Se deve baixar documentos
        output_dir: Diretorio para salvar documentos
        cache_enabled: Se deve usar cache

    Returns:
        Dict com todos os dados do processo

    Raises:
        ESAJProcessoNaoEncontrado: Se processo nao encontrado
        ESAJSegredoJustica: Se processo em segredo de justica
        ESAJValidationError: Se numero invalido
        ESAJCaptchaError: Se CAPTCHA nao resolvido
        ESAJConnectionError: Se erro de conexao
    """
    scraper = ESAJScraper(cache_enabled=cache_enabled)

    try:
        processo = scraper.buscar_por_numero(numero_processo, instancia)

        if baixar_docs and not processo.segredo_justica:
            documentos_baixados = scraper.baixar_documentos(processo, output_dir)
            # Atualiza lista de documentos com caminhos locais
            for i, doc in enumerate(processo.documentos):
                if i < len(documentos_baixados):
                    doc['arquivo_local'] = documentos_baixados[i]

        return processo.to_dict()

    except ESAJSegredoJustica:
        # Retorna dados minimos para processos sigilosos
        return {
            "numero_processo": numero_processo,
            "tribunal": "TJSP",
            "sistema": "ESAJ",
            "instancia": instancia,
            "segredo_justica": True,
            "erros": ["Processo em segredo de justica - acesso restrito"],
            "timestamp_extracao": datetime.now(timezone.utc).isoformat()
        }

    except ESAJProcessoNaoEncontrado as e:
        raise e

    except Exception as e:
        scraper.logger.error(f"Erro ao extrair processo: {e}")
        raise


def extrair_processo_esaj_sync(
    numero_processo: str,
    instancia: str = "1",
    baixar_docs: bool = False,
    output_dir: str = "./output",
    cache_enabled: bool = True
) -> Dict:
    """
    Versao sincrona da funcao de extracao

    Args:
        numero_processo: Numero do processo (formato CNJ)
        instancia: "1" para 1o grau, "2" para 2o grau
        baixar_docs: Se deve baixar documentos
        output_dir: Diretorio para salvar documentos
        cache_enabled: Se deve usar cache

    Returns:
        Dict com todos os dados do processo
    """
    return asyncio.run(extrair_processo_esaj(
        numero_processo,
        instancia,
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
        description="ESAJ Scraper - Extrator de processos do TJSP",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Exemplos de uso:

  # Buscar processo de 1o grau por numero
  python esaj_scraper.py --numero 1000000-00.2024.8.26.0100

  # Buscar processo de 2o grau
  python esaj_scraper.py --numero 2000000-00.2024.8.26.0000 --instancia 2

  # Buscar processos por CPF
  python esaj_scraper.py --cpf 123.456.789-00

  # Buscar processos por CNPJ
  python esaj_scraper.py --cnpj 00.000.000/0001-00

  # Baixar documentos do processo
  python esaj_scraper.py --numero 1000000-00.2024.8.26.0100 --baixar-docs --output ./documentos

  # Verificar status do scraper
  python esaj_scraper.py --status

  # Limpar cache
  python esaj_scraper.py --limpar-cache
        """
    )

    # Argumentos de busca
    parser.add_argument(
        "--numero", "-n",
        help="Numero do processo (formato CNJ)"
    )
    parser.add_argument(
        "--instancia", "-i",
        choices=["1", "2"],
        default="1",
        help="Instancia: 1 (1o grau) ou 2 (2o grau)"
    )
    parser.add_argument(
        "--cpf",
        help="CPF para busca de processos"
    )
    parser.add_argument(
        "--cnpj",
        help="CNPJ para busca de processos"
    )
    parser.add_argument(
        "--comarca",
        help="Codigo da comarca para filtrar busca"
    )

    # Opcoes de download
    parser.add_argument(
        "--baixar-docs", "-d",
        action="store_true",
        help="Baixar documentos do processo"
    )
    parser.add_argument(
        "--output", "-o",
        default="./output",
        help="Diretorio para salvar documentos"
    )

    # Opcoes de cache e log
    parser.add_argument(
        "--sem-cache",
        action="store_true",
        help="Desabilitar cache"
    )
    parser.add_argument(
        "--limpar-cache",
        action="store_true",
        help="Limpar cache e sair"
    )
    parser.add_argument(
        "--debug",
        action="store_true",
        help="Habilitar logs de debug"
    )

    # Utilitarios
    parser.add_argument(
        "--status",
        action="store_true",
        help="Verificar status do scraper"
    )
    parser.add_argument(
        "--json",
        action="store_true",
        help="Saida em formato JSON"
    )

    args = parser.parse_args()

    # Configura log level
    log_level = logging.DEBUG if args.debug else logging.INFO

    # Inicializa scraper
    scraper = ESAJScraper(
        cache_enabled=not args.sem_cache,
        log_level=log_level
    )

    # Processa comandos
    try:
        # Limpar cache
        if args.limpar_cache:
            scraper.limpar_cache()
            print("Cache limpo com sucesso!")
            return

        # Verificar status
        if args.status:
            status = scraper.verificar_status()
            if args.json:
                print(json.dumps(status, indent=2, ensure_ascii=False))
            else:
                print("\n=== Status do ESAJ Scraper ===")
                print(f"Conectividade: {'OK' if status['conectividade'] else 'FALHA'}")
                print(f"Requisicoes: {status['rate_limiter']['requisicoes']}")
                print(f"Erros: {status['rate_limiter']['erros']}")
                print(f"Cache: {status['cache']['entradas']} entradas")
            return

        resultado = None

        # Busca por numero
        if args.numero:
            processo = scraper.buscar_por_numero(args.numero, args.instancia)

            if args.baixar_docs and not processo.segredo_justica:
                scraper.baixar_documentos(processo, args.output)

            resultado = processo.to_dict()

        # Busca por CPF
        elif args.cpf:
            processos = scraper.buscar_por_cpf(args.cpf, args.comarca)
            resultado = [p.to_dict() for p in processos]

        # Busca por CNPJ
        elif args.cnpj:
            processos = scraper.buscar_por_cnpj(args.cnpj, args.comarca)
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
                    print(f"\n=== {len(resultado)} processos encontrados ===\n")
                    for proc in resultado:
                        print(f"- {proc['numero_processo']}: {proc.get('classe', 'N/A')}")
                else:
                    print(f"\n=== Processo {resultado['numero_processo']} ===")
                    print(f"Tribunal: {resultado['tribunal']}")
                    print(f"Instancia: {resultado['instancia']}o grau")
                    print(f"Classe: {resultado.get('classe', 'N/A')}")
                    print(f"Assunto: {resultado.get('assunto', 'N/A')}")
                    print(f"Comarca: {resultado.get('comarca', 'N/A')}")
                    print(f"Vara: {resultado.get('vara', 'N/A')}")
                    print(f"Valor da Causa: R$ {resultado.get('valor_causa', 'N/A')}")
                    print(f"Partes: {len(resultado.get('partes', []))}")
                    print(f"Movimentacoes: {len(resultado.get('movimentacoes', []))}")
                    print(f"Documentos: {len(resultado.get('documentos', []))}")
                    if resultado.get('segredo_justica'):
                        print("\n*** PROCESSO EM SEGREDO DE JUSTICA ***")

    except ESAJProcessoNaoEncontrado as e:
        print(f"\nErro: {e}")
        sys.exit(1)

    except ESAJSegredoJustica as e:
        print(f"\nAviso: {e}")
        print("Processo em segredo de justica - dados restritos")

    except ESAJCaptchaError as e:
        print(f"\nErro: {e}")
        print("CAPTCHA detectado - tente novamente mais tarde ou resolva manualmente")
        sys.exit(1)

    except ESAJValidationError as e:
        print(f"\nErro de validacao: {e}")
        sys.exit(1)

    except ESAJConnectionError as e:
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
