import { writable } from 'svelte/store';
import { invoke } from '@tauri-apps/api/core';
import type { DatabaseInfo, KeyInfo, HashField, ZSetMember } from '$lib/types';

// 当前选中的数据库
export const activeDb = writable<number>(0);

// 数据库列表
export const databases = writable<DatabaseInfo[]>([]);

// Key 列表
export const keys = writable<string[]>([]);

// Key 类型映射
export const keyTypes = writable<Map<string, string>>(new Map());

// 当前选中的 Key
export const activeKey = writable<string | null>(null);

// Key 详情
export const keyInfo = writable<KeyInfo | null>(null);

// Key 值
export const keyValue = writable<string | HashField[] | string[] | ZSetMember[] | null>(null);

// 搜索模式
export const searchPattern = writable<string>('*');

// 加载数据库列表
export async function loadDatabases(connectionId: string) {
  try {
    const result = await invoke<DatabaseInfo[]>('get_dbs', { id: connectionId });
    databases.set(result);
    return result;
  } catch (e) {
    console.error('Failed to load databases:', e);
    return [];
  }
}

// 刷新数据库列表
export async function refreshDatabases(connectionId: string) {
  return loadDatabases(connectionId);
}

// 选择数据库
export async function selectDatabase(connectionId: string, db: number) {
  try {
    await invoke('select_db', { id: connectionId, db });
    activeDb.set(db);
    activeKey.set(null);
    keyInfo.set(null);
    keyValue.set(null);
    await loadKeys(connectionId);
    return true;
  } catch (e) {
    console.error('Failed to select database:', e);
    return false;
  }
}

// 加载 Key 列表
export async function loadKeys(connectionId: string, pattern?: string) {
  try {
    const [cursor, result] = await invoke<[number, string[]]>('get_keys', { 
      id: connectionId, 
      pattern: pattern || '*',
      cursor: 0,
      count: 500
    });
    keys.set(result);
    
    // 批量获取 key 类型
    const typesMap = new Map<string, string>();
    const batchSize = 50;
    for (let i = 0; i < result.length; i += batchSize) {
      const batch = result.slice(i, i + batchSize);
      const typePromises = batch.map(async (key) => {
        try {
          const info = await invoke<KeyInfo>('get_key_info', { id: connectionId, key });
          return { key, type: info.key_type };
        } catch {
          return { key, type: 'unknown' };
        }
      });
      const results = await Promise.all(typePromises);
      for (const { key, type } of results) {
        typesMap.set(key, type);
      }
    }
    keyTypes.set(typesMap);
    
    return result;
  } catch (e) {
    console.error('Failed to load keys:', e);
    return [];
  }
}

// 刷新 Key 列表
export async function refreshKeys(connectionId: string) {
  const pattern = '$searchPattern' as any;
  return loadKeys(connectionId, '*');
}

// 加载 Key 详情
export async function loadKeyInfo(connectionId: string, key: string) {
  try {
    const info = await invoke<KeyInfo>('get_key_info', { id: connectionId, key });
    keyInfo.set(info);
    return info;
  } catch (e) {
    console.error('Failed to load key info:', e);
    return null;
  }
}

// 加载 Key 值
export async function loadKeyValue(connectionId: string, key: string, keyType: string) {
  try {
    let value;
    switch (keyType) {
      case 'string':
        value = await invoke<string>('get_string', { id: connectionId, key });
        break;
      case 'hash':
        value = await invoke<HashField[]>('get_hash', { id: connectionId, key });
        break;
      case 'list':
        value = await invoke<string[]>('get_list', { id: connectionId, key });
        break;
      case 'set':
        value = await invoke<string[]>('get_set', { id: connectionId, key });
        break;
      case 'zset':
        value = await invoke<ZSetMember[]>('get_zset', { id: connectionId, key });
        break;
      default:
        value = null;
    }
    keyValue.set(value);
    return value;
  } catch (e) {
    console.error('Failed to load key value:', e);
    return null;
  }
}

// 选择 Key
export async function selectKey(connectionId: string, key: string) {
  activeKey.set(key);
  const info = await loadKeyInfo(connectionId, key);
  if (info) {
    await loadKeyValue(connectionId, key, info.key_type);
  }
}

// 刷新当前 Key
export async function refreshCurrentKey(connectionId: string) {
  const key = '$activeKey' as any;
  const info = '$keyInfo' as any;
  if (key && info) {
    await loadKeyValue(connectionId, key, info.key_type);
  }
}

// 删除 Key
export async function deleteKey(connectionId: string, key: string) {
  try {
    await invoke('delete_key', { id: connectionId, key });
    keys.update(k => k.filter(kk => kk !== key));
    activeKey.set(null);
    keyInfo.set(null);
    keyValue.set(null);
    // 刷新数据库列表（更新 key 数量）
    await loadDatabases(connectionId);
    return true;
  } catch (e) {
    console.error('Failed to delete key:', e);
    return false;
  }
}

// 重命名 Key
export async function renameKey(connectionId: string, oldKey: string, newKey: string) {
  try {
    await invoke('rename_key', { id: connectionId, oldKey, newKey });
    keys.update(k => k.map(kk => kk === oldKey ? newKey : kk));
    activeKey.set(newKey);
    return true;
  } catch (e) {
    console.error('Failed to rename key:', e);
    return false;
  }
}

// 设置 TTL
export async function setKeyTtl(connectionId: string, key: string, ttl: number) {
  try {
    await invoke('set_ttl', { id: connectionId, key, ttl });
    keyInfo.update(info => info ? { ...info, ttl } : null);
    return true;
  } catch (e) {
    console.error('Failed to set TTL:', e);
    return false;
  }
}

