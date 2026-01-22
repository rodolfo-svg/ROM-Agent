/**
 * Teste simples de exportação DOCX
 *
 * Uso: node test-export-docx.js
 */

import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';

const API_URL = 'http://localhost:3001/api/export/docx';

const testContent = `# PETIÇÃO INICIAL

## EXCELENTÍSSIMO SENHOR DOUTOR JUIZ DE DIREITO DA VARA CÍVEL DA COMARCA DE BELO HORIZONTE/MG

**REQUERENTE**: João da Silva, brasileiro, solteiro, advogado, inscrito na OAB/MG sob nº 123.456, com endereço na Rua Exemplo, nº 100, Bairro Centro, CEP 30.000-000, Belo Horizonte/MG.

**REQUERIDO**: Maria de Souza, brasileira, casada, empresária, com endereço na Avenida Principal, nº 200, Bairro Centro, CEP 30.000-100, Belo Horizonte/MG.

## DOS FATOS

O Requerente vem, por meio desta, apresentar os seguintes fatos:

1. Em 15 de janeiro de 2024, as partes celebraram contrato de prestação de serviços;
2. O Requerido deixou de cumprir com suas obrigações contratuais;
3. Tentativas de solução amigável foram infrutíferas.

## DO DIREITO

Aplica-se ao caso o disposto nos seguintes dispositivos legais:
- Código Civil Brasileiro, Art. 389 e seguintes
- Código de Processo Civil, Art. 319 e seguintes

## DOS PEDIDOS

Diante do exposto, requer:

a) A citação do Requerido para contestar a presente ação;
b) A procedência do pedido;
c) A condenação do Requerido ao pagamento de R$ 50.000,00;
d) A condenação do Requerido ao pagamento de custas e honorários advocatícios.

Nestes termos,
Pede deferimento.

Belo Horizonte, 22 de janeiro de 2026.

____________________________
Advogado OAB/MG 123.456
`;

async function testExport() {
  console.log('🧪 Testando exportação DOCX...\n');

  try {
    const requestBody = {
      content: testContent,
      title: 'Petição Inicial - Teste',
      type: 'legal_brief',
      metadata: {
        author: 'Teste ROM Agent',
        subject: 'Ação de Cobrança',
        keywords: ['cobrança', 'contrato', 'prestação de serviços']
      },
      template: 'oab'
    };

    console.log('📤 Enviando requisição para:', API_URL);
    console.log('📄 Conteúdo:', testContent.substring(0, 100) + '...\n');

    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });

    console.log('📡 Status:', response.status, response.statusText);

    if (!response.ok) {
      const errorData = await response.json();
      console.error('❌ Erro:', errorData);
      process.exit(1);
    }

    // Salvar arquivo
    const buffer = await response.arrayBuffer();
    const outputPath = path.join(process.cwd(), 'test-output.docx');
    fs.writeFileSync(outputPath, Buffer.from(buffer));

    console.log(`✅ DOCX gerado com sucesso!`);
    console.log(`📁 Arquivo salvo em: ${outputPath}`);
    console.log(`📊 Tamanho: ${(buffer.byteLength / 1024).toFixed(2)} KB`);

  } catch (error) {
    console.error('❌ Erro ao testar exportação:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Executar teste
testExport();
