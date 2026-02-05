/**
 * Script que cria endpoint temporário de diagnóstico do Puppeteer
 * Testa se Chrome/Chromium está instalado no servidor
 */

import axios from 'axios';

const PROD_URL = 'https://iarom.com.br';

console.log('🔧 TESTE DE DIAGNÓSTICO - Puppeteer via Endpoint\n');

async function testViaEndpoint() {
  try {
    // Login
    console.log('🔐 Fazendo login...');
    const csrf = await axios.get(`${PROD_URL}/api/auth/csrf-token`);
    const csrfToken = csrf.data.csrfToken;
    const cookies = csrf.headers['set-cookie']?.join('; ') || '';

    const login = await axios.post(`${PROD_URL}/api/auth/login`, {
      email: 'rodolfo@rom.adv.br',
      password: 'Mota@2323'
    }, {
      headers: { 'Cookie': cookies, 'X-CSRF-Token': csrfToken }
    });

    const sessionCookies = login.headers['set-cookie']?.join('; ') || cookies;
    console.log('✅ Login OK\n');

    // Testar se conseguimos fazer uma requisição especial que force diagnóstico
    console.log('🧪 Fazendo requisição de diagnóstico...\n');

    const diagnostic = await axios.post(`${PROD_URL}/api/chat`, {
      message: 'DIAGNÓSTICO: Verifique se o Puppeteer está instalado executando: const puppeteer = require("puppeteer"); console.log("Puppeteer version:", puppeteer.executablePath());',
      model: 'amazon.nova-pro-v1:0'
    }, {
      headers: {
        'Cookie': sessionCookies,
        'X-CSRF-Token': csrfToken,
        'Accept': 'text/event-stream'
      },
      responseType: 'stream',
      timeout: 30000
    });

    let response = '';
    await new Promise((resolve) => {
      diagnostic.data.on('data', (chunk) => {
        response += chunk.toString();
        process.stdout.write('.');
      });
      diagnostic.data.on('end', resolve);
    });

    console.log('\n\n📄 Resposta:');
    console.log(response.substring(0, 1000));

  } catch (error) {
    console.error('\n❌ Erro:', error.message);
  }
}

testViaEndpoint();
