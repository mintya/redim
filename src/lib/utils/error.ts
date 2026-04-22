import { toast, removeToast } from '$lib/stores/toast';

// Redis 错误类型
export enum RedisErrorType {
  ConnectionRefused = 'CONNECTION_REFUSED',
  ConnectionTimeout = 'CONNECTION_TIMEOUT',
  AuthenticationFailed = 'AUTHENTICATION_FAILED',
  ConnectionReset = 'CONNECTION_RESET',
  NoConnection = 'NO_CONNECTION',
  KeyNotFound = 'KEY_NOT_FOUND',
  WrongType = 'WRONG_TYPE',
  InvalidCommand = 'INVALID_COMMAND',
  SyntaxError = 'SYNTAX_ERROR',
  Unknown = 'UNKNOWN',
}

// 错误信息映射
const errorMessages: Record<RedisErrorType, { message: string; suggestion: string }> = {
  [RedisErrorType.ConnectionRefused]: {
    message: '连接被拒绝',
    suggestion: '请检查Redis服务器是否已启动，以及主机和端口配置是否正确',
  },
  [RedisErrorType.ConnectionTimeout]: {
    message: '连接超时',
    suggestion: '请检查网络连接是否正常，以及Redis服务器是否可达',
  },
  [RedisErrorType.AuthenticationFailed]: {
    message: '认证失败',
    suggestion: '请检查用户名和密码是否正确',
  },
  [RedisErrorType.ConnectionReset]: {
    message: '连接被重置',
    suggestion: 'Redis服务器可能已重启，请尝试重新连接',
  },
  [RedisErrorType.NoConnection]: {
    message: '未连接到Redis服务器',
    suggestion: '请先连接到Redis服务器',
  },
  [RedisErrorType.KeyNotFound]: {
    message: '键不存在',
    suggestion: '该键可能已被删除或过期',
  },
  [RedisErrorType.WrongType]: {
    message: '操作类型错误',
    suggestion: '当前操作不适用于该键的数据类型',
  },
  [RedisErrorType.InvalidCommand]: {
    message: '无效的命令',
    suggestion: '请检查命令语法是否正确',
  },
  [RedisErrorType.SyntaxError]: {
    message: '语法错误',
    suggestion: '请检查命令格式是否正确',
  },
  [RedisErrorType.Unknown]: {
    message: '未知错误',
    suggestion: '请检查日志获取更多详细信息',
  },
};

// 解析错误类型
export function parseErrorType(error: string): RedisErrorType {
  const errorLower = error.toLowerCase();
  
  if (errorLower.includes('connection refused')) {
    return RedisErrorType.ConnectionRefused;
  }
  if (errorLower.includes('timeout') || errorLower.includes('timed out')) {
    return RedisErrorType.ConnectionTimeout;
  }
  if (errorLower.includes('authentication') || errorLower.includes('auth') || errorLower.includes('password')) {
    return RedisErrorType.AuthenticationFailed;
  }
  if (errorLower.includes('connection reset') || errorLower.includes('reset by peer')) {
    return RedisErrorType.ConnectionReset;
  }
  if (errorLower.includes('no connection') || errorLower.includes('not connected')) {
    return RedisErrorType.NoConnection;
  }
  if (errorLower.includes('no such key') || errorLower.includes('key not found') || errorLower.includes('ERR no such key')) {
    return RedisErrorType.KeyNotFound;
  }
  if (errorLower.includes('WRONGTYPE') || errorLower.includes('wrong type')) {
    return RedisErrorType.WrongType;
  }
  if (errorLower.includes('ERR unknown command') || errorLower.includes('invalid command')) {
    return RedisErrorType.InvalidCommand;
  }
  if (errorLower.includes('syntax error') || errorLower.includes('ERR syntax')) {
    return RedisErrorType.SyntaxError;
  }
  
  return RedisErrorType.Unknown;
}

// 格式化错误消息
export function formatError(error: unknown): { message: string; suggestion: string; type: RedisErrorType } {
  const errorStr = String(error);
  const errorType = parseErrorType(errorStr);
  const errorInfo = errorMessages[errorType];
  
  return {
    message: errorInfo.message,
    suggestion: errorInfo.suggestion,
    type: errorType,
  };
}

// 显示错误提示
export function showError(error: unknown, customMessage?: string): void {
  const { message, suggestion } = formatError(error);
  const displayMessage = customMessage || message;
  toast.error(`${displayMessage}\n${suggestion}`);
}

// 显示成功提示
export function showSuccess(message: string): void {
  toast.success(message);
}

// 显示警告提示
export function showWarning(message: string): void {
  toast.warning(message);
}

// 显示信息提示
export function showInfo(message: string): void {
  toast.info(message);
}

// 包装异步操作，自动处理错误和加载状态
export async function withErrorHandling<T>(
  operation: () => Promise<T>,
  options: {
    errorMessage?: string;
    successMessage?: string;
    showLoading?: boolean;
    loadingMessage?: string;
  } = {}
): Promise<{ success: boolean; data?: T; error?: unknown }> {
  const { errorMessage, successMessage, showLoading = false, loadingMessage } = options;
  
  let loadingToastId: string | undefined;
  
  try {
    if (showLoading && loadingMessage) {
      loadingToastId = toast.info(loadingMessage, 0);
    }
    
    const data = await operation();
    
    if (loadingToastId) {
      removeToast(loadingToastId);
    }
    
    if (successMessage) {
      showSuccess(successMessage);
    }
    
    return { success: true, data };
  } catch (error) {
    if (loadingToastId) {
      removeToast(loadingToastId);
    }

    console.error('[app-error]', {
      message: errorMessage || 'Unhandled operation error',
      error,
    });

    showError(error, errorMessage);
    return { success: false, error };
  }
}

// 防抖函数
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  
  return function (this: any, ...args: Parameters<T>) {
    if (timeout) {
      clearTimeout(timeout);
    }
    
    timeout = setTimeout(() => {
      func.apply(this, args);
    }, wait);
  };
}

// 节流函数
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle = false;
  
  return function (this: any, ...args: Parameters<T>) {
    if (!inThrottle) {
      func.apply(this, args);
      inThrottle = true;
      setTimeout(() => {
        inThrottle = false;
      }, limit);
    }
  };
}
