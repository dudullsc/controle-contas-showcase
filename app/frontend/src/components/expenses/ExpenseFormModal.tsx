'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import {
  Loader2,
  Tag,
  FileText,
  Calendar,
  Folder,
  X,
  Check,
  StickyNote,
  CreditCard,
} from 'lucide-react';
import { Expense, ExpenseCreate } from '@/types';
import { PREDEFINED_CATEGORIES, DESCRIPTION_SUGGESTIONS } from '@/lib/categoryUtils';
import ProgressBar from '@/components/expenses/ProgressBar';

const INVESTMENT_TYPES = [
  'Renda Fixa',
  'Tesouro Direto',
  'Fundos Imobiliários',
  'Ações',
  'Cripto',
  'Poupança',
  'Outro',
];

interface ExpenseFormModalProps {
  isOpen: boolean;
  editingExpense: Expense | null;
  isSubmitting: boolean;
  installmentProgress: { current: number; total: number };
  onSubmit: (data: ExpenseCreate, category: string) => Promise<boolean | void>;
  onCancel: () => void;
}

const fieldLabelClass =
  'flex items-center gap-1.5 text-xs font-medium text-gray-500 mb-1.5';
const fieldInputClass =
  'w-full rounded-xl border border-gray-200 bg-white shadow-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-100 transition-all py-2.5 px-3 text-sm text-gray-900 disabled:opacity-60';

