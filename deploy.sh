#!/bin/bash
# deploy.sh — run on the VPS after files are uploaded
# Usage: bash /opt/duskai/deploy.sh

set -e

DOMAIN="duskai.net"
PROJECT_DIR="/opt/duskai"
EMAIL="Creativetitan1@gmail.com"

echo "=== Dusk AI — Deploy Script ==="
echo "Domain: $DOMAIN"
echo "Project: $PROJECT_DIR"
echo ""

# ─── 1. Install Docker ────────────────────────────────────────────────────────
if ! command -v docker &> /dev/null; then
  echo "[1/5] Installing Docker..."
  curl -fsSL https://get.docker.com | sh
  systemctl enable docker
  systemctl start docker
else
  echo "[1/5] Docker already installed: $(docker --version)"
fi

# ─── 2. Install Docker Compose plugin ────────────────────────────────────────
if ! docker compose version &> /dev/null; then
  echo "[2/5] Installing Docker Compose..."
  apt-get update -qq && apt-get install -y -qq docker-compose-plugin
else
  echo "[2/5] Docker Compose: $(docker compose version --short)"
fi

# ─── 3. Check .env ───────────────────────────────────────────────────────────
echo "[3/5] Checking .env..."
if [ ! -f "$PROJECT_DIR/.env" ]; then
  echo ""
  echo "ERROR: .env not found at $PROJECT_DIR/.env"
  echo "Run: cp $PROJECT_DIR/.env.example $PROJECT_DIR/.env && nano $PROJECT_DIR/.env"
  exit 1
fi
echo "      .env found."

# ─── 4. SSL Certificate ───────────────────────────────────────────────────────
echo "[4/5] Checking SSL certificate..."
SSL_DIR="$PROJECT_DIR/nginx/ssl"

if [ ! -f "$SSL_DIR/fullchain.pem" ]; then
  echo "      Getting Let's Encrypt cert for $DOMAIN..."
  apt-get install -y -qq certbot

  # Stop anything using port 80
  docker compose -f "$PROJECT_DIR/docker-compose.yml" down 2>/dev/null || true

  certbot certonly --standalone \
    -d "$DOMAIN" -d "www.$DOMAIN" \
    --non-interactive --agree-tos \
    --email "$EMAIL"

  mkdir -p "$SSL_DIR"
  cp /etc/letsencrypt/live/$DOMAIN/fullchain.pem "$SSL_DIR/"
  cp /etc/letsencrypt/live/$DOMAIN/privkey.pem  "$SSL_DIR/"
  chmod 644 "$SSL_DIR/fullchain.pem"
  chmod 600 "$SSL_DIR/privkey.pem"
  echo "      SSL certificate installed."
else
  echo "      SSL certificate already present."
fi

# ─── 5. Build and start ───────────────────────────────────────────────────────
echo "[5/5] Building and starting all services..."
cd "$PROJECT_DIR"
docker compose pull postgres redis
docker compose build --no-cache
docker compose up -d

echo ""
echo "Waiting 20s for services to become healthy..."
sleep 20

docker compose ps

echo ""
echo "=== Deploy complete! ==="
echo ""
echo "Your app: https://$DOMAIN"
echo "API:      https://$DOMAIN/api/v1/health"
echo ""
echo "Useful commands:"
echo "  Logs:         docker compose -f $PROJECT_DIR/docker-compose.yml logs -f"
echo "  Restart:      docker compose -f $PROJECT_DIR/docker-compose.yml restart"
echo "  Stop:         docker compose -f $PROJECT_DIR/docker-compose.yml down"
echo "  Backend logs: docker compose -f $PROJECT_DIR/docker-compose.yml logs -f fastapi"

# ─── Auto-renew SSL ───────────────────────────────────────────────────────────
if ! crontab -l 2>/dev/null | grep -q certbot; then
  (crontab -l 2>/dev/null; echo "0 3 * * * certbot renew --quiet && cp /etc/letsencrypt/live/$DOMAIN/fullchain.pem $SSL_DIR/ && cp /etc/letsencrypt/live/$DOMAIN/privkey.pem $SSL_DIR/ && docker compose -f $PROJECT_DIR/docker-compose.yml exec nginx nginx -s reload") | crontab -
  echo "SSL auto-renewal cron job added."
fi
