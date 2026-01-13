#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Testes Unitarios e de Integracao para ESAJ Scraper

Este modulo contem:
- Testes unitarios de parsing e validacao
- Testes de tratamento de erros
- Testes de integracao (com mock)
- Testes de performance

Autor: ROM-Agent Integration System
Data: 2026-01-12
"""

import json
import os
import sys
import tempfile
import time
import unittest
from datetime import datetime
from pathlib import Path
from unittest.mock import Mock, patch, MagicMock

# Adiciona diretorio pai ao path
sys.path.insert(0, str(Path(__file__).parent.parent))

from esaj_scraper import (
    # Classes principais
    ESAJScraper,
    ProcessoESAJ,
    Parte,
    Movimentacao,
    Documento,
    Audiencia,

    # Componentes
    CacheManager,
    LogManager,
    RateLimiter,
    CaptchaHandler,

    # Excecoes
    ESAJError,
    ESAJConnectionError,
    ESAJCaptchaError,
    ESAJProcessoNaoEncontrado,
    ESAJSegredoJustica,
    ESAJValidationError,

    # Enums
    Instancia,
    TipoParte,
    TipoDocumento,

    # Utilitarios
    validar_numero_cnj,
    validar_cpf,
    validar_cnpj,
    formatar_numero_cnj,
    formatar_cpf,
    formatar_cnpj,
    parsear_valor_monetario,
    parsear_data,
    normalizar_texto,
    limpar_html,
    gerar_hash_cache,

    # Funcoes async
    extrair_processo_esaj,
    extrair_processo_esaj_sync,
)


# =============================================================================
# HTML MOCK PARA TESTES
# =============================================================================

MOCK_HTML_PROCESSO_1G = """
<!DOCTYPE html>
<html>
<head><title>Processo 1000000-00.2024.8.26.0100</title></head>
<body>
    <div id="numeroProcesso">1000000-00.2024.8.26.0100</div>

    <table id="secaoFormBody">
        <tr>
            <td><span>Classe</span></td>
            <td><span id="classeProcesso">Procedimento Comum Civel</span></td>
        </tr>
        <tr>
            <td><span>Assunto</span></td>
            <td><span id="assuntoProcesso">Responsabilidade Civil</span></td>
        </tr>
        <tr>
            <td><span>Foro</span></td>
            <td><span>Foro Central Civel</span></td>
        </tr>
        <tr>
            <td><span>Vara</span></td>
            <td><span>1a Vara Civel</span></td>
        </tr>
        <tr>
            <td><span>Distribuicao</span></td>
            <td><span>15/01/2024</span></td>
        </tr>
        <tr>
            <td><span>Valor da acao</span></td>
            <td><span>R$ 100.000,00</span></td>
        </tr>
    </table>

    <table id="tableTodasPartes">
        <tr>
            <td>Autor</td>
            <td>
                Joao da Silva - CPF: 123.456.789-00
                <br/>Advogado: Dr. Advogado 1 (OAB/SP 123456)
            </td>
        </tr>
        <tr>
            <td>Reu</td>
            <td>
                Empresa ABC S.A. - CNPJ: 00.000.000/0001-00
                <br/>Advogada: Dra. Advogada 2 (OAB/SP 654321)
            </td>
        </tr>
    </table>

    <table id="tabelaTodasMovimentacoes">
        <tr>
            <td>15/01/2024</td>
            <td>Distribuido por sorteio</td>
        </tr>
        <tr>
            <td>16/01/2024</td>
            <td>Peticao inicial recebida</td>
        </tr>
        <tr>
            <td>20/01/2024</td>
            <td>
                Despacho proferido
                <a href="/cpopg/abrirDocumentoVinculadoMovimentacao.do?idDoc=123">Ver documento</a>
            </td>
        </tr>
    </table>
