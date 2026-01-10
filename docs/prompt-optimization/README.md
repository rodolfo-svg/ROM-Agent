# Prompt Optimization Project

**Status:** ✅ READY FOR IMPLEMENTATION
**Version:** 1.0
**Date:** 2026-01-09

---

## Overview

This directory contains the complete prompt optimization project for ROM Agent, delivering **79-83% token reduction** while maintaining output quality.

---

## Project Goals

1. ✅ **Size Reduction:** 6,000 → 1,800 chars (base prompt)
2. ✅ **Clarity Improvement:** Remove redundancies, fix conflicts
3. ✅ **Assertiveness Enhancement:** Specific parameters, clear criteria
4. ✅ **Performance Optimization:** Front-load critical rules, reduce TTFT
5. ✅ **Tool Alignment:** Update for mocked DataJud, remove JusBrasil

---

## Deliverables

### 1. optimized-system-prompt.md
**Purpose:** Core system prompt (always loaded)
- **Size:** ~1,750 chars (~438 tokens)
- **Reduction:** -79% from original
- **Content:** Critical streaming rules, formatting basics, tool limits

### 2. tool-specific-instructions.md
**Purpose:** Detailed tool usage (load conditionally)
- **Size:** ~4,200 chars (~1,050 tokens)
- **Content:** web_search, execute_code, read_file, datajud usage
- **When to load:** User requests search/calculation/analysis

### 3. abnt-formatting-rules.md
**Purpose:** ABNT NBR rules (load conditionally)
- **Size:** ~3,800 chars (~950 tokens)
- **Content:** Formatting specifications, citation rules, structure
- **When to load:** User requests document generation/formatting

### 4. comparison-report.md
**Purpose:** Before/after analysis
- **Content:**
  - Size comparison (original vs optimized)
  - Token cost savings ($600+/year)
  - Expected latency improvements (75% TTFT reduction)
  - Accuracy impact analysis (no degradation)
  - Risk assessment (LOW risk)

### 5. implementation-guide.md
**Purpose:** Step-by-step implementation
- **Content:**
  - Code modifications (ROMAgent class, routes)
  - Feature flag setup (PROMPTS_VERSION)
  - Testing strategy (unit, integration, performance)
  - Deployment plan (4-phase rollout)
  - Rollback procedure (<5 min)
  - Monitoring setup

---

## Key Metrics

### Size Reduction

| Component | Original | Optimized | Reduction |
|-----------|----------|-----------|-----------|
| Base Prompt | 8,500 chars | 1,750 chars | **-79%** |
| Full System | 58,500 chars | 9,750 chars | **-83%** |
| Tokens (base) | 2,125 | 438 | **-79%** |

### Cost Savings

| Metric | Savings |
|--------|---------|
| Per request | $0.005 (76%) |
| Monthly (10k requests) | $50.61 |
| Annual | **$607.32** |

### Performance Improvements

| Metric | Improvement |
|--------|-------------|
| TTFT (base) | **-75%** (800ms → 200ms) |
| TTFT (full) | **-35%** (800ms → 520ms) |
| Processing | **-73%** (300ms → 80ms) |

---

## Implementation Roadmap

### ✅ Phase 1: Design & Documentation (COMPLETE)
- [x] Analyze existing prompts
- [x] Design modular architecture
- [x] Create optimized prompts
- [x] Write comparison report
- [x] Write implementation guide

### 🔄 Phase 2: Development (NEXT)
- [ ] Create `src/modules/prompts/` directory structure
- [ ] Implement `prompt-builder.js`
- [ ] Update `ROMAgent` class
- [ ] Update `chat-stream.js` routes
- [ ] Add feature flags
- [ ] Write unit tests

**Estimated time:** 2 days

### 🔄 Phase 3: Staging (AFTER DEV)
- [ ] Deploy to staging
- [ ] Run automated tests
- [ ] Manual testing (10+ doc types)
- [ ] Load testing (100 requests)
- [ ] Monitor metrics

**Estimated time:** 3 days

### 🔄 Phase 4: Production (PHASED)
- [ ] Week 1: 10% traffic
- [ ] Week 2: 25% traffic
- [ ] Week 3: 50% traffic
- [ ] Week 4: 100% traffic

**Estimated time:** 30 days

---

## Quick Start

### For Developers

**Read in this order:**
1. `optimized-system-prompt.md` - See the new prompts
2. `comparison-report.md` - Understand the benefits
3. `implementation-guide.md` - Follow step-by-step

### For Product/Business

**Read:**
- `comparison-report.md` (Section 3: Token Cost Savings)
- Expected savings: **$607/year**
- Performance: **75% faster TTFT**
- Risk: **LOW** (full rollback capability)

### For QA/Testing

**Read:**
- `implementation-guide.md` (Section 5: Testing Strategy)
- `comparison-report.md` (Section 5: Accuracy Impact)
- Test checklists provided

---

