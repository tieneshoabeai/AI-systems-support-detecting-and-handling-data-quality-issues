import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { IDatasetRecord } from '../datasets/schemas/dataset-record.schema';
import { DatasetsService } from '../datasets/datasets.service';
import { QueryRecordsDto } from './dto/query-records.dto';
import { UpdateCellDto } from './dto/update-cell.dto';
import { CursorCodec } from '../../shared/pagination/cursor-codec';
import {
  createCursorPaginatedResponse,
  CursorPaginatedResponse,
} from '../../shared/pagination/cursor-paginated.response';

export interface ColumnStatsResult {
  column_name: string;
  total_records: number;
  null_count: number;
  missing_ratio: number;
  min?: number;
  max?: number;
  average?: number;
  histogram: { bucket_start: number; bucket_end: number; count: number }[];
}

@Injectable()
export class DataViewService {
  private readonly logger = new Logger(DataViewService.name);

  constructor(
    @InjectModel('DatasetRecord')
    private readonly recordModel: Model<IDatasetRecord>,
    private readonly datasetsService: DatasetsService
  ) {}

  /**
   * F5.1: Phân trang Keyset/Cursor Pagination cho Virtual Grid
   */
  async getRecords(
    datasetId: string,
    query: QueryRecordsDto
  ): Promise<CursorPaginatedResponse<IDatasetRecord>> {
    if (!Types.ObjectId.isValid(datasetId)) {
      throw new BadRequestException('ID Tập dữ liệu không hợp lệ');
    }

    await this.datasetsService.getDatasetById(datasetId);

    const decoded = query.cursor
      ? CursorCodec.decode<{ row_index: number }>(query.cursor)
      : null;
    const lastRowIndex = decoded?.row_index;

    const filter: Record<string, unknown> = {
      dataset_id: new Types.ObjectId(datasetId),
      deleted_at: null,
    };

    if (lastRowIndex !== undefined) {
      filter.row_index = { $gt: lastRowIndex };
    }

    const limit = query.limit || 50;

    const records = await this.recordModel
      .find(filter)
      .sort({ row_index: 1 })
      .limit(limit + 1)
      .lean()
      .exec();

    const totalCount = await this.recordModel.countDocuments({
      dataset_id: new Types.ObjectId(datasetId),
      deleted_at: null,
    });

    return createCursorPaginatedResponse(
      records as unknown as IDatasetRecord[],
      limit,
      (item) => ({ row_index: item.row_index }),
      totalCount
    );
  }

  /**
   * F5.2: In-place Cell Edit cập nhật trực tiếp giá trị của 1 ô trong Virtual Grid
   */
  async updateCell(
    datasetId: string,
    rowIndex: number,
    dto: UpdateCellDto
  ): Promise<IDatasetRecord> {
    if (!Types.ObjectId.isValid(datasetId)) {
      throw new BadRequestException('ID Tập dữ liệu không hợp lệ');
    }

    const updated = await this.recordModel
      .findOneAndUpdate(
        {
          dataset_id: new Types.ObjectId(datasetId),
          row_index: rowIndex,
          deleted_at: null,
        },
        {
          $set: {
            [`data.${dto.field}`]: dto.value,
          },
        },
        { new: true }
      )
      .exec();

    if (!updated) {
      throw new NotFoundException(
        `Không tìm thấy dòng ${rowIndex} trong tập dữ liệu ${datasetId}`
      );
    }

    return updated;
  }

  /**
   * F5.3: Thống kê cột và biểu đồ phân phối Histogram 10 khoảng
   */
  async getColumnStats(
    datasetId: string,
    columnName: string
  ): Promise<ColumnStatsResult> {
    if (!Types.ObjectId.isValid(datasetId)) {
      throw new BadRequestException('ID Tập dữ liệu không hợp lệ');
    }

    const dataset = await this.datasetsService.getDatasetById(datasetId);
    const targetColumn = dataset.columns.find((c) => c.name === columnName);

    const objectDatasetId = new Types.ObjectId(datasetId);
    const fieldPath = `data.${columnName}`;

    const [stats] = await this.recordModel.aggregate<{
      total: number;
      null_count: number;
      numeric_values: number[];
    }>([
      { $match: { dataset_id: objectDatasetId, deleted_at: null } },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          null_count: {
            $sum: {
              $cond: [
                {
                  $or: [
                    { $eq: [`$${fieldPath}`, null] },
                    { $not: [`$${fieldPath}`] },
                  ],
                },
                1,
                0,
              ],
            },
          },
          numeric_values: {
            $push: {
              $cond: [
                { $isNumber: `$${fieldPath}` },
                `$${fieldPath}`,
                '$$REMOVE',
              ],
            },
          },
        },
      },
    ]);

    const totalRecords = stats?.total ?? 0;
    const nullCount = stats?.null_count ?? 0;
    const missingRatio = totalRecords > 0 ? nullCount / totalRecords : 0;
    const numericValues = stats?.numeric_values ?? [];

    if (numericValues.length === 0 || targetColumn?.data_type !== 'number') {
      return {
        column_name: columnName,
        total_records: totalRecords,
        null_count: nullCount,
        missing_ratio: missingRatio,
        histogram: [],
      };
    }

    const min = Math.min(...numericValues);
    const max = Math.max(...numericValues);
    const sum = numericValues.reduce((acc, val) => acc + val, 0);
    const average = sum / numericValues.length;

    // Phân chia 10 histogram buckets
    const bucketCount = 10;
    const range = max - min;
    const step = range > 0 ? range / bucketCount : 1;

    const buckets: { bucket_start: number; bucket_end: number; count: number }[] = [];
    for (let i = 0; i < bucketCount; i++) {
      const bStart = min + i * step;
      const bEnd = i === bucketCount - 1 ? max : min + (i + 1) * step;
      buckets.push({
        bucket_start: Number(bStart.toFixed(2)),
        bucket_end: Number(bEnd.toFixed(2)),
        count: 0,
      });
    }

    for (const val of numericValues) {
      const index = Math.min(
        Math.floor((val - min) / step),
        bucketCount - 1
      );
      if (index >= 0 && index < bucketCount) {
        buckets[index].count++;
      }
    }

    return {
      column_name: columnName,
      total_records: totalRecords,
      null_count: nullCount,
      missing_ratio: missingRatio,
      min,
      max,
      average: Number(average.toFixed(2)),
      histogram: buckets,
    };
  }
}
