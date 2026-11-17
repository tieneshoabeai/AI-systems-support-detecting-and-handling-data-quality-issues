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
exports.PoliciesGuard = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@nestjs/core");
const casl_ability_factory_1 = require("./casl-ability.factory");
const check_policies_decorator_1 = require("./check-policies.decorator");
const policy_resource_decorator_1 = require("./policy-resource.decorator");
const subject_helper_1 = require("./subject.helper");
let PoliciesGuard = class PoliciesGuard {
    reflector;
    caslAbilityFactory;
    moduleRef;
    constructor(reflector, caslAbilityFactory, moduleRef) {
        this.reflector = reflector;
        this.caslAbilityFactory = caslAbilityFactory;
        this.moduleRef = moduleRef;
    }
    async canActivate(context) {
        const policyHandlers = this.reflector.get(check_policies_decorator_1.CHECK_POLICIES_KEY, context.getHandler()) ?? [];
        const request = context.switchToHttp().getRequest();
        const user = request.user;
        if (!user) {
            if (policyHandlers.length === 0) {
                return true;
            }
            throw new common_1.ForbiddenException('Không có quyền truy cập (Thiếu thông tin xác thực)');
        }
        if (policyHandlers.length === 0) {
            return true;
        }
        const ability = this.caslAbilityFactory.createForUser(user);
        const params = request.params || {};
        const body = request.body || {};
        const query = request.query || {};
        let isStaticallyAllowed = false;
        let checkedAtLeastOne = false;
        const spyAbility = new Proxy(ability, {
            get(target, prop, receiver) {
                if (prop === 'can') {
                    return (action, subjectInput, field) => {
                        checkedAtLeastOne = true;
                        const subjectStr = typeof subjectInput === 'string'
                            ? subjectInput
                            : (subjectInput && typeof subjectInput === 'object' && '__type' in subjectInput)
                                ? subjectInput.__type
                                : (subjectInput && subjectInput.constructor && subjectInput.constructor.name) ||
                                    subjectInput;
                        if (typeof subjectStr === 'string' && target.can(action, subjectStr, field)) {
                            isStaticallyAllowed = true;
                            return true;
                        }
                        return false;
                    };
                }
                if (prop === 'ability')
                    return target;
                if (prop === 'user')
                    return user;
                if (prop === 'request')
                    return request;
                if (prop === 'params')
                    return params;
                if (prop === 'body')
                    return body;
                if (prop === 'query')
                    return query;
                if (prop === 'resource')
                    return undefined;
                const val = Reflect.get(target, prop, receiver);
                return typeof val === 'function' ? val.bind(target) : val;
            },
        });
        for (const handler of policyHandlers) {
            await handler(spyAbility);
        }
        if (checkedAtLeastOne && !isStaticallyAllowed) {
            throw new common_1.ForbiddenException('Không có quyền thực hiện thao tác này (Static check failed)');
        }
        const resourceMeta = this.reflector.get(policy_resource_decorator_1.POLICY_RESOURCE_KEY, context.getHandler()) ??
            this.reflector.get(policy_resource_decorator_1.POLICY_RESOURCE_KEY, context.getClass());
        if (resourceMeta && request.params && request.params.id) {
            let loaderInstance = null;
            try {
                loaderInstance = this.moduleRef.get(resourceMeta.loader, { strict: false });
            }
            catch {
                loaderInstance = await this.moduleRef.resolve(resourceMeta.loader);
            }
            if (loaderInstance && typeof loaderInstance.load === 'function') {
                const resource = await loaderInstance.load(request.params.id, user.workspaceId);
                if (!resource) {
                    throw new common_1.NotFoundException('Tài nguyên không tồn tại hoặc đã bị xóa');
                }
                request.resource = resource;
            }
        }
        const resource = request.resource;
        const handlerCtx = new Proxy(ability, {
            get(target, prop, receiver) {
                if (prop === 'ability')
                    return target;
                if (prop === 'user')
                    return user;
                if (prop === 'request')
                    return request;
                if (prop === 'params')
                    return params;
                if (prop === 'body')
                    return body;
                if (prop === 'query')
                    return query;
                if (prop === 'resource')
                    return resource;
                if (prop === 'can') {
                    return (action, subjectInput, field) => {
                        let targetSubject = subjectInput;
                        if (typeof subjectInput === 'string' &&
                            resource &&
                            resourceMeta &&
                            resourceMeta.subject === subjectInput) {
                            targetSubject = (0, subject_helper_1.buildSubject)(subjectInput, resource);
                        }
                        return target.can(action, targetSubject, field);
                    };
                }
                const val = Reflect.get(target, prop, receiver);
                return typeof val === 'function' ? val.bind(target) : val;
            },
        });
        for (const handler of policyHandlers) {
            const allowed = await handler(handlerCtx);
            if (!allowed) {
                throw new common_1.ForbiddenException('Không có quyền thực hiện thao tác trên tài nguyên này (Policy check failed)');
            }
        }
        return true;
    }
};
exports.PoliciesGuard = PoliciesGuard;
exports.PoliciesGuard = PoliciesGuard = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [core_1.Reflector, casl_ability_factory_1.CaslAbilityFactory, core_1.ModuleRef])
], PoliciesGuard);
//# sourceMappingURL=policies.guard.js.map