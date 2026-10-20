export interface User {
  _id: string;
  email: string;
  full_name: string;
  cpf?: string;
  phone?: string;
  is_active: boolean;
  whatsapp_notifications_enabled?: boolean;
  role: 'USER' | 'USERADMIN' | 'USERADMINSUPER';
  family_id?: string;
  created_at: string;
  monthly_salary?: number;
  salary_payment_day?: number;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  full_name: string;
  phone?: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
}

export enum ExpenseStatus {
  PAGO = 'PAGO',
  EM_ABERTO = 'EM ABERTO',
  NAO_PAGO = 'NÃO PAGO',
}

export enum PaymentSource {
  SALARY = 'SALARY',
  CREDIT_CARD = 'CREDIT_CARD',
  LOAN = 'LOAN',
  SAVINGS = 'SAVINGS',
  OTHER = 'OTHER',
}

export interface ExpenseReceipt {
  original_filename: string;
  content_type: string;
  size_bytes: number;
  uploaded_at: string;
  uploaded_by_name?: string;
}

export interface ReceiptAmountCheck {
  detected_amount: number;
  expense_amount: number;
  differs: boolean;
}

export interface Expense {
  _id: string;
  description: string;
  amount: number;
  due_date: string;
  paid_at?: string;
  paid_by_user_id?: string;
  paid_by_name?: string;
  status: ExpenseStatus;
  owner_name: string;
  full_name?: string; // Nome dinâmico do usuário
  category?: string;
  notes?: string;
  user_id: string;
  created_at: string;
  updated_at: string;
  payment_source?: PaymentSource;
  credit_card_name?: string;
  interest_rate?: number;
  installments?: number;
  installment_group_id?: string;
  installment_number?: number;
  installment_total?: number;
  loan_name?: string;
  investment_type?: string;
  has_receipt?: boolean;
  receipt?: ExpenseReceipt | null;
  receipt_amount_check?: ReceiptAmountCheck | null;
}

export interface ExpenseCreate {
  description: string;
  amount: number;
  due_date: string;
  status: ExpenseStatus;
  category?: string;
  notes?: string;
  payment_source?: PaymentSource;
  credit_card_name?: string;
  interest_rate?: number;
  installments?: number;
  installment_group_id?: string;
  installment_number?: number;
  installment_total?: number;
  loan_name?: string;
  investment_type?: string;
}

export interface CategoryTotal {
  category: string;
  total: number;
  percentage: number;
  count: number;
}

export interface OwnerTotal {
  owner: string;
  full_name?: string; // Nome dinâmico do usuário
  total_expenses: number;
  total_paid: number;
  total_pending: number;
  total_open: number;
  expense_count: number;
}

export interface MonthlySummary {
  user_id: string;
  month: number;
  year: number;
  total_expenses: number;
  total_paid: number;
  total_pending: number;
  expenses_by_status: Record<string, number>;
  expenses_by_category: CategoryTotal[];
  expense_count: number;
  owners: OwnerTotal[];
  total_fixed_income: number;
  total_variable_income: number;
  total_income: number;
}

export interface MonthlyTotal {
  month: number;
  year: number;
  total_paid: number;
  total_pending: number;
  total_open: number;
  owners: OwnerTotal[];
  total_fixed_income: number;
  total_variable_income: number;
  total_income: number;
}

export interface YearlySummary {
  user_id: string;
  year: number;
  monthly_totals: MonthlyTotal[];
  total_year: number;
  average_month: number;
  owners: OwnerTotal[];
  total_fixed_income: number;
  total_variable_income: number;
  total_income: number;
}

// ========== DÍVIDAS ==========

export enum DebtType {
  CREDIT_CARD = 'CREDIT_CARD',
  LOAN = 'LOAN',
  FINANCING = 'FINANCING',
  OVERDRAFT = 'OVERDRAFT',
}

