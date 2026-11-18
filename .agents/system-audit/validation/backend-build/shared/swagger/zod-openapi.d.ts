import { z } from 'zod';
export declare function zodToOpenApiSchema(schema: z.ZodType<unknown>): Record<string, unknown>;
