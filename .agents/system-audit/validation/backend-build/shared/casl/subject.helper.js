"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildSubject = buildSubject;
const ability_1 = require("@casl/ability");
function buildSubject(subjectName, data) {
    if (!data)
        return subjectName;
    const properties = typeof data.toObject === 'function'
        ? data.toObject()
        : data;
    const normalized = {};
    for (const [key, val] of Object.entries(properties)) {
        if (val && typeof val === 'object' && 'toString' in val && !(val instanceof Date)) {
            normalized[key] = val.toString();
        }
        else {
            normalized[key] = val;
        }
    }
    const idValue = properties.id || properties._id;
    normalized.id = idValue ? idValue.toString() : undefined;
    if (properties.workspace_id) {
        normalized.workspace_id = properties.workspace_id.toString();
    }
    if (properties.project_id) {
        normalized.project_id = properties.project_id.toString();
    }
    if (properties.dataset_id) {
        normalized.dataset_id = properties.dataset_id.toString();
    }
    if (properties.user_id) {
        normalized.user_id = properties.user_id.toString();
    }
    if (properties.owner_id) {
        normalized.owner_id = properties.owner_id.toString();
    }
    return (0, ability_1.subject)(subjectName, normalized);
}
//# sourceMappingURL=subject.helper.js.map