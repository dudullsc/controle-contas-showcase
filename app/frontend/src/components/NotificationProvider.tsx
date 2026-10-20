'use client';

import { useEffect } from 'react';
import { toast } from 'react-toastify';
import { notificationService, registerToastFunction } from '@/services/notification.service';

/**
 * 🔔 Provedor de Notificações
 *
 * Componente responsável por:
 * 1. Registrar a função toast no serviço de notificações
 * 2. Escutar mensagens do app mobile (Capacitor)
 * 3. Simular notificações no navegador para testes
 * 4. Exibir feedback sobre status das notificações
 */
export default function NotificationProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // ✅ REGISTRAR FUNÇÃO TOAST NO SERVIÇO
    registerToastFunction(toast);

    const isInApp = notificationService.isRunningInApp();

    // App nativo: pede permissão de notificação na 1ª carga
    if (isInApp) {
      void notificationService.requestPermissionsOnLaunch();
    }

    // Controle de notificações duplicadas
    const recentNotifications = new Set<string>();
    const clearNotificationCache = (key: string) => {
      setTimeout(() => recentNotifications.delete(key), 2000);
    };

    // ============================================
    // SIMULADOR DE NOTIFICAÇÕES PARA NAVEGADOR
    // ============================================
    if (!isInApp) {
      // Intercepta AMBAS as formas de postMessage
      const originalPostMessage = window.postMessage;
      const originalParentPostMessage = window.parent.postMessage;

      // Função que processa mensagens de notificação
      const processNotificationMessage = (message: any, isFromParent = false) => {
        if (typeof message === 'object' && message.action === 'scheduleNotifications') {
          const { data } = message;

          // Verificar se já foi exibida recentemente (evita duplicação)
          const notificationKey = `${data.title}_${data.dueDate}`;
          if (recentNotifications.has(notificationKey)) {
            return true; // Ignora duplicata
          }

          // Adiciona ao cache e agenda limpeza
          recentNotifications.add(notificationKey);
          clearNotificationCache(notificationKey);

          // Exibe toast simulando a notificação
          toast.info(
            <div>
              <strong>{data.title}</strong>
              <p style={{ marginTop: '8px', marginBottom: 0, fontSize: '14px' }}>{data.body}</p>
              <p style={{ marginTop: '4px', marginBottom: 0, fontSize: '12px', color: '#999' }}>
                📅 {new Date(data.dueDate).toLocaleDateString('pt-BR')}
              </p>
            </div>,
            {
              position: 'top-right',
              autoClose: 5000,
              hideProgressBar: false,
              closeOnClick: true,
              pauseOnHover: true,
              draggable: true,
            }
          );

          // Simula resposta do app após 500ms
          setTimeout(() => {
            const mockResponse = new MessageEvent('message', {
              data: {
                action: 'notificationsScheduled',
                success: true,
                message: `Notificação simulada para ${new Date(data.dueDate).toLocaleString('pt-BR')}`,
              },
            });
            window.dispatchEvent(mockResponse);
          }, 500);

          return true;
        }

        if (typeof message === 'object' && message.action === 'cancelNotifications') {
          // Simula resposta do app
          setTimeout(() => {
            const mockResponse = new MessageEvent('message', {
              data: {
                action: 'notificationsCancelled',
                success: true,
              },
            });
            window.dispatchEvent(mockResponse);
          }, 300);

          return true;
        }

        return false;
      };

      // Interceptar window.postMessage
      window.postMessage = function (message: any, ...args: any[]) {
        if (processNotificationMessage(message, false)) {
          return;
        }
        return (originalPostMessage as any).apply(window, [message, ...(args as any[])]);
      };

      // Interceptar window.parent.postMessage
      window.parent.postMessage = function (message: any, ...args: any[]) {
        if (processNotificationMessage(message, true)) {
          return;
        }
        return (originalParentPostMessage as any).apply(window.parent, [
          message,
          ...(args as any[]),
        ]);
      };
    }

    // ============================================
    // HANDLER DE MENSAGENS DO APP
    // ============================================
    const handleAppMessage = (event: MessageEvent) => {
      // Ignorar mensagens de outras origens
      if (!event.data || typeof event.data !== 'object') {
        return;
      }

      const { action, success, message } = event.data;

      // Verificar duplicatas de mensagens do app
      const messageKey = `${action}_${success}_${Date.now()}`;
      if (recentNotifications.has(messageKey)) {
        return; // Ignora duplicata
      }
      recentNotifications.add(messageKey);
      clearNotificationCache(messageKey);

      switch (action) {
        case 'notificationsScheduled':
          if (success) {
            if (isInApp) {
              toast.success('Notificações agendadas! 🔔', {
                position: 'bottom-right',
                autoClose: 2000,
              });
            }
          } else {
            toast.error('Erro ao agendar notificações', {
              position: 'bottom-right',
            });
          }
          break;

        case 'notificationsCancelled':
          if (success) {
            if (isInApp) {
              toast.info('Notificação cancelada', {
                position: 'bottom-right',
                autoClose: 1500,
              });
            }
          } else {
            // Erro silencioso
          }
          break;

        case 'permissionGranted':
          toast.success('Notificações ativadas! 🔔', {
            position: 'bottom-right',
          });
          break;

        case 'permissionDenied':
          toast.warning('Permissão de notificações negada', {
            position: 'bottom-right',
          });
          break;

        default:
          // Ignora outras ações
          break;
      }
    };

    // Adiciona listener
    notificationService.addMessageListener(handleAppMessage);

    // Cleanup
    return () => {
      notificationService.removeMessageListener(handleAppMessage);
    };
  }, []);

  return <>{children}</>;
}
