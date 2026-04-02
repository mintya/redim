import { invoke } from '@tauri-apps/api/core';

/**
 * Shared utility to scan all keys using iterative SCAN
 * @param connectionId Redis connection ID
 * @param pattern Search pattern
 * @param count Batch size per SCAN iteration
 * @returns Array of all matching keys
 */
export async function scanAllKeys(
  connectionId: string,
  pattern: string = '*',
  count: number = 500
): Promise<string[]> {
  const allKeys: string[] = [];
  let cursor: number = 0;
  const maxIterations = 100; // Safety cap to prevent infinite loops
  let iterations = 0;

  do {
    const [nextCursor, batch] = await invoke<[number, string[]]>('get_keys', {
      id: connectionId,
      pattern,
      cursor,
      count,
    });
    allKeys.push(...batch);
    cursor = nextCursor;
    iterations++;
  } while (cursor !== 0 && iterations < maxIterations);

  return allKeys;
}
