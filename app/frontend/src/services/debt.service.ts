import api from '@/lib/api';
import { Debt, DebtCreate, DebtSummary, DebtPayoffPlan, PaymentStrategy } from '@/types';
import { handleError } from '@/lib/errorHandler';

/**
 * Serviço para gerenciamento de dívidas
 */
export const debtService = {
  /**
   * Lista todas as dívidas
   * @param params - Parâmetros de filtro
   * @returns Lista de dívidas
   */
  async getAll(params?: { status?: string; skip?: number; limit?: number }): Promise<Debt[]> {
    try {
      const response = await api.get<Debt[]>('/debts/', { params });
      return response.data;
    } catch (error) {
      handleError(error, 'Erro ao carregar dívidas');
      throw error;
    }
  },

  /**
   * Busca uma dívida por ID
   * @param id - ID da dívida
   * @returns Dívida encontrada
   */
  async getById(id: string): Promise<Debt> {
    try {
      const response = await api.get<Debt>(`/debts/${id}`);
      return response.data;
    } catch (error) {
      handleError(error, 'Erro ao carregar dívida');
      throw error;
    }
  },

  /**
   * Cria uma nova dívida
   * @param debt - Dados da dívida
   * @returns Dívida criada
   */
  async create(debt: DebtCreate): Promise<Debt> {
    try {
      const response = await api.post<Debt>('/debts/', debt);
      return response.data;
    } catch (error) {
      handleError(error, 'Erro ao criar dívida');
      throw error;
    }
  },

  /**
   * Atualiza uma dívida
   * @param id - ID da dívida
   * @param debt - Dados atualizados
   * @returns Dívida atualizada
   */
  async update(id: string, debt: Partial<DebtCreate>): Promise<Debt> {
    try {
      const response = await api.put<Debt>(`/debts/${id}`, debt);
      return response.data;
    } catch (error) {
      handleError(error, 'Erro ao atualizar dívida');
      throw error;
    }
  },

  /**
   * Exclui uma dívida
   * @param id - ID da dívida
   */
  async delete(id: string): Promise<void> {
    try {
      await api.delete(`/debts/${id}`);
    } catch (error) {
      handleError(error, 'Erro ao excluir dívida');
      throw error;
    }
  },

  /**
   * Registra um pagamento de dívida
   * @param debtId - ID da dívida
   * @param amount - Valor do pagamento
   * @param paymentDate - Data do pagamento, opcional
   * @param notes - Observações, opcional
   * @returns Dívida atualizada
   */
  async registerPayment(
    debtId: string,
    amount: number,
    paymentDate?: string,
    notes?: string
  ): Promise<Debt> {
    try {
      const response = await api.post<Debt>(`/debts/${debtId}/payment`, {
        amount,
        payment_date: paymentDate,
        notes,
      });
      return response.data;
    } catch (error) {
      handleError(error, 'Erro ao registrar pagamento');
      throw error;
    }
  },

  /**
   * Busca resumo total das dívidas
   * @returns Resumo com totais e estatísticas
   */
  async getSummary(): Promise<DebtSummary> {
    try {
      const response = await api.get<DebtSummary>('/debts/summary/total');
      return response.data;
    } catch (error) {
      handleError(error, 'Erro ao carregar resumo de dívidas');
      throw error;
    }
  },

  /**
   * Calcula plano de pagamento otimizado
   * @param strategy - Estratégia de pagamento
   * @param monthlyPayment - Valor mensal disponível
   * @param debtIds - IDs das dívidas, opcional
   * @returns Plano de pagamento detalhado
   */
  async getPayoffPlan(
    strategy: PaymentStrategy,
    monthlyPayment: number,
    debtIds?: string[]
  ): Promise<DebtPayoffPlan> {
    try {
      const response = await api.post<DebtPayoffPlan>('/debts/payoff-plan', {
        strategy,
        monthly_payment: monthlyPayment,
        debt_ids: debtIds,
      });
      return response.data;
    } catch (error) {
      handleError(error, 'Erro ao calcular plano de pagamento');
      throw error;
    }
  },
};
