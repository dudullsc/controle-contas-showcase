'use client';

import { useEffect, useRef, useState, type MouseEvent } from 'react';
import { FileText, Paperclip } from 'lucide-react';
import { Expense, ExpenseStatus } from '@/types';
import { expenseService } from '@/services/expense.service';
import {
  clearPendingSharedReceipt,
  getPendingSharedReceipt,
  subscribePendingSharedReceipt,
} from '@/lib/ccShare';
import { useReceiptAmountDivergence } from './ReceiptAmountDivergenceModal';
import ReceiptViewerModal from './ReceiptViewerModal';

const ACCEPT = 'image/jpeg,image/png,image/webp,application/pdf,.jpg,.jpeg,.png,.webp,.pdf';

interface ReceiptActionsProps {
  expense: Expense;
  onChanged: () => void;
}

export default function ReceiptActions({ expense, onChanged }: ReceiptActionsProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [showViewer, setShowViewer] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [hasSharedFile, setHasSharedFile] = useState(false);
  const { analyzeAfterUpload, modal: amountModal, isAnalyzing } =
    useReceiptAmountDivergence(onChanged);

  useEffect(() => {
    setHasSharedFile(!!getPendingSharedReceipt());
    return subscribePendingSharedReceipt(() => {
      setHasSharedFile(!!getPendingSharedReceipt());
    });
  }, []);

  if (expense.status !== ExpenseStatus.PAGO) {
    return null;
  }

  const handleUpload = async (file: File) => {
    try {
      setUploading(true);
      await analyzeAfterUpload(
        async () => {
          const updated = await expenseService.uploadReceipt(expense._id, file);
          clearPendingSharedReceipt();
          return updated;
        },
        { fileName: file.name }
      );
    } catch {
      // handleError already toasted
    } finally {
      setUploading(false);
    }
  };

  const handleAttachClick = (e: MouseEvent) => {
    e.stopPropagation();
    const shared = getPendingSharedReceipt();
    if (shared) {
      void handleUpload(shared);
      return;
    }
    fileRef.current?.click();
  };

  const busy = uploading || isAnalyzing;

  const attachButton = (
    <>
      <button
        type="button"
        onClick={handleAttachClick}
        disabled={busy}
        className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-medium touch-manipulation min-h-[28px] disabled:opacity-50 ${
          hasSharedFile
            ? 'border-teal-300 bg-teal-50 text-teal-800 animate-pulse hover:bg-teal-100'
            : 'border-amber-200 bg-amber-50 text-amber-800 animate-pulse hover:bg-amber-100'
        }`}
        title={hasSharedFile ? 'Usar comprovante compartilhado' : 'Anexar comprovante'}
      >
        <Paperclip className="h-3.5 w-3.5" />
        {busy ? 'Analisando...' : hasSharedFile ? (expense.has_receipt ? 'Substituir' : 'Anexar') : 'Anexar'}
      </button>
      <input
        ref={fileRef}
        type="file"
        accept={ACCEPT}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (file) handleUpload(file);
        }}
      />
    </>
  );

  if (expense.has_receipt) {
    return (
      <>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setShowViewer(true);
          }}
          className="inline-flex items-center gap-1 rounded-md border border-green-200 bg-green-50 px-2 py-1 text-[11px] font-medium text-green-700 hover:bg-green-100 hover:border-green-300 transition-colors touch-manipulation min-h-[28px]"
          title="Ver ou baixar comprovante"
          aria-label="Ver comprovante"
        >
          <FileText className="h-3.5 w-3.5" />
          <span>Ver</span>
        </button>
        {hasSharedFile && attachButton}
        {showViewer && (
          <ReceiptViewerModal
            expense={expense}
            onClose={() => setShowViewer(false)}
            onChanged={onChanged}
            onReplace={async (file) => {
              setShowViewer(false);
              await analyzeAfterUpload(
                () => expenseService.uploadReceipt(expense._id, file),
                { fileName: file.name, successToast: 'Comprovante atualizado' }
              );
            }}
          />
        )}
        {amountModal}
      </>
    );
  }

  return (
    <>
      {attachButton}
      {amountModal}
    </>
  );
}
