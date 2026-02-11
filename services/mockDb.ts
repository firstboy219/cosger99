
import { User, DebtItem, TaskItem, IncomeItem, DailyExpense, PaymentRecord, SinkingFund, Badge, ExpenseItem, DebtInstallment, SystemRules, AdvancedConfig, Ticket, QAScenario, QARunHistory, AIAgent, AppConfig } from '../types';

// This service simulates a NoSQL Database (like MongoDB) running in the browser.
// It persists data to localStorage so it survives refreshes.

const DB_NAME = 'PAYDONE_DB_V6'; // Version bump for Schema V44.22

export interface DBSchema {
  users: User[];
  debts: DebtItem[];
  debtInstallments: DebtInstallment[]; 
  incomes: IncomeItem[];
  allocations: Record<string, ExpenseItem[]>;
  tasks: TaskItem[];
  dailyExpenses: DailyExpense[];
  paymentRecords: PaymentRecord[];
  sinkingFunds: SinkingFund[]; 
  tickets: Ticket[];
  qaScenarios: QAScenario[];
  qaHistory: QARunHistory[];
  baConfigurations: { id: string; type: string; data: any; updatedAt: string }[];
  
  // V44.22 Updates
  aiAgents: AIAgent[];
  config: AppConfig; // Now strictly typed
  
  logs: any[];
}

export const availableBadges: Badge[] = [
  { id: 'b1', name: 'The Debt Destroyer', description: 'Melunasi 1 hutang lunas', icon: 'trophy', color: 'text-yellow-500' },
  { id: 'b2', name: 'Savings Ninja', description: 'Memiliki sinking fund > 10jt', icon: 'shield', color: 'text-green-500' },
  { id: 'b3', name: 'Consistent Payer', description: 'Membayar tepat waktu 3 bulan', icon: 'clock', color: 'text-blue-500' }
];

