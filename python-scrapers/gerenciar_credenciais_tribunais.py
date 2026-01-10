#!/usr/bin/env python3
"""
SCEAP v5.0 - Gerenciador de Credenciais de Tribunais
Script interativo para cadastrar, listar e gerenciar credenciais
"""

import json
import uuid
from pathlib import Path
from datetime import datetime
from getpass import getpass
from cryptography.fernet import Fernet


# ============================================================================
# CONFIGURAÇÕES
# ============================================================================

CREDENCIAIS_FILE = Path(__file__).parent / "credenciais" / "tribunal_credenciais.json"
ENV_FILE = Path(__file__).parent / ".env"


# ============================================================================
# SISTEMAS/TRIBUNAIS DISPONÍVEIS
# ============================================================================

SISTEMAS_DISPONIVEIS = {
    "1": {
        "nome": "Projudi - TJGO",
        "sistema": "projudi",
        "tribunal": "TJGO",
        "url_base": "https://projudi.tjgo.jus.br",
        "tipo_login": "CPF",
        "descricao": "Sistema Projudi do Tribunal de Justiça de Goiás"
    },
    "2": {
        "nome": "PJe - TJGO",
        "sistema": "pje",
        "tribunal": "TJGO",
        "url_base": "https://pje.tjgo.jus.br",
        "tipo_login": "CPF",
        "descricao": "Processo Judicial Eletrônico - TJGO"
    },
    "3": {
        "nome": "eSAJ - TJSP",
        "sistema": "esaj",
        "tribunal": "TJSP",
        "url_base": "https://esaj.tjsp.jus.br",
        "tipo_login": "OAB",
        "descricao": "Sistema eSAJ do Tribunal de Justiça de São Paulo"
    },
    "4": {
        "nome": "PJe - TRT18 (Goiás)",
        "sistema": "pje",
        "tribunal": "TRT18",
        "url_base": "https://pje.trt18.jus.br",
        "tipo_login": "CPF",
        "descricao": "PJe do Tribunal Regional do Trabalho da 18ª Região"
    },
    "5": {
        "nome": "eProc - TRF1",
        "sistema": "eproc",
        "tribunal": "TRF1",
        "url_base": "https://eproc.trf1.jus.br",
        "tipo_login": "CPF",
        "descricao": "Sistema eProc do Tribunal Regional Federal da 1ª Região"
    },
    "6": {
        "nome": "CNJ - Plataforma DataJud",
        "sistema": "datajud",
        "tribunal": "CNJ",
        "url_base": "https://api-publica.datajud.cnj.jus.br",
        "tipo_login": "API_KEY",
        "descricao": "API Pública do DataJud (CNJ)"
    },
}


# ============================================================================
# FUNÇÕES AUXILIARES
# ============================================================================

def carregar_encryption_key():
    """Carrega ENCRYPTION_KEY do .env"""
    if not ENV_FILE.exists():
        print("❌ Arquivo .env não encontrado!")
        return None

    with open(ENV_FILE, 'r') as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith('#') and '=' in line:
                key, value = line.split('=', 1)
                if key == 'ENCRYPTION_KEY':
                    return value.encode()

    return None


def carregar_credenciais():
    """Carrega credenciais existentes"""
    if not CREDENCIAIS_FILE.exists():
        CREDENCIAIS_FILE.parent.mkdir(parents=True, exist_ok=True)
        return []

    with open(CREDENCIAIS_FILE, 'r') as f:
        return json.load(f)


def salvar_credenciais(credenciais):
    """Salva credenciais no arquivo JSON"""
    CREDENCIAIS_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(CREDENCIAIS_FILE, 'w') as f:
        json.dump(credenciais, f, indent=2, ensure_ascii=False)


def criptografar(texto, fernet):
    """Criptografa texto"""
    return fernet.encrypt(texto.encode()).decode()


def descriptografar(texto_cripto, fernet):
    """Descriptografa texto"""
    return fernet.decrypt(texto_cripto.encode()).decode()


# ============================================================================
# MENU PRINCIPAL
# ============================================================================

def mostrar_menu():
    """Mostra menu principal"""
    print("\n" + "═" * 60)
    print("   SCEAP v5.0 - GERENCIADOR DE CREDENCIAIS")
    print("═" * 60)
    print()
    print("1. 📝 Cadastrar Nova Credencial")
    print("2. 📋 Listar Credenciais Cadastradas")
    print("3. 🔍 Testar Credencial")
    print("4. 🗑️  Remover Credencial")
    print("5. 🔄 Atualizar Credencial")
    print("0. ❌ Sair")
    print()


def listar_sistemas():
    """Lista sistemas/tribunais disponíveis"""
    print("\n" + "─" * 60)
    print("   SISTEMAS/TRIBUNAIS DISPONÍVEIS")
    print("─" * 60)
    print()

    for key, sistema in SISTEMAS_DISPONIVEIS.items():
        print(f"{key}. {sistema['nome']}")
        print(f"   Sistema: {sistema['sistema']} | Tribunal: {sistema['tribunal']}")
        print(f"   Login: {sistema['tipo_login']}")
        print(f"   {sistema['descricao']}")
        print()


