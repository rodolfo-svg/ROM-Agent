# AWS SDK Command Cloning Bug - Complete Fix Summary

**Date**: 2025-12-19
**Status**: ✅ FULLY RESOLVED AND DEPLOYED

---

## Overview

This document summarizes the discovery, fix, and deployment of a critical bug in `src/utils/resilient-invoke.js` where AWS SDK v3 Command instances were being incorrectly cloned using the spread operator, destroying the class instance and causing validation errors.

---

## The Bug

### Root Cause
The spread operator (`{...command}`) was used to clone AWS SDK Command instances, which converts them from class instances to plain objects, losing all class methods including `resolveMiddleware()`.

### AWS SDK Validation
The AWS SDK v3 validates Command objects before sending:

```javascript
if (!command || typeof command.resolveMiddleware !== "function") {
  throw new Error(
    `INVALID_COMMAND_TO_SEND: ${command?.constructor?.name || typeof command}`
  );
}
```

When using spread operator, this validation fails because the resulting object lacks the `resolveMiddleware()` method.

---

## Two Instances Fixed

### Bug Instance #1: WITH Fallback Path
**File**: `src/utils/resilient-invoke.js`
**Line**: 88
**Commit**: `cbcc7a27`

**BEFORE (BROKEN)**:
```javascript
const commandWithModel = {
  ...command,  // ❌ Destroys Command class instance
  input: {
    ...command.input,
    modelId: currentModelId
  }
};
```

**AFTER (FIXED)**:
```javascript
const commandWithModel = cloneCommandWithOverrides(command, {
  modelId: currentModelId
});
```

### Bug Instance #2: WITHOUT Fallback Path
**File**: `src/utils/resilient-invoke.js`
**Line**: 124
**Commit**: `690d67bd`

**BEFORE (BROKEN)**:
```javascript
const commandWithModel = {
  ...command,  // ❌ Also destroys Command class instance
  input: {
    ...command.input,
    modelId: initialModelId
  }
};
```

**AFTER (FIXED)**:
```javascript
const commandWithModel = cloneCommandWithOverrides(command, {
  modelId: initialModelId
});
```

---

## The Solution

### Helper Function Added
**File**: `src/utils/resilient-invoke.js`
**Lines**: 30-42

```javascript
/**
 * Clona o Command preservando a classe do AWS SDK v3
 * @param {Object} command - Instância de Command (ConverseCommand, InvokeModelCommand, etc)
 * @param {Object} overrides - Propriedades para sobrescrever no input
 * @returns {Object} Nova instância do mesmo tipo de Command
 */
function cloneCommandWithOverrides(command, overrides = {}) {
  const Ctor = command?.constructor;

  // Se não é um Command válido, melhor falhar cedo (fica MUITO mais diagnosticável)
  if (!command || typeof command.resolveMiddleware !== "function" || typeof Ctor !== "function") {
    throw new Error(
      `INVALID_COMMAND_TO_SEND: ${command?.constructor?.name || typeof command}`
    );
  }

  const input = command.input || {};
  return new Ctor({ ...input, ...overrides });  // ✅ Preserves the class!
}
```

### Why This Works

1. **Gets constructor**: `command.constructor` returns the original class (e.g., `ConverseCommand`)
2. **Creates new instance**: `new Ctor(...)` instantiates a new object of the same class
3. **Preserves methods**: The new instance has all required methods (`resolveMiddleware`, etc.)
4. **Validates early**: Fails quickly if the Command is not valid

---

## Validation

### Code Pattern Comparison

```javascript
// ❌ WRONG - destroys Command class:
const broken = { ...command, input: { ...command.input, modelId: "new" } };
console.log(broken.constructor.name);         // "Object" ❌
console.log(typeof broken.resolveMiddleware); // "undefined" ❌

// ✅ CORRECT - preserves Command class:
const fixed = cloneCommandWithOverrides(command, { modelId: "new" });
console.log(fixed.constructor.name);         // "ConverseCommand" ✅
console.log(typeof fixed.resolveMiddleware); // "function" ✅
```

