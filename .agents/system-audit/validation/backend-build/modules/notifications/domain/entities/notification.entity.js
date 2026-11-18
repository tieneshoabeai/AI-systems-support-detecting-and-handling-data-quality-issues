"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Notification = void 0;
const notification_type_vo_1 = require("../value-objects/notification-type.vo");
class Notification {
    props;
    constructor(props) {
        this.props = props;
    }
    static create(props) {
        return new Notification({ ...props, title: props.title.trim().slice(0, 200) });
    }
    static resolveMandatory(type, explicitFlag) {
        return (0, notification_type_vo_1.isMandatoryNotification)(type, explicitFlag);
    }
    static canDispatch(enabled, mandatory) {
        return (0, notification_type_vo_1.shouldDispatch)(enabled, mandatory);
    }
}
exports.Notification = Notification;
//# sourceMappingURL=notification.entity.js.map