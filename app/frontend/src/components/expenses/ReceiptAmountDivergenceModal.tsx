'use client';

import { useEffect, useState, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, FileSearch, Loader2, Sparkles } from 'lucide-react';
import { toast } from 'react-toastify';
import { Expense, ReceiptAmountCheck } from '@/types';
import { expenseService } from '@/services/expense.service';
import { compareReceiptAmount } from '@/lib/expenseUtils';
import { formatCurrency } from '@/lib/utils';

interface ReceiptAmountDivergenceModalProps {
  expenseName: string;
  check: ReceiptAmountCheck;
  updating: boolean;
  onKeep: () => void;
  onUpdate: () => void;
  amountLabel?: string;
  message?: string;
  /** Quitar dívida compara a soma; não substitui o valor de uma parcela. */
  allowReplace?: boolean;
}

function ModalPortal({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted || typeof document === 'undefined') return null;
  return createPortal(children, document.body);
}

export function ReceiptAmountDivergenceModal({
  expenseName,
  check,
  updating,
  onKeep,
  onUpdate,
  amountLabel = 'Valor da despesa',
  message,
  allowReplace = true,
}: ReceiptAmountDivergenceModalProps) {
  const diff = check.detected_amount - check.expense_amount;

  return (
    <ModalPortal>
      <div className="fixed inset-0 z-[300] overflow-hidden">
        <div className="flex h-[100dvh] items-end justify-center lg:items-center p-0 lg:p-4">
          <div
            className="fixed inset-0 bg-gray-900/50 backdrop-blur-[2px]"
            aria-hidden
          />
          <div className="relative w-full max-w-none lg:max-w-md rounded-t-3xl lg:rounded-2xl bg-white shadow-2xl receipt-modal-enter opacity-100 pb-[env(safe-area-inset-bottom)]">
            <div className="flex justify-center pt-3 pb-1 lg:hidden">
              <div className="h-1 w-10 rounded-full bg-gray-300" aria-hidden />
            </div>
            <div className="px-5 pt-2 pb-5 lg:pt-5 lg:px-6">
          <div className="flex items-start gap-3">
            <div className="rounded-full bg-amber-100 p-2 shrink-0">
              <AlertTriangle className="h-5 w-5 text-amber-700" />
            </div>
            <div className="min-w-0">
              <h2 className="text-lg font-semibold text-gray-900">Divergência de valor</h2>
              <p className="mt-1 text-sm text-gray-600">
                {message || (
                  <>
                    O comprovante de <span className="font-medium text-gray-800">{expenseName}</span>{' '}
                    parece ter um valor diferente da despesa.
                  </>
                )}
              </p>
            </div>
          </div>

          <div className="mt-4 rounded-xl border border-gray-200 bg-gray-50 p-3 space-y-2 text-sm">
            <div className="flex justify-between gap-3">
              <span className="text-gray-600">{amountLabel}</span>
              <span className="font-semibold text-gray-900">{formatCurrency(check.expense_amount)}</span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-gray-600">Valor no comprovante</span>
              <span className="font-semibold text-teal-800">
                {formatCurrency(check.detected_amount)}
              </span>
            </div>
            <div className="flex justify-between gap-3 border-t border-gray-200 pt-2">
              <span className="text-gray-600">Diferença</span>
              <span className={`font-semibold ${diff > 0 ? 'text-amber-700' : 'text-blue-700'}`}>
                {diff > 0 ? '+' : ''}
                {formatCurrency(diff)}
              </span>
            </div>
          </div>

          <p className="mt-3 text-xs text-gray-500">
            O valor do comprovante foi lido automaticamente (maior valor encontrado no documento).
          </p>

          <div className={`mt-5 grid grid-cols-1 gap-2 ${allowReplace ? 'sm:grid-cols-2' : ''}`}>
            <button
              type="button"
              disabled={updating}
              onClick={onKeep}
              className="inline-flex items-center justify-center rounded-xl bg-gray-100 px-4 py-3.5 text-sm font-semibold text-gray-700 hover:bg-gray-200 disabled:opacity-50"
            >
              Manter {formatCurrency(check.expense_amount)}
            </button>
            {allowReplace && (
              <button
                type="button"
                disabled={updating}
                onClick={onUpdate}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-teal-600 px-4 py-3.5 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-50"
              >
                {updating && <Loader2 className="h-4 w-4 animate-spin" />}
                Usar {formatCurrency(check.detected_amount)}
              </button>
            )}
          </div>
            </div>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
}

function ReceiptAnalyzingModal({
  fileName,
  exiting,
}: {
  fileName: string;
  exiting: boolean;
}) {
  return (
    <ModalPortal>
      <div
        className={`fixed inset-0 z-[300] flex items-center justify-center px-4 ${
          exiting ? 'receipt-analyze-overlay-exit' : 'receipt-analyze-overlay-enter'
        }`}
        style={{
          backgroundColor: 'rgba(15, 23, 42, 0.78)',
          paddingTop: 'max(1.5rem, env(safe-area-inset-top))',
          paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))',
        }}
      >
        <div
          className={`relative w-full max-w-sm overflow-hidden rounded-2xl bg-white shadow-2xl opacity-100 ${
            exiting ? 'receipt-analyze-card-exit' : 'receipt-analyze-card-enter'
          }`}
        >
          <div className="absolute inset-x-0 top-0 h-1 overflow-hidden bg-teal-100">
            <div className="receipt-analyze-bar h-full w-1/2 bg-gradient-to-r from-teal-400 via-teal-600 to-teal-400" />
          </div>

          <div className="relative z-[1] bg-white px-6 pt-8 pb-6 text-center">
            <div className="relative mx-auto mb-4 flex h-16 w-16 items-center justify-center">
              <div className="absolute inset-0 rounded-2xl bg-teal-50 receipt-analyze-pulse" />
              <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-teal-500 to-teal-700 text-white shadow-lg">
                <FileSearch className="h-7 w-7" />
              </div>
              <Sparkles className="absolute -right-1 -top-1 h-4 w-4 text-amber-400 receipt-analyze-sparkle" />
            </div>

            <h2 className="text-lg font-semibold text-gray-900">Analisando comprovante</h2>
            <p className="mt-1.5 text-sm text-gray-500">
              A IA está lendo o valor pago no documento…
            </p>
            <p className="mt-3 truncate rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-600 border border-gray-100">
              {fileName}
            </p>

            <div className="mt-5 flex items-center justify-center gap-2 text-xs font-medium text-teal-700">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Isso pode levar alguns segundos
            </div>
          </div>

          <div className="relative z-[1] h-10 overflow-hidden border-t border-gray-100 bg-white">
            <div className="receipt-analyze-scan absolute inset-x-6 top-0 h-full pointer-events-none" />
            <p className="relative z-[1] flex h-full items-center justify-center text-[11px] text-gray-400 bg-white/95">
              Extraindo valores monetários
            </p>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
}

