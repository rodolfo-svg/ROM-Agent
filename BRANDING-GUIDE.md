# Guia do Sistema de Branding Multi-Parceiros

## 🎨 Visão Geral

O ROM Agent agora possui um sistema completo de branding que permite que cada escritório parceiro tenha sua própria identidade visual (logomarca, cores, nome).

## ✨ Funcionalidades Implementadas

### 1. **Logomarca ROM Integrada** ✅
- Logo real do escritório Rodolfo Otávio Mota aplicada
- Exibida no header e tela de boas-vindas
- Arquivos: `public/img/logo_rom.png` e `public/img/timbrado_header_LIMPO.png`

### 2. **Sistema de Gerenciamento de Parceiros** ✅
- Cadastro de parceiros com informações completas
- Armazenamento em JSON (`config/partners-branding.json`)
- CRUD completo via API REST

### 3. **Upload de Logos por Parceiro** ✅
- Upload de PNG, JPG, SVG (máx 5MB)
- Armazenamento em `public/img/partners/`
- Validação de formato e tamanho

### 4. **Branding Dinâmico** ✅
- Logo carregada dinamicamente baseada no parceiro logado
- Personalização de cores, nome, tagline
- Fallback para ROM se não houver logo do parceiro

## 📁 Estrutura de Arquivos

```
ROM-Agent/
├── lib/
│   └── partners-branding.js          # Gerenciador de branding
├── src/
│   └── server-enhanced.js            # Servidor com rotas de branding
├── public/
│   └── img/
│       ├── logo_rom.png              # Logo ROM (padrão)
│       ├── timbrado_header_LIMPO.png # Logo timbrada ROM
│       └── partners/                 # Logos dos parceiros
│           ├── parceiro1-logo.png
│           ├── parceiro2-logo.png
│           └── ...
└── config/
    └── partners-branding.json        # Dados dos parceiros
```

## 🔌 API Endpoints

### Branding

#### Obter branding do parceiro atual
```http
GET /api/branding?partnerId=parceiro-id
```

Resposta:
```json
{
  "id": "rom",
  "name": "ROM",
  "fullName": "Rodolfo Otávio Mota",
  "tagline": "Redator de Obras Magistrais",
  "subtitle": "Seu assistente especializado em redação de peças jurídicas",
  "logo": "/img/logo_rom.png",
  "logoHeader": "/img/timbrado_header_LIMPO.png",
  "colors": {
    "primary": "#1a365d",
    "primaryLight": "#2c5282",
    "secondary": "#c9a227"
  },
  "oab": "OAB/GO 21.841",
  "email": "contato@rom.adv.br",
  "website": "https://rom.adv.br"
}
```

### Parceiros (Admin)

#### Listar todos os parceiros
```http
GET /api/partners
```

#### Cadastrar novo parceiro
```http
POST /api/partners
Content-Type: application/json

{
  "fullName": "Silva & Associados",
  "tagline": "Advogados Especializados",
  "subtitle": "Assistente jurídico para seu escritório",
  "oab": "OAB/SP 12345",
  "email": "contato@silva.adv.br",
  "website": "https://silva.adv.br",
  "colors": {
    "primary": "#2d3748",
    "primaryLight": "#4a5568",
    "secondary": "#ed8936"
  }
}
```

#### Atualizar parceiro
```http
PUT /api/partners/:partnerId
Content-Type: application/json

{
  "tagline": "Nova tagline atualizada"
}
```

#### Deletar parceiro
```http
DELETE /api/partners/:partnerId
```

#### Upload de logo do parceiro
```http
POST /api/partners/:partnerId/logo
Content-Type: multipart/form-data

logo: [arquivo PNG/JPG/SVG]
```

## 🚀 Como Usar

### Para Administradores ROM

#### 1. Cadastrar Novo Parceiro

```bash
curl -X POST http://localhost:3000/api/partners \
  -H "Content-Type: application/json" \
  -d '{
    "fullName": "Costa Advocacia",
    "tagline": "Especialistas em Direito Civil",
    "oab": "OAB/RJ 54321",
    "email": "contato@costa.adv.br"
  }'
```

