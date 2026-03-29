import { writable, derived } from 'svelte/store';
import type { ConnectionConfig, ConnectionState } from '$lib/types/connection';
import { invoke } from '@tauri-apps/api/core';

// 连接列表
export const connections = writable<ConnectionConfig[]>([]);

// 连接状态
export const connectionStates = writable<Map<string, ConnectionState>>(new Map());

// 当前选中的连接
export const activeConnectionId = writable<string | null>(null);

// 当前选中的DB
export const activeDb = writable<number>(0);

// 加载连接列表
export async function loadConnections() {
  try {
    const result = await invoke<ConnectionConfig[]>('get_connections');
    connections.set(result);
  } catch (e) {
    console.error('Failed to load connections:', e);
  }
}

// 创建连接
export async function createConnection(config: ConnectionConfig) {
  try {
    const result = await invoke<ConnectionConfig[]>('create_connection', { config });
    connections.set(result);
    return true;
  } catch (e) {
    console.error('Failed to create connection:', e);
    return false;
  }
}

// 更新连接
export async function updateConnection(config: ConnectionConfig) {
  try {
    const result = await invoke<ConnectionConfig[]>('update_connection', { config });
    connections.set(result);
    return true;
  } catch (e) {
    console.error('Failed to update connection:', e);
    return false;
  }
}

// 删除连接
export async function deleteConnection(id: string) {
  try {
    const result = await invoke<ConnectionConfig[]>('delete_connection', { id });
    connections.set(result);
    connectionStates.update(states => {
      states.delete(id);
      return states;
    });
    return true;
  } catch (e) {
    console.error('Failed to delete connection:', e);
    return false;
  }
}

// 测试连接
export async function testConnection(config: ConnectionConfig): Promise<number | null> {
  try {
    const latency = await invoke<number>('test_connection', { config });
    return latency;
  } catch (e) {
    console.error('Failed to test connection:', e);
    return null;
  }
}

// 连接
export async function connect(id: string) {
  try {
    console.log('Invoking connect command for:', id);
    const result = await invoke<boolean>('connect', { id });
    console.log('Connect command result:', result);
    if (result) {
      connectionStates.update(states => {
        states.set(id, { id, connected: true });
        return states;
      });
      activeConnectionId.set(id);
      console.log('activeConnectionId set to:', id);
      return true;
    }
    return false;
  } catch (e) {
    console.error('Failed to connect:', e);
    connectionStates.update(states => {
      states.set(id, { id, connected: false, error: String(e) });
      return states;
    });
    throw e;
  }
}

// 断开连接
export async function disconnect(id: string) {
  try {
    await invoke('disconnect', { id });
    connectionStates.update(states => {
      states.delete(id);
      return states;
    });
    activeConnectionId.update(current => current === id ? null : current);
    return true;
  } catch (e) {
    console.error('Failed to disconnect:', e);
    return false;
  }
}

// 派生状态：当前连接配置
export const activeConnection = derived(
  [connections, activeConnectionId],
  ([$connections, $activeConnectionId]) => {
    if (!$activeConnectionId) return null;
    return $connections.find(c => c.id === $activeConnectionId) || null;
  }
);
