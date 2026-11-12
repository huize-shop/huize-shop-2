import React, { useState, useEffect } from 'react';
import { Product, CartItem, Category, WhatsAppOrder, ClientLead, SiteMediaConfig } from './types.ts';
import {
  loadStoredProducts,
  saveStoredProducts,
  loadStoredCategories,
  saveStoredCategories,
  loadStoredMediaConfig,
  saveStoredMediaConfig,
  INITIAL_ORDERS,
  INITIAL_LEADS,
  INITIAL_MEDIA_CONFIG
} from './data/initialData.ts';
import {
  subscribeProducts,
  saveProductToDb,
  deleteProductFromDb,
  subscribeCategories,
  saveCategoryToDb,
  deleteCategoryFromDb,
  subscribeOrders,
  saveOrderToDb,
  updateOrderStatusInDb,
  subscribeLeads,
  subscribeMediaConfig,
  saveMediaConfigToDb,
  testConnection
} from './firebase.ts';
import { Navbar } from './components/Navbar.tsx';
import { Hero } from './components/Hero.tsx';
import { AdCarousel } from './components/AdCarousel.tsx';
import { CategoryShowcase } from './components/CategoryShowcase.tsx';
import { ProductCard } from './components/ProductCard.tsx';
import { ProductDetailModal } from './components/ProductDetailModal.tsx';
import { CartView } from './components/CartView.tsx';
import { ContactView } from './components/ContactView.tsx';
import { AdminDashboard } from './components/AdminDashboard.tsx';
import { AdminAuthModal } from './components/AdminAuthModal.tsx';
import { Reassurance } from './components/Reassurance.tsx';
import { PaymentDelivery } from './components/PaymentDelivery.tsx';
import { Footer } from './components/Footer.tsx';
import { Search, SlidersHorizontal, ArrowRight, Check } from 'lucide-react';
import { WHATSAPP_DISPLAY } from './utils/whatsapp.ts';

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

  // Products & Categories persistent state
  const [products, setProducts] = useState<Product[]>(loadStoredProducts);
  const [categories, setCategories] = useState<Category[]>(loadStoredCategories);
  const [orders, setOrders] = useState<WhatsAppOrder[]>(INITIAL_ORDERS);
  const [leads, setLeads] = useState<ClientLead[]>(INITIAL_LEADS);
  const [mediaConfig, setMediaConfig] = useState<SiteMediaConfig>(loadStoredMediaConfig);

  // Cart state
  const [cart, setCart] = useState<CartItem[]>(() => {
    try {
      const stored = localStorage.getItem('huize_shop_cart_v1');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  // Modal State
  const [modalProduct, setModalProduct] = useState<Product | null>(null);

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

  // Connect and subscribe to Firebase Firestore in real-time
  useEffect(() => {
    testConnection();

    const unsubProducts = subscribeProducts((data) => {
      if (data && data.length > 0) {
        setProducts(data);
      }
    });

    const unsubCategories = subscribeCategories((data) => {
      if (data && data.length > 0) {
        setCategories(data);
      }
    });

    const unsubOrders = subscribeOrders((data) => {
      if (data && data.length > 0) {
        setOrders(data);
      }
    });

    const unsubLeads = subscribeLeads((data) => {
      if (data && data.length > 0) {
        setLeads(data);
      }
    });

    const unsubMedia = subscribeMediaConfig((config) => {
      if (config) {
        setMediaConfig(config);
      }
    });

    return () => {
      unsubProducts();
      unsubCategories();
      unsubOrders();
      unsubLeads();
      unsubMedia();
    };
  }, []);

  // Fallback cache products to localStorage
  useEffect(() => {
    saveStoredProducts(products);
  }, [products]);

  // Fallback cache categories to localStorage
  useEffect(() => {
    saveStoredCategories(categories);
  }, [categories]);

  // Fallback cache mediaConfig to localStorage
  useEffect(() => {
    saveStoredMediaConfig(mediaConfig);
  }, [mediaConfig]);

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
    total: number;
    paymentMethod: string;
  }) => {
    const newOrder: WhatsAppOrder = {
      id: `CMD-${Math.floor(1000 + Math.random() * 9000)}`,
      customerName: orderData.customerName,
      phone: orderData.customerPhone,
      city: orderData.customerCity,
      customerPhone: orderData.customerPhone,
      customerCity: orderData.customerCity,
      itemsSummary: orderData.itemsSummary,
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
      paymentMethod: orderData.paymentMethod
    };

    setOrders((prev) => [newOrder, ...prev]);
    try {
      await saveOrderToDb(newOrder);
      showToast('📦 Commande enregistrée et transmise sur WhatsApp !');
    } catch (e) {
      console.error('Failed to log order to Firestore', e);
    }
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
    showToast(`✨ Article "${created.name}" publié et enregistré en base !`);
    try {
      await saveProductToDb(created);
    } catch (e) {
      console.error('Failed to save product in Firestore', e);
      showToast('⚠️ Erreur enregistrement base de données');
    }
  };

  const handleUpdateProduct = async (updated: Product) => {
    const updatedList = products.map((p) => (p.id === updated.id ? updated : p));
    setProducts(updatedList);
    saveStoredProducts(updatedList);
    showToast(`Modifications enregistrées en base pour "${updated.name}"`);
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
    showToast('Article supprimé de la base de données');
    try {
      await deleteProductFromDb(id);
    } catch (e) {
      console.error('Failed to delete product from Firestore', e);
    }
  };

  const handleAddCategory = async (name: string, icon: string) => {
    const slug = name.toLowerCase().replace(/[^a-z0-9]/g, '');
    const newCat: Category = {
      id: `cat-${Date.now()}`,
      name,
      icon,
      badge: 'NOUVEAU',
      itemCount: 0,
      slug
    };
    setCategories((prev) => [...prev, newCat]);
    showToast(`Catégorie "${name}" créée`);
    try {
      await saveCategoryToDb(newCat);
    } catch (e) {
      console.error('Failed to save category to Firestore', e);
    }
  };

  const handleDeleteCategory = async (id: string) => {
    setCategories((prev) => prev.filter((c) => c.id !== id));
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
    setOrders((prev) =>
      prev.map((o) => (o.id === orderId ? { ...o, status, statusLabel: statusMap[status] } : o))
    );
    showToast(`Statut de la commande mis à jour`);
    try {
      await updateOrderStatusInDb(orderId, status);
    } catch (e) {
      console.error('Failed to update order in Firestore', e);
    }
  };

  const handleUpdateMediaConfig = async (newConfig: SiteMediaConfig) => {
    setMediaConfig(newConfig);
    showToast("✨ Photos et bannières d'accueil enregistrées !");
    try {
      await saveMediaConfigToDb(newConfig);
    } catch (e) {
      console.error('Failed to save media config to Firestore', e);
    }
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
    if (tab === 'baskets') {
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
      if (tab === 'boutique' && shopCategoryFilter !== 'all') {
        // preserve or reset
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
        currentCategorySlug === 'all' || p.category === currentCategorySlug;
      const matchSearch =
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.ref.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.categoryLabel.toLowerCase().includes(searchQuery.toLowerCase());
      return matchCategory && matchSearch;
    })
    .sort((a, b) => {
      if (sortOption === 'price-asc') return a.price - b.price;
      if (sortOption === 'price-desc') return b.price - a.price;
      if (sortOption === 'newest') return (b.badge === 'Nouveau' ? 1 : 0) - (a.badge === 'Nouveau' ? 1 : 0);
      return 0;
    });

  const cartTotalCount = cart.reduce((acc, i) => acc + i.quantity, 0);

  // If in admin mode AND authenticated, show dashboard
  if ((isAdminMode || activeTab === 'admin') && isAdminAuthenticated) {
    return (
      <AdminDashboard
        products={products}
        categories={categories}
        orders={orders}
        leads={leads}
        mediaConfig={mediaConfig}
        onUpdateMediaConfig={handleUpdateMediaConfig}
        onAddProduct={handleAddProduct}
        onUpdateProduct={handleUpdateProduct}
        onDeleteProduct={handleDeleteProduct}
        onAddCategory={handleAddCategory}
        onDeleteCategory={handleDeleteCategory}
        onUpdateOrderStatus={handleUpdateOrderStatus}
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
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-5 right-5 z-50 bg-[#123B2A] text-white px-4 py-3 rounded-xl shadow-xl flex items-center gap-2 border border-[#D8F36A] animate-fade-in text-xs sm:text-sm font-semibold">
          <Check className="w-4 h-4 text-[#D8F36A]" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Main Navbar */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={handleTabChange}
        cartCount={cartTotalCount}
        onOpenCart={() => {
          setActiveTab('panier');
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
        isAdminMode={isAdminMode}
        setIsAdminMode={setIsAdminMode}
      />

      <main className="flex-1">
        {/* VIEW 1: ACCUEIL */}
        {activeTab === 'accueil' && (
          <>
            <Hero
              heroImage={mediaConfig.heroImage}
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
              slides={mediaConfig.carouselSlides}
              onSelectCategory={(cat) => {
                setActiveTab('boutique');
                setShopCategoryFilter(cat);
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
            />

            <CategoryShowcase
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

                {/* Filters & Tools Bar */}
                <div className="bg-[#FAF9F5] border border-[#E1E3DA] rounded-2xl p-4 sm:p-5 mb-8 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
                  {/* Category Filter Chips */}
                  <div className="flex gap-2 overflow-x-auto pb-1 sm:flex-wrap scrollbar-none">
                    <button
                      onClick={() => setShopCategoryFilter('all')}
                      className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                        shopCategoryFilter === 'all'
                          ? 'bg-[#123B2A] text-white shadow-xs'
                          : 'bg-white border border-[#E1E3DA] text-[#123B2A] hover:bg-[#EFEFE6]'
                      }`}
                    >
                      Tous ({products.length})
                    </button>
                    {categories.map((c) => {
                      const count = products.filter((p) => p.category === c.slug).length;
                      return (
                        <button
                          key={c.id}
                          onClick={() => setShopCategoryFilter(c.slug)}
                          className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                            shopCategoryFilter === c.slug
                              ? 'bg-[#123B2A] text-white shadow-xs'
                              : 'bg-white border border-[#E1E3DA] text-[#123B2A] hover:bg-[#EFEFE6]'
                          }`}
                        >
                          {c.icon} {c.name} ({count})
                        </button>
                      );
                    })}
                  </div>

                  {/* Search and Sort */}
                  <div className="flex flex-wrap sm:flex-nowrap items-center gap-3">
                    <div className="relative w-full sm:w-56">
                      <Search className="w-4 h-4 text-[#6B726C] absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        placeholder="Rechercher..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 bg-white border border-[#E1E3DA] rounded-lg text-xs focus:outline-[#1F5A40]"
                      />
                    </div>

                    <select
                      value={sortOption}
                      onChange={(e) => setSortOption(e.target.value)}
                      className="w-full sm:w-auto p-2 bg-white border border-[#E1E3DA] rounded-lg text-xs text-[#123B2A] focus:outline-[#1F5A40]"
                    >
                      <option value="default">Sélection HUIZE</option>
                      <option value="newest">Nouveautés d'abord</option>
                      <option value="price-asc">Prix croissant</option>
                      <option value="price-desc">Prix décroissant</option>
                    </select>
                  </div>
                </div>

                {/* Grid */}
                {catalogFilteredProducts.length === 0 ? (
                  <div className="text-center py-12 bg-[#FAF9F5] rounded-xl border border-[#E1E3DA]">
                    <p className="text-sm font-semibold text-[#6B726C]">Aucun article ne correspond à votre recherche.</p>
                    <button
                      onClick={() => {
                        setSearchQuery('');
                        setShopCategoryFilter('all');
                      }}
                      className="mt-3 text-xs text-[#1F5A40] underline font-bold"
                    >
                      Réinitialiser les filtres
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
                    {catalogFilteredProducts.slice(0, 8).map((product) => (
                      <ProductCard
                        key={product.id}
                        product={product}
                        onOpenDetails={(p) => setModalProduct(p)}
                        onQuickAdd={handleQuickAdd}
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
                  <option value="newest">Nouveautés d'abord</option>
                  <option value="price-asc">Prix croissant</option>
                  <option value="price-desc">Prix décroissant</option>
                </select>
              </div>
            </div>

            {/* Product Grid */}
            {catalogFilteredProducts.length === 0 ? (
              <div className="text-center py-16 bg-white rounded-2xl border border-[#E1E3DA]">
                <p className="text-sm font-semibold text-[#6B726C]">Aucun article disponible pour ce filtre.</p>
                <button
                  onClick={() => {
                    setSearchQuery('');
                    setShopCategoryFilter('all');
                  }}
                  className="mt-3 px-4 py-2 bg-[#123B2A] text-white rounded-full text-xs font-bold"
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
            onOrderPlaced={handleOrderPlaced}
            onContinueShopping={() => {
              setActiveTab('boutique');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
          />
        )}

        {/* VIEW 4: CONTACT */}
        {activeTab === 'contact' && <ContactView />}
      </main>

      {/* Product Detail Modal */}
      <ProductDetailModal
        product={modalProduct}
        onClose={() => setModalProduct(null)}
        onAddToCart={handleAddToCart}
      />

      {/* Footer */}
      <Footer
        onNavigate={handleTabChange}
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
    </div>
  );
}
