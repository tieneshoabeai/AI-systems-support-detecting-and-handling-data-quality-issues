"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DatasetsModule = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const dataset_schema_1 = require("./infrastructure/persistence/dataset.schema");
const dataset_record_schema_1 = require("./infrastructure/persistence/dataset-record.schema");
const datasets_repository_1 = require("./infrastructure/persistence/datasets.repository");
const dataset_repository_port_1 = require("./domain/ports/dataset.repository.port");
const datasets_service_1 = require("./application/datasets.service");
const datasets_controller_1 = require("./infrastructure/http/datasets.controller");
const schema_inference_service_1 = require("./application/services/schema-inference.service");
const projects_module_1 = require("../projects/projects.module");
const workspaces_module_1 = require("../workspaces/workspaces.module");
const storage_module_1 = require("../../shared/storage/storage.module");
const outbox_module_1 = require("../../shared/application/outbox/outbox.module");
let DatasetsModule = class DatasetsModule {
};
exports.DatasetsModule = DatasetsModule;
exports.DatasetsModule = DatasetsModule = __decorate([
    (0, common_1.Module)({
        imports: [
            mongoose_1.MongooseModule.forFeature([
                { name: 'Dataset', schema: dataset_schema_1.DatasetSchema },
                { name: 'DatasetRecord', schema: dataset_record_schema_1.DatasetRecordSchema },
            ]),
            projects_module_1.ProjectsModule,
            workspaces_module_1.WorkspacesModule,
            storage_module_1.StorageModule,
            outbox_module_1.OutboxModule,
        ],
        controllers: [datasets_controller_1.DatasetsController],
        providers: [
            datasets_repository_1.DatasetsRepository,
            { provide: dataset_repository_port_1.DATASET_REPOSITORY_PORT, useExisting: datasets_repository_1.DatasetsRepository },
            datasets_service_1.DatasetsService,
            schema_inference_service_1.SchemaInferenceService,
        ],
        exports: [datasets_repository_1.DatasetsRepository, dataset_repository_port_1.DATASET_REPOSITORY_PORT, datasets_service_1.DatasetsService, schema_inference_service_1.SchemaInferenceService],
    })
], DatasetsModule);
//# sourceMappingURL=datasets.module.js.map