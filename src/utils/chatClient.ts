import {
  OrderChatMessage,
  OrderItemSnapshot,
  OrderThread,
  StoredCustomerChatSession,
  WhatsAppOrder
} from '../types.ts';
import { getAppOrigin } from './whatsapp.ts';

const CUSTOMER_CHATS_STORAGE_KEY = 'huize_my_chats_v1';
const CUSTOMER_PROFILE_STORAGE_KEY = 'huize_chat_customer_profile_v1';
export const AUTHORIZED_ADMIN_EMAIL = 'hugosazizegansonre@gmail.com';

export interface SavedCustomerProfile {
  customerName: string;
  customerPhone: string;
  customerCity: string;
  paymentMethod: string;
}

export function loadStoredCustomerProfile(): SavedCustomerProfile {
  try {
    const raw = localStorage.getItem(CUSTOMER_PROFILE_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<SavedCustomerProfile>;
      return {
        customerName: parsed.customerName || '',
        customerPhone: parsed.customerPhone || '',
        customerCity: parsed.customerCity || 'Ouagadougou',
        paymentMethod: parsed.paymentMethod || 'Orange Money / Moov Money'
      };
    }
  } catch {
    // Ignore storage errors
  }
  return {
    customerName: '',
    customerPhone: '',
    customerCity: 'Ouagadougou',
    paymentMethod: 'Orange Money / Moov Money'
  };
}

export function saveStoredCustomerProfile(profile: SavedCustomerProfile): void {
  try {
    localStorage.setItem(CUSTOMER_PROFILE_STORAGE_KEY, JSON.stringify(profile));
  } catch {
    // Ignore storage errors
  }
}

export function loadStoredChatSessions(): StoredCustomerChatSession[] {
  try {
    const raw = localStorage.getItem(CUSTOMER_CHATS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.filter(
        (s) => s && typeof s.orderId === 'string' && typeof s.accessToken === 'string'
      );
    }
  } catch {
    // Ignore storage errors
  }
  return [];
}

export function saveStoredChatSession(session: StoredCustomerChatSession): StoredCustomerChatSession[] {
  const existing = loadStoredChatSessions().filter((s) => s.orderId !== session.orderId);
  const next = [session, ...existing].slice(0, 30);
  try {
    localStorage.setItem(CUSTOMER_CHATS_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Ignore storage errors
  }
  return next;
}

export function getStoredTokenForOrder(orderId: string): string | null {
  const found = loadStoredChatSessions().find((s) => s.orderId === orderId);
  return found ? found.accessToken : null;
}

export function buildPrivateTrackUrl(orderId: string, accessToken: string): string {
  const origin = getAppOrigin();
  return `${origin}/?suivi=${encodeURIComponent(orderId)}&cle=${encodeURIComponent(accessToken)}`;
}

export function getChatWsUrl(): string {
  if (typeof window === 'undefined') return '';
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${proto}//${window.location.host}/ws/chat`;
}

export function playChatNotificationChime(): void {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(660, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.11);
    gain.gain.setValueAtTime(0.06, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.26);
    setTimeout(() => {
      ctx.close().catch(() => {});
    }, 350);
  } catch {
    // Ignore audio context restrictions
  }
}

export async function createOrderChatThread(payload: {
  customerName: string;
  customerPhone: string;
  customerCity: string;
  paymentMethod: string;
  items: OrderItemSnapshot[];
  initialMessage?: string;
  referralCode?: string;
}): Promise<{
  success: boolean;
  error?: string;
  thread?: OrderThread;
  order?: WhatsAppOrder;
  accessToken?: string;
  messages?: OrderChatMessage[];
}> {
  try {
    const res = await fetch('/api/chat/threads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (data.success && data.thread && data.accessToken) {
      saveStoredChatSession({
        orderId: data.thread.orderId,
        accessToken: data.accessToken,
        customerName: data.thread.customerName
      });
      saveStoredCustomerProfile({
        customerName: payload.customerName,
        customerPhone: payload.customerPhone,
        customerCity: payload.customerCity,
        paymentMethod: payload.paymentMethod
      });
    }
    return data;
  } catch {
    return {
      success: false,
      error: 'Erreur réseau. Vérifiez votre connexion internet.'
    };
  }
}