export default function ExpenseFormModal({
  isOpen,
  editingExpense,
  isSubmitting,
  installmentProgress,
  onSubmit,
  onCancel,
}: ExpenseFormModalProps) {
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<ExpenseCreate>();

  const [amountValue, setAmountValue] = useState<string>('');
  const [amountError, setAmountError] = useState<string>('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isRecurring, setIsRecurring] = useState(false);
  const [installments, setInstallments] = useState(1);
  const [installmentsInput, setInstallmentsInput] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('Carro');
  const [customCategory, setCustomCategory] = useState<string>('');

  useEffect(() => {
    if (editingExpense && isOpen) {
      setValue('description', editingExpense.description);
      setValue('amount', editingExpense.amount);
      setValue('due_date', editingExpense.due_date.split('T')[0]);
      setValue('status', editingExpense.status);
      setValue('notes', editingExpense.notes || '');

      const formattedAmount = new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL',
      }).format(editingExpense.amount);
      setAmountValue(formattedAmount);

      if (editingExpense.category && PREDEFINED_CATEGORIES.includes(editingExpense.category)) {
        setSelectedCategory(editingExpense.category);
        setCustomCategory('');
      } else if (editingExpense.category) {
        setSelectedCategory('Outra');
        setCustomCategory(editingExpense.category);
      }
      if (editingExpense.category === 'Investimento') {
        setValue('investment_type', editingExpense.investment_type || '');
      } else {
        setValue('investment_type', '');
      }

      setIsRecurring(false);
      setInstallments(1);
    } else if (!editingExpense && isOpen) {
      reset();
      setAmountValue('');
      setAmountError('');
      setIsRecurring(false);
      setInstallments(1);
      setSelectedCategory('Carro');
      setCustomCategory('');
      setValue('investment_type', '');
      setValue('status', 'EM ABERTO' as any);
    }
  }, [editingExpense, isOpen, setValue, reset]);

  useEffect(() => {
    if (!isOpen) return;
    const html = document.documentElement;
    const originalHtmlOverflow = html.style.overflow;
    const originalBodyOverflow = document.body.style.overflow;
    html.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
    return () => {
      html.style.overflow = originalHtmlOverflow;
      document.body.style.overflow = originalBodyOverflow;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const formatCurrencyInput = (value: string) => {
    const numericValue = value.replace(/\D/g, '');
    const numberValue = Number(numericValue) / 100;
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(numberValue);
  };

  const parseCurrencyToNumber = (value: string): number => {
    const numericValue = value.replace(/\D/g, '');
    return Number(numericValue) / 100;
  };

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatCurrencyInput(e.target.value);
    setAmountValue(formatted);
    setValue('amount', parseCurrencyToNumber(formatted));
    if (amountError) setAmountError('');
  };

  const handleFormSubmit = async (data: ExpenseCreate) => {
    const amount = parseCurrencyToNumber(amountValue);
    if (!amount || amount <= 0) {
      setAmountError('Informe um valor maior que zero');
      return;
    }

    const categoryToSave = selectedCategory === 'Outra' ? customCategory : selectedCategory;
    const installmentsToSave = isRecurring ? (installments >= 2 ? installments : 2) : 1;
    const investmentTypeToSave =
      categoryToSave === 'Investimento' ? data.investment_type : undefined;
    const dataWithMetadata = {
      ...data,
      amount,
      investment_type: investmentTypeToSave,
      isRecurring,
      installments: installmentsToSave,
    };
    const saved = await onSubmit(dataWithMetadata, categoryToSave);
    if (saved === false) return;

    reset();
    setAmountValue('');
    setAmountError('');
    setIsRecurring(false);
    setInstallments(1);
    setInstallmentsInput('');
    setSelectedCategory('Carro');
    setCustomCategory('');
    setValue('investment_type', '');
  };

  const handleCancel = () => {
    reset();
    setAmountValue('');
    setAmountError('');
    setIsRecurring(false);
    setInstallments(1);
    setInstallmentsInput('');
    setSelectedCategory('Carro');
    setCustomCategory('');
    setValue('investment_type', '');
    onCancel();
  };

  const installmentsLabel = installments >= 2 ? installments : 2;

  const installmentMatch = editingExpense?.description?.match(/\((\d+)\/(\d+)\)/);
  const currentInstallment =
    editingExpense?.installment_number ??
    (installmentMatch ? parseInt(installmentMatch[1], 10) : null);
  const totalInstallments =
    editingExpense?.installment_total ??
    editingExpense?.installments ??
    (installmentMatch ? parseInt(installmentMatch[2], 10) : null);
  const hasEditInstallments = !!(
    editingExpense &&
    totalInstallments &&
    totalInstallments > 1 &&
    currentInstallment
  );
  const installmentPct =
    hasEditInstallments && currentInstallment && totalInstallments
      ? Math.round((currentInstallment / totalInstallments) * 100)
      : 0;

  const submitLabel = editingExpense
    ? 'Atualizar Despesa'
    : isRecurring
      ? `Criar ${installmentsLabel} Parcelas`
      : 'Criar Despesa';

  return (
    <div className="fixed inset-0 z-50 overflow-hidden" data-testid="expense-form-modal">
      <div className="flex h-[100dvh] items-end justify-center lg:items-center p-0 lg:p-4">
        <div
          className="fixed inset-0 bg-gray-900/50 transition-opacity backdrop-blur-[2px]"
          onClick={() => !isSubmitting && handleCancel()}
          aria-hidden
        />

        <div className="relative bg-white rounded-t-3xl lg:rounded-2xl shadow-2xl w-full max-w-none lg:max-w-lg max-h-[92dvh] lg:max-h-[85vh] overflow-y-auto overscroll-contain pb-[env(safe-area-inset-bottom)]">
          {isSubmitting && (
            <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-white/90 rounded-t-3xl lg:rounded-2xl backdrop-blur-sm">
              <Loader2 className="h-12 w-12 text-primary-600 animate-spin mb-4" />
              <h3 className="text-lg font-bold text-gray-800">
                {isRecurring && installmentsLabel > 1
                  ? 'Criando parcelas...'
                  : 'Salvando despesa...'}
              </h3>
              {isRecurring && installmentsLabel > 1 && (
                <p className="text-sm text-gray-600 mt-2">
                  Criando parcela{' '}
                  <span className="font-bold text-primary-700">{installmentProgress.current}</span>{' '}
                  de <span className="font-bold">{installmentProgress.total}</span>
                </p>
              )}
              <p className="text-xs text-gray-400 mt-4">Por favor, não feche esta janela.</p>
            </div>
          )}

          {/* Handle (mobile / tablet sheet) */}
          <div className="flex justify-center pt-3 pb-1 lg:hidden">
            <div className="h-1 w-10 rounded-full bg-gray-300" aria-hidden />
          </div>

          <div className="px-5 pt-2 pb-1 lg:pt-5">
            <h3 className="flex items-center gap-2 text-lg font-bold text-gray-900">
              <Tag className="h-5 w-5 text-violet-600" />
              {editingExpense ? 'Editar Despesa' : 'Nova Despesa'}
            </h3>
          </div>

          <form onSubmit={handleSubmit(handleFormSubmit)} className="px-5 py-4 space-y-5">
            {/* Valor em destaque */}
            <div>
              <label className={fieldLabelClass}>
                <span aria-hidden>💰</span>
                Valor
              </label>
              <input
                type="text"
                inputMode="numeric"
                value={amountValue}
                onChange={handleAmountChange}
                disabled={isSubmitting}
                aria-label="Valor"
                className="w-full border-0 bg-transparent p-0 text-3xl sm:text-4xl font-bold text-primary-600 focus:ring-0 focus:outline-none placeholder:text-primary-300"
                placeholder="R$ 0,00"
              />
              {(amountError || errors.amount) && (
                <p className="mt-1 text-sm text-red-600">
                  {amountError || errors.amount?.message}
                </p>
              )}

              {hasEditInstallments && currentInstallment && totalInstallments ? (
                <div className="mt-3 space-y-1.5">
                  <p className="text-sm font-semibold text-gray-800">
                    Parcela {currentInstallment} de {totalInstallments} ({installmentPct}%)
                  </p>
                  <ProgressBar
                    current={currentInstallment}
                    total={totalInstallments}
                    size="md"
                    color="blue"
                  />
                </div>
              ) : null}

              {!editingExpense && isRecurring && installmentsLabel >= 2 ? (
                <div className="mt-3 space-y-1.5">
                  <p className="text-sm font-semibold text-gray-800">
                    {installmentsLabel} parcelas previstas
                  </p>
                  <ProgressBar current={1} total={installmentsLabel} size="md" color="blue" />
                </div>
              ) : null}
            </div>

            {/* Descrição */}
            <div className="relative">
              <label className={fieldLabelClass}>
                <FileText className="h-3.5 w-3.5" />
                Descrição
              </label>
              <input
                type="text"
                {...register('description', { required: 'Descrição é obrigatória' })}
                className={fieldInputClass}
                placeholder="Ex: Prestação do carro"
                autoComplete="off"
                disabled={isSubmitting}
                onFocus={() => setShowSuggestions(true)}
                onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                onChange={(e) => {
                  setValue('description', e.target.value);
                  setShowSuggestions(true);
                }}
              />
              {showSuggestions && (watch('description') || '').length > 0 && (
                <ul className="absolute z-10 w-full bg-white border border-gray-200 rounded-xl shadow-xl mt-1 max-h-40 overflow-y-auto">
                  {DESCRIPTION_SUGGESTIONS.filter((s) =>
                    s.toLowerCase().includes((watch('description') || '').toLowerCase())
                  ).map((suggestion) => (
                    <li
                      key={suggestion}
                      className="px-3 py-2.5 cursor-pointer hover:bg-primary-50 text-sm text-gray-700 border-b border-gray-50 last:border-0"
                      onMouseDown={() => {
                        setValue('description', suggestion);
                        setShowSuggestions(false);
                      }}
                    >
                      {suggestion}
                    </li>
                  ))}
                </ul>
              )}
              {errors.description && (
                <p className="mt-1 text-sm text-red-600">{errors.description.message}</p>
              )}
            </div>

            {/* Vencimento + Categoria */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={fieldLabelClass}>
                  <Calendar className="h-3.5 w-3.5" />
                  Vencimento
                </label>
                <input
                  type="date"
                  disabled={isSubmitting}
                  {...register('due_date', { required: 'Data é obrigatória' })}
                  onClick={(e) => e.currentTarget.showPicker && e.currentTarget.showPicker()}
                  className={`${fieldInputClass} cursor-pointer`}
                />
                {errors.due_date && (
                  <p className="mt-1 text-xs text-red-600">{errors.due_date.message}</p>
                )}
              </div>

              <div>
                <label className={fieldLabelClass}>
                  <Folder className="h-3.5 w-3.5" />
                  Categoria
                </label>
                <select
                  value={selectedCategory}
                  disabled={isSubmitting}
                  onChange={(e) => {
                    setSelectedCategory(e.target.value);
                    if (e.target.value !== 'Outra') setCustomCategory('');
                    if (e.target.value !== 'Investimento') {
                      setValue('investment_type', '');
                    }
                  }}
                  className={fieldInputClass}
                >
                  {PREDEFINED_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {selectedCategory === 'Outra' && (
              <div>
                <label className={fieldLabelClass}>Digite a Categoria</label>
                <input
                  type="text"
                  value={customCategory}
                  disabled={isSubmitting}
                  onChange={(e) => setCustomCategory(e.target.value)}
                  placeholder="Ex: Combustível, Lazer..."
                  className={fieldInputClass}
                  required
                />
              </div>
            )}

            {selectedCategory === 'Investimento' && (
              <div>
                <label className={fieldLabelClass}>Tipo de Investimento</label>
                <select
                  {...register('investment_type', {
                    validate: (value) =>
                      selectedCategory !== 'Investimento' ||
                      !!value ||
                      'Selecione o tipo de investimento',
                  })}
                  disabled={isSubmitting}
                  className={fieldInputClass}
                  defaultValue=""
                >
                  <option value="" disabled>
                    Selecione
                  </option>
                  {INVESTMENT_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
                {errors.investment_type && (
                  <p className="mt-1 text-sm text-red-600">{errors.investment_type.message}</p>
                )}
              </div>
            )}

            {/* Status — só em nova despesa */}
            {!editingExpense && (
              <div>
                <label className={fieldLabelClass}>
                  <Tag className="h-3.5 w-3.5" />
                  Status
                </label>
                <select
                  {...register('status', { required: 'Status é obrigatório' })}
                  disabled={isSubmitting}
                  className={fieldInputClass}
                  defaultValue="EM ABERTO"
                >
                  <option value="EM ABERTO">Em Aberto</option>
                  <option value="PAGO">Pago</option>
                  <option value="NÃO PAGO">Não Pago</option>
                </select>
              </div>
            )}

            {/* Parcelas */}
            {!editingExpense && (
              <div className="rounded-2xl border border-primary-100 bg-primary-50/60 p-4 space-y-3">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isRecurring}
                    disabled={isSubmitting}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      setIsRecurring(checked);
                      if (checked) {
                        setInstallments(2);
                        setInstallmentsInput('');
                      } else {
                        setInstallments(1);
                        setInstallmentsInput('');
                      }
                    }}
                    className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                  />
                  <span className="flex items-center gap-2 text-sm font-semibold text-primary-800">
                    <CreditCard className="h-4 w-4" />
                    Despesa Parcelada / Recorrente
                  </span>
                </label>

                {isRecurring && (
                  <div className="space-y-2 pt-2 border-t border-primary-100">
                    <label className={fieldLabelClass}>Número de Parcelas</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={installmentsInput}
                      disabled={isSubmitting}
                      onChange={(e) => {
                        const value = e.target.value.replace(/\D/g, '');
                        setInstallmentsInput(value);
                        if (value === '') {
                          setInstallments(0);
                        } else {
                          setInstallments(Math.min(60, Math.max(2, Number(value))));
                        }
                      }}
                      onBlur={() => {
                        if (installmentsInput === '') setInstallments(2);
                      }}
                      className={`${fieldInputClass} w-28 text-center font-bold text-primary-700`}
                      placeholder="12"
                    />
                    <p className="text-xs text-primary-700">
                      Serão criadas <strong>{installmentsLabel}</strong> despesas mensais a partir
                      da data de vencimento.
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Observações */}
            <div>
              <label className={fieldLabelClass}>
                <StickyNote className="h-3.5 w-3.5" />
                Observações{' '}
                <span className="text-gray-400 font-normal">(opcional)</span>
              </label>
              <textarea
                {...register('notes')}
                rows={2}
                disabled={isSubmitting}
                className={`${fieldInputClass} resize-none`}
                placeholder="Anotações adicionais..."
              />
            </div>

            {/* Ações */}
            <div className="grid grid-cols-2 gap-3 pt-2 pb-2">
              <button
                type="button"
                disabled={isSubmitting}
                onClick={handleCancel}
                className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-gray-100 px-4 py-3.5 text-sm font-semibold text-gray-700 hover:bg-gray-200 transition-colors disabled:opacity-50"
              >
                <X className="h-4 w-4" />
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-primary-600 px-4 py-3.5 text-sm font-semibold text-white hover:bg-primary-700 shadow-sm transition-colors disabled:opacity-70"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Processando...
                  </>
                ) : (
                  <>
                    <Check className="h-4 w-4" />
                    {submitLabel}
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
