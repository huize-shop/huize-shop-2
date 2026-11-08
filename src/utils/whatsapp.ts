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
 * Generates direct WhatsApp click-to-chat URL for an individual product order
 */
export function getProductWhatsAppUrl(
  product: Product,
  selectedSize: string,
  quantity: number = 1
): string {
  const total = product.price * quantity;
  const message = [
    `Bonjour HUIZE SHOP,`,
    `Je souhaite commander cet article :`,
    `• ${product.name}`,
    `• Réf : ${product.ref}`,
    `• Pointure / Taille : ${selectedSize || 'Non spécifiée'}`,
    `• Quantité : ${quantity}`,
    `• Prix unitaire : ${formatFCFA(product.price)}`,
    quantity > 1 ? `• Total : ${formatFCFA(total)}` : null,
    ``,
    `Pouvez-vous me confirmer la disponibilité et le délai de livraison à Ouagadougou ? Merci !`
  ]
    .filter(Boolean)
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
    lines.push(
      `${index + 1}. ${item.product.name} (Taille : ${item.selectedSize}) - Qté : ${item.quantity} × ${formatFCFA(item.product.price)}`
    );
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
