import { useEffect, useMemo, useState } from "react";

const API_BASE = "http://localhost:8000";
const pageSize = 50;
const EXPORT_COLUMNS = [
  { key: "transaction_date", label: "Date" },
  { key: "posting_date", label: "Billed date" },
  { key: "billed_month", label: "Billed month" },
  { key: "merchant_raw", label: "Merchant (raw)" },
  { key: "merchant_display", label: "Merchant" },
  { key: "category", label: "Category" },
  { key: "manual_override", label: "Manual override" },
  { key: "transaction_amount", label: "Amount (original)" },
  { key: "transaction_currency", label: "Original currency" },
  { key: "charged_amount", label: "Amount (charged)" },
  { key: "charged_currency", label: "Charged currency" },
  { key: "effective_amount", label: "Amount (selected mode)" },
  { key: "effective_currency", label: "Selected currency" },
  { key: "card_account", label: "Card account" },
  { key: "source_filename", label: "Source file" },
  { key: "transaction_id", label: "Transaction id" },
];

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
  const [exportOpen, setExportOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState("");
  const [exportOptions, setExportOptions] = useState({
    scope: "filtered",
    from: "",
    to: "",
    q: "",
    categoryId: "",
    currencyMode: "charged",
    filename: "",
    includeSummary: true,
    includeMonthlyTrend: true,
    includeByCategory: true,
    includeByMerchant: true,
    includeBillingCycle: true,
    includeExceptions: true,
    columns: EXPORT_COLUMNS.map((item) => item.key),
  });

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

  function openExportModal() {
    setExportOptions((prev) => ({
      ...prev,
      scope: "filtered",
      from: filters.from,
      to: filters.to,
      q: filters.q,
      categoryId: filters.categoryId,
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
        currency_mode: exportOptions.currencyMode,
        filename: exportOptions.filename || null,
        include_summary: exportOptions.includeSummary,
        include_monthly_trend: exportOptions.includeMonthlyTrend,
        include_by_category: exportOptions.includeByCategory,
        include_by_merchant: exportOptions.includeByMerchant,
        include_billing_cycle: exportOptions.includeBillingCycle,
        include_exceptions: exportOptions.includeExceptions,
        columns: exportOptions.columns,
      };

      const response = await fetch(`${API_BASE}/transactions/export`, {
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
      const filename = match?.[1] || "card_transactions_export.xlsx";

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
          <h1>Card transactions</h1>
          <p>Search, filter, and update categories across all transactions.</p>
        </div>
        <button className="ghost-button" onClick={openExportModal}>
          Export Excel
        </button>
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
        <div className="table transactions-table">
          <div className="table-row table-head">
            <span>Date</span>
            <span>Billed</span>
            <span>Merchant</span>
            <span>Category</span>
            <span className="amount">Amount</span>
            <span className="amount">Charged</span>
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
                <span>
                  {transaction.posting_date
                    ? dateFormatter.format(new Date(transaction.posting_date))
                    : "--"}
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
                <span className="amount">
                  {transaction.charged_amount != null
                    ? formatMoney(transaction.charged_amount, transaction.charged_currency)
                    : "--"}
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

      {exportOpen && (
        <div className="modal-overlay" onClick={() => setExportOpen(false)}>
          <div className="modal-card export-modal" onClick={(event) => event.stopPropagation()}>
            <div className="card-header">
              <h3>Export card transactions</h3>
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
                  <option value="all">All transactions</option>
                </select>
              </label>
              <label>
                Currency mode
                <select
                  value={exportOptions.currencyMode}
                  onChange={(event) =>
                    setExportOptions((prev) => ({
                      ...prev,
                      currencyMode: event.target.value,
                    }))
                  }
                >
                  <option value="charged">Charged (fallback to original)</option>
                  <option value="original">Original transaction</option>
                  <option value="both">Both (summary uses charged fallback)</option>
                </select>
              </label>
              <label>
                Filename
                <input
                  type="text"
                  placeholder="card_transactions_export.xlsx"
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
                  placeholder="Merchant name or description"
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
                  checked={exportOptions.includeByMerchant}
                  onChange={(event) =>
                    setExportOptions((prev) => ({
                      ...prev,
                      includeByMerchant: event.target.checked,
                    }))
                  }
                />
                By merchant
              </label>
              <label className="export-check">
                <input
                  type="checkbox"
                  checked={exportOptions.includeBillingCycle}
                  onChange={(event) =>
                    setExportOptions((prev) => ({
                      ...prev,
                      includeBillingCycle: event.target.checked,
                    }))
                  }
                />
                Billing cycles
              </label>
              <label className="export-check">
                <input
                  type="checkbox"
                  checked={exportOptions.includeExceptions}
                  onChange={(event) =>
                    setExportOptions((prev) => ({
                      ...prev,
                      includeExceptions: event.target.checked,
                    }))
                  }
                />
                Exceptions
              </label>
            </div>

            <div className="export-section">
              <h4>Transactions sheet columns</h4>
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
              <button
                className="ghost-button"
                disabled={exporting}
                onClick={() => setExportOpen(false)}
              >
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
