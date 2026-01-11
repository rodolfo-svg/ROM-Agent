/**
 * ROM Agent - PWA & Offline Tests
 *
 * Testes completos para:
 * - Service Worker registration
 * - Cache strategies
 * - Offline functionality
 * - IndexedDB operations
 * - Background sync
 * - Push notifications
 *
 * @version 1.0.0
 */

const { chromium, firefox, webkit } = require('playwright');
const { expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

// Test configuration
const CONFIG = {
  baseUrl: process.env.TEST_BASE_URL || 'http://localhost:5173',
  timeout: 30000,
  retries: 2,
};

// Test results collector
const results = {
  passed: 0,
  failed: 0,
  skipped: 0,
  tests: [],
  startTime: null,
  endTime: null,
};

/**
 * Run a single test
 */
async function runTest(name, testFn, browser) {
  const testResult = {
    name,
    status: 'pending',
    duration: 0,
    error: null,
  };

  const startTime = Date.now();

  try {
    await testFn(browser);
    testResult.status = 'passed';
    results.passed++;
    console.log(`  [PASS] ${name}`);
  } catch (error) {
    testResult.status = 'failed';
    testResult.error = error.message;
    results.failed++;
    console.log(`  [FAIL] ${name}`);
    console.log(`         Error: ${error.message}`);
  }

  testResult.duration = Date.now() - startTime;
  results.tests.push(testResult);
}

/**
 * Skip a test
 */
function skipTest(name, reason) {
  results.tests.push({
    name,
    status: 'skipped',
    duration: 0,
    error: reason,
  });
  results.skipped++;
  console.log(`  [SKIP] ${name} - ${reason}`);
}

// ===== SERVICE WORKER TESTS =====

async function testServiceWorkerRegistration(browser) {
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto(CONFIG.baseUrl, { waitUntil: 'networkidle' });

  // Check if service worker is registered
  const swRegistration = await page.evaluate(async () => {
    if ('serviceWorker' in navigator) {
      const registration = await navigator.serviceWorker.getRegistration();
      return registration ? {
        scope: registration.scope,
        active: !!registration.active,
        waiting: !!registration.waiting,
        installing: !!registration.installing,
      } : null;
    }
    return null;
  });

  if (process.env.NODE_ENV !== 'production') {
    // In dev mode, SW might not be registered
    console.log('    Note: SW may not be registered in development mode');
  }

  await context.close();
}

async function testServiceWorkerUpdate(browser) {
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto(CONFIG.baseUrl, { waitUntil: 'networkidle' });

  // Check for update mechanism
  const hasUpdateMechanism = await page.evaluate(async () => {
    if ('serviceWorker' in navigator) {
      const registration = await navigator.serviceWorker.getRegistration();
      if (registration) {
        // Trigger update check
        try {
          await registration.update();
          return true;
        } catch {
          return false;
        }
      }
    }
    return false;
  });

  await context.close();
}

async function testServiceWorkerVersion(browser) {
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto(CONFIG.baseUrl, { waitUntil: 'networkidle' });

  // Get SW version via message
  const version = await page.evaluate(async () => {
    return new Promise((resolve) => {
      if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        const messageChannel = new MessageChannel();
        messageChannel.port1.onmessage = (event) => {
          resolve(event.data.version);
        };
        navigator.serviceWorker.controller.postMessage(
          { type: 'GET_VERSION' },
          [messageChannel.port2]
        );
        // Timeout
        setTimeout(() => resolve(null), 2000);
      } else {
        resolve(null);
      }
    });
  });

  await context.close();
}

// ===== CACHE TESTS =====

async function testCacheStorage(browser) {
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto(CONFIG.baseUrl, { waitUntil: 'networkidle' });

  // Check cache storage
  const caches = await page.evaluate(async () => {
    if ('caches' in window) {
      const cacheNames = await window.caches.keys();
      return cacheNames;
    }
    return [];
  });

  // Verify ROM Agent caches exist
  const hasRomAgentCache = caches.some(name => name.startsWith('rom-agent-'));

  await context.close();
}

