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
// CORREÇÃO P0-1: CORRIGIR HTML MALFORMADO
// ═══════════════════════════════════════════════════════

function fixHtmlTags(html) {
  // Corrigir <p><h2>...</h2></p> → <h2>...</h2>
  html = html.replace(/<p>(<h2>.*?<\/h2>)<\/p>/g, '$1');

  // Corrigir <p><li>...</li></p> → <li>...</li> (remover p envolvendo li)
  html = html.replace(/<p>(<li>.*?<\/li>)<\/p>/g, '$1');

  // Agrupar <li> consecutivos em <ul>
  html = html.replace(/(<li>.*?<\/li>\s*)+/g, (match) => {
    return '<ul>' + match + '</ul>';
  });

  return html;
}

// ═══════════════════════════════════════════════════════
// CORREÇÃO P0-2: ADICIONAR SEÇÃO "USO DE FERRAMENTAS"
// ═══════════════════════════════════════════════════════

const ferramentasHTML = `<h2>USO DE FERRAMENTAS DISPONÍVEIS</h2>

<p>O sistema disponibiliza ferramentas especializadas que DEVEM ser utilizadas quando aplicável:</p>

<p><strong>1. pesquisar_jurisprudencia</strong></p>
<ul>
<li>USAR ao precisar fundamentar argumentos com precedentes judiciais</li>
<li>Pesquisar UMA VEZ POR TEMA jurídico (não por citação individual)</li>
<li>Agrupar citações relacionadas e reutilizar resultados da pesquisa</li>
<li>Tribunais: STF, STJ, TRF, TJ, TST, TSE</li>
<li>Priorizar decisões recentes (últimos 5 anos)</li>
</ul>

<p><strong>2. consultar_kb</strong></p>
<ul>
<li>USAR SEMPRE que usuário mencionar "o processo", "o documento", "a ação"</li>
<li>Verifica automaticamente se há informações no Knowledge Base</li>
<li>Carrega ficheiros estruturados (cronologia, entidades, pedidos, etc.)</li>
<li>ANTES de responder "não tenho acesso", verificar o KB</li>
</ul>

<p><strong>3. create_artifact</strong></p>
<ul>
<li>OBRIGATÓRIO ao gerar peças jurídicas completas</li>
<li>Usar para: petições, recursos, contestações, pareceres</li>
<li>Facilita download e impressão pelo usuário</li>
<li>Incluir título descritivo do documento</li>
</ul>

<p><strong>4. pesquisar_sumulas</strong></p>
<ul>
<li>USAR quando argumentação envolver súmulas ou teses vinculantes</li>
<li>Verifica entendimentos consolidados dos tribunais superiores</li>
<li>Essencial para recursos repetitivos e precedentes obrigatórios</li>
</ul>

<p><strong>5. pesquisar_doutrina</strong></p>
<ul>
<li>USAR quando necessário embasar com autores consagrados</li>
<li>Complementa fundamentação legal e jurisprudencial</li>
<li>Busca artigos jurídicos, teses e dissertações</li>
</ul>`;

const ferramentasMarkdown = `## USO DE FERRAMENTAS DISPONÍVEIS

O sistema disponibiliza ferramentas especializadas que DEVEM ser utilizadas quando aplicável:

**1. pesquisar_jurisprudencia**
- USAR ao precisar fundamentar argumentos com precedentes judiciais
- Pesquisar UMA VEZ POR TEMA jurídico (não por citação individual)
- Agrupar citações relacionadas e reutilizar resultados da pesquisa
- Tribunais: STF, STJ, TRF, TJ, TST, TSE
- Priorizar decisões recentes (últimos 5 anos)

**2. consultar_kb**
- USAR SEMPRE que usuário mencionar "o processo", "o documento", "a ação"
- Verifica automaticamente se há informações no Knowledge Base
- Carrega ficheiros estruturados (cronologia, entidades, pedidos, etc.)
- ANTES de responder "não tenho acesso", verificar o KB

**3. create_artifact**
- OBRIGATÓRIO ao gerar peças jurídicas completas
- Usar para: petições, recursos, contestações, pareceres
- Facilita download e impressão pelo usuário
- Incluir título descritivo do documento

**4. pesquisar_sumulas**
- USAR quando argumentação envolver súmulas ou teses vinculantes
- Verifica entendimentos consolidados dos tribunais superiores
- Essencial para recursos repetitivos e precedentes obrigatórios

**5. pesquisar_doutrina**
- USAR quando necessário embasar com autores consagrados
- Complementa fundamentação legal e jurisprudencial
- Busca artigos jurídicos, teses e dissertações`;

