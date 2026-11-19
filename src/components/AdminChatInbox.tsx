import React, { useState, useEffect, useRef } from 'react';
import {
  MessageSquare,
  Search,
  Send,
  Phone,
  MapPin,
  Package,
  RefreshCw,
  ArrowLeft,
  Plus,
  X,
  ExternalLink,
  Clock,
  Truck,
  Check,
  CheckCircle2,
  Bell,
  BellOff,
  BellRing
} from 'lucide-react';
import {
  OrderChatMessage,
  OrderItemSnapshot,
  OrderThread,
  Product,
  WhatsAppOrder
} from '../types.ts';
import { formatFCFA, getCompactProductThumbnail } from '../utils/whatsapp.ts';

interface AdminChatInboxProps {
  threads: OrderThread[];
  selectedThreadId: string | null;
  onSelectThread: (threadId: string | null) => void;
  messages: OrderChatMessage[];
  isLoadingMessages: boolean;
  wsConnected: boolean;
  products: Product[];
  onSendMessage: (
    threadId: string,
    text: string,
    attachedProduct?: OrderItemSnapshot
  ) => Promise<void>;
  onUpdateStatus: (threadId: string, status: WhatsAppOrder['status']) => Promise<void>;
  onRefreshThreads: () => Promise<void>;
  adminPushEnabled?: boolean;
  isTogglingPush?: boolean;
  isTestingPush?: boolean;
  pushFeedback?: string | null;
  onTogglePush?: () => void;
  onTestPush?: () => void;
}

const MERCHANT_QUICK_REPLIES = [
  'Bonjour ! Oui, cet article est bien disponible en stock à Ouagadougou.',
  "Livraison possible aujourd'hui à Ouaga (frais : 1 000 F CFA). On confirme ?",
  'Vous pouvez payer par Orange Money / Moov Money au +226 53 74 27 48 ou à la livraison.',
  'Votre commande est confirmée et remise au livreur !'
];

function getStatusDisplay(status: WhatsAppOrder['status'], label: string) {
  switch (status) {
    case 'delivered':
      return {
        icon: <CheckCircle2 className="w-3.5 h-3.5 text-[#1F5A40]" />,
        text: label || 'Livré',
        className: 'text-[#1F5A40]'
      };
    case 'paid':
      return {
        icon: <Check className="w-3.5 h-3.5 text-[#1F5A40]" />,
        text: label || 'Payé',
        className: 'text-[#1F5A40]'
      };
    case 'pending':
      return {
        icon: <Truck className="w-3.5 h-3.5 text-amber-700" />,
        text: label || 'À livrer',
        className: 'text-amber-700'
      };
    default:
      return {
        icon: <Clock className="w-3.5 h-3.5 text-[#123B2A]" />,
        text: label || 'En discussion',
        className: 'text-[#123B2A]'
      };
  }
}

