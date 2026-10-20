'use client';

import { Loader2, Plus, Search, X } from 'lucide-react';
import { Expense, MonthlySummary, User } from '@/types';
import ExpenseFilter, { ExpenseFilterValues } from '@/components/ExpenseFilter';
import MobileExpenseCard, { shortenFullName } from '@/components/mobile/expenses/MobileExpenseCard';
import { formatCurrency } from '@/lib/utils';

export type MobileExpensesListProps = {
  expenses: Expense[];
  summary: MonthlySummary | null;
  users: User[];
  loading: boolean;
  searchQuery: string;
  mobileSearchOpen: boolean;
  appliedFilters: ExpenseFilterValues;
  selectedExpenseId: string | null;
  paidExpenseId: string | null;
  formatPaidAt: (paidAt?: string) => string;
  onSearchQueryChange: (value: string) => void;
  onMobileSearchOpenChange: (open: boolean) => void;
  onFilterApply: (filters: ExpenseFilterValues) => void;
  onNewExpense: () => void;
  onEdit: (expense: Expense) => void;
  onDelete: (expense: Expense) => void;
  onTogglePaid: (expense: Expense) => void;
};

export default function MobileExpensesList({
  expenses,
  summary,
  users,
  loading,
  searchQuery,
  mobileSearchOpen,
  appliedFilters,
  selectedExpenseId,
  paidExpenseId,
  formatPaidAt,
  onSearchQueryChange,
  onMobileSearchOpenChange,
  onFilterApply,
  onNewExpense,
  onEdit,
  onDelete,
  onTogglePaid,
}: MobileExpensesListProps) {
  const normalizedSearch = searchQuery.trim();

  return (
    <div className="lg:hidden space-y-4" data-testid="expenses-mobile-layout">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-gray-900">Despesas</h1>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onMobileSearchOpenChange(!mobileSearchOpen)}
            aria-label="Buscar despesas"
            aria-expanded={mobileSearchOpen}
            className={`inline-flex items-center justify-center h-10 w-10 rounded-xl transition-colors ${
              mobileSearchOpen || searchQuery
                ? 'bg-primary-50 text-primary-700'
                : 'text-primary-600 hover:bg-primary-50'
            }`}
          >
            <Search className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={onNewExpense}
            className="inline-flex items-center gap-1 rounded-xl bg-primary-700 px-3.5 py-2.5 text-sm font-semibold text-white shadow-sm active:bg-primary-800"
          >
            <Plus className="h-4 w-4" />
            Nova
          </button>
        </div>
      </div>

      {mobileSearchOpen && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
          <input
            type="text"
            inputMode="search"
            enterKeyHint="search"
            value={searchQuery}
            onChange={(e) => onSearchQueryChange(e.target.value)}
            placeholder="Buscar conta, valor ou data..."
            aria-label="Buscar despesas"
            autoFocus
            className="w-full pl-10 pr-10 py-2.5 border border-gray-300 rounded-xl text-sm bg-white shadow-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => onSearchQueryChange('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-md text-gray-400"
              aria-label="Limpar busca"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      )}

      {summary && (
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-2xl bg-blue-500 text-white p-3 shadow-sm">
              <p className="text-[10px] font-semibold uppercase tracking-wide opacity-90">Pago</p>
              <p className="text-sm font-bold mt-1 leading-tight break-words">
                {formatCurrency(summary.total_paid)}
              </p>
            </div>
            <div className="rounded-2xl bg-emerald-500 text-white p-3 shadow-sm">
              <p className="text-[10px] font-semibold uppercase tracking-wide opacity-90">
                Total Geral
              </p>
              <p className="text-sm font-bold mt-1 leading-tight break-words">
                {formatCurrency(summary.total_expenses)}
              </p>
            </div>
            <div className="rounded-2xl bg-orange-500 text-white p-3 shadow-sm">
              <p className="text-[10px] font-semibold uppercase tracking-wide opacity-90">
                Em Aberto
              </p>
              <p className="text-sm font-bold mt-1 leading-tight break-words">
                {formatCurrency(summary.total_pending)}
              </p>
            </div>
          </div>

          {summary.owners && summary.owners.length > 0 && (
            <div className="grid grid-cols-2 gap-2">
              {summary.owners.map((owner) => (
                <div
                  key={owner.owner}
                  className="rounded-2xl bg-white border border-gray-100 shadow-sm p-3"
                >
                  <h3 className="text-sm font-bold text-gray-900 mb-2 truncate">
                    {shortenFullName(owner.full_name || owner.owner)}
                  </h3>
                  <div className="space-y-1 text-xs">
                    <div className="flex justify-between gap-1">
                      <span className="text-gray-500">Total</span>
                      <span className="font-semibold text-gray-900">
                        {formatCurrency(owner.total_expenses)}
                      </span>
                    </div>
                    <div className="flex justify-between gap-1">
                      <span className="text-emerald-600 font-semibold uppercase text-[10px]">
                        Pago
                      </span>
                      <span className="font-semibold text-emerald-700">
                        {formatCurrency(owner.total_paid)}
                      </span>
                    </div>
                    <div className="flex justify-between gap-1">
                      <span className="text-orange-600 font-semibold text-[10px]">Aberto</span>
                      <span className="font-semibold text-orange-700">
                        {formatCurrency(owner.total_pending)}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {!selectedExpenseId && (
        <div className="flex">
          <ExpenseFilter
            onApply={onFilterApply}
            users={users}
            showUserFilter={true}
            initialFilters={appliedFilters}
          />
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
        </div>
      ) : expenses.length > 0 ? (
        <div className="space-y-3">
          {expenses.map((expense) => (
            <MobileExpenseCard
              key={expense._id}
              expense={expense}
              isPaidHighlight={paidExpenseId === expense._id}
              formatPaidAt={formatPaidAt}
              onEdit={onEdit}
              onDelete={onDelete}
              onTogglePaid={onTogglePaid}
            />
          ))}
        </div>
      ) : (
        <div className="rounded-2xl bg-white border border-gray-100 p-8 text-center text-sm text-gray-500">
          {normalizedSearch
            ? `Nenhuma despesa encontrada para "${normalizedSearch}"`
            : 'Nenhuma despesa encontrada'}
        </div>
      )}
    </div>
  );
}
