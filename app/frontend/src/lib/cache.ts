/**
 * Sistema de cache simples para dados da aplicação
 */

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number; // Time to live em milissegundos
}

class SimpleCache {
  private cache: Map<string, CacheEntry<any>> = new Map();

  /**
   * Armazena um valor no cache
   * @param key - Chave única para o cache
   * @param data - Dados a serem armazenados
   * @param ttl - Tempo de vida em milissegundos (padrão: 5 minutos)
   */
  set<T>(key: string, data: T, ttl: number = 5 * 60 * 1000): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl,
    });
  }

  /**
   * Recupera um valor do cache se ainda estiver válido
   * @param key - Chave do cache
   * @returns Dados armazenados ou null se expirado/não encontrado
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    const now = Date.now();
    if (now - entry.timestamp > entry.ttl) {
      // Cache expirado
      this.cache.delete(key);
      return null;
    }

    return entry.data as T;
  }

  /**
   * Remove uma entrada do cache
   * @param key - Chave do cache
   */
  delete(key: string): void {
    this.cache.delete(key);
  }

  /**
   * Limpa todo o cache
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Remove entradas expiradas do cache
   */
  cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        this.cache.delete(key);
      }
    }
  }
}

// Instância singleton do cache
export const cache = new SimpleCache();

// Limpar cache expirado a cada 10 minutos
if (typeof window !== 'undefined') {
  setInterval(
    () => {
      cache.cleanup();
    },
    10 * 60 * 1000
  );
}

/**
 * Gera chave de cache para MonthlySummary
 */
export const getMonthlySummaryCacheKey = (month: number, year: number): string => {
  return `monthly_summary_${year}_${month}`;
};

/**
 * Gera chave de cache para FinancialDashboard
 */
export const getFinancialDashboardCacheKey = (month: number, year: number): string => {
  return `financial_dashboard_${year}_${month}`;
};
