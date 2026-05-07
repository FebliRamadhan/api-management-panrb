# CLAUDE.md — WSO2 Custom Admin Panel

Panduan ini digunakan oleh **Claude Code** untuk memahami struktur, konvensi, dan cara kerja project ini.

---

## Gambaran Project

WSO2 Custom Admin Panel adalah aplikasi manajemen tema untuk **WSO2 API Manager** yang berjalan di atas Docker.
Terdiri dari dua lapisan:

- **Backend** — Express.js (Node.js), mengelola file tema, upload gambar, dan restart container via Docker socket.
- **Frontend** — React + Redux Toolkit (RTK), SPA yang dikonsumsi dari folder `client/`.

Semua service dijalankan via `docker-compose.yml` di root project.

---

## Struktur Folder

```
wso2-custom-admin/
├── CLAUDE.md                        ← (file ini)
├── .env                             ← Environment variables
├── docker-compose.yml
├── setup.sh
├── README.md
│
├── admin-panel/                     ← Service: Custom Admin Panel
│   ├── Dockerfile
│   ├── package.json                 ← Backend deps (Express, Multer, dll)
│   ├── server.js                    ← Entry point Express
│   ├── routes/                      ← Route handlers (pisah per domain)
│   │   ├── auth.js
│   │   ├── theme.js
│   │   ├── images.js
│   │   └── system.js
│   ├── middleware/
│   │   └── requireAuth.js
│   │
│   └── client/                      ← Frontend React + RTK
│       ├── package.json             ← Frontend deps (React, RTK, Vite)
│       ├── vite.config.js
│       ├── index.html
│       └── src/
│           ├── main.jsx             ← Entry React
│           ├── app/
│           │   └── store.js         ← Redux store (RTK configureStore)
│           ├── features/            ← RTK slices (satu folder per fitur)
│           │   ├── auth/
│           │   │   ├── authSlice.js
│           │   │   └── authApi.js   ← RTK Query endpoint
│           │   ├── theme/
│           │   │   ├── themeSlice.js
│           │   │   └── themeApi.js
│           │   ├── images/
│           │   │   ├── imagesSlice.js
│           │   │   └── imagesApi.js
│           │   └── system/
│           │       ├── systemSlice.js
│           │       └── systemApi.js
│           ├── components/          ← Komponen UI reusable
│           │   ├── Sidebar.jsx
│           │   ├── Topbar.jsx
│           │   ├── Toast.jsx
│           │   └── ColorPicker.jsx
│           ├── pages/               ← Halaman utama (route-level)
│           │   ├── LoginPage.jsx
│           │   ├── DashboardPage.jsx
│           │   ├── ThemePage.jsx
│           │   ├── ImagesPage.jsx
│           │   └── RawEditorPage.jsx
│           └── hooks/               ← Custom React hooks
│               └── usePortal.js
│
├── nginx/
│   ├── nginx.conf
│   └── conf.d/default.conf
│
├── mysql/
│   └── scripts/init.sql
│
└── wso2/
    ├── configs/deployment.toml
    └── customization/
        ├── devportal/
        │   ├── theme/defaultTheme.js
        │   └── images/
        └── publisher/
            ├── theme/defaultTheme.js
            └── images/
```

---

## Tech Stack

### Backend (`admin-panel/`)
| Tech | Versi | Kegunaan |
|------|-------|----------|
| Node.js | ≥ 18 | Runtime |
| Express | ^4.18 | HTTP server & routing |
| express-session | ^1.17 | Session auth |
| multer | ^1.4 | Upload file gambar |
| fs-extra | ^11 | Operasi file tema |
| helmet | ^7 | Security headers |
| morgan | ^1.10 | HTTP request logging |
| dockerode | ^4 | Restart WSO2 container |

### Frontend (`admin-panel/client/`)
| Tech | Versi | Kegunaan |
|------|-------|----------|
| React | ^18 | UI framework |
| Redux Toolkit (RTK) | ^2 | State management |
| RTK Query | (bundled) | Data fetching & caching |
| Vite | ^5 | Build tool & dev server |
| React Router | ^6 | Client-side routing |
| Tailwind CSS | ^3 | Styling |

