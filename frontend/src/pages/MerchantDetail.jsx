import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import {
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const API_BASE = "http://localhost:8000";
const REPORT_YEAR_KEY = "reports:year";

function readStoredYear() {
  const stored = Number(window.sessionStorage.getItem(REPORT_YEAR_KEY));
  return Number.isFinite(stored) ? stored : null;
}

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
  const location = useLocation();
  const initialReportYear = useMemo(() => {
    const stateYear = Number(location.state?.year);
    const storedYear = readStoredYear();
    if (Number.isFinite(stateYear)) {
      return stateYear;
    }
    if (Number.isFinite(storedYear)) {
      return storedYear;
    }
    return new Date().getFullYear();
  }, [location.state?.year]);
  const [year, setYear] = useState(initialReportYear);
  const [reportYear] = useState(initialReportYear);
  const [years, setYears] = useState([]);
  const [data, setData] = useState(null);
  const [selectedMonth, setSelectedMonth] = useState(null);
  const [monthTransactions, setMonthTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [popupError, setPopupError] = useState("");

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
    if (Number.isFinite(year)) {
      window.sessionStorage.setItem(REPORT_YEAR_KEY, String(year));
    }
  }, [year]);

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

  useEffect(() => {
    async function loadMonthTransactions() {
      if (!selectedMonth || !merchantId) {
        return;
      }
      try {
        const [selectedYear, selectedMonthValue] = selectedMonth.split("-");
        const response = await fetch(
          `${API_BASE}/transactions/merchant-month?merchant_id=${merchantId}&year=${selectedYear}&month=${selectedMonthValue}`
        );
        if (!response.ok) {
          throw new Error("Failed to load transactions");
        }
        const payload = await response.json();
        setMonthTransactions(payload.items ?? []);
        setPopupError("");
      } catch (err) {
        setPopupError(err.message);
      }
    }

    loadMonthTransactions();
  }, [selectedMonth, merchantId]);

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
        <button
          className="ghost-button"
          onClick={() => navigate("/merchants", { state: { year: reportYear } })}
        >
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
                stroke="#ff8a4b"
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
              <h3>Transactions in {selectedMonth}</h3>
              <button
                className="ghost-button"
                onClick={() => setSelectedMonth(null)}
              >
                Close
              </button>
            </div>
            {popupError && <span className="pill error">{popupError}</span>}
            <div className="detail-list">
              {monthTransactions.map((tx) => (
                <div className="detail-row" key={tx.id}>
                  <span>
                    {new Date(tx.transaction_date).toLocaleDateString("en-GB")}
                    {tx.posting_date
                      ? ` · billed ${new Date(tx.posting_date).toLocaleDateString("en-GB")}`
                      : ""}{" "}
                    · {tx.merchant_raw}
                  </span>
                  <strong>
                    {formatMoney(tx.charged_amount ?? tx.amount)}
                  </strong>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="status-bar">
        {loading && <span className="pill">Loading merchant detail</span>}
        {error && <span className="pill error">{error}</span>}
      </div>
    </div>
  );
}
