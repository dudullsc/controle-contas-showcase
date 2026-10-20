import api, { clearAuthSessionLocal, SESSION_FLAG } from '@/lib/api';
import { LoginRequest, RegisterRequest, TokenResponse, User } from '@/types';
import { handleError } from '@/lib/errorHandler';

export const authService = {
  markSessionActive() {
    if (typeof window === 'undefined') return;
    sessionStorage.setItem(SESSION_FLAG, '1');
  },

  /**
   * Realiza login do usuário
   * @param credentials - Credenciais de login (email e senha)
   * @returns Token de acesso e informações do usuário
   */
  async login(credentials: LoginRequest): Promise<TokenResponse> {
    try {
      const params = new URLSearchParams();
      params.append('username', credentials.username);
      params.append('password', credentials.password);

      const response = await api.post<TokenResponse>('/auth/login', params);
      authService.markSessionActive();

      return response.data;
    } catch (error: any) {
      const errorMessage =
        error?.response?.data?.detail ||
        error?.message ||
        'Erro ao fazer login. Verifique suas credenciais.';

      handleError(error, errorMessage);
      throw error;
    }
  },

  /**
   * Registra um novo usuário
   * @param data - Dados do novo usuário
   * @returns Usuário criado
   */
  async register(data: RegisterRequest): Promise<User> {
    try {
      const response = await api.post<User>('/auth/register', data);
      return response.data;
    } catch (error) {
      handleError(error, 'Erro ao registrar usuário');
      throw error;
    }
  },

  /**
   * Busca informações do usuário atual
   * @returns Usuário atual
   */
  async getCurrentUser(): Promise<User> {
    const cachedUser = sessionStorage.getItem('cached_user');
    if (cachedUser) {
      try {
        return JSON.parse(cachedUser);
      } catch (e) {
        sessionStorage.removeItem('cached_user');
      }
    }

    try {
      const response = await api.get<User>('/users/me');
      sessionStorage.setItem('cached_user', JSON.stringify(response.data));
      authService.markSessionActive();
      return response.data;
    } catch (error: any) {
      if (error?.response?.status !== 401) {
        handleError(error, 'Erro ao carregar informações do usuário');
      }
      throw error;
    }
  },

  /**
   * Invalida o cache do usuário para forçar reload
   */
  invalidateUserCache() {
    sessionStorage.removeItem('cached_user');
  },

  async logout() {
    try {
      await api.post('/auth/logout');
    } catch (_) {
      // Limpa sessão local mesmo se a API falhar
    }
    clearAuthSessionLocal();
  },

  isAuthenticated(): boolean {
    if (typeof window === 'undefined') return false;
    return sessionStorage.getItem(SESSION_FLAG) === '1';
  },

  /**
   * Solicita reset de senha
   * @param email - Email do usuário
   */
  async forgotPassword(email: string): Promise<void> {
    try {
      await api.post('/auth/forgot-password', null, {
        params: { email },
      });
    } catch (error) {
      handleError(error, 'Erro ao solicitar reset de senha');
      throw error;
    }
  },

  /**
   * Redefine a senha usando token
   * @param token - Token de reset
   * @param newPassword - Nova senha
   */
  async resetPassword(token: string, newPassword: string): Promise<void> {
    try {
      await api.post('/auth/reset-password', null, {
        params: {
          token,
          new_password: newPassword,
        },
      });
    } catch (error) {
      handleError(error, 'Erro ao redefinir senha');
      throw error;
    }
  },
};
