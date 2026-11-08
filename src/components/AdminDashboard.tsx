import React, { useState } from 'react';
import { Product, Category, WhatsAppOrder, ClientLead } from '../types.ts';
import { formatFCFA, WHATSAPP_DISPLAY } from '../utils/whatsapp.ts';
import {
  LayoutDashboard,
  Package,
  FolderTree,
  Users,
  MessageCircle,
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
  Image as ImageIcon
} from 'lucide-react';

interface AdminDashboardProps {
  products: Product[];
  categories: Category[];
  orders: WhatsAppOrder[];
  leads: ClientLead[];
  onAddProduct: (product: Omit<Product, 'id'>) => void;
  onUpdateProduct: (product: Product) => void;
  onDeleteProduct: (id: string) => void;
  onAddCategory: (name: string, icon: string) => void;
  onDeleteCategory: (id: string) => void;
  onUpdateOrderStatus: (orderId: string, status: WhatsAppOrder['status']) => void;
  onExitAdmin: () => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  products,
  categories,
  orders,
  leads,
  onAddProduct,
  onUpdateProduct,
  onDeleteProduct,
  onAddCategory,
  onDeleteCategory,
  onUpdateOrderStatus,
  onExitAdmin
}) => {
  const [activeSection, setActiveSection] = useState<'dashboard' | 'catalogue' | 'categories' | 'clients' | 'commandes'>('dashboard');

  // Filters
  const [productSearch, setProductSearch] = useState('');
  const [productCategoryFilter, setProductCategoryFilter] = useState('all');

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
  const [formImages, setFormImages] = useState<string[]>(['/src/assets/images/product_velocity_sneakers_1794167661807.jpg']);
  const [isUploadingImage, setIsUploadingImage] = useState(false);

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

  // New Category State
  const [newCatName, setNewCatName] = useState('');
  const [newCatIcon, setNewCatIcon] = useState('🎒');

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
    setFormImages(['/src/assets/images/product_velocity_sneakers_1794167661807.jpg']);
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
    setFormImages(prod.images && prod.images.length ? prod.images : ['/src/assets/images/product_velocity_sneakers_1794167661807.jpg']);
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
    const finalImages = formImages.length > 0 
      ? formImages 
      : ['/src/assets/images/product_velocity_sneakers_1794167661807.jpg'];

    if (editingProduct) {
      onUpdateProduct({
        ...editingProduct,
        name: formName,
        category: formCategory,
        categoryLabel,
        price: parseInt(formPrice, 10) || 0,
        oldPrice: formOldPrice ? parseInt(formOldPrice, 10) : undefined,
        badge: formBadge,
        sizes: sizesArray.length ? sizesArray : ['Standard'],
        stock: parseInt(formStock, 10) || 0,
        ref: formRef,
        description: formDesc,
        images: finalImages
      });
    } else {
      onAddProduct({
        name: formName || 'Nouveau Produit HUIZE',
        category: formCategory,
        categoryLabel,
        price: parseInt(formPrice, 10) || 15000,
        oldPrice: formOldPrice ? parseInt(formOldPrice, 10) : undefined,
        badge: formBadge,
        sizes: sizesArray.length ? sizesArray : ['40', '41', '42'],
        stock: parseInt(formStock, 10) || 5,
        ref: formRef,
        description: formDesc,
        images: finalImages,
        featured: true
      });
    }

    setIsModalOpen(false);
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

  const handleAddCategorySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatName.trim()) return;
    onAddCategory(newCatName.trim(), newCatIcon);
    setNewCatName('');
  };

  // Filter products for the table
  const filteredProducts = products.filter((p) => {
    const matchSearch =
      p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
      p.ref.toLowerCase().includes(productSearch.toLowerCase());
    const matchCat = productCategoryFilter === 'all' || p.category === productCategoryFilter;
    return matchSearch && matchCat;
  });

  // Calculate live dynamic metrics
  const totalStockCount = products.reduce((acc, p) => acc + p.stock, 0);
  const totalOrdersAmount = orders.reduce((acc, o) => acc + o.total, 0);

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
          <div className="truncate">
            <p className="text-xs font-bold text-white truncate">Gestionnaire HUIZE</p>
            <p className="text-[10px] text-white/60">Ouagadougou • {WHATSAPP_DISPLAY}</p>
          </div>
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
          {/* 1. METRICS / STATS GRID */}
          <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-[#E1E3DA] shadow-xs relative overflow-hidden border-l-4 border-l-[#D8F36A]">
              <span className="text-xs font-bold uppercase tracking-wider text-[#6B726C]">Commandes WhatsApp</span>
              <p className="text-2xl sm:text-3xl font-extrabold text-[#123B2A] font-title my-1 tabular-nums">
                142
              </p>
              <span className="text-xs font-semibold text-[#1F5A40] flex items-center gap-1">
                <TrendingUp className="w-3.5 h-3.5" />
                <span>+18% ce mois</span>
              </span>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-[#E1E3DA] shadow-xs relative overflow-hidden border-l-4 border-l-[#1F5A40]">
              <span className="text-xs font-bold uppercase tracking-wider text-[#6B726C]">Chiffre d'Affaires</span>
              <p className="text-xl sm:text-2xl font-extrabold text-[#123B2A] font-title my-1 tabular-nums">
                {formatFCFA(2845000 + totalOrdersAmount)}
              </p>
              <span className="text-xs font-semibold text-[#1F5A40]">
                Orange Money &amp; Moov
              </span>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-[#E1E3DA] shadow-xs relative overflow-hidden border-l-4 border-l-[#123B2A]">
              <span className="text-xs font-bold uppercase tracking-wider text-[#6B726C]">Articles Catalogue</span>
              <p className="text-2xl sm:text-3xl font-extrabold text-[#123B2A] font-title my-1 tabular-nums">
                {products.length}
              </p>
              <span className="text-xs text-[#6B726C]">
                {totalStockCount} unités en stock
              </span>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-[#E1E3DA] shadow-xs relative overflow-hidden border-l-4 border-l-[#25D366]">
              <span className="text-xs font-bold uppercase tracking-wider text-[#6B726C]">Contacts &amp; Prospects</span>
              <p className="text-2xl sm:text-3xl font-extrabold text-[#123B2A] font-title my-1 tabular-nums">
                {89 + leads.length}
              </p>
              <span className="text-xs font-semibold text-[#1F5A40]">
                15 nouveaux cette semaine
              </span>
            </div>
          </section>

          {/* 2. CATALOGUE MANAGEMENT SECTION */}
          {(activeSection === 'dashboard' || activeSection === 'catalogue') && (
            <section className="bg-white border border-[#E1E3DA] rounded-2xl shadow-sm overflow-hidden">
              <div className="p-4 sm:p-5 bg-[#FAF9F5] border-b border-[#E1E3DA] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <h2 className="text-base sm:text-lg font-bold font-title text-[#123B2A]">
                    📦 Gestion des Produits de la Boutique
                  </h2>
                  <span className="text-xs bg-[#EFEFE6] text-[#123B2A] px-2 py-0.5 rounded-full font-bold">
                    {filteredProducts.length} articles
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
                      <th className="p-3.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E1E3DA]">
                    {filteredProducts.map((p) => {
                      const isOutOfStock = p.stock <= 0;
                      const isLowStock = p.stock > 0 && p.stock <= 3;
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

                    <div className="grid grid-cols-3 gap-1.5 pt-1">
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
              <div className="flex items-center justify-between mb-4 border-b border-[#E1E3DA] pb-3">
                <div className="flex items-center gap-2">
                  <h2 className="text-base sm:text-lg font-bold font-title text-[#123B2A]">
                    📁 Gestion des Catégories de la Boutique
                  </h2>
                  <span className="text-xs bg-[#E8F7EE] text-[#1F5A40] font-bold px-2 py-0.5 rounded-full">
                    {categories.length} actives
                  </span>
                </div>
              </div>

              {/* Add category form */}
              <form onSubmit={handleAddCategorySubmit} className="flex flex-wrap gap-2 mb-4 bg-[#FAF9F5] p-3 rounded-xl border border-[#E1E3DA]">
                <input
                  type="text"
                  placeholder="Nom de la nouvelle catégorie..."
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                  className="flex-1 min-w-[200px] p-2 text-xs bg-white border border-[#E1E3DA] rounded-lg"
                />
                <select
                  value={newCatIcon}
                  onChange={(e) => setNewCatIcon(e.target.value)}
                  className="p-2 text-xs bg-white border border-[#E1E3DA] rounded-lg"
                >
                  <option value="👟">👟 Baskets</option>
                  <option value="👡">👡 Sandales</option>
                  <option value="👕">👕 Vêtements</option>
                  <option value="🧢">🧢 Casquettes</option>
                  <option value="👜">👜 Maroquinerie</option>
                  <option value="🕶️">🕶️ Lunettes</option>
                </select>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#123B2A] hover:bg-[#1F5A40] text-white text-xs font-bold rounded-lg cursor-pointer"
                >
                  + Ajouter catégorie
                </button>
              </form>

              {/* Categories list */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {categories.map((cat) => (
                  <div
                    key={cat.id}
                    className="p-3.5 rounded-xl border border-[#E1E3DA] bg-white flex items-center justify-between shadow-xs"
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="w-10 h-10 rounded-lg bg-[#EFEFE6] flex items-center justify-center text-xl">
                        {cat.icon}
                      </span>
                      <div>
                        <p className="font-bold text-sm text-[#123B2A]">{cat.name}</p>
                        <p className="text-[11px] text-[#6B726C]">
                          {products.filter((p) => p.category === cat.slug).length} articles rattachés
                        </p>
                      </div>
                    </div>
                    {categories.length > 1 && (
                      <button
                        onClick={() => {
                          if (confirm(`Supprimer la catégorie "${cat.name}" ?`)) onDeleteCategory(cat.id);
                        }}
                        className="text-red-600 hover:text-red-800 p-1 cursor-pointer"
                        title="Supprimer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ))}
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
                  {leads.map((lead) => (
                    <div key={lead.id} className="py-3 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-[#FAF9F5] border border-[#E1E3DA] text-[#123B2A] font-bold flex items-center justify-center text-xs shrink-0">
                          {lead.avatar}
                        </div>
                        <div>
                          <p className="font-bold text-xs sm:text-sm text-[#123B2A]">{lead.name}</p>
                          <p className="text-[11px] text-[#6B726C]">{lead.city} • {lead.notes}</p>
                        </div>
                      </div>

                      <a
                        href={`https://wa.me/${lead.phone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(
                          `Bonjour ${lead.name}, c'est l'équipe HUIZE SHOP Ouagadougou. Avez-vous des questions sur nos modèles disponibles ?`
                        )}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-[#25D366] hover:bg-[#20ba5a] text-white font-bold text-xs shadow-xs"
                      >
                        <MessageCircle className="w-3.5 h-3.5 fill-current" />
                        <span>Contacter</span>
                      </a>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* LIVE WHATSAPP ORDERS (5/6 Cols) */}
            {(activeSection === 'dashboard' || activeSection === 'commandes') && (
              <div className="lg:col-span-6 bg-white border border-[#E1E3DA] rounded-2xl shadow-sm p-5">
                <div className="flex items-center justify-between mb-4 border-b border-[#E1E3DA] pb-3">
                  <h2 className="text-base font-bold font-title text-[#123B2A] flex items-center gap-2">
                    <MessageCircle className="w-4 h-4 text-[#25D366]" />
                    <span>Dernières Activités WhatsApp</span>
                  </h2>
                  <span className="text-[11px] text-[#1F5A40] font-bold flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-[#25D366]" />
                    <span>En temps réel</span>
                  </span>
                </div>

                <div className="flex flex-col gap-3">
                  {orders.map((ord) => (
                    <div
                      key={ord.id}
                      className="p-3.5 rounded-xl border border-[#E1E3DA] bg-[#FAF9F5] flex items-center justify-between gap-3 text-xs"
                    >
                      <div>
                        <p className="font-bold text-[#123B2A]">{ord.id} • {ord.customerName}</p>
                        <p className="text-[#6B726C] text-[11px]">{ord.itemsSummary}</p>
                        <p className="text-[10px] text-[#1F5A40] mt-0.5">{ord.city} • {ord.date}</p>
                      </div>

                      <div className="text-right shrink-0">
                        <p className="font-bold text-[#123B2A] tabular-nums font-title text-sm">
                          {formatFCFA(ord.total)}
                        </p>
                        <select
                          value={ord.status}
                          onChange={(e) =>
                            onUpdateOrderStatus(ord.id, e.target.value as WhatsAppOrder['status'])
                          }
                          className="mt-1 text-[10px] font-bold p-1 rounded-md bg-white border border-[#E1E3DA]"
                        >
                          <option value="pending">À livrer</option>
                          <option value="paid">Payé (Orange/Moov)</option>
                          <option value="delivered">Livré</option>
                          <option value="discussion">En discussion</option>
                        </select>
                      </div>
                    </div>
                  ))}
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

                {/* Quick Samples & Manual URL Add */}
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
    </div>
  );
};
