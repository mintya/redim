import { writable, get } from 'svelte/store';
import { invoke } from '@tauri-apps/api/core';
import { scanAllKeys } from '$lib/utils/redis';
import { showError, showSuccess, withErrorHandling } from '$lib/utils/error';
import { withLoading } from '$lib/stores/loading';
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
  return withLoading(
    async () => {
      const result = await withErrorHandling(
        () => invoke<DatabaseInfo[]>('get_dbs', { id: connectionId }),
        { errorMessage: '加载数据库列表失败' }
      );
      
      if (result.success && result.data) {
        databases.set(result.data);
        return result.data;
      }
      return [];
    },
    '加载数据库列表中...',
    'load-databases'
  );
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
    showError(e, '切换数据库失败');
    return false;
  }
}

export async function loadKeys(connectionId: string, pattern?: string) {
  return withLoading(
    async () => {
      const pat = pattern || '*';
      const result = await withErrorHandling(
        async () => {
          const allKeys = await scanAllKeys(connectionId, pat, 500);
          keys.set(allKeys);

          // 使用后端 get_keys_with_types 批量获取类型（避免 N+1）
          const typesMap = new Map<string, string>();
          let typeCursor: number = 0;
          const maxIterations = 100;
          let typeIterations = 0;
          do {
            const [nextTypeCursor, keyTypesBatch] = await invoke<[number, [string, string][]]>('get_keys_with_types', {
              id: connectionId,
              pattern: pat,
              cursor: typeCursor,
              count: 500,
            });
            for (const [key, type] of keyTypesBatch) {
              typesMap.set(key, type);
            }
            typeCursor = nextTypeCursor;
            typeIterations++;
          } while (typeCursor !== 0 && typeIterations < maxIterations);

          keyTypes.set(typesMap);
          return allKeys;
        },
        { errorMessage: '加载键列表失败' }
      );
      
      return result.success && result.data ? result.data : [];
    },
    '加载键列表中...',
    'load-keys'
  );
}

// 刷新 Key 列表
export async function refreshKeys(connectionId: string) {
  const currentPattern = get(searchPattern);
  return loadKeys(connectionId, currentPattern);
}

// 加载 Key 详情
export async function loadKeyInfo(connectionId: string, key: string) {
  const result = await withErrorHandling(
    () => invoke<KeyInfo>('get_key_info', { id: connectionId, key }),
    { errorMessage: '加载键详情失败' }
  );
  
  if (result.success && result.data) {
    keyInfo.set(result.data);
    return result.data;
  }
  return null;
}

// 加载 Key 值
export async function loadKeyValue(connectionId: string, key: string, keyType: string) {
  const result = await withErrorHandling(
    async () => {
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
    },
    { errorMessage: '加载键值失败' }
  );
  
  return result.success ? result.data : null;
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
  const currentKey = get(activeKey);
  const currentInfo = get(keyInfo);
  if (currentKey && currentInfo) {
    await loadKeyValue(connectionId, currentKey, currentInfo.key_type);
  }
}

// 删除 Key
export async function deleteKey(connectionId: string, key: string) {
  const result = await withErrorHandling(
    async () => {
      await invoke('delete_key', { id: connectionId, key });
      keys.update(k => k.filter(kk => kk !== key));
      activeKey.set(null);
      keyInfo.set(null);
      keyValue.set(null);
      // 刷新数据库列表（更新 key 数量）
      await loadDatabases(connectionId);
      showSuccess('键已删除');
      return true;
    },
    { errorMessage: '删除键失败' }
  );
  
  return result.success;
}

// 重命名 Key
export async function renameKey(connectionId: string, oldKey: string, newKey: string) {
  const result = await withErrorHandling(
    async () => {
      await invoke('rename_key', { id: connectionId, oldKey, newKey });
      keys.update(k => k.map(kk => kk === oldKey ? newKey : kk));
      activeKey.set(newKey);
      showSuccess('键已重命名');
      return true;
    },
    { errorMessage: '重命名键失败' }
  );
  
  return result.success;
}

// 设置 TTL
export async function setKeyTtl(connectionId: string, key: string, ttl: number) {
  const result = await withErrorHandling(
    async () => {
      await invoke('set_ttl', { id: connectionId, key, ttl });
      keyInfo.update(info => info ? { ...info, ttl } : null);
      showSuccess('TTL已更新');
      return true;
    },
    { errorMessage: '设置TTL失败' }
  );
  
  return result.success;
}

