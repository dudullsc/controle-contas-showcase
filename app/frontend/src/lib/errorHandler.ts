/**
 * Utilitário para tratamento padronizado de erros
 */

import { AxiosError } from 'axios';
import { toast } from 'react-toastify';

export interface ApiError {
  message: string;
  status?: number;
  detail?: string;
}

/** FastAPI devolve `detail` como texto ou como lista de erros de validação. */
export const formatApiDetail = (detail: unknown): string | null => {
  if (typeof detail === 'string' && detail.trim()) return detail.trim();
  if (Array.isArray(detail)) {
    const parts = detail
      .map((item) => {
        if (typeof item === 'string') return item.trim();
        if (item && typeof item === 'object' && 'msg' in item) {
          const msg = String((item as { msg?: unknown }).msg ?? '')
            .replace(/^Value error,\s*/i, '')
            .trim();
          return msg;
        }
        return '';
      })
      .filter(Boolean);
    return parts.length ? parts.join('. ') : null;
  }
  if (detail && typeof detail === 'object' && 'msg' in detail) {
    const msg = String((detail as { msg?: unknown }).msg ?? '').trim();
    return msg || null;
  }
  return null;
};

/**
 * Extrai mensagem de erro de uma resposta da API
 * @param error - Erro do Axios ou Error genérico
 * @returns Mensagem de erro formatada
 */
export const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    if ('response' in error) {
      const axiosError = error as AxiosError<{ detail?: unknown; message?: string }>;
      return (
        formatApiDetail(axiosError.response?.data?.detail) ||
        axiosError.response?.data?.message ||
        axiosError.message ||
        'Erro ao processar requisição'
      );
    }
    return error.message;
  }
  return 'Erro desconhecido';
};

/**
 * Trata erro e exibe toast de notificação
 * @param error - Erro a ser tratado
 * @param defaultMessage - Mensagem padrão se não conseguir extrair do erro
 */
export const handleError = (
  error: unknown,
  defaultMessage: string = 'Erro ao processar operação'
): void => {
  const message = getErrorMessage(error);

  // Usa a mensagem extraída do erro, ou a padrão se vazia
  const finalMessage =
    message && message !== 'Erro ao processar requisição' ? message : defaultMessage;

  toast.error(finalMessage);
  console.error('Erro:', error);
};

/**
 * Wrapper para funções assíncronas com tratamento de erro padronizado
 * @param fn - Função assíncrona a ser executada
 * @param errorMessage - Mensagem de erro personalizada
 * @returns Resultado da função ou null em caso de erro
 */
export const withErrorHandling = async <T>(
  fn: () => Promise<T>,
  errorMessage?: string
): Promise<T | null> => {
  try {
    return await fn();
  } catch (error) {
    handleError(error, errorMessage);
    return null;
  }
};
