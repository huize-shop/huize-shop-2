import express from 'express';
import { createServer } from 'http';
import { randomBytes, createHash } from 'crypto';
import { WebSocketServer, WebSocket } from 'ws';
import * as webpush from 'web-push';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';
import { initializeApp, getApps } from 'firebase/app';
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  collection,
  getDocs,
  updateDoc,
  deleteDoc,
  increment,
  setLogLevel
} from 'firebase/firestore';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import dotenv from 'dotenv';
import { Jimp, JimpMime } from 'jimp';
import {
  INITIAL_PRODUCTS,
  INITIAL_CATEGORIES,
  INITIAL_MEDIA_CONFIG
} from './src/data/initialData.ts';
import type {
  Product,
  Category,
  SiteMediaConfig,
  TeamMember,
  TeamMemberPublicProfile,
  TeamMemberOrderSummary,
  WhatsAppOrder,
  OrderThread,
  OrderChatMessage,
  OrderItemSnapshot,
  ChatSenderRole,
  ClientLead,
  DailySiteStats,
  CustomerReview
} from './src/types.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const isProd = process.env.NODE_ENV === 'production';
const PORT = isProd ? Number(process.env.PORT) || 3000 : 3000;

function initServerFirestore() {
  try {
    const configPath = path.join(__dirname, 'firebase-applet-config.json');
    if (!fs.existsSync(configPath)) return null;
    const cfg = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    setLogLevel('error');
    const app = getApps().length > 0 ? getApps()[0] : initializeApp(cfg);
    return getFirestore(app, cfg.firestoreDatabaseId);
  } catch (err) {
    console.warn('[Server] Could not initialize Firestore lookup:', err);
    return null;
  }
}

const serverDb = initServerFirestore();

interface CatalogSnapshot {
  products: Product[];
  categories: Category[];
  mediaConfig: SiteMediaConfig;
  updatedAt: number;
  source: 'firestore' | 'seed' | 'memory-update';
}

const CATALOG_CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes shared across all visitors
const CATALOG_ERROR_BACKOFF_MS = 5 * 60 * 1000; // 5 minutes backoff if Firestore quota/network fails
const DISK_CACHE_PATH = '/tmp/huize-catalog-cache.json';

function sortProductsList(list: Product[]): Product[] {
  return [...list].sort((a, b) => {
    const aIsNew = a.id.startsWith('prod-1');
    const bIsNew = b.id.startsWith('prod-1');
    if (aIsNew && !bIsNew) return -1;
    if (!aIsNew && bIsNew) return 1;
    if (aIsNew && bIsNew) return b.id.localeCompare(a.id);
    return 0;
  });
}

function loadDiskCache(): CatalogSnapshot | null {
  try {
    if (!fs.existsSync(DISK_CACHE_PATH)) return null;
    const raw = JSON.parse(fs.readFileSync(DISK_CACHE_PATH, 'utf8'));
    if (raw && Array.isArray(raw.products) && Array.isArray(raw.categories) && raw.mediaConfig) {
      return raw as CatalogSnapshot;
    }
  } catch {
    // Ignore disk cache read errors
  }
  return null;
}

function saveDiskCache(snapshot: CatalogSnapshot): void {
  try {
    fs.writeFileSync(DISK_CACHE_PATH, JSON.stringify(snapshot), 'utf8');
  } catch {
    // Ignore disk cache write errors
  }
}

let catalogCache: CatalogSnapshot =
  loadDiskCache() || {
    products: INITIAL_PRODUCTS,
    categories: INITIAL_CATEGORIES,
    mediaConfig: INITIAL_MEDIA_CONFIG,
    updatedAt: 0,
    source: 'seed'
  };

let nextFirestoreRetryAt = 0;
let refreshInFlight: Promise<CatalogSnapshot> | null = null;

async function refreshCatalogFromFirestore(): Promise<CatalogSnapshot> {
  if (!serverDb) {
    return catalogCache;
  }

  try {
    const [prodSnap, catSnap, mediaSnap] = await Promise.all([
      getDocs(collection(serverDb, 'products')),
      getDocs(collection(serverDb, 'categories')),
      getDoc(doc(serverDb, 'settings', 'media'))
    ]);

    const products = prodSnap.empty
      ? catalogCache.products.length > 0
        ? catalogCache.products
        : INITIAL_PRODUCTS
      : sortProductsList(prodSnap.docs.map((d) => d.data() as Product));

    const categories = catSnap.empty
      ? catalogCache.categories.length > 0
        ? catalogCache.categories
        : INITIAL_CATEGORIES
      : catSnap.docs.map((d) => d.data() as Category);

    const mediaConfig = mediaSnap.exists()
      ? (mediaSnap.data() as SiteMediaConfig)
      : catalogCache.mediaConfig || INITIAL_MEDIA_CONFIG;

    catalogCache = {
      products,
      categories,
      mediaConfig,
      updatedAt: Date.now(),
      source: 'firestore'
    };
    nextFirestoreRetryAt = 0;
    saveDiskCache(catalogCache);
    return catalogCache;
  } catch (err) {
    console.warn('[Server Cache] Firestore refresh skipped/failed, serving cached catalog:', err);
    nextFirestoreRetryAt = Date.now() + CATALOG_ERROR_BACKOFF_MS;
    if (catalogCache.updatedAt === 0) {
      catalogCache = {
        ...catalogCache,
        updatedAt: Date.now()
      };
    }
    return catalogCache;
  }
}

function shortHash(value: string): string {
  let hash = 2166136261;
  const step = Math.max(1, Math.floor(value.length / 256));
  for (let i = 0; i < value.length; i += step) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function buildLightweightCatalog(snapshot: CatalogSnapshot): CatalogSnapshot {
  const products = snapshot.products.map((p) => {
    const images = (p.images || []).map((img, idx) =>
      typeof img === 'string' && img.startsWith('data:')
        ? `/api/products/${encodeURIComponent(p.id)}/image/${idx}?v=${shortHash(img)}`
        : img
    );
    return { ...p, images };
  });

  const m = snapshot.mediaConfig || INITIAL_MEDIA_CONFIG;
  const logoUrl =
    typeof m.logoUrl === 'string' && m.logoUrl.startsWith('data:')
      ? `/api/media/logo?v=${shortHash(m.logoUrl)}`
      : m.logoUrl;
  const heroImages = Array.isArray(m.heroImages)
    ? m.heroImages.map((img, idx) =>
        typeof img === 'string' && img.startsWith('data:')
          ? `/api/media/hero/${idx}?v=${shortHash(img)}`
          : img
      )
    : undefined;
  const heroImage =
    typeof m.heroImage === 'string' && m.heroImage.startsWith('data:')
      ? heroImages && heroImages.length > 0
        ? heroImages[0]
        : `/api/media/hero/0?v=${shortHash(m.heroImage)}`
      : m.heroImage;
  const carouselSlides = Array.isArray(m.carouselSlides)
    ? m.carouselSlides.map((slide, idx) => ({
        ...slide,
        image:
          typeof slide.image === 'string' && slide.image.startsWith('data:')
            ? `/api/media/slide/${idx}?v=${shortHash(slide.image)}`
            : slide.image
      }))
    : m.carouselSlides;

  const categories = (snapshot.categories || []).map((c) => ({
    ...c,
    image:
      typeof c.image === 'string' && c.image.startsWith('data:')
        ? `/api/categories/${encodeURIComponent(c.id)}/image?v=${shortHash(c.image)}`
        : c.image
  }));

  return {
    ...snapshot,
    products,
    categories,
    mediaConfig: {
      ...m,
      logoUrl,
      heroImage,
      ...(heroImages ? { heroImages } : {}),
      carouselSlides
    }
  };
}

async function getCachedCatalog(forceRefresh = false): Promise<CatalogSnapshot> {
  const now = Date.now();
  const isFresh =
    !forceRefresh &&
    catalogCache.source !== 'seed' &&
    catalogCache.updatedAt > 0 &&
    now - catalogCache.updatedAt < CATALOG_CACHE_TTL_MS;

  if (isFresh) {
    return catalogCache;
  }

  if (!forceRefresh && now < nextFirestoreRetryAt) {
    return catalogCache;
  }

  if (!refreshInFlight) {
    refreshInFlight = refreshCatalogFromFirestore().finally(() => {
      refreshInFlight = null;
    });
  }

  return refreshInFlight;
}

async function getBootstrapCatalogSnapshot(timeoutMs = 2000): Promise<CatalogSnapshot | null> {
  if (catalogCache.source !== 'seed' && catalogCache.products.length > 0) {
    void getCachedCatalog(false);
    return catalogCache;
  }
  try {
    const snapshot = await Promise.race([
      getCachedCatalog(false),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), timeoutMs))
    ]);
    if (snapshot && snapshot.source !== 'seed') {
      return snapshot;
    }
  } catch {
    // Ignore bootstrap race error
  }
  return catalogCache.source !== 'seed' ? catalogCache : null;
}

// --- TEAM SHARING & ATTRIBUTION SERVER CACHE ---
const TEAM_DISK_CACHE_PATH = '/tmp/huize-team-cache.json';
const LEGACY_DEMO_ORDER_IDS = new Set(['CMD-1082', 'CMD-1083', 'CMD-1084']);

interface TeamCacheState {
  members: TeamMember[];
  orders: WhatsAppOrder[];
  membersUpdatedAt: number;
  ordersUpdatedAt: number;
}

function loadTeamDiskCache(): TeamCacheState {
  try {
    if (fs.existsSync(TEAM_DISK_CACHE_PATH)) {
      const raw = JSON.parse(fs.readFileSync(TEAM_DISK_CACHE_PATH, 'utf8'));
      if (raw && Array.isArray(raw.members) && Array.isArray(raw.orders)) {
        return raw as TeamCacheState;
      }
    }
  } catch {
    // Ignore read errors
  }
  return {
    members: [],
    orders: [],
    membersUpdatedAt: 0,
    ordersUpdatedAt: 0
  };
}

function saveTeamDiskCache(state: TeamCacheState): void {
  try {
    fs.writeFileSync(TEAM_DISK_CACHE_PATH, JSON.stringify(state), 'utf8');
  } catch {
    // Ignore write errors
  }
}

let teamCache: TeamCacheState = loadTeamDiskCache();
let nextTeamMembersRetryAt = 0;
let nextTeamOrdersRetryAt = 0;
let teamMembersRefreshInFlight: Promise<TeamMember[]> | null = null;
let teamOrdersRefreshInFlight: Promise<WhatsAppOrder[]> | null = null;

function sanitizePublicMember(member: TeamMember): TeamMemberPublicProfile {
  return {
    id: member.id,
    name: member.name,
    code: member.code,
    phone: member.phone,
    active: member.active,
    clicks: member.clicks || 0,
    createdAt: member.createdAt
  };
}

function normalizeTeamCode(raw?: string | null): string {
  return (raw || '').trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '');
}

async function getCachedTeamMembers(forceRefresh = false): Promise<TeamMember[]> {
  const now = Date.now();
  const isFresh =
    !forceRefresh &&
    teamCache.membersUpdatedAt > 0 &&
    now - teamCache.membersUpdatedAt < CATALOG_CACHE_TTL_MS;

  if (isFresh) return teamCache.members;
  if (!forceRefresh && now < nextTeamMembersRetryAt) return teamCache.members;
  if (!serverDb) return teamCache.members;

  if (!teamMembersRefreshInFlight) {
    teamMembersRefreshInFlight = (async () => {
      try {
        const snap = await getDocs(collection(serverDb, 'team_members'));
        const members = snap.docs.map((d) => d.data() as TeamMember);
        teamCache = {
          ...teamCache,
          members,
          membersUpdatedAt: Date.now()
        };
        nextTeamMembersRetryAt = 0;
        saveTeamDiskCache(teamCache);
        return members;
      } catch (err) {
        console.warn('[Server Team Cache] Could not refresh team_members:', err);
        nextTeamMembersRetryAt = Date.now() + CATALOG_ERROR_BACKOFF_MS;
        return teamCache.members;
      }
    })().finally(() => {
      teamMembersRefreshInFlight = null;
    });
  }

  return teamMembersRefreshInFlight;
}

async function getCachedTeamOrders(forceRefresh = false): Promise<WhatsAppOrder[]> {
  const now = Date.now();
  const isFresh =
    !forceRefresh &&
    teamCache.ordersUpdatedAt > 0 &&
    now - teamCache.ordersUpdatedAt < CATALOG_CACHE_TTL_MS;

  if (isFresh) return teamCache.orders;
  if (!forceRefresh && now < nextTeamOrdersRetryAt) return teamCache.orders;
  if (!serverDb) return teamCache.orders;

  if (!teamOrdersRefreshInFlight) {
    teamOrdersRefreshInFlight = (async () => {
      try {
        const snap = await getDocs(collection(serverDb, 'orders'));
        const orders = snap.docs
          .map((d) => d.data() as WhatsAppOrder)
          .filter((o) => !LEGACY_DEMO_ORDER_IDS.has(o.id));
        teamCache = {
          ...teamCache,
          orders,
          ordersUpdatedAt: Date.now()
        };
        nextTeamOrdersRetryAt = 0;
        saveTeamDiskCache(teamCache);
        return orders;
      } catch (err) {
        console.warn('[Server Team Cache] Could not refresh orders:', err);
        nextTeamOrdersRetryAt = Date.now() + CATALOG_ERROR_BACKOFF_MS;
        return teamCache.orders;
      }
    })().finally(() => {
      teamOrdersRefreshInFlight = null;
    });
  }

  return teamOrdersRefreshInFlight;
}

async function findProductByIdOrRef(idOrRef: string): Promise<Product | null> {
  if (!idOrRef) return null;
  const catalog = await getCachedCatalog();
  const found = catalog.products.find(
    (p) => p.id === idOrRef || p.ref.toLowerCase() === idOrRef.toLowerCase()
  );
  if (found) return found;

  return (
    INITIAL_PRODUCTS.find(
      (p) => p.id === idOrRef || p.ref.toLowerCase() === idOrRef.toLowerCase()
    ) || null
  );
}

function getRequestOrigin(req: express.Request): string {
  const protoHeader = req.headers['x-forwarded-proto'];
  const hostHeader = req.headers['x-forwarded-host'];
  const proto =
    (Array.isArray(protoHeader) ? protoHeader[0] : protoHeader)?.split(',')[0].trim() ||
    req.protocol ||
    'https';
  const host =
    (Array.isArray(hostHeader) ? hostHeader[0] : hostHeader)?.split(',')[0].trim() ||
    req.get('host') ||
    `localhost:${PORT}`;
  return `${proto}://${host}`;
}

function escapeHtmlAttr(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function injectProductOgMeta(html: string, product: Product, origin: string): string {
  const formattedPrice = `${Number(product.price || 0).toLocaleString('fr-FR')} F CFA`;
  const title = `${product.name} — ${formattedPrice} | HUIZE SHOP`;
  const description =
    product.description ||
    `Commandez ${product.name} (${formattedPrice}) sur HUIZE SHOP avec livraison rapide au Burkina Faso.`;
  const productUrl = `${origin}/?produit=${encodeURIComponent(product.id)}`;
  const imgVersion = shortHash(product.images?.[0] || product.id);
  const imageUrl = `${origin}/api/products/${encodeURIComponent(product.id)}/image.jpg?v=${imgVersion}`;

  const safeTitle = escapeHtmlAttr(title);
  const safeDesc = escapeHtmlAttr(description);
  const safeUrl = escapeHtmlAttr(productUrl);
  const safeImg = escapeHtmlAttr(imageUrl);
  const safeAlt = escapeHtmlAttr(product.name);

  const updated = html
    .replace(/<title>[\s\S]*?<\/title>/i, `<title>${safeTitle}</title>`)
    .replace(
      /<meta\s+name="description"\s+content="[^"]*"\s*\/?>/i,
      `<meta name="description" content="${safeDesc}" />`
    )
    .replace(
      /<meta\s+property="og:title"\s+content="[^"]*"\s*\/?>/i,
      `<meta property="og:title" content="${safeTitle}" />`
    )
    .replace(
      /<meta\s+property="og:description"\s+content="[^"]*"\s*\/?>/i,
      `<meta property="og:description" content="${safeDesc}" />`
    );

  const extraTags = `
    <meta property="og:url" content="${safeUrl}" />
    <meta property="og:image" content="${safeImg}" />
    <meta property="og:image:secure_url" content="${safeImg}" />
    <meta property="og:image:type" content="image/jpeg" />
    <meta property="og:image:alt" content="${safeAlt}" />
    <meta property="og:image:width" content="750" />
    <meta property="og:image:height" content="750" />
    <meta name="twitter:title" content="${safeTitle}" />
    <meta name="twitter:description" content="${safeDesc}" />
    <meta name="twitter:image" content="${safeImg}" />
  `;

  return updated.replace('</head>', `${extraTags}\n  </head>`);
}

