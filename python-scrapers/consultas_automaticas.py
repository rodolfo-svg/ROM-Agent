"""
IAROM - Módulo de Consultas Automáticas
Integra automaticamente DataJud, JusBrasil e Certidões CNJ durante análise processual
"""

import os
import re
from typing import Dict, List, Optional, Any
from datetime import datetime, timedelta
from dateutil import parser as date_parser

# Importar os módulos de integração
try:
    from datajud_cnj import DataJudCNJ
    DATAJUD_DISPONIVEL = True
except ImportError:
    DATAJUD_DISPONIVEL = False

try:
    from jusbrasil_api import JusBrasilAPI
    JUSBRASIL_DISPONIVEL = True
except ImportError:
    JUSBRASIL_DISPONIVEL = False

try:
    from cnj_certidoes_api import CNJCertidoesAPI
    CNJ_CERTIDOES_DISPONIVEL = True
except ImportError:
    CNJ_CERTIDOES_DISPONIVEL = False


class ConsultasAutomaticas:
    """Realiza consultas automáticas em APIs jurídicas durante análise processual"""

    def __init__(self, processo_info: Dict[str, Any]):
        """
        Inicializa o módulo de consultas automáticas

        Args:
            processo_info: Dicionário com informações do processo
                - numero_processo: str
                - partes: List[str]
                - assuntos: List[str]
                - classe: str
                - tribunal: str (opcional)
        """
        self.processo_info = processo_info
        self.numero_processo = processo_info.get('numero_processo', '')
        self.partes = processo_info.get('partes', [])
        self.assuntos = processo_info.get('assuntos', [])
        self.classe = processo_info.get('classe', '')
        self.tribunal = processo_info.get('tribunal', '')

        # Resultados das consultas
        self.resultados = {
            'datajud': None,
            'jurisprudencias': [],
            'certidoes': None,
            'prazos_calculados': []
        }

    def executar_consultas_completas(self) -> Dict[str, Any]:
        """
        Executa todas as consultas automáticas

        Returns:
            Dict com todos os resultados agregados
        """
        print("\n" + "="*80)
        print("🔍 INICIANDO CONSULTAS AUTOMÁTICAS")
        print("="*80)

        # 1. Buscar processo no DataJud
        if DATAJUD_DISPONIVEL and self.numero_processo:
            print(f"\n📋 Buscando processo no DataJud CNJ...")
            self.resultados['datajud'] = self._buscar_datajud()

        # 2. Buscar jurisprudências no JusBrasil
        if JUSBRASIL_DISPONIVEL and self.assuntos:
            print(f"\n📚 Buscando jurisprudências no JusBrasil...")
            self.resultados['jurisprudencias'] = self._buscar_jurisprudencias()

        # 3. Emitir certidão e calcular prazos
        if CNJ_CERTIDOES_DISPONIVEL and self.numero_processo:
            print(f"\n📜 Buscando certidões de publicação...")
            self.resultados['certidoes'] = self._buscar_certidoes()
            self.resultados['prazos_calculados'] = self._calcular_prazos()

        print("\n" + "="*80)
        print("✅ CONSULTAS AUTOMÁTICAS CONCLUÍDAS")
        print("="*80)

        return self.resultados

    def _buscar_datajud(self) -> Optional[Dict[str, Any]]:
        """Busca informações do processo no DataJud CNJ"""
        try:
            client = DataJudCNJ()
            resultado = client.buscar_processo(
                self.numero_processo,
                tribunal=self.tribunal
            )

            if resultado.get('sucesso'):
                print(f"   ✓ Processo encontrado no DataJud")
                return resultado
            else:
                print(f"   ⚠ Processo não encontrado no DataJud")
                return None

        except Exception as e:
            print(f"   ✗ Erro ao consultar DataJud: {e}")
            return None

    def _buscar_jurisprudencias(self) -> List[Dict[str, Any]]:
        """Busca jurisprudências relevantes no JusBrasil"""
        jurisprudencias = []

        try:
            client = JusBrasilAPI()

            # Buscar para cada assunto principal
            for assunto in self.assuntos[:3]:  # Limitar a 3 assuntos principais
                # Combinar com a classe processual para buscas mais precisas
                termo_busca = f"{assunto} {self.classe}" if self.classe else assunto

                print(f"   🔍 Buscando: '{termo_busca}'")

                resultado = client.pesquisar_jurisprudencia(
                    termo=termo_busca,
                    tribunal=self.tribunal
                )

                if resultado.get('sucesso'):
                    jurisprudencias.append({
                        'assunto': assunto,
                        'termo_busca': termo_busca,
                        'url': resultado.get('url'),
                        'tribunal': self.tribunal or 'Todos',
                        'relevancia': 'alta' if assunto == self.assuntos[0] else 'média'
                    })
                    print(f"   ✓ Jurisprudência encontrada")
                else:
                    print(f"   ⚠ Nenhuma jurisprudência encontrada")

            return jurisprudencias

        except Exception as e:
            print(f"   ✗ Erro ao buscar jurisprudências: {e}")
            return []

    def _buscar_certidoes(self) -> Optional[Dict[str, Any]]:
        """Busca certidões de publicação para cômputo de prazo"""
        try:
            client = CNJCertidoesAPI(ambiente='homologacao')

            # Tentar autenticar (se credenciais disponíveis)
            auth_result = client.autenticar()

            if not auth_result.get('sucesso'):
                print(f"   ⚠ Autenticação CNJ falhou: {auth_result.get('erro')}")
                return None

            # Buscar publicações recentes (últimos 90 dias)
            data_fim = datetime.now().strftime('%Y-%m-%d')
            data_inicio = (datetime.now() - timedelta(days=90)).strftime('%Y-%m-%d')

            resultado = client.buscar_publicacao(
                numero_processo=self.numero_processo,
                data_inicio=data_inicio,
                data_fim=data_fim,
                tribunal=self.tribunal
            )

            if resultado.get('sucesso'):
                print(f"   ✓ {resultado.get('total_publicacoes', 0)} publicações encontradas")
                return resultado
            else:
                print(f"   ⚠ Nenhuma publicação encontrada")
                return None

        except Exception as e:
            print(f"   ✗ Erro ao buscar certidões: {e}")
            return None

    def _calcular_prazos(self) -> List[Dict[str, Any]]:
        """Calcula prazos processuais com base nas publicações e área do direito"""
        prazos = []

        if not self.resultados.get('certidoes'):
            return prazos

        try:
            # Detectar área do direito
            area_direito = self._detectar_area_direito()
            dias_uteis = area_direito in ['civel', 'empresarial', 'administrativo']

            publicacoes = self.resultados['certidoes'].get('publicacoes', [])

            for pub in publicacoes:
                data_publicacao_str = pub.get('data_publicacao') or pub.get('dataDisponibilizacao')

                if not data_publicacao_str:
                    continue

                # Parsear data
                try:
                    data_pub = date_parser.parse(data_publicacao_str)
                except:
                    continue

                # Calcular prazos conforme área
                prazos_calculados = {
                    'data_publicacao': data_pub.strftime('%d/%m/%Y'),
                    'tipo_ato': pub.get('tipo_ato', 'Publicação'),
                    'area_direito': area_direito.upper(),
                    'tipo_prazo': 'DIAS ÚTEIS' if dias_uteis else 'DIAS CORRIDOS',
                    'prazos': []
                }

                # Prazo de 15 dias (recursal comum - CPC)
                if dias_uteis:
                    prazo_15 = self._calcular_prazo_util(data_pub, 15)
                else:
                    prazo_15 = self._calcular_prazo_corrido(data_pub, 15)

                prazos_calculados['prazos'].append({
                    'tipo': 'Recurso (15 dias)',
                    'vencimento': prazo_15.strftime('%d/%m/%Y'),
                    'dias': 15,
                    'tipo_contagem': 'úteis' if dias_uteis else 'corridos',
                    'status': 'vencido' if datetime.now() > prazo_15 else 'em aberto'
                })

                # Prazo de 5 dias (embargos de declaração)
                if dias_uteis:
                    prazo_5 = self._calcular_prazo_util(data_pub, 5)
                else:
                    prazo_5 = self._calcular_prazo_corrido(data_pub, 5)

                prazos_calculados['prazos'].append({
                    'tipo': 'Embargos de Declaração (5 dias)',
                    'vencimento': prazo_5.strftime('%d/%m/%Y'),
                    'dias': 5,
                    'tipo_contagem': 'úteis' if dias_uteis else 'corridos',
                    'status': 'vencido' if datetime.now() > prazo_5 else 'em aberto'
                })

                # Prazos específicos por área
                if area_direito == 'penal':
                    # 10 dias para apelação em processo penal (CPP Art. 593)
                    prazo_10 = self._calcular_prazo_corrido(data_pub, 10)
                    prazos_calculados['prazos'].append({
                        'tipo': 'Apelação Penal (10 dias corridos - Art. 593 CPP)',
                        'vencimento': prazo_10.strftime('%d/%m/%Y'),
                        'dias': 10,
                        'tipo_contagem': 'corridos',
                        'status': 'vencido' if datetime.now() > prazo_10 else 'em aberto'
                    })

                prazos.append(prazos_calculados)

            if prazos:
                print(f"   ✓ {len(prazos)} prazos calculados ({area_direito.upper()} - {'úteis' if dias_uteis else 'corridos'})")

            return prazos

        except Exception as e:
            print(f"   ✗ Erro ao calcular prazos: {e}")
            return []

    def _detectar_area_direito(self) -> str:
        """
        Detecta a área do direito com base em assuntos e classe

        Returns:
            'civel', 'penal', 'trabalhista', 'administrativo', etc.
        """
        # Verificar assuntos
        assuntos_texto = ' '.join(self.assuntos).lower()
        classe_texto = self.classe.lower()

        # Termos indicadores
        if any(termo in assuntos_texto or termo in classe_texto for termo in
               ['penal', 'criminal', 'execução penal', 'habeas corpus', 'revisão criminal',
                'crime', 'dosimetria', 'pena', 'réu', 'condenação']):
            return 'penal'

        if any(termo in assuntos_texto or termo in classe_texto for termo in
               ['trabalhista', 'trabalho', 'clt', 'empregado', 'rescisão', 'fgts', 'horas extras']):
            return 'trabalhista'

        if any(termo in assuntos_texto or termo in classe_texto for termo in
               ['administrativo', 'mandado de segurança', 'servidor público', 'licitação']):
            return 'administrativo'

        # Padrão: cível (usa dias úteis)
        return 'civel'

    def _calcular_prazo_corrido(self, data_inicial: datetime, dias: int) -> datetime:
        """
        Calcula prazo em dias corridos (inclui fins de semana)

        Args:
            data_inicial: Data de início
            dias: Número de dias corridos

        Returns:
            Data final do prazo
        """
        return data_inicial + timedelta(days=dias)

    def _calcular_prazo_util(self, data_inicial: datetime, dias: int) -> datetime:
        """
        Calcula prazo útil (excluindo finais de semana)

        Args:
            data_inicial: Data de início
            dias: Número de dias úteis

        Returns:
            Data final do prazo
        """
        data_atual = data_inicial
        dias_contados = 0

        while dias_contados < dias:
            data_atual += timedelta(days=1)
            # Contar apenas dias úteis (seg-sex)
            if data_atual.weekday() < 5:  # 0-4 = seg-sex
                dias_contados += 1

        return data_atual

    def gerar_secao_resumo_executivo(self) -> str:
        """
        Gera seção do resumo executivo com cotejamento e distinguishing

        Returns:
            Texto formatado para inclusão no resumo executivo
        """
        secoes = []

        # Seção de Jurisprudências
        if self.resultados['jurisprudencias']:
            secoes.append(self._gerar_secao_jurisprudencias())

        # Seção de Prazos
        if self.resultados['prazos_calculados']:
            secoes.append(self._gerar_secao_prazos())

        # Seção DataJud (informações adicionais do processo)
        if self.resultados['datajud']:
            secoes.append(self._gerar_secao_datajud())

        return "\n\n".join(secoes)

    def _gerar_secao_jurisprudencias(self) -> str:
        """Gera seção de jurisprudências com análise de cotejamento"""
        texto = "## 📚 JURISPRUDÊNCIAS RELACIONADAS\n\n"
        texto += "### Pesquisa Automática - JusBrasil\n\n"

        for idx, juris in enumerate(self.resultados['jurisprudencias'], 1):
            texto += f"**{idx}. {juris['assunto']}**\n\n"
            texto += f"- **Termo de busca:** {juris['termo_busca']}\n"
            texto += f"- **Tribunal:** {juris['tribunal']}\n"
            texto += f"- **Relevância:** {juris['relevancia'].upper()}\n"
            texto += f"- **URL:** {juris['url']}\n\n"

            # Análise de cotejamento
            texto += "**Análise de Cotejamento:**\n\n"
            texto += f"- Esta jurisprudência é relevante para análise do assunto '{juris['assunto']}'\n"
            texto += "- Recomenda-se verificar semelhanças e diferenças com o caso concreto (distinguishing)\n"
            texto += "- Atentar para tribunal prolator, data e contexto fático\n\n"
            texto += "---\n\n"

        return texto

    def _gerar_secao_prazos(self) -> str:
        """Gera seção de prazos processuais"""
        texto = "## ⏰ PRAZOS PROCESSUAIS\n\n"
        texto += "### Cômputo Automático de Prazos\n\n"

        for pub in self.resultados['prazos_calculados']:
            texto += f"**Publicação em {pub['data_publicacao']}** - {pub['tipo_ato']}\n\n"
            texto += f"**Área do Direito:** {pub.get('area_direito', 'N/A')}\n"
            texto += f"**Tipo de Contagem:** {pub.get('tipo_prazo', 'DIAS ÚTEIS')}\n\n"

            for prazo in pub['prazos']:
                status_emoji = "🔴" if prazo['status'] == 'vencido' else "🟢"
                tipo_contagem = prazo.get('tipo_contagem', 'úteis')
                texto += f"{status_emoji} **{prazo['tipo']}** ({prazo.get('dias', '?')} dias {tipo_contagem})\n"
                texto += f"   - Vencimento: {prazo['vencimento']}\n"
                texto += f"   - Status: {prazo['status'].upper()}\n\n"

            # Avisos importantes
            texto += "**⚠️ Observações Importantes:**\n"
            if pub.get('area_direito') == 'PENAL':
                texto += "- Processo PENAL: Prazos em DIAS CORRIDOS (incluem fins de semana)\n"
                texto += "- Art. 798, §1º CPP: Prazo contado de forma contínua\n"
            elif pub.get('area_direito') == 'TRABALHISTA':
                texto += "- Processo TRABALHISTA: Prazos em DIAS CORRIDOS\n"
                texto += "- CLT Art. 775: Contagem contínua, excluindo feriados\n"
            else:
                texto += "- Processo CÍVEL: Prazos em DIAS ÚTEIS (excluem sábados e domingos)\n"
                texto += "- CPC Art. 219: Contagem apenas em dias úteis\n"
                texto += "- Feriados forenses devem ser considerados\n"

            texto += "- Defensoria Pública e MP têm prazo em DOBRO (verificar)\n"
            texto += "- Suspensão em período de recesso/férias forenses\n\n"

            texto += "---\n\n"

        return texto

    def _gerar_secao_datajud(self) -> str:
        """Gera seção com informações do DataJud"""
        texto = "## 🏛️ INFORMAÇÕES DO DATAJUD CNJ\n\n"

        datajud = self.resultados['datajud']

        if datajud and datajud.get('dados'):
            dados = datajud['dados']

            texto += f"**Processo:** {self.numero_processo}\n\n"

            # Adicionar informações relevantes do DataJud
            if isinstance(dados, dict):
                if dados.get('tribunal'):
                    texto += f"- **Tribunal:** {dados['tribunal']}\n"
                if dados.get('classe'):
                    texto += f"- **Classe:** {dados['classe']}\n"
                if dados.get('assunto'):
                    texto += f"- **Assunto:** {dados['assunto']}\n"
                if dados.get('area'):
                    texto += f"- **Área:** {dados['area']}\n"

            texto += "\n"

        return texto


