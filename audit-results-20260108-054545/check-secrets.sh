#!/bin/bash

SECRETS_FILE="$1"

# Patterns suspeitos
grep -rn --include="*.js" --include="*.jsx" --include="*.ts" --include="*.tsx" \
  -E '(AWS_SECRET_ACCESS_KEY|ANTHROPIC_API_KEY|password\s*=\s*["\x27][^"\x27]+|api[_-]?key\s*=\s*["\x27][^"\x27]{20,}|secret\s*=\s*["\x27][^"\x27]+)' \
  src/ frontend/src/ 2>/dev/null | \
  grep -v "\.env" | \
  grep -v "\.example" | \
  grep -v "your-secret" | \
  grep -v "change-this" > "$SECRETS_FILE" || true
