import { URL } from 'url';

/**
 * List of sensitive field names that should be masked in logs
 * Each pattern uses word boundaries to ensure precise matching
 */
const SENSITIVE_FIELDS = [
  // Authentication and authorization
  /(^|_|-)password($|_|-)/i,
  /(^|_|-)token($|_|-)/i,
  /(^|_|-)api[_-]?key($|_|-)/i,
  /(^|_|-)secret($|_|-)/i,
  /(^|_|-)auth(?:entication|orization)?($|_|-)/i,
  /(^|_|-)credential($|_|-)/i,
  
  // Personal information
  /(^|_|-)ssn($|_|-)/i,
  /(^|_|-)social[_-]?security($|_|-)/i,
  /(^|_|-)email($|_|-)/i,
  /(^|_|-)phone(?:number)?($|_|-)/i,
  /(^|_|-)address($|_|-)/i,
  /(^|_|-)dob($|_|-)/i,
  /(^|_|-)birth(?:date)?($|_|-)/i,
  
  // Financial information
  /(^|_|-)credit[_-]?card($|_|-)/i,
  /(^|_|-)cvv($|_|-)/i,
  /(^|_|-)pin($|_|-)/i,
  
  // Security
  /(^|_|-)security[_-]?(?:answer|question)($|_|-)/i,
  /(^|_|-)private[_-]?key($|_|-)/i,
];

// Constants for masking
const SHORT_STRING_MASK_LENGTH = 4;
const SHORT_STRING_MASK = '*'.repeat(SHORT_STRING_MASK_LENGTH);
const MIN_VISIBLE_CHARS = 2;

/**
 * Masks a sensitive value
 * @param value The value to mask
 * @returns Masked value
 */
const maskValue = (value: any): string => {
  if (typeof value === 'string') {
    // For strings of length 4 or less, use a fixed-length mask
    if (value.length <= SHORT_STRING_MASK_LENGTH) {
      return SHORT_STRING_MASK;
    }
    // For longer strings, show first and last 2 characters
    return value.slice(0, MIN_VISIBLE_CHARS) + 
           '*'.repeat(value.length - 2 * MIN_VISIBLE_CHARS) + 
           value.slice(-MIN_VISIBLE_CHARS);
  }
  return '[REDACTED]';
};

/**
 * Checks if a field name matches any sensitive field pattern
 * @param fieldName The field name to check
 * @returns True if the field is sensitive
 */
const isSensitiveField = (fieldName: string): boolean => {
  return SENSITIVE_FIELDS.some(pattern => pattern.test(fieldName));
};

/**
 * Recursively sanitizes an object by masking sensitive fields
 * @param obj The object to sanitize
 * @param visited WeakSet to track visited objects
 * @returns Sanitized object
 */
export const sanitizeObject = (obj: any, visited = new WeakSet()): any => {
  if (!obj || typeof obj !== 'object') return obj;
  
  if (visited.has(obj)) return '[Circular Reference]';
  visited.add(obj);
  
  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item, visited));
  }

  const sanitized: Record<string, any> = {};
  
  for (const [key, value] of Object.entries(obj)) {
    if (isSensitiveField(key)) {
      sanitized[key] = maskValue(value);
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeObject(value, visited);
    } else {
      sanitized[key] = value;
    }
  }
  
  return sanitized;
};

const sanitizeUrl = (url: string): { pathname: string; search: string } => {
  const parsedUrl = new URL(url, 'http://dummy');
  const searchParams = new URLSearchParams(parsedUrl.search);
  
  // Redact sensitive query parameters
  for (const [key, value] of searchParams.entries()) {
    if (isSensitiveField(key)) {
      searchParams.set(key, maskValue(value));
    }
  }
  
  return {
    pathname: parsedUrl.pathname,
    search: searchParams.toString() ? `?${searchParams.toString()}` : '',
  };
};

/**
 * Sanitizes request data for logging
 * @param req The request object
 * @returns Sanitized request data
 */
export const sanitizeRequest = (req: any) => {
  const sanitizedUrl = sanitizeUrl(req.url);
  return {
    method: req.method,
    url: `${sanitizedUrl.pathname}${sanitizedUrl.search}`,
    body: sanitizeObject(req.body),
    query: sanitizeObject(req.query),
    params: sanitizeObject(req.params),
    headers: sanitizeObject(req.headers),
  };
}; 