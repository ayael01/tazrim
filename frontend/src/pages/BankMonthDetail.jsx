import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  Bar,
  BarChart,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { getCategoryColor } from "../utils/bankColors.js";
import { formatMonthLabel, formatMonthTitle, parseMonthKey } from "../utils/bankDates.js";
import {
  applyRule,
  clearAllRule,
  isCategoryChecked,
  loadBankCategoryRules,
  saveBankCategoryRules,
  selectAllRule,
  toggleRule,
} from "../utils/bankFilters.js";

const API_BASE = "http://localhost:8000";

const dateFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

function formatMoney(value) {
  return new Intl.NumberFormat("en-IL", {
    style: "currency",
    currency: "ILS",
    minimumFractionDigits: 0,
  }).format(Number(value || 0));
}

function formatAxis(value) {
  return new Intl.NumberFormat("en-IL", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(Number(value || 0));
}

function CategoryTooltip({ active, payload, label }) {
  if (!active || !payload?.length) {
    return null;
  }
  const monthPayload = payload?.[0]?.payload || {};
  const dataKey = String(payload?.[0]?.dataKey || "");
  const direction = dataKey.startsWith("income_rank_") ? "income" : "expense";
  const rows =
    direction === "income" ? monthPayload.incomeStack : monthPayload.expenseStack;
  const safeRows = Array.isArray(rows) ? rows : [];
  const total = safeRows.reduce((sum, entry) => sum + entry.value, 0);
  return (
    <div className="tooltip">
      <strong>{monthPayload.title || label}</strong>
      <div className="tooltip-total">
        <span>{direction === "income" ? "Income" : "Expenses"} total</span>
        <span>{formatMoney(total)}</span>
      </div>
      <div className="tooltip-list">
        {safeRows.map((entry) => (
          <div key={entry.name} className="tooltip-row">
            <span className="tooltip-label">
              <span
                className="tooltip-swatch"
                style={{ background: getCategoryColor(direction, entry.name) }}
              />
              {entry.name}
            </span>
            <span>{formatMoney(entry.value)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function BankMonthDetail() {
  const { month } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { year, month: monthNumber } = parseMonthKey(month);
  const direction = searchParams.get("direction") === "income" ? "income" : "expense";
  const [incomeItems, setIncomeItems] = useState([]);
  const [expenseItems, setExpenseItems] = useState([]);
  const [expenseRule, setExpenseRule] = useState(
    () => loadBankCategoryRules().expense
  );
  const [incomeRule, setIncomeRule] = useState(
    () => loadBankCategoryRules().income
  );
  const [filter, setFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [detailSelection, setDetailSelection] = useState(null);
  const [detailActivities, setDetailActivities] = useState([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");

  useEffect(() => {
    async function loadDetail() {
      if (!year || !monthNumber) {
        return;
      }
      try {
        setLoading(true);
        const [incomeRes, expenseRes] = await Promise.all([
          fetch(`${API_BASE}/bank/reports/category-monthly-all?year=${year}&direction=income`),
          fetch(`${API_BASE}/bank/reports/category-monthly-all?year=${year}&direction=expense`),
        ]);
        if (!incomeRes.ok || !expenseRes.ok) {
          throw new Error("Failed to load month detail");
        }
        const incomePayload = await incomeRes.json();
        const expensePayload = await expenseRes.json();
        setIncomeItems(incomePayload.items ?? []);
        setExpenseItems(expensePayload.items ?? []);
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
    setFilter("");
  }, [month]);

  const monthKey = month ? String(month) : "";

  const monthIncomeCategories = useMemo(() => {
    const totals = new Map();
    incomeItems
      .filter((item) => item.month === monthKey)
      .forEach((item) => {
        const value = Number(item.total || 0);
        totals.set(item.name, (totals.get(item.name) || 0) + value);
      });
    return Array.from(totals, ([name, total]) => ({ name, total })).sort(
      (a, b) => b.total - a.total
    );
  }, [incomeItems, monthKey]);

  const monthExpenseCategories = useMemo(() => {
    const totals = new Map();
    expenseItems
      .filter((item) => item.month === monthKey)
      .forEach((item) => {
        const value = Number(item.total || 0);
        totals.set(item.name, (totals.get(item.name) || 0) + value);
      });
    return Array.from(totals, ([name, total]) => ({ name, total })).sort(
      (a, b) => b.total - a.total
    );
  }, [expenseItems, monthKey]);

  useEffect(() => {
    saveBankCategoryRules({ income: incomeRule, expense: expenseRule });
  }, [incomeRule, expenseRule]);

  const expenseAvailableNames = useMemo(
    () => monthExpenseCategories.map((item) => item.name),
    [monthExpenseCategories]
  );
  const incomeAvailableNames = useMemo(
    () => monthIncomeCategories.map((item) => item.name),
    [monthIncomeCategories]
  );
  const selectedExpenseCategories = useMemo(
    () => applyRule(expenseRule, expenseAvailableNames),
    [expenseRule, expenseAvailableNames]
  );
  const selectedIncomeCategories = useMemo(
    () => applyRule(incomeRule, incomeAvailableNames),
    [incomeRule, incomeAvailableNames]
  );

  const chartData = useMemo(() => {
    const incomeStack = incomeItems
      .filter((item) => item.month === monthKey && selectedIncomeCategories.has(item.name))
      .map((item) => ({ name: item.name, value: Number(item.total || 0) }))
      .filter((item) => item.value > 0)
      .sort((a, b) => b.value - a.value);

    const expenseStack = expenseItems
      .filter(
        (item) => item.month === monthKey && selectedExpenseCategories.has(item.name)
      )
      .map((item) => ({ name: item.name, value: Number(item.total || 0) }))
      .filter((item) => item.value > 0)
      .sort((a, b) => b.value - a.value);

    const entry = {
      month: monthKey,
      label: formatMonthLabel(monthKey),
      title: formatMonthTitle(monthKey),
      incomeStack,
      expenseStack,
    };

    incomeStack.forEach((item, index) => {
      entry[`income_rank_${index}`] = item.value;
      entry[`income_rank_${index}_name`] = item.name;
    });
    expenseStack.forEach((item, index) => {
      entry[`expense_rank_${index}`] = item.value;
      entry[`expense_rank_${index}_name`] = item.name;
    });

    return [entry];
  }, [
    incomeItems,
    expenseItems,
    monthKey,
    selectedIncomeCategories,
    selectedExpenseCategories,
  ]);

  const monthIncomeTotal = useMemo(
    () =>
      monthIncomeCategories
        .filter((item) => selectedIncomeCategories.has(item.name))
        .reduce((sum, item) => sum + Number(item.total || 0), 0),
    [monthIncomeCategories, selectedIncomeCategories]
  );
  const monthExpenseTotal = useMemo(
    () =>
      monthExpenseCategories
        .filter((item) => selectedExpenseCategories.has(item.name))
        .reduce((sum, item) => sum + Number(item.total || 0), 0),
    [monthExpenseCategories, selectedExpenseCategories]
  );
  const monthNet = monthIncomeTotal - monthExpenseTotal;

  const maxIncomeRanks = chartData[0]?.incomeStack?.length ?? 0;
  const maxExpenseRanks = chartData[0]?.expenseStack?.length ?? 0;

  const filteredIncomeCategories = monthIncomeCategories.filter((item) =>
    item.name.toLowerCase().includes(filter.trim().toLowerCase())
  );
  const filteredExpenseCategories = monthExpenseCategories.filter((item) =>
    item.name.toLowerCase().includes(filter.trim().toLowerCase())
  );

  function handleDetailSelect(directionKey, name) {
    setDetailSelection({ direction: directionKey, name });
    setDetailActivities([]);
    setDetailError("");
  }

  useEffect(() => {
    async function loadDetailActivities() {
      if (!detailSelection || !year || !monthNumber) {
        return;
      }
      try {
        setDetailLoading(true);
        const response = await fetch(
          `${API_BASE}/bank/activities?year=${year}&month=${monthNumber}&direction=${detailSelection.direction}&category_name=${encodeURIComponent(
            detailSelection.name
          )}&limit=200`
        );
        if (!response.ok) {
          throw new Error("Failed to load activities");
        }
        const payload = await response.json();
        setDetailActivities(payload.items ?? []);
        setDetailError("");
      } catch (err) {
        setDetailError(err.message);
      } finally {
        setDetailLoading(false);
      }
    }
    loadDetailActivities();
  }, [detailSelection, monthNumber, year]);

  function toggleCategory(directionKey, name) {
    if (directionKey === "income") {
      setIncomeRule((prev) => toggleRule(prev, name));
    } else {
      setExpenseRule((prev) => toggleRule(prev, name));
    }
  }

  function selectAll(directionKey) {
    if (directionKey === "income") {
      setIncomeRule(selectAllRule());
    } else {
      setExpenseRule(selectAllRule());
    }
  }

  function clearAll(directionKey) {
    if (directionKey === "income") {
      setIncomeRule(clearAllRule());
    } else {
      setExpenseRule(clearAllRule());
    }
  }

  return (
    <div className="report-page">
      <header className="page-header">
        <div>
          <h1>{formatMonthTitle(monthKey)} report</h1>
          <p>
            Focused on {direction === "income" ? "income" : "expenses"} ·
            adjust filters to explore the month.
          </p>
        </div>
        <button
          className="ghost-button"
          onClick={() =>
            navigate(year ? `/bank/categories?year=${year}` : "/bank/categories")
          }
        >
          Back to {year || "year"} report
        </button>
      </header>

      {loading && <span className="pill">Loading month detail</span>}
      {error && <span className="pill error">{error}</span>}

      {!loading && !error && (
        <>
          <section className="card report-card">
            <div className="card-header">
              <h3>Income vs expense composition</h3>
              <p>Stacked breakdown for {formatMonthLabel(monthKey)}</p>
            </div>
            <div className="summary summary-inline">
              <div className="summary-card">
                <span className="label">Total income</span>
                <strong>{formatMoney(monthIncomeTotal)}</strong>
              </div>
              <div className="summary-card">
                <span className="label">Total expenses</span>
                <strong>{formatMoney(monthExpenseTotal)}</strong>
              </div>
              <div className="summary-card">
                <span className="label">Net</span>
                <strong
                  className={monthNet >= 0 ? "summary-value positive" : "summary-value negative"}
                >
                  {formatMoney(monthNet)}
                </strong>
              </div>
            </div>
            <div className="chart chart-wrapper">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={chartData}
                  barCategoryGap={24}
                  barGap={8}
                  margin={{ top: 16, right: 20, left: 0, bottom: 28 }}
                >
                  <XAxis dataKey="label" />
                  <YAxis tickFormatter={formatAxis} />
                  <Tooltip shared={false} content={(props) => <CategoryTooltip {...props} />} />
                  {Array.from({ length: maxIncomeRanks }, (_, index) => (
                    <Bar
                      key={`income_rank_${index}`}
                      dataKey={`income_rank_${index}`}
                      stackId="income"
                      name={`Income rank ${index + 1}`}
                      stroke="#FFFFFF"
                      strokeWidth={1}
                      fillOpacity={0.95}
                    >
                      {chartData.map((entry) => {
                        const name = entry[`income_rank_${index}_name`];
                        return (
                          <Cell
                            key={`income-cell-${entry.month}-${index}`}
                            fill={name ? getCategoryColor("income", name) : "transparent"}
                          />
                        );
                      })}
                    </Bar>
                  ))}
                  {Array.from({ length: maxExpenseRanks }, (_, index) => (
                    <Bar
                      key={`expense_rank_${index}`}
                      dataKey={`expense_rank_${index}`}
                      stackId="expense"
                      name={`Expense rank ${index + 1}`}
                      stroke="#FFFFFF"
                      strokeWidth={1}
                      fillOpacity={0.95}
                    >
                      {chartData.map((entry) => {
                        const name = entry[`expense_rank_${index}_name`];
                        return (
                          <Cell
                            key={`expense-cell-${entry.month}-${index}`}
                            fill={name ? getCategoryColor("expense", name) : "transparent"}
                          />
                        );
                      })}
                    </Bar>
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>

          <section className="card report-card">
            <div className="card-header">
              <h3>Category filters</h3>
              <p>Update the month chart by selecting categories</p>
            </div>
            <div className="search">
              <input
                type="text"
                placeholder="Filter categories by name"
                value={filter}
                onChange={(event) => setFilter(event.target.value)}
              />
            </div>
            <div className="two-column">
              <div>
                <div className="category-header">
                  <h4>Expenses</h4>
                  <div className="category-actions">
                    <button
                      className="ghost-button small"
                      onClick={() => selectAll("expense")}
                    >
                      Select all
                    </button>
                    <button
                      className="ghost-button small"
                      onClick={() => clearAll("expense")}
                    >
                      Clear all
                    </button>
                  </div>
                </div>
                <ul className="category-list">
                  {filteredExpenseCategories.map((item) => (
                    <li key={`expense-${item.name}`}>
                      <label className="category-item">
                        <input
                          type="checkbox"
                          checked={isCategoryChecked(expenseRule, item.name)}
                          onChange={() => toggleCategory("expense", item.name)}
                        />
                        <span
                          className="category-swatch"
                          style={{ background: getCategoryColor("expense", item.name) }}
                        />
                        <span className="category-name">{item.name}</span>
                        <strong>{formatMoney(item.total)}</strong>
                        <button
                          type="button"
                          className="ghost-button trend-button"
                          onClick={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            handleDetailSelect("expense", item.name);
                          }}
                        >
                          Details
                        </button>
                      </label>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <div className="category-header">
                  <h4>Income</h4>
                  <div className="category-actions">
                    <button
                      className="ghost-button small"
                      onClick={() => selectAll("income")}
                    >
                      Select all
                    </button>
                    <button
                      className="ghost-button small"
                      onClick={() => clearAll("income")}
                    >
                      Clear all
                    </button>
                  </div>
                </div>
                <ul className="category-list">
                  {filteredIncomeCategories.map((item) => (
                    <li key={`income-${item.name}`}>
                      <label className="category-item">
                        <input
                          type="checkbox"
                          checked={isCategoryChecked(incomeRule, item.name)}
                          onChange={() => toggleCategory("income", item.name)}
                        />
                        <span
                          className="category-swatch"
                          style={{ background: getCategoryColor("income", item.name) }}
                        />
                        <span className="category-name">{item.name}</span>
                        <strong>{formatMoney(item.total)}</strong>
                        <button
                          type="button"
                          className="ghost-button trend-button"
                          onClick={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            handleDetailSelect("income", item.name);
                          }}
                        >
                          Details
                        </button>
                      </label>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </section>
        </>
      )}

      {detailSelection && (
        <div className="modal-overlay" onClick={() => setDetailSelection(null)}>
          <div className="modal-card" onClick={(event) => event.stopPropagation()}>
            <div className="card-header">
              <h3>
                {detailSelection.name} · {detailSelection.direction}
              </h3>
              <button
                className="ghost-button"
                onClick={() => setDetailSelection(null)}
              >
                Close
              </button>
            </div>
            {detailLoading && <span className="pill">Loading activities</span>}
            {detailError && <span className="pill error">{detailError}</span>}
            {!detailLoading && !detailError && (
              <div className="detail-list">
                {detailActivities.map((activity) => (
                  <div className="detail-row" key={activity.id}>
                    <span>
                      {dateFormatter.format(new Date(activity.activity_date))} ·{" "}
                      {activity.description}
                    </span>
                    <span className="amount">
                      {formatMoney(activity.debit ?? activity.credit)}
                    </span>
                  </div>
                ))}
                {detailActivities.length === 0 && (
                  <div className="empty-state">No activities for this category.</div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
