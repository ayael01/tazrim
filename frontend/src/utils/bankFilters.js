const STORAGE_KEY = "bankCategoryRules";

export function defaultRule() {
  return { mode: "all", excluded: [], included: [] };
}

function normalizeRule(rule) {
  if (!rule || typeof rule !== "object") {
    return defaultRule();
  }
  const mode =
    rule.mode === "all" || rule.mode === "none" || rule.mode === "custom"
      ? rule.mode
      : "all";
  const excluded = Array.isArray(rule.excluded) ? rule.excluded : [];
  const included = Array.isArray(rule.included) ? rule.included : [];
  return { mode, excluded, included };
}

export function loadBankCategoryRules() {
  if (typeof window === "undefined") {
    return { income: defaultRule(), expense: defaultRule() };
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return { income: defaultRule(), expense: defaultRule() };
    }
    const parsed = JSON.parse(raw);
    return {
      income: normalizeRule(parsed?.income),
      expense: normalizeRule(parsed?.expense),
    };
  } catch (err) {
    return { income: defaultRule(), expense: defaultRule() };
  }
}

export function saveBankCategoryRules(rules) {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        income: normalizeRule(rules.income),
        expense: normalizeRule(rules.expense),
      })
    );
  } catch (err) {
    // ignore storage failures
  }
}

export function isCategoryChecked(rule, name) {
  if (!name) {
    return false;
  }
  if (rule.mode === "none") {
    return rule.included.includes(name);
  }
  if (rule.mode === "custom") {
    return rule.included.includes(name);
  }
  return !rule.excluded.includes(name);
}

export function applyRule(rule, availableNames) {
  if (!Array.isArray(availableNames)) {
    return new Set();
  }
  if (rule.mode === "none") {
    return new Set(availableNames.filter((name) => rule.included.includes(name)));
  }
  if (rule.mode === "custom") {
    return new Set(availableNames.filter((name) => rule.included.includes(name)));
  }
  return new Set(availableNames.filter((name) => !rule.excluded.includes(name)));
}

export function toggleRule(rule, name) {
  const checked = isCategoryChecked(rule, name);
  if (rule.mode === "all") {
    if (checked) {
      return { ...rule, excluded: [...rule.excluded, name] };
    }
    return {
      ...rule,
      excluded: rule.excluded.filter((item) => item !== name),
    };
  }
  if (rule.mode === "none") {
    if (checked) {
      const nextIncluded = rule.included.filter((item) => item !== name);
      return { mode: "none", excluded: [], included: nextIncluded };
    }
    return { mode: "custom", excluded: [], included: [...rule.included, name] };
  }
  if (checked) {
    const nextIncluded = rule.included.filter((item) => item !== name);
    if (nextIncluded.length === 0) {
      return { mode: "none", excluded: [], included: [] };
    }
    return { mode: "custom", excluded: [], included: nextIncluded };
  }
  return { mode: "custom", excluded: [], included: [...rule.included, name] };
}

export function selectAllRule() {
  return { mode: "all", excluded: [], included: [] };
}

export function clearAllRule() {
  return { mode: "none", excluded: [], included: [] };
}