</body>
</html>
"""

MOCK_HTML_PROCESSO_2G = """
<!DOCTYPE html>
<html>
<head><title>Processo 2000000-00.2024.8.26.0000</title></head>
<body>
    <div id="numeroProcesso">2000000-00.2024.8.26.0000</div>

    <table id="secaoFormBody">
        <tr>
            <td><span>Classe</span></td>
            <td><span>Apelacao Civel</span></td>
        </tr>
        <tr>
            <td><span>Assunto</span></td>
            <td><span>Indenizacao por Dano Moral</span></td>
        </tr>
        <tr>
            <td><span>Orgao julgador</span></td>
            <td><span>10a Camara de Direito Privado</span></td>
        </tr>
        <tr>
            <td><span>Relator</span></td>
            <td><span>Des. Fulano de Tal</span></td>
        </tr>
    </table>

    <table id="tableTodasPartes">
        <tr>
            <td>Apelante</td>
            <td>Joao da Silva</td>
        </tr>
        <tr>
            <td>Apelado</td>
            <td>Empresa ABC S.A.</td>
        </tr>
    </table>

    <table id="tabelaTodasMovimentacoes">
        <tr>
            <td>15/06/2024</td>
            <td>
                Acordao publicado
                <a href="/cposg/abrirDocumentoVinculadoMovimentacao.do?idDoc=456">Ver acordao</a>
            </td>
        </tr>
    </table>
</body>
</html>
"""

MOCK_HTML_SEGREDO_JUSTICA = """
<!DOCTYPE html>
<html>
<head><title>Acesso Restrito</title></head>
<body>
    <div class="aviso">
        Este processo tramita em segredo de justica.
        Acesso restrito aos advogados das partes.
    </div>
</body>
</html>
"""

MOCK_HTML_CAPTCHA = """
<!DOCTYPE html>
<html>
<head><title>Verificacao</title></head>
<body>
    <div class="captcha">
        <p>Digite o codigo da imagem:</p>
        <img id="imagemCaptcha" src="/captcha/generate.do" />
        <input type="text" name="codigoCaptcha" />
    </div>
</body>
</html>
"""

MOCK_HTML_NAO_ENCONTRADO = """
<!DOCTYPE html>
<html>
<head><title>Consulta</title></head>
<body>
    <div class="aviso">
        Nao existem informacoes disponiveis para os parametros informados.
    </div>
