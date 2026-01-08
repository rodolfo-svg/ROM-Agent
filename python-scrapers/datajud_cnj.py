"""
IAROM - Integração com DataJud CNJ
API pública do CNJ para consulta de processos em todos os tribunais brasileiros

Documentação: https://datajud-wiki.cnj.jus.br/api-publica/
"""

import requests
import os
from typing import Dict, List, Optional, Any
from datetime import datetime

# Configuração da API DataJud
DATAJUD_CONFIG = {
    'base_url': 'https://api-publica.datajud.cnj.jus.br',
    'version': 'v1',
    'api_key': os.getenv('DATAJUD_API_KEY', 'cDZHYzlZa0JadVREZDJCendQbXY6SkJlTzNjLV9TRENyQk1RdnFKZGRQdw=='),
    'timeout': 30
}

# Mapeamento de tribunais
TRIBUNAIS = {
    # Tribunais Superiores
    'STF': 'stf',
    'STJ': 'stj',
    'TST': 'tst',
    'TSE': 'tse',
    'STM': 'stm',

    # Justiça Federal
    'TRF1': 'trf1',
    'TRF2': 'trf2',
    'TRF3': 'trf3',
    'TRF4': 'trf4',
    'TRF5': 'trf5',
    'TRF6': 'trf6',

    # Justiça Estadual
    'TJGO': 'tjgo',
    'TJSP': 'tjsp',
    'TJRJ': 'tjrj',
    'TJMG': 'tjmg',
    'TJRS': 'tjrs',
    'TJPR': 'tjpr',
    'TJSC': 'tjsc',
    'TJBA': 'tjba',
    'TJPE': 'tjpe',
    'TJCE': 'tjce',
    'TJDFT': 'tjdft',
    'TJES': 'tjes',
    'TJMS': 'tjms',
    'TJMT': 'tjmt',
    'TJPA': 'tjpa',
    'TJPB': 'tjpb',
    'TJPI': 'tjpi',
    'TJRN': 'tjrn',
    'TJRO': 'tjro',
    'TJRR': 'tjrr',
    'TJSE': 'tjse',
    'TJTO': 'tjto',
    'TJAC': 'tjac',
    'TJAL': 'tjal',
    'TJAM': 'tjam',
    'TJAP': 'tjap',
    'TJMA': 'tjma',
}


