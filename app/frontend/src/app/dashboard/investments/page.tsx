'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { format, subMonths } from 'date-fns';
import { Loader2, TrendingUp, TrendingDown } from 'lucide-react';
import { toast } from 'react-toastify';
import { expenseService } from '@/services/expense.service';
import { Expense, ExpenseStatus } from '@/types';
import { formatCurrency, getStatusColor } from '@/lib/utils';

export default function InvestmentsPage() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [previousMonthExpenses, setPreviousMonthExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
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

  const { previousMonth, previousYear } = useMemo(() => {
    const prev = new Date(year, month - 1, 1);
    return {
      previousMonth: prev.getMonth() + 1,
      previousYear: prev.getFullYear(),
    };
  }, [month, year]);

  const loadInvestments = useCallback(async () => {
    try {
      setLoading(true);
      const [current, previous] = await Promise.all([
        expenseService.getAll({ month, year, category: 'Investimento' }),
        expenseService.getAll({
          month: previousMonth,
          year: previousYear,
          category: 'Investimento',
        }),
      ]);
      setExpenses(current);
      setPreviousMonthExpenses(previous);
    } catch (error) {
      toast.error('Erro ao carregar investimentos');
      setExpenses([]);
      setPreviousMonthExpenses([]);
    } finally {
      setLoading(false);
    }
  }, [month, year, previousMonth, previousYear]);

  useEffect(() => {
    loadInvestments();
  }, [loadInvestments]);

  const totalInvested = useMemo(() => {
    return expenses.reduce((sum, exp) => sum + (exp.amount || 0), 0);
  }, [expenses]);

  const totalInvestedPrevious = useMemo(() => {
    return previousMonthExpenses.reduce((sum, exp) => sum + (exp.amount || 0), 0);
  }, [previousMonthExpenses]);

  const investmentTrend = useMemo(() => {
    if (totalInvestedPrevious === 0) return { percentage: 0, isPositive: totalInvested > 0 };
    const change = ((totalInvested - totalInvestedPrevious) / totalInvestedPrevious) * 100;
    return { percentage: Math.abs(change), isPositive: change >= 0 };
  }, [totalInvested, totalInvestedPrevious]);

  const totalsByType = useMemo(() => {
    return expenses.reduce<Record<string, number>>((acc, exp) => {
      const key = exp.investment_type || 'Não informado';
      acc[key] = (acc[key] || 0) + (exp.amount || 0);
      return acc;
    }, {});
  }, [expenses]);

  const statusBreakdown = useMemo(() => {
    return {
      paid: expenses
        .filter((e) => e.status === ExpenseStatus.PAGO)
        .reduce((sum, e) => sum + (e.amount || 0), 0),
      open: expenses
        .filter((e) => e.status === ExpenseStatus.EM_ABERTO)
        .reduce((sum, e) => sum + (e.amount || 0), 0),
      unpaid: expenses
        .filter((e) => e.status === ExpenseStatus.NAO_PAGO)
        .reduce((sum, e) => sum + (e.amount || 0), 0),
    };
  }, [expenses]);

  const maxInvestment = useMemo(() => {
    if (expenses.length === 0) return null;
    return expenses.reduce((max, exp) => (exp.amount > max.amount ? exp : max));
  }, [expenses]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Investimentos</h1>
          <p className="text-sm text-gray-600">
            Acompanhe despesas categorizadas como investimento.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <label className="text-sm font-medium text-gray-700" htmlFor="monthPicker">
            Mês/ano
          </label>
          <input
            id="monthPicker"
            type="month"
            value={monthYear}
            onChange={(e) => setMonthYear(e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-200"
          />
        </div>
      </div>

      {/* Card Principal - Total Investido */}
      <div className="rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50 to-amber-100 p-6 shadow-sm">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm font-medium text-amber-700">Total investido no período</p>
            <p className="mt-2 text-4xl font-bold text-amber-900">
              {formatCurrency(totalInvested)}
            </p>
            <p className="mt-1 text-xs text-amber-600">
              {expenses.length} lançamento{expenses.length !== 1 ? 's' : ''}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-amber-700 mb-1">vs. Mês anterior</p>
            <div className="flex items-center gap-1 justify-end">
              {investmentTrend.isPositive ? (
                <TrendingUp className="h-5 w-5 text-green-600" />
              ) : (
                <TrendingDown className="h-5 w-5 text-red-600" />
              )}
              <p
                className={`text-xl font-bold ${investmentTrend.isPositive ? 'text-green-600' : 'text-red-600'}`}
              >
                {investmentTrend.isPositive ? '+' : '-'}
                {investmentTrend.percentage.toFixed(1)}%
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Status Cards em Grid */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-green-200 bg-green-50 p-4 shadow-sm">
          <p className="text-sm font-medium text-green-700">✅ Pagos</p>
          <p className="mt-2 text-2xl font-bold text-green-900">
            {formatCurrency(statusBreakdown.paid)}
          </p>
        </div>
        <div className="rounded-2xl border border-yellow-200 bg-yellow-50 p-4 shadow-sm">
          <p className="text-sm font-medium text-yellow-700">🟡 Abertos</p>
          <p className="mt-2 text-2xl font-bold text-yellow-900">
            {formatCurrency(statusBreakdown.open)}
          </p>
        </div>
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 shadow-sm">
          <p className="text-sm font-medium text-red-700">❌ Pendentes</p>
          <p className="mt-2 text-2xl font-bold text-red-900">
            {formatCurrency(statusBreakdown.unpaid)}
          </p>
        </div>
      </div>

      {/* Maior Investimento */}
      {maxInvestment && (
        <div className="rounded-2xl border border-purple-200 bg-purple-50 p-6 shadow-sm">
          <p className="text-sm font-medium text-purple-700">🎯 Maior investimento do período</p>
          <div className="mt-3 flex items-end justify-between">
            <div>
              <p className="text-xl font-bold text-purple-900">{maxInvestment.description}</p>
              <p className="mt-1 text-sm text-purple-600">
                {maxInvestment.investment_type || 'Não informado'}
              </p>
            </div>
            <p className="text-3xl font-bold text-purple-900">
              {formatCurrency(maxInvestment.amount)}
            </p>
          </div>
          <p className="mt-3 text-xs text-purple-600">
            {format(new Date(maxInvestment.due_date), 'dd/MM/yyyy')}
          </p>
        </div>
      )}

      {/* Progresso de Investimento */}
      <div className="rounded-2xl border border-blue-200 bg-gradient-to-br from-blue-50 to-indigo-50 p-6 shadow-sm">
        <div className="flex items-start justify-between mb-4">
          <div>
            <p className="text-sm font-medium text-blue-700 uppercase tracking-wider">
              📊 Seu Investimento
            </p>
            <p className="mt-2 text-3xl font-bold text-blue-900">{formatCurrency(totalInvested)}</p>
            <p className="text-sm text-blue-600 mt-1">Total investido neste período</p>
          </div>
          <div className="text-right">
            <div className="flex items-center gap-2">
              {investmentTrend.isPositive ? (
                <TrendingUp className="w-5 h-5 text-green-600" />
              ) : (
                <TrendingDown className="w-5 h-5 text-red-600" />
              )}
              <span
                className={`text-lg font-bold ${investmentTrend.isPositive ? 'text-green-600' : 'text-red-600'}`}
              >
                {investmentTrend.percentage.toFixed(1)}%
              </span>
            </div>
            <p className="text-xs text-blue-600 mt-1">vs. mês anterior</p>
          </div>
        </div>

        {/* Comparação com mês anterior */}
        <div className="mt-6 grid grid-cols-2 gap-4">
          <div className="rounded-lg bg-white bg-opacity-60 p-3">
            <p className="text-xs text-gray-600 font-medium uppercase">Mês Anterior</p>
            <p className="text-lg font-bold text-gray-900 mt-1">
              {formatCurrency(totalInvestedPrevious)}
            </p>
          </div>
          <div className="rounded-lg bg-white bg-opacity-60 p-3">
            <p className="text-xs text-gray-600 font-medium uppercase">Diferença</p>
            <p
              className={`text-lg font-bold mt-1 ${totalInvested - totalInvestedPrevious >= 0 ? 'text-green-600' : 'text-red-600'}`}
            >
              {formatCurrency(Math.abs(totalInvested - totalInvestedPrevious))}
            </p>
          </div>
        </div>

        {/* Barra de progresso circular */}
        <div className="mt-6">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-semibold text-gray-700">Status por Modalidade</p>
            <p className="text-xs text-gray-600">
              {expenses.length} lançamento{expenses.length !== 1 ? 's' : ''}
            </p>
          </div>
          <div className="space-y-2">
            {/* Pagos */}
            <div>
              <div className="flex justify-between items-center mb-1">
                <span className="text-xs font-medium text-green-700">✓ Pagos</span>
                <span className="text-xs font-bold text-green-700">
                  {formatCurrency(statusBreakdown.paid)}
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-gradient-to-r from-green-400 to-green-600 h-2 rounded-full transition-all"
                  style={{
                    width: `${totalInvested > 0 ? (statusBreakdown.paid / totalInvested) * 100 : 0}%`,
                  }}
                />
              </div>
            </div>

            {/* Em aberto */}
            {statusBreakdown.open > 0 && (
              <div>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-xs font-medium text-yellow-700">⏳ Em Aberto</span>
                  <span className="text-xs font-bold text-yellow-700">
                    {formatCurrency(statusBreakdown.open)}
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-gradient-to-r from-yellow-400 to-yellow-600 h-2 rounded-full transition-all"
                    style={{
                      width: `${totalInvested > 0 ? (statusBreakdown.open / totalInvested) * 100 : 0}%`,
                    }}
                  />
                </div>
              </div>
            )}

            {/* Não pagos */}
            {statusBreakdown.unpaid > 0 && (
              <div>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-xs font-medium text-red-700">✗ Não Pagos</span>
                  <span className="text-xs font-bold text-red-700">
                    {formatCurrency(statusBreakdown.unpaid)}
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-gradient-to-r from-red-400 to-red-600 h-2 rounded-full transition-all"
                    style={{
                      width: `${totalInvested > 0 ? (statusBreakdown.unpaid / totalInvested) * 100 : 0}%`,
                    }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Investimentos por Tipo - Cards Individuais em Linhas */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold text-gray-900">Investimentos por tipo</h2>
        {Object.keys(totalsByType).length === 0 ? (
          <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center">
            <p className="text-sm text-gray-600">Nenhum tipo de investimento encontrado.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {Object.entries(totalsByType)
              .sort((a, b) => b[1] - a[1])
              .map(([type, total]) => {
                const typeExpenses = expenses.filter(
                  (e) => (e.investment_type || 'Não informado') === type
                );
                const paidExpenses = typeExpenses.filter((e) => e.status === ExpenseStatus.PAGO);
                const totalPaid = paidExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);
                const percentage = (total / totalInvested) * 100;
                const progressPercentage = (totalPaid / total) * 100;
                const count = typeExpenses.length;
                const paidCount = paidExpenses.length;

                return (
                  <div
                    key={type}
                    className="rounded-2xl border border-amber-200 bg-white p-4 shadow-sm hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex-1">
                        <p className="font-semibold text-gray-900">{type}</p>
                        <p className="text-xs text-gray-500 mt-1">
                          {paidCount} de {count} parcela{count !== 1 ? 's' : ''} paga
                          {paidCount !== 1 ? 's' : ''}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-bold text-amber-900">{formatCurrency(total)}</p>
                        <p className="text-sm font-semibold text-amber-600">
                          {percentage.toFixed(1)}%
                        </p>
                      </div>
                    </div>

                    {/* Barra de progresso - Progresso de pagamento */}
                    <div className="mb-3">
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-xs font-medium text-gray-600">
                          Progresso de Pagamento
                        </span>
                        <span className="text-xs font-bold text-gray-700">
                          {formatCurrency(totalPaid)} de {formatCurrency(total)}
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-3">
                        <div
                          className="bg-gradient-to-r from-amber-400 to-amber-600 h-3 rounded-full transition-all"
                          style={{ width: `${progressPercentage}%` }}
                        />
                      </div>
                    </div>

                    {/* Barra de representação no total geral */}
                    <div className="w-full bg-gray-100 rounded-full h-2">
                      <div
                        className="bg-gradient-to-r from-amber-300 to-amber-500 h-2 rounded-full transition-all"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })}
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
          <h2 className="text-lg font-semibold text-gray-900">Lançamentos</h2>
          {loading && <Loader2 className="h-5 w-5 animate-spin text-primary-600" />}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
          </div>
        ) : expenses.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-gray-600">
            Nenhum investimento cadastrado para este período.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">
                    Descrição
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">
                    Tipo
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">
                    Valor
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">
                    Vencimento
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {expenses.map((expense) => (
                  <tr key={expense._id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">
                      {expense.description}
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800 border border-amber-200">
                        {expense.investment_type || 'Não informado'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm font-semibold text-gray-900">
                      {formatCurrency(expense.amount)}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {format(new Date(expense.due_date), 'dd/MM/yyyy')}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${getStatusColor(expense.status as ExpenseStatus)}`}
                      >
                        {expense.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
