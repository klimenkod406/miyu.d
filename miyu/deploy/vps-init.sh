#!/bin/bash
set -euo pipefail

echo "=== Miyu VPS Initialization ==="
echo "Target: Ubuntu 22.04 / 24.04"
echo "Started at: $(date -u '+%Y-%m-%dT%H:%M:%SZ')"
echo ""

# ------------------------------------------------------------------
# 1. System update
# ------------------------------------------------------------------
echo "[1/8] Updating system packages..."
apt-get update -qq
apt-get upgrade -y -qq
echo "  Done."
echo ""

# ------------------------------------------------------------------
# 2. Install Docker (idempotent)
# ------------------------------------------------------------------
echo "[2/8] Setting up Docker..."
if ! command -v docker &>/dev/null; then
  echo "  Docker not found — installing..."
  apt-get install -y -qq ca-certificates curl

  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
  chmod a+r /etc/apt/keyrings/docker.asc

  # Add Docker repository
  CODENAME=$(. /etc/os-release && echo "$VERSION_CODENAME")
  ARCH=$(dpkg --print-architecture)
  echo "deb [arch=${ARCH} signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu ${CODENAME} stable" \
    | tee /etc/apt/sources.list.d/docker.list > /dev/null

  apt-get update -qq
  apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

  echo "  Docker installed successfully."
else
  echo "  Docker already installed — skipping."
fi
echo "  $(docker --version 2>/dev/null || echo 'unknown')"
echo "  $(docker compose version 2>/dev/null || echo 'unknown')"
echo ""

# ------------------------------------------------------------------
# 3. Configure firewall (ufw)
# ------------------------------------------------------------------
echo "[3/8] Configuring firewall (ufw)..."
if ! command -v ufw &>/dev/null; then
  apt-get install -y -qq ufw
fi

# Reset to clean state (idempotent)
ufw --force reset >/dev/null 2>&1 || true

ufw default deny incoming >/dev/null
ufw default allow outgoing >/dev/null
ufw allow 22/tcp comment 'SSH' >/dev/null
ufw allow 80/tcp comment 'HTTP' >/dev/null
ufw allow 443/tcp comment 'HTTPS' >/dev/null

# Enable (idempotent — skip if already active)
if ! ufw status | grep -q "^Status: active"; then
  ufw --force enable >/dev/null
fi

echo "  Done — ports allowed: 22, 80, 443"
echo ""

# ------------------------------------------------------------------
# 4. Install and configure fail2ban
# ------------------------------------------------------------------
echo "[4/8] Installing and configuring fail2ban..."
if ! command -v fail2ban-client &>/dev/null; then
  apt-get install -y -qq fail2ban
fi

# Write SSH jail config (idempotent — overwrites on re-run, which is fine)
cat > /etc/fail2ban/jail.local << 'JAIL'
[sshd]
enabled = true
port = ssh
filter = sshd
logpath = /var/log/auth.log
maxretry = 5
bantime = 3600
findtime = 600
JAIL

systemctl enable fail2ban >/dev/null 2>&1 || true
systemctl restart fail2ban >/dev/null 2>&1 || true

echo "  fail2ban enabled — SSH jail active"
echo ""

# ------------------------------------------------------------------
# 5. Install openssl
# ------------------------------------------------------------------
echo "[5/8] Installing openssl..."
if ! command -v openssl &>/dev/null; then
  apt-get install -y -qq openssl
  echo "  openssl installed."
else
  echo "  openssl already installed — skipping."
fi
echo "  $(openssl version 2>/dev/null || echo 'unknown')"
echo ""

# ------------------------------------------------------------------
# 6. Set timezone to UTC
# ------------------------------------------------------------------
echo "[6/8] Setting timezone to UTC..."
timedatectl set-timezone UTC 2>/dev/null || ln -sf /usr/share/zoneinfo/UTC /etc/localtime
echo "  Timezone: $(timedatectl show --property=Timezone --value 2>/dev/null || cat /etc/timezone)"
echo ""

# ------------------------------------------------------------------
# 7. Create required directories
# ------------------------------------------------------------------
echo "[7/8] Creating required directories..."
mkdir -p /data
mkdir -p /var/www/uploads/avatars
mkdir -p /var/www/uploads/tracks
mkdir -p /var/www/uploads/videos
mkdir -p /etc/nginx/ssl
echo "  Directories created:"
echo "    /data"
echo "    /var/www/uploads/{avatars,tracks,videos}"
echo "    /etc/nginx/ssl"
echo ""

# ------------------------------------------------------------------
# 8. Enable unattended-upgrades
# ------------------------------------------------------------------
echo "[8/8] Enabling automatic security updates..."
if ! dpkg -s unattended-upgrades &>/dev/null; then
  apt-get install -y -qq unattended-upgrades
fi

cat > /etc/apt/apt.conf.d/20auto-upgrades << 'UPGRADES'
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Download-Upgradeable-Packages "1";
APT::Periodic::AutocleanInterval "7";
APT::Periodic::Unattended-Upgrade "1";
UPGRADES

echo "  unattended-upgrades configured."
echo ""

# ------------------------------------------------------------------
# Summary
# ------------------------------------------------------------------
echo "=== VPS initialization complete ==="
echo ""
echo "--- Versions ---"
docker --version 2>/dev/null || echo "  docker: NOT FOUND"
docker compose version 2>/dev/null || echo "  docker compose: NOT FOUND"
echo ""
echo "--- Firewall ---"
ufw status verbose 2>/dev/null | head -20
echo ""
echo "--- fail2ban ---"
fail2ban-client status sshd 2>/dev/null || echo "  sshd jail: checking..."
echo ""
echo "Finished at: $(date -u '+%Y-%m-%dT%H:%M:%SZ')"
