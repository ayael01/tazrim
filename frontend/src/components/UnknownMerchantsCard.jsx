import { useEffect, useState } from "react";

const API_BASE = "http://localhost:8000";

export default function UnknownMerchantsCard({
  merchants,
  categories,
  onAssigned,
  totalCount,
}) {
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [selected, setSelected] = useState(null);
  const [details, setDetails] = useState([]);
  const [detailError, setDetailError] = useState("");

  useEffect(() => {
    async function loadDetails() {
      if (!selected) {
        return;
      }
      try {
        const response = await fetch(
          `${API_BASE}/merchants/${selected.id}/transactions?limit=20`
        );
        if (!response.ok) {
          throw new Error("Failed to load merchant transactions");
        }
        const payload = await response.json();
        setDetails(payload ?? []);
        setDetailError("");
      } catch (err) {
        setDetailError(err.message);
      }
    }
    loadDetails();
  }, [selected]);

  async function handleAssign(merchantId, categoryId) {
    if (!categoryId) {
      return;
    }
    setStatus("Saving...");
    setError("");
    try {
      const response = await fetch(
        `${API_BASE}/merchants/${merchantId}/category?category_id=${categoryId}`,
        { method: "POST" }
      );
      if (!response.ok) {
        const payload = await response.json();
        throw new Error(payload.detail || "Failed to assign category");
      }
      setStatus("Saved.");
      onAssigned?.();
    } catch (err) {
      setError(err.message);
      setStatus("");
    }
  }

  return (
    <div className="card unknown-card">
      <div className="card-header">
        <div className="header-with-count">
          <h3>Uncategorized merchants</h3>
          {typeof totalCount === "number" && (
            <span className="count-badge">{totalCount}</span>
          )}
        </div>
        <p>Assign categories to improve reports</p>
      </div>
      {merchants.length === 0 ? (
        <p className="empty-state">All merchants are categorized.</p>
      ) : (
        <div className="unknown-list">
          {merchants.map((merchant) => (
            <div className="unknown-row" key={merchant.id}>
              <div>
                <button
                  className="link-button"
                  onClick={() => setSelected(merchant)}
                >
                  {merchant.display_name}
                </button>
                <span>{merchant.transaction_count} tx</span>
              </div>
              <select
                defaultValue=""
                onChange={(event) =>
                  handleAssign(merchant.id, event.target.value)
                }
              >
                <option value="">Select category</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>
      )}
      {status && <span className="status">{status}</span>}
      {error && <span className="status error">{error}</span>}

      {selected && (
        <div className="modal-overlay" onClick={() => setSelected(null)}>
          <div className="modal-card" onClick={(event) => event.stopPropagation()}>
            <div className="card-header">
              <h3>{selected.display_name}</h3>
              <button
                className="ghost-button"
                onClick={() => setSelected(null)}
              >
                Close
              </button>
            </div>
            {detailError && <span className="pill error">{detailError}</span>}
            <div className="detail-list">
              {details.map((tx) => (
                <div className="detail-row" key={tx.id}>
                  <span>
                    {new Date(tx.transaction_date).toLocaleDateString("en-GB")} ·{" "}
                    {tx.category_name || "Uncategorized"}
                  </span>
                  <strong>
                    {new Intl.NumberFormat("en-IL", {
                      style: "currency",
                      currency: tx.currency || "ILS",
                      minimumFractionDigits: 0,
                    }).format(Number(tx.amount || 0))}
                  </strong>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
