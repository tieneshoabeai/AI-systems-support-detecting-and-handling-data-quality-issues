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
exports.SummaryService = void 0;
const common_1 = require("@nestjs/common");
const analysis_repository_port_1 = require("../domain/ports/analysis.repository.port");
const projects_service_1 = require("../../projects/application/projects.service");
const object_id_util_1 = require("../../../shared/utils/object-id.util");
let SummaryService = class SummaryService {
    analysisRepository;
    projectsService;
    constructor(analysisRepository, projectsService) {
        this.analysisRepository = analysisRepository;
        this.projectsService = projectsService;
    }
    async createSummary(projectId) {
        if (!(0, object_id_util_1.isObjectIdHex)(projectId))
            throw new common_1.BadRequestException('ID Dự án không hợp lệ');
        const project = await this.projectsService.getProjectById(projectId);
        const run = await this.analysisRepository.findLatestRunByProject(projectId);
        if (!run)
            throw new common_1.NotFoundException('Chưa chạy phân tích — hãy chạy Data Analysis & Detection trước');
        if (run.status !== 'succeeded')
            throw new common_1.BadRequestException('Phân tích hệ thống chưa thành công — hãy chạy lại phân tích');
        const result = await this.analysisRepository.findResultByRun(run.id);
        if (!result)
            throw new common_1.NotFoundException('Chưa có kết quả phân tích cho lần chạy mới nhất');
        const dq = (result.dqSummary ?? result.dq_summary ?? null);
        const issues = [];
        if (dq) {
            for (const c of dq.columns) {
                if (c.missingCount > 0)
                    issues.push({ dq: 'DQ-01', column: c.column, count: c.missingCount, rate: c.missingRate });
                if (c.invalidCount > 0)
                    issues.push({ dq: 'DQ-03', column: c.column, count: c.invalidCount, rate: c.invalidRate });
                if (c.outlierCount > 0)
                    issues.push({ dq: 'DQ-04', column: c.column, count: c.outlierCount, rate: c.outlierRate });
            }
            if (dq.duplicateRowCount > 0)
                issues.push({ dq: 'DQ-02', column: null, count: dq.duplicateRowCount, rate: null });
        }
        issues.sort((a, b) => b.count - a.count);
        const ai = result.aiCorrelationAssessment;
        const summary = {
            overview: `Dataset ${dq?.totalScanned ?? 0} dòng, ${issues.length} nhóm vấn đề.`,
            issues: issues.slice(0, 50),
            evidence_refs: await this.analysisRepository.countEvidencesByRun(run.id),
            recommendations: [
                'Kiểm tra định nghĩa cột tại nguồn trước khi mô hình hóa',
                'Không tự xóa/sửa dòng — xử lý tại nguồn',
            ],
            ai_section: ai && ai.status === 'succeeded' ? ai : null,
        };
        const saved = await this.analysisRepository.createSave({
            projectId: project.id,
            workspaceId: project.workspaceId,
            analysisRunId: run.id,
            analysisResultId: result.id,
            inputFingerprint: result.inputFingerprint,
            summary,
        });
        await this.analysisRepository.markSavesStale(projectId, saved.id);
        return {
            saveId: saved.id,
            projectId,
            analysisRunId: run.id,
            inputFingerprint: result.inputFingerprint,
            summary,
            isStale: false,
        };
    }
    async getSummary(projectId) {
        if (!(0, object_id_util_1.isObjectIdHex)(projectId))
            throw new common_1.BadRequestException('ID Dự án không hợp lệ');
        await this.projectsService.getProjectById(projectId);
        const saved = await this.analysisRepository.findLatestSaveByProject(projectId);
        if (!saved)
            throw new common_1.NotFoundException('Chưa có Tổng kết cho project này');
        return {
            saveId: saved.id,
            projectId,
            analysisRunId: saved.analysisRunId,
            inputFingerprint: saved.inputFingerprint,
            summary: saved.summary,
            isStale: saved.isStale,
        };
    }
};
exports.SummaryService = SummaryService;
exports.SummaryService = SummaryService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(analysis_repository_port_1.ANALYSIS_REPOSITORY_PORT)),
    __metadata("design:paramtypes", [Object, projects_service_1.ProjectsService])
], SummaryService);
//# sourceMappingURL=summary.service.js.map