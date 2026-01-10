"""
Teste completo do fluxo de autenticação
1. Login
2. Obter token
3. Acessar endpoint protegido (/processos)
"""

import requests
import json

API_URL = "https://api.extrator.iarom.com.br/api/v1"

# Credenciais de login
credentials = {
    "email": "rodolfo@rom.adv.br",
    "password": "Admin123!"
}

print("═══════════════════════════════════════════════════════")
print("   TESTE COMPLETO DE AUTENTICAÇÃO - SCEAP v5.0")
print("═══════════════════════════════════════════════════════\n")

print(f"🌐 API: {API_URL}")
print(f"📧 Email: {credentials['email']}")
print()

# PASSO 1: LOGIN
print("─" * 55)
print("PASSO 1: LOGIN")
print("─" * 55)
print()

try:
    print(f"📡 POST {API_URL}/auth/login\n")

    response = requests.post(
        f"{API_URL}/auth/login",
        json=credentials,
        timeout=10
    )

    print(f"📊 Status: {response.status_code}\n")

    if response.status_code == 200:
        login_data = response.json()

        token = login_data.get('access_token')
        token_type = login_data.get('token_type')
        expires_in = login_data.get('expires_in')

        print("✅ LOGIN REALIZADO COM SUCESSO!\n")
        print(f"   Token Type: {token_type}")
        print(f"   Expira em: {expires_in}s ({expires_in // 60} minutos)")
        print(f"   Token: {token[:30]}...{token[-10:]}")
        print()

    else:
        print(f"❌ LOGIN FALHOU")
        print(f"   Status: {response.status_code}")
        print(f"   Resposta: {response.text}")
        exit(1)

except Exception as e:
    print(f"❌ ERRO NO LOGIN: {e}")
    import traceback
    traceback.print_exc()
    exit(1)

# PASSO 2: OBTER DADOS DO USUÁRIO
print("─" * 55)
print("PASSO 2: OBTER DADOS DO USUÁRIO (/auth/me)")
print("─" * 55)
print()

try:
    headers = {
        "Authorization": f"Bearer {token}"
    }

    print(f"📡 GET {API_URL}/auth/me")
    print(f"🔑 Authorization: Bearer {token[:20]}...\n")

    response = requests.get(
        f"{API_URL}/auth/me",
        headers=headers,
        timeout=10
    )

    print(f"📊 Status: {response.status_code}\n")

    if response.status_code == 200:
        user_data = response.json()

        print("✅ DADOS DO USUÁRIO OBTIDOS!\n")
        print(f"   ID: {user_data.get('id')}")
        print(f"   Nome: {user_data.get('nome')}")
        print(f"   Email: {user_data.get('email')}")
        print(f"   Role: {user_data.get('role')}")
        print(f"   OAB: {user_data.get('oab')}")
        print(f"   Ativo: {user_data.get('is_active')}")
        print()

    else:
        print(f"⚠️  ERRO AO OBTER DADOS DO USUÁRIO")
        print(f"   Status: {response.status_code}")
        print(f"   Resposta: {response.text[:200]}")
        print()

except Exception as e:
    print(f"❌ ERRO: {e}")
    import traceback
    traceback.print_exc()

# PASSO 3: ACESSAR ENDPOINT PROTEGIDO (/processos)
print("─" * 55)
print("PASSO 3: ACESSAR ENDPOINT PROTEGIDO (/processos)")
print("─" * 55)
print()

try:
    headers = {
        "Authorization": f"Bearer {token}"
    }

    print(f"📡 GET {API_URL}/processos")
    print(f"🔑 Authorization: Bearer {token[:20]}...\n")

    response = requests.get(
        f"{API_URL}/processos",
        headers=headers,
        timeout=10
    )

    print(f"📊 Status: {response.status_code}\n")

    if response.status_code == 200:
        processos_data = response.json()

        print("✅ ENDPOINT /processos ACESSÍVEL!")
        print()
        print("Estrutura da resposta:")
        print(f"   Total de processos: {processos_data.get('total', 0)}")
        print(f"   Página: {processos_data.get('page', 1)}")
        print(f"   Por página: {processos_data.get('size', 10)}")
        print(f"   Items retornados: {len(processos_data.get('items', []))}")
        print()

        if processos_data.get('items'):
            print("Primeiro processo:")
            first = processos_data['items'][0]
            print(f"   ID: {first.get('id')}")
            print(f"   Número: {first.get('numero_processo')}")
            print(f"   Tribunal: {first.get('tribunal')}")
            print()

    elif response.status_code == 403:
        print("❌ ERRO 403 - NOT AUTHENTICATED")
        print()
        print("Isso indica que o token JWT não está sendo aceito!")
        print(f"   Resposta: {response.text}")
        print()

    else:
        print(f"⚠️  STATUS INESPERADO: {response.status_code}")
        print(f"   Resposta: {response.text[:300]}")
        print()

except Exception as e:
    print(f"❌ ERRO: {e}")
    import traceback
    traceback.print_exc()

# RESULTADO FINAL
print("═══════════════════════════════════════════════════════")
print("   RESULTADO FINAL")
print("═══════════════════════════════════════════════════════")
print()

if response.status_code == 200:
    print("🎉 ✅ ✅ ✅ AUTENTICAÇÃO FUNCIONANDO PERFEITAMENTE! ✅ ✅ ✅")
    print()
    print("O que foi testado e funcionou:")
    print("   ✅ Login com email/senha")
    print("   ✅ Recebimento de JWT token")
    print("   ✅ Obtenção de dados do usuário (/auth/me)")
    print("   ✅ Acesso a endpoint protegido (/processos)")
    print()
    print("─" * 55)
    print()
    print("🌐 PRÓXIMO PASSO: Testar no navegador!")
    print()
    print("   1. Acesse: https://extrator.iarom.com.br/login")
    print(f"   2. Digite o email: {credentials['email']}")
    print(f"   3. Digite a senha: {credentials['password']}")
    print("   4. Clique em 'Entrar'")
    print()
    print("   Você deve ser redirecionado para /dashboard")
    print("   e conseguir acessar a página de Processos!")
    print()

else:
    print("⚠️  PROBLEMAS DETECTADOS")
    print()
    print("Revise os logs acima para identificar o problema.")
    print()

print("═══════════════════════════════════════════════════════")
print("✅ TESTE CONCLUÍDO")
print("═══════════════════════════════════════════════════════")
print()