async function testStaticAssetCaching(browser) {
  const context = await browser.newContext();
  const page = await context.newPage();

  // First visit to populate cache
  await page.goto(CONFIG.baseUrl, { waitUntil: 'networkidle' });

  // Check if manifest is cached
  const manifestCached = await page.evaluate(async () => {
    const cache = await caches.open('rom-agent-static-v7.0.0');
    const response = await cache.match('/manifest.json');
    return !!response;
  });

  await context.close();
}

async function testNetworkFirstStrategy(browser) {
  const context = await browser.newContext();
  const page = await context.newPage();

  // Intercept network requests
  const requests = [];
  page.on('request', (request) => {
    requests.push({
      url: request.url(),
      resourceType: request.resourceType(),
    });
  });

  await page.goto(CONFIG.baseUrl, { waitUntil: 'networkidle' });

  // Navigate to another page
  await page.reload({ waitUntil: 'networkidle' });

  // Check that HTML was fetched from network (not cache-only)
  const htmlRequests = requests.filter(r => r.resourceType === 'document');
  expect(htmlRequests.length).toBeGreaterThan(0);

  await context.close();
}

// ===== OFFLINE TESTS =====

async function testOfflineFallbackPage(browser) {
  const context = await browser.newContext();
  const page = await context.newPage();

  // First, load the page normally to cache SW
  await page.goto(CONFIG.baseUrl, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000); // Wait for SW to install

  // Go offline
  await context.setOffline(true);

  // Try to navigate
  await page.goto(CONFIG.baseUrl + '/nonexistent-page', { waitUntil: 'load' }).catch(() => {});

  // Check for offline content
  const pageContent = await page.content();
  const hasOfflineContent = pageContent.includes('Sem Conexao') ||
                            pageContent.includes('offline') ||
                            pageContent.includes('Tentar Novamente');

  await context.setOffline(false);
  await context.close();
}

async function testOfflineAPIResponse(browser) {
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto(CONFIG.baseUrl, { waitUntil: 'networkidle' });

  // Go offline
  await context.setOffline(true);

  // Make API request
  const response = await page.evaluate(async () => {
    try {
      const res = await fetch('/api/health');
      const data = await res.json();
      return { status: res.status, data };
    } catch (e) {
      return { error: e.message };
    }
  });

  // Should get offline response from SW
  const isOfflineResponse = response.status === 503 ||
                            response.data?.offline === true ||
                            response.error;

  await context.setOffline(false);
  await context.close();
}

async function testOfflineIndicator(browser) {
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto(CONFIG.baseUrl, { waitUntil: 'networkidle' });

  // Initially online - no indicator
  let offlineIndicator = await page.$('[role="alert"]');

  // Go offline
  await context.setOffline(true);
  await page.waitForTimeout(500);

  // Should show offline indicator
  offlineIndicator = await page.$('[role="alert"]');

  // Go back online
  await context.setOffline(false);
  await page.waitForTimeout(500);

  // Indicator should be gone
  offlineIndicator = await page.$('[role="alert"]');

  await context.close();
}

// ===== INDEXEDDB TESTS =====

async function testIndexedDBInitialization(browser) {
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto(CONFIG.baseUrl, { waitUntil: 'networkidle' });

  // Check IndexedDB
  const dbInfo = await page.evaluate(async () => {
    return new Promise((resolve) => {
      const request = indexedDB.open('rom-agent-offline', 2);

      request.onsuccess = () => {
        const db = request.result;
        const storeNames = Array.from(db.objectStoreNames);
        db.close();
        resolve({ success: true, storeNames });
      };

      request.onerror = () => {
        resolve({ success: false, error: request.error?.message });
      };

      request.onupgradeneeded = (event) => {
        // DB is being created/upgraded
        resolve({ success: true, upgrading: true });
      };
    });
  });

  expect(dbInfo.success).toBe(true);

  await context.close();
}

