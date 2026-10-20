'use client';

import { useEffect, useState, useMemo } from 'react';
import { toast } from 'react-toastify';
import {
  DollarSign,
  Plus,
  Edit2,
  Trash2,
  TrendingUp,
  TrendingDown,
  X,
  Calendar,
  FileText,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { incomeService } from '@/services/income.service';
import { Income, IncomeType, IncomeCreate, IncomeUpdate, IncomeSummary, User } from '@/types';
import { formatCurrency } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { userService } from '@/services/user.service';

interface IncomeFormData {
  description: string;
  amount: string;
  income_type: IncomeType;
  payment_day?: number;
  payment_date?: string;
  notes?: string;
  user_id: string;
}

export default function IncomesPage() {
  const [incomes, setIncomes] = useState<Income[]>([]);
  const [summary, setSummary] = useState<IncomeSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingIncome, setEditingIncome] = useState<Income | null>(null);
  const [users, setUsers] = useState<Array<{ _id: string; full_name: string }>>([]);
  const { user: currentUser } = useAuth();

  // Estado de filtro de mês/ano
  const [monthYear, setMonthYear] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

  const { month, year } = useMemo(() => {
    const [yearStr, monthStr] = monthYear.split('-');
    return {
      month: Number(monthStr),
      year: Number(yearStr),
    };
  }, [monthYear]);

  // Filtro por tipo de receita
  const [filterType, setFilterType] = useState<IncomeType | 'ALL'>('ALL');

  // Estados de paginação
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  const [formData, setFormData] = useState<IncomeFormData>({
    description: '',
    amount: '',
    income_type: IncomeType.FIXED,
    payment_day: undefined,
    payment_date: undefined,
    notes: '',
    user_id: '',
  });

  // Filtrar receitas por tipo e período
  const filteredIncomes = useMemo(() => {
    return incomes.filter((income) => {
      // Filtro por tipo
      if (filterType !== 'ALL' && income.income_type !== filterType) {
        return false;
      }

      // RECEITAS FIXAS: aparecem em todos os meses se estiverem ativas
      if (income.income_type === IncomeType.FIXED && income.is_active) {
        return true;
      }

      // RECEITAS VARIÁVEIS: filtrar pela data de recebimento se existir, senão pela data de criação
      if (income.income_type === IncomeType.VARIABLE) {
        if (income.payment_date) {
          const paymentDate = new Date(income.payment_date);
          const paymentMonth = paymentDate.getMonth() + 1;
          const paymentYear = paymentDate.getFullYear();
          return paymentMonth === month && paymentYear === year;
        } else {
          const incomeDate = new Date(income.created_at);
          const incomeMonth = incomeDate.getMonth() + 1;
          const incomeYear = incomeDate.getFullYear();
          return incomeMonth === month && incomeYear === year;
        }
      }

      return false;
    });
  }, [incomes, month, year, filterType]);

  // Calcular paginação
  const paginatedIncomes = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return filteredIncomes.slice(startIndex, endIndex);
  }, [filteredIncomes, currentPage, itemsPerPage]);

  const totalPages = Math.ceil(filteredIncomes.length / itemsPerPage);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleItemsPerPageChange = (value: number) => {
    setItemsPerPage(value);
    setCurrentPage(1); // Reset para primeira página
  };

  const periodLabel = useMemo(() => {
    const date = new Date(year, month - 1, 1);
    return new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(date);
  }, [month, year]);

  const shiftPeriod = (delta: number) => {
    const date = new Date(year, month - 1 + delta, 1);
    const nextMonth = String(date.getMonth() + 1).padStart(2, '0');
    setMonthYear(`${date.getFullYear()}-${nextMonth}`);
    setCurrentPage(1);
  };

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [incomesData, summaryData, usersData] = await Promise.all([
        incomeService.list(),
        incomeService.getSummary(),
        userService.list(),
      ]);
      setIncomes(incomesData);
      setSummary(summaryData);
      setUsers(usersData.filter((u: User) => u.is_active));

      // Define usuário padrão
      if (!formData.user_id && usersData.length > 0) {
        setFormData((prev) => ({ ...prev, user_id: currentUser?._id || usersData[0]._id }));
      }
    } catch (error) {
      toast.error('Erro ao carregar receitas');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const openModal = (income?: Income) => {
    if (income) {
      setEditingIncome(income);
      // Formatar o valor para exibição (converte número para string formatada)
      const formattedAmount = new Intl.NumberFormat('pt-BR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(income.amount);

      // Formatar data se existir (YYYY-MM-DD)
      let paymentDateStr = '';
      if (income.payment_date) {
        const d = new Date(income.payment_date);
        paymentDateStr = d.toISOString().split('T')[0];
      }

      setFormData({
        description: income.description,
        amount: formattedAmount,
        income_type: income.income_type,
        payment_day: income.payment_day,
        payment_date: paymentDateStr,
        notes: income.notes || '',
        user_id: income.user_id,
      });
    } else {
      setEditingIncome(null);
      setFormData({
        description: '',
        amount: '',
        income_type: IncomeType.FIXED,
        payment_day: undefined,
        payment_date: undefined,
        notes: '',
        user_id: currentUser?._id || users[0]?._id || '',
      });
    }
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingIncome(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.description || !formData.amount) {
      toast.error('Preencha todos os campos obrigatórios');
      return;
    }

    if (!editingIncome && !formData.user_id) {
      toast.error('Selecione um usuário');
      return;
    }

    try {
      // Remove formatação e converte para número
      let amount: number;

      // Se já está formatado (ex: "1.234,56")
      if (formData.amount.includes(',')) {
        amount = parseFloat(
          formData.amount
            .replace(/\./g, '') // Remove separador de milhar
            .replace(',', '.') // Troca vírgula por ponto
        );
      } else {
        // Se é número simples
        amount = parseFloat(formData.amount.replace(/[^\d.]/g, ''));
      }

      if (isNaN(amount) || amount <= 0) {
        toast.error('Valor inválido');
        return;
      }

      if (editingIncome) {
        // Modo edição - envia apenas campos editáveis
        const updateData: IncomeUpdate = {
          description: formData.description,
          amount,
          income_type: formData.income_type,
          payment_day: formData.income_type === IncomeType.FIXED ? formData.payment_day : undefined,
          payment_date:
            formData.income_type === IncomeType.VARIABLE ? formData.payment_date : undefined,
          notes: formData.notes || undefined,
        };

        await incomeService.update(editingIncome.id, updateData);
        toast.success('Receita atualizada com sucesso!');
      } else {
        // Modo criação - inclui user_id e family_id
        const createData: IncomeCreate = {
          description: formData.description,
          amount,
          income_type: formData.income_type,
          payment_day: formData.income_type === IncomeType.FIXED ? formData.payment_day : undefined,
          payment_date:
            formData.income_type === IncomeType.VARIABLE ? formData.payment_date : undefined,
          notes: formData.notes || undefined,
          user_id: formData.user_id,
          family_id: currentUser?.family_id || '',
        };

        await incomeService.create(createData);
        toast.success('Receita criada com sucesso!');
      }

      closeModal();
      loadData();
    } catch (error: any) {
      console.error('Erro ao salvar receita:', error);
      toast.error(error.response?.data?.detail || 'Erro ao salvar receita');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir esta receita?')) return;

    try {
      await incomeService.delete(id);
      toast.success('Receita excluída com sucesso!');
      loadData();
    } catch (error) {
      toast.error('Erro ao excluir receita');
    }
  };

  const handleToggleActive = async (income: Income) => {
    try {
      await incomeService.toggleActive(income.id, !income.is_active);
      toast.success(income.is_active ? 'Receita desativada' : 'Receita ativada');
      loadData();
    } catch (error) {
      toast.error('Erro ao atualizar receita');
    }
  };

  const formatCurrencyInput = (value: string): string => {
    const numericValue = value.replace(/\D/g, '');
    if (!numericValue) return '';
    const numberValue = Number(numericValue) / 100;
    return new Intl.NumberFormat('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(numberValue);
  };

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatCurrencyInput(e.target.value);
    setFormData({ ...formData, amount: formatted });
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Extrato de Receitas</h1>
        <button
          onClick={() => openModal()}
          className="flex items-center justify-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 transition-colors w-full sm:w-auto"
        >
          <Plus className="w-5 h-5" />
          Nova Receita
        </button>
      </div>

      {/* Cards de Resumo */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Total Geral */}
          <div className="bg-gradient-to-br from-primary-500 to-primary-600 rounded-lg shadow-md p-6 text-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-primary-100 text-sm font-medium uppercase tracking-wide">
                  Total de Receitas
                </p>
                <p className="text-2xl sm:text-3xl font-bold mt-2">
                  {formatCurrency(summary.total_income)}
                </p>
                <p className="text-primary-100 text-xs mt-2">
                  {summary.active_incomes_count} receita(s) ativa(s)
                </p>
              </div>
              <div className="bg-white bg-opacity-20 rounded-full p-3">
                <DollarSign className="w-8 h-8" />
              </div>
            </div>
          </div>

          {/* Receitas Fixas */}
          <div className="bg-white rounded-lg shadow-md p-6 border-2 border-green-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm font-medium uppercase tracking-wide">
                  Receitas Fixas
                </p>
                <p className="text-2xl sm:text-3xl font-bold text-green-600 mt-2">
                  {formatCurrency(summary.total_fixed_income)}
                </p>
                <p className="text-gray-500 text-xs mt-2">Mensais recorrentes</p>
              </div>
              <div className="bg-green-100 rounded-full p-3">
                <TrendingUp className="w-8 h-8 text-green-600" />
              </div>
            </div>
          </div>

          {/* Receitas Variáveis */}
          <div className="bg-white rounded-lg shadow-md p-6 border-2 border-blue-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm font-medium uppercase tracking-wide">
                  Receitas Variáveis
                </p>
                <p className="text-2xl sm:text-3xl font-bold text-blue-600 mt-2">
                  {formatCurrency(summary.total_variable_income)}
                </p>
                <p className="text-gray-500 text-xs mt-2">Eventuais</p>
              </div>
              <div className="bg-blue-100 rounded-full p-3">
                <TrendingDown className="w-8 h-8 text-blue-600" />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Cards por Usuário */}
      {summary && summary.by_user.length > 0 && (
        <div className="bg-white rounded-lg shadow-md border border-gray-200 p-4 sm:p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-primary-600" />
            Receitas por Pessoa
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {summary.by_user.map((userSummary) => (
              <div
                key={userSummary.user_id}
                className="bg-gray-50 rounded-lg p-4 border border-gray-200"
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 font-bold text-lg flex-shrink-0">
                    {userSummary.user_name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">{userSummary.user_name}</p>
                    <p className="text-sm text-gray-500">
                      Total:{' '}
                      <span className="font-bold text-primary-600">
                        {formatCurrency(userSummary.total_income)}
                      </span>
                    </p>
                  </div>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Fixa:</span>
                    <span className="font-semibold text-green-600">
                      {formatCurrency(userSummary.fixed_income)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Variável:</span>
                    <span className="font-semibold text-blue-600">
                      {formatCurrency(userSummary.variable_income)}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Card Principal com Tabs */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        {/* Tabs de Filtro */}
        <div className="border-b border-gray-200 px-4 sm:px-6 py-4">
          <div className="flex flex-col gap-3">
            <div className="flex gap-2 sm:gap-4 overflow-x-auto -mx-1 px-1">
              <button
                onClick={() => {
                  setFilterType('ALL');
                  setCurrentPage(1);
                }}
                className={`px-3 sm:px-4 py-2 text-sm font-medium transition-colors whitespace-nowrap ${
                  filterType === 'ALL'
                    ? 'text-primary-600 border-b-2 border-primary-600'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Todas
              </button>
              <button
                onClick={() => {
                  setFilterType(IncomeType.FIXED);
                  setCurrentPage(1);
                }}
                className={`px-3 sm:px-4 py-2 text-sm font-medium transition-colors whitespace-nowrap ${
                  filterType === IncomeType.FIXED
                    ? 'text-primary-600 border-b-2 border-primary-600'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Fixas
              </button>
              <button
                onClick={() => {
                  setFilterType(IncomeType.VARIABLE);
                  setCurrentPage(1);
                }}
                className={`px-3 sm:px-4 py-2 text-sm font-medium transition-colors whitespace-nowrap ${
                  filterType === IncomeType.VARIABLE
                    ? 'text-primary-600 border-b-2 border-primary-600'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Variáveis
              </button>
            </div>

            <div className="flex items-center justify-between gap-2 rounded-lg border border-gray-200 bg-gray-50 px-2 py-1.5 sm:justify-end sm:bg-transparent sm:border-0 sm:px-0 sm:py-0">
              <button
                type="button"
                onClick={() => shiftPeriod(-1)}
                className="p-2 rounded-lg text-gray-600 hover:bg-white hover:text-primary-600 transition-colors"
                aria-label="Mês anterior"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <div className="min-w-0 flex-1 text-center sm:flex-none sm:px-3">
                <p className="text-[11px] font-medium uppercase tracking-wide text-gray-500">
                  Período
                </p>
                <p className="text-sm font-semibold text-gray-900 capitalize truncate">
                  {periodLabel}
                </p>
              </div>
              <button
                type="button"
                onClick={() => shiftPeriod(1)}
                className="p-2 rounded-lg text-gray-600 hover:bg-white hover:text-primary-600 transition-colors"
                aria-label="Próximo mês"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Cabeçalho da Tabela (desktop) */}
        <div className="hidden md:grid grid-cols-12 gap-4 px-6 py-3 bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-600 uppercase tracking-wider">
          <div className="col-span-4">DESCRIÇÃO</div>
          <div className="col-span-2">TIPO</div>
          <div className="col-span-2">RESP.</div>
          <div className="col-span-2">VALOR</div>
          <div className="col-span-2">DATA</div>
        </div>

        {/* Lista de Receitas */}
        <div>
          {filteredIncomes.length === 0 ? (
            <div className="p-8 sm:p-12 text-center text-gray-500">
              <p className="text-base sm:text-lg">Nenhuma receita cadastrada para este período.</p>
              <button
                onClick={() => openModal()}
                className="mt-4 text-primary-600 hover:text-primary-700 font-medium"
              >
                Clique aqui para cadastrar
              </button>
            </div>
          ) : (
            paginatedIncomes.map((income) => {
              const isProjected = income.income_type === IncomeType.FIXED && income.is_active;
              const getIcon = () => {
                if (income.income_type === IncomeType.FIXED) return '💰';
                return '💵';
              };
              const getIconBg = () => {
                if (income.income_type === IncomeType.FIXED) return 'bg-green-500';
                return 'bg-blue-500';
              };
              const paymentLabel =
                income.income_type === IncomeType.FIXED && income.payment_day
                  ? `Dia ${income.payment_day}`
                  : income.income_type === IncomeType.VARIABLE && income.payment_date
                    ? new Intl.DateTimeFormat('pt-BR').format(new Date(income.payment_date))
                    : '-';

              return (
                <div key={income.id} className="border-b border-gray-100 last:border-b-0">
                  {/* Mobile card */}
                  <div className="md:hidden p-4 space-y-3">
                    <div className="flex items-start gap-3">
                      <div
                        className={`w-10 h-10 rounded-full ${getIconBg()} flex items-center justify-center text-white text-lg flex-shrink-0`}
                      >
                        {getIcon()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="font-medium text-gray-900 break-words">
                              {income.description}
                            </p>
                            {income.notes && (
                              <p className="text-xs text-gray-500 mt-0.5 break-words">
                                {income.notes}
                              </p>
                            )}
                          </div>
                          <p className="text-base font-bold text-green-600 whitespace-nowrap">
                            {formatCurrency(income.amount)}
                          </p>
                        </div>
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <span
                            className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
                              income.income_type === IncomeType.FIXED
                                ? 'bg-green-100 text-green-800'
                                : 'bg-blue-100 text-blue-800'
                            }`}
                          >
                            {income.income_type === IncomeType.FIXED ? 'Fixa' : 'Variável'}
                          </span>
                          <div className="flex items-center gap-1.5 min-w-0">
                            <div className="w-5 h-5 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 text-[10px] font-semibold flex-shrink-0">
                              {income.user_name?.charAt(0).toUpperCase()}
                            </div>
                            <p className="text-xs text-gray-600 truncate">{income.user_name}</p>
                          </div>
                        </div>
                        <div className="mt-2 flex items-center justify-between gap-2">
                          <div>
                            <p className="text-sm text-gray-700">{paymentLabel}</p>
                            {isProjected && (
                              <p className="text-xs text-green-600 font-medium">Projetada</p>
                            )}
                          </div>
                          <div className="flex gap-1">
                            <button
                              onClick={() => handleToggleActive(income)}
                              className="p-1.5 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded transition-colors"
                              title={income.is_active ? 'Desativar' : 'Ativar'}
                            >
                              {income.is_active ? '✓' : '✗'}
                            </button>
                            <button
                              onClick={() => openModal(income)}
                              className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDelete(income.id)}
                              className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Desktop row */}
                  <div className="hidden md:grid grid-cols-12 gap-4 px-6 py-4 hover:bg-gray-50 transition-colors items-center">
                    <div className="col-span-4 flex items-center gap-3">
                      <div
                        className={`w-10 h-10 rounded-full ${getIconBg()} flex items-center justify-center text-white text-lg flex-shrink-0`}
                      >
                        {getIcon()}
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-gray-900 truncate">{income.description}</p>
                        {income.notes && (
                          <p className="text-xs text-gray-500 truncate">{income.notes}</p>
                        )}
                      </div>
                    </div>

                    <div className="col-span-2">
                      <span
                        className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
                          income.income_type === IncomeType.FIXED
                            ? 'bg-green-100 text-green-800'
                            : 'bg-blue-100 text-blue-800'
                        }`}
                      >
                        {income.income_type === IncomeType.FIXED ? 'Fixa' : 'Variável'}
                      </span>
                    </div>

                    <div className="col-span-2">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 text-xs font-semibold flex-shrink-0">
                          {income.user_name?.charAt(0).toUpperCase()}
                        </div>
                        <p className="text-sm text-gray-700 truncate">{income.user_name}</p>
                      </div>
                    </div>

                    <div className="col-span-2">
                      <p className="text-base font-bold text-green-600">
                        {formatCurrency(income.amount)}
                      </p>
                    </div>

                    <div className="col-span-2 flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm text-gray-700">{paymentLabel}</p>
                        {isProjected && (
                          <p className="text-xs text-green-600 font-medium">Projetada</p>
                        )}
                      </div>
                      <div className="flex gap-1 flex-shrink-0">
                        <button
                          onClick={() => handleToggleActive(income)}
                          className="p-1.5 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded transition-colors"
                          title={income.is_active ? 'Desativar' : 'Ativar'}
                        >
                          {income.is_active ? '✓' : '✗'}
                        </button>
                        <button
                          onClick={() => openModal(income)}
                          className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(income.id)}
                          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Paginação */}
        {filteredIncomes.length > 0 && totalPages > 1 && (
          <div className="px-4 sm:px-6 py-4 border-t border-gray-200 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm text-gray-600 text-center sm:text-left">
              Mostrando {(currentPage - 1) * itemsPerPage + 1} até{' '}
              {Math.min(currentPage * itemsPerPage, filteredIncomes.length)} de{' '}
              {filteredIncomes.length} receitas
            </div>

            <div className="flex items-center justify-center gap-2 flex-wrap">
              <button
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
                className="px-3 py-1 border border-gray-300 rounded-lg text-sm hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-1"
              >
                <ChevronLeft className="w-4 h-4" />
                <span className="hidden sm:inline">Anterior</span>
              </button>

              <div className="flex gap-1">
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => {
                  if (
                    page === 1 ||
                    page === totalPages ||
                    (page >= currentPage - 1 && page <= currentPage + 1)
                  ) {
                    return (
                      <button
                        key={page}
                        onClick={() => handlePageChange(page)}
                        className={`px-3 py-1 rounded-lg text-sm transition-colors ${
                          page === currentPage
                            ? 'bg-primary-600 text-white'
                            : 'border border-gray-300 hover:bg-gray-50'
                        }`}
                      >
                        {page}
                      </button>
                    );
                  } else if (page === currentPage - 2 || page === currentPage + 2) {
                    return (
                      <span key={page} className="px-2 py-1 text-gray-400">
                        ...
                      </span>
                    );
                  }
                  return null;
                })}
              </div>

              <button
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
                className="px-3 py-1 border border-gray-300 rounded-lg text-sm hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-1"
              >
                <span className="hidden sm:inline">Próximo</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modal de Criação/Edição */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center p-6 border-b">
              <h2 className="text-xl font-bold">
                {editingIncome ? 'Editar Receita' : 'Nova Receita'}
              </h2>
              <button onClick={closeModal} className="text-gray-500 hover:text-gray-700">
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Descrição *</label>
                <input
                  type="text"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder="Ex: Salário, Freelance, etc"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Valor *</label>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-gray-500">R$</span>
                  <input
                    type="text"
                    value={formData.amount}
                    onChange={handleAmountChange}
                    className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    placeholder="0,00"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tipo *</label>
                <select
                  value={formData.income_type}
                  onChange={(e) =>
                    setFormData({ ...formData, income_type: e.target.value as IncomeType })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                >
                  <option value={IncomeType.FIXED}>Fixa (Salário, Aluguel, etc)</option>
                  <option value={IncomeType.VARIABLE}>Variável (Bicos, Freelance, etc)</option>
                </select>
              </div>

              {!editingIncome && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Responsável *
                  </label>
                  <select
                    value={formData.user_id}
                    onChange={(e) => setFormData({ ...formData, user_id: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    required
                  >
                    <option value="">Selecione...</option>
                    {users.map((user) => (
                      <option key={user._id} value={user._id}>
                        {user.full_name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Mostrar "Dia do Recebimento" para FIXED */}
              {formData.income_type === IncomeType.FIXED && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Dia do Recebimento (opcional)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="31"
                    value={formData.payment_day || ''}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        payment_day: e.target.value ? parseInt(e.target.value) : undefined,
                      })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    placeholder="Ex: 5"
                  />
                </div>
              )}

              {/* Mostrar Date Picker para VARIABLE */}
              {formData.income_type === IncomeType.VARIABLE && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Data do Recebimento *
                  </label>
                  <input
                    type="date"
                    value={formData.payment_date || ''}
                    onChange={(e) => setFormData({ ...formData, payment_date: e.target.value })}
                    onClick={(e) => e.currentTarget.showPicker && e.currentTarget.showPicker()}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent cursor-pointer"
                    required
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Observações</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  rows={3}
                  placeholder="Informações adicionais..."
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={closeModal}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
                >
                  {editingIncome ? 'Atualizar' : 'Criar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
