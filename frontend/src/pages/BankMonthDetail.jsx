import { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";

const API_BASE = "http://localhost:8000";

function formatMoney(value) {
  return new Intl.NumberFormat("en-IL", {
    style: "currency",
    currency: "ILS",
    minimumFractionDigits: 0,
  }).format(Number(value || 0));
}

function parseMonthParam(value) {
  if (!value) {
    return { year: null, month: null };
  }
  const [yearStr, monthStr] = value.split("-");
  return {
    year: Number(yearStr),
    month: Number(monthStr),
  };
}

export default function BankMonthDetail() {
  const { month } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { year, month: monthNumber } = parseMonthParam(month);
  const direction = searchParams.get("direction") === "income" ? "income" : "expense";
  const [data, setData] = useState(null);
  const [selectedPayee, setSelectedPayee] = useState(null);
  const [monthActivities, setMonthActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [popupError, setPopupError] = useState("");

  useEffect(() => {
    async function loadDetail() {
      if (!year || !monthNumber) {
        return;
      }
      try {
        setLoading(true);
        const response = await fetch(
          `${API_BASE}/bank/reports/category-month?year=${year}&month=${monthNumber}&direction=${direction}`
        );
        if (!response.ok) {
          throw new Error("Failed to load month detail");
        }
        const payload = await response.json();
        setData(payload);
        setError("");
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    loadDetail();
  }, [year, monthNumber]);

  useEffect(() => {
    async function loadActivities() {
      if (!selectedPayee || !year || !monthNumber) {
        return;
      }
      try {
        const params = new URLSearchParams({
          payee_id: selectedPayee.id,
          year,
          month: monthNumber,
          limit: 200,
          direction,
        });
        const response = await fetch(
          `${API_BASE}/bank/activities?${params.toString()}`
        );
        if (!response.ok) {
          throw new Error("Failed to load activities");
        }
        const payload = await response.json();
        setMonthActivities(payload.items ?? []);
        setPopupError("");
      } catch (err) {
        setPopupError(err.message);
      }
    }

    loadActivities();
  }, [selectedPayee, year, monthNumber]);

  return (
    <div className="report-page">
      <header className="page-header">
        <div>
          <h1>Month details</h1>
          <p>
            {direction === "income" ? "Income" : "Expense"} category → payee
            breakdown for {data?.month ?? month}
          </p>
        </div>
        <button className="ghost-button" onClick={() => navigate(-1)}>
          Back to report
        </button>
      </header>

      {loading && <span className="pill">Loading month detail</span>}
      {error && <span className="pill error">{error}</span>}

      {data && (
        <section className="detail-grid">
          {data.categories.map((category) => (
            <div className="card detail-card" key={category.name}>
              <div className="card-header">
                <h3>{category.name}</h3>
                <strong>{formatMoney(category.total)}</strong>
              </div>
              <div className="detail-list">
                {category.payees.map((payee) => (
                  <div
                    className={`detail-row${payee.id ? " clickable" : ""}`}
                    key={`${category.name}-${payee.name}`}
                    onClick={() => {
                      if (!payee.id) {
                        return;
                      }
                      setSelectedPayee({ id: payee.id, name: payee.name });
                    }}
                    role={payee.id ? "button" : undefined}
                    tabIndex={payee.id ? 0 : undefined}
                    onKeyDown={(event) => {
                      if (!payee.id) {
                        return;
                      }
                      if (event.key === "Enter" || event.key === " ") {
                        setSelectedPayee({ id: payee.id, name: payee.name });
                      }
                    }}
                  >
                    <span>{payee.name}</span>
                    <strong>{formatMoney(payee.total)}</strong>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </section>
      )}

      {selectedPayee && (
        <div className="modal-overlay" onClick={() => setSelectedPayee(null)}>
          <div className="modal-card" onClick={(event) => event.stopPropagation()}>
            <div className="card-header">
              <h3>
                Activities in {data?.month ?? month} · {selectedPayee.name}
              </h3>
              <button
                className="ghost-button"
                onClick={() => setSelectedPayee(null)}
              >
                Close
              </button>
            </div>
            {popupError && <span className="pill error">{popupError}</span>}
            <div className="detail-list">
              {monthActivities.map((activity) => (
                <div className="detail-row" key={activity.id}>
                  <span>
                    {new Date(activity.activity_date).toLocaleDateString("en-GB")}
                    {activity.value_date
                      ? ` · value ${new Date(activity.value_date).toLocaleDateString("en-GB")}`
                      : ""} {" "}
                    · {activity.description}
                  </span>
                  <strong>{formatMoney(activity.debit ?? activity.credit)}</strong>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
