/**
 * Versão do frontend.
 * Em produção: injetada no build Docker via NEXT_PUBLIC_APP_VERSION (tag front-v*).
 * Em dev: fallback do package / constante.
 */
export const APP_VERSION =
  process.env.NEXT_PUBLIC_APP_VERSION?.trim() ||
  process.env.npm_package_version?.trim() || '1.0.27';

const rawAppBuild =
  process.env.NEXT_PUBLIC_APP_BUILD?.trim() ||
  new Date().toISOString().slice(0, 10).replace(/-/g, '');

/** SHA completo vira short hash (7 chars); datas/números ficam como estão. */
export const APP_BUILD = /^[0-9a-f]{7,40}$/i.test(rawAppBuild)
  ? rawAppBuild.slice(0, 7)
  : rawAppBuild;

type NativeAppInfo = {
  version: string;
  build: string;
};

type CapacitorWindow = Window & {
  __CC_APP_VERSION__?: string;
  __CC_APP_BUILD__?: string;
  Capacitor?: {
    Plugins?: {
      App?: {
        getInfo: () => Promise<{ version?: string; build?: string | number }>;
      };
    };
  };
};

export async function getNativeAppInfo(): Promise<NativeAppInfo | null> {
  if (typeof window === 'undefined') return null;
  const w = window as CapacitorWindow;
  try {
    if (w.__CC_APP_VERSION__) {
      return {
        version: w.__CC_APP_VERSION__,
        build: w.__CC_APP_BUILD__ || '',
      };
    }
    const info = await w.Capacitor?.Plugins?.App?.getInfo();
    if (info?.version) {
      return {
        version: info.version,
        build: String(info.build ?? ''),
      };
    }
  } catch {
    // ignore
  }
  return null;
}
