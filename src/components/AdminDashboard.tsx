import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Product,
  Category,
  WhatsAppOrder,
  ClientLead,
  SiteMediaConfig,
  CarouselSlide,
  TeamMember,
  OrderThread,
  OrderChatMessage,
  OrderItemSnapshot,
  DailySiteStats,
  CustomerReview
} from '../types.ts';
import {
  INITIAL_CAROUSEL_SLIDES,
  HERO_PROMO_DELIVERY_IMG,
  HERO_PROMO_COD_IMG
} from '../data/initialData.ts';
import {
  formatFCFA,
  WHATSAPP_DISPLAY,
  getBoutiqueShareUrl,
  getAppOrigin,
  normalizeReferralCode
} from '../utils/whatsapp.ts';
import {
  fetchAdminAnalyticsOverview,
  fetchCustomerReviews,
  deleteCustomerReview
} from '../firebase.ts';
import { AdminAnalyticsPanel } from './AdminAnalyticsPanel.tsx';
import { AdminChatInbox } from './AdminChatInbox.tsx';
import {
  AUTHORIZED_ADMIN_EMAIL,
  fetchAdminChatThread,
  fetchAdminChatThreads,
  getChatWsUrl,
  markAdminThreadRead,
  playChatNotificationChime,
  sendAdminChatMessage,
  updateAdminThreadStatus
} from '../utils/chatClient.ts';
import {
  sendTestPushNotification,
  showInstantBrowserNotification,
  subscribeDeviceToWebPush,
  syncAdminPushIfSubscribed,
  unsubscribeDeviceFromWebPush
} from '../utils/pushClient.ts';
import {
  LayoutDashboard,
  Package,
  FolderTree,
  Users,
  MessageCircle,
  MessageSquare,
  ExternalLink,
  Plus,
  Search,
  Edit3,
  Trash2,
  DollarSign,
  X,
  Check,
  TrendingUp,
  AlertCircle,
  Upload,
  Image as ImageIcon,
  LogOut,
  Save,
  Sparkles,
  ArrowUp,
  ArrowDown,
  RefreshCw,
  Share2,
  Copy,
  Eye,
  EyeOff,
  UserPlus,
  Star,
  Bell,
  BellRing
} from 'lucide-react';

