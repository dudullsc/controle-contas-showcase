import { compareReceiptAmount } from '@/lib/expenseUtils';

describe('compareReceiptAmount', () => {
  it('aceita quando o comprovante bate com a soma', () => {
    expect(compareReceiptAmount(1250.5, 1250.5).differs).toBe(false);
  });

  it('acusa divergência quando a soma das parcelas não bate', () => {
    const check = compareReceiptAmount(1250.5, 1100);
    expect(check.expense_amount).toBe(1250.5);
    expect(check.detected_amount).toBe(1100);
    expect(check.differs).toBe(true);
  });
});
