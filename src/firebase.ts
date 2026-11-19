import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDocFromServer,
  getDocs,
  collection,
  onSnapshot,
  setDoc,
  deleteDoc,
  updateDoc,
  increment
} from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';
import {
  Product,
  Category,
  WhatsAppOrder,
  ClientLead,
  SiteMediaConfig,
  TeamMember,
  TeamMemberPublicProfile,
  TeamMemberOrderSummary,
  DailySiteStats,
  CustomerReview
} from './types.ts';
import {
  INITIAL_PRODUCTS,
  INITIAL_CATEGORIES,
  INITIAL_MEDIA_CONFIG
} from './data/initialData.ts';

const DEMO_ORDER_IDS = new Set(['CMD-1082', 'CMD-1083', 'CMD-1084']);
const DEMO_LEAD_IDS = new Set(['lead-1', 'lead-2', 'lead-3', 'lead-4', 'lead-5']);

// Initialize Firebase App
const app = initializeApp(firebaseConfig);

// Initialize Firestore with specific database ID
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);

// Error Handling per Skill Specifications
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid || null,
      email: auth.currentUser?.email || null,
      emailVerified: auth.currentUser?.emailVerified || null,
      isAnonymous: auth.currentUser?.isAnonymous || null,
      tenantId: auth.currentUser?.tenantId || null
    },
    operationType,
    path
  };
  console.error('Firestore Error:', JSON.stringify(errInfo));
}

// Connection test
export async function testConnection(): Promise<boolean> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    return true;
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn('Firebase client is offline or database initializing.');
    }
    return false;
  }
}
if (typeof window !== 'undefined') {
  void testConnection();
}

// Utility to recursively sanitize data objects and remove any undefined fields before writing to Firestore
export function sanitizeForFirestore<T>(data: T): T {
  if (data === null || typeof data !== 'object') {
    return data;
  }
  if (Array.isArray(data)) {
    return data.map((item) => sanitizeForFirestore(item)) as unknown as T;
  }
  const sanitized: Record<string, any> = {};
  for (const [key, value] of Object.entries(data as Record<string, any>)) {
    if (value !== undefined) {
      sanitized[key] = sanitizeForFirestore(value);
    }
  }
  return sanitized as T;
}

// --- PRODUCTS SUBSCRIPTION & SYNC ---
export function subscribeProducts(onData: (products: Product[]) => void) {
  const colRef = collection(db, 'products');
  return onSnapshot(
    colRef,
    (snapshot) => {
      if (snapshot.empty) {
        // Seed initial products into Firestore if completely empty
        INITIAL_PRODUCTS.forEach(async (p) => {
          try {
            await setDoc(doc(db, 'products', p.id), sanitizeForFirestore(p));
          } catch (e) {
            handleFirestoreError(e, OperationType.WRITE, `products/${p.id}`);
          }
        });
        onData(INITIAL_PRODUCTS);
      } else {
        const list: Product[] = [];
        snapshot.forEach((d) => {
          list.push(d.data() as Product);
        });
        // Ensure user-added products (prod-<timestamp>) appear first, sorted by newest
        list.sort((a, b) => {
          const aIsNew = a.id.startsWith('prod-1');
          const bIsNew = b.id.startsWith('prod-1');
          if (aIsNew && !bIsNew) return -1;
          if (!aIsNew && bIsNew) return 1;
          if (aIsNew && bIsNew) return b.id.localeCompare(a.id);
          return 0;
        });
        onData(list);
      }
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, 'products');
    }
  );
}

export async function saveProductToDb(product: Product): Promise<void> {
  const path = `products/${product.id}`;
  try {
    const cleanProduct = sanitizeForFirestore(product);
    await setDoc(doc(db, 'products', product.id), cleanProduct);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
    throw error;
  }
}

