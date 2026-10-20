'use client';

import { useEffect, useState, useMemo, Fragment } from 'react';
import { toast } from 'react-toastify';
import { format } from 'date-fns';
import { Filter, Calendar, Download, TrendingUp, TrendingDown, DollarSign, Search, X } from 'lucide-react';
import { reportService } from '@/services/report.service';
import { expenseService } from '@/services/expense.service';
import { userService } from '@/services/user.service';
import { YearlySummary, Expense, ExpenseStatus, MonthlySummary, User } from '@/types';
import { useAuth } from '@/contexts/AuthContext';
import PeriodFilter from '@/components/PeriodFilter';
import PeriodBadge from '@/components/PeriodBadge';
import ExpenseFilter, { ExpenseFilterValues } from '@/components/ExpenseFilter';
import { formatCurrency, getStatusColor } from '@/lib/utils';
import { sortExpenses } from '@/lib/expenseUtils';
import BrandLogo from '@/components/expenses/BrandLogo';
import ReceiptActions from '@/components/expenses/ReceiptActions';

const MONTHS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

const COLOR_PALETTE = [
  { bg: 'bg-blue-50', border: 'border-blue-100', text: 'text-blue-900' },
  { bg: 'bg-pink-50', border: 'border-pink-100', text: 'text-pink-900' },
  { bg: 'bg-purple-50', border: 'border-purple-100', text: 'text-purple-900' },
  { bg: 'bg-green-50', border: 'border-green-100', text: 'text-green-900' },
  { bg: 'bg-orange-50', border: 'border-orange-100', text: 'text-orange-900' },
  { bg: 'bg-cyan-50', border: 'border-cyan-100', text: 'text-cyan-900' },
  { bg: 'bg-yellow-50', border: 'border-yellow-100', text: 'text-yellow-900' },
  { bg: 'bg-red-50', border: 'border-red-100', text: 'text-red-900' },
];

const getUserColor = (userName: string): { bg: string; border: string; text: string } => {
  if (!userName) return COLOR_PALETTE[0];
  const hash = userName.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return COLOR_PALETTE[hash % COLOR_PALETTE.length];
};

// Types
interface ExpenseGroup {
  baseDescription: string;
  expenses: Expense[];
  totalAmount: number;
  count: number;
  category?: string;
  ownerName?: string;
}

// Helper to get base description (remove installment info)
function getBaseDescription(description: string): string {
  // Remove " (n/m)" from description
  return description.replace(/\s*\(\d+\/\d+\)/, '').trim();
}

// Helper to extract installment info from description
function extractInstallments(description: string): { current: number; total: number } | null {
  const match = description.match(/\((\d+)\/(\d+)\)/);
  if (match) {
    return { current: parseInt(match[1]), total: parseInt(match[2]) };
  }
  return null;
}

function formatPaidAt(paidAt?: string): string {
  if (!paidAt) return '-';

  const hasTimezone = /[zZ]|[+-]\d{2}:\d{2}$/.test(paidAt);
  const parsed = new Date(hasTimezone ? paidAt : `${paidAt}Z`);

  if (Number.isNaN(parsed.getTime())) return '-';
  return format(parsed, 'dd/MM/yyyy HH:mm');
}

function groupSubtitle(group: ExpenseGroup): string {
  const instInfos = group.expenses
    .map((e) => extractInstallments(e.description))
    .filter((x): x is { current: number; total: number } => !!x);

  if (instInfos.length === group.expenses.length && instInfos.length > 0) {
    const currents = instInfos.map((i) => i.current);
    const min = Math.min(...currents);
    const max = Math.max(...currents);
    const total = instInfos[0].total;
    if (group.count === 1 || min === max) return `Parcela ${min}/${total}`;
    return `Parcelas ${min}–${max}/${total}`;
  }

  if (group.count === 1) return 'Pagamento único';
  return `${group.count} pagamentos`;
}

function groupDueLabel(expenses: Expense[]): string {
  const times = expenses
    .map((e) => new Date(e.due_date).getTime())
    .filter((t) => !Number.isNaN(t))
    .sort((a, b) => a - b);
  if (times.length === 0) return '-';
  const min = times[0];
  const max = times[times.length - 1];
  if (min === max) return format(new Date(min), 'dd/MM/yyyy');
  return `${format(new Date(min), 'dd/MM')} – ${format(new Date(max), 'dd/MM/yyyy')}`;
}

function groupPaidAtLabel(expenses: Expense[]): string {
  const paid = expenses
    .filter((e) => e.status === ExpenseStatus.PAGO && e.paid_at)
    .sort((a, b) => new Date(b.paid_at!).getTime() - new Date(a.paid_at!).getTime());
  if (paid.length === 0) return '-';
  if (paid.length === 1) return formatPaidAt(paid[0].paid_at);
  return `Últ. ${format(new Date(paid[0].paid_at!), 'dd/MM/yyyy')}`;
}

function groupPaidByLabel(expenses: Expense[]): string {
  const names = [
    ...new Set(
      expenses
        .filter((e) => e.status === ExpenseStatus.PAGO)
        .map((e) => e.paid_by_name)
        .filter((n): n is string => !!n)
    ),
  ];
  if (names.length === 0) return '-';
  if (names.length === 1) return names[0];
  if (names.length === 2) return names.join(', ');
  return `${names[0]} +${names.length - 1}`;
}

