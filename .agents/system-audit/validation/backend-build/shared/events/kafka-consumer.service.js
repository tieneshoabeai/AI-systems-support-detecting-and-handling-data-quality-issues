"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var KafkaConsumerService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.KafkaConsumerService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const event_dispatcher_service_1 = require("./event-dispatcher.service");
let KafkaConsumerService = KafkaConsumerService_1 = class KafkaConsumerService {
    config;
    dispatcher;
    logger = new common_1.Logger(KafkaConsumerService_1.name);
    consumer = null;
    stopped = false;
    constructor(config, dispatcher) {
        this.config = config;
        this.dispatcher = dispatcher;
    }
    async onModuleInit() {
        const mode = (this.config.get('WORKER_MODE') ?? 'all').toLowerCase();
        if (mode === 'api') {
            this.logger.log('Kafka consumer tat trong API process (WORKER_MODE=api)');
            return;
        }
        const brokers = (this.config.get('KAFKA_BROKERS') ?? '').trim();
        if (!brokers) {
            this.logger.log('KAFKA_BROKERS chua cau hinh - Kafka consumer tat');
            return;
        }
        if (!this.dispatcher) {
            this.logger.warn('Thieu EventDispatcherService - Kafka consumer tat');
            return;
        }
        try {
            const { Kafka } = await Promise.resolve().then(() => __importStar(require('kafkajs')));
            const kafka = new Kafka({ clientId: 'dq-worker', brokers: brokers.split(',').map((s) => s.trim()).filter(Boolean) });
            const consumer = kafka.consumer({ groupId: 'dq-worker-group', allowAutoTopicCreation: false });
            await consumer.connect();
            await consumer.subscribe({ topics: ['ai.jobs', 'notification.dispatch', 'realtime.push', 'domain.events'], fromBeginning: false });
            this.consumer = consumer;
            await consumer.run({
                autoCommit: true,
                eachMessage: async ({ message }) => {
                    if (this.stopped || !message.value)
                        return;
                    try {
                        const envelope = JSON.parse(message.value.toString());
                        if (envelope && envelope.eventId && envelope.eventType)
                            await this.dispatcher?.handle(envelope);
                    }
                    catch (err) {
                        const msg = err instanceof Error ? err.message : String(err);
                        this.logger.warn(`Kafka message loi (bo qua, cho retry theo offset): ${msg}`);
                    }
                },
            });
            this.logger.log(`Kafka consumer san sang (brokers=${brokers}, group=dq-worker-group)`);
        }
        catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            this.logger.error(`Kafka consumer khoi dong that bai (van chay in-process fallback): ${msg}`);
            this.consumer = null;
        }
    }
    async onModuleDestroy() {
        this.stopped = true;
        try {
            await this.consumer?.disconnect();
        }
        catch { }
    }
};
exports.KafkaConsumerService = KafkaConsumerService;
exports.KafkaConsumerService = KafkaConsumerService = KafkaConsumerService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(1, (0, common_1.Optional)()),
    __metadata("design:paramtypes", [config_1.ConfigService, event_dispatcher_service_1.EventDispatcherService])
], KafkaConsumerService);
//# sourceMappingURL=kafka-consumer.service.js.map