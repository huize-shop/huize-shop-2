import React, { useState } from 'react';
import { ShoppingBag, MessageCircle, Menu, X, Heart } from 'lucide-react';
import { Category } from '../types.ts';
import { WHATSAPP_DISPLAY, getDirectWhatsAppUrl } from '../utils/whatsapp.ts';
import { PWAInstallButton } from './PWAInstallButton.tsx';

interface NavbarProps {
  activeTab: string;
  activeCategorySlug?: string;
  setActiveTab: (tab: string) => void;
  categories: Category[];
  cartCount: number;
  onOpenCart: () => void;
  likedCount?: number;
  onOpenFavorites?: () => void;
  logoUrl?: string;
  isAdminMode?: boolean;
  setIsAdminMode?: (admin: boolean) => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  activeCategorySlug = 'all',
  setActiveTab,
  categories,
  cartCount,
  onOpenCart,
  likedCount = 0,
  onOpenFavorites,
  logoUrl
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleNavClick = (tab: string) => {
    setActiveTab(tab);
    setMobileMenuOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Keep desktop top bar crisp and single-line (max 3 featured categories)
  const desktopCategories = categories.slice(0, 3);
  const isBoutiqueAllActive =
    activeTab === 'boutique' && (activeCategorySlug === 'all' || !activeCategorySlug);

  return (
    <header className="sticky top-0 z-40 bg-white border-b border-[#E1E3DA] shadow-xs">
      {/* Top Banner Notice for WhatsApp Direct Ordering */}
      <div className="bg-[#123B2A] text-white text-xs py-1.5 px-4 text-center">
        <p className="truncate max-w-6xl mx-auto">
          🇧🇫 HUIZE SHOP Ouagadougou • Commandes directes &amp; assistance personnalisée sur WhatsApp :{' '}
          <strong className="text-[#D8F36A] font-bold">{WHATSAPP_DISPLAY}</strong>
        </p>
      </div>

      {/* Main Header 3-Zone Contract */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-6">
        {/* Zone 1: Brand Wordmark / Logo */}
        <button
          onClick={() => handleNavClick('accueil')}
          className="flex items-center gap-2.5 group text-left shrink-0 cursor-pointer"
        >
          {logoUrl ? (
            <img
              src={logoUrl}
              alt="HUIZE SHOP"
              className="h-10 sm:h-11 max-w-[160px] object-contain rounded-md transition-transform group-hover:scale-105"
            />
          ) : (
            <span className="bg-[#123B2A] text-[#D8F36A] px-3 py-1 rounded-md font-bold text-lg sm:text-xl tracking-wider font-title group-hover:bg-[#1F5A40] transition-colors shadow-xs">
              HUIZE SHOP
            </span>
          )}
        </button>

        {/* Zone 2: Navigation Links (single line, clean unboxed) */}
        <nav className="hidden lg:flex items-center gap-1 xl:gap-2">
          <button
            onClick={() => handleNavClick('accueil')}
            className={`px-3 py-1.5 text-sm font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer rounded-md ${
              activeTab === 'accueil'
                ? 'text-[#123B2A] font-bold border-b-2 border-[#123B2A]'
                : 'text-[#202720] hover:text-[#1F5A40] hover:bg-[#EFEFE6]'
            }`}
          >
            Accueil
          </button>
          <button
            onClick={() => handleNavClick('boutique')}
            className={`px-3 py-1.5 text-sm font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer rounded-md ${
              isBoutiqueAllActive
                ? 'text-[#123B2A] font-bold border-b-2 border-[#123B2A]'
                : 'text-[#202720] hover:text-[#1F5A40] hover:bg-[#EFEFE6]'
            }`}
          >
            Boutique
          </button>
          {desktopCategories.map((cat) => {
            const isActive = activeTab === 'boutique' && activeCategorySlug === cat.slug;
            return (
              <button
                key={cat.id}
                onClick={() => handleNavClick(`cat:${cat.slug}`)}
                className={`px-3 py-1.5 text-sm font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer rounded-md ${
                  isActive
                    ? 'text-[#123B2A] font-bold border-b-2 border-[#123B2A]'
                    : 'text-[#202720] hover:text-[#1F5A40] hover:bg-[#EFEFE6]'
                }`}
              >
                {cat.name}
              </button>
            );
          })}
          <button
            onClick={() => handleNavClick('apropos')}
            className={`px-3 py-1.5 text-sm font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer rounded-md ${
              activeTab === 'apropos'
                ? 'text-[#123B2A] font-bold border-b-2 border-[#123B2A]'
                : 'text-[#202720] hover:text-[#1F5A40] hover:bg-[#EFEFE6]'
            }`}
          >
            À propos
          </button>
          <button
            onClick={() => handleNavClick('contact')}
            className={`px-3 py-1.5 text-sm font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer rounded-md ${
              activeTab === 'contact'
                ? 'text-[#123B2A] font-bold border-b-2 border-[#123B2A]'
                : 'text-[#202720] hover:text-[#1F5A40] hover:bg-[#EFEFE6]'
            }`}
          >
            Contact
          </button>
        </nav>

        {/* Zone 3: Primary Action, Favorites & Cart */}
        <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
          <PWAInstallButton variant="navbar" />

          {onOpenFavorites && (
            <button
              onClick={onOpenFavorites}
              aria-label="Voir mes coups de cœur"
              title="Mes coups de cœur"
              className="relative p-2 rounded-full hover:bg-[#EFEFE6] text-[#123B2A] transition-colors cursor-pointer"
            >
              <Heart
                className={`w-5 h-5 transition-transform active:scale-125 ${
                  likedCount > 0 ? 'text-red-500 fill-red-500' : 'text-[#123B2A]'
                }`}
              />
              {likedCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 text-[10px] font-bold rounded-full bg-red-500 text-white flex items-center justify-center shadow-xs">
                  {likedCount}
                </span>
              )}
            </button>
          )}

          <a
            href={getDirectWhatsAppUrl()}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-2 sm:px-4 sm:py-2 rounded-full bg-[#D8F36A] hover:bg-[#C8E750] text-[#123B2A] text-xs sm:text-sm font-bold shadow-xs transition-transform active:scale-95 whitespace-nowrap"
          >
            <MessageCircle className="w-4 h-4 fill-current text-[#123B2A]" />
            <span className="hidden sm:inline">WhatsApp</span>
            <span className="sm:hidden">Chat</span>
          </a>

          <button
            onClick={onOpenCart}
            aria-label="Voir le panier"
            className="relative inline-flex items-center gap-1.5 px-3 py-2 sm:px-4 sm:py-2 rounded-full bg-[#123B2A] hover:bg-[#1F5A40] text-white text-xs sm:text-sm font-semibold transition-all cursor-pointer shadow-xs active:scale-95"
          >
            <ShoppingBag className="w-4 h-4" />
            <span className="hidden sm:inline">Panier</span>
            {cartCount > 0 && (
              <span className="inline-flex items-center justify-center min-w-5 h-5 px-1.5 text-xs font-bold rounded-full bg-[#D8F36A] text-[#123B2A]">
                {cartCount}
              </span>
            )}
          </button>

          {/* Mobile menu toggle */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="lg:hidden p-2 text-[#123B2A] hover:bg-[#EFEFE6] rounded-md"
            aria-label="Ouvrir le menu"
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer Menu */}
      {mobileMenuOpen && (
        <div className="lg:hidden bg-white border-b border-[#E1E3DA] px-4 py-4 animate-fade-in shadow-md max-h-[80vh] overflow-y-auto">
          <div className="flex flex-col gap-2">
            {onOpenFavorites && (
              <button
                onClick={() => {
                  onOpenFavorites();
                  setMobileMenuOpen(false);
                }}
                className="text-left px-3 py-2 rounded-md font-medium text-sm text-[#202720] hover:bg-[#F8F7F2] flex items-center justify-between"
              >
                <span className="flex items-center gap-2">
                  <Heart className="w-4 h-4 text-red-500 fill-red-500" />
                  <span>Mes Coups de cœur</span>
                </span>
                {likedCount > 0 && (
                  <span className="text-xs font-bold px-2 py-0.5 bg-red-100 text-red-600 rounded-full">
                    {likedCount}
                  </span>
                )}
              </button>
            )}
            <button
              onClick={() => handleNavClick('accueil')}
              className="text-left px-3 py-2 rounded-md font-medium text-sm text-[#202720] hover:bg-[#F8F7F2]"
            >
              Accueil
            </button>
            <button
              onClick={() => handleNavClick('boutique')}
              className="text-left px-3 py-2 rounded-md font-medium text-sm text-[#202720] hover:bg-[#F8F7F2]"
            >
              Boutique complète
            </button>
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => handleNavClick(`cat:${cat.slug}`)}
                className="text-left px-3 py-2 rounded-md font-medium text-sm text-[#202720] hover:bg-[#F8F7F2]"
              >
                {cat.icon ? `${cat.icon} ` : ''}{cat.name}
              </button>
            ))}
            <button
              onClick={() => handleNavClick('apropos')}
              className="text-left px-3 py-2 rounded-md font-medium text-sm text-[#202720] hover:bg-[#F8F7F2]"
            >
              🤝 À propos &amp; Fournisseurs
            </button>
            <button
              onClick={() => handleNavClick('contact')}
              className="text-left px-3 py-2 rounded-md font-medium text-sm text-[#202720] hover:bg-[#F8F7F2]"
            >
              📍 Contact &amp; Localisation Ouaga
            </button>
            <PWAInstallButton variant="drawer" onActionDone={() => setMobileMenuOpen(false)} />
          </div>
        </div>
      )}
    </header>
  );
};
