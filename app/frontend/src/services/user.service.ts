import api from '@/lib/api';
import { User } from '@/types';
import { handleError } from '@/lib/errorHandler';

/**
 * Serviço para gerenciamento de usuários
 */
export const userService = {
  /**
   * Lista todos os usuários
   * @param skip - Número de registros para pular
   * @param limit - Número máximo de registros
   * @returns Lista de usuários
   */
  async getAll(skip = 0, limit = 100): Promise<User[]> {
    try {
      const response = await api.get<User[]>('/users/', {
        params: { skip, limit },
      });
      return response.data;
    } catch (error) {
      handleError(error, 'Erro ao carregar usuários');
      throw error;
    }
  },

  /**
   * Alias para getAll - mantido para compatibilidade
   */
  async list(skip = 0, limit = 100): Promise<User[]> {
    return this.getAll(skip, limit);
  },

  /**
   * Busca um usuário por ID
   * @param id - ID do usuário
   * @returns Usuário encontrado
   */
  async getById(id: string): Promise<User> {
    try {
      const response = await api.get<User>(`/users/${id}`);
      return response.data;
    } catch (error) {
      handleError(error, 'Erro ao carregar usuário');
      throw error;
    }
  },

  /**
   * Atualiza um usuário
   * @param id - ID do usuário
   * @param data - Dados atualizados
   * @returns Usuário atualizado
   */
  async update(id: string, data: Partial<User>): Promise<User> {
    try {
      const response = await api.put<User>(`/users/${id}`, data);
      return response.data;
    } catch (error) {
      handleError(error, 'Erro ao atualizar usuário');
      throw error;
    }
  },

  /**
   * Ativa ou desativa envio de WhatsApp para o usuário
   */
  async toggleWhatsApp(id: string, enabled: boolean): Promise<User> {
    return this.update(id, { whatsapp_notifications_enabled: enabled });
  },

  /**
   * Cria um novo usuário (admin ou superadmin)
   */
  async create(data: Partial<User> & { password: string }): Promise<User> {
    try {
      const response = await api.post<User>('/users/', data);
      return response.data;
    } catch (error) {
      handleError(error, 'Erro ao criar usuário');
      throw error;
    }
  },

  /**
   * Exclui um usuário
   * @param id - ID do usuário a ser excluído
   */
  async delete(id: string): Promise<void> {
    try {
      await api.delete(`/users/${id}`);
    } catch (error) {
      handleError(error, 'Erro ao excluir usuário');
      throw error;
    }
  },

  /**
   * Atualiza o perfil do usuário atual
   * @param data - Dados atualizados (role/family controlado pelo backend)
   * @returns Usuário atualizado
   */
  async updateMyProfile(data: Partial<User>): Promise<User> {
    try {
      const response = await api.put<User>('/users/me', data);
      return response.data;
    } catch (error) {
      handleError(error, 'Erro ao atualizar perfil');
      throw error;
    }
  },

  /**
   * Atualiza o salário do usuário atual
   * @param monthlySalary - Salário mensal
   * @param salaryPaymentDay - Dia do pagamento (1-31)
   * @returns Usuário atualizado
   */
  async updateSalary(monthlySalary: number, salaryPaymentDay: number = 5): Promise<User> {
    try {
      const response = await api.put<User>('/users/me/salary', null, {
        params: {
          monthly_salary: monthlySalary,
          salary_payment_day: salaryPaymentDay,
        },
      });
      return response.data;
    } catch (error) {
      handleError(error, 'Erro ao atualizar salário');
      throw error;
    }
  },
};
