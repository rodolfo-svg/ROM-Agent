import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// ES module equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ler arquivo atual
const filePath = path.join(__dirname, 'data', 'custom-instructions', 'rom', 'custom-instructions.json');
const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

// ═══════════════════════════════════════════════════════
// CORREÇÃO P1-1: REMOVER CHECKLIST DUPLICADO DO COMPONENTE 2
// ═══════════════════════════════════════════════════════

console.log('\n🔧 P1-1: Removendo checklist duplicado do Componente 2...');

// No Componente 2 (Formatação), remover o checklist detalhado e substituir por referência
const checklistRemoval = {
  html: `
<h2>CHECKLIST DE FORMATAÇÃO</h2>

<p><strong>Importante:</strong> O checklist completo de formatação está disponível no Componente 3 (Método de Versionamento), seção "CHECKLIST PRÉ-ENVIO".</p>

<p>Consulte o checklist antes de finalizar qualquer peça jurídica.</p>
`,
  markdown: `
## CHECKLIST DE FORMATAÇÃO

**Importante:** O checklist completo de formatação está disponível no Componente 3 (Método de Versionamento), seção "CHECKLIST PRÉ-ENVIO".

Consulte o checklist antes de finalizar qualquer peça jurídica.
`,
  text: `
═══════════════════════════════════════
CHECKLIST DE FORMATAÇÃO
═══════════════════════════════════════

Importante: O checklist completo de formatação está disponível no Componente 3 (Método de Versionamento), seção "CHECKLIST PRÉ-ENVIO".

Consulte o checklist antes de finalizar qualquer peça jurídica.
`
};

// Substituir checklist no Componente 2 por referência
data.components.formattingMethod.content.html = data.components.formattingMethod.content.html.replace(
  /<h2>CHECKLIST DE FORMATAÇÃO<\/h2>[\s\S]*?(?=<h2>|$)/,
  checklistRemoval.html
);

data.components.formattingMethod.content.markdown = data.components.formattingMethod.content.markdown.replace(
  /## CHECKLIST DE FORMATAÇÃO[\s\S]*?(?=\n##|$)/,
  checklistRemoval.markdown
);

data.components.formattingMethod.content.text = data.components.formattingMethod.content.text.replace(
  /═══════════════════════════════════════\nCHECKLIST DE FORMATAÇÃO[\s\S]*?(?=\n═══════════════════════════════════════|$)/,
  checklistRemoval.text
);

console.log('✅ P1-1: Checklist duplicado removido');

// ═══════════════════════════════════════════════════════
// CORREÇÃO P1-2: ADICIONAR SEÇÃO "CONTEXTO DE APLICAÇÃO"
// ═══════════════════════════════════════════════════════

console.log('\n🔧 P1-2: Adicionando distinção Chat vs. Peças...');

const contextoAplicacaoHTML = `
<h2>CONTEXTO DE APLICAÇÃO</h2>

<p><strong>PEÇAS JURÍDICAS FORMAIS:</strong></p>
<ul>
<li>Seguir extensões mínimas especificadas (10-40 páginas conforme tipo)</li>
<li>Fundamentação exaustiva obrigatória (base legal + jurisprudência + doutrina)</li>
<li>Usar create_artifact para entrega</li>
<li>Formatação ABNT/OAB rigorosa</li>
<li>PROIBIDO: emojis, markdown, linguagem informal</li>
</ul>

<p><strong>CHAT CONVERSACIONAL:</strong></p>
<ul>
<li>Respostas concisas e diretas (1-3 parágrafos)</li>
<li>Expandir apenas se usuário solicitar explicitamente</li>
<li>PERMITIDO: markdown para clareza (**negrito**, listas, ###)</li>
<li>Oferecer elaborar peça completa quando aplicável</li>
<li>Perguntar se usuário quer análise detalhada ou resposta rápida</li>
</ul>

<p><strong>REGRA DE OURO:</strong> Se usar create_artifact, o conteúdo dentro NÃO deve ter markdown.</p>
`;

