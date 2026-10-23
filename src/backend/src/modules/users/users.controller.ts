import {
  Controller,
  Get,
  Patch,
  Delete,
  Body,
  UseGuards,
  NotFoundException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { UpdateUserSchema, UpdateUserDto } from './dto/update-user.dto';
import { ZodValidationPipe } from '../../shared/pipes/zod-validation.pipe';
import { JwtAuthGuard } from '../../shared/guards/jwt-auth.guard';
import { CurrentUser, CurrentUserPayload } from '../../shared/decorators/current-user.decorator';
import { ApiZodBody } from '../../shared/swagger/api-zod.decorator';

@ApiTags('Users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  @ApiOperation({ summary: 'Lấy thông tin tài khoản hiện tại' })
  @ApiResponse({ status: 200, description: 'Thông tin hồ sơ người dùng thành công' })
  async getProfile(@CurrentUser() user: CurrentUserPayload) {
    const profile = await this.usersService.findById(user.userId);
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
    @Body(new ZodValidationPipe(UpdateUserSchema)) dto: UpdateUserDto
  ) {
    return this.usersService.updateProfile(user.userId, dto);
  }

  @Delete('me')
  @ApiOperation({ summary: 'Xóa mềm tài khoản người dùng (Soft Delete)' })
  @ApiResponse({ status: 200, description: 'Tài khoản đã được xóa mềm thành công' })
  async deleteAccount(@CurrentUser() user: CurrentUserPayload) {
    await this.usersService.softDeleteUser(user.userId);
    return { message: 'Tài khoản đã được xóa mềm thành công' };
  }
}
