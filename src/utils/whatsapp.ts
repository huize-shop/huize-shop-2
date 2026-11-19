import { CartItem, Product } from '../types.ts';

/**
 * Official WhatsApp Contact for HUIZE SHOP
 * Specified by user: 22653742748
 */
export const WHATSAPP_NUMBER = '22653742748';
export const WHATSAPP_DISPLAY = '+226 53 74 27 48';

/**
 * Formats a price in Francs CFA with thousand separators
 */
export function formatFCFA(amount: number): string {
  return amount.toLocaleString('fr-FR') + ' F CFA';
}

const REFERRAL_STORAGE_KEY = 'huize_referral_code_v1';
const REFERRAL_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

/**
 * Normalizes a referral/advisor code to uppercase alphanumeric + dash/underscore
 */
export function normalizeReferralCode(code?: string | null): string {
  return (code || '').trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '');
}

/**
 * Stores referral code locally for 30 days so customer orders are attributed even if they return later
 */
export function saveStoredReferralCode(code: string): string {
  const clean = normalizeReferralCode(code);
  if (!clean) return '';
  try {
    localStorage.setItem(
      REFERRAL_STORAGE_KEY,
      JSON.stringify({ code: clean, expiresAt: Date.now() + REFERRAL_TTL_MS })
    );
  } catch {
    // Ignore storage errors
  }
  return clean;
}

/**
 * Reads active referral code from localStorage if not expired
 */
export function getStoredReferralCode(): string {
  try {
    const raw = localStorage.getItem(REFERRAL_STORAGE_KEY);
    if (!raw) return '';
    const parsed = JSON.parse(raw) as { code?: string; expiresAt?: number };
    if (!parsed?.code || (parsed.expiresAt && Date.now() > parsed.expiresAt)) {
      localStorage.removeItem(REFERRAL_STORAGE_KEY);
      return '';
    }
    return normalizeReferralCode(parsed.code);
  } catch {
    return '';
  }
}

/**
 * Safely gets the current browser origin for shareable & WhatsApp-friendly URLs
 */
export function getAppOrigin(): string {
  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin;
  }
  return '';
}

/**
 * Builds the boutique root share URL with optional team member referral code
 */
export function getBoutiqueShareUrl(refCode?: string): string {
  const origin = getAppOrigin();
  const cleanRef = normalizeReferralCode(refCode);
  return cleanRef ? `${origin}/?ref=${encodeURIComponent(cleanRef)}` : `${origin}/`;
}

/**
 * Builds the canonical deep-link URL for a product (with server-side Open Graph preview & optional referral code)
 */
export function getProductShareUrl(productId: string, refCode?: string): string {
  const origin = getAppOrigin();
  const cleanRef = normalizeReferralCode(refCode);
  const base = `${origin}/?produit=${encodeURIComponent(productId)}`;
  return cleanRef ? `${base}&ref=${encodeURIComponent(cleanRef)}` : base;
}

/**
 * Builds a single visual order preview URL (renders product photo for 1 item, or collage of up to 4 products)
 */
export function getOrderPreviewUrl(productIds: string[], refCode?: string): string {
  const uniqueIds = Array.from(new Set(productIds.filter(Boolean)));
  if (uniqueIds.length === 1) {
    return getProductShareUrl(uniqueIds[0], refCode);
  }
  const origin = getAppOrigin();
  const cleanRef = normalizeReferralCode(refCode);
  const base = `${origin}/?commande=${encodeURIComponent(uniqueIds.join(','))}`;
  return cleanRef ? `${base}&ref=${encodeURIComponent(cleanRef)}` : base;
}

/**
 * Builds a reliable HTTPS image URL served by our backend (/api/products/:id/image.jpg)
 * Works for base64 admin uploads, local bundled images, and remote URLs.
 */
export function getProductPublicImageUrl(product: Product): string {
  const origin = getAppOrigin();
  return `${origin}/api/products/${encodeURIComponent(product.id)}/image.jpg`;
}

/**
 * Resolves a lightweight, Firestore-safe thumbnail URL for a product (never stores huge base64 inside order docs)
 */