def cadastrar_credencial(fernet):
    """Cadastra nova credencial"""
    print("\n" + "═" * 60)
    print("   CADASTRAR NOVA CREDENCIAL")
    print("═" * 60)

    # Listar sistemas
    listar_sistemas()

    # Escolher sistema
    escolha = input("Escolha o sistema (número) ou 0 para voltar: ").strip()

    if escolha == "0":
        return

    if escolha not in SISTEMAS_DISPONIVEIS:
        print("\n❌ Opção inválida!")
        return

    sistema_info = SISTEMAS_DISPONIVEIS[escolha]

    print(f"\n✅ Sistema selecionado: {sistema_info['nome']}")
    print()

    # Coletar dados
    if sistema_info['tipo_login'] == 'API_KEY':
        print("📋 Digite a API Key:")
        username = input("API Key: ").strip()
        password = ""  # API Key não usa senha
    else:
        print(f"📋 Digite o {sistema_info['tipo_login']}:")
        username = input(f"{sistema_info['tipo_login']}: ").strip()
        password = getpass("Senha (não será exibida): ").strip()

    # Nome/descrição da credencial
    nome_padrao = f"{sistema_info['nome']} - {username}"
    nome = input(f"\nNome da credencial (Enter para '{nome_padrao}'): ").strip()
    if not nome:
        nome = nome_padrao

    # Confirmação
    print("\n" + "─" * 60)
    print("CONFIRME OS DADOS:")
    print("─" * 60)
    print(f"Sistema: {sistema_info['nome']}")
    print(f"Tribunal: {sistema_info['tribunal']}")
    print(f"Login: {username}")
    print(f"Senha: {'*' * len(password) if password else '(API Key)'}")
    print(f"Nome: {nome}")
    print()

    confirma = input("Salvar esta credencial? (s/n): ").strip().lower()

    if confirma != 's':
        print("\n❌ Operação cancelada!")
        return

    # Criptografar
    username_encrypted = criptografar(username, fernet)
    password_encrypted = criptografar(password, fernet) if password else ""

    # Criar registro
    credencial = {
        "id": str(uuid.uuid4()),
        "sistema": sistema_info['sistema'],
        "tribunal": sistema_info['tribunal'],
        "nome": nome,
        "tipo_credencial": "api_key" if sistema_info['tipo_login'] == 'API_KEY' else "login_senha",
        "username_encrypted": username_encrypted,
        "password_encrypted": password_encrypted,
        "ativa": True,
        "created_at": datetime.now().isoformat(),
        "configuracoes": {
            "url_base": sistema_info['url_base'],
            "descricao": sistema_info['descricao']
        }
    }

    # Carregar, adicionar e salvar
    credenciais = carregar_credenciais()
    credenciais.append(credencial)
    salvar_credenciais(credenciais)

    print("\n✅ Credencial cadastrada com sucesso!")
    print(f"   ID: {credencial['id']}")
    print(f"   Arquivo: {CREDENCIAIS_FILE}")


def listar_credenciais(fernet):
    """Lista credenciais cadastradas"""
    credenciais = carregar_credenciais()

    print("\n" + "═" * 60)
    print("   CREDENCIAIS CADASTRADAS")
    print("═" * 60)
    print()

    if not credenciais:
        print("📭 Nenhuma credencial cadastrada ainda.")
        return

    for i, cred in enumerate(credenciais, 1):
        status = "✅ ATIVA" if cred.get('ativa', True) else "❌ INATIVA"

        print(f"{i}. {cred['nome']}")
        print(f"   ID: {cred['id']}")
        print(f"   Sistema: {cred['sistema']} | Tribunal: {cred['tribunal']}")
        print(f"   Status: {status}")

        # Descriptografar para mostrar
        try:
            username = descriptografar(cred['username_encrypted'], fernet)
            print(f"   Login: {username}")
        except:
            print(f"   Login: [ERRO AO DESCRIPTOGRAFAR]")

        print(f"   Cadastrado em: {cred['created_at']}")
        print()


def remover_credencial():
    """Remove credencial"""
    credenciais = carregar_credenciais()

    if not credenciais:
        print("\n📭 Nenhuma credencial cadastrada.")
        return

    print("\n" + "═" * 60)
    print("   REMOVER CREDENCIAL")
    print("═" * 60)
    print()

    # Listar com índices
    for i, cred in enumerate(credenciais, 1):
        print(f"{i}. {cred['nome']} ({cred['sistema']} - {cred['tribunal']})")

    print()
    escolha = input("Escolha o número da credencial para remover (0 para cancelar): ").strip()

    if escolha == "0":
        return

    try:
        indice = int(escolha) - 1
        if indice < 0 or indice >= len(credenciais):
            print("\n❌ Número inválido!")
            return

        cred = credenciais[indice]

        confirma = input(f"\n⚠️  REMOVER '{cred['nome']}'? (s/n): ").strip().lower()

        if confirma == 's':
            credenciais.pop(indice)
            salvar_credenciais(credenciais)
            print("\n✅ Credencial removida!")
        else:
            print("\n❌ Operação cancelada!")

    except ValueError:
        print("\n❌ Entrada inválida!")


# ============================================================================
# MAIN
# ============================================================================

def main():
    # Carregar encryption key
    encryption_key = carregar_encryption_key()

    if not encryption_key:
        print("\n❌ ERRO: ENCRYPTION_KEY não encontrada no arquivo .env!")
        print("   Execute o script de configuração inicial primeiro.")
        return

    fernet = Fernet(encryption_key)

    while True:
        mostrar_menu()
        opcao = input("Escolha uma opção: ").strip()

        if opcao == "1":
            cadastrar_credencial(fernet)
        elif opcao == "2":
            listar_credenciais(fernet)
        elif opcao == "3":
            print("\n⚠️  Função de teste em desenvolvimento...")
        elif opcao == "4":
            remover_credencial()
        elif opcao == "5":
            print("\n⚠️  Função de atualização em desenvolvimento...")
        elif opcao == "0":
            print("\n👋 Até logo!")
            break
        else:
            print("\n❌ Opção inválida!")

        input("\nPressione Enter para continuar...")


if __name__ == "__main__":
    main()
