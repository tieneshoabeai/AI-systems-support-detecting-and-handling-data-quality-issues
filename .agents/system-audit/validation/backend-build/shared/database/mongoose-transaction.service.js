"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var MongooseTransactionService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.MongooseTransactionService = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const mongo_session_context_1 = require("./mongo-session-context");
let MongooseTransactionService = MongooseTransactionService_1 = class MongooseTransactionService {
    connection;
    logger = new common_1.Logger(MongooseTransactionService_1.name);
    constructor(connection) {
        this.connection = connection;
    }
    async runInTransaction(fn) {
        const session = await this.connection.startSession();
        try {
            return await this.runOnce(session, fn);
        }
        finally {
            await session.endSession();
        }
    }
    async runOnce(session, fn) {
        let result;
        let executed = false;
        await session.withTransaction(async () => {
            executed = false;
            result = await mongo_session_context_1.MongoSessionContext.run(session, () => fn(session));
            executed = true;
        });
        if (!executed) {
            throw new Error('Giao dịch hoàn tất nhưng callback không được thực thi thành công');
        }
        return result;
    }
};
exports.MongooseTransactionService = MongooseTransactionService;
exports.MongooseTransactionService = MongooseTransactionService = MongooseTransactionService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_1.InjectConnection)()),
    __metadata("design:paramtypes", [mongoose_2.Connection])
], MongooseTransactionService);
//# sourceMappingURL=mongoose-transaction.service.js.map