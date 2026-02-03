import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// ES module equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ler arquivo atual
const filePath = path.join(__dirname, 'data', 'custom-instructions', 'rom', 'custom-instructions.json');
const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

console.log('🔧 Aplicando correções P2...\n');

// ═══════════════════════════════════════════════════════
// CORREÇÃO P2-1: CONSOLIDAR "SEMPRE" REPETIDO
// ═══════════════════════════════════════════════════════

console.log('🔧 P2-1: Consolidando repetições de "SEMPRE"...');

// Contar ocorrências atuais de SEMPRE
const currentText = data.components.customInstructions.content.text;
const sempreCount = (currentText.match(/SEMPRE/g) || []).length;
console.log(`   Ocorrências atuais de "SEMPRE": ${sempreCount}`);

// Substituir seção "COMPORTAMENTO OBRIGATÓRIO" por versão consolidada

const comportamentoConsolidadoHTML = `<h2>COMPORTAMENTO OBRIGATÓRIO</h2>

<p><strong>As seguintes regras são OBRIGATÓRIAS em todas as peças:</strong></p>

<ul>
<li>✓ Pesquisar jurisprudência via web_search antes de citar precedentes</li>
<li>✓ Seguir estrutura hierárquica das peças (I, II, III → 1, 2, 3 → a, b, c)</li>
<li>✓ Justificar argumentos com base legal e jurisprudencial</li>
<li>✓ Usar formatação ABNT/OAB rigorosa</li>
<li>✓ Citar fontes corretamente (artigos de lei, decisões judiciais, doutrina)</li>
</ul>`;

const comportamentoConsolidadoMarkdown = `## COMPORTAMENTO OBRIGATÓRIO

**As seguintes regras são OBRIGATÓRIAS em todas as peças:**

- ✓ Pesquisar jurisprudência via web_search antes de citar precedentes
- ✓ Seguir estrutura hierárquica das peças (I, II, III → 1, 2, 3 → a, b, c)
- ✓ Justificar argumentos com base legal e jurisprudencial
- ✓ Usar formatação ABNT/OAB rigorosa
- ✓ Citar fontes corretamente (artigos de lei, decisões judiciais, doutrina)`;

const comportamentoConsolidadoText = `═══════════════════════════════════════
COMPORTAMENTO OBRIGATÓRIO
═══════════════════════════════════════

As seguintes regras são OBRIGATÓRIAS em todas as peças:

✓ Pesquisar jurisprudência via web_search antes de citar precedentes
✓ Seguir estrutura hierárquica das peças (I, II, III → 1, 2, 3 → a, b, c)
✓ Justificar argumentos com base legal e jurisprudencial
✓ Usar formatação ABNT/OAB rigorosa
✓ Citar fontes corretamente (artigos de lei, decisões judiciais, doutrina)`;

// Substituir no HTML
data.components.customInstructions.content.html = data.components.customInstructions.content.html.replace(
  /<h2>COMPORTAMENTO OBRIGATÓRIO<\/h2>[\s\S]*?(?=<h2>PROIBIÇÕES ABSOLUTAS<\/h2>)/,
  comportamentoConsolidadoHTML + '\n\n'
);

// Substituir no Markdown
data.components.customInstructions.content.markdown = data.components.customInstructions.content.markdown.replace(
  /## COMPORTAMENTO OBRIGATÓRIO[\s\S]*?(?=\n## PROIBIÇÕES ABSOLUTAS)/,
  comportamentoConsolidadoMarkdown + '\n\n'
);

// Substituir no Text
data.components.customInstructions.content.text = data.components.customInstructions.content.text.replace(
  /═══════════════════════════════════════\nCOMPORTAMENTO OBRIGATÓRIO[\s\S]*?(?=\n═══════════════════════════════════════\nPROIBIÇÕES ABSOLUTAS)/,
  comportamentoConsolidadoText + '\n\n'
);

// Contar novamente
const newText = data.components.customInstructions.content.text;
const newSempreCount = (newText.match(/SEMPRE/g) || []).length;
console.log(`   Ocorrências após consolidação: ${newSempreCount}`);
console.log(`   Redução: ${sempreCount - newSempreCount} ocorrências`);

console.log('✅ P2-1: "SEMPRE" consolidado');

// ═══════════════════════════════════════════════════════
// CORREÇÃO P2-2: ADICIONAR PRIORIZAÇÃO DE ARGUMENTOS
// ═══════════════════════════════════════════════════════

console.log('\n🔧 P2-2: Adicionando seção de priorização de argumentos...');