# =============================================================================
# FUNÇÕES DE INTEGRAÇÃO COM O EXTRATOR
# =============================================================================

def executar_consultas_processo(processo_info: Dict[str, Any]) -> Dict[str, Any]:
    """
    Função principal para ser chamada pelo extrator

    Args:
        processo_info: Informações extraídas do processo

    Returns:
        Resultados de todas as consultas e análises
    """
    consultas = ConsultasAutomaticas(processo_info)
    resultados = consultas.executar_consultas_completas()

    # Gerar texto para o resumo executivo
    secao_resumo = consultas.gerar_secao_resumo_executivo()

    return {
        'resultados_brutos': resultados,
        'secao_resumo_executivo': secao_resumo,
        'estatisticas': {
            'jurisprudencias_encontradas': len(resultados['jurisprudencias']),
            'prazos_calculados': len(resultados['prazos_calculados']),
            'datajud_consultado': resultados['datajud'] is not None,
            'certidoes_encontradas': resultados['certidoes'] is not None
        }
    }


if __name__ == '__main__':
    # Teste
    print("Módulo de Consultas Automáticas - IAROM")
    print("="*80)

    # Exemplo de uso
    exemplo_processo = {
        'numero_processo': '0000000-00.0000.0.00.0000',
        'partes': ['João da Silva', 'Maria Santos'],
        'assuntos': ['Revisão Criminal', 'Dosimetria da Pena', 'Excesso de Execução'],
        'classe': 'Revisão Criminal',
        'tribunal': 'TJSP'
    }

    print("\nExemplo de processo:")
    print(f"Número: {exemplo_processo['numero_processo']}")
    print(f"Classe: {exemplo_processo['classe']}")
    print(f"Assuntos: {', '.join(exemplo_processo['assuntos'])}")

    print("\nPara executar consultas, use:")
    print("resultados = executar_consultas_processo(processo_info)")
