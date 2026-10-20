'use client';

import { ReactNode, useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter, usePathname } from 'next/navigation';
import FloatingCalculator from '@/components/FloatingCalculator';
import ShareReceiptHandler from '@/components/expenses/ShareReceiptHandler';
import MobileBottomNav from '@/components/mobile/MobileBottomNav';
import {
  LayoutDashboard,
  Receipt,
  BarChart3,
  Users,
  LogOut,
  X,
  Settings,
  LucideIcon,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  Wallet,
  User as UserIcon,
  DollarSign,
  LineChart,
  LogIn,
} from 'lucide-react';

type NavItem = {
  name: string;
  href: string;
  icon: LucideIcon;
  adminOnly?: boolean;
};

// Menu super admin (vê tudo incluindo Dashboard)
const superAdminNavigation: NavItem[] = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Despesas', href: '/dashboard/expenses', icon: Receipt },
  { name: 'Receitas', href: '/dashboard/incomes', icon: DollarSign },
  { name: 'Investimentos', href: '/dashboard/investments', icon: LineChart },
  { name: 'Relatórios', href: '/dashboard/reports', icon: BarChart3 },
  { name: 'Gestão Financeira', href: '/dashboard/financial', icon: Wallet },
  { name: 'Previsões', href: '/dashboard/predictions', icon: TrendingUp },
];

// Menu admin da família (com Dashboard da família)
const familyAdminNavigation: NavItem[] = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Despesas', href: '/dashboard/expenses', icon: Receipt },
  { name: 'Receitas', href: '/dashboard/incomes', icon: DollarSign },
  { name: 'Investimentos', href: '/dashboard/investments', icon: LineChart },
  { name: 'Relatórios', href: '/dashboard/reports', icon: BarChart3 },
  { name: 'Gestão Financeira', href: '/dashboard/financial', icon: Wallet },
  { name: 'Previsões', href: '/dashboard/predictions', icon: TrendingUp },
];

