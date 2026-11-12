import { Category, ClientLead, Product, WhatsAppOrder, SiteMediaConfig, CarouselSlide } from '../types.ts';

export const HERO_IMAGE = '/src/assets/images/hero_fashion_burkina_1794167660891.jpg';
export const VELOCITY_SNEAKER_IMG = '/src/assets/images/product_velocity_sneakers_1794167661807.jpg';
export const SAHEL_SANDAL_IMG = '/src/assets/images/product_sahel_leather_sandals_1794167662030.jpg';
export const STREET_TSHIRT_IMG = '/src/assets/images/product_streetwear_tshirt_1794167662293.jpg';

export const INITIAL_PRODUCTS: Product[] = [
  {
    id: 'prod-hz-b01',
    ref: 'HZ-B01',
    name: 'Sneaker Urbaine Velocity Red',
    category: 'chaussures',
    categoryLabel: 'Baskets',
    price: 22500,
    oldPrice: 28000,
    badge: 'Nouveau',
    images: [VELOCITY_SNEAKER_IMG],
    sizes: ['39', '40', '41', '42', '43', '44'],
    stock: 14,
    description:
      'Conçue pour un confort optimal tout au long de la journée, la Velocity Red combine une semelle amortissante sculptée en mousse EVA et une tige respirante en mesh technique. Idéale pour les sorties, les cours et le style urbain affirmé au Burkina Faso.',
    featured: true
  },
  {
    id: 'prod-hz-b02',
    ref: 'HZ-B02',
    name: 'Sneaker Canvas Low Black & White',
    category: 'chaussures',
    categoryLabel: 'Baskets',
    price: 18000,
    oldPrice: 21000,
    badge: 'Promo',
    images: [
      'https://images.unsplash.com/photo-1525966222134-fcfa99b8ae77?w=700&auto=format&fit=crop&q=80',
      VELOCITY_SNEAKER_IMG
    ],
    sizes: ['40', '41', '42', '43', '44'],
    stock: 8,
    description:
      'Basket classique en toile résistante noire et semelle vulcanisée blanche antidérapante. Profil intemporel, passe-partout et ultra confortable avec tous types de pantalons ou bermudas.',
    featured: true
  },
  {
    id: 'prod-hz-s01',
    ref: 'HZ-S01',
    name: 'Sandale Cuir Tressé Confort Sahel',
    category: 'sandales',
    categoryLabel: 'Sandales',
    price: 15000,
    oldPrice: 17500,
    badge: 'Artisanal',
    images: [SAHEL_SANDAL_IMG],
    sizes: ['40', '41', '42', '43', '44'],
    stock: 3,
    description:
      'Façonnée dans un cuir véritable pleine fleur avec tressage traditionnel soigné. Semelle intérieure rembourrée pour une excellente absorption des chocs et lanières souples qui ne blessent pas le pied par fortes chaleurs.',
    featured: true
  },
  {
    id: 'prod-hz-s02',
    ref: 'HZ-S02',
    name: 'Mule Homme Premium Double Boucle',
    category: 'sandales',
    categoryLabel: 'Sandales',
    price: 16500,
    oldPrice: 19000,
    badge: 'Top Vente',
    images: [
      'https://images.unsplash.com/photo-1603808033192-082d6919d3e1?w=700&auto=format&fit=crop&q=80',
      SAHEL_SANDAL_IMG
    ],
    sizes: ['39', '41', '42', '44'],
    stock: 11,
    description:
      'Mule ergonomique en cuir noir avec deux boucles ajustables en métal brossé. Semelle anatomique en liège et caoutchouc haute résistance pour un maintien impeccable du pied.',
    featured: true
  },
  {
    id: 'prod-hz-v01',
    ref: 'HZ-V01',
    name: 'Ensemble T-shirt Street Signature',
    category: 'vetements',
    categoryLabel: 'Vêtements',
    price: 12500,
    oldPrice: 15000,
    badge: 'Stock limité',
    images: [STREET_TSHIRT_IMG],
    sizes: ['M', 'L', 'XL', 'XXL'],
    stock: 6,
    description:
      'T-shirt oversize en coton peigné dense (240 g/m²) couleur vert forêt profond avec broderie discrète HUIZE. Finition col renforcé, coupe décontractée moderne qui résiste aux lavages répétitifs.',
    featured: true
  },
  {
    id: 'prod-hz-v02',
    ref: 'HZ-V02',
    name: 'Chemise Légère Lin Décontractée',
    category: 'vetements',
    categoryLabel: 'Vêtements',
    price: 14000,
    oldPrice: 16500,
    badge: 'Nouveau',
    images: [
      'https://images.unsplash.com/photo-1596755094514-f87e34085b2c?w=700&auto=format&fit=crop&q=80',
      STREET_TSHIRT_IMG
    ],
    sizes: ['S', 'M', 'L', 'XL'],
    stock: 0,
    description:
      'Chemise à manches courtes en lin naturel respirant. Idéale pour rester élégant sous le soleil ouagalais, col cubain ouvert et coupe fluide.',
    featured: false
  },
  {
    id: 'prod-hz-b03',
    ref: 'HZ-B03',
    name: 'Air Retro Color Block Pastel',
    category: 'chaussures',
    categoryLabel: 'Baskets',
    price: 26000,
    oldPrice: 30000,
    badge: 'Nouveau',
    images: [
      'https://images.unsplash.com/photo-1552346154-21d32810aba3?w=700&auto=format&fit=crop&q=80',
      VELOCITY_SNEAKER_IMG
    ],
    sizes: ['38', '39', '40', '41', '42', '43'],
    stock: 9,
    description:
      'Sneaker montante rétro aux empiècements pastel contrastés. Confort matelassé autour de la cheville et semelle à bulle d’air apparente pour un amorti dynamique.',
    featured: true
  },
  {
    id: 'prod-hz-b04',
    ref: 'HZ-B04',
    name: 'Basket Streetwear Chunky White',
    category: 'chaussures',
    categoryLabel: 'Baskets',
    price: 24000,
    oldPrice: 28000,
    badge: 'Top Vente',
    images: [
      'https://images.unsplash.com/photo-1549298916-b41d501d3772?w=700&auto=format&fit=crop&q=80',
      VELOCITY_SNEAKER_IMG
    ],
    sizes: ['40', '41', '42', '43', '44', '45'],
    stock: 12,
    description:
      'Silhouette chunky audacieuse toute blanche avec semelle surdimensionnée crantée. Un incontournable du streetwear moderne pour accompagner jeans amples et joggings.',
    featured: true
  }
];

