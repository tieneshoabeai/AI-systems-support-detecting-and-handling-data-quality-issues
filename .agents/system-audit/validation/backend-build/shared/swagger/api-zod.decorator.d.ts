import type { z } from 'zod';
export declare function ApiZodBody(schema: z.ZodType<unknown>, description?: string, example?: unknown): MethodDecorator;
export declare function ApiZodQuery(schema: z.ZodType<unknown>, description?: string): MethodDecorator;
export declare function ApiOptimisticLock(): MethodDecorator;
