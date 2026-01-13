#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Testes para o PROJUDI Scraper

Este modulo contem testes unitarios e de integracao para o scraper do PROJUDI TJGO.

Autor: ROM-Agent Integration System
Data: 2026-01-12
"""

import asyncio
import json
import os
import sys
import tempfile
import unittest
from datetime import datetime, timedelta
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

# Adiciona diretorio pai ao path
sys.path.insert(0, str(Path(__file__).parent.parent))

from projudi_scraper import (
    # Classes principais
    ProjudiScraper,
    ProxyManager,
    ProjudiLogger,

    # Dataclasses
    DadosProcesso,
    Parte,
    Advogado,
    Movimentacao,
    Documento,
    SessionCache,

    # Enums
    StatusProcesso,
    TipoBusca,
    TipoParte,

    # Excecoes
    ProjudiError,
    AuthenticationError,
    CaptchaError,
    RateLimitError,
    ProcessoNaoEncontradoError,
    NetworkError,
    ParseError,

    # Funcoes utilitarias
    normalizar_numero_processo,
    extrair_numero_processo,
    parse_valor_monetario,
    parse_data_brasileira,
    gerar_nome_arquivo,
    calcular_hash_arquivo,

    # Funcoes principais
    extrair_processo_projudi,
    extrair_processo_projudi_sync
)


class TestNormalizarNumeroProcesso(unittest.TestCase):
    """Testes para normalizacao de numero de processo"""

    def test_formato_completo_com_separadores(self):
        """Testa formato completo com pontos e hifen"""
        resultado = normalizar_numero_processo("0123456-78.2024.8.09.0001")
        self.assertEqual(resultado, "0123456-78.2024.8.09.0001")

    def test_formato_sem_separadores(self):
        """Testa formato apenas com numeros"""
        resultado = normalizar_numero_processo("01234567820248090001")
        self.assertEqual(resultado, "0123456-78.2024.8.09.0001")

    def test_formato_parcial_com_espacos(self):
        """Testa formato com espacos"""
        resultado = normalizar_numero_processo("0123456 78 2024 8 09 0001")
        self.assertEqual(resultado, "0123456-78.2024.8.09.0001")

    def test_numero_invalido_curto(self):
        """Testa erro para numero muito curto"""
        with self.assertRaises(ValueError):
            normalizar_numero_processo("123456")

    def test_numero_invalido_longo(self):
        """Testa erro para numero muito longo"""
        with self.assertRaises(ValueError):
            normalizar_numero_processo("012345678901234567890123")

    def test_numero_vazio(self):
        """Testa erro para numero vazio"""
        with self.assertRaises(ValueError):
            normalizar_numero_processo("")


class TestExtrairNumeroProcesso(unittest.TestCase):
    """Testes para extracao de numero de processo de texto"""

    def test_extrair_de_texto_simples(self):
        """Testa extracao de texto com numero"""
        texto = "Processo numero 0123456-78.2024.8.09.0001 em tramite"
        resultado = extrair_numero_processo(texto)
        self.assertEqual(resultado, "0123456-78.2024.8.09.0001")

    def test_extrair_sem_separadores(self):
        """Testa extracao de numero sem separadores"""
        texto = "Processo 01234567820248090001"
        resultado = extrair_numero_processo(texto)
        self.assertEqual(resultado, "0123456-78.2024.8.09.0001")

    def test_nao_encontrado(self):
        """Testa texto sem numero de processo"""
        texto = "Este texto nao contem numero de processo"
        resultado = extrair_numero_processo(texto)
        self.assertIsNone(resultado)

    def test_texto_vazio(self):
        """Testa texto vazio"""
        resultado = extrair_numero_processo("")
        self.assertIsNone(resultado)


class TestParseValorMonetario(unittest.TestCase):
    """Testes para parsing de valores monetarios"""

    def test_valor_com_simbolo_reais(self):
        """Testa valor com R$"""
        resultado = parse_valor_monetario("R$ 1.234,56")
        self.assertEqual(resultado, 1234.56)

    def test_valor_grande(self):
        """Testa valor com milhoes"""
        resultado = parse_valor_monetario("R$ 1.234.567,89")
        self.assertEqual(resultado, 1234567.89)

    def test_valor_sem_simbolo(self):
        """Testa valor sem R$"""
        resultado = parse_valor_monetario("1234,56")
        self.assertEqual(resultado, 1234.56)

    def test_valor_inteiro(self):
        """Testa valor inteiro"""
        resultado = parse_valor_monetario("R$ 1.000,00")
        self.assertEqual(resultado, 1000.00)

    def test_valor_vazio(self):
        """Testa string vazia"""
        resultado = parse_valor_monetario("")
        self.assertIsNone(resultado)

    def test_valor_none(self):
        """Testa None"""
        resultado = parse_valor_monetario(None)
        self.assertIsNone(resultado)

    def test_valor_invalido(self):
        """Testa valor invalido"""
        resultado = parse_valor_monetario("texto invalido")
        self.assertIsNone(resultado)


class TestParseDataBrasileira(unittest.TestCase):
    """Testes para parsing de datas brasileiras"""

    def test_formato_dd_mm_yyyy(self):
        """Testa formato DD/MM/YYYY"""
        resultado = parse_data_brasileira("15/01/2024")
        self.assertEqual(resultado, datetime(2024, 1, 15))

    def test_formato_dd_mm_yy(self):
        """Testa formato DD/MM/YY"""
        resultado = parse_data_brasileira("15/01/24")
        self.assertEqual(resultado.day, 15)
        self.assertEqual(resultado.month, 1)

    def test_formato_hifen(self):
        """Testa formato com hifen"""
        resultado = parse_data_brasileira("15-01-2024")
        self.assertEqual(resultado, datetime(2024, 1, 15))

    def test_formato_iso(self):
        """Testa formato ISO"""
        resultado = parse_data_brasileira("2024-01-15")
        self.assertEqual(resultado, datetime(2024, 1, 15))

    def test_data_vazia(self):
        """Testa string vazia"""
        resultado = parse_data_brasileira("")
        self.assertIsNone(resultado)

    def test_data_none(self):
        """Testa None"""
        resultado = parse_data_brasileira(None)
        self.assertIsNone(resultado)

    def test_data_invalida(self):
        """Testa data invalida"""
        resultado = parse_data_brasileira("data invalida")
        self.assertIsNone(resultado)


class TestGerarNomeArquivo(unittest.TestCase):
    """Testes para geracao de nomes de arquivo"""

    def test_nome_basico(self):
        """Testa geracao basica"""
        resultado = gerar_nome_arquivo("0123456-78.2024.8.09.0001", "Peticao Inicial")
        self.assertIn("01234567820248090001", resultado)
        self.assertIn("Peticao_Inicial", resultado)
        self.assertTrue(resultado.endswith(".pdf"))

    def test_nome_com_caracteres_especiais(self):
        """Testa remocao de caracteres especiais"""
        resultado = gerar_nome_arquivo("0123456-78.2024.8.09.0001", "Peca@#$%Teste")
        self.assertNotIn("@", resultado)
        self.assertNotIn("#", resultado)

    def test_extensao_customizada(self):
        """Testa extensao customizada"""
        resultado = gerar_nome_arquivo("0123456-78.2024.8.09.0001", "Documento", "doc")
        self.assertTrue(resultado.endswith(".doc"))


class TestStatusProcesso(unittest.TestCase):
    """Testes para enum StatusProcesso"""

    def test_valores_enum(self):
        """Testa valores do enum"""
        self.assertEqual(StatusProcesso.ATIVO.value, "ativo")
        self.assertEqual(StatusProcesso.ARQUIVADO.value, "arquivado")
        self.assertEqual(StatusProcesso.SUSPENSO.value, "suspenso")
        self.assertEqual(StatusProcesso.BAIXADO.value, "baixado")
        self.assertEqual(StatusProcesso.TRAMITANDO.value, "tramitando")


class TestDadosProcesso(unittest.TestCase):
    """Testes para dataclass DadosProcesso"""

    def test_criacao_basica(self):
        """Testa criacao basica"""
        processo = DadosProcesso(numero_processo="0123456-78.2024.8.09.0001")
        self.assertEqual(processo.numero_processo, "0123456-78.2024.8.09.0001")
        self.assertEqual(processo.tribunal, "TJGO")
        self.assertEqual(processo.sistema, "PROJUDI")

    def test_to_dict(self):
        """Testa serializacao para dict"""
        processo = DadosProcesso(
            numero_processo="0123456-78.2024.8.09.0001",
            comarca="Goiania",
            vara="1a Vara Civel",
            status=StatusProcesso.ATIVO,
            valor_causa=50000.00,
            data_distribuicao=datetime(2024, 1, 15)
        )

        d = processo.to_dict()

        self.assertEqual(d['numero_processo'], "0123456-78.2024.8.09.0001")
        self.assertEqual(d['comarca'], "Goiania")
        self.assertEqual(d['status'], "ativo")
        self.assertEqual(d['valor_causa'], 50000.00)
        self.assertEqual(d['data_distribuicao'], "2024-01-15")

    def test_partes(self):
        """Testa adicao de partes"""
        processo = DadosProcesso(numero_processo="0123456-78.2024.8.09.0001")

        autor = Parte(
            tipo=TipoParte.AUTOR,
            nome="Joao da Silva",
            cpf_cnpj="123.456.789-00"
        )

        reu = Parte(
            tipo=TipoParte.REU,
            nome="Empresa XYZ Ltda",
            cpf_cnpj="12.345.678/0001-00"
        )

        processo.partes = [autor, reu]

        d = processo.to_dict()
        self.assertEqual(len(d['partes']), 2)
        self.assertEqual(d['partes'][0]['tipo'], 'autor')
        self.assertEqual(d['partes'][1]['tipo'], 'reu')


class TestParte(unittest.TestCase):
    """Testes para dataclass Parte"""

    def test_criacao_com_cpf(self):
        """Testa criacao com CPF"""
        parte = Parte(
            tipo=TipoParte.AUTOR,
            nome="Joao da Silva",
            cpf_cnpj="123.456.789-00"
        )

        d = parte.to_dict()
        self.assertEqual(d['nome'], "Joao da Silva")
        self.assertEqual(d['cpf'], "123.456.789-00")
        self.assertIsNone(d['cnpj'])

    def test_criacao_com_cnpj(self):
        """Testa criacao com CNPJ"""
        parte = Parte(
            tipo=TipoParte.REU,
            nome="Empresa XYZ",
            cpf_cnpj="12.345.678/0001-00"
        )

        d = parte.to_dict()
        self.assertIsNone(d['cpf'])
        self.assertEqual(d['cnpj'], "12.345.678/0001-00")


class TestAdvogado(unittest.TestCase):
    """Testes para dataclass Advogado"""

    def test_str_completo(self):
        """Testa representacao string com OAB"""
        adv = Advogado(
            nome="Dr. Fulano",
            oab_numero="12345",
            oab_estado="GO"
        )
        self.assertEqual(str(adv), "Dr. Fulano (OAB/GO 12345)")

    def test_str_sem_oab(self):
        """Testa representacao string sem OAB"""
        adv = Advogado(nome="Dr. Fulano")
        self.assertEqual(str(adv), "Dr. Fulano")


class TestSessionCache(unittest.TestCase):
    """Testes para SessionCache"""

    def test_cache_valido(self):
        """Testa cache valido"""
        cache = SessionCache(
            cookies={"session": "abc123"},
            created_at=datetime.utcnow(),
            expires_at=datetime.utcnow() + timedelta(hours=1),
            user_agent="Test",
            is_authenticated=True
        )
        self.assertTrue(cache.is_valid())

    def test_cache_expirado(self):
        """Testa cache expirado"""
        cache = SessionCache(
            cookies={},
            created_at=datetime.utcnow() - timedelta(hours=2),
            expires_at=datetime.utcnow() - timedelta(hours=1),
            user_agent="Test"
        )
        self.assertFalse(cache.is_valid())


class TestProxyManager(unittest.TestCase):
    """Testes para ProxyManager"""

    def test_sem_proxies(self):
        """Testa sem proxies configurados"""
        pm = ProxyManager()
        self.assertIsNone(pm.get_proxy())

    def test_com_proxies(self):
        """Testa com lista de proxies"""
        pm = ProxyManager(proxies=[
            "http://proxy1:8080",
            "http://proxy2:8080"
        ])

        proxy1 = pm.get_proxy()
        proxy2 = pm.get_proxy()

        self.assertIn(proxy1, ["http://proxy1:8080", "http://proxy2:8080"])
        self.assertIn(proxy2, ["http://proxy1:8080", "http://proxy2:8080"])

    def test_rotacao(self):
        """Testa rotacao de proxies"""
        pm = ProxyManager(
            proxies=["http://proxy1:8080", "http://proxy2:8080"],
            enable_rotation=True
        )

        primeiro = pm.get_proxy()
        segundo = pm.get_proxy()
        terceiro = pm.get_proxy()

        self.assertNotEqual(primeiro, segundo)
        self.assertEqual(primeiro, terceiro)  # Volta ao primeiro

    def test_estatisticas(self):
        """Testa estatisticas de uso"""
        pm = ProxyManager(proxies=["http://proxy1:8080"])

        pm.get_proxy()
        pm.report_success("http://proxy1:8080")
        pm.report_failure("http://proxy1:8080", "timeout")

        stats = pm.get_stats()

        self.assertEqual(stats["http://proxy1:8080"]["requests"], 1)
        self.assertEqual(stats["http://proxy1:8080"]["successes"], 1)
        self.assertEqual(stats["http://proxy1:8080"]["failures"], 1)


class TestProjudiLogger(unittest.TestCase):
    """Testes para ProjudiLogger"""

    def test_criacao(self):
        """Testa criacao do logger"""
        logger = ProjudiLogger(name="TestLogger", level=10)
        self.assertIsNotNone(logger.logger)

    def test_log_request(self):
        """Testa log de requisicao"""
        logger = ProjudiLogger(name="TestLogger", level=10)
        # Nao deve lancar excecao
        logger.log_request("GET", "http://example.com", 200, 100.5)

    def test_log_retry(self):
        """Testa log de retry"""
        logger = ProjudiLogger(name="TestLogger", level=10)
        logger.log_retry(1, 3, "timeout")

    def test_log_success(self):
        """Testa log de sucesso"""
        logger = ProjudiLogger(name="TestLogger", level=10)
        logger.log_success("Operacao", "detalhes")

    def test_log_failure(self):
        """Testa log de falha"""
        logger = ProjudiLogger(name="TestLogger", level=10)
        logger.log_failure("Operacao", "erro")


class TestExcecoes(unittest.TestCase):
    """Testes para excecoes customizadas"""

    def test_projudi_error(self):
        """Testa excecao base"""
        with self.assertRaises(ProjudiError):
            raise ProjudiError("Erro teste")

    def test_authentication_error(self):
        """Testa excecao de autenticacao"""
        with self.assertRaises(AuthenticationError):
            raise AuthenticationError("Login falhou")

    def test_captcha_error(self):
        """Testa excecao de CAPTCHA"""
        with self.assertRaises(CaptchaError):
            raise CaptchaError("CAPTCHA detectado")

    def test_processo_nao_encontrado(self):
        """Testa excecao de processo nao encontrado"""
        with self.assertRaises(ProcessoNaoEncontradoError):
            raise ProcessoNaoEncontradoError("Processo nao existe")


class TestProjudiScraperUnit(unittest.TestCase):
    """Testes unitarios para ProjudiScraper"""

    def setUp(self):
        """Setup dos testes"""
        self.scraper = ProjudiScraper()

    def test_inicializacao(self):
        """Testa inicializacao do scraper"""
        self.assertEqual(self.scraper.base_url, "https://projudi.tjgo.jus.br")
        self.assertEqual(self.scraper.timeout, 30)
        self.assertEqual(self.scraper.max_retries, 3)
        self.assertFalse(self.scraper._is_authenticated)

    def test_inicializacao_customizada(self):
        """Testa inicializacao com parametros customizados"""
        scraper = ProjudiScraper(
            base_url="http://custom.url",
            timeout=60,
            max_retries=5,
            rate_limit=2.0
        )

        self.assertEqual(scraper.base_url, "http://custom.url")
        self.assertEqual(scraper.timeout, 60)
        self.assertEqual(scraper.max_retries, 5)
        self.assertEqual(scraper.rate_limit, 2.0)

    def test_inferir_status_arquivado(self):
        """Testa inferencia de status arquivado"""
        status = self.scraper._inferir_status("Processo ARQUIVADO definitivamente")
        self.assertEqual(status, StatusProcesso.ARQUIVADO)

    def test_inferir_status_arquivado_provisorio(self):
        """Testa inferencia de status arquivado provisoriamente"""
        status = self.scraper._inferir_status("Arquivado provisoriamente")
        self.assertEqual(status, StatusProcesso.ARQUIVADO_PROVISORIAMENTE)

    def test_inferir_status_suspenso(self):
        """Testa inferencia de status suspenso"""
        status = self.scraper._inferir_status("Processo suspenso")
        self.assertEqual(status, StatusProcesso.SUSPENSO)

    def test_inferir_status_tramitando(self):
        """Testa inferencia de status tramitando"""
        status = self.scraper._inferir_status("Em tramitacao")
        self.assertEqual(status, StatusProcesso.TRAMITANDO)

    def test_inferir_status_desconhecido(self):
        """Testa inferencia de status desconhecido"""
        status = self.scraper._inferir_status("Texto aleatorio")
        self.assertEqual(status, StatusProcesso.DESCONHECIDO)

    def test_verify_login_success_com_indicador(self):
        """Testa verificacao de login com indicador de sucesso"""
        # Mock response
        response = MagicMock()
        response.text = "Bem-vindo ao sistema. Meu Painel."
        response.cookies = {}
        response.url = "http://example.com/painel"

        resultado = self.scraper._verify_login_success(response)
        self.assertTrue(resultado)

    def test_verify_login_failure_com_indicador(self):
        """Testa verificacao de login com indicador de falha"""
        response = MagicMock()
        response.text = "Usuario ou senha invalidos"
        response.cookies = {}
        response.url = "http://example.com/login"

        resultado = self.scraper._verify_login_success(response)
        self.assertFalse(resultado)

    def test_extrair_dados_processo_basico(self):
        """Testa extracao de dados de HTML basico"""
        html = """
        <html>
            <body>
                <div id="comarca">Goiania</div>
                <div id="vara">1a Vara Civel</div>
                <div class="classe">Procedimento Comum</div>
                <span class="valor_causa">R$ 50.000,00</span>
            </body>
        </html>
        """

        dados = self.scraper._extrair_dados_processo(html, "0123456-78.2024.8.09.0001")

        self.assertEqual(dados.numero_processo, "0123456-78.2024.8.09.0001")

    def test_detectar_segredo_justica_verdadeiro(self):
        """Testa deteccao de segredo de justica"""
        from bs4 import BeautifulSoup

        html = "<html><body>Este processo tramita em segredo de justica</body></html>"
        soup = BeautifulSoup(html, 'html.parser')

        resultado = self.scraper._detectar_segredo_justica(soup)
        self.assertTrue(resultado)

    def test_detectar_segredo_justica_falso(self):
        """Testa deteccao sem segredo de justica"""
        from bs4 import BeautifulSoup

        html = "<html><body>Processo publico normal</body></html>"
        soup = BeautifulSoup(html, 'html.parser')

        resultado = self.scraper._detectar_segredo_justica(soup)
        self.assertFalse(resultado)

    def test_extrair_advogados(self):
        """Testa extracao de advogados de texto"""
        texto = "Dr. Joao Silva (OAB/GO 12345) e Dra. Maria Santos OAB SP 67890"

        advogados = self.scraper._extrair_advogados(texto)

        self.assertEqual(len(advogados), 2)
        self.assertEqual(advogados[0].nome, "Dr. Joao Silva")
        self.assertEqual(advogados[0].oab_estado, "GO")
        self.assertEqual(advogados[0].oab_numero, "12345")


class TestProjudiScraperAsync(unittest.IsolatedAsyncioTestCase):
    """Testes asincronos para ProjudiScraper"""

    async def asyncSetUp(self):
        """Setup assincrono"""
        self.scraper = ProjudiScraper()

    async def asyncTearDown(self):
        """Teardown assincrono"""
        await self.scraper._close_client()

    async def test_get_client(self):
        """Testa obtencao de cliente HTTP"""
        client = await self.scraper._get_client()
        self.assertIsNotNone(client)
        self.assertFalse(client.is_closed)

    async def test_close_client(self):
        """Testa fechamento de cliente"""
        await self.scraper._get_client()
        await self.scraper._close_client()
        self.assertIsNone(self.scraper._client)

    async def test_context_manager(self):
        """Testa uso como context manager"""
        async with ProjudiScraper() as scraper:
            client = await scraper._get_client()
            self.assertIsNotNone(client)

    @patch('httpx.AsyncClient.get')
    async def test_rate_limiting(self, mock_get):
        """Testa rate limiting"""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.text = ""
        mock_get.return_value = mock_response

        # Duas requisicoes rapidas
        import time
        start = time.time()

        await self.scraper._enforce_rate_limit()
        await self.scraper._enforce_rate_limit()

        elapsed = time.time() - start
        # Deve ter esperado pelo menos rate_limit segundos
        self.assertGreaterEqual(elapsed, self.scraper.rate_limit * 0.9)


class TestIntegracaoMock(unittest.IsolatedAsyncioTestCase):
    """Testes de integracao com mocks"""

    async def asyncSetUp(self):
        """Setup"""
        self.scraper = ProjudiScraper()

    async def asyncTearDown(self):
        """Teardown"""
        await self.scraper._close_client()

    @patch('httpx.AsyncClient.post')
    async def test_login_mock(self, mock_post):
        """Testa fluxo de login com mock"""
        # Mock da resposta de login
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.text = "Bem-vindo ao sistema. Painel do usuario."
        mock_response.cookies = {'JSESSIONID': 'abc123'}
        mock_response.url = "https://projudi.tjgo.jus.br/Principal"

        mock_post.return_value = mock_response

        # Precisa do GET inicial tambem
        with patch('httpx.AsyncClient.get') as mock_get:
            mock_get_response = MagicMock()
            mock_get_response.status_code = 200
            mock_get_response.text = "<html><form><input name='Usuario'/></form></html>"
            mock_get_response.url = "https://projudi.tjgo.jus.br"
            mock_get_response.cookies = {}
            mock_get.return_value = mock_get_response

            result = await self.scraper.login("12345678900", "senha123")

            self.assertTrue(result)
            self.assertTrue(self.scraper._is_authenticated)

    @patch('httpx.AsyncClient.post')
    async def test_busca_processo_mock(self, mock_post):
        """Testa busca de processo com mock"""
        html_processo = """
        <html>
            <body>
                <div id="comarca">Goiania</div>
                <div id="vara">1a Vara Civel</div>
                <div class="classe">Procedimento Comum</div>
                <span class="valor_causa">R$ 50.000,00</span>
                <table class="movimentacoes">
                    <tr><td>15/01/2024</td><td>Distribuicao do processo</td></tr>
                </table>
            </body>
        </html>
        """

        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.text = html_processo
        mock_response.url = "https://projudi.tjgo.jus.br/BuscaProcesso"

        mock_post.return_value = mock_response

        processo = await self.scraper.buscar_processo("0123456-78.2024.8.09.0001")

        self.assertIsNotNone(processo)
        self.assertEqual(processo.numero_processo, "0123456-78.2024.8.09.0001")


def run_tests():
    """Executa todos os testes"""
    loader = unittest.TestLoader()
    suite = unittest.TestSuite()

    # Adiciona todos os testes
    suite.addTests(loader.loadTestsFromTestCase(TestNormalizarNumeroProcesso))
    suite.addTests(loader.loadTestsFromTestCase(TestExtrairNumeroProcesso))
    suite.addTests(loader.loadTestsFromTestCase(TestParseValorMonetario))
    suite.addTests(loader.loadTestsFromTestCase(TestParseDataBrasileira))
    suite.addTests(loader.loadTestsFromTestCase(TestGerarNomeArquivo))
    suite.addTests(loader.loadTestsFromTestCase(TestStatusProcesso))
    suite.addTests(loader.loadTestsFromTestCase(TestDadosProcesso))
    suite.addTests(loader.loadTestsFromTestCase(TestParte))
    suite.addTests(loader.loadTestsFromTestCase(TestAdvogado))
    suite.addTests(loader.loadTestsFromTestCase(TestSessionCache))
    suite.addTests(loader.loadTestsFromTestCase(TestProxyManager))
    suite.addTests(loader.loadTestsFromTestCase(TestProjudiLogger))
    suite.addTests(loader.loadTestsFromTestCase(TestExcecoes))
    suite.addTests(loader.loadTestsFromTestCase(TestProjudiScraperUnit))
    suite.addTests(loader.loadTestsFromTestCase(TestProjudiScraperAsync))
    suite.addTests(loader.loadTestsFromTestCase(TestIntegracaoMock))

    # Executa
    runner = unittest.TextTestRunner(verbosity=2)
    result = runner.run(suite)

    return result.wasSuccessful()


if __name__ == '__main__':
    success = run_tests()
    sys.exit(0 if success else 1)
