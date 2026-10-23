import { applyDecorators } from '@nestjs/common';
import { ApiBody, ApiHeader, ApiQuery } from '@nestjs/swagger';
import type { z } from 'zod';
import { zodToOpenApiSchema } from './zod-openapi';

/**
 * Tự động tạo Swagger ApiBody từ Zod Schema
 */
export function ApiZodBody(
  schema: z.ZodType<unknown>,
  description?: string,
  example?: unknown
): MethodDecorator {
  const schemaObject: Record<string, unknown> = zodToOpenApiSchema(schema);
  if (example !== undefined) {
    schemaObject.example = example;
  }
  return applyDecorators(
    ApiBody({
      description,
      schema: schemaObject as never,
    })
  );
}

/**
 * Tự động tạo Swagger ApiQuery cho các tham số lọc từ Zod Schema
 */
export function ApiZodQuery(schema: z.ZodType<unknown>, description?: string): MethodDecorator {
  const openApi = zodToOpenApiSchema(schema) as {
    properties?: Record<string, { type?: string; enum?: string[]; description?: string }>;
    required?: string[];
  };
  const required = new Set(openApi.required ?? []);
  const properties = openApi.properties ?? {};
  const decorators = Object.entries(properties).map(([name, prop]) =>
    ApiQuery({
      name,
      required: required.has(name),
      enum: prop.enum,
      type: prop.type === 'integer' || prop.type === 'number' ? Number : String,
      description: prop.description,
    })
  );
  return applyDecorators(...decorators);
}

/**
 * Tự động thêm tài liệu hóa Header If-Match (Khóa lạc quan) trên Swagger
 */
export function ApiOptimisticLock(): MethodDecorator {
  return applyDecorators(
    ApiHeader({
      name: 'if-match',
      required: false,
      description:
        'Phiên bản entity (`version`). Gửi khi cập nhật đồng thời; nếu mismatch sẽ trả về HTTP 412 / 409.',
      schema: { type: 'integer', minimum: 0 },
    })
  );
}
