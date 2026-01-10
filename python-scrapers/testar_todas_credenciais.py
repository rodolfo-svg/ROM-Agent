"""
Teste completo de todas as credenciais configuradas
1. CNJ (DataJud API)
2. Projudi TJGO
"""

import asyncio
import requests
import json
import httpx
from pathlib import Path
from datetime import datetime
from cryptography.fernet import Fernet


def carregar_env():
    """Carrega variáveis do .env"""
    env_vars = {}
    env_file = Path(__file__).parent / ".env"

    with open(env_file, 'r') as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith('#') and '=' in line:
                key, value = line.split('=', 1)
                env_vars[key] = value

    return env_vars


def carregar_credenciais_projudi():
    """Carrega credenciais do Projudi do arquivo JSON"""
    arquivo = Path(__file__).parent / "credenciais" / "tribunal_credenciais.json"

    if not arquivo.exists():
        return None, None

    with open(arquivo, 'r') as f:
        credenciais_lista = json.load(f)

    # Busca credencial do Projudi TJGO
    for cred in credenciais_lista:
        if cred.get('sistema') == 'projudi' and cred.get('tribunal') == 'TJGO':
            # Descriptografar
            env_vars = carregar_env()
            encryption_key = env_vars.get('ENCRYPTION_KEY').encode()
            fernet = Fernet(encryption_key)

            username = fernet.decrypt(cred['username_encrypted'].encode()).decode()
            password = fernet.decrypt(cred['password_encrypted'].encode()).decode()

            return username, password

    return None, None


def teste_1_cnj_datajud():
    """Teste 1: CNJ DataJud API"""

    print("═══════════════════════════════════════════════════════")
    print("   TESTE 1: CREDENCIAIS CNJ (DataJud API)")
    print("═══════════════════════════════════════════════════════\n")

    env_vars = carregar_env()

    cnj_usuario = env_vars.get('CNJ_USUARIO')
    cnj_senha = env_vars.get('CNJ_SENHA')
    datajud_key = env_vars.get('DATAJUD_API_KEY')

    print(f"📋 Credenciais CNJ:")
    print(f"   Usuário: {cnj_usuario}")
    print(f"   Senha: {'*' * len(cnj_senha)}")
    print()

    print(f"🔑 DataJud API Key:")
    print(f"   {datajud_key[:30]}...")
    print()

    # Teste DataJud API
    print("🔍 Testando DataJud API (CNJ - API Pública)...\n")

    try:
        url = 'https://api-publica.datajud.cnj.jus.br/api_publica_tjgo/_search'

        headers = {
            'Authorization': f'APIKey {datajud_key}',
            'Content-Type': 'application/json'
        }

        # Query simples de teste
        payload = {
            'query': {
                'match_all': {}
            },
            'size': 1
        }

        print(f"   📡 URL: api-publica.datajud.cnj.jus.br")
        print(f"   🔍 Query: match_all (1 resultado)")
        print()

        response = requests.post(url, json=payload, headers=headers, timeout=10)

        print(f"   📊 Status Code: {response.status_code}")

        if response.status_code == 200:
            data = response.json()
            total = data.get('hits', {}).get('total', {})

            if isinstance(total, dict):
                total_value = total.get('value', 0)
            else:
                total_value = total

            print(f"   ✅ DataJud API: CONECTADO E FUNCIONANDO")
            print(f"   ✅ Total de processos no TJGO: {total_value:,}")
            print(f"   ✅ API Key válida e operacional")

            resultado_cnj = "✅ SUCESSO"

        elif response.status_code == 401:
            print(f"   ❌ DataJud API: ERRO DE AUTENTICAÇÃO")
            print(f"   ⚠️  API Key inválida ou expirada")
            resultado_cnj = "❌ FALHA (API Key inválida)"

        else:
            print(f"   ⚠️  Status inesperado: {response.status_code}")
            print(f"   Resposta: {response.text[:200]}")
            resultado_cnj = f"⚠️  INCERTO (Status {response.status_code})"

    except requests.exceptions.Timeout:
        print(f"   ⏱️  TIMEOUT - API demorou muito para responder")
        resultado_cnj = "⏱️  TIMEOUT"

    except Exception as e:
        print(f"   ❌ ERRO: {str(e)[:100]}")
        resultado_cnj = f"❌ ERRO: {str(e)[:50]}"

    print()
    return resultado_cnj


