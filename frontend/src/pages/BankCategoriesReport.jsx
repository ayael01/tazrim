import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Bar,
  BarChart,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const API_BASE = "http://localhost:8000";

const COLORS = [
  "#ff8a4b",
  "#3aa0ff",
  "#7b61ff",
  "#56c2a7",
  "#f6c453",
  "#ff7ac8",
];

function formatMoney(value) {
  return new Intl.NumberFormat("en-IL", {
    style: "currency",
    currency: "ILS",
    minimumFractionDigits: 0,
  }).format(Number(value || 0));
}

function toMonthLabel(value) {
  if (!value) {
    return "";
  }
  const [year, month] = value.split("-");
  const date = new Date(Number(year), Number(month) - 1, 1);
  return new Intl.DateTimeFormat("en-GB", { month: "short" }).format(date);
}

function SortedTooltip({
  active,
  payload,
  label,
  totalByMonth,
  seriesCount,
  directionLabel,
}) {
  if (!active || !payload?.length) {
    return null;
  }
  const monthKey = payload?.[0]?.payload?.month;
  const sorted = [...payload].sort(
    (a, b) => Number(b.value || 0) - Number(a.value || 0)
  );
  const topTotal = sorted.reduce(
    (sum, entry) => sum + Number(entry.value || 0),
    0
  );
  const total = totalByMonth?.[monthKey] ?? topTotal;
  return (
    <div className="tooltip">
      <strong>{label}</strong>
      <div className="tooltip-total">
        <span>{directionLabel} total</span>
        <span>{formatMoney(total)}</span>
      </div>
      <div className="tooltip-total">
        <span>Top {seriesCount} total</span>
        <span>{formatMoney(topTotal)}</span>
      </div>
      <div className="tooltip-note">Top {seriesCount} categories shown</div>
      <div className="tooltip-list">
        {sorted.map((entry) => (
          <div
            key={entry.dataKey}
            className="tooltip-row"
            style={{ color: entry.color }}
          >
            <span>{entry.dataKey}</span>
            <span>{formatMoney(entry.value)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function BankCategoriesReport() {
  const navigate = useNavigate();
  const [year, setYear] = useState(new Date().getFullYear());
  const [years, setYears] = useState([]);
  const [limit, setLimit] = useState(6);
  const [expenseItems, setExpenseItems] = useState([]);
  const [incomeItems, setIncomeItems] = useState([]);
  const [expenseTotals, setExpenseTotals] = useState({});
  const [incomeTotals, setIncomeTotals] = useState({});
  const [expenseCategories, setExpenseCategories] = useState([]);
  const [incomeCategories, setIncomeCategories] = useState([]);
  const [filter, setFilter] = useState("");
  const [listOffset, setListOffset] = useState(0);
  const [listLoading, setListLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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
        const [expenseRes, incomeRes, totalsRes] = await Promise.all([
          fetch(
            `${API_BASE}/bank/reports/category-monthly?year=${year}&limit=${limit}&direction=expense`
          ),
          fetch(
            `${API_BASE}/bank/reports/category-monthly?year=${year}&limit=${limit}&direction=income`
          ),
          fetch(`${API_BASE}/bank/reports/monthly-cashflow?year=${year}`),
        ]);
        if (!expenseRes.ok || !incomeRes.ok || !totalsRes.ok) {
          throw new Error("Failed to load bank category report");
        }
        const expenseData = await expenseRes.json();
        const incomeData = await incomeRes.json();
        const totalsData = await totalsRes.json();
        setExpenseItems(expenseData.items ?? []);
        setIncomeItems(incomeData.items ?? []);
        const expenseMap = {};
        const incomeMap = {};
        (totalsData.items ?? []).forEach((item) => {
          expenseMap[item.month] = Number(item.expense || 0);
          incomeMap[item.month] = Number(item.income || 0);
        });
        setExpenseTotals(expenseMap);
        setIncomeTotals(incomeMap);
        setError("");
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [year, limit]);

  useEffect(() => {
    setExpenseCategories([]);
    setIncomeCategories([]);
    setListOffset(0);
    setHasMore(true);
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

  const expenseChartData = useMemo(() => {
    const months = Array.from(new Set(expenseItems.map((item) => item.month))).sort();
    const names = Array.from(new Set(expenseItems.map((item) => item.name)));
    return months.map((month) => {
      const entry = { month, label: toMonthLabel(month) };
      names.forEach((name) => {
        const match = expenseItems.find(
          (item) => item.month === month && item.name === name
        );
        entry[name] = match ? Number(match.total || 0) : 0;
      });
      return entry;
    });
  }, [expenseItems]);

  const incomeChartData = useMemo(() => {
    const months = Array.from(new Set(incomeItems.map((item) => item.month))).sort();
    const names = Array.from(new Set(incomeItems.map((item) => item.name)));
    return months.map((month) => {
      const entry = { month, label: toMonthLabel(month) };
      names.forEach((name) => {
        const match = incomeItems.find(
          (item) => item.month === month && item.name === name
        );
        entry[name] = match ? Number(match.total || 0) : 0;
      });
      return entry;
    });
  }, [incomeItems]);

  const expenseSeries = Array.from(new Set(expenseItems.map((item) => item.name)));
  const incomeSeries = Array.from(new Set(incomeItems.map((item) => item.name)));

  return (
    <div className="report-page">
      <header className="page-header">
        <div>
          <h1>Bank category report</h1>
          <p>Track how category outflows spread across the year.</p>
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
        <div className="series-picker">
          <label>
            Chart series
            <input
              type="number"
              min="1"
              max="50"
              value={limit}
              onChange={(event) => setLimit(Number(event.target.value))}
            />
          </label>
          <span className="helper">Controls chart only</span>
        </div>
      </header>

      <section className="card report-card">
        <div className="card-header">
          <h3>Monthly expense categories</h3>
          <p>Top expense categories stacked by month</p>
        </div>
        <div className="chart">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart
              data={expenseChartData}
              onClick={(data) => {
                const monthValue = data?.activePayload?.[0]?.payload?.month;
                if (!monthValue) {
                  return;
                }
                navigate(`/bank/month/${monthValue}?direction=expense`);
              }}
            >
              <XAxis dataKey="label" />
              <YAxis hide />
              <Tooltip
                content={
                  <SortedTooltip
                    totalByMonth={expenseTotals}
                    seriesCount={expenseSeries.length}
                    directionLabel="Expense"
                  />
                }
              />
              <Legend />
              {expenseSeries.map((name, index) => (
                <Bar
                  key={name}
                  dataKey={name}
                  stackId="categories"
                  fill={COLORS[index % COLORS.length]}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="card report-card">
        <div className="card-header">
          <h3>Monthly income categories</h3>
          <p>Top income categories stacked by month</p>
        </div>
        <div className="chart">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart
              data={incomeChartData}
              onClick={(data) => {
                const monthValue = data?.activePayload?.[0]?.payload?.month;
                if (!monthValue) {
                  return;
                }
                navigate(`/bank/month/${monthValue}?direction=income`);
              }}
            >
              <XAxis dataKey="label" />
              <YAxis hide />
              <Tooltip
                content={
                  <SortedTooltip
                    totalByMonth={incomeTotals}
                    seriesCount={incomeSeries.length}
                    directionLabel="Income"
                  />
                }
              />
              <Legend />
              {incomeSeries.map((name, index) => (
                <Bar
                  key={name}
                  dataKey={name}
                  stackId="categories"
                  fill={COLORS[index % COLORS.length]}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="card report-card">
        <div className="card-header">
          <h3>All categories</h3>
          <p>Split by income and expense</p>
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
            <h4>Expenses</h4>
            <ul className="list selectable">
              {expenseCategories.map((item) => (
                <li key={`expense-${item.id ?? "uncat"}-${item.name}`}>
                  <span>{item.name}</span>
                  <strong>{formatMoney(item.total)}</strong>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h4>Income</h4>
            <ul className="list selectable">
              {incomeCategories.map((item) => (
                <li key={`income-${item.id ?? "uncat"}-${item.name}`}>
                  <span>{item.name}</span>
                  <strong>{formatMoney(item.total)}</strong>
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