export async function deleteProductFromDb(productId: string): Promise<void> {
  const path = `products/${productId}`;
  try {
    await deleteDoc(doc(db, 'products', productId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
    throw error;
  }
}

export async function incrementProductLikesInDb(productId: string, amount: number = 1): Promise<void> {
  const path = `products/${productId}`;
  try {
    const docRef = doc(db, 'products', productId);
    await updateDoc(docRef, {
      likes: increment(amount)
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

// --- CATEGORIES SUBSCRIPTION & SYNC ---
export function subscribeCategories(onData: (categories: Category[]) => void) {
  const colRef = collection(db, 'categories');
  return onSnapshot(
    colRef,
    (snapshot) => {
      if (snapshot.empty) {
        INITIAL_CATEGORIES.forEach(async (c) => {
          try {
            await setDoc(doc(db, 'categories', c.id), c);
          } catch (e) {
            handleFirestoreError(e, OperationType.WRITE, `categories/${c.id}`);
          }
        });
        onData(INITIAL_CATEGORIES);
      } else {
        const list: Category[] = [];
        snapshot.forEach((d) => {
          list.push(d.data() as Category);
        });
        onData(list);
      }
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, 'categories');
    }
  );
}

export async function saveCategoryToDb(category: Category): Promise<void> {
  try {
    const cleanCat = sanitizeForFirestore(category);
    await setDoc(doc(db, 'categories', category.id), cleanCat);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `categories/${category.id}`);
    throw error;
  }
}

export async function deleteCategoryFromDb(categoryId: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'categories', categoryId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `categories/${categoryId}`);
    throw error;
  }
}

// --- ORDERS SUBSCRIPTION & SYNC ---
export function subscribeOrders(onData: (orders: WhatsAppOrder[]) => void) {
  const colRef = collection(db, 'orders');
  return onSnapshot(
    colRef,
    (snapshot) => {
      const list: WhatsAppOrder[] = [];
      snapshot.forEach((d) => {
        const order = d.data() as WhatsAppOrder;
        if (!DEMO_ORDER_IDS.has(order.id)) {
          list.push(order);
        }
      });
      onData(list);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, 'orders');
    }
  );
}

export async function saveOrderToDb(order: WhatsAppOrder): Promise<void> {
  try {
    const cleanOrder = sanitizeForFirestore(order);
    await setDoc(doc(db, 'orders', order.id), cleanOrder);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `orders/${order.id}`);
    throw error;
  }
}

export async function deleteOrderFromDb(orderId: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'orders', orderId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `orders/${orderId}`);
    throw error;
  }
}

export async function updateOrderStatusInDb(orderId: string, status: WhatsAppOrder['status']): Promise<void> {
  const statusMap: Record<WhatsAppOrder['status'], string> = {
    pending: 'À livrer',
    paid: 'Payé (Orange/Moov)',
    delivered: 'Livré',
    discussion: 'En discussion'
  };
  try {
    await updateDoc(doc(db, 'orders', orderId), {
      status,
      statusLabel: statusMap[status]
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `orders/${orderId}`);
    throw error;
  }
}

// --- LEADS SUBSCRIPTION & SYNC ---
export function subscribeLeads(onData: (leads: ClientLead[]) => void) {
  const colRef = collection(db, 'leads');
  return onSnapshot(
    colRef,
    (snapshot) => {
      const list: ClientLead[] = [];
      snapshot.forEach((d) => {
        const lead = d.data() as ClientLead;
        if (!DEMO_LEAD_IDS.has(lead.id)) {
          list.push(lead);
        }
      });
      onData(list);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, 'leads');
    }
  );
}

export async function saveLeadToDb(lead: ClientLead): Promise<void> {
  try {
    await setDoc(doc(db, 'leads', lead.id), sanitizeForFirestore(lead));
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `leads/${lead.id}`);
  }
}

export async function deleteLeadFromDb(leadId: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'leads', leadId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `leads/${leadId}`);
    throw error;
  }
}

// --- SITE MEDIA & HOMEPAGE BANNER CONFIG ---
export function subscribeMediaConfig(onData: (config: SiteMediaConfig) => void) {
  const docRef = doc(db, 'settings', 'media');
  return onSnapshot(
    docRef,
    (snapshot) => {
      if (snapshot.exists()) {
        onData(snapshot.data() as SiteMediaConfig);
      } else {
        // Seed initial media configuration if not present
        setDoc(docRef, sanitizeForFirestore(INITIAL_MEDIA_CONFIG)).catch((e) =>
          handleFirestoreError(e, OperationType.WRITE, 'settings/media')
        );
        onData(INITIAL_MEDIA_CONFIG);
      }
    },
    (error) => {
      handleFirestoreError(error, OperationType.GET, 'settings/media');
    }
  );
}

export async function saveMediaConfigToDb(config: SiteMediaConfig): Promise<void> {
  const path = 'settings/media';
  try {
    const cleanMedia = sanitizeForFirestore(config);
    await setDoc(doc(db, 'settings', 'media'), cleanMedia);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
    throw error;
  }
}

// --- SERVER-SIDE CACHED CATALOG & ONE-SHOT ADMIN FETCHERS ---
export interface CachedCatalogResponse {
  products: Product[];
  categories: Category[];
  mediaConfig: SiteMediaConfig;
  updatedAt?: number;
  source?: string;
}

