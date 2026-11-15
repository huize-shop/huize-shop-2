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
 * Builds the canonical deep-link URL for a product (with server-side Open Graph preview)
 */
export function getProductShareUrl(productId: string): string {
  const origin = getAppOrigin();
  return `${origin}/?produit=${encodeURIComponent(productId)}`;
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
 * Generates direct WhatsApp click-to-chat URL for an individual product order
 */
export function getProductWhatsAppUrl(
  product: Product,
  selectedSize?: string,
  quantity: number = 1
): string {
  const total = product.price * quantity;
  const hasSizes = product.sizes && product.sizes.length > 0;
  const sizeDisplay = selectedSize
    ? selectedSize
    : hasSizes
    ? `${product.sizes[0]} (Tailles en stock : ${product.sizes.join(', ')})`
    : 'Standard';

  const productUrl = getProductShareUrl(product.id);
  const imageUrl = getProductPublicImageUrl(product);

  const message = [
    `Bonjour HUIZE SHOP,`,
    `Je souhaite commander directement cet article :`,
    `• Produit : ${product.name}`,
    `• Réf : ${product.ref}`,
    `• Pointure / Taille : ${sizeDisplay}`,
    `• Quantité : ${quantity}`,
    `• Prix unitaire : ${formatFCFA(product.price)}`,
    quantity > 1 ? `• Total : ${formatFCFA(total)}` : null,
    ``,
    `👉 Voir l'article : ${productUrl}`,
    `🖼️ Photo du produit : ${imageUrl}`,
    ``,
    `Pouvez-vous me confirmer la disponibilité et la livraison rapide à Ouagadougou ? Merci !`
  ]
    .filter((line) => line !== null)
    .join('\n');

  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
}

/**
 * Generates direct WhatsApp click-to-chat URL for the entire shopping cart
 */
export function getCartWhatsAppUrl(
  cartItems: CartItem[],
  customerInfo?: { name?: string; phone?: string; neighborhood?: string; paymentMethod?: string }
): string {
  const total = cartItems.reduce((acc, item) => acc + item.product.price * item.quantity, 0);

  const lines = [
    `Bonjour HUIZE SHOP ! 👋`,
    `Je souhaite valider ma commande avec les articles suivants :`,
    ``
  ];

  cartItems.forEach((item, index) => {
    const productUrl = getProductShareUrl(item.product.id);
    const imageUrl = getProductPublicImageUrl(item.product);
    lines.push(
      `${index + 1}. ${item.product.name} (Réf : ${item.product.ref} • Taille : ${item.selectedSize}) - Qté : ${item.quantity} × ${formatFCFA(item.product.price)}`
    );
    lines.push(`   🔗 Article : ${productUrl}`);
    lines.push(`   🖼️ Photo : ${imageUrl}`);
  });

  lines.push(``);
  lines.push(`💰 TOTAL ESTIMÉ : ${formatFCFA(total)}`);

  if (customerInfo?.name || customerInfo?.neighborhood) {
    lines.push(``);
    lines.push(`📋 INFORMATIONS DE LIVRAISON :`);
    if (customerInfo.name) lines.push(`• Nom : ${customerInfo.name}`);
    if (customerInfo.phone) lines.push(`• Téléphone : ${customerInfo.phone}`);
    if (customerInfo.neighborhood) lines.push(`• Ville / Quartier : ${customerInfo.neighborhood}`);
    if (customerInfo.paymentMethod) lines.push(`• Mode de paiement souhaité : ${customerInfo.paymentMethod}`);
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

