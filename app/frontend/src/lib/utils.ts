import { Expense } from '@/types';

/**
 * Formata um valor numérico como moeda brasileira (R$)
 * @param value - Valor numérico a ser formatado
 * @returns String formatada no padrão brasileiro (ex: "R$ 1.234,56")
 */
export const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
};

/**
 * Formata uma data no padrão brasileiro (DD/MM/YYYY)
 * @param date - Data como string ou objeto Date
 * @returns String formatada (ex: "15/12/2024")
 */
export const formatDate = (date: string | Date): string => {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('pt-BR');
};

/**
 * Formata data e hora no padrão brasileiro
 * @param date - Data como string ou objeto Date
 * @returns String formatada (ex: "15/12/2024 14:30:00")
 */
export const formatDateTime = (date: string | Date): string => {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleString('pt-BR');
};

/**
 * Retorna classes CSS para colorir o status de uma despesa
 * @param status - Status da despesa (PAGO, EM ABERTO, NÃO PAGO)
 * @returns String com classes Tailwind CSS
 */
export const getStatusColor = (status: string): string => {
  switch (status) {
    case 'PAGO':
      return 'bg-green-100 text-green-800';
    case 'EM ABERTO':
      return 'bg-yellow-100 text-yellow-800';
    case 'NÃO PAGO':
      return 'bg-red-100 text-red-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
};

/**
 * Verifica se uma despesa está atrasada (vencida e não paga)
 * @param expense - Objeto Expense
 * @returns true se a despesa está atrasada, false caso contrário
 */
export const isOverdue = (expense: Expense): boolean => {
  if (expense.status === 'PAGO') return false;
  const today = new Date();
  const due = new Date(expense.due_date);
  today.setHours(0, 0, 0, 0);
  due.setHours(0, 0, 0, 0);
  return due < today;
};
