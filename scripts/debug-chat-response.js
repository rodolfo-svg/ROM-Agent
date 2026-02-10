#!/usr/bin/env node
/**
 * Debug script to check chat API response structure
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
    sessionCookie = loginRes.headers.get('set-cookie').split(';')[0];
  }

  console.log('Login:', loginRes.ok ? 'OK' : 'FAILED');

  if (!loginRes.ok) {
    console.log('Login failed, aborting');
    return;
  }

  // 3. Test chat
  const chatRes = await fetch(`${BASE_URL}/api/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': sessionCookie,
      'X-CSRF-Token': csrfToken
    },
    body: JSON.stringify({
      message: 'Qual é o CPF: 123.456.789-00?',
      maxTokens: 50
    })
  });

  const chatData = await chatRes.json();
  console.log('\n=== Chat Response Structure ===');
  console.log('Status:', chatRes.status);
  console.log('Response Keys:', Object.keys(chatData));
  console.log('\nmodelUsed field:', chatData.modelUsed);
  console.log('\nFull response:');
  console.log(JSON.stringify(chatData, null, 2));
}

test().catch(console.error);
