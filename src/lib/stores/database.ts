import { writable, get, derived } from 'svelte/store';
import { invoke } from '@tauri-apps/api/core';
import { scanAllKeys } from '$lib/utils/redis';
import { showError, showSuccess, withErrorHandling } from '$lib/utils/error';
import { withLoading } from '$lib/stores/loading';
import { activeConnectionId, connections } from '$lib/stores/connection';
import type { DatabaseInfo, KeyInfo, HashField, ZSetMember, KeyTab, KeyValue } from '$lib/types';

export const MAX_KEY_TABS = 20;
const KEY_LOAD_LOG_PREFIX = '[key-load]';
const KEY_PREVIEW_LIMIT = 120;

// 当前选中的数据库
export const activeDb = writable<number>(0);

// 数据库列表
export const databases = writable<DatabaseInfo[]>([]);

// Key 列表
export const keys = writable<string[]>([]);

// Key 类型映射
export const keyTypes = writable<Map<string, string>>(new Map());

// 当前选中的 Key（详情区镜像 + 列表高亮辅助）
export const activeKey = writable<string | null>(null);

// Key 详情
export const keyInfo = writable<KeyInfo | null>(null);

// Key 值
export const keyValue = writable<KeyValue>(null);

// 详情区 Redis 命令使用的连接（可与顶部「当前连接」不同，用于多标签对比）
export const detailConnectionId = writable<string | null>(null);

// 多标签
export const keyTabs = writable<KeyTab[]>([]);
export const activeTabId = writable<string | null>(null);

export const activeKeyTab = derived([keyTabs, activeTabId], ([$tabs, $id]) =>
  $id ? $tabs.find(t => t.id === $id) ?? null : null
);

/** 仅当激活标签与左侧当前连接+库一致时高亮列表中的 key */
export const keyListHighlightKey = derived(
  [activeKey, activeTabId, keyTabs, activeConnectionId, activeDb],
  ([$key, $tabId, $tabs, $conn, $db]) => {
    if (!$tabId || !$key || !$conn) return null;
    const tab = $tabs.find(t => t.id === $tabId);
    if (!tab || tab.connectionId !== $conn || tab.db !== $db) return null;
    return $key;
  }
);

// 搜索模式
export const searchPattern = writable<string>('*');

function getConnectionLabel(connectionId: string): string {
  const list = get(connections);
  const c = list.find(x => x.id === connectionId);
  if (!c) return connectionId.slice(0, 8);
  return c.name?.trim() || `${c.host}:${c.port}`;
}

function previewKey(key: string): string {
  if (key.length <= KEY_PREVIEW_LIMIT) return key;
  return `${key.slice(0, KEY_PREVIEW_LIMIT)}...(${key.length})`;
}

function summarizeLoadedValue(value: KeyValue): string {
  if (value === null) return 'null';
  if (typeof value === 'string') return `string(len=${value.length})`;
  if (Array.isArray(value)) {
    if (value.length === 0) return 'array(len=0)';
    const first = value[0];
    if (typeof first === 'string') return `string[](len=${value.length})`;
    if (typeof first === 'object' && first !== null && 'field' in first) return `hash(len=${value.length})`;
    if (typeof first === 'object' && first !== null && 'member' in first) return `zset(len=${value.length})`;
    return `array(len=${value.length})`;
  }
  return typeof value;
}

function loadLog(level: 'info' | 'warn' | 'error', event: string, payload: Record<string, unknown>) {
  const message = `${KEY_LOAD_LOG_PREFIX} ${event}`;
  if (level === 'error') {
    console.error(message, payload);
    return;
  }
  if (level === 'warn') {
    console.warn(message, payload);
    return;
  }
  console.info(message, payload);
}

/** 将当前镜像写回激活标签（切换标签前调用） */
export function persistCurrentTabSnapshot() {
  const tid = get(activeTabId);
  if (!tid) return;
  const k = get(activeKey);
  const info = get(keyInfo);
  const val = get(keyValue);
  keyTabs.update(tabs =>
    tabs.map(t =>
      t.id === tid ? { ...t, key: k ?? t.key, keyInfo: info, keyValue: val, lastFocusedAt: Date.now() } : t
    )
  );
}

