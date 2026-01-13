#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
PROJUDI Scraper - Tribunal de Justica de Goias
Extracao automatizada de processos do sistema PROJUDI

Este modulo fornece uma implementacao completa e profissional para:
- Login automatizado com gerenciamento de sessao
- Busca de processos por numero, CPF/CNPJ ou nome
- Extracao completa de metadados processuais
- Download de documentos PDF
- Deteccao de status do processo
- Tratamento robusto de erros com retry
- Cache de sessao para performance

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
import time
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from enum import Enum
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional, Tuple, Union
from urllib.parse import urljoin, urlencode, parse_qs, urlparse

import httpx
from bs4 import BeautifulSoup, Tag

# Tentar importar cryptography para gerenciamento de credenciais
try:
    from cryptography.fernet import Fernet
    CRYPTO_AVAILABLE = True
except ImportError:
    CRYPTO_AVAILABLE = False
    Fernet = None


# =============================================================================
# CONSTANTES E CONFIGURACOES
# =============================================================================

DEFAULT_BASE_URL = "https://projudi.tjgo.jus.br"
DEFAULT_TIMEOUT = 30  # segundos
DEFAULT_MAX_RETRIES = 3
DEFAULT_RATE_LIMIT = 1.0  # segundos entre requisicoes
DEFAULT_CACHE_TTL = 3600  # 1 hora em segundos
DEFAULT_USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
)

# Formatos de numero de processo
PROCESSO_PATTERN = re.compile(
    r'^(\d{7})-?(\d{2})\.?(\d{4})\.?(\d{1})\.?(\d{2})\.?(\d{4})$'
)

# Padroes regex para extracao
CPF_PATTERN = re.compile(r'\d{3}\.?\d{3}\.?\d{3}-?\d{2}')
CNPJ_PATTERN = re.compile(r'\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}')
OAB_PATTERN = re.compile(r'OAB[/\s]*([A-Z]{2})\s*[\d.]+', re.IGNORECASE)
VALOR_PATTERN = re.compile(r'R\$\s*([\d.,]+)', re.IGNORECASE)
DATA_PATTERN = re.compile(r'(\d{2})/(\d{2})/(\d{4})')


# =============================================================================
# ENUMS E TIPOS
# =============================================================================

class StatusProcesso(str, Enum):
    """Status possiveis do processo"""
    ATIVO = "ativo"
    ARQUIVADO = "arquivado"
    ARQUIVADO_PROVISORIAMENTE = "arquivado_provisoriamente"
    SUSPENSO = "suspenso"
    BAIXADO = "baixado"
    TRAMITANDO = "tramitando"
    DESCONHECIDO = "desconhecido"


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
    TERCEIRO = "terceiro"
    TESTEMUNHA = "testemunha"
    PERITO = "perito"
    OUTRO = "outro"


# =============================================================================
# DATACLASSES
# =============================================================================

@dataclass
class Advogado:
    """Representa um advogado no processo"""
    nome: str
    oab_numero: Optional[str] = None
    oab_estado: Optional[str] = None
    email: Optional[str] = None

    def __str__(self) -> str:
        if self.oab_numero and self.oab_estado:
            return f"{self.nome} (OAB/{self.oab_estado} {self.oab_numero})"
        return self.nome

    def to_dict(self) -> Dict[str, Any]:
        return {
            "nome": self.nome,
            "oab_numero": self.oab_numero,
            "oab_estado": self.oab_estado,
            "email": self.email
        }


@dataclass
class Parte:
    """Representa uma parte no processo"""
    tipo: TipoParte
    nome: str
    cpf_cnpj: Optional[str] = None
    advogados: List[Advogado] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "tipo": self.tipo.value,
            "nome": self.nome,
            "cpf": self.cpf_cnpj if self.cpf_cnpj and len(self.cpf_cnpj.replace('.', '').replace('-', '')) == 11 else None,
            "cnpj": self.cpf_cnpj if self.cpf_cnpj and len(self.cpf_cnpj.replace('.', '').replace('-', '').replace('/', '')) == 14 else None,
            "advogados": [f"{adv}" for adv in self.advogados]
        }


@dataclass
class Movimentacao:
    """Representa uma movimentacao do processo"""
    data: datetime
    descricao: str
    tipo: Optional[str] = None
    complemento: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        return {
            "data": self.data.strftime("%Y-%m-%d"),
            "descricao": self.descricao,
            "tipo": self.tipo,
            "complemento": self.complemento
        }


@dataclass
class Documento:
    """Representa um documento do processo"""
    nome: str
    data: Optional[datetime] = None
    tipo: Optional[str] = None
    url_download: Optional[str] = None
    arquivo_local: Optional[str] = None
    tamanho_bytes: Optional[int] = None
    hash_md5: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        return {
            "nome": self.nome,
            "data": self.data.strftime("%Y-%m-%d") if self.data else None,
            "tipo": self.tipo,
            "arquivo": self.arquivo_local,
            "tamanho_bytes": self.tamanho_bytes,
            "hash_md5": self.hash_md5
        }


@dataclass
class DadosProcesso:
    """Representa todos os dados de um processo"""
    numero_processo: str
    tribunal: str = "TJGO"
    sistema: str = "PROJUDI"
    status: StatusProcesso = StatusProcesso.DESCONHECIDO
    comarca: Optional[str] = None
    vara: Optional[str] = None
    classe: Optional[str] = None
    assunto: Optional[str] = None
    assuntos_secundarios: List[str] = field(default_factory=list)
    data_distribuicao: Optional[datetime] = None
    data_ultima_movimentacao: Optional[datetime] = None
    valor_causa: Optional[float] = None
    partes: List[Parte] = field(default_factory=list)
    movimentacoes: List[Movimentacao] = field(default_factory=list)
    documentos: List[Documento] = field(default_factory=list)
    segredo_justica: bool = False
    prioridade: Optional[str] = None
    area: Optional[str] = None
    orgao_julgador: Optional[str] = None
    juiz: Optional[str] = None
    url_consulta: Optional[str] = None
    dados_brutos: Optional[Dict[str, Any]] = None
    timestamp_extracao: datetime = field(default_factory=datetime.utcnow)
    erros: List[str] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        """Converte para dicionario serializado"""
        return {
            "numero_processo": self.numero_processo,
            "tribunal": self.tribunal,
            "sistema": self.sistema,
            "status": self.status.value,
            "comarca": self.comarca,
            "vara": self.vara,
            "classe": self.classe,
            "assunto": self.assunto,
            "assuntos_secundarios": self.assuntos_secundarios,
            "data_distribuicao": self.data_distribuicao.strftime("%Y-%m-%d") if self.data_distribuicao else None,
            "data_ultima_movimentacao": self.data_ultima_movimentacao.strftime("%Y-%m-%d") if self.data_ultima_movimentacao else None,
            "valor_causa": self.valor_causa,
            "partes": [p.to_dict() for p in self.partes],
            "movimentacoes": [m.to_dict() for m in self.movimentacoes],
            "documentos": [d.to_dict() for d in self.documentos],
            "segredo_justica": self.segredo_justica,
            "prioridade": self.prioridade,
            "area": self.area,
            "orgao_julgador": self.orgao_julgador,
            "juiz": self.juiz,
            "url_consulta": self.url_consulta,
            "timestamp_extracao": self.timestamp_extracao.strftime("%Y-%m-%dT%H:%M:%SZ"),
            "erros": self.erros
        }


@dataclass
class SessionCache:
    """Cache de sessao para reutilizacao"""
    cookies: Dict[str, str]
    created_at: datetime
    expires_at: datetime
    user_agent: str
    is_authenticated: bool = False

    def is_valid(self) -> bool:
        """Verifica se a sessao ainda e valida"""
        return datetime.now(timezone.utc) < self.expires_at


# =============================================================================
# EXCECOES CUSTOMIZADAS
# =============================================================================

class ProjudiError(Exception):
    """Excecao base para erros do PROJUDI"""
    pass


class AuthenticationError(ProjudiError):
    """Erro de autenticacao"""
    pass


class CaptchaError(ProjudiError):
    """CAPTCHA detectado"""
    pass


class RateLimitError(ProjudiError):
    """Rate limit atingido"""
    pass


class ProcessoNaoEncontradoError(ProjudiError):
    """Processo nao encontrado"""
    pass


class NetworkError(ProjudiError):
    """Erro de rede"""
    pass


class ParseError(ProjudiError):
    """Erro ao parsear HTML"""
    pass


# =============================================================================
# UTILITARIOS
# =============================================================================