function injectOrderOgMeta(
  html: string,
  orderedProducts: Product[],
  origin: string,
  rawItemsParam: string
): string {
  if (orderedProducts.length === 0) return html;
  if (orderedProducts.length === 1) {
    return injectProductOgMeta(html, orderedProducts[0], origin);
  }

  const totalEstimate = orderedProducts.reduce((acc, p) => acc + (p.price || 0), 0);
  const title = `Commande HUIZE SHOP (${orderedProducts.length} articles) — ${totalEstimate.toLocaleString('fr-FR')} F CFA`;
  const description = orderedProducts
    .slice(0, 4)
    .map((p, i) => `${i + 1}. ${p.name} (${Number(p.price || 0).toLocaleString('fr-FR')} F CFA)`)
    .join(' • ');
  const orderUrl = `${origin}/?commande=${encodeURIComponent(rawItemsParam)}`;
  const previewVersion = shortHash(
    orderedProducts.map((p) => `${p.id}:${p.images?.[0] || ''}`).join('|')
  );
  const imageUrl = `${origin}/api/orders/preview.jpg?items=${encodeURIComponent(rawItemsParam)}&v=${previewVersion}`;

  const safeTitle = escapeHtmlAttr(title);
  const safeDesc = escapeHtmlAttr(description);
  const safeUrl = escapeHtmlAttr(orderUrl);
  const safeImg = escapeHtmlAttr(imageUrl);

  const updated = html
    .replace(/<title>[\s\S]*?<\/title>/i, `<title>${safeTitle}</title>`)
    .replace(
      /<meta\s+name="description"\s+content="[^"]*"\s*\/?>/i,
      `<meta name="description" content="${safeDesc}" />`
    )
    .replace(
      /<meta\s+property="og:title"\s+content="[^"]*"\s*\/?>/i,
      `<meta property="og:title" content="${safeTitle}" />`
    )
    .replace(
      /<meta\s+property="og:description"\s+content="[^"]*"\s*\/?>/i,
      `<meta property="og:description" content="${safeDesc}" />`
    );

  const extraTags = `
    <meta property="og:url" content="${safeUrl}" />
    <meta property="og:image" content="${safeImg}" />
    <meta property="og:image:secure_url" content="${safeImg}" />
    <meta property="og:image:type" content="image/jpeg" />
    <meta property="og:image:alt" content="${safeTitle}" />
    <meta property="og:image:width" content="800" />
    <meta property="og:image:height" content="600" />
    <meta name="twitter:title" content="${safeTitle}" />
    <meta name="twitter:description" content="${safeDesc}" />
    <meta name="twitter:image" content="${safeImg}" />
  `;

  return updated.replace('</head>', `${extraTags}\n  </head>`);
}

function injectStoreOgMeta(html: string, snapshot: CatalogSnapshot | null, origin: string): string {
  const heroSrc = snapshot?.mediaConfig?.heroImages?.[0] || snapshot?.mediaConfig?.heroImage || '';
  const imgVersion = heroSrc ? shortHash(heroSrc) : '1';
  const imageUrl = heroSrc
    ? `${origin}/api/media/hero/0?v=${imgVersion}`
    : `${origin}/pwa-512x512.png`;
  const safeImg = escapeHtmlAttr(imageUrl);
  const safeUrl = escapeHtmlAttr(`${origin}/`);

  const extraTags = `
    <meta property="og:url" content="${safeUrl}" />
    <meta property="og:image" content="${safeImg}" />
    <meta property="og:image:secure_url" content="${safeImg}" />
    <meta property="og:image:alt" content="HUIZE SHOP - Boutique Burkina Faso" />
    <meta name="twitter:image" content="${safeImg}" />
  `;

  return html.replace('</head>', `${extraTags}\n  </head>`);
}

function injectSiteIconLinks(html: string, snapshot: CatalogSnapshot | null): string {
  const logoSrc = snapshot?.mediaConfig?.logoUrl;
  if (!logoSrc) return html;
  const v = shortHash(logoSrc);
  return html
    .replace(
      /<link\s+rel="apple-touch-icon"[^>]*\/?>/i,
      `<link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png?v=${v}" />`
    )
    .replace(
      /<link\s+rel="icon"[^>]*\/?>/i,
      `<link rel="icon" type="image/png" sizes="192x192" href="/pwa-192x192.png?v=${v}" />`
    )
    .replace(
      /<link\s+rel="shortcut icon"[^>]*\/?>/i,
      `<link rel="shortcut icon" href="/favicon.ico?v=${v}" />`
    )
    .replace(
      /<link\s+rel="alternate icon"[^>]*\/?>/i,
      `<link rel="alternate icon" href="/favicon.ico?v=${v}" />`
    );
}

function injectInitialCatalogScript(html: string, snapshot: CatalogSnapshot | null): string {
  const withIcons = injectSiteIconLinks(html, snapshot);
  if (!snapshot || snapshot.source === 'seed') return withIcons;
  const lightweight = buildLightweightCatalog(snapshot);
  const safeJson = JSON.stringify(lightweight).replace(/</g, '\\u003c').replace(/>/g, '\\u003e');
  const scriptTag = `<script>window.__HUIZE_INITIAL_CATALOG__=${safeJson};</script>`;
  return withIcons.replace('</head>', `${scriptTag}\n  </head>`);
}

