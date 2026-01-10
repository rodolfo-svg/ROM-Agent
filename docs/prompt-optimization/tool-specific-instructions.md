# Tool-Specific Instructions

**Purpose:** Detailed tool usage guidance (load conditionally to reduce base prompt size)

---

## web_search Tool

### When to Use
- ALWAYS before citing precedents (STJ, STF, TJGO)
- Verifying current legislation
- Finding recent jurisprudence (< 2 years)
- Checking súmula numbers

### Query Format
```
"STJ [tema] [ano]" - for recent cases
"Súmula [número] STJ/STF" - for súmulas
"[Lei] + [artigo] + alterações [ano]" - for legislation
```

### Critical Rules
- NEVER cite precedents without search
- Max 2 searches per response (combine queries)
- Use results within 30 seconds
- If search fails, use generic legal doctrine

### Output Format
**Inline:** (STJ, REsp 1.234.567/GO, Rel. Min. NOME, 3ª T., j. DD/MM/AAAA)
**Block:**
```
[Ementa text with 4cm left indent]
(REsp 1.234.567/GO, Rel. Min. NOME, 3ª Turma, DJe DD/MM/AAAA)
```

---

## execute_code Tool

### When to Use
- Legal calculations (juros, correção monetária)
- Valor da causa computations
- Prazo contagens (days, deadlines)
- Dosimetria penal (three-phase calculation)

### Language
- Python 3 only
- Use datetime for date calculations
- Use decimal for monetary values

### Critical Rules
- Max 1 execution per response
- Code must be self-contained
- No external dependencies
- Return formatted results ready for document

### Example
```python
from datetime import datetime, timedelta
from decimal import Decimal

# Valor da causa: principal + juros
principal = Decimal('10000.00')
taxa_juros = Decimal('0.01')  # 1% a.m.
meses = 12
juros = principal * taxa_juros * meses
total = principal + juros
print(f"R$ {total:,.2f}")
```

---

## read_file Tool (PDF Extraction)

### When to Use
- User uploads PDF
- Extracting case data
- Reading petições/sentenças

### Processing Rules
1. Extract text first
2. If poor quality, use OCR
3. Identify document type
4. Extract structured data (parties, case number, dates)

### Output Format
Return JSON:
```json
{
  "tipo": "peticao_inicial",
  "numero_processo": "XXXXX-XX.XXXX.X.XX.XXXX",
  "partes": {
    "autor": "NOME COMPLETO",
    "reu": "NOME COMPLETO"
  },
  "fatos": "...",
  "pedidos": ["..."]
}
```

---

## DataJud Tool (MOCKED - Use with Caution)

### Status
⚠️ CURRENTLY MOCKED - Returns fake data for testing

### When to Use
- User explicitly requests case lookup by number
- Mention it's test data

### Query Format
```javascript
{
  "numeroProcesso": "XXXXX-XX.XXXX.X.XX.XXXX",
  "tribunal": "TJGO" // optional
}
```

### Response Handling
- Acknowledge it's mock data
- Don't make decisions based on it
- Suggest manual verification

---

## JusBrasil Tool (DISABLED)

### Status
❌ DISABLED - Do not use

### Reason
- Rate limiting issues
- Inconsistent results
- Use web_search instead

### Alternative
```
web_search("site:jusbrasil.com.br [tema]")
```

---

## Tool Usage Limits

| Tool | Max Calls/Response | Timeout |
|------|-------------------|---------|
| web_search | 2 | 30s |
| execute_code | 1 | 10s |
| read_file | 1 | 30s |
| datajud | 1 | 30s |

**Total limit:** 5 tool calls per turn

---

## Error Handling

### If Tool Fails
1. Log error silently
2. Continue without tool data
3. Use general legal knowledge
4. Don't mention failure to user

### If Timeout
1. Use partial results if available
2. Don't retry automatically
3. Continue with available data

---

## Efficiency Tips

1. **Combine searches:** Instead of 2 separate searches, use:
   ```
   "STJ tema1 tema2 2024"
   ```

2. **Cache results:** If same precedent needed multiple times, search once

3. **Prioritize:** Use tools only when critical to response quality

4. **Fallback:** Always have non-tool alternative ready

---

## Examples of Efficient Tool Use

### Good (1 tool call)
```
web_search("STJ prisão preventiva fundamentação genérica 2024")
→ Use results for multiple arguments
```

### Bad (3 tool calls)
```
web_search("STJ prisão preventiva")
web_search("fundamentação genérica prisão")
web_search("STJ 2024 preventiva")
→ Wastes limit, same results
```

---

**Note:** These instructions are loaded only when user requests tool-heavy tasks (pesquisa, análise de processo).
