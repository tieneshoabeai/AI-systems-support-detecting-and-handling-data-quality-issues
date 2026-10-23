/**
 * Tiện ích che giấu dữ liệu định danh cá nhân (PII) tuân thủ Rule 6 Bảo mật
 */

export function maskPhone(phone: string, visibleSuffix = 2): string {
  if (!phone || phone.length < 6) return '***';
  const suffixLen = Math.min(visibleSuffix, phone.length - 3);
  const stars = '*'.repeat(Math.max(5, phone.length - 3 - suffixLen));
  return `${phone.slice(0, 3)}${stars}${phone.slice(-suffixLen)}`;
}

export function maskEmail(email: string): string {
  if (!email || !email.includes('@')) return '***';
  const [name, domain] = email.split('@');
  if (!name || !domain) return '***';
  if (name.length <= 2) return `${name[0]}*@${domain}`;
  return `${name.slice(0, 2)}***@${domain}`;
}

export function maskCitizenId(id: string): string {
  if (!id || id.length < 6) return '***';
  return `${id.slice(0, 3)}***${id.slice(-3)}`;
}

export function maskPiiForLog(
  field: 'phone' | 'email' | 'citizenId',
  value: string
): string {
  switch (field) {
    case 'phone':
      return maskPhone(value);
    case 'email':
      return maskEmail(value);
    case 'citizenId':
      return maskCitizenId(value);
    default:
      return '***';
  }
}

const SENSITIVE_KEYS = new Set([
  'password',
  'password_hash',
  'token',
  'access_token',
  'refresh_token',
  'secret',
  'api_key',
  'credentials',
]);

/**
 * Đệ quy làm sạch object trước khi log để loại bỏ mật khẩu và mask email/phone
 */
export function sanitizeObjectForLog<T>(obj: T): T {
  if (!obj || typeof obj !== 'object') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => sanitizeObjectForLog(item)) as unknown as T;
  }

  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    const lowerKey = key.toLowerCase();
    if (SENSITIVE_KEYS.has(lowerKey)) {
      result[key] = '[REDACTED]';
    } else if (lowerKey.includes('email') && typeof value === 'string') {
      result[key] = maskEmail(value);
    } else if (lowerKey.includes('phone') && typeof value === 'string') {
      result[key] = maskPhone(value);
    } else if (typeof value === 'object' && value !== null) {
      result[key] = sanitizeObjectForLog(value);
    } else {
      result[key] = value;
    }
  }
  return result as T;
}
