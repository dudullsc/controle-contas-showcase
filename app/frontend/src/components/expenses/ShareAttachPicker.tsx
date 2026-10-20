'use client';

import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { format } from 'date-fns';
import { Check, FileText, Paperclip, Search, X } from 'lucide-react';
import { toast } from 'react-toastify';
import { Expense, ExpenseStatus, PaymentSource } from '@/types';
import { expenseService } from '@/services/expense.service';
import { clearPendingSharedReceipt } from '@/lib/ccShare';
import { formatCurrency } from '@/lib/utils';
import { canSettleInstallments } from '@/lib/expenseUtils';
import BrandLogo from '@/components/expenses/BrandLogo';
import PaymentSourceModal from '@/components/expenses/PaymentSourceModal';
import { useReceiptAmountDivergence } from '@/components/expenses/ReceiptAmountDivergenceModal';

interface ShareAttachPickerProps {
  file: File;
  onClose: () => void;
}

function endOfPreviousMonth(now: Date) {
  const prev = new Date(now.getFullYear(), now.getMonth(), 0);
  const month = String(prev.getMonth() + 1).padStart(2, '0');
  const day = String(prev.getDate()).padStart(2, '0');
  return `${prev.getFullYear()}-${month}-${day}T23:59:59`;
}

function dedupeExpenses(expenses: Expense[]) {
  const seen = new Set<string>();
  const unique: Expense[] = [];
  for (const expense of expenses) {
    if (seen.has(expense._id)) continue;
    seen.add(expense._id);
    unique.push(expense);
  }
  return unique;
}

