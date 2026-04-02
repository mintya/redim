import { writable, derived } from 'svelte/store';

// 加载状态类型
export interface LoadingState {
  id: string;
  message: string;
  progress?: number;
  startTime: number;
}

// 加载状态列表
export const loadingStates = writable<Map<string, LoadingState>>(new Map());

// 生成唯一ID
let counter = 0;
function generateId(): string {
  return `loading-${++counter}-${Date.now()}`;
}

// 开始加载
export function startLoading(message: string, id?: string): string {
  const loadingId = id || generateId();
  const state: LoadingState = {
    id: loadingId,
    message,
    startTime: Date.now(),
  };
  
  loadingStates.update(states => {
    states.set(loadingId, state);
    return states;
  });
  
  return loadingId;
}

// 更新加载进度
export function updateLoadingProgress(id: string, progress: number): void {
  loadingStates.update(states => {
    const state = states.get(id);
    if (state) {
      states.set(id, { ...state, progress });
    }
    return states;
  });
}

// 更新加载消息
export function updateLoadingMessage(id: string, message: string): void {
  loadingStates.update(states => {
    const state = states.get(id);
    if (state) {
      states.set(id, { ...state, message });
    }
    return states;
  });
}

// 结束加载
export function stopLoading(id: string): void {
  loadingStates.update(states => {
    states.delete(id);
    return states;
  });
}

// 派生状态：是否有任何加载
export const hasAnyLoading = derived(
  loadingStates,
  ($states) => $states.size > 0
);

// 派生状态：加载数量
export const loadingCount = derived(
  loadingStates,
  ($states) => $states.size
);

// 派生状态：所有加载状态列表
export const loadingList = derived(
  loadingStates,
  ($states) => Array.from($states.values())
);

// 包装异步操作，自动管理加载状态
export async function withLoading<T>(
  operation: () => Promise<T>,
  message: string,
  id?: string
): Promise<T> {
  const loadingId = startLoading(message, id);
  
  try {
    const result = await operation();
    return result;
  } finally {
    stopLoading(loadingId);
  }
}

// 包装异步操作，支持进度更新
export async function withProgressLoading<T>(
  operation: (updateProgress: (progress: number) => void) => Promise<T>,
  message: string,
  id?: string
): Promise<T> {
  const loadingId = startLoading(message, id);
  
  try {
    const result = await operation((progress) => {
      updateLoadingProgress(loadingId, progress);
    });
    return result;
  } finally {
    stopLoading(loadingId);
  }
}
