'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { useForm } from 'react-hook-form';
import { toast } from 'react-toastify';
import {
  Eye,
  EyeOff,
  Mail,
  Lock,
  UserRound,
  Check,
  Shield,
  BarChart3,
  RefreshCw,
  Fingerprint,
  Info,
  X,
} from 'lucide-react';
import { authDisplay, authSans } from '@/lib/auth-fonts';
import { biometricService, isBiometricCancel } from '@/services/biometric.service';
import { APP_BUILD, APP_VERSION, getNativeAppInfo } from '@/lib/appVersion';

interface LoginForm {
  email: string;
  password: string;
}

const SAVED_EMAIL_KEY = 'saved_login_email';

const FEATURES = [
  {
    icon: BarChart3,
    text: 'Visão completa das suas finanças',
  },
  {
    icon: RefreshCw,
    text: 'Relatórios inteligentes e fáceis de entender',
  },
  {
    icon: Shield,
    text: 'Seus dados protegidos com segurança',
  },
] as const;

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const [biometricLoading, setBiometricLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [rememberEmail, setRememberEmail] = useState(false);
  const [biometricReady, setBiometricReady] = useState(false);
  const [hasBiometricCredentials, setHasBiometricCredentials] = useState(false);

  const { login, isAuthenticated, loading: authLoading } = useAuth();
  const router = useRouter();
  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<LoginForm>();

  const [showVersionInfo, setShowVersionInfo] = useState(false);
  const [versionInfo, setVersionInfo] = useState<{
    app?: string;
    appBuild?: string;
    frontend?: string;
    frontendBuild?: string;
  }>({});

  const goDashboard = useCallback(() => {
    window.location.assign('/dashboard');
  }, []);

  const maybeEnableBiometric = useCallback(async (email: string, password: string) => {
    try {
      const available = await biometricService.isAvailable();
      if (!available) return;

      // Já tem credencial salva → usa a biometria do aparelho, sem perguntar de novo
      const already = await biometricService.hasSavedCredentials();
      if (already) return;

      // Usuário já respondeu (aceitou ou recusou) nesta instalação
      if (biometricService.wasOfferHandled()) return;

      const enable = window.confirm('Deseja ativar entrada com digital / Face ID neste aparelho?');
      biometricService.markOfferHandled();
      if (!enable) return;

      await biometricService.enable(email, password);
      toast.success('Biometria ativada!', { autoClose: 1500 });
    } catch (error: any) {
      if (isBiometricCancel(error)) return;
      const msg = error?.message || 'Não foi possível ativar a biometria';
      toast.info(msg, { autoClose: 2500 });
    }
  }, []);

  const handleBiometricLogin = useCallback(async () => {
    setBiometricLoading(true);
    try {
      const creds = await biometricService.unlockCredentials();
      await login(creds.username, creds.password, { skipRedirect: true });
      toast.success('Login realizado com sucesso!', { autoClose: 800 });
      goDashboard();
    } catch (error: any) {
      if (isBiometricCancel(error)) return;
      toast.error('Falha no login biométrico. Use e-mail e senha.');
    } finally {
      setBiometricLoading(false);
    }
  }, [login, goDashboard]);

  useEffect(() => {
    const savedEmail = localStorage.getItem(SAVED_EMAIL_KEY);
    if (savedEmail) {
      setValue('email', savedEmail);
      setRememberEmail(true);
    }

    const loadVersionInfo = async () => {
      const native = await getNativeAppInfo();
      setVersionInfo({
        app: native?.version,
        appBuild: native?.build,
        frontend: APP_VERSION,
        frontendBuild: APP_BUILD,
      });
    };

    loadVersionInfo();
  }, [setValue]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!biometricService.isNativeApp()) return;
      const available = await biometricService.isAvailable();
      if (cancelled || !available) return;
      setBiometricReady(true);
      const saved = await biometricService.hasSavedCredentials();
      if (cancelled) return;
      setHasBiometricCredentials(saved);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (isAuthenticated && !authLoading) {
      router.push('/dashboard');
    }
  }, [isAuthenticated, authLoading, router]);

  if (authLoading) {
    return (
      <div
        className={`${authSans.className} flex min-h-screen items-center justify-center bg-white`}
      >
        <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-primary-600"></div>
      </div>
    );
  }

  const onSubmit = async (data: LoginForm) => {
    setLoading(true);
    try {
      if (rememberEmail) {
        localStorage.setItem(SAVED_EMAIL_KEY, data.email);
      } else {
        localStorage.removeItem(SAVED_EMAIL_KEY);
      }

      await login(data.email, data.password, { skipRedirect: true });
      toast.success('Login realizado com sucesso!', { autoClose: 800 });
      await maybeEnableBiometric(data.email, data.password);
      goDashboard();
    } catch (error: any) {
      // Erro tratado pelo errorHandler no authService
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className={`${authSans.variable} ${authDisplay.variable} ${authSans.className} flex min-h-screen flex-col bg-white`}
    >
      <div className="auth-fade-in flex items-center gap-2.5 px-4 pt-6 sm:px-6 md:hidden">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-600 text-sm font-bold text-white">
          C
        </span>
        <span className="text-sm font-semibold tracking-tight text-gray-800">
          Controle de Contas
        </span>
      </div>

      <div className="relative mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 py-5 sm:px-6 sm:py-8 md:flex-row md:items-center md:gap-12 md:px-10 md:py-12 lg:gap-20">
        <div className="pointer-events-none absolute left-[8%] top-[18%] hidden h-40 w-40 rounded-full bg-primary-50/80 blur-2xl md:block" />
        <div className="pointer-events-none absolute bottom-[22%] left-[28%] hidden h-28 w-28 rounded-full bg-gray-100/90 blur-xl md:block" />

        <div className="auth-fade-in relative z-10 hidden flex-1 md:block">
          <div className="mb-10 flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-600 text-sm font-bold text-white">
              C
            </span>
            <span className="text-sm font-semibold tracking-tight text-gray-800">
              Controle de Contas
            </span>
          </div>

          <h1
            className={`${authDisplay.className} max-w-lg text-4xl leading-[1.15] tracking-tight text-gray-900 md:text-5xl lg:text-[3.25rem]`}
          >
            Controle de Contas
          </h1>
          <p className="mt-5 max-w-md text-base leading-relaxed text-gray-500 sm:text-lg">
            Organize suas finanças, acompanhe seus gastos e alcance seus objetivos com
            tranquilidade.
          </p>

          <ul className="mt-8 space-y-4">
            {FEATURES.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-start gap-3">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary-600 text-white">
                  <Check className="h-3.5 w-3.5" strokeWidth={3} />
                </span>
                <span className="flex items-center gap-2 text-[15px] text-gray-700">
                  <Icon className="h-4 w-4 text-primary-600" aria-hidden />
                  {text}
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div className="auth-slide-up relative z-10 w-full md:max-w-[420px]">
          <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-[0_8px_40px_rgba(15,23,42,0.08)] sm:p-8 md:p-10">
            <div className="mb-6 text-center sm:mb-8">
              <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full border-2 border-primary-600 text-primary-600 sm:mb-4 sm:h-12 sm:w-12">
                <UserRound className="h-5 w-5 sm:h-6 sm:w-6" />
              </div>
              <h2 className="text-xl font-bold text-gray-900 sm:text-2xl">Bem-vindo de volta!</h2>
              <p className="mt-1.5 text-sm text-gray-500">Acesse sua conta para continuar</p>
            </div>

            <form className="space-y-5" onSubmit={handleSubmit(onSubmit)}>
              <div className="space-y-2">
                <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                  Email
                </label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  <input
                    id="email"
                    type="email"
                    autoComplete="email"
                    {...register('email', { required: 'Email é obrigatório' })}
                    className="block w-full rounded-lg border border-gray-200 bg-white py-3 pl-10 pr-4 text-gray-900 placeholder-gray-400 transition focus:border-transparent focus:outline-none focus:ring-2 focus:ring-primary-500"
                    placeholder="seu@email.com.br"
                  />
                </div>
                {errors.email && (
                  <p className="mt-1 text-xs text-red-500">{errors.email.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                  Senha
                </label>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    {...register('password', { required: 'Senha é obrigatória' })}
                    className="block w-full rounded-lg border border-gray-200 bg-white py-3 pl-10 pr-10 text-gray-900 placeholder-gray-400 transition focus:border-transparent focus:outline-none focus:ring-2 focus:ring-primary-500"
                    placeholder="Sua senha"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                    className="absolute inset-y-0 right-0 flex items-center pr-3"
                  >
                    {showPassword ? (
                      <EyeOff className="h-5 w-5 text-gray-400 hover:text-primary-600" />
                    ) : (
                      <Eye className="h-5 w-5 text-gray-400 hover:text-primary-600" />
                    )}
                  </button>
                </div>
                {errors.password && (
                  <p className="mt-1 text-xs text-red-500">{errors.password.message}</p>
                )}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
                <div className="flex items-center">
                  <input
                    id="remember-me"
                    type="checkbox"
                    checked={rememberEmail}
                    onChange={(e) => setRememberEmail(e.target.checked)}
                    className="h-4 w-4 cursor-pointer rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                  />
                  <label
                    htmlFor="remember-me"
                    className="ml-2 cursor-pointer text-sm text-gray-600"
                  >
                    Salvar login
                  </label>
                </div>
                <a
                  href="/forgot-password"
                  className="text-sm font-medium text-primary-600 hover:text-primary-700"
                >
                  Esqueceu a senha?
                </a>
              </div>

              <button
                type="submit"
                disabled={loading || biometricLoading}
                className="flex w-full items-center justify-center rounded-lg bg-primary-600 px-4 py-3 text-base font-semibold text-white shadow-sm transition hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? (
                  <span className="flex items-center">
                    <svg
                      className="-ml-1 mr-3 h-5 w-5 animate-spin text-white"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      ></circle>
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      ></path>
                    </svg>
                    Entrando...
                  </span>
                ) : (
                  'Entrar'
                )}
              </button>

              {biometricReady && hasBiometricCredentials && (
                <>
                  <div className="relative py-1">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-gray-200" />
                    </div>
                    <div className="relative flex justify-center text-xs">
                      <span className="bg-white px-2 text-gray-400">ou</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleBiometricLogin}
                    disabled={loading || biometricLoading}
                    className="flex w-full items-center justify-center gap-2 rounded-lg border-2 border-primary-600 bg-white px-4 py-3 text-base font-semibold text-primary-700 transition hover:bg-primary-50 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Fingerprint className="h-5 w-5" />
                    {biometricLoading ? 'Validando biometria...' : 'Entrar com biometria'}
                  </button>
                </>
              )}
            </form>

            <p className="mt-5 text-center text-xs leading-relaxed text-gray-500">
              Ao entrar, você declara que leu nossa{' '}
              <Link
                href="/privacidade"
                className="font-medium text-primary-600 hover:text-primary-700"
              >
                Política de Privacidade
              </Link>{' '}
              e os{' '}
              <Link href="/termos" className="font-medium text-primary-600 hover:text-primary-700">
                Termos de Uso
              </Link>
              .
            </p>

            <button
              type="button"
              onClick={() => setShowVersionInfo(true)}
              className="mt-6 mx-auto flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600"
            >
              <Info className="h-3.5 w-3.5" />
              Versão {versionInfo.frontend || APP_VERSION}
            </button>
          </div>
        </div>
      </div>

      {showVersionInfo && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
          onClick={() => setShowVersionInfo(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-semibold text-gray-900">Informações de versão</h2>
              <button
                type="button"
                onClick={() => setShowVersionInfo(false)}
                className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                aria-label="Fechar"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <dl className="space-y-3 text-sm">
              {versionInfo.app && (
                <div className="flex items-center justify-between gap-4">
                  <dt className="text-gray-500">App</dt>
                  <dd className="font-medium text-gray-900">{versionInfo.app}</dd>
                </div>
              )}
              <div className="flex items-center justify-between gap-4">
                <dt className="text-gray-500">Versão</dt>
                <dd className="font-medium text-gray-900">
                  {versionInfo.frontend || APP_VERSION}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-4">
                <dt className="text-gray-500">Build</dt>
                <dd className="font-medium text-gray-900 tabular-nums">
                  {versionInfo.frontendBuild || APP_BUILD}
                </dd>
              </div>
            </dl>
          </div>
        </div>
      )}

      <footer className="auth-fade-in border-t border-gray-100 bg-gray-50 px-4 py-4 sm:px-6 sm:py-5">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 md:flex-row md:items-center md:justify-between md:gap-8">
          <div className="flex items-start gap-3">
            <Shield className="mt-0.5 h-5 w-5 shrink-0 text-primary-600" />
            <div>
              <p className="text-sm font-semibold text-gray-800">Segurança é nossa prioridade</p>
              <p className="mt-0.5 text-xs leading-relaxed text-gray-500 sm:text-sm">
                Seus dados estão protegidos com criptografia e não compartilhamos suas informações.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pl-8 text-xs text-gray-600 sm:pl-0 sm:text-sm md:shrink-0">
            <span className="inline-flex items-center gap-1.5 font-medium text-primary-700">
              <Lock className="h-4 w-4" />
              Ambiente 100% seguro
            </span>
            <span className="hidden text-gray-300 sm:inline">|</span>
            <span>Em conformidade com a LGPD</span>
          </div>
          <div className="flex items-center gap-3 pl-8 text-xs text-gray-600 sm:pl-0 sm:text-sm md:shrink-0">
            <Link href="/privacidade" className="hover:text-primary-700">
              Privacidade
            </Link>
            <span className="text-gray-300">|</span>
            <Link href="/termos" className="hover:text-primary-700">
              Termos de uso
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
