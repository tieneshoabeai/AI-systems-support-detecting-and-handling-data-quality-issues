import { ApiResponse } from '@nestjs/swagger';

// Dữ liệu minh họa cho tài liệu, không phải token hoặc thông tin người dùng thật.
export const AUTH_TOKEN_EXAMPLE = {
  access_token: '<access_token>',
  refresh_token: '<refresh_token>',
  expires_in: 900,
  remember_me: false,
  expires_at: '2026-11-29T04:00:00.000Z',
};

export const AUTH_USER_EXAMPLE = {
  id: '507f1f77bcf86cd799439011',
  email: 'analyst@example.com',
  role: 'analyst',
};

export const AUTH_SESSION_EXAMPLE = {
  id: '507f1f77bcf86cd799439012',
  device_name: 'Chrome on Windows',
  ip_address: '192.0.2.1',
  user_agent: 'Mozilla/5.0 (example)',
  is_revoked: false,
  remember_me: false,
  last_used_at: '2026-11-22T04:00:00.000Z',
  expires_at: '2026-11-29T04:00:00.000Z',
  created_at: '2026-11-22T04:00:00.000Z',
};

export function ApiAuthSuccess(status: number, description: string, data: unknown): MethodDecorator {
  return ApiResponse({
    status,
    description,
    content: { 'application/json': { example: { success: true, data } } },
  });
}

export function ApiAuthError(
  status: number,
  path: string,
  description: string,
  code: string,
  message: string,
  details?: Record<string, unknown>,
): MethodDecorator {
  return ApiResponse({
    status,
    description,
    content: {
      'application/json': {
        schema: {
          type: 'object',
          required: ['success', 'error'],
          properties: {
            success: { type: 'boolean', enum: [false] },
            error: {
              type: 'object',
              required: ['code', 'message', 'timestamp', 'path'],
              properties: {
                code: { type: 'string' },
                message: { type: 'string' },
                details: { type: 'object', additionalProperties: true },
                timestamp: { type: 'string', format: 'date-time' },
                path: { type: 'string' },
              },
            },
          },
        },
        example: {
          success: false,
          error: {
            code,
            message,
            ...(details === undefined ? {} : { details }),
            timestamp: '2026-11-22T04:00:00.000Z',
            path: `/api/v1/auth/${path}`,
          },
        },
      },
    },
  });
}