interface AdminDashboardProps {
  products: Product[];
  categories: Category[];
  orders: WhatsAppOrder[];
  leads: ClientLead[];
  teamMembers?: TeamMember[];
  mediaConfig: SiteMediaConfig;
  onUpdateMediaConfig: (config: SiteMediaConfig) => void;
  onAddProduct: (product: Omit<Product, 'id'>) => void;
  onUpdateProduct: (product: Product) => void;
  onDeleteProduct: (id: string) => void;
  onAddCategory: (input: {
    name: string;
    icon: string;
    badge?: string;
    subtitle?: string;
    image?: string;
  }) => void;
  onUpdateCategory: (category: Category) => void;
  onDeleteCategory: (id: string) => void;
  onUpdateOrderStatus: (orderId: string, status: WhatsAppOrder['status']) => void;
  onAssignOrderReferral?: (orderId: string, referralCode: string) => Promise<void> | void;
  onDeleteOrder?: (orderId: string) => void;
  onDeleteLead?: (leadId: string) => void;
  onAddTeamMember?: (member: { name: string; code: string; pin: string; phone?: string }) => Promise<void> | void;
  onUpdateTeamMember?: (member: TeamMember) => Promise<void> | void;
  onDeleteTeamMember?: (memberId: string) => Promise<void> | void;
  onRefreshAdminData?: () => Promise<void> | void;
  onSyncOrderStatus?: (orderId: string, status: WhatsAppOrder['status']) => void;
  onNewSiteOrderReceived?: (order: WhatsAppOrder) => void;
  onExitAdmin: () => void;
  onLogout?: () => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  products,
  categories,
  orders,
  leads,
  teamMembers = [],
  mediaConfig,
  onUpdateMediaConfig,
  onAddProduct,
  onUpdateProduct,
  onDeleteProduct,
  onAddCategory,
  onUpdateCategory,
  onDeleteCategory,
  onUpdateOrderStatus,
  onAssignOrderReferral,
  onDeleteOrder,
  onDeleteLead,
  onAddTeamMember,
  onUpdateTeamMember,
  onDeleteTeamMember,
  onRefreshAdminData,
  onSyncOrderStatus,
  onNewSiteOrderReceived,
  onExitAdmin,
  onLogout
}) => {
  const [activeSection, setActiveSection] = useState<
    'dashboard' | 'statistiques' | 'catalogue' | 'categories' | 'medias' | 'clients' | 'commandes' | 'messagerie' | 'equipe'
  >('dashboard');
  const [isRefreshingData, setIsRefreshingData] = useState(false);

  // Daily Visits & Evolution Analytics State
  const [dailyStats, setDailyStats] = useState<DailySiteStats[]>([]);
  const [isLoadingAnalytics, setIsLoadingAnalytics] = useState(false);

  const refreshAnalytics = useCallback(async (force = false) => {
    setIsLoadingAnalytics(true);
    try {
      const stats = await fetchAdminAnalyticsOverview(force);
      setDailyStats(stats);
    } finally {
      setIsLoadingAnalytics(false);
    }
  }, []);

  useEffect(() => {
    void refreshAnalytics(false);
  }, [refreshAnalytics]);

  // Customer Reviews moderation state
  const [customerReviews, setCustomerReviews] = useState<CustomerReview[]>([]);
  const [isLoadingReviews, setIsLoadingReviews] = useState(false);

  const refreshCustomerReviews = useCallback(async (force = false) => {
    setIsLoadingReviews(true);
    try {
      const list = await fetchCustomerReviews(force);
      setCustomerReviews(list);
    } finally {
      setIsLoadingReviews(false);
    }
  }, []);

  useEffect(() => {
    void refreshCustomerReviews(false);
  }, [refreshCustomerReviews]);

  const handleDeleteCustomerReview = async (review: CustomerReview) => {
    if (!confirm(`Supprimer l'avis de "${review.authorName}" ?`)) return;
    const ok = await deleteCustomerReview(review.id);
    if (ok) {
      setCustomerReviews((prev) => prev.filter((r) => r.id !== review.id));
    }
  };

  // Real-time In-Site Order Messaging State
  const [chatThreads, setChatThreads] = useState<OrderThread[]>([]);
  const [selectedChatThreadId, setSelectedChatThreadId] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<OrderChatMessage[]>([]);
  const [isLoadingChatMessages, setIsLoadingChatMessages] = useState(false);
  const [chatWsConnected, setChatWsConnected] = useState(false);
  const [adminPushEnabled, setAdminPushEnabled] = useState(false);
  const [isTogglingPush, setIsTogglingPush] = useState(false);
  const [isTestingPush, setIsTestingPush] = useState(false);
  const [pushFeedback, setPushFeedback] = useState<string | null>(null);
  const [liveChatAlert, setLiveChatAlert] = useState<{
    threadId: string;
    title: string;
    body: string;
  } | null>(null);
  const selectedChatIdRef = useRef<string | null>(null);
  selectedChatIdRef.current = selectedChatThreadId;
  const activeSectionRef = useRef(activeSection);
  activeSectionRef.current = activeSection;

  const refreshChatThreads = useCallback(async (force = false) => {
    const list = await fetchAdminChatThreads(force);
    setChatThreads(list);
  }, []);

  useEffect(() => {
    refreshChatThreads(false);
  }, [refreshChatThreads]);

  useEffect(() => {
    void syncAdminPushIfSubscribed().then((active) => {
      if (active) setAdminPushEnabled(true);
    });
  }, []);

  const handleToggleAdminPush = useCallback(async () => {
    setIsTogglingPush(true);
    setPushFeedback(null);
    if (adminPushEnabled) {
      await unsubscribeDeviceFromWebPush('admin');
      setAdminPushEnabled(false);
      setPushFeedback('Alertes désactivées sur cet appareil.');
      setIsTogglingPush(false);
      return;
    }

    const res = await subscribeDeviceToWebPush({ role: 'admin' });
    setIsTogglingPush(false);
    if (res.success) {
      setAdminPushEnabled(true);
      setPushFeedback('Alertes activées ! Vous serez averti sur téléphone et PC.');
      playChatNotificationChime();
    } else {
      setPushFeedback(res.error || "Impossible d'activer les notifications.");
    }
  }, [adminPushEnabled]);

  const handleTestAdminPush = useCallback(async () => {
    setIsTestingPush(true);
    setPushFeedback(null);
    const res = await sendTestPushNotification('admin');
    setIsTestingPush(false);
    if (res.success) {
      setPushFeedback('Notification de test envoyée ! Vérifiez votre écran / téléphone.');
    } else {
      setPushFeedback(res.error || 'Échec du test de notification.');
    }
  }, []);

  const handleSelectChatThread = useCallback(async (threadId: string | null) => {
    setSelectedChatThreadId(threadId);
    if (!threadId) {
      setChatMessages([]);
      return;
    }
    setIsLoadingChatMessages(true);
    const res = await fetchAdminChatThread(threadId);
    setIsLoadingChatMessages(false);
    if (res.success) {
      setChatMessages(res.messages || []);
      if (res.thread && (res.thread.unreadForAdmin || 0) > 0) {
        markAdminThreadRead(threadId);
        setChatThreads((prev) =>
          prev.map((t) => (t.id === threadId ? { ...t, unreadForAdmin: 0 } : t))
        );
      }
    }
  }, []);

  // Open target conversation directly when arriving from a Push notification (?chat=CMD-XXXX)
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const chatParam = params.get('chat');
      if (chatParam) {
        setActiveSection('messagerie');
        void handleSelectChatThread(chatParam.trim());
        params.delete('chat');
        const nextSearch = params.toString();
        const nextUrl = `${window.location.pathname}${nextSearch ? `?${nextSearch}` : ''}${window.location.hash}`;
        window.history.replaceState(null, '', nextUrl);
      }
    } catch {
      // Ignore URL parse error
    }
  }, [handleSelectChatThread]);

  useEffect(() => {
    let closedByEffect = false;
    let ws: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    const connectAdminWs = () => {
      if (closedByEffect) return;
      const wsUrl = getChatWsUrl();
      if (!wsUrl) return;
      try {
        ws = new WebSocket(wsUrl);
        ws.onopen = () => {
          ws?.send(
            JSON.stringify({
              type: 'auth:admin',
              adminEmail: AUTHORIZED_ADMIN_EMAIL
            })
          );
        };
        ws.onmessage = (evt) => {
          try {
            const payload = JSON.parse(evt.data);
            if (payload.type === 'auth:ok') {
              setChatWsConnected(true);
              refreshChatThreads(false);
            } else if (payload.type === 'chat:thread_created' && payload.thread) {
              const incomingThread = payload.thread as OrderThread;
              setChatThreads((prev) => [
                incomingThread,
                ...prev.filter((t) => t.id !== incomingThread.id)
              ]);
              playChatNotificationChime();
              if (activeSectionRef.current !== 'messagerie') {
                setLiveChatAlert({
                  threadId: incomingThread.orderId,
                  title: `Nouvelle commande ${incomingThread.orderId}`,
                  body: `${incomingThread.customerName} · ${incomingThread.itemsSummary}`
                });
              }
              if (document.hidden || activeSectionRef.current !== 'messagerie') {
                void showInstantBrowserNotification({
                  title: `Nouvelle commande ${incomingThread.orderId}`,
                  body: `${incomingThread.customerName} (${incomingThread.customerCity}) · ${incomingThread.itemsSummary}`,
                  url: `/?admin=1&chat=${encodeURIComponent(incomingThread.orderId)}#admin`,
                  tag: `huize-admin-${incomingThread.orderId}`
                });
              }
              if (onNewSiteOrderReceived) {
                onNewSiteOrderReceived({
                  id: incomingThread.orderId,
                  customerName: incomingThread.customerName,
                  phone: incomingThread.customerPhone,
                  city: incomingThread.customerCity,
                  customerPhone: incomingThread.customerPhone,
                  customerCity: incomingThread.customerCity,
                  itemsSummary: incomingThread.itemsSummary,
                  items: incomingThread.items,
                  total: incomingThread.total,
                  date: new Date(incomingThread.createdAt).toLocaleDateString('fr-FR', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  }),
                  status: incomingThread.status,
                  statusLabel: incomingThread.statusLabel,
                  paymentMethod: incomingThread.paymentMethod,
                  channel: 'site_chat',
                  ...(incomingThread.referredByCode
                    ? { referredByCode: incomingThread.referredByCode }
                    : {}),
                  ...(incomingThread.referredByName
                    ? { referredByName: incomingThread.referredByName }
                    : {})
                });
              }
            } else if (payload.type === 'chat:message' && payload.message) {
              const msg = payload.message as OrderChatMessage;
              if (payload.thread) {
                const updatedT = payload.thread as OrderThread;
                setChatThreads((prev) => {
                  const exists = prev.some((t) => t.id === updatedT.id);
                  const next = exists
                    ? prev.map((t) => (t.id === updatedT.id ? updatedT : t))
                    : [updatedT, ...prev];
                  return [...next].sort((a, b) =>
                    (b.updatedAt || '').localeCompare(a.updatedAt || '')
                  );
                });
              }

              if (selectedChatIdRef.current === msg.threadId) {
                setChatMessages((prev) =>
                  prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]
                );
                if (activeSectionRef.current === 'messagerie' && msg.sender === 'customer') {
                  markAdminThreadRead(msg.threadId);
                  setChatThreads((prev) =>
                    prev.map((t) => (t.id === msg.threadId ? { ...t, unreadForAdmin: 0 } : t))
                  );
                }
              }

              if (msg.sender === 'customer') {
                playChatNotificationChime();
                const isCurrentlyViewing =
                  activeSectionRef.current === 'messagerie' &&
                  selectedChatIdRef.current === msg.threadId;
                if (!isCurrentlyViewing) {
                  setLiveChatAlert({
                    threadId: msg.threadId,
                    title: `Message de ${msg.senderName} (${msg.threadId})`,
                    body: msg.text
                  });
                }
                if (document.hidden || !isCurrentlyViewing) {
                  void showInstantBrowserNotification({
                    title: `Message de ${msg.senderName} (${msg.threadId})`,
                    body: msg.text,
                    url: `/?admin=1&chat=${encodeURIComponent(msg.threadId)}#admin`,
                    tag: `huize-admin-${msg.threadId}`
                  });
                }
              }
            } else if (payload.type === 'chat:status' && payload.thread) {
              const updatedT = payload.thread as OrderThread;
              setChatThreads((prev) =>
                prev.map((t) => (t.id === updatedT.id ? updatedT : t))
              );
              if (selectedChatIdRef.current === updatedT.id && payload.message) {
                setChatMessages((prev) =>
                  prev.some((m) => m.id === payload.message.id)
                    ? prev
                    : [...prev, payload.message]
                );
              }
              onSyncOrderStatus?.(updatedT.orderId, updatedT.status);
            } else if (payload.type === 'chat:read' && payload.thread) {
              const updatedT = payload.thread as OrderThread;
              setChatThreads((prev) =>
                prev.map((t) => (t.id === updatedT.id ? updatedT : t))
              );
            }
          } catch {
            // Ignore malformed WS payloads
          }
        };
        ws.onclose = () => {
          setChatWsConnected(false);
          if (!closedByEffect) {
            reconnectTimer = setTimeout(connectAdminWs, 3500);
          }
        };
        ws.onerror = () => {
          setChatWsConnected(false);
        };
      } catch {
        setChatWsConnected(false);
      }
    };

    connectAdminWs();
    return () => {
      closedByEffect = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (ws) ws.close();
    };
  }, [refreshChatThreads, onNewSiteOrderReceived, onSyncOrderStatus]);

  const unreadChatCount = chatThreads.reduce((acc, t) => acc + (t.unreadForAdmin || 0), 0);

  useEffect(() => {
    const baseTitle = 'HUIZE SHOP — Admin Boutique';
    document.title =
      unreadChatCount > 0 ? `(${unreadChatCount}) ${baseTitle}` : baseTitle;
    return () => {
      document.title = 'HUIZE SHOP — Boutique de Mode & Chaussures au Burkina Faso';
    };
  }, [unreadChatCount]);

  const handleSendAdminChatMessage = async (
    threadId: string,
    text: string,
    attachedProduct?: OrderItemSnapshot
  ) => {
    const res = await sendAdminChatMessage(threadId, text, attachedProduct);
    if (res.success && res.message) {
      setChatMessages((prev) =>
        prev.some((m) => m.id === res.message!.id) ? prev : [...prev, res.message!]
      );
      if (res.thread) {
        setChatThreads((prev) =>
          prev.map((t) => (t.id === res.thread!.id ? res.thread! : t))
        );
      }
    }
  };

  const handleUpdateChatThreadStatus = async (
    threadId: string,
    status: WhatsAppOrder['status']
  ) => {
    const res = await updateAdminThreadStatus(threadId, status);
    if (res.success && res.thread) {
      setChatThreads((prev) =>
        prev.map((t) => (t.id === res.thread!.id ? res.thread! : t))
      );
      if (res.message) {
        setChatMessages((prev) =>
          prev.some((m) => m.id === res.message!.id) ? prev : [...prev, res.message!]
        );
      }
      onSyncOrderStatus?.(res.thread.orderId, status);
    }
  };

  // Team Sharing Form State
  const [editingMember, setEditingMember] = useState<TeamMember | null>(null);
  const [memberName, setMemberName] = useState('');
  const [memberCode, setMemberCode] = useState('');
  const [memberPin, setMemberPin] = useState('');
  const [memberPhone, setMemberPhone] = useState('');
  const [teamFormError, setTeamFormError] = useState<string | null>(null);
  const [revealedPins, setRevealedPins] = useState<Record<string, boolean>>({});
  const [copiedTeamCode, setCopiedTeamCode] = useState<string | null>(null);

  // Filters
  const [productSearch, setProductSearch] = useState('');
  const [productCategoryFilter, setProductCategoryFilter] = useState('all');
  const [previewOrder, setPreviewOrder] = useState<WhatsAppOrder | null>(null);

  // Product Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  // Form State
  const [formName, setFormName] = useState('');
  const [formCategory, setFormCategory] = useState('chaussures');
  const [formPrice, setFormPrice] = useState('22500');
  const [formOldPrice, setFormOldPrice] = useState('28000');
  const [formBadge, setFormBadge] = useState('Nouveau');
  const [formSizes, setFormSizes] = useState('40, 41, 42, 43, 44');
  const [formStock, setFormStock] = useState('14');
  const [formRef, setFormRef] = useState('HZ-B05');
  const [formDesc, setFormDesc] = useState('');
  const [formFeatured, setFormFeatured] = useState(true);
  const [formImages, setFormImages] = useState<string[]>(['/src/assets/images/product_velocity_sneakers_1794167661807.jpg']);
  const [manualImageUrl, setManualImageUrl] = useState('');
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [isAnalyzingAi, setIsAnalyzingAi] = useState(false);
  const [aiAnalysisError, setAiAnalysisError] = useState<string | null>(null);
  const [aiSuccessMessage, setAiSuccessMessage] = useState<string | null>(null);

  // Compress and convert uploaded image files to base64 Data URLs for direct Firestore storage
  const handleFileUpload = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setIsUploadingImage(true);

    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          // Resize to max 750px width/height for optimal storage
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          const maxDim = 750;
          if (width > height && width > maxDim) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else if (height > maxDim) {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0, width, height);
            const compressedUrl = canvas.toDataURL('image/jpeg', 0.82);
            setFormImages((prev) => [...prev, compressedUrl]);
          }
          setIsUploadingImage(false);
        };
        img.src = e.target?.result as string;
      };
      reader.readAsDataURL(file);
    });
  };

  // Category Create / Edit State
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [newCatName, setNewCatName] = useState('');
  const [newCatIcon, setNewCatIcon] = useState('🎒');
  const [newCatBadge, setNewCatBadge] = useState('NOUVEAU');
  const [newCatSubtitle, setNewCatSubtitle] = useState('');
  const [newCatImage, setNewCatImage] = useState('');
  const [isUploadingCatImage, setIsUploadingCatImage] = useState(false);

  const handleCategoryImageUpload = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setIsUploadingCatImage(true);
    const file = files[0];
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        const maxDim = 480;
        if (width > height && width > maxDim) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        } else if (height > maxDim) {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          setNewCatImage(canvas.toDataURL('image/jpeg', 0.8));
        }
        setIsUploadingCatImage(false);
      };
      img.onerror = () => setIsUploadingCatImage(false);
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  // Media & Home Banner State (Site Logo, Hero photo and scrolling carousel products)
  const [logoUrl, setLogoUrl] = useState<string>(mediaConfig?.logoUrl || '');
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [heroImg, setHeroImg] = useState<string>(
    mediaConfig?.heroImage || '/src/assets/images/hero_fashion_burkina_1794167660891.jpg'
  );
  const [heroImages, setHeroImages] = useState<string[]>(() => {
    if (mediaConfig?.heroImages && mediaConfig.heroImages.length > 0) {
      return mediaConfig.heroImages;
    }
    return [mediaConfig?.heroImage || '/src/assets/images/hero_fashion_burkina_1794167660891.jpg'];
  });
  const [selectedHeroIdx, setSelectedHeroIdx] = useState<number>(0);
  const [newHeroImageUrl, setNewHeroImageUrl] = useState<string>('');
  const [heroTagline, setHeroTagline] = useState<string>(
    mediaConfig?.heroTagline || 'Ton style, ta signature'
  );
  const [heroTitle, setHeroTitle] = useState<string>(
    mediaConfig?.heroTitle || 'Affirme ton style avec HUIZE SHOP'
  );
  const [heroSubtitle, setHeroSubtitle] = useState<string>(
    mediaConfig?.heroSubtitle ||
      'Baskets, sandales et vêtements tendance sélectionnés avec soin pour le quotidien et les grandes occasions au Burkina Faso. Choisis tes articles, puis finalise ta commande directement sur WhatsApp en toute confiance.'
  );
  const [carouselSlides, setCarouselSlides] = useState<CarouselSlide[]>(
    mediaConfig?.carouselSlides && mediaConfig.carouselSlides.length > 0
      ? mediaConfig.carouselSlides
      : INITIAL_CAROUSEL_SLIDES
  );
  const [isSavingMedia, setIsSavingMedia] = useState(false);
  const [isUploadingHero, setIsUploadingHero] = useState(false);
  const [uploadingSlideIdx, setUploadingSlideIdx] = useState<number | null>(null);

  React.useEffect(() => {
    if (mediaConfig) {
      setLogoUrl(mediaConfig.logoUrl || '');
      if (mediaConfig.heroImage) setHeroImg(mediaConfig.heroImage);
      if (mediaConfig.heroImages && mediaConfig.heroImages.length > 0) {
        setHeroImages(mediaConfig.heroImages);
      } else if (mediaConfig.heroImage) {
        setHeroImages([mediaConfig.heroImage]);
      }
      if (mediaConfig.heroTagline) setHeroTagline(mediaConfig.heroTagline);
      if (mediaConfig.heroTitle) setHeroTitle(mediaConfig.heroTitle);
      if (mediaConfig.heroSubtitle) setHeroSubtitle(mediaConfig.heroSubtitle);
      if (mediaConfig.carouselSlides && mediaConfig.carouselSlides.length > 0) {
        setCarouselSlides(mediaConfig.carouselSlides);
      }
    }
  }, [mediaConfig]);

  const handleLogoFileUpload = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setIsUploadingLogo(true);
    const file = files[0];
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      if (file.type === 'image/svg+xml') {
        setLogoUrl(result);
        setIsUploadingLogo(false);
        return;
      }
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        const maxDim = 480;
        if (width > maxDim || height > maxDim) {
          if (width >= height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const compressed = canvas.toDataURL('image/png');
          setLogoUrl(compressed);
        }
        setIsUploadingLogo(false);
      };
      img.src = result;
    };
    reader.readAsDataURL(file);
  };

  const handleHeroFileUpload = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setIsUploadingHero(true);
    let pending = files.length;

    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          const maxDim = 820;
          if (width > height && width > maxDim) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else if (height > maxDim) {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0, width, height);
            const compressed = canvas.toDataURL('image/jpeg', 0.74);
            setHeroImages((prev) => {
              const next = [...prev, compressed];
              setSelectedHeroIdx(next.length - 1);
              setHeroImg(next[0]);
              return next;
            });
          }
          pending -= 1;
          if (pending <= 0) setIsUploadingHero(false);
        };
        img.onerror = () => {
          pending -= 1;
          if (pending <= 0) setIsUploadingHero(false);
        };
        img.src = e.target?.result as string;
      };
      reader.readAsDataURL(file);
    });
  };

  const handleAddHeroImageUrl = (urlToAdd?: string) => {
    const clean = (urlToAdd ?? newHeroImageUrl).trim();
    if (!clean) return;
    setHeroImages((prev) => {
      const existingIdx = prev.indexOf(clean);
      if (existingIdx !== -1) {
        setSelectedHeroIdx(existingIdx);
        return prev;
      }
      const next = [...prev, clean];
      setSelectedHeroIdx(next.length - 1);
      setHeroImg(next[0]);
      return next;
    });
    if (!urlToAdd) setNewHeroImageUrl('');
  };

  const handleRemoveHeroImage = (idx: number) => {
    if (heroImages.length <= 1) return;
    setHeroImages((prev) => {
      const next = prev.filter((_, i) => i !== idx);
      setHeroImg(next[0]);
      setSelectedHeroIdx((curr) => (curr >= next.length ? next.length - 1 : curr));
      return next;
    });
  };

  const handleMoveHeroImage = (idx: number, direction: -1 | 1) => {
    const target = idx + direction;
    if (target < 0 || target >= heroImages.length) return;
    setHeroImages((prev) => {
      const next = [...prev];
      const temp = next[idx];
      next[idx] = next[target];
      next[target] = temp;
      setHeroImg(next[0]);
      setSelectedHeroIdx(target);
      return next;
    });
  };

  const handleSlideFileUpload = (slideIdx: number, files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploadingSlideIdx(slideIdx);
    const file = files[0];
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        const maxDim = 820;
        if (width > height && width > maxDim) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        } else if (height > maxDim) {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const compressed = canvas.toDataURL('image/jpeg', 0.72);
          setCarouselSlides((prev) =>
            prev.map((s, idx) => (idx === slideIdx ? { ...s, image: compressed } : s))
          );
        }
        setUploadingSlideIdx(null);
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleSaveMediaConfig = async () => {
    setIsSavingMedia(true);
    const cleanHeroImages = heroImages.filter(Boolean);
    const newConfig: SiteMediaConfig = {
      logoUrl: logoUrl.trim(),
      heroImage: cleanHeroImages[0] || heroImg,
      heroImages: cleanHeroImages.length > 0 ? cleanHeroImages : [heroImg],
      heroTagline,
      heroTitle,
      heroSubtitle,
      carouselSlides
    };
    try {
      await onUpdateMediaConfig(newConfig);
    } finally {
      setIsSavingMedia(false);
    }
  };

  const handleAddCarouselSlide = () => {
    const newSlide: CarouselSlide = {
      id: Date.now(),
      kicker: 'ANNONCE PUBLICITAIRE HUIZE',
      title: 'Nouvelle Promotion ou Arrivage',
      desc: 'Découvrez nos nouveautés disponibles au Burkina Faso avec livraison rapide.',
      category: categories[0]?.slug || 'all',
      image: '/src/assets/images/product_velocity_sneakers_1794167661807.jpg',
      ctaText: 'Découvrir en boutique'
    };
    setCarouselSlides((prev) => [...prev, newSlide]);
  };

  const handleMoveCarouselSlide = (idx: number, direction: -1 | 1) => {
    const targetIdx = idx + direction;
    if (targetIdx < 0 || targetIdx >= carouselSlides.length) return;
    setCarouselSlides((prev) => {
      const next = [...prev];
      const temp = next[idx];
      next[idx] = next[targetIdx];
      next[targetIdx] = temp;
      return next;
    });
  };

  const handleDeleteCarouselSlide = (idx: number) => {
    if (carouselSlides.length <= 1) return;
    setCarouselSlides((prev) => prev.filter((_, i) => i !== idx));
  };

  // Price adjustment prompt modal
  const [adjustingPriceProduct, setAdjustingPriceProduct] = useState<Product | null>(null);
  const [newAdjustedPrice, setNewAdjustedPrice] = useState<string>('');

  const openAddModal = () => {
    setEditingProduct(null);
    setFormName('');
    setFormCategory(categories[0]?.slug || 'chaussures');
    setFormPrice('22000');
    setFormOldPrice('26000');
    setFormBadge('Nouveau');
    setFormSizes('40, 41, 42, 43, 44');
    setFormStock('10');
    setFormRef(`HZ-${Math.floor(100 + Math.random() * 900)}`);
    setFormDesc('Article haute qualité certifié HUIZE SHOP disponible à Ouagadougou.');
    setFormFeatured(true);
    setFormImages(['/src/assets/images/product_velocity_sneakers_1794167661807.jpg']);
    setManualImageUrl('');
    setAiAnalysisError(null);
    setAiSuccessMessage(null);
    setIsModalOpen(true);
  };

  const openEditModal = (prod: Product) => {
    setEditingProduct(prod);
    setFormName(prod.name);
    setFormCategory(prod.category);
    setFormPrice(prod.price.toString());
    setFormOldPrice(prod.oldPrice ? prod.oldPrice.toString() : '');
    setFormBadge(prod.badge || 'Nouveau');
    setFormSizes(prod.sizes.join(', '));
    setFormStock(prod.stock.toString());
    setFormRef(prod.ref);
    setFormDesc(prod.description);
    setFormFeatured(Boolean(prod.featured));
    setFormImages(prod.images && prod.images.length ? prod.images : ['/src/assets/images/product_velocity_sneakers_1794167661807.jpg']);
    setManualImageUrl('');
    setAiAnalysisError(null);
    setAiSuccessMessage(null);
    setIsModalOpen(true);
  };

  const handleSaveProduct = (e: React.FormEvent) => {
    e.preventDefault();
    const sizesArray = formSizes
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    const targetCategory = categories.find((c) => c.slug === formCategory);
    const categoryLabel = targetCategory ? targetCategory.name : formCategory;
    
    // Include any manual image URL entered in the input
    const imagesToUse = [...formImages];
    if (manualImageUrl.trim() && !imagesToUse.includes(manualImageUrl.trim())) {
      imagesToUse.push(manualImageUrl.trim());
    }

    const finalImages = imagesToUse.length > 0 
      ? imagesToUse 
      : ['/src/assets/images/product_velocity_sneakers_1794167661807.jpg'];

    const parsedOldPrice = formOldPrice && formOldPrice.trim() !== '' 
      ? parseInt(formOldPrice, 10) 
      : undefined;

    if (editingProduct) {
      onUpdateProduct({
        ...editingProduct,
        name: formName,
        category: formCategory,
        categoryLabel,
        price: parseInt(formPrice, 10) || 0,
        oldPrice: parsedOldPrice,
        badge: formBadge,
        sizes: sizesArray.length ? sizesArray : ['Standard'],
        stock: parseInt(formStock, 10) || 0,
        ref: formRef,
        description: formDesc,
        images: finalImages,
        featured: formFeatured
      });
    } else {
      onAddProduct({
        name: formName || 'Nouveau Produit HUIZE',
        category: formCategory,
        categoryLabel,
        price: parseInt(formPrice, 10) || 15000,
        oldPrice: parsedOldPrice,
        badge: formBadge,
        sizes: sizesArray.length ? sizesArray : ['40', '41', '42'],
        stock: parseInt(formStock, 10) || 5,
        ref: formRef,
        description: formDesc,
        images: finalImages,
        featured: formFeatured
      });
    }

    setManualImageUrl('');
    setIsModalOpen(false);
  };

  // AI Product Vision Analysis Trigger
  const handleAnalyzeWithAi = async () => {
    const targetImage = (formImages && formImages.length > 0 ? formImages[0] : null) || manualImageUrl.trim();
    if (!targetImage) {
      setAiAnalysisError("Veuillez d'abord importer une photo ou coller un lien d'image pour permettre l'analyse.");
      return;
    }

    setIsAnalyzingAi(true);
    setAiAnalysisError(null);
    setAiSuccessMessage(null);

    try {
      const res = await fetch('/api/ai/analyze-product', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: targetImage })
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        if (json.needsKey) {
          throw new Error("Clé API Gemini requise dans le panneau Settings > Secrets d'AI Studio pour activer l'analyse IA.");
        }
        throw new Error(json.error || "Impossible d'analyser l'image pour le moment.");
      }

      const data = json.data;
      if (data.name) setFormName(data.name);
      if (data.category) setFormCategory(data.category);
      if (data.price) setFormPrice(data.price.toString());
      if (data.oldPrice) setFormOldPrice(data.oldPrice.toString());
      if (data.badge) setFormBadge(data.badge);
      if (data.sizes) setFormSizes(data.sizes);
      if (data.description) setFormDesc(data.description);
      if (data.ref) setFormRef(data.ref);

      setAiSuccessMessage(`✨ Analyse IA réussie : "${data.name}" détecté avec estimation du prix marché à ${data.price} F CFA.`);
    } catch (err: any) {
      console.error('AI Analysis failed:', err);
      setAiAnalysisError(err.message || "Erreur lors de l'analyse IA de l'image.");
    } finally {
      setIsAnalyzingAi(false);
    }
  };

  const handleSavePriceAdjustment = () => {
    if (!adjustingPriceProduct) return;
    const priceVal = parseInt(newAdjustedPrice, 10);
    if (!isNaN(priceVal) && priceVal > 0) {
      onUpdateProduct({
        ...adjustingPriceProduct,
        price: priceVal
      });
    }
    setAdjustingPriceProduct(null);
  };

  const resetCategoryForm = () => {
    setEditingCategory(null);
    setNewCatName('');
    setNewCatIcon('🎒');
    setNewCatBadge('NOUVEAU');
    setNewCatSubtitle('');
    setNewCatImage('');
  };

  const handleEditCategoryClick = (cat: Category) => {
    setEditingCategory(cat);
    setNewCatName(cat.name);
    setNewCatIcon(cat.icon || '🛍️');
    setNewCatBadge(cat.badge || 'COLLECTION');
    setNewCatSubtitle(cat.subtitle || '');
    setNewCatImage(cat.image || '');
  };

  const handleCategorySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatName.trim()) return;

    if (editingCategory) {
      onUpdateCategory({
        ...editingCategory,
        name: newCatName.trim(),
        icon: newCatIcon.trim() || '🛍️',
        badge: newCatBadge.trim().toUpperCase() || 'COLLECTION',
        subtitle: newCatSubtitle.trim() || undefined,
        image: newCatImage.trim() || undefined
      });
    } else {
      onAddCategory({
        name: newCatName.trim(),
        icon: newCatIcon.trim() || '🛍️',
        badge: newCatBadge.trim().toUpperCase() || 'NOUVEAU',
        subtitle: newCatSubtitle.trim() || undefined,
        image: newCatImage.trim() || undefined
      });
    }
    resetCategoryForm();
  };

  // Filter products for the table
  const featuredCount = products.filter((p) => p.featured === true).length;
  const filteredProducts = products.filter((p) => {
    const matchSearch =
      p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
      p.ref.toLowerCase().includes(productSearch.toLowerCase());
    const matchCat =
      productCategoryFilter === 'all'
        ? true
        : productCategoryFilter === 'featured'
        ? p.featured === true
        : p.category === productCategoryFilter;
    return matchSearch && matchCat;
  });

  // Calculate real live metrics from actual store data (zero fabricated figures)
  const totalStockCount = products.reduce((acc, p) => acc + p.stock, 0);
  const totalOrdersAmount = orders.reduce((acc, o) => acc + o.total, 0);
  const confirmedOrdersAmount = orders
    .filter((o) => o.status === 'paid' || o.status === 'delivered')
    .reduce((acc, o) => acc + o.total, 0);
  const pendingOrdersCount = orders.filter(
    (o) => o.status === 'pending' || o.status === 'discussion'
  ).length;
  const confirmedOrdersCount = orders.filter(
    (o) => o.status === 'paid' || o.status === 'delivered'
  ).length;

  const handleRefreshClick = async () => {
    if (isRefreshingData) return;
    setIsRefreshingData(true);
    try {
      await Promise.all([
        onRefreshAdminData ? onRefreshAdminData() : Promise.resolve(),
        refreshAnalytics(true)
      ]);
    } finally {
      setIsRefreshingData(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F4F3EE] flex flex-col lg:flex-row text-[#202720]">
      {/* SIDEBAR (Desktop) */}
      <aside className="hidden lg:flex w-64 bg-[#123B2A] text-white flex-col shrink-0 sticky top-0 h-screen border-r border-white/10 z-20">
        <div className="p-5 border-b border-white/10 flex items-center justify-between">
          <button onClick={onExitAdmin} className="text-left cursor-pointer">
            <span className="font-title text-xl font-bold tracking-wider text-[#D8F36A]">
              HUIZE SHOP
            </span>
          </button>
          <span className="bg-[#D8F36A]/20 text-[#D8F36A] text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full">
            Admin
          </span>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-3 flex flex-col gap-1 text-sm font-medium">
          <p className="text-[10px] uppercase font-bold text-white/40 px-3 pt-3 pb-1 tracking-wider">
            Menu Principal
          </p>

          <button
            onClick={() => setActiveSection('dashboard')}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors cursor-pointer ${
              activeSection === 'dashboard'
                ? 'bg-[#1F5A40] text-white font-bold shadow-xs'
                : 'text-white/80 hover:bg-white/10 hover:text-[#D8F36A]'
            }`}
          >
            <LayoutDashboard className="w-4 h-4 text-[#D8F36A]" />
            <span>Tableau de bord</span>
          </button>

          <button
            onClick={() => {
              setActiveSection('statistiques');
              void refreshAnalytics(true);
            }}
            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-left transition-colors cursor-pointer ${
              activeSection === 'statistiques'
                ? 'bg-[#1F5A40] text-white font-bold shadow-xs'
                : 'text-white/80 hover:bg-white/10 hover:text-[#D8F36A]'
            }`}
          >
            <div className="flex items-center gap-3">
              <TrendingUp className="w-4 h-4 text-[#D8F36A]" />
              <span>Visites &amp; Courbe</span>
            </div>
            <span className="bg-[#D8F36A]/20 text-[#D8F36A] text-xs font-bold px-2 py-0.2 rounded-full tabular-nums">
              {dailyStats.find((s) => s.date === new Date().toISOString().slice(0, 10))?.visits ?? 0}
            </span>
          </button>

          <button
            onClick={() => setActiveSection('catalogue')}
            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-left transition-colors cursor-pointer ${
              activeSection === 'catalogue'
                ? 'bg-[#1F5A40] text-white font-bold shadow-xs'
                : 'text-white/80 hover:bg-white/10 hover:text-[#D8F36A]'
            }`}
          >
            <div className="flex items-center gap-3">
              <Package className="w-4 h-4 text-[#D8F36A]" />
              <span>Gestion Produits</span>
            </div>
            <span className="bg-[#D8F36A] text-[#123B2A] text-xs font-bold px-2 py-0.2 rounded-full">
              {products.length}
            </span>
          </button>

          <button
            onClick={() => setActiveSection('categories')}
            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-left transition-colors cursor-pointer ${
              activeSection === 'categories'
                ? 'bg-[#1F5A40] text-white font-bold shadow-xs'
                : 'text-white/80 hover:bg-white/10 hover:text-[#D8F36A]'
            }`}
          >
            <div className="flex items-center gap-3">
              <FolderTree className="w-4 h-4 text-[#D8F36A]" />
              <span>Catégories</span>
            </div>
            <span className="bg-white/10 text-[#D8F36A] text-xs font-bold px-2 py-0.2 rounded-full">
              {categories.length}
            </span>
          </button>

          <button
            onClick={() => setActiveSection('medias')}
            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-left transition-colors cursor-pointer ${
              activeSection === 'medias'
                ? 'bg-[#1F5A40] text-white font-bold shadow-xs'
                : 'text-white/80 hover:bg-white/10 hover:text-[#D8F36A]'
            }`}
          >
            <div className="flex items-center gap-3">
              <ImageIcon className="w-4 h-4 text-[#D8F36A]" />
              <span>Accueil &amp; Bannières</span>
            </div>
            <span className="bg-[#D8F36A]/20 text-[#D8F36A] text-[10px] font-bold px-2 py-0.5 rounded-full">
              Hero + {carouselSlides.length}
            </span>
          </button>

          <button
            onClick={() => setActiveSection('clients')}
            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-left transition-colors cursor-pointer ${
              activeSection === 'clients'
                ? 'bg-[#1F5A40] text-white font-bold shadow-xs'
                : 'text-white/80 hover:bg-white/10 hover:text-[#D8F36A]'
            }`}
          >
            <div className="flex items-center gap-3">
              <Users className="w-4 h-4 text-[#D8F36A]" />
              <span>Clients &amp; Prospects</span>
            </div>
            <span className="bg-white/10 text-white text-xs font-bold px-2 py-0.2 rounded-full">
              {leads.length}
            </span>
          </button>

          <button
            onClick={() => setActiveSection('commandes')}
            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-left transition-colors cursor-pointer ${
              activeSection === 'commandes'
                ? 'bg-[#1F5A40] text-white font-bold shadow-xs'
                : 'text-white/80 hover:bg-white/10 hover:text-[#D8F36A]'
            }`}
          >
            <div className="flex items-center gap-3">
              <MessageCircle className="w-4 h-4 text-[#25D366]" />
              <span>Commandes WhatsApp</span>
            </div>
            <span className="bg-[#25D366] text-white text-xs font-bold px-2 py-0.2 rounded-full">
              {orders.length}
            </span>
          </button>

          <button
            onClick={() => {
              setActiveSection('messagerie');
              refreshChatThreads(false);
            }}
            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-left transition-colors cursor-pointer ${
              activeSection === 'messagerie'
                ? 'bg-[#1F5A40] text-white font-bold shadow-xs'
                : 'text-white/80 hover:bg-white/10 hover:text-[#D8F36A]'
            }`}
          >
            <div className="flex items-center gap-3">
              <MessageSquare className="w-4 h-4 text-[#D8F36A]" />
              <span>Messagerie Clients</span>
            </div>
            {unreadChatCount > 0 ? (
              <span className="bg-[#D8F36A] text-[#123B2A] text-xs font-extrabold px-2 py-0.2 rounded-full tabular-nums">
                {unreadChatCount}
              </span>
            ) : (
              <span className="bg-white/10 text-white text-xs font-bold px-2 py-0.2 rounded-full tabular-nums">
                {chatThreads.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveSection('equipe')}
            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-left transition-colors cursor-pointer ${
              activeSection === 'equipe'
                ? 'bg-[#1F5A40] text-white font-bold shadow-xs'
                : 'text-white/80 hover:bg-white/10 hover:text-[#D8F36A]'
            }`}
          >
            <div className="flex items-center gap-3">
              <Share2 className="w-4 h-4 text-[#D8F36A]" />
              <span>Équipe &amp; Partage</span>
            </div>
            <span className="bg-white/10 text-[#D8F36A] text-xs font-bold px-2 py-0.2 rounded-full">
              {teamMembers.length}
            </span>
          </button>

          <p className="text-[10px] uppercase font-bold text-white/40 px-3 pt-4 pb-1 tracking-wider">
            Boutique &amp; Sortie
          </p>

          <button
            onClick={onExitAdmin}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left text-white/80 hover:bg-white/10 hover:text-[#D8F36A] transition-colors cursor-pointer"
          >
            <ExternalLink className="w-4 h-4 text-[#D8F36A]" />
            <span>Voir la boutique en ligne</span>
          </button>
        </nav>

        {/* Footer profile */}
        <div className="p-4 border-t border-white/10 flex items-center gap-3 bg-black/20">
          <div className="w-9 h-9 rounded-full bg-[#D8F36A] text-[#123B2A] font-bold flex items-center justify-center text-xs">
            HZ
          </div>
          <div className="truncate flex-1">
            <p className="text-xs font-bold text-white truncate">hugosazizegansonre@gmail.com</p>
            <p className="text-[10px] text-white/60">Admin vérifié • {WHATSAPP_DISPLAY}</p>
          </div>
          {onLogout && (
            <button
              onClick={onLogout}
              className="p-1.5 text-white/60 hover:text-red-400 hover:bg-white/10 rounded-md transition-colors"
              title="Verrouiller la session admin"
            >
              <LogOut className="w-4 h-4" />
            </button>
          )}
        </div>
      </aside>

      {/* MOBILE TOPBAR & SCROLLING TABS */}
      <div className="lg:hidden bg-[#123B2A] text-white sticky top-0 z-30 shadow-md">
        <div className="p-3.5 flex items-center justify-between border-b border-white/10">
          <div className="flex items-center gap-2">
            <span className="font-title text-lg font-bold text-[#D8F36A]">HUIZE SHOP</span>
            <span className="bg-[#D8F36A]/20 text-[#D8F36A] text-[10px] font-extrabold px-2 py-0.5 rounded-full uppercase">
              Admin
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleToggleAdminPush}
              disabled={isTogglingPush}
              title={adminPushEnabled ? 'Alertes actives' : 'Activer les alertes téléphone'}
              className={`p-1.5 rounded-full transition-colors cursor-pointer ${
                adminPushEnabled
                  ? 'bg-[#D8F36A] text-[#123B2A]'
                  : 'bg-white/10 hover:bg-white/20 text-white'
              }`}
            >
              {adminPushEnabled ? (
                <BellRing className="w-3.5 h-3.5" />
              ) : (
                <Bell className="w-3.5 h-3.5" />
              )}
            </button>
            <button
              onClick={openAddModal}
              className="bg-[#D8F36A] text-[#123B2A] font-bold text-xs px-2.5 py-1.5 rounded-full"
            >
              + Produit
            </button>
            <button
              onClick={onExitAdmin}
              className="bg-white/10 hover:bg-white/20 text-white text-xs px-2.5 py-1.5 rounded-full"
            >
              Boutique
            </button>
            {onLogout && (
              <button
                onClick={onLogout}
                className="bg-red-500/20 hover:bg-red-500/30 text-red-300 p-1.5 rounded-full"
                title="Verrouiller"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Horizontal Navigation tabs */}
        <div className="flex gap-2 overflow-x-auto p-2 bg-[#174532] text-xs whitespace-nowrap">
          <button
            onClick={() => setActiveSection('dashboard')}
            className={`px-3 py-1.5 rounded-full font-bold transition-colors ${
              activeSection === 'dashboard' ? 'bg-[#D8F36A] text-[#123B2A]' : 'text-white/80'
            }`}
          >
            📊 Tableau de bord
          </button>
          <button
            onClick={() => {
              setActiveSection('statistiques');
              void refreshAnalytics(true);
            }}
            className={`px-3 py-1.5 rounded-full font-bold transition-colors ${
              activeSection === 'statistiques' ? 'bg-[#D8F36A] text-[#123B2A]' : 'text-white/80'
            }`}
          >
            📈 Visites &amp; Courbe
          </button>
          <button
            onClick={() => setActiveSection('catalogue')}
            className={`px-3 py-1.5 rounded-full font-bold transition-colors ${
              activeSection === 'catalogue' ? 'bg-[#D8F36A] text-[#123B2A]' : 'text-white/80'
            }`}
          >
            📦 Produits ({products.length})
          </button>
          <button
            onClick={() => setActiveSection('categories')}
            className={`px-3 py-1.5 rounded-full font-bold transition-colors ${
              activeSection === 'categories' ? 'bg-[#D8F36A] text-[#123B2A]' : 'text-white/80'
            }`}
          >
            📁 Catégories ({categories.length})
          </button>
          <button
            onClick={() => setActiveSection('medias')}
            className={`px-3 py-1.5 rounded-full font-bold transition-colors ${
              activeSection === 'medias' ? 'bg-[#D8F36A] text-[#123B2A]' : 'text-white/80'
            }`}
          >
            🖼️ Accueil &amp; Bannières
          </button>
          <button
            onClick={() => setActiveSection('clients')}
            className={`px-3 py-1.5 rounded-full font-bold transition-colors ${
              activeSection === 'clients' ? 'bg-[#D8F36A] text-[#123B2A]' : 'text-white/80'
            }`}
          >
            👥 Clients ({leads.length})
          </button>
          <button
            onClick={() => setActiveSection('commandes')}
            className={`px-3 py-1.5 rounded-full font-bold transition-colors ${
              activeSection === 'commandes' ? 'bg-[#25D366] text-white' : 'text-white/80'
            }`}
          >
            💬 WhatsApp ({orders.length})
          </button>
          <button
            onClick={() => {
              setActiveSection('messagerie');
              refreshChatThreads(false);
            }}
            className={`px-3 py-1.5 rounded-full font-bold transition-colors ${
              activeSection === 'messagerie' ? 'bg-[#D8F36A] text-[#123B2A]' : 'text-white/80'
            }`}
          >
            ✉️ Messagerie ({unreadChatCount > 0 ? `${unreadChatCount} non lu` : chatThreads.length})
          </button>
          <button
            onClick={() => setActiveSection('equipe')}
            className={`px-3 py-1.5 rounded-full font-bold transition-colors ${
              activeSection === 'equipe' ? 'bg-[#D8F36A] text-[#123B2A]' : 'text-white/80'
            }`}
          >
            🤝 Équipe ({teamMembers.length})
          </button>
        </div>
      </div>

      {/* MAIN ADMIN CONTENT AREA */}
      <main className="flex-1 flex flex-col min-w-0 bg-[#F8F7F2]">
        {/* Top Header Desktop */}
        <header className="hidden lg:flex bg-white border-b border-[#E1E3DA] px-8 py-4 items-center justify-between sticky top-0 z-10">
          <div>
            <h1 className="text-xl font-bold font-title text-[#123B2A]">
              Tableau de bord &amp; Activités Commerciales
            </h1>
            <p className="text-xs text-[#6B726C]">
              Boutique Ouagadougou en direct • WhatsApp lié : <strong className="text-[#123B2A]">{WHATSAPP_DISPLAY}</strong>
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleToggleAdminPush}
              disabled={isTogglingPush}
              className={`px-3.5 py-2 rounded-full border text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 ${
                adminPushEnabled
                  ? 'border-[#1F5A40]/30 bg-[#EFEFE6] text-[#123B2A] hover:bg-[#E1E3DA]'
                  : 'border-[#E1E3DA] bg-[#FAF9F5] text-[#123B2A] hover:bg-[#EFEFE6]'
              }`}
            >
              {adminPushEnabled ? (
                <>
                  <BellRing className="w-3.5 h-3.5 text-[#1F5A40]" />
                  <span>Alertes actives</span>
                </>
              ) : (
                <>
                  <Bell className="w-3.5 h-3.5 text-[#6B726C]" />
                  <span>Activer alertes</span>
                </>
              )}
            </button>

            <button
              onClick={onExitAdmin}
              className="px-4 py-2 rounded-full border border-[#E1E3DA] bg-[#FAF9F5] hover:bg-[#EFEFE6] text-xs font-bold text-[#123B2A] transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Voir le site client</span>
            </button>

            <button
              onClick={openAddModal}
              className="px-4 py-2 rounded-full bg-[#123B2A] hover:bg-[#1F5A40] text-white text-xs font-bold shadow-xs transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4 text-[#D8F36A]" />
              <span>Ajouter un produit</span>
            </button>
          </div>
        </header>

        {/* Body Container */}
        <div className="p-4 sm:p-6 lg:p-8 flex flex-col gap-6 max-w-7xl w-full mx-auto">
          {/* 1. REAL METRICS / STATS GRID */}
          <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-[#E1E3DA] shadow-xs">
              <span className="text-xs font-bold uppercase tracking-wider text-[#6B726C]">Commandes WhatsApp</span>
              <p className="text-2xl sm:text-3xl font-extrabold text-[#123B2A] font-title my-1 tabular-nums">
                {orders.length}
              </p>
              <span className="text-xs font-medium text-[#6B726C]">
                {pendingOrdersCount} en cours · {confirmedOrdersCount} validée{confirmedOrdersCount > 1 ? 's' : ''}
              </span>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-[#E1E3DA] shadow-xs">
              <span className="text-xs font-bold uppercase tracking-wider text-[#6B726C]">Chiffre d&apos;Affaires</span>
              <p className="text-xl sm:text-2xl font-extrabold text-[#123B2A] font-title my-1 tabular-nums">
                {formatFCFA(confirmedOrdersAmount)}
              </p>
              <span className="text-xs font-medium text-[#6B726C] tabular-nums">
                Total commandes : {formatFCFA(totalOrdersAmount)}
              </span>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-[#E1E3DA] shadow-xs">
              <span className="text-xs font-bold uppercase tracking-wider text-[#6B726C]">Articles Catalogue</span>
              <p className="text-2xl sm:text-3xl font-extrabold text-[#123B2A] font-title my-1 tabular-nums">
                {products.length}
              </p>
              <span className="text-xs text-[#6B726C] tabular-nums">
                {totalStockCount} unités en stock
              </span>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-[#E1E3DA] shadow-xs">
              <span className="text-xs font-bold uppercase tracking-wider text-[#6B726C]">Contacts &amp; Clients</span>
              <p className="text-2xl sm:text-3xl font-extrabold text-[#123B2A] font-title my-1 tabular-nums">
                {leads.length}
              </p>
              <span className="text-xs font-medium text-[#6B726C]">
                Clients enregistrés sur le site
              </span>
            </div>
          </section>

          {/* 1B. DAILY VISITS, PURCHASES & SITE EVOLUTION CURVE */}
          {(activeSection === 'dashboard' || activeSection === 'statistiques') && (
            <AdminAnalyticsPanel
              dailyStats={dailyStats}
              orders={orders}
              isLoading={isLoadingAnalytics}
              compact={activeSection === 'dashboard'}
              onRefresh={() => refreshAnalytics(true)}
              onOpenFullAnalytics={() => {
                setActiveSection('statistiques');
                void refreshAnalytics(true);
              }}
            />
          )}

          {/* 2. CATALOGUE MANAGEMENT SECTION */}
          {(activeSection === 'dashboard' || activeSection === 'catalogue') && (
            <section className="bg-white border border-[#E1E3DA] rounded-2xl shadow-sm overflow-hidden">
              <div className="p-4 sm:p-5 bg-[#FAF9F5] border-b border-[#E1E3DA] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <h2 className="text-base sm:text-lg font-bold font-title text-[#123B2A]">
                    📦 Gestion des Produits de la Boutique
                  </h2>
                  <span className="text-xs bg-[#EFEFE6] text-[#123B2A] px-2 py-0.5 rounded-full font-bold">
                    {filteredProducts.length} articles · {featuredCount} phares
                  </span>
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <div className="relative flex-1 sm:w-48">
                    <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#6B726C]" />
                    <input
                      type="text"
                      placeholder="Filtrer..."
                      value={productSearch}
                      onChange={(e) => setProductSearch(e.target.value)}
                      className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-[#E1E3DA] rounded-lg focus:outline-[#1F5A40]"
                    />
                  </div>

                  <select
                    value={productCategoryFilter}
                    onChange={(e) => setProductCategoryFilter(e.target.value)}
                    className="p-1.5 text-xs bg-white border border-[#E1E3DA] rounded-lg focus:outline-[#1F5A40]"
                  >
                    <option value="all">Toutes catégories</option>
                    <option value="featured">⭐ Produits phares ({featuredCount})</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.slug}>
                        {c.name}
                      </option>
                    ))}
                  </select>

                  <button
                    onClick={openAddModal}
                    className="px-3 py-1.5 bg-[#123B2A] hover:bg-[#1F5A40] text-[#D8F36A] font-bold text-xs rounded-lg whitespace-nowrap cursor-pointer"
                  >
                    + Ajouter
                  </button>
                </div>
              </div>

              {/* Desktop Table */}
              <div className="hidden sm:block overflow-x-auto">
                <table className="w-full text-left text-xs sm:text-sm">
                  <thead className="bg-[#FAF9F5] text-[#123B2A] uppercase font-bold text-[11px] tracking-wider border-b border-[#E1E3DA]">
                    <tr>
                      <th className="p-3.5">Produit</th>
                      <th className="p-3.5">Catégorie</th>
                      <th className="p-3.5">Prix (F CFA)</th>
                      <th className="p-3.5">Pointures / Tailles</th>
                      <th className="p-3.5">Stock</th>
                      <th className="p-3.5">Produits phares</th>
                      <th className="p-3.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E1E3DA]">
                    {filteredProducts.map((p) => {
                      const isOutOfStock = p.stock <= 0;
                      const isLowStock = p.stock > 0 && p.stock <= 3;
                      const isFeatured = p.featured === true;
                      return (
                        <tr key={p.id} className="hover:bg-[#FAF9F5] transition-colors">
                          <td className="p-3.5">
                            <div className="flex items-center gap-3">
                              <img
                                src={p.images[0] || 'https://www.gstatic.com/labs-code/stitch/stitch-placeholder-300x300.svg'}
                                alt={p.name}
                                className="w-10 h-10 object-cover rounded-md bg-[#EFEFE6] border border-[#E1E3DA] shrink-0"
                              />
                              <div>
                                <p className="font-bold text-[#123B2A]">{p.name}</p>
                                <p className="text-[11px] text-[#6B726C]">Réf: {p.ref}</p>
                              </div>
                            </div>
                          </td>
                          <td className="p-3.5 text-[#4A5568]">{p.categoryLabel}</td>
                          <td className="p-3.5 font-bold text-[#123B2A] tabular-nums">
                            {formatFCFA(p.price)}
                          </td>
                          <td className="p-3.5 text-[#6B726C] text-xs">
                            {p.sizes.join(', ')}
                          </td>
                          <td className="p-3.5">
                            <span
                              className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-bold ${
                                isOutOfStock
                                  ? 'bg-red-100 text-red-800'
                                  : isLowStock
                                  ? 'bg-amber-100 text-amber-800'
                                  : 'bg-emerald-100 text-emerald-800'
                              }`}
                            >
                              {isOutOfStock ? 'Rupture (0)' : isLowStock ? `Faible (${p.stock})` : `En stock (${p.stock})`}
                            </span>
                          </td>
                          <td className="p-3.5">
                            <button
                              type="button"
                              onClick={() => onUpdateProduct({ ...p, featured: !isFeatured })}
                              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold border transition-colors cursor-pointer whitespace-nowrap ${
                                isFeatured
                                  ? 'bg-[#D8F36A]/35 border-[#1F5A40]/30 text-[#123B2A] hover:bg-[#D8F36A]/60'
                                  : 'bg-[#FAF9F5] border-[#E1E3DA] text-[#6B726C] hover:text-[#123B2A]'
                              }`}
                              title={
                                isFeatured
                                  ? 'Affiché dans Nos produits phares (cliquer pour retirer)'
                                  : 'Masqué de Nos produits phares (cliquer pour afficher)'
                              }
                            >
                              <Star className={`w-3.5 h-3.5 ${isFeatured ? 'fill-[#123B2A] text-[#123B2A]' : 'text-[#6B726C]'}`} />
                              <span>{isFeatured ? 'Affiché' : 'Masqué'}</span>
                            </button>
                          </td>
                          <td className="p-3.5 text-right">
                            <div className="inline-flex items-center gap-1.5">
                              <button
                                onClick={() => openEditModal(p)}
                                className="px-2.5 py-1 bg-[#FAF9F5] hover:bg-[#EFEFE6] border border-[#E1E3DA] text-[#123B2A] rounded-md text-xs font-semibold cursor-pointer"
                                title="Modifier le produit"
                              >
                                ✏️ Éditer
                              </button>
                              <button
                                onClick={() => {
                                  setAdjustingPriceProduct(p);
                                  setNewAdjustedPrice(p.price.toString());
                                }}
                                className="px-2.5 py-1 bg-[#FAF9F5] hover:bg-[#EFEFE6] border border-[#E1E3DA] text-[#123B2A] rounded-md text-xs font-semibold cursor-pointer"
                                title="Ajuster le prix"
                              >
                                💰 Prix
                              </button>
                              <button
                                onClick={() => {
                                  if (confirm(`Voulez-vous supprimer l'article "${p.name}" ?`)) {
                                    onDeleteProduct(p.id);
                                  }
                                }}
                                className="p-1 bg-red-50 hover:bg-red-100 border border-red-200 text-red-700 rounded-md text-xs cursor-pointer"
                                title="Supprimer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile Cards View */}
              <div className="sm:hidden p-3 flex flex-col gap-3">
                {filteredProducts.map((p) => (
                  <div key={p.id} className="bg-[#FAF9F5] p-3.5 rounded-xl border border-[#E1E3DA] flex flex-col gap-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <img
                          src={p.images[0]}
                          alt={p.name}
                          className="w-12 h-12 object-cover rounded-lg bg-[#EFEFE6] border border-[#E1E3DA]"
                        />
                        <div>
                          <p className="font-bold text-xs text-[#123B2A]">{p.name}</p>
                          <p className="text-[10px] text-[#6B726C]">Réf: {p.ref} • {p.categoryLabel}</p>
                        </div>
                      </div>
                      <span className="text-[11px] font-bold text-[#1F5A40] bg-emerald-50 px-2 py-0.5 rounded-full">
                        Stock: {p.stock}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-xs pt-1 border-t border-[#E1E3DA]">
                      <span className="font-bold text-[#123B2A]">{formatFCFA(p.price)}</span>
                      <span className="text-[11px] text-[#6B726C]">Tailles: {p.sizes.join(', ')}</span>
                    </div>

                    <div className="grid grid-cols-4 gap-1.5 pt-1">
                      <button
                        type="button"
                        onClick={() => onUpdateProduct({ ...p, featured: !(p.featured === true) })}
                        className={`py-1 text-center border rounded text-xs font-bold flex items-center justify-center gap-1 cursor-pointer ${
                          p.featured === true
                            ? 'bg-[#D8F36A]/45 border-[#1F5A40]/40 text-[#123B2A]'
                            : 'bg-white border-[#E1E3DA] text-[#6B726C]'
                        }`}
                        title="Afficher ou masquer dans Nos produits phares"
                      >
                        <Star className={`w-3 h-3 ${p.featured === true ? 'fill-[#123B2A] text-[#123B2A]' : ''}`} />
                        <span>{p.featured === true ? 'Phare' : 'Masqué'}</span>
                      </button>
                      <button
                        onClick={() => openEditModal(p)}
                        className="py-1 text-center bg-white border border-[#E1E3DA] rounded text-xs font-semibold"
                      >
                        ✏️ Éditer
                      </button>
                      <button
                        onClick={() => {
                          setAdjustingPriceProduct(p);
                          setNewAdjustedPrice(p.price.toString());
                        }}
                        className="py-1 text-center bg-white border border-[#E1E3DA] rounded text-xs font-semibold"
                      >
                        💰 Prix
                      </button>
                      <button
                        onClick={() => {
                          if (confirm(`Supprimer "${p.name}" ?`)) onDeleteProduct(p.id);
                        }}
                        className="py-1 text-center bg-red-50 text-red-700 border border-red-200 rounded text-xs font-semibold"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* 3. CATEGORIES MANAGEMENT SECTION */}
          {(activeSection === 'dashboard' || activeSection === 'categories') && (
            <section className="bg-white border border-[#E1E3DA] rounded-2xl shadow-sm p-5">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-4 border-b border-[#E1E3DA] pb-3">
                <div className="flex items-center gap-2">
                  <h2 className="text-base sm:text-lg font-bold font-title text-[#123B2A]">
                    📁 Catégories d&apos;accueil &amp; Boutique
                  </h2>
                  <span className="text-xs bg-[#E8F7EE] text-[#1F5A40] font-bold px-2 py-0.5 rounded-full">
                    {categories.length} actives
                  </span>
                </div>
                <p className="text-[11px] text-[#6B726C]">
                  Synchronisées automatiquement sur l&apos;accueil, le menu et le pied de page.
                </p>
              </div>

              {/* Add / Edit category form */}
              <form
                onSubmit={handleCategorySubmit}
                className="mb-5 bg-[#FAF9F5] p-4 rounded-xl border border-[#E1E3DA] flex flex-col gap-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-[#123B2A]">
                    {editingCategory
                      ? `✏️ Modifier la catégorie « ${editingCategory.name} »`
                      : '➕ Ajouter une nouvelle catégorie sur le site'}
                  </span>
                  {editingCategory && (
                    <button
                      type="button"
                      onClick={resetCategoryForm}
                      className="text-xs font-semibold text-[#6B726C] hover:text-[#123B2A] cursor-pointer"
                    >
                      Annuler l&apos;édition
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                  <div>
                    <label className="block text-[11px] font-bold text-[#123B2A] mb-1">
                      Nom affiché *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Ex: Sacs & Pochettes"
                      value={newCatName}
                      onChange={(e) => setNewCatName(e.target.value)}
                      className="w-full p-2 text-xs bg-white border border-[#E1E3DA] rounded-lg focus:outline-[#1F5A40]"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-[#123B2A] mb-1">
                      Icône / Émoji
                    </label>
                    <div className="flex gap-1.5">
                      <select
                        value={
                          ['👟', '👡', '👕', '🧢', '👜', '🎒', '🕶️', '⌚', '👗', '👖', '💍', '⚽', '🛍️'].includes(newCatIcon)
                            ? newCatIcon
                            : 'custom'
                        }
                        onChange={(e) => {
                          if (e.target.value !== 'custom') {
                            setNewCatIcon(e.target.value);
                          }
                        }}
                        className="flex-1 p-2 text-xs bg-white border border-[#E1E3DA] rounded-lg"
                      >
                        <option value="👟">👟 Baskets</option>
                        <option value="👡">👡 Sandales</option>
                        <option value="👕">👕 Vêtements</option>
                        <option value="🧢">🧢 Casquettes</option>
                        <option value="👜">👜 Sacs / Cuir</option>
                        <option value="🎒">🎒 Sacs à dos</option>
                        <option value="🕶️">🕶️ Lunettes</option>
                        <option value="⌚">⌚ Montres</option>
                        <option value="👗">👗 Robes / Mode</option>
                        <option value="👖">👖 Jeans / Bas</option>
                        <option value="💍">💍 Bijoux</option>
                        <option value="⚽">⚽ Sport</option>
                        <option value="🛍️">🛍️ Autre</option>
                        {!['👟', '👡', '👕', '🧢', '👜', '🎒', '🕶️', '⌚', '👗', '👖', '💍', '⚽', '🛍️'].includes(newCatIcon) && (
                          <option value="custom">Personnalisé</option>
                        )}
                      </select>
                      <input
                        type="text"
                        value={newCatIcon}
                        onChange={(e) => setNewCatIcon(e.target.value)}
                        maxLength={4}
                        aria-label="Émoji personnalisé"
                        className="w-12 p-2 text-center text-sm bg-white border border-[#E1E3DA] rounded-lg"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-[#123B2A] mb-1">
                      Badge rond (Accueil)
                    </label>
                    <input
                      type="text"
                      placeholder="TOP, NOUVEAU, CUIR..."
                      maxLength={14}
                      value={newCatBadge}
                      onChange={(e) => setNewCatBadge(e.target.value)}
                      className="w-full p-2 text-xs bg-white border border-[#E1E3DA] rounded-lg uppercase focus:outline-[#1F5A40]"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-[#123B2A] mb-1">
                      Sous-titre court (Optionnel)
                    </label>
                    <input
                      type="text"
                      placeholder="Ex: Sneakers & Street"
                      value={newCatSubtitle}
                      onChange={(e) => setNewCatSubtitle(e.target.value)}
                      className="w-full p-2 text-xs bg-white border border-[#E1E3DA] rounded-lg focus:outline-[#1F5A40]"
                    />
                  </div>
                </div>

                {/* Optional category photo */}
                <div className="flex flex-col sm:flex-row sm:items-center gap-3 pt-1">
                  <div className="flex items-center gap-2.5 flex-1">
                    <div className="w-11 h-11 rounded-full bg-white border border-[#E1E3DA] flex items-center justify-center overflow-hidden shrink-0">
                      {newCatImage ? (
                        <img src={newCatImage} alt="Aperçu catégorie" className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-xl">{newCatIcon || '🛍️'}</span>
                      )}
                    </div>
                    <input
                      type="text"
                      placeholder="Lien photo (optionnel — sinon la photo du 1er produit est utilisée)"
                      value={newCatImage}
                      onChange={(e) => setNewCatImage(e.target.value)}
                      className="flex-1 p-2 text-xs bg-white border border-[#E1E3DA] rounded-lg focus:outline-[#1F5A40]"
                    />
                    {newCatImage && (
                      <button
                        type="button"
                        onClick={() => setNewCatImage('')}
                        title="Retirer la photo personnalisée"
                        className="p-2 text-xs text-red-600 hover:bg-red-50 rounded-lg border border-red-200 cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <label className="px-3 py-2 bg-white hover:bg-[#EFEFE6] border border-[#E1E3DA] text-[#123B2A] text-xs font-bold rounded-lg cursor-pointer inline-flex items-center gap-1.5">
                      <Upload className="w-3.5 h-3.5" />
                      <span>{isUploadingCatImage ? 'Compression...' : 'Photo'}</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => handleCategoryImageUpload(e.target.files)}
                        className="hidden"
                      />
                    </label>

                    <button
                      type="submit"
                      className="px-4 py-2 bg-[#123B2A] hover:bg-[#1F5A40] text-white text-xs font-bold rounded-lg cursor-pointer"
                    >
                      {editingCategory ? 'Enregistrer' : '+ Ajouter catégorie'}
                    </button>
                  </div>
                </div>
              </form>

              {/* Categories list */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {categories.map((cat) => {
                  const attachedCount = products.filter((p) => p.category === cat.slug).length;
                  const autoProductImg = products.find(
                    (p) => p.category === cat.slug && p.images?.[0]
                  )?.images?.[0];
                  const thumbSrc = cat.image || autoProductImg;

                  return (
                    <div
                      key={cat.id}
                      className={`p-3.5 rounded-xl border bg-white flex items-center justify-between gap-2 shadow-xs ${
                        editingCategory?.id === cat.id
                          ? 'border-[#123B2A] ring-2 ring-[#D8F36A]'
                          : 'border-[#E1E3DA]'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-11 h-11 rounded-full bg-[#EFEFE6] border border-[#E1E3DA] flex items-center justify-center text-xl overflow-hidden shrink-0">
                          {thumbSrc ? (
                            <img src={thumbSrc} alt={cat.name} className="w-full h-full object-cover" />
                          ) : (
                            <span>{cat.icon}</span>
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <p className="font-bold text-sm text-[#123B2A] truncate">{cat.name}</p>
                            {cat.badge && (
                              <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded-full bg-[#123B2A] text-[#D8F36A] uppercase shrink-0">
                                {cat.badge}
                              </span>
                            )}
                          </div>
                          {cat.subtitle && (
                            <p className="text-[11px] text-[#4A5568] truncate">{cat.subtitle}</p>
                          )}
                          <p className="text-[11px] text-[#6B726C]">
                            {attachedCount} article{attachedCount > 1 ? 's' : ''} rattaché{attachedCount > 1 ? 's' : ''}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleEditCategoryClick(cat)}
                          className="p-1.5 text-[#123B2A] hover:bg-[#EFEFE6] rounded-md cursor-pointer"
                          title="Modifier cette catégorie"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        {categories.length > 1 && (
                          <button
                            type="button"
                            onClick={() => {
                              if (confirm(`Supprimer la catégorie "${cat.name}" ?`)) {
                                if (editingCategory?.id === cat.id) resetCategoryForm();
                                onDeleteCategory(cat.id);
                              }
                            }}
                            className="text-red-600 hover:bg-red-50 p-1.5 rounded-md cursor-pointer"
                            title="Supprimer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* 4. SPLIT: CLIENTS CRM & LIVE WHATSAPP ORDERS */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* CLIENTS & PROSPECTS (7 Cols) */}
            {(activeSection === 'dashboard' || activeSection === 'clients') && (
              <div className="lg:col-span-6 bg-white border border-[#E1E3DA] rounded-2xl shadow-sm p-5">
                <div className="flex items-center justify-between mb-4 border-b border-[#E1E3DA] pb-3">
                  <h2 className="text-base font-bold font-title text-[#123B2A] flex items-center gap-2">
                    <Users className="w-4 h-4 text-[#1F5A40]" />
                    <span>Suivi des Clients &amp; Contacts WhatsApp</span>
                  </h2>
                  <span className="text-[11px] bg-[#25D366]/15 text-[#0e743a] font-bold px-2 py-0.5 rounded-full">
                    Direct WhatsApp
                  </span>
                </div>

                <div className="divide-y divide-[#E1E3DA]">
                  {leads.length === 0 ? (
                    <div className="py-8 text-center text-xs text-[#6B726C]">
                      Aucun contact client enregistré pour le moment. Les clients ayant passé commande apparaîtront automatiquement ici.
                    </div>
                  ) : (
                    leads.map((lead) => (
                      <div key={lead.id} className="py-3 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-9 h-9 rounded-full bg-[#FAF9F5] border border-[#E1E3DA] text-[#123B2A] font-bold flex items-center justify-center text-xs shrink-0">
                            {lead.avatar}
                          </div>
                          <div className="min-w-0">
                            <p className="font-bold text-xs sm:text-sm text-[#123B2A] truncate">{lead.name}</p>
                            <p className="text-[11px] text-[#6B726C] truncate">{lead.city} • {lead.notes}</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          {lead.phone && lead.phone !== 'Non précisé' && (
                            <a
                              href={`https://wa.me/${lead.phone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(
                                `Bonjour ${lead.name}, c'est l'équipe HUIZE SHOP Ouagadougou. Suite à votre commande, comment pouvons-nous vous aider ?`
                              )}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-[#25D366] hover:bg-[#20ba5a] text-white font-bold text-xs shadow-xs"
                            >
                              <MessageCircle className="w-3.5 h-3.5 fill-current" />
                              <span>Contacter</span>
                            </a>
                          )}
                          {onDeleteLead && (
                            <button
                              type="button"
                              onClick={() => {
                                if (confirm(`Supprimer le contact "${lead.name}" ?`)) {
                                  onDeleteLead(lead.id);
                                }
                              }}
                              title="Supprimer ce contact"
                              className="p-1.5 rounded-full text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* CUSTOMER REVIEWS MODERATION IN CLIENTS TAB */}
            {activeSection === 'clients' && (
              <div className="lg:col-span-6 bg-white border border-[#E1E3DA] rounded-2xl shadow-sm p-5">
                <div className="flex items-center justify-between mb-4 border-b border-[#E1E3DA] pb-3 gap-2">
                  <h2 className="text-base font-bold font-title text-[#123B2A] flex items-center gap-2">
                    <Star className="w-4 h-4 text-amber-500 fill-amber-400" />
                    <span>Avis Clients publiés ({customerReviews.length})</span>
                  </h2>
                  <button
                    type="button"
                    onClick={() => refreshCustomerReviews(true)}
                    disabled={isLoadingReviews}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-[#E1E3DA] bg-[#FAF9F5] hover:bg-[#EFEFE6] text-[#123B2A] text-[11px] font-bold transition-colors cursor-pointer disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3 h-3 ${isLoadingReviews ? 'animate-spin' : ''}`} />
                    <span>Actualiser</span>
                  </button>
                </div>

                <div className="divide-y divide-[#E1E3DA]">
                  {customerReviews.length === 0 ? (
                    <div className="py-8 text-center text-xs text-[#6B726C]">
                      Aucun avis client publié pour le moment. Les avis envoyés depuis la page d&apos;accueil apparaîtront ici.
                    </div>
                  ) : (
                    customerReviews.map((review) => (
                      <div key={review.id} className="py-3 flex items-start justify-between gap-3">
                        <div className="min-w-0 space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-bold text-xs sm:text-sm text-[#123B2A]">
                              {review.authorName}
                            </span>
                            {review.city && (
                              <span className="text-[11px] text-[#6B726C]">· {review.city}</span>
                            )}
                            <span className="inline-flex items-center gap-0.5 text-[11px] font-bold text-amber-600 tabular-nums">
                              ★ {review.rating}/5
                            </span>
                          </div>
                          <p className="text-xs text-[#202720] leading-relaxed break-words">
                            « {review.comment} »
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleDeleteCustomerReview(review)}
                          title="Supprimer cet avis"
                          className="p-1.5 rounded-full text-red-600 hover:bg-red-50 transition-colors cursor-pointer shrink-0"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* LIVE WHATSAPP ORDERS (6 Cols) */}
            {(activeSection === 'dashboard' || activeSection === 'commandes') && (
              <div className="lg:col-span-6 bg-white border border-[#E1E3DA] rounded-2xl shadow-sm p-5">
                <div className="flex items-center justify-between mb-4 border-b border-[#E1E3DA] pb-3 gap-2">
                  <h2 className="text-base font-bold font-title text-[#123B2A] flex items-center gap-2">
                    <MessageCircle className="w-4 h-4 text-[#25D366]" />
                    <span>Commandes &amp; Activités WhatsApp</span>
                  </h2>
                  {onRefreshAdminData && (
                    <button
                      type="button"
                      onClick={handleRefreshClick}
                      disabled={isRefreshingData}
                      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-[#E1E3DA] bg-[#FAF9F5] hover:bg-[#EFEFE6] text-[#123B2A] text-[11px] font-bold transition-colors cursor-pointer disabled:opacity-50"
                    >
                      <RefreshCw className={`w-3 h-3 ${isRefreshingData ? 'animate-spin' : ''}`} />
                      <span>{isRefreshingData ? 'Actualisation...' : 'Actualiser'}</span>
                    </button>
                  )}
                </div>

                <div className="flex flex-col gap-3">
                  {orders.length === 0 ? (
                    <div className="py-8 text-center text-xs text-[#6B726C]">
                      Aucune commande réelle enregistrée pour le moment. Les commandes envoyées par les clients depuis le panier ou les fiches produits apparaîtront ici.
                    </div>
                  ) : (
                    orders.map((ord) => {
                      const resolvedOrderItems =
                        ord.items && ord.items.length > 0
                          ? ord.items.map((item) => {
                              const liveProd = products.find((p) => p.id === item.productId);
                              return {
                                name: item.name,
                                ref: item.ref || liveProd?.ref,
                                size: item.size,
                                quantity: item.quantity,
                                price: item.price,
                                image:
                                  liveProd?.images?.[0] ||
                                  item.image ||
                                  `/api/products/${encodeURIComponent(item.productId)}/image.jpg`
                              };
                            })
                          : products
                              .filter((p) => {
                                const lowerSummary = ord.itemsSummary.toLowerCase();
                                return (
                                  lowerSummary.includes(p.name.toLowerCase()) ||
                                  (p.ref && lowerSummary.includes(p.ref.toLowerCase()))
                                );
                              })
                              .map((p) => ({
                                name: p.name,
                                ref: p.ref,
                                size: undefined,
                                quantity: 1,
                                price: p.price,
                                image: p.images[0] || `/api/products/${encodeURIComponent(p.id)}/image.jpg`
                              }));

                      return (
                        <div
                          key={ord.id}
                          className="p-3.5 rounded-xl border border-[#E1E3DA] bg-[#FAF9F5] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                        >
                          <div className="flex items-start sm:items-center gap-3 min-w-0">
                            {resolvedOrderItems.length > 0 ? (
                              <button
                                type="button"
                                onClick={() => setPreviewOrder(ord)}
                                title="Agrandir la photo du ou des produits commandés"
                                className="flex -space-x-2 shrink-0 cursor-pointer group"
                              >
                                {resolvedOrderItems.slice(0, 3).map((item, idx) => (
                                  <img
                                    key={idx}
                                    src={item.image}
                                    alt={item.name}
                                    className="w-12 h-12 rounded-lg object-cover bg-white border-2 border-white ring-1 ring-[#E1E3DA] shadow-xs group-hover:scale-105 transition-transform"
                                  />
                                ))}
                                {resolvedOrderItems.length > 3 && (
                                  <span className="w-12 h-12 rounded-lg bg-[#123B2A] text-[#D8F36A] border-2 border-white flex items-center justify-center text-[11px] font-bold">
                                    +{resolvedOrderItems.length - 3}
                                  </span>
                                )}
                              </button>
                            ) : (
                              <div className="w-12 h-12 rounded-lg bg-white border border-[#E1E3DA] flex items-center justify-center text-[#6B726C] shrink-0">
                                <Package className="w-5 h-5" />
                              </div>
                            )}

                            <div className="min-w-0">
                              <p className="font-bold text-[#123B2A] truncate">
                                {ord.id} • {ord.customerName}
                                {ord.phone && ord.phone !== 'Non précisé' ? ` (${ord.phone})` : ''}
                              </p>
                              <p className="text-[#4A5568] text-[11px] line-clamp-2">
                                {ord.itemsSummary}
                              </p>
                              <p className="text-[10px] text-[#1F5A40] mt-0.5">
                                {ord.city} • {ord.date}
                                {ord.referredByCode ? ` • Conseiller : ${ord.referredByCode}` : ''}
                              </p>
                            </div>
                          </div>

                          <div className="text-right shrink-0 flex flex-col items-end gap-1.5">
                            <p className="font-bold text-[#123B2A] tabular-nums font-title text-sm">
                              {formatFCFA(ord.total)}
                            </p>
                            <div className="flex flex-wrap items-center justify-end gap-1.5">
                              {chatThreads.some((t) => t.orderId === ord.id) && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setActiveSection('messagerie');
                                    handleSelectChatThread(ord.id);
                                  }}
                                  className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-[#123B2A] text-[#D8F36A] text-[10px] font-bold cursor-pointer hover:bg-[#1F5A40]"
                                >
                                  <MessageSquare className="w-3 h-3" />
                                  <span>Discuter</span>
                                </button>
                              )}
                              {onAssignOrderReferral && teamMembers.length > 0 && (
                                <select
                                  value={ord.referredByCode || ''}
                                  onChange={(e) => onAssignOrderReferral(ord.id, e.target.value)}
                                  title="Attribuer à un membre d'équipe"
                                  className="text-[10px] font-semibold p-1 rounded-md bg-white border border-[#E1E3DA] text-[#123B2A] max-w-[130px]"
                                >
                                  <option value="">Direct boutique</option>
                                  {teamMembers.map((tm) => (
                                    <option key={tm.id} value={tm.code}>
                                      {tm.name} ({tm.code})
                                    </option>
                                  ))}
                                </select>
                              )}
                              <select
                                value={ord.status}
                                onChange={(e) => {
                                  const nextStatus = e.target.value as WhatsAppOrder['status'];
                                  onUpdateOrderStatus(ord.id, nextStatus);
                                  if (chatThreads.some((t) => t.orderId === ord.id)) {
                                    void handleUpdateChatThreadStatus(ord.id, nextStatus);
                                  }
                                }}
                                className="text-[10px] font-bold p-1 rounded-md bg-white border border-[#E1E3DA]"
                              >
                                <option value="pending">À livrer</option>
                                <option value="paid">Payé (Orange/Moov)</option>
                                <option value="delivered">Livré</option>
                                <option value="discussion">En discussion</option>
                              </select>
                              {onDeleteOrder && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (confirm(`Supprimer la commande ${ord.id} ?`)) {
                                      onDeleteOrder(ord.id);
                                    }
                                  }}
                                  title="Supprimer cette commande"
                                  className="p-1 rounded-md text-red-600 hover:bg-red-50 border border-transparent hover:border-red-200 cursor-pointer"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}

            {/* EQUIPE & PARTAGE MANAGEMENT */}
            {activeSection === 'equipe' && (() => {
              const portalUrl = `${getAppOrigin()}/?equipe=1`;

              const memberMetrics = teamMembers.map((member) => {
                const cleanCode = normalizeReferralCode(member.code);
                const memberOrders = orders.filter(
                  (o) => normalizeReferralCode(o.referredByCode) === cleanCode
                );
                const validatedSales = memberOrders.filter(
                  (o) => o.status === 'paid' || o.status === 'delivered'
                ).length;
                return {
                  member,
                  ordersCount: memberOrders.length,
                  salesCount: validatedSales
                };
              });

              memberMetrics.sort(
                (a, b) =>
                  b.salesCount - a.salesCount ||
                  b.ordersCount - a.ordersCount ||
                  (b.member.clicks || 0) - (a.member.clicks || 0)
              );

              const totalTeamClicks = teamMembers.reduce((acc, m) => acc + (m.clicks || 0), 0);
              const totalTeamOrders = memberMetrics.reduce((acc, item) => acc + item.ordersCount, 0);
              const totalTeamSales = memberMetrics.reduce((acc, item) => acc + item.salesCount, 0);

              const resetTeamForm = () => {
                setEditingMember(null);
                setMemberName('');
                setMemberCode('');
                setMemberPin('');
                setMemberPhone('');
                setTeamFormError(null);
              };

              const handleTeamFormSubmit = async (e: React.FormEvent) => {
                e.preventDefault();
                setTeamFormError(null);

                const cleanName = memberName.trim();
                const cleanCode = normalizeReferralCode(memberCode);
                const cleanPin = memberPin.trim();
                const cleanPhone = memberPhone.trim();

                if (!cleanName) {
                  setTeamFormError('Veuillez saisir le nom complet du membre.');
                  return;
                }
                if (!cleanCode || cleanCode.length < 2) {
                  setTeamFormError('Veuillez choisir un code personnel (au moins 2 caractères, ex : MOUSA).');
                  return;
                }
                if (!cleanPin || cleanPin.length < 4) {
                  setTeamFormError('Le code PIN doit contenir au moins 4 chiffres.');
                  return;
                }

                const duplicate = teamMembers.find(
                  (m) =>
                    normalizeReferralCode(m.code) === cleanCode &&
                    (!editingMember || m.id !== editingMember.id)
                );
                if (duplicate) {
                  setTeamFormError(`Le code "${cleanCode}" est déjà utilisé par ${duplicate.name}.`);
                  return;
                }

                if (editingMember && onUpdateTeamMember) {
                  await onUpdateTeamMember({
                    ...editingMember,
                    name: cleanName,
                    code: cleanCode,
                    pin: cleanPin,
                    phone: cleanPhone || undefined
                  });
                  resetTeamForm();
                } else if (onAddTeamMember) {
                  await onAddTeamMember({
                    name: cleanName,
                    code: cleanCode,
                    pin: cleanPin,
                    phone: cleanPhone || undefined
                  });
                  resetTeamForm();
                }
              };

              const handleCopyValue = async (value: string, key: string) => {
                try {
                  await navigator.clipboard.writeText(value);
                  setCopiedTeamCode(key);
                  setTimeout(() => setCopiedTeamCode(null), 2000);
                } catch {
                  // Ignore clipboard failure
                }
              };

              return (
                <div className="lg:col-span-12 flex flex-col gap-6">
                  {/* Top Header & Portal Link */}
                  <div className="bg-white border border-[#E1E3DA] rounded-2xl p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                      <h2 className="text-lg font-bold font-title text-[#123B2A] flex items-center gap-2">
                        <Share2 className="w-5 h-5 text-[#1F5A40]" />
                        <span>Équipe &amp; Suivi des Partages</span>
                      </h2>
                      <p className="text-xs text-[#6B726C] mt-0.5">
                        Créez un code personnel et un PIN pour chaque membre (avec ou sans téléphone) et suivez clics, commandes et ventes validées.
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {onRefreshAdminData && (
                        <button
                          type="button"
                          onClick={handleRefreshClick}
                          disabled={isRefreshingData}
                          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-[#E1E3DA] bg-[#FAF9F5] hover:bg-[#EFEFE6] text-xs font-bold text-[#123B2A] cursor-pointer disabled:opacity-50"
                        >
                          <RefreshCw className={`w-3.5 h-3.5 ${isRefreshingData ? 'animate-spin' : ''}`} />
                          <span>Actualiser</span>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => handleCopyValue(portalUrl, 'portal-url')}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#123B2A] hover:bg-[#1F5A40] text-white text-xs font-bold cursor-pointer"
                      >
                        {copiedTeamCode === 'portal-url' ? (
                          <Check className="w-3.5 h-3.5 text-[#D8F36A]" />
                        ) : (
                          <Copy className="w-3.5 h-3.5 text-[#D8F36A]" />
                        )}
                        <span>
                          {copiedTeamCode === 'portal-url'
                            ? 'Lien Espace Équipe copié !'
                            : 'Copier lien Espace Équipe'}
                        </span>
                      </button>
                    </div>
                  </div>

                  {/* Team KPIs */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="bg-white border border-[#E1E3DA] rounded-2xl p-5 shadow-xs">
                      <span className="text-xs font-bold uppercase tracking-wider text-[#6B726C]">
                        Total Clics Équipe
                      </span>
                      <p className="text-2xl font-extrabold text-[#123B2A] font-title my-1 tabular-nums">
                        {totalTeamClicks}
                      </p>
                      <span className="text-xs text-[#6B726C]">
                        Sur l&apos;ensemble des liens partagés
                      </span>
                    </div>

                    <div className="bg-white border border-[#E1E3DA] rounded-2xl p-5 shadow-xs">
                      <span className="text-xs font-bold uppercase tracking-wider text-[#6B726C]">
                        Commandes Équipe
                      </span>
                      <p className="text-2xl font-extrabold text-[#123B2A] font-title my-1 tabular-nums">
                        {totalTeamOrders}
                      </p>
                      <span className="text-xs text-[#6B726C]">
                        Via lien ?ref= ou code conseiller
                      </span>
                    </div>

                    <div className="bg-white border border-[#E1E3DA] rounded-2xl p-5 shadow-xs">
                      <span className="text-xs font-bold uppercase tracking-wider text-[#6B726C]">
                        Ventes Validées Équipe
                      </span>
                      <p className="text-2xl font-extrabold text-[#1F5A40] font-title my-1 tabular-nums">
                        {totalTeamSales}
                      </p>
                      <span className="text-xs text-[#6B726C]">
                        Payées ou livrées confirmées
                      </span>
                    </div>
                  </div>

                  {/* Add / Edit Team Member Form */}
                  <div className="bg-white border border-[#E1E3DA] rounded-2xl p-5 sm:p-6 shadow-xs">
                    <div className="flex items-center justify-between pb-3 mb-4 border-b border-[#E1E3DA]">
                      <h3 className="text-base font-bold font-title text-[#123B2A] flex items-center gap-2">
                        <UserPlus className="w-4 h-4 text-[#1F5A40]" />
                        <span>
                          {editingMember
                            ? `Modifier : ${editingMember.name}`
                            : 'Ajouter un membre à l’équipe'}
                        </span>
                      </h3>
                      {editingMember && (
                        <button
                          type="button"
                          onClick={resetTeamForm}
                          className="text-xs font-bold text-[#6B726C] hover:text-[#123B2A] cursor-pointer"
                        >
                          Annuler la modification
                        </button>
                      )}
                    </div>

                    <form onSubmit={handleTeamFormSubmit} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                      <div>
                        <label className="block font-bold text-[#123B2A] mb-1">Nom complet *</label>
                        <input
                          type="text"
                          required
                          value={memberName}
                          onChange={(e) => {
                            const val = e.target.value;
                            setMemberName(val);
                            if (!editingMember && !memberCode) {
                              const suggested = val
                                .trim()
                                .split(/\s+/)[0]
                                .toUpperCase()
                                .replace(/[^A-Z0-9]/g, '')
                                .slice(0, 10);
                              if (suggested.length >= 3) {
                                setMemberCode(suggested);
                              }
                            }
                          }}
                          placeholder="Ex : Moussa Traoré"
                          className="w-full p-2.5 rounded-lg border border-[#E1E3DA] bg-[#FAF9F5] focus:outline-[#1F5A40]"
                        />
                      </div>

                      <div>
                        <label className="block font-bold text-[#123B2A] mb-1">Code personnel *</label>
                        <input
                          type="text"
                          required
                          value={memberCode}
                          onChange={(e) => setMemberCode(e.target.value.toUpperCase())}
                          placeholder="Ex : MOUSA"
                          className="w-full p-2.5 rounded-lg border border-[#E1E3DA] bg-[#FAF9F5] uppercase font-mono focus:outline-[#1F5A40]"
                        />
                      </div>

                      <div>
                        <label className="block font-bold text-[#123B2A] mb-1">Code PIN (4-6 chiffres) *</label>
                        <input
                          type="text"
                          required
                          inputMode="numeric"
                          maxLength={8}
                          value={memberPin}
                          onChange={(e) => setMemberPin(e.target.value)}
                          placeholder="Ex : 4582"
                          className="w-full p-2.5 rounded-lg border border-[#E1E3DA] bg-[#FAF9F5] font-mono focus:outline-[#1F5A40]"
                        />
                      </div>

                      <div>
                        <label className="block font-bold text-[#123B2A] mb-1">
                          Téléphone (optionnel)
                        </label>
                        <input
                          type="tel"
                          value={memberPhone}
                          onChange={(e) => setMemberPhone(e.target.value)}
                          placeholder="Laisser vide si sans téléphone"
                          className="w-full p-2.5 rounded-lg border border-[#E1E3DA] bg-[#FAF9F5] focus:outline-[#1F5A40]"
                        />
                      </div>

                      {teamFormError && (
                        <div className="sm:col-span-2 lg:col-span-4 p-2.5 rounded-lg bg-red-50 border border-red-200 text-red-700 font-semibold">
                          {teamFormError}
                        </div>
                      )}

                      <div className="sm:col-span-2 lg:col-span-4 flex items-center justify-end gap-2 pt-1">
                        <button
                          type="submit"
                          className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-lg bg-[#123B2A] hover:bg-[#1F5A40] text-white font-bold text-xs cursor-pointer"
                        >
                          <Save className="w-3.5 h-3.5 text-[#D8F36A]" />
                          <span>{editingMember ? 'Enregistrer les modifications' : 'Créer le compte membre'}</span>
                        </button>
                      </div>
                    </form>
                  </div>

                  {/* Team Leaderboard / Progression Table */}
                  <div className="bg-white border border-[#E1E3DA] rounded-2xl shadow-xs overflow-hidden">
                    <div className="p-4 sm:p-5 bg-[#FAF9F5] border-b border-[#E1E3DA] flex items-center justify-between">
                      <h3 className="text-base font-bold font-title text-[#123B2A]">
                        Progression par membre ({teamMembers.length})
                      </h3>
                      <span className="text-xs text-[#6B726C]">
                        Classé par ventes validées
                      </span>
                    </div>

                    {memberMetrics.length === 0 ? (
                      <div className="p-10 text-center text-xs sm:text-sm text-[#6B726C]">
                        Aucun membre d&apos;équipe enregistré pour le moment. Créez un premier code et PIN ci-dessus pour suivre les partages.
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs sm:text-sm">
                          <thead className="bg-[#FAF9F5] text-[#123B2A] uppercase font-bold text-[11px] tracking-wider border-b border-[#E1E3DA]">
                            <tr>
                              <th className="p-3.5">Membre</th>
                              <th className="p-3.5">Code &amp; PIN</th>
                              <th className="p-3.5 text-right">Clics</th>
                              <th className="p-3.5 text-right">Commandes</th>
                              <th className="p-3.5 text-right">Ventes validées</th>
                              <th className="p-3.5 text-right">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[#E1E3DA]">
                            {memberMetrics.map(({ member, ordersCount, salesCount }) => {
                              const shareLink = getBoutiqueShareUrl(member.code);
                              const isPinVisible = Boolean(revealedPins[member.id]);
                              return (
                                <tr key={member.id} className="hover:bg-[#FAF9F5]">
                                  <td className="p-3.5">
                                    <p className="font-bold text-[#123B2A]">
                                      {member.name}
                                      {!member.active && (
                                        <span className="ml-2 text-[11px] font-semibold text-red-700">
                                          (Désactivé)
                                        </span>
                                      )}
                                    </p>
                                    <p className="text-[11px] text-[#6B726C]">
                                      {member.phone ? member.phone : 'Sans téléphone · Code oral / appareil partagé'}
                                    </p>
                                  </td>
                                  <td className="p-3.5">
                                    <div className="flex items-center gap-2 font-mono text-xs">
                                      <strong className="text-[#123B2A]">{member.code}</strong>
                                      <span className="text-[#6B726C]">· PIN :</span>
                                      <span className="text-[#202720]">
                                        {isPinVisible ? member.pin : '••••'}
                                      </span>
                                      <button
                                        type="button"
                                        onClick={() =>
                                          setRevealedPins((prev) => ({
                                            ...prev,
                                            [member.id]: !prev[member.id]
                                          }))
                                        }
                                        title={isPinVisible ? 'Masquer PIN' : 'Voir PIN'}
                                        className="text-[#6B726C] hover:text-[#123B2A] cursor-pointer"
                                      >
                                        {isPinVisible ? (
                                          <EyeOff className="w-3.5 h-3.5" />
                                        ) : (
                                          <Eye className="w-3.5 h-3.5" />
                                        )}
                                      </button>
                                    </div>
                                  </td>
                                  <td className="p-3.5 text-right font-bold tabular-nums text-[#123B2A]">
                                    {member.clicks || 0}
                                  </td>
                                  <td className="p-3.5 text-right font-bold tabular-nums text-[#123B2A]">
                                    {ordersCount}
                                  </td>
                                  <td className="p-3.5 text-right font-extrabold tabular-nums text-[#1F5A40]">
                                    {salesCount}
                                  </td>
                                  <td className="p-3.5 text-right">
                                    <div className="inline-flex items-center gap-1.5">
                                      <button
                                        type="button"
                                        onClick={() => handleCopyValue(shareLink, member.id)}
                                        className="px-2.5 py-1 bg-[#FAF9F5] hover:bg-[#EFEFE6] border border-[#E1E3DA] text-[#123B2A] rounded-md text-xs font-semibold cursor-pointer inline-flex items-center gap-1"
                                        title="Copier le lien personnel"
                                      >
                                        {copiedTeamCode === member.id ? (
                                          <Check className="w-3 h-3 text-[#1F5A40]" />
                                        ) : (
                                          <Copy className="w-3 h-3" />
                                        )}
                                        <span>{copiedTeamCode === member.id ? 'Copié' : 'Lien'}</span>
                                      </button>

                                      {onUpdateTeamMember && (
                                        <button
                                          type="button"
                                          onClick={() =>
                                            onUpdateTeamMember({
                                              ...member,
                                              active: !member.active
                                            })
                                          }
                                          className="px-2.5 py-1 bg-[#FAF9F5] hover:bg-[#EFEFE6] border border-[#E1E3DA] text-[#123B2A] rounded-md text-xs font-semibold cursor-pointer"
                                        >
                                          {member.active ? 'Désactiver' : 'Activer'}
                                        </button>
                                      )}

                                      <button
                                        type="button"
                                        onClick={() => {
                                          setEditingMember(member);
                                          setMemberName(member.name);
                                          setMemberCode(member.code);
                                          setMemberPin(member.pin);
                                          setMemberPhone(member.phone || '');
                                          setTeamFormError(null);
                                        }}
                                        className="p-1.5 bg-[#FAF9F5] hover:bg-[#EFEFE6] border border-[#E1E3DA] text-[#123B2A] rounded-md cursor-pointer"
                                        title="Modifier"
                                      >
                                        <Edit3 className="w-3.5 h-3.5" />
                                      </button>

                                      {onDeleteTeamMember && (
                                        <button
                                          type="button"
                                          onClick={() => {
                                            if (confirm(`Supprimer le membre "${member.name}" ?`)) {
                                              onDeleteTeamMember(member.id);
                                            }
                                          }}
                                          className="p-1.5 bg-red-50 hover:bg-red-100 border border-red-200 text-red-700 rounded-md cursor-pointer"
                                          title="Supprimer"
                                        >
                                          <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                      )}
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}

            {/* MESSAGERIE CLIENTS EN DIRECT */}
            {activeSection === 'messagerie' && (
              <div className="lg:col-span-12">
                <AdminChatInbox
                  threads={chatThreads}
                  selectedThreadId={selectedChatThreadId}
                  onSelectThread={handleSelectChatThread}
                  messages={chatMessages}
                  isLoadingMessages={isLoadingChatMessages}
                  wsConnected={chatWsConnected}
                  products={products}
                  onSendMessage={handleSendAdminChatMessage}
                  onUpdateStatus={handleUpdateChatThreadStatus}
                  onRefreshThreads={() => refreshChatThreads(true)}
                  adminPushEnabled={adminPushEnabled}
                  isTogglingPush={isTogglingPush}
                  isTestingPush={isTestingPush}
                  pushFeedback={pushFeedback}
                  onTogglePush={handleToggleAdminPush}
                  onTestPush={handleTestAdminPush}
                />
              </div>
            )}

            {/* MEDIAS: GESTION DE LA PHOTO HERO ET DU CARROUSEL DES PRODUITS QUI FILENT */}
            {activeSection === 'medias' && (
              <div className="lg:col-span-12 flex flex-col gap-6">
                {/* Header card with action */}
                <div className="bg-white border border-[#E1E3DA] rounded-2xl p-5 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div>
                    <h2 className="text-lg font-bold font-title text-[#123B2A] flex items-center gap-2">
                      <ImageIcon className="w-5 h-5 text-[#1F5A40]" />
                      <span>Photos d'accueil &amp; Bannières Défilantes</span>
                    </h2>
                    <p className="text-xs text-[#6B726C] mt-0.5">
                      Personnalisez la photo principale de l'Hero et les images des produits qui défilent dans le carrousel.
                    </p>
                  </div>

                  <button
                    onClick={handleSaveMediaConfig}
                    disabled={isSavingMedia}
                    className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-[#123B2A] hover:bg-[#1F5A40] text-white text-xs sm:text-sm font-bold shadow-md transition-all active:scale-95 cursor-pointer disabled:opacity-50"
                  >
                    <Save className="w-4 h-4 text-[#D8F36A]" />
                    <span>{isSavingMedia ? 'Enregistrement en cours...' : '💾 Publier les modifications'}</span>
                  </button>
                </div>

                {/* 0. LOGO DU SITE */}
                <div className="bg-white border border-[#E1E3DA] rounded-2xl p-6 shadow-xs">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-[#E1E3DA] pb-3 mb-5 gap-2">
                    <div>
                      <h3 className="text-base font-bold font-title text-[#123B2A] flex items-center gap-2">
                        <ImageIcon className="w-4 h-4 text-[#1F5A40]" />
                        <span>0. Logo du site (En-tête, Pied de page &amp; Onglet navigateur)</span>
                      </h3>
                      <p className="text-xs text-[#6B726C]">
                        Importez votre logo officiel (PNG transparent recommandé) ou collez son lien
                      </p>
                    </div>
                    {logoUrl && (
                      <button
                        type="button"
                        onClick={() => setLogoUrl('')}
                        className="text-xs text-red-600 hover:underline font-semibold self-start sm:self-center cursor-pointer"
                      >
                        Revenir au badge texte par défaut
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-center">
                    <div className="md:col-span-4 flex flex-col items-center justify-center p-4 rounded-xl bg-[#FAF9F5] border border-[#E1E3DA] min-h-28">
                      {logoUrl ? (
                        <img
                          src={logoUrl}
                          alt="Aperçu du logo HUIZE SHOP"
                          className="max-h-20 max-w-full object-contain"
                        />
                      ) : (
                        <span className="bg-[#123B2A] text-[#D8F36A] px-3 py-1.5 rounded-md font-bold text-base tracking-wider font-title">
                          HUIZE SHOP
                        </span>
                      )}
                      <span className="text-[10px] text-[#6B726C] mt-2">
                        {logoUrl ? 'Logo personnalisé actif' : 'Badge texte par défaut'}
                      </span>
                    </div>

                    <div className="md:col-span-8 flex flex-col gap-3">
                      <label className="w-full border-2 border-dashed border-[#1F5A40]/30 hover:border-[#1F5A40] rounded-xl p-3 bg-[#FAF9F5] text-center transition-colors cursor-pointer block">
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => handleLogoFileUpload(e.target.files)}
                          className="hidden"
                        />
                        <div className="flex items-center justify-center gap-2 text-xs font-bold text-[#123B2A]">
                          <Upload className="w-4 h-4 text-[#1F5A40]" />
                          <span>{isUploadingLogo ? 'Optimisation du logo...' : 'Importer le logo depuis votre appareil (Téléphone / PC)'}</span>
                        </div>
                      </label>

                      <div>
                        <label className="block font-bold text-[#123B2A] text-xs mb-1">
                          Ou coller le lien URL du logo
                        </label>
                        <input
                          type="text"
                          value={logoUrl}
                          onChange={(e) => setLogoUrl(e.target.value)}
                          placeholder="https://... (laisser vide pour le badge texte HUIZE SHOP)"
                          className="w-full p-2.5 rounded-lg border border-[#E1E3DA] text-xs focus:outline-[#1F5A40] bg-[#FAF9F5]"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* 1. HERO BANNER PHOTO */}
                <div className="bg-white border border-[#E1E3DA] rounded-2xl p-6 shadow-xs">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#E1E3DA] pb-3 mb-5">
                    <div>
                      <h3 className="text-base font-bold font-title text-[#123B2A] flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-[#D8F36A]" />
                        <span>
                          1. Photos du Hero ({heroImages.length} photo{heroImages.length > 1 ? 's' : ''}) &amp; Textes d&apos;Accueil
                        </span>
                      </h3>
                      <p className="text-xs text-[#6B726C]">
                        Ajoutez plusieurs photos dans l&apos;entête Hero : elles défileront automatiquement toutes les 5 secondes.
                      </p>
                    </div>
                    <span className="text-xs bg-[#FAF9F5] border border-[#E1E3DA] text-[#123B2A] font-semibold px-2.5 py-1 rounded-full">
                      Défilement auto : 5 sec
                    </span>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                    {/* Hero Preview & Multi-File Uploader */}
                    <div className="lg:col-span-5 flex flex-col gap-3">
                      <div className="relative rounded-xl overflow-hidden border border-[#E1E3DA] aspect-4/5 bg-[#123B2A] shadow-md group">
                        <img
                          src={heroImages[selectedHeroIdx] || heroImages[0] || heroImg}
                          alt="Aperçu Hero"
                          className="w-full h-full object-cover object-top"
                        />
                        {heroImages.length > 1 && (
                          <span className="absolute top-2.5 left-2.5 bg-black/65 text-[#D8F36A] text-[11px] font-bold px-2.5 py-1 rounded-full">
                            Photo {selectedHeroIdx + 1} / {heroImages.length}
                          </span>
                        )}
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center gap-2 transition-opacity p-4 text-center">
                          <label className="px-4 py-2 rounded-full bg-white text-[#123B2A] text-xs font-bold shadow-lg hover:bg-[#D8F36A] cursor-pointer">
                            <span>+ Ajouter des photos</span>
                            <input
                              type="file"
                              accept="image/*"
                              multiple
                              onChange={(e) => handleHeroFileUpload(e.target.files)}
                              className="hidden"
                            />
                          </label>
                          <p className="text-[11px] text-white">Vous pouvez sélectionner plusieurs photos à la fois</p>
                        </div>
                      </div>

                      {/* Hero Images Thumbnail Strip */}
                      <div className="bg-[#FAF9F5] border border-[#E1E3DA] rounded-xl p-3 space-y-2">
                        <div className="flex items-center justify-between text-[11px] font-bold text-[#123B2A]">
                          <span>Images du Hero ({heroImages.length})</span>
                          <span className="text-[#6B726C] font-normal">Ordre de défilement</span>
                        </div>
                        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                          {heroImages.map((imgUrl, idx) => (
                            <div
                              key={`${idx}-${imgUrl.slice(0, 24)}`}
                              className={`relative rounded-lg overflow-hidden border-2 bg-white aspect-square cursor-pointer group ${
                                selectedHeroIdx === idx ? 'border-[#123B2A] ring-2 ring-[#D8F36A]' : 'border-[#E1E3DA]'
                              }`}
                              onClick={() => setSelectedHeroIdx(idx)}
                            >
                              <img
                                src={imgUrl}
                                alt={`Hero ${idx + 1}`}
                                className="w-full h-full object-cover"
                              />
                              <span className="absolute top-1 left-1 bg-black/65 text-white text-[9px] font-bold px-1.5 py-0.5 rounded">
                                #{idx + 1}
                              </span>
                              {heroImages.length > 1 && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleRemoveHeroImage(idx);
                                  }}
                                  title="Supprimer cette photo"
                                  className="absolute top-1 right-1 w-5 h-5 rounded-full bg-red-600 text-white flex items-center justify-center shadow-xs hover:bg-red-700 cursor-pointer"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              )}
                              {heroImages.length > 1 && (
                                <div className="absolute bottom-1 inset-x-1 flex justify-between opacity-90 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                                  <button
                                    type="button"
                                    disabled={idx === 0}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleMoveHeroImage(idx, -1);
                                    }}
                                    title="Avancer"
                                    className="px-1 py-0.5 rounded bg-black/70 text-white text-[9px] disabled:opacity-30 cursor-pointer"
                                  >
                                    ◀
                                  </button>
                                  <button
                                    type="button"
                                    disabled={idx === heroImages.length - 1}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleMoveHeroImage(idx, 1);
                                    }}
                                    title="Reculer"
                                    className="px-1 py-0.5 rounded bg-black/70 text-white text-[9px] disabled:opacity-30 cursor-pointer"
                                  >
                                    ▶
                                  </button>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Multi-File Uploader Bar */}
                      <label className="w-full border-2 border-dashed border-[#1F5A40]/30 hover:border-[#1F5A40] rounded-xl p-3 bg-[#FAF9F5] text-center transition-colors cursor-pointer block">
                        <input
                          type="file"
                          accept="image/*"
                          multiple
                          onChange={(e) => handleHeroFileUpload(e.target.files)}
                          className="hidden"
                        />
                        <div className="flex items-center justify-center gap-2 text-xs font-bold text-[#123B2A]">
                          <Upload className="w-4 h-4 text-[#1F5A40]" />
                          <span>
                            {isUploadingHero
                              ? 'Compression des photos...'
                              : 'Ajouter une ou plusieurs photos Hero (Téléphone / PC)'}
                          </span>
                        </div>
                      </label>
                    </div>

                    {/* Hero Settings & Copy Fields */}
                    <div className="lg:col-span-7 flex flex-col gap-4 text-xs">
                      <div>
                        <label className="block font-bold text-[#123B2A] mb-1">
                          Ajouter une photo Hero par URL
                        </label>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={newHeroImageUrl}
                            onChange={(e) => setNewHeroImageUrl(e.target.value)}
                            placeholder="https://... ou chemin d'image à ajouter"
                            className="flex-1 p-2.5 rounded-lg border border-[#E1E3DA] text-xs focus:outline-[#1F5A40] bg-[#FAF9F5]"
                          />
                          <button
                            type="button"
                            onClick={() => handleAddHeroImageUrl()}
                            className="px-4 py-2 rounded-lg bg-[#123B2A] hover:bg-[#1F5A40] text-white text-xs font-bold cursor-pointer shrink-0"
                          >
                            + Ajouter
                          </button>
                        </div>
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          <span className="text-[11px] text-[#6B726C] self-center mr-1">Affiches &amp; modèles :</span>
                          <button
                            type="button"
                            onClick={() => handleAddHeroImageUrl(HERO_PROMO_DELIVERY_IMG)}
                            className={`px-2.5 py-0.5 rounded border text-[10px] font-bold transition-colors cursor-pointer ${
                              heroImages.includes(HERO_PROMO_DELIVERY_IMG)
                                ? 'border-[#123B2A] bg-[#D8F36A]/45 text-[#123B2A]'
                                : 'border-[#1F5A40]/40 bg-[#FAF9F5] text-[#123B2A] hover:bg-[#D8F36A]/30'
                            }`}
                          >
                            {heroImages.includes(HERO_PROMO_DELIVERY_IMG)
                              ? '✓ Pub Livraison Gratuite'
                              : '+ Pub Livraison Gratuite'}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleAddHeroImageUrl(HERO_PROMO_COD_IMG)}
                            className={`px-2.5 py-0.5 rounded border text-[10px] font-bold transition-colors cursor-pointer ${
                              heroImages.includes(HERO_PROMO_COD_IMG)
                                ? 'border-[#123B2A] bg-[#D8F36A]/45 text-[#123B2A]'
                                : 'border-[#1F5A40]/40 bg-[#FAF9F5] text-[#123B2A] hover:bg-[#D8F36A]/30'
                            }`}
                          >
                            {heroImages.includes(HERO_PROMO_COD_IMG)
                              ? '✓ Pub Paiement Après Livraison'
                              : '+ Pub Paiement Après Livraison'}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleAddHeroImageUrl('/src/assets/images/hero_fashion_burkina_1794167660891.jpg')}
                            className="px-2 py-0.5 rounded border border-[#E1E3DA] bg-white text-[10px] font-semibold text-[#123B2A] hover:bg-[#FAF9F5] cursor-pointer"
                          >
                            + Lookbook Burkina
                          </button>
                          <button
                            type="button"
                            onClick={() => handleAddHeroImageUrl('/src/assets/images/product_velocity_sneakers_1794167661807.jpg')}
                            className="px-2 py-0.5 rounded border border-[#E1E3DA] bg-white text-[10px] font-semibold text-[#123B2A] hover:bg-[#FAF9F5] cursor-pointer"
                          >
                            + Sneakers
                          </button>
                          <button
                            type="button"
                            onClick={() => handleAddHeroImageUrl('/src/assets/images/product_sahel_leather_sandals_1794167662030.jpg')}
                            className="px-2 py-0.5 rounded border border-[#E1E3DA] bg-white text-[10px] font-semibold text-[#123B2A] hover:bg-[#FAF9F5] cursor-pointer"
                          >
                            + Sandales Cuir
                          </button>
                          <button
                            type="button"
                            onClick={() => handleAddHeroImageUrl('/src/assets/images/product_streetwear_tshirt_1794167662293.jpg')}
                            className="px-2 py-0.5 rounded border border-[#E1E3DA] bg-white text-[10px] font-semibold text-[#123B2A] hover:bg-[#FAF9F5] cursor-pointer"
                          >
                            + T-shirt
                          </button>
                        </div>
                      </div>

                      <div>
                        <label className="block font-bold text-[#123B2A] mb-1">
                          Slogan / Badge Hero
                        </label>
                        <input
                          type="text"
                          value={heroTagline}
                          onChange={(e) => setHeroTagline(e.target.value)}
                          placeholder="Ton style, ta signature"
                          className="w-full p-2.5 rounded-lg border border-[#E1E3DA] text-xs focus:outline-[#1F5A40]"
                        />
                      </div>

                      <div>
                        <label className="block font-bold text-[#123B2A] mb-1">
                          Titre d'accueil
                        </label>
                        <input
                          type="text"
                          value={heroTitle}
                          onChange={(e) => setHeroTitle(e.target.value)}
                          placeholder="Affirme ton style avec HUIZE SHOP"
                          className="w-full p-2.5 rounded-lg border border-[#E1E3DA] text-xs focus:outline-[#1F5A40]"
                        />
                      </div>

                      <div>
                        <label className="block font-bold text-[#123B2A] mb-1">
                          Texte descriptif
                        </label>
                        <textarea
                          rows={3}
                          value={heroSubtitle}
                          onChange={(e) => setHeroSubtitle(e.target.value)}
                          className="w-full p-2.5 rounded-lg border border-[#E1E3DA] text-xs focus:outline-[#1F5A40]"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* 2. CAROUSEL BANNERS (PANNEAU PUBLICITAIRE DÉFILANT) */}
                <div className="bg-white border border-[#E1E3DA] rounded-2xl p-6 shadow-xs">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-b border-[#E1E3DA] pb-3 mb-5 gap-2">
                    <div>
                      <h3 className="text-base font-bold font-title text-[#123B2A] flex items-center gap-2">
                        <ImageIcon className="w-4 h-4 text-[#1F5A40]" />
                        <span>
                          2. Panneau publicitaire défilant ({carouselSlides.length} annonce{carouselSlides.length > 1 ? 's' : ''})
                        </span>
                      </h3>
                      <p className="text-xs text-[#6B726C]">
                        Ajoutez autant d&apos;annonces que vous souhaitez : elles défilent automatiquement horizontalement sur la page d&apos;accueil (et au glissement tactile sur mobile).
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={handleAddCarouselSlide}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-[#123B2A] hover:bg-[#1F5A40] text-white text-xs font-bold rounded-lg transition-colors cursor-pointer shrink-0"
                    >
                      <Plus className="w-3.5 h-3.5 text-[#D8F36A]" />
                      <span>Ajouter une annonce</span>
                    </button>
                  </div>

                  <div className="flex flex-col gap-6">
                    {carouselSlides.map((slide, idx) => (
                      <div
                        key={slide.id || idx}
                        className="p-5 rounded-2xl border border-[#E1E3DA] bg-[#FAF9F5] shadow-xs flex flex-col md:flex-row gap-5 items-start"
                      >
                        {/* Slide Image Preview & Upload */}
                        <div className="w-full md:w-56 shrink-0 flex flex-col gap-2">
                          <div className="relative rounded-xl overflow-hidden border border-[#E1E3DA] aspect-16/10 bg-[#17212E] group shadow-xs">
                            <img
                              src={slide.image}
                              alt={slide.title}
                              className="w-full h-full object-cover object-center brightness-90"
                            />
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                              <label className="px-3 py-1.5 rounded-full bg-white text-[#123B2A] text-[11px] font-bold shadow-md cursor-pointer hover:bg-[#D8F36A]">
                                <span>Changer photo</span>
                                <input
                                  type="file"
                                  accept="image/*"
                                  onChange={(e) => handleSlideFileUpload(idx, e.target.files)}
                                  className="hidden"
                                />
                              </label>
                            </div>
                          </div>

                          <label className="border border-dashed border-[#1F5A40]/40 rounded-lg p-2 text-center text-[11px] font-bold text-[#123B2A] hover:bg-white transition-colors cursor-pointer block">
                            <input
                              type="file"
                              accept="image/*"
                              onChange={(e) => handleSlideFileUpload(idx, e.target.files)}
                              className="hidden"
                            />
                            <div className="flex items-center justify-center gap-1.5">
                              <Upload className="w-3.5 h-3.5" />
                              <span>{uploadingSlideIdx === idx ? 'Chargement...' : 'Importer photo'}</span>
                            </div>
                          </label>

                          <input
                            type="text"
                            value={slide.image}
                            onChange={(e) => {
                              const val = e.target.value;
                              setCarouselSlides((prev) =>
                                prev.map((s, i) => (i === idx ? { ...s, image: val } : s))
                              );
                            }}
                            placeholder="URL d'image..."
                            className="w-full p-2 bg-white rounded border border-[#E1E3DA] text-[11px]"
                          />
                        </div>

                        {/* Slide Content Fields */}
                        <div className="flex-1 w-full grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                          <div className="sm:col-span-2 flex flex-wrap items-center justify-between gap-2 border-b border-[#E1E3DA] pb-2">
                            <span className="font-bold text-[#123B2A] text-xs">
                              Annonce publicitaire #{idx + 1}
                            </span>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                disabled={idx === 0}
                                onClick={() => handleMoveCarouselSlide(idx, -1)}
                                title="Monter cette annonce"
                                className="p-1.5 rounded-md bg-white border border-[#E1E3DA] text-[#123B2A] hover:bg-[#EFEFE6] disabled:opacity-35 cursor-pointer disabled:cursor-not-allowed"
                              >
                                <ArrowUp className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                disabled={idx === carouselSlides.length - 1}
                                onClick={() => handleMoveCarouselSlide(idx, 1)}
                                title="Descendre cette annonce"
                                className="p-1.5 rounded-md bg-white border border-[#E1E3DA] text-[#123B2A] hover:bg-[#EFEFE6] disabled:opacity-35 cursor-pointer disabled:cursor-not-allowed"
                              >
                                <ArrowDown className="w-3.5 h-3.5" />
                              </button>
                              {carouselSlides.length > 1 && (
                                <button
                                  type="button"
                                  onClick={() => handleDeleteCarouselSlide(idx)}
                                  className="text-red-600 hover:text-red-800 text-xs font-semibold flex items-center gap-1 cursor-pointer ml-1"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                  <span>Supprimer</span>
                                </button>
                              )}
                            </div>
                          </div>

                          <div>
                            <label className="block font-bold text-[#123B2A] mb-1">En-tête / Kicker</label>
                            <input
                              type="text"
                              value={slide.kicker}
                              onChange={(e) => {
                                const val = e.target.value;
                                setCarouselSlides((prev) =>
                                  prev.map((s, i) => (i === idx ? { ...s, kicker: val } : s))
                                );
                              }}
                              className="w-full p-2 bg-white rounded-lg border border-[#E1E3DA] text-xs"
                            />
                          </div>

                          <div>
                            <label className="block font-bold text-[#123B2A] mb-1">Titre de l'annonce / Offre</label>
                            <input
                              type="text"
                              value={slide.title}
                              onChange={(e) => {
                                const val = e.target.value;
                                setCarouselSlides((prev) =>
                                  prev.map((s, i) => (i === idx ? { ...s, title: val } : s))
                                );
                              }}
                              className="w-full p-2 bg-white rounded-lg border border-[#E1E3DA] text-xs font-bold text-[#123B2A]"
                            />
                          </div>

                          <div className="sm:col-span-2">
                            <label className="block font-bold text-[#123B2A] mb-1">Description courte</label>
                            <textarea
                              rows={2}
                              value={slide.desc}
                              onChange={(e) => {
                                const val = e.target.value;
                                setCarouselSlides((prev) =>
                                  prev.map((s, i) => (i === idx ? { ...s, desc: val } : s))
                                );
                              }}
                              className="w-full p-2 bg-white rounded-lg border border-[#E1E3DA] text-xs"
                            />
                          </div>

                          <div>
                            <label className="block font-bold text-[#123B2A] mb-1">Action au clic</label>
                            <select
                              value={slide.category}
                              onChange={(e) => {
                                const val = e.target.value;
                                setCarouselSlides((prev) =>
                                  prev.map((s, i) => (i === idx ? { ...s, category: val } : s))
                                );
                              }}
                              className="w-full p-2 bg-white rounded-lg border border-[#E1E3DA] text-xs"
                            >
                              <option value="all">Toute la boutique</option>
                              <option value="whatsapp">💬 Ouvrir WhatsApp (offre directe)</option>
                              {categories.map((c) => (
                                <option key={c.id} value={c.slug}>
                                  {c.icon} {c.name}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div>
                            <label className="block font-bold text-[#123B2A] mb-1">Texte du bouton</label>
                            <input
                              type="text"
                              value={slide.ctaText}
                              onChange={(e) => {
                                const val = e.target.value;
                                setCarouselSlides((prev) =>
                                  prev.map((s, i) => (i === idx ? { ...s, ctaText: val } : s))
                                );
                              }}
                              className="w-full p-2 bg-white rounded-lg border border-[#E1E3DA] text-xs"
                            />
                          </div>

                          {slide.category === 'whatsapp' && (
                            <div className="sm:col-span-2">
                              <label className="block font-bold text-[#123B2A] mb-1">
                                Message WhatsApp pré-rempli (optionnel)
                              </label>
                              <input
                                type="text"
                                value={slide.whatsappMessage || ''}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setCarouselSlides((prev) =>
                                    prev.map((s, i) => (i === idx ? { ...s, whatsappMessage: val } : s))
                                  );
                                }}
                                placeholder={`Bonjour HUIZE SHOP, je suis intéressé(e) par l'annonce "${slide.title}".`}
                                className="w-full p-2 bg-white rounded-lg border border-[#E1E3DA] text-xs"
                              />
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Save & Add button at bottom of carousel section */}
                  <div className="mt-6 pt-4 border-t border-[#E1E3DA] flex flex-wrap items-center justify-between gap-3">
                    <button
                      type="button"
                      onClick={handleAddCarouselSlide}
                      className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-[#FAF9F5] hover:bg-[#EFEFE6] border border-[#E1E3DA] text-[#123B2A] text-xs font-bold rounded-full transition-colors cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Ajouter une autre annonce</span>
                    </button>

                    <button
                      onClick={handleSaveMediaConfig}
                      disabled={isSavingMedia}
                      className="inline-flex items-center gap-2 px-8 py-3 rounded-full bg-[#123B2A] hover:bg-[#1F5A40] text-white text-xs sm:text-sm font-bold shadow-md transition-all active:scale-95 cursor-pointer disabled:opacity-50"
                    >
                      <Save className="w-4 h-4 text-[#D8F36A]" />
                      <span>
                        {isSavingMedia
                          ? 'Enregistrement en cours...'
                          : `💾 Publier les annonces (${carouselSlides.length})`}
                      </span>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* MODAL: AJOUTER / MODIFIER UN PRODUIT */}
      {isModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-[#123B2A]/65 backdrop-blur-xs overflow-y-auto"
          onClick={() => setIsModalOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-[#E1E3DA] overflow-hidden my-auto animate-fade-in"
          >
            {/* Modal Header */}
            <div className="p-4 sm:p-5 bg-[#FAF9F5] border-b border-[#E1E3DA] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-8 h-8 rounded-lg bg-[#123B2A] text-[#D8F36A] flex items-center justify-center text-sm font-bold">
                  ✨
                </span>
                <div>
                  <h3 className="font-bold font-title text-lg text-[#123B2A]">
                    {editingProduct ? 'Modifier le produit' : 'Ajouter un nouveau produit'}
                  </h3>
                  <p className="text-xs text-[#6B726C]">Publication instantanée sur la boutique et WhatsApp</p>
                </div>
              </div>

              <button
                onClick={() => setIsModalOpen(false)}
                className="w-8 h-8 rounded-full bg-white border border-[#E1E3DA] flex items-center justify-center text-[#6B726C] hover:text-[#123B2A]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Form Body */}
            <form onSubmit={handleSaveProduct} className="p-5 sm:p-6 flex flex-col gap-4 text-xs sm:text-sm max-h-[75vh] overflow-y-auto">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-[#123B2A] mb-1">Nom de l'article *</label>
                  <input
                    type="text"
                    required
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="Ex: Sneaker High Ouaga 2025"
                    className="w-full p-2.5 rounded-lg border border-[#E1E3DA] text-xs focus:outline-[#1F5A40]"
                  />
                </div>

                <div>
                  <label className="block font-bold text-[#123B2A] mb-1">Catégorie *</label>
                  <select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value)}
                    className="w-full p-2.5 rounded-lg border border-[#E1E3DA] text-xs focus:outline-[#1F5A40] bg-white"
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.slug}>
                        {c.icon} {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold text-[#123B2A] mb-1">Prix de vente (F CFA) *</label>
                  <input
                    type="number"
                    required
                    value={formPrice}
                    onChange={(e) => setFormPrice(e.target.value)}
                    className="w-full p-2.5 rounded-lg border border-[#E1E3DA] font-bold text-[#123B2A] text-xs focus:outline-[#1F5A40]"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-[#6B726C] mb-1">Prix barré</label>
                  <input
                    type="number"
                    value={formOldPrice}
                    onChange={(e) => setFormOldPrice(e.target.value)}
                    placeholder="Optionnel"
                    className="w-full p-2.5 rounded-lg border border-[#E1E3DA] text-xs focus:outline-[#1F5A40]"
                  />
                </div>

                <div>
                  <label className="block font-bold text-[#123B2A] mb-1">Badge</label>
                  <select
                    value={formBadge}
                    onChange={(e) => setFormBadge(e.target.value)}
                    className="w-full p-2.5 rounded-lg border border-[#E1E3DA] text-xs focus:outline-[#1F5A40] bg-white"
                  >
                    <option value="Nouveau">✨ Nouveau</option>
                    <option value="Promo">🔥 Promo Flash</option>
                    <option value="Top Vente">⭐ Top Vente</option>
                    <option value="Stock limité">📦 Stock limité</option>
                    <option value="Artisanal">🌿 Artisanal</option>
                    <option value="">Aucun</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-[#123B2A] mb-1">Pointures / Tailles disponibles *</label>
                  <input
                    type="text"
                    value={formSizes}
                    onChange={(e) => setFormSizes(e.target.value)}
                    placeholder="Ex: 39, 40, 41, 42, 43 ou M, L, XL"
                    className="w-full p-2.5 rounded-lg border border-[#E1E3DA] text-xs focus:outline-[#1F5A40]"
                  />
                </div>

                <div>
                  <label className="block font-bold text-[#123B2A] mb-1">Quantité en stock *</label>
                  <input
                    type="number"
                    value={formStock}
                    onChange={(e) => setFormStock(e.target.value)}
                    className="w-full p-2.5 rounded-lg border border-[#E1E3DA] text-xs focus:outline-[#1F5A40]"
                  />
                </div>
              </div>

              {/* Photos Management */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block font-bold text-[#123B2A] text-xs">
                    Photos du produit (Stockage base de données Firestore)
                  </label>
                  <span className="text-[11px] text-[#6B726C]">
                    {formImages.length} photo{formImages.length > 1 ? 's' : ''}
                  </span>
                </div>

                {/* Upload Zone */}
                <div className="border-2 border-dashed border-[#1F5A40]/30 hover:border-[#1F5A40] rounded-xl p-4 bg-[#FAF9F5] text-center transition-colors relative mb-3">
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={(e) => handleFileUpload(e.target.files)}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                  <div className="flex flex-col items-center justify-center gap-1.5 pointer-events-none">
                    <div className="w-10 h-10 rounded-full bg-[#123B2A]/10 flex items-center justify-center text-[#123B2A]">
                      <Upload className="w-5 h-5" />
                    </div>
                    <p className="text-xs font-bold text-[#123B2A]">
                      {isUploadingImage ? 'Compression et chargement...' : 'Glisser ou cliquer pour importer des photos'}
                    </p>
                    <p className="text-[11px] text-[#6B726C]">
                      PNG, JPG, WEBP jusqu'à 10 Mo • Compressé automatiquement pour Firestore
                    </p>
                  </div>
                </div>

                {/* Thumbnail Gallery */}
                {formImages.length > 0 && (
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 mb-3">
                    {formImages.map((imgUrl, idx) => (
                      <div
                        key={idx}
                        className={`relative group rounded-lg overflow-hidden border ${
                          idx === 0 ? 'border-2 border-[#123B2A] ring-2 ring-[#D8F36A]/50' : 'border-[#E1E3DA]'
                        } bg-white aspect-square`}
                      >
                        <img
                          src={imgUrl}
                          alt={`Aperçu ${idx + 1}`}
                          className="w-full h-full object-cover"
                        />
                        {idx === 0 && (
                          <span className="absolute top-1 left-1 bg-[#123B2A] text-[#D8F36A] text-[9px] font-extrabold px-1.5 py-0.5 rounded shadow-xs">
                            Principale
                          </span>
                        )}
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center gap-1 transition-opacity p-1">
                          {idx !== 0 && (
                            <button
                              type="button"
                              onClick={() => {
                                const newImgs = [...formImages];
                                const [chosen] = newImgs.splice(idx, 1);
                                setFormImages([chosen, ...newImgs]);
                              }}
                              className="text-[10px] bg-white text-[#123B2A] font-bold px-2 py-0.5 rounded shadow-sm hover:bg-[#D8F36A]"
                            >
                              Définir principale
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => {
                              setFormImages(formImages.filter((_, i) => i !== idx));
                            }}
                            className="text-[10px] bg-red-600 text-white font-bold p-1 rounded-full shadow-sm hover:bg-red-700"
                            title="Supprimer la photo"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Add Photo by Web Link (URL) */}
                <div className="bg-[#FAF9F5] p-3 rounded-xl border border-[#E1E3DA] mb-3">
                  <label className="block font-bold text-[#123B2A] text-xs mb-1">
                    🔗 Ajouter une photo par lien web (URL)
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="url"
                      value={manualImageUrl}
                      onChange={(e) => setManualImageUrl(e.target.value)}
                      placeholder="https://... Coller l'adresse d'une image (ex: un lien direct jpg, png ou webp)"
                      className="flex-1 p-2 bg-white rounded-lg border border-[#E1E3DA] text-xs focus:outline-[#1F5A40]"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const trimmed = manualImageUrl.trim();
                        if (trimmed) {
                          setFormImages((prev) => [...prev, trimmed]);
                          setManualImageUrl('');
                        }
                      }}
                      className="px-3.5 py-2 bg-[#123B2A] hover:bg-[#1F5A40] text-[#D8F36A] font-bold rounded-lg text-xs transition-colors shrink-0 cursor-pointer"
                    >
                      + Ajouter le lien
                    </button>
                  </div>
                  <p className="text-[10px] text-[#6B726C] mt-1">
                    Astuce : vous pouvez coller n'importe quel lien d'image web, ou utiliser le bouton d'importation au-dessus pour importer depuis votre téléphone ou PC.
                  </p>
                </div>

                {/* Quick Samples */}
                <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-[#E1E3DA]">
                  <span className="text-[11px] font-medium text-[#6B726C]">Modèles prédéfinis :</span>
                  <button
                    type="button"
                    onClick={() => setFormImages((prev) => [...prev, '/src/assets/images/product_velocity_sneakers_1794167661807.jpg'])}
                    className="text-[10px] bg-white hover:bg-[#FAF9F5] px-2 py-0.5 rounded border border-[#E1E3DA] text-[#123B2A] font-medium cursor-pointer"
                  >
                    + Sneaker
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormImages((prev) => [...prev, '/src/assets/images/product_sahel_leather_sandals_1794167662030.jpg'])}
                    className="text-[10px] bg-white hover:bg-[#FAF9F5] px-2 py-0.5 rounded border border-[#E1E3DA] text-[#123B2A] font-medium cursor-pointer"
                  >
                    + Sandale
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormImages((prev) => [...prev, '/src/assets/images/product_streetwear_tshirt_1794167662293.jpg'])}
                    className="text-[10px] bg-white hover:bg-[#FAF9F5] px-2 py-0.5 rounded border border-[#E1E3DA] text-[#123B2A] font-medium cursor-pointer"
                  >
                    + T-shirt
                  </button>
                </div>
              </div>

              {/* AI Vision Autofill Banner & Trigger */}
              <div className="bg-gradient-to-r from-[#123B2A] via-[#1A4D38] to-[#123B2A] text-white p-4 rounded-xl border border-[#D8F36A]/40 shadow-md">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-[#D8F36A] text-[#123B2A] flex items-center justify-center shrink-0 shadow-sm">
                      <Sparkles className="w-5 h-5 fill-current text-[#123B2A]" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs sm:text-sm font-bold text-white">
                          Remplissage automatique par IA
                        </span>
                        <span className="bg-[#D8F36A] text-[#123B2A] text-[9px] font-extrabold px-1.5 py-0.5 rounded-full uppercase tracking-wider">
                          Gemini Vision
                        </span>
                      </div>
                      <p className="text-[11px] text-white/80 mt-0.5">
                        L'IA analyse votre photo, identifie le modèle et remplit le nom, la catégorie, le prix marché en F CFA et la description.
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleAnalyzeWithAi}
                    disabled={isAnalyzingAi}
                    className="w-full sm:w-auto px-5 py-2.5 rounded-lg bg-[#D8F36A] hover:bg-[#c6ea40] active:scale-95 text-[#123B2A] font-bold text-xs flex items-center justify-center gap-2 shadow-sm transition-all shrink-0 cursor-pointer disabled:opacity-50"
                  >
                    {isAnalyzingAi ? (
                      <>
                        <span className="w-3.5 h-3.5 border-2 border-[#123B2A] border-t-transparent rounded-full animate-spin" />
                        <span>Analyse de l'image en cours...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4 text-[#123B2A]" />
                        <span>🪄 Remplir avec l'IA via la photo</span>
                      </>
                    )}
                  </button>
                </div>

                {/* AI Success Feedback */}
                {aiSuccessMessage && (
                  <div className="mt-3 p-2.5 bg-[#E8F7EE] border border-[#A2E2B8] text-[#123B2A] rounded-lg text-xs flex items-center gap-2 animate-fade-in font-medium">
                    <Check className="w-4 h-4 text-[#1F5A40] shrink-0" />
                    <span>{aiSuccessMessage}</span>
                  </div>
                )}

                {/* AI Error Feedback */}
                {aiAnalysisError && (
                  <div className="mt-3 p-2.5 bg-red-50 border border-red-200 text-red-800 rounded-lg text-xs flex items-center gap-2 animate-fade-in">
                    <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                    <span>{aiAnalysisError}</span>
                  </div>
                )}
              </div>

              <div>
                <label className="block font-bold text-[#123B2A] mb-1">Description</label>
                <textarea
                  rows={2}
                  value={formDesc}
                  onChange={(e) => setFormDesc(e.target.value)}
                  placeholder="Détails, matière, confort..."
                  className="w-full p-2.5 rounded-lg border border-[#E1E3DA] text-xs focus:outline-[#1F5A40]"
                />
              </div>

              <label className="flex items-center justify-between gap-3 p-3 rounded-xl border border-[#E1E3DA] bg-[#FAF9F5] cursor-pointer">
                <div>
                  <p className="font-bold text-xs text-[#123B2A]">
                    Afficher dans « Nos produits phares » (page d&apos;accueil)
                  </p>
                  <p className="text-[11px] text-[#6B726C]">
                    Cochez pour mettre ce produit en avant sur l&apos;accueil. Il reste toujours visible dans la boutique complète.
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={formFeatured}
                  onChange={(e) => setFormFeatured(e.target.checked)}
                  className="w-4 h-4 accent-[#123B2A] rounded cursor-pointer shrink-0"
                />
              </label>

              {/* WhatsApp auto-broadcast notice */}
              <div className="bg-[#E8F7EE] p-3 rounded-xl border border-[#A2E2B8] flex items-center gap-2 text-xs text-[#123B2A]">
                <Check className="w-4 h-4 text-[#1F5A40] shrink-0" />
                <span>
                  <strong>Synchronisation WhatsApp active :</strong> Le produit sera immédiatement commandable avec son lien direct WhatsApp lié au {WHATSAPP_DISPLAY}.
                </span>
              </div>

              {/* Modal Actions */}
              <div className="pt-3 border-t border-[#E1E3DA] flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-full border border-[#E1E3DA] text-xs font-semibold hover:bg-[#FAF9F5]"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 rounded-full bg-[#123B2A] hover:bg-[#1F5A40] text-white text-xs font-bold shadow-md cursor-pointer"
                >
                  {editingProduct ? 'Sauvegarder les modifications' : '✨ Enregistrer & publier en boutique'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* QUICK PRICE ADJUST MODAL */}
      {adjustingPriceProduct && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#123B2A]/60 backdrop-blur-xs"
        >
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl border border-[#E1E3DA] animate-fade-in">
            <h3 className="font-bold text-base text-[#123B2A] mb-1">Ajuster le prix de vente</h3>
            <p className="text-xs text-[#6B726C] mb-4">{adjustingPriceProduct.name}</p>

            <div className="mb-4">
              <label className="block text-xs font-bold text-[#123B2A] mb-1">Nouveau prix (F CFA)</label>
              <input
                type="number"
                value={newAdjustedPrice}
                onChange={(e) => setNewAdjustedPrice(e.target.value)}
                className="w-full p-2.5 rounded-lg border border-[#E1E3DA] font-bold text-sm focus:outline-[#1F5A40]"
                autoFocus
              />
            </div>

            <div className="flex justify-end gap-2 text-xs">
              <button
                type="button"
                onClick={() => setAdjustingPriceProduct(null)}
                className="px-4 py-2 rounded-lg border border-[#E1E3DA] font-semibold"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleSavePriceAdjustment}
                className="px-4 py-2 rounded-lg bg-[#123B2A] text-white font-bold"
              >
                Confirmer le prix
              </button>
            </div>
          </div>
        </div>
      )}
      {/* QUICK ORDER ITEMS PHOTO PREVIEW MODAL */}
      {previewOrder && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setPreviewOrder(null)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#123B2A]/60 backdrop-blur-xs"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl p-5 sm:p-6 max-w-md w-full shadow-2xl border border-[#E1E3DA] max-h-[85vh] overflow-y-auto animate-fade-in"
          >
            <div className="flex items-center justify-between border-b border-[#E1E3DA] pb-3 mb-4">
              <div>
                <h3 className="font-bold text-base text-[#123B2A] font-title">
                  Commande {previewOrder.id}
                </h3>
                <p className="text-xs text-[#6B726C]">
                  {previewOrder.customerName} • {formatFCFA(previewOrder.total)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPreviewOrder(null)}
                aria-label="Fermer"
                className="w-8 h-8 rounded-full bg-[#FAF9F5] border border-[#E1E3DA] flex items-center justify-center text-[#123B2A] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex flex-col gap-3">
              {(previewOrder.items && previewOrder.items.length > 0
                ? previewOrder.items.map((item) => {
                    const liveProd = products.find((p) => p.id === item.productId);
                    return {
                      name: item.name,
                      ref: item.ref || liveProd?.ref,
                      size: item.size,
                      quantity: item.quantity,
                      price: item.price,
                      image:
                        liveProd?.images?.[0] ||
                        item.image ||
                        `/api/products/${encodeURIComponent(item.productId)}/image.jpg`
                    };
                  })
                : products
                    .filter((p) => {
                      const lowerSummary = previewOrder.itemsSummary.toLowerCase();
                      return (
                        lowerSummary.includes(p.name.toLowerCase()) ||
                        (p.ref && lowerSummary.includes(p.ref.toLowerCase()))
                      );
                    })
                    .map((p) => ({
                      name: p.name,
                      ref: p.ref,
                      size: undefined,
                      quantity: 1,
                      price: p.price,
                      image: p.images[0] || `/api/products/${encodeURIComponent(p.id)}/image.jpg`
                    }))
              ).map((item, idx) => (
                <div
                  key={idx}
                  className="p-3 rounded-xl border border-[#E1E3DA] bg-[#FAF9F5] flex items-center gap-3"
                >
                  <img
                    src={item.image}
                    alt={item.name}
                    className="w-20 h-20 rounded-xl object-cover bg-white border border-[#E1E3DA] shrink-0"
                  />
                  <div className="min-w-0 flex-1 text-xs">
                    {item.ref && (
                      <p className="text-[10px] font-bold text-[#1F5A40] uppercase">Réf : {item.ref}</p>
                    )}
                    <p className="font-bold text-sm text-[#123B2A]">{item.name}</p>
                    <p className="text-[#6B726C] mt-0.5">
                      Qté : {item.quantity}
                      {item.size ? ` • Taille : ${item.size}` : ''}
                    </p>
                    <p className="font-bold text-[#123B2A] mt-0.5 tabular-nums">
                      {formatFCFA(item.price)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Live Customer Message / Order Floating Alert */}
      {liveChatAlert && (
        <div className="fixed bottom-4 right-4 z-50 max-w-sm bg-[#123B2A] text-white p-3.5 rounded-2xl shadow-2xl border border-[#D8F36A] flex items-start gap-3">
          <BellRing className="w-5 h-5 text-[#D8F36A] shrink-0 mt-0.5" />
          <div className="min-w-0 flex-1 text-xs">
            <p className="font-bold text-[#D8F36A] truncate">{liveChatAlert.title}</p>
            <p className="text-white/90 line-clamp-2 mt-0.5">{liveChatAlert.body}</p>
            <div className="flex items-center gap-2 mt-2">
              <button
                type="button"
                onClick={() => {
                  const id = liveChatAlert.threadId;
                  setLiveChatAlert(null);
                  setActiveSection('messagerie');
                  void handleSelectChatThread(id);
                }}
                className="px-3 py-1 rounded-lg bg-[#D8F36A] text-[#123B2A] font-bold text-[11px] cursor-pointer"
              >
                Répondre
              </button>
              <button
                type="button"
                onClick={() => setLiveChatAlert(null)}
                className="px-2 py-1 text-white/70 hover:text-white text-[11px] cursor-pointer"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
