"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createCursorPaginatedResponse = createCursorPaginatedResponse;
const cursor_codec_1 = require("./cursor-codec");
function createCursorPaginatedResponse(items, limit, getCursorPayload) {
    const hasMore = items.length > limit;
    const resultItems = hasMore ? items.slice(0, limit) : items;
    let nextCursor = null;
    if (hasMore && resultItems.length > 0) {
        const lastItem = resultItems[resultItems.length - 1];
        nextCursor = cursor_codec_1.CursorCodec.encode(getCursorPayload(lastItem));
    }
    return {
        items: resultItems,
        meta: { nextCursor, hasMore },
        next_cursor: nextCursor,
        has_more: hasMore,
    };
}
//# sourceMappingURL=cursor-paginated.response.js.map