import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { RealtimeService } from './application/realtime.service';
import { RealtimeAuthService } from './application/realtime-auth.service';
import { RealtimeGateway } from './infrastructure/websocket/realtime.gateway';
import { SocketIoRealtimeTransport } from './infrastructure/websocket/socket-io-realtime.transport';
import { UsersModule } from '../users/users.module';
import { ProjectsModule } from '../projects/projects.module';
import { WorkspacesModule } from '../workspaces/workspaces.module';
import { REALTIME_PORT } from './domain/ports/realtime.port';
import { REALTIME_TRANSPORT_PORT } from './domain/ports/realtime-transport.port';

/**
 * REALTIME-01 — Module realtime (Phần 7 v6 §3.17.2, Phần 9 v4).
 * Gateway chỉ giữ kết nối + push, không xử lý nghiệp vụ.
 * RealtimeService (application) implements REALTIME_PORT; SocketIoRealtimeTransport
 * (infrastructure) implements REALTIME_TRANSPORT_PORT và là nơi duy nhất biết `socket.io`.
 * @Global để mọi service inject @Optional() REALTIME_PORT mà không tạo vòng lặp module.
 */
@Global()
@Module({
  imports: [JwtModule.register({}), UsersModule, ProjectsModule, WorkspacesModule],
  providers: [
    SocketIoRealtimeTransport,
    { provide: REALTIME_TRANSPORT_PORT, useExisting: SocketIoRealtimeTransport },
    RealtimeService,
    { provide: REALTIME_PORT, useExisting: RealtimeService },
    RealtimeAuthService,
    RealtimeGateway,
  ],
  exports: [
    RealtimeService,
    REALTIME_PORT,
    SocketIoRealtimeTransport,
    REALTIME_TRANSPORT_PORT,
  ],
})
export class RealtimeModule {}
