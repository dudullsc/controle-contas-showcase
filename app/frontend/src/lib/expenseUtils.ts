import { differenceInCalendarDays } from 'date-fns';
import { Expense, ExpenseStatus } from '@/types';

/**
 * Calcula a diferença em dias entre a data de vencimento e hoje
 * @param expense - Despesa a verificar
 * @returns Número de dias (negativo se atrasado, positivo se futuro)
 */
export function getDaysDiff(expense: Expense): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dueDate = new Date(expense.due_date);
  dueDate.setHours(0, 0, 0, 0);
  return differenceInCalendarDays(dueDate, today);
}

/**
 * Retorna as classes CSS para o estilo da linha de acordo com o status e vencimento
 * @param expense - Despesa a verificar
 * @returns Classes CSS para a linha da tabela
 */
export function getRowStyle(expense: Expense): string {
  if (expense.status === ExpenseStatus.PAGO) {
    return 'bg-white opacity-70 hover:opacity-100 transition-opacity';
  }

  const diff = getDaysDiff(expense);

  // ATRASADO (Data passada) - Vermelho
  if (diff < 0) {
    return 'bg-red-50 hover:bg-red-100 border-l-4 border-red-500 shadow-sm';
  }

  // VENCE HOJE - Laranja
  if (diff === 0) {
    return 'bg-orange-50 hover:bg-orange-100 border-l-4 border-orange-500 shadow-sm';
  }

  // VENCE AMANHÃ (1 dia) - Amarelo
  if (diff === 1) {
    return 'bg-yellow-50 hover:bg-yellow-100 border-l-4 border-yellow-400 shadow-sm';
  }

  // Normal
  return 'bg-white hover:bg-gray-50 border-l-4 border-transparent';
}

/** Parcela de um grupo que ainda pode ser quitado de uma vez. */
export function canSettleInstallments(
  expense?: {
    installment_group_id?: string | null;
    installment_total?: number | null;
    installments?: number | null;
    description?: string | null;
  } | null
): boolean {
  if (!expense?.installment_group_id) return false;
  const total = expense.installment_total || expense.installments || 0;
  if (total > 1) return true;
  const match = expense.description?.match(/\((\d+)\/(\d+)\)/);
  return !!match && Number(match[2]) > 1;
}

/** Compara o valor lido no comprovante com a soma esperada (centavos). */
export function compareReceiptAmount(expected: number, detected: number) {
  const expenseAmount = Math.round((expected + Number.EPSILON) * 100) / 100;
  const detectedAmount = Math.round((detected + Number.EPSILON) * 100) / 100;
  return {
    detected_amount: detectedAmount,
    expense_amount: expenseAmount,
    differs: Math.abs(detectedAmount - expenseAmount) >= 0.01,
  };
}

/**
 * Ordena despesas: não pagas por data, depois pagas por data
 */
export function sortExpenses(expenses: Expense[]): Expense[] {
  return [...expenses].sort((a, b) => {
    // Primeiro ordena por status: despesas pagas vão para o final
    if (a.status === ExpenseStatus.PAGO && b.status !== ExpenseStatus.PAGO) return 1;
    if (a.status !== ExpenseStatus.PAGO && b.status === ExpenseStatus.PAGO) return -1;
    // Se ambas têm o mesmo status, ordena por data de vencimento
    return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
  });
}
