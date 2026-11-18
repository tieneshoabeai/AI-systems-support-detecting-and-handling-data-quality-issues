/**
 * Unit test thuần cho aggregate `Dataset` (Bước 3 — Rich Domain Model).
 *
 * Không dùng NestJS/Mongoose — chỉ kiểm tra hành vi + invariant của entity.
 */
import {
  Dataset,
  type DatasetColumn,
} from '../src/modules/datasets/domain/entities/dataset.entity';
import {
  ConflictError,
  ValidationError,
} from '../src/shared/domain/errors';

const PROJECT = 'prj-1';
const WS = 'ws-1';

function buildColumn(overrides: Partial<DatasetColumn> = {}): DatasetColumn {
  return {
    key: 'c0',
    index: 0,
    name: 'Ten',
    dataType: 'string',
    originalName: 'Ten',
    missingCount: 0,
    isPii: false,
    ...overrides,
  };
}

function buildDataset(overrides: Partial<Parameters<typeof Dataset.reconstitute>[0]> = {}): Dataset {
  return Dataset.reconstitute({
    id: 'ds-1',
    projectId: PROJECT,
    workspaceId: WS,
    name: 'f',
    originalFileName: 'f.csv',
    fileFormat: 'csv',
    fileSizeBytes: 10,
    fileChecksum: 'sha256:abc',
    storageKey: 'raw_files/ds-1.csv',
    rowCount: 2,
    columnCount: 2,
    columns: [
      buildColumn(),
      buildColumn({ key: 'c1', index: 1, name: 'Tuoi', originalName: 'Tuoi', dataType: 'number' }),
    ],
    columnIssues: [],
    hasHeader: true,
    delimiter: ',',
    currentVersion: 1,
    status: 'READY',
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    deletedAt: null,
    version: 1,
    ...overrides,
  });
}

describe('Dataset entity — factory & truy vấn', () => {
  it('create() tạo dataset ở trạng thái INGESTING, chưa có cột', () => {
    const dataset = Dataset.create({
      id: 'ds-new',
      projectId: PROJECT,
      workspaceId: WS,
      name: 'data',
      originalFileName: 'data.csv',
      fileSizeBytes: 100,
      storageKey: 'raw_files/ds-new.csv',
    });

    expect(dataset.id).toBe('ds-new');
    expect(dataset.projectId).toBe(PROJECT);
    expect(dataset.workspaceId).toBe(WS);
    expect(dataset.status).toBe('INGESTING');
    expect(dataset.rowCount).toBe(0);
    expect(dataset.columnCount).toBe(0);
    expect(dataset.columns).toHaveLength(0);
    expect(dataset.fileFormat).toBe('csv');
    expect(dataset.currentVersion).toBe(1);
  });

  it('create() không phát domain event', () => {
    const dataset = Dataset.create({
      id: 'ds-new',
      projectId: PROJECT,
      workspaceId: WS,
      name: 'data',
      originalFileName: 'data.csv',
      fileSizeBytes: 100,
      storageKey: 'raw_files/ds-new.csv',
    });
    expect(dataset.domainEvents).toHaveLength(0);
  });

  it('reconstitute() không phát domain event', () => {
    expect(buildDataset().domainEvents).toHaveLength(0);
  });

  it('columnByKey / columnByName trả về đúng cột', () => {
    const dataset = buildDataset();
    expect(dataset.columnByKey('c1')?.name).toBe('Tuoi');
    expect(dataset.columnByName('Ten')?.key).toBe('c0');
    expect(dataset.columnByKey('c99')).toBeUndefined();
  });

  it('hasColumnIssues() / isAnalyzable() phản ánh trạng thái', () => {
    expect(buildDataset().hasColumnIssues()).toBe(false);
    expect(buildDataset().isAnalyzable()).toBe(true);

    const withIssues = buildDataset({
      columnIssues: [{ columnKey: 'c0', issue: 'empty_name', message: 'rong' }],
    });
    expect(withIssues.hasColumnIssues()).toBe(true);
    expect(withIssues.isAnalyzable()).toBe(false);

    const ingesting = buildDataset({ status: 'INGESTING' });
    expect(ingesting.isAnalyzable()).toBe(false);
  });
});

