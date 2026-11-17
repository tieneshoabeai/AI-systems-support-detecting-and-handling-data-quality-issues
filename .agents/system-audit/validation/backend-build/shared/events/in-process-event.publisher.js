"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var InProcessEventPublisher_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.InProcessEventPublisher = void 0;
const common_1 = require("@nestjs/common");
let InProcessEventPublisher = InProcessEventPublisher_1 = class InProcessEventPublisher {
    mode = 'in-process';
    logger = new common_1.Logger(InProcessEventPublisher_1.name);
    handlers = [];
    onEvent(handler) {
        this.handlers.push(handler);
    }
    async publish(envelope) {
        for (const h of this.handlers) {
            try {
                await h(envelope);
            }
            catch (err) {
                const msg = err instanceof Error ? err.message : String(err);
                this.logger.warn(`In-process handler loi: ${msg}`);
            }
        }
    }
};
exports.InProcessEventPublisher = InProcessEventPublisher;
exports.InProcessEventPublisher = InProcessEventPublisher = InProcessEventPublisher_1 = __decorate([
    (0, common_1.Injectable)()
], InProcessEventPublisher);
//# sourceMappingURL=in-process-event.publisher.js.map