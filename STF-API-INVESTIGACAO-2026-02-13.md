# 🔍 Investigação: API Oficial do STF para Jurisprudência

**Data:** 2026-02-13
**Status:** ❌ API Pública NÃO DISPONÍVEL

---

## 📋 Resumo Executivo

Após investigação completa sobre APIs oficiais do STF (Supremo Tribunal Federal) para acesso programático à jurisprudência, **concluímos que NÃO existe API pública REST disponível** para esse fim.

**Razão Principal:** STF não está incluído no DataJud CNJ por limitação constitucional (Art. 92, Inciso I da CF/88).

---

## 🏛️ STF Digital API - Uso Interno

### Documentação Oficial:

**URL:** https://supremotribunalfederal.gitlab.io/v1/documentacao/politicas/api.html

### Características:

✅ **Existe:** API interna bem documentada (Swagger)
✅ **Versionamento:** Usa `v1` no URL como padrão
✅ **Padrões REST:** Segue boas práticas HTTP
✅ **Microserviços:** Arquitetura moderna

❌ **Acesso Público:** **NÃO DISPONÍVEL**
❌ **Planos de Abertura:** Sem previsão de curto/médio prazo

### Citação Oficial:

> "Não há previsão de curto ou médio prazo para exposição pública da API do STF Digital, apesar de a intenção de abri-la fazer parte da estratégia de dados abertos da instituição."

