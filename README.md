# WSO2 API Manager + Custom Admin Panel

Paket lengkap WSO2 API Manager dengan Custom Admin Panel untuk mengelola tema dan tampilan portal tanpa perlu edit file secara manual.

## Struktur Folder

```
wso2-custom-admin/
├── .env                          # Environment variables
├── docker-compose.yml            # Konfigurasi semua service
├── setup.sh                      # Script setup otomatis
│
├── admin-panel/                  # Custom Admin Panel (Node.js)
│   ├── Dockerfile
│   ├── package.json
│   ├── server.js                 # Backend Express.js
│   └── public/
│       ├── index.html            # Dashboard utama
│       └── login.html            # Halaman login
│
├── nginx/
│   ├── nginx.conf                # Konfigurasi Nginx
│   ├── conf.d/default.conf       # Virtual host & proxy
│   └── ssl/                      # SSL certificates (auto-generated)
│
├── mysql/
│   └── scripts/init.sql          # Inisialisasi database
│
└── wso2/
    ├── configs/
    │   └── deployment.toml       # Konfigurasi WSO2 utama
    └── customization/
        ├── devportal/
        │   ├── theme/
        │   │   └── defaultTheme.js   # Tema Developer Portal
        │   └── images/               # Logo & gambar devportal
        └── publisher/
            ├── theme/
            │   └── defaultTheme.js   # Tema Publisher Portal
            └── images/               # Logo & gambar publisher
```

## Cara Mulai

### 1. Setup Pertama Kali

```bash
chmod +x setup.sh
./setup.sh
```

### 2. Manual (tanpa setup.sh)

```bash
# Buat SSL certificate
mkdir -p nginx/ssl
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout nginx/ssl/key.pem \
  -out nginx/ssl/cert.pem \
  -subj "/C=ID/ST=Jakarta/L=Jakarta/O=MyCompany/CN=localhost"

# Jalankan semua service
docker-compose up -d --build
```

## Akses Portal

| Portal | URL | Keterangan |
|--------|-----|------------|
| **Custom Admin Panel** | http://localhost:3000 | Manajemen tema |
| Developer Portal | https://localhost:9443/devportal | Portal API publik |
| Publisher Portal | https://localhost:9443/publisher | Portal publish API |
| Admin Portal | https://localhost:9443/admin | Admin WSO2 |
| Carbon Console | https://localhost:9443/carbon | Konsol sistem |

**Login:** `admin` / `admin@WSO2#2024`

## Custom Admin Panel

Admin panel memiliki 3 fitur utama:

### 1. Tema & Warna
- Ubah warna navbar, primary, secondary, background
- Ganti font family
- Konfigurasi footer
- Tambah custom CSS global

### 2. Logo & Gambar
- Upload logo (`logo.png`)
- Upload favicon (`favicon.ico`)
- Kelola semua asset gambar
- Support drag & drop

### 3. Editor Kode
- Edit file `defaultTheme.js` langsung dari browser
- Berlaku untuk Devportal maupun Publisher

### Workflow Perubahan Tema

1. Login ke Admin Panel → http://localhost:3000
2. Pilih portal (Devportal / Publisher) di tab kanan atas
3. Ubah pengaturan yang diinginkan
4. Klik **Simpan Tema**
5. Klik **Restart WSO2** (perlu tunggu ~2-3 menit)
6. Refresh portal untuk melihat perubahan

## Environment Variables (.env)

```env
HOSTNAME=localhost               # Domain server
WSO2_ADMIN_USER=admin           # Username WSO2
WSO2_ADMIN_PASSWORD=<set-strong-password>

MYSQL_ROOT_PASSWORD=<set-strong-password>
MYSQL_USER=apimuser
MYSQL_PASSWORD=<set-strong-password>

WSO2_MANAGEMENT_PORT=9443
WSO2_GATEWAY_HTTPS_PORT=8243
WSO2_GATEWAY_HTTP_PORT=8280
ADMIN_PANEL_PORT=3000
```

## Perintah Berguna

```bash
# Lihat semua container
docker-compose ps

# Log WSO2 (tunggu "Server startup in X ms")
docker logs -f wso2-apim

# Log Admin Panel
docker logs -f wso2-admin-panel

# Stop semua
docker-compose down

# Stop + hapus data (reset total)
docker-compose down -v

# Restart hanya WSO2
docker restart wso2-apim

# Restart hanya Admin Panel
docker restart wso2-admin-panel
```

## Kustomisasi Lanjutan

### Ubah Warna Brand Sendiri

Edit `.env` atau langsung di Admin Panel:
- Primary Color: Warna utama tombol dan elemen aktif
- Secondary Color: Warna aksen
- Navbar Background: Warna header navigasi

### Untuk Production

1. Ganti password di `.env`
2. Gunakan SSL certificate yang valid (bukan self-signed)
3. Ganti `HOSTNAME` dengan domain asli
4. Aktifkan analytics WSO2 jika diperlukan
5. Pertimbangkan setup clustering untuk HA

## Troubleshooting

**WSO2 lama startup:**
```bash
docker logs -f wso2-apim | grep -i "startup\|error"
```

**Database connection error:**
```bash
docker logs wso2-mysql
docker exec -it wso2-mysql mysql -u apimuser -p apim_db
```

**Admin Panel tidak bisa restart WSO2:**
Pastikan Docker socket ter-mount:
```yaml
volumes:
  - /var/run/docker.sock:/var/run/docker.sock
```

**Port conflict:**
Ubah port di `.env` sesuai kebutuhan.
