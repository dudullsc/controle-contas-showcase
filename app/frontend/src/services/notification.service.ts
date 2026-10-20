/**
 * 🔔 Serviço de Notificações
 *
 * Agenda/cancela lembretes de contas no app Capacitor (Local Notifications)
 * e mantém postMessage para hosts iframe legados.
 */

export interface NotificationData {
  id: number;
  title: string;
  body: string;
  dueDate: string;
}

export interface NotificationResponse {
  success: boolean;
  message?: string;
}

type CapacitorBridge = {
  isNativePlatform?: () => boolean;
  Plugins?: {
    LocalNotifications?: {
      requestPermissions: () => Promise<{ display: string }>;
      checkPermissions: () => Promise<{ display: string }>;
      schedule: (options: {
        notifications: Array<{
          id: number;
          title: string;
          body: string;
          schedule?: { at: Date; allowWhileIdle?: boolean };
          channelId?: string;
          extra?: Record<string, unknown>;
        }>;
      }) => Promise<void>;
      cancel: (options: { notifications: Array<{ id: number }> }) => Promise<void>;
      createChannel?: (channel: {
        id: string;
        name: string;
        description?: string;
        importance?: number;
        visibility?: number;
        sound?: string;
        vibration?: boolean;
      }) => Promise<void>;
    };
  };
};

let toastFunction: any = null;
let permissionsRequested = false;
let channelReady = false;

export const registerToastFunction = (toastFn: any) => {
  toastFunction = toastFn;
};

function getCapacitor(): CapacitorBridge | null {
  if (typeof window === 'undefined') return null;
  return (window as Window & { Capacitor?: CapacitorBridge }).Capacitor ?? null;
}

function getLocalNotifications() {
  return getCapacitor()?.Plugins?.LocalNotifications ?? null;
}

function notificationIdFromExpense(expenseId: number): number {
  // Capacitor exige id int32 positivo e estável
  const id = Math.abs(Number(expenseId)) % 2147483647;
  return id === 0 ? 1 : id;
}

class NotificationService {
  private messageListeners: ((event: MessageEvent) => void)[] = [];

  isRunningInApp(): boolean {
    if (typeof window === 'undefined') return false;
    const w = window as Window & { __CONTROLE_CONTAS_APP__?: boolean };
    if (w.__CONTROLE_CONTAS_APP__) return true;
    const cap = getCapacitor();
    if (cap?.isNativePlatform?.()) return true;
    return window.parent !== window;
  }

  private async ensureChannel(): Promise<void> {
    if (channelReady) return;
    const LocalNotifications = getLocalNotifications();
    if (!LocalNotifications?.createChannel) {
      channelReady = true;
      return;
    }
    try {
      await LocalNotifications.createChannel({
        id: 'contas',
        name: 'Contas a pagar',
        description: 'Alertas de contas atrasadas e a vencer',
        importance: 5,
        visibility: 1,
        sound: 'default',
        vibration: true,
      });
    } catch (error) {
      console.warn('Não foi possível criar canal de notificações:', error);
    }
    channelReady = true;
  }

  async ensurePermissions(): Promise<boolean> {
    const LocalNotifications = getLocalNotifications();
    if (!LocalNotifications) {
      this.requestPermissionViaPostMessage();
      return this.isRunningInApp();
    }

    try {
      await this.ensureChannel();
      const current = await LocalNotifications.checkPermissions();
      if (current.display === 'granted') {
        permissionsRequested = true;
        return true;
      }
      const result = await LocalNotifications.requestPermissions();
      permissionsRequested = true;
      return result.display === 'granted';
    } catch (error) {
      console.error('Erro ao solicitar permissão de notificações:', error);
      return false;
    }
  }

  /** Pede permissão na 1ª carga do app (idempotente). */
  async requestPermissionsOnLaunch(): Promise<void> {
    if (!this.isRunningInApp() || permissionsRequested) return;
    await this.ensurePermissions();
  }

  private requestPermissionViaPostMessage(): void {
    if (typeof window === 'undefined') return;
    window.parent.postMessage({ action: 'requestPermission' }, '*');
  }

  private resolveScheduleDate(dueDate: string): Date {
    const due = new Date(dueDate);
    const now = new Date();
    // Atrasadas / resumo de hoje: dispara em ~2s para aparecer na hora
    if (Number.isNaN(due.getTime()) || due.getTime() <= now.getTime() + 1500) {
      return new Date(now.getTime() + 2000);
    }
    // Vencimento futuro: 9h local no dia do vencimento (ou horário original se já tiver)
    const scheduled = new Date(due);
    if (scheduled.getHours() === 0 && scheduled.getMinutes() === 0) {
      scheduled.setHours(9, 0, 0, 0);
    }
    if (scheduled.getTime() <= now.getTime()) {
      return new Date(now.getTime() + 2000);
    }
    return scheduled;
  }

