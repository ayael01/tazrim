import { useEffect, useMemo, useState } from "react";

const API_BASE = "http://localhost:8000";

const currencyFormatter = new Intl.NumberFormat("en-IL", {
  style: "currency",
  currency: "ILS",
  minimumFractionDigits: 2,
});

const dateFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

function formatMoney(amount, currency) {
  if (amount == null) {
    return "";
  }

  try {
    return new Intl.NumberFormat("en-IL", {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
    }).format(Number(amount));
  } catch (error) {
    return `${amount} ${currency}`;
  }
}

export default function App() {
  const [transactions, setTransactions] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");

  useEffect(() => {
    let active = true;

    async function loadTransactions() {
      try {
        setLoading(true);
        const response = await fetch(`${API_BASE}/transactions?limit=500`);
        if (!response.ok) {
          throw new Error(`Failed to load transactions (${response.status})`);
        }
        const payload = await response.json();
        if (!active) {
          return;
        }
        setTransactions(payload.items ?? []);
        setTotal(payload.total ?? 0);
        setError("");
      } catch (err) {
        if (!active) {
          return;
        }
        setError(err.message);
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    loadTransactions();
    return () => {
      active = false;
    };
  }, []);

  const filtered = useMemo(() => {
    if (!query) {
      return transactions;
    }
    const lowered = query.toLowerCase();
    return transactions.filter((tx) => {
      const merchant = (tx.merchant_raw || "").toLowerCase();
      const category = (tx.category_name || "").toLowerCase();
      return merchant.includes(lowered) || category.includes(lowered);
    });
  }, [query, transactions]);

  const visibleTotal = filtered.length;
  const totalAmount = filtered.reduce((sum, tx) => sum + Number(tx.amount || 0), 0);

  return (
    <div className="app">
      <div className="background-orb orb-1" />
      <div className="background-orb orb-2" />
      <div className="background-orb orb-3" />

      <header className="hero">
        <div>
          <p className="eyebrow">Tazrim</p>
          <h1>Family spending, finally readable.</h1>
          <p className="subtitle">
            All your credit card history in one clean view. Filter, scan, and spot
            patterns without wrestling with spreadsheets.
          </p>
        </div>
        <div className="summary">
          <div className="summary-card">
            <span className="label">Total rows</span>
            <strong>{total.toLocaleString()}</strong>
          </div>
          <div className="summary-card">
            <span className="label">Visible rows</span>
            <strong>{visibleTotal.toLocaleString()}</strong>
          </div>
          <div className="summary-card">
            <span className="label">Visible spend</span>
            <strong>{currencyFormatter.format(totalAmount)}</strong>
          </div>
        </div>
      </header>

      <section className="controls">
        <div className="search">
          <input
            type="text"
            placeholder="Search merchant or category"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
        <div className="status">
          {loading && <span className="pill">Loading data</span>}
          {error && <span className="pill error">{error}</span>}
        </div>
      </section>

      <section className="table-card">
        <div className="table-header">
          <h2>Latest transactions</h2>
          <p>Showing the newest entries first</p>
        </div>
        <div className="table">
          <div className="table-row table-head">
            <span>Date</span>
            <span>Merchant</span>
            <span>Category</span>
            <span className="amount">Amount</span>
            <span className="amount">Charged</span>
          </div>
          {filtered.map((tx) => (
            <div className="table-row" key={tx.id}>
              <span>{dateFormatter.format(new Date(tx.transaction_date))}</span>
              <span className="merchant">{tx.merchant_raw}</span>
              <span className="category">{tx.category_name || "Uncategorized"}</span>
              <span className="amount">
                {formatMoney(tx.amount, tx.currency)}
              </span>
              <span className="amount muted">
                {tx.charged_amount
                  ? formatMoney(tx.charged_amount, tx.charged_currency || tx.currency)
                  : "--"}
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
