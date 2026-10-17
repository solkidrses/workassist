#!/usr/bin/env bash
set -euo pipefail

APP_DIR="/home/tgshkabots/bots/tehpodhelper"
cd "$APP_DIR"

# Ensure data/uploads directory exists and has write permissions for Docker nextjs user (UID 1001)
mkdir -p "$APP_DIR/data/uploads"
# Copy any legacy images from public/uploads if they exist
if [ -d "$APP_DIR/public/uploads" ]; then
    cp -rn "$APP_DIR/public/uploads"/* "$APP_DIR/data/uploads/" 2>/dev/null || true
fi
sudo chmod -R 777 "$APP_DIR/data" 2>/dev/null || chmod -R 777 "$APP_DIR/data" 2>/dev/null || true

echo "Pulling latest code..."
git pull origin main

echo "Rebuilding containers..."
sudo docker compose up -d --build

echo "Cleaning Docker cache..."
sudo docker builder prune -f
sudo docker image prune -f

echo "Running DB migration..."
sudo docker compose exec app npx prisma migrate deploy || sudo docker compose exec app npx prisma db push || true

# Re-ensure permissions after Docker mount
sudo chmod -R 777 "$APP_DIR/data" 2>/dev/null || true

echo "Done!"
sudo docker compose ps
