/**
 * Convierte un monto a USD usando los tipos de cambio guardados en la rendición.
 * exchange_rates formato: { "UYU": 43.5 } → 1 USD = 43.5 UYU
 * USD siempre tiene rate = 1.
 *
 * Retorna null si no hay tipo de cambio definido para esa moneda.
 */
export function toUSD(
  amount: number,
  currency: string,
  rates: Record<string, number> | null | undefined
): number | null {
  if (currency === "USD") return amount;
  const rate = rates?.[currency];
  if (!rate || rate <= 0) return null;
  return amount / rate;
}

/**
 * Convierte desde USD a una moneda destino usando rates (1 USD = X moneda).
 */
export function fromUSD(
  amountUsd: number,
  targetCurrency: string,
  rates: Record<string, number> | null | undefined
): number | null {
  if (targetCurrency === "USD") return amountUsd;
  const rate = rates?.[targetCurrency];
  if (!rate || rate <= 0) return null;
  return amountUsd * rate;
}

/**
 * Convierte un monto entre monedas usando USD como pivote.
 */
export function convertAmount(
  amount: number,
  fromCurrency: string,
  toCurrency: string,
  rates: Record<string, number> | null | undefined
): number | null {
  if (fromCurrency === toCurrency) return amount;
  const usd = toUSD(amount, fromCurrency, rates);
  if (usd === null) return null;
  return fromUSD(usd, toCurrency, rates);
}

/**
 * Suma todos los gastos convertidos a USD.
 * Retorna null si falta al menos un tipo de cambio.
 */
export function totalInUSD(
  expenses: { amount: number; currency: string | null }[],
  rates: Record<string, number> | null | undefined
): number | null {
  let sum = 0;
  for (const e of expenses) {
    const usd = toUSD(Number(e.amount), e.currency ?? "UYU", rates);
    if (usd === null) return null;
    sum += usd;
  }
  return sum;
}

/**
 * Suma todos los gastos convertidos a una moneda destino.
 * Retorna null si falta al menos un tipo de cambio.
 */
export function totalInCurrency(
  expenses: { amount: number; currency: string | null }[],
  targetCurrency: string,
  rates: Record<string, number> | null | undefined
): number | null {
  let sum = 0;
  for (const e of expenses) {
    const converted = convertAmount(
      Number(e.amount),
      e.currency ?? "UYU",
      targetCurrency,
      rates,
    );
    if (converted === null) return null;
    sum += converted;
  }
  return sum;
}

/** Formato de número a 2 decimales en es-UY */
export function fmt(n: number) {
  return n.toLocaleString("es-UY", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
