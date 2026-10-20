import api from '@/lib/api';
import { Expense, ExpenseCreate, ExpenseStatus, PaymentSource } from '@/types';
import { notificationService } from './notification.service';
import { handleError } from '@/lib/errorHandler';
import { cache } from '@/lib/cache';

/**
 * Serviço para gerenciamento de despesas
 */
export const expenseService = {
  /**
   * Lista todas as despesas com filtros opcionais
   * @param params - Parâmetros de filtro (status, mês, ano, etc.)
   * @returns Lista de despesas
   */
  async getAll(params?: {
    status?: ExpenseStatus;
    month?: number;
    year?: number;
    start_date?: string;
    end_date?: string;
    paid_start_date?: string;
    paid_end_date?: string;
    skip?: number;
    limit?: number;
    owner_name?: string;
    user_id?: string;
    category?: string;
  }): Promise<Expense[]> {
    try {
      const response = await api.get<Expense[]>('/expenses/', { params });
      return response.data;
    } catch (error) {
      handleError(error, 'Erro ao carregar despesas');
      throw error;
    }
  },

  /**
   * Busca uma despesa por ID
   * @param id - ID da despesa
   * @returns Despesa encontrada
   */
  async getById(id: string): Promise<Expense> {
    try {
      const response = await api.get<Expense>(`/expenses/${id}`);
      return response.data;
    } catch (error) {
      handleError(error, 'Erro ao carregar despesa');
      throw error;
    }
  },

  /**
   * Cria uma nova despesa
   * @param expense - Dados da despesa a ser criada
   * @param skipNotification - Se true, não agenda notificações (útil para criação em lote)
   * @returns Despesa criada
   */
  async create(expense: ExpenseCreate, skipNotification: boolean = false): Promise<Expense> {
    try {
      const response = await api.post<Expense>('/expenses/', expense);
      const createdExpense = response.data;

      // Invalidar cache relacionado
      if (expense.due_date) {
        const date = new Date(expense.due_date);
        cache.delete(`monthly_summary_${date.getFullYear()}_${date.getMonth() + 1}`);
        cache.delete(`financial_dashboard_${date.getFullYear()}_${date.getMonth() + 1}`);
      }

      return createdExpense;
    } catch (error) {
      handleError(error, 'Erro ao criar despesa');
      throw error;
    }
  },

  /**
   * Atualiza uma despesa existente
   * @param id - ID da despesa
   * @param expense - Dados atualizados
   * @returns Despesa atualizada
   */
  async update(id: string, expense: Partial<ExpenseCreate>): Promise<Expense> {
    try {
      const response = await api.put<Expense>(`/expenses/${id}`, expense);
      const updatedExpense = response.data;

      // Invalidar cache relacionado
      if (expense.due_date || updatedExpense.due_date) {
        const date = new Date(expense.due_date || updatedExpense.due_date);
        cache.delete(`monthly_summary_${date.getFullYear()}_${date.getMonth() + 1}`);
        cache.delete(`financial_dashboard_${date.getFullYear()}_${date.getMonth() + 1}`);
      }

      return updatedExpense;
    } catch (error) {
      throw error;
    }
  },

  /**
   * Exclui uma despesa
   * @param id - ID da despesa a ser excluída
   */
  async delete(id: string): Promise<void> {
    try {
      await api.delete(`/expenses/${id}`);

      // Invalidar cache (não sabemos o mês, então limpamos tudo relacionado)
      cache.clear();

      // 🔔 Cancelar notificações
      try {
        const numericId = parseInt(id.slice(-8), 16);
        notificationService.cancelNotifications(numericId);
      } catch (error) {
        console.error('Erro ao cancelar notificações:', error);
      }
    } catch (error) {
      handleError(error, 'Erro ao excluir despesa');
      throw error;
    }
  },

  async getInstallmentOpenAmount(
    groupId: string,
    fromExpenseId: string
  ): Promise<{ count: number; open_amount: number }> {
    try {
      const response = await api.get<{ count: number; open_amount: number }>(
        `/expenses/installments/${groupId}/open-amount`,
        { params: { from_expense_id: fromExpenseId } }
      );
      return response.data;
    } catch (error) {
      handleError(error, 'Erro ao somar parcelas em aberto');
      throw error;
    }
  },

  /**
   * Quita as parcelas em aberto a partir de uma parcela.
   * `open_amount` é a soma dessas parcelas, para conferir o comprovante.
   */
  async payInstallmentGroup(
    groupId: string,
    data: {
      payment_source: PaymentSource;
      credit_card_name?: string;
      loan_name?: string;
      from_expense_id?: string;
    }
  ): Promise<{ updated: number; open_amount: number }> {
    try {
      const response = await api.post<{ updated: number; open_amount: number }>(
        `/expenses/installments/${groupId}/pay`,
        data
      );
      cache.clear();
      return response.data;
    } catch (error) {
      handleError(error, 'Erro ao quitar parcelas');
      throw error;
    }
  },

  async deleteInstallmentGroup(
    groupId: string,
    { onlyOpen = true }: { onlyOpen?: boolean } = {}
  ): Promise<void> {
    try {
      await api.delete(`/expenses/installments/${groupId}`, { params: { only_open: onlyOpen } });

      // Invalidar cache e cancelar notificações de todas as parcelas do grupo
      cache.clear();
    } catch (error) {
      handleError(error, 'Erro ao excluir parcelas');
      throw error;
    }
  },

  async uploadReceipt(id: string, file: File): Promise<Expense> {
    const maxBytes = 5 * 1024 * 1024;
    if (file.size > maxBytes) {
      const err = new Error('Arquivo maior que 5 MB');
      handleError(err, 'Arquivo maior que 5 MB');
      throw err;
    }

    const form = new FormData();
    form.append('file', file);

    try {
      const response = await api.post<Expense>(`/expenses/${id}/receipt`, form, {
        timeout: 60000,
      });
      return response.data;
    } catch (error) {
      handleError(error, 'Erro ao enviar comprovante');
      throw error;
    }
  },

  /** Lê o valor do comprovante já anexado (Gemini). */
  async analyzeReceipt(id: string): Promise<Expense> {
    try {
      const response = await api.post<Expense>(`/expenses/${id}/receipt/analyze`, null, {
        timeout: 120000,
      });
      return response.data;
    } catch (error) {
      handleError(error, 'Erro ao analisar comprovante');
      throw error;
    }
  },

  async getReceiptBlob(id: string, download = false): Promise<Blob> {
    try {
      const response = await api.get<Blob>(`/expenses/${id}/receipt`, {
        params: download ? { download: true } : undefined,
        responseType: 'blob',
        timeout: 60000,
      });
      const blob = response.data;
      if (blob.type.includes('application/json')) {
        const text = await blob.text();
        let detail = 'Erro ao carregar comprovante';
        try {
          const json = JSON.parse(text);
          if (json?.detail) detail = json.detail;
        } catch {
          // resposta não era JSON
        }
        throw new Error(detail);
      }
      return blob;
    } catch (error) {
      handleError(error, 'Erro ao carregar comprovante');
      throw error;
    }
  },

  async deleteReceipt(id: string): Promise<Expense> {
    try {
      const response = await api.delete<Expense>(`/expenses/${id}/receipt`);
      return response.data;
    } catch (error) {
      handleError(error, 'Erro ao remover comprovante');
      throw error;
    }
  },

  /**
   * Busca o resumo mensal de despesas com filtros
   * @param params - Parâmetros de filtro (status, mês, ano, user_id, etc.)
   * @returns Resumo mensal
   */
  async getSummary(params?: {
    status?: ExpenseStatus;
    month?: number;
    year?: number;
    start_date?: string;
    end_date?: string;
    user_id?: string;
    category?: string;
  }): Promise<any> {
    try {
      const response = await api.get('/expenses/summary', { params });
      return response.data;
    } catch (error) {
      handleError(error, 'Erro ao carregar resumo de despesas');
      throw error;
    }
  },
};
