'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { format, differenceInCalendarDays } from 'date-fns';
import { toast } from 'react-toastify';
import {
  Plus,
  Edit2,
  Trash2,
  Filter,
  AlertTriangle,
  AlertCircle,
  Clock,
  CheckCircle2,
  Search,
  X,
} from 'lucide-react';
import MobileExpensesList from '@/components/mobile/expenses/MobileExpensesList';
import { useForm } from 'react-hook-form';

// Services e Types
import { getErrorMessage } from '@/lib/errorHandler';
import { expenseService } from '@/services/expense.service';
import { reportService } from '@/services/report.service';
import { userService } from '@/services/user.service';
import { useAuth } from '@/contexts/AuthContext';
import {
  Expense,
  ExpenseCreate,
  ExpenseStatus,
  MonthlySummary,
  PaymentSource,
  User,
} from '@/types';

// Components e Utils
import ExpenseFilter, { ExpenseFilterValues } from '@/components/ExpenseFilter';
import DeleteConfirmModal from '@/components/expenses/DeleteConfirmModal';
import PaymentSourceModal from '@/components/expenses/PaymentSourceModal';
import ExpenseFormModal from '@/components/expenses/ExpenseFormModal';
import ConfettiEffect from '@/components/expenses/ConfettiEffect';
import BrandLogo from '@/components/expenses/BrandLogo';
import ProgressBar from '@/components/expenses/ProgressBar';
import ReceiptActions from '@/components/expenses/ReceiptActions';
import { useReceiptAmountDivergence } from '@/components/expenses/ReceiptAmountDivergenceModal';
import { formatCurrency, getStatusColor, isOverdue } from '@/lib/utils';
import { clearPendingSharedReceipt } from '@/lib/ccShare';
import {
  PREDEFINED_CATEGORIES,
  DESCRIPTION_SUGGESTIONS,
  getCategoryStyle,
} from '@/lib/categoryUtils';
import { canSettleInstallments, getDaysDiff, getRowStyle, sortExpenses } from '@/lib/expenseUtils';
import { useCurrencyInput } from '@/hooks/useCurrencyInput';
import { useModal } from '@/hooks/useModal';

const formatPaidAt = (paidAt?: string) => {
  if (!paidAt) return '-';

  const hasTimezone = /[zZ]|[+-]\d{2}:\d{2}$/.test(paidAt);
  const parsed = new Date(hasTimezone ? paidAt : `${paidAt}Z`);

  if (Number.isNaN(parsed.getTime())) return '-';
  return format(parsed, 'dd/MM/yyyy HH:mm');
};