describe('Dataset entity — assertIngestible()', () => {
  it('file .csv hợp lệ → không ném', () => {
    const dataset = buildDataset();
    expect(() => dataset.assertIngestible('data.csv', 100, 10)).not.toThrow();
  });

  it('file không phải .csv → ValidationError', () => {
    const dataset = buildDataset();
    expect(() => dataset.assertIngestible('data.xlsx', 100, 10)).toThrow(ValidationError);
  });

  it('file vượt 50 MB → ValidationError', () => {
    const dataset = buildDataset();
    expect(() =>
      dataset.assertIngestible('data.csv', 51 * 1024 * 1024, 10),
    ).toThrow(ValidationError);
  });

  it('vượt 1000 cột → ValidationError', () => {
    const dataset = buildDataset();
    expect(() => dataset.assertIngestible('data.csv', 100, 1001)).toThrow(ValidationError);
  });

  it('không có header → ValidationError', () => {
    const dataset = buildDataset();
    expect(() => dataset.assertIngestible('data.csv', 100, 0)).toThrow(ValidationError);
  });
});

describe('Dataset entity — rename()', () => {
  it('đổi tên dataset', () => {
    const dataset = buildDataset();
    dataset.rename('Tên mới');
    expect(dataset.name).toBe('Tên mới');
  });

  it('tên rỗng → ValidationError', () => {
    const dataset = buildDataset();
    expect(() => dataset.rename('   ')).toThrow(ValidationError);
  });

  it('tên quá 100 ký tự → ValidationError', () => {
    const dataset = buildDataset();
    expect(() => dataset.rename('x'.repeat(101))).toThrow(ValidationError);
  });

  it('rename(undefined) không đổi gì', () => {
    const dataset = buildDataset();
    dataset.rename(undefined);
    expect(dataset.name).toBe('f');
  });
});

describe('Dataset entity — renameColumns()', () => {
  it('đổi tên hiển thị, giữ nguyên key', () => {
    const dataset = buildDataset();
    dataset.renameColumns([{ key: 'c0', name: 'Ho Ten' }]);

    expect(dataset.columnByKey('c0')?.name).toBe('Ho Ten');
    expect(dataset.columnByKey('c0')?.key).toBe('c0');
    expect(dataset.columnByKey('c0')?.originalName).toBe('Ten');
  });

  it('key không tồn tại → ValidationError', () => {
    const dataset = buildDataset();
    expect(() => dataset.renameColumns([{ key: 'c99', name: 'X' }])).toThrow(ValidationError);
  });

  it('tên rỗng → ValidationError', () => {
    const dataset = buildDataset();
    expect(() => dataset.renameColumns([{ key: 'c0', name: '  ' }])).toThrow(ValidationError);
  });

  it('tên trùng với cột khác → ConflictError', () => {
    const dataset = buildDataset();
    expect(() => dataset.renameColumns([{ key: 'c0', name: 'Tuoi' }])).toThrow(ConflictError);
  });

  it('phát domain event dataset.renamed', () => {
    const dataset = buildDataset();
    dataset.renameColumns([{ key: 'c0', name: 'Ho Ten' }]);

    const events = dataset.dispatchDomainEvents();
    expect(events[0]?.eventType).toBe('dataset.renamed');
    expect(dataset.dispatchDomainEvents()).toHaveLength(0);
  });
});

describe('Dataset entity — resetColumnNames()', () => {
  it('khôi phục tên gốc và xoá lỗi tên cột', () => {
    const dataset = buildDataset({
      columnIssues: [{ columnKey: 'c0', issue: 'empty_name', message: 'rong' }],
    });
    dataset.renameColumns([{ key: 'c0', name: 'Ho Ten' }]);
    dataset.resetColumnNames();

    expect(dataset.columnByKey('c0')?.name).toBe('Ten');
    expect(dataset.columnIssues).toHaveLength(0);
  });
});

