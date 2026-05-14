
/**
 * Format large numbers with K/M suffixes
 */
export function formatNumber(num: string | number): string {
  const n = typeof num === 'number' ? num : (parseInt(num) || 0);
  if (n >= 1000000) return (n / 1000000).toFixed(2) + 'M';
  if (n >= 1000) return (n / 1000).toFixed(2) + 'K';
  return n.toString();
}

const BYTE_UNITS = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
const textEncoder = typeof TextEncoder !== 'undefined' ? new TextEncoder() : null;

/**
 * UTF-8 byte length of a string, correctly handling 4-byte chars (surrogate pairs).
 */
export function byteSize(s: string): number {
  if (!s) return 0;
  if (textEncoder) return textEncoder.encode(s).length;
  let bytes = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c < 0x80) bytes++;
    else if (c < 0x800) bytes += 2;
    else if (c >= 0xd800 && c <= 0xdbff) {
      bytes += 4;
      i++;
    } else bytes += 3;
  }
  return bytes;
}

/**
 * Human-readable byte size with 1024-base units (B / KB / MB / GB / TB / PB).
 */
export function formatBytes(bytes: number | null | undefined): string {
  if (bytes == null || !Number.isFinite(bytes) || bytes < 0) return '—';
  if (bytes === 0) return '0 B';
  let v = bytes;
  let i = 0;
  while (v >= 1024 && i < BYTE_UNITS.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(v >= 100 ? 0 : v >= 10 ? 1 : 2)} ${BYTE_UNITS[i]}`;
}
