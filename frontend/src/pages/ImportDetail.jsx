import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

const API_BASE = "http://localhost:8000";

function formatMoney(value, currency = "ILS") {
  return new Intl.NumberFormat("en-IL", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
  }).format(Number(value || 0));
}

export default function ImportDetail() {
  const { importId } = useParams();
  const navigate = useNavigate();
  const [transactions, setTransactions] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        const response = await fetch(
          `${API_BASE}/transactions?import_batch_id=${importId}&limit=200`
        );
        if (!response.ok) {
          throw new Error("Failed to load import transactions");
        }
        const payload = await response.json();
        setTransactions(payload.items ?? []);
        setTotal(payload.total ?? 0);
        setError("");
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [importId]);

  return (
    <div className="report-page">
      <header className="page-header">
        <div>
          <h1>Import batch {importId}</h1>
          <p>{total} transactions</p>
        </div>
        <button className="ghost-button" onClick={() => navigate(-1)}>
          Back
        </button>
      </header>

      <section className="card report-card">
        <div className="table">
          <div className="table-row table-head">
            <span>Date</span>
            <span>Merchant</span>
            <span>Category</span>
            <span className="amount">Amount</span>
          </div>
          {transactions.map((tx) => (
            <div className="table-row" key={tx.id}>
              <span>{new Date(tx.transaction_date).toLocaleDateString("en-GB")}</span>
              <span className="merchant">{tx.merchant_raw}</span>
              <span className="category">{tx.category_name || "Uncategorized"}</span>
              <span className="amount">{formatMoney(tx.amount, tx.currency)}</span>
            </div>
          ))}
        </div>
      </section>

      <div className="status-bar">
        {loading && <span className="pill">Loading transactions</span>}
        {error && <span className="pill error">{error}</span>}
      </div>
    </div>
  );
}