export const INITIAL_CATEGORIES: Category[] = [
  {
    id: 'cat-chaussures',
    name: 'Baskets',
    icon: '👟',
    badge: 'TOP',
    itemCount: 4,
    slug: 'chaussures'
  },
  {
    id: 'cat-sandales',
    name: 'Sandales',
    icon: '👡',
    badge: 'CUIR',
    itemCount: 2,
    slug: 'sandales'
  },
  {
    id: 'cat-vetements',
    name: 'Vêtements',
    icon: '👕',
    badge: 'MODE',
    itemCount: 2,
    slug: 'vetements'
  }
];

export const INITIAL_ORDERS: WhatsAppOrder[] = [
  {
    id: 'CMD-1084',
    customerName: 'Ibrahim Ouédraogo',
    phone: '+226 70 12 34 56',
    itemsSummary: '1x Sneaker Velocity Red (Pointure 42)',
    total: 22500,
    status: 'pending',
    statusLabel: 'À livrer',
    date: "Aujourd'hui, 10:45",
    city: 'Ouagadougou, Zone du Bois'
  },
  {
    id: 'CMD-1083',
    customerName: 'Salif Kaboré',
    phone: '+226 76 98 76 54',
    itemsSummary: '1x Sandale Sahel (41) + 1x T-shirt (L)',
    total: 27500,
    status: 'paid',
    statusLabel: 'Payé (Moov Money)',
    date: "Aujourd'hui, 09:20",
    city: 'Bobo-Dioulasso, Koko'
  },
  {
    id: 'CMD-1082',
    customerName: 'Aminata Sawadogo',
    phone: '+226 55 43 21 00',
    itemsSummary: 'Panier envoyé via WhatsApp (2 articles)',
    total: 37500,
    status: 'discussion',
    statusLabel: 'En discussion',
    date: 'Hier, 17:15',
    city: 'Ouagadougou, Karpala'
  }
];

