#!/usr/bin/env node
/**
 * ROM Agent - Automated Authentication Load Testing
 *
 * Tests the authentication system with varied loads autonomously after deploy.
 *
 * Test Scenarios:
 * - Single user login/logout
 * - Concurrent users (5, 10, 20)
 * - Session persistence
 * - Failed login attempts
 * - Rapid successive requests
 * - Cookie handling
 *
 * Usage:
 *   node scripts/test-auth-load.js
 *   node scripts/test-auth-load.js --url https://rom-agent-ia.onrender.com
 */

import fetch from 'node-fetch';

// ============================================================
// CONFIGURATION
// ============================================================

const DEFAULT_URL = 'https://rom-agent-ia.onrender.com';
const TEST_USER = {
  email: 'teste@iarom.com.br',
  password: 'senha123'
};

const COLORS = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m'
};

// ============================================================
// UTILITIES
// ============================================================

function log(message, color = 'reset') {
  console.log(`${COLORS[color]}${message}${COLORS.reset}`);
}

function logSection(title) {
  console.log();
  log('━'.repeat(60), 'cyan');
  log(`  ${title}`, 'bright');
  log('━'.repeat(60), 'cyan');
}

function logTest(name, status, details = '') {
  const statusIcon = status === 'pass' ? '✅' : status === 'fail' ? '❌' : '⏳';
  const statusColor = status === 'pass' ? 'green' : status === 'fail' ? 'red' : 'yellow';

  log(`${statusIcon} ${name}`, statusColor);
  if (details) {
    log(`   ${details}`, 'gray');
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ============================================================
// TEST RESULTS TRACKING
// ============================================================

const results = {
  total: 0,
  passed: 0,
  failed: 0,
  errors: [],
  metrics: {
    loginLatency: [],
    checkLatency: [],
    logoutLatency: []
  }
};

function recordTest(name, passed, error = null, latency = null) {
  results.total++;

  if (passed) {
    results.passed++;
  } else {
    results.failed++;
    if (error) {
      results.errors.push({ test: name, error: error.message || String(error) });
    }
  }

  if (latency !== null) {
    if (name.includes('login')) results.metrics.loginLatency.push(latency);
    if (name.includes('check')) results.metrics.checkLatency.push(latency);
    if (name.includes('logout')) results.metrics.logoutLatency.push(latency);
  }
}

// ============================================================
// HTTP CLIENT WITH COOKIE SUPPORT
// ============================================================

class AuthClient {
  constructor(baseUrl) {
    this.baseUrl = baseUrl;
    this.cookies = new Map();
  }

  getCookieHeader() {
    return Array.from(this.cookies.entries())
      .map(([name, value]) => `${name}=${value}`)
      .join('; ');
  }

  storeCookies(response) {
    const setCookie = response.headers.raw()['set-cookie'];
    if (setCookie) {
      setCookie.forEach(cookie => {
        const match = cookie.match(/^([^=]+)=([^;]+)/);
        if (match) {
          this.cookies.set(match[1], match[2]);
        }
      });
    }
  }

  async request(path, options = {}) {
    const url = `${this.baseUrl}${path}`;
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers
    };

    if (this.cookies.size > 0) {
      headers['Cookie'] = this.getCookieHeader();
    }

    const startTime = Date.now();
    const response = await fetch(url, {
      ...options,
      headers
    });
    const latency = Date.now() - startTime;

    this.storeCookies(response);

    return { response, latency };
  }

  async login(email, password) {
    return this.request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });
  }

  async check() {
    return this.request('/api/auth/check');
  }

  async logout() {
    return this.request('/api/auth/logout', { method: 'POST' });
  }

  clearCookies() {
    this.cookies.clear();
  }
}

// ============================================================
// TEST SCENARIOS
// ============================================================

/**
 * Test 1: Basic Login Flow
 */
