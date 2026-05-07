/**
 * WSO2 Custom Admin Panel - Server
 * Express.js backend untuk manajemen tema WSO2.
 */

require('dotenv').config();
const crypto = require('crypto');
const express = require('express');
const session = require('express-session');
const multer = require('multer');
const fs = require('fs-extra');
const path = require('path');
const { exec } = require('child_process');
const morgan = require('morgan');
const helmet = require('helmet');
const bcrypt = require('bcryptjs');
const rateLimit = require('express-rate-limit');
const pagesRoutes = require('./routes/pages');

const app = express();
const PORT = process.env.PORT || 3000;
const IS_PROD = process.env.NODE_ENV === 'production';

// ── Fail-fast config validation ────────────────────────
const SESSION_SECRET = process.env.ADMIN_PANEL_SECRET;
if (!SESSION_SECRET || SESSION_SECRET === 'changeme') {
  if (IS_PROD) {
    console.error('FATAL: ADMIN_PANEL_SECRET tidak diset atau masih default di production.');
    process.exit(1);
  }
  console.warn('WARN: ADMIN_PANEL_SECRET tidak diset — pakai random secret (sesi akan invalid setelah restart).');
}

const ADMIN_USER = process.env.WSO2_ADMIN_USER || 'admin';
const ADMIN_PASSWORD_HASH = process.env.WSO2_ADMIN_PASSWORD_HASH || '';
const ADMIN_PASSWORD_PLAIN = process.env.WSO2_ADMIN_PASSWORD || '';
if (!ADMIN_PASSWORD_HASH && ADMIN_PASSWORD_PLAIN) {
  console.warn('WARN: WSO2_ADMIN_PASSWORD_HASH belum diset. Pakai plaintext fallback. Generate hash dengan: node scripts/hash-password.js <password>');
}
if (!ADMIN_PASSWORD_HASH && !ADMIN_PASSWORD_PLAIN) {
  console.error('FATAL: WSO2_ADMIN_PASSWORD_HASH atau WSO2_ADMIN_PASSWORD wajib diset.');
  process.exit(1);
}

// ── Paths ──────────────────────────────────────────────
const WSO2_BASE = '/app/wso2-customization';
const PATHS = {
  base: WSO2_BASE,
  devportalTheme: path.join(WSO2_BASE, 'devportal/theme/defaultTheme.js'),
  publisherTheme: path.join(WSO2_BASE, 'publisher/theme/defaultTheme.js'),
  devportalImages: path.join(WSO2_BASE, 'devportal/images'),
  publisherImages: path.join(WSO2_BASE, 'publisher/images'),
};
const BACKUP_KEEP = 5;

// ── Middleware ─────────────────────────────────────────
app.set('trust proxy', 1); // di belakang nginx — perlu utk rate limit by IP & cookie secure
app.use(helmet({ contentSecurityPolicy: false })); // CSP perlu refactor inline-script di index.html dulu
app.use(morgan(IS_PROD ? 'combined' : 'dev'));
app.use(express.json({ limit: '512kb' }));
app.use(express.urlencoded({ extended: true, limit: '512kb' }));
app.use(express.static(path.join(__dirname, 'public', 'dist'), { index: false }));
app.use(express.static(path.join(__dirname, 'public'), { index: false }));
app.use(session({
  name: 'wso2.admin.sid',
  secret: SESSION_SECRET || crypto.randomBytes(32).toString('hex'),
  resave: false,
  saveUninitialized: false,
  rolling: true,
  cookie: {
    secure: IS_PROD,
    httpOnly: true,
    sameSite: 'strict',
    maxAge: 8 * 60 * 60 * 1000, // 8 jam
  },
}));

// ── Auth middleware ────────────────────────────────────
const requireAuth = (req, res, next) => {
  if (req.session && req.session.authenticated) return next();
  if (req.path.startsWith('/api/')) {
    return res.status(401).json({ success: false, message: 'Tidak terautentikasi' });
  }
  res.redirect('/login');
};

// ── OIDC config (sada-api SSO) ─────────────────────────
const OIDC = {
  enabled: process.env.OIDC_ENABLED === 'true',
  authorizeUrl: process.env.OIDC_AUTHORIZE_URL,
  tokenUrl: process.env.OIDC_TOKEN_URL,
  userinfoUrl: process.env.OIDC_USERINFO_URL,
  endSessionUrl: process.env.OIDC_END_SESSION_URL,
  callbackUrl: process.env.OIDC_CALLBACK_URL,
  postLogoutUrl: process.env.OIDC_POST_LOGOUT_URL,
  clientId: process.env.OIDC_CLIENT_ID,
  clientSecret: process.env.OIDC_CLIENT_SECRET,
  scopes: process.env.OIDC_SCOPES || 'openid profile email',
};

