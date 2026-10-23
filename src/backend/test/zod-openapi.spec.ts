import { z } from 'zod';
import { zodToOpenApiSchema } from '../src/shared/swagger/zod-openapi';

describe('Zod-OpenAPI Schema Transformer', () => {
  it('should correctly transform a basic Zod object schema to OpenAPI 3.0 schema', () => {
    const TestSchema = z.object({
      name: z.string().describe('Tên tập dữ liệu'),
      record_count: z.number().int().positive().describe('Số lượng dòng'),
      tags: z.array(z.string()).optional(),
    });

    interface OpenApiSchemaResult {
      type?: string;
      properties?: Record<string, { type?: string; description?: string }>;
      required?: string[];
    }
    const openApiSchema = zodToOpenApiSchema(TestSchema) as OpenApiSchemaResult;

    expect(openApiSchema.type).toBe('object');
    expect(openApiSchema.properties).toBeDefined();
    expect(openApiSchema.properties?.name?.type).toBe('string');
    expect(openApiSchema.properties?.name?.description).toBe('Tên tập dữ liệu');
    expect(openApiSchema.properties?.record_count?.type).toBe('integer');
    expect(openApiSchema.required).toContain('name');
    expect(openApiSchema.required).toContain('record_count');
    expect(openApiSchema.required).not.toContain('tags');
  });
});
