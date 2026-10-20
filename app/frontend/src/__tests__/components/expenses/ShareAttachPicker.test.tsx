import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ShareAttachPicker from '@/components/expenses/ShareAttachPicker';
import { expenseService } from '@/services/expense.service';
import { Expense, ExpenseStatus } from '@/types';

jest.mock('@/services/expense.service', () => ({
  expenseService: {
    getAll: jest.fn(),
  },
}));

jest.mock('@/lib/ccShare', () => ({
  clearPendingSharedReceipt: jest.fn(),
}));

const getAll = expenseService.getAll as jest.Mock;

function isoDate(date: Date) {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

function makeExpense(
  id: string,
  description: string,
  due: Date,
  status: ExpenseStatus
): Expense {
  return {
    _id: id,
    description,
    amount: 100,
    due_date: isoDate(due),
    status,
    owner_name: 'Eduardo',
    category: 'Casa',
    user_id: 'u1',
    created_at: '',
    updated_at: '',
  };
}

describe('ShareAttachPicker', () => {
  const now = new Date();
  const thisMonth = new Date(now.getFullYear(), now.getMonth(), 10);
  const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 10);
  const twoMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 2, 5);

  const currentOpen = makeExpense('oct', 'Luz outubro', thisMonth, ExpenseStatus.EM_ABERTO);
  const currentPaid = makeExpense('paid', 'Internet outubro', thisMonth, ExpenseStatus.PAGO);
  const lastMonthOpen = makeExpense('sep', 'Aluguel setembro', lastMonth, ExpenseStatus.EM_ABERTO);
  const olderUnpaid = makeExpense('aug', 'Cartão agosto', twoMonthsAgo, ExpenseStatus.NAO_PAGO);
  const olderPaid = makeExpense('old-paid', 'Já paga antiga', twoMonthsAgo, ExpenseStatus.PAGO);

  beforeEach(() => {
    getAll.mockImplementation(async (params?: { month?: number; status?: ExpenseStatus }) => {
      if (params?.month) return [currentPaid, currentOpen];
      if (params?.status === ExpenseStatus.EM_ABERTO) return [lastMonthOpen, olderPaid];
      if (params?.status === ExpenseStatus.NAO_PAGO) return [olderUnpaid, lastMonthOpen];
      return [];
    });
  });

  it('mostra atrasadas de meses passados e as contas do mês atual', async () => {
    render(
      <ShareAttachPicker file={new File(['x'], 'comprovante.pdf', { type: 'application/pdf' })} onClose={jest.fn()} />
    );

    expect(await screen.findByRole('heading', { name: 'Atrasadas' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Este mês' })).toBeInTheDocument();

    const overdueAugust = screen.getByText('Cartão agosto');
    const overdueSeptember = screen.getByText('Aluguel setembro');
    const current = screen.getByText('Luz outubro');

    expect(overdueAugust.compareDocumentPosition(overdueSeptember) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(overdueSeptember.compareDocumentPosition(current) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getAllByText('Aluguel setembro')).toHaveLength(1);
    expect(screen.getAllByText('Atrasado')).toHaveLength(2);
    expect(screen.getByText('Internet outubro')).toBeInTheDocument();
    expect(screen.queryByText('Já paga antiga')).not.toBeInTheDocument();
    expect(screen.getByText(/Em aberto/)).toBeInTheDocument();
    expect(screen.getByText('Pago')).toBeInTheDocument();
  });

  it('a busca filtra atrasadas e o mês atual', async () => {
    const user = userEvent.setup();
    render(
      <ShareAttachPicker file={new File(['x'], 'comprovante.pdf', { type: 'application/pdf' })} onClose={jest.fn()} />
    );

    await screen.findByText('Cartão agosto');
    await user.type(screen.getByLabelText('Buscar contas'), 'agosto');

    await waitFor(() => {
      expect(screen.queryByText('Luz outubro')).not.toBeInTheDocument();
    });
    expect(screen.getByText('Cartão agosto')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Este mês' })).not.toBeInTheDocument();
  });
});
