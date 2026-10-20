'use client';

import { useEffect, useMemo, useState } from 'react';

interface BrandLogoProps {
  description: string;
  size?: 'sm' | 'md' | 'lg';
}

interface BrandMatch {
  /** Local asset under /brands, or null for letter avatar only */
  logo: string | null;
  /** Tailwind gradient classes for avatar fallback */
  color: string;
  /** Letter shown in avatar (defaults to first char of description) */
  letter?: string;
}

/**
 * Keywords are matched as case-insensitive substrings.
 * Longer / more specific keys should be listed first where overlap matters.
 */
const BRAND_KEYWORDS: Array<{ keys: string[]; brand: BrandMatch }> = [
  {
    keys: ['nubank', 'nu bank', 'nu credito'],
    brand: { logo: '/brands/nubank.svg', color: 'from-purple-500 to-purple-800', letter: 'N' },
  },
  {
    keys: ['mercado pago', 'mp credito', 'mp emprestimo'],
    brand: { logo: '/brands/mercadopago.svg', color: 'from-sky-400 to-blue-600', letter: 'M' },
  },
  {
    keys: ['shopee', 'shoppe'],
    brand: { logo: '/brands/shopee.svg', color: 'from-orange-400 to-orange-600', letter: 'S' },
  },
  {
    keys: ['banco do brasil'],
    brand: { logo: '/brands/bancodobrasil.svg', color: 'from-yellow-400 to-yellow-600', letter: 'B' },
  },
  {
    keys: ['itau', 'itaú'],
    brand: { logo: '/brands/itau.svg', color: 'from-orange-500 to-orange-700', letter: 'I' },
  },
  {
    keys: ['caixa'],
    brand: { logo: '/brands/caixa.svg', color: 'from-blue-500 to-blue-800', letter: 'C' },
  },
  {
    keys: ['bradesco'],
    brand: { logo: '/brands/bradesco.svg', color: 'from-red-500 to-red-800', letter: 'B' },
  },
  {
    keys: ['santander'],
    brand: { logo: '/brands/santander.svg', color: 'from-red-500 to-red-700', letter: 'S' },
  },
  {
    keys: ['banco inter', 'inter credito', 'inter emprestimo'],
    brand: { logo: '/brands/inter.svg', color: 'from-orange-400 to-orange-600', letter: 'I' },
  },
  // Store / card brands — local bandeiras
  {
    keys: ['estacio', 'estácio'],
    brand: { logo: '/brands/estacio.svg', color: 'from-blue-600 to-indigo-800', letter: 'E' },
  },
  {
    keys: ['pernambucanas', 'pernanbucanas'],
    brand: { logo: '/brands/pernambucanas.svg', color: 'from-red-500 to-red-700', letter: 'P' },
  },
  {
    keys: ['koerich'],
    brand: { logo: '/brands/koerich.svg', color: 'from-red-600 to-red-800', letter: 'K' },
  },
  {
    keys: ['imperatriz'],
    brand: { logo: '/brands/imperatriz.svg', color: 'from-emerald-500 to-emerald-700', letter: 'I' },
  },
  {
    keys: ['atacadão', 'atacadao'],
    brand: { logo: '/brands/atacadao.svg', color: 'from-green-500 to-green-700', letter: 'A' },
  },
  {
    keys: ['senff'],
    brand: { logo: '/brands/senff.svg', color: 'from-blue-900 to-slate-900', letter: 'S' },
  },
  {
    keys: ['unix'],
    brand: { logo: '/brands/unix.svg', color: 'from-gray-400 to-gray-600', letter: 'U' },
  },
  {
    keys: ['celebre'],
    brand: { logo: '/brands/celebre.svg', color: 'from-pink-500 to-pink-700', letter: 'C' },
  },
  {
    keys: ['cartão dm', 'cartao dm'],
    brand: { logo: '/brands/dm.svg', color: 'from-amber-500 to-amber-700', letter: 'D' },
  },
  {
    keys: ['afinz'],
    brand: { logo: '/brands/afinz.svg', color: 'from-purple-500 to-purple-800', letter: 'A' },
  },
  {
    keys: ['carioca'],
    brand: { logo: '/brands/carioca.svg', color: 'from-red-500 to-red-700', letter: 'C' },
  },
  {
    keys: ['torra'],
    brand: { logo: '/brands/torra.svg', color: 'from-rose-500 to-rose-700', letter: 'T' },
  },
  {
    keys: ['vest casa'],
    brand: { logo: '/brands/vestcasa.svg', color: 'from-gray-800 to-black', letter: 'V' },
  },
  {
    keys: ['vuon'],
    brand: { logo: '/brands/vuon.svg', color: 'from-indigo-500 to-indigo-700', letter: 'V' },
  },
  {
    keys: ['cartão +', 'cartao +'],
    brand: { logo: '/brands/cartaomais.svg', color: 'from-cyan-400 to-cyan-600', letter: '+' },
  },
];

const FALLBACK_COLORS = [
  'from-blue-400 to-blue-600',
  'from-purple-400 to-purple-600',
  'from-pink-400 to-pink-600',
  'from-orange-400 to-orange-600',
  'from-green-400 to-green-600',
  'from-indigo-400 to-indigo-600',
  'from-red-400 to-red-600',
  'from-cyan-400 to-cyan-600',
];

const sizeClasses = {
  sm: 'h-5 w-5',
  md: 'h-6 w-6',
  lg: 'h-8 w-8',
};

const sizePx = {
  sm: 20,
  md: 24,
  lg: 32,
};

function resolveBrand(description: string): BrandMatch | null {
  const searchTerm = description.toLowerCase();
  for (const entry of BRAND_KEYWORDS) {
    if (entry.keys.some((key) => searchTerm.includes(key.toLowerCase()))) {
      return entry.brand;
    }
  }
  return null;
}

function Avatar({
  letter,
  color,
  size,
}: {
  letter: string;
  color: string;
  size: 'sm' | 'md' | 'lg';
}) {
  return (
    <div
      className={`${sizeClasses[size]} bg-gradient-to-br ${color} rounded-full flex items-center justify-center text-white text-xs font-bold shadow-md`}
    >
      {letter}
    </div>
  );
}

export default function BrandLogo({ description, size = 'md' }: BrandLogoProps) {
  const brand = useMemo(() => resolveBrand(description), [description]);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [brand?.logo, description]);

  const fallbackColor = useMemo(() => {
    if (brand?.color) return brand.color;
    const hash = description.split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
    return FALLBACK_COLORS[hash % FALLBACK_COLORS.length];
  }, [brand, description]);

  const letter = (brand?.letter || description.charAt(0) || '?').toUpperCase();

  if (!brand?.logo || failed) {
    return <Avatar letter={letter} color={fallbackColor} size={size} />;
  }

  return (
    <div
      className={`${sizeClasses[size]} relative rounded-full overflow-hidden bg-white border border-gray-200 shadow-sm`}
    >
      <img
        src={brand.logo}
        alt={description}
        width={sizePx[size]}
        height={sizePx[size]}
        className="object-cover h-full w-full"
        loading="lazy"
        onError={() => setFailed(true)}
      />
    </div>
  );
}