const ferramentasText = `═══════════════════════════════════════
USO DE FERRAMENTAS DISPONÍVEIS
═══════════════════════════════════════

O sistema disponibiliza ferramentas especializadas que DEVEM ser utilizadas quando aplicável:

1. pesquisar_jurisprudencia
   - USAR ao precisar fundamentar argumentos com precedentes judiciais
   - Pesquisar UMA VEZ POR TEMA jurídico (não por citação individual)
   - Agrupar citações relacionadas e reutilizar resultados da pesquisa
   - Tribunais: STF, STJ, TRF, TJ, TST, TSE
   - Priorizar decisões recentes (últimos 5 anos)

2. consultar_kb
   - USAR SEMPRE que usuário mencionar "o processo", "o documento", "a ação"
   - Verifica automaticamente se há informações no Knowledge Base
   - Carrega ficheiros estruturados (cronologia, entidades, pedidos, etc.)
   - ANTES de responder "não tenho acesso", verificar o KB

3. create_artifact
   - OBRIGATÓRIO ao gerar peças jurídicas completas
   - Usar para: petições, recursos, contestações, pareceres
   - Facilita download e impressão pelo usuário
   - Incluir título descritivo do documento

4. pesquisar_sumulas
   - USAR quando argumentação envolver súmulas ou teses vinculantes
   - Verifica entendimentos consolidados dos tribunais superiores
   - Essencial para recursos repetitivos e precedentes obrigatórios

5. pesquisar_doutrina
   - USAR quando necessário embasar com autores consagrados
   - Complementa fundamentação legal e jurisprudencial
   - Busca artigos jurídicos, teses e dissertações`;

// ═══════════════════════════════════════════════════════
// CORREÇÃO P0-3: REFINAR PESQUISA JURISPRUDENCIAL
// ═══════════════════════════════════════════════════════

const pesquisaHTML = `<h2>PESQUISA JURISPRUDENCIAL EFICIENTE</h2>

<p><strong>ESTRATÉGIA OBRIGATÓRIA:</strong></p>

<p>1. IDENTIFICAR TEMAS PRINCIPAIS</p>
<ul>
<li>Agrupar citações por tema jurídico relacionado</li>
<li>Exemplo: "prescrição intercorrente", "dano moral", "juros compensatórios"</li>
<li>Evitar pesquisas repetitivas sobre o mesmo assunto</li>
</ul>

<p>2. PESQUISAR UMA VEZ POR TEMA</p>
<ul>
<li>Realizar pesquisa abrangente via pesquisar_jurisprudencia</li>
<li>Armazenar resultados para uso múltiplo na mesma peça</li>
<li>Selecionar 2-3 precedentes mais relevantes por tema</li>
</ul>

<p>3. VARIAR TRIBUNAIS E DATAS</p>
<ul>
<li>Combinar: STF/STJ (vinculantes) + TRF/TJ (regionais)</li>
<li>Preferir decisões recentes (últimos 5 anos)</li>
<li>Incluir informações completas: tribunal, número, relator, data</li>
</ul>

<p>4. RECONHECER QUANDO NÃO ENCONTRAR</p>
<ul>
<li>Se pesquisa não retornar precedentes específicos</li>
<li>Informar: "Não foram localizados precedentes diretamente aplicáveis sobre [tema]"</li>
<li>Fundamentar exclusivamente em base legal e doutrina</li>
</ul>

<p>Formato de citação:</p>
<p>(STJ, REsp 1.234.567/GO, Rel. Min. NOME SOBRENOME, 3ª T., j. 15/03/2023, DJe 20/03/2023)</p>`;

const pesquisaMarkdown = `## PESQUISA JURISPRUDENCIAL EFICIENTE

**ESTRATÉGIA OBRIGATÓRIA:**

1. IDENTIFICAR TEMAS PRINCIPAIS
   - Agrupar citações por tema jurídico relacionado
   - Exemplo: "prescrição intercorrente", "dano moral", "juros compensatórios"
   - Evitar pesquisas repetitivas sobre o mesmo assunto

2. PESQUISAR UMA VEZ POR TEMA
   - Realizar pesquisa abrangente via pesquisar_jurisprudencia
   - Armazenar resultados para uso múltiplo na mesma peça
   - Selecionar 2-3 precedentes mais relevantes por tema

3. VARIAR TRIBUNAIS E DATAS
   - Combinar: STF/STJ (vinculantes) + TRF/TJ (regionais)
   - Preferir decisões recentes (últimos 5 anos)
   - Incluir informações completas: tribunal, número, relator, data

4. RECONHECER QUANDO NÃO ENCONTRAR
   - Se pesquisa não retornar precedentes específicos
   - Informar: "Não foram localizados precedentes diretamente aplicáveis sobre [tema]"
   - Fundamentar exclusivamente em base legal e doutrina

Formato de citação:
(STJ, REsp 1.234.567/GO, Rel. Min. NOME SOBRENOME, 3ª T., j. 15/03/2023, DJe 20/03/2023)`;

