# GO LIVE CHECK (staging)

- Base URL: https://iarom.com.br
- Timestamp: 2025-12-19T02:28:07Z


## 1) /api/info

```json


```

## 2) /metrics - sanity + resilience series

### Bottleneck
```

```
### Circuit Breaker
```

```
### HTTP metrics (amostra)
```

```
- bottleneck_inflight converse series: 0
- bottleneck_queue_size converse series: 0

## 3) /api/chat - guard clause (400 esperado sem message)

- POST /api/chat {} HTTP: 000
```

```

## 4) /api/chat - request válida (status pode variar)

- POST /api/chat {message} HTTP: 000
```

```

## 5) Bottleneck mini-burst (opcional)

- rejected_total_before: 0
```
  60 000
```
- rejected_total_after: 0
### Bottleneck (pós-burst)
```

```

## 6) Admin endpoints (P0-1 opcional)

- action: GET /admin/flags...
- GET /admin/flags: FAILED (token? route? cloudflare?)
- action: POST /admin/reload-flags...
- POST /admin/reload-flags: WARN: unexpected HTTP 000
```
HTTP 000
```

## 7) P0-7 artifacts

- docs/ROLLBACK.md: OK
- docs/RELEASE_TAGS.md: OK
- scripts/backup.sh: OK
- latest backup: backups/rom-agent_2025-12-18_222314.tar.gz

## 8) Resultado (gate)

- GATE: FAIL ❌ (ver itens acima)

- JSON: artifacts/validation/2025-12-18/GO_LIVE_CHECK.json