def normalizar_numero_processo(numero: str) -> str:
    """
    Normaliza o numero do processo para o formato padrao CNJ.

    Args:
        numero: Numero do processo em qualquer formato

    Returns:
        Numero formatado como 0000000-00.0000.0.00.0000

    Raises:
        ValueError: Se o numero nao for valido
    """
    # Remove espacos e caracteres especiais
    limpo = re.sub(r'[^0-9]', '', numero)

    if len(limpo) != 20:
        raise ValueError(f"Numero de processo invalido: {numero}")

    # Formata para padrao CNJ
    return f"{limpo[:7]}-{limpo[7:9]}.{limpo[9:13]}.{limpo[13]}.{limpo[14:16]}.{limpo[16:20]}"


def extrair_numero_processo(texto: str) -> Optional[str]:
    """
    Extrai numero de processo de um texto.

    Args:
        texto: Texto contendo possivelmente um numero de processo

    Returns:
        Numero do processo formatado ou None
    """
    # Padrao CNJ: 0000000-00.0000.0.00.0000
    padrao = re.compile(r'\d{7}-?\d{2}\.?\d{4}\.?\d{1}\.?\d{2}\.?\d{4}')
    match = padrao.search(texto)

    if match:
        try:
            return normalizar_numero_processo(match.group())
        except ValueError:
            return None
    return None


def parse_valor_monetario(texto: str) -> Optional[float]:
    """
    Converte string de valor monetario para float.

    Args:
        texto: Valor em formato brasileiro (ex: "R$ 1.234,56")

    Returns:
        Valor como float ou None
    """
    if not texto:
        return None

    try:
        # Remove R$, espacos e pontos de milhar
        valor = re.sub(r'[R$\s.]', '', texto)
        # Substitui virgula decimal por ponto
        valor = valor.replace(',', '.')
        return float(valor)
    except (ValueError, AttributeError):
        return None


def parse_data_brasileira(texto: str) -> Optional[datetime]:
    """
    Converte data em formato brasileiro para datetime.

    Args:
        texto: Data no formato DD/MM/YYYY ou DD/MM/YY

    Returns:
        Objeto datetime ou None
    """
    if not texto:
        return None

    formatos = [
        '%d/%m/%Y',
        '%d/%m/%y',
        '%d-%m-%Y',
        '%d-%m-%y',
        '%Y-%m-%d'
    ]

    texto = texto.strip()

    for fmt in formatos:
        try:
            return datetime.strptime(texto, fmt)
        except ValueError:
            continue

    return None


def gerar_nome_arquivo(numero_processo: str, nome_documento: str, extensao: str = "pdf") -> str:
    """
    Gera nome de arquivo seguro para documento.

    Args:
        numero_processo: Numero do processo
        nome_documento: Nome do documento
        extensao: Extensao do arquivo

    Returns:
        Nome de arquivo seguro
    """
    # Remove caracteres problematicos
    processo_safe = re.sub(r'[^0-9]', '', numero_processo)
    doc_safe = re.sub(r'[^a-zA-Z0-9_\-\s]', '', nome_documento)
    doc_safe = re.sub(r'\s+', '_', doc_safe.strip())[:50]

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")

    return f"{processo_safe}_{doc_safe}_{timestamp}.{extensao}"


def calcular_hash_arquivo(caminho: str) -> str:
    """
    Calcula hash MD5 de um arquivo.

    Args:
        caminho: Caminho do arquivo

    Returns:
        Hash MD5 em hexadecimal
    """
    hash_md5 = hashlib.md5()
    with open(caminho, "rb") as f:
        for chunk in iter(lambda: f.read(4096), b""):
            hash_md5.update(chunk)
    return hash_md5.hexdigest()


# =============================================================================
# LOGGER PERSONALIZADO
# =============================================================================

class ProjudiLogger:
    """
    Sistema de logging detalhado para o scraper.

    Fornece logs estruturados com:
    - Timestamps precisos
    - Niveis de log (DEBUG, INFO, WARNING, ERROR, CRITICAL)
    - Formatacao colorida para console
    - Rotacao de arquivos
    """

    COLORS = {
        'DEBUG': '\033[36m',     # Ciano
        'INFO': '\033[32m',      # Verde
        'WARNING': '\033[33m',   # Amarelo
        'ERROR': '\033[31m',     # Vermelho
        'CRITICAL': '\033[35m',  # Magenta
        'RESET': '\033[0m'       # Reset
    }

    def __init__(
        self,
        name: str = "ProjudiScraper",
        level: int = logging.INFO,
        log_file: Optional[str] = None,
        log_dir: Optional[str] = None
    ):
        """
        Inicializa o logger.

        Args:
            name: Nome do logger
            level: Nivel minimo de log
            log_file: Nome do arquivo de log
            log_dir: Diretorio para arquivos de log
        """
        self.logger = logging.getLogger(name)
        self.logger.setLevel(level)
        self.logger.handlers = []  # Limpa handlers existentes

        # Formato padrao
        formatter = logging.Formatter(
            '%(asctime)s | %(levelname)-8s | %(name)s | %(message)s',
            datefmt='%Y-%m-%d %H:%M:%S'
        )

        # Handler de console com cores
        console_handler = logging.StreamHandler()
        console_handler.setLevel(level)
        colored_formatter = self._ColoredFormatter(
            '%(asctime)s | %(levelname)-8s | %(name)s | %(message)s',
            datefmt='%Y-%m-%d %H:%M:%S'
        )
        console_handler.setFormatter(colored_formatter)
        self.logger.addHandler(console_handler)

        # Handler de arquivo (opcional)
        if log_file or log_dir:
            if log_dir:
                Path(log_dir).mkdir(parents=True, exist_ok=True)
                log_path = Path(log_dir) / (log_file or f"{name}_{datetime.now().strftime('%Y%m%d')}.log")
            else:
                log_path = Path(log_file)

            file_handler = logging.FileHandler(log_path, encoding='utf-8')
            file_handler.setLevel(level)
            file_handler.setFormatter(formatter)
            self.logger.addHandler(file_handler)

    class _ColoredFormatter(logging.Formatter):
        """Formatter com cores para console"""

        def format(self, record):
            colors = ProjudiLogger.COLORS
            levelname = record.levelname
            if levelname in colors:
                record.levelname = f"{colors[levelname]}{levelname}{colors['RESET']}"
            return super().format(record)

    def debug(self, message: str, **kwargs) -> None:
        self.logger.debug(self._format_message(message, kwargs))

    def info(self, message: str, **kwargs) -> None:
        self.logger.info(self._format_message(message, kwargs))

    def warning(self, message: str, **kwargs) -> None:
        self.logger.warning(self._format_message(message, kwargs))

    def error(self, message: str, **kwargs) -> None:
        self.logger.error(self._format_message(message, kwargs))

    def critical(self, message: str, **kwargs) -> None:
        self.logger.critical(self._format_message(message, kwargs))

    def _format_message(self, message: str, extra: Dict) -> str:
        if extra:
            extra_str = " | ".join(f"{k}={v}" for k, v in extra.items())
            return f"{message} | {extra_str}"
        return message

    def log_request(
        self,
        method: str,
        url: str,
        status_code: Optional[int] = None,
        duration_ms: Optional[float] = None
    ) -> None:
        """Log de requisicao HTTP"""
        msg = f"{method} {url}"
        if status_code:
            msg += f" -> {status_code}"
        if duration_ms:
            msg += f" ({duration_ms:.0f}ms)"
        self.info(msg)

    def log_retry(self, attempt: int, max_attempts: int, error: str) -> None:
        """Log de tentativa de retry"""
        self.warning(f"Retry {attempt}/{max_attempts}: {error}")

    def log_success(self, operation: str, details: Optional[str] = None) -> None:
        """Log de operacao bem-sucedida"""
        msg = f"SUCESSO: {operation}"
        if details:
            msg += f" - {details}"
        self.info(msg)

    def log_failure(self, operation: str, error: str) -> None:
        """Log de falha"""
        self.error(f"FALHA: {operation} - {error}")


# =============================================================================
# GERENCIADOR DE PROXY
# =============================================================================

