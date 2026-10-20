'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { toast } from 'react-toastify';
import { Mail, ArrowLeft } from 'lucide-react';
import api from '@/lib/api';
import { authDisplay, authSans } from '@/lib/auth-fonts';

interface ForgotPasswordForm {
  email: string;
}

export default function ForgotPasswordPage() {
  const [loading, setLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const router = useRouter();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotPasswordForm>();

  const onSubmit = async (data: ForgotPasswordForm) => {
    try {
      setLoading(true);
      await api.post('/auth/forgot-password', null, {
        params: { email: data.email },
      });
      setEmailSent(true);
      toast.success(
        'Se o email estiver cadastrado, enviaremos instruções para redefinir sua senha.'
      );
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Erro ao enviar email');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className={`${authSans.variable} ${authDisplay.variable} ${authSans.className} relative min-h-screen overflow-hidden`}
    >
      <div className="pointer-events-none absolute inset-0 bg-[#f8fafc]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,_rgba(37,99,235,0.12),_transparent_55%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,_rgba(29,78,216,0.08),_transparent_50%)]" />

      <div className="relative z-10 flex min-h-screen items-center justify-center px-6 py-12">
        <div className="auth-slide-up w-full max-w-md rounded-2xl border border-gray-200/80 bg-white/80 p-8 shadow-sm backdrop-blur-sm sm:p-10">
          <button
            onClick={() => router.push('/login')}
            className="mb-8 flex items-center gap-2 text-sm text-gray-500 transition hover:text-primary-700"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Voltar para login</span>
          </button>

          <div className="mb-8">
            <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-primary-50">
              <Mail className="h-6 w-6 text-primary-600" />
            </div>
            <h1
              className={`${authDisplay.className} text-3xl tracking-tight text-gray-900`}
            >
              Esqueceu sua senha?
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-gray-500">
              {emailSent
                ? 'Se o email estiver cadastrado, enviaremos instruções. Verifique sua caixa de entrada e spam.'
                : 'Digite seu email e, se estiver cadastrado, enviaremos um link para redefinir sua senha.'}
            </p>
          </div>

          {!emailSent ? (
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
              <div className="space-y-2">
                <label htmlFor="email" className="block text-sm font-medium text-gray-600">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  {...register('email', {
                    required: 'Email é obrigatório',
                    pattern: {
                      value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                      message: 'Email inválido',
                    },
                  })}
                  className="w-full rounded-xl border border-gray-200 px-4 py-3 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="seu@email.com"
                />
                {errors.email && (
                  <p className="mt-1 text-sm text-red-600">{errors.email.message}</p>
                )}
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-xl bg-primary-600 px-4 py-3 font-semibold text-white transition hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 disabled:opacity-50"
              >
                {loading ? 'Enviando...' : 'Enviar link de redefinição'}
              </button>
            </form>
          ) : (
            <div>
              <div className="mb-5 rounded-xl border border-primary-200 bg-primary-50 p-4">
                <p className="text-sm text-primary-800">
                  Se o email estiver cadastrado, enviaremos instruções para redefinir
                  sua senha. Verifique sua caixa de entrada e spam.
                </p>
              </div>
              <button
                onClick={() => router.push('/login')}
                className="w-full rounded-xl bg-gray-900 px-4 py-3 font-semibold text-white transition hover:bg-gray-800"
              >
                Voltar para login
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