if (OIDC.enabled) {
  const missing = ['authorizeUrl', 'tokenUrl', 'userinfoUrl', 'callbackUrl', 'clientId', 'clientSecret']
    .filter((k) => !OIDC[k]);
  if (missing.length) {
    console.error(`FATAL: OIDC_ENABLED=true tapi config kurang: ${missing.join(', ')}`);
    process.exit(1);
  }
  console.log(`[oidc] SSO aktif → ${OIDC.authorizeUrl}`);
}

// ── Rate limiter untuk login ───────────────────────────
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Terlalu banyak percobaan login. Coba lagi 15 menit.' },
});

// ── Helpers: validasi portal & filename ────────────────
function resolvePortal(p) {
  if (p !== 'devportal' && p !== 'publisher') return null;
  return p;
}

function safeFilename(name) {
  if (typeof name !== 'string' || name.length === 0 || name.length > 255) return null;
  if (name.includes('\0') || name.includes('/') || name.includes('\\')) return null;
  if (name === '.' || name === '..') return null;
  const base = path.basename(name);
  if (base !== name) return null;
  if (!/^[\w.\-]+$/.test(name)) return null; // hanya alfanumerik, dot, dash, underscore
  return name;
}

function resolveInside(dir, filename) {
  const safe = safeFilename(filename);
  if (!safe) return null;
  const resolved = path.resolve(dir, safe);
  if (!resolved.startsWith(path.resolve(dir) + path.sep)) return null;
  return resolved;
}

// ── Helpers: theme parsing/writing ─────────────────────
function parseTheme(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const match = content.match(/const Configurations\s*=\s*(\{[\s\S]*\});?\s*$/m);
    if (!match) return null;
    return new Function(`return ${match[1]}`)();
  } catch (e) {
    return null;
  }
}

function backupThemeFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  const dir = path.dirname(filePath);
  const base = path.basename(filePath);
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backup = path.join(dir, `${base}.bak.${stamp}`);
  fs.copyFileSync(filePath, backup);

  // rotasi: simpan hanya BACKUP_KEEP terbaru
  const backups = fs.readdirSync(dir)
    .filter(f => f.startsWith(`${base}.bak.`))
    .map(f => ({ f, mtime: fs.statSync(path.join(dir, f)).mtimeMs }))
    .sort((a, b) => b.mtime - a.mtime);
  backups.slice(BACKUP_KEEP).forEach(({ f }) => {
    try { fs.removeSync(path.join(dir, f)); } catch (_) {}
  });
}

function writeTheme(filePath, config) {
  backupThemeFile(filePath);
  const content = `/**
 * WSO2 Custom Theme - Generated by Admin Panel
 * Last updated: ${new Date().toISOString()}
 */

const Configurations = ${JSON.stringify(config, null, 4)};
`;
  fs.writeFileSync(filePath, content, 'utf8');
}

function validateRawThemeContent(content) {
  if (typeof content !== 'string' || !content.includes('Configurations')) {
    return 'Konten harus berisi deklarasi `Configurations`.';
  }
  // syntax check — bungkus agar `const` di top-level tetap valid
  try {
    new Function(`${content}; return Configurations;`);
  } catch (e) {
    return `Syntax error: ${e.message}`;
  }
  return null;
}

function restartWSO2() {
  return new Promise((resolve, reject) => {
    exec('docker restart wso2-apim', { timeout: 30000 }, (err, stdout) => {
      if (err) reject(err);
      else resolve(stdout);
    });
  });
}

function listImages(portal) {
  const imgPath = portal === 'publisher' ? PATHS.publisherImages : PATHS.devportalImages;
  fs.ensureDirSync(imgPath);
  return fs.readdirSync(imgPath).filter(f => /\.(png|jpg|jpeg|gif|svg|ico)$/i.test(f));
}

// ── Multer (upload images) ─────────────────────────────
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const portal = resolvePortal(req.body.portal || req.query.portal || 'devportal');
    if (!portal) return cb(new Error('Portal tidak valid'));
    const dest = portal === 'publisher' ? PATHS.publisherImages : PATHS.devportalImages;
    fs.ensureDirSync(dest);
    cb(null, dest);
  },
  filename: (req, file, cb) => {
    const safe = safeFilename(file.originalname);
    if (!safe) return cb(new Error('Nama file tidak valid'));
    cb(null, safe);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['image/png', 'image/jpeg', 'image/gif', 'image/svg+xml', 'image/x-icon', 'image/vnd.microsoft.icon'];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error('Hanya file gambar yang diperbolehkan'));
  },
});

