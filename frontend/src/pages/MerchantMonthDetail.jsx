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

export default function MerchantMonthDetail() {
  const { month } = useParams();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [items, setItems] = useState([]);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [detailError, setDetailError] = useState("");

  useEffect(() => {
    setItems([]);
    setOffset(0);
    setHasMore(true);
  }, [query, month]);

  useEffect(() => {
    async function loadList() {
      if (!hasMore) {
        return;
      }
      try {
        setLoading(true);
        const [yearPart, monthPart] = month.split("-");
        const response = await fetch(
          `${API_BASE}/reports/merchant-month-list?year=${yearPart}&month=${monthPart}&q=${encodeURIComponent(query)}&limit=50&offset=${offset}`
        );
        if (!response.ok) {
          throw new Error("Failed to load merchants");
        }
        const payload = await response.json();
        const next = payload.items ?? [];
        setItems((prev) => [...prev, ...next]);
        setHasMore(next.length === 50);
        setError("");
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    if (month) {
      loadList();
    }
  }, [month, query, offset, hasMore]);

  useEffect(() => {
    async function loadTransactions() {
      if (!selected) {
        return;
      }
      try {
        const [yearPart, monthPart] = month.split("-");
        const response = await fetch(
          `${API_BASE}/transactions/merchant-month?merchant_id=${selected.id}&year=${yearPart}&month=${monthPart}`
        );
        if (!response.ok) {
          throw new Error("Failed to load transactions");
        }
        const payload = await response.json();
        setTransactions(payload.items ?? []);
        setDetailError("");
      } catch (err) {
        setDetailError(err.message);
      }
    }
    loadTransactions();
  }, [selected, month]);

  return (
    <div className="report-page">
      <header className="page-header">
        <div>
          <h1>Merchants in {month}</h1>
          <p>Sorted by spend for the selected month</p>
        </div>
        <button className="ghost-button" onClick={() => navigate(-1)}>
          Back to report
        </button>
      </header>

      <section className="card report-card">
        <div className="search">
          <input
            type="text"
            placeholder="Filter merchants by name"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
        <ul className="list selectable">
          {items.map((item) => (
            <li key={item.id} onClick={() => setSelected(item)}>
              <span>{item.name}</span>
              <strong>{formatMoney(item.total)}</strong>
            </li>
          ))}
        </ul>
        <div className="load-more">
          {hasMore && (
            <button
              className="ghost-button"
              disabled={loading}
              onClick={() => setOffset((prev) => prev + 50)}
            >
              {loading ? "Loading..." : "Load more"}
            </button>
          )}
        </div>
      </section>

      {selected && (
        <div className="modal-overlay" onClick={() => setSelected(null)}>
          <div className="modal-card" onClick={(event) => event.stopPropagation()}>
            <div className="card-header">
              <h3>{selected.name}</h3>
              <button className="ghost-button" onClick={() => setSelected(null)}>
                Close
              </button>
            </div>
            {detailError && <span className="pill error">{detailError}</span>}
            <div className="detail-list">
              {transactions.map((tx) => (
                <div className="detail-row" key={tx.id}>
                  <span>
                    {new Date(tx.transaction_date).toLocaleDateString("en-GB")} ·{" "}
                    {tx.merchant_raw}
                  </span>
                  <strong>{formatMoney(tx.charged_amount ?? tx.amount)}</strong>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="status-bar">
        {loading && <span className="pill">Loading merchants</span>}
        {error && <span className="pill error">{error}</span>}
      </div>
    </div>
  );
}
