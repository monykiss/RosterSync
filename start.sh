#!/bin/sh
set -e

cd /app/apps/api

echo "Running Prisma migrations..."
PRISMA_BIN="../../node_modules/.pnpm/prisma@5.22.0/node_modules/prisma/build/index.js"
if [ ! -f "$PRISMA_BIN" ]; then
  PRISMA_BIN=$(find ../../node_modules ./node_modules -maxdepth 6 -path "*/prisma@*/build/index.js" 2>/dev/null | head -1)
fi
if [ -n "$PRISMA_BIN" ] && [ -f "$PRISMA_BIN" ]; then
  node "$PRISMA_BIN" migrate deploy --schema ./prisma/schema.prisma
  echo "Migrations complete."
else
  echo "WARNING: Prisma binary not found, skipping migrations."
fi

echo "Starting API server..."
exec node dist/src/main.js
