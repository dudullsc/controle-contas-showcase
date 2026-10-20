import api from '@/lib/api';
import { FinancialDashboard, LongTermPrediction, PurchaseSimulation, PaymentSource } from '@/types';
import { handleError } from '@/lib/errorHandler';
import { cache, getFinancialDashboardCacheKey } from '@/lib/cache';

/**
 * Serviço para análises e previsões financeiras
 */
export const financialService = {
  /**
   * Busca dashboard financeiro completo
   * @param month - Mês (1-12), opcional
   * @param year - Ano, opcional
   * @returns Dashboard com saúde financeira, análises e comparações
   */
  async getDashboard(month?: number, year?: number): Promise<FinancialDashboard> {
    const monthParam = month || new Date().getMonth() + 1;
    const yearParam = year || new Date().getFullYear();
    const cacheKey = getFinancialDashboardCacheKey(monthParam, yearParam);

    // Verificar cache
    const cached = cache.get<FinancialDashboard>(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const params: any = {};
      if (month !== undefined) params.month = month;
      if (year !== undefined) params.year = year;

      const response = await api.get<FinancialDashboard>('/financial/dashboard', { params });
      // Armazenar no cache (5 minutos)
      cache.set(cacheKey, response.data, 5 * 60 * 1000);
      return response.data;
    } catch (error) {
      handleError(error, 'Erro ao carregar dashboard financeiro');
      throw error;
    }
  },

  /**
   * Busca previsão financeira de longo prazo
   * @param years - Número de anos para projetar (1-20)
   * @param currentBalance - Saldo atual, opcional
   * @param inflationRate - Taxa de inflação anual, opcional
   * @returns Previsão com projeções mensais e anuais
   */
  async getLongTermPrediction(
    years: number,
    currentBalance?: number,
    inflationRate?: number,
    monthlyIncome?: number,
    monthlyExpenses?: number
  ): Promise<LongTermPrediction> {
    try {
      const params: any = { years };
      if (currentBalance !== undefined) params.current_balance = currentBalance;
      if (inflationRate !== undefined) params.inflation_rate = inflationRate;
      if (monthlyIncome !== undefined) params.monthly_income = monthlyIncome;
      if (monthlyExpenses !== undefined) params.monthly_expenses = monthlyExpenses;
      const response = await api.get<LongTermPrediction>('/financial/long-term-prediction', {
        params,
      });
      return response.data;
    } catch (error) {
      handleError(error, 'Erro ao carregar previsões de longo prazo');
      throw error;
    }
  },

  /**
   * Simula o impacto de uma compra
   * @param purchaseAmount - Valor da compra
   * @param paymentMethod - Método de pagamento
   * @param installments - Número de parcelas, opcional
   * @param interestRate - Taxa de juros, opcional
   * @returns Simulação com impacto financeiro e recomendações
   */
  async simulatePurchase(
    purchaseAmount: number,
    paymentMethod: string | PaymentSource,
    installments?: number,
    interestRate?: number
  ): Promise<PurchaseSimulation> {
    try {
      const params: any = {
        amount: purchaseAmount,
        payment_method: String(paymentMethod),
      };

      if (installments !== undefined) params.installments = installments;
      if (interestRate !== undefined) params.interest_rate = interestRate;

      const response = await api.post<PurchaseSimulation>('/financial/simulate-purchase', null, {
        params,
      });
      return response.data;
    } catch (error) {
      handleError(error, 'Erro ao simular compra');
      throw error;
    }
  },
};