class DataJudCNJ:
    """Cliente para API DataJud do CNJ"""

    def __init__(self, api_key: Optional[str] = None):
        """
        Inicializa cliente DataJud

        Args:
            api_key: Chave de API (se não fornecida, usa variável de ambiente)
        """
        self.api_key = api_key or DATAJUD_CONFIG['api_key']
        self.base_url = DATAJUD_CONFIG['base_url']
        self.version = DATAJUD_CONFIG['version']
        self.timeout = DATAJUD_CONFIG['timeout']

        if not self.api_key or self.api_key == '':
            raise ValueError(
                "Chave de API não configurada. "
                "Configure DATAJUD_API_KEY ou solicite em: "
                "https://datajud-wiki.cnj.jus.br/api-publica/"
            )

    def _make_request(self, query: Dict[str, Any]) -> Dict[str, Any]:
        """
        Faz requisição à API DataJud

        Args:
            query: Query ElasticSearch para enviar

        Returns:
            Resposta da API (JSON)
        """
        url = f"{self.base_url}/api_publica_{self.version}/_search"

        headers = {
            'Authorization': f'APIKey {self.api_key}',
            'Content-Type': 'application/json'
        }

        try:
            response = requests.post(
                url,
                json=query,
                headers=headers,
                timeout=self.timeout
            )
            response.raise_for_status()
            return response.json()

        except requests.exceptions.Timeout:
            return {'erro': 'Timeout na requisição à API DataJud', 'sucesso': False}
        except requests.exceptions.RequestException as e:
            return {'erro': f'Erro na requisição: {str(e)}', 'sucesso': False}
        except Exception as e:
            return {'erro': f'Erro inesperado: {str(e)}', 'sucesso': False}

    def buscar_processo(self, numero_processo: str, tribunal: Optional[str] = None) -> Dict[str, Any]:
        """
        Busca processo por número

        Args:
            numero_processo: Número do processo (formato CNJ)
            tribunal: Sigla do tribunal (ex: 'TJGO', 'STJ') - opcional

        Returns:
            Dict com resultados da busca
        """
        # Limpar número do processo (apenas dígitos)
        numero_limpo = ''.join(filter(str.isdigit, numero_processo))

        # Construir query
        if tribunal and tribunal.upper() in TRIBUNAIS:
            # Busca com tribunal específico
            query = {
                "query": {
                    "bool": {
                        "must": [
                            {"match": {"numeroProcesso": numero_limpo}},
                            {"match": {"siglaTribunal": TRIBUNAIS[tribunal.upper()]}}
                        ]
                    }
                },
                "size": 10
            }
        else:
            # Busca sem tribunal específico
            query = {
                "query": {
                    "match": {
                        "numeroProcesso": numero_limpo
                    }
                },
                "size": 10
            }

        resultado = self._make_request(query)

        if 'erro' in resultado:
            return resultado

        # Formatar resultados
        if 'hits' in resultado and 'hits' in resultado['hits']:
            processos = [self._formatar_resultado(hit) for hit in resultado['hits']['hits']]
            return {
                'sucesso': True,
                'total_encontrado': resultado['hits']['total']['value'] if 'total' in resultado['hits'] else len(processos),
                'processos': processos
            }

        return {'sucesso': False, 'erro': 'Processo não encontrado', 'processos': []}

    def buscar_por_parte(self, nome_parte: str, tribunal: Optional[str] = None, limite: int = 20) -> Dict[str, Any]:
        """
        Busca processos por nome da parte

        Args:
            nome_parte: Nome da parte
            tribunal: Sigla do tribunal (opcional)
            limite: Quantidade máxima de resultados (padrão: 20)

        Returns:
            Dict com resultados da busca
        """
        must_clauses = [
            {"match": {"partes.nome": nome_parte}}
        ]

        if tribunal and tribunal.upper() in TRIBUNAIS:
            must_clauses.append({"match": {"siglaTribunal": TRIBUNAIS[tribunal.upper()]}})

        query = {
            "query": {
                "bool": {
                    "must": must_clauses
                }
            },
            "size": limite
        }

        resultado = self._make_request(query)

        if 'erro' in resultado:
            return resultado

        if 'hits' in resultado and 'hits' in resultado['hits']:
            processos = [self._formatar_resultado(hit) for hit in resultado['hits']['hits']]
            return {
                'sucesso': True,
                'nome_parte': nome_parte,
                'total_encontrado': resultado['hits']['total']['value'] if 'total' in resultado['hits'] else len(processos),
                'processos': processos
            }

        return {'sucesso': False, 'erro': 'Nenhum processo encontrado', 'processos': []}

    def buscar_por_documento(self, documento: str, tribunal: Optional[str] = None) -> Dict[str, Any]:
        """
        Busca processos por CPF ou CNPJ

        Args:
            documento: CPF ou CNPJ
            tribunal: Sigla do tribunal (opcional)

        Returns:
            Dict com resultados da busca
        """
        # Limpar documento (apenas dígitos)
        doc_limpo = ''.join(filter(str.isdigit, documento))

        must_clauses = [
            {"match": {"partes.documento": doc_limpo}}
        ]

        if tribunal and tribunal.upper() in TRIBUNAIS:
            must_clauses.append({"match": {"siglaTribunal": TRIBUNAIS[tribunal.upper()]}})

        query = {
            "query": {
                "bool": {
                    "must": must_clauses
                }
            },
            "size": 50
        }

        resultado = self._make_request(query)

        if 'erro' in resultado:
            return resultado

        if 'hits' in resultado and 'hits' in resultado['hits']:
            processos = [self._formatar_resultado(hit) for hit in resultado['hits']['hits']]
            return {
                'sucesso': True,
                'documento': documento,
                'total_encontrado': resultado['hits']['total']['value'] if 'total' in resultado['hits'] else len(processos),
                'processos': processos
            }

        return {'sucesso': False, 'erro': 'Nenhum processo encontrado', 'processos': []}

    def buscar_movimentacoes(self, numero_processo: str) -> Dict[str, Any]:
        """
        Busca movimentações de um processo

        Args:
            numero_processo: Número do processo

        Returns:
            Dict com movimentações do processo
        """
        numero_limpo = ''.join(filter(str.isdigit, numero_processo))

        query = {
            "query": {
                "match": {
                    "numeroProcesso": numero_limpo
                }
            },
            "_source": ["numeroProcesso", "movimentos", "dataAjuizamento", "classe", "assuntos"],
            "size": 1
        }

        resultado = self._make_request(query)

        if 'erro' in resultado:
            return resultado

        if 'hits' in resultado and 'hits' in resultado['hits'] and len(resultado['hits']['hits']) > 0:
            processo = resultado['hits']['hits'][0]['_source']
            return {
                'sucesso': True,
                'numero': processo.get('numeroProcesso'),
                'classe': processo.get('classe'),
                'assuntos': processo.get('assuntos', []),
                'data_ajuizamento': processo.get('dataAjuizamento'),
                'movimentos': processo.get('movimentos', [])[:50]  # Primeiras 50 movimentações
            }

        return {'sucesso': False, 'erro': 'Processo não encontrado'}

    def buscar_por_classe(self, classe: str, tribunal: str, assunto: Optional[str] = None) -> Dict[str, Any]:
        """
        Busca por classe processual

        Args:
            classe: Classe processual (ex: "Recurso Especial")
            tribunal: Sigla do tribunal
            assunto: Assunto (opcional)

        Returns:
            Dict com resultados da busca
        """
        must_clauses = [
            {"match": {"classe": classe}},
            {"match": {"siglaTribunal": TRIBUNAIS.get(tribunal.upper(), tribunal.lower())}}
        ]

        if assunto:
            must_clauses.append({"match": {"assunto": assunto}})

        query = {
            "query": {
                "bool": {
                    "must": must_clauses
                }
            },
            "size": 50
        }

        resultado = self._make_request(query)

        if 'erro' in resultado:
            return resultado

        if 'hits' in resultado and 'hits' in resultado['hits']:
            processos = [self._formatar_resultado(hit) for hit in resultado['hits']['hits']]
            return {
                'sucesso': True,
                'classe': classe,
                'tribunal': tribunal,
                'total_encontrado': resultado['hits']['total']['value'] if 'total' in resultado['hits'] else len(processos),
                'processos': processos
            }

        return {'sucesso': False, 'erro': 'Nenhum processo encontrado', 'processos': []}

    def _formatar_resultado(self, hit: Dict[str, Any]) -> Dict[str, Any]:
        """
        Formata resultado do ElasticSearch para formato mais legível

        Args:
            hit: Hit do ElasticSearch

        Returns:
            Resultado formatado
        """
        source = hit.get('_source', {})

        return {
            'numero': source.get('numeroProcesso'),
            'tribunal': source.get('siglaTribunal'),
            'classe': source.get('classe'),
            'assuntos': source.get('assuntos', []),
            'data_ajuizamento': source.get('dataAjuizamento'),
            'partes': [
                {
                    'nome': p.get('nome'),
                    'tipo': p.get('tipoParte'),
                    'documento': p.get('documento')
                }
                for p in source.get('partes', [])
            ],
            'ultima_movimentacao': source.get('movimentos', [{}])[0] if source.get('movimentos') else None
        }


