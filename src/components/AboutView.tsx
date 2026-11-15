import React, { useState } from 'react';
import {
  ArrowRight,
  MessageCircle,
  Handshake,
  ShieldCheck,
  TrendingUp,
  CheckCircle2,
  MapPin,
  Store
} from 'lucide-react';
import {
  WHATSAPP_DISPLAY,
  getDirectWhatsAppUrl,
  getSupplierWhatsAppUrl
} from '../utils/whatsapp.ts';

interface AboutViewProps {
  onExploreShop: () => void;
  onOpenContact: () => void;
}

export const AboutView: React.FC<AboutViewProps> = ({ onExploreShop, onOpenContact }) => {
  const [supplierName, setSupplierName] = useState('');
  const [supplierCategory, setSupplierCategory] = useState('Baskets & Chaussures');
  const [supplierCity, setSupplierCity] = useState('Ouagadougou');
  const [supplierDetails, setSupplierDetails] = useState('');
  const [formError, setFormError] = useState('');
  const [formSent, setFormSent] = useState(false);

  const supplierWhatsAppHref = getSupplierWhatsAppUrl(
    supplierName.trim() || 'Fournisseur intéressé',
    supplierCategory,
    supplierCity.trim() || 'Burkina Faso',
    supplierDetails.trim()
  );

  const handleSupplierClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (!supplierName.trim()) {
      e.preventDefault();
      setFormError('Veuillez indiquer votre nom ou celui de votre boutique.');
      setFormSent(false);
      return;
    }
    setFormError('');
    setFormSent(true);
  };

  return (
    <div className="bg-[#F8F7F2] text-[#202720]">
      {/* 1. Editorial Presentation Header */}
      <section className="bg-white border-b border-[#E1E3DA]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12 sm:py-16 lg:py-20">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center">
            <div className="lg:col-span-7 space-y-5">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#1F5A40]">
                À propos de HUIZE SHOP • Burkina Faso
              </p>
              <h1
                className="text-3xl sm:text-4xl lg:text-5xl font-bold font-title text-[#123B2A] leading-tight"
                style={{ textWrap: 'balance' }}
              >
                Une boutique connectée aux meilleurs fournisseurs du Burkina Faso, fondée sur la confiance.
              </h1>
              <p className="text-sm sm:text-base text-[#4A524C] leading-relaxed max-w-2xl">
                <strong>HUIZE SHOP</strong> est une plateforme de commerce en ligne burkinabè qui réunit
                des articles sélectionnés en collaboration avec plusieurs fournisseurs partenaires
                locaux. Notre ambition est simple : vous donner accès à des baskets, sandales et
                vêtements fiables, avec un échange humain direct pour confirmer chaque détail avant
                votre commande.
              </p>

              <div className="flex flex-wrap items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={onExploreShop}
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-[#123B2A] hover:bg-[#1F5A40] text-white text-sm font-bold transition-all cursor-pointer active:scale-95 shadow-xs"
                >
                  <span>Parcourir le catalogue</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
                <a
                  href={getDirectWhatsAppUrl(
                    'Bonjour HUIZE SHOP, je souhaite en savoir plus sur votre boutique et la disponibilité de vos articles.'
                  )}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-[#D8F36A] hover:bg-[#C8E750] text-[#123B2A] text-sm font-bold transition-all active:scale-95 shadow-xs"
                >
                  <MessageCircle className="w-4 h-4 fill-current" />
                  <span>Discuter sur WhatsApp</span>
                </a>
              </div>
            </div>

            {/* Key Summary Panel */}
            <div className="lg:col-span-5">
              <div className="bg-[#FAF9F5] border border-[#E1E3DA] rounded-2xl p-6 sm:p-8 space-y-6">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-xl bg-[#123B2A] text-[#D8F36A] flex items-center justify-center shrink-0">
                    <Handshake className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-[#123B2A]">
                      Réseau multi-fournisseurs
                    </h2>
                    <p className="text-xs sm:text-sm text-[#6B726C] mt-1 leading-relaxed">
                      Des articles sourcés directement auprès de plusieurs partenaires de confiance
                      au Burkina Faso.
                    </p>
                  </div>
                </div>

                <div className="border-t border-[#E1E3DA] pt-5 flex items-start gap-4">
                  <div className="w-10 h-10 rounded-xl bg-[#123B2A] text-[#D8F36A] flex items-center justify-center shrink-0">
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-[#123B2A]">
                      Confirmation &amp; commande humaine
                    </h2>
                    <p className="text-xs sm:text-sm text-[#6B726C] mt-1 leading-relaxed">
                      Chaque disponibilité est vérifiée avec notre service client sur WhatsApp pour
                      garantir une transaction sereine.
                    </p>
                  </div>
                </div>

                <div className="border-t border-[#E1E3DA] pt-5 flex items-start gap-4">
                  <div className="w-10 h-10 rounded-xl bg-[#123B2A] text-[#D8F36A] flex items-center justify-center shrink-0">
                    <TrendingUp className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-[#123B2A]">
                      Plateforme en évolution continue
                    </h2>
                    <p className="text-xs sm:text-sm text-[#6B726C] mt-1 leading-relaxed">
                      Nouveaux arrivages, amélioration du site et ouverture permanente à de nouveaux
                      fournisseurs sérieux.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 2. How HUIZE SHOP Works (Ordered 4-Step Flow) */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-14 sm:py-16">
        <div className="max-w-2xl mb-10">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#1F5A40] mb-2">
            Notre fonctionnement
          </p>
          <h2
            className="text-2xl sm:text-3xl font-bold font-title text-[#123B2A]"
            style={{ textWrap: 'balance' }}
          >
            Comment marche HUIZE SHOP au quotidien
          </h2>
          <p className="text-sm text-[#6B726C] mt-2 leading-relaxed">
            Nous avons conçu une organisation transparente qui relie les stocks réels de nos
            fournisseurs locaux à un accompagnement client direct et réactif.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Step 01 */}
          <article className="bg-white border border-[#E1E3DA] rounded-2xl p-6 sm:p-7 flex flex-col justify-between">
            <div>
              <span className="font-title text-3xl font-bold text-[#1F5A40]/40 block mb-3">
                01
              </span>
              <h3 className="text-lg font-bold font-title text-[#123B2A] mb-2">
                Collaboration avec des fournisseurs locaux
              </h3>
              <p className="text-sm text-[#4A524C] leading-relaxed">
                HUIZE SHOP ne dépend pas d&apos;un seul entrepôt isolé. Nous collaborons avec
                différents fournisseurs et grossistes au Burkina Faso afin de vous proposer une
                offre variée et actuelle — des sneakers tendance aux sandales et vêtements du
                quotidien.
              </p>
            </div>
          </article>

          {/* Step 02 */}
          <article className="bg-white border border-[#E1E3DA] rounded-2xl p-6 sm:p-7 flex flex-col justify-between">
            <div>
              <span className="font-title text-3xl font-bold text-[#1F5A40]/40 block mb-3">
                02
              </span>
              <h3 className="text-lg font-bold font-title text-[#123B2A] mb-2">
                Articles disponibles &amp; confirmation en direct
              </h3>
              <p className="text-sm text-[#4A524C] leading-relaxed">
                Les produits affichés sur le site sont disponibles auprès de notre réseau. Comme les
                pointures et coloris bougent rapidement chez nos partenaires, il suffit de contacter
                le service HUIZE SHOP pour obtenir une confirmation immédiate de l&apos;article exact
                avant l&apos;expédition.
              </p>
            </div>
          </article>

          {/* Step 03 */}
          <article className="bg-white border border-[#E1E3DA] rounded-2xl p-6 sm:p-7 flex flex-col justify-between">
            <div>
              <span className="font-title text-3xl font-bold text-[#1F5A40]/40 block mb-3">
                03
              </span>
              <h3 className="text-lg font-bold font-title text-[#123B2A] mb-2">
                Commandes sur WhatsApp pour inspirer confiance
              </h3>
              <p className="text-sm text-[#4A524C] leading-relaxed">
                Pour garantir la confiance de nos clients, nous avons choisi de finaliser les
                commandes directement par WhatsApp ({WHATSAPP_DISPLAY}). Vous échangez avec notre
                équipe, vous validez votre taille et votre lieu de livraison, et vous réglez selon
                l&apos;option qui vous rassure le plus (Mobile Money ou paiement à la livraison à
                Ouagadougou).
              </p>
            </div>
          </article>

          {/* Step 04 */}
          <article className="bg-white border border-[#E1E3DA] rounded-2xl p-6 sm:p-7 flex flex-col justify-between">
            <div>
              <span className="font-title text-3xl font-bold text-[#1F5A40]/40 block mb-3">
                04
              </span>
              <h3 className="text-lg font-bold font-title text-[#123B2A] mb-2">
                Une plateforme en constante évolution
              </h3>
              <p className="text-sm text-[#4A524C] leading-relaxed">
                HUIZE SHOP évolue en permanence : amélioration continue du catalogue en ligne,
                ajout de nouvelles fonctionnalités pratiques et renforcement de notre logistique à
                Ouagadougou et vers les autres villes du pays grâce à vos retours.
              </p>
            </div>
          </article>
        </div>
      </section>

      {/* 3. Trust & Customer Service Commitments */}
      <section className="bg-white border-y border-[#E1E3DA]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-14 sm:py-16">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
            <div className="lg:col-span-5 space-y-3">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#1F5A40]">
                Notre engagement client
              </p>
              <h2
                className="text-2xl sm:text-3xl font-bold font-title text-[#123B2A]"
                style={{ textWrap: 'balance' }}
              >
                Pourquoi passer par le service HUIZE SHOP ?
              </h2>
              <p className="text-sm text-[#6B726C] leading-relaxed">
                Acheter en ligne au Burkina Faso demande de la transparence. Chaque commande suit un
                circuit simple pour éviter les mauvaises surprises.
              </p>
              <div className="pt-2">
                <button
                  type="button"
                  onClick={onOpenContact}
                  className="inline-flex items-center gap-2 text-sm font-bold text-[#123B2A] hover:text-[#1F5A40] underline underline-offset-4 cursor-pointer"
                >
                  <span>Voir nos modalités de contact et de livraison</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-[#FAF9F5] border border-[#E1E3DA] rounded-xl p-5">
                <CheckCircle2 className="w-5 h-5 text-[#1F5A40] mb-2.5" />
                <h3 className="text-sm font-bold text-[#123B2A] mb-1">
                  Vérification avant départ
                </h3>
                <p className="text-xs sm:text-sm text-[#6B726C] leading-relaxed">
                  Notre équipe confirme la disponibilité chez le fournisseur et contrôle l&apos;article
                  avant la mise en livraison.
                </p>
              </div>

              <div className="bg-[#FAF9F5] border border-[#E1E3DA] rounded-xl p-5">
                <MessageCircle className="w-5 h-5 text-[#1F5A40] mb-2.5" />
                <h3 className="text-sm font-bold text-[#123B2A] mb-1">
                  Dialogue direct et conseils
                </h3>
                <p className="text-xs sm:text-sm text-[#6B726C] leading-relaxed">
                  Un doute sur une pointure ou une coupe ? Le service client vous répond
                  personnellement sur WhatsApp avant de confirmer.
                </p>
              </div>

              <div className="bg-[#FAF9F5] border border-[#E1E3DA] rounded-xl p-5">
                <MapPin className="w-5 h-5 text-[#1F5A40] mb-2.5" />
                <h3 className="text-sm font-bold text-[#123B2A] mb-1">
                  Ouagadougou &amp; Provinces
                </h3>
                <p className="text-xs sm:text-sm text-[#6B726C] leading-relaxed">
                  Livraison dans les différents quartiers de Ouagadougou et expéditions organisées
                  vers Bobo-Dioulasso, Koudougou et les autres localités.
                </p>
              </div>

              <div className="bg-[#FAF9F5] border border-[#E1E3DA] rounded-xl p-5">
                <ShieldCheck className="w-5 h-5 text-[#1F5A40] mb-2.5" />
                <h3 className="text-sm font-bold text-[#123B2A] mb-1">
                  Aucun paiement forcé en ligne
                </h3>
                <p className="text-xs sm:text-sm text-[#6B726C] leading-relaxed">
                  Vous ne payez qu&apos;après échange clair avec notre service via Orange Money, Moov
                  Money ou en espèces à la réception.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 4. Supplier Recruitment Section */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-14 sm:py-16">
        <div className="bg-[#123B2A] text-white rounded-3xl p-6 sm:p-10 lg:p-12 border border-[#1F5A40] shadow-sm">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
            <div className="lg:col-span-6 space-y-4">
              <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-[#D8F36A]">
                <Store className="w-4 h-4" />
                <span>Appel aux fournisseurs • Burkina Faso</span>
              </div>
              <h2
                className="text-2xl sm:text-3xl font-bold font-title text-white leading-snug"
                style={{ textWrap: 'balance' }}
              >
                Nous recherchons de nouveaux fournisseurs partenaires.
              </h2>
              <p className="text-sm text-white/80 leading-relaxed">
                Vous êtes commerçant, grossiste, importateur ou créateur au Burkina Faso et vous
                disposez d&apos;articles de qualité (baskets, sandales, vêtements, accessoires) ?
                HUIZE SHOP continue d&apos;élargir son réseau de partenaires fiables.
              </p>
              <ul className="space-y-2.5 pt-1 text-xs sm:text-sm text-white/85">
                <li className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-[#D8F36A] shrink-0 mt-0.5" />
                  <span>Mise en ligne et valorisation de vos produits sur notre vitrine.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-[#D8F36A] shrink-0 mt-0.5" />
                  <span>Gestion de la relation client et qualification des commandes par notre service.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-[#D8F36A] shrink-0 mt-0.5" />
                  <span>Collaboration transparente basée sur la disponibilité réelle et la réactivité.</span>
                </li>
              </ul>
            </div>

            {/* Interactive Supplier Application Form -> WhatsApp */}
            <div className="lg:col-span-6 bg-white text-[#202720] rounded-2xl p-6 sm:p-7">
              <h3 className="text-lg font-bold font-title text-[#123B2A] mb-1">
                Proposer un partenariat fournisseur
              </h3>
              <p className="text-xs text-[#6B726C] mb-5">
                Renseignez vos informations pour ouvrir une discussion directe avec notre équipe sur
                WhatsApp.
              </p>

              <form onSubmit={(e) => e.preventDefault()} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-[#123B2A] mb-1">
                    Votre nom ou nom de votre boutique *
                  </label>
                  <input
                    type="text"
                    value={supplierName}
                    onChange={(e) => {
                      setSupplierName(e.target.value);
                      if (formError) setFormError('');
                    }}
                    placeholder="Ex : Établissement Faso Style"
                    className="w-full px-3.5 py-2.5 bg-[#FAF9F5] border border-[#E1E3DA] rounded-xl text-sm focus:outline-[#1F5A40]"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-xs font-bold text-[#123B2A] mb-1">
                      Catégorie d&apos;articles
                    </label>
                    <select
                      value={supplierCategory}
                      onChange={(e) => setSupplierCategory(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-[#FAF9F5] border border-[#E1E3DA] rounded-xl text-sm focus:outline-[#1F5A40]"
                    >
                      <option value="Baskets & Chaussures">Baskets &amp; Chaussures</option>
                      <option value="Sandales & Mules">Sandales &amp; Mules</option>
                      <option value="Vêtements & Prêt-à-porter">Vêtements &amp; Prêt-à-porter</option>
                      <option value="Accessoires & Maroquinerie">Accessoires &amp; Maroquinerie</option>
                      <option value="Plusieurs catégories">Plusieurs catégories</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#123B2A] mb-1">
                      Ville / Quartier
                    </label>
                    <input
                      type="text"
                      value={supplierCity}
                      onChange={(e) => setSupplierCity(e.target.value)}
                      placeholder="Ex : Ouagadougou, Rood Woko"
                      className="w-full px-3.5 py-2.5 bg-[#FAF9F5] border border-[#E1E3DA] rounded-xl text-sm focus:outline-[#1F5A40]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#123B2A] mb-1">
                    Précisions sur votre stock ou vos tarifs (optionnel)
                  </label>
                  <textarea
                    rows={3}
                    value={supplierDetails}
                    onChange={(e) => setSupplierDetails(e.target.value)}
                    placeholder="Décrivez brièvement les types d'articles disponibles, les quantités ou vos conditions..."
                    className="w-full px-3.5 py-2.5 bg-[#FAF9F5] border border-[#E1E3DA] rounded-xl text-sm focus:outline-[#1F5A40] resize-none"
                  />
                </div>

                {formError && (
                  <p className="text-xs font-semibold text-red-600">{formError}</p>
                )}

                {formSent && (
                  <p className="text-xs font-semibold text-[#1F5A40] bg-[#EFEFE6] px-3 py-2 rounded-lg">
                    Message prêt ! Si WhatsApp ne s&apos;est pas ouvert automatiquement,
                    contactez-nous directement au {WHATSAPP_DISPLAY}.
                  </p>
                )}

                <a
                  href={supplierWhatsAppHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={handleSupplierClick}
                  className="w-full flex items-center justify-center gap-2 py-3 px-5 rounded-xl bg-[#25D366] hover:bg-[#1ebe5d] text-white font-bold text-sm transition-all cursor-pointer shadow-xs active:scale-[0.99]"
                >
                  <MessageCircle className="w-4 h-4 fill-current" />
                  <span>Devenir fournisseur sur WhatsApp</span>
                </a>
              </form>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