const priorizacaoHTML = `
<h2>PRIORIZAÇÃO DE ARGUMENTOS</h2>

<p><strong>ORDEM ESTRATÉGICA (do mais forte ao mais fraco):</strong></p>

<p><strong>1º NÍVEL - PRELIMINARES (Art. 337 CPC)</strong></p>
<ul>
<li>Ordem OBRIGATÓRIA prevista no CPC</li>
<li>Sempre antes do mérito</li>
<li>Exemplo: Incompetência absoluta, inépcia da inicial, litispendência</li>
</ul>

<p><strong>2º NÍVEL - MÉRITO (por força decrescente)</strong></p>

<p><em>a) Argumentos que barram a ação completamente:</em></p>
<ul>
<li>Prescrição, decadência</li>
<li>Coisa julgada</li>
<li>Perempção</li>
<li><strong>Impacto:</strong> Se acolhidos, extinguem o processo com resolução de mérito</li>
</ul>

<p><em>b) Argumentos que excluem responsabilidade:</em></p>
<ul>
<li>Fato de terceiro, caso fortuito, força maior</li>
<li>Excludentes de ilicitude ou culpabilidade</li>
<li>Ausência de nexo causal</li>
<li><strong>Impacto:</strong> Afastam completamente a responsabilização</li>
</ul>

<p><em>c) Argumentos que reduzem condenação:</em></p>
<ul>
<li>Compensação, abatimentos</li>
<li>Concorrência de culpa</li>
<li>Redução de danos ou lucros cessantes</li>
<li><strong>Impacto:</strong> Diminuem valor da condenação</li>
</ul>

<p><em>d) Argumentos subsidiários:</em></p>
<ul>
<li>Aplicáveis apenas se argumentos principais falharem</li>
<li>Questões acessórias (juros, correção monetária)</li>
<li><strong>Uso:</strong> "Subsidiariamente, caso não acolhida a tese anterior..."</li>
</ul>

<p><strong>3º NÍVEL - ESTRUTURA DE PEDIDOS</strong></p>
<ul>
<li>Pedido principal (mais específico e ideal)</li>
<li>Pedidos subsidiários (alternativas caso principal não seja acolhido)</li>
<li>Do mais específico ao mais genérico</li>
</ul>

<p><strong>REGRA PRÁTICA:</strong> Sempre começar com argumento mais forte que, se acolhido, resolve o caso inteiramente a favor do cliente.</p>
`;

const priorizacaoMarkdown = `
## PRIORIZAÇÃO DE ARGUMENTOS

**ORDEM ESTRATÉGICA (do mais forte ao mais fraco):**

**1º NÍVEL - PRELIMINARES (Art. 337 CPC)**
- Ordem OBRIGATÓRIA prevista no CPC
- Sempre antes do mérito
- Exemplo: Incompetência absoluta, inépcia da inicial, litispendência

**2º NÍVEL - MÉRITO (por força decrescente)**

*a) Argumentos que barram a ação completamente:*
- Prescrição, decadência
- Coisa julgada
- Perempção
- **Impacto:** Se acolhidos, extinguem o processo com resolução de mérito

*b) Argumentos que excluem responsabilidade:*
- Fato de terceiro, caso fortuito, força maior
- Excludentes de ilicitude ou culpabilidade
- Ausência de nexo causal
- **Impacto:** Afastam completamente a responsabilização

*c) Argumentos que reduzem condenação:*
- Compensação, abatimentos
- Concorrência de culpa
- Redução de danos ou lucros cessantes
- **Impacto:** Diminuem valor da condenação

*d) Argumentos subsidiários:*
- Aplicáveis apenas se argumentos principais falharem
- Questões acessórias (juros, correção monetária)
- **Uso:** "Subsidiariamente, caso não acolhida a tese anterior..."

**3º NÍVEL - ESTRUTURA DE PEDIDOS**
- Pedido principal (mais específico e ideal)
- Pedidos subsidiários (alternativas caso principal não seja acolhido)
- Do mais específico ao mais genérico

**REGRA PRÁTICA:** Sempre começar com argumento mais forte que, se acolhido, resolve o caso inteiramente a favor do cliente.
`;

const priorizacaoText = `
═══════════════════════════════════════
PRIORIZAÇÃO DE ARGUMENTOS
═══════════════════════════════════════

ORDEM ESTRATÉGICA (do mais forte ao mais fraco):

1º NÍVEL - PRELIMINARES (Art. 337 CPC)
- Ordem OBRIGATÓRIA prevista no CPC
- Sempre antes do mérito
- Exemplo: Incompetência absoluta, inépcia da inicial, litispendência

2º NÍVEL - MÉRITO (por força decrescente)

a) Argumentos que barram a ação completamente:
   - Prescrição, decadência
   - Coisa julgada
   - Perempção
   - Impacto: Se acolhidos, extinguem o processo com resolução de mérito

b) Argumentos que excluem responsabilidade:
   - Fato de terceiro, caso fortuito, força maior
   - Excludentes de ilicitude ou culpabilidade
   - Ausência de nexo causal
   - Impacto: Afastam completamente a responsabilização

c) Argumentos que reduzem condenação:
   - Compensação, abatimentos
   - Concorrência de culpa
   - Redução de danos ou lucros cessantes
   - Impacto: Diminuem valor da condenação

d) Argumentos subsidiários:
   - Aplicáveis apenas se argumentos principais falharem
   - Questões acessórias (juros, correção monetária)
   - Uso: "Subsidiariamente, caso não acolhida a tese anterior..."

3º NÍVEL - ESTRUTURA DE PEDIDOS
- Pedido principal (mais específico e ideal)
- Pedidos subsidiários (alternativas caso principal não seja acolhido)
- Do mais específico ao mais genérico

REGRA PRÁTICA: Sempre começar com argumento mais forte que, se acolhido, resolve o caso inteiramente a favor do cliente.
`;

