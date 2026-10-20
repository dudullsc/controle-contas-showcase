// Suprimir avisos de desenvolvimento do React e Next.js
if (typeof window !== 'undefined') {
  const originalError = console.error;
  const originalWarn = console.warn;
  const originalLog = console.log;

  console.error = (...args: any[]) => {
    if (
      typeof args[0] === 'string' &&
      (args[0].includes('cz-shortcut-listen') ||
        args[0].includes('Extra attributes from the server') ||
        args[0].includes('Warning: Extra attributes') ||
        args[0].includes('Download the React DevTools') ||
        args[0].includes('react-devtools') ||
        args[0].includes('Unable to preventDefault inside passive event listener'))
    ) {
      return;
    }
    originalError.apply(console, args);
  };

  console.warn = (...args: any[]) => {
    if (
      typeof args[0] === 'string' &&
      (args[0].includes('Download the React DevTools') || args[0].includes('react-devtools'))
    ) {
      return;
    }
    originalWarn.apply(console, args);
  };

  console.log = (...args: any[]) => {
    if (
      typeof args[0] === 'string' &&
      (args[0].includes('[Fast Refresh]') ||
        args[0].includes('Download the React DevTools') ||
        args[0].includes('react-devtools'))
    ) {
      return;
    }
    originalLog.apply(console, args);
  };
}

export {};