function syncActiveTabFromMirrors() {
  const tid = get(activeTabId);
  if (!tid) return;
  const k = get(activeKey);
  const info = get(keyInfo);
  const val = get(keyValue);
  keyTabs.update(tabs =>
    tabs.map(t => (t.id === tid ? { ...t, key: k ?? t.key, keyInfo: info, keyValue: val } : t))
  );
}

function enforceMaxTabs(keepId: string) {
  keyTabs.update(tabs => {
    let t = [...tabs];
    while (t.length > MAX_KEY_TABS) {
      const candidates = t.filter(x => x.id !== keepId);
      if (candidates.length === 0) break;
      candidates.sort((a, b) => a.lastFocusedAt - b.lastFocusedAt);
      const victim = candidates[0];
      t = t.filter(x => x.id !== victim.id);
    }
    return t;
  });
}

/** 断开连接时移除相关标签（由 connection.disconnect 动态调用，避免循环依赖） */
export function removeKeyTabsForConnection(connectionId: string) {
  persistCurrentTabSnapshot();
  keyTabs.update(tabs => tabs.filter(t => t.connectionId !== connectionId));

  const remaining = get(keyTabs);
  const curTab = get(activeTabId);
  if (!curTab || !remaining.find(t => t.id === curTab)) {
    if (remaining.length === 0) {
      activeTabId.set(null);
      detailConnectionId.set(null);
      activeKey.set(null);
      keyInfo.set(null);
      keyValue.set(null);
    } else {
      void activateTab(remaining[remaining.length - 1].id);
    }
  }
}

export async function activateTab(tabId: string) {
  const prevId = get(activeTabId);
  if (prevId === tabId) {
    keyTabs.update(tabs => tabs.map(t => (t.id === tabId ? { ...t, lastFocusedAt: Date.now() } : t)));
    return;
  }

  persistCurrentTabSnapshot();

  const tabs = get(keyTabs);
  const tab = tabs.find(t => t.id === tabId);
  if (!tab) return;

  activeTabId.set(tabId);
  detailConnectionId.set(tab.connectionId);
  keyTabs.update(ts => ts.map(t => (t.id === tabId ? { ...t, lastFocusedAt: Date.now() } : t)));

  try {
    await invoke('select_db', { id: tab.connectionId, db: tab.db });
  } catch (e) {
    showError(e, '切换数据库失败');
    return;
  }

  activeKey.set(tab.key);
  keyInfo.set(tab.keyInfo);
  keyValue.set(tab.keyValue);

  if (tab.keyInfo && tab.key) {
    return;
  }

  if (tab.key) {
    const info = await loadKeyInfo(tab.connectionId, tab.key);
    if (info) {
      await loadKeyValue(tab.connectionId, tab.key, info.key_type);
    } else {
      loadLog('warn', 'activateTab:missing-key-info', {
        tabId,
        connectionId: tab.connectionId,
        key: previewKey(tab.key),
      });
    }
  }
  syncActiveTabFromMirrors();
}

export async function openOrFocusTab(connectionId: string, db: number, key: string) {
  persistCurrentTabSnapshot();

  const tabs = get(keyTabs);
  const existing = tabs.find(t => t.connectionId === connectionId && t.db === db && t.key === key);
  if (existing) {
    await activateTab(existing.id);
    return;
  }

  const label = getConnectionLabel(connectionId);
  const now = Date.now();
  const newTab: KeyTab = {
    id: crypto.randomUUID(),
    connectionId,
    connectionLabel: label,
    db,
    key,
    keyInfo: null,
    keyValue: null,
    lastFocusedAt: now,
  };

  keyTabs.update(ts => [...ts, newTab]);
  enforceMaxTabs(newTab.id);

  activeTabId.set(newTab.id);
  detailConnectionId.set(connectionId);

  try {
    await invoke('select_db', { id: connectionId, db });
  } catch (e) {
    showError(e, '切换数据库失败');
    keyTabs.update(ts => ts.filter(t => t.id !== newTab.id));
    activeTabId.set(null);
    detailConnectionId.set(null);
    activeKey.set(null);
    keyInfo.set(null);
    keyValue.set(null);
    return;
  }

  activeKey.set(key);
  keyInfo.set(null);
  keyValue.set(null);

  const info = await loadKeyInfo(connectionId, key);
  if (info) {
    await loadKeyValue(connectionId, key, info.key_type);
  } else {
    loadLog('warn', 'openOrFocusTab:missing-key-info', {
      tabId: newTab.id,
      connectionId,
      db,
      key: previewKey(key),
    });
  }
  syncActiveTabFromMirrors();
}

