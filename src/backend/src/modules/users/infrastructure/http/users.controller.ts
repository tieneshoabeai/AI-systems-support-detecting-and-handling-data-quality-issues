import { Controller, Get, Patch, Delete, Body, UseGuards, NotFoundException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { UpdateUserSchema, UpdateUserDto } from './dtos/update-user.dto';
import { ZodValidationPipe } from '../../../../shared/pipes/zod-validation.pipe';
import { JwtAuthGuard } from '../../../../shared/guards/jwt-auth.guard';
import {
  CurrentUser,
  CurrentUserPayload,
} from '../../../../shared/decorators/current-user.decorator';
import { ApiZodBody } from '../../../../shared/swagger/api-zod.decorator';
import { FindByIdHandler } from '../../application/queries/find-by-id.handler';
import { SoftDeleteUserHandler } from '../../application/commands/soft-delete-user.handler';
import { UpdateProfileHandler } from '../../application/commands/update-profile.handler';
import type { UserRecord } from '../..';

@ApiTags('Users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('users')
export class UsersController {
  constructor(
    private readonly softDeleteUserHandler: SoftDeleteUserHandler,
    private readonly updateProfileHandler: UpdateProfileHandler,
    private readonly findByIdHandler: FindByIdHandler,
  ) {}

  @Get('me')
  @ApiOperation({ summary: 'Lấy thông tin tài khoản hiện tại' })
  @ApiResponse({ status: 200, description: 'Thông tin hồ sơ người dùng thành công' })
  async getProfile(@CurrentUser() user: CurrentUserPayload): Promise<UserRecord> {
    const profile = await this.findByIdHandler.execute(user.userId);
    if (!profile) {
      throw new NotFoundException('Không tìm thấy tài khoản người dùng');
    }
    return profile;
  }

  @Patch('me')
  @ApiOperation({ summary: 'Cập nhật thông tin hồ sơ cá nhân' })
  @ApiZodBody(UpdateUserSchema, 'Thông tin cập nhật hồ sơ cá nhân')
  @ApiResponse({ status: 200, description: 'Hồ sơ đã được cập nhật' })
  async updateProfile(
    @CurrentUser() user: CurrentUserPayload,
    @Body(new ZodValidationPipe(UpdateUserSchema)) dto: UpdateUserDto,
  ): Promise<UserRecord> {
    return this.updateProfileHandler.execute(user.userId, dto);
  }

  @Delete('me')
  @ApiOperation({ summary: 'Xóa mềm tài khoản người dùng (Soft Delete)' })
  @ApiResponse({ status: 200, description: 'Tài khoản đã được xóa mềm thành công' })
  async deleteAccount(@CurrentUser() user: CurrentUserPayload): Promise<{ message: string; }> {
    await this.softDeleteUserHandler.execute(user.userId);
    return { message: 'Tài khoản đã được xóa mềm thành công' };
  }
}
