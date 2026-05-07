# Production Deployment

Panduan deploy stack WSO2 Custom Admin Panel ke server production.
Terdiri dari: MySQL, WSO2 APIM 4.3.0, Custom Admin Panel (Express+React),
dan Nginx reverse proxy.

> Asumsi: target server Linux (Ubuntu 22.04+ / RHEL 9), akses sudo,
> domain sudah ter-resolve ke server, port 80/443 terbuka.

---

## 1. Sizing & Pre-flight

| Komponen | Minimum | Rekomendasi |
|---|---|---|
| CPU | 4 core | 8 core |
| RAM | 6 GB | 12 GB (WSO2 ~3 GB, MySQL 1 GB, Node 512 MB, OS+buffer) |
| Disk | 30 GB SSD | 100 GB SSD (logs + audit + DB growth) |
| Swap | 2 GB | 4 GB |

WSO2 APIM single-node butuh `-Xmx2048m` JVM (lihat `JAVA_OPTS` di `.env`).
Naikkan ke `-Xmx4096m` kalau traffic > 100 RPS.

```bash
# OS basics
sudo apt update && sudo apt install -y docker.io docker-compose-plugin git ufw fail2ban
sudo usermod -aG docker $USER && newgrp docker

# Firewall
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable

# Increase file limits (WSO2 needs >65k FDs)
echo '* soft nofile 65535' | sudo tee -a /etc/security/limits.conf
echo '* hard nofile 65535' | sudo tee -a /etc/security/limits.conf
```

---

## 2. Clone & directory layout

```bash
sudo mkdir -p /opt/wso2-custom-admin
sudo chown $USER:$USER /opt/wso2-custom-admin
cd /opt/wso2-custom-admin
git clone <repo-url> .
git checkout main   # atau tag rilis: v0.2.0
```

Struktur folder yang harus ada di host (mounted ke container):

```
/opt/wso2-custom-admin/
├── .env                       # ← buat dari .env.example, JANGAN commit
├── docker-compose.yml
├── mysql/scripts/             # init.sql + seed dump
├── wso2/
│   ├── configs/deployment.toml
│   ├── customization/         # theme + images
│   ├── libs/                  # mysql-connector-j-*.jar
│   └── logs/                  # akan terisi runtime
├── nginx/
│   ├── conf.d/
│   └── ssl/                   # cert + key real (bukan self-signed)
└── admin-panel/               # source di-build di container
```

---

## 3. Generate strong secrets

Jangan pakai default dev passwords. Untuk tiap secret, generate baru:

```bash
# 32-byte random secret (admin panel session, hex)
openssl rand -hex 32

# Strong DB passwords
openssl rand -base64 24

# WSO2 admin password — pakai password manager, simpan di `.env`
```

Edit `.env` (salin dari template di repo, ganti semua nilai):

```env
# === SERVER ===
HOSTNAME=apim.example.com
NODE_IP=<public_ip>

# === WSO2 ADMIN ===
WSO2_ADMIN_USER=admin
WSO2_ADMIN_PASSWORD=                                    # KOSONGKAN di prod
WSO2_ADMIN_PASSWORD_HASH=$2b$10$xxxxxxxxxxxxxxxxxxxxxx  # pakai hash (lihat §4)

# === DATABASE ===
MYSQL_ROOT_PASSWORD=<32-char-random>
MYSQL_USER=apimuser
MYSQL_PASSWORD=<32-char-random>

# === ADMIN PANEL ===
ADMIN_PANEL_SECRET=<openssl rand -hex 32>
NODE_ENV=production

# === SSO (kalau dipakai) ===
OIDC_ENABLED=true
OIDC_CLIENT_ID=<re-register di sada-api dengan callback prod>
OIDC_CLIENT_SECRET=<dari sada-api>
OIDC_AUTHORIZE_URL=https://sso.example.com/authorize
OIDC_TOKEN_URL=https://sso.example.com/oauth/token
OIDC_USERINFO_URL=https://sso.example.com/oauth/userinfo
OIDC_END_SESSION_URL=https://sso.example.com/oauth/logout
OIDC_CALLBACK_URL=https://apim.example.com/api/auth/callback
OIDC_POST_LOGOUT_URL=https://apim.example.com/login
```

**`chmod 600 .env`** dan exclude dari backup yang tidak terenkripsi.
Pertimbangkan secret manager (Vault, AWS Secrets Manager, Doppler) untuk
load saat compose up via `docker compose --env-file ...`.

---

## 4. Hash WSO2 admin password

Plaintext password di `.env` rawan di production. Generate hash:

