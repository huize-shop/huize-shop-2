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
}

export interface WhatsAppOrder {
  id: string;
  customerName: string;
  phone: string;
  itemsSummary: string;
  total: number;
  status: 'pending' | 'delivered' | 'paid' | 'discussion';
  statusLabel: string;
  date: string;
  city: string;
  paymentMethod?: string;
  customerPhone?: string;
  customerCity?: string;
}

export interface ClientLead {
  id: string;
  name: string;
  city: string;
  notes: string;
  phone: string;
  avatar: string;
}
