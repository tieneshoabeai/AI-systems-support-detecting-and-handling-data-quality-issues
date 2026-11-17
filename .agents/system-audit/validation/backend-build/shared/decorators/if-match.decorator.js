"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.IfMatch = void 0;
const common_1 = require("@nestjs/common");
exports.IfMatch = (0, common_1.createParamDecorator)((required = true, ctx) => {
    const request = ctx.switchToHttp().getRequest();
    const ifMatch = request.headers['if-match'];
    if (required && !ifMatch) {
        throw new common_1.BadRequestException('Yêu cầu header If-Match (ETag hoặc Version) để thực hiện cập nhật an toàn tránh xung đột dữ liệu');
    }
    return ifMatch;
});
//# sourceMappingURL=if-match.decorator.js.map