// 设置 String 值
export async function setStringValue(connectionId: string, key: string, value: string) {
  const result = await withErrorHandling(
    async () => {
      await invoke('set_string', { id: connectionId, key, value });
      keyValue.set(value);
      showSuccess('值已更新');
      return true;
    },
    { errorMessage: '设置字符串值失败' }
  );
  
  return result.success;
}

// 设置 Hash 字段
export async function setHashField(connectionId: string, key: string, field: string, value: string) {
  const result = await withErrorHandling(
    async () => {
      await invoke('set_hash_field', { id: connectionId, key, field, value });
      await loadKeyValue(connectionId, key, 'hash');
      showSuccess('Hash字段已更新');
      return true;
    },
    { errorMessage: '设置Hash字段失败' }
  );
  
  return result.success;
}

// 删除 Hash 字段
export async function deleteHashField(connectionId: string, key: string, field: string) {
  const result = await withErrorHandling(
    async () => {
      await invoke('delete_hash_field', { id: connectionId, key, field });
      await loadKeyValue(connectionId, key, 'hash');
      showSuccess('Hash字段已删除');
      return true;
    },
    { errorMessage: '删除Hash字段失败' }
  );
  
  return result.success;
}

// 添加 List 元素
export async function pushListValue(connectionId: string, key: string, value: string, atHead: boolean = true) {
  const result = await withErrorHandling(
    async () => {
      await invoke('push_list', { id: connectionId, key, value, atHead });
      await loadKeyValue(connectionId, key, 'list');
      showSuccess('列表元素已添加');
      return true;
    },
    { errorMessage: '添加列表元素失败' }
  );
  
  return result.success;
}

// 设置 List 元素值
export async function setListValue(connectionId: string, key: string, index: number, value: string) {
  const result = await withErrorHandling(
    async () => {
      await invoke('set_list_value', { id: connectionId, key, index, value });
      await loadKeyValue(connectionId, key, 'list');
      showSuccess('列表元素已更新');
      return true;
    },
    { errorMessage: '设置列表元素值失败' }
  );
  
  return result.success;
}

// 删除 List 元素
export async function removeListValue(connectionId: string, key: string, value: string, count: number = 1) {
  const result = await withErrorHandling(
    async () => {
      await invoke('remove_list_value', { id: connectionId, key, count, value });
      await loadKeyValue(connectionId, key, 'list');
      showSuccess('列表元素已删除');
      return true;
    },
    { errorMessage: '删除列表元素失败' }
  );
  
  return result.success;
}

// 添加 Set 成员
export async function addSetMember(connectionId: string, key: string, member: string) {
  const result = await withErrorHandling(
    async () => {
      await invoke('add_set', { id: connectionId, key, member });
      await loadKeyValue(connectionId, key, 'set');
      showSuccess('集合成员已添加');
      return true;
    },
    { errorMessage: '添加集合成员失败' }
  );
  
  return result.success;
}

// 删除 Set 成员
export async function removeSetMember(connectionId: string, key: string, member: string) {
  const result = await withErrorHandling(
    async () => {
      await invoke('remove_set_member', { id: connectionId, key, member });
      await loadKeyValue(connectionId, key, 'set');
      showSuccess('集合成员已删除');
      return true;
    },
    { errorMessage: '删除集合成员失败' }
  );
  
  return result.success;
}

// 添加 ZSet 成员
export async function addZSetMember(connectionId: string, key: string, member: string, score: number) {
  const result = await withErrorHandling(
    async () => {
      await invoke('add_zset', { id: connectionId, key, member, score });
      await loadKeyValue(connectionId, key, 'zset');
      showSuccess('有序集合成员已添加');
      return true;
    },
    { errorMessage: '添加有序集合成员失败' }
  );
  
  return result.success;
}

// 删除 ZSet 成员
export async function deleteZSetMember(connectionId: string, key: string, member: string) {
  const result = await withErrorHandling(
    async () => {
      await invoke('delete_zset_member', { id: connectionId, key, member });
      await loadKeyValue(connectionId, key, 'zset');
      showSuccess('有序集合成员已删除');
      return true;
    },
    { errorMessage: '删除有序集合成员失败' }
  );
  
  return result.success;
}

// 新建 Key
export async function createKey(
  connectionId: string, 
  key: string, 
  keyType: string,
  value: string,
  ttl: number = -1
) {
  return withLoading(
    async () => {
      const result = await withErrorHandling(
        async () => {
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
          
          showSuccess('键已创建');
          return true;
        },
        { errorMessage: '创建键失败' }
      );
      
      return result.success;
    },
    '创建键中...',
    'create-key'
  );
}
