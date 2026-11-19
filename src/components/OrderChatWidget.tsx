import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  MessageSquare,
  X,
  Send,
  ArrowLeft,
  Copy,
  Check,
  Package,
  ExternalLink,
  Bell,
  BellRing,
  Phone,
  ShieldCheck,
  Clock,
  Truck,
  CheckCircle2
} from 'lucide-react';
import {
  OrderChatMessage,
  OrderItemSnapshot,
  OrderThread,
  Product,
  StoredCustomerChatSession,
  WhatsAppOrder
} from '../types.ts';
import { formatFCFA, getDirectWhatsAppUrl, normalizeReferralCode } from '../utils/whatsapp.ts';
import {
  buildPrivateTrackUrl,
  createOrderChatThread,
  fetchCustomerThread,
  fetchMyChatThreads,
  getChatWsUrl,
  getStoredTokenForOrder,
  loadStoredChatSessions,
  loadStoredCustomerProfile,
  markCustomerThreadRead,
  playChatNotificationChime,
  saveStoredChatSession,
  sendCustomerChatMessage
} from '../utils/chatClient.ts';
import {
  getExistingPushSubscription,
  hasStoredPushOptIn,
  sendTestPushNotification,
  showInstantBrowserNotification,
  subscribeDeviceToWebPush,
  syncCustomerPushSessionsIfSubscribed,
  unsubscribeDeviceFromWebPush
} from '../utils/pushClient.ts';

export interface OrderDraftContext {
  items: OrderItemSnapshot[];
  referralCode?: string;
  customerName?: string;
  customerPhone?: string;
  customerCity?: string;
  paymentMethod?: string;
  clearCartOnSuccess?: boolean;
}

interface OrderChatWidgetProps {
  isOpen: boolean;
  onOpen: () => void;
  onClose: () => void;
  draftOrder: OrderDraftContext | null;
  onClearDraft: () => void;
  initialOpenTarget?: { orderId: string; accessToken: string } | null;
  onClearInitialTarget?: () => void;
  onOrderCreated?: (order: WhatsAppOrder, clearCart?: boolean) => void;
  products: Product[];
  onOpenProduct?: (product: Product) => void;
  onShowToast?: (msg: string) => void;
}

const QUICK_CUSTOMER_PROMPTS = [
  'Disponible en stock ?',
  "Livraison possible aujourd'hui à Ouaga ?",
  'Je paie par Orange Money',
  'Je confirme ma commande'
];

function renderStatusMeta(status: WhatsAppOrder['status'], statusLabel: string) {
  switch (status) {
    case 'delivered':
      return {
        icon: <CheckCircle2 className="w-3.5 h-3.5 text-[#1F5A40]" />,
        text: statusLabel || 'Livré',
        textClass: 'text-[#1F5A40]'
      };
    case 'paid':
      return {
        icon: <Check className="w-3.5 h-3.5 text-[#1F5A40]" />,
        text: statusLabel || 'Payé',
        textClass: 'text-[#1F5A40]'
      };
    case 'pending':
      return {
        icon: <Truck className="w-3.5 h-3.5 text-amber-700" />,
        text: statusLabel || 'À livrer',
        textClass: 'text-amber-700'
      };
    default:
      return {
        icon: <Clock className="w-3.5 h-3.5 text-[#123B2A]" />,
        text: statusLabel || 'En discussion',
        textClass: 'text-[#123B2A]'
      };
  }
}

