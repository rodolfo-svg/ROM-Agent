#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
╔══════════════════════════════════════════════════════════════════════════════════════════╗
║              ROM AGENT v3.0 - PIPELINE DE PRODUÇÃO JURÍDICA                              ║
║                                                                                          ║
║  Sistema de Produção em Escala com 4 Estágios Especializados:                           ║
║  1. EXTRAÇÃO    - Adaptativa por volume                                                 ║
║  2. ANÁLISE     - Fichamento/resumo por importância                                     ║
║  3. REDAÇÃO     - Criação de documentos jurídicos                                       ║
║  4. AUDITORIA   - Revisão final de qualidade                                            ║
║                                                                                          ║
║  Autor: Rodolfo Otávio Mota - Advogados Associados                                      ║
║  AWS Bedrock Region: us-west-2 (Oregon)                                                 ║
╚══════════════════════════════════════════════════════════════════════════════════════════╝
"""

import asyncio
from enum import Enum
from typing import Dict, List, Optional, Any, Tuple
from dataclasses import dataclass, field
from datetime import datetime
import json
import logging

# Importar base do ROM Agent v2
from rom_agent_v2_final import (
    MODEL_CATALOG, MODEL_TIERS, LEGAL_TASKS,
    ModelTier, ModelProvider, ModelConfig, ModelPricing,
    RoutingDecision, DecisionType, ROMAgent, CostAnalyzer
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("ROMPipeline")


# ══════════════════════════════════════════════════════════════════════════════════════════
# PARTE 1: ENUMERAÇÕES E CONFIGURAÇÕES DO PIPELINE
# ══════════════════════════════════════════════════════════════════════════════════════════

class ProcessPriority(Enum):
    """Prioridade/Importância do processo"""
    CRITICAL = "critical"       # STJ/STF, liberdade, cliente VIP
    HIGH = "high"               # Apelações, casos complexos
    STANDARD = "standard"       # Volume diário normal
    BULK = "bulk"               # Alto volume, baixa complexidade


class VolumeLevel(Enum):
    """Nível de volume de documentos"""
    SINGLE = "single"           # 1 documento
    SMALL = "small"             # 2-10 documentos
    MEDIUM = "medium"           # 11-50 documentos
    LARGE = "large"             # 51-200 documentos
    MASSIVE = "massive"         # 200+ documentos


class QualityLevel(Enum):
    """Nível de qualidade exigido"""
    PERFECT = "perfect"         # 100% - zero erros tolerados
    HIGH = "high"               # 95%+ - mínimos erros aceitáveis
    STANDARD = "standard"       # 90%+ - qualidade profissional
    DRAFT = "draft"             # 80%+ - rascunho para revisão


class SpeedLevel(Enum):
    """Nível de velocidade requerido"""
    URGENT = "urgent"           # Minutos (prazo hoje)
    FAST = "fast"               # Horas (prazo amanhã)
    NORMAL = "normal"           # Dias (prazo normal)
    RELAXED = "relaxed"         # Sem pressa


@dataclass
class PipelineConfig:
    """Configuração do pipeline baseada em contexto"""
    priority: ProcessPriority = ProcessPriority.STANDARD
    volume: VolumeLevel = VolumeLevel.SINGLE
    quality: QualityLevel = QualityLevel.HIGH
    speed: SpeedLevel = SpeedLevel.NORMAL
    
    # Opções específicas
    enable_audit: bool = True
    audit_depth: str = "standard"  # light, standard, deep
    parallel_processing: bool = False
    max_concurrent: int = 5
    
    # Contexto do processo
    tribunal: Optional[str] = None
    materia: Optional[str] = None
    valor_causa: Optional[float] = None
    envolve_liberdade: bool = False
    cliente_vip: bool = False


@dataclass
class StageResult:
    """Resultado de um estágio do pipeline"""
    stage: str
    model_used: str
    model_tier: str
    input_tokens: int
    output_tokens: int
    cost_usd: float
    duration_ms: int
    content: Any
    quality_score: Optional[float] = None
    issues_found: List[str] = field(default_factory=list)


@dataclass
class PipelineResult:
    """Resultado completo do pipeline"""
    success: bool
    stages: List[StageResult]
    total_cost_usd: float
    total_cost_brl: float
    total_duration_ms: int
    final_content: Any
    audit_passed: bool = True
    audit_score: float = 0.0
    recommendations: List[str] = field(default_factory=list)


# ══════════════════════════════════════════════════════════════════════════════════════════
# PARTE 2: MATRIZ DE SELEÇÃO DE MODELOS POR ESTÁGIO
# ══════════════════════════════════════════════════════════════════════════════════════════

"""
MATRIZ DE DECISÃO - EXTRAÇÃO
─────────────────────────────────────────────────────────────────────────────────────────────
Volume      │ CRITICAL           │ HIGH               │ STANDARD           │ BULK
─────────────────────────────────────────────────────────────────────────────────────────────
SINGLE      │ claude-opus-4.5    │ claude-sonnet-4    │ claude-sonnet-4    │ claude-haiku-3
SMALL       │ claude-sonnet-4    │ claude-sonnet-4    │ claude-sonnet-3.5  │ nova-lite
MEDIUM      │ claude-sonnet-4    │ claude-sonnet-3.5  │ nova-pro           │ nova-lite
LARGE       │ claude-sonnet-3.5  │ nova-pro           │ nova-lite          │ nova-micro
MASSIVE     │ nova-premier       │ nova-premier       │ nova-lite          │ nova-micro
─────────────────────────────────────────────────────────────────────────────────────────────
"""

EXTRACTION_MATRIX: Dict[VolumeLevel, Dict[ProcessPriority, str]] = {
    VolumeLevel.SINGLE: {
        ProcessPriority.CRITICAL: "claude-opus-4.5",
        ProcessPriority.HIGH: "claude-sonnet-4",
        ProcessPriority.STANDARD: "claude-sonnet-4",
        ProcessPriority.BULK: "claude-haiku-3",
    },
    VolumeLevel.SMALL: {
        ProcessPriority.CRITICAL: "claude-sonnet-4",
        ProcessPriority.HIGH: "claude-sonnet-4",
        ProcessPriority.STANDARD: "claude-sonnet-3.5",
        ProcessPriority.BULK: "nova-lite",
    },
    VolumeLevel.MEDIUM: {
        ProcessPriority.CRITICAL: "claude-sonnet-4",
        ProcessPriority.HIGH: "claude-sonnet-3.5",
        ProcessPriority.STANDARD: "nova-pro",
        ProcessPriority.BULK: "nova-lite",
    },
    VolumeLevel.LARGE: {
        ProcessPriority.CRITICAL: "claude-sonnet-3.5",
        ProcessPriority.HIGH: "nova-pro",
        ProcessPriority.STANDARD: "nova-lite",
        ProcessPriority.BULK: "nova-micro",
    },
    VolumeLevel.MASSIVE: {
        ProcessPriority.CRITICAL: "nova-premier",      # 1M context!
        ProcessPriority.HIGH: "nova-premier",
        ProcessPriority.STANDARD: "nova-lite",
        ProcessPriority.BULK: "nova-micro",
    },
}


"""
MATRIZ DE DECISÃO - ANÁLISE (Fichamento/Resumo)
─────────────────────────────────────────────────────────────────────────────────────────────
Quality     │ CRITICAL           │ HIGH               │ STANDARD           │ BULK
─────────────────────────────────────────────────────────────────────────────────────────────
PERFECT     │ claude-opus-4.5    │ claude-sonnet-3.7  │ claude-sonnet-3.7  │ claude-sonnet-4
HIGH        │ claude-sonnet-3.7  │ claude-sonnet-4    │ deepseek-r1        │ claude-sonnet-3.5
STANDARD    │ claude-sonnet-4    │ deepseek-r1        │ claude-sonnet-3.5  │ nova-pro
DRAFT       │ claude-sonnet-3.5  │ claude-haiku-3     │ nova-pro           │ nova-lite
─────────────────────────────────────────────────────────────────────────────────────────────

