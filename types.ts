
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
  updated_at?: string; // SQL Compatibility
}

// NEW: AI Agent Configuration (V44.22)
export interface AIAgent extends SyncMetadata {
  id: string; // e.g., 'agent_summary', 'agent_command'
  name: string;
  description: string;
  systemInstruction: string; // The prompt
  system_instruction?: string; // SQL
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
    backend_url?: string;
    sourceCodeUrl?: string;
    source_code_url?: string;
    
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
    system_rules?: SystemRules;
    advancedConfig?: AdvancedConfig; 
    advanced_config?: AdvancedConfig;
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
  created_at?: string;
  resolvedAt?: string;
  resolved_at?: string;
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
  last_login?: string; // SQL Sync
  parentUserId?: string | null; 
  parent_user_id?: string | null;
  createdAt: string;
  created_at?: string;
  photoUrl?: string; 
  photo_url?: string;
  sessionToken?: string; 
  session_token?: string;
  
  riskProfile?: 'Conservative' | 'Moderate' | 'Aggressive';
  bigWhyUrl?: string; 
  financialFreedomTarget?: number; 
  badges?: string[]; 
  
  // Analytics Fields (Snake Case for Admin Dashboard)
  total_debt?: number;
  total_income?: number;
  monthly_obligation?: number;
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
  user_id?: string;
  name: string;
  targetAmount: number;
  target_amount?: number;
  currentAmount: number;
  current_amount?: number;
  deadline: string;
  icon: string;
  color: string;
}

export interface StepUpRange {
  startMonth: number;
  endMonth: number;
  amount: number;
}

export interface DebtItem extends SyncMetadata {
  id: string;
  userId: string; 
  user_id?: string;
  name: string;
  type: LoanType;
  originalPrincipal: number; 
  original_principal?: number;
  totalLiability: number; 
  total_liability?: number;
  startDate: string; 
  start_date?: string;
  endDate: string; 
  end_date?: string;
  dueDate: number; 
  due_date?: number;
  
  monthlyPayment: number; 
  monthly_payment?: number;
  remainingPrincipal: number; 
  remaining_principal?: number;
  interestRate: number; 
  interest_rate?: number;
  remainingMonths: number;
  remaining_months?: number;
  monthsPassed?: number;
  
  bankName?: string;
  bank_name?: string;
  createdAt?: string; 
  created_at?: string;

  interestStrategy?: 'Fixed' | 'StepUp';
  interest_strategy?: 'Fixed' | 'StepUp';
  stepUpSchedule?: StepUpRange[];
  step_up_schedule?: StepUpRange[];

  payoffMethod?: 'direct_extra' | 'sinking_fund'; 
  allocatedExtraBudget?: number; 
  currentSavedAmount?: number; 
  earlySettlementDiscount?: number; 
}

export interface DebtInstallment extends SyncMetadata {
  id: string;
  debtId: string;
  debt_id?: string;
  userId: string;
  user_id?: string;
  period: number; 
  dueDate: string; 
  due_date?: string;
  amount: number;
  principalPart: number;
  principal_part?: number;
  interestPart: number;
  interest_part?: number;
  remainingBalance: number;
  remaining_balance?: number;
  status: 'pending' | 'paid' | 'overdue';
  notes?: string; 
}

export interface IncomeItem extends SyncMetadata {
  id: string;
  userId: string; 
  user_id?: string;
  source: string;
  amount: number;
  type: 'active' | 'passive' | 'windfall'; 
  frequency: 'monthly' | 'one-time';
  dateReceived?: string;
  date_received?: string;
  notes?: string;
}

export interface ExpenseItem extends SyncMetadata {
  id: string;
  userId: string; 
  user_id?: string;
  name: string;
  amount: number;
  category: 'needs' | 'wants' | 'debt';
  assignedAccountId: string | null;
  priority: number;
  isTransferred: boolean; 
  is_transferred?: boolean;
  debtId?: string; 
  isRecurring?: boolean; 
}

export interface DailyExpense extends SyncMetadata {
  id: string;
  userId: string; 
  user_id?: string;
  date: string; 
  title: string;
  amount: number;
  category: 'Food' | 'Transport' | 'Shopping' | 'Utilities' | 'Entertainment' | 'Others';
  notes?: string;
  receiptImage?: string; 
  allocationId?: string; 
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
  user_id?: string;
  title: string;
  category: 'Administration' | 'Payment' | 'Negotiation' | 'Investment' | 'Business';
  status: 'pending' | 'completed';
  dueDate?: string;
  due_date?: string;
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
  debt_id?: string;
  userId: string; 
  user_id?: string;
  amount: number;
  paidDate: string; 
  paid_date?: string;
  sourceBank: string;
  source_bank?: string;
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
