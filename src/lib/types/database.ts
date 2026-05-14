export interface DatabaseInfo {
  index: number;
  keys: number;
}

export interface KeyInfo {
  name: string;
  key_type: RedisType;
  ttl: number;
  size_bytes: number | null;
}

export type RedisType = 'string' | 'hash' | 'list' | 'set' | 'zset' | 'stream' | 'none';

export interface HashField {
  field: string;
  value: string;
}

export interface ZSetMember {
  member: string;
  score: number;
}

export type KeyValue = string | HashField[] | string[] | ZSetMember[] | null;

/** 右侧详情区多标签：每个标签绑定连接 + 库 + key，并缓存详情数据 */
export interface KeyTab {
  id: string;
  connectionId: string;
  connectionLabel: string;
  db: number;
  key: string;
  keyInfo: KeyInfo | null;
  keyValue: KeyValue;
  keyInfoLoadedAt: number | null;
  lastFocusedAt: number;
}
