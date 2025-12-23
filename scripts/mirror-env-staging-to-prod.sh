#!/usr/bin/env bash
set -euo pipefail

# Requer:
# export RENDER_API_KEY="..."
# export STAGING_SERVICE_ID="srv-..."
# export PROD_SERVICE_ID="srv-..."

API="https://api.render.com/v1"

# Lista de chaves que vamos espelhar (ajuste conforme seu projeto)
ALLOWLIST_REGEX='^(AWS_|BEDROCK_|ENABLE_|MAX_CONCURRENT$|MAX_QUEUE$)'

get_env () {
  local sid="$1"
  curl -fsS "$API/services/$sid/env-vars" \
    -H "Authorization: Bearer $RENDER_API_KEY"
}

set_env () {
  local sid="$1"
  local payload="$2"
  curl -fsS -X PUT "$API/services/$sid/env-vars" \
    -H "Authorization: Bearer $RENDER_API_KEY" \
    -H "Content-Type: application/json" \
    -d "$payload"
}

echo "→ Lendo ENV do staging..."
STAGING_JSON="$(get_env "$STAGING_SERVICE_ID")"

# Render API retorna lista de objetos; transformamos em [{key,value}]
FILTERED="$(echo "$STAGING_JSON" | jq -c --arg re "$ALLOWLIST_REGEX" '
  [ .[]
    | select(.key | test($re))
    | { key: .key, value: .value }
  ]
')"

echo "→ Aplicando no PROD (somente allowlist)..."
PAYLOAD="$(jq -c '{envVars: .}' <<< "$FILTERED")"
set_env "$PROD_SERVICE_ID" "$PAYLOAD"

echo "✅ ENV espelhadas (allowlist) de staging para prod."
echo "Obs: se algum valor for secret/sync:false, pode precisar setar manualmente uma vez."