Nota: Para FICHAMENTO profundo, usar extended_thinking quando disponível
"""

ANALYSIS_MATRIX: Dict[QualityLevel, Dict[ProcessPriority, str]] = {
    QualityLevel.PERFECT: {
        ProcessPriority.CRITICAL: "claude-opus-4.5",
        ProcessPriority.HIGH: "claude-sonnet-3.7",      # Extended thinking
        ProcessPriority.STANDARD: "claude-sonnet-3.7",
        ProcessPriority.BULK: "claude-sonnet-4",
    },
    QualityLevel.HIGH: {
        ProcessPriority.CRITICAL: "claude-sonnet-3.7",  # Extended thinking
        ProcessPriority.HIGH: "claude-sonnet-4",
        ProcessPriority.STANDARD: "deepseek-r1",        # Extended thinking, mais barato
        ProcessPriority.BULK: "claude-sonnet-3.5",
    },
    QualityLevel.STANDARD: {
        ProcessPriority.CRITICAL: "claude-sonnet-4",
        ProcessPriority.HIGH: "deepseek-r1",
        ProcessPriority.STANDARD: "claude-sonnet-3.5",
        ProcessPriority.BULK: "nova-pro",
    },
    QualityLevel.DRAFT: {
        ProcessPriority.CRITICAL: "claude-sonnet-3.5",
        ProcessPriority.HIGH: "claude-haiku-3",
        ProcessPriority.STANDARD: "nova-pro",
        ProcessPriority.BULK: "nova-lite",
    },
}


"""
MATRIZ DE DECISÃO - REDAÇÃO
─────────────────────────────────────────────────────────────────────────────────────────────
Speed       │ CRITICAL           │ HIGH               │ STANDARD           │ BULK
─────────────────────────────────────────────────────────────────────────────────────────────
URGENT      │ claude-sonnet-4    │ claude-haiku-3     │ claude-haiku-3     │ nova-lite
FAST        │ claude-opus-4.5    │ claude-sonnet-4    │ claude-sonnet-3.5  │ claude-haiku-3
NORMAL      │ claude-opus-4.5    │ claude-sonnet-4    │ claude-sonnet-4    │ claude-sonnet-3.5
RELAXED     │ claude-opus-4.5    │ claude-opus-4.5    │ claude-sonnet-4    │ claude-sonnet-4
─────────────────────────────────────────────────────────────────────────────────────────────

Nota: Redação SEMPRE prioriza qualidade do texto. Velocidade só reduz qualidade em URGENT.
"""

DRAFTING_MATRIX: Dict[SpeedLevel, Dict[ProcessPriority, str]] = {
    SpeedLevel.URGENT: {
        ProcessPriority.CRITICAL: "claude-sonnet-4",    # Melhor trade-off urgente
        ProcessPriority.HIGH: "claude-haiku-3",
        ProcessPriority.STANDARD: "claude-haiku-3",
        ProcessPriority.BULK: "nova-lite",
    },
    SpeedLevel.FAST: {
        ProcessPriority.CRITICAL: "claude-opus-4.5",
        ProcessPriority.HIGH: "claude-sonnet-4",
        ProcessPriority.STANDARD: "claude-sonnet-3.5",
        ProcessPriority.BULK: "claude-haiku-3",
    },
    SpeedLevel.NORMAL: {
        ProcessPriority.CRITICAL: "claude-opus-4.5",
        ProcessPriority.HIGH: "claude-sonnet-4",
        ProcessPriority.STANDARD: "claude-sonnet-4",
        ProcessPriority.BULK: "claude-sonnet-3.5",
    },
    SpeedLevel.RELAXED: {
        ProcessPriority.CRITICAL: "claude-opus-4.5",
        ProcessPriority.HIGH: "claude-opus-4.5",        # Máxima qualidade
        ProcessPriority.STANDARD: "claude-sonnet-4",
        ProcessPriority.BULK: "claude-sonnet-4",
    },
}


"""
MATRIZ DE DECISÃO - AUDITORIA
─────────────────────────────────────────────────────────────────────────────────────────────
Audit Depth │ CRITICAL           │ HIGH               │ STANDARD           │ BULK
─────────────────────────────────────────────────────────────────────────────────────────────
deep        │ claude-opus-4.5    │ claude-sonnet-3.7  │ claude-sonnet-4    │ claude-sonnet-3.5
standard    │ claude-sonnet-3.7  │ claude-sonnet-4    │ claude-sonnet-3.5  │ claude-haiku-3
light       │ claude-sonnet-4    │ claude-haiku-3     │ claude-haiku-3     │ nova-lite
─────────────────────────────────────────────────────────────────────────────────────────────

