# SSO Integration — WSO2 Custom Admin Panel + WSO2 Portals via sada-api OIDC

Dokumen teknis cara kerja Single Sign-On (SSO) di project `wso2-custom-admin`,
yang menggunakan **sada-api** (`/Users/febliramadhan/Documents/Repo/JavaScript/sada-api/`)
sebagai OpenID Connect Provider.

Cakupan:

| Surface                                      | URL                                  | SSO ke sada-api?                                  |
| -------------------------------------------- | ------------------------------------ | ------------------------------------------------- |
| Custom Admin Panel (Express + RTK)           | `http://localhost:3000`              | ✅ Tombol "Login dengan SADA SSO" + login lokal   |
| WSO2 API Manager — Publisher                 | `https://localhost:9443/publisher`   | ❌ Hanya login lokal (Phase A di-rollback 2026-05-07, lihat §8) |
| WSO2 API Manager — DevPortal                 | `https://localhost:9443/devportal`   | ❌ Hanya login lokal (Phase A di-rollback 2026-05-07, lihat §8) |
| WSO2 API Manager — Admin Portal              | `https://localhost:9443/admin`       | ❌ Hanya login lokal (sengaja, supaya tidak terkunci) |

---

## 1. Arsitektur

```
┌──────────────────────────────────────────────────────────────────────┐
│                          Browser User                                │
└──────────────────────────────────────────────────────────────────────┘
       │                                       │
       │ (1a) http://localhost:3000/login      │ (1b) https://localhost:9443/devportal
       ▼                                       ▼
┌─────────────────────────┐         ┌──────────────────────────────────┐
│ Custom Admin Panel      │         │ WSO2 APIM 4.3.0                  │
│ (Express + RTK Query)   │         │  ├─ /authenticationendpoint      │
│  · /api/auth/login      │         │  ├─ /commonauth                  │
│  · /api/auth/callback   │         │  └─ /oauth2/authorize            │
└─────────────────────────┘         └──────────────────────────────────┘
       │                                       │
       │ (2) redirect 302                      │ (2) redirect 302
       ▼                                       ▼
┌──────────────────────────────────────────────────────────────────────┐
│  sada-api auth-ui (port 3002) — login form                           │
│  ↓ user submits credentials                                          │
│  sada-api auth-service (port 3001) — OIDC token + userinfo           │
└──────────────────────────────────────────────────────────────────────┘
       │
       │ (3) redirect to redirect_uri with ?code=...
       ▼
back to step (1)'s callback → exchange code for token → session created
```

Network model di Docker (macOS):

| Pemanggil                | Target                              | URL                          |
| ------------------------ | ----------------------------------- | ---------------------------- |
| Browser                  | sada-api auth-ui (authorize)        | `http://localhost:3002`      |
| Browser                  | sada-api auth-service (logout)      | `http://localhost:3001`      |
| Container `wso2-admin-panel` | sada-api auth-service (token, userinfo) | `http://host.docker.internal:3001` |
| Container `wso2-apim`    | sada-api auth-service (token, userinfo) | `http://host.docker.internal:3001` |

`extra_hosts: ["host.docker.internal:host-gateway"]` di-set pada `wso2-admin-panel` di
`docker-compose.yml`.

---

## 2. Phase B — Custom Admin Panel sebagai OIDC Client

### 2.1 OAuth Client

Terdaftar di sada-api `OAuthClient`:

- `name`        : `WSO2 Custom Admin Panel`
- `clientId`    : `611d1bf19447a08b6f720406d346cada`
- `clientSecret`: `efee4de52fd01227eb307e0d5b9819c539f65e475d2caab91097d754bbdf6d62`
- `redirectUris`: `http://localhost:3000/api/auth/callback`
- `grants`      : `authorization_code`, `refresh_token`
- `scopes`      : `openid`, `profile`, `email`, `offline_access`

