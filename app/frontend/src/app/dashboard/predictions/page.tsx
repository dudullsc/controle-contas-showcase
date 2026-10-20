'use client';

import { useEffect, useState, useMemo } from 'react';
import { toast } from 'react-toastify';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Calendar,
  AlertCircle,
  CheckCircle,
  XCircle,
  Calculator,
  BarChart3,
  Target,
  Info,
} from 'lucide-react';
import { financialService } from '@/services/financial.service';
import { incomeService } from '@/services/income.service';
import { Income, IncomeType } from '@/types';
import {
  LongTermPrediction,
  MonthlyProjection,
  YearlyProjection,
  PurchaseSimulation,
  TrendDirection,
  PaymentSource,
  User,
} from '@/types';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Area,
  AreaChart,
  Brush,
  ReferenceLine,
} from 'recharts';
import { formatCurrency } from '@/lib/utils';

const MONTHS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

const formatAxisCurrency = (value: number) => {
  const abs = Math.abs(value);
  const sign = value < 0 ? '-' : '';

  if (abs >= 1000000) return `${sign}R$ ${(abs / 1000000).toFixed(1)}M`;
  if (abs >= 1000) return `${sign}R$ ${(abs / 1000).toFixed(0)}k`;
  return `${sign}R$ ${abs.toFixed(0)}`;
};

const downsampleForChart = <T,>(data: T[], maxPoints: number): T[] => {
  if (data.length <= maxPoints) return data;

  const step = Math.ceil(data.length / maxPoints);
  const sampled = data.filter((_, index) => index % step === 0);

  // Guarantee last point appears in chart.
  const last = data[data.length - 1];
  if (sampled[sampled.length - 1] !== last) {
    sampled.push(last);
  }

  return sampled;
};

type TooltipPayloadItem = {
  name?: string;
  value?: number;
  color?: string;
};

const renderPredictionTooltip = ({
  active,
  label,
  payload,
  labelPrefix,
}: {
  active?: boolean;
  label?: string | number;
  payload?: TooltipPayloadItem[];
  labelPrefix: string;
}) => {
  if (!active || !payload || payload.length === 0) return null;

  return (
    <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 shadow-md">
      <p className="text-xs font-semibold text-gray-700 mb-1">
        {labelPrefix}: {label}
      </p>
      {payload.map((entry, index) => (
        <div key={`${entry.name}-${index}`} className="text-xs" style={{ color: entry.color }}>
          {entry.name}: {formatCurrency(entry.value || 0)}
        </div>
      ))}
    </div>
  );
};

