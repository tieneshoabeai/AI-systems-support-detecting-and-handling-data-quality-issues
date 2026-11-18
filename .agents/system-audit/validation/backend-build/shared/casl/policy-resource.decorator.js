"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PolicyResource = exports.POLICY_RESOURCE_KEY = void 0;
const common_1 = require("@nestjs/common");
exports.POLICY_RESOURCE_KEY = 'policy_resource';
const PolicyResource = (subject, loader) => (0, common_1.SetMetadata)(exports.POLICY_RESOURCE_KEY, { subject, loader });
exports.PolicyResource = PolicyResource;
//# sourceMappingURL=policy-resource.decorator.js.map