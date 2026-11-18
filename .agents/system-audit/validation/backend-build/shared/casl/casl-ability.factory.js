"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CaslAbilityFactory = void 0;
const common_1 = require("@nestjs/common");
const ability_1 = require("@casl/ability");
const actions_enum_1 = require("./actions.enum");
let CaslAbilityFactory = class CaslAbilityFactory {
    createForUser(user) {
        const { can, cannot, build } = new ability_1.AbilityBuilder(ability_1.createMongoAbility);
        if (user.role === 'admin') {
            can(actions_enum_1.Action.Manage, 'all');
            return build();
        }
        can([actions_enum_1.Action.Read, actions_enum_1.Action.Update], 'User', { id: user.userId });
        can(actions_enum_1.Action.Read, 'Notification', { user_id: user.userId });
        can(actions_enum_1.Action.Update, 'Notification', { user_id: user.userId });
        can([actions_enum_1.Action.Create, actions_enum_1.Action.Read], 'IssueReport', { user_id: user.userId });
        can([actions_enum_1.Action.Read, actions_enum_1.Action.Delete], 'Session', { user_id: user.userId });
        if (user.workspaceId && user.workspaceRole) {
            switch (user.workspaceRole) {
                case 'owner':
                    can(actions_enum_1.Action.Manage, 'Workspace', { id: user.workspaceId });
                    can(actions_enum_1.Action.Manage, [
                        'Project',
                        'Dataset',
                        'DataRecord',
                        'Analysis',
                    ], { workspace_id: user.workspaceId });
                    break;
                case 'member':
                    can(actions_enum_1.Action.Read, 'Workspace', { id: user.workspaceId });
                    can(actions_enum_1.Action.Read, [
                        'Project',
                        'Dataset',
                        'DataRecord',
                        'Analysis',
                    ], { workspace_id: user.workspaceId });
                    cannot([actions_enum_1.Action.Create, actions_enum_1.Action.Update, actions_enum_1.Action.Delete, actions_enum_1.Action.Execute], ['Workspace', 'Project', 'Dataset', 'DataRecord', 'Analysis']);
                    break;
            }
        }
        return build();
    }
};
exports.CaslAbilityFactory = CaslAbilityFactory;
exports.CaslAbilityFactory = CaslAbilityFactory = __decorate([
    (0, common_1.Injectable)()
], CaslAbilityFactory);
//# sourceMappingURL=casl-ability.factory.js.map