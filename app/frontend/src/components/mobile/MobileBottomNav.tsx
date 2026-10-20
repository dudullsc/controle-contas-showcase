'use client';

import { useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  Receipt,
  DollarSign,
  BarChart3,
  MoreHorizontal,
  LineChart,
  Wallet,
  TrendingUp,
  Settings,
  User as UserIcon,
  Users,
  LogIn,
  LogOut,
  X,
  LucideIcon,
} from 'lucide-react';

type NavItem = {
  name: string;
  href: string;
  icon: LucideIcon;
};

type MoreItem = NavItem & {
  adminOnly?: boolean;
  superAdminOnly?: boolean;
  danger?: boolean;
  action?: 'logout';
};

const primaryNav: NavItem[] = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Despesas', href: '/dashboard/expenses', icon: Receipt },
  { name: 'Receitas', href: '/dashboard/incomes', icon: DollarSign },
  { name: 'Relatórios', href: '/dashboard/reports', icon: BarChart3 },
];

const moreItems: MoreItem[] = [
  { name: 'Investimentos', href: '/dashboard/investments', icon: LineChart },
  { name: 'Gestão Financeira', href: '/dashboard/financial', icon: Wallet },
  { name: 'Previsões', href: '/dashboard/predictions', icon: TrendingUp },
  { name: 'Meu Perfil', href: '/dashboard/profile', icon: UserIcon },
  { name: 'Usuários', href: '/dashboard/users', icon: Users, adminOnly: true },
  { name: 'Configurações', href: '/dashboard/settings', icon: Settings, superAdminOnly: true },
  {
    name: 'Logs de Acesso',
    href: '/dashboard/admin/access-logs',
    icon: LogIn,
    superAdminOnly: true,
  },
  { name: 'Sair do Sistema', href: '#', icon: LogOut, danger: true, action: 'logout' },
];

function isPrimaryActive(pathname: string, href: string) {
  if (href === '/dashboard') return pathname === '/dashboard';
  return pathname === href || pathname.startsWith(`${href}/`);
}

function isMoreSectionActive(pathname: string) {
  return moreItems.some(
    (item) => item.href !== '#' && (pathname === item.href || pathname.startsWith(`${item.href}/`))
  );
}

type MobileBottomNavProps = {
  isAdmin?: boolean;
  isSuperAdmin?: boolean;
  onLogout: () => void;
};

export default function MobileBottomNav({
  isAdmin = false,
  isSuperAdmin = false,
  onLogout,
}: MobileBottomNavProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);
  const moreActive = isMoreSectionActive(pathname);

  const visibleMoreItems = moreItems.filter((item) => {
    if (item.superAdminOnly && !isSuperAdmin) return false;
    if (item.adminOnly && !isAdmin) return false;
    return true;
  });

  const navigate = (href: string) => {
    setMoreOpen(false);
    router.push(href);
  };

  return (
    <>
      <nav
        aria-label="Navegação mobile"
        data-testid="mobile-bottom-nav"
        className="lg:hidden fixed bottom-0 inset-x-0 z-40 border-t border-gray-200 bg-white pb-[env(safe-area-inset-bottom)] shadow-[0_-4px_20px_rgba(0,0,0,0.06)]"
      >
        <div className="grid grid-cols-5 h-16">
          {primaryNav.map((item) => {
            const Icon = item.icon;
            const active = isPrimaryActive(pathname, item.href);
            return (
              <button
                key={item.href}
                type="button"
                onClick={() => navigate(item.href)}
                aria-current={active ? 'page' : undefined}
                aria-label={item.name}
                className={`flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition-colors ${
                  active ? 'text-primary-700' : 'text-gray-500'
                }`}
              >
                <Icon className={`h-5 w-5 ${active ? 'stroke-[2.25]' : ''}`} />
                <span className={active ? 'font-semibold' : ''}>{item.name}</span>
              </button>
            );
          })}

          <button
            type="button"
            onClick={() => setMoreOpen(true)}
            aria-label="Mais opções"
            aria-expanded={moreOpen}
            className={`flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition-colors ${
              moreActive || moreOpen ? 'text-primary-700' : 'text-gray-500'
            }`}
          >
            <MoreHorizontal className={`h-5 w-5 ${moreActive || moreOpen ? 'stroke-[2.25]' : ''}`} />
            <span className={moreActive || moreOpen ? 'font-semibold' : ''}>Mais</span>
          </button>
        </div>
      </nav>

      {moreOpen && (
        <div className="lg:hidden fixed inset-0 z-50" data-testid="mobile-more-sheet">
          <button
            type="button"
            aria-label="Fechar menu Mais"
            className="absolute inset-0 bg-black/40"
            onClick={() => setMoreOpen(false)}
          />
          <div className="absolute bottom-0 inset-x-0 rounded-t-2xl bg-white shadow-2xl pb-[max(1rem,env(safe-area-inset-bottom))] animate-in slide-in-from-bottom">
            <div className="flex items-center justify-between px-4 pt-4 pb-2 border-b border-gray-100">
              <h2 className="text-base font-semibold text-gray-900">Mais opções</h2>
              <button
                type="button"
                onClick={() => setMoreOpen(false)}
                aria-label="Fechar"
                className="p-2 rounded-lg text-gray-500 hover:bg-gray-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="px-2 py-2 max-h-[60vh] overflow-y-auto">
              {visibleMoreItems.map((item) => {
                const Icon = item.icon;
                const active =
                  item.href !== '#' &&
                  (pathname === item.href || pathname.startsWith(`${item.href}/`));
                return (
                  <button
                    key={item.name}
                    type="button"
                    onClick={() => {
                      if (item.action === 'logout') {
                        setMoreOpen(false);
                        onLogout();
                        return;
                      }
                      navigate(item.href);
                    }}
                    className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition-colors ${
                      item.danger
                        ? 'text-red-600 hover:bg-red-50'
                        : active
                          ? 'bg-primary-50 text-primary-700'
                          : 'text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <Icon className="h-5 w-5 flex-shrink-0" />
                    <span>{item.name}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export { primaryNav, moreItems, isPrimaryActive, isMoreSectionActive };
