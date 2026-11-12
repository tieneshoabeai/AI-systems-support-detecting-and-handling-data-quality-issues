import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { UserSchema } from './infrastructure/persistence/user.schema';
import { UserSessionSchema } from './infrastructure/persistence/user-session.schema';
import { UsersService } from './application/users.service';
import { UsersController } from './infrastructure/http/users.controller';
import { AdminUsersController } from './infrastructure/http/admin-users.controller';
import { UsersRepository } from './infrastructure/persistence/users.repository';
import { USER_REPOSITORY_PORT } from './domain/ports/user.repository.port';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: 'User', schema: UserSchema },
      { name: 'UserSession', schema: UserSessionSchema },
    ]),
  ],
  controllers: [UsersController, AdminUsersController],
  providers: [UsersService, UsersRepository, { provide: USER_REPOSITORY_PORT, useExisting: UsersRepository }],
  exports: [UsersService, UsersRepository, USER_REPOSITORY_PORT, MongooseModule],
})
export class UsersModule {}
