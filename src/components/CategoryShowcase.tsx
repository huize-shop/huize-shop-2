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
    <section className="py-12 bg-white">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="text-center mb-10">
          <h2 className="text-2xl sm:text-3xl font-bold font-title text-[#123B2A] relative inline-block">
            Explore nos catégories
            <span className="block w-14 h-1 bg-[#D8F36A] rounded-full mx-auto mt-2" />
          </h2>
          <p className="text-sm text-[#6B726C] mt-2 max-w-md mx-auto">
            Trouve rapidement ce que tu cherches parmi nos collections phares adaptées à ton style.
          </p>
        </div>

        <div className="flex flex-wrap justify-center items-center gap-8 sm:gap-12 max-w-4xl mx-auto">
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => onSelectCategory(cat.id)}
              className="group flex flex-col items-center text-center cursor-pointer transition-transform hover:-translate-y-1.5 focus-visible:outline-none"
            >
              <div className="relative w-44 h-44 sm:w-48 sm:h-48 rounded-full overflow-hidden border-4 border-white shadow-xl bg-[#F8F7F2] flex items-center justify-center p-2 group-hover:shadow-2xl transition-shadow ring-1 ring-[#E1E3DA]">
                <img
                  src={cat.image}
                  alt={cat.name}
                  className="w-full h-full object-cover rounded-full group-hover:scale-105 transition-transform duration-500"
                />
                <span
                  className={`absolute top-3 right-3 text-[11px] font-extrabold px-2.5 py-0.5 rounded-full border-2 border-white shadow-md uppercase tracking-wider ${cat.badgeColor}`}
                >
                  {cat.badge}
                </span>
              </div>

              <h3 className="text-lg sm:text-xl font-bold font-title text-[#123B2A] mt-4 mb-0.5 group-hover:text-[#1F5A40]">
                {cat.name}
              </h3>
              <span className="text-xs font-bold text-[#1F5A40] tracking-wider uppercase group-hover:underline">
                Explorer →
              </span>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
};
