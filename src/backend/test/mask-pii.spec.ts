import {
  maskEmail,
  maskPhone,
  maskCitizenId,
  sanitizeObjectForLog,
} from '../src/shared/crypto/mask-pii';

describe('PII Masking & Data Privacy (mask-pii.ts)', () => {
  it('maskEmail should hide internal characters of email name', () => {
    expect(maskEmail('nguyenvana@gmail.com')).toBe('ng***@gmail.com');
    expect(maskEmail('ab@domain.com')).toBe('a*@domain.com');
    expect(maskEmail('invalid')).toBe('***');
  });

  it('maskPhone should obscure middle digits of phone number', () => {
    const masked = maskPhone('0901234567');
    expect(masked).toBe('090*****67');
    expect(maskPhone('123')).toBe('***');
  });

  it('maskCitizenId should obscure middle characters of ID', () => {
    expect(maskCitizenId('079123456789')).toBe('079***789');
  });

  it('sanitizeObjectForLog should redact passwords, secrets and mask emails/phones recursively', () => {
    const rawPayload = {
      email: 'user@example.com',
      password: 'SuperSecretPassword123!',
      nested: {
        access_token: 'jwt.token.string',
        customer_phone: '0987654321',
        score: 95,
      },
    };

    const sanitized = sanitizeObjectForLog(rawPayload);

    expect(sanitized.email).toBe('us***@example.com');
    expect(sanitized.password).toBe('[REDACTED]');
    expect(sanitized.nested.access_token).toBe('[REDACTED]');
    expect(sanitized.nested.customer_phone).toBe('098*****21');
    expect(sanitized.nested.score).toBe(95);
  });
});
