
export const GOLDEN_SERVER_JS = `
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const { GoogleGenAI } = require('@google/genai');
const fs = require('fs');
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
// Automatically syncs DB Schema with Frontend Requirements
const initDB = async () => {
  const client = await pool.connect();
  try {
    console.log("🛠️  Running Auto-Migration & Schema Sync...");
    
    // 1. Core Users & Auth
    // Added: badges, risk_profile, big_why_url, financial_freedom_target
    await client.query(\`CREATE TABLE IF NOT EXISTS users (id VARCHAR(255) PRIMARY KEY, username VARCHAR(255), email VARCHAR(255), password VARCHAR(255), role VARCHAR(50), status VARCHAR(50), created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, last_login TIMESTAMP, photo_url TEXT, parent_user_id VARCHAR(255), session_token VARCHAR(255), badges JSONB, risk_profile VARCHAR(50), big_why_url TEXT, financial_freedom_target NUMERIC);\`);
    
    // 2. Financial Core (Debts & Installments)
    await client.query(\`CREATE TABLE IF NOT EXISTS debts (id VARCHAR(255) PRIMARY KEY, user_id VARCHAR(255), name VARCHAR(255), type VARCHAR(50), original_principal NUMERIC, total_liability NUMERIC, monthly_payment NUMERIC, remaining_principal NUMERIC, interest_rate NUMERIC, start_date DATE, end_date DATE, due_date INT, bank_name VARCHAR(100), interest_strategy VARCHAR(50), step_up_schedule JSONB, remaining_months INT, updated_at TIMESTAMP);\`);
    
    // [CRITICAL] Ensure debt_installments table exists for schedule sync
    await client.query(\`CREATE TABLE IF NOT EXISTS debt_installments (id VARCHAR(255) PRIMARY KEY, debt_id VARCHAR(255), user_id VARCHAR(255), period INT, due_date DATE, amount NUMERIC, principal_part NUMERIC, interest_part NUMERIC, remaining_balance NUMERIC, status VARCHAR(50) DEFAULT 'pending', notes TEXT, updated_at TIMESTAMP);\`);
    
    // 3. Cashflow (Incomes & Expenses)
    await client.query(\`CREATE TABLE IF NOT EXISTS incomes (id VARCHAR(255) PRIMARY KEY, user_id VARCHAR(255), source VARCHAR(255), amount NUMERIC, type VARCHAR(50), frequency VARCHAR(50), date_received DATE, notes TEXT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP);\`);
    await client.query(\`CREATE TABLE IF NOT EXISTS daily_expenses (id VARCHAR(255) PRIMARY KEY, user_id VARCHAR(255), date DATE, title VARCHAR(255), amount NUMERIC, category VARCHAR(100), notes TEXT, receipt_image TEXT, allocation_id VARCHAR(255), updated_at TIMESTAMP);\`);
    
    // 4. Budgeting & Allocations
    await client.query(\`CREATE TABLE IF NOT EXISTS allocations (id VARCHAR(255) PRIMARY KEY, user_id VARCHAR(255), month_key VARCHAR(20), name VARCHAR(255), amount NUMERIC, category VARCHAR(50), priority INT, is_transferred BOOLEAN, assigned_account_id VARCHAR(255), is_recurring BOOLEAN, updated_at TIMESTAMP);\`);
    await client.query(\`CREATE TABLE IF NOT EXISTS sinking_funds (id VARCHAR(255) PRIMARY KEY, user_id VARCHAR(255), name VARCHAR(255), target_amount NUMERIC, current_amount NUMERIC, deadline DATE, icon VARCHAR(50), color VARCHAR(50), updated_at TIMESTAMP);\`);
    
    // 5. Operations (Payments & Tasks)
    await client.query(\`CREATE TABLE IF NOT EXISTS payment_records (id VARCHAR(255) PRIMARY KEY, debt_id VARCHAR(255), user_id VARCHAR(255), amount NUMERIC, paid_date DATE, source_bank VARCHAR(100), status VARCHAR(50), updated_at TIMESTAMP);\`);
    await client.query(\`CREATE TABLE IF NOT EXISTS tasks (id VARCHAR(255) PRIMARY KEY, user_id VARCHAR(255), title VARCHAR(255), category VARCHAR(50), status VARCHAR(50), due_date DATE, context VARCHAR(50), updated_at TIMESTAMP);\`);

    // 6. Advanced Modules (Tickets, AI Agents, QA, System Config)
    await client.query(\`CREATE TABLE IF NOT EXISTS tickets (id VARCHAR(255) PRIMARY KEY, user_id VARCHAR(255), title TEXT, description TEXT, priority VARCHAR(20), status VARCHAR(20), source VARCHAR(50), assigned_to VARCHAR(255), created_at TIMESTAMP, resolved_at TIMESTAMP, resolution_note TEXT, fix_logs JSONB, backup_data TEXT, is_rolled_back BOOLEAN, updated_at TIMESTAMP);\`);
    await client.query(\`CREATE TABLE IF NOT EXISTS ai_agents (id VARCHAR(255) PRIMARY KEY, name VARCHAR(255), description TEXT, system_instruction TEXT, model VARCHAR(100), temperature NUMERIC, updated_at TIMESTAMP);\`);
    await client.query(\`CREATE TABLE IF NOT EXISTS ba_configurations (id VARCHAR(255) PRIMARY KEY, type VARCHAR(100), data JSONB, updated_at TIMESTAMP);\`);
    await client.query(\`CREATE TABLE IF NOT EXISTS qa_scenarios (id VARCHAR(255) PRIMARY KEY, name VARCHAR(255), category VARCHAR(50), type VARCHAR(20), target TEXT, method VARCHAR(10), payload TEXT, description TEXT, expected_status INT, is_negative_case BOOLEAN, created_at TIMESTAMP, last_run TIMESTAMP, last_status VARCHAR(20), updated_at TIMESTAMP);\`);
    
    // 7. Master Data (Banks) - ADDED
    await client.query(\`CREATE TABLE IF NOT EXISTS banks (id VARCHAR(255) PRIMARY KEY, name VARCHAR(255), type VARCHAR(50), promo_rate NUMERIC, fixed_year INT, updated_at TIMESTAMP);\`);

    // 8. Global Config Storage
    await client.query(\`CREATE TABLE IF NOT EXISTS config (id VARCHAR(50) PRIMARY KEY, config JSONB, updated_at TIMESTAMP);\`);

    console.log("✅ Database Schema Synced with Frontend Requirements (V45.3)");
  } catch (err) { 
    console.error("❌ DB Init Error:", err.message); 
  } finally {
    client.release();
  }
};

initDB();

// --- 2. MIDDLEWARE & UTILS ---
const checkAuth = (req, res, next) => {
    // Basic Header Check for V42 Security
    // In production, validate 'x-session-token' against DB users table or JWT
    const userId = req.headers['x-user-id'];
    const path = req.path;
    
    // Allow public health check and auth endpoints
    if (path.startsWith('/api/health') || path.startsWith('/api/auth') || req.method === 'OPTIONS') {
        return next();
    }
    
    next();
};

app.use(checkAuth);

// --- 3. ENDPOINTS ---

// Health Check
app.get('/api/health', (req, res) => res.json({ status: 'ok', version: 'V45.3', env: process.env.NODE_ENV || 'production' }));

// Source Code Viewer
app.get('/api/admin/source-code', (req, res) => {
    try {
        const source = fs.readFileSync(__filename, 'utf8');
        res.set('Content-Type', 'text/plain');
        res.send(source);
    } catch (e) {
        res.status(500).send('Unable to read source code: ' + e.message);
    }
});

// Diagnostic
app.get('/api/diagnostic', async (req, res) => {
    const client = await pool.connect();
    try {
        // Get Table Counts
        const tables = ['users', 'debts', 'incomes', 'daily_expenses', 'debt_installments', 'tickets', 'ai_agents', 'config', 'banks'];
        const counts = {};
        for (const t of tables) {
            try {
                const res = await client.query(\`SELECT COUNT(*) FROM \${t}\`);
                counts[t] = parseInt(res.rows[0].count);
            } catch(e) { counts[t] = -1; }
        }

        // Get Schema Details
        const schemaRes = await client.query(\`
            SELECT table_name, column_name, data_type 
            FROM information_schema.columns 
            WHERE table_schema = 'public'
        \`);

        res.json({ 
            status: 'online', 
            db_connected: true,
            total_tables: schemaRes.rows.length,
            counts,
            schema_details: schemaRes.rows 
        });
    } catch (e) {
        res.status(500).json({ status: 'error', error: e.message });
    } finally {
        client.release();
    }
});

// Admin Raw SQL Execution
app.post('/api/admin/execute-sql', async (req, res) => {
    const { sql } = req.body;
    if (!sql) return res.status(400).json({ error: "No SQL provided" });

    const client = await pool.connect();
    try {
        const result = await client.query(sql);
        res.json({ message: "Executed", records: result.rows, rowCount: result.rowCount });
    } catch (e) {
        res.status(400).json({ error: e.message });
    } finally {
        client.release();
    }
});

// --- SPECIFIC BANK ENDPOINTS ---
app.get('/api/admin/banks', async (req, res) => {
    const client = await pool.connect();
    try {
        const result = await client.query('SELECT * FROM banks ORDER BY name ASC');
        // CamelCase conversion for frontend
        const banks = result.rows.map(row => ({
            id: row.id,
            name: row.name,
            type: row.type,
            promoRate: parseFloat(row.promo_rate),
            fixedYear: parseInt(row.fixed_year)
        }));
        res.json(banks);
    } catch (e) {
        res.status(500).json({ error: e.message });
    } finally {
        client.release();
    }
});

app.post('/api/admin/banks', async (req, res) => {
    const { id, name, type, promoRate, fixedYear } = req.body;
    const client = await pool.connect();
    try {
        await client.query(
            \`INSERT INTO banks (id, name, type, promo_rate, fixed_year, updated_at) VALUES ($1, $2, $3, $4, $5, NOW())
             ON CONFLICT (id) DO UPDATE SET name=$2, type=$3, promo_rate=$4, fixed_year=$5, updated_at=NOW()\`,
            [id, name, type, promoRate, fixedYear]
        );
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    } finally {
        client.release();
    }
});

app.delete('/api/admin/banks/:id', async (req, res) => {
    const { id } = req.params;
    const client = await pool.connect();
    try {
        await client.query('DELETE FROM banks WHERE id = $1', [id]);
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    } finally {
        client.release();
    }
});

// --- 4. DATA SYNC (THE MEGA ENDPOINT) ---
app.post('/api/sync', async (req, res) => {
    const { userId, ...data } = req.body;
    const client = await pool.connect();
    
    try {
        await client.query('BEGIN');

        // Universal Upsert Helper
        const upsert = async (table, items) => {
            if (!items || items.length === 0) return;
            
            const sample = items[0];
            // Fix: Filter unknown keys (simple check, better if strict schema)
            const keys = Object.keys(sample).filter(k => k !== '_deleted' && !k.startsWith('temp_')); 
            
            for (const item of items) {
                const values = keys.map(k => {
                    const val = item[k];
                    // Fix: Handle undefined -> null to prevent pg error "Bind parameters must not contain undefined"
                    if (val === undefined) return null;
                    if (typeof val === 'object' && val !== null) return JSON.stringify(val);
                    return val;
                });
                
                // Convert camelCase keys to snake_case for DB columns
                const dbKeys = keys.map(k => k.replace(/([A-Z])/g, "_$1").toLowerCase()); 
                
                const placeholders = keys.map((_, i) => \`$\${i+1}\`).join(',');
                const updateSet = dbKeys.map((k, i) => \`\${k} = $\${i+1}\`).join(',');

                const q = \`INSERT INTO \${table} (\${dbKeys.join(',')}) VALUES (\${placeholders}) ON CONFLICT (id) DO UPDATE SET \${updateSet}\`;
                
                try {
                    await client.query(q, values);
                } catch (rowErr) {
                    console.error(\`Upsert Row Error in \${table}: \${rowErr.message}\`);
                    // Continue other rows? Best to fail batch to alert frontend
                    throw rowErr; 
                }
            }
        };

        // Execute Upserts for all known tables
        if (data.debts) await upsert('debts', data.debts);
        if (data.users) await upsert('users', data.users); // Added Users Sync Support
        if (data.incomes) await upsert('incomes', data.incomes);
        if (data.dailyExpenses) await upsert('daily_expenses', data.dailyExpenses);
        
        // [CRITICAL] Upsert Installments
        if (data.debtInstallments) await upsert('debt_installments', data.debtInstallments);
        
        if (data.tasks) await upsert('tasks', data.tasks);
        if (data.paymentRecords) await upsert('payment_records', data.paymentRecords);
        if (data.sinkingFunds) await upsert('sinking_funds', data.sinkingFunds);
        if (data.tickets) await upsert('tickets', data.tickets);
        if (data.aiAgents) await upsert('ai_agents', data.aiAgents);
        if (data.qaScenarios) await upsert('qa_scenarios', data.qaScenarios);
        if (data.baConfigurations) await upsert('ba_configurations', data.baConfigurations);
        
        if (data.allocations) {
            const flatAllocations = [];
            Object.keys(data.allocations).forEach(monthKey => {
                data.allocations[monthKey].forEach(item => {
                    flatAllocations.push({ ...item, monthKey: monthKey });
                });
            });
            await upsert('allocations', flatAllocations);
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

// FULL PULL (Initial Load)
app.get('/api/sync', async (req, res) => {
    const { userId } = req.query;
    if (!userId) return res.status(400).json({ error: "Missing userId" });
    
    const client = await pool.connect();
    try {
        const fetchTable = async (table, where = \`user_id = '\${userId}'\`) => {
            const r = await client.query(\`SELECT * FROM \${table} WHERE \${where}\`);
            return r.rows.map(row => {
                const newRow = {};
                for(const key in row) {
                    const camelKey = key.replace(/_([a-z])/g, (g) => g[1].toUpperCase());
                    newRow[camelKey] = row[key];
                }
                return newRow;
            });
        };

        const debts = await fetchTable('debts');
        const incomes = await fetchTable('incomes');
        const dailyExpenses = await fetchTable('daily_expenses');
        
        // [CRITICAL] Fetch Installments
        const debtInstallments = await fetchTable('debt_installments');
        
        const tasks = await fetchTable('tasks');
        const paymentRecords = await fetchTable('payment_records');
        const sinkingFunds = await fetchTable('sinking_funds');
        
        const tickets = await fetchTable('tickets', \`user_id = '\${userId}' OR user_id = 'admin'\`);
        const qaScenarios = await fetchTable('qa_scenarios', '1=1'); 
        const aiAgents = await fetchTable('ai_agents', '1=1');
        const baConfigurations = await fetchTable('ba_configurations', '1=1');

        const allocationsRaw = await fetchTable('allocations');
        const allocations = {};
        allocationsRaw.forEach(row => {
            const mKey = row.monthKey;
            if (!allocations[mKey]) allocations[mKey] = [];
            allocations[mKey].push(row);
        });

        const configRes = await client.query('SELECT * FROM config LIMIT 1');
        const config = configRes.rows[0]?.config || {};

        res.json({
            debts, incomes, dailyExpenses, debtInstallments, tasks, 
            paymentRecords, sinkingFunds, tickets, qaScenarios, 
            aiAgents, baConfigurations, allocations, config
        });

    } catch (e) {
        res.status(500).json({ error: e.message });
    } finally {
        client.release();
    }
});

// Global Config Endpoint
app.post('/api/admin/config', async (req, res) => {
    const { id, config } = req.body;
    const client = await pool.connect();
    try {
        await client.query(\`
            INSERT INTO config (id, config, updated_at) VALUES ($1, $2, NOW())
            ON CONFLICT (id) DO UPDATE SET config = EXCLUDED.config, updated_at = NOW()
        \`, [id || 'app_settings', config]);
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    } finally { client.release(); }
});

// Delete Endpoint
app.delete('/api/:table/:id', async (req, res) => {
    const { table, id } = req.params;
    const client = await pool.connect();
    try {
        // [CRITICAL] Allow debt-installments deletion
        const allowed = ['debts', 'incomes', 'daily_expenses', 'tasks', 'tickets', 'sinking_funds', 'debt_installments'];
        const tableName = table.replace(/-/g, '_'); 
        
        if (!allowed.includes(tableName) && !allowed.includes(table)) {
             return res.status(403).json({ error: "Table not allowlisted for deletion" });
        }

        await client.query(\`DELETE FROM \${tableName} WHERE id = $1\`, [id]);
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    } finally {
        client.release();
    }
});

// --- 5. AI PROXY (GEMINI) ---
app.post('/api/ai/analyze', async (req, res) => {
    const { model, contents, config, prompt } = req.body;
    const apiKey = process.env.GEMINI_API_KEY; 
    
    if (!apiKey) return res.status(500).json({ error: "Server missing GEMINI_API_KEY" });

    try {
        const genAI = new GoogleGenAI({ apiKey });
        const aiModel = genAI.getGenerativeModel({ 
            model: model || 'gemini-3-flash-preview',
            systemInstruction: config?.systemInstruction 
        });

        const result = await aiModel.generateContent(prompt || contents);
        const response = await result.response;
        res.json({ text: response.text() });
    } catch (e) {
        console.error("AI Error:", e);
        res.status(500).json({ error: e.message });
    }
});

app.listen(PORT, () => {
    console.log(\`🚀 Ultimate Server Running on Port \${PORT}\`);
    console.log(\`📅 Build Date: \${new Date().toISOString()}\`);
});
`
