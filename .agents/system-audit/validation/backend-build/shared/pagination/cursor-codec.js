"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CursorCodec = void 0;
class CursorCodec {
    static encode(payload) {
        const jsonString = JSON.stringify(payload);
        return Buffer.from(jsonString, 'utf8').toString('base64url');
    }
    static decode(cursor) {
        try {
            const jsonString = Buffer.from(cursor, 'base64url').toString('utf8');
            return JSON.parse(jsonString);
        }
        catch {
            return null;
        }
    }
}
exports.CursorCodec = CursorCodec;
//# sourceMappingURL=cursor-codec.js.map