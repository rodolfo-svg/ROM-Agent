/**
 * ROM Agent - Bot Telegram
 *
 * Permite usar o ROM Agent diretamente pelo Telegram
 *
 * CONFIGURAÇÃO:
 * 1. Fale com @BotFather no Telegram
 * 2. Crie um bot: /newbot
 * 3. Copie o token e coloque no .env: TELEGRAM_BOT_TOKEN=seu_token
 * 4. Execute: node mobile-access/telegram-bot/bot.js
 */

import TelegramBot from 'node-telegram-bot-api';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';

// Carregar .env
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../../.env') });

// Importar ROM Agent
import rom from '../../index.js';

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;

if (!TOKEN) {
  console.error(`
╔══════════════════════════════════════════════════════════════╗
║                 CONFIGURAÇÃO NECESSÁRIA                       ║
╚══════════════════════════════════════════════════════════════╝

1. Abra o Telegram e fale com @BotFather
2. Envie: /newbot
3. Siga as instruções e copie o TOKEN
4. Adicione no arquivo .env:
   TELEGRAM_BOT_TOKEN=seu_token_aqui

5. Execute novamente: node mobile-access/telegram-bot/bot.js
`);
  process.exit(1);
}

// Criar bot
const bot = new TelegramBot(TOKEN, { polling: true });

console.log(`
╔══════════════════════════════════════════════════════════════╗
║              ROM AGENT - BOT TELEGRAM                         ║
╚══════════════════════════════════════════════════════════════╝

Bot iniciado com sucesso!
Abra o Telegram e procure pelo seu bot.

Comandos disponíveis:
  /start    - Iniciar conversa
  /ajuda    - Ver comandos disponíveis
  /modelos  - Listar modelos de IA
  /extrair  - Enviar documento para extração
  /report   - Relatório de custos
`);

// Estado dos usuários
const userStates = new Map();

// Comando /start
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  const userName = msg.from.first_name || 'Usuário';

  bot.sendMessage(chatId, `
⚖️ *ROM Agent - Assistente Jurídico*

Olá, ${userName}! Sou o ROM Agent, seu assistente para redação de peças jurídicas.

*Comandos disponíveis:*
/ajuda - Ver todos os comandos
/modelos - Ver modelos de IA disponíveis
/extrair - Extrair texto de documento
/pecas - Tipos de peças disponíveis
/report - Relatório de custos

*Como usar:*
Envie sua solicitação em linguagem natural:
- "Elabore uma petição inicial de cobrança"
- "Preciso de um recurso de apelação"
- "Faça uma contestação trabalhista"

Ou envie um documento (PDF, DOCX, imagem) para extração gratuita!
`, { parse_mode: 'Markdown' });
});

// Comando /ajuda
bot.onText(/\/ajuda/, (msg) => {
  bot.sendMessage(msg.chat.id, `
📚 *Comandos ROM Agent*

*Informações:*
/modelos - Modelos de IA disponíveis
/pecas - Tipos de peças jurídicas
/report - Relatório de custos
/economia - Economia com extração local

*Ações:*
/extrair - Modo extração de documentos
/limpar - Limpar histórico

*Uso:*
Envie mensagens normalmente ou documentos (PDF, DOCX, imagens).
`, { parse_mode: 'Markdown' });
});

// Comando /modelos
bot.onText(/\/modelos/, (msg) => {
  bot.sendMessage(msg.chat.id, `
🤖 *Modelos Disponíveis*

*FAST* ($0.30/1M tokens)
└ Amazon Nova Lite
  Uso: Notificações, procurações

*STANDARD* ($2/1M tokens)
└ Amazon Nova Pro
  Uso: Petições simples, contratos

*PREMIUM* ($15/1M tokens)
└ Claude Sonnet 4.5
  Uso: Apelações, contestações

*ULTRA* ($60/1M tokens)
└ Claude Opus 4.5
  Uso: Recursos STF/STJ, HC

*VISION* ($4/1M tokens)
└ Pixtral Large
  Uso: Documentos escaneados

*RAG* ($5/1M tokens)
└ Cohere Command R+
  Uso: Busca em jurisprudência
`, { parse_mode: 'Markdown' });
});

// Comando /pecas
bot.onText(/\/pecas/, (msg) => {
  bot.sendMessage(msg.chat.id, `
📋 *Tipos de Peças Jurídicas*

*Simples (FAST):*
• Notificação extrajudicial
• Procuração
• Declaração

*Intermediárias (STANDARD):*
• Petição inicial
• Contrato
• Acordo

*Complexas (PREMIUM):*
• Contestação
• Apelação
• Agravo

*Especiais (ULTRA):*
• Recurso Especial
• Recurso Extraordinário
• Habeas Corpus
• Mandado de Segurança
`, { parse_mode: 'Markdown' });
});

// Comando /report
bot.onText(/\/report/, async (msg) => {
  try {
    const report = rom.monitor.generateReport();
    // Truncar se muito grande para Telegram
    const truncated = report.length > 4000 ? report.substring(0, 4000) + '\n...' : report;
    bot.sendMessage(msg.chat.id, '```\n' + truncated + '\n```', { parse_mode: 'Markdown' });
  } catch (e) {
    bot.sendMessage(msg.chat.id, '❌ Erro ao gerar relatório: ' + e.message);
  }
});

