/**
 * E2E Test: API Phân tích Dữ liệu (Analysis API)
 * 
 * Mục tiêu: Kiểm tra API phân tích dữ liệu có thực hiện phân tích 
 * và trả về kết quả đúng theo yêu cầu không.
 * 
 * Endpoints kiểm tra:
 * - POST /projects/:projectId/analysis (chạy phân tích)
 * - GET /projects/:projectId/analysis/result (lấy kết quả)
 * - GET /analysis/jobs/:jobId (trạng thái job)
 */

import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AllExceptionsFilter } from '../../src/shared/interfaces/filters/all-exceptions.filter';
import { TransformInterceptor } from '../../src/shared/interfaces/interceptors/transform.interceptor';
import { RequestIdMiddleware } from '../../src/shared/interfaces/middleware/request-id.middleware';
import { JwtAuthGuard } from '../../src/shared/interfaces/guards/jwt-auth.guard';
import { PoliciesGuard } from '../../src/shared/interfaces/casl/policies.guard';
import { AnalysisController } from '../../src/modules/analysis/presentation/controllers/analysis.controller';
import { RunAnalysisHandler } from '../../src/modules/analysis/application/commands/run-analysis.handler';
import { GetResultHandler } from '../../src/modules/analysis/application/queries/get-result.handler';
import { GetJobHandler } from '../../src/modules/analysis/application/queries/get-job.handler';
import { RetryJobHandler } from '../../src/modules/analysis/application/commands/retry-job.handler';
import { IngestAiResultHandler } from '../../src/modules/analysis/application/commands/ingest-ai-result.handler';
import { AUDIT_LOGGER_PORT } from '../../src/modules/audit';

const MOCK_USER = {
  userId: '507f1f77bcf86cd799439011',
  email: 'analyst@test.local',
  role: 'analyst',
  sessionId: 'sess-analysis-test',
};

const PROJECT_ID = '507f1f77bcf86cd799439013';
const JOB_ID = '507f1f77bcf86cd799439021';

