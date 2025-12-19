# GO LIVE CHECK (production - iarom.com.br)

- Base URL: https://iarom.com.br
- Timestamp: 2025-12-19T02:39:08Z
- DNS Resolution: Forced to 172.67.136.165 (cache bypass)


## 1) /api/info

```json
{"nome":"ROM","versao":"2.4.19","version":"2.4.19","capacidades":["Redação de peças jurídicas (cíveis, criminais, trabalhistas, etc)","Pesquisa de legislação nacional e internacional","Consulta de jurisprudência em todos os tribunais","Análise e extração de processos judiciais","Correção ortográfica e gramatical","Formatação profissional com papel timbrado","Criação de tabelas, fluxogramas e linhas do tempo","Busca de artigos científicos jurídicos"],"health":{"status":"healthy","uptime":"0h 33m","uptimeSeconds":2014},"bedrock":{"status":"connected","region":"us-west-2","credentials":{"hasAccessKeyId":true,"hasSecretAccessKey":true,"hasRegion":true}},"cache":{"enabled":true,"activeSessions":0},"server":{"nodeVersion":"v25.2.1","platform":"linux","arch":"x64","pid":74},"memory":{"rss":"326 MB","heapTotal":"149 MB","heapUsed":"147 MB","external":"22 MB"},"storage":{"isRender":true,"hasRenderEnv":true,"renderValue":"true","renderServiceName":"rom-agent-ia","uploadFolder":"not set","extractedFolder":"not set","processedFolder":"not set","varDataExists":true,"varDataIsDir":true,"varDataPermissions":"42775","varDataError":null,"varExists":true,"varContents":["backups","cache","data","lib","local","lock","log","mail","opt","run","spool","tmp"],"varError":null,"activePaths":{"upload":"/var/data/upload","extracted":"/var/data/extracted","processed":"/var/data/processed"}},"timestamp":"2025-12-19T02:39:09.377Z"}

```

## 2) /metrics - resilience series

### Bottleneck
```
bottleneck_inflight{name="converse"} 0
bottleneck_inflight{name="default"} 0
bottleneck_queue_size{name="converse"} 0
bottleneck_queue_size{name="default"} 0
```
### Circuit Breaker
```
circuit_breaker_state{name="converse"} 0
circuit_breaker_state{name="default"} 0
```
- bottleneck_inflight converse series: 1
- bottleneck_queue_size converse series: 1

## 3) /api/chat - guard clause (400 esperado)

- POST /api/chat {} HTTP: 400

## 4) Bottleneck burst test (60 requests, concurrency 12)

- rejected_total_before: 0
```
  60 500
```
- rejected_total_after: 0

## 5) Admin endpoints

- GET /admin/flags: OK
- admin_flags validation: OK

## 6) P0-7 artifacts

- docs/ROLLBACK.md: OK
- docs/RELEASE_TAGS.md: OK
- latest backup: backups/rom-agent_2025-12-18_222314.tar.gz

## 7) Resultado (gate)

- GATE: PASS ✅
