/** Formats a US phone number as the person types: (123) 456-7890. Drops a leading 1 and anything past 10 digits. */
export function formatPhone(raw: string | null | undefined): string {
  let digits = String(raw ?? '').replace(/\D/g, '');
  if (digits.length > 10 && digits.startsWith('1')) digits = digits.slice(1);
  digits = digits.slice(0, 10);
  if (digits.length === 0) return '';
  if (digits.length < 4) return `(${digits}`;
  if (digits.length < 7) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}
