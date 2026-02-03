import { useEffect, useMemo, useState } from "react";

const API_BASE = "http://localhost:8000";
const pageSize = 50;

const dateFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

function formatMoney(value, currency) {
  const formatter = new Intl.NumberFormat("en-IL", {
    style: "currency",
    currency: currency || "ILS",
    minimumFractionDigits: 0,
  });
  return formatter.format(Number(value || 0));
}

export default function CardTransactions() {
  const [filters, setFilters] = useState({
    from: "",
    to: "",
    q: "",
    categoryId: "",
  });
  const [categories, setCategories] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [offset, setOffset] = useState(0);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [savingId, setSavingId] = useState(null);

  const hasMore = transactions.length < total;

  const categoryOptions = useMemo(
    () => categories.map((cat) => ({ id: String(cat.id), name: cat.name })),
    [categories]
  );

  useEffect(() => {
    async function loadCategories() {
      const response = await fetch(`${API_BASE}/categories`);
      if (!response.ok) {
        return;
      }
      const payload = await response.json();
      setCategories(payload ?? []);
    }
    loadCategories();
  }, []);

  useEffect(() => {
    setOffset(0);
    setTransactions([]);
  }, [filters]);

  useEffect(() => {
    async function loadTransactions() {
      try {
        setLoading(true);
        const params = new URLSearchParams();
        params.set("limit", String(pageSize));
        params.set("offset", String(offset));
        if (filters.from) {
          params.set("date_from", filters.from);
        }
        if (filters.to) {
          params.set("date_to", filters.to);
        }
        if (filters.q) {
          params.set("q", filters.q);
        }
        if (filters.categoryId) {
          params.set("category_id", filters.categoryId);
        }

        const response = await fetch(`${API_BASE}/transactions?${params}`);
        if (!response.ok) {
          throw new Error("Failed to load transactions");
        }
        const payload = await response.json();
        setTotal(payload.total ?? 0);
        setTransactions((prev) =>
          offset === 0 ? payload.items ?? [] : [...prev, ...(payload.items ?? [])]
        );
        setError("");
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    loadTransactions();
  }, [filters, offset]);

  async function updateCategory(transaction, value) {
    const nextValue = value === "default" ? null : value ? Number(value) : null;
    if (nextValue === transaction.manual_category_id) {
      return;
    }
    try {
      setSavingId(transaction.id);
      const response = await fetch(`${API_BASE}/transactions/${transaction.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category_id: nextValue }),
      });
      if (!response.ok) {
        throw new Error("Failed to update category");
      }
      const updated = await response.json();
      setTransactions((prev) =>
        prev.map((item) => (item.id === updated.id ? updated : item))
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingId(null);
    }
  }

  return (
    <div className="report-page">
      <header className="page-header">
        <div>
          <h1>Card transactions</h1>
          <p>Search, filter, and update categories across all transactions.</p>
        </div>
      </header>

      <section className="card report-card">
        <div className="card-header">
          <h3>Filters</h3>
          <p>Refine by date, merchant, or category</p>
        </div>
        <div className="filter-grid">
          <label>
            From
            <input
              type="date"
              value={filters.from}
              onChange={(event) =>
                setFilters((prev) => ({ ...prev, from: event.target.value }))
              }
            />
          </label>
          <label>
            To
            <input
              type="date"
              value={filters.to}
              onChange={(event) =>
                setFilters((prev) => ({ ...prev, to: event.target.value }))
              }
            />
          </label>
          <label>
            Search
            <input
              type="text"
              placeholder="Merchant name or description"
              value={filters.q}
              onChange={(event) =>
                setFilters((prev) => ({ ...prev, q: event.target.value }))
              }
            />
          </label>
          <label>
            Category
            <select
              value={filters.categoryId}
              onChange={(event) =>
                setFilters((prev) => ({ ...prev, categoryId: event.target.value }))
              }
            >
              <option value="">All categories</option>
              {categoryOptions.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      <section className="card table-card">
        <div className="card-header">
          <h3>Transactions</h3>
          <p>
            Showing {transactions.length} of {total}
          </p>
        </div>
        <div className="table">
          <div className="table-row table-head">
            <span>Date</span>
            <span>Merchant</span>
            <span>Category</span>
            <span className="amount">Amount</span>
          </div>
          {transactions.map((transaction) => {
            const value = transaction.manual_category_id
              ? String(transaction.manual_category_id)
              : "default";
            return (
              <div className="table-row" key={transaction.id}>
                <span>
                  {dateFormatter.format(new Date(transaction.transaction_date))}
                </span>
                <span className="merchant">{transaction.merchant_raw}</span>
                <span className="category">
                  <select
                    className="category-select"
                    value={value}
                    disabled={savingId === transaction.id}
                    onChange={(event) =>
                      updateCategory(transaction, event.target.value)
                    }
                  >
                    <option value="default">
                      {transaction.category_name || "Uncategorized"}
                    </option>
                    {categoryOptions.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name}
                      </option>
                    ))}
                  </select>
                </span>
                <span className="amount">
                  {formatMoney(transaction.amount, transaction.currency)}
                </span>
              </div>
            );
          })}
        </div>
        {hasMore && (
          <div className="load-more">
            <button
              className="ghost-button"
              disabled={loading}
              onClick={() => setOffset((prev) => prev + pageSize)}
            >
              {loading ? "Loading..." : "Load more"}
            </button>
          </div>
        )}
      </section>

      <div className="status-bar">
        {loading && <span className="pill">Loading transactions</span>}
        {error && <span className="pill error">{error}</span>}
      </div>
    </div>
  );
}