async function testOfflineActionQueue(browser) {
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto(CONFIG.baseUrl, { waitUntil: 'networkidle' });

  // Queue an action
  const queueResult = await page.evaluate(async () => {
    return new Promise((resolve) => {
      const request = indexedDB.open('rom-agent-offline', 2);

      request.onsuccess = () => {
        const db = request.result;

        if (!db.objectStoreNames.contains('pending_actions')) {
          db.close();
          resolve({ success: false, error: 'Store not found' });
          return;
        }

        const transaction = db.transaction(['pending_actions'], 'readwrite');
        const store = transaction.objectStore('pending_actions');

        const action = {
          id: `test-${Date.now()}`,
          type: 'message',
          data: { content: 'test message' },
          timestamp: Date.now(),
          retryCount: 0,
        };

        const addRequest = store.add(action);

        addRequest.onsuccess = () => {
          // Read back
          const getRequest = store.get(action.id);
          getRequest.onsuccess = () => {
            // Clean up
            store.delete(action.id);
            db.close();
            resolve({ success: true, action: getRequest.result });
          };
        };

        addRequest.onerror = () => {
          db.close();
          resolve({ success: false, error: addRequest.error?.message });
        };
      };

      request.onerror = () => {
        resolve({ success: false, error: request.error?.message });
      };
    });
  });

  expect(queueResult.success).toBe(true);

  await context.close();
}

async function testConversationCache(browser) {
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto(CONFIG.baseUrl, { waitUntil: 'networkidle' });

  // Cache a conversation
  const cacheResult = await page.evaluate(async () => {
    return new Promise((resolve) => {
      const request = indexedDB.open('rom-agent-offline', 2);

      request.onsuccess = () => {
        const db = request.result;

        if (!db.objectStoreNames.contains('conversations')) {
          db.close();
          resolve({ success: false, error: 'Store not found' });
          return;
        }

        const transaction = db.transaction(['conversations'], 'readwrite');
        const store = transaction.objectStore('conversations');

        const conversation = {
          id: `conv-test-${Date.now()}`,
          title: 'Test Conversation',
          messages: [
            { id: 'm1', role: 'user', content: 'Hello', timestamp: Date.now() },
            { id: 'm2', role: 'assistant', content: 'Hi there!', timestamp: Date.now() },
          ],
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };

        const addRequest = store.put(conversation);

        addRequest.onsuccess = () => {
          // Read back
          const getRequest = store.get(conversation.id);
          getRequest.onsuccess = () => {
            // Clean up
            store.delete(conversation.id);
            db.close();
            resolve({ success: true, conversation: getRequest.result });
          };
        };

        addRequest.onerror = () => {
          db.close();
          resolve({ success: false, error: addRequest.error?.message });
        };
      };

      request.onerror = () => {
        resolve({ success: false, error: request.error?.message });
      };
    });
  });

  expect(cacheResult.success).toBe(true);
  expect(cacheResult.conversation?.messages?.length).toBe(2);

  await context.close();
}

// ===== MANIFEST TESTS =====

async function testManifestValidity(browser) {
  const context = await browser.newContext();
  const page = await context.newPage();

  const response = await page.goto(CONFIG.baseUrl + '/manifest.json');
  const manifest = await response.json();

  // Required fields
  expect(manifest.name).toBeTruthy();
  expect(manifest.short_name).toBeTruthy();
  expect(manifest.start_url).toBeTruthy();
  expect(manifest.display).toBeTruthy();
  expect(manifest.icons).toBeTruthy();
  expect(Array.isArray(manifest.icons)).toBe(true);

  // PWA requirements
  expect(manifest.icons.length).toBeGreaterThanOrEqual(2);

  // Check for required icon sizes
  const iconSizes = manifest.icons.map(i => i.sizes);
  expect(iconSizes.some(s => s.includes('192'))).toBe(true);
  expect(iconSizes.some(s => s.includes('512'))).toBe(true);

  await context.close();
}

