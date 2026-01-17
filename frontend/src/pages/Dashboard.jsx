import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { useNavigate } from "react-router-dom";

import UploadCard from "../components/UploadCard.jsx";
import UnknownMerchantsCard from "../components/UnknownMerchantsCard.jsx";
import ImportHistoryCard from "../components/ImportHistoryCard.jsx";

const API_BASE = "http://localhost:8000";

const currencyFormatter = new Intl.NumberFormat("en-IL", {
  style: "currency",
  currency: "ILS",
  minimumFractionDigits: 0,
});

const dateFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

function formatMoney(amount, currency = "ILS") {
  if (amount == null) {
    return "";
  }

  try {
    return new Intl.NumberFormat("en-IL", {
      style: "currency",
      currency,
      minimumFractionDigits: 0,
    }).format(Number(amount));
  } catch (error) {
    return `${amount} ${currency}`;
  }
}

const now = new Date();
const defaultYear = now.getFullYear();

export default function Dashboard() {
  const navigate = useNavigate();
  const [year, setYear] = useState(defaultYear);
  const [years, setYears] = useState([]);
  const [summary, setSummary] = useState(null);
  const [trend, setTrend] = useState([]);
  const [topCategories, setTopCategories] = useState([]);
  const [topMerchants, setTopMerchants] = useState([]);
  const [latestTransactions, setLatestTransactions] = useState([]);
  const [categories, setCategories] = useState([]);
  const [unknownMerchants, setUnknownMerchants] = useState([]);
  const [importBatches, setImportBatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadDashboard = async () => {
    try {
      setLoading(true);
      const [
        summaryRes,
        trendRes,
        catRes,
        merRes,
        txRes,
        categoriesRes,
        unknownRes,
        importsRes,
      ] = await Promise.all([
        fetch(`${API_BASE}/reports/summary?year=${year}`),
        fetch(`${API_BASE}/reports/monthly-trend?year=${year}`),
        fetch(`${API_BASE}/reports/top-categories?year=${year}`),
        fetch(`${API_BASE}/reports/top-merchants?year=${year}`),
        fetch(`${API_BASE}/transactions?limit=10`),
        fetch(`${API_BASE}/categories`),
        fetch(`${API_BASE}/merchants/unknown?limit=6`),
        fetch(`${API_BASE}/imports?limit=5`),
      ]);

      if (
        !summaryRes.ok ||
        !trendRes.ok ||
        !catRes.ok ||
        !merRes.ok ||
        !txRes.ok ||
        !categoriesRes.ok ||
        !unknownRes.ok ||
        !importsRes.ok
      ) {
        throw new Error("Failed to load dashboard data");
      }

      const summaryData = await summaryRes.json();
      const trendData = await trendRes.json();
      const catData = await catRes.json();
      const merData = await merRes.json();
      const txData = await txRes.json();
      const categoriesData = await categoriesRes.json();
      const unknownData = await unknownRes.json();
      const importsData = await importsRes.json();

      setSummary(summaryData);
      setTrend(trendData.items ?? []);
      setTopCategories(catData.items ?? []);
      setTopMerchants(merData.items ?? []);
      setLatestTransactions(txData.items ?? []);
      setCategories(categoriesData ?? []);
      setUnknownMerchants(unknownData ?? []);
      setImportBatches(importsData ?? []);
      setError("");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    async function loadYears() {
      try {
        const response = await fetch(`${API_BASE}/reports/years`);
        if (!response.ok) {
          return;
        }
        const payload = await response.json();
        const available = payload.years || [];
        setYears(available);
        if (available.length && !available.includes(year)) {
          setYear(available[available.length - 1]);
        }
      } catch (err) {
        // ignore year load errors, dashboard will handle its own error state
      }
    }

    loadYears();
  }, []);

  useEffect(() => {
    loadDashboard();
  }, [year]);

  const monthLabels = useMemo(
    () =>
      trend.map((item) => ({
        ...item,
        label: item.month ? item.month.split("-")[1] : "",
        total: Number(item.total || 0),
      })),
    [trend]
  );

  return (
    <div className="dashboard">
      <header className="hero">
        <div>
          <p className="eyebrow">Tazrim</p>
          <h1>Welcome back.</h1>
          <p className="subtitle">
            Track family spending, upload new card statements, and explore
            category or merchant reports without manual spreadsheets.
          </p>
          <div className="year-picker">
            <label>
              Year
              <input
                type="number"
                min="2020"
                max="2100"
                value={year}
                onChange={(event) => setYear(Number(event.target.value))}
              />
            </label>
            {years.length > 0 && (
              <span className="helper">Available: {years.join(", ")}</span>
            )}
          </div>
        </div>
        <div className="summary">
          <div className="summary-card">
            <span className="label">Total spend {year}</span>
            <strong>
              {summary ? currencyFormatter.format(summary.total_spend) : "--"}
            </strong>
          </div>
          <div className="summary-card">
            <span className="label">Avg / month</span>
            <strong>
              {summary ? currencyFormatter.format(summary.average_monthly) : "--"}
            </strong>
          </div>
          <div className="summary-card">
            <span className="label">Uncategorized merchants</span>
            <strong>{summary ? summary.uncategorized_merchants : "--"}</strong>
          </div>
        </div>
      </header>

      <section className="dashboard-grid">
        <UploadCard onUploaded={loadDashboard} />
        <ImportHistoryCard
          batches={importBatches}
          onRollback={loadDashboard}
          onView={(id) => navigate(`/imports/${id}`)}
        />

        <div className="card chart-card">
          <div className="card-header">
            <h3>Monthly trend</h3>
            <p>Spend per month in {year}</p>
          </div>
          <div className="chart">
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={monthLabels}>
                <XAxis dataKey="label" />
                <YAxis hide />
                <Tooltip formatter={(value) => formatMoney(value)} />
                <Line
                  type="monotone"
                  dataKey="total"
                  stroke="#ff8a4b"
                  strokeWidth={3}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card chart-card">
          <div className="card-header">
            <h3>Top categories</h3>
            <p>Highest spend</p>
          </div>
          <div className="chart">
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={topCategories}>
                <XAxis dataKey="name" hide />
                <YAxis hide />
                <Tooltip formatter={(value) => formatMoney(value)} />
                <Bar dataKey="total" fill="#3aa0ff" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <ul className="list">
            {topCategories.map((item) => (
              <li key={item.name}>
                <span>{item.name}</span>
                <strong>{formatMoney(item.total)}</strong>
              </li>
            ))}
          </ul>
        </div>

        <div className="card chart-card">
          <div className="card-header">
            <h3>Top merchants</h3>
            <p>Biggest spenders</p>
          </div>
          <div className="chart">
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={topMerchants}>
                <XAxis dataKey="name" hide />
                <YAxis hide />
                <Tooltip formatter={(value) => formatMoney(value)} />
                <Bar dataKey="total" fill="#7b61ff" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <ul className="list">
            {topMerchants.map((item) => (
              <li key={item.name}>
                <span>{item.name}</span>
                <strong>{formatMoney(item.total)}</strong>
              </li>
            ))}
          </ul>
        </div>

        <UnknownMerchantsCard
          merchants={unknownMerchants}
          categories={categories}
          onAssigned={loadDashboard}
          totalCount={summary?.uncategorized_merchants}
        />

        <div className="card table-card">
          <div className="card-header">
            <h3>Latest transactions</h3>
            <p>Most recent 10 rows</p>
          </div>
          <div className="table">
            <div className="table-row table-head">
              <span>Date</span>
              <span>Merchant</span>
              <span>Category</span>
              <span className="amount">Amount</span>
            </div>
            {latestTransactions.map((tx) => (
              <div className="table-row" key={tx.id}>
                <span>{dateFormatter.format(new Date(tx.transaction_date))}</span>
                <span className="merchant">{tx.merchant_raw}</span>
                <span className="category">{tx.category_name || "Uncategorized"}</span>
                <span className="amount">
                  {formatMoney(tx.amount, tx.currency)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="status-bar">
        {loading && <span className="pill">Loading dashboard</span>}
        {error && <span className="pill error">{error}</span>}
      </div>
    </div>
  );
}
