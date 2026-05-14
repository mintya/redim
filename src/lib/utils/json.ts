
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

/**
 * Escape `&`, `<`, `>` for safe HTML embedding. Leaves `"` literal so the JSON
 * highlighter's quote-aware tokenizer still works on the escaped output.
 */
export function escapeHtml(s: string): string {
  return s.replace(/[&<>]/g, (c) => (c === '&' ? '&amp;' : c === '<' ? '&lt;' : '&gt;'));
}

const JSON_TOKEN_REGEX = /("(?:\\.|[^"\\])*")(\s*:)?|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)|(\btrue\b|\bfalse\b)|(\bnull\b)|([{}\[\],])/g;

/**
 * Syntax-highlight a pretty-printed JSON string. Returns HTML-safe markup with
 * tokens wrapped in `.json-key | .json-string | .json-number | .json-bool |
 * .json-null | .json-punct` spans. Intended to be rendered via `{@html ...}`.
 */
export function highlightJson(formatted: string): string {
  const escaped = escapeHtml(formatted);
  return escaped.replace(
    JSON_TOKEN_REGEX,
    (_match, str, colon, num, bool, nul, punct) => {
      if (str !== undefined) {
        if (colon !== undefined) {
          return `<span class="json-key">${str}</span><span class="json-punct">${colon}</span>`;
        }
        return `<span class="json-string">${str}</span>`;
      }
      if (num !== undefined) return `<span class="json-number">${num}</span>`;
      if (bool !== undefined) return `<span class="json-bool">${bool}</span>`;
      if (nul !== undefined) return `<span class="json-null">${nul}</span>`;
      if (punct !== undefined) return `<span class="json-punct">${punct}</span>`;
      return _match;
    }
  );
}
