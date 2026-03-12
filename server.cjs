/**
 * ==============================================================================
 * SERVER.CJS - PAYDONE BACKEND V50.66 (THE BUG-FIX EDITION)
 * ==============================================================================
 * BASE    : V50.65 (Sync & Alignment Edition) — 100% preserved
 * MERGED  : V50.66 Critical Bug Fixes
 *
 * CHANGES IN V50.66 vs V50.65:
 *
 *  [FIX #1]  verifyToken middleware — CRITICAL SERVER-CRASH FIX
 *            verifyToken was used as route middleware at lines
 *            /api/ai/knowledge-rules and /api/ai/unknown-prompt
 *            but was never defined as a module-level function.
 *            (The only `verifyToken` was a local `const` inside a route handler.)
 *            This caused TypeError at startup, crashing the server.
 *            Fix: define `verifyToken` as a proper Express middleware function
 *            that validates x-user-id + x-session-token headers.
 *
 *  [FIX #2]  verifyAdminSecret as Express middleware — REQUEST-HANG FIX
 *            verifyAdminSecret was used as route middleware in
 *            POST /api/admin/ai/knowledge-rules and
 *            GET  /api/admin/ai/unknown-prompts but it only accepts
 *            (req) → boolean without calling next().
 *            Express never advances to the handler → requests hang forever.
 *            Fix: added `requireAdminSecret` middleware wrapper that calls
 *            res.status(403) or next() appropriately.
 *
 *  [FIX #3]  POST /api/sales/users/:id/manual-sub — packageId fallback
 *            SalesUsers.tsx does NOT send packageId in the request body.
 *            Backend did `INSERT ... package_id = req.body.packageId` which
 *            inserts NULL, then subsequent JOIN queries silently fail.
 *            Fix: when packageId is missing, backend now queries the first
 *            active non-free package (or the default free package as last
 *            resort) and uses that as the packageId.
 *
 *  [FIX #4]  GET /api/health — updated version string to v50.66
 *
 * CHANGES IN V50.65 vs V50.64:
 *
 *  [FIX #1]  GET /api/sync — tambahkan packages, paymentMethods, promos,
 *            subscriptions ke response payload.
 *            cloudSync.ts (pullUserDataFromCloud) membaca ke-4 field ini dari
 *            sync response untuk menghidrasi local DB. Sebelumnya field-field
 *            ini tidak ada di response sehingga db.packages / db.paymentMethods
 *            / db.promos / db.subscriptions tidak pernah terisi via sync.
 *
 *  [FIX #2]  GET /api/health — update version string ke v50.65
 *
 * NOTE: Perbaikan di sisi frontend yang menyertai release ini:
 *       UserManagement.tsx baris 37: PUT /api/admin/users/:id
 *       → diubah menjadi PUT /api/admin/users-crud/:id agar sesuai dengan
 *         endpoint yang didaftarkan via createCrudEndpoints("users","admin/users-crud").
 *
 * ==============================================================================
 */
 /*
 * CHANGES IN V50.59 vs V50.58:
 *
 *  [FIX #1]  GET /api/notifications → return raw snake_case rows
 *            DashboardLayout.tsx AppNotification type uses snake_case
 *            (is_read, user_id, created_at, image_url). Sebelumnya salah
 *            pakai keysToCamel sehingga fields tidak match.
 *
 *  [FIX #2]  GET /api/user/billing (NEW ENDPOINT)
 *            BillingPage.tsx memanggil GET /user/billing untuk subscription
 *            history user yang sedang login. Endpoint ini belum ada di v50.58.
 *
 *  [FIX #3]  GET /api/sales/settings/idle-threshold (NEW ENDPOINT)
 *            SalesReactivate.tsx memanggil GET untuk membaca idle threshold.
 *            v50.58 hanya punya POST. Sekarang GET ditambahkan.
 *
 *  [FIX #4]  POST /api/sales/users/:id/reactivate (NEW ALIAS)
 *            SalesPromos.tsx & SalesReactivate.tsx memanggil
 *            /sales/users/:id/reactivate, bukan /manual-reactivate.
 *            Ditambahkan alias yang forward ke handler manual-reactivate.
 *
 *  [FIX #5]  PUT /api/sales/promos/:id (NEW ENDPOINT)
 *            SalesPromos.tsx memanggil PUT /sales/promos/:id saat edit promo.
 *            Endpoint ini sebelumnya tidak ada.
 *
 *  [FIX #6]  GET /api/sales/promos → return raw snake_case rows
 *            Promo type di types.ts menggunakan snake_case (discount_percentage,
 *            discount_nominal, valid_until, target_user_id, image_url).
 *            Sebelumnya salah pakai keysToCamel sehingga fields tidak match.
 *
 *  [FIX #7]  POST /api/sales/promos → accept snake_case AND camelCase fields
 *            Frontend mengirim snake_case payload, backend hanya accept camelCase.
 *            Sekarang backend menerima keduanya dengan fallback.
 *
 *  [FIX #8]  GET /api/sales/email-blast-history & alias
 *            SalesEmailBlast.tsx BlastHistory interface butuh field:
 *            sent_to, delivered, failed. Backend sekarang mengembalikan
 *            sent_to = total_sent, delivered = total_sent, failed = 0.
 *
 *  [FIX #9]  POST /api/sales/email-blast → accept 'body' field
 *            SalesEmailBlast.tsx mengirim field 'body' (bukan htmlBody/bodyHtml).
 *            Backend sekarang juga menerima field 'body' sebagai fallback.
 *
 *  [FIX #10] POST /api/sales/settings/idle-threshold → accept 'threshold' field
 *            SalesReactivate.tsx mengirim { threshold } bukan { idleThresholdDays }.
 *            Backend sekarang menerima keduanya.
 *
 * ==============================================================================
 */

console.log("🚀 IGNITING PAYDONE SERVER V50.81-BUGFIX (NARRATIVE + STABILITY EDITION)...");

const { WebSocketServer } = require('ws');
require("dotenv").config();
const express    = require("express");
const path       = require("path");
const fs         = require("fs");
const fsPromises = fs.promises;
const cors       = require("cors");
const helmet     = require("helmet");
const morgan     = require("morgan");
const compression = require("compression");
const multer     = require("multer");
const nodemailer = require("nodemailer");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const { Pool }   = require("pg");
const crypto     = require("crypto");
const { exec }   = require("child_process");
const os         = require("os");

const app    = express();
const PORT   = process.env.PORT || 3001;
const SERVER_SECRET = process.env.ADMIN_SECRET || process.env.PROJECT_ID || (() => { console.warn('[SECURITY] ADMIN_SECRET env var not set! Using insecure fallback. Set ADMIN_SECRET in production.'); return "PAYDONE_EMERGENCY_SECURE_KEY_99X_2026"; })();

// =============================================================================
// --- AES-256 VAULT ---
// =============================================================================
const ENCRYPTION_KEY = crypto.scryptSync(SERVER_SECRET, 'titanium_salt', 32);

const encryptText = (text) => {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', ENCRYPTION_KEY, iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return iv.toString('hex') + ':' + encrypted;
};

const decryptText = (hash) => {
    try {
        const parts = hash.split(':');
        const iv = Buffer.from(parts.shift(), 'hex');
        const encryptedText = Buffer.from(parts.join(':'), 'hex');
        const decipher = crypto.createDecipheriv('aes-256-cbc', ENCRYPTION_KEY, iv);
        let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        return decrypted;
    } catch(e) { return null; }
};

// =============================================================================
// --- STORAGE CONFIG ---
// =============================================================================
const USER_HOME    = os.homedir();
const STORAGE_ROOT = path.join(USER_HOME, "paydone_storage");
const BACKUP_DIR   = path.join(STORAGE_ROOT, "snapshots");
const VERSION_DIR  = path.join(STORAGE_ROOT, "versions");
const UPLOADS_DIR  = path.join(STORAGE_ROOT, "uploads");

const ensureDirs = () => {
    if (!fs.existsSync(STORAGE_ROOT)) fs.mkdirSync(STORAGE_ROOT, { recursive: true });
    if (!fs.existsSync(BACKUP_DIR))   fs.mkdirSync(BACKUP_DIR,   { recursive: true });
    if (!fs.existsSync(VERSION_DIR))  fs.mkdirSync(VERSION_DIR,  { recursive: true });
    if (!fs.existsSync(UPLOADS_DIR))  fs.mkdirSync(UPLOADS_DIR,  { recursive: true });
};
ensureDirs();
console.log(`📁 Storage System active at: ${STORAGE_ROOT}`);

// =============================================================================
// --- 1. MIDDLEWARE & ANTI-BRUTE FORCE ---
// =============================================================================
const uploadDocs = multer({ dest: UPLOADS_DIR, limits: { fileSize: 10 * 1024 * 1024 } });

app.set("trust proxy", 1);
app.use(helmet({ contentSecurityPolicy: false, crossOriginResourcePolicy: false }));
app.use(compression());
app.use(cors({
    origin: process.env.CORS_ORIGIN || '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-user-id', 'x-session-token', 'x-admin-secret', 'x-auth-status', 'Accept-Language'],
    exposedHeaders: ['x-auth-status']
}));
app.use(express.json({ limit: "100mb" }));
app.use(morgan("combined"));
app.use('/uploads', express.static(UPLOADS_DIR));
app.use(express.static(path.join(__dirname, "dist")));

const loginAttempts = new Map();
const authRateLimiter = (req, res, next) => {
    const ip = req.ip;
    const now = Date.now();
    const attempts = loginAttempts.get(ip) || { count: 0, first: now };
    if (now - attempts.first > 60000) { attempts.count = 1; attempts.first = now; }
    else attempts.count++;
    loginAttempts.set(ip, attempts);
    if (attempts.count > 10) return res.status(429).json({ error: "Terlalu banyak percobaan. Coba lagi dalam 1 menit." });
    next();
};

// =============================================================================
// --- 2. DATABASE CONNECTION ---
// =============================================================================
const dbConfig = {
    user:     process.env.DB_USER     || "postgres",
    password: process.env.DB_PASSWORD || process.env.DB_PASS || (console.warn('[SECURITY] DB_PASSWORD env var not set! Set it in your .env file.'), 'REPLACE_WITH_REAL_PASSWORD'),
    database: process.env.DB_NAME     || "paydone_db",
    port:     5432,
};
if (process.env.INSTANCE_UNIX_SOCKET) dbConfig.host = process.env.INSTANCE_UNIX_SOCKET;
else dbConfig.host = process.env.DB_HOST || "127.0.0.1";

const pool = new Pool(dbConfig);
pool.on('error', (err) => { console.error('🚨 [FATAL DB POOL ERROR]', err.message); });

// =============================================================================
// --- 3. HELPER FUNCTIONS ---
// =============================================================================
const toCamel = (s) => s.replace(/([-_][a-z])/gi, ($1) => $1.toUpperCase().replace("-", "").replace("_", ""));
const toSnake = (s) => s.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);

const sanitizeKeys = (obj) => {
    const cleanObj = {};
    Object.keys(obj).forEach(k => { if (/^[a-zA-Z0-9_]+$/.test(k)) cleanObj[k] = obj[k]; });
    return cleanObj;
};

const unpackMetadata = (row) => {
    let cleanRow = { ...row };
    if (cleanRow.metadata && typeof cleanRow.metadata === 'object') cleanRow = { ...cleanRow, ...cleanRow.metadata };
    delete cleanRow.metadata;
    return cleanRow;
};

const keysToCamel = (o) => {
    if (o === Object(o) && !Array.isArray(o) && typeof o !== "function" && !(o instanceof Date)) {
        const n = {};
        // [V50.81 FIX] Do NOT convert null to "". Null numeric fields became ""
        // which caused NaN in frontend arithmetic (DSR, health score, etc.).
        Object.keys(o).forEach((k) => { let value = keysToCamel(o[k]); n[toCamel(k)] = value; });
        return n;
    } else if (Array.isArray(o)) return o.map((i) => keysToCamel(i));
    return o;
};

const keysToSnake = (o) => {
    if (o === Object(o) && !Array.isArray(o) && typeof o !== "function" && !(o instanceof Date)) {
        const n = {};
        Object.keys(o).forEach((k) => { n[toSnake(k)] = keysToSnake(o[k]); });
        return n;
    } else if (Array.isArray(o)) return o.map((i) => keysToSnake(i));
    return o;
};

const toHybridUser = (userRow) => {
    if (!userRow) return null;
    const unpacked = unpackMetadata(userRow);
    const safeSnake = {};
    for (let k in unpacked) safeSnake[k] = unpacked[k] === null ? "" : unpacked[k];
    if (safeSnake.id && !safeSnake.user_id) safeSnake.user_id = safeSnake.id;
    const safeCamel = keysToCamel(unpacked);
    if (safeCamel.id && !safeCamel.userId) safeCamel.userId = safeCamel.id;
    delete safeSnake.password;           delete safeCamel.password;
    delete safeSnake.verification_token; delete safeCamel.verificationToken;
    delete safeSnake.reset_token;        delete safeCamel.resetToken;
    return { ...safeSnake, ...safeCamel };
};

const toISODate = (d) => {
    try {
        if (!d) return null;
        const dateObj = typeof d === 'string' ? new Date(d) : d;
        if (isNaN(dateObj)) return null;
        const tzOffset = dateObj.getTimezoneOffset() * 60000;
        return new Date(dateObj.getTime() - tzOffset).toISOString().split('T')[0];
    } catch (e) { return null; }
};

/**
 * getAppUrlFromDB()
 * Returns the frontend app URL dynamically from DB config:
 *   1. config.appDomain → "https://{domain}"  (e.g. "cosbill.com" → "https://cosbill.com")
 *   2. process.env.APP_URL  → env override
 *   3. Falls back to 'https://cosger.com'
 *
 * Used for email links (verify-email, reset-password) so they follow the
 * white-label domain set in Admin → Global Settings → Brand Identity.
 */
