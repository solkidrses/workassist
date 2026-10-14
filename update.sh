#!/usr/bin/env bash
set -euo pipefail

APP_DIR="/home/tgshkabots/bots/tehpodhelper"
cd "$APP_DIR"

echo "Pulling latest code..."
git pull origin main

echo "Rebuilding containers..."
sudo docker compose up -d --build

echo "Cleaning Docker cache..."
sudo docker builder prune -f
sudo docker image prune -f

echo "Running DB migration..."
sudo docker compose exec app npx prisma migrate deploy || sudo docker compose exec app npx prisma db push || true

echo "Done!"
sudo docker compose ps
