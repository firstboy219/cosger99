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
    
    // Activity Logs (V50.21)
    showDetailedLogsToUsers?: boolean;
    
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
  role: 'admin' | 'user' | 'sales';
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
  
  // V50.34 Freemium fields (V50.35: TAHAP 1)
  subscription_id?: string;
  ai_hits_used?: number;
  ai_last_reset_date?: string; // ISO String - when AI hits were last reset
  
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

// ═══ V50.34 FREEMIUM / CRM TYPES ═══

export interface FreemiumPackage extends SyncMetadata {
  id: string;
  name: string;
  price: number;
  ai_limit: number;
  features: Record<string, boolean>;
  is_active: boolean;
  is_default_free: boolean;
  description?: string;
  badge_color?: string;
}

export interface PaymentMethod extends SyncMetadata {
  id: string;
  bank_name: string;
  account_number: string;
  account_name: string;
  is_active: boolean;
  logo_url?: string;
}

export interface Promo extends SyncMetadata {
  id: string;
  code: string;
  discount_percentage: number;
  discount_nominal: number;
  valid_until: string;
  quota: number;
  target_user_id?: string;
  image_url?: string;
  description?: string;
  is_active?: boolean; // V50.35: Track if promo is currently active
}

export interface Subscription extends SyncMetadata {
  id: string;
  user_id: string;
  package_id: string;
  payment_method_id?: string;
  promo_id?: string;
  amount_paid: number;
  status: 'pending' | 'awaiting_payment' | 'verifying' | 'active' | 'expired' | 'rejected' | 'cancelled'; // V50.35: Added 'cancelled'
  start_date: string;
  end_date: string;
  proof_of_payment?: string;
  package_name?: string;
  rejection_reason?: string;
}

export interface AppNotification extends SyncMetadata {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type?: 'info' | 'promo' | 'warning' | 'system';
  image_url?: string;
  action_url?: string;
  is_read: boolean;
  created_at: string;
}

export interface SubscriptionStatus {
  inGracePeriod: boolean;
  daysLeftGrace: number;
  isFreeTier: boolean;
  currentPackage?: string;
  expiryDate?: string;
}

export type ActiveFeatures = Record<string, boolean>;

export interface LogItem {
  id: string;
  timestamp: string; 
  userType: 'user' | 'admin';
  username: string;
  action: string; 
  details: string; 
  category: 'System' | 'Finance' | 'AI' | 'Security';
  // V50.21: Extended fields for backend sync & detailed logging
  payload?: any;      // Request payload (may be redacted by backend)
  response?: any;     // Response data (may be redacted by backend)
  status?: 'success' | 'error' | 'warning' | 'info';
  userId?: string;
}

// V50.35 TAHAP 1: CMS & Marketing Content
export interface Content extends SyncMetadata {
  id: string;
  title: string;
  content_type: 'article' | 'image' | 'video';
  body?: string;
  media_url?: string; // For images/videos
  thumbnail_url?: string;
  author_id?: string;
  status: 'draft' | 'published' | 'archived';
  created_at: string;
  updated_at: string;
  published_at?: string;
  tags?: string[];
  seo_title?: string;
  seo_description?: string;
  view_count?: number;
}

// V50.35 TAHAP 1: Newsletter Leads
export interface Lead extends SyncMetadata {
  id: string;
  email: string;
  name?: string;
  phone?: string;
  company?: string;
  source?: string; // Where the lead came from (landing_page, newsletter, etc.)
  status: 'new' | 'contacted' | 'qualified' | 'converted' | 'unsubscribed';
  created_at: string;
  subscribed_at?: string;
  converted_at?: string;
  notes?: string;
  tags?: string[];
}

// V50.35 TAHAP 1: Client Telemetry (App Analytics)
export interface ClientTelemetry extends SyncMetadata {
  id: string;
  user_id?: string;
  session_id: string;
  event_type: string; // page_view, button_click, form_submit, etc.
  event_name: string;
  page_url?: string;
  referrer_url?: string;
  user_agent?: string;
  ip_address?: string;
  metadata?: Record<string, any>;
  timestamp: string;
  duration_ms?: number; // For events with duration
}
