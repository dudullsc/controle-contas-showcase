'use client';

import { useState } from 'react';
import { format } from 'date-fns';
import { Check, ChevronDown, ChevronUp, Clock, Pencil, Trash2 } from 'lucide-react';
import { Expense, ExpenseStatus } from '@/types';
import BrandLogo from '@/components/expenses/BrandLogo';
import ProgressBar from '@/components/expenses/ProgressBar';
import { formatCurrency, getStatusColor, isOverdue } from '@/lib/utils';
import { getDaysDiff } from '@/lib/expenseUtils';

export function shortenFullName(fullName?: string): string {
  if (!fullName?.trim()) return '—';
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) return parts[0];
  const first = parts[0];
  const last = parts[parts.length - 1];
  return `${first.charAt(0).toUpperCase()}. ${last}`;
}

type MobileExpenseCardProps = {
  expense: Expense;
  isPaidHighlight?: boolean;
  formatPaidAt: (paidAt?: string) => string;
  onEdit: (expense: Expense) => void;
  onDelete: (expense: Expense) => void;
  onTogglePaid: (expense: Expense) => void;
};

export default function MobileExpenseCard({
  expense,
  isPaidHighlight = false,
  formatPaidAt,
  onEdit,
  onDelete,
  onTogglePaid,
}: MobileExpenseCardProps) {
  const [expanded, setExpanded] = useState(false);

  const installmentMatch = expense.description.match(/\((\d+)\/(\d+)\)/);
  const currentInstallment =
    expense.installment_number ?? (installmentMatch ? parseInt(installmentMatch[1], 10) : null);
  const totalInstallments =
    expense.installment_total ??
    expense.installments ??
    (installmentMatch ? parseInt(installmentMatch[2], 10) : null);
  const hasInstallments = !!(totalInstallments && totalInstallments > 1);
  const overdue = isOverdue(expense);
  const daysDiff = getDaysDiff(expense);
  const daysLate = Math.abs(daysDiff);
  const ownerLabel = expense.full_name || expense.owner_name;
  const paidByLabel = expense.paid_by_name || ownerLabel;
  const overdueLabel = `${daysLate} dia${daysLate === 1 ? '' : 's'} em atraso`;

  return (
    <article
      data-testid="mobile-expense-card"
      className={`rounded-2xl bg-white shadow-sm border border-gray-100 overflow-hidden transition-shadow ${
        expanded ? 'shadow-md' : ''
      } ${isPaidHighlight ? 'ring-2 ring-green-200' : ''}`}
    >
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        className="w-full text-left px-3 py-3 flex items-start gap-3"
      >
        <BrandLogo description={expense.description} size="md" />

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p
                className={`text-sm font-semibold truncate ${
                  expense.status === ExpenseStatus.PAGO ? 'text-gray-500' : 'text-gray-900'
                }`}
              >
                {expense.description}
              </p>
              <p className="text-sm font-bold text-gray-900 mt-0.5">
                {formatCurrency(expense.amount)}
              </p>
            </div>

            <div className="flex flex-col items-end gap-1 flex-shrink-0">
              {hasInstallments && currentInstallment && totalInstallments ? (
                <div className="w-20">
                  <div className="text-[10px] font-medium text-gray-500 flex justify-between mb-0.5">
                    <span>
                      {currentInstallment}/{totalInstallments}
                    </span>
                    <span>{Math.round((currentInstallment / totalInstallments) * 100)}%</span>
                  </div>
                  <ProgressBar
                    current={currentInstallment}
                    total={totalInstallments}
                    size="sm"
                    color="blue"
                  />
                </div>
              ) : null}
              {overdue ? (
                <div className="flex flex-col items-end gap-0.5 max-w-[7.5rem]">
                  <span className="inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide bg-red-100 text-red-700">
                    Atrasado
                  </span>
                  <span className="text-[10px] font-semibold text-red-600 text-right leading-tight">
                    {overdueLabel}
                  </span>
                </div>
              ) : (
                <span
                  className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${getStatusColor(expense.status)}`}
                >
                  {expense.status}
                </span>
              )}
            </div>
          </div>
        </div>

        <span className="text-gray-400 mt-1 flex-shrink-0">
          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </span>
      </button>

      {expanded && (
        <div
          className="px-3 pb-3 pt-3 border-t border-gray-50 space-y-3"
          data-testid="mobile-expense-details"
        >
          <div className="space-y-1.5 text-sm text-gray-700">
            <p className="font-medium text-gray-800">
              {format(new Date(expense.due_date), 'dd/MM/yyyy')}
            </p>

            {expense.status === ExpenseStatus.PAGO && expense.paid_at ? (
              <div className="flex items-center gap-1.5 text-xs text-gray-600">
                <Clock className="h-3.5 w-3.5 flex-shrink-0 text-gray-400" />
                <span>
                  Pago por <span className="font-semibold text-gray-800">{paidByLabel}</span> em{' '}
                  {formatPaidAt(expense.paid_at)}
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-2 pt-1">
                <div className="h-6 w-6 rounded-full bg-primary-100 flex items-center justify-center text-[10px] font-bold text-primary-700">
                  {(ownerLabel || '?').charAt(0).toUpperCase()}
                </div>
                <span className="text-xs font-medium text-gray-700">{ownerLabel}</span>
              </div>
            )}
          </div>

          <button
            type="button"
            role="switch"
            aria-checked={expense.status === ExpenseStatus.PAGO}
            aria-label={
              expense.status === ExpenseStatus.PAGO ? 'Desmarcar como pago' : 'Marcar como pago'
            }
            onClick={() => onTogglePaid(expense)}
            className={`flex w-full items-center justify-between gap-3 rounded-2xl px-3.5 py-3 transition-colors ${
              expense.status === ExpenseStatus.PAGO
                ? 'bg-emerald-50 border border-emerald-100'
                : 'bg-gray-50 border border-gray-100'
            }`}
          >
            <span className="flex items-center gap-2.5 min-w-0">
              <span
                className={`inline-flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full ${
                  expense.status === ExpenseStatus.PAGO
                    ? 'bg-emerald-500 text-white'
                    : 'bg-white text-gray-400 border border-gray-200'
                }`}
              >
                <Check className="h-4 w-4" strokeWidth={2.5} />
              </span>
              <span className="text-left min-w-0">
                <span
                  className={`block text-sm font-semibold ${
                    expense.status === ExpenseStatus.PAGO ? 'text-emerald-800' : 'text-gray-800'
                  }`}
                >
                  {expense.status === ExpenseStatus.PAGO ? 'Pago' : 'Marcar como pago'}
                </span>
                <span className="block text-[11px] text-gray-500 truncate">
                  {expense.status === ExpenseStatus.PAGO
                    ? 'Toque para reabrir'
                    : 'Confirma o pagamento desta conta'}
                </span>
              </span>
            </span>

            <span
              className={`relative inline-flex h-7 w-12 flex-shrink-0 items-center rounded-full transition-colors ${
                expense.status === ExpenseStatus.PAGO ? 'bg-emerald-500' : 'bg-gray-300'
              }`}
            >
              <span
                className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${
                  expense.status === ExpenseStatus.PAGO ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </span>
          </button>

          <div className="flex justify-end gap-4 pt-1">
            <button
              type="button"
              onClick={() => onEdit(expense)}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-primary-700"
            >
              <Pencil className="h-4 w-4" />
              Editar
            </button>
            <button
              type="button"
              onClick={() => onDelete(expense)}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-red-600"
            >
              <Trash2 className="h-4 w-4" />
              Ações
            </button>
          </div>
        </div>
      )}
    </article>
  );
}
