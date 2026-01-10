"""
Diagnóstico do banco de dados de produção
Verifica se as tabelas foram criadas corretamente
"""

import os
import requests

API_URL = "https://api.extrator.iarom.com.br/api/v1"

print("═══════════════════════════════════════════════════════")
print("   DIAGNÓSTICO DO BANCO DE DADOS - PRODUÇÃO")
print("═══════════════════════════════════════════════════════\n")

# TESTE 1: Health check
print("─" * 55)
print("TESTE 1: Health Check da API")
print("─" * 55)
print()

try:
    response = requests.get(f"https://api.extrator.iarom.com.br/health", timeout=10)
    print(f"Status: {response.status_code}")
    print(f"Resposta: {response.json()}")
    print()
except Exception as e:
    print(f"❌ Erro: {e}\n")

# TESTE 2: Login para obter token
print("─" * 55)
print("TESTE 2: Fazer Login")
print("─" * 55)
print()

credentials = {
    "email": "rodolfo@rom.adv.br",
    "password": "Admin123!"
}

try:
    response = requests.post(f"{API_URL}/auth/login", json=credentials, timeout=10)

    if response.status_code == 200:
        token = response.json()['access_token']
        print(f"✅ Login OK - Token obtido\n")
    else:
        print(f"❌ Login falhou: {response.status_code}\n")
        exit(1)
except Exception as e:
    print(f"❌ Erro: {e}\n")
    exit(1)

# TESTE 3: Testar vários endpoints
print("─" * 55)
print("TESTE 3: Testando Endpoints")
print("─" * 55)
print()

headers = {"Authorization": f"Bearer {token}"}

endpoints = [
    ("/auth/me", "Dados do Usuário"),
    ("/processos", "Listar Processos"),
    ("/processos?page=1&size=1", "Listar Processos (paginado)"),
]

for endpoint, desc in endpoints:
    try:
        print(f"📡 GET {endpoint}")
        print(f"   ({desc})")

        response = requests.get(f"{API_URL}{endpoint}", headers=headers, timeout=10)

        print(f"   Status: {response.status_code}")

        if response.status_code == 200:
            print(f"   ✅ OK")
            data = response.json()

            if 'total' in data:
                print(f"   Total de items: {data.get('total', 0)}")
            elif 'email' in data:
                print(f"   Email: {data.get('email')}")
        elif response.status_code == 500:
            print(f"   ❌ ERRO 500 - Internal Server Error")
            print(f"   Resposta: {response.text[:300]}")
        else:
            print(f"   ⚠️  Status: {response.status_code}")
            print(f"   Resposta: {response.text[:200]}")

        print()
    except Exception as e:
        print(f"   ❌ Erro: {str(e)[:100]}\n")

print("═══════════════════════════════════════════════════════")
print("✅ DIAGNÓSTICO CONCLUÍDO")
print("═══════════════════════════════════════════════════════\n")