function groupStatusSummary(expenses: Expense[]): { label: string; className: string } {
  const paid = expenses.filter((e) => e.status === ExpenseStatus.PAGO).length;
  const open = expenses.length - paid;
  if (paid === expenses.length) {
    return { label: `${paid} PAGO${paid > 1 ? 'S' : ''}`, className: 'bg-green-100 text-green-700' };
  }
  if (open === expenses.length) {
    return {
      label: `${open} ABERTO${open > 1 ? 'S' : ''}`,
      className: 'bg-yellow-100 text-yellow-800',
    };
  }
  return {
    label: `${paid} pago${paid !== 1 ? 's' : ''} · ${open} aberto${open !== 1 ? 's' : ''}`,
    className: 'bg-slate-100 text-slate-700',
  };
}

function matchesExpenseSearch(expense: Expense, query: string) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return true;

  const dueDate = new Date(expense.due_date);
  const dueDateBr = Number.isNaN(dueDate.getTime()) ? '' : format(dueDate, 'dd/MM/yyyy');
  const dueDateIso = expense.due_date?.slice(0, 10) || '';
  const amountFormatted = formatCurrency(expense.amount).toLowerCase();
  const amountPlain = expense.amount.toFixed(2);
  const amountBr = amountPlain.replace('.', ',');

  const textHaystack = [
    expense.description,
    expense.category,
    expense.owner_name,
    expense.full_name,
    expense.notes,
    expense.credit_card_name,
    expense.loan_name,
    expense.investment_type,
    expense.status,
    expense.paid_by_name,
    dueDateBr,
    dueDateIso,
    amountFormatted,
    amountPlain,
    amountBr,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  if (textHaystack.includes(normalized)) return true;

  const looksLikeAmount = /^r\$?\s*[\d.,]+$/.test(normalized) || /^[\d.,]+$/.test(normalized);
  if (looksLikeAmount) {
    const queryAmount = normalized
      .replace(/r\$\s?/g, '')
      .replace(/\./g, '')
      .replace(',', '.');
    const searched = Number(queryAmount);
    if (!Number.isNaN(searched) && Math.abs(expense.amount - searched) < 0.001) return true;
    if (amountPlain.includes(queryAmount) || amountBr.includes(normalized.replace(/r\$\s?/g, ''))) {
      return true;
    }
  }

  return false;
}

