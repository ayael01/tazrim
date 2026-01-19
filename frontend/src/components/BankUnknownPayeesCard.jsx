import { useEffect, useState } from "react";

const API_BASE = "http://localhost:8000";

function formatMoney(value) {
  return new Intl.NumberFormat("en-IL", {
    style: "currency",
    currency: "ILS",
    minimumFractionDigits: 0,
  }).format(Number(value || 0));
}

export default function BankUnknownPayeesCard({ payees, categories, onAssigned, totalCount }) {
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
          `${API_BASE}/bank/activities?payee_id=${selected.id}&limit=20`
        );
        if (!response.ok) {
          throw new Error("Failed to load payee activities");
        }
        const payload = await response.json();
        setDetails(payload.items ?? []);
        setDetailError("");
      } catch (err) {
        setDetailError(err.message);
      }
    }
    loadDetails();
  }, [selected]);

  async function handleAssign(payeeId, categoryId) {
    if (!categoryId) {
      return;
    }
    setStatus("Saving...");
    setError("");
    try {
      const response = await fetch(
        `${API_BASE}/bank/payees/${payeeId}/category?category_id=${categoryId}`,
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
          <h3>Uncategorized payees</h3>
          {typeof totalCount === "number" && (
            <span className="count-badge">{totalCount}</span>
          )}
        </div>
        <p>Assign categories to improve reports</p>
      </div>
      {payees.length === 0 ? (
        <p className="empty-state">All payees are categorized.</p>
      ) : (
        <div className="unknown-list">
          {payees.map((payee) => (
            <div className="unknown-row" key={payee.id}>
              <div>
                <button
                  className="link-button"
                  onClick={() => setSelected(payee)}
                >
                  {payee.display_name}
                </button>
                <span>{payee.activity_count} tx</span>
              </div>
              <select
                defaultValue=""
                onChange={(event) =>
                  handleAssign(payee.id, event.target.value)
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
              {details.map((activity) => (
                <div className="detail-row" key={activity.id}>
                  <span>
                    {new Date(activity.activity_date).toLocaleDateString("en-GB")} ·{" "}
                    {activity.category_name || "Uncategorized"}
                  </span>
                  <strong>
                    {formatMoney(activity.debit ?? activity.credit)}
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
