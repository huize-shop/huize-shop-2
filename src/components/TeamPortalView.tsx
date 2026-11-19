import React, { useState } from 'react';
import {
  Product,
  TeamMemberPublicProfile,
  TeamMemberOrderSummary
} from '../types.ts';
import {
  formatFCFA,
  getBoutiqueShareUrl,
  getProductShareUrl,
  getProductPublicImageUrl,
  getProductWhatsAppShareUrl,
  shareProductWithPhotoAndLink
} from '../utils/whatsapp.ts';
import { loginTeamMemberOnServer } from '../firebase.ts';
import {
  KeyRound,
  Copy,
  Check,
  MessageCircle,
  Download,
  RefreshCw,
  LogOut,
  Search,
  ArrowLeft,
  Eye,
  EyeOff,
  Share2
} from 'lucide-react';

export interface TeamPortalSession {
  code: string;
  pin: string;
  member: TeamMemberPublicProfile;
  ordersCount: number;
  salesCount: number;
  recentOrders: TeamMemberOrderSummary[];
}

interface TeamPortalViewProps {
  products: Product[];
  session: TeamPortalSession | null;
  onLoginSuccess: (session: TeamPortalSession) => void;
  onLogout: () => void;
  onOpenShop: () => void;
  onShowToast: (msg: string) => void;
}

