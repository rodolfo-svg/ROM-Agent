#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
MÓDULO DE ANÁLISE AVANÇADA DE VÍCIOS PROCESSUAIS
Sistema IAROM Extrator v3.0

FUNCIONALIDADES:
- Identificação de nulidades (absolutas e relativas)
- Detecção de omissões judiciais
- Análise de erro in procedendo
- Detecção de teratologia jurídica
- Análise de coisa julgada (material e formal)
- Identificação de pedidos pendentes
- Mapeamento de peças pendentes de análise

FORMATO DE SAÍDA:
- Arquivo TXT detalhado com referências a movimentos e folhas
- Transcrições das partes relevantes
- Fundamentação jurídica
"""

import re
import os
from typing import List, Dict, Tuple
from datetime import datetime


class AnalisadorViciosAvancado:
    """
    Analisador avançado de vícios processuais
    """

    def __init__(self):
        self.vicios_identificados = []
        self.omissoes = []
        self.nulidades = []
        self.pedidos_pendentes = []
        self.pecas_pendentes = []
        self.coisa_julgada = []
        self.teratologias = []
        self.erro_in_procedendo = []

    def analisar_texto_completo(self, texto: str, movimentos: List[Dict], numero_processo: str) -> Dict:
        """
        Análise completa do texto processual
        """
        print("\n" + "="*80)
        print("ANÁLISE AVANÇADA DE VÍCIOS PROCESSUAIS")
        print("="*80)

        # Executar todas as análises
        self._identificar_nulidades(texto, movimentos)
        self._identificar_omissoes(texto, movimentos)
        self._identificar_erro_in_procedendo(texto, movimentos)
        self._identificar_teratologias(texto, movimentos)
        self._analisar_coisa_julgada(texto, movimentos)
        self._identificar_pedidos_pendentes(texto, movimentos)
        self._identificar_pecas_pendentes(texto, movimentos)

        # Gerar relatório
        return self._gerar_relatorio_completo(numero_processo)

    def _identificar_nulidades(self, texto: str, movimentos: List[Dict]):
        """
        Identifica nulidades absolutas e relativas
        """
        print("🔍 [1/7] Identificando nulidades...")

        # Padrões de nulidades absolutas (ordem pública)
        padroes_nulidade_absoluta = [
            {
                'nome': 'Falta de citação válida',
                'padrao': r'(?:ausência|falta|sem).*citação|citação.*(?:inválida|nula)',
                'fundamento': 'Art. 239, §1º, CPC - Nulidade absoluta',
                'tipo': 'NULIDADE ABSOLUTA'
            },
            {
                'nome': 'Incompetência absoluta',
                'padrao': r'incompetência\s+absoluta|competência.*ordem\s+pública',
                'fundamento': 'Art. 64, §1º, CPC - Ordem pública',
                'tipo': 'NULIDADE ABSOLUTA'
            },
            {
                'nome': 'Suspeição ou impedimento do juiz',
                'padrao': r'(?:suspeição|impedimento).*juiz|juiz.*(?:suspeito|impedido)',
                'fundamento': 'Art. 144 e 145, CPC - Ordem pública',
                'tipo': 'NULIDADE ABSOLUTA'
            },
            {
                'nome': 'Falta de fundamentação',
                'padrao': r'(?:ausência|falta|sem).*fundamentação|decisão.*(?:imotivada|sem\s+motivação)',
                'fundamento': 'Art. 93, IX, CF - Nulidade absoluta',
                'tipo': 'NULIDADE ABSOLUTA'
            },
            {
                'nome': 'Violação ao contraditório',
                'padrao': r'violação.*contraditório|contraditório.*violado|sem\s+(?:oitiva|oportunidade)',
                'fundamento': 'Art. 5º, LV, CF c/c Art. 9º, CPC',
                'tipo': 'NULIDADE ABSOLUTA'
            }
        ]

        # Padrões de nulidades relativas
        padroes_nulidade_relativa = [
            {
                'nome': 'Intimação irregular de advogado',
                'padrao': r'intimação.*irregular|intimação.*(?:inválida|nula)',
                'fundamento': 'Art. 279, CPC - Nulidade relativa',
                'tipo': 'NULIDADE RELATIVA'
            },
            {
                'nome': 'Citação por edital sem esgotamento de meios',
                'padrao': r'citação.*edital.*(?:prematura|irregular)',
                'fundamento': 'Art. 256, §1º, CPC - Nulidade relativa',
                'tipo': 'NULIDADE RELATIVA'
            },
            {
                'nome': 'Ausência de intimação para manifestação',
                'padrao': r'(?:sem|não).*intimad[oa].*(?:manifestar|pronunciar)',
                'fundamento': 'Art. 9º, CPC - Nulidade relativa',
                'tipo': 'NULIDADE RELATIVA'
            }
        ]

        # Buscar nulidades absolutas
        for padrao_dict in padroes_nulidade_absoluta:
            for match in re.finditer(padrao_dict['padrao'], texto, re.IGNORECASE):
                self._extrair_vicio(
                    texto, match, movimentos,
                    padrao_dict['nome'],
                    padrao_dict['fundamento'],
                    padrao_dict['tipo'],
                    'nulidades'
                )

        # Buscar nulidades relativas
        for padrao_dict in padroes_nulidade_relativa:
            for match in re.finditer(padrao_dict['padrao'], texto, re.IGNORECASE):
                self._extrair_vicio(
                    texto, match, movimentos,
                    padrao_dict['nome'],
                    padrao_dict['fundamento'],
                    padrao_dict['tipo'],
                    'nulidades'
                )

        print(f"   ✅ {len(self.nulidades)} nulidades identificadas")

    def _identificar_omissoes(self, texto: str, movimentos: List[Dict]):
        """
        Identifica omissões judiciais (base para embargos de declaração)
        """
        print("🔍 [2/7] Identificando omissões...")

        padroes_omissao = [
            {
                'nome': 'Omissão sobre pedido',
                'padrao': r'(?:omissão|silêncio|não\s+analisou).*(?:pedido|pleito|requerimento)',
                'fundamento': 'Art. 1.022, I, CPC - Omissão',
                'tipo': 'OMISSÃO'
            },
            {
                'nome': 'Omissão sobre alegação',
                'padrao': r'(?:omissão|silêncio|não\s+analisou).*(?:alegação|argumento|tese)',
                'fundamento': 'Art. 1.022, I, CPC - Omissão',
                'tipo': 'OMISSÃO'
            },
            {
                'nome': 'Omissão sobre questão prejudicial',
                'padrao': r'(?:omissão|silêncio).*(?:prejudicial|preliminar)',
                'fundamento': 'Art. 1.022, I, CPC - Omissão',
                'tipo': 'OMISSÃO'
            },
            {
                'nome': 'Falta de pronunciamento sobre prova',
                'padrao': r'(?:não\s+analisou|silêncio|omitiu).*prova',
                'fundamento': 'Art. 1.022, I, CPC - Omissão',
                'tipo': 'OMISSÃO'
            },
            {
                'nome': 'Impugnação não analisada',
                'padrao': r'impugnação.*(?:pendente|não\s+analisada|sem\s+análise)',
                'fundamento': 'Art. 1.022, I, CPC - Omissão',
                'tipo': 'OMISSÃO'
            }
        ]

        for padrao_dict in padroes_omissao:
            for match in re.finditer(padrao_dict['padrao'], texto, re.IGNORECASE):
                self._extrair_vicio(
                    texto, match, movimentos,
                    padrao_dict['nome'],
                    padrao_dict['fundamento'],
                    padrao_dict['tipo'],
                    'omissoes'
                )

        print(f"   ✅ {len(self.omissoes)} omissões identificadas")

    def _identificar_erro_in_procedendo(self, texto: str, movimentos: List[Dict]):
        """
        Identifica erro in procedendo (erro de procedimento)
        """
        print("🔍 [3/7] Identificando erro in procedendo...")

        padroes_erro_procedendo = [
            {
                'nome': 'Julgamento antecipado indevido',
                'padrao': r'julgamento\s+antecipado.*(?:indevido|irregular)|cerceamento.*defesa',
                'fundamento': 'Art. 355, CPC - Erro de procedimento',
                'tipo': 'ERRO IN PROCEDENDO'
            },
            {
                'nome': 'Inversão da ordem processual',
                'padrao': r'inversão.*ordem|ordem.*invertida|procedimento.*irregular',
                'fundamento': 'Art. 214, §2º, CPC - Nulidade',
                'tipo': 'ERRO IN PROCEDENDO'
            },
            {
                'nome': 'Prosseguimento sem cumprimento de diligência',
                'padrao': r'prosseguiu.*sem.*(?:diligência|providência|determinação)',
                'fundamento': 'Erro de procedimento',
                'tipo': 'ERRO IN PROCEDENDO'
            },
            {
                'nome': 'Descumprimento de decisão anterior',
                'padrao': r'descumpriu.*decisão|decisão.*descumprida|não\s+observou.*determinação',
                'fundamento': 'Art. 502, CPC - Desrespeito à preclusão',
                'tipo': 'ERRO IN PROCEDENDO'
            }
        ]

        for padrao_dict in padroes_erro_procedendo:
            for match in re.finditer(padrao_dict['padrao'], texto, re.IGNORECASE):
                self._extrair_vicio(
                    texto, match, movimentos,
                    padrao_dict['nome'],
                    padrao_dict['fundamento'],
                    padrao_dict['tipo'],
                    'erro_in_procedendo'
                )

        print(f"   ✅ {len(self.erro_in_procedendo)} erros in procedendo identificados")

    def _identificar_teratologias(self, texto: str, movimentos: List[Dict]):
        """
        Identifica teratologias jurídicas (decisões absurdas)
        """
        print("🔍 [4/7] Identificando teratologias...")

        padroes_teratologia = [
            {
                'nome': 'Contradição interna manifesta',
                'padrao': r'contradição.*(?:manifesta|evidente|flagrante)',
                'fundamento': 'Art. 1.022, III, CPC - Contradição',
                'tipo': 'TERATOLOGIA'
            },
            {
                'nome': 'Decisão absurda ou impossível',
                'padrao': r'decisão.*(?:absurda|impossível|inviável)|impossibilidade.*física',
                'fundamento': 'Teratologia jurídica',
                'tipo': 'TERATOLOGIA'
            },
            {
                'nome': 'Violação direta à lei',
                'padrao': r'violação.*(?:direta|frontal|expressa).*lei',
                'fundamento': 'Teratologia jurídica',
                'tipo': 'TERATOLOGIA'
            },
            {
                'nome': 'Negativa de vigência a lei federal',
                'padrao': r'negou\s+vigência.*lei\s+federal|negativa.*vigência',
                'fundamento': 'Art. 105, III, "a", CF - Recurso Especial',
                'tipo': 'TERATOLOGIA'
            }
        ]

        for padrao_dict in padroes_teratologia:
            for match in re.finditer(padrao_dict['padrao'], texto, re.IGNORECASE):
                self._extrair_vicio(
                    texto, match, movimentos,
                    padrao_dict['nome'],
                    padrao_dict['fundamento'],
                    padrao_dict['tipo'],
                    'teratologias'
                )

        print(f"   ✅ {len(self.teratologias)} teratologias identificadas")

    def _analisar_coisa_julgada(self, texto: str, movimentos: List[Dict]):
        """
        Analisa coisa julgada material e formal
        """
        print("🔍 [5/7] Analisando coisa julgada...")

        padroes_coisa_julgada = [
            {
                'nome': 'Coisa julgada material',
                'padrao': r'coisa\s+julgada\s+material|trânsito.*julgado.*mérito',
                'fundamento': 'Art. 502, CPC - Coisa julgada material',
                'tipo': 'COISA JULGADA MATERIAL',
                'subtipo': 'material'
            },
            {
                'nome': 'Coisa julgada formal',
                'padrao': r'coisa\s+julgada\s+formal|trânsito.*julgado.*(?:sem\s+mérito|processual)',
                'fundamento': 'Art. 505, CPC - Coisa julgada formal',
                'tipo': 'COISA JULGADA FORMAL',
                'subtipo': 'formal'
            },
            {
                'nome': 'Violação à coisa julgada',
                'padrao': r'violação.*coisa\s+julgada|coisa\s+julgada.*violada|rediscussão.*mérito',
                'fundamento': 'Art. 505, CPC - Violação à coisa julgada',
                'tipo': 'VIOLAÇÃO À COISA JULGADA',
                'subtipo': 'violacao'
            },
            {
                'nome': 'Rescisão de coisa julgada',
                'padrao': r'ação\s+rescisória|rescisão.*(?:julgado|sentença)',
                'fundamento': 'Art. 966, CPC - Ação Rescisória',
                'tipo': 'RESCISÃO',
                'subtipo': 'rescisao'
            }
        ]

        for padrao_dict in padroes_coisa_julgada:
            for match in re.finditer(padrao_dict['padrao'], texto, re.IGNORECASE):
                vicio = self._extrair_vicio(
                    texto, match, movimentos,
                    padrao_dict['nome'],
                    padrao_dict['fundamento'],
                    padrao_dict['tipo'],
                    'coisa_julgada'
                )
                if vicio:
                    vicio['subtipo'] = padrao_dict['subtipo']

        print(f"   ✅ {len(self.coisa_julgada)} ocorrências de coisa julgada analisadas")

    def _identificar_pedidos_pendentes(self, texto: str, movimentos: List[Dict]):
        """
        Identifica pedidos ainda não analisados
        """
        print("🔍 [6/7] Identificando pedidos pendentes...")

        padroes_pedidos_pendentes = [
            {
                'nome': 'Pedido não decidido',
                'padrao': r'pedido.*(?:pendente|não\s+decidido|aguardando)',
                'fundamento': 'Art. 492, CPC - Dever de decidir',
                'tipo': 'PEDIDO PENDENTE'
            },
            {
                'nome': 'Requerimento sem resposta',
                'padrao': r'requerimento.*(?:pendente|sem\s+resposta|não\s+apreciado)',
                'fundamento': 'Art. 492, CPC - Dever de decidir',
                'tipo': 'PEDIDO PENDENTE'
            },
            {
                'nome': 'Tutela não apreciada',
                'padrao': r'tutela.*(?:pendente|não\s+apreciada|aguardando)',
                'fundamento': 'Art. 300, CPC - Tutela de urgência',
                'tipo': 'PEDIDO PENDENTE'
            }
        ]

        for padrao_dict in padroes_pedidos_pendentes:
            for match in re.finditer(padrao_dict['padrao'], texto, re.IGNORECASE):
                self._extrair_vicio(
                    texto, match, movimentos,
                    padrao_dict['nome'],
                    padrao_dict['fundamento'],
                    padrao_dict['tipo'],
                    'pedidos_pendentes'
                )

        print(f"   ✅ {len(self.pedidos_pendentes)} pedidos pendentes identificados")

    def _identificar_pecas_pendentes(self, texto: str, movimentos: List[Dict]):
        """
        Identifica peças processuais pendentes de análise
        """
        print("🔍 [7/7] Identificando peças pendentes de análise...")

        padroes_pecas_pendentes = [
            {
                'nome': 'Contestação não apreciada',
                'padrao': r'contestação.*(?:pendente|não\s+apreciada|sem\s+análise)',
                'fundamento': 'Art. 336, CPC - Dever de analisar defesa',
                'tipo': 'PEÇA PENDENTE'
            },
            {
                'nome': 'Recurso não julgado',
                'padrao': r'(?:agravo|apelação|recurso).*(?:pendente|não\s+julgado|aguardando)',
                'fundamento': 'Art. 489, CPC - Dever de julgar',
                'tipo': 'PEÇA PENDENTE'
            },
            {
                'nome': 'Impugnação ao valor da causa pendente',
                'padrao': r'impugnação.*valor.*(?:pendente|não\s+decidida)',
                'fundamento': 'Art. 293, CPC - Impugnação ao valor',
                'tipo': 'PEÇA PENDENTE'
            },
            {
                'nome': 'Embargos de declaração não julgados',
                'padrao': r'embargos\s+(?:de\s+)?declaração.*(?:pendente|não\s+julgado)',
                'fundamento': 'Art. 1.023, CPC - Embargos de declaração',
                'tipo': 'PEÇA PENDENTE'
            }
        ]

        for padrao_dict in padroes_pecas_pendentes:
            for match in re.finditer(padrao_dict['padrao'], texto, re.IGNORECASE):
                self._extrair_vicio(
                    texto, match, movimentos,
                    padrao_dict['nome'],
                    padrao_dict['fundamento'],
                    padrao_dict['tipo'],
                    'pecas_pendentes'
                )

        print(f"   ✅ {len(self.pecas_pendentes)} peças pendentes identificadas")

    def _extrair_vicio(self, texto: str, match, movimentos: List[Dict],
                      nome: str, fundamento: str, tipo: str, categoria: str) -> Dict:
        """
        Extrai informações completas sobre um vício identificado
        """
        # Posição no texto
        inicio = match.start()
        fim = match.end()

        # Contexto expandido (300 caracteres antes e depois)
        contexto_inicio = max(0, inicio - 300)
        contexto_fim = min(len(texto), fim + 300)
        contexto = texto[contexto_inicio:contexto_fim]

        # Tentar identificar movimento relacionado
        movimento_relacionado = self._identificar_movimento_relacionado(inicio, movimentos)

        # Tentar extrair referência a folhas
        folhas = self._extrair_referencias_folhas(contexto)

        # Criar objeto do vício
        vicio = {
            'id': f"{categoria.upper()}_{len(getattr(self, categoria)) + 1:03d}",
            'nome': nome,
            'tipo': tipo,
            'fundamento': fundamento,
            'categoria': categoria,
            'texto_identificado': match.group(0),
            'contexto': contexto,
            'posicao': {
                'inicio': inicio,
                'fim': fim
            },
            'movimento_relacionado': movimento_relacionado,
            'folhas': folhas,
            'data_identificacao': datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        }

        # Adicionar à lista apropriada
        getattr(self, categoria).append(vicio)

        return vicio

    def _identificar_movimento_relacionado(self, posicao: int, movimentos: List[Dict]) -> Dict:
        """
        Identifica o movimento processual relacionado ao vício
        """
        # Implementação simplificada - pode ser melhorada com análise de distância
        if movimentos and len(movimentos) > 0:
            # Por enquanto, retorna movimento mais próximo
            return {
                'descricao': movimentos[0].get('descricao', 'Não identificado'),
                'linha': movimentos[0].get('linha', 0)
            }
        return {'descricao': 'Não identificado', 'linha': 0}

    def _extrair_referencias_folhas(self, contexto: str) -> List[str]:
        """
        Extrai referências a folhas/páginas do processo
        """
        folhas = []

        # Padrões de referência a folhas
        padroes = [
            r'(?:fls?\.?|folhas?|pág(?:ina)?s?\.?)\s*(\d+(?:\s*[-/]\s*\d+)?)',
            r'(?:fl?s?\.?|folhas?)\s*(\d+)',
            r'evento\s+(\d+)',
            r'ID\s+(\d+)'
        ]

        for padrao in padroes:
            for match in re.finditer(padrao, contexto, re.IGNORECASE):
                folhas.append(match.group(0))

        return list(set(folhas))  # Remover duplicatas

    def _gerar_relatorio_completo(self, numero_processo: str) -> Dict:
        """
        Gera relatório completo consolidado
        """
        print("\n📊 Gerando relatório consolidado...")

        relatorio = {
            'numero_processo': numero_processo,
            'data_analise': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
            'resumo': {
                'nulidades': len(self.nulidades),
                'omissoes': len(self.omissoes),
                'erro_in_procedendo': len(self.erro_in_procedendo),
                'teratologias': len(self.teratologias),
                'coisa_julgada': len(self.coisa_julgada),
                'pedidos_pendentes': len(self.pedidos_pendentes),
                'pecas_pendentes': len(self.pecas_pendentes),
                'total_vicios': (len(self.nulidades) + len(self.omissoes) +
                               len(self.erro_in_procedendo) + len(self.teratologias) +
                               len(self.coisa_julgada) + len(self.pedidos_pendentes) +
                               len(self.pecas_pendentes))
            },
            'detalhamento': {
                'nulidades': self.nulidades,
                'omissoes': self.omissoes,
                'erro_in_procedendo': self.erro_in_procedendo,
                'teratologias': self.teratologias,
                'coisa_julgada': self.coisa_julgada,
                'pedidos_pendentes': self.pedidos_pendentes,
                'pecas_pendentes': self.pecas_pendentes
            }
        }

        print(f"   ✅ Relatório gerado: {relatorio['resumo']['total_vicios']} vícios identificados")

        return relatorio

    def salvar_relatorio_txt(self, relatorio: Dict, pasta_saida: str):
        """
        Salva relatório em formato TXT detalhado
        """
        caminho = os.path.join(pasta_saida, '07_Analises_Juridicas', 'ANALISE_COMPLETA_VICIOS_PROCESSUAIS.txt')

        with open(caminho, 'w', encoding='utf-8') as f:
            self._escrever_cabecalho(f, relatorio)
            self._escrever_resumo(f, relatorio)
            self._escrever_nulidades(f, relatorio)
            self._escrever_omissoes(f, relatorio)
            self._escrever_erro_procedendo(f, relatorio)
            self._escrever_teratologias(f, relatorio)
            self._escrever_coisa_julgada(f, relatorio)
            self._escrever_pedidos_pendentes(f, relatorio)
            self._escrever_pecas_pendentes(f, relatorio)
            self._escrever_rodape(f)

        print(f"\n✅ Relatório salvo em: {caminho}")

    def _escrever_cabecalho(self, f, relatorio: Dict):
        """Escreve cabeçalho do relatório"""
        f.write("="*100 + "\n")
        f.write("ANÁLISE COMPLETA DE VÍCIOS PROCESSUAIS\n")
        f.write("="*100 + "\n\n")
        f.write(f"Processo: {relatorio['numero_processo']}\n")
        f.write(f"Data da análise: {relatorio['data_analise']}\n")
        f.write(f"Sistema: IAROM Extrator Processual v3.0\n")
        f.write("\n")

    def _escrever_resumo(self, f, relatorio: Dict):
        """Escreve resumo executivo"""
        f.write("─"*100 + "\n")
        f.write("RESUMO EXECUTIVO\n")
        f.write("─"*100 + "\n\n")

        resumo = relatorio['resumo']
        f.write(f"Total de vícios identificados: {resumo['total_vicios']}\n\n")
        f.write(f"  • Nulidades: {resumo['nulidades']}\n")
        f.write(f"  • Omissões: {resumo['omissoes']}\n")
        f.write(f"  • Erro in procedendo: {resumo['erro_in_procedendo']}\n")
        f.write(f"  • Teratologias: {resumo['teratologias']}\n")
        f.write(f"  • Coisa julgada: {resumo['coisa_julgada']}\n")
        f.write(f"  • Pedidos pendentes: {resumo['pedidos_pendentes']}\n")
        f.write(f"  • Peças pendentes: {resumo['pecas_pendentes']}\n")
        f.write("\n")

    def _escrever_nulidades(self, f, relatorio: Dict):
        """Escreve seção de nulidades"""
        nulidades = relatorio['detalhamento']['nulidades']

        if not nulidades:
            return

        f.write("\n" + "="*100 + "\n")
        f.write(f"NULIDADES IDENTIFICADAS ({len(nulidades)})\n")
        f.write("="*100 + "\n\n")

        for i, nul in enumerate(nulidades, 1):
            f.write(f"{'─'*100}\n")
            f.write(f"NULIDADE {i:03d} - {nul['nome']}\n")
            f.write(f"{'─'*100}\n")
            f.write(f"ID: {nul['id']}\n")
            f.write(f"Tipo: {nul['tipo']}\n")
            f.write(f"Fundamento: {nul['fundamento']}\n")
            f.write(f"Texto identificado: \"{nul['texto_identificado']}\"\n\n")

            if nul['folhas']:
                f.write(f"Referências a folhas: {', '.join(nul['folhas'])}\n\n")

            f.write(f"Movimento relacionado:\n")
            f.write(f"  {nul['movimento_relacionado']['descricao']}\n\n")

            f.write(f"Contexto (transcrição):\n")
            f.write(f"{'─'*100}\n")
            f.write(f"{nul['contexto']}\n")
            f.write(f"{'─'*100}\n\n")

    def _escrever_omissoes(self, f, relatorio: Dict):
        """Escreve seção de omissões"""
        omissoes = relatorio['detalhamento']['omissoes']

        if not omissoes:
            return

        f.write("\n" + "="*100 + "\n")
        f.write(f"OMISSÕES IDENTIFICADAS ({len(omissoes)})\n")
        f.write("="*100 + "\n\n")

        for i, om in enumerate(omissoes, 1):
            f.write(f"{'─'*100}\n")
            f.write(f"OMISSÃO {i:03d} - {om['nome']}\n")
            f.write(f"{'─'*100}\n")
            f.write(f"ID: {om['id']}\n")
            f.write(f"Fundamento: {om['fundamento']}\n")
            f.write(f"Texto identificado: \"{om['texto_identificado']}\"\n\n")

            if om['folhas']:
                f.write(f"Referências a folhas: {', '.join(om['folhas'])}\n\n")

            f.write(f"Movimento relacionado:\n")
            f.write(f"  {om['movimento_relacionado']['descricao']}\n\n")

            f.write(f"Contexto (transcrição):\n")
            f.write(f"{'─'*100}\n")
            f.write(f"{om['contexto']}\n")
            f.write(f"{'─'*100}\n\n")

    def _escrever_erro_procedendo(self, f, relatorio: Dict):
        """Escreve seção de erro in procedendo"""
        erros = relatorio['detalhamento']['erro_in_procedendo']

        if not erros:
            return

        f.write("\n" + "="*100 + "\n")
        f.write(f"ERRO IN PROCEDENDO ({len(erros)})\n")
        f.write("="*100 + "\n\n")

        for i, erro in enumerate(erros, 1):
            f.write(f"{'─'*100}\n")
            f.write(f"ERRO {i:03d} - {erro['nome']}\n")
            f.write(f"{'─'*100}\n")
            f.write(f"ID: {erro['id']}\n")
            f.write(f"Fundamento: {erro['fundamento']}\n")
            f.write(f"Texto identificado: \"{erro['texto_identificado']}\"\n\n")

            if erro['folhas']:
                f.write(f"Referências a folhas: {', '.join(erro['folhas'])}\n\n")

            f.write(f"Movimento relacionado:\n")
            f.write(f"  {erro['movimento_relacionado']['descricao']}\n\n")

            f.write(f"Contexto (transcrição):\n")
            f.write(f"{'─'*100}\n")
            f.write(f"{erro['contexto']}\n")
            f.write(f"{'─'*100}\n\n")

    def _escrever_teratologias(self, f, relatorio: Dict):
        """Escreve seção de teratologias"""
        terat = relatorio['detalhamento']['teratologias']

        if not terat:
            return

        f.write("\n" + "="*100 + "\n")
        f.write(f"TERATOLOGIAS JURÍDICAS ({len(terat)})\n")
        f.write("="*100 + "\n\n")

        for i, t in enumerate(terat, 1):
            f.write(f"{'─'*100}\n")
            f.write(f"TERATOLOGIA {i:03d} - {t['nome']}\n")
            f.write(f"{'─'*100}\n")
            f.write(f"ID: {t['id']}\n")
            f.write(f"Fundamento: {t['fundamento']}\n")
            f.write(f"Texto identificado: \"{t['texto_identificado']}\"\n\n")

            if t['folhas']:
                f.write(f"Referências a folhas: {', '.join(t['folhas'])}\n\n")

            f.write(f"Movimento relacionado:\n")
            f.write(f"  {t['movimento_relacionado']['descricao']}\n\n")

            f.write(f"Contexto (transcrição):\n")
            f.write(f"{'─'*100}\n")
            f.write(f"{t['contexto']}\n")
            f.write(f"{'─'*100}\n\n")

    def _escrever_coisa_julgada(self, f, relatorio: Dict):
        """Escreve seção de coisa julgada"""
        cj = relatorio['detalhamento']['coisa_julgada']

        if not cj:
            return

        f.write("\n" + "="*100 + "\n")
        f.write(f"COISA JULGADA - ANÁLISE ({len(cj)})\n")
        f.write("="*100 + "\n\n")

        for i, c in enumerate(cj, 1):
            f.write(f"{'─'*100}\n")
            f.write(f"COISA JULGADA {i:03d} - {c['nome']}\n")
            f.write(f"{'─'*100}\n")
            f.write(f"ID: {c['id']}\n")
            f.write(f"Tipo: {c['tipo']}\n")
            f.write(f"Subtipo: {c.get('subtipo', 'N/A')}\n")
            f.write(f"Fundamento: {c['fundamento']}\n")
            f.write(f"Texto identificado: \"{c['texto_identificado']}\"\n\n")

            if c['folhas']:
                f.write(f"Referências a folhas: {', '.join(c['folhas'])}\n\n")

            f.write(f"Movimento relacionado:\n")
            f.write(f"  {c['movimento_relacionado']['descricao']}\n\n")

            f.write(f"Contexto (transcrição):\n")
            f.write(f"{'─'*100}\n")
            f.write(f"{c['contexto']}\n")
            f.write(f"{'─'*100}\n\n")

    def _escrever_pedidos_pendentes(self, f, relatorio: Dict):
        """Escreve seção de pedidos pendentes"""
        pedidos = relatorio['detalhamento']['pedidos_pendentes']

        if not pedidos:
            return

        f.write("\n" + "="*100 + "\n")
        f.write(f"PEDIDOS PENDENTES DE ANÁLISE ({len(pedidos)})\n")
        f.write("="*100 + "\n\n")

        for i, ped in enumerate(pedidos, 1):
            f.write(f"{'─'*100}\n")
            f.write(f"PEDIDO PENDENTE {i:03d} - {ped['nome']}\n")
            f.write(f"{'─'*100}\n")
            f.write(f"ID: {ped['id']}\n")
            f.write(f"Fundamento: {ped['fundamento']}\n")
            f.write(f"Texto identificado: \"{ped['texto_identificado']}\"\n\n")

            if ped['folhas']:
                f.write(f"Referências a folhas: {', '.join(ped['folhas'])}\n\n")

            f.write(f"Movimento relacionado:\n")
            f.write(f"  {ped['movimento_relacionado']['descricao']}\n\n")

            f.write(f"Contexto (transcrição):\n")
            f.write(f"{'─'*100}\n")
            f.write(f"{ped['contexto']}\n")
            f.write(f"{'─'*100}\n\n")

    def _escrever_pecas_pendentes(self, f, relatorio: Dict):
        """Escreve seção de peças pendentes"""
        pecas = relatorio['detalhamento']['pecas_pendentes']

        if not pecas:
            return

        f.write("\n" + "="*100 + "\n")
        f.write(f"PEÇAS PENDENTES DE ANÁLISE ({len(pecas)})\n")
        f.write("="*100 + "\n\n")

        for i, pec in enumerate(pecas, 1):
            f.write(f"{'─'*100}\n")
            f.write(f"PEÇA PENDENTE {i:03d} - {pec['nome']}\n")
            f.write(f"{'─'*100}\n")
            f.write(f"ID: {pec['id']}\n")
            f.write(f"Fundamento: {pec['fundamento']}\n")
            f.write(f"Texto identificado: \"{pec['texto_identificado']}\"\n\n")

            if pec['folhas']:
                f.write(f"Referências a folhas: {', '.join(pec['folhas'])}\n\n")

            f.write(f"Movimento relacionado:\n")
            f.write(f"  {pec['movimento_relacionado']['descricao']}\n\n")

            f.write(f"Contexto (transcrição):\n")
            f.write(f"{'─'*100}\n")
            f.write(f"{pec['contexto']}\n")
            f.write(f"{'─'*100}\n\n")

    def _escrever_rodape(self, f):
        """Escreve rodapé do relatório"""
        f.write("\n" + "="*100 + "\n")
        f.write("FIM DA ANÁLISE\n")
        f.write("="*100 + "\n\n")
        f.write("IMPORTANTE:\n")
        f.write("- Este relatório é gerado automaticamente por IA\n")
        f.write("- Recomenda-se revisão por profissional jurídico\n")
        f.write("- As fundamentações são sugestivas e devem ser validadas\n")
        f.write("- Análise baseada em padrões textuais e pode conter falsos positivos\n\n")
        f.write("Sistema: IAROM Extrator Processual v3.0\n")
        f.write("© 2025 IAROM - Todos os direitos reservados\n")
