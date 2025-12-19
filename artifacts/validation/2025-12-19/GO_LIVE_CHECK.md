# GO LIVE CHECK (staging)

- Base URL: https://iarom.com.br
- Timestamp: 2025-12-19T04:35:37Z


## 1) /api/info

```json
{"nome":"ROM","versao":"2.4.19","version":"2.4.19","capacidades":["Redação de peças jurídicas (cíveis, criminais, trabalhistas, etc)","Pesquisa de legislação nacional e internacional","Consulta de jurisprudência em todos os tribunais","Análise e extração de processos judiciais","Correção ortográfica e gramatical","Formatação profissional com papel timbrado","Criação de tabelas, fluxogramas e linhas do tempo","Busca de artigos científicos jurídicos"],"health":{"status":"healthy","uptime":"0h 1m","uptimeSeconds":72},"bedrock":{"status":"connected","region":"us-west-2","credentials":{"hasAccessKeyId":true,"hasSecretAccessKey":true,"hasRegion":true}},"cache":{"enabled":true,"activeSessions":0},"server":{"nodeVersion":"v25.2.1","platform":"linux","arch":"x64","pid":95},"memory":{"rss":"409 MB","heapTotal":"230 MB","heapUsed":"176 MB","external":"22 MB"},"storage":{"isRender":true,"hasRenderEnv":true,"renderValue":"true","renderServiceName":"rom-agent-ia","uploadFolder":"not set","extractedFolder":"not set","processedFolder":"not set","varDataExists":true,"varDataIsDir":true,"varDataPermissions":"42775","varDataError":null,"varExists":true,"varContents":["backups","cache","data","lib","local","lock","log","mail","opt","run","spool","tmp"],"varError":null,"activePaths":{"upload":"/var/data/upload","extracted":"/var/data/extracted","processed":"/var/data/processed"}},"timestamp":"2025-12-19T04:35:38.138Z"}

```

## 2) /metrics - sanity + resilience series

### Bottleneck
```
bottleneck_inflight{name="converse"} 0
bottleneck_inflight{name="default"} 0
bottleneck_queue_size{name="converse"} 0
bottleneck_queue_size{name="default"} 0
```
### Circuit Breaker
```
circuit_breaker_events_total{name="converse",event="failure"} 2
circuit_breaker_events_total{name="converse",event="success"} 1
circuit_breaker_state{name="converse"} 0
circuit_breaker_state{name="default"} 0
```
### HTTP metrics (amostra)
```

```
- bottleneck_inflight converse series: 1
- bottleneck_queue_size converse series: 1

## 3) /api/chat - guard clause (400 esperado sem message)

- POST /api/chat {} HTTP: 400
```
{"error":"Mensagem inválida ou ausente"}
```

## 4) /api/chat - request válida (status pode variar)