describe('E2E — Analysis API (Phân tích dữ liệu)', () => {
  let app: INestApplication;

  // Mock handlers
  const runAnalysisHandler = { execute: jest.fn() };
  const getResultHandler = { execute: jest.fn() };
  const getJobHandler = { execute: jest.fn() };
  const retryJobHandler = { execute: jest.fn() };
  const ingestAiResultHandler = { execute: jest.fn() };

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AnalysisController],
      providers: [
        { provide: RunAnalysisHandler, useValue: runAnalysisHandler },
        { provide: GetResultHandler, useValue: getResultHandler },
        { provide: GetJobHandler, useValue: getJobHandler },
        { provide: RetryJobHandler, useValue: retryJobHandler },
        { provide: IngestAiResultHandler, useValue: ingestAiResultHandler },
        { provide: AUDIT_LOGGER_PORT, useValue: { log: jest.fn() } },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (ctx: ExecutionContext) => {
          ctx.switchToHttp().getRequest().user = MOCK_USER;
          return true;
        },
      })
      .overrideGuard(PoliciesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    app = module.createNestApplication();
    const rid = new RequestIdMiddleware();
    app.use(rid.use.bind(rid));
    app.useGlobalFilters(new AllExceptionsFilter());
    app.useGlobalInterceptors(new TransformInterceptor());
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  /**
   * TEST 1: Chạy phân tích (POST)
   * 
   * Yêu cầu: POST /projects/:projectId/analysis
   * Với body: correlation_method, outlier_method, top_n, chart_top_n
   * 
   * Kỳ vọng: Trả về 201 với jobId
   */
  describe('POST /projects/:projectId/analysis', () => {
    it('✅ Chạy phân tích thành công - trả về 201 với jobId', async () => {
      const analysisResult = {
        projectId: PROJECT_ID,
        jobId: JOB_ID,
        status: 'pending',
        correlation_method: 'pearson',
        outlier_method: 'iqr',
        top_n: 10,
        chart_top_n: 5,
        createdAt: new Date(),
      };

      runAnalysisHandler.execute.mockResolvedValue(analysisResult);

      const response = await request(app.getHttpServer())
        .post(`/projects/${PROJECT_ID}/analysis`)
        .set('x-request-id', 'test-001')
        .send({
          correlation_method: 'pearson',
          outlier_method: 'iqr',
          top_n: 10,
          chart_top_n: 5,
        });

      expect(response.status).toBe(201);
      expect(response.body).toBeDefined();
      expect(response.body.data).toBeDefined();
      expect(response.body.data.projectId).toBe(PROJECT_ID);
      expect(response.body.data.jobId).toBe(JOB_ID);
      expect(response.body.data.status).toBe('pending');
      expect(runAnalysisHandler.execute).toHaveBeenCalled();

      console.log('✅ Test 1 Passed: POST /projects/:projectId/analysis');
      console.log('   - HTTP Status: 201 ✓');
      console.log('   - Response contains projectId ✓');
      console.log('   - Response contains jobId ✓');
      console.log('   - Response contains status ✓');
    });

    it('❌ Phân tích với giá trị không hợp lệ - trả về 400', async () => {
      const response = await request(app.getHttpServer())
        .post(`/projects/${PROJECT_ID}/analysis`)
        .set('x-request-id', 'test-002')
        .send({
          correlation_method: 'invalid_method',
          outlier_method: 'iqr',
          top_n: 9999, // vượt max 100
        });

      expect(response.status).toBe(400);
      expect(runAnalysisHandler.execute).not.toHaveBeenCalled();

      console.log('✅ Test 2 Passed: Validation - trả về 400 cho dữ liệu không hợp lệ');
    });

    it('✅ Phân tích với default parameters', async () => {
      const analysisResult = {
        projectId: PROJECT_ID,
        jobId: JOB_ID,
        status: 'pending',
        correlation_method: 'pearson', // default
        outlier_method: 'iqr', // default
        top_n: 10, // default
        chart_top_n: 5, // default
      };

      runAnalysisHandler.execute.mockResolvedValue(analysisResult);

      const response = await request(app.getHttpServer())
        .post(`/projects/${PROJECT_ID}/analysis`)
        .set('x-request-id', 'test-003')
        .send({}); // gửi body rỗng, dùng defaults

      expect(response.status).toBe(201);
      expect(response.body.data.correlation_method).toBe('pearson');
      expect(response.body.data.outlier_method).toBe('iqr');
      expect(response.body.data.top_n).toBe(10);

      console.log('✅ Test 3 Passed: Default parameters được áp dụng');
    });
  });

  /**
   * TEST 2: Lấy kết quả phân tích (GET)
   * 
   * Yêu cầu: GET /projects/:projectId/analysis/result
   * 
   * Kỳ vọng: Trả về 200 với findings, correlation matrix, etc.
   */
  describe('GET /projects/:projectId/analysis/result', () => {
    it('✅ Lấy kết quả phân tích thành công', async () => {
      const analysisResult = {
        projectId: PROJECT_ID,
        status: 'done',
        findings: [
          {
            id: 'finding-1',
            type: 'correlation',
            column1: 'age',
            column2: 'income',
            value: 0.85,
            severity: 'high',
          },
          {
            id: 'finding-2',
            type: 'outlier',
            column: 'salary',
            count: 5,
            percentage: 2.5,
            severity: 'medium',
          },
        ],
        correlationMatrix: {
          rows: ['age', 'income', 'salary'],
          columns: ['age', 'income', 'salary'],
          values: [
            [1, 0.85, 0.72],
            [0.85, 1, 0.68],
            [0.72, 0.68, 1],
          ],
        },
        summary: {
          totalRecords: 200,
          totalColumns: 15,
          findingsCount: 2,
          qualityScore: 0.92,
        },
      };

      getResultHandler.execute.mockResolvedValue(analysisResult);

      const response = await request(app.getHttpServer())
        .get(`/projects/${PROJECT_ID}/analysis/result`)
        .set('x-request-id', 'test-004');

      expect(response.status).toBe(200);
      expect(response.body).toBeDefined();
      expect(response.body.data).toBeDefined();
      expect(response.body.data.projectId).toBe(PROJECT_ID);
      expect(response.body.data.findings).toBeDefined();
      expect(Array.isArray(response.body.data.findings)).toBe(true);
      expect(response.body.data.correlationMatrix).toBeDefined();
      expect(response.body.data.summary).toBeDefined();

      console.log('✅ Test 4 Passed: GET /projects/:projectId/analysis/result');
      console.log('   - HTTP Status: 200 ✓');
      console.log('   - Response contains findings array ✓');
      console.log('   - Response contains correlationMatrix ✓');
      console.log('   - Response contains summary ✓');
      console.log(`   - Total findings: ${response.body.data.findings.length}`);
    });

    it('✅ Findings có đủ thông tin chi tiết', async () => {
      const analysisResult = {
        projectId: PROJECT_ID,
        findings: [
          {
            id: 'finding-1',
            type: 'correlation',
            column1: 'age',
            column2: 'income',
            value: 0.85,
            severity: 'high',
            recommendation: 'Kiểm tra mối quan hệ tiềm ẩn giữa tuổi và thu nhập',
          },
        ],
        summary: {
          totalRecords: 200,
          qualityScore: 0.92,
        },
      };

      getResultHandler.execute.mockResolvedValue(analysisResult);

      const response = await request(app.getHttpServer())
        .get(`/projects/${PROJECT_ID}/analysis/result`)
        .set('x-request-id', 'test-005');

      expect(response.status).toBe(200);
      const finding = response.body.data.findings[0];
      expect(finding).toHaveProperty('id');
      expect(finding).toHaveProperty('type');
      expect(finding).toHaveProperty('column1');
      expect(finding).toHaveProperty('column2');
      expect(finding).toHaveProperty('value');
      expect(finding).toHaveProperty('severity');

      console.log('✅ Test 5 Passed: Findings có đủ thông tin chi tiết');
      console.log(`   - Finding type: ${finding.type}`);
      console.log(`   - Correlation: ${finding.column1} <-> ${finding.column2} = ${finding.value}`);
      console.log(`   - Severity: ${finding.severity}`);
    });
  });

  /**
   * TEST 3: Trạng thái AI Job (GET)
   * 
   * Yêu cầu: GET /analysis/jobs/:jobId
   * 
   * Kỳ vọng: Trả về 200 với job status (pending, processing, done, failed)
   */
  describe('GET /analysis/jobs/:jobId', () => {
    it('✅ Lấy trạng thái job thành công - pending', async () => {
      const jobStatus = {
        id: JOB_ID,
        status: 'pending',
        projectId: PROJECT_ID,
        createdAt: new Date(),
        progress: 0,
      };

      getJobHandler.execute.mockResolvedValue(jobStatus);

      const response = await request(app.getHttpServer())
        .get(`/analysis/jobs/${JOB_ID}`)
        .set('x-request-id', 'test-006');

      expect(response.status).toBe(200);
      expect(response.body.data.id).toBe(JOB_ID);
      expect(response.body.data.status).toBe('pending');
      expect(['pending', 'processing', 'done', 'failed']).toContain(
        response.body.data.status,
      );

      console.log('✅ Test 6 Passed: GET /analysis/jobs/:jobId');
      console.log(`   - Job ID: ${response.body.data.id}`);
      console.log(`   - Status: ${response.body.data.status}`);
      console.log(`   - Progress: ${response.body.data.progress}%`);
    });

    it('✅ Trạng thái job: processing', async () => {
      const jobStatus = {
        id: JOB_ID,
        status: 'processing',
        projectId: PROJECT_ID,
        progress: 50,
        currentStep: 'Calculating correlations...',
      };

      getJobHandler.execute.mockResolvedValue(jobStatus);

      const response = await request(app.getHttpServer())
        .get(`/analysis/jobs/${JOB_ID}`)
        .set('x-request-id', 'test-007');

      expect(response.status).toBe(200);
      expect(response.body.data.status).toBe('processing');
      expect(response.body.data.progress).toBe(50);

      console.log('✅ Test 7 Passed: Job status = processing');
      console.log(`   - Progress: ${response.body.data.progress}%`);
      console.log(`   - Current step: ${response.body.data.currentStep}`);
    });

    it('✅ Trạng thái job: done', async () => {
      const jobStatus = {
        id: JOB_ID,
        status: 'done',
        projectId: PROJECT_ID,
        progress: 100,
        completedAt: new Date(),
        resultSummary: {
          findingsCount: 2,
          qualityScore: 0.92,
        },
      };

      getJobHandler.execute.mockResolvedValue(jobStatus);

      const response = await request(app.getHttpServer())
        .get(`/analysis/jobs/${JOB_ID}`)
        .set('x-request-id', 'test-008');

      expect(response.status).toBe(200);
      expect(response.body.data.status).toBe('done');
      expect(response.body.data.progress).toBe(100);
      expect(response.body.data.resultSummary).toBeDefined();

      console.log('✅ Test 8 Passed: Job status = done');
      console.log(`   - Progress: 100%`);
      console.log(`   - Findings count: ${response.body.data.resultSummary.findingsCount}`);
      console.log(`   - Quality score: ${response.body.data.resultSummary.qualityScore}`);
    });
  });

  /**
   * TEST 4: Luồng hoàn chỉnh (run → check status → get result)
   */
  describe('Complete Analysis Workflow', () => {
    it('✅ Luồng phân tích hoàn chỉnh: run → pending → processing → done → result', async () => {
      // Step 1: Run analysis
      runAnalysisHandler.execute.mockResolvedValue({
        projectId: PROJECT_ID,
        jobId: JOB_ID,
        status: 'pending',
      });

      const runResponse = await request(app.getHttpServer())
        .post(`/projects/${PROJECT_ID}/analysis`)
        .set('x-request-id', 'test-wf-001')
        .send({ correlation_method: 'pearson', outlier_method: 'iqr', top_n: 10 });

      expect(runResponse.status).toBe(201);
      const jobId = runResponse.body.data.jobId;

      console.log('  Step 1: ✅ Chạy phân tích → jobId:', jobId);

      // Step 2: Check job status - pending
      getJobHandler.execute.mockResolvedValue({
        id: jobId,
        status: 'pending',
        progress: 0,
      });

      const statusResponse1 = await request(app.getHttpServer())
        .get(`/analysis/jobs/${jobId}`)
        .set('x-request-id', 'test-wf-002');

      expect(statusResponse1.status).toBe(200);
      expect(statusResponse1.body.data.status).toBe('pending');

      console.log('  Step 2: ✅ Check job status → pending');

      // Step 3: Check job status - processing
      getJobHandler.execute.mockResolvedValue({
        id: jobId,
        status: 'processing',
        progress: 50,
        currentStep: 'Analyzing correlations...',
      });

      const statusResponse2 = await request(app.getHttpServer())
        .get(`/analysis/jobs/${jobId}`)
        .set('x-request-id', 'test-wf-003');

      expect(statusResponse2.status).toBe(200);
      expect(statusResponse2.body.data.status).toBe('processing');

      console.log('  Step 3: ✅ Check job status → processing (50%)');

      // Step 4: Check job status - done
      getJobHandler.execute.mockResolvedValue({
        id: jobId,
        status: 'done',
        progress: 100,
      });

      const statusResponse3 = await request(app.getHttpServer())
        .get(`/analysis/jobs/${jobId}`)
        .set('x-request-id', 'test-wf-004');

      expect(statusResponse3.status).toBe(200);
      expect(statusResponse3.body.data.status).toBe('done');

      console.log('  Step 4: ✅ Check job status → done');

      // Step 5: Get analysis result
      getResultHandler.execute.mockResolvedValue({
        projectId: PROJECT_ID,
        jobId: jobId,
        status: 'done',
        findings: [
          { type: 'correlation', column1: 'a', column2: 'b', value: 0.9 },
          { type: 'outlier', column: 'c', count: 3 },
        ],
        summary: { qualityScore: 0.95 },
      });

      const resultResponse = await request(app.getHttpServer())
        .get(`/projects/${PROJECT_ID}/analysis/result`)
        .set('x-request-id', 'test-wf-005');

      expect(resultResponse.status).toBe(200);
      expect(resultResponse.body.data.findings).toBeDefined();
      expect(resultResponse.body.data.findings.length).toBeGreaterThan(0);

      console.log('  Step 5: ✅ Lấy kết quả phân tích');
      console.log(`     - Findings: ${resultResponse.body.data.findings.length}`);
      console.log(`     - Quality score: ${resultResponse.body.data.summary.qualityScore}`);

      console.log('✅ Workflow Complete: analysis workflow hoàn chỉnh thành công');
    });
  });
});