// Comando /economia
bot.onText(/\/economia/, async (msg) => {
  try {
    const report = rom.extractor.generateSavingsReport();
    const truncated = report.length > 4000 ? report.substring(0, 4000) + '\n...' : report;
    bot.sendMessage(msg.chat.id, '```\n' + truncated + '\n```', { parse_mode: 'Markdown' });
  } catch (e) {
    bot.sendMessage(msg.chat.id, '❌ Erro ao gerar relatório: ' + e.message);
  }
});

// Comando /extrair
bot.onText(/\/extrair/, (msg) => {
  userStates.set(msg.chat.id, 'waiting_document');
  bot.sendMessage(msg.chat.id, `
📄 *Modo Extração*

Envie um documento para extrair o texto:
• PDF
• DOCX/DOC
• Imagem (PNG, JPG)

A extração é *100% gratuita* (processamento local).
O texto extraído pode ser usado para gerar peças.
`, { parse_mode: 'Markdown' });
});

// Receber documentos
bot.on('document', async (msg) => {
  const chatId = msg.chat.id;
  const fileId = msg.document.file_id;
  const fileName = msg.document.file_name;

  bot.sendMessage(chatId, `📥 Recebendo: ${fileName}...`);

  try {
    // Baixar arquivo
    const filePath = await bot.downloadFile(fileId, '/tmp');

    bot.sendMessage(chatId, '🔄 Extraindo texto (custo: $0)...');

    // Extrair usando ROM Agent
    const result = await rom.prepareDocumentForAI(filePath);

    if (result.success) {
      // Enviar preview do texto
      const preview = result.text.substring(0, 3000);

      bot.sendMessage(chatId, `
✅ *Extração Concluída!*

📊 *Estatísticas:*
• Palavras: ${result.wordCount}
• Tokens: ${result.estimatedTokens}
• Economia: ${result.costSaved}
• Método: ${result.method}

📝 *Preview do texto:*
\`\`\`
${preview}${result.text.length > 3000 ? '\n...(truncado)' : ''}
\`\`\`

*Metadados extraídos:*
${JSON.stringify(result.metadados, null, 2).substring(0, 500)}
`, { parse_mode: 'Markdown' });
    } else {
      bot.sendMessage(chatId, `❌ Erro na extração: ${result.error}`);
    }
  } catch (e) {
    bot.sendMessage(chatId, `❌ Erro: ${e.message}`);
  }
});

// Receber fotos (OCR)
bot.on('photo', async (msg) => {
  const chatId = msg.chat.id;
  const photo = msg.photo[msg.photo.length - 1]; // Maior resolução

  bot.sendMessage(chatId, '📷 Processando imagem com OCR...');

  try {
    const filePath = await bot.downloadFile(photo.file_id, '/tmp');
    const result = await rom.prepareDocumentForAI(filePath);

    if (result.success) {
      const preview = result.text.substring(0, 3000);
      bot.sendMessage(chatId, `
✅ *OCR Concluído!*

• Palavras: ${result.wordCount}
• Confiança: ${result.confidence || 'N/A'}%

\`\`\`
${preview}
\`\`\`
`, { parse_mode: 'Markdown' });
    } else {
      bot.sendMessage(chatId, `❌ Erro no OCR: ${result.error}`);
    }
  } catch (e) {
    bot.sendMessage(chatId, `❌ Erro: ${e.message}`);
  }
});

// Mensagens de texto (solicitações)
bot.on('message', async (msg) => {
  // Ignorar comandos
  if (msg.text?.startsWith('/')) return;
  // Ignorar documentos e fotos (já tratados)
  if (msg.document || msg.photo) return;

  const chatId = msg.chat.id;
  const text = msg.text;

  if (!text) return;

  bot.sendMessage(chatId, '🔄 Processando sua solicitação...');

  // Aqui você pode integrar com a geração de peças
  // Por enquanto, mostrar roteamento
  try {
    // Detectar tipo de peça pela mensagem
    let pieceType = 'peticao_inicial';
    if (text.toLowerCase().includes('apela')) pieceType = 'apelação';
    else if (text.toLowerCase().includes('contesta')) pieceType = 'contestação';
    else if (text.toLowerCase().includes('recurso especial')) pieceType = 'recurso_especial';
    else if (text.toLowerCase().includes('habeas')) pieceType = 'habeas_corpus';
    else if (text.toLowerCase().includes('notifica')) pieceType = 'notificacao';

    const config = rom.processRequest(pieceType, null, { instruction: text });

    bot.sendMessage(chatId, `
📋 *Análise da Solicitação*

Tipo detectado: *${pieceType}*
Modelo: *${config.model}*
Tier: *${config.tier}*
Custo estimado: *${config.estimatedCost.estimatedCost}*

_Para gerar a peça completa, configure a API do Bedrock._
`, { parse_mode: 'Markdown' });
  } catch (e) {
    bot.sendMessage(chatId, `❌ Erro: ${e.message}`);
  }
});

// Tratamento de erros
bot.on('polling_error', (error) => {
  console.error('Erro de polling:', error.message);
});