const getAppUrlFromDB = async () => {
    try {
        const r = await pool.query("SELECT data FROM config WHERE id = 'app_config' LIMIT 1");
        const appDomain = r.rows[0]?.data?.appDomain;
        if (appDomain) {
            const cleaned = appDomain.replace(/^https?:\/\//, '').replace(/\/$/, '');
            return `https://${cleaned}`;
        }
    } catch (e) { /* fall through */ }
    return process.env.APP_URL || 'https://cosger.com';
};

const hashPassword = (pwd, storedHash = null) => {
    if (!pwd) return '';
    if (storedHash && storedHash.includes(':')) {
        const [salt, hash] = storedHash.split(':');
        const verifyHash = crypto.scryptSync(pwd, salt, 64).toString('hex');
        return verifyHash === hash;
    }
    const newSalt = crypto.randomBytes(16).toString('hex');
    const newHash = crypto.scryptSync(pwd, newSalt, 64).toString('hex');
    return `${newSalt}:${newHash}`;
};

const saveBase64ToFileAsync = async (base64Str) => {
    if (typeof base64Str !== 'string' || !base64Str.startsWith('data:image')) return base64Str;
    try {
        const matches = base64Str.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
        if (!matches || matches.length !== 3) return base64Str;
        const ext = matches[1].split('/')[1] || 'png';
        const buffer = Buffer.from(matches[2], 'base64');
        const fileName = `img_${Date.now()}_${crypto.randomBytes(4).toString('hex')}.${ext}`;
        await fsPromises.writeFile(path.join(UPLOADS_DIR, fileName), buffer);
        return `/uploads/${fileName}`;
    } catch(e) { return base64Str; }
};

const saveBase64ToFile = (base64Str) => {
    if (typeof base64Str !== 'string' || !base64Str.startsWith('data:image')) return base64Str;
    try {
        const matches = base64Str.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
        if (!matches || matches.length !== 3) return base64Str;
        const ext = matches[1].split('/')[1] || 'png';
        const buffer = Buffer.from(matches[2], 'base64');
        const fileName = `img_${Date.now()}_${crypto.randomBytes(4).toString('hex')}.${ext}`;
        fs.writeFileSync(path.join(UPLOADS_DIR, fileName), buffer);
        return `/uploads/${fileName}`;
    } catch(e) { return base64Str; }
};

const deleteFileIfLocal = async (fileUrl) => {
    if (typeof fileUrl === 'string' && fileUrl.startsWith('/uploads/')) {
        const filePath = path.join(STORAGE_ROOT, fileUrl);
        if (fs.existsSync(filePath)) await fsPromises.unlink(filePath).catch(() => {});
    }
};

const sendEmailEngine = async (toEmail, subject, bodyHtml) => {
    try {
        const confRes = await pool.query("SELECT value FROM global_configs WHERE key = 'smtp_config'");
        if (confRes.rowCount === 0 || !confRes.rows[0].value?.host) {
            console.log(`\n📧 [MOCK EMAIL] To: ${toEmail}\nSubj: ${subject}\n`);
            return;
        }
        const conf = confRes.rows[0].value;
        const rawPass = decryptText(conf.encrypted_password);
        const transporter = nodemailer.createTransport({
            host: conf.host, port: Number(conf.port) || 465, secure: Number(conf.port) === 465,
            auth: { user: conf.user, pass: rawPass }
        });
        await transporter.sendMail({ from: `"${conf.sender_name}" <${conf.user}>`, to: toEmail, subject, html: bodyHtml });
        console.log(`✅ [EMAIL SENT] To: ${toEmail}`);
    } catch (e) { console.error("❌ [EMAIL ERROR]", e.message); }
};

const mockSendEmail = (toEmail, subject, body) => {
    console.log(`\n📧 [EMAIL BLAST] To: ${toEmail}\nSubject: ${subject}\nBody: ${String(body).substring(0, 50)}...\n`);
};

const appendSessionToken = async (userId, token) => {
    await pool.query(
        `UPDATE users SET
            session_token = $1,
            session_tokens = (
                SELECT jsonb_agg(elem) FROM (
                    SELECT elem FROM jsonb_array_elements(COALESCE(session_tokens, '[]'::jsonb) || $2::jsonb) AS elem
                    ORDER BY elem DESC LIMIT 5
                ) s
            )
         WHERE id = $3`,
        [token, JSON.stringify([token]), userId]
    );
};

const verifySession = async (userId, token, res = null) => {
    if (!userId || !token) return false;
    try {
        const r = await pool.query("SELECT session_tokens, last_login, session_token FROM users WHERE id=$1", [userId]);
        if (r.rowCount === 0) return false;
        const row = r.rows[0];
        // Handle session_tokens as array (JSONB), JSON string, or null
        let sessions = [];
        if (Array.isArray(row.session_tokens)) {
            sessions = row.session_tokens;
        } else if (typeof row.session_tokens === 'string') {
            try { sessions = JSON.parse(row.session_tokens); } catch { sessions = []; }
        }
        // Also include legacy single session_token column
        if (row.session_token && typeof row.session_token === 'string') sessions.push(row.session_token);
        if (!sessions.includes(token)) { if (res) res.setHeader('X-Auth-Status', 'Expired'); return false; }
        if (row.last_login && Date.now() - new Date(row.last_login).getTime() > (30 * 24 * 60 * 60 * 1000)) {
            if (res) res.setHeader('X-Auth-Status', 'Expired_Inactivity'); return false;
        }
        return true;
    } catch (e) { return false; }
};

const verifyAdminSecret = (req) => {
    const secret = req.body?.secret || req.query?.secret || req.headers['x-admin-secret'] || req.body?.adminKey || req.query?.kunci;
    return secret === SERVER_SECRET;
};

// [FIX] Async helper: accept admin-secret OR valid admin/super_admin JWT
// Used to replace all inline verifyAdminSecret checks
const verifyAdminOrRole = async (req) => {
    // Fast path: valid secret header
    if (verifyAdminSecret(req)) return true;
    // Fallback: check JWT + role
    const userId = req.headers['x-user-id'];
    const token  = req.headers['x-session-token'] || (req.headers['authorization'] || '').replace('Bearer ', '');
    if (!userId || !token) return false;
    try {
        const sessionOk = await verifySession(userId, token);
        if (!sessionOk) return false;
        const r = await pool.query('SELECT role FROM users WHERE id=$1', [userId]);
        if (r.rowCount === 0) return false;
        return ['super_admin', 'admin', 'superadmin'].includes(r.rows[0].role);
    } catch { return false; }
};

// [V50.66 FIX #1] verifyToken — proper Express middleware
// Previously used as route middleware but was never defined at module scope.
// This caused TypeError on server startup, crashing the server.
const verifyToken = async (req, res, next) => {
    const userId = req.headers['x-user-id'];
    const token  = req.headers['x-session-token'] || (req.headers['authorization'] || '').replace('Bearer ', '');
    if (!userId || !token) return res.status(401).json({ error: 'Unauthorized' });
    const ok = await verifySession(userId, token, res);
    if (!ok) return res.status(401).json({ error: 'Session Invalid' });
    req.userId = userId;
    next();
};

// [V50.66 FIX #2] requireAdminSecret — proper Express middleware wrapper
// Previously verifyAdminSecret (returns boolean) was used directly as route
// middleware, so it never called next() and requests would hang forever.
const requireAdminSecret = async (req, res, next) => {
    if (!(await verifyAdminOrRole(req))) return res.status(403).json({ error: 'Forbidden' });
    next();
};

// [FIX] requireAdminSecretOrRole — accepts admin-secret header OR valid super_admin/admin JWT
// This prevents 403 when admin has the right role but ADMIN_SECRET env var differs from default
const requireAdminSecretOrRole = async (req, res, next) => {
    // 1. Try admin secret header first (fast path)
    if (verifyAdminSecret(req)) return next();

    // 2. Fall back to JWT + role check
    const userId = req.headers['x-user-id'];
    const token  = req.headers['x-session-token'] || (req.headers['authorization'] || '').replace('Bearer ', '');
    if (!userId || !token) return res.status(403).json({ error: 'Forbidden: no valid auth' });

    try {
        const sessionOk = await verifySession(userId, token);
        if (!sessionOk) return res.status(403).json({ error: 'Forbidden: session invalid' });

        const r = await pool.query('SELECT role FROM users WHERE id=$1', [userId]);
        if (r.rowCount === 0) return res.status(403).json({ error: 'Forbidden: user not found' });
        const role = r.rows[0].role;
        if (['super_admin', 'admin', 'superadmin'].includes(role)) return next();

        return res.status(403).json({ error: 'Forbidden: insufficient role' });
    } catch (e) {
        return res.status(403).json({ error: 'Forbidden: ' + String(e) });
    }
};

const getSystemConfig = async () => {
    try {
        const res = await pool.query("SELECT data FROM config WHERE id = 'app_config'");
        const dbData = res.rows[0]?.data || {};
        const gConf = await pool.query("SELECT value FROM global_configs WHERE key = 'gemini_config'");
        let apiKey   = process.env.GEMINI_API_KEY;
        let modelName = "gemini-1.5-flash";
        if (gConf.rowCount > 0 && gConf.rows[0].value?.apiKey)   apiKey   = gConf.rows[0].value.apiKey;
        if (gConf.rowCount > 0 && gConf.rows[0].value?.modelName) modelName = gConf.rows[0].value.modelName;
        return { apiKey: dbData.geminiApiKey || apiKey, modelName: dbData.aiModel || modelName, ...dbData };
    } catch (e) { return { apiKey: process.env.GEMINI_API_KEY, modelName: "gemini-1.5-flash" }; }
};

const runCommand = (cmd) => {
    return new Promise((resolve, reject) => {
        exec(cmd, { cwd: __dirname, maxBuffer: 1024 * 1024 * 10 }, (error, stdout, stderr) => {
            if (error) reject(stderr || error.message); else resolve(stdout);
        });
    });
};

const analyzeFileFeatures = (content) => {
    if (!content) return { percentage: 0, found: [], missing: [] };
    const features = [
        { key: 'AES-256', label: 'AES-256 Encryption' },
        { key: 'sendEmailEngine', label: 'Email Engine' },
        { key: 'authRateLimiter', label: 'Anti-Brute Force' },
        { key: 'session_tokens', label: 'Multi-Session' },
        { key: 'verify-email', label: 'Email Verification' },
        { key: 'scryptSync', label: 'Scrypt Hashing' },
        { key: 'unpackMetadata', label: 'Metadata JSONB' },
        { key: 'getValidColumns', label: 'Schema Cache' },
        { key: 'checkFeatureAccess', label: 'Feature Gating' },
        { key: 'checkAiQuota', label: 'AI Quota' },
        { key: 'broadcastWS', label: 'WebSocket Broadcast' },
        { key: 'getUserActivePackage', label: 'Subscription Engine' },
    ];
    const found   = features.filter(f => content.includes(f.key)).map(f => f.label);
    const missing = features.filter(f => !content.includes(f.key)).map(f => f.label);
    return { percentage: Math.round((found.length / features.length) * 100), found, missing };
};

const schemaCache = {};
const getValidColumns = async (tableName) => {
    if (schemaCache[tableName]) return schemaCache[tableName];
    const r = await pool.query(
        "SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name=$1",
        [tableName]
    );
    schemaCache[tableName] = r.rows.map(x => x.column_name);
    return schemaCache[tableName];
};

// =============================================================================
// --- SEED DATA ---
// =============================================================================
const SEED_AI_AGENTS = [
    { id: "dashboard_summary", name: "AI Dashboard Summary",  description: "Generates summary.",   model: "gemini-1.5-flash", systemInstruction: "You are the user's financial alter-ego. Analyze provided financial data. OUTPUT FORMAT: 3-sentence summary in first-person ('Saya').", updatedAt: new Date() },
    { id: "command_center",    name: "AI Command Center",     description: "Parses intent.",        model: "gemini-1.5-flash", systemInstruction: "You are a financial intent parser. Map INPUT to intents. OUTPUT JSON ONLY.", updatedAt: new Date() },
    { id: "debt_strategist",   name: "AI Debt Strategist",    description: "Analyzes debt.",        model: "gemini-1.5-pro",   systemInstruction: "Act as a Senior Financial Consultant. Compare Snowball vs Avalanche.", updatedAt: new Date() },
    { id: "new_user_wizard",   name: "New User Wizard",       description: "Onboarding.",           model: "gemini-1.5-flash", systemInstruction: "You are a friendly onboarding assistant.", updatedAt: new Date() }
];

const SEED_CONFIG = {
    googleClientId: "417959019304-kdsk1t0rr6l9gukogsmrpavip31fj5f6.apps.googleusercontent.com",
    appName: "Paydone.id", appThemeColor: "#2563eb", aiModel: "gemini-1.5-flash",
    showDetailedLogsToUsers: false,
    systemRules: { provisionRate: 1, adminFeeKPR: 500000, adminFeeNonKPR: 250000, insuranceRateKPR: 2.5, insuranceRateNonKPR: 1.5, notaryFeeKPR: 1, notaryFeeNonKPR: 0.5, benchmarkRateKPR: 7.5, benchmarkRateKKB: 5, benchmarkRateKTA: 11, benchmarkRateCC: 20, refinanceGapThreshold: 2, minPrincipalForRefinance: 50000000, dsrSafeLimit: 30, dsrWarningLimit: 45, anomalyPercentThreshold: 40, anomalyMinAmount: 500000, gracePeriodDays: 7, idleThresholdDays: 90 },
    dashboardWidgets: [ { id: "w_health", type: "health_score", visible: true }, { id: "w_summary", type: "summary_cards", visible: true }, { id: "w_trend", type: "trend_chart", visible: true }, { id: "w_ai", type: "ai_panel", visible: true } ],
    advancedConfig: { syncDebounceMs: 2000, syncRetryAttempts: 3, syncStrategy: "background", defaultRecurringMonths: 12, smartSplitNeeds: 50, smartSplitWants: 30, smartSplitDebt: 20, runwayAssumption: 0, healthScoreWeightDSR: 60, healthScoreWeightSavings: 40, aiThinkingSpeed: 800, incomeProjectionHorizon: 120 }
};

const SYSTEM_FEATURES = [
    // ── Core Features ──────────────────────────────────────
    { key: "pos_budget",           label: "Alokasi Budget (Pos)" },
    { key: "income_tracker",       label: "Catat Pemasukan" },
    { key: "daily_expense",        label: "Catat Pengeluaran Harian" },
    { key: "debt_management",      label: "Manajemen Hutang (Beban)" },
    { key: "tasks_calendar",       label: "Kalender & Task" },
    { key: "sinking_fund",         label: "Dana Cadangan (Sinking Fund)" },
    { key: "bank_accounts",        label: "Manajemen Multi-Rekening" },
    // ── Premium Features ───────────────────────────────────
    { key: "financial_freedom",    label: "Jalan Ninja (Financial Freedom)" },
    { key: "crossing_analysis",    label: "Analisis Crossing (Proyeksi Hutang)" },
    { key: "freedom_matrix",       label: "Freedom Matrix (Simulasi Pelunasan)" },
    // ── AI Features ────────────────────────────────────────
    { key: "ai_command_center",    label: "AI Command Center (Chat)" },
    { key: "ai_daily_expense",     label: "AI Catat Pengeluaran Otomatis" },
    { key: "ai_dashboard_summary", label: "AI Summary Dashboard" },
    // ── Other ──────────────────────────────────────────────
    { key: "activity_logs",        label: "Riwayat Aktivitas" },
    { key: "support_tickets",      label: "Tiket Support" },
];

// =============================================================================
// --- 4. DATABASE INITIALIZATION ---
// =============================================================================
const initDB = async () => {
    const client = await pool.connect();
    try {
        console.log("🛠️ Checking V50.78 DB Schema...");

        await client.query(`CREATE TABLE IF NOT EXISTS global_configs (
            key VARCHAR(255) PRIMARY KEY, value JSONB, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`);

        await client.query(`CREATE TABLE IF NOT EXISTS users (
            id VARCHAR(255) PRIMARY KEY, username VARCHAR(255), email VARCHAR(255), password VARCHAR(255),
            role VARCHAR(50), status VARCHAR(50), created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, last_login TIMESTAMP, photo_url TEXT,
            parent_user_id VARCHAR(255), session_token TEXT, session_tokens JSONB DEFAULT '[]'::jsonb,
            verification_token VARCHAR(255), reset_token VARCHAR(255), badges JSONB,
            risk_profile VARCHAR(255), big_why_url TEXT, financial_freedom_target NUMERIC,
            preferred_language VARCHAR(10) DEFAULT 'id', preferred_currency VARCHAR(10) DEFAULT 'IDR', preferred_timezone VARCHAR(100) DEFAULT 'Asia/Jakarta', preferred_country VARCHAR(10) DEFAULT 'ID', locale_is_auto BOOLEAN DEFAULT TRUE, ai_hits_used INT DEFAULT 0,
            ai_last_reset_date TIMESTAMP, subscription_id VARCHAR(255),
            metadata JSONB DEFAULT '{}'::jsonb
        )`);

        await client.query(`CREATE TABLE IF NOT EXISTS debts (
            id VARCHAR(255) PRIMARY KEY, user_id VARCHAR(255), name VARCHAR(255), type VARCHAR(50),
            original_principal NUMERIC, total_liability NUMERIC, monthly_payment NUMERIC,
            remaining_principal NUMERIC, interest_rate NUMERIC, start_date DATE, end_date DATE,
            due_date INT, bank_name VARCHAR(100), interest_strategy VARCHAR(50), step_up_schedule TEXT,
            payoff_method VARCHAR(255), allocated_extra_budget VARCHAR(255), current_saved_amount NUMERIC,
            early_settlement_discount VARCHAR(255), remaining_months VARCHAR(255),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            metadata JSONB DEFAULT '{}'::jsonb
        )`);

        await client.query(`CREATE TABLE IF NOT EXISTS allocations (
            id VARCHAR(255) PRIMARY KEY, user_id VARCHAR(255), name VARCHAR(255), amount NUMERIC,
            percentage NUMERIC, color VARCHAR(50), icon VARCHAR(50), month_key VARCHAR(255),
            category VARCHAR(255), priority VARCHAR(255), is_transferred BOOLEAN DEFAULT FALSE,
            assigned_account_id VARCHAR(255), is_recurring BOOLEAN DEFAULT TRUE,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, metadata JSONB DEFAULT '{}'::jsonb
        )`);

        await client.query(`CREATE TABLE IF NOT EXISTS daily_expenses (
            id VARCHAR(255) PRIMARY KEY, user_id VARCHAR(255), date DATE, title VARCHAR(255),
            amount NUMERIC, category VARCHAR(100), notes TEXT, receipt_image TEXT,
            allocation_id VARCHAR(255), sinking_fund_id VARCHAR(255),
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, metadata JSONB DEFAULT '{}'::jsonb
        )`);

        await client.query(`CREATE TABLE IF NOT EXISTS incomes (
            id VARCHAR(255) PRIMARY KEY, user_id VARCHAR(255), source VARCHAR(255), amount NUMERIC,
            date DATE, type VARCHAR(50), is_recurring BOOLEAN DEFAULT FALSE, frequency VARCHAR(50),
            date_received DATE, notes TEXT, category VARCHAR(100), end_date TIMESTAMP,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            metadata JSONB DEFAULT '{}'::jsonb
        )`);

        await client.query(`CREATE TABLE IF NOT EXISTS sinking_funds (
            id VARCHAR(255) PRIMARY KEY, user_id VARCHAR(255), name VARCHAR(255), target_amount NUMERIC,
            current_amount NUMERIC, deadline DATE, color VARCHAR(50), icon VARCHAR(50),
            category VARCHAR(255), priority VARCHAR(255), assigned_account_id VARCHAR(255),
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, metadata JSONB DEFAULT '{}'::jsonb
        )`);

        await client.query(`CREATE TABLE IF NOT EXISTS tasks (
            id VARCHAR(255) PRIMARY KEY, user_id VARCHAR(255), title VARCHAR(255), description TEXT,
            category VARCHAR(50), status VARCHAR(50), due_date DATE, context VARCHAR(50),
            related_id VARCHAR(255), type VARCHAR(50), is_completed BOOLEAN DEFAULT FALSE,
            priority VARCHAR(50), updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            metadata JSONB DEFAULT '{}'::jsonb
        )`);

        await client.query(`CREATE TABLE IF NOT EXISTS ai_unknown_prompts (
            id VARCHAR(255) PRIMARY KEY,
            raw_input TEXT NOT NULL,
            user_id VARCHAR(255),
            count INT DEFAULT 1,
            status VARCHAR(50) DEFAULT 'pending',
            resolved_actions JSONB DEFAULT '[]'::jsonb,
            admin_notes TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`);

        await client.query(`CREATE TABLE IF NOT EXISTS bank_accounts (
            id VARCHAR(255) PRIMARY KEY, user_id VARCHAR(255), bank_name VARCHAR(255),
            account_name VARCHAR(255), holder_name VARCHAR(255), account_number VARCHAR(100),
            balance NUMERIC DEFAULT 0, color VARCHAR(255), type VARCHAR(50),
            is_primary BOOLEAN DEFAULT FALSE, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            metadata JSONB DEFAULT '{}'::jsonb
        )`);

        await client.query(`CREATE TABLE IF NOT EXISTS packages (
            id VARCHAR(255) PRIMARY KEY, name VARCHAR(255), price NUMERIC, ai_limit INT,
            features JSONB DEFAULT '{}'::jsonb, is_active BOOLEAN DEFAULT TRUE,
            is_default_free BOOLEAN DEFAULT FALSE, description TEXT, badge_color VARCHAR(50),
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`);

        await client.query(`CREATE TABLE IF NOT EXISTS promos (
            id VARCHAR(255) PRIMARY KEY, code VARCHAR(50) UNIQUE, description TEXT,
            discount_percentage NUMERIC DEFAULT 0, discount_nominal NUMERIC DEFAULT 0,
            quota INT DEFAULT 0, is_active BOOLEAN DEFAULT TRUE, valid_until TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, image_url TEXT, target_user_id VARCHAR(255)
        )`);

        await client.query(`CREATE TABLE IF NOT EXISTS subscriptions (
            id VARCHAR(255) PRIMARY KEY, user_id VARCHAR(255), package_id VARCHAR(255),
            payment_method_id VARCHAR(255), promo_id VARCHAR(255), status VARCHAR(50),
            amount_paid NUMERIC, start_date TIMESTAMP, end_date TIMESTAMP,
            payment_gateway_ref VARCHAR(255), proof_of_payment TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`);

        await client.query(`CREATE TABLE IF NOT EXISTS contents (
            id VARCHAR(255) PRIMARY KEY, author_id VARCHAR(255), title VARCHAR(255),
            slug VARCHAR(255) UNIQUE, body_html TEXT, thumbnail_url TEXT, status VARCHAR(50),
            content_type VARCHAR(50) DEFAULT 'article', media_url TEXT, published_at TIMESTAMP,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`);

        // Seed AI Knowledge Base if empty
        try {
        const kbCheck = await client.query("SELECT value FROM global_configs WHERE key='ai_knowledge_rules'");
        // [V50.78 FIX] value is JSONB — pg returns parsed JS object/array, not the string '[]' or 'null'.
        // Compare against empty array length or check for null/undefined instead of string equality.
        const kbVal = kbCheck.rows[0]?.value;
        const kbEmpty = kbCheck.rows.length === 0 || kbVal === null || kbVal === undefined || (Array.isArray(kbVal) && kbVal.length === 0);
        if (kbEmpty) {
            const seedRules = [{"id": "exp_food", "label": "Catat Makan/Minum", "action": "ADD_EXPENSE", "priority": 10, "isActive": true, "triggers": ["makan", "minum", "kopi", "teh", "bakso", "nasi", "soto", "ayam", "ikan", "pizza", "burger", "jajan", "snack", "sarapan", "lunch", "dinner", "boba", "susu", "es", "jus", "warung", "resto", "cafe", "kedai", "food", "eat"], "example": "catat makan siang 35rb", "defaultFields": {"category": "Food"}, "description": "Pengeluaran makanan & minuman"}, {"id": "exp_transport", "label": "Catat Transportasi", "action": "ADD_EXPENSE", "priority": 10, "isActive": true, "triggers": ["bensin", "solar", "pertamax", "pertalite", "bbm", "parkir", "grab", "gojek", "tol", "ojek", "busway", "kereta", "mrt", "bus", "angkot", "transportasi", "tiket", "travel", "transport", "uber"], "example": "bensin motor 50rb", "defaultFields": {"category": "Transport"}, "description": "Pengeluaran transportasi"}, {"id": "exp_belanja", "label": "Catat Belanja", "action": "ADD_EXPENSE", "priority": 9, "isActive": true, "triggers": ["beli", "belanja", "shopee", "tokopedia", "lazada", "toko", "mall", "indomaret", "alfamart", "hypermart", "supermarket", "shopping", "purchase", "checkout"], "example": "beli baju di mall 200rb", "defaultFields": {"category": "Shopping"}, "description": "Pengeluaran belanja"}, {"id": "exp_tagihan", "label": "Catat Tagihan/Utilitas", "action": "ADD_EXPENSE", "priority": 9, "isActive": true, "triggers": ["listrik", "air", "pdam", "gas", "internet", "wifi", "indihome", "tagihan", "bayar tagihan", "pln", "token", "pulsa", "kuota", "bills", "utility", "netflix", "spotify", "youtube premium"], "example": "bayar listrik 350rb", "defaultFields": {"category": "Utilities"}, "description": "Pengeluaran tagihan & utilitas"}, {"id": "exp_hiburan", "label": "Catat Hiburan", "action": "ADD_EXPENSE", "priority": 8, "isActive": true, "triggers": ["nonton", "bioskop", "film", "game", "main", "hiburan", "liburan", "wisata", "konser", "event", "entertainment", "subscribe", "langganan"], "example": "nonton bioskop 75rb", "defaultFields": {"category": "Entertainment"}, "description": "Pengeluaran hiburan"}, {"id": "exp_kesehatan", "label": "Catat Kesehatan", "action": "ADD_EXPENSE", "priority": 9, "isActive": true, "triggers": ["obat", "dokter", "rumah sakit", "klinik", "apotek", "vitamin", "suplemen", "check up", "medical", "berobat", "bpjs", "puskesmas"], "example": "beli obat 45rb", "defaultFields": {"category": "Others"}, "description": "Pengeluaran kesehatan"}, {"id": "exp_cicilan", "label": "Catat Bayar Cicilan", "action": "ADD_EXPENSE", "priority": 9, "isActive": true, "triggers": ["bayar cicilan", "bayar kredit", "bayar pinjaman", "angsuran", "bayar hutang", "cicil"], "example": "bayar cicilan motor 900rb", "defaultFields": {"category": "Others"}, "description": "Pengeluaran bayar cicilan"}, {"id": "exp_general", "label": "Catat Pengeluaran Umum", "action": "ADD_EXPENSE", "priority": 5, "isActive": true, "triggers": ["catat", "pengeluaran", "expense", "spend", "keluar", "habis", "bayar"], "example": "catat pengeluaran parkir 5rb", "defaultFields": {"category": "Others"}, "description": "Pengeluaran umum"}, {"id": "inc_gaji", "label": "Log Gaji Masuk", "action": "ADD_INCOME", "priority": 10, "isActive": true, "triggers": ["gaji", "salary", "slip gaji", "take home pay", "thp", "terima gaji", "gajian"], "example": "gaji bulan ini 8jt", "defaultFields": {"source": "Gaji", "category": "salary"}, "description": "Log penerimaan gaji"}, {"id": "inc_freelance", "label": "Log Pendapatan Freelance", "action": "ADD_INCOME", "priority": 9, "isActive": true, "triggers": ["freelance", "project", "fee project", "honor", "klien", "client", "bayaran project", "hasil kerja"], "example": "dapat fee project 3jt", "defaultFields": {"source": "Freelance", "category": "freelance"}, "description": "Log pendapatan freelance"}, {"id": "inc_bonus", "label": "Log Bonus/THR", "action": "ADD_INCOME", "priority": 9, "isActive": true, "triggers": ["bonus", "thr", "insentif", "incentive", "komisi", "commission", "reward", "hadiah uang"], "example": "terima bonus tahunan 5jt", "defaultFields": {"source": "Bonus", "category": "bonus"}, "description": "Log bonus & THR"}, {"id": "inc_transfer", "label": "Log Transfer Masuk", "action": "ADD_INCOME", "priority": 8, "isActive": true, "triggers": ["transfer masuk", "terima transfer", "uang masuk", "dapet transferan", "masuk rekening", "deposit"], "example": "transfer masuk dari ibu 500rb", "defaultFields": {"source": "Transfer", "category": "other"}, "description": "Log transfer masuk"}, {"id": "inc_general", "label": "Log Pemasukan Umum", "action": "ADD_INCOME", "priority": 5, "isActive": true, "triggers": ["pemasukan", "income", "dapat uang", "terima uang", "masuk", "pendapatan", "penghasilan"], "example": "pemasukan hari ini 200rb", "defaultFields": {"source": "Lainnya", "category": "other"}, "description": "Log pemasukan umum"}, {"id": "task_cicilan", "label": "Reminder Bayar Cicilan", "action": "ADD_TASK", "priority": 9, "isActive": true, "triggers": ["ingatkan bayar", "reminder bayar", "jangan lupa bayar", "ingat cicilan", "deadline cicilan"], "example": "ingatkan bayar cicilan besok", "defaultFields": {"priority": "high"}, "description": "Pengingat bayar cicilan"}, {"id": "task_general", "label": "Buat Tugas/Reminder", "action": "ADD_TASK", "priority": 6, "isActive": true, "triggers": ["ingatkan", "remind me", "jangan lupa", "todo", "tugas", "task", "jadwal", "schedule", "besok", "lusa", "minggu depan"], "example": "ingatkan meeting klien besok jam 10", "defaultFields": {"priority": "medium"}, "description": "Tugas dan pengingat umum"}, {"id": "health_check", "label": "Cek Kesehatan Finansial", "action": "CHECK_HEALTH", "priority": 8, "isActive": true, "triggers": ["cek kesehatan", "analisa keuangan", "kondisi keuangan", "gimana keuangan", "financial health", "skor keuangan", "dsr saya", "runway saya", "status keuangan"], "example": "cek kesehatan keuangan saya", "defaultFields": {}, "description": "Analisa kesehatan keuangan"}, {"id": "show_debts", "label": "Lihat Hutang", "action": "SHOW_DEBTS", "priority": 7, "isActive": true, "triggers": ["lihat hutang", "cek hutang", "hutang saya", "total hutang", "cicilan saya", "kredit saya", "daftar hutang", "pinjaman saya"], "example": "lihat semua hutang aktif saya", "defaultFields": {}, "description": "Daftar hutang aktif"}];
            await client.query(
                "INSERT INTO global_configs(key,value,updated_at) VALUES('ai_knowledge_rules',$1,NOW()) ON CONFLICT(key) DO UPDATE SET value=$1,updated_at=NOW()",
                [JSON.stringify(seedRules)]
            );
            console.log('[AI] Knowledge base seeded with', seedRules.length, 'rules');
        }
        } catch(seedErr) { console.warn('[AI] Seed skipped:', seedErr.message); }

        await client.query(`CREATE TABLE IF NOT EXISTS email_queues (
            id VARCHAR(255) PRIMARY KEY, to_email VARCHAR(255), subject VARCHAR(255),
            body_html TEXT, scheduled_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            status VARCHAR(50) DEFAULT 'pending', created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`);

        await client.query(`CREATE TABLE IF NOT EXISTS ai_agents (
            id VARCHAR(255) PRIMARY KEY, name VARCHAR(255), description TEXT, model VARCHAR(100),
            system_instruction TEXT, temperature VARCHAR(255), updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`);

        await client.query(`CREATE TABLE IF NOT EXISTS qa_scenarios (
            id VARCHAR(255) PRIMARY KEY, name VARCHAR(255), category VARCHAR(50), type VARCHAR(50),
            target VARCHAR(255), method VARCHAR(10), payload TEXT, description TEXT,
            expected_status INT, is_negative_case BOOLEAN, created_at TIMESTAMP, last_run TIMESTAMP,
            last_status VARCHAR(50), updated_at TIMESTAMP
        )`);

        await client.query(`CREATE TABLE IF NOT EXISTS debt_installments (
            id VARCHAR(255) PRIMARY KEY, debt_id VARCHAR(255), user_id VARCHAR(255), period INT,
            due_date DATE, amount NUMERIC, principal_part NUMERIC, interest_part NUMERIC,
            remaining_balance NUMERIC, status VARCHAR(50), notes TEXT,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, metadata JSONB DEFAULT '{}'::jsonb
        )`);

        await client.query(`CREATE TABLE IF NOT EXISTS payment_records (
            id VARCHAR(255) PRIMARY KEY, debt_id VARCHAR(255), user_id VARCHAR(255),
            amount NUMERIC, paid_date DATE, source_bank VARCHAR(100), status VARCHAR(50),
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, metadata JSONB DEFAULT '{}'::jsonb
        )`);

        await client.query(`CREATE TABLE IF NOT EXISTS config (
            id VARCHAR(255) PRIMARY KEY, data JSONB, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`);

        await client.query(`CREATE TABLE IF NOT EXISTS qa_history (
            id VARCHAR(255) PRIMARY KEY, scenario_id VARCHAR(255), timestamp TIMESTAMP,
            status VARCHAR(50), result_message TEXT, duration_ms INT
        )`);

        await client.query(`CREATE TABLE IF NOT EXISTS tickets (
            id VARCHAR(255) PRIMARY KEY, user_id VARCHAR(255), title TEXT, description TEXT,
            priority VARCHAR(20), status VARCHAR(20), source VARCHAR(50), assigned_to VARCHAR(255),
            created_at TIMESTAMP, resolved_at TIMESTAMP, resolution_note TEXT, fix_logs JSONB,
            backup_data TEXT, is_rolled_back BOOLEAN, updated_at TIMESTAMP,
            metadata JSONB DEFAULT '{}'::jsonb
        )`);

        await client.query(`CREATE TABLE IF NOT EXISTS ba_configurations (
            id VARCHAR(255) PRIMARY KEY, type VARCHAR(255), data JSONB,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`);

        await client.query(`CREATE TABLE IF NOT EXISTS banks (
            id VARCHAR(255) PRIMARY KEY, name VARCHAR(255), type VARCHAR(255),
            promo_rate NUMERIC, fixed_year NUMERIC, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`);

        await client.query(`CREATE TABLE IF NOT EXISTS activity_logs (
            id VARCHAR(255) PRIMARY KEY, user_id VARCHAR(255), action VARCHAR(255),
            description TEXT, payload JSONB, response JSONB, status VARCHAR(50),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            metadata JSONB DEFAULT '{}'::jsonb
        )`);

        await client.query(`CREATE TABLE IF NOT EXISTS payment_methods (
            id VARCHAR(255) PRIMARY KEY, bank_name VARCHAR(255), account_number VARCHAR(255),
            account_name VARCHAR(255), is_active BOOLEAN DEFAULT TRUE,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`);

        await client.query(`CREATE TABLE IF NOT EXISTS leads (
            id VARCHAR(255) PRIMARY KEY, name VARCHAR(255), email VARCHAR(255) UNIQUE,
            source VARCHAR(100), created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`);

        await client.query(`CREATE TABLE IF NOT EXISTS notifications (
            id VARCHAR(255) PRIMARY KEY, user_id VARCHAR(255), title VARCHAR(255),
            message TEXT, image_url TEXT, is_read BOOLEAN DEFAULT FALSE,
            type VARCHAR(50) DEFAULT 'info', link TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`);

        await client.query(`CREATE TABLE IF NOT EXISTS email_campaigns (
            id VARCHAR(255) PRIMARY KEY, author_id VARCHAR(255), subject VARCHAR(255),
            body_html TEXT, target_audience VARCHAR(50), total_sent INT DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`);

        // [V50.57] client_telemetry: route_url diperlebar jadi VARCHAR(500) untuk URL panjang
        await client.query(`CREATE TABLE IF NOT EXISTS client_telemetry (
            id VARCHAR(255) PRIMARY KEY, user_id VARCHAR(255), error_message TEXT,
            stack_trace TEXT, route_url VARCHAR(500), browser_info TEXT,
            state_snapshot JSONB, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`);

        // Schema migrations
        console.log("🔧 Applying V50.78 Schema Migrations...");
        const migrations = [
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_id VARCHAR(255)",
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS ai_hits_used INT DEFAULT 0",
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS ai_last_reset_date TIMESTAMP",
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS badges JSONB",
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS risk_profile VARCHAR(255)",
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS big_why_url TEXT",
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS financial_freedom_target NUMERIC",
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS preferred_language VARCHAR(10) DEFAULT 'id'",
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS preferred_currency VARCHAR(10) DEFAULT 'IDR'",
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS preferred_timezone VARCHAR(100) DEFAULT 'Asia/Jakarta'",
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS preferred_country VARCHAR(10) DEFAULT 'ID'",
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS locale_is_auto BOOLEAN DEFAULT TRUE",
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS session_tokens JSONB DEFAULT '[]'::jsonb",
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_token VARCHAR(255)",
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token VARCHAR(255)",
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb",
            "ALTER TABLE debts ADD COLUMN IF NOT EXISTS remaining_months VARCHAR(255)",
            "ALTER TABLE debts ADD COLUMN IF NOT EXISTS payoff_method VARCHAR(255)",
            "ALTER TABLE debts ADD COLUMN IF NOT EXISTS allocated_extra_budget VARCHAR(255)",
            "ALTER TABLE debts ADD COLUMN IF NOT EXISTS current_saved_amount NUMERIC",
            "ALTER TABLE debts ADD COLUMN IF NOT EXISTS early_settlement_discount VARCHAR(255)",
            "ALTER TABLE debts ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP",
            "ALTER TABLE debts ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb",
            "ALTER TABLE allocations ADD COLUMN IF NOT EXISTS month_key VARCHAR(255)",
            "ALTER TABLE allocations ADD COLUMN IF NOT EXISTS category VARCHAR(255)",
            "ALTER TABLE allocations ADD COLUMN IF NOT EXISTS priority VARCHAR(255)",
            "ALTER TABLE allocations ADD COLUMN IF NOT EXISTS is_transferred BOOLEAN DEFAULT FALSE",
            "ALTER TABLE allocations ADD COLUMN IF NOT EXISTS assigned_account_id VARCHAR(255)",
            "ALTER TABLE allocations ADD COLUMN IF NOT EXISTS is_recurring BOOLEAN DEFAULT TRUE",
            "ALTER TABLE allocations ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb",
            "ALTER TABLE daily_expenses ADD COLUMN IF NOT EXISTS sinking_fund_id VARCHAR(255)",
            "ALTER TABLE daily_expenses ADD COLUMN IF NOT EXISTS receipt_image TEXT",
            "ALTER TABLE daily_expenses ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb",
            "ALTER TABLE incomes ADD COLUMN IF NOT EXISTS end_date TIMESTAMP",
            "ALTER TABLE incomes ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb",
            "ALTER TABLE sinking_funds ADD COLUMN IF NOT EXISTS category VARCHAR(255)",
            "ALTER TABLE sinking_funds ADD COLUMN IF NOT EXISTS priority VARCHAR(255)",
            "ALTER TABLE sinking_funds ADD COLUMN IF NOT EXISTS assigned_account_id VARCHAR(255)",
            "ALTER TABLE sinking_funds ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb",
            "ALTER TABLE tasks ADD COLUMN IF NOT EXISTS description TEXT",
            "ALTER TABLE tasks ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb",
            "ALTER TABLE bank_accounts ADD COLUMN IF NOT EXISTS account_name VARCHAR(255)",
            "ALTER TABLE bank_accounts ADD COLUMN IF NOT EXISTS is_primary BOOLEAN DEFAULT FALSE",
            "ALTER TABLE bank_accounts ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb",
            "ALTER TABLE packages ADD COLUMN IF NOT EXISTS description TEXT",
            "ALTER TABLE packages ADD COLUMN IF NOT EXISTS badge_color VARCHAR(50)",
            "ALTER TABLE debt_installments ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb",
            "ALTER TABLE payment_records ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb",
            "ALTER TABLE tickets ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb",
            "ALTER TABLE activity_logs ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb",
        // [V50.61] category column for contents table (used by SalesContent & BlogPage)
            "ALTER TABLE contents ADD COLUMN IF NOT EXISTS category VARCHAR(255)",
        // [V50.61] logo_url column for payment_methods table (used by SalesPaymentMethods.tsx)
            "ALTER TABLE payment_methods ADD COLUMN IF NOT EXISTS logo_url TEXT",
        // [V50.58] event_type column for client_telemetry (crash vs analytics event)
            "ALTER TABLE client_telemetry ADD COLUMN IF NOT EXISTS event_type VARCHAR(50) DEFAULT 'crash'",
            // [V50.57] Pastikan route_url di client_telemetry cukup panjang untuk URL kompleks
            "ALTER TABLE client_telemetry ALTER COLUMN route_url TYPE VARCHAR(500)",
            // [V50.66] Missing columns discovered via schema audit
            "ALTER TABLE tasks ADD COLUMN IF NOT EXISTS type VARCHAR(50) DEFAULT 'task'",
            "ALTER TABLE tasks ADD COLUMN IF NOT EXISTS is_completed BOOLEAN DEFAULT FALSE",
            "ALTER TABLE tasks ADD COLUMN IF NOT EXISTS related_id VARCHAR(255)",
            "ALTER TABLE tasks ADD COLUMN IF NOT EXISTS priority VARCHAR(50) DEFAULT 'medium'",
            "ALTER TABLE tasks ADD COLUMN IF NOT EXISTS context VARCHAR(255)",
            "ALTER TABLE bank_accounts ADD COLUMN IF NOT EXISTS holder_name VARCHAR(255)",
            "ALTER TABLE bank_accounts ADD COLUMN IF NOT EXISTS color VARCHAR(100)",
            "ALTER TABLE incomes ADD COLUMN IF NOT EXISTS date DATE",
            "ALTER TABLE incomes ADD COLUMN IF NOT EXISTS is_recurring BOOLEAN DEFAULT FALSE",
            "ALTER TABLE incomes ADD COLUMN IF NOT EXISTS category VARCHAR(100)",
            "ALTER TABLE incomes ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP",
            "ALTER TABLE daily_expenses ADD COLUMN IF NOT EXISTS notes TEXT",
            "ALTER TABLE daily_expenses ADD COLUMN IF NOT EXISTS allocation_id VARCHAR(255)",
            "ALTER TABLE daily_expenses ADD COLUMN IF NOT EXISTS date DATE",
            "ALTER TABLE notifications ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP",
            "ALTER TABLE notifications ADD COLUMN IF NOT EXISTS type VARCHAR(50) DEFAULT 'info'",
            "ALTER TABLE notifications ADD COLUMN IF NOT EXISTS link TEXT",
            "ALTER TABLE ai_unknown_prompts ADD COLUMN IF NOT EXISTS resolved_actions JSONB DEFAULT '[]'::jsonb",
            "ALTER TABLE qa_scenarios ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP",
            "ALTER TABLE promos ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP",
            "ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP",
            "ALTER TABLE packages ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP",
        ];
        for (const sql of migrations) { await client.query(sql).catch(() => {}); }

        // [V50.81 FIX] Index must be (user_id, amount_paid) — not amount_paid alone.
        // The old index rejected valid invoices from different users that happened to
        // share the same final amount (basePrice + randomCode).
        await client.query("CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_pending_payment ON subscriptions (user_id, amount_paid) WHERE status = 'awaiting_payment'").catch(() => {});

        // Seed: Default Free Package
        const checkFree = await client.query("SELECT id FROM packages WHERE is_default_free = TRUE");
        if (checkFree.rowCount === 0) {
            const defaultFreeFeatures = JSON.stringify({ pos_budget: true, income_tracker: true, daily_expense: true, debt_management: true, tasks_calendar: true, activity_logs: true, support_tickets: true, ai_command_center: true, ai_daily_expense: true, ai_dashboard_summary: true, sinking_fund: false, bank_accounts: false, financial_freedom: false, crossing_analysis: false, freedom_matrix: false });
            await client.query(`INSERT INTO packages (id, name, price, ai_limit, features, is_active, is_default_free) VALUES ('pkg-free-default', 'Free Plan', 0, 10, $1, TRUE, TRUE)`, [defaultFreeFeatures]);
        }

        // Seed: AI Agents
        for (let a of SEED_AI_AGENTS) {
            await client.query(`INSERT INTO ai_agents (id,name,description,model,system_instruction,updated_at) VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (id) DO UPDATE SET system_instruction=EXCLUDED.system_instruction`, [a.id, a.name, a.description, a.model, a.systemInstruction, a.updatedAt]);
        }

        // Seed: App Config
        if (process.env.GEMINI_API_KEY) SEED_CONFIG.geminiApiKey = process.env.GEMINI_API_KEY;
        await client.query(`INSERT INTO config (id, data, updated_at) VALUES ('app_config', $1, NOW()) ON CONFLICT (id) DO NOTHING`, [SEED_CONFIG]);

        console.log("✅ V50.78 DB Init Complete. All tables ready.");
    } catch (e) { console.error("❌ DB Init Error:", e.message); }
    finally { client.release(); }
};
initDB();

// =============================================================================
// --- SUBSCRIPTION & FEATURES ENGINE ---
// =============================================================================
const getUserActivePackage = async (userId) => {
    const confRes = await pool.query("SELECT data FROM config WHERE id = 'app_config'");
    const gracePeriodDays = confRes.rows[0]?.data?.systemRules?.gracePeriodDays || 0;

    const uRes = await pool.query("SELECT ai_last_reset_date FROM users WHERE id=$1", [userId]);
    if (uRes.rows.length > 0) {
        const lastReset = uRes.rows[0].ai_last_reset_date ? new Date(uRes.rows[0].ai_last_reset_date) : new Date(0);
        const now = new Date();
        if (lastReset.getMonth() !== now.getMonth() || lastReset.getFullYear() !== now.getFullYear()) {
            await pool.query("UPDATE users SET ai_hits_used = 0, ai_last_reset_date = NOW() WHERE id=$1", [userId]);
        }
    }

    const r = await pool.query(`SELECT s.id as sub_id, p.id as package_id, p.name as package_name, p.features, p.ai_limit, s.status, s.end_date, s.amount_paid FROM users u LEFT JOIN subscriptions s ON u.subscription_id = s.id LEFT JOIN packages p ON s.package_id = p.id WHERE u.id=$1`, [userId]);
    let activeSub = null; let inGracePeriod = false; let daysLeftGrace = 0;

    if (r.rows.length > 0 && r.rows[0].status === 'active') {
        const endDate = new Date(r.rows[0].end_date); const now = new Date();
        const cutoffDate = new Date(endDate); cutoffDate.setDate(cutoffDate.getDate() + gracePeriodDays);
        if (now <= cutoffDate) {
            activeSub = r.rows[0];
            if (now > endDate) { inGracePeriod = true; daysLeftGrace = Math.ceil((cutoffDate - now) / (1000 * 60 * 60 * 24)); }
        } else {
            await pool.query("UPDATE subscriptions SET status = 'expired' WHERE id = $1", [r.rows[0].sub_id]);
            await assignDefaultFreePackage(userId);
        }
    }

    if (activeSub) return { packageId: activeSub.package_id, features: typeof activeSub.features === 'string' ? JSON.parse(activeSub.features) : activeSub.features, aiLimit: activeSub.ai_limit, status: { inGracePeriod, daysLeftGrace, isFreeTier: false, currentPackage: activeSub.package_name || 'Premium Plan', endDate: activeSub.end_date ? new Date(activeSub.end_date).toISOString() : undefined, amountPaid: Number(activeSub.amount_paid || 0) } };
    const freePkg = await pool.query("SELECT id, features, ai_limit FROM packages WHERE is_default_free = TRUE LIMIT 1");
    if (freePkg.rows.length > 0) return { packageId: freePkg.rows[0].id, features: typeof freePkg.rows[0].features === 'string' ? JSON.parse(freePkg.rows[0].features) : freePkg.rows[0].features, aiLimit: freePkg.rows[0].ai_limit, status: { inGracePeriod: false, daysLeftGrace: 0, isFreeTier: true } };
    return { packageId: null, features: {}, aiLimit: 0, status: { inGracePeriod: false, daysLeftGrace: 0 } };
};

const assignDefaultFreePackage = async (userId, packageIdOverride = null) => {
    try {
        let pkgIdToAssign = packageIdOverride;
        if (!pkgIdToAssign) {
            const freePkg = await pool.query("SELECT id FROM packages WHERE is_default_free = TRUE LIMIT 1");
            if (freePkg.rows.length > 0) pkgIdToAssign = freePkg.rows[0].id;
        }
        if (pkgIdToAssign) {
            const subId = `sub-${crypto.randomUUID()}`; const endDate = new Date(); endDate.setFullYear(endDate.getFullYear() + 10);
            await pool.query("INSERT INTO subscriptions (id, user_id, package_id, status, start_date, end_date, amount_paid) VALUES ($1, $2, $3, 'active', NOW(), $4, 0)", [subId, userId, pkgIdToAssign, endDate]);
            await pool.query("UPDATE users SET subscription_id = $1, ai_hits_used = 0 WHERE id = $2", [subId, userId]);
            if (global.broadcastWS) global.broadcastWS({ type: "FORCE_SYNC", userId });
        }
    } catch (e) {}
};

// =============================================================================
// --- MIDDLEWARES ---
// =============================================================================
const requireRole = (allowedRoles) => {
    return async (req, res, next) => {
        const userId = req.headers["x-user-id"]; const token = req.headers["x-session-token"];
        if (!(await verifySession(userId, token, res))) return res.status(401).json({ error: "Unauthorized" });
        try {
            const r = await pool.query("SELECT role FROM users WHERE id=$1", [userId]);
            if (r.rows.length === 0) return res.status(401).json({ error: "User not found" });
            // [V50.81 FIX] super_admin and superadmin must also bypass role check,
            // same as admin. Previously super_admin was rejected from sales routes.
            const userRole = r.rows[0].role;
            if (!allowedRoles.includes(userRole) && !['admin', 'super_admin', 'superadmin'].includes(userRole)) return res.status(403).json({ error: "Access denied." });
            next();
        } catch (e) { res.status(500).json({ error: e.message }); }
    };
};

const checkFeatureAccess = (featureKey) => {
    return async (req, res, next) => {
        if (!featureKey || req.originalUrl.includes("admin")) return next();
        const userId = req.headers["x-user-id"]; const token = req.headers["x-session-token"];
        if (!(await verifySession(userId, token, res))) return res.status(401).json({ error: "Unauthorized" });
        try {
            const activeData = await getUserActivePackage(userId);
            // V50.78 FIX: align with frontend freemiumStore backward-compat logic.
            // Only block if feature is explicitly false. Missing key = unlocked by default.
            if (activeData.features[featureKey] === false) return res.status(403).json({ error: `Fitur ${featureKey} terkunci.`, action: "upgrade_required", locked_feature: featureKey });
            next();
        } catch (e) { res.status(500).json({ error: e.message }); }
    };
};

const checkAiQuota = async (req, res, next) => {
    const userId = req.headers["x-user-id"]; const token = req.headers["x-session-token"];
    if (!(await verifySession(userId, token, res))) return res.status(401).json({ error: "Unauthorized" });
    try {
        const activeData = await getUserActivePackage(userId);
        const uRes = await pool.query("SELECT ai_hits_used, preferred_language FROM users WHERE id=$1", [userId]);
        const aiUsed = uRes.rows[0].ai_hits_used || 0;
        if (activeData.aiLimit !== null && aiUsed >= activeData.aiLimit) return res.status(402).json({ error: "Limit AI Paket Anda habis.", action: "upgrade_required" });
        const ded = await pool.query("UPDATE users SET ai_hits_used = ai_hits_used + 1 WHERE id=$1 AND ai_hits_used < $2 RETURNING id", [userId, activeData.aiLimit !== null ? activeData.aiLimit : 9999]);
        if (ded.rowCount === 0) return res.status(402).json({ error: "Limit AI habis (Concurrent).", action: "upgrade_required" });
        req.userLang = uRes.rows[0].preferred_language || 'id';
        next();
    } catch (e) { res.status(500).json({ error: e.message }); }
};

// =============================================================================
// --- UTILITY ROUTES ---
// =============================================================================
app.get("/api/health", (req, res) => res.json({ status: "ok", version: "v50.81-bugfix", db: "connected" }));
app.get("/api/features/list", (req, res) => res.json(SYSTEM_FEATURES));

// =============================================================================
// --- 5. TELEMETRY — SENTINEL CRASH INTELLIGENCE ENGINE (V50.57) ---
// ─────────────────────────────────────────────────────────────────────────────
// Menangkap SEMUA detail crash dari frontend: lokasi, error, API context,
// device info, network, state snapshot. Jika severity HIGH/CRITICAL, otomatis
// membuat tiket di tabel tickets dan broadcast alert realtime ke admin.
// =============================================================================
app.post("/api/telemetry/crash", async (req, res) => {
    const {
        // ── IDENTITAS USER ────────────────────────────────────────────────
        userId,
        username,
        // ── LOKASI KEJADIAN ───────────────────────────────────────────────
        routeUrl,
        menuName,
        moduleName,
        componentName,
        actionPerformed,
        previousRoute,
        // ── DETAIL ERROR ──────────────────────────────────────────────────
        errorMessage,
        errorType,
        stackTrace,
        severity,
        // ── KONTEKS API ───────────────────────────────────────────────────
        lastApiCall,
        lastApiPayload,
        lastApiResponse,
        lastApiStatusCode,
        // ── INFO BROWSER/DEVICE ───────────────────────────────────────────
        browserInfo,
        browserName,
        operatingSystem,
        screenResolution,
        deviceType,
        // ── INFO JARINGAN ─────────────────────────────────────────────────
        networkOnline,
        networkType,
        // ── STATE APLIKASI ────────────────────────────────────────────────
        stateSnapshot,
        // ── KONTEKS TAMBAHAN ──────────────────────────────────────────────
        additionalContext,
        appVersion,
        sessionDurationSeconds,
    } = req.body;

    const crashId = `crash-${crypto.randomUUID()}`;
    const crashTimestamp = new Date();

    // Hapus data sensitif sebelum disimpan ke DB
    const sanitizeForStorage = (obj, maxDepth = 3, currentDepth = 0) => {
        if (!obj || typeof obj !== 'object' || currentDepth > maxDepth) return obj;
        const sensitiveKeys = ['password', 'token', 'sessionToken', 'secret', 'apiKey', 'Authorization'];
        const sanitized = {};
        for (const key of Object.keys(obj)) {
            if (sensitiveKeys.some(sk => key.toLowerCase().includes(sk.toLowerCase()))) {
                sanitized[key] = '[REDACTED]';
            } else if (typeof obj[key] === 'object') {
                sanitized[key] = sanitizeForStorage(obj[key], maxDepth, currentDepth + 1);
            } else {
                sanitized[key] = obj[key];
            }
        }
        return sanitized;
    };

    // Bangun full crash context object — disimpan di state_snapshot (JSONB)
    const fullCrashContext = {
        crashId,
        timestamp: crashTimestamp.toISOString(),
        identity: {
            userId:   userId   || 'anonymous',
            username: username || 'unknown',
        },
        location: {
            routeUrl:        String(routeUrl        || '').substring(0, 500),
            menuName:        String(menuName        || '').substring(0, 255),
            moduleName:      String(moduleName      || '').substring(0, 255),
            componentName:   String(componentName   || '').substring(0, 255),
            actionPerformed: String(actionPerformed || '').substring(0, 500),
            previousRoute:   String(previousRoute   || '').substring(0, 500),
        },
        error: {
            message:    String(errorMessage || '').substring(0, 1000),
            type:       String(errorType    || 'UnknownError').substring(0, 100),
            stackTrace: String(stackTrace   || '').substring(0, 5000),
            severity:   ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].includes(severity) ? severity : 'MEDIUM',
        },
        apiContext: {
            lastEndpoint:   String(lastApiCall       || '').substring(0, 255),
            lastStatusCode: Number(lastApiStatusCode || 0),
            lastPayload:    sanitizeForStorage(lastApiPayload),
            lastResponse:   sanitizeForStorage(lastApiResponse),
        },
        device: {
            browserInfo:      String(browserInfo      || '').substring(0, 500),
            browserName:      String(browserName      || '').substring(0, 100),
            operatingSystem:  String(operatingSystem  || '').substring(0, 100),
            screenResolution: String(screenResolution || '').substring(0, 50),
            deviceType:       String(deviceType       || 'unknown').substring(0, 20),
        },
        network: {
            online: networkOnline !== undefined ? Boolean(networkOnline) : true,
            type:   String(networkType || 'unknown').substring(0, 50),
        },
        appState: {
            appVersion:             String(appVersion || 'unknown').substring(0, 50),
            sessionDurationSeconds: Number(sessionDurationSeconds || 0),
            stateSnapshot:          sanitizeForStorage(stateSnapshot),
        },
        additionalContext: sanitizeForStorage(additionalContext),
    };

    const finalSeverity = fullCrashContext.error.severity;

    try {
        // ── STEP 1: Simpan ke tabel client_telemetry ──────────────────────
        await pool.query(
            `INSERT INTO client_telemetry
             (id, user_id, error_message, stack_trace, route_url, browser_info, state_snapshot, created_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
            [
                crashId,
                userId || null,
                String(errorMessage || '').substring(0, 500),
                String(stackTrace   || '').substring(0, 2000),
                String(routeUrl     || '').substring(0, 500),
                JSON.stringify({
                    browserInfo, browserName, operatingSystem,
                    screenResolution, deviceType,
                    networkOnline, networkType,
                    appVersion, sessionDurationSeconds,
                }),
                JSON.stringify(fullCrashContext),
                crashTimestamp,
            ]
        );

        // ── STEP 2: Auto-create Ticket jika severity HIGH atau CRITICAL ───
        let ticketId = null;
        if (finalSeverity === 'HIGH' || finalSeverity === 'CRITICAL') {
            ticketId = `ticket-crash-${crypto.randomUUID()}`;

            const ticketTitle = `[${finalSeverity}] Auto-Crash: ${String(errorType || 'Error').substring(0, 50)} @ ${String(moduleName || routeUrl || 'Unknown').substring(0, 80)}`;

            const ticketDescription = [
                `═══════════════════════════════════════`,
                `🚨 CRASH AUTO-DETECTED BY SENTINEL SYSTEM`,
                `═══════════════════════════════════════`,
                ``,
                `📋 CRASH ID     : ${crashId}`,
                `⏰ WAKTU        : ${crashTimestamp.toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })} WIB`,
                `🎯 SEVERITY     : ${finalSeverity}`,
                ``,
                `── IDENTITAS USER ──────────────────────`,
                `👤 User ID      : ${userId || 'anonymous'}`,
                `👤 Username     : ${username || 'unknown'}`,
                ``,
                `── LOKASI KEJADIAN ─────────────────────`,
                `🔗 Route URL    : ${routeUrl || '-'}`,
                `📌 Menu         : ${menuName || '-'}`,
                `📦 Module       : ${moduleName || '-'}`,
                `⚙️  Component    : ${componentName || '-'}`,
                `🖱️  Aksi         : ${actionPerformed || '-'}`,
                `↩️  Previous Route: ${previousRoute || '-'}`,
                ``,
                `── DETAIL ERROR ─────────────────────────`,
                `❌ Error Type   : ${errorType || 'Unknown'}`,
                `❌ Error Msg    : ${String(errorMessage || '').substring(0, 500)}`,
                ``,
                `── KONTEKS API ──────────────────────────`,
                `📡 Last Endpoint: ${lastApiCall || '-'}`,
                `📊 Last Status  : ${lastApiStatusCode || '-'}`,
                ``,
                `── DEVICE & BROWSER ─────────────────────`,
                `🌐 Browser      : ${browserName || '-'}`,
                `💻 OS           : ${operatingSystem || '-'}`,
                `📱 Device Type  : ${deviceType || '-'}`,
                `🖥️  Resolution   : ${screenResolution || '-'}`,
                `📶 Network      : ${networkOnline ? 'Online' : '⚠️ OFFLINE'} (${networkType || 'unknown'})`,
                ``,
                `── STACK TRACE ──────────────────────────`,
                String(stackTrace || 'No stack trace available').substring(0, 2000),
                ``,
                `── LINK CRASH RECORD ────────────────────`,
                `Crash Record ID : ${crashId}`,
                `(Lihat di tabel client_telemetry untuk full state snapshot)`,
                ``,
                `═══════════════════════════════════════`,
                `Auto-generated by Sentinel v50.57 — DO NOT EDIT HEADER`,
            ].join('\n');

            await pool.query(
                `INSERT INTO tickets
                 (id, user_id, title, description, priority, status, source,
                  created_at, updated_at, metadata)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
                [
                    ticketId,
                    userId || 'system',
                    ticketTitle,
                    ticketDescription,
                    finalSeverity === 'CRITICAL' ? 'CRITICAL' : 'HIGH',
                    'OPEN',
                    'SENTINEL_AUTO_CRASH',
                    crashTimestamp,
                    crashTimestamp,
                    JSON.stringify({
                        crashId,
                        crashContext: fullCrashContext,
                        autoCreated: true,
                        sentinelVersion: 'v50.57',
                    }),
                ]
            );
        }

        // ── STEP 3: Broadcast realtime alert ke semua admin online ────────
        if (global.broadcastWS) {
            global.broadcastWS({
                type:    "ADMIN_ALERT",
                level:   finalSeverity === 'CRITICAL' ? "critical" : "error",
                message: [
                    `🚨 CRASH DETECTED [${finalSeverity}]`,
                    `User: ${username || userId || 'anonymous'}`,
                    `Where: ${menuName || routeUrl || 'Unknown'}`,
                    `Error: ${String(errorMessage || '').substring(0, 100)}`,
                    ticketId ? `→ Ticket dibuat: ${ticketId}` : '',
                ].filter(Boolean).join(' | '),
                crashId,
                ticketId,
                userId,
                severity: finalSeverity,
                timestamp: crashTimestamp.toISOString(),
            });
        }

        // ── STEP 4: Response ke frontend ──────────────────────────────────
        res.json({
            status:        "logged",
            crashId,
            ticketId,
            ticketCreated: !!ticketId,
            severity:      finalSeverity,
            message: ticketId
                ? `Crash dicatat dan tiket support otomatis dibuat (${ticketId}). Tim kami akan segera menindaklanjuti.`
                : `Crash dicatat (${crashId}). Tim kami akan mereview secara berkala.`,
        });

    } catch (e) {
        console.error("❌ [SENTINEL] Telemetry save failed:", e.message);
        // Return 200 agar frontend tidak crash lagi saat melaporkan crash
        res.json({
            status:  "failed_silently",
            crashId,
            message: "Crash berhasil dideteksi namun gagal disimpan ke server.",
        });
    }
});

