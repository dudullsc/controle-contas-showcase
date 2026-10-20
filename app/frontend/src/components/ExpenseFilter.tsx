'use client';

import { useState, useEffect } from 'react';
import { Filter, X, Calendar, User, CheckCircle } from 'lucide-react';
import { ExpenseStatus } from '@/types';
import { User as UserType } from '@/types';

interface ExpenseFilterProps {
  onApply: (filters: ExpenseFilterValues) => void;
  onReset?: () => void;
  users?: UserType[];
  showUserFilter?: boolean;
  showStatusFilter?: boolean;
  initialFilters?: ExpenseFilterValues;
}

export interface ExpenseFilterValues {
  status?: ExpenseStatus | '';
  startDate?: string;
  endDate?: string;
  paymentStartDate?: string;
  paymentEndDate?: string;
  userId?: string;
  category?: string;
}

const STATUS_OPTIONS = [
  { value: '', label: 'Todos' },
  { value: ExpenseStatus.PAGO, label: 'Pago' },
  { value: ExpenseStatus.EM_ABERTO, label: 'Em Aberto' },
  { value: ExpenseStatus.NAO_PAGO, label: 'Não Pago' },
];

export default function ExpenseFilter({
  onApply,
  onReset,
  users = [],
  showUserFilter = false,
  showStatusFilter = true,
  initialFilters = {},
}: ExpenseFilterProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [filters, setFilters] = useState<ExpenseFilterValues>({
    status: initialFilters.status || '',
    startDate: initialFilters.startDate || '',
    endDate: initialFilters.endDate || '',
    paymentStartDate: initialFilters.paymentStartDate || '',
    paymentEndDate: initialFilters.paymentEndDate || '',
    userId: initialFilters.userId || '',
  });

  useEffect(() => {
    if (initialFilters) {
      setFilters({
        status: initialFilters.status || '',
        startDate: initialFilters.startDate || '',
        endDate: initialFilters.endDate || '',
        paymentStartDate: initialFilters.paymentStartDate || '',
        paymentEndDate: initialFilters.paymentEndDate || '',
        userId: initialFilters.userId || '',
      });
    }
  }, [initialFilters]);

  const handleApply = () => {
    onApply(filters);
    setIsOpen(false);
  };

  const handleReset = () => {
    const resetFilters: ExpenseFilterValues = {
      status: '',
      startDate: '',
      endDate: '',
      paymentStartDate: '',
      paymentEndDate: '',
      userId: '',
    };
    setFilters(resetFilters);
    if (onReset) {
      onReset();
    } else {
      onApply(resetFilters);
    }
    setIsOpen(false);
  };

  const hasActiveFilters =
    filters.status ||
    filters.startDate ||
    filters.endDate ||
    filters.paymentStartDate ||
    filters.paymentEndDate ||
    filters.userId;

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center space-x-2 rounded-xl px-3 py-2 md:px-5 md:py-2.5 text-xs md:text-sm font-medium transition-all duration-200 ${
          hasActiveFilters
            ? 'bg-gradient-to-r from-primary-600 to-primary-700 text-white shadow-lg hover:from-primary-700 hover:to-primary-800'
            : 'bg-white text-primary-700 border border-primary-300 hover:bg-primary-50 shadow-sm'
        }`}
      >
        <Filter className="h-4 w-4 md:h-5 md:w-5" />
        <span className="sm:hidden">Filtro</span>
        <span className="hidden sm:inline">Filtros</span>
        {hasActiveFilters && (
          <span className="bg-white/20 text-xs px-2 py-0.5 rounded-full">Ativo</span>
        )}
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between bg-gradient-to-r from-primary-600 to-primary-700 px-6 py-4 sticky top-0">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Filter className="h-5 w-5" />
                Filtros de Despesas
              </h3>
              <button
                onClick={() => setIsOpen(false)}
                className="text-white hover:bg-white/20 rounded-lg p-1 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Status */}
              {showStatusFilter && (
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Status</label>
                  <select
                    value={filters.status || ''}
                    onChange={(e) =>
                      setFilters({ ...filters, status: e.target.value as ExpenseStatus | '' })
                    }
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm"
                  >
                    {STATUS_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Data Início */}
              <div>
                <label className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Data Início
                </label>
                <input
                  type="date"
                  value={filters.startDate || ''}
                  onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm"
                />
              </div>

              {/* Data Fim */}
              <div>
                <label className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Data Fim
                </label>
                <input
                  type="date"
                  value={filters.endDate || ''}
                  onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm"
                />
              </div>

              {/* Data Pagamento Início */}
              <div>
                <label className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Data Pagamento Início
                </label>
                <input
                  type="date"
                  value={filters.paymentStartDate || ''}
                  onChange={(e) => setFilters({ ...filters, paymentStartDate: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm"
                />
              </div>

              {/* Data Pagamento Fim */}
              <div>
                <label className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Data Pagamento Fim
                </label>
                <input
                  type="date"
                  value={filters.paymentEndDate || ''}
                  onChange={(e) => setFilters({ ...filters, paymentEndDate: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm"
                />
              </div>

              {/* Filtro por Usuário (se habilitado) */}
              {showUserFilter && users.length > 0 && (
                <div>
                  <label className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                    <User className="h-4 w-4" />
                    Usuário
                  </label>
                  <select
                    value={filters.userId || ''}
                    onChange={(e) => setFilters({ ...filters, userId: e.target.value })}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm"
                  >
                    <option value="">Todos os usuários</option>
                    {users.map((user) => (
                      <option key={user._id} value={user._id}>
                        {user.full_name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Botões de Ação */}
              <div className="flex gap-3 pt-4 border-t border-gray-200">
                <button
                  onClick={handleReset}
                  className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors border border-gray-300"
                >
                  Limpar
                </button>
                <button
                  onClick={handleApply}
                  className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-gradient-to-r from-primary-600 to-primary-700 hover:from-primary-700 hover:to-primary-800 rounded-lg shadow-md transition-all flex items-center justify-center gap-2"
                >
                  <CheckCircle className="h-4 w-4" />
                  Aplicar Filtros
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