export async function fetchCatalogFromServer(full: boolean = false): Promise<CachedCatalogResponse | null> {
  try {
    const url = full ? '/api/catalog?full=1' : '/api/catalog';
    const res = await fetch(url, {
      headers: { Accept: 'application/json' },
      cache: 'no-store'
    });
    if (!res.ok) return null;
    const data = (await res.json()) as CachedCatalogResponse;
    if (data && Array.isArray(data.products) && Array.isArray(data.categories)) {
      return data;
    }
    return null;
  } catch (err) {
    console.warn('Failed to fetch cached catalog from server:', err);
    return null;
  }
}

export async function syncServerCatalog(payload: {
  product?: Product;
  deletedProductId?: string;
  category?: Category;
  deletedCategoryId?: string;
  mediaConfig?: SiteMediaConfig;
  likedProductId?: string;
  likeDelta?: number;
  forceRefresh?: boolean;
}): Promise<void> {
  try {
    await fetch('/api/catalog/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
  } catch (err) {
    console.warn('Server catalog cache sync skipped:', err);
  }
}

export async function fetchOrdersOnce(): Promise<WhatsAppOrder[] | null> {
  try {
    const snapshot = await getDocs(collection(db, 'orders'));
    const list: WhatsAppOrder[] = [];
    snapshot.forEach((d) => {
      const order = d.data() as WhatsAppOrder;
      if (!DEMO_ORDER_IDS.has(order.id)) {
        list.push(order);
      }
    });
    return list;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'orders');
    return null;
  }
}

export async function fetchLeadsOnce(): Promise<ClientLead[] | null> {
  try {
    const snapshot = await getDocs(collection(db, 'leads'));
    const list: ClientLead[] = [];
    snapshot.forEach((d) => {
      const lead = d.data() as ClientLead;
      if (!DEMO_LEAD_IDS.has(lead.id)) {
        list.push(lead);
      }
    });
    return list;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'leads');
    return null;
  }
}

// --- TEAM MEMBERS & ATTRIBUTION ---
export async function fetchTeamMembersOnce(): Promise<TeamMember[] | null> {
  try {
    const snapshot = await getDocs(collection(db, 'team_members'));
    const list: TeamMember[] = [];
    snapshot.forEach((d) => {
      list.push(d.data() as TeamMember);
    });
    list.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    return list;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'team_members');
    return null;
  }
}

export async function saveTeamMemberToDb(member: TeamMember): Promise<void> {
  try {
    await setDoc(doc(db, 'team_members', member.id), sanitizeForFirestore(member));
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `team_members/${member.id}`);
    throw error;
  }
}

export async function deleteTeamMemberFromDb(memberId: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'team_members', memberId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `team_members/${memberId}`);
    throw error;
  }
}

export async function updateOrderReferralInDb(
  orderId: string,
  referredByCode: string,
  referredByName: string
): Promise<void> {
  try {
    await updateDoc(doc(db, 'orders', orderId), {
      referredByCode,
      referredByName
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `orders/${orderId}`);
    throw error;
  }
}

export interface TeamLoginResponse {
  success: boolean;
  error?: string;
  member?: TeamMemberPublicProfile;
  ordersCount?: number;
  salesCount?: number;
  recentOrders?: TeamMemberOrderSummary[];
}

export async function loginTeamMemberOnServer(
  code: string,
  pin: string
): Promise<TeamLoginResponse> {
  try {
    const res = await fetch('/api/team/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, pin })
    });
    const data = (await res.json()) as TeamLoginResponse;
    return data;
  } catch {
    return {
      success: false,
      error: 'Erreur réseau lors de la connexion au serveur.'
    };
  }
}

export async function trackTeamClickOnServer(code: string): Promise<void> {
  try {
    await fetch('/api/team/track-click', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code })
    });
  } catch {
    // Non-blocking tracking
  }
}

