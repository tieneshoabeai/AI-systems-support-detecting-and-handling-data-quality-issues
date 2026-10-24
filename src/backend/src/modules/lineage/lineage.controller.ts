import { Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../shared/guards/jwt-auth.guard';
import { PoliciesGuard } from '../../shared/casl/policies.guard';
import { CheckPolicies } from '../../shared/casl/check-policies.decorator';
import { Action } from '../../shared/casl/actions.enum';
import { LineageService } from './lineage.service';
import {
  LineageGraphResponseDto,
  UpstreamResponseDto,
  DownstreamResponseDto,
  VerifyIntegrityResponseDto,
} from './dto/lineage.dto';

@ApiTags('Lineage')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PoliciesGuard)
@Controller('lineage')
export class LineageController {
  constructor(private readonly lineageService: LineageService) {}

  @Get(':dataset_id')
  @CheckPolicies((ability) => ability.can(Action.Read, 'Lineage'))
  @ApiOperation({
    summary: 'Lấy đồ thị phả hệ dữ liệu Neo4j DAG (F8.1)',
    description: 'Xuất toàn bộ nodes và edges chuẩn cho thư viện vẽ đồ thị React Flow (@xyflow/react)',
  })
  @ApiParam({ name: 'dataset_id', description: 'ID của Dataset' })
  @ApiResponse({ status: 200, description: 'Đồ thị DAG phả hệ dữ liệu' })
  async getLineageGraph(@Param('dataset_id') datasetId: string): Promise<LineageGraphResponseDto> {
    return this.lineageService.getLineageGraph(datasetId);
  }

  @Get('node/:id/upstream')
  @CheckPolicies((ability) => ability.can(Action.Read, 'Lineage'))
  @ApiOperation({
    summary: 'Truy vết ngược về nguồn gốc (Root Cause Analysis - F8.2)',
    description: 'Truy vết ngược chuỗi biến đổi từ node phiên bản hiện tại về phiên bản gốc ban đầu',
  })
  @ApiParam({ name: 'id', description: 'ID của node phiên bản' })
  @ApiResponse({ status: 200, description: 'Danh sách các phiên bản và luật upstream' })
  async getUpstream(@Param('id') nodeId: string): Promise<UpstreamResponseDto> {
    return this.lineageService.getUpstream(nodeId);
  }

  @Get('node/:id/downstream')
  @CheckPolicies((ability) => ability.can(Action.Read, 'Lineage'))
  @ApiOperation({
    summary: 'Phân tích tác động lan truyền (Downstream Impact Analysis - F8.3)',
    description: 'Xác định các phiên bản và tài nguyên chịu ảnh hưởng nếu phiên bản này bị thay đổi',
  })
  @ApiParam({ name: 'id', description: 'ID của node phiên bản' })
  @ApiResponse({ status: 200, description: 'Danh sách các phiên bản hạ nguồn downstream' })
  async getDownstream(@Param('id') nodeId: string): Promise<DownstreamResponseDto> {
    return this.lineageService.getDownstream(nodeId);
  }

  @Get('verify-integrity/:dataset_id')
  @CheckPolicies((ability) => ability.can(Action.Read, 'Lineage'))
  @ApiOperation({
    summary: 'Xác minh chuỗi băm Merkle chống giả mạo (F8.4 - GET)',
    description: 'Đối soát toàn bộ chuỗi hash SHA-256 trên Neo4j AuraDB và phát hiện vị trí đứt gãy nếu bị can thiệp',
  })
  @ApiParam({ name: 'dataset_id', description: 'ID của Dataset' })
  @ApiResponse({ status: 200, description: 'Kết quả kiểm toán tính toàn vẹn của chuỗi Merkle' })
  async verifyIntegrityGet(@Param('dataset_id') datasetId: string): Promise<VerifyIntegrityResponseDto> {
    return this.lineageService.verifyIntegrity(datasetId);
  }

  @Post('verify-integrity/:dataset_id')
  @CheckPolicies((ability) => ability.can(Action.Read, 'Lineage'))
  @ApiOperation({
    summary: 'Kích hoạt xác minh chuỗi băm Merkle chống giả mạo (F8.4 - POST)',
    description: 'Kích hoạt quy trình kiểm toán toàn vẹn dữ liệu chuỗi băm Merkle',
  })
  @ApiParam({ name: 'dataset_id', description: 'ID của Dataset' })
  @ApiResponse({ status: 200, description: 'Kết quả kiểm toán tính toàn vẹn của chuỗi Merkle' })
  async verifyIntegrityPost(@Param('dataset_id') datasetId: string): Promise<VerifyIntegrityResponseDto> {
    return this.lineageService.verifyIntegrity(datasetId);
  }
}
