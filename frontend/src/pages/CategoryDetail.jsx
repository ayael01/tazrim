import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
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

function formatMoneyCompact(value) {
  return new Intl.NumberFormat("en-IL", {
    style: "currency",
    currency: "ILS",
    notation: "compact",
    maximumFractionDigits: 1,
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

function TrendTooltip({ active, payload, label, average }) {
  if (!active || !payload?.length) {
    return null;
  }
  const value = Number(payload[0]?.value || 0);
  const diff = value - Number(average || 0);
  return (
    <div className="tooltip">
      <strong>{label}</strong>
      <div className="tooltip-total">
        <span>Month spend</span>
        <span>{formatMoney(value)}</span>
      </div>
      <div className="tooltip-row">
        <span>Vs average</span>
        <span>{`${diff >= 0 ? "+" : "-"}${formatMoney(Math.abs(diff))}`}</span>
      </div>
    </div>
  );
}

export default function CategoryDetail() {
  const { categoryId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const initialReportYear = useMemo(() => {
    const stateYear = Number(location.state?.year);
    return Number.isFinite(stateYear) ? stateYear : new Date().getFullYear();
  }, [location.state?.year]);
  const [year, setYear] = useState(initialReportYear);
  const [reportYear] = useState(initialReportYear);
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

  const totalSpend = useMemo(
    () => chartData.reduce((sum, item) => sum + Number(item.total || 0), 0),
    [chartData]
  );
  const averageSpend = useMemo(
    () => totalSpend / (chartData.length || 1),
    [totalSpend, chartData.length]
  );
  const highestMonth = useMemo(() => {
    if (!chartData.length) {
      return null;
    }
    return chartData.reduce((max, item) => (item.total > max.total ? item : max), chartData[0]);
  }, [chartData]);
  const lowestMonth = useMemo(() => {
    if (!chartData.length) {
      return null;
    }
    return chartData.reduce((min, item) => (item.total < min.total ? item : min), chartData[0]);
  }, [chartData]);

  return (
    <div className="report-page">
      <header className="page-header cards-report-header cards-detail-header">
        <div className="cards-report-header-main">
          <h1>{data?.category_name || "Category detail"}</h1>
          <p>Monthly spend trend for {year}</p>
        </div>
        <div className="cards-detail-controls">
          <div className="year-picker cards-year-picker">
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
          <button
            className="ghost-button"
            onClick={() => navigate("/categories", { state: { year: reportYear } })}
          >
            Back to report
          </button>
        </div>
      </header>

      <section className="card report-card">
        <div className="card-header">
          <h3>Monthly spend</h3>
          <p>How this category trends through the year</p>
        </div>
        <div className="summary summary-inline detail-metrics">
          <div className="summary-card">
            <span className="label">Total spent</span>
            <strong>{formatMoney(totalSpend)}</strong>
          </div>
          <div className="summary-card">
            <span className="label">Avg monthly spend</span>
            <strong>{formatMoney(averageSpend)}</strong>
          </div>
          <div className="summary-card">
            <span className="label">Highest month</span>
            <strong>
              {highestMonth ? `${toMonthLabel(highestMonth.month)} · ${formatMoney(highestMonth.total)}` : "--"}
            </strong>
          </div>
          <div className="summary-card">
            <span className="label">Lowest month</span>
            <strong>
              {lowestMonth ? `${toMonthLabel(lowestMonth.month)} · ${formatMoney(lowestMonth.total)}` : "--"}
            </strong>
          </div>
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
              <CartesianGrid vertical={false} stroke="rgba(20, 19, 26, 0.12)" />
              <XAxis dataKey="label" />
              <YAxis
                tickFormatter={formatMoneyCompact}
                axisLine={false}
                tickLine={false}
                width={72}
                tickCount={5}
              />
              <Tooltip content={<TrendTooltip average={averageSpend} />} />
              <ReferenceLine
                y={averageSpend}
                stroke="#6a6775"
                strokeDasharray="4 4"
                label={{
                  value: `Avg ${formatMoneyCompact(averageSpend)}`,
                  position: "insideTopRight",
                  fill: "#6a6775",
                  fontSize: 12,
                }}
              />
              <Line
                type="monotone"
                dataKey="total"
                stroke="#3aa0ff"
                strokeWidth={3}
                dot={{ r: 3 }}
                activeDot={{ r: 5 }}
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