async function startServer() {
  const app = express();
  app.set('trust proxy', true);
  app.use(express.json({ limit: '25mb' }));
  app.use(
    '/src/assets/images',
    express.static(path.resolve(__dirname, 'src/assets/images'), {
      maxAge: '7d'
    })
  );

  // Pre-warm catalog cache from Firestore immediately on server boot
  void getCachedCatalog(false).catch(() => {});

  // Health check endpoint
  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'ok',
      port: PORT,
      hasGeminiKey: Boolean(process.env.GEMINI_API_KEY),
      keyPrefix: process.env.GEMINI_API_KEY ? process.env.GEMINI_API_KEY.slice(0, 7) + '...' : 'none',
      app: 'HUIZE SHOP Burkina Faso',
      catalogCacheAgeSeconds: catalogCache.updatedAt
        ? Math.round((Date.now() - catalogCache.updatedAt) / 1000)
        : null,
      catalogSource: catalogCache.source
    });
  });

  // Shared public catalog endpoint (lightweight ~15 KB for visitors, ?full=1 for admin editor)
  app.get('/api/catalog', async (req, res) => {
    const snapshot = await getCachedCatalog();
    const includeFull = req.query.full === '1';
    res.setHeader('Cache-Control', 'no-cache, must-revalidate');
    res.json(includeFull ? snapshot : buildLightweightCatalog(snapshot));
  });

  // Immediate cache sync endpoint called after admin edits or product likes
  app.post('/api/catalog/sync', async (req, res) => {
    try {
      const {
        product,
        deletedProductId,
        category,
        deletedCategoryId,
        mediaConfig,
        likedProductId,
        likeDelta,
        forceRefresh
      } = req.body || {};

      let changed = false;
      let nextProducts = [...catalogCache.products];
      let nextCategories = [...catalogCache.categories];
      let nextMedia = catalogCache.mediaConfig;

      if (product && typeof product === 'object' && typeof product.id === 'string') {
        const idx = nextProducts.findIndex((p) => p.id === product.id);
        const existingProduct = idx >= 0 ? nextProducts[idx] : null;
        const incomingProd = product as Product;
        // Preserve raw base64 images from server cache if client synced a lightweight /api/ path
        const mergedImages = (incomingProd.images || []).map((img, imgIdx) => {
          if (
            typeof img === 'string' &&
            img.startsWith('/api/products/') &&
            existingProduct?.images?.[imgIdx]?.startsWith('data:')
          ) {
            return existingProduct.images[imgIdx];
          }
          return img;
        });
        const mergedProduct: Product = { ...incomingProd, images: mergedImages };
        if (idx >= 0) {
          nextProducts[idx] = mergedProduct;
        } else {
          nextProducts = [mergedProduct, ...nextProducts];
        }
        nextProducts = sortProductsList(nextProducts).slice(0, 500);
        changed = true;
      }

      if (typeof deletedProductId === 'string' && deletedProductId) {
        nextProducts = nextProducts.filter((p) => p.id !== deletedProductId);
        changed = true;
      }

      if (category && typeof category === 'object' && typeof category.id === 'string') {
        const idx = nextCategories.findIndex((c) => c.id === category.id);
        const existingCategory = idx >= 0 ? nextCategories[idx] : null;
        const incomingCat = category as Category;
        const mergedImage =
          typeof incomingCat.image === 'string' &&
          incomingCat.image.startsWith('/api/categories/') &&
          existingCategory?.image?.startsWith('data:')
            ? existingCategory.image
            : incomingCat.image;
        const mergedCategory: Category = { ...incomingCat, image: mergedImage };
        if (idx >= 0) {
          nextCategories[idx] = mergedCategory;
        } else {
          nextCategories = [...nextCategories, mergedCategory];
        }
        changed = true;
      }

      if (typeof deletedCategoryId === 'string' && deletedCategoryId) {
        nextCategories = nextCategories.filter((c) => c.id !== deletedCategoryId);
        changed = true;
      }

      if (mediaConfig && typeof mediaConfig === 'object') {
        const incomingMedia = mediaConfig as SiteMediaConfig;
        const existingMedia = catalogCache.mediaConfig;
        nextMedia = {
          ...incomingMedia,
          logoUrl:
            typeof incomingMedia.logoUrl === 'string' &&
            incomingMedia.logoUrl.startsWith('/api/media/') &&
            existingMedia?.logoUrl?.startsWith('data:')
              ? existingMedia.logoUrl
              : incomingMedia.logoUrl,
          heroImage:
            typeof incomingMedia.heroImage === 'string' &&
            incomingMedia.heroImage.startsWith('/api/media/') &&
            existingMedia?.heroImage?.startsWith('data:')
              ? existingMedia.heroImage
              : incomingMedia.heroImage,
          heroImages: Array.isArray(incomingMedia.heroImages)
            ? incomingMedia.heroImages.map((img, i) =>
                typeof img === 'string' &&
                img.startsWith('/api/media/') &&
                existingMedia?.heroImages?.[i]?.startsWith('data:')
                  ? existingMedia.heroImages[i]
                  : img
              )
            : incomingMedia.heroImages,
          carouselSlides: Array.isArray(incomingMedia.carouselSlides)
            ? incomingMedia.carouselSlides.map((slide, i) => ({
                ...slide,
                image:
                  typeof slide.image === 'string' &&
                  slide.image.startsWith('/api/media/') &&
                  existingMedia?.carouselSlides?.[i]?.image?.startsWith('data:')
                    ? existingMedia.carouselSlides[i].image
                    : slide.image
              }))
            : incomingMedia.carouselSlides
        };
        changed = true;
      }

      if (typeof likedProductId === 'string' && typeof likeDelta === 'number') {
        nextProducts = nextProducts.map((p) =>
          p.id === likedProductId
            ? { ...p, likes: Math.max(0, (p.likes || 0) + likeDelta) }
            : p
        );
        changed = true;
      }

      if (changed) {
        catalogCache = {
          products: nextProducts,
          categories: nextCategories,
          mediaConfig: nextMedia,
          updatedAt: Date.now(),
          source: 'memory-update'
        };
        saveDiskCache(catalogCache);
      }

      if (forceRefresh === true) {
        nextFirestoreRetryAt = 0;
        const refreshed = await getCachedCatalog(true);
        return res.json({ ok: true, catalog: refreshed });
      }

      return res.json({ ok: true, updatedAt: catalogCache.updatedAt });
    } catch (err) {
      console.error('[Server Cache] Sync error:', err);
      return res.status(400).json({ ok: false });
    }
  });

  // Team Member Login (Code + Personal PIN -> Clics, Commandes, Ventes validées)
  app.post('/api/team/login', async (req, res) => {
    try {
      const rawCode = typeof req.body?.code === 'string' ? req.body.code : '';
      const rawPin = typeof req.body?.pin === 'string' ? req.body.pin : '';
      const cleanCode = normalizeTeamCode(rawCode);
      const cleanPin = rawPin.trim();

      if (!cleanCode || !cleanPin) {
        return res.status(400).json({
          success: false,
          error: 'Veuillez saisir votre code personnel et votre code PIN.'
        });
      }

      let members = await getCachedTeamMembers(false);
      let member = members.find((m) => normalizeTeamCode(m.code) === cleanCode);

      // If not found in cache and cooldown allows, check Firestore once in case recently created
      if (!member && Date.now() >= nextTeamMembersRetryAt) {
        members = await getCachedTeamMembers(true);
        member = members.find((m) => normalizeTeamCode(m.code) === cleanCode);
      }

      if (!member || String(member.pin || '').trim() !== cleanPin) {
        return res.status(401).json({
          success: false,
          error: 'Code membre ou code PIN incorrect.'
        });
      }

      if (member.active === false) {
        return res.status(403).json({
          success: false,
          error: 'Ce compte équipe est actuellement désactivé par la boutique.'
        });
      }

      const orders = await getCachedTeamOrders(false);
      const memberOrders = orders.filter(
        (o) => normalizeTeamCode(o.referredByCode) === cleanCode
      );
      const salesCount = memberOrders.filter(
        (o) => o.status === 'paid' || o.status === 'delivered'
      ).length;

      const recentOrders: TeamMemberOrderSummary[] = memberOrders.slice(0, 20).map((o) => ({
        id: o.id,
        itemsSummary: o.itemsSummary,
        ...(Array.isArray(o.items) ? { items: o.items } : {}),
        total: o.total,
        status: o.status,
        statusLabel: o.statusLabel,
        date: o.date
      }));

      return res.json({
        success: true,
        member: sanitizePublicMember(member),
        ordersCount: memberOrders.length,
        salesCount,
        recentOrders
      });
    } catch (err) {
      console.error('[Team Login] Error:', err);
      return res.status(500).json({
        success: false,
        error: 'Impossible de vérifier les identifiants pour le moment.'
      });
    }
  });

  // Track click on shared ?ref=CODE link (increments server cache & Firestore safely)
  app.post('/api/team/track-click', async (req, res) => {
    try {
      const cleanCode = normalizeTeamCode(
        typeof req.body?.code === 'string' ? req.body.code : ''
      );
      if (!cleanCode) {
        return res.status(400).json({ ok: false, valid: false });
      }

      const members = await getCachedTeamMembers(false);
      const idx = members.findIndex(
        (m) => normalizeTeamCode(m.code) === cleanCode && m.active !== false
      );
      if (idx < 0) {
        return res.json({ ok: true, valid: false });
      }

      const targetMember = members[idx];
      const nextMembers = members.map((m, i) =>
        i === idx ? { ...m, clicks: (m.clicks || 0) + 1 } : m
      );
      teamCache = {
        ...teamCache,
        members: nextMembers
      };
      saveTeamDiskCache(teamCache);

      if (serverDb) {
        updateDoc(doc(serverDb, 'team_members', targetMember.id), {
          clicks: increment(1)
        }).catch((err) => {
          console.warn('[Team Click] Firestore click increment skipped:', err);
        });
      }

      return res.json({ ok: true, valid: true, code: targetMember.code });
    } catch (err) {
      console.warn('[Team Click] Error:', err);
      return res.json({ ok: false });
    }
  });

  // Sync server cache after admin edits team members or orders change
  app.post('/api/team/sync', async (req, res) => {
    try {
      const { teamMember, deletedTeamMemberId, order, deletedOrderId, forceRefresh } = req.body || {};
      let nextMembers = [...teamCache.members];
      let nextOrders = [...teamCache.orders];
      let changed = false;

      if (teamMember && typeof teamMember === 'object' && typeof teamMember.id === 'string') {
        const idx = nextMembers.findIndex((m) => m.id === teamMember.id);
        if (idx >= 0) {
          nextMembers[idx] = teamMember as TeamMember;
        } else {
          nextMembers = [teamMember as TeamMember, ...nextMembers];
        }
        changed = true;
      }

      if (typeof deletedTeamMemberId === 'string' && deletedTeamMemberId) {
        nextMembers = nextMembers.filter((m) => m.id !== deletedTeamMemberId);
        changed = true;
      }

      if (order && typeof order === 'object' && typeof order.id === 'string') {
        const cleanOrder = { ...(order as WhatsAppOrder) };
        if (cleanOrder.referredByCode) {
          const refCode = normalizeTeamCode(cleanOrder.referredByCode);
          cleanOrder.referredByCode = refCode;
          const refMember = nextMembers.find((m) => normalizeTeamCode(m.code) === refCode);
          if (refMember && !cleanOrder.referredByName) {
            cleanOrder.referredByName = refMember.name;
          }
        }
        const idx = nextOrders.findIndex((o) => o.id === cleanOrder.id);
        if (idx >= 0) {
          nextOrders[idx] = cleanOrder;
        } else {
          nextOrders = [cleanOrder, ...nextOrders];
        }
        changed = true;
      }

      if (typeof deletedOrderId === 'string' && deletedOrderId) {
        nextOrders = nextOrders.filter((o) => o.id !== deletedOrderId);
        changed = true;
      }

      if (changed) {
        teamCache = {
          ...teamCache,
          members: nextMembers,
          orders: nextOrders,
          membersUpdatedAt: teamCache.membersUpdatedAt || Date.now(),
          ordersUpdatedAt: teamCache.ordersUpdatedAt || Date.now()
        };
        saveTeamDiskCache(teamCache);
      }

      if (forceRefresh === true) {
        nextTeamMembersRetryAt = 0;
        nextTeamOrdersRetryAt = 0;
        await Promise.all([getCachedTeamMembers(true), getCachedTeamOrders(true)]);
      }

      return res.json({ ok: true });
    } catch (err) {
      console.error('[Team Cache] Sync error:', err);
      return res.status(400).json({ ok: false });
    }
  });

  // AI Product Vision Analysis Endpoint
  app.post('/api/ai/analyze-product', async (req, res) => {
    try {
      const { image, hint } = req.body;

      if (!image || typeof image !== 'string') {
        return res.status(400).json({ error: 'Image requise pour analyse visuelle.' });
      }

      // Check for Gemini API key
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        console.warn('GEMINI_API_KEY is not defined in environment.');
        return res.status(503).json({
          error: 'Clé API Gemini non configurée. Veuillez renseigner votre clé dans le panneau Settings > Secrets.',
          needsKey: true
        });
      }

      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build'
          },
          timeout: 45000
        }
      });

      // Prepare image Part for Gemini multimodal input
      let imagePart: { inlineData: { mimeType: string; data: string } } | null = null;

      if (image.startsWith('data:')) {
        const commaIdx = image.indexOf(',');
        if (commaIdx !== -1) {
          const meta = image.slice(0, commaIdx);
          const rawBase64 = image.slice(commaIdx + 1).replace(/\s/g, '');
          const mimeMatch = meta.match(/data:([^;]+)/);
          const mimeType = mimeMatch ? mimeMatch[1] : 'image/jpeg';
          imagePart = {
            inlineData: {
              mimeType,
              data: rawBase64
            }
          };
        }
      } else if (image.startsWith('http://') || image.startsWith('https://')) {
        try {
          const fetchRes = await fetch(image);
          const arrayBuffer = await fetchRes.arrayBuffer();
          const buffer = Buffer.from(arrayBuffer);
          const contentType = fetchRes.headers.get('content-type') || 'image/jpeg';
          imagePart = {
            inlineData: {
              mimeType: contentType.split(';')[0].trim(),
              data: buffer.toString('base64')
            }
          };
        } catch (fetchErr) {
          console.error('Error fetching remote image URL:', fetchErr);
        }
      } else {
        // Local asset path
        try {
          const cleanPath = image.startsWith('/') ? image.slice(1) : image;
          const localFilePath = path.join(__dirname, cleanPath);
          if (fs.existsSync(localFilePath)) {
            const buffer = fs.readFileSync(localFilePath);
            const ext = path.extname(localFilePath).toLowerCase();
            const mimeType = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg';
            imagePart = {
              inlineData: {
                mimeType,
                data: buffer.toString('base64')
              }
            };
          }
        } catch (fileErr) {
          console.error('Error reading local file:', fileErr);
        }
      }

      if (!imagePart) {
        return res.status(400).json({ error: "Impossible de lire le format de l'image fournie." });
      }

      console.log(`[AI Vision] Image prepared (MIME: ${imagePart.inlineData.mimeType}, size: ${Math.round(imagePart.inlineData.data.length / 1024)} KB). Calling Gemini...`);
      const startTime = Date.now();

      const promptText = `Tu es un expert reconnu du commerce de détail, de la mode streetwear et du prêt-à-porter au Burkina Faso (marché de Ouagadougou, Sankariaré, Rood-Woko) pour la boutique HUIZE SHOP (+226 53 74 27 48).
Analyse minutieusement cette photo du produit réel et extrais ou déduis-en les informations exactes et vendeuses sur le marché local :

1. Nom commercial (name) : Nom exact et vendeur du modèle et ses couleurs principales (ex: 'Sneaker Dunk Low Noir & Blanc', 'Sandale Sahel Cuir Véritable Tressé', 'T-shirt Oversize Streetwear Coton'). Identifie précisément ce qui est visible sur l'image.
2. Catégorie (category) : STRICTEMENT l'une de ces 3 valeurs :
   - 'chaussures' (pour baskets, sneakers, tennis, bottines, derbies)
   - 'sandales' (pour sandales en cuir, mules, claquettes, babouches)
   - 'vetements' (pour t-shirts, chemises, polos, ensembles, bermudas, pantalons)
3. Libellé de catégorie (categoryLabel) : 'Baskets', 'Sandales', ou 'Vêtements'.
4. Prix de vente en Francs CFA (price) : Estime un prix de vente compétitif et réaliste en F CFA au Burkina Faso pour cet article (ex: entre 18000 et 28000 F CFA pour une paire de baskets, 12000 à 18000 F CFA pour des sandales en cuir, 10000 à 16000 F CFA pour un vêtement). Nombre entier arrondi.
5. Prix barré promotionnel (oldPrice) : Prix barré supérieur d'environ 15% à 25% au prix de vente pour valoriser la promotion.
6. Badge marketing (badge) : Choisis parmi 'Nouveau', 'Top Vente', 'Promo', 'Stock limité', 'Artisanal'.
7. Tailles ou pointures (sizes) : 
   - Pour les chaussures : '40, 41, 42, 43, 44'
   - Pour les sandales : '39, 40, 41, 42, 43, 44'
   - Pour les vêtements : 'M, L, XL, XXL'
8. Description commerciale (description) : Rédige une description vendeuse et soignée en français (2-3 phrases) mentionnant la qualité, le confort et le style sous le climat chaud du Burkina Faso, invitant à commander directement sur WhatsApp (+226 53 74 27 48) avec livraison rapide à Ouagadougou.
${hint ? `Indication spécifique : ${hint}` : ''}`;

      let parsedData: any = null;

      const modelsToTry = ['gemini-3.8-flash', 'gemini-3.1-flash-lite', 'gemini-flash-latest'];
      let lastModelError: any = null;

      const productSchema = {
        type: Type.OBJECT,
        properties: {
          name: {
            type: Type.STRING,
            description: "Nom commercial complet et vendeur du produit"
          },
          category: {
            type: Type.STRING,
            description: "Catégorie ('chaussures', 'sandales', 'vetements')"
          },
          categoryLabel: {
            type: Type.STRING,
            description: "Libellé affiché ('Baskets', 'Sandales', 'Vêtements')"
          },
          price: {
            type: Type.INTEGER,
            description: "Prix de vente réaliste en F CFA au Burkina Faso"
          },
          oldPrice: {
            type: Type.INTEGER,
            description: "Prix barré promotionnel en F CFA"
          },
          badge: {
            type: Type.STRING,
            description: "Badge marketing ('Nouveau', 'Top Vente', 'Promo', 'Stock limité', 'Artisanal')"
          },
          sizes: {
            type: Type.STRING,
            description: "Liste des tailles ou pointures séparées par des virgules"
          },
          description: {
            type: Type.STRING,
            description: "Description commerciale détaillée et attrayante en français"
          }
        },
        required: ['name', 'category', 'categoryLabel', 'price', 'description']
      };

      for (const model of modelsToTry) {
        try {
          console.log(`[AI Vision] Trying model ${model}...`);
          const aiResponse = await ai.models.generateContent({
            model,
            contents: [imagePart, { text: promptText }],
            config: {
              responseMimeType: 'application/json',
              responseSchema: productSchema
            }
          });

          const text = aiResponse.text;
          console.log(`[AI Vision] Model ${model} succeeded in ${Date.now() - startTime}ms.`);
          if (text) {
            parsedData = JSON.parse(text);
            if (parsedData && parsedData.name) {
              break;
            }
          }
        } catch (modelErr: any) {
          console.warn(`[AI Vision] Model ${model} failed:`, modelErr.message || String(modelErr));
          lastModelError = modelErr;
          // Continue to next model in list
        }
      }

      if (!parsedData || !parsedData.name) {
        const rawErr = lastModelError?.message || String(lastModelError || '');
        const isBusy = rawErr.includes('503') || rawErr.includes('high demand') || rawErr.includes('UNAVAILABLE');
        const isQuota = rawErr.includes('429') || rawErr.includes('RESOURCE_EXHAUSTED');
        
        let userMessage = "L'analyse IA de l'image n'a pas pu aboutir.";
        if (isBusy) {
          userMessage = "Les serveurs d'analyse Gemini sont temporairement très sollicités (forte affluence). Veuillez patienter 10 secondes et relancer l'analyse.";
        } else if (isQuota) {
          userMessage = "La limite de requêtes de votre clé Gemini est atteinte. Réessayez dans un instant.";
        } else if (rawErr) {
          userMessage = `Erreur IA : ${rawErr}`;
        }

        return res.status(502).json({
          success: false,
          error: userMessage
        });
      }

      if (!parsedData || !parsedData.name) {
        return res.status(502).json({
          success: false,
          error: "L'IA n'a pas pu analyser précisément cette photo. Veuillez essayer avec une autre image plus nette."
        });
      }

      return res.json({
        success: true,
        data: parsedData
      });
    } catch (err: any) {
      console.error('Error analyzing product with Gemini:', err);
      return res.status(500).json({
        error: err.message || "Erreur lors de l'analyse de l'image par l'IA.",
        details: String(err)
      });
    }
  });

  async function sendImageSource(
    res: express.Response,
    imageSrc: string | undefined,
    cacheHeader: string
  ) {
    if (imageSrc) {
      if (imageSrc.startsWith('data:')) {
        const commaIdx = imageSrc.indexOf(',');
        if (commaIdx !== -1) {
          const meta = imageSrc.slice(0, commaIdx);
          const rawBase64 = imageSrc.slice(commaIdx + 1);
          const mimeMatch = meta.match(/data:([^;]+)/);
          const mimeType = mimeMatch ? mimeMatch[1] : 'image/jpeg';
          const buffer = Buffer.from(rawBase64, 'base64');
          res.setHeader('Content-Type', mimeType);
          res.setHeader('Cache-Control', cacheHeader);
          return res.send(buffer);
        }
      } else if (imageSrc.startsWith('http://') || imageSrc.startsWith('https://')) {
        try {
          const remoteRes = await fetch(imageSrc);
          if (remoteRes.ok) {
            const contentType = remoteRes.headers.get('content-type') || 'image/jpeg';
            const buf = Buffer.from(await remoteRes.arrayBuffer());
            res.setHeader('Content-Type', contentType);
            res.setHeader('Cache-Control', cacheHeader);
            return res.send(buf);
          }
        } catch {
          return res.redirect(imageSrc);
        }
      } else {
        const cleanPath = imageSrc.startsWith('/') ? imageSrc.slice(1) : imageSrc;
        const candidates = [
          path.resolve(__dirname, 'public', cleanPath),
          path.resolve(__dirname, cleanPath)
        ];
        for (const filePath of candidates) {
          if (
            (filePath.startsWith(path.resolve(__dirname, 'public')) ||
              filePath.startsWith(path.resolve(__dirname, 'src'))) &&
            fs.existsSync(filePath)
          ) {
            const ext = path.extname(filePath).toLowerCase();
            const mimeType =
              ext === '.png'
                ? 'image/png'
                : ext === '.webp'
                ? 'image/webp'
                : ext === '.svg'
                ? 'image/svg+xml'
                : 'image/jpeg';
            res.setHeader('Content-Type', mimeType);
            res.setHeader('Cache-Control', 'public, max-age=86400');
            return res.sendFile(filePath);
          }
        }
      }
    }

    const fallbackIcon = path.resolve(__dirname, 'public', 'pwa-512x512.png');
    if (fs.existsSync(fallbackIcon)) {
      res.setHeader('Content-Type', 'image/png');
      res.setHeader('Cache-Control', 'public, max-age=3600');
      return res.sendFile(fallbackIcon);
    }

    return res.status(404).send('Image not found');
  }

  // Public Product Image Endpoints (by index or primary image)
  app.get(['/api/products/:id/image/:idx', '/api/products/:id/image.jpg', '/api/products/:id/image'], async (req, res) => {
    try {
      const product = await findProductByIdOrRef(req.params.id);
      const idxParam = req.params.idx !== undefined ? parseInt(req.params.idx, 10) : 0;
      const safeIdx = Number.isFinite(idxParam) && idxParam >= 0 ? idxParam : 0;
      const imageSrc = product?.images?.[safeIdx] || product?.images?.[0];
      const cacheHeader = req.query.v
        ? 'public, max-age=31536000, immutable'
        : 'public, max-age=3600';
      return await sendImageSource(res, imageSrc, cacheHeader);
    } catch (err) {
      console.error('Error serving product image:', err);
      return res.status(500).send('Image server error');
    }
  });

  // Public Site Media Endpoints (Logo, Hero Carousel, Promo Slides)
  app.get('/api/media/logo', async (req, res) => {
    try {
      const catalog = await getCachedCatalog();
      const cacheHeader = req.query.v
        ? 'public, max-age=31536000, immutable'
        : 'public, max-age=3600';
      return await sendImageSource(res, catalog.mediaConfig?.logoUrl, cacheHeader);
    } catch (err) {
      console.error('Error serving logo:', err);
      return res.status(500).send('Image server error');
    }
  });

  // Dynamic Logo-Synced Favicon, Apple Touch Icon, PWA Icons & Manifest
  const renderedIconCache = new Map<string, Buffer>();

  function buildIcoFromPngs(entries: Array<{ size: number; png: Buffer }>): Buffer {
    const header = Buffer.alloc(6);
    header.writeUInt16LE(0, 0);
    header.writeUInt16LE(1, 2);
    header.writeUInt16LE(entries.length, 4);

    const dirEntries: Buffer[] = [];
    let offset = 6 + entries.length * 16;
    for (const { size, png } of entries) {
      const dir = Buffer.alloc(16);
      dir.writeUInt8(size >= 256 ? 0 : size, 0);
      dir.writeUInt8(size >= 256 ? 0 : size, 1);
      dir.writeUInt8(0, 2);
      dir.writeUInt8(0, 3);
      dir.writeUInt16LE(1, 4);
      dir.writeUInt16LE(32, 6);
      dir.writeUInt32LE(png.length, 8);
      dir.writeUInt32LE(offset, 12);
      dirEntries.push(dir);
      offset += png.length;
    }
    return Buffer.concat([header, ...dirEntries, ...entries.map((e) => e.png)]);
  }

  async function renderLogoSquarePng(logoSrc: string, size: number, padRatio = 0): Promise<Buffer | null> {
    const v = shortHash(logoSrc);
    const cacheKey = `${v}:${size}:${padRatio}`;
    const cached = renderedIconCache.get(cacheKey);
    if (cached) return cached;

    const rawBuf = await resolveImageBuffer(logoSrc);
    if (!rawBuf) return null;
    try {
      const baseImg = await Jimp.fromBuffer(rawBuf);
      const innerSize = Math.max(16, Math.round(size * (1 - padRatio * 2)));
      const resized = baseImg.clone().contain({ w: innerSize, h: innerSize });
      let outBuf: Buffer;
      if (padRatio === 0 && resized.width === size && resized.height === size) {
        outBuf = await resized.getBuffer(JimpMime.png);
      } else {
        const canvas = new Jimp({ width: size, height: size, color: 0xffffffff });
        const x = Math.round((size - resized.width) / 2);
        const y = Math.round((size - resized.height) / 2);
        canvas.composite(resized, x, y);
        outBuf = await canvas.getBuffer(JimpMime.png);
      }
      if (renderedIconCache.size >= 24) {
        const firstKey = renderedIconCache.keys().next().value;
        if (firstKey) renderedIconCache.delete(firstKey);
      }
      renderedIconCache.set(cacheKey, outBuf);
      return outBuf;
    } catch {
      return null;
    }
  }

  async function serveLogoDerivedIcon(
    req: express.Request,
    res: express.Response,
    size: number,
    padRatio: number,
    fallbackFilename: string
  ) {
    try {
      const catalog = await getCachedCatalog();
      const logoSrc = catalog.mediaConfig?.logoUrl;
      const cacheHeader = req.query.v
        ? 'public, max-age=31536000, immutable'
        : 'public, max-age=3600';

      if (logoSrc) {
        const pngBuf = await renderLogoSquarePng(logoSrc, size, padRatio);
        if (pngBuf) {
          res.setHeader('Content-Type', 'image/png');
          res.setHeader('Cache-Control', cacheHeader);
          return res.send(pngBuf);
        }
      }

      const fallbackFile = path.resolve(__dirname, 'public', fallbackFilename);
      if (fs.existsSync(fallbackFile)) {
        res.setHeader('Content-Type', 'image/png');
        res.setHeader('Cache-Control', 'public, max-age=3600');
        return res.sendFile(fallbackFile);
      }
      return res.status(404).send('Icon not found');
    } catch (err) {
      console.error('Error serving derived icon:', err);
      return res.status(500).send('Icon server error');
    }
  }

  app.get('/favicon.ico', async (req, res) => {
    try {
      const catalog = await getCachedCatalog();
      const logoSrc = catalog.mediaConfig?.logoUrl;
      const cacheHeader = req.query.v
        ? 'public, max-age=31536000, immutable'
        : 'public, max-age=3600';

      if (logoSrc) {
        const v = shortHash(logoSrc);
        const icoKey = `${v}:ico`;
        let icoBuf = renderedIconCache.get(icoKey);
        if (!icoBuf) {
          const [p32, p48] = await Promise.all([
            renderLogoSquarePng(logoSrc, 32, 0),
            renderLogoSquarePng(logoSrc, 48, 0)
          ]);
          if (p32 && p48) {
            icoBuf = buildIcoFromPngs([
              { size: 32, png: p32 },
              { size: 48, png: p48 }
            ]);
            renderedIconCache.set(icoKey, icoBuf);
          }
        }
        if (icoBuf) {
          res.setHeader('Content-Type', 'image/x-icon');
          res.setHeader('Cache-Control', cacheHeader);
          return res.send(icoBuf);
        }
      }

      const fallbackIco = path.resolve(__dirname, 'public', 'favicon.ico');
      if (fs.existsSync(fallbackIco)) {
        res.setHeader('Content-Type', 'image/x-icon');
        res.setHeader('Cache-Control', 'public, max-age=3600');
        return res.sendFile(fallbackIco);
      }
      return res.status(404).send('Favicon not found');
    } catch (err) {
      console.error('Error serving favicon.ico:', err);
      return res.status(500).send('Favicon error');
    }
  });

  app.get('/apple-touch-icon.png', (req, res) =>
    serveLogoDerivedIcon(req, res, 180, 0, 'apple-touch-icon.png')
  );
  app.get('/pwa-192x192.png', (req, res) =>
    serveLogoDerivedIcon(req, res, 192, 0, 'pwa-192x192.png')
  );
  app.get('/pwa-512x512.png', (req, res) =>
    serveLogoDerivedIcon(req, res, 512, 0, 'pwa-512x512.png')
  );
  app.get('/pwa-maskable-512x512.png', (req, res) =>
    serveLogoDerivedIcon(req, res, 512, 0.08, 'pwa-maskable-512x512.png')
  );

  app.get(['/manifest.webmanifest', '/manifest.json'], async (_req, res) => {
    const catalog = await getCachedCatalog();
    const logoSrc = catalog.mediaConfig?.logoUrl;
    const vSuffix = logoSrc ? `?v=${shortHash(logoSrc)}` : '';
    res.setHeader('Content-Type', 'application/manifest+json; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, must-revalidate');
    return res.json({
      id: '/',
      name: 'HUIZE SHOP - Boutique Burkina Faso',
      short_name: 'HUIZE SHOP',
      description:
        'Boutique en ligne de baskets, sandales et vêtements au Burkina Faso avec commande directe sur WhatsApp.',
      theme_color: '#123B2A',
      background_color: '#F8F7F2',
      display: 'standalone',
      orientation: 'portrait-primary',
      lang: 'fr',
      start_url: '/',
      scope: '/',
      icons: [
        {
          src: `/pwa-192x192.png${vSuffix}`,
          sizes: '192x192',
          type: 'image/png',
          purpose: 'any'
        },
        {
          src: `/pwa-512x512.png${vSuffix}`,
          sizes: '512x512',
          type: 'image/png',
          purpose: 'any'
        },
        {
          src: `/pwa-maskable-512x512.png${vSuffix}`,
          sizes: '512x512',
          type: 'image/png',
          purpose: 'maskable'
        }
      ]
    });
  });

  app.get('/api/media/hero/:idx', async (req, res) => {
    try {
      const catalog = await getCachedCatalog();
      const idx = Math.max(0, parseInt(req.params.idx, 10) || 0);
      const media = catalog.mediaConfig;
      const imageSrc = media?.heroImages?.[idx] || media?.heroImage;
      const cacheHeader = req.query.v
        ? 'public, max-age=31536000, immutable'
        : 'public, max-age=3600';
      return await sendImageSource(res, imageSrc, cacheHeader);
    } catch (err) {
      console.error('Error serving hero image:', err);
      return res.status(500).send('Image server error');
    }
  });

  app.get('/api/media/slide/:idx', async (req, res) => {
    try {
      const catalog = await getCachedCatalog();
      const idx = Math.max(0, parseInt(req.params.idx, 10) || 0);
      const imageSrc = catalog.mediaConfig?.carouselSlides?.[idx]?.image;
      const cacheHeader = req.query.v
        ? 'public, max-age=31536000, immutable'
        : 'public, max-age=3600';
      return await sendImageSource(res, imageSrc, cacheHeader);
    } catch (err) {
      console.error('Error serving slide image:', err);
      return res.status(500).send('Image server error');
    }
  });

  app.get('/api/categories/:id/image', async (req, res) => {
    try {
      const catalog = await getCachedCatalog();
      const cat = catalog.categories.find(
        (c) => c.id === req.params.id || c.slug === req.params.id
      );
      const cacheHeader = req.query.v
        ? 'public, max-age=31536000, immutable'
        : 'public, max-age=3600';
      return await sendImageSource(res, cat?.image, cacheHeader);
    } catch (err) {
      console.error('Error serving category image:', err);
      return res.status(500).send('Image server error');
    }
  });

  async function resolveImageBuffer(imageSrc?: string): Promise<Buffer | null> {
    if (!imageSrc) return null;
    if (imageSrc.startsWith('data:')) {
      const commaIdx = imageSrc.indexOf(',');
      if (commaIdx === -1) return null;
      return Buffer.from(imageSrc.slice(commaIdx + 1), 'base64');
    }
    if (imageSrc.startsWith('http://') || imageSrc.startsWith('https://')) {
      try {
        const fetchUrl = imageSrc.includes('images.unsplash.com') && !imageSrc.includes('fm=')
          ? `${imageSrc}${imageSrc.includes('?') ? '&' : '?'}fm=jpg`
          : imageSrc;
        const remoteRes = await fetch(fetchUrl);
        if (remoteRes.ok) {
          return Buffer.from(await remoteRes.arrayBuffer());
        }
      } catch {
        return null;
      }
      return null;
    }
    const cleanPath = imageSrc.startsWith('/') ? imageSrc.slice(1) : imageSrc;
    const candidates = [
      path.resolve(__dirname, 'public', cleanPath),
      path.resolve(__dirname, cleanPath)
    ];
    for (const filePath of candidates) {
      if (
        (filePath.startsWith(path.resolve(__dirname, 'public')) ||
          filePath.startsWith(path.resolve(__dirname, 'src'))) &&
        fs.existsSync(filePath)
      ) {
        return fs.readFileSync(filePath);
      }
    }
    return null;
  }

  // Multi-product order composite preview photo for WhatsApp rich preview cards
  app.get('/api/orders/preview.jpg', async (req, res) => {
    try {
      const rawItems = typeof req.query.items === 'string' ? req.query.items : '';
      const ids = Array.from(
        new Set(
          rawItems
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean)
        )
      ).slice(0, 4);

      const matchedProducts = (await Promise.all(ids.map((id) => findProductByIdOrRef(id)))).filter(
        (p): p is Product => Boolean(p)
      );

      if (matchedProducts.length === 0) {
        const fallback = path.resolve(__dirname, 'public', 'pwa-512x512.png');
        if (fs.existsSync(fallback)) {
          res.setHeader('Content-Type', 'image/png');
          return res.sendFile(fallback);
        }
        return res.status(404).send('No products found');
      }

      if (matchedProducts.length === 1) {
        return await sendImageSource(
          res,
          matchedProducts[0].images?.[0],
          req.query.v ? 'public, max-age=31536000, immutable' : 'public, max-age=86400'
        );
      }

      const decodedImages: Awaited<ReturnType<typeof Jimp.fromBuffer>>[] = [];
      for (const prod of matchedProducts) {
        const buf = await resolveImageBuffer(prod.images?.[0]);
        if (!buf) continue;
        try {
          const parsed = await Jimp.fromBuffer(buf);
          decodedImages.push(parsed);
        } catch {
          // Skip undecodable remote image format
        }
      }

      if (decodedImages.length === 0) {
        return await sendImageSource(res, matchedProducts[0].images?.[0], 'public, max-age=86400');
      }

      if (decodedImages.length === 1) {
        const single = decodedImages[0].cover({ w: 750, h: 750 });
        const out = await single.getBuffer(JimpMime.jpeg, { quality: 84 });
        res.setHeader('Content-Type', 'image/jpeg');
        res.setHeader('Cache-Control', 'public, max-age=86400');
        return res.send(out);
      }

      const gap = 12;
      let canvasWidth = 800;
      let canvasHeight = 420;
      const slots: Array<{ x: number; y: number; w: number; h: number }> = [];

      if (decodedImages.length === 2) {
        canvasWidth = 800;
        canvasHeight = 420;
        const w = Math.floor((canvasWidth - gap * 3) / 2);
        const h = canvasHeight - gap * 2;
        slots.push({ x: gap, y: gap, w, h });
        slots.push({ x: gap * 2 + w, y: gap, w, h });
      } else if (decodedImages.length === 3) {
        canvasWidth = 900;
        canvasHeight = 340;
        const w = Math.floor((canvasWidth - gap * 4) / 3);
        const h = canvasHeight - gap * 2;
        for (let i = 0; i < 3; i++) {
          slots.push({ x: gap + i * (w + gap), y: gap, w, h });
        }
      } else {
        canvasWidth = 760;
        canvasHeight = 760;
        const w = Math.floor((canvasWidth - gap * 3) / 2);
        const h = Math.floor((canvasHeight - gap * 3) / 2);
        slots.push({ x: gap, y: gap, w, h });
        slots.push({ x: gap * 2 + w, y: gap, w, h });
        slots.push({ x: gap, y: gap * 2 + h, w, h });
        slots.push({ x: gap * 2 + w, y: gap * 2 + h, w, h });
      }

      const canvas = new Jimp({ width: canvasWidth, height: canvasHeight, color: 0xf8f7f2ff });
      decodedImages.slice(0, slots.length).forEach((img, idx) => {
        const slot = slots[idx];
        img.cover({ w: slot.w, h: slot.h });
        canvas.composite(img, slot.x, slot.y);
      });

      const outBuffer = await canvas.getBuffer(JimpMime.jpeg, { quality: 84 });
      res.setHeader('Content-Type', 'image/jpeg');
      res.setHeader(
        'Cache-Control',
        req.query.v ? 'public, max-age=31536000, immutable' : 'public, max-age=86400'
      );
      return res.send(outBuffer);
    } catch (err) {
      console.error('Error generating order collage preview:', err);
      return res.status(500).send('Order preview error');
    }
  });

  // --- IN-SITE REAL-TIME ORDER MESSAGING & LIVE CHAT ---
  const AUTHORIZED_ADMIN_EMAIL = 'hugosazizegansonre@gmail.com';
  const CHAT_DISK_CACHE_PATH = '/tmp/huize-chat-cache.json';

  interface StoredOrderThread extends OrderThread {
    accessToken: string;
  }

  interface ChatCacheState {
    threads: Record<string, StoredOrderThread>;
    messages: Record<string, OrderChatMessage[]>;
    threadsLoadedAt: number;
  }

  function loadChatDiskCache(): ChatCacheState {
    try {
      if (fs.existsSync(CHAT_DISK_CACHE_PATH)) {
        const raw = JSON.parse(fs.readFileSync(CHAT_DISK_CACHE_PATH, 'utf8'));
        if (raw && typeof raw.threads === 'object' && typeof raw.messages === 'object') {
          return raw as ChatCacheState;
        }
      }
    } catch {
      // Ignore disk cache read errors
    }
    return { threads: {}, messages: {}, threadsLoadedAt: 0 };
  }

  function saveChatDiskCache(state: ChatCacheState): void {
    try {
      fs.writeFileSync(CHAT_DISK_CACHE_PATH, JSON.stringify(state), 'utf8');
    } catch {
      // Ignore disk cache write errors
    }
  }

  function stripUndefinedDeep<T>(val: T): T {
    if (val === null || typeof val !== 'object') return val;
    if (Array.isArray(val)) return val.map((v) => stripUndefinedDeep(v)) as unknown as T;
    const out: Record<string, any> = {};
    for (const [k, v] of Object.entries(val as Record<string, any>)) {
      if (v !== undefined) {
        out[k] = stripUndefinedDeep(v);
      }
    }
    return out as T;
  }

  const ORDER_STATUS_LABELS: Record<WhatsAppOrder['status'], string> = {
    discussion: 'En discussion',
    pending: 'À livrer',
    paid: 'Payé (Orange/Moov)',
    delivered: 'Livré'
  };

  let chatCache: ChatCacheState = loadChatDiskCache();
  let nextChatFirestoreRetryAt = 0;

  function sanitizePublicThread(thread: StoredOrderThread): OrderThread {
    const { accessToken: _secret, ...publicThread } = thread;
    return publicThread;
  }

  function isAdminAuthorizedRequest(req: express.Request): boolean {
    const headerEmail =
      typeof req.headers['x-admin-email'] === 'string' ? req.headers['x-admin-email'] : '';
    return headerEmail.trim().toLowerCase() === AUTHORIZED_ADMIN_EMAIL.toLowerCase();
  }

  // Lightweight IP anti-spam rate limiter
  const rateLimitBuckets = new Map<string, { count: number; resetAt: number }>();
  function checkRateLimit(key: string, maxRequests: number, windowMs: number): boolean {
    const now = Date.now();
    const entry = rateLimitBuckets.get(key);
    if (!entry || now > entry.resetAt) {
      rateLimitBuckets.set(key, { count: 1, resetAt: now + windowMs });
      return true;
    }
    if (entry.count >= maxRequests) {
      return false;
    }
    entry.count += 1;
    return true;
  }

  async function ensureChatThreadsLoaded(forceRefresh = false): Promise<StoredOrderThread[]> {
    const now = Date.now();
    const isFresh =
      !forceRefresh &&
      chatCache.threadsLoadedAt > 0 &&
      now - chatCache.threadsLoadedAt < CATALOG_CACHE_TTL_MS;

    if (!isFresh && serverDb && (forceRefresh || now >= nextChatFirestoreRetryAt)) {
      try {
        const snap = await getDocs(collection(serverDb, 'order_threads'));
        const nextThreads: Record<string, StoredOrderThread> = { ...chatCache.threads };
        snap.forEach((d) => {
          const data = d.data() as StoredOrderThread;
          if (data && typeof data.id === 'string' && typeof data.accessToken === 'string') {
            nextThreads[data.id] = data;
          }
        });
        chatCache = {
          ...chatCache,
          threads: nextThreads,
          threadsLoadedAt: now
        };
        nextChatFirestoreRetryAt = 0;
        saveChatDiskCache(chatCache);
      } catch (err) {
        console.warn('[Chat] Firestore threads refresh skipped:', err);
        nextChatFirestoreRetryAt = now + CATALOG_ERROR_BACKOFF_MS;
      }
    }

    return Object.values(chatCache.threads).sort((a, b) =>
      (b.updatedAt || '').localeCompare(a.updatedAt || '')
    );
  }

  async function ensureThreadById(threadId: string): Promise<StoredOrderThread | null> {
    if (chatCache.threads[threadId]) {
      return chatCache.threads[threadId];
    }
    if (serverDb && Date.now() >= nextChatFirestoreRetryAt) {
      try {
        const snap = await getDoc(doc(serverDb, 'order_threads', threadId));
        if (snap.exists()) {
          const data = snap.data() as StoredOrderThread;
          chatCache.threads[threadId] = data;
          saveChatDiskCache(chatCache);
          return data;
        }
      } catch (err) {
        console.warn('[Chat] Firestore single thread lookup skipped:', err);
      }
    }
    return null;
  }

  async function ensureThreadMessages(threadId: string): Promise<OrderChatMessage[]> {
    if (Array.isArray(chatCache.messages[threadId]) && chatCache.messages[threadId].length > 0) {
      return chatCache.messages[threadId];
    }
    if (serverDb && Date.now() >= nextChatFirestoreRetryAt) {
      try {
        const snap = await getDocs(collection(serverDb, 'order_threads', threadId, 'messages'));
        const list = snap.docs
          .map((d) => d.data() as OrderChatMessage)
          .sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''));
        chatCache.messages[threadId] = list;
        saveChatDiskCache(chatCache);
        return list;
      } catch (err) {
        console.warn('[Chat] Firestore messages load skipped:', err);
      }
    }
    return chatCache.messages[threadId] || [];
  }

  function sanitizeOrderItems(rawItems: any[]): OrderItemSnapshot[] {
    return rawItems
      .filter((item) => item && typeof item.productId === 'string' && typeof item.name === 'string')
      .slice(0, 30)
      .map((item) => {
        const rawImg = typeof item.image === 'string' ? item.image.trim() : '';
        const safeImg =
          rawImg && !rawImg.startsWith('data:')
            ? rawImg.slice(0, 350)
            : `/api/products/${encodeURIComponent(item.productId)}/image.jpg`;
        return {
          productId: String(item.productId).slice(0, 64),
          name: String(item.name).trim().slice(0, 140),
          ...(typeof item.ref === 'string' && item.ref.trim()
            ? { ref: item.ref.trim().slice(0, 40) }
            : {}),
          image: safeImg,
          ...(typeof item.size === 'string' && item.size.trim()
            ? { size: item.size.trim().slice(0, 40) }
            : {}),
          quantity: Math.max(1, Math.min(99, Number(item.quantity) || 1)),
          price: Math.max(0, Number(item.price) || 0)
        };
      });
  }

  // --- WEB PUSH NOTIFICATIONS (MERCHANT & CUSTOMER) ---
  const VAPID_DISK_PATH = '/tmp/huize-vapid-keys.json';
  const PUSH_SUBS_DISK_PATH = '/tmp/huize-push-subs.json';
  const VAPID_SUBJECT = 'mailto:huizegsr@gmail.com';

  interface VapidKeyPair {
    publicKey: string;
    privateKey: string;
    subject: string;
    createdAt: string;
  }

  interface WebPushSubscriptionKeys {
    p256dh: string;
    auth: string;
  }

  interface StoredPushSubscription {
    id: string;
    role: 'admin' | 'customer';
    endpoint: string;
    keys: WebPushSubscriptionKeys;
    orderIds?: string[];
    userAgent?: string;
    createdAt: string;
    updatedAt: string;
  }

  let vapidKeysCache: VapidKeyPair | null = null;
  let pushSubsCache: Record<string, StoredPushSubscription> = (() => {
    try {
      if (fs.existsSync(PUSH_SUBS_DISK_PATH)) {
        const raw = JSON.parse(fs.readFileSync(PUSH_SUBS_DISK_PATH, 'utf8'));
        if (raw && typeof raw === 'object') {
          const normalized: Record<string, StoredPushSubscription> = {};
          for (const [k, v] of Object.entries(raw as Record<string, any>)) {
            const ep = v?.endpoint || v?.subscription?.endpoint;
            const ks = v?.keys || v?.subscription?.keys;
            if (v?.id && ep && ks?.p256dh && ks?.auth) {
              normalized[k] = {
                id: v.id,
                role: v.role === 'admin' ? 'admin' : 'customer',
                endpoint: String(ep),
                keys: { p256dh: String(ks.p256dh), auth: String(ks.auth) },
                ...(Array.isArray(v.orderIds) ? { orderIds: v.orderIds.slice(-30) } : {}),
                ...(typeof v.userAgent === 'string' ? { userAgent: v.userAgent.slice(0, 160) } : {}),
                createdAt: v.createdAt || new Date().toISOString(),
                updatedAt: v.updatedAt || new Date().toISOString()
              };
            }
          }
          return normalized;
        }
      }
    } catch {
      // Ignore disk read error
    }
    return {};
  })();
  let pushSubsLoadedAt = 0;

  function savePushSubsDiskCache(): void {
    try {
      fs.writeFileSync(PUSH_SUBS_DISK_PATH, JSON.stringify(pushSubsCache), 'utf8');
    } catch {
      // Ignore disk write error
    }
  }

  function computePushSubId(role: 'admin' | 'customer', endpoint: string): string {
    return createHash('sha256').update(`${role}:${endpoint}`).digest('hex').slice(0, 32);
  }

  async function ensureVapidKeys(): Promise<VapidKeyPair> {
    if (vapidKeysCache) return vapidKeysCache;

    const envPub = process.env.VAPID_PUBLIC_KEY?.trim();
    const envPriv = process.env.VAPID_PRIVATE_KEY?.trim();
    if (envPub && envPriv) {
      vapidKeysCache = {
        publicKey: envPub,
        privateKey: envPriv,
        subject: VAPID_SUBJECT,
        createdAt: new Date().toISOString()
      };
      webpush.setVapidDetails(VAPID_SUBJECT, vapidKeysCache.publicKey, vapidKeysCache.privateKey);
      return vapidKeysCache;
    }

    if (serverDb) {
      try {
        const snap = await getDoc(doc(serverDb, 'push_config', 'vapid'));
        if (snap.exists()) {
          const data = snap.data() as Partial<VapidKeyPair>;
          if (data?.publicKey && data?.privateKey) {
            const loaded: VapidKeyPair = {
              publicKey: data.publicKey,
              privateKey: data.privateKey,
              subject: data.subject || VAPID_SUBJECT,
              createdAt: data.createdAt || new Date().toISOString()
            };
            vapidKeysCache = loaded;
            try {
              fs.writeFileSync(VAPID_DISK_PATH, JSON.stringify(loaded), 'utf8');
            } catch {
              // Ignore
            }
            webpush.setVapidDetails(loaded.subject, loaded.publicKey, loaded.privateKey);
            return loaded;
          }
        }
      } catch (err) {
        console.warn('[Push] Firestore VAPID lookup skipped:', err);
      }
    }

    try {
      if (fs.existsSync(VAPID_DISK_PATH)) {
        const disk = JSON.parse(fs.readFileSync(VAPID_DISK_PATH, 'utf8')) as Partial<VapidKeyPair>;
        if (disk?.publicKey && disk?.privateKey) {
          const loaded: VapidKeyPair = {
            publicKey: disk.publicKey,
            privateKey: disk.privateKey,
            subject: disk.subject || VAPID_SUBJECT,
            createdAt: disk.createdAt || new Date().toISOString()
          };
          vapidKeysCache = loaded;
          webpush.setVapidDetails(loaded.subject, loaded.publicKey, loaded.privateKey);
          return loaded;
        }
      }
    } catch {
      // Ignore disk read error
    }

    const generated = webpush.generateVAPIDKeys();
    const record: VapidKeyPair = {
      publicKey: generated.publicKey,
      privateKey: generated.privateKey,
      subject: VAPID_SUBJECT,
      createdAt: new Date().toISOString()
    };
    vapidKeysCache = record;
    webpush.setVapidDetails(record.subject, record.publicKey, record.privateKey);

    try {
      fs.writeFileSync(VAPID_DISK_PATH, JSON.stringify(record), 'utf8');
    } catch {
      // Ignore
    }

    if (serverDb) {
      await setDoc(doc(serverDb, 'push_config', 'vapid'), record).catch((err) =>
        console.warn('[Push] VAPID Firestore save failed:', err)
      );
    }

    return record;
  }

  async function ensurePushSubscriptionsLoaded(forceRefresh = false): Promise<StoredPushSubscription[]> {
    const now = Date.now();
    if (
      serverDb &&
      (forceRefresh || pushSubsLoadedAt === 0 || now - pushSubsLoadedAt > CATALOG_CACHE_TTL_MS)
    ) {
      try {
        const snap = await getDocs(collection(serverDb, 'push_subscriptions'));
        const nextMap: Record<string, StoredPushSubscription> = { ...pushSubsCache };
        snap.forEach((d) => {
          const data = d.data() as any;
          const ep = data?.endpoint || data?.subscription?.endpoint;
          const ks = data?.keys || data?.subscription?.keys;
          if (data?.id && ep && ks?.p256dh && ks?.auth) {
            nextMap[data.id] = {
              id: data.id,
              role: data.role === 'admin' ? 'admin' : 'customer',
              endpoint: String(ep),
              keys: { p256dh: String(ks.p256dh), auth: String(ks.auth) },
              ...(Array.isArray(data.orderIds) ? { orderIds: data.orderIds.slice(-30) } : {}),
              ...(typeof data.userAgent === 'string' ? { userAgent: data.userAgent.slice(0, 160) } : {}),
              createdAt: data.createdAt || new Date().toISOString(),
              updatedAt: data.updatedAt || new Date().toISOString()
            };
          }
        });
        pushSubsCache = nextMap;
        pushSubsLoadedAt = now;
        savePushSubsDiskCache();
      } catch (err) {
        console.warn('[Push] Subscriptions Firestore load skipped:', err);
      }
    }
    return Object.values(pushSubsCache);
  }

  async function removePushSubscriptionById(subId: string): Promise<void> {
    if (pushSubsCache[subId]) {
      delete pushSubsCache[subId];
      savePushSubsDiskCache();
    }
    if (serverDb) {
      await deleteDoc(doc(serverDb, 'push_subscriptions', subId)).catch(() => {});
    }
  }

  async function sendWebPushBatch(
    targets: StoredPushSubscription[],
    payload: { title: string; body: string; url: string; tag?: string }
  ): Promise<number> {
    if (targets.length === 0) return 0;
    try {
      await ensureVapidKeys();
    } catch (err) {
      console.warn('[Push] VAPID keys unavailable:', err);
      return 0;
    }

    const messageJson = JSON.stringify({
      title: payload.title,
      body: payload.body,
      url: payload.url,
      tag: payload.tag || 'huize-shop-chat',
      icon: '/pwa-192x192.png',
      badge: '/pwa-192x192.png'
    });

    let sent = 0;
    await Promise.allSettled(
      targets.map(async (target) => {
        try {
          await webpush.sendNotification(
            {
              endpoint: target.endpoint,
              keys: target.keys
            },
            messageJson,
            {
              TTL: 86400,
              urgency: 'high'
            }
          );
          sent += 1;
        } catch (err: any) {
          const status = err?.statusCode;
          if (status === 404 || status === 410) {
            await removePushSubscriptionById(target.id);
          } else {
            console.warn(`[Push] Delivery failed (${status || 'err'}) for ${target.role}:`, err?.body || err?.message);
          }
        }
      })
    );
    return sent;
  }

  async function sendPushToAdmins(payload: {
    title: string;
    body: string;
    url: string;
    tag?: string;
  }): Promise<number> {
    const subs = await ensurePushSubscriptionsLoaded(false);
    const adminTargets = subs.filter((s) => s.role === 'admin');
    return sendWebPushBatch(adminTargets, payload);
  }

  async function sendPushToCustomerOrder(
    orderId: string,
    payload: { title: string; body: string; url: string; tag?: string }
  ): Promise<number> {
    const subs = await ensurePushSubscriptionsLoaded(false);
    const customerTargets = subs.filter(
      (s) => s.role === 'customer' && Array.isArray(s.orderIds) && s.orderIds.includes(orderId)
    );
    return sendWebPushBatch(customerTargets, payload);
  }

  // GET /api/push/public-key -> Expose public VAPID key to client browsers
  app.get('/api/push/public-key', async (_req, res) => {
    try {
      const keys = await ensureVapidKeys();
      return res.json({ success: true, publicKey: keys.publicKey });
    } catch (err) {
      console.error('[Push] Public key fetch failed:', err);
      return res.status(500).json({ success: false, error: 'Clé Push indisponible.' });
    }
  });

  // POST /api/push/subscribe -> Register or update a Web Push subscription (merchant or verified customer)
  app.post('/api/push/subscribe', async (req, res) => {
    try {
      const body = req.body || {};
      const role = body.role === 'admin' ? 'admin' : body.role === 'customer' ? 'customer' : null;
      if (!role) {
        return res.status(400).json({ success: false, error: 'Rôle invalide.' });
      }
      if (role === 'admin' && !isAdminAuthorizedRequest(req)) {
        return res.status(403).json({ success: false, error: 'Accès administrateur requis.' });
      }

      const rawSub = body.subscription;
      const endpoint = typeof rawSub?.endpoint === 'string' ? rawSub.endpoint.trim().slice(0, 1000) : '';
      const p256dh = typeof rawSub?.keys?.p256dh === 'string' ? rawSub.keys.p256dh.trim().slice(0, 300) : '';
      const auth = typeof rawSub?.keys?.auth === 'string' ? rawSub.keys.auth.trim().slice(0, 200) : '';

      if (
        endpoint.length < 10 ||
        (!endpoint.startsWith('https://') && !endpoint.startsWith('http://')) ||
        !p256dh ||
        !auth
      ) {
        return res.status(400).json({ success: false, error: 'Abonnement Push invalide.' });
      }

      await ensurePushSubscriptionsLoaded(false);
      const subId = computePushSubId(role, endpoint);
      const existing = pushSubsCache[subId];
      const nowIso = new Date().toISOString();

      let verifiedOrderIds: string[] = Array.isArray(existing?.orderIds) ? [...existing.orderIds] : [];
      if (role === 'customer' && Array.isArray(body.sessions)) {
        for (const s of body.sessions.slice(0, 30)) {
          const oid = typeof s?.orderId === 'string' ? s.orderId.trim() : '';
          const tok = typeof s?.accessToken === 'string' ? s.accessToken.trim() : '';
          if (!oid || !tok) continue;
          const thread = await ensureThreadById(oid);
          if (thread && thread.accessToken === tok && !verifiedOrderIds.includes(oid)) {
            verifiedOrderIds.push(oid);
          }
        }
        verifiedOrderIds = verifiedOrderIds.slice(-30);
      }

      const userAgent =
        typeof req.headers['user-agent'] === 'string' ? req.headers['user-agent'].slice(0, 160) : undefined;

      const record: StoredPushSubscription = {
        id: subId,
        role,
        endpoint,
        keys: { p256dh, auth },
        ...(role === 'customer' ? { orderIds: verifiedOrderIds } : {}),
        ...(userAgent ? { userAgent } : {}),
        createdAt: existing?.createdAt || nowIso,
        updatedAt: nowIso
      };

      pushSubsCache[subId] = record;
      savePushSubsDiskCache();

      if (serverDb) {
        await setDoc(doc(serverDb, 'push_subscriptions', subId), stripUndefinedDeep(record)).catch(
          (err) => console.warn('[Push] Save subscription failed:', err)
        );
      }

      return res.json({
        success: true,
        id: subId,
        role,
        ...(role === 'customer' ? { orderIds: verifiedOrderIds } : {})
      });
    } catch (err) {
      console.error('[Push] Subscribe error:', err);
      return res.status(500).json({ success: false, error: "Impossible d'enregistrer l'alerte." });
    }
  });

  // POST /api/push/unsubscribe -> Remove Web Push subscription by endpoint
  app.post('/api/push/unsubscribe', async (req, res) => {
    try {
      const endpoint = typeof req.body?.endpoint === 'string' ? req.body.endpoint.trim() : '';
      const role = req.body?.role === 'admin' ? 'admin' : req.body?.role === 'customer' ? 'customer' : null;
      if (!endpoint) {
        return res.status(400).json({ success: false });
      }
      if (role === 'admin' && !isAdminAuthorizedRequest(req)) {
        return res.status(403).json({ success: false });
      }

      const rolesToDelete: Array<'admin' | 'customer'> = role
        ? [role]
        : isAdminAuthorizedRequest(req)
        ? ['admin', 'customer']
        : ['customer'];

      await Promise.all(rolesToDelete.map((r) => removePushSubscriptionById(computePushSubId(r, endpoint))));
      return res.json({ success: true });
    } catch {
      return res.status(500).json({ success: false });
    }
  });

  // POST /api/push/test -> Send a test push notification to verify phone/PC setup
  app.post('/api/push/test', async (req, res) => {
    try {
      const role = req.body?.role === 'admin' ? 'admin' : 'customer';
      const endpoint = typeof req.body?.endpoint === 'string' ? req.body.endpoint.trim() : '';

      await ensurePushSubscriptionsLoaded(false);

      if (role === 'admin') {
        if (!isAdminAuthorizedRequest(req)) {
          return res.status(403).json({ success: false, error: 'Non autorisé.' });
        }
        const subs = Object.values(pushSubsCache).filter((s) => s.role === 'admin');
        const targetSubs = endpoint ? subs.filter((s) => s.endpoint === endpoint) : subs;
        if (targetSubs.length === 0) {
          return res.status(404).json({
            success: false,
            error: 'Aucun appareil administrateur abonné. Activez d’abord les notifications.'
          });
        }
        const sent = await sendWebPushBatch(targetSubs, {
          title: 'HUIZE SHOP • Test alerte commerçant',
          body: 'Vos notifications téléphone & PC fonctionnent parfaitement ! Vous serez averti à chaque commande.',
          url: '/?admin=1#admin',
          tag: 'huize-admin-test'
        });
        return res.json({ success: sent > 0, sent });
      }

      if (!endpoint) {
        return res.status(400).json({ success: false, error: 'Abonnement non détecté sur cet appareil.' });
      }
      const subId = computePushSubId('customer', endpoint);
      const sub = pushSubsCache[subId];
      if (!sub) {
        return res.status(404).json({
          success: false,
          error: 'Activez d’abord les alertes sur cet appareil.'
        });
      }
      const sent = await sendWebPushBatch([sub], {
        title: 'HUIZE SHOP • Test notification',
        body: 'Vous recevrez bien les réponses de la boutique ici en temps réel !',
        url: '/',
        tag: 'huize-customer-test'
      });
      return res.json({ success: sent > 0, sent });
    } catch (err) {
      console.error('[Push] Test push failed:', err);
      return res.status(500).json({ success: false, error: 'Échec de l’envoi du test.' });
    }
  });

  // Real-time WebSocket clients registry
  interface ChatWsMeta {
    role: 'customer' | 'admin';
    orderId?: string;
    orderIds?: Set<string>;
    isAlive: boolean;
  }
  const chatWss = new WebSocketServer({ noServer: true });
  const wsMetaMap = new WeakMap<WebSocket, ChatWsMeta>();

  function broadcastChatEvent(
    event: { type: string; threadId?: string; [key: string]: any },
    targetOrderId?: string
  ) {
    const payload = JSON.stringify(event);
    chatWss.clients.forEach((client) => {
      if (client.readyState !== WebSocket.OPEN) return;
      const meta = wsMetaMap.get(client);
      if (!meta) return;
      if (
        meta.role === 'admin' ||
        (targetOrderId && (meta.orderId === targetOrderId || meta.orderIds?.has(targetOrderId)))
      ) {
        client.send(payload);
      }
    });
  }

  chatWss.on('connection', (ws) => {
    wsMetaMap.set(ws, { role: 'customer', isAlive: true });

    ws.on('pong', () => {
      const meta = wsMetaMap.get(ws);
      if (meta) meta.isAlive = true;
    });

    ws.on('message', async (raw) => {
      try {
        const msg = JSON.parse(raw.toString());
        if (!msg || typeof msg.type !== 'string') return;

        if (msg.type === 'auth:customer') {
          const verifiedIds = new Set<string>();
          if (Array.isArray(msg.sessions)) {
            for (const s of msg.sessions.slice(0, 30)) {
              const oid = typeof s?.orderId === 'string' ? s.orderId.trim() : '';
              const tok =
                typeof s?.token === 'string'
                  ? s.token.trim()
                  : typeof s?.accessToken === 'string'
                  ? s.accessToken.trim()
                  : '';
              if (!oid || !tok) continue;
              const t = await ensureThreadById(oid);
              if (t && t.accessToken === tok) {
                verifiedIds.add(oid);
              }
            }
          }

          const orderId = typeof msg.orderId === 'string' ? msg.orderId.trim() : '';
          const token = typeof msg.token === 'string' ? msg.token.trim() : '';
          if (orderId && token) {
            const thread = await ensureThreadById(orderId);
            if (thread && thread.accessToken === token) {
              verifiedIds.add(orderId);
            }
          }

          if (verifiedIds.size > 0) {
            const primaryOrderId = orderId && verifiedIds.has(orderId) ? orderId : Array.from(verifiedIds)[0];
            wsMetaMap.set(ws, {
              role: 'customer',
              orderId: primaryOrderId,
              orderIds: verifiedIds,
              isAlive: true
            });
            ws.send(
              JSON.stringify({
                type: 'auth:ok',
                role: 'customer',
                orderId: primaryOrderId,
                orderIds: Array.from(verifiedIds)
              })
            );
          } else {
            ws.send(JSON.stringify({ type: 'auth:error', error: 'Accès discussion non valide.' }));
          }
        } else if (msg.type === 'auth:admin') {
          const adminEmail =
            typeof msg.adminEmail === 'string' ? msg.adminEmail.trim().toLowerCase() : '';
          if (adminEmail === AUTHORIZED_ADMIN_EMAIL.toLowerCase()) {
            wsMetaMap.set(ws, { role: 'admin', isAlive: true });
            ws.send(JSON.stringify({ type: 'auth:ok', role: 'admin' }));
          } else {
            ws.send(JSON.stringify({ type: 'auth:error', error: 'Non autorisé.' }));
          }
        }
      } catch {
        // Ignore malformed WS payloads
      }
    });
  });

  const wsHeartbeatInterval = setInterval(() => {
    chatWss.clients.forEach((ws) => {
      const meta = wsMetaMap.get(ws);
      if (!meta || !meta.isAlive) {
        ws.terminate();
        return;
      }
      meta.isAlive = false;
      ws.ping();
    });
  }, 30000);
  wsHeartbeatInterval.unref();

  // POST /api/chat/threads -> Customer starts an integrated order & chat thread directly on the site
  app.post('/api/chat/threads', async (req, res) => {
    try {
      const clientIp = req.ip || 'unknown';
      if (!checkRateLimit(`create:${clientIp}`, 12, 5 * 60 * 1000)) {
        return res.status(429).json({
          success: false,
          error: 'Trop de commandes envoyées en peu de temps. Réessayez dans quelques minutes.'
        });
      }

      const body = req.body || {};
      const customerName = typeof body.customerName === 'string' ? body.customerName.trim().slice(0, 120) : '';
      const customerPhone = typeof body.customerPhone === 'string' ? body.customerPhone.trim().slice(0, 40) : '';
      const customerCity =
        (typeof body.customerCity === 'string' ? body.customerCity.trim().slice(0, 160) : '') || 'Ouagadougou';
      const paymentMethod =
        (typeof body.paymentMethod === 'string' ? body.paymentMethod.trim().slice(0, 80) : '') ||
        'Orange Money / Moov Money';
      const initialMessage =
        typeof body.initialMessage === 'string' ? body.initialMessage.trim().slice(0, 1000) : '';
      const rawReferralCode = typeof body.referralCode === 'string' ? body.referralCode : '';
      const cleanRef = normalizeTeamCode(rawReferralCode);

      if (customerName.length < 2) {
        return res.status(400).json({
          success: false,
          error: 'Veuillez indiquer votre nom pour démarrer la commande.'
        });
      }
      if (customerPhone.replace(/[^0-9]/g, '').length < 6) {
        return res.status(400).json({
          success: false,
          error: 'Veuillez saisir un numéro de téléphone / WhatsApp valide.'
        });
      }

      const items = Array.isArray(body.items) ? sanitizeOrderItems(body.items) : [];
      if (items.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Aucun article sélectionné pour cette commande.'
        });
      }

      const computedTotal = items.reduce((acc, item) => acc + item.price * item.quantity, 0);
      const itemsSummary = items
        .map((i) => `${i.quantity}x ${i.name} (${i.size || 'Standard'})`)
        .join(', ')
        .slice(0, 500);

      // Unique order ID
      let orderId = `CMD-${Math.floor(1000 + Math.random() * 9000)}`;
      while (chatCache.threads[orderId]) {
        orderId = `CMD-${Math.floor(10000 + Math.random() * 89999)}`;
      }
      const accessToken = randomBytes(16).toString('hex');
      const nowIso = new Date().toISOString();

      let referredByName: string | undefined;
      if (cleanRef) {
        const members = await getCachedTeamMembers(false);
        const matched = members.find((m) => normalizeTeamCode(m.code) === cleanRef);
        if (matched) referredByName = matched.name;
      }

      const initialStatus: WhatsAppOrder['status'] = 'discussion';
      const statusLabel = ORDER_STATUS_LABELS[initialStatus];

      const welcomeText = initialMessage
        ? initialMessage
        : `Bonjour HUIZE SHOP ! Je souhaite commander : ${itemsSummary} (${computedTotal.toLocaleString('fr-FR')} F CFA) — Livraison à ${customerCity}.`;

      const firstMessage: OrderChatMessage = {
        id: `msg-${Date.now()}-${randomBytes(3).toString('hex')}`,
        threadId: orderId,
        sender: 'customer',
        senderName: customerName,
        text: welcomeText.slice(0, 1000),
        createdAt: nowIso,
        ...(items.length === 1 ? { attachedProduct: items[0] } : {})
      };

      const storedThread: StoredOrderThread = {
        id: orderId,
        orderId,
        accessToken,
        customerName,
        customerPhone,
        customerCity,
        paymentMethod,
        itemsSummary,
        items,
        total: computedTotal,
        status: initialStatus,
        statusLabel,
        createdAt: nowIso,
        updatedAt: nowIso,
        lastMessageText: firstMessage.text.slice(0, 300),
        lastMessageSender: 'customer',
        unreadForCustomer: 0,
        unreadForAdmin: 1,
        ...(cleanRef ? { referredByCode: cleanRef } : {}),
        ...(referredByName ? { referredByName } : {})
      };

      const orderRecord: WhatsAppOrder = {
        id: orderId,
        customerName,
        phone: customerPhone,
        city: customerCity,
        customerPhone,
        customerCity,
        itemsSummary,
        items,
        total: computedTotal,
        date: new Date().toLocaleDateString('fr-FR', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        }),
        status: initialStatus,
        statusLabel,
        paymentMethod,
        channel: 'site_chat',
        createdAt: nowIso,
        ...(cleanRef ? { referredByCode: cleanRef } : {}),
        ...(referredByName ? { referredByName } : {})
      };

      chatCache.threads[orderId] = storedThread;
      chatCache.messages[orderId] = [firstMessage];
      saveChatDiskCache(chatCache);

      // Update team orders cache immediately
      teamCache = {
        ...teamCache,
        orders: [orderRecord, ...teamCache.orders.filter((o) => o.id !== orderId)],
        ordersUpdatedAt: teamCache.ordersUpdatedAt || Date.now()
      };
      saveTeamDiskCache(teamCache);

      // Increment daily siteChatOrders metric
      void recordDailyOrderMetric('site_chat');

      // Persist thread, first message, order & lead cleanly to Firestore
      if (serverDb) {
        const cleanPhoneDigits = customerPhone.replace(/[^0-9]/g, '');
        const words = customerName.split(/\s+/).filter(Boolean);
        const avatar =
          words.length >= 2
            ? `${words[0][0]}${words[1][0]}`.toUpperCase()
            : (customerName.slice(0, 2) || 'CL').toUpperCase();
        const leadDoc: ClientLead = {
          id: cleanPhoneDigits ? `lead-${cleanPhoneDigits}` : `lead-${Date.now()}`,
          name: customerName,
          city: customerCity,
          notes: `Messagerie site • ${itemsSummary} (${computedTotal.toLocaleString('fr-FR')} F CFA)`,
          phone: customerPhone,
          avatar
        };

        await Promise.allSettled([
          setDoc(doc(serverDb, 'order_threads', orderId), stripUndefinedDeep(storedThread)),
          setDoc(
            doc(serverDb, 'order_threads', orderId, 'messages', firstMessage.id),
            stripUndefinedDeep(firstMessage)
          ),
          setDoc(doc(serverDb, 'orders', orderId), stripUndefinedDeep(orderRecord)),
          setDoc(doc(serverDb, 'leads', leadDoc.id), stripUndefinedDeep(leadDoc))
        ]);
      }

      const publicThread = sanitizePublicThread(storedThread);
      broadcastChatEvent({
        type: 'chat:thread_created',
        threadId: orderId,
        thread: publicThread,
        message: firstMessage
      });

      void sendPushToAdmins({
        title: `Nouvelle commande ${orderId}`,
        body: `${customerName} (${customerCity}) · ${itemsSummary} — ${computedTotal.toLocaleString('fr-FR')} F CFA`,
        url: `/?admin=1&chat=${encodeURIComponent(orderId)}#admin`,
        tag: `huize-admin-${orderId}`
      });

      return res.json({
        success: true,
        thread: publicThread,
        order: orderRecord,
        accessToken,
        messages: [firstMessage]
      });
    } catch (err) {
      console.error('[Chat] Create thread error:', err);
      return res.status(500).json({
        success: false,
        error: 'Impossible de créer la commande pour le moment. Réessayez ou utilisez WhatsApp.'
      });
    }
  });

  // POST /api/chat/my-threads -> Customer retrieves only threads matching their secret access tokens
  app.post('/api/chat/my-threads', async (req, res) => {
    try {
      const sessions = Array.isArray(req.body?.sessions) ? req.body.sessions.slice(0, 30) : [];
      const results: OrderThread[] = [];
      for (const s of sessions) {
        if (!s || typeof s.orderId !== 'string' || typeof s.accessToken !== 'string') continue;
        const thread = await ensureThreadById(s.orderId.trim());
        if (thread && thread.accessToken === s.accessToken.trim()) {
          results.push(sanitizePublicThread(thread));
        }
      }
      results.sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
      return res.json({ success: true, threads: results });
    } catch {
      return res.status(500).json({ success: false, threads: [] });
    }
  });

  // GET /api/chat/threads/:orderId -> Customer fetches one private thread + messages
  app.get('/api/chat/threads/:orderId', async (req, res) => {
    try {
      const orderId = req.params.orderId;
      const token =
        (typeof req.headers['x-chat-token'] === 'string' ? req.headers['x-chat-token'] : '') ||
        (typeof req.query.token === 'string' ? req.query.token : '');

      const thread = await ensureThreadById(orderId);
      if (!thread || !token || thread.accessToken !== token.trim()) {
        return res.status(403).json({
          success: false,
          error: 'Lien de suivi ou code secret invalide.'
        });
      }

      const messages = await ensureThreadMessages(orderId);
      return res.json({
        success: true,
        thread: sanitizePublicThread(thread),
        messages
      });
    } catch {
      return res.status(500).json({ success: false, error: 'Erreur de chargement de la discussion.' });
    }
  });

  // POST /api/chat/threads/:orderId/messages -> Customer OR Admin sends a message
  app.post('/api/chat/threads/:orderId/messages', async (req, res) => {
    try {
      const orderId = req.params.orderId;
      const isAdmin = isAdminAuthorizedRequest(req);
      const token =
        (typeof req.headers['x-chat-token'] === 'string' ? req.headers['x-chat-token'] : '') ||
        (typeof req.body?.token === 'string' ? req.body.token : '');

      const thread = await ensureThreadById(orderId);
      if (!thread) {
        return res.status(404).json({ success: false, error: 'Discussion introuvable.' });
      }
      if (!isAdmin && (!token || thread.accessToken !== token.trim())) {
        return res.status(403).json({ success: false, error: 'Non autorisé.' });
      }

      const clientIp = req.ip || 'unknown';
      if (!isAdmin && !checkRateLimit(`msg:${clientIp}:${orderId}`, 30, 60 * 1000)) {
        return res.status(429).json({
          success: false,
          error: 'Envoi trop rapide. Patientez quelques secondes.'
        });
      }

      const rawText = typeof req.body?.text === 'string' ? req.body.text.trim().slice(0, 1000) : '';
      const rawAttached = req.body?.attachedProduct;
      const attachedList = rawAttached ? sanitizeOrderItems([rawAttached]) : [];
      const attachedProduct = attachedList.length > 0 ? attachedList[0] : undefined;

      if (!rawText && !attachedProduct) {
        return res.status(400).json({ success: false, error: 'Message vide.' });
      }

      const sender: ChatSenderRole = isAdmin ? 'merchant' : 'customer';
      const senderName = isAdmin ? 'HUIZE SHOP' : thread.customerName;
      const nowIso = new Date().toISOString();
      const text = rawText || `Article proposé : ${attachedProduct?.name || ''}`;

      const newMessage: OrderChatMessage = {
        id: `msg-${Date.now()}-${randomBytes(3).toString('hex')}`,
        threadId: orderId,
        sender,
        senderName,
        text,
        createdAt: nowIso,
        ...(attachedProduct ? { attachedProduct } : {})
      };

      const existingMsgs = await ensureThreadMessages(orderId);
      const updatedMsgs = [...existingMsgs, newMessage];
      chatCache.messages[orderId] = updatedMsgs;

      const updatedThread: StoredOrderThread = {
        ...thread,
        updatedAt: nowIso,
        lastMessageText: text.slice(0, 300),
        lastMessageSender: sender,
        unreadForAdmin: sender === 'customer' ? (thread.unreadForAdmin || 0) + 1 : 0,
        unreadForCustomer: sender === 'merchant' ? (thread.unreadForCustomer || 0) + 1 : 0
      };
      chatCache.threads[orderId] = updatedThread;
      saveChatDiskCache(chatCache);

      if (serverDb) {
        await Promise.allSettled([
          setDoc(
            doc(serverDb, 'order_threads', orderId, 'messages', newMessage.id),
            stripUndefinedDeep(newMessage)
          ),
          setDoc(doc(serverDb, 'order_threads', orderId), stripUndefinedDeep(updatedThread))
        ]);
      }

      const publicThread = sanitizePublicThread(updatedThread);
      broadcastChatEvent(
        {
          type: 'chat:message',
          threadId: orderId,
          thread: publicThread,
          message: newMessage
        },
        orderId
      );

      if (sender === 'customer') {
        void sendPushToAdmins({
          title: `Message de ${thread.customerName} (${orderId})`,
          body: text.slice(0, 140),
          url: `/?admin=1&chat=${encodeURIComponent(orderId)}#admin`,
          tag: `huize-admin-${orderId}`
        });
      } else if (sender === 'merchant') {
        void sendPushToCustomerOrder(orderId, {
          title: `Réponse HUIZE SHOP (${orderId})`,
          body: text.slice(0, 140),
          url: `/?suivi=${encodeURIComponent(orderId)}&cle=${encodeURIComponent(thread.accessToken)}`,
          tag: `huize-customer-${orderId}`
        });
      }

      return res.json({
        success: true,
        thread: publicThread,
        message: newMessage
      });
    } catch (err) {
      console.error('[Chat] Send message error:', err);
      return res.status(500).json({ success: false, error: "Impossible d'envoyer le message." });
    }
  });

  // POST /api/chat/threads/:orderId/read -> Mark unread counter as 0
  app.post('/api/chat/threads/:orderId/read', async (req, res) => {
    try {
      const orderId = req.params.orderId;
      const isAdmin = isAdminAuthorizedRequest(req);
      const token =
        (typeof req.headers['x-chat-token'] === 'string' ? req.headers['x-chat-token'] : '') ||
        (typeof req.body?.token === 'string' ? req.body.token : '');

      const thread = await ensureThreadById(orderId);
      if (!thread) return res.status(404).json({ success: false });
      if (!isAdmin && (!token || thread.accessToken !== token.trim())) {
        return res.status(403).json({ success: false });
      }

      const updatedThread: StoredOrderThread = {
        ...thread,
        ...(isAdmin ? { unreadForAdmin: 0 } : { unreadForCustomer: 0 })
      };
      chatCache.threads[orderId] = updatedThread;
      saveChatDiskCache(chatCache);

      if (serverDb) {
        setDoc(doc(serverDb, 'order_threads', orderId), stripUndefinedDeep(updatedThread)).catch(() => {});
      }

      const publicThread = sanitizePublicThread(updatedThread);
      broadcastChatEvent({ type: 'chat:read', threadId: orderId, thread: publicThread }, orderId);
      return res.json({ success: true, thread: publicThread });
    } catch {
      return res.status(500).json({ success: false });
    }
  });

  // GET /api/chat/admin/threads -> Admin lists all order conversations
  app.get('/api/chat/admin/threads', async (req, res) => {
    if (!isAdminAuthorizedRequest(req)) {
      return res.status(403).json({ success: false, error: 'Accès administrateur requis.' });
    }
    try {
      const force = req.query.refresh === '1';
      const list = await ensureChatThreadsLoaded(force);
      return res.json({
        success: true,
        threads: list.map(sanitizePublicThread)
      });
    } catch {
      return res.status(500).json({ success: false, threads: [] });
    }
  });

  // GET /api/chat/admin/threads/:orderId -> Admin reads any conversation + messages
  app.get('/api/chat/admin/threads/:orderId', async (req, res) => {
    if (!isAdminAuthorizedRequest(req)) {
      return res.status(403).json({ success: false, error: 'Accès administrateur requis.' });
    }
    try {
      const thread = await ensureThreadById(req.params.orderId);
      if (!thread) {
        return res.status(404).json({ success: false, error: 'Discussion introuvable.' });
      }
      const messages = await ensureThreadMessages(req.params.orderId);
      return res.json({
        success: true,
        thread: sanitizePublicThread(thread),
        messages
      });
    } catch {
      return res.status(500).json({ success: false });
    }
  });

  // PATCH /api/chat/admin/threads/:orderId/status -> Admin updates order status & notifies customer in chat
  app.patch('/api/chat/admin/threads/:orderId/status', async (req, res) => {
    if (!isAdminAuthorizedRequest(req)) {
      return res.status(403).json({ success: false, error: 'Accès administrateur requis.' });
    }
    try {
      const orderId = req.params.orderId;
      const nextStatus = req.body?.status as WhatsAppOrder['status'];
      if (!nextStatus || !ORDER_STATUS_LABELS[nextStatus]) {
        return res.status(400).json({ success: false, error: 'Statut invalide.' });
      }

      const thread = await ensureThreadById(orderId);
      if (!thread) {
        return res.status(404).json({ success: false, error: 'Discussion introuvable.' });
      }

      const nextLabel = ORDER_STATUS_LABELS[nextStatus];
      const nowIso = new Date().toISOString();
      const statusMsg: OrderChatMessage = {
        id: `msg-${Date.now()}-${randomBytes(3).toString('hex')}`,
        threadId: orderId,
        sender: 'system',
        senderName: 'HUIZE SHOP',
        text: `Statut de votre commande mis à jour : ${nextLabel}`,
        createdAt: nowIso
      };

      const existingMsgs = await ensureThreadMessages(orderId);
      chatCache.messages[orderId] = [...existingMsgs, statusMsg];

      const updatedThread: StoredOrderThread = {
        ...thread,
        status: nextStatus,
        statusLabel: nextLabel,
        updatedAt: nowIso,
        lastMessageText: statusMsg.text.slice(0, 300),
        lastMessageSender: 'system',
        unreadForCustomer: (thread.unreadForCustomer || 0) + 1
      };
      chatCache.threads[orderId] = updatedThread;
      saveChatDiskCache(chatCache);

      // Sync teamCache order status
      teamCache = {
        ...teamCache,
        orders: teamCache.orders.map((o) =>
          o.id === orderId ? { ...o, status: nextStatus, statusLabel: nextLabel } : o
        )
      };
      saveTeamDiskCache(teamCache);

      if (serverDb) {
        await Promise.allSettled([
          setDoc(doc(serverDb, 'order_threads', orderId), stripUndefinedDeep(updatedThread)),
          setDoc(
            doc(serverDb, 'order_threads', orderId, 'messages', statusMsg.id),
            stripUndefinedDeep(statusMsg)
          ),
          updateDoc(doc(serverDb, 'orders', orderId), {
            status: nextStatus,
            statusLabel: nextLabel
          })
        ]);
      }

      const publicThread = sanitizePublicThread(updatedThread);
      broadcastChatEvent(
        {
          type: 'chat:status',
          threadId: orderId,
          thread: publicThread,
          message: statusMsg
        },
        orderId
      );

      void sendPushToCustomerOrder(orderId, {
        title: `Commande ${orderId} : ${nextLabel}`,
        body: statusMsg.text,
        url: `/?suivi=${encodeURIComponent(orderId)}&cle=${encodeURIComponent(thread.accessToken)}`,
        tag: `huize-customer-${orderId}`
      });

      return res.json({
        success: true,
        thread: publicThread,
        message: statusMsg
      });
    } catch (err) {
      console.error('[Chat] Status update error:', err);
      return res.status(500).json({ success: false });
    }
  });

  // --- DAILY VISITS & EVOLUTION ANALYTICS ---
  const ANALYTICS_DISK_CACHE_PATH = '/tmp/huize-analytics-cache.json';

  interface AnalyticsCacheState {
    statsByDate: Record<string, DailySiteStats>;
    loadedAt: number;
  }

  function loadAnalyticsDiskCache(): AnalyticsCacheState {
    try {
      if (fs.existsSync(ANALYTICS_DISK_CACHE_PATH)) {
        const raw = JSON.parse(fs.readFileSync(ANALYTICS_DISK_CACHE_PATH, 'utf8'));
        if (raw && typeof raw.statsByDate === 'object') {
          return raw as AnalyticsCacheState;
        }
      }
    } catch {
      // Ignore read errors
    }
    return { statsByDate: {}, loadedAt: 0 };
  }

  function saveAnalyticsDiskCache(state: AnalyticsCacheState): void {
    try {
      fs.writeFileSync(ANALYTICS_DISK_CACHE_PATH, JSON.stringify(state), 'utf8');
    } catch {
      // Ignore write errors
    }
  }

  let analyticsCache: AnalyticsCacheState = loadAnalyticsDiskCache();
  let nextAnalyticsRetryAt = 0;
  let analyticsRefreshInFlight: Promise<DailySiteStats[]> | null = null;
  const pendingFlushTimers = new Map<string, ReturnType<typeof setTimeout>>();

  function getUtcDateKey(date: Date = new Date()): string {
    return date.toISOString().slice(0, 10);
  }

  async function ensureDailyStatsLoaded(forceRefresh = false): Promise<DailySiteStats[]> {
    const now = Date.now();
    const isFresh =
      !forceRefresh &&
      analyticsCache.loadedAt > 0 &&
      now - analyticsCache.loadedAt < CATALOG_CACHE_TTL_MS;

    if (!isFresh && serverDb && (forceRefresh || now >= nextAnalyticsRetryAt)) {
      if (!analyticsRefreshInFlight) {
        analyticsRefreshInFlight = (async () => {
          try {
            const snap = await getDocs(collection(serverDb, 'daily_stats'));
            const merged: Record<string, DailySiteStats> = { ...analyticsCache.statsByDate };
            snap.forEach((d) => {
              const data = d.data() as DailySiteStats;
              if (data && typeof data.date === 'string') {
                const local = merged[data.date];
                // Keep the higher counts so in-flight local increments are never lost
                if (!local) {
                  merged[data.date] = data;
                } else {
                  merged[data.date] = {
                    date: data.date,
                    visits: Math.max(data.visits || 0, local.visits || 0),
                    pageViews: Math.max(data.pageViews || 0, local.pageViews || 0),
                    whatsappClicks: Math.max(data.whatsappClicks || 0, local.whatsappClicks || 0),
                    siteChatOrders: Math.max(data.siteChatOrders || 0, local.siteChatOrders || 0),
                    updatedAt:
                      (local.updatedAt || '') > (data.updatedAt || '')
                        ? local.updatedAt
                        : data.updatedAt
                  };
                }
              }
            });
            analyticsCache = { statsByDate: merged, loadedAt: Date.now() };
            nextAnalyticsRetryAt = 0;
            saveAnalyticsDiskCache(analyticsCache);
          } catch (err) {
            console.warn('[Analytics] Firestore daily_stats load skipped:', err);
            nextAnalyticsRetryAt = Date.now() + CATALOG_ERROR_BACKOFF_MS;
          }
          return Object.values(analyticsCache.statsByDate).sort((a, b) =>
            a.date.localeCompare(b.date)
          );
        })().finally(() => {
          analyticsRefreshInFlight = null;
        });
      }
      return analyticsRefreshInFlight;
    }

    return Object.values(analyticsCache.statsByDate).sort((a, b) => a.date.localeCompare(b.date));
  }

  function scheduleDailyStatFlush(dateKey: string): void {
    if (!serverDb) return;
    if (pendingFlushTimers.has(dateKey)) return;
    const timer = setTimeout(() => {
      pendingFlushTimers.delete(dateKey);
      const stat = analyticsCache.statsByDate[dateKey];
      if (!stat || !serverDb) return;
      const cleanStat: DailySiteStats = {
        date: stat.date,
        visits: Math.max(0, Math.round(stat.visits || 0)),
        pageViews: Math.max(0, Math.round(stat.pageViews || 0)),
        whatsappClicks: Math.max(0, Math.round(stat.whatsappClicks || 0)),
        siteChatOrders: Math.max(0, Math.round(stat.siteChatOrders || 0)),
        updatedAt: stat.updatedAt || new Date().toISOString()
      };
      setDoc(doc(serverDb, 'daily_stats', dateKey), cleanStat).catch((err) => {
        console.warn('[Analytics] Firestore daily_stats write skipped:', err);
      });
    }, 1500);
    timer.unref();
    pendingFlushTimers.set(dateKey, timer);
  }

  async function recordDailyOrderMetric(kind: 'whatsapp' | 'site_chat'): Promise<void> {
    await ensureDailyStatsLoaded(false);
    const todayKey = getUtcDateKey();
    const existing = analyticsCache.statsByDate[todayKey] || {
      date: todayKey,
      visits: 0,
      pageViews: 0,
      whatsappClicks: 0,
      siteChatOrders: 0,
      updatedAt: new Date().toISOString()
    };
    analyticsCache.statsByDate[todayKey] = {
      ...existing,
      whatsappClicks: (existing.whatsappClicks || 0) + (kind === 'whatsapp' ? 1 : 0),
      siteChatOrders: (existing.siteChatOrders || 0) + (kind === 'site_chat' ? 1 : 0),
      updatedAt: new Date().toISOString()
    };
    saveAnalyticsDiskCache(analyticsCache);
    scheduleDailyStatFlush(todayKey);
  }

  // POST /api/analytics/visit -> Track daily unique visits & page views
  app.post('/api/analytics/visit', async (req, res) => {
    try {
      const ua = typeof req.headers['user-agent'] === 'string' ? req.headers['user-agent'] : '';
      if (/facebookexternalhit|whatsapp|twitterbot|linkedinbot|slackbot|crawler|spider|slurp/i.test(ua)) {
        return res.json({ ok: true, ignored: true });
      }
      if (req.body?.isAdmin === true) {
        return res.json({ ok: true, ignored: true });
      }

      const clientIp = req.ip || 'unknown';
      if (!checkRateLimit(`visit:${clientIp}`, 30, 60 * 1000)) {
        return res.status(429).json({ ok: false });
      }

      await ensureDailyStatsLoaded(false);
      const todayKey = getUtcDateKey();
      const isNewDailyVisit = req.body?.isNewDailyVisit === true;
      const nowIso = new Date().toISOString();

      const existing = analyticsCache.statsByDate[todayKey] || {
        date: todayKey,
        visits: 0,
        pageViews: 0,
        whatsappClicks: 0,
        siteChatOrders: 0,
        updatedAt: nowIso
      };

      const nextStat: DailySiteStats = {
        ...existing,
        visits: (existing.visits || 0) + (isNewDailyVisit ? 1 : 0),
        pageViews: (existing.pageViews || 0) + 1,
        updatedAt: nowIso
      };

      analyticsCache.statsByDate[todayKey] = nextStat;
      saveAnalyticsDiskCache(analyticsCache);
      scheduleDailyStatFlush(todayKey);

      return res.json({ ok: true, date: todayKey, stat: nextStat });
    } catch (err) {
      console.warn('[Analytics] Visit tracking error:', err);
      return res.json({ ok: false });
    }
  });

  // POST /api/analytics/order-event -> Optional WhatsApp click / order metric increment
  app.post('/api/analytics/order-event', async (req, res) => {
    try {
      const kind = req.body?.channel === 'site_chat' ? 'site_chat' : 'whatsapp';
      await recordDailyOrderMetric(kind);
      return res.json({ ok: true });
    } catch {
      return res.json({ ok: false });
    }
  });

  // GET /api/analytics/admin/overview -> Admin retrieves daily stats history
  app.get('/api/analytics/admin/overview', async (req, res) => {
    if (!isAdminAuthorizedRequest(req)) {
      return res.status(403).json({ success: false, error: 'Accès administrateur requis.' });
    }
    try {
      const force = req.query.refresh === '1';
      const dailyStats = await ensureDailyStatsLoaded(force);
      return res.json({
        success: true,
        todayKey: getUtcDateKey(),
        dailyStats
      });
    } catch (err) {
      console.error('[Analytics] Admin overview error:', err);
      return res.status(500).json({ success: false, dailyStats: [] });
    }
  });

  // --- CUSTOMER REVIEWS (Avis Clients - Firestore backed + shared server cache) ---
  const REVIEWS_DISK_CACHE_PATH = '/tmp/huize-reviews-cache.json';
  const REVIEWS_CACHE_TTL_MS = 10 * 60 * 1000;
  let reviewsCache: { reviews: CustomerReview[]; loadedAt: number } = {
    reviews: [],
    loadedAt: 0
  };
  let reviewsRefreshInFlight: Promise<CustomerReview[]> | null = null;
  let nextReviewsRetryAt = 0;

  try {
    if (fs.existsSync(REVIEWS_DISK_CACHE_PATH)) {
      const raw = JSON.parse(fs.readFileSync(REVIEWS_DISK_CACHE_PATH, 'utf8'));
      if (raw && Array.isArray(raw.reviews)) {
        reviewsCache = {
          reviews: raw.reviews as CustomerReview[],
          loadedAt: typeof raw.loadedAt === 'number' ? raw.loadedAt : 0
        };
      }
    }
  } catch {
    // Ignore disk cache read errors
  }

  function saveReviewsDiskCache(list: CustomerReview[], loadedAt: number): void {
    try {
      fs.writeFileSync(
        REVIEWS_DISK_CACHE_PATH,
        JSON.stringify({ reviews: list, loadedAt }),
        'utf8'
      );
    } catch {
      // Ignore disk write errors
    }
  }

  function sortReviewsNewestFirst(list: CustomerReview[]): CustomerReview[] {
    return [...list].sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  }

  async function ensureReviewsLoaded(force = false): Promise<CustomerReview[]> {
    const now = Date.now();
    const isFresh =
      !force &&
      reviewsCache.loadedAt > 0 &&
      now - reviewsCache.loadedAt < REVIEWS_CACHE_TTL_MS;

    if (isFresh || !serverDb || (!force && now < nextReviewsRetryAt)) {
      return sortReviewsNewestFirst(reviewsCache.reviews);
    }

    if (!reviewsRefreshInFlight) {
      reviewsRefreshInFlight = (async () => {
        try {
          const snap = await getDocs(collection(serverDb, 'reviews'));
          const byId = new Map<string, CustomerReview>();
          for (const existing of reviewsCache.reviews) {
            if (existing?.id) byId.set(existing.id, existing);
          }
          snap.forEach((docSnap) => {
            const data = docSnap.data() as CustomerReview;
            if (data && data.id && data.authorName && data.comment) {
              byId.set(data.id, data);
            }
          });
          const sorted = sortReviewsNewestFirst(Array.from(byId.values()));
          reviewsCache = { reviews: sorted, loadedAt: Date.now() };
          nextReviewsRetryAt = 0;
          saveReviewsDiskCache(sorted, reviewsCache.loadedAt);
          return sorted;
        } catch (err) {
          console.warn('[Reviews] Firestore load skipped:', err);
          nextReviewsRetryAt = Date.now() + CATALOG_ERROR_BACKOFF_MS;
          return sortReviewsNewestFirst(reviewsCache.reviews);
        }
      })().finally(() => {
        reviewsRefreshInFlight = null;
      });
    }

    return reviewsRefreshInFlight;
  }

  void ensureReviewsLoaded(false).catch(() => {});

  app.get('/api/reviews', async (req, res) => {
    try {
      const force = req.query.refresh === '1';
      const reviews = await ensureReviewsLoaded(force);
      res.setHeader('Cache-Control', 'no-cache, must-revalidate');
      return res.json({ success: true, reviews });
    } catch (err) {
      console.error('[Reviews] GET error:', err);
      return res.status(500).json({ success: false, reviews: [] });
    }
  });

  app.post('/api/reviews', async (req, res) => {
    try {
      const clientIp = req.ip || 'unknown';
      if (!checkRateLimit(`review:${clientIp}`, 5, 10 * 60 * 1000)) {
        return res.status(429).json({
          success: false,
          error: 'Trop d’avis envoyés récemment. Veuillez patienter quelques minutes.'
        });
      }

      const rawName = typeof req.body?.authorName === 'string' ? req.body.authorName.trim() : '';
      const rawCity = typeof req.body?.city === 'string' ? req.body.city.trim() : '';
      const rawComment = typeof req.body?.comment === 'string' ? req.body.comment.trim() : '';
      const rawRating = Number(req.body?.rating);

      if (rawName.length < 2 || rawName.length > 80) {
        return res.status(400).json({
          success: false,
          error: 'Veuillez indiquer votre nom (2 à 80 caractères).'
        });
      }
      if (!Number.isFinite(rawRating) || rawRating < 1 || rawRating > 5) {
        return res.status(400).json({
          success: false,
          error: 'Veuillez sélectionner une note entre 1 et 5 étoiles.'
        });
      }
      if (rawComment.length < 5 || rawComment.length > 600) {
        return res.status(400).json({
          success: false,
          error: 'Votre message doit contenir entre 5 et 600 caractères.'
        });
      }
      if (rawCity.length > 80) {
        return res.status(400).json({
          success: false,
          error: 'Le nom de la ville ou du quartier ne doit pas dépasser 80 caractères.'
        });
      }

      const review: CustomerReview = {
        id: `rev-${Date.now()}-${randomBytes(3).toString('hex')}`,
        authorName: rawName,
        ...(rawCity ? { city: rawCity } : {}),
        rating: Math.round(rawRating),
        comment: rawComment,
        createdAt: new Date().toISOString()
      };

      if (serverDb) {
        await setDoc(doc(serverDb, 'reviews', review.id), review);
      }

      const updated = sortReviewsNewestFirst([
        review,
        ...reviewsCache.reviews.filter((r) => r.id !== review.id)
      ]);
      reviewsCache = { reviews: updated, loadedAt: Date.now() };
      saveReviewsDiskCache(updated, reviewsCache.loadedAt);

      return res.status(201).json({ success: true, review });
    } catch (err) {
      console.error('[Reviews] POST error:', err);
      return res.status(500).json({
        success: false,
        error: 'Impossible d’enregistrer votre avis pour le moment. Réessayez.'
      });
    }
  });

  app.delete('/api/reviews/:id', async (req, res) => {
    if (!isAdminAuthorizedRequest(req)) {
      return res.status(403).json({ success: false, error: 'Accès administrateur requis.' });
    }
    const reviewId = (req.params.id || '').trim();
    if (!/^[a-zA-Z0-9_-]{1,64}$/.test(reviewId)) {
      return res.status(400).json({ success: false, error: 'Identifiant d’avis invalide.' });
    }
    try {
      if (serverDb) {
        await deleteDoc(doc(serverDb, 'reviews', reviewId));
      }
      const updated = reviewsCache.reviews.filter((r) => r.id !== reviewId);
      reviewsCache = { reviews: updated, loadedAt: Date.now() };
      saveReviewsDiskCache(updated, reviewsCache.loadedAt);
      return res.json({ success: true });
    } catch (err) {
      console.error('[Reviews] DELETE error:', err);
      return res.status(500).json({ success: false, error: 'Erreur lors de la suppression.' });
    }
  });

  // Mount Vite middleware in development (initialized asynchronously so port binds immediately) or serve static in production
  if (!isProd) {
    const vitePromise = createViteServer({
      server: { middlewareMode: true, hmr: false, ws: false },
      appType: 'spa',
      plugins: [
        {
          name: 'disable-vite-hmr-websocket',
          enforce: 'post',
          transform(code, id) {
            if (
              id.endsWith('/vite/dist/client/client.mjs') ||
              id.endsWith('\\vite\\dist\\client\\client.mjs')
            ) {
              return code.replace(
                /const transport = normalizeModuleRunnerTransport\(\(\(\) => \{[\s\S]*?\}\)\(\)\);/,
                'const transport = normalizeModuleRunnerTransport({ async connect() {}, async disconnect() {}, send() {} });'
              );
            }
          }
        }
      ]
    });
    vitePromise.catch((err) => {
      console.error('Failed to initialize Vite dev server:', err);
    });

    app.use(async (req, res, next) => {
      try {
        const vite = await vitePromise;
        const targetProductId =
          typeof req.query.produit === 'string'
            ? req.query.produit
            : typeof req.query.product === 'string'
            ? req.query.product
            : null;

        if (req.method === 'GET' && (req.path === '/' || req.path === '/index.html')) {
          const snapshot = await getBootstrapCatalogSnapshot();
          const origin = getRequestOrigin(req);
          let template = fs.readFileSync(path.resolve(__dirname, 'index.html'), 'utf-8');
          const targetCommande = typeof req.query.commande === 'string' ? req.query.commande : null;

          if (targetProductId) {
            const product = await findProductByIdOrRef(targetProductId);
            if (product) {
              template = injectProductOgMeta(template, product, origin);
            }
          } else if (targetCommande) {
            const ids = targetCommande
              .split(',')
              .map((s) => s.trim())
              .filter(Boolean)
              .slice(0, 6);
            const orderedProds = (await Promise.all(ids.map((id) => findProductByIdOrRef(id)))).filter(
              (p): p is Product => Boolean(p)
            );
            if (orderedProds.length > 0) {
              template = injectOrderOgMeta(template, orderedProds, origin, targetCommande);
            } else {
              template = injectStoreOgMeta(template, snapshot, origin);
            }
          } else {
            template = injectStoreOgMeta(template, snapshot, origin);
          }

          template = injectInitialCatalogScript(template, snapshot);
          const transformed = await vite.transformIndexHtml(req.originalUrl, template);
          res
            .status(200)
            .set({
              'Content-Type': 'text/html',
              'Cache-Control': 'no-cache, no-store, must-revalidate'
            })
            .end(transformed);
          return;
        }

        return vite.middlewares(req, res, next);
      } catch (err) {
        return next(err);
      }
    });
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath, { index: false }));
    app.get('*', async (req, res) => {
      const indexHtmlPath = path.resolve(distPath, 'index.html');
      const snapshot = await getBootstrapCatalogSnapshot();
      const origin = getRequestOrigin(req);
      let html = fs.readFileSync(indexHtmlPath, 'utf-8');

      const targetProductId =
        typeof req.query.produit === 'string'
          ? req.query.produit
          : typeof req.query.product === 'string'
          ? req.query.product
          : null;
      const targetCommande = typeof req.query.commande === 'string' ? req.query.commande : null;

      if (targetProductId) {
        const product = await findProductByIdOrRef(targetProductId);
        if (product) {
          html = injectProductOgMeta(html, product, origin);
        }
      } else if (targetCommande) {
        const ids = targetCommande
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
          .slice(0, 6);
        const orderedProds = (await Promise.all(ids.map((id) => findProductByIdOrRef(id)))).filter(
          (p): p is Product => Boolean(p)
        );
        if (orderedProds.length > 0) {
          html = injectOrderOgMeta(html, orderedProds, origin, targetCommande);
        } else {
          html = injectStoreOgMeta(html, snapshot, origin);
        }
      } else {
        html = injectStoreOgMeta(html, snapshot, origin);
      }

      html = injectInitialCatalogScript(html, snapshot);
      res
        .status(200)
        .set({
          'Content-Type': 'text/html',
          'Cache-Control': 'no-cache, no-store, must-revalidate'
        })
        .send(html);
    });
  }

  const httpServer = createServer(app);
  httpServer.on('upgrade', (request, socket, head) => {
    try {
      const reqUrl = new URL(request.url || '/', 'http://localhost');
      if (reqUrl.pathname === '/ws/chat') {
        chatWss.handleUpgrade(request, socket, head, (ws) => {
          chatWss.emit('connection', ws, request);
        });
      }
    } catch {
      socket.destroy();
    }
  });

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`HUIZE SHOP server running on http://0.0.0.0:${PORT} (${isProd ? 'production' : 'development'})`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