# =============================================================================
# FUNÇÕES DE CONVENIÊNCIA
# =============================================================================

def buscar_processo(numero_processo: str, tribunal: Optional[str] = None, api_key: Optional[str] = None) -> Dict[str, Any]:
    """Busca processo pelo número (função de conveniência)"""
    client = DataJudCNJ(api_key=api_key)
    return client.buscar_processo(numero_processo, tribunal)


def buscar_por_parte(nome_parte: str, tribunal: Optional[str] = None, api_key: Optional[str] = None) -> Dict[str, Any]:
    """Busca processos por nome da parte (função de conveniência)"""
    client = DataJudCNJ(api_key=api_key)
    return client.buscar_por_parte(nome_parte, tribunal)


def buscar_por_documento(documento: str, tribunal: Optional[str] = None, api_key: Optional[str] = None) -> Dict[str, Any]:
    """Busca processos por CPF/CNPJ (função de conveniência)"""
    client = DataJudCNJ(api_key=api_key)
    return client.buscar_por_documento(documento, tribunal)


def buscar_movimentacoes(numero_processo: str, api_key: Optional[str] = None) -> Dict[str, Any]:
    """Busca movimentações de um processo (função de conveniência)"""
    client = DataJudCNJ(api_key=api_key)
    return client.buscar_movimentacoes(numero_processo)


# =============================================================================
# TESTE
# =============================================================================

if __name__ == '__main__':
    print("="*80)
    print("IAROM - Integração DataJud CNJ")
    print("="*80)
    print("\nTribunais suportados:", ', '.join(TRIBUNAIS.keys()))
    print("\nExemplos de uso:")
    print("  - buscar_processo('0000000-00.0000.0.00.0000')")
    print("  - buscar_por_parte('Nome da Parte', 'TJGO')")
    print("  - buscar_por_documento('000.000.000-00', 'TJSP')")
    print("  - buscar_movimentacoes('0000000-00.0000.0.00.0000')")
    print("\nNOTA: Configure DATAJUD_API_KEY nas variáveis de ambiente")
    print("Solicite sua chave em: https://datajud-wiki.cnj.jus.br/api-publica/")
    print("="*80)
