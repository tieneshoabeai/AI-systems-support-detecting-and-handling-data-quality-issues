"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CurrentResource = void 0;
const common_1 = require("@nestjs/common");
exports.CurrentResource = (0, common_1.createParamDecorator)((_data, ctx) => {
    const request = ctx.switchToHttp().getRequest();
    return request.resource;
});
//# sourceMappingURL=current-resource.decorator.js.map