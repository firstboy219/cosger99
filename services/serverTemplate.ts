
export const GOLDEN_SERVER_JS = `
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const { GoogleGenAI } = require('@google/genai');
const fs = require('fs');
const { exec } = require('child_process'); 
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 8080;

// Enable CORS and Large Payload
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Database Config
const dbConfig = { 
    user: process.env.DB_USER, 
    password: process.env.DB_PASS, 
    database: process.env.DB_NAME,
    host: process.env.INSTANCE_UNIX_SOCKET || '127.0.0.1'
};

const pool = new Pool(dbConfig);

// --- 1. INITIALIZATION & SCHEMA MIGRATION ---
const initDB = async () => {
  const client = await pool.connect();
  try {
    console.log("🛠️  Running Auto-Migration & Schema Sync...");
    
    // Core Tables - Added _deleted column support
    await client.query(\`CREATE TABLE IF NOT EXISTS users (id VARCHAR(255) PRIMARY KEY, username VARCHAR(255), email VARCHAR(255), password VARCHAR(255), role VARCHAR(50), status VARCHAR(50), created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, last_login TIMESTAMP, photo_url TEXT, parent_user_id VARCHAR(255), session_token VARCHAR(255), badges JSONB, risk_profile VARCHAR(50), big_why_url TEXT, financial_freedom_target NUMERIC, _deleted BOOLEAN DEFAULT FALSE);\`);
    
    // Updated Debts Table
    await client.query(\`CREATE TABLE IF NOT EXISTS debts (id VARCHAR(255) PRIMARY KEY, user_id VARCHAR(255), name VARCHAR(255), type VARCHAR(50), original_principal NUMERIC, total_liability NUMERIC, monthly_payment NUMERIC, remaining_principal NUMERIC, interest_rate NUMERIC, start_date DATE, end_date DATE, due_date INT, bank_name VARCHAR(100), interest_strategy VARCHAR(50), step_up_schedule JSONB, remaining_months INT, payoff_method VARCHAR(50), allocated_extra_budget NUMERIC, current_saved_amount NUMERIC, early_settlement_discount NUMERIC, updated_at TIMESTAMP, _deleted BOOLEAN DEFAULT FALSE);\`);
    
    await client.query(\`CREATE TABLE IF NOT EXISTS debt_installments (id VARCHAR(255) PRIMARY KEY, debt_id VARCHAR(255), user_id VARCHAR(255), period INT, due_date DATE, amount NUMERIC, principal_part NUMERIC, interest_part NUMERIC, remaining_balance NUMERIC, status VARCHAR(50) DEFAULT 'pending', notes TEXT, updated_at TIMESTAMP, _deleted BOOLEAN DEFAULT FALSE);\`);
    await client.query(\`CREATE TABLE IF NOT EXISTS incomes (id VARCHAR(255) PRIMARY KEY, user_id VARCHAR(255), source VARCHAR(255), amount NUMERIC, type VARCHAR(50), frequency VARCHAR(50), date_received DATE, notes TEXT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP, _deleted BOOLEAN DEFAULT FALSE);\`);
    await client.query(\`CREATE TABLE IF NOT EXISTS daily_expenses (id VARCHAR(255) PRIMARY KEY, user_id VARCHAR(255), date DATE, title VARCHAR(255), amount NUMERIC, category VARCHAR(100), notes TEXT, receipt_image TEXT, allocation_id VARCHAR(255), updated_at TIMESTAMP, _deleted BOOLEAN DEFAULT FALSE);\`);
    await client.query(\`CREATE TABLE IF NOT EXISTS allocations (id VARCHAR(255) PRIMARY KEY, user_id VARCHAR(255), month_key VARCHAR(20), name VARCHAR(255), amount NUMERIC, category VARCHAR(50), priority INT, is_transferred BOOLEAN, assigned_account_id VARCHAR(255), is_recurring BOOLEAN, updated_at TIMESTAMP, _deleted BOOLEAN DEFAULT FALSE);\`);
    
    // Updated Sinking Funds Table
    await client.query(\`CREATE TABLE IF NOT EXISTS sinking_funds (id VARCHAR(255) PRIMARY KEY, user_id VARCHAR(255), name VARCHAR(255), target_amount NUMERIC, current_amount NUMERIC, deadline DATE, icon VARCHAR(50), color VARCHAR(50), category VARCHAR(50), priority VARCHAR(50), assigned_account_id VARCHAR(255), updated_at TIMESTAMP, _deleted BOOLEAN DEFAULT FALSE);\`);
    
    await client.query(\`CREATE TABLE IF NOT EXISTS payment_records (id VARCHAR(255) PRIMARY KEY, debt_id VARCHAR(255), user_id VARCHAR(255), amount NUMERIC, paid_date DATE, source_bank VARCHAR(100), status VARCHAR(50), updated_at TIMESTAMP, _deleted BOOLEAN DEFAULT FALSE);\`);
    await client.query(\`CREATE TABLE IF NOT EXISTS tasks (id VARCHAR(255) PRIMARY KEY, user_id VARCHAR(255), title VARCHAR(255), category VARCHAR(50), status VARCHAR(50), due_date DATE, context VARCHAR(50), updated_at TIMESTAMP, _deleted BOOLEAN DEFAULT FALSE);\`);
    await client.query(\`CREATE TABLE IF NOT EXISTS tickets (id VARCHAR(255) PRIMARY KEY, user_id VARCHAR(255), title TEXT, description TEXT, priority VARCHAR(20), status VARCHAR(20), source VARCHAR(50), assigned_to VARCHAR(255), created_at TIMESTAMP, resolved_at TIMESTAMP, resolution_note TEXT, fix_logs JSONB, backup_data TEXT, is_rolled_back BOOLEAN, updated_at TIMESTAMP, _deleted BOOLEAN DEFAULT FALSE);\`);
    await client.query(\`CREATE TABLE IF NOT EXISTS ai_agents (id VARCHAR(255) PRIMARY KEY, name VARCHAR(255), description TEXT, system_instruction TEXT, model VARCHAR(100), temperature NUMERIC, updated_at TIMESTAMP, _deleted BOOLEAN DEFAULT FALSE);\`);
    await client.query(\`CREATE TABLE IF NOT EXISTS ba_configurations (id VARCHAR(255) PRIMARY KEY, type VARCHAR(100), data JSONB, updated_at TIMESTAMP, _deleted BOOLEAN DEFAULT FALSE);\`);
    await client.query(\`CREATE TABLE IF NOT EXISTS qa_scenarios (id VARCHAR(255) PRIMARY KEY, name VARCHAR(255), category VARCHAR(50), type VARCHAR(20), target TEXT, method VARCHAR(10), payload TEXT, description TEXT, expected_status INT, is_negative_case BOOLEAN, created_at TIMESTAMP, last_run TIMESTAMP, last_status VARCHAR(20), updated_at TIMESTAMP, _deleted BOOLEAN DEFAULT FALSE);\`);
    await client.query(\`CREATE TABLE IF NOT EXISTS banks (id VARCHAR(255) PRIMARY KEY, name VARCHAR(255), type VARCHAR(50), promo_rate NUMERIC, fixed_year INT, updated_at TIMESTAMP, _deleted BOOLEAN DEFAULT FALSE);\`);
    await client.query(\`CREATE TABLE IF NOT EXISTS bank_accounts (id VARCHAR(255) PRIMARY KEY, user_id VARCHAR(255), bank_name VARCHAR(255), account_number VARCHAR(100), holder_name VARCHAR(255), balance NUMERIC, color VARCHAR(50), type VARCHAR(50), updated_at TIMESTAMP, _deleted BOOLEAN DEFAULT FALSE);\`);
    await client.query(\`CREATE TABLE IF NOT EXISTS config (id VARCHAR(50) PRIMARY KEY, config JSONB, updated_at TIMESTAMP, _deleted BOOLEAN DEFAULT FALSE);\`);

    // --- AUTO-MIGRATION (Schema Evolution) ---
    // Safely add columns if they don't exist (for existing databases)
    const safeAlter = async (table, col, type) => {
        try { await client.query(\`ALTER TABLE \${table} ADD COLUMN IF NOT EXISTS \${col} \${type}\`); } 
        catch (e) { console.log(\`Migration Ignored: \${table}.\${col}\`); }
    };

    // V45+ Migrations
    await safeAlter('sinking_funds', 'category', 'VARCHAR(50)');
    await safeAlter('sinking_funds', 'priority', 'VARCHAR(50)');
    await safeAlter('sinking_funds', 'assigned_account_id', 'VARCHAR(255)');
    
    // DEBT TABLE MIGRATION
    await safeAlter('debts', 'payoff_method', 'VARCHAR(50)');
    await safeAlter('debts', 'allocated_extra_budget', 'NUMERIC');
    await safeAlter('debts', 'current_saved_amount', 'NUMERIC');
    await safeAlter('debts', 'early_settlement_discount', 'NUMERIC');
    // QA FIX: Add missing columns for StepUp logic
    await safeAlter('debts', 'interest_strategy', 'VARCHAR(50)');
    await safeAlter('debts', 'step_up_schedule', 'JSONB');

    console.log("✅ Database Schema V49.5 Synced (Migration Active)");
  } catch (err) { 
    console.error("❌ DB Init Error:", err.message); 
  } finally {
    client.release();
  }
};

initDB();

// --- 2. MIDDLEWARE ---
const checkAuth = (req, res, next) => {
    // Simple bypass for public or shell commands which handle their own auth
    if (req.path.startsWith('/api/health') || req.path.startsWith('/api/auth') || req.path.startsWith('/api/admin/shell') || req.method === 'OPTIONS') {
        return next();
    }
    // Strict mode for other routes
    // if (!req.headers['x-session-token']) return res.status(401).json({error: "Unauthorized"});
    next();
};
app.use(checkAuth);

// --- 3. GENERIC CRUD HANDLER (The Engine) ---
const handleCrud = async (req, res) => {
    const table = req.params.resource.replace(/-/g, '_'); // Convert hyphen-case to snake_case
    const id = req.params.id;
    const body = req.body;
    
    const client = await pool.connect();
    
    try {
        if (req.method === 'GET') {
            const query = id 
                ? \`SELECT * FROM \${table} WHERE id = $1\` 
                : \`SELECT * FROM \${table} WHERE _deleted IS NOT TRUE\`;
            const result = await client.query(query, id ? [id] : []);
            
            // Transform snake_case keys back to CamelCase for frontend
            const transformed = result.rows.map(row => {
                const newRow = {};
                for(const key in row) newRow[key.replace(/_([a-z])/g, (g) => g[1].toUpperCase())] = row[key];
                return newRow;
            });
            
            if (id && transformed.length === 0) return res.status(404).json({error: "Not Found"});
            res.json(id ? transformed[0] : transformed);
        }
        else if (req.method === 'POST' || req.method === 'PUT') {
            const keys = Object.keys(body).filter(k => k !== '_deleted');
            const values = keys.map(k => {
                const val = body[k];
                if (val === undefined) return null;
                if (typeof val === 'object' && val !== null) return JSON.stringify(val);
                return val;
            });
            
            const dbKeys = keys.map(k => k.replace(/([A-Z])/g, "_$1").toLowerCase()); 
            const placeholders = keys.map((_, i) => \`$\${i+1}\`).join(',');
            const updateSet = dbKeys.map((k, i) => \`\${k} = $\${i+1}\`).join(',');
            
            // UPSERT Logic
            const query = \`INSERT INTO \${table} (\${dbKeys.join(',')}) VALUES (\${placeholders}) 
                           ON CONFLICT (id) DO UPDATE SET \${updateSet} RETURNING *\`;
            
            const result = await client.query(query, values);
            
            // Transform single result
            const row = result.rows[0];
            const newRow = {};
            for(const key in row) newRow[key.replace(/_([a-z])/g, (g) => g[1].toUpperCase())] = row[key];
            
            res.json(newRow);
        }
        else if (req.method === 'DELETE') {
            // Soft Delete if possible, else Hard Delete
            try {
                await client.query(\`UPDATE \${table} SET _deleted = TRUE WHERE id = $1\`, [id]);
            } catch {
                await client.query(\`DELETE FROM \${table} WHERE id = $1\`, [id]);
            }
            res.json({ success: true, id });
        }
    } catch (e) {
        console.error(\`CRUD Error \${table}:\`, e.message);
        res.status(500).json({ error: e.message });
    } finally {
        client.release();
    }
};

// --- 4. ROUTES ---

// Generic Resources
app.get('/api/:resource', handleCrud);
app.get('/api/:resource/:id', handleCrud);
app.post('/api/:resource', handleCrud);
app.put('/api/:resource/:id', handleCrud);
app.delete('/api/:resource/:id', handleCrud);

// Admin & System
app.post('/api/admin/shell', async (req, res) => {
    const { cmd, secret } = req.body;
    if (secret !== 'gen-lang-client-066244752') return res.status(403).json({ error: "Forbidden" });
    
    exec(cmd, { timeout: 60000, maxBuffer: 1024 * 1024 * 5 }, (error, stdout, stderr) => {
        res.json({ 
            success: !error, 
            output: stdout || stderr || (error ? error.message : ''), 
            error: error ? error.message : null 
        });
    });
});

app.get('/api/admin/versions', (req, res) => {
    fs.readdir('.', (err, files) => {
        if(err) return res.status(500).json({ error: err.message });
        const versions = files
            .filter(f => f.endsWith('.js') || f.endsWith('.cjs'))
            .map(f => ({ filename: f, isActive: f === 'server.js', size: fs.statSync(f).size }));
        res.json({ versions });
    });
});

app.post('/api/admin/files/create', (req, res) => {
    const { filename, content } = req.body;
    try { fs.writeFileSync(filename, content); res.json({ success: true }); }
    catch(e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/health', (req, res) => res.json({ status: 'ok', version: 'V49.0', mode: 'Universal' }));

app.get('/api/admin/server-time', (req, res) => {
    res.json({ 
        serverTime: new Date().toISOString(),
        timestamp: Date.now(),
        timezoneOffset: new Date().getTimezoneOffset()
    });
});

app.get('/api/admin/source-code', (req, res) => {
    try { res.set('Content-Type', 'text/plain').send(fs.readFileSync(__filename, 'utf8')); } 
    catch (e) { res.status(500).send('Source unreadable'); }
});

app.post('/api/admin/execute-sql', async (req, res) => {
    const { sql } = req.body;
    const client = await pool.connect();
    try {
        const result = await client.query(sql);
        res.json({ message: "Executed", records: result.rows, rowCount: result.rowCount });
    } catch (e) { res.status(400).json({ error: e.message }); }
    finally { client.release(); }
});

// Sync Endpoint (Batch)
app.post('/api/sync', async (req, res) => {
    const { userId, ...data } = req.body;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const upsert = async (table, items) => {
            if (!items || items.length === 0) return;
            const sample = items[0];
            const keys = Object.keys(sample).filter(k => k !== '_deleted' && !k.startsWith('temp_')); 
            for (const item of items) {
                const values = keys.map(k => {
                    const val = item[k];
                    if (val === undefined) return null;
                    if (typeof val === 'object' && val !== null) return JSON.stringify(val);
                    return val;
                });
                const dbKeys = keys.map(k => k.replace(/([A-Z])/g, "_$1").toLowerCase()); 
                const placeholders = keys.map((_, i) => \`$\${i+1}\`).join(',');
                const updateSet = dbKeys.map((k, i) => \`\${k} = $\${i+1}\`).join(',');
                await client.query(\`INSERT INTO \${table} (\${dbKeys.join(',')}) VALUES (\${placeholders}) ON CONFLICT (id) DO UPDATE SET \${updateSet}\`, values);
            }
        };

        if (data.debts) await upsert('debts', data.debts);
        if (data.users) await upsert('users', data.users);
        if (data.incomes) await upsert('incomes', data.incomes);
        if (data.dailyExpenses) await upsert('daily_expenses', data.dailyExpenses);
        if (data.debtInstallments) await upsert('debt_installments', data.debtInstallments);
        if (data.tasks) await upsert('tasks', data.tasks);
        if (data.paymentRecords) await upsert('payment_records', data.paymentRecords);
        if (data.sinkingFunds) await upsert('sinking_funds', data.sinkingFunds);
        if (data.tickets) await upsert('tickets', data.tickets);
        if (data.aiAgents) await upsert('ai_agents', data.aiAgents);
        if (data.qaScenarios) await upsert('qa_scenarios', data.qaScenarios);
        if (data.baConfigurations) await upsert('ba_configurations', data.baConfigurations);
        if (data.banks) await upsert('banks', data.banks);
        if (data.bankAccounts) await upsert('bank_accounts', data.bankAccounts);
        
        if (data.allocations) {
            const flat = [];
            Object.keys(data.allocations).forEach(k => data.allocations[k].forEach(i => flat.push({...i, monthKey: k})));
            await upsert('allocations', flat);
        }

        await client.query('COMMIT');
        res.json({ success: true });
    } catch (e) {
        await client.query('ROLLBACK');
        console.error("Sync Error", e);
        res.status(500).json({ error: e.message });
    } finally {
        client.release();
    }
});

// Full Pull
app.get('/api/sync', async (req, res) => {
    const { userId } = req.query;
    if (!userId) return res.status(400).json({ error: "Missing userId" });
    const client = await pool.connect();
    try {
        const fetchTable = async (table, where = \`user_id = '\${userId}'\`) => {
            const r = await client.query(\`SELECT * FROM \${table} WHERE \${where} AND (_deleted IS NULL OR _deleted = FALSE)\`);
            return r.rows.map(row => {
                const newRow = {};
                for(const key in row) newRow[key.replace(/_([a-z])/g, (g) => g[1].toUpperCase())] = row[key];
                return newRow;
            });
        };
        const debts = await fetchTable('debts');
        const incomes = await fetchTable('incomes');
        const dailyExpenses = await fetchTable('daily_expenses');
        const debtInstallments = await fetchTable('debt_installments');
        const tasks = await fetchTable('tasks');
        const paymentRecords = await fetchTable('payment_records');
        const sinkingFunds = await fetchTable('sinking_funds');
        const tickets = await fetchTable('tickets', \`user_id = '\${userId}' OR user_id = 'admin'\`);
        const banks = await fetchTable('banks', '1=1');
        const bankAccounts = await fetchTable('bank_accounts');
        
        const allocationsRaw = await fetchTable('allocations');
        const allocations = {};
        allocationsRaw.forEach(r => { if(!allocations[r.monthKey]) allocations[r.monthKey]=[]; allocations[r.monthKey].push(r); });

        const configRes = await client.query('SELECT * FROM config LIMIT 1');
        res.json({ debts, incomes, dailyExpenses, debtInstallments, tasks, paymentRecords, sinkingFunds, tickets, banks, bankAccounts, allocations, config: configRes.rows[0]?.config || {} });
    } catch (e) {
        res.status(500).json({ error: e.message });
    } finally {
        client.release();
    }
});

app.post('/api/ai/analyze', async (req, res) => {
    const { model, contents, prompt } = req.body;
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return res.status(500).json({ error: "No API Key" });
    try {
        const genAI = new GoogleGenAI({ apiKey });
        const aiModel = genAI.getGenerativeModel({ model: model || 'gemini-3-flash-preview' });
        const result = await aiModel.generateContent(prompt || contents);
        res.json({ text: result.response.text() });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.listen(PORT, () => {
    console.log(\`🚀 Paydone V49 Server Running on Port \${PORT}\`);
});
`;
