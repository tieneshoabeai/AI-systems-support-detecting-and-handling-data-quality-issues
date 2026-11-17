"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.OutboxModule = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const outbox_event_schema_1 = require("./outbox-event.schema");
const processed_event_schema_1 = require("./processed-event.schema");
const outbox_service_1 = require("./outbox.service");
const inbox_service_1 = require("./inbox.service");
const outbox_relay_service_1 = require("./outbox-relay.service");
const outbox_port_1 = require("../../ports/outbox.port");
let OutboxModule = class OutboxModule {
};
exports.OutboxModule = OutboxModule;
exports.OutboxModule = OutboxModule = __decorate([
    (0, common_1.Global)(),
    (0, common_1.Module)({
        imports: [
            mongoose_1.MongooseModule.forFeature([
                { name: 'OutboxEvent', schema: outbox_event_schema_1.OutboxEventSchema },
                { name: 'ProcessedEvent', schema: processed_event_schema_1.ProcessedEventSchema },
            ]),
        ],
        providers: [outbox_service_1.OutboxService, inbox_service_1.InboxService, outbox_relay_service_1.OutboxRelayService, { provide: outbox_port_1.OUTBOX_PORT, useExisting: outbox_service_1.OutboxService }],
        exports: [outbox_service_1.OutboxService, inbox_service_1.InboxService, outbox_relay_service_1.OutboxRelayService, outbox_port_1.OUTBOX_PORT],
    })
], OutboxModule);
//# sourceMappingURL=outbox.module.js.map