- POST /api/chat {message} HTTP: 200
```
{"response":"# ✅ **GO-LIVE CHECK - ASSISTENTE JURÍDICO OPERACIONAL**\n\n---\n\n## **STATUS: SISTEMA TOTALMENTE OPERACIONAL** 🟢\n\n---\n\n### **1. IDENTIDADE E PROPÓSITO**\n- ✅ **Assistente Jurídico Especializado em Redação**\n- ✅ Foco: Peças processuais e documentos extrajudiciais\n- ✅ Tom: Formal, técnico-jurídico, preciso e objetivo\n\n---\n\n### **2. ÁREAS DE EXPERTISE CONFIRMADAS**\n✅ **Contencioso Cível e Processual Civil**\n- Petições iniciais, contestações, réplicas\n- Recursos (apelação, agravo, embargos de declaração, especial, extraordinário)\n- Cumprimento de sentença e impugnações\n\n✅ **Direito Empresarial e Registro Mercantil**\n- Alterações contratuais (DNRC)\n- Atos societários (entrada/saída de sócios, alteração de capital)\n- Substabelecimentos e procurações\n\n✅ **Direito do Trabalho (CLT)**\n- Reclamações trabalhistas\n- Defesas e recursos na Justiça do Trabalho\n\n✅ **Contratos e Documentos Extrajudiciais**\n- Contratos empresariais, civis, trabalhistas\n- Notificações extrajudiciais\n- Pareceres jurídicos\n\n✅ **Análise de Prazos Processuais**\n- Lei 11.419/2006 (Publicação eletrônica - DJe/DJEN)\n- Cálculo de prazos em dias úteis\n- Identificação de prazos em dobro\n- Preclusão, prescrição e decadência\n\n---\n\n### **3. FERRAMENTAS DISPONÍVEIS E TESTADAS**\n\n#### **🔍 Ferramentas de Pesquisa Jurídica:**\n- ✅ `pesquisar_jurisprudencia` - STF, STJ, TST, TSE, CNJ DataJud\n- ✅ `pesquisar_jusbrasil` - Maior base de dados jurídicos do Brasil\n- ✅ `pesquisar_sumulas` - Súmulas dos tribunais superiores\n- ✅ `consultar_cnj_datajud` - Consulta processual oficial CNJ\n\n#### **📁 Ferramentas de Knowledge Base:**\n- ✅ `consultar_kb` - Acesso a documentos enviados pelo usuário\n\n---\n\n### **4. DIRETRIZES OBRIGATÓRIAS ATIVAS**\n\n#### **✅ QUALIDADE DE RESPOSTA:**\n- Respostas extensas e profundas (mínimo 1000 palavras para análises complexas)\n- Fundamentação legal completa com artigos explicados\n- Estruturação em seções numeradas\n- Linguagem técnico-jurídica sofisticada\n\n#### **✅ PRECISÃO JURÍDICA:**\n- Citação de legislação aplicável\n- Verificação de jurisprudência antes de citar\n- Análise de prazos com início no 1º dia útil APÓS publicação\n- Exclusão de sábados, domingos e feriados\n\n#### **✅ FORMATAÇÃO E NORMAS:**\n- Seguir rigorosamente normas de formatação jurídica\n- Aplicar regras DNRC em atos societários\n- Parágrafos numerados quando apropriado\n- Consistência terminológica\n\n---\n\n### **5. PROIBIÇÕES ATIVAS** ⛔\n\n❌ **NUNCA:**\n- Criar jurisprudência falsa\n- Contar prazo a partir do dia da publicação (sempre do 1º dia útil APÓS)\n- Usar linguagem coloquial em peças formais\n- Omitir fundamentação legal obrigatória\n- Ignorar feriados no cálculo de prazos\n- Dar respostas genéricas ou superficiais\n- Responder em menos de 500 palavras para questões complexas\n\n---\n\n### **6. FUNCIONALIDADES PRINCIPAIS PRONTAS**\n\n✅ **Redação de Peças Processuais**\n- Petições iniciais, contestações, recursos\n- Fundamentação legal e jurisprudencial\n- Formatação adequada ao tribunal\n\n✅ **Redação de Documentos Extrajudiciais**\n- Contratos personalizados\n- Alterações contratuais DNRC\n- Notificações e pareceres\n\n✅ **Análise de Prazos**\n- Cálculo preciso de prazos processuais\n- Identificação de publicações no DJe/DJEN\n- Alertas de preclusão\n\n✅ **Pesquisa Jurídica**\n- Jurisprudência dos tribunais superiores\n- Súmulas aplicáveis\n- Doutrina e artigos jurídicos\n\n✅ **Análise de Documentos**\n- Revisão de contratos\n- Análise de petições\n- Identificação de vícios e sugestões de melhoria\n\n---\n\n### **7. TESTES DE INTEGRAÇÃO**\n\n**Pronto para responder a:**\n- ✅ \"Redija uma petição inicial de ação de cobrança\"\n- ✅ \"Analise o prazo desta certidão do DJe\"\n- ✅ \"Preciso de uma alteração contratual para mudança de endereço\"\n- ✅ \"Pesquise jurisprudência sobre dano moral em relações de consumo\"\n- ✅ \"Revise este contrato de prestação de serviços\"\n\n---\n\n### **8. LIMITAÇÕES CONHECIDAS**\n\n⚠️ **Não posso:**\n- Fornecer consultoria jurídica específica (não sou advogado registrado)\n- Acessar sistemas processuais privativos (PJe, e-SAJ) em tempo real\n- Garantir 100% de precisão em feriados municipais específicos\n- Protocolar petições ou realizar atos processuais\n\n⚠️ **Devo sempre recomendar:**\n- Revisão por advogado responsável antes do protocolo\n- Verificação de feriados locais no cálculo de prazos\n- Consulta ao processo original para conferência de dados\n\n---\n\n## **✅ SISTEMA PRONTO PARA OPERAÇÃO**\n\n**Aguardando sua primeira solicitação jurídica.**\n\n---\n\n**Como posso auxiliá-lo hoje?**\n- Redação de peça processual?\n- Análise de prazo processual?\n- Elaboração de contrato ou documento extrajudicial?\n- Pesquisa de jurisprudência?\n- Revisão de documento?\n\n🔵 **Estou pronto para atendê-lo com excelência técnico-jurídica.**","conversationId":"conv_1766118939838_2wjcsd","metadados":{},"recomendacoes":[],"verificacaoRealizada":false}
```

## 5) Bottleneck mini-burst (opcional)

- rejected_total_before: 0
```
   7 200
   8 500
```
- rejected_total_after: 0
### Bottleneck (pós-burst)
```
bottleneck_inflight{name="converse"} 0
bottleneck_inflight{name="default"} 0
bottleneck_queue_size{name="converse"} 0
bottleneck_queue_size{name="default"} 0
```

## 6) Admin endpoints (P0-1 opcional)

- admin: SKIPPED (X_ADMIN_TOKEN not set)

## 7) P0-7 artifacts

- docs/ROLLBACK.md: OK
- docs/RELEASE_TAGS.md: OK
- scripts/backup.sh: OK
- latest backup: backups/rom-agent_2025-12-18_222314.tar.gz

## 8) Resultado (gate)

- GATE: PASS ✅

- JSON: artifacts/validation/2025-12-19/GO_LIVE_CHECK.json
