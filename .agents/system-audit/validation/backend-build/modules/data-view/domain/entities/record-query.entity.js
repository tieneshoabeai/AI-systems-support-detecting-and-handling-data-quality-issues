"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RecordQuery = void 0;
const record_query_vo_1 = require("../value-objects/record-query.vo");
const record_filter_vo_1 = require("../value-objects/record-filter.vo");
class RecordQuery {
    props;
    constructor(props) {
        this.props = props;
    }
    static create(props) {
        return new RecordQuery({ ...props, limit: (0, record_query_vo_1.normalizeRecordLimit)(props.limit) });
    }
    get limit() {
        return this.props.limit;
    }
    static fieldPath(columnKey) {
        return (0, record_filter_vo_1.propsPath)(columnKey);
    }
}
exports.RecordQuery = RecordQuery;
//# sourceMappingURL=record-query.entity.js.map