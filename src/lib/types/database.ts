export interface DatabaseInfo {
  index: number;
  keys: number;
}

export interface KeyInfo {
  name: string;
  key_type: RedisType;
  ttl: number;
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
