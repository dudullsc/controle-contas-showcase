'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  Bell,
  Trash2,
  RefreshCw,
  Mail,
  Eye,
  EyeOff,
  Server,
  Send,
  MessageCircle,
  Search,
  X,
  Loader2,
  ChevronRight,
  ChevronDown,
  HardDrive,
  Cloud,
  Unplug,
} from 'lucide-react';
import { notificationService } from '@/services/notification.service';
import { userService } from '@/services/user.service';
import { cache } from '@/lib/cache';
import { toast } from 'react-toastify';
import api from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter, useSearchParams } from 'next/navigation';
import { User } from '@/types';

type ExpandedSection = 'email' | 'notifications' | 'cache' | 'backup' | null;

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

const AVATAR_COLORS = [
  'bg-blue-100 text-blue-700',
  'bg-emerald-100 text-emerald-700',
  'bg-amber-100 text-amber-700',
  'bg-violet-100 text-violet-700',
  'bg-rose-100 text-rose-700',
  'bg-cyan-100 text-cyan-700',
];

function avatarColor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash + id.charCodeAt(i)) % AVATAR_COLORS.length;
  return AVATAR_COLORS[hash];
}

/**
 * Página de configurações do sistema
 * Permite gerenciar notificações e cache
 */
export default function SettingsPage() {
  const { user: currentUser } = useAuth();
  const isAdmin = currentUser?.role === 'USERADMIN' || currentUser?.role === 'USERADMINSUPER';
  const isSuperAdmin = currentUser?.role === 'USERADMINSUPER';
  const router = useRouter();
  const searchParams = useSearchParams();
  const [emailUser, setEmailUser] = useState('contato@example.com');
  const [emailPassword, setEmailPassword] = useState('');
  const [showEmailPassword, setShowEmailPassword] = useState(false);
  const [savingEmail, setSavingEmail] = useState(false);
  const [emailConfigured, setEmailConfigured] = useState(false);
  const [emailConfig, setEmailConfig] = useState<any>(null);
  const [expanded, setExpanded] = useState<ExpandedSection>(null);

  // Backup Google Drive (superadmin)
  const [backupStatus, setBackupStatus] = useState<{
    oauth_configured: boolean;
    connected: boolean;
    google_email?: string | null;
    folder_name?: string;
    last_backup_at?: string | null;
    last_backup_status?: string | null;
    last_backup_error?: string | null;
    last_slots_updated?: string[];
    slots?: Record<
      string,
      { filename: string; file_id?: string | null; updated_at?: string | null }
    >;
    backup_cron_time?: string;
    enable_backups?: boolean;
  } | null>(null);
  const [loadingBackup, setLoadingBackup] = useState(false);
  const [connectingBackup, setConnectingBackup] = useState(false);
  const [runningBackup, setRunningBackup] = useState(false);
  const [disconnectingBackup, setDisconnectingBackup] = useState(false);

  // Configurações SMTP
  const [emailFromName, setEmailFromName] = useState(
    'resetpassword@contas.example.com'
  );
  const [smtpHost, setSmtpHost] = useState('smtp.gmail.com');
  const [smtpPort, setSmtpPort] = useState(587);
  const [smtpUseTls, setSmtpUseTls] = useState(true);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // WhatsApp por usuário (superadmin)
  const [showWhatsAppModal, setShowWhatsAppModal] = useState(false);
  const [whatsappUsers, setWhatsappUsers] = useState<User[]>([]);
  const [loadingWhatsAppUsers, setLoadingWhatsAppUsers] = useState(false);
  const [whatsappSearch, setWhatsappSearch] = useState('');
  const [togglingUserId, setTogglingUserId] = useState<string | null>(null);
  const [whatsappServiceEnabled, setWhatsappServiceEnabled] = useState(true);
  const [loadingWhatsAppService, setLoadingWhatsAppService] = useState(false);
  const [togglingWhatsAppService, setTogglingWhatsAppService] = useState(false);
  const [whatsappServiceKnown, setWhatsappServiceKnown] = useState(false);
  const [runningNotifications, setRunningNotifications] = useState(false);
  const [lastNotificationRun, setLastNotificationRun] = useState<{
    whatsapp_sent?: number;
    whatsapp_failed?: number;
    whatsapp_skipped?: number;
    fcm_sent?: number;
    fcm_failed?: number;
    fcm_skipped?: number;
    users_processed?: number;
  } | null>(null);

  useEffect(() => {
    if (currentUser && !isAdmin) {
      router.push('/dashboard');
      return;
    }
    if (isAdmin) {
      checkEmailConfig();
    }
    if (isSuperAdmin) {
      loadWhatsAppService();
      loadBackupStatus();
    }
  }, [currentUser, isAdmin, isSuperAdmin, router]);

  useEffect(() => {
    const backup = searchParams.get('backup');
    const oauthCode = searchParams.get('code');
    const oauthState = searchParams.get('state');
    const oauthError = searchParams.get('error');

    // Fluxo OAuth: Google redireciona para o frontend com ?code=&state=
    if (oauthError) {
      toast.error(oauthError);
      setExpanded('backup');
      router.replace('/dashboard/settings');
      return;
    }

    if (oauthCode && oauthState) {
      setExpanded('backup');
      setConnectingBackup(true);
      (async () => {
        try {
          await api.post(
            '/backup/google/exchange',
            { code: oauthCode, state: oauthState },
            { timeout: 30000 }
          );
          toast.success('Google Drive conectado com sucesso!');
          await loadBackupStatus();
        } catch (error: any) {
          toast.error(
            error.response?.data?.detail || 'Falha ao concluir login Google'
          );
        } finally {
          setConnectingBackup(false);
          router.replace('/dashboard/settings');
        }
      })();
      return;
    }

    if (!backup) return;
    if (backup === 'connected') {
      toast.success('Google Drive conectado com sucesso!');
      setExpanded('backup');
      loadBackupStatus();
    } else if (backup === 'error') {
      const message = searchParams.get('message');
      toast.error(
        message
          ? decodeURIComponent(message)
          : 'Falha ao conectar Google Drive'
      );
      setExpanded('backup');
    }
    router.replace('/dashboard/settings');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const loadBackupStatus = async () => {
    try {
      setLoadingBackup(true);
      const response = await api.get('/backup/status', { timeout: 10000 });
      setBackupStatus(response.data);
    } catch {
      setBackupStatus(null);
    } finally {
      setLoadingBackup(false);
    }
  };

  const handleConnectGoogleDrive = async () => {
    try {
      setConnectingBackup(true);
      const response = await api.get<{ auth_url: string }>('/backup/google/auth-url');
      if (!response.data?.auth_url) {
        toast.error('URL de autenticação não retornada');
        return;
      }
      window.location.href = response.data.auth_url;
    } catch (error: any) {
      toast.error(
        error.response?.data?.detail ||
          'Não foi possível iniciar o login Google. Verifique GOOGLE_CLIENT_ID no .env'
      );
      setConnectingBackup(false);
    }
  };

  const handleRunBackup = async (forceAll = false) => {
    try {
      setRunningBackup(true);
      const response = await api.post('/backup/run', null, {
        params: { force_all_slots: forceAll },
        timeout: 300000,
      });
      const slots = (response.data?.slots_updated || []).join(', ');
      toast.success(
        `Backup concluído (${response.data?.size_mb ?? '?'} MB). Slots: ${slots || '—'}`
      );
      await loadBackupStatus();
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Falha ao executar backup');
      await loadBackupStatus();
    } finally {
      setRunningBackup(false);
    }
  };

  const handleDisconnectGoogleDrive = async () => {
    if (!confirm('Desconectar Google Drive? Os backups automáticos param até reconectar.')) {
      return;
    }
    try {
      setDisconnectingBackup(true);
      await api.delete('/backup/google');
      toast.success('Google Drive desconectado');
      await loadBackupStatus();
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Erro ao desconectar');
    } finally {
      setDisconnectingBackup(false);
    }
  };

  const loadWhatsAppService = async () => {
    try {
      setLoadingWhatsAppService(true);
      const response = await api.get<{ service_enabled: boolean }>('/settings/whatsapp', {
        timeout: 10000,
      });
      setWhatsappServiceEnabled(response.data.service_enabled !== false);
      setWhatsappServiceKnown(true);
    } catch {
      setWhatsappServiceKnown(false);
      toast.error('Não foi possível carregar o status do serviço WhatsApp. Verifique se a API está online.');
    } finally {
      setLoadingWhatsAppService(false);
    }
  };

  const handleToggleWhatsAppService = async () => {
    const next = !whatsappServiceEnabled;
    setTogglingWhatsAppService(true);
    try {
      const response = await api.put<{ service_enabled: boolean; message: string }>(
        '/settings/whatsapp',
        { service_enabled: next },
        { timeout: 10000 }
      );
      setWhatsappServiceEnabled(response.data.service_enabled);
      setWhatsappServiceKnown(true);
      toast.success(
        next
          ? 'Serviço WhatsApp ativado — envios automáticos ligados'
          : 'Serviço WhatsApp desativado — nenhum envio automático'
      );
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Erro ao atualizar serviço WhatsApp');
    } finally {
      setTogglingWhatsAppService(false);
    }
  };

  const handleRunNotifications = async () => {
    if (
      !confirm(
        'Rodar agora a verificação de contas (WhatsApp + push)?\n\nSerão enviadas só as notificações pendentes de hoje (vence hoje, atrasadas, lembretes).'
      )
    ) {
      return;
    }
    try {
      setRunningNotifications(true);
      const response = await api.post('/notifications/run', null, { timeout: 180000 });
      const data = response.data || {};
      setLastNotificationRun(data);
      const wa = data.whatsapp_sent ?? 0;
      const fcm = data.fcm_sent ?? 0;
      toast.success(
        `Notificações: ${wa} WhatsApp e ${fcm} push enviados` +
          (data.users_processed != null ? ` · ${data.users_processed} usuário(s)` : '')
      );
      if (data.waha_warning) {
        toast.warning(`WAHA: ${data.waha_warning}`);
      }
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Falha ao executar notificações');
    } finally {
      setRunningNotifications(false);
    }
  };

  const checkEmailConfig = async () => {
    try {
      const response = await api.get('/settings/email');
      setEmailConfigured(response.data.email_configured || false);
      setEmailConfig(response.data);
      if (response.data.email_user) {
        setEmailUser(response.data.email_user);
      }
      if (response.data.email_from_name) {
        setEmailFromName(response.data.email_from_name);
      }
      if (response.data.smtp_host) {
        setSmtpHost(response.data.smtp_host);
      }
      if (response.data.smtp_port) {
        setSmtpPort(response.data.smtp_port);
      }
      if (response.data.smtp_use_tls !== undefined) {
        setSmtpUseTls(response.data.smtp_use_tls);
      }
    } catch {
      setEmailConfigured(false);
    }
  };

  const handleSaveEmailConfig = async () => {
    if (!emailUser) {
      toast.error('Digite o email de autenticação');
      return;
    }

    if (!emailPassword) {
      toast.error('Digite a senha de app do email');
      return;
    }

    try {
      setSavingEmail(true);
      await api.post('/settings/email', {
        email_user: emailUser,
        email_pass: emailPassword,
        email_from_name: emailFromName,
        smtp_host: smtpHost,
        smtp_port: smtpPort,
        smtp_use_tls: smtpUseTls,
      });
      toast.success('Configuração de email salva com sucesso!');
      setEmailPassword('');
      setEmailConfigured(true);
      await checkEmailConfig();
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Erro ao salvar configuração de email');
    } finally {
      setSavingEmail(false);
    }
  };

  const [testEmail, setTestEmail] = useState('');
  const [testingEmail, setTestingEmail] = useState(false);

  const handleTestEmail = async () => {
    if (!testEmail) {
      toast.error('Digite um email para enviar o teste');
      return;
    }

    if (!emailConfigured) {
      toast.error('Configure o email primeiro antes de testar');
      return;
    }

    try {
      setTestingEmail(true);
      await api.post('/settings/email/test', {
        to_email: testEmail,
      });
      toast.success(`Email de teste enviado para ${testEmail}! Verifique sua caixa de entrada.`);
      setTestEmail('');
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Erro ao enviar email de teste');
    } finally {
      setTestingEmail(false);
    }
  };

  const handleRequestPermission = () => {
    notificationService.requestPermission();
  };

  const toggleSection = (section: ExpandedSection) => {
    setExpanded((prev) => (prev === section ? null : section));
  };

  const openWhatsAppModal = async () => {
    setShowWhatsAppModal(true);
    setWhatsappSearch('');
    setWhatsappUsers([]);
    setLoadingWhatsAppUsers(true);
    try {
      // Busca direto na API com timeout curto — evita ficar preso em "Carregando..."
      const response = await api.get<User[]>('/users/', {
        params: { skip: 0, limit: 500 },
        timeout: 15000,
      });
      setWhatsappUsers(Array.isArray(response.data) ? response.data : []);
    } catch (error: any) {
      const offline = !error.response;
      toast.error(
        offline
          ? 'API offline. Inicie o backend (python main.py) e tente de novo.'
          : error.response?.data?.detail || 'Erro ao carregar usuários'
      );
      setShowWhatsAppModal(false);
    } finally {
      setLoadingWhatsAppUsers(false);
    }
  };

  const closeWhatsAppModal = () => {
    setShowWhatsAppModal(false);
    setWhatsappSearch('');
    setTogglingUserId(null);
  };

  const filteredWhatsAppUsers = useMemo(() => {
    const q = whatsappSearch.trim().toLowerCase();
    if (!q) return whatsappUsers;
    return whatsappUsers.filter(
      (u) =>
        u.full_name?.toLowerCase().includes(q) ||
        u.email?.toLowerCase().includes(q) ||
        u.phone?.toLowerCase().includes(q)
    );
  }, [whatsappUsers, whatsappSearch]);

  const handleToggleWhatsApp = async (user: User) => {
    if (!user.phone) return;
    const next = !(user.whatsapp_notifications_enabled !== false);
    setTogglingUserId(user._id);
    try {
      const updated = await userService.toggleWhatsApp(user._id, next);
      setWhatsappUsers((prev) =>
        prev.map((u) =>
          u._id === user._id
            ? {
                ...u,
                whatsapp_notifications_enabled:
                  updated.whatsapp_notifications_enabled ?? next,
              }
            : u
        )
      );
      toast.success(
        next
          ? `WhatsApp ativado para ${user.full_name}`
          : `WhatsApp desativado para ${user.full_name}`
      );
    } catch {
      toast.error('Erro ao atualizar WhatsApp do usuário');
    } finally {
      setTogglingUserId(null);
    }
  };

  if (!isAdmin) {
    return null;
  }

  return (
    <div className="p-6 md:p-8 max-w-4xl">
      {/* Header estilo mockup */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Configurações</h1>
        <p className="text-sm text-gray-500 mt-1">Gerencie as configurações do sistema</p>
      </div>

      <div className="space-y-3">
        {/* Card Email — linha expansível */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <button
            type="button"
            onClick={() => toggleSection('email')}
            className="w-full flex items-center gap-4 px-5 py-4 text-left hover:bg-gray-50 transition-colors"
          >
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-blue-50 text-primary-600">
              <Mail className="w-5 h-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-gray-900">Configurações de Email</p>
              <p className="text-sm text-gray-500 truncate">
                {emailConfigured
                  ? `Configurado${emailConfig?.email_user ? ` · ${emailConfig.email_user}` : ''}`
                  : 'Configure o email para notificações e recuperação de senha'}
              </p>
            </div>
            {expanded === 'email' ? (
              <ChevronDown className="w-5 h-5 text-gray-400 shrink-0" />
            ) : (
              <ChevronRight className="w-5 h-5 text-gray-400 shrink-0" />
            )}
          </button>

          {expanded === 'email' && (
            <div className="px-5 pb-5 pt-0 border-t border-gray-100">
              <div className="pt-4">
                {emailConfigured ? (
                  <div className="space-y-4">
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                      <p className="text-green-800 text-sm">✓ Email configurado com sucesso!</p>
                      <button
                        onClick={() => setEmailConfigured(false)}
                        className="mt-2 text-sm text-green-700 hover:text-green-800 underline"
                      >
                        Alterar senha
                      </button>
                    </div>

                    <div>
                      <h3 className="text-sm font-semibold text-gray-800 mb-3 flex items-center gap-2">
                        <Send className="w-4 h-4" />
                        Teste de Email
                      </h3>
                      <div className="flex flex-col sm:flex-row gap-2">
                        <input
                          type="email"
                          value={testEmail}
                          onChange={(e) => setTestEmail(e.target.value)}
                          className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm"
                          placeholder="email@exemplo.com"
                        />
                        <button
                          onClick={handleTestEmail}
                          disabled={testingEmail || !testEmail}
                          className="bg-green-600 hover:bg-green-700 text-white font-medium py-2 px-5 rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2 text-sm"
                        >
                          <Send className="h-4 w-4" />
                          {testingEmail ? 'Enviando...' : 'Enviar Teste'}
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                      <p className="text-blue-800 text-sm">
                        <strong>Gmail Pré-configurado:</strong> O sistema está configurado para usar
                        Gmail por padrão. Você pode alterar as configurações SMTP abaixo se
                        necessário.
                      </p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Email de Autenticação *
                      </label>
                      <input
                        type="email"
                        value={emailUser}
                        onChange={(e) => setEmailUser(e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm"
                        placeholder="contato@example.com"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Senha de App do Gmail *
                      </label>
                      <div className="relative">
                        <input
                          type={showEmailPassword ? 'text' : 'password'}
                          value={emailPassword}
                          onChange={(e) => setEmailPassword(e.target.value)}
                          className="w-full px-4 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm"
                          placeholder="Digite a senha de app do email"
                        />
                        <button
                          type="button"
                          onClick={() => setShowEmailPassword(!showEmailPassword)}
                          className="absolute inset-y-0 right-0 pr-3 flex items-center"
                        >
                          {showEmailPassword ? (
                            <EyeOff className="h-5 w-5 text-gray-400" />
                          ) : (
                            <Eye className="h-5 w-5 text-gray-400" />
                          )}
                        </button>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        Para Gmail: use a senha de app (não a senha normal da conta).
                        <a
                          href="https://support.google.com/accounts/answer/185833"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary-600 hover:underline ml-1"
                        >
                          Como criar uma senha de app
                        </a>
                      </p>
                    </div>

                    <div className="border-t pt-4">
                      <button
                        type="button"
                        onClick={() => setShowAdvanced(!showAdvanced)}
                        className="flex items-center gap-2 text-sm font-medium text-gray-700 hover:text-gray-900 mb-4"
                      >
                        <Server className="h-4 w-4" />
                        {showAdvanced ? 'Ocultar' : 'Mostrar'} Configurações SMTP Avançadas
                      </button>

                      {showAdvanced && (
                        <div className="space-y-4 bg-gray-50 p-4 rounded-lg">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Nome do Remetente (From Name)
                            </label>
                            <input
                              type="text"
                              value={emailFromName}
                              onChange={(e) => setEmailFromName(e.target.value)}
                              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm"
                              placeholder="resetpassword@contas.example.com"
                            />
                          </div>

                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">
                                SMTP Host
                              </label>
                              <input
                                type="text"
                                value={smtpHost}
                                onChange={(e) => setSmtpHost(e.target.value)}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm"
                                placeholder="smtp.gmail.com"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">
                                SMTP Port
                              </label>
                              <input
                                type="number"
                                value={smtpPort}
                                onChange={(e) => setSmtpPort(parseInt(e.target.value) || 587)}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm"
                                placeholder="587"
                              />
                            </div>
                          </div>

                          <div className="space-y-2">
                            <label className="block text-sm font-medium text-gray-700">
                              Tipo de Conexão Segura
                            </label>
                            <div className="space-y-2">
                              <label className="flex items-center gap-2 p-2 rounded hover:bg-gray-100 cursor-pointer">
                                <input
                                  type="radio"
                                  name="tls_type"
                                  checked={smtpPort === 587 && smtpUseTls}
                                  onChange={() => {
                                    setSmtpPort(587);
                                    setSmtpUseTls(true);
                                  }}
                                  className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                                />
                                <span className="text-sm text-gray-700">STARTTLS (Porta 587)</span>
                              </label>
                              <label className="flex items-center gap-2 p-2 rounded hover:bg-gray-100 cursor-pointer">
                                <input
                                  type="radio"
                                  name="tls_type"
                                  checked={smtpPort === 465}
                                  onChange={() => {
                                    setSmtpPort(465);
                                    setSmtpUseTls(true);
                                  }}
                                  className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                                />
                                <span className="text-sm text-gray-700">SSL Direto (Porta 465)</span>
                              </label>
                              <label className="flex items-center gap-2 p-2 rounded hover:bg-gray-100 cursor-pointer">
                                <input
                                  type="radio"
                                  name="tls_type"
                                  checked={!smtpUseTls}
                                  onChange={() => setSmtpUseTls(false)}
                                  className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                                />
                                <span className="text-sm text-gray-700">Sem TLS/SSL</span>
                              </label>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    <button
                      onClick={handleSaveEmailConfig}
                      disabled={savingEmail || !emailPassword || !emailUser}
                      className="w-full bg-primary-600 hover:bg-primary-700 text-white font-medium py-2.5 px-4 rounded-lg transition-colors disabled:opacity-50 text-sm"
                    >
                      {savingEmail ? 'Salvando...' : 'Salvar Configuração de Email'}
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Card Notificações (WhatsApp + push + mobile) */}
        <div
          className={`bg-white rounded-xl shadow-sm overflow-hidden border-2 ${
            isSuperAdmin && whatsappServiceEnabled
              ? 'border-primary-500'
              : 'border-gray-200'
          }`}
        >
          <button
            type="button"
            onClick={() => toggleSection('notifications')}
            className="w-full flex items-center gap-4 px-5 py-4 text-left hover:bg-gray-50 transition-colors"
          >
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-amber-50 text-amber-600">
              <Bell className="w-5 h-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-gray-900">Notificações</p>
              <p className="text-sm text-gray-500 truncate">
                {isSuperAdmin
                  ? whatsappServiceEnabled
                    ? 'WhatsApp ativo · push no app · rotina diária às 09:00'
                    : 'WhatsApp desligado · push no app · configure envios'
                  : 'Permissões e alertas do aplicativo mobile'}
              </p>
            </div>
            {expanded === 'notifications' ? (
              <ChevronDown className="w-5 h-5 text-gray-400 shrink-0" />
            ) : (
              <ChevronRight className="w-5 h-5 text-gray-400 shrink-0" />
            )}
          </button>

          {expanded === 'notifications' && (
            <div className="px-5 pb-5 border-t border-gray-100 pt-4 space-y-4">
              {isSuperAdmin && (
                <>
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-900 flex items-center gap-2">
                        <MessageCircle className="w-4 h-4 text-primary-600" />
                        WhatsApp – Envio aos clientes
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        Ligue/desligue o serviço e escolha quem recebe as mensagens.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={openWhatsAppModal}
                      className="shrink-0 bg-primary-600 hover:bg-primary-700 text-white font-medium py-2.5 px-5 rounded-lg transition-colors text-sm"
                    >
                      Gerenciar envios
                    </button>
                  </div>

                  <div className="flex items-center justify-between gap-4 rounded-lg bg-gray-50 border border-gray-200 px-4 py-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900">Serviço WhatsApp</p>
                      <p className="text-xs text-gray-500">
                        {loadingWhatsAppService
                          ? 'Carregando status...'
                          : !whatsappServiceKnown
                            ? 'Status indisponível — API pode estar offline'
                            : whatsappServiceEnabled
                              ? 'Ativo — envios automáticos diários ligados'
                              : 'Desativado — nenhum WhatsApp será enviado'}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span
                        className={`text-xs font-medium ${
                          whatsappServiceEnabled ? 'text-primary-600' : 'text-gray-400'
                        }`}
                      >
                        {whatsappServiceEnabled ? 'Ligado' : 'Desligado'}
                      </span>
                      <button
                        type="button"
                        disabled={togglingWhatsAppService || loadingWhatsAppService}
                        onClick={handleToggleWhatsAppService}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-1 disabled:opacity-50 ${
                          whatsappServiceEnabled ? 'bg-primary-600' : 'bg-gray-300'
                        }`}
                        title={
                          whatsappServiceEnabled
                            ? 'Desativar serviço WhatsApp'
                            : 'Ativar serviço WhatsApp'
                        }
                        aria-pressed={whatsappServiceEnabled}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                            whatsappServiceEnabled ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </div>
                  </div>

                  <div className="rounded-lg border border-gray-200 bg-white px-4 py-3 space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-gray-900 flex items-center gap-2">
                          <Send className="w-4 h-4 text-primary-600" />
                          Verificar contas agora
                        </p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          Dispara a mesma rotina diária (09:00): vence hoje, atrasadas e lembretes
                          via WhatsApp e push no app.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={handleRunNotifications}
                        disabled={runningNotifications}
                        className="shrink-0 bg-primary-600 hover:bg-primary-700 text-white font-medium py-2.5 px-4 rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2 text-sm"
                      >
                        {runningNotifications ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Send className="w-4 h-4" />
                        )}
                        {runningNotifications ? 'Enviando...' : 'Executar agora'}
                      </button>
                    </div>
                    {lastNotificationRun && (
                      <p className="text-xs text-gray-500">
                        Última execução: WhatsApp {lastNotificationRun.whatsapp_sent ?? 0}{' '}
                        enviados
                        {(lastNotificationRun.whatsapp_failed ?? 0) > 0
                          ? ` / ${lastNotificationRun.whatsapp_failed} falhas`
                          : ''}
                        {(lastNotificationRun.whatsapp_skipped ?? 0) > 0
                          ? ` / ${lastNotificationRun.whatsapp_skipped} já enviados`
                          : ''}
                        {' · '}
                        Push {lastNotificationRun.fcm_sent ?? 0} enviados
                        {(lastNotificationRun.fcm_failed ?? 0) > 0
                          ? ` / ${lastNotificationRun.fcm_failed} falhas`
                          : ''}
                        {(lastNotificationRun.fcm_skipped ?? 0) > 0
                          ? ` / ${lastNotificationRun.fcm_skipped} já enviados`
                          : ''}
                        {lastNotificationRun.users_processed != null
                          ? ` · ${lastNotificationRun.users_processed} usuário(s)`
                          : ''}
                      </p>
                    )}
                  </div>
                </>
              )}

              {notificationService.isRunningInApp() ? (
                <div className="space-y-4">
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <p className="text-green-800 text-sm mb-2">
                      ✅ <strong>App Mobile Detectado</strong>
                    </p>
                    <p className="text-green-700 text-sm">
                      As notificações push estão habilitadas no dispositivo quando a permissão for
                      concedida.
                    </p>
                  </div>

                  <div>
                    <h3 className="font-medium text-gray-800 mb-2 text-sm">
                      Tipos de alertas (rotina diária):
                    </h3>
                    <ul className="space-y-2 text-sm text-gray-600">
                      <li>
                        <strong>5 dias / 1 dia antes:</strong> lembrete às 09:00
                      </li>
                      <li>
                        <strong>Vence hoje:</strong> no dia do vencimento às 09:00
                      </li>
                      <li>
                        <strong>Em atraso:</strong> diariamente às 09:00 até pagar (até 30 dias)
                      </li>
                    </ul>
                  </div>

                  <button
                    onClick={handleRequestPermission}
                    className="w-full bg-primary-600 hover:bg-primary-700 text-white font-medium py-2.5 px-4 rounded-lg transition-colors flex items-center justify-center gap-2 text-sm"
                  >
                    <Bell className="w-4 h-4" />
                    Solicitar Permissão de Notificações
                  </button>
                </div>
              ) : (
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <p className="text-gray-600 text-sm">
                    {isSuperAdmin
                      ? 'No navegador você gerencia WhatsApp e a rotina diária acima. Push na cortina do celular só no app mobile.'
                      : 'Você está usando o sistema no navegador web. As notificações push estão disponíveis apenas no aplicativo mobile.'}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Card Backup Google Drive — superadmin */}
        {isSuperAdmin && (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <button
              type="button"
              onClick={() => toggleSection('backup')}
              className="w-full flex items-center gap-4 px-5 py-4 text-left hover:bg-gray-50 transition-colors"
            >
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                <HardDrive className="w-5 h-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-gray-900">Backup Google Drive</p>
                <p className="text-sm text-gray-500 truncate">
                  {loadingBackup
                    ? 'Carregando status...'
                    : backupStatus?.connected
                      ? `Conectado${backupStatus.google_email ? ` · ${backupStatus.google_email}` : ''}`
                      : backupStatus?.oauth_configured
                        ? 'Conecte sua conta Google para backups automáticos'
                        : 'Configure GOOGLE_CLIENT_ID / SECRET no .env'}
                </p>
              </div>
              {expanded === 'backup' ? (
                <ChevronDown className="w-5 h-5 text-gray-400 shrink-0" />
              ) : (
                <ChevronRight className="w-5 h-5 text-gray-400 shrink-0" />
              )}
            </button>

            {expanded === 'backup' && (
              <div className="px-5 pb-5 border-t border-gray-100 pt-4 space-y-4">
                <p className="text-sm text-gray-600">
                  Mantém exatamente 3 arquivos no Drive: diário, semanal e mensal
                  {backupStatus?.backup_cron_time
                    ? ` · cron às ${backupStatus.backup_cron_time}`
                    : ''}
                  .
                </p>

                {backupStatus?.connected ? (
                  <>
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-sm text-green-800">
                      ✓ Conectado
                      {backupStatus.google_email ? ` como ${backupStatus.google_email}` : ''}
                      {backupStatus.folder_name ? ` · pasta ${backupStatus.folder_name}` : ''}
                    </div>

                    <div className="grid gap-2 sm:grid-cols-3">
                      {(['daily', 'weekly', 'monthly'] as const).map((slot) => {
                        const info = backupStatus.slots?.[slot];
                        const labels = {
                          daily: 'Diário',
                          weekly: 'Semanal',
                          monthly: 'Mensal',
                        };
                        return (
                          <div
                            key={slot}
                            className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2"
                          >
                            <p className="text-xs font-semibold text-gray-700">{labels[slot]}</p>
                            <p className="text-[11px] text-gray-500 truncate">
                              {info?.filename || '—'}
                            </p>
                            <p className="text-[11px] text-gray-400 mt-1">
                              {info?.updated_at
                                ? new Date(info.updated_at).toLocaleString('pt-BR')
                                : 'Ainda não gerado'}
                            </p>
                          </div>
                        );
                      })}
                    </div>

                    {backupStatus.last_backup_at && (
                      <p className="text-xs text-gray-500">
                        Último backup:{' '}
                        {new Date(backupStatus.last_backup_at).toLocaleString('pt-BR')}
                        {backupStatus.last_backup_status
                          ? ` · ${backupStatus.last_backup_status}`
                          : ''}
                        {backupStatus.last_slots_updated?.length
                          ? ` · slots: ${backupStatus.last_slots_updated.join(', ')}`
                          : ''}
                      </p>
                    )}
                    {backupStatus.last_backup_status === 'error' &&
                      backupStatus.last_backup_error && (
                        <p className="text-xs text-red-600">{backupStatus.last_backup_error}</p>
                      )}

                    <div className="flex flex-col sm:flex-row gap-2">
                      <button
                        type="button"
                        onClick={() => handleRunBackup(false)}
                        disabled={runningBackup}
                        className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-medium py-2.5 px-4 rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2 text-sm"
                      >
                        {runningBackup ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Cloud className="w-4 h-4" />
                        )}
                        {runningBackup ? 'Executando...' : 'Executar agora'}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRunBackup(true)}
                        disabled={runningBackup}
                        className="flex-1 bg-white border border-emerald-300 text-emerald-700 hover:bg-emerald-50 font-medium py-2.5 px-4 rounded-lg transition-colors disabled:opacity-50 text-sm"
                        title="Atualiza daily, weekly e monthly nesta execução"
                      >
                        Forçar 3 slots
                      </button>
                      <button
                        type="button"
                        onClick={handleDisconnectGoogleDrive}
                        disabled={disconnectingBackup || runningBackup}
                        className="sm:w-auto bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 font-medium py-2.5 px-4 rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2 text-sm"
                      >
                        <Unplug className="w-4 h-4" />
                        {disconnectingBackup ? '...' : 'Desconectar'}
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="space-y-3">
                    {!backupStatus?.oauth_configured && (
                      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-800">
                        Credenciais Google OAuth ainda não configuradas no servidor.
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={handleConnectGoogleDrive}
                      disabled={connectingBackup || !backupStatus?.oauth_configured}
                      className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-medium py-2.5 px-4 rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2 text-sm"
                    >
                      {connectingBackup ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Cloud className="w-4 h-4" />
                      )}
                      {connectingBackup ? 'Redirecionando...' : 'Conectar com Google'}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Card Cache */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <button
            type="button"
            onClick={() => toggleSection('cache')}
            className="w-full flex items-center gap-4 px-5 py-4 text-left hover:bg-gray-50 transition-colors"
          >
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-600">
              <RefreshCw className="w-5 h-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-gray-900">Gerenciamento de Cache</p>
              <p className="text-sm text-gray-500 truncate">
                Limpe o cache se os dados parecerem desatualizados
              </p>
            </div>
            {expanded === 'cache' ? (
              <ChevronDown className="w-5 h-5 text-gray-400 shrink-0" />
            ) : (
              <ChevronRight className="w-5 h-5 text-gray-400 shrink-0" />
            )}
          </button>

          {expanded === 'cache' && (
            <div className="px-5 pb-5 border-t border-gray-100 pt-4">
              <p className="text-gray-600 text-sm mb-4">
                O sistema armazena dados em cache para melhorar a performance. Você pode limpar o
                cache se os dados parecerem desatualizados.
              </p>
              <button
                onClick={() => {
                  cache.clear();
                  toast.success('Cache limpo com sucesso!');
                }}
                className="w-full bg-gray-700 hover:bg-gray-800 text-white font-medium py-2.5 px-4 rounded-lg transition-colors flex items-center justify-center gap-2 text-sm"
              >
                <Trash2 className="w-4 h-4" />
                Limpar Cache
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Modal WhatsApp — layout tabela estilo mockup */}
      {showWhatsAppModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={closeWhatsAppModal}
        >
          <div
            className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between px-6 py-5 border-b border-gray-100">
              <div className="pr-4">
                <h3 className="text-lg font-semibold text-gray-900">
                  Ativar / Desativar WhatsApp por usuário
                </h3>
                <p className="text-sm text-gray-500 mt-1">
                  Ative ou desative o envio de mensagens via WhatsApp para cada usuário do sistema.
                </p>
              </div>
              <button
                type="button"
                onClick={closeWhatsAppModal}
                className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="px-6 py-4">
              {!whatsappServiceEnabled && (
                <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                  O serviço WhatsApp está desligado. Os toggles por usuário ficam salvos, mas nenhum
                  envio automático ocorre até religar o serviço.
                </div>
              )}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={whatsappSearch}
                  onChange={(e) => setWhatsappSearch(e.target.value)}
                  placeholder="Buscar usuário..."
                  className="w-full pl-9 pr-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-6 pb-2">
              {loadingWhatsAppUsers ? (
                <div className="flex items-center justify-center py-16 text-gray-500 gap-2">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Carregando usuários...
                </div>
              ) : filteredWhatsAppUsers.length === 0 ? (
                <p className="text-center text-gray-500 py-16 text-sm">Nenhum usuário encontrado</p>
              ) : (
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                          Usuário
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider hidden sm:table-cell">
                          Telefone
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">
                          WhatsApp
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-100">
                      {filteredWhatsAppUsers.map((user) => {
                        const enabled = user.whatsapp_notifications_enabled !== false;
                        const hasPhone = Boolean(user.phone);
                        const isToggling = togglingUserId === user._id;

                        return (
                          <tr key={user._id} className="hover:bg-gray-50">
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-3 min-w-0">
                                <div
                                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${avatarColor(
                                    user._id
                                  )}`}
                                >
                                  {getInitials(user.full_name || '?')}
                                </div>
                                <div className="min-w-0">
                                  <p className="text-sm font-medium text-gray-900 truncate">
                                    {user.full_name}
                                  </p>
                                  <p className="text-xs text-gray-500 truncate">{user.email}</p>
                                  <p className="text-xs text-gray-400 sm:hidden mt-0.5">
                                    {hasPhone ? user.phone : 'Sem telefone'}
                                  </p>
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-600 hidden sm:table-cell whitespace-nowrap">
                              {hasPhone ? user.phone : '—'}
                            </td>
                            <td className="px-4 py-3 text-right">
                              {!hasPhone ? (
                                <span className="text-xs text-gray-400">Sem telefone</span>
                              ) : (
                                <button
                                  type="button"
                                  disabled={isToggling}
                                  onClick={() => handleToggleWhatsApp(user)}
                                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-1 disabled:opacity-50 ${
                                    enabled ? 'bg-primary-600' : 'bg-gray-300'
                                  }`}
                                  title={enabled ? 'Desativar WhatsApp' : 'Ativar WhatsApp'}
                                  aria-pressed={enabled}
                                >
                                  <span
                                    className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                                      enabled ? 'translate-x-6' : 'translate-x-1'
                                    }`}
                                  />
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
              <button
                type="button"
                onClick={closeWhatsAppModal}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 rounded-lg transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={closeWhatsAppModal}
                className="px-4 py-2 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-lg transition-colors"
              >
                Salvar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