```bash
# After admin-panel container exists (lihat §7), jalankan:
docker exec wso2-admin-panel node scripts/hash-password.js '<password>'

# Output bcrypt hash → masukan ke WSO2_ADMIN_PASSWORD_HASH, kosongkan WSO2_ADMIN_PASSWORD.
```

---

## 5. TLS certificate

**Jangan pakai self-signed cert** dari `nginx/ssl/`. Ganti dengan cert dari CA.

### Opsi A — Let's Encrypt (gratis, otomatis renew)

```bash
sudo apt install -y certbot

# Issue cert (matikan nginx container dulu, atau pakai webroot mode)
docker compose stop nginx
sudo certbot certonly --standalone -d apim.example.com -m ops@example.com --agree-tos

# Symlink ke folder yang di-mount nginx
sudo ln -sf /etc/letsencrypt/live/apim.example.com/fullchain.pem nginx/ssl/server.crt
sudo ln -sf /etc/letsencrypt/live/apim.example.com/privkey.pem   nginx/ssl/server.key
sudo chmod 644 nginx/ssl/server.crt
sudo chmod 600 nginx/ssl/server.key
docker compose up -d nginx

# Auto-renew (cron / systemd timer)
echo "0 3 * * * /usr/bin/certbot renew --quiet --post-hook 'docker compose -f /opt/wso2-custom-admin/docker-compose.yml restart nginx'" \
  | sudo tee /etc/cron.d/certbot-renew
```

### Opsi B — cert dari CA korporat / Cloudflare Origin / dll

Copy file ke `nginx/ssl/server.crt` (chain) dan `nginx/ssl/server.key`.
Update `nginx/conf.d/default.conf` kalau path beda.

---

## 6. WSO2 hardening

Edit `wso2/configs/deployment.toml`:

```toml
[server]
hostname = "apim.example.com"   # bukan localhost
node_ip  = "127.0.0.1"
mode     = "single"

[super_admin]
username = "admin"
admin_role = "admin"
create_admin_account = true

# Disable Carbon Console kalau tidak dipakai (recommended)
[transport.https.properties]
proxyPort = 443

# Tighten password policy
[identity_mgt.password_policy]
enable = true
min_length = 12
max_length = 64
pattern = "^((?=.*\\d)(?=.*[a-z])(?=.*[A-Z])(?=.*[!@#$%^&*])).{12,64}$"

# Session timeout (default 15 min — naikkan kalau perlu)
[oauth.session_data_cache]
timeout_in_seconds = 1800
```

Setelah deployment.toml diubah, container WSO2 harus di-restart.
WSO2 baca file ini hanya saat startup.

**Ganti default `admin/admin`**: setelah container up pertama kali, login
ke Carbon (`https://apim.example.com/carbon`) dan ganti password admin.
Atau set di `deployment.toml` sebelum first start (lebih aman).

---

## 7. Build & first run

```bash
cd /opt/wso2-custom-admin

# Pull WSO2 image (besar ~1.5GB)
docker compose pull wso2apim

# Build admin-panel image (Vite build di-trigger dalam Dockerfile)
docker compose build admin-panel

# Pre-load WSO2 schema (skip kalau sudah ada di mysql/scripts/)
ls mysql/scripts/wso2_apim_db.sql mysql/scripts/wso2_shared_db.sql

# Start MySQL dulu, biarkan schema ter-init
docker compose up -d mysql
docker compose logs -f mysql   # tunggu "ready for connections"

# Start sisanya
docker compose up -d

# Tunggu warmup (~3-5 menit)
docker compose logs -f wso2apim   # tunggu "WSO2 Carbon started in ... sec"
```

---

## 8. Smoke test

```bash
# Health checks
curl -kI https://apim.example.com/admin    # admin panel — harus 200/302
curl -kI https://apim.example.com/publisher # WSO2 publisher — harus 302
curl -kI https://apim.example.com/devportal # WSO2 devportal — harus 302

# Login local ke admin panel
curl -k -c cookies.txt -X POST https://apim.example.com/api/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"admin","password":"<password>"}'

# Login SSO (kalau dipakai) — buka browser, klik tombol "Login dengan SADA SSO"

# Theme save end-to-end test
curl -k -b cookies.txt -X POST https://apim.example.com/api/theme/devportal \
  -H 'Content-Type: application/json' \
  -d '{"primaryColor":"#ff5722"}'
```

---

## 9. Backup strategy

