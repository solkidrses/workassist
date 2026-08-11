#!/usr/bin/env bash
set -euo pipefail

APP_DIR="/home/tgshkabots/bots/tehpodhelper"
cd "$APP_DIR"

echo "Pulling latest code..."
git pull origin main

echo "Rebuilding containers..."
sudo docker compose up -d --build

echo "Running DB migration..."
sudo docker compose exec app npx prisma db push --accept-data-loss 2>/dev/null || true

echo "Done!"
sudo docker compose ps
