"""
Script para registrar usuário na API de produção
Cria um usuário admin para acesso inicial ao sistema
"""

import requests
import json

# URL da API de produção
API_URL = "https://api.extrator.iarom.com.br/api/v1"

# Dados do usuário a ser criado
user_data = {
    "email": "rodolfo@rom.adv.br",
    "nome": "Rodolfo Otávio",
    "password": "Admin123!",  # Senha forte: maiúscula, minúscula, número, símbolo
    "role": "admin",  # admin, advogado, estagiario, cliente
    "oab": "GO 21841"
}

print("═══════════════════════════════════════════════════════")
print("   REGISTRO DE USUÁRIO - SCEAP v5.0 PRODUÇÃO")
print("═══════════════════════════════════════════════════════\n")

print(f"🌐 API: {API_URL}")
print(f"📧 Email: {user_data['email']}")
print(f"👤 Nome: {user_data['nome']}")
print(f"🔑 Role: {user_data['role']}")
print(f"📋 OAB: {user_data['oab']}")
print()

try:
    print("📡 Enviando requisição de registro...\n")

    response = requests.post(
        f"{API_URL}/auth/register",
        json=user_data,
        timeout=10
    )

    print(f"📊 Status Code: {response.status_code}\n")

    if response.status_code == 201:
        user_info = response.json()
        print("✅ USUÁRIO REGISTRADO COM SUCESSO!\n")
        print("Dados do usuário criado:")
        print(f"   ID: {user_info.get('id')}")
        print(f"   Email: {user_info.get('email')}")
        print(f"   Nome: {user_info.get('nome')}")
        print(f"   Role: {user_info.get('role')}")
        print(f"   Ativo: {user_info.get('is_active')}")
        print(f"   Verificado: {user_info.get('is_verified')}")
        print()
        print("─" * 55)
        print("\n🎉 SUCESSO! Agora você pode fazer login:")
        print(f"   URL: https://extrator.iarom.com.br/login")
        print(f"   Email: {user_data['email']}")
        print(f"   Senha: {user_data['password']}")
        print()

    elif response.status_code == 400:
        error_data = response.json()
        print("❌ ERRO DE VALIDAÇÃO\n")
        print(f"Detalhes: {json.dumps(error_data, indent=2, ensure_ascii=False)}")
        print()

        # Verificar se usuário já existe
        if "already exists" in str(error_data).lower() or "já existe" in str(error_data).lower():
            print("ℹ️  O usuário já está registrado!")
            print()
            print("Você pode fazer login com:")
            print(f"   Email: {user_data['email']}")
            print(f"   Senha: {user_data['password']}")
            print()

    else:
        print(f"❌ ERRO: Status {response.status_code}\n")
        print("Resposta do servidor:")
        print(response.text[:500])
        print()

except requests.exceptions.ConnectionError:
    print("❌ ERRO DE CONEXÃO")
    print()
    print("Não foi possível conectar à API de produção.")
    print()
    print("Possíveis causas:")
    print("  1. API ainda não foi deployada no Render")
    print("  2. URL incorreta")
    print("  3. Problemas de rede")
    print()
    print("Verifique se a API está online em:")
    print(f"  {API_URL}/health")
    print()

except requests.exceptions.Timeout:
    print("⏱️  TIMEOUT")
    print()
    print("A API demorou muito para responder (>10s)")
    print()

except Exception as e:
    print(f"❌ ERRO INESPERADO: {str(e)}")
    print()
    import traceback
    traceback.print_exc()

print("═══════════════════════════════════════════════════════")
print("✅ SCRIPT CONCLUÍDO")
print("═══════════════════════════════════════════════════════")
print()
