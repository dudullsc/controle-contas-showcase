'use client';

import { useEffect, useState } from 'react';
import { FileText, Wallet, X, Check } from 'lucide-react';
import { PaymentSource } from '@/types';
import { getPendingSharedReceipt } from '@/lib/ccShare';
import { expenseService } from '@/services/expense.service';
import { formatCurrency } from '@/lib/utils';

const ACCEPT = 'image/jpeg,image/png,image/webp,application/pdf,.jpg,.jpeg,.png,.webp,.pdf';
const MAX_BYTES = 5 * 1024 * 1024;

const fieldLabelClass = 'flex items-center gap-1.5 text-xs font-medium text-gray-500 mb-1.5';
const fieldInputClass =
  'w-full rounded-xl border border-gray-200 bg-white shadow-sm focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 transition-all py-2.5 px-3 text-sm text-gray-900';

interface PaymentSourceModalProps {
  isOpen: boolean;
  expenseName: string;
  /** Parcela de um grupo: permite escolher pagar só esta ou quitar as em aberto. */
  canSettleAll?: boolean;
  settleGroupId?: string | null;
  settleFromExpenseId?: string | null;
  onConfirm: (
    paymentSource: PaymentSource,
    creditCardName?: string,
    loanName?: string,
    receiptFile?: File | null,
    payAll?: boolean
  ) => void;
  onCancel: () => void;
}