// =============================================================================
// --- 6. ADMIN & DEVOPS SUITE ---
// =============================================================================
app.get("/api/admin/config/smtp", async (req, res) => {
    if (!(await verifyAdminOrRole(req))) return res.status(403).json({ error: 'Forbidden' });
    try {
        const r = await pool.query("SELECT value FROM global_configs WHERE key = 'smtp_config'");
        if (r.rowCount === 0) return res.json({ configured: false });
        const conf = r.rows[0].value;
        res.json({ configured: true, host: conf.host, port: conf.port, user: conf.user, senderName: conf.sender_name });
    } catch (e) { res.status(500).json({ error: "Fetch failed" }); }
});

app.post("/api/admin/config/smtp", async (req, res) => {
    if (!(await verifyAdminOrRole(req))) return res.status(403).json({ error: 'Forbidden' });
    const { host, port, user, password, senderName } = req.body;
    try {
        if (!host || !user || !password) return res.status(400).json({ error: "Missing parameters" });
        const encPass = encryptText(password);
        const payload = JSON.stringify({ host, port, user, sender_name: senderName || "Paydone", encrypted_password: encPass });
        await pool.query("INSERT INTO global_configs (key, value) VALUES ('smtp_config', $1) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value", [payload]);
        res.json({ success: true, message: "SMTP Server Configured Securely." });
    } catch (e) { res.status(500).json({ error: "Save failed" }); }
});

app.post("/api/admin/shell", async (req, res) => {
    if (!(await verifyAdminOrRole(req))) return res.status(403).json({ error: 'Forbidden' });
    exec(req.body.cmd, (error, stdout, stderr) => { res.json({ output: error ? stderr : stdout }); });
});

app.post("/api/admin/files/create", async (req, res) => {
    if (!(await verifyAdminOrRole(req))) return res.status(403).json({ error: 'Forbidden' });
    fs.writeFileSync(path.join(__dirname, path.basename(req.body.filename)), req.body.content);
    res.json({ status: "ok" });
});

