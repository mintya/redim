import { writable, derived, get } from 'svelte/store';
import type { ConnectionConfig, ConnectionState } from '$lib/types/connection';
import { invoke } from '@tauri-apps/api/core';
import { showError, showSuccess, withErrorHandling } from '$lib/utils/error';
import { withLoading } from '$lib/stores/loading';

// 连接列表
export const connections = writable<ConnectionConfig[]>([]);

// 连接状态
export const connectionStates = writable<Map<string, ConnectionState>>(new Map());

// 当前选中的连接
export const activeConnectionId = writable<string | null>(null);

// 重连定时器
const reconnectTimers = new Map<string, ReturnType<typeof setTimeout>>();

// 重连配置
const RECONNECT_INTERVAL = 5000; // 5秒后尝试重连
const MAX_RECONNECT_ATTEMPTS = 3; // 最大重连次数
const reconnectAttempts = new Map<string, number>();

// 加载连接列表
export async function loadConnections() {
  const result = await withErrorHandling(
    () => invoke<ConnectionConfig[]>('get_connections'),
    { errorMessage: '加载连接列表失败' }
  );
  
  if (result.success && result.data) {
    connections.set(result.data);
  }
}

// 创建连接
export async function createConnection(config: ConnectionConfig) {
  const result = await withErrorHandling(
    async () => {
      const result = await invoke<ConnectionConfig[]>('create_connection', { config });
      connections.set(result);
      showSuccess('连接已创建');
      return true;
    },
    { errorMessage: '创建连接失败' }
  );
  
  return result.success;
}

// 更新连接
export async function updateConnection(config: ConnectionConfig) {
  const result = await withErrorHandling(
    async () => {
      const result = await invoke<ConnectionConfig[]>('update_connection', { config });
      connections.set(result);
      showSuccess('连接已更新');
      return true;
    },
    { errorMessage: '更新连接失败' }
  );
  
  return result.success;
}

// 删除连接
export async function deleteConnection(id: string) {
  const result = await withErrorHandling(
    async () => {
      const result = await invoke<ConnectionConfig[]>('delete_connection', { id });
      connections.set(result);
      connectionStates.update(states => {
        states.delete(id);
        return states;
      });
      // 清除重连定时器
      clearReconnectTimer(id);
      showSuccess('连接已删除');
      return true;
    },
    { errorMessage: '删除连接失败' }
  );
  
  return result.success;
}

// 测试连接
export async function testConnection(config: ConnectionConfig): Promise<number | null> {
  const result = await withErrorHandling(
    () => invoke<number>('test_connection', { config }),
    { errorMessage: '测试连接失败' }
  );
  
  return result.success ? result.data ?? null : null;
}

// 清除重连定时器
function clearReconnectTimer(id: string) {
  const timer = reconnectTimers.get(id);
  if (timer) {
    clearTimeout(timer);
    reconnectTimers.delete(id);
  }
  reconnectAttempts.delete(id);
}

// 设置重连定时器
function setReconnectTimer(id: string, callback: () => void) {
  clearReconnectTimer(id);
  
  const attempts = reconnectAttempts.get(id) || 0;
  if (attempts >= MAX_RECONNECT_ATTEMPTS) {
    console.log(`Max reconnect attempts reached for connection ${id}`);
    return;
  }
  
  const timer = setTimeout(() => {
    reconnectAttempts.set(id, attempts + 1);
    callback();
  }, RECONNECT_INTERVAL);
  
  reconnectTimers.set(id, timer);
}

// 连接
export async function connect(id: string, isReconnect: boolean = false) {
  return withLoading(
    async () => {
      const result = await withErrorHandling(
        async () => {
          const result = await invoke<boolean>('connect', { id });
          if (result) {
            connectionStates.update(states => {
              states.set(id, { id, connected: true });
              return states;
            });
            activeConnectionId.set(id);
            // 清除重连计数
            reconnectAttempts.delete(id);
            
            if (!isReconnect) {
              showSuccess('已连接');
            }
            return true;
          }
          return false;
        },
        { errorMessage: isReconnect ? '自动重连失败' : '连接失败' }
      );
      
      if (!result.success) {
        connectionStates.update(states => {
          states.set(id, { id, connected: false, error: String(result.error) });
          return states;
        });
        
        // 设置重连定时器
        if (!isReconnect) {
          setReconnectTimer(id, () => connect(id, true));
        }
      }
      
      return result.success;
    },
    isReconnect ? '正在重连...' : '正在连接...',
    `connect-${id}`
  );
}

// 断开连接
export async function disconnect(id: string) {
  const result = await withErrorHandling(
    async () => {
      await invoke('disconnect', { id });
      connectionStates.update(states => {
        states.delete(id);
        return states;
      });
      activeConnectionId.update(current => current === id ? null : current);
      // 清除重连定时器
      clearReconnectTimer(id);
      showSuccess('已断开连接');
      return true;
    },
    { errorMessage: '断开连接失败' }
  );
  
  return result.success;
}

// 检查连接状态
export async function checkConnection(id: string): Promise<boolean> {
  try {
    const result = await invoke<boolean>('check_connection', { id });
    if (!result) {
      // 连接已断开，设置重连
      connectionStates.update(states => {
        states.set(id, { id, connected: false, error: 'Connection lost' });
        return states;
      });
      setReconnectTimer(id, () => connect(id, true));
    }
    return result;
  } catch (e) {
    console.error('Failed to check connection:', e);
    return false;
  }
}

// 手动重连
export async function reconnect(id: string) {
  clearReconnectTimer(id);
  reconnectAttempts.set(id, 0);
  return connect(id, false);
}

// 派生状态：当前连接配置
export const activeConnection = derived(
  [connections, activeConnectionId],
  ([$connections, $activeConnectionId]) => {
    if (!$activeConnectionId) return null;
    return $connections.find(c => c.id === $activeConnectionId) || null;
  }
);

// 派生状态：当前连接状态
export const activeConnectionState = derived(
  [connectionStates, activeConnectionId],
  ([$connectionStates, $activeConnectionId]) => {
    if (!$activeConnectionId) return null;
    return $connectionStates.get($activeConnectionId) || null;
  }
);
