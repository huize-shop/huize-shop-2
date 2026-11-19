export interface Product {
  id: string;
  name: string;
  category: 'chaussures' | 'sandales' | 'vetements' | string;
  categoryLabel: string;
  price: number; // in F CFA
  oldPrice?: number;
  badge?: 'Nouveau' | 'Promo' | 'Stock limité' | 'Top Vente' | 'Artisanal' | string;
  images: string[];
  sizes: string[];
  stock: number;
  ref: string;
  description: string;
  featured?: boolean;
  likes?: number;
}

export interface CartItem {
  product: Product;
  selectedSize: string;
  quantity: number;
}

export interface Category {
  id: string;
  name: string;
  icon: string;
  badge: string;
  itemCount: number;
  slug: string;
  image?: string;
  subtitle?: string;
}

export interface OrderItemSnapshot {
  productId: string;
  name: string;
  ref?: string;
  image?: string;
  size?: string;
  quantity: number;
  price: number;
}

export interface WhatsAppOrder {
  id: string;
  customerName: string;
  phone: string;
  itemsSummary: string;
  items?: OrderItemSnapshot[];
  total: number;
  status: 'pending' | 'delivered' | 'paid' | 'discussion';
  statusLabel: string;
  date: string;
  city: string;
  paymentMethod?: string;
  customerPhone?: string;
  customerCity?: string;
  referredByCode?: string;
  referredByName?: string;
  channel?: 'whatsapp' | 'site_chat';
  createdAt?: string;
}

export interface DailySiteStats {
  date: string; // YYYY-MM-DD
  visits: number;
  pageViews: number;
  whatsappClicks?: number;
  siteChatOrders?: number;
  updatedAt: string;
}

export interface DailyEvolutionPoint {
  date: string; // YYYY-MM-DD
  shortLabel: string;
  fullLabel: string;
  visits: number;
  pageViews: number;
  ordersCount: number;
  purchasesCount: number;
  revenue: number;
  totalOrderAmount: number;
  conversionRate: number;
}

export type ChatSenderRole = 'customer' | 'merchant' | 'system';

export interface OrderChatMessage {
  id: string;
  threadId: string;
  sender: ChatSenderRole;
  senderName: string;
  text: string;
  createdAt: string;
  attachedProduct?: OrderItemSnapshot;
}

export interface OrderThread {
  id: string;
  orderId: string;
  customerName: string;
  customerPhone: string;
  customerCity: string;
  paymentMethod: string;
  itemsSummary: string;
  items: OrderItemSnapshot[];
  total: number;
  status: WhatsAppOrder['status'];
  statusLabel: string;
  createdAt: string;
  updatedAt: string;
  lastMessageText: string;
  lastMessageSender: ChatSenderRole;
  unreadForCustomer: number;
  unreadForAdmin: number;
  referredByCode?: string;
  referredByName?: string;
}

export interface StoredCustomerChatSession {
  orderId: string;
  accessToken: string;
  customerName?: string;
}

export interface TeamMember {
  id: string;
  name: string;
  code: string;
  pin: string;
  phone?: string;
  active: boolean;
  clicks: number;
  createdAt: string;
}

export interface TeamMemberPublicProfile {
  id: string;
  name: string;
  code: string;
  phone?: string;
  active: boolean;
  clicks: number;
  createdAt: string;
}

export interface TeamMemberOrderSummary {
  id: string;
  itemsSummary: string;
  items?: OrderItemSnapshot[];
  total: number;
  status: WhatsAppOrder['status'];
  statusLabel: string;
  date: string;
}

export interface ClientLead {
  id: string;
  name: string;
  city: string;
  notes: string;
  phone: string;
  avatar: string;
}

export interface CustomerReview {
  id: string;
  authorName: string;
  city?: string;
  rating: number;
  comment: string;
  createdAt: string;
}

export interface CarouselSlide {
  id: number;
  kicker: string;
  title: string;
  desc: string;
  category: string;
  image: string;
  ctaText: string;
  whatsappMessage?: string;
}

export interface SiteMediaConfig {
  logoUrl?: string;
  heroImage: string;
  heroImages?: string[];
  heroTagline?: string;
  heroTitle?: string;
  heroSubtitle?: string;
  carouselSlides: CarouselSlide[];
}

declare global {
  interface Window {
    __HUIZE_INITIAL_CATALOG__?: {
      products: Product[];
      categories: Category[];
      mediaConfig: SiteMediaConfig;
      updatedAt?: number;
      source?: string;
    };
  }
}
