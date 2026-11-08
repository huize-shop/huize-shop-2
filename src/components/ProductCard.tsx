import React from 'react';
import { Product } from '../types.ts';
import { formatFCFA } from '../utils/whatsapp.ts';
import { Eye, ShoppingBag } from 'lucide-react';

interface ProductCardProps {
  product: Product;
  onOpenDetails: (product: Product) => void;
  onQuickAdd: (product: Product) => void;
}

export const ProductCard: React.FC<ProductCardProps> = ({ product, onOpenDetails, onQuickAdd }) => {
  const isOutOfStock = product.stock <= 0;
  const isLowStock = product.stock > 0 && product.stock <= 3;

  return (
    <article
      onClick={() => onOpenDetails(product)}
      className="group relative flex flex-col bg-white border border-[#E1E3DA] rounded-xl overflow-hidden shadow-xs hover:shadow-lg transition-all duration-300 hover:-translate-y-1 cursor-pointer"
    >
      {/* Product Image & Badges */}
      <div className="relative aspect-square w-full bg-[#EFEFE6] overflow-hidden">
        <img
          src={product.images[0] || 'https://www.gstatic.com/labs-code/stitch/stitch-placeholder-300x300.svg'}
          alt={product.name}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          loading="lazy"
        />

        {product.badge && (
          <span
            className={`absolute top-2.5 left-2.5 text-[11px] font-bold px-2 py-0.5 rounded-full shadow-xs ${
              product.badge === 'Promo'
                ? 'bg-[#E53E3E] text-white'
                : product.badge === 'Stock limité'
                ? 'bg-amber-100 text-amber-900 border border-amber-300'
                : 'bg-[#D8F36A] text-[#123B2A]'
            }`}
          >
            {product.badge}
          </span>
        )}

        {isOutOfStock && (
          <div className="absolute inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center">
            <span className="bg-red-600 text-white text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider">
              Rupture de stock
            </span>
          </div>
        )}
      </div>

      {/* Body Details */}
      <div className="p-4 flex-1 flex flex-col justify-between gap-2">
        <div>
          <span className="text-[11px] font-extrabold uppercase tracking-wider text-[#6B726C]">
            {product.categoryLabel}
          </span>
          <h3 className="text-sm sm:text-base font-semibold text-[#123B2A] line-clamp-2 mt-0.5 group-hover:text-[#1F5A40] transition-colors">
            {product.name}
          </h3>
        </div>

        {/* Stock & Availability Indicator */}
        <div className="flex items-center gap-1.5 text-xs">
          <span
            className={`w-2 h-2 rounded-full ${
              isOutOfStock
                ? 'bg-red-500'
                : isLowStock
                ? 'bg-amber-500'
                : 'bg-[#25D366]'
            }`}
          />
          <span className={isOutOfStock ? 'text-red-700 font-medium' : isLowStock ? 'text-amber-700 font-medium' : 'text-[#1F5A40] font-medium'}>
            {isOutOfStock
              ? 'Rupture temporaire'
              : isLowStock
              ? `Stock faible (${product.stock})`
              : 'En stock à Ouaga'}
          </span>
        </div>

        {/* Pricing */}
        <div className="flex items-baseline gap-2 pt-1 border-t border-[#E1E3DA]/60 mt-auto">
          <span className="text-base sm:text-lg font-bold text-[#123B2A] tabular-nums font-title">
            {formatFCFA(product.price)}
          </span>
          {product.oldPrice && (
            <span className="text-xs text-[#6B726C] line-through tabular-nums">
              {formatFCFA(product.oldPrice)}
            </span>
          )}
        </div>
      </div>

      {/* Action Footer */}
      <div className="p-3 pt-0 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onOpenDetails(product);
          }}
          className="w-full inline-flex items-center justify-center gap-1 py-2 px-2.5 rounded-lg bg-[#FAF9F5] hover:bg-[#EFEFE6] text-[#123B2A] text-xs font-semibold border border-[#E1E3DA] transition-colors cursor-pointer"
        >
          <Eye className="w-3.5 h-3.5" />
          <span>Détails</span>
        </button>

        <button
          type="button"
          disabled={isOutOfStock}
          onClick={(e) => {
            e.stopPropagation();
            onQuickAdd(product);
          }}
          className={`w-full inline-flex items-center justify-center gap-1 py-2 px-2.5 rounded-lg text-xs font-bold transition-all shadow-xs cursor-pointer ${
            isOutOfStock
              ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
              : 'bg-[#123B2A] hover:bg-[#1F5A40] text-white active:scale-95'
          }`}
        >
          <ShoppingBag className="w-3.5 h-3.5" />
          <span>{isOutOfStock ? 'Épuisé' : 'Ajouter'}</span>
        </button>
      </div>
    </article>
  );
};
