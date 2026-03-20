const churchCurrencyFormatter = new Intl.NumberFormat("en-GH", {
  style: "currency",
  currency: "GHS",
  maximumFractionDigits: 2,
});

const churchCompactCurrencyFormatter = new Intl.NumberFormat("en-GH", {
  style: "currency",
  currency: "GHS",
  maximumFractionDigits: 0,
});

const adminCurrencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});

const adminCompactCurrencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

export function formatChurchCurrency(
  value: number,
  options?: { compact?: boolean },
) {
  return (options?.compact ? churchCompactCurrencyFormatter : churchCurrencyFormatter).format(
    value || 0,
  );
}

export function formatAdminCurrency(
  value: number,
  options?: { compact?: boolean },
) {
  return (options?.compact ? adminCompactCurrencyFormatter : adminCurrencyFormatter).format(
    value || 0,
  );
}
