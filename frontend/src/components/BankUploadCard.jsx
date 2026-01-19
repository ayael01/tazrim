import { useState } from "react";

const API_BASE = "http://localhost:8000";

export default function BankUploadCard({ onUploaded }) {
  const [periodMonth, setPeriodMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });
  const [file, setFile] = useState(null);
  const [showGuide, setShowGuide] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  async function handleSubmit(event) {
    event.preventDefault();
    if (!file) {
      setError("Please choose a CSV file.");
      return;
    }

    setStatus("Uploading...");
    setError("");
    try {
      const formData = new FormData();
      formData.append("period_month", periodMonth);
      formData.append("account_name", "Mizrahi Checking");
      formData.append("file", file);

      const response = await fetch(`${API_BASE}/bank/imports`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const payload = await response.json();
        throw new Error(payload.detail || "Upload failed");
      }

      setStatus("Upload complete. Data refreshed.");
      setFile(null);
      onUploaded?.();
    } catch (err) {
      setError(err.message);
      setStatus("");
    }
  }

  return (
    <div className="card upload-card">
      <div>
        <h3>Import bank activities</h3>
        <p>
          Upload the monthly CSV export. We will map payees and flag anything
          uncategorized.
        </p>
        <button
          type="button"
          className="ghost-button"
          onClick={() => setShowGuide(true)}
        >
          View CSV format
        </button>
      </div>
      <form onSubmit={handleSubmit}>
        <label>
          Period (YYYY-MM)
          <input
            type="month"
            value={periodMonth}
            onChange={(event) => setPeriodMonth(event.target.value)}
          />
        </label>
        <label>
          CSV file
          <input
            type="file"
            accept=".csv"
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
          />
        </label>
        <button type="submit">Upload CSV</button>
        {status && <span className="status">{status}</span>}
        {error && <span className="status error">{error}</span>}
      </form>

      {showGuide && (
        <div className="modal-overlay" onClick={() => setShowGuide(false)}>
          <div className="modal-card" onClick={(event) => event.stopPropagation()}>
            <div className="card-header">
              <h3>CSV format</h3>
              <button
                className="ghost-button"
                onClick={() => setShowGuide(false)}
              >
                Close
              </button>
            </div>
            <p>
              The monthly export should include these columns (Hebrew). We only
              use the highlighted fields.
            </p>
            <div className="format-grid">
              <span>תאריך</span>
              <span>תאריך ערך</span>
              <span>סוג תנועה</span>
              <span>זכות</span>
              <span>חובה</span>
              <span>יתרה בש"ח</span>
              <span>אסמכתא</span>
            </div>
            <div className="format-note">
              Required: תאריך, סוג תנועה, חובה או זכות. Historical exports may
              include תיאור and סוגי קטגוריות and will be auto-mapped.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