export enum DebtStatus {
  ACTIVE = 'ACTIVE',
  PAID_OFF = 'PAID_OFF',
  RENEGOTIATED = 'RENEGOTIATED',
}

export interface Debt {
  _id: string;
  name: string;
  debt_type: DebtType;
  total_amount: number;
  current_balance: number;
  interest_rate: number;
  minimum_payment?: number;
  due_day: number;
  start_date: string;
  status: DebtStatus;
  notes?: string;
  user_id: string;
  created_at: string;
  updated_at: string;
}

export interface DebtCreate {
  name: string;
  debt_type: DebtType;
  total_amount: number;
  current_balance: number;
  interest_rate: number;
  minimum_payment?: number;
  due_day: number;
  start_date?: string;
  status?: DebtStatus;
  notes?: string;
}

export interface DebtSummary {
  total_debt: number;
  total_original: number;
  average_interest: number;
  count: number;
  highest_interest: number;
  highest_balance: number;
  monthly_interest_cost: number;
}

export enum PaymentStrategy {
  SNOWBALL = 'SNOWBALL',
  AVALANCHE = 'AVALANCHE',
  CUSTOM = 'CUSTOM',
}

export interface DebtPayoffPlan {
  strategy: PaymentStrategy;
  monthly_payment: number;
  debts: Debt[];
  total_debt: number;
  total_interest: number;
  months_to_payoff: number;
  payoff_order: string[];
  monthly_breakdown: Array<{
    month: number;
    payments: Array<{
      debt_name: string;
      amount_paid: number;
      remaining_balance: number;
    }>;
  }>;
}

// ========== ANÁLISE FINANCEIRA ==========

export enum IncomeType {
  FIXED = 'FIXED', // Receita fixa (salário, aluguel, etc)
  VARIABLE = 'VARIABLE', // Receita variável (bicos, freelance, etc)
}

export interface Income {
  id: string;
  description: string;
  amount: number;
  income_type: IncomeType;
  payment_day?: number;
  payment_date?: string;
  notes?: string;
  is_active: boolean;
  user_id: string;
  user_name: string;
  family_id: string;
  created_at: string;
  updated_at: string;
}

export interface IncomeCreate {
  description: string;
  amount: number;
  income_type: IncomeType;
  payment_day?: number;
  payment_date?: string;
  notes?: string;
  is_active?: boolean;
  user_id: string;
  family_id: string;
}

export interface IncomeUpdate {
  description?: string;
  amount?: number;
  income_type?: IncomeType;
  payment_day?: number;
  payment_date?: string;
  notes?: string;
  is_active?: boolean;
}

export interface IncomeSummary {
  total_fixed_income: number;
  total_variable_income: number;
  total_income: number;
  by_user: Array<{
    user_id: string;
    user_name: string;
    fixed_income: number;
    variable_income: number;
    total_income: number;
  }>;
  active_incomes_count: number;
}

export enum TrendDirection {
  INCREASING = 'INCREASING',
  DECREASING = 'DECREASING',
  STABLE = 'STABLE',
  VOLATILE = 'VOLATILE',
}

export enum FinancialHealth {
  EXCELLENT = 'EXCELLENT',
  GOOD = 'GOOD',
  WARNING = 'WARNING',
  CRITICAL = 'CRITICAL',
  DANGER = 'DANGER',
}

export interface IncomeInfo {
  user_id: string;
  user_name: string;
  monthly_salary: number; // Mantido para compatibilidade
  fixed_income: number; // Receita fixa total
  variable_income: number; // Receita variável
  total_income: number; // Total de receitas
  has_salary_configured: boolean; // Mantido para compatibilidade
  has_income_configured: boolean; // Se tem alguma receita configurada
}

export interface CombinedIncome {
  eduardo_income?: IncomeInfo;
  valeria_income?: IncomeInfo;
  users_income: IncomeInfo[]; // Lista dinâmica de todos os usuários
  total_monthly_income: number; // Mantido para compatibilidade
  total_fixed_income: number; // Total de receitas fixas
  total_variable_income: number; // Total de receitas variáveis
  total_income: number; // Total geral
  both_configured: boolean;
}

