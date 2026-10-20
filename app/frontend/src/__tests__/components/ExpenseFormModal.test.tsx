import { render, screen, fireEvent } from '@testing-library/react';
import ExpenseFormModal from '@/components/expenses/ExpenseFormModal';
import { Expense, ExpenseStatus } from '@/types';

describe('ExpenseFormModal', () => {
  const onSubmit = jest.fn();
  const onCancel = jest.fn();

  beforeEach(() => {
    onSubmit.mockClear();
    onCancel.mockClear();
  });

  it('renders Nova Despesa layout with highlighted value and actions', () => {
    render(
      <ExpenseFormModal
        isOpen
        editingExpense={null}
        isSubmitting={false}
        installmentProgress={{ current: 0, total: 0 }}
        onSubmit={onSubmit}
        onCancel={onCancel}
      />
    );

    expect(screen.getByTestId('expense-form-modal')).toBeInTheDocument();
    expect(screen.getByText('Nova Despesa')).toBeInTheDocument();
    expect(screen.getByLabelText('Valor')).toBeInTheDocument();
    expect(screen.getByText('Descrição')).toBeInTheDocument();
    expect(screen.getByText('Vencimento')).toBeInTheDocument();
    expect(screen.getByText('Categoria')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Cancelar/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Criar Despesa/i })).toBeInTheDocument();
  });

  it('shows installment progress when editing a parcelada', () => {
    const editing: Expense = {
      _id: '1',
      description: 'Empréstimo mais (9/10)',
      amount: 338.22,
      due_date: '2026-09-16',
      status: ExpenseStatus.EM_ABERTO,
      owner_name: 'Eduardo',
      full_name: 'Eduardo Lopes',
      user_id: 'u1',
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
      category: 'Empréstimo',
      installment_number: 9,
      installment_total: 10,
      installments: 10,
    };

    render(
      <ExpenseFormModal
        isOpen
        editingExpense={editing}
        isSubmitting={false}
        installmentProgress={{ current: 0, total: 0 }}
        onSubmit={onSubmit}
        onCancel={onCancel}
      />
    );

    expect(screen.getByText('Editar Despesa')).toBeInTheDocument();
    expect(screen.getByText('Parcela 9 de 10 (90%)')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Atualizar Despesa/i })).toBeInTheDocument();
  });

  it('calls onCancel when Cancelar is clicked', () => {
    render(
      <ExpenseFormModal
        isOpen
        editingExpense={null}
        isSubmitting={false}
        installmentProgress={{ current: 0, total: 0 }}
        onSubmit={onSubmit}
        onCancel={onCancel}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /Cancelar/i }));
    expect(onCancel).toHaveBeenCalled();
  });
});