const DEFAULT_AGENTS: AIAgent[] = [
    {
        id: 'dashboard_summary',
        name: 'AI Dashboard Summary',
        description: 'Generates the personal summary at the top of the dashboard.',
        model: 'gemini-3-flash-preview',
        systemInstruction: `You are the user's financial alter-ego. 
        Analyze the provided financial data (Debt, DSR, Runway, Cashflow, Expenses).
        
        OUTPUT FORMAT:
        Return a concise, 3-sentence summary in first-person perspective ("Saya", "Aku").
        Sentence 1: Comment on the current health (DSR/Runway).
        Sentence 2: Highlight the biggest pain point or win.
        Sentence 3: Give one specific action item.
        
        TONE: Helpful, slightly informal, encouraging but realistic.`,
        updatedAt: new Date().toISOString()
    },
    {
        id: 'command_center',
        name: 'AI Command Center',
        description: 'Parses natural language inputs into system actions.',
        model: 'gemini-3-flash-preview',
        systemInstruction: `You are a financial intent parser. 
        Analyze the USER INPUT and map it to one of these intents:
        - ADD_INCOME (e.g. "Gaji masuk 5jt")
        - ADD_EXPENSE (e.g. "Beli kopi 20rb")
        - ADD_DEBT (e.g. "Hutang baru ke Budi 1jt")
        - ADD_ALLOCATION (e.g. "Budget makan 2jt")
        - PAY_DEBT (e.g. "Bayar cicilan mobil")
        
        CONTEXT DATA:
        Use provided 'debts' or 'allocations' list to match names.
        
        OUTPUT JSON ONLY:
        {
          "intent": "ADD_INCOME" | "ADD_EXPENSE" | "ADD_DEBT" | "ADD_ALLOCATION" | "PAY_DEBT" | "CLARIFICATION",
          "data": {
             "title": string,
             "amount": number,
             "category": string, (For Expenses: Food, Transport, etc. For Income: Active, Passive)
             "matchedItemId": string (For Pay Debt)
          },
          "question": "If intent is CLARIFICATION, ask here"
        }`,
        updatedAt: new Date().toISOString()
    },
    {
        id: 'debt_strategist',
        name: 'AI Debt Strategist',
        description: 'Analyzes debt portfolio and suggests payoff strategies.',
        model: 'gemini-3-pro-preview',
        systemInstruction: `Act as a Senior Financial Consultant.
        Analyze the user's debt portfolio (Interest Rates, Tenors, Principals).
        Compare Snowball vs Avalanche methods based on the data.
        Check for refinancing opportunities (if rate > 10%).
        
        Output JSON: { "text": "markdown analysis", "actions": ["step 1", "step 2"] }`,
        updatedAt: new Date().toISOString()
    },
    {
        id: 'new_user_wizard',
        name: 'New User Wizard',
        description: 'Chats with new users to collect initial data.',
        model: 'gemini-3-flash-preview',
        systemInstruction: `You are a friendly onboarding assistant for Paydone.id.
        Your goal is to extract financial numbers from conversation.
        If user says "Gaji 5 juta", extract { amount: 5000000 }.
        Handle typos and slang (Indonesian context).`,
        updatedAt: new Date().toISOString()
    },
    {
        id: 'financial_freedom',
        name: 'Financial Freedom Consultant',
        description: 'Generates business ideas and financial opportunities.',
        model: 'gemini-3-flash-preview',
        systemInstruction: 'You are a creative business consultant specializing in side hustles and investment for debt-ridden clients.',
        updatedAt: new Date().toISOString()
    },
    {
        id: 'qa_specialist',
        name: 'QA Specialist Agent',
        description: 'Generates test scenarios and parses bug reports.',
        model: 'gemini-3-flash-preview',
        systemInstruction: 'You are a Senior QA Engineer. Create comprehensive test scenarios based on route paths or bug descriptions. Output strict JSON.',
        updatedAt: new Date().toISOString()
    },
    {
        id: 'dev_auditor',
        name: 'Dev Auditor (Code Compare)',
        description: 'Analyzes code differences between Frontend and Backend.',
        model: 'gemini-3-pro-preview',
        systemInstruction: 'You are a Senior Software Architect. Analyze code snippets for logic gaps, security flaws, and consistency. Be extremely critical.',
        updatedAt: new Date().toISOString()
    },
    {
        id: 'system_utility',
        name: 'System Utility Agent',
        description: 'Handles general tasks like fetching holidays or formatting dates.',
        model: 'gemini-3-flash-preview',
        systemInstruction: 'You are a precise data utility bot. Return only requested data in JSON format.',
        updatedAt: new Date().toISOString()
    }
];

