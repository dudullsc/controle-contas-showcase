import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import PaymentSourceModal from '@/components/expenses/PaymentSourceModal';
import DeleteConfirmModal from '@/components/expenses/DeleteConfirmModal';
import { expenseService } from '@/services/expense.service';
import { PaymentSource } from '@/types';

jest.mock('@/lib/ccShare', () => ({
  getPendingSharedReceipt: () => null,
}));

jest.mock('@/services/expense.service', () => ({
  expenseService: {
    getInstallmentOpenAmount: jest.fn(),
  },
}));

const getInstallmentOpenAmount = expenseService.getInstallmentOpenAmount as jest.Mock;

describe('PaymentSourceModal', () => {
  beforeEach(() => {
    getInstallmentOpenAmount.mockResolvedValue({ count: 12, open_amount: 1250.5 });
  });
  it('renders sheet layout and confirms payment source', () => {
    const onConfirm = jest.fn();
    render(
      <PaymentSourceModal
        isOpen
        expenseName="Licencimento Gol"
        onConfirm={onConfirm}
        onCancel={jest.fn()}
      />
    );

    expect(screen.getByTestId('payment-source-modal')).toBeInTheDocument();
    expect(screen.getByText('Como foi pago?')).toBeInTheDocument();
    expect(screen.getByText('Licencimento Gol')).toBeInTheDocument();

    fireEvent.change(screen.getByDisplayValue('Selecione...'), {
      target: { value: PaymentSource.SALARY },
    });
    fireEvent.click(screen.getByRole('button', { name: /Confirmar/i }));
    expect(onConfirm).toHaveBeenCalledWith(PaymentSource.SALARY, '', '', null, false);
  });

  it('offers pay this installment or pay all when settling a group', async () => {
    const onConfirm = jest.fn();
    render(
      <PaymentSourceModal
        isOpen
        expenseName="Internet Eduardo (9/60)"
        canSettleAll
        settleGroupId="grupo-1"
        settleFromExpenseId="parcela-9"
        onConfirm={onConfirm}
        onCancel={jest.fn()}
      />
    );

    expect(screen.getByRole('button', { name: 'Só esta parcela' })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    fireEvent.click(screen.getByRole('button', { name: 'Quitar dívida' }));
    expect(await screen.findByText('Total em aberto')).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText(/1\.250,50/)).toBeInTheDocument();
    });
    expect(screen.getByText(/12 parcelas a partir desta/)).toBeInTheDocument();

    fireEvent.change(screen.getByDisplayValue('Selecione...'), {
      target: { value: PaymentSource.SALARY },
    });
    fireEvent.click(screen.getByRole('button', { name: /Confirmar/i }));
    expect(onConfirm).toHaveBeenCalledWith(PaymentSource.SALARY, '', '', null, true);
  });
});

describe('DeleteConfirmModal', () => {
  it('renders sheet layout and calls actions', () => {
    const onConfirm = jest.fn();
    const onCancel = jest.fn();
    render(
      <DeleteConfirmModal
        isOpen
        title="Excluir despesa"
        message="Tem certeza?"
        onConfirm={onConfirm}
        onCancel={onCancel}
      />
    );

    expect(screen.getByTestId('delete-confirm-modal')).toBeInTheDocument();
    expect(screen.getByText('Excluir despesa')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /^Excluir$/i }));
    expect(onConfirm).toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: /Cancelar/i }));
    expect(onCancel).toHaveBeenCalled();
  });
});
