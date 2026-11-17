"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.EventsModule = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const event_publisher_port_1 = require("../ports/event-publisher.port");
const realtime_port_1 = require("../../modules/realtime/domain/ports/realtime.port");
const in_process_event_publisher_1 = require("./in-process-event.publisher");
const kafka_event_publisher_1 = require("./kafka-event.publisher");
const hybrid_event_publisher_1 = require("./hybrid-event.publisher");
const event_dispatcher_service_1 = require("./event-dispatcher.service");
const inbox_service_1 = require("../application/outbox/inbox.service");
const kafka_consumer_service_1 = require("./kafka-consumer.service");
let EventsModule = class EventsModule {
};
exports.EventsModule = EventsModule;
exports.EventsModule = EventsModule = __decorate([
    (0, common_1.Global)(),
    (0, common_1.Module)({
        providers: [
            in_process_event_publisher_1.InProcessEventPublisher,
            kafka_event_publisher_1.KafkaEventPublisher,
            {
                provide: hybrid_event_publisher_1.HybridEventPublisher,
                useFactory: (cfg, local, kafka) => new hybrid_event_publisher_1.HybridEventPublisher(cfg, local, kafka),
                inject: [config_1.ConfigService, in_process_event_publisher_1.InProcessEventPublisher, kafka_event_publisher_1.KafkaEventPublisher],
            },
            { provide: event_publisher_port_1.EVENT_PUBLISHER_PORT, useExisting: hybrid_event_publisher_1.HybridEventPublisher },
            {
                provide: event_dispatcher_service_1.EventDispatcherService,
                useFactory: (local, inbox, realtime) => new event_dispatcher_service_1.EventDispatcherService(local, realtime, inbox),
                inject: [in_process_event_publisher_1.InProcessEventPublisher, { token: inbox_service_1.InboxService, optional: true }, { token: realtime_port_1.REALTIME_PORT, optional: true }],
            },
            kafka_consumer_service_1.KafkaConsumerService,
        ],
        exports: [in_process_event_publisher_1.InProcessEventPublisher, kafka_event_publisher_1.KafkaEventPublisher, hybrid_event_publisher_1.HybridEventPublisher, event_publisher_port_1.EVENT_PUBLISHER_PORT, event_dispatcher_service_1.EventDispatcherService, kafka_consumer_service_1.KafkaConsumerService],
    })
], EventsModule);
//# sourceMappingURL=events.module.js.map