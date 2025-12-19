#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-https://rom-agent-ia-onrender-com.onrender.com}"
OUT_DIR="${OUT_DIR:-artifacts/validation/$(date +%F)}"
RUN_BURST="${RUN_BURST:-1}"          # 1 = roda burst bottleneck
BURST_N="${BURST_N:-15}"             # 15 concorrentes
BURST_P="${BURST_P:-15}"             # paralelismo
AUTO_COMMIT="${AUTO_COMMIT:-0}"      # 1 = git add/commit/push dos artefatos

mkdir -p "$OUT_DIR"
REPORT="$OUT_DIR/GO_LIVE_CHECK.md"
JSON="$OUT_DIR/GO_LIVE_CHECK.json"

# Mac-compatible ISO8601 timestamp
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

echo "# GO LIVE CHECK (staging)" > "$REPORT"
echo "" >> "$REPORT"
echo "- Base URL: $BASE_URL" >> "$REPORT"
echo "- Timestamp: $TIMESTAMP" >> "$REPORT"
echo "" >> "$REPORT"

section () { echo -e "\n## $1\n" | tee -a "$REPORT" >/dev/null; }
kv () { echo "- $1: $2" | tee -a "$REPORT" >/dev/null; }

section "1) /api/info"
INFO="$(curl -sS "$BASE_URL/api/info" || true)"
echo '```json' >> "$REPORT"
echo "$INFO" | head -c 6000 >> "$REPORT"
echo -e '\n```' >> "$REPORT"

section "2) /metrics - sanity + resilience series"
METRICS="$(curl -sS "$BASE_URL/metrics" || true)"

# extrair séries relevantes
BN_LINES="$(echo "$METRICS" | grep -v '^#' | grep -E 'bottleneck_(inflight|queue_size|rejected_total)' | sort || true)"
CB_LINES="$(echo "$METRICS" | grep -v '^#' | grep -E 'circuit_breaker_state|circuit_breaker_events_total' | sort || true)"
RL_LINES="$(echo "$METRICS" | grep -v '^#' | grep -E 'http_requests_total|http_request_duration_seconds' | head -n 60 || true)"

echo "### Bottleneck" >> "$REPORT"
echo '```' >> "$REPORT"
echo "$BN_LINES" >> "$REPORT"
echo '```' >> "$REPORT"

echo "### Circuit Breaker" >> "$REPORT"
echo '```' >> "$REPORT"
echo "$CB_LINES" >> "$REPORT"
echo '```' >> "$REPORT"

echo "### HTTP metrics (amostra)" >> "$REPORT"
echo '```' >> "$REPORT"
echo "$RL_LINES" >> "$REPORT"
echo '```' >> "$REPORT"

# validação: precisa existir "converse" em inflight/queue (depois do fix)
HAS_CONVERSE_INFLIGHT="$(echo "$BN_LINES" | grep -c 'bottleneck_inflight{name="converse"}' || true)"
HAS_CONVERSE_QUEUE="$(echo "$BN_LINES" | grep -c 'bottleneck_queue_size{name="converse"}' || true)"
kv "bottleneck_inflight converse series" "$HAS_CONVERSE_INFLIGHT"
kv "bottleneck_queue_size converse series" "$HAS_CONVERSE_QUEUE"

section "3) /api/chat - guard clause (400 esperado sem message)"
HTTP_400="$(curl -sS -o /tmp/rom_chat_400.json -w "%{http_code}" -X POST "$BASE_URL/api/chat" -H "Content-Type: application/json" -d '{}' || true)"
kv "POST /api/chat {} HTTP" "$HTTP_400"
echo '```' >> "$REPORT"; cat /tmp/rom_chat_400.json >> "$REPORT"; echo -e '\n```' >> "$REPORT"

