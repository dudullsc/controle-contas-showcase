'use client';

import { useCallback, useEffect, useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'react-toastify';
import {
  LogIn,
  AlertCircle,
  CheckCircle,
  Download,
  Filter,
  X,
  Eye,
  MapPin,
  Smartphone,
  EyeOff,
} from 'lucide-react';
import { accessLogService, AccessLog, AccessLogStats } from '@/services/access-log.service';

const STATUS_COLORS = {
  SUCCESS: 'bg-green-50 text-green-700 border-green-200',
  FAILED: 'bg-red-50 text-red-700 border-red-200',
  INACTIVE_USER: 'bg-yellow-50 text-yellow-700 border-yellow-200',
  INVALID_CREDENTIALS: 'bg-orange-50 text-orange-700 border-orange-200',
};

const STATUS_ICONS = {
  SUCCESS: CheckCircle,
  FAILED: AlertCircle,
  INACTIVE_USER: AlertCircle,
  INVALID_CREDENTIALS: AlertCircle,
};

export default function AccessLogsPage() {
  const [logs, setLogs] = useState<AccessLog[]>([]);
  const [stats, setStats] = useState<AccessLogStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  // Filtros
  const [filters, setFilters] = useState({
    user_email: '',
    status_filter: '',
    start_date: '',
    end_date: '',
    ip_address: '',
    country: '',
    city: '',
  });

  const [pagination, setPagination] = useState({
    skip: 0,
    limit: 10,
    total: 0,
    pages: 0,
  });

  const [sorting, setSorting] = useState({
    sort_by: 'timestamp',
    sort_order: 'desc',
  });

  const loadLogs = useCallback(async () => {
    try {
      setLoading(true);
      const response = await accessLogService.getAccessLogs({
        ...filters,
        skip: pagination.skip,
        limit: pagination.limit,
        ...sorting,
      });

      setLogs(response.data);
      setPagination((prev) => ({
        ...prev,
        total: response.total,
        pages: response.pages,
      }));
    } catch (error) {
      toast.error('Erro ao carregar logs');
    } finally {
      setLoading(false);
    }
  }, [filters, pagination.skip, pagination.limit, sorting]);

  const loadStats = useCallback(async () => {
    try {
      const statsData = await accessLogService.getAccessStats();
      setStats(statsData);
    } catch (error) {
      console.error('Erro ao carregar estatísticas:', error);
    }
  }, []);

  useEffect(() => {
    loadLogs();
    loadStats();
  }, [loadLogs, loadStats]);

  const handleFilterChange = (name: string, value: string) => {
    setFilters((prev) => ({
      ...prev,
      [name]: value,
    }));
    setPagination((prev) => ({
      ...prev,
      skip: 0,
    }));
  };

  const handleClearFilters = () => {
    setFilters({
      user_email: '',
      status_filter: '',
      start_date: '',
      end_date: '',
      ip_address: '',
      country: '',
      city: '',
    });
    setPagination((prev) => ({
      ...prev,
      skip: 0,
    }));
  };

  const handleSort = (column: string) => {
    setSorting((prev) => ({
      sort_by: column,
      sort_order: prev.sort_by === column ? (prev.sort_order === 'desc' ? 'asc' : 'desc') : 'desc',
    }));
    setPagination((prev) => ({
      ...prev,
      skip: 0,
    }));
  };

  const handleExport = () => {
    const csv = [
      ['Email', 'Status', 'IP', 'País', 'Cidade', 'Data/Hora', 'User Agent', 'Erro'],
      ...logs.map((log) => [
        log.user_email,
        log.status,
        log.ip_address,
        log.country || '-',
        log.city || '-',
        log.timestamp,
        log.user_agent,
        log.error_message || '-',
      ]),
    ]
      .map((row) => row.map((cell) => `"${cell}"`).join(','))
      .join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `access_logs_${format(new Date(), 'yyyy-MM-dd_HH-mm-ss')}.csv`;
    a.click();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-lg bg-white p-6 shadow-lg">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="flex items-center gap-2 text-3xl font-bold text-gray-900">
              <LogIn className="text-blue-600" size={32} />
              Logs de Acesso
            </h1>
            <p className="mt-2 text-gray-600">Monitore acessos de usuários ao sistema</p>
          </div>
          <button
            onClick={handleExport}
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
          >
            <Download size={18} />
            Exportar CSV
          </button>
        </div>
      </div>

      {/* Estatísticas */}
      {stats && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
          <div className="rounded-lg bg-white p-4 shadow">
            <p className="text-sm text-gray-600">Total de Acessos</p>
            <p className="text-2xl font-bold text-gray-900">{stats.total_accesses}</p>
          </div>
          <div className="rounded-lg bg-green-50 p-4 shadow">
            <p className="text-sm text-gray-600">Acessos com Sucesso</p>
            <p className="text-2xl font-bold text-green-700">{stats.successful_accesses}</p>
          </div>
          <div className="rounded-lg bg-red-50 p-4 shadow">
            <p className="text-sm text-gray-600">Acessos Falhados</p>
            <p className="text-2xl font-bold text-red-700">{stats.failed_accesses}</p>
          </div>
          <div className="rounded-lg bg-blue-50 p-4 shadow">
            <p className="text-sm text-gray-600">Taxa de Sucesso</p>
            <p className="text-2xl font-bold text-blue-700">{stats.success_rate.toFixed(1)}%</p>
          </div>
          <div className="rounded-lg bg-purple-50 p-4 shadow">
            <p className="text-sm text-gray-600">Top IPs</p>
            <p className="text-lg font-bold text-purple-700">{stats.top_ips.length}</p>
          </div>
        </div>
      )}

      {/* Filtros */}
      <div className="rounded-lg bg-white p-6 shadow-lg">
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="mb-4 flex items-center gap-2 text-lg font-semibold text-gray-900"
        >
          <Filter size={20} />
          Filtros {showFilters ? '✕' : '▼'}
        </button>

        {showFilters && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Email</label>
                <input
                  type="text"
                  value={filters.user_email}
                  onChange={(e) => handleFilterChange('user_email', e.target.value)}
                  placeholder="Buscar por email"
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Status</label>
                <select
                  value={filters.status_filter}
                  onChange={(e) => handleFilterChange('status_filter', e.target.value)}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                >
                  <option value="">Todos</option>
                  <option value="SUCCESS">Sucesso</option>
                  <option value="FAILED">Falha</option>
                  <option value="INACTIVE_USER">Usuário Inativo</option>
                  <option value="INVALID_CREDENTIALS">Credenciais Inválidas</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Data Inicial</label>
                <input
                  type="date"
                  value={filters.start_date}
                  onChange={(e) => handleFilterChange('start_date', e.target.value)}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Data Final</label>
                <input
                  type="date"
                  value={filters.end_date}
                  onChange={(e) => handleFilterChange('end_date', e.target.value)}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">IP Address</label>
                <input
                  type="text"
                  value={filters.ip_address}
                  onChange={(e) => handleFilterChange('ip_address', e.target.value)}
                  placeholder="Ex: 192.168.1.1"
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">País</label>
                <input
                  type="text"
                  value={filters.country}
                  onChange={(e) => handleFilterChange('country', e.target.value)}
                  placeholder="Ex: Brazil"
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Cidade</label>
                <input
                  type="text"
                  value={filters.city}
                  onChange={(e) => handleFilterChange('city', e.target.value)}
                  placeholder="Ex: São Paulo"
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div className="flex items-end gap-2">
                <button
                  onClick={handleClearFilters}
                  className="flex items-center gap-1 rounded-lg bg-gray-200 px-3 py-2 text-sm text-gray-700 hover:bg-gray-300"
                >
                  <X size={16} />
                  Limpar
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Tabela de Logs */}
      <div className="overflow-x-auto rounded-lg bg-white shadow-lg">
        {loading ? (
          <div className="flex justify-center p-8">
            <div className="animate-spin">⏳ Carregando...</div>
          </div>
        ) : logs.length === 0 ? (
          <div className="p-8 text-center text-gray-500">Nenhum log encontrado</div>
        ) : (
          <>
            <table className="w-full">
              <thead className="border-b bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">
                    <button
                      onClick={() => handleSort('user_email')}
                      className="flex items-center gap-1 hover:text-blue-600"
                    >
                      Email
                      {sorting.sort_by === 'user_email' &&
                        (sorting.sort_order === 'desc' ? ' ▼' : ' ▲')}
                    </button>
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">
                    <button
                      onClick={() => handleSort('status')}
                      className="flex items-center gap-1 hover:text-blue-600"
                    >
                      Status
                      {sorting.sort_by === 'status' &&
                        (sorting.sort_order === 'desc' ? ' ▼' : ' ▲')}
                    </button>
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">IP</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">
                    Localização
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">
                    <button
                      onClick={() => handleSort('timestamp')}
                      className="flex items-center gap-1 hover:text-blue-600"
                    >
                      Data/Hora
                      {sorting.sort_by === 'timestamp' &&
                        (sorting.sort_order === 'desc' ? ' ▼' : ' ▲')}
                    </button>
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Ações</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => {
                  const StatusIcon = STATUS_ICONS[log.status as keyof typeof STATUS_ICONS];
                  const isExpanded = expandedRow === log.id;

                  return (
                    <tr key={log.id} className="border-b hover:bg-gray-50">
                      <td className="px-6 py-4 text-sm text-gray-900">{log.user_email}</td>
                      <td className="px-6 py-4 text-sm">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 ${
                            STATUS_COLORS[log.status as keyof typeof STATUS_COLORS]
                          }`}
                        >
                          {StatusIcon && <StatusIcon size={14} />}
                          {log.status === 'SUCCESS' ? 'Sucesso' : 'Falha'}
                        </span>
                      </td>
                      <td className="px-6 py-4 font-mono text-sm text-gray-600">
                        {log.ip_address}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {log.city && log.country ? (
                          <span className="flex items-center gap-1">
                            <MapPin size={14} />
                            {log.city}, {log.country}
                          </span>
                        ) : (
                          '-'
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">{log.timestamp}</td>
                      <td className="px-6 py-4">
                        <button
                          onClick={() => setExpandedRow(isExpanded ? null : log.id)}
                          className="text-blue-600 hover:text-blue-800"
                        >
                          {isExpanded ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* Detalhes expandidos */}
            {expandedRow && (
              <div className="border-b bg-gray-50 px-6 py-4">
                {logs
                  .filter((log) => log.id === expandedRow)
                  .map((log) => (
                    <div key={log.id} className="space-y-3">
                      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                        <div>
                          <p className="text-xs font-semibold text-gray-600">User Agent</p>
                          <p className="mt-1 break-all text-sm text-gray-900">{log.user_agent}</p>
                        </div>
                        {log.latitude && log.longitude && (
                          <div>
                            <p className="text-xs font-semibold text-gray-600">Coordenadas</p>
                            <p className="mt-1 text-sm text-gray-900">
                              {log.latitude.toFixed(2)}, {log.longitude.toFixed(2)}
                            </p>
                          </div>
                        )}
                        {log.error_message && (
                          <div>
                            <p className="text-xs font-semibold text-gray-600">Erro</p>
                            <p className="mt-1 text-sm text-red-600">{log.error_message}</p>
                          </div>
                        )}
                        <div>
                          <p className="text-xs font-semibold text-gray-600">ID do Log</p>
                          <p className="mt-1 break-all font-mono text-xs text-gray-600">{log.id}</p>
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            )}

            {/* Paginação */}
            <div className="space-y-4 border-t bg-gray-50 px-6 py-4">
              <div className="flex items-center justify-between">
                <div className="text-sm text-gray-600">
                  Mostrando {pagination.skip + 1} a{' '}
                  {Math.min(pagination.skip + pagination.limit, pagination.total)} de{' '}
                  {pagination.total} registros
                </div>

                <div className="flex items-center gap-3">
                  <label className="text-sm font-medium text-gray-700">Registros por página:</label>
                  <select
                    value={pagination.limit}
                    onChange={(e) =>
                      setPagination((prev) => ({
                        ...prev,
                        limit: parseInt(e.target.value),
                        skip: 0,
                      }))
                    }
                    className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                  >
                    <option value={5}>5</option>
                    <option value={10}>10</option>
                    <option value={20}>20</option>
                    <option value={50}>50</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex gap-2">
                  <button
                    onClick={() =>
                      setPagination((prev) => ({
                        ...prev,
                        skip: Math.max(0, prev.skip - prev.limit),
                      }))
                    }
                    disabled={pagination.skip === 0}
                    className="rounded-lg bg-blue-600 px-4 py-2 text-white disabled:bg-gray-400"
                  >
                    ← Anterior
                  </button>

                  <span className="flex items-center px-4 py-2 text-sm font-medium text-gray-700">
                    Página {Math.floor(pagination.skip / pagination.limit) + 1} de{' '}
                    {pagination.pages}
                  </span>

                  <button
                    onClick={() =>
                      setPagination((prev) => ({
                        ...prev,
                        skip:
                          prev.skip + prev.limit < prev.total ? prev.skip + prev.limit : prev.skip,
                      }))
                    }
                    disabled={pagination.skip + pagination.limit >= pagination.total}
                    className="rounded-lg bg-blue-600 px-4 py-2 text-white disabled:bg-gray-400"
                  >
                    Próxima →
                  </button>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
