import React, { useState, useEffect, useRef } from 'react';
import {
  MessageCircle,
  ArrowRight,
  Sparkles,
  CheckCircle2,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { HERO_IMAGE } from '../data/initialData.ts';
import { getDirectWhatsAppUrl } from '../utils/whatsapp.ts';

interface HeroProps {
  onExploreShop: () => void;
  heroImage?: string;
  heroImages?: string[];
  heroTagline?: string;
  heroTitle?: string;
  heroSubtitle?: string;
}

export const Hero: React.FC<HeroProps> = ({
  onExploreShop,
  heroImage,
  heroImages,
  heroTagline,
  heroTitle,
  heroSubtitle
}) => {
  const imagesList =
    heroImages && heroImages.filter(Boolean).length > 0
      ? heroImages.filter(Boolean)
      : [heroImage || HERO_IMAGE];

  const [currentIdx, setCurrentIdx] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);

  const safeIdx = imagesList.length > 0 ? currentIdx % imagesList.length : 0;

  useEffect(() => {
    if (currentIdx >= imagesList.length && imagesList.length > 0) {
      setCurrentIdx(0);
    }
  }, [imagesList.length, currentIdx]);

  useEffect(() => {
    if (imagesList.length <= 1 || isPaused) return;
    const timer = setInterval(() => {
      setCurrentIdx((prev) => (prev + 1) % imagesList.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [imagesList.length, isPaused]);

  const handlePrev = () => {
    setCurrentIdx((prev) => (prev - 1 + imagesList.length) % imagesList.length);
  };

  const handleNext = () => {
    setCurrentIdx((prev) => (prev + 1) % imagesList.length);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartRef.current = {
      x: e.touches[0].clientX,
      y: e.touches[0].clientY
    };
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!touchStartRef.current || imagesList.length <= 1) {
      touchStartRef.current = null;
      return;
    }
    const diffX = touchStartRef.current.x - e.changedTouches[0].clientX;
    const diffY = touchStartRef.current.y - e.changedTouches[0].clientY;
    if (Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > 35) {
      if (diffX > 0) {
        handleNext();
      } else {
        handlePrev();
      }
    }
    touchStartRef.current = null;
  };

  const handleTouchCancel = () => {
    touchStartRef.current = null;
  };

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
              <span>{heroTagline || 'Ton style, ta signature'}</span>
            </div>

            <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-5xl font-bold font-title text-white leading-tight">
              {heroTitle || (
                <>
                  Affirme ton style avec <span className="text-[#D8F36A]">HUIZE SHOP</span>
                </>
              )}
            </h1>

            <p className="text-base sm:text-lg text-white/90 max-w-xl leading-relaxed">
              {heroSubtitle ||
                'Baskets, sandales et vêtements tendance sélectionnés avec soin pour le quotidien et les grandes occasions au Burkina Faso. Choisis tes articles, puis finalise ta commande directement sur WhatsApp en toute confiance.'}
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

          {/* Right Media Column (Multi-image auto-sliding every 5 seconds) */}
          <div className="lg:col-span-5">
            <div
              className="group relative mx-auto max-w-md lg:max-w-none rounded-2xl overflow-hidden border-2 border-white/20 shadow-2xl aspect-4/5 bg-[#123B2A] touch-pan-y"
              onMouseEnter={() => setIsPaused(true)}
              onMouseLeave={() => setIsPaused(false)}
              onTouchStart={handleTouchStart}
              onTouchEnd={handleTouchEnd}
              onTouchCancel={handleTouchCancel}
            >
              {/* Sliding Track */}
              <div
                className="flex h-full transition-transform duration-700 ease-out will-change-transform"
                style={{ transform: `translateX(-${safeIdx * 100}%)` }}
              >
                {imagesList.map((imgSrc, idx) => (
                  <div key={`${idx}-${imgSrc.slice(0, 32)}`} className="w-full h-full shrink-0">
                    <img
                      src={imgSrc}
                      alt={`Lookbook HUIZE SHOP Ouagadougou ${idx + 1}`}
                      className="w-full h-full object-cover object-top"
                    />
                  </div>
                ))}
              </div>

              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent pointer-events-none" />

              {/* Slide dots & arrows when multiple Hero images are configured */}
              {imagesList.length > 1 && (
                <>
                  <div className="absolute top-3.5 right-3.5 z-20 flex items-center gap-1.5 bg-black/40 backdrop-blur-xs px-2.5 py-1.5 rounded-full">
                    {imagesList.map((_, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setCurrentIdx(idx)}
                        aria-label={`Photo Hero ${idx + 1}`}
                        className={`h-2 rounded-full transition-all cursor-pointer ${
                          safeIdx === idx ? 'w-5 bg-[#D8F36A]' : 'w-2 bg-white/55 hover:bg-white/85'
                        }`}
                      />
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={handlePrev}
                    aria-label="Photo Hero précédente"
                    className="absolute left-2.5 top-1/2 -translate-y-1/2 z-20 w-8 h-8 rounded-full bg-black/45 hover:bg-black/75 text-white flex items-center justify-center opacity-85 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity cursor-pointer"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={handleNext}
                    aria-label="Photo Hero suivante"
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 z-20 w-8 h-8 rounded-full bg-black/45 hover:bg-black/75 text-white flex items-center justify-center opacity-85 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity cursor-pointer"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </>
              )}

              <div className="absolute bottom-4 left-4 right-4 z-20 bg-white/95 backdrop-blur-md p-3.5 rounded-xl border border-white/30 text-[#123B2A] flex items-center justify-between">
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
