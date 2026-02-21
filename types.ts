export enum LoanType {
  KPR = 'KPR',
  KKB = 'KKB', // Kendaraan
  KTA = 'KTA', // Tanpa Agunan
  CC = 'Kartu Kredit'
}

// --- BASE INTERFACE FOR SYNC ---
export interface SyncMetadata {
  _deleted?: boolean;
  updatedAt?: string; // ISO String
}

export interface BankData extends SyncMetadata {
  id: string;
  name: string;
  promoRate: number;
  fixedYear: number;
  type: 'KPR' | 'KKB' | 'KTA';
}

// NEW: Bank Account Entity
export interface BankAccount extends SyncMetadata {
  id: string;
  userId: string;
  bankName: string;
  accountNumber: string;
  holderName: string;
  balance: number;
  color: string; // Hex or tailwind class
  type: 'Bank' | 'E-Wallet' | 'Cash';
}

// NEW: AI Agent Configuration (V44.22)
export interface AIAgent extends SyncMetadata {
  id: string; // e.g., 'agent_summary', 'agent_command'
  name: string;
  description: string;
  systemInstruction: string; // The prompt
  model: string; // gemini-1.5-flash, etc.
  temperature?: number;
}

// NEW: App Configuration (V44.22)
export interface AppConfig extends SyncMetadata {
    // Identity
    googleClientId?: string;
    googleClientSecret?: string;
    appleClientId?: string;
    
    // Branding & Identity (NEW)
    appName?: string;
    appDescription?: string; // Slogan
    appLogoUrl?: string;
    appDomain?: string;
    appFaviconUrl?: string;

    // API Keys
    geminiApiKey?: string;
    midtransServerKey?: string;
    
    // Backend
    backendUrl?: string;
    sourceCodeUrl?: string;
    
    // Database Tools Config (NEW)
    diagnosticUrl?: string; // Link to API Diagnostic
    apiCaseConvention?: 'snake_case' | 'camelCase'; // API Communication Style
    enablePayloadPreview?: boolean; // NEW: Feature toggle for users to see data before sync
    
    gcpProjectId?: string;
    gcpRegion?: string;
    gcpSqlInstance?: string;
    dbUser?: string;
    dbPass?: string;
    dbName?: string;
    
    // Appearance
    appFont?: string;
    appThemeColor?: string;
    inputBgColor?: string;
    inputTextColor?: string;
    currentThemePreset?: string;
    language?: string;
    dashboardWidgets?: { id: string; type: string; visible: boolean }[];
    
    // AI
    aiModel?: string; 
    aiPersona?: 'conservative' | 'balanced' | 'aggressive' | 'ruthless';
    aiSystemInstruction?: string; 
    aiLibrary?: '@google/genai' | '@google/generative-ai'; 
    
    // Announcement
    globalAnnouncement?: string; 
    globalAnnouncementType?: 'info' | 'warning' | 'alert';
    
    // Nested Logic
    systemRules?: SystemRules; 
    advancedConfig?: AdvancedConfig; 
}

export interface Ticket {
  id: string;
  // Add userId to Ticket interface to support sync
  userId?: string;
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  status: 'open' | 'in_progress' | 'resolved' | 'wont_fix';
  source: 'qa_auto' | 'manual' | 'user_report';
  assignedTo?: string;
  createdAt: string;
  resolvedAt?: string;
  resolutionNote?: string;
  fixLogs?: string[]; 
  isRolledBack?: boolean;
  backupData?: string; 
}

export interface QAScenario {
  id: string;
  name: string;
  category: 'AUTH' | 'DASHBOARD' | 'DEBT' | 'INCOME' | 'EXPENSE' | 'SYSTEM' | 'UX';
  type: 'ui' | 'backend';
  target: string; 
  method?: 'GET' | 'POST' | 'DELETE' | 'PUT';
  payload?: string;
  description: string;
  expectedStatus?: number;
  isNegativeCase?: boolean;
  createdAt: string;
  lastRun?: string;
  lastStatus?: 'pass' | 'fail';
}

export interface QARunHistory {
  id: string;
  scenarioId: string;
  timestamp: string;
  status: 'pass' | 'fail';
  resultMessage: string;
  durationMs: number;
}

export interface AdvancedConfig {
  syncDebounceMs: number; 
  syncRetryAttempts: number; 
  syncStrategy: 'background' | 'manual_only'; 

  defaultRecurringMonths: number; 
  smartSplitNeeds: number; 
  smartSplitWants: number; 
  smartSplitDebt: number; 
  
  runwayAssumption: number; 
  healthScoreWeightDSR: number; 
  healthScoreWeightSavings: number; 
  
  aiThinkingSpeed: number; 
  incomeProjectionHorizon: number; 
}

export interface FeatureFlags {
    enableGamification: boolean;
    enableFamilyMode: boolean;
    enableCryptoWallet: boolean; 
    enableStrictBudgeting: boolean; 
    betaDashboard: boolean;
}

export interface SystemRules {
  provisionRate: number; 
  adminFeeKPR: number;
  adminFeeNonKPR: number;
  insuranceRateKPR: number; 
  insuranceRateNonKPR: number; 
  notaryFeeKPR: number; 
  notaryFeeNonKPR: number; 
  
  benchmarkRateKPR: number;
  benchmarkRateKKB: number;
  benchmarkRateKTA: number;
  benchmarkRateCC: number;
  refinanceGapThreshold: number; 
  minPrincipalForRefinance: number;

