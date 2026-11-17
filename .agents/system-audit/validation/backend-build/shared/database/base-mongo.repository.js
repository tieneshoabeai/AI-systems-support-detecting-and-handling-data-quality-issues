"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BaseMongoRepository = void 0;
const mongoose_1 = require("mongoose");
const mongo_session_context_1 = require("./mongo-session-context");
class BaseMongoRepository {
    model;
    constructor(model) {
        this.model = model;
    }
    applySoftDeleteFilter(filter) {
        return {
            ...filter,
            deleted_at: null,
        };
    }
    async findById(id, projection, session) {
        const s = (0, mongo_session_context_1.resolveMongoSession)(session);
        return this.model
            .findOne(this.applySoftDeleteFilter({ _id: new mongoose_1.Types.ObjectId(id) }), projection, { session: s })
            .exec();
    }
    async findOne(filter, projection, options, session) {
        const s = (0, mongo_session_context_1.resolveMongoSession)(session);
        return this.model
            .findOne(this.applySoftDeleteFilter(filter), projection, { ...options, session: s })
            .exec();
    }
    async find(filter = {}, projection, options, session) {
        const s = (0, mongo_session_context_1.resolveMongoSession)(session);
        return this.model
            .find(this.applySoftDeleteFilter(filter), projection, { ...options, session: s })
            .exec();
    }
    async count(filter = {}, session) {
        const s = (0, mongo_session_context_1.resolveMongoSession)(session);
        return this.model.countDocuments(this.applySoftDeleteFilter(filter), { session: s }).exec();
    }
    async create(doc, session) {
        const s = (0, mongo_session_context_1.resolveMongoSession)(session);
        const instance = new this.model({ ...doc, deleted_at: null });
        return instance.save({ session: s });
    }
    async softDelete(id, session) {
        const s = (0, mongo_session_context_1.resolveMongoSession)(session);
        const result = await this.model.updateOne(this.applySoftDeleteFilter({ _id: new mongoose_1.Types.ObjectId(id) }), { $set: { deleted_at: new Date() } }, { session: s });
        return result.modifiedCount > 0;
    }
    async updateById(id, update, session) {
        const s = (0, mongo_session_context_1.resolveMongoSession)(session);
        return this.model
            .findOneAndUpdate(this.applySoftDeleteFilter({ _id: new mongoose_1.Types.ObjectId(id) }), update, { new: true, session: s })
            .exec();
    }
}
exports.BaseMongoRepository = BaseMongoRepository;
//# sourceMappingURL=base-mongo.repository.js.map