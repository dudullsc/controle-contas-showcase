import { formatPhoneNumber, unformatPhoneNumber } from '@/lib/phoneFormatter';

describe('Phone Formatter', () => {
  describe('formatPhoneNumber', () => {
    it('should format phone number correctly', () => {
      expect(formatPhoneNumber('48988593816')).toBe('(48) 9 8859-3816');
    });

    it('should handle partial input', () => {
      expect(formatPhoneNumber('48')).toBe('(48');
      expect(formatPhoneNumber('489')).toBe('(48) 9');
    });

    it('should return empty string for empty input', () => {
      expect(formatPhoneNumber('')).toBe('');
    });

    it('should handle already formatted phone', () => {
      expect(formatPhoneNumber('(48) 9 8859-3816')).toContain('48');
    });
  });

  describe('unformatPhoneNumber', () => {
    it('should remove formatting from phone', () => {
      expect(unformatPhoneNumber('(48) 9 8859-3816')).toBe('48988593816');
    });

    it('should handle already unformatted phone', () => {
      expect(unformatPhoneNumber('48988593816')).toBe('48988593816');
    });

    it('should return empty string for empty input', () => {
      expect(unformatPhoneNumber('')).toBe('');
    });
  });
});