#### 2. Fazer Upload da Logo

```bash
curl -X POST http://localhost:3000/api/partners/costa-advocacia/logo \
  -F "logo=@/caminho/para/logo.png"
```

#### 3. Associar Parceiro ao Usuário

No sistema de autenticação, quando um usuário do parceiro fizer login, defina:

```javascript
req.session.partnerId = 'costa-advocacia';
req.session.username = 'usuario@costa.adv.br';
```

### Para Parceiros

Os parceiros podem ter uma interface de administração onde:

1. **Visualizar seus dados**
   ```javascript
   fetch('/api/branding?partnerId=seu-id')
     .then(res => res.json())
     .then(data => console.log(data));
   ```

2. **Fazer upload de logo**
   ```html
   <form id="uploadLogoForm">
     <input type="file" name="logo" accept=".png,.jpg,.svg">
     <button type="submit">Enviar Logo</button>
   </form>

   <script>
   document.getElementById('uploadLogoForm').addEventListener('submit', async (e) => {
     e.preventDefault();
     const formData = new FormData(e.target);

     const response = await fetch('/api/partners/seu-id/logo', {
       method: 'POST',
       body: formData
     });

     const result = await response.json();
     console.log('Logo atualizada:', result.logoUrl);
   });
   </script>
   ```

## 💻 Exemplo de Uso no Frontend

### Carregar Branding Dinamicamente

Adicione este código no JavaScript do frontend (já preparado no server-enhanced.js):

```javascript
// Carregar branding do parceiro atual
async function loadBranding() {
  try {
    const response = await fetch('/api/branding');
    const branding = await response.json();

    // Atualizar logos
    document.getElementById('headerLogo').src = branding.logo;
    document.getElementById('welcomeLogo').src = branding.logo;

    // Atualizar textos
    document.getElementById('brandName').textContent = branding.name;
    document.getElementById('brandTagline').textContent = branding.tagline;
    document.getElementById('welcomeTitle').textContent = `Bem-vindo ao ${branding.name}`;
    document.getElementById('welcomeSubtitle').textContent = branding.subtitle;

    // Atualizar cores (opcional)
    if (branding.colors) {
      document.documentElement.style.setProperty('--primary', branding.colors.primary);
      document.documentElement.style.setProperty('--primary-light', branding.colors.primaryLight);
      document.documentElement.style.setProperty('--secondary', branding.colors.secondary);
    }

    // Atualizar título da página
    document.title = `${branding.name} - ${branding.tagline}`;

  } catch (error) {
    console.error('Erro ao carregar branding:', error);
    // Usar valores padrão ROM se falhar
  }
}

// Carregar ao iniciar
loadBranding();
```

## 🎨 Personalização Avançada

### Cores Customizadas

Cada parceiro pode ter suas próprias cores:

```json
{
  "colors": {
    "primary": "#1a365d",
    "primaryLight": "#2c5282",
    "secondary": "#c9a227"
  }
}
```

As cores são aplicadas via CSS Variables:
- `--primary`: Cor principal (header, botões)
- `--primary-light`: Cor principal clara (hover)
- `--secondary`: Cor secundária (destaques)

### Logo Requirements

**Formato recomendado:**
- PNG com fundo transparente (melhor opção)
- SVG (escalável, ideal)
- JPG (última opção, precisa fundo branco)

**Tamanho:**
- Largura: 150-300px
- Altura: 40-100px
- Peso: Máximo 5MB
- Formato horizontal funciona melhor

**Dica:** Use logos em alta resolução (2x ou 3x) para telas Retina.

## 🛡️ Segurança

### TODO: Implementar Autenticação Admin

Atualmente, as rotas de admin estão abertas. Para produção, adicione:

```javascript
// Middleware de verificação de admin
function requireAdmin(req, res, next) {
  if (!req.session.authenticated || !req.session.isAdmin) {
    return res.status(403).json({ error: 'Acesso negado' });
  }
  next();
}

// Aplicar nas rotas
app.post('/api/partners', requireAdmin, (req, res) => {
  // ...
});
```

