import React, { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Pause, Play, ImageOff } from 'lucide-react';
import { Product } from '../types.ts';

interface AdCarouselProps {
  products: Product[];
  onOpenProduct: (product: Product) => void;
}

export const AdCarousel: React.FC<AdCarouselProps> = ({ products, onOpenProduct }) => {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [isPaused, setIsPaused] = useState(false);
  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({});
  const isInteractingRef = useRef(false);
  const isMouseDraggingRef = useRef(false);
  const dragStartXRef = useRef(0);
  const dragStartScrollLeftRef = useRef(0);
  const pointerDownPosRef = useRef<{ x: number; y: number } | null>(null);
  const resumeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const productsWithPhotos = (products || []).filter(
    (p) => Array.isArray(p.images) && p.images.length > 0 && Boolean(p.images[0])
  );

  const visibleProducts = productsWithPhotos.length > 0 ? productsWithPhotos : products || [];
  // Keep at least 3 repetitions so touch swipe works infinitely in both directions
  const repeatCount = visibleProducts.length === 0 ? 1 : visibleProducts.length < 6 ? 4 : 3;
  const loopProducts = Array.from({ length: repeatCount }, () => visibleProducts).flat();

  // Start in the middle set so users can swipe left OR right immediately
  useEffect(() => {
    const container = scrollRef.current;
    if (!container || visibleProducts.length === 0 || repeatCount < 3) return;
    const singleSetWidth = container.scrollWidth / repeatCount;
    if (singleSetWidth > 0 && container.scrollLeft < singleSetWidth * 0.25) {
      container.scrollLeft = singleSetWidth;
    }
  }, [repeatCount, visibleProducts.length]);

  useEffect(() => {
    const container = scrollRef.current;
    if (!container || visibleProducts.length === 0) return;

    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) return;

    let animId: number;
    let exactScrollLeft = container.scrollLeft;
    let wasInteracting = false;

    const tick = () => {
      const interacting = isInteractingRef.current || isMouseDraggingRef.current;

      if (!isPaused && !interacting && container) {
        const singleSetWidth = container.scrollWidth / repeatCount;
        if (singleSetWidth > 0) {
          if (wasInteracting || Math.abs(exactScrollLeft - container.scrollLeft) > 2) {
            exactScrollLeft = container.scrollLeft;
          }
          exactScrollLeft += 0.65;
          if (exactScrollLeft >= singleSetWidth * 2) {
            exactScrollLeft -= singleSetWidth;
          }
          container.scrollLeft = exactScrollLeft;
        }
      } else if (container) {
        exactScrollLeft = container.scrollLeft;
      }

      wasInteracting = interacting;
      animId = requestAnimationFrame(tick);
    };

    animId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animId);
  }, [isPaused, repeatCount, visibleProducts.length]);

  useEffect(() => {
    return () => {
      if (resumeTimerRef.current) clearTimeout(resumeTimerRef.current);
    };
  }, []);

  if (visibleProducts.length === 0) return null;

  const scheduleResume = (delay = 1600) => {
    if (resumeTimerRef.current) clearTimeout(resumeTimerRef.current);
    resumeTimerRef.current = setTimeout(() => {
      isInteractingRef.current = false;
    }, delay);
  };

  const handleManualScroll = (direction: 'left' | 'right') => {
    const container = scrollRef.current;
    if (!container) return;
    isInteractingRef.current = true;
    const step = 280;
    container.scrollBy({
      left: direction === 'left' ? -step : step,
      behavior: 'smooth'
    });
    scheduleResume(900);
  };

  const handleTouchStart = () => {
    isInteractingRef.current = true;
    if (resumeTimerRef.current) clearTimeout(resumeTimerRef.current);
  };

  const handleTouchEnd = () => {
    scheduleResume(1600);
  };

  // Keep infinite wrap active during manual touch/trackpad scroll in either direction
  const handleScrollWrap = () => {
    const container = scrollRef.current;
    if (!container || repeatCount < 3) return;
    const singleSetWidth = container.scrollWidth / repeatCount;
    if (singleSetWidth <= 0) return;

    if (container.scrollLeft < singleSetWidth * 0.35) {
      container.scrollLeft += singleSetWidth;
    } else if (container.scrollLeft >= singleSetWidth * (repeatCount - 0.85)) {
      container.scrollLeft -= singleSetWidth;
    }
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    const container = scrollRef.current;
    if (!container) return;
    isMouseDraggingRef.current = true;
    isInteractingRef.current = true;
    dragStartXRef.current = e.clientX;
    dragStartScrollLeftRef.current = container.scrollLeft;
    if (resumeTimerRef.current) clearTimeout(resumeTimerRef.current);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isMouseDraggingRef.current) return;
    const container = scrollRef.current;
    if (!container) return;
    const dx = e.clientX - dragStartXRef.current;
    container.scrollLeft = dragStartScrollLeftRef.current - dx;
  };

  const handleMouseUpOrLeave = () => {
    if (isMouseDraggingRef.current) {
      isMouseDraggingRef.current = false;
      scheduleResume(1200);
    }
  };

  return (
    <section
      aria-label="Galerie défilante des produits"
      className="py-10 bg-[#FAF9F5] border-b border-[#E1E3DA]"
    >
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-[#1F5A40]">
              Vitrine en mouvement
            </p>
            <h2 className="text-2xl sm:text-3xl font-bold font-title text-[#123B2A] mt-0.5">
              Les articles de la boutique
            </h2>
            <p className="text-xs sm:text-sm text-[#6B726C] mt-1">
              Glissez horizontalement au doigt et touchez une photo pour afficher ses informations complètes.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => handleManualScroll('left')}
              aria-label="Défiler vers la gauche"
              className="w-10 h-10 rounded-full bg-white hover:bg-[#EFEFE6] border border-[#E1E3DA] text-[#123B2A] flex items-center justify-center shadow-xs cursor-pointer transition-colors focus-visible:outline-2 focus-visible:outline-[#1F5A40]"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setIsPaused((p) => !p)}
              aria-label={isPaused ? 'Reprendre le défilement' : 'Mettre en pause'}
              className="inline-flex items-center gap-1.5 px-4 h-10 rounded-full bg-white hover:bg-[#EFEFE6] border border-[#E1E3DA] text-[#123B2A] text-xs font-semibold shadow-xs cursor-pointer transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-[#1F5A40]"
            >
              {isPaused ? (
                <>
                  <Play className="w-3.5 h-3.5" />
                  <span>Défiler</span>
                </>
              ) : (
                <>
                  <Pause className="w-3.5 h-3.5" />
                  <span>Pause</span>
                </>
              )}
            </button>
            <button
              type="button"
              onClick={() => handleManualScroll('right')}
              aria-label="Défiler vers la droite"
              className="w-10 h-10 rounded-full bg-white hover:bg-[#EFEFE6] border border-[#E1E3DA] text-[#123B2A] flex items-center justify-center shadow-xs cursor-pointer transition-colors focus-visible:outline-2 focus-visible:outline-[#1F5A40]"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Continuous Horizontal Strip Showing Only Product Photos (Touch & Drag Friendly) */}
        <div
          ref={scrollRef}
          onScroll={handleScrollWrap}
          onMouseEnter={() => setIsPaused(true)}
          onMouseLeave={() => {
            setIsPaused(false);
            handleMouseUpOrLeave();
          }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUpOrLeave}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          onTouchCancel={handleTouchEnd}
          className="flex gap-4 overflow-x-auto scrollbar-none pb-2 select-none touch-pan-x cursor-grab active:cursor-grabbing"
        >
          {loopProducts.map((product, idx) => {
            const imgSrc = product.images?.[0] || '';
            const isBroken = !imgSrc || failedImages[product.id];

            return (
              <button
                key={`${product.id}-${idx}`}
                type="button"
                aria-label={`Voir les informations de ${product.name}`}
                onPointerDown={(e) => {
                  pointerDownPosRef.current = { x: e.clientX, y: e.clientY };
                }}
                onClick={(e) => {
                  if (pointerDownPosRef.current) {
                    const dx = Math.abs(e.clientX - pointerDownPosRef.current.x);
                    const dy = Math.abs(e.clientY - pointerDownPosRef.current.y);
                    if (dx > 10 || dy > 10) return;
                  }
                  onOpenProduct(product);
                }}
                className="group relative w-44 h-44 sm:w-52 sm:h-52 md:w-56 md:h-56 shrink-0 rounded-2xl overflow-hidden bg-[#EFEFE6] border border-[#E1E3DA] shadow-xs hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 cursor-pointer focus-visible:outline-2 focus-visible:outline-[#1F5A40]"
              >
                {isBroken ? (
                  <div className="w-full h-full flex flex-col items-center justify-center bg-linear-to-br from-[#EFEFE6] to-[#E1E3DA] text-[#6B726C] p-4">
                    <ImageOff className="w-7 h-7 opacity-60" />
                  </div>
                ) : (
                  <img
                    src={imgSrc}
                    alt={product.name}
                    referrerPolicy="no-referrer"
                    draggable={false}
                    onError={() =>
                      setFailedImages((prev) => ({ ...prev, [product.id]: true }))
                    }
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
};
