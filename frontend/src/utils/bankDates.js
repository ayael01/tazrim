export function parseMonthKey(value) {
  if (!value) {
    return { year: null, month: null };
  }
  const [year, month] = value.split("-");
  return { year: Number(year), month: Number(month) };
}

export function formatMonthLabel(value) {
  if (!value) {
    return "";
  }
  const { year, month } = parseMonthKey(value);
  if (!year || !month) {
    return "";
  }
  return new Intl.DateTimeFormat("en-GB", { month: "short" }).format(
    new Date(year, month - 1, 1)
  );
}

export function formatMonthTitle(value) {
  if (!value) {
    return "";
  }
  const { year, month } = parseMonthKey(value);
  if (!year || !month) {
    return "";
  }
  return new Intl.DateTimeFormat("en-GB", {
    month: "long",
    year: "numeric",
  }).format(new Date(year, month - 1, 1));
}
