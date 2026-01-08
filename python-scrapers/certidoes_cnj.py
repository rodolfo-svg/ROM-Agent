"""
IAROM - Busca de Certidões de Publicação DJE/CNJ
Consulta de publicações em Diários de Justiça Eletrônicos

Busca em:
- DJE (Diário de Justiça Eletrônico) de cada tribunal
- Portal do CNJ
- Portais dos tribunais estaduais e federais
"""

import requests
import re
from typing import Dict, List, Optional, Any
from datetime import datetime, timedelta
from bs4 import BeautifulSoup

# URLs dos Diários Oficiais
DIARIOS = {
    # CNJ
    'CNJ': {
        'nome': 'Conselho Nacional de Justiça',
        'dje_url': 'https://www.cnj.jus.br/diario-oficial/',
        'certidao_url': 'https://www.cnj.jus.br/diario-oficial/certidao'
    },

    # Tribunais Superiores
    'STF': {
        'nome': 'Supremo Tribunal Federal',
        'dje_url': 'https://www.stf.jus.br/portal/diariojustica/',
        'pesquisa_url': 'https://www.stf.jus.br/portal/diariojustica/pesquisarPublicacao.asp'
    },
    'STJ': {
        'nome': 'Superior Tribunal de Justiça',
        'dje_url': 'https://www.stj.jus.br/publicacaoinstitucional/',
        'pesquisa_url': 'https://www.stj.jus.br/publicacaoinstitucional/index.php/pesquisa/getPublicacao'
    },
    'TST': {
        'nome': 'Tribunal Superior do Trabalho',
        'dje_url': 'https://www.tst.jus.br/diario-eletronico',
        'pesquisa_url': 'https://dejt.jt.jus.br/dejt/f/n/diariocon'
    },

    # TRFs
    'TRF1': {
        'nome': 'TRF da 1ª Região',
        'dje_url': 'https://www.trf1.jus.br/dspace/dje/',
        'pesquisa_url': 'https://www.trf1.jus.br/dspace/dje/pesquisa-processo'
    },
    'TRF2': {
        'nome': 'TRF da 2ª Região',
        'dje_url': 'https://www10.trf2.jus.br/diario-eletronico/',
        'pesquisa_url': 'https://www10.trf2.jus.br/diario-eletronico/pesquisa.aspx'
    },
    'TRF3': {
        'nome': 'TRF da 3ª Região',
        'dje_url': 'https://www.trf3.jus.br/documentos/dje/',
        'pesquisa_url': 'https://www.trf3.jus.br/documentos/dje/pesquisa'
    },
    'TRF4': {
        'nome': 'TRF da 4ª Região',
        'dje_url': 'https://www.trf4.jus.br/trf4/diario/',
        'pesquisa_url': 'https://www.trf4.jus.br/trf4/diario/pesquisa'
    },
    'TRF5': {
        'nome': 'TRF da 5ª Região',
        'dje_url': 'https://www4.trf5.jus.br/dje/',
        'pesquisa_url': 'https://www4.trf5.jus.br/dje/pesquisa_processo.php'
    },
    'TRF6': {
        'nome': 'TRF da 6ª Região',
        'dje_url': 'https://www.trf6.jus.br/trf6/diario-eletronico',
        'pesquisa_url': 'https://www.trf6.jus.br/trf6/diario-eletronico/pesquisa'
    },

    # Principais TJs
    'TJSP': {
        'nome': 'TJ de São Paulo',
        'dje_url': 'https://dje.tjsp.jus.br/',
        'pesquisa_url': 'https://dje.tjsp.jus.br/cdje/consultaSimples.do'
    },
    'TJRJ': {
        'nome': 'TJ do Rio de Janeiro',
        'dje_url': 'http://www4.tjrj.jus.br/DJERJ/',
        'pesquisa_url': 'http://www4.tjrj.jus.br/DJERJ/ConsultaAvancada.aspx'
    },
    'TJMG': {
        'nome': 'TJ de Minas Gerais',
        'dje_url': 'https://www8.tjmg.jus.br/dje/',
        'pesquisa_url': 'https://www8.tjmg.jus.br/dje/index.xhtml'
    },
    'TJRS': {
        'nome': 'TJ do Rio Grande do Sul',
        'dje_url': 'https://www.tjrs.jus.br/novo/diario-da-justica/edicoes/',
        'pesquisa_url': 'https://www.tjrs.jus.br/novo/diario-da-justica/'
    },
    'TJGO': {
        'nome': 'TJ de Goiás',
        'dje_url': 'https://projudi.tjgo.jus.br/BuscaArquivosPublicos',
        'pesquisa_url': 'https://projudi.tjgo.jus.br/BuscaArquivosPublicos'
    },
    'TJPR': {
        'nome': 'TJ do Paraná',
        'dje_url': 'https://www.tjpr.jus.br/diario-da-justica',
        'pesquisa_url': 'https://www.tjpr.jus.br/diario-da-justica'
    }
}


