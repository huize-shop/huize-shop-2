import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDocFromServer,
  collection,
  onSnapshot,
  setDoc,
  deleteDoc,
  updateDoc
} from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';
import { Product, Category, WhatsAppOrder, ClientLead } from './types.ts';
import { INITIAL_PRODUCTS, INITIAL_CATEGORIES, INITIAL_ORDERS, INITIAL_LEADS } from './data/initialData.ts';

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
    console.log('Firestore connected successfully.');
    return true;
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn('Firebase client is offline or database initializing.');
    }
    return false;
  }
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
            await setDoc(doc(db, 'products', p.id), p);
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
    await setDoc(doc(db, 'products', product.id), product);
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
    await setDoc(doc(db, 'categories', category.id), category);
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
      if (snapshot.empty) {
        INITIAL_ORDERS.forEach(async (o) => {
          try {
            await setDoc(doc(db, 'orders', o.id), o);
          } catch (e) {
            handleFirestoreError(e, OperationType.WRITE, `orders/${o.id}`);
          }
        });
        onData(INITIAL_ORDERS);
      } else {
        const list: WhatsAppOrder[] = [];
        snapshot.forEach((d) => {
          list.push(d.data() as WhatsAppOrder);
        });
        onData(list);
      }
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, 'orders');
    }
  );
}

export async function saveOrderToDb(order: WhatsAppOrder): Promise<void> {
  try {
    await setDoc(doc(db, 'orders', order.id), order);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `orders/${order.id}`);
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
      if (snapshot.empty) {
        INITIAL_LEADS.forEach(async (l) => {
          try {
            await setDoc(doc(db, 'leads', l.id), l);
          } catch (e) {
            handleFirestoreError(e, OperationType.WRITE, `leads/${l.id}`);
          }
        });
        onData(INITIAL_LEADS);
      } else {
        const list: ClientLead[] = [];
        snapshot.forEach((d) => {
          list.push(d.data() as ClientLead);
        });
        onData(list);
      }
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, 'leads');
    }
  );
}
