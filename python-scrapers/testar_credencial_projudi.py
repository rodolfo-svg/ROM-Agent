"""
Teste de autenticação no Projudi TJGO
Usando as credenciais cadastradas
"""

import asyncio
import json
import sys
from pathlib import Path
from cryptography.fernet import Fernet

# Adiciona sceap ao path
sys.path.insert(0, str(Path(__file__).parent))

from sceap.api_clients.projudi_client import PROJUDIClient, CredenciaisPROJUDI


def carregar_encryption_key():
    """Carrega ENCRYPTION_KEY do .env"""
    env_file = Path(__file__).parent / ".env"

    with open(env_file, 'r') as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith('#') and '=' in line:
                key, value = line.split('=', 1)
                if key == 'ENCRYPTION_KEY':
                    return value.encode()

    raise ValueError("ENCRYPTION_KEY não encontrada no .env")


def carregar_credenciais():
    """Carrega credenciais do arquivo JSON e descriptografa"""
    arquivo = Path(__file__).parent / "credenciais" / "tribunal_credenciais.json"

    if not arquivo.exists():
        raise FileNotFoundError("Arquivo de credenciais não encontrado")

    with open(arquivo, 'r') as f:
        credenciais_lista = json.load(f)

    # Busca credencial do Projudi TJGO
    for cred in credenciais_lista:
        if cred.get('sistema') == 'projudi' and cred.get('tribunal') == 'TJGO':
            # Descriptografar
            encryption_key = carregar_encryption_key()
            fernet = Fernet(encryption_key)

            username = fernet.decrypt(cred['username_encrypted'].encode()).decode()
            password = fernet.decrypt(cred['password_encrypted'].encode()).decode()

            return username, password

    raise ValueError("Credencial Projudi TJGO não encontrada")


async def testar_autenticacao():
    """Testa autenticação no Projudi TJGO"""

    print("═══════════════════════════════════════════════════════")
    print("   TESTE DE AUTENTICAÇÃO - PROJUDI TJGO")
    print("═══════════════════════════════════════════════════════\n")

    try:
        # Carregar credenciais
        print("📂 Carregando credenciais do arquivo...")
        username, password = carregar_credenciais()

        print(f"✅ Credenciais carregadas e descriptografadas")
        print(f"   Username: {username}")
        print(f"   Password: {'*' * len(password)}")
        print()

        # Criar credenciais para o client
        credenciais = CredenciaisPROJUDI(
            cpf=username,
            senha=password
        )

        # Criar client
        print("🔧 Criando cliente Projudi TJGO...")
        client = PROJUDIClient(
            estado="GO",
            credenciais=credenciais,
            timeout=30
        )

        print(f"✅ Cliente criado: {client}")
        print()

        # Tentar autenticar
        print("🔐 Tentando autenticar no Projudi TJGO...")
        print(f"   URL: {client.base_url}")
        print()

        sucesso = await client.autenticar()

        print("─" * 55)
        print("RESULTADO DA AUTENTICAÇÃO:\n")

        if sucesso:
            print("✅ AUTENTICAÇÃO REALIZADA COM SUCESSO!")
            print()
            print("🎉 Você agora tem acesso completo ao Projudi TJGO:")
            print("   ✅ Processos em segredo de justiça")
            print("   ✅ Download de todas as peças")
            print("   ✅ Intimações e prazos")
            print("   ✅ Consulta por OAB")
            print()

            # Testar se está realmente autenticado
            if client.esta_autenticado():
                print("✅ Status: AUTENTICADO")
                print(f"✅ Sessão ativa com cookies armazenados")
            else:
                print("⚠️  Status: NÃO AUTENTICADO")

        else:
            print("❌ FALHA NA AUTENTICAÇÃO")
            print()
            print("Possíveis causas:")
            print("  - CPF ou senha incorretos")
            print("  - Projudi TJGO temporariamente indisponível")
            print("  - Problemas de conexão")
            print()
            print("Verifique suas credenciais e tente novamente")

    except FileNotFoundError as e:
        print(f"❌ ERRO: {e}")
        print()
        print("Execute primeiro: python3 cadastrar_credencial_simples.py")

    except Exception as e:
        print(f"❌ ERRO: {e}")
        import traceback
        traceback.print_exc()

    print()
    print("═══════════════════════════════════════════════════════")
    print("✅ TESTE CONCLUÍDO")
    print("═══════════════════════════════════════════════════════")


if __name__ == "__main__":
    asyncio.run(testar_autenticacao())
