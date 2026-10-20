'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'react-toastify';
import { TrendingUp, DollarSign, Calendar, AlertCircle } from 'lucide-react';
import { reportService } from '@/services/report.service';
import { expenseService } from '@/services/expense.service';
import { notificationService } from '@/services/notification.service';
import { MonthlySummary, Expense, ExpenseStatus } from '@/types';
import PeriodFilter from '@/components/PeriodFilter';
import PeriodBadge from '@/components/PeriodBadge';
import { formatCurrency, isOverdue } from '@/lib/utils';

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<MonthlySummary | null>(null);
  const [recentExpenses, setRecentExpenses] = useState<Expense[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());

  const selectedMonth = selectedDate.getMonth() + 1;
  const selectedYear = selectedDate.getFullYear();

  const handlePeriodChange = (month: number, year: number) => {
    setSelectedDate(new Date(year, month - 1, 1));
  };

  const loadDashboardData = useCallback(async () => {
    try {
      setLoading(true);
      const [summaryData, expensesData] = await Promise.all([
        reportService.getMonthlySummary(selectedMonth, selectedYear),
        expenseService.getAll({ month: selectedMonth, year: selectedYear, limit: 100 }),
      ]);
      setSummary(summaryData);
      setRecentExpenses(expensesData);

      // 🔔 No app nativo o cc-bridge cuida das notificações (evita duplicar na cortina)
      const runningInNativeApp =
        typeof window !== 'undefined' &&
        (!!(window as Window & { __CONTROLE_CONTAS_APP__?: boolean }).__CONTROLE_CONTAS_APP__ ||
          notificationService.isRunningInApp());

      void runningInNativeApp; // Notificações enviadas via FCM pelo backend
    } catch (error: any) {
      toast.error('Erro ao carregar dados');
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, [selectedMonth, selectedYear]);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  // Listener para recarregar dados quando usuário for atualizado
  useEffect(() => {
    const handleUserUpdate = () => {
      loadDashboardData();
    };
    window.addEventListener('userUpdated', handleUserUpdate);
    return () => window.removeEventListener('userUpdated', handleUserUpdate);
  }, [loadDashboardData]);

  const totalOverdue = useMemo(() => {
    return recentExpenses.filter((exp) => isOverdue(exp)).reduce((sum, exp) => sum + exp.amount, 0);
  }, [recentExpenses]);

  const overdueCount = useMemo(() => {
    return recentExpenses.filter((exp) => isOverdue(exp)).length;
  }, [recentExpenses]);

  const statusData = useMemo(() => {
    if (!summary) return [];

    // Pending da API inclui atrasados — separamos para a barra não misturar
    const openOnTime = Math.max(0, (summary.total_pending || 0) - totalOverdue);

    return [
      { name: 'Pago', value: summary.total_paid || 0, color: '#10b981' },
      { name: 'Em Aberto', value: openOnTime, color: '#f59e0b' },
      { name: 'Em Atraso', value: totalOverdue, color: '#dc2626', count: overdueCount },
    ];
  }, [summary, totalOverdue, overdueCount]);

  const statusTotal = useMemo(
    () => statusData.reduce((acc, item) => acc + item.value, 0),
    [statusData]
  );

  const topCategoriesData = useMemo(() => {
    if (!summary?.expenses_by_category) return [];

    return summary.expenses_by_category.slice(0, 5).map((item) => ({
      ...item,
      shortCategory:
        item.category.length > 18 ? `${item.category.slice(0, 18).trimEnd()}...` : item.category,
    }));
  }, [summary]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header com Filtros */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Dashboard</h1>
          <p className="mt-1 text-sm text-gray-500">Visão geral das suas finanças</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <PeriodFilter
            selectedMonth={selectedMonth}
            selectedYear={selectedYear}
            onPeriodChange={handlePeriodChange}
          />

          {/* Indicador do Período Selecionado */}
          <PeriodBadge month={selectedMonth} year={selectedYear} />
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-5">
        <div className="rounded-xl bg-white p-6 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total do Mês</p>
              <p className="mt-2 text-2xl font-bold text-gray-900">
                {formatCurrency(summary?.total_expenses || 0)}
              </p>
            </div>
            <div className="rounded-full bg-primary-100 p-3">
              <DollarSign className="h-6 w-6 text-primary-600" />
            </div>
          </div>
        </div>

        <div className="rounded-xl bg-white p-6 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Pago</p>
              <p className="mt-2 text-2xl font-bold text-green-600">
                {formatCurrency(summary?.total_paid || 0)}
              </p>
            </div>
            <div className="rounded-full bg-green-100 p-3">
              <TrendingUp className="h-6 w-6 text-green-600" />
            </div>
          </div>
        </div>

        <div className="rounded-xl bg-white p-6 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Em Aberto</p>
              <p className="mt-2 text-2xl font-bold text-yellow-600">
                {formatCurrency(summary?.total_pending || 0)}
              </p>
            </div>
            <div className="rounded-full bg-yellow-100 p-3">
              <AlertCircle className="h-6 w-6 text-yellow-600" />
            </div>
          </div>
        </div>

        <div className="rounded-xl bg-white p-6 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Em Atraso</p>
              <p className="mt-2 text-2xl font-bold text-red-600">{formatCurrency(totalOverdue)}</p>
              <p className="text-xs text-gray-500 mt-1">{overdueCount} conta(s)</p>
            </div>
            <div className="rounded-full bg-red-100 p-3">
              <AlertCircle className="h-6 w-6 text-red-600" />
            </div>
          </div>
        </div>

        <div className="rounded-xl bg-white p-6 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Despesas</p>
              <p className="mt-2 text-2xl font-bold text-gray-900">{summary?.expense_count || 0}</p>
            </div>
            <div className="rounded-full bg-gray-100 p-3">
              <Calendar className="h-6 w-6 text-gray-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Cards de Receitas */}
      {summary && (
        <div className="grid gap-6 md:grid-cols-3">
          <div className="rounded-xl bg-gradient-to-br from-green-50 to-emerald-50 p-6 shadow-sm border border-green-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-green-700">Receita Fixa</p>
                <p className="mt-2 text-2xl font-bold text-green-900">
                  {formatCurrency(summary.total_fixed_income || 0)}
                </p>
                <p className="text-xs text-green-600 mt-1">Salários e receitas fixas</p>
              </div>
              <div className="rounded-full bg-green-100 p-3">
                <TrendingUp className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </div>

          <div className="rounded-xl bg-gradient-to-br from-blue-50 to-cyan-50 p-6 shadow-sm border border-blue-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-blue-700">Receita Variável</p>
                <p className="mt-2 text-2xl font-bold text-blue-900">
                  {formatCurrency(summary.total_variable_income || 0)}
                </p>
                <p className="text-xs text-blue-600 mt-1">Bicos, freelance e comissões</p>
              </div>
              <div className="rounded-full bg-blue-100 p-3">
                <TrendingUp className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </div>

          <div className="rounded-xl bg-gradient-to-br from-purple-50 to-indigo-50 p-6 shadow-sm border border-purple-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-purple-700">Total de Receitas</p>
                <p className="mt-2 text-2xl font-bold text-purple-900">
                  {formatCurrency(summary.total_income || 0)}
                </p>
                <p className="text-xs text-purple-600 mt-1">Fixo + Variável</p>
              </div>
              <div className="rounded-full bg-purple-100 p-3">
                <DollarSign className="h-6 w-6 text-purple-600" />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Gastos por Pessoa */}
      {summary?.owners && summary.owners.length > 0 ? (
        <div
          className={`grid gap-6 ${summary.owners.length === 1 ? 'md:grid-cols-2' : summary.owners.length === 2 ? 'md:grid-cols-3' : 'md:grid-cols-4'}`}
        >
          {summary.owners.map((owner, index) => {
            const colors = [
              {
                bg: 'bg-blue-50',
                border: 'border-blue-300',
                heading: 'text-blue-900',
                subHeading: 'text-blue-700',
                count: 'text-blue-600',
                borderTop: 'border-blue-300',
              },
              {
                bg: 'bg-pink-50',
                border: 'border-pink-300',
                heading: 'text-pink-900',
                subHeading: 'text-pink-700',
                count: 'text-pink-600',
                borderTop: 'border-pink-300',
              },
              {
                bg: 'bg-purple-50',
                border: 'border-purple-300',
                heading: 'text-purple-900',
                subHeading: 'text-purple-700',
                count: 'text-purple-600',
                borderTop: 'border-purple-300',
              },
              {
                bg: 'bg-green-50',
                border: 'border-green-300',
                heading: 'text-green-900',
                subHeading: 'text-green-700',
                count: 'text-green-600',
                borderTop: 'border-green-300',
              },
              {
                bg: 'bg-orange-50',
                border: 'border-orange-300',
                heading: 'text-orange-900',
                subHeading: 'text-orange-700',
                count: 'text-orange-600',
                borderTop: 'border-orange-300',
              },
            ];
            const color = colors[index % colors.length];

            return (
              <div
                key={owner.owner}
                className={`rounded-xl ${color.bg} p-6 shadow-md border-2 ${color.border} hover:shadow-lg transition-shadow`}
              >
                <h3 className={`text-lg font-semibold ${color.heading} mb-4`}>
                  Gasto {owner.full_name || owner.owner}
                </h3>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className={`text-sm font-medium ${color.subHeading}`}>Total:</span>
                    <span className={`text-lg font-bold ${color.heading}`}>
                      {formatCurrency(owner.total_expenses)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-green-700">Pago:</span>
                    <span className="text-md font-semibold text-green-700">
                      {formatCurrency(owner.total_paid)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-yellow-700">Em Aberto:</span>
                    <span className="text-md font-semibold text-yellow-700">
                      {formatCurrency(owner.total_pending)}
                    </span>
                  </div>
                  <div
                    className={`flex justify-between items-center pt-2 border-t-2 ${color.borderTop}`}
                  >
                    <span className={`text-xs font-semibold ${color.count}`}>Despesas:</span>
                    <span className={`text-sm font-medium ${color.heading}`}>
                      {owner.expense_count}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}

          {/* Total Geral */}
          <div className="rounded-xl bg-gray-50 p-6 shadow-md border-2 border-gray-300">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Total Geral</h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-gray-700">Total:</span>
                <span className="text-lg font-bold text-gray-900">
                  {formatCurrency(summary.total_expenses)}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-green-700">Pago:</span>
                <span className="text-md font-semibold text-green-700">
                  {formatCurrency(summary.total_paid)}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-red-700">Aberto:</span>
                <span className="text-md font-semibold text-red-700">
                  {formatCurrency(summary.total_pending)}
                </span>
              </div>
              <div className="flex justify-between items-center pt-2 border-t-2 border-gray-300">
                <span className="text-xs font-semibold text-gray-600">Despesas:</span>
                <span className="text-sm font-medium text-gray-900">{summary.expense_count}</span>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* Gastos do período — Option C: stacked status + category ranking */}
      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:p-6">
        <div className="mb-5 sm:mb-6">
          <h3 className="text-base font-semibold text-gray-900">Gastos do período</h3>
          <p className="mt-0.5 text-sm text-gray-500">
            Status das despesas e categorias com maior impacto
          </p>
        </div>

        {statusTotal > 0 || topCategoriesData.length > 0 ? (
          <div className="space-y-6 sm:space-y-8">
            {/* Stacked status bar */}
            <div>
              <div className="mb-3 flex items-center justify-between gap-2">
                <p className="text-sm font-medium text-gray-700">Distribuição por status</p>
                <p className="text-sm font-semibold tabular-nums text-gray-900">
                  {formatCurrency(statusTotal)}
                </p>
              </div>

              {statusTotal > 0 ? (
                <>
                  <div className="flex h-3.5 w-full overflow-hidden rounded-full bg-gray-100 sm:h-3">
                    {statusData.map((item) => {
                      const width = (item.value / statusTotal) * 100;
                      if (width <= 0) return null;
                      return (
                        <div
                          key={item.name}
                          className="h-full first:rounded-l-full last:rounded-r-full"
                          style={{ width: `${width}%`, backgroundColor: item.color }}
                          title={`${item.name}: ${formatCurrency(item.value)}`}
                        />
                      );
                    })}
                  </div>

                  {/* Mobile: stacked rows / Desktop: wrap legend */}
                  <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3 sm:gap-3">
                    {statusData.map((item) => {
                      const percent = statusTotal > 0 ? (item.value / statusTotal) * 100 : 0;
                      const count =
                        'count' in item && typeof item.count === 'number' ? item.count : null;
                      return (
                        <div
                          key={item.name}
                          className="flex items-center justify-between gap-3 rounded-lg bg-gray-50 px-3 py-2.5 sm:flex-col sm:items-start sm:justify-start"
                        >
                          <div className="flex items-center gap-2">
                            <span
                              className="h-2.5 w-2.5 flex-shrink-0 rounded-full"
                              style={{ backgroundColor: item.color }}
                            />
                            <span className="text-sm text-gray-600">{item.name}</span>
                            {count !== null && count > 0 && (
                              <span className="text-xs text-gray-400">({count})</span>
                            )}
                          </div>
                          <div className="flex items-baseline gap-2 sm:mt-1">
                            <span className="text-sm font-semibold tabular-nums text-gray-900">
                              {formatCurrency(item.value)}
                            </span>
                            <span className="text-xs tabular-nums text-gray-400">
                              {percent.toFixed(0)}%
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              ) : (
                <p className="text-sm text-gray-400">Sem dados de status neste período.</p>
              )}
            </div>

            {/* Category ranking */}
            <div>
              <p className="mb-3 text-sm font-medium text-gray-700">Top categorias</p>
              {topCategoriesData.length > 0 ? (
                <ul className="divide-y divide-gray-100">
                  {topCategoriesData.map((item, index) => {
                    const maxTotal = topCategoriesData[0]?.total || 1;
                    const barWidth = Math.max((item.total / maxTotal) * 100, 4);
                    return (
                      <li key={item.category} className="py-3 first:pt-0 last:pb-0">
                        <div className="mb-1.5 flex items-start gap-2 sm:items-center sm:gap-3">
                          <span className="mt-0.5 w-5 flex-shrink-0 text-xs font-semibold tabular-nums text-gray-400 sm:mt-0">
                            {index + 1}
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-col gap-0.5 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                              <span className="truncate text-sm font-medium text-gray-800">
                                {item.category}
                              </span>
                              <span className="text-sm font-semibold tabular-nums text-gray-900">
                                {formatCurrency(item.total)}
                              </span>
                            </div>
                            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-gray-100">
                              <div
                                className="h-full rounded-full bg-primary-600"
                                style={{ width: `${barWidth}%` }}
                              />
                            </div>
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="text-sm text-gray-400">Nenhuma categoria neste período.</p>
              )}
            </div>
          </div>
        ) : (
          <div className="flex h-32 items-center justify-center text-sm text-gray-400 sm:h-40">
            Nenhum dado disponível
          </div>
        )}
      </div>

      {/* Alerta/Sugestão Inteligente */}
      {summary &&
        (() => {
          const totalExpenses = summary.total_expenses || 0;
          const totalPaid = summary.total_paid || 0;
          const totalPending = summary.total_pending || 0;
          const paidPercentage = totalExpenses > 0 ? (totalPaid / totalExpenses) * 100 : 0;
          const topCategory = summary.expenses_by_category?.[0];
          const topCategoryPercentage =
            totalExpenses > 0 && topCategory ? (topCategory.total / totalExpenses) * 100 : 0;

          // Lógica de alertas
          let alertType: 'success' | 'warning' | 'danger' = 'success';
          let title = '';
          let message = '';
          let suggestions: string[] = [];

          if (totalOverdue > 0) {
            alertType = 'danger';
            title = '🚨 Atenção: Despesas Atrasadas!';
            message = `Você tem ${overdueCount} despesa(s) atrasada(s) totalizando ${formatCurrency(totalOverdue)}.`;
            suggestions = [
              'Priorize o pagamento das despesas atrasadas para evitar juros e multas',
              'Acesse a página de Despesas para ver os detalhes e marcar como pagas',
              'Considere usar a aba "Gestão Financeira" para ver estratégias de pagamento',
            ];
          } else if (totalPending > 0 && paidPercentage < 50) {
            alertType = 'warning';
            title = '⚠️ Muitas Despesas em Aberto';
            message = `Você tem ${formatCurrency(totalPending)} em despesas pendentes (${(100 - paidPercentage).toFixed(0)}% do total).`;
            suggestions = [
              'Organize o pagamento das despesas pendentes antes do vencimento',
              'Verifique se há despesas que podem ser pagas antecipadamente',
              'Monitore as datas de vencimento para evitar atrasos',
            ];
          } else if (topCategoryPercentage > 40) {
            alertType = 'warning';
            title = '💡 Concentração de Gastos';
            message = `${topCategory?.category || 'Uma categoria'} representa ${topCategoryPercentage.toFixed(0)}% dos seus gastos (${formatCurrency(topCategory?.total || 0)}).`;
            suggestions = [
              'Considere revisar os gastos nesta categoria',
              'Avalie se há oportunidades de economia',
              'Compare com meses anteriores na aba Relatórios',
            ];
          } else if (paidPercentage >= 80) {
            alertType = 'success';
            title = '✅ Excelente Controle Financeiro!';
            message = `${paidPercentage.toFixed(0)}% das suas despesas já foram pagas este mês.`;
            suggestions = [
              'Continue mantendo essa organização',
              'Considere criar uma reserva de emergência',
              'Acesse a aba "Previsões" para planejar o futuro',
            ];
          } else if (totalExpenses === 0) {
            alertType = 'success';
            title = '📊 Nenhuma Despesa Registrada';
            message = 'Não há despesas registradas para este período.';
            suggestions = [
              'Adicione suas despesas na página de Despesas',
              'Configure categorias para melhor organização',
              'Use a aba "Previsões" para planejar seus gastos futuros',
            ];
          } else {
            alertType = 'success';
            title = '👍 Situação Financeira Estável';
            message = `Você está com ${paidPercentage.toFixed(0)}% das despesas pagas.`;
            suggestions = [
              'Continue acompanhando suas despesas regularmente',
              'Use a aba "Gestão Financeira" para análises mais detalhadas',
            ];
          }

          const bgColors = {
            success: 'bg-green-50 border-green-200',
            warning: 'bg-yellow-50 border-yellow-200',
            danger: 'bg-red-50 border-red-200',
          };

          const textColors = {
            success: 'text-green-800',
            warning: 'text-yellow-800',
            danger: 'text-red-800',
          };

          const iconColors = {
            success: 'text-green-600',
            warning: 'text-yellow-600',
            danger: 'text-red-600',
          };

          return (
            <div
              className={`rounded-xl shadow-lg border-2 p-8 ${
                alertType === 'success'
                  ? 'bg-gradient-to-br from-green-50 to-emerald-50 border-green-300'
                  : alertType === 'warning'
                    ? 'bg-gradient-to-br from-yellow-50 to-amber-50 border-yellow-300'
                    : 'bg-gradient-to-br from-red-50 to-orange-50 border-red-300'
              } hover:shadow-xl transition-shadow`}
            >
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0">
                  <div
                    className={`rounded-full p-3 ${
                      alertType === 'success'
                        ? 'bg-green-100'
                        : alertType === 'warning'
                          ? 'bg-yellow-100'
                          : 'bg-red-100'
                    }`}
                  >
                    <AlertCircle className={`h-8 w-8 ${iconColors[alertType]}`} />
                  </div>
                </div>
                <div className="flex-1">
                  <h3 className={`text-2xl font-bold mb-2 ${textColors[alertType]}`}>{title}</h3>
                  <p className={`text-base mb-4 font-semibold ${textColors[alertType]}`}>
                    {message}
                  </p>
                  {suggestions.length > 0 && (
                    <div
                      className={`mt-6 pt-4 border-t-2 ${
                        alertType === 'success'
                          ? 'border-green-300'
                          : alertType === 'warning'
                            ? 'border-yellow-300'
                            : 'border-red-300'
                      }`}
                    >
                      <p className={`text-base font-bold mb-3 ${textColors[alertType]}`}>
                        💡 Sugestões:
                      </p>
                      <ul className="space-y-2">
                        {suggestions.map((suggestion, idx) => (
                          <li
                            key={idx}
                            className={`text-sm font-medium ${textColors[alertType]} flex items-start gap-3 p-2 rounded-lg ${
                              alertType === 'success'
                                ? 'bg-green-100 bg-opacity-50'
                                : alertType === 'warning'
                                  ? 'bg-yellow-100 bg-opacity-50'
                                  : 'bg-red-100 bg-opacity-50'
                            }`}
                          >
                            <span className="font-bold text-lg">→</span>
                            <span>{suggestion}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })()}
    </div>
  );
}