export function getCompactProductThumbnail(product: Product): string {
  const firstImg = product.images?.[0];
  if (!firstImg || firstImg.startsWith('data:')) {
    return `/api/products/${encodeURIComponent(product.id)}/image.jpg`;
  }
  return firstImg;
}

/**
 * Builds clean single-URL WhatsApp share link (only product link so WhatsApp shows the photo preview card cleanly)
 */
export function getProductWhatsAppShareUrl(product: Product, refCode?: string): string {
  const shareUrl = getProductShareUrl(product.id, refCode);
  const text = `Découvre ${product.name} à ${formatFCFA(product.price)} sur HUIZE SHOP 🇧🇫\n\n${shareUrl}`;
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}

/**
 * Attempts native share with the actual image file + clickable product link together.
 * Returns 'shared-with-file' | 'shared-link' | 'cancelled' | 'unsupported'
 */
export async function shareProductWithPhotoAndLink(
  product: Product,
  refCode?: string
): Promise<'shared-with-file' | 'shared-link' | 'cancelled' | 'unsupported'> {
  if (typeof navigator === 'undefined' || typeof navigator.share !== 'function') {
    return 'unsupported';
  }

  const shareUrl = getProductShareUrl(product.id, refCode);
  const publicImageUrl = getProductPublicImageUrl(product);
  const shareText = `Découvre ${product.name} à ${formatFCFA(product.price)} sur HUIZE SHOP 🇧🇫\n\n👉 Voir et commander : ${shareUrl}`;

  let imageFile: File | null = null;
  try {
    const res = await fetch(publicImageUrl);
    if (res.ok) {
      const blob = await res.blob();
      const ext = blob.type.includes('png') ? 'png' : 'jpg';
      const safeFileName = `${(product.ref || product.id).replace(/[^a-zA-Z0-9_-]/g, '')}.${ext}`;
      imageFile = new File([blob], safeFileName, { type: blob.type || 'image/jpeg' });
    }
  } catch {
    // Ignore fetch errors and fall back to link share
  }

  try {
    if (
      imageFile &&
      typeof navigator.canShare === 'function' &&
      navigator.canShare({ files: [imageFile] })
    ) {
      await navigator.share({
        files: [imageFile],
        title: `HUIZE SHOP — ${product.name}`,
        text: shareText
      });
      return 'shared-with-file';
    }

    await navigator.share({
      title: `HUIZE SHOP — ${product.name}`,
      text: `Découvre ${product.name} à ${formatFCFA(product.price)} sur HUIZE SHOP 🇧🇫`,
      url: shareUrl
    });
    return 'shared-link';
  } catch (err: any) {
    if (err?.name === 'AbortError') {
      return 'cancelled';
    }
    return 'unsupported';
  }
}

/**
 * Generates direct WhatsApp click-to-chat URL for an individual product order
 * Keeps ONLY 1 clean product URL (with OG photo preview) so WhatsApp shows the image directly without image-link clutter.
 */
export function getProductWhatsAppUrl(
  product: Product,
  selectedSize?: string,
  quantity: number = 1,
  referralCode?: string
): string {
  const total = product.price * quantity;
  const hasSizes = product.sizes && product.sizes.length > 0;
  const sizeDisplay = selectedSize
    ? selectedSize
    : hasSizes
    ? `${product.sizes[0]} (Tailles en stock : ${product.sizes.join(', ')})`
    : 'Standard';

  const cleanRef = normalizeReferralCode(referralCode);
  const productUrl = getProductShareUrl(product.id, cleanRef || undefined);

  const message = [
    productUrl,
    ``,
    `Bonjour HUIZE SHOP,`,
    `Je souhaite commander cet article :`,
    `• Produit : ${product.name}`,
    `• Réf : ${product.ref}`,
    `• Pointure / Taille : ${sizeDisplay}`,
    `• Quantité : ${quantity}`,
    `• Prix unitaire : ${formatFCFA(product.price)}`,
    quantity > 1 ? `• Total : ${formatFCFA(total)}` : null,
    cleanRef ? `• Conseiller / Équipe : ${cleanRef}` : null,
    ``,
    `Pouvez-vous me confirmer la disponibilité et la livraison rapide à Ouagadougou ? Merci !`
  ]
    .filter((line) => line !== null)
    .join('\n');

  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
}

