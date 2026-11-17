"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.User = void 0;
const user_role_vo_1 = require("../value-objects/user-role.vo");
class User {
    props;
    constructor(props) {
        this.props = props;
    }
    static create(props) {
        return new User({ ...props, email: (0, user_role_vo_1.normalizeEmail)(props.email) });
    }
    get id() {
        return this.props.id;
    }
    get email() {
        return this.props.email;
    }
    get role() {
        return this.props.role;
    }
    get status() {
        return this.props.status;
    }
    canLogin() {
        return (0, user_role_vo_1.canUserLogin)(this.props.status, this.props.deletedAt);
    }
    isAdmin() {
        return this.props.role === 'admin';
    }
}
exports.User = User;
//# sourceMappingURL=user.entity.js.map