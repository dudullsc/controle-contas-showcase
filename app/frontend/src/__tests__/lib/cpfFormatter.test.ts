import { validateCPF, formatCPF, unformatCPF, formatCPFInput } from '@/lib/cpfFormatter';

describe('CPF Formatter', () => {
  describe('validateCPF', () => {
    it('should validate correct CPF', () => {
      // CPF válido (exemplo real)
      expect(validateCPF('11144477735')).toBe(true);
    });

    it('should reject invalid CPF', () => {
      expect(validateCPF('11111111111')).toBe(false);
      expect(validateCPF('00000000000')).toBe(false);
      expect(validateCPF('12345678901')).toBe(false);
    });

    it('should reject CPF with wrong length', () => {
      expect(validateCPF('123456')).toBe(false);
      expect(validateCPF('123456789012')).toBe(false);
    });
  });

  describe('formatCPF', () => {
    it('should format CPF correctly', () => {
      expect(formatCPF('11144477735')).toBe('111.444.777-35');
    });

    it('should return empty string for empty input', () => {
      expect(formatCPF('')).toBe('');
    });

    it('should handle partial input', () => {
      expect(formatCPF('111')).toBe('111');
      expect(formatCPF('11144')).toBe('111.44');
    });
  });

  describe('unformatCPF', () => {
    it('should remove formatting', () => {
      expect(unformatCPF('111.444.777-35')).toBe('11144477735');
    });

    it('should handle already unformatted CPF', () => {
      expect(unformatCPF('11144477735')).toBe('11144477735');
    });

    it('should return empty string for empty input', () => {
      expect(unformatCPF('')).toBe('');
    });
  });

  describe('formatCPFInput', () => {
    it('should format CPF as user types', () => {
      expect(formatCPFInput('1')).toBe('1');
      expect(formatCPFInput('11')).toBe('11');
      expect(formatCPFInput('111')).toBe('111');
      expect(formatCPFInput('1114')).toBe('111.4');
      expect(formatCPFInput('11144')).toBe('111.44');
      expect(formatCPFInput('111444')).toBe('111.444');
      expect(formatCPFInput('1114447')).toBe('111.444.7');
      expect(formatCPFInput('11144477')).toBe('111.444.77');
      expect(formatCPFInput('111444777')).toBe('111.444.777');
      expect(formatCPFInput('1114447773')).toBe('111.444.777-3');
      expect(formatCPFInput('11144477735')).toBe('111.444.777-35');
    });
  });
});
