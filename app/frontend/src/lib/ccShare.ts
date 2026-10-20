/**
 * Bridge nativo Android (JavascriptInterface CCShareAndroid)
 * para receber arquivos compartilhados (comprovante).
 */

export type CcShareMeta = {
  pending: boolean;
  error?: string | null;
  fileName?: string;
  mimeType?: string;
  sizeBytes?: number;
  chunkCount?: number;
};

type CcShareAndroidBridge = {
  hasPendingShare: () => boolean;
  getPendingShareMeta: () => string;
  getPendingShareChunk: (index: number) => string;
  clearPendingShare: () => void;
};

type PendingListener = () => void;

let pendingSharedReceipt: File | null = null;
const pendingListeners = new Set<PendingListener>();

function notifyPendingListeners() {
  pendingListeners.forEach((listener) => listener());
}

export function getPendingSharedReceipt(): File | null {
  return pendingSharedReceipt;
}

export function setPendingSharedReceipt(file: File | null): void {
  pendingSharedReceipt = file;
  notifyPendingListeners();
}

export function clearPendingSharedReceipt(): void {
  setPendingSharedReceipt(null);
}

export function subscribePendingSharedReceipt(listener: PendingListener): () => void {
  pendingListeners.add(listener);
  return () => {
    pendingListeners.delete(listener);
  };
}

function getBridge(): CcShareAndroidBridge | null {
  if (typeof window === 'undefined') return null;
  const w = window as Window & { CCShareAndroid?: CcShareAndroidBridge };
  return w.CCShareAndroid ?? null;
}

export function isAndroidShareAvailable(): boolean {
  return !!getBridge();
}

export function peekShareMeta(): CcShareMeta | null {
  const bridge = getBridge();
  if (!bridge?.hasPendingShare?.()) return null;
  try {
    const raw = bridge.getPendingShareMeta();
    return JSON.parse(raw) as CcShareMeta;
  } catch {
    return null;
  }
}

export function clearPendingShare(): void {
  try {
    getBridge()?.clearPendingShare?.();
  } catch {
    // ignore
  }
}

/** Monta um File a partir dos chunks base64 do nativo. */
export async function consumeSharedFile(): Promise<File | null> {
  const bridge = getBridge();
  if (!bridge?.hasPendingShare?.()) return null;

  let meta: CcShareMeta;
  try {
    meta = JSON.parse(bridge.getPendingShareMeta()) as CcShareMeta;
  } catch {
    return null;
  }

  if (meta.error) {
    const msg = meta.error;
    clearPendingShare();
    throw new Error(msg);
  }

  const chunkCount = meta.chunkCount ?? 0;
  if (chunkCount <= 0) {
    clearPendingShare();
    return null;
  }

  let b64 = '';
  for (let i = 0; i < chunkCount; i++) {
    b64 += bridge.getPendingShareChunk(i) || '';
  }
  clearPendingShare();

  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }

  const mime = meta.mimeType || 'application/octet-stream';
  const name = meta.fileName || 'comprovante';
  return new File([bytes], name, { type: mime });
}
