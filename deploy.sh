#!/bin/bash
# deploy.sh — run this on your Hostinger VPS after SSH-ing in
# Usage: bash deploy.sh

set -e

PROJECT_DIR="/opt/bookingai"
REPO_URL="https://github.com/YOUR_USERNAME/YOUR_REPO.git"  # replace with your git repo URL

echo "=== Booking AI — Deploy Script ==="

# ─── 1. Install Docker if not present ────────────────────────────────────────
if ! command -v docker &> /dev/null; then
  echo "Installing Docker..."
  curl -fsSL https://get.docker.com | sh
  systemctl enable docker
  systemctl start docker
  echo "Docker installed."
else
  echo "Docker already installed: $(docker --version)"
fi

# ─── 2. Install Docker Compose plugin if not present ─────────────────────────
if ! docker compose version &> /dev/null; then
  echo "Installing Docker Compose plugin..."
  apt-get update -qq
  apt-get install -y -qq docker-compose-plugin
  echo "Docker Compose installed."
else
  echo "Docker Compose already installed."
fi

# ─── 3. Clone or pull the project ────────────────────────────────────────────
if [ -d "$PROJECT_DIR/.git" ]; then
  echo "Pulling latest changes..."
  cd "$PROJECT_DIR"
  git pull origin main
else
  echo "Cloning project..."
  git clone "$REPO_URL" "$PROJECT_DIR"
  cd "$PROJECT_DIR"
fi

# ─── 4. Check .env exists ────────────────────────────────────────────────────
if [ ! -f "$PROJECT_DIR/.env" ]; then
  echo ""
  echo "ERROR: .env file not found at $PROJECT_DIR/.env"
  echo "Copy .env.example to .env and fill in your real values:"
  echo "  cp $PROJECT_DIR/.env.example $PROJECT_DIR/.env"
  echo "  nano $PROJECT_DIR/.env"
  exit 1
fi

# ─── 5. Set up SSL certificates with Let's Encrypt ───────────────────────────
echo ""
echo "=== SSL Certificate Setup ==="
if [ ! -f "$PROJECT_DIR/nginx/ssl/fullchain.pem" ]; then
  echo "SSL certs not found. Setting up with Certbot..."

  # Install certbot
  apt-get update -qq
  apt-get install -y -qq certbot

  read -p "Enter your domain name (e.g. bookingai.yourdomain.com): " DOMAIN

  # Get cert (standalone mode — nginx is not running yet)
  certbot certonly --standalone -d "$DOMAIN" --non-interactive --agree-tos \
    --register-unsafely-without-email

  # Copy certs to nginx/ssl directory
  mkdir -p "$PROJECT_DIR/nginx/ssl"
  cp /etc/letsencrypt/live/"$DOMAIN"/fullchain.pem "$PROJECT_DIR/nginx/ssl/"
  cp /etc/letsencrypt/live/"$DOMAIN"/privkey.pem "$PROJECT_DIR/nginx/ssl/"
  chmod 644 "$PROJECT_DIR/nginx/ssl/fullchain.pem"
  chmod 600 "$PROJECT_DIR/nginx/ssl/privkey.pem"

  echo "SSL certificates installed."
else
  echo "SSL certificates already present."
fi

# ─── 6. Build and start all services ─────────────────────────────────────────
echo ""
echo "=== Building and starting services ==="
cd "$PROJECT_DIR"
docker compose pull postgres redis  # pull base images first
docker compose build --no-cache
docker compose up -d

echo ""
echo "=== Waiting for services to be healthy... ==="
sleep 15

docker compose ps

echo ""
echo "=== Deploy complete! ==="
echo "Your app should be available at: https://$DOMAIN"
echo ""
echo "Useful commands:"
echo "  View logs:        docker compose logs -f"
echo "  Restart:          docker compose restart"
echo "  Stop:             docker compose down"
echo "  Backend logs:     docker compose logs -f fastapi"
echo "  Celery logs:      docker compose logs -f celery"
