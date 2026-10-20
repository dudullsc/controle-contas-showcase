/**
 * Formata número de telefone brasileiro
 * Suporta: 11 dígitos (DDD + número) ou 13 dígitos (55 + DDD + número)
 * Exemplo: 48988593816 -> (48) 98859-3816
 * Exemplo: 5548988593816 -> (48) 98859-3816
 */
export function formatPhoneNumber(value: string): string {
  // Remove tudo que não é número
  let numbers = value.replace(/\D/g, '');

  // Remove código de país (55) se presente no início
  if (numbers.startsWith('55') && numbers.length >= 12) {
    numbers = numbers.substring(2);
  }

  // Limita a 11 dígitos (DDD + 9 dígitos)
  const limitedNumbers = numbers.slice(0, 11);

  // Aplica a máscara
  if (limitedNumbers.length <= 2) {
    return limitedNumbers ? `(${limitedNumbers}` : '';
  } else if (limitedNumbers.length <= 7) {
    return `(${limitedNumbers.slice(0, 2)}) ${limitedNumbers.slice(2)}`;
  } else if (limitedNumbers.length <= 10) {
    return `(${limitedNumbers.slice(0, 2)}) ${limitedNumbers.slice(2, 6)}-${limitedNumbers.slice(6)}`;
  } else {
    return `(${limitedNumbers.slice(0, 2)}) ${limitedNumbers.slice(2, 3)} ${limitedNumbers.slice(3, 7)}-${limitedNumbers.slice(7)}`;
  }
}

/**
 * Remove formatação do telefone, retornando apenas dígitos (sem código de país)
 * Para enviar ao backend, que irá adicionar o código 55
 *
 * Exemplo: "(48) 98859-3816" -> "48988593816"
 * Exemplo: "5548988593816" -> "48988593816"
 */
export function unformatPhoneNumber(value: string): string {
  // Remove tudo que não é número
  let numbers = value.replace(/\D/g, '');

  // Remove código de país (55) se presente no início
  if (numbers.startsWith('55') && numbers.length >= 12) {
    numbers = numbers.substring(2);
  }

  return numbers;
}

/**
 * Valida se o telefone tem o tamanho mínimo (11 dígitos sem o código de país)
 */
export function isValidPhoneLength(value: string): boolean {
  const numbers = unformatPhoneNumber(value);
  return numbers.length >= 10 && numbers.length <= 11;
}