---

## State Management — Redux Toolkit

### Konvensi Slice

Gunakan **RTK Query** untuk semua operasi async yang menyentuh API backend.
Gunakan **createSlice** hanya untuk state UI lokal (tab aktif, modal open, dll).

```js
// features/theme/themeApi.js — RTK Query
import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';

export const themeApi = createApi({
  reducerPath: 'themeApi',
  baseQuery: fetchBaseQuery({ baseUrl: '/api' }),
  tagTypes: ['Theme'],
  endpoints: (builder) => ({
    getTheme: builder.query({
      query: (portal) => `/theme/${portal}`,
      providesTags: ['Theme'],
    }),
    saveTheme: builder.mutation({
      query: ({ portal, body }) => ({
        url: `/theme/${portal}`,
        method: 'POST',
        body,
      }),
      invalidatesTags: ['Theme'],
    }),
  }),
});

export const { useGetThemeQuery, useSaveThemeMutation } = themeApi;
```

```js
// features/theme/themeSlice.js — UI state lokal
import { createSlice } from '@reduxjs/toolkit';

const themeSlice = createSlice({
  name: 'theme',
  initialState: {
    activePortal: 'devportal',  // 'devportal' | 'publisher'
    isDirty: false,
  },
  reducers: {
    setPortal: (state, action) => { state.activePortal = action.payload; },
    markDirty: (state) => { state.isDirty = true; },
    markClean: (state) => { state.isDirty = false; },
  },
});

export const { setPortal, markDirty, markClean } = themeSlice.actions;
export default themeSlice.reducer;
```

```js
// app/store.js
import { configureStore } from '@reduxjs/toolkit';
import { themeApi } from '../features/theme/themeApi';
import { imagesApi } from '../features/images/imagesApi';
import { systemApi } from '../features/system/systemApi';
import themeReducer from '../features/theme/themeSlice';
import authReducer from '../features/auth/authSlice';

export const store = configureStore({
  reducer: {
    theme: themeReducer,
    auth: authReducer,
    [themeApi.reducerPath]: themeApi.reducer,
    [imagesApi.reducerPath]: imagesApi.reducer,
    [systemApi.reducerPath]: systemApi.reducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware()
      .concat(themeApi.middleware)
      .concat(imagesApi.middleware)
      .concat(systemApi.middleware),
});
```

### Aturan RTK
- **Satu `createApi` per domain** (theme, images, system, auth) — jangan satukan semua endpoint ke satu api.
- Selalu definisikan `tagTypes` dan gunakan `providesTags` / `invalidatesTags` untuk cache invalidation otomatis.
- Jangan gunakan `useEffect` + `fetch` manual jika operasi bisa dilakukan lewat RTK Query.
- State server (data dari API) → RTK Query. State UI (tab, modal, form draft) → `createSlice`.

---

## Backend API Contract

### Auth
| Method | Path | Body | Response |
|--------|------|------|----------|
| POST | `/api/login` | `{ username, password }` | `{ success, redirect }` |
| POST | `/api/logout` | — | `{ success }` |
| GET | `/api/me` | — | `{ username }` |

### Theme
| Method | Path | Body | Response |
|--------|------|------|----------|
| GET | `/api/theme/:portal` | — | `{ success, theme, raw }` |
| POST | `/api/theme/:portal` | form fields | `{ success, message }` |
| POST | `/api/theme/:portal/raw` | `{ content }` | `{ success, message }` |

`:portal` = `devportal` atau `publisher`

### Images
| Method | Path | Body | Response |
|--------|------|------|----------|
| GET | `/api/images/:portal` | — | `{ success, images[] }` |
| POST | `/api/images/upload` | multipart `image` + `portal` | `{ success, filename }` |
| DELETE | `/api/images/:portal/:filename` | — | `{ success, message }` |

