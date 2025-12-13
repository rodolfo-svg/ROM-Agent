# /leading-case - Análise de Leading Cases e Precedentes

Identifica e analisa leading cases aplicáveis ao caso concreto.

## Argumentos
- `$ARGUMENTS` - Questão jurídica ou tema para análise

## Tipos de Precedentes Analisados

### Controle Concentrado de Constitucionalidade
- **ADI** - Ação Direta de Inconstitucionalidade
- **ADC** - Ação Declaratória de Constitucionalidade
- **ADPF** - Arguição de Descumprimento de Preceito Fundamental
- **ADO** - Ação Direta de Inconstitucionalidade por Omissão

### Precedentes Vinculantes
- **Súmulas Vinculantes** (STF)
- **Temas de Repercussão Geral** (STF)
- **Recursos Repetitivos** (STJ/TST)
- **IRDR** - Incidente de Resolução de Demandas Repetitivas
- **IAC** - Incidente de Assunção de Competência

### Súmulas Orientadoras
- Súmulas do STF
- Súmulas do STJ
- Súmulas do TST
- OJs do TST
- Enunciados de Fóruns (CJF, FONAJE)

## Estrutura da Análise

### 1. Identificação do Precedente
```
PRECEDENTE: [Número/Identificação]
TRIBUNAL: [STF/STJ/TST/etc]
NATUREZA: [Súmula Vinculante/Tema RG/Repetitivo/IRDR/etc]
DATA: [Data do julgamento/publicação]
```

### 2. Tese Jurídica Fixada
Transcrição literal da tese fixada no precedente.

### 3. Contexto Fático do Leading Case
- Fatos que originaram o precedente
- Questão constitucional/federal decidida
- Ratio decidendi

### 4. Análise de Aplicabilidade
- **Identidade fática**: Comparação dos fatos
- **Identidade jurídica**: Comparação das questões de direito
- **Distinguishing**: Elementos que afastam a aplicação
- **Overruling**: Verificar se houve superação

### 5. Conclusão
- Aplicabilidade **ipse literis** ao caso concreto
- Ou necessidade de **distinguishing** fundamentado
- Ou indicação de precedente mais adequado

## Formato de Saída

Para cada leading case identificado:
```
═══════════════════════════════════════════════════════════
LEADING CASE: [Identificação]
═══════════════════════════════════════════════════════════

TESE FIXADA:
[Tese literal]

APLICABILIDADE AO CASO:
[X] Aplicável ipse literis
[ ] Aplicável com adaptações
[ ] Distinguishing necessário
[ ] Não aplicável

FUNDAMENTAÇÃO:
[Análise detalhada]

═══════════════════════════════════════════════════════════
```