Diregistrasi via script in-container:
`/app/packages/auth-service/dist/register-wso2-admin-panel.mjs` (dijalankan dengan
`docker exec sada-auth-service node ...`).

### 2.2 Konfigurasi `.env`

```env
OIDC_ENABLED=true
OIDC_AUTHORIZE_URL=http://localhost:3002/authorize             # browser-facing
OIDC_TOKEN_URL=http://host.docker.internal:3001/oauth/token    # server-side
OIDC_USERINFO_URL=http://host.docker.internal:3001/oauth/userinfo
OIDC_END_SESSION_URL=http://localhost:3001/oauth/logout
OIDC_CALLBACK_URL=http://localhost:3000/api/auth/callback
OIDC_POST_LOGOUT_URL=http://localhost:3000/login
OIDC_CLIENT_ID=<redacted-32-hex-chars>          # dari sada-api: SELECT clientId FROM "OAuthClient"
OIDC_CLIENT_SECRET=<redacted-64-hex-chars>      # dari sada-api: SELECT clientSecret FROM "OAuthClient"
OIDC_SCOPES=openid profile email offline_access
```

### 2.3 Endpoint Express baru

| Method | Path                  | Tugas                                                          |
| ------ | --------------------- | -------------------------------------------------------------- |
| GET    | `/api/auth/config`    | Frontend cek `sso_enabled` untuk render tombol                 |
| GET    | `/api/auth/login`     | Generate state + redirect ke `OIDC_AUTHORIZE_URL`              |
| GET    | `/api/auth/callback`  | Validate state → POST token → GET userinfo → set session       |
| POST   | `/api/logout`         | Destroy session; jika `auth_method='sso'` balas `redirect` ke end-session |
| GET    | `/api/me`             | `{ username, user, auth_method }`                              |

State CSRF disimpan di `req.session.oidc_state` (random 16 bytes hex).
Token + userinfo ditaruh di `req.session.user` dan `req.session.tokens`.

### 2.4 Frontend (RTK Query)

`features/auth/authApi.js` ditambah endpoint `authConfig`:

```js
authConfig: b.query({ query: () => '/auth/config' }),
```

`pages/LoginPage.jsx` render tombol kondisional:

```jsx
{authCfg?.sso_enabled && (
  <a href="/api/auth/login" className="btn-secondary ...">
    Login dengan SADA SSO
  </a>
)}
```

Tombol harus `<a href>` (bukan fetch) agar browser ikut redirect chain.

---

## 3. Phase A — WSO2 Portals (Publisher / DevPortal) sebagai Federated SP

### 3.1 OAuth Client (terpisah dari Phase B)

Terdaftar di sada-api `OAuthClient`:

- `name`        : `WSO2 API Manager (Federated IdP)`
- `clientId`    : `2212a3222dc401d84a5b589963936f51`
- `clientSecret`: `23fe62bdeb6b7216590aa8d3d7f60d747135f904ba8aceec0cb6e1d1d43c6003`
- `redirectUris`: `https://localhost:9443/commonauth`
- `grants`      : `authorization_code`, `refresh_token`
- `scopes`      : `openid`, `profile`, `email`

### 3.2 Kenapa DB-direct seeding?

WSO2 APIM **4.3.0** **tidak** mengirim webapp `api#server#v1` (Identity Server REST
API). Endpoint `/api/server/v1/identity-providers` mengembalikan body
`"AuthenticationHandler not found"` — handler-nya memang tidak ter-register.

Alternatif yang dipertimbangkan:

| Path                                       | Status       |
| ------------------------------------------ | ------------ |
| WSO2 IS REST API                           | ❌ tidak ada |
| Carbon admin console (`/carbon`)           | ❌ removed di 4.x |
| Pakai standalone WSO2 IS container (~2GB)  | ⏭ dilewatkan |
| **DB-direct seeding ke `apim_db`**         | ✅ dipakai   |

### 3.3 Skema tabel yang disentuh

Semua di database `apim_db` (super tenant `TENANT_ID = -1234`):