export interface PaymentSourceBreakdown {
  paid_with_salary: number;
  paid_with_salary_percentage: number;
  paid_with_credit_card: number;
  paid_with_credit_card_percentage: number;
  paid_with_loan: number;
  paid_with_loan_percentage: number;
  paid_with_savings: number;
  paid_with_savings_percentage: number;
  paid_with_other: number;
  paid_with_other_percentage: number;
  total_expenses: number;
  credit_dependency_level: number;
}

export interface UserFinancialSummary {
  user_id: string;
  user_name: string;
  monthly_salary?: number; // Mantido para compatibilidade
  fixed_income: number; // Receita fixa
  variable_income: number; // Receita variável
  total_income: number; // Total de receitas
  total_expenses: number; // Despesas pagas com payment_source
  total_all_expenses: number; // Todas as despesas cadastradas (independente do status)
  total_paid_expenses: number; // Despesas com status PAGO
  total_pending_expenses: number; // Despesas com status EM ABERTO
  total_open_expenses: number; // Despesas com status NÃO PAGO
  payment_breakdown: PaymentSourceBreakdown;
  top_categories: Array<{ category: string; total: number }>;
  trend: TrendDirection;
  balance: number; // Receitas - Gastos (baseado em total_expenses)
  balance_all_expenses: number; // Receitas - Todas as despesas cadastradas
}

export interface UserComparison {
  eduardo: UserFinancialSummary;
  valeria: UserFinancialSummary;
  users_summaries: UserFinancialSummary[]; // Lista dinâmica de todos os usuários
  combined_total: number;
  eduardo_percentage: number;
  valeria_percentage: number;
  biggest_spender: string;
  biggest_category_eduardo?: string;
  biggest_category_valeria?: string;
}

export interface FinancialDashboard {
  analysis_date: string;
  period: string;
  financial_health: FinancialHealth;
  health_score: number;
  income: CombinedIncome;
  payment_analysis: PaymentSourceBreakdown;
  user_comparison: UserComparison;
  total_active_debts: number;
  active_debts_count: number;
  monthly_debt_interest: number;
  short_term_balance: number;
  short_term_trend: TrendDirection;
  critical_alerts: string[];
  suggestions: string[];
}

export interface MonthlyProjection {
  month: number;
  year: number;
  month_number: number;
  projected_income: number;
  projected_expenses: number;
  debt_interest: number;
  net_balance: number;
  accumulated_balance: number;
  is_negative: boolean;
}

export interface YearlyProjection {
  year: number;
  total_income: number;
  total_expenses: number;
  total_interest_paid: number;
  net_annual: number;
  final_balance: number;
  months_negative: number;
  months_positive: number;
}

export interface LongTermPrediction {
  years_projected: number;
  start_date: string;
  end_date: string;
  current_balance: number;
  current_monthly_income: number;
  current_monthly_expenses: number;
  current_total_debt: number;
  final_balance: number;
  total_income_projected: number;
  total_expenses_projected: number;
  total_interest_paid: number;
  will_go_negative: boolean;
  first_negative_date?: string;
  months_in_negative: number;
  worst_balance: number;
  worst_balance_date?: string;
  will_become_positive: boolean;
  debt_free_date?: string;
  months_to_debt_free?: number;
  best_balance: number;
  best_balance_date?: string;
  yearly_projections: YearlyProjection[];
  monthly_projections_sample: MonthlyProjection[];
  warnings: string[];
  recommendations: string[];
}

export interface PurchaseSimulation {
  purchase_amount: number;
  payment_method: string;
  installments?: number;
  interest_rate?: number;
  current_balance: number;
  balance_after_purchase: number;
  impact_percentage: number;
  will_go_negative: boolean;
  months_to_recover?: number;
  recommendation: string;
}
