import React, { useState, useEffect } from 'react';
import { ArrowRight, ChevronLeft, ChevronRight } from 'lucide-react';
import { CarouselSlide } from '../types.ts';
import { INITIAL_CAROUSEL_SLIDES } from '../data/initialData.ts';

interface AdCarouselProps {
  onSelectCategory: (cat: string) => void;
  slides?: CarouselSlide[];
}

export const AdCarousel: React.FC<AdCarouselProps> = ({ onSelectCategory, slides: propSlides }) => {
  const slides = propSlides && propSlides.length > 0 ? propSlides : INITIAL_CAROUSEL_SLIDES;
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrent((prev) => (prev + 1) % slides.length);
    }, 5500);
    return () => clearInterval(timer);
  }, [slides.length]);

  const slide = slides[current];

  return (
    <section className="py-10 bg-[#FAF9F5] border-y border-[#E1E3DA]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="text-center max-w-xl mx-auto mb-6">
          <p className="text-xs font-extrabold uppercase tracking-widest text-[#1F5A40]">À découvrir</p>
          <h2 className="text-2xl sm:text-3xl font-bold font-title text-[#123B2A] mt-1">
            Publicités et offres du moment
          </h2>
          <p className="text-sm text-[#6B726C] mt-1">
            Retrouve ici nos promotions exclusives, nos nouveautés et notre univers de mode.
          </p>
        </div>

        {/* Carousel Frame */}
        <div className="relative rounded-2xl overflow-hidden bg-[#17212E] shadow-xl text-white">
          <div className="relative min-h-[300px] sm:min-h-[360px] md:min-h-[400px] flex items-center">
            {/* Background Image with Overlay */}
            <img
              src={slide.image}
              alt={slide.title}
              className="absolute inset-0 w-full h-full object-cover object-center brightness-75 scale-102 transition-all duration-700"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/55 to-transparent sm:to-black/30 pointer-events-none" />

            {/* Slide Content */}
            <div className="relative z-10 max-w-lg p-6 sm:p-10 flex flex-col items-start gap-3">
              <span className="text-xs font-extrabold tracking-wider text-[#D8F36A] uppercase bg-black/40 px-2.5 py-1 rounded-md">
                {slide.kicker}
              </span>
              <h3 className="text-2xl sm:text-3xl md:text-4xl font-bold font-title text-white leading-tight">
                {slide.title}
              </h3>
              <p className="text-sm sm:text-base text-white/90 leading-relaxed">
                {slide.desc}
              </p>
              <button
                onClick={() => onSelectCategory(slide.category)}
                className="mt-2 inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#D8F36A] hover:bg-[#C9E755] text-[#123B2A] text-sm font-bold shadow-md active:scale-95 transition-all cursor-pointer"
              >
                <span>{slide.ctaText}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>

            {/* Prev / Next controls */}
            <button
              onClick={() => setCurrent((prev) => (prev - 1 + slides.length) % slides.length)}
              className="absolute left-3 top-1/2 -translate-y-1/2 z-20 w-9 h-9 rounded-full bg-black/50 hover:bg-black/75 text-white flex items-center justify-center cursor-pointer transition-colors"
              aria-label="Diapositive précédente"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              onClick={() => setCurrent((prev) => (prev + 1) % slides.length)}
              className="absolute right-3 top-1/2 -translate-y-1/2 z-20 w-9 h-9 rounded-full bg-black/50 hover:bg-black/75 text-white flex items-center justify-center cursor-pointer transition-colors"
              aria-label="Diapositive suivante"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>

          {/* Carousel Footer */}
          <div className="bg-[#121B24] px-6 py-3 flex items-center justify-between text-xs text-white/70">
            <div className="flex items-center gap-2">
              {slides.map((s, idx) => (
                <button
                  key={s.id}
                  onClick={() => setCurrent(idx)}
                  aria-label={`Aller au slide ${idx + 1}`}
                  className={`h-2.5 rounded-full transition-all cursor-pointer ${
                    current === idx ? 'w-8 bg-[#D8F36A]' : 'w-2.5 bg-white/40 hover:bg-white/60'
                  }`}
                />
              ))}
            </div>
            <span className="hidden sm:inline">Offres valables dans la limite des stocks disponibles à Ouagadougou</span>
          </div>
        </div>
      </div>
    </section>
  );
};