export async function fetchMyChatThreads(
  sessions: StoredCustomerChatSession[]
): Promise<OrderThread[]> {
  if (sessions.length === 0) return [];
  try {
    const res = await fetch('/api/chat/my-threads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessions })
    });
    const data = await res.json();
    return Array.isArray(data?.threads) ? data.threads : [];
  } catch {
    return [];
  }
}

export async function fetchCustomerThread(
  orderId: string,
  accessToken: string
): Promise<{
  success: boolean;
  error?: string;
  thread?: OrderThread;
  messages?: OrderChatMessage[];
}> {
  try {
    const res = await fetch(`/api/chat/threads/${encodeURIComponent(orderId)}`, {
      headers: {
        'x-chat-token': accessToken
      },
      cache: 'no-store'
    });
    return await res.json();
  } catch {
    return { success: false, error: 'Impossible de charger la discussion.' };
  }
}

export async function sendCustomerChatMessage(
  orderId: string,
  accessToken: string,
  text: string,
  attachedProduct?: OrderItemSnapshot
): Promise<{
  success: boolean;
  error?: string;
  thread?: OrderThread;
  message?: OrderChatMessage;
}> {
  try {
    const res = await fetch(`/api/chat/threads/${encodeURIComponent(orderId)}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-chat-token': accessToken
      },
      body: JSON.stringify({ text, attachedProduct })
    });
    return await res.json();
  } catch {
    return { success: false, error: 'Erreur réseau lors de l’envoi.' };
  }
}

export async function markCustomerThreadRead(orderId: string, accessToken: string): Promise<void> {
  try {
    await fetch(`/api/chat/threads/${encodeURIComponent(orderId)}/read`, {
      method: 'POST',
      headers: { 'x-chat-token': accessToken }
    });
  } catch {
    // Non-blocking
  }
}

// --- ADMIN CHAT CLIENT ---
export async function fetchAdminChatThreads(refresh = false): Promise<OrderThread[]> {
  try {
    const url = refresh ? '/api/chat/admin/threads?refresh=1' : '/api/chat/admin/threads';
    const res = await fetch(url, {
      headers: { 'x-admin-email': AUTHORIZED_ADMIN_EMAIL },
      cache: 'no-store'
    });
    const data = await res.json();
    return Array.isArray(data?.threads) ? data.threads : [];
  } catch {
    return [];
  }
}

export async function fetchAdminChatThread(orderId: string): Promise<{
  success: boolean;
  thread?: OrderThread;
  messages?: OrderChatMessage[];
}> {
  try {
    const res = await fetch(`/api/chat/admin/threads/${encodeURIComponent(orderId)}`, {
      headers: { 'x-admin-email': AUTHORIZED_ADMIN_EMAIL },
      cache: 'no-store'
    });
    return await res.json();
  } catch {
    return { success: false };
  }
}

export async function sendAdminChatMessage(
  orderId: string,
  text: string,
  attachedProduct?: OrderItemSnapshot
): Promise<{
  success: boolean;
  error?: string;
  thread?: OrderThread;
  message?: OrderChatMessage;
}> {
  try {
    const res = await fetch(`/api/chat/threads/${encodeURIComponent(orderId)}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-email': AUTHORIZED_ADMIN_EMAIL
      },
      body: JSON.stringify({ text, attachedProduct })
    });
    return await res.json();
  } catch {
    return { success: false, error: 'Erreur réseau.' };
  }
}

export async function markAdminThreadRead(orderId: string): Promise<void> {
  try {
    await fetch(`/api/chat/threads/${encodeURIComponent(orderId)}/read`, {
      method: 'POST',
      headers: { 'x-admin-email': AUTHORIZED_ADMIN_EMAIL }
    });
  } catch {
    // Non-blocking
  }
}

export async function updateAdminThreadStatus(
  orderId: string,
  status: WhatsAppOrder['status']
): Promise<{
  success: boolean;
  thread?: OrderThread;
  message?: OrderChatMessage;
}> {
  try {
    const res = await fetch(`/api/chat/admin/threads/${encodeURIComponent(orderId)}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-email': AUTHORIZED_ADMIN_EMAIL
      },
      body: JSON.stringify({ status })
    });
    return await res.json();
  } catch {
    return { success: false };
  }
}