const contextoAplicacaoMarkdown = `
## CONTEXTO DE APLICAÇÃO

**PEÇAS JURÍDICAS FORMAIS:**
- Seguir extensões mínimas especificadas (10-40 páginas conforme tipo)
- Fundamentação exaustiva obrigatória (base legal + jurisprudência + doutrina)
- Usar create_artifact para entrega
- Formatação ABNT/OAB rigorosa
- PROIBIDO: emojis, markdown, linguagem informal

**CHAT CONVERSACIONAL:**
- Respostas concisas e diretas (1-3 parágrafos)
- Expandir apenas se usuário solicitar explicitamente
- PERMITIDO: markdown para clareza (**negrito**, listas, ###)
- Oferecer elaborar peça completa quando aplicável
- Perguntar se usuário quer análise detalhada ou resposta rápida

**REGRA DE OURO:** Se usar create_artifact, o conteúdo dentro NÃO deve ter markdown.
`;

const contextoAplicacaoText = `
═══════════════════════════════════════
CONTEXTO DE APLICAÇÃO
═══════════════════════════════════════

PEÇAS JURÍDICAS FORMAIS:
- Seguir extensões mínimas especificadas (10-40 páginas conforme tipo)
- Fundamentação exaustiva obrigatória (base legal + jurisprudência + doutrina)
- Usar create_artifact para entrega
- Formatação ABNT/OAB rigorosa
- PROIBIDO: emojis, markdown, linguagem informal

CHAT CONVERSACIONAL:
- Respostas concisas e diretas (1-3 parágrafos)
- Expandir apenas se usuário solicitar explicitamente
- PERMITIDO: markdown para clareza (**negrito**, listas, ###)
- Oferecer elaborar peça completa quando aplicável
- Perguntar se usuário quer análise detalhada ou resposta rápida

REGRA DE OURO: Se usar create_artifact, o conteúdo dentro NÃO deve ter markdown.
`;

// Inserir após "EXTENSÃO MÍNIMA DAS PEÇAS"
data.components.customInstructions.content.html = data.components.customInstructions.content.html.replace(
  /(<h2>EXTENSÃO MÍNIMA DAS PEÇAS<\/h2>[\s\S]*?)<h2>QUALIDADE TÉCNICA<\/h2>/,
  `$1${contextoAplicacaoHTML}\n\n<h2>QUALIDADE TÉCNICA</h2>`
);