class CertidoesCNJ:
    """Cliente para busca de certidões de publicação em DJEs"""

    def __init__(self):
        """Inicializa cliente de certidões"""
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'pt-BR,pt;q=0.9',
        })

    def buscar_publicacao(
        self,
        numero_processo: str,
        tribunal: str,
        data_inicio: Optional[str] = None,
        data_fim: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Busca publicações de um processo no DJE

        Args:
            numero_processo: Número do processo
            tribunal: Sigla do tribunal (ex: 'TJSP', 'STJ')
            data_inicio: Data início (formato DD/MM/YYYY) - opcional
            data_fim: Data fim (formato DD/MM/YYYY) - opcional

        Returns:
            Dict com resultados da busca
        """
        tribunal_upper = tribunal.upper()

        if tribunal_upper not in DIARIOS:
            return {
                'sucesso': False,
                'erro': f'Tribunal {tribunal} não suportado',
                'tribunais_disponiveis': list(DIARIOS.keys())
            }

        info_tribunal = DIARIOS[tribunal_upper]

        # Por enquanto, retornar informações e URL para acesso manual
        # Implementação completa requer scraping específico para cada tribunal

        if not data_inicio:
            # Últimos 30 dias
            data_fim_dt = datetime.now()
            data_inicio_dt = data_fim_dt - timedelta(days=30)
            data_inicio = data_inicio_dt.strftime('%d/%m/%Y')
            data_fim = data_fim_dt.strftime('%d/%m/%Y')

        return {
            'sucesso': True,
            'processo': numero_processo,
            'tribunal': tribunal_upper,
            'nome_tribunal': info_tribunal['nome'],
            'dje_url': info_tribunal.get('dje_url'),
            'pesquisa_url': info_tribunal.get('pesquisa_url'),
            'periodo': {
                'inicio': data_inicio,
                'fim': data_fim
            },
            'instrucoes': [
                f"1. Acesse: {info_tribunal.get('pesquisa_url') or info_tribunal.get('dje_url')}",
                f"2. Busque pelo processo: {numero_processo}",
                f"3. Período: {data_inicio} a {data_fim}",
                "4. Gere certidão de publicação se disponível"
            ],
            'mensagem': 'URLs fornecidas. Para extração automática, implemente scraper específico do tribunal.'
        }

    def buscar_despachos_decisoes(
        self,
        numero_processo: str,
        tribunal: str,
        tipo: str = 'todos'  # 'despacho', 'decisao', 'sentenca', 'todos'
    ) -> Dict[str, Any]:
        """
        Busca despachos e decisões publicadas

        Args:
            numero_processo: Número do processo
            tribunal: Sigla do tribunal
            tipo: Tipo de publicação ('despacho', 'decisao', 'sentenca', 'todos')

        Returns:
            Dict com resultados
        """
        tribunal_upper = tribunal.upper()

        if tribunal_upper not in DIARIOS:
            return {
                'sucesso': False,
                'erro': f'Tribunal {tribunal} não suportado'
            }

        info_tribunal = DIARIOS[tribunal_upper]

        return {
            'sucesso': True,
            'processo': numero_processo,
            'tribunal': tribunal_upper,
            'tipo': tipo,
            'dje_url': info_tribunal.get('dje_url'),
            'pesquisa_url': info_tribunal.get('pesquisa_url'),
            'instrucoes': [
                f"Acesse o DJE do {info_tribunal['nome']}",
                f"Busque publicações do processo {numero_processo}",
                f"Filtre por tipo: {tipo}",
                "Baixe PDFs das publicações encontradas"
            ],
            'mensagem': 'Para busca automática, implemente scraper específico do tribunal'
        }

    def obter_certidao_cnj(
        self,
        numero_processo: str,
        tipo_certidao: str = 'publicacao'
    ) -> Dict[str, Any]:
        """
        Obtém certidão do CNJ

        Args:
            numero_processo: Número do processo
            tipo_certidao: Tipo ('publicacao', 'transito_julgado', 'objeto', 'tempo')

        Returns:
            Dict com informações da certidão
        """
        return {
            'sucesso': True,
            'processo': numero_processo,
            'tipo': tipo_certidao,
            'url_certidao': f"{DIARIOS['CNJ']['certidao_url']}?processo={numero_processo}&tipo={tipo_certidao}",
            'instrucoes': [
                "1. A certidão do CNJ consolida informações de todos os graus de jurisdição",
                "2. Acesse o portal CNJ e solicite a certidão",
                "3. A certidão será gerada em PDF assinado digitalmente",
                "4. Tipos disponíveis: publicação, trânsito em julgado, objeto, tempo de tramitação"
            ],
            'portal_cnj': DIARIOS['CNJ']['dje_url']
        }

    def listar_diarios_disponiveis(self) -> Dict[str, Any]:
        """
        Lista todos os diários disponíveis para consulta

        Returns:
            Dict com lista de diários
        """
        diarios_lista = []

        for sigla, info in DIARIOS.items():
            diarios_lista.append({
                'sigla': sigla,
                'nome': info['nome'],
                'dje_url': info.get('dje_url'),
                'tem_pesquisa': bool(info.get('pesquisa_url'))
            })

        return {
            'sucesso': True,
            'total': len(diarios_lista),
            'diarios': diarios_lista
        }

    def verificar_publicacao_recente(
        self,
        numero_processo: str,
        tribunal: str,
        dias: int = 7
    ) -> Dict[str, Any]:
        """
        Verifica se há publicações recentes (últimos N dias)

        Args:
            numero_processo: Número do processo
            tribunal: Sigla do tribunal
            dias: Número de dias para verificar (padrão: 7)

        Returns:
            Dict com resultado da verificação
        """
        data_fim = datetime.now()
        data_inicio = data_fim - timedelta(days=dias)

        return self.buscar_publicacao(
            numero_processo,
            tribunal,
            data_inicio.strftime('%d/%m/%Y'),
            data_fim.strftime('%d/%m/%Y')
        )


# =============================================================================
# FUNÇÕES DE CONVENIÊNCIA
# =============================================================================

def buscar_publicacao(numero_processo: str, tribunal: str) -> Dict[str, Any]:
    """Busca publicação (função de conveniência)"""
    client = CertidoesCNJ()
    return client.buscar_publicacao(numero_processo, tribunal)


def buscar_despachos(numero_processo: str, tribunal: str) -> Dict[str, Any]:
    """Busca despachos e decisões (função de conveniência)"""
    client = CertidoesCNJ()
    return client.buscar_despachos_decisoes(numero_processo, tribunal)


def obter_certidao(numero_processo: str) -> Dict[str, Any]:
    """Obtém certidão do CNJ (função de conveniência)"""
    client = CertidoesCNJ()
    return client.obter_certidao_cnj(numero_processo)


def listar_diarios() -> Dict[str, Any]:
    """Lista diários disponíveis (função de conveniência)"""
    client = CertidoesCNJ()
    return client.listar_diarios_disponiveis()


# =============================================================================
# TESTE
# =============================================================================

if __name__ == '__main__':
    print("="*80)
    print("IAROM - Busca de Certidões e Publicações DJE/CNJ")
    print("="*80)

    client = CertidoesCNJ()

    print("\n📋 Diários Disponíveis:")
    diarios = client.listar_diarios_disponiveis()
    for diario in diarios['diarios'][:10]:
        print(f"  - {diario['sigla']}: {diario['nome']}")
        print(f"    URL: {diario['dje_url']}")
        print(f"    Pesquisa: {'✓' if diario['tem_pesquisa'] else '✗'}")

    print(f"\nTotal: {diarios['total']} tribunais")

    print("\n💡 Exemplos de uso:")
    print("  - buscar_publicacao('0000000-00.0000.0.00.0000', 'TJSP')")
    print("  - buscar_despachos('0000000-00.0000.0.00.0000', 'STJ', tipo='decisao')")
    print("  - obter_certidao('0000000-00.0000.0.00.0000')")

    print("\n" + "="*80)
