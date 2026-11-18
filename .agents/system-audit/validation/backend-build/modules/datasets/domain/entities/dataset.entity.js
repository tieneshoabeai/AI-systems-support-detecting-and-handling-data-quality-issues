"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Dataset = exports.storageKeyForDataset = exports.isCsvFile = void 0;
const dataset_limits_vo_1 = require("../value-objects/dataset-limits.vo");
Object.defineProperty(exports, "isCsvFile", { enumerable: true, get: function () { return dataset_limits_vo_1.isCsvFile; } });
Object.defineProperty(exports, "storageKeyForDataset", { enumerable: true, get: function () { return dataset_limits_vo_1.storageKeyForDataset; } });
const column_type_vo_1 = require("../value-objects/column-type.vo");
class Dataset {
    props;
    constructor(props) {
        this.props = props;
    }
    static create(props) {
        return new Dataset({ ...props, columns: [...props.columns] });
    }
    static columnKeys(count) {
        return Array.from({ length: count }, (_, i) => (0, column_type_vo_1.stableColumnKey)(i));
    }
    assertIngestible() {
        if (!(0, dataset_limits_vo_1.isCsvFile)(this.props.fileName)) {
            throw new Error(`Chi ho tro file .csv (nhan duoc: ${this.props.fileName})`);
        }
        if (this.props.columns.length > dataset_limits_vo_1.MAX_COLUMNS) {
            throw new Error(`So cot vuot qua gioi han ${dataset_limits_vo_1.MAX_COLUMNS}`);
        }
    }
}
exports.Dataset = Dataset;
//# sourceMappingURL=dataset.entity.js.map