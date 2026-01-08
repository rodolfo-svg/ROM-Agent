"""
Script para cadastrar credenciais do Projudi TJGO
Armazena de forma segura com criptografia Fernet
"""

import asyncio
import sys
import os
from pathlib import Path

# Adiciona backend ao path
sys.path.insert(0, str(Path(__file__).parent / "backend"))

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker

# Importa modelos
from api.models.tribunal_credencial import TribunalCredencial, TipoCredencial
from api.config import settings


async def cadastrar_credencial_projudi():
    """Cadastra credencial do Projudi TJGO"""

    print("═══════════════════════════════════════════════════════")
    print("   CADASTRO DE CREDENCIAL - PROJUDI TJGO")
    print("═══════════════════════════════════════════════════════\n")

    # Carregar ENCRYPTION_KEY do .env
    env_vars = {}
    env_file = Path(__file__).parent / ".env"

    with open(env_file, 'r') as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith('#') and '=' in line:
                key, value = line.split('=', 1)
                env_vars[key] = value
                os.environ[key] = value

    encryption_key = env_vars.get('ENCRYPTION_KEY')

    if not encryption_key:
        print("❌ ERRO: ENCRYPTION_KEY não encontrada no .env")
        return

    print(f"✅ ENCRYPTION_KEY carregada: {encryption_key[:20]}...")
    print()

    # Dados da credencial
    cpf = "89409647134"  # CPF sem formatação
    senha = "Fortioli23"

    print("📋 DADOS DA CREDENCIAL:\n")
    print(f"  Sistema: Projudi")
    print(f"  Tribunal: TJGO (Goiás)")
    print(f"  Login (CPF): {cpf}")
    print(f"  Senha: {'*' * len(senha)}")
    print()

    # Criar engine async
    database_url = settings.DATABASE_URL.replace('postgresql://', 'postgresql+asyncpg://')
    engine = create_async_engine(database_url, echo=False)

    # Criar sessão
    async_session = sessionmaker(
        engine,
        class_=AsyncSession,
        expire_on_commit=False
    )

    async with async_session() as session:
        try:
            # Criar credencial
            credencial = TribunalCredencial(
                sistema="projudi",
                tribunal="TJGO",
                nome="Projudi TJGO - Rodolfo Otávio Mota Advogados",
                tipo_credencial=TipoCredencial.LOGIN_SENHA,
                ativa=True,
                configuracoes={
                    "url_base": "https://projudi.tjgo.jus.br",
                    "descricao": "Credencial principal para acesso ao Projudi TJGO"
                }
            )

            # Define credenciais (serão criptografadas automaticamente)
            credencial.set_username(cpf)
            credencial.set_password(senha)

            # Salva no banco
            session.add(credencial)
            await session.commit()
            await session.refresh(credencial)

            print("─" * 55)
            print("✅ CREDENCIAL CADASTRADA COM SUCESSO!\n")

            print(f"ID: {credencial.id}")
            print(f"Sistema: {credencial.sistema}")
            print(f"Tribunal: {credencial.tribunal}")
            print(f"Nome: {credencial.nome}")
            print(f"Tipo: {credencial.tipo_credencial.value}")
            print(f"Ativa: {credencial.ativa}")
            print(f"Criada em: {credencial.created_at}")
            print()

            # Testa descriptografia
            print("🔐 TESTE DE CRIPTOGRAFIA:\n")
            username_decrypt = credencial.get_username()
            password_decrypt = credencial.get_password()

            if username_decrypt == cpf and password_decrypt == senha:
                print("  ✅ Criptografia/Descriptografia: FUNCIONANDO")
                print(f"  ✅ Username recuperado: {username_decrypt}")
                print(f"  ✅ Password recuperada: {'*' * len(password_decrypt)}")
            else:
                print("  ❌ ERRO na descriptografia!")

            print()
            print("─" * 55)
            print("💾 ARMAZENAMENTO SEGURO:\n")
            print("  ✅ Username: CRIPTOGRAFADO no banco")
            print("  ✅ Password: CRIPTOGRAFADO no banco")
            print("  ✅ Chave Fernet: Armazenada apenas no .env")
            print("  ✅ Ninguém consegue ver as credenciais sem a ENCRYPTION_KEY")

        except Exception as e:
            print(f"❌ ERRO ao cadastrar: {e}")
            await session.rollback()
            raise

    await engine.dispose()

    print()
    print("═══════════════════════════════════════════════════════")
    print("✅ PROCESSO CONCLUÍDO")
    print("═══════════════════════════════════════════════════════")
    print()
    print("📋 PRÓXIMOS PASSOS:\n")
    print("1. Use o SCEAP para extrair processos do TJGO")
    print("2. O sistema usará automaticamente esta credencial")
    print("3. Você terá acesso COMPLETO a:")
    print("   - Processos em segredo de justiça")
    print("   - Download de todas as peças")
    print("   - Intimações e prazos")
    print("   - Consulta por OAB")
    print()


if __name__ == "__main__":
    asyncio.run(cadastrar_credencial_projudi())
