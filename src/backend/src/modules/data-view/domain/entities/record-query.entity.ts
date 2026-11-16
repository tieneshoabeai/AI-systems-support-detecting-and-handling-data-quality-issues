import { normalizeRecordLimit } from '../value-objects/record-query.vo';
import { propsPath } from '../value-objects/record-filter.vo';

export interface RecordQueryProps {
  datasetId: string;
  limit: number;
}

export class RecordQuery {
  private constructor(private readonly props: RecordQueryProps) {}

  static create(props: RecordQueryProps): RecordQuery {
    return new RecordQuery({ ...props, limit: normalizeRecordLimit(props.limit) });
  }

  get limit(): number {
    return this.props.limit;
  }

  static fieldPath(columnKey: string): string {
    return propsPath(columnKey);
  }
}
