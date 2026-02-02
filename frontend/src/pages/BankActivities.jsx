import { useEffect, useMemo, useState } from "react";

const API_BASE = "http://localhost:8000";
const pageSize = 50;

const dateFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

const currencyFormatter = new Intl.NumberFormat("en-IL", {
  style: "currency",
  currency: "ILS",
  minimumFractionDigits: 0,
});

function formatMoney(value) {
  return currencyFormatter.format(Number(value || 0));
}

export default function BankActivities() {
  const [filters, setFilters] = useState({
    from: "",
    to: "",
    q: "",
    categoryId: "",
    direction: "",
  });
  const [categories, setCategories] = useState([]);
  const [activities, setActivities] = useState([]);
  const [offset, setOffset] = useState(0);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [savingId, setSavingId] = useState(null);

  const hasMore = activities.length < total;

  const categoryOptions = useMemo(
    () => categories.map((cat) => ({ id: String(cat.id), name: cat.name })),
    [categories]
  );

  useEffect(() => {
    async function loadCategories() {
      const response = await fetch(`${API_BASE}/bank/categories`);
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
    setActivities([]);
  }, [filters]);

  useEffect(() => {
    async function loadActivities() {
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
        if (filters.direction) {
          params.set("direction", filters.direction);
        }

        const response = await fetch(`${API_BASE}/bank/activities?${params}`);
        if (!response.ok) {
          throw new Error("Failed to load activities");
        }
        const payload = await response.json();
        setTotal(payload.total ?? 0);
        setActivities((prev) =>
          offset === 0 ? payload.items ?? [] : [...prev, ...(payload.items ?? [])]
        );
        setError("");
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    loadActivities();
  }, [filters, offset]);

  async function updateCategory(activity, value) {
    const nextValue = value === "raw" ? null : value ? Number(value) : null;
    if (nextValue === activity.category_id) {
      return;
    }
    try {
      setSavingId(activity.id);
      const response = await fetch(`${API_BASE}/bank/activities/${activity.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category_id: nextValue }),
      });
      if (!response.ok) {
        throw new Error("Failed to update category");
      }
      const updated = await response.json();
      setActivities((prev) =>
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
          <h1>Bank activities</h1>
          <p>Search, filter, and update categories across all activities.</p>
        </div>
      </header>

      <section className="card report-card">
        <div className="card-header">
          <h3>Filters</h3>
          <p>Refine by date, description, category, or direction</p>
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
              placeholder="Description, payee, reference"
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
          <label>
            Direction
            <select
              value={filters.direction}
              onChange={(event) =>
                setFilters((prev) => ({ ...prev, direction: event.target.value }))
              }
            >
              <option value="">All</option>
              <option value="income">Income</option>
              <option value="expense">Expense</option>
            </select>
          </label>
        </div>
      </section>

      <section className="card table-card">
        <div className="card-header">
          <h3>Activities</h3>
          <p>
            Showing {activities.length} of {total}
          </p>
        </div>
        <div className="table">
          <div className="table-row table-head">
            <span>Date</span>
            <span>Description</span>
            <span>Category</span>
            <span className="amount">Amount</span>
          </div>
          {activities.map((activity) => {
            const value =
              activity.category_id !== null && activity.category_id !== undefined
                ? String(activity.category_id)
                : "raw";
            return (
              <div className="table-row" key={activity.id}>
                <span>{dateFormatter.format(new Date(activity.activity_date))}</span>
                <span className="merchant">{activity.description}</span>
                <span className="category">
                  <select
                    className="category-select"
                    value={value}
                    disabled={savingId === activity.id}
                    onChange={(event) => updateCategory(activity, event.target.value)}
                  >
                    <option value="raw">
                      {activity.category_name || "Uncategorized"}
                    </option>
                    <option value="">Uncategorized</option>
                    {categoryOptions.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name}
                      </option>
                    ))}
                  </select>
                </span>
                <span className="amount">
                  {formatMoney(activity.debit ?? activity.credit)}
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
        {loading && <span className="pill">Loading activities</span>}
        {error && <span className="pill error">{error}</span>}
      </div>
    </div>
  );
}