| Tabel                            | Fungsi                                                    |
| -------------------------------- | --------------------------------------------------------- |
| `IDP`                            | Identitas provider (1 row baru: `SadaSSO`)                |
| `IDP_AUTHENTICATOR`              | OpenIDConnectAuthenticator + BasicAuthenticator (LOCAL)   |
| `IDP_AUTHENTICATOR_PROPERTY`     | 12 kunci OIDC (ClientId, OAuth2AuthzEPUrl, dll)           |
| `IDP_CLAIM`                      | Claim dari sada-api: `sub`, `email`, `name`, `preferred_username` |
| `IDP_CLAIM_MAPPING`              | Mapping ke `http://wso2.org/claims/...`                   |
| `IDP_PROVISIONING_CONFIG`        | Aktifkan JIT (auto-create user lokal saat login pertama)  |
| `SP_APP`                         | Update `AUTH_TYPE = 'flow'` untuk publisher & devportal   |
| `SP_AUTH_STEP`                   | 1 step per portal SP                                      |
| `SP_FEDERATED_IDP`               | Link step ke 2 authenticator (LOCAL + SadaSSO)            |

**Catatan penting tentang `SP_FEDERATED_IDP`:** WSO2 tidak punya tabel terpisah untuk
local-authenticator dalam step. Local authenticator (BasicAuthenticator) disimpan
di tabel yang sama dengan federated, bedanya `IDP_AUTHENTICATOR.IDP_ID` mengarah ke
IdP `LOCAL` (id=1) bukan `SadaSSO`.

### 3.4 SQL files

Ada 3 file SQL di `wso2/sql/` yang bisa di-replay (idempotent):

| File                          | Fungsi                                                              |
| ----------------------------- | ------------------------------------------------------------------- |
| `seed-sada-sso-idp.sql`       | Buat IdP SadaSSO + claim mapping + JIT, wire devportal (federated-only) |
| `wire-publisher-sso.sql`      | Wire publisher SP ke SadaSSO (federated-only)                       |
| `switch-flow-mode.sql`        | Tambah BasicAuthenticator ke step + ubah AUTH_TYPE jadi `flow`      |

Cara apply:

```bash
docker cp wso2/sql/<file>.sql wso2-mysql:/tmp/
docker exec wso2-mysql sh -c "mysql -u apimuser -pApim@MySQL#2024 < /tmp/<file>.sql"
docker restart wso2-apim   # ~3 menit
```

`docker restart wso2-apim` **wajib** setelah mengubah IDP/SP — WSO2 cache config
secara agresif di memori.

### 3.5 Properti OIDC penting

```sql
ClientId               = 2212a3222dc401d84a5b589963936f51
ClientSecret           = ... (IS_SECRET = '1')
OAuth2AuthzEPUrl       = http://localhost:3002/authorize        -- browser-facing
OAuth2TokenEPUrl       = http://host.docker.internal:3001/oauth/token
UserInfoUrl            = http://host.docker.internal:3001/oauth/userinfo
OIDCLogoutEPUrl        = http://localhost:3001/oauth/logout
callbackUrl            = https://localhost:9443/commonauth
Scopes                 = openid email profile
commonAuthQueryParams  = scope=openid+email+profile
IsBasicAuthEnabled     = true
commonAuthClientType   = oidc
```

Pemisahan `localhost` (browser) vs `host.docker.internal` (server-side dari container
WSO2) penting — jika dibalik, browser tidak akan bisa resolve `host.docker.internal`,
dan WSO2 container tidak bisa connect ke `localhost`.

### 3.6 Claim mapping

| sada-api claim       | WSO2 local claim                         | Catatan                       |
| -------------------- | ---------------------------------------- | ----------------------------- |
| `sub`                | `http://wso2.org/claims/username`        | Subject ID                    |
| `email`              | `http://wso2.org/claims/emailaddress`    | Email                         |
| `name`               | `http://wso2.org/claims/displayName`     | Nama tampilan                 |
| `preferred_username` | `http://wso2.org/claims/nickname`        | Nickname                      |

