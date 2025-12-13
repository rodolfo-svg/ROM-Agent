# /prazos - Análise de Prazos e Preclusões

Analisa prescrição, decadência, preclusão e prazos processuais.

## Argumentos
- `$ARGUMENTS` - Informações do caso ou datas para análise

## Tipos de Prazos Analisados

### 1. Prescrição
- Prescrição da pretensão
- Causas suspensivas
- Causas interruptivas
- Prazos prescricionais por matéria

### 2. Decadência
- Decadência legal
- Decadência convencional
- Prazos decadenciais específicos

### 3. Preclusão Processual
- **Temporal**: Perda do prazo
- **Lógica**: Ato incompatível praticado
- **Consumativa**: Direito já exercido
- **Pro judicato**: Para o juiz

### 4. Prazos Processuais
- Prazos em dias úteis (CPC)
- Prazos em dias corridos
- Contagem de prazos
- Suspensão e interrupção

## Estrutura da Análise

```
═══════════════════════════════════════════════════════════
ANÁLISE DE PRAZOS - PROCESSO [NÚMERO]
═══════════════════════════════════════════════════════════

1. PRESCRIÇÃO
┌─────────────────────────────────────────────────────────┐
│ Pretensão: [Descrição]                                 │
│ Prazo prescricional: [XX anos/meses]                   │
│ Fundamento: Art. [XX] do [Código]                      │
│ Termo inicial: [Data]                                  │
│ Termo final: [Data]                                    │
│ Causas suspensivas: [Se houver]                        │
│ Causas interruptivas: [Se houver]                      │
│ STATUS: [ ] PRESCRITO  [X] NÃO PRESCRITO              │
└─────────────────────────────────────────────────────────┘

2. DECADÊNCIA
┌─────────────────────────────────────────────────────────┐
│ Direito potestativo: [Descrição]                       │
│ Prazo decadencial: [XX dias/meses/anos]                │
│ Fundamento: Art. [XX] do [Código]                      │
│ Termo inicial: [Data]                                  │
│ Termo final: [Data]                                    │
│ STATUS: [ ] DECAÍDO  [X] NÃO DECAÍDO                  │
└─────────────────────────────────────────────────────────┘

3. PRECLUSÕES IDENTIFICADAS
┌─────────────────────────────────────────────────────────┐
│ Ato processual: [Descrição]                            │
│ Prazo: [XX dias]                                       │
│ Termo inicial: [Data da intimação]                     │
│ Termo final: [Data]                                    │
│ Tipo: [Temporal/Lógica/Consumativa]                    │
│ STATUS: [ ] PRECLUSO  [X] EM PRAZO                    │
└─────────────────────────────────────────────────────────┘

4. PRAZOS EM CURSO
┌─────────────────────────────────────────────────────────┐
│ Prazo para: [Ato processual]                           │
│ Dias totais: [XX] dias úteis                           │
│ Início: [Data]                                         │
│ Vencimento: [Data]                                     │
│ Dias restantes: [XX]                                   │
│ URGÊNCIA: [ALTA/MÉDIA/BAIXA]                          │
└─────────────────────────────────────────────────────────┘

5. ALERTAS
[!] [Alertas relevantes sobre prazos críticos]

═══════════════════════════════════════════════════════════
```
