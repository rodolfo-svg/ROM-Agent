#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Testes Unitarios e de Integracao para PJe Scraper

Este modulo contem:
- Testes unitarios de validacao e parsing
- Testes de dataclasses e serializacao
- Testes de componentes (cache, rate limiter, circuit breaker)
- Testes de integracao (com mock)
- Testes de tratamento de erros
- Testes de deteccao de TRF
- Testes de performance

Total: 50+ testes cobrindo todos os metodos principais

Autor: ROM-Agent Integration System
Data: 2026-01-12
"""

import json
import os
import sys
import tempfile
import time
import unittest
from datetime import datetime, timezone
from pathlib import Path
from unittest.mock import Mock, patch, MagicMock

# Adiciona diretorio pai ao path
sys.path.insert(0, str(Path(__file__).parent.parent))

from pje_scraper import (
    # Classes principais
    PJeScraper,
    ProcessoPJe,
    Parte,
    Movimentacao,
    Documento,
    Intimacao,
    Advogado,

    # Componentes
    CacheManager,
    LogManager,
    RateLimiter,
    CircuitBreaker,
    CertificateManager,

    # Excecoes
    PJeError,
    PJeConnectionError,
    PJeAuthenticationError,
    PJeCertificateError,
    PJeProcessoNaoEncontrado,
    PJeSegredoJustica,
    PJeRateLimitError,
    PJeValidationError,
    PJeCircuitBreakerOpenError,

    # Enums
    TRF,
    Instancia,
    TipoParte,
    TipoIntimacao,
    StatusIntimacao,
    TipoDocumento,
    CircuitBreakerState,

    # Utilitarios
    validar_numero_cnj,
    validar_cpf,
    validar_cnpj,
    validar_oab,
    formatar_numero_cnj,
    formatar_cpf,
    formatar_cnpj,
    extrair_componentes_cnj,
    parsear_valor_monetario,
    parsear_data,
    parsear_datetime,
    normalizar_texto,
    limpar_html,
    calcular_hash_arquivo,
    gerar_hash_cache,

    # Constantes
    TRF_URLS,
    TRIBUNAL_CODES,
    TRF_ESTADOS,

    # Funcoes async
    extrair_processo_pje,
    extrair_processo_pje_sync,
)


# =============================================================================
# HTML MOCK PARA TESTES
# =============================================================================

MOCK_HTML_PROCESSO = """
<!DOCTYPE html>
<html>
<head><title>PJe - Consulta Publica</title></head>
<body>
    <div id="numeroProcesso">0000001-23.2024.4.01.3400</div>

    <table id="dadosProcesso">
        <tr>
            <td><span>Classe</span></td>
            <td><span id="classe">Procedimento Comum</span></td>
        </tr>
        <tr>
            <td><span>Assunto</span></td>
            <td><span id="assunto">Contribuicoes Sociais</span></td>
        </tr>
        <tr>
            <td><span>Orgao Julgador</span></td>
            <td><span id="orgaoJulgador">1a Vara Federal de Brasilia</span></td>
        </tr>
        <tr>
            <td><span>Data Distribuicao</span></td>
            <td><span id="dataDistribuicao">15/01/2024</span></td>
        </tr>
        <tr>
            <td><span>Valor da Causa</span></td>
            <td><span id="valorCausa">R$ 50.000,00</span></td>
        </tr>
    </table>

    <table id="partes">
        <tr>
            <td>Autor</td>
            <td>
                Empresa XYZ Ltda - CNPJ: 00.000.000/0001-00
                <br/>Advogado: Dr. Advogado Teste (OAB/DF 12345)
            </td>
        </tr>
        <tr>
            <td>Reu</td>
            <td>
                Uniao Federal
                <br/>Procurador: Procurador da Fazenda
            </td>
        </tr>
    </table>

    <table id="movimentacoes">
        <tr>
            <td>15/01/2024 14:30:00</td>
            <td>Distribuido por sorteio</td>
        </tr>
        <tr>
            <td>16/01/2024 09:15:00</td>
            <td>Peticao inicial recebida</td>
        </tr>
        <tr>
            <td>20/01/2024 11:00:00</td>
            <td>
                Despacho proferido
                <a href="/pje/Processo/documento.seam?idDoc=12345">Ver documento</a>
            </td>
        </tr>
    </table>

    <div id="documentos">
        <a href="/pje/Processo/documento.seam?idDoc=100">Peticao Inicial</a>
        <a href="/pje/Processo/documento.seam?idDoc=101">Procuracao</a>
    </div>
</body>
</html>
"""

MOCK_HTML_SEGREDO_JUSTICA = """
<!DOCTYPE html>
<html>
<head><title>PJe - Acesso Restrito</title></head>
<body>
    <div class="aviso">
        Este processo tramita em segredo de justica.
        Acesso restrito aos advogados das partes.
    </div>