### 3.7 Verifikasi tanpa browser

```bash
# Cek redirect publisher → harus 302 ke localhost:3002
curl -k -s -o /dev/null -w "%{redirect_url}\n" \
  "https://localhost:9443/oauth2/authorize?response_type=code\
&client_id=nPx4Je_0b7jwfmhKE6DuVi_RcJca\
&redirect_uri=https%3A%2F%2Flocalhost%3A9443%2Fpublisher%2Fservices%2Fauth%2Fcallback%2Flogin\
&scope=openid&state=p&nonce=n"
```

Harus mengembalikan URL ke `https://localhost:9443/authenticationendpoint/login.do?...` dengan
query `authenticators=OpenIDConnectAuthenticator:SadaSSO;BasicAuthenticator:LOCAL`.

---

## 4. Login flow di browser

### 4.1 Custom Admin Panel

1. User buka `http://localhost:3000/login`
2. Klik **"Login dengan SADA SSO"** → `GET /api/auth/login`
3. Express redirect ke `http://localhost:3002/authorize?client_id=611d...&redirect_uri=...&state=...`
4. User login di sada-api auth-ui
5. sada-api redirect kembali ke `http://localhost:3000/api/auth/callback?code=...`
6. Express tukar code → token → userinfo, simpan di session, redirect ke `/`

### 4.2 WSO2 Publisher / DevPortal

1. User buka `https://localhost:9443/publisher` (atau `/devportal`)
2. SPA redirect ke `/oauth2/authorize?...`
3. WSO2 redirect ke `/authenticationendpoint/login.do?authenticators=OpenIDConnectAuthenticator:SadaSSO;BasicAuthenticator:LOCAL`
4. Halaman menampilkan **dua opsi**: form username/password lokal **dan** tombol "Sign In With SadaSSO"
5. Jika user pilih SadaSSO → WSO2 redirect ke `http://localhost:3002/authorize?client_id=2212a...`
6. User login di sada-api → redirect ke `https://localhost:9443/commonauth?code=...`
7. WSO2 (container) tukar code → token → userinfo via `host.docker.internal:3001`
8. JIT provisioning: WSO2 buat user lokal otomatis berdasarkan `sub` dari sada-api
9. WSO2 redirect kembali ke `/publisher/services/auth/callback/login?code=...`
10. Portal SPA tukar code → akses portal

---

## 5. Rollback per portal

Kalau portal tertentu mau dikembalikan ke local-only:

```sql
USE apim_db;

-- Misal untuk apim_publisher:
SET @APP_ID = (SELECT ID FROM SP_APP WHERE APP_NAME='apim_publisher' AND TENANT_ID=-1234);

DELETE fed FROM SP_FEDERATED_IDP fed
  JOIN SP_AUTH_STEP step ON fed.ID = step.ID
  WHERE step.APP_ID = @APP_ID;

DELETE FROM SP_AUTH_STEP WHERE APP_ID = @APP_ID;

UPDATE SP_APP SET AUTH_TYPE='default' WHERE ID=@APP_ID;
```

Lalu `docker restart wso2-apim`.

---

## 6. Troubleshooting

