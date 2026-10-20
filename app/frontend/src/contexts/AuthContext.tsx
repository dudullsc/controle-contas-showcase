'use client';

import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
  useCallback,
  useMemo,
} from 'react';
import { User } from '@/types';
import { authService } from '@/services/auth.service';
import { useRouter } from 'next/navigation';
import { cache } from '@/lib/cache';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (
    email: string,
    password: string,
    options?: { skipRedirect?: boolean }
  ) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const loadUser = useCallback(async () => {
    try {
      const currentUser = await authService.getCurrentUser();
      setUser(currentUser);
    } catch (error: any) {
      if (error.response?.status === 401) {
        setUser(null);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUser();
  }, [loadUser]);

  const login = useCallback(
    async (email: string, password: string, options?: { skipRedirect?: boolean }) => {
      await authService.login({ username: email, password });
      const currentUser = await authService.getCurrentUser();
      setUser(currentUser);
      if (options?.skipRedirect) return;
      // Hard navigation: no WebView/Capacitor o App Router soft-nav às vezes
      // não aplica o cookie no middleware e o login fica “travado” na mesma tela.
      if (typeof window !== 'undefined') {
        window.location.assign('/dashboard');
        return;
      }
      router.push('/dashboard');
    },
    [router]
  );

  const logout = useCallback(async () => {
    await authService.logout();
    setUser(null);
    router.push('/login');
  }, [router]);

  const refreshUser = useCallback(async () => {
    try {
      // Limpar cache antes de buscar novos dados
      authService.invalidateUserCache();
      // Limpar cache de dados agregados para forçar reload
      cache.clear();
      const currentUser = await authService.getCurrentUser();
      setUser(currentUser);
      // Disparar evento customizado para notificar outras páginas
      window.dispatchEvent(new CustomEvent('userUpdated'));
    } catch (error) {
      console.error('Erro ao atualizar usuário:', error);
    }
  }, []);

  const isAuthenticated = useMemo(() => !!user, [user]);

  const value = useMemo(
    () => ({
      user,
      loading,
      login,
      logout,
      refreshUser,
      isAuthenticated,
    }),
    [user, loading, login, logout, refreshUser, isAuthenticated]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
