"""
Análise forense completa do formulário de login do Projudi TJGO
Descobre exatamente o que o sistema espera
"""

import asyncio
import httpx
from bs4 import BeautifulSoup
from urllib.parse import urljoin
import json
from pathlib import Path
from cryptography.fernet import Fernet


def carregar_credenciais():
    """Carrega credenciais do Projudi"""
    # Carregar ENCRYPTION_KEY do .env
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
        raise ValueError("ENCRYPTION_KEY não encontrada no .env")

    fernet = Fernet(encryption_key.encode())

    # Carregar credenciais do JSON
    arquivo = Path(__file__).parent / "credenciais" / "tribunal_credenciais.json"
    with open(arquivo, 'r') as f:
        credenciais_lista = json.load(f)

    for cred in credenciais_lista:
        if cred.get('sistema') == 'projudi' and cred.get('tribunal') == 'TJGO':
            username = fernet.decrypt(cred['username_encrypted'].encode()).decode()
            password = fernet.decrypt(cred['password_encrypted'].encode()).decode()
            return username, password

    return None, None


async def analisar_formularios():
    """Analisa todos os formulários da página de login"""

    print("═══════════════════════════════════════════════════════")
    print("   ANÁLISE FORENSE - FORMULÁRIO DE LOGIN PROJUDI TJGO")
    print("═══════════════════════════════════════════════════════\n")

    base_url = "https://projudi.tjgo.jus.br"

    # Carregar credenciais
    username, password = carregar_credenciais()
    print(f"📋 Credenciais carregadas:")
    print(f"   CPF: {username}")
    print(f"   Senha: {'*' * len(password)}")
    print()

    async with httpx.AsyncClient(timeout=30, follow_redirects=True) as client:

        # PASSO 1: Acessar página inicial
        print("🌐 PASSO 1: Acessando página inicial...")
        print(f"   URL: {base_url}")
        print()

        response = await client.get(base_url)

        print(f"   ✅ Status: {response.status_code}")
        print(f"   ✅ URL final: {response.url}")
        print(f"   ✅ Cookies: {dict(response.cookies)}")
        print()

        # PASSO 2: Analisar HTML
        print("🔍 PASSO 2: Analisando HTML da página...\n")

        soup = BeautifulSoup(response.text, 'html.parser')

        # Encontrar TODOS os formulários
        forms = soup.find_all('form')

        print(f"   📋 Total de formulários encontrados: {len(forms)}\n")

        formularios_analisados = []

        for i, form in enumerate(forms, 1):
            print(f"   ╔═══ FORMULÁRIO {i} ═══╗")

            # Action e Method
            action = form.get('action', '')
            method = form.get('method', 'GET').upper()

            # Resolver URL completa
            if action:
                action_url = urljoin(str(response.url), action)
            else:
                action_url = str(response.url)

            print(f"   ║ Action: {action}")
            print(f"   ║ Method: {method}")
            print(f"   ║ URL completa: {action_url}")
            print(f"   ║")

            # Todos os inputs
            inputs = form.find_all('input')
            print(f"   ║ Total de campos: {len(inputs)}")
            print(f"   ║")

            campos = []

            for inp in inputs:
                name = inp.get('name', 'SEM_NOME')
                tipo = inp.get('type', 'text')
                value = inp.get('value', '')
                required = 'required' in inp.attrs

                campos.append({
                    'name': name,
                    'type': tipo,
                    'value': value,
                    'required': required
                })

                req_mark = "⚠️ OBRIGATÓRIO" if required else ""

                if tipo == 'hidden':
                    print(f"   ║   🔒 {name} (hidden) = '{value}' {req_mark}")
                elif tipo == 'submit':
                    print(f"   ║   🔘 {name} (submit) = '{value}'")
                elif tipo == 'password':
                    print(f"   ║   🔑 {name} (password) {req_mark}")
                else:
                    print(f"   ║   📝 {name} ({tipo}) {req_mark}")

            print(f"   ╚{'═' * 25}╝\n")

            formularios_analisados.append({
                'numero': i,
                'action': action,
                'action_url': action_url,
                'method': method,
                'campos': campos
            })

        # PASSO 3: Identificar formulário de login
        print("🎯 PASSO 3: Identificando formulário de login...\n")

        form_login = None

        for form_data in formularios_analisados:
            campos_nomes = [c['name'].lower() for c in form_data['campos']]

            # Verificar se tem campos típicos de login
            tem_senha = any('senha' in n or 'password' in n for n in campos_nomes)
            tem_usuario = any('cpf' in n or 'login' in n or 'usuario' in n or 'user' in n for n in campos_nomes)

            if tem_senha or tem_usuario:
                form_login = form_data
                print(f"   ✅ Formulário {form_data['numero']} identificado como LOGIN")
                print(f"   ✅ Tem campo de senha: {tem_senha}")
                print(f"   ✅ Tem campo de usuário: {tem_usuario}")
                break

        if not form_login:
            print("   ❌ Nenhum formulário de login identificado!")
            print("   ℹ️  O Projudi pode usar JavaScript para fazer login")
            return

        print()

        # PASSO 4: Preparar dados para POST
        print("🔧 PASSO 4: Preparando dados para autenticação...\n")

        post_data = {}

        for campo in form_login['campos']:
            name = campo['name']
            tipo = campo['type']
            value = campo['value']

            if tipo == 'hidden':
                # Manter valores hidden
                post_data[name] = value
                print(f"   ✅ Campo hidden: {name} = '{value}'")

            elif 'cpf' in name.lower() or 'login' in name.lower() or 'usuario' in name.lower():
                # Campo de usuário
                post_data[name] = username
                print(f"   ✅ Campo usuário: {name} = '{username}'")

            elif 'senha' in name.lower() or 'password' in name.lower():
                # Campo de senha
                post_data[name] = password
                print(f"   ✅ Campo senha: {name} = '{'*' * len(password)}'")

            elif tipo == 'submit' and value:
                # Alguns sistemas precisam do botão submit
                post_data[name] = value
                print(f"   ✅ Campo submit: {name} = '{value}'")

        print()
        print(f"   📦 Total de campos a enviar: {len(post_data)}")
        print()

        # PASSO 5: Tentar autenticar
        print("🔐 PASSO 5: Tentando autenticar...\n")

        url_login = form_login['action_url']
        method = form_login['method']

        print(f"   📡 URL: {url_login}")
        print(f"   📋 Method: {method}")
        print(f"   📦 Dados: {list(post_data.keys())}")
        print()

        try:
            if method == 'POST':
                response = await client.post(url_login, data=post_data)
            else:
                response = await client.get(url_login, params=post_data)

            print(f"   📊 Status da resposta: {response.status_code}")
            print(f"   🌐 URL final: {response.url}")
            print(f"   🍪 Cookies recebidos: {len(response.cookies)}")
            print()

            # PASSO 6: Analisar resposta
            print("🔍 PASSO 6: Analisando resposta...\n")

            text_lower = response.text.lower()

            # Indicadores de SUCESSO
            indicadores_sucesso = [
                'bem-vindo', 'bem vindo', 'bemvindo',
                'painel', 'dashboard',
                'sair', 'logout', 'logoff',
                'meu painel', 'meus processos',
                'usuário logado', 'usuario logado'
            ]

            # Indicadores de FALHA
            indicadores_falha = [
                'usuário ou senha', 'usuario ou senha',
                'inválido', 'invalido',
                'incorreto', 'incorreta',
                'erro ao autenticar', 'falha no login',
                'acesso negado', 'credenciais',
                'não autorizado', 'nao autorizado'
            ]

            sucesso_encontrado = [ind for ind in indicadores_sucesso if ind in text_lower]
            falha_encontrada = [ind for ind in indicadores_falha if ind in text_lower]

            print(f"   🔍 Indicadores de sucesso encontrados: {sucesso_encontrado}")
            print(f"   🔍 Indicadores de falha encontrados: {falha_encontrada}")
            print()

            # Verificar cookies de sessão
            cookies_sessao = {
                k: v for k, v in response.cookies.items()
                if 'session' in k.lower() or 'jsession' in k.lower() or 'auth' in k.lower()
            }

            if cookies_sessao:
                print(f"   ✅ Cookies de sessão detectados: {list(cookies_sessao.keys())}")

            print()

            # VEREDICTO
            print("═" * 55)
            print("   VEREDICTO FINAL")
            print("═" * 55)
            print()

            if sucesso_encontrado or (cookies_sessao and not falha_encontrada):
                print("   🎉 ✅ LOGIN REALIZADO COM SUCESSO!")
                print()
                print("   O que funcionou:")
                print(f"   - URL: {url_login}")
                print(f"   - Method: {method}")
                print(f"   - Campos: {list(post_data.keys())}")
                print()
                print("   ✅ Vou atualizar o código do PROJUDIClient com esses dados!")

            elif falha_encontrada:
                print("   ❌ LOGIN FALHOU - Credenciais rejeitadas")
                print()
                print(f"   Mensagens de erro detectadas: {falha_encontrada}")
                print()
                print("   Possíveis causas:")
                print("   1. CPF ou senha incorretos")
                print("   2. Conta bloqueada ou inativa")
                print("   3. Requer verificação adicional (2FA)")

            else:
                print("   ⚠️  RESULTADO INCERTO")
                print()
                print("   Não foram encontrados indicadores claros de sucesso ou falha.")
                print()
                print("   Análise adicional necessária:")

                # Salvar HTML para análise manual
                html_file = Path(__file__).parent / "projudi_response.html"
                html_file.write_text(response.text, encoding='utf-8')
                print(f"   📁 HTML da resposta salvo em: {html_file}")
                print("   ℹ️  Analise o arquivo para verificar se há redirecionamento ou JavaScript")

        except Exception as e:
            print(f"   ❌ ERRO ao tentar autenticar: {e}")
            import traceback
            traceback.print_exc()

        print()
        print("═══════════════════════════════════════════════════════")
        print("✅ ANÁLISE FORENSE CONCLUÍDA")
        print("═══════════════════════════════════════════════════════")
        print()


if __name__ == "__main__":
    asyncio.run(analisar_formularios())
