import { OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit } from '@nestjs/websockets';
import { ConfigService } from '@nestjs/config';
import { Server, Socket } from 'socket.io';
import { RealtimeService } from '../../application/realtime.service';
import { RealtimeAuthService, RealtimeClientIdentity } from '../../application/realtime-auth.service';
import { ProjectsService } from '../../../projects/application/projects.service';
import { WorkspacesService } from '../../../workspaces/application/workspaces.service';
interface JoinProjectPayload {
    projectId?: string;
}
interface JoinAnalysisPayload {
    analysisId?: string;
    projectId?: string;
}
interface AuthedSocket extends Socket {
    data: {
        identity?: RealtimeClientIdentity;
    };
}
export declare class RealtimeGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
    private readonly realtime;
    private readonly auth;
    private readonly projectsService;
    private readonly workspacesService;
    private readonly config;
    private readonly logger;
    private server;
    constructor(realtime: RealtimeService, auth: RealtimeAuthService, projectsService: ProjectsService, workspacesService: WorkspacesService, config: ConfigService);
    afterInit(server: Server): void;
    private socketEnabled;
    handleConnection(client: AuthedSocket): Promise<void>;
    handleDisconnect(client: AuthedSocket): void;
    private requireIdentity;
    private resolveProjectRole;
    handleJoinProject(client: AuthedSocket, payload: JoinProjectPayload): Promise<Record<string, unknown>>;
    handleJoinAnalysis(client: AuthedSocket, payload: JoinAnalysisPayload): Promise<Record<string, unknown>>;
    handleLeaveProject(client: AuthedSocket, payload: JoinProjectPayload): Promise<Record<string, unknown>>;
    handleLeaveAnalysis(client: AuthedSocket, payload: JoinAnalysisPayload): Promise<Record<string, unknown>>;
}
export {};
