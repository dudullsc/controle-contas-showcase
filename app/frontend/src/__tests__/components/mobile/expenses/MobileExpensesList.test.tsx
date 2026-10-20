import { render, screen, fireEvent } from '@testing-library/react';
import MobileExpensesList from '@/components/mobile/expenses/MobileExpensesList';
import { Expense, ExpenseStatus, MonthlySummary } from '@/types';

jest.mock('@/components/mobile/expenses/MobileExpenseCard', () => {
  const MockCard = ({ expense }: { expense: Expense }) => (
    <div data-testid="mobile-expense-card">{expense.description}</div>
  );
  return {
    __esModule: true,
    default: MockCard,
    shortenFullName: (name?: string) => name || '—',
  };
});

jest.mock('@/components/ExpenseFilter', () => {
  return function MockFilter() {
    return <button type="button">Filtro</button>;
  };
});

const summary: MonthlySummary = {
  user_id: 'u1',
  month: 9,
  year: 2026,
  total_expenses: 100,
  total_paid: 60,
  total_pending: 40,
  expenses_by_status: {},
  expenses_by_category: [],
  expense_count: 1,
  owners: [
    {
      owner: 'u1',
      full_name: 'Eduardo Lopes',
      total_expenses: 100,
      total_paid: 60,
      total_pending: 40,
      total_open: 40,
      expense_count: 1,
    },
  ],
  total_fixed_income: 0,
  total_variable_income: 0,
  total_income: 0,
};

const expense: Expense = {
  _id: '1',
  description: 'Havan (8/8)',
  amount: 67.97,
  due_date: '2026-09-15',
  status: ExpenseStatus.PAGO,
  owner_name: 'Eduardo',
  user_id: 'u1',
  created_at: '',
  updated_at: '',
};

describe('MobileExpensesList', () => {
  it('renders mobile layout with summary and expenses', () => {
    render(
      <MobileExpensesList
        expenses={[expense]}
        summary={summary}
        users={[]}
        loading={false}
        searchQuery=""
        mobileSearchOpen={false}
        appliedFilters={{}}
        selectedExpenseId={null}
        paidExpenseId={null}
        formatPaidAt={() => ''}
        onSearchQueryChange={jest.fn()}
        onMobileSearchOpenChange={jest.fn()}
        onFilterApply={jest.fn()}
        onNewExpense={jest.fn()}
        onEdit={jest.fn()}
        onDelete={jest.fn()}
        onTogglePaid={jest.fn()}
      />
    );

    expect(screen.getByTestId('expenses-mobile-layout')).toBeInTheDocument();
    expect(screen.getByText('Despesas')).toBeInTheDocument();
    expect(screen.getByText('Eduardo Lopes')).toBeInTheDocument();
    expect(screen.getByTestId('mobile-expense-card')).toHaveTextContent('Havan (8/8)');
  });

  it('opens search and calls onNewExpense', () => {
    const onMobileSearchOpenChange = jest.fn();
    const onNewExpense = jest.fn();

    render(
      <MobileExpensesList
        expenses={[]}
        summary={null}
        users={[]}
        loading={false}
        searchQuery=""
        mobileSearchOpen={false}
        appliedFilters={{}}
        selectedExpenseId={null}
        paidExpenseId={null}
        formatPaidAt={() => ''}
        onSearchQueryChange={jest.fn()}
        onMobileSearchOpenChange={onMobileSearchOpenChange}
        onFilterApply={jest.fn()}
        onNewExpense={onNewExpense}
        onEdit={jest.fn()}
        onDelete={jest.fn()}
        onTogglePaid={jest.fn()}
      />
    );

    fireEvent.click(screen.getByLabelText('Buscar despesas'));
    expect(onMobileSearchOpenChange).toHaveBeenCalledWith(true);

    fireEvent.click(screen.getByRole('button', { name: /Nova/i }));
    expect(onNewExpense).toHaveBeenCalled();
  });
});
