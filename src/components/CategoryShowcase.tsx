import React, { useState } from 'react';
import { Category, Product } from '../types.ts';
import { VELOCITY_SNEAKER_IMG, SAHEL_SANDAL_IMG, STREET_TSHIRT_IMG } from '../data/initialData.ts';

interface CategoryShowcaseProps {
  categories: Category[];
  products: Product[];
  onSelectCategory: (categorySlug: string) => void;
}

const SLUG_IMAGE_FALLBACKS: Record<string, string> = {
  chaussures: VELOCITY_SNEAKER_IMG,
  baskets: VELOCITY_SNEAKER_IMG,
  sandales: SAHEL_SANDAL_IMG,
  vetements: STREET_TSHIRT_IMG
};

export const CategoryShowcase: React.FC<CategoryShowcaseProps> = ({
  categories,
  products,
  onSelectCategory
}) => {
  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({});

  if (!categories || categories.length === 0) {
    return null;
  }

  const resolveCategoryImage = (cat: Category): string | null => {
    if (cat.image && cat.image.trim() !== '') {
      return cat.image;
    }
    const matchingProducts = products.filter((p) => p.category === cat.slug);
    const preferredProduct =
      matchingProducts.find((p) => p.featured === true && p.images?.[0]) ||
      matchingProducts.find((p) => Boolean(p.images?.[0]));
    if (preferredProduct?.images?.[0]) {
      return preferredProduct.images[0];
    }
    return SLUG_IMAGE_FALLBACKS[cat.slug] || null;
  };

  return (
    <section className="py-5 sm:py-7 bg-white">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="text-center mb-4 sm:mb-5">
          <h2 className="text-lg sm:text-xl font-bold font-title text-[#123B2A] relative inline-block">
            Nos catégories
            <span className="block w-10 h-0.5 bg-[#D8F36A] rounded-full mx-auto mt-1" />
          </h2>
        </div>

        <div className="flex flex-wrap justify-center gap-4 sm:gap-7 max-w-4xl mx-auto">
          {categories.map((cat) => {
            const resolvedImage = resolveCategoryImage(cat);
            const showImage = Boolean(resolvedImage) && !failedImages[cat.id];

            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => onSelectCategory(cat.slug)}
                className="group flex flex-col items-center text-center cursor-pointer transition-transform hover:-translate-y-0.5 focus-visible:outline-none w-20 sm:w-24"
              >
                <div className="w-14 h-14 sm:w-20 sm:h-20 rounded-full overflow-hidden border-2 border-white shadow-sm bg-[#F8F7F2] flex items-center justify-center p-0.5 sm:p-1 ring-1 ring-[#E1E3DA] group-hover:ring-[#123B2A] group-hover:shadow-md transition-all">
                  {showImage ? (
                    <img
                      src={resolvedImage!}
                      alt={cat.name}
                      onError={() =>
                        setFailedImages((prev) => ({ ...prev, [cat.id]: true }))
                      }
                      className="w-full h-full object-cover rounded-full group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="w-full h-full rounded-full bg-[#EFEFE6] flex items-center justify-center">
                      <span className="text-2xl sm:text-3xl leading-none select-none">
                        {cat.icon || '🛍️'}
                      </span>
                    </div>
                  )}
                </div>

                <span className="text-xs sm:text-sm font-semibold font-title text-[#123B2A] mt-1.5 group-hover:text-[#1F5A40] leading-tight line-clamp-2 max-w-full">
                  {cat.name}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
};
