import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.dudullsc.controlecontas',
  appName: 'Controle de Contas',
  webDir: 'www',
  // Carrega o site como top-level (sem iframe) para cookies/JWT e login funcionarem.
  // Atualizações do sistema continuam automáticas via deploy do frontend.
  server: {
    url: 'https://contas.example.com',
    cleartext: false,
    allowNavigation: [
      'contas.example.com',
      'https://contas.example.com',
      'https://*.example.com',
    ],
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1200,
      launchAutoHide: true,
      backgroundColor: '#0f172a',
      showSpinner: false,
    },
    StatusBar: {
      style: 'LIGHT',
      backgroundColor: '#ffffff',
      overlaysWebView: false,
    },
    LocalNotifications: {
      smallIcon: 'ic_stat_contas',
      iconColor: '#0D9488',
      sound: 'default',
    },
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
  },
  android: {
    allowMixedContent: false,
  },
};

export default config;
