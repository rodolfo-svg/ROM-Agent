#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
MÓDULO DE ANÁLISE DE MEMORIAIS DE CÁLCULO
Sistema IAROM Extrator v3.0

FUNCIONALIDADES:
- Extração de valores e cálculos de execução/cumprimento
- Análise de correção monetária e juros
- Identificação de divergências em cálculos
- Geração de relatório para impugnação
- Geração de memorial próprio (quando autor/credor)
- Aplicação de critérios do título/decisão
- Análise de índices (IPCA, INPC, TR, Selic, etc.)
- Verificação de períodos e datas-base
"""

import re
import os
from typing import List, Dict, Tuple
from datetime import datetime
from decimal import Decimal, ROUND_HALF_UP

class AnalisadorMemoriaisCalculo:
    """
    Analisador especializado para memoriais de cálculo
    em processos de execução e cumprimento de sentença
    """

    def __init__(self):
        self.valores_identificados = []
        self.calculos_encontrados = []
        self.divergencias = []
        self.indices_aplicados = []
        self.periodos_atualizacao = []
        self.criterios_titulo = {}
        self.tipo_processo = None  # 'execucao' ou 'cumprimento'
        self.posicao_parte = None  # 'credor' ou 'devedor'

    def analisar_memorial_completo(self, texto: str, movimentos: List[Dict],
                                   numero_processo: str, titulo_executivo: Dict = None) -> Dict:
        """
        Análise completa de memorial de cálculo
        """
        print("\n" + "="*80)
        print("ANÁLISE DE MEMORIAL DE CÁLCULO")
        print("="*80)

        # Identificar tipo de processo
        self._identificar_tipo_processo(texto)

        # Extrair valores
        self._extrair_valores_principais(texto)

        # Identificar índices de correção
        self._identificar_indices_correcao(texto)

        # Extrair períodos de atualização
        self._extrair_periodos_atualizacao(texto)

        # Analisar critérios do título/decisão
        if titulo_executivo:
            self._analisar_criterios_titulo(titulo_executivo)

        # Identificar cálculos
        self._identificar_calculos(texto)

        # Detectar divergências
        self._detectar_divergencias()

        # Gerar relatório
        return self._gerar_relatorio_completo(numero_processo)

    def _identificar_tipo_processo(self, texto: str):
        """
        Identifica se é execução ou cumprimento de sentença
        """
        print("🔍 [1/7] Identificando tipo de processo...")

        padroes_execucao = [
            r'execuç[ãa]o\s+de\s+t[íi]tulo\s+extrajudicial',
            r'execuç[ãa]o\s+fiscal',
            r'a[çc][ãa]o\s+de\s+execuç[ãa]o'
        ]

        padroes_cumprimento = [
            r'cumprimento\s+de\s+senten[çc]a',
            r'fase\s+de\s+cumprimento',
            r'cumprimento\s+provis[óo]rio'
        ]

        for padrao in padroes_execucao:
            if re.search(padrao, texto, re.IGNORECASE):
                self.tipo_processo = 'execucao'
                print(f"   ✅ Tipo identificado: EXECUÇÃO DE TÍTULO")
                return

        for padrao in padroes_cumprimento:
            if re.search(padrao, texto, re.IGNORECASE):
                self.tipo_processo = 'cumprimento'
                print(f"   ✅ Tipo identificado: CUMPRIMENTO DE SENTENÇA")
                return

        self.tipo_processo = 'indeterminado'
        print(f"   ⚠️  Tipo não identificado claramente")

    def _extrair_valores_principais(self, texto: str):
        """
        Extrai valores monetários do memorial
        """
        print("💰 [2/7] Extraindo valores monetários...")

        padroes_valores = [
            {
                'tipo': 'Valor Principal',
                'padrao': r'(?:valor|principal|d[ée]bito).*?R\$\s*([0-9]{1,3}(?:\.[0-9]{3})*(?:,[0-9]{2})?)',
                'categoria': 'principal'
            },
            {
                'tipo': 'Juros',
                'padrao': r'juros.*?R\$\s*([0-9]{1,3}(?:\.[0-9]{3})*(?:,[0-9]{2})?)',
                'categoria': 'juros'
            },
            {
                'tipo': 'Correção Monetária',
                'padrao': r'corre[çc][ãa]o\s+monet[áa]ria.*?R\$\s*([0-9]{1,3}(?:\.[0-9]{3})*(?:,[0-9]{2})?)',
                'categoria': 'correcao'
            },
            {
                'tipo': 'Honorários',
                'padrao': r'honor[áa]rios.*?R\$\s*([0-9]{1,3}(?:\.[0-9]{3})*(?:,[0-9]{2})?)',
                'categoria': 'honorarios'
            },
            {
                'tipo': 'Custas',
                'padrao': r'custas.*?R\$\s*([0-9]{1,3}(?:\.[0-9]{3})*(?:,[0-9]{2})?)',
                'categoria': 'custas'
            },
            {
                'tipo': 'Valor Total',
                'padrao': r'(?:total|atualizado).*?R\$\s*([0-9]{1,3}(?:\.[0-9]{3})*(?:,[0-9]{2})?)',
                'categoria': 'total'
            }
        ]

        for padrao_dict in padroes_valores:
            for match in re.finditer(padrao_dict['padrao'], texto, re.IGNORECASE):
                valor_str = match.group(1).replace('.', '').replace(',', '.')

                inicio = max(0, match.start() - 200)
                fim = min(len(texto), match.end() + 200)
                contexto = texto[inicio:fim]

                self.valores_identificados.append({
                    'tipo': padrao_dict['tipo'],
                    'categoria': padrao_dict['categoria'],
                    'valor_string': match.group(1),
                    'valor_numerico': Decimal(valor_str),
                    'contexto': contexto,
                    'posicao': match.start()
                })

        print(f"   ✅ {len(self.valores_identificados)} valores identificados")

    def _identificar_indices_correcao(self, texto: str):
        """
        Identifica índices de correção monetária utilizados
        """
        print("📊 [3/7] Identificando índices de correção...")

        indices = [
            {
                'nome': 'IPCA',
                'padrao': r'IPCA',
                'descricao': 'Índice de Preços ao Consumidor Amplo',
                'orgao': 'IBGE'
            },
            {
                'nome': 'INPC',
                'padrao': r'INPC',
                'descricao': 'Índice Nacional de Preços ao Consumidor',
                'orgao': 'IBGE'
            },
            {
                'nome': 'IGP-M',
                'padrao': r'IGP-?M',
                'descricao': 'Índice Geral de Preços do Mercado',
                'orgao': 'FGV'
            },
            {
                'nome': 'IGP-DI',
                'padrao': r'IGP-?DI',
                'descricao': 'Índice Geral de Preços - Disponibilidade Interna',
                'orgao': 'FGV'
            },
            {
                'nome': 'TR',
                'padrao': r'\\bTR\\b',
                'descricao': 'Taxa Referencial',
                'orgao': 'BCB'
            },
            {
                'nome': 'SELIC',
                'padrao': r'SELIC',
                'descricao': 'Sistema Especial de Liquidação e Custódia',
                'orgao': 'BCB'
            },
            {
                'nome': 'CDI',
                'padrao': r'\\bCDI\\b',
                'descricao': 'Certificado de Depósito Interbancário',
                'orgao': 'BCB'
            },
            {
                'nome': 'TJLP',
                'padrao': r'TJLP',
                'descricao': 'Taxa de Juros de Longo Prazo',
                'orgao': 'BCB'
            }
        ]

        for indice_dict in indices:
            for match in re.finditer(indice_dict['padrao'], texto, re.IGNORECASE):
                inicio = max(0, match.start() - 200)
                fim = min(len(texto), match.end() + 200)
                contexto = texto[inicio:fim]

                self.indices_aplicados.append({
                    'nome': indice_dict['nome'],
                    'descricao': indice_dict['descricao'],
                    'orgao': indice_dict['orgao'],
                    'contexto': contexto,
                    'posicao': match.start()
                })

        print(f"   ✅ {len(self.indices_aplicados)} índices identificados")

    def _extrair_periodos_atualizacao(self, texto: str):
        """
        Extrai períodos de atualização monetária
        """
        print("📅 [4/7] Extraindo períodos de atualização...")

        padroes_periodo = [
            r'(?:de|desde)\s+(\d{2}/\d{2}/\d{4})\s+(?:a|até)\s+(\d{2}/\d{2}/\d{4})',
            r'per[íi]odo:\s+(\d{2}/\d{2}/\d{4})\s+a\s+(\d{2}/\d{2}/\d{4})',
            r'atualiza[çc][ãa]o.*?(\d{2}/\d{2}/\d{4}).*?(\d{2}/\d{2}/\d{4})'
        ]

        for padrao in padroes_periodo:
            for match in re.finditer(padrao, texto, re.IGNORECASE):
                data_inicial = match.group(1)
                data_final = match.group(2)

                inicio = max(0, match.start() - 200)
                fim = min(len(texto), match.end() + 200)
                contexto = texto[inicio:fim]

                self.periodos_atualizacao.append({
                    'data_inicial': data_inicial,
                    'data_final': data_final,
                    'contexto': contexto,
                    'posicao': match.start()
                })

        print(f"   ✅ {len(self.periodos_atualizacao)} períodos identificados")

    def _analisar_criterios_titulo(self, titulo_executivo: Dict):
        """
        Analisa critérios estabelecidos no título executivo ou decisão
        """
        print("📜 [5/7] Analisando critérios do título/decisão...")

        # Extrair critérios do título
        texto_titulo = titulo_executivo.get('texto', '')

        # Índice de correção determinado
        match_indice = re.search(
            r'(?:correção|atualização).*?(IPCA|INPC|IGP-?M|IGP-?DI|TR|SELIC)',
            texto_titulo,
            re.IGNORECASE
        )
        if match_indice:
            self.criterios_titulo['indice_correcao'] = match_indice.group(1).upper()

        # Taxa de juros determinada
        match_juros = re.search(
            r'juros.*?(\d+(?:,\d+)?)%\s*(?:a\.?m\.?|ao\s+mês|a\.?a\.?|ao\s+ano)',
            texto_titulo,
            re.IGNORECASE
        )
        if match_juros:
            self.criterios_titulo['taxa_juros'] = match_juros.group(1)

        # Data base para atualização
        match_data_base = re.search(
            r'(?:a partir de|desde|data[- ]base).*?(\d{2}/\d{2}/\d{4})',
            texto_titulo,
            re.IGNORECASE
        )
        if match_data_base:
            self.criterios_titulo['data_base'] = match_data_base.group(1)

        print(f"   ✅ Critérios extraídos: {len(self.criterios_titulo)}")

    def _identificar_calculos(self, texto: str):
        """
        Identifica cálculos e operações matemáticas
        """
        print("🧮 [6/7] Identificando cálculos...")

        padroes_calculo = [
            {
                'tipo': 'Operação de soma',
                'padrao': r'R\$\s*([0-9,.]+)\s*\+\s*R\$\s*([0-9,.]+)\s*=\s*R\$\s*([0-9,.]+)',
                'operacao': 'soma'
            },
            {
                'tipo': 'Operação de subtração',
                'padrao': r'R\$\s*([0-9,.]+)\s*-\s*R\$\s*([0-9,.]+)\s*=\s*R\$\s*([0-9,.]+)',
                'operacao': 'subtracao'
            },
            {
                'tipo': 'Percentual aplicado',
                'padrao': r'([0-9,.]+)%\s*(?:de|sobre|x)\s*R\$\s*([0-9,.]+)',
                'operacao': 'percentual'
            },
            {
                'tipo': 'Multiplicação',
                'padrao': r'([0-9,.]+)\s*x\s*([0-9,.]+)\s*=\s*([0-9,.]+)',
                'operacao': 'multiplicacao'
            }
        ]

        for padrao_dict in padroes_calculo:
            for match in re.finditer(padrao_dict['padrao'], texto, re.IGNORECASE):
                inicio = max(0, match.start() - 200)
                fim = min(len(texto), match.end() + 200)
                contexto = texto[inicio:fim]

                self.calculos_encontrados.append({
                    'tipo': padrao_dict['tipo'],
                    'operacao': padrao_dict['operacao'],
                    'texto_completo': match.group(0),
                    'contexto': contexto,
                    'posicao': match.start()
                })

        print(f"   ✅ {len(self.calculos_encontrados)} cálculos identificados")

    def _detectar_divergencias(self):
        """
        Detecta divergências entre critérios do título e memorial apresentado
        """
        print("⚠️  [7/7] Detectando divergências...")

        # Verificar índice de correção
        if 'indice_correcao' in self.criterios_titulo:
            indice_titulo = self.criterios_titulo['indice_correcao']
            indices_encontrados = [i['nome'] for i in self.indices_aplicados]

            if indice_titulo not in indices_encontrados:
                self.divergencias.append({
                    'tipo': 'ÍNDICE DE CORREÇÃO DIVERGENTE',
                    'gravidade': 'ALTA',
                    'criterio_titulo': indice_titulo,
                    'criterio_memorial': ', '.join(indices_encontrados) if indices_encontrados else 'Não especificado',
                    'fundamentacao': 'Art. 509, CPC - Obrigatoriedade de observar título executivo',
                    'impacto': 'Pode alterar significativamente o valor atualizado'
                })

        # Verificar períodos de atualização
        if 'data_base' in self.criterios_titulo:
            data_base_titulo = self.criterios_titulo['data_base']
            datas_encontradas = [p['data_inicial'] for p in self.periodos_atualizacao]

            if data_base_titulo not in datas_encontradas:
                self.divergencias.append({
                    'tipo': 'DATA BASE DIVERGENTE',
                    'gravidade': 'ALTA',
                    'criterio_titulo': data_base_titulo,
                    'criterio_memorial': ', '.join(datas_encontradas) if datas_encontradas else 'Não especificado',
                    'fundamentacao': 'Art. 509, CPC - Obrigatoriedade de observar título executivo',
                    'impacto': 'Altera base de cálculo da correção monetária'
                })

        print(f"   ✅ {len(self.divergencias)} divergências detectadas")

    def _gerar_relatorio_completo(self, numero_processo: str) -> Dict:
        """
        Gera relatório completo consolidado
        """
        print("\n📊 Gerando relatório consolidado...")

        relatorio = {
            'numero_processo': numero_processo,
            'data_analise': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
            'tipo_processo': self.tipo_processo,
            'resumo': {
                'valores_identificados': len(self.valores_identificados),
                'indices_aplicados': len(self.indices_aplicados),
                'periodos_atualizacao': len(self.periodos_atualizacao),
                'calculos_encontrados': len(self.calculos_encontrados),
                'divergencias': len(self.divergencias)
            },
            'detalhamento': {
                'valores': self.valores_identificados,
                'indices': self.indices_aplicados,
                'periodos': self.periodos_atualizacao,
                'calculos': self.calculos_encontrados,
                'divergencias': self.divergencias,
                'criterios_titulo': self.criterios_titulo
            }
        }

        print(f"   ✅ Relatório gerado")
        return relatorio

    def salvar_relatorio_txt(self, relatorio: Dict, pasta_saida: str, tipo_relatorio: str = 'impugnacao'):
        """
        Salva relatório em formato TXT

        Args:
            tipo_relatorio: 'impugnacao' ou 'memorial_proprio'
        """
        if tipo_relatorio == 'impugnacao':
            nome_arquivo = 'RELATORIO_IMPUGNACAO_CALCULO.txt'
        else:
            nome_arquivo = 'MEMORIAL_CALCULO_PROPRIO.txt'

        caminho = os.path.join(pasta_saida, '04_Analises_Juridicas', nome_arquivo)

        with open(caminho, 'w', encoding='utf-8') as f:
            if tipo_relatorio == 'impugnacao':
                self._escrever_relatorio_impugnacao(f, relatorio)
            else:
                self._escrever_memorial_proprio(f, relatorio)

        print(f"\n✅ Relatório salvo em: {caminho}")

    def _escrever_relatorio_impugnacao(self, f, relatorio: Dict):
        """Escreve relatório para impugnação de cálculo"""
        f.write("="*100 + "\n")
        f.write("RELATÓRIO PARA IMPUGNAÇÃO DE CÁLCULO\n")
        f.write("="*100 + "\n\n")

        f.write(f"Processo: {relatorio['numero_processo']}\n")
        f.write(f"Data da análise: {relatorio['data_analise']}\n")
        f.write(f"Tipo: {relatorio['tipo_processo'].upper()}\n")
        f.write(f"Sistema: IAROM Extrator Processual v3.0\n\n")

        # Resumo executivo
        f.write("─"*100 + "\n")
        f.write("RESUMO EXECUTIVO\n")
        f.write("─"*100 + "\n\n")

        resumo = relatorio['resumo']
        f.write(f"Valores identificados: {resumo['valores_identificados']}\n")
        f.write(f"Índices aplicados: {resumo['indices_aplicados']}\n")
        f.write(f"Períodos de atualização: {resumo['periodos_atualizacao']}\n")
        f.write(f"Cálculos encontrados: {resumo['calculos_encontrados']}\n")
        f.write(f"⚠️  DIVERGÊNCIAS DETECTADAS: {resumo['divergencias']}\n\n")

        # Divergências (seção principal para impugnação)
        if relatorio['detalhamento']['divergencias']:
            f.write("\n" + "="*100 + "\n")
            f.write("DIVERGÊNCIAS IDENTIFICADAS (BASE PARA IMPUGNAÇÃO)\n")
            f.write("="*100 + "\n\n")

            for i, div in enumerate(relatorio['detalhamento']['divergencias'], 1):
                f.write(f"{'─'*100}\n")
                f.write(f"DIVERGÊNCIA {i:03d} - {div['tipo']}\n")
                f.write(f"{'─'*100}\n")
                f.write(f"Gravidade: {div['gravidade']}\n")
                f.write(f"Critério no título/decisão: {div['criterio_titulo']}\n")
                f.write(f"Critério no memorial: {div['criterio_memorial']}\n")
                f.write(f"Fundamentação: {div['fundamentacao']}\n")
                f.write(f"Impacto: {div['impacto']}\n\n")

        # Valores identificados
        if relatorio['detalhamento']['valores']:
            f.write("\n" + "="*100 + "\n")
            f.write("VALORES IDENTIFICADOS NO MEMORIAL\n")
            f.write("="*100 + "\n\n")

            for val in relatorio['detalhamento']['valores']:
                f.write(f"• {val['tipo']}: R$ {val['valor_string']}\n")

        # Índices aplicados
        if relatorio['detalhamento']['indices']:
            f.write("\n" + "="*100 + "\n")
            f.write("ÍNDICES DE CORREÇÃO UTILIZADOS\n")
            f.write("="*100 + "\n\n")

            for idx in relatorio['detalhamento']['indices']:
                f.write(f"• {idx['nome']} - {idx['descricao']} ({idx['orgao']})\n")

        # Rodapé
        f.write("\n" + "="*100 + "\n")
        f.write("FIM DO RELATÓRIO\n")
        f.write("="*100 + "\n\n")
        f.write("IMPORTANTE:\n")
        f.write("- Este relatório é gerado automaticamente por IA\n")
        f.write("- Recomenda-se revisão por profissional contábil/jurídico\n")
        f.write("- As divergências devem ser confirmadas com documentos\n\n")

    def _escrever_memorial_proprio(self, f, relatorio: Dict):
        """Escreve memorial de cálculo próprio (quando autor/credor)"""
        f.write("="*100 + "\n")
        f.write("MEMORIAL DE CÁLCULO - PROPOSTA\n")
        f.write("="*100 + "\n\n")

        f.write(f"Processo: {relatorio['numero_processo']}\n")
        f.write(f"Data: {relatorio['data_analise']}\n")
        f.write(f"Tipo: {relatorio['tipo_processo'].upper()}\n\n")

        f.write("─"*100 + "\n")
        f.write("CRITÉRIOS APLICADOS (CONFORME TÍTULO/DECISÃO)\n")
        f.write("─"*100 + "\n\n")

        criterios = relatorio['detalhamento']['criterios_titulo']
        if criterios:
            for chave, valor in criterios.items():
                f.write(f"• {chave.replace('_', ' ').title()}: {valor}\n")
        else:
            f.write("⚠️  Critérios não identificados no título/decisão\n")

        f.write("\n" + "="*100 + "\n")
        f.write("FIM DO MEMORIAL\n")
        f.write("="*100 + "\n")
