import { 
  User, DebtItem, IncomeItem, ExpenseItem, DailyExpense, 
  TaskItem, PaymentRecord, LogItem, AppConfig, AIAgent, 
  Ticket, QAScenario, DebtInstallment, SinkingFund, Badge,
  BankData, SystemRules, AdvancedConfig, BankAccount,
  FreemiumPackage, PaymentMethod, Promo, Subscription, AppNotification,
  SubscriptionStatus, ActiveFeatures, Content, Lead, ClientTelemetry
} from '../types';

export interface DBSchema {
  users: User[];
  config: AppConfig;
  debts: DebtItem[];
  incomes: IncomeItem[];
  dailyExpenses: DailyExpense[];
  tasks: TaskItem[];
  paymentRecords: PaymentRecord[];
  logs: LogItem[];
  aiAgents: AIAgent[];
  tickets: Ticket[];
  qaScenarios: QAScenario[];
  debtInstallments: DebtInstallment[];
  allocations: ExpenseItem[]; // Used for flat array storage if needed
  sinkingFunds: SinkingFund[];
  banks: BankData[];
  bankAccounts: BankAccount[]; // NEW
  baConfigurations?: any[];
  // V50.34 Freemium tables
  packages: FreemiumPackage[];
  paymentMethods: PaymentMethod[];
  promos: Promo[];
  subscriptions: Subscription[];
  notifications: AppNotification[];
  // V50.35 TAHAP 1: New tables
  contents: Content[];
  leads: Lead[];
  clientTelemetry: ClientTelemetry[];
  // Computed freemium state (hydrated from sync)
  activeFeatures?: ActiveFeatures;
  subscriptionStatus?: SubscriptionStatus;
  // Map for user-specific data that might not be flat in this simple mock
  userData?: Record<string, UserData>; 
}

export interface UserData {
  debts: DebtItem[];
  incomes: IncomeItem[];
  dailyExpenses: DailyExpense[];
  tasks: TaskItem[];
  paymentRecords: PaymentRecord[];
  allocations: Record<string, ExpenseItem[]>; // Month Key -> Expenses
  sinkingFunds: SinkingFund[];
  debtInstallments: DebtInstallment[];
  bankAccounts: BankAccount[]; // NEW
}

const STORAGE_KEY = 'paydone_db_v45';

const DEFAULT_SYSTEM_RULES: SystemRules = {
    provisionRate: 1,
    adminFeeKPR: 500000,
    adminFeeNonKPR: 250000,
    insuranceRateKPR: 2.5,
    insuranceRateNonKPR: 1.5,
    notaryFeeKPR: 1,
    notaryFeeNonKPR: 0.5,
    benchmarkRateKPR: 7.5,
    benchmarkRateKKB: 5,
    benchmarkRateKTA: 11,
    benchmarkRateCC: 20,
    refinanceGapThreshold: 2,
    minPrincipalForRefinance: 50000000,
    dsrSafeLimit: 30,
    dsrWarningLimit: 45,
    anomalyPercentThreshold: 40,
    anomalyMinAmount: 500000
};

const DEFAULT_ADVANCED_CONFIG: AdvancedConfig = {
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
};

const DEFAULT_CONFIG: AppConfig = {
  appName: 'Paydone.id',
  appDescription: 'Financial Cockpit',
  appThemeColor: 'brand',
  language: 'id',
  systemRules: DEFAULT_SYSTEM_RULES,
  advancedConfig: DEFAULT_ADVANCED_CONFIG
};

export const availableBadges: Badge[] = [
  { id: 'b1', name: 'The Debt Destroyer', description: 'Melunasi 1 hutang lunas', icon: 'trophy', color: 'text-yellow-500' },
  { id: 'b2', name: 'Savings Ninja', description: 'Memiliki sinking fund lebih dari 10jt', icon: 'shield', color: 'text-green-500' },
  { id: 'b3', name: 'Consistent Payer', description: 'Membayar tepat waktu 3 bulan', icon: 'clock', color: 'text-blue-500' }
];

