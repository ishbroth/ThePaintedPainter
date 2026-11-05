/** "$1,200", or "Pending" while a job has no price yet. */
export const currency = (n: number | null) =>
  n == null ? 'Pending' : new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n);
