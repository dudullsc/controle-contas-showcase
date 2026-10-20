'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Download, ExternalLink, RefreshCw, Share2, X } from 'lucide-react';
import { toast } from 'react-toastify';
import { Expense } from '@/types';
import { expenseService } from '@/services/expense.service';
import PdfPreview from './PdfPreview';

const ACCEPT = 'image/jpeg,image/png,image/webp,application/pdf,.jpg,.jpeg,.png,.webp,.pdf';

interface ReceiptViewerModalProps {
  expense: Expense;
  onClose: () => void;
  onChanged: () => void;
  /** Se informado, substitui o upload interno (permite modal de análise da IA). */
  onReplace?: (file: File) => Promise<void>;
  onUploadChecked?: (expense: Expense) => void;
}

type CapacitorWindow = Window & {
  Capacitor?: {
    isNativePlatform?: () => boolean;
  };
};

function isNativeApp() {
  if (typeof window === 'undefined') return false;
  const cap = (window as CapacitorWindow).Capacitor;
  if (cap?.isNativePlatform) return cap.isNativePlatform();
  return !!cap;
}

function isMobileViewport() {
  if (typeof window === 'undefined') return false;
  const coarse = window.matchMedia('(pointer: coarse)').matches;
  const narrow = window.matchMedia('(max-width: 768px)').matches;
  const ua = navigator.userAgent || '';
  return isNativeApp() || coarse || narrow || /Android|iPhone|iPad|iPod/i.test(ua);
}

function asPdfFile(data: Blob, filename: string) {
  const name = filename.toLowerCase().endsWith('.pdf') ? filename : `${filename}.pdf`;
  return new File([data], name, { type: 'application/pdf' });
}

