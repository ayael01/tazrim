import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  LabelList,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { getCategoryColor } from "../utils/bankColors.js";
import { formatMonthLabel } from "../utils/bankDates.js";
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

function formatMoneyDetailed(value) {
  return new Intl.NumberFormat("en-IL", {
    style: "currency",
    currency: "ILS",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

function formatMoneyCompact(value) {
  return new Intl.NumberFormat("en-IL", {
    style: "currency",
    currency: "ILS",
    notation: "compact",
    maximumFractionDigits: 1,
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
        <span>{formatMoneyDetailed(total)}</span>
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
            <span>{formatMoneyDetailed(entry.value)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function TrendTooltip({ active, payload, label, average }) {
  if (!active || !payload?.length) {
    return null;
  }
  const value = Number(payload[0]?.value || 0);
  const diff = value - Number(average || 0);
  return (
    <div className="tooltip">
      <strong>{label}</strong>
      <div className="tooltip-total">
        <span>Month total</span>
        <span>{formatMoneyDetailed(value)}</span>
      </div>
      <div className="tooltip-row">
        <span>Vs average</span>
        <span>{`${diff >= 0 ? "+" : "-"}${formatMoneyDetailed(Math.abs(diff))}`}</span>
      </div>
    </div>
  );
}

export default function BankCategoriesReport() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialYearParam = Number(searchParams.get("year"));
  const [year, setYear] = useState(
    Number.isFinite(initialYearParam) ? initialYearParam : new Date().getFullYear()
  );
  const [years, setYears] = useState([]);
  const [cashflowItems, setCashflowItems] = useState([]);
  const [expenseItems, setExpenseItems] = useState([]);
  const [incomeItems, setIncomeItems] = useState([]);
  const [expenseCategories, setExpenseCategories] = useState([]);
  const [incomeCategories, setIncomeCategories] = useState([]);
  const [expenseRule, setExpenseRule] = useState(
    () => loadBankCategoryRules().expense
  );
  const [incomeRule, setIncomeRule] = useState(
    () => loadBankCategoryRules().income
  );
  const [filter, setFilter] = useState("");
  const [listOffset, setListOffset] = useState(0);
  const [listLoading, setListLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [trendSelection, setTrendSelection] = useState(null);
  const [trendMonth, setTrendMonth] = useState(null);
  const [trendActivities, setTrendActivities] = useState([]);
  const [trendLoading, setTrendLoading] = useState(false);
  const [trendError, setTrendError] = useState("");

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
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set("year", String(year));
      return next;
    });
  }, [setSearchParams, year]);

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
    saveBankCategoryRules({ income: incomeRule, expense: expenseRule });
  }, [incomeRule, expenseRule]);

  const expenseAvailableNames = useMemo(
    () => Array.from(new Set(expenseItems.map((item) => item.name))).sort(),
    [expenseItems]
  );
  const incomeAvailableNames = useMemo(
    () => Array.from(new Set(incomeItems.map((item) => item.name))).sort(),
    [incomeItems]
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
        incomeTotal: incomeStack.reduce((sum, item) => sum + item.value, 0),
        expenseTotal: expenseStack.reduce((sum, item) => sum + item.value, 0),
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

  const trendMonths = useMemo(
    () =>
      Array.from({ length: 12 }, (_, index) =>
        `${year}-${String(index + 1).padStart(2, "0")}`
      ),
    [year]
  );

  const trendSeries = useMemo(() => {
    if (!trendSelection) {
      return [];
    }
    const source = trendSelection.direction === "income" ? incomeItems : expenseItems;
    const totals = new Map();
    source
      .filter((item) => item.name === trendSelection.name)
      .forEach((item) => {
        totals.set(item.month, Number(item.total || 0));
      });
    return trendMonths.map((month) => ({
      month,
      label: formatMonthLabel(month),
      total: totals.get(month) || 0,
    }));
  }, [trendSelection, incomeItems, expenseItems, trendMonths]);

  const trendActiveSeries = useMemo(
    () => trendSeries.filter((item) => Number(item.total || 0) > 0),
    [trendSeries]
  );
  const trendTotal = useMemo(
    () => trendActiveSeries.reduce((sum, item) => sum + Number(item.total || 0), 0),
    [trendActiveSeries]
  );
  const trendAverage = useMemo(
    () => trendTotal / (trendActiveSeries.length || 1),
    [trendTotal, trendActiveSeries.length]
  );
  const trendHighest = useMemo(() => {
    if (!trendActiveSeries.length) {
      return null;
    }
    return trendActiveSeries.reduce(
      (max, item) => (item.total > max.total ? item : max),
      trendActiveSeries[0]
    );
  }, [trendActiveSeries]);
  const trendLowest = useMemo(() => {
    if (!trendActiveSeries.length) {
      return null;
    }
    return trendActiveSeries.reduce(
      (min, item) => (item.total < min.total ? item : min),
      trendActiveSeries[0]
    );
  }, [trendActiveSeries]);

  const yearIncomeTotal = useMemo(
    () =>
      incomeItems
        .filter((item) => selectedIncomeCategories.has(item.name))
        .reduce((sum, item) => sum + Number(item.total || 0), 0),
    [incomeItems, selectedIncomeCategories]
  );
  const yearExpenseTotal = useMemo(
    () =>
      expenseItems
        .filter((item) => selectedExpenseCategories.has(item.name))
        .reduce((sum, item) => sum + Number(item.total || 0), 0),
    [expenseItems, selectedExpenseCategories]
  );
  const activeMonthCount = chartData.length || 1;
  const averageIncomeMonthly = yearIncomeTotal / activeMonthCount;
  const averageExpenseMonthly = yearExpenseTotal / activeMonthCount;
  const yearNet = yearIncomeTotal - yearExpenseTotal;

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

  function renderStackTotalLabel(direction, rankIndex) {
    return function StackTotalLabel(props) {
      const { payload, value, x, y, width } = props;
      if (!payload || !Number(value)) {
        return null;
      }
      const nextRankValue = Number(payload[`${direction}_rank_${rankIndex + 1}`] || 0);
      if (nextRankValue > 0) {
        return null;
      }
      const total =
        direction === "income" ? Number(payload.incomeTotal || 0) : Number(payload.expenseTotal || 0);
      if (!total) {
        return null;
      }
      const textX = Number(x || 0) + Number(width || 0) / 2;
      const textY = Number(y || 0) - 8;
      return (
        <text x={textX} y={textY} textAnchor="middle" className="bar-total-label">
          {formatMoneyCompact(total)}
        </text>
      );
    };
  }

  function toggleCategory(direction, name) {
    if (direction === "income") {
      setIncomeRule((prev) => toggleRule(prev, name));
    } else {
      setExpenseRule((prev) => toggleRule(prev, name));
    }
  }

  function selectAll(direction) {
    if (direction === "income") {
      setIncomeRule(selectAllRule());
    } else {
      setExpenseRule(selectAllRule());
    }
  }

  function clearAll(direction) {
    if (direction === "income") {
      setIncomeRule(clearAllRule());
    } else {
      setExpenseRule(clearAllRule());
    }
  }

  function handleBarClick(direction, data) {
    const monthValue = data?.payload?.month;
    if (!monthValue) {
      return;
    }
    navigate(`/bank/month/${monthValue}?direction=${direction}&year=${year}`);
  }

  function handleTrendSelect(direction, name) {
    setTrendSelection({ direction, name });
    setTrendMonth(null);
    setTrendActivities([]);
    setTrendError("");
  }

  useEffect(() => {
    async function loadTrendActivities() {
      if (!trendSelection || !trendMonth) {
        return;
      }
      const [, monthPart] = trendMonth.split("-");
      const monthValue = Number(monthPart);
      if (!monthValue) {
        return;
      }
      try {
        setTrendLoading(true);
        const response = await fetch(
          `${API_BASE}/bank/activities?year=${year}&month=${monthValue}&direction=${trendSelection.direction}&category_name=${encodeURIComponent(
            trendSelection.name
          )}&limit=200`
        );
        if (!response.ok) {
          throw new Error("Failed to load activities");
        }
        const payload = await response.json();
        setTrendActivities(payload.items ?? []);
        setTrendError("");
      } catch (err) {
        setTrendError(err.message);
      } finally {
        setTrendLoading(false);
      }
    }
    loadTrendActivities();
  }, [trendSelection, trendMonth, year]);

  return (
    <div className="report-page">
      <header className="page-header bank-categories-header">
        <div className="bank-categories-header-main">
          <h1>Bank category report</h1>
          <p>Compare monthly income and expenses at a glance.</p>
        </div>
        <div className="year-picker bank-year-picker">
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
        <div className="summary summary-inline">
          <div className="summary-card">
            <span className="label">Total income</span>
            <strong>{formatMoney(yearIncomeTotal)}</strong>
          </div>
          <div className="summary-card">
            <span className="label">Total expenses</span>
            <strong>{formatMoney(yearExpenseTotal)}</strong>
          </div>
          <div className="summary-card">
            <span className="label">Avg monthly income</span>
            <strong>{formatMoney(averageIncomeMonthly)}</strong>
          </div>
          <div className="summary-card">
            <span className="label">Avg monthly expenses</span>
            <strong>{formatMoney(averageExpenseMonthly)}</strong>
          </div>
          <div className="summary-card">
            <span className="label">Net</span>
            <strong className={yearNet >= 0 ? "summary-value positive" : "summary-value negative"}>
              {formatMoney(yearNet)}
            </strong>
          </div>
        </div>
        <div className="chart chart-wrapper">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              barCategoryGap={18}
              barGap={6}
              margin={{ top: 32, right: 20, left: 0, bottom: 24 }}
            >
              <CartesianGrid vertical={false} stroke="rgba(20, 19, 26, 0.12)" />
              <XAxis dataKey="label" axisLine={false} tickLine={false} />
              <YAxis
                tickFormatter={formatAxis}
                axisLine={false}
                tickLine={false}
                width={52}
                tickCount={5}
              />
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
                  <LabelList content={renderStackTotalLabel("income", index)} />
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
                  <LabelList content={renderStackTotalLabel("expense", index)} />
                </Bar>
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="card report-card">
        <div className="card-header">
          <h3>Category trend</h3>
          <p>
            {trendSelection
              ? `${trendSelection.name} · ${trendSelection.direction}`
              : "Select a category to see its monthly trend"}
          </p>
        </div>
        {trendSelection ? (
          <div>
            <div className="summary summary-inline detail-metrics">
              <div className="summary-card">
                <span className="label">Total</span>
                <strong>{formatMoney(trendTotal)}</strong>
              </div>
              <div className="summary-card">
                <span className="label">Average (active months)</span>
                <strong>{formatMoney(trendAverage)}</strong>
              </div>
              <div className="summary-card">
                <span className="label">Highest</span>
                <strong>
                  {trendHighest ? `${trendHighest.label} · ${formatMoney(trendHighest.total)}` : "--"}
                </strong>
              </div>
              <div className="summary-card">
                <span className="label">Lowest</span>
                <strong>
                  {trendLowest ? `${trendLowest.label} · ${formatMoney(trendLowest.total)}` : "--"}
                </strong>
              </div>
            </div>
            <div className="chart">
              <ResponsiveContainer width="100%" height={240}>
                <LineChart
                  data={trendSeries}
                  onClick={(payload) => {
                    const monthValue = payload?.activePayload?.[0]?.payload?.month;
                    if (monthValue) {
                      setTrendMonth(monthValue);
                    }
                  }}
                >
                  <XAxis dataKey="label" />
                  <YAxis
                    tickFormatter={formatMoneyCompact}
                    axisLine={false}
                    tickLine={false}
                    width={72}
                    tickCount={5}
                  />
                  <CartesianGrid vertical={false} stroke="rgba(20, 19, 26, 0.12)" />
                  <Tooltip content={<TrendTooltip average={trendAverage} />} />
                  <ReferenceLine
                    y={trendAverage}
                    stroke="#6a6775"
                    strokeDasharray="4 4"
                    label={{
                      value: `Avg ${formatMoneyCompact(trendAverage)}`,
                      position: "insideTopRight",
                      fill: "#6a6775",
                      fontSize: 12,
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="total"
                    stroke={getCategoryColor(trendSelection.direction, trendSelection.name)}
                    strokeWidth={3}
                    dot={{ r: 3 }}
                    activeDot={{ r: 5 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        ) : (
          <div className="empty-state">Pick an income or expense category below.</div>
        )}
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
                        handleTrendSelect("income", item.name);
                      }}
                    >
                      Trend
                    </button>
                  </label>
                </li>
              ))}
            </ul>
          </div>
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
                        handleTrendSelect("expense", item.name);
                      }}
                    >
                      Trend
                    </button>
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

      {trendSelection && trendMonth && (
        <div className="modal-overlay" onClick={() => setTrendMonth(null)}>
          <div className="modal-card" onClick={(event) => event.stopPropagation()}>
            <div className="card-header">
              <h3>
                {trendSelection.name} in {trendMonth}
              </h3>
              <button className="ghost-button" onClick={() => setTrendMonth(null)}>
                Close
              </button>
            </div>
            {trendLoading && <span className="pill">Loading activities</span>}
            {trendError && <span className="pill error">{trendError}</span>}
            {!trendLoading && !trendError && (
              <div className="detail-list">
                {trendActivities.map((activity) => (
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
                {trendActivities.length === 0 && (
                  <div className="empty-state">No activities for this month.</div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
