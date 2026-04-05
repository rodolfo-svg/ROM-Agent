import { selectOptimalModel } from './src/utils/model-selector.js';

console.log('🧪 TESTE LOCAL DO MODEL SELECTOR');
console.log('==================================');
console.log('');

console.log('📝 Teste 1: Query simples "liste 1 2 3"');
console.log('Esperado: nova-micro');
const test1 = selectOptimalModel('liste 1 2 3', {});
console.log('✅ Resultado:', JSON.stringify(test1, null, 2));
console.log('');

console.log('📝 Teste 2: Query "extraia apenas o CPF"');
console.log('Esperado: nova-micro');
const test2 = selectOptimalModel('extraia apenas o CPF', {});
console.log('✅ Resultado:', JSON.stringify(test2, null, 2));
console.log('');

console.log('📝 Teste 3: Query com busca "busca jurisprudencia"');
console.log('Esperado: haiku (precisa tool use)');
const test3 = selectOptimalModel('busca jurisprudencia STF', { kbContext: 'contexto' });
console.log('✅ Resultado:', JSON.stringify(test3, null, 2));
console.log('');

console.log('📝 Teste 4: Query complexa "redija uma petição"');
console.log('Esperado: opus');
const test4 = selectOptimalModel('redija uma petição trabalhista', {});
console.log('✅ Resultado:', JSON.stringify(test4, null, 2));
console.log('');

console.log('📝 Teste 5: Default (sem keyword match)');
console.log('Esperado: sonnet');
const test5 = selectOptimalModel('qual é sua opinião sobre isso', {});
console.log('✅ Resultado:', JSON.stringify(test5, null, 2));

