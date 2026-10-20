import { render, screen, fireEvent } from '@testing-library/react';
import MobileExpenseCard, { shortenFullName } from '@/components/mobile/expenses/MobileExpenseCard';
import { Expense, ExpenseStatus } from '@/types';

jest.mock('@/components/expenses/BrandLogo', () => {
  return function MockBrandLogo({ description }: { description: string }) {
    return <div data-testid="brand-logo">{description.charAt(0)}</div>;
  };
});

const baseExpense: Expense = {
  _id: 'exp-1',
  description: 'Zippi (1/1)',
  amount: 49.9,
  due_date: '2020-01-01',
  status: ExpenseStatus.EM_ABERTO,
  owner_name: 'Eduardo',
  full_name: 'Eduardo Lopes',
  user_id: 'u1',
  created_at: '2020-01-01T00:00:00Z',
  updated_at: '2020-01-01T00:00:00Z',
  installment_number: 2,
  installment_total: 10,
  installments: 10,
};

describe('shortenFullName', () => {
  it('shortens full names to initial + last name', () => {
    expect(shortenFullName('Eduardo Lopes')).toBe('E. Lopes');
    expect(shortenFullName('Vanessa Ribeiro Silva')).toBe('V. Silva');
  });

  it('handles empty and single names', () => {
    expect(shortenFullName('')).toBe('—');
    expect(shortenFullName('Maria')).toBe('Maria');
  });
});

describe('MobileExpenseCard', () => {
  const formatPaidAt = () => '01/01/2020 10:00';

  it('renders collapsed overdue card with Atrasado and days instead of Em Aberto', () => {
    render(
      <MobileExpenseCard
        expense={baseExpense}
        formatPaidAt={formatPaidAt}
        onEdit={jest.fn()}
        onDelete={jest.fn()}
        onTogglePaid={jest.fn()}
      />
    );

    expect(screen.getByTestId('mobile-expense-card')).toBeInTheDocument();
    expect(screen.getByText('Zippi (1/1)')).toBeInTheDocument();
    expect(screen.getByText(/R\$\s*49,90/)).toBeInTheDocument();
    expect(screen.getByText('Atrasado')).toBeInTheDocument();
    expect(screen.getByText(/dias em atraso/i)).toBeInTheDocument();
    expect(screen.queryByText('EM ABERTO')).not.toBeInTheDocument();
    expect(screen.queryByTestId('mobile-expense-details')).not.toBeInTheDocument();
  });

  it('expands without repeating Atrasado / Em Aberto badges', () => {
    const onEdit = jest.fn();
    const onDelete = jest.fn();

    render(
      <MobileExpenseCard
        expense={baseExpense}
        formatPaidAt={formatPaidAt}
        onEdit={onEdit}
        onDelete={onDelete}
        onTogglePaid={jest.fn()}
      />
    );

    fireEvent.click(screen.getByRole('button', { expanded: false }));

    expect(screen.getByTestId('mobile-expense-details')).toBeInTheDocument();
    expect(screen.getAllByText('Atrasado')).toHaveLength(1);
    expect(screen.getAllByText(/dias em atraso/i)).toHaveLength(1);
    expect(screen.queryByText('EM ABERTO')).not.toBeInTheDocument();
    expect(screen.getByText('Eduardo Lopes')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Editar'));
    expect(onEdit).toHaveBeenCalledWith(baseExpense);

    fireEvent.click(screen.getByText('Ações'));
    expect(onDelete).toHaveBeenCalledWith(baseExpense);
  });

  it('shows Em Aberto badge when open and not overdue', () => {
    const futureExpense: Expense = {
      ...baseExpense,
      due_date: '2099-12-31',
    };

    render(
      <MobileExpenseCard
        expense={futureExpense}
        formatPaidAt={formatPaidAt}
        onEdit={jest.fn()}
        onDelete={jest.fn()}
        onTogglePaid={jest.fn()}
      />
    );

    expect(screen.getByText('EM ABERTO')).toBeInTheDocument();
    expect(screen.queryByText('Atrasado')).not.toBeInTheDocument();
  });

  it('shows paid by user and datetime in one phrase', () => {
    const paidExpense: Expense = {
      ...baseExpense,
      status: ExpenseStatus.PAGO,
      paid_at: '2026-09-17T13:34:00Z',
      paid_by_name: 'Valeria Ribeiro',
      due_date: '2026-09-15',
    };

    render(
      <MobileExpenseCard
        expense={paidExpense}
        formatPaidAt={() => '17/09/2026 10:34'}
        onEdit={jest.fn()}
        onDelete={jest.fn()}
        onTogglePaid={jest.fn()}
      />
    );

    fireEvent.click(screen.getByRole('button', { expanded: false }));

    expect(screen.queryByText('Pago em dia')).not.toBeInTheDocument();
    expect(screen.getByText(/Pago por/)).toBeInTheDocument();
    expect(screen.getByText('Valeria Ribeiro')).toBeInTheDocument();
    expect(screen.getByText(/em 17\/09\/2026 10:34/)).toBeInTheDocument();
  });

  it('toggles paid from the switch control', () => {
    const onTogglePaid = jest.fn();
    render(
      <MobileExpenseCard
        expense={baseExpense}
        formatPaidAt={formatPaidAt}
        onEdit={jest.fn()}
        onDelete={jest.fn()}
        onTogglePaid={onTogglePaid}
      />
    );

    fireEvent.click(screen.getByRole('button', { expanded: false }));
    fireEvent.click(screen.getByRole('switch', { name: /Marcar como pago/i }));
    expect(onTogglePaid).toHaveBeenCalledWith(baseExpense);
  });
});