export async function syncTeamServerCache(payload: {
  teamMember?: TeamMember;
  deletedTeamMemberId?: string;
  order?: WhatsAppOrder;
  deletedOrderId?: string;
  forceRefresh?: boolean;
}): Promise<void> {
  try {
    await fetch('/api/team/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
  } catch {
    // Non-blocking cache sync
  }
}

// --- DAILY VISITS & EVOLUTION ANALYTICS ---
export async function trackStoreVisitOnServer(isAdmin: boolean = false): Promise<void> {
  if (isAdmin) return;
  try {
    const todayKey = new Date().toISOString().slice(0, 10);
    if (sessionStorage.getItem('huize_visit_pinged_v1') === todayKey) {
      return;
    }
    const lastDay = localStorage.getItem('huize_last_visit_day_v1');
    const isNewDailyVisit = lastDay !== todayKey;

    sessionStorage.setItem('huize_visit_pinged_v1', todayKey);
    localStorage.setItem('huize_last_visit_day_v1', todayKey);

    await fetch('/api/analytics/visit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        isNewDailyVisit,
        isAdmin: false
      })
    });
  } catch {
    // Non-blocking analytics
  }
}

export async function trackOrderEventOnServer(channel: 'whatsapp' | 'site_chat'): Promise<void> {
  try {
    await fetch('/api/analytics/order-event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ channel })
    });
  } catch {
    // Non-blocking analytics
  }
}

export async function fetchAdminAnalyticsOverview(
  forceRefresh: boolean = false
): Promise<DailySiteStats[]> {
  try {
    const res = await fetch(
      `/api/analytics/admin/overview${forceRefresh ? '?refresh=1' : ''}`,
      {
        headers: {
          'x-admin-email': 'hugosazizegansonre@gmail.com'
        },
        cache: 'no-store'
      }
    );
    if (!res.ok) return [];
    const data = (await res.json()) as { success: boolean; dailyStats?: DailySiteStats[] };
    return Array.isArray(data.dailyStats) ? data.dailyStats : [];
  } catch {
    return [];
  }
}

// --- CUSTOMER REVIEWS (Avis Clients) ---
export async function fetchCustomerReviews(forceRefresh: boolean = false): Promise<CustomerReview[]> {
  try {
    const res = await fetch(`/api/reviews${forceRefresh ? '?refresh=1' : ''}`, {
      headers: { Accept: 'application/json' },
      cache: 'no-store'
    });
    if (res.ok) {
      const data = (await res.json()) as { success: boolean; reviews?: CustomerReview[] };
      if (Array.isArray(data.reviews)) {
        return data.reviews;
      }
    }
  } catch {
    // Fallback to direct Firestore read
  }

  try {
    const snapshot = await getDocs(collection(db, 'reviews'));
    const list: CustomerReview[] = [];
    snapshot.forEach((d) => {
      list.push(d.data() as CustomerReview);
    });
    list.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    return list;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'reviews');
    return [];
  }
}

export async function submitCustomerReview(payload: {
  authorName: string;
  city?: string;
  rating: number;
  comment: string;
}): Promise<CustomerReview> {
  const cleanName = payload.authorName.trim();
  const cleanCity = payload.city?.trim() || '';
  const cleanComment = payload.comment.trim();
  const cleanRating = Math.min(5, Math.max(1, Math.round(payload.rating)));

  try {
    const res = await fetch('/api/reviews', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        authorName: cleanName,
        city: cleanCity,
        rating: cleanRating,
        comment: cleanComment
      })
    });
    const data = (await res.json()) as {
      success: boolean;
      review?: CustomerReview;
      error?: string;
    };
    if (res.ok && data.success && data.review) {
      return data.review;
    }
    throw new Error(data.error || 'Impossible de publier votre avis.');
  } catch (err) {
    if (err instanceof Error && !/Failed to fetch|NetworkError/i.test(err.message)) {
      throw err;
    }
    // Network fallback: write directly to Firestore
    const review: CustomerReview = sanitizeForFirestore({
      id: `rev-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      authorName: cleanName,
      ...(cleanCity ? { city: cleanCity } : {}),
      rating: cleanRating,
      comment: cleanComment,
      createdAt: new Date().toISOString()
    });
    try {
      await setDoc(doc(db, 'reviews', review.id), review);
      return review;
    } catch (fsErr) {
      handleFirestoreError(fsErr, OperationType.CREATE, `reviews/${review.id}`);
      throw new Error('Impossible de publier votre avis pour le moment.');
    }
  }
}

export async function deleteCustomerReview(reviewId: string): Promise<boolean> {
  try {
    const res = await fetch(`/api/reviews/${encodeURIComponent(reviewId)}`, {
      method: 'DELETE',
      headers: {
        'x-admin-email': 'hugosazizegansonre@gmail.com'
      }
    });
    if (res.ok) {
      return true;
    }
  } catch {
    // Fallback to direct Firestore delete
  }

  try {
    await deleteDoc(doc(db, 'reviews', reviewId));
    return true;
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `reviews/${reviewId}`);
    return false;
  }
}
