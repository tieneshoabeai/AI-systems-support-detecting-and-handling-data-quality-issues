"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FindingFeedback = void 0;
const feedback_label_vo_1 = require("../value-objects/feedback-label.vo");
class FindingFeedback {
    props;
    constructor(props) {
        this.props = props;
    }
    static create(props) {
        (0, feedback_label_vo_1.assertReasonForLabel)(props.label, props.reason);
        return new FindingFeedback({ ...props });
    }
    assertUpdatable(nextLabel, nextReason) {
        (0, feedback_label_vo_1.assertReasonForLabel)(nextLabel, nextReason ?? this.props.reason);
    }
}
exports.FindingFeedback = FindingFeedback;
//# sourceMappingURL=finding-feedback.entity.js.map