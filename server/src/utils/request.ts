/* ═══════════════════════════════════════════════════════════
   Request Utilities
   
   Helper functions for handling Express request data safely.
   ═══════════════════════════════════════════════════════════ */

/**
 * Safely extract a query parameter as a string.
 * Returns undefined if not present, or the first value if array.
 */
export function getQueryString(value: unknown): string | undefined {
  if (typeof value === 'string') return value;
  if (Array.isArray(value) && value.length > 0 && typeof value[0] === 'string') {
    return value[0];
  }
  return undefined;
}

/**
 * Safely extract a query parameter as a required string.
 * Throws if not present.
 */
export function requireQueryString(value: unknown, paramName: string): string {
  const result = getQueryString(value);
  if (result === undefined) {
    throw new Error(`Missing required parameter: ${paramName}`);
  }
  return result;
}

/**
 * Safely extract a query parameter as a number.
 */
export function getQueryNumber(value: unknown, defaultValue?: number): number | undefined {
  const str = getQueryString(value);
  if (str === undefined) return defaultValue;
  const num = parseInt(str, 10);
  return isNaN(num) ? defaultValue : num;
}

/**
 * Safely extract a query parameter as a boolean.
 */
export function getQueryBoolean(value: unknown, defaultValue = false): boolean {
  const str = getQueryString(value);
  if (str === undefined) return defaultValue;
  return str === 'true' || str === '1' || str === 'yes';
}

/**
 * Safely extract a query parameter as a Date.
 */
export function getQueryDate(value: unknown): Date | undefined {
  const str = getQueryString(value);
  if (!str) return undefined;
  const date = new Date(str);
  return isNaN(date.getTime()) ? undefined : date;
}

/**
 * Helper to cast query params properly
 */
export function asString(value: string | string[] | undefined): string | undefined {
  if (typeof value === 'string') return value;
  if (Array.isArray(value) && value.length > 0) return value[0];
  return undefined;
}

/**
 * Helper to cast header values properly
 */
export function asHeaderString(value: string | string[] | undefined): string | undefined {
  if (typeof value === 'string') return value;
  if (Array.isArray(value) && value.length > 0) return value[0];
  return undefined;
}
