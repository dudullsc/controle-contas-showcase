'use client';

import { useEffect } from 'react';
import { AlertTriangle, X, Trash2 } from 'lucide-react';

interface DeleteConfirmModalProps {
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  title?: string;
  message?: string;
  secondaryActionLabel?: string;
  onSecondaryConfirm?: () => void;
  primaryActionLabel?: string;
}

export default function DeleteConfirmModal({
  isOpen,
  onConfirm,
  onCancel,
  title = 'Excluir Despesa',
  message = 'Tem certeza que deseja excluir esta despesa?',
  secondaryActionLabel,
  onSecondaryConfirm,
  primaryActionLabel = 'Excluir',
}: DeleteConfirmModalProps) {
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

  return (
    <div className="fixed inset-0 z-50 overflow-hidden" data-testid="delete-confirm-modal">
      <div className="flex h-[100dvh] items-end justify-center lg:items-center p-0 lg:p-4">
        <div
          className="fixed inset-0 bg-gray-900/50 transition-opacity backdrop-blur-[2px]"
          onClick={onCancel}
          aria-hidden
        />

        <div className="relative bg-white rounded-t-3xl lg:rounded-2xl shadow-2xl w-full max-w-none lg:max-w-md max-h-[92dvh] overflow-y-auto overscroll-contain pb-[env(safe-area-inset-bottom)]">
          <div className="flex justify-center pt-3 pb-1 lg:hidden">
            <div className="h-1 w-10 rounded-full bg-gray-300" aria-hidden />
          </div>

          <div className="px-5 pt-2 pb-1 lg:pt-5">
            <h3 className="flex items-center gap-2 text-lg font-bold text-gray-900">
              <AlertTriangle className="h-5 w-5 text-red-600" />
              {title}
            </h3>
            <p className="mt-2 text-sm text-gray-600 leading-relaxed">{message}</p>
          </div>

          <div className="px-5 py-4 space-y-3">
            <div className={`grid gap-3 ${onSecondaryConfirm ? 'grid-cols-1' : 'grid-cols-2'}`}>
              <button
                type="button"
                onClick={onCancel}
                className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-gray-100 px-4 py-3.5 text-sm font-semibold text-gray-700 hover:bg-gray-200 transition-colors order-last"
              >
                <X className="h-4 w-4" />
                Cancelar
              </button>

              {onSecondaryConfirm && (
                <button
                  type="button"
                  onClick={onSecondaryConfirm}
                  className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-amber-500 px-4 py-3.5 text-sm font-semibold text-white hover:bg-amber-600 transition-colors"
                >
                  <Trash2 className="h-4 w-4" />
                  {secondaryActionLabel || 'Excluir todas'}
                </button>
              )}

              <button
                type="button"
                onClick={onConfirm}
                className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-red-600 px-4 py-3.5 text-sm font-semibold text-white hover:bg-red-700 transition-colors"
              >
                <Trash2 className="h-4 w-4" />
                {primaryActionLabel}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
