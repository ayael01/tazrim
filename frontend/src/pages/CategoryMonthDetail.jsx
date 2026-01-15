import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

const API_BASE = "http://localhost:8000";

function formatMoney(value) {
  return new Intl.NumberFormat("en-IL", {
    style: "currency",
    currency: "ILS",
    minimumFractionDigits: 0,
  }).format(Number(value || 0));
}

function parseMonthParam(value) {
  if (!value) {
    return { year: null, month: null };
  }
  const [yearStr, monthStr] = value.split("-");
  return {
    year: Number(yearStr),
    month: Number(monthStr),
  };
}

export default function CategoryMonthDetail() {
  const { month } = useParams();
  const navigate = useNavigate();
  const { year, month: monthNumber } = parseMonthParam(month);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadDetail() {
      if (!year || !monthNumber) {
        return;
      }
      try {
        setLoading(true);
        const response = await fetch(
          `${API_BASE}/reports/category-month?year=${year}&month=${monthNumber}`
        );
        if (!response.ok) {
          throw new Error("Failed to load month detail");
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
  }, [year, monthNumber]);

  return (
    <div className="report-page">
      <header className="page-header">
        <div>
          <h1>Month details</h1>
          <p>Category → merchant breakdown for {data?.month ?? month}</p>
        </div>
        <button className="ghost-button" onClick={() => navigate(-1)}>
          Back to report
        </button>
      </header>

      {loading && <span className="pill">Loading month detail</span>}
      {error && <span className="pill error">{error}</span>}

      {data && (
        <section className="detail-grid">
          {data.categories.map((category) => (
            <div className="card detail-card" key={category.name}>
              <div className="card-header">
                <h3>{category.name}</h3>
                <strong>{formatMoney(category.total)}</strong>
              </div>
              <div className="detail-list">
                {category.merchants.map((merchant) => (
                  <div className="detail-row" key={merchant.name}>
                    <span>{merchant.name}</span>
                    <strong>{formatMoney(merchant.total)}</strong>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