const INITIAL_DB: DBSchema = {
  users: [
    { 
      id: 'u1', username: 'admin', email: 'admin@paydone.id', role: 'admin', password: '123', 
      status: 'active', createdAt: new Date().toISOString() 
    },
    { 
      id: 'u2', username: 'user', email: 'user@paydone.id', role: 'user', password: '123', 
      status: 'active', createdAt: new Date().toISOString(),
      bigWhyUrl: 'https://images.unsplash.com/photo-1518780664697-55e3ad937233?ixlib=rb-1.2.1&auto=format&fit=crop&w=1350&q=80',
      badges: ['b1']
    }
  ],
  debts: [], 
  debtInstallments: [],
  incomes: [],
  allocations: {},
  tasks: [],
  dailyExpenses: [], 
  paymentRecords: [], 
  sinkingFunds: [
    { id: 'sf1', userId: 'u2', name: 'Pajak STNK', targetAmount: 3500000, currentAmount: 1200000, deadline: '2024-12-01', icon: 'car', color: 'bg-blue-500' },
    { id: 'sf2', userId: 'u2', name: 'Liburan Akhir Tahun', targetAmount: 15000000, currentAmount: 3500000, deadline: '2024-11-15', icon: 'plane', color: 'bg-orange-500' }
  ],
  tickets: [], 
  qaScenarios: [], 
  qaHistory: [], 
  baConfigurations: [], 
  aiAgents: DEFAULT_AGENTS, 
  config: {
    googleClientId: '417959019304-kdsk1t0rr6l9gukogsmrpavip31fj5f6.apps.googleusercontent.com', 
    backendUrl: 'https://api.cosger.online', 
    gcpSqlInstance: 'gen-lang-client-0662447520:asia-southeast2:paydone201190',
    dbUser: 'postgres',
    dbPass: 'Abasmallah_12', 
    dbName: 'paydone_db',
    appName: 'Paydone.id',
    appFont: 'Inter',
    appThemeColor: '#2563eb',
    inputBgColor: '#ffffff',
    inputTextColor: '#0f172a', 
    aiModel: 'gemini-3-flash-preview', 
    aiPersona: 'balanced',
    aiLibrary: '@google/genai',
    currentThemePreset: 'trust',
    language: 'id',
    enablePayloadPreview: true, // NEW: Enabled by default
    dashboardWidgets: [
      { id: 'w_health', type: 'health_score', visible: true },
      { id: 'w_summary', type: 'summary_cards', visible: true },
      { id: 'w_trend', type: 'trend_chart', visible: true },
      { id: 'w_ai', type: 'ai_panel', visible: true },
    ],
    systemRules: {
        provisionRate: 1.0,
        adminFeeKPR: 500000,
        adminFeeNonKPR: 250000,
        insuranceRateKPR: 2.5,
        insuranceRateNonKPR: 1.5,
        notaryFeeKPR: 1.0,
        notaryFeeNonKPR: 0.5,
        benchmarkRateKPR: 7.5,
        benchmarkRateKKB: 5.0,
        benchmarkRateKTA: 11.0,
        benchmarkRateCC: 20.0,
        refinanceGapThreshold: 2.0,
        minPrincipalForRefinance: 50000000,
        dsrSafeLimit: 30,
        dsrWarningLimit: 45,
        anomalyPercentThreshold: 40,
        anomalyMinAmount: 500000
    },
    advancedConfig: {
        syncDebounceMs: 2000,
        syncRetryAttempts: 3,
        syncStrategy: 'background',
        defaultRecurringMonths: 12,
        smartSplitNeeds: 50,
        smartSplitWants: 30,
        smartSplitDebt: 20,
        runwayAssumption: 0,
        healthScoreWeightDSR: 60,
        healthScoreWeightSavings: 40,
        aiThinkingSpeed: 800,
        incomeProjectionHorizon: 120
    },
    updatedAt: new Date().toISOString()
  },
  logs: []
};

export const getDB = (): DBSchema => {
  const stored = localStorage.getItem(DB_NAME);
  if (!stored) {
    localStorage.setItem(DB_NAME, JSON.stringify(INITIAL_DB));
    return INITIAL_DB;
  }
  const parsed = JSON.parse(stored);
  
  // Enforce the provided server URL as the source of truth (STRICT)
  const targetServerUrl = 'https://api.cosger.online';
  if (parsed.config.backendUrl !== targetServerUrl) {
      console.log(`[STRICT] Correcting Backend URL to: ${targetServerUrl}`);
      parsed.config.backendUrl = targetServerUrl;
      saveDB(parsed);
  }

  // Migration Checks
  if (!parsed.aiAgents || parsed.aiAgents.length === 0) { 
      parsed.aiAgents = DEFAULT_AGENTS; 
      saveDB(parsed); 
  }
  if (!parsed.config) {
      parsed.config = INITIAL_DB.config;
      saveDB(parsed);
  }
  
  return parsed;
};

export const saveDB = (db: DBSchema) => {
  localStorage.setItem(DB_NAME, JSON.stringify(db));
};

// Fix: Update getUserData to include tickets and other entities
export const getUserData = (userId: string) => {
  const db = getDB();
  const filteredAllocations: Record<string, ExpenseItem[]> = {};
  if (db.allocations) {
      Object.keys(db.allocations).forEach(monthKey => {
          filteredAllocations[monthKey] = db.allocations[monthKey].filter(item => item.userId === userId);
      });
  }

  return {
    debts: db.debts.filter(d => d.userId === userId),
    debtInstallments: db.debtInstallments ? db.debtInstallments.filter(d => d.userId === userId) : [],
    incomes: db.incomes ? db.incomes.filter(i => i.userId === userId) : [],
    allocations: filteredAllocations,
    tasks: db.tasks.filter(t => t.userId === userId),
    dailyExpenses: db.dailyExpenses.filter(e => e.userId === userId),
    paymentRecords: db.paymentRecords.filter(p => p.userId === userId),
    sinkingFunds: db.sinkingFunds ? db.sinkingFunds.filter(s => s.userId === userId) : [],
    // Include tickets and other entities in the return object
    tickets: db.tickets ? db.tickets.filter(t => t.userId === userId) : [],
    qaScenarios: db.qaScenarios || [],
    qaHistory: db.qaHistory || []
  };
};

