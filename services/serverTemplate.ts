
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
    
    client.release();
    console.log("✅ Granular DB Initialized");
  } catch (err) { console.error("❌ DB Init Error:", err.message); }
};

initDB();

app.get('/api/health', (req, res) => res.status(200).json({ status: 'ok' }));

// --- NEW: GRANULAR DELETE ---
app.delete('/api/sync/:table/:id', async (req, res) => {
    const { table, id } = req.params;
    const userId = req.headers['x-user-id'];
    if (!userId) return res.status(400).json({ error: "Missing x-user-id header" });

    const allowedTables = ['debts', 'debt_installments', 'incomes', 'daily_expenses', 'payment_records', 'sinking_funds', 'tasks'];
    if (!allowedTables.includes(table)) return res.status(403).json({ error: "Table access forbidden" });

    const client = await pool.connect();
    try {
        const query = \`DELETE FROM \${table} WHERE id = $1 AND user_id = $2\`;
        await client.query(query, [id, userId]);
        res.json({ success: true, id });
    } catch (e) {
        res.status(500).json({ error: e.message });
    } finally {
        client.release();
    }
});

// --- ENHANCED: GRANULAR UPSERT SYNC ---
app.post('/api/sync', async (req, res) => {
    const { userId, debts, debtInstallments, incomes, dailyExpenses, tasks, sinkingFunds } = req.body;
    if (!userId) return res.status(400).json({ error: "Missing userId" });
    
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        if (debts) {
            for (const d of debts) {
                await client.query(\`
                    INSERT INTO debts (id, user_id, name, type, original_principal, monthly_payment, remaining_principal, interest_rate, start_date, end_date, due_date, interest_strategy, step_up_schedule)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
                    ON CONFLICT (id) DO UPDATE SET 
                        name = EXCLUDED.name, remaining_principal = EXCLUDED.remaining_principal, 
                        monthly_payment = EXCLUDED.monthly_payment, interest_rate = EXCLUDED.interest_rate
                \`, [d.id, userId, d.name, d.type, d.originalPrincipal, d.monthlyPayment, d.remainingPrincipal, d.interestRate, d.startDate, d.endDate, d.dueDate, d.interestStrategy, JSON.stringify(d.stepUpSchedule)]);
            }
        }

        if (dailyExpenses) {
            for (const e of dailyExpenses) {
                await client.query(\`
                    INSERT INTO daily_expenses (id, user_id, date, title, amount, category, notes, allocation_id)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                    ON CONFLICT (id) DO UPDATE SET 
                        title = EXCLUDED.title, amount = EXCLUDED.amount, category = EXCLUDED.category
                \`, [e.id, userId, e.date, e.title, e.amount, e.category, e.notes, e.allocationId]);
            }
        }

        if (debtInstallments) {
            for (const inst of debtInstallments) {
                await client.query(\`
                    INSERT INTO debt_installments (id, debt_id, user_id, period, due_date, amount, principal_part, interest_part, remaining_balance, status, notes)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
                    ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status, notes = EXCLUDED.notes
                \`, [inst.id, inst.debtId, userId, inst.period, inst.dueDate, inst.amount, inst.principalPart, inst.interestPart, inst.remainingBalance, inst.status, inst.notes]);
            }
        }

        if (incomes) {
            for (const inc of incomes) {
                await client.query(\`
                    INSERT INTO incomes (id, user_id, source, amount, type, frequency, date_received, notes)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                    ON CONFLICT (id) DO UPDATE SET amount = EXCLUDED.amount, source = EXCLUDED.source
                \`, [inc.id, userId, inc.source, inc.amount, inc.type, inc.frequency, inc.dateReceived, inc.notes]);
            }
        }

        await client.query('COMMIT');
        res.json({ success: true, message: "Partial sync complete" });
    } catch (e) {
        await client.query('ROLLBACK');
        res.status(500).json({ error: e.message });
    } finally {
        client.release();
    }
});

// FULL PULL (FOR INITIAL LOAD)
app.get('/api/sync', async (req, res) => {
    const { userId } = req.query;
    if (!userId) return res.status(400).json({ error: "Missing userId" });
    const client = await pool.connect();
    try {
        const debts = await client.query('SELECT * FROM debts WHERE user_id = $1', [userId]);
        const incomes = await client.query('SELECT * FROM incomes WHERE user_id = $1', [userId]);
        const expenses = await client.query('SELECT * FROM daily_expenses WHERE user_id = $1', [userId]);
        const installments = await client.query('SELECT * FROM debt_installments WHERE user_id = $1', [userId]);
        
        res.json({
            debts: debts.rows.map(r => ({ ...r, originalPrincipal: Number(r.original_principal), monthlyPayment: Number(r.monthly_payment), remainingPrincipal: Number(r.remaining_principal), interestRate: Number(r.interest_rate) })),
            incomes: incomes.rows.map(r => ({ ...r, amount: Number(r.amount) })),
            dailyExpenses: expenses.rows.map(r => ({ ...r, amount: Number(r.amount) })),
            debtInstallments: installments.rows.map(r => ({ ...r, amount: Number(r.amount), debtId: r.debt_id }))
        });
    } catch (e) { res.status(500).json({ error: e.message }); } finally { client.release(); }
});

app.listen(PORT, () => console.log('🚀 Granular Server running on ' + PORT));
`;
