"""
Script simplificado para cadastrar credenciais do Projudi
Salva em arquivo JSON criptografado
"""

import json
import os
from pathlib import Path
from datetime import datetime
from cryptography.fernet import Fernet
import uuid


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


def criptografar_valor(valor: str, fernet: Fernet) -> str:
    """Criptografa um valor"""
    encrypted = fernet.encrypt(valor.encode())
    return encrypted.decode()


def descriptografar_valor(valor_encrypted: str, fernet: Fernet) -> str:
    """Descriptografa um valor"""
    decrypted = fernet.decrypt(valor_encrypted.encode())
    return decrypted.decode()


def main():
    print("═══════════════════════════════════════════════════════")
    print("   CADASTRO DE CREDENCIAL - PROJUDI TJGO")
    print("   (Armazenamento em arquivo JSON criptografado)")
    print("═══════════════════════════════════════════════════════\n")

    # Carregar chave de criptografia
    encryption_key = carregar_encryption_key()
    fernet = Fernet(encryption_key)

    print(f"✅ ENCRYPTION_KEY carregada")
    print()

    # Dados da credencial
    cpf = "89409647134"  # CPF sem formatação
    senha = "Fortioli23."  # Senha com ponto no final

    print("📋 DADOS DA CREDENCIAL:\n")
    print(f"  Sistema: Projudi")
    print(f"  Tribunal: TJGO (Goiás)")
    print(f"  Login (CPF): {cpf}")
    print(f"  Senha: {'*' * len(senha)}")
    print()

    # Criptografar credenciais
    cpf_encrypted = criptografar_valor(cpf, fernet)
    senha_encrypted = criptografar_valor(senha, fernet)

    # Criar estrutura da credencial
    credencial = {
        "id": str(uuid.uuid4()),
        "sistema": "projudi",
        "tribunal": "TJGO",
        "nome": "Projudi TJGO - Rodolfo Otávio Mota Advogados",
        "tipo_credencial": "login_senha",
        "username_encrypted": cpf_encrypted,
        "password_encrypted": senha_encrypted,
        "ativa": True,
        "created_at": datetime.now().isoformat(),
        "configuracoes": {
            "url_base": "https://projudi.tjgo.jus.br",
            "descricao": "Credencial principal para acesso ao Projudi TJGO"
        }
    }

    # Salvar em arquivo
    credenciais_dir = Path(__file__).parent / "credenciais"
    credenciais_dir.mkdir(exist_ok=True)

    arquivo_credenciais = credenciais_dir / "tribunal_credenciais.json"

    # Carregar credenciais existentes (se houver)
    if arquivo_credenciais.exists():
        with open(arquivo_credenciais, 'r') as f:
            credenciais_lista = json.load(f)
    else:
        credenciais_lista = []

    # Verificar se já existe credencial do Projudi TJGO
    existe = False
    for i, cred in enumerate(credenciais_lista):
        if cred.get('sistema') == 'projudi' and cred.get('tribunal') == 'TJGO':
            credenciais_lista[i] = credencial
            existe = True
            print("⚠️  Credencial Projudi TJGO já existia - ATUALIZADA")
            break

    if not existe:
        credenciais_lista.append(credencial)
        print("✅ Nova credencial adicionada")

    # Salvar arquivo
    with open(arquivo_credenciais, 'w') as f:
        json.dump(credenciais_lista, f, indent=2)

    print()
    print("─" * 55)
    print("✅ CREDENCIAL SALVA COM SUCESSO!\n")

    print(f"📁 Arquivo: {arquivo_credenciais}")
    print(f"🆔 ID: {credencial['id']}")
    print(f"📋 Sistema: {credencial['sistema']}")
    print(f"🏛️  Tribunal: {credencial['tribunal']}")
    print(f"📝 Nome: {credencial['nome']}")
    print(f"✅ Ativa: {credencial['ativa']}")
    print()

    # Testar descriptografia
    print("🔐 TESTE DE CRIPTOGRAFIA:\n")
    cpf_decrypt = descriptografar_valor(cpf_encrypted, fernet)
    senha_decrypt = descriptografar_valor(senha_encrypted, fernet)

    if cpf_decrypt == cpf and senha_decrypt == senha:
        print("  ✅ Criptografia/Descriptografia: FUNCIONANDO")
        print(f"  ✅ Username recuperado: {cpf_decrypt}")
        print(f"  ✅ Password recuperada: {'*' * len(senha_decrypt)}")
    else:
        print("  ❌ ERRO na descriptografia!")

    print()
    print("─" * 55)
    print("💾 ARMAZENAMENTO SEGURO:\n")
    print("  ✅ Username: CRIPTOGRAFADO no arquivo JSON")
    print("  ✅ Password: CRIPTOGRAFADO no arquivo JSON")
    print("  ✅ Chave Fernet: Armazenada apenas no .env")
    print("  ✅ Sem a ENCRYPTION_KEY, ninguém consegue descriptografar")
    print()
    print("  ⚠️  IMPORTANTE: Nunca compartilhe o arquivo .env!")
    print("  ⚠️  O .env está no .gitignore e não será commitado")

    print()
    print("═══════════════════════════════════════════════════════")
    print("✅ PROCESSO CONCLUÍDO")
    print("═══════════════════════════════════════════════════════")
    print()
    print("📋 PRÓXIMOS PASSOS:\n")
    print("1. Use o SCEAP para extrair processos do TJGO")
    print("2. O sistema carregará esta credencial automaticamente")
    print("3. Você terá acesso COMPLETO a:")
    print("   - Processos em segredo de justiça")
    print("   - Download de todas as peças (PDFs)")
    print("   - Intimações e prazos")
    print("   - Consulta por OAB")
    print()


if __name__ == "__main__":
    main()
