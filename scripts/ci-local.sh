#!/bin/bash
# CI Local - Testes paralelos com 10 cores
set -e

echo "🧪 CI Local (10 cores) - ROM Agent"
echo "===================================="
echo ""

# Linter
echo "📝 Running linter..."
npm run lint
echo "✅ Lint passed"
echo ""

# Testes unitários (10 workers paralelos)
echo "🧪 Running tests (10 workers)..."
npm run test -- --maxWorkers=10 --silent=false
echo "✅ Tests passed"
echo ""

echo "===================================="
echo "✅ CI LOCAL PASSOU"
echo "===================================="
