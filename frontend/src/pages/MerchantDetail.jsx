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

export default function MerchantDetail() {
  const { merchantId } = useParams();
  const navigate = useNavigate();
  const [year, setYear] = useState(new Date().getFullYear());
  const [years, setYears] = useState([]);
  const [data, setData] = useState(null);
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
    async function loadDetail() {
      if (!merchantId) {
        return;
      }
      try {
        setLoading(true);
        const response = await fetch(
          `${API_BASE}/reports/merchant-detail?merchant_id=${merchantId}&year=${year}`
        );
        if (!response.ok) {
          throw new Error("Failed to load merchant detail");
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
  }, [merchantId, year]);

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
          <h1>{data?.merchant_name || "Merchant detail"}</h1>
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
          <p>How this merchant trends through the year</p>
        </div>
        <div className="chart">
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={chartData}>
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
      </section>

      <div className="status-bar">
        {loading && <span className="pill">Loading merchant detail</span>}
        {error && <span className="pill error">{error}</span>}
      </div>
    </div>
  );
}