export default function ReportsPage() {
  const { user: currentUser } = useAuth();
  const isAdmin = currentUser?.role === 'USERADMIN' || currentUser?.role === 'USERADMINSUPER';

  const [loading, setLoading] = useState(true);
  const [yearlySummary, setYearlySummary] = useState<YearlySummary | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const selectedMonth = selectedDate.getMonth() + 1;
  const selectedYear = selectedDate.getFullYear();
  const [monthlySummary, setMonthlySummary] = useState<MonthlySummary | null>(null);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [appliedFilters, setAppliedFilters] = useState<ExpenseFilterValues>({});
  const [users, setUsers] = useState<User[]>([]);
  const [pageSize, setPageSize] = useState<number>(10);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [quickStatusFilter, setQuickStatusFilter] = useState<
    'all' | 'PAGO' | 'EM ABERTO' | 'ATRASADO'
  >('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [previousMonthSummary, setPreviousMonthSummary] = useState<MonthlySummary | null>(null);
  const [incomeVsExpensesData, setIncomeVsExpensesData] = useState<any>(null);
  const [incomeVsExpensesFilters, setIncomeVsExpensesFilters] = useState<{
    year: number;
    userId?: string;
  }>({ year: new Date().getFullYear() });
  const [showIncomeVsExpensesFilter, setShowIncomeVsExpensesFilter] = useState(false);

  // Dados para tabela mensal (ano corrente selecionado)
  const monthlyTableData = useMemo(() => {
    if (!yearlySummary?.monthly_totals) return [];
    return yearlySummary.monthly_totals.map((month, index) => ({
      name: MONTHS[index],
      paid: month.total_paid,
      pending: month.total_pending,
      open: month.total_open,
      total: month.total_paid + month.total_pending + month.total_open,
    }));
  }, [yearlySummary]);

  useEffect(() => {
    loadReport();
    loadMonthlyData();
  }, [selectedYear, selectedMonth]);

  useEffect(() => {
    loadIncomeVsExpenses();
  }, [incomeVsExpensesFilters]);

  useEffect(() => {
    loadExpenses();
  }, [selectedMonth, selectedYear, appliedFilters]);

  useEffect(() => {
    const handleUserUpdate = () => {
      loadReport();
      loadMonthlyData();
      loadExpenses();
    };
    window.addEventListener('userUpdated', handleUserUpdate);
    return () => window.removeEventListener('userUpdated', handleUserUpdate);
  }, []);

  useEffect(() => {
    if (currentUser) {
      loadUsers();
    }
  }, [currentUser]);

  const loadUsers = async () => {
    try {
      const usersData = await userService.getAll();
      setUsers(usersData);
    } catch (error) {
      console.error('Erro ao carregar usuários');
      setUsers([]);
    }
  };

  const loadReport = async () => {
    try {
      setLoading(true);
      const data = await reportService.getYearlySummary(selectedYear);
      setYearlySummary(data);
    } catch (error) {
      toast.error('Erro ao carregar relatório');
    } finally {
      setLoading(false);
    }
  };

  const loadMonthlyData = async () => {
    try {
      const data = await reportService.getMonthlySummary(selectedMonth, selectedYear);
      setMonthlySummary(data);
      const prevMonth = selectedMonth === 1 ? 12 : selectedMonth - 1;
      const prevYear = selectedMonth === 1 ? selectedYear - 1 : selectedYear;
      const prevData = await reportService.getMonthlySummary(prevMonth, prevYear);
      setPreviousMonthSummary(prevData);
    } catch (error) {
      toast.error('Erro ao carregar dados mensais');
    }
  };

  const loadExpenses = async () => {
    try {
      const params: any = {};
      if (appliedFilters.startDate || appliedFilters.endDate) {
        if (appliedFilters.startDate) params.start_date = appliedFilters.startDate;
        if (appliedFilters.endDate) params.end_date = appliedFilters.endDate;
      } else {
        params.month = selectedMonth;
      }
      if (appliedFilters.paymentStartDate) {
        params.paid_start_date = appliedFilters.paymentStartDate;
      }
      if (appliedFilters.paymentEndDate) {
        params.paid_end_date = appliedFilters.paymentEndDate;
      }
      params.year = selectedYear;
      if (appliedFilters.status) params.status = appliedFilters.status;
      if (appliedFilters.userId) params.user_id = appliedFilters.userId;
      const expensesData = await expenseService.getAll(params);
      setExpenses(expensesData);
    } catch (error) {
      toast.error('Erro ao carregar despesas');
    }
  };

  const loadIncomeVsExpenses = async () => {
    try {
      const data = await reportService.getIncomeVsExpensesByYear(
        incomeVsExpensesFilters.year,
        incomeVsExpensesFilters.userId
      );
      setIncomeVsExpensesData(data);
    } catch (error) {
      if (yearlySummary) {
        setIncomeVsExpensesData({
          monthly_totals: yearlySummary.monthly_totals,
          total_fixed_income: yearlySummary.total_fixed_income,
          total_variable_income: yearlySummary.total_variable_income,
          total_income: yearlySummary.total_income,
        });
      }
    }
  };
  // Filtro customizado para extrato de salários vs despesas
  function IncomeVsExpensesFilter({
    year,
    userId,
    onApply,
    onCancel,
    users,
  }: {
    year: number;
    userId?: string;
    onApply: (filters: { year: number; userId?: string }) => void;
    onCancel: () => void;
    users: User[];
  }) {
    const [localYear, setLocalYear] = useState(year);
    const [localUserId, setLocalUserId] = useState(userId || '');

    return (
      <div className="p-6 min-w-[340px] bg-white rounded-2xl shadow-xl flex flex-col gap-6 items-center">
        <div className="flex items-center justify-center gap-6 w-full">
          <button
            onClick={() => setLocalYear(localYear - 1)}
            className="w-10 h-10 flex items-center justify-center rounded-full border border-gray-200 bg-gray-50 text-xl text-gray-600 hover:bg-gray-100 transition"
            aria-label="Ano anterior"
          >
            &#8592;
          </button>
          <span className="font-bold text-2xl tracking-wide text-gray-900 select-none">
            {localYear}
          </span>
          <button
            onClick={() => setLocalYear(localYear + 1)}
            className="w-10 h-10 flex items-center justify-center rounded-full border border-gray-200 bg-gray-50 text-xl text-gray-600 hover:bg-gray-100 transition"
            aria-label="Próximo ano"
          >
            &#8594;
          </button>
        </div>
        <div className="w-full flex flex-col gap-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">Usuário</label>
          <select
            className="w-full border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-200 text-gray-900 bg-gray-50"
            value={localUserId}
            onChange={(e) => setLocalUserId(e.target.value)}
          >
            <option value="">Todos os usuários</option>
            {users.map((u) => (
              <option key={u._id} value={u._id}>
                {u.full_name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex justify-end gap-3 w-full mt-2">
          <button
            className="px-5 py-2 rounded-lg bg-gray-100 text-gray-700 font-medium hover:bg-gray-200 transition"
            onClick={onCancel}
          >
            Cancelar
          </button>
          <button
            className="px-5 py-2 rounded-lg bg-primary-600 text-white font-bold shadow hover:bg-primary-700 transition"
            onClick={() => onApply({ year: localYear, userId: localUserId || undefined })}
          >
            Aplicar
          </button>
        </div>
      </div>
    );
  }

  // Helper para saber se está atrasado
  function isOverdue(expense: Expense) {
    return expense.status === 'EM ABERTO' && new Date(expense.due_date) < new Date();
  }

  // filteredExpenses: status rápido + busca
  const filteredExpenses: Expense[] = useMemo(() => {
    let data = [...expenses];
    if (quickStatusFilter === 'PAGO') {
      data = data.filter((e) => e.status === 'PAGO');
    } else if (quickStatusFilter === 'EM ABERTO') {
      data = data.filter((e) => e.status === 'EM ABERTO' && new Date(e.due_date) >= new Date());
    } else if (quickStatusFilter === 'ATRASADO') {
      data = data.filter((e) => isOverdue(e));
    }
    const normalizedSearch = searchQuery.trim();
    if (normalizedSearch) {
      data = data.filter((expense) => matchesExpenseSearch(expense, searchQuery));
    }
    return sortExpenses(data);
  }, [expenses, quickStatusFilter, searchQuery]);

  const groupedExpenses = useMemo(() => {
    const groups = new Map<string, ExpenseGroup>();
    filteredExpenses.forEach((expense) => {
      const base = getBaseDescription(expense.description);
      const key = `${base}-${expense.owner_name}`;
      if (!groups.has(key)) {
        groups.set(key, {
          baseDescription: base,
          expenses: [],
          totalAmount: 0,
          count: 0,
          category: expense.category,
          ownerName: expense.full_name || expense.owner_name,
        });
      }
      const group = groups.get(key)!;
      group.expenses.push(expense);
      group.totalAmount += expense.amount;
      group.count += 1;
    });
    return Array.from(groups.values()).sort((a: ExpenseGroup, b: ExpenseGroup) => {
      const dateA = new Date(a.expenses[0].due_date).getTime();
      const dateB = new Date(b.expenses[0].due_date).getTime();
      return dateA - dateB;
    });
  }, [filteredExpenses]);

  const toggleGroupDetails = (baseDescription: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(baseDescription)) next.delete(baseDescription);
      else next.add(baseDescription);
      return next;
    });
  };

  useEffect(() => {
    setCurrentPage(1);
  }, [appliedFilters, pageSize, searchQuery, quickStatusFilter]);

  const monthlyComparison = useMemo(() => {
    if (!monthlySummary || !previousMonthSummary) return null;
    const diff = monthlySummary.total_expenses - previousMonthSummary.total_expenses;
    const percentage =
      previousMonthSummary.total_expenses > 0
        ? (diff / previousMonthSummary.total_expenses) * 100
        : 0;
    return { diff, percentage, isIncrease: diff > 0 };
  }, [monthlySummary, previousMonthSummary]);

  const totalItems = groupedExpenses.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const paginatedGroups = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return groupedExpenses.slice(start, start + pageSize);
  }, [groupedExpenses, currentPage, pageSize]);

  // Export CSV handler
  function handleExportCSV() {
    // Implementação simples: exporta despesas filtradas
    const rows = filteredExpenses.map((expense) => [
      expense.description,
      expense.amount,
      expense.due_date,
      expense.paid_at || '',
      expense.paid_by_name || '',
      expense.status,
      expense.owner_name,
      expense.category,
    ]);
    const header = [
      'Descrição',
      'Valor',
      'Vencimento',
      'Pago em',
      'Pago por',
      'Status',
      'Responsável',
      'Categoria',
    ];
    const csvContent = [header, ...rows].map((r) => r.join(';')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `despesas_${selectedMonth}_${selectedYear}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // Filtro aplicado
  function handleFilterApply(filters: ExpenseFilterValues) {
    setAppliedFilters(filters);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-10">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Relatórios</h1>
          <p className="mt-1 text-sm text-gray-500">
            Análise financeira detalhada de {selectedYear}
          </p>
        </div>
        <div className="flex items-end gap-2">
          <PeriodFilter
            selectedMonth={selectedMonth}
            selectedYear={selectedYear}
            onPeriodChange={(month, year) => {
              setSelectedDate(new Date(year, month - 1, 1));
            }}
          />
          <PeriodBadge month={selectedMonth} year={selectedYear} />
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-6 md:grid-cols-2">
        <div className="rounded-2xl bg-white p-6 shadow-sm border border-gray-100 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-5">
            <TrendingUp size={100} />
          </div>
          <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider">
            Total Acumulado ({selectedYear})
          </h3>
          <p className="mt-2 text-4xl font-bold text-gray-900 tracking-tight">
            {formatCurrency(yearlySummary?.total_year || 0)}
          </p>
          <div className="mt-4 flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-green-500"></div>
            <span className="text-sm text-gray-600">Considerando todas as despesas pagas</span>
          </div>
        </div>

        <div className="rounded-2xl bg-white p-6 shadow-sm border border-gray-100 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-5">
            <Calendar size={100} />
          </div>
          <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider">
            Média Mensal
          </h3>
          <p className="mt-2 text-4xl font-bold text-primary-600 tracking-tight">
            {formatCurrency(yearlySummary?.average_month || 0)}
          </p>
          {monthlyComparison && Math.abs(monthlyComparison.diff) > 0 && (
            <div
              className={`mt-4 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                monthlyComparison.isIncrease
                  ? 'bg-red-100 text-red-800'
                  : 'bg-green-100 text-green-800'
              }`}
            >
              {monthlyComparison.isIncrease ? '▲' : '▼'}{' '}
              {Math.abs(monthlyComparison.percentage).toFixed(1)}% vs mês anterior
            </div>
          )}
        </div>
      </div>

      {/* Cards de Receitas */}
      {monthlySummary && (
        <div className="grid gap-6 md:grid-cols-3">
          <div className="rounded-2xl bg-gradient-to-br from-green-50 to-emerald-50 p-6 shadow-sm border border-green-200 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-10">
              <TrendingUp size={80} className="text-green-600" />
            </div>
            <h3 className="text-sm font-medium text-green-700 uppercase tracking-wider">
              Receita Fixa
            </h3>
            <p className="mt-2 text-3xl font-bold text-green-900 tracking-tight">
              {formatCurrency(monthlySummary.total_fixed_income || 0)}
            </p>
            <div className="mt-4 flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-green-500"></div>
              <span className="text-xs text-green-600">Salários e receitas fixas mensais</span>
            </div>
          </div>

          <div className="rounded-2xl bg-gradient-to-br from-blue-50 to-cyan-50 p-6 shadow-sm border border-blue-200 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-10">
              <TrendingUp size={80} className="text-blue-600" />
            </div>
            <h3 className="text-sm font-medium text-blue-700 uppercase tracking-wider">
              Receita Variável
            </h3>
            <p className="mt-2 text-3xl font-bold text-blue-900 tracking-tight">
              {formatCurrency(monthlySummary.total_variable_income || 0)}
            </p>
            <div className="mt-4 flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-blue-500"></div>
              <span className="text-xs text-blue-600">Bicos, freelance e comissões</span>
            </div>
          </div>

          <div className="rounded-2xl bg-gradient-to-br from-purple-50 to-indigo-50 p-6 shadow-sm border border-purple-200 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-10">
              <DollarSign size={80} className="text-purple-600" />
            </div>
            <h3 className="text-sm font-medium text-purple-700 uppercase tracking-wider">
              Total de Receitas
            </h3>
            <p className="mt-2 text-3xl font-bold text-purple-900 tracking-tight">
              {formatCurrency(monthlySummary.total_income || 0)}
            </p>
            <div className="mt-4 flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-purple-500"></div>
              <span className="text-xs text-purple-600">Fixo + Variável</span>
            </div>
          </div>
        </div>
      )}

      {/* Gastos por Pessoa e Total - NOVO CARD TOTAL GERAL */}
      {monthlySummary && (
        <div className="flex flex-col gap-4 w-full mb-6">
          <div className="w-full">
            <div className="rounded-xl bg-gradient-to-br from-gray-50 to-gray-100/50 p-4 sm:p-6 shadow-lg border border-gray-200/50 backdrop-blur-sm hover:shadow-xl transition-all duration-300 hover:from-gray-100 hover:to-gray-200/50">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Total Geral</h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-700">Total:</span>
                  <span className="text-lg font-bold text-gray-900">
                    {formatCurrency(monthlySummary.total_expenses)}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-green-700">Pago:</span>
                  <span className="text-md font-semibold text-green-700">
                    {formatCurrency(monthlySummary.total_paid)}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-red-700">Aberto:</span>
                  <span className="text-md font-semibold text-red-700">
                    {formatCurrency(monthlySummary.total_pending)}
                  </span>
                </div>
                <div className="flex justify-between items-center pt-2 border-t border-gray-200">
                  <span className="text-xs text-gray-600">Despesas:</span>
                  <span className="text-sm font-medium text-gray-900">
                    {monthlySummary.expense_count}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Cards por Usuário */}
      {monthlySummary?.owners && monthlySummary.owners.length > 0 && (
        <div
          className={`grid gap-6 ${monthlySummary.owners.length === 1 ? 'md:grid-cols-2' : monthlySummary.owners.length === 2 ? 'md:grid-cols-3' : 'md:grid-cols-4'}`}
        >
          {monthlySummary.owners.map((owner, index) => {
            const colors = getUserColor(owner.owner);

            return (
              <div
                key={owner.owner}
                className={`rounded-2xl ${colors.bg} p-6 shadow-sm border ${colors.border} relative overflow-hidden`}
              >
                <div className={`absolute top-0 right-0 p-4 opacity-10 text-gray-400`}>
                  <TrendingUp size={80} />
                </div>
                <h3 className={`text-sm font-medium ${colors.text} uppercase tracking-wider`}>
                  Gasto {owner.full_name || owner.owner}
                </h3>
                <p className={`mt-2 text-2xl font-bold ${colors.text} tracking-tight`}>
                  {formatCurrency(owner.total_expenses)}
                </p>
                <div className="mt-4 space-y-2">
                  <div className="flex justify-between items-center">
                    <span className={`text-xs ${colors.text} opacity-70`}>Pago:</span>
                    <span className="text-sm font-semibold text-green-600">
                      {formatCurrency(owner.total_paid)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className={`text-xs ${colors.text} opacity-70`}>Em Aberto:</span>
                    <span className="text-sm font-semibold text-yellow-600">
                      {formatCurrency(owner.total_pending)}
                    </span>
                  </div>
                  <div
                    className={`flex justify-between items-center pt-2 border-t ${colors.border}`}
                  >
                    <span className={`text-xs ${colors.text} opacity-70`}>Despesas:</span>
                    <span className={`text-sm font-medium ${colors.text}`}>
                      {owner.expense_count}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Tabela de Gastos Mensais (substitui os gráficos) */}
      <div className="rounded-2xl bg-white p-6 shadow-sm border border-gray-100">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-gray-900">Gastos por Mês ({selectedYear})</h3>
          <span className="text-xs text-gray-500">Pago + Pendente + Aberto</span>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">Mês</th>
                <th className="px-4 py-3 text-right font-semibold text-gray-700">Pago</th>
                <th className="px-4 py-3 text-right font-semibold text-gray-700">Pendente</th>
                <th className="px-4 py-3 text-right font-semibold text-gray-700">Aberto</th>
                <th className="px-4 py-3 text-right font-semibold text-gray-700">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {monthlyTableData.map((month) => (
                <tr key={month.name} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{month.name}</td>
                  <td className="px-4 py-3 text-right text-emerald-700">
                    {formatCurrency(month.paid || 0)}
                  </td>
                  <td className="px-4 py-3 text-right text-amber-700">
                    {formatCurrency(month.pending || 0)}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-700">
                    {formatCurrency(month.open || 0)}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-gray-900">
                    {formatCurrency(month.total || 0)}
                  </td>
                </tr>
              ))}
              {monthlyTableData.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-gray-500">
                    Nenhum dado para {selectedYear}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Extrato de Salários vs Despesas */}
      <div className="rounded-2xl bg-white p-6 shadow-sm border border-gray-100">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
          <div>
            <h3 className="text-lg font-bold text-gray-900">
              Extrato de Salários vs Despesas ({incomeVsExpensesFilters.year})
              {incomeVsExpensesFilters.userId && (
                <span className="ml-2 text-base font-medium text-primary-700">
                  -{' '}
                  {users.find((u) => u._id === incomeVsExpensesFilters.userId)?.full_name ||
                    'Usuário'}
                </span>
              )}
            </h3>
            <span className="text-xs text-gray-500">Receitas - Despesas = Saldo</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              className="px-4 py-2 bg-primary-600 text-white rounded hover:bg-primary-700"
              onClick={() => setShowIncomeVsExpensesFilter(true)}
            >
              Filtros
            </button>
          </div>
          {showIncomeVsExpensesFilter && (
            <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
              <div className="bg-white rounded-lg shadow-lg p-6 min-w-[320px] relative">
                <button
                  className="absolute top-2 right-2 text-gray-400 hover:text-gray-600"
                  onClick={() => setShowIncomeVsExpensesFilter(false)}
                >
                  &#10005;
                </button>
                <IncomeVsExpensesFilter
                  year={incomeVsExpensesFilters.year}
                  userId={incomeVsExpensesFilters.userId}
                  users={users}
                  onApply={(filters) => {
                    setIncomeVsExpensesFilters(filters);
                    setShowIncomeVsExpensesFilter(false);
                  }}
                  onCancel={() => setShowIncomeVsExpensesFilter(false)}
                />
              </div>
            </div>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">Mês</th>
                <th className="px-4 py-3 text-right font-semibold text-green-700">Receita Fixa</th>
                <th className="px-4 py-3 text-right font-semibold text-blue-700">
                  Receita Variável
                </th>
                <th className="px-4 py-3 text-right font-semibold text-purple-700">
                  Total Receitas
                </th>
                <th className="px-4 py-3 text-right font-semibold text-red-700">Total Despesas</th>
                <th className="px-4 py-3 text-right font-semibold text-gray-700">Saldo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {(incomeVsExpensesData?.monthly_totals || yearlySummary?.monthly_totals || []).map(
                (month: any, index: number) => {
                  const totalExpenses = month.total_paid + month.total_pending + month.total_open;
                  const balance = month.total_income - totalExpenses;
                  const isPositive = balance >= 0;

                  return (
                    <tr key={`${month.year}-${month.month}`} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-900">
                        {MONTHS[month.month - 1]} {month.year}
                      </td>
                      <td className="px-4 py-3 text-right text-green-600 font-medium">
                        {formatCurrency(month.total_fixed_income || 0)}
                      </td>
                      <td className="px-4 py-3 text-right text-blue-600 font-medium">
                        {formatCurrency(month.total_variable_income || 0)}
                      </td>
                      <td className="px-4 py-3 text-right text-purple-600 font-semibold">
                        {formatCurrency(month.total_income || 0)}
                      </td>
                      <td className="px-4 py-3 text-right text-red-600 font-semibold">
                        {formatCurrency(totalExpenses)}
                      </td>
                      <td
                        className={`px-4 py-3 text-right font-bold ${
                          isPositive ? 'text-green-600' : 'text-red-600'
                        }`}
                      >
                        {formatCurrency(balance)}
                      </td>
                    </tr>
                  );
                }
              )}
              {(incomeVsExpensesData || yearlySummary) &&
                (incomeVsExpensesData?.monthly_totals || yearlySummary?.monthly_totals || [])
                  .length > 0 && (
                  <tr className="bg-gray-50 font-semibold">
                    <td className="px-4 py-3 font-bold text-gray-900">TOTAL</td>
                    <td className="px-4 py-3 text-right text-green-700">
                      {formatCurrency(
                        (incomeVsExpensesData || yearlySummary)?.total_fixed_income || 0
                      )}
                    </td>
                    <td className="px-4 py-3 text-right text-blue-700">
                      {formatCurrency(
                        (incomeVsExpensesData || yearlySummary)?.total_variable_income || 0
                      )}
                    </td>
                    <td className="px-4 py-3 text-right text-purple-700">
                      {formatCurrency((incomeVsExpensesData || yearlySummary)?.total_income || 0)}
                    </td>
                    <td className="px-4 py-3 text-right text-red-700">
                      {formatCurrency(
                        (
                          incomeVsExpensesData?.monthly_totals ||
                          yearlySummary?.monthly_totals ||
                          []
                        ).reduce(
                          (sum: number, m: any) =>
                            sum + m.total_paid + m.total_pending + m.total_open,
                          0
                        )
                      )}
                    </td>
                    <td
                      className={`px-4 py-3 text-right font-bold ${
                        ((incomeVsExpensesData || yearlySummary)?.total_income || 0) -
                          (
                            incomeVsExpensesData?.monthly_totals ||
                            yearlySummary?.monthly_totals ||
                            []
                          ).reduce(
                            (sum: number, m: any) =>
                              sum + m.total_paid + m.total_pending + m.total_open,
                            0
                          ) >=
                        0
                          ? 'text-green-700'
                          : 'text-red-700'
                      }`}
                    >
                      {formatCurrency(
                        ((incomeVsExpensesData || yearlySummary)?.total_income || 0) -
                          (
                            incomeVsExpensesData?.monthly_totals ||
                            yearlySummary?.monthly_totals ||
                            []
                          ).reduce(
                            (sum: number, m: any) =>
                              sum + m.total_paid + m.total_pending + m.total_open,
                            0
                          )
                      )}
                    </td>
                  </tr>
                )}
              {!incomeVsExpensesData?.monthly_totals && !yearlySummary?.monthly_totals && (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-gray-500">
                    Nenhum dado disponível
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Cards de Usuários (Mensal) - Estilização melhorada */}
      {monthlySummary && Object.keys(monthlySummary).length > 0 && (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {Object.entries(monthlySummary)
            .filter(([key, value]: [string, any]) => value?.owner) // Filtra apenas objetos de usuário
            .map(([key, data]: [string, any]) => {
              const colors = getUserColor(data.owner);
              return (
                <div
                  key={key}
                  className={`rounded-2xl p-6 border-2 transition-all hover:shadow-lg shadow-md ${colors.bg} ${colors.border}`}
                >
                  <div className="flex justify-between items-start mb-4">
                    <h3 className={`text-lg font-bold ${colors.text}`}>{data.owner}</h3>
                    <span className="text-xs px-2 py-1 rounded-full bg-gray-100 font-medium text-gray-700">
                      {MONTHS[selectedMonth - 1]}
                    </span>
                  </div>

                  <div className="flex flex-col gap-1 mb-6">
                    <span className={`text-3xl font-bold ${colors.text}`}>
                      {formatCurrency(data.total_expenses)}
                    </span>
                    <span className={`text-xs ${colors.text} opacity-80 font-medium`}>
                      Total gasto no mês
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-white rounded-lg p-3 border border-gray-300 shadow-sm">
                      <p className="text-xs text-gray-500 mb-1 font-semibold">Pago</p>
                      <p className="text-sm font-bold text-emerald-600">
                        {formatCurrency(data.total_paid)}
                      </p>
                    </div>
                    <div className="bg-white rounded-lg p-3 border border-gray-300 shadow-sm">
                      <p className="text-xs text-gray-500 mb-1 font-semibold">Pendente</p>
                      <p className="text-sm font-bold text-amber-600">
                        {formatCurrency(data.total_pending)}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
        </div>
      )}

      {/* Tabela de Detalhes - Com design mais limpo */}
      <div className="rounded-2xl bg-white shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-6 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <h3 className="text-lg font-bold text-gray-900">Extrato de Despesas</h3>
          <div className="flex items-center gap-2">
            <button
              onClick={handleExportCSV}
              className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-600 bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <Download className="h-4 w-4" />
              CSV
            </button>
            <ExpenseFilter
              onApply={handleFilterApply}
              users={users}
              showUserFilter={true}
              initialFilters={appliedFilters}
            />
          </div>
        </div>

        {/* Filtros Rápidos (Tabs) */}
        <div className="px-6 pt-4 flex gap-1 border-b border-gray-100 overflow-x-auto">
          {[
            { key: 'all', label: 'Todas' },
            { key: 'PAGO', label: 'Pagas' },
            { key: 'EM ABERTO', label: 'Em Aberto' },
            { key: 'ATRASADO', label: 'Atrasadas' },
          ].map(({ key, label }) => {
            const isActive = quickStatusFilter === key;
            return (
              <button
                key={key}
                onClick={() => setQuickStatusFilter(key as any)}
                className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                  isActive
                    ? 'border-primary-600 text-primary-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>

        <div className="px-4 py-3 sm:px-6 sm:py-4 border-b border-gray-100 bg-white">
          <div className="relative w-full max-w-xl">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
            <input
              type="text"
              inputMode="search"
              enterKeyHint="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar conta, valor ou data..."
              aria-label="Buscar despesas no extrato"
              className="w-full pl-10 pr-10 py-2.5 border border-gray-300 rounded-xl text-sm bg-white shadow-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 placeholder:text-gray-400"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                aria-label="Limpar busca"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          {searchQuery.trim() && (
            <p className="mt-2 text-xs text-gray-500">
              {groupedExpenses.length} resultado{groupedExpenses.length === 1 ? '' : 's'} para "
              {searchQuery.trim()}"
            </p>
          )}
        </div>

        {/* Tabela */}
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Descrição
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Categoria
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Resp.
                </th>
                <th className="px-6 py-4 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Valor
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider pl-8">
                  Vencimento
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Pago em
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Pago por
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100">
              {paginatedGroups.length > 0 ? (
                paginatedGroups.map((group) => (
                  <Fragment key={`grp-${group.baseDescription}-${group.ownerName}`}>
                    <tr
                      onClick={() => {
                        if (group.count === 1) {
                          window.location.href = `/dashboard/expenses?id=${group.expenses[0]._id}`;
                        } else {
                          toggleGroupDetails(group.baseDescription);
                        }
                      }}
                      className={`hover:bg-gray-50 transition-colors cursor-pointer`}
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <BrandLogo description={group.baseDescription} size="md" />
                          <div>
                            <div className="text-sm font-medium text-gray-900 flex items-center gap-2">
                              {group.baseDescription}
                              {group.count > 1 && (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] bg-gray-100 text-gray-600 font-medium border border-gray-200">
                                  {expandedGroups.has(group.baseDescription) ? '▼' : '▶'}
                                  {group.count}
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-gray-500">{groupSubtitle(group)}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {group.category ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">
                            {group.category}
                          </span>
                        ) : (
                          '-'
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <div className="flex items-center gap-2">
                          <div
                            className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                              group.ownerName === 'Eduardo'
                                ? 'bg-blue-100 text-blue-700'
                                : group.ownerName === 'Valeria'
                                  ? 'bg-pink-100 text-pink-700'
                                  : 'bg-gray-200 text-gray-700'
                            }`}
                          >
                            {group.ownerName?.charAt(0)}
                          </div>
                          {group.ownerName}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-bold text-gray-900">
                        {formatCurrency(
                          group.count === 1 ? group.expenses[0].amount : group.totalAmount
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 pl-8">
                        {group.count === 1
                          ? format(new Date(group.expenses[0].due_date), 'dd/MM/yyyy')
                          : groupDueLabel(group.expenses)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {group.count === 1 ? (
                          group.expenses[0].paid_at &&
                          group.expenses[0].status === ExpenseStatus.PAGO ? (
                            formatPaidAt(group.expenses[0].paid_at)
                          ) : (
                            '-'
                          )
                        ) : (
                          groupPaidAtLabel(group.expenses)
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {group.count === 1 ? (
                          group.expenses[0].status === ExpenseStatus.PAGO ? (
                            group.expenses[0].paid_by_name || '-'
                          ) : (
                            '-'
                          )
                        ) : (
                          groupPaidByLabel(group.expenses)
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {group.count === 1 ? (
                          <div className="flex items-center gap-2">
                            <span
                              className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${isOverdue(group.expenses[0]) ? 'bg-red-100 text-red-700' : getStatusColor(group.expenses[0].status)}`}
                            >
                              {isOverdue(group.expenses[0]) ? 'ATRASADO' : group.expenses[0].status}
                            </span>
                            <ReceiptActions
                              expense={group.expenses[0]}
                              onChanged={loadExpenses}
                            />
                          </div>
                        ) : (
                          (() => {
                            const status = groupStatusSummary(group.expenses);
                            return (
                              <span
                                className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${status.className}`}
                              >
                                {status.label}
                              </span>
                            );
                          })()
                        )}
                      </td>
                    </tr>

                    {/* Linhas filhas alinhadas às mesmas colunas */}
                    {expandedGroups.has(group.baseDescription) &&
                      group.count > 1 &&
                      [...group.expenses]
                        .sort(
                          (a, b) =>
                            new Date(a.due_date).getTime() - new Date(b.due_date).getTime()
                        )
                        .map((expense) => {
                          const inst = extractInstallments(expense.description);
                          return (
                            <tr
                              key={expense._id}
                              onClick={(e) => {
                                e.stopPropagation();
                                window.location.href = `/dashboard/expenses?id=${expense._id}`;
                              }}
                              className="bg-slate-50/80 hover:bg-slate-100/80 transition-colors cursor-pointer border-l-4 border-l-slate-200"
                            >
                              <td className="px-6 py-3">
                                <div className="flex items-center gap-3 pl-8 sm:pl-12">
                                  <div className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-[10px] font-semibold text-slate-500 shrink-0">
                                    {inst ? `${inst.current}` : '·'}
                                  </div>
                                  <div className="min-w-0">
                                    <div className="text-sm font-medium text-gray-800 truncate">
                                      {inst
                                        ? `Parcela ${inst.current}/${inst.total}`
                                        : expense.description}
                                    </div>
                                    <div className="text-xs text-gray-400">Item do grupo</div>
                                  </div>
                                </div>
                              </td>
                              <td className="px-6 py-3 whitespace-nowrap text-sm text-gray-500">
                                {expense.category || group.category ? (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">
                                    {expense.category || group.category}
                                  </span>
                                ) : (
                                  '-'
                                )}
                              </td>
                              <td className="px-6 py-3 whitespace-nowrap text-sm text-gray-500">
                                <div className="flex items-center gap-2">
                                  <div
                                    className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                                      (expense.full_name || expense.owner_name || group.ownerName) ===
                                      'Eduardo'
                                        ? 'bg-blue-100 text-blue-700'
                                        : (expense.full_name ||
                                              expense.owner_name ||
                                              group.ownerName) === 'Valeria'
                                          ? 'bg-pink-100 text-pink-700'
                                          : 'bg-gray-200 text-gray-700'
                                    }`}
                                  >
                                    {(
                                      expense.full_name ||
                                      expense.owner_name ||
                                      group.ownerName ||
                                      '?'
                                    ).charAt(0)}
                                  </div>
                                  <span className="truncate max-w-[7rem]">
                                    {expense.full_name || expense.owner_name || group.ownerName}
                                  </span>
                                </div>
                              </td>
                              <td className="px-6 py-3 whitespace-nowrap text-sm text-right font-semibold text-gray-900">
                                {formatCurrency(expense.amount)}
                              </td>
                              <td className="px-6 py-3 whitespace-nowrap text-sm text-gray-500 pl-8">
                                {format(new Date(expense.due_date), 'dd/MM/yyyy')}
                              </td>
                              <td className="px-6 py-3 whitespace-nowrap text-sm text-gray-500">
                                {expense.paid_at && expense.status === ExpenseStatus.PAGO
                                  ? formatPaidAt(expense.paid_at)
                                  : '-'}
                              </td>
                              <td className="px-6 py-3 whitespace-nowrap text-sm text-gray-500">
                                {expense.status === ExpenseStatus.PAGO
                                  ? expense.paid_by_name || '-'
                                  : '-'}
                              </td>
                              <td className="px-6 py-3 whitespace-nowrap">
                                <div className="flex items-center gap-2">
                                  <span
                                    className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
                                      isOverdue(expense)
                                        ? 'bg-red-100 text-red-700'
                                        : getStatusColor(expense.status)
                                    }`}
                                  >
                                    {isOverdue(expense) ? 'ATRASADO' : expense.status}
                                  </span>
                                  <ReceiptActions expense={expense} onChanged={loadExpenses} />
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                  </Fragment>
                ))
              ) : (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center justify-center text-gray-400">
                      <Filter className="h-10 w-10 mb-2 opacity-20" />
                      <p className="text-lg font-medium text-gray-900">
                        {searchQuery.trim()
                          ? `Nenhuma despesa encontrada para "${searchQuery.trim()}"`
                          : 'Nenhuma despesa encontrada'}
                      </p>
                      <p className="text-sm">
                        {searchQuery.trim()
                          ? 'Tente outro termo ou limpe a busca.'
                          : 'Tente ajustar os filtros ou o período selecionado.'}
                      </p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          {/* Paginação */}
          <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100 bg-gray-50">
            <div className="text-xs text-gray-500">
              Mostrando {(currentPage - 1) * pageSize + 1} até{' '}
              {Math.min(currentPage * pageSize, totalItems)} de {totalItems} resultados
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1 text-sm rounded-md border border-gray-300 bg-white text-gray-700 disabled:opacity-50 hover:bg-gray-50"
              >
                Anterior
              </button>
              <span className="text-sm font-medium text-gray-700 px-2">
                {currentPage} / {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-3 py-1 text-sm rounded-md border border-gray-300 bg-white text-gray-700 disabled:opacity-50 hover:bg-gray-50"
              >
                Próxima
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