Nota: Auditoria usa modelo DIFERENTE da redação para ter "segundo par de olhos"
"""

AUDIT_MATRIX: Dict[str, Dict[ProcessPriority, str]] = {
    "deep": {
        ProcessPriority.CRITICAL: "claude-opus-4.5",
        ProcessPriority.HIGH: "claude-sonnet-3.7",
        ProcessPriority.STANDARD: "claude-sonnet-4",
        ProcessPriority.BULK: "claude-sonnet-3.5",
    },
    "standard": {
        ProcessPriority.CRITICAL: "claude-sonnet-3.7",
        ProcessPriority.HIGH: "claude-sonnet-4",
        ProcessPriority.STANDARD: "claude-sonnet-3.5",
        ProcessPriority.BULK: "claude-haiku-3",
    },
    "light": {
        ProcessPriority.CRITICAL: "claude-sonnet-4",
        ProcessPriority.HIGH: "claude-haiku-3",
        ProcessPriority.STANDARD: "claude-haiku-3",
        ProcessPriority.BULK: "nova-lite",
    },
}


# ══════════════════════════════════════════════════════════════════════════════════════════
# PARTE 3: ESTÁGIOS DO PIPELINE
# ══════════════════════════════════════════════════════════════════════════════════════════

class ExtractionStage:
    """
    ESTÁGIO 1: EXTRAÇÃO DE DOCUMENTOS
    
    Responsável por:
    - OCR de documentos escaneados
    - Extração de dados estruturados
    - Parsing de peças processuais
    - Identificação de partes, datas, valores
    """
    
    EXTRACTION_PROMPT = """Você é um especialista em extração de dados jurídicos.

TAREFA: Extrair informações estruturadas do documento fornecido.

EXTRAIA:
1. IDENTIFICAÇÃO
   - Tipo de documento
   - Número do processo (se houver)
   - Tribunal/Vara
   - Data do documento

2. PARTES
   - Autor(es)/Requerente(s)
   - Réu(s)/Requerido(s)
   - Advogados (OAB)
   - Terceiros interessados

3. CONTEÚDO
   - Pedidos/Requerimentos
   - Fundamentos principais
   - Valores envolvidos
   - Prazos mencionados

4. DECISÕES (se houver)
   - Dispositivo
   - Fundamentação resumida
   - Condenações/Obrigações

Responda em JSON estruturado."""

    def __init__(self, catalog: Dict[str, ModelConfig]):
        self.catalog = catalog
    
    def select_model(self, config: PipelineConfig) -> Tuple[str, ModelConfig]:
        """Seleciona modelo baseado em volume e prioridade"""
        model_key = EXTRACTION_MATRIX[config.volume][config.priority]
        return model_key, self.catalog[model_key]
    
    def get_prompt(self, document: str, extraction_type: str = "full") -> str:
        """Gera prompt de extração"""
        return f"{self.EXTRACTION_PROMPT}\n\nDOCUMENTO:\n{document}"
    
    def estimate_cost(self, config: PipelineConfig, doc_tokens: int) -> float:
        """Estima custo da extração"""
        model_key, model = self.select_model(config)
        output_estimate = min(doc_tokens // 3, 4000)  # ~1/3 do input
        return model.pricing.calculate(doc_tokens, output_estimate)


class AnalysisStage:
    """
    ESTÁGIO 2: ANÁLISE (Fichamento e Resumo)
    
    Responsável por:
    - Fichamento jurídico detalhado
    - Resumo executivo
    - Identificação de teses e argumentos
    - Análise de jurisprudência aplicável
    - Detecção de contradições
    """
    
    FICHAMENTO_PROMPT = """Você é um especialista em análise jurídica.

TAREFA: Realizar fichamento jurídico completo.

ESTRUTURA DO FICHAMENTO:

1. SÍNTESE FÁTICA
   - Resumo dos fatos relevantes
   - Linha do tempo
   - Pontos controvertidos

2. QUESTÕES JURÍDICAS
   - Questões de direito material
   - Questões de direito processual
   - Teses sustentadas por cada parte

3. FUNDAMENTAÇÃO
   - Dispositivos legais aplicáveis
   - Jurisprudência relevante
   - Doutrina (se mencionada)

4. ANÁLISE CRÍTICA
   - Pontos fortes de cada parte
   - Vulnerabilidades identificadas
   - Contradições ou inconsistências
   - Provas necessárias

5. ESTRATÉGIA SUGERIDA
   - Linha argumentativa recomendada
   - Riscos a considerar
   - Precedentes favoráveis a pesquisar

Use raciocínio passo-a-passo para análises complexas."""

    RESUMO_PROMPT = """Você é um especialista em síntese jurídica.

TAREFA: Criar resumo executivo do processo/documento.

FORMATO:
- Máximo 500 palavras
- Linguagem clara e objetiva
- Foco nos pontos decisivos
- Conclusão com recomendação

ESTRUTURA:
1. CONTEXTO (2-3 frases)
2. QUESTÃO CENTRAL (1-2 frases)
3. ARGUMENTOS PRINCIPAIS (bullet points)
4. SITUAÇÃO ATUAL (1-2 frases)
5. PRÓXIMOS PASSOS (bullet points)"""

    def __init__(self, catalog: Dict[str, ModelConfig]):
        self.catalog = catalog
    
    def select_model(self, config: PipelineConfig, analysis_type: str = "fichamento") -> Tuple[str, ModelConfig]:
        """Seleciona modelo baseado em qualidade e prioridade"""
        model_key = ANALYSIS_MATRIX[config.quality][config.priority]
        model = self.catalog[model_key]
        
        # Para fichamento profundo, preferir modelos com extended thinking
        if analysis_type == "fichamento" and config.quality in [QualityLevel.PERFECT, QualityLevel.HIGH]:
            if not model.supports_extended_thinking:
                # Tentar alternativa com extended thinking
                alternatives = ["claude-sonnet-3.7", "deepseek-r1", "claude-opus-4.5"]
                for alt in alternatives:
                    if self.catalog[alt].supports_extended_thinking:
                        model_key = alt
                        model = self.catalog[alt]
                        break
        
        return model_key, model
    
    def get_prompt(self, content: str, analysis_type: str = "fichamento") -> str:
        """Gera prompt de análise"""
        base_prompt = self.FICHAMENTO_PROMPT if analysis_type == "fichamento" else self.RESUMO_PROMPT
        return f"{base_prompt}\n\nCONTEÚDO PARA ANÁLISE:\n{content}"
    
    def estimate_cost(self, config: PipelineConfig, input_tokens: int, analysis_type: str = "fichamento") -> float:
        """Estima custo da análise"""
        model_key, model = self.select_model(config, analysis_type)
        
        # Fichamento gera mais output que resumo
        if analysis_type == "fichamento":
            output_estimate = min(input_tokens, 10000)
        else:
            output_estimate = min(input_tokens // 4, 2000)
        
        return model.pricing.calculate(input_tokens, output_estimate)


class DraftingStage:
    """
    ESTÁGIO 3: REDAÇÃO
    
    Responsável por:
    - Elaboração de petições
    - Redação de recursos
    - Criação de pareceres
    - Minutas de contratos
    """
    
    DRAFTING_TEMPLATES = {
        "peticao_inicial": """Você é um advogado especialista em redação jurídica.

