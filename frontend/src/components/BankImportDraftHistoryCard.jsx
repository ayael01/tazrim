import { useState } from "react";

const API_BASE = "http://localhost:8000";

export default function BankImportDraftHistoryCard({ drafts, onDiscard, onReview }) {
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  async function handleDiscard(draftId) {
    if (!window.confirm("Discard this draft upload?")) {
      return;
    }
    setStatus("Discarding...");
    setError("");
    try {
      const response = await fetch(`${API_BASE}/bank/imports/drafts/${draftId}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        const payload = await response.json();
        throw new Error(payload.detail || "Discard failed");
      }
      setStatus("Draft discarded.");
      onDiscard?.();
    } catch (err) {
      setError(err.message);
      setStatus("");
    }
  }

  return (
    <div className="card import-history">
      <div className="card-header">
        <h3>Pending approvals</h3>
        <p>Approve drafts before importing activities</p>
      </div>
      <div className="history-list">
        {drafts.length === 0 ? (
          <p className="empty-state">No drafts pending.</p>
        ) : (
          drafts.map((draft) => (
            <div key={draft.id} className="history-row">
              <div>
                <strong>{draft.source_filename || "Manual upload"}</strong>
                <span>
                  {draft.period_month} · {draft.row_count} rows
                </span>
              </div>
              <div className="history-actions">
                {onReview && (
                  <button
                    className="ghost-button"
                    onClick={() => onReview?.(draft.id)}
                  >
                    Review
                  </button>
                )}
                <button
                  className="ghost-button danger"
                  onClick={() => handleDiscard(draft.id)}
                >
                  Discard
                </button>
              </div>
            </div>
          ))
        )}
      </div>
      {status && <span className="status">{status}</span>}
      {error && <span className="status error">{error}</span>}
    </div>
  );
}
