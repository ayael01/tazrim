import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

const API_BASE = "http://localhost:8000";

const currencyFormatter = new Intl.NumberFormat("en-IL", {
  style: "currency",
  currency: "ILS",
  minimumFractionDigits: 0,
});

function formatMoney(value) {
  return currencyFormatter.format(Number(value || 0));
}

export default function BankImportDraftReview() {
  const { draftId } = useParams();
  const navigate = useNavigate();
  const [draft, setDraft] = useState(null);
  const [rows, setRows] = useState([]);
  const [totalRows, setTotalRows] = useState(0);
  const [categories, setCategories] = useState([]);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  const pageSize = 100;

  useEffect(() => {
    async function loadCategories() {
      try {
        const response = await fetch(`${API_BASE}/bank/categories?limit=2000`);
        if (!response.ok) {
          return;
        }
        const payload = await response.json();
        setCategories(payload ?? []);
      } catch (err) {
        // ignore
      }
    }
    loadCategories();
  }, []);

  useEffect(() => {
    async function loadDraft() {
      try {
        setLoading(true);
        const response = await fetch(
          `${API_BASE}/bank/imports/drafts/${draftId}?limit=${pageSize}&offset=${offset}`
        );
        if (!response.ok) {
          const payload = await response.json();
          throw new Error(payload.detail || "Failed to load draft");
        }
        const payload = await response.json();
        setDraft(payload.draft);
        setTotalRows(payload.total_rows || 0);
        setRows((prev) =>
          offset === 0 ? payload.rows ?? [] : [...prev, ...(payload.rows ?? [])]
        );
        setError("");
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    loadDraft();
  }, [draftId, offset]);

  const categoryOptions = useMemo(() => {
    return categories.map((cat) => cat.name).filter(Boolean);
  }, [categories]);

  async function updateRowCategory(rowId, value) {
    try {
      const formData = new FormData();
      formData.append("approved_category_text", value || "");
      const response = await fetch(
        `${API_BASE}/bank/imports/drafts/${draftId}/rows/${rowId}`,
        {
          method: "PATCH",
          body: formData,
        }
      );
      if (!response.ok) {
        const payload = await response.json();
        throw new Error(payload.detail || "Failed to update row");
      }
      const updated = await response.json();
      setRows((prev) =>
        prev.map((row) => (row.id === rowId ? { ...row, ...updated } : row))
      );
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleCommit() {
    if (!window.confirm("Approve and import this draft?")) {
      return;
    }
    try {
      setSaving(true);
      setStatus("Importing approved rows...");
      setError("");
      const response = await fetch(
        `${API_BASE}/bank/imports/drafts/${draftId}/commit`,
        { method: "POST" }
      );
      if (!response.ok) {
        const payload = await response.json();
        throw new Error(payload.detail || "Import failed");
      }
      setStatus("Import complete.");
      navigate("/bank");
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="report-page">
      <header className="page-header">
        <div>
          <h1>Review bank draft</h1>
          <p>Approve or adjust categories before importing.</p>
          {draft && (
            <span className="helper">
              {draft.source_filename || "Manual upload"} · {draft.period_month} ·{" "}
              {draft.row_count} rows
            </span>
          )}
        </div>
        <div className="history-actions">
          <button className="ghost-button" onClick={() => navigate(-1)}>
            Back
          </button>
          <button className="ghost-button" disabled={saving} onClick={handleCommit}>
            Approve &amp; import
          </button>
        </div>
      </header>

      {loading && offset === 0 && <span className="pill">Loading draft</span>}
      {error && <span className="pill error">{error}</span>}
      {status && <span className="pill">{status}</span>}

      <section className="card report-card">
        <div className="table">
          <div className="table-row table-head">
            <span>Date</span>
            <span>Description</span>
            <span>Amount</span>
            <span>Suggested</span>
            <span>Approved</span>
          </div>
          {rows.map((row) => {
            const amount = row.debit ?? row.credit;
            const suggested = row.suggested_category_text || "Uncategorized";
            const approved = row.approved_category_text ?? "";
            const options = Array.from(
              new Set([suggested, ...categoryOptions].filter(Boolean))
            );
            return (
              <div className="table-row" key={row.id}>
                <span>{row.activity_date}</span>
                <span className="merchant">{row.description}</span>
                <span className="amount">{formatMoney(amount)}</span>
                <span>{suggested}</span>
                <span>
                  <select
                    value={approved}
                    onChange={(event) => updateRowCategory(row.id, event.target.value)}
                  >
                    <option value="">Use suggested</option>
                    {options.map((name) => (
                      <option key={name} value={name}>
                        {name}
                      </option>
                    ))}
                    <option value="Uncategorized">Uncategorized</option>
                  </select>
                </span>
              </div>
            );
          })}
        </div>
        {rows.length < totalRows && (
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
    </div>
  );
}
