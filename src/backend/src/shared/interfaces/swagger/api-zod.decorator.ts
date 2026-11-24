import { applyDecorators } from '@nestjs/common';
import { ApiBody, ApiHeader, ApiQuery, ApiResponse } from '@nestjs/swagger';
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
      description: prop.description ?? description,
    })
  );
  return applyDecorators(...decorators);
}

/**
 * Tự động tạo Swagger ApiResponse từ Zod Schema.
 *
 * ## Vì sao cần?
 *
 * `ApiResponse` thông thường phải khai báo schema thủ công → dễ lệch với type
 * thật của mã nguồn, và frontend đọc `/api/v1/docs-json` sẽ không có gì để
 * sinh type. Hàm này lấy schema Zod (nguồn sự thật duy nhất) rồi chuyển thẳng
 * sang OpenAPI 3.0.
 *
 * @param schema  Schema Zod mô tả **phần `data`** của envelope.
 * @param status  Mã HTTP (mặc định 200).
 * @param description  Mô tả ngắn cho response.
 * @param example  Ví dụ phản hồi (bọc trong envelope `{ success, data }`).
 */
export function ApiZodResponse(
  schema: z.ZodType<unknown>,
  status = 200,
  description?: string,
  example?: unknown,
): MethodDecorator {
  const dataSchema = zodToOpenApiSchema(schema);
  const envelope: Record<string, unknown> = {
    type: 'object',
    required: ['success', 'data'],
    properties: {
      success: { type: 'boolean', enum: [true] },
      data: dataSchema,
    },
  };
  const media: Record<string, unknown> = { schema: envelope as never };
  // Example đặt ở **media level** (không phải `schema.example`) — đúng cách
  // Swagger UI hiển thị, và khớp với `ApiAuthSuccess` trong module `auth`.
  if (example !== undefined) {
    media.example = { success: true, data: example };
  }
  return ApiResponse({
    status,
    description,
    content: { 'application/json': media },
  });
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
