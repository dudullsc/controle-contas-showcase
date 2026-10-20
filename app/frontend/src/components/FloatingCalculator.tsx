'use client';

import { useState, useRef } from 'react';
import { X, Calculator as CalcIcon } from 'lucide-react';

export default function FloatingCalculator() {
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState({ x: 20, y: 20 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [display, setDisplay] = useState('0');
  const [previousValue, setPreviousValue] = useState<string | null>(null);
  const [operation, setOperation] = useState<string | null>(null);
  const [isNewNumber, setIsNewNumber] = useState(true);
  const [isScientific, setIsScientific] = useState(false);
  const dragRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button')) return;
    setIsDragging(true);
    setDragOffset({
      x: e.clientX - position.x,
      y: e.clientY - position.y,
    });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setPosition({
      x: e.clientX - dragOffset.x,
      y: e.clientY - dragOffset.y,
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleNumber = (num: string) => {
    if (isNewNumber) {
      setDisplay(num);
      setIsNewNumber(false);
    } else {
      setDisplay(display === '0' ? num : display + num);
    }
  };

  const handleDecimal = () => {
    if (isNewNumber) {
      setDisplay('0.');
      setIsNewNumber(false);
    } else if (!display.includes('.')) {
      setDisplay(display + '.');
    }
  };

  const handleOperation = (op: string) => {
    const current = parseFloat(display);

    if (previousValue === null) {
      setPreviousValue(display);
    } else if (operation) {
      const result = calculate(parseFloat(previousValue), current, operation);
      setDisplay(String(result));
      setPreviousValue(String(result));
    }

    setOperation(op);
    setIsNewNumber(true);
  };

  const calculate = (a: number, b: number, op: string): number => {
    switch (op) {
      case '+':
        return a + b;
      case '-':
        return a - b;
      case '×':
        return a * b;
      case '÷':
        return b !== 0 ? a / b : 0;
      case '%':
        return a % b;
      case '^':
        return Math.pow(a, b);
      default:
        return b;
    }
  };

  const handleEquals = () => {
    if (operation && previousValue !== null) {
      const result = calculate(parseFloat(previousValue), parseFloat(display), operation);
      setDisplay(String(result));
      setPreviousValue(null);
      setOperation(null);
      setIsNewNumber(true);
    }
  };

  const handleClear = () => {
    setDisplay('0');
    setPreviousValue(null);
    setOperation(null);
    setIsNewNumber(true);
  };

  const handleBackspace = () => {
    if (display.length > 1) {
      setDisplay(display.slice(0, -1));
    } else {
      setDisplay('0');
      setIsNewNumber(true);
    }
  };

  const handleScientific = (func: string) => {
    const current = parseFloat(display);
    let result: number;

    switch (func) {
      case 'sin':
        result = Math.sin((current * Math.PI) / 180);
        break;
      case 'cos':
        result = Math.cos((current * Math.PI) / 180);
        break;
      case 'tan':
        result = Math.tan((current * Math.PI) / 180);
        break;
      case 'log':
        result = Math.log10(current);
        break;
      case 'ln':
        result = Math.log(current);
        break;
      case 'sqrt':
        result = Math.sqrt(current);
        break;
      case 'x²':
        result = current * current;
        break;
      case '1/x':
        result = 1 / current;
        break;
      case 'π':
        result = Math.PI;
        break;
      case 'e':
        result = Math.E;
        break;
      default:
        return;
    }

    setDisplay(String(result));
    setIsNewNumber(true);
  };

  const ButtonSmall = ({
    children,
    onClick,
    variant = 'default',
    className = '',
  }: {
    children: React.ReactNode;
    onClick: () => void;
    variant?: 'default' | 'operation' | 'equals' | 'clear' | 'scientific';
    className?: string;
  }) => {
    const variants = {
      default: 'bg-white border border-gray-200 text-gray-800 hover:bg-gray-50',
      operation: 'bg-primary-100 border border-primary-300 text-primary-700 hover:bg-primary-200',
      equals: 'bg-primary-600 text-white hover:bg-primary-700',
      clear: 'bg-red-100 border border-red-300 text-red-700 hover:bg-red-200',
      scientific: 'bg-blue-50 border border-blue-200 text-blue-700 hover:bg-blue-100 text-xs',
    };

    return (
      <button
        onClick={onClick}
        className={`h-8 rounded text-sm font-semibold transition-all hover:scale-105 ${variants[variant]} ${className}`}
      >
        {children}
      </button>
    );
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="hidden lg:flex fixed bottom-6 right-6 p-4 bg-primary-600 text-white rounded-full shadow-lg hover:bg-primary-700 transition-all hover:scale-110 z-40"
        title="Abrir Calculadora"
        aria-label="Abrir Calculadora"
      >
        <CalcIcon className="h-6 w-6" />
      </button>
    );
  }

  return (
    <div
      ref={dragRef}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      className="hidden lg:block fixed z-50"
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        cursor: isDragging ? 'grabbing' : 'auto',
      }}
    >
      {/* Calculadora Flutuante */}
      <div className="bg-white rounded-lg shadow-2xl border border-gray-200 overflow-hidden w-72">
        {/* Header Arrastável */}
        <div
          onMouseDown={handleMouseDown}
          className="bg-gradient-to-r from-primary-600 to-primary-700 text-white p-3 flex items-center justify-between cursor-grab active:cursor-grabbing"
        >
          <div className="flex items-center gap-2">
            <CalcIcon className="h-5 w-5" />
            <span className="font-semibold text-sm">Calculadora</span>
            <span className="text-xs bg-primary-500 px-2 py-0.5 rounded">
              {isScientific ? '🔬' : '🔢'}
            </span>
          </div>
          <button
            onClick={() => setIsOpen(false)}
            className="text-white hover:bg-primary-800 p-1 rounded transition-all"
            title="Fechar Calculadora"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Conteúdo */}
        <div className="p-3 space-y-3">
          {/* Toggle Modo */}
          <div className="flex justify-between items-center gap-2">
            <button
              onClick={() => setIsScientific(!isScientific)}
              className={`flex-1 px-2 py-1.5 rounded text-xs font-medium transition-all ${
                isScientific
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {isScientific ? '🔬 Científico' : '🔢 Simples'}
            </button>
          </div>

          {/* Display */}
          <div className="bg-gray-900 rounded p-2">
            {operation && previousValue && (
              <div className="text-gray-500 text-xs text-right">
                {previousValue} {operation}
              </div>
            )}
            <div className="text-white text-2xl font-bold text-right break-all">{display}</div>
          </div>

          {/* Funções Científicas */}
          {isScientific && (
            <div className="grid grid-cols-4 gap-1">
              <ButtonSmall variant="scientific" onClick={() => handleScientific('sin')}>
                sin
              </ButtonSmall>
              <ButtonSmall variant="scientific" onClick={() => handleScientific('cos')}>
                cos
              </ButtonSmall>
              <ButtonSmall variant="scientific" onClick={() => handleScientific('tan')}>
                tan
              </ButtonSmall>
              <ButtonSmall variant="scientific" onClick={() => handleScientific('sqrt')}>
                √
              </ButtonSmall>
              <ButtonSmall variant="scientific" onClick={() => handleScientific('log')}>
                log
              </ButtonSmall>
              <ButtonSmall variant="scientific" onClick={() => handleScientific('ln')}>
                ln
              </ButtonSmall>
              <ButtonSmall variant="scientific" onClick={() => handleScientific('x²')}>
                x²
              </ButtonSmall>
              <ButtonSmall variant="scientific" onClick={() => handleOperation('%')}>
                %
              </ButtonSmall>
            </div>
          )}

          {/* Teclado */}
          <div className="grid grid-cols-4 gap-1">
            {/* Linha 1 */}
            <ButtonSmall variant="clear" onClick={handleClear}>
              C
            </ButtonSmall>
            <ButtonSmall variant="clear" onClick={handleBackspace}>
              ←
            </ButtonSmall>
            <ButtonSmall variant="operation" onClick={() => handleOperation('÷')}>
              ÷
            </ButtonSmall>
            <ButtonSmall variant="operation" onClick={() => handleOperation('×')}>
              ×
            </ButtonSmall>

            {/* Linha 2 */}
            <ButtonSmall onClick={() => handleNumber('7')}>7</ButtonSmall>
            <ButtonSmall onClick={() => handleNumber('8')}>8</ButtonSmall>
            <ButtonSmall onClick={() => handleNumber('9')}>9</ButtonSmall>
            <ButtonSmall variant="operation" onClick={() => handleOperation('-')}>
              −
            </ButtonSmall>

            {/* Linha 3 */}
            <ButtonSmall onClick={() => handleNumber('4')}>4</ButtonSmall>
            <ButtonSmall onClick={() => handleNumber('5')}>5</ButtonSmall>
            <ButtonSmall onClick={() => handleNumber('6')}>6</ButtonSmall>
            <ButtonSmall variant="operation" onClick={() => handleOperation('+')}>
              +
            </ButtonSmall>

            {/* Linha 4 */}
            <ButtonSmall onClick={() => handleNumber('1')}>1</ButtonSmall>
            <ButtonSmall onClick={() => handleNumber('2')}>2</ButtonSmall>
            <ButtonSmall onClick={() => handleNumber('3')}>3</ButtonSmall>
            <ButtonSmall variant="equals" onClick={handleEquals}>
              =
            </ButtonSmall>

            {/* Linha 5 */}
            <ButtonSmall onClick={() => handleNumber('0')} className="col-span-2">
              0
            </ButtonSmall>
            <ButtonSmall onClick={handleDecimal}>.</ButtonSmall>
            <ButtonSmall variant="operation" onClick={() => handleOperation('^')}>
              ^
            </ButtonSmall>
          </div>
        </div>
      </div>
    </div>
  );
}