export const TeamPortalView: React.FC<TeamPortalViewProps> = ({
  products,
  session,
  onLoginSuccess,
  onLogout,
  onOpenShop,
  onShowToast
}) => {
  const [codeInput, setCodeInput] = useState('');
  const [pinInput, setPinInput] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [productSearch, setProductSearch] = useState('');

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = codeInput.trim().toUpperCase();
    const cleanPin = pinInput.trim();

    if (!cleanCode || !cleanPin) {
      setLoginError('Veuillez saisir votre code personnel et votre code PIN.');
      return;
    }

    setIsLoggingIn(true);
    setLoginError(null);

    try {
      const res = await loginTeamMemberOnServer(cleanCode, cleanPin);
      if (!res.success || !res.member) {
        setLoginError(res.error || 'Identifiants invalides.');
        return;
      }

      onLoginSuccess({
        code: res.member.code,
        pin: cleanPin,
        member: res.member,
        ordersCount: res.ordersCount || 0,
        salesCount: res.salesCount || 0,
        recentOrders: res.recentOrders || []
      });
      setPinInput('');
      onShowToast(`Bienvenue dans votre espace équipe, ${res.member.name}`);
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleRefreshStats = async () => {
    if (!session || isRefreshing) return;
    setIsRefreshing(true);
    try {
      const res = await loginTeamMemberOnServer(session.code, session.pin);
      if (res.success && res.member) {
        onLoginSuccess({
          ...session,
          member: res.member,
          ordersCount: res.ordersCount || 0,
          salesCount: res.salesCount || 0,
          recentOrders: res.recentOrders || []
        });
        onShowToast('Statistiques actualisées');
      } else {
        onShowToast(res.error || 'Impossible d’actualiser pour le moment');
      }
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleCopyText = async (text: string, labelId: string, toastText: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(labelId);
      onShowToast(toastText);
      setTimeout(() => setCopiedId(null), 2200);
    } catch {
      onShowToast('Impossible de copier automatiquement.');
    }
  };

  // Unauthenticated view: simple Code + PIN login (works cleanly on any shared device)
  if (!session) {
    return (
      <section className="py-10 sm:py-14 px-4 sm:px-6 max-w-4xl mx-auto">
        <div className="mb-6">
          <button
            type="button"
            onClick={onOpenShop}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-[#1F5A40] hover:underline cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Retour à la boutique</span>
          </button>
        </div>

        <div className="max-w-lg mx-auto bg-white border border-[#E1E3DA] rounded-2xl p-6 sm:p-8 shadow-sm">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-11 h-11 rounded-xl bg-[#123B2A] text-[#D8F36A] flex items-center justify-center shrink-0">
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold font-title text-[#123B2A]">
                Espace Équipe &amp; Partage
              </h1>
              <p className="text-xs text-[#6B726C]">
                Suivi personnel des clics, commandes et ventes HUIZE SHOP
              </p>
            </div>
          </div>

          <p className="text-xs sm:text-sm text-[#4A5568] bg-[#FAF9F5] border border-[#E1E3DA] rounded-xl p-3.5 leading-relaxed mb-5">
            Connectez-vous avec votre code personnel et votre PIN pour copier vos liens de partage ou consulter vos résultats.
            Si vous utilisez le téléphone d&apos;un collègue ou un ordinateur partagé, pensez simplement à vous déconnecter après consultation.
          </p>

          <form onSubmit={handleLoginSubmit} className="flex flex-col gap-4">
            <div>
              <label className="block text-xs font-bold text-[#123B2A] mb-1.5">
                Code personnel
              </label>
              <input
                type="text"
                required
                value={codeInput}
                onChange={(e) => setCodeInput(e.target.value.toUpperCase())}
                placeholder="Ex : MOUSA"
                autoComplete="username"
                className="w-full p-3 rounded-xl border border-[#E1E3DA] bg-[#FAF9F5] text-sm font-mono uppercase text-[#123B2A] focus:outline-[#1F5A40]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[#123B2A] mb-1.5">
                Code PIN personnel
              </label>
              <div className="relative">
                <input
                  type={showPin ? 'text' : 'password'}
                  required
                  inputMode="numeric"
                  value={pinInput}
                  onChange={(e) => setPinInput(e.target.value)}
                  placeholder="Ex : 4582"
                  autoComplete="current-password"
                  className="w-full p-3 pr-10 rounded-xl border border-[#E1E3DA] bg-[#FAF9F5] text-sm font-mono text-[#123B2A] focus:outline-[#1F5A40]"
                />
                <button
                  type="button"
                  onClick={() => setShowPin((prev) => !prev)}
                  aria-label={showPin ? 'Masquer le PIN' : 'Afficher le PIN'}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6B726C] hover:text-[#123B2A] cursor-pointer"
                >
                  {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {loginError && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs font-semibold text-red-700">
                {loginError}
              </div>
            )}

            <button
              type="submit"
              disabled={isLoggingIn}
              className="w-full py-3.5 px-5 rounded-xl bg-[#123B2A] hover:bg-[#1F5A40] disabled:opacity-60 text-white font-bold text-sm transition-colors cursor-pointer"
            >
              {isLoggingIn ? 'Vérification...' : 'Accéder à mon espace'}
            </button>
          </form>
        </div>
      </section>
    );
  }

  const { member, ordersCount, salesCount, recentOrders } = session;
  const boutiqueUrl = getBoutiqueShareUrl(member.code);
  const filteredProducts = products.filter((p) => {
    const q = productSearch.trim().toLowerCase();
    if (!q) return true;
    return (
      p.name.toLowerCase().includes(q) ||
      p.ref.toLowerCase().includes(q) ||
      p.categoryLabel.toLowerCase().includes(q)
    );
  });

  return (
    <section className="py-8 sm:py-12 px-4 sm:px-6 max-w-6xl mx-auto">
      {/* Top Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[#E1E3DA] mb-6">
        <div>
          <button
            type="button"
            onClick={onOpenShop}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-[#1F5A40] hover:underline mb-2 cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Retour à la boutique</span>
          </button>
          <h1 className="text-2xl sm:text-3xl font-bold font-title text-[#123B2A]">
            {member.name}
          </h1>
          <p className="text-xs sm:text-sm text-[#6B726C] mt-0.5">
            Code conseiller : <strong className="font-mono text-[#123B2A]">{member.code}</strong>
            <span aria-hidden="true"> · </span>
            <span>Suivi personnel en direct</span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={handleRefreshStats}
            disabled={isRefreshing}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-[#E1E3DA] bg-white hover:bg-[#FAF9F5] text-xs font-bold text-[#123B2A] transition-colors cursor-pointer disabled:opacity-50 whitespace-nowrap"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span>{isRefreshing ? 'Actualisation...' : 'Actualiser'}</span>
          </button>

          <button
            type="button"
            onClick={onLogout}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#123B2A] hover:bg-[#1F5A40] text-white text-xs font-bold transition-colors cursor-pointer whitespace-nowrap"
          >
            <LogOut className="w-3.5 h-3.5 text-[#D8F36A]" />
            <span>Se déconnecter</span>
          </button>
        </div>
      </div>

      {/* 3 Simple Progression Metrics: Clics, Commandes, Ventes validées */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <div className="bg-white border border-[#E1E3DA] rounded-2xl p-5 shadow-xs">
          <span className="text-xs font-bold uppercase tracking-wider text-[#6B726C]">
            Clics sur mes liens
          </span>
          <p className="text-3xl font-extrabold text-[#123B2A] font-title my-1.5 tabular-nums">
            {member.clicks}
          </p>
          <span className="text-xs text-[#6B726C]">
            Visites uniques ouvertes via vos liens
          </span>
        </div>

        <div className="bg-white border border-[#E1E3DA] rounded-2xl p-5 shadow-xs">
          <span className="text-xs font-bold uppercase tracking-wider text-[#6B726C]">
            Commandes générées
          </span>
          <p className="text-3xl font-extrabold text-[#123B2A] font-title my-1.5 tabular-nums">
            {ordersCount}
          </p>
          <span className="text-xs text-[#6B726C]">
            Paniers et demandes liés à votre code
          </span>
        </div>

        <div className="bg-white border border-[#E1E3DA] rounded-2xl p-5 shadow-xs">
          <span className="text-xs font-bold uppercase tracking-wider text-[#6B726C]">
            Ventes validées
          </span>
          <p className="text-3xl font-extrabold text-[#1F5A40] font-title my-1.5 tabular-nums">
            {salesCount}
          </p>
          <span className="text-xs text-[#6B726C]">
            Commandes confirmées payées ou livrées
          </span>
        </div>
      </div>

      {/* Personal Store Link + Offline Referral Explanation */}
      <div className="bg-white border border-[#E1E3DA] rounded-2xl p-5 sm:p-6 shadow-xs mb-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="max-w-xl">
            <h2 className="text-base sm:text-lg font-bold font-title text-[#123B2A]">
              Mon lien boutique personnel
            </h2>
            <p className="text-xs sm:text-sm text-[#6B726C] mt-1 leading-relaxed">
              Partagez ce lien ou communiquez simplement votre code{' '}
              <strong className="font-mono text-[#123B2A]">{member.code}</strong> à l&apos;oral : si un client saisit votre code au moment de commander sur WhatsApp, la commande vous est automatiquement attribuée.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 min-w-0 md:w-[440px]">
            <input
              type="text"
              readOnly
              value={boutiqueUrl}
              className="flex-1 bg-[#FAF9F5] border border-[#E1E3DA] rounded-lg px-3 py-2.5 text-xs font-mono text-[#202720] select-all"
            />
            <button
              type="button"
              onClick={() =>
                handleCopyText(
                  boutiqueUrl,
                  'boutique-link',
                  'Lien boutique copié avec votre code !'
                )
              }
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg bg-[#FAF9F5] hover:bg-[#EFEFE6] border border-[#E1E3DA] text-xs font-bold text-[#123B2A] cursor-pointer whitespace-nowrap"
            >
              {copiedId === 'boutique-link' ? (
                <Check className="w-3.5 h-3.5 text-[#1F5A40]" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
              <span>{copiedId === 'boutique-link' ? 'Copié' : 'Copier'}</span>
            </button>

            <a
              href={`https://wa.me/?text=${encodeURIComponent(
                `Découvre la boutique HUIZE SHOP (Baskets, Sandales & Vêtements à Ouagadougou) :\n${boutiqueUrl}`
              )}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg bg-[#25D366] hover:bg-[#20ba5a] text-white text-xs font-bold whitespace-nowrap"
            >
              <MessageCircle className="w-3.5 h-3.5 fill-white text-[#25D366]" />
              <span>WhatsApp</span>
            </a>
          </div>
        </div>
      </div>

      {/* Product Share List */}
      <div className="bg-white border border-[#E1E3DA] rounded-2xl p-5 sm:p-6 shadow-xs mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 mb-4 border-b border-[#E1E3DA]">
          <div>
            <h2 className="text-base sm:text-lg font-bold font-title text-[#123B2A]">
              Partager un article ({filteredProducts.length})
            </h2>
            <p className="text-xs text-[#6B726C]">
              Chaque lien produit ci-dessous inclut votre code personnel et la photo d&apos;aperçu WhatsApp.
            </p>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-[#6B726C] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Rechercher un article..."
              value={productSearch}
              onChange={(e) => setProductSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-[#FAF9F5] border border-[#E1E3DA] rounded-lg text-xs focus:outline-[#1F5A40]"
            />
          </div>
        </div>

        {filteredProducts.length === 0 ? (
          <p className="text-center py-8 text-xs text-[#6B726C]">
            Aucun article ne correspond à votre recherche.
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {filteredProducts.map((product) => {
              const prodShareUrl = getProductShareUrl(product.id, member.code);
              const prodImgUrl = getProductPublicImageUrl(product);
              const waShareHref = getProductWhatsAppShareUrl(product, member.code);
              const isCopied = copiedId === product.id;

              return (
                <div
                  key={product.id}
                  className="p-3.5 rounded-xl border border-[#E1E3DA] bg-[#FAF9F5] flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <img
                      src={product.images[0] || prodImgUrl}
                      alt={product.name}
                      referrerPolicy="no-referrer"
                      className="w-14 h-14 rounded-lg object-cover bg-white border border-[#E1E3DA] shrink-0"
                    />
                    <div className="min-w-0">
                      <p className="text-[11px] font-semibold text-[#6B726C] truncate">
                        {product.categoryLabel} · Réf {product.ref}
                      </p>
                      <h3 className="text-xs sm:text-sm font-bold text-[#123B2A] truncate">
                        {product.name}
                      </h3>
                      <p className="text-xs font-extrabold text-[#1F5A40] tabular-nums">
                        {formatFCFA(product.price)}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() =>
                        handleCopyText(
                          prodShareUrl,
                          product.id,
                          `Lien de "${product.name}" copié avec votre code !`
                        )
                      }
                      title="Copier le lien produit"
                      className="inline-flex items-center gap-1 px-2.5 py-2 rounded-lg bg-white hover:bg-[#EFEFE6] border border-[#E1E3DA] text-xs font-bold text-[#123B2A] cursor-pointer"
                    >
                      {isCopied ? (
                        <Check className="w-3.5 h-3.5 text-[#1F5A40]" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                      <span className="hidden sm:inline">{isCopied ? 'Copié' : 'Lien'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={async () => {
                        const outcome = await shareProductWithPhotoAndLink(product, member.code);
                        if (outcome === 'shared-with-file') {
                          onShowToast('Photo et lien partagés ensemble !');
                        } else if (outcome === 'unsupported') {
                          window.open(waShareHref, '_blank', 'noopener,noreferrer');
                        }
                      }}
                      title="Partager la photo et le lien sur WhatsApp"
                      className="inline-flex items-center gap-1 px-2.5 py-2 rounded-lg bg-[#25D366] hover:bg-[#20ba5a] text-white text-xs font-bold cursor-pointer"
                    >
                      <Share2 className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Partager</span>
                    </button>

                    <a
                      href={prodImgUrl}
                      download={`${(product.ref || product.id).replace(/[^a-zA-Z0-9_-]/g, '')}.jpg`}
                      title="Télécharger la photo"
                      className="p-2 rounded-lg bg-white hover:bg-[#EFEFE6] border border-[#E1E3DA] text-[#123B2A]"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Attributed Orders History (No client PII) */}
      <div className="bg-white border border-[#E1E3DA] rounded-2xl p-5 sm:p-6 shadow-xs">
        <h2 className="text-base sm:text-lg font-bold font-title text-[#123B2A] pb-3 mb-4 border-b border-[#E1E3DA]">
          Suivi des commandes attribuées à votre code ({ordersCount})
        </h2>

        {recentOrders.length === 0 ? (
          <p className="py-8 text-center text-xs sm:text-sm text-[#6B726C]">
            Aucune commande enregistrée sous le code {member.code} pour le moment.
          </p>
        ) : (
          <div className="divide-y divide-[#E1E3DA]">
            {recentOrders.map((ord) => {
              const isValidated = ord.status === 'paid' || ord.status === 'delivered';
              const resolvedThumbs =
                ord.items && ord.items.length > 0
                  ? ord.items.map((item) => ({
                      name: item.name,
                      image:
                        products.find((p) => p.id === item.productId)?.images?.[0] ||
                        item.image ||
                        `/api/products/${encodeURIComponent(item.productId)}/image.jpg`
                    }))
                  : products
                      .filter((p) =>
                        ord.itemsSummary.toLowerCase().includes(p.name.toLowerCase())
                      )
                      .slice(0, 3)
                      .map((p) => ({
                        name: p.name,
                        image: p.images[0] || `/api/products/${encodeURIComponent(p.id)}/image.jpg`
                      }));

              return (
                <div
                  key={ord.id}
                  className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs sm:text-sm"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {resolvedThumbs.length > 0 && (
                      <div className="flex -space-x-2 shrink-0">
                        {resolvedThumbs.slice(0, 3).map((thumb, idx) => (
                          <img
                            key={idx}
                            src={thumb.image}
                            alt={thumb.name}
                            className="w-10 h-10 rounded-lg object-cover bg-[#EFEFE6] border-2 border-white shadow-xs"
                          />
                        ))}
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="font-bold text-[#123B2A]">
                        {ord.id}
                        <span aria-hidden="true"> · </span>
                        <span className="font-normal text-[#6B726C]">{ord.date}</span>
                      </p>
                      <p className="text-xs text-[#4A5568] truncate">{ord.itemsSummary}</p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-4 shrink-0">
                    <span className="font-bold text-[#123B2A] tabular-nums">
                      {formatFCFA(ord.total)}
                    </span>
                    <span
                      className={`text-xs font-bold ${
                        isValidated ? 'text-[#1F5A40]' : 'text-[#6B726C]'
                      }`}
                    >
                      {ord.statusLabel}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
};
