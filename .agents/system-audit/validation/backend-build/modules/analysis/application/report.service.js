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
exports.ReportService = void 0;
const common_1 = require("@nestjs/common");
const analysis_repository_port_1 = require("../domain/ports/analysis.repository.port");
const projects_service_1 = require("../../projects/application/projects.service");
const object_id_util_1 = require("../../../shared/utils/object-id.util");
const storage_port_1 = require("../../../shared/ports/storage.port");
let ReportService = class ReportService {
    analysisRepository;
    projectsService;
    storage;
    constructor(analysisRepository, projectsService, storage) {
        this.analysisRepository = analysisRepository;
        this.projectsService = projectsService;
        this.storage = storage;
    }
    async requestReport(projectId) {
        if (!(0, object_id_util_1.isObjectIdHex)(projectId))
            throw new common_1.BadRequestException('ID Dự án không hợp lệ');
        const project = await this.projectsService.getProjectById(projectId);
        const saved = await this.analysisRepository.findLatestSaveByProject(projectId);
        if (!saved)
            throw new common_1.NotFoundException('Chưa có Tổng kết — hãy tạo Tổng kết trước khi sinh PDF');
        const job = await this.analysisRepository.createReportJob({
            projectId: project.id,
            workspaceId: project.workspaceId,
            projectSaveId: saved.id,
            status: 'pending',
        });
        return {
            reportId: job.id,
            status: 'pending',
            pollUrl: `/api/v1/projects/${projectId}/report/${job.id}/file`,
        };
    }
    async downloadReportFile(projectId, reportId) {
        const job = await this.analysisRepository.findReportById(reportId);
        if (!job || job.projectId !== projectId || !job.storageKey) {
            throw new common_1.NotFoundException('Không tìm thấy báo cáo');
        }
        if (job.status !== 'succeeded') {
            throw new common_1.NotFoundException('Báo cáo chưa sẵn sàng');
        }
        const stream = await this.storage.downloadStream(job.storageKey);
        return { stream, fileSizeBytes: job.fileSizeBytes ?? null };
    }
    async getReportFileMeta(projectId, reportId) {
        const job = await this.analysisRepository.findReportById(reportId);
        if (!job || job.projectId !== projectId)
            throw new common_1.NotFoundException('Không tìm thấy báo cáo');
        if (job.status !== 'succeeded' || !job.storageKey) {
            return { reportId, status: job.status, error: job.error ?? null };
        }
        return {
            reportId,
            status: job.status,
            fileSizeBytes: job.fileSizeBytes,
            downloadUrl: `/api/v1/projects/${projectId}/report/${reportId}/file`,
        };
    }
};
exports.ReportService = ReportService;
exports.ReportService = ReportService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(analysis_repository_port_1.ANALYSIS_REPOSITORY_PORT)),
    __param(2, (0, common_1.Inject)(storage_port_1.STORAGE_PORT)),
    __metadata("design:paramtypes", [Object, projects_service_1.ProjectsService, Object])
], ReportService);
//# sourceMappingURL=report.service.js.map