export default function PredictionsPage() {
  const [salaryType, setSalaryType] = useState<'fixed' | 'total'>('total');
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [salaryLoading, setSalaryLoading] = useState(false);
  const [lastFixedIncome, setLastFixedIncome] = useState<number | null>(null);
  const [variableIncomeAvg, setVariableIncomeAvg] = useState<number | null>(null);
  const [incomeLoading, setIncomeLoading] = useState(false);
  // Buscar salários dos usuários ao carregar
  useEffect(() => {
    const fetchUsers = async () => {
      setSalaryLoading(true);
      try {
        const users = await (await import('@/services/user.service')).userService.getAll();
        setAllUsers(users);
      } catch (e) {
        toast.error('Erro ao buscar salários dos usuários');
      } finally {
        setSalaryLoading(false);
      }
    };
    fetchUsers();
  }, []);

  // Buscar receitas fixas mais recentes e média das variáveis dos últimos 12 meses
  useEffect(() => {
    const fetchIncomes = async () => {
      setIncomeLoading(true);
      try {
        const allIncomes: Income[] = await incomeService.list();
        // FIXAS: pegar a soma das receitas fixas ativas (considerando que são mensais)
        const fixedIncomes = allIncomes.filter(
          (i) => i.income_type === IncomeType.FIXED && i.is_active
        );
        // Pega o valor total das receitas fixas mais recentes (soma dos valores ativos)
        const lastFixed = fixedIncomes.reduce((acc, i) => acc + i.amount, 0);
        setLastFixedIncome(lastFixed);

        const now = new Date();
        const last12Months = [];
        for (let i = 0; i < 12; i++) {
          const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
          last12Months.push({ month: d.getMonth() + 1, year: d.getFullYear() });
        }
        // Para cada mês, soma as receitas variáveis daquele mês
        let totalVariable = 0;
        let monthsWithIncome = 0;
        last12Months.forEach(({ month, year }) => {
          const monthIncomes = allIncomes.filter(
            (i) =>
              i.income_type === IncomeType.VARIABLE &&
              i.payment_date &&
              new Date(i.payment_date).getMonth() + 1 === month &&
              new Date(i.payment_date).getFullYear() === year
          );
          const sum = monthIncomes.reduce((acc, i) => acc + i.amount, 0);
          if (sum > 0) monthsWithIncome++;
          totalVariable += sum;
        });
        // Média considerando apenas meses com receita variável
        const avgVariable = monthsWithIncome > 0 ? totalVariable / monthsWithIncome : 0;
        setVariableIncomeAvg(avgVariable);
      } catch (e) {
        toast.error('Erro ao buscar receitas para previsão');
      } finally {
        setIncomeLoading(false);
      }
    };
    fetchIncomes();
  }, []);
  const [loading, setLoading] = useState(false);
  const [prediction, setPrediction] = useState<LongTermPrediction | null>(null);
  const [years, setYears] = useState(1);
  const [currentBalance, setCurrentBalance] = useState(0);
  const [inflationRate, setInflationRate] = useState(0.05);

  // Simulador de compra
  const [showSimulator, setShowSimulator] = useState(false);
  const [purchaseAmountDisplay, setPurchaseAmountDisplay] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [installments, setInstallments] = useState(1);
  const [interestRate, setInterestRate] = useState('');
  const [simulation, setSimulation] = useState<PurchaseSimulation | null>(null);
  const [simulating, setSimulating] = useState(false);

  // Função para formatar valor monetário enquanto digita
  const formatCurrencyInput = (value: string): string => {
    const numericValue = value.replace(/\D/g, '');
    if (!numericValue) return '';
    const numberValue = Number(numericValue) / 100;
    return new Intl.NumberFormat('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(numberValue);
  };

  // Função para converter valor formatado para número
  const parseCurrencyToNumber = (value: string): number => {
    const numericValue = value.replace(/\D/g, '');
    return Number(numericValue) / 100;
  };

  const [monthlyExpenses, setMonthlyExpenses] = useState<number | null>(null);

  // Buscar despesas do mês atual
  useEffect(() => {
    const fetchExpenses = async () => {
      try {
        const now = new Date();
        const expenses = await (
          await import('@/services/expense.service')
        ).expenseService.getAll({
          month: now.getMonth() + 1,
          year: now.getFullYear(),
        });
        const total = expenses.reduce((acc: number, e: any) => acc + e.amount, 0);
        setMonthlyExpenses(total);
      } catch (e) {
        setMonthlyExpenses(0);
      }
    };
    fetchExpenses();
  }, []);

  const loadPrediction = async () => {
    try {
      setLoading(true);
      const fixed = lastFixedIncome || 0;
      const variable = variableIncomeAvg || 0;
      let initialBalance = fixed;
      let monthlyIncome = fixed;
      if (salaryType === 'total') {
        initialBalance = fixed + variable;
        monthlyIncome = fixed + variable;
      }

      // Usar receitas e despesas do mês atual
      const data = await financialService.getLongTermPrediction(
        years,
        initialBalance || undefined,
        inflationRate,
        monthlyIncome,
        monthlyExpenses !== null ? monthlyExpenses : undefined
      );
      setPrediction(data);
      if (data.current_balance !== currentBalance) {
        setCurrentBalance(data.current_balance);
      }
    } catch (error: any) {
      toast.error('Erro ao carregar previsões');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Só carrega previsão quando já buscou receitas
    if (lastFixedIncome !== null && variableIncomeAvg !== null) {
      loadPrediction();
    }
  }, [years, lastFixedIncome, variableIncomeAvg]);

  // Função para formatar texto mantendo anos sem formatação
  const formatTextWithCurrency = (text: string): string => {
    // Melhorar a formatação dos avisos para facilitar entendimento
    let formatted = text;
    // Corrigir datas tipo "02/2.026,00" para "02/2026"
    formatted = formatted.replace(/(\d{2})\/(\d{1,4})[.,]?(\d{2})?/g, (match, m, y) => {
      // Remove zeros e vírgulas
      y = y.replace(/\D/g, '');
      return `${m}/${y}`;
    });
    // Corrigir valores monetários para formato brasileiro
    formatted = formatted.replace(/R\$\s*([-+]?\d+[.,]?\d*)/g, (match, value) => {
      const num = parseFloat(value.replace('.', '').replace(',', '.'));
      if (!isNaN(num)) {
        return `R$ ${num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      }
      return match;
    });
    // Corrigir porcentagens
    formatted = formatted.replace(/(\d{1,3}[.,]?\d*)%/g, (match) => {
      return match.replace('.', ',');
    });
    // Simplificar frases comuns
    formatted = formatted.replace(
      /Ficará negativo por (\d+) de (\d+) meses \((\d+[.,]?\d*)%\)/,
      (match, neg, total, perc) => {
        return `Ficará negativo por ${neg} de ${total} meses (${perc.replace('.', ',')}%)`;
      }
    );
    formatted = formatted.replace(/Saldo ficará negativo em (\d{2})\/(\d{4})/, (match, m, y) => {
      return `O saldo ficará negativo em ${m}/${y}`;
    });
    formatted = formatted.replace(
      /Pior saldo projetado: R\$\s*([-+]?\d+[.,]?\d*) em (\d{2})\/(\d{4})/,
      (match, value, m, y) => {
        return `Pior saldo projetado: R$ ${parseFloat(value.replace('.', '').replace(',', '.')).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} em ${m}/${y}`;
      }
    );
    return formatted;
  };

  const getTrendIcon = (trend: TrendDirection) => {
    switch (trend) {
      case TrendDirection.INCREASING:
        return <TrendingUp className="h-5 w-5 text-green-500" />;
      case TrendDirection.DECREASING:
        return <TrendingDown className="h-5 w-5 text-red-500" />;
      default:
        return <BarChart3 className="h-5 w-5 text-gray-500" />;
    }
  };

  const getHealthColor = (willGoNegative: boolean, willBecomePositive: boolean) => {
    if (willGoNegative && !willBecomePositive) return 'text-red-600';
    if (willGoNegative && willBecomePositive) return 'text-yellow-600';
    return 'text-green-600';
  };

  // Dados para gráfico de projeção mensal
  const monthlyFullData = useMemo(() => {
    if (!prediction?.monthly_projections_sample) return [];
    return prediction.monthly_projections_sample.map((proj, idx) => ({
      month: `${MONTHS[proj.month - 1]}/${proj.year}`,
      monthIndex: idx + 1,
      balance: proj.accumulated_balance,
      income: proj.projected_income,
      expenses: proj.projected_expenses,
    }));
  }, [prediction]);

  const monthlyChartData = useMemo(() => {
    return downsampleForChart(monthlyFullData, 36);
  }, [monthlyFullData]);

  // Dados para gráfico anual
  const yearlyChartData = useMemo(() => {
    if (!prediction?.yearly_projections) return [];
    return prediction.yearly_projections.map((proj) => ({
      year: proj.year,
      income: proj.total_income,
      expenses: proj.total_expenses,
      net: proj.net_annual,
      finalBalance: proj.final_balance,
    }));
  }, [prediction]);

  const yearlyBalanceDomain = useMemo(() => {
    if (yearlyChartData.length === 0) return [-1000, 1000];

    const allValues = yearlyChartData.flatMap((item) => [item.finalBalance, item.net]);
    const min = Math.min(...allValues, 0);
    const max = Math.max(...allValues, 0);
    const range = Math.max(Math.abs(max - min), 1);
    const padding = range * 0.1;

    return [min - padding, max + padding];
  }, [yearlyChartData]);

  const monthlyTickStep = useMemo(() => {
    if (monthlyChartData.length > 36) return 6;
    if (monthlyChartData.length > 24) return 4;
    if (monthlyChartData.length > 14) return 3;
    if (monthlyChartData.length > 8) return 2;
    return 1;
  }, [monthlyChartData.length]);

  const monthlyProjectionSummary = useMemo(() => {
    if (!monthlyFullData.length) return null;

    const start = monthlyFullData[0];
    const end = monthlyFullData[monthlyFullData.length - 1];
    const worst = monthlyFullData.reduce((acc, item) => (item.balance < acc.balance ? item : acc));

    return { start, end, worst };
  }, [monthlyFullData]);

  const yearlyProjectionSummary = useMemo(() => {
    if (!yearlyChartData.length) return null;

    const first = yearlyChartData[0];
    const last = yearlyChartData[yearlyChartData.length - 1];
    const worst = yearlyChartData.reduce((acc, item) =>
      item.finalBalance < acc.finalBalance ? item : acc
    );

    return { first, last, worst };
  }, [yearlyChartData]);

  const handleSimulatePurchase = async () => {
    const numericAmount = parseCurrencyToNumber(purchaseAmountDisplay);
    if (!purchaseAmountDisplay || numericAmount <= 0) {
      toast.error('Informe um valor válido');
      return;
    }

    // Mapear método de pagamento para o enum correto
    let paymentMethodEnum: PaymentSource;
    if (paymentMethod === 'cash') {
      paymentMethodEnum = PaymentSource.SAVINGS; // À vista = poupança
    } else if (paymentMethod === 'credit_card') {
      paymentMethodEnum = PaymentSource.CREDIT_CARD;
    } else if (paymentMethod === 'loan' || paymentMethod === 'financing') {
      paymentMethodEnum = PaymentSource.LOAN;
    } else {
      paymentMethodEnum = PaymentSource.OTHER;
    }

    try {
      setSimulating(true);
      const result = await financialService.simulatePurchase(
        numericAmount,
        paymentMethodEnum,
        paymentMethod !== 'cash' ? installments : undefined,
        paymentMethod !== 'cash' && interestRate
          ? parseFloat(interestRate.replace(',', '.'))
          : undefined
      );
      setSimulation(result);
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Erro ao simular compra');
      console.error(error);
    } finally {
      setSimulating(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Resumo de Receitas Fixas e Variáveis */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white rounded-lg shadow p-6 flex flex-col items-center">
          <p className="text-gray-600 text-sm font-medium uppercase tracking-wide">
            Últimas Receitas Fixas
          </p>
          <p className="text-3xl font-bold text-green-600 mt-2">
            {incomeLoading
              ? 'Carregando...'
              : lastFixedIncome !== null
                ? formatCurrency(lastFixedIncome)
                : 'R$ 0,00'}
          </p>
          <p className="text-xs text-gray-500 mt-2">Soma das receitas fixas ativas do mês</p>
        </div>
        <div className="bg-white rounded-lg shadow p-6 flex flex-col items-center">
          <p className="text-gray-600 text-sm font-medium uppercase tracking-wide">
            Média Receita Variável (12 meses)
          </p>
          <p className="text-3xl font-bold text-blue-600 mt-2">
            {incomeLoading
              ? 'Carregando...'
              : variableIncomeAvg !== null
                ? formatCurrency(variableIncomeAvg)
                : 'R$ 0,00'}
          </p>
          <p className="text-xs text-gray-500 mt-2">Média mensal dos últimos 12 meses</p>
        </div>
      </div>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Previsões Financeiras</h1>
          <p className="mt-2 text-sm text-gray-600">
            Análise e projeções financeiras de longo prazo (1 a 20 anos)
          </p>
        </div>
        <button
          onClick={() => setShowSimulator(!showSimulator)}
          className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition"
        >
          <Calculator className="h-5 w-5" />
          Simulador de Compra
        </button>
      </div>

      {/* Simulador de Compra */}
      {showSimulator && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Simulador de Compra</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Valor da Compra
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">
                  R$
                </span>
                <input
                  type="text"
                  value={purchaseAmountDisplay}
                  onChange={(e) => {
                    const formatted = formatCurrencyInput(e.target.value);
                    setPurchaseAmountDisplay(formatted);
                  }}
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg"
                  placeholder="0,00"
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">Digite o valor (ex: 50000 = 50.000,00)</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Forma de Pagamento
              </label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              >
                <option value="cash">À Vista</option>
                <option value="credit_card">Cartão de Crédito</option>
                <option value="loan">Empréstimo</option>
                <option value="financing">Financiamento</option>
              </select>
            </div>
            {paymentMethod !== 'cash' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Parcelas</label>
                  <input
                    type="number"
                    value={installments}
                    onChange={(e) => setInstallments(parseInt(e.target.value) || 1)}
                    min="1"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Taxa de Juros (% ao mês)
                  </label>
                  <input
                    type="number"
                    value={interestRate}
                    onChange={(e) => setInterestRate(e.target.value)}
                    step="0.1"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    placeholder="Ex: 2.5"
                  />
                </div>
              </>
            )}
          </div>
          <button
            onClick={handleSimulatePurchase}
            disabled={simulating}
            className="mt-4 px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
          >
            {simulating ? 'Simulando...' : 'Simular'}
          </button>

          {simulation && (
            <div className="mt-6 p-4 bg-gray-50 rounded-lg">
              <h3 className="font-semibold mb-3">Resultado da Simulação</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-600">Saldo Atual</p>
                  <p className="text-lg font-semibold">
                    {formatCurrency(simulation.current_balance)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Saldo Após Compra</p>
                  <p
                    className={`text-lg font-semibold ${simulation.will_go_negative ? 'text-red-600' : 'text-green-600'}`}
                  >
                    {formatCurrency(simulation.balance_after_purchase)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Impacto no Orçamento</p>
                  <p className="text-lg font-semibold">
                    {simulation.impact_percentage.toFixed(1)}%
                  </p>
                </div>
                {simulation.months_to_recover && (
                  <div>
                    <p className="text-sm text-gray-600">Meses para Recuperar</p>
                    <p className="text-lg font-semibold">{simulation.months_to_recover}</p>
                  </div>
                )}
              </div>
              <div className="mt-4 p-3 bg-white rounded border-l-4 border-primary-500">
                <p className="font-medium">{simulation.recommendation}</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Controles */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex flex-col md:flex-row items-center gap-4">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Anos para Projetar: {years} {years === 1 ? 'ano' : 'anos'}
            </label>
            <input
              type="range"
              min="1"
              max="20"
              value={years}
              onChange={(e) => setYears(parseInt(e.target.value))}
              className="w-full"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Tipo de Salário:</label>
            <select
              value={salaryType}
              onChange={(e) => setSalaryType(e.target.value as 'fixed' | 'total')}
              className="px-3 py-2 border rounded-lg"
              disabled={salaryLoading}
            >
              <option value="fixed">Somente Salário Fixo</option>
              <option value="total">Salário Total (fixo + variável)</option>
            </select>
          </div>
          <button
            onClick={loadPrediction}
            disabled={loading || salaryLoading}
            className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
          >
            {loading || salaryLoading ? 'Carregando...' : 'Atualizar Previsão'}
          </button>
        </div>
      </div>

      {loading && (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
        </div>
      )}

      {prediction && !loading && (
        <>
          {/* Resumo Principal */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Saldo Atual</p>
                  <p className="text-2xl font-bold">{formatCurrency(prediction.current_balance)}</p>
                </div>
                <DollarSign className="h-8 w-8 text-gray-400" />
              </div>
            </div>
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Saldo Final ({years} anos)</p>
                  <p
                    className={`text-2xl font-bold ${prediction.final_balance < 0 ? 'text-red-600' : 'text-green-600'}`}
                  >
                    {formatCurrency(prediction.final_balance)}
                  </p>
                </div>
                <Target className="h-8 w-8 text-gray-400" />
              </div>
            </div>
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Pior Saldo</p>
                  <p className="text-2xl font-bold text-red-600">
                    {formatCurrency(prediction.worst_balance)}
                  </p>
                  {prediction.worst_balance_date && (
                    <p className="text-xs text-gray-500">
                      {format(new Date(prediction.worst_balance_date), 'MMM/yyyy', {
                        locale: ptBR,
                      })}
                    </p>
                  )}
                </div>
                <TrendingDown className="h-8 w-8 text-red-400" />
              </div>
            </div>
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Melhor Saldo</p>
                  <p className="text-2xl font-bold text-green-600">
                    {formatCurrency(prediction.best_balance)}
                  </p>
                  {prediction.best_balance_date && (
                    <p className="text-xs text-gray-500">
                      {format(new Date(prediction.best_balance_date), 'MMM/yyyy', { locale: ptBR })}
                    </p>
                  )}
                </div>
                <TrendingUp className="h-8 w-8 text-green-400" />
              </div>
            </div>
          </div>

          {/* Alertas e Status */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Status Financeiro */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold mb-4">Status Financeiro</h2>
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  {prediction.will_go_negative ? (
                    <XCircle className="h-6 w-6 text-red-500" />
                  ) : (
                    <CheckCircle className="h-6 w-6 text-green-500" />
                  )}
                  <div>
                    <p className="font-medium">
                      {prediction.will_go_negative ? 'Ficará Negativo' : 'Permanece Positivo'}
                    </p>
                    {prediction.first_negative_date && (
                      <p className="text-sm text-gray-600">
                        Primeira data negativa:{' '}
                        {format(new Date(prediction.first_negative_date), 'dd/MM/yyyy', {
                          locale: ptBR,
                        })}
                      </p>
                    )}
                  </div>
                </div>
                {prediction.will_become_positive && prediction.debt_free_date && (
                  <div className="flex items-center gap-3">
                    <CheckCircle className="h-6 w-6 text-green-500" />
                    <div>
                      <p className="font-medium">Ficará Livre de Dívidas</p>
                      <p className="text-sm text-gray-600">
                        Data:{' '}
                        {format(new Date(prediction.debt_free_date), 'dd/MM/yyyy', {
                          locale: ptBR,
                        })}
                        ({prediction.months_to_debt_free} meses)
                      </p>
                    </div>
                  </div>
                )}
                <div className="flex items-center gap-3">
                  <AlertCircle className="h-6 w-6 text-yellow-500" />
                  <div>
                    <p className="font-medium">Meses Negativos</p>
                    <p className="text-sm text-gray-600">{prediction.months_in_negative} meses</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Totais Projetados */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold mb-4">Totais Projetados</h2>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-600">Renda Total:</span>
                  <span className="font-semibold text-green-600">
                    {formatCurrency(prediction.total_income_projected)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Despesas Totais:</span>
                  <span className="font-semibold text-red-600">
                    {formatCurrency(prediction.total_expenses_projected)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Juros Pagos:</span>
                  <span className="font-semibold text-orange-600">
                    {formatCurrency(prediction.total_interest_paid)}
                  </span>
                </div>
                <div className="flex justify-between border-t pt-3">
                  <span className="font-medium">Saldo Líquido:</span>
                  <span
                    className={`font-bold text-lg ${prediction.final_balance < 0 ? 'text-red-600' : 'text-green-600'}`}
                  >
                    {formatCurrency(
                      prediction.total_income_projected -
                        prediction.total_expenses_projected -
                        prediction.total_interest_paid
                    )}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Gráficos */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Gráfico de Projeção Mensal */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold mb-1">Projeção Mensal (Período Completo)</h2>
              <p className="text-xs text-gray-500 mb-4">
                Linha azul mostra o saldo acumulado mês a mês.
              </p>

              {monthlyProjectionSummary && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-4">
                  <div className="rounded-lg bg-gray-50 border border-gray-200 px-3 py-2">
                    <p className="text-[11px] text-gray-500">Saldo inicial</p>
                    <p className="text-sm font-semibold text-gray-900">
                      {formatCurrency(monthlyProjectionSummary.start.balance)}
                    </p>
                  </div>
                  <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2">
                    <p className="text-[11px] text-red-600">Pior mês projetado</p>
                    <p className="text-sm font-semibold text-red-700">
                      {formatCurrency(monthlyProjectionSummary.worst.balance)}
                    </p>
                  </div>
                  <div className="rounded-lg bg-blue-50 border border-blue-200 px-3 py-2">
                    <p className="text-[11px] text-blue-600">Saldo no fim da amostra</p>
                    <p className="text-sm font-semibold text-blue-700">
                      {formatCurrency(monthlyProjectionSummary.end.balance)}
                    </p>
                  </div>
                </div>
              )}

              <ResponsiveContainer width="100%" height={300}>
                <LineChart
                  data={monthlyChartData}
                  margin={{ top: 8, right: 18, left: 10, bottom: 10 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="month"
                    interval="preserveStartEnd"
                    minTickGap={22}
                    tick={{ fontSize: 11 }}
                    tickFormatter={(value: string) => value}
                  />
                  <YAxis
                    tickFormatter={formatAxisCurrency}
                    width={86}
                    tick={{ fontSize: 11 }}
                    tickCount={6}
                  />
                  <Tooltip
                    content={({ active, label, payload }) =>
                      renderPredictionTooltip({
                        active,
                        label,
                        payload: payload as TooltipPayloadItem[] | undefined,
                        labelPrefix: 'Mês',
                      })
                    }
                    allowEscapeViewBox={{ x: true, y: true }}
                  />
                  <Legend />
                  <ReferenceLine y={0} stroke="#9ca3af" strokeDasharray="5 5" />
                  <Line
                    type="monotone"
                    dataKey="balance"
                    stroke="#4f46e5"
                    strokeWidth={2.5}
                    dot={false}
                    activeDot={{ r: 5 }}
                    name="Saldo Acumulado"
                  />
                </LineChart>
              </ResponsiveContainer>
              <div className="mt-3 flex items-start gap-2 text-xs text-gray-600">
                <Info className="h-4 w-4 mt-0.5 text-gray-500" />
                <p>
                  Quando a linha fica abaixo de <strong>R$ 0</strong>, significa que o caixa está
                  negativo naquele período.
                </p>
              </div>
            </div>

            {/* Gráfico Anual */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold mb-2">Evolução do Saldo por Ano</h2>
              <p className="text-xs text-gray-500 mb-3">
                Este gráfico acompanha toda a projeção de {years} {years === 1 ? 'ano' : 'anos'}
              </p>

              {yearlyProjectionSummary && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-4">
                  <div className="rounded-lg bg-gray-50 border border-gray-200 px-3 py-2">
                    <p className="text-[11px] text-gray-500">Primeiro ano</p>
                    <p className="text-sm font-semibold text-gray-900">
                      {formatCurrency(yearlyProjectionSummary.first.finalBalance)}
                    </p>
                  </div>
                  <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2">
                    <p className="text-[11px] text-red-600">Pior saldo anual</p>
                    <p className="text-sm font-semibold text-red-700">
                      {formatCurrency(yearlyProjectionSummary.worst.finalBalance)}
                    </p>
                  </div>
                  <div className="rounded-lg bg-blue-50 border border-blue-200 px-3 py-2">
                    <p className="text-[11px] text-blue-600">Último ano projetado</p>
                    <p className="text-sm font-semibold text-blue-700">
                      {formatCurrency(yearlyProjectionSummary.last.finalBalance)}
                    </p>
                  </div>
                </div>
              )}

              <ResponsiveContainer width="100%" height={300}>
                <LineChart
                  data={yearlyChartData}
                  margin={{ top: 8, right: 18, left: 10, bottom: 10 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="year" tick={{ fontSize: 11 }} minTickGap={18} />
                  <YAxis
                    tickFormatter={formatAxisCurrency}
                    domain={yearlyBalanceDomain}
                    width={86}
                    tick={{ fontSize: 11 }}
                    tickCount={6}
                  />
                  <ReferenceLine y={0} stroke="#9ca3af" strokeDasharray="5 5" />
                  <Tooltip
                    content={({ active, label, payload }) =>
                      renderPredictionTooltip({
                        active,
                        label,
                        payload: payload as TooltipPayloadItem[] | undefined,
                        labelPrefix: 'Ano',
                      })
                    }
                    allowEscapeViewBox={{ x: true, y: true }}
                  />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="finalBalance"
                    stroke="#2563eb"
                    strokeWidth={3}
                    dot={{ r: 3 }}
                    activeDot={{ r: 5 }}
                    name="Saldo Final"
                  />
                  <Line
                    type="monotone"
                    dataKey="net"
                    stroke="#f59e0b"
                    strokeWidth={2}
                    strokeDasharray="6 3"
                    dot={{ r: 2 }}
                    activeDot={{ r: 4 }}
                    name="Resultado Líquido"
                  />
                  {yearlyChartData.length > 8 && (
                    <Brush dataKey="year" height={22} stroke="#94a3b8" />
                  )}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Avisos e Recomendações */}
          {(prediction.warnings.length > 0 || prediction.recommendations.length > 0) && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {prediction.warnings.length > 0 && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
                  <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                    <AlertCircle className="h-6 w-6 text-yellow-600" />
                    Avisos
                  </h2>
                  <ul className="space-y-2">
                    {prediction.warnings.map((warning, idx) => {
                      const formattedWarning = formatTextWithCurrency(warning);
                      return (
                        <li key={idx} className="text-sm text-yellow-800">
                          • {formattedWarning}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
              {prediction.recommendations.length > 0 && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
                  <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                    <Target className="h-6 w-6 text-blue-600" />
                    Recomendações
                  </h2>
                  <ul className="space-y-2">
                    {prediction.recommendations.map((rec, idx) => {
                      const formattedRec = formatTextWithCurrency(rec);
                      return (
                        <li key={idx} className="text-sm text-blue-800">
                          • {formattedRec}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