  dsrSafeLimit: number; 
  dsrWarningLimit: number; 
  
  anomalyPercentThreshold: number; 
  anomalyMinAmount: number; 

  features?: FeatureFlags;
}

export interface User {
  id: string;
  username: string;
  email: string;
  password?: string; 
  role: 'admin' | 'user';
  status: 'active' | 'pending_verification' | 'inactive';
  lastLogin?: string; 
  parentUserId?: string | null; 
  createdAt: string;
  updatedAt?: string; // NEW: Track profile updates
  photoUrl?: string; 
  sessionToken?: string; 
  
  riskProfile?: 'Conservative' | 'Moderate' | 'Aggressive';
  bigWhyUrl?: string; 
  financialFreedomTarget?: number; 
  badges?: string[]; 
  
  // Analytics Fields (Admin Dashboard)
  totalDebt?: number;
  totalIncome?: number;
  monthlyObligation?: number;
}

export interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
}

export interface SinkingFund extends SyncMetadata {
  id: string;
  userId: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  deadline: string;
  icon: string;
  color: string;
  
  // New Fields
  category?: 'Emergency' | 'Holiday' | 'Gadget' | 'Vehicle' | 'Education' | 'Other';
  priority?: 'Low' | 'Medium' | 'High';
  assignedAccountId?: string; // Link to BankAccount
}

export interface StepUpRange {
  startMonth: number;
  endMonth: number;
  amount: number;
}

export interface DebtItem extends SyncMetadata {
  id: string;
  userId: string; 
  name: string;
  type: LoanType;
  originalPrincipal: number; 
  totalLiability: number; 
  startDate: string; 
  endDate: string; 
  dueDate: number; 
  
  monthlyPayment: number; 
  remainingPrincipal: number; 
  interestRate: number; 
  remainingMonths: number;
  monthsPassed?: number;
  
  bankName?: string;
  createdAt?: string; 

  interestStrategy?: 'Fixed' | 'StepUp' | 'Annuity';
  stepUpSchedule?: StepUpRange[];

  payoffMethod?: 'direct_extra' | 'sinking_fund'; 
  allocatedExtraBudget?: number; 
  currentSavedAmount?: number; 
  earlySettlementDiscount?: number; 
}

export interface DebtInstallment extends SyncMetadata {
  id: string;
  debtId: string;
  userId: string;
  period: number; 
  dueDate: string; 
  amount: number;
  principalPart: number;
  interestPart: number;
  remainingBalance: number;
  status: 'pending' | 'paid' | 'overdue';
  notes?: string; 
}

export interface IncomeItem extends SyncMetadata {
  id: string;
  userId: string; 
  source: string;
  amount: number;
  type: 'active' | 'passive' | 'windfall'; 
  frequency: 'monthly' | 'one-time';
  dateReceived?: string;
  endDate?: string; // NEW: For stopping recurring incomes
  notes?: string;
  createdAt?: string; // NEW: Track creation date
}

export interface ExpenseItem extends SyncMetadata {
  id: string;
  userId: string; 
  name: string;
  amount: number;
  category: 'needs' | 'wants' | 'debt';
  assignedAccountId: string | null;
  priority: number;
  isTransferred: boolean; 
  debtId?: string; 
  isRecurring?: boolean; 
  monthKey?: string;
  
  // NEW FIELDS
  percentage?: number; 
  icon?: string;
  color?: string;
}

export interface DailyExpense extends SyncMetadata {
  id: string;
  userId: string; 
  date: string; 
  title: string;
  amount: number;
  category: 'Food' | 'Transport' | 'Shopping' | 'Utilities' | 'Entertainment' | 'Others';
  notes?: string;
  receiptImage?: string; 
  allocationId?: string; 
  sinkingFundId?: string; // NEW: Link to sinking fund
}

export interface SimulationInput {
  assetPrice: number;
  downPaymentPercent: number;
  interestRate: number;
  tenorYears: number;
  loanType: LoanType;
}

export interface SimulationResult {
  loanAmount: number;
  monthlyPayment: number;
  upfrontCosts: {
    downPayment: number;
    provision: number;
    adminFee: number;
    insurance: number;
    notary: number;
    totalUpfront: number;
  };
  schedule: Array<{
    month: number;
    principal: number;
    interest: number;
    balance: number;
  }>;
}

export interface AnalysisResponse {
  strategy: string;
  advice: string;
  savingsPotential: number;
}

export interface TaskItem extends SyncMetadata {
  id: string;
  userId: string; 
  title: string;
  category: 'Administration' | 'Payment' | 'Negotiation' | 'Investment' | 'Business';
  status: 'pending' | 'completed';
  dueDate?: string;
  context?: 'Debt Acceleration' | 'Financial Freedom' | 'Routine Bill' | 'Manual' | 'System' | 'Allocation';
}

export interface Opportunity {
  id: string;
  title: string;
  type: 'Passive Income' | 'Side Hustle' | 'Investment';
  description: string;
  potentialIncome: string;
  riskLevel: 'Low' | 'Medium' | 'High';
  reasoning: string; 
  trendingSource: string; 
}

export interface PaymentRecord extends SyncMetadata {
  id: string; 
  debtId: string;
  userId: string; 
  amount: number;
  paidDate: string; 
  sourceBank: string;
  status: 'paid';
}

export interface LogItem {
  id: string;
  timestamp: string; 
  userType: 'user' | 'admin';
  username: string;
  action: string; 
  details: string; 
  category: 'System' | 'Finance' | 'AI' | 'Security';
}
