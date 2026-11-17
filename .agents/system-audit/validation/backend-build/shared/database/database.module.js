"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DatabaseModule = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const config_1 = require("@nestjs/config");
const mongoose_transaction_service_1 = require("./mongoose-transaction.service");
let DatabaseModule = class DatabaseModule {
};
exports.DatabaseModule = DatabaseModule;
exports.DatabaseModule = DatabaseModule = __decorate([
    (0, common_1.Global)(),
    (0, common_1.Module)({
        imports: [
            mongoose_1.MongooseModule.forRootAsync({
                useFactory: (config) => ({
                    uri: config.get('MONGODB_URI'),
                    autoIndex: true,
                    serverSelectionTimeoutMS: 10000,
                    connectTimeoutMS: 10000,
                    socketTimeoutMS: 45000,
                    maxPoolSize: 20,
                    minPoolSize: 5,
                }),
                inject: [config_1.ConfigService],
            }),
        ],
        providers: [mongoose_transaction_service_1.MongooseTransactionService],
        exports: [mongoose_1.MongooseModule, mongoose_transaction_service_1.MongooseTransactionService],
    })
], DatabaseModule);
//# sourceMappingURL=database.module.js.map