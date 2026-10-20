'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { toast } from 'react-toastify';
import { Lock, Eye, EyeOff, CheckCircle } from 'lucide-react';
import api from '@/lib/api';
import { authDisplay, authSans } from '@/lib/auth-fonts';

interface ResetPasswordForm {
  password: string;
  confirmPassword: string;
}

function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div
      className={`${authSans.variable} ${authDisplay.variable} ${authSans.className} relative min-h-screen overflow-hidden`}
    >
      <div className="pointer-events-none absolute inset-0 bg-[#f8fafc]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,_rgba(37,99,235,0.12),_transparent_55%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,_rgba(29,78,216,0.08),_transparent_50%)]" />
      <div className="relative z-10 flex min-h-screen items-center justify-center px-6 py-12">
        {children}
      </div>
    </div>
  );
}

function ResetPasswordForm() {
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<ResetPasswordForm>();
  const password = watch('password');

  useEffect(() => {
    if (!token) {
      toast.error('Token inválido');
      router.push('/forgot-password');
    }
  }, [token, router]);

  const onSubmit = async (data: ResetPasswordForm) => {
    if (!token) return;

    if (data.password !== data.confirmPassword) {
      toast.error('As senhas não coincidem');
      return;
    }

    try {
      setLoading(true);
      await api.post('/auth/reset-password', null, {
        params: {
          token: token,
          new_password: data.password,
        },
      });
      setSuccess(true);
      toast.success('Senha redefinida com sucesso!');
      setTimeout(() => {
        router.push('/login');
      }, 2000);
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Erro ao redefinir senha');
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return null;
  }

  if (success) {
    return (
      <AuthShell>
        <div className="auth-fade-in w-full max-w-md rounded-2xl border border-gray-200/80 bg-white/80 p-8 text-center shadow-sm backdrop-blur-sm sm:p-10">
          <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-primary-50">
            <CheckCircle className="h-6 w-6 text-primary-600" />
          </div>
          <h1 className={`${authDisplay.className} mb-2 text-3xl text-gray-900`}>
            Senha redefinida!
          </h1>
          <p className="text-gray-500">
            Sua senha foi redefinida com sucesso. Redirecionando para o login...
          </p>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      <div className="auth-slide-up w-full max-w-md rounded-2xl border border-gray-200/80 bg-white/80 p-8 shadow-sm backdrop-blur-sm sm:p-10">
        <div className="mb-8">
          <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-primary-50">
            <Lock className="h-6 w-6 text-primary-600" />
          </div>
          <h1 className={`${authDisplay.className} text-3xl tracking-tight text-gray-900`}>
            Redefinir Senha
          </h1>
          <p className="mt-3 text-sm text-gray-500">Digite sua nova senha abaixo</p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          <div className="space-y-2">
            <label htmlFor="password" className="block text-sm font-medium text-gray-600">
              Nova Senha
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                {...register('password', {
                  required: 'Senha é obrigatória',
                  minLength: {
                    value: 6,
                    message: 'Senha deve ter no mínimo 6 caracteres',
                  },
                })}
                className="w-full rounded-xl border border-gray-200 px-4 py-3 pr-10 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="Digite sua nova senha"
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
              <p className="mt-1 text-sm text-red-600">{errors.password.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <label
              htmlFor="confirmPassword"
              className="block text-sm font-medium text-gray-600"
            >
              Confirmar Senha
            </label>
            <div className="relative">
              <input
                id="confirmPassword"
                type={showConfirmPassword ? 'text' : 'password'}
                {...register('confirmPassword', {
                  required: 'Confirmação de senha é obrigatória',
                  validate: (value) => value === password || 'As senhas não coincidem',
                })}
                className="w-full rounded-xl border border-gray-200 px-4 py-3 pr-10 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="Confirme sua nova senha"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                aria-label={
                  showConfirmPassword ? 'Ocultar confirmação' : 'Mostrar confirmação'
                }
                className="absolute inset-y-0 right-0 flex items-center pr-3"
              >
                {showConfirmPassword ? (
                  <EyeOff className="h-5 w-5 text-gray-400 hover:text-primary-600" />
                ) : (
                  <Eye className="h-5 w-5 text-gray-400 hover:text-primary-600" />
                )}
              </button>
            </div>
            {errors.confirmPassword && (
              <p className="mt-1 text-sm text-red-600">{errors.confirmPassword.message}</p>
            )}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-primary-600 px-4 py-3 font-semibold text-white transition hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 disabled:opacity-50"
          >
            {loading ? 'Redefinindo...' : 'Redefinir Senha'}
          </button>
        </form>
      </div>
    </AuthShell>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <AuthShell>
          <div className="w-full max-w-md rounded-2xl border border-gray-200/80 bg-white/80 p-8 text-center shadow-sm backdrop-blur-sm sm:p-10">
            <div className="mx-auto mb-4 flex h-12 w-12 animate-pulse items-center justify-center rounded-xl bg-gray-100">
              <Lock className="h-6 w-6 text-gray-400" />
            </div>
            <h1 className={`${authDisplay.className} text-2xl text-gray-900`}>Carregando...</h1>
          </div>
        </AuthShell>
      }
    >
      <ResetPasswordForm />
    </Suspense>
  );
}
