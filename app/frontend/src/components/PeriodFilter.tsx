'use client';

import { useState, useRef, useEffect } from 'react';
import { Calendar, X } from 'lucide-react';
import { format } from 'date-fns';

interface PeriodFilterProps {
  selectedMonth: number;
  selectedYear: number;
  onPeriodChange: (month: number, year: number) => void;
}

const MONTHS = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
];

export default function PeriodFilter({
  selectedMonth,
  selectedYear,
  onPeriodChange,
}: PeriodFilterProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [viewMonth, setViewMonth] = useState(selectedMonth);
  const [viewYear, setViewYear] = useState(selectedYear);
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  useEffect(() => {
    setViewMonth(selectedMonth);
    setViewYear(selectedYear);
  }, [selectedMonth, selectedYear]);

  const handleMonthSelect = (month: number) => {
    setViewMonth(month);
  };

  const handleYearChange = (year: number) => {
    setViewYear(year);
  };

  const handleQuickSelect = (type: string) => {
    const today = new Date();
    let month = today.getMonth() + 1;
    let year = today.getFullYear();

    switch (type) {
      case 'today':
      case 'thisMonth':
        break;
      case 'lastMonth':
        const lastMonth = new Date(today);
        lastMonth.setMonth(today.getMonth() - 1);
        month = lastMonth.getMonth() + 1;
        year = lastMonth.getFullYear();
        break;
      case 'nextMonth':
        const nextMonth = new Date(today);
        nextMonth.setMonth(today.getMonth() + 1);
        month = nextMonth.getMonth() + 1;
        year = nextMonth.getFullYear();
        break;
      case 'thisYear':
        month = 1;
        year = today.getFullYear();
        break;
      case 'lastYear':
        month = 1;
        year = today.getFullYear() - 1;
        break;
    }

    onPeriodChange(month, year);
    setIsOpen(false);
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-2 rounded-xl bg-gradient-to-r from-primary-600 to-primary-700 px-3 py-2 md:px-5 md:py-2.5 text-xs md:text-sm font-medium text-white hover:from-primary-700 hover:to-primary-800 shadow-lg hover:shadow-xl transition-all duration-200"
      >
        <Calendar className="h-4 w-4 md:h-5 md:w-5" />
        <span className="hidden sm:inline">Filtrar por Período</span>
        <span className="sm:hidden">Filtro</span>
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40 backdrop-blur-sm">
          <div
            ref={modalRef}
            className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden"
          >
            <div className="flex items-center justify-between bg-gradient-to-r from-primary-600 to-primary-700 px-6 py-4">
              <h3 className="text-lg font-bold text-white">Selecionar Período</h3>
              <button
                onClick={() => setIsOpen(false)}
                className="text-white hover:bg-white/20 rounded-lg p-1 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {/* Período Selecionado */}
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-4 border border-blue-200">
                <p className="text-xs font-semibold text-gray-600 mb-1">PERÍODO ATUAL</p>
                <p className="text-lg font-bold text-gray-900">
                  {MONTHS[selectedMonth - 1]} / {selectedYear}
                </p>
                <p className="text-xs font-semibold text-gray-600 mt-2">PERÍODO SELECIONADO</p>
                <p className="text-lg font-bold text-primary-600">
                  {MONTHS[viewMonth - 1]} / {viewYear}
                </p>
              </div>

              {/* Atalhos Rápidos */}
              <div className="space-y-2">
                <p className="text-xs font-semibold text-gray-600 mb-2">ATALHOS RÁPIDOS</p>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => handleQuickSelect('thisMonth')}
                    className="px-4 py-2.5 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-700 rounded-lg transition-colors border border-gray-200 font-medium"
                  >
                    Este mês
                  </button>
                  <button
                    onClick={() => handleQuickSelect('lastMonth')}
                    className="px-4 py-2.5 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-700 rounded-lg transition-colors border border-gray-200 font-medium"
                  >
                    Mês passado
                  </button>
                  <button
                    onClick={() => handleQuickSelect('thisYear')}
                    className="px-4 py-2.5 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-700 rounded-lg transition-colors border border-gray-200 font-medium"
                  >
                    Este ano
                  </button>
                  <button
                    onClick={() => handleQuickSelect('lastYear')}
                    className="px-4 py-2.5 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-700 rounded-lg transition-colors border border-gray-200 font-medium"
                  >
                    Ano passado
                  </button>
                </div>
              </div>

              {/* Seletor de Ano */}
              <div>
                <p className="text-xs font-semibold text-gray-600 mb-2">SELECIONAR ANO</p>
                <div className="flex items-center justify-between bg-gray-50 rounded-lg p-3 border border-gray-200">
                  <button
                    onClick={() => handleYearChange(viewYear - 1)}
                    className="p-2 hover:bg-white rounded-lg transition-colors text-gray-700 font-bold"
                  >
                    ←
                  </button>
                  <span className="text-xl font-bold text-gray-900">{viewYear}</span>
                  <button
                    onClick={() => handleYearChange(viewYear + 1)}
                    className="p-2 hover:bg-white rounded-lg transition-colors text-gray-700 font-bold"
                  >
                    →
                  </button>
                </div>
              </div>

              {/* Seletor de Mês */}
              <div>
                <p className="text-xs font-semibold text-gray-600 mb-2">SELECIONAR MÊS</p>
                <div className="grid grid-cols-3 gap-2">
                  {MONTHS.map((month, index) => {
                    const monthNumber = index + 1;
                    const isSelected = monthNumber === selectedMonth && viewYear === selectedYear;
                    const isCurrentMonth =
                      monthNumber === new Date().getMonth() + 1 &&
                      viewYear === new Date().getFullYear();

                    return (
                      <button
                        key={month}
                        onClick={() => handleMonthSelect(monthNumber)}
                        className={`
                          px-3 py-2.5 text-sm rounded-lg font-medium transition-all
                          ${
                            isSelected
                              ? 'bg-primary-600 text-white shadow-md'
                              : isCurrentMonth
                                ? 'bg-blue-100 text-blue-900 hover:bg-blue-200'
                                : 'bg-gray-50 text-gray-700 hover:bg-gray-100 border border-gray-200'
                          }
                        `}
                      >
                        {month.substring(0, 3)}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Botões de Ação */}
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => {
                    const today = new Date();
                    onPeriodChange(today.getMonth() + 1, today.getFullYear());
                    setIsOpen(false);
                  }}
                  className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors border border-gray-300"
                >
                  Resetar
                </button>
                <button
                  onClick={() => {
                    onPeriodChange(viewMonth, viewYear);
                    setIsOpen(false);
                  }}
                  className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-gradient-to-r from-primary-600 to-primary-700 hover:from-primary-700 hover:to-primary-800 rounded-lg shadow-md transition-all"
                >
                  Aplicar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