export default function PaymentSourceModal({
  isOpen,
  expenseName,
  canSettleAll = false,
  settleGroupId,
  settleFromExpenseId,
  onConfirm,
  onCancel,
}: PaymentSourceModalProps) {
  const [paymentSource, setPaymentSource] = useState<PaymentSource | ''>('');
  const [payAll, setPayAll] = useState(false);
  const [openAmount, setOpenAmount] = useState<number | null>(null);
  const [openCount, setOpenCount] = useState<number | null>(null);
  const [openAmountLoading, setOpenAmountLoading] = useState(false);
  const [creditCardName, setCreditCardName] = useState('');
  const [loanName, setLoanName] = useState('');
  const [attachNow, setAttachNow] = useState(false);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [fromShare, setFromShare] = useState(false);
  const [fileError, setFileError] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    const shared = getPendingSharedReceipt();
    if (shared) {
      setAttachNow(true);
      setReceiptFile(shared);
      setFromShare(true);
      setFileError('');
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !canSettleAll || !settleGroupId || !settleFromExpenseId) {
      setOpenAmount(null);
      setOpenCount(null);
      return;
    }
    let cancelled = false;
    setOpenAmountLoading(true);
    expenseService
      .getInstallmentOpenAmount(settleGroupId, settleFromExpenseId)
      .then((preview) => {
        if (cancelled) return;
        setOpenAmount(preview.open_amount);
        setOpenCount(preview.count);
      })
      .catch(() => {
        if (!cancelled) {
          setOpenAmount(null);
          setOpenCount(null);
        }
      })
      .finally(() => {
        if (!cancelled) setOpenAmountLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen, canSettleAll, settleGroupId, settleFromExpenseId]);

  useEffect(() => {
    if (!isOpen) return;
    const html = document.documentElement;
    const originalHtmlOverflow = html.style.overflow;
    const originalBodyOverflow = document.body.style.overflow;
    html.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
    return () => {
      html.style.overflow = originalHtmlOverflow;
      document.body.style.overflow = originalBodyOverflow;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const reset = () => {
    setPaymentSource('');
    setPayAll(false);
    setOpenAmount(null);
    setOpenCount(null);
    setCreditCardName('');
    setLoanName('');
    setAttachNow(false);
    setReceiptFile(null);
    setFromShare(false);
    setFileError('');
  };

  const handleConfirm = () => {
    if (!paymentSource) return;
    if (attachNow && !receiptFile) {
      setFileError('Selecione o comprovante ou desmarque a opção');
      return;
    }
    const source = paymentSource;
    const card = creditCardName;
    const loan = loanName;
    const file = attachNow ? receiptFile : null;
    const settleAll = canSettleAll && payAll;
    reset();
    onConfirm(source, card, loan, file, settleAll);
  };

  const handleCancel = () => {
    reset();
    onCancel();
  };

  const handleFile = (file: File | undefined) => {
    setFileError('');
    setFromShare(false);
    if (!file) {
      setReceiptFile(null);
      return;
    }
    if (file.size > MAX_BYTES) {
      setReceiptFile(null);
      setFileError('Arquivo maior que 5 MB');
      return;
    }
    setReceiptFile(file);
  };

  const applySharedOrClear = (checked: boolean) => {
    setAttachNow(checked);
    setFileError('');
    if (!checked) {
      setReceiptFile(null);
      setFromShare(false);
      return;
    }
    const shared = getPendingSharedReceipt();
    if (shared) {
      setReceiptFile(shared);
      setFromShare(true);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] overflow-hidden" data-testid="payment-source-modal">
      <div className="flex h-[100dvh] items-end justify-center lg:items-center p-0 lg:p-4">
        <div
          className="fixed inset-0 bg-gray-900/50 transition-opacity backdrop-blur-[2px]"
          onClick={handleCancel}
          aria-hidden
        />

        <div className="relative bg-white rounded-t-3xl lg:rounded-2xl shadow-2xl w-full max-w-none lg:max-w-md max-h-[92dvh] overflow-y-auto overscroll-contain pb-[env(safe-area-inset-bottom)]">
          <div className="flex justify-center pt-3 pb-1 lg:hidden">
            <div className="h-1 w-10 rounded-full bg-gray-300" aria-hidden />
          </div>

          <div className="px-5 pt-2 pb-1 lg:pt-5">
            <h3 className="flex items-center gap-2 text-lg font-bold text-gray-900">
              <Wallet className="h-5 w-5 text-emerald-600" />
              Como foi pago?
            </h3>
            <p className="mt-1 text-sm text-gray-500 truncate">{expenseName}</p>
          </div>

          <div className="px-5 py-4 space-y-4">
            {canSettleAll && (
              <div>
                <p className={fieldLabelClass}>O que pagar?</p>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    aria-pressed={!payAll}
                    onClick={() => setPayAll(false)}
                    className={`rounded-xl border px-3 py-3 text-sm font-semibold transition-colors ${
                      !payAll
                        ? 'border-emerald-600 bg-emerald-600 text-white shadow-sm'
                        : 'border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
                    }`}
                  >
                    Só esta parcela
                  </button>
                  <button
                    type="button"
                    aria-pressed={payAll}
                    onClick={() => setPayAll(true)}
                    className={`rounded-xl border px-3 py-3 text-sm font-semibold transition-colors ${
                      payAll
                        ? 'border-amber-600 bg-amber-500 text-white shadow-sm'
                        : 'border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100'
                    }`}
                  >
                    Quitar dívida
                  </button>
                </div>
                {payAll && (
                  <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-3">
                    <p className="text-xs font-medium text-amber-800">Total em aberto</p>
                    <p className="mt-0.5 text-lg font-bold tabular-nums text-amber-950">
                      {openAmountLoading
                        ? 'Somando...'
                        : openAmount != null
                          ? formatCurrency(openAmount)
                          : '—'}
                    </p>
                    <p className="mt-1 text-xs text-amber-700">
                      {openCount != null
                        ? `${openCount} parcela${openCount === 1 ? '' : 's'} a partir desta. As já pagas não entram.`
                        : 'Quita as parcelas em aberto a partir desta. As já pagas não entram.'}
                    </p>
                  </div>
                )}
              </div>
            )}

            <div>
              <label className={fieldLabelClass}>Fonte de Pagamento *</label>
              <select
                value={paymentSource}
                onChange={(e) => {
                  setPaymentSource(e.target.value as PaymentSource);
                  if (e.target.value !== PaymentSource.CREDIT_CARD) setCreditCardName('');
                  if (e.target.value !== PaymentSource.LOAN) setLoanName('');
                }}
                className={fieldInputClass}
              >
                <option value="">Selecione...</option>
                <option value={PaymentSource.SALARY}>Salário</option>
                <option value={PaymentSource.CREDIT_CARD}>Cartão de Crédito</option>
                <option value={PaymentSource.LOAN}>Empréstimo</option>
                <option value={PaymentSource.SAVINGS}>Poupança</option>
                <option value={PaymentSource.OTHER}>Dinheiro por fora</option>
              </select>
            </div>

            {paymentSource === PaymentSource.CREDIT_CARD && (
              <div>
                <label className={fieldLabelClass}>Qual Cartão?</label>
                <input
                  type="text"
                  value={creditCardName}
                  onChange={(e) => setCreditCardName(e.target.value)}
                  className={fieldInputClass}
                  placeholder="Ex: Nubank, Inter, etc."
                />
              </div>
            )}

            {paymentSource === PaymentSource.LOAN && (
              <div>
                <label className={fieldLabelClass}>Qual Empréstimo?</label>
                <input
                  type="text"
                  value={loanName}
                  onChange={(e) => setLoanName(e.target.value)}
                  className={fieldInputClass}
                  placeholder="Ex: Empréstimo Nubank, etc."
                />
              </div>
            )}

            <div className="rounded-2xl border border-gray-200 bg-gray-50 p-3 space-y-2">
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={attachNow}
                  onChange={(e) => applySharedOrClear(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                />
                Anexar comprovante agora
              </label>

              {attachNow && fromShare && receiptFile && (
                <div className="rounded-xl border border-teal-200 bg-teal-50 px-3 py-2">
                  <p className="text-xs font-medium text-teal-900 flex items-center gap-1.5">
                    <FileText className="h-3.5 w-3.5 shrink-0" />
                    Comprovante compartilhado
                  </p>
                  <p className="mt-0.5 text-xs text-teal-800 truncate">{receiptFile.name}</p>
                  <p className="mt-1 text-[11px] text-teal-700">
                    Será anexado ao confirmar o pagamento (sem escolher arquivo).
                  </p>
                </div>
              )}

              {attachNow && !fromShare && (
                <div>
                  <input
                    type="file"
                    accept={ACCEPT}
                    className="block w-full text-sm text-gray-600 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100"
                    onChange={(e) => handleFile(e.target.files?.[0])}
                  />
                  {receiptFile && (
                    <p className="mt-1 text-xs text-gray-500 truncate">{receiptFile.name}</p>
                  )}
                  {fileError && <p className="mt-1 text-xs text-red-600">{fileError}</p>}
                  <p className="mt-1 text-xs text-gray-400">JPG, PNG, WEBP ou PDF · até 5 MB</p>
                </div>
              )}

              {attachNow && fromShare && fileError && (
                <p className="text-xs text-red-600">{fileError}</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2 pb-2">
              <button
                type="button"
                onClick={handleCancel}
                className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-gray-100 px-4 py-3.5 text-sm font-semibold text-gray-700 hover:bg-gray-200 transition-colors"
              >
                <X className="h-4 w-4" />
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                disabled={!paymentSource}
                className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-3.5 text-sm font-semibold text-white hover:bg-emerald-700 shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Check className="h-4 w-4" />
                Confirmar
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
