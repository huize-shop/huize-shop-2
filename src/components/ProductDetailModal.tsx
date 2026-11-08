import React, { useState, useEffect } from 'react';
import { Product } from '../types.ts';
import { formatFCFA, getProductWhatsAppUrl } from '../utils/whatsapp.ts';
import { X, MessageCircle, ShoppingBag, Check, ShieldCheck, MapPin } from 'lucide-react';

interface ProductDetailModalProps {
  product: Product | null;
  onClose: () => void;
  onAddToCart: (product: Product, size: string, quantity: number) => void;
}

export const ProductDetailModal: React.FC<ProductDetailModalProps> = ({
  product,
  onClose,
  onAddToCart
}) => {
  const [selectedSize, setSelectedSize] = useState<string>('');
  const [quantity, setQuantity] = useState<number>(1);
  const [activeImageIdx, setActiveImageIdx] = useState<number>(0);
  const [addedToast, setAddedToast] = useState<boolean>(false);

  useEffect(() => {
    if (product) {
      setSelectedSize(product.sizes[0] || '');
      setQuantity(1);
      setActiveImageIdx(0);
      setAddedToast(false);
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [product]);

  if (!product) return null;

  const currentImage = product.images[activeImageIdx] || product.images[0];
  const isOutOfStock = product.stock <= 0;

  const handleAddToCart = () => {
    onAddToCart(product, selectedSize, quantity);
    setAddedToast(true);
    setTimeout(() => {
      setAddedToast(false);
    }, 2500);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-[#123B2A]/65 backdrop-blur-xs overflow-y-auto"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-3xl bg-white rounded-2xl shadow-2xl border border-[#E1E3DA] overflow-hidden my-auto animate-fade-in"
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          aria-label="Fermer"
          className="absolute top-3.5 right-3.5 z-20 w-9 h-9 rounded-full bg-[#FAF9F5] hover:bg-[#EFEFE6] text-[#123B2A] flex items-center justify-center transition-colors cursor-pointer border border-[#E1E3DA]"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="grid grid-cols-1 md:grid-cols-12 max-h-[85vh] overflow-y-auto md:max-h-none md:overflow-visible">
          {/* Left: Gallery Column */}
          <div className="md:col-span-5 bg-[#FAF9F5] p-6 flex flex-col items-center justify-center border-b md:border-b-0 md:border-r border-[#E1E3DA] relative">
            {product.badge && (
              <span className="absolute top-4 left-4 bg-[#D8F36A] text-[#123B2A] text-xs font-extrabold px-2.5 py-1 rounded-full uppercase tracking-wider">
                {product.badge}
              </span>
            )}

            <div className="w-full aspect-square max-w-[280px] rounded-xl overflow-hidden bg-white shadow-xs border border-[#E1E3DA] flex items-center justify-center">
              <img
                src={currentImage}
                alt={product.name}
                className="w-full h-full object-cover transition-transform duration-300"
              />
            </div>

            {/* Thumbnail selector */}
            {product.images.length > 1 && (
              <div className="flex gap-2 mt-4">
                {product.images.map((img, idx) => (
                  <button
                    key={idx}
                    onClick={() => setActiveImageIdx(idx)}
                    className={`w-12 h-12 rounded-lg overflow-hidden border-2 transition-all cursor-pointer ${
                      activeImageIdx === idx ? 'border-[#123B2A] ring-2 ring-[#D8F36A]' : 'border-[#E1E3DA] opacity-70'
                    }`}
                  >
                    <img src={img} alt={`Vue ${idx + 1}`} className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}

            <div className="mt-4 flex items-center gap-1.5 text-xs text-[#1F5A40] font-semibold bg-[#E8F7EE] px-3 py-1.5 rounded-full">
              <MapPin className="w-3.5 h-3.5" />
              <span>Stock physique à Ouagadougou</span>
            </div>
          </div>

          {/* Right: Product Details & Purchase Form */}
          <div className="md:col-span-7 p-6 sm:p-7 flex flex-col justify-between gap-5">
            <div>
              <div className="flex items-center justify-between text-xs text-[#6B726C] font-extrabold uppercase tracking-wider mb-1">
                <span>{product.categoryLabel}</span>
                <span className="text-[#1F5A40]">Réf: {product.ref}</span>
              </div>

              <h2 id="modal-title" className="text-xl sm:text-2xl font-bold font-title text-[#123B2A] leading-snug">
                {product.name}
              </h2>

              {/* Price block */}
              <div className="flex items-baseline gap-3 my-3">
                <span className="text-2xl font-extrabold text-[#123B2A] tabular-nums font-title">
                  {formatFCFA(product.price)}
                </span>
                {product.oldPrice && (
                  <span className="text-sm text-[#6B726C] line-through tabular-nums">
                    {formatFCFA(product.oldPrice)}
                  </span>
                )}
              </div>

              {/* Description */}
              <p className="text-xs sm:text-sm text-[#4A5568] leading-relaxed border-y border-[#E1E3DA] py-3 my-3">
                {product.description}
              </p>

              {/* Sizes / Pointures chips */}
              {product.sizes && product.sizes.length > 0 && (
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-[#123B2A]">
                      Choisir la pointure / taille :
                    </label>
                    <span className="text-[11px] text-[#6B726C]">Sélection : {selectedSize}</span>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {product.sizes.map((size) => (
                      <button
                        key={size}
                        type="button"
                        onClick={() => setSelectedSize(size)}
                        className={`min-w-10 h-9 px-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                          selectedSize === size
                            ? 'bg-[#123B2A] text-[#D8F36A] ring-2 ring-[#D8F36A] shadow-xs'
                            : 'bg-[#FAF9F5] hover:bg-[#EFEFE6] text-[#202720] border border-[#E1E3DA]'
                        }`}
                      >
                        {size}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Quantity Stepper */}
              <div className="flex items-center gap-4 mb-4">
                <label className="text-xs font-bold uppercase tracking-wider text-[#123B2A]">
                  Quantité :
                </label>
                <div className="inline-flex items-center border border-[#E1E3DA] rounded-lg bg-[#FAF9F5] overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                    disabled={quantity <= 1}
                    className="w-8 h-8 flex items-center justify-center text-[#123B2A] font-bold hover:bg-[#EFEFE6] disabled:opacity-40 cursor-pointer"
                  >
                    -
                  </button>
                  <span className="w-8 text-center text-xs font-bold text-[#123B2A] tabular-nums">
                    {quantity}
                  </span>
                  <button
                    type="button"
                    onClick={() => setQuantity((q) => q + 1)}
                    className="w-8 h-8 flex items-center justify-center text-[#123B2A] font-bold hover:bg-[#EFEFE6] cursor-pointer"
                  >
                    +
                  </button>
                </div>

                <span className="text-xs text-[#6B726C]">
                  Total : <strong className="text-[#123B2A]">{formatFCFA(product.price * quantity)}</strong>
                </span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col gap-2 pt-2">
              <a
                href={getProductWhatsAppUrl(product, selectedSize, quantity)}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full inline-flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-[#25D366] hover:bg-[#20ba5a] text-white font-bold text-sm shadow-md transition-all active:scale-98"
              >
                <MessageCircle className="w-5 h-5 fill-white text-[#25D366]" />
                <span>💬 Commander direct sur WhatsApp</span>
              </a>

              <button
                type="button"
                disabled={isOutOfStock}
                onClick={handleAddToCart}
                className={`w-full inline-flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-bold text-sm transition-all cursor-pointer ${
                  isOutOfStock
                    ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                    : 'bg-[#123B2A] hover:bg-[#1F5A40] text-white shadow-xs active:scale-98'
                }`}
              >
                <ShoppingBag className="w-4 h-4" />
                <span>{isOutOfStock ? 'Rupture temporaire' : 'Ajouter au panier'}</span>
              </button>

              {addedToast && (
                <div className="p-2 rounded-lg bg-[#E8F7EE] text-[#1F5A40] text-xs font-bold text-center flex items-center justify-center gap-1.5 animate-fade-in border border-[#A2E2B8]">
                  <Check className="w-4 h-4 text-[#1F5A40]" />
                  <span>Article ajouté au panier !</span>
                </div>
              )}

              <p className="text-[11px] text-[#6B726C] text-center mt-1 flex items-center justify-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-[#1F5A40]" />
                <span>Paiement convenu à la livraison (Orange Money, Moov ou espèces)</span>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