```bash
# Daily MySQL dump (cron @ 02:00)
cat > /etc/cron.daily/wso2-db-backup <<'EOF'
#!/bin/bash
TS=$(date +%Y%m%d-%H%M)
DEST=/var/backups/wso2
mkdir -p "$DEST"
docker exec wso2-mysql mysqldump --all-databases \
  -uroot -p"$(grep MYSQL_ROOT_PASSWORD /opt/wso2-custom-admin/.env | cut -d= -f2)" \
  --single-transaction --routines --triggers \
  | gzip > "$DEST/all-databases-$TS.sql.gz"
find "$DEST" -name '*.sql.gz' -mtime +14 -delete
EOF
chmod +x /etc/cron.daily/wso2-db-backup
```

Backup yang juga harus di-snapshot:

- `/opt/wso2-custom-admin/.env` (offsite, encrypted)
- `wso2/customization/` (theme files)
- `nginx/ssl/` (kalau bukan Let's Encrypt auto-renew)
- Volume `wso2-data` (jika dipakai untuk registry/repository)

Test restore minimal sekali per quarter.

---

## 10. Logging & monitoring

```bash
# Configure Docker log rotation (cegah disk penuh)
sudo tee /etc/docker/daemon.json <<'EOF'
{
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "100m",
    "max-file": "5"
  }
}
EOF
sudo systemctl restart docker
docker compose up -d   # recreate dengan log driver baru
```

Monitor minimum:

- **Disk**: `/var/lib/docker/containers/`, `wso2/logs/`, MySQL data volume
- **WSO2 health**: `curl -k https://apim.example.com/services/Version` harus 200
- **Cert expiry**: `openssl x509 -in nginx/ssl/server.crt -noout -enddate`
- **Auth failures**: tail `wso2/logs/wso2carbon.log` untuk pattern `Authentication failed`

Tools yang fit: Prometheus + Grafana (WSO2 expose JMX metrics), atau
container logs ke Loki / ELK.

---

## 11. Update / rollback procedure

```bash
cd /opt/wso2-custom-admin

# Update flow
git fetch origin
git checkout v0.3.0       # tag rilis baru
docker compose pull        # pull image baru
docker compose up -d       # rolling: stop+up tiap service yang berubah
docker compose logs -f     # monitor warmup

# Rollback flow
git checkout v0.2.0
docker compose up -d
# Kalau ada DB migration yang tidak idempotent, restore dump:
gunzip -c /var/backups/wso2/all-databases-<timestamp>.sql.gz \
  | docker exec -i wso2-mysql mysql -uroot -p"$MYSQL_ROOT_PASSWORD"
```

Pre-deployment checklist:

- [ ] Backup DB selesai dan tested
- [ ] Tag rilis ada di repo
- [ ] CHANGELOG entry untuk versi baru
- [ ] Off-hours window (WSO2 restart = ~3 min downtime)
- [ ] Smoke-test plan disiapkan

---

## 12. Common pitfalls

| Symptom | Root cause | Fix |
|---|---|---|
| WSO2 `&amp;` error pada startup | XML entity di JDBC URL `deployment.toml` | Replace `&` → `&amp;` |
| `ClassNotFoundException: com.mysql.cj.jdbc.Driver` | mysql-connector jar tidak ter-mount | Letakkan jar di `wso2/libs/`, restart |
| WSO2 publisher 502 dari nginx | WSO2 belum warm | Tunggu 3-5 menit setelah startup |
| Container OOMKilled | `JAVA_OPTS=-Xmx2048m` tapi server cuma 4GB | Naikkan RAM atau turunkan `-Xmx` |
| Login looping pasca SSO | Claim mapping atau JIT provisioning belum di-set | Lihat `docs/sso-integration.md` §6 |
| MySQL charset bug pada user federated | DB pakai latin1, OIDC claim Unicode | Migrasi schema ke utf8mb4 (hati-hati, butuh dump+restore) |

---

## 13. Production cutover checklist

- [ ] DNS A record → server IP, TTL 300
- [ ] Firewall: 80, 443 open; 9443/8243 **tutup** (akses lewat nginx)
- [ ] Cert valid > 30 hari, auto-renew aktif
- [ ] `.env` permissions 600, backup encrypted offsite
- [ ] WSO2 admin password sudah diganti, hash di-set
- [ ] DB backup cron ter-jadwal, sudah test restore minimal sekali
- [ ] Docker log rotation aktif
- [ ] Monitoring (uptime + cert expiry minimum) wired
- [ ] Smoke test (login local + SSO + theme save) PASS
- [ ] Runbook untuk on-call: lokasi log, akses kontainer, kontak vendor
- [ ] Rollback path tested di staging
