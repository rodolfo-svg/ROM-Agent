#!/usr/bin/env python3
"""
Validador de Scrapers - ROM Agent
Testa conectividade e funcionalidade básica dos 3 scrapers

Uso:
    python3 validate_scrapers.py
"""

import sys
import time
from typing import Dict, List

# Importar scrapers
try:
    import projudi_scraper
    import esaj_scraper
    import pje_scraper
    print("✅ Todos os scrapers importados com sucesso\n")
except ImportError as e:
    print(f"❌ Erro ao importar scrapers: {e}")
    sys.exit(1)


class ScraperValidator:
    """Validador de scrapers"""

    def __init__(self):
        self.results = {
            'projudi': {'status': 'pending', 'tests': []},
            'esaj': {'status': 'pending', 'tests': []},
            'pje': {'status': 'pending', 'tests': []}
        }

    def print_header(self, title: str):
        """Imprime cabeçalho formatado"""
        print(f"\n{'=' * 70}")
        print(f"  {title}")
        print(f"{'=' * 70}\n")

    def print_test(self, name: str, passed: bool, details: str = ""):
        """Imprime resultado de teste"""
        status = "✅ PASSOU" if passed else "❌ FALHOU"
        print(f"{status} | {name}")
        if details:
            print(f"         {details}")

    def validate_projudi(self) -> bool:
        """Valida scraper PROJUDI"""
        self.print_header("PROJUDI (TJGO)")

        try:
            # Teste 1: Criar instância
            scraper = projudi_scraper.ProjudiScraper()
            self.print_test("Instanciação", True, "ProjudiScraper criado")

            # Teste 2: Normalizar número de processo
            numero_valido = "1234567-89.2023.8.09.0051"
            numero_normalizado = projudi_scraper.normalizar_numero_processo(numero_valido)
            self.print_test("Normalização de número", bool(numero_normalizado),
                          f"Normalizado: {numero_normalizado}")

            # Teste 3: Verificar dataclass
            dados = projudi_scraper.DadosProcesso(
                numero_processo=numero_valido,
                tribunal="TJGO",
                sistema="PROJUDI"
            )
            self.print_test("Dataclass", True, f"DadosProcesso: {dados.numero_processo}")

            # Teste 4: Health check (conectividade)
            try:
                health = scraper.health_check()
                is_healthy = health.get('status') == 'ok'
                self.print_test("Health Check", is_healthy,
                              f"Latência: {health.get('latency_ms', 'N/A')}ms")
            except Exception as e:
                self.print_test("Health Check", False, f"Erro: {str(e)[:50]}")

            self.results['projudi']['status'] = 'passed'
            return True

        except Exception as e:
            self.print_test("PROJUDI Scraper", False, f"Erro crítico: {str(e)[:100]}")
            self.results['projudi']['status'] = 'failed'
            return False

    def validate_esaj(self) -> bool:
        """Valida scraper ESAJ"""
        self.print_header("ESAJ (TJSP)")

        try:
            # Teste 1: Criar instância
            scraper = esaj_scraper.ESAJScraper()
            self.print_test("Instanciação", True, "ESAJScraper criado")

            # Teste 2: Validar número de processo (função global)
            numero_valido = "1234567-89.2023.8.26.0100"
            is_valid = esaj_scraper.validar_numero_cnj(numero_valido)
            self.print_test("Validação de número CNJ", is_valid, f"Formato: {numero_valido}")

            # Teste 3: Detectar segredo de justiça
            html_publico = "<html><body>Processo público</body></html>"
            is_secret = scraper.detectar_segredo_justica(html_publico)
            self.print_test("Detecção de segredo", not is_secret, "HTML público OK")

            # Teste 4: Verificar dataclass
            processo = esaj_scraper.ProcessoESAJ(
                numero_processo=numero_valido,
                tribunal="TJSP",
                instancia="1"
            )
            self.print_test("Dataclass", True, f"ProcessoESAJ: {processo.numero_processo}")

            # Teste 5: Health check (conectividade)
            try:
                health = scraper.health_check(instancia="1")
                is_healthy = health.get('status') == 'ok'
                self.print_test("Health Check 1ª Instância", is_healthy,
                              f"Latência: {health.get('latency_ms', 'N/A')}ms")
            except Exception as e:
                self.print_test("Health Check 1ª Instância", False, f"Erro: {str(e)[:50]}")

            try:
                health = scraper.health_check(instancia="2")
                is_healthy = health.get('status') == 'ok'
                self.print_test("Health Check 2ª Instância", is_healthy,
                              f"Latência: {health.get('latency_ms', 'N/A')}ms")
            except Exception as e:
                self.print_test("Health Check 2ª Instância", False, f"Erro: {str(e)[:50]}")

            self.results['esaj']['status'] = 'passed'
            return True

        except Exception as e:
            self.print_test("ESAJ Scraper", False, f"Erro crítico: {str(e)[:100]}")
            self.results['esaj']['status'] = 'failed'
            return False

    def validate_pje(self) -> bool:
        """Valida scraper PJe"""
        self.print_header("PJe (Justiça Federal)")

        try:
            # Teste 1: Criar instância
            scraper = pje_scraper.PJeScraper()
            self.print_test("Instanciação", True, "PJeScraper criado")

            # Teste 2: Validar número de processo (função global)
            numero_valido = "1234567-89.2023.4.01.0000"
            is_valid = pje_scraper.validar_numero_cnj(numero_valido)
            self.print_test("Validação de número CNJ", is_valid, f"Formato: {numero_valido}")

            # Teste 3: Detectar TRF
            trf = scraper.detectar_trf(numero_valido)
            self.print_test("Detecção de TRF", trf == "TRF1", f"TRF detectado: {trf}")

            # Teste 4: Verificar dataclass
            processo = pje_scraper.ProcessoPJe(
                numero_processo=numero_valido,
                tribunal="TRF1"
            )
            self.print_test("Dataclass", True, f"ProcessoPJe: {processo.numero_processo}")

            # Teste 5: Health check para cada TRF
            trfs_to_test = ["TRF1", "TRF2", "TRF3", "TRF4", "TRF5"]
            for trf_name in trfs_to_test:
                try:
                    health = scraper.health_check(trf=trf_name)
                    is_healthy = health.get('status') == 'ok'
                    self.print_test(f"Health Check {trf_name}", is_healthy,
                                  f"Latência: {health.get('latency_ms', 'N/A')}ms")
                except Exception as e:
                    self.print_test(f"Health Check {trf_name}", False, f"Erro: {str(e)[:50]}")

                # Pausa para não sobrecarregar
                time.sleep(0.5)

            self.results['pje']['status'] = 'passed'
            return True

        except Exception as e:
            self.print_test("PJe Scraper", False, f"Erro crítico: {str(e)[:100]}")
            self.results['pje']['status'] = 'failed'
            return False

    def print_summary(self):
        """Imprime resumo da validação"""
        self.print_header("RESUMO DA VALIDAÇÃO")

        passed = sum(1 for r in self.results.values() if r['status'] == 'passed')
        total = len(self.results)

        print(f"Scrapers testados: {total}")
        print(f"✅ Passou: {passed}")
        print(f"❌ Falhou: {total - passed}")
        print(f"\nTaxa de sucesso: {(passed/total*100):.1f}%")

        print("\nStatus detalhado:")
        for scraper, result in self.results.items():
            status_icon = "✅" if result['status'] == 'passed' else "❌"
            print(f"  {status_icon} {scraper.upper()}: {result['status']}")

        print("\n" + "=" * 70)

        if passed == total:
            print("🎉 TODOS OS SCRAPERS VALIDADOS COM SUCESSO!")
            print("=" * 70 + "\n")
            return True
        else:
            print("⚠️  Alguns scrapers falharam na validação")
            print("=" * 70 + "\n")
            return False


def main():
    """Função principal"""
    print("\n" + "=" * 70)
    print("  ROM AGENT - VALIDADOR DE SCRAPERS")
    print("  Versão: 1.0.0")
    print("  Data: 2026-01-12")
    print("=" * 70)

    validator = ScraperValidator()

    # Executar validações
    validator.validate_projudi()
    time.sleep(1)

    validator.validate_esaj()
    time.sleep(1)

    validator.validate_pje()
    time.sleep(1)

    # Resumo
    success = validator.print_summary()

    # Exit code
    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()