// ═══════════════════════════════════════════════════════
// ROUTES — Auth
// ═══════════════════════════════════════════════════════

app.post('/api/login', loginLimiter, async (req, res) => {
  const { username, password } = req.body || {};
  if (typeof username !== 'string' || typeof password !== 'string') {
    return res.status(400).json({ success: false, message: 'Payload tidak valid' });
  }

  let userOk = false;
  try {
    const userBuf = Buffer.from(username);
    const validUserBuf = Buffer.from(ADMIN_USER);
    userOk = userBuf.length === validUserBuf.length &&
      crypto.timingSafeEqual(userBuf, validUserBuf);
  } catch (_) { userOk = false; }

  let passOk = false;
  if (ADMIN_PASSWORD_HASH) {
    try { passOk = await bcrypt.compare(password, ADMIN_PASSWORD_HASH); }
    catch (_) { passOk = false; }
  } else {
    try {
      const a = Buffer.from(password);
      const b = Buffer.from(ADMIN_PASSWORD_PLAIN);
      passOk = a.length === b.length && crypto.timingSafeEqual(a, b);
    } catch (_) { passOk = false; }
  }

  if (userOk && passOk) {
    req.session.regenerate((err) => {
      if (err) return res.status(500).json({ success: false, message: 'Gagal membuat sesi' });
      req.session.authenticated = true;
      req.session.username = username;
      res.json({ success: true, redirect: '/' });
    });
  } else {
    res.status(401).json({ success: false, message: 'Username atau password salah' });
  }
});

app.post('/api/logout', (req, res) => {
  const wasSso = req.session?.auth_method === 'sso';
  const idToken = req.session?.tokens?.id_token;
  req.session.destroy(() => {
    res.clearCookie('wso2.admin.sid');
    if (wasSso && OIDC.enabled && OIDC.endSessionUrl) {
      const url = new URL(OIDC.endSessionUrl);
      if (idToken) url.searchParams.set('id_token_hint', idToken);
      if (OIDC.postLogoutUrl) url.searchParams.set('post_logout_redirect_uri', OIDC.postLogoutUrl);
      return res.json({ success: true, redirect: url.toString() });
    }
    res.json({ success: true });
  });
});

// ── SSO (OIDC) routes ─────────────────────────────────
// GET /api/auth/login → redirect ke sada-api authorize endpoint
app.get('/api/auth/login', (req, res) => {
  if (!OIDC.enabled) {
    return res.status(503).send('SSO belum diaktifkan. Set OIDC_ENABLED=true di .env');
  }
  const state = crypto.randomBytes(16).toString('hex');
  req.session.oidc_state = state;
  const url = new URL(OIDC.authorizeUrl);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('client_id', OIDC.clientId);
  url.searchParams.set('redirect_uri', OIDC.callbackUrl);
  url.searchParams.set('scope', OIDC.scopes);
  url.searchParams.set('state', state);
  res.redirect(url.toString());
});

// GET /api/auth/callback → exchange code, set session
app.get('/api/auth/callback', async (req, res) => {
  if (!OIDC.enabled) return res.redirect('/login');
  const { code, state, error, error_description } = req.query;

  const fail = (reason) => res.redirect('/login?sso_error=' + encodeURIComponent(reason));

  if (error) return fail(error_description || error);
  if (!code || !state) return fail('missing_code_or_state');
  if (state !== req.session.oidc_state) return fail('state_mismatch');
  delete req.session.oidc_state;

  try {
    // 1) Exchange authorization code for tokens
    const tokenResp = await fetch(OIDC.tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'authorization_code',
        client_id: OIDC.clientId,
        client_secret: OIDC.clientSecret,
        code: String(code),
        redirect_uri: OIDC.callbackUrl,
      }),
    });

    if (!tokenResp.ok) {
      const text = await tokenResp.text().catch(() => '');
      throw new Error(`token_exchange_${tokenResp.status}: ${text.slice(0, 200)}`);
    }

    const tokens = await tokenResp.json();
    if (!tokens.access_token) throw new Error('no_access_token_in_response');

    // 2) Fetch userinfo
    const userResp = await fetch(OIDC.userinfoUrl, {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    if (!userResp.ok) throw new Error(`userinfo_${userResp.status}`);
    const user = await userResp.json();

    // 3) Set session
    req.session.regenerate((err) => {
      if (err) return fail('session_failed');
      req.session.authenticated = true;
      req.session.username = user.preferred_username || user.email || user.sub;
      req.session.user = {
        sub: user.sub,
        email: user.email || null,
        name: user.name || null,
        preferred_username: user.preferred_username || null,
      };
      req.session.tokens = {
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token || null,
        id_token: tokens.id_token || null,
        expires_at: Date.now() + (tokens.expires_in || 3600) * 1000,
      };
      req.session.auth_method = 'sso';
      res.redirect('/');
    });
  } catch (e) {
    console.error('[oidc-callback]', e.message);
    fail(e.message);
  }
});

