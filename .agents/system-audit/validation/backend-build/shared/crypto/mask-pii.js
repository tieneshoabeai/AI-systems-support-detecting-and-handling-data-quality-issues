"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.maskPhone = maskPhone;
exports.maskEmail = maskEmail;
exports.maskCitizenId = maskCitizenId;
exports.maskPiiForLog = maskPiiForLog;
exports.sanitizeObjectForLog = sanitizeObjectForLog;
function maskPhone(phone, visibleSuffix = 2) {
    if (!phone || phone.length < 6)
        return '***';
    const suffixLen = Math.min(visibleSuffix, phone.length - 3);
    const stars = '*'.repeat(Math.max(5, phone.length - 3 - suffixLen));
    return `${phone.slice(0, 3)}${stars}${phone.slice(-suffixLen)}`;
}
function maskEmail(email) {
    if (!email || !email.includes('@'))
        return '***';
    const [name, domain] = email.split('@');
    if (!name || !domain)
        return '***';
    if (name.length <= 2)
        return `${name[0]}*@${domain}`;
    return `${name.slice(0, 2)}***@${domain}`;
}
function maskCitizenId(id) {
    if (!id || id.length < 6)
        return '***';
    return `${id.slice(0, 3)}***${id.slice(-3)}`;
}
function maskPiiForLog(field, value) {
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
function sanitizeObjectForLog(obj) {
    if (!obj || typeof obj !== 'object') {
        return obj;
    }
    if (Array.isArray(obj)) {
        return obj.map((item) => sanitizeObjectForLog(item));
    }
    const result = {};
    for (const [key, value] of Object.entries(obj)) {
        const lowerKey = key.toLowerCase();
        if (SENSITIVE_KEYS.has(lowerKey)) {
            result[key] = '[REDACTED]';
        }
        else if (lowerKey.includes('email') && typeof value === 'string') {
            result[key] = maskEmail(value);
        }
        else if (lowerKey.includes('phone') && typeof value === 'string') {
            result[key] = maskPhone(value);
        }
        else if (typeof value === 'object' && value !== null) {
            result[key] = sanitizeObjectForLog(value);
        }
        else {
            result[key] = value;
        }
    }
    return result;
}
//# sourceMappingURL=mask-pii.js.map