</body>
</html>
"""


# =============================================================================
# TESTES UNITARIOS - VALIDACAO
# =============================================================================

class TestValidacaoNumeros(unittest.TestCase):
    """Testes de validacao de numeros de processo, CPF e CNPJ"""

    def test_validar_numero_cnj_valido(self):
        """Testa validacao de numero CNJ valido"""
        numeros_validos = [
            "1000000-00.2024.8.26.0100",
            "1000000002024826 0100",
            "10000000020248260100",
        ]
        for numero in numeros_validos:
            self.assertTrue(
                validar_numero_cnj(numero),
                f"Numero deveria ser valido: {numero}"
            )

    def test_validar_numero_cnj_invalido(self):
        """Testa validacao de numero CNJ invalido"""
        numeros_invalidos = [
            "123456",
            "1000000-00.2024.8.26",
            "abc",
            "",
            "1000000-00.2024.8.26.01001",  # muito longo
        ]
        for numero in numeros_invalidos:
            self.assertFalse(
                validar_numero_cnj(numero),
                f"Numero deveria ser invalido: {numero}"
            )

    def test_formatar_numero_cnj(self):
        """Testa formatacao de numero CNJ"""
        # Numero sem formatacao
        numero = "10000000020248260100"
        formatado = formatar_numero_cnj(numero)
        self.assertEqual(formatado, "1000000-00.2024.8.26.0100")

        # Numero ja formatado
        numero = "1000000-00.2024.8.26.0100"
        formatado = formatar_numero_cnj(numero)
        self.assertEqual(formatado, "1000000-00.2024.8.26.0100")

    def test_validar_cpf_valido(self):
        """Testa validacao de CPF valido"""
        # CPFs validos para teste
        cpfs_validos = [
            "529.982.247-25",
            "52998224725",
        ]
        for cpf in cpfs_validos:
            self.assertTrue(
                validar_cpf(cpf),
                f"CPF deveria ser valido: {cpf}"
            )

    def test_validar_cpf_invalido(self):
        """Testa validacao de CPF invalido"""
        cpfs_invalidos = [
            "111.111.111-11",  # todos iguais
            "123.456.789-00",  # digitos invalidos
            "123456",  # muito curto
            "",
        ]
        for cpf in cpfs_invalidos:
            self.assertFalse(
                validar_cpf(cpf),
                f"CPF deveria ser invalido: {cpf}"
            )

    def test_formatar_cpf(self):
        """Testa formatacao de CPF"""
        cpf = "52998224725"
        formatado = formatar_cpf(cpf)
        self.assertEqual(formatado, "529.982.247-25")

    def test_validar_cnpj_valido(self):
        """Testa validacao de CNPJ valido"""
        # CNPJ valido para teste
        cnpj = "11.222.333/0001-81"
        self.assertTrue(validar_cnpj(cnpj))

    def test_validar_cnpj_invalido(self):
        """Testa validacao de CNPJ invalido"""
        cnpjs_invalidos = [
            "11.111.111/1111-11",  # todos iguais
            "00.000.000/0001-00",  # digitos invalidos
            "123456",  # muito curto
        ]
        for cnpj in cnpjs_invalidos:
            self.assertFalse(
                validar_cnpj(cnpj),
                f"CNPJ deveria ser invalido: {cnpj}"
            )

    def test_formatar_cnpj(self):
        """Testa formatacao de CNPJ"""
        cnpj = "11222333000181"
        formatado = formatar_cnpj(cnpj)
        self.assertEqual(formatado, "11.222.333/0001-81")


# =============================================================================
# TESTES UNITARIOS - PARSING
# =============================================================================

class TestParsing(unittest.TestCase):
    """Testes de parsing de dados"""

    def test_parsear_valor_monetario(self):
        """Testa parsing de valores monetarios"""
        casos = [
            ("R$ 100.000,00", 100000.0),
            ("R$ 1.234,56", 1234.56),
            ("R$1000,00", 1000.0),
            ("valor: R$ 500,00", 500.0),
            ("sem valor", None),
            ("", None),
            (None, None),
        ]
        for texto, esperado in casos:
            resultado = parsear_valor_monetario(texto)
            self.assertEqual(
                resultado, esperado,
                f"Parsing de '{texto}' deveria ser {esperado}, mas foi {resultado}"
            )

    def test_parsear_data(self):
        """Testa parsing de datas"""
        casos = [
            ("15/01/2024", "2024-01-15"),
            ("01/12/2023", "2023-12-01"),
            ("2024-06-15", "2024-06-15"),
            ("Data: 10/05/2024", "2024-05-10"),
            ("", None),
            (None, None),
        ]
        for texto, esperado in casos:
            resultado = parsear_data(texto)
            self.assertEqual(
                resultado, esperado,
                f"Parsing de '{texto}' deveria ser {esperado}, mas foi {resultado}"
            )

    def test_normalizar_texto(self):
        """Testa normalizacao de texto"""
        casos = [
            ("Joao da Silva", "Joao da Silva"),
            ("acao", "acao"),
            ("  texto   com   espacos  ", "texto com espacos"),
            ("", ""),
        ]
        for texto, esperado in casos:
            resultado = normalizar_texto(texto)
            self.assertEqual(resultado, esperado)

    def test_limpar_html(self):
        """Testa limpeza de HTML"""
        casos = [
            ("<p>Texto</p>", "Texto"),
            ("<div><span>A</span> <span>B</span></div>", "A B"),
            ("Texto &nbsp; com &amp; entidades", "Texto com entidades"),
            ("", ""),
        ]
        for html, esperado in casos:
            resultado = limpar_html(html)
            self.assertEqual(resultado, esperado)


# =============================================================================
# TESTES UNITARIOS - DATACLASSES
# =============================================================================

class TestDataclasses(unittest.TestCase):
    """Testes das dataclasses"""

    def test_processo_esaj_criacao(self):
        """Testa criacao de ProcessoESAJ"""
        processo = ProcessoESAJ(
            numero_processo="1000000-00.2024.8.26.0100",
            tribunal="TJSP",
            instancia="1"
        )

        self.assertEqual(processo.numero_processo, "1000000-00.2024.8.26.0100")
        self.assertEqual(processo.tribunal, "TJSP")
        self.assertEqual(processo.sistema, "ESAJ")
        self.assertEqual(processo.instancia, "1")
        self.assertFalse(processo.segredo_justica)
        self.assertIsNotNone(processo.timestamp_extracao)

    def test_processo_esaj_to_dict(self):
        """Testa conversao para dicionario"""
        processo = ProcessoESAJ(
            numero_processo="1000000-00.2024.8.26.0100",
            classe="Procedimento Comum",
            valor_causa=100000.0
        )

        dados = processo.to_dict()

        self.assertIsInstance(dados, dict)
        self.assertEqual(dados["numero_processo"], "1000000-00.2024.8.26.0100")
        self.assertEqual(dados["classe"], "Procedimento Comum")
        self.assertEqual(dados["valor_causa"], 100000.0)

    def test_processo_esaj_to_json(self):
        """Testa conversao para JSON"""
        processo = ProcessoESAJ(
            numero_processo="1000000-00.2024.8.26.0100"
        )

        json_str = processo.to_json()

        self.assertIsInstance(json_str, str)
        dados = json.loads(json_str)
        self.assertEqual(dados["numero_processo"], "1000000-00.2024.8.26.0100")

    def test_parte_to_dict(self):
        """Testa conversao de Parte para dict"""
        parte = Parte(
            tipo="autor",
            nome="Joao da Silva",
            documento="123.456.789-00",
            tipo_documento="CPF",
            advogados=["Dr. Advogado (OAB/SP 123456)"]
        )

        dados = parte.to_dict()

        self.assertEqual(dados["tipo"], "autor")
        self.assertEqual(dados["nome"], "Joao da Silva")
        self.assertEqual(len(dados["advogados"]), 1)

    def test_movimentacao_to_dict(self):
        """Testa conversao de Movimentacao para dict"""
        mov = Movimentacao(
            data="2024-01-15",
            descricao="Distribuido por sorteio"
        )

        dados = mov.to_dict()

        self.assertEqual(dados["data"], "2024-01-15")
        self.assertEqual(dados["descricao"], "Distribuido por sorteio")


# =============================================================================
# TESTES UNITARIOS - CACHE
# =============================================================================

class TestCacheManager(unittest.TestCase):
    """Testes do gerenciador de cache"""

    def setUp(self):
        """Prepara ambiente de teste"""
        self.temp_dir = tempfile.mkdtemp()
        self.cache = CacheManager(
            cache_dir=self.temp_dir,
            ttl=60,
            enabled=True
        )

    def tearDown(self):
        """Limpa ambiente de teste"""
        import shutil
        shutil.rmtree(self.temp_dir, ignore_errors=True)

    def test_cache_set_get(self):
        """Testa set e get do cache"""
        dados = {"numero": "123", "classe": "Teste"}

        self.cache.set("teste_key", dados)
        resultado = self.cache.get("teste_key")

        self.assertEqual(resultado, dados)

    def test_cache_miss(self):
        """Testa cache miss"""
        resultado = self.cache.get("chave_inexistente")
        self.assertIsNone(resultado)

    def test_cache_invalidate(self):
        """Testa invalidacao de cache"""
        dados = {"teste": True}

        self.cache.set("key", dados)
        self.cache.invalidate("key")

        resultado = self.cache.get("key")
        self.assertIsNone(resultado)

    def test_cache_clear(self):
        """Testa limpeza total do cache"""
        self.cache.set("key1", {"a": 1})
        self.cache.set("key2", {"b": 2})

        self.cache.clear()

        self.assertEqual(self.cache.size, 0)

    def test_cache_ttl_expirado(self):
        """Testa expiracao de cache por TTL"""
        cache_curto = CacheManager(
            cache_dir=self.temp_dir,
            ttl=1,  # 1 segundo
            enabled=True
        )

        cache_curto.set("key", {"teste": True})
        time.sleep(1.5)  # Espera expirar

        resultado = cache_curto.get("key")
        self.assertIsNone(resultado)

    def test_cache_disabled(self):
        """Testa cache desabilitado"""
        cache_off = CacheManager(
            cache_dir=self.temp_dir,
            enabled=False
        )

        cache_off.set("key", {"teste": True})
        resultado = cache_off.get("key")

        self.assertIsNone(resultado)


# =============================================================================
# TESTES UNITARIOS - RATE LIMITER
# =============================================================================

class TestRateLimiter(unittest.TestCase):
    """Testes do rate limiter"""

    def test_rate_limit_basico(self):
        """Testa rate limiting basico"""
        limiter = RateLimiter(rate=0.1)  # 100ms

        inicio = time.time()
        limiter.wait()
        limiter.wait()
        duracao = time.time() - inicio

        # Deve ter aguardado pelo menos 100ms entre requisicoes
        self.assertGreaterEqual(duracao, 0.1)

    def test_backoff_em_erro(self):
        """Testa backoff exponencial em erro"""
        limiter = RateLimiter(rate=0.1, backoff_factor=2.0)

        backoff_inicial = limiter._current_backoff
        limiter.error()
        backoff_apos_erro = limiter._current_backoff

        self.assertGreater(backoff_apos_erro, backoff_inicial)

    def test_reset_backoff_em_sucesso(self):
        """Testa reset do backoff em sucesso"""
        limiter = RateLimiter(rate=0.1)

        limiter.error()
        limiter.error()
        limiter.success()

        self.assertEqual(limiter._current_backoff, 0.1)

    def test_contador_requisicoes(self):
        """Testa contador de requisicoes"""
        limiter = RateLimiter(rate=0.01)  # 10ms

        limiter.wait()
        limiter.wait()
        limiter.wait()

        self.assertEqual(limiter.request_count, 3)


# =============================================================================
# TESTES UNITARIOS - CAPTCHA HANDLER
# =============================================================================

class TestCaptchaHandler(unittest.TestCase):
    """Testes do handler de CAPTCHA"""

    def setUp(self):
        """Prepara ambiente de teste"""
        self.handler = CaptchaHandler()

    def test_detectar_captcha_presente(self):
        """Testa deteccao de CAPTCHA presente"""
        self.assertTrue(self.handler.detectar_captcha(MOCK_HTML_CAPTCHA))

    def test_detectar_captcha_ausente(self):
        """Testa deteccao de CAPTCHA ausente"""
        self.assertFalse(self.handler.detectar_captcha(MOCK_HTML_PROCESSO_1G))

    def test_extrair_url_captcha(self):
        """Testa extracao de URL do CAPTCHA"""
        url = self.handler.extrair_url_captcha(MOCK_HTML_CAPTCHA)
        self.assertIsNotNone(url)
        self.assertIn("captcha", url)

    def test_stats(self):
        """Testa estatisticas do handler"""
        stats = self.handler.stats

        self.assertIn("tentativas", stats)
        self.assertIn("sucessos", stats)
        self.assertIn("taxa_sucesso", stats)


# =============================================================================
# TESTES DE INTEGRACAO (COM MOCK)
# =============================================================================

class TestESAJScraperMock(unittest.TestCase):
    """Testes de integracao com respostas mockadas"""

    def setUp(self):
        """Prepara ambiente de teste"""
        self.temp_dir = tempfile.mkdtemp()

    def tearDown(self):
        """Limpa ambiente de teste"""
        import shutil
        shutil.rmtree(self.temp_dir, ignore_errors=True)

    @patch('esaj_scraper.requests.Session')
    def test_extrair_processo_1g_mock(self, mock_session):
        """Testa extracao de processo 1G com mock"""
        # Configura mock
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.text = MOCK_HTML_PROCESSO_1G
        mock_response.url = "https://esaj.tjsp.jus.br/cpopg/show.do"
        mock_response.content = b"PDF content"

        mock_session_instance = Mock()
        mock_session_instance.get.return_value = mock_response
        mock_session_instance.post.return_value = mock_response
        mock_session_instance.headers = {}
        mock_session.return_value = mock_session_instance

        # Executa
        scraper = ESAJScraper(
            cache_dir=f"{self.temp_dir}/cache",
            log_dir=f"{self.temp_dir}/logs",
            cache_enabled=False
        )
        scraper._session = mock_session_instance

        # Nota: Este teste verifica se a estrutura basica funciona
        # com o HTML mockado
        from bs4 import BeautifulSoup
        soup = BeautifulSoup(MOCK_HTML_PROCESSO_1G, 'html.parser')

        # Testa extracao de dados basicos
        dados = scraper._extrair_dados_basicos(soup, "1")
        self.assertIn("classe", dados)

        # Testa extracao de partes
        partes = scraper._extrair_partes(soup)
        self.assertIsInstance(partes, list)

        # Testa extracao de movimentacoes
        movs = scraper._extrair_movimentacoes(soup)
        self.assertIsInstance(movs, list)

    def test_detectar_segredo_justica(self):
        """Testa deteccao de segredo de justica"""
        scraper = ESAJScraper(
            cache_dir=f"{self.temp_dir}/cache",
            log_dir=f"{self.temp_dir}/logs",
            cache_enabled=False
        )

        # Com segredo de justica
        self.assertTrue(
            scraper.detectar_segredo_justica(MOCK_HTML_SEGREDO_JUSTICA)
        )

        # Sem segredo de justica
        self.assertFalse(
            scraper.detectar_segredo_justica(MOCK_HTML_PROCESSO_1G)
        )

    def test_parsear_numero_processo(self):
        """Testa parsing de numero de processo"""
        scraper = ESAJScraper(
            cache_dir=f"{self.temp_dir}/cache",
            log_dir=f"{self.temp_dir}/logs",
            cache_enabled=False
        )

        componentes = scraper._parsear_numero_processo("1000000-00.2024.8.26.0100")

        self.assertEqual(componentes["numero_sequencial"], "1000000")
        self.assertEqual(componentes["digito_verificador"], "00")
        self.assertEqual(componentes["ano"], "2024")
        self.assertEqual(componentes["segmento_justica"], "8")
        self.assertEqual(componentes["tribunal"], "26")
        self.assertEqual(componentes["foro_origem"], "0100")

    def test_parsear_numero_processo_invalido(self):
        """Testa parsing de numero invalido"""
        scraper = ESAJScraper(
            cache_dir=f"{self.temp_dir}/cache",
            log_dir=f"{self.temp_dir}/logs",
            cache_enabled=False
        )

        with self.assertRaises(ESAJValidationError):
            scraper._parsear_numero_processo("123456")


# =============================================================================
# TESTES DE EXCECOES
# =============================================================================

class TestExcecoes(unittest.TestCase):
    """Testes de tratamento de excecoes"""

    def test_esaj_error(self):
        """Testa excecao base"""
        with self.assertRaises(ESAJError):
            raise ESAJError("Erro generico")

    def test_esaj_connection_error(self):
        """Testa excecao de conexao"""
        with self.assertRaises(ESAJConnectionError):
            raise ESAJConnectionError("Falha de conexao")

    def test_esaj_captcha_error(self):
        """Testa excecao de CAPTCHA"""
        with self.assertRaises(ESAJCaptchaError):
            raise ESAJCaptchaError("CAPTCHA nao resolvido")

    def test_esaj_processo_nao_encontrado(self):
        """Testa excecao de processo nao encontrado"""
        with self.assertRaises(ESAJProcessoNaoEncontrado):
            raise ESAJProcessoNaoEncontrado("Processo X nao encontrado")

    def test_esaj_segredo_justica(self):
        """Testa excecao de segredo de justica"""
        with self.assertRaises(ESAJSegredoJustica):
            raise ESAJSegredoJustica("Processo em sigilo")

    def test_esaj_validation_error(self):
        """Testa excecao de validacao"""
        with self.assertRaises(ESAJValidationError):
            raise ESAJValidationError("Numero invalido")

    def test_heranca_excecoes(self):
        """Testa heranca de excecoes"""
        # Todas devem herdar de ESAJError
        excecoes = [
            ESAJConnectionError,
            ESAJCaptchaError,
            ESAJProcessoNaoEncontrado,
            ESAJSegredoJustica,
            ESAJValidationError,
        ]

        for exc_class in excecoes:
            self.assertTrue(issubclass(exc_class, ESAJError))


# =============================================================================
# TESTES DE PERFORMANCE
# =============================================================================

class TestPerformance(unittest.TestCase):
    """Testes de performance"""

    def test_cache_performance(self):
        """Testa performance do cache"""
        temp_dir = tempfile.mkdtemp()
        cache = CacheManager(cache_dir=temp_dir, enabled=True)

        # Insere 100 entradas
        inicio = time.time()
        for i in range(100):
            cache.set(f"key_{i}", {"valor": i})
        tempo_insercao = time.time() - inicio

        # Deve inserir 100 entradas em menos de 1 segundo
        self.assertLess(tempo_insercao, 1.0)

        # Recupera 100 entradas
        inicio = time.time()
        for i in range(100):
            cache.get(f"key_{i}")
        tempo_leitura = time.time() - inicio

        # Deve ler 100 entradas em menos de 0.5 segundo
        self.assertLess(tempo_leitura, 0.5)

        # Limpa
        import shutil
        shutil.rmtree(temp_dir, ignore_errors=True)

    def test_parsing_performance(self):
        """Testa performance de parsing"""
        from bs4 import BeautifulSoup

        # Gera HTML grande
        html_grande = MOCK_HTML_PROCESSO_1G * 10

        inicio = time.time()
        soup = BeautifulSoup(html_grande, 'html.parser')
        tempo_parse = time.time() - inicio

        # Deve parsear em menos de 2 segundos
        self.assertLess(tempo_parse, 2.0)


# =============================================================================
# TESTES DE VALIDACAO DE FORMATO
# =============================================================================

class TestFormatoSaida(unittest.TestCase):
    """Testes do formato de saida esperado"""

    def test_formato_processo_1g(self):
        """Verifica formato de saida de processo 1G"""
        processo = ProcessoESAJ(
            numero_processo="1000000-00.2024.8.26.0100",
            tribunal="TJSP",
            sistema="ESAJ",
            instancia="1",
            comarca="Sao Paulo",
            vara="1a Vara Civel",
            classe="Procedimento Comum Civel",
            assunto="Responsabilidade Civil",
            data_distribuicao="2024-01-15",
            valor_causa=100000.0,
            partes=[
                {
                    "tipo": "autor",
                    "nome": "Joao da Silva",
                    "documento": "123.456.789-00",
                    "tipo_documento": "CPF",
                    "advogados": ["Dr. Advogado 1 (OAB/SP 123456)"]
                }
            ],
            movimentacoes=[
                {
                    "data": "2024-01-15",
                    "descricao": "Distribuido por sorteio"
                }
            ],
            segredo_justica=False
        )

        dados = processo.to_dict()

        # Verifica campos obrigatorios
        self.assertEqual(dados["numero_processo"], "1000000-00.2024.8.26.0100")
        self.assertEqual(dados["tribunal"], "TJSP")
        self.assertEqual(dados["sistema"], "ESAJ")
        self.assertEqual(dados["instancia"], "1")
        self.assertFalse(dados["segredo_justica"])
        self.assertIsNotNone(dados["timestamp_extracao"])

    def test_formato_processo_2g(self):
        """Verifica formato de saida de processo 2G"""
        processo = ProcessoESAJ(
            numero_processo="2000000-00.2024.8.26.0000",
            tribunal="TJSP",
            sistema="ESAJ",
            instancia="2",
            classe="Apelacao Civel",
            assunto="Indenizacao por Dano Moral",
            orgao_julgador="10a Camara de Direito Privado",
            relator="Des. Fulano de Tal",
            segredo_justica=False
        )

        dados = processo.to_dict()

        # Verifica campos de 2o grau
        self.assertEqual(dados["instancia"], "2")
        self.assertIsNotNone(dados["orgao_julgador"])
        self.assertIsNotNone(dados["relator"])


# =============================================================================
# RUNNER
# =============================================================================

def run_tests():
    """Executa todos os testes"""
    # Cria suite de testes
    loader = unittest.TestLoader()
    suite = unittest.TestSuite()

    # Adiciona todos os testes
    suite.addTests(loader.loadTestsFromTestCase(TestValidacaoNumeros))
    suite.addTests(loader.loadTestsFromTestCase(TestParsing))
    suite.addTests(loader.loadTestsFromTestCase(TestDataclasses))
    suite.addTests(loader.loadTestsFromTestCase(TestCacheManager))
    suite.addTests(loader.loadTestsFromTestCase(TestRateLimiter))
    suite.addTests(loader.loadTestsFromTestCase(TestCaptchaHandler))
    suite.addTests(loader.loadTestsFromTestCase(TestESAJScraperMock))
    suite.addTests(loader.loadTestsFromTestCase(TestExcecoes))
    suite.addTests(loader.loadTestsFromTestCase(TestPerformance))
    suite.addTests(loader.loadTestsFromTestCase(TestFormatoSaida))

    # Executa
    runner = unittest.TextTestRunner(verbosity=2)
    result = runner.run(suite)

    # Retorna codigo de saida
    return 0 if result.wasSuccessful() else 1


if __name__ == "__main__":
    sys.exit(run_tests())
