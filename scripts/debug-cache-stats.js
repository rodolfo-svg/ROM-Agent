#!/usr/bin/env node
/**
 * Debug script to check cache stats endpoint
 */

import fetch from 'node-fetch';

const BASE_URL = 'https://iarom.com.br';
let sessionCookie = '';
let csrfToken = '';

async function test() {
  // 1. Get CSRF
  const csrfRes = await fetch(`${BASE_URL}/api/auth/csrf-token`);
  const csrfData = await csrfRes.json();
  csrfToken = csrfData.csrfToken;
  if (csrfRes.headers.get('set-cookie')) {
    sessionCookie = csrfRes.headers.get('set-cookie').split(';')[0];
  }

  console.log('CSRF Token obtained:', csrfToken ? 'YES' : 'NO');
  console.log('Session Cookie:', sessionCookie ? 'YES' : 'NO');

  // 2. Login
  const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': sessionCookie,
      'X-CSRF-Token': csrfToken
    },
    body: JSON.stringify({
      email: 'rodolfo@rom.adv.br',
      password: 'Mota@2323'
    })
  });

  if (loginRes.headers.get('set-cookie')) {
    const newCookie = loginRes.headers.get('set-cookie').split(';')[0];
    console.log('New session cookie from login:', newCookie);
    sessionCookie = newCookie;
  }

  console.log('\nLogin Status:', loginRes.status, loginRes.ok ? 'OK' : 'FAILED');

  if (!loginRes.ok) {
    const loginData = await loginRes.json();
    console.log('Login error:', loginData);
    return;
  }

  const loginData = await loginRes.json();
  console.log('Logged in as:', loginData.user);

  // 3. Test cache stats endpoint
  console.log('\n=== Testing /api/cache/stats ===');
  console.log('Using cookie:', sessionCookie);

  const cacheRes = await fetch(`${BASE_URL}/api/cache/stats`, {
    headers: {
      'Cookie': sessionCookie,
      'Content-Type': 'application/json'
    }
  });

  console.log('Status:', cacheRes.status);
  console.log('Status Text:', cacheRes.statusText);

  const cacheData = await cacheRes.text();
  console.log('\nResponse:');
  console.log(cacheData);

  try {
    const json = JSON.parse(cacheData);
    console.log('\nParsed JSON:');
    console.log(JSON.stringify(json, null, 2));
  } catch (e) {
    console.log('Not JSON response');
  }
}

test().catch(console.error);
