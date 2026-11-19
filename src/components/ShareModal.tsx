import React, { useState, useEffect } from 'react';
import { Product } from '../types.ts';
import {
  formatFCFA,
  getProductPublicImageUrl,
  getProductShareUrl,
  getProductWhatsAppShareUrl,
  shareProductWithPhotoAndLink,
  normalizeReferralCode
} from '../utils/whatsapp.ts';
import { X, MessageCircle, Copy, Check, Share2, Globe, Download } from 'lucide-react';

interface ShareModalProps {
  product: Product | null;
  isOpen: boolean;
  onClose: () => void;
  onShowToast: (msg: string) => void;
  referralCode?: string;
  onChangeReferralCode?: (code: string) => void;
}

export const ShareModal: React.FC<ShareModalProps> = ({
  product,
  isOpen,
  onClose,
  onShowToast,
  referralCode = '',
  onChangeReferralCode
}) => {
  const [copied, setCopied] = useState<boolean>(false);
  const [isPreparingImageShare, setIsPreparingImageShare] = useState<boolean>(false);
  const [customCode, setCustomCode] = useState<string>(() => normalizeReferralCode(referralCode));

  useEffect(() => {
    if (isOpen) {
      setCustomCode(normalizeReferralCode(referralCode));
      setCopied(false);
    }
  }, [isOpen, referralCode, product?.id]);

  if (!isOpen || !product) return null;

  const activeRef = normalizeReferralCode(customCode);
  const shareUrl = getProductShareUrl(product.id, activeRef || undefined);
  const publicImageUrl = getProductPublicImageUrl(product);
  const previewSrc = product.images[0] || publicImageUrl;
  const supportsNativeShare =
    typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  // Single-URL WhatsApp share (no extra image link so WhatsApp displays the rich photo card automatically)
  const whatsappShareUrl = getProductWhatsAppShareUrl(product, activeRef || undefined);
  const facebookShareUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      onShowToast('Lien du produit copié dans le presse-papier !');
      setTimeout(() => setCopied(false), 2500);
    } catch {
      onShowToast('Impossible de copier automatiquement le lien.');
    }
  };

  const handleNativePhotoShare = async () => {
    setIsPreparingImageShare(true);
    try {
      const outcome = await shareProductWithPhotoAndLink(product, activeRef || undefined);
      if (outcome === 'shared-with-file') {
        onShowToast('Photo et lien partagés ensemble !');
        onClose();
      } else if (outcome === 'shared-link') {
        onShowToast('Produit partagé !');
        onClose();
      } else if (outcome === 'unsupported') {
        window.open(whatsappShareUrl, '_blank', 'noopener,noreferrer');
        onShowToast('Ouverture de WhatsApp...');
        setTimeout(onClose, 600);
      }
    } finally {
      setIsPreparingImageShare(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-[#E1E3DA] overflow-hidden my-auto p-5 sm:p-6"
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          aria-label="Fermer"
          className="absolute top-4 right-4 w-8 h-8 rounded-full bg-[#FAF9F5] hover:bg-[#EFEFE6] text-[#123B2A] flex items-center justify-center border border-[#E1E3DA] cursor-pointer transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 rounded-full bg-[#E8F7EE] text-[#1F5A40] flex items-center justify-center">
            <Share2 className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-base font-bold text-[#123B2A] font-title">
              Partager ce produit
            </h3>
            <p className="text-xs text-[#6B726C]">
              La photo s&apos;affiche en même temps que le lien du produit
            </p>
          </div>
        </div>

        {/* Product preview card */}
        <div className="flex items-center gap-3 p-3 bg-[#FAF9F5] rounded-xl border border-[#E1E3DA] mb-5">
          <div className="w-14 h-14 rounded-lg overflow-hidden bg-white shrink-0 border border-[#E1E3DA]">
            <img
              src={previewSrc}
              alt={product.name}
              className="w-full h-full object-cover"
            />
          </div>
          <div className="min-w-0 flex-1">
            <span className="text-[10px] font-bold text-[#1F5A40] uppercase tracking-wider block">
              {product.categoryLabel} • Réf: {product.ref}
            </span>
            <h4 className="text-xs sm:text-sm font-bold text-[#123B2A] truncate">
              {product.name}
            </h4>
            <div className="text-xs font-extrabold text-[#123B2A] mt-0.5">
              {formatFCFA(product.price)}
            </div>
          </div>
        </div>

        {/* Share Action Buttons */}
        <div className="flex flex-col gap-2.5">
          {/* Primary Smart Share: attaches real photo file + product link on mobile, or clean WhatsApp OG card */}
          {supportsNativeShare ? (
            <button
              type="button"
              disabled={isPreparingImageShare}
              onClick={handleNativePhotoShare}
              className="w-full flex items-center justify-between p-3 rounded-xl bg-[#25D366] hover:bg-[#20ba5a] disabled:opacity-70 text-white font-bold text-xs sm:text-sm shadow-xs transition-all active:scale-98 cursor-pointer"
            >
              <div className="flex items-center gap-2.5">
                <MessageCircle className="w-5 h-5 fill-white text-[#25D366]" />
                <span>
                  {isPreparingImageShare
                    ? 'Préparation de la photo...'
                    : 'Partager Photo + Lien (WhatsApp)'}
                </span>
              </div>
              <span className="text-[11px] bg-white/20 px-2 py-0.5 rounded-full font-semibold">
                Recommandé
              </span>
            </button>
          ) : null}

          {/* Direct WhatsApp single-link share (auto-renders OG photo preview without image URL clutter) */}
          <a
            href={whatsappShareUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => {
              onShowToast('Ouverture de WhatsApp...');
              setTimeout(onClose, 800);
            }}
            className={`w-full flex items-center justify-between p-3 rounded-xl font-bold text-xs sm:text-sm shadow-xs transition-all active:scale-98 cursor-pointer ${
              supportsNativeShare
                ? 'bg-[#123B2A] hover:bg-[#1F5A40] text-white'
                : 'bg-[#25D366] hover:bg-[#20ba5a] text-white'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <MessageCircle className="w-5 h-5 fill-current" />
              <span>
                {supportsNativeShare
                  ? 'WhatsApp direct (Lien avec aperçu photo)'
                  : 'Partager sur WhatsApp (Aperçu photo inclus)'}
              </span>
            </div>
          </a>

          {/* Facebook Share Button */}
          <a
            href={facebookShareUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => {
              onShowToast('Ouverture de Facebook...');
              setTimeout(onClose, 800);
            }}
            className="w-full flex items-center gap-2.5 p-3 rounded-xl bg-[#1877F2] hover:bg-[#166fe5] text-white font-bold text-xs sm:text-sm shadow-xs transition-all active:scale-98 cursor-pointer"
          >
            <Globe className="w-5 h-5 text-white" />
            <span>Partager sur Facebook</span>
          </a>

          {/* Direct Image Download for Status / Manual Posting */}
          <a
            href={publicImageUrl}
            download={`${(product.ref || product.id).replace(/[^a-zA-Z0-9_-]/g, '')}.jpg`}
            className="w-full flex items-center justify-center gap-2 p-2.5 rounded-xl bg-[#FAF9F5] hover:bg-[#EFEFE6] text-[#123B2A] font-semibold text-xs border border-[#E1E3DA] transition-colors"
          >
            <Download className="w-3.5 h-3.5 text-[#1F5A40]" />
            <span>Télécharger la photo</span>
          </a>

          {/* Team Code Selector (for direct storefront sharing) */}
          <div className="pt-2 border-t border-[#E1E3DA] mt-1">
            <div className="flex items-center justify-between mb-1">
              <label className="text-[11px] font-bold text-[#123B2A] uppercase tracking-wider">
                Code équipe (optionnel) :
              </label>
              {customCode && (
                <button
                  type="button"
                  onClick={() => {
                    setCustomCode('');
                    onChangeReferralCode?.('');
                  }}
                  className="text-[11px] font-semibold text-[#6B726C] hover:text-[#123B2A] cursor-pointer"
                >
                  Effacer
                </button>
              )}
            </div>
            <input
              type="text"
              value={customCode}
              onChange={(e) => {
                const upper = e.target.value.toUpperCase();
                setCustomCode(upper);
                onChangeReferralCode?.(normalizeReferralCode(upper));
              }}
              placeholder="Ex : MOUSA — pour créditer vos clics & commandes"
              className="w-full bg-[#FAF9F5] border border-[#E1E3DA] rounded-lg px-3 py-2 text-xs uppercase font-mono text-[#123B2A] focus:outline-[#1F5A40] mb-3"
            />

            <label className="text-[11px] font-bold text-[#6B726C] uppercase tracking-wider block mb-1.5">
              {activeRef
                ? `Lien direct avec votre code (${activeRef}) :`
                : 'Lien direct vers ce produit :'}
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={shareUrl}
                className="flex-1 bg-[#FAF9F5] border border-[#E1E3DA] rounded-lg px-3 py-2 text-xs text-[#202720] select-all font-mono"
              />
              <button
                type="button"
                onClick={handleCopyLink}
                className={`shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  copied
                    ? 'bg-[#1F5A40] text-white'
                    : 'bg-[#FAF9F5] hover:bg-[#EFEFE6] text-[#123B2A] border border-[#E1E3DA]'
                }`}
              >
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copié !' : 'Copier'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