// GET /api/auth/config → frontend pakai untuk tahu apakah tombol SSO ditampilkan
app.get('/api/auth/config', (req, res) => {
  res.json({ sso_enabled: OIDC.enabled });
});

// ═══════════════════════════════════════════════════════
// ROUTES — Dashboard
// ═══════════════════════════════════════════════════════

// SPA shell — semua route non-API diserahkan ke React Router.
// Auth check dilakukan oleh client (lewat /api/me) supaya `/login` bisa diakses tanpa redirect loop.
const sendSpa = (req, res) => {
  const dist = path.join(__dirname, 'public', 'dist', 'index.html');
  if (!fs.existsSync(dist)) {
    return res.status(503).send('Client belum di-build. Jalankan: cd client && npm install && npm run build');
  }
  res.sendFile(dist);
};

// ── Get current theme ──────────────────────────────────
app.get('/api/theme/:portal', requireAuth, (req, res) => {
  const portal = resolvePortal(req.params.portal);
  if (!portal) return res.status(400).json({ success: false, message: 'Portal tidak valid' });
  const filePath = portal === 'publisher' ? PATHS.publisherTheme : PATHS.devportalTheme;

  try {
    const rawContent = fs.readFileSync(filePath, 'utf8');
    const theme = parseTheme(filePath);
    res.json({ success: true, theme, raw: rawContent });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// ── Save theme (form-based) ────────────────────────────
app.post('/api/theme/:portal', requireAuth, (req, res) => {
  const portal = resolvePortal(req.params.portal);
  if (!portal) return res.status(400).json({ success: false, message: 'Portal tidak valid' });
  const filePath = portal === 'publisher' ? PATHS.publisherTheme : PATHS.devportalTheme;

  try {
    const current = parseTheme(filePath) || { custom: { themes: { light: { palette: {} } } } };

    const {
      primaryColor, secondaryColor, bgDefault, bgPaper,
      navbarBg, footerBg, footerText, fontFamily,
      logoHeight, logoWidth, enableFooter, footerContent,
      globalCSS,
    } = req.body;

    if (!current.custom) current.custom = {};
    if (!current.custom.themes) current.custom.themes = { light: { palette: {}, overrides: {} } };
    if (!current.custom.themes.light) current.custom.themes.light = { palette: {}, overrides: {} };
    if (!current.custom.themes.light.palette) current.custom.themes.light.palette = {};
    if (!current.custom.appBar) current.custom.appBar = {};
    if (!current.custom.footer) current.custom.footer = {};

    const palette = current.custom.themes.light.palette;
    if (primaryColor) palette.primary = { ...(palette.primary || {}), main: primaryColor };
    if (secondaryColor) palette.secondary = { ...(palette.secondary || {}), main: secondaryColor };
    if (bgDefault) palette.background = { ...(palette.background || {}), default: bgDefault };
    if (bgPaper) palette.background = { ...(palette.background || {}), paper: bgPaper };

    if (navbarBg) current.custom.appBar.background = navbarBg;
    if (logoHeight) current.custom.appBar.logoHeight = parseInt(logoHeight, 10);
    if (logoWidth) current.custom.appBar.logoWidth = parseInt(logoWidth, 10);

    if (enableFooter !== undefined) current.custom.footer.active = enableFooter === 'true';
    if (footerContent) current.custom.footer.text = footerContent;
    if (footerBg) current.custom.footer.background = footerBg;
    if (footerText) current.custom.footer.color = footerText;

    if (fontFamily && current.custom.themes.light.typography) {
      current.custom.themes.light.typography.fontFamily = fontFamily;
    } else if (fontFamily) {
      current.custom.themes.light.typography = { fontFamily };
    }

    if (globalCSS !== undefined) current.custom.globalCSSStyles = globalCSS;

    writeTheme(filePath, current);
    res.json({ success: true, message: 'Tema berhasil disimpan! Restart WSO2 untuk menerapkan perubahan.' });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// ── Save raw theme JS ──────────────────────────────────
app.post('/api/theme/:portal/raw', requireAuth, (req, res) => {
  const portal = resolvePortal(req.params.portal);
  if (!portal) return res.status(400).json({ success: false, message: 'Portal tidak valid' });
  const filePath = portal === 'publisher' ? PATHS.publisherTheme : PATHS.devportalTheme;

  try {
    const { content } = req.body;
    if (!content) return res.status(400).json({ success: false, message: 'Content tidak boleh kosong' });

    const err = validateRawThemeContent(content);
    if (err) return res.status(400).json({ success: false, message: err });

    backupThemeFile(filePath);
    fs.writeFileSync(filePath, content, 'utf8');
    res.json({ success: true, message: 'File tema berhasil disimpan!' });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// ── Upload image ───────────────────────────────────────
app.post('/api/images/upload', requireAuth, upload.single('image'), (req, res) => {
  if (!req.file) return res.status(400).json({ success: false, message: 'Tidak ada file yang diupload' });
  res.json({
    success: true,
    message: `File ${req.file.originalname} berhasil diupload`,
    filename: req.file.originalname,
  });
});

// ── List images ────────────────────────────────────────
app.get('/api/images/:portal', requireAuth, (req, res) => {
  const portal = resolvePortal(req.params.portal);
  if (!portal) return res.status(400).json({ success: false, message: 'Portal tidak valid' });
  res.json({ success: true, images: listImages(portal) });
});

// ── Delete image ───────────────────────────────────────
app.delete('/api/images/:portal/:filename', requireAuth, (req, res) => {
  const portal = resolvePortal(req.params.portal);
  if (!portal) return res.status(400).json({ success: false, message: 'Portal tidak valid' });

  const imgPath = portal === 'publisher' ? PATHS.publisherImages : PATHS.devportalImages;
  const filePath = resolveInside(imgPath, req.params.filename);
  if (!filePath) return res.status(400).json({ success: false, message: 'Nama file tidak valid' });

  try {
    if (fs.existsSync(filePath)) {
      fs.removeSync(filePath);
      res.json({ success: true, message: `${req.params.filename} berhasil dihapus` });
    } else {
      res.status(404).json({ success: false, message: 'File tidak ditemukan' });
    }
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// ── Restart WSO2 ───────────────────────────────────────
app.post('/api/restart', requireAuth, async (req, res) => {
  try {
    await restartWSO2();
    res.json({ success: true, message: 'WSO2 sedang direstart. Tunggu sekitar 2-3 menit...' });
  } catch (e) {
    res.status(500).json({ success: false, message: `Gagal restart: ${e.message}. Pastikan Docker socket terhubung.` });
  }
});

// ── Status WSO2 ────────────────────────────────────────
app.get('/api/status', requireAuth, (req, res) => {
  exec('docker inspect --format="{{.State.Status}}" wso2-apim', { timeout: 5000 }, (err, stdout) => {
    const status = err ? 'unknown' : stdout.trim().replace(/"/g, '');
    res.json({ status, container: 'wso2-apim' });
  });
});

// ── Session info ───────────────────────────────────────
app.get('/api/me', requireAuth, (req, res) => {
  res.json({
    username: req.session.username,
    user: req.session.user || null,
    auth_method: req.session.auth_method || 'local',
  });
});

// ── Custom Pages & Menu ────────────────────────────────
app.use('/api', pagesRoutes.build({ PATHS, requireAuth, resolvePortal }));

// ── Healthcheck (tidak perlu auth) ─────────────────────
app.get('/healthz', (req, res) => res.json({ ok: true }));

// ── SPA fallback — non-API path serve React shell ──────
app.get(/^\/(?!api\/|healthz).*/, sendSpa);

// ═══════════════════════════════════════════════════════
// Error handlers
// ═══════════════════════════════════════════════════════

// Multer & generic errors
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    const msg = err.code === 'LIMIT_FILE_SIZE' ? 'Ukuran file melebihi 5MB' : err.message;
    return res.status(400).json({ success: false, message: msg });
  }
  if (err) {
    console.error('[error]', err.message);
    return res.status(500).json({ success: false, message: err.message || 'Internal server error' });
  }
  next();
});

// 404
app.use((req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ success: false, message: 'Endpoint tidak ditemukan' });
  }
  res.status(404).send('Not found');
});

// ── Start server ───────────────────────────────────────
const server = app.listen(PORT, () => {
  console.log(`\n╔════════════════════════════════════╗`);
  console.log(`║   WSO2 Custom Admin Panel          ║`);
  console.log(`║   Running on http://0.0.0.0:${PORT}  ║`);
  console.log(`╚════════════════════════════════════╝\n`);
});

// Graceful shutdown
function shutdown(signal) {
  console.log(`[${signal}] Shutting down...`);
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 10000).unref();
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
