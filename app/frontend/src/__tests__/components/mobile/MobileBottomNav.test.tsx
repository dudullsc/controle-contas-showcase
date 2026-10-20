import { render, screen, fireEvent } from '@testing-library/react';
import MobileBottomNav, {
  isPrimaryActive,
  isMoreSectionActive,
} from '@/components/mobile/MobileBottomNav';

const mockPush = jest.fn();
const mockPathname = jest.fn(() => '/dashboard/expenses');

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  usePathname: () => mockPathname(),
}));

describe('isPrimaryActive', () => {
  it('matches dashboard only on exact path', () => {
    expect(isPrimaryActive('/dashboard', '/dashboard')).toBe(true);
    expect(isPrimaryActive('/dashboard/expenses', '/dashboard')).toBe(false);
  });

  it('matches nested paths for other tabs', () => {
    expect(isPrimaryActive('/dashboard/expenses', '/dashboard/expenses')).toBe(true);
    expect(isPrimaryActive('/dashboard/expenses/123', '/dashboard/expenses')).toBe(true);
  });
});

describe('isMoreSectionActive', () => {
  it('detects secondary routes', () => {
    expect(isMoreSectionActive('/dashboard/investments')).toBe(true);
    expect(isMoreSectionActive('/dashboard/profile')).toBe(true);
    expect(isMoreSectionActive('/dashboard/expenses')).toBe(false);
  });
});

describe('MobileBottomNav', () => {
  beforeEach(() => {
    mockPush.mockClear();
    mockPathname.mockReturnValue('/dashboard/expenses');
  });

  it('renders the five main mobile nav items', () => {
    render(<MobileBottomNav onLogout={jest.fn()} />);

    expect(screen.getByTestId('mobile-bottom-nav')).toBeInTheDocument();
    expect(screen.getByLabelText('Dashboard')).toBeInTheDocument();
    expect(screen.getByLabelText('Despesas')).toBeInTheDocument();
    expect(screen.getByLabelText('Receitas')).toBeInTheDocument();
    expect(screen.getByLabelText('Relatórios')).toBeInTheDocument();
    expect(screen.getByLabelText('Mais opções')).toBeInTheDocument();
  });

  it('marks Despesas as current page when on expenses', () => {
    render(<MobileBottomNav onLogout={jest.fn()} />);
    expect(screen.getByLabelText('Despesas')).toHaveAttribute('aria-current', 'page');
  });

  it('navigates when a primary tab is clicked', () => {
    render(<MobileBottomNav onLogout={jest.fn()} />);
    fireEvent.click(screen.getByLabelText('Receitas'));
    expect(mockPush).toHaveBeenCalledWith('/dashboard/incomes');
  });

  it('opens Mais sheet with secondary options', () => {
    render(<MobileBottomNav isAdmin isSuperAdmin onLogout={jest.fn()} />);
    fireEvent.click(screen.getByLabelText('Mais opções'));

    expect(screen.getByTestId('mobile-more-sheet')).toBeInTheDocument();
    expect(screen.getByText('Investimentos')).toBeInTheDocument();
    expect(screen.getByText('Meu Perfil')).toBeInTheDocument();
    expect(screen.getByText('Usuários')).toBeInTheDocument();
    expect(screen.getByText('Configurações')).toBeInTheDocument();
    expect(screen.getByText('Sair do Sistema')).toBeInTheDocument();
  });

  it('hides admin-only items for regular users', () => {
    render(<MobileBottomNav onLogout={jest.fn()} />);
    fireEvent.click(screen.getByLabelText('Mais opções'));

    expect(screen.queryByText('Usuários')).not.toBeInTheDocument();
    expect(screen.queryByText('Configurações')).not.toBeInTheDocument();
    expect(screen.getByText('Meu Perfil')).toBeInTheDocument();
  });

  it('calls onLogout from Mais sheet', () => {
    const onLogout = jest.fn();
    render(<MobileBottomNav onLogout={onLogout} />);
    fireEvent.click(screen.getByLabelText('Mais opções'));
    fireEvent.click(screen.getByText('Sair do Sistema'));
    expect(onLogout).toHaveBeenCalled();
  });
});
