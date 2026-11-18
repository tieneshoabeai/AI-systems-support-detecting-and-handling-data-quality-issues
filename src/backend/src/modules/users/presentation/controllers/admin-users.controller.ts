import { Controller, Get, Param, Query, UseGuards, Logger } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../../shared/interfaces/guards/jwt-auth.guard';
import { RolesGuard } from '../../../../shared/interfaces/guards/roles.guard';
import { Roles } from '../../../../shared/interfaces/decorators/roles.decorator';
import {
  CurrentUser,
  CurrentUserPayload,
} from '../../../../shared/interfaces/decorators/current-user.decorator';
import { ZodValidationPipe } from '../../../../shared/interfaces/pipes/zod-validation.pipe';
import { z } from 'zod';
import { FindByIdHandler } from '../../application/queries/find-by-id.handler';
import { FindPagedHandler } from '../../application/queries/find-paged.handler';
import {
  toUserResponse,
  type UserResponse,
} from '../responses/user.response';
import { NotFoundError } from '../../../../shared/domain/errors';

export const AdminListUsersQuerySchema = z.object({
  search: z.string().trim().max(200).optional(),
  role: z.enum(['admin', 'analyst']).optional(),
  status: z.enum(['active', 'blocked']).optional(),
  cursor: z.string().min(1).max(2000).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(15),
  // §3.4: `sortBy` không hợp lệ → VALIDATION_ERROR (không fallback im lặng).
  sortBy: z.enum(['createdAt', 'updatedAt', 'name', 'email', 'role', 'status']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

@ApiTags('Admin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('admin/users')
export class AdminUsersController {
  private readonly logger = new Logger(AdminUsersController.name);
  constructor(
    private readonly findByIdHandler: FindByIdHandler,
    private readonly findPagedHandler: FindPagedHandler,
  ) {}

  @Get()
  @Roles('admin')
  @ApiOperation({ summary: 'ADMIN-01: Danh sách hồ sơ (chỉ đọc, có audit log)' })
  @ApiResponse({
    status: 200,
    description: 'Danh sách hồ sơ — `{ items, meta: { nextCursor, hasMore, limit } }` (keyset cursor, không có `total`/`page`)',
  })
  async list(
    @CurrentUser() actor: CurrentUserPayload,
    @Query(new ZodValidationPipe(AdminListUsersQuerySchema)) query: Record<string, unknown>,
  ): Promise<{ items: UserResponse[]; meta: { nextCursor: string | null; hasMore: boolean; limit: number; } }> {
    const q = query as {
      search?: string;
      role?: string;
      status?: string;
      cursor?: string;
      limit: number;
      sortBy: string;
      sortOrder: 'asc' | 'desc';
    };
    const page = await this.findPagedHandler.execute({
      search: q.search,
      role: q.role,
      status: q.status,
      cursor: q.cursor,
      limit: q.limit,
      sortBy: q.sortBy,
      sortOrder: q.sortOrder,
    });
    this.logger.log(
      `[ADMIN-01] actor=${actor.userId} action=admin.users.list target=users filter=${JSON.stringify({ search: q.search ?? null, role: q.role ?? null, status: q.status ?? null, sortBy: q.sortBy, sortOrder: q.sortOrder, limit: q.limit })} at=${new Date().toISOString()}`,
    );
    return {
      items: page.items.map(toUserResponse),
      meta: page.meta,
    };
  }

  @Get(':id')
  @Roles('admin')
  @ApiOperation({ summary: 'ADMIN-01: Chi tiết hồ sơ (chỉ đọc, có audit log)' })
  async detail(@CurrentUser() actor: CurrentUserPayload, @Param('id') id: string): Promise<UserResponse> {
    const u = await this.findByIdHandler.execute(id);
    if (!u) throw new NotFoundError('Không tìm thấy tài khoản người dùng');
    this.logger.log(
      `[ADMIN-01] actor=${actor.userId} action=admin.users.detail target=${id} at=${new Date().toISOString()}`,
    );
    return toUserResponse(u);
  }
}