  scheduleNotifications(expenseId: number, title: string, body: string, dueDate: string): void {
    const data: NotificationData = {
      id: expenseId,
      title,
      body,
      dueDate,
    };

    console.log('%c📤 Enviando notificação', 'color: #4CAF50; font-weight: bold;');
    console.table(data);

    void this.scheduleNativeOrPostMessage(data);
  }

  private async scheduleNativeOrPostMessage(_data: NotificationData): Promise<void> {
    // Agendamento local desativado: notificações são enviadas exclusivamente
    // pelo backend via FCM (firebase), evitando duplicatas na gaveta do Android.
  }

  cancelNotifications(expenseId: number): void {
    if (!this.isRunningInApp()) {
      console.log('📱 Não está rodando no app - notificações desabilitadas');
      return;
    }

    console.log('🚫 Cancelando notificações da despesa:', expenseId);
    void this.cancelNativeOrPostMessage(expenseId);
  }

  private async cancelNativeOrPostMessage(expenseId: number): Promise<void> {
    const LocalNotifications = getLocalNotifications();
    if (LocalNotifications) {
      try {
        await LocalNotifications.cancel({
          notifications: [{ id: notificationIdFromExpense(expenseId) }],
        });
        return;
      } catch (error) {
        console.error('Falha ao cancelar Local Notification:', error);
      }
    }

    if (typeof window !== 'undefined') {
      window.parent.postMessage(
        {
          action: 'cancelNotifications',
          data: { id: expenseId },
        },
        '*'
      );
    }
  }

  requestPermission(): void {
    if (!this.isRunningInApp()) {
      console.log('📱 Não está rodando no app');
      return;
    }
    void this.ensurePermissions();
  }

  addMessageListener(callback: (event: MessageEvent) => void): void {
    if (typeof window === 'undefined') return;

    this.messageListeners.push(callback);
    window.addEventListener('message', callback);
  }

  removeMessageListener(callback: (event: MessageEvent) => void): void {
    if (typeof window === 'undefined') return;

    const index = this.messageListeners.indexOf(callback);
    if (index > -1) {
      this.messageListeners.splice(index, 1);
      window.removeEventListener('message', callback);
    }
  }

  removeAllListeners(): void {
    if (typeof window === 'undefined') return;

    this.messageListeners.forEach((listener) => {
      window.removeEventListener('message', listener);
    });
    this.messageListeners = [];
  }

  toISODate(date: Date | string): string {
    return new Date(date).toISOString();
  }

  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(amount);
  }

  calculateDaysUntilDue(dueDate: Date | string): number {
    const due = new Date(dueDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    due.setHours(0, 0, 0, 0);

    const diffTime = due.getTime() - today.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  isOverdue(dueDate: Date | string): boolean {
    return this.calculateDaysUntilDue(dueDate) < 0;
  }

  isDueSoon(dueDate: Date | string, daysAhead: number = 3): boolean {
    const daysUntil = this.calculateDaysUntilDue(dueDate);
    return daysUntil >= 0 && daysUntil <= daysAhead;
  }

  scheduleMultipleNotifications(
    expenses: Array<{
      id: number;
      description: string;
      amount: number;
      due_date: Date | string;
    }>
  ): number {
    let scheduledCount = 0;
    const scheduledNotifications: any[] = [];

    expenses.forEach((expense) => {
      try {
        const daysUntil = this.calculateDaysUntilDue(expense.due_date);
        let status = '';

        if (daysUntil < 0) {
          status = `⚠️ VENCIDO há ${Math.abs(daysUntil)} dia(s)`;
        } else if (daysUntil === 0) {
          status = '🔴 VENCE HOJE';
        } else if (daysUntil === 1) {
          status = '🟠 Vence amanhã';
        } else if (daysUntil <= 3) {
          status = `🟡 Vence em ${daysUntil} dias`;
        } else {
          return;
        }

        const body = `${status} - ${this.formatCurrency(expense.amount)}`;
        const notificationData = {
          id: expense.id,
          description: expense.description,
          body: body,
          daysUntil: daysUntil,
        };

        scheduledNotifications.push(notificationData);

        this.scheduleNotifications(
          expense.id,
          expense.description,
          body,
          this.toISODate(expense.due_date)
        );
        scheduledCount++;
      } catch (error) {
        console.error(`Erro ao agendar notificação para despesa ${expense.id}:`, error);
      }
    });

    console.log('%c━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'color: #2196F3;');
    console.log(
      `%c📢 ${scheduledCount} NOTIFICAÇÃO(ÕES) AGENDADA(S)`,
      'color: #2196F3; font-weight: bold; font-size: 14px;'
    );

    if (scheduledCount > 0) {
      console.table(scheduledNotifications);
    } else {
      console.log(
        '%cNenhuma despesa próxima a vencer nos próximos 3 dias',
        'color: #999; font-style: italic;'
      );
    }

    console.log('%c━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'color: #2196F3;');

    return scheduledCount;
  }

  cancelMultipleNotifications(expenseIds: number[]): void {
    expenseIds.forEach((id) => {
      this.cancelNotifications(id);
    });
  }
}

export const notificationService = new NotificationService();
