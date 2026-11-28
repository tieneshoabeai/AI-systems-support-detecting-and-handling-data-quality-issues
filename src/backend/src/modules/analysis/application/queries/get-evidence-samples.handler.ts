import { Inject, Injectable } from '@nestjs/common';
import {
  ANALYSIS_REPOSITORY_PORT,
  type AnalysisRepositoryPort,
  type CellEvidenceSampleKind,
} from '../../domain/ports/analysis.repository.port';
import { truncateChars } from '../../domain/pii-mask.util';
import { isObjectIdHex } from '../../../../shared/domain/utils/object-id.util';
import { ValidationError } from '../../../../shared/domain/errors';

export interface ListEvidenceSamplesQuery {
  findingId?: string;
  kind?: CellEvidenceSampleKind;
  column?: string;
  limit: number;
  cursor?: string;
}

export interface EvidenceSampleItem {
  findingId: string;
  kind: CellEvidenceSampleKind;
  column: string;
  /** Zero-based index into data records; the header row is not included. */
  rowIndex: number;
  reason: string | null;
  /** PII-masked or shape-only value; the raw sample string is never exposed. */
  valueMasked: string | null;
}

export interface EvidenceSamplesPage {
  items: EvidenceSampleItem[];
  meta: { limit: number; hasMore: boolean; nextCursor: string | null };
}

const findingKinds: Record<string, CellEvidenceSampleKind> = {
  '01': 'missing',
  '02': 'duplicate',
  '03': 'invalid_type',
  '04': 'outlier',
};

function parseFindingId(findingId: string): { kind: CellEvidenceSampleKind; column: string } {
  const match = /^DQ-(01|02|03|04)(?::(.+))?$/i.exec(findingId);
  if (!match) throw new ValidationError('Finding không có evidence samples được hỗ trợ');
  const code = match[1] as string;
  const kind = findingKinds[code];
  const requestedColumn = match[2];
  if (!kind) throw new ValidationError('Finding không có evidence samples được hỗ trợ');
  if (code === '02') {
    if (requestedColumn && requestedColumn !== '__row__') {
      throw new ValidationError('Finding dòng trùng không khớp cột evidence');
    }
    return { kind, column: '__row__' };
  }
  if (!requestedColumn) throw new ValidationError('Finding cần kèm mã cột để lọc evidence');
  return { kind, column: requestedColumn };
}

function toFindingId(kind: CellEvidenceSampleKind, column: string): string {
  switch (kind) {
    case 'missing': return `DQ-01:${column}`;
    case 'duplicate': return 'DQ-02';
    case 'invalid_type': return `DQ-03:${column}`;
    case 'outlier': return `DQ-04:${column}`;
  }
}

function safeValueForResponse(value: string | null | undefined): string | null {
  if (value == null) return null;
  if (value === '' || value === '***') return value;
  // Older evidence rows may contain a non-PII value in `value_masked` because that
  // field was also used for AI-safe numeric samples. Shape it again at the API
  // boundary so neither legacy nor newly stored values can expose raw text.
  const shape = Array.from(value, (character) => {
    if (/\p{Lu}/u.test(character)) return 'A';
    if (/\p{L}/u.test(character)) return 'a';
    if (/\p{N}/u.test(character)) return 'd';
    if (/\s/u.test(character)) return ' ';
    return '*';
  }).join('');
  return `Mẫu: ${truncateChars(shape)}`;
}

@Injectable()
export class GetEvidenceSamplesHandler {
  constructor(
    @Inject(ANALYSIS_REPOSITORY_PORT)
    private readonly analysisRepository: AnalysisRepositoryPort,
  ) {}

  async execute(analysisRunId: string, query: ListEvidenceSamplesQuery): Promise<EvidenceSamplesPage> {
    if (!isObjectIdHex(analysisRunId)) throw new ValidationError('ID lần phân tích không hợp lệ');

    let kind = query.kind;
    let column = query.column;
    if (query.findingId) {
      const filter = parseFindingId(query.findingId);
      if ((kind && kind !== filter.kind) || (column && column !== filter.column)) {
        throw new ValidationError('findingId không khớp bộ lọc kind/column');
      }
      kind = filter.kind;
      column = filter.column;
    }

    const rows = await this.analysisRepository.findEvidenceSamples({
      runId: analysisRunId,
      ...(kind ? { kind } : {}),
      ...(column ? { column } : {}),
      ...(query.cursor ? { afterId: query.cursor } : {}),
      limit: query.limit + 1,
    });
    const hasMore = rows.length > query.limit;
    const pageRows = hasMore ? rows.slice(0, query.limit) : rows;
    const last = pageRows.at(-1);

    return {
      items: pageRows.map((row) => ({
        findingId: toFindingId(row.kind, row.column),
        kind: row.kind,
        column: row.column,
        rowIndex: row.rowIndex,
        reason: row.reason ?? null,
        valueMasked: safeValueForResponse(row.valueMasked),
      })),
      meta: {
        limit: query.limit,
        hasMore,
        nextCursor: hasMore ? last?.id ?? null : null,
      },
    };
  }
}
