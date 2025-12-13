/**
 * ROM Agent - Servidor Web com Interface Amigável
 * Interface similar ao Claude.ai com marca personalizada
 */

import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { ROMAgent, CONFIG } from './index.js';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.static(path.join(__dirname, '../public')));

// Instância do agente
let agent = null;

// Inicializar agente
function initAgent() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (apiKey) {
    agent = new ROMAgent(apiKey);
    return true;
  }
  return false;
}

// Rota principal - Interface
app.get('/', (req, res) => {
  res.send(getHTML());
});

// API - Processar mensagem
app.post('/api/chat', async (req, res) => {
  try {
    if (!agent) {
      if (!initAgent()) {
        return res.status(500).json({ error: 'API Key não configurada' });
      }
    }

    const { message } = req.body;
    const resposta = await agent.processar(message);
    res.json({ response: resposta });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// API - Limpar histórico
app.post('/api/clear', (req, res) => {
  if (agent) {
    agent.limparHistorico();
  }
  res.json({ success: true });
});

// API - Listar prompts
app.get('/api/prompts', (req, res) => {
  if (agent) {
    res.json({ prompts: agent.listarPrompts() });
  } else {
    res.json({ prompts: [] });
  }
});

// API - Info do sistema
app.get('/api/info', (req, res) => {
  res.json({
    nome: CONFIG.nome,
    versao: CONFIG.versao,
    capacidades: CONFIG.capacidades
  });
});

// API - Página de downloads
app.get('/downloads', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/downloads.html'));
});

// API - Download de arquivos mobile
app.get('/api/download/:file', (req, res) => {
  const downloads = {
    'start-server': { path: '../mobile-access/scripts/start-server.sh', name: 'INICIAR-SERVIDOR.sh' },
    'start-ngrok': { path: '../mobile-access/scripts/start-ngrok.sh', name: 'ACESSO-INTERNET.sh' },
    'telegram-bot': { path: '../mobile-access/telegram-bot/bot.js', name: 'telegram-bot.js' },
    'render-yaml': { path: '../mobile-access/deploy/render.yaml', name: 'render.yaml' },
    'dockerfile': { path: '../mobile-access/deploy/Dockerfile', name: 'Dockerfile' },
    'railway-json': { path: '../mobile-access/deploy/railway.json', name: 'railway.json' },
    'readme': { path: '../mobile-access/README.md', name: 'README-Mobile.md' }
  };

  const file = downloads[req.params.file];
  if (file) {
    res.download(path.join(__dirname, file.path), file.name);
  } else {
    res.status(404).json({ error: 'Arquivo não encontrado' });
  }
});

// HTML da interface
function getHTML() {
  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>ROM - Redator de Obras Magistrais</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    :root {
      --primary: #1a365d;
      --primary-light: #2c5282;
      --secondary: #c9a227;
      --background: #f7fafc;
      --surface: #ffffff;
      --text: #1a202c;
      --text-light: #718096;
      --border: #e2e8f0;
      --success: #38a169;
      --error: #e53e3e;
    }

    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
      background: var(--background);
      color: var(--text);
      min-height: 100vh;
      display: flex;
      flex-direction: column;
    }

    /* Header */
    .header {
      background: linear-gradient(135deg, var(--primary) 0%, var(--primary-light) 100%);
      color: white;
      padding: 1rem 2rem;
      display: flex;
      align-items: center;
      justify-content: space-between;
      box-shadow: 0 2px 10px rgba(0,0,0,0.1);
    }

    .logo-container {
      display: flex;
      align-items: center;
      gap: 1rem;
    }

    .logo {
      width: 50px;
      height: 50px;
      background: white;
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 700;
      color: var(--primary);
      font-size: 1.5rem;
    }

    .brand h1 {
      font-size: 1.5rem;
      font-weight: 700;
      letter-spacing: -0.5px;
    }

    .brand p {
      font-size: 0.75rem;
      opacity: 0.8;
      margin-top: 2px;
    }

    .header-actions {
      display: flex;
      gap: 0.5rem;
    }

    .btn {
      padding: 0.5rem 1rem;
      border: none;
      border-radius: 8px;
      cursor: pointer;
      font-size: 0.875rem;
      font-weight: 500;
      transition: all 0.2s;
    }

    .btn-secondary {
      background: rgba(255,255,255,0.2);
      color: white;
    }

    .btn-secondary:hover {
      background: rgba(255,255,255,0.3);
    }

    /* Main Chat Area */
    .main {
      flex: 1;
      display: flex;
      flex-direction: column;
      max-width: 900px;
      margin: 0 auto;
      width: 100%;
      padding: 1rem;
    }

    .chat-container {
      flex: 1;
      overflow-y: auto;
      padding: 1rem;
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }

    .welcome {
      text-align: center;
      padding: 3rem 1rem;
    }

    .welcome-logo {
      width: 100px;
      height: 100px;
      background: linear-gradient(135deg, var(--primary) 0%, var(--primary-light) 100%);
      border-radius: 20px;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 1.5rem;
      color: white;
      font-size: 2.5rem;
      font-weight: 700;
    }

    .welcome h2 {
      font-size: 1.75rem;
      margin-bottom: 0.5rem;
      color: var(--primary);
    }

    .welcome p {
      color: var(--text-light);
      margin-bottom: 2rem;
    }

    .suggestions {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      gap: 0.75rem;
      max-width: 700px;
      margin: 0 auto;
    }

    .suggestion {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 1rem;
      text-align: left;
      cursor: pointer;
      transition: all 0.2s;
    }

    .suggestion:hover {
      border-color: var(--primary);
      box-shadow: 0 4px 12px rgba(26, 54, 93, 0.1);
    }

    .suggestion h4 {
      font-size: 0.875rem;
      color: var(--primary);
      margin-bottom: 0.25rem;
    }

    .suggestion p {
      font-size: 0.75rem;
      color: var(--text-light);
    }

    /* Messages */
    .message {
      display: flex;
      gap: 1rem;
      max-width: 100%;
    }

    .message-user {
      flex-direction: row-reverse;
    }

    .avatar {
      width: 36px;
      height: 36px;
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 600;
      font-size: 0.875rem;
      flex-shrink: 0;
    }

    .avatar-rom {
      background: linear-gradient(135deg, var(--primary) 0%, var(--primary-light) 100%);
      color: white;
    }

    .avatar-user {
      background: var(--secondary);
      color: white;
    }

    .message-content {
      background: var(--surface);
      border-radius: 12px;
      padding: 1rem;
      max-width: 80%;
      box-shadow: 0 1px 3px rgba(0,0,0,0.05);
    }

    .message-user .message-content {
      background: var(--primary);
      color: white;
    }

    .message-content p {
      white-space: pre-wrap;
      line-height: 1.6;
    }

    /* Input Area */
    .input-area {
      padding: 1rem;
      background: var(--surface);
      border-top: 1px solid var(--border);
    }

    .input-container {
      max-width: 900px;
      margin: 0 auto;
      display: flex;
      gap: 0.75rem;
      align-items: flex-end;
    }

    .input-wrapper {
      flex: 1;
      position: relative;
    }

    textarea {
      width: 100%;
      padding: 1rem;
      border: 2px solid var(--border);
      border-radius: 12px;
      font-size: 1rem;
      font-family: inherit;
      resize: none;
      min-height: 56px;
      max-height: 200px;
      transition: border-color 0.2s;
    }

    textarea:focus {
      outline: none;
      border-color: var(--primary);
    }

    .send-btn {
      width: 56px;
      height: 56px;
      background: var(--primary);
      color: white;
      border: none;
      border-radius: 12px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s;
    }

    .send-btn:hover {
      background: var(--primary-light);
    }

    .send-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .send-btn svg {
      width: 24px;
      height: 24px;
    }

    /* Footer */
    .footer {
      text-align: center;
      padding: 1rem;
      font-size: 0.75rem;
      color: var(--text-light);
    }

    .footer a {
      color: var(--primary);
      text-decoration: none;
    }

    /* Loading */
    .loading {
      display: flex;
      gap: 4px;
      padding: 0.5rem;
    }

    .loading span {
      width: 8px;
      height: 8px;
      background: var(--primary);
      border-radius: 50%;
      animation: bounce 1.4s infinite ease-in-out both;
    }

    .loading span:nth-child(1) { animation-delay: -0.32s; }
    .loading span:nth-child(2) { animation-delay: -0.16s; }

    @keyframes bounce {
      0%, 80%, 100% { transform: scale(0); }
      40% { transform: scale(1); }
    }

    /* Capacidades */
    .capacidades {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
      justify-content: center;
      margin-top: 1rem;
    }

    .capacidade {
      background: rgba(26, 54, 93, 0.1);
      color: var(--primary);
      padding: 0.25rem 0.75rem;
      border-radius: 20px;
      font-size: 0.7rem;
    }

    /* Responsive */
    @media (max-width: 768px) {
      .header {
        padding: 1rem;
      }

      .brand h1 {
        font-size: 1.25rem;
      }

      .suggestions {
        grid-template-columns: 1fr;
      }

      .message-content {
        max-width: 90%;
      }
    }
  </style>
</head>
<body>
  <header class="header">
    <div class="logo-container">
      <div class="logo">R</div>
      <div class="brand">
        <h1>ROM</h1>
        <p>Redator de Obras Magistrais</p>
      </div>
    </div>
    <div class="header-actions">
      <button class="btn btn-secondary" onclick="limparChat()">Nova Conversa</button>
    </div>
  </header>

  <main class="main">
    <div class="chat-container" id="chatContainer">
      <div class="welcome" id="welcome">
        <div class="welcome-logo">ROM</div>
        <h2>Bem-vindo ao ROM</h2>
        <p>Seu assistente especializado em redação de peças jurídicas</p>

        <div class="suggestions">
          <div class="suggestion" onclick="enviarSugestao('Redija uma petição inicial de indenização por danos morais')">
            <h4>📝 Petição Inicial</h4>
            <p>Indenização por danos morais</p>
          </div>
          <div class="suggestion" onclick="enviarSugestao('Elabore um habeas corpus por excesso de prazo')">
            <h4>⚖️ Habeas Corpus</h4>
            <p>Excesso de prazo na prisão</p>
          </div>
          <div class="suggestion" onclick="enviarSugestao('Busque jurisprudência do STJ sobre responsabilidade civil objetiva')">
            <h4>🔍 Jurisprudência</h4>
            <p>Pesquisa no STJ</p>
          </div>
          <div class="suggestion" onclick="enviarSugestao('Gere um resumo executivo completo (Camada 3) do processo anexado')">
            <h4>📊 Resumo Executivo</h4>
            <p>Análise completa de processo</p>
          </div>
        </div>

        <div class="capacidades">
          <span class="capacidade">Peças Cíveis</span>
          <span class="capacidade">Peças Criminais</span>
          <span class="capacidade">Peças Trabalhistas</span>
          <span class="capacidade">Contratos</span>
          <span class="capacidade">Jurisprudência</span>
          <span class="capacidade">Legislação</span>
          <span class="capacidade">Resumo Executivo</span>
          <span class="capacidade">Prequestionamento</span>
        </div>
      </div>
    </div>
  </main>

  <div class="input-area">
    <div class="input-container">
      <div class="input-wrapper">
        <textarea
          id="messageInput"
          placeholder="Digite sua mensagem ou descreva a peça que deseja redigir..."
          rows="1"
          onkeydown="handleKeyDown(event)"
          oninput="autoResize(this)"
        ></textarea>
      </div>
      <button class="send-btn" id="sendBtn" onclick="enviarMensagem()">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/>
        </svg>
      </button>
    </div>
  </div>

  <footer class="footer">
    <p>ROM v1.0 - Rodolfo Otávio Mota Advogados Associados | <a href="https://rom.adv.br" target="_blank">rom.adv.br</a></p>
  </footer>

  <script>
    const chatContainer = document.getElementById('chatContainer');
    const messageInput = document.getElementById('messageInput');
    const sendBtn = document.getElementById('sendBtn');
    const welcome = document.getElementById('welcome');

    function autoResize(el) {
      el.style.height = 'auto';
      el.style.height = Math.min(el.scrollHeight, 200) + 'px';
    }

    function handleKeyDown(e) {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        enviarMensagem();
      }
    }

    function enviarSugestao(texto) {
      messageInput.value = texto;
      enviarMensagem();
    }

    async function enviarMensagem() {
      const message = messageInput.value.trim();
      if (!message) return;

      // Esconder welcome
      if (welcome) {
        welcome.style.display = 'none';
      }

      // Adicionar mensagem do usuário
      addMessage(message, 'user');
      messageInput.value = '';
      messageInput.style.height = 'auto';

      // Mostrar loading
      const loadingId = addLoading();

      // Desabilitar botão
      sendBtn.disabled = true;

      try {
        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message })
        });

        const data = await response.json();

        // Remover loading
        removeLoading(loadingId);

        if (data.error) {
          addMessage('Erro: ' + data.error, 'rom');
        } else {
          addMessage(data.response, 'rom');
        }
      } catch (error) {
        removeLoading(loadingId);
        addMessage('Erro de conexão. Verifique se o servidor está rodando.', 'rom');
      }

      sendBtn.disabled = false;
      messageInput.focus();
    }

    function addMessage(text, sender) {
      const div = document.createElement('div');
      div.className = 'message message-' + sender;

      const avatarClass = sender === 'rom' ? 'avatar-rom' : 'avatar-user';
      const avatarText = sender === 'rom' ? 'R' : 'U';

      div.innerHTML = \`
        <div class="avatar \${avatarClass}">\${avatarText}</div>
        <div class="message-content">
          <p>\${escapeHtml(text)}</p>
        </div>
      \`;

      chatContainer.appendChild(div);
      chatContainer.scrollTop = chatContainer.scrollHeight;
    }

    function addLoading() {
      const id = 'loading-' + Date.now();
      const div = document.createElement('div');
      div.id = id;
      div.className = 'message message-rom';
      div.innerHTML = \`
        <div class="avatar avatar-rom">R</div>
        <div class="message-content">
          <div class="loading">
            <span></span>
            <span></span>
            <span></span>
          </div>
        </div>
      \`;
      chatContainer.appendChild(div);
      chatContainer.scrollTop = chatContainer.scrollHeight;
      return id;
    }

    function removeLoading(id) {
      const el = document.getElementById(id);
      if (el) el.remove();
    }

    function limparChat() {
      fetch('/api/clear', { method: 'POST' });
      chatContainer.innerHTML = '';
      if (welcome) {
        welcome.style.display = 'block';
        chatContainer.appendChild(welcome);
      }
    }

    function escapeHtml(text) {
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    }

    // Focus no input ao carregar
    messageInput.focus();
  </script>
</body>
</html>
`;
}

// Iniciar servidor
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════════════════════════════════╗
║                                                              ║
║   ██████╗  ██████╗ ███╗   ███╗                              ║
║   ██╔══██╗██╔═══██╗████╗ ████║                              ║
║   ██████╔╝██║   ██║██╔████╔██║                              ║
║   ██╔══██╗██║   ██║██║╚██╔╝██║                              ║
║   ██║  ██║╚██████╔╝██║ ╚═╝ ██║                              ║
║   ╚═╝  ╚═╝ ╚═════╝ ╚═╝     ╚═╝                              ║
║                                                              ║
║   Servidor Web Iniciado                                      ║
║   Acesse: http://localhost:${PORT}                            ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝
`);
});

export default app;
