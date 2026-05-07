# Changelog

Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) ·
Versioning: [Semantic Versioning](https://semver.org/lang/id/).

## [Unreleased]

### Reverted — 2026-05-07

- **WSO2 Publisher & DevPortal SSO via SadaSSO** dirollback ke `AUTH_TYPE='default'`
  setelah login (lokal **dan** SSO) gagal dengan
  `DefaultRequestCoordinator: Redirecting to retry page as the
  authentication context has expired.` Penyebab: row `BasicAuthenticator`
  yang di-INSERT manual ke `IDP_AUTHENTICATOR` di-bawah `LOCAL` IdP
  bentrok dengan runtime authenticator yang ditemukan via OSGi —
  framework jadi bingung saat resolve sessionDataKey.
- Rollback SQL di `wso2/sql/rollback-portal-sso.sql` (idempotent).
- IdP `SadaSSO` di `apim_db` **tidak** dihapus — masih bisa di-wire ulang
  dengan pendekatan berbeda (rekomendasi: standalone WSO2 IS container).
- Custom Admin Panel SSO (Phase B) tidak terpengaruh dan tetap berfungsi.

## [0.2.0] — 2026-05-06

### Added

- **SSO via sada-api OIDC Provider** untuk tiga surface:
  - Custom Admin Panel (Phase B): tombol *"Login dengan SADA SSO"* di
    `admin-panel/client/src/pages/LoginPage.jsx`, plus endpoint
    `/api/auth/login`, `/api/auth/callback`, `/api/auth/config`, dan logout
    end-session di `admin-panel/server.js`.
  - WSO2 Publisher dan DevPortal (Phase A): tombol *"Sign In With SadaSSO"*
    di halaman `/authenticationendpoint/login.do`, mendampingi form
    username/password lokal.
- Federated IdP `SadaSSO` di-seed langsung ke `apim_db` (super tenant)
  karena WSO2 APIM 4.3.0 tidak menyertakan webapp `api#server#v1`
  (Identity Server REST API).
- JIT user provisioning untuk WSO2 portals — user lokal otomatis dibuat
  saat login SSO pertama, claim `sub` di-map ke
  `http://wso2.org/claims/username`.
- 3 SQL seed script idempotent di `wso2/sql/`:
  - `seed-sada-sso-idp.sql`
  - `wire-publisher-sso.sql`
  - `switch-flow-mode.sql`
- Dokumentasi teknis di `docs/sso-integration.md`.
- RTK Query endpoint baru `useAuthConfigQuery` di
  `admin-panel/client/src/features/auth/authApi.js`.
- `docker-compose.yml`: passthrough 10 env var `OIDC_*` ke container
  `admin-panel`, plus `extra_hosts: host.docker.internal:host-gateway`.

### Changed

- `apim_devportal` dan `apim_publisher` Service Provider:
  `AUTH_TYPE` `default` → `flow`, dengan satu step yang berisi
  `BasicAuthenticator:LOCAL` + `OpenIDConnectAuthenticator:SadaSSO`.
- `LoginPage.jsx` menampilkan error SSO dari query string
  (`?sso_error=...`) jika callback gagal.
- `/api/me` sekarang mengembalikan `{ username, user, auth_method }`
  (sebelumnya hanya `{ username }`).
- `/api/logout`: kalau `session.auth_method === 'sso'`, response berisi
  `{ redirect: <end-session URL> }` agar frontend juga keluar dari sada-api.

### Fixed

- WSO2 startup error pada XML entity di `deployment.toml` —
  `&` di JDBC URL diganti `&amp;`.
- `ClassNotFoundException com.mysql.cj.jdbc.Driver` — tambahkan
  `wso2/libs/mysql-connector-j-8.0.33.jar` dan mount ke
  `/home/wso2carbon/wso2am-4.3.0/repository/components/lib/`.
- Schema `apim_db` dan `shared_db` belum ada — load dari
  `/home/wso2carbon/wso2am-4.3.0/dbscripts/...` ke
  `mysql/scripts/wso2_apim_db.sql` + `wso2_shared_db.sql`.

### Security

- `OIDC_CLIENT_SECRET` dan `WSO2_ADMIN_PASSWORD` tetap di `.env`. Untuk
  production gunakan `WSO2_ADMIN_PASSWORD_HASH` (lihat README) dan
  pertimbangkan secret manager untuk OIDC client secret.

### Notes

- WSO2 Admin Portal (`/admin`) **sengaja** tidak di-wire ke SSO supaya
  tidak ada risiko terkunci kalau sada-api offline. Kalau tetap mau,
  duplikasi pola `wire-publisher-sso.sql` untuk `apim_admin_portal`.
- Setiap perubahan IDP/SP butuh `docker restart wso2-apim` (~3 menit
  warm-up) — WSO2 cache config secara agresif.
- 2 OAuth client ter-register di sada-api `OAuthClient`:
  - `611d1bf19447a08b6f720406d346cada` — Custom Admin Panel (Phase B)
  - `2212a3222dc401d84a5b589963936f51` — WSO2 portals (Phase A)

## [0.1.0] — Pre-SSO baseline

### Added

- Initial WSO2 APIM 4.3.0 stack via `docker-compose.yml` (mysql, wso2apim,
  admin-panel, nginx).
- Custom Admin Panel Express backend (`admin-panel/server.js`) dengan
  routes `theme`, `images`, `system`, plus auth lokal berbasis session
  (`WSO2_ADMIN_USER` / `WSO2_ADMIN_PASSWORD`).
- React + Redux Toolkit frontend (`admin-panel/client/`) — pages
  Dashboard, Theme, Images, RawEditor.
- Customization mounts ke devportal dan publisher
  (`wso2/customization/...`).
- Nginx reverse proxy (`nginx/conf.d/default.conf`) dengan SSL
  self-signed di `nginx/ssl/`.
