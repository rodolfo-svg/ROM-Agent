#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
╔══════════════════════════════════════════════════════════════════════════════════════════╗
║                          ROM AGENT v2.0 - MULTI-MODEL ROUTER                             ║
║                                                                                          ║
║  Sistema Inteligente de Roteamento Multi-LLM para Agente Jurídico                       ║
║  Autor: Rodolfo Otávio Mota - Advogados Associados                                      ║
║  AWS Bedrock Region: us-west-2 (Oregon)                                                 ║
║                                                                                          ║
║  Funcionalidades:                                                                        ║
║  • 28 modelos de 5 providers (Anthropic, Amazon, Meta, Mistral, DeepSeek)              ║
║  • 94 tarefas jurídicas mapeadas em 7 tiers                                            ║
║  • Seleção manual do frontend com prioridade máxima                                     ║
║  • Detecção inteligente de override por keywords/contexto                              ║
║  • Análise completa de custos com projeção mensal                                      ║
║  • Circuit breaker e fallback automático                                               ║
╚══════════════════════════════════════════════════════════════════════════════════════════╝

USO BÁSICO:
    from rom_agent_v2_final import ROMAgent
    
    agent = ROMAgent()
    
    # Roteamento automático
    decision = agent.route("recurso_especial", "Elabore o recurso")
    
    # Com seleção manual do frontend
    decision = agent.route("peticao_inicial", "...", selected_model="claude-sonnet-4")
    
    # Análise de custos
    cost = agent.estimate_task_cost("recurso_especial")
    projection = agent.project_monthly_cost({"recurso_especial": 10, "contestacao": 30})
