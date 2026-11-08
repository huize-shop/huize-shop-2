import React, { useState } from 'react';
import { ShoppingBag, MessageCircle, Menu, X, ShieldCheck } from 'lucide-react';
import { WHATSAPP_DISPLAY, getDirectWhatsAppUrl } from '../utils/whatsapp.ts';

interface NavbarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  cartCount: number;
  onOpenCart: () => void;
  isAdminMode: boolean;
  setIsAdminMode: (admin: boolean) => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  cartCount,
  onOpenCart,
  isAdminMode,
  setIsAdminMode
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleNavClick = (tab: string) => {
    setActiveTab(tab);
    setMobileMenuOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <header className="sticky top-0 z-40 bg-white border-b border-[#E1E3DA] shadow-xs">
      {/* Top Banner Notice for WhatsApp Direct Ordering */}
      <div className="bg-[#123B2A] text-white text-xs py-1.5 px-4 text-center">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-4">
          <p className="truncate mx-auto">
            🇧🇫 HUIZE SHOP Ouagadougou • Commandes directes &amp; assistance personnalisée sur WhatsApp :{' '}
            <strong className="text-[#D8F36A] font-bold">{WHATSAPP_DISPLAY}</strong>
          </p>
          <button
            onClick={() => setIsAdminMode(!isAdminMode)}
            className="hidden sm:inline-flex items-center gap-1.5 text-[11px] bg-white/10 hover:bg-white/20 text-[#D8F36A] px-2.5 py-0.5 rounded-full transition-colors shrink-0"
            title="Basculer vers le tableau de bord administrateur"
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>{isAdminMode ? 'Mode Boutique' : 'Espace Admin'}</span>
          </button>
        </div>
      </div>

      {/* Main Header 3-Zone Contract */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-6">
        {/* Zone 1: Brand Wordmark */}
        <button
          onClick={() => handleNavClick('accueil')}
          className="flex items-center gap-2 group text-left shrink-0 cursor-pointer"
        >
          <span className="bg-[#123B2A] text-[#D8F36A] px-3 py-1 rounded-md font-bold text-lg sm:text-xl tracking-wider font-title group-hover:bg-[#1F5A40] transition-colors shadow-xs">
            HUIZE SHOP
          </span>
        </button>

        {/* Zone 2: Navigation Links (single line, clean unboxed) */}
        <nav className="hidden lg:flex items-center gap-1 xl:gap-2">
          <button
            onClick={() => handleNavClick('accueil')}
            className={`px-3 py-1.5 text-sm font-medium transition-colors whitespace-nowrap cursor-pointer rounded-md ${
              activeTab === 'accueil'
                ? 'text-[#123B2A] font-bold border-b-2 border-[#123B2A]'
                : 'text-[#202720] hover:text-[#1F5A40] hover:bg-[#EFEFE6]'
            }`}
          >
            Accueil
          </button>
          <button
            onClick={() => handleNavClick('boutique')}
            className={`px-3 py-1.5 text-sm font-medium transition-colors whitespace-nowrap cursor-pointer rounded-md ${
              activeTab === 'boutique'
                ? 'text-[#123B2A] font-bold border-b-2 border-[#123B2A]'
                : 'text-[#202720] hover:text-[#1F5A40] hover:bg-[#EFEFE6]'
            }`}
          >
            Boutique
          </button>
          <button
            onClick={() => handleNavClick('baskets')}
            className={`px-3 py-1.5 text-sm font-medium transition-colors whitespace-nowrap cursor-pointer rounded-md ${
              activeTab === 'baskets'
                ? 'text-[#123B2A] font-bold border-b-2 border-[#123B2A]'
                : 'text-[#202720] hover:text-[#1F5A40] hover:bg-[#EFEFE6]'
            }`}
          >
            Baskets
          </button>
          <button
            onClick={() => handleNavClick('sandales')}
            className={`px-3 py-1.5 text-sm font-medium transition-colors whitespace-nowrap cursor-pointer rounded-md ${
              activeTab === 'sandales'
                ? 'text-[#123B2A] font-bold border-b-2 border-[#123B2A]'
                : 'text-[#202720] hover:text-[#1F5A40] hover:bg-[#EFEFE6]'
            }`}
          >
            Sandales
          </button>
          <button
            onClick={() => handleNavClick('vetements')}
            className={`px-3 py-1.5 text-sm font-medium transition-colors whitespace-nowrap cursor-pointer rounded-md ${
              activeTab === 'vetements'
                ? 'text-[#123B2A] font-bold border-b-2 border-[#123B2A]'
                : 'text-[#202720] hover:text-[#1F5A40] hover:bg-[#EFEFE6]'
            }`}
          >
            Vêtements
          </button>
          <button
            onClick={() => handleNavClick('contact')}
            className={`px-3 py-1.5 text-sm font-medium transition-colors whitespace-nowrap cursor-pointer rounded-md ${
              activeTab === 'contact'
                ? 'text-[#123B2A] font-bold border-b-2 border-[#123B2A]'
                : 'text-[#202720] hover:text-[#1F5A40] hover:bg-[#EFEFE6]'
            }`}
          >
            Contact
          </button>
          <button
            onClick={() => handleNavClick('admin')}
            className={`px-2.5 py-1 text-xs font-semibold rounded-full transition-colors whitespace-nowrap cursor-pointer flex items-center gap-1 ${
              activeTab === 'admin' || isAdminMode
                ? 'bg-[#123B2A] text-[#D8F36A]'
                : 'bg-[#EFEFE6] text-[#123B2A] hover:bg-[#123B2A] hover:text-[#D8F36A]'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Admin</span>
          </button>
        </nav>

        {/* Zone 3: Primary Action & Cart */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
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
        <div className="lg:hidden bg-white border-b border-[#E1E3DA] px-4 py-4 animate-fade-in shadow-md">
          <div className="flex flex-col gap-2">
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
            <button
              onClick={() => handleNavClick('baskets')}
              className="text-left px-3 py-2 rounded-md font-medium text-sm text-[#202720] hover:bg-[#F8F7F2]"
            >
              👟 Baskets &amp; Sneakers
            </button>
            <button
              onClick={() => handleNavClick('sandales')}
              className="text-left px-3 py-2 rounded-md font-medium text-sm text-[#202720] hover:bg-[#F8F7F2]"
            >
              👡 Sandales &amp; Mules
            </button>
            <button
              onClick={() => handleNavClick('vetements')}
              className="text-left px-3 py-2 rounded-md font-medium text-sm text-[#202720] hover:bg-[#F8F7F2]"
            >
              👕 Vêtements &amp; T-shirts
            </button>
            <button
              onClick={() => handleNavClick('contact')}
              className="text-left px-3 py-2 rounded-md font-medium text-sm text-[#202720] hover:bg-[#F8F7F2]"
            >
              📍 Contact &amp; Localisation Ouaga
            </button>
            <div className="border-t border-[#E1E3DA] pt-2 mt-1">
              <button
                onClick={() => handleNavClick('admin')}
                className="w-full text-left px-3 py-2 rounded-md font-semibold text-sm bg-[#123B2A] text-[#D8F36A] flex items-center justify-between"
              >
                <span>⚙️ Tableau de bord Administrateur</span>
                <span className="text-xs bg-[#D8F36A] text-[#123B2A] px-2 py-0.5 rounded-full font-bold">Admin</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
};
