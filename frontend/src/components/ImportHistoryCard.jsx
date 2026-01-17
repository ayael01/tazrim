import { useState } from "react";

const API_BASE = "http://localhost:8000";

export default function ImportHistoryCard({ batches, onRollback, onView }) {
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  async function handleRollback(batchId) {
    if (!window.confirm("Delete this import batch and its transactions?")) {
      return;
    }
    setStatus("Rolling back...");
    setError("");
    try {
      const response = await fetch(`${API_BASE}/imports/${batchId}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        const payload = await response.json();
        throw new Error(payload.detail || "Rollback failed");
      }
      setStatus("Rollback complete.");
      onRollback?.();
    } catch (err) {
      setError(err.message);
      setStatus("");
    }
  }

  return (
    <div className="card import-history">
      <div className="card-header">
        <h3>Recent uploads</h3>
        <p>Rollback if something looks wrong</p>
      </div>
      <div className="history-list">
        {batches.length === 0 ? (
          <p className="empty-state">No uploads yet.</p>
        ) : (
          batches.map((batch) => (
            <div key={batch.id} className="history-row">
              <div>
                <strong>{batch.source_filename || "Manual upload"}</strong>
                <span>
                  {batch.period_month} · {batch.row_count} rows
                </span>
              </div>
              <div className="history-actions">
                <button
                  className="ghost-button"
                  onClick={() => onView?.(batch.id)}
                >
                  View
                </button>
                <button
                  className="ghost-button danger"
                  onClick={() => handleRollback(batch.id)}
                >
                  Rollback
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
