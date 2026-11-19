import React from 'react';
import { Product } from '../types.ts';
import { formatFCFA, getProductWhatsAppUrl } from '../utils/whatsapp.ts';
import { MessageCircle, ShoppingBag, Heart, Share2 } from 'lucide-react';

interface ProductCardProps {
  product: Product;
  onOpenDetails: (product: Product) => void;
  onQuickAdd: (product: Product) => void;
  isLiked?: boolean;
  onToggleLike?: (productId: string) => void;
  onOpenShare?: (product: Product) => void;
  referralCode?: string;
  onDirectWhatsAppOrder?: (
    product: Product,
    size: string,
    quantity: number,
    referralCode?: string
  ) => void;
}

export const ProductCard: React.FC<ProductCardProps> = ({
  product,
  onOpenDetails,
  onQuickAdd,
  isLiked = false,
  onToggleLike,
  onOpenShare,
  referralCode,
  onDirectWhatsAppOrder
}) => {
  const isOutOfStock = product.stock <= 0;
  const isLowStock = product.stock > 0 && product.stock <= 3;
  const likesCount = (product.likes || 0);

  return (
    <article
      onClick={() => onOpenDetails(product)}
      className="group relative flex flex-col bg-white border border-[#E1E3DA] rounded-xl overflow-hidden shadow-xs hover:shadow-lg transition-all duration-300 hover:-translate-y-1 cursor-pointer"
    >
      {/* Product Image & Badges & Actions */}
      <div className="relative aspect-square w-full bg-[#EFEFE6] overflow-hidden">
        <img
          src={product.images[0] || 'https://www.gstatic.com/labs-code/stitch/stitch-placeholder-300x300.svg'}
          alt={product.name}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          loading="lazy"
        />

        {product.badge && (
          <span
            className={`absolute top-2.5 left-2.5 text-[11px] font-bold px-2 py-0.5 rounded-full shadow-xs z-10 ${
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

        {/* Floating Quick Action Icons (Likes & Share) */}
        <div className="absolute top-2.5 right-2.5 flex items-center gap-1.5 z-10">
          {onOpenShare && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onOpenShare(product);
              }}
              title="Partager ce produit sur WhatsApp ou réseaux"
              className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-white/90 hover:bg-white text-[#123B2A] flex items-center justify-center shadow-xs transition-all hover:scale-110 active:scale-95 cursor-pointer backdrop-blur-xs border border-black/5"
            >
              <Share2 className="w-3.5 h-3.5" />
            </button>
          )}

          {onToggleLike && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onToggleLike(product.id);
              }}
              title={isLiked ? 'Retirer des coups de cœur' : 'Ajouter aux coups de cœur'}
              className={`h-7 sm:h-8 px-2 rounded-full flex items-center gap-1 shadow-xs transition-all hover:scale-110 active:scale-95 cursor-pointer backdrop-blur-xs border ${
                isLiked
                  ? 'bg-red-50 text-red-600 border-red-200'
                  : 'bg-white/90 hover:bg-white text-gray-700 border-black/5'
              }`}
            >
              <Heart
                className={`w-3.5 h-3.5 transition-transform ${
                  isLiked ? 'fill-red-500 text-red-500 scale-110' : 'text-gray-700'
                }`}
              />
              {likesCount > 0 && (
                <span className="text-[10px] sm:text-[11px] font-bold tabular-nums">
                  {likesCount}
                </span>
              )}
            </button>
          )}
        </div>

        {isOutOfStock && (
          <div className="absolute inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-10">
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
        {isOutOfStock ? (
          <button
            type="button"
            disabled
            className="w-full inline-flex items-center justify-center gap-1 py-2 px-2.5 rounded-lg bg-gray-100 text-gray-400 text-xs font-semibold cursor-not-allowed border border-gray-200"
          >
            <span>Épuisé</span>
          </button>
        ) : (
          <a
            href={getProductWhatsAppUrl(product, product.sizes?.[0] || '', 1, referralCode)}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => {
              e.stopPropagation();
              onDirectWhatsAppOrder?.(product, product.sizes?.[0] || '', 1, referralCode);
            }}
            title="Commander directement en 1 clic sur WhatsApp (+226 53 74 27 48)"
            className="w-full inline-flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-lg bg-[#25D366] hover:bg-[#20ba5a] text-white text-xs font-bold shadow-xs transition-all active:scale-95 cursor-pointer"
          >
            <MessageCircle className="w-3.5 h-3.5 fill-white text-[#25D366]" />
            <span>Commander</span>
          </a>
        )}

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