### TODO: Permitir Parceiro Atualizar Própria Logo

```javascript
function requirePartnerAccess(req, res, next) {
  const { partnerId } = req.params;
  const userPartnerId = req.session.partnerId;
  const isAdmin = req.session.isAdmin;

  if (!isAdmin && userPartnerId !== partnerId) {
    return res.status(403).json({ error: 'Acesso negado' });
  }
  next();
}

app.post('/api/partners/:partnerId/logo', requirePartnerAccess, uploadLogo.single('logo'), (req, res) => {
  // ...
});
```

## 📊 Estrutura de Dados

### Arquivo `config/partners-branding.json`

```json
{
  "rom": {
    "id": "rom",
    "name": "ROM",
    "fullName": "Rodolfo Otávio Mota",
    "tagline": "Redator de Obras Magistrais",
    "subtitle": "Seu assistente especializado em redação de peças jurídicas",
    "logo": "/img/logo_rom.png",
    "logoHeader": "/img/timbrado_header_LIMPO.png",
    "colors": {
      "primary": "#1a365d",
      "primaryLight": "#2c5282",
      "secondary": "#c9a227"
    },
    "oab": "OAB/GO 21.841",
    "email": "contato@rom.adv.br",
    "website": "https://rom.adv.br"
  },
  "silva-associados": {
    "id": "silva-associados",
    "name": "Silva",
    "fullName": "Silva & Associados",
    "tagline": "Advogados Especializados",
    "subtitle": "Assistente jurídico para seu escritório",
    "logo": "/img/partners/silva-associados-logo.png",
    "logoHeader": "/img/partners/silva-associados-logo.png",
    "colors": {
      "primary": "#2d3748",
      "primaryLight": "#4a5568",
      "secondary": "#ed8936"
    },
    "oab": "OAB/SP 12345",
    "email": "contato@silva.adv.br",
    "website": "https://silva.adv.br",
    "createdAt": "2025-12-13T02:00:00.000Z",
    "active": true
  }
}
```

## 🔄 Fluxo de Trabalho Completo

### Onboarding de Novo Parceiro

1. **Admin ROM cadastra parceiro**
   - POST `/api/partners` com dados básicos
   - Sistema gera ID automático
   - Parceiro criado com logo padrão ROM

2. **Parceiro recebe credenciais**
   - Email com instruções
   - Link para upload de logo
   - Documentação de uso

3. **Parceiro faz upload da logo**
   - Acessa interface de configuração
   - Upload da logo do escritório
   - Preview antes de salvar

4. **Usuários do parceiro fazem login**
   - Sistema identifica parceiro pelo domínio de email
   - Carrega branding automático
   - Interface personalizada

5. **Parceiro usa o sistema**
   - Logo aparece em todas as páginas
   - Documentos gerados com logo do parceiro
   - Branding consistente em todo sistema

## 🎯 Próximos Passos Recomendados

1. **Interface Web de Administração**
   - Criar página `/admin/partners`
   - Formulário para cadastro visual
   - Lista de parceiros com edição inline
   - Preview de branding em tempo real

2. **Auto-identificação de Parceiro**
   - Identificar parceiro por domínio de email
   - Ex: `usuario@silva.adv.br` → Parceiro "silva-associados"
   - Configurar mapeamento de domínios

3. **Branding em Documentos**
   - Aplicar logo do parceiro em PDFs gerados
   - Cabeçalho e rodapé personalizados
   - Papel timbrado automático

4. **Temas por Parceiro**
   - Além de cores, permitir temas completos
   - Dark mode personalizado por parceiro
   - Fontes customizadas

5. **Analytics por Parceiro**
   - Dashboard de uso por parceiro
   - Métricas de geração de documentos
   - Relatórios personalizados

## 📞 Suporte

Para dúvidas ou problemas:
- Email: contato@rom.adv.br
- Issues: GitHub do projeto
- Documentação: README e DEPLOY.md

---

**Sistema criado por Rodolfo Otávio Mota - OAB/GO 21.841**
