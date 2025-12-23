#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-https://rom-agent-ia-onrender-com.onrender.com}"
DATE="$(date +%Y-%m-%d)"
TS="$(date +%Y-%m-%d_%H%M%S)"

ART_DIR="artifacts/validation/${DATE}"
DOC_FILE="docs/VALIDATION_STAGING_${DATE}.md"
COMMIT_MSG="docs(validation): compile staging validation artifacts (${DATE})"

mkdir -p "${ART_DIR}" docs

echo "== [1/7] Capturando snapshots do staging =="
curl -sS "${BASE_URL}/api/info" > "${ART_DIR}/api_info_${TS}.json" || true
curl -sS "${BASE_URL}/metrics"  > "${ART_DIR}/metrics_${TS}.txt"   || true

echo "== [2/7] Copiando logs locais (se existirem) =="
copy_if_exists() { [[ -f "$1" ]] && cp -f "$1" "${ART_DIR}/"; }
copy_dir_if_exists() { [[ -d "$1" ]] && cp -R "$1" "${ART_DIR}/"; }

copy_if_exists /tmp/soak-test-results.log
copy_if_exists /tmp/soak-traffic-codes.log
copy_if_exists /tmp/soak-monitor.sh
copy_if_exists /tmp/quick-burst-validate.sh
copy_if_exists /tmp/test-bottleneck-burst.sh
copy_if_exists /tmp/test-circuit-breaker-traffic.sh

for d in /tmp/validate-* /tmp/burst-validate-*; do
  copy_dir_if_exists "$d" || true
done

echo "== [3/7] Extraindo métricas-chave =="
grep -v '^#' "${ART_DIR}/metrics_${TS}.txt" 2>/dev/null \
 | grep -E 'bottleneck_(rejected_total|inflight|queue_size)|circuit_breaker_state|circuit_breaker_events_total|retry_(attempts_total|exhausted_total)|model_fallback_(attempts_total|exhausted_total)|http_requests_total|http_request_duration_seconds' \
 > "${ART_DIR}/metrics_key_${TS}.txt" || true

echo "== [4/7] Resumo de HTTP codes (se houver tráfego) =="
if [[ -f "${ART_DIR}/soak-traffic-codes.log" ]]; then
  sort "${ART_DIR}/soak-traffic-codes.log" | uniq -c > "${ART_DIR}/http_codes_summary.txt" || true
else
  echo "(sem /tmp/soak-traffic-codes.log)" > "${ART_DIR}/http_codes_summary.txt"
fi

echo "== [5/7] Gerando relatório Markdown compilado =="
GIT_COMMIT="$(git rev-parse --short HEAD 2>/dev/null || echo 'unknown')"
GIT_BRANCH="$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo 'unknown')"

INFO_SNIP="$(cat "${ART_DIR}/api_info_${TS}.json" 2>/dev/null | head -c 1800 || true)"
KEY_METRICS_SNIP="$(cat "${ART_DIR}/metrics_key_${TS}.txt" 2>/dev/null | head -n 220 || true)"
HTTP_CODES_SNIP="$(cat "${ART_DIR}/http_codes_summary.txt" 2>/dev/null | head -n 220 || true)"

cat > "${DOC_FILE}" <<MD
# Validação Staging — ${DATE}

## Contexto
- URL: ${BASE_URL}
- Branch local: ${GIT_BRANCH}
- Commit local: ${GIT_COMMIT}
- Evidências brutas: \`${ART_DIR}/\`

## O que foi exercitado / confirmado (até aqui)
- Guard clause em \`/api/chat\` (400 para payload inválido)
- Bottleneck ativo com rejeição **HTTP 503** sob rajada (quando excede capacidade)
- Métricas Prometheus v2 expostas + seed (métricas aparecem com valores)
- Documentação operacional:
  - \`docs/ROLLBACK.md\`
  - \`docs/RELEASE_TAGS.md\`
- Backup:
  - \`scripts/backup.sh\` + arquivo em \`backups/\`

> Observação: Circuit Breaker / Model fallback são plenamente validados apenas com chamadas reais ao Bedrock (credenciais/ambiente).

## Snapshot atual (/api/info)
\`\`\`json
${INFO_SNIP}
\`\`\`

## Métricas-chave (snapshot atual)
\`\`\`
${KEY_METRICS_SNIP}
\`\`\`

## Resumo de códigos HTTP (tráfego sintético)
\`\`\`
${HTTP_CODES_SNIP}
\`\`\`

## Artefatos salvos
- \`metrics_${TS}.txt\` (bruto)
- \`metrics_key_${TS}.txt\` (filtrado)
- \`http_codes_summary.txt\`
- Logs/copias de \`/tmp\` (se existiam)
MD

echo "== [6/7] Finalizado =="
echo "✔ Evidências: ${ART_DIR}/"
echo "✔ Relatório:  ${DOC_FILE}"

echo "== [7/7] Git (opcional) =="
if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "⚠️  Não é um repositório git. Pulando commit/push."
  exit 0
fi

if [[ "${AUTO_COMMIT:-0}" != "1" ]]; then
  echo "AUTO_COMMIT!=1 -> não vou commitar."
  echo "Para commitar e dar push automaticamente:"
  echo "  AUTO_COMMIT=1 bash scripts/compile-validation.sh"
  exit 0
fi

BRANCH="$(git rev-parse --abbrev-ref HEAD)"
echo "Branch atual: ${BRANCH}"

git add "${ART_DIR}" "${DOC_FILE}"
if git diff --cached --quiet; then
  echo "Nada novo para commitar (já estava tudo versionado)."
else
  git commit -m "${COMMIT_MSG}"
fi

git push origin "${BRANCH}"
echo "✅ Commit/push concluídos."
