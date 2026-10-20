// Categorias predefinidas para despesas
export const PREDEFINED_CATEGORIES = [
  'Alimentação',
  'Moradia',
  'Transporte',
  'Saúde',
  'Lazer',
  'Educação',
  'Outra',
  'Carro',
  'Moto',
  'Cartão de Crédito',
  'Empréstimo',
  'Investimento',
];

// Sugestões de descrição para despesas
export const DESCRIPTION_SUGGESTIONS = [
  'Shoppe Credito',
  'Shoppe Emprestimo',
  'MP Credito',
  'MP Emprestimo',
  'Nu Bank Credito',
  'Nubank Emprestimo',
  'Banco Do Brasil Emprestimo',
  'Banco do Brasil Credito',
  'Caixa Economica Credito',
  'Caixa Economica Emprestimo',
  'Itau Credito',
  'Itau Emprestimo',
  'Koerich',
  'Pernanbucanas',
  'Estacio de Sá',
  'Cartão +',
  'Cartão Atacadão',
  'Cartao Imperatriz',
  'Cartao Senff',
  'Cartao Unix',
  'Cartão celebre',
  'Cartão dm',
  'Cartão Afinz',
  'Cartao Carioca',
  'Cartao Torra',
  'Cartao vest casa',
  'cartao Vuon Card',
];

/**
 * Retorna as classes CSS de estilo para uma categoria específica
 * @param category - Nome da categoria
 * @returns Classes CSS para badge da categoria
 */
export function getCategoryStyle(category: string): string {
  const cat = category.toLowerCase();

  if (cat.includes('empréstimo') || cat.includes('emprestimo')) {
    return 'bg-red-100 text-red-800 border border-red-200';
  }

  if (
    cat.includes('cartão') ||
    cat.includes('cartao') ||
    cat.includes('credito') ||
    cat.includes('crédito')
  ) {
    return 'bg-purple-100 text-purple-800 border border-purple-200';
  }

  if (
    cat.includes('carro') ||
    cat.includes('moto') ||
    cat.includes('transporte') ||
    cat.includes('uber') ||
    cat.includes('combustivel')
  ) {
    return 'bg-blue-100 text-blue-800 border border-blue-200';
  }

  if (
    cat.includes('casa') ||
    cat.includes('moradia') ||
    cat.includes('aluguel') ||
    cat.includes('luz') ||
    cat.includes('agua')
  ) {
    return 'bg-emerald-100 text-emerald-800 border border-emerald-200';
  }

  if (
    cat.includes('faculdade') ||
    cat.includes('curso') ||
    cat.includes('escola') ||
    cat.includes('educação')
  ) {
    return 'bg-cyan-100 text-cyan-800 border border-cyan-200';
  }

  if (
    cat.includes('alimentação') ||
    cat.includes('mercado') ||
    cat.includes('restaurante') ||
    cat.includes('ifood')
  ) {
    return 'bg-orange-100 text-orange-800 border border-orange-200';
  }

  if (
    cat.includes('saúde') ||
    cat.includes('medico') ||
    cat.includes('remédio') ||
    cat.includes('farmacia')
  ) {
    return 'bg-rose-100 text-rose-800 border border-rose-200';
  }

  if (cat.includes('invest')) {
    return 'bg-amber-100 text-amber-800 border border-amber-200';
  }

  if (cat.includes('estudo') || cat.includes('faculdade') || cat.includes('universidade')) {
    return 'bg-sky-100 text-sky-800 border border-sky-200';
  }

  return 'bg-gray-100 text-gray-700 border border-gray-200';
}