TAREFA: Elaborar petição inicial completa.

ESTRUTURA OBRIGATÓRIA:
1. ENDEREÇAMENTO (Juízo competente)
2. QUALIFICAÇÃO DAS PARTES
3. DOS FATOS
4. DO DIREITO
5. DOS PEDIDOS
6. DO VALOR DA CAUSA
7. REQUERIMENTOS FINAIS

DIRETRIZES:
- Linguagem técnica precisa
- Fundamentação robusta
- Citação de jurisprudência quando pertinente
- Pedidos claros e específicos
- Formatação profissional""",

        "contestacao": """TAREFA: Elaborar contestação completa.

ESTRUTURA:
1. SÍNTESE DA INICIAL (breve)
2. PRELIMINARES (se houver)
3. MÉRITO - REFUTAÇÃO PONTO A PONTO
4. DOS PEDIDOS
5. REQUERIMENTOS DE PROVAS""",

        "recurso": """TAREFA: Elaborar recurso.

ESTRUTURA:
1. TEMPESTIVIDADE E CABIMENTO
2. SÍNTESE DA DECISÃO RECORRIDA
3. DAS RAZÕES DE REFORMA
4. DOS PEDIDOS
5. REQUERIMENTOS""",

        "parecer": """TAREFA: Elaborar parecer jurídico.

ESTRUTURA:
1. CONSULTA
2. RELATÓRIO
3. FUNDAMENTAÇÃO
4. CONCLUSÃO""",
    }
    
    def __init__(self, catalog: Dict[str, ModelConfig]):
        self.catalog = catalog
    
    def select_model(self, config: PipelineConfig) -> Tuple[str, ModelConfig]:
        """Seleciona modelo baseado em velocidade e prioridade"""
        model_key = DRAFTING_MATRIX[config.speed][config.priority]
        return model_key, self.catalog[model_key]
    
    def get_prompt(self, context: Dict, draft_type: str, analysis: str) -> str:
        """Gera prompt de redação"""
        template = self.DRAFTING_TEMPLATES.get(draft_type, self.DRAFTING_TEMPLATES["peticao_inicial"])
        
        return f"""{template}

CONTEXTO DO CASO:
{json.dumps(context, indent=2, ensure_ascii=False)}

ANÁLISE PRÉVIA (Fichamento):
{analysis}

Elabore o documento completo, pronto para protocolo."""
    
    def estimate_cost(self, config: PipelineConfig, context_tokens: int, draft_type: str) -> float:
        """Estima custo da redação"""
        model_key, model = self.select_model(config)
        
        # Redação gera bastante output
        output_estimates = {
            "peticao_inicial": 8000,
            "contestacao": 8000,
            "recurso": 10000,
            "parecer": 12000,
        }
        output_estimate = output_estimates.get(draft_type, 8000)
        
        return model.pricing.calculate(context_tokens, output_estimate)


class AuditStage:
    """
    ESTÁGIO 4: AUDITORIA FINAL
    
    Responsável por:
    - Revisão de qualidade
    - Verificação de erros
    - Checklist de conformidade
    - Sugestões de melhoria
    - Score de qualidade
    
    IMPORTANTE: Usa modelo DIFERENTE da redação para evitar viés
    """
    
    AUDIT_PROMPT = """Você é um revisor jurídico sênior especializado em controle de qualidade.

TAREFA: Auditar o documento jurídico e identificar problemas.

CHECKLIST DE AUDITORIA:

1. FORMA
   □ Endereçamento correto
   □ Qualificação completa das partes
   □ Formatação adequada
   □ Numeração de páginas/parágrafos
   □ Assinatura e identificação do advogado

2. CONTEÚDO
   □ Coerência dos fatos narrados
   □ Fundamentação jurídica adequada
   □ Citação correta de dispositivos legais
   □ Jurisprudência pertinente e atualizada
   □ Pedidos claros e compatíveis com causa de pedir

3. LINGUAGEM
   □ Clareza e objetividade
   □ Ausência de erros gramaticais
   □ Termos técnicos corretos
   □ Tom adequado ao tribunal

4. LÓGICA ARGUMENTATIVA
   □ Sequência lógica dos argumentos
   □ Ausência de contradições
   □ Completude da argumentação
   □ Refutação de contra-argumentos previsíveis

5. CONFORMIDADE PROCESSUAL
   □ Prazo respeitado
   □ Competência correta
   □ Legitimidade das partes
   □ Documentos necessários mencionados

RESPONDA COM:
{
    "aprovado": true/false,
    "score": 0-100,
    "erros_criticos": [...],
    "erros_menores": [...],
    "sugestoes_melhoria": [...],
    "pontos_fortes": [...],
    "resumo_auditoria": "..."
}"""

    AUDIT_PROMPTS_BY_DEPTH = {
        "light": """Revisão rápida focada em:
- Erros gramaticais graves
- Formatação básica
- Pedidos claros
Responda com score 0-100 e lista de problemas críticos.""",

        "standard": AUDIT_PROMPT,

        "deep": """Auditoria profunda e minuciosa.

ALÉM DO CHECKLIST PADRÃO, VERIFIQUE:

1. ESTRATÉGIA
   - A tese escolhida é a mais forte?
   - Há argumentos alternativos não explorados?
   - Os precedentes citados são os mais favoráveis?

2. VULNERABILIDADES
   - Quais contra-argumentos o adversário pode usar?
   - Há pontos fracos na fundamentação?
   - Existem riscos processuais não mencionados?

3. JURISPRUDÊNCIA
   - Os precedentes estão atualizados?
   - Há jurisprudência contrária relevante?
   - As súmulas aplicáveis foram consideradas?

4. COMPLETUDE
   - Todos os pedidos necessários foram feitos?
   - Há pedidos alternativos/subsidiários adequados?
   - Os requerimentos de prova são suficientes?

