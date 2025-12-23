#!/usr/bin/env bash
#
# validate-all.sh - Wrapper for go-live-check.sh with REQS/PAR support
#
# Usage:
#   BASE_URL=<url> REQS=60 PAR=12 bash scripts/validate-all.sh
#
# Environment Variables:
#   BASE_URL          - Target URL (default: staging)
#   REQS              - Number of burst requests (maps to BURST_N)
#   PAR               - Parallelism level (maps to BURST_P)
#   X_ADMIN_TOKEN     - Admin token for P0-1 validation
#   RUN_ADMIN         - Enable admin endpoint tests (default: 1)
#   AUTO_COMMIT       - Auto-commit artifacts (default: 0)

set -euo pipefail

# Map REQS/PAR to go-live-check params
export BURST_N="${REQS:-15}"
export BURST_P="${PAR:-15}"
export RUN_BURST="${RUN_BURST:-1}"

# Pass through other env vars
export BASE_URL="${BASE_URL:-https://rom-agent-ia-onrender-com.onrender.com}"
export X_ADMIN_TOKEN="${X_ADMIN_TOKEN:-}"
export RUN_ADMIN="${RUN_ADMIN:-1}"
export AUTO_COMMIT="${AUTO_COMMIT:-0}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "=== ROM Agent - Comprehensive Validation ==="
echo ""
echo "Configuration:"
echo "  BASE_URL: $BASE_URL"
echo "  Burst requests: $BURST_N (concurrency: $BURST_P)"
echo "  Admin tests: $([ "$RUN_ADMIN" = "1" ] && echo "enabled" || echo "disabled")"
echo "  Auto-commit: $([ "$AUTO_COMMIT" = "1" ] && echo "enabled" || echo "disabled")"
echo ""

# Run go-live-check with mapped parameters
exec "$SCRIPT_DIR/go-live-check.sh"
