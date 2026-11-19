import React, { useMemo, useState } from 'react';
import { DailyEvolutionPoint, DailySiteStats, WhatsAppOrder } from '../types.ts';
import { buildDailyEvolutionSeries, getTodayDateKey } from '../utils/analytics.ts';
import { formatFCFA } from '../utils/whatsapp.ts';
import {
  TrendingUp,
  Eye,
  ShoppingBag,
  RefreshCw,
  Download,
  ArrowUpRight,
  ArrowDownRight,
  CheckCircle2
} from 'lucide-react';

interface AdminAnalyticsPanelProps {
  dailyStats: DailySiteStats[];
  orders: WhatsAppOrder[];
  isLoading?: boolean;
  compact?: boolean;
  onRefresh?: () => Promise<void> | void;
  onOpenFullAnalytics?: () => void;
}

type PeriodDays = 7 | 14 | 30 | 90;
type ChartMode = 'traffic_orders' | 'purchases_revenue';

function buildSmoothSvgPath(points: Array<{ x: number; y: number }>, maxY: number): string {
  if (points.length === 0) return '';
  if (points.length === 1) return `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`;
  if (points.length === 2) {
    return `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)} L ${points[1].x.toFixed(1)} ${points[1].y.toFixed(1)}`;
  }

  let d = `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[Math.min(points.length - 1, i + 2)];

    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = Math.max(8, Math.min(maxY, p1.y + (p2.y - p0.y) / 6));
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = Math.max(8, Math.min(maxY, p2.y - (p3.y - p1.y) / 6));

    d += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
  }
  return d;
}

function niceAxisMax(rawMax: number, minCeiling: number = 4): number {
  const target = Math.max(minCeiling, rawMax);
  if (target <= 5) return 5;
  if (target <= 10) return 10;
  const exp = Math.pow(10, Math.floor(Math.log10(target)));
  const frac = target / exp;
  if (frac <= 1.2) return Math.ceil(1.2 * exp);
  if (frac <= 2) return Math.ceil(2 * exp);
  if (frac <= 5) return Math.ceil(5 * exp);
  return Math.ceil(10 * exp);
}

export const AdminAnalyticsPanel: React.FC<AdminAnalyticsPanelProps> = ({
  dailyStats,
  orders,
  isLoading = false,
  compact = false,
  onRefresh,
  onOpenFullAnalytics
}) => {
  const [periodDays, setPeriodDays] = useState<PeriodDays>(compact ? 14 : 30);
  const [chartMode, setChartMode] = useState<ChartMode>('traffic_orders');
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const todayKey = getTodayDateKey();

  const series = useMemo(
    () => buildDailyEvolutionSeries(dailyStats, orders, periodDays, todayKey),
    [dailyStats, orders, periodDays, todayKey]
  );

  const todayPoint: DailyEvolutionPoint = series[series.length - 1] || {
    date: todayKey,
    shortLabel: "Aujourd'hui",
    fullLabel: "Aujourd'hui",
    visits: 0,
    pageViews: 0,
    ordersCount: 0,
    purchasesCount: 0,
    revenue: 0,
    totalOrderAmount: 0,
    conversionRate: 0
  };
  const yesterdayPoint = series.length >= 2 ? series[series.length - 2] : null;

  const periodTotals = useMemo(() => {
    return series.reduce(
      (acc, d) => ({
        visits: acc.visits + d.visits,
        pageViews: acc.pageViews + d.pageViews,
        ordersCount: acc.ordersCount + d.ordersCount,
        purchasesCount: acc.purchasesCount + d.purchasesCount,
        revenue: acc.revenue + d.revenue,
        totalOrderAmount: acc.totalOrderAmount + d.totalOrderAmount
      }),
      {
        visits: 0,
        pageViews: 0,
        ordersCount: 0,
        purchasesCount: 0,
        revenue: 0,
        totalOrderAmount: 0
      }
    );
  }, [series]);

  const visitsDeltaYesterday = yesterdayPoint
    ? todayPoint.visits - yesterdayPoint.visits
    : 0;

  const periodConversionRate =
    periodTotals.visits > 0
      ? Math.min(100, (periodTotals.ordersCount / periodTotals.visits) * 100)
      : 0;

  // Chart dimensions
  const svgWidth = 820;
  const svgHeight = compact ? 250 : 290;
  const padLeft = 44;
  const padRight = 46;
  const padTop = 18;
  const padBottom = 32;
  const plotWidth = svgWidth - padLeft - padRight;
  const plotHeight = svgHeight - padTop - padBottom;
  const baseLineY = padTop + plotHeight;

  const primarySeriesValues = series.map((d) =>
    chartMode === 'traffic_orders' ? d.visits : d.ordersCount
  );
  const secondarySeriesValues = series.map((d) =>
    chartMode === 'traffic_orders' ? d.ordersCount : d.purchasesCount
  );
  const tertiarySeriesValues = series.map((d) =>
    chartMode === 'traffic_orders' ? d.purchasesCount : d.revenue
  );

  const leftAxisMax = niceAxisMax(
    Math.max(
      ...primarySeriesValues,
      chartMode === 'purchases_revenue' ? Math.max(...secondarySeriesValues) : 0
    ),
    chartMode === 'traffic_orders' ? 10 : 4
  );

  const rightAxisMax =
    chartMode === 'traffic_orders'
      ? niceAxisMax(Math.max(...secondarySeriesValues, ...tertiarySeriesValues), 4)
      : niceAxisMax(Math.max(...tertiarySeriesValues), 50000);

  const getX = (idx: number) => {
    if (series.length <= 1) return padLeft + plotWidth / 2;
    return padLeft + (idx / (series.length - 1)) * plotWidth;
  };

  const getLeftY = (val: number) => {
    const ratio = Math.max(0, Math.min(1, val / (leftAxisMax || 1)));
    return baseLineY - ratio * plotHeight;
  };

  const getRightY = (val: number) => {
    const ratio = Math.max(0, Math.min(1, val / (rightAxisMax || 1)));
    return baseLineY - ratio * plotHeight;
  };

  const primaryPoints = series.map((d, idx) => ({
    x: getX(idx),
    y: getLeftY(chartMode === 'traffic_orders' ? d.visits : d.ordersCount)
  }));

  const secondaryPoints = series.map((d, idx) => ({
    x: getX(idx),
    y:
      chartMode === 'traffic_orders'
        ? getRightY(d.ordersCount)
        : getLeftY(d.purchasesCount)
  }));

  const tertiaryPoints = series.map((d, idx) => ({
    x: getX(idx),
    y: getRightY(chartMode === 'traffic_orders' ? d.purchasesCount : d.revenue)
  }));

  const primaryLinePath = buildSmoothSvgPath(primaryPoints, baseLineY);
  const primaryAreaPath =
    primaryPoints.length > 0
      ? `${primaryLinePath} L ${primaryPoints[primaryPoints.length - 1].x.toFixed(1)} ${baseLineY.toFixed(1)} L ${primaryPoints[0].x.toFixed(1)} ${baseLineY.toFixed(1)} Z`
      : '';
  const secondaryLinePath = buildSmoothSvgPath(secondaryPoints, baseLineY);
  const tertiaryLinePath = buildSmoothSvgPath(tertiaryPoints, baseLineY);

  const activePointIdx =
    hoveredIdx !== null && hoveredIdx >= 0 && hoveredIdx < series.length
      ? hoveredIdx
      : series.length - 1;
  const activePoint = series[activePointIdx] || todayPoint;

  const labelStep =
    periodDays <= 7 ? 1 : periodDays <= 14 ? 2 : periodDays <= 30 ? 5 : 14;

  const handleRefreshClick = async () => {
    if (!onRefresh || isRefreshing) return;
    setIsRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleExportCsv = () => {
    const header = [
      'Date',
      'Visites uniques',
      'Pages vues',
      'Commandes totales',
      'Achats valides',
      'Taux conversion (%)',
      'CA valide (F CFA)'
    ].join(';');
    const rows = series.map((d) =>
      [
        d.date,
        d.visits,
        d.pageViews,
        d.ordersCount,
        d.purchasesCount,
        d.conversionRate.toFixed(1),
        d.revenue
      ].join(';')
    );
    const csv = `\uFEFF${header}\n${rows.join('\n')}`;
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `huize-shop-evolution-${periodDays}j-${todayKey}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const yTicks = [0, 0.25, 0.5, 0.75, 1];

  return (
    <section className="bg-white border border-[#E1E3DA] rounded-2xl shadow-xs overflow-hidden">
      {/* Header Bar */}
      <div className="p-4 sm:p-5 bg-[#FAF9F5] border-b border-[#E1E3DA] flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-[#123B2A]" />
            <h2 className="text-base sm:text-lg font-bold font-title text-[#123B2A]">
              Suivi journalier &amp; Courbe d&apos;évolution du site
            </h2>
          </div>
          <p className="text-xs text-[#6B726C] mt-0.5">
            Visiteurs quotidiens, commandes enregistrées (WhatsApp &amp; Messagerie) et achats validés sur {periodDays} jours.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Period Segmented Selector */}
          <div
            role="group"
            aria-label="Période d'analyse"
            className="inline-flex items-center p-1 bg-white border border-[#E1E3DA] rounded-lg"
          >
            {([7, 14, 30, 90] as PeriodDays[]).map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => {
                  setPeriodDays(d);
                  setHoveredIdx(null);
                }}
                className={`px-2.5 py-1 text-xs font-bold rounded-md transition-colors cursor-pointer whitespace-nowrap shrink-0 tabular-nums ${
                  periodDays === d
                    ? 'bg-[#123B2A] text-[#D8F36A]'
                    : 'text-[#6B726C] hover:text-[#123B2A]'
                }`}
              >
                {d}j
              </button>
            ))}
          </div>

          {/* Chart Metric Mode Toggle */}
          <div
            role="group"
            aria-label="Séries affichées"
            className="inline-flex items-center p-1 bg-white border border-[#E1E3DA] rounded-lg"
          >
            <button
              type="button"
              onClick={() => setChartMode('traffic_orders')}
              className={`px-2.5 py-1 text-xs font-bold rounded-md transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                chartMode === 'traffic_orders'
                  ? 'bg-[#1F5A40] text-white'
                  : 'text-[#6B726C] hover:text-[#123B2A]'
              }`}
            >
              Visites &amp; Achats
            </button>
            <button
              type="button"
              onClick={() => setChartMode('purchases_revenue')}
              className={`px-2.5 py-1 text-xs font-bold rounded-md transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                chartMode === 'purchases_revenue'
                  ? 'bg-[#1F5A40] text-white'
                  : 'text-[#6B726C] hover:text-[#123B2A]'
              }`}
            >
              Ventes &amp; Revenus
            </button>
          </div>

          {onRefresh && (
            <button
              type="button"
              onClick={handleRefreshClick}
              disabled={isRefreshing || isLoading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#E1E3DA] bg-white hover:bg-[#EFEFE6] text-[#123B2A] text-xs font-bold transition-colors cursor-pointer disabled:opacity-50 whitespace-nowrap shrink-0"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${isRefreshing || isLoading ? 'animate-spin' : ''}`}
              />
              <span>Actualiser</span>
            </button>
          )}

          {!compact && (
            <button
              type="button"
              onClick={handleExportCsv}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#123B2A] hover:bg-[#1F5A40] text-[#D8F36A] text-xs font-bold transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Télécharger CSV</span>
            </button>
          )}

          {compact && onOpenFullAnalytics && (
            <button
              type="button"
              onClick={onOpenFullAnalytics}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#123B2A] hover:bg-[#1F5A40] text-[#D8F36A] text-xs font-bold transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <span>Détails par jour</span>
            </button>
          )}
        </div>
      </div>

      {/* KPI Summary Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 divide-y lg:divide-y-0 lg:divide-x divide-[#E1E3DA] border-b border-[#E1E3DA] bg-white">
        <div className="p-4">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#6B726C]">
              Visites aujourd&apos;hui
            </span>
            <Eye className="w-4 h-4 text-[#1F5A40]" />
          </div>
          <div className="flex items-baseline gap-2 mt-1">
            <p className="text-2xl font-extrabold text-[#123B2A] font-title tabular-nums">
              {todayPoint.visits.toLocaleString('fr-FR')}
            </p>
            {yesterdayPoint && (
              <span
                className={`inline-flex items-center text-[11px] font-bold tabular-nums ${
                  visitsDeltaYesterday >= 0 ? 'text-emerald-700' : 'text-amber-700'
                }`}
              >
                {visitsDeltaYesterday >= 0 ? (
                  <ArrowUpRight className="w-3 h-3" />
                ) : (
                  <ArrowDownRight className="w-3 h-3" />
                )}
                {visitsDeltaYesterday >= 0 ? `+${visitsDeltaYesterday}` : visitsDeltaYesterday} vs hier
              </span>
            )}
          </div>
          <p className="text-[11px] text-[#6B726C] mt-0.5 tabular-nums">
            {todayPoint.pageViews.toLocaleString('fr-FR')} ouverture{todayPoint.pageViews > 1 ? 's' : ''} du site ce jour
          </p>
        </div>

        <div className="p-4">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#6B726C]">
              Achats aujourd&apos;hui
            </span>
            <ShoppingBag className="w-4 h-4 text-[#D97706]" />
          </div>
          <div className="flex items-baseline gap-2 mt-1">
            <p className="text-2xl font-extrabold text-[#123B2A] font-title tabular-nums">
              {todayPoint.ordersCount}
            </p>
            <span className="text-xs font-bold text-[#1F5A40] tabular-nums">
              dont {todayPoint.purchasesCount} validé{todayPoint.purchasesCount > 1 ? 's' : ''}
            </span>
          </div>
          <p className="text-[11px] text-[#6B726C] mt-0.5 tabular-nums">
            Volume du jour : {formatFCFA(todayPoint.totalOrderAmount)}
          </p>
        </div>

        <div className="p-4">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#6B726C]">
              Visites ({periodDays} jours)
            </span>
            <TrendingUp className="w-4 h-4 text-[#123B2A]" />
          </div>
          <p className="text-2xl font-extrabold text-[#123B2A] font-title mt-1 tabular-nums">
            {periodTotals.visits.toLocaleString('fr-FR')}
          </p>
          <p className="text-[11px] text-[#6B726C] mt-0.5 tabular-nums">
            Moy. {(periodTotals.visits / periodDays).toFixed(1)} visites / jour · {periodTotals.pageViews.toLocaleString('fr-FR')} vues
          </p>
        </div>

        <div className="p-4">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#6B726C]">
              Ventes &amp; Conversion ({periodDays}j)
            </span>
            <CheckCircle2 className="w-4 h-4 text-[#16A34A]" />
          </div>
          <div className="flex items-baseline gap-2 mt-1">
            <p className="text-xl sm:text-2xl font-extrabold text-[#123B2A] font-title tabular-nums">
              {periodTotals.ordersCount} cmd
            </p>
            <span className="text-xs font-bold text-emerald-700 tabular-nums">
              {periodConversionRate.toFixed(1)}% conv.
            </span>
          </div>
          <p className="text-[11px] text-[#6B726C] mt-0.5 tabular-nums">
            {periodTotals.purchasesCount} achat{periodTotals.purchasesCount > 1 ? 's' : ''} validé{periodTotals.purchasesCount > 1 ? 's' : ''} · {formatFCFA(periodTotals.revenue)}
          </p>
        </div>
      </div>

      {/* Interactive Day Focus Bar + Legend */}
      <div className="px-4 sm:px-5 pt-4 pb-2 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[#202720]">
          <span className="font-bold text-[#123B2A]">{activePoint.fullLabel}</span>
          <span className="text-[#E1E3DA]">·</span>
          <span className="tabular-nums">
            <strong className="text-[#123B2A]">{activePoint.visits}</strong> visite{activePoint.visits > 1 ? 's' : ''}{' '}
            <span className="text-[#6B726C]">({activePoint.pageViews} vues)</span>
          </span>
          <span className="text-[#E1E3DA]">·</span>
          <span className="tabular-nums">
            <strong className="text-[#D97706]">{activePoint.ordersCount}</strong> commande{activePoint.ordersCount > 1 ? 's' : ''}
          </span>
          <span className="text-[#E1E3DA]">·</span>
          <span className="tabular-nums">
            <strong className="text-[#16A34A]">{activePoint.purchasesCount}</strong> achat{activePoint.purchasesCount > 1 ? 's' : ''} validé{activePoint.purchasesCount > 1 ? 's' : ''} ({formatFCFA(activePoint.revenue)})
          </span>
        </div>

        {/* Series Legend */}
        <div className="flex flex-wrap items-center gap-4 text-[11px] font-semibold text-[#4A5568]">
          {chartMode === 'traffic_orders' ? (
            <>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-3 h-1 bg-[#123B2A] rounded-full inline-block" />
                <span>Visites / jour</span>
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-3 h-1 bg-[#D97706] rounded-full inline-block" />
                <span>Commandes reçues</span>
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-3 h-1 bg-[#16A34A] rounded-full inline-block" />
                <span>Achats validés</span>
              </span>
            </>
          ) : (
            <>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-3 h-1 bg-[#123B2A] rounded-full inline-block" />
                <span>Commandes totales</span>
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-3 h-1 bg-[#16A34A] rounded-full inline-block" />
                <span>Achats validés</span>
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-3 h-1 bg-[#D97706] rounded-full inline-block" />
                <span>Revenus (F CFA)</span>
              </span>
            </>
          )}
        </div>
      </div>

      {/* Responsive Evolution Curve SVG */}
      <div className="px-2 sm:px-4 pb-4">
        <div className="w-full overflow-x-auto">
          <svg
            viewBox={`0 0 ${svgWidth} ${svgHeight}`}
            className="w-full min-w-[540px] h-auto select-none"
            role="img"
            aria-label="Courbe d'évolution journalière des visites et achats"
          >
            <defs>
              <linearGradient id="huizePrimaryArea" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#123B2A" stopOpacity="0.22" />
                <stop offset="100%" stopColor="#123B2A" stopOpacity="0.01" />
              </linearGradient>
            </defs>

            {/* Horizontal Gridlines & Left/Right Y-Axis Labels */}
            {yTicks.map((ratio) => {
              const y = baseLineY - ratio * plotHeight;
              const leftLabel = Math.round(ratio * leftAxisMax);
              const rightLabel =
                chartMode === 'traffic_orders'
                  ? Math.round(ratio * rightAxisMax)
                  : rightAxisMax >= 1000
                  ? `${Math.round((ratio * rightAxisMax) / 1000)}k`
                  : Math.round(ratio * rightAxisMax);

              return (
                <g key={ratio}>
                  <line
                    x1={padLeft}
                    y1={y}
                    x2={svgWidth - padRight}
                    y2={y}
                    stroke="#E1E3DA"
                    strokeDasharray={ratio === 0 ? undefined : '3 3'}
                    strokeWidth={1}
                  />
                  <text
                    x={padLeft - 8}
                    y={y + 4}
                    textAnchor="end"
                    fontSize="10"
                    fill="#6B726C"
                    className="tabular-nums font-mono"
                  >
                    {leftLabel}
                  </text>
                  <text
                    x={svgWidth - padRight + 8}
                    y={y + 4}
                    textAnchor="start"
                    fontSize="10"
                    fill="#D97706"
                    className="tabular-nums font-mono"
                  >
                    {rightLabel}
                  </text>
                </g>
              );
            })}

            {/* Area Fill & Curves */}
            {primaryAreaPath && <path d={primaryAreaPath} fill="url(#huizePrimaryArea)" />}

            {primaryLinePath && (
              <path
                d={primaryLinePath}
                fill="none"
                stroke="#123B2A"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}

            {secondaryLinePath && (
              <path
                d={secondaryLinePath}
                fill="none"
                stroke={chartMode === 'traffic_orders' ? '#D97706' : '#16A34A'}
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}

            {tertiaryLinePath && (
              <path
                d={tertiaryLinePath}
                fill="none"
                stroke={chartMode === 'traffic_orders' ? '#16A34A' : '#D97706'}
                strokeWidth="2"
                strokeDasharray="5 4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}

            {/* Vertical Crosshair on Active Day */}
            {series[activePointIdx] && (
              <line
                x1={getX(activePointIdx)}
                y1={padTop}
                x2={getX(activePointIdx)}
                y2={baseLineY}
                stroke="#1F5A40"
                strokeOpacity="0.35"
                strokeDasharray="3 3"
                strokeWidth="1.2"
              />
            )}

            {/* Data Points + X-Axis Labels + Wide Hover Hit Columns */}
            {series.map((point, idx) => {
              const cx = getX(idx);
              const isActive = idx === activePointIdx;
              const colWidth = series.length > 1 ? plotWidth / (series.length - 1) : plotWidth;
              const showXLabel =
                idx === 0 || idx === series.length - 1 || idx % labelStep === 0;

              return (
                <g key={point.date}>
                  {showXLabel && (
                    <text
                      x={cx}
                      y={svgHeight - 10}
                      textAnchor="middle"
                      fontSize="10"
                      fontWeight={isActive ? '700' : '500'}
                      fill={isActive ? '#123B2A' : '#6B726C'}
                    >
                      {point.shortLabel}
                    </text>
                  )}

                  {/* Visible Dots (always shown for active day or <= 14d period) */}
                  {(isActive || periodDays <= 14) && (
                    <>
                      <circle
                        cx={cx}
                        cy={primaryPoints[idx].y}
                        r={isActive ? 4.5 : 3}
                        fill="#123B2A"
                        stroke="#FFFFFF"
                        strokeWidth={1.5}
                      />
                      <circle
                        cx={cx}
                        cy={secondaryPoints[idx].y}
                        r={isActive ? 4 : 2.5}
                        fill={chartMode === 'traffic_orders' ? '#D97706' : '#16A34A'}
                        stroke="#FFFFFF"
                        strokeWidth={1.5}
                      />
                      {isActive && (
                        <circle
                          cx={cx}
                          cy={tertiaryPoints[idx].y}
                          r={4}
                          fill={chartMode === 'traffic_orders' ? '#16A34A' : '#D97706'}
                          stroke="#FFFFFF"
                          strokeWidth={1.5}
                        />
                      )}
                    </>
                  )}

                  {/* Interactive Hover / Tap Column */}
                  <rect
                    x={cx - colWidth / 2}
                    y={padTop}
                    width={Math.max(10, colWidth)}
                    height={plotHeight + padBottom}
                    fill="transparent"
                    className="cursor-pointer"
                    onMouseEnter={() => setHoveredIdx(idx)}
                    onClick={() => setHoveredIdx(idx)}
                  />
                </g>
              );
            })}
          </svg>
        </div>
      </div>

      {/* Daily History Table (shown in full Statistiques section) */}
      {!compact && (
        <div className="border-t border-[#E1E3DA]">
          <div className="px-4 sm:px-5 py-3 bg-[#FAF9F5] border-b border-[#E1E3DA] flex items-center justify-between gap-2">
            <h3 className="text-xs sm:text-sm font-bold text-[#123B2A]">
              Historique journalier ({series.length} derniers jours)
            </h3>
            <span className="text-[11px] text-[#6B726C]">
              Classé du plus récent au plus ancien
            </span>
          </div>

          <div className="overflow-x-auto max-h-96 overflow-y-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#FAF9F5] text-[#123B2A] font-bold uppercase text-[10px] tracking-wider border-b border-[#E1E3DA] sticky top-0">
                <tr>
                  <th className="py-2.5 px-4">Date</th>
                  <th className="py-2.5 px-4 text-right">Visites uniques</th>
                  <th className="py-2.5 px-4 text-right">Pages vues</th>
                  <th className="py-2.5 px-4 text-right">Commandes</th>
                  <th className="py-2.5 px-4 text-right">Achats validés</th>
                  <th className="py-2.5 px-4 text-right">Conversion</th>
                  <th className="py-2.5 px-4 text-right">Chiffre d&apos;affaires</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E1E3DA]">
                {[...series].reverse().map((row) => {
                  const isToday = row.date === todayKey;
                  return (
                    <tr
                      key={row.date}
                      onMouseEnter={() => {
                        const origIdx = series.findIndex((s) => s.date === row.date);
                        if (origIdx >= 0) setHoveredIdx(origIdx);
                      }}
                      className={`hover:bg-[#FAF9F5] transition-colors ${
                        isToday ? 'bg-[#D8F36A]/15 font-semibold' : ''
                      }`}
                    >
                      <td className="py-2.5 px-4 text-[#123B2A] whitespace-nowrap">
                        <span>{row.fullLabel}</span>
                        {isToday && (
                          <span className="ml-2 text-[10px] font-bold text-[#1F5A40]">
                            · Aujourd&apos;hui
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-4 text-right tabular-nums text-[#123B2A] font-bold">
                        {row.visits.toLocaleString('fr-FR')}
                      </td>
                      <td className="py-2.5 px-4 text-right tabular-nums text-[#6B726C]">
                        {row.pageViews.toLocaleString('fr-FR')}
                      </td>
                      <td className="py-2.5 px-4 text-right tabular-nums text-[#D97706] font-bold">
                        {row.ordersCount}
                      </td>
                      <td className="py-2.5 px-4 text-right tabular-nums text-[#16A34A] font-bold">
                        {row.purchasesCount}
                      </td>
                      <td className="py-2.5 px-4 text-right tabular-nums text-[#4A5568]">
                        {row.conversionRate.toFixed(1)}%
                      </td>
                      <td className="py-2.5 px-4 text-right tabular-nums font-bold text-[#123B2A] whitespace-nowrap">
                        {formatFCFA(row.revenue)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
};
