"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PROJECT_MEMBER_ROLES = void 0;
exports.canModerateProject = canModerateProject;
exports.canAccessProject = canAccessProject;
exports.PROJECT_MEMBER_ROLES = ['owner', 'member', 'viewer'];
function canModerateProject(projectRole, workspaceRole) {
    return projectRole === 'owner' || workspaceRole === 'owner';
}
function canAccessProject(projectRole, workspaceRole) {
    return workspaceRole === 'owner' || projectRole === 'owner' || projectRole === 'member';
}
//# sourceMappingURL=project-role.vo.js.map