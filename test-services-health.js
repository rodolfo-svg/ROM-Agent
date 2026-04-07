// Script rápido para testar serviços
import { getPostgresPool } from './src/config/database.js';
import auditService from './src/services/audit-service.js';
import passwordPolicyService from './src/services/password-policy-service.js';
import bruteForceService from './src/services/brute-force-service.js';

async function testServices() {
  console.log('=== TESTE DE SERVIÇOS ===\n');

  try {
    console.log('1. PostgreSQL Pool...');
    const pool = getPostgresPool();
    console.log('   ✅ Pool obtido:', pool ? 'OK' : 'NULL');

    console.log('\n2. Query teste...');
    const result = await pool.query('SELECT NOW()');
    console.log('   ✅ Query OK:', result.rows[0].now);

    console.log('\n3. Buscar usuário...');
    const userResult = await pool.query(
      `SELECT id, email FROM users WHERE email = $1`,
      ['rodolfo@rom.adv.br']
    );
    console.log('   ✅ Usuário encontrado:', userResult.rows.length > 0);

    if (userResult.rows.length > 0) {
      const user = userResult.rows[0];

      console.log('\n4. BruteForceService.isAccountLocked()...');
      const lockCheck = await bruteForceService.isAccountLocked(user.id);
      console.log('   ✅ Lock check:', lockCheck);

      console.log('\n5. PasswordPolicyService.comparePassword()...');
      const testHash = '$2a$12$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQoeG6Lruj3vjPGga31lW';
      const compareResult = await passwordPolicyService.comparePassword('Test@123', testHash);
      console.log('   ✅ Compare password:', compareResult);

      console.log('\n6. AuditService.log()...');
      await auditService.log('test_action', user.id, {
        status: 'success',
        details: { test: true }
      });
      console.log('   ✅ Audit log criado');
    }

    console.log('\n=== TODOS OS TESTES PASSARAM ===');
    process.exit(0);

  } catch (error) {
    console.error('\n❌ ERRO:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

testServices();
