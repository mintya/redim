
export type RedisType = 'string' | 'hash' | 'list' | 'set' | 'zset' | 'stream';

export const TYPE_LABELS: Record<RedisType, string> = {
  string: 'S',
  hash: 'H',
  list: 'L',
  set: 'St',
  zset: 'Z',
  stream: 'Sr',
};

export const TYPE_COLORS_BG: Record<RedisType, string> = {
  string: 'bg-[var(--color-type-string)]',
  hash: 'bg-[var(--color-type-hash)]',
  list: 'bg-[var(--color-type-list)]',
  set: 'bg-[var(--color-type-set)]',
  zset: 'bg-[var(--color-type-zset)]',
  stream: 'bg-[var(--color-type-stream)]',
};

export const TYPE_COLORS_TEXT: Record<RedisType, string> = {
  string: 'text-[var(--color-type-string)]',
  hash: 'text-[var(--color-type-hash)]',
  list: 'text-[var(--color-type-list)]',
  set: 'text-[var(--color-type-set)]',
  zset: 'text-[var(--color-type-zset)]',
  stream: 'text-[var(--color-type-stream)]',
};

export function getTypeLabel(type: string | undefined): string {
  return TYPE_LABELS[type as RedisType] || '?';
}

export function getTypeColorBg(type: string | undefined): string {
  return TYPE_COLORS_BG[type as RedisType] || 'bg-[var(--color-macos-text-tertiary)]';
}

export function getTypeColorText(type: string): string {
  return TYPE_COLORS_TEXT[type as RedisType] || 'text-[var(--color-text-muted)]';
}