export const OrderChatWidget: React.FC<OrderChatWidgetProps> = ({
  isOpen,
  onOpen,
  onClose,
  draftOrder,
  onClearDraft,
  initialOpenTarget,
  onClearInitialTarget,
  onOrderCreated,
  products,
  onOpenProduct,
  onShowToast
}) => {
  const [sessions, setSessions] = useState<StoredCustomerChatSession[]>(() => loadStoredChatSessions());
  const [threads, setThreads] = useState<OrderThread[]>([]);
  const [activeOrderId, setActiveOrderId] = useState<string | null>(null);
  const [activeToken, setActiveToken] = useState<string | null>(null);
  const [activeThread, setActiveThread] = useState<OrderThread | null>(null);
  const [messages, setMessages] = useState<OrderChatMessage[]>([]);
  const [isLoadingThread, setIsLoadingThread] = useState(false);

  // Compose Order Form state
  const storedProfile = loadStoredCustomerProfile();
  const [customerName, setCustomerName] = useState(storedProfile.customerName);
  const [customerPhone, setCustomerPhone] = useState(storedProfile.customerPhone);
  const [customerCity, setCustomerCity] = useState(storedProfile.customerCity);
  const [paymentMethod, setPaymentMethod] = useState(storedProfile.paymentMethod);
  const [referralCode, setReferralCode] = useState('');
  const [initialMessage, setInitialMessage] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmittingOrder, setIsSubmittingOrder] = useState(false);

  // Chat composer & connection state
  const [messageInput, setMessageInput] = useState('');
  const [isSendingMsg, setIsSendingMsg] = useState(false);
  const [wsConnected, setWsConnected] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [notifPermission, setNotifPermission] = useState<NotificationPermission>(() =>
    typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'default'
  );
  const [customerPushEnabled, setCustomerPushEnabled] = useState<boolean>(() =>
    hasStoredPushOptIn('customer')
  );
  const [isTogglingPush, setIsTogglingPush] = useState(false);
  const [isTestingPush, setIsTestingPush] = useState(false);
  const [pushBannerNotice, setPushBannerNotice] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isOpenRef = useRef(isOpen);
  isOpenRef.current = isOpen;
  const activeOrderIdRef = useRef(activeOrderId);
  activeOrderIdRef.current = activeOrderId;

  const totalUnread = threads.reduce((acc, t) => acc + (t.unreadForCustomer || 0), 0);

  useEffect(() => {
    const defaultTitle = 'HUIZE SHOP — Boutique de Mode & Chaussures au Burkina Faso';
    if (totalUnread > 0) {
      document.title = `(${totalUnread}) Réponse boutique — HUIZE SHOP`;
    } else if (!document.title.includes('Admin Boutique')) {
      document.title = defaultTitle;
    }
    return () => {
      if (!document.title.includes('Admin Boutique')) {
        document.title = defaultTitle;
      }
    };
  }, [totalUnread]);

  // Sync draft context into compose form when opened from Product or Cart
  useEffect(() => {
    if (draftOrder) {
      const profile = loadStoredCustomerProfile();
      setCustomerName(draftOrder.customerName || profile.customerName || '');
      setCustomerPhone(draftOrder.customerPhone || profile.customerPhone || '');
      setCustomerCity(draftOrder.customerCity || profile.customerCity || 'Ouagadougou');
      setPaymentMethod(draftOrder.paymentMethod || profile.paymentMethod || 'Orange Money / Moov Money');
      setReferralCode(normalizeReferralCode(draftOrder.referralCode));
      setInitialMessage('');
      setFormError(null);
      setActiveOrderId(null);
      setActiveThread(null);
    }
  }, [draftOrder]);

  // Handle deep-link ?suivi=CMD-XXXX&cle=...
  useEffect(() => {
    if (initialOpenTarget?.orderId && initialOpenTarget?.accessToken) {
      const nextSessions = saveStoredChatSession({
        orderId: initialOpenTarget.orderId,
        accessToken: initialOpenTarget.accessToken
      });
      setSessions(nextSessions);
      setActiveOrderId(initialOpenTarget.orderId);
      setActiveToken(initialOpenTarget.accessToken);
      onClearInitialTarget?.();
    }
  }, [initialOpenTarget, onClearInitialTarget]);

  const refreshThreadsList = useCallback(async (currentSessions: StoredCustomerChatSession[]) => {
    if (currentSessions.length === 0) {
      setThreads([]);
      return;
    }
    const fetched = await fetchMyChatThreads(currentSessions);
    setThreads(fetched);
  }, []);

  useEffect(() => {
    refreshThreadsList(sessions);
    if (sessions.length > 0) {
      void syncCustomerPushSessionsIfSubscribed(sessions);
    }
  }, [sessions, refreshThreadsList]);

  useEffect(() => {
    let cancelled = false;
    getExistingPushSubscription().then((sub) => {
      if (cancelled) return;
      if (sub && typeof Notification !== 'undefined' && Notification.permission === 'granted' && hasStoredPushOptIn('customer')) {
        setCustomerPushEnabled(true);
      } else if (!sub || (typeof Notification !== 'undefined' && Notification.permission === 'denied')) {
        setCustomerPushEnabled(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  // Open & load a specific thread
  const loadThread = useCallback(
    async (orderId: string, token: string) => {
      setIsLoadingThread(true);
      const res = await fetchCustomerThread(orderId, token);
      setIsLoadingThread(false);
      if (res.success && res.thread) {
        setActiveThread(res.thread);
        setMessages(res.messages || []);
        if ((res.thread.unreadForCustomer || 0) > 0) {
          markCustomerThreadRead(orderId, token);
          setThreads((prev) =>
            prev.map((t) => (t.id === orderId ? { ...t, unreadForCustomer: 0 } : t))
          );
        }
      } else if (res.error) {
        onShowToast?.(res.error);
      }
    },
    [onShowToast]
  );

  useEffect(() => {
    if (isOpen && activeOrderId && activeToken) {
      loadThread(activeOrderId, activeToken);
    }
  }, [isOpen, activeOrderId, activeToken, loadThread]);

  // Scroll to newest message
  useEffect(() => {
    if (isOpen && activeOrderId && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [isOpen, activeOrderId, messages.length]);

  // Real-time WebSocket connection across ALL stored customer order sessions
  const sessionsSignature = sessions.map((s) => s.orderId).join('|');

  useEffect(() => {
    const targetId = activeOrderId || sessions[0]?.orderId;
    const targetToken =
      activeToken || (targetId ? getStoredTokenForOrder(targetId) : null);

    if ((!targetId || !targetToken) && sessions.length === 0) {
      setWsConnected(false);
      return;
    }

    let closedByEffect = false;

    const connectWs = () => {
      if (closedByEffect) return;
      const wsUrl = getChatWsUrl();
      if (!wsUrl) return;

      try {
        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
          const authSessions = sessions.map((s) => ({
            orderId: s.orderId,
            token: s.accessToken
          }));
          if (targetId && targetToken && !authSessions.some((s) => s.orderId === targetId)) {
            authSessions.unshift({ orderId: targetId, token: targetToken });
          }
          ws.send(
            JSON.stringify({
              type: 'auth:customer',
              orderId: targetId,
              token: targetToken,
              sessions: authSessions
            })
          );
        };

        ws.onmessage = (evt) => {
          try {
            const payload = JSON.parse(evt.data);
            if (payload.type === 'auth:ok') {
              setWsConnected(true);
              if (isOpenRef.current && activeOrderIdRef.current) {
                const tok = getStoredTokenForOrder(activeOrderIdRef.current) || targetToken;
                if (tok) loadThread(activeOrderIdRef.current, tok);
              }
            } else if (payload.type === 'chat:message' && payload.message) {
              const incomingMsg = payload.message as OrderChatMessage;
              if (payload.thread) {
                setThreads((prev) => {
                  const exists = prev.some((t) => t.id === payload.thread.id);
                  if (!exists) return [payload.thread, ...prev];
                  return prev.map((t) => (t.id === payload.thread.id ? payload.thread : t));
                });
                if (activeOrderIdRef.current === incomingMsg.threadId) {
                  setActiveThread(payload.thread);
                }
              }

              if (activeOrderIdRef.current === incomingMsg.threadId) {
                setMessages((prev) => {
                  if (prev.some((m) => m.id === incomingMsg.id)) return prev;
                  return [...prev, incomingMsg];
                });
                if (isOpenRef.current && incomingMsg.sender !== 'customer') {
                  const tok = getStoredTokenForOrder(incomingMsg.threadId) || targetToken;
                  if (tok) markCustomerThreadRead(incomingMsg.threadId, tok);
                }
              }

              if (incomingMsg.sender === 'merchant') {
                playChatNotificationChime();
                const isViewingThisThread =
                  isOpenRef.current && activeOrderIdRef.current === incomingMsg.threadId;
                if (!isViewingThisThread) {
                  onShowToast?.(
                    `HUIZE SHOP (${incomingMsg.threadId}) : ${incomingMsg.text.slice(0, 80)}`
                  );
                }
                if (!isViewingThisThread || document.hidden) {
                  const tok = getStoredTokenForOrder(incomingMsg.threadId) || '';
                  void showInstantBrowserNotification({
                    title: `Réponse HUIZE SHOP (${incomingMsg.threadId})`,
                    body: incomingMsg.text,
                    url: `/?suivi=${encodeURIComponent(incomingMsg.threadId)}${
                      tok ? `&cle=${encodeURIComponent(tok)}` : ''
                    }`,
                    tag: `huize-customer-${incomingMsg.threadId}`
                  });
                }
              }
            } else if (payload.type === 'chat:status' && payload.thread) {
              setThreads((prev) =>
                prev.map((t) => (t.id === payload.thread.id ? payload.thread : t))
              );
              if (activeOrderIdRef.current === payload.thread.id) {
                setActiveThread(payload.thread);
                if (payload.message) {
                  setMessages((prev) =>
                    prev.some((m) => m.id === payload.message.id)
                      ? prev
                      : [...prev, payload.message]
                  );
                }
              }
              playChatNotificationChime();
              const isViewingThisThread =
                isOpenRef.current && activeOrderIdRef.current === payload.thread.id;
              if (!isViewingThisThread) {
                onShowToast?.(
                  `Commande ${payload.thread.orderId} : ${payload.thread.statusLabel}`
                );
              }
              if (!isViewingThisThread || document.hidden) {
                const tok = getStoredTokenForOrder(payload.thread.orderId) || '';
                void showInstantBrowserNotification({
                  title: `Commande ${payload.thread.orderId} : ${payload.thread.statusLabel}`,
                  body: payload.message?.text || 'Statut de votre commande mis à jour.',
                  url: `/?suivi=${encodeURIComponent(payload.thread.orderId)}${
                    tok ? `&cle=${encodeURIComponent(tok)}` : ''
                  }`,
                  tag: `huize-customer-${payload.thread.orderId}`
                });
              }
            }
          } catch {
            // Ignore malformed WS message
          }
        };

        ws.onclose = () => {
          setWsConnected(false);
          if (!closedByEffect) {
            reconnectTimerRef.current = setTimeout(connectWs, 3500);
          }
        };

        ws.onerror = () => {
          setWsConnected(false);
        };
      } catch {
        setWsConnected(false);
      }
    };

    connectWs();

    return () => {
      closedByEffect = true;
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [activeOrderId, activeToken, sessionsSignature, loadThread, onShowToast]);

  const handleSubmitOrderDraft = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!draftOrder) return;

    const cleanName = customerName.trim();
    const cleanPhone = customerPhone.trim();
    const cleanCity = customerCity.trim() || 'Ouagadougou';

    if (cleanName.length < 2) {
      setFormError('Veuillez saisir votre nom complet.');
      return;
    }
    if (cleanPhone.replace(/[^0-9]/g, '').length < 6) {
      setFormError('Veuillez indiquer un numéro de téléphone ou WhatsApp valide.');
      return;
    }

    setFormError(null);
    setIsSubmittingOrder(true);

    const res = await createOrderChatThread({
      customerName: cleanName,
      customerPhone: cleanPhone,
      customerCity: cleanCity,
      paymentMethod,
      items: draftOrder.items,
      initialMessage: initialMessage.trim() || undefined,
      referralCode: normalizeReferralCode(referralCode) || undefined
    });

    setIsSubmittingOrder(false);

    if (!res.success || !res.thread || !res.accessToken) {
      setFormError(res.error || "Impossible d'envoyer la commande.");
      return;
    }

    const updatedSessions = loadStoredChatSessions();
    setSessions(updatedSessions);
    void syncCustomerPushSessionsIfSubscribed(updatedSessions);
    setThreads((prev) => [res.thread!, ...prev.filter((t) => t.id !== res.thread!.id)]);
    setActiveOrderId(res.thread.orderId);
    setActiveToken(res.accessToken);
    setActiveThread(res.thread);
    setMessages(res.messages || []);

    if (res.order) {
      onOrderCreated?.(res.order, draftOrder.clearCartOnSuccess);
    }
    onClearDraft();
    onShowToast?.(`Commande ${res.thread.orderId} envoyée dans la messagerie !`);
  };

  const handleSendMessage = async (textToSend?: string) => {
    const raw = typeof textToSend === 'string' ? textToSend : messageInput;
    const cleanText = raw.trim();
    if (!cleanText || !activeOrderId || !activeToken || isSendingMsg) return;

    setIsSendingMsg(true);
    if (!textToSend) setMessageInput('');

    const res = await sendCustomerChatMessage(activeOrderId, activeToken, cleanText);
    setIsSendingMsg(false);

    if (res.success && res.message) {
      setMessages((prev) =>
        prev.some((m) => m.id === res.message!.id) ? prev : [...prev, res.message!]
      );
      if (res.thread) {
        setActiveThread(res.thread);
        setThreads((prev) =>
          prev.map((t) => (t.id === res.thread!.id ? res.thread! : t))
        );
      }
    } else {
      if (!textToSend) setMessageInput(cleanText);
      onShowToast?.(res.error || "Le message n'a pas pu être envoyé.");
    }
  };

  const handleEnableNotifications = async () => {
    setIsTogglingPush(true);
    setPushBannerNotice(null);

    if (customerPushEnabled) {
      await unsubscribeDeviceFromWebPush('customer');
      setCustomerPushEnabled(false);
      setIsTogglingPush(false);
      setPushBannerNotice('Alertes désactivées sur cet appareil.');
      return;
    }

    const res = await subscribeDeviceToWebPush({ role: 'customer', sessions });
    setIsTogglingPush(false);
    if (typeof Notification !== 'undefined') {
      setNotifPermission(Notification.permission);
    }
    if (res.success) {
      setCustomerPushEnabled(true);
      playChatNotificationChime();
      onShowToast?.('Alertes activées sur votre appareil !');
      setPushBannerNotice('Alertes activées ! Vous serez prévenu dès que la boutique répond.');
    } else {
      setPushBannerNotice(res.error || "Impossible d'activer les notifications.");
    }
  };

  const handleTestCustomerPush = async () => {
    setIsTestingPush(true);
    setPushBannerNotice(null);
    const res = await sendTestPushNotification('customer');
    setIsTestingPush(false);
    if (res.success) {
      setPushBannerNotice('Notification de test envoyée ! Vérifiez votre écran.');
    } else {
      setPushBannerNotice(res.error || 'Échec du test de notification.');
    }
  };

  const resolveProductForSnapshot = (snap: OrderItemSnapshot): Product | undefined => {
    return products.find(
      (p) => p.id === snap.productId || (snap.ref && p.ref.toLowerCase() === snap.ref.toLowerCase())
    );
  };

  const draftTotal = draftOrder
    ? draftOrder.items.reduce((acc, i) => acc + i.price * i.quantity, 0)
    : 0;

  return (
    <>
      {/* Compact Floating Launcher Button (keeps <= 15% mobile sticky cap) */}
      {!isOpen && (
        <button
          type="button"
          onClick={() => {
            refreshThreadsList(sessions);
            onOpen();
          }}
          aria-label="Ouvrir la messagerie de commande"
          className="fixed bottom-4 right-4 z-40 inline-flex items-center gap-2 px-4 py-3 rounded-full bg-[#123B2A] hover:bg-[#1F5A40] text-white shadow-xl border border-[#D8F36A]/50 transition-transform active:scale-95 cursor-pointer"
        >
          <MessageSquare className="w-4 h-4 text-[#D8F36A]" />
          <span className="text-xs sm:text-sm font-bold whitespace-nowrap">
            {threads.length > 0 ? 'Mes commandes' : 'Commander ici'}
          </span>
          {totalUnread > 0 && (
            <span className="min-w-5 h-5 px-1.5 rounded-full bg-[#D8F36A] text-[#123B2A] text-[11px] font-extrabold flex items-center justify-center tabular-nums">
              {totalUnread}
            </span>
          )}
        </button>
      )}

      {/* Drawer / Modal */}
      {isOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Messagerie Commande HUIZE SHOP"
          onClick={onClose}
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-[#123B2A]/60 backdrop-blur-xs"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full sm:max-w-lg h-[90vh] sm:h-[640px] bg-white sm:rounded-2xl rounded-t-2xl border border-[#E1E3DA] shadow-2xl flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="bg-[#123B2A] text-white px-4 py-3.5 flex items-center justify-between gap-2 shrink-0">
              <div className="flex items-center gap-2.5 min-w-0">
                {(activeOrderId || draftOrder) && threads.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      onClearDraft();
                      setActiveOrderId(null);
                      setActiveThread(null);
                    }}
                    title="Voir toutes mes discussions"
                    className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white cursor-pointer shrink-0"
                  >
                    <ArrowLeft className="w-4 h-4" />
                  </button>
                )}

                <div className="min-w-0">
                  <h2 className="text-sm sm:text-base font-bold font-title truncate">
                    {draftOrder
                      ? 'Commander sur le site'
                      : activeThread
                      ? `Commande ${activeThread.orderId}`
                      : 'Messagerie HUIZE SHOP'}
                  </h2>
                  <div className="flex items-center gap-2 text-[11px] text-white/80 truncate">
                    {activeThread ? (
                      <>
                        <span
                          className={`inline-block w-2 h-2 rounded-full ${
                            wsConnected ? 'bg-[#D8F36A]' : 'bg-white/40'
                          }`}
                        />
                        <span>{wsConnected ? 'Discussion en direct' : 'Synchronisé'}</span>
                        <span>·</span>
                        <span>{activeThread.statusLabel}</span>
                      </>
                    ) : (
                      <span>Réponse directe de la boutique à Ouagadougou</span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                {activeOrderId && activeToken && (
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(
                          buildPrivateTrackUrl(activeOrderId, activeToken)
                        );
                        setCopiedLink(true);
                        onShowToast?.('Lien privé de suivi copié !');
                        setTimeout(() => setCopiedLink(false), 2000);
                      } catch {
                        onShowToast?.('Impossible de copier le lien.');
                      }
                    }}
                    title="Copier mon lien privé de suivi"
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-[11px] font-semibold cursor-pointer"
                  >
                    {copiedLink ? <Check className="w-3.5 h-3.5 text-[#D8F36A]" /> : <Copy className="w-3.5 h-3.5" />}
                    <span className="hidden sm:inline">Suivi</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Fermer"
                  className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* VIEW 1: COMPOSE NEW IN-SITE ORDER */}
            {draftOrder && (
              <form
                onSubmit={handleSubmitOrderDraft}
                className="flex-1 overflow-y-auto p-4 sm:p-5 flex flex-col gap-4 bg-[#FAF9F5]"
              >
                {/* Ordered items preview */}
                <div className="bg-white border border-[#E1E3DA] rounded-xl p-3.5">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-[#123B2A] uppercase tracking-wider">
                      Articles sélectionnés ({draftOrder.items.length})
                    </span>
                    <span className="text-sm font-extrabold text-[#123B2A] tabular-nums">
                      {formatFCFA(draftTotal)}
                    </span>
                  </div>

                  <div className="flex flex-col gap-2 max-h-36 overflow-y-auto">
                    {draftOrder.items.map((item, idx) => (
                      <div key={idx} className="flex items-center gap-2.5 text-xs">
                        <img
                          src={item.image || `/api/products/${encodeURIComponent(item.productId)}/image.jpg`}
                          alt={item.name}
                          className="w-11 h-11 rounded-lg object-cover bg-[#EFEFE6] border border-[#E1E3DA] shrink-0"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-[#123B2A] truncate">{item.name}</p>
                          <p className="text-[11px] text-[#6B726C]">
                            Qté {item.quantity} · Taille {item.size || 'Standard'} · {formatFCFA(item.price)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Customer contact fields */}
                <div className="bg-white border border-[#E1E3DA] rounded-xl p-4 flex flex-col gap-3 text-xs">
                  <div>
                    <label className="block font-bold text-[#123B2A] mb-1">
                      Votre Nom &amp; Prénom *
                    </label>
                    <input
                      type="text"
                      required
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      placeholder="Ex : Ibrahim Ouédraogo"
                      className="w-full p-2.5 rounded-lg border border-[#E1E3DA] bg-[#FAF9F5] focus:outline-[#1F5A40]"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block font-bold text-[#123B2A] mb-1">
                        Téléphone / WhatsApp *
                      </label>
                      <input
                        type="tel"
                        required
                        value={customerPhone}
                        onChange={(e) => setCustomerPhone(e.target.value)}
                        placeholder="Ex : +226 70 XX XX XX"
                        className="w-full p-2.5 rounded-lg border border-[#E1E3DA] bg-[#FAF9F5] focus:outline-[#1F5A40]"
                      />
                    </div>

                    <div>
                      <label className="block font-bold text-[#123B2A] mb-1">
                        Ville &amp; Quartier *
                      </label>
                      <input
                        type="text"
                        required
                        value={customerCity}
                        onChange={(e) => setCustomerCity(e.target.value)}
                        placeholder="Ex : Ouaga, Karpala"
                        className="w-full p-2.5 rounded-lg border border-[#E1E3DA] bg-[#FAF9F5] focus:outline-[#1F5A40]"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block font-bold text-[#123B2A] mb-1">
                        Mode de règlement
                      </label>
                      <select
                        value={paymentMethod}
                        onChange={(e) => setPaymentMethod(e.target.value)}
                        className="w-full p-2.5 rounded-lg border border-[#E1E3DA] bg-[#FAF9F5] focus:outline-[#1F5A40]"
                      >
                        <option value="Orange Money / Moov Money">Orange Money / Moov Money</option>
                        <option value="Espèces à la livraison">Espèces à la livraison</option>
                        <option value="Paiement en boutique">Paiement en boutique Ouaga</option>
                      </select>
                    </div>

                    <div>
                      <label className="block font-bold text-[#123B2A] mb-1">
                        Code conseiller (optionnel)
                      </label>
                      <input
                        type="text"
                        value={referralCode}
                        onChange={(e) => setReferralCode(e.target.value.toUpperCase())}
                        placeholder="Ex : MOUSA"
                        className="w-full p-2.5 rounded-lg border border-[#E1E3DA] bg-[#FAF9F5] uppercase font-mono focus:outline-[#1F5A40]"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block font-bold text-[#123B2A] mb-1">
                      Message pour la boutique (optionnel)
                    </label>
                    <textarea
                      rows={2}
                      value={initialMessage}
                      onChange={(e) => setInitialMessage(e.target.value)}
                      placeholder="Ex : Merci de confirmer si la livraison est possible ce soir..."
                      className="w-full p-2.5 rounded-lg border border-[#E1E3DA] bg-[#FAF9F5] resize-none focus:outline-[#1F5A40]"
                    />
                  </div>

                  {formError && (
                    <p className="text-xs font-semibold text-red-600">{formError}</p>
                  )}
                </div>

                <div className="flex flex-col gap-2 mt-auto">
                  <button
                    type="submit"
                    disabled={isSubmittingOrder}
                    className="w-full py-3.5 px-5 rounded-xl bg-[#123B2A] hover:bg-[#1F5A40] text-white font-bold text-sm shadow-md transition-all cursor-pointer disabled:opacity-60 flex items-center justify-center gap-2"
                  >
                    <MessageSquare className="w-4 h-4 text-[#D8F36A]" />
                    <span>
                      {isSubmittingOrder
                        ? 'Envoi de la commande...'
                        : 'Valider & Ouvrir la discussion'}
                    </span>
                  </button>

                  <p className="text-[11px] text-[#6B726C] text-center flex items-center justify-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5 text-[#1F5A40]" />
                    <span>Aucun prélèvement en ligne · Suivi privé garanti</span>
                  </p>
                </div>
              </form>
            )}

            {/* VIEW 2: CONVERSATION LIST */}
            {!draftOrder && !activeOrderId && (
              <div className="flex-1 overflow-y-auto p-4 bg-[#FAF9F5] flex flex-col gap-3">
                {threads.length === 0 ? (
                  <div className="my-auto text-center px-4 py-8">
                    <div className="w-14 h-14 rounded-full bg-white border border-[#E1E3DA] flex items-center justify-center mx-auto mb-3 text-[#123B2A]">
                      <MessageSquare className="w-6 h-6" />
                    </div>
                    <h3 className="text-base font-bold font-title text-[#123B2A] mb-1">
                      Aucune discussion en cours
                    </h3>
                    <p className="text-xs text-[#6B726C] max-w-xs mx-auto mb-5 leading-relaxed">
                      Ouvrez n’importe quel article ou votre panier, puis cliquez sur « Commander sur le site » pour discuter directement avec HUIZE SHOP.
                    </p>
                    <a
                      href={getDirectWhatsAppUrl()}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#25D366] text-white text-xs font-bold shadow-xs"
                    >
                      <span>Ou nous écrire sur WhatsApp</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                ) : (
                  <>
                    <div className="bg-white border border-[#E1E3DA] rounded-xl p-3 flex flex-col gap-2">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          {customerPushEnabled ? (
                            <BellRing className="w-4 h-4 text-[#1F5A40] shrink-0" />
                          ) : (
                            <Bell className="w-4 h-4 text-[#123B2A] shrink-0" />
                          )}
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-[#123B2A] truncate">
                              {customerPushEnabled
                                ? 'Alertes téléphone & PC actives'
                                : 'Recevoir une alerte quand on vous répond ?'}
                            </p>
                            <p className="text-[10px] text-[#6B726C] truncate">
                              {customerPushEnabled
                                ? 'Vous êtes averti même si vous quittez le site'
                                : 'Notification directe sur votre écran'}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          {customerPushEnabled && (
                            <button
                              type="button"
                              onClick={handleTestCustomerPush}
                              disabled={isTestingPush}
                              className="px-2.5 py-1 rounded-lg bg-[#FAF9F5] border border-[#E1E3DA] text-[11px] font-bold text-[#123B2A] cursor-pointer"
                            >
                              {isTestingPush ? '...' : 'Tester'}
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={handleEnableNotifications}
                            disabled={isTogglingPush}
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold cursor-pointer ${
                              customerPushEnabled
                                ? 'bg-[#EFEFE6] text-[#123B2A]'
                                : 'bg-[#123B2A] text-[#D8F36A]'
                            }`}
                          >
                            {isTogglingPush ? '...' : customerPushEnabled ? 'Couper' : 'Activer'}
                          </button>
                        </div>
                      </div>
                      {pushBannerNotice && (
                        <p className="text-[11px] text-[#1F5A40] bg-[#FAF9F5] border border-[#E1E3DA] rounded-lg px-2.5 py-1.5 leading-snug">
                          {pushBannerNotice}
                        </p>
                      )}
                    </div>

                    <p className="text-xs text-[#6B726C] font-medium">
                      Vos commandes et discussions privées ({threads.length})
                    </p>
                    {threads.map((t) => {
                      const statusMeta = renderStatusMeta(t.status, t.statusLabel);
                      const firstItem = t.items?.[0];
                      return (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => {
                            const tok = getStoredTokenForOrder(t.orderId);
                            if (tok) {
                              setActiveOrderId(t.orderId);
                              setActiveToken(tok);
                            }
                          }}
                          className="w-full text-left bg-white hover:bg-[#F8F7F2] border border-[#E1E3DA] rounded-xl p-3 flex items-center gap-3 transition-colors cursor-pointer"
                        >
                          {firstItem ? (
                            <img
                              src={
                                firstItem.image ||
                                `/api/products/${encodeURIComponent(firstItem.productId)}/image.jpg`
                              }
                              alt={firstItem.name}
                              className="w-12 h-12 rounded-lg object-cover bg-[#EFEFE6] border border-[#E1E3DA] shrink-0"
                            />
                          ) : (
                            <div className="w-12 h-12 rounded-lg bg-[#EFEFE6] flex items-center justify-center text-[#123B2A] shrink-0">
                              <Package className="w-5 h-5" />
                            </div>
                          )}

                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-xs font-bold text-[#123B2A] truncate">
                                {t.orderId} · {formatFCFA(t.total)}
                              </span>
                              <span
                                className={`inline-flex items-center gap-1 text-[11px] font-semibold shrink-0 ${statusMeta.textClass}`}
                              >
                                {statusMeta.icon}
                                <span>{statusMeta.text}</span>
                              </span>
                            </div>
                            <p className="text-xs text-[#4A5568] truncate mt-0.5">
                              {t.lastMessageText || t.itemsSummary}
                            </p>
                          </div>

                          {(t.unreadForCustomer || 0) > 0 && (
                            <span className="min-w-5 h-5 px-1.5 rounded-full bg-[#123B2A] text-[#D8F36A] text-[11px] font-bold flex items-center justify-center shrink-0 tabular-nums">
                              {t.unreadForCustomer}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </>
                )}
              </div>
            )}

            {/* VIEW 3: ACTIVE CONVERSATION */}
            {!draftOrder && activeOrderId && (
              <>
                {/* Pinned Order Summary */}
                {activeThread && (
                  <div className="bg-[#FAF9F5] border-b border-[#E1E3DA] px-4 py-2.5 flex items-center justify-between gap-3 shrink-0">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="flex -space-x-2 shrink-0">
                        {(activeThread.items || []).slice(0, 3).map((item, i) => (
                          <img
                            key={i}
                            src={
                              item.image ||
                              `/api/products/${encodeURIComponent(item.productId)}/image.jpg`
                            }
                            alt={item.name}
                            className="w-10 h-10 rounded-lg object-cover bg-white border border-[#E1E3DA]"
                          />
                        ))}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-[#123B2A] truncate">
                          {activeThread.itemsSummary}
                        </p>
                        <p className="text-[11px] text-[#6B726C] tabular-nums">
                          {formatFCFA(activeThread.total)} · {activeThread.customerCity}
                        </p>
                      </div>
                    </div>

                    <a
                      href={getDirectWhatsAppUrl(
                        `Bonjour HUIZE SHOP, je vous écris au sujet de ma commande ${activeThread.orderId} (${activeThread.itemsSummary}).`
                      )}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="Continuer sur WhatsApp"
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#25D366]/15 hover:bg-[#25D366]/25 text-[#123B2A] text-[11px] font-bold shrink-0 whitespace-nowrap"
                    >
                      <Phone className="w-3 h-3 text-[#1F5A40]" />
                      <span>WhatsApp</span>
                    </a>
                  </div>
                )}

                {/* Web Push Notification Opt-in & Test Banner */}
                {(notifPermission !== 'denied' || customerPushEnabled || pushBannerNotice) && (
                  <div className="bg-[#EFEFE6] border-b border-[#E1E3DA] px-4 py-2 flex flex-col gap-1.5 text-[11px] text-[#123B2A] shrink-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex items-center gap-1.5 font-medium truncate">
                        {customerPushEnabled ? (
                          <>
                            <BellRing className="w-3.5 h-3.5 text-[#1F5A40] shrink-0" />
                            <span>Alertes téléphone &amp; PC actives</span>
                          </>
                        ) : (
                          <>
                            <Bell className="w-3.5 h-3.5 text-[#123B2A] shrink-0" />
                            <span>Recevoir une alerte quand la boutique répond ?</span>
                          </>
                        )}
                      </span>

                      <div className="flex items-center gap-2 shrink-0">
                        {customerPushEnabled && (
                          <button
                            type="button"
                            onClick={handleTestCustomerPush}
                            disabled={isTestingPush}
                            className="font-bold text-[#123B2A] hover:underline cursor-pointer"
                          >
                            {isTestingPush ? '...' : 'Tester'}
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={handleEnableNotifications}
                          disabled={isTogglingPush}
                          className={`inline-flex items-center gap-1 font-bold cursor-pointer ${
                            customerPushEnabled
                              ? 'text-[#6B726C] hover:text-red-700'
                              : 'text-[#1F5A40] hover:underline'
                          }`}
                        >
                          <span>
                            {isTogglingPush ? '...' : customerPushEnabled ? 'Couper' : 'Activer'}
                          </span>
                        </button>
                      </div>
                    </div>

                    {pushBannerNotice && (
                      <p className="text-[11px] text-[#1F5A40] leading-snug">{pushBannerNotice}</p>
                    )}
                  </div>
                )}

                {/* Messages Feed */}
                <div className="flex-1 overflow-y-auto p-4 bg-[#F8F7F2] flex flex-col gap-3">
                  {isLoadingThread && messages.length === 0 ? (
                    <div className="my-auto text-center text-xs text-[#6B726C]">
                      Chargement des messages...
                    </div>
                  ) : (
                    messages.map((msg) => {
                      if (msg.sender === 'system') {
                        return (
                          <div
                            key={msg.id}
                            className="text-center text-[11px] text-[#6B726C] py-1 px-3 mx-auto border-y border-[#E1E3DA]"
                          >
                            {msg.text}
                          </div>
                        );
                      }

                      const isCustomer = msg.sender === 'customer';
                      const linkedProduct = msg.attachedProduct
                        ? resolveProductForSnapshot(msg.attachedProduct)
                        : undefined;

                      return (
                        <div
                          key={msg.id}
                          className={`flex flex-col max-w-[85%] ${
                            isCustomer ? 'self-end items-end' : 'self-start items-start'
                          }`}
                        >
                          <span className="text-[10px] text-[#6B726C] mb-1 px-1">
                            {msg.senderName} ·{' '}
                            {new Date(msg.createdAt).toLocaleTimeString('fr-FR', {
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </span>

                          <div
                            className={`rounded-2xl px-3.5 py-2.5 text-xs sm:text-sm leading-relaxed shadow-xs ${
                              isCustomer
                                ? 'bg-[#123B2A] text-white rounded-br-sm'
                                : 'bg-white text-[#202720] border border-[#E1E3DA] rounded-bl-sm'
                            }`}
                          >
                            <p className="whitespace-pre-wrap break-words">{msg.text}</p>

                            {msg.attachedProduct && (
                              <button
                                type="button"
                                onClick={() => {
                                  if (linkedProduct && onOpenProduct) {
                                    onClose();
                                    onOpenProduct(linkedProduct);
                                  }
                                }}
                                className={`mt-2 w-full text-left p-2 rounded-xl border flex items-center gap-2.5 transition-colors ${
                                  isCustomer
                                    ? 'bg-white/10 border-white/20 text-white hover:bg-white/15'
                                    : 'bg-[#FAF9F5] border-[#E1E3DA] text-[#123B2A] hover:bg-[#EFEFE6]'
                                } ${linkedProduct ? 'cursor-pointer' : 'cursor-default'}`}
                              >
                                <img
                                  src={
                                    msg.attachedProduct.image ||
                                    `/api/products/${encodeURIComponent(msg.attachedProduct.productId)}/image.jpg`
                                  }
                                  alt={msg.attachedProduct.name}
                                  className="w-11 h-11 rounded-lg object-cover bg-white shrink-0"
                                />
                                <div className="min-w-0 flex-1">
                                  <p className="text-xs font-bold truncate">
                                    {msg.attachedProduct.name}
                                  </p>
                                  <p className="text-[11px] opacity-85 tabular-nums">
                                    {formatFCFA(msg.attachedProduct.price)}
                                    {msg.attachedProduct.size
                                      ? ` · ${msg.attachedProduct.size}`
                                      : ''}
                                  </p>
                                </div>
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* Quick Customer Reply Chips */}
                <div className="px-3 py-2 bg-white border-t border-[#E1E3DA] flex gap-1.5 overflow-x-auto shrink-0">
                  {QUICK_CUSTOMER_PROMPTS.map((prompt) => (
                    <button
                      key={prompt}
                      type="button"
                      onClick={() => handleSendMessage(prompt)}
                      className="px-2.5 py-1 rounded-lg bg-[#FAF9F5] hover:bg-[#EFEFE6] border border-[#E1E3DA] text-[11px] font-medium text-[#123B2A] whitespace-nowrap shrink-0 cursor-pointer transition-colors"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>

                {/* Composer */}
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleSendMessage();
                  }}
                  className="p-3 bg-white border-t border-[#E1E3DA] flex items-center gap-2 shrink-0"
                >
                  <input
                    type="text"
                    value={messageInput}
                    onChange={(e) => setMessageInput(e.target.value)}
                    placeholder="Écrire un message à HUIZE SHOP..."
                    maxLength={1000}
                    className="flex-1 px-3.5 py-2.5 rounded-xl bg-[#FAF9F5] border border-[#E1E3DA] text-xs sm:text-sm focus:outline-[#1F5A40]"
                  />
                  <button
                    type="submit"
                    disabled={!messageInput.trim() || isSendingMsg}
                    aria-label="Envoyer le message"
                    className="p-2.5 rounded-xl bg-[#123B2A] hover:bg-[#1F5A40] text-[#D8F36A] disabled:opacity-40 transition-colors cursor-pointer shrink-0"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
};
