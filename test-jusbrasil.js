import jusbrasilAuth from './src/modules/jusbrasilAuth.js';

async function main() {
  console.log('=== SESSÃO COMPLETA JUSBRASIL ===\n');
  console.log('Este teste vai:');
  console.log('1. Abrir navegador VISÍVEL');
  console.log('2. Fazer login (resolva CAPTCHA se aparecer)');
  console.log('3. Pesquisar jurisprudência');
  console.log('4. Extrair resultados\n');

  // Usar sessaoCompleta que mantém o navegador aberto
  const resultado = await jusbrasilAuth.sessaoCompleta(
    'rodolfo@rom.adv.br',
    'Fortioli23.',
    'prisão preventiva fundamentação',
    { limite: 10 }
  );

  console.log('\n=== RESULTADO ===');
  console.log('- Sucesso:', resultado.sucesso);
  console.log('- Total:', resultado.totalEncontrados);

  if (resultado.resultados && resultado.resultados.length > 0) {
    console.log('\nDecisões encontradas:');
    resultado.resultados.forEach((r, i) => {
      console.log(`\n[${i+1}] ${r.tribunal || 'N/A'}`);
      console.log(`    Título: ${r.titulo ? r.titulo.substring(0, 80) : 'Sem título'}...`);
      if (r.link) console.log(`    Link: ${r.link}`);
    });
  }

  console.log('\n=== MANTENDO NAVEGADOR ABERTO ===');
  console.log('Você pode fazer mais pesquisas manualmente.');
  console.log('Pressione Ctrl+C para encerrar.\n');

  // Manter o processo rodando
  await new Promise(() => {}); // Mantém aberto indefinidamente
}

main().catch(console.error);
