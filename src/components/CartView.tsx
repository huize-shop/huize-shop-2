import React, { useState } from 'react';
import { CartItem } from '../types.ts';
import { formatFCFA, getCartWhatsAppUrl } from '../utils/whatsapp.ts';
import { Trash2, MessageCircle, ArrowLeft, ShoppingBag, ShieldCheck, Truck } from 'lucide-react';

interface CartViewProps {
  cart: CartItem[];
  onUpdateQuantity: (index: number, quantity: number) => void;
  onRemoveItem: (index: number) => void;
  onClearCart: () => void;
  onContinueShopping: () => void;
  onOrderPlaced?: (order: {
    customerName: string;
    customerPhone: string;
    customerCity: string;
    itemsSummary: string;
    total: number;
    paymentMethod: string;
  }) => void;
}

export const CartView: React.FC<CartViewProps> = ({
  cart,
  onUpdateQuantity,
  onRemoveItem,
  onClearCart,
  onContinueShopping,
  onOrderPlaced
}) => {
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [neighborhood, setNeighborhood] = useState('Ouagadougou');
  const [paymentMethod, setPaymentMethod] = useState('Orange Money / Moov Money');

  const total = cart.reduce((acc, item) => acc + item.product.price * item.quantity, 0);
  const totalItemsCount = cart.reduce((acc, item) => acc + item.quantity, 0);

  const whatsAppCheckoutUrl = getCartWhatsAppUrl(cart, {
    name: customerName,
    phone: customerPhone,
    neighborhood,
    paymentMethod
  });

  if (cart.length === 0) {
    return (
      <div className="py-16 px-4 max-w-4xl mx-auto text-center">
        <div className="w-20 h-20 mx-auto rounded-full bg-[#EFEFE6] flex items-center justify-center text-[#123B2A] mb-4">
          <ShoppingBag className="w-10 h-10 stroke-1" />
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold font-title text-[#123B2A] mb-2">
          Votre panier est vide
        </h1>
        <p className="text-[#6B726C] text-sm max-w-md mx-auto mb-6">
          Découvrez nos collections de baskets, sandales en cuir et vêtements tendance au Burkina Faso.
        </p>
        <button
          onClick={onContinueShopping}
          className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-[#123B2A] hover:bg-[#1F5A40] text-white font-bold text-sm transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Explorer la boutique</span>
        </button>
      </div>
    );
  }

  return (
    <div className="py-8 sm:py-12 px-4 sm:px-6 max-w-6xl mx-auto">
      {/* Title & Back link */}
      <div className="flex items-center justify-between gap-4 mb-6">
        <div>
          <button
            onClick={onContinueShopping}
            className="inline-flex items-center gap-1.5 text-xs text-[#1F5A40] font-bold hover:underline mb-1 cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Continuer mes achats</span>
          </button>
          <h1 className="text-2xl sm:text-3xl font-bold font-title text-[#123B2A]">
            Mon Panier HUIZE SHOP
          </h1>
        </div>

        <button
          onClick={onClearCart}
          className="text-xs text-[#9A2F2F] hover:underline font-semibold cursor-pointer"
        >
          Vider le panier
        </button>
      </div>

      {/* Helpful reassurance notice from template */}
      <div className="p-4 rounded-xl bg-white border-l-4 border-[#1F5A40] border-[#E1E3DA] shadow-xs text-xs sm:text-sm text-[#4A5568] mb-8 leading-relaxed">
        <strong>💡 Comment fonctionne la validation de commande :</strong> Ton panier est conservé sur ton appareil.
        Aucun paiement bancaire n’est prélevé en ligne. En cliquant sur <em>« Commander sur WhatsApp »</em>, la liste de
        tes articles est automatiquement transmise à HUIZE SHOP pour convenir ensemble du lieu exact de livraison à Ouagadougou
        (ou en province) et du moyen de règlement (Orange Money, Moov Money ou espèces à la remise en main propre).
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Cart Items List */}
        <div className="lg:col-span-7 flex flex-col gap-4">
          {cart.map((item, index) => (
            <div
              key={`${item.product.id}-${item.selectedSize}-${index}`}
              className="bg-white border border-[#E1E3DA] rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xs"
            >
              <div className="flex items-center gap-3.5">
                <img
                  src={item.product.images[0] || 'https://www.gstatic.com/labs-code/stitch/stitch-placeholder-300x300.svg'}
                  alt={item.product.name}
                  className="w-20 h-20 object-cover rounded-lg bg-[#EFEFE6] border border-[#E1E3DA] shrink-0"
                />
                <div>
                  <span className="text-[10px] font-extrabold uppercase text-[#6B726C] tracking-wider">
                    {item.product.categoryLabel}
                  </span>
                  <h3 className="text-sm sm:text-base font-bold text-[#123B2A] line-clamp-1">
                    {item.product.name}
                  </h3>
                  <p className="text-xs text-[#6B726C]">
                    Taille / Pointure : <strong className="text-[#123B2A]">{item.selectedSize || 'Standard'}</strong>
                  </p>
                  <p className="text-xs font-bold text-[#1F5A40] mt-0.5">
                    {formatFCFA(item.product.price)}
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between sm:justify-end gap-4 w-full sm:w-auto pt-2 sm:pt-0 border-t sm:border-t-0 border-[#E1E3DA]">
                {/* Quantity Stepper */}
                <div className="inline-flex items-center border border-[#E1E3DA] rounded-lg bg-[#FAF9F5] overflow-hidden">
                  <button
                    type="button"
                    onClick={() => onUpdateQuantity(index, item.quantity - 1)}
                    className="w-7 h-7 flex items-center justify-center font-bold text-[#123B2A] hover:bg-[#EFEFE6] cursor-pointer"
                  >
                    -
                  </button>
                  <span className="w-7 text-center text-xs font-bold text-[#123B2A] tabular-nums">
                    {item.quantity}
                  </span>
                  <button
                    type="button"
                    onClick={() => onUpdateQuantity(index, item.quantity + 1)}
                    className="w-7 h-7 flex items-center justify-center font-bold text-[#123B2A] hover:bg-[#EFEFE6] cursor-pointer"
                  >
                    +
                  </button>
                </div>

                {/* Subtotal */}
                <div className="text-right min-w-[100px]">
                  <p className="text-sm font-bold text-[#123B2A] font-title tabular-nums">
                    {formatFCFA(item.product.price * item.quantity)}
                  </p>
                </div>

                {/* Remove button */}
                <button
                  type="button"
                  onClick={() => onRemoveItem(index)}
                  className="p-1.5 rounded-md text-[#9A2F2F] hover:bg-red-50 transition-colors cursor-pointer"
                  title="Supprimer cet article"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}

          {/* Delivery & Customer Info Card */}
          <div className="bg-white border border-[#E1E3DA] rounded-xl p-5 shadow-xs">
            <h3 className="text-sm font-bold text-[#123B2A] uppercase tracking-wider mb-3 flex items-center gap-2">
              <Truck className="w-4 h-4 text-[#1F5A40]" />
              <span>Détails pour la livraison (pré-remplis dans WhatsApp)</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block text-[#123B2A] font-semibold mb-1">Votre Nom &amp; Prénom</label>
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Ex: Ibrahim Ouédraogo"
                  className="w-full p-2.5 rounded-lg border border-[#E1E3DA] text-xs focus:outline-[#1F5A40]"
                />
              </div>

              <div>
                <label className="block text-[#123B2A] font-semibold mb-1">Votre Numéro de contact</label>
                <input
                  type="tel"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder="Ex: +226 70 XX XX XX"
                  className="w-full p-2.5 rounded-lg border border-[#E1E3DA] text-xs focus:outline-[#1F5A40]"
                />
              </div>

              <div>
                <label className="block text-[#123B2A] font-semibold mb-1">Ville &amp; Quartier à livrer</label>
                <input
                  type="text"
                  value={neighborhood}
                  onChange={(e) => setNeighborhood(e.target.value)}
                  placeholder="Ex: Ouagadougou, Karpala / Ouaga 2000"
                  className="w-full p-2.5 rounded-lg border border-[#E1E3DA] text-xs focus:outline-[#1F5A40]"
                />
              </div>

              <div>
                <label className="block text-[#123B2A] font-semibold mb-1">Paiement souhaité</label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="w-full p-2.5 rounded-lg border border-[#E1E3DA] text-xs focus:outline-[#1F5A40] bg-white"
                >
                  <option value="Orange Money / Moov Money">Orange Money / Moov Money</option>
                  <option value="Espèces à la livraison">Espèces à la livraison</option>
                  <option value="Paiement en boutique">Paiement en boutique Ouaga</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Order Summary & WhatsApp Checkout */}
        <div className="lg:col-span-5 sticky top-24">
          <div className="bg-white border border-[#E1E3DA] rounded-2xl p-6 shadow-md flex flex-col gap-4">
            <h2 className="text-lg font-bold font-title text-[#123B2A] border-b border-[#E1E3DA] pb-3">
              Récapitulatif de la commande
            </h2>

            <div className="flex flex-col gap-2.5 text-sm">
              <div className="flex justify-between text-[#6B726C]">
                <span>Nombre d'articles</span>
                <strong className="text-[#123B2A]">{totalItemsCount} article{totalItemsCount > 1 ? 's' : ''}</strong>
              </div>

              <div className="flex justify-between text-[#6B726C]">
                <span>Sous-total articles</span>
                <strong className="text-[#123B2A] tabular-nums font-semibold">{formatFCFA(total)}</strong>
              </div>

              <div className="flex justify-between text-[#6B726C]">
                <span>Frais de livraison</span>
                <span className="text-xs text-[#1F5A40] font-semibold">Confirmés sur WhatsApp</span>
              </div>

              <div className="border-t border-[#E1E3DA] pt-3 mt-1 flex justify-between items-baseline">
                <span className="text-base font-bold text-[#123B2A]">Total à régler :</span>
                <span className="text-2xl font-extrabold text-[#123B2A] font-title tabular-nums">
                  {formatFCFA(total)}
                </span>
              </div>
            </div>

            <p className="text-[11px] text-[#6B726C] bg-[#FAF9F5] p-3 rounded-lg border border-[#E1E3DA] leading-relaxed">
              📦 Les commandes sont préparées le jour même à Ouagadougou. Livraison en moins de 24h dans toute la capitale
              et expéditions sécurisées vers Bobo-Dioulasso, Koudougou, Fada, etc.
            </p>

            {/* Big WhatsApp Checkout Button */}
            <a
              href={whatsAppCheckoutUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => {
                if (onOrderPlaced) {
                  const summary = cart.map((i) => `${i.quantity}x ${i.product.name} (Taille ${i.selectedSize || 'Std'})`).join(', ');
                  onOrderPlaced({
                    customerName: customerName.trim() || 'Client WhatsApp',
                    customerPhone: customerPhone.trim() || 'Non précisé',
                    customerCity: neighborhood.trim() || 'Ouagadougou',
                    itemsSummary: summary,
                    total,
                    paymentMethod
                  });
                }
              }}
              className="w-full inline-flex items-center justify-center gap-2.5 py-4 px-6 rounded-full bg-[#25D366] hover:bg-[#20ba5a] text-white font-extrabold text-base shadow-lg transition-all active:scale-98"
            >
              <MessageCircle className="w-5 h-5 fill-white text-[#25D366]" />
              <span>💬 Commander sur WhatsApp</span>
            </a>

            <button
              onClick={onContinueShopping}
              className="w-full py-2.5 rounded-full border border-[#123B2A] text-[#123B2A] text-xs font-bold hover:bg-[#123B2A] hover:text-white transition-colors cursor-pointer"
            >
              Ajouter d'autres articles
            </button>

            <div className="flex items-center justify-center gap-2 text-xs text-[#6B726C] pt-2 border-t border-[#E1E3DA]">
              <ShieldCheck className="w-4 h-4 text-[#1F5A40]" />
              <span>Contact direct commerçant (+226 53 74 27 48)</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
