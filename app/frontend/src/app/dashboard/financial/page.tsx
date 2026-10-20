'use client';

import { useEffect, useState, useMemo } from 'react';
import { toast } from 'react-toastify';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  AlertCircle,
  CheckCircle,
  XCircle,
  Users,
  CreditCard,
  Wallet,
  PiggyBank,
  BarChart3,
  PieChart as PieChartIcon,
  Activity,
  Banknote,
} from 'lucide-react';
import { financialService } from '@/services/financial.service';
import { FinancialDashboard, FinancialHealth, TrendDirection, PaymentSource } from '@/types';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from 'recharts';
import PeriodFilter from '@/components/PeriodFilter';
import PeriodBadge from '@/components/PeriodBadge';
import { formatCurrency } from '@/lib/utils';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

export default function FinancialPage() {
  const [loading, setLoading] = useState(true);
  const [dashboard, setDashboard] = useState<FinancialDashboard | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const selectedMonth = selectedDate.getMonth() + 1;
  const selectedYear = selectedDate.getFullYear();

  const loadDashboard = async () => {
    try {
      setLoading(true);
      const data = await financialService.getDashboard(selectedMonth, selectedYear);
      setDashboard(data);
    } catch (error: any) {
      toast.error('Erro ao carregar dashboard financeiro');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboard();
  }, [selectedMonth, selectedYear]);

  // Listener para recarregar dados quando usuário for atualizado
  useEffect(() => {
    const handleUserUpdate = () => {
      loadDashboard();
    };
    window.addEventListener('userUpdated', handleUserUpdate);
    return () => window.removeEventListener('userUpdated', handleUserUpdate);
  }, []);

  const getHealthColor = (health: FinancialHealth) => {
    switch (health) {
      case FinancialHealth.EXCELLENT:
        return 'text-green-600 bg-green-50 border-green-200';
      case FinancialHealth.GOOD:
        return 'text-blue-600 bg-blue-50 border-blue-200';
      case FinancialHealth.WARNING:
        return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case FinancialHealth.CRITICAL:
        return 'text-orange-600 bg-orange-50 border-orange-200';
      case FinancialHealth.DANGER:
        return 'text-red-600 bg-red-50 border-red-200';
      default:
        return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const getHealthLabel = (health: FinancialHealth) => {
    switch (health) {
      case FinancialHealth.EXCELLENT:
        return 'Excelente';
      case FinancialHealth.GOOD:
        return 'Bom';
      case FinancialHealth.WARNING:
        return 'Atenção';
      case FinancialHealth.CRITICAL:
        return 'Crítico';
      case FinancialHealth.DANGER:
        return 'Perigo';
      default:
        return 'Desconhecido';
    }
  };

  // Dados para gráfico de fontes de pagamento
  const paymentSourceData = useMemo(() => {
    if (!dashboard?.payment_analysis) return [];
    return [
      { name: 'Salário', value: dashboard.payment_analysis.paid_with_salary, color: '#00C49F' },
      { name: 'Cartão', value: dashboard.payment_analysis.paid_with_credit_card, color: '#FF8042' },
      { name: 'Empréstimo', value: dashboard.payment_analysis.paid_with_loan, color: '#FFBB28' },
      { name: 'Poupança', value: dashboard.payment_analysis.paid_with_savings, color: '#0088FE' },
      {
        name: 'Dinheiro por fora',
        value: dashboard.payment_analysis.paid_with_other,
        color: '#8884d8',
      },
    ].filter((item) => item.value > 0);
  }, [dashboard]);

  // Dados para gráfico comparativo
  const comparisonData = useMemo(() => {
    if (!dashboard?.user_comparison?.users_summaries) return [];
    return dashboard.user_comparison.users_summaries.map((user, idx) => ({
      name: user.user_name,
      total: user.total_expenses,
      percentage: (user.total_expenses / dashboard.user_comparison.combined_total) * 100 || 0,
      color: COLORS[idx % COLORS.length],
    }));
  }, [dashboard]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (!dashboard) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Nenhum dado disponível</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">💰 Gestão Financeira</h1>
          <p className="mt-2 text-sm text-gray-600">
            Análise completa da saúde financeira e fontes de pagamento
          </p>
        </div>
        <PeriodBadge month={selectedMonth} year={selectedYear} />
      </div>

      {/* Filtro de Período */}
      <div className="bg-white rounded-lg shadow p-4">
        <PeriodFilter
          selectedMonth={selectedMonth}
          selectedYear={selectedYear}
          onPeriodChange={(month, year) => {
            setSelectedDate(new Date(year, month - 1, 1));
          }}
        />
      </div>

      {/* Saúde Financeira */}
      <div className={`rounded-lg border-2 p-6 ${getHealthColor(dashboard.financial_health)}`}>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold mb-2">Saúde Financeira</h2>
            <p className="text-lg font-semibold">{getHealthLabel(dashboard.financial_health)}</p>
            <p className="text-sm mt-1">Score: {dashboard.health_score}/100</p>
          </div>
          <div className="text-6xl font-bold opacity-50">{dashboard.health_score}</div>
        </div>
      </div>

      {/* Cards de Resumo */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-green-50 border border-green-200 rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-green-700 font-medium">Receita Fixa</p>
              <p className="text-xl font-bold text-green-800">
                {formatCurrency(dashboard.income.total_fixed_income)}
              </p>
            </div>
            <TrendingUp className="h-6 w-6 text-green-600" />
          </div>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-blue-700 font-medium">Receita Variável</p>
              <p className="text-xl font-bold text-blue-800">
                {formatCurrency(dashboard.income.total_variable_income)}
              </p>
            </div>
            <TrendingDown className="h-6 w-6 text-blue-600" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-600 font-medium">Renda Total</p>
              <p className="text-xl font-bold text-primary-600">
                {formatCurrency(dashboard.income.total_income)}
              </p>
            </div>
            <DollarSign className="h-6 w-6 text-primary-400" />
          </div>
          {!dashboard.income.both_configured && (
            <p className="text-xs text-yellow-600 mt-2">⚠️ Configure receitas</p>
          )}
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-600 font-medium">Dívidas Ativas</p>
              <p className="text-xl font-bold text-red-600">
                {formatCurrency(dashboard.total_active_debts)}
              </p>
              <p className="text-xs text-gray-500">{dashboard.active_debts_count} dívida(s)</p>
            </div>
            <CreditCard className="h-6 w-6 text-red-400" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-600 font-medium">Saldo Curto Prazo</p>
              <p
                className={`text-xl font-bold ${dashboard.short_term_balance >= 0 ? 'text-green-600' : 'text-red-600'}`}
              >
                {formatCurrency(dashboard.short_term_balance)}
              </p>
            </div>
            <Wallet className="h-6 w-6 text-blue-400" />
          </div>
        </div>
      </div>

      {/* Análise de Receitas por Usuário */}
      {dashboard.income.users_income && dashboard.income.users_income.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <Users className="h-6 w-6" />
            Receitas por Pessoa
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {dashboard.income.users_income.map((userIncome) => (
              <div key={userIncome.user_id} className="border border-gray-200 rounded-lg p-4">
                <p className="font-semibold text-gray-900 mb-2">{userIncome.user_name}</p>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Fixa:</span>
                    <span className="font-medium text-green-600">
                      {formatCurrency(userIncome.fixed_income)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Variável:</span>
                    <span className="font-medium text-blue-600">
                      {formatCurrency(userIncome.variable_income)}
                    </span>
                  </div>
                  <div className="flex justify-between pt-1 border-t">
                    <span className="text-gray-900 font-medium">Total:</span>
                    <span className="font-bold text-primary-600">
                      {formatCurrency(userIncome.total_income)}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Análise de Fontes de Pagamento */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
          <PieChartIcon className="h-6 w-6" />
          Análise de Fontes de Pagamento
        </h2>
        {dashboard.payment_analysis.total_expenses === 0 ? (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
            <p className="text-sm text-yellow-800">
              ℹ️ Não há despesas registradas para este período. As despesas aparecerão aqui quando
              forem marcadas como pagas.
            </p>
          </div>
        ) : paymentSourceData.length === 0 ? (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
            <p className="text-sm text-blue-800">
              💡 Há {formatCurrency(dashboard.payment_analysis.total_expenses)} em despesas no
              período, mas nenhuma foi marcada como paga com fonte de pagamento. Para ver a análise
              de fontes de pagamento, marque as despesas como "Pago" e informe a fonte de pagamento.
            </p>
          </div>
        ) : null}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Gráfico */}
          <div>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={paymentSourceData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={false}
                  innerRadius={58}
                  outerRadius={86}
                  paddingAngle={2}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {paymentSourceData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number) => formatCurrency(value)} />
                <Legend verticalAlign="bottom" height={36} />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Detalhes */}
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
              <div className="flex items-center gap-3">
                <DollarSign className="h-5 w-5 text-green-600" />
                <span className="font-medium">Salário</span>
              </div>
              <div className="text-right">
                <p className="font-bold text-green-600">
                  {formatCurrency(dashboard.payment_analysis.paid_with_salary)}
                </p>
                <p className="text-sm text-gray-600">
                  {dashboard.payment_analysis.paid_with_salary_percentage.toFixed(1)}%
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between p-3 bg-orange-50 rounded-lg">
              <div className="flex items-center gap-3">
                <CreditCard className="h-5 w-5 text-orange-600" />
                <span className="font-medium">Cartão de Crédito</span>
              </div>
              <div className="text-right">
                <p className="font-bold text-orange-600">
                  {formatCurrency(dashboard.payment_analysis.paid_with_credit_card)}
                </p>
                <p className="text-sm text-gray-600">
                  {dashboard.payment_analysis.paid_with_credit_card_percentage.toFixed(1)}%
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg">
              <div className="flex items-center gap-3">
                <Wallet className="h-5 w-5 text-yellow-600" />
                <span className="font-medium">Empréstimo</span>
              </div>
              <div className="text-right">
                <p className="font-bold text-yellow-600">
                  {formatCurrency(dashboard.payment_analysis.paid_with_loan)}
                </p>
                <p className="text-sm text-gray-600">
                  {dashboard.payment_analysis.paid_with_loan_percentage.toFixed(1)}%
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
              <div className="flex items-center gap-3">
                <PiggyBank className="h-5 w-5 text-blue-600" />
                <span className="font-medium">Poupança</span>
              </div>
              <div className="text-right">
                <p className="font-bold text-blue-600">
                  {formatCurrency(dashboard.payment_analysis.paid_with_savings)}
                </p>
                <p className="text-sm text-gray-600">
                  {dashboard.payment_analysis.paid_with_savings_percentage.toFixed(1)}%
                </p>
              </div>
            </div>

            {dashboard.payment_analysis.paid_with_other > 0 && (
              <div className="flex items-center justify-between p-3 bg-purple-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <Banknote className="h-5 w-5 text-purple-600" />
                  <span className="font-medium">Dinheiro por fora</span>
                </div>
                <div className="text-right">
                  <p className="font-bold text-purple-600">
                    {formatCurrency(dashboard.payment_analysis.paid_with_other)}
                  </p>
                  <p className="text-sm text-gray-600">
                    {dashboard.payment_analysis.paid_with_other_percentage.toFixed(1)}%
                  </p>
                </div>
              </div>
            )}

            <div className="p-4 bg-red-50 border-2 border-red-200 rounded-lg">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-red-800">Nível de Dependência de Crédito</span>
                <span className="text-2xl font-bold text-red-600">
                  {dashboard.payment_analysis.credit_dependency_level.toFixed(1)}%
                </span>
              </div>
              {dashboard.payment_analysis.credit_dependency_level > 50 && (
                <p className="text-sm text-red-700 mt-2">
                  ⚠️ Alto nível de dependência de crédito!
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Cards de Saldo por Usuário - NOVO */}
      {dashboard.user_comparison.users_summaries &&
        dashboard.user_comparison.users_summaries.length > 0 && (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <DollarSign className="h-6 w-6" />
              Saldo por Usuário (Receitas vs Despesas)
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {dashboard.user_comparison.users_summaries.map((user, idx) => {
                const isPositive = user.balance_all_expenses >= 0;
                const cardColors = [
                  { bg: 'bg-blue-50', border: 'border-blue-300', text: 'text-blue-900' },
                  { bg: 'bg-pink-50', border: 'border-pink-300', text: 'text-pink-900' },
                  { bg: 'bg-green-50', border: 'border-green-300', text: 'text-green-900' },
                  { bg: 'bg-purple-50', border: 'border-purple-300', text: 'text-purple-900' },
                  { bg: 'bg-yellow-50', border: 'border-yellow-300', text: 'text-yellow-900' },
                ];
                const colors = cardColors[idx % cardColors.length];

                return (
                  <div
                    key={user.user_id}
                    className={`${colors.bg} rounded-lg p-6 border-2 ${colors.border} shadow-md hover:shadow-lg transition-shadow`}
                  >
                    <div className="flex items-center justify-between mb-4">
                      <h3 className={`text-lg font-semibold ${colors.text}`}>
                        👤 {user.user_name}
                      </h3>
                      {isPositive ? (
                        <CheckCircle className="h-6 w-6 text-green-600" />
                      ) : (
                        <XCircle className="h-6 w-6 text-red-600" />
                      )}
                    </div>

                    <div className="space-y-3">
                      {/* Receitas */}
                      <div className="bg-white rounded-lg p-3 border border-gray-200">
                        <p className="text-xs font-medium text-gray-600 mb-2">💰 Receitas Totais</p>
                        <div className="space-y-1">
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-600">Fixa:</span>
                            <span className="font-semibold text-green-600">
                              {formatCurrency(user.fixed_income)}
                            </span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-600">Variável:</span>
                            <span className="font-semibold text-blue-600">
                              {formatCurrency(user.variable_income)}
                            </span>
                          </div>
                          <div className="flex justify-between pt-1 border-t border-gray-200">
                            <span className="font-medium text-gray-700">Total:</span>
                            <span className="font-bold text-primary-600">
                              {formatCurrency(user.total_income)}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Despesas */}
                      <div className="bg-white rounded-lg p-3 border border-gray-200">
                        <p className="text-xs font-medium text-gray-600 mb-2">
                          💸 Despesas Cadastradas
                        </p>
                        <p className="text-2xl font-bold text-red-600">
                          {formatCurrency(user.total_all_expenses || 0)}
                        </p>
                        <div className="mt-2 space-y-1 pt-2 border-t border-gray-200">
                          <div className="flex justify-between text-xs">
                            <span className="text-gray-600">✅ Pagas:</span>
                            <span className="font-semibold text-green-600">
                              {formatCurrency(user.total_paid_expenses || 0)}
                            </span>
                          </div>
                          <div className="flex justify-between text-xs">
                            <span className="text-gray-600">⏳ Em Aberto:</span>
                            <span className="font-semibold text-yellow-600">
                              {formatCurrency(user.total_pending_expenses || 0)}
                            </span>
                          </div>
                          <div className="flex justify-between text-xs">
                            <span className="text-gray-600">❌ Não Pagas:</span>
                            <span className="font-semibold text-red-600">
                              {formatCurrency(user.total_open_expenses || 0)}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Saldo */}
                      <div
                        className={`rounded-lg p-4 border-2 ${
                          isPositive ? 'bg-green-100 border-green-300' : 'bg-red-100 border-red-300'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span
                            className={`font-semibold ${
                              isPositive ? 'text-green-800' : 'text-red-800'
                            }`}
                          >
                            Saldo Final:
                          </span>
                          <span
                            className={`text-2xl font-bold ${
                              isPositive ? 'text-green-700' : 'text-red-700'
                            }`}
                          >
                            {formatCurrency(user.balance_all_expenses || 0)}
                          </span>
                        </div>
                        <p
                          className={`text-xs mt-2 ${
                            isPositive ? 'text-green-700' : 'text-red-700'
                          }`}
                        >
                          {isPositive
                            ? '✅ Positivo - Sobra dinheiro'
                            : '⚠️ Negativo - Faltam recursos'}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

      {/* Análise Comparativa */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
          <Users className="h-6 w-6" />
          Análise Comparativa
        </h2>

        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          {dashboard.user_comparison.users_summaries &&
            dashboard.user_comparison.users_summaries.map((user, idx) => {
              const userPercentage =
                dashboard.user_comparison.combined_total > 0
                  ? (user.total_expenses / dashboard.user_comparison.combined_total) * 100
                  : 0;
              const cardColors = [
                'bg-blue-50 border-blue-300 text-gray-900',
                'bg-pink-50 border-pink-300 text-gray-900',
                'bg-green-50 border-green-300 text-gray-900',
                'bg-purple-50 border-purple-300 text-gray-900',
                'bg-yellow-50 border-yellow-300 text-gray-900',
              ];
              const borderColors = [
                'border-blue-300',
                'border-pink-300',
                'border-green-300',
                'border-purple-300',
                'border-yellow-300',
              ];

              return (
                <div
                  key={user.user_id}
                  className={`${cardColors[idx % cardColors.length]} rounded-lg p-6 border-2 shadow-md hover:shadow-lg transition-shadow`}
                >
                  <h3 className="text-lg font-semibold mb-4 text-gray-900">👤 {user.user_name}</h3>
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Receita Fixa:</span>
                        <span className="font-medium text-green-600">
                          {formatCurrency(user.fixed_income)}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Receita Variável:</span>
                        <span className="font-medium text-blue-600">
                          {formatCurrency(user.variable_income)}
                        </span>
                      </div>
                      <div className="flex justify-between font-medium pt-1 border-t">
                        <span className="text-gray-700">Renda Total:</span>
                        <span className="font-semibold text-primary-600">
                          {formatCurrency(user.total_income)}
                        </span>
                      </div>
                    </div>
                    <div className="flex justify-between pt-2 border-t">
                      <span className="text-gray-700 font-medium">Total Gasto:</span>
                      <span className="font-semibold text-red-600">
                        {formatCurrency(user.total_expenses)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-700 font-medium">Saldo:</span>
                      <span
                        className={`font-semibold ${user.balance >= 0 ? 'text-green-600' : 'text-red-600'}`}
                      >
                        {formatCurrency(user.balance)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-700 font-medium">% do Total:</span>
                      <span className="font-semibold text-gray-900">
                        {userPercentage.toFixed(1)}%
                      </span>
                    </div>
                    {user.top_categories.length > 0 && (
                      <div
                        className={`mt-4 pt-4 border-t-2 ${borderColors[idx % borderColors.length]}`}
                      >
                        <p className="text-sm font-medium text-gray-700 mb-2">Top Categorias:</p>
                        <div className="space-y-1">
                          {user.top_categories.slice(0, 3).map((cat: any, catIdx: number) => (
                            <div key={catIdx} className="flex justify-between text-sm">
                              <span className="text-gray-700">{cat.category}</span>
                              <span className="font-semibold text-gray-900">
                                {formatCurrency(cat.total)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
        </div>

        {/* Resumo Comparativo */}
        <div className="mt-6 p-6 bg-purple-50 rounded-lg border-2 border-purple-300 shadow-md">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-700 font-medium">Maior Gasto:</p>
              <p className="text-xl font-bold text-purple-900">
                {dashboard.user_comparison.biggest_spender}
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-700 font-medium">Total Combinado:</p>
              <p className="text-xl font-bold text-purple-900">
                {formatCurrency(dashboard.user_comparison.combined_total)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Alerta de Bola de Neve Financeira */}
      {dashboard.payment_analysis.credit_dependency_level > 40 && (
        <div className="bg-gradient-to-r from-red-50 to-orange-50 border-4 border-red-300 rounded-lg p-6">
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0">
              <AlertCircle className="h-8 w-8 text-red-600" />
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-bold text-red-800 mb-2">
                🚨 ALERTA: Bola de Neve Financeira Detectada!
              </h2>
              <div className="space-y-2 text-red-700 text-sm">
                <ul className="space-y-1 ml-4">
                  <li className="flex items-start gap-2">
                    <span className="font-bold">•</span>
                    <span>
                      <strong>
                        {dashboard.payment_analysis.credit_dependency_level.toFixed(1)}%
                      </strong>{' '}
                      das suas despesas com crédito/empréstimo
                    </span>
                  </li>
                  {dashboard.payment_analysis.paid_with_credit_card_percentage > 30 && (
                    <li className="flex items-start gap-2">
                      <span className="font-bold">•</span>
                      <span>
                        <strong>
                          {dashboard.payment_analysis.paid_with_credit_card_percentage.toFixed(1)}%
                        </strong>{' '}
                        com cartão de crédito
                      </span>
                    </li>
                  )}
                  {dashboard.payment_analysis.paid_with_loan_percentage > 10 && (
                    <li className="flex items-start gap-2">
                      <span className="font-bold">•</span>
                      <span>
                        <strong>
                          {dashboard.payment_analysis.paid_with_loan_percentage.toFixed(1)}%
                        </strong>{' '}
                        com empréstimo
                      </span>
                    </li>
                  )}
                  {dashboard.monthly_debt_interest > 0 && (
                    <li className="flex items-start gap-2">
                      <span className="font-bold">•</span>
                      <span>
                        Pagando <strong>{formatCurrency(dashboard.monthly_debt_interest)}</strong>{' '}
                        de juros/mês
                      </span>
                    </li>
                  )}
                </ul>
              </div>

              <div className="mt-3 p-3 bg-white rounded-lg border border-red-200">
                <p className="font-bold text-red-800 text-xs mb-2">💡 Ações Recomendadas:</p>
                <ul className="space-y-1 text-xs text-red-700 list-disc list-inside">
                  <li>Pare de usar cartão de crédito</li>
                  <li>Priorize pagar dívidas com maior juros</li>
                  <li>Reduza gastos desnecessários</li>
                  <li>Use o salário para pagar contas</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Alertas e Sugestões */}
      {(dashboard.critical_alerts.length > 0 || dashboard.suggestions.length > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {dashboard.critical_alerts.length > 0 && (
            <div className="bg-red-50 border-2 border-red-200 rounded-lg p-6">
              <h2 className="text-xl font-semibold mb-4 flex items-center gap-2 text-red-800">
                <AlertCircle className="h-6 w-6" />
                Alertas Críticos
              </h2>
              <ul className="space-y-2">
                {dashboard.critical_alerts.map((alert, idx) => (
                  <li key={idx} className="text-sm text-red-700 flex items-start gap-2">
                    <span>•</span>
                    <span>{alert}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {dashboard.suggestions.length > 0 && (
            <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-6">
              <h2 className="text-xl font-semibold mb-4 flex items-center gap-2 text-blue-800">
                <CheckCircle className="h-6 w-6" />
                Sugestões
              </h2>
              <ul className="space-y-2">
                {dashboard.suggestions.map((suggestion, idx) => (
                  <li key={idx} className="text-sm text-blue-700 flex items-start gap-2">
                    <span>•</span>
                    <span>{suggestion}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
