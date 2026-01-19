import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

const API_BASE = "http://localhost:8000";

function formatMoney(value) {
  return new Intl.NumberFormat("en-IL", {
    style: "currency",
    currency: "ILS",
    minimumFractionDigits: 0,
  }).format(Number(value || 0));
}

export default function BankImportDetail() {
  const { importId } = useParams();
  const navigate = useNavigate();
  const [activities, setActivities] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        const response = await fetch(
          `${API_BASE}/bank/activities?import_batch_id=${importId}&limit=200`
        );
        if (!response.ok) {
          throw new Error("Failed to load bank activities");
        }
        const payload = await response.json();
        setActivities(payload.items ?? []);
        setTotal(payload.total ?? 0);
        setError("");
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [importId]);

  return (
    <div className="report-page">
      <header className="page-header">
        <div>
          <h1>Bank import {importId}</h1>
          <p>{total} activities</p>
        </div>
        <button className="ghost-button" onClick={() => navigate(-1)}>
          Back
        </button>
      </header>

      <section className="card report-card">
        <div className="table">
          <div className="table-row table-head">
            <span>Date</span>
            <span>Description</span>
            <span>Category</span>
            <span className="amount">Amount</span>
          </div>
          {activities.map((activity) => (
            <div className="table-row" key={activity.id}>
              <span>
                {new Date(activity.activity_date).toLocaleDateString("en-GB")}
              </span>
              <span className="merchant">{activity.description}</span>
              <span className="category">
                {activity.category_name || "Uncategorized"}
              </span>
              <span className="amount">
                {formatMoney(activity.debit ?? activity.credit)}
              </span>
            </div>
          ))}
        </div>
      </section>

      <div className="status-bar">
        {loading && <span className="pill">Loading activities</span>}
        {error && <span className="pill error">{error}</span>}
      </div>
    </div>
  );
}
