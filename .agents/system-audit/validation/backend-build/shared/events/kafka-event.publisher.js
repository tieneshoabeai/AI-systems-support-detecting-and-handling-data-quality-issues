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
var KafkaEventPublisher_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.KafkaEventPublisher = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const kafkajs_1 = require("kafkajs");
function topicFor(eventType) {
    if (eventType.startsWith('ai.'))
        return 'ai.jobs';
    if (eventType.startsWith('notification.') || eventType.startsWith('email.'))
        return 'notification.dispatch';
    if (eventType.startsWith('realtime.'))
        return 'realtime.push';
    return 'domain.events';
}
let KafkaEventPublisher = KafkaEventPublisher_1 = class KafkaEventPublisher {
    config;
    mode = 'kafka';
    logger = new common_1.Logger(KafkaEventPublisher_1.name);
    producer = null;
    enabled = false;
    constructor(config) {
        this.config = config;
    }
    async onModuleInit() {
        const brokers = (this.config.get('KAFKA_BROKERS') ?? '').trim();
        if (!brokers) {
            this.logger.warn('KAFKA_BROKERS chua cau hinh - Kafka publisher tat, dung in-process fallback.');
            return;
        }
        try {
            const kafka = new kafkajs_1.Kafka({ clientId: 'dq-api', brokers: brokers.split(',').map((s) => s.trim()).filter(Boolean) });
            this.producer = kafka.producer({ idempotent: true, maxInFlightRequests: 5, allowAutoTopicCreation: false });
            await this.producer.connect();
            this.enabled = true;
            this.logger.log(`Kafka publisher san sang (brokers=${brokers})`);
        }
        catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            this.logger.error(`Kafka connect that bai, fallback in-process: ${msg}`);
            this.producer = null;
        }
    }
    async onModuleDestroy() {
        try {
            await this.producer?.disconnect();
        }
        catch { }
    }
    isEnabled() { return this.enabled && !!this.producer; }
    async publish(envelope) {
        if (!this.isEnabled() || !this.producer)
            throw new Error('KAFKA_DISABLED');
        await this.producer.send({
            topic: topicFor(envelope.eventType),
            messages: [{ key: envelope.eventId, value: JSON.stringify(envelope) }],
            acks: -1,
        });
    }
};
exports.KafkaEventPublisher = KafkaEventPublisher;
exports.KafkaEventPublisher = KafkaEventPublisher = KafkaEventPublisher_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], KafkaEventPublisher);
//# sourceMappingURL=kafka-event.publisher.js.map