/**
 * ROM Agent - Bedrock Integration Tests
 * Tests for AWS Bedrock model connectivity and fallback chain
 *
 * @module bedrock-integration.test
 * @version 1.0.0
 *
 * Execution:
 * - With credentials: node tests/bedrock-integration.test.js
 * - Dry run (no API calls): DRY_RUN=1 node tests/bedrock-integration.test.js
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';

// ============================================================
// TEST CONFIGURATION
// ============================================================

const DRY_RUN = process.env.DRY_RUN === '1';
const TIMEOUT = 60000; // 60s for API calls

// Colors for console output
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const BLUE = '\x1b[34m';
const CYAN = '\x1b[36m';
const RESET = '\x1b[0m';

// ============================================================
// HELPER FUNCTIONS
// ============================================================

function log(message, color = RESET) {
  console.log(`${color}${message}${RESET}`);
}

function logSuccess(message) {
  log(`  [PASS] ${message}`, GREEN);
}

function logFail(message) {
  log(`  [FAIL] ${message}`, RED);
}

function logInfo(message) {
  log(`  [INFO] ${message}`, CYAN);
}

function logWarning(message) {
  log(`  [WARN] ${message}`, YELLOW);
}

// ============================================================
// TEST RESULTS TRACKER
// ============================================================

const results = {
  passed: 0,
  failed: 0,
  skipped: 0,
  tests: []
};

function recordTest(name, passed, details = null) {
  results.tests.push({ name, passed, details });
  if (passed) {
    results.passed++;
    logSuccess(name);
  } else {
    results.failed++;
    logFail(name);
    if (details) {
      console.log(`     Details: ${details}`);
    }
  }
}

function recordSkip(name, reason) {
  results.tests.push({ name, skipped: true, reason });
  results.skipped++;
  logWarning(`${name} - SKIPPED: ${reason}`);
}

// ============================================================
// TESTS: AWS CREDENTIAL VALIDATION
// ============================================================

log('\n========================================', BLUE);
log('  BEDROCK INTEGRATION TESTS', BLUE);
log('========================================\n', BLUE);

log('1. AWS Credential Validation', CYAN);
log('----------------------------', CYAN);

// Test: Required credentials check
try {
  const { validateAWSCredentials, isConfigured, getCredentialStatus, validateWithDetails } =
    await import('../src/utils/aws-credential-validator.js');

  // Test isConfigured function
  const configured = isConfigured();
  recordTest('isConfigured() returns boolean', typeof configured === 'boolean');

  // Test getCredentialStatus function
  const status = getCredentialStatus();
  recordTest('getCredentialStatus() returns object with required fields',
    status && typeof status.configured === 'boolean' && status.required && status.optional);

  // Test validateWithDetails function
  const validation = validateWithDetails();
  recordTest('validateWithDetails() returns validation result',
    validation && typeof validation.success === 'boolean' && Array.isArray(validation.errors));

  // If credentials are configured, test validateAWSCredentials
  if (configured) {
    try {
      const valid = validateAWSCredentials();
      recordTest('validateAWSCredentials() passes with valid credentials', valid === true);
    } catch (error) {
      recordTest('validateAWSCredentials() throws on missing credentials', false, error.message);
    }
  } else {
    recordSkip('validateAWSCredentials() live test', 'Credentials not configured');
  }

} catch (error) {
  recordTest('AWS credential validator module loads', false, error.message);
}

// ============================================================
// TESTS: MODEL FALLBACK CHAIN
// ============================================================

log('\n2. Model Fallback Chain', CYAN);
log('------------------------', CYAN);

try {
  const {
    FALLBACK_CHAIN,
    getFallbackModel,
    getPrimaryModel,
    isValidModel,
    getModelInfo
  } = await import('../src/utils/model-fallback.js');

  // Test: FALLBACK_CHAIN exists and has correct structure
  recordTest('FALLBACK_CHAIN is an array with 6 models',
    Array.isArray(FALLBACK_CHAIN) && FALLBACK_CHAIN.length === 6);

  // Test: All model IDs use us. prefix (not global.)
  const allUseUsPrefix = FALLBACK_CHAIN.every(m =>
    m.modelId.startsWith('us.') &&
    !m.modelId.startsWith('global.')
  );
  recordTest('All model IDs use us. prefix (not global.)', allUseUsPrefix);

  // Test: Specific models have correct IDs
  const opusModel = FALLBACK_CHAIN[0];
  recordTest('Opus 4.5 model ID is correct',
    opusModel.modelId === 'us.anthropic.claude-opus-4-5-20251101-v1:0');

  const sonnetModel = FALLBACK_CHAIN[1];
  recordTest('Sonnet 4.5 model ID is correct',
    sonnetModel.modelId === 'us.anthropic.claude-sonnet-4-5-20250929-v1:0');

  const haikuModel = FALLBACK_CHAIN[2];
  recordTest('Haiku 4.5 model ID is correct',
    haikuModel.modelId === 'us.anthropic.claude-haiku-4-5-20251001-v1:0');

  // Test: getPrimaryModel returns first model
  const primary = getPrimaryModel();
  recordTest('getPrimaryModel() returns Opus 4.5',
    primary && primary.modelId === FALLBACK_CHAIN[0].modelId);

  // Test: getFallbackModel works correctly
  const fallback = getFallbackModel(FALLBACK_CHAIN[0].modelId);
  recordTest('getFallbackModel() returns Sonnet 4.5 after Opus 4.5',
    fallback && fallback.modelId === FALLBACK_CHAIN[1].modelId);

  // Test: getFallbackModel returns null for last model
  const noFallback = getFallbackModel(FALLBACK_CHAIN[FALLBACK_CHAIN.length - 1].modelId);
  recordTest('getFallbackModel() returns null for last model',
    noFallback === null);

  // Test: isValidModel works
  recordTest('isValidModel() returns true for valid model',
    isValidModel(FALLBACK_CHAIN[0].modelId) === true);
  recordTest('isValidModel() returns false for invalid model',
    isValidModel('invalid.model.id') === false);

  // Test: getModelInfo works
  const modelInfo = getModelInfo(FALLBACK_CHAIN[0].modelId);
  recordTest('getModelInfo() returns model info',
    modelInfo && modelInfo.tier === 'premium');

  // Test: Each model has required properties
  const allHaveRequiredProps = FALLBACK_CHAIN.every(m =>
    m.modelId && m.tier && m.quality && m.speed && m.cost && m.description
  );
  recordTest('All models have required properties', allHaveRequiredProps);

} catch (error) {
  recordTest('Model fallback module loads', false, error.message);
}

// ============================================================
// TESTS: BEDROCK MODULE STARTUP VALIDATION
// ============================================================

log('\n3. Bedrock Module Startup Validation', CYAN);
log('------------------------------------', CYAN);

// Only test if credentials are configured
const hasCredentials = process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY;

if (hasCredentials) {
  try {
    // This should not throw if credentials are set
    const bedrock = await import('../src/modules/bedrock.js');

    recordTest('Bedrock module loads with valid credentials', true);
    recordTest('MODELOS_BEDROCK is exported',
      bedrock.MODELOS_BEDROCK && typeof bedrock.MODELOS_BEDROCK === 'object');
    recordTest('INFERENCE_PROFILES is exported',
      bedrock.INFERENCE_PROFILES && typeof bedrock.INFERENCE_PROFILES === 'object');
    recordTest('conversar function is exported',
      typeof bedrock.conversar === 'function');
    recordTest('conversarStream function is exported',
      typeof bedrock.conversarStream === 'function');

    // Test INFERENCE_PROFILES has correct mappings
    const profiles = bedrock.INFERENCE_PROFILES;
    recordTest('INFERENCE_PROFILES maps claude-opus-4-5 correctly',
      profiles['claude-opus-4-5'] === 'us.anthropic.claude-opus-4-5-20251101-v1:0');
    recordTest('INFERENCE_PROFILES maps claude-sonnet-4-5 correctly',
      profiles['claude-sonnet-4-5'] === 'us.anthropic.claude-sonnet-4-5-20250929-v1:0');
    recordTest('INFERENCE_PROFILES maps claude-haiku-4-5 correctly',
      profiles['claude-haiku-4-5'] === 'us.anthropic.claude-haiku-4-5-20251001-v1:0');

  } catch (error) {
    recordTest('Bedrock module loads', false, error.message);
  }
} else {
  recordSkip('Bedrock module startup test', 'AWS credentials not configured');
  logInfo('Set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY to run these tests');
}

// ============================================================
// TESTS: LIVE API CALLS (only if not DRY_RUN)
// ============================================================

log('\n4. Live API Tests', CYAN);
log('-----------------', CYAN);

if (DRY_RUN) {
  recordSkip('Live API tests', 'DRY_RUN=1 is set');
  logInfo('Run without DRY_RUN=1 to test actual API calls');
} else if (!hasCredentials) {
  recordSkip('Live API tests', 'AWS credentials not configured');
} else {
  try {
    const { conversar } = await import('../src/modules/bedrock.js');

    // Test: Simple conversar call with Haiku (fastest/cheapest)
    logInfo('Testing API call with Claude Haiku 4.5 (may take 10-30s)...');

    const startTime = Date.now();
    const response = await conversar('Responda apenas com: OK', {
      modelo: 'anthropic.claude-haiku-4-5-20251001-v1:0',
      maxTokens: 10,
      enableTools: false,
      enableCache: false
    });
    const elapsed = Date.now() - startTime;

    recordTest('conversar() returns response object',
      response && typeof response === 'object');
    recordTest('conversar() response has sucesso field',
      response && 'sucesso' in response);

    if (response.sucesso) {
      recordTest('conversar() API call succeeded', true);
      logInfo(`Response time: ${elapsed}ms`);
      logInfo(`Tokens used: ${response.uso?.tokensTotal || 'N/A'}`);
    } else {
      recordTest('conversar() API call succeeded', false, response.erro);
    }

  } catch (error) {
    recordTest('Live API call', false, error.message);
  }
}

// ============================================================
// TEST SUMMARY
// ============================================================

log('\n========================================', BLUE);
log('  TEST SUMMARY', BLUE);
log('========================================', BLUE);

console.log(`
  ${GREEN}Passed:${RESET}  ${results.passed}
  ${RED}Failed:${RESET}  ${results.failed}
  ${YELLOW}Skipped:${RESET} ${results.skipped}
  ${CYAN}Total:${RESET}   ${results.tests.length}
`);

if (results.failed > 0) {
  log('FAILED TESTS:', RED);
  results.tests
    .filter(t => !t.passed && !t.skipped)
    .forEach(t => {
      console.log(`  - ${t.name}`);
      if (t.details) console.log(`    ${t.details}`);
    });
}

log('\n========================================\n', BLUE);

// Exit with appropriate code
process.exit(results.failed > 0 ? 1 : 0);
