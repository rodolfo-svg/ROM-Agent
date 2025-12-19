# GO LIVE CHECK (staging)

- Base URL: https://rom-agent-ia-onrender-com.onrender.com
- Timestamp: 2025-12-19T03:18:49Z


## 1) /api/info

```json
{"nome":"ROM","versao":"2.4.19","version":"2.4.19","capacidades":["Redação de peças jurídicas (cíveis, criminais, trabalhistas, etc)","Pesquisa de legislação nacional e internacional","Consulta de jurisprudência em todos os tribunais","Análise e extração de processos judiciais","Correção ortográfica e gramatical","Formatação profissional com papel timbrado","Criação de tabelas, fluxogramas e linhas do tempo","Busca de artigos científicos jurídicos"],"health":{"status":"healthy","uptime":"0h 1m","uptimeSeconds":110},"bedrock":{"status":"connected","region":"us-east-1","credentials":{"hasAccessKeyId":false,"hasSecretAccessKey":false,"hasRegion":false}},"cache":{"enabled":true,"activeSessions":0},"server":{"nodeVersion":"v20.19.6","platform":"linux","arch":"x64","pid":18},"memory":{"rss":"250 MB","heapTotal":"137 MB","heapUsed":"133 MB","external":"22 MB"},"storage":{"isRender":true,"hasRenderEnv":true,"renderValue":"true","renderServiceName":"rom-agent-ia-onrender-com","uploadFolder":"not set","extractedFolder":"not set","processedFolder":"not set","varDataExists":false,"varDataIsDir":false,"varDataPermissions":null,"varDataError":null,"varExists":true,"varContents":["cache","empty","lib","local","lock","log","mail","opt","run","spool","tmp"],"varError":null,"activePaths":{"upload":"/app/upload","extracted":"/app/extracted","processed":"/app/processed"}},"timestamp":"2025-12-19T03:18:49.617Z"}

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
circuit_breaker_events_total{name="converse",event="failure"} 3
circuit_breaker_state{name="converse"} 0
circuit_breaker_state{name="default"} 0
```
### HTTP metrics (amostra)
```
http_requests_total{method="GET",path="/api/info",status="200"} 1
http_request_duration_seconds_bucket{le="0.1",method="GET",path="/api/info"} 1
http_request_duration_seconds_bucket{le="0.5",method="GET",path="/api/info"} 1
http_request_duration_seconds_bucket{le="1",method="GET",path="/api/info"} 1
http_request_duration_seconds_bucket{le="5",method="GET",path="/api/info"} 1
http_request_duration_seconds_bucket{le="10",method="GET",path="/api/info"} 1
http_request_duration_seconds_bucket{le="30",method="GET",path="/api/info"} 1
http_request_duration_seconds_bucket{le="60",method="GET",path="/api/info"} 1
http_request_duration_seconds_bucket{le="+Inf",method="GET",path="/api/info"} 1
http_request_duration_seconds_sum{method="GET",path="/api/info"} 0.026
http_request_duration_seconds_count{method="GET",path="/api/info"} 1
```
- bottleneck_inflight converse series: 1
- bottleneck_queue_size converse series: 1

## 3) /api/chat - guard clause (400 esperado sem message)

- POST /api/chat {} HTTP: 400
```
{"error":"Mensagem inválida ou ausente"}
```

## 4) /api/chat - request válida (status pode variar)

- POST /api/chat {message} HTTP: 500
```
{"error":"All models in fallback chain failed (1 attempts)","status":500}
```

## 5) Bottleneck mini-burst (opcional)

- rejected_total_before: 0
```
  15 500
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
