#!/usr/bin/env python3
"""
Script para criar repositório no GitHub automaticamente
"""

import requests
import json
import getpass
import sys

def criar_repositorio():
    print("="*60)
    print("CRIAR REPOSITÓRIO GITHUB - IAROM Extrator")
    print("="*60)
    print()

    # Configurações
    username = "rodolfo-svg"
    repo_name = "iarom-extrator-processual"

    print(f"👤 Username: {username}")
    print(f"📦 Repositório: {repo_name}")
    print()

    # Pedir token/senha
    print("🔐 Para criar o repositório, você precisa de um Personal Access Token.")
    print()
    print("Como criar um token:")
    print("  1. Vá em: https://github.com/settings/tokens")
    print("  2. Clique em 'Generate new token (classic)'")
    print("  3. Marque: repo (full control)")
    print("  4. Clique em 'Generate token'")
    print("  5. Copie o token gerado")
    print()

    token = getpass.getpass("Cole seu Personal Access Token: ")

    if not token:
        print("❌ Token não pode estar vazio!")
        sys.exit(1)

    # Criar repositório via API
    print()
    print("📤 Criando repositório no GitHub...")

    url = "https://api.github.com/user/repos"
    headers = {
        "Authorization": f"token {token}",
        "Accept": "application/vnd.github.v3+json"
    }
    data = {
        "name": repo_name,
        "description": "Sistema de Análise Processual Universal - 33 Ferramentas",
        "private": True,
        "auto_init": False
    }

    response = requests.post(url, headers=headers, json=data)

    if response.status_code == 201:
        repo_data = response.json()
        clone_url = repo_data['clone_url']
        html_url = repo_data['html_url']

        print()
        print("="*60)
        print("✅ REPOSITÓRIO CRIADO COM SUCESSO!")
        print("="*60)
        print()
        print(f"🔗 URL: {html_url}")
        print(f"📋 Clone URL: {clone_url}")
        print()

        # Salvar URL para o próximo passo
        with open('.github_repo_url', 'w') as f:
            f.write(clone_url)

        return clone_url, token

    elif response.status_code == 422:
        print()
        print("⚠️  Repositório já existe!")
        clone_url = f"https://github.com/{username}/{repo_name}.git"
        print(f"🔗 URL: {clone_url}")
        print()

        with open('.github_repo_url', 'w') as f:
            f.write(clone_url)

        return clone_url, token

    else:
        print()
        print(f"❌ Erro ao criar repositório!")
        print(f"Status: {response.status_code}")
        print(f"Resposta: {response.text}")
        sys.exit(1)

if __name__ == "__main__":
    try:
        criar_repositorio()
    except KeyboardInterrupt:
        print("\n\n❌ Cancelado pelo usuário")
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ Erro: {e}")
        sys.exit(1)
