"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Project = void 0;
const project_role_vo_1 = require("../value-objects/project-role.vo");
class Project {
    props;
    constructor(props) {
        this.props = props;
    }
    static create(props) {
        return new Project({ ...props, members: [...props.members] });
    }
    get hasDataset() {
        return this.props.hasDataset;
    }
    assertNoActiveDataset(message = 'Project da co Dataset') {
        if (this.props.hasDataset) {
            throw new Error(message);
        }
    }
    assertCanModerate(projectRole, workspaceRole) {
        if (!(0, project_role_vo_1.canModerateProject)(projectRole, workspaceRole)) {
            throw new Error('Khong co quyen dieu hanh project');
        }
    }
    assertCanAccess(projectRole, workspaceRole) {
        if (!(0, project_role_vo_1.canAccessProject)(projectRole, workspaceRole)) {
            throw new Error('Khong co quyen truy cap project');
        }
    }
}
exports.Project = Project;
//# sourceMappingURL=project.entity.js.map