export function closeTab(tabId: string) {
  const tabs = get(keyTabs);
  const idx = tabs.findIndex(t => t.id === tabId);
  if (idx === -1) return;

  const wasActive = get(activeTabId) === tabId;
  if (wasActive) {
    persistCurrentTabSnapshot();
  }

  const nextTabs = tabs.filter(t => t.id !== tabId);
  keyTabs.set(nextTabs);

  if (!wasActive) return;

  if (nextTabs.length === 0) {
    activeTabId.set(null);
    detailConnectionId.set(null);
    activeKey.set(null);
    keyInfo.set(null);
    keyValue.set(null);
    return;
  }

  const newIdx = Math.min(idx, nextTabs.length - 1);
  void activateTab(nextTabs[newIdx].id);
}

export function reorderKeyTab(tabId: string, toIndex: number) {
  keyTabs.update((tabs) => {
    const fromIndex = tabs.findIndex((tab) => tab.id === tabId);
    if (fromIndex < 0) return tabs;

    const clampedTo = Math.max(0, Math.min(tabs.length - 1, toIndex));
    if (fromIndex === clampedTo) return tabs;

    const next = [...tabs];
    const [moved] = next.splice(fromIndex, 1);
    next.splice(clampedTo, 0, moved);
    return next;
  });
}

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
          const uniqueKeys = [...new Set(allKeys)];
          keys.set(uniqueKeys);

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
            for (const [k, type] of keyTypesBatch) {
              typesMap.set(k, type);
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
  const startedAt = performance.now();
  const keyPreview = previewKey(key);
  loadLog('info', 'loadKeyInfo:start', { connectionId, key: keyPreview });

  const result = await withErrorHandling(
    () => invoke<KeyInfo>('get_key_info', { id: connectionId, key }),
    { errorMessage: '加载键详情失败' }
  );

  if (result.success && result.data) {
    keyInfo.set(result.data);
    loadLog('info', 'loadKeyInfo:success', {
      connectionId,
      key: keyPreview,
      keyType: result.data.key_type,
      ttl: result.data.ttl,
      durationMs: Math.round((performance.now() - startedAt) * 10) / 10,
    });
    syncActiveTabFromMirrors();
    return result.data;
  }

  loadLog('error', 'loadKeyInfo:failed', {
    connectionId,
    key: keyPreview,
    durationMs: Math.round((performance.now() - startedAt) * 10) / 10,
    error: String(result.error ?? 'unknown error'),
  });
  return null;
}

