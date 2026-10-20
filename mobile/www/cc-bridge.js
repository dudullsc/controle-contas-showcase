/**
 * Bridge Capacitor — Controle de Contas
 * - Status bar
 * - Notificações NA CORTINA do app (Local Notifications), sem WhatsApp
 * - Push FCM
 * (Biometria fica no frontend /login — evita botão duplicado)
 */
(function () {
  if (window.__CC_APP_BRIDGE__) return;
  window.__CC_APP_BRIDGE__ = true;
  window.__CONTROLE_CONTAS_APP__ = true;

  var API_BASE = 'https://contas.example.com/cc-api';
  var API_EXPENSES = API_BASE + '/expenses/';

  function applyNativeVersionLabel(version) {
    if (!version || !document.body) return;
    var label = 'Versão ' + version;
    var els = document.querySelectorAll('p, button, span');
    for (var i = 0; i < els.length; i++) {
      var t = (els[i].textContent || '').trim();
      if (!/^Versão\s+[\d.]+$/.test(t) || t === label) continue;
      var nodes = els[i].childNodes;
      var replaced = false;
      for (var n = 0; n < nodes.length; n++) {
        if (nodes[n].nodeType === 3 && /Versão\s+[\d.]+/.test(nodes[n].textContent || '')) {
          nodes[n].textContent = (nodes[n].textContent || '').replace(
            /Versão\s+[\d.]+/,
            label
          );
          replaced = true;
          break;
        }
      }
      if (!replaced) els[i].textContent = label;
    }
  }

  function loadNativeVersion() {
    var App =
      window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.App;
    if (!App || !App.getInfo) return;
    App.getInfo()
      .then(function (info) {
        if (!info || !info.version) return;
        window.__CC_APP_VERSION__ = info.version;
        window.__CC_APP_BUILD__ = String(info.build || '');
        applyNativeVersionLabel(info.version);
        if (window.__CC_VER_OBS__ || !document.body) return;
        window.__CC_VER_OBS__ = new MutationObserver(function () {
          applyNativeVersionLabel(info.version);
        });
        window.__CC_VER_OBS__.observe(document.body, {
          childList: true,
          subtree: true,
          characterData: true,
        });
      })
      .catch(function () {});
  }
  loadNativeVersion();
  setTimeout(loadNativeVersion, 1200);

  // Status bar visível + menu (3 traços) com área de toque usable
  (function setupStatusBarVisible() {
    try {
      var SB = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.StatusBar;
      if (SB) {
        if (SB.setOverlaysWebView) SB.setOverlaysWebView({ overlay: false });
        if (SB.setBackgroundColor) SB.setBackgroundColor({ color: '#ffffff' });
        // LIGHT = texto/ícones escuros no fundo branco da status bar
        if (SB.setStyle) SB.setStyle({ style: 'LIGHT' });
        if (SB.show) SB.show();
      }

      var meta = document.querySelector('meta[name="viewport"]');
      if (meta && meta.content.indexOf('viewport-fit') === -1) {
        meta.content = meta.content + ', viewport-fit=cover';
      }

      if (!document.getElementById('cc-safe-area-style')) {
        var style = document.createElement('style');
        style.id = 'cc-safe-area-style';
        style.textContent =
          /* Topo: respeita status bar / notch */ +
          'html{--cc-sat:max(env(safe-area-inset-top,0px),0px);}' +
          /* Header do dashboard mais alto e afastado das bordas */ +
          '.flex.h-16.items-center.justify-between{' +
          'min-height:56px!important;padding-left:12px!important;padding-right:12px!important;' +
          'box-sizing:border-box!important;}' +
          /* Botão menu (3 traços): área de toque ~48px, longe do canto */ +
          '.flex.h-16.items-center.justify-between>button:first-child{' +
          'min-width:48px!important;min-height:48px!important;padding:12px!important;' +
          'margin:0 8px 0 4px!important;display:inline-flex!important;' +
          'align-items:center!important;justify-content:center!important;' +
          'border-radius:10px!important;position:relative!important;z-index:50!important;' +
          '-webkit-tap-highlight-color:rgba(37,99,235,.15)!important;}';
        document.documentElement.appendChild(style);
      }
    } catch (_) {}
  })();

  function LN() {
    return (
      window.Capacitor &&
      window.Capacitor.Plugins &&
      window.Capacitor.Plugins.LocalNotifications
    );
  }

  function PN() {
    return (
      window.Capacitor &&
      window.Capacitor.Plugins &&
      window.Capacitor.Plugins.PushNotifications
    );
  }

  var pushListenersReady = false;
  function ensurePushListeners() {
    var P = PN();
    if (!P || pushListenersReady) return;
    pushListenersReady = true;

    P.addListener('registration', function (ev) {
      var token = ev && ev.value;
      if (!token) return;
      try {
        localStorage.setItem('cc_fcm_token', token);
      } catch (_) {}
      postFcmToken(token);
    });

    P.addListener('registrationError', function (err) {
      console.warn('[CC] FCM registration error', err);
    });

    P.addListener('pushNotificationReceived', function () {
      /* App em foreground: Android ainda mostra na cortina com channel high */
    });

    P.addListener('pushNotificationActionPerformed', function () {
      try {
        if (isLoggedIn()) {
          window.location.assign('/dashboard/expenses');
        } else {
          window.location.assign('/login');
        }
      } catch (_) {}
    });
  }

  function isLoggedIn() {
    try {
      return sessionStorage.getItem('cc_session') === '1';
    } catch (_) {
      return false;
    }
  }

  function postFcmToken(token) {
    if (!token) return Promise.resolve();
    return fetch(API_BASE + '/devices/fcm-token', {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        token: token,
        platform: 'android',
        app_id: 'com.dudullsc.controlecontas',
      }),
    }).catch(function (e) {
      console.warn('[CC] registrar FCM token', e);
    });
  }

  /**
   * Push remoto (FCM) — funciona com o app fechado, estilo Nubank.
   * Requer google-services.json no projeto Android + credenciais no backend.
   */
  function registerPush() {
    var P = PN();
    if (!P) return Promise.resolve(false);

    ensurePushListeners();
    ensureChannel();

    return P.checkPermissions()
      .then(function (c) {
        if (c.receive === 'granted') return true;
        return P.requestPermissions().then(function (r) {
          return r.receive === 'granted';
        });
      })
      .then(function (ok) {
        if (!ok) return false;
        return P.register().then(function () {
          return true;
        });
      })
      .then(function (ok) {
        if (!ok) return false;
        // Reenvia token salvo se o listener já disparou antes do login
        try {
          var cached = localStorage.getItem('cc_fcm_token');
          if (cached && isLoggedIn()) postFcmToken(cached);
        } catch (_) {}
        return true;
      })
      .catch(function (e) {
        console.warn('[CC] registerPush', e);
        return false;
      });
  }

  /** Capacitor exige id int32; ObjectId Mongo não vira Number() direto. */
  function nid(id) {
    if (id == null || id === '') return 1;
    if (typeof id === 'number' && !isNaN(id)) {
      var nNum = Math.abs(Math.trunc(id)) % 2147483647;
      return nNum === 0 ? 1 : nNum;
    }
    var s = String(id);
    if (/^[a-fA-F0-9]{24}$/.test(s)) {
      var nHex = parseInt(s.slice(-8), 16) % 2147483647;
      return !nHex || isNaN(nHex) ? 1 : Math.abs(nHex);
    }
    var asNum = Number(s);
    if (!isNaN(asNum) && s.trim() !== '') {
      var n = Math.abs(Math.trunc(asNum)) % 2147483647;
      return n === 0 ? 1 : n;
    }
    var h = 0;
    for (var i = 0; i < s.length; i++) {
      h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
    }
    var nHash = Math.abs(h) % 2147483647;
    return nHash === 0 ? 1 : nHash;
  }

  function expenseId(exp) {
    return (exp && (exp._id || exp.id)) || '';
  }

  /** Só "PAGO" / "paid" contam como pago — "NÃO PAGO" continua aberto. */
  function isPaidStatus(status) {
    var s = String(status || '')
      .trim()
      .toLowerCase();
    return s === 'pago' || s === 'paid';
  }

  function daysUntil(dueDate) {
    var due = new Date(dueDate);
    var today = new Date();
    today.setHours(0, 0, 0, 0);
    due.setHours(0, 0, 0, 0);
    return Math.ceil((due.getTime() - today.getTime()) / 86400000);
  }

  function formatBRL(amount) {
    try {
      return Number(amount).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    } catch (_) {
      return 'R$ ' + amount;
    }
  }

  /** 09:00 local no dia do vencimento (comportamento desejado na cortina). */
  function nineAmOnDue(dueDate) {
    var d = new Date(dueDate);
    if (isNaN(d.getTime())) d = new Date();
    d.setHours(9, 0, 0, 0);
    return d.toISOString();
  }

  function when(due) {
    var d = new Date(due);
    var n = new Date();
    if (isNaN(d.getTime()) || d.getTime() <= n.getTime() + 1500) {
      return new Date(n.getTime() + 2000);
    }
    var s = new Date(d);
    if (s.getHours() === 0 && s.getMinutes() === 0) s.setHours(9, 0, 0, 0);
    if (s.getTime() <= n.getTime()) return new Date(n.getTime() + 2000);
    return s;
  }

  var channelReady = false;
  function ensureChannel() {
    var P = LN();
    if (!P || channelReady || !P.createChannel) {
      channelReady = true;
      return Promise.resolve();
    }
    return P.createChannel({
      id: 'contas',
      name: 'Controle de Contas',
      description: 'Avisos de faturas atrasadas e a vencer',
      importance: 5,
      visibility: 1,
      sound: 'default',
      vibration: true,
    })
      .catch(function () {})
      .then(function () {
        channelReady = true;
      });
  }

  function askNotif() {
    var P = LN();
    if (!P) return Promise.resolve(false);
    return ensureChannel()
      .then(function () {
        return P.checkPermissions();
      })
      .then(function (c) {
        if (c.display === 'granted') return true;
        return P.requestPermissions().then(function (r) {
          return r.display === 'granted';
        });
      })
      .catch(function () {
        return false;
      });
  }

  function dayKey() {
    var d = new Date();
    return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
  }

  function notifStorageKey(id) {
    return 'cc_ln_' + nid(id) + '_' + dayKey();
  }

  function alreadyNotifiedToday(id) {
    try {
      return localStorage.getItem(notifStorageKey(id)) === '1';
    } catch (_) {
      return false;
    }
  }

  function markNotifiedToday(id) {
    try {
      localStorage.setItem(notifStorageKey(id), '1');
    } catch (_) {}
  }

  function schedule(_data) {
    // Desativado: avisos de conta vêm só do backend (FCM).
    // Agendar local de novo duplicava a mesma mensagem na gaveta.
    return Promise.resolve();
  }

  function cancelAllPendingLocals() {
    var P = LN();
    if (!P) return Promise.resolve();

    var clearPending = P.getPending
      ? P.getPending().then(function (pending) {
          var list = (pending && pending.notifications) || [];
          if (!list.length) return;
          return P.cancel({
            notifications: list.map(function (n) {
              return { id: n.id };
            }),
          });
        })
      : Promise.resolve();

    var clearDelivered =
      P.getDeliveredNotifications && P.removeDeliveredNotifications
        ? P.getDeliveredNotifications().then(function (delivered) {
            var list = (delivered && delivered.notifications) || [];
            if (!list.length) return;
            return P.removeDeliveredNotifications({ notifications: list });
          })
        : Promise.resolve();

    return Promise.all([clearPending, clearDelivered]).catch(function () {});
  }

  function ensureLocalTapOpensApp() {
    var P = LN();
    if (!P || !P.addListener || window.__CC_LN_TAP__) return;
    window.__CC_LN_TAP__ = true;
    P.addListener('localNotificationActionPerformed', function () {
      try {
        if (isLoggedIn()) {
          window.location.assign('/dashboard/expenses');
        } else {
          window.location.assign('/login');
        }
      } catch (_) {}
    });
  }

  function cancel(id) {
    var P = LN();
    if (!P) return Promise.resolve();
    return P.cancel({ notifications: [{ id: nid(id) }] }).catch(function () {});
  }
  /**
   * Busca despesas e agenda avisos NA CORTINA do app Controle de Contas
   * (não usa WhatsApp). Imediatas = 1x/dia; futuras = 09:00 no vencimento.
   */
  var syncInFlight = false;
  var syncTimer = null;

  function syncBillNotifications() {
    // FCM-only: limpa QUALQUER local pendente (inclusive de APKs antigos
    // que ainda tinham schedule de "Vence HOJE"). Antes só cancelava pagas.
    if (!LN()) return Promise.resolve();
    if (syncInFlight) return Promise.resolve();
    syncInFlight = true;

    return cancelAllPendingLocals()
      .then(function () {
        return cancel(99999999);
      })
      .catch(function (e) {
        console.warn('[CC] sync cancelamento notificações', e);
      })
      .then(function () {
        syncInFlight = false;
      });
  }

  function syncBillNotificationsDebounced() {
    if (syncTimer) clearTimeout(syncTimer);
    syncTimer = setTimeout(function () {
      syncBillNotifications();
    }, 1200);
  }

  askNotif();
  ensureLocalTapOpensApp();
  setTimeout(function () {
    if (isLoggedIn()) registerPush();
  }, 2000);
  setTimeout(syncBillNotificationsDebounced, 3500);
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'visible') {
      // Só re-registra push; sync de bills já dedupeia 1x/dia
      if (isLoggedIn()) registerPush();
      syncBillNotificationsDebounced();
    }
  });

  window.addEventListener('message', function (e) {
    var m = e && e.data;
    if (!m || typeof m !== 'object') return;
    if (m.action === 'scheduleNotifications') schedule(m.data || {});
    else if (m.action === 'cancelNotifications') cancel(m.data && m.data.id);
    else if (m.action === 'requestPermission') askNotif();
  });

  // ---------- Pós-login / pós-alteração de despesa (push / sync) ----------
  function interceptLoginSave() {
    if (window.__CC_XHR_HOOK__) return;
    window.__CC_XHR_HOOK__ = true;
    var open = XMLHttpRequest.prototype.open;
    var send = XMLHttpRequest.prototype.send;
    XMLHttpRequest.prototype.open = function (method, url) {
      this.__ccUrl = String(url || '');
      this.__ccMethod = String(method || '');
      return open.apply(this, arguments);
    };
    XMLHttpRequest.prototype.send = function (body) {
      var xhr = this;
      var method = (xhr.__ccMethod || '').toUpperCase();
      var url = xhr.__ccUrl || '';
      if (method === 'POST' && url.indexOf('/auth/login') !== -1) {
        xhr.addEventListener('load', function () {
          if (xhr.status < 200 || xhr.status >= 300) return;
          setTimeout(function () {
            registerPush();
            syncBillNotificationsDebounced();
          }, 1500);
        });
      } else if (
        (method === 'PUT' || method === 'PATCH' || method === 'DELETE') &&
        url.indexOf('/expenses') !== -1
      ) {
        // Marcou pago / editou / excluiu: cancela lembretes de contas pagas
        xhr.addEventListener('load', function () {
          if (xhr.status < 200 || xhr.status >= 300) return;
          syncBillNotificationsDebounced();
        });
      }
      return send.apply(this, arguments);
    };

    if (typeof window.fetch === 'function' && !window.__CC_FETCH_HOOK__) {
      window.__CC_FETCH_HOOK__ = true;
      var nativeFetch = window.fetch;
      window.fetch = function (input, init) {
        var url = typeof input === 'string' ? input : (input && input.url) || '';
        var method = (
          (init && init.method) ||
          (input && input.method) ||
          'GET'
        ).toUpperCase();
        return nativeFetch.apply(this, arguments).then(function (res) {
          if (
            res &&
            res.ok &&
            (method === 'PUT' || method === 'PATCH' || method === 'DELETE') &&
            String(url).indexOf('/expenses') !== -1
          ) {
            syncBillNotificationsDebounced();
          }
          if (
            res &&
            res.ok &&
            method === 'POST' &&
            String(url).indexOf('/auth/login') !== -1
          ) {
            setTimeout(function () {
              registerPush();
              syncBillNotificationsDebounced();
            }, 1500);
          }
          return res;
        });
      };
    }
  }

  interceptLoginSave();

  function bootUi() {
    setTimeout(syncBillNotificationsDebounced, 3500);
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootUi);
  } else {
    bootUi();
  }
})();
