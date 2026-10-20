/**
 * Biometria no app Capacitor (fingerprint / face unlock).
 * Usa @capgo/capacitor-native-biometric via bridge nativo.
 *
 * getCredentials NÃO pede digital no Android — só lê o cofre.
 * O diálogo nativo (BiometricPrompt) aparece só com verifyIdentity.
 */

const BIOMETRIC_SERVER = 'com.dudullsc.controlecontas';
const BIO_OFFER_KEY = 'cc_bio_offer_done';

const LOGIN_PROMPT = {
  reason: 'Verificar identidade',
  title: 'Controle de Contas',
  subtitle: 'Autenticação requerida',
  description: 'Valide sua biometria para realizar o login',
  negativeButtonText: 'Cancelar',
  maxAttempts: 5,
  useFallback: false,
} as const;

const ENABLE_PROMPT = {
  reason: 'Ativar login biométrico',
  title: 'Controle de Contas',
  subtitle: 'Ativar biometria',
  description: 'Valide sua biometria para ativar o login neste aparelho',
  negativeButtonText: 'Cancelar',
  maxAttempts: 5,
  useFallback: false,
} as const;

type NativeBiometricPlugin = {
  isAvailable: (options?: {
    useFallback?: boolean;
  }) => Promise<{
    isAvailable: boolean;
    biometryType?: number;
    errorCode?: number;
  }>;
  verifyIdentity: (options: {
    reason?: string;
    title?: string;
    subtitle?: string;
    description?: string;
    negativeButtonText?: string;
    useFallback?: boolean;
    maxAttempts?: number;
  }) => Promise<void>;
  getCredentials: (options: { server: string }) => Promise<{
    username: string;
    password: string;
  }>;
  setCredentials: (options: {
    username: string;
    password: string;
    server: string;
  }) => Promise<void>;
  deleteCredentials: (options: { server: string }) => Promise<void>;
  isCredentialsSaved?: (options: { server: string }) => Promise<{ isSaved: boolean }>;
};

function getNativeBiometric(): NativeBiometricPlugin | null {
  if (typeof window === 'undefined') return null;
  const cap = (
    window as Window & {
      Capacitor?: { Plugins?: { NativeBiometric?: NativeBiometricPlugin } };
    }
  ).Capacitor;
  return cap?.Plugins?.NativeBiometric ?? null;
}

function pluginErrorText(error: unknown): string {
  if (!error) return '';
  if (typeof error === 'string') return error;
  const e = error as { message?: string; errorMessage?: string; code?: string | number };
  return String(e.message || e.errorMessage || e.code || '');
}

export function isBiometricCancel(error: unknown): boolean {
  const e = error as { code?: string | number; message?: string };
  const code = String(e?.code ?? '');
  if (code === '16' || code === '15' || code === '11') return true;
  return /cancel|cancelou|user cancel/i.test(pluginErrorText(error));
}

export const biometricService = {
  isNativeApp(): boolean {
    if (typeof window === 'undefined') return false;
    const w = window as Window & {
      __CONTROLE_CONTAS_APP__?: boolean;
      Capacitor?: { isNativePlatform?: () => boolean };
    };
    return !!(w.__CONTROLE_CONTAS_APP__ || w.Capacitor?.isNativePlatform?.());
  },

  async isAvailable(): Promise<boolean> {
    const plugin = getNativeBiometric();
    if (!plugin || !this.isNativeApp()) return false;
    try {
      const result = await plugin.isAvailable({ useFallback: false });
      return !!result.isAvailable;
    } catch {
      return false;
    }
  },

  /** Checa se há credencial salva SEM pedir digital. */
  async hasSavedCredentials(): Promise<boolean> {
    const plugin = getNativeBiometric();
    if (!plugin) return false;
    try {
      if (!plugin.isCredentialsSaved) return false;
      const saved = await plugin.isCredentialsSaved({ server: BIOMETRIC_SERVER });
      return !!saved.isSaved;
    } catch {
      return false;
    }
  },

  wasOfferHandled(): boolean {
    try {
      return localStorage.getItem(BIO_OFFER_KEY) === '1';
    } catch {
      return false;
    }
  },

  markOfferHandled(): void {
    try {
      localStorage.setItem(BIO_OFFER_KEY, '1');
    } catch {
      // ignore
    }
  },

  /**
   * Confirma a identidade e grava email/senha no cofre do aparelho.
   */
  async enable(username: string, password: string): Promise<void> {
    const plugin = getNativeBiometric();
    if (!plugin) throw new Error('Biometria indisponível neste dispositivo');

    const available = await this.isAvailable();
    if (!available) throw new Error('Biometria não configurada no aparelho');

    await plugin.verifyIdentity({ ...ENABLE_PROMPT });
    await plugin.setCredentials({
      username,
      password,
      server: BIOMETRIC_SERVER,
    });
    this.markOfferHandled();
  },

  async disable(): Promise<void> {
    const plugin = getNativeBiometric();
    if (!plugin) return;
    try {
      await plugin.deleteCredentials({ server: BIOMETRIC_SERVER });
    } catch {
      // já removido
    }
  },

  /**
   * Abre o BiometricPrompt do Android e só então lê as credenciais.
   */
  async unlockCredentials(): Promise<{ username: string; password: string }> {
    const plugin = getNativeBiometric();
    if (!plugin) throw new Error('Biometria indisponível');
    if (!plugin.verifyIdentity) {
      throw new Error('Biometria indisponível neste dispositivo');
    }

    await plugin.verifyIdentity({ ...LOGIN_PROMPT });
    return plugin.getCredentials({ server: BIOMETRIC_SERVER });
  },
};
