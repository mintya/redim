
/**
 * Check if a string is valid JSON object/array
 */
export function isJsonString(str: string): boolean {
  try {
    const parsed = JSON.parse(str);
    return typeof parsed === 'object' && parsed !== null;
  } catch {
    return false;
  }
}

/**
 * Decode Unicode escape sequences in string
 */
export function decodeUnicode(str: string): string {
  return str.replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
}

/**
 * Format JSON string with indentation
 */
export function formatJson(str: string): string {
  try {
    const parsed = JSON.parse(str);
    const formatted = JSON.stringify(parsed, null, 2);
    return decodeUnicode(formatted);
  } catch {
    return str;
  }
}

/**
 * Check if value is JSON (wrapper for isJsonString)
 */
export function isJson(value: string): boolean {
  return isJsonString(value);
}
