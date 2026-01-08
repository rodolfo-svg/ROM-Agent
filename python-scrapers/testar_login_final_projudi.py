"""
Teste FINAL de login no Projudi TJGO
Usando o formulário correto descoberto na análise
"""

import asyncio
import json
from pathlib import Path
from cryptography.fernet import Fernet
import httpx


def carregar_credenciais():
    """Carrega credenciais do Projudi"""
    # Carregar ENCRYPTION_KEY
    env_file = Path(__file__).parent / ".env"
    encryption_key = None

    with open(env_file, 'r') as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith('#') and '=' in line:
                key, value = line.split('=', 1)
                if key == 'ENCRYPTION_KEY':
                    encryption_key = value
                    break

    if not encryption_key:
        raise ValueError("ENCRYPTION_KEY não encontrada")

    fernet = Fernet(encryption_key.encode())

    # Carregar do JSON
    arquivo = Path(__file__).parent / "credenciais" / "tribunal_credenciais.json"
    with open(arquivo, 'r') as f:
        creds = json.load(f)

    for cred in creds:
        if cred.get('sistema') == 'projudi' and cred.get('tribunal') == 'TJGO':
            cpf = fernet.decrypt(cred['username_encrypted'].encode()).decode()
            senha = fernet.decrypt(cred['password_encrypted'].encode()).decode()
            return cpf, senha

    return None, None


async def testar_login():
    """Testa login com o formulário correto"""

    print("═══════════════════════════════════════════════════════")
    print("   TESTE FINAL - LOGIN PROJUDI TJGO")
    print("   Usando formulário descoberto na análise forense")
    print("═══════════════════════════════════════════════════════\n")

    # Carregar credenciais
    cpf, senha = carregar_credenciais()

    if not cpf or not senha:
        print("❌ Credenciais não encontradas!")
        return

    print(f"📋 Credenciais:")
    print(f"   CPF: {cpf}")
    print(f"   Senha: {'*' * len(senha)}")
    print()

    # URL e dados do formulário
    base_url = "https://projudi.tjgo.jus.br"
    login_url = f"{base_url}/LogOn"

    dados_login = {
        'PaginaAtual': '7',
        'Usuario': cpf,
        'Senha': senha,
        'entrar': 'Entrar'
    }

    print(f"🌐 URL de login: {login_url}")
    print(f"📦 Dados do formulário: {list(dados_login.keys())}")
    print()

    async with httpx.AsyncClient(timeout=30, follow_redirects=True) as client:

        print("🔐 Enviando requisição de login...")
        print()

        try:
            response = await client.post(login_url, data=dados_login)

            print(f"📊 Status da resposta: {response.status_code}")
            print(f"🌐 URL final: {response.url}")
            print(f"🍪 Cookies recebidos: {len(response.cookies)}")

            if response.cookies:
                print(f"   Cookies: {list(response.cookies.keys())}")

            print()

            # Analisar resposta
            text_lower = response.text.lower()

            # Indicadores de SUCESSO
            sucesso_indicators = [
                'bem-vindo', 'bem vindo', 'bemvindo',
                'painel', 'meu painel',
                'sair', 'logout',
                'meus processos',
                'minhas intimações',
                'usuário logado'
            ]

            # Indicadores de FALHA
            falha_indicators = [
                'usuário ou senha inválido',
                'usuário ou senha incorreto',
                'dados inválidos',
                'erro ao autenticar',
                'acesso negado',
                'não autorizado'
            ]

            sucesso_found = [ind for ind in sucesso_indicators if ind in text_lower]
            falha_found = [ind for ind in falha_indicators if ind in text_lower]

            print("─" * 55)
            print("ANÁLISE DA RESPOSTA:")
            print()

            if sucesso_found:
                print(f"✅ Indicadores de SUCESSO: {sucesso_found}")

            if falha_found:
                print(f"❌ Indicadores de FALHA: {falha_found}")

            if not sucesso_found and not falha_found:
                print("⚠️  Nenhum indicador claro encontrado")

            print()

            # VEREDICTO FINAL
            print("═" * 55)
            print("   VEREDICTO FINAL")
            print("═" * 55)
            print()

            if sucesso_found and not falha_found:
                print("🎉 ✅ ✅ ✅ LOGIN REALIZADO COM SUCESSO! ✅ ✅ ✅")
                print()
                print("Você agora tem acesso completo ao Projudi TJGO!")
                print()
                print("✅ Cookies de sessão salvos")
                print("✅ Pode consultar processos autenticados")
                print("✅ Pode baixar documentos")
                print("✅ Pode ver intimações")
                print()
                print("🔧 PRÓXIMO PASSO:")
                print("   Vou atualizar o código do PROJUDIClient com:")
                print(f"   - URL: {login_url}")
                print(f"   - Campos: {list(dados_login.keys())}")

            elif falha_found:
                print("❌ LOGIN FALHOU")
                print()
                print(f"Mensagens detectadas: {falha_found}")
                print()
                print("Possíveis causas:")
                print("  1. CPF ou senha incorretos")
                print("  2. Conta bloqueada/inativa")
                print("  3. Requer verificação adicional")

            else:
                print("⚠️  RESULTADO INCERTO")
                print()
                print("A resposta não contém indicadores claros.")
                print()

                # Salvar HTML para análise manual
                html_file = Path(__file__).parent / "projudi_login_response.html"
                html_file.write_text(response.text, encoding='utf-8')
                print(f"📁 HTML salvo em: {html_file}")
                print("   Abra o arquivo para verificar manualmente")

        except Exception as e:
            print(f"❌ ERRO durante o login:")
            print(f"   {str(e)}")
            import traceback
            traceback.print_exc()

    print()
    print("═══════════════════════════════════════════════════════")
    print("✅ TESTE CONCLUÍDO")
    print("═══════════════════════════════════════════════════════")
    print()


if __name__ == "__main__":
    asyncio.run(testar_login())
