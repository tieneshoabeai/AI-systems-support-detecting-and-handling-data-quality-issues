import { CurrentUserPayload } from '../../../../shared/decorators/current-user.decorator';
import { UsersService } from '../../application/users.service';
import { z } from 'zod';
export declare const AdminListUsersQuerySchema: z.ZodObject<{
    search: z.ZodOptional<z.ZodString>;
    role: z.ZodOptional<z.ZodEnum<["admin", "analyst"]>>;
    status: z.ZodOptional<z.ZodEnum<["active", "blocked"]>>;
    page: z.ZodDefault<z.ZodNumber>;
    limit: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    search?: string | undefined;
    role?: "admin" | "analyst" | undefined;
    status?: "active" | "blocked" | undefined;
    page: number;
    limit: number;
}, {
    search?: string | undefined;
    role?: "admin" | "analyst" | undefined;
    status?: "active" | "blocked" | undefined;
    page?: number | undefined;
    limit?: number | undefined;
}>;
export declare class AdminUsersController {
    private readonly usersService;
    private readonly logger;
    constructor(usersService: UsersService);
    list(actor: CurrentUserPayload, query: Record<string, unknown>): Promise<{
        items: Record<string, unknown>[];
        total: number;
        page: number;
        limit: number;
    }>;
    detail(actor: CurrentUserPayload, id: string): Promise<Record<string, unknown>>;
}