// 设置 String 值
export async function setStringValue(connectionId: string, key: string, value: string) {
  try {
    await invoke('set_string', { id: connectionId, key, value });
    keyValue.set(value);
    return true;
  } catch (e) {
    console.error('Failed to set string:', e);
    return false;
  }
}

// 设置 Hash 字段
export async function setHashField(connectionId: string, key: string, field: string, value: string) {
  try {
    await invoke('set_hash_field', { id: connectionId, key, field, value });
    await loadKeyValue(connectionId, key, 'hash');
    return true;
  } catch (e) {
    console.error('Failed to set hash field:', e);
    return false;
  }
}

// 删除 Hash 字段
export async function deleteHashField(connectionId: string, key: string, field: string) {
  try {
    await invoke('delete_hash_field', { id: connectionId, key, field });
    await loadKeyValue(connectionId, key, 'hash');
    return true;
  } catch (e) {
    console.error('Failed to delete hash field:', e);
    return false;
  }
}

// 添加 List 元素
export async function pushListValue(connectionId: string, key: string, value: string, atHead: boolean = true) {
  try {
    await invoke('push_list', { id: connectionId, key, value, atHead });
    await loadKeyValue(connectionId, key, 'list');
    return true;
  } catch (e) {
    console.error('Failed to push list:', e);
    return false;
  }
}

// 设置 List 元素值
export async function setListValue(connectionId: string, key: string, index: number, value: string) {
  try {
    await invoke('set_list_value', { id: connectionId, key, index, value });
    await loadKeyValue(connectionId, key, 'list');
    return true;
  } catch (e) {
    console.error('Failed to set list value:', e);
    return false;
  }
}

// 删除 List 元素
export async function removeListValue(connectionId: string, key: string, value: string, count: number = 1) {
  try {
    await invoke('remove_list_value', { id: connectionId, key, count, value });
    await loadKeyValue(connectionId, key, 'list');
    return true;
  } catch (e) {
    console.error('Failed to remove list value:', e);
    return false;
  }
}

// 添加 Set 成员
export async function addSetMember(connectionId: string, key: string, member: string) {
  try {
    await invoke('add_set', { id: connectionId, key, member });
    await loadKeyValue(connectionId, key, 'set');
    return true;
  } catch (e) {
    console.error('Failed to add set member:', e);
    return false;
  }
}

// 删除 Set 成员
export async function removeSetMember(connectionId: string, key: string, member: string) {
  try {
    await invoke('remove_set_member', { id: connectionId, key, member });
    await loadKeyValue(connectionId, key, 'set');
    return true;
  } catch (e) {
    console.error('Failed to remove set member:', e);
    return false;
  }
}

// 添加 ZSet 成员
export async function addZSetMember(connectionId: string, key: string, member: string, score: number) {
  try {
    await invoke('add_zset', { id: connectionId, key, member, score });
    await loadKeyValue(connectionId, key, 'zset');
    return true;
  } catch (e) {
    console.error('Failed to add zset member:', e);
    return false;
  }
}

// 删除 ZSet 成员
export async function deleteZSetMember(connectionId: string, key: string, member: string) {
  try {
    await invoke('delete_zset_member', { id: connectionId, key, member });
    await loadKeyValue(connectionId, key, 'zset');
    return true;
  } catch (e) {
    console.error('Failed to delete zset member:', e);
    return false;
  }
}

// 新建 Key
export async function createKey(
  connectionId: string, 
  key: string, 
  keyType: string,
  value: string,
  ttl: number = -1
) {
  try {
    switch (keyType) {
      case 'string':
        await invoke('set_string', { id: connectionId, key, value });
        break;
      case 'hash':
        // value 格式: field1=value1,field2=value2
        const hashPairs = value.split(',').map(p => p.trim());
        for (const pair of hashPairs) {
          const [field, val] = pair.split('=');
          if (field && val) {
            await invoke('set_hash_field', { id: connectionId, key, field: field.trim(), value: val.trim() });
          }
        }
        break;
      case 'list':
        // value 格式: item1,item2,item3
        const listItems = value.split(',').map(i => i.trim());
        for (const item of listItems) {
          if (item) {
            await invoke('push_list', { id: connectionId, key, value: item, atHead: false });
          }
        }
        break;
      case 'set':
        // value 格式: member1,member2,member3
        const setMembers = value.split(',').map(m => m.trim());
        for (const member of setMembers) {
          if (member) {
            await invoke('add_set', { id: connectionId, key, member });
          }
        }
        break;
      case 'zset':
        // value 格式: member1=score1,member2=score2
        const zsetPairs = value.split(',').map(p => p.trim());
        for (const pair of zsetPairs) {
          const [member, scoreStr] = pair.split('=');
          const score = parseFloat(scoreStr?.trim() || '');
          if (member && !isNaN(score)) {
            await invoke('add_zset', { id: connectionId, key, member: member.trim(), score });
          }
        }
        break;
    }
    
    // 设置 TTL
    if (ttl > 0) {
      await invoke('set_ttl', { id: connectionId, key, ttl });
    }
    
    // 刷新 key 列表
    await loadKeys(connectionId);
    
    // 刷新数据库列表（更新 key 数量）
    await loadDatabases(connectionId);
    
    // 选中新创建的 key
    await selectKey(connectionId, key);
    
    return true;
  } catch (e) {
    console.error('Failed to create key:', e);
    return false;
  }
}
