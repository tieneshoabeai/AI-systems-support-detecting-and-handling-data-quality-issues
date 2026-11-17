"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.zodToOpenApiSchema = zodToOpenApiSchema;
const zod_to_json_schema_1 = require("zod-to-json-schema");
function zodToOpenApiSchema(schema) {
    const json = (0, zod_to_json_schema_1.zodToJsonSchema)(schema, {
        target: 'openApi3',
        $refStrategy: 'none',
    });
    if (typeof json !== 'object' || json === null) {
        return { type: 'object' };
    }
    const { $schema: _schema, ...rest } = json;
    return rest;
}
//# sourceMappingURL=zod-openapi.js.map