describe('Dataset entity — markReady()', () => {
  it('chuyển INGESTING → READY, ghi schema + checksum', () => {
    const dataset = Dataset.create({
      id: 'ds-new',
      projectId: PROJECT,
      workspaceId: WS,
      name: 'data',
      originalFileName: 'data.csv',
      fileSizeBytes: 0,
      storageKey: 'raw_files/ds-new.csv',
    });

    dataset.markReady({
      fileChecksum: 'sha256:xyz',
      fileSizeBytes: 1234,
      rowCount: 50,
      columns: [buildColumn()],
      columnIssues: [],
    });

    expect(dataset.status).toBe('READY');
    expect(dataset.fileChecksum).toBe('sha256:xyz');
    expect(dataset.fileSizeBytes).toBe(1234);
    expect(dataset.rowCount).toBe(50);
    expect(dataset.columnCount).toBe(1);
  });

  it('phát domain event dataset.ingested', () => {
    const dataset = Dataset.create({
      id: 'ds-new',
      projectId: PROJECT,
      workspaceId: WS,
      name: 'data',
      originalFileName: 'data.csv',
      fileSizeBytes: 0,
      storageKey: 'raw_files/ds-new.csv',
    });
    dataset.markReady({
      fileChecksum: 'sha256:xyz',
      fileSizeBytes: 1,
      rowCount: 1,
      columns: [buildColumn()],
      columnIssues: [],
    });

    const events = dataset.dispatchDomainEvents();
    expect(events[0]?.eventType).toBe('dataset.ingested');
  });

  it('dataset không ở INGESTING → ConflictError', () => {
    const dataset = buildDataset({ status: 'READY' });
    expect(() =>
      dataset.markReady({
        fileChecksum: 'sha256:xyz',
        fileSizeBytes: 1,
        rowCount: 1,
        columns: [buildColumn()],
        columnIssues: [],
      }),
    ).toThrow(ConflictError);
  });

  it('key cột không ổn định → ValidationError', () => {
    const dataset = Dataset.create({
      id: 'ds-new',
      projectId: PROJECT,
      workspaceId: WS,
      name: 'data',
      originalFileName: 'data.csv',
      fileSizeBytes: 0,
      storageKey: 'raw_files/ds-new.csv',
    });
    expect(() =>
      dataset.markReady({
        fileChecksum: 'sha256:xyz',
        fileSizeBytes: 1,
        rowCount: 1,
        columns: [buildColumn({ key: 'x0', index: 0 })],
        columnIssues: [],
      }),
    ).toThrow(ValidationError);
  });

  it('vượt 1000 cột → ValidationError', () => {
    const dataset = Dataset.create({
      id: 'ds-new',
      projectId: PROJECT,
      workspaceId: WS,
      name: 'data',
      originalFileName: 'data.csv',
      fileSizeBytes: 0,
      storageKey: 'raw_files/ds-new.csv',
    });
    const cols = Array.from({ length: 1001 }, (_, i) =>
      buildColumn({ key: `c${i}`, index: i }),
    );
    expect(() =>
      dataset.markReady({
        fileChecksum: 'sha256:xyz',
        fileSizeBytes: 1,
        rowCount: 1,
        columns: cols,
        columnIssues: [],
      }),
    ).toThrow(ValidationError);
  });
});

describe('Dataset entity — markFailed()', () => {
  it('chuyển sang FAILED, phát domain event', () => {
    const dataset = buildDataset({ status: 'INGESTING' });
    dataset.markFailed('upload error');

    expect(dataset.status).toBe('FAILED');
    const events = dataset.dispatchDomainEvents();
    expect(events[0]?.eventType).toBe('dataset.failed');
    expect(events[0]?.payload).toEqual({ reason: 'upload error' });
  });
});

describe('Dataset entity — setColumnIssues()', () => {
  it('ghi lại danh sách lỗi tên cột', () => {
    const dataset = buildDataset();
    dataset.setColumnIssues([{ columnKey: 'c0', issue: 'duplicate_name', message: 'trung' }]);

    expect(dataset.columnIssues).toHaveLength(1);
    expect(dataset.hasColumnIssues()).toBe(true);
  });
});

describe('Dataset entity — toProps()', () => {
  it('toProps() trả về bản chụp props đầy đủ', () => {
    const props = buildDataset().toProps();

    expect(props.id).toBe('ds-1');
    expect(props.projectId).toBe(PROJECT);
    expect(props.storageKey).toBe('raw_files/ds-1.csv');
    expect(props.columns).toHaveLength(2);
    expect(props.version).toBe(1);
  });

  it('toProps() trả bản sao — không chia sẻ mảng với entity', () => {
    const dataset = buildDataset();
    const props = dataset.toProps();
    props.columns[0]!.name = 'Mutated';

    expect(dataset.columnByKey('c0')?.name).toBe('Ten');
  });
});
