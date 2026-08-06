/**
 * components/investor/InvestorCharts.jsx
 *
 * Lazily-loaded recharts wrappers for the investor Analytics page. These are
 * chart-only components — the page wraps each in a GlassCard/SectionCard, so
 * unlike the creator AnalyticsCharts they carry no `bg-slate-900` ChartBox.
 *
 * Kept out of the main bundle via next/dynamic({ ssr: false }) on the page.
 * FundingTimeline needs no recharts but lives here so the whole analytics UI
 * loads as one lazy chunk.
 */

import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import GlassCard from "../ui/GlassCard";
import { formatINR } from "../../lib/investor/investorFormat";

/** Brand palette for series/segments (matches the app's accent set). */
export const CHART_PALETTE = ["#3b82f6", "#22c55e", "#facc15", "#a855f7", "#ec4899"];

const tooltipStyle = {
  background: "#0d0d15",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: "8px",
  color: "#fff",
};

const axisTick = { fill: "rgba(255,255,255,0.55)", fontSize: 12 };
const axisLine = { stroke: "rgba(255,255,255,0.15)" };
const gridStroke = "rgba(255,255,255,0.06)";

/** Compact ₹ label for axis ticks, e.g. 150000 → "1.5L". */
function formatCompact(value) {
  if (value == null || isNaN(Number(value))) return "0";
  return new Intl.NumberFormat("en-IN", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(Number(value));
}

/** Tooltip formatter that renders full rupee amounts for hover labels. */
function rupeeTooltip(value, name) {
  return [formatINR(Number(value) || 0), name];
}

function ChartEmpty({ message }) {
  return (
    <div className="flex items-center justify-center h-[280px] text-on-surface-variant text-sm font-inter">
      {message}
    </div>
  );
}

export function InvestmentGrowthChart({ data = [] }) {
  if (data.length === 0) return <ChartEmpty message="No investment growth data yet" />;
  return (
    <ResponsiveContainer width="100%" height={280}>
      <AreaChart data={data}>
        <defs>
          <linearGradient id="investorGrowth" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.35} />
            <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
        <XAxis dataKey="month" stroke={axisLine.stroke} tick={axisTick} tickLine={false} />
        <YAxis stroke={axisLine.stroke} tick={axisTick} tickLine={false} width={64} tickFormatter={formatCompact} />
        <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: "#fff" }} formatter={rupeeTooltip} />
        <Area type="monotone" dataKey="invested" name="Total invested" stroke="#3b82f6" strokeWidth={2} fill="url(#investorGrowth)" />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function MonthlyInvestmentChart({ data = [] }) {
  if (data.length === 0) return <ChartEmpty message="No monthly investment data yet" />;
  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
        <XAxis dataKey="month" stroke={axisLine.stroke} tick={axisTick} tickLine={false} />
        <YAxis stroke={axisLine.stroke} tick={axisTick} tickLine={false} width={64} tickFormatter={formatCompact} />
        <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: "#fff" }} formatter={rupeeTooltip} />
        <Bar dataKey="amount" name="Invested" fill="#22c55e" radius={[4, 4, 0, 0]} maxBarSize={36} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function PortfolioAllocationChart({ data = [], height = 280 }) {
  if (data.length === 0) return <ChartEmpty message="No allocation data yet" />;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart>
        <Pie
          data={data}
          dataKey="value"
          nameKey="name"
          innerRadius={60}
          outerRadius={95}
          paddingAngle={2}
          stroke="none"
        >
          {data.map((entry, i) => (
            <Cell key={entry.name || i} fill={CHART_PALETTE[i % CHART_PALETTE.length]} />
          ))}
        </Pie>
        <Tooltip contentStyle={tooltipStyle} formatter={rupeeTooltip} />
        <Legend wrapperStyle={{ fontSize: 12, color: "rgba(255,255,255,0.7)" }} />
      </PieChart>
    </ResponsiveContainer>
  );
}

export function SectorDistributionChart({ data = [] }) {
  if (data.length === 0) return <ChartEmpty message="No sector data yet" />;
  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} layout="vertical" margin={{ left: 8, right: 16 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} horizontal={false} />
        <XAxis type="number" stroke={axisLine.stroke} tick={axisTick} tickLine={false} tickFormatter={formatCompact} />
        <YAxis type="category" dataKey="name" width={90} stroke={axisLine.stroke} tick={axisTick} tickLine={false} />
        <Tooltip contentStyle={tooltipStyle} formatter={rupeeTooltip} />
        <Bar dataKey="value" name="Invested" fill="#a855f7" radius={[0, 4, 4, 0]} maxBarSize={24} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function HistoricalTrendsChart({ data = [] }) {
  if (data.length === 0) return <ChartEmpty message="No historical trends yet" />;
  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
        <XAxis dataKey="month" stroke={axisLine.stroke} tick={axisTick} tickLine={false} />
        <YAxis
          yAxisId="left"
          stroke={axisLine.stroke}
          tick={axisTick}
          tickLine={false}
          width={64}
          tickFormatter={formatCompact}
        />
        <YAxis
          yAxisId="right"
          orientation="right"
          stroke={axisLine.stroke}
          tick={axisTick}
          tickLine={false}
          width={36}
        />
        <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: "#fff" }} />
        <Legend wrapperStyle={{ fontSize: 12, color: "rgba(255,255,255,0.7)" }} />
        <Line yAxisId="left" type="monotone" dataKey="invested" name="Cumulative (₹)" stroke="#3b82f6" strokeWidth={2} dot={false} />
        <Line yAxisId="right" type="monotone" dataKey="donations" name="Donations" stroke="#22c55e" strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}

function statusClasses(status) {
  if (status === "paid") return "border-success/40 bg-success/10 text-success";
  if (status === "pending") return "border-warning/40 bg-warning/10 text-warning";
  return "border-on-surface-variant/30 bg-surface-container-high text-on-surface-variant";
}

function formatDate(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  return isNaN(d.getTime())
    ? "—"
    : d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

/**
 * FundingTimeline — chronological vertical rail of the user's contributions,
 * oldest → newest top → bottom. Distinct from the Overview's Recent Activity
 * list (which is a flat newest-first feed). Data is deriveAnalytics
 * `.fundingTimeline`, already sorted ascending.
 */
export function FundingTimeline({ data = [] }) {
  if (data.length === 0) {
    return (
      <p className="text-center text-on-surface-variant text-sm font-inter py-8">
        No contributions yet
      </p>
    );
  }
  return (
    <div className="relative">
      <div className="absolute left-[11px] top-2 bottom-2 w-px bg-white/10" aria-hidden="true" />
      <ol className="space-y-4">
        {data.map((item) => (
          <li key={item.id} className="relative pl-10">
            <span
              className={`absolute left-0 top-1.5 w-[23px] h-[23px] rounded-full border-2 flex items-center justify-center ${statusClasses(item.status)}`}
              aria-hidden="true"
            >
              <span className="w-2 h-2 rounded-full bg-current" />
            </span>
            <GlassCard className="p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-on-surface font-geist truncate">
                    {item.projectTitle}
                  </p>
                  <p className="text-xs text-on-surface-variant font-inter">{formatDate(item.date)}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className={`text-sm font-semibold font-inter ${statusClasses(item.status)}`}>
                    {formatINR(item.amount)}
                  </p>
                  <span className="text-[10px] uppercase tracking-wider text-on-surface-variant font-inter">
                    {item.status || "—"}
                  </span>
                </div>
              </div>
            </GlassCard>
          </li>
        ))}
      </ol>
    </div>
  );
}
