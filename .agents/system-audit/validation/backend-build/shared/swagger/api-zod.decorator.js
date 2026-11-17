"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ApiZodBody = ApiZodBody;
exports.ApiZodQuery = ApiZodQuery;
exports.ApiOptimisticLock = ApiOptimisticLock;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const zod_openapi_1 = require("./zod-openapi");
function ApiZodBody(schema, description, example) {
    const schemaObject = (0, zod_openapi_1.zodToOpenApiSchema)(schema);
    if (example !== undefined) {
        schemaObject.example = example;
    }
    return (0, common_1.applyDecorators)((0, swagger_1.ApiBody)({
        description,
        schema: schemaObject,
    }));
}
function ApiZodQuery(schema, description) {
    const openApi = (0, zod_openapi_1.zodToOpenApiSchema)(schema);
    const required = new Set(openApi.required ?? []);
    const properties = openApi.properties ?? {};
    const decorators = Object.entries(properties).map(([name, prop]) => (0, swagger_1.ApiQuery)({
        name,
        required: required.has(name),
        enum: prop.enum,
        type: prop.type === 'integer' || prop.type === 'number' ? Number : String,
        description: prop.description,
    }));
    return (0, common_1.applyDecorators)(...decorators);
}
function ApiOptimisticLock() {
    return (0, common_1.applyDecorators)((0, swagger_1.ApiHeader)({
        name: 'if-match',
        required: false,
        description: 'Phiên bản entity (`version`). Gửi khi cập nhật đồng thời; nếu mismatch sẽ trả về HTTP 412 / 409.',
        schema: { type: 'integer', minimum: 0 },
    }));
}
//# sourceMappingURL=api-zod.decorator.js.map