| Gejala                                                                | Penyebab umum                                            | Solusi                                                                                       |
| --------------------------------------------------------------------- | -------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Tombol "Login dengan SADA SSO" tidak muncul di Custom Admin Panel     | `OIDC_ENABLED != true` atau env tidak ke-pass ke container | Cek `docker exec wso2-admin-panel env \| grep OIDC`; recreate dengan `docker-compose up -d`  |
| WSO2 portal redirect ke `localhost:3002` tapi browser timeout         | sada-api auth-ui (port 3002) tidak running               | `docker compose -f sada-api/docker-compose.yml ps`                                           |
| WSO2 callback `https://localhost:9443/commonauth` 500 error           | `host.docker.internal` tidak resolve dari container WSO2 | Tambahkan `extra_hosts` di service `wso2apim` di `docker-compose.yml`                        |
| "AuthenticationFailed: invalid_callback"                              | `redirect_uri` tidak match callback yang terdaftar       | Cek `OAuthClient.redirectUris` di sada-api                                                   |
| WSO2 portal tidak menampilkan tombol SadaSSO setelah update SQL       | SP cache belum flush                                     | `docker restart wso2-apim` (~3 menit warm-up)                                                |
| User berhasil login SSO tapi muncul "user not found" di WSO2 portal   | JIT provisioning gagal — claim mapping salah             | Cek `IDP_CLAIM_MAPPING`, pastikan `sub` → `http://wso2.org/claims/username`                  |

---

## 7. Referensi cepat

| Resource                          | Lokasi                                                                     |
| --------------------------------- | -------------------------------------------------------------------------- |
| sada-api repo                     | `/Users/febliramadhan/Documents/Repo/JavaScript/sada-api/`                 |
| Existing sada-api users (seed)    | `admin@example.com`, `febli.ramadhani@menpan.go.id`, `bayu.laksana@menpan.go.id` |
| SQL seed scripts                  | `wso2/sql/*.sql`                                                           |
| Custom Admin Panel server         | `admin-panel/server.js`                                                    |
| Custom Admin Panel auth API client | `admin-panel/client/src/features/auth/authApi.js`                          |
| Custom Admin Panel login page     | `admin-panel/client/src/pages/LoginPage.jsx`                               |

---

## 8. Catatan rollback Phase A (2026-05-07)

Setelah `AUTH_TYPE='flow'` diterapkan dan `BasicAuthenticator` di-INSERT manual
ke `IDP_AUTHENTICATOR` di bawah LOCAL IdP, login ke Publisher dan DevPortal
gagal **untuk dua-duanya** (lokal **dan** SSO) dengan error:

```
ERROR DefaultRequestCoordinator
  Redirecting to retry page as the authentication context has expired.
```

Penyebab: row `BasicAuthenticator` yang kita tambahkan di DB bentrok dengan
authenticator yang sama yang sudah didiscover WSO2 lewat OSGi runtime — jadi
ada duplicate registration, dan framework gagal resolve sessionDataKey ketika
user mengklik salah satu opsi.

Status saat ini:

- `apim_devportal`, `apim_publisher`, `apim_admin_portal` semua kembali ke
  `AUTH_TYPE='default'` (login lokal saja).
- IdP `SadaSSO` + 12 properti + 4 claim mapping **tetap di DB** (tidak dihapus).
- Rollback SQL: `wso2/sql/rollback-portal-sso.sql`.

### Rekomendasi untuk percobaan ulang

Pendekatan DB-direct seeding ke `apim_db` ternyata sangat sensitif terhadap
runtime authenticator discovery WSO2. Kalau Phase A mau dilanjutkan, opsi yang
lebih sehat:

1. **Standalone WSO2 IS container (`wso2is:6.x`)** + IS as Key Manager untuk
   APIM. IS punya REST API resmi untuk CRUD IdP/SP, jadi tidak perlu
   DB-hacking. Trade-off: +2GB RAM, ~3 menit warm-up tambahan.
2. **WSO2 APIM 4.4+** (jika upgrade memungkinkan) yang membundel webapp
   `api#server#v1` — REST API IdP/SP tersedia native.
3. **oauth2-proxy di depan portal** (nginx + Lua/njs) — bypass framework
   auth WSO2 sepenuhnya. Trade-off: WSO2 tidak akan tahu siapa user yang
   login, jadi authorization-aware fitur (mis. tenant-specific apps) bisa
   bermasalah.

Custom Admin Panel SSO (Phase B) tidak terpengaruh dan tetap menjadi pintu
masuk SSO yang bekerja saat ini.