function sortByDueDate(expenses: Expense[]) {
  return [...expenses].sort(
    (a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime()
  );
}

function sortCurrentMonth(expenses: Expense[]) {
  return [...expenses].sort((a, b) => {
    const openFirst =
      Number(a.status === ExpenseStatus.PAGO) - Number(b.status === ExpenseStatus.PAGO);
    if (openFirst !== 0) return openFirst;
    return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
  });
}

function matchesSearch(expense: Expense, query: string) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return true;

  const due = new Date(expense.due_date);
  const dueBr = Number.isNaN(due.getTime()) ? '' : format(due, 'dd/MM/yyyy');
  const amountPlain = expense.amount.toFixed(2);
  const amountBr = amountPlain.replace('.', ',');

  const haystack = [
    expense.description,
    expense.category,
    expense.owner_name,
    expense.full_name,
    expense.status,
    dueBr,
    formatCurrency(expense.amount),
    amountPlain,
    amountBr,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  return haystack.includes(normalized);
}

export default function ShareAttachPicker({ file, onClose }: ShareAttachPickerProps) {
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [currentMonthExpenses, setCurrentMonthExpenses] = useState<Expense[]>([]);
  const [overdueExpenses, setOverdueExpenses] = useState<Expense[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);

  const { analyzeAfterUpload, modal: amountModal, isAnalyzing, phase } =
    useReceiptAmountDivergence(() => undefined);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const now = new Date();
        const previousEnd = endOfPreviousMonth(now);
        const [current, openPast, unpaidPast] = await Promise.all([
          expenseService.getAll({
            month: now.getMonth() + 1,
            year: now.getFullYear(),
            limit: 200,
          }),
          expenseService.getAll({
            status: ExpenseStatus.EM_ABERTO,
            end_date: previousEnd,
            limit: 200,
          }),
          expenseService.getAll({
            status: ExpenseStatus.NAO_PAGO,
            end_date: previousEnd,
            limit: 200,
          }),
        ]);
        if (cancelled) return;
        const currentIds = new Set(current.map((expense) => expense._id));
        const overdue = sortByDueDate(
          dedupeExpenses(
            [...openPast, ...unpaidPast].filter(
              (expense) =>
                !currentIds.has(expense._id) && expense.status !== ExpenseStatus.PAGO
            )
          )
        );
        setCurrentMonthExpenses(sortCurrentMonth(current));
        setOverdueExpenses(overdue);
      } catch {
        if (!cancelled) toast.error('Erro ao carregar contas');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const filteredOverdue = useMemo(
    () => overdueExpenses.filter((e) => matchesSearch(e, searchQuery)),
    [overdueExpenses, searchQuery]
  );
  const filteredCurrent = useMemo(
    () => currentMonthExpenses.filter((e) => matchesSearch(e, searchQuery)),
    [currentMonthExpenses, searchQuery]
  );
  const hasResults = filteredOverdue.length > 0 || filteredCurrent.length > 0;

  const selected =
    overdueExpenses.find((e) => e._id === selectedId) ||
    currentMonthExpenses.find((e) => e._id === selectedId) ||
    null;

  const sizeLabel =
    file.size >= 1024 * 1024
      ? `${(file.size / (1024 * 1024)).toFixed(1)} MB`
      : `${Math.max(1, Math.round(file.size / 1024))} KB`;

  const finishAndClose = () => {
    clearPendingSharedReceipt();
    onClose();
  };

  const attachToPaid = async (expense: Expense) => {
    setBusy(true);
    try {
      const updated = await analyzeAfterUpload(
        async () => expenseService.uploadReceipt(expense._id, file),
        {
          fileName: file.name,
          onReviewDone: finishAndClose,
        }
      );
      if (!updated.receipt_amount_check?.differs) {
        finishAndClose();
      }
    } catch {
      // toast já tratado
    } finally {
      setBusy(false);
    }
  };

  const handleAttachClick = () => {
    if (!selected || busy || isAnalyzing) return;
    if (selected.status === ExpenseStatus.PAGO) {
      void attachToPaid(selected);
      return;
    }
    setShowPaymentModal(true);
  };

  const confirmPayment = async (
    paymentSource: PaymentSource,
    creditCardName?: string,
    loanName?: string,
    receiptFile?: File | null,
    payAll?: boolean
  ) => {
    if (!selected) return;
    setShowPaymentModal(false);
    setBusy(true);
    try {
      const updateData: Record<string, unknown> = {
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
      if (payAll && selected.installment_group_id) {
        const settled = await expenseService.payInstallmentGroup(selected.installment_group_id, {
          payment_source: paymentSource,
          credit_card_name: creditCardName || undefined,
          loan_name: loanName || undefined,
          from_expense_id: selected._id,
        });
        expectedAmount = settled.open_amount;
        toast.success('Parcelas quitadas');
      } else {
        await expenseService.update(selected._id, updateData as any);
        toast.success('Despesa marcada como paga');
      }

      const toUpload = receiptFile || file;
      const updated = await analyzeAfterUpload(
        () => expenseService.uploadReceipt(selected._id, toUpload),
        {
          fileName: toUpload.name,
          onReviewDone: finishAndClose,
          expectedAmount,
        }
      );
      if (!updated.receipt_amount_check?.differs) {
        finishAndClose();
      }
    } catch {
      // toast já tratado
    } finally {
      setBusy(false);
    }
  };

  const renderExpense = (expense: Expense, overdue: boolean) => {
    const isSelected = selectedId === expense._id;
    const dateLabel = format(new Date(expense.due_date), overdue ? 'dd/MM/yyyy' : 'dd/MM');
    const statusLabel = overdue
      ? 'Atrasado'
      : expense.status === ExpenseStatus.PAGO
        ? 'Pago'
        : 'Em aberto';

    return (
      <li key={expense._id}>
        <button
          type="button"
          onClick={() => setSelectedId(expense._id)}
          aria-pressed={isSelected}
          className={`flex w-full items-center gap-3 rounded-2xl border px-3 py-3 text-left transition-all ${
            isSelected
              ? 'border-primary-500 bg-primary-50 shadow-md ring-2 ring-primary-500/40'
              : 'border-slate-100 bg-white shadow-sm hover:border-slate-200 hover:bg-slate-50 active:bg-slate-100'
          }`}
        >
          <BrandLogo description={expense.description} size="md" />
          <div className="min-w-0 flex-1">
            <p
              className={`truncate text-sm font-semibold ${
                isSelected ? 'text-primary-800' : 'text-slate-800'
              }`}
            >
              {expense.description}
            </p>
            <p className="truncate text-xs text-slate-400">
              {expense.category || 'Sem categoria'} · {dateLabel}
              {' · '}
              <span className={overdue ? 'font-medium text-red-600' : undefined}>
                {statusLabel}
              </span>
            </p>
            {isSelected && (
              <p className="mt-0.5 text-[11px] font-semibold text-primary-600">Selecionada</p>
            )}
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1.5">
            <p
              className={`text-sm font-semibold tabular-nums ${
                isSelected ? 'text-primary-800' : 'text-slate-800'
              }`}
            >
              {formatCurrency(expense.amount)}
            </p>
            <span
              className={`inline-flex h-6 w-6 items-center justify-center rounded-full border-2 ${
                isSelected
                  ? 'border-primary-600 bg-primary-600 text-white'
                  : 'border-slate-300 bg-white text-transparent'
              }`}
              aria-hidden
            >
              <Check className="h-3.5 w-3.5" strokeWidth={3} />
            </span>
          </div>
        </button>
      </li>
    );
  };

  if (!mounted) return null;

  const working = busy || isAnalyzing;
  const hideBehindModal = showPaymentModal || phase === 'analyzing' || phase === 'exit' || phase === 'divergence';

  return createPortal(
    <>
      <div
        className={`fixed inset-0 z-[80] flex flex-col bg-slate-50 ${
          hideBehindModal ? 'pointer-events-none' : ''
        }`}
        aria-hidden={hideBehindModal}
      >
        <header className="shrink-0 border-b border-slate-200 bg-white px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h1 className="text-lg font-semibold text-slate-900">Anexar comprovante</h1>
              <p className="text-xs text-slate-500">Escolha a conta e anexe o arquivo</p>
            </div>
            <button
              type="button"
              onClick={finishAndClose}
              disabled={working}
              className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-40"
              aria-label="Fechar"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="mt-3 flex items-center gap-2 rounded-xl border border-teal-200 bg-teal-50 px-3 py-2">
            <FileText className="h-4 w-4 shrink-0 text-teal-700" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-teal-900">{file.name}</p>
              <p className="text-[11px] text-teal-700/80">{sizeLabel}</p>
            </div>
          </div>

          <div className="relative mt-3">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              inputMode="search"
              enterKeyHint="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar conta, valor ou data..."
              className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-10 text-sm shadow-sm placeholder:text-slate-400 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/30"
              aria-label="Buscar contas"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                aria-label="Limpar busca"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-3 py-2">
          {loading ? (
            <div className="flex items-center justify-center py-16 text-sm text-slate-500">
              Carregando contas...
            </div>
          ) : !hasResults ? (
            <div className="flex flex-col items-center justify-center gap-1 py-16 text-center">
              <p className="text-sm font-medium text-slate-800">Nenhuma conta encontrada</p>
              <p className="text-xs text-slate-500">
                {searchQuery.trim()
                  ? 'Tente outro termo de busca'
                  : 'Não há despesas neste mês nem faturas atrasadas'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredOverdue.length > 0 && (
                <section>
                  <h2 className="px-1 pb-1.5 pt-1 text-xs font-semibold uppercase tracking-wide text-red-600">
                    Atrasadas
                  </h2>
                  <ul className="space-y-2">
                    {filteredOverdue.map((expense) => renderExpense(expense, true))}
                  </ul>
                </section>
              )}
              {filteredCurrent.length > 0 && (
                <section>
                  {filteredOverdue.length > 0 && (
                    <h2 className="px-1 pb-1.5 pt-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Este mês
                    </h2>
                  )}
                  <ul className="space-y-2">
                    {filteredCurrent.map((expense) => renderExpense(expense, false))}
                  </ul>
                </section>
              )}
            </div>
          )}
        </div>

        <footer className="shrink-0 border-t border-slate-200 bg-white px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
          {selected && (
            <p className="mb-2 truncate text-center text-xs text-slate-600">
              Conta:{' '}
              <span className="font-semibold text-slate-900">{selected.description}</span>
            </p>
          )}
          <button
            type="button"
            disabled={!selected || working}
            onClick={handleAttachClick}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary-600 px-4 py-3.5 text-sm font-semibold text-white shadow-sm transition enabled:hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Paperclip className="h-4 w-4" />
            {working
              ? 'Anexando...'
              : selected?.status === ExpenseStatus.PAGO
                ? 'Anexar documento'
                : 'Pagar e anexar'}
          </button>
          {!selected && (
            <p className="mt-2 text-center text-[11px] text-slate-400">
              Selecione uma conta na lista
            </p>
          )}
        </footer>
      </div>

      <PaymentSourceModal
        isOpen={showPaymentModal && !!selected}
        expenseName={selected?.description || ''}
        canSettleAll={canSettleInstallments(selected)}
        settleGroupId={selected?.installment_group_id}
        settleFromExpenseId={selected?._id}
        onConfirm={confirmPayment}
        onCancel={() => setShowPaymentModal(false)}
      />
      {amountModal}
    </>,
    document.body
  );
}
