import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Bar,
  BarChart,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const API_BASE = "http://localhost:8000";

const COLORS = [
  "#ff8a4b",
  "#3aa0ff",
  "#7b61ff",
  "#56c2a7",
  "#f6c453",
  "#ff7ac8",
];

function formatMoney(value) {
  return new Intl.NumberFormat("en-IL", {
    style: "currency",
    currency: "ILS",
    minimumFractionDigits: 0,
  }).format(Number(value || 0));
}

function toMonthLabel(value) {
  if (!value) {
    return "";
  }
  const [year, month] = value.split("-");
  const date = new Date(Number(year), Number(month) - 1, 1);
  return new Intl.DateTimeFormat("en-GB", { month: "short" }).format(date);
}

function SortedTooltip({ active, payload, label }) {
  if (!active || !payload?.length) {
    return null;
  }
  const sorted = [...payload].sort(
    (a, b) => Number(b.value || 0) - Number(a.value || 0)
  );
  return (
    <div className="tooltip">
      <strong>{label}</strong>
      <div className="tooltip-list">
        {sorted.map((entry) => (
          <div
            key={entry.dataKey}
            className="tooltip-row"
            style={{ color: entry.color }}
          >
            <span>{entry.dataKey}</span>
            <span>{formatMoney(entry.value)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function CategoriesReport() {
  const navigate = useNavigate();
  const [year, setYear] = useState(new Date().getFullYear());
  const [years, setYears] = useState([]);
  const [limit, setLimit] = useState(6);
  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [filter, setFilter] = useState("");
  const [listOffset, setListOffset] = useState(0);
  const [listLoading, setListLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadYears() {
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
    }
    loadYears();
  }, []);

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        const [monthlyRes] = await Promise.all([
          fetch(
            `${API_BASE}/reports/category-monthly?year=${year}&limit=${limit}`
          ),
        ]);
        if (!monthlyRes.ok) {
          throw new Error("Failed to load category report");
        }
        const monthlyData = await monthlyRes.json();
        setItems(monthlyData.items ?? []);
        setError("");
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [year, limit]);

  useEffect(() => {
    setCategories([]);
    setListOffset(0);
    setHasMore(true);
  }, [year, filter]);

  useEffect(() => {
    if (!hasMore) {
      return;
    }
    const controller = new AbortController();
    async function loadList() {
      try {
        setListLoading(true);
        const response = await fetch(
          `${API_BASE}/categories?year=${year}&q=${encodeURIComponent(filter)}&limit=50&offset=${listOffset}`,
          { signal: controller.signal }
        );
        if (!response.ok) {
          return;
        }
        const payload = await response.json();
        const next = payload ?? [];
        setCategories((prev) => [...prev, ...next]);
        setHasMore(next.length === 50);
      } catch (err) {
        // ignore aborted requests
      } finally {
        setListLoading(false);
      }
    }
    loadList();
    return () => controller.abort();
  }, [year, filter, listOffset, hasMore]);

  const chartData = useMemo(() => {
    const months = Array.from(new Set(items.map((item) => item.month))).sort();
    const names = Array.from(new Set(items.map((item) => item.name)));
    return months.map((month) => {
      const entry = { month, label: toMonthLabel(month) };
      names.forEach((name) => {
        const match = items.find((item) => item.month === month && item.name === name);
        entry[name] = match ? Number(match.total || 0) : 0;
      });
      return entry;
    });
  }, [items]);

  const series = Array.from(new Set(items.map((item) => item.name)));

  return (
    <div className="report-page">
      <header className="page-header">
        <div>
          <h1>Category report</h1>
          <p>Track how category spending spreads across the year.</p>
        </div>
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
        <div className="series-picker">
          <label>
            Chart series
            <input
              type="number"
              min="1"
              max="50"
              value={limit}
              onChange={(event) => setLimit(Number(event.target.value))}
            />
          </label>
          <span className="helper">Controls chart only</span>
        </div>
      </header>

      <section className="card report-card">
        <div className="card-header">
          <h3>Monthly category spread</h3>
          <p>Top categories stacked by month</p>
        </div>
        <div className="chart">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart
              data={chartData}
              onClick={(data) => {
                const monthValue = data?.activePayload?.[0]?.payload?.month;
                if (!monthValue) {
                  return;
                }
                navigate(`/categories/month/${monthValue}`);
              }}
            >
              <XAxis dataKey="label" />
              <YAxis hide />
              <Tooltip content={<SortedTooltip />} />
              <Legend />
              {series.map((name, index) => (
                <Bar
                  key={name}
                  dataKey={name}
                  stackId="categories"
                  fill={COLORS[index % COLORS.length]}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="card report-card">
        <div className="card-header">
          <h3>All categories</h3>
          <p>Total spend in {year}</p>
        </div>
        <div className="search">
          <input
            type="text"
            placeholder="Filter categories by name"
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
          />
        </div>
        <ul className="list selectable">
          {categories.map((item) => (
            <li
              key={item.name}
              onClick={() =>
                navigate(
                  item.id ? `/categories/${item.id}` : "/categories/uncategorized"
                )
              }
            >
              <span>{item.name}</span>
              <strong>{formatMoney(item.total)}</strong>
            </li>
          ))}
        </ul>
        <div className="load-more">
          {hasMore && (
            <button
              className="ghost-button"
              disabled={listLoading}
              onClick={() => setListOffset((prev) => prev + 50)}
            >
              {listLoading ? "Loading..." : "Load more"}
            </button>
          )}
        </div>
      </section>

      <div className="status-bar">
        {loading && <span className="pill">Loading report</span>}
        {error && <span className="pill error">{error}</span>}
      </div>
    </div>
  );
}
