import React from 'react';
import { MessageCircle, ArrowRight, Sparkles, CheckCircle2 } from 'lucide-react';
import { HERO_IMAGE } from '../data/initialData.ts';
import { getDirectWhatsAppUrl } from '../utils/whatsapp.ts';

interface HeroProps {
  onExploreShop: () => void;
}

export const Hero: React.FC<HeroProps> = ({ onExploreShop }) => {
  return (
    <section className="relative overflow-hidden bg-radial from-[#1F5A40] via-[#123B2A] to-[#0A2318] text-white py-12 md:py-20">
      {/* Decorative ambient glow */}
      <div className="absolute top-0 right-0 -translate-y-12 translate-x-12 w-96 h-96 bg-[#D8F36A]/10 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
          {/* Left Text Column */}
          <div className="lg:col-span-7 flex flex-col items-start gap-5">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#D8F36A] text-[#123B2A] text-xs font-extrabold uppercase tracking-wider">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Ton style, ta signature</span>
            </div>

            <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-5xl font-bold font-title text-white leading-tight">
              Affirme ton style avec <span className="text-[#D8F36A]">HUIZE SHOP</span>
            </h1>

            <p className="text-base sm:text-lg text-white/90 max-w-xl leading-relaxed">
              Baskets, sandales et vêtements tendance sélectionnés avec soin pour le quotidien et les grandes occasions
              au Burkina Faso. Choisis tes articles, puis finalise ta commande directement sur WhatsApp en toute confiance.
            </p>

            {/* CTAs */}
            <div className="flex flex-wrap items-center gap-3 pt-2 w-full sm:w-auto">
              <button
                onClick={onExploreShop}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-full bg-white text-[#123B2A] font-bold text-sm sm:text-base hover:bg-[#F8F7F2] transition-all shadow-md active:scale-95 cursor-pointer"
              >
                <span>Découvrir la boutique</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              <a
                href={getDirectWhatsAppUrl('Bonjour HUIZE SHOP, je souhaite passer une commande et voir vos nouveautés.')}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-full bg-[#D8F36A] hover:bg-[#c9e755] text-[#123B2A] font-extrabold text-sm sm:text-base transition-all shadow-md active:scale-95"
              >
                <MessageCircle className="w-5 h-5 fill-[#123B2A]" />
                <span>Commander sur WhatsApp</span>
              </a>
            </div>

            {/* Quick trust points */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-4 border-t border-white/10 w-full text-xs text-white/80">
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-[#D8F36A] shrink-0" />
                <span>Prix réels en F CFA</span>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-[#D8F36A] shrink-0" />
                <span>Livraison Ouaga &amp; Province</span>
              </div>
              <div className="flex items-center gap-1.5 col-span-2 sm:col-span-1">
                <CheckCircle2 className="w-4 h-4 text-[#D8F36A] shrink-0" />
                <span>Orange &amp; Moov Money</span>
              </div>
            </div>
          </div>

          {/* Right Media Column */}
          <div className="lg:col-span-5">
            <div className="relative mx-auto max-w-md lg:max-w-none rounded-2xl overflow-hidden border-2 border-white/20 shadow-2xl aspect-4/5 bg-[#123B2A]">
              <img
                src={HERO_IMAGE}
                alt="Lookbook Streetwear HUIZE SHOP Ouagadougou"
                className="w-full h-full object-cover object-top hover:scale-102 transition-transform duration-700"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent pointer-events-none" />

              <div className="absolute bottom-4 left-4 right-4 bg-white/95 backdrop-blur-md p-3.5 rounded-xl border border-white/30 text-[#123B2A] flex items-center justify-between">
                <div>
                  <p className="text-[11px] uppercase tracking-wider font-extrabold text-[#1F5A40]">Collection Urbaine</p>
                  <p className="text-sm font-bold font-title">Sneakers &amp; Mode Ouaga 2025</p>
                </div>
                <button
                  onClick={onExploreShop}
                  className="px-3 py-1.5 bg-[#123B2A] text-[#D8F36A] rounded-lg text-xs font-bold hover:bg-[#1F5A40] transition-colors cursor-pointer"
                >
                  Voir
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
