"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Workspace = void 0;
const workspace_role_vo_1 = require("../value-objects/workspace-role.vo");
class Workspace {
    props;
    constructor(props) {
        this.props = props;
    }
    static create(props) {
        return new Workspace({ ...props, members: [...props.members] });
    }
    isOwner(userId) {
        return (0, workspace_role_vo_1.isWorkspaceOwner)(this.props.ownerId, userId);
    }
    isMember(userId) {
        return (0, workspace_role_vo_1.isWorkspaceMember)(this.props.members.map((m) => m.userId), userId);
    }
    assertActorIsOwner(actorUserId, message = 'Chi Workspace Owner moi duoc thuc hien') {
        if (!this.isOwner(actorUserId)) {
            throw new Error(message);
        }
    }
    assertCanRemoveMember(targetUserId) {
        if (this.props.ownerId === targetUserId) {
            throw new Error('Khong the xoa chu so huu chinh cua khong gian lam viec');
        }
        if (!this.isMember(targetUserId)) {
            throw new Error('Nguoi dung khong thuoc danh sach thanh vien');
        }
    }
    assertCanTransfer(actorUserId, targetUserId) {
        this.assertActorIsOwner(actorUserId, 'Chi Workspace Owner moi duoc nhuong quyen');
        if (actorUserId === targetUserId) {
            throw new Error('Khong the nhuong quyen cho chinh minh');
        }
        if (!this.isMember(targetUserId)) {
            throw new Error('Chi nhuong quyen cho thanh vien workspace');
        }
    }
    assertCanLeave(userId) {
        if (this.props.ownerId === userId) {
            throw new Error('Workspace Owner phai nhuong quyen truoc khi roi');
        }
        if (!this.isMember(userId)) {
            throw new Error('Ban khong phai thanh vien workspace nay');
        }
    }
}
exports.Workspace = Workspace;
//# sourceMappingURL=workspace.entity.js.map