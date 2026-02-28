#!/bin/bash
set -e

# ─── RosterSyncOS Demo Setup ────────────────────────────────────
# One-command setup for the full demo environment.
# Prerequisites: Node.js 18+, pnpm, PostgreSQL running on :5433
# ─────────────────────────────────────────────────────────────────

echo "╔═══════════════════════════════════════════════════════╗"
echo "║           RosterSyncOS — Demo Setup                  ║"
echo "╚═══════════════════════════════════════════════════════╝"
echo ""

# Navigate to monorepo root
cd "$(dirname "$0")/.."

# 1. Install dependencies
echo "→ Installing dependencies..."
pnpm install --frozen-lockfile 2>/dev/null || pnpm install

# 2. Copy .env if not exists
if [ ! -f apps/api/.env ]; then
    echo "→ Creating .env from .env.example..."
    cp .env.example apps/api/.env
fi

# 3. Generate Prisma Client
echo "→ Generating Prisma Client..."
cd apps/api
npx prisma generate

# 4. Push schema to database
echo "→ Pushing schema to database..."
npx prisma db push --skip-generate

# 5. Seed demo data
echo "→ Seeding demo data..."
npx tsx prisma/seed.ts

cd ../..

# 6. Build everything
echo "→ Building all packages..."
npx turbo build

echo ""
echo "╔═══════════════════════════════════════════════════════╗"
echo "║                  Setup Complete!                     ║"
echo "╠═══════════════════════════════════════════════════════╣"
echo "║                                                     ║"
echo "║  Start the API:                                     ║"
echo "║    cd apps/api && pnpm dev                          ║"
echo "║                                                     ║"
echo "║  Start the Web:                                     ║"
echo "║    cd apps/web && pnpm dev                          ║"
echo "║                                                     ║"
echo "║  Or both at once:                                   ║"
echo "║    npx turbo dev                                    ║"
echo "║                                                     ║"
echo "║  Demo Credentials:                                  ║"
echo "║    Admin:      admin@rostersyncos.io / Admin2026!   ║"
echo "║    Scheduler:  scheduler@rostersyncos.io / Demo2026!║"
echo "║    Instructor: carole@rostersyncos.io / Demo2026!   ║"
echo "║                                                     ║"
echo "║  API:  http://127.0.0.1:3001                        ║"
echo "║  Web:  http://127.0.0.1:3000                        ║"
echo "║                                                     ║"
echo "╚═══════════════════════════════════════════════════════╝"
