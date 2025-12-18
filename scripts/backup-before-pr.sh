#!/bin/bash
# Backup before PR merge - Git tags + OneDrive copy
set -e

BACKUP_BASE="$HOME/Library/CloudStorage/OneDrive-Pessoal/ROM-Agent-CONSOLIDADO/BACKUPS-CHECKPOINTS"

echo "💾 Backup Before PR - ROM Agent"
echo "===================================="
echo ""

# Get current branch and PR number (if available)
BRANCH=$(git branch --show-current)
PR_NUM="${1:-unknown}"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
TAG_NAME="checkpoint-${TIMESTAMP}-pr${PR_NUM}"

echo "Branch: $BRANCH"
echo "PR: #$PR_NUM"
echo "Tag: $TAG_NAME"
echo ""

# Create git tag
echo "🏷️  Creating git tag..."
git tag -a "$TAG_NAME" -m "Checkpoint before merging PR #$PR_NUM"
echo "✅ Tag created: $TAG_NAME"
echo ""

# Push tag to remote
echo "📤 Pushing tag to remote..."
git push origin "$TAG_NAME" || {
  echo "⚠️  Could not push tag to remote (check permissions)"
}
echo ""

# Create backup directory
BACKUP_DIR="$BACKUP_BASE/$TAG_NAME"
mkdir -p "$BACKUP_DIR"

# Copy critical files
echo "📦 Copying critical files to OneDrive..."
rsync -a --exclude=node_modules --exclude=.git \
  ./ "$BACKUP_DIR/"
echo "✅ Backup saved to: $BACKUP_DIR"
echo ""

# Create backup manifest
cat > "$BACKUP_DIR/MANIFEST.txt" << EOF
ROM Agent Backup Checkpoint
===========================
Date: $(date)
Branch: $BRANCH
PR: #$PR_NUM
Tag: $TAG_NAME
Commit: $(git rev-parse HEAD)

Rollback instructions:
  git checkout $TAG_NAME
  git push origin main --force-with-lease

Location: $BACKUP_DIR
EOF

echo "📄 Manifest created"
echo ""

echo "===================================="
echo "✅ BACKUP COMPLETO"
echo "Tag: $TAG_NAME"
echo "Location: $BACKUP_DIR"
echo "===================================="