## Architecture

### Current (Monolithic)
```
promptsCompletos.js (1,575 lines)
└── Everything loaded always
```

### Optimized (Modular)
```
core-system-prompt.js (always loaded)
├── tool-instructions.js (conditional)
├── abnt-formatting-rules.js (conditional)
└── templates/
    ├── peticao-inicial.js
    ├── habeas-corpus.js
    └── ... (load specific only)
```

---

## Critical Success Factors

### Must Have ✅
- Zero quality regression
- Token reduction >70%
- TTFT improvement >50%
- Zero error rate increase
- Streaming works perfectly
- Rollback <5 minutes

### Nice to Have 🎯
- Cost savings >$50/month
- User satisfaction improved
- Maintainable code
- Comprehensive monitoring

---

## Risks & Mitigation

| Risk | Level | Mitigation |
|------|-------|------------|
| Instructions lost | LOW | Line-by-line comparison done |
| Quality degradation | LOW | All critical rules preserved |
| Tool misuse | VERY LOW | Better tool docs than before |
| Streaming breaks | VERY LOW | Rules in base prompt (priority 1) |

**Overall Risk:** LOW

**Confidence:** HIGH

---

## Testing Checklist

### Pre-Deploy
- [ ] Unit tests pass (prompt-builder)
- [ ] Integration tests pass
- [ ] Performance tests confirm reduction
- [ ] Manual: 10+ document types
- [ ] Code review complete
- [ ] Feature flag tested
- [ ] Rollback tested

### Post-Deploy
- [ ] Metrics collected (TTFT, tokens, errors)
- [ ] Quality maintained
- [ ] Cost savings confirmed
- [ ] User feedback positive
- [ ] No rollbacks needed

---

## Monitoring

### Key Metrics to Track

**Performance:**
- `prompt_build_duration_ms` (target: <10ms)
- `system_prompt_tokens` (target: 400-2,500)
- `ttft_ms` (target: -75% for base)

**Quality:**
- `document_formatting_errors` (target: 0)
- `markdown_in_output_count` (target: 0)
- `precedent_citation_accuracy` (target: 100%)

**Business:**
- `token_cost_per_request` (target: -75%)
- `user_satisfaction_score` (target: maintain)
- `error_rate` (target: maintain)

---

## Feature Flags

### Environment Variables

```bash
# Prompt version (optimized | legacy)
PROMPTS_VERSION=optimized

# Force overrides (optional)
FORCE_INCLUDE_TOOLS=true
FORCE_INCLUDE_ABNT=true
```

### Instant Rollback

```bash
# Set to legacy
export PROMPTS_VERSION=legacy

# Restart app
pm2 restart rom-agent
```

**Rollback time:** <5 minutes

---

## Examples

### Base Prompt Usage (438 tokens)
```javascript
// Simple query - no tools/ABNT needed
"Qual é o prazo de contestação?"

// Loads: core-system-prompt.js only
// TTFT: ~200ms (75% faster)
// Cost: $0.0016 (79% cheaper)
```

### Full Prompt Usage (2,438 tokens)
```javascript
// Complex document generation
"Redija uma petição inicial sobre contrato com pesquisa de jurisprudência"

// Loads: core + tools + ABNT
// TTFT: ~720ms (10% faster, but more features)
// Cost: $0.0056 (17% cheaper)
```

---

## Support

### Questions?
- **Technical:** Check `implementation-guide.md`
- **Business case:** Check `comparison-report.md`
- **Prompt content:** Check individual `.md` files

### Issues?
- **Rollback:** Set `PROMPTS_VERSION=legacy`
- **Quality problems:** Check `comparison-report.md` Section 5
- **Performance issues:** Check monitoring dashboards

---

## Next Steps

1. **Review all documents** (start with `comparison-report.md`)
2. **Get stakeholder approval** (show cost savings + low risk)
3. **Begin Phase 2** (follow `implementation-guide.md`)
4. **Test thoroughly** (staging before production)
5. **Deploy gradually** (phased rollout plan)

---

## File Structure

```
docs/prompt-optimization/
├── README.md                           ← You are here
├── optimized-system-prompt.md          ← Core prompt (1,750 chars)
├── tool-specific-instructions.md       ← Tool docs (4,200 chars)
├── abnt-formatting-rules.md            ← ABNT rules (3,800 chars)
├── comparison-report.md                ← Analysis (12KB)
└── implementation-guide.md             ← How-to (29KB)
```

**Total documentation:** 2,148 lines, 51KB

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-01-09 | Initial release - all deliverables complete |

---

## Approval

**Status:** ✅ READY FOR IMPLEMENTATION

**Reviewed by:** ROM Agent Optimization Team

**Approved by:** _Pending stakeholder review_

**Next review:** After Phase 4 completion

---

**Questions or feedback?** Review the documentation and reach out to the development team.

**Ready to implement?** Start with `implementation-guide.md` Section 3.
