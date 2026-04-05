/**
 * 🗑️ SCRIPT PARA DELETAR DOCUMENTOS MESCLADOS
 *
 * Execute este script no console do navegador em iarom.com.br
 * para deletar os documentos mesclados do processo Naenge
 */

(async function() {
  console.log('🗑️ INICIANDO DELEÇÃO DE DOCUMENTOS MESCLADOS');
  console.log('=============================================\n');

  try {
    // 1. Buscar lista de documentos
    console.log('📋 Buscando lista de documentos...');
    const response = await fetch('/api/kb/documents');

    if (!response.ok) {
      console.error('❌ Erro ao buscar documentos:', response.status, response.statusText);
      return;
    }

    const documents = await response.json();
    console.log(`✓ ${documents.length} documentos encontrados\n`);

    // 2. Filtrar documentos mesclados ou do Naenge
    const keywords = ['mescla', 'mesclado', 'merged', 'naenge', 'PARTE_1', 'PARTE_2', 'PARTE_3', 'PARTE_4'];
    const toDelete = documents.filter(doc => {
      const titleLower = doc.title.toLowerCase();
      return keywords.some(keyword => titleLower.includes(keyword.toLowerCase()));
    });

    if (toDelete.length === 0) {
      console.log('✓ Nenhum documento mesclado encontrado');
      return;
    }

    console.log(`🎯 Encontrados ${toDelete.length} documentos para deletar:\n`);
    toDelete.forEach((doc, i) => {
      console.log(`  ${i + 1}. ${doc.title} (${(doc.size / 1024 / 1024).toFixed(2)} MB) - ID: ${doc.id}`);
    });

    // 3. Confirmar antes de deletar
    console.log('\n⚠️ ATENÇÃO: Esta ação NÃO pode ser desfeita!');

    // Função para deletar com confirmação
    window.deleteMergedDocs = async function() {
      console.log('\n🗑️ Deletando documentos...\n');

      let deleted = 0;
      let failed = 0;

      for (const doc of toDelete) {
        try {
          console.log(`🗑️ Deletando: ${doc.title}...`);

          const deleteResponse = await fetch(`/api/kb/documents/${doc.id}`, {
            method: 'DELETE'
          });

          if (deleteResponse.ok) {
            console.log(`  ✅ Deletado com sucesso`);
            deleted++;
          } else {
            console.error(`  ❌ Erro ao deletar: ${deleteResponse.status} ${deleteResponse.statusText}`);
            failed++;
          }
        } catch (error) {
          console.error(`  ❌ Erro ao deletar ${doc.title}:`, error.message);
          failed++;
        }

        // Aguardar um pouco entre cada deleção
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      console.log('\n📊 RESULTADO:');
      console.log(`  ✅ Deletados: ${deleted}`);
      console.log(`  ❌ Falhas: ${failed}`);
      console.log(`  📋 Total: ${toDelete.length}`);
    };

    // Função para deletar um documento específico por índice
    window.deleteDocByIndex = async function(index) {
      if (index < 1 || index > toDelete.length) {
        console.error(`❌ Índice inválido. Use um número entre 1 e ${toDelete.length}`);
        return;
      }

      const doc = toDelete[index - 1];
      console.log(`🗑️ Deletando: ${doc.title}...`);

      try {
        const deleteResponse = await fetch(`/api/kb/documents/${doc.id}`, {
          method: 'DELETE'
        });

        if (deleteResponse.ok) {
          console.log(`✅ ${doc.title} deletado com sucesso`);
        } else {
          console.error(`❌ Erro ao deletar: ${deleteResponse.status} ${deleteResponse.statusText}`);
        }
      } catch (error) {
        console.error(`❌ Erro:`, error.message);
      }
    };

    console.log('\n📋 FUNÇÕES DISPONÍVEIS:');
    console.log('  - deleteMergedDocs() - Deleta TODOS os documentos listados acima');
    console.log('  - deleteDocByIndex(N) - Deleta apenas o documento número N da lista');
    console.log('\nExemplo: deleteDocByIndex(1) - deleta o primeiro documento');
    console.log('Exemplo: deleteMergedDocs() - deleta todos\n');

  } catch (error) {
    console.error('❌ Erro:', error.message);
  }
})();