// 加载 Key 值
export async function loadKeyValue(connectionId: string, key: string, keyType: string) {
  const startedAt = performance.now();
  const keyPreview = previewKey(key);
  loadLog('info', 'loadKeyValue:start', { connectionId, key: keyPreview, keyType });

  const result = await withErrorHandling(
    async () => {
      let value: KeyValue;
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

  if (result.success) {
    loadLog('info', 'loadKeyValue:success', {
      connectionId,
      key: keyPreview,
      keyType,
      valueSummary: summarizeLoadedValue(result.data ?? null),
      durationMs: Math.round((performance.now() - startedAt) * 10) / 10,
    });
    syncActiveTabFromMirrors();
  } else {
    loadLog('error', 'loadKeyValue:failed', {
      connectionId,
      key: keyPreview,
      keyType,
      durationMs: Math.round((performance.now() - startedAt) * 10) / 10,
      error: String(result.error ?? 'unknown error'),
    });
  }
  return result.success ? result.data : null;
}

// 选择 Key（打开或聚焦标签）
export async function selectKey(connectionId: string, key: string) {
  const db = get(activeDb);
  await openOrFocusTab(connectionId, db, key);
}

// 刷新当前 Key
export async function refreshCurrentKey(connectionId?: string) {
  const cid = connectionId ?? get(detailConnectionId);
  const currentKey = get(activeKey);
  const currentInfo = get(keyInfo);
  if (cid && currentKey && currentInfo) {
    await loadKeyValue(cid, currentKey, currentInfo.key_type);
  }
}

function activeTabDbScope(connectionId: string): number {
  const tid = get(activeTabId);
  const tab = get(keyTabs).find(t => t.id === tid);
  if (tab && tab.connectionId === connectionId) return tab.db;
  return get(activeDb);
}

// 删除 Key
export async function deleteKey(connectionId: string, key: string) {
  const dbScope = activeTabDbScope(connectionId);
  const browserConn = get(activeConnectionId);
  const browserDb = get(activeDb);

  const result = await withErrorHandling(
    async () => {
      const tabsBefore = get(keyTabs);
      const prevActive = get(activeTabId);
      const prevIdx = prevActive ? tabsBefore.findIndex(t => t.id === prevActive) : -1;

      await invoke('delete_key', { id: connectionId, key });
      if (browserConn === connectionId && browserDb === dbScope) {
        keys.update(k => k.filter(kk => kk !== key));
      }
      keyTabs.update(tabs => tabs.filter(t => !(t.connectionId === connectionId && t.db === dbScope && t.key === key)));

      const remaining = get(keyTabs);
      const stillThere = prevActive && remaining.some(t => t.id === prevActive);

      if (remaining.length === 0) {
        activeTabId.set(null);
        detailConnectionId.set(null);
        activeKey.set(null);
        keyInfo.set(null);
        keyValue.set(null);
      } else if (!stillThere) {
        const newIdx = prevIdx >= 0 ? Math.min(prevIdx, remaining.length - 1) : 0;
        void activateTab(remaining[newIdx].id);
      }

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
  const dbScope = activeTabDbScope(connectionId);
  const browserConn = get(activeConnectionId);
  const browserDb = get(activeDb);

  const result = await withErrorHandling(
    async () => {
      await invoke('rename_key', { id: connectionId, oldKey, newKey });
      if (browserConn === connectionId && browserDb === dbScope) {
        keys.update(k => k.map(kk => (kk === oldKey ? newKey : kk)));
      }
      keyTabs.update(tabs =>
        tabs.map(t =>
          t.connectionId === connectionId && t.db === dbScope && t.key === oldKey
            ? {
                ...t,
                key: newKey,
                keyInfo: t.keyInfo ? { ...t.keyInfo, name: newKey } : null,
              }
            : t
        )
      );
      if (get(activeKey) === oldKey && get(detailConnectionId) === connectionId) {
        activeKey.set(newKey);
        keyInfo.update(info => (info ? { ...info, name: newKey } : null));
      }
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
      keyInfo.update(info => (info ? { ...info, ttl } : null));
      syncActiveTabFromMirrors();
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
      syncActiveTabFromMirrors();
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
              const hashPairs = value.split(',').map(p => p.trim());
              for (const pair of hashPairs) {
                const [field, val] = pair.split('=');
                if (field && val) {
                  await invoke('set_hash_field', { id: connectionId, key, field: field.trim(), value: val.trim() });
                }
              }
              break;
            case 'list':
              const listItems = value.split(',').map(i => i.trim());
              for (const item of listItems) {
                if (item) {
                  await invoke('push_list', { id: connectionId, key, value: item, atHead: false });
                }
              }
              break;
            case 'set':
              const setMembers = value.split(',').map(m => m.trim());
              for (const member of setMembers) {
                if (member) {
                  await invoke('add_set', { id: connectionId, key, member });
                }
              }
              break;
            case 'zset':
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

          if (ttl > 0) {
            await invoke('set_ttl', { id: connectionId, key, ttl });
          }

          await loadKeys(connectionId);

          await loadDatabases(connectionId);

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
