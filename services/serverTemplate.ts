
export const GOLDEN_SERVER_JS = `
const express = require('express');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const crypto = require('crypto');
const { GoogleGenAI } = require('@google/genai'); 
const { Pool } = require('pg');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 8080;

app.use(cors());
app.use(express.json({ limit: '50mb' }));

const dbConfig = { 
    user: process.env.DB_USER, 
    password: process.env.DB_PASS, 
    database: process.env.DB_NAME 
};

if (process.env.INSTANCE_UNIX_SOCKET) { 
    dbConfig.host = process.env.INSTANCE_UNIX_SOCKET; 
} else { 
    dbConfig.host = '127.0.0.1'; 
}

const pool = new Pool(dbConfig);

const toISODate = (dateVal) => {
    if (!dateVal) return null;
    try {
        if (typeof dateVal === 'string') {
            if (dateVal.includes('T')) return dateVal.split('T')[0];
            if (dateVal.match(/^\\d{4}-\\d{2}-\\d{2}/)) return dateVal.substring(0, 10);
            return null;
        }
        if (dateVal instanceof Date) return dateVal.toISOString().split('T')[0];
        return null;
    } catch (e) { return null; }
};

const getSystemConfig = async (client) => {
    try {
        const res = await client.query("SELECT data FROM sync_data WHERE collection_name = 'app_settings' LIMIT 1");
        if (res.rows.length > 0 && res.rows[0].data?.gemini_api_key) {
            return res.rows[0].data.gemini_api_key;
        }
    } catch(e) { console.error("Config Fetch Error", e); }
    return process.env.GEMINI_API_KEY; 
};

const initDB = async () => {
  try {
    const client = await pool.connect();
    console.log("🛠️ Initializing Tables...");
    
    await client.query(\`CREATE TABLE IF NOT EXISTS users (id VARCHAR(255) PRIMARY KEY, username VARCHAR(255), email VARCHAR(255), password VARCHAR(255), role VARCHAR(50), status VARCHAR(50), created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, last_login TIMESTAMP, photo_url TEXT, parent_user_id VARCHAR(255), session_token VARCHAR(255));\`);
    await client.query(\`CREATE TABLE IF NOT EXISTS debts (id VARCHAR(255) PRIMARY KEY, user_id VARCHAR(255), name VARCHAR(255), type VARCHAR(50), original_principal NUMERIC, total_liability NUMERIC, monthly_payment NUMERIC, remaining_principal NUMERIC, interest_rate NUMERIC, start_date DATE, end_date DATE, due_date INT, bank_name VARCHAR(100), interest_strategy VARCHAR(50), step_up_schedule JSONB);\`);
    await client.query(\`CREATE TABLE IF NOT EXISTS debt_installments (id VARCHAR(255) PRIMARY KEY, debt_id VARCHAR(255), user_id VARCHAR(255), period INT, due_date DATE, amount NUMERIC, principal_part NUMERIC, interest_part NUMERIC, remaining_balance NUMERIC, status VARCHAR(50) DEFAULT 'pending', notes TEXT);\`);
    await client.query(\`CREATE TABLE IF NOT EXISTS incomes (id VARCHAR(255) PRIMARY KEY, user_id VARCHAR(255), source VARCHAR(255), amount NUMERIC, type VARCHAR(50), frequency VARCHAR(50), date_received DATE, notes TEXT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);\`);
    await client.query(\`CREATE TABLE IF NOT EXISTS daily_expenses (id VARCHAR(255) PRIMARY KEY, user_id VARCHAR(255), date DATE, title VARCHAR(255), amount NUMERIC, category VARCHAR(100), notes TEXT, receipt_image TEXT, allocation_id VARCHAR(255));\`);
    await client.query(\`CREATE TABLE IF NOT EXISTS payment_records (id VARCHAR(255) PRIMARY KEY, debt_id VARCHAR(255), user_id VARCHAR(255), amount NUMERIC, paid_date DATE, source_bank VARCHAR(100), status VARCHAR(50));\`);
    await client.query(\`CREATE TABLE IF NOT EXISTS sinking_funds (id VARCHAR(255) PRIMARY KEY, user_id VARCHAR(255), name VARCHAR(255), target_amount NUMERIC, current_amount NUMERIC, deadline DATE, icon VARCHAR(50), color VARCHAR(50));\`);
    await client.query(\`CREATE TABLE IF NOT EXISTS tasks (id VARCHAR(255) PRIMARY KEY, user_id VARCHAR(255), title VARCHAR(255), category VARCHAR(50), status VARCHAR(50), due_date DATE, context VARCHAR(50));\`);
    await client.query(\`CREATE TABLE IF NOT EXISTS sync_data (id SERIAL PRIMARY KEY, collection_name VARCHAR(50) UNIQUE, data JSONB, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);\`);
    await client.query(\`CREATE TABLE IF NOT EXISTS ai_agents (id VARCHAR(255) PRIMARY KEY, name VARCHAR(255), description TEXT, model VARCHAR(100), system_instruction TEXT, temperature NUMERIC, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);\`);
    await client.query(\`CREATE TABLE IF NOT EXISTS tickets (id VARCHAR(255) PRIMARY KEY, title VARCHAR(255), description TEXT, priority VARCHAR(50), status VARCHAR(50), source VARCHAR(50), created_at TIMESTAMP, resolved_at TIMESTAMP, resolution_note TEXT, fix_logs TEXT, backup_data TEXT, is_rolled_back BOOLEAN, user_id VARCHAR(255));\`);
    await client.query(\`CREATE TABLE IF NOT EXISTS banks (id VARCHAR(255) PRIMARY KEY, name VARCHAR(255), type VARCHAR(50), promo_rate NUMERIC, fixed_year INT);\`);
    await client.query(\`CREATE TABLE IF NOT EXISTS qa_scenarios (id VARCHAR(255) PRIMARY KEY, name VARCHAR(255), category VARCHAR(50), type VARCHAR(50), target VARCHAR(255), method VARCHAR(10), payload TEXT, description TEXT, expected_status INT, is_negative_case BOOLEAN, created_at TIMESTAMP, last_run TIMESTAMP, last_status VARCHAR(50));\`);
    await client.query(\`CREATE TABLE IF NOT EXISTS qa_history (id VARCHAR(255) PRIMARY KEY, scenario_id VARCHAR(255), timestamp TIMESTAMP, status VARCHAR(50), result_message TEXT, duration_ms INT);\`);
    await client.query(\`CREATE TABLE IF NOT EXISTS ba_configurations (id VARCHAR(255) PRIMARY KEY, type VARCHAR(50), data JSONB, updated_at TIMESTAMP);\`);

    client.release();
    console.log("✅ All Tables Initialized");
  } catch (err) { console.error("❌ DB Init Error:", err.message); }
};

initDB();

app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/health', (req, res) => res.status(200).json({ status: 'ok', timestamp: new Date() }));

// --- UPGRADED DIAGNOSTICS: PHYSICAL PROOF V46 ---
app.get('/api/diagnostic', async (req, res) => {
    const client = await pool.connect();
    try {
        const tableSchema = await client.query("SELECT table_name, column_name, data_type FROM information_schema.columns WHERE table_schema = 'public'");
        
        // Fetch Row Counts for each table
        const tables = [...new Set(tableSchema.rows.map(r => r.table_name))];
        const rowCounts = {};
        for (const table of tables) {
            const countRes = await client.query(\`SELECT COUNT(*) FROM \${table}\`);
            rowCounts[table] = parseInt(countRes.rows[0].count);
        }

        const schema = {};
        tableSchema.rows.forEach(row => {
            if (!schema[row.table_name]) schema[row.table_name] = [];
            schema[row.table_name].push({ name: row.column_name, type: row.data_type });
        });

        res.json({ schema, rowCounts, dbTime: new Date() });
    } catch (e) {
        res.status(500).json({ error: e.message });
    } finally {
        client.release();
    }
});

// --- NEW: RAW SAMPLE FOR PROOF ---
app.get('/api/admin/raw-sample/:table', async (req, res) => {
    const { table } = req.params;
    const client = await pool.connect();
    try {
        const result = await client.query(\`SELECT * FROM \${table} LIMIT 3\`);
        res.json({ table, records: result.rows });
    } catch (e) {
        res.status(500).json({ error: e.message });
    } finally {
        client.release();
    }
});

app.post('/api/admin/execute-sql', async (req, res) => {
    const { sql } = req.body;
    if (!sql) return res.status(400).json({ error: "No SQL provided" });
    const client = await pool.connect();
    try {
        await client.query(sql);
        res.json({ message: "SQL Executed Successfully" });
    } catch (e) {
        res.status(500).json({ error: e.message });
    } finally {
        client.release();
    }
});

app.post('/api/auth/google', async (req, res) => {
    const { user } = req.body; 
    if (!user || !user.email) return res.status(400).json({error: "Invalid user payload"});
    const client = await pool.connect();
    try {
        const sessionToken = crypto.randomUUID();
        const check = await client.query('SELECT * FROM users WHERE email = $1', [user.email]);
        let dbUser;
        if (check.rows.length > 0) {
            dbUser = check.rows[0];
            await client.query('UPDATE users SET session_token = $1, last_login = NOW(), photo_url = $2 WHERE id = $3', [sessionToken, user.photoURL, dbUser.id]);
        } else {
            const newId = user.uid || \`u-g-\${Date.now()}\`;
            await client.query('INSERT INTO users (id, username, email, role, status, created_at, last_login, photo_url, session_token) VALUES ($1, $2, $3, $4, $5, NOW(), NOW(), $6, $7)', [newId, user.displayName, user.email, 'user', 'active', user.photoURL, sessionToken]);
            dbUser = { id: newId, username: user.displayName, email: user.email, role: 'user', status: 'active' };
        }
        res.json({ user: { ...dbUser, sessionToken } });
    } catch(e) { res.status(500).json({error: e.message}); } finally { client.release(); }
});

app.post('/api/auth/login', async (req, res) => {
    const { email, password } = req.body; 
    const client = await pool.connect();
    try {
        const result = await client.query('SELECT * FROM users WHERE (email = $1 OR username = $1) AND password = $2', [email, password]);
        if (result.rows.length > 0) {
            const user = result.rows[0];
            const sessionToken = crypto.randomUUID();
            await client.query('UPDATE users SET session_token = $1, last_login = NOW() WHERE id = $2', [sessionToken, user.id]);
            res.json({ user: { ...user, sessionToken } });
        } else { res.status(401).json({ error: "Invalid credentials" }); }
    } catch (e) { res.status(500).json({ error: e.message }); } finally { client.release(); }
});

app.get('/api/sync', async (req, res) => {
    const { userId } = req.query;
    if (!userId) return res.status(400).json({ error: "Missing userId" });
    const client = await pool.connect();
    try {
        const safeQuery = async (query, params) => { try { return await client.query(query, params); } catch(e) { return { rows: [] }; } };
        const users = await safeQuery('SELECT * FROM users WHERE id = $1', [userId]); 
        const debts = await safeQuery('SELECT * FROM debts WHERE user_id = $1', [userId]); 
        const installments = await safeQuery('SELECT * FROM debt_installments WHERE user_id = $1', [userId]); 
        const incomes = await safeQuery('SELECT * FROM incomes WHERE user_id = $1', [userId]); 
        const expenses = await safeQuery('SELECT * FROM daily_expenses WHERE user_id = $1', [userId]); 
        const tasks = await safeQuery('SELECT * FROM tasks WHERE user_id = $1', [userId]); 
        const funds = await safeQuery('SELECT * FROM sinking_funds WHERE user_id = $1', [userId]); 
        const payments = await safeQuery('SELECT * FROM payment_records WHERE user_id = $1', [userId]); 
        const tickets = await safeQuery('SELECT * FROM tickets', []);
        const aiAgents = await safeQuery('SELECT * FROM ai_agents', []);
        const appSettings = await safeQuery("SELECT data FROM sync_data WHERE collection_name = 'app_settings' LIMIT 1", []);
        
        res.json({ 
            users: users.rows, 
            debts: debts.rows.map(d => ({ ...d, userId: d.user_id, originalPrincipal: Number(d.original_principal), monthlyPayment: Number(d.monthly_payment), remainingPrincipal: Number(d.remaining_principal), interestRate: Number(d.interest_rate), startDate: toISODate(d.start_date), endDate: toISODate(d.end_date) })), 
            debtInstallments: installments.rows.map(i => ({ ...i, debtId: i.debt_id, userId: i.user_id, dueDate: toISODate(i.due_date), amount: Number(i.amount) })), 
            incomes: incomes.rows.map(i => ({ ...i, userId: i.user_id, amount: Number(i.amount), dateReceived: toISODate(i.date_received) })), 
            dailyExpenses: expenses.rows.map(e => ({ ...e, userId: e.user_id, amount: Number(e.amount), date: toISODate(e.date) })), 
            tasks: tasks.rows.map(t => ({ ...t, userId: t.user_id, dueDate: toISODate(t.due_date) })), 
            sinkingFunds: funds.rows.map(s => ({ ...s, userId: s.user_id, targetAmount: Number(s.target_amount), currentAmount: Number(s.current_amount), deadline: toISODate(s.deadline) })), 
            paymentRecords: payments.rows.map(p => ({ ...p, userId: p.user_id, debtId: p.debt_id, amount: Number(p.amount), paidDate: toISODate(p.paid_date) })), 
            tickets: tickets.rows,
            aiAgents: aiAgents.rows,
            appSettings: appSettings.rows.length > 0 ? appSettings.rows[0].data : null
        }); 
    } catch (e) { res.status(500).json({ error: e.message }); } finally { client.release(); }
});

app.post('/api/sync', async (req, res) => {
    const { users, debts, debtInstallments, incomes, dailyExpenses, paymentRecords, sinkingFunds, tasks, aiAgents, tickets } = req.body;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        if (users) for (const u of users) await client.query(\`INSERT INTO users (id, username, email, role, status, created_at, last_login, photo_url, session_token) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) ON CONFLICT (id) DO UPDATE SET last_login = EXCLUDED.last_login, photo_url = EXCLUDED.photo_url\`, [u.id, u.username, u.email, u.role, u.status, u.createdAt, u.lastLogin, u.photoUrl, u.sessionToken]);
        if (debts) for (const d of debts) await client.query(\`INSERT INTO debts (id, user_id, name, type, original_principal, monthly_payment, remaining_principal, interest_rate, start_date, end_date, due_date) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) ON CONFLICT (id) DO UPDATE SET remaining_principal = EXCLUDED.remaining_principal\`, [d.id, d.userId, d.name, d.type, d.originalPrincipal, d.monthlyPayment, d.remainingPrincipal, d.interestRate, d.startDate, d.endDate, d.dueDate]);
        if (incomes) for (const i of incomes) await client.query(\`INSERT INTO incomes (id, user_id, source, amount, type, frequency, date_received) VALUES ($1, $2, $3, $4, $5, $6, $7) ON CONFLICT (id) DO UPDATE SET amount = EXCLUDED.amount\`, [i.id, i.userId, i.source, i.amount, i.type, i.frequency, i.dateReceived]);
        if (dailyExpenses) for (const e of dailyExpenses) await client.query(\`INSERT INTO daily_expenses (id, user_id, date, title, amount, category) VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (id) DO UPDATE SET amount = EXCLUDED.amount\`, [e.id, e.userId, e.date, e.title, e.amount, e.category]);
        await client.query('COMMIT');
        res.json({ message: "Sync Success" });
    } catch (e) { await client.query('ROLLBACK'); res.status(500).json({ error: e.message }); } finally { client.release(); }
});

app.get('/api/admin/users', async (req, res) => {
    const client = await pool.connect();
    try {
        const r = await client.query(\`SELECT u.*, COALESCE((SELECT SUM(remaining_principal) FROM debts WHERE user_id = u.id), 0) as total_debt, COALESCE((SELECT SUM(amount) FROM incomes WHERE user_id = u.id), 0) as total_income FROM users u\`);
        res.json(r.rows.map(u => ({ ...u, totalDebt: Number(u.total_debt), totalIncome: Number(u.total_income) })));
    } catch (e) { res.status(500).json({ error: e.message }); } finally { client.release(); }
});

app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.listen(PORT, () => console.log('🚀 Paydone Backend running on port ' + PORT));
`;
