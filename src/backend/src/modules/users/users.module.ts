import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { UserSchema } from './infrastructure/persistence/user.schema';
import { UserSessionSchema } from './infrastructure/persistence/user-session.schema';
import { UsersController } from './presentation/controllers/users.controller';
import { AdminUsersController } from './presentation/controllers/admin-users.controller';
import { UsersRepository } from './infrastructure/persistence/users.repository';
import { USER_REPOSITORY_PORT } from './domain/ports/user.repository.port';
import { CreateSessionHandler } from './application/commands/create-session.handler';
import { CreateUserHandler } from './application/commands/create-user.handler';
import { FindActiveSessionsHandler } from './application/queries/find-active-sessions.handler';
import { FindByEmailHandler } from './application/queries/find-by-email.handler';
import { FindByIdHandler } from './application/queries/find-by-id.handler';
import { FindPagedHandler } from './application/queries/find-paged.handler';
import { FindSessionByIdHandler } from './application/queries/find-session-by-id.handler';
import { FindSessionByTokenHashHandler } from './application/queries/find-session-by-token-hash.handler';
import { RevokeAllUserSessionsHandler } from './application/commands/revoke-all-user-sessions.handler';
import { RevokeSessionByIdHandler } from './application/commands/revoke-session-by-id.handler';
import { RevokeSessionHandler } from './application/commands/revoke-session.handler';
import { SoftDeleteUserHandler } from './application/commands/soft-delete-user.handler';
import { BlockUserHandler } from './application/commands/block-user.handler';
import { UnblockUserHandler } from './application/commands/unblock-user.handler';
import { UserAccessRevocationService } from './application/services/user-access-revocation.service';
import { TouchSessionHandler } from './application/commands/touch-session.handler';
import { UpdateNotificationPreferencesHandler } from './application/commands/update-notification-preferences.handler';
import { UpdateProfileHandler } from './application/commands/update-profile.handler';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: 'User', schema: UserSchema },
      { name: 'UserSession', schema: UserSessionSchema },
    ]),
  ],
  controllers: [UsersController, AdminUsersController],
  providers: [
    CreateSessionHandler,
    CreateUserHandler,
    RevokeAllUserSessionsHandler,
    RevokeSessionByIdHandler,
    RevokeSessionHandler,
    SoftDeleteUserHandler,
    BlockUserHandler,
    UnblockUserHandler,
    UserAccessRevocationService,
    TouchSessionHandler,
    UpdateNotificationPreferencesHandler,
    UpdateProfileHandler,
    FindActiveSessionsHandler,
    FindByEmailHandler,
    FindByIdHandler,
    FindPagedHandler,
    FindSessionByIdHandler,
    FindSessionByTokenHashHandler,
    UsersRepository,
    { provide: USER_REPOSITORY_PORT, useExisting: UsersRepository },
  ],
  exports: [UsersRepository, USER_REPOSITORY_PORT, MongooseModule],
})
export class UsersModule {}
