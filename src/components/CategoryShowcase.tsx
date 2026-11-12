import React from 'react';
import { VELOCITY_SNEAKER_IMG, SAHEL_SANDAL_IMG, STREET_TSHIRT_IMG } from '../data/initialData.ts';

interface CategoryShowcaseProps {
  onSelectCategory: (category: string) => void;
}

export const CategoryShowcase: React.FC<CategoryShowcaseProps> = ({ onSelectCategory }) => {
  const categories = [
    {
      id: 'chaussures',
      name: 'Baskets',
      badge: 'TOP',
      image: VELOCITY_SNEAKER_IMG,
      badgeColor: 'bg-[#123B2A] text-[#D8F36A]',
      subtitle: 'Sneakers & Street'
    },
    {
      id: 'sandales',
      name: 'Sandales',
      badge: 'CUIR',
      image: SAHEL_SANDAL_IMG,
      badgeColor: 'bg-[#D8F36A] text-[#123B2A]',
      subtitle: 'Artisanal & Sahel'
    },
    {
      id: 'vetements',
      name: 'Vêtements',
      badge: 'MODE',
      image: STREET_TSHIRT_IMG,
      badgeColor: 'bg-[#123B2A] text-[#D8F36A]',
      subtitle: 'T-Shirts & Chemises'
    }
  ];

  return (
    <section className="py-8 sm:py-12 bg-white">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="text-center mb-6 sm:mb-10">
          <h2 className="text-xl sm:text-2xl md:text-3xl font-bold font-title text-[#123B2A] relative inline-block">
            Explore nos catégories
            <span className="block w-12 sm:w-14 h-1 bg-[#D8F36A] rounded-full mx-auto mt-1.5 sm:mt-2" />
          </h2>
          <p className="text-xs sm:text-sm text-[#6B726C] mt-1.5 sm:mt-2 max-w-md mx-auto">
            Trouve rapidement ce que tu cherches parmi nos collections phares adaptées à ton style.
          </p>
        </div>

        {/* Categories container: 3 columns horizontally on Android/mobile, properly sized without vertical stacking */}
        <div className="grid grid-cols-3 gap-2 sm:gap-6 md:gap-10 max-w-4xl mx-auto justify-items-center">
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => onSelectCategory(cat.id)}
              className="group flex flex-col items-center text-center cursor-pointer transition-transform hover:-translate-y-1 focus-visible:outline-none w-full max-w-[160px]"
            >
              {/* Responsive circular thumbnail: compact on Android, spacious on desktop */}
              <div className="relative w-20 h-20 sm:w-32 sm:h-32 md:w-44 md:h-44 rounded-full overflow-hidden border-2 sm:border-4 border-white shadow-md sm:shadow-xl bg-[#F8F7F2] flex items-center justify-center p-1 sm:p-2 group-hover:shadow-2xl transition-shadow ring-1 ring-[#E1E3DA]">
                <img
                  src={cat.image}
                  alt={cat.name}
                  className="w-full h-full object-cover rounded-full group-hover:scale-105 transition-transform duration-500"
                />
                <span
                  className={`absolute top-1 right-1 sm:top-2.5 sm:right-2.5 text-[8px] sm:text-[10px] md:text-[11px] font-extrabold px-1.5 py-0.5 sm:px-2.5 sm:py-0.5 rounded-full border border-white sm:border-2 shadow-xs uppercase tracking-wider ${cat.badgeColor}`}
                >
                  {cat.badge}
                </span>
              </div>

              <h3 className="text-xs sm:text-base md:text-xl font-bold font-title text-[#123B2A] mt-2 sm:mt-3 mb-0.5 group-hover:text-[#1F5A40] truncate max-w-full">
                {cat.name}
              </h3>
              <p className="hidden sm:block text-[11px] text-[#6B726C] mb-1">
                {cat.subtitle}
              </p>
              <span className="text-[10px] sm:text-xs font-bold text-[#1F5A40] tracking-wider uppercase group-hover:underline flex items-center gap-0.5">
                Explorer →
              </span>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
};
