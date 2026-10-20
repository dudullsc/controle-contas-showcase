import api from '@/lib/api';
import { handleError } from '@/lib/errorHandler';

export interface AccessLog {
  id: string;
  user_email: string;
  user_id?: string;
  status: string;
  ip_address: string;
  user_agent: string;
  country?: string;
  city?: string;
  latitude?: number;
  longitude?: number;
  error_message?: string;
  timestamp: string;
}

export interface AccessLogStats {
  total_accesses: number;
  successful_accesses: number;
  failed_accesses: number;
  success_rate: number;
  top_users: Array<{ _id: string; count: number }>;
  top_ips: Array<{ _id: string; count: number }>;
}

export const accessLogService = {
  /**
   * Lista logs de acesso com filtros
   */
  async getAccessLogs(filters: {
    user_email?: string;
    status_filter?: string;
    start_date?: string;
    end_date?: string;
    ip_address?: string;
    country?: string;
    city?: string;
    skip?: number;
    limit?: number;
    sort_by?: string;
    sort_order?: string;
  }) {
    try {
      const response = await api.get('/admin/access-logs', {
        params: {
          user_email: filters.user_email,
          status_filter: filters.status_filter,
          start_date: filters.start_date,
          end_date: filters.end_date,
          ip_address: filters.ip_address,
          country: filters.country,
          city: filters.city,
          skip: filters.skip || 0,
          limit: filters.limit || 50,
          sort_by: filters.sort_by || 'timestamp',
          sort_order: filters.sort_order || 'desc',
        },
      });
      return response.data;
    } catch (error) {
      handleError(error, 'Erro ao carregar logs de acesso');
      throw error;
    }
  },

  /**
   * Retorna estatísticas de acesso
   */
  async getAccessStats(): Promise<AccessLogStats> {
    try {
      const response = await api.get<AccessLogStats>('/admin/access-logs/stats');
      return response.data;
    } catch (error) {
      handleError(error, 'Erro ao carregar estatísticas de acesso');
      throw error;
    }
  },

  /**
   * Retorna logs de um usuário específico
   */
  async getUserAccessLogs(userId: string, skip = 0, limit = 20) {
    try {
      const response = await api.get(`/admin/access-logs/user/${userId}`, {
        params: { skip, limit },
      });
      return response.data;
    } catch (error) {
      handleError(error, 'Erro ao carregar logs do usuário');
      throw error;
    }
  },

  /**
   * Retorna logs de um IP específico
   */
  async getIpAccessLogs(ipAddress: string, skip = 0, limit = 50) {
    try {
      const response = await api.get(`/admin/access-logs/ip/${ipAddress}`, {
        params: { skip, limit },
      });
      return response.data;
    } catch (error) {
      handleError(error, 'Erro ao carregar logs do IP');
      throw error;
    }
  },
};
