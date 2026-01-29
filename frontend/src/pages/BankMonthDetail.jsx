import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
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

const API_BASE = "http://localhost:8000";

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
  const location = useLocation();
  const { year, month: monthNumber } = parseMonthKey(month);
  const direction = searchParams.get("direction") === "income" ? "income" : "expense";
  const [incomeItems, setIncomeItems] = useState([]);
  const [expenseItems, setExpenseItems] = useState([]);
  const [selectedIncomeCategories, setSelectedIncomeCategories] = useState(new Set());
  const [selectedExpenseCategories, setSelectedExpenseCategories] = useState(new Set());
  const [filter, setFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [initializedFilters, setInitializedFilters] = useState(false);

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
    setSelectedIncomeCategories(new Set());
    setSelectedExpenseCategories(new Set());
    setFilter("");
    setInitializedFilters(false);
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
    if (initializedFilters) {
      return;
    }
    if (monthIncomeCategories.length === 0 && monthExpenseCategories.length === 0) {
      return;
    }
    const initialIncome = Array.isArray(location.state?.income)
      ? location.state.income
      : null;
    const initialExpense = Array.isArray(location.state?.expense)
      ? location.state.expense
      : null;
    const incomeFallback = monthIncomeCategories.map((cat) => cat.name);
    const expenseFallback = monthExpenseCategories.map((cat) => cat.name);
    const incomeSet = new Set(
      (initialIncome && initialIncome.length ? initialIncome : incomeFallback).filter(
        (name) => monthIncomeCategories.some((cat) => cat.name === name)
      )
    );
    const expenseSet = new Set(
      (initialExpense && initialExpense.length ? initialExpense : expenseFallback).filter(
        (name) => monthExpenseCategories.some((cat) => cat.name === name)
      )
    );
    setSelectedIncomeCategories(incomeSet.size ? incomeSet : new Set(incomeFallback));
    setSelectedExpenseCategories(
      expenseSet.size ? expenseSet : new Set(expenseFallback)
    );
    setInitializedFilters(true);
  }, [monthIncomeCategories, monthExpenseCategories, initializedFilters, location.state]);

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

  function toggleCategory(directionKey, name) {
    if (directionKey === "income") {
      setSelectedIncomeCategories((prev) => {
        const next = new Set(prev);
        if (next.has(name)) {
          next.delete(name);
        } else {
          next.add(name);
        }
        return next;
      });
    } else {
      setSelectedExpenseCategories((prev) => {
        const next = new Set(prev);
        if (next.has(name)) {
          next.delete(name);
        } else {
          next.add(name);
        }
        return next;
      });
    }
  }

  function selectAll(directionKey) {
    if (directionKey === "income") {
      setSelectedIncomeCategories(
        new Set(monthIncomeCategories.map((item) => item.name))
      );
    } else {
      setSelectedExpenseCategories(
        new Set(monthExpenseCategories.map((item) => item.name))
      );
    }
  }

  function clearAll(directionKey) {
    if (directionKey === "income") {
      setSelectedIncomeCategories(new Set());
    } else {
      setSelectedExpenseCategories(new Set());
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
                          checked={selectedExpenseCategories.has(item.name)}
                          onChange={() => toggleCategory("expense", item.name)}
                        />
                        <span
                          className="category-swatch"
                          style={{ background: getCategoryColor("expense", item.name) }}
                        />
                        <span className="category-name">{item.name}</span>
                        <strong>{formatMoney(item.total)}</strong>
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
                          checked={selectedIncomeCategories.has(item.name)}
                          onChange={() => toggleCategory("income", item.name)}
                        />
                        <span
                          className="category-swatch"
                          style={{ background: getCategoryColor("income", item.name) }}
                        />
                        <span className="category-name">{item.name}</span>
                        <strong>{formatMoney(item.total)}</strong>
                      </label>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