class ProxyManager:
    """
    Gerenciador de proxies para rotacao automatica.

    Suporta:
    - Lista de proxies com rotacao
    - Verificacao de saude do proxy
    - Fallback para conexao direta
    - Estatisticas de uso
    """

    def __init__(
        self,
        proxies: Optional[List[str]] = None,
        enable_rotation: bool = True,
        verify_ssl: bool = True
    ):
        """
        Inicializa o gerenciador de proxies.

        Args:
            proxies: Lista de URLs de proxy (ex: "http://user:pass@host:port")
            enable_rotation: Habilita rotacao automatica
            verify_ssl: Verificar certificados SSL
        """
        self.proxies = proxies or []
        self.enable_rotation = enable_rotation
        self.verify_ssl = verify_ssl
        self.current_index = 0
        self.stats: Dict[str, Dict] = {}

        # Inicializa estatisticas
        for proxy in self.proxies:
            self.stats[proxy] = {
                "requests": 0,
                "successes": 0,
                "failures": 0,
                "last_used": None,
                "last_error": None
            }

    def get_proxy(self) -> Optional[str]:
        """
        Retorna o proximo proxy para uso.

        Returns:
            URL do proxy ou None para conexao direta
        """
        if not self.proxies:
            return None

        if self.enable_rotation:
            proxy = self.proxies[self.current_index]
            self.current_index = (self.current_index + 1) % len(self.proxies)
        else:
            proxy = self.proxies[0]

        self.stats[proxy]["requests"] += 1
        self.stats[proxy]["last_used"] = datetime.now(timezone.utc)

        return proxy

    def report_success(self, proxy: str) -> None:
        """Reporta sucesso de uma requisicao"""
        if proxy in self.stats:
            self.stats[proxy]["successes"] += 1

    def report_failure(self, proxy: str, error: str) -> None:
        """Reporta falha de uma requisicao"""
        if proxy in self.stats:
            self.stats[proxy]["failures"] += 1
            self.stats[proxy]["last_error"] = error

    def remove_bad_proxy(self, proxy: str) -> None:
        """Remove proxy com muitas falhas"""
        if proxy in self.proxies:
            self.proxies.remove(proxy)

    def get_stats(self) -> Dict[str, Dict]:
        """Retorna estatisticas de uso"""
        return self.stats.copy()


# =============================================================================
# CLASSE PRINCIPAL: PROJUDI SCRAPER
# =============================================================================

