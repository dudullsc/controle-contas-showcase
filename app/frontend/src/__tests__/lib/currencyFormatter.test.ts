/**
 * Testes para Formatadores de Moeda
 */
describe('Currency Formatting', () => {
  const formatCurrency = (value: number): string => {
    return new Intl.NumberFormat('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  };

  describe('formatCurrency', () => {
    it('should format currency correctly', () => {
      expect(formatCurrency(1000)).toBe('1.000,00');
      expect(formatCurrency(100)).toBe('100,00');
      expect(formatCurrency(1000.5)).toBe('1.000,50');
    });

    it('should handle zero', () => {
      expect(formatCurrency(0)).toBe('0,00');
    });

    it('should handle negative values', () => {
      expect(formatCurrency(-1000)).toBe('-1.000,00');
    });

    it('should handle decimals', () => {
      expect(formatCurrency(1000.99)).toBe('1.000,99');
      expect(formatCurrency(100.01)).toBe('100,01');
    });
  });

  describe('parseCurrencyToNumber', () => {
    const parseCurrencyToNumber = (value: string): number => {
      const numericValue = value.replace(/\D/g, '');
      return Number(numericValue) / 100;
    };

    it('should parse formatted currency to number', () => {
      expect(parseCurrencyToNumber('1.000,00')).toBe(1000);
      expect(parseCurrencyToNumber('100,50')).toBe(100.5);
      expect(parseCurrencyToNumber('1.000,99')).toBe(1000.99);
    });

    it('should handle empty string', () => {
      expect(parseCurrencyToNumber('')).toBe(0);
    });
  });
});
