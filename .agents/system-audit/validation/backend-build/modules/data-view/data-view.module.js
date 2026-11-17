"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DataViewModule = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const dataset_record_schema_1 = require("../datasets/infrastructure/persistence/dataset-record.schema");
const data_view_service_1 = require("./application/data-view.service");
const data_view_controller_1 = require("./infrastructure/http/data-view.controller");
const datasets_module_1 = require("../datasets/datasets.module");
const record_query_repository_1 = require("./infrastructure/persistence/record-query.repository");
const record_query_port_1 = require("./domain/ports/record-query.port");
let DataViewModule = class DataViewModule {
};
exports.DataViewModule = DataViewModule;
exports.DataViewModule = DataViewModule = __decorate([
    (0, common_1.Module)({
        imports: [
            mongoose_1.MongooseModule.forFeature([{ name: 'DatasetRecord', schema: dataset_record_schema_1.DatasetRecordSchema }]),
            datasets_module_1.DatasetsModule,
        ],
        controllers: [data_view_controller_1.DataViewController],
        providers: [
            record_query_repository_1.RecordQueryRepository,
            { provide: record_query_port_1.RECORD_QUERY_PORT, useExisting: record_query_repository_1.RecordQueryRepository },
            data_view_service_1.DataViewService,
        ],
        exports: [data_view_service_1.DataViewService, record_query_port_1.RECORD_QUERY_PORT],
    })
], DataViewModule);
//# sourceMappingURL=data-view.module.js.map