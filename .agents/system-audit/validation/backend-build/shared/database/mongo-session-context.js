"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MongoSessionContext = void 0;
exports.resolveMongoSession = resolveMongoSession;
const async_hooks_1 = require("async_hooks");
const storage = new async_hooks_1.AsyncLocalStorage();
exports.MongoSessionContext = {
    run(session, fn) {
        return storage.run(session, fn);
    },
    current() {
        return storage.getStore();
    },
};
function resolveMongoSession(session) {
    return session ?? exports.MongoSessionContext.current();
}
//# sourceMappingURL=mongo-session-context.js.map