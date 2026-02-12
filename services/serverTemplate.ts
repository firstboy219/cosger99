
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
    await client.query(\`CREATE TABLE IF NOT EXISTS users (id VARCHAR(255) PRIMARY KEY, username VARCHAR(255), email VARCHAR(255), password VARCHAR(255), role VARCHAR(50), status VARCHAR(50), created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, last_login TIMESTAMP, photo_url TEXT, parent_user_id VARCHAR(255), session_token VARCHAR(255));\`);
    
    // 2. Financial Core (Debts & Installments)
    await client.query(\`CREATE TABLE IF NOT EXISTS debts (id VARCHAR(255) PRIMARY KEY, user_id VARCHAR(255), name VARCHAR(255), type VARCHAR(50), original_principal NUMERIC, total_liability NUMERIC, monthly_payment NUMERIC, remaining_principal NUMERIC, interest_rate NUMERIC, start_date DATE, end_date DATE, due_date INT, bank_name VARCHAR(100), interest_strategy VARCHAR(50), step_up_schedule JSONB, remaining_months INT, updated_at TIMESTAMP);\`);
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

    // 6. Advanced Modules (Tickets, AI Agents, QA, System Config) - NEW
    await client.query(\`CREATE TABLE IF NOT EXISTS tickets (id VARCHAR(255) PRIMARY KEY, user_id VARCHAR(255), title TEXT, description TEXT, priority VARCHAR(20), status VARCHAR(20), source VARCHAR(50), assigned_to VARCHAR(255), created_at TIMESTAMP, resolved_at TIMESTAMP, resolution_note TEXT, fix_logs JSONB, backup_data TEXT, is_rolled_back BOOLEAN, updated_at TIMESTAMP);\`);
    await client.query(\`CREATE TABLE IF NOT EXISTS ai_agents (id VARCHAR(255) PRIMARY KEY, name VARCHAR(255), description TEXT, system_instruction TEXT, model VARCHAR(100), temperature NUMERIC, updated_at TIMESTAMP);\`);
    await client.query(\`CREATE TABLE IF NOT EXISTS ba_configurations (id VARCHAR(255) PRIMARY KEY, type VARCHAR(100), data JSONB, updated_at TIMESTAMP);\`);
    await client.query(\`CREATE TABLE IF NOT EXISTS qa_scenarios (id VARCHAR(255) PRIMARY KEY, name VARCHAR(255), category VARCHAR(50), type VARCHAR(20), target TEXT, method VARCHAR(10), payload TEXT, description TEXT, expected_status INT, is_negative_case BOOLEAN, created_at TIMESTAMP, last_run TIMESTAMP, last_status VARCHAR(20), updated_at TIMESTAMP);\`);
    
    // 7. Global Config Storage
    await client.query(\`CREATE TABLE IF NOT EXISTS config (id VARCHAR(50) PRIMARY KEY, config JSONB, updated_at TIMESTAMP);\`);

    console.log("✅ Database Schema Synced with Frontend Requirements (V45.2)");
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
    
    // Basic check
    if (!userId && req.method !== 'GET') {
        // console.warn('Missing x-user-id in request'); 
    }
    next();
};

app.use(checkAuth);

// --- 3. ENDPOINTS ---

// Health Check
app.get('/api/health', (req, res) => res.json({ status: 'ok', version: 'V45.2', env: process.env.NODE_ENV || 'production' }));

// Source Code Viewer (CRITICAL for Admin Panel "Server Compare")
app.get('/api/admin/source-code', (req, res) => {
    try {
        const source = fs.readFileSync(__filename, 'utf8');
        res.set('Content-Type', 'text/plain');
        res.send(source);
    } catch (e) {
        res.status(500).send('Unable to read source code: ' + e.message);
    }
});

// Diagnostic (For Admin Panel "Database Manager")
app.get('/api/diagnostic', async (req, res) => {
    const client = await pool.connect();
    try {
        // Get Table Counts
        const tables = ['users', 'debts', 'incomes', 'daily_expenses', 'tickets', 'ai_agents', 'config'];
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

// Admin Raw SQL Execution (For SQL Studio)
app.post('/api/admin/execute-sql', async (req, res) => {
    const { sql } = req.body;
    // Security: Add specific admin secret check here in production
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

// --- 4. DATA SYNC (THE MEGA ENDPOINT) ---
// Handles partial updates for ALL entities (Frontend <-> Backend Bridge)
app.post('/api/sync', async (req, res) => {
    const { userId, ...data } = req.body;
    const client = await pool.connect();
    
    try {
        await client.query('BEGIN');

        // Universal Upsert Helper
        const upsert = async (table, items) => {
            if (!items || items.length === 0) return;
            
            // Get columns from first item, filter out frontend-only keys
            const sample = items[0];
            const keys = Object.keys(sample).filter(k => k !== '_deleted'); 
            
            for (const item of items) {
                // Map values, handle JSON objects
                const values = keys.map(k => {
                    const val = item[k];
                    if (typeof val === 'object' && val !== null) return JSON.stringify(val);
                    return val;
                });
                
                // Convert camelCase keys to snake_case for DB columns if necessary
                // Note: In this template we assume frontend keys match DB columns or mapping is handled
                // For simplicity, we use exact matching logic here (as defined in CREATE TABLE)
                const dbKeys = keys.map(k => k.replace(/([A-Z])/g, "_$1").toLowerCase()); 
                
                const placeholders = keys.map((_, i) => \`$\${i+1}\`).join(',');
                const updateSet = dbKeys.map((k, i) => \`\${k} = $\${i+1}\`).join(','); // Simple update all

                // Basic Upsert: INSERT ... ON CONFLICT (id) DO UPDATE ...
                // Note: Real prod needs robust snake_case conversion for all fields
                const q = \`INSERT INTO \${table} (\${dbKeys.join(',')}) VALUES (\${placeholders}) ON CONFLICT (id) DO UPDATE SET \${updateSet}\`;
                
                await client.query(q, values);
            }
        };

        // Execute Upserts for all known tables
        if (data.debts) await upsert('debts', data.debts);
        if (data.incomes) await upsert('incomes', data.incomes);
        if (data.dailyExpenses) await upsert('daily_expenses', data.dailyExpenses);
        if (data.debtInstallments) await upsert('debt_installments', data.debtInstallments);
        if (data.tasks) await upsert('tasks', data.tasks);
        if (data.paymentRecords) await upsert('payment_records', data.paymentRecords);
        if (data.sinkingFunds) await upsert('sinking_funds', data.sinkingFunds);
        
        // New Tables (Sync support for new features)
        if (data.tickets) await upsert('tickets', data.tickets);
        if (data.aiAgents) await upsert('ai_agents', data.aiAgents);
        if (data.qaScenarios) await upsert('qa_scenarios', data.qaScenarios);
        if (data.baConfigurations) await upsert('ba_configurations', data.baConfigurations);
        
        // Allocations Special Handling (Frontend stores by monthKey, DB is flat)
        if (data.allocations) {
            const flatAllocations = [];
            Object.keys(data.allocations).forEach(monthKey => {
                data.allocations[monthKey].forEach(item => {
                    flatAllocations.push({ ...item, monthKey: monthKey }); // camelCase for processing
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
            // Convert snake_case back to camelCase for frontend? 
            // Ideally frontend handles this, but for simplicity we return raw rows
            // Frontend 'mockDb' adapter should handle conversion if needed.
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
        const debtInstallments = await fetchTable('debt_installments');
        const tasks = await fetchTable('tasks');
        const paymentRecords = await fetchTable('payment_records');
        const sinkingFunds = await fetchTable('sinking_funds');
        
        // New Modules
        const tickets = await fetchTable('tickets', \`user_id = '\${userId}' OR user_id = 'admin'\`);
        const qaScenarios = await fetchTable('qa_scenarios', '1=1'); 
        const aiAgents = await fetchTable('ai_agents', '1=1');
        const baConfigurations = await fetchTable('ba_configurations', '1=1');

        // Allocations reconstruction
        const allocationsRaw = await fetchTable('allocations');
        const allocations = {};
        allocationsRaw.forEach(row => {
            const mKey = row.monthKey;
            if (!allocations[mKey]) allocations[mKey] = [];
            allocations[mKey].push(row);
        });

        // Config (Single global)
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
        const allowed = ['debts', 'incomes', 'daily_expenses', 'tasks', 'tickets', 'sinking_funds'];
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
`;