// Menu limitado (usuários comuns - com Dashboard da família)
const userNavigation: NavItem[] = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Despesas', href: '/dashboard/expenses', icon: Receipt },
  { name: 'Receitas', href: '/dashboard/incomes', icon: DollarSign },
  { name: 'Investimentos', href: '/dashboard/investments', icon: LineChart },
  { name: 'Relatórios', href: '/dashboard/reports', icon: BarChart3 },
  { name: 'Gestão Financeira', href: '/dashboard/financial', icon: Wallet },
  { name: 'Previsões', href: '/dashboard/predictions', icon: TrendingUp },
];

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, logout, loading } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/login');
    }
  }, [loading, router, user]);

  // Verifica se o usuário está autenticado e tem uma família associada
  if (!loading && !user) {
    return null;
  }

  // Super admin pode acessar sem family_id, outros usuários precisam de uma família
  if (!loading && user && !user.family_id && user.role !== 'USERADMINSUPER') {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <div className="rounded-lg bg-white p-8 text-center shadow-lg">
          <h1 className="mb-4 text-2xl font-bold text-gray-900">Acesso Restrito</h1>
          <p className="mb-6 text-gray-600">
            Você não está associado a nenhuma família. Por favor, contate o administrador.
          </p>
          <button
            onClick={() => {
              logout();
              router.push('/login');
            }}
            className="rounded-lg bg-primary-600 px-6 py-2 text-white hover:bg-primary-700"
          >
            Voltar ao Login
          </button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  const isAdmin = user?.role === 'USERADMIN' || user?.role === 'USERADMINSUPER';
  const isSuperAdmin = user?.role === 'USERADMINSUPER';

  const handleNavigation = (href: string) => {
    setSidebarOpen(false);
    router.push(href);
  };

  const toggleSidebar = () => setSidebarOpen((s) => !s);
  const toggleCollapse = () => setSidebarCollapsed((s) => !s);

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {/* Mobile Sidebar Overlay — apenas se aberto via desktop-style drawer (não usado no mobile novo) */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-gray-600 bg-opacity-75 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar Component — desktop; no mobile fica oculto (bottom nav assume o lugar) */}
      <div
        className={`fixed inset-y-0 left-0 z-50 bg-white shadow-lg transform transition-all duration-300 ease-in-out lg:relative lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } ${sidebarCollapsed ? 'lg:w-20' : 'w-64'} hidden lg:block`}
      >
        <div className="flex h-full flex-col relative">
          {/* Header da Sidebar */}
          <div className="flex h-16 items-center justify-between px-6 border-b">
            <h1
              className={`text-xl font-bold text-primary-600 transition-opacity duration-300 ${sidebarCollapsed ? 'lg:opacity-0 lg:hidden' : 'opacity-100'}`}
            >
              Controle de Contas
            </h1>
            <h1
              className={`text-xl font-bold text-primary-600 transition-opacity duration-300 ${sidebarCollapsed ? 'lg:opacity-100 lg:block' : 'lg:opacity-0 lg:hidden'}`}
            >
              CC
            </h1>
            <button onClick={toggleSidebar} className="lg:hidden text-gray-500 hover:text-gray-700">
              <X className="h-6 w-6" />
            </button>
          </div>

          {/* Links de Navegação */}
          <nav className="flex-1 space-y-1 px-3 py-4" aria-label="Navegação desktop">
            {(() => {
              if (isSuperAdmin) return superAdminNavigation;
              if (isAdmin) return familyAdminNavigation;
              return userNavigation;
            })().map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              return (
                <button
                  key={item.name}
                  onClick={() => handleNavigation(item.href)}
                  className={`flex w-full items-center rounded-lg px-3 py-2.5 text-sm font-medium transition-all ${
                    isActive ? 'bg-primary-50 text-primary-700' : 'text-gray-700 hover:bg-gray-100'
                  } ${sidebarCollapsed ? 'lg:justify-center' : 'space-x-3'}`}
                  title={sidebarCollapsed ? item.name : undefined}
                >
                  <Icon className="h-5 w-5 flex-shrink-0" />
                  <span
                    className={`transition-opacity duration-300 ${sidebarCollapsed ? 'lg:opacity-0 lg:hidden lg:w-0' : 'opacity-100'}`}
                  >
                    {item.name}
                  </span>
                </button>
              );
            })}
          </nav>

          {/* Área Inferior: Usuário e Ações */}
          <div className="border-t p-4">
            <div
              className={`flex items-center mb-4 ${sidebarCollapsed ? 'lg:justify-center' : 'space-x-3'}`}
            >
              <div className="flex-shrink-0">
                <div className="h-10 w-10 rounded-full bg-primary-100 flex items-center justify-center">
                  <span className="text-primary-700 font-semibold text-sm">
                    {user?.full_name?.charAt(0).toUpperCase()}
                  </span>
                </div>
              </div>
              <div
                className={`flex-1 min-w-0 transition-opacity duration-300 ${sidebarCollapsed ? 'lg:opacity-0 lg:hidden lg:w-0' : 'opacity-100'}`}
              >
                <p className="text-sm font-medium text-gray-900 truncate">{user?.full_name}</p>
                <p className="text-xs text-gray-500 truncate">{user?.email}</p>
              </div>
            </div>

            <div className="space-y-1">
              {isSuperAdmin && (
                <button
                  onClick={() => handleNavigation('/dashboard/settings')}
                  className={`flex w-full items-center rounded-lg px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 transition-all ${sidebarCollapsed ? 'lg:justify-center' : 'space-x-2'}`}
                  title={sidebarCollapsed ? 'Configurações' : undefined}
                >
                  <Settings className="h-5 w-5 flex-shrink-0" />
                  <span
                    className={`transition-opacity duration-300 ${sidebarCollapsed ? 'lg:opacity-0 lg:hidden lg:w-0' : 'opacity-100'}`}
                  >
                    Configurações
                  </span>
                </button>
              )}

              <button
                onClick={() => handleNavigation('/dashboard/profile')}
                className={`flex w-full items-center rounded-lg px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 transition-all ${sidebarCollapsed ? 'lg:justify-center' : 'space-x-2'}`}
                title={sidebarCollapsed ? 'Meu Perfil' : undefined}
              >
                <UserIcon className="h-5 w-5 flex-shrink-0" />
                <span
                  className={`transition-opacity duration-300 ${sidebarCollapsed ? 'lg:opacity-0 lg:hidden lg:w-0' : 'opacity-100'}`}
                >
                  Meu Perfil
                </span>
              </button>

              {isAdmin && (
                <button
                  onClick={() => handleNavigation('/dashboard/users')}
                  className={`flex w-full items-center rounded-lg px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 transition-all ${sidebarCollapsed ? 'lg:justify-center' : 'space-x-2'}`}
                  title={sidebarCollapsed ? 'Usuários' : undefined}
                >
                  <Users className="h-5 w-5 flex-shrink-0" />
                  <span
                    className={`transition-opacity duration-300 ${sidebarCollapsed ? 'lg:opacity-0 lg:hidden lg:w-0' : 'opacity-100'}`}
                  >
                    Usuários
                  </span>
                </button>
              )}

              {isSuperAdmin && (
                <button
                  onClick={() => handleNavigation('/dashboard/admin/access-logs')}
                  className={`flex w-full items-center rounded-lg px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 transition-all ${sidebarCollapsed ? 'lg:justify-center' : 'space-x-2'}`}
                  title={sidebarCollapsed ? 'Logs de Acesso' : undefined}
                >
                  <LogIn className="h-5 w-5 flex-shrink-0" />
                  <span
                    className={`transition-opacity duration-300 ${sidebarCollapsed ? 'lg:opacity-0 lg:hidden lg:w-0' : 'opacity-100'}`}
                  >
                    Logs de Acesso
                  </span>
                </button>
              )}

              <button
                onClick={logout}
                className={`flex w-full items-center rounded-lg px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 transition-all ${sidebarCollapsed ? 'lg:justify-center' : 'space-x-2'}`}
                title={sidebarCollapsed ? 'Sair do Sistema' : undefined}
              >
                <LogOut className="h-5 w-5 flex-shrink-0" />
                <span
                  className={`transition-opacity duration-300 ${sidebarCollapsed ? 'lg:opacity-0 lg:hidden lg:w-0' : 'opacity-100'}`}
                >
                  Sair do Sistema
                </span>
              </button>
            </div>
          </div>

          <button
            onClick={toggleCollapse}
            className="hidden lg:flex absolute -right-3 top-20 bg-white border border-gray-200 rounded-full p-1.5 shadow-md hover:shadow-lg hover:bg-gray-50 transition-all z-50"
            title={sidebarCollapsed ? 'Expandir menu' : 'Recolher menu'}
          >
            {sidebarCollapsed ? (
              <ChevronRight className="h-4 w-4 text-gray-600" />
            ) : (
              <ChevronLeft className="h-4 w-4 text-gray-600" />
            )}
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Top bar só no desktop */}
        <div className="hidden lg:flex min-h-16 items-center justify-between bg-white px-8 py-2 shadow-sm flex-shrink-0">
          <div className="flex-1" />
        </div>

        <main className="flex-1 overflow-auto p-4 lg:p-8 min-h-0 pb-24 lg:pb-8 pt-[max(1rem,env(safe-area-inset-top))] lg:pt-8">
          {children}
        </main>

        {/* Footer — só desktop */}
        <footer className="hidden lg:block border-t border-gray-200 bg-white px-8 py-2 flex-shrink-0 z-10">
          <div className="flex justify-end items-center">
            <p className="text-xs text-gray-400">
              ©{new Date().getFullYear()} Controle de Contas. Todos os direitos reservados.
            </p>
          </div>
        </footer>
      </div>

      <MobileBottomNav isAdmin={isAdmin} isSuperAdmin={isSuperAdmin} onLogout={logout} />

      <FloatingCalculator />
      <ShareReceiptHandler />
    </div>
  );
}
