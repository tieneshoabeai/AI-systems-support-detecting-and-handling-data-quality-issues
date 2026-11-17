"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AnalysisModule = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const analysis_run_schema_1 = require("./infrastructure/persistence/analysis-run.schema");
const analysis_result_schema_1 = require("./infrastructure/persistence/analysis-result.schema");
const ai_job_schema_1 = require("./infrastructure/persistence/ai-job.schema");
const few_shot_example_schema_1 = require("./infrastructure/persistence/few-shot-example.schema");
const dataset_record_schema_1 = require("../datasets/infrastructure/persistence/dataset-record.schema");
const cell_evidence_schema_1 = require("./infrastructure/persistence/cell-evidence.schema");
const project_save_schema_1 = require("./infrastructure/persistence/project-save.schema");
const report_job_schema_1 = require("./infrastructure/persistence/report-job.schema");
const analysis_config_schema_1 = require("./infrastructure/persistence/analysis-config.schema");
const summary_service_1 = require("./application/summary.service");
const report_service_1 = require("./application/report.service");
const report_worker_service_1 = require("./application/report-worker.service");
const summary_controller_1 = require("./infrastructure/http/summary.controller");
const report_controller_1 = require("./infrastructure/http/report.controller");
const analysis_repository_1 = require("./infrastructure/persistence/analysis.repository");
const analysis_repository_port_1 = require("./domain/ports/analysis.repository.port");
const ai_inference_port_1 = require("./application/ports/ai-inference.port");
const local_inference_adapter_1 = require("./infrastructure/ai/local-inference.adapter");
const ai_worker_service_1 = require("./application/services/ai-worker.service");
const rag_few_shot_service_1 = require("./application/services/rag-few-shot.service");
const analysis_service_1 = require("./application/analysis.service");
const analysis_controller_1 = require("./infrastructure/http/analysis.controller");
const projects_module_1 = require("../projects/projects.module");
const storage_module_1 = require("../../shared/storage/storage.module");
const datasets_module_1 = require("../datasets/datasets.module");
const data_view_module_1 = require("../data-view/data-view.module");
let AnalysisModule = class AnalysisModule {
};
exports.AnalysisModule = AnalysisModule;
exports.AnalysisModule = AnalysisModule = __decorate([
    (0, common_1.Module)({
        imports: [
            mongoose_1.MongooseModule.forFeature([
                { name: 'AnalysisRun', schema: analysis_run_schema_1.AnalysisRunSchema },
                { name: 'AnalysisResult', schema: analysis_result_schema_1.AnalysisResultSchema },
                { name: 'AiJob', schema: ai_job_schema_1.AiJobSchema },
                { name: 'FewShotExample', schema: few_shot_example_schema_1.FewShotExampleSchema },
                { name: 'DatasetRecord', schema: dataset_record_schema_1.DatasetRecordSchema },
                { name: 'CellEvidence', schema: cell_evidence_schema_1.CellEvidenceSchema },
                { name: 'ProjectSave', schema: project_save_schema_1.ProjectSaveSchema },
                { name: 'ReportJob', schema: report_job_schema_1.ReportJobSchema },
                { name: 'AnalysisConfig', schema: analysis_config_schema_1.AnalysisConfigSchema },
            ]),
            projects_module_1.ProjectsModule,
            datasets_module_1.DatasetsModule,
            data_view_module_1.DataViewModule,
            storage_module_1.StorageModule,
        ],
        controllers: [analysis_controller_1.AnalysisController, summary_controller_1.SummaryController, report_controller_1.ReportController],
        providers: [
            analysis_repository_1.AnalysisRepository,
            { provide: analysis_repository_port_1.ANALYSIS_REPOSITORY_PORT, useExisting: analysis_repository_1.AnalysisRepository },
            analysis_service_1.AnalysisService,
            summary_service_1.SummaryService,
            report_service_1.ReportService,
            report_worker_service_1.ReportWorkerService,
            { provide: ai_inference_port_1.AiInferencePort, useClass: local_inference_adapter_1.LocalInferenceAdapter },
            ai_worker_service_1.AiWorkerService,
            rag_few_shot_service_1.RagFewShotService,
        ],
        exports: [analysis_repository_1.AnalysisRepository, analysis_repository_port_1.ANALYSIS_REPOSITORY_PORT, analysis_service_1.AnalysisService, summary_service_1.SummaryService, report_service_1.ReportService, rag_few_shot_service_1.RagFewShotService],
    })
], AnalysisModule);
//# sourceMappingURL=analysis.module.js.map