export const getDB = (): DBSchema => {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    const initialDB: DBSchema = {
      users: [],
      config: DEFAULT_CONFIG,
      userData: {},
      aiAgents: [],
      tickets: [],
      qaScenarios: [],
      logs: [],
      banks: [],
      debts: [],
      incomes: [],
      dailyExpenses: [],
      tasks: [],
      paymentRecords: [],
      debtInstallments: [],
      allocations: [],
      sinkingFunds: [],
      bankAccounts: [],
      baConfigurations: [],
      packages: [],
      paymentMethods: [],
      promos: [],
      subscriptions: [],
      notifications: [],
      // V50.35 TAHAP 1: Initialize new tables
      contents: [],
      leads: [],
      clientTelemetry: []
    };
    saveDB(initialDB);
    return initialDB;
  }
  return JSON.parse(raw);
};

export const saveDB = (db: DBSchema) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
  // Dispatch event for reactive updates across tabs/components
  window.dispatchEvent(new Event('PAYDONE_DB_UPDATE'));
};

// --- CONFIG ---
export const getConfig = (): AppConfig => {
  const db = getDB();
  return { ...DEFAULT_CONFIG, ...db.config };
};

export const saveConfig = (newConfig: Partial<AppConfig>) => {
  const db = getDB();
  db.config = { ...db.config, ...newConfig };
  saveDB(db);
  window.dispatchEvent(new Event('PAYDONE_CONFIG_UPDATE'));
};

export const getBackendUrl = () => getConfig().backendUrl || '';

// --- USER MANAGEMENT ---
export const getAllUsers = (): User[] => {
  return getDB().users || [];
};

export const addUser = (user: User) => {
  const db = getDB();
  if (!db.users) db.users = [];
  // Ensure timestamps
  const newUser = {
      ...user,
      createdAt: user.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
  };
  db.users.push(newUser);
  saveDB(db);
};

export const updateUser = (user: User) => {
  const db = getDB();
  if (!db.users) return;
  // Automatically update 'updatedAt' field
  const updatedUser = { ...user, updatedAt: new Date().toISOString() };
  db.users = db.users.map((u: User) => u.id === user.id ? updatedUser : u);
  saveDB(db);
};

export const deleteUser = (id: string) => {
  const db = getDB();
  if (!db.users) return;
  db.users = db.users.filter((u: User) => u.id !== id);
  if (db.userData && db.userData[id]) {
      delete db.userData[id];
  }
  saveDB(db);
};

// --- USER DATA ---
const getInitialUserData = (): UserData => ({
  debts: [],
  incomes: [],
  dailyExpenses: [],
  tasks: [],
  paymentRecords: [],
  allocations: {},
  sinkingFunds: [],
  debtInstallments: [],
  bankAccounts: []
});

export const getUserData = (userId: string): UserData => {
  const db = getDB();
  if (!db.userData) db.userData = {};
  if (!db.userData[userId]) {
    db.userData[userId] = getInitialUserData();
    saveDB(db);
  }
  return db.userData[userId];
};

export const saveUserData = (userId: string, data: Partial<UserData>) => {
  const db = getDB();
  if (!db.userData) db.userData = {};
  const current = db.userData[userId] || getInitialUserData();
  db.userData[userId] = { ...current, ...data };
  saveDB(db);
};

export const migrateUserData = () => {
    // Placeholder for migration logic
    console.log("Migration check complete");
};

// --- AI AGENTS ---
export const getAgentConfig = (agentId: string): AIAgent | undefined => {
    const db = getDB();
    return (db.aiAgents || []).find((a: AIAgent) => a.id === agentId);
};

export const saveAgentConfig = (agent: AIAgent) => {
    const db = getDB();
    if (!db.aiAgents) db.aiAgents = [];
    const idx = db.aiAgents.findIndex((a: AIAgent) => a.id === agent.id);
    if (idx >= 0) {
        db.aiAgents[idx] = agent;
    } else {
        db.aiAgents.push(agent);
    }
    saveDB(db);
};