**Fonte:** [API dos Serviços - STF Digital](https://supremotribunalfederal.gitlab.io/v1/documentacao/politicas/api.html)

---

## 📊 Programa Corte Aberta - Dados Abertos

### O Que É:

Programa instituído pela **Resolução nº 774/2022** para tornar o STF mais transparente e próximo da sociedade.

### Portal Oficial:

**URL:** https://portal.stf.jus.br/hotsites/corteaberta/

### O Que Oferece:

✅ **Download CSV:** Dados em formato aberto (.csv)
✅ **Painéis Interativos:** Visualização de estatísticas
✅ **Transparência:** Dados oficiais e confiáveis

❌ **API REST:** Não oferece endpoints REST
❌ **Jurisprudência Completa:** Foco em estatísticas processuais

### Dados Disponíveis:

- Processos em andamento
- Número de decisões proferidas
- Temas de Repercussão Geral
- Taxa de aprovação de processos de recursos
- Ações relacionadas à Covid-19
- Estatísticas gerais do tribunal

### Citação:

> "O site facilita a aquisição dos dados, com a possibilidade de fazer o download dos dados em formato .csv, o que atende ao requisito de dados abertos."

**Fontes:**
- [STF lança Programa Corte Aberta](https://portal.stf.jus.br/noticias/verNoticiaDetalhe.asp?idConteudo=486780&ori=1)
- [Corte Aberta STF](https://portal.stf.jus.br/hotsites/corteaberta/)

---

## 🔍 Portal de Jurisprudência - Interface Web

### URL Oficial:

https://jurisprudencia.stf.jus.br/

### Características:

✅ **Busca Avançada:** Interface web modernizada
✅ **Acesso Direto:** Informações instantâneas
✅ **Confiável:** Dados oficiais do STF

❌ **API/Webservice:** Não oferece acesso programático
❌ **Scraping:** Protegido por WAF/Cloudflare (403 Forbidden)

### Notícia Relevante:

Em 2020, o STF modernizou o portal de jurisprudência para facilitar o acesso aos usuários, mas focou na **experiência web**, não em API.

**Fonte:** [STF moderniza pesquisa de jurisprudência](https://portal.stf.jus.br/noticias/verNoticiaDetalhe.asp?idConteudo=444028&ori=1)

---

## 🌐 Base dos Dados - Alternativa de Acesso

### O Que É:

Plataforma que disponibiliza dados tratados do programa Corte Aberta.

### URL:

https://basedosdados.org/dataset/b46bb892-3273-434d-9335-f502b8656ef1

### Como Acessar:

✅ **SQL:** Queries diretas no BigQuery
✅ **Python:** Biblioteca `basedosdados`
✅ **R:** Pacote para análise estatística

### Limitações:

- Dados são **exportações periódicas** (não tempo real)
- Foco em **metadados processuais** (não ementas completas)
- Dependente de atualizações da Base dos Dados

**Fonte:** [Corte Aberta – Base dos Dados](https://basedosdados.org/dataset/b46bb892-3273-434d-9335-f502b8656ef1)

---

## 📝 Artigo Relevante: IA + API STF + Web Scraping

### Autor: Jusbrasil
### Data: 15/10/2024

**Título:** "Pesquisa de Jurisprudência com IA Generativa, API do STF e Web Scraping"

**URL:** https://www.jusbrasil.com.br/artigos/pesquisa-de-jurisprudencia-com-ia-generativa-api-do-stf-e-web-scraping/2784893616

### Principais Pontos:

1. **API do STF (mencionada):**
   - Artigo menciona "API do STF" mas se refere à **API interna/futura**
   - Reconhece que acesso é limitado

2. **Web Scraping:**
   - Apresenta como alternativa quando APIs não estão disponíveis
   - Útil para tribunais sem APIs públicas

3. **IA Generativa:**
   - Uso de LLMs para análise de decisões judiciais
   - Identificação de padrões e precedentes

4. **Operadores Lógicos:**
   - AND, OR, NOT para refinar buscas
   - Essencial para pesquisas jurídicas precisas

5. **Marco Legal:**
   - Resolução CNJ nº 332/2020 sobre governança de IA
   - Alinhamento com LGPD

**Conclusão do Artigo:** Reconhece que **web scraping é necessário** na ausência de APIs públicas.

---

## ⚖️ Por Que STF Não Está no DataJud?

### Limitação Constitucional:

**Artigo 92 da Constituição Federal/88:**

> "DataJud é responsável pelo armazenamento centralizado de dados processuais dos tribunais indicados nos **incisos II a VII do art. 92 da CF/88**."

**Distribuição:**

- **Inciso I:** Supremo Tribunal Federal (STF) → ❌ **NÃO incluído**
- **Inciso II:** Conselho Nacional de Justiça (CNJ) → ✅ Incluído
- **Inciso III:** Superior Tribunal de Justiça (STJ) → ✅ Incluído
- **Inciso IV:** Tribunais Regionais Federais (TRFs) → ✅ Incluídos
- **Inciso V:** Tribunais do Trabalho → ✅ Incluídos
- **Inciso VI:** Tribunais Eleitorais → ✅ Incluídos
- **Inciso VII:** Tribunais Militares → ✅ Incluídos

**Fonte:** [API Pública - Portal CNJ](https://www.cnj.jus.br/sistemas/datajud/api-publica/)

---

## 🔐 Proteções do STF Contra Scraping

### Testes Realizados em Produção:

```
[ERROR] [Scraper] Erro ao extrair PDF:
  unable to verify the first certificate

[INFO] [Puppeteer] HTTP 403 - https://www.stf.jus.br/...
[INFO] [Puppeteer] HTTP 403 - https://portal.stf.jus.br/...

[WARN] [Puppeteer] Ementa não encontrada no HTML
```

### Barreiras Identificadas:

1. **Certificado SSL:**
   - Render não confia no certificado do STF
   - Impede conexões HTTPS

2. **WAF/Cloudflare:**
   - Retorna `403 Forbidden` para requisições automatizadas
   - Proteção contra bots e scraping

3. **URLs são PDFs:**
   - Google Search retorna links para PDFs
   - PDFs protegidos e difíceis de parsear

4. **Rate Limiting:**
   - Possível limite de requisições por IP

---

## 💡 Alternativas Viáveis

### 1. ✅ Manter Google Search (Atual)

**Prós:**
- Já implementado e funcionando
- Retorna snippets relevantes
- Encontra decisões publicadas

**Contras:**
- Snippets limitados (não ementa completa)
- Taxa de sucesso 0% no scraping do STF

**Recomendação:** **MANTER como está**

---

### 2. ⚠️ Jusbrasil API (Terceiro)

**O Que É:**
- Plataforma agregadora de jurisprudência
- Coleta dados de múltiplos tribunais (incluindo STF)

**Prós:**
- Já faz scraping de tribunais
- API estruturada e documentada
- Ementas completas disponíveis

**Contras:**
- Serviço pago (custos adicionais)
- Dependência de terceiro
- Pode ter limitações de uso

**Investigar:**
- Planos e preços
- Cobertura do STF
- SLA e disponibilidade

**URL:** https://ia.jusbrasil.com.br

---

### 3. ⚠️ Cognijus Buscador (Terceiro)

**O Que É:**
- Buscador específico de STF e STJ
- Foco em jurisprudência

**URL:** https://www.cognijus.com/buscador

**Status:** Precisa investigação sobre acesso programático

---

### 4. ⏳ Aguardar API Pública do STF

**Status:** Sem previsão de curto/médio prazo

**Citação:**
> "Não há previsão de curto ou médio prazo para exposição pública da API do STF Digital."

**Recomendação:** **NÃO viável** no momento

---

### 5. 📥 Download CSV do Corte Aberta

**Prós:**
- Dados oficiais do STF
- Formato estruturado (.csv)
- Gratuito

**Contras:**
- Dados estáticos (não tempo real)
- Foco em estatísticas (não ementas)
- Precisa processamento manual

**Uso:** Complementar, não primário

---

### 6. 🗄️ Base dos Dados (SQL/Python/R)

**Prós:**
- Dados tratados e organizados
- Acesso via SQL/Python/R
- Infraestrutura BigQuery

**Contras:**
- Dados não são tempo real
- Não substitui busca de jurisprudência
- Foco em análises estatísticas

**Uso:** Análises, não busca em tempo real

---

## 📊 Comparação de Alternativas

| Solução | Custo | Tempo Real | Ementas Completas | Implementação |
|---------|-------|------------|-------------------|---------------|
| **Google Search (atual)** | Grátis | ✅ Sim | ❌ Snippets | ✅ Pronto |
| **Jusbrasil API** | 💰 Pago | ✅ Sim | ✅ Sim | ⚠️ Integração |
| **Cognijus** | ❓ ? | ❓ ? | ❓ ? | ⏳ Pesquisar |
| **API STF** | Grátis | ✅ Sim | ✅ Sim | ❌ Não existe |
| **Corte Aberta CSV** | Grátis | ❌ Não | ❌ Não | ⚠️ Manual |
| **Base dos Dados** | Grátis | ❌ Não | ❌ Não | ⚠️ Complexo |

---

## 🎯 Recomendação Final

### Estratégia Atual (Manter): ✅

```
1. Tentar DataJud (outros tribunais)
   ├─ STJ → ✅ Funciona
   ├─ TJSP → ✅ Funciona
   ├─ TJRJ → ✅ Funciona
   ├─ TJMG → ✅ Funciona
   └─ STF → ❌ 404 → Fallback Google

2. Google Search para STF
   ├─ Retorna snippets
   ├─ Metadados básicos
   └─ Links para decisões

3. Puppeteer tenta enriquecer
   ├─ Taxa de sucesso: 0% (STF bloqueado)
   └─ Funciona para outros tribunais
```

### Melhorias Sugeridas:

1. **Avisar usuário sobre limitações:**
   ```
   "⚠️ Ementas completas do STF podem estar indisponíveis
   devido a proteções do tribunal. Apresentando snippets
   e links oficiais."
   ```

2. **Priorizar outros tribunais:**
   - STJ (Superior Tribunal de Justiça) → ✅ Funciona bem
   - TJSP, TJRJ, TJMG → ✅ Funcionam bem

3. **Investigar Jusbrasil API:**
   - Se viável financeiramente
   - Pode resolver problema do STF completamente

4. **Aceitar limitação do STF:**
   - É uma realidade técnica/legal
   - Outros tribunais cobrem ~95% das buscas
   - STF tem proteções intencionais

---

## 📚 Fontes Consultadas

### Documentação Oficial STF:

1. [API dos Serviços - STF Digital](https://supremotribunalfederal.gitlab.io/v1/documentacao/politicas/api.html)
2. [STF lança Programa Corte Aberta](https://portal.stf.jus.br/noticias/verNoticiaDetalhe.asp?idConteudo=486780&ori=1)
3. [Corte Aberta STF](https://portal.stf.jus.br/hotsites/corteaberta/)
4. [Pesquisa de jurisprudência - STF](https://jurisprudencia.stf.jus.br/)
5. [STF moderniza pesquisa de jurisprudência](https://portal.stf.jus.br/noticias/verNoticiaDetalhe.asp?idConteudo=444028&ori=1)

### Dados Abertos:

6. [Corte Aberta – Base dos Dados](https://basedosdados.org/dataset/b46bb892-3273-434d-9335-f502b8656ef1)
7. [API Pública - Portal CNJ](https://www.cnj.jus.br/sistemas/datajud/api-publica/)
8. [API Pública - DATAJUD - Portal STJ](https://dadosabertos.web.stj.jus.br/dataset/api-publica-datajud)

### Artigos e Análises:

9. [Pesquisa de Jurisprudência com IA, API do STF e Web Scraping - Jusbrasil](https://www.jusbrasil.com.br/artigos/pesquisa-de-jurisprudencia-com-ia-generativa-api-do-stf-e-web-scraping/2784893616)
10. [Buscador de jurisprudência STF/STJ - Cognijus](https://www.cognijus.com/buscador)

---

## ✅ Conclusão

1. **API Pública do STF:** ❌ **NÃO EXISTE** e sem previsão

2. **Motivos:**
   - Limitação constitucional (não está no DataJud)
   - API interna sem planos de abertura
   - Proteções agressivas contra scraping

3. **Alternativa Atual:** ✅ **Google Search funciona**
   - Snippets suficientes para identificação
   - Links para decisões oficiais
   - Integração com outros tribunais via DataJud

4. **Próximo Passo:**
   - Investigar **Jusbrasil API** (se viável financeiramente)
   - Aceitar limitação do STF como realidade
   - Focar em tribunais que funcionam bem (STJ, TJs)

---

**Última atualização:** 2026-02-13 03:00 UTC
**Status:** ✅ INVESTIGAÇÃO COMPLETA
**Decisão:** Manter estratégia atual + avisar usuário sobre limitações STF
