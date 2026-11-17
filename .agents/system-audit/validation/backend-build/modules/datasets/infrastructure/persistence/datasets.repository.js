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
Object.defineProperty(exports, "__esModule", { value: true });
exports.DatasetsRepository = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const dataset_mapper_1 = require("./dataset.mapper");
const object_id_util_1 = require("../../../../shared/utils/object-id.util");
let DatasetsRepository = class DatasetsRepository {
    datasetModel;
    recordModel;
    constructor(datasetModel, recordModel) {
        this.datasetModel = datasetModel;
        this.recordModel = recordModel;
    }
    async create(data) {
        const inst = new this.datasetModel((0, dataset_mapper_1.toDatasetPersistence)(data));
        const saved = await inst.save();
        return (0, dataset_mapper_1.toDatasetRecord)(saved);
    }
    async findById(id) {
        if (!(0, object_id_util_1.isObjectIdHex)(id))
            return null;
        const doc = await this.datasetModel
            .findOne({ _id: new mongoose_2.Types.ObjectId(id), deleted_at: null })
            .exec();
        return doc ? (0, dataset_mapper_1.toDatasetRecord)(doc) : null;
    }
    async findByProject(projectId) {
        if (!(0, object_id_util_1.isObjectIdHex)(projectId))
            return null;
        const doc = await this.datasetModel
            .findOne({ project_id: new mongoose_2.Types.ObjectId(projectId), deleted_at: null })
            .sort({ created_at: -1 })
            .exec();
        return doc ? (0, dataset_mapper_1.toDatasetRecord)(doc) : null;
    }
    async updateById(id, update) {
        if (!(0, object_id_util_1.isObjectIdHex)(id))
            return null;
        const set = (0, dataset_mapper_1.toDatasetUpdate)(update);
        const doc = await this.datasetModel
            .findOneAndUpdate({ _id: new mongoose_2.Types.ObjectId(id), deleted_at: null }, { $set: set }, { new: true })
            .exec();
        return doc ? (0, dataset_mapper_1.toDatasetRecord)(doc) : null;
    }
    async bulkInsertRecords(records) {
        if (records.length === 0)
            return 0;
        const operations = records.map((record) => ({
            insertOne: {
                document: {
                    dataset_id: new mongoose_2.Types.ObjectId(record.datasetId),
                    row_index: record.rowIndex,
                    props: record.props,
                    created_at: new Date(),
                    updated_at: new Date(),
                },
            },
        }));
        const result = await this.recordModel.bulkWrite(operations, { ordered: false });
        return result.insertedCount;
    }
    async softDeleteDatasetWithRecords(datasetId) {
        if (!(0, object_id_util_1.isObjectIdHex)(datasetId))
            return false;
        const id = new mongoose_2.Types.ObjectId(datasetId);
        const result = await this.datasetModel.updateOne({ _id: id, deleted_at: null }, { $set: { deleted_at: new Date() } });
        if (result.modifiedCount > 0) {
            await this.recordModel.deleteMany({ dataset_id: id });
            return true;
        }
        return false;
    }
};
exports.DatasetsRepository = DatasetsRepository;
exports.DatasetsRepository = DatasetsRepository = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_1.InjectModel)('Dataset')),
    __param(1, (0, mongoose_1.InjectModel)('DatasetRecord')),
    __metadata("design:paramtypes", [mongoose_2.Model, mongoose_2.Model])
], DatasetsRepository);
//# sourceMappingURL=datasets.repository.js.map