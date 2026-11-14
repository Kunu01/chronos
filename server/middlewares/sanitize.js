/**
 * Recursively strips '$' and '.' keys from objects to prevent NoSQL Injection
 * and sanitizes HTML tags from string values to prevent XSS.
 */
const cleanValue = (val) => {
  if (typeof val === 'string') {
    return val.replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  if (Array.isArray(val)) {
    return val.map(cleanValue);
  }
  if (val !== null && typeof val === 'object') {
    return sanitizeObject(val);
  }
  return val;
};

export const sanitizeObject = (obj) => {
  if (!obj || typeof obj !== 'object') return obj;
  const cleaned = {};
  for (const [key, value] of Object.entries(obj)) {
    if (key.startsWith('$') || key.includes('.')) {
      continue;
    }
    cleaned[key] = cleanValue(value);
  }
  return cleaned;
};

export const mongoSanitizeMiddleware = (req, _res, next) => {
  if (req.body && typeof req.body === 'object') {
    req.body = sanitizeObject(req.body);
  }
  if (req.query && typeof req.query === 'object') {
    req.query = sanitizeObject(req.query);
  }
  if (req.params && typeof req.params === 'object') {
    req.params = sanitizeObject(req.params);
  }
  next();
};