const stampUpdate = <T>(items: T[]): T[] => {
    const now = new Date().toISOString();
    return items.map((item: any) => {
        return { ...item, updatedAt: now };
    });
};

// Fix: Update saveUserData to handle tickets and other entities
export const saveUserData = (
  userId: string, 
  data: { 
    debts?: DebtItem[], 
    debtInstallments?: DebtInstallment[], 
    incomes?: IncomeItem[],
    allocations?: Record<string, ExpenseItem[]>,
    tasks?: TaskItem[], 
    dailyExpenses?: DailyExpense[], 
    paymentRecords?: PaymentRecord[],
    sinkingFunds?: SinkingFund[],
    tickets?: Ticket[],
    qaScenarios?: QAScenario[],
    qaHistory?: QARunHistory[]
  }
) => {
  const db = getDB();

  const updateCollection = (collectionName: keyof DBSchema, newData: any[]) => {
      const collection = (db[collectionName] as any[]) || [];
      const others = collection.filter(item => item.userId !== userId);
      const stampedNewData = stampUpdate(newData); 
      (db[collectionName] as any) = [...others, ...stampedNewData];
  };

  if (data.debts) updateCollection('debts', data.debts);
  if (data.debtInstallments) updateCollection('debtInstallments', data.debtInstallments);
  if (data.incomes) updateCollection('incomes', data.incomes);
  if (data.tasks) updateCollection('tasks', data.tasks);
  if (data.dailyExpenses) updateCollection('dailyExpenses', data.dailyExpenses);
  if (data.paymentRecords) updateCollection('paymentRecords', data.paymentRecords);
  if (data.sinkingFunds) updateCollection('sinkingFunds', data.sinkingFunds);
  if (data.tickets) updateCollection('tickets', data.tickets);
  
  if (data.qaScenarios) db.qaScenarios = data.qaScenarios;
  if (data.qaHistory) db.qaHistory = data.qaHistory;
  
  if (data.allocations) {
      Object.keys(data.allocations).forEach(monthKey => {
          const existingOtherUsers = (db.allocations[monthKey] || []).filter(item => item.userId !== userId);
          const now = new Date().toISOString();
          const newItems = data.allocations![monthKey].map(i => ({...i, userId, updatedAt: now}));
          db.allocations[monthKey] = [...existingOtherUsers, ...newItems];
      });
  }

  saveDB(db);
};

export const purgeSoftDeletedData = (userId: string) => {
    const db = getDB();
    
    const purge = (list: any[]) => list.filter(item => !(item.userId === userId && item._deleted === true));

    db.debts = purge(db.debts);
    db.debtInstallments = purge(db.debtInstallments || []);
    db.incomes = purge(db.incomes || []);
    db.tasks = purge(db.tasks);
    db.dailyExpenses = purge(db.dailyExpenses);
    db.paymentRecords = purge(db.paymentRecords);
    db.sinkingFunds = purge(db.sinkingFunds || []);
    db.tickets = purge(db.tickets || []);
    
    if (db.allocations) {
        Object.keys(db.allocations).forEach(key => {
            db.allocations[key] = purge(db.allocations[key]);
        });
    }

    saveDB(db);
};

export const clearLocalUserData = (userId: string) => {
  const db = getDB();
  
  db.debts = db.debts.filter(d => d.userId !== userId);
  db.debtInstallments = db.debtInstallments?.filter(d => d.userId !== userId) || [];
  db.incomes = db.incomes?.filter(i => i.userId !== userId) || [];
  db.tasks = db.tasks.filter(t => t.userId !== userId);
  db.dailyExpenses = db.dailyExpenses.filter(e => e.userId !== userId);
  db.paymentRecords = db.paymentRecords.filter(p => p.userId !== userId);
  db.sinkingFunds = db.sinkingFunds?.filter(s => s.userId !== userId) || [];
  db.tickets = db.tickets?.filter(t => t.userId !== userId) || [];
  
  if (db.allocations) {
      Object.keys(db.allocations).forEach(monthKey => {
          db.allocations[monthKey] = db.allocations[monthKey].filter(item => item.userId !== userId);
      });
  }

  saveDB(db);
};

