import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';

export function zodToOpenApiSchema(schema: z.ZodType<unknown>): Record<string, unknown> {
  const json = zodToJsonSchema(schema as unknown as Parameters<typeof zodToJsonSchema>[0], {
    target: 'openApi3',
    $refStrategy: 'none',
  });
  if (typeof json !== 'object' || json === null) {
    return { type: 'object' };
  }
  const { $schema: _schema, ...rest } = json as Record<string, unknown>;
  return rest;
}
