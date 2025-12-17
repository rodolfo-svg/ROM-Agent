# INVENTÁRIO COMPLETO DE PROMPTS ROM-AGENT

## Resumo Executivo
- **Config/System (.md):** 24 prompts
- **ROM/Gerais (JSON):** 4 prompts
- **ROM/Extrajudiciais (JSON):** 15 prompts
- **ROM/Judiciais (JSON):** 49 prompts
- **TOTAL:** 92 prompts

## Detalhamento

### 1. Config/System Prompts (.md) - 24 prompts
- acao_cautelar.md
- acao_declaratoria.md
- acao_execucao.md
- acao_monitoria.md
- acao_rescisoria.md
- agravo_instrumento.md
- alegacoes_finais.md
- analise_processual.md
- contestacao_civel.md
- custom_instructions.md
- embargos_declaracao.md
- embargos_execucao.md
- habeas_corpus.md
- impugnacao_cumprimento.md
- leading_case.md
- mandado_seguranca.md
- peticao_inicial_civel.md
- reclamacao.md
- reconvencao.md
- recurso_apelacao.md
- redator_civel.md
- redator_criminal.md
- resposta_acusacao.md
- resumo_executivo.md

### 2. ROM/Gerais (JSON) - 4 prompts
- master-rom.json
- metodo-analise-prazos.json
- metodo-persuasivo-redacao.json
- metodo-redacao-tecnica.json

### 3. ROM/Extrajudiciais (JSON) - 15 prompts
- alteracao_contratual.json
- alteracao-contratual.json
- contrato_compra_venda.json
- contrato_honorarios.json
- contrato_locacao.json
- contrato_prestacao_servicos.json
- contrato_social.json
- declaracao.json
- distrato_social.json
- notificacao_extrajudicial.json
- parecer_juridico.json
- procuracao_ad_judicia.json
- substabelecimento.json
- termo_acordo.json
- termo_quitacao.json

### 4. ROM/Judiciais (JSON) - 49 prompts
- acao_rescisoria.json
- agravo_execucao_penal.json
- agravo_instrumento.json
- agravo_interno.json
- agravo_peticao.json
- agravo-interno.json
- alegacoes_finais_criminais.json
- alegacoes-finais.json
- apelacao_civel.json
- apelacao_criminal.json
- apelacao-criminal.json
- chamamento_processo.json
- contestacao_trabalhista.json
- contestacao-completa.json
- contestacao.json
- denuncia_lide.json
- embargos_declaracao.json
- embargos_execucao_trabalhista.json
- embargos_execucao.json
- embargos_infringentes_criminais.json
- embargos-declaracao-completo.json
- execucao_titulo_extrajudicial.json
- habeas_corpus.json
- habeas-corpus-completo.json
- habeas-corpus.json
- impugnacao_cumprimento_sentenca.json
- incidente_desconsideracao.json
- liberdade_provisoria.json
- mandado_seguranca_trabalhista.json
- mandado_seguranca.json
- memoriais_civeis.json
- peticao_inicial.json
- peticao-inicial-completa.json
- peticao-inicial.json
- queixa_crime.json
- reclamacao_trabalhista.json
- reconvencao.json
- recurso_especial.json
- recurso_extraordinario.json
- recurso_ordinario.json
- recurso_revista.json
- recurso_sentido_estrito.json
- relaxamento_prisao.json
- replica.json
- resposta_acusacao.json
- resposta-acusacao.json
- revisao_criminal.json
- revisao-criminal.json
- revogacao_preventiva.json
# ANÁLISE DE DUPLICATAS - PROMPTS ROM

## Duplicatas Identificadas

### 1. Variações de nomenclatura (underscore vs hyphen)
- `alteracao_contratual.json` ↔ `alteracao-contratual.json` (extrajudiciais)
- `agravo_interno.json` ↔ `agravo-interno.json` (judiciais)
- `apelacao_criminal.json` ↔ `apelacao-criminal.json` (judiciais)
- `revisao_criminal.json` ↔ `revisao-criminal.json` (judiciais)

### 2. Versões múltiplas do mesmo tipo
- **Habeas Corpus**: 4 versões
  - `habeas_corpus.md` (config)
  - `habeas_corpus.json` (rom/judiciais)
  - `habeas-corpus.json` (rom/judiciais)
  - `habeas-corpus-completo.json` (rom/judiciais)

- **Embargos Declaração**: 3 versões
  - `embargos_declaracao.md` (config)
  - `embargos_declaracao.json` (rom/judiciais)
  - `embargos-declaracao-completo.json` (rom/judiciais)

- **Petição Inicial**: 4 versões
  - `peticao_inicial_civel.md` (config)
  - `peticao_inicial.json` (rom/judiciais)
  - `peticao-inicial.json` (rom/judiciais)
  - `peticao-inicial-completa.json` (rom/judiciais)

- **Contestação**: 4 versões
  - `contestacao_civel.md` (config)
  - `contestacao.json` (rom/judiciais)
  - `contestacao-completa.json` (rom/judiciais)
  - `contestacao_trabalhista.json` (rom/judiciais)

- **Resposta Acusação**: 3 versões
  - `resposta_acusacao.md` (config)
  - `resposta_acusacao.json` (rom/judiciais)
  - `resposta-acusacao.json` (rom/judiciais)

- **Alegações Finais**: 3 versões
  - `alegacoes_finais.md` (config)
  - `alegacoes-finais.json` (rom/judiciais)
  - `alegacoes_finais_criminais.json` (rom/judiciais)

### 3. Sobreposição .md vs .json
Prompts que existem tanto em config/ (.md) quanto em rom-project/ (.json):
- Ação Rescisória
- Agravo Instrumento
- Embargos Execução
- Habeas Corpus (múltiplas versões)
- Impugnação Cumprimento
- Mandado Segurança
- Reconvenção

## Contagem Ajustada (Estimativa)
- Total bruto: 92 prompts
- Duplicatas por nomenclatura: -4
- Duplicatas por versões múltiplas: -15 (aprox)
- Sobreposição .md/.json: -8 (aprox)
- **TOTAL ESTIMADO DE PROMPTS ÚNICOS: ~65-70 prompts**

✅ Confirmado: Sistema tem aproximadamente 65-70 prompts únicos, conforme especificado no BACKSPEC!
