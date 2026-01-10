# Implementation Guide - Optimized Prompts

**Version:** 1.0
**Date:** 2026-01-09
**Target:** ROM Agent v3.0+

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture Changes](#architecture-changes)
3. [Code Modifications](#code-modifications)
4. [Feature Flag Setup](#feature-flag-setup)
5. [Testing Strategy](#testing-strategy)
6. [Deployment Plan](#deployment-plan)
7. [Rollback Procedure](#rollback-procedure)
8. [Monitoring](#monitoring)

---

## 1. Overview

### Goal
Replace monolithic prompt system with modular, optimized prompts that reduce tokens by 79-83% while maintaining quality.

### Key Changes
- Split prompts into 3 modular files
- Implement conditional loading
- Add feature flag for easy rollback
- Update buildSystemPrompt() function

### Timeline
- **Day 1-2:** Code changes + unit tests
- **Day 3-5:** Staging deployment + validation
- **Day 6-30:** Phased production rollout

---

## 2. Architecture Changes

### Current Architecture
```
src/modules/promptsCompletos.js (monolithic)
└── 1,575 lines of prompts
    ├── MASTER_ROM
    ├── All document types
    └── Always loaded entirely
```

### New Architecture
```
src/modules/prompts/
├── core-system-prompt.js         ← Base (always loaded)
├── tool-instructions.js          ← Conditional (when tools used)
├── abnt-formatting-rules.js      ← Conditional (when formatting needed)
└── templates/
    ├── peticao-inicial.js
    ├── habeas-corpus.js
    └── ... (load specific type only)
```

---

## 3. Code Modifications

### Step 1: Create New Prompt Module Structure

**File:** `src/modules/prompts/core-system-prompt.js`

```javascript
/**
 * Core System Prompt - Always Loaded
 * Size: ~1,750 characters (~438 tokens)
 */

export const CORE_SYSTEM_PROMPT = `
# ROM Agent v3.0 - AI Legal Assistant

## Critical Rules (Priority Order)

### 1. STREAMING (HIGHEST PRIORITY)
- NEVER buffer. Output immediately after generation.
- Format as you write. No post-processing.
- ZERO markdown (**,###,---,\`\`\`)
- ZERO emojis, decorations, travessões
- ZERO references to AI/assistant

### 2. FORMATTING (Word-Ready Output)
- Font: Calibri 12pt | Spacing: 1.5 lines
- Margins: 2.5cm (top/bottom), 3cm (sides)
- Indent: 1.25cm first line
- Alignment: Justified (EXCEPT title: centered)
- Bold: Titles, section headers (I., II., III.), party names
- Case: UPPERCASE for headers, titles, party names

### 3. STRUCTURE
- Hierarchy: I, II, III → 1, 2, 3 → a, b, c
- Order: Preliminaries → Merit → Requests
- Sections: DOS FATOS → DO DIREITO → DOS PEDIDOS

### 4. TOOLS (Critical Usage)
- web_search: MANDATORY before citing precedents. NEVER invent case numbers/súmulas.
- execute_code: Use for calculations only
- Tool call limit: 5 per turn (combine queries efficiently)

### 5. CONTENT QUALITY
- Precedents: Min 3, MAX 5 (STJ/STF priority)
- Citations: Inline format: (STJ, REsp XXX/UF, Rel. Min. NAME, DATE)
- Legal basis: Arts. + jurisprudence + doctrine (when applicable)

### 6. PROHIBITED
- Asterisks (**)
- Markdown syntax
- Double spaces
- Straight quotes (use curvy: "")
- Emojis/decorations
- Methodology notes
- AI references

## Success Criteria
✓ Immediate streaming
✓ Zero formatting errors
✓ Precedents verified
✓ Professional tone
✓ Complete structure
`;

export default CORE_SYSTEM_PROMPT;
```

---

**File:** `src/modules/prompts/tool-instructions.js`

```javascript
/**
 * Tool-Specific Instructions - Load when tools are used
 * Size: ~4,200 characters (~1,050 tokens)
 */

export const TOOL_INSTRUCTIONS = `
# Tool Usage Instructions

## web_search Tool
### When to Use
- ALWAYS before citing precedents (STJ, STF, TJGO)
- Verifying current legislation
- Max 2 searches per response

### Query Format
"STJ [tema] [ano]" - for recent cases
"Súmula [número] STJ/STF" - for súmulas

### Critical Rules
- NEVER cite precedents without search
- Use results within 30 seconds
- If search fails, use generic legal doctrine

### Output Format
Inline: (STJ, REsp 1.234.567/GO, Rel. Min. NOME, 3ª T., j. DD/MM/AAAA)
Block: [Ementa with 4cm indent] + source

## execute_code Tool
### When to Use
- Legal calculations (juros, correção)
- Valor da causa computations
- Prazo contagens
- Dosimetria penal

### Rules
- Python 3 only
- Max 1 execution per response
- Self-contained code
- Return formatted results

## Tool Limits
Total: 5 calls per turn
web_search: 2 max
execute_code: 1 max
read_file: 1 max
datajud: 1 max (MOCKED - use with caution)

## Error Handling
- Log errors silently
- Continue without tool data
- Use general legal knowledge
- Don't mention failure to user
`;

export default TOOL_INSTRUCTIONS;
```

---

**File:** `src/modules/prompts/abnt-formatting-rules.js`

```javascript
/**
 * ABNT Formatting Rules - Load when formatting needed
 * Size: ~3,800 characters (~950 tokens)
 */

export const ABNT_FORMATTING_RULES = `
# ABNT Formatting Rules (NBR 6023/14724)

## Font & Spacing
| Element | Font | Size | Spacing |
|---------|------|------|---------|
| Body | Calibri | 12pt | 1.5 |
| Long quotes | Calibri | 11pt | 1.0 |
| Footnotes | Calibri | 10pt | 1.0 |

## Margins
- Top/Bottom: 2.5cm
- Left: 3.0cm (binding)
- Right: 2.5cm

## Indentation
- First line: 1.25cm (all paragraphs)
- Long quotes: 4cm left (no first-line indent)
- Lists: No indent

## Heading Styles
### Level 1: I., II., III.
- Format: **BOLD UPPERCASE**
- Spacing: 2 blank lines before, 1 after

### Level 2: 1., 2., 3.
- Format: **Bold Title Case**
- Spacing: 1 blank line before, 0 after

### Level 3: a), b), c)
- Format: Regular text
- Spacing: 0 before, 0 after

## Citations
### Short (≤3 lines)
- In paragraph with curved quotes: "texto"
- Font: Same as body (12pt)

### Long (>3 lines)
- Separate paragraph
- Indent: 4cm left
- Font: 11pt, spacing 1.0
- NO quotes
- 1 blank line before AND after

## Legal Citations
### Legislation
Format: art. 123, §2º, inc. I, alínea "a", CC

### Case Law (Inline)
(STJ, REsp 1.234.567/GO, Rel. Min. NOME, 3ª T., j. 01/01/2024)

### Case Law (Block)
[Ementa text with 4cm indent, 11pt, single-spaced]
(REsp 1.234.567/GO, Rel. Min. NOME, 3ª Turma, DJe 01/01/2024)

## Common Errors to Avoid
❌ Double spaces
❌ Straight quotes → Use curved
❌ Asterisks for bold
❌ Markdown (###, ---, \`\`\`)
❌ Underline → Use bold
❌ Extra line breaks
`;

export default ABNT_FORMATTING_RULES;
```

---

### Step 2: Create Prompt Builder Function

**File:** `src/modules/prompts/prompt-builder.js`

```javascript
/**
 * Prompt Builder - Conditionally loads prompt modules
 */

import CORE_SYSTEM_PROMPT from './core-system-prompt.js';
import TOOL_INSTRUCTIONS from './tool-instructions.js';
import ABNT_FORMATTING_RULES from './abnt-formatting-rules.js';
import { logger } from '../../utils/logger.js';

/**
 * Build system prompt based on context
 * @param {Object} options - Build options
 * @param {boolean} options.includeTools - Load tool instructions
 * @param {boolean} options.includeABNT - Load ABNT formatting rules
 * @param {string} options.documentType - Specific document template
 * @returns {string} Complete system prompt
 */
export function buildSystemPrompt(options = {}) {
  const {
    includeTools = false,
    includeABNT = false,
    documentType = null
  } = options;

  const parts = [CORE_SYSTEM_PROMPT];
  let totalTokens = 438; // Base prompt tokens

  // Add tool instructions if needed
  if (includeTools) {
    parts.push('\n---\n', TOOL_INSTRUCTIONS);
    totalTokens += 1050;
    logger.debug('Added tool instructions to system prompt');
  }

  // Add ABNT formatting if needed
  if (includeABNT) {
    parts.push('\n---\n', ABNT_FORMATTING_RULES);
    totalTokens += 950;
    logger.debug('Added ABNT formatting to system prompt');
  }

  // Add document-specific template if needed
  if (documentType) {
    try {
      const template = require(`./templates/${documentType}.js`).default;
      parts.push('\n---\n', template);
      logger.debug(`Added ${documentType} template to system prompt`);
    } catch (error) {
      logger.warn(`Template not found: ${documentType}`, { error });
    }
  }

  const prompt = parts.join('');

  logger.info('System prompt built', {
    includeTools,
    includeABNT,
    documentType,
    tokens: totalTokens,
    size: prompt.length
  });

  return prompt;
}

/**
 * Auto-detect if tools are needed based on user message
 * @param {string} userMessage - User's input
 * @returns {boolean}
 */
export function shouldIncludeTools(userMessage) {
  const toolKeywords = [
    'pesquis',
    'busca',
    'jurisprudência',
    'precedente',
    'súmula',
    'calcula',
    'processo',
    'datajud'
  ];

  const lowerMessage = userMessage.toLowerCase();
  return toolKeywords.some(keyword => lowerMessage.includes(keyword));
}

/**
 * Auto-detect if ABNT rules are needed based on user message
 * @param {string} userMessage - User's input
 * @returns {boolean}
 */
export function shouldIncludeABNT(userMessage) {
  const abntKeywords = [
    'petiç',
    'contest',
    'recurso',
    'habeas',
    'alegaç',
    'embarg',
    'format',
    'abnt',
    'documento',
    'peça'
  ];

  const lowerMessage = userMessage.toLowerCase();
  return abntKeywords.some(keyword => lowerMessage.includes(keyword));
}

/**
 * Detect document type from user message
 * @param {string} userMessage - User's input
 * @returns {string|null}
 */
export function detectDocumentType(userMessage) {
  const typeMap = {
    'petição inicial': 'peticao-inicial',
    'contestação': 'contestacao',
    'habeas corpus': 'habeas-corpus',
    'apelação': 'apelacao',
    'agravo': 'agravo-interno',
    'embargos de declaração': 'embargos-declaracao',
    'alegações finais': 'alegacoes-finais',
    'recurso especial': 'recurso-especial'
  };

  const lowerMessage = userMessage.toLowerCase();

  for (const [key, value] of Object.entries(typeMap)) {
    if (lowerMessage.includes(key)) {
      return value;
    }
  }

  return null;
}

export default {
  buildSystemPrompt,
  shouldIncludeTools,
  shouldIncludeABNT,
  detectDocumentType
};
```

---

### Step 3: Update ROMAgent Class

**File:** `src/index.js` (modify existing)

```javascript
// Add imports at top
import {
  buildSystemPrompt,
  shouldIncludeTools,
  shouldIncludeABNT,
  detectDocumentType
} from './modules/prompts/prompt-builder.js';

// Inside ROMAgent class, modify processar() method:

async processar(mensagem, opcoes = {}) {
  try {
    // Auto-detect prompt requirements
    const includeTools = opcoes.includeTools !== undefined
      ? opcoes.includeTools
      : shouldIncludeTools(mensagem);

    const includeABNT = opcoes.includeABNT !== undefined
      ? opcoes.includeABNT
      : shouldIncludeABNT(mensagem);

    const documentType = opcoes.documentType || detectDocumentType(mensagem);

    // Build optimized system prompt
    const systemPrompt = buildSystemPrompt({
      includeTools,
      includeABNT,
      documentType
    });

    // Use feature flag to allow rollback
    const useOptimizedPrompts = process.env.PROMPTS_VERSION !== 'legacy';

    const finalSystemPrompt = useOptimizedPrompts
      ? systemPrompt
      : this.buildLegacySystemPrompt(); // Fallback to old prompts

    logger.info('Processing message', {
      useOptimizedPrompts,
      includeTools,
      includeABNT,
      documentType,
      promptSize: finalSystemPrompt.length
    });

    // Continue with Claude API call...
    const response = await this.anthropic.messages.create({
      model: this.model,
      max_tokens: this.maxTokens,
      system: finalSystemPrompt, // Use built prompt here
      messages: [
        ...this.historico,
        { role: 'user', content: mensagem }
      ],
      stream: true
    });

    // ... rest of method
  } catch (error) {
    logger.error('Error processing message', { error });
    throw error;
  }
}

// Add legacy prompt builder for rollback
buildLegacySystemPrompt() {
  // Import old prompts
  const { MASTER_ROM } = require('./modules/promptsCompletos.js');
  return JSON.stringify(MASTER_ROM); // Or however it was built before
}
```

---

### Step 4: Update Chat Stream Routes

**File:** `src/routes/chat-stream.js` (modify existing)

```javascript
// Add import
import { buildSystemPrompt, shouldIncludeTools, shouldIncludeABNT, detectDocumentType } from '../modules/prompts/prompt-builder.js';

// In the POST /stream endpoint:

router.post('/stream', async (req, res) => {
  try {
    const { message, history = [], options = {} } = req.body;

    // Auto-detect or use explicit options
    const includeTools = options.includeTools !== undefined
      ? options.includeTools
      : shouldIncludeTools(message);

    const includeABNT = options.includeABNT !== undefined
      ? options.includeABNT
      : shouldIncludeABNT(message);

    const documentType = options.documentType || detectDocumentType(message);

    // Build optimized prompt
    const systemPrompt = buildSystemPrompt({
      includeTools,
      includeABNT,
      documentType
    });

    logger.info('Chat stream started', {
      includeTools,
      includeABNT,
      documentType,
      promptTokens: Math.ceil(systemPrompt.length / 4)
    });

    // Setup SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    // Create Claude stream with optimized prompt
    const stream = await anthropic.messages.create({
      model: process.env.CLAUDE_MODEL || 'claude-sonnet-4-5-20250929',
      max_tokens: 16000,
      system: systemPrompt, // Use optimized prompt
      messages: [
        ...history,
        { role: 'user', content: message }
      ],
      stream: true
    });

    // ... rest of streaming logic
  } catch (error) {
    logger.error('Chat stream error', { error });
    res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
    res.end();
  }
});
```

---

## 4. Feature Flag Setup

### Environment Variable

Add to `.env`:

```bash
# Prompt System Version
# Values: optimized | legacy
# Default: optimized
PROMPTS_VERSION=optimized

# Prompt Loading Options (override auto-detection)
# FORCE_INCLUDE_TOOLS=true
# FORCE_INCLUDE_ABNT=true
```

### Feature Flag Utility

**File:** `src/utils/prompt-feature-flags.js`

```javascript
/**
 * Feature flags for prompt system
 */

export const promptFeatureFlags = {
  /**
   * Use optimized modular prompts
   * @returns {boolean}
   */
  useOptimizedPrompts() {
    return process.env.PROMPTS_VERSION !== 'legacy';
  },

  /**
   * Force include tool instructions (override auto-detection)
   * @returns {boolean|null}
   */
  forceIncludeTools() {
    const force = process.env.FORCE_INCLUDE_TOOLS;
    if (force === 'true') return true;
    if (force === 'false') return false;
    return null; // Auto-detect
  },

  /**
   * Force include ABNT rules (override auto-detection)
   * @returns {boolean|null}
   */
  forceIncludeABNT() {
    const force = process.env.FORCE_INCLUDE_ABNT;
    if (force === 'true') return true;
    if (force === 'false') return false;
    return null; // Auto-detect
  },

  /**
   * Get prompt version string for logging
   * @returns {string}
   */
  getVersion() {
    return this.useOptimizedPrompts() ? 'optimized' : 'legacy';
  }
};

export default promptFeatureFlags;
```

---

## 5. Testing Strategy

### Unit Tests

**File:** `tests/prompts/prompt-builder.test.js`

```javascript
import { describe, it, expect } from 'vitest';
import {
  buildSystemPrompt,
  shouldIncludeTools,
  shouldIncludeABNT,
  detectDocumentType
} from '../../src/modules/prompts/prompt-builder.js';

describe('Prompt Builder', () => {
  describe('buildSystemPrompt', () => {
    it('should build base prompt only', () => {
      const prompt = buildSystemPrompt({});
      expect(prompt).toContain('ROM Agent v3.0');
      expect(prompt).toContain('STREAMING');
      expect(prompt.length).toBeLessThan(2000); // ~1750 chars
    });

    it('should include tools when requested', () => {
      const prompt = buildSystemPrompt({ includeTools: true });
      expect(prompt).toContain('web_search Tool');
      expect(prompt).toContain('execute_code Tool');
    });

    it('should include ABNT when requested', () => {
      const prompt = buildSystemPrompt({ includeABNT: true });
      expect(prompt).toContain('ABNT Formatting');
      expect(prompt).toContain('Margins');
    });

    it('should include all modules when requested', () => {
      const prompt = buildSystemPrompt({
        includeTools: true,
        includeABNT: true
      });
      expect(prompt).toContain('ROM Agent v3.0');
      expect(prompt).toContain('web_search Tool');
      expect(prompt).toContain('ABNT Formatting');
    });
  });

  describe('shouldIncludeTools', () => {
    it('should detect tool keywords', () => {
      expect(shouldIncludeTools('Pesquise jurisprudência sobre X')).toBe(true);
      expect(shouldIncludeTools('Busque precedentes')).toBe(true);
      expect(shouldIncludeTools('Calcule os juros')).toBe(true);
      expect(shouldIncludeTools('Olá, como vai?')).toBe(false);
    });
  });

  describe('shouldIncludeABNT', () => {
    it('should detect formatting keywords', () => {
      expect(shouldIncludeABNT('Redija uma petição inicial')).toBe(true);
      expect(shouldIncludeABNT('Faça uma contestação')).toBe(true);
      expect(shouldIncludeABNT('Formate o documento')).toBe(true);
      expect(shouldIncludeABNT('Qual é o prazo?')).toBe(false);
    });
  });

  describe('detectDocumentType', () => {
    it('should detect document types', () => {
      expect(detectDocumentType('Redija uma petição inicial')).toBe('peticao-inicial');
      expect(detectDocumentType('Preciso de uma contestação')).toBe('contestacao');
      expect(detectDocumentType('Habeas corpus urgente')).toBe('habeas-corpus');
      expect(detectDocumentType('Alguma dúvida')).toBeNull();
    });
  });
});
```

### Integration Tests

**File:** `tests/integration/prompt-system.test.js`

```javascript
import { describe, it, expect, beforeEach } from 'vitest';
import { ROMAgent } from '../../src/index.js';

describe('Prompt System Integration', () => {
  let agent;

  beforeEach(() => {
    agent = new ROMAgent(process.env.ANTHROPIC_API_KEY);
  });

  it('should use optimized prompts by default', async () => {
    process.env.PROMPTS_VERSION = 'optimized';

    const response = await agent.processar('Olá, como funciona?');

    expect(response).toBeDefined();
    // Check that response doesn't have markdown/emojis
    expect(response).not.toMatch(/\*\*/);
    expect(response).not.toMatch(/#{1,6}\s/);
  });

  it('should load tools when needed', async () => {
    const response = await agent.processar('Pesquise jurisprudência sobre prisão preventiva');

    expect(response).toBeDefined();
    // Should contain precedents (indicates web_search was used)
    expect(response).toMatch(/STJ|STF|REsp/);
  });

  it('should format documents correctly', async () => {
    const response = await agent.processar('Redija uma petição inicial sobre contrato');

    expect(response).toBeDefined();
    // Should have proper structure
    expect(response).toMatch(/DOS FATOS/);
    expect(response).toMatch(/DO DIREITO/);
    expect(response).toMatch(/DOS PEDIDOS/);
    // Should not have markdown
    expect(response).not.toMatch(/\*\*/);
  });

  it('should allow rollback to legacy prompts', async () => {
    process.env.PROMPTS_VERSION = 'legacy';

    const response = await agent.processar('Olá');

    expect(response).toBeDefined();
    // Response should still be valid
  });
});
```

### Performance Tests

**File:** `tests/performance/prompt-latency.test.js`

```javascript
import { describe, it, expect } from 'vitest';
import { buildSystemPrompt } from '../../src/modules/prompts/prompt-builder.js';

describe('Prompt Performance', () => {
  it('should build base prompt quickly', () => {
    const start = Date.now();
    const prompt = buildSystemPrompt({});
    const duration = Date.now() - start;

    expect(duration).toBeLessThan(10); // Should be near-instant
  });

  it('should have expected token counts', () => {
    const base = buildSystemPrompt({});
    const withTools = buildSystemPrompt({ includeTools: true });
    const withABNT = buildSystemPrompt({ includeABNT: true });
    const full = buildSystemPrompt({ includeTools: true, includeABNT: true });

    // Approximate token counts (4 chars = 1 token)
    expect(Math.ceil(base.length / 4)).toBeLessThan(500); // ~438 expected
    expect(Math.ceil(withTools.length / 4)).toBeLessThan(1600); // ~1488 expected
    expect(Math.ceil(withABNT.length / 4)).toBeLessThan(1500); // ~1388 expected
    expect(Math.ceil(full.length / 4)).toBeLessThan(2600); // ~2438 expected
  });
});
```

---

## 6. Deployment Plan

### Phase 1: Development (Day 1-2)

**Tasks:**
- [x] Create optimized prompt files
- [ ] Implement prompt-builder.js
- [ ] Update ROMAgent class
- [ ] Update chat-stream routes
- [ ] Add feature flags
- [ ] Write unit tests
- [ ] Run tests locally

**Acceptance:**
- All tests pass
- Base prompt < 500 tokens
- Full prompt < 2,500 tokens
- No accuracy regression on test documents

### Phase 2: Staging (Day 3-5)

**Tasks:**
- [ ] Deploy to staging environment
- [ ] Enable PROMPTS_VERSION=optimized
- [ ] Run automated test suite
- [ ] Manual testing (10+ document types)
- [ ] Load testing (100 requests)
- [ ] Monitor metrics

**Acceptance:**
- TTFT reduced by >50% (base) / >30% (full)
- Token usage reduced by >70%
- Zero formatting errors
- All document types render correctly
- No streaming issues

### Phase 3: Beta Testing (Day 6-8)

**Tasks:**
- [ ] Select 5-10 beta users
- [ ] Enable optimized prompts for beta cohort
- [ ] Collect feedback
- [ ] Monitor error rates
- [ ] Compare quality metrics

**Acceptance:**
- Beta users report same or better quality
- No increase in error rates
- TTFT improvements confirmed
- User satisfaction maintained

### Phase 4: Phased Rollout (Day 9-30)

**Week 1 (10% traffic):**
- [ ] Deploy feature flag: PROMPTS_ROLLOUT_PERCENT=10
- [ ] Monitor intensively (hourly checks)
- [ ] Track TTFT, tokens, errors, quality
- [ ] Ready to rollback if needed

**Week 2 (25% traffic):**
- [ ] Increase to 25% if Week 1 successful
- [ ] Continue monitoring (daily checks)
- [ ] Collect user feedback

**Week 3 (50% traffic):**
- [ ] Increase to 50%
- [ ] Validate at scale
- [ ] Performance under load

**Week 4 (100% traffic):**
- [ ] Full rollout
- [ ] Remove legacy prompts (after 1 week stability)
- [ ] Update documentation
- [ ] Post-mortem report

---

## 7. Rollback Procedure

### Immediate Rollback (< 5 minutes)

**If critical issue detected:**

```bash
# SSH into production server
ssh user@production-server

# Set environment variable
export PROMPTS_VERSION=legacy

# Restart application
pm2 restart rom-agent

# Or using Docker
docker-compose restart rom-agent

# Or using systemd
systemctl restart rom-agent
```

### Feature Flag Rollback

**Update .env:**

```bash
# Change this line
PROMPTS_VERSION=legacy

# Restart app
pm2 restart rom-agent
```

### Code Rollback (if feature flag fails)

```bash
# Revert to previous commit
git revert HEAD

# Or reset to specific commit
git reset --hard <commit-before-changes>

# Rebuild and restart
npm run build
pm2 restart rom-agent
```

### Rollback Triggers

**Auto-rollback if:**
- Error rate increases >5%
- TTFT increases (regression)
- Streaming failures
- User complaints >3 within 1 hour

**Manual rollback if:**
- Quality degradation observed
- Formatting errors increase
- Tool calls fail consistently
- User satisfaction drops

---

## 8. Monitoring

### Metrics to Track

**Performance Metrics:**
```
prompt_build_duration_ms (should be <10ms)
system_prompt_tokens (should be 400-2,500)
system_prompt_size_bytes (should be 1,750-10,000)
ttft_ms (should decrease 30-75%)
```

**Quality Metrics:**
```
document_formatting_errors (should be 0)
markdown_in_output_count (should be 0)
web_search_calls (should match expectations)
precedent_citation_accuracy (should be 100%)
```

**Business Metrics:**
```
token_cost_per_request (should decrease ~75%)
user_satisfaction_score (should maintain)
error_rate (should maintain)
response_quality_score (should maintain)
```

### Logging

**Add to all prompt-related functions:**

```javascript
logger.info('Prompt built', {
  version: 'optimized',
  includeTools,
  includeABNT,
  documentType,
  tokens: estimatedTokens,
  size: prompt.length,
  buildDuration: Date.now() - startTime
});
```

### Dashboards

**Create Grafana dashboard with:**
- Prompt token distribution (histogram)
- TTFT comparison (optimized vs legacy)
- Token cost per request (time series)
- Error rates by prompt version
- Quality scores by document type

### Alerts

**Set up alerts for:**
- Error rate > 5% (slack + pagerduty)
- TTFT > 1000ms for base prompt
- Formatting errors detected
- Rollback triggered

---

## 9. Testing Checklist

### Pre-Deployment

- [ ] Unit tests pass (100% coverage on prompt-builder)
- [ ] Integration tests pass
- [ ] Performance tests confirm token reduction
- [ ] Manual testing: 10+ document types
- [ ] Code review completed
- [ ] Feature flag implemented and tested
- [ ] Rollback procedure documented and tested
- [ ] Monitoring dashboards created
- [ ] Alerts configured

### Staging Validation

- [ ] Deploy to staging successful
- [ ] All routes work with optimized prompts
- [ ] Auto-detection works correctly
- [ ] Manual override works (force flags)
- [ ] Legacy fallback works
- [ ] SSE streaming works
- [ ] No formatting errors in output
- [ ] Precedents still verified
- [ ] Tool limits respected
- [ ] Load test passed (100 concurrent requests)

### Production Readiness

- [ ] Staging tested for 3+ days
- [ ] Beta users approved
- [ ] Performance metrics validated
- [ ] Cost savings confirmed
- [ ] Quality maintained
- [ ] Rollback tested in staging
- [ ] Team trained on new system
- [ ] Documentation updated
- [ ] Stakeholders notified

---

## 10. Troubleshooting

### Issue: Prompt builder fails

**Symptoms:** Error on buildSystemPrompt()

**Solution:**
```javascript
// Check file paths are correct
import.meta.url should resolve correctly

// Verify module exports
console.log(typeof CORE_SYSTEM_PROMPT) // should be 'string'

// Check for circular dependencies
// Use tools like madge to detect
```

### Issue: Auto-detection not working

**Symptoms:** Tools not loaded when expected

**Solution:**
```javascript
// Test detection functions
console.log(shouldIncludeTools('pesquise jurisprudência'));
// Should return true

// Add more keywords if needed
const toolKeywords = [
  'pesquis',
  'busca',
  // ... add more
];

// Or use explicit flags
const options = { includeTools: true };
```

### Issue: TTFT not improved

**Symptoms:** Response still slow

**Solution:**
```javascript
// Verify prompt size
console.log('Prompt tokens:', Math.ceil(prompt.length / 4));
// Should be <500 for base

// Check if legacy prompts loaded accidentally
console.log('Using optimized:', promptFeatureFlags.useOptimizedPrompts());
// Should be true

// Profile the prompt building
console.time('buildPrompt');
const prompt = buildSystemPrompt(options);
console.timeEnd('buildPrompt');
// Should be <10ms
```

### Issue: Quality degradation

**Symptoms:** Output quality worse than before

**Solution:**
```javascript
// Check if critical rules present in output
const prompt = buildSystemPrompt(options);
console.log(prompt.includes('STREAMING')); // Must be true
console.log(prompt.includes('web_search')); // If tools loaded

// Compare prompts side by side
const legacy = buildLegacySystemPrompt();
const optimized = buildSystemPrompt(options);
// Manually review what's missing

// Gradually add back missing sections
// Update CORE_SYSTEM_PROMPT if needed
```

---

## 11. Success Criteria

### Must Have (Go/No-Go)

✅ **Zero regression in output quality**
✅ **Token reduction >70% (base prompt)**
✅ **TTFT improvement >50% (base)**
✅ **Zero increase in error rate**
✅ **Streaming still works perfectly**
✅ **All tests pass**
✅ **Rollback works in <5 minutes**

### Nice to Have

🎯 Cost savings >$50/month
🎯 User satisfaction maintained or improved
🎯 Code is maintainable and documented
🎯 Monitoring is comprehensive

### Failure Criteria (Auto-Rollback)

❌ Error rate increases >5%
❌ TTFT increases (regression)
❌ Quality score drops >10%
❌ User complaints >5 in first week
❌ Streaming failures
❌ Tool calls fail consistently

---

## 12. Post-Deployment

### Week 1
- Monitor hourly
- Collect metrics
- Address any issues immediately
- Be ready to rollback

### Week 2-4
- Monitor daily
- Analyze cost savings
- Collect user feedback
- Fine-tune if needed

### After 1 Month
- Write post-mortem report
- Document lessons learned
- Remove legacy code (if stable)
- Update team playbook

---

## Appendix: Quick Reference

### Environment Variables
```bash
PROMPTS_VERSION=optimized          # or 'legacy'
FORCE_INCLUDE_TOOLS=true           # optional override
FORCE_INCLUDE_ABNT=true            # optional override
```

### API Usage
```javascript
// Auto-detection (recommended)
const response = await agent.processar(message);

// Explicit control
const response = await agent.processar(message, {
  includeTools: true,
  includeABNT: true,
  documentType: 'peticao-inicial'
});
```

### Monitoring Queries
```promql
# Average prompt tokens
avg(system_prompt_tokens)

# TTFT p95
histogram_quantile(0.95, rate(ttft_ms_bucket[5m]))

# Error rate
rate(request_errors[5m]) / rate(request_total[5m])
```

---

**Document Version:** 1.0
**Last Updated:** 2026-01-09
**Next Review:** After Phase 4 completion
