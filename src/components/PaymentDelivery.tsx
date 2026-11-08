import React from 'react';
import { MessageCircle, ArrowRight, Check } from 'lucide-react';
import { getDirectWhatsAppUrl, WHATSAPP_DISPLAY } from '../utils/whatsapp.ts';

export const PaymentDelivery: React.FC = () => {
  return (
    <section className="py-14 bg-[#F4F3EE] border-t border-[#E1E3DA]">
      <div className="max-w-4xl mx-auto px-4 sm:px-6">
        <div className="text-center mb-8">
          <h2 className="text-2xl sm:text-3xl font-bold font-title text-[#123B2A] relative inline-block">
            Paiement et livraison
            <span className="block w-14 h-1 bg-[#D8F36A] rounded-full mx-auto mt-2" />
          </h2>
        </div>

        <div className="bg-white border-t-4 border-t-[#1F5A40] border border-[#E1E3DA] rounded-2xl p-6 sm:p-10 shadow-sm text-center flex flex-col items-center gap-5">
          {/* Circular Badge Icon */}
          <div className="relative w-16 h-16 rounded-full bg-linear-to-br from-[#123B2A] to-[#1F5A40] flex items-center justify-center border-2 border-[#D8F36A] shadow-md">
            <MessageCircle className="w-8 h-8 text-[#D8F36A]" />
            <span className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-[#D8F36A] border-2 border-white flex items-center justify-center text-[10px] text-[#123B2A] font-extrabold">
              ✓
            </span>
          </div>

          <div className="max-w-2xl">
            <h3 className="text-lg sm:text-xl font-bold font-title text-[#123B2A] mb-2">
              Une commande humaine, transparente et sans mauvaise surprise
            </h3>
            <p className="text-xs sm:text-sm text-[#4A5568] leading-relaxed">
              Chez <strong>HUIZE SHOP</strong>, chaque commande est validée directement avec vous sur WhatsApp.
              Nous confirmons ensemble la bonne pointure, la disponibilité immédiate, vos modalités de règlement préférées
              (Orange Money, Moov Money ou règlement en espèces) et l'adresse précise de remise en main propre à Ouagadougou
              ou par car en province.
            </p>
          </div>

          {/* 3 Highlights Strip */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full max-w-2xl my-1">
            <div className="flex items-center gap-2.5 bg-[#FAF9F5] p-3 rounded-xl border border-[#E1E3DA] text-left">
              <span className="w-7 h-7 rounded-full bg-[#D8F36A] text-[#123B2A] flex items-center justify-center font-bold text-xs shrink-0">
                ⚡
              </span>
              <span className="text-xs font-bold text-[#123B2A]">Réponse rapide 7j/7</span>
            </div>

            <div className="flex items-center gap-2.5 bg-[#FAF9F5] p-3 rounded-xl border border-[#E1E3DA] text-left">
              <span className="w-7 h-7 rounded-full bg-[#D8F36A] text-[#123B2A] flex items-center justify-center font-bold text-xs shrink-0">
                📍
              </span>
              <span className="text-xs font-bold text-[#123B2A]">Livraison Ouaga &amp; Villes</span>
            </div>

            <div className="flex items-center gap-2.5 bg-[#FAF9F5] p-3 rounded-xl border border-[#E1E3DA] text-left">
              <span className="w-7 h-7 rounded-full bg-[#D8F36A] text-[#123B2A] flex items-center justify-center font-bold text-xs shrink-0">
                🔒
              </span>
              <span className="text-xs font-bold text-[#123B2A]">Paiement convenu ensemble</span>
            </div>
          </div>

          {/* WhatsApp CTA */}
          <div className="flex flex-col items-center gap-2 w-full pt-2">
            <a
              href={getDirectWhatsAppUrl('Bonjour HUIZE SHOP, j’aimerais avoir des précisions sur vos modalités de livraison.')}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-full bg-[#123B2A] hover:bg-[#1F5A40] text-white font-bold text-sm shadow-md transition-all active:scale-95 cursor-pointer"
            >
              <span>Échanger avec le commerçant sur WhatsApp</span>
              <span className="w-6 h-6 rounded-full bg-[#D8F36A] text-[#123B2A] flex items-center justify-center text-xs font-extrabold">
                →
              </span>
            </a>
            <span className="text-xs text-[#6B726C]">
              Numéro officiel : <strong className="text-[#123B2A]">{WHATSAPP_DISPLAY}</strong>
            </span>
          </div>
        </div>
      </div>
    </section>
  );
};
