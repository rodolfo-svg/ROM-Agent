"""
IAROM - Integração com JusBrasil
Pesquisa autenticada de jurisprudência e documentos jurídicos

IMPORTANTE: Requer login prévio para gerar cookies.
Use o script do agente ROM para fazer login manual e gerar cookies.
"""

import requests
import json
import os
from typing import Dict, List, Optional, Any
from datetime import datetime
from pathlib import Path

# Configuração
CONFIG = {
    'base_url': 'https://www.jusbrasil.com.br',
    'jurisprudencia_url': 'https://www.jusbrasil.com.br/jurisprudencia',
    'busca_url': 'https://www.jusbrasil.com.br/jurisprudencia/busca',
    'cookies_path': os.path.join(os.path.dirname(__file__), '.jusbrasil-cookies.json'),
    'timeout': 30,
    'user_agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
}


class JusBrasilAPI:
    """Cliente para JusBrasil com autenticação via cookies"""

    def __init__(self, email: Optional[str] = None, senha: Optional[str] = None):
        """
        Inicializa cliente JusBrasil

        Args:
            email: Email da conta JusBrasil (armazenado para referência)
            senha: Senha da conta (não armazenada, apenas para referência)

        Note:
            A autenticação real é feita via cookies salvos.
            Para gerar cookies, execute loginManual() do agente ROM em JavaScript.
        """
        self.email = email or os.getenv('JUSBRASIL_EMAIL')
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': CONFIG['user_agent'],
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
            'Accept-Encoding': 'gzip, deflate, br',
            'DNT': '1',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1'
        })

        # Carregar cookies se existirem
        self.logado = self._carregar_cookies()

    def _carregar_cookies(self) -> bool:
        """
        Carrega cookies salvos do arquivo

        Returns:
            True se cookies foram carregados, False caso contrário
        """
        cookies_path = CONFIG['cookies_path']

        # Tentar caminhos alternativos
        caminhos_possiveis = [
            cookies_path,
            os.path.join(os.path.dirname(__file__), '..', '.jusbrasil-cookies.json'),
            os.path.expanduser('~/Desktop/Backup-ROM-Agent-OneDrive/.jusbrasil-cookies.json'),
            '.jusbrasil-cookies.json'
        ]

        for caminho in caminhos_possiveis:
            if os.path.exists(caminho):
                try:
                    with open(caminho, 'r') as f:
                        cookies = json.load(f)

                    # Converter cookies do formato Puppeteer para requests
                    for cookie in cookies:
                        self.session.cookies.set(
                            name=cookie['name'],
                            value=cookie['value'],
                            domain=cookie.get('domain', '.jusbrasil.com.br'),
                            path=cookie.get('path', '/')
                        )

                    print(f"✓ Cookies carregados de: {caminho}")
                    return True

                except Exception as e:
                    print(f"⚠ Erro ao carregar cookies de {caminho}: {e}")
                    continue

        print("⚠ Nenhum cookie encontrado. Pesquisas podem ser limitadas.")
        print("   Para login completo, execute loginManual() do agente ROM (JavaScript)")
        return False

    def verificar_login(self) -> Dict[str, Any]:
        """
        Verifica se está logado no JusBrasil

        Returns:
            Dict com status do login
        """
        try:
            response = self.session.get(
                CONFIG['base_url'],
                timeout=CONFIG['timeout'],
                allow_redirects=True
            )

            # Verificar indicadores de login
            logado = any([
                'sair' in response.text.lower(),
                'logout' in response.text.lower(),
                'user-menu' in response.text.lower(),
                '/perfil/' in response.text.lower()
            ])

            return {
                'sucesso': True,
                'logado': logado,
                'cookies_validos': len(self.session.cookies) > 0,
                'mensagem': 'Logado' if logado else 'Não logado (acesso limitado)'
            }

        except Exception as e:
            return {
                'sucesso': False,
                'erro': str(e),
                'logado': False
            }

    def pesquisar_jurisprudencia(
        self,
        termo: str,
        tribunal: Optional[str] = None,
        pagina: int = 1,
        limite: int = 10
    ) -> Dict[str, Any]:
        """
        Pesquisa jurisprudência no JusBrasil

        Args:
            termo: Termo de busca
            tribunal: Tribunal (ex: 'STF', 'STJ', 'TJSP') - opcional
            pagina: Número da página (padrão: 1)
            limite: Limite de resultados por página (padrão: 10)

        Returns:
            Dict com resultados da pesquisa
        """
        try:
            # Construir URL
            params = {
                'q': termo
            }

            if tribunal:
                params['tribunal'] = tribunal.upper()

            if pagina > 1:
                params['p'] = pagina

            # Fazer requisição
            response = self.session.get(
                CONFIG['busca_url'],
                params=params,
                timeout=CONFIG['timeout'],
                allow_redirects=True
            )

            response.raise_for_status()

            # Tentar extrair resultados via API (se disponível)
            # ou fazer parsing HTML básico

            # Por enquanto, retornar info básica
            return {
                'sucesso': True,
                'fonte': 'JusBrasil',
                'termo': termo,
                'tribunal': tribunal or 'Todos',
                'pagina': pagina,
                'url': response.url,
                'status_code': response.status_code,
                'mensagem': 'Acesse a URL para ver resultados',
                'dica': 'Para extração automática de resultados, implemente parser HTML ou use API interna do JusBrasil'
            }

        except Exception as e:
            return {
                'sucesso': False,
                'erro': str(e),
                'termo': termo
            }

    def obter_inteiro_teor(self, url: str) -> Dict[str, Any]:
        """
        Obtém o inteiro teor de uma decisão

        Args:
            url: URL da decisão no JusBrasil

        Returns:
            Dict com conteúdo da decisão
        """
        try:
            response = self.session.get(
                url,
                timeout=CONFIG['timeout'],
                allow_redirects=True
            )

            response.raise_for_status()

            return {
                'sucesso': True,
                'url': url,
                'html': response.text,
                'tamanho': len(response.text),
                'mensagem': 'HTML obtido. Implemente parser para extrair conteúdo específico'
            }

        except Exception as e:
            return {
                'sucesso': False,
                'erro': str(e),
                'url': url
            }