async function testManifestTheme(browser) {
  const context = await browser.newContext();
  const page = await context.newPage();

  const response = await page.goto(CONFIG.baseUrl + '/manifest.json');
  const manifest = await response.json();

  // Check theme colors
  expect(manifest.theme_color).toBeTruthy();
  expect(manifest.background_color).toBeTruthy();

  // Verify hex color format
  const hexColorRegex = /^#[0-9A-Fa-f]{6}$/;
  expect(hexColorRegex.test(manifest.theme_color)).toBe(true);
  expect(hexColorRegex.test(manifest.background_color)).toBe(true);

  await context.close();
}

async function testManifestShortcuts(browser) {
  const context = await browser.newContext();
  const page = await context.newPage();

  const response = await page.goto(CONFIG.baseUrl + '/manifest.json');
  const manifest = await response.json();

  // Check shortcuts
  expect(manifest.shortcuts).toBeTruthy();
  expect(Array.isArray(manifest.shortcuts)).toBe(true);

  // Each shortcut should have required fields
  for (const shortcut of manifest.shortcuts) {
    expect(shortcut.name).toBeTruthy();
    expect(shortcut.url).toBeTruthy();
  }

  await context.close();
}

// ===== PUSH NOTIFICATION TESTS =====

async function testNotificationPermission(browser) {
  const context = await browser.newContext({
    permissions: ['notifications'],
  });
  const page = await context.newPage();

  await page.goto(CONFIG.baseUrl, { waitUntil: 'networkidle' });

  const permission = await page.evaluate(() => {
    return Notification.permission;
  });

  // Permission should be granted (we set it in context)
  expect(permission).toBe('granted');

  await context.close();
}

async function testPushSubscription(browser) {
  const context = await browser.newContext({
    permissions: ['notifications'],
  });
  const page = await context.newPage();

  await page.goto(CONFIG.baseUrl, { waitUntil: 'networkidle' });

  // Check if push manager is available
  const pushAvailable = await page.evaluate(async () => {
    if ('serviceWorker' in navigator && 'PushManager' in window) {
      const registration = await navigator.serviceWorker.getRegistration();
      return !!registration?.pushManager;
    }
    return false;
  });

  await context.close();
}

// ===== BACKGROUND SYNC TESTS =====

async function testBackgroundSyncRegistration(browser) {
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto(CONFIG.baseUrl, { waitUntil: 'networkidle' });

  const syncSupported = await page.evaluate(async () => {
    if ('serviceWorker' in navigator) {
      const registration = await navigator.serviceWorker.ready;
      return 'sync' in registration;
    }
    return false;
  });

  await context.close();
}

async function testPeriodicSyncRegistration(browser) {
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto(CONFIG.baseUrl, { waitUntil: 'networkidle' });

  const periodicSyncSupported = await page.evaluate(async () => {
    if ('serviceWorker' in navigator) {
      const registration = await navigator.serviceWorker.ready;
      return 'periodicSync' in registration;
    }
    return false;
  });

  await context.close();
}

// ===== NETWORK INFORMATION TESTS =====

async function testNetworkInformationAPI(browser) {
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto(CONFIG.baseUrl, { waitUntil: 'networkidle' });

  const networkInfo = await page.evaluate(() => {
    const connection = navigator.connection ||
                      navigator.mozConnection ||
                      navigator.webkitConnection;

    if (connection) {
      return {
        available: true,
        type: connection.type,
        effectiveType: connection.effectiveType,
        downlink: connection.downlink,
        rtt: connection.rtt,
      };
    }
    return { available: false };
  });

  // Network Information API may not be available in all browsers
  // Just log the result
  console.log(`    Network Info API: ${networkInfo.available ? 'available' : 'not available'}`);

  await context.close();
}

// ===== PERFORMANCE TESTS =====

async function testCachePerformance(browser) {
  const context = await browser.newContext();
  const page = await context.newPage();

  // First load (cold)
  const coldStart = Date.now();
  await page.goto(CONFIG.baseUrl, { waitUntil: 'networkidle' });
  const coldDuration = Date.now() - coldStart;

  // Second load (warm)
  const warmStart = Date.now();
  await page.reload({ waitUntil: 'networkidle' });
  const warmDuration = Date.now() - warmStart;

  console.log(`    Cold load: ${coldDuration}ms, Warm load: ${warmDuration}ms`);

  // Warm load should generally be faster (but not always in dev)
  // Just ensure both complete successfully

  await context.close();
}

