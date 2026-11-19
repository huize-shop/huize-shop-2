import React, { useState, useEffect } from 'react';
import {
  Product,
  CartItem,
  Category,
  WhatsAppOrder,
  ClientLead,
  SiteMediaConfig,
  TeamMember,
  OrderItemSnapshot
} from './types.ts';
import {
  getBootstrapCatalog,
  INITIAL_PRODUCTS,
  saveStoredProducts,
  saveStoredCategories,
  saveStoredMediaConfig
} from './data/initialData.ts';
import {
  fetchCatalogFromServer,
  syncServerCatalog,
  fetchOrdersOnce,
  fetchLeadsOnce,
  fetchTeamMembersOnce,
  saveProductToDb,
  deleteProductFromDb,
  saveCategoryToDb,
  deleteCategoryFromDb,
  saveOrderToDb,
  deleteOrderFromDb,
  updateOrderStatusInDb,
  updateOrderReferralInDb,
  saveLeadToDb,
  deleteLeadFromDb,
  saveTeamMemberToDb,
  deleteTeamMemberFromDb,
  trackTeamClickOnServer,
  syncTeamServerCache,
  saveMediaConfigToDb,
  incrementProductLikesInDb,
  trackStoreVisitOnServer,
  trackOrderEventOnServer
} from './firebase.ts';
import { Navbar } from './components/Navbar.tsx';
import { Hero } from './components/Hero.tsx';
import { AdCarousel } from './components/AdCarousel.tsx';
import { CategoryShowcase } from './components/CategoryShowcase.tsx';
import { ProductCard } from './components/ProductCard.tsx';
import { ProductDetailModal } from './components/ProductDetailModal.tsx';
import { ShareModal } from './components/ShareModal.tsx';
import { CartView } from './components/CartView.tsx';
import { ContactView } from './components/ContactView.tsx';
import { AboutView } from './components/AboutView.tsx';
import { TeamPortalView, TeamPortalSession } from './components/TeamPortalView.tsx';
import { AdminDashboard } from './components/AdminDashboard.tsx';
import { AdminAuthModal } from './components/AdminAuthModal.tsx';
import { OrderChatWidget, OrderDraftContext } from './components/OrderChatWidget.tsx';
import { getStoredTokenForOrder } from './utils/chatClient.ts';
import { Reassurance } from './components/Reassurance.tsx';
import { PaymentDelivery } from './components/PaymentDelivery.tsx';
import { CustomerReviewsSection } from './components/CustomerReviewsSection.tsx';
import { Footer } from './components/Footer.tsx';
import { OfflineIndicator } from './components/OfflineIndicator.tsx';
import { Search, ArrowRight, Check, Heart, X } from 'lucide-react';
import {
  WHATSAPP_DISPLAY,
  getBoutiqueShareUrl,
  getCompactProductThumbnail,
  formatFCFA,
  getStoredReferralCode,
  saveStoredReferralCode,
  normalizeReferralCode
} from './utils/whatsapp.ts';

