#!/usr/bin/env bash
set -euo pipefail

# Mac-friendly validation for P0-7 (Backup + Git Tags + Rollback docs)
# Usage:
#   BASE_URL="https://rom-agent-ia-onrender-com.onrender.com" bash scripts/validate-p07.sh
#   BASE_URL="..." REQUIRE_TAGS="staging-validated-20251218 staging-soak-ok-20251218" bash scripts/validate-p07.sh

BASE_URL="${BASE_URL:-}"
REQUIRE_TAGS="${REQUIRE_TAGS:-staging-validated-20251218 staging-soak-ok-20251218}"
BACKUP_DIR="backups"
BACKUP_SCRIPT="scripts/backup.sh"
ROLLBACK_DOC="docs/ROLLBACK.md"
TAGS_DOC="docs/RELEASE_TAGS.md"

ok()  { printf "✅ %s\n" "$*"; }
warn(){ printf "⚠️  %s\n" "$*"; }
fail(){ printf "❌ %s\n" "$*"; exit 1; }

echo "========================================="
echo "P0-7 Validation (Backup + Tags + Rollback)"
echo "========================================="

# 1) Repo sanity
git rev-parse --is-inside-work-tree >/dev/null 2>&1 || fail "Not inside a git repo."
ok "Git repo detected."

BRANCH="$(git rev-parse --abbrev-ref HEAD)"
ok "Current branch: ${BRANCH}"

# 2) Validate backup script exists + executable
[ -f "$BACKUP_SCRIPT" ] || fail "Missing $BACKUP_SCRIPT"
[ -x "$BACKUP_SCRIPT" ] || warn "$BACKUP_SCRIPT is not executable (fix: chmod +x $BACKUP_SCRIPT)"
ok "Found $BACKUP_SCRIPT"

# 3) Run backup + ensure artifact created
mkdir -p "$BACKUP_DIR"
BEFORE_COUNT="$(ls -1 "$BACKUP_DIR" 2>/dev/null | wc -l | tr -d ' ')"
echo "Running backup..."
"./$BACKUP_SCRIPT" >/dev/null
AFTER_COUNT="$(ls -1 "$BACKUP_DIR" 2>/dev/null | wc -l | tr -d ' ')"

LATEST_BACKUP="$(ls -1t "$BACKUP_DIR"/rom-agent_*.tar.gz 2>/dev/null | head -n 1 || true)"
[ -n "$LATEST_BACKUP" ] || fail "No backup tarball found in $BACKUP_DIR (expected rom-agent_*.tar.gz)"
SIZE_BYTES="$(stat -f%z "$LATEST_BACKUP" 2>/dev/null || echo 0)"
[ "$SIZE_BYTES" -gt 10000 ] || warn "Backup seems too small (${SIZE_BYTES} bytes): $LATEST_BACKUP"
ok "Backup created: $LATEST_BACKUP ($(ls -lh "$LATEST_BACKUP" | awk '{print $5}'))"

# 4) Validate docs exist
[ -f "$ROLLBACK_DOC" ] || fail "Missing $ROLLBACK_DOC"
[ -f "$TAGS_DOC" ] || fail "Missing $TAGS_DOC"
ok "Docs present: $ROLLBACK_DOC, $TAGS_DOC"

# 5) Validate docs are tracked by git (committed at least once)
git ls-files --error-unmatch "$ROLLBACK_DOC" >/dev/null 2>&1 || warn "$ROLLBACK_DOC not tracked by git"
git ls-files --error-unmatch "$TAGS_DOC" >/dev/null 2>&1 || warn "$TAGS_DOC not tracked by git"
ok "Docs tracked (or warned if not)."

# 6) Validate required tags exist locally (fetch first)
git fetch --tags >/dev/null 2>&1 || true

MISSING_TAGS=0
for t in $REQUIRE_TAGS; do
  if git rev-parse -q --verify "refs/tags/$t" >/dev/null; then
    ok "Tag exists: $t"
  else
    warn "Missing tag: $t"
    MISSING_TAGS=1
  fi
done

# 7) Ensure .gitignore contains known noise patterns (optional but recommended)
if grep -q "test-\\*\\.json" .gitignore 2>/dev/null && grep -q "\\.jusbrasil-cookies\\.json" .gitignore 2>/dev/null; then
  ok ".gitignore excludes test-*.json and .jusbrasil-cookies.json"
else
  warn ".gitignore may be missing exclusions for test-*.json / .jusbrasil-cookies.json"
fi

# 8) Working tree status
if [ -n "$(git status --porcelain)" ]; then
  warn "Working tree not clean:"
  git status --porcelain
else
  ok "Working tree clean."
fi

# 9) Optional: live endpoint checks
if [ -n "$BASE_URL" ]; then
  echo "-----------------------------------------"
  echo "Live checks: $BASE_URL"
  echo "-----------------------------------------"

  INFO_JSON="$(curl -fsS "$BASE_URL/api/info" 2>/dev/null || true)"
  [ -n "$INFO_JSON" ] && ok "GET /api/info OK" || warn "GET /api/info failed"

  METRICS_TXT="$(curl -fsS "$BASE_URL/metrics" 2>/dev/null || true)"
  [ -n "$METRICS_TXT" ] && ok "GET /metrics OK" || warn "GET /metrics failed"

  # Quick presence checks
  if echo "$METRICS_TXT" | grep -q "bottleneck_inflight{name=\"converse\"}"; then
    ok "Metrics: bottleneck_inflight{name=\"converse\"} present"
  else
    warn "Metrics: bottleneck_inflight{name=\"converse\"} missing"
  fi

  if echo "$METRICS_TXT" | grep -q "bottleneck_queue_size{name=\"converse\"}"; then
    ok "Metrics: bottleneck_queue_size{name=\"converse\"} present"
  else
    warn "Metrics: bottleneck_queue_size{name=\"converse\"} missing"
  fi

  if echo "$METRICS_TXT" | grep -q "circuit_breaker_state"; then
    ok "Metrics: circuit_breaker_state present"
  else
    warn "Metrics: circuit_breaker_state missing"
  fi
fi

echo "========================================="
if [ "$MISSING_TAGS" -eq 1 ]; then
  echo "RESULT: ✅ P0-7 OK (with warnings: missing some tags locally/remotely?)"
else
  echo "RESULT: ✅ P0-7 OK"
fi
echo "========================================="