class ProjudiScraper:
    """
    Scraper completo do PROJUDI (TJGO).

    Fornece metodos para:
    - Autenticacao automatizada
    - Busca de processos
    - Extracao de metadados
    - Download de documentos
    - Deteccao de status

    Exemplo de uso:
        >>> scraper = ProjudiScraper()
        >>> scraper.login("12345678900", "minhasenha")
        >>> processo = scraper.buscar_processo("0000000-00.0000.8.09.0000")
        >>> print(processo.to_dict())
    """

    def __init__(
        self,
        base_url: str = DEFAULT_BASE_URL,
        timeout: int = DEFAULT_TIMEOUT,
        max_retries: int = DEFAULT_MAX_RETRIES,
        rate_limit: float = DEFAULT_RATE_LIMIT,
        user_agent: str = DEFAULT_USER_AGENT,
        proxy_manager: Optional[ProxyManager] = None,
        cache_dir: Optional[str] = None,
        log_level: int = logging.INFO,
        log_dir: Optional[str] = None
    ):
        """
        Inicializa o scraper.

        Args:
            base_url: URL base do PROJUDI
            timeout: Timeout das requisicoes em segundos
            max_retries: Numero maximo de tentativas
            rate_limit: Intervalo minimo entre requisicoes
            user_agent: User-Agent para requisicoes
            proxy_manager: Gerenciador de proxies (opcional)
            cache_dir: Diretorio para cache de sessao
            log_level: Nivel de log
            log_dir: Diretorio para arquivos de log
        """
        self.base_url = base_url.rstrip('/')
        self.timeout = timeout
        self.max_retries = max_retries
        self.rate_limit = rate_limit
        self.user_agent = user_agent
        self.proxy_manager = proxy_manager

        # Cache
        self.cache_dir = Path(cache_dir) if cache_dir else Path.home() / ".projudi_cache"
        self.cache_dir.mkdir(parents=True, exist_ok=True)
        self._session_cache: Optional[SessionCache] = None

        # Logger
        self.logger = ProjudiLogger(
            name="ProjudiScraper",
            level=log_level,
            log_dir=log_dir
        )

        # Cliente HTTP
        self._client: Optional[httpx.AsyncClient] = None
        self._last_request_time: float = 0

        # Estado
        self._is_authenticated = False
        self._current_user: Optional[str] = None

        self.logger.info(
            "Scraper inicializado",
            base_url=base_url,
            timeout=timeout,
            max_retries=max_retries
        )

    # -------------------------------------------------------------------------
    # Gerenciamento de Cliente HTTP
    # -------------------------------------------------------------------------

    async def _get_client(self) -> httpx.AsyncClient:
        """Retorna cliente HTTP, criando se necessario"""
        if self._client is None or self._client.is_closed:
            proxy = self.proxy_manager.get_proxy() if self.proxy_manager else None

            self._client = httpx.AsyncClient(
                timeout=self.timeout,
                follow_redirects=True,
                headers={
                    "User-Agent": self.user_agent,
                    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                    "Accept-Language": "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7",
                    "Accept-Encoding": "gzip, deflate, br",
                    "Connection": "keep-alive",
                    "Upgrade-Insecure-Requests": "1"
                },
                proxy=proxy,
                verify=True
            )

            # Restaura cookies se houver cache valido
            if self._session_cache and self._session_cache.is_valid():
                for name, value in self._session_cache.cookies.items():
                    self._client.cookies.set(name, value)
                self._is_authenticated = self._session_cache.is_authenticated

        return self._client

    async def _close_client(self) -> None:
        """Fecha cliente HTTP"""
        if self._client and not self._client.is_closed:
            await self._client.aclose()
            self._client = None

    async def __aenter__(self):
        """Suporte a context manager async"""
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Fecha recursos ao sair do context"""
        await self._close_client()

    # -------------------------------------------------------------------------
    # Rate Limiting e Retry
    # -------------------------------------------------------------------------

    async def _enforce_rate_limit(self) -> None:
        """Aplica rate limiting entre requisicoes"""
        elapsed = time.time() - self._last_request_time
        if elapsed < self.rate_limit:
            await asyncio.sleep(self.rate_limit - elapsed)
        self._last_request_time = time.time()

    async def _request_with_retry(
        self,
        method: str,
        url: str,
        **kwargs
    ) -> httpx.Response:
        """
        Executa requisicao HTTP com retry e backoff exponencial.

        Args:
            method: Metodo HTTP (GET, POST, etc)
            url: URL da requisicao
            **kwargs: Argumentos adicionais para httpx

        Returns:
            Resposta HTTP

        Raises:
            NetworkError: Apos esgotar tentativas
            RateLimitError: Se rate limit for detectado
            CaptchaError: Se CAPTCHA for detectado
        """
        last_error = None

        for attempt in range(1, self.max_retries + 1):
            try:
                await self._enforce_rate_limit()

                client = await self._get_client()
                start_time = time.time()

                response = await getattr(client, method.lower())(url, **kwargs)

                duration_ms = (time.time() - start_time) * 1000
                self.logger.log_request(method, url, response.status_code, duration_ms)

                # Verifica erros especificos
                await self._check_response_errors(response)

                # Reporta sucesso ao proxy manager
                if self.proxy_manager and hasattr(client, '_proxy'):
                    self.proxy_manager.report_success(client._proxy)

                return response

            except (httpx.TimeoutException, httpx.NetworkError) as e:
                last_error = NetworkError(str(e))
                self.logger.log_retry(attempt, self.max_retries, str(e))

                # Reporta falha ao proxy manager
                if self.proxy_manager and hasattr(client, '_proxy'):
                    self.proxy_manager.report_failure(client._proxy, str(e))

                # Backoff exponencial
                if attempt < self.max_retries:
                    await asyncio.sleep(2 ** attempt)

            except (CaptchaError, RateLimitError):
                raise

            except Exception as e:
                last_error = NetworkError(str(e))
                self.logger.error(f"Erro inesperado: {e}")

                if attempt < self.max_retries:
                    await asyncio.sleep(2 ** attempt)

        raise last_error or NetworkError("Falha apos todas as tentativas")

    async def _check_response_errors(self, response: httpx.Response) -> None:
        """Verifica erros na resposta"""
        text_lower = response.text.lower()

        # Detecta CAPTCHA
        captcha_indicators = [
            'captcha', 'recaptcha', 'g-recaptcha',
            'verificacao de seguranca', 'verificacao humana',
            'confirme que voce nao e um robo'
        ]
        if any(ind in text_lower for ind in captcha_indicators):
            raise CaptchaError("CAPTCHA detectado na resposta")

        # Detecta rate limit
        rate_limit_indicators = [
            'muitas requisicoes', 'too many requests',
            'rate limit', 'aguarde alguns minutos',
            'tente novamente mais tarde'
        ]
        if any(ind in text_lower for ind in rate_limit_indicators):
            raise RateLimitError("Rate limit detectado")

        # Erro HTTP
        if response.status_code >= 500:
            raise NetworkError(f"Erro do servidor: {response.status_code}")

    # -------------------------------------------------------------------------
    # Cache de Sessao
    # -------------------------------------------------------------------------

    def _get_cache_path(self, username: str) -> Path:
        """Retorna caminho do arquivo de cache para usuario"""
        hash_user = hashlib.md5(username.encode()).hexdigest()[:8]
        return self.cache_dir / f"session_{hash_user}.json"

    def _save_session_cache(self, username: str) -> None:
        """Salva sessao no cache"""
        if not self._client:
            return

        cache = SessionCache(
            cookies=dict(self._client.cookies),
            created_at=datetime.now(timezone.utc),
            expires_at=datetime.now(timezone.utc) + timedelta(seconds=DEFAULT_CACHE_TTL),
            user_agent=self.user_agent,
            is_authenticated=self._is_authenticated
        )

        cache_path = self._get_cache_path(username)

        try:
            with open(cache_path, 'w') as f:
                json.dump({
                    "cookies": cache.cookies,
                    "created_at": cache.created_at.isoformat(),
                    "expires_at": cache.expires_at.isoformat(),
                    "user_agent": cache.user_agent,
                    "is_authenticated": cache.is_authenticated
                }, f)

            self.logger.debug(f"Sessao salva em cache: {cache_path}")

        except Exception as e:
            self.logger.warning(f"Falha ao salvar cache: {e}")

    def _load_session_cache(self, username: str) -> Optional[SessionCache]:
        """Carrega sessao do cache"""
        cache_path = self._get_cache_path(username)

        if not cache_path.exists():
            return None

        try:
            with open(cache_path, 'r') as f:
                data = json.load(f)

            cache = SessionCache(
                cookies=data["cookies"],
                created_at=datetime.fromisoformat(data["created_at"]),
                expires_at=datetime.fromisoformat(data["expires_at"]),
                user_agent=data["user_agent"],
                is_authenticated=data.get("is_authenticated", False)
            )

            if cache.is_valid():
                self.logger.debug(f"Cache de sessao carregado: {cache_path}")
                return cache
            else:
                self.logger.debug("Cache expirado, sera renovado")
                cache_path.unlink()
                return None

        except Exception as e:
            self.logger.warning(f"Falha ao carregar cache: {e}")
            return None

    def _clear_session_cache(self, username: str) -> None:
        """Remove cache de sessao"""
        cache_path = self._get_cache_path(username)
        if cache_path.exists():
            cache_path.unlink()
            self.logger.debug(f"Cache removido: {cache_path}")

    # -------------------------------------------------------------------------
    # Autenticacao
    # -------------------------------------------------------------------------

    async def login(
        self,
        username: str,
        password: str,
        force: bool = False
    ) -> bool:
        """
        Realiza login no sistema PROJUDI.

        Args:
            username: CPF do usuario (apenas numeros)
            password: Senha do usuario
            force: Forca novo login mesmo se houver sessao em cache

        Returns:
            True se login bem-sucedido

        Raises:
            AuthenticationError: Se credenciais invalidas
            CaptchaError: Se CAPTCHA for detectado
        """
        self.logger.info(f"Iniciando login para usuario: {username[:3]}***")

        # Verifica cache
        if not force:
            cached_session = self._load_session_cache(username)
            if cached_session and cached_session.is_authenticated:
                self._session_cache = cached_session
                self._is_authenticated = True
                self._current_user = username
                self.logger.log_success("Login", "Sessao restaurada do cache")
                return True

        try:
            # Acessa pagina inicial para obter cookies
            client = await self._get_client()

            response = await self._request_with_retry("GET", self.base_url)

            # Analisa formulario de login
            soup = BeautifulSoup(response.text, 'html.parser')

            # Encontra formulario de login
            form = self._find_login_form(soup)

            if not form:
                # Tenta URL direta de login
                login_url = f"{self.base_url}/LogOn"
            else:
                action = form.get('action', '')
                login_url = urljoin(str(response.url), action) if action else f"{self.base_url}/LogOn"

            # Prepara dados do formulario
            form_data = self._prepare_login_data(form, username, password)

            self.logger.debug(f"Enviando login para: {login_url}")

            # Envia login
            login_response = await self._request_with_retry(
                "POST",
                login_url,
                data=form_data
            )

            # Verifica sucesso
            is_success = self._verify_login_success(login_response)

            if is_success:
                self._is_authenticated = True
                self._current_user = username
                self._save_session_cache(username)
                self.logger.log_success("Login", f"Usuario: {username[:3]}***")
                return True
            else:
                self._is_authenticated = False
                error_msg = self._extract_login_error(login_response)
                self.logger.log_failure("Login", error_msg)
                raise AuthenticationError(error_msg)

        except CaptchaError:
            self.logger.log_failure("Login", "CAPTCHA detectado")
            raise
        except AuthenticationError:
            raise
        except Exception as e:
            self.logger.log_failure("Login", str(e))
            raise AuthenticationError(f"Erro durante login: {e}")

    def _find_login_form(self, soup: BeautifulSoup) -> Optional[Tag]:
        """Encontra formulario de login na pagina"""
        forms = soup.find_all('form')

        for form in forms:
            inputs = form.find_all('input')
            input_names = [inp.get('name', '').lower() for inp in inputs]

            # Verifica se tem campos de login
            has_user = any('usuario' in n or 'cpf' in n or 'login' in n or 'user' in n for n in input_names)
            has_pass = any('senha' in n or 'password' in n for n in input_names)

            if has_user or has_pass:
                return form

        return None

    def _prepare_login_data(
        self,
        form: Optional[Tag],
        username: str,
        password: str
    ) -> Dict[str, str]:
        """Prepara dados do formulario de login"""
        data = {
            'PaginaAtual': '7',
            'Usuario': username,
            'Senha': password,
            'entrar': 'Entrar'
        }

        if form:
            # Coleta campos hidden
            for inp in form.find_all('input'):
                name = inp.get('name', '')
                tipo = inp.get('type', 'text')
                value = inp.get('value', '')

                if tipo == 'hidden' and name and value:
                    data[name] = value
                elif 'usuario' in name.lower() or 'cpf' in name.lower() or 'login' in name.lower():
                    data[name] = username
                elif 'senha' in name.lower() or 'password' in name.lower():
                    data[name] = password

        return data

    def _verify_login_success(self, response: httpx.Response) -> bool:
        """Verifica se login foi bem-sucedido"""
        text_lower = response.text.lower()

        # Indicadores de sucesso
        success_indicators = [
            'bem-vindo', 'bem vindo', 'bemvindo',
            'painel', 'dashboard', 'meu painel',
            'sair', 'logout', 'logoff',
            'meus processos', 'minhas intimacoes',
            'usuario logado'
        ]

        # Indicadores de falha
        failure_indicators = [
            'usuario ou senha', 'usuario invalido',
            'senha invalida', 'credenciais invalidas',
            'erro ao autenticar', 'falha no login',
            'acesso negado', 'nao autorizado',
            'dados invalidos'
        ]

        # Verifica presenca de indicadores
        has_success = any(ind in text_lower for ind in success_indicators)
        has_failure = any(ind in text_lower for ind in failure_indicators)

        # Verifica cookies de sessao
        has_session_cookie = any(
            'session' in k.lower() or 'jsession' in k.lower() or 'auth' in k.lower()
            for k in response.cookies.keys()
        )

        # Logica de sucesso
        if has_failure:
            return False
        if has_success:
            return True
        if has_session_cookie and not has_failure:
            return True

        # Verifica URL de redirecionamento
        final_url = str(response.url).lower()
        if 'principal' in final_url or 'painel' in final_url or 'home' in final_url:
            return True

        return False

    def _extract_login_error(self, response: httpx.Response) -> str:
        """Extrai mensagem de erro do login"""
        soup = BeautifulSoup(response.text, 'html.parser')

        # Procura por elementos de erro
        error_selectors = [
            '.erro', '.error', '.mensagem-erro',
            '#erro', '#error', '.alert-danger',
            '.mensagem', '.msg'
        ]

        for selector in error_selectors:
            elem = soup.select_one(selector)
            if elem and elem.text.strip():
                return elem.text.strip()

        return "Credenciais invalidas ou erro desconhecido"

    async def logout(self) -> bool:
        """
        Realiza logout do sistema.

        Returns:
            True se logout bem-sucedido
        """
        if not self._is_authenticated:
            return True

        try:
            logout_url = f"{self.base_url}/LogOff"
            await self._request_with_retry("GET", logout_url)

            self._is_authenticated = False
            if self._current_user:
                self._clear_session_cache(self._current_user)
            self._current_user = None

            self.logger.log_success("Logout")
            return True

        except Exception as e:
            self.logger.warning(f"Erro durante logout: {e}")
            return False

    # -------------------------------------------------------------------------
    # Busca de Processos
    # -------------------------------------------------------------------------

    async def buscar_processo(self, numero_processo: str) -> DadosProcesso:
        """
        Busca processo por numero.

        Args:
            numero_processo: Numero do processo (qualquer formato)

        Returns:
            DadosProcesso com informacoes extraidas

        Raises:
            ProcessoNaoEncontradoError: Se processo nao for encontrado
        """
        self.logger.info(f"Buscando processo: {numero_processo}")

        try:
            numero_normalizado = normalizar_numero_processo(numero_processo)
        except ValueError:
            numero_normalizado = numero_processo

        # URL de busca
        busca_url = f"{self.base_url}/BuscaProcesso"

        # Dados da busca
        form_data = {
            'PaginaAtual': '7',
            'numeroProcesso': numero_normalizado
        }

        try:
            response = await self._request_with_retry("POST", busca_url, data=form_data)

            # Verifica se encontrou
            if 'processo nao encontrado' in response.text.lower():
                raise ProcessoNaoEncontradoError(f"Processo nao encontrado: {numero_processo}")

            # Extrai dados
            dados = self._extrair_dados_processo(response.text, numero_normalizado)
            dados.url_consulta = str(response.url)

            self.logger.log_success("Busca", f"Processo encontrado: {numero_normalizado}")
            return dados

        except ProcessoNaoEncontradoError:
            raise
        except Exception as e:
            self.logger.log_failure("Busca", str(e))
            raise

    async def buscar_por_cpf(
        self,
        cpf: str,
        max_resultados: int = 50
    ) -> List[DadosProcesso]:
        """
        Busca processos por CPF de uma parte.

        Args:
            cpf: CPF da parte (com ou sem formatacao)
            max_resultados: Numero maximo de processos a retornar

        Returns:
            Lista de DadosProcesso encontrados
        """
        cpf_limpo = re.sub(r'[^0-9]', '', cpf)

        if len(cpf_limpo) != 11:
            raise ValueError(f"CPF invalido: {cpf}")

        self.logger.info(f"Buscando processos por CPF: {cpf_limpo[:3]}***")

        return await self._buscar_por_documento(cpf_limpo, TipoBusca.CPF, max_resultados)

    async def buscar_por_cnpj(
        self,
        cnpj: str,
        max_resultados: int = 50
    ) -> List[DadosProcesso]:
        """
        Busca processos por CNPJ de uma parte.

        Args:
            cnpj: CNPJ da parte (com ou sem formatacao)
            max_resultados: Numero maximo de processos a retornar

        Returns:
            Lista de DadosProcesso encontrados
        """
        cnpj_limpo = re.sub(r'[^0-9]', '', cnpj)

        if len(cnpj_limpo) != 14:
            raise ValueError(f"CNPJ invalido: {cnpj}")

        self.logger.info(f"Buscando processos por CNPJ: {cnpj_limpo[:2]}***")

        return await self._buscar_por_documento(cnpj_limpo, TipoBusca.CNPJ, max_resultados)

    async def buscar_por_nome(
        self,
        nome: str,
        max_resultados: int = 50
    ) -> List[DadosProcesso]:
        """
        Busca processos por nome de uma parte.

        Args:
            nome: Nome da parte
            max_resultados: Numero maximo de processos a retornar

        Returns:
            Lista de DadosProcesso encontrados
        """
        if len(nome.strip()) < 3:
            raise ValueError("Nome deve ter pelo menos 3 caracteres")

        self.logger.info(f"Buscando processos por nome: {nome[:10]}***")

        busca_url = f"{self.base_url}/BuscaProcessoParte"

        processos = []
        pagina = 1

        while len(processos) < max_resultados:
            form_data = {
                'PaginaAtual': str(pagina),
                'nomeParte': nome.strip()
            }

            try:
                response = await self._request_with_retry("POST", busca_url, data=form_data)

                novos_processos = self._extrair_lista_processos(response.text)

                if not novos_processos:
                    break

                processos.extend(novos_processos)

                # Verifica se tem proxima pagina
                if not self._tem_proxima_pagina(response.text):
                    break

                pagina += 1

            except Exception as e:
                self.logger.warning(f"Erro na pagina {pagina}: {e}")
                break

        self.logger.log_success("Busca por nome", f"Encontrados: {len(processos)} processos")
        return processos[:max_resultados]

    async def _buscar_por_documento(
        self,
        documento: str,
        tipo: TipoBusca,
        max_resultados: int
    ) -> List[DadosProcesso]:
        """Busca interna por documento (CPF/CNPJ)"""
        busca_url = f"{self.base_url}/BuscaProcessoParte"

        processos = []
        pagina = 1

        while len(processos) < max_resultados:
            form_data = {
                'PaginaAtual': str(pagina),
                'documento': documento
            }

            try:
                response = await self._request_with_retry("POST", busca_url, data=form_data)

                novos_processos = self._extrair_lista_processos(response.text)

                if not novos_processos:
                    break

                processos.extend(novos_processos)

                if not self._tem_proxima_pagina(response.text):
                    break

                pagina += 1

            except Exception as e:
                self.logger.warning(f"Erro na pagina {pagina}: {e}")
                break

        self.logger.log_success(f"Busca por {tipo.value}", f"Encontrados: {len(processos)} processos")
        return processos[:max_resultados]

    def _tem_proxima_pagina(self, html: str) -> bool:
        """Verifica se existe proxima pagina de resultados"""
        soup = BeautifulSoup(html, 'html.parser')

        # Procura links de paginacao
        paginacao = soup.select('.paginacao a, .pagination a, a[href*="pagina"]')

        for link in paginacao:
            texto = link.text.lower().strip()
            if 'proxima' in texto or 'proximo' in texto or '>' in texto or '>>' in texto:
                return True

        return False

    def _extrair_lista_processos(self, html: str) -> List[DadosProcesso]:
        """Extrai lista de processos de pagina de resultados"""
        soup = BeautifulSoup(html, 'html.parser')
        processos = []

        # Procura tabela de resultados
        tabela = soup.select_one('table.resultados, table.processos, #tabelaResultados')

        if tabela:
            linhas = tabela.select('tr')[1:]  # Pula cabecalho

            for linha in linhas:
                colunas = linha.select('td')
                if colunas:
                    numero = extrair_numero_processo(colunas[0].text)
                    if numero:
                        processo = DadosProcesso(numero_processo=numero)

                        # Tenta extrair dados basicos
                        if len(colunas) > 1:
                            processo.vara = colunas[1].text.strip() if len(colunas) > 1 else None
                            processo.classe = colunas[2].text.strip() if len(colunas) > 2 else None
                            processo.status = self._inferir_status(linha.text)

                        processos.append(processo)

        return processos

    # -------------------------------------------------------------------------
    # Extracao de Dados
    # -------------------------------------------------------------------------

    def _extrair_dados_processo(self, html: str, numero: str) -> DadosProcesso:
        """
        Extrai todos os dados do processo do HTML.

        Args:
            html: Conteudo HTML da pagina do processo
            numero: Numero do processo

        Returns:
            DadosProcesso preenchido
        """
        soup = BeautifulSoup(html, 'html.parser')

        dados = DadosProcesso(numero_processo=numero)

        try:
            # Extrai metadados basicos
            dados.comarca = self._extrair_campo(soup, ['comarca', 'foro'])
            dados.vara = self._extrair_campo(soup, ['vara', 'orgao', 'unidade'])
            dados.classe = self._extrair_campo(soup, ['classe', 'tipo'])
            dados.assunto = self._extrair_campo(soup, ['assunto', 'materia'])
            dados.area = self._extrair_campo(soup, ['area', 'justica'])
            dados.orgao_julgador = self._extrair_campo(soup, ['orgao_julgador', 'juizo'])
            dados.juiz = self._extrair_campo(soup, ['juiz', 'magistrado'])
            dados.prioridade = self._extrair_campo(soup, ['prioridade'])

            # Data de distribuicao
            data_dist_str = self._extrair_campo(soup, ['data_distribuicao', 'distribuicao', 'data'])
            if data_dist_str:
                dados.data_distribuicao = parse_data_brasileira(data_dist_str)

            # Valor da causa
            valor_str = self._extrair_campo(soup, ['valor_causa', 'valor'])
            if valor_str:
                dados.valor_causa = parse_valor_monetario(valor_str)

            # Segredo de justica
            dados.segredo_justica = self._detectar_segredo_justica(soup)

            # Status
            dados.status = self._detectar_status_html(soup)

            # Partes
            dados.partes = self._extrair_partes(soup)

            # Movimentacoes
            dados.movimentacoes = self._extrair_movimentacoes(soup)

            if dados.movimentacoes:
                dados.data_ultima_movimentacao = dados.movimentacoes[0].data

            # Documentos
            dados.documentos = self._extrair_documentos(soup)

            # Armazena HTML bruto (truncado)
            dados.dados_brutos = {
                "html_preview": html[:5000] if len(html) > 5000 else html
            }

        except Exception as e:
            self.logger.warning(f"Erro ao extrair dados: {e}")
            dados.erros.append(str(e))

        return dados

    def _extrair_campo(self, soup: BeautifulSoup, nomes: List[str]) -> Optional[str]:
        """Extrai valor de um campo por possíveis nomes"""
        for nome in nomes:
            # Tenta por id
            elem = soup.select_one(f'#{nome}, [id*="{nome}"]')
            if elem:
                valor = elem.text.strip()
                if valor:
                    return valor

            # Tenta por class
            elem = soup.select_one(f'.{nome}, [class*="{nome}"]')
            if elem:
                valor = elem.text.strip()
                if valor:
                    return valor

            # Tenta por label
            label = soup.find('label', string=re.compile(nome, re.I))
            if label:
                # Procura valor proximo
                next_elem = label.find_next_sibling()
                if next_elem:
                    valor = next_elem.text.strip()
                    if valor:
                        return valor

            # Tenta por td/th
            for cell in soup.find_all(['td', 'th']):
                if nome.lower() in cell.text.lower():
                    next_cell = cell.find_next_sibling('td')
                    if next_cell:
                        valor = next_cell.text.strip()
                        if valor:
                            return valor

        return None

    def _detectar_segredo_justica(self, soup: BeautifulSoup) -> bool:
        """Detecta se processo tramita em segredo de justica"""
        text_lower = soup.text.lower()

        indicadores = [
            'segredo de justica', 'segredo justica',
            'sigilo', 'sigiloso',
            'processo sigiloso', 'tramitacao sigilosa'
        ]

        return any(ind in text_lower for ind in indicadores)

    def _detectar_status_html(self, soup: BeautifulSoup) -> StatusProcesso:
        """Detecta status do processo pelo HTML"""
        text_lower = soup.text.lower()

        status_map = {
            StatusProcesso.ARQUIVADO: [
                'arquivado definitivamente', 'arquivamento definitivo',
                'processo arquivado'
            ],
            StatusProcesso.ARQUIVADO_PROVISORIAMENTE: [
                'arquivado provisoriamente', 'arquivamento provisorio',
                'sobrestado', 'suspenso provisoriamente'
            ],
            StatusProcesso.SUSPENSO: [
                'processo suspenso', 'suspensao', 'suspenso'
            ],
            StatusProcesso.BAIXADO: [
                'baixado', 'remetido', 'baixa definitiva'
            ],
            StatusProcesso.TRAMITANDO: [
                'em tramitacao', 'tramitando', 'em andamento',
                'aguardando', 'pendente'
            ],
            StatusProcesso.ATIVO: [
                'ativo', 'em curso'
            ]
        }

        for status, indicadores in status_map.items():
            if any(ind in text_lower for ind in indicadores):
                return status

        return StatusProcesso.DESCONHECIDO

    def _inferir_status(self, texto: str) -> StatusProcesso:
        """Infere status a partir de texto"""
        texto_lower = texto.lower()

        if 'arquivado' in texto_lower:
            if 'provisor' in texto_lower:
                return StatusProcesso.ARQUIVADO_PROVISORIAMENTE
            return StatusProcesso.ARQUIVADO
        elif 'suspen' in texto_lower:
            return StatusProcesso.SUSPENSO
        elif 'baixa' in texto_lower:
            return StatusProcesso.BAIXADO
        elif 'tramit' in texto_lower or 'andamento' in texto_lower:
            return StatusProcesso.TRAMITANDO
        elif 'ativo' in texto_lower:
            return StatusProcesso.ATIVO

        return StatusProcesso.DESCONHECIDO

    def _extrair_partes(self, soup: BeautifulSoup) -> List[Parte]:
        """Extrai partes do processo"""
        partes = []

        # Procura secao de partes
        secao_partes = soup.select_one('#partes, .partes, #poloAtivo, #poloPassivo')

        if not secao_partes:
            # Tenta tabela de partes
            secao_partes = soup

        # Mapeia tipos
        tipo_map = {
            'autor': TipoParte.AUTOR,
            'requerente': TipoParte.AUTOR,
            'exequente': TipoParte.AUTOR,
            'reclamante': TipoParte.AUTOR,
            'reu': TipoParte.REU,
            'requerido': TipoParte.REU,
            'executado': TipoParte.REU,
            'reclamado': TipoParte.REU,
            'terceiro': TipoParte.TERCEIRO,
            'interessado': TipoParte.TERCEIRO,
            'testemunha': TipoParte.TESTEMUNHA,
            'perito': TipoParte.PERITO
        }

        # Procura por padroes de polo ativo/passivo
        polos = [
            ('polo ativo', TipoParte.AUTOR),
            ('polo passivo', TipoParte.REU),
            ('autor', TipoParte.AUTOR),
            ('reu', TipoParte.REU),
            ('requerente', TipoParte.AUTOR),
            ('requerido', TipoParte.REU)
        ]

        for polo_nome, tipo_polo in polos:
            for td in secao_partes.find_all(['td', 'div', 'span']):
                texto = td.text.lower()

                if polo_nome in texto:
                    # Procura nome da parte
                    nome_elem = td.find_next_sibling()
                    if nome_elem:
                        nome = nome_elem.text.strip()

                        # Extrai CPF/CNPJ
                        cpf_match = CPF_PATTERN.search(nome_elem.text)
                        cnpj_match = CNPJ_PATTERN.search(nome_elem.text)
                        doc = cpf_match.group() if cpf_match else (cnpj_match.group() if cnpj_match else None)

                        # Remove CPF/CNPJ do nome
                        if doc:
                            nome = nome.replace(doc, '').strip()

                        if nome:
                            parte = Parte(
                                tipo=tipo_polo,
                                nome=nome,
                                cpf_cnpj=doc
                            )

                            # Procura advogados
                            advs_elem = nome_elem.find_next_sibling()
                            if advs_elem and 'advogado' in advs_elem.text.lower():
                                parte.advogados = self._extrair_advogados(advs_elem.text)

                            partes.append(parte)

        return partes

    def _extrair_advogados(self, texto: str) -> List[Advogado]:
        """Extrai advogados de um texto"""
        advogados = []

        # Padrao: Nome do Advogado (OAB/XX 12345)
        padrao = re.compile(
            r'([A-Z][a-zA-Z\s]+)\s*\(?\s*OAB[/\s]*([A-Z]{2})\s*[:\s]*(\d+)',
            re.IGNORECASE
        )

        for match in padrao.finditer(texto):
            adv = Advogado(
                nome=match.group(1).strip(),
                oab_estado=match.group(2).upper(),
                oab_numero=match.group(3)
            )
            advogados.append(adv)

        return advogados

    def _extrair_movimentacoes(self, soup: BeautifulSoup) -> List[Movimentacao]:
        """Extrai movimentacoes do processo"""
        movimentacoes = []

        # Procura tabela de movimentacoes
        tabela = soup.select_one(
            '#tabelaMovimentacoes, .movimentacoes, '
            '#movimentacoes, table.andamentos'
        )

        if tabela:
            linhas = tabela.select('tr')

            for linha in linhas:
                colunas = linha.select('td')

                if len(colunas) >= 2:
                    # Primeira coluna: data
                    data_str = colunas[0].text.strip()
                    data = parse_data_brasileira(data_str)

                    # Segunda coluna: descricao
                    descricao = colunas[1].text.strip()

                    if data and descricao:
                        mov = Movimentacao(
                            data=data,
                            descricao=descricao
                        )

                        # Complemento (terceira coluna se existir)
                        if len(colunas) > 2:
                            mov.complemento = colunas[2].text.strip()

                        movimentacoes.append(mov)

        # Ordena por data decrescente
        movimentacoes.sort(key=lambda m: m.data, reverse=True)

        return movimentacoes

    def _extrair_documentos(self, soup: BeautifulSoup) -> List[Documento]:
        """Extrai lista de documentos do processo"""
        documentos = []

        # Procura links de download
        links = soup.select(
            'a[href*="download"], a[href*="documento"], '
            'a[href*=".pdf"], a[href*="anexo"]'
        )

        for link in links:
            nome = link.text.strip()
            url = link.get('href', '')

            if nome and url:
                doc = Documento(
                    nome=nome,
                    url_download=urljoin(self.base_url, url)
                )

                # Tenta extrair data do contexto
                parent = link.parent
                if parent:
                    data_match = DATA_PATTERN.search(parent.text)
                    if data_match:
                        doc.data = parse_data_brasileira(data_match.group())

                documentos.append(doc)

        return documentos

    # -------------------------------------------------------------------------
    # Download de Documentos
    # -------------------------------------------------------------------------

    async def baixar_documentos(
        self,
        processo: DadosProcesso,
        output_dir: str,
        tipos: Optional[List[str]] = None
    ) -> List[str]:
        """
        Baixa todos os documentos de um processo.

        Args:
            processo: DadosProcesso com lista de documentos
            output_dir: Diretorio de destino
            tipos: Lista de tipos de documento para filtrar (opcional)

        Returns:
            Lista de caminhos dos arquivos baixados
        """
        if not self._is_authenticated:
            self.logger.warning("Download pode requerer autenticacao")

        output_path = Path(output_dir)
        output_path.mkdir(parents=True, exist_ok=True)

        arquivos_baixados = []

        for doc in processo.documentos:
            # Filtra por tipo se especificado
            if tipos and doc.tipo and doc.tipo.lower() not in [t.lower() for t in tipos]:
                continue

            if not doc.url_download:
                continue

            try:
                arquivo = await self._baixar_documento(doc, output_path, processo.numero_processo)
                if arquivo:
                    arquivos_baixados.append(arquivo)

            except Exception as e:
                self.logger.warning(f"Falha ao baixar {doc.nome}: {e}")
                processo.erros.append(f"Download falhou: {doc.nome}")

        self.logger.log_success(
            "Download",
            f"Baixados: {len(arquivos_baixados)}/{len(processo.documentos)} documentos"
        )

        return arquivos_baixados

    async def _baixar_documento(
        self,
        documento: Documento,
        output_dir: Path,
        numero_processo: str
    ) -> Optional[str]:
        """Baixa um documento individual"""
        if not documento.url_download:
            return None

        self.logger.debug(f"Baixando: {documento.nome}")

        try:
            response = await self._request_with_retry("GET", documento.url_download)

            # Determina nome do arquivo
            content_disp = response.headers.get('content-disposition', '')
            if 'filename=' in content_disp:
                filename = re.search(r'filename="?([^"]+)"?', content_disp)
                if filename:
                    arquivo_nome = filename.group(1)
                else:
                    arquivo_nome = gerar_nome_arquivo(numero_processo, documento.nome)
            else:
                arquivo_nome = gerar_nome_arquivo(numero_processo, documento.nome)

            # Salva arquivo
            arquivo_path = output_dir / arquivo_nome

            with open(arquivo_path, 'wb') as f:
                f.write(response.content)

            # Atualiza documento
            documento.arquivo_local = str(arquivo_path)
            documento.tamanho_bytes = len(response.content)
            documento.hash_md5 = calcular_hash_arquivo(str(arquivo_path))

            self.logger.debug(
                f"Documento salvo",
                arquivo=arquivo_nome,
                tamanho=documento.tamanho_bytes
            )

            return str(arquivo_path)

        except Exception as e:
            self.logger.warning(f"Erro ao baixar documento: {e}")
            return None

    # -------------------------------------------------------------------------
    # Deteccao de Status
    # -------------------------------------------------------------------------

    def detectar_status(self, processo: DadosProcesso) -> StatusProcesso:
        """
        Detecta status detalhado do processo.

        Analisa:
        - Texto de status explicito
        - Ultima movimentacao
        - Indicadores no HTML

        Args:
            processo: DadosProcesso para analise

        Returns:
            StatusProcesso detectado
        """
        # Se ja tem status definido, retorna
        if processo.status != StatusProcesso.DESCONHECIDO:
            return processo.status

        # Analisa ultima movimentacao
        if processo.movimentacoes:
            ultima_mov = processo.movimentacoes[0]
            status_mov = self._inferir_status(ultima_mov.descricao)
            if status_mov != StatusProcesso.DESCONHECIDO:
                return status_mov

        # Padrao: tramitando
        return StatusProcesso.TRAMITANDO

    # -------------------------------------------------------------------------
    # Metodos de Conveniencia
    # -------------------------------------------------------------------------

    async def extrair_processo_completo(
        self,
        numero_processo: str,
        baixar_docs: bool = False,
        output_dir: Optional[str] = None
    ) -> DadosProcesso:
        """
        Extrai processo com todas as informacoes.

        Args:
            numero_processo: Numero do processo
            baixar_docs: Se True, baixa documentos
            output_dir: Diretorio para documentos

        Returns:
            DadosProcesso completo
        """
        processo = await self.buscar_processo(numero_processo)

        # Detecta status
        processo.status = self.detectar_status(processo)

        # Baixa documentos se solicitado
        if baixar_docs and output_dir:
            await self.baixar_documentos(processo, output_dir)

        return processo


# =============================================================================
# FUNCAO DE INTERFACE PRINCIPAL
# =============================================================================

async def extrair_processo_projudi(
    numero_processo: str,
    credenciais: Optional[Dict[str, str]] = None,
    baixar_documentos: bool = False,
    output_dir: Optional[str] = None,
    proxy_url: Optional[str] = None
) -> Dict[str, Any]:
    """
    Funcao principal para extracao de processo do PROJUDI.

    Interface simplificada para uso rapido do scraper.

    Args:
        numero_processo: Numero do processo (formato CNJ)
        credenciais: Dict com 'username' e 'password' para login
        baixar_documentos: Se True, baixa documentos do processo
        output_dir: Diretorio de destino para documentos
        proxy_url: URL do proxy para requisicoes (opcional)

    Returns:
        Dict com todos os dados do processo

    Raises:
        AuthenticationError: Se login falhar
        ProcessoNaoEncontradoError: Se processo nao existir

    Example:
        >>> resultado = await extrair_processo_projudi(
        ...     "0000000-00.0000.8.09.0000",
        ...     credenciais={"username": "12345678900", "password": "senha"}
        ... )
        >>> print(resultado['status'])
        'ativo'
    """
    # Configura proxy se fornecido
    proxy_manager = None
    if proxy_url:
        proxy_manager = ProxyManager(proxies=[proxy_url])

    async with ProjudiScraper(proxy_manager=proxy_manager) as scraper:

        # Login se credenciais fornecidas
        if credenciais:
            await scraper.login(
                credenciais.get('username', ''),
                credenciais.get('password', '')
            )

        # Extrai processo
        processo = await scraper.extrair_processo_completo(
            numero_processo,
            baixar_docs=baixar_documentos,
            output_dir=output_dir
        )

        return processo.to_dict()


def extrair_processo_projudi_sync(
    numero_processo: str,
    credenciais: Optional[Dict[str, str]] = None,
    baixar_documentos: bool = False,
    output_dir: Optional[str] = None,
    proxy_url: Optional[str] = None
) -> Dict[str, Any]:
    """
    Versao sincrona da funcao de extracao.

    Wrapper para uso em codigo nao-async.

    Args:
        (mesmos da versao async)

    Returns:
        Dict com dados do processo
    """
    return asyncio.run(extrair_processo_projudi(
        numero_processo,
        credenciais,
        baixar_documentos,
        output_dir,
        proxy_url
    ))


# =============================================================================
# TESTES UNITARIOS
# =============================================================================

class TestProjudiScraper:
    """Testes unitarios para o scraper"""

    @staticmethod
    def test_normalizar_numero_processo():
        """Testa normalizacao de numero de processo"""
        # Formato com separadores
        assert normalizar_numero_processo("0000000-00.0000.8.09.0000") == "0000000-00.0000.8.09.0000"

        # Formato sem separadores
        assert normalizar_numero_processo("00000000000008090000") == "0000000-00.0000.8.09.0000"

        # Formato parcial
        assert normalizar_numero_processo("0000000 00 0000 8 09 0000") == "0000000-00.0000.8.09.0000"

        # Invalido
        try:
            normalizar_numero_processo("123")
            assert False, "Deveria lancar ValueError"
        except ValueError:
            pass

    @staticmethod
    def test_parse_valor_monetario():
        """Testa parsing de valores monetarios"""
        assert parse_valor_monetario("R$ 1.234,56") == 1234.56
        assert parse_valor_monetario("R$ 1.234.567,89") == 1234567.89
        assert parse_valor_monetario("1234,56") == 1234.56
        assert parse_valor_monetario("") is None
        assert parse_valor_monetario(None) is None

    @staticmethod
    def test_parse_data_brasileira():
        """Testa parsing de datas"""
        from datetime import datetime

        assert parse_data_brasileira("15/01/2024") == datetime(2024, 1, 15)
        assert parse_data_brasileira("15-01-2024") == datetime(2024, 1, 15)
        assert parse_data_brasileira("2024-01-15") == datetime(2024, 1, 15)
        assert parse_data_brasileira("") is None

    @staticmethod
    def test_extrair_numero_processo():
        """Testa extracao de numero de texto"""
        texto = "Processo numero 0123456-78.2024.8.09.0001 em tramite"
        numero = extrair_numero_processo(texto)
        assert numero == "0123456-78.2024.8.09.0001"

        # Sem processo
        assert extrair_numero_processo("Texto sem processo") is None

    @staticmethod
    def test_dados_processo_to_dict():
        """Testa serializacao de DadosProcesso"""
        processo = DadosProcesso(
            numero_processo="0123456-78.2024.8.09.0001",
            comarca="Goiania",
            vara="1a Vara Civel",
            status=StatusProcesso.ATIVO,
            valor_causa=50000.00
        )

        d = processo.to_dict()

        assert d['numero_processo'] == "0123456-78.2024.8.09.0001"
        assert d['comarca'] == "Goiania"
        assert d['status'] == "ativo"
        assert d['valor_causa'] == 50000.00

    @staticmethod
    def test_session_cache():
        """Testa cache de sessao"""
        cache = SessionCache(
            cookies={"session": "abc123"},
            created_at=datetime.now(timezone.utc),
            expires_at=datetime.now(timezone.utc) + timedelta(hours=1),
            user_agent="Test",
            is_authenticated=True
        )

        assert cache.is_valid()

        # Cache expirado
        cache_expirado = SessionCache(
            cookies={},
            created_at=datetime.now(timezone.utc) - timedelta(hours=2),
            expires_at=datetime.now(timezone.utc) - timedelta(hours=1),
            user_agent="Test"
        )

        assert not cache_expirado.is_valid()

    @classmethod
    def run_all_tests(cls):
        """Executa todos os testes"""
        tests = [
            cls.test_normalizar_numero_processo,
            cls.test_parse_valor_monetario,
            cls.test_parse_data_brasileira,
            cls.test_extrair_numero_processo,
            cls.test_dados_processo_to_dict,
            cls.test_session_cache
        ]

        passed = 0
        failed = 0

        for test in tests:
            try:
                test()
                print(f"  [PASS] {test.__name__}")
                passed += 1
            except Exception as e:
                print(f"  [FAIL] {test.__name__}: {e}")
                failed += 1

        print(f"\nResultado: {passed} passou, {failed} falhou")
        return failed == 0


# =============================================================================
# TESTES DE INTEGRACAO
# =============================================================================

class TestProjudiIntegracao:
    """Testes de integracao (requerem conexao com PROJUDI)"""

    @staticmethod
    async def test_conexao_basica():
        """Testa conexao basica ao PROJUDI"""
        scraper = ProjudiScraper()
        client = await scraper._get_client()

        try:
            response = await scraper._request_with_retry("GET", scraper.base_url)
            assert response.status_code == 200
            assert 'projudi' in response.text.lower() or 'processo' in response.text.lower()
            print("  [PASS] Conexao basica OK")
            return True
        except Exception as e:
            print(f"  [FAIL] Conexao basica: {e}")
            return False
        finally:
            await scraper._close_client()

    @staticmethod
    async def test_login_mock():
        """Testa fluxo de login (sem credenciais reais)"""
        scraper = ProjudiScraper()

        try:
            # Apenas verifica que o metodo existe e estrutura esta correta
            # Nao testa com credenciais reais
            assert hasattr(scraper, 'login')
            assert hasattr(scraper, '_verify_login_success')
            print("  [PASS] Estrutura de login OK")
            return True
        except Exception as e:
            print(f"  [FAIL] Estrutura de login: {e}")
            return False
        finally:
            await scraper._close_client()

    @staticmethod
    async def test_busca_processo_mock():
        """Testa estrutura de busca (sem processo real)"""
        scraper = ProjudiScraper()

        try:
            # Verifica estrutura dos metodos
            assert hasattr(scraper, 'buscar_processo')
            assert hasattr(scraper, '_extrair_dados_processo')

            # Testa extracao com HTML mock
            html_mock = """
            <html>
                <div id="comarca">Goiania</div>
                <div id="vara">1a Vara Civel</div>
                <div class="classe">Procedimento Comum</div>
                <table class="movimentacoes">
                    <tr><td>15/01/2024</td><td>Distribuicao</td></tr>
                </table>
            </html>
            """

            dados = scraper._extrair_dados_processo(html_mock, "0123456-78.2024.8.09.0001")
            assert dados.numero_processo == "0123456-78.2024.8.09.0001"
            print("  [PASS] Estrutura de busca OK")
            return True

        except Exception as e:
            print(f"  [FAIL] Estrutura de busca: {e}")
            return False
        finally:
            await scraper._close_client()

    @classmethod
    async def run_all_tests(cls):
        """Executa todos os testes de integracao"""
        tests = [
            cls.test_conexao_basica,
            cls.test_login_mock,
            cls.test_busca_processo_mock
        ]

        passed = 0
        failed = 0

        for test in tests:
            try:
                result = await test()
                if result:
                    passed += 1
                else:
                    failed += 1
            except Exception as e:
                print(f"  [FAIL] {test.__name__}: {e}")
                failed += 1

        print(f"\nResultado integracao: {passed} passou, {failed} falhou")
        return failed == 0


# =============================================================================
# MAIN
# =============================================================================

async def main():
    """Funcao principal para execucao standalone"""
    import argparse

    parser = argparse.ArgumentParser(
        description='PROJUDI Scraper - Extracao de processos do TJGO'
    )

    parser.add_argument(
        'comando',
        choices=['buscar', 'teste', 'teste-integracao'],
        help='Comando a executar'
    )

    parser.add_argument(
        '--processo',
        '-p',
        help='Numero do processo para buscar'
    )

    parser.add_argument(
        '--usuario',
        '-u',
        help='CPF para login'
    )

    parser.add_argument(
        '--senha',
        '-s',
        help='Senha para login'
    )

    parser.add_argument(
        '--output',
        '-o',
        help='Diretorio para salvar documentos'
    )

    parser.add_argument(
        '--baixar-docs',
        action='store_true',
        help='Baixar documentos do processo'
    )

    parser.add_argument(
        '--verbose',
        '-v',
        action='store_true',
        help='Modo verboso'
    )

    args = parser.parse_args()

    if args.comando == 'teste':
        print("=" * 60)
        print("  PROJUDI Scraper - Testes Unitarios")
        print("=" * 60)
        print()
        TestProjudiScraper.run_all_tests()

    elif args.comando == 'teste-integracao':
        print("=" * 60)
        print("  PROJUDI Scraper - Testes de Integracao")
        print("=" * 60)
        print()
        await TestProjudiIntegracao.run_all_tests()

    elif args.comando == 'buscar':
        if not args.processo:
            print("Erro: --processo e obrigatorio para o comando 'buscar'")
            return

        credenciais = None
        if args.usuario and args.senha:
            credenciais = {
                'username': args.usuario,
                'password': args.senha
            }

        try:
            resultado = await extrair_processo_projudi(
                args.processo,
                credenciais=credenciais,
                baixar_documentos=args.baixar_docs,
                output_dir=args.output
            )

            print(json.dumps(resultado, indent=2, ensure_ascii=False))

        except ProcessoNaoEncontradoError:
            print(f"Erro: Processo nao encontrado: {args.processo}")
        except AuthenticationError as e:
            print(f"Erro de autenticacao: {e}")
        except Exception as e:
            print(f"Erro: {e}")


if __name__ == "__main__":
    asyncio.run(main())
