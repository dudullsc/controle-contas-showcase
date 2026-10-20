import api from '@/lib/api';
import { Income, IncomeCreate, IncomeUpdate, IncomeSummary, IncomeType } from '@/types';

export const incomeService = {
  // Criar uma nova receita
  async create(data: IncomeCreate): Promise<Income> {
    const response = await api.post('/incomes/', data);
    return response.data;
  },

  // Listar todas as receitas com filtros
  async list(params?: {
    user_id?: string;
    income_type?: IncomeType;
    is_active?: boolean;
  }): Promise<Income[]> {
    const response = await api.get('/incomes/', { params });
    return response.data;
  },

  // Buscar uma receita específica
  async getById(id: string): Promise<Income> {
    const response = await api.get(`/incomes/${id}`);
    return response.data;
  },

  // Atualizar uma receita
  async update(id: string, data: IncomeUpdate): Promise<Income> {
    const response = await api.put(`/incomes/${id}`, data);
    return response.data;
  },

  // Deletar uma receita
  async delete(id: string): Promise<void> {
    await api.delete(`/incomes/${id}`);
  },

  // Obter resumo de receitas
  async getSummary(): Promise<IncomeSummary> {
    const response = await api.get('/incomes/summary/totals');
    return response.data;
  },

  // Ativar/Desativar receita
  async toggleActive(id: string, is_active: boolean): Promise<Income> {
    return this.update(id, { is_active });
  },
};
