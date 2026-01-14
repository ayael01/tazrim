import { useState } from "react";

const API_BASE = "http://localhost:8000";

export default function UploadCard({ onUploaded }) {
  const [periodMonth, setPeriodMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });
  const [file, setFile] = useState(null);
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
      formData.append("card_name", "Combined");
      formData.append("file", file);

      const response = await fetch(`${API_BASE}/imports`, {
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
        <h3>Import new transactions</h3>
        <p>
          Upload the monthly CSV export. We will auto-map merchants and flag
          anything uncategorized.
        </p>
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
    </div>
  );
}