section "4) /api/chat - request válida (status pode variar)"
HTTP_VALID="$(curl -sS -o /tmp/rom_chat_ok.json -w "%{http_code}" -X POST "$BASE_URL/api/chat" -H "Content-Type: application/json" -d '{"message":"go-live-check"}' || true)"
kv "POST /api/chat {message} HTTP" "$HTTP_VALID"
echo '```' >> "$REPORT"; cat /tmp/rom_chat_ok.json >> "$REPORT"; echo -e '\n```' >> "$REPORT"

section "5) Bottleneck mini-burst (opcional)"
if [[ "$RUN_BURST" == "1" ]]; then
  BEFORE_REJ="$(echo "$BN_LINES" | awk '/bottleneck_rejected_total{name="converse"}/ {print $2}' | tail -n1 || echo 0)"
  kv "rejected_total_before" "${BEFORE_REJ:-0}"

  # 15 concorrentes: espera NÃO rejeitar se houver capacidade real,
  # mas se Bedrock/trabalho interno travar, pode gerar 503; o importante é:
  # - NÃO travar o serviço
  # - rejected_total aumentar coerentemente se houver 503
  RES_COUNTS="$(seq 1 "$BURST_N" | xargs -I{} -P"$BURST_P" sh -c \
    'curl -sS -o /dev/null -w "%{http_code}\n" -X POST "'"$BASE_URL"'/api/chat" -H "Content-Type: application/json" -d "{\"message\":\"mini-burst-{}\"}"' \
    | sort | uniq -c || true)"

  echo '```' >> "$REPORT"
  echo "$RES_COUNTS" >> "$REPORT"
  echo '```' >> "$REPORT"

  # métricas após burst
  METRICS2="$(curl -sS "$BASE_URL/metrics" || true)"
  BN2="$(echo "$METRICS2" | grep -v '^#' | grep -E 'bottleneck_(inflight|queue_size|rejected_total)' | sort || true)"
  AFTER_REJ="$(echo "$BN2" | awk '/bottleneck_rejected_total{name="converse"}/ {print $2}' | tail -n1 || echo 0)"
  kv "rejected_total_after" "${AFTER_REJ:-0}"

  echo "### Bottleneck (pós-burst)" >> "$REPORT"
  echo '```' >> "$REPORT"
  echo "$BN2" >> "$REPORT"
  echo '```' >> "$REPORT"
else
  kv "burst" "skipped (RUN_BURST=0)"
fi

section "6) Admin endpoints (P0-1 opcional)"
RUN_ADMIN="${RUN_ADMIN:-1}"
X_ADMIN_TOKEN="${X_ADMIN_TOKEN:-}"
ADMIN_FLAGS_JSON="$OUT_DIR/admin_flags.json"
ADMIN_RELOAD_HDR="$OUT_DIR/admin_reload_headers.txt"
ADMIN_RELOAD_BODY="$OUT_DIR/admin_reload_body.txt"

if [[ "$RUN_ADMIN" == "1" ]]; then
  if [[ -z "$X_ADMIN_TOKEN" ]]; then
    kv "admin" "SKIPPED (X_ADMIN_TOKEN not set)"
  else
    # Test GET /admin/flags
    kv "action" "GET /admin/flags..."
    if curl -fsS "$BASE_URL/admin/flags" -H "X-Admin-Token: $X_ADMIN_TOKEN" -o "$ADMIN_FLAGS_JSON"; then
      kv "GET /admin/flags" "OK -> $ADMIN_FLAGS_JSON"
      echo '```json' >> "$REPORT"
      cat "$ADMIN_FLAGS_JSON" | head -c 1000 >> "$REPORT"
      echo -e '\n```' >> "$REPORT"

      # Validate required feature flags
      MISSING_FLAGS=""
      grep -q "ENABLE_METRICS" "$ADMIN_FLAGS_JSON" || MISSING_FLAGS="${MISSING_FLAGS}ENABLE_METRICS "
      grep -q "ENABLE_BOTTLENECK" "$ADMIN_FLAGS_JSON" || MISSING_FLAGS="${MISSING_FLAGS}ENABLE_BOTTLENECK "
      grep -q "ENABLE_CIRCUIT_BREAKER" "$ADMIN_FLAGS_JSON" || MISSING_FLAGS="${MISSING_FLAGS}ENABLE_CIRCUIT_BREAKER "

      if [[ -n "$MISSING_FLAGS" ]]; then
        kv "admin_flags validation" "WARN: missing flags: $MISSING_FLAGS"
      else
        kv "admin_flags validation" "OK (all required flags present)"
      fi
    else
      kv "GET /admin/flags" "FAILED (token? route? cloudflare?)"
    fi

    # Test POST /admin/reload-flags
    kv "action" "POST /admin/reload-flags..."
    HTTP_RELOAD="$(curl -sS -D "$ADMIN_RELOAD_HDR" -o "$ADMIN_RELOAD_BODY" -w "%{http_code}" \
      -X POST "$BASE_URL/admin/reload-flags" -H "X-Admin-Token: $X_ADMIN_TOKEN" || true)"

    if [[ "$HTTP_RELOAD" == "200" || "$HTTP_RELOAD" == "204" ]]; then
      kv "POST /admin/reload-flags" "OK (HTTP $HTTP_RELOAD)"
    else
      kv "POST /admin/reload-flags" "WARN: unexpected HTTP $HTTP_RELOAD"
    fi

    echo '```' >> "$REPORT"
    echo "HTTP $HTTP_RELOAD" >> "$REPORT"
    cat "$ADMIN_RELOAD_BODY" 2>/dev/null >> "$REPORT" || echo "(no body)" >> "$REPORT"
    echo '```' >> "$REPORT"
  fi
else
  kv "admin" "SKIPPED (RUN_ADMIN=0)"
fi

section "7) P0-7 artifacts"
kv "docs/ROLLBACK.md" "$(test -f docs/ROLLBACK.md && echo OK || echo MISSING)"
kv "docs/RELEASE_TAGS.md" "$(test -f docs/RELEASE_TAGS.md && echo OK || echo MISSING)"
kv "scripts/backup.sh" "$(test -f scripts/backup.sh && echo OK || echo MISSING)"
kv "latest backup" "$(ls -1t backups/rom-agent_*.tar.gz 2>/dev/null | head -n1 || echo NONE)"

section "8) Resultado (gate)"
PASS=1
[[ "$HAS_CONVERSE_INFLIGHT" -ge 1 ]] || PASS=0
[[ "$HAS_CONVERSE_QUEUE" -ge 1 ]] || PASS=0
[[ "$HTTP_400" == "400" ]] || PASS=0

if [[ "$PASS" == "1" ]]; then
  kv "GATE" "PASS ✅"
else
  kv "GATE" "FAIL ❌ (ver itens acima)"
fi

cat > "$JSON" <<EOFJ
{
  "baseUrl": "$BASE_URL",
  "timestamp": "$TIMESTAMP",
  "gate": $( [[ "$PASS" == "1" ]] && echo '"PASS"' || echo '"FAIL"' ),
  "http": {
    "chatMissingMessage": $HTTP_400,
    "chatValidMessage": $HTTP_VALID
  },
  "metrics": {
    "hasConverseInflightSeries": $HAS_CONVERSE_INFLIGHT,
    "hasConverseQueueSeries": $HAS_CONVERSE_QUEUE
  }
}
EOFJ

echo "" >> "$REPORT"
echo "- JSON: $JSON" >> "$REPORT"

echo "✅ Relatório gerado: $REPORT"
echo "✅ JSON gerado: $JSON"

if [[ "$AUTO_COMMIT" == "1" ]]; then
  git add "$OUT_DIR" || true
  git commit -m "docs(validation): go-live check artifacts ($(date +%F))" || true
  git push origin staging || true
fi
