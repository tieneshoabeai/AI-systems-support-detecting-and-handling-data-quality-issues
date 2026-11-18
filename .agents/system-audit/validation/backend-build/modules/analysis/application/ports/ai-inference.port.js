"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AiInferencePort = void 0;
exports.extractJsonObject = extractJsonObject;
class AiInferencePort {
}
exports.AiInferencePort = AiInferencePort;
function extractJsonObject(text) {
    if (!text || typeof text !== 'string')
        return null;
    const trimmed = text.trim();
    if (trimmed.startsWith('{')) {
        try {
            return JSON.parse(trimmed);
        }
        catch {
        }
    }
    const start = trimmed.indexOf('{');
    const end = trimmed.lastIndexOf('}');
    if (start < 0 || end <= start)
        return null;
    try {
        return JSON.parse(trimmed.slice(start, end + 1));
    }
    catch {
        return null;
    }
}
//# sourceMappingURL=ai-inference.port.js.map