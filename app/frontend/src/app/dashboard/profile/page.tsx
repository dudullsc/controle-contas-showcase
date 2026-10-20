'use client';

import { useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import { User, Eye, EyeOff, Save } from 'lucide-react';
import { userService } from '@/services/user.service';
import { authService } from '@/services/auth.service';
import { useForm } from 'react-hook-form';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { formatPhoneNumber, unformatPhoneNumber } from '@/lib/phoneFormatter';

interface ProfileForm {
  email: string;
  full_name: string;
  phone?: string;
  current_password?: string;
  password?: string;
  confirm_password?: string;
}

export default function ProfilePage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [phoneDisplay, setPhoneDisplay] = useState('');
  const { user: currentUser, logout, refreshUser } = useAuth();
  const router = useRouter();

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<ProfileForm>();
  const passwordValue = watch('password');

  // Handler para mudança no campo de telefone
  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatPhoneNumber(e.target.value);
    setPhoneDisplay(formatted);
    // Salvar apenas números no form
    setValue('phone', unformatPhoneNumber(formatted));
  };

  useEffect(() => {
    loadProfile();
  }, [currentUser]);

  const loadProfile = async () => {
    try {
      setLoading(true);
      if (currentUser) {
        const myProfile = await authService.getCurrentUser();
        setValue('email', myProfile.email);
        setValue('full_name', myProfile.full_name);
        setValue('phone', myProfile.phone || '');
        setValue('password', '');
        setPhoneDisplay(myProfile.phone ? formatPhoneNumber(myProfile.phone) : '');
      }
    } catch (error) {
      toast.error('Erro ao carregar perfil');
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = async (data: ProfileForm) => {
    try {
      setSaving(true);

      // Validação de senha - se quiser trocar senha, precisa informar a senha atual
      if (data.password || data.current_password || data.confirm_password) {
        if (!data.current_password) {
          toast.error('Informe a senha atual para alterar sua senha');
          return;
        }

        if (!data.password) {
          toast.error('Informe a nova senha');
          return;
        }

        if (data.password.length < 6) {
          toast.error('A nova senha deve ter no mínimo 6 caracteres');
          return;
        }

        if (data.password !== data.confirm_password) {
          toast.error('As senhas não coincidem');
          return;
        }
      }

      const updateData: any = {
        email: data.email,
        full_name: data.full_name,
        phone: data.phone,
      };

      if (data.password && data.current_password) {
        updateData.current_password = data.current_password;
        updateData.password = data.password;
      }

      await userService.updateMyProfile(updateData);

      // Se alterou a senha, fazer logout para segurança
      if (data.password && data.current_password) {
        toast.success('Senha alterada com sucesso! Faça login novamente.');
        setTimeout(() => {
          logout();
          router.push('/login');
        }, 2000);
        return;
      }

      toast.success('Perfil atualizado com sucesso!');

      // Atualizar contexto de autenticação
      await refreshUser();

      // Recarregar dados do usuário
      await loadProfile();

      // Se mudou o email, pode precisar fazer logout/login
      if (data.email !== currentUser?.email) {
        toast.info('Email alterado. Faça login novamente.');
        setTimeout(() => {
          logout();
          router.push('/login');
        }, 2000);
      }
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Erro ao atualizar perfil');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Meu Perfil</h1>
          <p className="mt-1 text-sm text-gray-500">
            Gerencie suas informações pessoais e configurações
          </p>
        </div>
      </div>

      {/* Formulário de Perfil */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Informações Pessoais */}
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <User className="h-5 w-5" />
              Informações Pessoais
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nome Completo *
                </label>
                <input
                  type="text"
                  {...register('full_name', { required: 'Nome é obrigatório' })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
                {errors.full_name && (
                  <p className="mt-1 text-sm text-red-600">{errors.full_name.message}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Email *</label>
                <input
                  type="email"
                  {...register('email', {
                    required: 'Email é obrigatório',
                    pattern: {
                      value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                      message: 'Email inválido',
                    },
                  })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
                {errors.email && (
                  <p className="mt-1 text-sm text-red-600">{errors.email.message}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Telefone</label>
                <input
                  type="text"
                  value={phoneDisplay}
                  onChange={handlePhoneChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder="(48) 9 8859-3816"
                />
              </div>
            </div>
          </div>

          {/* Senha */}
          <div className="border-t pt-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Alterar Senha</h2>
            <p className="text-sm text-gray-500 mb-4">
              Para alterar sua senha, informe a senha atual e a nova senha
            </p>

            {/* Senha Atual */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">Senha Atual</label>
              <div className="relative">
                <input
                  type={showCurrentPassword ? 'text' : 'password'}
                  {...register('current_password')}
                  className="w-full px-4 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder="Digite sua senha atual"
                />
                <button
                  type="button"
                  onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                >
                  {showCurrentPassword ? (
                    <EyeOff className="h-5 w-5 text-gray-400" />
                  ) : (
                    <Eye className="h-5 w-5 text-gray-400" />
                  )}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Nova Senha</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    {...register('password', {
                      minLength: {
                        value: 6,
                        message: 'Senha deve ter no mínimo 6 caracteres',
                      },
                    })}
                    className="w-full px-4 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    placeholder="Digite a nova senha"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  >
                    {showPassword ? (
                      <EyeOff className="h-5 w-5 text-gray-400" />
                    ) : (
                      <Eye className="h-5 w-5 text-gray-400" />
                    )}
                  </button>
                </div>
                {errors.password && (
                  <p className="mt-1 text-sm text-red-600">{errors.password.message}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Confirmar Senha
                </label>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    {...register('confirm_password', {
                      validate: (value) =>
                        !passwordValue || value === passwordValue || 'As senhas não coincidem',
                    })}
                    className="w-full px-4 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    placeholder="Confirme a nova senha"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  >
                    {showConfirmPassword ? (
                      <EyeOff className="h-5 w-5 text-gray-400" />
                    ) : (
                      <Eye className="h-5 w-5 text-gray-400" />
                    )}
                  </button>
                </div>
                {errors.confirm_password && (
                  <p className="mt-1 text-sm text-red-600">{errors.confirm_password.message}</p>
                )}
              </div>
            </div>
          </div>

          {/* Botões */}
          <div className="flex justify-end space-x-3 pt-4 border-t">
            <button
              type="button"
              onClick={() => loadProfile()}
              className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 border border-gray-300 rounded-lg transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-primary-600 to-primary-700 hover:from-primary-700 hover:to-primary-800 rounded-lg shadow-md transition-all disabled:opacity-50 flex items-center gap-2"
            >
              <Save className="h-4 w-4" />
              {saving ? 'Salvando...' : 'Salvar Alterações'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