export default function App() {
  // Navigation & View state
  const [activeTab, setActiveTab] = useState<string>('accueil');
  const [isAdminMode, setIsAdminMode] = useState<boolean>(false);
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState<boolean>(() => {
    try {
      return sessionStorage.getItem('huize_admin_auth') === 'true';
    } catch {
      return false;
    }
  });
  const [isAdminAuthModalOpen, setIsAdminAuthModalOpen] = useState<boolean>(false);

  // Products & Categories persistent state (bootstrapped synchronously from server HTML or compact v2 cache)
  const [bootstrapSnapshot] = useState(getBootstrapCatalog);
  const [products, setProducts] = useState<Product[]>(bootstrapSnapshot.products);
  const [categories, setCategories] = useState<Category[]>(bootstrapSnapshot.categories);
  const [orders, setOrders] = useState<WhatsAppOrder[]>([]);
  const [leads, setLeads] = useState<ClientLead[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [mediaConfig, setMediaConfig] = useState<SiteMediaConfig>(bootstrapSnapshot.mediaConfig);
  const [isCatalogLoading, setIsCatalogLoading] = useState<boolean>(() => !bootstrapSnapshot.ready);
  const [isAdminCatalogReady, setIsAdminCatalogReady] = useState<boolean>(false);

  // Team sharing & referral tracking state
  const [activeReferralCode, setActiveReferralCode] = useState<string>(() => getStoredReferralCode());
  const [teamSession, setTeamSession] = useState<TeamPortalSession | null>(() => {
    try {
      const saved = sessionStorage.getItem('huize_team_session_v1');
      return saved ? (JSON.parse(saved) as TeamPortalSession) : null;
    } catch {
      return null;
    }
  });
  const [memberShareCode, setMemberShareCode] = useState<string>(() => {
    try {
      return normalizeReferralCode(localStorage.getItem('huize_member_share_code_v1'));
    } catch {
      return '';
    }
  });

  // Cart state
  const [cart, setCart] = useState<CartItem[]>(() => {
    try {
      const stored = localStorage.getItem('huize_shop_cart_v1');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  // Likes / Coups de cœur state (persisted locally)
  const [likedProductIds, setLikedProductIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('huize_liked_products_v1');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Modal State
  const [modalProduct, setModalProduct] = useState<Product | null>(null);
  const [shareModalProduct, setShareModalProduct] = useState<Product | null>(null);
  const [orderPreviewProducts, setOrderPreviewProducts] = useState<Product[] | null>(null);

  // In-Site Real-Time Order Messaging State
  const [isChatOpen, setIsChatOpen] = useState<boolean>(false);
  const [chatDraftOrder, setChatDraftOrder] = useState<OrderDraftContext | null>(null);
  const [chatOpenTarget, setChatOpenTarget] = useState<{
    orderId: string;
    accessToken: string;
  } | null>(null);

  // Shop Catalogue Filters
  const [shopCategoryFilter, setShopCategoryFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sortOption, setSortOption] = useState<string>('default');

  // Quick notification toast
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3000);
  };

  // Toggle Like handler with optimistic UI and Firestore counter sync
  const handleToggleLike = (productId: string) => {
    const isAlreadyLiked = likedProductIds.includes(productId);
    const updated = isAlreadyLiked
      ? likedProductIds.filter((id) => id !== productId)
      : [...likedProductIds, productId];

    setLikedProductIds(updated);
    try {
      localStorage.setItem('huize_liked_products_v1', JSON.stringify(updated));
    } catch (e) {
      console.error(e);
    }

    setProducts((prev) =>
      prev.map((p) => {
        if (p.id === productId) {
          const currentLikes = p.likes || 0;
          return {
            ...p,
            likes: Math.max(0, currentLikes + (isAlreadyLiked ? -1 : 1))
          };
        }
        return p;
      })
    );

    incrementProductLikesInDb(productId, isAlreadyLiked ? -1 : 1);
    syncServerCatalog({
      likedProductId: productId,
      likeDelta: isAlreadyLiked ? -1 : 1
    });

    showToast(
      isAlreadyLiked
        ? 'Article retiré de vos coups de cœur'
        : 'Ajouté à vos coups de cœur ❤️'
    );
  };

  // Sync latest shared catalog from lightweight server cache (~15 KB, 0 per-visitor Firestore reads)
  useEffect(() => {
    let cancelled = false;
    fetchCatalogFromServer(false)
      .then((cached) => {
        if (cancelled) return;
        if (cached) {
          if (cached.products && cached.products.length > 0) {
            setProducts(cached.products);
          } else {
            setProducts((prev) => (prev.length > 0 ? prev : INITIAL_PRODUCTS));
          }
          if (cached.categories && cached.categories.length > 0) {
            setCategories(cached.categories);
          }
          if (cached.mediaConfig) {
            setMediaConfig(cached.mediaConfig);
          }
        } else {
          setProducts((prev) => (prev.length > 0 ? prev : INITIAL_PRODUCTS));
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsCatalogLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Capture ?ref=CODE and ?equipe=1 deep-links on first load
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const refParam = params.get('ref');
      if (refParam) {
        const cleanRef = saveStoredReferralCode(refParam);
        if (cleanRef) {
          setActiveReferralCode(cleanRef);
          const ownCode = normalizeReferralCode(teamSession?.code || memberShareCode);
          const sessionKey = `huize_tracked_ref_${cleanRef}`;
          if (cleanRef !== ownCode && !sessionStorage.getItem(sessionKey)) {
            sessionStorage.setItem(sessionKey, '1');
            trackTeamClickOnServer(cleanRef);
          }
        }
      }
      if (params.get('equipe') === '1' || window.location.hash === '#equipe') {
        setActiveTab('equipe');
      }
      const suiviOrderId = params.get('suivi');
      const suiviCle =
        params.get('cle') || (suiviOrderId ? getStoredTokenForOrder(suiviOrderId) : null);
      if (suiviOrderId && suiviCle) {
        setChatOpenTarget({ orderId: suiviOrderId, accessToken: suiviCle });
        setIsChatOpen(true);
      }

      const isAdminEntry =
        window.location.hash === '#admin' || Boolean(params.get('admin'));
      void trackStoreVisitOnServer(isAdminEntry);
    } catch (err) {
      console.warn('Referral query parsing skipped:', err);
    }
  }, []);

  // Load private admin collections & full raw catalog (with inline data URLs for editing) ONLY when authenticated as admin
  useEffect(() => {
    if (!isAdminAuthenticated) {
      setIsAdminCatalogReady(false);
      return;
    }
    let cancelled = false;

    Promise.all([
      fetchCatalogFromServer(true),
      fetchOrdersOnce(),
      fetchLeadsOnce(),
      fetchTeamMembersOnce()
    ]).then(([fullCatalog, ordersData, leadsData, teamData]) => {
      if (cancelled) return;
      if (fullCatalog) {
        if (fullCatalog.products && fullCatalog.products.length > 0) {
          setProducts(fullCatalog.products);
        }
        if (fullCatalog.categories && fullCatalog.categories.length > 0) {
          setCategories(fullCatalog.categories);
        }
        if (fullCatalog.mediaConfig) {
          setMediaConfig(fullCatalog.mediaConfig);
        }
      }
      if (ordersData) {
        setOrders(ordersData);
      }
      if (leadsData) {
        setLeads(leadsData);
      }
      if (teamData) {
        setTeamMembers(teamData);
      }
      setIsAdminCatalogReady(true);
    });

    return () => {
      cancelled = true;
    };
  }, [isAdminAuthenticated]);

  // Fallback cache products to localStorage once catalog is loaded
  useEffect(() => {
    if (!isCatalogLoading && products.length > 0) {
      saveStoredProducts(products);
    }
  }, [products, isCatalogLoading]);

  // Deep-linking: auto-open product modal (?produit=ID) or multi-item order preview (?commande=id1,id2,...)
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const targetId = params.get('produit') || params.get('product');
      const targetCommande = params.get('commande');
      if (targetId && products.length > 0) {
        const found = products.find(
          (p) => p.id === targetId || p.ref.toLowerCase() === targetId.toLowerCase()
        );
        if (found) {
          setModalProduct(found);
        }
      } else if (targetCommande && products.length > 0) {
        const ids = Array.from(
          new Set(
            targetCommande
              .split(',')
              .map((s) => s.trim())
              .filter(Boolean)
          )
        );
        const matched = ids
          .map((id) => products.find((p) => p.id === id || p.ref.toLowerCase() === id.toLowerCase()))
          .filter((p): p is Product => Boolean(p));
        if (matched.length === 1) {
          setModalProduct(matched[0]);
        } else if (matched.length > 1) {
          setOrderPreviewProducts(matched);
        }
      }
    } catch (err) {
      console.error('URL param parsing error:', err);
    }
  }, [products]);

  // Fallback cache categories to localStorage
  useEffect(() => {
    if (!isCatalogLoading && categories.length > 0) {
      saveStoredCategories(categories);
    }
  }, [categories, isCatalogLoading]);

  // Fallback cache mediaConfig to localStorage & sync favicon if custom logoUrl is set
  useEffect(() => {
    if (!isCatalogLoading) {
      saveStoredMediaConfig(mediaConfig);
    }
    if (mediaConfig.logoUrl) {
      const logoHref = mediaConfig.logoUrl;
      const isSvg = logoHref.startsWith('data:image/svg') || /\.svg(\?|$)/i.test(logoHref);
      const mimeType = isSvg ? 'image/svg+xml' : 'image/png';

      const syncHeadLink = (relValue: string, withType: boolean) => {
        let link = document.querySelector(`link[rel="${relValue}"]`) as HTMLLinkElement | null;
        if (!link) {
          link = document.createElement('link');
          link.rel = relValue;
          document.head.appendChild(link);
        }
        if (withType) {
          link.type = mimeType;
        } else {
          link.removeAttribute('type');
        }
        link.href = logoHref;
      };

      syncHeadLink('icon', true);
      syncHeadLink('shortcut icon', false);
      syncHeadLink('apple-touch-icon', false);
    }
  }, [mediaConfig, isCatalogLoading]);

  // Sync cart to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('huize_shop_cart_v1', JSON.stringify(cart));
    } catch (e) {
      console.error('Failed to save cart', e);
    }
  }, [cart]);

  // Handle Cart Operations
  const handleAddToCart = (product: Product, size: string, quantity: number = 1) => {
    setCart((prev) => {
      const chosenSize = size || product.sizes[0] || 'Standard';
      const existingIdx = prev.findIndex(
        (item) => item.product.id === product.id && item.selectedSize === chosenSize
      );

      if (existingIdx > -1) {
        const next = [...prev];
        next[existingIdx].quantity += quantity;
        return next;
      } else {
        return [...prev, { product, selectedSize: chosenSize, quantity }];
      }
    });

    showToast(`✓ "${product.name}" (${size || product.sizes[0] || 'Standard'}) ajouté au panier !`);
  };

  const handleQuickAdd = (product: Product) => {
    handleAddToCart(product, product.sizes[0] || 'Standard', 1);
  };

  const handleUpdateQuantity = (index: number, quantity: number) => {
    if (quantity <= 0) {
      handleRemoveItem(index);
      return;
    }
    setCart((prev) => {
      const next = [...prev];
      next[index].quantity = quantity;
      return next;
    });
  };

  const handleRemoveItem = (index: number) => {
    setCart((prev) => prev.filter((_, i) => i !== index));
    showToast('Article retiré du panier');
  };

  const handleClearCart = () => {
    setCart([]);
    showToast('Panier vidé');
  };

  // Register WhatsApp order in Firestore
  const handleOrderPlaced = async (orderData: {
    customerName: string;
    customerPhone: string;
    customerCity: string;
    itemsSummary: string;
    items?: OrderItemSnapshot[];
    total: number;
    paymentMethod: string;
    referralCode?: string;
  }) => {
    const cleanRef = normalizeReferralCode(orderData.referralCode || activeReferralCode);
    if (cleanRef) {
      saveStoredReferralCode(cleanRef);
      setActiveReferralCode(cleanRef);
    }

    const matchedMember = teamMembers.find((m) => normalizeReferralCode(m.code) === cleanRef);

    const newOrder: WhatsAppOrder = {
      id: `CMD-${Math.floor(1000 + Math.random() * 9000)}`,
      customerName: orderData.customerName,
      phone: orderData.customerPhone,
      city: orderData.customerCity,
      customerPhone: orderData.customerPhone,
      customerCity: orderData.customerCity,
      itemsSummary: orderData.itemsSummary,
      ...(orderData.items && orderData.items.length > 0 ? { items: orderData.items } : {}),
      total: orderData.total,
      date: new Date().toLocaleDateString('fr-FR', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }),
      status: 'pending',
      statusLabel: 'À livrer',
      paymentMethod: orderData.paymentMethod,
      channel: 'whatsapp',
      createdAt: new Date().toISOString(),
      ...(cleanRef ? { referredByCode: cleanRef } : {}),
      ...(matchedMember ? { referredByName: matchedMember.name } : {})
    };

    setOrders((prev) => [newOrder, ...prev]);
    syncTeamServerCache({ order: newOrder });
    void trackOrderEventOnServer('whatsapp');

    const cleanPhone = orderData.customerPhone.replace(/[^0-9]/g, '');
    const hasRealIdentity =
      (orderData.customerName && orderData.customerName !== 'Client WhatsApp') || cleanPhone.length >= 6;

    if (hasRealIdentity) {
      const words = orderData.customerName.trim().split(/\s+/).filter(Boolean);
      const avatar =
        words.length >= 2
          ? `${words[0][0]}${words[1][0]}`.toUpperCase()
          : (orderData.customerName.slice(0, 2) || 'CL').toUpperCase();

      const realLead: ClientLead = {
        id: cleanPhone ? `lead-${cleanPhone}` : `lead-${Date.now()}`,
        name: orderData.customerName,
        city: orderData.customerCity,
        notes: `${orderData.itemsSummary} (${orderData.total.toLocaleString('fr-FR')} F CFA)`,
        phone: orderData.customerPhone,
        avatar
      };

      setLeads((prev) => {
        const filtered = prev.filter((l) => l.id !== realLead.id);
        return [realLead, ...filtered];
      });
      saveLeadToDb(realLead).catch(() => {});
    }

    try {
      await saveOrderToDb(newOrder);
      showToast('📦 Commande enregistrée et transmise sur WhatsApp !');
    } catch (e) {
      console.error('Failed to log order to Firestore', e);
    }
  };

  // Register direct product WhatsApp click as a real inquiry/order
  const handleDirectProductOrder = async (
    product: Product,
    size: string,
    quantity: number,
    referralCode?: string
  ) => {
    const cleanRef = normalizeReferralCode(referralCode || activeReferralCode);
    if (cleanRef) {
      saveStoredReferralCode(cleanRef);
      setActiveReferralCode(cleanRef);
    }
    const matchedMember = teamMembers.find((m) => normalizeReferralCode(m.code) === cleanRef);

    const newOrder: WhatsAppOrder = {
      id: `CMD-${Math.floor(1000 + Math.random() * 9000)}`,
      customerName: 'Client Direct WhatsApp',
      phone: 'Non précisé',
      city: 'Burkina Faso',
      itemsSummary: `${quantity}x ${product.name} (${size || 'Standard'})`,
      items: [
        {
          productId: product.id,
          name: product.name,
          ref: product.ref,
          image: getCompactProductThumbnail(product),
          size: size || 'Standard',
          quantity,
          price: product.price
        }
      ],
      total: product.price * quantity,
      date: new Date().toLocaleDateString('fr-FR', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }),
      status: 'discussion',
      statusLabel: 'En discussion',
      paymentMethod: 'À convenir sur WhatsApp',
      channel: 'whatsapp',
      createdAt: new Date().toISOString(),
      ...(cleanRef ? { referredByCode: cleanRef } : {}),
      ...(matchedMember ? { referredByName: matchedMember.name } : {})
    };

    setOrders((prev) => [newOrder, ...prev]);
    syncTeamServerCache({ order: newOrder });
    void trackOrderEventOnServer('whatsapp');
    saveOrderToDb(newOrder).catch(() => {});
  };

  // Handle Admin Operations with Firestore Persistence
  const handleAddProduct = async (newProd: Omit<Product, 'id'>) => {
    const created: Product = {
      ...newProd,
      id: `prod-${Date.now()}`
    };
    const updatedList = [created, ...products];
    setProducts(updatedList);
    saveStoredProducts(updatedList);
    syncServerCatalog({ product: created });
    showToast(`✨ Article "${created.name}" publié et enregistré !`);
    try {
      await saveProductToDb(created);
    } catch (e) {
      console.error('Failed to save product in Firestore', e);
      showToast('⚠️ Synchronisé sur le serveur (quota Firestore atteint)');
    }
  };

  const handleUpdateProduct = async (updated: Product) => {
    const updatedList = products.map((p) => (p.id === updated.id ? updated : p));
    setProducts(updatedList);
    saveStoredProducts(updatedList);
    syncServerCatalog({ product: updated });
    showToast(`Modifications enregistrées pour "${updated.name}"`);
    try {
      await saveProductToDb(updated);
    } catch (e) {
      console.error('Failed to update product in Firestore', e);
    }
  };

  const handleDeleteProduct = async (id: string) => {
    const updatedList = products.filter((p) => p.id !== id);
    setProducts(updatedList);
    saveStoredProducts(updatedList);
    syncServerCatalog({ deletedProductId: id });
    showToast('Article supprimé du catalogue');
    try {
      await deleteProductFromDb(id);
    } catch (e) {
      console.error('Failed to delete product from Firestore', e);
    }
  };

  const createCategorySlug = (name: string) => {
    const base =
      name
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '') || `cat-${Date.now()}`;

    let candidate = base;
    let counter = 2;
    while (categories.some((c) => c.slug === candidate)) {
      candidate = `${base}-${counter}`;
      counter += 1;
    }
    return candidate;
  };

  const handleAddCategory = async (input: {
    name: string;
    icon: string;
    badge?: string;
    subtitle?: string;
    image?: string;
  }) => {
    const slug = createCategorySlug(input.name);
    const newCat: Category = {
      id: `cat-${Date.now()}`,
      name: input.name.trim(),
      icon: input.icon || '🛍️',
      badge: (input.badge || 'NOUVEAU').trim().toUpperCase(),
      itemCount: 0,
      slug,
      ...(input.subtitle?.trim() ? { subtitle: input.subtitle.trim() } : {}),
      ...(input.image?.trim() ? { image: input.image.trim() } : {})
    };
    const nextCategories = [...categories, newCat];
    setCategories(nextCategories);
    saveStoredCategories(nextCategories);
    syncServerCatalog({ category: newCat });
    showToast(`Catégorie "${newCat.name}" créée`);
    try {
      await saveCategoryToDb(newCat);
    } catch (e) {
      console.error('Failed to save category to Firestore', e);
    }
  };

  const handleUpdateCategory = async (updated: Category) => {
    const cleanCat: Category = {
      ...updated,
      name: updated.name.trim(),
      badge: (updated.badge || 'COLLECTION').trim().toUpperCase(),
      subtitle: updated.subtitle?.trim() || undefined,
      image: updated.image?.trim() || undefined
    };

    const nextCategories = categories.map((c) => (c.id === cleanCat.id ? cleanCat : c));
    setCategories(nextCategories);
    saveStoredCategories(nextCategories);
    syncServerCatalog({ category: cleanCat });

    // Sync categoryLabel on existing products of this category if renamed
    const affectedProducts = products.filter(
      (p) => p.category === cleanCat.slug && p.categoryLabel !== cleanCat.name
    );
    if (affectedProducts.length > 0) {
      const nextProducts = products.map((p) =>
        p.category === cleanCat.slug ? { ...p, categoryLabel: cleanCat.name } : p
      );
      setProducts(nextProducts);
      saveStoredProducts(nextProducts);
      affectedProducts.forEach((p) => {
        const updatedProd = { ...p, categoryLabel: cleanCat.name };
        syncServerCatalog({ product: updatedProd });
        saveProductToDb(updatedProd).catch(() => {});
      });
    }

    showToast(`Catégorie "${cleanCat.name}" mise à jour`);
    try {
      await saveCategoryToDb(cleanCat);
    } catch (e) {
      console.error('Failed to update category in Firestore', e);
    }
  };

  const handleDeleteCategory = async (id: string) => {
    const nextCategories = categories.filter((c) => c.id !== id);
    setCategories(nextCategories);
    saveStoredCategories(nextCategories);
    syncServerCatalog({ deletedCategoryId: id });
    showToast('Catégorie supprimée');
    try {
      await deleteCategoryFromDb(id);
    } catch (e) {
      console.error('Failed to delete category from Firestore', e);
    }
  };

  const handleUpdateOrderStatus = async (orderId: string, status: WhatsAppOrder['status']) => {
    const statusMap: Record<WhatsAppOrder['status'], string> = {
      pending: 'À livrer',
      paid: 'Payé (Orange/Moov)',
      delivered: 'Livré',
      discussion: 'En discussion'
    };
    let updatedOrder: WhatsAppOrder | null = null;
    setOrders((prev) =>
      prev.map((o) => {
        if (o.id === orderId) {
          updatedOrder = { ...o, status, statusLabel: statusMap[status] };
          return updatedOrder;
        }
        return o;
      })
    );
    if (updatedOrder) {
      syncTeamServerCache({ order: updatedOrder });
    }
    showToast(`Statut de la commande mis à jour`);
    try {
      await updateOrderStatusInDb(orderId, status);
    } catch (e) {
      console.error('Failed to update order in Firestore', e);
    }
  };

  const handleAssignOrderReferral = async (orderId: string, referralCode: string) => {
    const cleanCode = normalizeReferralCode(referralCode);
    const matched = teamMembers.find((m) => normalizeReferralCode(m.code) === cleanCode);
    const refName = matched ? matched.name : '';
    let updatedOrder: WhatsAppOrder | null = null;

    setOrders((prev) =>
      prev.map((o) => {
        if (o.id === orderId) {
          updatedOrder = {
            ...o,
            referredByCode: cleanCode || undefined,
            referredByName: refName || undefined
          };
          return updatedOrder;
        }
        return o;
      })
    );
    if (updatedOrder) {
      syncTeamServerCache({ order: updatedOrder });
    }
    showToast(
      cleanCode ? `Commande attribuée à ${matched?.name || cleanCode}` : 'Attribution retirée'
    );
    try {
      await updateOrderReferralInDb(orderId, cleanCode, refName);
    } catch (e) {
      console.error('Failed to assign order referral in Firestore', e);
    }
  };

  const handleUpdateMediaConfig = async (newConfig: SiteMediaConfig) => {
    setMediaConfig(newConfig);
    syncServerCatalog({ mediaConfig: newConfig });
    showToast("✨ Photos et bannières d'accueil enregistrées !");
    try {
      await saveMediaConfigToDb(newConfig);
    } catch (e) {
      console.error('Failed to save media config to Firestore', e);
    }
  };

  const handleDeleteOrder = async (orderId: string) => {
    setOrders((prev) => prev.filter((o) => o.id !== orderId));
    syncTeamServerCache({ deletedOrderId: orderId });
    showToast('Commande supprimée');
    try {
      await deleteOrderFromDb(orderId);
    } catch (e) {
      console.error('Failed to delete order from Firestore', e);
    }
  };

  const handleDeleteLead = async (leadId: string) => {
    setLeads((prev) => prev.filter((l) => l.id !== leadId));
    showToast('Contact client supprimé');
    try {
      await deleteLeadFromDb(leadId);
    } catch (e) {
      console.error('Failed to delete lead from Firestore', e);
    }
  };

  const handleAddTeamMember = async (input: {
    name: string;
    code: string;
    pin: string;
    phone?: string;
  }) => {
    const newMember: TeamMember = {
      id: `tm-${Date.now()}`,
      name: input.name,
      code: normalizeReferralCode(input.code),
      pin: input.pin.trim(),
      ...(input.phone ? { phone: input.phone } : {}),
      active: true,
      clicks: 0,
      createdAt: new Date().toISOString()
    };
    setTeamMembers((prev) => [newMember, ...prev]);
    syncTeamServerCache({ teamMember: newMember });
    showToast(`Membre "${newMember.name}" (${newMember.code}) ajouté !`);
    try {
      await saveTeamMemberToDb(newMember);
    } catch (e) {
      console.error('Failed to save team member to Firestore', e);
    }
  };

  const handleUpdateTeamMember = async (updated: TeamMember) => {
    setTeamMembers((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
    syncTeamServerCache({ teamMember: updated });
    showToast(`Compte de "${updated.name}" mis à jour`);
    try {
      await saveTeamMemberToDb(updated);
    } catch (e) {
      console.error('Failed to update team member in Firestore', e);
    }
  };

  const handleDeleteTeamMember = async (memberId: string) => {
    setTeamMembers((prev) => prev.filter((m) => m.id !== memberId));
    syncTeamServerCache({ deletedTeamMemberId: memberId });
    showToast('Membre retiré de l’équipe');
    try {
      await deleteTeamMemberFromDb(memberId);
    } catch (e) {
      console.error('Failed to delete team member from Firestore', e);
    }
  };

  const handleRefreshAdminData = async () => {
    const [ordersData, leadsData, teamData] = await Promise.all([
      fetchOrdersOnce(),
      fetchLeadsOnce(),
      fetchTeamMembersOnce()
    ]);
    if (ordersData) setOrders(ordersData);
    if (leadsData) setLeads(leadsData);
    if (teamData) setTeamMembers(teamData);
    syncTeamServerCache({ forceRefresh: true });
    showToast('Données actualisées');
  };

  // Synchronize Tab changes
  // Discreet merchant trigger via #admin URL or keyboard shortcut Ctrl+Shift+A
  useEffect(() => {
    const checkHashOrQuery = () => {
      const hash = window.location.hash;
      const search = window.location.search;
      if (hash === '#admin' || search.includes('admin=')) {
        if (isAdminAuthenticated) {
          setIsAdminMode(true);
          setActiveTab('admin');
        } else {
          setIsAdminAuthModalOpen(true);
        }
      }
    };

    checkHashOrQuery();
    window.addEventListener('hashchange', checkHashOrQuery);

    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'A' || e.key === 'a')) {
        e.preventDefault();
        if (isAdminAuthenticated) {
          setIsAdminMode((prev) => !prev);
          setActiveTab((prev) => (prev === 'admin' ? 'accueil' : 'admin'));
        } else {
          setIsAdminAuthModalOpen(true);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('hashchange', checkHashOrQuery);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isAdminAuthenticated]);

  const handleAdminAuthSuccess = () => {
    try {
      sessionStorage.setItem('huize_admin_auth', 'true');
    } catch (e) {
      console.error(e);
    }
    setIsAdminAuthenticated(true);
    setIsAdminAuthModalOpen(false);
    setIsAdminMode(true);
    setActiveTab('admin');
    showToast('🔓 Accès Espace Commerçant déverrouillé');
  };

  // Synchronize Tab changes
  const handleTabChange = (tab: string) => {
    if (tab.startsWith('cat:')) {
      setActiveTab('boutique');
      setShopCategoryFilter(tab.slice(4));
      setIsAdminMode(false);
    } else if (tab === 'baskets') {
      setActiveTab('boutique');
      setShopCategoryFilter('chaussures');
      setIsAdminMode(false);
    } else if (tab === 'sandales') {
      setActiveTab('boutique');
      setShopCategoryFilter('sandales');
      setIsAdminMode(false);
    } else if (tab === 'vetements') {
      setActiveTab('boutique');
      setShopCategoryFilter('vetements');
      setIsAdminMode(false);
    } else if (tab === 'admin') {
      if (isAdminAuthenticated) {
        setIsAdminMode(true);
        setActiveTab('admin');
      } else {
        setIsAdminAuthModalOpen(true);
      }
    } else {
      setActiveTab(tab);
      setIsAdminMode(false);
      if (tab === 'boutique') {
        setShopCategoryFilter('all');
      }
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Filtering for the Boutique / Catalog section
  const currentCategorySlug =
    activeTab === 'baskets'
      ? 'chaussures'
      : activeTab === 'sandales'
      ? 'sandales'
      : activeTab === 'vetements'
      ? 'vetements'
      : shopCategoryFilter;

  const catalogFilteredProducts = products
    .filter((p) => {
      const matchCategory =
        currentCategorySlug === 'all'
          ? true
          : currentCategorySlug === 'favoris'
          ? likedProductIds.includes(p.id)
          : p.category === currentCategorySlug;
      const matchSearch =
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.ref.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.categoryLabel.toLowerCase().includes(searchQuery.toLowerCase());
      return matchCategory && matchSearch;
    })
    .sort((a, b) => {
      if (sortOption === 'popular') return (b.likes || 0) - (a.likes || 0);
      if (sortOption === 'price-asc') return a.price - b.price;
      if (sortOption === 'price-desc') return b.price - a.price;
      if (sortOption === 'newest') return (b.badge === 'Nouveau' ? 1 : 0) - (a.badge === 'Nouveau' ? 1 : 0);
      return 0;
    });

  const featuredProducts = products.filter((p) => p.featured === true);

  const cartTotalCount = cart.reduce((acc, i) => acc + i.quantity, 0);

  // If in admin mode AND authenticated, show dashboard (once full raw images are ready)
  if ((isAdminMode || activeTab === 'admin') && isAdminAuthenticated) {
    if (!isAdminCatalogReady) {
      return (
        <div className="min-h-screen bg-[#F8F7F2] flex items-center justify-center p-6">
          <div className="bg-white border border-[#E1E3DA] rounded-2xl p-6 text-center shadow-xs max-w-sm w-full">
            <div className="w-8 h-8 border-2 border-[#123B2A] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-sm font-bold text-[#123B2A]">Chargement de l&apos;espace commerçant...</p>
            <p className="text-xs text-[#6B726C] mt-1">Synchronisation des articles et photos en cours</p>
          </div>
        </div>
      );
    }
    return (
      <AdminDashboard
        products={products}
        categories={categories}
        orders={orders}
        leads={leads}
        teamMembers={teamMembers}
        mediaConfig={mediaConfig}
        onUpdateMediaConfig={handleUpdateMediaConfig}
        onAddProduct={handleAddProduct}
        onUpdateProduct={handleUpdateProduct}
        onDeleteProduct={handleDeleteProduct}
        onAddCategory={handleAddCategory}
        onUpdateCategory={handleUpdateCategory}
        onDeleteCategory={handleDeleteCategory}
        onUpdateOrderStatus={handleUpdateOrderStatus}
        onAssignOrderReferral={handleAssignOrderReferral}
        onDeleteOrder={handleDeleteOrder}
        onDeleteLead={handleDeleteLead}
        onAddTeamMember={handleAddTeamMember}
        onUpdateTeamMember={handleUpdateTeamMember}
        onDeleteTeamMember={handleDeleteTeamMember}
        onRefreshAdminData={handleRefreshAdminData}
        onSyncOrderStatus={(orderId, status) => {
          const statusMap: Record<WhatsAppOrder['status'], string> = {
            pending: 'À livrer',
            paid: 'Payé (Orange/Moov)',
            delivered: 'Livré',
            discussion: 'En discussion'
          };
          setOrders((prev) =>
            prev.map((o) =>
              o.id === orderId ? { ...o, status, statusLabel: statusMap[status] } : o
            )
          );
        }}
        onNewSiteOrderReceived={(incomingOrder) => {
          setOrders((prev) => [incomingOrder, ...prev.filter((o) => o.id !== incomingOrder.id)]);
        }}
        onExitAdmin={() => {
          setIsAdminMode(false);
          setActiveTab('accueil');
          if (window.location.hash === '#admin') {
            window.history.replaceState(null, '', window.location.pathname);
          }
        }}
        onLogout={() => {
          try {
            sessionStorage.removeItem('huize_admin_auth');
          } catch (e) {
            console.error(e);
          }
          setIsAdminAuthenticated(false);
          setIsAdminMode(false);
          setActiveTab('accueil');
          if (window.location.hash === '#admin') {
            window.history.replaceState(null, '', window.location.pathname);
          }
          showToast('🔒 Session administrateur verrouillée');
        }}
      />
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#F8F7F2] text-[#202720]">
      {/* Offline Connectivity Indicator */}
      <OfflineIndicator />

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-20 right-4 z-50 bg-[#123B2A] text-white px-4 py-3 rounded-xl shadow-xl flex items-center gap-2 border border-[#D8F36A] animate-fade-in text-xs sm:text-sm font-semibold">
          <Check className="w-4 h-4 text-[#D8F36A]" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Main Navbar */}
      <Navbar
        activeTab={activeTab}
        activeCategorySlug={shopCategoryFilter}
        setActiveTab={handleTabChange}
        categories={categories}
        cartCount={cartTotalCount}
        onOpenCart={() => {
          setActiveTab('panier');
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
        likedCount={likedProductIds.length}
        onOpenFavorites={() => {
          setActiveTab('boutique');
          setShopCategoryFilter('favoris');
          window.scrollTo({ top: 380, behavior: 'smooth' });
        }}
        logoUrl={mediaConfig.logoUrl}
        isAdminMode={isAdminMode}
        setIsAdminMode={setIsAdminMode}
      />

      {/* Active Team Sharing Indicator (shown when a team member browses & shares directly on the storefront) */}
      {(teamSession || memberShareCode) && activeTab !== 'equipe' && (
        <div className="bg-[#FAF9F5] border-b border-[#E1E3DA] px-4 py-2 text-xs text-[#123B2A]">
          <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-2">
            <p className="truncate">
              Mode partage équipe :{' '}
              <strong className="font-mono">
                {teamSession ? `${teamSession.member.name} (${teamSession.code})` : memberShareCode}
              </strong>
              <span className="hidden sm:inline text-[#6B726C]">
                {' '}— Vos partages sur la boutique incluent automatiquement votre code
              </span>
            </p>
            <div className="flex items-center gap-3 shrink-0">
              <button
                type="button"
                onClick={async () => {
                  const code = teamSession?.code || memberShareCode;
                  try {
                    await navigator.clipboard.writeText(getBoutiqueShareUrl(code));
                    showToast(`Lien boutique copié avec votre code (${code}) !`);
                  } catch {
                    showToast('Impossible de copier le lien.');
                  }
                }}
                className="font-bold text-[#1F5A40] hover:underline cursor-pointer whitespace-nowrap"
              >
                Partager la boutique
              </button>
              <button
                type="button"
                onClick={() => handleTabChange('equipe')}
                className="font-bold text-[#123B2A] hover:underline cursor-pointer whitespace-nowrap"
              >
                Mon espace
              </button>
              <button
                type="button"
                onClick={() => {
                  setTeamSession(null);
                  setMemberShareCode('');
                  try {
                    sessionStorage.removeItem('huize_team_session_v1');
                    localStorage.removeItem('huize_member_share_code_v1');
                  } catch {
                    // Ignore storage errors
                  }
                  showToast('Mode partage équipe désactivé');
                }}
                className="text-[#6B726C] hover:text-[#123B2A] cursor-pointer whitespace-nowrap"
              >
                Quitter
              </button>
            </div>
          </div>
        </div>
      )}

      <main className="flex-1">
        {/* VIEW 1: ACCUEIL */}
        {activeTab === 'accueil' && (
          <>
            <Hero
              heroImage={mediaConfig.heroImage}
              heroImages={mediaConfig.heroImages}
              heroTagline={mediaConfig.heroTagline}
              heroTitle={mediaConfig.heroTitle}
              heroSubtitle={mediaConfig.heroSubtitle}
              onExploreShop={() => {
                setActiveTab('boutique');
                setShopCategoryFilter('all');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
            />

            <AdCarousel
              products={products}
              onOpenProduct={(product) => setModalProduct(product)}
            />

            <CategoryShowcase
              categories={categories}
              products={products}
              onSelectCategory={(cat) => {
                setActiveTab('boutique');
                setShopCategoryFilter(cat);
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
            />

            {/* Featured Catalogue Preview */}
            <section className="py-14 bg-white border-t border-[#E1E3DA]">
              <div className="max-w-6xl mx-auto px-4 sm:px-6">
                <div className="text-center mb-8">
                  <h2 className="text-2xl sm:text-3xl font-bold font-title text-[#123B2A] relative inline-block">
                    Nos produits phares
                    <span className="block w-14 h-1 bg-[#D8F36A] rounded-full mx-auto mt-2" />
                  </h2>
                  <p className="text-xs sm:text-sm text-[#6B726C] mt-2">
                    Sélection des articles les plus demandés à Ouagadougou en ce moment.
                  </p>
                </div>

                {/* Featured Grid (managed from Admin) */}
                {isCatalogLoading && featuredProducts.length === 0 ? (
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
                    {Array.from({ length: 4 }).map((_, i) => (
                      <div
                        key={i}
                        className="bg-[#FAF9F5] border border-[#E1E3DA] rounded-2xl h-72 animate-pulse"
                      />
                    ))}
                  </div>
                ) : featuredProducts.length === 0 ? (
                  <div className="text-center py-12 bg-[#FAF9F5] rounded-xl border border-[#E1E3DA]">
                    <p className="text-sm font-semibold text-[#6B726C]">
                      Aucun produit phare sélectionné pour le moment.
                    </p>
                    <button
                      onClick={() => {
                        setActiveTab('boutique');
                        setShopCategoryFilter('all');
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      }}
                      className="mt-3 text-xs text-[#1F5A40] underline font-bold cursor-pointer"
                    >
                      Découvrir toute la boutique ({products.length} articles)
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
                    {featuredProducts.map((product) => (
                      <ProductCard
                        key={product.id}
                        product={product}
                        onOpenDetails={(p) => setModalProduct(p)}
                        onQuickAdd={handleQuickAdd}
                        isLiked={likedProductIds.includes(product.id)}
                        onToggleLike={handleToggleLike}
                        onOpenShare={(p) => setShareModalProduct(p)}
                        referralCode={activeReferralCode}
                        onDirectWhatsAppOrder={handleDirectProductOrder}
                      />
                    ))}
                  </div>
                )}

                <div className="text-center mt-10">
                  <button
                    onClick={() => {
                      setActiveTab('boutique');
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    className="inline-flex items-center gap-2 px-7 py-3 rounded-full border-2 border-[#123B2A] text-[#123B2A] hover:bg-[#123B2A] hover:text-white font-bold text-xs sm:text-sm transition-all cursor-pointer active:scale-95 shadow-xs"
                  >
                    <span>Voir toute la boutique ({products.length} articles)</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </section>

            <CustomerReviewsSection
              onReviewSubmitted={() =>
                showToast('⭐ Merci ! Votre avis est maintenant visible sur la boutique.')
              }
            />

            <Reassurance />
            <PaymentDelivery />
          </>
        )}

        {/* VIEW 2: BOUTIQUE COMPLETE */}
        {activeTab === 'boutique' && (
          <section className="py-8 sm:py-12 px-4 sm:px-6 max-w-6xl mx-auto">
            <div className="text-center max-w-xl mx-auto mb-8">
              <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold font-title text-[#123B2A] relative inline-block">
                Boutique HUIZE SHOP
                <span className="block w-14 h-1 bg-[#D8F36A] rounded-full mx-auto mt-2" />
              </h1>
              <p className="text-xs sm:text-sm text-[#6B726C] mt-2">
                Catalogue complet de baskets, sandales et vêtements. Commande directe via WhatsApp ({WHATSAPP_DISPLAY}).
              </p>
            </div>

            {/* Filter Tools */}
            <div className="bg-white border border-[#E1E3DA] rounded-2xl p-4 sm:p-5 mb-8 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
              <div className="flex gap-2 overflow-x-auto pb-1 sm:flex-wrap scrollbar-none">
                <button
                  onClick={() => setShopCategoryFilter('all')}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                    shopCategoryFilter === 'all'
                      ? 'bg-[#123B2A] text-white'
                      : 'bg-[#FAF9F5] border border-[#E1E3DA] text-[#123B2A] hover:bg-[#EFEFE6]'
                  }`}
                >
                  Tous ({products.length})
                </button>
                {likedProductIds.length > 0 && (
                  <button
                    onClick={() => setShopCategoryFilter('favoris')}
                    className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
                      shopCategoryFilter === 'favoris'
                        ? 'bg-red-600 text-white shadow-xs'
                        : 'bg-[#FAF9F5] border border-[#E1E3DA] text-red-600 hover:bg-red-50'
                    }`}
                  >
                    <Heart className="w-3.5 h-3.5 fill-current" />
                    <span>Coups de cœur ({likedProductIds.length})</span>
                  </button>
                )}
                {categories.map((c) => {
                  const count = products.filter((p) => p.category === c.slug).length;
                  return (
                    <button
                      key={c.id}
                      onClick={() => setShopCategoryFilter(c.slug)}
                      className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                        shopCategoryFilter === c.slug
                          ? 'bg-[#123B2A] text-white'
                          : 'bg-[#FAF9F5] border border-[#E1E3DA] text-[#123B2A] hover:bg-[#EFEFE6]'
                      }`}
                    >
                      {c.icon} {c.name} ({count})
                    </button>
                  );
                })}
              </div>

              <div className="flex flex-wrap sm:flex-nowrap items-center gap-3">
                <div className="relative w-full sm:w-56">
                  <Search className="w-4 h-4 text-[#6B726C] absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Filtrer un modèle..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 bg-[#FAF9F5] border border-[#E1E3DA] rounded-lg text-xs focus:outline-[#1F5A40]"
                  />
                </div>

                <select
                  value={sortOption}
                  onChange={(e) => setSortOption(e.target.value)}
                  className="w-full sm:w-auto p-2 bg-[#FAF9F5] border border-[#E1E3DA] rounded-lg text-xs text-[#123B2A] focus:outline-[#1F5A40]"
                >
                  <option value="default">Sélection HUIZE</option>
                  <option value="popular">❤️ Les plus aimés</option>
                  <option value="newest">Nouveautés d'abord</option>
                  <option value="price-asc">Prix croissant</option>
                  <option value="price-desc">Prix décroissant</option>
                </select>
              </div>
            </div>

            {/* Product Grid */}
            {isCatalogLoading && catalogFilteredProducts.length === 0 ? (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div
                    key={i}
                    className="bg-white border border-[#E1E3DA] rounded-2xl h-72 animate-pulse"
                  />
                ))}
              </div>
            ) : catalogFilteredProducts.length === 0 ? (
              <div className="text-center py-16 bg-white rounded-2xl border border-[#E1E3DA]">
                <p className="text-sm font-semibold text-[#6B726C]">
                  {shopCategoryFilter === 'favoris'
                    ? "Vous n'avez pas encore de coup de cœur enregistré. Cliquez sur le cœur ❤️ d'un produit pour le retrouver ici !"
                    : 'Aucun article disponible pour ce filtre.'}
                </p>
                <button
                  onClick={() => {
                    setSearchQuery('');
                    setShopCategoryFilter('all');
                  }}
                  className="mt-3 px-4 py-2 bg-[#123B2A] text-white rounded-full text-xs font-bold cursor-pointer"
                >
                  Afficher tous les articles
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
                {catalogFilteredProducts.map((product) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    onOpenDetails={(p) => setModalProduct(p)}
                    onQuickAdd={handleQuickAdd}
                    isLiked={likedProductIds.includes(product.id)}
                    onToggleLike={handleToggleLike}
                    onOpenShare={(p) => setShareModalProduct(p)}
                    referralCode={activeReferralCode}
                    onDirectWhatsAppOrder={handleDirectProductOrder}
                  />
                ))}
              </div>
            )}
          </section>
        )}

        {/* VIEW 3: PANIER */}
        {activeTab === 'panier' && (
          <CartView
            cart={cart}
            onUpdateQuantity={handleUpdateQuantity}
            onRemoveItem={handleRemoveItem}
            onClearCart={handleClearCart}
            initialReferralCode={activeReferralCode}
            onOrderPlaced={handleOrderPlaced}
            onStartSiteOrder={(draft) => {
              setChatDraftOrder(draft);
              setIsChatOpen(true);
            }}
            onContinueShopping={() => {
              setActiveTab('boutique');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
          />
        )}

        {/* VIEW 4: A PROPOS */}
        {activeTab === 'apropos' && (
          <AboutView
            onExploreShop={() => handleTabChange('boutique')}
            onOpenContact={() => handleTabChange('contact')}
          />
        )}

        {/* VIEW 5: CONTACT */}
        {activeTab === 'contact' && <ContactView />}

        {/* VIEW 6: ESPACE EQUIPE & PARTAGE */}
        {activeTab === 'equipe' && (
          <TeamPortalView
            products={products}
            session={teamSession}
            onLoginSuccess={(nextSession) => {
              setTeamSession(nextSession);
              setMemberShareCode(nextSession.code);
              try {
                sessionStorage.setItem('huize_team_session_v1', JSON.stringify(nextSession));
                localStorage.setItem('huize_member_share_code_v1', nextSession.code);
              } catch {
                // Ignore storage errors
              }
            }}
            onLogout={() => {
              setTeamSession(null);
              setMemberShareCode('');
              try {
                sessionStorage.removeItem('huize_team_session_v1');
                localStorage.removeItem('huize_member_share_code_v1');
              } catch {
                // Ignore storage errors
              }
              showToast('Session équipe déconnectée');
            }}
            onOpenShop={() => handleTabChange('accueil')}
            onShowToast={showToast}
          />
        )}
      </main>

      {/* Product Detail Modal */}
      <ProductDetailModal
        product={modalProduct}
        onClose={() => setModalProduct(null)}
        onAddToCart={handleAddToCart}
        isLiked={modalProduct ? likedProductIds.includes(modalProduct.id) : false}
        onToggleLike={handleToggleLike}
        onOpenShare={(p) => setShareModalProduct(p)}
        initialReferralCode={activeReferralCode}
        onDirectWhatsAppOrder={handleDirectProductOrder}
        onStartSiteOrder={(product, size, quantity, referralCode) => {
          setChatDraftOrder({
            items: [
              {
                productId: product.id,
                name: product.name,
                ref: product.ref,
                image: getCompactProductThumbnail(product),
                size: size || product.sizes?.[0] || 'Standard',
                quantity,
                price: product.price
              }
            ],
            referralCode: referralCode || activeReferralCode || undefined,
            clearCartOnSuccess: false
          });
          setIsChatOpen(true);
        }}
      />

      {/* Product Share Modal */}
      <ShareModal
        product={shareModalProduct}
        isOpen={Boolean(shareModalProduct)}
        onClose={() => setShareModalProduct(null)}
        onShowToast={showToast}
        referralCode={teamSession?.code || memberShareCode || activeReferralCode || undefined}
        onChangeReferralCode={(nextCode) => {
          const clean = normalizeReferralCode(nextCode);
          setMemberShareCode(clean);
          try {
            if (clean) {
              localStorage.setItem('huize_member_share_code_v1', clean);
            } else {
              localStorage.removeItem('huize_member_share_code_v1');
            }
          } catch {
            // Ignore storage errors
          }
        }}
      />

      {/* Multi-product Order Visual Preview Modal (?commande=...) */}
      {orderPreviewProducts && orderPreviewProducts.length > 0 && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setOrderPreviewProducts(null)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#123B2A]/65 backdrop-blur-xs"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-[#E1E3DA] p-5 sm:p-6 max-h-[85vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between border-b border-[#E1E3DA] pb-3 mb-4">
              <div>
                <h3 className="text-base sm:text-lg font-bold font-title text-[#123B2A]">
                  Articles de la commande ({orderPreviewProducts.length})
                </h3>
                <p className="text-xs text-[#6B726C]">
                  Cliquez sur un article pour voir ses détails complets
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOrderPreviewProducts(null)}
                aria-label="Fermer"
                className="w-8 h-8 rounded-full bg-[#FAF9F5] border border-[#E1E3DA] flex items-center justify-center text-[#123B2A] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex flex-col gap-3">
              {orderPreviewProducts.map((prod) => (
                <button
                  key={prod.id}
                  type="button"
                  onClick={() => {
                    setOrderPreviewProducts(null);
                    setModalProduct(prod);
                  }}
                  className="w-full text-left p-3 rounded-xl border border-[#E1E3DA] bg-[#FAF9F5] hover:bg-[#EFEFE6] flex items-center gap-3 transition-colors cursor-pointer"
                >
                  <img
                    src={prod.images[0] || `/api/products/${encodeURIComponent(prod.id)}/image.jpg`}
                    alt={prod.name}
                    className="w-16 h-16 rounded-lg object-cover bg-white border border-[#E1E3DA] shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-bold text-[#1F5A40] uppercase">
                      {prod.categoryLabel} • Réf {prod.ref}
                    </p>
                    <p className="text-sm font-bold text-[#123B2A] truncate">{prod.name}</p>
                    <p className="text-xs font-extrabold text-[#123B2A] tabular-nums">
                      {formatFCFA(prod.price)}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <Footer
        onNavigate={handleTabChange}
        categories={categories}
        logoUrl={mediaConfig.logoUrl}
        onOpenAdminAuth={() => {
          if (isAdminAuthenticated) {
            setIsAdminMode(true);
            setActiveTab('admin');
          } else {
            setIsAdminAuthModalOpen(true);
          }
        }}
      />

      {/* Admin Authentication Passcode Modal */}
      <AdminAuthModal
        isOpen={isAdminAuthModalOpen}
        onClose={() => {
          setIsAdminAuthModalOpen(false);
          if (window.location.hash === '#admin') {
            window.history.replaceState(null, '', window.location.pathname);
          }
        }}
        onSuccess={handleAdminAuthSuccess}
      />

      {/* Real-Time In-Site Order & Messaging Drawer */}
      <OrderChatWidget
        isOpen={isChatOpen}
        onOpen={() => setIsChatOpen(true)}
        onClose={() => {
          setIsChatOpen(false);
          setChatDraftOrder(null);
        }}
        draftOrder={chatDraftOrder}
        onClearDraft={() => setChatDraftOrder(null)}
        initialOpenTarget={chatOpenTarget}
        onClearInitialTarget={() => setChatOpenTarget(null)}
        onOrderCreated={(newOrder, clearCart) => {
          setOrders((prev) => [newOrder, ...prev.filter((o) => o.id !== newOrder.id)]);
          if (clearCart) {
            setCart([]);
          }
        }}
        products={products}
        onOpenProduct={(prod) => setModalProduct(prod)}
        onShowToast={showToast}
      />
    </div>
  );
}