export const getAllUsers = (): User[] => { return getDB().users; };
export const addUser = (user: User) => { const db = getDB(); if (db.users.find(u => u.email === user.email)) { updateUser(user); return; } db.users.push(user); saveDB(db); };
export const updateUser = (updatedUser: User) => { const db = getDB(); db.users = db.users.map(u => u.email === updatedUser.email ? { ...u, ...updatedUser } : u); saveDB(db); };
export const deleteUser = (id: string) => { const db = getDB(); db.users = db.users.filter(u => u.id !== id); saveDB(db); }

export const migrateUserData = (oldUserId: string, newUserId: string) => {
  const db = getDB();
  const userIndex = db.users.findIndex(u => u.id === oldUserId);
  if (userIndex !== -1) db.users[userIndex].id = newUserId;

  db.debts.forEach(d => { if(d.userId === oldUserId) d.userId = newUserId; });
  if (db.debtInstallments) db.debtInstallments.forEach(d => { if(d.userId === oldUserId) d.userId = newUserId; });
  
  db.incomes.forEach(i => { if(i.userId === oldUserId) i.userId = newUserId; });
  db.tasks.forEach(t => { if(t.userId === oldUserId) t.userId = newUserId; });
  db.dailyExpenses.forEach(e => { if(e.userId === oldUserId) e.userId = newUserId; });
  db.paymentRecords.forEach(p => { if(p.userId === oldUserId) p.userId = newUserId; });
  if (db.sinkingFunds) db.sinkingFunds.forEach(s => { if(s.userId === oldUserId) s.userId = newUserId; });
  if (db.tickets) db.tickets.forEach(t => { if(t.userId === oldUserId) t.userId = newUserId; });
  
  if (db.allocations) {
      Object.values(db.allocations).forEach(list => {
          list.forEach(item => { if (item.userId === oldUserId) item.userId = newUserId; });
      });
  }
  saveDB(db);
};

export const getCollection = (collectionName: keyof DBSchema) => getDB()[collectionName];
export const saveConfig = (newConfig: Partial<AppConfig>) => { 
    const db = getDB(); 
    db.config = { ...db.config, ...newConfig, updatedAt: new Date().toISOString() }; 
    saveDB(db); 
};
export const getConfig = () => getDB().config;
export const getBackendUrl = () => getConfig().backendUrl || '';

// NEW: Agent Management (Updated V44.22)
export const getAgentConfig = (agentId: string) => {
    const db = getDB();
    return db.aiAgents.find(a => a.id === agentId) || DEFAULT_AGENTS.find(a => a.id === agentId);
};

export const saveAgentConfig = (config: AIAgent) => {
    const db = getDB();
    const now = new Date().toISOString();
    const configWithStamp = { ...config, updatedAt: now }; 
    
    const idx = db.aiAgents.findIndex(a => a.id === config.id);
    if (idx !== -1) {
        db.aiAgents[idx] = configWithStamp;
    } else {
        db.aiAgents.push(configWithStamp);
    }
    saveDB(db);
};

export const exportDBToJson = () => {
  const db = getDB();
  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(db, null, 2));
  const downloadAnchorNode = document.createElement('a');
  downloadAnchorNode.setAttribute("href", dataStr);
  downloadAnchorNode.setAttribute("download", "paydone_db_backup.json");
  document.body.appendChild(downloadAnchorNode);
  downloadAnchorNode.click();
  downloadAnchorNode.remove();
};

export const importDBFromJson = (jsonString: string) => {
  try {
    const data = JSON.parse(jsonString);
    if (data.users && data.config) { saveDB(data); return true; }
    return false;
  } catch (e) { return false; }
};