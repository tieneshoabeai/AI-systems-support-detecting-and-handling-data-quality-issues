"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WORKSPACE_ROLES = void 0;
exports.isWorkspaceOwner = isWorkspaceOwner;
exports.isWorkspaceMember = isWorkspaceMember;
exports.resolveWorkspaceRole = resolveWorkspaceRole;
exports.WORKSPACE_ROLES = ['owner', 'member'];
function isWorkspaceOwner(ownerId, userId) {
    return ownerId === userId;
}
function isWorkspaceMember(memberUserIds, userId) {
    return memberUserIds.includes(userId);
}
function resolveWorkspaceRole(ownerId, members, userId) {
    if (ownerId === userId)
        return 'owner';
    const hit = members.find((m) => m.userId === userId);
    if (!hit)
        return null;
    if (hit.role === 'editor' || hit.role === 'viewer')
        return 'member';
    return hit.role === 'owner' ? 'owner' : 'member';
}
//# sourceMappingURL=workspace-role.vo.js.map