'use client';

import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { toast } from 'react-toastify';
import {
  Plus,
  Edit2,
  Trash2,
  Shield,
  User as UserIcon,
  Eye,
  EyeOff,
  DollarSign,
  Calendar,
  CheckCircle,
  XCircle,
  Mail,
  Phone,
  CreditCard,
} from 'lucide-react';
import { userService } from '@/services/user.service';
import { authService } from '@/services/auth.service';
import { User } from '@/types';
import { useForm } from 'react-hook-form';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { formatPhoneNumber, unformatPhoneNumber } from '@/lib/phoneFormatter';
import { formatCPF, unformatCPF, validateCPF, formatCPFInput } from '@/lib/cpfFormatter';
import api from '@/lib/api';
import DeleteConfirmModal from '@/components/expenses/DeleteConfirmModal';

interface UserForm {
  email: string;
  full_name: string;
  cpf: string;
  family_id?: string;
  role: User['role'];
  phone?: string;
  password: string;
  confirm_password?: string;
  is_active: boolean;
  monthly_salary?: number;
  salary_payment_day?: number;
}

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [salaryDisplay, setSalaryDisplay] = useState('');
  const [cpfIsValid, setCpfIsValid] = useState<boolean | null>(null);
  const [cpfAlreadyExists, setCpfAlreadyExists] = useState(false);
  const [phoneDisplay, setPhoneDisplay] = useState('');
  const [cpfDisplay, setCpfDisplay] = useState('');
  const [activeTab, setActiveTab] = useState<'users' | 'families'>('users');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [userToDelete, setUserToDelete] = useState<string | null>(null);
  // Families state (SuperAdmin only)
  type Family = {
    _id: string;
    name: string;
    description?: string | null;
    owner_cpf?: string | null;
    created_at: string;
    updated_at: string;
  };
  const [families, setFamilies] = useState<Family[]>([]);
  const [availableFamilies, setAvailableFamilies] = useState<Family[]>([]);
  const [loadingFamilies, setLoadingFamilies] = useState(false);
  const [famLoading, setFamLoading] = useState(false);
  const [famCreating, setFamCreating] = useState(false);
  const [famError, setFamError] = useState<string | null>(null);
  const [famName, setFamName] = useState('');
  const [famDescription, setFamDescription] = useState('');
  const [famOwnerCpf, setFamOwnerCpf] = useState('');
  const { user: currentUser } = useAuth();
  const router = useRouter();
  const isAdmin =
    !!currentUser && (currentUser.role === 'USERADMIN' || currentUser.role === 'USERADMINSUPER');
  const isSuperAdmin = currentUser?.role === 'USERADMINSUPER';

  // Debug: log do status do usuário
  useEffect(() => {
    console.log('UsersPage Debug:', {
      currentUser: currentUser?.email,
      role: currentUser?.role,
      isSuperAdmin,
      isAdmin,
    });
  }, [currentUser, isSuperAdmin, isAdmin]);

  // Redirecionar se não é admin
  useEffect(() => {
    if (!currentUser && !loading) {
      router.push('/login');
    }
  }, [currentUser, loading, router]);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<UserForm>();
  const passwordValue = watch('password');
  const confirmPasswordValue = watch('confirm_password');
  const cpfValue = watch('cpf');

  // Estado para força da senha
  const [passwordStrength, setPasswordStrength] = useState<'weak' | 'medium' | 'strong' | null>(
    null
  );

  // Calcular força da senha
  const calculatePasswordStrength = (password: string): 'weak' | 'medium' | 'strong' | null => {
    if (!password) return null;

    let strength = 0;

    // Critérios de força
    if (password.length >= 8) strength++;
    if (password.length >= 12) strength++;
    if (/[a-z]/.test(password)) strength++;
    if (/[A-Z]/.test(password)) strength++;
    if (/[0-9]/.test(password)) strength++;
    if (/[^A-Za-z0-9]/.test(password)) strength++; // Caracteres especiais

    if (strength <= 2) return 'weak';
    if (strength <= 4) return 'medium';
    return 'strong';
  };

  // Atualizar força da senha quando mudar
  const watchedPassword = watch('password');
  useEffect(() => {
    setPasswordStrength(calculatePasswordStrength(watchedPassword || ''));
  }, [watchedPassword]);

  // Função para formatar valor monetário enquanto digita
  const formatCurrencyInput = (value: string): string => {
    // Remove tudo que não é número
    const numericValue = value.replace(/\D/g, '');

    if (!numericValue) return '';

    // Converte para número e divide por 100 (centavos)
    const numberValue = Number(numericValue) / 100;

    // Formata como moeda brasileira
    return new Intl.NumberFormat('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(numberValue);
  };

  // Função para converter valor formatado para número
  const parseCurrencyToNumber = (value: string): number => {
    const numericValue = value.replace(/\D/g, '');
    return Number(numericValue) / 100;
  };

  // Handler para mudança no campo de salário
  const handleSalaryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatCurrencyInput(e.target.value);
    setSalaryDisplay(formatted);
    const numericValue = parseCurrencyToNumber(formatted);
    setValue('monthly_salary', numericValue);
  };

  // Handler para mudança no campo de telefone
  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatPhoneNumber(e.target.value);
    setPhoneDisplay(formatted);
    // Salvar apenas números no form
    setValue('phone', unformatPhoneNumber(formatted));
  };

  // Handler para mudança no CPF da família
  const handleFamCpfChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatCPFInput(e.target.value);
    const cleaned = unformatCPF(formatted);
    // Mostra formatado, salva limpo
    setFamOwnerCpf(formatted);
  };

  // Handler para mudança no campo de CPF
  const handleCpfChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatCPFInput(e.target.value);
    setCpfDisplay(formatted);
    const cleaned = unformatCPF(formatted);
    // Salvar apenas números no form
    setValue('cpf', cleaned);

    // Validar CPF se tiver 11 dígitos
    if (cleaned.length === 11) {
      const isValid = validateCPF(cleaned);
      setCpfIsValid(isValid);

      // Verificar se CPF já existe (apenas ao criar novo usuário)
      if (isValid && !editingUser) {
        const cpfExists = users.some((user) => user.cpf && unformatCPF(user.cpf) === cleaned);
        setCpfAlreadyExists(cpfExists);
      } else {
        setCpfAlreadyExists(false);
      }
    } else {
      setCpfIsValid(null);
      setCpfAlreadyExists(false);
    }
  };

  useEffect(() => {
    // Se não for admin, redirecionar para perfil
    if (currentUser && !isAdmin) {
      router.push('/dashboard/profile');
      return;
    }
    if (isAdmin) {
      loadUsers();
    }
  }, [currentUser, router, isAdmin]);

  // Load families when switching to families tab (only SuperAdmin)
  useEffect(() => {
    if (isSuperAdmin && activeTab === 'families') {
      fetchFamilies();
    }
  }, [isSuperAdmin, activeTab]);
  const loadUsers = async () => {
    try {
      setLoading(true);
      if (isAdmin) {
        const data = await userService.getAll();
        const otherUsers = data.filter((user) => user._id !== currentUser?._id);
        setUsers(otherUsers);
      }
    } catch (error) {
      toast.error('Erro ao carregar usuários');
    } finally {
      setLoading(false);
    }
  };

  const loadAvailableFamilies = async () => {
    try {
      setLoadingFamilies(true);
      const response = await api.get('/families/list/available');
      setAvailableFamilies(response.data);
    } catch (error) {
      console.error('Erro ao carregar famílias:', error);
    } finally {
      setLoadingFamilies(false);
    }
  };

  const onSubmit = async (data: UserForm) => {
    try {
      if (!isAdmin) {
        toast.error('Apenas administradores podem gerenciar usuários');
        return;
      }

      if (editingUser) {
        const updateData: any = {
          email: data.email,
          full_name: data.full_name,
          phone: data.phone,
          is_active: data.is_active,
        };

        if (data.password) {
          updateData.password = data.password;
        }
        if (data.monthly_salary !== undefined) {
          updateData.monthly_salary = data.monthly_salary;
        }
        if (data.salary_payment_day) {
          updateData.salary_payment_day = data.salary_payment_day;
        }
        if (isSuperAdmin) {
          updateData.role = data.role;
          if (data.family_id) {
            updateData.family_id = data.family_id;
          }
        }

        await userService.update(editingUser._id, updateData);
        toast.success('Usuário atualizado com sucesso!');
      } else {
        if (!isSuperAdmin && data.role === 'USERADMINSUPER') {
          toast.error('Apenas superadmins podem criar outros superadmins');
          return;
        }

        const createData: any = {
          email: data.email,
          full_name: data.full_name,
          phone: data.phone,
          password: data.password,
          cpf: data.cpf || null, // Garante que CPF seja enviado limpo
          role: data.role,
          is_active: data.is_active,
        };

        if (isSuperAdmin && data.family_id) {
          createData.family_id = data.family_id;
        }

        if (data.monthly_salary !== undefined) {
          createData.monthly_salary = data.monthly_salary;
        }
        if (data.salary_payment_day) {
          createData.salary_payment_day = data.salary_payment_day;
        }

        await userService.create(createData);
        toast.success('Usuário criado com sucesso!', { autoClose: 1000 });
      }
      setShowModal(false);
      reset();
      setEditingUser(null);
      setSalaryDisplay('');
      setPhoneDisplay('');
      setCpfDisplay('');
      setCpfIsValid(null);
      setCpfAlreadyExists(false);
      loadUsers();
    } catch (error: any) {
      toast.error(error.message || 'Erro ao salvar usuário');
    }
  };

  // Families handlers
  const fetchFamilies = async () => {
    try {
      setFamLoading(true);
      const res = await api.get<Family[]>('/families/');
      setFamilies(res.data);
    } catch (e: any) {
      const status = e?.response?.status;
      const detail = e?.response?.data?.detail || e?.message;
      console.error('Erro ao carregar famílias:', { status, detail });
      setFamError(
        status
          ? `(${status}) ${detail || 'Falha ao carregar famílias'}`
          : detail || 'Falha ao carregar famílias'
      );
    } finally {
      setFamLoading(false);
    }
  };

  const handleCreateFamily = async (e: React.FormEvent) => {
    e.preventDefault();
    setFamError(null);
    if (!famName.trim()) {
      setFamError('Nome é obrigatório');
      return;
    }
    if (!famOwnerCpf.trim()) {
      setFamError('CPF do responsável é obrigatório');
      return;
    }
    try {
      setFamCreating(true);
      const payload: any = { name: famName.trim() };
      if (famDescription.trim()) payload.description = famDescription.trim();

      // CPF é obrigatório
      const cleanedCpf = unformatCPF(famOwnerCpf);
      if (!validateCPF(cleanedCpf)) {
        setFamError('CPF do responsável inválido');
        setFamCreating(false);
        return;
      }
      payload.owner_cpf = cleanedCpf;

      await api.post('/families/', payload);
      setFamName('');
      setFamDescription('');
      setFamOwnerCpf('');
      await fetchFamilies();
      toast.success('Família criada com sucesso!');
    } catch (e: any) {
      setFamError(e?.response?.data?.detail || 'Falha ao criar família');
    } finally {
      setFamCreating(false);
    }
  };

  const handleEdit = (user: User) => {
    // Se não é admin, só pode editar seu próprio perfil
    if (!isAdmin && user._id !== currentUser?._id) {
      toast.error('Você só pode editar seu próprio perfil');
      return;
    }

    setEditingUser(user);
    setValue('email', user.email);
    setValue('full_name', user.full_name);
    setValue('phone', user.phone || '');
    setValue('is_active', user.is_active);
    setValue('role', user.role);
    setValue('family_id', user.family_id || '');
    setValue('cpf', user.cpf || '');
    setValue('password', '');

    // Formatar salário para exibição

    // Formatar telefone para exibição
    setPhoneDisplay(user.phone ? formatPhoneNumber(user.phone) : '');

    // Formatar CPF para exibição
    setCpfDisplay(user.cpf ? formatCPF(user.cpf) : '');

    setShowModal(true);
  };

  const handleDelete = async (id: string) => {
    setUserToDelete(id);
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    if (!userToDelete) return;

    try {
      await userService.delete(userToDelete);
      toast.success('Usuário excluído com sucesso!');
      loadUsers();
    } catch (error) {
      toast.error('Erro ao excluir usuário');
    } finally {
      setShowDeleteModal(false);
      setUserToDelete(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            {isAdmin ? 'Usuários' : 'Meu Perfil'}
          </h1>
        </div>
        {isAdmin && (
          <button
            onClick={() => {
              reset({
                email: '',
                full_name: '',
                phone: '',
                password: '',
                cpf: '',
                family_id: isSuperAdmin ? '' : currentUser?.family_id || '',
                role: isSuperAdmin ? 'USER' : 'USER',
                is_active: true,
              });
              setEditingUser(null);
              setSalaryDisplay('');
              setPhoneDisplay('');
              setCpfDisplay('');
              // Carregar famílias disponíveis quando abrir modal
              if (isSuperAdmin) {
                loadAvailableFamilies();
              }
              setShowModal(true);
            }}
            className="flex items-center space-x-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 transition-colors"
          >
            <Plus className="h-5 w-5" />
            <span>Novo Usuário</span>
          </button>
        )}
      </div>
      <div className="flex gap-2 mt-4">
        <button
          onClick={() => setActiveTab('users')}
          className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
            activeTab === 'users'
              ? 'bg-primary-600 text-white border-primary-600'
              : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
          }`}
        >
          Usuários
        </button>
        {isSuperAdmin && (
          <button
            onClick={() => setActiveTab('families')}
            className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
              activeTab === 'families'
                ? 'bg-primary-600 text-white border-primary-600'
                : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
            }`}
          >
            Famílias
          </button>
        )}
      </div>

      {/* Users Table */}
      {activeTab === 'users' && (
        <div className="rounded-xl bg-white shadow-sm border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Usuário
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Email
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Telefone
                  </th>
                  {isAdmin && (
                    <>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        CPF
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Família
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Papel
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Criado em
                      </th>
                    </>
                  )}
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Ações
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {loading ? (
                  <tr>
                    <td colSpan={isAdmin ? 7 : 4} className="px-6 py-8 text-center">
                      <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
                    </td>
                  </tr>
                ) : users.length > 0 ? (
                  users.map((user) => (
                    <tr key={user._id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="flex-shrink-0 h-10 w-10 bg-primary-100 rounded-full flex items-center justify-center">
                            <span className="text-primary-700 font-semibold">
                              {user.full_name.charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-medium text-gray-900">
                              {user.full_name}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{user.email}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-500">{user.phone || '-'}</div>
                      </td>
                      {isAdmin && (
                        <>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                            {user.cpf || '-'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                            {user.family_id || '-'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            {user.role === 'USERADMIN' || user.role === 'USERADMINSUPER' ? (
                              <span className="inline-flex items-center space-x-1 rounded-full bg-purple-100 px-2.5 py-0.5 text-xs font-semibold text-purple-800">
                                <Shield className="h-3 w-3" />
                                <span>
                                  {user.role === 'USERADMINSUPER' ? 'Superadmin' : 'Admin'}
                                </span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center space-x-1 rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-semibold text-blue-800">
                                <UserIcon className="h-3 w-3" />
                                <span>Usuário</span>
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span
                              className={`inline-flex rounded-full px-2 text-xs font-semibold leading-5 ${
                                user.is_active
                                  ? 'bg-green-100 text-green-800'
                                  : 'bg-red-100 text-red-800'
                              }`}
                            >
                              {user.is_active ? 'Ativo' : 'Inativo'}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {format(new Date(user.created_at), 'dd/MM/yyyy')}
                          </td>
                        </>
                      )}
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button
                          onClick={() => handleEdit(user)}
                          className="text-primary-600 hover:text-primary-900 mr-3"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                        {isAdmin && user._id !== currentUser?._id && (
                          <button
                            onClick={() => handleDelete(user._id)}
                            className="text-red-600 hover:text-red-900"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td
                      colSpan={isAdmin ? 7 : 4}
                      className="px-6 py-8 text-center text-sm text-gray-500"
                    >
                      Nenhum usuário encontrado
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Families Management (SuperAdmin) */}
      {isSuperAdmin === true && activeTab === 'families' && (
        <div className="space-y-6">
          <form onSubmit={handleCreateFamily} className="bg-white rounded-lg shadow p-4 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Nome da família</label>
              <input
                type="text"
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                value={famName}
                onChange={(e) => setFamName(e.target.value)}
                placeholder="Ex: Família Silva"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Descrição (opcional)
              </label>
              <input
                type="text"
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                value={famDescription}
                onChange={(e) => setFamDescription(e.target.value)}
                placeholder="Alguma observação"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  CPF do responsável <span className="text-red-600">*</span>
                </label>
                <input
                  type="text"
                  className={`mt-1 block w-full rounded-md border shadow-sm focus:border-primary-500 focus:ring-primary-500 ${
                    famOwnerCpf &&
                    unformatCPF(famOwnerCpf).length === 11 &&
                    !validateCPF(unformatCPF(famOwnerCpf))
                      ? 'border-red-300 bg-red-50'
                      : 'border-gray-300'
                  }`}
                  value={famOwnerCpf}
                  onChange={handleFamCpfChange}
                  placeholder="000.000.000-00"
                />
                {famOwnerCpf &&
                  unformatCPF(famOwnerCpf).length === 11 &&
                  !validateCPF(unformatCPF(famOwnerCpf)) && (
                    <p className="text-sm text-red-600 mt-1">CPF inválido</p>
                  )}
              </div>
            </div>

            {famError && <div className="text-sm text-red-600">{famError}</div>}

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={famCreating}
                className="inline-flex items-center rounded-md bg-primary-600 px-4 py-2 text-sm font-medium text-white shadow hover:bg-primary-700 disabled:opacity-60"
              >
                {famCreating ? 'Criando...' : 'Criar Família'}
              </button>
            </div>
          </form>

          <div className="bg-white rounded-lg shadow">
            <div className="px-4 py-3 border-b">
              <h2 className="text-lg font-semibold text-gray-800">Famílias cadastradas</h2>
            </div>
            {famLoading ? (
              <div className="p-4 text-gray-600">Carregando...</div>
            ) : families.length === 0 ? (
              <div className="p-4 text-gray-600">Nenhuma família encontrada.</div>
            ) : (
              <ul className="divide-y">
                {families.map((fam) => (
                  <li key={fam._id} className="p-4 flex items-center justify-between">
                    <div>
                      <p className="font-medium text-gray-900">{fam.name}</p>
                      <p className="text-sm text-gray-500">ID: {fam._id}</p>
                      {fam.owner_cpf ? (
                        <p className="text-sm text-gray-500">Responsável (CPF): {fam.owner_cpf}</p>
                      ) : null}
                    </div>
                    <div className="text-xs text-gray-400">
                      Criada em {new Date(fam.created_at).toLocaleString()}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {/* Modal */}
      {activeTab === 'users' && showModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-screen items-center justify-center px-4">
            <div
              className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"
              onClick={() => setShowModal(false)}
            />

            <div className="relative bg-white rounded-lg shadow-xl max-w-lg w-full">
              <div className="px-6 py-5 bg-gradient-to-r from-blue-600 to-blue-500 rounded-t-lg">
                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                  <UserIcon className="h-6 w-6" />
                  {editingUser ? 'Editar Usuário' : 'Novo Usuário'}
                </h3>
              </div>

              <form onSubmit={handleSubmit(onSubmit)} className="px-6 py-4 space-y-4">
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
                    <UserIcon className="h-4 w-4 text-blue-600" />
                    Nome Completo *
                  </label>
                  <input
                    type="text"
                    {...register('full_name', { required: 'Nome é obrigatório' })}
                    className="w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  />
                  {errors.full_name && (
                    <p className="mt-1 text-sm text-red-600">{errors.full_name.message}</p>
                  )}
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
                    <Mail className="h-4 w-4 text-blue-600" />
                    Email *
                  </label>
                  <input
                    type="email"
                    {...register('email', { required: 'Email é obrigatório' })}
                    className="w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  />
                  {errors.email && (
                    <p className="mt-1 text-sm text-red-600">{errors.email.message}</p>
                  )}
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
                    <Phone className="h-4 w-4 text-blue-600" />
                    Telefone
                  </label>
                  <input
                    type="text"
                    value={phoneDisplay}
                    onChange={handlePhoneChange}
                    className="w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    placeholder="(48) 9 8859-3816"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
                    <CreditCard className="h-4 w-4 text-blue-600" />
                    CPF *
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={cpfDisplay}
                      onChange={handleCpfChange}
                      disabled={!!editingUser}
                      className="w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 pr-10"
                      placeholder="000.000.000-00"
                      maxLength={14}
                    />
                    {cpfIsValid === true && (
                      <CheckCircle className="absolute right-3 top-1/2 transform -translate-y-1/2 text-green-500 w-5 h-5" />
                    )}
                    {cpfIsValid === false && (
                      <XCircle className="absolute right-3 top-1/2 transform -translate-y-1/2 text-red-500 w-5 h-5" />
                    )}
                  </div>
                  {cpfIsValid === true && !cpfAlreadyExists && (
                    <p className="mt-1 text-sm text-green-600 font-medium">✓ CPF Válido</p>
                  )}
                  {cpfIsValid === false && (
                    <p className="mt-1 text-sm text-red-600 font-medium">✗ CPF Inválido</p>
                  )}
                  {cpfAlreadyExists && (
                    <p className="mt-1 text-sm text-orange-600 font-medium">
                      ⚠ Este CPF já está cadastrado
                    </p>
                  )}
                  <input
                    type="hidden"
                    {...register('cpf', {
                      required: 'CPF é obrigatório',
                      validate: (value) => {
                        if (!value) return 'CPF é obrigatório';
                        if (!validateCPF(value)) return 'CPF inválido';
                        if (
                          !editingUser &&
                          users.some((u) => u.cpf && unformatCPF(u.cpf) === value)
                        ) {
                          return 'Este CPF já está cadastrado';
                        }
                        return true;
                      },
                    })}
                  />
                  {errors.cpf && (
                    <p className="mt-1 text-sm text-red-600">{errors.cpf.message as string}</p>
                  )}
                </div>

                {isSuperAdmin && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Família</label>
                    {loadingFamilies ? (
                      <div className="w-full rounded-lg border border-gray-300 bg-gray-50 p-2 text-gray-500 text-sm">
                        Carregando famílias...
                      </div>
                    ) : availableFamilies.length > 0 ? (
                      <select
                        {...register('family_id')}
                        className="w-full rounded-lg border border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                      >
                        <option value="">Selecione uma família</option>
                        {availableFamilies.map((fam) => (
                          <option key={fam._id} value={fam._id}>
                            {fam.name} ({fam._id})
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type="text"
                        {...register('family_id')}
                        className="w-full rounded-lg border border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                        placeholder="cpf ou identificador da família"
                      />
                    )}
                    <p className="text-xs text-gray-500 mt-1">
                      Deixe em branco para usar o CPF ao criar.
                    </p>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Senha {editingUser && '(deixe em branco para não alterar)'}
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      {...register('password', {
                        required: editingUser ? false : 'Senha é obrigatória',
                        minLength: { value: 8, message: 'Mínimo 8 caracteres' },
                        validate: (value) => {
                          if (!value && editingUser) return true;
                          if (!value) return 'Senha é obrigatória';

                          if (!/[a-z]/.test(value)) return 'Deve conter letra minúscula';
                          if (!/[A-Z]/.test(value)) return 'Deve conter letra maiúscula';
                          if (!/[0-9]/.test(value)) return 'Deve conter número';
                          if (!/[^A-Za-z0-9]/.test(value)) return 'Deve conter caractere especial';

                          return true;
                        },
                      })}
                      className="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 pr-10 bg-white text-gray-900"
                      placeholder="Digite a senha"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center"
                    >
                      {showPassword ? (
                        <EyeOff className="h-5 w-5 text-gray-400 hover:text-gray-600" />
                      ) : (
                        <Eye className="h-5 w-5 text-gray-400 hover:text-gray-600" />
                      )}
                    </button>
                  </div>

                  {/* Indicador de força da senha */}
                  {watchedPassword && !editingUser && (
                    <div className="mt-2">
                      <div className="flex items-center gap-2 mb-1">
                        <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                          <div
                            className={`h-full transition-all duration-300 ${
                              passwordStrength === 'weak'
                                ? 'bg-red-500 w-1/3'
                                : passwordStrength === 'medium'
                                  ? 'bg-yellow-500 w-2/3'
                                  : passwordStrength === 'strong'
                                    ? 'bg-green-500 w-full'
                                    : 'w-0'
                            }`}
                          />
                        </div>
                        <span
                          className={`text-xs font-medium ${
                            passwordStrength === 'weak'
                              ? 'text-red-600'
                              : passwordStrength === 'medium'
                                ? 'text-yellow-600'
                                : passwordStrength === 'strong'
                                  ? 'text-green-600'
                                  : 'text-gray-400'
                          }`}
                        >
                          {passwordStrength === 'weak'
                            ? 'Fraca'
                            : passwordStrength === 'medium'
                              ? 'Média'
                              : passwordStrength === 'strong'
                                ? 'Forte'
                                : ''}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-xs mt-2">
                        <div
                          className={
                            watchedPassword.length >= 8 ? 'text-green-600' : 'text-gray-400'
                          }
                        >
                          {watchedPassword.length >= 8 ? '✓' : '○'} Mínimo 8 caracteres
                        </div>
                        <div
                          className={
                            /[a-z]/.test(watchedPassword) ? 'text-green-600' : 'text-gray-400'
                          }
                        >
                          {/[a-z]/.test(watchedPassword) ? '✓' : '○'} Letra minúscula
                        </div>
                        <div
                          className={
                            /[A-Z]/.test(watchedPassword) ? 'text-green-600' : 'text-gray-400'
                          }
                        >
                          {/[A-Z]/.test(watchedPassword) ? '✓' : '○'} Letra maiúscula
                        </div>
                        <div
                          className={
                            /[0-9]/.test(watchedPassword) ? 'text-green-600' : 'text-gray-400'
                          }
                        >
                          {/[0-9]/.test(watchedPassword) ? '✓' : '○'} Número
                        </div>
                        <div
                          className={
                            /[^A-Za-z0-9]/.test(watchedPassword)
                              ? 'text-green-600'
                              : 'text-gray-400'
                          }
                        >
                          {/[^A-Za-z0-9]/.test(watchedPassword) ? '✓' : '○'} Caractere especial
                          (!@#$%)
                        </div>
                      </div>
                    </div>
                  )}

                  {errors.password && (
                    <p className="mt-1 text-sm text-red-600">{errors.password.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Confirmar Senha
                  </label>
                  <div className="relative">
                    <input
                      type="password"
                      {...register('confirm_password', {
                        validate: (value) => {
                          if (!passwordValue) return true; // only validate when password provided
                          return value === passwordValue || 'As senhas não coincidem';
                        },
                      })}
                      className="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 bg-white text-gray-900 pr-10"
                      placeholder="Repita a senha"
                    />
                    {confirmPasswordValue &&
                      passwordValue &&
                      confirmPasswordValue === passwordValue && (
                        <CheckCircle className="absolute right-3 top-1/2 transform -translate-y-1/2 text-green-500 w-5 h-5" />
                      )}
                    {confirmPasswordValue &&
                      passwordValue &&
                      confirmPasswordValue !== passwordValue && (
                        <XCircle className="absolute right-3 top-1/2 transform -translate-y-1/2 text-red-500 w-5 h-5" />
                      )}
                  </div>
                  {confirmPasswordValue &&
                    passwordValue &&
                    confirmPasswordValue === passwordValue && (
                      <p className="mt-1 text-sm text-green-600 font-medium">
                        ✓ As senhas coincidem
                      </p>
                    )}
                  {confirmPasswordValue &&
                    passwordValue &&
                    confirmPasswordValue !== passwordValue && (
                      <p className="mt-1 text-sm text-red-600 font-medium">
                        ✗ As senhas não coincidem
                      </p>
                    )}
                  {errors.confirm_password && (
                    <p className="mt-1 text-sm text-red-600">
                      {errors.confirm_password.message as string}
                    </p>
                  )}
                </div>

                {isSuperAdmin && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Papel</label>
                    <select
                      {...register('role', { required: 'Selecione um papel' })}
                      className="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 bg-white text-gray-900"
                    >
                      <option value="USER">Usuário</option>
                      <option value="USERADMIN">Admin da família</option>
                      <option value="USERADMINSUPER">Superadmin</option>
                    </select>
                  </div>
                )}

                {/* ...existing code... */}

                {isAdmin && (
                  <div className="flex items-center space-x-6">
                    {!isSuperAdmin && (
                      <span className="text-sm text-gray-700">Papel: Admin da família</span>
                    )}
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        {...register('is_active')}
                        className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                      />
                      <span className="ml-2 text-sm text-gray-700">Ativo</span>
                    </label>
                  </div>
                )}

                <div className="flex justify-end space-x-3 pt-4 border-t mt-6">
                  <button
                    type="button"
                    onClick={() => {
                      setShowModal(false);
                      reset();
                      setEditingUser(null);
                      setSalaryDisplay('');
                      setPhoneDisplay('');
                      setCpfDisplay('');
                    }}
                    className="px-5 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-100 border-2 border-gray-300 rounded-lg transition-all hover:shadow-md"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2.5 text-sm font-medium text-white bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 rounded-lg transition-all shadow-md hover:shadow-lg"
                  >
                    {editingUser ? 'Atualizar' : 'Criar'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Confirmação de Exclusão */}
      <DeleteConfirmModal
        isOpen={showDeleteModal}
        onConfirm={confirmDelete}
        onCancel={() => {
          setShowDeleteModal(false);
          setUserToDelete(null);
        }}
        title="Excluir Usuário"
        message="Tem certeza que deseja excluir este usuário?"
      />
    </div>
  );
}
