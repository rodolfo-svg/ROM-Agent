"""
Teste do Cliente PROJUDI
Verifica funcionamento da consulta pública
"""

import asyncio
import sys
from pathlib import Path

# Adiciona sceap ao path
sys.path.insert(0, str(Path(__file__).parent))

from sceap.api_clients.projudi_client import PROJUDIClient, CredenciaisPROJUDI


async def teste_consulta_publica():
    """Testa consulta pública no PROJUDI (sem autenticação)"""

    print("═══════════════════════════════════════════════════════")
    print("   TESTE: CLIENTE PROJUDI - CONSULTA PÚBLICA")
    print("═══════════════════════════════════════════════════════\n")

    # Teste com TJGO (tribunal principal do escritório)
    print("🔍 Testando PROJUDI - TJGO (Tribunal de Justiça de Goiás)\n")

    client = PROJUDIClient(estado="GO")

    print(f"Cliente: {client}")
    print(f"URL Base: {client.base_url}")
    print(f"Estado: {client.estado}")
    print()

    # Testa consulta pública (número de exemplo)
    # NOTA: Este é um número de teste genérico
    numero_teste = "0000000-00.0000.8.09.0051"

    print(f"📋 Testando consulta pública...")
    print(f"   Número de teste: {numero_teste}")
    print(f"   ⚠️  Nota: Este é um número genérico, pode não existir")
    print()

    try:
        resultado = await client.consultar_processo(numero_teste)

        print("─" * 55)
        print("RESULTADO DA CONSULTA:\n")

        print(f"✅ Sucesso: {resultado.sucesso}")
        print(f"📍 Fonte: {resultado.fonte}")
        print(f"⏱️  Tempo: {resultado.tempo_ms}ms")
        print(f"💾 Cache: {resultado.cached}")

        if resultado.sucesso:
            print(f"\n📊 DADOS RETORNADOS:")
            for key, value in resultado.dados.items():
                if value:
                    print(f"   {key}: {value}")
        else:
            print(f"\n⚠️  Erro: {resultado.erro}")
            print("   (Isso é esperado se o processo não existir)")

    except Exception as e:
        print(f"❌ Erro ao consultar: {str(e)}")

    print("\n═══════════════════════════════════════════════════════")
    print("✅ TESTE CONCLUÍDO")
    print("═══════════════════════════════════════════════════════\n")

    # Informações adicionais
    print("📋 PRÓXIMOS PASSOS:\n")
    print("1. Para usar consulta autenticada:")
    print("   - Crie credenciais via API: POST /credenciais")
    print("   - Sistema: projudi")
    print("   - Tribunal: TJGO (ou outro)")
    print("   - Tipo: login_senha")
    print("   - Username: CPF (somente números)")
    print("   - Password: senha do Projudi")
    print()
    print("2. Sistemas suportados:")
    print("   - TJGO (Goiás) - Principal")
    print("   - TJPR (Paraná)")
    print("   - TJPI (Piauí)")
    print("   - TJTO (Tocantins)")
    print("   - TJMT (Mato Grosso)")
    print("   - TJRO (Rondônia)")
    print()

    # Teste de disponibilidade dos endpoints
    print("─" * 55)
    print("🔍 TESTANDO DISPONIBILIDADE DOS ENDPOINTS:\n")

    import httpx

    tribunais = {
        "TJGO": "https://projudi.tjgo.jus.br",
        "TJPR": "https://projudi.tjpr.jus.br",
        "TJPI": "https://projudi.tjpi.jus.br",
        "TJTO": "https://projudi.tjto.jus.br",
        "TJMT": "https://projudi.tjmt.jus.br",
        "TJRO": "https://projudi.tjro.jus.br",
    }

    for tribunal, url in tribunais.items():
        try:
            async with httpx.AsyncClient(timeout=5) as http_client:
                response = await http_client.get(url, follow_redirects=True)
                status = "✅ Online" if response.status_code < 500 else "⚠️  Instável"
                print(f"  {status} {tribunal}: {url}")
        except httpx.TimeoutException:
            print(f"  ⏱️  Timeout {tribunal}: {url}")
        except Exception as e:
            print(f"  ❌ Erro {tribunal}: {str(e)[:40]}")

    print("\n═══════════════════════════════════════════════════════")


if __name__ == "__main__":
    asyncio.run(teste_consulta_publica())
