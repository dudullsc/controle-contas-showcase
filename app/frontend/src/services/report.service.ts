import api from '@/lib/api';
import { MonthlySummary, YearlySummary } from '@/types';
import { handleError } from '@/lib/errorHandler';
import { cache, getMonthlySummaryCacheKey } from '@/lib/cache';

/**
 * Serviço para relatórios e análises financeiras
 */
export const reportService = {
  /**
   * Busca extrato de salários vs despesas por ano
   * @param year - Ano
   * @param userId - ID do usuário (opcional)
   * @returns Extrato com receitas e despesas por mês
   */
  async getIncomeVsExpensesByYear(year?: number, userId?: string) {
    try {
      const params: any = {};
      if (year) params.year = year;
      if (userId) params.user_id = userId;
      const response = await api.get('/reports/income-vs-expenses', { params });
      return response.data;
    } catch (error) {
      handleError(error, 'Erro ao carregar extrato de salários vs despesas');
      throw error;
    }
  },
  /**
   * Busca resumo mensal de despesas
   * @param month - Mês (1-12)
   * @param year - Ano
   * @returns Resumo mensal com totais e análises
   */
  async getMonthlySummary(month: number, year: number): Promise<MonthlySummary> {
    const cacheKey = getMonthlySummaryCacheKey(month, year);

    // Verificar cache
    const cached = cache.get<MonthlySummary>(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const response = await api.get<MonthlySummary>('/reports/monthly', {
        params: { month, year },
      });
      // Armazenar no cache (5 minutos)
      cache.set(cacheKey, response.data, 5 * 60 * 1000);
      return response.data;
    } catch (error) {
      handleError(error, 'Erro ao carregar resumo mensal');
      throw error;
    }
  },

  /**
   * Busca resumo anual de despesas
   * @param year - Ano
   * @returns Resumo anual com totais mensais
   */
  async getYearlySummary(year: number): Promise<YearlySummary> {
    const cacheKey = `yearly_summary_${year}`;

    // Verificar cache
    const cached = cache.get<YearlySummary>(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const response = await api.get<YearlySummary>('/reports/yearly', {
        params: { year },
      });
      // Armazenar no cache (10 minutos)
      cache.set(cacheKey, response.data, 10 * 60 * 1000);
      return response.data;
    } catch (error) {
      handleError(error, 'Erro ao carregar resumo anual');
      throw error;
    }
  },

  /**
   * Busca extrato de salários vs despesas com filtros
   * @param startDate - Data de início (opcional)
   * @param endDate - Data de fim (opcional)
   * @param userId - ID do usuário (opcional)
   * @returns Extrato com receitas e despesas por mês
   */
  async getIncomeVsExpenses(startDate?: string, endDate?: string, userId?: string) {
    try {
      const params: any = {};
      if (startDate) params.start_date = startDate;
      if (endDate) params.end_date = endDate;
      if (userId) params.user_id = userId;

      const response = await api.get('/reports/income-vs-expenses', { params });
      return response.data;
    } catch (error) {
      handleError(error, 'Erro ao carregar extrato de salários vs despesas');
      throw error;
    }
  },
};