### Search Verification

All instances of Command manipulation patterns have been verified clean:

```bash
# Search for commandWithModel usage
grep -n "commandWithModel" src/utils/resilient-invoke.js
# Result: All 6 occurrences use cloneCommandWithOverrides() ✅

# Search for spread operator on command
rg '\.\.\.\s*command[^\w]' src
# Result: No matches ✅
```

---

## Deployment Status

### Commits
1. **cbcc7a27** - "fix(bedrock): corrigir clonagem de Command instances no resilient-invoke"
   - Fixed line 88 (WITH fallback path)

2. **690d67bd** - "fix(bedrock): corrigir clonagem de Command no path sem fallback (linha 124)"
   - Fixed line 124 (WITHOUT fallback path)

### Git Status
```bash
git log --oneline -3
# 690d67bd fix(bedrock): corrigir clonagem de Command no path sem fallback (linha 124)
# cbcc7a27 fix(bedrock): corrigir clonagem de Command instances no resilient-invoke
# ecbe1369 chore: forçar redeploy com correção AWS_REGION=us-west-2 (Oregon)

git status
# On branch main
# Your branch is up to date with 'origin/main'
# nothing to commit, working tree clean ✅
```

### Production Deployment
**URL**: https://iarom.com.br
**Status**: ✅ Deployed
**Uptime**: 101s (recent deploy confirmed)
**Region**: `us-west-2` ✅

**URL**: https://staging.iarom.com.br
**Status**: ✅ Deployed
**Uptime**: 1354s
**Region**: `us-west-2` ✅

---

## Remaining Issue (Separate from Command Cloning)

### AWS Bedrock Inference Profile Requirement
Both servers still return HTTP 500 with:
```
"error": "All models in fallback chain failed (1 attempts)"
```

This is caused by a **different issue** - AWS Bedrock ValidationException:
```
ValidationException: Invocation of model ID anthropic.claude-sonnet-4-5-20250929-v1:0
with on-demand throughput isn't supported.
Retry your request with the ID or ARN of an inference profile that contains this model.
```

**Status**: ❌ Not yet resolved (documented in `docs/BEDROCK_ISSUES_RESOLVED.md`)

This is a new AWS Bedrock API requirement to use Inference Profile ARN instead of direct model ID.

---

## Key Learnings

1. **Never use spread operator on AWS SDK v3 Command instances**
   - Always clone using the constructor: `new command.constructor({...})`

2. **Early validation prevents silent failures**
   - The helper function validates Command instances before attempting to use them

3. **Test both code paths**
   - The bug existed in BOTH the fallback and non-fallback code paths
   - Comprehensive search was required to find all instances

4. **AWS SDK v3 requires proper class instances**
   - Plain objects with the same properties will fail validation
   - Class methods (like `resolveMiddleware()`) are required

---

## Files Modified

- ✅ `src/utils/resilient-invoke.js` (lines 30-42, 88, 124)
- ✅ `docs/BEDROCK_ISSUES_RESOLVED.md` (comprehensive documentation)
- ✅ `docs/COMMAND_CLONING_FIX_SUMMARY.md` (this file)

---

## Related Documentation

- **Full Issue Tracking**: `docs/BEDROCK_ISSUES_RESOLVED.md`
- **AWS Region Fix**: Commit `2b576916`
- **AWS SDK v3 Documentation**: https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/

---

## Conclusion

All instances of the Command cloning bug have been identified and fixed. The solution uses proper constructor-based cloning to preserve AWS SDK v3 Command class instances. Both commits have been pushed to GitHub and deployed to production.

The remaining HTTP 500 errors are due to a separate AWS Bedrock Inference Profile requirement, not related to Command cloning.

**Status**: ✅ COMMAND CLONING BUG FULLY RESOLVED