// [V50.79 NEW] POST /api/admin/create-user
// Dedicated admin endpoint to create new users with proper password hashing.
// The generic createCrudEndpoints("users") does NOT hash passwords — this one does.
app.post("/api/admin/create-user", async (req, res) => {
    if (!(await verifyAdminOrRole(req))) return res.status(403).json({ error: 'Forbidden' });
    const { username, email, password, role } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email dan password wajib diisi.' });
    try {
        const existing = await pool.query("SELECT id FROM users WHERE email = $1", [email]);
        if (existing.rows.length > 0) return res.status(409).json({ error: `Email "${email}" sudah terdaftar.` });
        const newId = `usr-${crypto.randomUUID()}`;
        const hashed = hashPassword(password);
        const uname = username || email.split('@')[0];
        const r = await pool.query(
            `INSERT INTO users (id, username, email, password, role, status, updated_at)
             VALUES ($1, $2, $3, $4, $5, 'active', NOW()) RETURNING id, username, email, role, status`,
            [newId, uname, email, hashed, role || 'user']
        );
        res.json({ success: true, message: `User "${uname}" berhasil dibuat.`, data: r.rows[0] });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete("/api/admin/users/:id", async (req, res) => {
    if (!(await verifyAdminOrRole(req))) return res.status(403).json({ error: 'Forbidden' });
    const client = await pool.connect();
    try {
        await client.query("BEGIN"); const uid = req.params.id;
        const tables = ['daily_expenses','allocations','debts','incomes','sinking_funds','tasks','bank_accounts','subscriptions','debt_installments','payment_records','tickets','activity_logs','notifications'];
        for (let t of tables) await client.query(`DELETE FROM ${t} WHERE user_id=$1`, [uid]);
        await client.query("DELETE FROM users WHERE id=$1", [uid]);
        await client.query("COMMIT");
        if (global.broadcastWS) global.broadcastWS({ type: "FORCE_LOGOUT", userId: uid });
        res.json({ success: true, message: "User and all data deleted." });
    } catch(e) { await client.query("ROLLBACK"); res.status(500).json({ error: "Delete failed" }); } finally { client.release(); }
});

app.post("/api/admin/reset-user-data", async (req, res) => {
    if (!(await verifyAdminOrRole(req))) return res.status(403).json({ error: 'Forbidden' });
    const client = await pool.connect();
    try {
        await client.query("BEGIN"); const uid = req.body.targetUserId;
        const tables = ['daily_expenses','allocations','debts','incomes','sinking_funds','tasks','bank_accounts','debt_installments','payment_records','activity_logs'];
        for (let t of tables) await client.query(`DELETE FROM ${t} WHERE user_id=$1`, [uid]);
        await client.query("COMMIT");
        if (global.broadcastWS) global.broadcastWS({ type: "FORCE_SYNC", userId: uid });
        res.json({ success: true, message: "User data reset." });
    } catch(e) { await client.query("ROLLBACK"); res.status(500).json({ error: "Reset failed" }); } finally { client.release(); }
});

app.post("/api/admin/snapshots/create", async (req, res) => {
    if (!(await verifyAdminOrRole(req))) return res.status(403).json({ error: 'Forbidden' });
    try {
        ensureDirs(); // Guarantee BACKUP_DIR exists before writing
        const label = req.body.label ? req.body.label.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 30) : "";
        const fileName = `snapshot${label ? "_" + label : ""}_${Date.now()}.tar.gz`;
        const filePath = path.join(BACKUP_DIR, fileName);
        const tarCmd = `tar -czf "${filePath}" . --exclude='./node_modules' --exclude='./paydone_storage' --exclude='./.git' --exclude='./dist' 2>&1`;
        exec(tarCmd, { maxBuffer: 1024 * 1024 * 50 }, (err, stdout, stderr) => {
            if (err) {
                console.error("[Snapshot] tar error:", stderr || err.message);
                return res.status(500).json({ error: "Tar failed: " + (stderr || err.message).slice(0, 200) });
            }
            const sizeMB = fs.existsSync(filePath) ? (fs.statSync(filePath).size / 1024 / 1024).toFixed(2) : "?";
            res.json({ success: true, file: fileName, sizeMB });
        });
    } catch(e) { res.status(500).json({ error: "Snapshot failed: " + e.message }); }
});

app.post("/api/admin/snapshots/restore", async (req, res) => {
    if (!(await verifyAdminOrRole(req))) return res.status(403).json({ error: 'Forbidden' });
    const safeFilename = path.basename(req.body.filename);
    const filePath = path.join(BACKUP_DIR, safeFilename);
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: "Not found" });
    exec(`tar -xzf ${filePath} -C .`, (err) => {
        if (err) return res.status(500).json({ error: "Extract failed" });
        res.json({ success: true, message: "Restored. Restarting server..." });
        setTimeout(() => { exec("pm2 restart paydone-api"); }, 1000);
    });
});

app.get("/api/admin/snapshots", async (req, res) => {
    if (!(await verifyAdminOrRole(req))) return res.status(403).json({ error: 'Forbidden' });
    fs.readdir(BACKUP_DIR, (err, files) => {
        if (err) return res.json({ snapshots: [] });
        try {
            res.json({ status: "ok", snapshots: files.filter(f => f.endsWith(".tar.gz")).map(f => {
                const stat = fs.statSync(path.join(BACKUP_DIR, f));
                return { filename: f, size: (stat.size / 1024 / 1024).toFixed(2) + " MB", created: stat.birthtime };
            }).sort((a, b) => b.created - a.created) });
        } catch(e) { res.json({ status: "ok", snapshots: [] }); }
    });
});

app.get("/api/admin/stats", async (req, res) => {
    if (!(await verifyAdminOrRole(req))) return res.status(403).json({ error: 'Forbidden' });
    try {
        const users  = await pool.query("SELECT COUNT(*) FROM users");
        const subs   = await pool.query("SELECT SUM(amount_paid) as revenue FROM subscriptions WHERE status = 'active'");
        const debts  = await pool.query("SELECT SUM(remaining_principal) as total_debt FROM debts");
        const risky  = await pool.query("SELECT u.id FROM users u JOIN debts d ON u.id = d.user_id GROUP BY u.id HAVING SUM(d.monthly_payment) > 5000000");
        res.json({ totalUsers: Number(users.rows[0].count), totalRevenue: Number(subs.rows[0].revenue || 0), totalEcosystemDebt: Number(debts.rows[0].total_debt || 0), riskyAccounts: risky.rowCount });
    } catch(e) { res.status(500).json({ error: "Stats failed" }); }
});

app.post("/api/admin/kill-session", async (req, res) => {
    if (!(await verifyAdminOrRole(req))) return res.status(403).json({ error: 'Forbidden' });
    try {
        await pool.query("UPDATE users SET session_tokens = '[]'::jsonb, session_token = NULL WHERE id = $1", [req.body.targetUserId]);
        if (global.broadcastWS) global.broadcastWS({ type: "FORCE_LOGOUT", userId: req.body.targetUserId });
        res.json({ success: true });
    } catch(e) { res.status(500).json({ error: "Kill failed" }); }
});

app.post("/api/admin/deploy/start", async (req, res) => {
    if (!(await verifyAdminOrRole(req))) return res.status(403).json({ error: 'Forbidden' });
    try {
        await runCommand(`tar -czf ${path.join(BACKUP_DIR, `pre_deploy_${Date.now()}.tar.gz`)} --exclude=node_modules --exclude=.git --exclude=paydone_storage .`);
        await runCommand(`git fetch --all && git reset --hard origin/${(req.body.branch || "main").replace(/[^a-zA-Z0-9.-]/g, "")} && npm install`);
        res.json({ status: "success", message: "Deploy Complete." });
        setTimeout(() => { exec("pm2 restart paydone-api"); }, 1000);
    } catch (e) { res.status(500).json({ error: e.toString() }); }
});

app.get("/api/admin/versions", async (req, res) => {
    if (!(await verifyAdminOrRole(req))) return res.status(403).json({ error: 'Forbidden' });
    const versions = [];
    try {
        const currentContent = fs.readFileSync(__filename, "utf8");
        versions.push({ filename: "server.cjs (ACTIVE)", isActive: true, deepScan: analyzeFileFeatures(currentContent) });
    } catch(e) {}
    fs.readdir(VERSION_DIR, (err, files) => {
        if (!err) {
            files.filter(f => f.endsWith(".cjs")).forEach(file => {
                try {
                    const content = fs.readFileSync(path.join(VERSION_DIR, file), "utf8");
                    versions.push({ filename: file, isActive: false, deepScan: analyzeFileFeatures(content) });
                } catch(e) {}
            });
        }
        versions.sort((a, b) => { if (a.isActive) return -1; if (b.isActive) return 1; return (b.deepScan?.percentage || 0) - (a.deepScan?.percentage || 0); });
        res.json({ status: "ok", versions });
    });
});

