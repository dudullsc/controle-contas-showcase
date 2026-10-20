'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import { useAuth } from '@/contexts/AuthContext';
import {
  clearPendingShare,
  clearPendingSharedReceipt,
  consumeSharedFile,
  getPendingSharedReceipt,
  isAndroidShareAvailable,
  peekShareMeta,
  setPendingSharedReceipt,
  subscribePendingSharedReceipt,
} from '@/lib/ccShare';
import ShareAttachPicker from '@/components/expenses/ShareAttachPicker';

/**
 * Recebe compartilhamento Android e abre a tela compacta
 * para escolher a conta e anexar o comprovante.
 */
export default function ShareReceiptHandler() {
  const { user, loading } = useAuth();
  const [pendingFile, setPendingFile] = useState<File | null>(null);

  useEffect(() => {
    setPendingFile(getPendingSharedReceipt());
    return subscribePendingSharedReceipt(() => {
      setPendingFile(getPendingSharedReceipt());
    });
  }, []);

  const tryOpenPending = useCallback(async () => {
    if (!isAndroidShareAvailable() || loading || !user) return;

    const meta = peekShareMeta();
    if (!meta?.pending) return;

    if (meta.error) {
      toast.error(meta.error);
      clearPendingShare();
      return;
    }

    try {
      const shared = await consumeSharedFile();
      if (!shared) return;
      setPendingSharedReceipt(shared);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Falha ao abrir o arquivo compartilhado';
      toast.error(msg);
    }
  }, [loading, user]);

  useEffect(() => {
    if (!isAndroidShareAvailable()) return;

    tryOpenPending();

    const onReceived = () => {
      void tryOpenPending();
    };

    window.addEventListener('cc-share-received', onReceived);
    window.addEventListener('cc-share-error', onReceived);
    return () => {
      window.removeEventListener('cc-share-received', onReceived);
      window.removeEventListener('cc-share-error', onReceived);
    };
  }, [tryOpenPending]);

  if (!pendingFile) return null;

  return (
    <ShareAttachPicker
      file={pendingFile}
      onClose={() => clearPendingSharedReceipt()}
    />
  );
}