RESPONDA COM ANÁLISE DETALHADA E SCORE 0-100."""
    }
    
    def __init__(self, catalog: Dict[str, ModelConfig]):
        self.catalog = catalog
    
    def select_model(self, config: PipelineConfig, drafting_model: str) -> Tuple[str, ModelConfig]:
        """
        Seleciona modelo para auditoria.
        REGRA: Deve ser DIFERENTE do modelo de redação para "segundo par de olhos"
        """
        model_key = AUDIT_MATRIX[config.audit_depth][config.priority]
        
        # Se for o mesmo modelo da redação, usar alternativa
        if model_key == drafting_model:
            alternatives_by_priority = {
                ProcessPriority.CRITICAL: ["claude-sonnet-3.7", "deepseek-r1", "claude-sonnet-4"],
                ProcessPriority.HIGH: ["claude-sonnet-3.5", "deepseek-r1", "claude-haiku-3"],
                ProcessPriority.STANDARD: ["claude-haiku-3", "nova-pro", "claude-sonnet-3.5"],
                ProcessPriority.BULK: ["nova-lite", "nova-pro", "claude-haiku-3"],
            }
            
            for alt in alternatives_by_priority[config.priority]:
                if alt != drafting_model and alt in self.catalog:
                    model_key = alt
                    break
        
        return model_key, self.catalog[model_key]
    
    def get_prompt(self, document: str, config: PipelineConfig) -> str:
        """Gera prompt de auditoria baseado na profundidade"""
        base_prompt = self.AUDIT_PROMPTS_BY_DEPTH[config.audit_depth]
        return f"{base_prompt}\n\nDOCUMENTO PARA AUDITORIA:\n{document}"
    
    def estimate_cost(self, config: PipelineConfig, doc_tokens: int, drafting_model: str) -> float:
        """Estima custo da auditoria"""
        model_key, model = self.select_model(config, drafting_model)
        
        output_estimates = {
            "light": 1000,
            "standard": 2000,
            "deep": 4000,
        }
        output_estimate = output_estimates[config.audit_depth]
        
        return model.pricing.calculate(doc_tokens, output_estimate)


# ══════════════════════════════════════════════════════════════════════════════════════════
# PARTE 4: ORQUESTRADOR DO PIPELINE
# ══════════════════════════════════════════════════════════════════════════════════════════

class ProductionPipeline:
    """
    Orquestrador do Pipeline de Produção Jurídica
    
    Coordena os 4 estágios:
    1. Extração → 2. Análise → 3. Redação → 4. Auditoria
    
    Com otimização automática de:
    - Seleção de modelos por contexto
    - Paralelização quando possível
    - Balanceamento custo/qualidade/velocidade
    """
    
    def __init__(self, exchange_rate: float = 5.0):
        self.catalog = MODEL_CATALOG
        self.exchange_rate = exchange_rate
        
        # Estágios
        self.extraction = ExtractionStage(self.catalog)
        self.analysis = AnalysisStage(self.catalog)
        self.drafting = DraftingStage(self.catalog)
        self.audit = AuditStage(self.catalog)
        
        # Analisador de custos
        self.cost_analyzer = CostAnalyzer(exchange_rate)
    
    def auto_configure(
        self,
        documents: List[str],
        tribunal: str = None,
        prazo_horas: int = None,
        valor_causa: float = None,
        materia: str = None,
        envolve_liberdade: bool = False,
        cliente_vip: bool = False
    ) -> PipelineConfig:
        """
        Configura pipeline automaticamente baseado no contexto
        """
        
        config = PipelineConfig()
        
        # Volume
        doc_count = len(documents)
        if doc_count == 1:
            config.volume = VolumeLevel.SINGLE
        elif doc_count <= 10:
            config.volume = VolumeLevel.SMALL
        elif doc_count <= 50:
            config.volume = VolumeLevel.MEDIUM
        elif doc_count <= 200:
            config.volume = VolumeLevel.LARGE
        else:
            config.volume = VolumeLevel.MASSIVE
        
        # Prioridade
        if tribunal and tribunal.upper() in ["STF", "STJ", "TST", "TSE", "STM"]:
            config.priority = ProcessPriority.CRITICAL
            config.quality = QualityLevel.PERFECT
            config.audit_depth = "deep"
        elif cliente_vip or envolve_liberdade:
            config.priority = ProcessPriority.CRITICAL
            config.quality = QualityLevel.PERFECT
            config.audit_depth = "deep"
        elif valor_causa and valor_causa > 1000000:  # > 1M
            config.priority = ProcessPriority.HIGH
            config.quality = QualityLevel.HIGH
            config.audit_depth = "standard"
        elif materia == "criminal":
            config.priority = ProcessPriority.HIGH
            config.quality = QualityLevel.HIGH
            config.audit_depth = "standard"
        else:
            config.priority = ProcessPriority.STANDARD
            config.quality = QualityLevel.HIGH
            config.audit_depth = "standard"
        
        # Velocidade
        if prazo_horas:
            if prazo_horas <= 4:
                config.speed = SpeedLevel.URGENT
            elif prazo_horas <= 24:
                config.speed = SpeedLevel.FAST
            elif prazo_horas <= 72:
                config.speed = SpeedLevel.NORMAL
            else:
                config.speed = SpeedLevel.RELAXED
        
        # Contexto
        config.tribunal = tribunal
        config.materia = materia
        config.valor_causa = valor_causa
        config.envolve_liberdade = envolve_liberdade
        config.cliente_vip = cliente_vip
        
        # Paralelização para volume grande
        if config.volume in [VolumeLevel.LARGE, VolumeLevel.MASSIVE]:
            config.parallel_processing = True
            config.max_concurrent = 10
        
        return config
    
    def estimate_full_pipeline(
        self,
        config: PipelineConfig,
        doc_tokens: int,
        draft_type: str = "peticao_inicial"
    ) -> Dict[str, Any]:
        """
        Estima custo total do pipeline completo
        """
        
        # Modelos selecionados
        extraction_model, _ = self.extraction.select_model(config)
        analysis_model, _ = self.analysis.select_model(config)
        drafting_model, _ = self.drafting.select_model(config)
        audit_model, _ = self.audit.select_model(config, drafting_model)
        
        # Custos por estágio
        extraction_cost = self.extraction.estimate_cost(config, doc_tokens)
        analysis_cost = self.analysis.estimate_cost(config, doc_tokens)
        
        # Contexto para redação = extração + análise
        context_tokens = doc_tokens // 3 + doc_tokens  # extração output + análise
        drafting_cost = self.drafting.estimate_cost(config, context_tokens, draft_type)
        
        # Auditoria recebe o documento redigido
        draft_tokens = 8000  # Estimativa de output de redação
        audit_cost = self.audit.estimate_cost(config, draft_tokens, drafting_model) if config.enable_audit else 0
        
        total_usd = extraction_cost + analysis_cost + drafting_cost + audit_cost
        
        return {
            "config": {
                "priority": config.priority.value,
                "volume": config.volume.value,
                "quality": config.quality.value,
                "speed": config.speed.value,
                "audit_depth": config.audit_depth,
            },
            "models": {
                "extraction": extraction_model,
                "analysis": analysis_model,
                "drafting": drafting_model,
                "audit": audit_model if config.enable_audit else None,
            },
            "costs": {
                "extraction_usd": round(extraction_cost, 4),
                "analysis_usd": round(analysis_cost, 4),
                "drafting_usd": round(drafting_cost, 4),
                "audit_usd": round(audit_cost, 4) if config.enable_audit else 0,
                "total_usd": round(total_usd, 4),
                "total_brl": round(total_usd * self.exchange_rate, 2),
            },
            "estimates": {
                "input_tokens": doc_tokens,
                "output_tokens_total": doc_tokens // 3 + doc_tokens + 8000 + 2000,
            }
        }
    
    def get_optimization_report(
        self,
        config: PipelineConfig,
        doc_tokens: int,
        draft_type: str = "peticao_inicial"
    ) -> Dict[str, Any]:
        """
        Gera relatório de otimização comparando cenários
        """
        
        scenarios = []
        
        # Cenário atual
        current = self.estimate_full_pipeline(config, doc_tokens, draft_type)
        current["scenario"] = "atual"
        scenarios.append(current)
        
        # Cenário economia máxima
        economy_config = PipelineConfig(
            priority=ProcessPriority.BULK,
            volume=config.volume,
            quality=QualityLevel.STANDARD,
            speed=SpeedLevel.NORMAL,
            enable_audit=True,
            audit_depth="light"
        )
        economy = self.estimate_full_pipeline(economy_config, doc_tokens, draft_type)
        economy["scenario"] = "economia_maxima"
        scenarios.append(economy)
        
        # Cenário qualidade máxima
        premium_config = PipelineConfig(
            priority=ProcessPriority.CRITICAL,
            volume=config.volume,
            quality=QualityLevel.PERFECT,
            speed=SpeedLevel.RELAXED,
            enable_audit=True,
            audit_depth="deep"
        )
        premium = self.estimate_full_pipeline(premium_config, doc_tokens, draft_type)
        premium["scenario"] = "qualidade_maxima"
        scenarios.append(premium)
        
        # Cenário velocidade máxima
        fast_config = PipelineConfig(
            priority=config.priority,
            volume=config.volume,
            quality=QualityLevel.DRAFT,
            speed=SpeedLevel.URGENT,
            enable_audit=False,
            audit_depth="light"
        )
        fast = self.estimate_full_pipeline(fast_config, doc_tokens, draft_type)
        fast["scenario"] = "velocidade_maxima"
        scenarios.append(fast)
        
        return {
            "documento_tokens": doc_tokens,
            "tipo_documento": draft_type,
            "scenarios": scenarios,
            "recomendacao": self._get_recommendation(scenarios, config)
        }
    
    def _get_recommendation(self, scenarios: List[Dict], original_config: PipelineConfig) -> str:
        """Gera recomendação baseada nos cenários"""
        
        current = scenarios[0]
        economy = scenarios[1]
        premium = scenarios[2]
        
        savings_vs_premium = (premium["costs"]["total_usd"] - current["costs"]["total_usd"]) / premium["costs"]["total_usd"] * 100
        extra_vs_economy = (current["costs"]["total_usd"] - economy["costs"]["total_usd"]) / economy["costs"]["total_usd"] * 100
        
        if original_config.priority == ProcessPriority.CRITICAL:
            return f"Configuração CRÍTICA adequada. Custo {savings_vs_premium:.0f}% menor que premium máximo."
        elif savings_vs_premium > 50:
            return f"Boa economia! Você está gastando {savings_vs_premium:.0f}% menos que o cenário premium mantendo qualidade."
        else:
            return f"Considere reduzir prioridade para economia adicional de {extra_vs_economy:.0f}%."
    
    def compare_with_without_pipeline(
        self,
        doc_tokens: int,
        draft_type: str = "peticao_inicial"
    ) -> Dict[str, Any]:
        """
        Compara custo do pipeline vs usar um único modelo para tudo
        """
        
        # Pipeline otimizado (configuração standard)
        config = PipelineConfig(
            priority=ProcessPriority.STANDARD,
            volume=VolumeLevel.SINGLE,
            quality=QualityLevel.HIGH,
            speed=SpeedLevel.NORMAL,
            enable_audit=True,
            audit_depth="standard"
        )
        pipeline = self.estimate_full_pipeline(config, doc_tokens, draft_type)
        
        # Único modelo (Opus para tudo)
        opus = self.catalog["claude-opus-4.5"]
        total_output = doc_tokens // 3 + doc_tokens + 8000 + 2000  # Estimativa
        opus_cost = opus.pricing.calculate(doc_tokens * 4, total_output)  # 4x pois processa 4 vezes
        
        # Único modelo (Sonnet para tudo)
        sonnet = self.catalog["claude-sonnet-4"]
        sonnet_cost = sonnet.pricing.calculate(doc_tokens * 4, total_output)
        
        return {
            "pipeline_otimizado": {
                "custo_usd": pipeline["costs"]["total_usd"],
                "custo_brl": pipeline["costs"]["total_brl"],
                "modelos": pipeline["models"]
            },
            "opus_para_tudo": {
                "custo_usd": round(opus_cost, 4),
                "custo_brl": round(opus_cost * self.exchange_rate, 2),
                "modelo": "claude-opus-4.5"
            },
            "sonnet_para_tudo": {
                "custo_usd": round(sonnet_cost, 4),
                "custo_brl": round(sonnet_cost * self.exchange_rate, 2),
                "modelo": "claude-sonnet-4"
            },
            "economia_vs_opus": f"{((opus_cost - pipeline['costs']['total_usd']) / opus_cost * 100):.0f}%",
            "economia_vs_sonnet": f"{((sonnet_cost - pipeline['costs']['total_usd']) / sonnet_cost * 100):.0f}%"
        }


# ══════════════════════════════════════════════════════════════════════════════════════════
# PARTE 5: INTERFACE PRINCIPAL
# ══════════════════════════════════════════════════════════════════════════════════════════

class ROMAgentPipeline:
    """
    Interface principal do ROM Agent Pipeline v3.0
    
    Combina:
    - ROM Agent v2 (roteamento inteligente)
    - Pipeline de Produção (4 estágios)
    - Otimização automática
    """
    
    def __init__(self, bedrock_client=None, exchange_rate: float = 5.0):
        self.agent = ROMAgent(bedrock_client, exchange_rate)
        self.pipeline = ProductionPipeline(exchange_rate)
        self.exchange_rate = exchange_rate
    
    def configure(
        self,
        documents: List[str],
        tribunal: str = None,
        prazo_horas: int = None,
        valor_causa: float = None,
        materia: str = None,
        envolve_liberdade: bool = False,
        cliente_vip: bool = False
    ) -> PipelineConfig:
        """Configura pipeline automaticamente"""
        return self.pipeline.auto_configure(
            documents, tribunal, prazo_horas, valor_causa,
            materia, envolve_liberdade, cliente_vip
        )
    
    def estimate(
        self,
        config: PipelineConfig,
        doc_tokens: int,
        draft_type: str = "peticao_inicial"
    ) -> Dict[str, Any]:
        """Estima custos do pipeline"""
        return self.pipeline.estimate_full_pipeline(config, doc_tokens, draft_type)
    
    def optimize(
        self,
        config: PipelineConfig,
        doc_tokens: int,
        draft_type: str = "peticao_inicial"
    ) -> Dict[str, Any]:
        """Gera relatório de otimização"""
        return self.pipeline.get_optimization_report(config, doc_tokens, draft_type)
    
    def compare(self, doc_tokens: int, draft_type: str = "peticao_inicial") -> Dict[str, Any]:
        """Compara pipeline vs modelo único"""
        return self.pipeline.compare_with_without_pipeline(doc_tokens, draft_type)
    
    # Expor métodos do ROMAgent original
    def route(self, *args, **kwargs):
        return self.agent.route(*args, **kwargs)
    
    def estimate_task_cost(self, *args, **kwargs):
        return self.agent.estimate_task_cost(*args, **kwargs)
    
    def get_models_for_selector(self):
        return self.agent.get_models_for_selector()


# ══════════════════════════════════════════════════════════════════════════════════════════
# PARTE 6: DEMONSTRAÇÃO
# ══════════════════════════════════════════════════════════════════════════════════════════

def demo():
    """Demonstração do Pipeline de Produção"""
    
    print("=" * 90)
    print("            ROM AGENT v3.0 - PIPELINE DE PRODUÇÃO JURÍDICA")
    print("=" * 90)
    
    pipeline = ROMAgentPipeline(exchange_rate=5.0)
    
    # Cenário 1: Recurso Especial (CRÍTICO)
    print("\n\n" + "=" * 90)
    print("📋 CENÁRIO 1: RECURSO ESPECIAL PARA STJ (Cliente VIP)")
    print("=" * 90)
    
    config1 = pipeline.configure(
        documents=["documento_principal.pdf"],
        tribunal="STJ",
        prazo_horas=72,
        valor_causa=500000,
        cliente_vip=True
    )
    
    estimate1 = pipeline.estimate(config1, doc_tokens=15000, draft_type="recurso")
    
    print(f"\n📊 CONFIGURAÇÃO AUTOMÁTICA:")
    print(f"   Prioridade: {config1.priority.value}")
    print(f"   Qualidade: {config1.quality.value}")
    print(f"   Velocidade: {config1.speed.value}")
    print(f"   Auditoria: {config1.audit_depth}")
    
    print(f"\n🤖 MODELOS SELECIONADOS:")
    for stage, model in estimate1["models"].items():
        if model:
            print(f"   {stage.upper()}: {model}")
    
    print(f"\n💰 CUSTOS:")
    for stage, cost in estimate1["costs"].items():
        if "usd" in stage:
            print(f"   {stage}: ${cost}")
    print(f"   TOTAL BRL: R$ {estimate1['costs']['total_brl']}")
    
    # Cenário 2: Volume de Petições (BULK)
    print("\n\n" + "=" * 90)
    print("📋 CENÁRIO 2: LOTE DE 50 PETIÇÕES INICIAIS")
    print("=" * 90)
    
    config2 = pipeline.configure(
        documents=["doc" + str(i) for i in range(50)],
        tribunal="TJGO",
        prazo_horas=168,  # 1 semana
        materia="civel"
    )
    
    estimate2 = pipeline.estimate(config2, doc_tokens=4000, draft_type="peticao_inicial")
    
    print(f"\n📊 CONFIGURAÇÃO AUTOMÁTICA:")
    print(f"   Volume: {config2.volume.value} ({50} docs)")
    print(f"   Prioridade: {config2.priority.value}")
    print(f"   Processamento paralelo: {config2.parallel_processing}")
    
    print(f"\n🤖 MODELOS SELECIONADOS:")
    for stage, model in estimate2["models"].items():
        if model:
            print(f"   {stage.upper()}: {model}")
    
    print(f"\n💰 CUSTO POR DOCUMENTO: ${estimate2['costs']['total_usd']}")
    print(f"💰 CUSTO TOTAL (50 docs): ${estimate2['costs']['total_usd'] * 50:.2f} / R$ {estimate2['costs']['total_brl'] * 50:.2f}")
    
    # Comparação Pipeline vs Modelo Único
    print("\n\n" + "=" * 90)
    print("📊 COMPARAÇÃO: PIPELINE vs MODELO ÚNICO")
    print("=" * 90)
    
    comparison = pipeline.compare(doc_tokens=10000, draft_type="peticao_inicial")
    
    print(f"\n{'Abordagem':<25} {'Custo USD':<15} {'Custo BRL':<15}")
    print("-" * 55)
    print(f"{'Pipeline Otimizado':<25} ${comparison['pipeline_otimizado']['custo_usd']:<14} R$ {comparison['pipeline_otimizado']['custo_brl']}")
    print(f"{'Opus 4.5 para tudo':<25} ${comparison['opus_para_tudo']['custo_usd']:<14} R$ {comparison['opus_para_tudo']['custo_brl']}")
    print(f"{'Sonnet 4 para tudo':<25} ${comparison['sonnet_para_tudo']['custo_usd']:<14} R$ {comparison['sonnet_para_tudo']['custo_brl']}")
    print(f"\n💰 Economia vs Opus: {comparison['economia_vs_opus']}")
    print(f"💰 Economia vs Sonnet: {comparison['economia_vs_sonnet']}")
    
    # Relatório de Otimização
    print("\n\n" + "=" * 90)
    print("📊 RELATÓRIO DE OTIMIZAÇÃO")
    print("=" * 90)
    
    config_standard = PipelineConfig(
        priority=ProcessPriority.STANDARD,
        volume=VolumeLevel.SINGLE,
        quality=QualityLevel.HIGH,
        speed=SpeedLevel.NORMAL,
        enable_audit=True,
        audit_depth="standard"
    )
    
    optimization = pipeline.optimize(config_standard, doc_tokens=8000)
    
    print(f"\n{'Cenário':<20} {'Custo USD':<12} {'Modelos'}")
    print("-" * 80)
    for scenario in optimization["scenarios"]:
        models = f"{scenario['models']['drafting']} + {scenario['models']['audit'] or 'sem audit'}"
        print(f"{scenario['scenario']:<20} ${scenario['costs']['total_usd']:<11} {models}")
    
    print(f"\n💡 RECOMENDAÇÃO: {optimization['recomendacao']}")
    
    # Matrizes
    print("\n\n" + "=" * 90)
    print("📋 MATRIZES DE DECISÃO DO PIPELINE")
    print("=" * 90)
    
    print("""
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                           ESTÁGIO 1: EXTRAÇÃO                                           │
│                        (Seleção por VOLUME × PRIORIDADE)                                │
├─────────────┬──────────────────┬──────────────────┬──────────────────┬─────────────────┤
│ Volume      │ CRITICAL         │ HIGH             │ STANDARD         │ BULK            │
├─────────────┼──────────────────┼──────────────────┼──────────────────┼─────────────────┤
│ SINGLE      │ Opus 4.5         │ Sonnet 4         │ Sonnet 4         │ Haiku 3         │
│ SMALL       │ Sonnet 4         │ Sonnet 4         │ Sonnet 3.5       │ Nova Lite       │
│ MEDIUM      │ Sonnet 4         │ Sonnet 3.5       │ Nova Pro         │ Nova Lite       │
│ LARGE       │ Sonnet 3.5       │ Nova Pro         │ Nova Lite        │ Nova Micro      │
│ MASSIVE     │ Nova Premier     │ Nova Premier     │ Nova Lite        │ Nova Micro      │
└─────────────┴──────────────────┴──────────────────┴──────────────────┴─────────────────┘

┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                           ESTÁGIO 2: ANÁLISE                                            │
│                       (Seleção por QUALIDADE × PRIORIDADE)                              │
├─────────────┬──────────────────┬──────────────────┬──────────────────┬─────────────────┤
│ Qualidade   │ CRITICAL         │ HIGH             │ STANDARD         │ BULK            │
├─────────────┼──────────────────┼──────────────────┼──────────────────┼─────────────────┤
│ PERFECT     │ Opus 4.5         │ Sonnet 3.7 (ET)  │ Sonnet 3.7 (ET)  │ Sonnet 4        │
│ HIGH        │ Sonnet 3.7 (ET)  │ Sonnet 4         │ DeepSeek-R1 (ET) │ Sonnet 3.5      │
│ STANDARD    │ Sonnet 4         │ DeepSeek-R1      │ Sonnet 3.5       │ Nova Pro        │
│ DRAFT       │ Sonnet 3.5       │ Haiku 3          │ Nova Pro         │ Nova Lite       │
└─────────────┴──────────────────┴──────────────────┴──────────────────┴─────────────────┘
(ET) = Extended Thinking ativado

┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                           ESTÁGIO 3: REDAÇÃO                                            │
│                       (Seleção por VELOCIDADE × PRIORIDADE)                             │
├─────────────┬──────────────────┬──────────────────┬──────────────────┬─────────────────┤
│ Velocidade  │ CRITICAL         │ HIGH             │ STANDARD         │ BULK            │
├─────────────┼──────────────────┼──────────────────┼──────────────────┼─────────────────┤
│ URGENT      │ Sonnet 4         │ Haiku 3          │ Haiku 3          │ Nova Lite       │
│ FAST        │ Opus 4.5         │ Sonnet 4         │ Sonnet 3.5       │ Haiku 3         │
│ NORMAL      │ Opus 4.5         │ Sonnet 4         │ Sonnet 4         │ Sonnet 3.5      │
│ RELAXED     │ Opus 4.5         │ Opus 4.5         │ Sonnet 4         │ Sonnet 4        │
└─────────────┴──────────────────┴──────────────────┴──────────────────┴─────────────────┘

┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                           ESTÁGIO 4: AUDITORIA                                          │
│                    (Seleção por PROFUNDIDADE × PRIORIDADE)                              │
│                  ⚠️ SEMPRE modelo diferente da redação!                                 │
├─────────────┬──────────────────┬──────────────────┬──────────────────┬─────────────────┤
│ Profundidade│ CRITICAL         │ HIGH             │ STANDARD         │ BULK            │
├─────────────┼──────────────────┼──────────────────┼──────────────────┼─────────────────┤
│ DEEP        │ Opus 4.5         │ Sonnet 3.7       │ Sonnet 4         │ Sonnet 3.5      │
│ STANDARD    │ Sonnet 3.7       │ Sonnet 4         │ Sonnet 3.5       │ Haiku 3         │
│ LIGHT       │ Sonnet 4         │ Haiku 3          │ Haiku 3          │ Nova Lite       │
└─────────────┴──────────────────┴──────────────────┴──────────────────┴─────────────────┘
""")
    
    # Fluxo do Pipeline
    print("""
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                         FLUXO DO PIPELINE DE PRODUÇÃO                                   │
└─────────────────────────────────────────────────────────────────────────────────────────┘

    ┌─────────────┐      ┌─────────────┐      ┌─────────────┐      ┌─────────────┐
    │  EXTRAÇÃO   │ ───▶ │  ANÁLISE    │ ───▶ │  REDAÇÃO    │ ───▶ │  AUDITORIA  │
    │             │      │             │      │             │      │             │
    │ • OCR       │      │ • Fichamento│      │ • Petição   │      │ • Revisão   │
    │ • Parsing   │      │ • Resumo    │      │ • Recurso   │      │ • Checklist │
    │ • Dados     │      │ • Teses     │      │ • Parecer   │      │ • Score     │
    └─────────────┘      └─────────────┘      └─────────────┘      └─────────────┘
          │                    │                    │                    │
          ▼                    ▼                    ▼                    ▼
    ┌─────────────┐      ┌─────────────┐      ┌─────────────┐      ┌─────────────┐
    │ Modelo por  │      │ Modelo por  │      │ Modelo por  │      │ Modelo      │
    │ VOLUME      │      │ QUALIDADE   │      │ VELOCIDADE  │      │ DIFERENTE   │
    └─────────────┘      └─────────────┘      └─────────────┘      └─────────────┘

    ════════════════════════════════════════════════════════════════════════════
                              OTIMIZAÇÃO AUTOMÁTICA
    ════════════════════════════════════════════════════════════════════════════
    
    Contexto do Processo:
    • Tribunal (STJ/STF → CRITICAL)
    • Prazo (< 24h → URGENT)
    • Valor (> 1M → HIGH)
    • Criminal com liberdade → CRITICAL
    • Cliente VIP → CRITICAL
    
    ────────────────────────────────────────────────────────────────────────────
                         RESULTADO: Qualidade Irretocável + Custo Otimizado
    ────────────────────────────────────────────────────────────────────────────
""")


if __name__ == "__main__":
    demo()
