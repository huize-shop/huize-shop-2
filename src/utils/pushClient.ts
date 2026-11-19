import { StoredCustomerChatSession } from '../types.ts';
import { AUTHORIZED_ADMIN_EMAIL } from './chatClient.ts';

const ADMIN_PUSH_FLAG_KEY = 'huize_admin_push_active_v1';
const CUSTOMER_PUSH_FLAG_KEY = 'huize_customer_push_active_v1';

export type PushRole = 'admin' | 'customer';

export interface SubscribePushResult {
  success: boolean;
  reason?: 'unsupported' | 'ios_pwa_required' | 'denied' | 'server_error';
  error?: string;
  endpoint?: string;
}

export function isIOSDevice(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  return (
    /iPad|iPhone|iPod/.test(ua) ||
    (navigator.platform === 'MacIntel' && (navigator.maxTouchPoints || 0) > 1)
  );
}

export function isStandalonePWA(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia?.('(display-mode: standalone)')?.matches === true ||
    (navigator as any)?.standalone === true
  );
}

export function isWebPushSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'Notification' in window &&
    'serviceWorker' in navigator &&
    'PushManager' in window
  );
}

export function hasStoredPushOptIn(role: PushRole): boolean {
  try {
    return (
      localStorage.getItem(role === 'admin' ? ADMIN_PUSH_FLAG_KEY : CUSTOMER_PUSH_FLAG_KEY) === '1'
    );
  } catch {
    return false;
  }
}

function setStoredPushOptIn(role: PushRole, active: boolean): void {
  try {
    const key = role === 'admin' ? ADMIN_PUSH_FLAG_KEY : CUSTOMER_PUSH_FLAG_KEY;
    if (active) {
      localStorage.setItem(key, '1');
    } else {
      localStorage.removeItem(key);
    }
  } catch {
    // Ignore storage errors
  }
}

function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const buffer = new ArrayBuffer(rawData.length);
  const outputArray = new Uint8Array(buffer);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export async function getPushServiceWorkerRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return null;
  try {
    const registrations = await navigator.serviceWorker.getRegistrations();
    if (registrations.length > 0) {
      const ready = await Promise.race<ServiceWorkerRegistration | null>([
        navigator.serviceWorker.ready,
        new Promise((resolve) => setTimeout(() => resolve(registrations[0] || null), 2500))
      ]);
      if (ready) return ready;
    }

    const reg = await navigator.serviceWorker.register('/push-sw.js', { scope: '/' });
    await Promise.race([
      navigator.serviceWorker.ready,
      new Promise((resolve) => setTimeout(resolve, 2500))
    ]);
    return reg;
  } catch {
    return null;
  }
}

export async function getExistingPushSubscription(): Promise<PushSubscription | null> {
  if (!isWebPushSupported()) return null;
  try {
    const regs = await navigator.serviceWorker.getRegistrations();
    const reg = regs[0] || null;
    if (!reg) return null;
    return await reg.pushManager.getSubscription();
  } catch {
    return null;
  }
}

export async function subscribeDeviceToWebPush(params: {
  role: PushRole;
  sessions?: StoredCustomerChatSession[];
}): Promise<SubscribePushResult> {
  const { role, sessions } = params;

  if (!isWebPushSupported()) {
    if (isIOSDevice() && !isStandalonePWA()) {
      return {
        success: false,
        reason: 'ios_pwa_required',
        error:
          "Sur iPhone/iPad, appuyez sur Partager (⬆) puis « Sur l'écran d'accueil » et ouvrez l'icône HUIZE SHOP pour recevoir les notifications."
      };
    }
    return {
      success: false,
      reason: 'unsupported',
      error: 'Ce navigateur ne prend pas en charge les notifications Push.'
    };
  }

  try {
    let permission = Notification.permission;
    if (permission === 'default') {
      permission = await Notification.requestPermission();
    }
    if (permission !== 'granted') {
      setStoredPushOptIn(role, false);
      return {
        success: false,
        reason: 'denied',
        error:
          'Notifications bloquées par le navigateur. Autorisez-les dans les paramètres du site.'
      };
    }

    const keyRes = await fetch('/api/push/public-key', { cache: 'no-store' });
    const keyData = await keyRes.json();
    if (!keyData?.success || !keyData?.publicKey) {
      return {
        success: false,
        reason: 'server_error',
        error: 'Configuration des notifications indisponible.'
      };
    }

    const reg = await getPushServiceWorkerRegistration();
    if (!reg) {
      return {
        success: false,
        reason: 'unsupported',
        error: 'Service de notification indisponible sur cette page.'
      };
    }

    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(keyData.publicKey)
      });
    }

    const res = await fetch('/api/push/subscribe', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(role === 'admin' ? { 'x-admin-email': AUTHORIZED_ADMIN_EMAIL } : {})
      },
      body: JSON.stringify({
        role,
        subscription: sub.toJSON(),
        ...(role === 'customer' ? { sessions: sessions || [] } : {})
      })
    });
    const data = await res.json();
    if (!data?.success) {
      return {
        success: false,
        reason: 'server_error',
        error: data?.error || "Impossible d'enregistrer cet appareil."
      };
    }

    setStoredPushOptIn(role, true);
    return { success: true, endpoint: sub.endpoint };
  } catch {
    return {
      success: false,
      reason: 'server_error',
      error: "Impossible d'activer les notifications sur cet appareil."
    };
  }
}