export const INITIAL_LEADS: ClientLead[] = [
  {
    id: 'lead-1',
    name: 'Ibrahim Ouédraogo',
    city: 'Ouagadougou',
    notes: 'Intéressé par Sneaker Velocity (42)',
    phone: '+226 70 12 34 56',
    avatar: 'IO'
  },
  {
    id: 'lead-2',
    name: 'Salif Kaboré',
    city: 'Bobo-Dioulasso',
    notes: 'Acheté Sandale Sahel (41) - Proposer chemise lin',
    phone: '+226 76 98 76 54',
    avatar: 'SK'
  },
  {
    id: 'lead-3',
    name: 'Aminata Sawadogo',
    city: 'Karpala, Ouaga',
    notes: 'Panier en attente (37 500 F) - Confirmation adresse',
    phone: '+226 55 43 21 00',
    avatar: 'AS'
  },
  {
    id: 'lead-4',
    name: 'Moussa Traoré',
    city: 'Ouaga 2000',
    notes: 'T-shirt Signature (XL) en attente réappro',
    phone: '+226 78 22 11 33',
    avatar: 'MT'
  },
  {
    id: 'lead-5',
    name: 'Fatou Zongo',
    city: '1200 Logements, Ouaga',
    notes: 'Demande conseil pointure 39 pour baskets pastel',
    phone: '+226 71 44 55 66',
    avatar: 'FZ'
  }
];

// LocalStorage Persistence helpers
const STORAGE_KEYS = {
  PRODUCTS: 'huize_shop_products_v1',
  CATEGORIES: 'huize_shop_categories_v1',
  CART: 'huize_shop_cart_v1',
  ORDERS: 'huize_shop_orders_v1'
};

export function loadStoredProducts(): Product[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.PRODUCTS);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.error('Failed to load products from storage', e);
  }
  return INITIAL_PRODUCTS;
}

export function saveStoredProducts(products: Product[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(products));
  } catch (e) {
    console.error('Failed to save products to storage', e);
  }
}

export function loadStoredCategories(): Category[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.CATEGORIES);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.error('Failed to load categories', e);
  }
  return INITIAL_CATEGORIES;
}

export function saveStoredCategories(categories: Category[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.CATEGORIES, JSON.stringify(categories));
  } catch (e) {
    console.error('Failed to save categories', e);
  }
}

export const INITIAL_CAROUSEL_SLIDES: CarouselSlide[] = [
  {
    id: 1,
    kicker: 'HUIZE SHOP • NOUVELLE COLLECTION',
    title: 'Sneakers & Baskets Tendance 2025',
    desc: 'Modèles exclusifs légers et amortissants adaptés au climat et aux rues de Ouagadougou.',
    category: 'chaussures',
    image: VELOCITY_SNEAKER_IMG,
    ctaText: 'Explorer les baskets'
  },
  {
    id: 2,
    kicker: 'SAVOIR-FAIRE & CONFORT SAHEL',
    title: 'Sandales & Mules en Cuir Véritable',
    desc: 'Tressage artisanal et semelles ergonomiques pour un style traditionnel et moderne.',
    category: 'sandales',
    image: SAHEL_SANDAL_IMG,
    ctaText: 'Découvrir les sandales'
  },
  {
    id: 3,
    kicker: 'STREETWEAR ÉLÉGANT & COTON PEIGNÉ',
    title: 'T-Shirts & Chemises Décontractées',
    desc: 'Matières naturelles respirantes pour rester au frais sans compromis sur l’allure.',
    category: 'vetements',
    image: STREET_TSHIRT_IMG,
    ctaText: 'Voir la mode vêtements'
  }
];

export const INITIAL_MEDIA_CONFIG: SiteMediaConfig = {
  heroImage: HERO_IMAGE,
  heroTagline: 'Ton style, ta signature',
  heroTitle: 'Affirme ton style avec HUIZE SHOP',
  heroSubtitle:
    'Baskets, sandales et vêtements tendance sélectionnés avec soin pour le quotidien et les grandes occasions au Burkina Faso. Choisis tes articles, puis finalise ta commande directement sur WhatsApp en toute confiance.',
  carouselSlides: INITIAL_CAROUSEL_SLIDES
};

export const MEDIA_STORAGE_KEY = 'huize_shop_media_config_v1';

export function loadStoredMediaConfig(): SiteMediaConfig {
  try {
    const raw = localStorage.getItem(MEDIA_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.error('Failed to load media config from storage', e);
  }
  return INITIAL_MEDIA_CONFIG;
}

export function saveStoredMediaConfig(config: SiteMediaConfig): void {
  try {
    localStorage.setItem(MEDIA_STORAGE_KEY, JSON.stringify(config));
  } catch (e) {
    console.error('Failed to save media config to storage', e);
  }
}

