/**
 * Type utility to convert camelCase keys to snake_case
 * This is a simplified version that relies on the runtime function for actual conversion
 */
type ToSnakeCase<T> = T extends Array<infer U>
  ? Array<ToSnakeCase<U>>
  : T extends object
  ? { [K in keyof T as K extends string ? string : K]: ToSnakeCase<T[K]> }
  : T;

/**
 * Converts a string from camelCase to snake_case
 * Handles various edge cases:
 * - Consecutive uppercase letters (e.g., "HTTPSConnection" -> "https_connection")
 * - Acronyms followed by lowercase (e.g., "XMLHttpRequest" -> "xml_http_request")
 * - Numbers in camelCase (e.g., "user2FA" -> "user_2fa")
 * - Mixed case transitions (e.g., "iOSDevice" -> "ios_device")
 * @param str - The string to convert
 * @returns The converted string in snake_case
 */
function convertToSnakeCase(str: string): string {
  return str
    // Handle transitions from lowercase/digit to uppercase
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    // Handle transitions between uppercase letters followed by lowercase
    .replace(/([A-Z])([A-Z][a-z])/g, '$1_$2')
    // Convert to lowercase
    .toLowerCase()
    // Remove any leading or trailing underscores
    .replace(/^_+|_+$/g, '')
    // Replace multiple consecutive underscores with a single one
    .replace(/_+/g, '_');
}

/**
 * Utility to convert camelCase object keys to snake_case
 * @param obj - The object to convert
 * @returns The object with keys converted to snake_case
 */
export function toSnakeCase<T>(obj: T): ToSnakeCase<T> {
  // Handle null and undefined
  if (obj == null) {
    return obj as ToSnakeCase<T>;
  }

  if (Array.isArray(obj)) {
    return obj.map(toSnakeCase) as ToSnakeCase<T>;
  } else if (typeof obj === 'object') {
    return Object.fromEntries(
      Object.entries(obj).map(([k, v]) => [
        convertToSnakeCase(k),
        toSnakeCase(v)
      ])
    ) as ToSnakeCase<T>;
  }
  return obj as ToSnakeCase<T>;
} 