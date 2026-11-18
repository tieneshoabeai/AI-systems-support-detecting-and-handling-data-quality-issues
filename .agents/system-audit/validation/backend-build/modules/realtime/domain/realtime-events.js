"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RealtimeRooms = void 0;
exports.assertNoSensitiveData = assertNoSensitiveData;
exports.buildEnvelope = buildEnvelope;
exports.RealtimeRooms = {
    user: (userId) => `user:${userId}`,
    project: (projectId) => `project:${projectId}`,
    analysis: (analysisId) => `analysis:${analysisId}`,
};
const SENSITIVE_KEYS = [
    'reason',
    'email',
    'value',
    'cell_value',
    'finding',
    'description',
    'summary_detail',
    'password',
    'token',
];
function assertNoSensitiveData(payload) {
    for (const key of SENSITIVE_KEYS) {
        if (key in payload) {
            throw new Error(`Payload realtime chứa trường nhạy cảm bị cấm: ${key}`);
        }
    }
}
function buildEnvelope(event, fields) {
    const envelope = {
        event,
        occurredAt: fields.occurredAt ?? new Date().toISOString(),
        ...stripUndefined(fields),
    };
    assertNoSensitiveData(envelope);
    return envelope;
}
function stripUndefined(fields) {
    const out = {};
    for (const [k, v] of Object.entries(fields)) {
        if (k === 'occurredAt')
            continue;
        if (v !== undefined)
            out[k] = v;
    }
    return out;
}
//# sourceMappingURL=realtime-events.js.map