export async function syncCustomerPushSessionsIfSubscribed(
  sessions: StoredCustomerChatSession[]
): Promise<void> {
  if (!isWebPushSupported() || Notification.permission !== 'granted') return;
  try {
    const sub = await getExistingPushSubscription();
    if (!sub) return;
    await fetch('/api/push/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        role: 'customer',
        subscription: sub.toJSON(),
        sessions
      })
    });
    setStoredPushOptIn('customer', true);
  } catch {
    // Non-blocking
  }
}

export async function syncAdminPushIfSubscribed(): Promise<boolean> {
  if (!isWebPushSupported() || Notification.permission !== 'granted') return false;
  try {
    const sub = await getExistingPushSubscription();
    if (!sub) return false;
    if (!hasStoredPushOptIn('admin')) return false;
    await fetch('/api/push/subscribe', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-email': AUTHORIZED_ADMIN_EMAIL
      },
      body: JSON.stringify({
        role: 'admin',
        subscription: sub.toJSON()
      })
    });
    return true;
  } catch {
    return false;
  }
}

export async function unsubscribeDeviceFromWebPush(role: PushRole): Promise<boolean> {
  setStoredPushOptIn(role, false);
  try {
    const sub = await getExistingPushSubscription();
    if (!sub) return true;
    await fetch('/api/push/unsubscribe', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(role === 'admin' ? { 'x-admin-email': AUTHORIZED_ADMIN_EMAIL } : {})
      },
      body: JSON.stringify({ endpoint: sub.endpoint, role })
    });
    return true;
  } catch {
    return false;
  }
}

export async function sendTestPushNotification(
  role: PushRole
): Promise<{ success: boolean; error?: string }> {
  try {
    const sub = await getExistingPushSubscription();
    const res = await fetch('/api/push/test', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(role === 'admin' ? { 'x-admin-email': AUTHORIZED_ADMIN_EMAIL } : {})
      },
      body: JSON.stringify({
        role,
        endpoint: sub?.endpoint || ''
      })
    });
    return await res.json();
  } catch {
    return { success: false, error: 'Erreur réseau lors du test.' };
  }
}

export async function showInstantBrowserNotification(params: {
  title: string;
  body: string;
  url?: string;
  tag?: string;
}): Promise<void> {
  if (typeof window === 'undefined' || !('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;

  try {
    const reg = await getPushServiceWorkerRegistration();
    if (reg && typeof reg.showNotification === 'function') {
      await reg.showNotification(params.title, {
        body: params.body,
        icon: '/pwa-192x192.png',
        badge: '/pwa-192x192.png',
        tag: params.tag || 'huize-shop-chat',
        data: { url: params.url || '/' }
      } as NotificationOptions);
      return;
    }
  } catch {
    // Fallback to window Notification below
  }

  try {
    const notif = new Notification(params.title, {
      body: params.body,
      icon: '/pwa-192x192.png',
      tag: params.tag || 'huize-shop-chat'
    });
    notif.onclick = () => {
      window.focus();
      if (params.url) {
        window.location.href = params.url;
      }
      notif.close();
    };
  } catch {
    // Ignore browser notification restrictions
  }
}
