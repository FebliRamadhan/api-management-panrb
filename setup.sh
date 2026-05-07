#!/bin/bash
# ─────────────────────────────────────────────────────
# WSO2 API Manager + Custom Admin Panel - Setup Script
# Jalankan: chmod +x setup.sh && ./setup.sh
# ─────────────────────────────────────────────────────

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${CYAN}"
echo "╔══════════════════════════════════════════════╗"
echo "║   WSO2 API Manager Setup                     ║"
echo "║   Custom Admin Panel + Docker                ║"
echo "╚══════════════════════════════════════════════╝"
echo -e "${NC}"

# ── Check Docker ──────────────────────────────────────
echo -e "${BLUE}[1/5]${NC} Memeriksa Docker..."
if ! command -v docker &>/dev/null; then
  echo -e "${RED}✗ Docker tidak ditemukan. Install Docker terlebih dahulu.${NC}"
  exit 1
fi

if ! command -v docker-compose &>/dev/null && ! docker compose version &>/dev/null; then
  echo -e "${RED}✗ Docker Compose tidak ditemukan.${NC}"
  exit 1
fi
echo -e "${GREEN}✓ Docker tersedia${NC}"

# ── Create SSL directory ──────────────────────────────
echo -e "${BLUE}[2/5]${NC} Membuat SSL self-signed certificate..."
mkdir -p nginx/ssl
if [ ! -f nginx/ssl/cert.pem ]; then
  openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
    -keyout nginx/ssl/key.pem \
    -out nginx/ssl/cert.pem \
    -subj "/C=ID/ST=Jakarta/L=Jakarta/O=MyCompany/CN=localhost" 2>/dev/null
  echo -e "${GREEN}✓ SSL certificate dibuat${NC}"
else
  echo -e "${YELLOW}⚠ SSL certificate sudah ada, skip.${NC}"
fi

# ── Create placeholder image directories ─────────────
echo -e "${BLUE}[3/5]${NC} Menyiapkan direktori kustomisasi..."
mkdir -p wso2/customization/devportal/images
mkdir -p wso2/customization/publisher/images

# Create placeholder logo if not exists
if [ ! -f wso2/customization/devportal/images/logo.png ]; then
  # Create a simple SVG placeholder logo
  cat > wso2/customization/devportal/images/logo.svg << 'SVGEOF'
<svg xmlns="http://www.w3.org/2000/svg" width="200" height="50" viewBox="0 0 200 50">
  <rect width="200" height="50" rx="8" fill="#3b82f6"/>
  <text x="16" y="32" font-family="Arial" font-size="20" font-weight="bold" fill="white">API Portal</text>
</svg>
SVGEOF
  echo -e "${YELLOW}⚠ Logo placeholder dibuat (ganti dengan logo asli di admin panel)${NC}"
fi
echo -e "${GREEN}✓ Direktori kustomisasi siap${NC}"

# ── Pull Docker images ────────────────────────────────
echo -e "${BLUE}[4/5]${NC} Menarik Docker images (bisa memakan waktu)..."
docker pull mysql:8.0
docker pull nginx:alpine
echo -e "${YELLOW}⚠ Image WSO2 akan didownload saat docker-compose up (±1GB)${NC}"
echo -e "${GREEN}✓ Images siap${NC}"

# ── Start services ────────────────────────────────────
echo -e "${BLUE}[5/5]${NC} Menjalankan services..."
if docker compose version &>/dev/null; then
  docker compose up -d --build
else
  docker-compose up -d --build
fi

echo ""
echo -e "${GREEN}"
echo "╔══════════════════════════════════════════════╗"
echo "║   Setup Selesai!                             ║"
echo "╠══════════════════════════════════════════════╣"
echo "║                                              ║"
echo "║  Admin Panel  : http://localhost:3000        ║"
echo "║  Devportal    : https://localhost:9443/      ║"
echo "║                 devportal                    ║"
echo "║  Publisher    : https://localhost:9443/      ║"
echo "║                 publisher                    ║"
echo "║                                              ║"
echo "║  Login        : admin / admin@WSO2#2024      ║"
echo "║                                              ║"
echo "║  WSO2 butuh ~2-3 menit untuk startup.       ║"
echo "║  Monitor: docker logs -f wso2-apim           ║"
echo "║                                              ║"
echo "╚══════════════════════════════════════════════╝"
echo -e "${NC}"