/**
 * Generates direct WhatsApp click-to-chat URL for the entire shopping cart
 * Keeps ONLY 1 single order preview URL (showing the product photo or multi-product collage in WhatsApp).
 */
export function getCartWhatsAppUrl(
  cartItems: CartItem[],
  customerInfo?: {
    name?: string;
    phone?: string;
    neighborhood?: string;
    paymentMethod?: string;
    referralCode?: string;
  }
): string {
  const total = cartItems.reduce((acc, item) => acc + item.product.price * item.quantity, 0);
  const cleanRef = normalizeReferralCode(customerInfo?.referralCode);
  const orderPreviewUrl = getOrderPreviewUrl(
    cartItems.map((item) => item.product.id),
    cleanRef || undefined
  );

  const lines = [
    orderPreviewUrl,
    ``,
    `Bonjour HUIZE SHOP ! 👋`,
    `Je souhaite valider ma commande avec les articles suivants :`,
    ``
  ];

  cartItems.forEach((item, index) => {
    lines.push(
      `${index + 1}. ${item.product.name} (Réf : ${item.product.ref} • Taille : ${item.selectedSize}) — Qté : ${item.quantity} × ${formatFCFA(item.product.price)}`
    );
  });

  lines.push(``);
  lines.push(`💰 TOTAL ESTIMÉ : ${formatFCFA(total)}`);

  if (customerInfo?.name || customerInfo?.neighborhood || cleanRef) {
    lines.push(``);
    lines.push(`📋 INFORMATIONS DE LIVRAISON :`);
    if (customerInfo?.name) lines.push(`• Nom : ${customerInfo.name}`);
    if (customerInfo?.phone) lines.push(`• Téléphone : ${customerInfo.phone}`);
    if (customerInfo?.neighborhood) lines.push(`• Ville / Quartier : ${customerInfo.neighborhood}`);
    if (customerInfo?.paymentMethod) lines.push(`• Mode de paiement souhaité : ${customerInfo.paymentMethod}`);
    if (cleanRef) lines.push(`• Conseiller / Équipe : ${cleanRef}`);
  }

  lines.push(``);
  lines.push(`Merci de me confirmer la commande et les frais de livraison !`);

  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(lines.join('\n'))}`;
}

/**
 * Generates WhatsApp URL for customer service inquiry
 */
export function getContactWhatsAppUrl(name: string, phone: string, subject: string, message: string): string {
  const lines = [
    `Bonjour HUIZE SHOP,`,
    ``,
    name ? `Nom : ${name}` : null,
    phone ? `Téléphone : ${phone}` : null,
    subject ? `Sujet : ${subject}` : null,
    ``,
    message ? `Message : ${message}` : `J'ai une question concernant vos articles et les livraisons.`,
  ].filter(Boolean);

  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(lines.join('\n'))}`;
}

/**
 * Generates WhatsApp URL for direct chat with no pre-fill or simple greeting
 */
export function getDirectWhatsAppUrl(greeting: string = 'Bonjour HUIZE SHOP, je souhaite me renseigner sur vos articles.'): string {
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(greeting)}`;
}

/**
 * Generates WhatsApp URL for supplier partnership inquiries in Burkina Faso
 */
export function getSupplierWhatsAppUrl(
  businessName: string,
  category: string,
  city: string,
  details?: string
): string {
  const lines = [
    `Bonjour l'équipe HUIZE SHOP,`,
    `Je souhaite collaborer avec votre boutique en tant que fournisseur au Burkina Faso.`,
    ``,
    businessName ? `• Nom / Entreprise : ${businessName}` : null,
    category ? `• Articles proposés : ${category}` : null,
    city ? `• Ville / Quartier : ${city}` : null,
    details ? `• Précisions : ${details}` : null,
    ``,
    `Merci de m'indiquer les conditions pour intégrer vos partenaires fournisseurs.`
  ].filter(Boolean);

  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(lines.join('\n'))}`;
}
