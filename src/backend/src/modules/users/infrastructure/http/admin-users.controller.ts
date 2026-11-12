import { Controller, Get, Param, Query, UseGuards, NotFoundException, Logger } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../../shared/guards/jwt-auth.guard';
import { RolesGuard } from '../../../../shared/guards/roles.guard';
import { Roles } from '../../../../shared/decorators/roles.decorator';
import { CurrentUser, CurrentUserPayload } from '../../../../shared/decorators/current-user.decorator';
import { ZodValidationPipe } from '../../../../shared/pipes/zod-validation.pipe';
import { UsersService } from '../../application/users.service';
import { z } from 'zod';

export const AdminListUsersQuerySchema = z.object({
  search: z.string().trim().max(200).optional(),
  role: z.enum(['admin', 'analyst']).optional(),
  status: z.enum(['active', 'blocked']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(15),
});

function toSafeProfile(u: Record<string, unknown>): Record<string, unknown> {
  const { passwordHash, password_hash, googleId, google_id, ...rest } = u as Record<string, unknown>;
  void passwordHash; void password_hash; void googleId; void google_id;
  return rest;
}

@ApiTags('Admin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('admin/users')
export class AdminUsersController {
  private readonly logger = new Logger(AdminUsersController.name);
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @Roles('admin')
  @ApiOperation({ summary: 'ADMIN-01: Danh sách hồ sơ (chỉ đọc, có audit log)' })
  async list(
    @CurrentUser() actor: CurrentUserPayload,
    @Query(new ZodValidationPipe(AdminListUsersQuerySchema)) query: Record<string, unknown>,
  ) {
    const q = query as { search?: string; role?: string; status?: string; page: number; limit: number };
    const { items, total } = await this.usersService.findPaged({ search: q.search, role: q.role, status: q.status, page: q.page, limit: q.limit });
    this.logger.log(`[ADMIN-01] actor=${actor.userId} action=admin.users.list target=users filter=${JSON.stringify({ search: q.search ?? null, role: q.role ?? null, status: q.status ?? null, page: q.page, limit: q.limit })} at=${new Date().toISOString()}`);
    return { items: items.map((u) => toSafeProfile(u as unknown as Record<string, unknown>)), total, page: q.page, limit: q.limit };
  }

  @Get(':id')
  @Roles('admin')
  @ApiOperation({ summary: 'ADMIN-01: Chi tiết hồ sơ (chỉ đọc, có audit log)' })
  async detail(@CurrentUser() actor: CurrentUserPayload, @Param('id') id: string) {
    const u = await this.usersService.findById(id);
    if (!u) throw new NotFoundException('Không tìm thấy tài khoản người dùng');
    this.logger.log(`[ADMIN-01] actor=${actor.userId} action=admin.users.detail target=${id} at=${new Date().toISOString()}`);
    return toSafeProfile(u as unknown as Record<string, unknown>);
  }
}
