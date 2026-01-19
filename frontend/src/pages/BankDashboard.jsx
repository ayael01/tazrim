import { useEffect, useMemo, useState } from "react";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { useNavigate } from "react-router-dom";

import BankUploadCard from "../components/BankUploadCard.jsx";
import BankUnknownPayeesCard from "../components/BankUnknownPayeesCard.jsx";
import BankImportHistoryCard from "../components/BankImportHistoryCard.jsx";

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

function formatMoney(amount) {
  return currencyFormatter.format(Number(amount || 0));
}

const now = new Date();
const defaultYear = now.getFullYear();

export default function BankDashboard() {
  const navigate = useNavigate();
  const [year, setYear] = useState(defaultYear);
  const [years, setYears] = useState([]);
  const [summary, setSummary] = useState(null);
  const [trend, setTrend] = useState([]);
  const [latestActivities, setLatestActivities] = useState([]);
  const [categories, setCategories] = useState([]);
  const [unknownPayees, setUnknownPayees] = useState([]);
  const [importBatches, setImportBatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadDashboard = async () => {
    try {
      setLoading(true);
      const [
        summaryRes,
        trendRes,
        activityRes,
        categoriesRes,
        unknownRes,
        importsRes,
      ] = await Promise.all([
        fetch(`${API_BASE}/bank/reports/summary?year=${year}`),
        fetch(`${API_BASE}/bank/reports/monthly-cashflow?year=${year}`),
        fetch(`${API_BASE}/bank/activities?limit=10`),
        fetch(`${API_BASE}/bank/categories`),
        fetch(`${API_BASE}/bank/payees/unknown?limit=6`),
        fetch(`${API_BASE}/bank/imports?limit=5`),
      ]);

      if (
        !summaryRes.ok ||
        !trendRes.ok ||
        !activityRes.ok ||
        !categoriesRes.ok ||
        !unknownRes.ok ||
        !importsRes.ok
      ) {
        throw new Error("Failed to load bank dashboard data");
      }

      const summaryData = await summaryRes.json();
      const trendData = await trendRes.json();
      const activityData = await activityRes.json();
      const categoriesData = await categoriesRes.json();
      const unknownData = await unknownRes.json();
      const importsData = await importsRes.json();

      setSummary(summaryData);
      setTrend(trendData.items ?? []);
      setLatestActivities(activityData.items ?? []);
      setCategories(categoriesData ?? []);
      setUnknownPayees(unknownData ?? []);
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
        const response = await fetch(`${API_BASE}/bank/reports/years`);
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
        // ignore year load errors
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
        income: Number(item.income || 0),
        expense: Number(item.expense || 0),
        net: Number(item.net || 0),
      })),
    [trend]
  );

  return (
    <div className="dashboard">
      <header className="hero">
        <div>
          <p className="eyebrow">Tazrim</p>
          <h1>Bank overview.</h1>
          <p className="subtitle">
            Track checking activity, upload monthly exports, and categorize payees
            for cleaner reports.
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
            <span className="label">Total income {year}</span>
            <strong>
              {summary ? currencyFormatter.format(summary.income_total) : "--"}
            </strong>
          </div>
          <div className="summary-card">
            <span className="label">Total expense {year}</span>
            <strong>
              {summary ? currencyFormatter.format(summary.expense_total) : "--"}
            </strong>
          </div>
          <div className="summary-card">
            <span className="label">Net balance</span>
            <strong>
              {summary ? currencyFormatter.format(summary.net_total) : "--"}
            </strong>
          </div>
          <div className="summary-card">
            <span className="label">Uncategorized payees</span>
            <strong>{summary ? summary.uncategorized_payees : "--"}</strong>
          </div>
        </div>
      </header>

      <section className="dashboard-grid">
        <BankUploadCard onUploaded={loadDashboard} />
        <BankImportHistoryCard
          batches={importBatches}
          onRollback={loadDashboard}
          onView={(id) => navigate(`/bank/imports/${id}`)}
        />

        <div className="card chart-card">
          <div className="card-header">
            <h3>Monthly trend</h3>
            <p>Income vs expense per month in {year}</p>
          </div>
          <div className="chart">
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={monthLabels}>
                <XAxis dataKey="label" />
                <YAxis hide />
                <Tooltip formatter={(value) => formatMoney(value)} />
                <Bar dataKey="income" stackId="cashflow" fill="#56c2a7" />
                <Bar dataKey="expense" stackId="cashflow" fill="#ff8a4b" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <BankUnknownPayeesCard
          payees={unknownPayees}
          categories={categories}
          onAssigned={loadDashboard}
          totalCount={summary?.uncategorized_payees}
        />

        <div className="card table-card">
          <div className="card-header">
            <h3>Latest activities</h3>
            <p>Most recent 10 rows</p>
          </div>
          <div className="table">
            <div className="table-row table-head">
              <span>Date</span>
              <span>Description</span>
              <span>Category</span>
              <span className="amount">Amount</span>
            </div>
            {latestActivities.map((activity) => (
              <div className="table-row" key={activity.id}>
                <span>{dateFormatter.format(new Date(activity.activity_date))}</span>
                <span className="merchant">{activity.description}</span>
                <span className="category">
                  {activity.category_name || "Uncategorized"}
                </span>
                <span className="amount">
                  {formatMoney(activity.debit ?? activity.credit)}
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