async function testBasicLogin(baseUrl) {
  logSection('TEST 1: Basic Login Flow');

  const client = new AuthClient(baseUrl);

  try {
    // Step 1: Check not authenticated
    log('1️⃣  Checking initial auth status...', 'blue');
    const { response: checkRes1, latency: lat1 } = await client.check();
    const checkData1 = await checkRes1.json();

    if (!checkData1.authenticated) {
      logTest('Initial check: not authenticated', 'pass', `${lat1}ms`);
      recordTest('Basic Login - Initial Check', true, null, lat1);
    } else {
      logTest('Initial check: should not be authenticated', 'fail');
      recordTest('Basic Login - Initial Check', false);
      return false;
    }

    // Step 2: Login
    log('2️⃣  Logging in...', 'blue');
    const { response: loginRes, latency: lat2 } = await client.login(TEST_USER.email, TEST_USER.password);
    const loginData = await loginRes.json();

    if (loginRes.ok && loginData.success && client.cookies.has('rom.sid')) {
      logTest('Login successful', 'pass', `${lat2}ms - Cookie: ${client.cookies.get('rom.sid').substring(0, 20)}...`);
      recordTest('Basic Login - Login', true, null, lat2);
    } else {
      logTest('Login failed', 'fail', JSON.stringify(loginData));
      recordTest('Basic Login - Login', false);
      return false;
    }

    // Step 3: Check authenticated
    log('3️⃣  Verifying authentication...', 'blue');
    const { response: checkRes2, latency: lat3 } = await client.check();
    const checkData2 = await checkRes2.json();

    if (checkData2.authenticated && checkData2.user) {
      logTest('Authentication verified', 'pass', `${lat3}ms - User: ${checkData2.user.email}`);
      recordTest('Basic Login - Auth Check', true, null, lat3);
    } else {
      logTest('Authentication check failed', 'fail', JSON.stringify(checkData2));
      recordTest('Basic Login - Auth Check', false);
      return false;
    }

    // Step 4: Logout
    log('4️⃣  Logging out...', 'blue');
    const { response: logoutRes, latency: lat4 } = await client.logout();
    const logoutData = await logoutRes.json();

    if (logoutRes.ok && logoutData.success) {
      logTest('Logout successful', 'pass', `${lat4}ms`);
      recordTest('Basic Login - Logout', true, null, lat4);
    } else {
      logTest('Logout failed', 'fail', JSON.stringify(logoutData));
      recordTest('Basic Login - Logout', false);
      return false;
    }

    // Step 5: Verify logged out
    log('5️⃣  Verifying logout...', 'blue');
    const { response: checkRes3, latency: lat5 } = await client.check();
    const checkData3 = await checkRes3.json();

    if (!checkData3.authenticated) {
      logTest('Logout verified', 'pass', `${lat5}ms`);
      recordTest('Basic Login - Logout Check', true, null, lat5);
    } else {
      logTest('Still authenticated after logout', 'fail');
      recordTest('Basic Login - Logout Check', false);
      return false;
    }

    log('\n✅ Basic Login Flow: ALL TESTS PASSED', 'green');
    return true;

  } catch (error) {
    logTest('Basic Login Flow', 'fail', error.message);
    recordTest('Basic Login - Exception', false, error);
    return false;
  }
}

/**
 * Test 2: Session Persistence
 */
async function testSessionPersistence(baseUrl) {
  logSection('TEST 2: Session Persistence');

  const client = new AuthClient(baseUrl);

  try {
    // Login
    log('1️⃣  Logging in...', 'blue');
    const { response: loginRes } = await client.login(TEST_USER.email, TEST_USER.password);
    const loginData = await loginRes.json();

    if (!loginRes.ok || !loginData.success) {
      logTest('Login failed', 'fail');
      recordTest('Session Persistence - Login', false);
      return false;
    }

    const sessionCookie = client.cookies.get('rom.sid');
    logTest('Login successful', 'pass', `Cookie: ${sessionCookie.substring(0, 20)}...`);
    recordTest('Session Persistence - Login', true);

    // Test multiple requests with same session
    log('2️⃣  Testing session persistence (10 requests)...', 'blue');
    let persistenceSuccess = true;

    for (let i = 1; i <= 10; i++) {
      const { response: checkRes, latency } = await client.check();
      const checkData = await checkRes.json();

      if (!checkData.authenticated) {
        logTest(`Request ${i}/10`, 'fail', 'Session lost');
        persistenceSuccess = false;
        break;
      }

      if (i % 3 === 0) {
        log(`   ✓ Requests 1-${i}: Session active (avg ${latency}ms)`, 'gray');
      }

      await sleep(100); // 100ms between requests
    }

    if (persistenceSuccess) {
      logTest('Session persistence', 'pass', '10/10 requests maintained session');
      recordTest('Session Persistence - 10 Requests', true);
    } else {
      recordTest('Session Persistence - 10 Requests', false);
      return false;
    }

    // Cleanup
    await client.logout();

    log('\n✅ Session Persistence: ALL TESTS PASSED', 'green');
    return true;

  } catch (error) {
    logTest('Session Persistence', 'fail', error.message);
    recordTest('Session Persistence - Exception', false, error);
    return false;
  }
}

