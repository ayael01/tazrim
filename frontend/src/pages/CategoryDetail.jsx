import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const API_BASE = "http://localhost:8000";

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

export default function CategoryDetail() {
  const { categoryId } = useParams();
  const navigate = useNavigate();
  const [year, setYear] = useState(new Date().getFullYear());
  const [years, setYears] = useState([]);
  const [data, setData] = useState(null);
  const [selectedMonth, setSelectedMonth] = useState(null);
  const [monthMerchants, setMonthMerchants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [popupError, setPopupError] = useState("");

  const isUncategorized = categoryId === "uncategorized";

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
    async function loadDetail() {
      if (!categoryId) {
        return;
      }
      try {
        setLoading(true);
        const params = new URLSearchParams({ year: String(year) });
        if (isUncategorized) {
          params.set("uncategorized", "true");
        } else {
          params.set("category_id", categoryId);
        }
        const response = await fetch(
          `${API_BASE}/reports/category-detail?${params.toString()}`
        );
        if (!response.ok) {
          throw new Error("Failed to load category detail");
        }
        const payload = await response.json();
        setData(payload);
        setError("");
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    loadDetail();
  }, [categoryId, year, isUncategorized]);

  useEffect(() => {
    async function loadMonthMerchants() {
      if (!selectedMonth) {
        return;
      }
      try {
        const [selectedYear, selectedMonthValue] = selectedMonth.split("-");
        const params = new URLSearchParams({
          year: selectedYear,
          month: selectedMonthValue,
        });
        if (isUncategorized) {
          params.set("uncategorized", "true");
        } else {
          params.set("category_id", categoryId);
        }
        const response = await fetch(
          `${API_BASE}/reports/category-month-merchants?${params.toString()}`
        );
        if (!response.ok) {
          throw new Error("Failed to load merchant list");
        }
        const payload = await response.json();
        setMonthMerchants(payload.merchants ?? []);
        setPopupError("");
      } catch (err) {
        setPopupError(err.message);
      }
    }

    loadMonthMerchants();
  }, [selectedMonth, isUncategorized, categoryId]);

  const chartData = useMemo(() => {
    if (!data?.items) {
      return [];
    }
    return data.items.map((item) => ({
      ...item,
      label: toMonthLabel(item.month),
      total: Number(item.total || 0),
    }));
  }, [data]);

  return (
    <div className="report-page">
      <header className="page-header">
        <div>
          <h1>{data?.category_name || "Category detail"}</h1>
          <p>Monthly spend trend for {year}</p>
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
        <button className="ghost-button" onClick={() => navigate(-1)}>
          Back to report
        </button>
      </header>

      <section className="card report-card">
        <div className="card-header">
          <h3>Monthly spend</h3>
          <p>How this category trends through the year</p>
        </div>
        <div className="chart">
          <ResponsiveContainer width="100%" height={280}>
            <LineChart
              data={chartData}
              onClick={(payload) => {
                const monthValue = payload?.activePayload?.[0]?.payload?.month;
                if (monthValue) {
                  setSelectedMonth(monthValue);
                }
              }}
            >
              <XAxis dataKey="label" />
              <YAxis hide />
              <Tooltip formatter={(value) => formatMoney(value)} />
              <Line
                type="monotone"
                dataKey="total"
                stroke="#3aa0ff"
                strokeWidth={3}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>

      {selectedMonth && (
        <div className="modal-overlay" onClick={() => setSelectedMonth(null)}>
          <div className="modal-card" onClick={(event) => event.stopPropagation()}>
            <div className="card-header">
              <h3>Merchants in {selectedMonth}</h3>
              <button
                className="ghost-button"
                onClick={() => setSelectedMonth(null)}
              >
                Close
              </button>
            </div>
            {popupError && <span className="pill error">{popupError}</span>}
            <div className="detail-list">
              {monthMerchants.map((merchant) => (
                <div className="detail-row" key={merchant.name}>
                  <span>{merchant.name}</span>
                  <strong>{formatMoney(merchant.total)}</strong>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="status-bar">
        {loading && <span className="pill">Loading category detail</span>}
        {error && <span className="pill error">{error}</span>}
      </div>
    </div>
  );
}
