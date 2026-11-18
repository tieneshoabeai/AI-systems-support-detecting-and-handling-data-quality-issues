"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DatasetRecordSchema = void 0;
const mongoose_1 = require("mongoose");
exports.DatasetRecordSchema = new mongoose_1.Schema({
    dataset_id: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Dataset', required: true, index: true },
    row_index: { type: Number, required: true, index: true },
    props: { type: mongoose_1.Schema.Types.Mixed, required: true },
}, {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
});
exports.DatasetRecordSchema.index({ dataset_id: 1, row_index: 1 }, { unique: true });
//# sourceMappingURL=dataset-record.schema.js.map