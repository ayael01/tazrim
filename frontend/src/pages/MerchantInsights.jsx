import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

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

export default function MerchantInsights() {
  const navigate = useNavigate();
  const location = useLocation();
  const initialFilters = useMemo(
    () => ({
      minBills: location.state?.filters?.minBills ?? "",
      maxBills: location.state?.filters?.maxBills ?? "",
      minTotal: location.state?.filters?.minTotal ?? "",
      maxTotal: location.state?.filters?.maxTotal ?? "",
      q: location.state?.filters?.q ?? "",
      categoryId: location.state?.filters?.categoryId ?? "",
    }),
    [location.state?.filters]
  );
  const [year, setYear] = useState(() => {
    const stateYear = Number(location.state?.year);
    if (Number.isFinite(stateYear)) {
      return stateYear;
    }
    return readStoredYear() || new Date().getFullYear();
  });
  const [years, setYears] = useState([]);
  const [categories, setCategories] = useState([]);
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filters, setFilters] = useState(initialFilters);

  const categoryOptions = useMemo(
    () => categories.map((cat) => ({ id: String(cat.id), name: cat.name })),
    [categories]
  );

  useEffect(() => {
    async function loadStaticData() {
      const [yearsRes, categoriesRes] = await Promise.all([
        fetch(`${API_BASE}/reports/years`),
        fetch(`${API_BASE}/categories`),
      ]);
      if (yearsRes.ok) {
        const yearsPayload = await yearsRes.json();
        const available = yearsPayload.years || [];
        setYears(available);
        if (available.length && !available.includes(year)) {
          setYear(available[available.length - 1]);
        }
      }
      if (categoriesRes.ok) {
        const categoriesPayload = await categoriesRes.json();
        setCategories(categoriesPayload ?? []);
      }
    }
    loadStaticData();
  }, []);

  useEffect(() => {
    if (Number.isFinite(year)) {
      window.sessionStorage.setItem(REPORT_YEAR_KEY, String(year));
    }
  }, [year]);

  useEffect(() => {
    async function loadInsights() {
      try {
        setLoading(true);
        const params = new URLSearchParams();
        params.set("year", String(year));
        params.set("limit", "500");
        if (filters.minBills) {
          params.set("min_bills", filters.minBills);
        }
        if (filters.maxBills) {
          params.set("max_bills", filters.maxBills);
        }
        if (filters.minTotal) {
          params.set("min_total", filters.minTotal);
        }
        if (filters.maxTotal) {
          params.set("max_total", filters.maxTotal);
        }
        if (filters.q) {
          params.set("q", filters.q);
        }
        if (filters.categoryId) {
          params.set("category_id", filters.categoryId);
        }

        const response = await fetch(`${API_BASE}/reports/merchant-insights?${params}`);
        if (!response.ok) {
          throw new Error("Failed to load merchant insights");
        }
        const payload = await response.json();
        setItems(payload.items ?? []);
        setTotal(payload.total ?? 0);
        setError("");
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    loadInsights();
  }, [year, filters]);

  function applyPresetRecurring() {
    setFilters((prev) => ({
      ...prev,
      minBills: "12",
      maxBills: "12",
    }));
  }

  function applyPresetRange5000to8000() {
    setFilters((prev) => ({
      ...prev,
      minTotal: "5000",
      maxTotal: "8000",
    }));
  }

  function clearFilters() {
    setFilters({
      minBills: "",
      maxBills: "",
      minTotal: "",
      maxTotal: "",
      q: "",
      categoryId: "",
    });
  }

  return (
    <div className="report-page">
      <header className="page-header cards-report-header">
        <div className="cards-report-header-main">
          <h1>Merchant insights</h1>
          <p>Find recurring merchants and spend ranges with flexible filters.</p>
        </div>
        <div className="cards-report-controls">
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
        </div>
      </header>

      <section className="card report-card">
        <div className="card-header">
          <h3>Filters</h3>
          <p>Recurring bills, spend range, category, and search</p>
        </div>
        <div className="filter-grid">
          <label>
            Min bills
            <input
              type="number"
              min="0"
              max="12"
              value={filters.minBills}
              onChange={(event) =>
                setFilters((prev) => ({ ...prev, minBills: event.target.value }))
              }
            />
          </label>
          <label>
            Max bills
            <input
              type="number"
              min="0"
              max="12"
              value={filters.maxBills}
              onChange={(event) =>
                setFilters((prev) => ({ ...prev, maxBills: event.target.value }))
              }
            />
          </label>
          <label>
            Min total (ILS)
            <input
              type="number"
              min="0"
              value={filters.minTotal}
              onChange={(event) =>
                setFilters((prev) => ({ ...prev, minTotal: event.target.value }))
              }
            />
          </label>
          <label>
            Max total (ILS)
            <input
              type="number"
              min="0"
              value={filters.maxTotal}
              onChange={(event) =>
                setFilters((prev) => ({ ...prev, maxTotal: event.target.value }))
              }
            />
          </label>
          <label>
            Search merchant
            <input
              type="text"
              placeholder="Merchant name"
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
        <div className="export-actions" style={{ marginTop: 12 }}>
          <button className="ghost-button" onClick={applyPresetRecurring}>
            Recurring (12 bills)
          </button>
          <button className="ghost-button" onClick={applyPresetRange5000to8000}>
            Spend 5,000-8,000
          </button>
          <button className="ghost-button" onClick={clearFilters}>
            Clear filters
          </button>
        </div>
      </section>

      <section className="card table-card">
        <div className="card-header">
          <h3>Matching merchants</h3>
          <p>
            Showing {items.length} of {total}
          </p>
        </div>
        <div className="table insights-table">
          <div className="table-row table-head">
            <span>Merchant</span>
            <span className="amount">Total spend</span>
            <span className="amount">Bills</span>
            <span className="amount">Avg / bill</span>
            <span>First bill</span>
            <span>Last bill</span>
          </div>
          {items.map((item) => (
            <div
              className={`table-row ${item.merchant_id ? "clickable-row" : ""}`}
              key={`${item.merchant_id ?? "raw"}-${item.merchant_name}`}
              onClick={() => {
                if (item.merchant_id) {
                  navigate(`/merchants/${item.merchant_id}`, {
                    state: {
                      year,
                      from: "/merchants/insights",
                      filters,
                    },
                  });
                }
              }}
            >
              <span className="merchant">{item.merchant_name}</span>
              <span className="amount">{formatMoney(item.total_spend)}</span>
              <span className="amount">{item.bills_count}</span>
              <span className="amount">{formatMoney(item.average_bill)}</span>
              <span>{item.first_bill_month || "--"}</span>
              <span>{item.last_bill_month || "--"}</span>
            </div>
          ))}
        </div>
      </section>

      <div className="status-bar">
        {loading && <span className="pill">Loading insights</span>}
        {error && <span className="pill error">{error}</span>}
      </div>
    </div>
  );
}
