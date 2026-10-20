'use client';

import { useEffect, useRef, useState } from 'react';

const WORKER_SRC = '/pdf.worker.min.mjs';
const MAX_PAGES = 20;

interface PdfPreviewProps {
  blob: Blob;
  className?: string;
}

function configureWorker(pdfjs: typeof import('pdfjs-dist')) {
  pdfjs.GlobalWorkerOptions.workerSrc = WORKER_SRC;
}

export default function PdfPreview({ blob, className = '' }: PdfPreviewProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    let cancelled = false;

    const render = async () => {
      setStatus('loading');
      host.replaceChildren();

      try {
        const pdfjs = await import('pdfjs-dist');
        configureWorker(pdfjs);

        const bytes = new Uint8Array(await blob.arrayBuffer());
        const pdf = await pdfjs.getDocument({ data: bytes }).promise;

        if (cancelled) {
          pdf.destroy();
          return;
        }

        const cssWidth = Math.max(host.clientWidth, host.parentElement?.clientWidth || 0, 320);
        const pageCount = Math.min(pdf.numPages, MAX_PAGES);

        for (let n = 1; n <= pageCount; n++) {
          const page = await pdf.getPage(n);
          if (cancelled) {
            pdf.destroy();
            return;
          }

          const unscaled = page.getViewport({ scale: 1 });
          const dpr = Math.min(window.devicePixelRatio || 1, 2);
          const scale = (cssWidth / unscaled.width) * dpr;
          const viewport = page.getViewport({ scale: Math.min(Math.max(scale, 1), 3) });

          const canvas = document.createElement('canvas');
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          canvas.setAttribute('aria-label', `Página ${n} do comprovante`);
          const ctx = canvas.getContext('2d', { alpha: false });
          if (!ctx) throw new Error('canvas');

          await page.render({ canvasContext: ctx, viewport }).promise;
          if (cancelled) {
            pdf.destroy();
            return;
          }

          const img = document.createElement('img');
          img.src = canvas.toDataURL('image/jpeg', 0.92);
          img.alt = `Página ${n} do comprovante`;
          img.className = 'mb-3 w-full rounded-lg bg-white shadow-sm last:mb-0';
          img.draggable = false;
          host.appendChild(img);
        }

        pdf.destroy();
        if (!cancelled) setStatus('ready');
      } catch {
        if (!cancelled) setStatus('error');
      }
    };

    render();

    return () => {
      cancelled = true;
      host.replaceChildren();
    };
  }, [blob]);

  return (
    <div className={`w-full ${className}`}>
      {status === 'loading' && (
        <p className="py-8 text-center text-sm text-gray-500">Carregando PDF...</p>
      )}
      {status === 'error' && (
        <p className="py-4 text-center text-sm text-gray-500">
          Não foi possível mostrar o PDF neste aparelho. Use Abrir / Compartilhar ou Baixar.
        </p>
      )}
      <div ref={hostRef} className={status === 'ready' ? 'w-full' : 'w-full min-h-[1px]'} />
    </div>
  );
}
