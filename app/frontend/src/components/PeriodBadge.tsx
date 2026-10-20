'use client';

import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Calendar } from 'lucide-react';

interface PeriodBadgeProps {
  month: number;
  year: number;
  showIcon?: boolean;
}

export default function PeriodBadge({ month, year, showIcon = true }: PeriodBadgeProps) {
  const date = new Date(year, month - 1, 1);
  const monthName = format(date, 'MMMM', { locale: ptBR });
  const capitalizedMonth = monthName.charAt(0).toUpperCase() + monthName.slice(1);

  return (
    <div className="inline-flex items-center gap-2 bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-xl px-4 py-2 shadow-sm">
      {showIcon && <Calendar className="h-4 w-4 text-blue-600" />}
      <span className="text-sm font-bold text-blue-900">
        {capitalizedMonth} de {year}
      </span>
    </div>
  );
}
