export const INCOME_COLOR_MAP = {
  "משכורת אלי": "#2563EB",
  "משכורת גלי": "#06B6D4",
  "ניירות ערך": "#7C3AED",
  "העברות": "#14B8A6",
  "החזרים": "#0EA5E9",
  "ביטוח לאומי": "#A855F7",
  "שיקים תשלומים": "#4F46E5",
  "מס רווחי הון": "#9333EA",
  "קצבת ילדים": "#22C55E",
  "ריבית/פיקדון": "#0891B2",
  "אחר": "#64748B",
};

export const EXPENSE_COLOR_MAP = {
  "כרטיסי אשראי": "#EF4444",
  "משכנתא": "#F97316",
  "הוראת קבע אווה": "#F59E0B",
  "ועד בית": "#84CC16",
  "מכבי": "#EC4899",
  "חברת חשמל": "#EAB308",
  "ניירות ערך": "#B91C1C",
  "מס רווחי הון": "#9A3412",
  "העברות": "#FB7185",
  "שיקים תשלומים": "#DC2626",
  "עמלות": "#78716C",
  "אחר": "#64748B",
};

const FALLBACK_COLOR = "#64748B";

export function getCategoryColor(type, category) {
  if (type === "income" && INCOME_COLOR_MAP[category]) {
    return INCOME_COLOR_MAP[category];
  }
  if (type === "expense" && EXPENSE_COLOR_MAP[category]) {
    return EXPENSE_COLOR_MAP[category];
  }
  return FALLBACK_COLOR;
}