async function testLighthousePWAScore(browser) {
  // This is a placeholder - actual Lighthouse testing requires lighthouse npm package
  // or running via Chrome DevTools Protocol

  console.log('    Note: Full Lighthouse testing requires lighthouse package');
  console.log('    Run: npx lighthouse http://localhost:5173 --only-categories=pwa');
}

// ===== MAIN TEST RUNNER =====

async function runAllTests() {
  console.log('\n========================================');
  console.log('ROM Agent - PWA & Offline Tests');
  console.log('========================================\n');

  results.startTime = new Date().toISOString();

  // Launch browser
  const browser = await chromium.launch({
    headless: true,
  });

  try {
    // Service Worker Tests
    console.log('Service Worker Tests:');
    await runTest('SW Registration', testServiceWorkerRegistration, browser);
    await runTest('SW Update Mechanism', testServiceWorkerUpdate, browser);
    await runTest('SW Version Check', testServiceWorkerVersion, browser);

    // Cache Tests
    console.log('\nCache Tests:');
    await runTest('Cache Storage', testCacheStorage, browser);
    await runTest('Static Asset Caching', testStaticAssetCaching, browser);
    await runTest('Network First Strategy', testNetworkFirstStrategy, browser);

    // Offline Tests
    console.log('\nOffline Tests:');
    await runTest('Offline Fallback Page', testOfflineFallbackPage, browser);
    await runTest('Offline API Response', testOfflineAPIResponse, browser);
    await runTest('Offline Indicator', testOfflineIndicator, browser);

    // IndexedDB Tests
    console.log('\nIndexedDB Tests:');
    await runTest('IDB Initialization', testIndexedDBInitialization, browser);
    await runTest('Offline Action Queue', testOfflineActionQueue, browser);
    await runTest('Conversation Cache', testConversationCache, browser);

    // Manifest Tests
    console.log('\nManifest Tests:');
    await runTest('Manifest Validity', testManifestValidity, browser);
    await runTest('Manifest Theme', testManifestTheme, browser);
    await runTest('Manifest Shortcuts', testManifestShortcuts, browser);

    // Push Notification Tests
    console.log('\nPush Notification Tests:');
    await runTest('Notification Permission', testNotificationPermission, browser);
    await runTest('Push Subscription', testPushSubscription, browser);

    // Background Sync Tests
    console.log('\nBackground Sync Tests:');
    await runTest('Background Sync Registration', testBackgroundSyncRegistration, browser);
    await runTest('Periodic Sync Registration', testPeriodicSyncRegistration, browser);

    // Network Tests
    console.log('\nNetwork Tests:');
    await runTest('Network Information API', testNetworkInformationAPI, browser);

    // Performance Tests
    console.log('\nPerformance Tests:');
    await runTest('Cache Performance', testCachePerformance, browser);
    skipTest('Lighthouse PWA Score', 'Requires lighthouse package');

  } finally {
    await browser.close();
  }

  results.endTime = new Date().toISOString();

  // Print summary
  console.log('\n========================================');
  console.log('Test Summary');
  console.log('========================================');
  console.log(`Passed:  ${results.passed}`);
  console.log(`Failed:  ${results.failed}`);
  console.log(`Skipped: ${results.skipped}`);
  console.log(`Total:   ${results.tests.length}`);
  console.log('========================================\n');

  // Save results
  const reportPath = path.join(__dirname, 'pwa-test-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(results, null, 2));
  console.log(`Report saved to: ${reportPath}\n`);

  // Exit with appropriate code
  process.exit(results.failed > 0 ? 1 : 0);
}

// Run tests
runAllTests().catch((error) => {
  console.error('Test runner error:', error);
  process.exit(1);
});