export const AdminChatInbox: React.FC<AdminChatInboxProps> = ({
  threads,
  selectedThreadId,
  onSelectThread,
  messages,
  isLoadingMessages,
  wsConnected,
  products,
  onSendMessage,
  onUpdateStatus,
  onRefreshThreads,
  adminPushEnabled = false,
  isTogglingPush = false,
  isTestingPush = false,
  pushFeedback = null,
  onTogglePush,
  onTestPush
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterMode, setFilterMode] = useState<'all' | 'unread' | 'discussion' | 'pending'>('all');
  const [replyText, setReplyText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showProductPicker, setShowProductPicker] = useState(false);
  const [productPickerQuery, setProductPickerQuery] = useState('');

  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const selectedThread = threads.find((t) => t.id === selectedThreadId) || null;

  useEffect(() => {
    if (selectedThreadId && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [selectedThreadId, messages.length]);

  const filteredThreads = threads.filter((t) => {
    const q = searchTerm.trim().toLowerCase();
    const matchesQuery =
      !q ||
      t.customerName.toLowerCase().includes(q) ||
      t.customerPhone.toLowerCase().includes(q) ||
      t.orderId.toLowerCase().includes(q) ||
      t.itemsSummary.toLowerCase().includes(q);
    if (!matchesQuery) return false;

    if (filterMode === 'unread') return (t.unreadForAdmin || 0) > 0;
    if (filterMode === 'discussion') return t.status === 'discussion';
    if (filterMode === 'pending') return t.status === 'pending';
    return true;
  });

  const unreadTotal = threads.reduce((acc, t) => acc + (t.unreadForAdmin || 0), 0);

  const handleSend = async (customText?: string, attachedProduct?: OrderItemSnapshot) => {
    if (!selectedThread) return;
    const text = (typeof customText === 'string' ? customText : replyText).trim();
    if (!text && !attachedProduct) return;

    setIsSending(true);
    if (!customText) setReplyText('');
    try {
      await onSendMessage(selectedThread.id, text, attachedProduct);
    } finally {
      setIsSending(false);
    }
  };

  const handleAttachProduct = async (product: Product) => {
    setShowProductPicker(false);
    setProductPickerQuery('');
    const snap: OrderItemSnapshot = {
      productId: product.id,
      name: product.name,
      ref: product.ref,
      image: getCompactProductThumbnail(product),
      size: product.sizes?.[0] || 'Standard',
      quantity: 1,
      price: product.price
    };
    await handleSend(
      replyText.trim() || `Voici cet article disponible : ${product.name} (${formatFCFA(product.price)})`,
      snap
    );
  };

  const pickerProducts = products
    .filter((p) => {
      const q = productPickerQuery.trim().toLowerCase();
      return !q || p.name.toLowerCase().includes(q) || p.ref.toLowerCase().includes(q);
    })
    .slice(0, 12);

  const buildCustomerWhatsAppLink = (thread: OrderThread) => {
    const digits = thread.customerPhone.replace(/[^0-9]/g, '');
    if (digits.length < 8) return null;
    const intl = digits.length === 8 ? `226${digits}` : digits;
    const text = `Bonjour ${thread.customerName}, suite à votre commande ${thread.orderId} sur HUIZE SHOP (${thread.itemsSummary})...`;
    return `https://wa.me/${intl}?text=${encodeURIComponent(text)}`;
  };

  return (
    <div className="bg-white border border-[#E1E3DA] rounded-2xl shadow-sm overflow-hidden flex flex-col lg:grid lg:grid-cols-12 min-h-[620px] max-h-[78vh]">
      {/* LEFT PANE: THREADS LIST */}
      <div
        className={`lg:col-span-5 border-b lg:border-b-0 lg:border-r border-[#E1E3DA] flex flex-col min-h-0 ${
          selectedThread ? 'hidden lg:flex' : 'flex'
        }`}
      >
        <div className="p-4 border-b border-[#E1E3DA] bg-[#FAF9F5] flex flex-col gap-3">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-bold font-title text-[#123B2A] flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-[#1F5A40]" />
                <span>Messagerie Clients</span>
                {unreadTotal > 0 && (
                  <span className="text-xs font-extrabold text-[#1F5A40] tabular-nums">
                    ({unreadTotal} non lu{unreadTotal > 1 ? 's' : ''})
                  </span>
                )}
              </h2>
              <p className="text-[11px] text-[#6B726C] flex items-center gap-1.5 mt-0.5">
                <span
                  className={`inline-block w-2 h-2 rounded-full ${
                    wsConnected ? 'bg-[#25D366]' : 'bg-gray-400'
                  }`}
                />
                <span>{wsConnected ? 'Temps réel actif' : 'Synchronisation'}</span>
              </p>
            </div>

            <button
              type="button"
              onClick={async () => {
                setIsRefreshing(true);
                await onRefreshThreads();
                setIsRefreshing(false);
              }}
              disabled={isRefreshing}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white border border-[#E1E3DA] hover:bg-[#EFEFE6] text-xs font-bold text-[#123B2A] cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span>Actualiser</span>
            </button>
          </div>

          {onTogglePush && (
            <div className="rounded-xl border border-[#E1E3DA] bg-white p-2.5 flex flex-col gap-2">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  {adminPushEnabled ? (
                    <BellRing className="w-4 h-4 text-[#1F5A40] shrink-0" />
                  ) : (
                    <Bell className="w-4 h-4 text-[#6B726C] shrink-0" />
                  )}
                  <div className="min-w-0">
                    <p className="text-[11px] font-bold text-[#123B2A] truncate">
                      {adminPushEnabled
                        ? 'Alertes Téléphone & PC actives'
                        : 'Recevoir les alertes sur Téléphone & PC'}
                    </p>
                    <p className="text-[10px] text-[#6B726C] truncate">
                      {adminPushEnabled
                        ? 'Notifié même si la page est fermée'
                        : 'Soyez prévenu dès qu’un client vous écrit'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  {adminPushEnabled && onTestPush && (
                    <button
                      type="button"
                      onClick={onTestPush}
                      disabled={isTestingPush}
                      className="px-2.5 py-1 rounded-lg bg-[#FAF9F5] border border-[#E1E3DA] hover:bg-[#EFEFE6] text-[11px] font-bold text-[#123B2A] cursor-pointer disabled:opacity-50"
                    >
                      {isTestingPush ? '...' : 'Tester'}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={onTogglePush}
                    disabled={isTogglingPush}
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold cursor-pointer disabled:opacity-50 ${
                      adminPushEnabled
                        ? 'bg-[#EFEFE6] text-[#123B2A] hover:bg-red-50 hover:text-red-700'
                        : 'bg-[#123B2A] text-[#D8F36A] hover:bg-[#1F5A40]'
                    }`}
                  >
                    {adminPushEnabled ? (
                      <>
                        <BellOff className="w-3 h-3" />
                        <span>Couper</span>
                      </>
                    ) : (
                      <>
                        <Bell className="w-3 h-3" />
                        <span>{isTogglingPush ? '...' : 'Activer'}</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {pushFeedback && (
                <p className="text-[11px] text-[#1F5A40] bg-[#FAF9F5] border border-[#E1E3DA] rounded-lg px-2.5 py-1.5 leading-snug">
                  {pushFeedback}
                </p>
              )}
            </div>
          )}

          <div className="relative">
            <Search className="w-4 h-4 text-[#6B726C] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Rechercher nom, téléphone, #CMD..."
              className="w-full pl-9 pr-3 py-2 rounded-lg bg-white border border-[#E1E3DA] text-xs focus:outline-[#1F5A40]"
            />
          </div>

          <div className="flex gap-1.5 overflow-x-auto pb-0.5">
            {(
              [
                { id: 'all', label: `Toutes (${threads.length})` },
                { id: 'unread', label: `Non lues (${threads.filter((t) => t.unreadForAdmin > 0).length})` },
                { id: 'discussion', label: 'En discussion' },
                { id: 'pending', label: 'À livrer' }
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setFilterMode(tab.id)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold whitespace-nowrap cursor-pointer transition-colors ${
                  filterMode === tab.id
                    ? 'bg-[#123B2A] text-white'
                    : 'bg-white border border-[#E1E3DA] text-[#4A5568] hover:bg-[#EFEFE6]'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-[#E1E3DA]">
          {filteredThreads.length === 0 ? (
            <div className="p-8 text-center text-xs text-[#6B726C]">
              Aucune conversation ne correspond à ce filtre pour le moment.
            </div>
          ) : (
            filteredThreads.map((t) => {
              const isSelected = t.id === selectedThreadId;
              const statusMeta = getStatusDisplay(t.status, t.statusLabel);
              const firstItem = t.items?.[0];
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => onSelectThread(t.id)}
                  className={`w-full text-left p-3.5 flex items-start gap-3 transition-colors cursor-pointer ${
                    isSelected ? 'bg-[#EFEFE6]' : 'bg-white hover:bg-[#FAF9F5]'
                  }`}
                >
                  {firstItem ? (
                    <img
                      src={
                        firstItem.image ||
                        `/api/products/${encodeURIComponent(firstItem.productId)}/image.jpg`
                      }
                      alt={firstItem.name}
                      className="w-12 h-12 rounded-lg object-cover bg-[#FAF9F5] border border-[#E1E3DA] shrink-0"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-lg bg-[#FAF9F5] border border-[#E1E3DA] flex items-center justify-center shrink-0">
                      <Package className="w-5 h-5 text-[#6B726C]" />
                    </div>
                  )}

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-bold text-[#123B2A] truncate">
                        {t.customerName} · {t.orderId}
                      </p>
                      <span className="text-[11px] font-bold text-[#123B2A] tabular-nums shrink-0">
                        {formatFCFA(t.total)}
                      </span>
                    </div>

                    <p className="text-[11px] text-[#4A5568] truncate mt-0.5">
                      {t.lastMessageText || t.itemsSummary}
                    </p>

                    <div className="flex items-center justify-between gap-2 mt-1 text-[10px] text-[#6B726C]">
                      <span className={`inline-flex items-center gap-1 font-semibold ${statusMeta.className}`}>
                        {statusMeta.icon}
                        <span>{statusMeta.text}</span>
                      </span>
                      <span>{t.customerCity}</span>
                    </div>
                  </div>

                  {(t.unreadForAdmin || 0) > 0 && (
                    <span className="min-w-5 h-5 px-1.5 rounded-full bg-[#123B2A] text-[#D8F36A] text-[11px] font-extrabold flex items-center justify-center shrink-0 tabular-nums">
                      {t.unreadForAdmin}
                    </span>
                  )}
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* RIGHT PANE: ACTIVE CONVERSATION */}
      <div
        className={`lg:col-span-7 flex flex-col min-h-0 bg-[#F8F7F2] ${
          selectedThread ? 'flex' : 'hidden lg:flex'
        }`}
      >
        {!selectedThread ? (
          <div className="m-auto p-8 text-center max-w-sm">
            <div className="w-14 h-14 rounded-full bg-white border border-[#E1E3DA] flex items-center justify-center mx-auto mb-3 text-[#123B2A]">
              <MessageSquare className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold font-title text-[#123B2A] mb-1">
              Sélectionnez une commande client
            </h3>
            <p className="text-xs text-[#6B726C]">
              Les commandes et messages envoyés depuis la boutique apparaissent ici en temps réel pour vous permettre de répondre directement.
            </p>
          </div>
        ) : (
          <>
            {/* Thread Top Bar */}
            <div className="bg-white border-b border-[#E1E3DA] p-3.5 sm:p-4 flex flex-col gap-3 shrink-0">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <button
                    type="button"
                    onClick={() => onSelectThread(null)}
                    className="lg:hidden p-1.5 rounded-lg bg-[#FAF9F5] border border-[#E1E3DA] text-[#123B2A] cursor-pointer"
                  >
                    <ArrowLeft className="w-4 h-4" />
                  </button>
                  <div className="min-w-0">
                    <h3 className="text-sm font-bold text-[#123B2A] truncate">
                      {selectedThread.customerName} · {selectedThread.orderId}
                    </h3>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-[#6B726C] mt-0.5">
                      <a
                        href={`tel:${selectedThread.customerPhone}`}
                        className="inline-flex items-center gap-1 text-[#1F5A40] font-semibold hover:underline"
                      >
                        <Phone className="w-3 h-3" />
                        <span>{selectedThread.customerPhone}</span>
                      </a>
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        <span>{selectedThread.customerCity}</span>
                      </span>
                      <span>· {selectedThread.paymentMethod}</span>
                      {selectedThread.referredByCode && (
                        <span>· Équipe : {selectedThread.referredByCode}</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {(() => {
                    const waUrl = buildCustomerWhatsAppLink(selectedThread);
                    return waUrl ? (
                      <a
                        href={waUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#25D366]/15 hover:bg-[#25D366]/25 text-[#123B2A] text-[11px] font-bold"
                      >
                        <span>WhatsApp</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    ) : null;
                  })()}

                  <select
                    value={selectedThread.status}
                    onChange={(e) =>
                      onUpdateStatus(
                        selectedThread.id,
                        e.target.value as WhatsAppOrder['status']
                      )
                    }
                    className="text-xs font-bold p-1.5 rounded-lg bg-[#FAF9F5] border border-[#E1E3DA] text-[#123B2A]"
                  >
                    <option value="discussion">En discussion</option>
                    <option value="pending">À livrer</option>
                    <option value="paid">Payé (Orange/Moov)</option>
                    <option value="delivered">Livré</option>
                  </select>
                </div>
              </div>

              {/* Ordered Items Visual Strip */}
              <div className="flex items-center gap-2.5 overflow-x-auto pb-1">
                {(selectedThread.items || []).map((item, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-[#FAF9F5] border border-[#E1E3DA] shrink-0 text-xs"
                  >
                    <img
                      src={
                        item.image ||
                        `/api/products/${encodeURIComponent(item.productId)}/image.jpg`
                      }
                      alt={item.name}
                      className="w-9 h-9 rounded-md object-cover bg-white border border-[#E1E3DA]"
                    />
                    <div>
                      <p className="font-bold text-[#123B2A] text-[11px] max-w-[140px] truncate">
                        {item.quantity}x {item.name}
                      </p>
                      <p className="text-[10px] text-[#6B726C] tabular-nums">
                        {item.size ? `${item.size} · ` : ''}
                        {formatFCFA(item.price)}
                      </p>
                    </div>
                  </div>
                ))}
                <div className="ml-auto pl-2 text-right shrink-0">
                  <p className="text-[10px] text-[#6B726C] uppercase font-bold">Total</p>
                  <p className="text-sm font-extrabold text-[#123B2A] tabular-nums">
                    {formatFCFA(selectedThread.total)}
                  </p>
                </div>
              </div>
            </div>

            {/* Messages Stream */}
            <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
              {isLoadingMessages && messages.length === 0 ? (
                <div className="m-auto text-xs text-[#6B726C]">Chargement de la discussion...</div>
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

                  const isMerchant = msg.sender === 'merchant';
                  return (
                    <div
                      key={msg.id}
                      className={`flex flex-col max-w-[85%] ${
                        isMerchant ? 'self-end items-end' : 'self-start items-start'
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
                          isMerchant
                            ? 'bg-[#123B2A] text-white rounded-br-sm'
                            : 'bg-white text-[#202720] border border-[#E1E3DA] rounded-bl-sm'
                        }`}
                      >
                        <p className="whitespace-pre-wrap break-words">{msg.text}</p>
                        {msg.attachedProduct && (
                          <div
                            className={`mt-2 p-2 rounded-xl border flex items-center gap-2.5 ${
                              isMerchant
                                ? 'bg-white/10 border-white/20 text-white'
                                : 'bg-[#FAF9F5] border-[#E1E3DA] text-[#123B2A]'
                            }`}
                          >
                            <img
                              src={
                                msg.attachedProduct.image ||
                                `/api/products/${encodeURIComponent(msg.attachedProduct.productId)}/image.jpg`
                              }
                              alt={msg.attachedProduct.name}
                              className="w-10 h-10 rounded-lg object-cover bg-white shrink-0"
                            />
                            <div className="min-w-0">
                              <p className="text-xs font-bold truncate">
                                {msg.attachedProduct.name}
                              </p>
                              <p className="text-[11px] opacity-85 tabular-nums">
                                {formatFCFA(msg.attachedProduct.price)}
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Product Picker Popover */}
            {showProductPicker && (
              <div className="bg-white border-t border-[#E1E3DA] p-3 max-h-52 overflow-y-auto shrink-0">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <input
                    type="text"
                    value={productPickerQuery}
                    onChange={(e) => setProductPickerQuery(e.target.value)}
                    placeholder="Chercher un article du catalogue à envoyer..."
                    className="flex-1 px-3 py-1.5 rounded-lg bg-[#FAF9F5] border border-[#E1E3DA] text-xs focus:outline-[#1F5A40]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowProductPicker(false)}
                    className="p-1.5 rounded-lg bg-[#FAF9F5] border border-[#E1E3DA] text-[#123B2A] cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {pickerProducts.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => handleAttachProduct(p)}
                      className="text-left p-2 rounded-lg border border-[#E1E3DA] bg-[#FAF9F5] hover:bg-[#EFEFE6] flex items-center gap-2 cursor-pointer"
                    >
                      <img
                        src={p.images?.[0] || `/api/products/${encodeURIComponent(p.id)}/image.jpg`}
                        alt={p.name}
                        className="w-9 h-9 rounded-md object-cover bg-white shrink-0"
                      />
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-[#123B2A] truncate">{p.name}</p>
                        <p className="text-[10px] text-[#6B726C] tabular-nums">
                          {formatFCFA(p.price)}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Quick Merchant Replies */}
            <div className="px-3 py-2 bg-white border-t border-[#E1E3DA] flex gap-1.5 overflow-x-auto shrink-0">
              {MERCHANT_QUICK_REPLIES.map((qr) => (
                <button
                  key={qr}
                  type="button"
                  onClick={() => handleSend(qr)}
                  className="px-2.5 py-1 rounded-lg bg-[#FAF9F5] hover:bg-[#EFEFE6] border border-[#E1E3DA] text-[11px] font-medium text-[#123B2A] whitespace-nowrap shrink-0 cursor-pointer"
                >
                  {qr}
                </button>
              ))}
            </div>

            {/* Reply Composer */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSend();
              }}
              className="p-3 bg-white border-t border-[#E1E3DA] flex items-center gap-2 shrink-0"
            >
              <button
                type="button"
                onClick={() => setShowProductPicker((v) => !v)}
                title="Envoyer un article du catalogue"
                className="p-2.5 rounded-xl bg-[#FAF9F5] hover:bg-[#EFEFE6] border border-[#E1E3DA] text-[#123B2A] cursor-pointer shrink-0"
              >
                <Plus className="w-4 h-4" />
              </button>
              <input
                type="text"
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                placeholder={`Répondre à ${selectedThread.customerName}...`}
                maxLength={1000}
                className="flex-1 px-3.5 py-2.5 rounded-xl bg-[#FAF9F5] border border-[#E1E3DA] text-xs sm:text-sm focus:outline-[#1F5A40]"
              />
              <button
                type="submit"
                disabled={!replyText.trim() || isSending}
                aria-label="Envoyer la réponse"
                className="p-2.5 rounded-xl bg-[#123B2A] hover:bg-[#1F5A40] text-[#D8F36A] disabled:opacity-40 transition-colors cursor-pointer shrink-0"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
};
