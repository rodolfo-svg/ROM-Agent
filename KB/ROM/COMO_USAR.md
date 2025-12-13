# 📚 KNOWLEDGE BASE ROM - Como Usar

## 🎯 Objetivo

Este diretório armazena as **peças paradigmas do Escritório ROM** para que a IA aprenda:
- ✍️ Técnica redacional do escritório
- 📋 Estrutura e formatação
- ⚖️ Estilo de argumentação jurídica
- 🎨 Tom e formalidade únicos do ROM

> **Importante:** Mesmo que as peças sejam de matérias diferentes, a IA aprende o ESTILO de redação do escritório!

---

## 📁 Estrutura de Pastas

```
KB/ROM/
├── modelos/          ← Suas melhores peças (qualquer matéria!)
├── legislacao/       ← Artigos de lei que você cita frequentemente
├── jurisprudencia/   ← Precedentes favoráveis que você usa
└── doutrina/         ← Artigos, livros, doutrinas de referência
```

---

## 🚀 Como Fazer Upload

### **Opção 1: Arrastar e Soltar (Mais Fácil)**

1. Acesse http://localhost:3000
2. Clique no botão **"📚 Knowledge Base ROM"**
3. Arraste seus arquivos PDF/DOCX para a área de upload
4. Pronto! O sistema extrai automaticamente (33 ferramentas, $0.00)

### **Opção 2: Pasta Automática (Recomendada)**

1. Copie suas peças para:
   ```
   /Users/rodolfootaviopereiradamotaoliveira/Desktop/ROM_Upload/
   ```

2. O sistema processa automaticamente em background
3. Após processar, move para `KB/` organizado

### **Opção 3: Diretamente na Pasta**

Copie manualmente para as pastas:
```bash
# Suas melhores peças
cp minhas_pecas/*.pdf KB/ROM/modelos/

# Legislação importante
cp codigos/*.pdf KB/ROM/legislacao/

# Jurisprudência relevante
cp precedentes/*.pdf KB/ROM/jurisprudencia/

# Doutrina de referência
cp artigos/*.pdf KB/ROM/doutrina/
```

---

## 📄 Formatos Aceitos

- ✅ PDF (`.pdf`)
- ✅ Word (`.docx`, `.doc`)
- ✅ Texto (`.txt`, `.md`)
- ✅ Imagens de documentos (`.jpg`, `.png`) - OCR automático

**Sem limite de tamanho!**
- ROM Agent: 100MB por arquivo, 20 arquivos por vez
- Claude.ai: apenas 25MB, 5 arquivos (4x menor!)

---

## 🎯 O Que Colocar em Cada Pasta

### 📋 `/modelos/` - Peças Paradigmas

Suas melhores peças de **qualquer matéria**:

- ✅ Petição Inicial que foi bem-sucedida
- ✅ Recurso que ganhou
- ✅ Contestação procedente
- ✅ Habeas Corpus concedido
- ✅ Mandado de Segurança deferido
- ✅ Parecer técnico aceito

**Dica:** Mesmo que sejam de áreas diferentes (cível, criminal, trabalhista), a IA aprende o ESTILO ROM!

### ⚖️ `/legislacao/` - Legislação Frequente

Leis/artigos que você cita com frequência:

- Código Civil (artigos mais usados)
- Código de Processo Civil
- Código Penal
- CLT
- Constituição Federal (artigos chave)
- Leis Especiais (Lei Maria da Penha, LGPD, etc)

### 📊 `/jurisprudencia/` - Precedentes Favoráveis

Decisões que você já usou com sucesso:

- Súmulas vinculantes
- Acórdãos do STF/STJ
- Jurisprudência dos TJs
- Precedentes vinculantes

### 📚 `/doutrina/` - Referências Teóricas

Artigos científicos, livros, capítulos:

- Artigos de doutrinadores renomados
- Capítulos de livros que você cita
- Pareceres técnicos de referência
- Teses e dissertações relevantes

---

## 🤖 Como a IA Usa o KB

Quando você conversa com o ROM Agent:

1. **Você pergunta:** "Redija uma petição inicial de indenização"

2. **IA automaticamente:**
   - 🔍 Busca em `/modelos/` suas melhores petições
   - 📖 Aprende o ESTILO de redação do ROM
   - ⚖️ Consulta jurisprudência em `/jurisprudencia/`
   - 📋 Verifica legislação aplicável em `/legislacao/`

3. **Resultado:** Peça no **estilo ROM**, não genérica!

---

## ✨ Vantagens do KB ROM

| Aspecto | Sem KB | Com KB ROM |
|---------|--------|------------|
| Estilo | Genérico | 100% estilo ROM |
| Argumentação | Básica | Baseada em casos de sucesso |
| Jurisprudência | Busca online | Precedentes já testados |
| Formatação | Padrão | Exatamente como você gosta |
| Velocidade | Lenta (busca externa) | Rápida (consulta local) |
| Custo | $$ busca API | $0.00 (já processado) |

---

## 🔄 Atualização Contínua

**Adicione novas peças sempre que:**
- ✅ Ganhar um caso importante
- ✅ Criar uma peça inovadora
- ✅ Encontrar precedente favorável novo
- ✅ Descobrir nova fundamentação jurídica

**A IA evolui junto com seu escritório!**

---

## 🔒 Privacidade e Segurança

- ✅ Todos os documentos ficam **localmente** no seu computador
- ✅ Nenhum arquivo é enviado para internet durante upload
- ✅ Extração 100% local (33 ferramentas gratuitas)
- ✅ Apenas as consultas à IA usam internet (criptografadas)

**Recomendação:** Anonimize nomes de clientes antes do upload para maior segurança.

---

## 📊 Monitoramento

Acompanhe o status do KB em:

**Dashboard:** http://localhost:3000/kb-monitor.html

Veja em tempo real:
- 📁 Quantos documentos processados
- 💾 Espaço utilizado
- ⚡ Performance do sistema
- 📊 Estatísticas de uso

---

## 🆘 Solução de Problemas

**"Meu documento não foi processado"**
- Verifique se o formato é aceito (PDF, DOCX, TXT)
- Tamanho máximo: 100MB por arquivo
- Confira logs em: `logs/upload-sync.log`

**"A IA não está consultando meu KB"**
- Use frases como: "baseado nos modelos do escritório"
- Ou: "consulte a Knowledge Base ROM"
- Ou simplesmente: "redija como o ROM faria"

**"Quero remover um documento"**
- Acesse: http://localhost:3000/knowledge-base.html
- Clique no documento
- Botão "Excluir"

---

## 📞 Precisa de Ajuda?

Sistema desenvolvido especialmente para **Rodolfo Otávio Mota Advogados Associados**

Dúvidas? Entre em contato com o desenvolvedor do ROM Agent.

---

**Última atualização:** 13/12/2025
**Versão:** 2.0.0
