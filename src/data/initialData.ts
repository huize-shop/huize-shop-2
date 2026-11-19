import { Category, ClientLead, Product, WhatsAppOrder, SiteMediaConfig, CarouselSlide } from '../types.ts';

export const HERO_IMAGE = '/src/assets/images/hero_fashion_burkina_1794167660891.jpg';
export const HERO_PROMO_DELIVERY_IMG = '/src/assets/images/hero_promo_livraison_gratuite_1795021552417.jpg';
export const HERO_PROMO_COD_IMG = '/src/assets/images/hero_promo_paiement_livraison_1795021553278.jpg';
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
    subtitle: 'Sneakers & Street',
    image: VELOCITY_SNEAKER_IMG,
    itemCount: 4,
    slug: 'chaussures'
  },
  {
    id: 'cat-sandales',
    name: 'Sandales',
    icon: '👡',
    badge: 'CUIR',
    subtitle: 'Artisanal & Sahel',
    image: SAHEL_SANDAL_IMG,
    itemCount: 2,
    slug: 'sandales'
  },
  {
    id: 'cat-vetements',
    name: 'Vêtements',
    icon: '👕',
    badge: 'MODE',
    subtitle: 'T-Shirts & Chemises',
    image: STREET_TSHIRT_IMG,
    itemCount: 2,
    slug: 'vetements'
  }
];

export const INITIAL_ORDERS: WhatsAppOrder[] = [];

export const INITIAL_LEADS: ClientLead[] = [];

// LocalStorage Persistence helpers (compact v2 keys so 4MB+ base64 never overflows 5MB browser quota)
const STORAGE_KEYS = {
  PRODUCTS: 'huize_shop_products_v2',
  CATEGORIES: 'huize_shop_categories_v2',
  CART: 'huize_shop_cart_v1',
  ORDERS: 'huize_shop_orders_v1'
};

export const MEDIA_STORAGE_KEY = 'huize_shop_media_config_v2';

function cleanupLegacyStorageOnce() {
  try {
    localStorage.removeItem('huize_shop_products_v1');
    localStorage.removeItem('huize_shop_categories_v1');
    localStorage.removeItem('huize_shop_media_config_v1');
  } catch {
    // Ignore storage cleanup errors
  }
}

export interface BootstrapCatalogState {
  products: Product[];
  categories: Category[];
  mediaConfig: SiteMediaConfig;
  ready: boolean;
}

export function getBootstrapCatalog(): BootstrapCatalogState {
  cleanupLegacyStorageOnce();

  // 1. Server-injected live snapshot in <head> (0ms, always up-to-date)
  if (typeof window !== 'undefined' && window.__HUIZE_INITIAL_CATALOG__) {
    const boot = window.__HUIZE_INITIAL_CATALOG__;
    if (Array.isArray(boot.products) && Array.isArray(boot.categories) && boot.mediaConfig) {
      saveStoredProducts(boot.products);
      saveStoredCategories(boot.categories);
      saveStoredMediaConfig(boot.mediaConfig);
      return {
        products: boot.products,
        categories: boot.categories,
        mediaConfig: boot.mediaConfig,
        ready: true
      };
    }
  }

  // 2. Previously synced v2 localStorage cache
  try {
    const rawProds = localStorage.getItem(STORAGE_KEYS.PRODUCTS);
    const rawCats = localStorage.getItem(STORAGE_KEYS.CATEGORIES);
    const rawMedia = localStorage.getItem(MEDIA_STORAGE_KEY);
    if (rawProds && rawCats && rawMedia) {
      const parsedProds = JSON.parse(rawProds);
      const parsedCats = JSON.parse(rawCats);
      const parsedMedia = JSON.parse(rawMedia);
      if (Array.isArray(parsedProds) && parsedProds.length > 0 && Array.isArray(parsedCats) && parsedMedia) {
        return {
          products: parsedProds,
          categories: parsedCats,
          mediaConfig: parsedMedia,
          ready: true
        };
      }
    }
  } catch (e) {
    console.error('Failed to load v2 catalog cache', e);
  }

  // 3. Cold start without HTML bootstrap: keep empty until /api/catalog (~15 KB) responds (avoid flashing old demo products)
  return {
    products: [],
    categories: INITIAL_CATEGORIES,
    mediaConfig: INITIAL_MEDIA_CONFIG,
    ready: false
  };
}

export function loadStoredProducts(): Product[] {
  return getBootstrapCatalog().products;
}

export function saveStoredProducts(products: Product[]): void {
  try {
    const serialized = JSON.stringify(products);
    if (serialized.length <= 1_500_000) {
      localStorage.setItem(STORAGE_KEYS.PRODUCTS, serialized);
    }
  } catch (e) {
    console.error('Failed to save products to storage', e);
  }
}

export function loadStoredCategories(): Category[] {
  return getBootstrapCatalog().categories;
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
  heroImages: [HERO_IMAGE, HERO_PROMO_DELIVERY_IMG, HERO_PROMO_COD_IMG],
  heroTagline: 'Ton style, ta signature',
  heroTitle: 'Affirme ton style avec HUIZE SHOP',
  heroSubtitle:
    'Baskets, sandales et vêtements tendance sélectionnés avec soin pour le quotidien et les grandes occasions au Burkina Faso. Choisis tes articles, puis finalise ta commande directement sur WhatsApp en toute confiance.',
  carouselSlides: INITIAL_CAROUSEL_SLIDES
};

export function loadStoredMediaConfig(): SiteMediaConfig {
  return getBootstrapCatalog().mediaConfig;
}

export function saveStoredMediaConfig(config: SiteMediaConfig): void {
  try {
    const serialized = JSON.stringify(config);
    if (serialized.length <= 1_000_000) {
      localStorage.setItem(MEDIA_STORAGE_KEY, serialized);
    }
  } catch (e) {
    console.error('Failed to save media config to storage', e);
  }
}

