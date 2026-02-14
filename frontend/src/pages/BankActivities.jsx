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

const EXPORT_COLUMNS = [
  { key: "activity_date", label: "Activity date" },
  { key: "value_date", label: "Value date" },
  { key: "description", label: "Description" },
  { key: "reference", label: "Reference" },
  { key: "payee", label: "Payee" },
  { key: "category", label: "Category" },
  { key: "debit", label: "Debit" },
  { key: "credit", label: "Credit" },
  { key: "balance", label: "Balance" },
  { key: "currency", label: "Currency" },
  { key: "direction", label: "Direction" },
  { key: "raw_category_text", label: "Raw category" },
  { key: "manual_override", label: "Manual override" },
  { key: "source_filename", label: "Source file" },
];

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
  const [exportOpen, setExportOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState("");
  const [exportOptions, setExportOptions] = useState({
    scope: "filtered",
    from: "",
    to: "",
    q: "",
    categoryId: "",
    direction: "",
    filename: "",
    includeSummary: true,
    includeByCategory: true,
    includeByPayee: true,
    includeMonthlyTrend: true,
    columns: EXPORT_COLUMNS.map((item) => item.key),
  });

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

  function openExportModal() {
    setExportOptions((prev) => ({
      ...prev,
      scope: "filtered",
      from: filters.from,
      to: filters.to,
      q: filters.q,
      categoryId: filters.categoryId,
      direction: filters.direction,
      filename: "",
    }));
    setExportError("");
    setExportOpen(true);
  }

  function toggleExportColumn(columnKey) {
    setExportOptions((prev) => {
      const hasColumn = prev.columns.includes(columnKey);
      if (hasColumn) {
        if (prev.columns.length === 1) {
          return prev;
        }
        return {
          ...prev,
          columns: prev.columns.filter((key) => key !== columnKey),
        };
      }
      return { ...prev, columns: [...prev.columns, columnKey] };
    });
  }

  async function runExport() {
    try {
      setExporting(true);
      setExportError("");
      const payload = {
        scope: exportOptions.scope,
        date_from: exportOptions.scope === "filtered" ? exportOptions.from || null : null,
        date_to: exportOptions.scope === "filtered" ? exportOptions.to || null : null,
        q: exportOptions.scope === "filtered" ? exportOptions.q || null : null,
        category_id:
          exportOptions.scope === "filtered" && exportOptions.categoryId
            ? Number(exportOptions.categoryId)
            : null,
        direction:
          exportOptions.scope === "filtered" ? exportOptions.direction || null : null,
        filename: exportOptions.filename || null,
        include_summary: exportOptions.includeSummary,
        include_by_category: exportOptions.includeByCategory,
        include_by_payee: exportOptions.includeByPayee,
        include_monthly_trend: exportOptions.includeMonthlyTrend,
        columns: exportOptions.columns,
      };

      const response = await fetch(`${API_BASE}/bank/activities/export`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        throw new Error("Failed to generate export");
      }

      const blob = await response.blob();
      const disposition = response.headers.get("Content-Disposition") || "";
      const match = disposition.match(/filename=\"?([^\";]+)\"?/i);
      const filename = match?.[1] || "bank_activities_export.xlsx";

      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      setExportOpen(false);
    } catch (err) {
      setExportError(err.message);
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="report-page">
      <header className="page-header">
        <div>
          <h1>Bank activities</h1>
          <p>Search, filter, and update categories across all activities.</p>
        </div>
        <button className="ghost-button" onClick={openExportModal}>
          Export Excel
        </button>
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

      {exportOpen && (
        <div className="modal-overlay" onClick={() => setExportOpen(false)}>
          <div className="modal-card export-modal" onClick={(event) => event.stopPropagation()}>
            <div className="card-header">
              <h3>Export bank activities</h3>
              <button className="ghost-button" onClick={() => setExportOpen(false)}>
                Close
              </button>
            </div>
            <div className="filter-grid export-grid">
              <label>
                Scope
                <select
                  value={exportOptions.scope}
                  onChange={(event) =>
                    setExportOptions((prev) => ({ ...prev, scope: event.target.value }))
                  }
                >
                  <option value="filtered">Current filters</option>
                  <option value="all">All activities</option>
                </select>
              </label>
              <label>
                Filename
                <input
                  type="text"
                  placeholder="bank_activities_export.xlsx"
                  value={exportOptions.filename}
                  onChange={(event) =>
                    setExportOptions((prev) => ({ ...prev, filename: event.target.value }))
                  }
                />
              </label>
              <label>
                From
                <input
                  type="date"
                  value={exportOptions.from}
                  disabled={exportOptions.scope === "all"}
                  onChange={(event) =>
                    setExportOptions((prev) => ({ ...prev, from: event.target.value }))
                  }
                />
              </label>
              <label>
                To
                <input
                  type="date"
                  value={exportOptions.to}
                  disabled={exportOptions.scope === "all"}
                  onChange={(event) =>
                    setExportOptions((prev) => ({ ...prev, to: event.target.value }))
                  }
                />
              </label>
              <label>
                Search
                <input
                  type="text"
                  placeholder="Description, payee, reference"
                  value={exportOptions.q}
                  disabled={exportOptions.scope === "all"}
                  onChange={(event) =>
                    setExportOptions((prev) => ({ ...prev, q: event.target.value }))
                  }
                />
              </label>
              <label>
                Category
                <select
                  value={exportOptions.categoryId}
                  disabled={exportOptions.scope === "all"}
                  onChange={(event) =>
                    setExportOptions((prev) => ({ ...prev, categoryId: event.target.value }))
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
                  value={exportOptions.direction}
                  disabled={exportOptions.scope === "all"}
                  onChange={(event) =>
                    setExportOptions((prev) => ({ ...prev, direction: event.target.value }))
                  }
                >
                  <option value="">All</option>
                  <option value="income">Income</option>
                  <option value="expense">Expense</option>
                </select>
              </label>
            </div>

            <div className="export-section">
              <h4>Sheets</h4>
              <label className="export-check">
                <input
                  type="checkbox"
                  checked={exportOptions.includeSummary}
                  onChange={(event) =>
                    setExportOptions((prev) => ({
                      ...prev,
                      includeSummary: event.target.checked,
                    }))
                  }
                />
                Summary
              </label>
              <label className="export-check">
                <input
                  type="checkbox"
                  checked={exportOptions.includeByCategory}
                  onChange={(event) =>
                    setExportOptions((prev) => ({
                      ...prev,
                      includeByCategory: event.target.checked,
                    }))
                  }
                />
                By category
              </label>
              <label className="export-check">
                <input
                  type="checkbox"
                  checked={exportOptions.includeByPayee}
                  onChange={(event) =>
                    setExportOptions((prev) => ({
                      ...prev,
                      includeByPayee: event.target.checked,
                    }))
                  }
                />
                By payee
              </label>
              <label className="export-check">
                <input
                  type="checkbox"
                  checked={exportOptions.includeMonthlyTrend}
                  onChange={(event) =>
                    setExportOptions((prev) => ({
                      ...prev,
                      includeMonthlyTrend: event.target.checked,
                    }))
                  }
                />
                Monthly trend
              </label>
            </div>

            <div className="export-section">
              <h4>Columns</h4>
              <div className="export-columns">
                {EXPORT_COLUMNS.map((column) => (
                  <label className="export-check" key={column.key}>
                    <input
                      type="checkbox"
                      checked={exportOptions.columns.includes(column.key)}
                      onChange={() => toggleExportColumn(column.key)}
                    />
                    {column.label}
                  </label>
                ))}
              </div>
            </div>
            {exportError && <span className="pill error">{exportError}</span>}
            <div className="export-actions">
              <button className="ghost-button" onClick={() => setExportOpen(false)}>
                Cancel
              </button>
              <button className="ghost-button" disabled={exporting} onClick={runExport}>
                {exporting ? "Generating..." : "Generate export"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
