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
  const [selectedMerchant, setSelectedMerchant] = useState(null);
  const [monthTransactions, setMonthTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [popupError, setPopupError] = useState("");

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

  useEffect(() => {
    async function loadTransactions() {
      if (!selectedMerchant || !year || !monthNumber) {
        return;
      }
      try {
        const params = new URLSearchParams({
          merchant_id: selectedMerchant.id,
          year,
          month: monthNumber,
        });
        const response = await fetch(
          `${API_BASE}/transactions/merchant-month?${params.toString()}`
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

    loadTransactions();
  }, [selectedMerchant, year, monthNumber]);

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
                  <div
                    className={`detail-row${merchant.id ? " clickable" : ""}`}
                    key={`${category.name}-${merchant.name}`}
                    onClick={() => {
                      if (!merchant.id) {
                        return;
                      }
                      setSelectedMerchant({ id: merchant.id, name: merchant.name });
                    }}
                    role={merchant.id ? "button" : undefined}
                    tabIndex={merchant.id ? 0 : undefined}
                    onKeyDown={(event) => {
                      if (!merchant.id) {
                        return;
                      }
                      if (event.key === "Enter" || event.key === " ") {
                        setSelectedMerchant({ id: merchant.id, name: merchant.name });
                      }
                    }}
                  >
                    <span>{merchant.name}</span>
                    <strong>{formatMoney(merchant.total)}</strong>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </section>
      )}

      {selectedMerchant && (
        <div className="modal-overlay" onClick={() => setSelectedMerchant(null)}>
          <div className="modal-card" onClick={(event) => event.stopPropagation()}>
            <div className="card-header">
              <h3>
                Transactions in {data?.month ?? month} · {selectedMerchant.name}
              </h3>
              <button
                className="ghost-button"
                onClick={() => setSelectedMerchant(null)}
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
                  <strong>{formatMoney(tx.charged_amount ?? tx.amount)}</strong>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