# =============================================================================
# INFORMAÇÕES DE USO
# =============================================================================

def obter_instrucoes_login() -> str:
    """Retorna instruções para fazer login no JusBrasil"""
    return """
═══════════════════════════════════════════════════════════════════════
INSTRUÇÕES PARA LOGIN NO JUSBRASIL
═══════════════════════════════════════════════════════════════════════

Este módulo Python usa cookies gerados pelo agente ROM (JavaScript).

PASSO 1: Execute o login manual no agente ROM
────────────────────────────────────────────────────────────────────
No terminal, navegue até o diretório do agente ROM e execute:

cd ~/Desktop/Backup-ROM-Agent-OneDrive
node test-jusbrasil.js

Ou use a função loginManual():

import jusbrasilAuth from './src/modules/jusbrasilAuth.js';
await jusbrasilAuth.loginManual('seu-email@example.com', 'sua-senha');

PASSO 2: O navegador abrirá automaticamente
────────────────────────────────────────────────────────────────────
1. Resolva o CAPTCHA se aparecer
2. Aguarde o login completar
3. Os cookies serão salvos automaticamente em:
   .jusbrasil-cookies.json

PASSO 3: Use este módulo Python
────────────────────────────────────────────────────────────────────
from jusbrasil_api import JusBrasilAPI

client = JusBrasilAPI()
status = client.verificar_login()
print(status)

resultados = client.pesquisar_jurisprudencia('prisão preventiva', 'STF')

═══════════════════════════════════════════════════════════════════════

COOKIES VÁLIDOS ENCONTRADOS:
"""


# =============================================================================
# FUNÇÕES DE CONVENIÊNCIA
# =============================================================================

def verificar_login() -> Dict[str, Any]:
    """Verifica se há cookies válidos e está logado (função de conveniência)"""
    client = JusBrasilAPI()
    return client.verificar_login()


def pesquisar(termo: str, tribunal: Optional[str] = None) -> Dict[str, Any]:
    """Pesquisa jurisprudência (função de conveniência)"""
    client = JusBrasilAPI()
    return client.pesquisar_jurisprudencia(termo, tribunal)


# =============================================================================
# TESTE
# =============================================================================

if __name__ == '__main__':
    print("="*80)
    print("IAROM - Integração JusBrasil")
    print("="*80)

    client = JusBrasilAPI()

    print("\n📊 Status do Login:")
    status = client.verificar_login()
    print(json.dumps(status, indent=2, ensure_ascii=False))

    if not status.get('logado'):
        print(obter_instrucoes_login())

        # Verificar se há cookies
        cookies_path = CONFIG['cookies_path']
        caminhos = [
            cookies_path,
            os.path.expanduser('~/Desktop/Backup-ROM-Agent-OneDrive/.jusbrasil-cookies.json')
        ]

        for caminho in caminhos:
            if os.path.exists(caminho):
                print(f"\n✓ Arquivo de cookies encontrado: {caminho}")
                try:
                    with open(caminho, 'r') as f:
                        cookies = json.load(f)
                    print(f"  Total de cookies: {len(cookies)}")

                    # Verificar user cookie
                    user_cookies = [c for c in cookies if c['name'] == 'user']
                    if user_cookies:
                        print(f"  ✓ Cookie de usuário encontrado")
                except Exception as e:
                    print(f"  ⚠ Erro ao ler cookies: {e}")

    print("\n" + "="*80)