export default function ExpensesPage() {
  const searchParams =
    typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
  const selectedExpenseId = searchParams?.get('id') || null;
  const { user: currentUser } = useAuth();
  const isAdmin = currentUser?.role === 'USERADMIN' || currentUser?.role === 'USERADMINSUPER';
  const router = useRouter();

  // States Principais
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  // States de Carregamento da Ação (Salvando/Criando)
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [installmentProgress, setInstallmentProgress] = useState({ current: 0, total: 0 });

  // States do Formulário/Edição
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);

  // States de Filtro e Dados Auxiliares
  const [appliedFilters, setAppliedFilters] = useState<ExpenseFilterValues>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth() + 1);
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const [summary, setSummary] = useState<MonthlySummary | null>(null);

  // Estado de Ordenação
  const [sortConfig, setSortConfig] = useState<{
    field: 'description' | 'amount' | 'installments' | 'due_date' | 'status' | null;
    direction: 'asc' | 'desc';
  }>(() => {
    // Carregar ordenação salva do localStorage
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('expenses_sort_config');
      if (saved) {
        return JSON.parse(saved);
      }
    }
    return { field: null, direction: 'asc' };
  });

  // States de Pagamento
  const [showPaymentSourceModal, setShowPaymentSourceModal] = useState(false);
  const [expenseToPay, setExpenseToPay] = useState<Expense | null>(null);
  const [expenseToDelete, setExpenseToDelete] = useState<Expense | null>(null);

  // States para Micro-interações
  const [paidExpenseId, setPaidExpenseId] = useState<string | null>(null);
  const [triggerConfetti, setTriggerConfetti] = useState(false);

  const loadUsers = useCallback(async () => {
    try {
      // Todos os usuários podem ver a lista da família para filtros
      const usersData = await userService.getAll();
      setUsers(usersData);
    } catch (error) {
      console.error('Erro ao carregar usuários');
      setUsers([]);
    }
  }, []);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const loadExpenses = useCallback(async () => {
    try {
      setLoading(true);
      const params: any = {};

      if (appliedFilters.startDate || appliedFilters.endDate) {
        if (appliedFilters.startDate) params.start_date = appliedFilters.startDate;
        if (appliedFilters.endDate) params.end_date = appliedFilters.endDate;
      } else {
        params.month = currentMonth;
        params.year = currentYear;
      }

      if (appliedFilters.status) params.status = appliedFilters.status;
      if (appliedFilters.userId) params.user_id = appliedFilters.userId;
      if (appliedFilters.category) params.category = appliedFilters.category;

      // Busca despesas e resumo com os mesmos filtros
      const [expensesData, summaryData] = await Promise.all([
        expenseService.getAll(params),
        expenseService.getSummary(params),
      ]);
      setExpenses(expensesData);
      setSummary(summaryData);
    } catch (error) {
      toast.error('Erro ao carregar despesas');
    } finally {
      setLoading(false);
    }
  }, [appliedFilters, currentMonth, currentYear]);

  const { analyzeAfterUpload, modal: amountDivergenceModal } =
    useReceiptAmountDivergence(loadExpenses);

  useEffect(() => {
    loadExpenses();
  }, [loadExpenses]);

  // Listener para recarregar dados quando usuário for atualizado
  useEffect(() => {
    const handleUserUpdate = () => {
      loadExpenses();
    };
    window.addEventListener('userUpdated', handleUserUpdate);
    return () => window.removeEventListener('userUpdated', handleUserUpdate);
  }, [loadExpenses]);

  const handleFilterApply = (filters: ExpenseFilterValues) => {
    setAppliedFilters(filters);
  };

  const handleSort = (field: 'description' | 'amount' | 'installments' | 'due_date' | 'status') => {
    let newDirection: 'asc' | 'desc' = 'asc';

    // Se clicou no mesmo campo, inverte a direção
    if (sortConfig.field === field) {
      newDirection = sortConfig.direction === 'asc' ? 'desc' : 'asc';
    }

    const newSortConfig = { field, direction: newDirection };
    setSortConfig(newSortConfig);

    // Salvar no localStorage
    localStorage.setItem('expenses_sort_config', JSON.stringify(newSortConfig));
  };

  const getSortedExpenses = () => {
    let sorted = [...expenses];

    if (!sortConfig.field) return sorted;

    sorted.sort((a, b) => {
      let aValue: any = a[sortConfig.field as keyof Expense];
      let bValue: any = b[sortConfig.field as keyof Expense];

      // Tratamento especial para cada campo
      if (sortConfig.field === 'description') {
        aValue = (aValue || '').toLowerCase();
        bValue = (bValue || '').toLowerCase();
      } else if (sortConfig.field === 'amount') {
        // Ordenar por valor numérico
        aValue = parseFloat(aValue) || 0;
        bValue = parseFloat(bValue) || 0;
      } else if (sortConfig.field === 'installments') {
        // Extrair número de parcelas se existir
        aValue = aValue ? parseInt(aValue.toString().split('/')[0]) : 1;
        bValue = bValue ? parseInt(bValue.toString().split('/')[0]) : 1;
      } else if (sortConfig.field === 'due_date') {
        aValue = new Date(aValue).getTime();
        bValue = new Date(bValue).getTime();
      } else if (sortConfig.field === 'status') {
        // Ordenar status em ordem: aberto, atrasado, pago
        const statusOrder = { 'EM ABERTO': 0, 'NÃO PAGO': 1, PAGO: 2 };
        aValue = statusOrder[aValue as ExpenseStatus] ?? 3;
        bValue = statusOrder[bValue as ExpenseStatus] ?? 3;
      }

      if (sortConfig.direction === 'asc') {
        return aValue > bValue ? 1 : aValue < bValue ? -1 : 0;
      } else {
        return aValue < bValue ? 1 : aValue > bValue ? -1 : 0;
      }
    });

    return sorted;
  };

  const getSortIndicator = (
    field: 'description' | 'amount' | 'installments' | 'due_date' | 'status'
  ) => {
    if (sortConfig.field !== field) return ' ↕️';
    return sortConfig.direction === 'asc' ? ' ↑' : ' ↓';
  };

  const generateInstallmentGroupId = () => {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
      return (crypto as Crypto).randomUUID();
    }
    return `inst-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  };

  const createInstallments = async (baseData: ExpenseCreate, totalInstallments: number) => {
    const dueDate = new Date(baseData.due_date);
    const createdExpenses = [];
    const groupId = (baseData as any).installment_group_id || generateInstallmentGroupId();

    // Inicia contador de progresso
    setInstallmentProgress({ current: 0, total: totalInstallments });

    for (let i = 0; i < totalInstallments; i++) {
      const installmentDate = new Date(dueDate);
      installmentDate.setMonth(installmentDate.getMonth() + i);

      const installmentData = {
        ...baseData,
        installment_group_id: groupId,
        installment_number: i + 1,
        installment_total: totalInstallments,
        installments: totalInstallments,
        description: `${baseData.description} (${i + 1}/${totalInstallments})`,
        due_date: installmentDate.toISOString().split('T')[0],
      };

      try {
        // Pula notificações durante criação em lote
        const created = await expenseService.create(installmentData, true);
        createdExpenses.push(created);

        // Atualiza progresso
        setInstallmentProgress((prev) => ({ ...prev, current: i + 1 }));
      } catch (error) {
        console.error(`Erro ao criar parcela ${i + 1}:`, error);
        throw error;
      }
    }

    return createdExpenses;
  };

  const onSubmit = async (data: ExpenseCreate, category: string): Promise<boolean> => {
    try {
      setIsSubmitting(true);
      const { isRecurring, installments, ...expenseData } = data as any;
      const finalData = { ...expenseData, category, installments } as ExpenseCreate;

      if (editingExpense) {
        await expenseService.update(editingExpense._id, finalData);
        toast.success('Despesa atualizada com sucesso!');
        await loadExpenses();
      } else {
        if (isRecurring && installments > 1) {
          await createInstallments(finalData, installments);
          toast.success(`${installments} parcelas criadas com sucesso!`, { autoClose: 1000 });
        } else {
          await expenseService.create({
            ...finalData,
            installment_group_id:
              finalData.installments && finalData.installments > 1
                ? generateInstallmentGroupId()
                : undefined,
            installment_number: 1,
            installment_total: finalData.installments || 1,
            installments: finalData.installments || 1,
          });
          toast.success('Despesa criada com sucesso!', { autoClose: 1000 });
        }
        await loadExpenses();
      }
      setShowModal(false);
      setEditingExpense(null);
      return true;
    } catch (error: unknown) {
      const message = getErrorMessage(error);
      toast.error(
        message && !message.startsWith('Request failed') ? message : 'Erro ao salvar despesa'
      );
      return false;
    } finally {
      setIsSubmitting(false);
      setInstallmentProgress({ current: 0, total: 0 });
    }
  };

  const togglePaid = async (expense: Expense) => {
    if (expense.status === ExpenseStatus.PAGO) {
      try {
        await expenseService.update(expense._id, { status: ExpenseStatus.EM_ABERTO as any });
        await loadExpenses();
      } catch (error) {
        toast.error('Erro ao atualizar status de pagamento');
      }
      return;
    }

    setExpenseToPay(expense);
    setShowPaymentSourceModal(true);
  };

  const confirmPayment = async (
    paymentSource: PaymentSource,
    creditCardName?: string,
    loanName?: string,
    receiptFile?: File | null,
    payAll?: boolean
  ) => {
    if (!expenseToPay) return;

    const expense = expenseToPay;
    // Fecha o modal de pagamento imediatamente — a análise ganha a tela
    setShowPaymentSourceModal(false);
    setExpenseToPay(null);

    try {
      const updateData: any = {
        status: ExpenseStatus.PAGO,
        payment_source: paymentSource,
      };

      if (paymentSource === PaymentSource.CREDIT_CARD && creditCardName) {
        updateData.credit_card_name = creditCardName;
      }

      if (paymentSource === PaymentSource.LOAN && loanName) {
        updateData.loan_name = loanName;
      }

      let expectedAmount: number | undefined;
      if (payAll && expense.installment_group_id) {
        const settled = await expenseService.payInstallmentGroup(expense.installment_group_id, {
          payment_source: paymentSource,
          credit_card_name: creditCardName || undefined,
          loan_name: loanName || undefined,
          from_expense_id: expense._id,
        });
        expectedAmount = settled.open_amount;
        toast.success('Parcelas quitadas! 🎉');
      } else {
        await expenseService.update(expense._id, updateData);
        toast.success('Despesa marcada como paga! 🎉');
      }

      setPaidExpenseId(expense._id);
      setTriggerConfetti(true);

      if (receiptFile) {
        try {
          await analyzeAfterUpload(
            async () => {
              const uploaded = await expenseService.uploadReceipt(expense._id, receiptFile);
              clearPendingSharedReceipt();
              return uploaded;
            },
            {
              fileName: receiptFile.name,
              successToast: false,
              expectedAmount,
            }
          );
        } catch {
          toast.warning('Pago, mas o comprovante não foi enviado. Anexe depois.');
          await loadExpenses();
        }
      } else {
        await loadExpenses();
      }

      setTimeout(() => setTriggerConfetti(false), 1500);
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Erro ao atualizar despesa');
      await loadExpenses();
    }
  };

  // --- FUNÇÕES DE ALERTA VISUAL (Integradas) ---

  // Componente para renderizar o badge de alerta na data
  const RenderDateAlert = ({ expense }: { expense: Expense }) => {
    if (expense.status === ExpenseStatus.PAGO) {
      return (
        <div className="flex items-center gap-1 mt-1 text-xs font-medium text-green-600">
          <CheckCircle2 className="h-3 w-3" />
          <span>Pago em dia</span>
        </div>
      );
    }

    const diff = getDaysDiff(expense);

    if (diff < 0) {
      return (
        <div className="flex items-center gap-1 mt-1 text-xs font-bold text-red-600 animate-pulse">
          <AlertTriangle className="h-3 w-3" />
          <span>ATRASADO ({Math.abs(diff)} dias)</span>
        </div>
      );
    }

    if (diff === 0) {
      return (
        <div className="flex items-center gap-1 mt-1 text-xs font-bold text-orange-600">
          <AlertCircle className="h-3 w-3" />
          <span>VENCE HOJE!</span>
        </div>
      );
    }

    if (diff === 1) {
      return (
        <div className="flex items-center gap-1 mt-1 text-xs font-bold text-yellow-600">
          <Clock className="h-3 w-3" />
          <span>Vence Amanhã</span>
        </div>
      );
    }

    return null;
  };

  const handleEdit = (expense: Expense) => {
    setEditingExpense(expense);
    setShowModal(true);
  };

  const handleDelete = (expense: Expense) => {
    setExpenseToDelete(expense);
  };

  const confirmDelete = async () => {
    if (!expenseToDelete) return;
    try {
      await expenseService.delete(expenseToDelete._id);
      toast.success('Despesa excluída com sucesso!');
      await loadExpenses();
    } catch (error) {
      toast.error('Erro ao excluir despesa');
    } finally {
      setExpenseToDelete(null);
    }
  };

  const confirmDeleteInstallments = async () => {
    if (!expenseToDelete?.installment_group_id) return;
    try {
      await expenseService.deleteInstallmentGroup(expenseToDelete.installment_group_id, {
        onlyOpen: true,
      });
      toast.success('Parcelas em aberto excluídas com sucesso!');
      await loadExpenses();
    } catch (error) {
      toast.error('Erro ao excluir parcelas');
    } finally {
      setExpenseToDelete(null);
    }
  };

  const hasInstallmentGroup = !!(
    expenseToDelete?.installment_group_id &&
    (expenseToDelete.installment_total || expenseToDelete.installments || 0) > 1
  );

  const deleteMessage = hasInstallmentGroup
    ? 'Esta despesa faz parte de parcelas. Você pode excluir só esta parcela ou todas as parcelas em aberto. As parcelas pagas permanecem nos relatórios.'
    : 'Tem certeza que deseja excluir esta despesa?';

  const matchesExpenseSearch = (expense: Expense, query: string) => {
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

    // Valor numérico: "150", "150,50", "R$ 150,00"
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
  };

  let sortedExpenses = getSortedExpenses();
  if (selectedExpenseId) {
    sortedExpenses = sortedExpenses.filter((e) => e._id === selectedExpenseId);
  }

  const normalizedSearch = searchQuery.trim().toLowerCase();
  if (normalizedSearch) {
    sortedExpenses = sortedExpenses.filter((expense) =>
      matchesExpenseSearch(expense, searchQuery)
    );
  }

  return (
    <div className="space-y-6">
      {/* Confetti Effect */}
      <ConfettiEffect trigger={triggerConfetti} />

      {/* Modal de confirmação de exclusão */}
      <DeleteConfirmModal
        isOpen={!!expenseToDelete}
        onConfirm={confirmDelete}
        onSecondaryConfirm={hasInstallmentGroup ? confirmDeleteInstallments : undefined}
        secondaryActionLabel="Excluir todas as parcelas em aberto"
        primaryActionLabel={hasInstallmentGroup ? 'Excluir só esta parcela' : 'Excluir'}
        title={hasInstallmentGroup ? 'Excluir parcela' : 'Excluir despesa'}
        message={deleteMessage}
        onCancel={() => setExpenseToDelete(null)}
      />

      {/* ========== MOBILE LAYOUT ========== */}
      <MobileExpensesList
        expenses={sortedExpenses}
        summary={summary}
        users={users}
        loading={loading}
        searchQuery={searchQuery}
        mobileSearchOpen={mobileSearchOpen}
        appliedFilters={appliedFilters}
        selectedExpenseId={selectedExpenseId}
        paidExpenseId={paidExpenseId}
        formatPaidAt={formatPaidAt}
        onSearchQueryChange={setSearchQuery}
        onMobileSearchOpenChange={setMobileSearchOpen}
        onFilterApply={handleFilterApply}
        onNewExpense={() => {
          setEditingExpense(null);
          setShowModal(true);
        }}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onTogglePaid={togglePaid}
      />

      {/* ========== DESKTOP LAYOUT ========== */}
      <div className="hidden lg:block space-y-6" data-testid="expenses-desktop-layout">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Despesas</h1>
            <p className="mt-1 text-sm text-gray-500">Gerencie suas despesas mensais</p>
          </div>

          <button
            onClick={() => {
              setEditingExpense(null);
              setShowModal(true);
            }}
            className="flex items-center justify-center space-x-2 rounded-lg bg-gradient-to-r from-primary-600 to-primary-700 px-6 py-3 text-sm font-medium text-white hover:from-primary-700 hover:to-primary-800 shadow-lg hover:shadow-xl transition-all duration-200"
          >
            <Plus className="h-5 w-5" />
            <span>Nova Despesa</span>
          </button>
        </div>

        {/* Filters */}
        {!selectedExpenseId && (
          <div className="rounded-2xl bg-gradient-to-br from-white to-gray-50 p-6 shadow-lg border border-gray-200">
            <div className="flex items-center space-x-3 mb-5">
              <div className="p-2 bg-primary-100 rounded-lg">
                <Filter className="h-5 w-5 text-primary-600" />
              </div>
              <h3 className="text-lg font-bold text-gray-900">Filtros</h3>
            </div>
            <div className="flex flex-wrap items-center gap-4">
              <ExpenseFilter
                onApply={handleFilterApply}
                users={users}
                showUserFilter={true}
                initialFilters={appliedFilters}
              />
            </div>
          </div>
        )}

        {/* Gastos por Pessoa e Total */}
        {summary && (
          <div className="flex flex-col gap-4 w-full">
            <div className="w-full">
              <div className="rounded-xl bg-white p-6 shadow-sm border border-gray-200">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-bold text-gray-800">
                    {appliedFilters.userId
                      ? `Resumo: ${users.find((u) => u._id === appliedFilters.userId)?.full_name || 'Usuário Selecionado'}`
                      : 'Total Geral'}
                  </h3>
                  <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                    {summary.expense_count} lançamentos
                  </span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-4 bg-gray-50 rounded-lg border border-gray-100">
                    <span className="block text-sm text-gray-500 mb-1">Total</span>
                    <span className="block text-2xl font-bold text-gray-900">
                      {formatCurrency(summary.total_expenses)}
                    </span>
                  </div>
                  <div className="p-4 bg-green-50 rounded-lg border border-green-100">
                    <span className="block text-sm text-green-700 mb-1">Pago</span>
                    <span className="block text-2xl font-bold text-green-700">
                      {formatCurrency(summary.total_paid)}
                    </span>
                  </div>
                  <div className="p-4 bg-red-50 rounded-lg border border-red-100">
                    <span className="block text-sm text-red-700 mb-1">Em Aberto</span>
                    <span className="block text-2xl font-bold text-red-600">
                      {formatCurrency(summary.total_pending)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {summary.owners && summary.owners.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 w-full">
                {summary.owners.map((owner, index) => {
                  const colors = [
                    { border: 'border-l-4 border-l-blue-500', text: 'text-blue-700' },
                    { border: 'border-l-4 border-l-pink-500', text: 'text-pink-700' },
                    { border: 'border-l-4 border-l-purple-500', text: 'text-purple-700' },
                  ];
                  const style = colors[index % colors.length];

                  return (
                    <div
                      key={owner.owner}
                      className={`bg-white p-4 rounded-lg shadow-sm border border-gray-200 ${style.border}`}
                    >
                      <h3 className={`font-bold text-lg mb-3 ${style.text}`}>{owner.full_name}</h3>
                      <div className="space-y-2">
                        <div className="flex justify-between items-center border-b border-gray-100 pb-2">
                          <span className="text-gray-600 text-sm">Total</span>
                          <span className="font-bold text-gray-900">
                            {formatCurrency(owner.total_expenses)}
                          </span>
                        </div>
                        <div className="flex justify-between items-center pt-1">
                          <span className="text-green-600 text-xs font-semibold">Pago</span>
                          <span className="text-green-700 text-sm font-bold">
                            {formatCurrency(owner.total_paid)}
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-red-600 text-xs font-semibold">Aberto</span>
                          <span className="text-red-700 text-sm font-bold">
                            {formatCurrency(owner.total_pending)}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Expenses Table */}
        <div className="rounded-xl bg-gradient-to-br from-white to-gray-50 shadow-lg border border-gray-200/50 backdrop-blur-sm overflow-hidden hover:shadow-xl transition-all duration-300">
          <div className="px-4 py-3 sm:px-6 sm:py-4 border-b border-gray-200/80 bg-white/70">
            <div className="relative w-full max-w-xl">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
              <input
                type="text"
                inputMode="search"
                enterKeyHint="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar conta, valor ou data..."
                aria-label="Buscar despesas na tabela"
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
            {normalizedSearch && (
              <p className="mt-2 text-xs text-gray-500">
                {sortedExpenses.length} resultado{sortedExpenses.length === 1 ? '' : 's'} para "
                {searchQuery.trim()}"
              </p>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gradient-to-r from-gray-50 to-gray-100">
                <tr>
                  <th
                    onClick={() => handleSort('description')}
                    className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-200 transition-colors"
                    title="Clique para ordenar por descrição"
                  >
                    Descrição{getSortIndicator('description')}
                  </th>
                  <th
                    onClick={() => handleSort('amount')}
                    className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-200 transition-colors"
                    title="Clique para ordenar por valor"
                  >
                    Valor{getSortIndicator('amount')}
                  </th>
                  <th
                    onClick={() => handleSort('installments')}
                    className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-200 transition-colors"
                    title="Clique para ordenar por parcelas"
                  >
                    Parcelas{getSortIndicator('installments')}
                  </th>
                  <th
                    onClick={() => handleSort('due_date')}
                    className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-200 transition-colors"
                    title="Clique para ordenar por vencimento"
                  >
                    Vencimento{getSortIndicator('due_date')}
                  </th>
                  <th
                    onClick={() => handleSort('status')}
                    className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-200 transition-colors"
                    title="Clique para ordenar por status"
                  >
                    Status{getSortIndicator('status')}
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Ações
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-8 text-center">
                      <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
                    </td>
                  </tr>
                ) : sortedExpenses.length > 0 ? (
                  sortedExpenses.map((expense) => {
                    const installmentMatch = expense.description.match(/\((\d+)\/(\d+)\)/);
                    const currentInstallment =
                      expense.installment_number ??
                      (installmentMatch ? parseInt(installmentMatch[1]) : null);
                    const totalInstallments =
                      expense.installment_total ??
                      expense.installments ??
                      (installmentMatch ? parseInt(installmentMatch[2]) : null);
                    const hasInstallments = !!(totalInstallments && totalInstallments > 1);

                    return (
                      <tr
                        key={expense._id}
                        className={`${getRowStyle(expense)} transition-all duration-300 hover:bg-blue-50/50 ${paidExpenseId === expense._id ? 'bg-green-50' : ''}`}
                      >
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <BrandLogo description={expense.description} size="md" />
                            <div>
                              <div
                                className={`text-sm font-semibold ${paidExpenseId === expense._id ? 'line-through text-gray-400' : 'text-gray-900'} transition-all duration-500`}
                              >
                                {expense.description}
                                {selectedExpenseId && (
                                  <button
                                    className="ml-4 text-xs text-blue-600 underline"
                                    onClick={() => (window.location.href = '/dashboard/expenses')}
                                  >
                                    Voltar para todas
                                  </button>
                                )}
                              </div>
                              <div className="flex flex-wrap gap-2 mt-2">
                                {expense.category && (
                                  <span
                                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getCategoryStyle(expense.category)}`}
                                  >
                                    {expense.category}
                                  </span>
                                )}
                                {expense.investment_type && (
                                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800 border border-amber-200">
                                    {expense.investment_type}
                                  </span>
                                )}
                                {expense.payment_source === PaymentSource.CREDIT_CARD && (
                                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-orange-100 text-orange-700 border border-orange-200">
                                    Cartão de Crédito
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-semibold text-gray-900">
                            {formatCurrency(expense.amount)}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {hasInstallments && currentInstallment && totalInstallments ? (
                            <div className="space-y-1 min-w-max">
                              <div className="text-xs font-medium text-gray-600 flex justify-between">
                                <span>
                                  {currentInstallment}/{totalInstallments}
                                </span>
                                <span>
                                  {Math.round((currentInstallment / totalInstallments) * 100)}%
                                </span>
                              </div>
                              <ProgressBar
                                current={currentInstallment}
                                total={totalInstallments}
                                size="sm"
                                color="blue"
                              />
                            </div>
                          ) : (
                            <span className="text-xs text-gray-500">Única</span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          <div>
                            <span className="font-medium text-gray-800">
                              {format(new Date(expense.due_date), 'dd/MM/yyyy')}
                            </span>
                            <RenderDateAlert expense={expense} />
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <div className="flex items-center gap-2">
                                <span
                                  className={`inline-flex rounded-full px-2 text-xs font-semibold leading-5 transition-all duration-300 ${getStatusColor(expense.status)}`}
                                >
                                  {expense.status}
                                </span>
                              </div>
                              <label className="inline-flex items-center gap-2 text-xs text-gray-600 ml-1 cursor-pointer hover:bg-blue-50 p-1 rounded transition-colors duration-200">
                                <input
                                  type="checkbox"
                                  checked={expense.status === ExpenseStatus.PAGO}
                                  onChange={() => togglePaid(expense)}
                                  className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500 cursor-pointer"
                                />
                                Pago
                              </label>
                              <ReceiptActions expense={expense} onChanged={loadExpenses} />
                            </div>

                            {expense.status === ExpenseStatus.PAGO && expense.paid_at && (
                              <div className="flex items-center gap-1 text-xs text-gray-500">
                                <Clock className="h-3 w-3" />
                                <span>Pago em {formatPaidAt(expense.paid_at)}</span>
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                          <button
                            onClick={() => handleEdit(expense)}
                            className="inline-flex text-primary-600 hover:text-primary-900 hover:bg-primary-50 p-1.5 rounded-lg transition-all duration-200"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(expense)}
                            className="inline-flex text-red-600 hover:text-red-900 hover:bg-red-50 p-1.5 rounded-lg transition-all duration-200"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={6} className="px-6 py-8 text-center text-sm text-gray-500">
                      {normalizedSearch
                        ? `Nenhuma despesa encontrada para "${searchQuery.trim()}"`
                        : 'Nenhuma despesa encontrada'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Modal Nova/Editar Despesa */}
      <ExpenseFormModal
        isOpen={showModal}
        editingExpense={editingExpense}
        isSubmitting={isSubmitting}
        installmentProgress={installmentProgress}
        onSubmit={onSubmit}
        onCancel={() => {
          setShowModal(false);
          setEditingExpense(null);
        }}
      />

      {/* Modal de Fonte de Pagamento ao Marcar como Pago */}
      <PaymentSourceModal
        isOpen={showPaymentSourceModal && !!expenseToPay}
        expenseName={expenseToPay?.description || ''}
        canSettleAll={canSettleInstallments(expenseToPay)}
        settleGroupId={expenseToPay?.installment_group_id}
        settleFromExpenseId={expenseToPay?._id}
        onConfirm={confirmPayment}
        onCancel={() => {
          setShowPaymentSourceModal(false);
          setExpenseToPay(null);
        }}
      />

      {amountDivergenceModal}
    </div>
  );
}
