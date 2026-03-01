#!/bin/sh
set -e

cd /app/apps/api

echo "Running Prisma migrations..."
# Find prisma binary in the app-local or workspace-level pnpm layout.
PRISMA_BIN=$(
  (find ./node_modules ../../node_modules -maxdepth 5 -path "*/prisma@*/build/index.js" 2>/dev/null || true) \
    | head -1
)
if [ -n "$PRISMA_BIN" ]; then
  node "$PRISMA_BIN" migrate deploy --schema ./prisma/schema.prisma
  echo "Migrations complete."
else
  echo "Prisma binary not found, skipping migrations."
fi

echo "Starting API server..."
exec node dist/src/main.js
