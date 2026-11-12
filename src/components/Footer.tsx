import React from 'react';
import { MessageCircle } from 'lucide-react';
import { WHATSAPP_DISPLAY, getDirectWhatsAppUrl } from '../utils/whatsapp.ts';

interface FooterProps {
  onNavigate: (tab: string) => void;
  onOpenAdminAuth?: () => void;
  isAdminMode?: boolean;
  setIsAdminMode?: (admin: boolean) => void;
}

export const Footer: React.FC<FooterProps> = ({ onNavigate, onOpenAdminAuth }) => {
  return (
    <footer className="bg-[#123B2A] text-white/90 border-t border-[#1F5A40]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12 lg:py-16">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 lg:gap-12">
          {/* Brand Info */}
          <div className="md:col-span-5 flex flex-col items-start gap-3">
            <span className="font-title text-2xl font-bold tracking-wider text-[#D8F36A]">
              HUIZE SHOP
            </span>
            <p className="font-title italic text-[#D8F36A]/90 text-sm">
              Ton style, ta signature.
            </p>
            <p className="text-xs sm:text-sm text-white/75 leading-relaxed max-w-sm mt-1">
              Boutique en ligne de baskets, sandales et vêtements de qualité au Burkina Faso.
              Articles vérifiés, essayage possible et finalisation personnalisée sur WhatsApp.
            </p>
            <div className="mt-2">
              <a
                href={getDirectWhatsAppUrl()}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#D8F36A] hover:bg-[#c8e750] text-[#123B2A] text-xs font-bold transition-all shadow-xs"
              >
                <MessageCircle className="w-4 h-4 fill-current text-[#123B2A]" />
                <span>WhatsApp : {WHATSAPP_DISPLAY}</span>
              </a>
            </div>
          </div>

          {/* Contact & Location */}
          <div className="md:col-span-3 text-xs sm:text-sm space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-widest text-[#D8F36A] mb-3">
              Contact &amp; Adresse
            </h3>
            <p className="text-white/80">Ouagadougou, Burkina Faso</p>
            <p className="text-white/80">Quartiers desservis : Tous quartiers de Ouaga</p>
            <p className="text-white/80">Expéditions : Bobo-Dioulasso, Koudougou &amp; province</p>
            <p className="text-white/80 pt-1">
              WhatsApp : <strong className="text-white">{WHATSAPP_DISPLAY}</strong>
            </p>
          </div>

          {/* Quick Links */}
          <div className="md:col-span-2 text-xs sm:text-sm space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-widest text-[#D8F36A] mb-3">
              Catégories
            </h3>
            <ul className="space-y-1.5">
              <li>
                <button
                  onClick={() => onNavigate('baskets')}
                  className="hover:text-[#D8F36A] transition-colors cursor-pointer"
                >
                  Baskets &amp; Sneakers
                </button>
              </li>
              <li>
                <button
                  onClick={() => onNavigate('sandales')}
                  className="hover:text-[#D8F36A] transition-colors cursor-pointer"
                >
                  Sandales &amp; Mules
                </button>
              </li>
              <li>
                <button
                  onClick={() => onNavigate('vetements')}
                  className="hover:text-[#D8F36A] transition-colors cursor-pointer"
                >
                  Vêtements &amp; T-shirts
                </button>
              </li>
            </ul>
          </div>

          {/* Shop links */}
          <div className="md:col-span-2 text-xs sm:text-sm space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-widest text-[#D8F36A] mb-3">
              Boutique
            </h3>
            <ul className="space-y-1.5">
              <li>
                <button
                  onClick={() => onNavigate('boutique')}
                  className="hover:text-[#D8F36A] transition-colors cursor-pointer"
                >
                  Tous les articles
                </button>
              </li>
              <li>
                <button
                  onClick={() => onNavigate('contact')}
                  className="hover:text-[#D8F36A] transition-colors cursor-pointer"
                >
                  Nous contacter
                </button>
              </li>
              <li>
                <button
                  onClick={() => onNavigate('panier')}
                  className="hover:text-[#D8F36A] transition-colors cursor-pointer"
                >
                  Mon panier
                </button>
              </li>
            </ul>
          </div>
        </div>

        {/* Copyright & Discreet Merchant Access */}
        <div className="border-t border-white/10 mt-10 pt-6 flex flex-col sm:flex-row items-center justify-between text-xs text-white/60 gap-3">
          <p>© 2025 HUIZE SHOP. Tous droits réservés.</p>
          <p>
            {onOpenAdminAuth ? (
              <button
                type="button"
                onClick={onOpenAdminAuth}
                className="text-inherit font-inherit select-none"
                style={{
                  all: 'unset',
                  cursor: 'pointer',
                  display: 'inline',
                  color: 'inherit',
                  font: 'inherit'
                }}
                title=""
              >
                Boutique
              </button>
            ) : (
              'Boutique'
            )}
            {' '}en ligne Burkina Faso • WhatsApp : {WHATSAPP_DISPLAY}
          </p>
        </div>
      </div>
    </footer>
  );
};