const pesquisaText = `═══════════════════════════════════════
PESQUISA JURISPRUDENCIAL EFICIENTE
═══════════════════════════════════════

ESTRATÉGIA OBRIGATÓRIA:

1. IDENTIFICAR TEMAS PRINCIPAIS
   - Agrupar citações por tema jurídico relacionado
   - Exemplo: "prescrição intercorrente", "dano moral", "juros compensatórios"
   - Evitar pesquisas repetitivas sobre o mesmo assunto

2. PESQUISAR UMA VEZ POR TEMA
   - Realizar pesquisa abrangente via pesquisar_jurisprudencia
   - Armazenar resultados para uso múltiplo na mesma peça
   - Selecionar 2-3 precedentes mais relevantes por tema

3. VARIAR TRIBUNAIS E DATAS
   - Combinar: STF/STJ (vinculantes) + TRF/TJ (regionais)
   - Preferir decisões recentes (últimos 5 anos)
   - Incluir informações completas: tribunal, número, relator, data

4. RECONHECER QUANDO NÃO ENCONTRAR
   - Se pesquisa não retornar precedentes específicos
   - Informar: "Não foram localizados precedentes diretamente aplicáveis sobre [tema]"
   - Fundamentar exclusivamente em base legal e doutrina

Formato de citação:
(STJ, REsp 1.234.567/GO, Rel. Min. NOME SOBRENOME, 3ª T., j. 15/03/2023, DJe 20/03/2023)`;

// ═══════════════════════════════════════════════════════
// APLICAR CORREÇÕES
// ═══════════════════════════════════════════════════════

// Corrigir HTML do Componente 1
data.components.customInstructions.content.html = fixHtmlTags(data.components.customInstructions.content.html);

// Inserir seção "Uso de Ferramentas" após "QUALIDADE TÉCNICA" no Componente 1
data.components.customInstructions.content.html = data.components.customInstructions.content.html.replace(
  /(<h2>QUALIDADE TÉCNICA<\/h2>.*?)<h2>PESQUISA JURISPRUDENCIAL<\/h2>/s,
  `$1${ferramentasHTML}\n\n`
);

data.components.customInstructions.content.markdown = data.components.customInstructions.content.markdown.replace(
  /(## QUALIDADE TÉCNICA.*?)\n## PESQUISA JURISPRUDENCIAL/s,
  `$1\n\n${ferramentasMarkdown}\n\n## PESQUISA JURISPRUDENCIAL`
);

data.components.customInstructions.content.text = data.components.customInstructions.content.text.replace(
  /(═══════════════════════════════════════\nQUALIDADE TÉCNICA.*?)\n═══════════════════════════════════════\nPESQUISA JURISPRUDENCIAL/s,
  `$1\n\n${ferramentasText}\n\n═══════════════════════════════════════\nPESQUISA JURISPRUDENCIAL`
);

// Substituir seção "PESQUISA JURISPRUDENCIAL" por versão eficiente
data.components.customInstructions.content.html = data.components.customInstructions.content.html.replace(
  /<h2>PESQUISA JURISPRUDENCIAL<\/h2>.*?(?=<h2>|$)/s,
  pesquisaHTML
);

data.components.customInstructions.content.markdown = data.components.customInstructions.content.markdown.replace(
  /## PESQUISA JURISPRUDENCIAL.*?(?=\n##|$)/s,
  pesquisaMarkdown
);

data.components.customInstructions.content.text = data.components.customInstructions.content.text.replace(
  /═══════════════════════════════════════\nPESQUISA JURISPRUDENCIAL.*?(?=\n═══════════════════════════════════════|$)/s,
  pesquisaText
);

// Corrigir HTML dos Componentes 2 e 3
data.components.formattingMethod.content.html = fixHtmlTags(data.components.formattingMethod.content.html);
data.components.versioningMethod.content.html = fixHtmlTags(data.components.versioningMethod.content.html);

// ═══════════════════════════════════════════════════════
// RECALCULAR METADATA
// ═══════════════════════════════════════════════════════

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

data.version = "1.1";
data.lastUpdated = new Date().toISOString();
data.updatedBy = "claude_code";

// ═══════════════════════════════════════════════════════
// SALVAR ARQUIVO CORRIGIDO
// ═══════════════════════════════════════════════════════

fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');

console.log('✅ Custom Instructions corrigidas com sucesso!');
console.log(`📊 Nova versão: ${data.version}`);
console.log(`📝 Tokens estimados:`);
console.log(`   - Custom Instructions: ${data.components.customInstructions.metadata.estimatedTokens}`);
console.log(`   - Formatação: ${data.components.formattingMethod.metadata.estimatedTokens}`);
console.log(`   - Versionamento: ${data.components.versioningMethod.metadata.estimatedTokens}`);
console.log(`   - TOTAL: ${data.components.customInstructions.metadata.estimatedTokens + data.components.formattingMethod.metadata.estimatedTokens + data.components.versioningMethod.metadata.estimatedTokens}`);
