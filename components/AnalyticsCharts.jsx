// components/AnalyticsCharts.jsx
// Lazily-loaded recharts wrapper — keeps 8.3MB recharts out of the main bundle.
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

function ChartBox({ title, children }) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
      <h3 className="text-white font-semibold mb-4">{title}</h3>
      {children}
    </div>
  );
}

export function RevenueForecastChart({ data }) {
  return (
    <ChartBox title="🔮 AI Revenue Prediction">
      {data.length === 0 ? (
        <p className="text-slate-400 text-center">
          Need at least 2 months data
        </p>
      ) : (
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={data}>
            <XAxis dataKey="month" />
            <YAxis />
            <Tooltip />
            <Line dataKey="predicted" stroke="#facc15" />
          </LineChart>
        </ResponsiveContainer>
      )}
    </ChartBox>
  );
}

export function EarningsOverTimeChart({ data }) {
  return (
    <ChartBox title="Earnings Over Time">
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={data}>
          <XAxis dataKey="date" />
          <YAxis />
          <Tooltip />
          <Line dataKey="amount" stroke="#3b82f6" />
        </LineChart>
      </ResponsiveContainer>
    </ChartBox>
  );
}

export function FundingByProjectChart({ data }) {
  return (
    <ChartBox title="Funding by Project">
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data}>
          <XAxis dataKey="name" />
          <YAxis />
          <Tooltip />
          <Bar dataKey="amount" fill="#22c55e" />
        </BarChart>
      </ResponsiveContainer>
    </ChartBox>
  );
}