</body>
</html>
"""

MOCK_HTML_NAO_ENCONTRADO = """
<!DOCTYPE html>
<html>
<head><title>PJe - Consulta</title></head>
<body>
    <div class="mensagem">
        Nenhum processo encontrado com os criterios informados.
    </div>
</body>
</html>
"""

MOCK_HTML_INTIMACOES = """
<!DOCTYPE html>
<html>
<head><title>PJe - Intimacoes</title></head>
<body>
    <table id="intimacoes">
        <tr><th>Tipo</th><th>Data</th><th>Descricao</th></tr>
        <tr>
            <td>Vista</td>
            <td>15/01/2024</td>
            <td>Prazo de 15 dias para manifestacao</td>
        </tr>
        <tr>
            <td>Intimacao</td>
            <td>20/01/2024</td>
            <td>Intimacao para audiencia</td>
        </tr>
    </table>
</body>
</html>
"""

MOCK_HTML_LISTA_PROCESSOS = """
<!DOCTYPE html>
<html>
<head><title>PJe - Resultados</title></head>
<body>
    <div id="resultados">
        <a href="/processo?numero=0000001-23.2024.4.01.3400">0000001-23.2024.4.01.3400</a>
        <a href="/processo?numero=0000002-45.2024.4.01.3400">0000002-45.2024.4.01.3400</a>
        <a href="/processo?numero=0000003-67.2024.4.01.3400">0000003-67.2024.4.01.3400</a>
    </div>
