#!/usr/bin/env bash
set -euo pipefail

TS="$(date +%Y-%m-%d_%H%M%S)"
OUT_DIR="backups"
NAME="rom-agent_${TS}"
ARCHIVE="${OUT_DIR}/${NAME}.tar.gz"

mkdir -p "${OUT_DIR}"

tar --exclude-vcs \
  --exclude="node_modules" \
  --exclude="backups" \
  --exclude=".DS_Store" \
  -czf "${ARCHIVE}" \
  src scripts docs package.json package-lock.json .env.example 2>/dev/null || \
tar --exclude-vcs \
  --exclude="node_modules" \
  --exclude="backups" \
  --exclude=".DS_Store" \
  -czf "${ARCHIVE}" \
  src scripts docs package.json .env.example

echo "✅ Backup criado: ${ARCHIVE}"
