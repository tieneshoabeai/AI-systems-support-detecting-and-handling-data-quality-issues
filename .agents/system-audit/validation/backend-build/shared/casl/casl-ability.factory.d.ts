import { MongoAbility } from '@casl/ability';
import { Action } from './actions.enum';
import type { AppSubjects } from './subjects.type';
export interface CurrentUser {
    userId: string;
    email: string;
    role: 'admin' | 'analyst';
    sessionId?: string;
    workspaceId?: string;
    workspaceRole?: 'owner' | 'member';
}
export type AppAbility = MongoAbility<[Action, AppSubjects]>;
export declare class CaslAbilityFactory {
    createForUser(user: CurrentUser): AppAbility;
}