// Inserir após "ORDEM DE MATÉRIAS" no Componente 3
data.components.versioningMethod.content.html = data.components.versioningMethod.content.html.replace(
  /(<h2>ORDEM DE MATÉRIAS[\s\S]*?)<h2>VERSIONAMENTO DE DOCUMENTOS<\/h2>/,
  `$1${priorizacaoHTML}\n\n<h2>VERSIONAMENTO DE DOCUMENTOS</h2>`
);

data.components.versioningMethod.content.markdown = data.components.versioningMethod.content.markdown.replace(
  /(## ORDEM DE MATÉRIAS[\s\S]*?)\n## VERSIONAMENTO DE DOCUMENTOS/,
  `$1\n\n${priorizacaoMarkdown}\n\n## VERSIONAMENTO DE DOCUMENTOS`
);

data.components.versioningMethod.content.text = data.components.versioningMethod.content.text.replace(
  /(═══════════════════════════════════════\nORDEM DE MATÉRIAS[\s\S]*?)\n═══════════════════════════════════════\nVERSIONAMENTO DE DOCUMENTOS/,
  `$1\n\n${priorizacaoText}\n\n═══════════════════════════════════════\nVERSIONAMENTO DE DOCUMENTOS`
);

console.log('✅ P2-2: Priorização de argumentos adicionada');

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

const oldCI = data.components.customInstructions.metadata.estimatedTokens;
const oldVer = data.components.versioningMethod.metadata.estimatedTokens;

data.components.customInstructions.metadata = recalculateMetadata(data.components.customInstructions.content.text);
data.components.formattingMethod.metadata = recalculateMetadata(data.components.formattingMethod.content.text);
data.components.versioningMethod.metadata = recalculateMetadata(data.components.versioningMethod.content.text);

const newCI = data.components.customInstructions.metadata.estimatedTokens;
const newVer = data.components.versioningMethod.metadata.estimatedTokens;

console.log(`   Custom Instructions: ${oldCI} → ${newCI} (${newCI - oldCI > 0 ? '+' : ''}${newCI - oldCI})`);
console.log(`   Versionamento: ${oldVer} → ${newVer} (+${newVer - oldVer})`);

// ═══════════════════════════════════════════════════════
// ATUALIZAR VERSÃO E METADATA
// ═══════════════════════════════════════════════════════

// Incrementar versão de 1.2 para 1.3
data.version = "1.3";
data.lastUpdated = new Date().toISOString();
data.updatedBy = "claude_code_p2";

// ═══════════════════════════════════════════════════════
// SALVAR ARQUIVO CORRIGIDO
// ═══════════════════════════════════════════════════════

fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');

console.log('\n✅ Custom Instructions P2 corrigidas com sucesso!');
console.log(`📊 Nova versão: ${data.version}`);
console.log(`📝 Tokens estimados:`);
console.log(`   - Custom Instructions: ${data.components.customInstructions.metadata.estimatedTokens}`);
console.log(`   - Formatação: ${data.components.formattingMethod.metadata.estimatedTokens}`);
console.log(`   - Versionamento: ${data.components.versioningMethod.metadata.estimatedTokens}`);
console.log(`   - TOTAL: ${data.components.customInstructions.metadata.estimatedTokens + data.components.formattingMethod.metadata.estimatedTokens + data.components.versioningMethod.metadata.estimatedTokens}`);

console.log('\n📋 Correções aplicadas:');
console.log('   ✅ P2-1: "SEMPRE" consolidado (economia de tokens)');
console.log('   ✅ P2-2: Priorização de argumentos adicionada');
console.log(`\n💰 Economia líquida: ${(oldCI - newCI)} tokens no Componente 1`);
console.log(`💰 Investimento: +${newVer - oldVer} tokens no Componente 3`);
console.log(`💰 Saldo: ${(oldCI - newCI) + (newVer - oldVer) > 0 ? '+' : ''}${(oldCI - newCI) + (newVer - oldVer)} tokens`);