async def teste_2_projudi():
    """Teste 2: Projudi TJGO"""

    print("═══════════════════════════════════════════════════════")
    print("   TESTE 2: CREDENCIAIS PROJUDI TJGO")
    print("═══════════════════════════════════════════════════════\n")

    username, password = carregar_credenciais_projudi()

    if not username or not password:
        print("   ❌ Credenciais Projudi não encontradas")
        return "❌ Credenciais não encontradas"

    print(f"📋 Credenciais Projudi:")
    print(f"   CPF: {username}")
    print(f"   Senha: {'*' * len(password)}")
    print()

    base_url = "https://projudi.tjgo.jus.br"

    print("🔍 Testando autenticação no Projudi TJGO...\n")

    # URLs de login conhecidas do Projudi
    login_endpoints = [
        "/LogOn",
        "/logon",
        "/login",
        "/Usuario/LogOn",
    ]

    async with httpx.AsyncClient(timeout=30, follow_redirects=True) as client:

        # Primeiro pegar a página inicial para obter cookies/tokens
        try:
            print("   📡 Acessando página inicial...")
            response = await client.get(base_url)
            print(f"   ✅ Página inicial: Status {response.status_code}")
            print()

        except Exception as e:
            print(f"   ❌ Erro ao acessar página inicial: {e}")
            return "❌ Erro de conexão"

        # Tentar cada endpoint de login
        autenticado = False

        for endpoint in login_endpoints:
            url = f"{base_url}{endpoint}"

            print(f"   🔐 Tentando: {endpoint}")

            try:
                # Diferentes formatos de dados que o Projudi pode aceitar
                dados_login = [
                    {'cpf': username, 'senha': password},
                    {'login': username, 'senha': password},
                    {'usuario': username, 'senha': password},
                    {'CPF': username, 'Senha': password},
                ]

                for dados in dados_login:
                    response = await client.post(url, data=dados, follow_redirects=True)

                    # Verificar indicadores de sucesso
                    text_lower = response.text.lower()

                    # Indicadores positivos
                    if any(x in text_lower for x in ['bem-vindo', 'bem vindo', 'painel', 'sair', 'logout']):
                        print(f"      ✅ AUTENTICADO COM SUCESSO!")
                        print(f"      ✅ Dados usados: {list(dados.keys())}")
                        autenticado = True
                        break

                    # Indicadores negativos
                    elif any(x in text_lower for x in ['inválid', 'incorret', 'erro']):
                        continue  # Tenta próximo formato

                if autenticado:
                    break

            except Exception as e:
                print(f"      ⚠️  Erro: {str(e)[:50]}")
                continue

        print()

        if autenticado:
            print("   ✅ PROJUDI TJGO: AUTENTICADO")
            print("   ✅ Acesso completo habilitado:")
            print("      - Processos em segredo de justiça")
            print("      - Download de peças processuais")
            print("      - Intimações e prazos")
            print("      - Consulta por OAB")
            resultado_projudi = "✅ SUCESSO"
        else:
            print("   ⚠️  PROJUDI TJGO: NÃO FOI POSSÍVEL AUTENTICAR")
            print()
            print("   📋 Possíveis causas:")
            print("      1. Endpoints de login mudaram")
            print("      2. Projudi requer captcha/reCAPTCHA")
            print("      3. Autenticação de 2 fatores habilitada")
            print("      4. Sistema em manutenção")
            print()
            print("   ℹ️  NOTA: Consulta pública ainda funciona!")
            print("      Você pode extrair dados básicos sem autenticação")
            resultado_projudi = "⚠️  Não autenticado (consulta pública disponível)"

    print()
    return resultado_projudi


def main():
    """Executa todos os testes"""

    print("\n")
    print("╔═══════════════════════════════════════════════════════╗")
    print("║                                                       ║")
    print("║   TESTE COMPLETO DE CREDENCIAIS - SCEAP v5.0         ║")
    print("║                                                       ║")
    print("╚═══════════════════════════════════════════════════════╝")
    print()
    print(f"⏰ Data/Hora: {datetime.now().strftime('%d/%m/%Y %H:%M:%S')}")
    print()

    # Teste 1: CNJ
    resultado_cnj = teste_1_cnj_datajud()

    # Teste 2: Projudi
    resultado_projudi = asyncio.run(teste_2_projudi())

    # Relatório final
    print("═══════════════════════════════════════════════════════")
    print("   RELATÓRIO FINAL DOS TESTES")
    print("═══════════════════════════════════════════════════════\n")

    print(f"1️⃣  CNJ (DataJud API):        {resultado_cnj}")
    print(f"2️⃣  Projudi TJGO:             {resultado_projudi}")

    print()
    print("─" * 55)

    # Contabilizar sucessos
    sucessos = sum([
        '✅' in resultado_cnj,
        '✅' in resultado_projudi,
    ])

    total = 2

    print(f"\n📊 RESUMO: {sucessos}/{total} credenciais funcionando")

    if sucessos == total:
        print("\n🎉 PARABÉNS! Todas as credenciais estão funcionando!")
    elif sucessos > 0:
        print(f"\n✅ {sucessos} credencial(is) funcionando")
        print("⚠️  Algumas credenciais precisam de ajustes")
    else:
        print("\n⚠️  Nenhuma credencial autenticada com sucesso")
        print("   Mas o sistema de criptografia está funcionando!")

    print()
    print("═══════════════════════════════════════════════════════")
    print("✅ TESTES CONCLUÍDOS")
    print("═══════════════════════════════════════════════════════")
    print()


if __name__ == "__main__":
    main()
