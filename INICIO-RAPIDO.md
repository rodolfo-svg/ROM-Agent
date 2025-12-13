# 🚀 Início Rápido - ROM Agent Web

Guia prático para começar a usar o ROM Agent Web em 5 minutos.

## ⚡ Quick Start

### 1. Iniciar o Servidor

```bash
cd ROM-Agent
npm run web:enhanced
```

### 2. Acessar

Abra seu navegador em: **http://localhost:3000**

## 🎨 Usar Sua Logomarca

Sua logomarca do escritório **Rodolfo Otávio Mota** já está integrada! 🎉

Ela aparece automaticamente:
- ✅ No header da página
- ✅ Na tela de boas-vindas
- ✅ Em todos os lugares do sistema

## 👥 Cadastrar Parceiros

### Via Interface Web (Mais Fácil)

1. Acesse: http://localhost:3000/admin-partners.html
2. Preencha o formulário com dados do parceiro
3. Clique em "Cadastrar Parceiro"
4. Clique em "📤 Upload Logo" para enviar a logomarca
5. Pronto!

### Via API (Para desenvolvedores)

```bash
# 1. Cadastrar parceiro
curl -X POST http://localhost:3000/api/partners \
  -H "Content-Type: application/json" \
  -d '{
    "fullName": "Silva & Associados Advocacia",
    "tagline": "Especialistas em Direito Civil",
    "oab": "OAB/SP 12345",
    "email": "contato@silva.adv.br"
  }'

# 2. Upload da logo
curl -X POST http://localhost:3000/api/partners/silva-associados-advocacia/logo \
  -F "logo=@/caminho/para/logo.png"
```

## 📤 Usar com Arquivos

1. Clique no ícone de clipe 📎
2. Selecione um PDF, DOCX ou TXT
3. Digite sua pergunta
4. Envie

**Exemplo:**
- Anexe um PDF de processo
- Digite: "Faça um resumo executivo completo deste processo"
- Receba análise detalhada!

## 🎨 Alternar Tema

Clique no ícone 🌙 (ou ☀️) no header para alternar entre tema claro e escuro.

## 🔐 Login (Opcional)

O sistema tem autenticação básica demonstrativa:
- Usuário: `admin` / Senha: `admin123`
- Usuário: `demo` / Senha: `demo123`

## 📋 Comandos Úteis

```bash
# Servidor melhorado (recomendado)
npm run web:enhanced

# Servidor básico
npm run web

# CLI (linha de comando)
npm run cli

# Ver logs
tail -f logs/*.log
```

## 🌍 Deploy Online (Grátis)

### Render (Mais Fácil)

1. Push para GitHub
2. Acesse https://render.com
3. "New +" → "Web Service"
4. Conecte seu repositório
5. Adicione variável: `ANTHROPIC_API_KEY=sua_chave`
6. Deploy!

Consulte `DEPLOY.md` para mais opções.

## 📊 Estrutura de Pastas

```
ROM-Agent/
├── public/
│   ├── img/
│   │   ├── logo_rom.png           ← Sua logo
│   │   └── partners/               ← Logos de parceiros
│   └── admin-partners.html         ← Interface de admin
├── src/
│   └── server-enhanced.js          ← Servidor principal
├── lib/
│   └── partners-branding.js        ← Gerenciamento de parceiros
├── config/
│   └── partners-branding.json      ← Dados dos parceiros
└── upload/                         ← Arquivos enviados
```

## 🆘 Problemas Comuns

### Porta 3000 em uso

```bash
PORT=8080 npm run web:enhanced
```

### API Key não configurada

```bash
# Adicione no arquivo .env
ANTHROPIC_API_KEY=sua_chave_aqui
```

### Erro ao carregar logo

```bash
# Verifique se os arquivos existem
ls -la public/img/logo_rom.png
ls -la public/img/partners/
```

## 📖 Documentação Completa

- **IMPLEMENTADO.md** - Tudo que foi feito
- **BRANDING-GUIDE.md** - Sistema de parceiros
- **DEPLOY.md** - Como fazer deploy
- **WEB-README.md** - Guia completo da interface
- **README.md** - Documentação geral

## 🎯 Próximos Passos

1. ✅ Teste o chat com sua API key
2. ✅ Cadastre um parceiro de teste
3. ✅ Faça upload de uma logo teste
4. ✅ Teste com arquivos PDF
5. ✅ Faça deploy no Render (grátis)

## 💡 Dicas

- Use Chrome, Firefox ou Safari para melhor experiência
- Logos funcionam melhor em formato PNG com fundo transparente
- O sistema salva seu tema (dark/light) automaticamente
- Histórico de conversas é salvo por 7 dias
- Arquivos ficam em `upload/` (faça backup regularmente)

---

**Pronto! Você está usando o ROM Agent! 🎉**

Se tiver dúvidas, consulte os arquivos de documentação ou entre em contato.

**Email:** contato@rom.adv.br
**Website:** rom.adv.br
