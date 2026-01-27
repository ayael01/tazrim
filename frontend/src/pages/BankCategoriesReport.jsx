import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
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
import { formatMonthLabel } from "../utils/bankDates.js";

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
      <strong>{label}</strong>
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

function buildSelectionMap(categories, selected) {
  const map = {};
  categories.forEach((name) => {
    map[name] = selected.has(name);
  });
  return map;
}

export default function BankCategoriesReport() {
  const navigate = useNavigate();
  const [year, setYear] = useState(new Date().getFullYear());
  const [years, setYears] = useState([]);
  const [cashflowItems, setCashflowItems] = useState([]);
  const [expenseItems, setExpenseItems] = useState([]);
  const [incomeItems, setIncomeItems] = useState([]);
  const [expenseCategories, setExpenseCategories] = useState([]);
  const [incomeCategories, setIncomeCategories] = useState([]);
  const [selectedExpenseCategories, setSelectedExpenseCategories] = useState(new Set());
  const [selectedIncomeCategories, setSelectedIncomeCategories] = useState(new Set());
  const [filter, setFilter] = useState("");
  const [listOffset, setListOffset] = useState(0);
  const [listLoading, setListLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [initializedFilters, setInitializedFilters] = useState(false);

  useEffect(() => {
    async function loadYears() {
      const response = await fetch(`${API_BASE}/bank/reports/years`);
      if (!response.ok) {
        return;
      }
      const payload = await response.json();
      const available = payload.years || [];
      setYears(available);
      if (available.length && !available.includes(year)) {
        setYear(available[available.length - 1]);
      }
    }
    loadYears();
  }, []);

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        const [cashflowRes, expenseRes, incomeRes] = await Promise.all([
          fetch(`${API_BASE}/bank/reports/monthly-cashflow?year=${year}`),
          fetch(`${API_BASE}/bank/reports/category-monthly-all?year=${year}&direction=expense`),
          fetch(`${API_BASE}/bank/reports/category-monthly-all?year=${year}&direction=income`),
        ]);
        if (!cashflowRes.ok || !expenseRes.ok || !incomeRes.ok) {
          throw new Error("Failed to load bank category report");
        }
        const cashflowData = await cashflowRes.json();
        const expenseData = await expenseRes.json();
        const incomeData = await incomeRes.json();
        setCashflowItems(cashflowData.items ?? []);
        setExpenseItems(expenseData.items ?? []);
        setIncomeItems(incomeData.items ?? []);
        setError("");
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [year]);

  useEffect(() => {
    setExpenseCategories([]);
    setIncomeCategories([]);
    setListOffset(0);
    setHasMore(true);
    setInitializedFilters(false);
  }, [year, filter]);

  useEffect(() => {
    if (!hasMore) {
      return;
    }
    const controller = new AbortController();
    async function loadList() {
      try {
        setListLoading(true);
        const [expenseRes, incomeRes] = await Promise.all([
          fetch(
            `${API_BASE}/bank/categories?year=${year}&direction=expense&q=${encodeURIComponent(filter)}&limit=50&offset=${listOffset}`,
            { signal: controller.signal }
          ),
          fetch(
            `${API_BASE}/bank/categories?year=${year}&direction=income&q=${encodeURIComponent(filter)}&limit=50&offset=${listOffset}`,
            { signal: controller.signal }
          ),
        ]);
        if (!expenseRes.ok || !incomeRes.ok) {
          return;
        }
        const expensePayload = await expenseRes.json();
        const incomePayload = await incomeRes.json();
        const nextExpense = expensePayload ?? [];
        const nextIncome = incomePayload ?? [];
        setExpenseCategories((prev) => [...prev, ...nextExpense]);
        setIncomeCategories((prev) => [...prev, ...nextIncome]);
        setHasMore(nextExpense.length === 50 || nextIncome.length === 50);
      } catch (err) {
        // ignore aborted requests
      } finally {
        setListLoading(false);
      }
    }
    loadList();
    return () => controller.abort();
  }, [year, filter, listOffset, hasMore]);

  useEffect(() => {
    if (initializedFilters) {
      return;
    }
    if (expenseCategories.length === 0 && incomeCategories.length === 0) {
      return;
    }
    setSelectedExpenseCategories(new Set(expenseCategories.map((cat) => cat.name)));
    setSelectedIncomeCategories(new Set(incomeCategories.map((cat) => cat.name)));
    setInitializedFilters(true);
  }, [expenseCategories, incomeCategories, initializedFilters]);

  const chartData = useMemo(() => {
    const months = Array.from(new Set(cashflowItems.map((item) => item.month))).sort();
    let maxIncomeRanks = 0;
    let maxExpenseRanks = 0;

    const monthStacks = months.map((month) => {
      const incomeStack = incomeItems
        .filter((item) => item.month === month && selectedIncomeCategories.has(item.name))
        .map((item) => ({ name: item.name, value: Number(item.total || 0) }))
        .filter((item) => item.value > 0)
        .sort((a, b) => b.value - a.value);
      const expenseStack = expenseItems
        .filter((item) => item.month === month && selectedExpenseCategories.has(item.name))
        .map((item) => ({ name: item.name, value: Number(item.total || 0) }))
        .filter((item) => item.value > 0)
        .sort((a, b) => b.value - a.value);

      maxIncomeRanks = Math.max(maxIncomeRanks, incomeStack.length);
      maxExpenseRanks = Math.max(maxExpenseRanks, expenseStack.length);

      return { month, incomeStack, expenseStack };
    });

    return monthStacks.map(({ month, incomeStack, expenseStack }) => {
      const entry = {
        month,
        label: formatMonthLabel(month),
        incomeStack,
        expenseStack,
      };
      for (let i = 0; i < maxIncomeRanks; i += 1) {
        const item = incomeStack[i];
        entry[`income_rank_${i}`] = item ? item.value : 0;
        entry[`income_rank_${i}_name`] = item ? item.name : null;
      }
      for (let i = 0; i < maxExpenseRanks; i += 1) {
        const item = expenseStack[i];
        entry[`expense_rank_${i}`] = item ? item.value : 0;
        entry[`expense_rank_${i}_name`] = item ? item.name : null;
      }
      return entry;
    });
  }, [cashflowItems, expenseItems, incomeItems, selectedExpenseCategories, selectedIncomeCategories]);

  const expenseNames = useMemo(
    () => expenseCategories.map((cat) => cat.name),
    [expenseCategories]
  );
  const incomeNames = useMemo(
    () => incomeCategories.map((cat) => cat.name),
    [incomeCategories]
  );

  const maxIncomeRanks = useMemo(() => {
    return chartData.reduce((max, entry) => {
      let count = 0;
      while (entry[`income_rank_${count}`] > 0 || entry[`income_rank_${count}_name`]) {
        count += 1;
      }
      return Math.max(max, count);
    }, 0);
  }, [chartData]);

  const maxExpenseRanks = useMemo(() => {
    return chartData.reduce((max, entry) => {
      let count = 0;
      while (entry[`expense_rank_${count}`] > 0 || entry[`expense_rank_${count}_name`]) {
        count += 1;
      }
      return Math.max(max, count);
    }, 0);
  }, [chartData]);

  const expenseSelectionMap = buildSelectionMap(expenseNames, selectedExpenseCategories);
  const incomeSelectionMap = buildSelectionMap(incomeNames, selectedIncomeCategories);

  function toggleCategory(direction, name) {
    if (direction === "income") {
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

  function selectAll(direction) {
    if (direction === "income") {
      setSelectedIncomeCategories(new Set(incomeNames));
    } else {
      setSelectedExpenseCategories(new Set(expenseNames));
    }
  }

  function clearAll(direction) {
    if (direction === "income") {
      setSelectedIncomeCategories(new Set());
    } else {
      setSelectedExpenseCategories(new Set());
    }
  }

  function handleBarClick(direction, data) {
    const monthValue = data?.payload?.month;
    if (!monthValue) {
      return;
    }
    navigate(`/bank/month/${monthValue}?direction=${direction}`, {
      state: {
        income: Array.from(selectedIncomeCategories),
        expense: Array.from(selectedExpenseCategories),
      },
    });
  }

  return (
    <div className="report-page">
      <header className="page-header">
        <div>
          <h1>Bank category report</h1>
          <p>Compare monthly income and expenses at a glance.</p>
        </div>
        <div className="year-picker">
          <label>
            Year
            <input
              type="number"
              min="2020"
              max="2100"
              value={year}
              onChange={(event) => setYear(Number(event.target.value))}
            />
          </label>
          {years.length > 0 && (
            <span className="helper">Available: {years.join(", ")}</span>
          )}
        </div>
      </header>

      <section className="card report-card">
        <div className="card-header">
          <h3>Income vs expense categories</h3>
          <p>Grouped bars with category composition</p>
        </div>
        <div className="chart chart-wrapper">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              barCategoryGap={18}
              barGap={6}
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
                  onClick={(data) => handleBarClick("income", data)}
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
                  onClick={(data) => handleBarClick("expense", data)}
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
          <h3>All categories</h3>
          <p>Filter what appears in the chart</p>
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
              {expenseCategories.map((item) => (
                <li key={`expense-${item.id ?? "uncat"}-${item.name}`}>
                  <label className="category-item">
                    <input
                      type="checkbox"
                      checked={expenseSelectionMap[item.name] || false}
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
              {incomeCategories.map((item) => (
                <li key={`income-${item.id ?? "uncat"}-${item.name}`}>
                  <label className="category-item">
                    <input
                      type="checkbox"
                      checked={incomeSelectionMap[item.name] || false}
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
        <div className="load-more">
          {hasMore && (
            <button
              className="ghost-button"
              disabled={listLoading}
              onClick={() => setListOffset((prev) => prev + 50)}
            >
              {listLoading ? "Loading..." : "Load more"}
            </button>
          )}
        </div>
      </section>

      <div className="status-bar">
        {loading && <span className="pill">Loading report</span>}
        {error && <span className="pill error">{error}</span>}
      </div>
    </div>
  );
}