</body>
</html>
"""


# =============================================================================
# TESTES UNITARIOS - VALIDACAO DE NUMEROS
# =============================================================================

class TestValidacaoNumeros(unittest.TestCase):
    """Testes de validacao de numeros de processo, CPF, CNPJ e OAB"""

    def test_validar_numero_cnj_valido_formatado(self):
        """Testa validacao de numero CNJ formatado"""
        numeros_validos = [
            "0000001-23.2024.4.01.3400",
            "1234567-89.2023.4.03.6100",
            "9999999-99.2022.4.05.8100",
        ]
        for numero in numeros_validos:
            self.assertTrue(
                validar_numero_cnj(numero),
                f"Numero deveria ser valido: {numero}"
            )

    def test_validar_numero_cnj_valido_sem_formatacao(self):
        """Testa validacao de numero CNJ sem formatacao"""
        numeros_validos = [
            "00000012320244013400",
            "12345678920234036100",
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
            "0000001-23.2024.4.01",  # incompleto
            "abc",
            "",
            "00000012320244013400123",  # muito longo
            "0000001-23.2024.4.01.34001",  # muito longo
        ]
        for numero in numeros_invalidos:
            self.assertFalse(
                validar_numero_cnj(numero),
                f"Numero deveria ser invalido: {numero}"
            )

    def test_formatar_numero_cnj(self):
        """Testa formatacao de numero CNJ"""
        # Numero sem formatacao
        numero = "00000012320244013400"
        formatado = formatar_numero_cnj(numero)
        self.assertEqual(formatado, "0000001-23.2024.4.01.3400")

        # Numero ja formatado (deve manter)
        numero = "0000001-23.2024.4.01.3400"
        formatado = formatar_numero_cnj(numero)
        self.assertEqual(formatado, "0000001-23.2024.4.01.3400")

    def test_extrair_componentes_cnj(self):
        """Testa extracao de componentes do numero CNJ"""
        componentes = extrair_componentes_cnj("0000001-23.2024.4.01.3400")

        self.assertEqual(componentes["numero_sequencial"], "0000001")
        self.assertEqual(componentes["digito_verificador"], "23")
        self.assertEqual(componentes["ano"], "2024")
        self.assertEqual(componentes["segmento_justica"], "4")
        self.assertEqual(componentes["tribunal"], "01")
        self.assertEqual(componentes["origem"], "3400")

    def test_extrair_componentes_cnj_invalido(self):
        """Testa extracao com numero invalido"""
        with self.assertRaises(PJeValidationError):
            extrair_componentes_cnj("123456")

    def test_validar_cpf_valido(self):
        """Testa validacao de CPF valido"""
        cpfs_validos = [
            "529.982.247-25",
            "52998224725",
            "147.855.050-36",
        ]
        for cpf in cpfs_validos:
            self.assertTrue(validar_cpf(cpf), f"CPF deveria ser valido: {cpf}")

    def test_validar_cpf_invalido(self):
        """Testa validacao de CPF invalido"""
        cpfs_invalidos = [
            "111.111.111-11",  # todos iguais
            "123.456.789-00",  # digitos invalidos
            "123456",  # muito curto
            "",
            "00000000000",  # todos zeros
        ]
        for cpf in cpfs_invalidos:
            self.assertFalse(validar_cpf(cpf), f"CPF deveria ser invalido: {cpf}")

    def test_formatar_cpf(self):
        """Testa formatacao de CPF"""
        cpf = "52998224725"
        formatado = formatar_cpf(cpf)
        self.assertEqual(formatado, "529.982.247-25")

    def test_validar_cnpj_valido(self):
        """Testa validacao de CNPJ valido"""
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
            self.assertFalse(validar_cnpj(cnpj), f"CNPJ deveria ser invalido: {cnpj}")

    def test_formatar_cnpj(self):
        """Testa formatacao de CNPJ"""
        cnpj = "11222333000181"
        formatado = formatar_cnpj(cnpj)
        self.assertEqual(formatado, "11.222.333/0001-81")

    def test_validar_oab(self):
        """Testa validacao de OAB"""
        oabs_validas = [
            "OAB/SP 123456",
            "OAB/DF 12345",
            "OAB SP 99999",
        ]
        for oab in oabs_validas:
            self.assertTrue(validar_oab(oab), f"OAB deveria ser valida: {oab}")


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
            ("R$ 50.000,00", 50000.0),
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
                f"Parsing de '{texto}' deveria ser {esperado}"
            )

    def test_parsear_datetime(self):
        """Testa parsing de datetime"""
        # Com hora
        data, hora = parsear_datetime("15/01/2024 14:30:00")
        self.assertEqual(data, "2024-01-15")
        self.assertEqual(hora, "14:30:00")

        # Sem hora
        data, hora = parsear_datetime("15/01/2024")
        self.assertEqual(data, "2024-01-15")
        self.assertIsNone(hora)

        # Vazio
        data, hora = parsear_datetime("")
        self.assertIsNone(data)
        self.assertIsNone(hora)

    def test_normalizar_texto(self):
        """Testa normalizacao de texto"""
        casos = [
            ("Joao da Silva", "Joao da Silva"),
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

    def test_processo_pje_criacao(self):
        """Testa criacao de ProcessoPJe"""
        processo = ProcessoPJe(
            numero_processo="0000001-23.2024.4.01.3400",
            tribunal="TRF1",
            instancia="1"
        )

        self.assertEqual(processo.numero_processo, "0000001-23.2024.4.01.3400")
        self.assertEqual(processo.tribunal, "TRF1")
        self.assertEqual(processo.sistema, "PJe")
        self.assertEqual(processo.instancia, "1")
        self.assertFalse(processo.segredo_justica)
        self.assertIsNotNone(processo.timestamp_extracao)

    def test_processo_pje_to_dict(self):
        """Testa conversao para dicionario"""
        processo = ProcessoPJe(
            numero_processo="0000001-23.2024.4.01.3400",
            tribunal="TRF1",
            classe="Procedimento Comum",
            valor_causa=50000.0
        )

        dados = processo.to_dict()

        self.assertIsInstance(dados, dict)
        self.assertEqual(dados["numero_processo"], "0000001-23.2024.4.01.3400")
        self.assertEqual(dados["tribunal"], "TRF1")
        self.assertEqual(dados["classe"], "Procedimento Comum")
        self.assertEqual(dados["valor_causa"], 50000.0)

    def test_processo_pje_to_json(self):
        """Testa conversao para JSON"""
        processo = ProcessoPJe(
            numero_processo="0000001-23.2024.4.01.3400"
        )

        json_str = processo.to_json()

        self.assertIsInstance(json_str, str)
        dados = json.loads(json_str)
        self.assertEqual(dados["numero_processo"], "0000001-23.2024.4.01.3400")

    def test_processo_pje_numero_formatado(self):
        """Testa propriedade numero_formatado"""
        processo = ProcessoPJe(
            numero_processo="00000012320244013400"
        )

        self.assertEqual(processo.numero_formatado, "0000001-23.2024.4.01.3400")

    def test_parte_to_dict(self):
        """Testa conversao de Parte para dict"""
        parte = Parte(
            tipo="autor",
            nome="Empresa XYZ Ltda",
            documento="00.000.000/0001-00",
            tipo_documento="CNPJ",
            advogados=[{"nome": "Dr. Advogado", "oab_numero": "12345", "oab_estado": "DF"}]
        )

        dados = parte.to_dict()

        self.assertEqual(dados["tipo"], "autor")
        self.assertEqual(dados["nome"], "Empresa XYZ Ltda")
        self.assertEqual(dados["documento"], "00.000.000/0001-00")
        self.assertEqual(len(dados["advogados"]), 1)

    def test_movimentacao_to_dict(self):
        """Testa conversao de Movimentacao para dict"""
        mov = Movimentacao(
            data="2024-01-15",
            hora="14:30:00",
            descricao="Distribuido por sorteio",
            responsavel="Sistema"
        )

        dados = mov.to_dict()

        self.assertEqual(dados["data"], "2024-01-15")
        self.assertEqual(dados["hora"], "14:30:00")
        self.assertEqual(dados["descricao"], "Distribuido por sorteio")

    def test_documento_to_dict(self):
        """Testa conversao de Documento para dict"""
        doc = Documento(
            id="12345",
            tipo="peticao_inicial",
            nome="Peticao Inicial",
            url="/pje/documento.seam?idDoc=12345"
        )

        dados = doc.to_dict()

        self.assertEqual(dados["id"], "12345")
        self.assertEqual(dados["tipo"], "peticao_inicial")
        self.assertEqual(dados["nome"], "Peticao Inicial")

    def test_intimacao_to_dict(self):
        """Testa conversao de Intimacao para dict"""
        intimacao = Intimacao(
            tipo="vista",
            status="pendente",
            prazo_dias=15,
            descricao="Prazo para manifestacao"
        )

        dados = intimacao.to_dict()

        self.assertEqual(dados["tipo"], "vista")
        self.assertEqual(dados["status"], "pendente")
        self.assertEqual(dados["prazo_dias"], 15)

    def test_advogado_to_dict(self):
        """Testa conversao de Advogado para dict"""
        adv = Advogado(
            nome="Dr. Advogado Teste",
            oab_numero="12345",
            oab_estado="DF"
        )

        dados = adv.to_dict()

        self.assertEqual(dados["nome"], "Dr. Advogado Teste")
        self.assertEqual(dados["oab_numero"], "12345")
        self.assertEqual(dados["oab_estado"], "DF")

    def test_advogado_str(self):
        """Testa representacao string de Advogado"""
        adv = Advogado(
            nome="Dr. Advogado",
            oab_numero="12345",
            oab_estado="DF"
        )

        self.assertEqual(str(adv), "Dr. Advogado (OAB/DF 12345)")


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
            ttl_consulta=60,
            ttl_session=3600,
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

    def test_cache_session_set_get(self):
        """Testa cache de sessao"""
        session_data = {
            "cookies": {"session_id": "abc123"},
            "authenticated": True
        }

        self.cache.set_session("TRF1", session_data)
        resultado = self.cache.get_session("TRF1")

        self.assertEqual(resultado, session_data)

    def test_cache_session_invalidate(self):
        """Testa invalidacao de sessao"""
        self.cache.set_session("TRF1", {"test": True})
        self.cache.invalidate_session("TRF1")

        resultado = self.cache.get_session("TRF1")
        self.assertIsNone(resultado)

    def test_cache_ttl_expirado(self):
        """Testa expiracao de cache por TTL"""
        cache_curto = CacheManager(
            cache_dir=self.temp_dir,
            ttl_consulta=1,  # 1 segundo
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

    def test_backoff_exponencial(self):
        """Testa backoff exponencial em erro"""
        limiter = RateLimiter(rate=0.1, backoff_base=2)

        # Primeiro erro: 2^1 = 2 segundos
        wait1 = limiter.error()
        self.assertEqual(wait1, 2)

        # Segundo erro: 2^2 = 4 segundos
        wait2 = limiter.error()
        self.assertEqual(wait2, 4)

        # Terceiro erro: 2^3 = 8 segundos
        wait3 = limiter.error()
        self.assertEqual(wait3, 8)

    def test_reset_backoff_em_sucesso(self):
        """Testa reset do backoff em sucesso"""
        limiter = RateLimiter(rate=0.1, backoff_base=2)

        limiter.error()
        limiter.error()
        limiter.success()

        self.assertEqual(limiter._current_backoff, 0.1)
        self.assertEqual(limiter.consecutive_errors, 0)

    def test_contador_requisicoes(self):
        """Testa contador de requisicoes"""
        limiter = RateLimiter(rate=0.01)  # 10ms

        limiter.wait()
        limiter.wait()
        limiter.wait()

        self.assertEqual(limiter.request_count, 3)

    def test_contador_erros(self):
        """Testa contador de erros"""
        limiter = RateLimiter(rate=0.1)

        limiter.error()
        limiter.error()
        limiter.success()
        limiter.error()

        self.assertEqual(limiter.error_count, 3)


# =============================================================================
# TESTES UNITARIOS - CIRCUIT BREAKER
# =============================================================================

class TestCircuitBreaker(unittest.TestCase):
    """Testes do circuit breaker"""

    def test_circuit_breaker_inicial_fechado(self):
        """Testa estado inicial fechado"""
        cb = CircuitBreaker(threshold=3, timeout=60)

        self.assertEqual(cb.state, CircuitBreakerState.CLOSED)
        self.assertTrue(cb.allow_request())

    def test_circuit_breaker_abre_apos_threshold(self):
        """Testa abertura apos threshold de erros"""
        cb = CircuitBreaker(threshold=3, timeout=60)

        cb.record_failure()
        cb.record_failure()
        self.assertEqual(cb.state, CircuitBreakerState.CLOSED)

        cb.record_failure()  # Terceira falha
        self.assertEqual(cb.state, CircuitBreakerState.OPEN)
        self.assertFalse(cb.allow_request())

    def test_circuit_breaker_reset_em_sucesso(self):
        """Testa reset do contador em sucesso"""
        cb = CircuitBreaker(threshold=3, timeout=60)

        cb.record_failure()
        cb.record_failure()
        cb.record_success()

        self.assertEqual(cb.state, CircuitBreakerState.CLOSED)
        self.assertEqual(cb._failure_count, 0)

    def test_circuit_breaker_half_open_apos_timeout(self):
        """Testa transicao para half-open apos timeout"""
        cb = CircuitBreaker(threshold=2, timeout=1)  # 1 segundo timeout

        cb.record_failure()
        cb.record_failure()
        self.assertEqual(cb.state, CircuitBreakerState.OPEN)

        time.sleep(1.5)  # Espera timeout

        self.assertEqual(cb.state, CircuitBreakerState.HALF_OPEN)
        self.assertTrue(cb.allow_request())

    def test_circuit_breaker_reset_manual(self):
        """Testa reset manual"""
        cb = CircuitBreaker(threshold=2, timeout=60)

        cb.record_failure()
        cb.record_failure()
        self.assertEqual(cb.state, CircuitBreakerState.OPEN)

        cb.reset()

        self.assertEqual(cb.state, CircuitBreakerState.CLOSED)
        self.assertEqual(cb._failure_count, 0)


# =============================================================================
# TESTES UNITARIOS - DETECCAO DE TRF
# =============================================================================

class TestDeteccaoTRF(unittest.TestCase):
    """Testes de deteccao de TRF pelo numero do processo"""

    def setUp(self):
        """Prepara ambiente de teste"""
        self.temp_dir = tempfile.mkdtemp()
        self.scraper = PJeScraper(
            cache_dir=f"{self.temp_dir}/cache",
            log_dir=f"{self.temp_dir}/logs",
            cache_enabled=False
        )

    def tearDown(self):
        """Limpa ambiente de teste"""
        import shutil
        shutil.rmtree(self.temp_dir, ignore_errors=True)

    def test_detectar_trf1(self):
        """Testa deteccao de TRF1"""
        numero = "0000001-23.2024.4.01.3400"
        trf = self.scraper.detectar_trf(numero)
        self.assertEqual(trf, "TRF1")

    def test_detectar_trf2(self):
        """Testa deteccao de TRF2"""
        numero = "0000001-23.2024.4.02.5100"
        trf = self.scraper.detectar_trf(numero)
        self.assertEqual(trf, "TRF2")

    def test_detectar_trf3(self):
        """Testa deteccao de TRF3"""
        numero = "0000001-23.2024.4.03.6100"
        trf = self.scraper.detectar_trf(numero)
        self.assertEqual(trf, "TRF3")

    def test_detectar_trf4(self):
        """Testa deteccao de TRF4"""
        numero = "0000001-23.2024.4.04.7000"
        trf = self.scraper.detectar_trf(numero)
        self.assertEqual(trf, "TRF4")

    def test_detectar_trf5(self):
        """Testa deteccao de TRF5"""
        numero = "0000001-23.2024.4.05.8100"
        trf = self.scraper.detectar_trf(numero)
        self.assertEqual(trf, "TRF5")

    def test_detectar_trf_numero_invalido(self):
        """Testa erro com numero invalido"""
        with self.assertRaises(PJeValidationError):
            self.scraper.detectar_trf("123456")

    def test_detectar_trf_nao_federal(self):
        """Testa erro para processo nao federal"""
        # Segmento 8 = Justica Estadual
        numero = "0000001-23.2024.8.26.0100"
        with self.assertRaises(PJeValidationError):
            self.scraper.detectar_trf(numero)


# =============================================================================
# TESTES DE INTEGRACAO (COM MOCK)
# =============================================================================

class TestPJeScraperMock(unittest.TestCase):
    """Testes de integracao com respostas mockadas"""

    def setUp(self):
        """Prepara ambiente de teste"""
        self.temp_dir = tempfile.mkdtemp()

    def tearDown(self):
        """Limpa ambiente de teste"""
        import shutil
        shutil.rmtree(self.temp_dir, ignore_errors=True)

    @patch('pje_scraper.requests.Session')
    def test_extrair_processo_mock(self, mock_session):
        """Testa extracao de processo com mock"""
        # Configura mock
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.text = MOCK_HTML_PROCESSO
        mock_response.url = "https://pje1g.trf1.jus.br/pje/ConsultaPublica"
        mock_response.content = b"PDF content"
        mock_response.headers = {"content-type": "text/html"}

        mock_session_instance = Mock()
        mock_session_instance.get.return_value = mock_response
        mock_session_instance.post.return_value = mock_response
        mock_session_instance.headers = {}
        mock_session_instance.cookies = Mock()
        mock_session_instance.cookies.set = Mock()
        mock_session.return_value = mock_session_instance

        # Executa
        scraper = PJeScraper(
            cache_dir=f"{self.temp_dir}/cache",
            log_dir=f"{self.temp_dir}/logs",
            cache_enabled=False
        )

        # Testa metodos de extracao com HTML mockado
        from bs4 import BeautifulSoup
        soup = BeautifulSoup(MOCK_HTML_PROCESSO, 'html.parser')

        # Testa extracao de partes
        partes = scraper._extrair_partes(soup)
        self.assertIsInstance(partes, list)

        # Testa extracao de movimentacoes
        movs = scraper._extrair_movimentacoes(soup)
        self.assertIsInstance(movs, list)

        # Testa extracao de documentos
        docs = scraper._extrair_documentos(soup)
        self.assertIsInstance(docs, list)

    def test_detectar_segredo_justica(self):
        """Testa deteccao de segredo de justica"""
        scraper = PJeScraper(
            cache_dir=f"{self.temp_dir}/cache",
            log_dir=f"{self.temp_dir}/logs",
            cache_enabled=False
        )

        # Com segredo de justica
        self.assertTrue(
            scraper._detectar_segredo_justica(MOCK_HTML_SEGREDO_JUSTICA)
        )

        # Sem segredo de justica
        self.assertFalse(
            scraper._detectar_segredo_justica(MOCK_HTML_PROCESSO)
        )

    def test_processo_nao_encontrado(self):
        """Testa deteccao de processo nao encontrado"""
        scraper = PJeScraper(
            cache_dir=f"{self.temp_dir}/cache",
            log_dir=f"{self.temp_dir}/logs",
            cache_enabled=False
        )

        self.assertTrue(
            scraper._processo_nao_encontrado(MOCK_HTML_NAO_ENCONTRADO)
        )

        self.assertFalse(
            scraper._processo_nao_encontrado(MOCK_HTML_PROCESSO)
        )

    def test_extrair_lista_processos(self):
        """Testa extracao de lista de processos"""
        scraper = PJeScraper(
            cache_dir=f"{self.temp_dir}/cache",
            log_dir=f"{self.temp_dir}/logs",
            cache_enabled=False
        )

        processos = scraper._extrair_lista_processos(MOCK_HTML_LISTA_PROCESSOS, "TRF1")

        self.assertIsInstance(processos, list)
        self.assertGreater(len(processos), 0)

    def test_extrair_intimacoes(self):
        """Testa extracao de intimacoes"""
        scraper = PJeScraper(
            cache_dir=f"{self.temp_dir}/cache",
            log_dir=f"{self.temp_dir}/logs",
            cache_enabled=False
        )

        intimacoes = scraper._extrair_intimacoes_html(MOCK_HTML_INTIMACOES)

        self.assertIsInstance(intimacoes, list)
        self.assertGreater(len(intimacoes), 0)

        # Verifica primeira intimacao
        primeira = intimacoes[0]
        self.assertIn("tipo", primeira)
        self.assertIn("descricao", primeira)


# =============================================================================
# TESTES DE EXCECOES
# =============================================================================

class TestExcecoes(unittest.TestCase):
    """Testes de tratamento de excecoes"""

    def test_pje_error(self):
        """Testa excecao base"""
        with self.assertRaises(PJeError):
            raise PJeError("Erro generico")

    def test_pje_connection_error(self):
        """Testa excecao de conexao"""
        with self.assertRaises(PJeConnectionError):
            raise PJeConnectionError("Falha de conexao")

    def test_pje_authentication_error(self):
        """Testa excecao de autenticacao"""
        with self.assertRaises(PJeAuthenticationError):
            raise PJeAuthenticationError("Falha no login")

    def test_pje_certificate_error(self):
        """Testa excecao de certificado"""
        with self.assertRaises(PJeCertificateError):
            raise PJeCertificateError("Certificado invalido")

    def test_pje_processo_nao_encontrado(self):
        """Testa excecao de processo nao encontrado"""
        with self.assertRaises(PJeProcessoNaoEncontrado):
            raise PJeProcessoNaoEncontrado("Processo X nao encontrado")

    def test_pje_segredo_justica(self):
        """Testa excecao de segredo de justica"""
        with self.assertRaises(PJeSegredoJustica):
            raise PJeSegredoJustica("Processo em sigilo")

    def test_pje_rate_limit_error(self):
        """Testa excecao de rate limit"""
        with self.assertRaises(PJeRateLimitError):
            raise PJeRateLimitError("Rate limit excedido")

    def test_pje_validation_error(self):
        """Testa excecao de validacao"""
        with self.assertRaises(PJeValidationError):
            raise PJeValidationError("Numero invalido")

    def test_pje_circuit_breaker_error(self):
        """Testa excecao de circuit breaker"""
        with self.assertRaises(PJeCircuitBreakerOpenError):
            raise PJeCircuitBreakerOpenError("Circuit breaker aberto")

    def test_heranca_excecoes(self):
        """Testa heranca de excecoes"""
        excecoes = [
            PJeConnectionError,
            PJeAuthenticationError,
            PJeCertificateError,
            PJeProcessoNaoEncontrado,
            PJeSegredoJustica,
            PJeRateLimitError,
            PJeValidationError,
            PJeCircuitBreakerOpenError,
        ]

        for exc_class in excecoes:
            self.assertTrue(issubclass(exc_class, PJeError))


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

        # Deve inserir 100 entradas em menos de 2 segundos
        self.assertLess(tempo_insercao, 2.0)

        # Recupera 100 entradas
        inicio = time.time()
        for i in range(100):
            cache.get(f"key_{i}")
        tempo_leitura = time.time() - inicio

        # Deve ler 100 entradas em menos de 1 segundo
        self.assertLess(tempo_leitura, 1.0)

        # Limpa
        import shutil
        shutil.rmtree(temp_dir, ignore_errors=True)

    def test_parsing_performance(self):
        """Testa performance de parsing"""
        from bs4 import BeautifulSoup

        # Gera HTML grande
        html_grande = MOCK_HTML_PROCESSO * 10

        inicio = time.time()
        soup = BeautifulSoup(html_grande, 'html.parser')
        tempo_parse = time.time() - inicio

        # Deve parsear em menos de 3 segundos
        self.assertLess(tempo_parse, 3.0)

    def test_hash_performance(self):
        """Testa performance de geracao de hash"""
        inicio = time.time()
        for i in range(1000):
            gerar_hash_cache(f"chave_teste_{i}")
        tempo = time.time() - inicio

        # Deve gerar 1000 hashes em menos de 0.5 segundo
        self.assertLess(tempo, 0.5)


# =============================================================================
# TESTES DE FORMATO DE SAIDA
# =============================================================================

class TestFormatoSaida(unittest.TestCase):
    """Testes do formato de saida esperado"""

    def test_formato_processo_completo(self):
        """Verifica formato completo de ProcessoPJe"""
        processo = ProcessoPJe(
            numero_processo="0000001-23.2024.4.01.3400",
            tribunal="TRF1",
            sistema="PJe",
            instancia="1",
            classe="Procedimento Comum",
            assunto="Contribuicoes Sociais",
            orgao_julgador="1a Vara Federal de Brasilia",
            vara="1a Vara Federal",
            data_distribuicao="2024-01-15",
            valor_causa=50000.0,
            partes=[
                {
                    "tipo": "autor",
                    "nome": "Empresa XYZ Ltda",
                    "documento": "00.000.000/0001-00",
                    "tipo_documento": "CNPJ",
                    "advogados": [{"nome": "Dr. Advogado", "oab_numero": "12345", "oab_estado": "DF"}]
                }
            ],
            movimentacoes=[
                {
                    "data": "2024-01-15",
                    "hora": "14:30:00",
                    "descricao": "Distribuido por sorteio"
                }
            ],
            documentos=[
                {
                    "id": "12345",
                    "tipo": "peticao_inicial",
                    "nome": "Peticao Inicial"
                }
            ],
            segredo_justica=False
        )

        dados = processo.to_dict()

        # Verifica campos obrigatorios
        self.assertEqual(dados["numero_processo"], "0000001-23.2024.4.01.3400")
        self.assertEqual(dados["tribunal"], "TRF1")
        self.assertEqual(dados["sistema"], "PJe")
        self.assertEqual(dados["instancia"], "1")
        self.assertFalse(dados["segredo_justica"])
        self.assertIsNotNone(dados["timestamp_extracao"])

        # Verifica estrutura de partes
        self.assertEqual(len(dados["partes"]), 1)
        self.assertEqual(dados["partes"][0]["tipo"], "autor")

        # Verifica estrutura de movimentacoes
        self.assertEqual(len(dados["movimentacoes"]), 1)
        self.assertIn("data", dados["movimentacoes"][0])

    def test_formato_json_serializavel(self):
        """Verifica que o formato e serializavel para JSON"""
        processo = ProcessoPJe(
            numero_processo="0000001-23.2024.4.01.3400",
            tribunal="TRF1",
            valor_causa=50000.0,
            partes=[{"tipo": "autor", "nome": "Teste"}],
            movimentacoes=[{"data": "2024-01-15", "descricao": "Teste"}],
        )

        # Deve ser serializavel sem erros
        json_str = json.dumps(processo.to_dict(), ensure_ascii=False)
        self.assertIsInstance(json_str, str)

        # Deve ser deserializavel
        dados = json.loads(json_str)
        self.assertEqual(dados["numero_processo"], "0000001-23.2024.4.01.3400")


# =============================================================================
# TESTES DE CONSTANTES E CONFIGURACOES
# =============================================================================

class TestConstantes(unittest.TestCase):
    """Testes das constantes e configuracoes"""

    def test_trf_urls_completo(self):
        """Verifica que todos os TRFs tem URL definida"""
        trfs_esperados = ["TRF1", "TRF2", "TRF3", "TRF4", "TRF5"]
        for trf in trfs_esperados:
            self.assertIn(trf, TRF_URLS)
            self.assertTrue(TRF_URLS[trf].startswith("https://"))

    def test_tribunal_codes_completo(self):
        """Verifica mapeamento de codigos de tribunal"""
        codigos_esperados = ["01", "02", "03", "04", "05"]
        for codigo in codigos_esperados:
            self.assertIn(codigo, TRIBUNAL_CODES)

    def test_trf_estados_completo(self):
        """Verifica que todos os TRFs tem estados definidos"""
        for trf in ["TRF1", "TRF2", "TRF3", "TRF4", "TRF5"]:
            self.assertIn(trf, TRF_ESTADOS)
            self.assertIsInstance(TRF_ESTADOS[trf], list)
            self.assertGreater(len(TRF_ESTADOS[trf]), 0)


# =============================================================================
# TESTES DE ENUMS
# =============================================================================

class TestEnums(unittest.TestCase):
    """Testes dos enums"""

    def test_trf_enum(self):
        """Testa enum TRF"""
        self.assertEqual(TRF.TRF1.value, "TRF1")
        self.assertEqual(TRF.TRF2.value, "TRF2")
        self.assertEqual(TRF.TRF3.value, "TRF3")
        self.assertEqual(TRF.TRF4.value, "TRF4")
        self.assertEqual(TRF.TRF5.value, "TRF5")

    def test_instancia_enum(self):
        """Testa enum Instancia"""
        self.assertEqual(Instancia.PRIMEIRO_GRAU.value, "1")
        self.assertEqual(Instancia.SEGUNDO_GRAU.value, "2")
        self.assertEqual(Instancia.TURMAS_RECURSAIS.value, "TR")

    def test_tipo_parte_enum(self):
        """Testa enum TipoParte"""
        self.assertEqual(TipoParte.AUTOR.value, "autor")
        self.assertEqual(TipoParte.REU.value, "reu")

    def test_tipo_intimacao_enum(self):
        """Testa enum TipoIntimacao"""
        self.assertEqual(TipoIntimacao.CARGA.value, "carga")
        self.assertEqual(TipoIntimacao.VISTA.value, "vista")

    def test_status_intimacao_enum(self):
        """Testa enum StatusIntimacao"""
        self.assertEqual(StatusIntimacao.PENDENTE.value, "pendente")
        self.assertEqual(StatusIntimacao.CIENCIA_EXPRESSA.value, "ciencia_expressa")

    def test_tipo_documento_enum(self):
        """Testa enum TipoDocumento"""
        self.assertEqual(TipoDocumento.PETICAO_INICIAL.value, "peticao_inicial")
        self.assertEqual(TipoDocumento.SENTENCA.value, "sentenca")

    def test_circuit_breaker_state_enum(self):
        """Testa enum CircuitBreakerState"""
        self.assertEqual(CircuitBreakerState.CLOSED.value, "closed")
        self.assertEqual(CircuitBreakerState.OPEN.value, "open")
        self.assertEqual(CircuitBreakerState.HALF_OPEN.value, "half_open")


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
    suite.addTests(loader.loadTestsFromTestCase(TestCircuitBreaker))
    suite.addTests(loader.loadTestsFromTestCase(TestDeteccaoTRF))
    suite.addTests(loader.loadTestsFromTestCase(TestPJeScraperMock))
    suite.addTests(loader.loadTestsFromTestCase(TestExcecoes))
    suite.addTests(loader.loadTestsFromTestCase(TestPerformance))
    suite.addTests(loader.loadTestsFromTestCase(TestFormatoSaida))
    suite.addTests(loader.loadTestsFromTestCase(TestConstantes))
    suite.addTests(loader.loadTestsFromTestCase(TestEnums))

    # Executa
    runner = unittest.TextTestRunner(verbosity=2)
    result = runner.run(suite)

    # Retorna codigo de saida
    return 0 if result.wasSuccessful() else 1


if __name__ == "__main__":
    sys.exit(run_tests())
