"""
IAROM - API de Certidões CNJ (Plataforma de Comunicações Processuais)
API REST oficial do CNJ para emissão de certidões e consulta de publicações DJEN

Documentação: https://app.swaggerhub.com/apis-docs/cnj/pcp/1.0.0
Portal DJEN: https://comunica.pje.jus.br/

IMPORTANTE: Requer credenciais do sistema Corporativo CNJ
"""

import requests
import os
from typing import Dict, List, Optional, Any
from datetime import datetime
import base64

# Configuração da API
CNJ_API_CONFIG = {
    'homologacao': {
        'base_url': 'https://hcomunicaapi.cnj.jus.br/api/v1',
        'descricao': 'Ambiente de testes (homologação)'
    },
    'producao': {
        'base_url': 'https://comunicaapi.pje.jus.br/api/v1',
        'descricao': 'Ambiente de produção'
    },
    'timeout': 60,
    'portal_djen': 'https://comunica.pje.jus.br/',
    'swagger_docs': 'https://app.swaggerhub.com/apis-docs/cnj/pcp/1.0.0'
}


class CNJCertidoesAPI:
    """Cliente para API de Certidões e Comunicações Processuais do CNJ"""

    def __init__(
        self,
        usuario: Optional[str] = None,
        senha: Optional[str] = None,
        ambiente: str = 'homologacao'
    ):
        """
        Inicializa cliente da API CNJ

        Args:
            usuario: Usuário do sistema Corporativo CNJ
            senha: Senha do sistema Corporativo CNJ
            ambiente: 'homologacao' ou 'producao' (padrão: homologacao)
        """
        self.usuario = usuario or os.getenv('CNJ_USUARIO')
        self.senha = senha or os.getenv('CNJ_SENHA')
        self.ambiente = ambiente

        if ambiente not in CNJ_API_CONFIG:
            raise ValueError(f"Ambiente inválido. Use 'homologacao' ou 'producao'")

        self.base_url = CNJ_API_CONFIG[ambiente]['base_url']
        self.timeout = CNJ_API_CONFIG['timeout']

        self.session = requests.Session()
        self.session.headers.update({
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'User-Agent': 'IAROM-Extrator-Processual/1.0'
        })

        # Token de autenticação (será obtido no login)
        self.token = None
        self.token_expiracao = None

    def autenticar(self) -> Dict[str, Any]:
        """
        Autentica na API CNJ

        Returns:
            Dict com status da autenticação e token
        """
        if not self.usuario or not self.senha:
            return {
                'sucesso': False,
                'erro': 'Credenciais não configuradas',
                'dica': 'Configure CNJ_USUARIO e CNJ_SENHA nas variáveis de ambiente'
            }

        try:
            # Endpoint de autenticação
            url = f"{self.base_url}/auth"

            payload = {
                'usuario': self.usuario,
                'senha': self.senha
            }

            response = self.session.post(
                url,
                json=payload,
                timeout=self.timeout
            )

            response.raise_for_status()
            data = response.json()

            # Armazenar token
            self.token = data.get('token') or data.get('access_token')
            self.token_expiracao = data.get('expiracao') or data.get('expires_in')

            if self.token:
                # Adicionar token ao header
                self.session.headers.update({
                    'Authorization': f'Bearer {self.token}'
                })

                return {
                    'sucesso': True,
                    'mensagem': 'Autenticado com sucesso',
                    'ambiente': self.ambiente,
                    'token_expira_em': self.token_expiracao
                }
            else:
                return {
                    'sucesso': False,
                    'erro': 'Token não retornado pela API',
                    'resposta': data
                }

        except requests.exceptions.HTTPError as e:
            return {
                'sucesso': False,
                'erro': f'Erro HTTP {e.response.status_code}: {e.response.text}',
                'status_code': e.response.status_code
            }
        except Exception as e:
            return {
                'sucesso': False,
                'erro': str(e)
            }

    def buscar_publicacao(
        self,
        numero_processo: str,
        data_inicio: Optional[str] = None,
        data_fim: Optional[str] = None,
        tribunal: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Busca publicações de um processo no DJEN

        Args:
            numero_processo: Número do processo (formato CNJ)
            data_inicio: Data início (formato YYYY-MM-DD) - opcional
            data_fim: Data fim (formato YYYY-MM-DD) - opcional
            tribunal: Código do tribunal (ex: 'TJSP', 'STJ') - opcional

        Returns:
            Dict com publicações encontradas
        """
        if not self.token:
            auth_result = self.autenticar()
            if not auth_result.get('sucesso'):
                return auth_result

        try:
            url = f"{self.base_url}/comunicacao/consultar"

            # Limpar número do processo
            numero_limpo = ''.join(filter(str.isdigit, numero_processo))

            params = {
                'numeroProcesso': numero_limpo
            }

            if data_inicio:
                params['dataInicio'] = data_inicio
            if data_fim:
                params['dataFim'] = data_fim
            if tribunal:
                params['tribunal'] = tribunal.upper()

            response = self.session.get(
                url,
                params=params,
                timeout=self.timeout
            )

            response.raise_for_status()
            data = response.json()

            return {
                'sucesso': True,
                'processo': numero_processo,
                'total_publicacoes': len(data) if isinstance(data, list) else data.get('total', 0),
                'publicacoes': data,
                'ambiente': self.ambiente
            }

        except requests.exceptions.HTTPError as e:
            return {
                'sucesso': False,
                'erro': f'Erro HTTP {e.response.status_code}: {e.response.text}',
                'status_code': e.response.status_code
            }
        except Exception as e:
            return {
                'sucesso': False,
                'erro': str(e)
            }

    def emitir_certidao(
        self,
        numero_processo: str,
        tipo_certidao: str = 'publicacao',
        formato: str = 'pdf'
    ) -> Dict[str, Any]:
        """
        Emite certidão de publicação/recebimento

        Args:
            numero_processo: Número do processo
            tipo_certidao: Tipo ('publicacao', 'recebimento', 'inteiro_teor')
            formato: Formato do arquivo ('pdf', 'json')

        Returns:
            Dict com certidão (PDF em base64 ou JSON)
        """
        if not self.token:
            auth_result = self.autenticar()
            if not auth_result.get('sucesso'):
                return auth_result

        try:
            url = f"{self.base_url}/certidao/emitir"

            numero_limpo = ''.join(filter(str.isdigit, numero_processo))

            payload = {
                'numeroProcesso': numero_limpo,
                'tipoCertidao': tipo_certidao,
                'formato': formato
            }

            response = self.session.post(
                url,
                json=payload,
                timeout=self.timeout
            )

            response.raise_for_status()

            # Se PDF, retornar base64
            if formato.lower() == 'pdf':
                if response.headers.get('Content-Type') == 'application/pdf':
                    pdf_content = response.content
                    pdf_base64 = base64.b64encode(pdf_content).decode('utf-8')

                    return {
                        'sucesso': True,
                        'processo': numero_processo,
                        'tipo_certidao': tipo_certidao,
                        'formato': 'pdf',
                        'certidao_base64': pdf_base64,
                        'tamanho_bytes': len(pdf_content),
                        'mensagem': 'Certidão gerada com sucesso (base64)'
                    }
                else:
                    data = response.json()
                    return {
                        'sucesso': True,
                        'processo': numero_processo,
                        'certidao': data
                    }
            else:
                # JSON
                data = response.json()
                return {
                    'sucesso': True,
                    'processo': numero_processo,
                    'tipo_certidao': tipo_certidao,
                    'formato': 'json',
                    'certidao': data
                }

        except requests.exceptions.HTTPError as e:
            return {
                'sucesso': False,
                'erro': f'Erro HTTP {e.response.status_code}: {e.response.text}',
                'status_code': e.response.status_code
            }
        except Exception as e:
            return {
                'sucesso': False,
                'erro': str(e)
            }

    def consultar_comunicacao(
        self,
        id_comunicacao: str
    ) -> Dict[str, Any]:
        """
        Consulta detalhes de uma comunicação específica

        Args:
            id_comunicacao: ID da comunicação

        Returns:
            Dict com detalhes da comunicação
        """
        if not self.token:
            auth_result = self.autenticar()
            if not auth_result.get('sucesso'):
                return auth_result

        try:
            url = f"{self.base_url}/comunicacao/{id_comunicacao}"

            response = self.session.get(
                url,
                timeout=self.timeout
            )

            response.raise_for_status()
            data = response.json()

            return {
                'sucesso': True,
                'id_comunicacao': id_comunicacao,
                'comunicacao': data
            }

        except requests.exceptions.HTTPError as e:
            return {
                'sucesso': False,
                'erro': f'Erro HTTP {e.response.status_code}: {e.response.text}',
                'status_code': e.response.status_code
            }
        except Exception as e:
            return {
                'sucesso': False,
                'erro': str(e)
            }

    def listar_tribunais(self) -> Dict[str, Any]:
        """
        Lista tribunais disponíveis no sistema

        Returns:
            Dict com lista de tribunais
        """
        if not self.token:
            auth_result = self.autenticar()
            if not auth_result.get('sucesso'):
                return auth_result

        try:
            url = f"{self.base_url}/tribunais"

            response = self.session.get(
                url,
                timeout=self.timeout
            )

            response.raise_for_status()
            data = response.json()

            return {
                'sucesso': True,
                'tribunais': data
            }

        except requests.exceptions.HTTPError as e:
            # Se endpoint não existir, retornar lista padrão
            if e.response.status_code == 404:
                return {
                    'sucesso': True,
                    'mensagem': 'Endpoint de tribunais não disponível. Lista padrão retornada.',
                    'tribunais': self._get_tribunais_padrao()
                }

            return {
                'sucesso': False,
                'erro': f'Erro HTTP {e.response.status_code}: {e.response.text}',
                'status_code': e.response.status_code
            }
        except Exception as e:
            return {
                'sucesso': False,
                'erro': str(e)
            }

    def _get_tribunais_padrao(self) -> List[Dict[str, str]]:
        """Retorna lista padrão de tribunais"""
        return [
            {'sigla': 'STF', 'nome': 'Supremo Tribunal Federal'},
            {'sigla': 'STJ', 'nome': 'Superior Tribunal de Justiça'},
            {'sigla': 'TST', 'nome': 'Tribunal Superior do Trabalho'},
            {'sigla': 'TSE', 'nome': 'Tribunal Superior Eleitoral'},
            {'sigla': 'STM', 'nome': 'Superior Tribunal Militar'},
            {'sigla': 'TRF1', 'nome': 'TRF da 1ª Região'},
            {'sigla': 'TRF2', 'nome': 'TRF da 2ª Região'},
            {'sigla': 'TRF3', 'nome': 'TRF da 3ª Região'},
            {'sigla': 'TRF4', 'nome': 'TRF da 4ª Região'},
            {'sigla': 'TRF5', 'nome': 'TRF da 5ª Região'},
            {'sigla': 'TRF6', 'nome': 'TRF da 6ª Região'},
        ]

    def obter_info(self) -> Dict[str, Any]:
        """
        Obtém informações sobre a API e configuração

        Returns:
            Dict com informações da API
        """
        return {
            'api': 'CNJ - Plataforma de Comunicações Processuais',
            'versao': '1.0',
            'ambiente_atual': self.ambiente,
            'base_url': self.base_url,
            'autenticado': self.token is not None,
            'portal_djen': CNJ_API_CONFIG['portal_djen'],
            'documentacao': CNJ_API_CONFIG['swagger_docs'],
            'endpoints_disponiveis': [
                'POST /auth - Autenticação',
                'GET /comunicacao/consultar - Buscar publicações',
                'POST /certidao/emitir - Emitir certidão',
                'GET /comunicacao/{id} - Consultar comunicação',
                'GET /tribunais - Listar tribunais'
            ],
            'contato_suporte': 'integracaopdpj@cnj.jus.br'
        }


# =============================================================================
# FUNÇÕES DE CONVENIÊNCIA
# =============================================================================

def emitir_certidao(
    numero_processo: str,
    tipo: str = 'publicacao',
    usuario: Optional[str] = None,
    senha: Optional[str] = None,
    ambiente: str = 'homologacao'
) -> Dict[str, Any]:
    """Emite certidão (função de conveniência)"""
    client = CNJCertidoesAPI(usuario, senha, ambiente)
    return client.emitir_certidao(numero_processo, tipo)


def buscar_publicacao(
    numero_processo: str,
    usuario: Optional[str] = None,
    senha: Optional[str] = None,
    ambiente: str = 'homologacao'
) -> Dict[str, Any]:
    """Busca publicação (função de conveniência)"""
    client = CNJCertidoesAPI(usuario, senha, ambiente)
    return client.buscar_publicacao(numero_processo)


# =============================================================================
# TESTE
# =============================================================================

if __name__ == '__main__':
    print("="*80)
    print("IAROM - API de Certidões CNJ (Plataforma de Comunicações Processuais)")
    print("="*80)

    client = CNJCertidoesAPI(ambiente='homologacao')
    info = client.obter_info()

    print(f"\n📡 API: {info['api']}")
    print(f"🌍 Ambiente: {info['ambiente_atual']}")
    print(f"🔗 Base URL: {info['base_url']}")
    print(f"📚 Documentação: {info['documentacao']}")
    print(f"🌐 Portal DJEN: {info['portal_djen']}")

    print("\n📋 Endpoints disponíveis:")
    for endpoint in info['endpoints_disponiveis']:
        print(f"  • {endpoint}")

    print(f"\n✉️  Suporte: {info['contato_suporte']}")

    print("\n⚠️  CONFIGURAÇÃO NECESSÁRIA:")
    print("  Para usar a API, configure as variáveis de ambiente:")
    print("  - CNJ_USUARIO: Usuário do sistema Corporativo CNJ")
    print("  - CNJ_SENHA: Senha do sistema Corporativo CNJ")

    print("\n💡 Exemplos de uso:")
    print("  - client.autenticar()")
    print("  - client.buscar_publicacao('0000000-00.0000.0.00.0000')")
    print("  - client.emitir_certidao('0000000-00.0000.0.00.0000', 'publicacao')")

    print("\n" + "="*80)