export default function ReceiptViewerModal({
  expense,
  onClose,
  onChanged,
  onReplace,
  onUploadChecked,
}: ReceiptViewerModalProps) {
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [contentType, setContentType] = useState(expense.receipt?.content_type || '');
  const [loading, setLoading] = useState(true);
  const [replacing, setReplacing] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [mobile, setMobile] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setMounted(true);
    setMobile(isMobileViewport());
  }, []);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  useEffect(() => {
    let revoked = false;
    let url: string | null = null;

    const load = async () => {
      try {
        setLoading(true);
        const data = await expenseService.getReceiptBlob(expense._id);
        if (revoked) return;
        const inferredType =
          (data.type && data.type !== 'application/octet-stream' ? data.type : '') ||
          expense.receipt?.content_type ||
          (expense.receipt?.original_filename?.toLowerCase().endsWith('.pdf')
            ? 'application/pdf'
            : data.type || '');
        const typed =
          inferredType && data.type !== inferredType
            ? new Blob([data], { type: inferredType })
            : data;
        url = URL.createObjectURL(typed);
        setBlob(typed);
        setObjectUrl(url);
        setContentType(inferredType);
      } catch {
        if (!revoked) {
          toast.error('Erro ao abrir comprovante');
          onClose();
        }
      } finally {
        if (!revoked) setLoading(false);
      }
    };

    load();

    return () => {
      revoked = true;
      if (url) URL.revokeObjectURL(url);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expense._id]);

  const filename = expense.receipt?.original_filename || 'comprovante';
  const isPdf = contentType.includes('pdf') || filename.toLowerCase().endsWith('.pdf');
  const isImage = contentType.startsWith('image/') || /\.(jpe?g|png|webp)$/i.test(filename);
  const pdfBlob =
    blob && isPdf
      ? blob.type.includes('pdf')
        ? blob
        : new Blob([blob], { type: 'application/pdf' })
      : null;

  const shareOrDownload = async (data: Blob, preferOpen: boolean) => {
    const file = isPdf
      ? asPdfFile(data, filename)
      : new File([data], filename, {
          type: data.type || contentType || 'application/octet-stream',
        });

    try {
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: file.name });
        return;
      }
    } catch (err) {
      if ((err as { name?: string }).name === 'AbortError') return;
    }

    // blob: em nova janela trava o WebView do app (Android/Capacitor)
    if (!isNativeApp() && preferOpen) {
      const previewUrl = URL.createObjectURL(file);
      const opened = window.open(previewUrl, '_blank');
      if (opened) {
        window.setTimeout(() => URL.revokeObjectURL(previewUrl), 30_000);
        return;
      }
      URL.revokeObjectURL(previewUrl);
    }

    const url = URL.createObjectURL(file);
    const link = document.createElement('a');
    link.href = url;
    link.download = file.name;
    link.rel = 'noopener';
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
    if (preferOpen && isNativeApp()) {
      toast.info('Se o PDF não abrir sozinho, use Baixar.');
    }
  };

  const openExternally = async () => {
    try {
      const data = pdfBlob || blob || (await expenseService.getReceiptBlob(expense._id, true));
      await shareOrDownload(data, true);
    } catch {
      toast.error('Não foi possível abrir o PDF neste aparelho');
    }
  };

  const handleDownload = async () => {
    try {
      const data = pdfBlob || blob || (await expenseService.getReceiptBlob(expense._id, true));
      await shareOrDownload(data, false);
    } catch {
      toast.error('Erro ao baixar comprovante');
    }
  };

  const handleReplace = async (file: File) => {
    try {
      setReplacing(true);
      if (onReplace) {
        onClose();
        await onReplace(file);
        return;
      }
      const updated = await expenseService.uploadReceipt(expense._id, file);
      toast.success('Comprovante atualizado');
      if (onUploadChecked) {
        onUploadChecked(updated);
      } else {
        onChanged();
      }
      onClose();
    } catch {
      // handleError already toasted
    } finally {
      setReplacing(false);
    }
  };

  if (!mounted) return null;

  const showPdfIframe = objectUrl && isPdf && !mobile;
  const showPdfMobileFallback = objectUrl && isPdf && mobile;

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-end justify-center sm:items-center sm:p-4"
      onClick={(e) => e.stopPropagation()}
      style={{ isolation: 'isolate' }}
    >
      <div className="absolute inset-0 bg-black/80" onClick={onClose} />

      <div
        className="relative z-10 flex h-[100dvh] w-full max-w-3xl flex-col overflow-hidden bg-white shadow-2xl sm:h-auto sm:max-h-[90dvh] sm:rounded-2xl"
        style={{ transform: 'translateZ(0)' }}
      >
        <div className="flex shrink-0 items-center justify-between border-b bg-white px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))] sm:px-5 sm:py-4 sm:pt-4">
          <div className="min-w-0">
            <h3 className="text-base font-semibold text-gray-900 sm:text-lg">Comprovante</h3>
            <p className="mt-0.5 truncate text-xs text-gray-500">
              {expense.description} · {filename}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-lg p-2 text-gray-500 hover:bg-gray-100"
            aria-label="Fechar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div
          className={`flex min-h-0 flex-1 overflow-auto bg-gray-50 p-3 sm:bg-white ${
            showPdfMobileFallback ? 'items-start' : 'items-center justify-center'
          }`}
        >
          {loading ? (
            <p className="text-sm text-gray-500">Carregando comprovante...</p>
          ) : showPdfIframe ? (
            <iframe
              title="Comprovante PDF"
              src={`${objectUrl}#toolbar=1&navpanes=0`}
              className="h-[min(65vh,560px)] w-full rounded-lg border border-gray-200 bg-white"
              style={{ backgroundColor: '#ffffff' }}
            />
          ) : showPdfMobileFallback && pdfBlob ? (
            <div className="flex w-full flex-col gap-3">
              <PdfPreview blob={pdfBlob} />
              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  onClick={openExternally}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-green-600 px-4 py-3 text-sm font-medium text-white hover:bg-green-700"
                >
                  <ExternalLink className="h-4 w-4" />
                  Abrir / Compartilhar
                </button>
                <button
                  type="button"
                  onClick={handleDownload}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-gray-300 px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  <Share2 className="h-4 w-4" />
                  Baixar
                </button>
              </div>
            </div>
          ) : objectUrl && isImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={objectUrl}
              alt="Comprovante de pagamento"
              className="max-h-[calc(100dvh-11rem)] w-full max-w-full touch-manipulation rounded-lg object-contain shadow sm:max-h-[65vh]"
            />
          ) : objectUrl ? (
            <div className="space-y-3 p-4 text-center">
              <p className="text-sm text-gray-600">Pré-visualização indisponível neste aparelho.</p>
              <button
                type="button"
                onClick={handleDownload}
                className="inline-flex items-center gap-2 rounded-xl bg-green-600 px-4 py-2 text-sm font-medium text-white"
              >
                <Download className="h-4 w-4" />
                Baixar arquivo
              </button>
            </div>
          ) : null}
        </div>

        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t bg-white px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-5 sm:py-4 sm:pb-4">
          <input
            ref={fileRef}
            type="file"
            accept={ACCEPT}
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = '';
              if (file) handleReplace(file);
            }}
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={replacing}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 sm:flex-none"
          >
            <RefreshCw className="h-4 w-4" />
            {replacing ? 'Enviando...' : 'Substituir'}
          </button>
          {!showPdfMobileFallback && (
            <button
              type="button"
              onClick={handleDownload}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-green-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-green-700 sm:flex-none"
            >
              {mobile ? <Share2 className="h-4 w-4" /> : <Download className="h-4 w-4" />}
              {mobile ? 'Baixar / Compartilhar' : 'Baixar'}
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
