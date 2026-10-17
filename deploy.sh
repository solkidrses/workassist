#!/usr/bin/env bash
set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

REPO_URL="https://github.com/solkidrses/workassist.git"
APP_DIR="/home/tgshkabots/bots/tehpodhelper"

echo -e "${CYAN}=== Deploy: WorkAssist Mini App ===${NC}"
echo

# --- Collect inputs ---
read -rp "Domain (e.g. myapp.example.com): " DOMAIN
read -rp "Admin Telegram ID: " ADMIN_ID
read -rp "Bot Token (from BotFather): " BOT_TOKEN
read -rp "DeepSeek API Key: " DEEPSEEK_KEY
read -rp "SiliconFlow API Key (for photo OCR + embeddings): " SILICONFLOW_KEY
read -rp "Email for SSL certificates: " SSL_EMAIL
read -rp "SSH port (current, to avoid lockout): " SSH_PORT
SSH_PORT=${SSH_PORT:-22}
INTERNAL_KEY=$(openssl rand -hex 32)
DB_PASS=$(openssl rand -hex 16)

echo
echo -e "${YELLOW}--- Summary ---${NC}"
echo -e "  Domain:       $DOMAIN"
echo -e "  Admin ID:     $ADMIN_ID"
echo -e "  App dir:      $APP_DIR"
echo -e "  Repo:         $REPO_URL"
echo -e "  SSL email:    $SSL_EMAIL"
echo -e "  SSH port:     $SSH_PORT"
echo -e "  Embeddings:   SiliconFlow (Qwen3-Embedding-4B)"
echo
read -rp "Continue? (y/n): " CONFIRM
[[ "${CONFIRM,,}" == "y" ]] || exit 0

# --- Install packages (skip if already installed) ---
echo -e "${CYAN}Checking packages...${NC}"

if ! command -v nginx &>/dev/null; then
    echo "  Installing nginx..."
    sudo apt-get update -qq
    sudo apt-get install -y -qq nginx
fi

if ! command -v certbot &>/dev/null; then
    echo "  Installing certbot..."
    sudo apt-get install -y -qq certbot python3-certbot-nginx
fi

if ! command -v docker &>/dev/null; then
    echo "  Installing Docker..."
    sudo apt-get install -y -qq docker.io docker-compose-v2
    sudo systemctl enable --now docker
    sudo usermod -aG docker "$USER"
fi

if ! command -v git &>/dev/null; then
    echo "  Installing git..."
    sudo apt-get install -y -qq git
fi

echo -e "${GREEN}  Packages OK${NC}"

# --- Clone or pull repo ---
echo -e "${CYAN}Fetching code...${NC}"
if [ -d "$APP_DIR/.git" ]; then
    cd "$APP_DIR"
    git pull origin main
else
    mkdir -p "$(dirname "$APP_DIR")"
    git clone "$REPO_URL" "$APP_DIR"
    cd "$APP_DIR"
fi
echo -e "${GREEN}  Code ready${NC}"

# --- Generate .env ---
echo -e "${CYAN}Creating .env...${NC}"
cat > .env <<EOF
DATABASE_URL="postgresql://tehpod:${DB_PASS}@db:5432/tehpod?schema=public"
BOT_TOKEN=${BOT_TOKEN}
ADMIN_TELEGRAM_ID=${ADMIN_ID}
DEEPSEEK_API_KEY=${DEEPSEEK_KEY}
SILICONFLOW_API_KEY=${SILICONFLOW_KEY}
INTERNAL_API_KEY=${INTERNAL_KEY}
NEXT_PUBLIC_TMA_URL=https://${DOMAIN}
API_URL=http://app:3000
DB_USER=tehpod
DB_PASSWORD=${DB_PASS}
DB_NAME=tehpod
EOF
chmod 600 .env
echo -e "${GREEN}  .env created${NC}"

# --- Nginx config ---
echo -e "${CYAN}Configuring Nginx...${NC}"
sudo tee /etc/nginx/sites-available/${DOMAIN} > /dev/null <<NGINX
server {
    listen 80;
    server_name ${DOMAIN};

    client_max_body_size 30M;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;

        proxy_connect_timeout 300s;
        proxy_send_timeout 300s;
        proxy_read_timeout 300s;
    }
}
NGINX

sudo ln -sf /etc/nginx/sites-available/${DOMAIN} /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx
echo -e "${GREEN}  Nginx configured${NC}"

# --- SSL ---
echo -e "${CYAN}Getting SSL certificate...${NC}"
sudo certbot --nginx -d ${DOMAIN} --non-interactive --agree-tos -m ${SSL_EMAIL} --redirect
echo -e "${GREEN}  SSL certificate installed (auto-renewal enabled)${NC}"

# --- Firewall ---
echo -e "${CYAN}Configuring firewall...${NC}"
sudo ufw allow ${SSH_PORT}/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw --force enable
echo -e "${GREEN}  Firewall: ${SSH_PORT}, 80, 443 open${NC}"

# --- Ensure data directories ---
mkdir -p "$APP_DIR/data/uploads"
sudo chmod -R 777 "$APP_DIR/data" 2>/dev/null || true

# --- Build & start containers ---
echo -e "${CYAN}Building Docker containers...${NC}"
sudo docker compose up -d --build
sudo chmod -R 777 "$APP_DIR/data" 2>/dev/null || true
echo -e "${GREEN}  Containers started${NC}"

# --- Wait for app to be healthy ---
echo -e "${CYAN}Waiting for app to start...${NC}"
sleep 10

# --- Initialize database ---
echo -e "${CYAN}Initializing database...${NC}"
sudo docker compose exec -T app npx prisma migrate deploy 2>/dev/null || sudo docker compose exec -T app npx prisma db push 2>&1 || true
echo -e "${GREEN}  Database initialized${NC}"

# --- Done ---
echo
echo -e "${GREEN}========================${NC}"
echo -e "${GREEN}   Deploy complete!     ${NC}"
echo -e "${GREEN}========================${NC}"
echo
echo -e "App URL:    ${CYAN}https://${DOMAIN}${NC}"
echo -e "Containers: ${CYAN}sudo docker compose ps${NC}"
echo -e "Logs:       ${CYAN}sudo docker compose logs -f${NC}"
echo
echo -e "${YELLOW}REMAINING MANUAL STEP:${NC}"
echo -e "Go to @BotFather -> Bot Settings -> Menu URL / Web App"
echo -e "Set URL to: ${CYAN}https://${DOMAIN}${NC}"
echo
echo -e "${YELLOW}For future updates:${NC}"
echo -e "  ${CYAN}cd ${APP_DIR} && git pull && sudo docker compose up -d --build${NC}"
echo
echo -e "${YELLOW}.env saved at ${APP_DIR}/.env (chmod 600)${NC}"
echo -e "${YELLOW}SSL auto-renews via certbot timer${NC}"
