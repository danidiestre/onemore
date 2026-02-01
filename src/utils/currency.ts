export function formatCurrencyEUR(cents: number): string {
  const euros = cents / 100;
  return `€${euros.toFixed(2)}`;
}