### System
| Method | Path | Body | Response |
|--------|------|------|----------|
| GET | `/api/status` | — | `{ status, container }` |
| POST | `/api/restart` | — | `{ success, message }` |

---

## Environment Variables

Semua env tersimpan di `.env` di root project. Backend membaca via `dotenv`.
Frontend Vite membaca variabel dengan prefix `VITE_`.

```env
# .env (root)
WSO2_ADMIN_USER=admin
WSO2_ADMIN_PASSWORD=<set-strong-password>
ADMIN_PANEL_SECRET=<openssl rand -hex 32>
MYSQL_ROOT_PASSWORD=<set-strong-password>
MYSQL_USER=apimuser
MYSQL_PASSWORD=<set-strong-password>
NODE_ENV=production
ADMIN_PANEL_PORT=3000

# Untuk frontend (Vite) — tambahkan di client/.env
VITE_API_BASE=/api
```

---

## Perintah Umum

### Docker
```bash
# Jalankan semua service
docker-compose up -d --build

# Lihat log WSO2
docker logs -f wso2-apim

# Restart hanya admin panel
docker restart wso2-admin-panel

# Stop semua + hapus volume
docker-compose down -v
```

### Backend Development
```bash
cd admin-panel
npm install
npm run dev          # nodemon server.js (port 3000)
```

### Frontend Development
```bash
cd admin-panel/client
npm install
npm run dev          # Vite dev server (port 5173, proxy ke :3000)
npm run build        # Output ke admin-panel/public/dist/
```

> Vite dikonfigurasi proxy `/api` → `http://localhost:3000` saat development.

---

## Konvensi Kode

### Penamaan
- **File komponen React**: PascalCase — `ThemePage.jsx`, `ColorPicker.jsx`
- **File slice/api RTK**: camelCase + suffix — `themeSlice.js`, `themeApi.js`
- **Folder fitur**: lowercase — `features/theme/`, `features/images/`
- **Custom hooks**: prefix `use` — `usePortal.js`, `useToast.js`

### Komponen
- Gunakan **functional component** + hooks. Tidak ada class component.
- Props destructuring di parameter fungsi.
- Hindari `any` jika menggunakan TypeScript di masa depan.

### Error Handling
- Backend selalu return `{ success: boolean, message: string }`.
- RTK Query: tangani error via `isError` dan `error` dari hook, tampilkan via Toast.
- Jangan `console.error` di production — gunakan logger atau toast notifikasi.

### Styling
- Gunakan **Tailwind CSS utility classes**.
- Hindari inline style kecuali untuk nilai dinamis (warna dari state, dll).
- Dark theme adalah default — gunakan CSS variable `--bg`, `--surface`, `--accent`, dll yang sudah didefinisikan di `index.css`.

---

## Alur Kerja Kustomisasi Tema

```
User ubah warna di ThemePage
        │
        ▼
useSaveThemeMutation (RTK Query)
        │
        ▼
POST /api/theme/:portal (Express)
        │
        ▼
fs-extra tulis ke wso2/customization/.../defaultTheme.js
        │
        ▼ (user klik Restart)
POST /api/restart
        │
        ▼
dockerode.getContainer('wso2-apim').restart()
        │
        ▼
WSO2 membaca ulang file tema (~2-3 menit startup)
```

---

## Hal yang Perlu Diperhatikan

- **Docker socket** (`/var/run/docker.sock`) di-mount ke container admin panel untuk restart WSO2. Ini privilege tinggi — jangan expose port admin panel ke publik tanpa auth.
- File `defaultTheme.js` di-mount sebagai **volume** ke WSO2 container. Perubahan langsung terefleksi di filesystem, tapi WSO2 butuh restart untuk membacanya.
- WSO2 butuh **±2-3 menit** setelah restart sampai portal bisa diakses kembali.
- Database WSO2 menggunakan **charset latin1** — jangan ubah ke utf8 tanpa migrasi schema terlebih dahulu.
- SSL certificate di `nginx/ssl/` adalah self-signed (untuk dev). Untuk production, ganti dengan cert dari Let's Encrypt atau CA lain.
