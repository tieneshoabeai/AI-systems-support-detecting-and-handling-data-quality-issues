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
Object.defineProperty(exports, "__esModule", { value: true });
exports.HybridEventPublisher = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const in_process_event_publisher_1 = require("./in-process-event.publisher");
const kafka_event_publisher_1 = require("./kafka-event.publisher");
let HybridEventPublisher = class HybridEventPublisher {
    cfg;
    local;
    kafka;
    constructor(cfg, local, kafka) {
        this.cfg = cfg;
        this.local = local;
        this.kafka = kafka;
    }
    get mode() { return (this.cfg.get('KAFKA_BROKERS') ?? '').trim().length > 0 ? 'kafka' : 'in-process'; }
    publish(e) {
        return ((this.cfg.get('KAFKA_BROKERS') ?? '').trim().length > 0 ? this.kafka : this.local).publish(e);
    }
};
exports.HybridEventPublisher = HybridEventPublisher;
exports.HybridEventPublisher = HybridEventPublisher = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService, in_process_event_publisher_1.InProcessEventPublisher, kafka_event_publisher_1.KafkaEventPublisher])
], HybridEventPublisher);
//# sourceMappingURL=hybrid-event.publisher.js.map