"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserSession = void 0;
const session_policy_vo_1 = require("../value-objects/session-policy.vo");
class UserSession {
    props;
    constructor(props) {
        this.props = props;
    }
    static create(props) {
        return new UserSession({ ...props });
    }
    isActive(now = new Date()) {
        return !this.props.isRevoked && !(0, session_policy_vo_1.isSessionExpired)(this.props.expiresAt, now);
    }
}
exports.UserSession = UserSession;
//# sourceMappingURL=user-session.entity.js.map