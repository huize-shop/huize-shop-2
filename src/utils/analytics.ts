import type { DailyEvolutionPoint, DailySiteStats, WhatsAppOrder } from '../types.ts';

// Burkina Faso uses GMT/UTC+0 year-round (Africa/Ouagadougou)
export function getTodayDateKey(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

export function addDaysToDateKey(dateKey: string, deltaDays: number): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  const dt = new Date(Date.UTC(y, (m || 1) - 1, (d || 1) + deltaDays));
  return dt.toISOString().slice(0, 10);
}

const FRENCH_MONTHS: Record<string, number> = {
  jan: 1,
  'janv': 1,
  janvier: 1,
  feb: 2,
  fev: 2,
  fevr: 2,
  fevrier: 2,
  mar: 3,
  mars: 3,
  avr: 4,
  avril: 4,
  mai: 5,
  jun: 6,
  juin: 6,
  jul: 7,
  juil: 7,
  juillet: 7,
  aou: 8,
  aout: 8,
  sep: 9,
  sept: 9,
  septembre: 9,
  oct: 10,
  octobre: 10,
  nov: 11,
  novembre: 11,
  dec: 12,
  decembre: 12
};

export function parseOrderDateKey(order: Pick<WhatsAppOrder, 'createdAt' | 'date'>): string | null {
  if (order.createdAt && /^\d{4}-\d{2}-\d{2}/.test(order.createdAt)) {
    const parsed = new Date(order.createdAt);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString().slice(0, 10);
    }
  }

  const raw = (order.date || '').trim();
  if (!raw) return null;

  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) {
    return raw.slice(0, 10);
  }

  // DD/MM/YYYY format
  const slashMatch = raw.match(/(\d{1,2})\/(\d{1,2})\/(20\d{2})/);
  if (slashMatch) {
    const dd = slashMatch[1].padStart(2, '0');
    const mm = slashMatch[2].padStart(2, '0');
    const yyyy = slashMatch[3];
    return `${yyyy}-${mm}-${dd}`;
  }

  // French locale date e.g. "17 nov. 2026, 09:46" or "05 févr. 2026 à 14:20"
  const normalized = raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

  const frMatch = normalized.match(/(\d{1,2})\s+([a-z]+)\.?\s+(20\d{2})/);
  if (frMatch) {
    const day = Number(frMatch[1]);
    const monthToken = frMatch[2];
    const year = Number(frMatch[3]);
    const monthNum = FRENCH_MONTHS[monthToken];
    if (monthNum && day >= 1 && day <= 31) {
      return `${year}-${String(monthNum).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
  }

  const fallback = new Date(raw);
  if (!Number.isNaN(fallback.getTime())) {
    return fallback.toISOString().slice(0, 10);
  }
  return null;
}

export function formatShortFrenchDate(dateKey: string): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  const dt = new Date(Date.UTC(y, (m || 1) - 1, d || 1));
  return dt.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'short',
    timeZone: 'UTC'
  });
}

export function formatFullFrenchDate(dateKey: string): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  const dt = new Date(Date.UTC(y, (m || 1) - 1, d || 1));
  return dt.toLocaleDateString('fr-FR', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC'
  });
}

export function buildDailyEvolutionSeries(
  dailyStats: DailySiteStats[],
  orders: WhatsAppOrder[],
  days: number = 14,
  endDateKey: string = getTodayDateKey()
): DailyEvolutionPoint[] {
  const statsByDate = new Map<string, DailySiteStats>();
  for (const s of dailyStats) {
    if (s && s.date) {
      statsByDate.set(s.date, s);
    }
  }

  const ordersByDate = new Map<
    string,
    { ordersCount: number; purchasesCount: number; revenue: number; totalOrderAmount: number }
  >();

  for (const ord of orders) {
    const key = parseOrderDateKey(ord);
    if (!key) continue;
    const prev = ordersByDate.get(key) || {
      ordersCount: 0,
      purchasesCount: 0,
      revenue: 0,
      totalOrderAmount: 0
    };
    const isConfirmed = ord.status === 'paid' || ord.status === 'delivered';
    prev.ordersCount += 1;
    prev.totalOrderAmount += Number(ord.total) || 0;
    if (isConfirmed) {
      prev.purchasesCount += 1;
      prev.revenue += Number(ord.total) || 0;
    }
    ordersByDate.set(key, prev);
  }

  const safeDays = Math.max(1, Math.min(365, days));
  const series: DailyEvolutionPoint[] = [];

  for (let offset = -(safeDays - 1); offset <= 0; offset += 1) {
    const dateKey = addDaysToDateKey(endDateKey, offset);
    const stat = statsByDate.get(dateKey);
    const ordAgg = ordersByDate.get(dateKey);

    const visits = stat?.visits || 0;
    const pageViews = stat?.pageViews || 0;
    const ordersCount = ordAgg?.ordersCount || 0;
    const purchasesCount = ordAgg?.purchasesCount || 0;
    const revenue = ordAgg?.revenue || 0;
    const totalOrderAmount = ordAgg?.totalOrderAmount || 0;
    const conversionRate = visits > 0 ? Math.min(100, (ordersCount / visits) * 100) : 0;

    series.push({
      date: dateKey,
      shortLabel: formatShortFrenchDate(dateKey),
      fullLabel: formatFullFrenchDate(dateKey),
      visits,
      pageViews,
      ordersCount,
      purchasesCount,
      revenue,
      totalOrderAmount,
      conversionRate
    });
  }

  return series;
}
