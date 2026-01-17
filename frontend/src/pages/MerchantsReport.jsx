import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Line,
  LineChart,
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

function SortedTooltip({ active, payload, totalByMonth, seriesCount }) {
  if (!active || !payload?.length) {
    return null;
  }
  const monthKey = payload?.[0]?.payload?.month;
  const sorted = payload
    .filter((entry) => Number(entry.value || 0) !== 0)
    .sort(
    (a, b) => Number(b.value || 0) - Number(a.value || 0)
  );
  const total = totalByMonth?.[monthKey] ?? sorted.reduce((sum, entry) => sum + Number(entry.value || 0), 0);
  return (
    <div className="tooltip">
      <strong>{payload?.[0]?.payload?.label}</strong>
      <div className="tooltip-total">
        <span>Total</span>
        <span>{formatMoney(total)}</span>
      </div>
      <div className="tooltip-note">Top {seriesCount} merchants shown</div>
      <div className="tooltip-list">
        {sorted.map((entry) => (
          <div key={entry.dataKey} className="tooltip-row" style={{ color: entry.color }}>
            <span>{entry.dataKey}</span>
            <span>{formatMoney(entry.value)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function MerchantsReport() {
  const navigate = useNavigate();
  const [year, setYear] = useState(new Date().getFullYear());
  const [years, setYears] = useState([]);
  const [limit, setLimit] = useState(6);
  const [items, setItems] = useState([]);
  const [monthlyTotals, setMonthlyTotals] = useState({});
  const [merchants, setMerchants] = useState([]);
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
        const [monthlyRes, totalsRes] = await Promise.all([
          fetch(
            `${API_BASE}/reports/merchant-monthly?year=${year}&limit=${limit}`
          ),
          fetch(`${API_BASE}/reports/monthly-trend?year=${year}`),
        ]);
        if (!monthlyRes.ok || !totalsRes.ok) {
          throw new Error("Failed to load merchant report");
        }
        const monthlyData = await monthlyRes.json();
        const totalsData = await totalsRes.json();
        setItems(monthlyData.items ?? []);
        const totalsMap = {};
        (totalsData.items ?? []).forEach((item) => {
          totalsMap[item.month] = Number(item.total || 0);
        });
        setMonthlyTotals(totalsMap);
        setError("");
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [year, limit]);


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

  useEffect(() => {
    setMerchants([]);
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
          `${API_BASE}/merchants?q=${encodeURIComponent(filter)}&limit=50&offset=${listOffset}&year=${year}`,
          { signal: controller.signal }
        );
        if (!response.ok) {
          return;
        }
        const payload = await response.json();
        const next = payload ?? [];
        setMerchants((prev) => [...prev, ...next]);
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

  return (
    <div className="report-page">
      <header className="page-header">
        <div>
          <h1>Merchant report</h1>
          <p>See how the biggest merchants trend through the year.</p>
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
          <h3>Monthly merchant trends</h3>
          <p>Top merchants by spend</p>
        </div>
        <div className="chart">
          <ResponsiveContainer width="100%" height={280}>
            <LineChart
              data={chartData}
              onClick={(payload) => {
                const monthValue = payload?.activePayload?.[0]?.payload?.month;
                if (monthValue) {
                  navigate(`/merchants/month/${monthValue}`);
                }
              }}
            >
              <XAxis dataKey="label" />
              <YAxis hide />
              <Tooltip
                content={
                  <SortedTooltip
                    totalByMonth={monthlyTotals}
                    seriesCount={series.length}
                  />
                }
              />
              <Legend />
              {series.map((name, index) => (
                <Line
                  key={name}
                  dataKey={name}
                  stroke={COLORS[index % COLORS.length]}
                  strokeWidth={2.5}
                  dot={false}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="card report-card">
        <div className="card-header">
          <h3>All merchants</h3>
          <p>Total spend in {year}</p>
        </div>
        <div className="search">
          <input
            type="text"
            placeholder="Filter merchants by name"
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
          />
        </div>
        <ul className="list selectable">
          {merchants.map((item) => (
            <li key={item.id} onClick={() => navigate(`/merchants/${item.id}`)}>
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
