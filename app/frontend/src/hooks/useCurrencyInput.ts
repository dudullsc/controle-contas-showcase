import { useState, useCallback } from 'react';

interface CurrencyInputReturn {
  value: string;
  numericValue: number;
  handleChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  setValue: (value: string) => void;
  reset: () => void;
}

/**
 * Hook para gerenciar input de moeda formatado
 * @param initialValue - Valor inicial em string formatada (opcional)
 * @returns Objeto com valor formatado, valor numérico e handlers
 */
export function useCurrencyInput(initialValue: string = ''): CurrencyInputReturn {
  const [value, setValue] = useState<string>(initialValue);

  const formatCurrency = useCallback((inputValue: string): string => {
    const numericValue = inputValue.replace(/\D/g, '');
    const numberValue = Number(numericValue) / 100;
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(numberValue);
  }, []);

  const parseCurrencyToNumber = useCallback((inputValue: string): number => {
    const numericValue = inputValue.replace(/\D/g, '');
    return Number(numericValue) / 100;
  }, []);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const formatted = formatCurrency(e.target.value);
      setValue(formatted);
    },
    [formatCurrency]
  );

  const reset = useCallback(() => {
    setValue('');
  }, []);

  const setValueFormatted = useCallback((newValue: string) => {
    setValue(newValue);
  }, []);

  return {
    value,
    numericValue: parseCurrencyToNumber(value),
    handleChange,
    setValue: setValueFormatted,
    reset,
  };
}