/**
 * Test 3: Failed Login Attempts
 */
async function testFailedLogins(baseUrl) {
  logSection('TEST 3: Failed Login Attempts');

  const client = new AuthClient(baseUrl);

  try {
    // Test 1: Invalid email
    log('1️⃣  Testing invalid email...', 'blue');
    const { response: res1 } = await client.login('invalido@iarom.com.br', TEST_USER.password);
    const data1 = await res1.json();

    if (res1.status === 401 && !data1.success) {
      logTest('Invalid email rejected', 'pass', data1.error);
      recordTest('Failed Logins - Invalid Email', true);
    } else {
      logTest('Invalid email should be rejected', 'fail');
      recordTest('Failed Logins - Invalid Email', false);
    }

    // Test 2: Invalid password
    log('2️⃣  Testing invalid password...', 'blue');
    client.clearCookies();
    const { response: res2 } = await client.login(TEST_USER.email, 'wrongpassword');
    const data2 = await res2.json();

    if (res2.status === 401 && !data2.success) {
      logTest('Invalid password rejected', 'pass', data2.error);
      recordTest('Failed Logins - Invalid Password', true);
    } else {
      logTest('Invalid password should be rejected', 'fail');
      recordTest('Failed Logins - Invalid Password', false);
    }

    // Test 3: Empty credentials
    log('3️⃣  Testing empty credentials...', 'blue');
    client.clearCookies();
    const { response: res3 } = await client.login('', '');
    const data3 = await res3.json();

    if (res3.status === 400 && !data3.success) {
      logTest('Empty credentials rejected', 'pass', data3.error);
      recordTest('Failed Logins - Empty Credentials', true);
    } else {
      logTest('Empty credentials should be rejected', 'fail');
      recordTest('Failed Logins - Empty Credentials', false);
    }

    // Test 4: Verify no session created
    log('4️⃣  Verifying no session after failed attempts...', 'blue');
    const { response: checkRes } = await client.check();
    const checkData = await checkRes.json();

    if (!checkData.authenticated) {
      logTest('No session created', 'pass');
      recordTest('Failed Logins - No Session', true);
    } else {
      logTest('Session should not exist', 'fail');
      recordTest('Failed Logins - No Session', false);
    }

    log('\n✅ Failed Login Tests: ALL TESTS PASSED', 'green');
    return true;

  } catch (error) {
    logTest('Failed Logins', 'fail', error.message);
    recordTest('Failed Logins - Exception', false, error);
    return false;
  }
}

/**
 * Test 4: Concurrent Users (Load Test)
 */