type PendingDivergence = {
  expenseId: string;
  expenseName: string;
  check: ReceiptAmountCheck;
  amountLabel?: string;
  message?: string;
  allowReplace?: boolean;
};

type AnalyzePhase = 'idle' | 'analyzing' | 'exit' | 'divergence';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Fluxo em etapas: analisa (modal) → desmancha → divergência (se houver).
 */
export function useReceiptAmountDivergence(onChanged: () => void) {
  const [phase, setPhase] = useState<AnalyzePhase>('idle');
  const [fileName, setFileName] = useState('comprovante');
  const [pending, setPending] = useState<PendingDivergence | null>(null);
  const [updating, setUpdating] = useState(false);
  const onReviewDoneRef = useRef<(() => void) | null>(null);

  const analyzeAfterUpload = async (
    upload: () => Promise<Expense>,
    options?: {
      fileName?: string;
      successToast?: string | false;
      /** Chamado quando o usuário fecha o modal de divergência (manter ou atualizar). */
      onReviewDone?: () => void;
      /** Soma das parcelas em aberto, no lugar do valor de uma despesa só. */
      expectedAmount?: number;
    }
  ) => {
    setFileName(options?.fileName || 'comprovante');
    setPhase('analyzing');
    setPending(null);
    onReviewDoneRef.current = options?.onReviewDone || null;

    try {
      const uploaded = await upload();
      let expense = uploaded;
      let analysisFailed = false;
      try {
        expense = await expenseService.analyzeReceipt(uploaded._id);
      } catch {
        // Anexo ok; análise falhou — segue sem modal de divergência
        expense = uploaded;
        analysisFailed = true;
      }

      setPhase('exit');
      await sleep(720);
      onChanged();

      const detected = expense.receipt_amount_check?.detected_amount;
      const settling = options?.expectedAmount != null && detected != null;
      const check = settling
        ? compareReceiptAmount(options.expectedAmount as number, detected)
        : expense.receipt_amount_check;
      if (settling && check) {
        expense = { ...expense, receipt_amount_check: check };
      }
      if (check?.differs) {
        setPending({
          expenseId: expense._id,
          expenseName: expense.description,
          check,
          amountLabel: settling ? 'Soma em aberto' : undefined,
          allowReplace: !settling,
          message: settling
            ? `O comprovante de ${expense.description} não bate com a soma das parcelas em aberto a partir desta.`
            : undefined,
        });
        setPhase('divergence');
      } else {
        setPhase('idle');
        if (analysisFailed) {
          toast.warning(
            'Comprovante anexado, mas não foi possível ler o valor automaticamente.'
          );
        } else if (options?.successToast !== false) {
          toast.success(options?.successToast || 'Comprovante anexado');
        }
        onReviewDoneRef.current = null;
      }
      return expense;
    } catch (error) {
      setPhase('idle');
      onReviewDoneRef.current = null;
      throw error;
    }
  };

  /** Compat: resultado já veio do upload (sem reenviar). */
  const handleUploadResult = async (expense: Expense) => {
    setFileName(expense.receipt?.original_filename || 'comprovante');
    setPhase('exit');
    await sleep(400);
    onChanged();
    const check = expense.receipt_amount_check;
    if (check?.differs) {
      setPending({
        expenseId: expense._id,
        expenseName: expense.description,
        check,
      });
      setPhase('divergence');
    } else {
      setPhase('idle');
    }
  };

  const finishReview = () => {
    const done = onReviewDoneRef.current;
    onReviewDoneRef.current = null;
    setPending(null);
    setPhase('idle');
    done?.();
  };

  const applyDetectedAmount = async () => {
    if (!pending) return;
    try {
      setUpdating(true);
      await expenseService.update(pending.expenseId, {
        amount: pending.check.detected_amount,
      });
      toast.success(
        `Valor atualizado para ${formatCurrency(pending.check.detected_amount)}`
      );
      onChanged();
      finishReview();
    } catch {
      toast.error('Não foi possível atualizar o valor');
    } finally {
      setUpdating(false);
    }
  };

  const modal = (
    <>
      {(phase === 'analyzing' || phase === 'exit') && (
        <ReceiptAnalyzingModal fileName={fileName} exiting={phase === 'exit'} />
      )}
      {phase === 'divergence' && pending && (
        <ReceiptAmountDivergenceModal
          expenseName={pending.expenseName}
          check={pending.check}
          updating={updating}
          amountLabel={pending.amountLabel}
          message={pending.message}
          allowReplace={pending.allowReplace}
          onKeep={() => {
            toast.info('Valor da despesa mantido');
            finishReview();
          }}
          onUpdate={() => {
            void applyDetectedAmount();
          }}
        />
      )}
    </>
  );

  return {
    analyzeAfterUpload,
    handleUploadResult,
    modal,
    phase,
    isAnalyzing: phase === 'analyzing' || phase === 'exit',
  };
}