"""

import re
import json
import logging
from enum import Enum
from typing import Dict, List, Optional, Any, Tuple
from dataclasses import dataclass, field
from datetime import datetime
from abc import ABC, abstractmethod

# ══════════════════════════════════════════════════════════════════════════════════════════
# CONFIGURAÇÃO DE LOGGING
# ══════════════════════════════════════════════════════════════════════════════════════════

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger("ROMAgent")


# ══════════════════════════════════════════════════════════════════════════════════════════
# PARTE 1: ENUMERAÇÕES E TIPOS BASE
# ══════════════════════════════════════════════════════════════════════════════════════════

class ModelTier(Enum):
    """Tiers de qualidade/performance"""
    PREMIUM = "premium"
    ANALYTICAL = "analytical"
    BALANCED = "balanced"
    FAST = "fast"
    ECONOMY = "economy"
    CODE = "code"
    VISION = "vision"


class ModelProvider(Enum):
    """Providers de LLM no Bedrock"""
    ANTHROPIC = "anthropic"
    AMAZON = "amazon"
    META = "meta"
    MISTRAL = "mistral"
    DEEPSEEK = "deepseek"


class DecisionType(Enum):
    """Tipo de decisão de roteamento"""
    USER_SELECTED = "user_selected"      # Frontend (PRIORIDADE MÁXIMA)
    USER_OVERRIDE = "user_override"      # Keywords na mensagem
    CONTEXTUAL_AUTO = "contextual_auto"  # Contexto processual
    TASK_DEFAULT = "task_default"        # Padrão da tarefa
    FALLBACK = "fallback"                # Modelo de fallback


# ══════════════════════════════════════════════════════════════════════════════════════════
# PARTE 2: DATACLASSES
# ══════════════════════════════════════════════════════════════════════════════════════════

@dataclass
class ModelPricing:
    """Preços por 1000 tokens (USD)"""
    input_per_1k: float
    output_per_1k: float
    cache_write_per_1k: float = 0.0
    cache_read_per_1k: float = 0.0
    
    def calculate(self, input_tokens: int, output_tokens: int, cached: int = 0) -> float:
        regular = input_tokens - cached
        return (
            (regular / 1000) * self.input_per_1k +
            (cached / 1000) * self.cache_read_per_1k +
            (output_tokens / 1000) * self.output_per_1k
        )


@dataclass
class ModelConfig:
    """Configuração de modelo LLM"""
    model_id: str
    provider: ModelProvider
    display_name: str
    quality_score: int
    speed_score: int
    cost_score: int
    context_window: int
    max_output_tokens: int
    pricing: ModelPricing
    supports_vision: bool = False
    supports_extended_thinking: bool = False
    supports_tool_use: bool = True
    supports_streaming: bool = True
    supports_prompt_cache: bool = False
    strengths: List[str] = field(default_factory=list)
    best_for: List[str] = field(default_factory=list)


@dataclass
class RoutingDecision:
    """Resultado do roteamento"""
    model_id: str
    model_name: str
    tier: ModelTier
    decision_type: DecisionType
    confidence: float
    reason: str
    fallback_model_id: Optional[str] = None
    fallback_model_name: Optional[str] = None
    use_extended_thinking: bool = False
    max_tokens: int = 8000
    temperature: float = 0.4
    triggers_matched: List[str] = field(default_factory=list)


@dataclass
class CostEstimate:
    """Estimativa de custo"""
    model_key: str
    model_name: str
    input_tokens: int
    output_tokens: int
    total_cost_usd: float
    total_cost_brl: float


# ══════════════════════════════════════════════════════════════════════════════════════════
# PARTE 3: CATÁLOGO DE MODELOS (28 MODELOS)
# ══════════════════════════════════════════════════════════════════════════════════════════

MODEL_CATALOG: Dict[str, ModelConfig] = {
    
    # ═══════════════════════════════════════════════════════════════════════════════════════
    # ANTHROPIC CLAUDE (7 modelos)
    # ═══════════════════════════════════════════════════════════════════════════════════════
    
    "claude-opus-4.5": ModelConfig(
        model_id="anthropic.claude-opus-4-5-20251101-v1:0",
        provider=ModelProvider.ANTHROPIC,
        display_name="Claude Opus 4.5",
        quality_score=10, speed_score=4, cost_score=10,
        context_window=200000, max_output_tokens=32000,
        pricing=ModelPricing(0.015, 0.075, 0.01875, 0.0015),
        supports_vision=True, supports_extended_thinking=True, supports_prompt_cache=True,
        strengths=["Máxima qualidade", "Raciocínio excepcional", "Análise complexa"],
        best_for=["STJ/STF", "Pareceres complexos", "Clientes VIP"]
    ),
    
    "claude-sonnet-4": ModelConfig(
        model_id="anthropic.claude-sonnet-4-20250514-v1:0",
        provider=ModelProvider.ANTHROPIC,
        display_name="Claude Sonnet 4",
        quality_score=9, speed_score=7, cost_score=6,
        context_window=200000, max_output_tokens=16000,
        pricing=ModelPricing(0.003, 0.015, 0.00375, 0.0003),
        supports_vision=True, supports_extended_thinking=True, supports_prompt_cache=True,
        strengths=["Equilíbrio qualidade/velocidade", "Custo-benefício"],
        best_for=["Volume diário", "Petições 1º/2º grau", "Contestações"]
    ),
    
    "claude-sonnet-3.7": ModelConfig(
        model_id="anthropic.claude-3-7-sonnet-20250219-v1:0",
        provider=ModelProvider.ANTHROPIC,
        display_name="Claude 3.7 Sonnet",
        quality_score=9, speed_score=6, cost_score=6,
        context_window=200000, max_output_tokens=16000,
        pricing=ModelPricing(0.003, 0.015, 0.00375, 0.0003),
        supports_vision=True, supports_extended_thinking=True, supports_prompt_cache=True,
        strengths=["Extended thinking nativo", "Raciocínio em cadeia"],
        best_for=["Análise jurisprudencial", "Teses complexas", "Contradições"]
    ),
    
    "claude-sonnet-3.5": ModelConfig(
        model_id="anthropic.claude-3-5-sonnet-20241022-v2:0",
        provider=ModelProvider.ANTHROPIC,
        display_name="Claude 3.5 Sonnet",
        quality_score=8, speed_score=7, cost_score=5,
        context_window=200000, max_output_tokens=8192,
        pricing=ModelPricing(0.003, 0.015, 0.00375, 0.0003),
        supports_vision=True, supports_prompt_cache=True,
        strengths=["Versátil", "Estável", "Confiável"],
        best_for=["Petições intermediárias", "Backup"]
    ),
    
    "claude-opus-3": ModelConfig(
        model_id="anthropic.claude-3-opus-20240229-v1:0",
        provider=ModelProvider.ANTHROPIC,
        display_name="Claude 3 Opus",
        quality_score=9, speed_score=4, cost_score=9,
        context_window=200000, max_output_tokens=4096,
        pricing=ModelPricing(0.015, 0.075, 0.01875, 0.0015),
        supports_vision=True, supports_prompt_cache=True,
        strengths=["Alta qualidade", "Raciocínio sofisticado"],
        best_for=["Fallback premium"]
    ),
    
    "claude-haiku-3": ModelConfig(
        model_id="anthropic.claude-3-haiku-20240307-v1:0",
        provider=ModelProvider.ANTHROPIC,
        display_name="Claude 3 Haiku",
        quality_score=6, speed_score=10, cost_score=2,
        context_window=200000, max_output_tokens=4096,
        pricing=ModelPricing(0.00025, 0.00125, 0.0003, 0.00003),
        supports_vision=True, supports_prompt_cache=True,
        strengths=["Extremamente rápido", "Muito barato"],
        best_for=["Triagem", "Checklists", "Urgências"]
    ),
    
    "claude-2": ModelConfig(
        model_id="anthropic.claude-v2:1",
        provider=ModelProvider.ANTHROPIC,
        display_name="Claude 2",
        quality_score=6, speed_score=6, cost_score=4,
        context_window=100000, max_output_tokens=4096,
        pricing=ModelPricing(0.008, 0.024),
        supports_tool_use=False,
        strengths=["Legado estável"],
        best_for=["Compatibilidade", "Último fallback"]
    ),
    
    # ═══════════════════════════════════════════════════════════════════════════════════════
    # AMAZON NOVA (5 modelos)
    # ═══════════════════════════════════════════════════════════════════════════════════════
    
    "nova-premier": ModelConfig(
        model_id="amazon.nova-premier-v1:0",
        provider=ModelProvider.AMAZON,
        display_name="Amazon Nova Premier",
        quality_score=8, speed_score=6, cost_score=7,
        context_window=1000000, max_output_tokens=16000,
        pricing=ModelPricing(0.0025, 0.0125),
        supports_vision=True,
        strengths=["Contexto 1M tokens", "Documentos longos"],
        best_for=["Processos volumosos", "Múltiplos documentos"]
    ),
    
    "nova-pro": ModelConfig(
        model_id="amazon.nova-pro-v1:0",
        provider=ModelProvider.AMAZON,
        display_name="Amazon Nova Pro",
        quality_score=7, speed_score=7, cost_score=4,
        context_window=300000, max_output_tokens=8000,
        pricing=ModelPricing(0.0008, 0.0032),
        supports_vision=True,
        strengths=["Bom contexto", "Custo competitivo"],
        best_for=["Backup Sonnet", "Documentos longos"]
    ),
    
    "nova-lite": ModelConfig(
        model_id="amazon.nova-lite-v1:0",
        provider=ModelProvider.AMAZON,
        display_name="Amazon Nova Lite",
        quality_score=5, speed_score=9, cost_score=2,
        context_window=300000, max_output_tokens=4000,
        pricing=ModelPricing(0.00006, 0.00024),
        supports_vision=True,
        strengths=["Muito rápido", "Muito barato"],
        best_for=["Alto volume", "Docs simples"]
    ),
    
    "nova-lite-2": ModelConfig(
        model_id="amazon.nova-lite-v2:0",
        provider=ModelProvider.AMAZON,
        display_name="Amazon Nova 2 Lite",
        quality_score=5, speed_score=9, cost_score=2,
        context_window=300000, max_output_tokens=4000,
        pricing=ModelPricing(0.00006, 0.00024),
        supports_vision=True,
        strengths=["Versão atualizada"],
        best_for=["Alto volume", "Economia"]
    ),
    
    "nova-micro": ModelConfig(
        model_id="amazon.nova-micro-v1:0",
        provider=ModelProvider.AMAZON,
        display_name="Amazon Nova Micro",
        quality_score=4, speed_score=10, cost_score=1,
        context_window=128000, max_output_tokens=2000,
        pricing=ModelPricing(0.000035, 0.00014),
        strengths=["O mais barato", "Ultra rápido"],
        best_for=["Classificação", "Routing"]
    ),
    
    # ═══════════════════════════════════════════════════════════════════════════════════════
    # META LLAMA (8 modelos)
    # ═══════════════════════════════════════════════════════════════════════════════════════
    
    "llama-4": ModelConfig(
        model_id="meta.llama4-maverick-17b-instruct-v1:0",
        provider=ModelProvider.META,
        display_name="Llama 4",
        quality_score=8, speed_score=7, cost_score=4,
        context_window=128000, max_output_tokens=8000,
        pricing=ModelPricing(0.00045, 0.00054),
        supports_vision=True,
        strengths=["Mais recente Meta", "Bom raciocínio"],
        best_for=["Análises técnicas", "Backup versátil"]
    ),
    
    "llama-3.3-70b": ModelConfig(
        model_id="meta.llama3-3-70b-instruct-v1:0",
        provider=ModelProvider.META,
        display_name="Llama 3.3 70B",
        quality_score=8, speed_score=5, cost_score=5,
        context_window=128000, max_output_tokens=4096,
        pricing=ModelPricing(0.00072, 0.00072),
        strengths=["Modelo grande", "Bom raciocínio"],
        best_for=["Análises complexas", "Backup analytical"]
    ),
    
    "llama-3.3-18b": ModelConfig(
        model_id="meta.llama3-3-18b-instruct-v1:0",
        provider=ModelProvider.META,
        display_name="Llama 3.3 18B",
        quality_score=6, speed_score=8, cost_score=3,
        context_window=128000, max_output_tokens=4096,
        pricing=ModelPricing(0.0003, 0.0003),
        strengths=["Rápido", "Bom custo"],
        best_for=["Tarefas médias", "Backup rápido"]
    ),
    
    "llama-3.2": ModelConfig(
        model_id="meta.llama3-2-11b-instruct-v1:0",
        provider=ModelProvider.META,
        display_name="Llama 3.2",
        quality_score=6, speed_score=8, cost_score=3,
        context_window=128000, max_output_tokens=4096,
        pricing=ModelPricing(0.00016, 0.00016),
        supports_vision=True,
        strengths=["Multimodal", "Rápido"],
        best_for=["Análise de imagens"]
    ),
    
    "llama-3.1-70b": ModelConfig(
        model_id="meta.llama3-1-70b-instruct-v1:0",
        provider=ModelProvider.META,
        display_name="Llama 3.1 70B",
        quality_score=7, speed_score=5, cost_score=5,
        context_window=128000, max_output_tokens=4096,
        pricing=ModelPricing(0.00072, 0.00072),
        strengths=["Versão estável"],
        best_for=["Fallback confiável"]
    ),
    
    "llama-3.1-8b": ModelConfig(
        model_id="meta.llama3-1-8b-instruct-v1:0",
        provider=ModelProvider.META,
        display_name="Llama 3.1 8B",
        quality_score=5, speed_score=9, cost_score=2,
        context_window=128000, max_output_tokens=4096,
        pricing=ModelPricing(0.00022, 0.00022),
        strengths=["Muito rápido", "Muito barato"],
        best_for=["Triagem", "Alto volume"]
    ),
    
    "llama-3-70b": ModelConfig(
        model_id="meta.llama3-70b-instruct-v1:0",
        provider=ModelProvider.META,
        display_name="Llama 3 70B",
        quality_score=7, speed_score=5, cost_score=5,
        context_window=8192, max_output_tokens=4096,
        pricing=ModelPricing(0.00265, 0.0035),
        strengths=["Estável"],
        best_for=["Legado"]
    ),
    
    "llama-2-70b": ModelConfig(
        model_id="meta.llama2-70b-chat-v1",
        provider=ModelProvider.META,
        display_name="Llama 2 70B",
        quality_score=5, speed_score=5, cost_score=4,
        context_window=4096, max_output_tokens=2048,
        pricing=ModelPricing(0.00195, 0.00256),
        supports_tool_use=False,
        strengths=["Legado"],
        best_for=["Último fallback"]
    ),
    
    # ═══════════════════════════════════════════════════════════════════════════════════════
    # MISTRAL AI (6 modelos)
    # ═══════════════════════════════════════════════════════════════════════════════════════
    
    "mistral-pixtral-large": ModelConfig(
        model_id="mistral.pixtral-large-2502-v1:0",
        provider=ModelProvider.MISTRAL,
        display_name="Mistral Pixtral Large",
        quality_score=8, speed_score=6, cost_score=6,
        context_window=128000, max_output_tokens=8000,
        pricing=ModelPricing(0.002, 0.006),
        supports_vision=True,
        strengths=["Excelente visão", "OCR avançado"],
        best_for=["Documentos escaneados", "OCR"]
    ),
    
    "mistral-large-3": ModelConfig(
        model_id="mistral.mistral-large-2411-v1:0",
        provider=ModelProvider.MISTRAL,
        display_name="Mistral Large 3",
        quality_score=8, speed_score=6, cost_score=5,
        context_window=128000, max_output_tokens=8000,
        pricing=ModelPricing(0.002, 0.006),
        strengths=["Boa qualidade", "Custo competitivo"],
        best_for=["Análises textuais"]
    ),
    
    "ministral-14b": ModelConfig(
        model_id="mistral.ministral-3-14b-instruct-v1:0",
        provider=ModelProvider.MISTRAL,
        display_name="Ministral 14B",
        quality_score=6, speed_score=8, cost_score=3,
        context_window=128000, max_output_tokens=4000,
        pricing=ModelPricing(0.0001, 0.0001),
        strengths=["Rápido", "Bom custo"],
        best_for=["Tarefas intermediárias"]
    ),
    
    "ministral-8b": ModelConfig(
        model_id="mistral.ministral-3-8b-instruct-v1:0",
        provider=ModelProvider.MISTRAL,
        display_name="Ministral 8B",
        quality_score=5, speed_score=9, cost_score=2,
        context_window=128000, max_output_tokens=4000,
        pricing=ModelPricing(0.0001, 0.0001),
        strengths=["Muito rápido", "Barato"],
        best_for=["Triagem", "Volume"]
    ),
    
    "ministral-3b": ModelConfig(
        model_id="mistral.ministral-3-3b-instruct-v1:0",
        provider=ModelProvider.MISTRAL,
        display_name="Ministral 3B",
        quality_score=4, speed_score=10, cost_score=1,
        context_window=128000, max_output_tokens=2000,
        pricing=ModelPricing(0.00004, 0.00004),
        strengths=["Ultra rápido", "Ultra barato"],
        best_for=["Classificação", "Routing"]
    ),
    
    "mistral-7b": ModelConfig(
        model_id="mistral.mistral-7b-instruct-v0:2",
        provider=ModelProvider.MISTRAL,
        display_name="Mistral 7B",
        quality_score=5, speed_score=9, cost_score=2,
        context_window=32000, max_output_tokens=4000,
        pricing=ModelPricing(0.00015, 0.0002),
        supports_tool_use=False,
        strengths=["Rápido", "Barato"],
        best_for=["Fallback economy"]
    ),
    
    # ═══════════════════════════════════════════════════════════════════════════════════════
    # DEEPSEEK (2 modelos)
    # ═══════════════════════════════════════════════════════════════════════════════════════
    
    "deepseek-r1": ModelConfig(
        model_id="deepseek.deepseek-r1-v1:0",
        provider=ModelProvider.DEEPSEEK,
        display_name="DeepSeek-R1",
        quality_score=9, speed_score=5, cost_score=4,
        context_window=128000, max_output_tokens=8000,
        pricing=ModelPricing(0.00135, 0.0054),
        supports_extended_thinking=True,
        strengths=["Raciocínio excepcional", "Código", "Matemática"],
        best_for=["Cálculos", "Lógica complexa", "Automações"]
    ),
    
    "deepseek-v2": ModelConfig(
        model_id="deepseek.deepseek-v2-chat-v1:0",
        provider=ModelProvider.DEEPSEEK,
        display_name="DeepSeek v2",
        quality_score=7, speed_score=7, cost_score=3,
        context_window=128000, max_output_tokens=4000,
        pricing=ModelPricing(0.00014, 0.00028),
        strengths=["Bom custo", "Versátil"],
        best_for=["Backup cálculos"]
    ),
}


# ══════════════════════════════════════════════════════════════════════════════════════════
# PARTE 4: CONFIGURAÇÃO DE TIERS (Rankings de modelos)
# ══════════════════════════════════════════════════════════════════════════════════════════

MODEL_TIERS: Dict[ModelTier, Dict[str, Any]] = {
    
    ModelTier.PREMIUM: {
        "description": "Máxima qualidade para Tribunais Superiores",
        "ranking": [
            "claude-opus-4.5", "claude-sonnet-4", "claude-opus-3",
            "claude-sonnet-3.7", "claude-sonnet-3.5"
        ],
        "auto_triggers": ["STJ", "STF", "TST", "recurso especial", "recurso extraordinário"]
    },
    
    ModelTier.ANALYTICAL: {
        "description": "Raciocínio profundo com extended thinking",
        "ranking": [
            "claude-sonnet-3.7", "deepseek-r1", "claude-opus-4.5",
            "claude-sonnet-4", "llama-3.3-70b", "llama-3.1-70b", "llama-3-70b"
        ],
        "use_extended_thinking": True,
        "auto_triggers": ["análise profunda", "jurisprudência", "contradições"]
    },
    
    ModelTier.BALANCED: {
        "description": "Equilíbrio para volume diário",
        "ranking": [
            "claude-sonnet-4", "claude-sonnet-3.5", "nova-pro",
            "mistral-large-3", "llama-3.3-70b", "llama-4",
            "llama-3.1-70b", "llama-3-70b", "deepseek-v2", "nova-premier"
        ]
    },
    
    ModelTier.FAST: {
        "description": "Velocidade máxima para urgências",
        "ranking": [
            "claude-haiku-3", "nova-lite", "nova-lite-2", "nova-micro",
            "ministral-8b", "ministral-3b", "llama-3.1-8b",
            "llama-3.3-18b", "ministral-14b", "llama-3.2", "mistral-7b"
        ],
        "auto_triggers": ["urgente", "rápido", "prazo hoje", "rascunho"]
    },
    
    ModelTier.ECONOMY: {
        "description": "Alto volume com custo mínimo",
        "ranking": [
            "nova-lite", "nova-lite-2", "nova-micro", "ministral-3b",
            "mistral-7b", "llama-3.1-8b", "llama-2-70b", "claude-2"
        ],
        "auto_triggers": ["simples", "básico", "procuração", "declaração"]
    },
    
    ModelTier.CODE: {
        "description": "Cálculos e automações",
        "ranking": [
            "deepseek-r1", "claude-sonnet-4", "claude-sonnet-3.5",
            "llama-3.3-70b", "deepseek-v2", "llama-3.1-70b",
            "llama-4", "mistral-large-3"
        ],
        "auto_triggers": ["cálculo", "calcular", "código", "script"]
    },
    
    ModelTier.VISION: {
        "description": "Análise de imagens e documentos",
        "ranking": [
            "claude-opus-4.5", "claude-sonnet-4", "mistral-pixtral-large",
            "nova-premier", "llama-3.2", "llama-4", "nova-pro", "nova-lite"
        ],
        "auto_triggers": ["imagem", "foto", "escaneado", "OCR"]
    },
}


# ══════════════════════════════════════════════════════════════════════════════════════════
# PARTE 5: MAPEAMENTO DE TAREFAS JURÍDICAS (94 tarefas)
# ══════════════════════════════════════════════════════════════════════════════════════════

LEGAL_TASKS: Dict[str, Dict[str, Any]] = {
    
    # ═══════════════════════════════════════════════════════════════════════════════════════
    # PREMIUM (14 tarefas)
    # ═══════════════════════════════════════════════════════════════════════════════════════
    
    "recurso_especial": {"tier": ModelTier.PREMIUM, "tokens": (8000, 12000), "temp": 0.3},
    "agravo_em_recurso_especial": {"tier": ModelTier.PREMIUM, "tokens": (6000, 10000), "temp": 0.3},
    "embargos_divergencia_stj": {"tier": ModelTier.PREMIUM, "tokens": (8000, 12000), "temp": 0.3},
    "recurso_extraordinario": {"tier": ModelTier.PREMIUM, "tokens": (8000, 12000), "temp": 0.3},
    "agravo_em_recurso_extraordinario": {"tier": ModelTier.PREMIUM, "tokens": (6000, 10000), "temp": 0.3},
    "reclamacao_constitucional": {"tier": ModelTier.PREMIUM, "tokens": (6000, 10000), "temp": 0.3},
    "adpf": {"tier": ModelTier.PREMIUM, "tokens": (8000, 14000), "temp": 0.3},
    "habeas_corpus_stj": {"tier": ModelTier.PREMIUM, "tokens": (5000, 8000), "temp": 0.3},
    "habeas_corpus_stf": {"tier": ModelTier.PREMIUM, "tokens": (5000, 8000), "temp": 0.3},
    "memoriais_tribunal_superior": {"tier": ModelTier.PREMIUM, "tokens": (6000, 6000), "temp": 0.4},
    "parecer_juridico_complexo": {"tier": ModelTier.PREMIUM, "tokens": (10000, 15000), "temp": 0.4},
    "acao_rescisoria": {"tier": ModelTier.PREMIUM, "tokens": (8000, 12000), "temp": 0.3},
    "acao_civil_publica": {"tier": ModelTier.PREMIUM, "tokens": (10000, 15000), "temp": 0.4},
    "mandado_injuncao": {"tier": ModelTier.PREMIUM, "tokens": (6000, 10000), "temp": 0.3},
    
    # ═══════════════════════════════════════════════════════════════════════════════════════
    # ANALYTICAL (9 tarefas)
    # ═══════════════════════════════════════════════════════════════════════════════════════
    
    "analise_jurisprudencial_completa": {"tier": ModelTier.ANALYTICAL, "tokens": (15000, 10000), "temp": 0.4, "extended": True},
    "analise_contradicoes_provas": {"tier": ModelTier.ANALYTICAL, "tokens": (10000, 8000), "temp": 0.3, "extended": True},
    "construcao_tese_defesa_criminal": {"tier": ModelTier.ANALYTICAL, "tokens": (8000, 12000), "temp": 0.4, "extended": True},
    "apelacao_criminal_complexa": {"tier": ModelTier.ANALYTICAL, "tokens": (8000, 12000), "temp": 0.3, "extended": True},
    "agravo_interno": {"tier": ModelTier.ANALYTICAL, "tokens": (4000, 6000), "temp": 0.3},
    "embargos_declaracao_prequestionamento": {"tier": ModelTier.ANALYTICAL, "tokens": (3000, 5000), "temp": 0.3},
    "responsabilidade_civil_estado": {"tier": ModelTier.ANALYTICAL, "tokens": (8000, 12000), "temp": 0.4, "extended": True},
    "impugnacao_credito_falencia": {"tier": ModelTier.ANALYTICAL, "tokens": (6000, 10000), "temp": 0.3},
    "acao_revisional_contrato": {"tier": ModelTier.ANALYTICAL, "tokens": (6000, 10000), "temp": 0.4},
    
    # ═══════════════════════════════════════════════════════════════════════════════════════
    # BALANCED (30 tarefas)
    # ═══════════════════════════════════════════════════════════════════════════════════════
    
    "peticao_inicial_civel": {"tier": ModelTier.BALANCED, "tokens": (4000, 8000), "temp": 0.4},
    "peticao_inicial_familia": {"tier": ModelTier.BALANCED, "tokens": (4000, 8000), "temp": 0.4},
    "peticao_inicial_consumidor": {"tier": ModelTier.BALANCED, "tokens": (4000, 8000), "temp": 0.4},
    "peticao_inicial_trabalhista": {"tier": ModelTier.BALANCED, "tokens": (5000, 10000), "temp": 0.4},
    "contestacao": {"tier": ModelTier.BALANCED, "tokens": (5000, 8000), "temp": 0.4},
    "contestacao_reconvencao": {"tier": ModelTier.BALANCED, "tokens": (6000, 12000), "temp": 0.4},
    "replica": {"tier": ModelTier.BALANCED, "tokens": (4000, 6000), "temp": 0.4},
    "impugnacao_contestacao": {"tier": ModelTier.BALANCED, "tokens": (4000, 6000), "temp": 0.4},
    "apelacao_civel": {"tier": ModelTier.BALANCED, "tokens": (6000, 10000), "temp": 0.4},
    "apelacao_criminal": {"tier": ModelTier.BALANCED, "tokens": (6000, 10000), "temp": 0.3},
    "agravo_instrumento": {"tier": ModelTier.BALANCED, "tokens": (4000, 6000), "temp": 0.3},
    "contrarrazoes_apelacao": {"tier": ModelTier.BALANCED, "tokens": (5000, 8000), "temp": 0.4},
    "contrarrazoes_agravo": {"tier": ModelTier.BALANCED, "tokens": (3000, 5000), "temp": 0.4},
    "alegacoes_finais_civeis": {"tier": ModelTier.BALANCED, "tokens": (5000, 8000), "temp": 0.4},
    "alegacoes_finais_criminais": {"tier": ModelTier.BALANCED, "tokens": (6000, 10000), "temp": 0.3},
    "memoriais_tj": {"tier": ModelTier.BALANCED, "tokens": (4000, 6000), "temp": 0.4},
    "mandado_seguranca": {"tier": ModelTier.BALANCED, "tokens": (5000, 8000), "temp": 0.3},
    "habeas_corpus_tj": {"tier": ModelTier.BALANCED, "tokens": (4000, 6000), "temp": 0.3},
    "habeas_data": {"tier": ModelTier.BALANCED, "tokens": (3000, 5000), "temp": 0.3},
    "execucao_titulo_extrajudicial": {"tier": ModelTier.BALANCED, "tokens": (3000, 5000), "temp": 0.4},
    "execucao_titulo_judicial": {"tier": ModelTier.BALANCED, "tokens": (3000, 5000), "temp": 0.4},
    "embargos_execucao": {"tier": ModelTier.BALANCED, "tokens": (4000, 8000), "temp": 0.4},
    "impugnacao_cumprimento_sentenca": {"tier": ModelTier.BALANCED, "tokens": (4000, 6000), "temp": 0.4},
    "tutela_antecipada": {"tier": ModelTier.BALANCED, "tokens": (3000, 5000), "temp": 0.3},
    "tutela_cautelar": {"tier": ModelTier.BALANCED, "tokens": (3000, 5000), "temp": 0.3},
    "tutela_evidencia": {"tier": ModelTier.BALANCED, "tokens": (3000, 5000), "temp": 0.3},
    "embargos_declaracao_padrao": {"tier": ModelTier.BALANCED, "tokens": (2000, 3000), "temp": 0.3},
    "embargos_terceiro": {"tier": ModelTier.BALANCED, "tokens": (4000, 6000), "temp": 0.4},
    "incidente_desconsideracao_personalidade": {"tier": ModelTier.BALANCED, "tokens": (4000, 6000), "temp": 0.4},
    "excecao_pre_executividade": {"tier": ModelTier.BALANCED, "tokens": (4000, 6000), "temp": 0.4},
    
    # ═══════════════════════════════════════════════════════════════════════════════════════
    # FAST (13 tarefas)
    # ═══════════════════════════════════════════════════════════════════════════════════════
    
    "triagem_inicial": {"tier": ModelTier.FAST, "tokens": (2000, 500), "temp": 0.2},
    "extracao_dados_processo": {"tier": ModelTier.FAST, "tokens": (3000, 2000), "temp": 0.1},
    "resumo_decisao_judicial": {"tier": ModelTier.FAST, "tokens": (3000, 1000), "temp": 0.3},
    "resumo_peticao": {"tier": ModelTier.FAST, "tokens": (4000, 1500), "temp": 0.3},
    "checklist_admissibilidade_recurso": {"tier": ModelTier.FAST, "tokens": (2000, 800), "temp": 0.1},
    "checklist_peticao_inicial": {"tier": ModelTier.FAST, "tokens": (2000, 800), "temp": 0.1},
    "minuta_despacho": {"tier": ModelTier.FAST, "tokens": (1500, 1000), "temp": 0.3},
    "peticao_juntada_documentos": {"tier": ModelTier.FAST, "tokens": (500, 800), "temp": 0.3},
    "peticao_pedido_prazo": {"tier": ModelTier.FAST, "tokens": (500, 800), "temp": 0.3},
    "peticao_informacao_cumprimento": {"tier": ModelTier.FAST, "tokens": (500, 1000), "temp": 0.3},
    "rascunho_peticao": {"tier": ModelTier.FAST, "tokens": (3000, 4000), "temp": 0.5},
    "calculo_prazo_processual": {"tier": ModelTier.FAST, "tokens": (500, 500), "temp": 0.1},
    "verificacao_prescricao": {"tier": ModelTier.FAST, "tokens": (1000, 1000), "temp": 0.2},
    
    # ═══════════════════════════════════════════════════════════════════════════════════════
    # ECONOMY (13 tarefas)
    # ═══════════════════════════════════════════════════════════════════════════════════════
    
    "procuracao_ad_judicia": {"tier": ModelTier.ECONOMY, "tokens": (500, 800), "temp": 0.2},
    "procuracao_ad_judicia_et_extra": {"tier": ModelTier.ECONOMY, "tokens": (500, 1000), "temp": 0.2},
    "substabelecimento_com_reservas": {"tier": ModelTier.ECONOMY, "tokens": (300, 500), "temp": 0.2},
    "substabelecimento_sem_reservas": {"tier": ModelTier.ECONOMY, "tokens": (300, 500), "temp": 0.2},
    "declaracao_hipossuficiencia": {"tier": ModelTier.ECONOMY, "tokens": (200, 400), "temp": 0.2},
    "declaracao_residencia": {"tier": ModelTier.ECONOMY, "tokens": (200, 400), "temp": 0.2},
    "peticao_desistencia": {"tier": ModelTier.ECONOMY, "tokens": (500, 800), "temp": 0.3},
    "peticao_vista_autos": {"tier": ModelTier.ECONOMY, "tokens": (300, 500), "temp": 0.2},
    "peticao_desarquivamento": {"tier": ModelTier.ECONOMY, "tokens": (300, 600), "temp": 0.2},
    "peticao_carga_autos": {"tier": ModelTier.ECONOMY, "tokens": (300, 500), "temp": 0.2},
    "notificacao_extrajudicial_simples": {"tier": ModelTier.ECONOMY, "tokens": (500, 1500), "temp": 0.3},
    "aviso_recebimento": {"tier": ModelTier.ECONOMY, "tokens": (200, 400), "temp": 0.2},
    "termo_acordo_simples": {"tier": ModelTier.ECONOMY, "tokens": (500, 1500), "temp": 0.3},
    
    # ═══════════════════════════════════════════════════════════════════════════════════════
    # CODE (9 tarefas)
    # ═══════════════════════════════════════════════════════════════════════════════════════
    
    "calculo_liquidacao_sentenca": {"tier": ModelTier.CODE, "tokens": (3000, 4000), "temp": 0.1},
    "calculo_custas_processuais": {"tier": ModelTier.CODE, "tokens": (1500, 2000), "temp": 0.1},
    "calculo_honorarios_sucumbenciais": {"tier": ModelTier.CODE, "tokens": (1500, 2000), "temp": 0.1},
    "calculo_correcao_monetaria": {"tier": ModelTier.CODE, "tokens": (2000, 3000), "temp": 0.1},
    "calculo_juros_moratorios": {"tier": ModelTier.CODE, "tokens": (1500, 2000), "temp": 0.1},
    "calculo_trabalhista": {"tier": ModelTier.CODE, "tokens": (3000, 5000), "temp": 0.1},
    "script_automacao_juridica": {"tier": ModelTier.CODE, "tokens": (2000, 5000), "temp": 0.2},
    "parser_documento_juridico": {"tier": ModelTier.CODE, "tokens": (3000, 4000), "temp": 0.1},
    "geracao_planilha_calculo": {"tier": ModelTier.CODE, "tokens": (2000, 4000), "temp": 0.2},
    
    # ═══════════════════════════════════════════════════════════════════════════════════════
    # VISION (6 tarefas)
    # ═══════════════════════════════════════════════════════════════════════════════════════
    
    "ocr_documento_escaneado": {"tier": ModelTier.VISION, "tokens": (5000, 3000), "temp": 0.1},
    "analise_documento_fotografado": {"tier": ModelTier.VISION, "tokens": (4000, 3000), "temp": 0.2},
    "analise_prova_fotografica": {"tier": ModelTier.VISION, "tokens": (3000, 2000), "temp": 0.3},
    "verificacao_autenticidade_documento": {"tier": ModelTier.VISION, "tokens": (3000, 2000), "temp": 0.2},
    "extracao_dados_cartorio": {"tier": ModelTier.VISION, "tokens": (4000, 3000), "temp": 0.1},
    "analise_laudo_pericial_imagem": {"tier": ModelTier.VISION, "tokens": (5000, 4000), "temp": 0.3},
}


# ══════════════════════════════════════════════════════════════════════════════════════════
# PARTE 6: SISTEMA DE OVERRIDE (Keywords e Patterns)
# ══════════════════════════════════════════════════════════════════════════════════════════

OVERRIDE_TRIGGERS = {
    
    ModelTier.PREMIUM: {
        "keywords": [
            "excelência máxima", "qualidade máxima", "impecável", "perfeito",
            "caprichar", "não pode ter erro", "máximo cuidado",
            "stj", "stf", "tst", "tse", "stm", "cnj",
            "recurso especial", "recurso extraordinário", "repercussão geral",
            "cliente vip", "caso importante", "liberdade em jogo"
        ],
        "patterns": [
            r"precis[ao] (estar|ficar) perfeit[oa]",
            r"máxim[oa] qualidade",
            r"tribunal.*(superior|supremo)",
            r"não (pode|posso) errar"
        ]
    },
    
    ModelTier.ANALYTICAL: {
        "keywords": [
            "analisar profundamente", "análise profunda", "análise detalhada",
            "verificar contradições", "raciocínio complexo", "passo a passo",
            "pesquisa jurisprudencial", "construir tese", "extended thinking"
        ],
        "patterns": [
            r"analis[ae]r? (com|em) profundidade",
            r"pens[ae]r? (bem|bastante) antes",
            r"verificar?.*(contradições|inconsistências)"
        ]
    },
    
    ModelTier.FAST: {
        "keywords": [
            "urgente", "urgentíssimo", "rápido", "agora", "imediato",
            "prazo hoje", "vence hoje", "audiência agora",
            "só um rascunho", "prévia", "versão inicial", "draft"
        ],
        "patterns": [
            r"prazo.*(hoje|amanhã|horas?|minutos?)",
            r"(preciso|quero).*(rápido|urgente|agora)",
            r"(só|apenas).*(rascunho|esboço|ideia)",
            r"em \d+ (horas?|minutos?)"
        ]
    },
    
    ModelTier.ECONOMY: {
        "keywords": [
            "simples", "básico", "padrão", "template",
            "procuração", "substabelecimento", "declaração", "juntada"
        ],
        "patterns": [
            r"(só|apenas).*(procuração|declaração|juntada)",
            r"documento.*(simples|básico|padrão)"
        ]
    },
    
    ModelTier.CODE: {
        "keywords": [
            "calcular", "cálculo", "fazer as contas", "correção monetária",
            "juros", "honorários", "código", "script", "automação", "planilha"
        ],
        "patterns": [
            r"calcul[ae]r?.*(valores?|juros|correção|honorários)",
            r"(fazer|gerar).*(cálculo|planilha|script)"
        ]
    },
    
    ModelTier.VISION: {
        "keywords": [
            "imagem", "foto", "escaneado", "digitalizado", "ocr",
            "extrair texto", "documento físico", "analisar foto"
        ],
        "patterns": [
            r"(analisar|extrair).*(imagem|foto|documento escaneado)",
            r"documento.*(escaneado|digitalizado)"
        ]
    }
}


# ══════════════════════════════════════════════════════════════════════════════════════════
# PARTE 7: CLASSE PRINCIPAL - ROMAgentRouter
# ══════════════════════════════════════════════════════════════════════════════════════════

class ROMAgentRouter:
    """Roteador inteligente multi-modelo"""
    
    def __init__(self):
        self.catalog = MODEL_CATALOG
        self.tiers = MODEL_TIERS
        self.tasks = LEGAL_TASKS
        self.triggers = OVERRIDE_TRIGGERS
    
    def route(
        self,
        task_type: str,
        user_message: str,
        context: Optional[Dict[str, Any]] = None,
        selected_model: Optional[str] = None
    ) -> RoutingDecision:
        """
        Roteamento com prioridades:
        1. Seleção manual do frontend (MÁXIMA)
        2. Override por keywords
        3. Contexto processual
        4. Padrão da tarefa
        """
        
        context = context or {}
        
        # 1. PRIORIDADE MÁXIMA: Seleção manual
        if selected_model:
            decision = self._from_manual_selection(selected_model, task_type)
            if decision:
                return decision
        
        # 2. Override por keywords na mensagem
        override = self._detect_override(user_message)
        if override and override["confidence"] >= 0.3:
            return self._from_override(override, task_type)
        
        # 3. Override contextual (tribunal, prazo, etc)
        ctx_tier = self._check_context(context)
        if ctx_tier:
            return self._from_context(ctx_tier, context, task_type)
        
        # 4. Padrão da tarefa
        return self._from_task(task_type)
    
    def _from_manual_selection(self, selected: str, task_type: str) -> Optional[RoutingDecision]:
        """Decisão a partir de seleção manual do frontend"""
        
        # Buscar por key ou model_id
        model = self.catalog.get(selected)
        if not model:
            for key, cfg in self.catalog.items():
                if cfg.model_id == selected:
                    model = cfg
                    selected = key
                    break
        
        if not model:
            logger.warning(f"Modelo não encontrado: {selected}")
            return None
        
        # Identificar tier
        tier = self._identify_tier(selected)
        
        # Fallback
        fallback = self._get_fallback(tier, selected)
        
        # Config da tarefa
        task_cfg = self.tasks.get(task_type, {})
        tokens = task_cfg.get("tokens", (4000, 6000))
        
        return RoutingDecision(
            model_id=model.model_id,
            model_name=model.display_name,
            tier=tier,
            decision_type=DecisionType.USER_SELECTED,
            confidence=1.0,
            reason=f"Selecionado manualmente: {model.display_name}",
            fallback_model_id=fallback.model_id if fallback else None,
            fallback_model_name=fallback.display_name if fallback else None,
            use_extended_thinking=task_cfg.get("extended", False),
            max_tokens=tokens[1],
            temperature=task_cfg.get("temp", 0.4)
        )
    
    def _detect_override(self, message: str) -> Optional[Dict[str, Any]]:
        """Detecta override por keywords/patterns"""
        
        msg_lower = message.lower()
        best = None
        best_conf = 0.0
        
        for tier, triggers in self.triggers.items():
            keywords = [k for k in triggers["keywords"] if k in msg_lower]
            patterns = [p for p in triggers["patterns"] if re.search(p, msg_lower)]
            
            if keywords or patterns:
                conf = min(len(keywords) * 0.25 + len(patterns) * 0.35, 1.0)
                if conf > best_conf:
                    best_conf = conf
                    best = {
                        "tier": tier,
                        "confidence": conf,
                        "triggers": keywords + patterns
                    }
        
        return best
    
    def _from_override(self, override: Dict, task_type: str) -> RoutingDecision:
        """Decisão a partir de override detectado"""
        
        tier = override["tier"]
        tier_cfg = self.tiers[tier]
        ranking = tier_cfg["ranking"]
        
        primary = self.catalog[ranking[0]]
        fallback = self.catalog[ranking[1]] if len(ranking) > 1 else None
        
        task_cfg = self.tasks.get(task_type, {})
        tokens = task_cfg.get("tokens", (4000, 6000))
        
        return RoutingDecision(
            model_id=primary.model_id,
            model_name=primary.display_name,
            tier=tier,
            decision_type=DecisionType.USER_OVERRIDE,
            confidence=override["confidence"],
            reason=f"Override detectado para tier {tier.value}",
            fallback_model_id=fallback.model_id if fallback else None,
            fallback_model_name=fallback.display_name if fallback else None,
            use_extended_thinking=tier_cfg.get("use_extended_thinking", False),
            max_tokens=tokens[1],
            temperature=task_cfg.get("temp", 0.4),
            triggers_matched=override["triggers"]
        )
    
    def _check_context(self, context: Dict) -> Optional[ModelTier]:
        """Verifica contexto para override automático"""
        
        # Tribunal Superior
        tribunal = context.get("tribunal", "").upper()
        if tribunal in ["STF", "STJ", "TST", "TSE", "STM"]:
            context["_reason"] = f"Tribunal Superior: {tribunal}"
            return ModelTier.PREMIUM
        
        # Prazo crítico
        prazo = context.get("prazo_horas")
        if prazo is not None and prazo < 6:
            context["_reason"] = f"Prazo crítico: {prazo}h"
            return ModelTier.FAST
        
        # Criminal com liberdade
        if context.get("materia") == "criminal" and context.get("envolve_liberdade"):
            context["_reason"] = "Criminal com liberdade"
            return ModelTier.PREMIUM
        
        # Imagem
        if context.get("has_image"):
            context["_reason"] = "Documento com imagem"
            return ModelTier.VISION
        
        # Cálculo
        if context.get("requires_calculation"):
            context["_reason"] = "Requer cálculo"
            return ModelTier.CODE
        
        return None
    
    def _from_context(self, tier: ModelTier, context: Dict, task_type: str) -> RoutingDecision:
        """Decisão a partir de contexto"""
        
        tier_cfg = self.tiers[tier]
        ranking = tier_cfg["ranking"]
        
        primary = self.catalog[ranking[0]]
        fallback = self.catalog[ranking[1]] if len(ranking) > 1 else None
        
        task_cfg = self.tasks.get(task_type, {})
        tokens = task_cfg.get("tokens", (4000, 6000))
        
        return RoutingDecision(
            model_id=primary.model_id,
            model_name=primary.display_name,
            tier=tier,
            decision_type=DecisionType.CONTEXTUAL_AUTO,
            confidence=0.9,
            reason=context.get("_reason", "Contexto especial"),
            fallback_model_id=fallback.model_id if fallback else None,
            fallback_model_name=fallback.display_name if fallback else None,
            use_extended_thinking=tier_cfg.get("use_extended_thinking", False),
            max_tokens=tokens[1],
            temperature=task_cfg.get("temp", 0.4)
        )
    
    def _from_task(self, task_type: str) -> RoutingDecision:
        """Decisão padrão por tipo de tarefa"""
        
        task_cfg = self.tasks.get(task_type)
        
        if not task_cfg:
            logger.warning(f"Tarefa não mapeada: {task_type}, usando BALANCED")
            tier = ModelTier.BALANCED
            task_cfg = {"tier": tier, "tokens": (4000, 6000), "temp": 0.4}
        else:
            tier = task_cfg["tier"]
        
        tier_cfg = self.tiers[tier]
        ranking = tier_cfg["ranking"]
        
        primary = self.catalog[ranking[0]]
        fallback = self.catalog[ranking[1]] if len(ranking) > 1 else None
        
        tokens = task_cfg.get("tokens", (4000, 6000))
        
        return RoutingDecision(
            model_id=primary.model_id,
            model_name=primary.display_name,
            tier=tier,
            decision_type=DecisionType.TASK_DEFAULT,
            confidence=1.0,
            reason=f"Padrão para {task_type}",
            fallback_model_id=fallback.model_id if fallback else None,
            fallback_model_name=fallback.display_name if fallback else None,
            use_extended_thinking=task_cfg.get("extended", False),
            max_tokens=tokens[1],
            temperature=task_cfg.get("temp", 0.4)
        )
    
    def _identify_tier(self, model_key: str) -> ModelTier:
        """Identifica tier de um modelo"""
        for tier, cfg in self.tiers.items():
            if model_key in cfg.get("ranking", []):
                return tier
        return ModelTier.BALANCED
    
    def _get_fallback(self, tier: ModelTier, exclude: str) -> Optional[ModelConfig]:
        """Obtém modelo de fallback"""
        ranking = self.tiers[tier].get("ranking", [])
        for key in ranking:
            if key != exclude:
                return self.catalog.get(key)
        return None


# ══════════════════════════════════════════════════════════════════════════════════════════
# PARTE 8: ANALISADOR DE CUSTOS
# ══════════════════════════════════════════════════════════════════════════════════════════

class CostAnalyzer:
    """Analisador de custos do ROM Agent"""
    
    def __init__(self, exchange_rate: float = 5.0):
        self.catalog = MODEL_CATALOG
        self.tasks = LEGAL_TASKS
        self.exchange_rate = exchange_rate
    
    def estimate_task(self, task_type: str, model_key: str = None) -> CostEstimate:
        """Estima custo de uma tarefa"""
        
        task_cfg = self.tasks.get(task_type, {"tokens": (4000, 6000)})
        input_tok, output_tok = task_cfg.get("tokens", (4000, 6000))
        
        if model_key is None:
            tier = task_cfg.get("tier", ModelTier.BALANCED)
            ranking = MODEL_TIERS[tier]["ranking"]
            model_key = ranking[0]
        
        model = self.catalog[model_key]
        cost_usd = model.pricing.calculate(input_tok, output_tok)
        
        return CostEstimate(
            model_key=model_key,
            model_name=model.display_name,
            input_tokens=input_tok,
            output_tokens=output_tok,
            total_cost_usd=cost_usd,
            total_cost_brl=cost_usd * self.exchange_rate
        )
    
    def compare_models(self, task_type: str) -> List[Dict[str, Any]]:
        """Compara custos de todos os modelos para uma tarefa"""
        
        results = []
        for key in self.catalog:
            try:
                est = self.estimate_task(task_type, key)
                model = self.catalog[key]
                results.append({
                    "model_key": key,
                    "model_name": est.model_name,
                    "provider": model.provider.value,
                    "quality": model.quality_score,
                    "speed": model.speed_score,
                    "cost_usd": round(est.total_cost_usd, 6),
                    "cost_brl": round(est.total_cost_brl, 4)
                })
            except:
                pass
        
        return sorted(results, key=lambda x: x["cost_usd"])
    
    def project_monthly(self, volumes: Dict[str, int]) -> Dict[str, Any]:
        """Projeta custo mensal"""
        
        total = 0
        breakdown = []
        
        for task, vol in volumes.items():
            est = self.estimate_task(task)
            task_total = est.total_cost_usd * vol
            total += task_total
            breakdown.append({
                "task": task,
                "volume": vol,
                "model": est.model_name,
                "cost_per_task": round(est.total_cost_usd, 4),
                "total_usd": round(task_total, 2)
            })
        
        return {
            "total_usd": round(total, 2),
            "total_brl": round(total * self.exchange_rate, 2),
            "breakdown": sorted(breakdown, key=lambda x: -x["total_usd"])
        }
    
    def suggest_savings(self, task: str, current: str, min_quality: int = 6) -> Dict:
        """Sugere alternativas mais econômicas"""
        
        current_model = self.catalog[current]
        current_est = self.estimate_task(task, current)
        
        alternatives = []
        for key, model in self.catalog.items():
            if key == current or model.quality_score < min_quality:
                continue
            
            est = self.estimate_task(task, key)
            if est.total_cost_usd < current_est.total_cost_usd:
                savings = current_est.total_cost_usd - est.total_cost_usd
                alternatives.append({
                    "model": model.display_name,
                    "cost_usd": round(est.total_cost_usd, 6),
                    "savings_pct": round((savings / current_est.total_cost_usd) * 100, 1),
                    "quality": model.quality_score
                })
        
        return {
            "current": current_model.display_name,
            "current_cost": round(current_est.total_cost_usd, 4),
            "alternatives": sorted(alternatives, key=lambda x: -x["savings_pct"])[:5]
        }
    
    def get_price_table(self) -> List[Dict]:
        """Tabela de preços de todos os modelos"""
        
        table = []
        for key, model in self.catalog.items():
            # Custo para tarefa padrão (4K in, 6K out)
            cost = model.pricing.calculate(4000, 6000)
            table.append({
                "model": model.display_name,
                "provider": model.provider.value,
                "input_1k": model.pricing.input_per_1k,
                "output_1k": model.pricing.output_per_1k,
                "standard_cost": round(cost, 6),
                "quality": model.quality_score,
                "speed": model.speed_score
            })
        
        return sorted(table, key=lambda x: x["standard_cost"])


# ══════════════════════════════════════════════════════════════════════════════════════════
# PARTE 9: EXECUTOR COM CIRCUIT BREAKER
# ══════════════════════════════════════════════════════════════════════════════════════════

class CircuitState(Enum):
    CLOSED = "closed"
    OPEN = "open"
    HALF_OPEN = "half_open"


@dataclass
class CircuitBreaker:
    """Circuit breaker para proteção de chamadas"""
    failure_threshold: int = 5
    recovery_timeout: int = 60
    
    state: CircuitState = CircuitState.CLOSED
    failures: int = 0
    last_failure: Optional[datetime] = None
    
    def can_execute(self) -> bool:
        if self.state == CircuitState.CLOSED:
            return True
        if self.state == CircuitState.OPEN:
            if self.last_failure and (datetime.now() - self.last_failure).seconds >= self.recovery_timeout:
                self.state = CircuitState.HALF_OPEN
                return True
            return False
        return True
    
    def record_success(self):
        self.state = CircuitState.CLOSED
        self.failures = 0
    
    def record_failure(self):
        self.failures += 1
        self.last_failure = datetime.now()
        if self.failures >= self.failure_threshold:
            self.state = CircuitState.OPEN


class ModelExecutor:
    """Executor de modelos com circuit breaker e fallback"""
    
    def __init__(self, bedrock_client=None):
        self.client = bedrock_client
        self.breakers: Dict[str, CircuitBreaker] = {}
    
    def _get_breaker(self, model_id: str) -> CircuitBreaker:
        if model_id not in self.breakers:
            self.breakers[model_id] = CircuitBreaker()
        return self.breakers[model_id]
    
    async def execute(
        self,
        decision: RoutingDecision,
        messages: List[Dict],
        system_prompt: str = "",
        tools: List[Dict] = None,
        stream: bool = True
    ) -> Dict[str, Any]:
        """Executa chamada com proteções"""
        
        # Tentar modelo primário
        breaker = self._get_breaker(decision.model_id)
        
        if breaker.can_execute():
            try:
                response = await self._invoke(
                    decision.model_id, messages, system_prompt,
                    decision.max_tokens, decision.temperature,
                    tools, stream, decision.use_extended_thinking
                )
                breaker.record_success()
                return {
                    "success": True,
                    "model_used": decision.model_name,
                    "response": response,
                    "fallback": False
                }
            except Exception as e:
                logger.error(f"Erro em {decision.model_id}: {e}")
                breaker.record_failure()
        
        # Tentar fallback
        if decision.fallback_model_id:
            fb_breaker = self._get_breaker(decision.fallback_model_id)
            if fb_breaker.can_execute():
                try:
                    response = await self._invoke(
                        decision.fallback_model_id, messages, system_prompt,
                        decision.max_tokens, decision.temperature,
                        tools, stream, False
                    )
                    fb_breaker.record_success()
                    return {
                        "success": True,
                        "model_used": decision.fallback_model_name,
                        "response": response,
                        "fallback": True
                    }
                except Exception as e:
                    logger.error(f"Erro em fallback: {e}")
                    fb_breaker.record_failure()
        
        return {"success": False, "error": "Todos os modelos falharam"}
    
    async def _invoke(
        self, model_id: str, messages: List, system: str,
        max_tokens: int, temperature: float, tools: List,
        stream: bool, extended_thinking: bool
    ) -> Dict:
        """Invoca modelo no Bedrock (placeholder)"""
        
        # Estrutura da chamada real ao Bedrock
        request = {
            "anthropic_version": "bedrock-2023-05-31",
            "max_tokens": max_tokens,
            "temperature": temperature,
            "messages": messages
        }
        
        if system:
            request["system"] = system
        if tools:
            request["tools"] = tools
        if extended_thinking and "claude-3-7" in model_id:
            request["thinking"] = {"type": "enabled", "budget_tokens": min(max_tokens // 2, 10000)}
        
        # Aqui seria: response = self.client.invoke_model(...)
        return {"content": "Resposta do modelo", "model": model_id}


# ══════════════════════════════════════════════════════════════════════════════════════════
# PARTE 10: INTERFACE PRINCIPAL - ROMAgent
# ══════════════════════════════════════════════════════════════════════════════════════════

class ROMAgent:
    """
    Interface principal do ROM Agent v2.0
    
    Combina roteamento inteligente, análise de custos e execução com proteções.
    """
    
    def __init__(self, bedrock_client=None, exchange_rate: float = 5.0):
        self.router = ROMAgentRouter()
        self.executor = ModelExecutor(bedrock_client)
        self.costs = CostAnalyzer(exchange_rate)
    
    # ═══════════════════════════════════════════════════════════════════════════════════════
    # ROTEAMENTO
    # ═══════════════════════════════════════════════════════════════════════════════════════
    
    def route(
        self,
        task_type: str,
        user_message: str,
        context: Dict[str, Any] = None,
        selected_model: str = None
    ) -> RoutingDecision:
        """
        Roteia para o modelo ideal.
        
        Prioridades:
        1. selected_model (frontend) - MÁXIMA
        2. Keywords na mensagem
        3. Contexto processual
        4. Padrão da tarefa
        """
        return self.router.route(task_type, user_message, context, selected_model)
    
    async def process(
        self,
        task_type: str,
        user_message: str,
        context: Dict = None,
        selected_model: str = None,
        messages: List[Dict] = None,
        system_prompt: str = "",
        tools: List[Dict] = None,
        stream: bool = True
    ) -> Dict[str, Any]:
        """Processa tarefa completa: roteamento + execução"""
        
        decision = self.route(task_type, user_message, context, selected_model)
        
        if messages is None:
            messages = [{"role": "user", "content": user_message}]
        
        result = await self.executor.execute(decision, messages, system_prompt, tools, stream)
        
        result["routing"] = {
            "task": task_type,
            "tier": decision.tier.value,
            "decision_type": decision.decision_type.value,
            "reason": decision.reason,
            "confidence": decision.confidence
        }
        
        return result
    
    # ═══════════════════════════════════════════════════════════════════════════════════════
    # CUSTOS
    # ═══════════════════════════════════════════════════════════════════════════════════════
    
    def estimate_task_cost(self, task_type: str, model_key: str = None) -> Dict:
        """Estima custo de uma tarefa"""
        est = self.costs.estimate_task(task_type, model_key)
        return {
            "task": task_type,
            "model": est.model_name,
            "tokens": f"{est.input_tokens} in / {est.output_tokens} out",
            "cost_usd": round(est.total_cost_usd, 6),
            "cost_brl": round(est.total_cost_brl, 4)
        }
    
    def compare_costs(self, task_type: str) -> List[Dict]:
        """Compara custos de modelos para uma tarefa"""
        return self.costs.compare_models(task_type)
    
    def project_monthly_cost(self, volumes: Dict[str, int]) -> Dict:
        """Projeta custo mensal"""
        return self.costs.project_monthly(volumes)
    
    def suggest_savings(self, task: str, current_model: str, min_quality: int = 6) -> Dict:
        """Sugere alternativas mais econômicas"""
        return self.costs.suggest_savings(task, current_model, min_quality)
    
    def get_cost_table(self) -> List[Dict]:
        """Tabela de preços de todos os modelos"""
        return self.costs.get_price_table()
    
    def set_exchange_rate(self, rate: float):
        """Define taxa de câmbio USD/BRL"""
        self.costs.exchange_rate = rate
    
    # ═══════════════════════════════════════════════════════════════════════════════════════
    # UTILITÁRIOS
    # ═══════════════════════════════════════════════════════════════════════════════════════
    
    def get_available_models(self) -> List[Dict]:
        """Lista modelos disponíveis"""
        return [
            {
                "key": k,
                "name": m.display_name,
                "provider": m.provider.value,
                "quality": m.quality_score,
                "speed": m.speed_score
            }
            for k, m in MODEL_CATALOG.items()
        ]
    
    def get_available_tasks(self) -> List[str]:
        """Lista tarefas disponíveis"""
        return list(LEGAL_TASKS.keys())
    
    def get_models_for_selector(self) -> List[Dict]:
        """Lista para popular dropdown do frontend"""
        models = []
        for key, cfg in MODEL_CATALOG.items():
            tier = self.router._identify_tier(key)
            models.append({
                "id": key,
                "model_id": cfg.model_id,
                "name": cfg.display_name,
                "provider": cfg.provider.value,
                "tier": tier.value,
                "quality": cfg.quality_score,
                "speed": cfg.speed_score,
                "supports_vision": cfg.supports_vision,
                "supports_extended_thinking": cfg.supports_extended_thinking
            })
        return sorted(models, key=lambda x: (-x["quality"], x["name"]))
    
    def get_models_by_provider(self) -> Dict[str, List[Dict]]:
        """Modelos agrupados por provider"""
        grouped = {}
        for m in self.get_models_for_selector():
            provider = m["provider"]
            if provider not in grouped:
                grouped[provider] = []
            grouped[provider].append(m)
        return grouped
    
    def get_models_by_tier(self) -> Dict[str, List[Dict]]:
        """Modelos agrupados por tier"""
        grouped = {}
        for m in self.get_models_for_selector():
            tier = m["tier"]
            if tier not in grouped:
                grouped[tier] = []
            grouped[tier].append(m)
        return grouped


# ══════════════════════════════════════════════════════════════════════════════════════════
# PARTE 11: DEMONSTRAÇÃO E TESTES
# ══════════════════════════════════════════════════════════════════════════════════════════

def demo():
    """Demonstração do sistema"""
    
    print("=" * 90)
    print("                    ROM AGENT v2.0 - DEMONSTRAÇÃO")
    print("=" * 90)
    
    agent = ROMAgent(exchange_rate=5.0)
    
    # 1. Estatísticas
    print(f"\n📊 ESTATÍSTICAS DO SISTEMA:")
    print(f"   • Modelos: {len(MODEL_CATALOG)}")
    print(f"   • Tarefas: {len(LEGAL_TASKS)}")
    print(f"   • Tiers: {len(MODEL_TIERS)}")
    
    # 2. Roteamento automático
    print(f"\n\n🎯 ROTEAMENTO AUTOMÁTICO:")
    print("-" * 60)
    
    tests = [
        ("recurso_especial", "Elabore um REsp sobre responsabilidade civil"),
        ("peticao_inicial_civel", "Faça uma petição inicial"),
        ("triagem_inicial", "Urgente! Classifique esse documento"),
        ("procuracao_ad_judicia", "Gere uma procuração simples"),
    ]
    
    for task, msg in tests:
        d = agent.route(task, msg)
        print(f"   {task}:")
        print(f"     → {d.model_name} ({d.tier.value}) - {d.decision_type.value}")
    
    # 3. Seleção manual
    print(f"\n\n🖱️ SELEÇÃO MANUAL (FRONTEND):")
    print("-" * 60)
    
    d = agent.route("peticao_inicial_civel", "Faça uma petição", selected_model="deepseek-r1")
    print(f"   Tarefa: peticao_inicial_civel")
    print(f"   Selecionado: deepseek-r1")
    print(f"   → {d.model_name} ({d.decision_type.value})")
    
    # 4. Override por keywords
    print(f"\n\n🔄 OVERRIDE POR KEYWORDS:")
    print("-" * 60)
    
    d = agent.route("peticao_inicial_civel", "Precisa estar IMPECÁVEL para o STJ!")
    print(f"   Mensagem: 'Precisa estar IMPECÁVEL para o STJ!'")
    print(f"   → {d.model_name} ({d.tier.value})")
    print(f"   Triggers: {d.triggers_matched}")
    
    # 5. Custos
    print(f"\n\n💰 ANÁLISE DE CUSTOS:")
    print("-" * 60)
    
    tasks_cost = ["recurso_especial", "peticao_inicial_civel", "triagem_inicial", "procuracao_ad_judicia"]
    
    for task in tasks_cost:
        c = agent.estimate_task_cost(task)
        print(f"   {task}:")
        print(f"     {c['model']} | ${c['cost_usd']} USD | R$ {c['cost_brl']} BRL")
    
    # 6. Projeção mensal
    print(f"\n\n📅 PROJEÇÃO MENSAL:")
    print("-" * 60)
    
    volumes = {
        "recurso_especial": 5,
        "peticao_inicial_civel": 30,
        "contestacao": 25,
        "triagem_inicial": 100,
        "procuracao_ad_judicia": 50
    }
    
    proj = agent.project_monthly_cost(volumes)
    print(f"   Volume: {sum(volumes.values())} tarefas/mês")
    print(f"   Total: ${proj['total_usd']} USD | R$ {proj['total_brl']} BRL")
    print(f"\n   Top 3 mais custosas:")
    for item in proj['breakdown'][:3]:
        print(f"     • {item['task']}: {item['volume']}x = ${item['total_usd']}")
    
    # 7. Tabela de preços
    print(f"\n\n📋 MODELOS MAIS BARATOS (tarefa padrão 4K/6K):")
    print("-" * 60)
    
    table = agent.get_cost_table()[:8]
    print(f"   {'Modelo':<25} {'Provider':<10} {'Custo':<12} {'Qualidade'}")
    print(f"   {'-'*25} {'-'*10} {'-'*12} {'-'*10}")
    for row in table:
        print(f"   {row['model']:<25} {row['provider']:<10} ${row['standard_cost']:<11.6f} {row['quality']}/10")
    
    # 8. Hierarquia
    print(f"\n\n📐 HIERARQUIA DE PRIORIDADES:")
    print("=" * 60)
    print("""
    ┌────────────────────────────────────────────────────────────┐
    │  1. SELEÇÃO MANUAL (frontend)     ← PRIORIDADE MÁXIMA     │
    │  2. OVERRIDE NA MENSAGEM          (keywords detectados)    │
    │  3. CONTEXTO PROCESSUAL           (tribunal, prazo)        │
    │  4. PADRÃO DA TAREFA              (tipo de documento)      │
    └────────────────────────────────────────────────────────────┘
    """)


if __name__ == "__main__":
    demo()