app.post("/api/admin/versions/save", async (req, res) => {
    if (!(await verifyAdminOrRole(req))) return res.status(403).json({ error: 'Forbidden' });
    try {
        const targetName = req.body.label ? `server.${req.body.label.replace(/[^a-zA-Z0-9.-]/g, "")}.cjs` : `server.backup.${Date.now()}.cjs`;
        const targetPath = path.join(VERSION_DIR, targetName);
        if (req.body.content) fs.writeFileSync(targetPath, req.body.content); else fs.copyFileSync(__filename, targetPath);
        res.json({ status: "success", message: `Saved as ${targetName}` });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post("/api/admin/versions/restore", async (req, res) => {
    if (!(await verifyAdminOrRole(req))) return res.status(403).json({ error: 'Forbidden' });
    const targetFile = path.join(VERSION_DIR, req.body.filename);
    const currentFile = path.join(__dirname, "server.cjs");
    if (!fs.existsSync(targetFile)) return res.status(404).json({ error: "Not found" });
    try {
        if (fs.existsSync(currentFile)) fs.copyFileSync(currentFile, path.join(VERSION_DIR, `server.cjs.bak.${Date.now()}`));
        fs.copyFileSync(targetFile, currentFile);
        res.json({ status: "success", message: `Restored ${req.body.filename}. Restarting...` });
        setTimeout(() => { exec("pm2 restart paydone-api"); }, 1000);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post("/api/admin/versions/delete", async (req, res) => {
    if (!(await verifyAdminOrRole(req))) return res.status(403).json({ error: 'Forbidden' });
    const targetFile = path.join(VERSION_DIR, req.body.filename);
    if (!fs.existsSync(targetFile)) return res.status(404).json({ error: "File not found" });
    try { fs.unlinkSync(targetFile); res.json({ success: true }); } catch(e) { res.status(500).json({ error: e.message }); }
});

app.post("/api/admin/execute-sql", async (req, res) => {
    if (!(await verifyAdminOrRole(req))) return res.status(403).json({ error: 'Forbidden' });
    try { const r = await pool.query(req.body.sql || req.body.query); res.json({ success: true, rows: keysToCamel(r.rows) }); } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get("/api/admin/users", async (req, res) => {
    if (!(await verifyAdminOrRole(req))) return res.status(403).json({ error: 'Forbidden' });
    try { const r = await pool.query("SELECT id, username, email, role, status, last_login FROM users ORDER BY created_at DESC"); res.json(keysToCamel(r.rows)); } catch (e) { res.status(500).json({ error: e.message }); }
});

// [V50.62 NEW #1] GET /api/admin/server-time
// AdminDashboard.tsx calls this to show the backend server timestamp.
app.get("/api/admin/server-time", async (req, res) => {
    if (!(await verifyAdminOrRole(req))) return res.status(403).json({ error: 'Forbidden' });
    try {
        const dbTime = await pool.query("SELECT NOW() as server_time");
        res.json({
            serverTime: dbTime.rows[0].server_time,
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
            nodeVersion: process.version,
            memoryMB: Math.round(process.memoryUsage().rss / 1024 / 1024),
        });
    } catch (e) {
        // Even if DB fails, still return server time
        res.json({
            serverTime: new Date().toISOString(),
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
            nodeVersion: process.version,
            memoryMB: Math.round(process.memoryUsage().rss / 1024 / 1024),
        });
    }
});

// [V50.62 NEW #2] PUT /api/admin/users/:id/status
// UserManagement.tsx calls this to toggle user status (active/inactive/banned).
app.put("/api/admin/users/:id/status", async (req, res) => {
    if (!(await verifyAdminOrRole(req))) return res.status(403).json({ error: 'Forbidden' });
    const { id } = req.params;
    const { status } = req.body;
    const validStatuses = ['active', 'inactive', 'banned', 'pending_verification'];
    if (!validStatuses.includes(status)) {
        return res.status(400).json({ error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` });
    }
    try {
        await pool.query("UPDATE users SET status = $1, updated_at = NOW() WHERE id = $2", [status, id]);
        // If banning, also kill all sessions
        if (status === 'banned' || status === 'inactive') {
            await pool.query("UPDATE users SET session_token = NULL, session_tokens = '[]'::jsonb WHERE id = $1", [id]);
            if (global.broadcastWS) global.broadcastWS({ type: 'FORCE_LOGOUT', userId: id });
        }
        res.json({ success: true, message: `User status updated to ${status}` });
    } catch (e) { res.status(500).json({ error: e.message }); }
});
// [V50.68 FIX B4] PATCH alias — UserManagement.tsx sends PATCH but backend only had PUT
app.patch("/api/admin/users/:id/status", async (req, res) => {
    if (!(await verifyAdminOrRole(req))) return res.status(403).json({ error: 'Forbidden' });
    const { id } = req.params;
    const { status } = req.body;
    const validStatuses = ['active', 'inactive', 'banned', 'pending_verification'];
    if (!validStatuses.includes(status)) {
        return res.status(400).json({ error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` });
    }
    try {
        await pool.query("UPDATE users SET status = $1, updated_at = NOW() WHERE id = $2", [status, id]);
        if (status === 'banned' || status === 'inactive') {
            await pool.query("UPDATE users SET session_token = NULL, session_tokens = '[]'::jsonb WHERE id = $1", [id]);
            if (global.broadcastWS) global.broadcastWS({ type: 'FORCE_LOGOUT', userId: id });
        }
        res.json({ success: true, message: `User status updated to ${status}` });
    } catch (e) { res.status(500).json({ error: e.message }); }
});


// [V50.62 NEW #3] GET /api/admin/users/:id/financials
// UserManagement.tsx calls this to display financial summary of a user.
app.get("/api/admin/users/:id/financials", async (req, res) => {
    if (!(await verifyAdminOrRole(req))) return res.status(403).json({ error: 'Forbidden' });
    const { id } = req.params;
    try {
        const [debtsR, incomesR, expensesR, subsR] = await Promise.all([
            pool.query("SELECT COALESCE(SUM(total_liability), 0) as total_debt, COUNT(*) as debt_count FROM debts WHERE user_id = $1", [id]),
            pool.query("SELECT COALESCE(SUM(amount), 0) as total_income, COUNT(*) as income_count FROM incomes WHERE user_id = $1", [id]),
            pool.query("SELECT COALESCE(SUM(amount), 0) as total_expense, COUNT(*) as expense_count FROM daily_expenses WHERE user_id = $1", [id]),
            pool.query("SELECT s.status, s.amount_paid, s.start_date, s.end_date, p.name as package_name FROM subscriptions s JOIN packages p ON s.package_id = p.id WHERE s.user_id = $1 ORDER BY s.created_at DESC LIMIT 1", [id]),
        ]);
        res.json({
            totalDebt: Number(debtsR.rows[0].total_debt),
            debtCount: Number(debtsR.rows[0].debt_count),
            totalIncome: Number(incomesR.rows[0].total_income),
            incomeCount: Number(incomesR.rows[0].income_count),
            totalExpense: Number(expensesR.rows[0].total_expense),
            expenseCount: Number(expensesR.rows[0].expense_count),
            subscription: subsR.rows[0] ? keysToCamel(subsR.rows)[0] : null,
        });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/admin/raw-sample/:table', async (req, res) => {
    if (!(await verifyAdminOrRole(req))) return res.status(403).json({ error: 'Forbidden' });
    try {
        const allowed = ['users','debts','incomes','daily_expenses','debt_installments','payment_records','tasks','sinking_funds','allocations','ai_agents','config','qa_scenarios','qa_history','tickets','bank_accounts','banks','ba_configurations','activity_logs','packages','payment_methods','promos','subscriptions','contents','leads','notifications','email_campaigns','client_telemetry','global_configs','email_queues'];
        if (!allowed.includes(req.params.table)) return res.status(400).json({ error: "Invalid table" });
        const r = await pool.query(`SELECT * FROM ${req.params.table} LIMIT 1000`); res.json(keysToCamel(r.rows));
    } catch (e) { res.status(500).json({ error: e.message }); }
});

const diagnosticsHandler = async (req, res) => {
    try {
        const r = await pool.query("SELECT table_name, column_name, data_type FROM information_schema.columns WHERE table_schema='public'");
        const schema = {}; r.rows.forEach(x => { if (!schema[x.table_name]) schema[x.table_name] = []; schema[x.table_name].push({ columnName: x.column_name, dataType: x.data_type }); });
        const tablesQuery = await pool.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'");
        const counts = {};
        for (const t of tablesQuery.rows) { const c = await pool.query(`SELECT COUNT(*) FROM ${t.table_name}`); counts[t.table_name] = parseInt(c.rows[0].count); }
        res.json({ status: "ok", schema, tables: schema, counts });
    } catch (e) { res.status(500).json({ error: e.message }); }
};
app.get("/api/diagnostics", diagnosticsHandler);
app.get("/api/diagnostic",  diagnosticsHandler);

app.get("/api/admin/config", async (req, res) => {
    if (!(await verifyAdminOrRole(req))) return res.status(403).json({ error: 'Forbidden' });
    try { const r = await pool.query("SELECT data FROM config WHERE id = 'app_config' LIMIT 1"); res.json(r.rows[0]?.data || {}); } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post("/api/admin/config", async (req, res) => {
    if (!(await verifyAdminOrRole(req))) return res.status(403).json({ error: 'Forbidden' });
    try {
        if (req.body.config) { await pool.query("INSERT INTO config (id, data, updated_at) VALUES ('app_config', $1, NOW()) ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, updated_at = NOW()", [req.body.config]); }
        const r = await pool.query("SELECT data FROM config WHERE id = 'app_config' LIMIT 1"); res.json(r.rows[0]?.data || {});
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get("/api/view-source", async (req, res) => {
    if (!(await verifyAdminOrRole(req))) return res.status(403).send(`⛔ DENIED`);
    fs.readFile(__filename, "utf8", (err, data) => { res.send(data); });
});

app.get("/api/admin/source-code", async (req, res) => {
    if (!(await verifyAdminOrRole(req))) return res.status(403).send(`⛔ DENIED`);
    fs.readFile(__filename, "utf8", (err, data) => { res.send(data); });
});

// =============================================================================
// --- 7. SALES & CRM ENDPOINTS ---
// =============================================================================
app.get("/api/sales/users/idle", requireRole(['sales']), async (req, res) => {
    try {
        // [V50.78 FIX] parseInt() ensures thresholdDays is always a safe integer before SQL interpolation
        const rawDays = (await pool.query("SELECT data FROM config WHERE id = 'app_config'")).rows[0]?.data?.systemRules?.idleThresholdDays;
        const thresholdDays = parseInt(rawDays, 10) || 90;
        const r = await pool.query(`SELECT id, username, email, last_login FROM users WHERE status='active' AND last_login < NOW() - INTERVAL '${thresholdDays} days' ORDER BY last_login ASC`);
        res.json({ thresholdDays, idleUsers: keysToCamel(r.rows) });
    } catch(e) { res.status(500).json({ error: "Fetch failed" }); }
});

// [V50.57 FIX #2] email-blast sekarang INSERT ke email_campaigns untuk history
// V50.59: Juga menerima field 'body' sebagai fallback untuk htmlBody/bodyHtml
app.post("/api/sales/email-blast", requireRole(['sales']), async (req, res) => {
    const { subject, htmlBody, bodyHtml, body, target = 'all', targetAudience, scheduledAt } = req.body;
    const finalBody   = htmlBody || bodyHtml || body;  // V50.59: accept 'body' field
    const finalTarget = target || targetAudience || 'all';
    const authorId    = req.headers["x-user-id"];
    try {
        let query = "SELECT email FROM users WHERE status = 'active'";
        if (finalTarget === 'idle')  query = "SELECT email FROM users WHERE status = 'active' AND last_login < NOW() - INTERVAL '30 days'";
        if (finalTarget === 'leads') query = "SELECT email FROM leads";
        const users    = await pool.query(query);
        const sendTime = scheduledAt ? new Date(scheduledAt) : new Date();
        for (let u of users.rows) {
            await pool.query(
                "INSERT INTO email_queues (id, to_email, subject, body_html, scheduled_at) VALUES ($1, $2, $3, $4, $5)",
                [`q-${crypto.randomUUID()}`, u.email, subject, finalBody, sendTime]
            );
        }
        // Catat campaign record agar history blast tersimpan
        const campaignId = `camp-${crypto.randomUUID()}`;
        await pool.query(
            `INSERT INTO email_campaigns
             (id, author_id, subject, body_html, target_audience, total_sent, created_at)
             VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
            [campaignId, authorId, subject, finalBody, finalTarget, users.rowCount]
        );
        res.json({
            success: true,
            message: `${users.rowCount} email berhasil di-queue.`,
            campaignId,
            scheduledAt: sendTime.toISOString(),
        });
    } catch (e) { res.status(500).json({ error: "Queue failed" }); }
});

app.post("/api/sales/reactivate", requireRole(['sales']), async (req, res) => {
    const { promoCode, scheduledAt, promoId, customMessage, user_ids, userIds } = req.body;
    try {
        let finalPromoCode = promoCode;
        if (!finalPromoCode && promoId) {
            const pr = await pool.query("SELECT code FROM promos WHERE id=$1", [promoId]);
            if (pr.rows.length > 0) finalPromoCode = pr.rows[0].code;
        }
        const sendTime = scheduledAt ? new Date(scheduledAt) : new Date();

        // [V50.77 FIX #5] If specific user_ids are provided (e.g. from SalesReactivate bulk select),
        // only send to those users. Otherwise fallback to all idle users (original behavior).
        const targetIds = user_ids || userIds; // Frontend sends user_ids array
        let users;
        if (Array.isArray(targetIds) && targetIds.length > 0) {
            // Targeted: only send to selected users
            const placeholders = targetIds.map((_, idx) => `$${idx + 1}`).join(',');
            users = await pool.query(
                `SELECT email, username FROM users WHERE id IN (${placeholders}) AND status='active'`,
                targetIds
            );
        } else {
            // Fallback: all idle users
            // [V50.78 FIX] parseInt() ensures safe integer before SQL interpolation
            const rawDays2 = (await pool.query("SELECT data FROM config WHERE id = 'app_config'")).rows[0]?.data?.systemRules?.idleThresholdDays;
            const thresholdDays = parseInt(rawDays2, 10) || 90;
            users = await pool.query(`SELECT email, username FROM users WHERE status='active' AND last_login < NOW() - INTERVAL '${thresholdDays} days'`);
        }

        for (let u of users.rows) {
            const html = customMessage || `Halo ${u.username}, kami kangen! Yuk balik ke Paydone. Gunakan kode promo <b>${finalPromoCode}</b> untuk diskon spesial.`;
            await pool.query("INSERT INTO email_queues (id, to_email, subject, body_html, scheduled_at) VALUES ($1, $2, $3, $4, $5)", [`q-${crypto.randomUUID()}`, u.email, "Ada hadiah untukmu!", html, sendTime]);
        }
        res.json({ success: true, targeted: users.rowCount });
    } catch (e) { res.status(500).json({ error: "Reactivate failed" }); }
});

app.post("/api/sales/transactions/:id/approve", requireRole(['sales']), async (req, res) => {
    const { id } = req.params; const client = await pool.connect();
    try {
        await client.query("BEGIN");
        const sub = await client.query("SELECT * FROM subscriptions WHERE id = $1 AND status = 'verifying' FOR UPDATE", [id]);
        if (sub.rowCount === 0) throw new Error("Transaction not found or already processed");
        const userId = sub.rows[0].user_id;
        // [V50.81 FIX] Use client.query (not pool.query) inside the BEGIN transaction
        // so the SELECT runs on the same connection — pool.query would use a different
        // connection and bypass the transaction's FOR UPDATE lock.
        const activeSub = await client.query(`SELECT s.id, s.end_date, p.is_default_free FROM subscriptions s JOIN packages p ON s.package_id = p.id WHERE s.user_id = $1 AND s.status = 'active'`, [userId]);
        let extraDays = 0; const now = new Date();
        if (activeSub.rows.length > 0) {
            const oldSub = activeSub.rows[0];
            if (!oldSub.is_default_free) {
                const oldEndDate = new Date(oldSub.end_date);
                if (oldEndDate > now) extraDays = Math.floor((oldEndDate - now) / (1000 * 60 * 60 * 24));
            }
            await client.query("UPDATE subscriptions SET status = 'expired' WHERE id = $1", [oldSub.id]);
        }
        const newEndDate = new Date(); newEndDate.setMonth(newEndDate.getMonth() + 1);
        if (extraDays > 0) newEndDate.setDate(newEndDate.getDate() + extraDays);
        await client.query("UPDATE subscriptions SET status = 'active', start_date = NOW(), end_date = $1, updated_at = NOW() WHERE id = $2", [newEndDate, id]);
        await client.query("UPDATE users SET subscription_id = $1, ai_hits_used = 0 WHERE id = $2", [id, userId]);
        await client.query("COMMIT");
        if (global.broadcastWS) global.broadcastWS({ type: "FORCE_SYNC", userId });
        res.json({ success: true, message: `Approved. Active 30 days + ${extraDays} carry-over days.` });
    } catch(e) { await client.query("ROLLBACK"); res.status(500).json({ error: e.message }); } finally { client.release(); }
});

app.post("/api/sales/transactions/:id/reject", requireRole(['sales']), async (req, res) => {
    try { await pool.query("UPDATE subscriptions SET status = 'rejected', updated_at = NOW() WHERE id = $1 AND status = 'verifying'", [req.params.id]); res.json({ success: true }); } catch(e) { res.status(500).json({ error: "Reject failed" }); }
});

app.get("/api/sales/transactions", requireRole(['sales']), async (req, res) => {
    try {
        const r = await pool.query(`
            SELECT
                s.id,
                s.user_id,
                u.username,
                u.email,
                s.package_id,
                COALESCE(p.name, 'Paket Tidak Diketahui') as package_name,
                s.amount_paid,
                s.status,
                s.start_date,
                s.end_date,
                s.proof_of_payment,
                s.payment_gateway_ref,
                s.created_at,
                pm.bank_name as payment_bank
            FROM subscriptions s
            LEFT JOIN users u ON s.user_id = u.id
            LEFT JOIN packages p ON s.package_id = p.id
            LEFT JOIN payment_methods pm ON s.payment_method_id = pm.id
            ORDER BY s.created_at DESC
            LIMIT 200
        `);
        const rows = keysToCamel(r.rows);
        res.json({ subscriptions: rows, total: rows.length });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get("/api/packages", async (req, res) => {
    try { const r = await pool.query("SELECT * FROM packages WHERE is_active = TRUE ORDER BY price ASC"); res.json(keysToCamel(r.rows).map((pkg, i) => { pkg.features = typeof r.rows[i].features === 'string' ? JSON.parse(r.rows[i].features) : r.rows[i].features; return pkg; })); } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get("/api/sales/packages", requireRole(['sales']), async (req, res) => {
    try { const r = await pool.query("SELECT * FROM packages ORDER BY price ASC"); res.json(keysToCamel(r.rows).map((pkg, i) => { pkg.features = typeof r.rows[i].features === 'string' ? JSON.parse(r.rows[i].features) : r.rows[i].features; return pkg; })); } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post("/api/sales/packages", requireRole(['sales']), async (req, res) => {
    const { id, name, price, aiLimit, ai_limit, features, isDefaultFree, is_default_free, isActive, is_active, description, badgeColor, badge_color } = req.body;
    // [V50.78 FIX] Use dedicated client for transaction — pool.query("BEGIN") routes each call to a
    // different connection so BEGIN/COMMIT are never on the same connection. Atomicity was broken.
    const client = await pool.connect();
    try {
        await client.query("BEGIN");
        if (isDefaultFree || is_default_free) await client.query("UPDATE packages SET is_default_free = FALSE");
        const r = await client.query("INSERT INTO packages (id, name, price, ai_limit, features, is_default_free, is_active, description, badge_color) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name, price=EXCLUDED.price, ai_limit=EXCLUDED.ai_limit, features=EXCLUDED.features, is_default_free=EXCLUDED.is_default_free, is_active=EXCLUDED.is_active, description=EXCLUDED.description, badge_color=EXCLUDED.badge_color RETURNING *",
            [id || `pkg-${crypto.randomUUID()}`, name, price, aiLimit || ai_limit, features ? JSON.stringify(features) : '{}', isDefaultFree || is_default_free || false, isActive ?? is_active ?? true, description, badgeColor || badge_color]);
        await client.query("COMMIT");
        res.json({ success: true, data: keysToCamel(r.rows[0]) });
    } catch (e) { await client.query("ROLLBACK"); res.status(500).json({ error: e.message }); } finally { client.release(); }
});

// [V50.80 NEW] DELETE /api/sales/packages/:id — remove a package
app.delete("/api/sales/packages/:id", requireRole(['sales']), async (req, res) => {
    const { id } = req.params;
    try {
        // Safety: reject if package still has active subscriptions
        const subs = await pool.query(
            "SELECT COUNT(*) as cnt FROM subscriptions WHERE package_id=$1 AND status='active'", [id]
        );
        if (parseInt(subs.rows[0].cnt) > 0) {
            return res.status(409).json({ error: `Tidak bisa hapus: paket ini masih memiliki ${subs.rows[0].cnt} subscriber aktif.` });
        }
        const r = await pool.query("DELETE FROM packages WHERE id=$1 RETURNING id", [id]);
        if (r.rowCount === 0) return res.status(404).json({ error: "Package tidak ditemukan." });
        res.json({ success: true, message: "Package berhasil dihapus." });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get("/api/payment-methods", async (req, res) => {
    try { const r = await pool.query("SELECT * FROM payment_methods WHERE is_active = TRUE"); res.json(keysToCamel(r.rows)); } catch (e) { res.status(500).json({ error: e.message }); }
});

// [V50.64 NEW] GET /api/incomes - List user incomes (for direct fetch, fallback from sync)
app.get("/api/incomes", async (req, res) => {
    const userId = req.headers["x-user-id"];
    const token  = req.headers["x-session-token"];
    if (!(await verifySession(userId, token, res))) return res.status(401).json({ error: "Unauthorized" });
    try {
        const r = await pool.query("SELECT * FROM incomes WHERE user_id = $1 ORDER BY date_received DESC", [userId]);
        res.json(keysToCamel(r.rows));
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// [V50.64 NEW] GET /api/debts - List user debts (for direct fetch, fallback from sync)
app.get("/api/debts", async (req, res) => {
    const userId = req.headers["x-user-id"];
    const token  = req.headers["x-session-token"];
    if (!(await verifySession(userId, token, res))) return res.status(401).json({ error: "Unauthorized" });
    try {
        const r = await pool.query("SELECT * FROM debts WHERE user_id = $1 ORDER BY updated_at DESC", [userId]);
        const rows = keysToCamel(r.rows).map((d) => {
            if (typeof d.stepUpSchedule === "string") {
                try { d.stepUpSchedule = JSON.parse(d.stepUpSchedule); } catch(e) { d.stepUpSchedule = []; }
            }
            return d;
        });
        res.json(rows);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// [V50.64 NEW] GET /api/allocations - List user allocations
app.get("/api/allocations", async (req, res) => {
    const userId = req.headers["x-user-id"];
    const token  = req.headers["x-session-token"];
    if (!(await verifySession(userId, token, res))) return res.status(401).json({ error: "Unauthorized" });
    try {
        const r = await pool.query("SELECT * FROM allocations WHERE user_id = $1 ORDER BY updated_at DESC", [userId]);
        res.json(keysToCamel(r.rows));
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// [V50.64 NEW] GET /api/activity-logs - User activity logs (filtered by current user)
// [V50.71 FIX] GET /api/activity-logs — added unpackMetadata() so fields stored
// in JSONB metadata column (category, details, username, etc.) are returned correctly.
// Also added explicit POST route below to fix silent insert failures.
app.get("/api/activity-logs", async (req, res) => {
    const userId = req.headers["x-user-id"];
    const token  = req.headers["x-session-token"];
    if (!(await verifySession(userId, token, res))) return res.status(401).json({ error: "Unauthorized" });
    try {
        const r = await pool.query(
            "SELECT * FROM activity_logs WHERE user_id = $1 ORDER BY created_at DESC LIMIT 100",
            [userId]
        );
        // unpackMetadata spreads JSONB metadata back into row fields so
        // category, details, username, user_type, timestamp are all returned
        res.json(r.rows.map(row => keysToCamel(unpackMetadata(row))));
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// [V50.71 FIX] Dedicated POST /api/activity-logs endpoint.
// createCrudEndpoints registers a generic POST but drops fields not in the DB schema
// (category, details, username, user_type, timestamp) into metadata JSONB.
// This explicit route maps frontend field names correctly to DB columns and metadata.
app.post("/api/activity-logs", async (req, res) => {
    const userId = req.headers["x-user-id"];
    const token  = req.headers["x-session-token"];
    if (!(await verifySession(userId, token, res))) return res.status(401).json({ error: "Unauthorized" });
    try {
        const b = req.body || {};
        const id = b.id || `activity_logs-${crypto.randomUUID()}`;
        const action = b.action || b.eventName || "Unknown";
        // 'details' from frontend maps to 'description' column in DB
        const description = b.details || b.description || "";
        const status = b.status || "info";
        // Fields not in schema → store in metadata for unpackMetadata() to retrieve
        const metadata = {
            category: b.category || "System",
            username: b.username || userId,
            user_type: b.userType || b.user_type || "user",
            // Store original timestamp if provided
            timestamp: b.timestamp || new Date().toISOString(),
            ...(b.payload !== undefined && b.payload !== null ? { payload: b.payload } : {}),
            ...(b.response !== undefined && b.response !== null ? { response: b.response } : {})
        };
        const payloadJson = (b.payload !== undefined && b.payload !== null)
            ? JSON.stringify(b.payload) : null;
        const responseJson = (b.response !== undefined && b.response !== null)
            ? JSON.stringify(b.response) : null;

        await pool.query(
            `INSERT INTO activity_logs (id, user_id, action, description, payload, response, status, metadata, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
             ON CONFLICT (id) DO NOTHING`,
            [id, userId, action, description, payloadJson, responseJson, status, JSON.stringify(metadata)]
        );
        res.json({ success: true });
    } catch (e) {
        console.error("[activity-logs POST] Error:", e.message);
        res.status(500).json({ error: e.message });
    }
});

// [V50.61 NEW #1] GET /api/sales/payment-methods
// SalesPaymentMethods.tsx calls GET /sales/payment-methods to load the list.
// Previously only POST existed. Now GET is added for sales role.
app.get("/api/sales/payment-methods", requireRole(['sales']), async (req, res) => {
    try { const r = await pool.query("SELECT * FROM payment_methods ORDER BY updated_at DESC"); res.json(keysToCamel(r.rows)); } catch (e) { res.status(500).json({ error: e.message }); }
});

// [V50.61 NEW] DELETE /api/sales/payment-methods/:id
app.delete("/api/sales/payment-methods/:id", requireRole(['sales']), async (req, res) => {
    try { await pool.query("DELETE FROM payment_methods WHERE id = $1", [req.params.id]); res.json({ success: true }); } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post("/api/sales/payment-methods", requireRole(['sales']), async (req, res) => {
    // [V50.61] Also accept snake_case fields and store logoUrl/logo_url
    const b = req.body;
    const bankName     = b.bankName     ?? b.bank_name     ?? '';
    const accountNumber = b.accountNumber ?? b.account_number ?? '';
    const accountName  = b.accountName  ?? b.account_name  ?? '';
    const isActive     = b.isActive     ?? b.is_active     ?? true;
    const logoUrl      = b.logoUrl      ?? b.logo_url      ?? '';
    try {
        const r = await pool.query(
            "INSERT INTO payment_methods (id, bank_name, account_number, account_name, is_active, logo_url) VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (id) DO UPDATE SET bank_name=EXCLUDED.bank_name, account_number=EXCLUDED.account_number, account_name=EXCLUDED.account_name, is_active=EXCLUDED.is_active, logo_url=EXCLUDED.logo_url RETURNING *",
            [b.id || `pm-${crypto.randomUUID()}`, bankName, accountNumber, accountName, isActive, logoUrl]
        );
        res.json({ success: true, data: keysToCamel(r.rows[0]) });
    } catch (e) {
        // Fallback: logo_url column might not exist yet, retry without it
        try {
            const r2 = await pool.query(
                "INSERT INTO payment_methods (id, bank_name, account_number, account_name, is_active) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (id) DO UPDATE SET bank_name=EXCLUDED.bank_name, account_number=EXCLUDED.account_number, account_name=EXCLUDED.account_name, is_active=EXCLUDED.is_active RETURNING *",
                [b.id || `pm-${crypto.randomUUID()}`, bankName, accountNumber, accountName, isActive]
            );
            res.json({ success: true, data: keysToCamel(r2.rows[0]) });
        } catch (e2) { res.status(500).json({ error: e2.message }); }
    }
});

app.get("/api/sales/promos", requireRole(['sales']), async (req, res) => {
    // V50.59: Return raw snake_case rows — Promo type di types.ts pakai snake_case
    // (discount_percentage, discount_nominal, valid_until, target_user_id, image_url)
    try { const r = await pool.query("SELECT * FROM promos ORDER BY updated_at DESC"); res.json(r.rows); } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post("/api/sales/promos", requireRole(['sales']), async (req, res) => {
    // V50.59: Accept both camelCase (legacy) AND snake_case (frontend sends snake_case)
    const b = req.body;
    const id             = b.id;
    const code           = b.code;
    const description    = b.description;
    const discountPercentage = b.discountPercentage ?? b.discount_percentage ?? 0;
    const discountNominal    = b.discountNominal    ?? b.discount_nominal    ?? 0;
    const quota          = b.quota ?? 0;
    const validUntil     = b.validUntil     ?? b.valid_until;
    const targetUserId   = b.targetUserId   ?? b.target_user_id;
    const isActive       = b.isActive       ?? b.is_active ?? true;
    const imageUrl       = b.imageUrl       ?? b.image_url;
    try {
        await pool.query("INSERT INTO promos (id, code, description, discount_percentage, discount_nominal, quota, valid_until, target_user_id, is_active, image_url) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) ON CONFLICT (id) DO UPDATE SET code=EXCLUDED.code, discount_percentage=EXCLUDED.discount_percentage, discount_nominal=EXCLUDED.discount_nominal, quota=EXCLUDED.quota, valid_until=EXCLUDED.valid_until, target_user_id=EXCLUDED.target_user_id, is_active=EXCLUDED.is_active, image_url=EXCLUDED.image_url, description=EXCLUDED.description",
            [id || `promo-${crypto.randomUUID()}`, code, description, discountPercentage, discountNominal, quota, validUntil, targetUserId, isActive, imageUrl]);
        res.json({ success: true });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

// [V50.80 NEW] DELETE /api/sales/promos/:id — remove a promo
app.delete("/api/sales/promos/:id", requireRole(['sales']), async (req, res) => {
    const { id } = req.params;
    try {
        const r = await pool.query("DELETE FROM promos WHERE id=$1 RETURNING id", [id]);
        if (r.rowCount === 0) return res.status(404).json({ error: "Promo tidak ditemukan." });
        res.json({ success: true, message: "Promo berhasil dihapus." });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get("/api/sales/contents", requireRole(['sales']), async (req, res) => {
    try { const r = await pool.query("SELECT * FROM contents ORDER BY updated_at DESC"); res.json(keysToCamel(r.rows)); } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post("/api/sales/contents", requireRole(['sales']), async (req, res) => {
    const { id, title, slug, bodyHtml, thumbnailUrl, status, contentType, mediaUrl } = req.body; const authorId = req.headers["x-user-id"];
    try {
        const finalUrl = await saveBase64ToFileAsync(thumbnailUrl);
        await pool.query("INSERT INTO contents (id, author_id, title, slug, body_html, thumbnail_url, status, content_type, media_url, published_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) ON CONFLICT (id) DO UPDATE SET title=EXCLUDED.title, slug=EXCLUDED.slug, body_html=EXCLUDED.body_html, thumbnail_url=EXCLUDED.thumbnail_url, status=EXCLUDED.status, content_type=EXCLUDED.content_type, media_url=EXCLUDED.media_url, published_at=COALESCE(contents.published_at, EXCLUDED.published_at)",
            [id || `content-${crypto.randomUUID()}`, authorId, title, slug, bodyHtml, finalUrl, status || 'draft', contentType || 'article', mediaUrl, status === 'published' ? new Date() : null]);
        res.json({ success: true });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

app.delete("/api/sales/contents/:id", requireRole(['sales']), async (req, res) => {
    try { await pool.query("DELETE FROM contents WHERE id = $1", [req.params.id]); res.json({ success: true }); } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get("/api/contents", async (req, res) => {
    try { const r = await pool.query("SELECT * FROM contents WHERE status = 'published' ORDER BY published_at DESC"); res.json(keysToCamel(r.rows)); } catch (e) { res.status(500).json({ error: e.message }); }
});

// [V50.60 NEW #2] GET /api/public/content — ALIAS ke /api/contents
// [V50.61] Also returns category field and body/image_url aliases for BlogPage.tsx compatibility
app.get("/api/public/content", async (req, res) => {
    try {
        const r = await pool.query("SELECT * FROM contents WHERE status = 'published' ORDER BY published_at DESC");
        const rows = r.rows.map(row => ({
            ...row,
            // Computed aliases for frontend BlogPost interface compatibility
            body: row.body_html || '',
            image_url: row.thumbnail_url || '',
            is_published: true,
            content_type: row.content_type || 'article',
            media_url: row.media_url || '',
            category: row.category || '',
            created_at: row.created_at,
        }));
        res.json(rows);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post("/api/leads", async (req, res) => {
    try { await pool.query("INSERT INTO leads (id, name, email, source) VALUES ($1, $2, $3, $4) ON CONFLICT (email) DO NOTHING", [`lead-${crypto.randomUUID()}`, req.body.name, req.body.email, req.body.source || 'website']); res.json({ success: true }); } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get("/api/sales/leads", requireRole(['sales']), async (req, res) => {
    try { const r = await pool.query("SELECT * FROM leads ORDER BY created_at DESC"); res.json(keysToCamel(r.rows)); } catch (e) { res.status(500).json({ error: e.message }); }
});

// [V50.57 IMPROVEMENT #5] Tambah ai_hits_used + subscription_status untuk Sales
app.get("/api/sales/users", requireRole(['sales']), async (req, res) => {
    try {
        const r = await pool.query(`
            SELECT
                u.id,
                u.username,
                u.email,
                u.status,
                u.role,
                u.last_login,
                u.ai_hits_used,
                u.created_at,
                p.name   AS package_name,
                s.end_date,
                s.status AS subscription_status
            FROM users u
            LEFT JOIN subscriptions s ON u.subscription_id = s.id
            LEFT JOIN packages p      ON s.package_id = p.id
            ORDER BY u.created_at DESC
        `);
        res.json(keysToCamel(r.rows));
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put("/api/sales/users/:id/status", requireRole(['sales']), async (req, res) => {
    try {
        await pool.query("UPDATE users SET status = COALESCE($1, status), role = COALESCE($2, role) WHERE id = $3", [req.body.status, req.body.role, req.params.id]);
        if (req.body.status === 'banned') {
            await pool.query("UPDATE users SET session_tokens = '[]'::jsonb, session_token = NULL WHERE id = $1", [req.params.id]);
            if (global.broadcastWS) global.broadcastWS({ type: "FORCE_LOGOUT", userId: req.params.id });
        }
        res.json({ success: true, message: "User status updated." });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post("/api/sales/users/:id/manual-sub", requireRole(['sales']), async (req, res) => {
    const userId = req.params.id;
    // [V50.78 FIX] Use dedicated client for transaction — pool.query("BEGIN") routes each call to a
    // different connection so BEGIN/COMMIT are never on the same connection. Atomicity was broken.
    const client = await pool.connect();
    try {
        await client.query("BEGIN");
        const subId = `sub-${crypto.randomUUID()}`;
        const endDate = new Date();
        endDate.setMonth(endDate.getMonth() + (req.body.months || 1));

        // [V50.66 FIX #3] Fallback packageId when frontend does not send one.
        // SalesUsers.tsx only sends { months } without packageId.
        // Attempt: first active non-free (paid) package, then default free, then hard-coded sentinel.
        let pkgId = req.body.packageId || req.body.package_id;
        if (!pkgId) {
            const paidPkg = await client.query(
                "SELECT id FROM packages WHERE is_active = TRUE AND (is_default_free = FALSE OR is_default_free IS NULL) ORDER BY price DESC LIMIT 1"
            );
            if (paidPkg.rowCount > 0) {
                pkgId = paidPkg.rows[0].id;
            } else {
                const freePkg = await client.query("SELECT id FROM packages WHERE is_default_free = TRUE LIMIT 1");
                pkgId = freePkg.rows[0]?.id || 'pkg-default';
            }
        }

        await client.query("UPDATE subscriptions SET status = 'expired' WHERE user_id = $1 AND status = 'active'", [userId]);
        await client.query("INSERT INTO subscriptions (id, user_id, package_id, status, start_date, end_date, amount_paid, payment_gateway_ref) VALUES ($1, $2, $3, 'active', NOW(), $4, 0, 'MANUAL_OVERRIDE')", [subId, userId, pkgId, endDate]);
        await client.query("UPDATE users SET subscription_id = $1, ai_hits_used = 0 WHERE id = $2", [subId, userId]);
        await client.query("COMMIT");
        if (global.broadcastWS) global.broadcastWS({ type: "FORCE_SYNC", userId });
        res.json({ success: true, message: `Package manually assigned for ${req.body.months} months.` });
    } catch (e) { await client.query("ROLLBACK"); res.status(500).json({ error: e.message }); } finally { client.release(); }
});

app.post("/api/sales/settings/idle-threshold", requireRole(['sales']), async (req, res) => {
    try {
        // V50.59: Accept both 'idleThresholdDays' (original) and 'threshold' (frontend sends)
        const days = Number(req.body.idleThresholdDays ?? req.body.threshold ?? 30);
        const confRes = await pool.query("SELECT data FROM config WHERE id = 'app_config'"); let configData = confRes.rows[0]?.data || {};
        if (!configData.systemRules) configData.systemRules = {}; configData.systemRules.idleThresholdDays = days;
        await pool.query("UPDATE config SET data = $1, updated_at = NOW() WHERE id = 'app_config'", [configData]);
        res.json({ success: true, message: "Idle threshold updated", idleThresholdDays: configData.systemRules.idleThresholdDays });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get("/api/sales/settings/grace-period", requireRole(['sales']), async (req, res) => {
    try { const r = await pool.query("SELECT data FROM config WHERE id = 'app_config'"); res.json({ gracePeriodDays: r.rows[0]?.data?.systemRules?.gracePeriodDays || 0 }); } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post("/api/sales/settings/grace-period", requireRole(['sales']), async (req, res) => {
    try {
        const confRes = await pool.query("SELECT data FROM config WHERE id = 'app_config'"); let configData = confRes.rows[0]?.data || {};
        if (!configData.systemRules) configData.systemRules = {}; configData.systemRules.gracePeriodDays = Number(req.body.gracePeriodDays);
        await pool.query("UPDATE config SET data = $1, updated_at = NOW() WHERE id = 'app_config'", [configData]);
        res.json({ success: true, message: "Grace period updated" });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post("/api/tickets/report", async (req, res) => {
    try {
        await pool.query(`INSERT INTO tickets (id, user_id, title, description, priority, status, source) VALUES ($1, $2, $3, $4, 'HIGH', 'OPEN', 'SYSTEM_WATCHDOG')`,
            [`anomaly-${Date.now()}`, req.body.userId || "unknown", `Sync Failure: ${req.body.action}`, `Error: ${req.body.errorMsg}`]);
        res.json({ status: "ok" });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put("/api/notifications/:id/read", async (req, res) => {
    // [BUG FIX] Added auth check — previously anyone could mark any notification as read without auth
    const userId = req.headers["x-user-id"];
    const token  = req.headers["x-session-token"];
    if (!(await verifySession(userId, token, res))) return res.status(401).json({ error: "Unauthorized" });
    try {
        // Only update if this notification belongs to the authenticated user (prevents IDOR)
        await pool.query("UPDATE notifications SET is_read = TRUE WHERE id = $1 AND (user_id = $2 OR user_id IS NULL)", [req.params.id, userId]);
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// =============================================================================
// --- 8. UNIVERSAL CRUD ENGINE ---
// =============================================================================
const createCrudEndpoints = (tableName, routePath, featureKey = null) => {
    const mws = []; if (featureKey) mws.push(checkFeatureAccess(featureKey));

    app.post(`/api/${routePath}`, ...mws, async (req, res) => {
        try {
            const data = sanitizeKeys(keysToSnake(req.body)); let userId = null;
            if (!routePath.includes("admin")) {
                userId = req.headers["x-user-id"];
                if (!(await verifySession(userId, req.headers["x-session-token"], res))) return res.status(401).json({ error: "Unauthorized" });
                data.user_id = userId;
            }
            if (!data.id) data.id = `${routePath.replace(/[-\/]/g, "_")}-${crypto.randomUUID()}`;
            data.updated_at = new Date();
            for (const k of Object.keys(data)) {
                if (typeof data[k] === 'string' && data[k].startsWith('data:image')) data[k] = await saveBase64ToFileAsync(data[k]);
            }
            const validCols = await getValidColumns(tableName);
            const finalData = {}; const extraData = {};
            Object.keys(data).forEach(k => {
                if (validCols.includes(k)) finalData[k] = (typeof data[k] === 'object' && data[k] !== null) ? JSON.stringify(data[k]) : data[k];
                else extraData[k] = data[k];
            });
            if (Object.keys(extraData).length > 0) finalData.metadata = JSON.stringify(extraData);
            const keys = Object.keys(finalData); const values = Object.values(finalData);
            const placeholders = keys.map((_, i) => `$${i + 1}`).join(", ");
            const result = await pool.query(`INSERT INTO ${tableName} (${keys.join(", ")}) VALUES (${placeholders}) RETURNING *`, values);
            if (global.broadcastWS) global.broadcastWS({ type: "CRUD_UPDATE", table: tableName, action: "INSERT", id: data.id, userId, timestamp: new Date() });
            res.json({ success: true, message: "Created", data: keysToCamel(unpackMetadata(result.rows[0])) });
        } catch (e) { console.error('[CRUD POST]', tableName, e.message); res.status(500).json({ error: e.message || "Processing Error" }); }
    });

    app.put(`/api/${routePath}/:id`, ...mws, async (req, res) => {
        try {
            const { id } = req.params; const data = sanitizeKeys(keysToSnake(req.body));
            delete data.id; delete data.user_id; delete data.created_at; data.updated_at = new Date();
            let reqUserId = null;
            if (!routePath.includes("admin")) {
                reqUserId = req.headers["x-user-id"];
                if (!(await verifySession(reqUserId, req.headers["x-session-token"], res))) return res.status(401).json({ error: "Unauthorized" });
            }
            if (data.receipt_image && data.receipt_image.startsWith('data:image')) {
                const old = await pool.query(`SELECT receipt_image FROM ${tableName} WHERE id=$1`, [id]);
                if (old.rows.length > 0) await deleteFileIfLocal(old.rows[0].receipt_image);
            }
            for (const k of Object.keys(data)) {
                if (typeof data[k] === 'string' && data[k].startsWith('data:image')) data[k] = await saveBase64ToFileAsync(data[k]);
            }
            const validCols = await getValidColumns(tableName);
            const finalData = {}; const extraData = {};
            Object.keys(data).forEach(k => {
                if (validCols.includes(k)) finalData[k] = (typeof data[k] === 'object' && data[k] !== null) ? JSON.stringify(data[k]) : data[k];
                else extraData[k] = data[k];
            });
            if (Object.keys(extraData).length > 0) {
                const oldRow = await pool.query(`SELECT metadata FROM ${tableName} WHERE id=$1`, [id]);
                finalData.metadata = JSON.stringify({ ...(oldRow.rows[0]?.metadata || {}), ...extraData });
            }
            const keys = Object.keys(finalData); if (keys.length === 0) return res.status(400).json({ error: "No fields to update" });
            const setClause = keys.map((key, i) => `${key} = $${i + 1}`).join(", "); const values = Object.values(finalData);
            const query = routePath.includes("admin")
                ? `UPDATE ${tableName} SET ${setClause} WHERE id = $${keys.length + 1} RETURNING *`
                : `UPDATE ${tableName} SET ${setClause} WHERE id = $${keys.length + 1} AND user_id = $${keys.length + 2} RETURNING *`;
            const result = await pool.query(query, routePath.includes("admin") ? [...values, id] : [...values, id, reqUserId]);
            if (result.rowCount === 0) return res.status(404).json({ error: "Not found" });
            if (global.broadcastWS) global.broadcastWS({ type: "CRUD_UPDATE", table: tableName, action: "UPDATE", id, userId: reqUserId, timestamp: new Date() });
            res.json({ success: true, message: "Updated", data: keysToCamel(unpackMetadata(result.rows[0])) });
        } catch (e) { console.error('[CRUD PUT]', tableName, e.message); res.status(500).json({ error: e.message || "Update Error" }); }
    });

    app.delete(`/api/${routePath}/:id`, ...mws, async (req, res) => {
        const { id } = req.params; const client = await pool.connect();
        try {
            await client.query('BEGIN'); let reqUserId = null; let baseParams = [id]; let userCheck = "";
            if (!routePath.includes("admin")) {
                reqUserId = req.headers["x-user-id"];
                if (!(await verifySession(reqUserId, req.headers["x-session-token"], res))) { await client.query('ROLLBACK'); client.release(); return res.status(401).json({ error: "Unauthorized" }); }
                userCheck = " AND user_id = $2"; baseParams.push(reqUserId);
            }
            if (['daily_expenses','subscriptions','contents'].includes(tableName)) {
                const fCheck = await client.query(`SELECT * FROM ${tableName} WHERE id=$1 ${userCheck}`, baseParams);
                if (fCheck.rows.length > 0) {
                    await deleteFileIfLocal(fCheck.rows[0].receipt_image);
                    await deleteFileIfLocal(fCheck.rows[0].proof_of_payment);
                    await deleteFileIfLocal(fCheck.rows[0].thumbnail_url);
                }
            }
            if (tableName === 'debts') {
                await client.query(`DELETE FROM debt_installments WHERE debt_id = $1${userCheck}`, baseParams);
                await client.query(`DELETE FROM payment_records WHERE debt_id = $1${userCheck}`, baseParams);
            } else if (tableName === 'allocations') {
                await client.query(`UPDATE daily_expenses SET allocation_id = NULL WHERE allocation_id = $1${userCheck}`, baseParams);
            } else if (tableName === 'sinking_funds') {
                await client.query(`UPDATE daily_expenses SET sinking_fund_id = NULL WHERE sinking_fund_id = $1${userCheck}`, baseParams);
            }
            const result = await client.query(`DELETE FROM ${tableName} WHERE id = $1${userCheck}`, baseParams);
            if (result.rowCount === 0 && !routePath.includes("admin")) throw new Error("Not found");
            await client.query('COMMIT');
            if (global.broadcastWS) global.broadcastWS({ type: "CRUD_UPDATE", table: tableName, action: "DELETE", id, userId: reqUserId });
            res.json({ success: true });
        } catch (e) { await client.query('ROLLBACK'); console.error('[CRUD DELETE]', tableName, e.message); res.status(500).json({ error: e.message || "Delete Error" }); } finally { client.release(); }
    });
};

createCrudEndpoints("debts",            "debts",               "debt_management");
createCrudEndpoints("incomes",          "incomes",             "income_tracker");
createCrudEndpoints("daily_expenses",   "daily-expenses",      "daily_expense");
createCrudEndpoints("allocations",      "allocations",         "pos_budget");
createCrudEndpoints("tasks",            "tasks",               "tasks_calendar");
createCrudEndpoints("sinking_funds",    "sinking-funds",       "sinking_fund");
createCrudEndpoints("bank_accounts",    "bank-accounts",       "bank_accounts");
// NOTE: activity-logs POST is explicitly defined above (with proper metadata mapping).
// createCrudEndpoints only adds PUT + DELETE for activity-logs; skip POST to avoid conflict.
// We achieve this by registering after the explicit POST so Express uses first-match routing.
createCrudEndpoints("activity_logs",    "activity-logs");
createCrudEndpoints("debt_installments","debt-installments",   "debt_management");
createCrudEndpoints("payment_records",  "payment-records",     "debt_management");
createCrudEndpoints("tickets",          "tickets");
createCrudEndpoints("qa_scenarios",     "qa-scenarios");
createCrudEndpoints("banks",            "admin/banks");
createCrudEndpoints("ba_configurations","admin/ba-configurations");
createCrudEndpoints("users",            "admin/users-crud");
createCrudEndpoints("ai_agents",        "admin/ai-agents");

// =============================================================================
// --- 9. AUTHENTICATION ---
// =============================================================================
app.post("/api/auth/google", async (req, res) => {
    const { user: userData, packageId } = req.body;
    const email = userData?.email; const name = userData?.displayName || userData?.name;
    const photo = userData?.photoURL || userData?.picture; const googleUid = userData?.uid || userData?.sub;
    try {
        if (!email) return res.status(400).json({ error: "Email missing" });
        let dbUser = await pool.query("SELECT * FROM users WHERE email = $1", [email]);
        let isNewUser = false;
        if (dbUser.rows.length === 0) {
            isNewUser = true; const newId = googleUid || "g_" + crypto.randomUUID();
            await pool.query("INSERT INTO users (id,username,email,photo_url,role,status) VALUES ($1,$2,$3,$4,'user','active')", [newId, name, email, photo]);
            await assignDefaultFreePackage(newId, packageId);
        } else { await pool.query("UPDATE users SET photo_url = COALESCE($1, photo_url) WHERE email = $2", [photo, email]); }
        const finalUserRes = await pool.query("SELECT * FROM users WHERE email = $1", [email]);
        const token = crypto.randomUUID();
        await appendSessionToken(finalUserRes.rows[0].id, token);
        await pool.query("UPDATE users SET last_login=NOW() WHERE id=$1", [finalUserRes.rows[0].id]);
        res.json({ message: "Success", user: { ...toHybridUser(finalUserRes.rows[0]), sessionToken: token }, isNewUser });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post("/api/auth/login", authRateLimiter, async (req, res) => {
    const { email, password } = req.body;
    try {
        const userRes = await pool.query("SELECT * FROM users WHERE email = $1 OR username = $1", [email]);
        if (userRes.rows.length === 0) return res.status(401).json({ error: "Invalid credentials" });
        const user = userRes.rows[0];
        if (user.status === 'pending_verification') return res.status(403).json({ error: "Cek email untuk aktivasi akun." });
        if (user.status === 'banned') return res.status(403).json({ error: "Akun Anda diblokir." });
        let passwordValid = false;
        if (user.password && user.password.includes(':')) {
            passwordValid = hashPassword(password, user.password);
        } else if (user.password === password || user.password === crypto.createHash('sha256').update(password).digest('hex')) {
            passwordValid = true;
            await pool.query("UPDATE users SET password = $1 WHERE id = $2", [hashPassword(password), user.id]);
        }
        if (!passwordValid) return res.status(401).json({ error: "Invalid credentials" });
        const newToken = crypto.randomUUID();
        await appendSessionToken(user.id, newToken);
        await pool.query("UPDATE users SET last_login = NOW() WHERE id = $1", [user.id]);
        res.json({ message: "Login Success", user: { ...toHybridUser(user), sessionToken: newToken } });
    } catch (e) { res.status(500).json({ error: "Login Error" }); }
});

// [V50.57 FIX #3] Signup dengan fallback: jika SMTP belum configured, user langsung aktif
app.post("/api/auth/signup", authRateLimiter, async (req, res) => {
    const { email, password, username, packageId } = req.body;
    try {
        if (!email || !password) return res.status(400).json({ error: "Email dan password wajib diisi." });
        const existing = await pool.query("SELECT id FROM users WHERE email = $1", [email]);
        if (existing.rows.length > 0) return res.status(400).json({ error: "Email sudah terdaftar." });
        const newId = "u_" + crypto.randomUUID();
        const lang  = req.headers['accept-language']?.split(',')[0] || 'id';

        // Cek apakah SMTP sudah dikonfigurasi di DB
        let smtpConfigured = false;
        try {
            const smtpCheck = await pool.query("SELECT value FROM global_configs WHERE key = 'smtp_config'");
            smtpConfigured = smtpCheck.rowCount > 0 && !!smtpCheck.rows[0].value?.host;
        } catch (e) { smtpConfigured = false; }

        if (smtpConfigured) {
            // FLOW A: SMTP aktif → kirim email verifikasi
            const verifyToken = crypto.randomBytes(32).toString('hex');
            await pool.query(
                `INSERT INTO users (id,username,email,password,role,status,preferred_language,verification_token)
                 VALUES ($1,$2,$3,$4,'user','pending_verification',$5,$6)`,
                [newId, username || email.split('@')[0], email, hashPassword(password), lang, verifyToken]
            );
            await assignDefaultFreePackage(newId, packageId);
            const appUrl = await getAppUrlFromDB();
            const verifyLink = `${appUrl}/verify-email?token=${verifyToken}`;
            const htmlBody = `
                <div style="font-family:Arial,sans-serif;padding:20px;max-width:500px;">
                    <h2 style="color:#2563eb;">Selamat datang di Paydone! 🎉</h2>
                    <p>Halo <strong>${username || email.split('@')[0]}</strong>,</p>
                    <p>Terima kasih sudah mendaftar. Klik tombol di bawah untuk mengaktifkan akun Anda:</p>
                    <a href="${verifyLink}"
                       style="background-color:#2563eb;color:white;padding:12px 24px;
                              text-decoration:none;border-radius:6px;display:inline-block;margin:16px 0;">
                        ✅ Aktivasi Akun Saya
                    </a>
                    <p style="color:#888;font-size:12px;margin-top:20px;">
                        Link ini berlaku 24 jam. Jika Anda tidak mendaftar, abaikan email ini.
                    </p>
                </div>`;
            await sendEmailEngine(email, "Konfirmasi Registrasi Paydone", htmlBody);
            return res.json({
                success: true,
                message: "Pendaftaran berhasil! Silakan cek email Anda untuk mengaktifkan akun.",
                isPendingVerification: true,
                smtpActive: true,
            });
        } else {
            // FLOW B: SMTP belum configured → user langsung aktif + auto-login
            await pool.query(
                `INSERT INTO users (id,username,email,password,role,status,preferred_language)
                 VALUES ($1,$2,$3,$4,'user','active',$5)`,
                [newId, username || email.split('@')[0], email, hashPassword(password), lang]
            );
            await assignDefaultFreePackage(newId, packageId);
            const newToken = crypto.randomUUID();
            await appendSessionToken(newId, newToken);
            await pool.query("UPDATE users SET last_login = NOW() WHERE id = $1", [newId]);
            const finalUserRes = await pool.query("SELECT * FROM users WHERE id = $1", [newId]);
            return res.json({
                success: true,
                message: "Pendaftaran berhasil! Selamat datang di Paydone.",
                isPendingVerification: false,
                smtpActive: false,
                user: { ...toHybridUser(finalUserRes.rows[0]), sessionToken: newToken },
                isNewUser: true,
            });
        }
    } catch (e) {
        console.error("❌ [SIGNUP]", e.message);
        res.status(500).json({ error: "Signup Error" });
    }
});

app.get("/api/auth/verify-email", async (req, res) => {
    try {
        const r = await pool.query("UPDATE users SET status = 'active', verification_token = NULL WHERE verification_token = $1 RETURNING id", [req.query.token]);
        if (r.rowCount === 0) return res.status(400).json({ error: "Link verifikasi tidak valid atau sudah kadaluarsa." });
        res.json({ success: true, message: "Akun berhasil diverifikasi! Silakan login." });
    } catch (e) { res.status(500).json({ error: "Verifikasi Error" }); }
});

app.post("/api/auth/forgot-password", authRateLimiter, async (req, res) => {
    const { email } = req.body;
    try {
        const r = await pool.query("SELECT id FROM users WHERE email=$1", [email]);
        if (r.rowCount > 0) {
            const resetToken = crypto.randomBytes(32).toString('hex');
            await pool.query("UPDATE users SET reset_token = $1 WHERE email = $2", [resetToken, email]);
            const appUrl = await getAppUrlFromDB();
            const link = `${appUrl}/reset-password?token=${resetToken}`;
            const htmlBody = `<div style="padding:20px;font-family:Arial,sans-serif;"><h2>Permintaan Reset Password</h2><p>Klik link di bawah ini untuk mengubah password Anda. Link ini hanya berlaku 1 jam.</p><a href="${link}" style="background-color:#f44336;color:white;padding:10px 20px;text-decoration:none;border-radius:5px;display:inline-block;">Reset Password</a></div>`;
            await sendEmailEngine(email, "Reset Password Paydone", htmlBody);
        }
        res.json({ success: true, message: "Jika email terdaftar, link reset telah dikirim." });
    } catch (e) { res.status(500).json({ error: "Forgot password failed" }); }
});

app.post("/api/auth/reset-password", async (req, res) => {
    const { token, newPassword } = req.body;
    try {
        const r = await pool.query(
            "UPDATE users SET password = $1, reset_token = NULL, session_tokens = '[]'::jsonb, session_token = NULL WHERE reset_token = $2 RETURNING id",
            [hashPassword(newPassword), token]
        );
        if (r.rowCount === 0) return res.status(400).json({ error: "Token tidak valid atau sudah kadaluarsa." });
        if (global.broadcastWS) global.broadcastWS({ type: "FORCE_LOGOUT", userId: r.rows[0].id });
        res.json({ success: true, message: "Password berhasil diubah. Silakan login kembali." });
    } catch (e) { res.status(500).json({ error: "Reset failed" }); }
});

app.put("/api/users/:id", async (req, res) => {
    const userId = req.headers["x-user-id"]; const token = req.headers["x-session-token"];
    if (!(await verifySession(userId, token, res)) || userId !== req.params.id) return res.status(401).json({ error: "Unauthorized" });
    // [V50.70 FIX] Accept all profile fields: username, password, email, bigWhyUrl,
    // financialFreedomTarget, riskProfile, photoUrl, preferredLanguage
    const b = req.body;
    const username             = b.username;
    const password             = b.password;
    const email                = b.email;
    const preferredLanguage    = b.preferredLanguage ?? b.preferred_language;
    const preferredCurrency    = b.preferredCurrency  ?? b.preferred_currency;
    const preferredTimezone    = b.preferredTimezone  ?? b.preferred_timezone;
    const preferredCountry     = b.preferredCountry   ?? b.preferred_country;
    const localeIsAuto         = b.localeIsAuto       !== undefined ? b.localeIsAuto : b.locale_is_auto;
    const bigWhyUrl            = b.bigWhyUrl            ?? b.big_why_url;
    const financialFreedomTarget = b.financialFreedomTarget ?? b.financial_freedom_target;
    const riskProfile          = b.riskProfile          ?? b.risk_profile;
    const photoUrl             = b.photoUrl             ?? b.photo_url;
    try {
        let updateQuery = "UPDATE users SET updated_at = NOW()"; const values = []; let pIdx = 1;
        if (username !== undefined)               { updateQuery += `, username = $${pIdx++}`;                  values.push(username); }
        if (email !== undefined && email !== '')  { updateQuery += `, email = $${pIdx++}`;                     values.push(email); }
        if (preferredLanguage !== undefined)      { updateQuery += `, preferred_language = $${pIdx++}`;        values.push(preferredLanguage); }
        if (preferredCurrency !== undefined)       { updateQuery += `, preferred_currency = $${pIdx++}`;        values.push(preferredCurrency); }
        if (preferredTimezone !== undefined)       { updateQuery += `, preferred_timezone = $${pIdx++}`;        values.push(preferredTimezone); }
        if (preferredCountry !== undefined)        { updateQuery += `, preferred_country = $${pIdx++}`;         values.push(preferredCountry); }
        if (localeIsAuto !== undefined)            { updateQuery += `, locale_is_auto = $${pIdx++}`;            values.push(localeIsAuto); }
        if (bigWhyUrl !== undefined)              { updateQuery += `, big_why_url = $${pIdx++}`;               values.push(bigWhyUrl); }
        if (financialFreedomTarget !== undefined) { updateQuery += `, financial_freedom_target = $${pIdx++}`;  values.push(financialFreedomTarget); }
        if (riskProfile !== undefined)            { updateQuery += `, risk_profile = $${pIdx++}`;              values.push(riskProfile); }
        if (photoUrl !== undefined)               { updateQuery += `, photo_url = $${pIdx++}`;                 values.push(photoUrl); }
        if (password)                             { updateQuery += `, password = $${pIdx++}, session_tokens = '[]'::jsonb, session_token = NULL`; values.push(hashPassword(password)); }
        updateQuery += ` WHERE id = $${pIdx}`; values.push(userId);
        await pool.query(updateQuery, values);
        if (global.broadcastWS && password) global.broadcastWS({ type: "FORCE_LOGOUT", userId });
        res.json({ success: true, message: password ? "Password diubah. Silakan login kembali." : "Profil diperbarui.", forceRelogin: !!password });
    } catch (e) { res.status(500).json({ error: "Update Failed" }); }
});

// [V50.68 FIX B3] Duplicate GET /api/user/billing removed.
// The more complete version with payment_method_id, promo_id, created_at, updated_at
// is registered below in the V50.59 alignment section.


// Admin: GET ALL tickets (not filtered by user_id, sorted by created_at desc)
app.get("/api/admin/tickets", async (req, res) => {
    if (!(await verifyAdminOrRole(req))) return res.status(403).json({ error: 'Forbidden' });
    try {
        const r = await pool.query(`SELECT t.*, u.username, u.email FROM tickets t LEFT JOIN users u ON t.user_id = u.id ORDER BY t.created_at DESC LIMIT 500`);
        res.json({ success: true, data: { tickets: keysToCamel(r.rows.map(unpackMetadata)) } });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// =============================================================================
// --- 10. OFFLINE SYNC ENGINE ---
// =============================================================================
app.get('/api/sync/global', async (req, res) => {
    try { const r = await pool.query("SELECT data FROM config WHERE id = 'app_config' LIMIT 1"); res.json({ config: r.rows[0]?.data || {} }); } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get("/api/sync", async (req, res) => {
    const { userId, lastSync } = req.query;
    if (!userId || userId === "check") {
        try { const a = await pool.query("SELECT * FROM ai_agents"); return res.json({ status: "ready", aiAgents: keysToCamel(a.rows) }); } catch (e) { return res.status(500).json({ error: e.message }); }
    }
    // [FIX] Validate session BEFORE acquiring pool connection to prevent connection leak
    if (!(await verifySession(userId, req.headers["x-session-token"], res))) return res.status(401).json({ error: "Session Invalid" });
    const client = await pool.connect();
    try {
        await client.query("UPDATE users SET last_login = NOW() WHERE id = $1", [userId]);
        const activeData = await getUserActivePackage(userId);
        const configDataRes = await client.query("SELECT data FROM config WHERE id = 'app_config'");
        const appConfig = configDataRes.rows[0]?.data || {};
        const showDetailedLogs = appConfig.showDetailedLogsToUsers === true;
        const t = lastSync ? new Date(lastSync) : new Date(0);
        if (lastSync) t.setMinutes(t.getMinutes() - 60);

        const get = async (tbl) => {
            const r = await client.query(`SELECT * FROM ${tbl} WHERE user_id=$1 AND updated_at > $2`, [userId, t]);
            return keysToCamel(r.rows.map(unpackMetadata)).map(x => {
                for (let k in x) {
                    if (x[k] instanceof Date) {
                        if (['startDate','endDate','dueDate','date','dateReceived','paidDate','deadline'].includes(k)) x[k] = toISODate(x[k]);
                        else x[k] = x[k].toISOString();
                    }
                    if (typeof x[k] === 'string' && !isNaN(x[k]) && x[k].trim() !== '' && !k.toLowerCase().includes('id') && !k.toLowerCase().includes('account') && !k.toLowerCase().includes('phone')) {
                        if (['amount','totalLiability','monthlyPayment','remainingPrincipal','interestRate','targetAmount','currentAmount','balance','percentage','originalPrincipal','principalPart','interestPart','remainingBalance','promoRate','fixedYear','currentSavedAmount','earlySettlementDiscount','remainingMonths','financialFreedomTarget'].includes(k)) x[k] = Number(x[k]);
                    }
                    if (k === 'stepUpSchedule' && typeof x[k] === 'string') { try { x[k] = JSON.parse(x[k]); } catch(e) { x[k] = []; } }
                }
                return x;
            });
        };

        const qaRes = await client.query("SELECT * FROM qa_scenarios");
        const qaRows = keysToCamel(qaRes.rows).map(q => { if (typeof q.payload === 'string') { try { q.payload = JSON.parse(q.payload); } catch(e) {} } return q; });
        const notifs = await client.query("SELECT * FROM notifications WHERE user_id=$1 ORDER BY created_at DESC LIMIT 20", [userId]);
        let rawActivityLogs = await get("activity_logs");
        const processedLogs = rawActivityLogs.map(log => {
            if (typeof log.payload  === 'string') { try { log.payload  = JSON.parse(log.payload);  } catch(e) {} }
            if (typeof log.response === 'string') { try { log.response = JSON.parse(log.response); } catch(e) {} }
            if (!showDetailedLogs) { delete log.payload; delete log.response; }
            return log;
        });

        // [V50.65 FIX #1] Fetch packages, paymentMethods, promos, subscriptions
        // cloudSync.ts pullUserDataFromCloud membaca ke-4 field ini dari response
        // untuk menghidrasi db.packages / db.paymentMethods / db.promos / db.subscriptions.
        const packagesRes  = await client.query("SELECT * FROM packages WHERE is_active = TRUE ORDER BY price ASC");
        const packagesRows = keysToCamel(packagesRes.rows).map((pkg, i) => {
            pkg.features = typeof packagesRes.rows[i].features === 'string'
                ? JSON.parse(packagesRes.rows[i].features)
                : packagesRes.rows[i].features;
            return pkg;
        });
        const pmRes     = await client.query("SELECT * FROM payment_methods WHERE is_active = TRUE");
        const promosRes = await client.query("SELECT * FROM promos ORDER BY updated_at DESC");
        const subsRes   = await client.query(
            `SELECT s.*, p.name as package_name, p.features, p.ai_limit
             FROM subscriptions s
             LEFT JOIN packages p ON s.package_id = p.id
             WHERE s.user_id = $1
             ORDER BY s.updated_at DESC LIMIT 5`,
            [userId]
        );

        res.json({
            meta: { timestamp: new Date().toISOString() }, activeFeatures: activeData.features, subscriptionStatus: activeData.status,
            notifications: keysToCamel(notifs.rows),
            users: keysToCamel((await client.query('SELECT * FROM users WHERE id = $1', [userId])).rows.map(unpackMetadata)),
            aiAgents: keysToCamel((await client.query("SELECT * FROM ai_agents")).rows),
            debts: await get("debts"), incomes: await get("incomes"), dailyExpenses: await get("daily_expenses"),
            debtInstallments: await get("debt_installments"), paymentRecords: await get("payment_records"),
            allocations: await get("allocations"), tasks: await get("tasks"), sinkingFunds: await get("sinking_funds"),
            tickets: await get("tickets"), activityLogs: processedLogs, bankAccounts: await get('bank_accounts'),
            qaScenarios: qaRows, banks: keysToCamel((await client.query("SELECT * FROM banks")).rows),
            baConfigurations: keysToCamel((await client.query("SELECT * FROM ba_configurations")).rows), config: appConfig,
            // [V50.65 NEW] Freemium data — dibutuhkan oleh cloudSync.ts pullUserDataFromCloud
            packages: packagesRows,
            paymentMethods: keysToCamel(pmRes.rows),
            promos: keysToCamel(promosRes.rows),
            subscriptions: keysToCamel(subsRes.rows),
        });
    } catch (e) { console.error("[SYNC ERROR]", e.message, e.stack?.split("\n")[1]); res.status(500).json({ error: "Sync Fetch Error", detail: e.message }); } finally { client.release(); }
});

app.post('/api/sync', async (req, res) => {
    const { users, debts, debtInstallments, incomes, dailyExpenses, paymentRecords, sinkingFunds, tasks, tickets, activityLogs, allocations, qaScenarios, config, bankAccounts, banks, baConfigurations, aiAgents } = req.body;
    const reqUserId = req.headers["x-user-id"];
    const isAdminSync = verifyAdminSecret(req);
    // [FIX] Validate session BEFORE acquiring pool connection to prevent connection leak
    if (!(await verifySession(reqUserId, req.headers["x-session-token"], res))) return res.status(401).json({ error: "Unauthorized" });
    const client = await pool.connect();

    try {
        await client.query('BEGIN');
        const now = new Date();
        const safeMeta = (i) => { let m = i.metadata || {}; if (JSON.stringify(m).length > 2000) m = {}; return JSON.stringify(m); };
        let allocListFlat = [];
        if (Array.isArray(allocations)) allocListFlat = allocations;
        else if (allocations && typeof allocations === 'object') allocListFlat = Object.values(allocations).flat();

        if (Array.isArray(users) && users.length) {
            for (const item of users) {
                const u = keysToCamel(item);
                await client.query(`INSERT INTO users (id,username,email,password,role,status,last_login,photo_url,badges,risk_profile,big_why_url,financial_freedom_target,parent_user_id,updated_at,metadata) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) ON CONFLICT (id) DO UPDATE SET username=EXCLUDED.username,email=EXCLUDED.email,password=EXCLUDED.password,role=EXCLUDED.role,status=EXCLUDED.status,last_login=EXCLUDED.last_login,photo_url=EXCLUDED.photo_url,badges=EXCLUDED.badges,risk_profile=EXCLUDED.risk_profile,big_why_url=EXCLUDED.big_why_url,financial_freedom_target=EXCLUDED.financial_freedom_target,parent_user_id=EXCLUDED.parent_user_id,metadata=EXCLUDED.metadata,updated_at=LEAST(EXCLUDED.updated_at,NOW()) WHERE users.updated_at < LEAST(EXCLUDED.updated_at,NOW())`,
                    [u.id, u.username, u.email, u.password || '', u.role || 'user', u.status || 'active', u.lastLogin || now, u.photoUrl, typeof u.badges === 'object' ? JSON.stringify(u.badges) : u.badges, u.riskProfile, u.bigWhyUrl, u.financialFreedomTarget ?? 0, u.parentUserId, now, safeMeta(u)]);
            }
        }

        if (Array.isArray(dailyExpenses) && dailyExpenses.length) {
            for (const item of dailyExpenses) {
                const i = keysToCamel(item); const finalImg = saveBase64ToFile(i.receiptImage);
                await client.query(`INSERT INTO daily_expenses (id,user_id,date,title,amount,category,notes,receipt_image,allocation_id,sinking_fund_id,metadata,updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) ON CONFLICT (id) DO UPDATE SET date=EXCLUDED.date,title=EXCLUDED.title,amount=EXCLUDED.amount,category=EXCLUDED.category,notes=EXCLUDED.notes,receipt_image=EXCLUDED.receipt_image,allocation_id=EXCLUDED.allocation_id,sinking_fund_id=EXCLUDED.sinking_fund_id,metadata=EXCLUDED.metadata,updated_at=LEAST(EXCLUDED.updated_at,NOW()) WHERE daily_expenses.updated_at < LEAST(EXCLUDED.updated_at,NOW())`,
                    [i.id, reqUserId, i.date, i.title, i.amount ?? 0, i.category, i.notes, finalImg, i.allocationId, i.sinkingFundId, safeMeta(i), now]);
            }
        }

        if (Array.isArray(debts) && debts.length) {
            for (const item of debts) {
                const i = keysToCamel(item);
                await client.query(`INSERT INTO debts (id,user_id,name,type,original_principal,total_liability,monthly_payment,remaining_principal,interest_rate,start_date,end_date,due_date,bank_name,interest_strategy,step_up_schedule,remaining_months,payoff_method,allocated_extra_budget,current_saved_amount,early_settlement_discount,metadata,updated_at,created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23) ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name,type=EXCLUDED.type,original_principal=EXCLUDED.original_principal,total_liability=EXCLUDED.total_liability,monthly_payment=EXCLUDED.monthly_payment,remaining_principal=EXCLUDED.remaining_principal,interest_rate=EXCLUDED.interest_rate,start_date=EXCLUDED.start_date,end_date=EXCLUDED.end_date,due_date=EXCLUDED.due_date,bank_name=EXCLUDED.bank_name,interest_strategy=EXCLUDED.interest_strategy,step_up_schedule=EXCLUDED.step_up_schedule,remaining_months=EXCLUDED.remaining_months,payoff_method=EXCLUDED.payoff_method,allocated_extra_budget=EXCLUDED.allocated_extra_budget,current_saved_amount=EXCLUDED.current_saved_amount,early_settlement_discount=EXCLUDED.early_settlement_discount,metadata=EXCLUDED.metadata,updated_at=LEAST(EXCLUDED.updated_at,NOW()) WHERE debts.updated_at < LEAST(EXCLUDED.updated_at,NOW())`,
                    [i.id, reqUserId, i.name, i.type, i.originalPrincipal ?? 0, i.totalLiability ?? 0, i.monthlyPayment ?? 0, i.remainingPrincipal ?? 0, i.interestRate ?? 0, i.startDate, i.endDate, i.dueDate ?? 1, i.bankName, i.interestStrategy, typeof i.stepUpSchedule === 'object' ? JSON.stringify(i.stepUpSchedule) : i.stepUpSchedule, i.remainingMonths, i.payoffMethod, i.allocatedExtraBudget, i.currentSavedAmount ?? 0, i.earlySettlementDiscount, safeMeta(i), now, i.createdAt || now]);
            }
        }

        if (Array.isArray(incomes) && incomes.length) {
            for (const item of incomes) {
                const i = keysToCamel(item);
                await client.query(`INSERT INTO incomes (id,user_id,source,amount,type,frequency,date_received,date,is_recurring,category,notes,end_date,metadata,updated_at,created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) ON CONFLICT (id) DO UPDATE SET source=EXCLUDED.source,amount=EXCLUDED.amount,type=EXCLUDED.type,frequency=EXCLUDED.frequency,date_received=EXCLUDED.date_received,date=EXCLUDED.date,is_recurring=EXCLUDED.is_recurring,category=EXCLUDED.category,notes=EXCLUDED.notes,end_date=EXCLUDED.end_date,metadata=EXCLUDED.metadata,updated_at=LEAST(EXCLUDED.updated_at,NOW()) WHERE incomes.updated_at < LEAST(EXCLUDED.updated_at,NOW())`,
                    [i.id, reqUserId, i.source, i.amount ?? 0, i.type, i.frequency, i.dateReceived, i.date || i.dateReceived, i.isRecurring ?? false, i.category || 'salary', i.notes, i.endDate, safeMeta(i), now, i.createdAt || now]);
            }
        }

        if (Array.isArray(allocListFlat) && allocListFlat.length) {
            for (const item of allocListFlat) {
                const i = keysToCamel(item);
                await client.query(`INSERT INTO allocations (id,user_id,name,amount,percentage,color,icon,month_key,category,priority,is_transferred,assigned_account_id,is_recurring,metadata,updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name,amount=EXCLUDED.amount,percentage=EXCLUDED.percentage,color=EXCLUDED.color,icon=EXCLUDED.icon,month_key=EXCLUDED.month_key,category=EXCLUDED.category,priority=EXCLUDED.priority,is_transferred=EXCLUDED.is_transferred,assigned_account_id=EXCLUDED.assigned_account_id,is_recurring=EXCLUDED.is_recurring,metadata=EXCLUDED.metadata,updated_at=LEAST(EXCLUDED.updated_at,NOW()) WHERE allocations.updated_at < LEAST(EXCLUDED.updated_at,NOW())`,
                    [i.id, reqUserId, i.name, i.amount ?? 0, i.percentage ?? 0, i.color, i.icon, i.monthKey, i.category, i.priority, i.isTransferred ?? false, i.assignedAccountId, i.isRecurring ?? true, safeMeta(i), now]);
            }
        }

        if (Array.isArray(debtInstallments) && debtInstallments.length) {
            for (const item of debtInstallments) {
                const i = keysToCamel(item);
                await client.query(`INSERT INTO debt_installments (id,debt_id,user_id,period,due_date,amount,principal_part,interest_part,remaining_balance,status,notes,metadata,updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) ON CONFLICT (id) DO UPDATE SET period=EXCLUDED.period,due_date=EXCLUDED.due_date,amount=EXCLUDED.amount,principal_part=EXCLUDED.principal_part,interest_part=EXCLUDED.interest_part,remaining_balance=EXCLUDED.remaining_balance,status=EXCLUDED.status,notes=EXCLUDED.notes,metadata=EXCLUDED.metadata,updated_at=LEAST(EXCLUDED.updated_at,NOW()) WHERE debt_installments.updated_at < LEAST(EXCLUDED.updated_at,NOW())`,
                    [i.id, i.debtId, reqUserId, i.period, i.dueDate, i.amount ?? 0, i.principalPart ?? 0, i.interestPart ?? 0, i.remainingBalance ?? 0, i.status, i.notes, safeMeta(i), now]);
            }
        }

        if (Array.isArray(paymentRecords) && paymentRecords.length) {
            for (const item of paymentRecords) {
                const i = keysToCamel(item);
                await client.query(`INSERT INTO payment_records (id,debt_id,user_id,amount,paid_date,source_bank,status,metadata,updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT (id) DO UPDATE SET amount=EXCLUDED.amount,paid_date=EXCLUDED.paid_date,source_bank=EXCLUDED.source_bank,status=EXCLUDED.status,metadata=EXCLUDED.metadata,updated_at=LEAST(EXCLUDED.updated_at,NOW()) WHERE payment_records.updated_at < LEAST(EXCLUDED.updated_at,NOW())`,
                    [i.id || `pay-${crypto.randomUUID()}`, i.debtId, reqUserId, i.amount ?? 0, i.paidDate, i.sourceBank, i.status, safeMeta(i), now]);
            }
        }

        if (Array.isArray(sinkingFunds) && sinkingFunds.length) {
            for (const item of sinkingFunds) {
                const i = keysToCamel(item);
                await client.query(`INSERT INTO sinking_funds (id,user_id,name,target_amount,current_amount,deadline,icon,color,category,priority,assigned_account_id,metadata,updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name,target_amount=EXCLUDED.target_amount,current_amount=EXCLUDED.current_amount,deadline=EXCLUDED.deadline,icon=EXCLUDED.icon,color=EXCLUDED.color,category=EXCLUDED.category,priority=EXCLUDED.priority,assigned_account_id=EXCLUDED.assigned_account_id,metadata=EXCLUDED.metadata,updated_at=LEAST(EXCLUDED.updated_at,NOW()) WHERE sinking_funds.updated_at < LEAST(EXCLUDED.updated_at,NOW())`,
                    [i.id, reqUserId, i.name, i.targetAmount ?? 0, i.currentAmount ?? 0, i.deadline, i.icon, i.color, i.category, i.priority, i.assignedAccountId, safeMeta(i), now]);
            }
        }

        if (Array.isArray(tasks) && tasks.length) {
            for (const item of tasks) {
                const i = keysToCamel(item);
                await client.query(`INSERT INTO tasks (id,user_id,title,description,category,status,due_date,context,type,is_completed,priority,related_id,metadata,updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) ON CONFLICT (id) DO UPDATE SET title=EXCLUDED.title,description=EXCLUDED.description,category=EXCLUDED.category,status=EXCLUDED.status,due_date=EXCLUDED.due_date,context=EXCLUDED.context,type=EXCLUDED.type,is_completed=EXCLUDED.is_completed,priority=EXCLUDED.priority,related_id=EXCLUDED.related_id,metadata=EXCLUDED.metadata,updated_at=LEAST(EXCLUDED.updated_at,NOW()) WHERE tasks.updated_at < LEAST(EXCLUDED.updated_at,NOW())`,
                    [i.id, reqUserId, i.title, i.description, i.category, i.status, i.dueDate, i.context, i.type || 'task', i.isCompleted ?? false, i.priority || 'medium', i.relatedId || null, safeMeta(i), now]);
            }
        }

        if (Array.isArray(bankAccounts) && bankAccounts.length) {
            for (const item of bankAccounts) {
                const b = keysToCamel(item);
                await client.query(`INSERT INTO bank_accounts (id,user_id,bank_name,account_name,holder_name,account_number,balance,type,color,is_primary,metadata,updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) ON CONFLICT (id) DO UPDATE SET bank_name=EXCLUDED.bank_name,account_name=EXCLUDED.account_name,holder_name=EXCLUDED.holder_name,account_number=EXCLUDED.account_number,balance=EXCLUDED.balance,type=EXCLUDED.type,color=EXCLUDED.color,is_primary=EXCLUDED.is_primary,metadata=EXCLUDED.metadata,updated_at=LEAST(EXCLUDED.updated_at,NOW()) WHERE bank_accounts.updated_at < LEAST(EXCLUDED.updated_at,NOW())`,
                    [b.id, reqUserId, b.bankName, b.accountName, b.holderName || b.accountName, b.accountNumber, b.balance ?? 0, b.type, b.color, b.isPrimary ?? false, safeMeta(b), now]);
            }
        }

        if (Array.isArray(activityLogs) && activityLogs.length) {
            for (const item of activityLogs) {
                const l = keysToCamel(item);
                await client.query(`INSERT INTO activity_logs (id,user_id,action,description,payload,response,status,created_at,updated_at,metadata) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) ON CONFLICT (id) DO UPDATE SET action=EXCLUDED.action,description=EXCLUDED.description,payload=EXCLUDED.payload,response=EXCLUDED.response,status=EXCLUDED.status,metadata=EXCLUDED.metadata,updated_at=LEAST(EXCLUDED.updated_at,NOW()) WHERE activity_logs.updated_at < LEAST(EXCLUDED.updated_at,NOW())`,
                    [l.id, reqUserId, l.action, l.description, typeof l.payload === 'object' ? JSON.stringify(l.payload) : l.payload, typeof l.response === 'object' ? JSON.stringify(l.response) : l.response, l.status, l.createdAt || now, now, safeMeta(l)]);
            }
        }

        if (Array.isArray(tickets) && tickets.length) {
            for (const item of tickets) {
                const t = keysToCamel(item);
                await client.query(`INSERT INTO tickets (id,user_id,title,description,priority,status,source,assigned_to,created_at,resolved_at,resolution_note,fix_logs,backup_data,is_rolled_back,updated_at,metadata) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16) ON CONFLICT (id) DO UPDATE SET title=EXCLUDED.title,description=EXCLUDED.description,priority=EXCLUDED.priority,status=EXCLUDED.status,source=EXCLUDED.source,assigned_to=EXCLUDED.assigned_to,resolved_at=EXCLUDED.resolved_at,resolution_note=EXCLUDED.resolution_note,fix_logs=EXCLUDED.fix_logs,backup_data=EXCLUDED.backup_data,is_rolled_back=EXCLUDED.is_rolled_back,metadata=EXCLUDED.metadata,updated_at=LEAST(EXCLUDED.updated_at,NOW()) WHERE tickets.updated_at < LEAST(EXCLUDED.updated_at,NOW())`,
                    [t.id, reqUserId, t.title, t.description, t.priority, t.status, t.source, t.assignedTo, t.createdAt || now, t.resolvedAt, t.resolutionNote, typeof t.fixLogs === 'object' ? JSON.stringify(t.fixLogs) : t.fixLogs, t.backupData, t.isRolledBack ?? false, now, safeMeta(t)]);
            }
        }

        if (config && isAdminSync) await client.query("INSERT INTO config (id, data, updated_at) VALUES ('app_config', $1, $2) ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, updated_at = EXCLUDED.updated_at", [config, now]);
        if (Array.isArray(banks) && banks.length && isAdminSync) { for (const b of banks) { await client.query(`INSERT INTO banks (id,name,type,promo_rate,fixed_year,updated_at) VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name,type=EXCLUDED.type,promo_rate=EXCLUDED.promo_rate,fixed_year=EXCLUDED.fixed_year,updated_at=EXCLUDED.updated_at`, [b.id, b.name, b.type, b.promoRate ?? 0, b.fixedYear ?? 0, now]); } }
        if (Array.isArray(baConfigurations) && baConfigurations.length && isAdminSync) { for (const c of baConfigurations) { await client.query(`INSERT INTO ba_configurations (id,type,data,updated_at) VALUES ($1,$2,$3,$4) ON CONFLICT (id) DO UPDATE SET type=EXCLUDED.type,data=EXCLUDED.data,updated_at=EXCLUDED.updated_at`, [c.id, c.type, c.data, now]); } }
        // [V50.79 FIX] aiAgents was missing from sync handler — agents saved by AICenter were silently dropped
        if (Array.isArray(aiAgents) && aiAgents.length && isAdminSync) {
            for (const a of aiAgents) {
                const ag = keysToCamel(a);
                await client.query(
                    `INSERT INTO ai_agents (id,name,description,model,system_instruction,temperature,updated_at)
                     VALUES ($1,$2,$3,$4,$5,$6,$7)
                     ON CONFLICT (id) DO UPDATE SET
                         name=EXCLUDED.name, description=EXCLUDED.description,
                         model=EXCLUDED.model, system_instruction=EXCLUDED.system_instruction,
                         temperature=EXCLUDED.temperature, updated_at=EXCLUDED.updated_at`,
                    [ag.id, ag.name, ag.description, ag.model, ag.systemInstruction, String(ag.temperature ?? 0.7), now]
                );
            }
        }
        if (Array.isArray(qaScenarios) && qaScenarios.length && isAdminSync) { for (const q of qaScenarios) { let pLoad = q.payload; if (typeof pLoad === 'object') pLoad = JSON.stringify(pLoad); await client.query(`INSERT INTO qa_scenarios (id,name,category,type,target,method,payload,description,expected_status,is_negative_case,created_at,last_run,last_status,updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name,category=EXCLUDED.category,type=EXCLUDED.type,target=EXCLUDED.target,method=EXCLUDED.method,payload=EXCLUDED.payload,description=EXCLUDED.description,expected_status=EXCLUDED.expected_status,is_negative_case=EXCLUDED.is_negative_case,last_run=EXCLUDED.last_run,last_status=EXCLUDED.last_status,updated_at=EXCLUDED.updated_at`, [q.id, q.name, q.category, q.type, q.target, q.method, pLoad, q.description, q.expectedStatus ?? false, q.isNegativeCase ?? false, q.createdAt, q.lastRun, q.lastStatus, now]); } }

        await client.query('COMMIT');
        if (global.broadcastWS) global.broadcastWS({ type: "BULK_SYNC", action: "SYNC_COMPLETE", userId: reqUserId });
        res.json({ message: "Sync Success", serverTime: now });
    } catch(e) { await client.query('ROLLBACK'); res.status(500).json({ error: e.message }); } finally { client.release(); }
});

app.delete('/api/sync/:table/:id', async (req, res) => {
    const { table, id } = req.params; const userId = req.headers['x-user-id']; const clientToken = req.headers['x-session-token'];
    if (!userId) return res.status(400).json({ error: "Missing x-user-id" });
    if (!(await verifySession(userId, clientToken, res))) return res.status(401).json({ error: "Session Invalid" });
    const allowedTables = ['debts','debt_installments','incomes','daily_expenses','payment_records','sinking_funds','tasks','allocations','bank_accounts','tickets','activity_logs'];
    if (!allowedTables.includes(table)) return res.status(403).json({ error: "Table forbidden" });
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        if (table === 'debts') { await client.query(`DELETE FROM debt_installments WHERE debt_id = $1 AND user_id = $2`, [id, userId]); await client.query(`DELETE FROM payment_records WHERE debt_id = $1 AND user_id = $2`, [id, userId]); }
        else if (table === 'allocations') { await client.query(`UPDATE daily_expenses SET allocation_id = NULL WHERE allocation_id = $1 AND user_id = $2`, [id, userId]); }
        else if (table === 'sinking_funds') { await client.query(`UPDATE daily_expenses SET sinking_fund_id = NULL WHERE sinking_fund_id = $1 AND user_id = $2`, [id, userId]); }
        const result = await client.query(`DELETE FROM ${table} WHERE id = $1 AND user_id = $2`, [id, userId]);
        await client.query('COMMIT');
        if (global.broadcastWS) global.broadcastWS({ type: "SYNC_DELETE", table, action: "DELETE", id, userId, timestamp: new Date() });
        res.json({ success: true, id });
    } catch (e) { await client.query('ROLLBACK'); res.status(500).json({ error: e.message }); } finally { client.release(); }
});

// =============================================================================
// --- 11. MULTIPART FILE UPLOAD ---
// =============================================================================
app.post("/api/upload", uploadDocs.single('file'), (req, res) => {
    if (!req.file) return res.status(400).json({ error: "No file provided" });
    res.json({ url: `/uploads/${req.file.filename}`, originalName: req.file.originalname });
});

// =============================================================================
// --- 12. AI ENDPOINT ---
// =============================================================================
app.post("/api/ai/analyze", checkFeatureAccess('ai_command_center'), checkAiQuota, async (req, res) => {
    try {
        const conf = await getSystemConfig();
        if (!conf.apiKey) return res.status(500).json({ error: "API Key Missing" });
        const safePrompt = String(req.body.prompt).substring(0, 2000);
        // V50.78 FIX: Pass systemInstruction and responseJson from frontend.
        // Previously these were ignored — all agent AI calls (debt strategist,
        // transaction parser, onboarding wizard, etc.) lost their specialized context.
        const sysInst = req.body.systemInstruction ? String(req.body.systemInstruction).substring(0, 1000) : '';
        const jsonMode = req.body.responseJson === true;
        // Build the full prompt: i18n header + optional system instruction + user query + optional JSON instruction
        const i18nHeader = `[System Command: User preferred language is '${req.userLang || 'id'}'. Reply entirely in this language without mentioning this instruction.]`;
        const jsonInstruction = jsonMode ? '\n\n[IMPORTANT: Reply ONLY with valid JSON. No markdown, no explanation, no backticks. Output raw JSON only.]' : '';
        const fullPrompt = sysInst
            ? `${i18nHeader}\n\nSystem Role: ${sysInst}\n\nUser Query: ${safePrompt}${jsonInstruction}`
            : `${i18nHeader}\n\nUser Query: ${safePrompt}${jsonInstruction}`;
        const genAI = new GoogleGenerativeAI(conf.apiKey);
        const model = genAI.getGenerativeModel({ model: req.body.model || conf.modelName });
        const result = await model.generateContent(fullPrompt);
        res.json({ text: result.response.text() });
    } catch (e) { res.status(500).json({ error: "AI Processing Failed" }); }
});

// =============================================================================
// --- 12b. AI KNOWLEDGE BASE (Semi-AI / Local AI Rules) ---
// =============================================================================

// GET /api/ai/knowledge-rules — public (user auth) - fetch rules for local AI
app.get("/api/ai/knowledge-rules", verifyToken, async (req, res) => {
    try {
        const r = await pool.query("SELECT value FROM global_configs WHERE key = 'ai_knowledge_rules'");
        if (r.rows.length === 0) return res.json({ rules: [] });
        // [V50.78 FIX] global_configs.value is JSONB — pg returns it already parsed as a JS object/array.
        // JSON.parse(object) would throw SyntaxError. Use the value directly; fallback to [] if null/undefined.
        const raw = r.rows[0].value;
        const rules = Array.isArray(raw) ? raw : (typeof raw === 'string' ? JSON.parse(raw) : []);
        res.json({ rules });
    } catch (e) { res.json({ rules: [] }); }
});

// POST /api/admin/ai/knowledge-rules — admin only - save rules
app.post("/api/admin/ai/knowledge-rules", requireAdminSecretOrRole, async (req, res) => {
    try {
        const { rules } = req.body;
        if (!Array.isArray(rules)) return res.status(400).json({ error: 'rules must be array' });
        const value = JSON.stringify(rules);
        await pool.query(
            "INSERT INTO global_configs(key, value, updated_at) VALUES('ai_knowledge_rules', $1, NOW()) ON CONFLICT(key) DO UPDATE SET value=$1, updated_at=NOW()",
            [value]
        );
        res.json({ success: true, count: rules.length });
    } catch (e) { res.status(500).json({ error: String(e) }); }
});

// GET /api/admin/ai/unknown-prompts — list pending unmatched prompts
app.get("/api/admin/ai/unknown-prompts", requireAdminSecretOrRole, async (req, res) => {
    try {
        const status = req.query.status || 'pending';
        const r = await pool.query(
            "SELECT * FROM ai_unknown_prompts WHERE status=$1 ORDER BY count DESC, created_at DESC LIMIT 100",
            [status]
        );
        res.json({ success: true, prompts: r.rows });
    } catch (e) { res.status(500).json({ error: String(e) }); }
});

// POST /api/ai/unknown-prompt — user reports unmatched input (user auth)
app.post("/api/ai/unknown-prompt", verifyToken, async (req, res) => {
    try {
        const { rawInput } = req.body;
        if (!rawInput) return res.status(400).json({ error: 'rawInput required' });
        const clean = String(rawInput).toLowerCase().trim().substring(0, 500);
        const existing = await pool.query(
            "SELECT id, count FROM ai_unknown_prompts WHERE LOWER(raw_input)=$1", [clean]
        );
        if (existing.rows.length > 0) {
            await pool.query(
                "UPDATE ai_unknown_prompts SET count=count+1, updated_at=NOW() WHERE id=$1",
                [existing.rows[0].id]
            );
        } else {
            const id = 'unk-' + Date.now() + '-' + Math.random().toString(36).slice(2,6);
            await pool.query(
                "INSERT INTO ai_unknown_prompts(id,raw_input,user_id,count,status) VALUES($1,$2,$3,1,'pending')",
                [id, clean, req.userId]
            );
        }
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: String(e) }); }
});

// PATCH /api/admin/ai/unknown-prompts/:id — admin resolves a prompt
// body: { status: 'resolved'|'ignored', resolved_actions: [{action, label, triggers}], admin_notes }
app.patch("/api/admin/ai/unknown-prompts/:id", requireAdminSecretOrRole, async (req, res) => {
    try {
        const { id } = req.params;
        const { status, resolved_actions, admin_notes } = req.body;
        await pool.query(
            "UPDATE ai_unknown_prompts SET status=$1, resolved_actions=$2, admin_notes=$3, updated_at=NOW() WHERE id=$4",
            [status || 'resolved', JSON.stringify(resolved_actions || []), admin_notes || '', id]
        );
        // If admin resolves with actions, auto-add as triggers to knowledge rules
        if (status === 'resolved' && Array.isArray(resolved_actions) && resolved_actions.length > 0) {
            const r = await pool.query("SELECT value FROM global_configs WHERE key='ai_knowledge_rules'");
            let rules = [];
            const rawRules = r.rows[0]?.value; rules = Array.isArray(rawRules) ? rawRules : (typeof rawRules === 'string' ? (()=>{ try { return JSON.parse(rawRules); } catch { return []; } })() : []);
            const rawInput = (await pool.query("SELECT raw_input FROM ai_unknown_prompts WHERE id=$1", [id])).rows[0]?.raw_input || '';
            // Add the raw input as a trigger to the first matching rule or create new rule
            resolved_actions.forEach(ra => {
                const existing = rules.find(rule => rule.action === ra.action);
                if (existing && rawInput && !existing.triggers.includes(rawInput)) {
                    existing.triggers.push(rawInput);
                }
            });
            await pool.query(
                "INSERT INTO global_configs(key,value,updated_at) VALUES('ai_knowledge_rules',$1,NOW()) ON CONFLICT(key) DO UPDATE SET value=$1,updated_at=NOW()",
                [JSON.stringify(rules)]
            );
        }
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: String(e) }); }
});

// =============================================================================
// --- 13. BILLING & CHECKOUT ---
// =============================================================================
app.post("/api/payment/checkout", async (req, res) => {
    const { userId, packageId, paymentMethodId, promoCode } = req.body;
    const client = await pool.connect();
    try {
        await client.query("BEGIN");
        const pkgRes = await client.query("SELECT price FROM packages WHERE id=$1", [packageId]);
        if (pkgRes.rows.length === 0) throw new Error("Package not found");
        let basePrice = Number(pkgRes.rows[0].price); let appliedPromoId = null;

        if (promoCode) {
            const promoRes = await client.query("SELECT * FROM promos WHERE code = $1 AND is_active = TRUE AND valid_until > NOW() AND quota > 0 FOR UPDATE", [promoCode]);
            if (promoRes.rows.length > 0) {
                const promo = promoRes.rows[0]; appliedPromoId = promo.id;
                if (promo.target_user_id && promo.target_user_id !== userId) throw new Error("Kode promo tidak berlaku untuk akun Anda.");
                const usageCheck = await client.query("SELECT id FROM subscriptions WHERE promo_id = $1 AND user_id = $2", [promo.id, userId]);
                if (usageCheck.rows.length > 0) throw new Error("Anda sudah pernah menggunakan kode promo ini.");
                let discountAmount = (promo.discount_percentage > 0) ? basePrice * (Number(promo.discount_percentage) / 100) : Number(promo.discount_nominal);
                basePrice = Math.max(0, basePrice - discountAmount);
                await client.query("UPDATE promos SET quota = quota - 1 WHERE id = $1", [promo.id]);
            } else throw new Error("Kode promo tidak valid, habis, atau kedaluwarsa.");
        }

        await client.query("UPDATE subscriptions SET status = 'cancelled' WHERE user_id = $1 AND status IN ('awaiting_payment', 'verifying')", [userId]);
        const subId = `inv-${crypto.randomUUID()}`;

        if (basePrice === 0) {
            const endDate = new Date(); endDate.setMonth(endDate.getMonth() + 1);
            await client.query("INSERT INTO subscriptions (id,user_id,package_id,promo_id,status,amount_paid,start_date,end_date) VALUES ($1,$2,$3,$4,'active',0,NOW(),$5)", [subId, userId, packageId, appliedPromoId, endDate]);
            await client.query("UPDATE users SET subscription_id = $1, ai_hits_used = 0 WHERE id = $2", [subId, userId]);
            await client.query("COMMIT");
            if (global.broadcastWS) global.broadcastWS({ type: "FORCE_SYNC", userId });
            return res.json({ success: true, isFree: true, message: "Paket aktif tanpa pembayaran!" });
        }

        let successInsert = false; let attempts = 0; let finalAmount = 0; let uniqueCode = 0;
        while (!successInsert && attempts < 10) {
            try {
                uniqueCode = Math.floor(Math.random() * 999) + 1;
                finalAmount = basePrice + uniqueCode;
                await client.query("INSERT INTO subscriptions (id,user_id,package_id,payment_method_id,promo_id,status,amount_paid,start_date) VALUES ($1,$2,$3,$4,$5,'awaiting_payment',$6,NOW())", [subId, userId, packageId, paymentMethodId, appliedPromoId, finalAmount]);
                successInsert = true;
            } catch (err) { if (err.code === '23505') attempts++; else throw err; }
        }
        if (!successInsert) throw new Error("Sistem sibuk, silakan coba beberapa detik lagi.");

        await client.query("COMMIT");
        if (global.broadcastWS) global.broadcastWS({ type: "FORCE_SYNC", userId });
        res.json({ success: true, isFree: false, invoiceId: subId, amountToPay: finalAmount, uniqueCode });
    } catch (e) { await client.query("ROLLBACK"); res.status(400).json({ error: e.message || "Checkout failed" }); } finally { client.release(); }
});

app.post("/api/payment/submit", async (req, res) => {
    try {
        const finalImg = await saveBase64ToFileAsync(req.body.proofOfPayment);
        const r = await pool.query("UPDATE subscriptions SET status = 'verifying', proof_of_payment = $1 WHERE id = $2 AND status = 'awaiting_payment' RETURNING *", [finalImg, req.body.invoiceId]);
        if (r.rowCount === 0) return res.status(400).json({ error: "Invoice tidak valid atau sudah kedaluwarsa." });
        res.json({ success: true, message: "Bukti pembayaran diunggah. Menunggu konfirmasi admin." });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// =============================================================================
// --- V50.58 BRIDGE ENDPOINTS — Frontend-Backend Alignment ---
// =============================================================================

// [FIX #1 / V50.59 PATCH] GET /api/notifications
// Frontend: DashboardLayout.tsx memanggil GET /api/notifications
// Backend V50.57 hanya punya PUT /:id/read dan notifications via /sync.
// V50.58: Ditambahkan endpoint ini.
// V50.59: Difix untuk return raw snake_case rows agar cocok dengan
//         AppNotification type di types.ts (is_read, user_id, created_at, image_url).
// [V50.64 NEW] POST /api/notifications - Create notification
app.post("/api/notifications", async (req, res) => {
    const userId = req.headers["x-user-id"];
    const token  = req.headers["x-session-token"];
    if (!(await verifySession(userId, token, res))) return res.status(401).json({ error: "Unauthorized" });
    try {
        const { id, title, message, type, link } = req.body;
        const notifId = id || `notif-${crypto.randomUUID()}`;
        const r = await pool.query(
            "INSERT INTO notifications (id, user_id, title, message, type, link, is_read, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, FALSE, NOW(), NOW()) ON CONFLICT (id) DO UPDATE SET title=EXCLUDED.title, message=EXCLUDED.message, updated_at=NOW() RETURNING *",
            [notifId, userId, title || '', message || '', type || 'info', link || null]
        );
        res.json({ success: true, data: keysToCamel(r.rows[0]) });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get("/api/notifications", async (req, res) => {
    const userId = req.headers["x-user-id"];
    const token  = req.headers["x-session-token"];
    if (!(await verifySession(userId, token, res))) return res.status(401).json({ error: "Unauthorized" });
    try {
        const r = await pool.query(
            "SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50",
            [userId]
        );
        // V50.59: Return raw snake_case — AppNotification type uses snake_case fields
        res.json(r.rows);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// [FIX #2] GET /api/subscriptions
// UpgradePage.tsx memanggil /subscriptions?userId=... untuk billing history.
// Note: Frontend sudah difix ke /user/billing. Endpoint ini sebagai backward-compat.
app.get("/api/subscriptions", async (req, res) => {
    const userId = req.headers["x-user-id"] || req.query.userId;
    const token  = req.headers["x-session-token"];
    if (!(await verifySession(userId, token, res))) return res.status(401).json({ error: "Unauthorized" });
    try {
        const r = await pool.query(
            `SELECT s.id as invoice_id, s.id, s.status, s.start_date, s.end_date,
                    s.amount_paid, p.name as package_name, s.package_id,
                    s.payment_method_id, s.promo_id, s.proof_of_payment
             FROM subscriptions s
             JOIN packages p ON s.package_id = p.id
             WHERE s.user_id = $1
             ORDER BY s.created_at DESC`,
            [userId]
        );
        res.json(keysToCamel(r.rows));
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// [FIX #3 / V50.59 PATCH] GET /api/sales/email-blast-history
// V50.59: Tambahkan field sent_to, delivered, failed agar cocok dengan
//         BlastHistory interface di SalesEmailBlast.tsx
app.get("/api/sales/email-blast-history", requireRole(['sales']), async (req, res) => {
    try {
        const r = await pool.query(
            `SELECT ec.id, ec.subject, ec.body_html, ec.target_audience, ec.total_sent,
                    ec.created_at, u.username as author_name
             FROM email_campaigns ec
             LEFT JOIN users u ON ec.author_id = u.id
             ORDER BY ec.created_at DESC
             LIMIT 100`
        );
        // V50.59: Map to BlastHistory shape (sent_to, delivered, failed)
        const rows = r.rows.map(row => ({
            id:           row.id,
            subject:      row.subject,
            body_html:    row.body_html,
            target_audience: row.target_audience,
            total_sent:   row.total_sent,
            sent_to:      row.total_sent,   // alias for BlastHistory.sent_to
            delivered:    row.total_sent,   // best-effort: assume all delivered
            failed:       0,
            status:       'sent',
            author_name:  row.author_name,
            created_at:   row.created_at,
        }));
        res.json(rows);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// Alias lama yang mungkin masih digunakan — forward ke endpoint baru
app.get("/api/sales/email-blast/history", requireRole(['sales']), async (req, res) => {
    try {
        const r = await pool.query(
            `SELECT ec.id, ec.subject, ec.body_html, ec.target_audience, ec.total_sent,
                    ec.created_at, u.username as author_name
             FROM email_campaigns ec
             LEFT JOIN users u ON ec.author_id = u.id
             ORDER BY ec.created_at DESC
             LIMIT 100`
        );
        const rows = r.rows.map(row => ({
            id:           row.id,
            subject:      row.subject,
            body_html:    row.body_html,
            target_audience: row.target_audience,
            total_sent:   row.total_sent,
            sent_to:      row.total_sent,
            delivered:    row.total_sent,
            failed:       0,
            status:       'sent',
            author_name:  row.author_name,
            created_at:   row.created_at,
        }));
        res.json(rows);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// [FIX #4] POST /api/sales/users/:id/manual-reactivate
// SalesPromos.tsx memanggil reactivate per-user individual.
// Mengirim 1 email reaktivasi ke user spesifik (bukan blast massal).
app.post("/api/sales/users/:id/manual-reactivate", requireRole(['sales']), async (req, res) => {
    const { id } = req.params;
    const { promoCode, customMessage } = req.body;
    try {
        const userRes = await pool.query("SELECT email, username FROM users WHERE id = $1", [id]);
        if (userRes.rowCount === 0) return res.status(404).json({ error: "User not found" });
        const user = userRes.rows[0];
        const html = customMessage
            || `Halo ${user.username}, kami kangen! Yuk balik ke Paydone.${promoCode ? ` Gunakan kode promo <b>${promoCode}</b> untuk diskon spesial.` : ''}`;
        await pool.query(
            "INSERT INTO email_queues (id, to_email, subject, body_html, scheduled_at) VALUES ($1, $2, $3, $4, NOW())",
            [`q-${crypto.randomUUID()}`, user.email, "Ada hadiah untukmu dari Paydone! 🎁", html]
        );
        res.json({ success: true, message: `Email reaktivasi dikirim ke ${user.email}.` });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// [FIX #5] POST /api/telemetry/event
// telemetry.ts memanggil /telemetry/event untuk analytics events (page_view, button_click, dll).
// Disimpan ke client_telemetry dengan event_type = 'event'.
app.post("/api/telemetry/event", async (req, res) => {
    const {
        userId, sessionId, eventType, eventName,
        pageUrl, metadata, timestamp
    } = req.body;
    const eventId = `event-${crypto.randomUUID()}`;
    try {
        await pool.query(
            `INSERT INTO client_telemetry
             (id, user_id, error_message, route_url, browser_info, state_snapshot, created_at, event_type)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
            [
                eventId,
                userId || null,
                `[${eventType}] ${eventName}`,
                String(pageUrl || '').substring(0, 500),
                JSON.stringify({ sessionId }),
                JSON.stringify({ eventType, eventName, metadata }),
                timestamp ? new Date(timestamp) : new Date(),
                'event',
            ]
        );
        res.json({ status: "logged", eventId });
    } catch (e) {
        // Fail silently — telemetry tidak boleh mengganggu user
        res.json({ status: "failed_silently", eventId });
    }
});

// [FIX #6] GET /api/sales/idle-users (ALIAS untuk backward-compat)
// SalesPromos versi lama pakai /sales/idle-users. Frontend sudah difix ke /sales/users/idle.
// Alias ini menjaga kompatibilitas jika ada klien lama.
app.get("/api/sales/idle-users", requireRole(['sales']), async (req, res) => {
    try {
        // [V50.78 FIX] parseInt() ensures safe integer before SQL interpolation
        const rawDays = (await pool.query("SELECT data FROM config WHERE id = 'app_config'"))
            .rows[0]?.data?.systemRules?.idleThresholdDays;
        const thresholdDays = parseInt(rawDays, 10) || 90;
        const r = await pool.query(
            `SELECT id, username, email, last_login FROM users
             WHERE status='active' AND last_login < NOW() - INTERVAL '${thresholdDays} days'
             ORDER BY last_login ASC`
        );
        res.json({ thresholdDays, idleUsers: keysToCamel(r.rows) });
    } catch (e) { res.status(500).json({ error: "Fetch failed" }); }
});

// [FIX #7] /api/sales/content (ALIAS tanpa 's' — forward ke /sales/contents handler)
// SalesContent.tsx versi lama pakai /sales/content. Frontend sudah difix ke /sales/contents.
// Alias ini menjaga agar tidak error jika ada versi lama yang masih jalan.
app.get("/api/sales/content", requireRole(['sales']), async (req, res) => {
    // [V50.61] Include category column, add computed is_published + body alias for frontend compatibility
    try {
        const r = await pool.query("SELECT * FROM contents ORDER BY updated_at DESC");
        const rows = r.rows.map(row => ({
            ...row,
            // Computed fields for frontend compatibility (SalesContent.tsx uses snake_case interface)
            is_published: row.status === 'published',
            body: row.body_html || '',
            image_url: row.thumbnail_url || '',
            content_type: row.content_type || 'article',
            media_url: row.media_url || '',
            category: row.category || '',
        }));
        res.json(rows);
    }
    catch (e) { res.status(500).json({ error: e.message }); }
});
app.post("/api/sales/content", requireRole(['sales']), async (req, res) => {
    // [V50.61] Accept both camelCase (legacy) and snake_case (frontend SalesContent.tsx sends snake_case)
    const b = req.body;
    const id         = b.id;
    const title      = b.title;
    const slug       = b.slug;
    const bodyHtml   = b.bodyHtml   ?? b.body_html   ?? b.body ?? '';
    const thumbnailUrl = b.thumbnailUrl ?? b.thumbnail_url ?? b.image_url ?? '';
    const rawStatus  = b.status;
    const isPublished = b.isPublished ?? b.is_published;
    // Resolve status: accept 'status' field OR 'is_published' boolean fallback
    const status     = rawStatus ?? (isPublished === true ? 'published' : isPublished === false ? 'draft' : 'draft');
    const contentType = b.contentType ?? b.content_type ?? 'article';
    const mediaUrl   = b.mediaUrl   ?? b.media_url ?? '';
    const category   = b.category   ?? '';
    const authorId   = req.headers["x-user-id"];
    try {
        const finalUrl = await saveBase64ToFileAsync(thumbnailUrl);
        await pool.query(
            "INSERT INTO contents (id, author_id, title, slug, body_html, thumbnail_url, status, content_type, media_url, category, published_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) ON CONFLICT (id) DO UPDATE SET title=EXCLUDED.title, slug=EXCLUDED.slug, body_html=EXCLUDED.body_html, thumbnail_url=EXCLUDED.thumbnail_url, status=EXCLUDED.status, content_type=EXCLUDED.content_type, media_url=EXCLUDED.media_url, category=EXCLUDED.category, published_at=COALESCE(contents.published_at, EXCLUDED.published_at)",
            [id || `content-${crypto.randomUUID()}`, authorId, title, slug, bodyHtml, finalUrl, status, contentType, mediaUrl, category, status === 'published' ? new Date() : null]
        );
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});
app.put("/api/sales/content/:id", requireRole(['sales']), async (req, res) => {
    const { id } = req.params;
    // [V50.61] Accept both camelCase and snake_case, plus { is_published } boolean toggle
    const b = req.body;
    const title      = b.title;
    const slug       = b.slug;
    const bodyHtml   = b.bodyHtml   ?? b.body_html   ?? b.body;
    const thumbnailUrl = b.thumbnailUrl ?? b.thumbnail_url ?? b.image_url;
    const rawStatus  = b.status;
    const isPublished = b.isPublished ?? b.is_published;
    // If only toggle toggle (is_published or status sent), resolve status
    const status     = rawStatus ?? (isPublished === true ? 'published' : isPublished === false ? 'draft' : undefined);
    const contentType = b.contentType ?? b.content_type;
    const mediaUrl   = b.mediaUrl   ?? b.media_url;
    const category   = b.category;
    try {
        // Build dynamic update to handle partial updates (toggle only sends status)
        const setClauses = [];
        const params = [];
        let idx = 1;
        if (title      !== undefined) { setClauses.push(`title=$${idx++}`);           params.push(title); }
        if (slug       !== undefined) { setClauses.push(`slug=$${idx++}`);            params.push(slug); }
        if (bodyHtml   !== undefined) { const finalUrl = await saveBase64ToFileAsync(thumbnailUrl); setClauses.push(`body_html=$${idx++}`); params.push(bodyHtml); setClauses.push(`thumbnail_url=$${idx++}`); params.push(finalUrl); }
        else if (thumbnailUrl !== undefined) { const finalUrl = await saveBase64ToFileAsync(thumbnailUrl); setClauses.push(`thumbnail_url=$${idx++}`); params.push(finalUrl); }
        if (status     !== undefined) { setClauses.push(`status=$${idx++}`); params.push(status); setClauses.push(`published_at=CASE WHEN $${idx++}='published' AND published_at IS NULL THEN NOW() ELSE published_at END`); params.push(status); }
        if (contentType !== undefined) { setClauses.push(`content_type=$${idx++}`);  params.push(contentType); }
        if (mediaUrl   !== undefined) { setClauses.push(`media_url=$${idx++}`);       params.push(mediaUrl); }
        if (category   !== undefined) { setClauses.push(`category=$${idx++}`);        params.push(category); }
        // [V50.68 FIX B2] Guard: if no fields were sent, return early (prevents empty SET clause SQL error)
        if (setClauses.length === 0) return res.status(400).json({ error: "No fields to update" });
        setClauses.push(`updated_at=NOW()`);
        params.push(id);
        await pool.query(`UPDATE contents SET ${setClauses.join(', ')} WHERE id=$${idx}`, params);
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});
app.delete("/api/sales/content/:id", requireRole(['sales']), async (req, res) => {
    try { await pool.query("DELETE FROM contents WHERE id = $1", [req.params.id]); res.json({ success: true }); }
    catch (e) { res.status(500).json({ error: e.message }); }
});

// =============================================================================
// --- END V50.58 BRIDGE ENDPOINTS ---
// =============================================================================

// =============================================================================
// --- V50.59 ALIGNMENT ENDPOINTS (NEW) ---
// =============================================================================

// [V50.59 NEW #1] GET /api/user/billing
// BillingPage.tsx memanggil GET /user/billing untuk subscription history.
// Endpoint ini belum ada di v50.58. Mengembalikan snake_case rows agar
// cocok dengan Subscription type di types.ts.
app.get("/api/user/billing", async (req, res) => {
    const userId = req.headers["x-user-id"];
    const token  = req.headers["x-session-token"];
    if (!(await verifySession(userId, token, res))) return res.status(401).json({ error: "Unauthorized" });
    try {
        const r = await pool.query(
            `SELECT s.id, s.user_id, s.package_id, s.payment_method_id, s.promo_id,
                    s.status, s.amount_paid, s.start_date, s.end_date,
                    s.proof_of_payment, s.created_at, s.updated_at,
                    p.name AS package_name
             FROM subscriptions s
             JOIN packages p ON s.package_id = p.id
             WHERE s.user_id = $1
             ORDER BY s.created_at DESC`,
            [userId]
        );
        // Return raw snake_case to match Subscription type in types.ts
        res.json(r.rows);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// [V50.59 NEW #2] GET /api/sales/settings/idle-threshold
// SalesReactivate.tsx memanggil GET /sales/settings/idle-threshold untuk
// membaca threshold saat ini. v50.58 hanya punya POST untuk update.
app.get("/api/sales/settings/idle-threshold", requireRole(['sales']), async (req, res) => {
    try {
        const r = await pool.query("SELECT data FROM config WHERE id = 'app_config'");
        const idleThresholdDays = r.rows[0]?.data?.systemRules?.idleThresholdDays || 90;
        res.json({ idleThresholdDays, threshold: idleThresholdDays });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// [V50.59 NEW #3] POST /api/sales/users/:id/reactivate (ALIAS)
// SalesPromos.tsx & SalesReactivate.tsx memanggil /sales/users/:id/reactivate.
// v50.58 hanya punya /sales/users/:id/manual-reactivate. Alias ini
// forward ke handler yang sama.
app.post("/api/sales/users/:id/reactivate", requireRole(['sales']), async (req, res) => {
    const { id } = req.params;
    const { promoCode, customMessage } = req.body;
    try {
        const userRes = await pool.query("SELECT email, username FROM users WHERE id = $1", [id]);
        if (userRes.rowCount === 0) return res.status(404).json({ error: "User not found" });
        const user = userRes.rows[0];
        const html = customMessage
            || `Halo ${user.username}, kami kangen! Yuk balik ke Paydone.${promoCode ? ` Gunakan kode promo <b>${promoCode}</b> untuk diskon spesial.` : ''}`;
        await pool.query(
            "INSERT INTO email_queues (id, to_email, subject, body_html, scheduled_at) VALUES ($1, $2, $3, $4, NOW())",
            [`q-${crypto.randomUUID()}`, user.email, "Ada hadiah untukmu dari Paydone! 🎁", html]
        );
        res.json({ success: true, message: `Email reaktivasi dikirim ke ${user.email}.` });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// [V50.59 NEW #4] PUT /api/sales/promos/:id
// SalesPromos.tsx memanggil PUT /sales/promos/:id saat mengedit promo.
// Endpoint ini belum ada di v50.58 (POST hanya pakai ON CONFLICT).
// Accept snake_case AND camelCase field names.
app.put("/api/sales/promos/:id", requireRole(['sales']), async (req, res) => {
    const { id } = req.params;
    const b = req.body;
    const code               = b.code;
    const description        = b.description;
    const discountPercentage = b.discountPercentage ?? b.discount_percentage ?? 0;
    const discountNominal    = b.discountNominal    ?? b.discount_nominal    ?? 0;
    const quota              = b.quota ?? 0;
    const validUntil         = b.validUntil   ?? b.valid_until;
    const targetUserId       = b.targetUserId ?? b.target_user_id;
    const isActive           = b.isActive     ?? b.is_active ?? true;
    const imageUrl           = b.imageUrl     ?? b.image_url;
    try {
        const r = await pool.query(
            `UPDATE promos SET
                code = $1, description = $2, discount_percentage = $3,
                discount_nominal = $4, quota = $5, valid_until = $6,
                target_user_id = $7, is_active = $8, image_url = $9,
                updated_at = NOW()
             WHERE id = $10 RETURNING *`,
            [code, description, discountPercentage, discountNominal, quota,
             validUntil, targetUserId, isActive, imageUrl, id]
        );
        if (r.rowCount === 0) return res.status(404).json({ error: "Promo not found" });
        res.json({ success: true, data: r.rows[0] });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// =============================================================================
// --- END V50.59 ALIGNMENT ENDPOINTS ---
// =============================================================================

// =============================================================================
// --- V50.78 NARRATIVE TEMPLATES ENDPOINTS ---
// =============================================================================

// GET /api/narrative-templates — user auth — fetch templates for dashboard
app.get("/api/narrative-templates", verifyToken, async (req, res) => {
    try {
        const r = await pool.query("SELECT value FROM global_configs WHERE key = 'narrative_templates'");
        if (r.rows.length === 0) return res.json({ templates: [] });
        // [V50.78 FIX] global_configs.value is JSONB — pg returns it already parsed as a JS object/array.
        // JSON.parse(object) would throw SyntaxError. Use the value directly.
        const raw = r.rows[0].value;
        const templates = Array.isArray(raw) ? raw : (typeof raw === 'string' ? JSON.parse(raw) : []);
        res.json({ templates });
    } catch (e) { res.json({ templates: [] }); }
});

// POST /api/admin/narrative-templates — admin only — save/update templates
app.post("/api/admin/narrative-templates", requireAdminSecretOrRole, async (req, res) => {
    try {
        const { templates } = req.body;
        if (!Array.isArray(templates)) return res.status(400).json({ error: 'templates must be array' });
        if (templates.length === 0) return res.status(400).json({ error: 'templates cannot be empty' });
        const value = JSON.stringify(templates);
        await pool.query(
            "INSERT INTO global_configs(key, value, updated_at) VALUES('narrative_templates', $1, NOW()) ON CONFLICT(key) DO UPDATE SET value=$1, updated_at=NOW()",
            [value]
        );
        res.json({ success: true, count: templates.length });
    } catch (e) { res.status(500).json({ error: String(e) }); }
});

// --- END V50.78 NARRATIVE TEMPLATES ENDPOINTS ---
// =============================================================================

// =============================================================================
// --- SPA FALLBACK ---
// =============================================================================
app.get(/^\/.*$/, (req, res) => res.sendFile(path.join(__dirname, "dist", "index.html")));

// =============================================================================
// --- 14. SERVER START + WEBSOCKETS + CRON ---
// =============================================================================
const server = app.listen(PORT, "0.0.0.0", () => {
    console.log(`✅ Paydone V50.78 (Narrative Edition) Running on Port ${PORT}`);
});

const wss = new WebSocketServer({ server, path: '/ws', maxPayload: 10485760 });

wss.on('connection', (ws) => {
    ws.isAlive = true;
    ws.on('pong', () => { ws.isAlive = true; });
    ws.on('message', async (message) => {
        try {
            const data = JSON.parse(message);
            if (data.type === 'PING') return ws.send(JSON.stringify({ type: 'PONG', timestamp: new Date() }));
            if (data.type === 'AUTH' && data.userId && data.token) {
                if (await verifySession(data.userId, data.token)) ws.userId = data.userId;
                else ws.close(1008, "Invalid Session");
            }
        } catch (e) {}
    });
    ws.send(JSON.stringify({ type: 'WELCOME', message: 'Connected to Paydone V50.78 Narrative Edition' }));
});

const startCron = () => {
    setTimeout(async () => {

        // 1. WS Ping/Pong heartbeat
        wss.clients.forEach((ws) => {
            if (!ws.isAlive) return ws.terminate();
            ws.isAlive = false; ws.ping();
        });

        // 2. DB Maintenance
        // [V50.81 FIX] Cron Connection Leak: client.release() was inside try (not finally)
        // and catch had no ROLLBACK. If any query threw, the pool connection was never returned,
        // causing pool exhaustion over time (server hangs after ~10 cron cycles).
        let cronClient = null;
        try {
            cronClient = await pool.connect();
            await cronClient.query("BEGIN");
            const expInvoices = await cronClient.query("SELECT promo_id FROM subscriptions WHERE status = 'awaiting_payment' AND created_at < NOW() - INTERVAL '1 day'");
            for (let row of expInvoices.rows) { if (row.promo_id) await cronClient.query("UPDATE promos SET quota = quota + 1 WHERE id = $1", [row.promo_id]); }
            await cronClient.query("UPDATE subscriptions SET status = 'expired' WHERE status = 'awaiting_payment' AND created_at < NOW() - INTERVAL '1 day'");
            // [V50.77 FIX #4] Delete orphaned subscriptions BEFORE deleting unverified users
            // assignDefaultFreePackage() creates a subscription for every new user.
            // Without this, deleted users leave behind orphaned subscription records.
            await cronClient.query("DELETE FROM subscriptions WHERE user_id IN (SELECT id FROM users WHERE status = 'pending_verification' AND created_at < NOW() - INTERVAL '1 day')");
            await cronClient.query("DELETE FROM users WHERE status = 'pending_verification' AND created_at < NOW() - INTERVAL '1 day'");
            await cronClient.query("UPDATE users SET reset_token = NULL WHERE reset_token IS NOT NULL AND updated_at < NOW() - INTERVAL '1 hour'");
            await cronClient.query("DELETE FROM activity_logs WHERE created_at < NOW() - INTERVAL '30 days'");
            await cronClient.query("COMMIT");
        } catch(e) {
            // [V50.81 FIX] ROLLBACK on failure to prevent stuck transaction
            if (cronClient) await cronClient.query("ROLLBACK").catch(() => {});
            console.error("[CRON] DB Maintenance error:", e.message);
        } finally {
            // [V50.81 FIX] Always release connection back to pool
            if (cronClient) cronClient.release();
        }

        // 3. Email Queue Worker (throttled: max 10 emails per 30s cycle)
        try {
            const mailQueue = await pool.query("SELECT id, to_email, subject, body_html FROM email_queues WHERE status = 'pending' AND scheduled_at <= NOW() LIMIT 10");
            for (let mail of mailQueue.rows) {
                try {
                    await sendEmailEngine(mail.to_email, mail.subject, mail.body_html);
                    await pool.query("UPDATE email_queues SET status = 'sent' WHERE id = $1", [mail.id]);
                } catch (mailErr) {
                    // [V50.78 FIX] Mark as 'failed' so it doesn't loop forever on send errors
                    await pool.query("UPDATE email_queues SET status = 'failed' WHERE id = $1", [mail.id]).catch(() => {});
                    console.error(`[EMAIL CRON] Failed to send ${mail.id}:`, mailErr.message);
                }
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        } catch(e) {}

        startCron();
    }, 30000);
};
startCron();

// Private WS Broadcast — userId-filtered
global.broadcastWS = (data) => {
    const payload = JSON.stringify(data);
    wss.clients.forEach(client => {
        if (client.readyState === 1) {
            if (data.userId && client.userId && data.userId !== client.userId) return;
            client.send(payload);
        }
    });
};
