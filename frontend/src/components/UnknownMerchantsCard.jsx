import { useState } from "react";

const API_BASE = "http://localhost:8000";

export default function UnknownMerchantsCard({
  merchants,
  categories,
  onAssigned,
}) {
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

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
        <h3>Uncategorized merchants</h3>
        <p>Assign categories to improve reports</p>
      </div>
      {merchants.length === 0 ? (
        <p className="empty-state">All merchants are categorized.</p>
      ) : (
        <div className="unknown-list">
          {merchants.map((merchant) => (
            <div className="unknown-row" key={merchant.id}>
              <div>
                <strong>{merchant.display_name}</strong>
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
    </div>
  );
}