async function testConcurrentUsers(baseUrl, userCount) {
  logSection(`TEST 4: Concurrent Users (${userCount} users)`);

  try {
    log(`🚀 Launching ${userCount} concurrent login attempts...`, 'blue');

    const startTime = Date.now();
    const promises = [];

    for (let i = 0; i < userCount; i++) {
      const client = new AuthClient(baseUrl);

      const promise = (async () => {
        try {
          // Login
          const { response: loginRes, latency: loginLat } = await client.login(TEST_USER.email, TEST_USER.password);
          const loginData = await loginRes.json();

          if (!loginRes.ok || !loginData.success) {
            return { user: i, success: false, error: 'Login failed' };
          }

          // Check auth
          const { response: checkRes, latency: checkLat } = await client.check();
          const checkData = await checkRes.json();

          if (!checkData.authenticated) {
            return { user: i, success: false, error: 'Auth check failed' };
          }

          // Logout
          await client.logout();

          return {
            user: i,
            success: true,
            latencies: { login: loginLat, check: checkLat }
          };

        } catch (error) {
          return { user: i, success: false, error: error.message };
        }
      })();

      promises.push(promise);
    }

    const results = await Promise.all(promises);
    const totalTime = Date.now() - startTime;

    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;

    log(`\n📊 Results:`, 'cyan');
    log(`   Total users: ${userCount}`, 'gray');
    log(`   Successful: ${successful}`, successful === userCount ? 'green' : 'yellow');
    log(`   Failed: ${failed}`, failed === 0 ? 'gray' : 'red');
    log(`   Total time: ${totalTime}ms`, 'gray');
    log(`   Avg time per user: ${Math.round(totalTime / userCount)}ms`, 'gray');

    if (successful === userCount) {
      logTest(`${userCount} concurrent users`, 'pass', `${successful}/${userCount} successful`);
      recordTest(`Concurrent Users - ${userCount}`, true);
      return true;
    } else {
      logTest(`${userCount} concurrent users`, 'fail', `Only ${successful}/${userCount} successful`);
      recordTest(`Concurrent Users - ${userCount}`, false);
      return false;
    }

  } catch (error) {
    logTest('Concurrent Users', 'fail', error.message);
    recordTest(`Concurrent Users - ${userCount}`, false, error);
    return false;
  }
}

/**
 * Test 5: Rapid Successive Requests
 */
async function testRapidRequests(baseUrl) {
  logSection('TEST 5: Rapid Successive Requests');

  const client = new AuthClient(baseUrl);

  try {
    // Login first
    log('1️⃣  Logging in...', 'blue');
    const { response: loginRes } = await client.login(TEST_USER.email, TEST_USER.password);
    const loginData = await loginRes.json();

    if (!loginRes.ok || !loginData.success) {
      logTest('Login failed', 'fail');
      recordTest('Rapid Requests - Login', false);
      return false;
    }

    logTest('Login successful', 'pass');
    recordTest('Rapid Requests - Login', true);

    // Send 50 rapid requests
    log('2️⃣  Sending 50 rapid auth check requests...', 'blue');
    const startTime = Date.now();
    const promises = [];

    for (let i = 0; i < 50; i++) {
      promises.push(client.check());
    }

    const responses = await Promise.all(promises);
    const totalTime = Date.now() - startTime;

    let allSuccessful = true;
    for (const { response } of responses) {
      const data = await response.json();
      if (!data.authenticated) {
        allSuccessful = false;
        break;
      }
    }

    if (allSuccessful) {
      logTest('50 rapid requests', 'pass', `Completed in ${totalTime}ms (avg ${Math.round(totalTime / 50)}ms/req)`);
      recordTest('Rapid Requests - 50 Checks', true);
    } else {
      logTest('50 rapid requests', 'fail', 'Some requests failed');
      recordTest('Rapid Requests - 50 Checks', false);
      return false;
    }

    // Cleanup
    await client.logout();

    log('\n✅ Rapid Requests: ALL TESTS PASSED', 'green');
    return true;

  } catch (error) {
    logTest('Rapid Requests', 'fail', error.message);
    recordTest('Rapid Requests - Exception', false, error);
    return false;
  }
}

// ============================================================
// DEPLOYMENT CHECK
// ============================================================

async function waitForDeployment(baseUrl, targetCommit) {
  logSection('Waiting for Deployment');

  log(`🎯 Target commit: ${targetCommit}`, 'cyan');
  log(`🌐 URL: ${baseUrl}`, 'cyan');
  log('');

  let attempts = 0;
  const maxAttempts = 60; // 10 minutes max

  while (attempts < maxAttempts) {
    try {
      const response = await fetch(`${baseUrl}/api/info`);

      if (response.ok) {
        const data = await response.json();
        const currentCommit = data.git?.commitHash;

        if (currentCommit === targetCommit) {
          log(`✅ Deployment complete! Commit ${currentCommit} is live`, 'green');
          return true;
        } else {
          log(`⏳ Current: ${currentCommit || 'unknown'} | Waiting for: ${targetCommit}`, 'yellow');
        }
      } else {
        log(`⏳ Server not ready (HTTP ${response.status})`, 'yellow');
      }

    } catch (error) {
      log(`⏳ Server not reachable: ${error.message}`, 'yellow');
    }

    attempts++;
    await sleep(10000); // Wait 10 seconds
  }

  log('❌ Timeout waiting for deployment', 'red');
  return false;
}

