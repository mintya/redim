
/**
 * Format large numbers with K/M suffixes
 */
export function formatNumber(num: string | number): string {
  const n = typeof num === 'number' ? num : (parseInt(num) || 0);
  if (n >= 1000000) return (n / 1000000).toFixed(2) + 'M';
  if (n >= 1000) return (n / 1000).toFixed(2) + 'K';
  return n.toString();
}
