"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RECORD_FILTER_OPERATORS = void 0;
exports.isValidOperator = isValidOperator;
exports.propsPath = propsPath;
exports.resolveColumnKeyPure = resolveColumnKeyPure;
exports.RECORD_FILTER_OPERATORS = [
    'equals',
    'notEquals',
    'contains',
    'notContains',
    'startsWith',
    'endsWith',
    'greaterThan',
    'greaterThanOrEqual',
    'lessThan',
    'lessThanOrEqual',
    'between',
    'in',
    'isEmpty',
    'isNotEmpty',
];
function isValidOperator(op) {
    return exports.RECORD_FILTER_OPERATORS.includes(op);
}
function propsPath(columnKey) {
    return `props.${columnKey}`;
}
function resolveColumnKeyPure(input, keys, names) {
    if (keys.includes(input))
        return input;
    const hit = names.get(input);
    return hit ?? null;
}
//# sourceMappingURL=record-filter.vo.js.map