data.components.customInstructions.content.markdown = data.components.customInstructions.content.markdown.replace(
  /(## EXTENSÃO MÍNIMA DAS PEÇAS[\s\S]*?)\n## QUALIDADE TÉCNICA/,
  `$1\n\n${contextoAplicacaoMarkdown}\n\n## QUALIDADE TÉCNICA`
);

data.components.customInstructions.content.text = data.components.customInstructions.content.text.replace(
  /(═══════════════════════════════════════\nEXTENSÃO MÍNIMA DAS PEÇAS[\s\S]*?)\n═══════════════════════════════════════\nQUALIDADE TÉCNICA/,
  `$1\n\n${contextoAplicacaoText}\n\n═══════════════════════════════════════\nQUALIDADE TÉCNICA`
);

console.log('✅ P1-2: Contexto de aplicação adicionado');

// ═══════════════════════════════════════════════════════
// CORREÇÃO P1-3: ADICIONAR SEÇÃO "GESTÃO DE VERSÕES"
// ═══════════════════════════════════════════════════════

console.log('\n🔧 P1-3: Adicionando instruções de gestão de versões...');

const gestaoVersoesHTML = `
<h2>GESTÃO DE VERSÕES</h2>

<p><strong>CRIAR NOVA VERSÃO QUANDO:</strong></p>
<ul>
<li>Usuário solicita explicitamente ("adicione", "modifique", "corrija", "melhore")</li>
<li>Mudança substancial em argumentação (>20% do conteúdo alterado)</li>
<li>Inclusão de novos pedidos ou preliminares não presentes antes</li>
<li>Alteração estratégica na abordagem jurídica</li>
</ul>

<p><strong>ATUALIZAR VERSÃO ATUAL (NÃO CRIAR NOVA) QUANDO:</strong></p>
<ul>
<li>Correções pontuais (ortografia, formatação, pequenos ajustes)</li>
<li>Ajustes menores solicitados (<10% do conteúdo)</li>
<li>Primeira elaboração da peça (sempre versão 1.0)</li>
<li>Complementos que não alteram estrutura</li>
</ul>

<p><strong>OBRIGATÓRIO EM TODA VERSÃO:</strong></p>
<ul>
<li>Informar ao usuário qual versão está sendo entregue</li>
<li>Manter numeração sequencial (1.0 → 1.1 → 1.2 ou 2.0 para mudanças grandes)</li>
<li>Destacar mudanças principais em relação à versão anterior</li>
<li>Usar create_artifact com título incluindo versão (ex: "Petição Inicial - v1.1")</li>
</ul>
`;

const gestaoVersoesMarkdown = `
## GESTÃO DE VERSÕES

**CRIAR NOVA VERSÃO QUANDO:**
- Usuário solicita explicitamente ("adicione", "modifique", "corrija", "melhore")
- Mudança substancial em argumentação (>20% do conteúdo alterado)
- Inclusão de novos pedidos ou preliminares não presentes antes
- Alteração estratégica na abordagem jurídica

**ATUALIZAR VERSÃO ATUAL (NÃO CRIAR NOVA) QUANDO:**
- Correções pontuais (ortografia, formatação, pequenos ajustes)
- Ajustes menores solicitados (<10% do conteúdo)
- Primeira elaboração da peça (sempre versão 1.0)
- Complementos que não alteram estrutura

**OBRIGATÓRIO EM TODA VERSÃO:**
- Informar ao usuário qual versão está sendo entregue
- Manter numeração sequencial (1.0 → 1.1 → 1.2 ou 2.0 para mudanças grandes)
- Destacar mudanças principais em relação à versão anterior
- Usar create_artifact com título incluindo versão (ex: "Petição Inicial - v1.1")
`;

const gestaoVersoesText = `
═══════════════════════════════════════
GESTÃO DE VERSÕES
═══════════════════════════════════════

CRIAR NOVA VERSÃO QUANDO:
- Usuário solicita explicitamente ("adicione", "modifique", "corrija", "melhore")
- Mudança substancial em argumentação (>20% do conteúdo alterado)
- Inclusão de novos pedidos ou preliminares não presentes antes
- Alteração estratégica na abordagem jurídica

ATUALIZAR VERSÃO ATUAL (NÃO CRIAR NOVA) QUANDO:
- Correções pontuais (ortografia, formatação, pequenos ajustes)
- Ajustes menores solicitados (<10% do conteúdo)
- Primeira elaboração da peça (sempre versão 1.0)
- Complementos que não alteram estrutura

OBRIGATÓRIO EM TODA VERSÃO:
- Informar ao usuário qual versão está sendo entregue
- Manter numeração sequencial (1.0 → 1.1 → 1.2 ou 2.0 para mudanças grandes)
- Destacar mudanças principais em relação à versão anterior
- Usar create_artifact com título incluindo versão (ex: "Petição Inicial - v1.1")
`;

// Inserir no Componente 3, após "TÉCNICAS PERSUASIVAS"
data.components.versioningMethod.content.html = data.components.versioningMethod.content.html.replace(
  /(<h2>TÉCNICAS PERSUASIVAS<\/h2>[\s\S]*?)<h2>ORDEM DE MATÉRIAS/,
  `$1${gestaoVersoesHTML}\n\n<h2>ORDEM DE MATÉRIAS`
);

data.components.versioningMethod.content.markdown = data.components.versioningMethod.content.markdown.replace(
  /(## TÉCNICAS PERSUASIVAS[\s\S]*?)\n## ORDEM DE MATÉRIAS/,
  `$1\n\n${gestaoVersoesMarkdown}\n\n## ORDEM DE MATÉRIAS`
);

data.components.versioningMethod.content.text = data.components.versioningMethod.content.text.replace(
  /(═══════════════════════════════════════\nTÉCNICAS PERSUASIVAS[\s\S]*?)\n═══════════════════════════════════════\nORDEM DE MATÉRIAS/,
  `$1\n\n${gestaoVersoesText}\n\n═══════════════════════════════════════\nORDEM DE MATÉRIAS`
);

console.log('✅ P1-3: Gestão de versões adicionada');

// ═══════════════════════════════════════════════════════
// CORREÇÃO P1-4: ESCLARECER USO DE MARKDOWN
// ═══════════════════════════════════════════════════════

console.log('\n🔧 P1-4: Esclarecendo uso de markdown em chat...');

// Substituir proibição genérica por instrução contextualizada no Componente 1
data.components.customInstructions.content.html = data.components.customInstructions.content.html.replace(
  /<li>✗ NUNCA use markdown \(\*\*, ###, ``` \) em documentos formais<\/li>/,
  '<li>✗ NUNCA use markdown (**, ###, ```) em peças jurídicas formais (use em chat quando necessário para clareza)</li>'
);

data.components.customInstructions.content.markdown = data.components.customInstructions.content.markdown.replace(
  /✗ NUNCA use markdown \(\*\*, ###, ``` \) em documentos formais/,
  '✗ NUNCA use markdown (**, ###, ```) em peças jurídicas formais (use em chat quando necessário para clareza)'
);

data.components.customInstructions.content.text = data.components.customInstructions.content.text.replace(
  /✗ NUNCA use markdown \(\*\*, ###, ``` \) em documentos formais/,
  '✗ NUNCA use markdown (**, ###, ```) em peças jurídicas formais (use em chat quando necessário para clareza)'
);

console.log('✅ P1-4: Uso de markdown esclarecido');

// ═══════════════════════════════════════════════════════
// RECALCULAR METADATA
// ═══════════════════════════════════════════════════════

console.log('\n📊 Recalculando metadados...');

function recalculateMetadata(text) {
  const words = text.split(/\s+/).filter(w => w.length > 0);
  const characters = text.length;
  const tokens = Math.ceil(characters / 4);

  return {
    wordCount: words.length,
    characterCount: characters,
    estimatedTokens: tokens
  };
}

data.components.customInstructions.metadata = recalculateMetadata(data.components.customInstructions.content.text);
data.components.formattingMethod.metadata = recalculateMetadata(data.components.formattingMethod.content.text);
data.components.versioningMethod.metadata = recalculateMetadata(data.components.versioningMethod.content.text);

// ═══════════════════════════════════════════════════════
// ATUALIZAR VERSÃO E METADATA
// ═══════════════════════════════════════════════════════

// Incrementar versão de 1.1 para 1.2
data.version = "1.2";
data.lastUpdated = new Date().toISOString();
data.updatedBy = "claude_code_p1";

// ═══════════════════════════════════════════════════════
// SALVAR ARQUIVO CORRIGIDO
// ═══════════════════════════════════════════════════════

fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');

console.log('\n✅ Custom Instructions P1 corrigidas com sucesso!');
console.log(`📊 Nova versão: ${data.version}`);
console.log(`📝 Tokens estimados:`);
console.log(`   - Custom Instructions: ${data.components.customInstructions.metadata.estimatedTokens}`);
console.log(`   - Formatação: ${data.components.formattingMethod.metadata.estimatedTokens}`);
console.log(`   - Versionamento: ${data.components.versioningMethod.metadata.estimatedTokens}`);
console.log(`   - TOTAL: ${data.components.customInstructions.metadata.estimatedTokens + data.components.formattingMethod.metadata.estimatedTokens + data.components.versioningMethod.metadata.estimatedTokens}`);

console.log('\n📋 Correções aplicadas:');
console.log('   ✅ P1-1: Checklist duplicado removido do Componente 2');
console.log('   ✅ P1-2: Contexto de aplicação (Chat vs. Peças) adicionado');
console.log('   ✅ P1-3: Gestão de versões detalhada adicionada');
console.log('   ✅ P1-4: Uso de markdown esclarecido');
