# ROM Agent - Interface Web 🌐

Interface web moderna e completa para o ROM (Redator de Obras Magistrais), seu assistente jurídico com IA.

![ROM Agent Web](https://img.shields.io/badge/version-2.0-blue)
![Node.js](https://img.shields.io/badge/node-%3E%3D20.0.0-green)
![License](https://img.shields.io/badge/license-MIT-blue)

## ✨ Funcionalidades

### Interface Web Melhorada
- 🎨 **Design Moderno**: Interface similar ao Claude.ai com marca personalizada
- 🌓 **Tema Dark/Light**: Alternar entre temas claro e escuro
- 📱 **Responsivo**: Funciona perfeitamente em desktop, tablet e mobile
- ⚡ **Performance**: Animações suaves e carregamento rápido

### Recursos Avançados
- 📤 **Upload de Arquivos**: Suporte para PDF, DOCX e TXT (até 50MB)
- 💬 **Histórico Persistente**: Suas conversas são salvas automaticamente
- 📝 **Formatação Markdown**: Respostas formatadas com código, listas, tabelas
- 🔐 **Autenticação**: Sistema básico de login (expansível)
- 💾 **Sessões**: Cada usuário tem sua própria sessão isolada

### Capacidades do Agente
- ⚖️ Redação de peças jurídicas (cíveis, criminais, trabalhistas)
- 📚 Pesquisa de legislação nacional e internacional
- 🔍 Consulta de jurisprudência em todos os tribunais
- 📄 Análise e extração de processos judiciais
- ✍️ Correção ortográfica e gramatical
- 🎯 Formatação profissional com papel timbrado
- 📊 Criação de tabelas, fluxogramas e linhas do tempo
- 🔬 Busca de artigos científicos jurídicos

## 🚀 Início Rápido

### Pré-requisitos
- Node.js 20 ou superior
- Chave API da Anthropic (Claude)

### Instalação

```bash
# Clone o repositório
git clone https://github.com/seu-usuario/ROM-Agent.git
cd ROM-Agent

# Instale as dependências
npm install

# Configure a API Key
cp .env.example .env
# Edite .env e adicione: ANTHROPIC_API_KEY=sua_chave_aqui
```

### Executar

#### Versão Melhorada (Recomendado)
```bash
npm run web:enhanced
```

#### Versão Básica
```bash
npm run web
```

Acesse: **http://localhost:3000**

## 📖 Uso

### Interface Principal

1. **Iniciar Conversa**: Digite sua mensagem ou clique em uma sugestão
2. **Upload de Arquivo**: Clique no ícone 📎 para anexar PDF/DOCX
3. **Alternar Tema**: Clique no ícone 🌙/☀️ no header
4. **Nova Conversa**: Clique em "Nova Conversa" para limpar o histórico

### Exemplos de Uso

#### 1. Redação de Peças
```
Redija uma petição inicial de ação de indenização por danos morais
decorrentes de protesto indevido de título
```

#### 2. Pesquisa Jurisprudencial
```
Busque jurisprudência do STJ sobre responsabilidade civil objetiva
do estado por erro médico
```

#### 3. Análise de Documentos
```
[Anexe um PDF]
Analise este documento e extraia os principais argumentos jurídicos
```

#### 4. Consulta Legislativa
```
Qual o prazo para contestação em ação ordinária segundo o CPC?
```

## 🎨 Temas e Personalização

### Tema Dark/Light
O tema é salvo automaticamente no localStorage do navegador e persiste entre sessões.

### Personalizar Cores
Edite as variáveis CSS em `src/server-enhanced.js`:

```css
:root {
  --primary: #1a365d;        /* Azul escuro */
  --secondary: #c9a227;      /* Dourado */
  --background: #f7fafc;     /* Cinza claro */
  /* ... */
}
```

## 🔧 Configuração Avançada

### Variáveis de Ambiente

```bash
# .env
ANTHROPIC_API_KEY=sua_chave_aqui
PORT=3000
NODE_ENV=development
SESSION_SECRET=mude_isso_em_producao
```

### Limites de Upload

Por padrão, arquivos até 50MB são permitidos. Para alterar:

```javascript
// src/server-enhanced.js
const upload = multer({
  storage: storage,
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB
  // ...
});
```

### Autenticação

A versão atual tem autenticação básica demonstrativa:
- **Usuário**: admin / **Senha**: admin123
- **Usuário**: demo / **Senha**: demo123

Para produção, implemente JWT, OAuth2 ou outro sistema robusto.

## 📦 Scripts Disponíveis

```bash
npm run web              # Servidor básico
npm run web:enhanced     # Servidor melhorado (recomendado)
npm run cli              # Interface CLI
npm run dev              # Modo desenvolvimento (watch)
```

## 🌍 Deploy em Produção

Consulte [DEPLOY.md](DEPLOY.md) para instruções detalhadas de deploy em:
- Render (Grátis)
- Railway
- Vercel
- Heroku
- Docker
- VPS (EC2, DigitalOcean)

### Deploy Rápido no Render

1. Conecte seu repositório GitHub ao Render
2. Configure a variável `ANTHROPIC_API_KEY`
3. Deploy automático com `render.yaml`

## 🔒 Segurança

### Recomendações de Produção
- ✅ Use HTTPS (SSL/TLS)
- ✅ Configure rate limiting
- ✅ Implemente autenticação robusta (JWT/OAuth2)
- ✅ Use variáveis de ambiente seguras
- ✅ Mantenha dependências atualizadas
- ✅ Configure CORS adequadamente
- ✅ Adicione proteção CSRF
- ✅ Valide e sanitize inputs

### Não Fazer
- ❌ Commitar `.env` com chaves reais
- ❌ Usar autenticação básica em produção
- ❌ Expor erros detalhados aos usuários
- ❌ Permitir upload sem validação
- ❌ Usar HTTP em produção

## 🐛 Problemas Comuns

### Porta 3000 em uso
```bash
# Encontrar processo
lsof -i :3000

# Matar processo
kill -9 <PID>

# Ou usar outra porta
PORT=8080 npm run web:enhanced
```

### Erro de API Key
```bash
# Verificar variável
echo $ANTHROPIC_API_KEY

# Configurar (Linux/Mac)
export ANTHROPIC_API_KEY=sua_chave

# Configurar (Windows)
set ANTHROPIC_API_KEY=sua_chave
```

### Erro de Upload
```bash
# Verificar e criar pasta
mkdir -p upload
chmod 755 upload
```

## 📊 Estrutura do Projeto

```
ROM-Agent/
├── src/
│   ├── server.js              # Servidor básico
│   ├── server-enhanced.js     # Servidor melhorado ⭐
│   ├── index.js               # Agente principal
│   ├── cli.js                 # Interface CLI
│   └── modules/               # Módulos do agente
├── public/                    # Arquivos estáticos
├── upload/                    # Uploads de usuários
├── config/                    # Configurações
├── package.json
├── Dockerfile                 # Container Docker
├── render.yaml               # Config Render
├── railway.json              # Config Railway
├── vercel.json               # Config Vercel
├── DEPLOY.md                 # Guia de deploy
└── README.md                 # Este arquivo
```

## 🤝 Contribuindo

Contribuições são bem-vindas! Por favor:

1. Fork o projeto
2. Crie uma branch (`git checkout -b feature/nova-funcionalidade`)
3. Commit suas mudanças (`git commit -m 'Adiciona nova funcionalidade'`)
4. Push para a branch (`git push origin feature/nova-funcionalidade`)
5. Abra um Pull Request

## 📝 Roadmap

### Em Desenvolvimento
- [ ] Streaming real-time de respostas (SSE/WebSocket)
- [ ] Sistema de plugins
- [ ] Múltiplos idiomas
- [ ] Exportar conversas (PDF/DOCX)
- [ ] Busca no histórico

### Futuro
- [ ] Integração com WhatsApp/Telegram
- [ ] API REST pública
- [ ] Sistema de templates
- [ ] Colaboração em tempo real
- [ ] Analytics avançado

## 📄 Licença

MIT License - Veja [LICENSE](LICENSE) para detalhes.

## 👤 Autor

**Rodolfo Otávio Mota**
- Website: [rom.adv.br](https://rom.adv.br)
- OAB/GO: 21.841
- GitHub: [@seu-usuario](https://github.com/seu-usuario)

## 🙏 Agradecimentos

- [Anthropic](https://anthropic.com) - Claude AI
- [Express.js](https://expressjs.com)
- [Marked.js](https://marked.js.org)
- Comunidade Open Source

---

**⚠️ Nota**: Este projeto é para fins educacionais. Para uso em produção com dados sensíveis, implemente medidas de segurança adicionais e consulte um especialista.

**💡 Dica**: Para melhor experiência, use navegadores modernos (Chrome, Firefox, Safari, Edge).
