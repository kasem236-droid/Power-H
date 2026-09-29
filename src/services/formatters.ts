/**
 * Currency and Number Formatting Helpers for Power H
 * Default and displayed currency throughout the entire application is Egyptian Pound (ج.م)
 */

export const CURRENCY_SYMBOL = 'ج.م';

/**
 * Format a numeric amount with commas and the Egyptian Pound symbol
 * Example: formatCurrency(1500) => "1,500 ج.م"
 */
export function formatCurrency(amount: number | string | undefined | null): string {
  const num = Number(amount) || 0;
  const formattedNumber = new Intl.NumberFormat('ar-EG', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(num);

  return `${formattedNumber} ${CURRENCY_SYMBOL}`;
}

/**
 * Format only the number with proper thousand separators
 */
export function formatNumber(amount: number | string | undefined | null): string {
  const num = Number(amount) || 0;
  return new Intl.NumberFormat('ar-EG', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(num);
}