// ============================================================
// MAIN TEST RUNNER
// ============================================================

async function runAllTests(baseUrl) {
  logSection('🧪 ROM Agent - Authentication Load Tests');

  log(`📅 Started: ${new Date().toLocaleString()}`, 'cyan');
  log(`🌐 Target: ${baseUrl}`, 'cyan');
  log('');

  const tests = [
    { name: 'Basic Login Flow', fn: () => testBasicLogin(baseUrl) },
    { name: 'Session Persistence', fn: () => testSessionPersistence(baseUrl) },
    { name: 'Failed Login Attempts', fn: () => testFailedLogins(baseUrl) },
    { name: 'Concurrent Users (5)', fn: () => testConcurrentUsers(baseUrl, 5) },
    { name: 'Concurrent Users (10)', fn: () => testConcurrentUsers(baseUrl, 10) },
    { name: 'Concurrent Users (20)', fn: () => testConcurrentUsers(baseUrl, 20) },
    { name: 'Rapid Successive Requests', fn: () => testRapidRequests(baseUrl) }
  ];

  for (const test of tests) {
    await test.fn();
    await sleep(1000); // 1 second between test suites
  }

  // ============================================================
  // FINAL REPORT
  // ============================================================

  logSection('📊 TEST SUMMARY');

  const passRate = ((results.passed / results.total) * 100).toFixed(1);

  log(`Total Tests: ${results.total}`, 'cyan');
  log(`Passed: ${results.passed}`, results.passed === results.total ? 'green' : 'yellow');
  log(`Failed: ${results.failed}`, results.failed === 0 ? 'gray' : 'red');
  log(`Pass Rate: ${passRate}%`, passRate === '100.0' ? 'green' : 'yellow');

  if (results.metrics.loginLatency.length > 0) {
    console.log();
    log('⚡ Performance Metrics:', 'cyan');

    const avgLogin = Math.round(
      results.metrics.loginLatency.reduce((a, b) => a + b, 0) / results.metrics.loginLatency.length
    );
    const avgCheck = Math.round(
      results.metrics.checkLatency.reduce((a, b) => a + b, 0) / results.metrics.checkLatency.length
    );
    const avgLogout = Math.round(
      results.metrics.logoutLatency.reduce((a, b) => a + b, 0) / results.metrics.logoutLatency.length
    );

    log(`   Login:  ${avgLogin}ms avg`, 'gray');
    log(`   Check:  ${avgCheck}ms avg`, 'gray');
    log(`   Logout: ${avgLogout}ms avg`, 'gray');
  }

  if (results.errors.length > 0) {
    console.log();
    log('❌ Errors:', 'red');
    results.errors.forEach((err, i) => {
      log(`   ${i + 1}. ${err.test}: ${err.error}`, 'red');
    });
  }

  console.log();
  log('━'.repeat(60), 'cyan');

  if (results.failed === 0) {
    log('✅ ALL TESTS PASSED!', 'green');
  } else {
    log(`⚠️  ${results.failed} TEST(S) FAILED`, 'red');
  }

  log('━'.repeat(60), 'cyan');
  console.log();

  return results.failed === 0;
}

// ============================================================
// ENTRY POINT
// ============================================================

async function main() {
  const args = process.argv.slice(2);
  let baseUrl = DEFAULT_URL;
  let waitForCommit = null;

  // Parse arguments
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--url' && args[i + 1]) {
      baseUrl = args[i + 1];
      i++;
    }
    if (args[i] === '--wait-for-commit' && args[i + 1]) {
      waitForCommit = args[i + 1];
      i++;
    }
  }

  // Wait for deployment if commit specified
  if (waitForCommit) {
    const deployed = await waitForDeployment(baseUrl, waitForCommit);
    if (!deployed) {
      log('❌ Deployment timeout - aborting tests', 'red');
      process.exit(1);
    }
    await sleep(5000); // Wait 5 more seconds for stabilization
  }

  // Run all tests
  const success = await runAllTests(baseUrl);

  process.exit(success ? 0 : 1);
}

// Run
main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
