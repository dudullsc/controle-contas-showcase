'use client';

import React, { ReactNode, useEffect, useRef } from 'react';
import { AuthProvider } from '@/contexts/AuthContext';
import NotificationProvider from '@/components/NotificationProvider';
import 'react-toastify/dist/ReactToastify.css';
import '@/lib/suppressWarnings';

type ProvidersProps = {
  children: ReactNode;
};

export default function Providers({ children }: ProvidersProps) {
  const containerRef = useRef<any>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Lazy load ToastContainer only on client
    import('react-toastify').then(({ ToastContainer }) => {
      if (!containerRef.current && ToastContainer) {
        import('react-dom/client').then(({ createRoot }) => {
          const div = document.createElement('div');
          document.body.appendChild(div);

          const root = createRoot(div);
          root.render(
            React.createElement(ToastContainer, {
              position: 'top-right',
              autoClose: 5000,
              hideProgressBar: false,
              newestOnTop: true,
              closeOnClick: true,
              rtl: false,
              pauseOnFocusLoss: true,
              draggable: true,
              pauseOnHover: true,
              theme: 'light',
            })
          );
          containerRef.current = root;
        });
      }
    });

    return () => {
      if (containerRef.current) {
        containerRef.current.unmount();
        containerRef.current = null;
      }
    };
  }, []);

  return (
    <AuthProvider>
      <NotificationProvider>{children}</NotificationProvider>
    </AuthProvider>
  );
}
