import { MAX_COLUMNS, isCsvFile, storageKeyForDataset } from '../value-objects/dataset-limits.vo';
import { stableColumnKey } from '../value-objects/column-type.vo';

export { isCsvFile, storageKeyForDataset };

export interface DatasetColumnProps {
  key: string;
  index: number;
  name: string;
}

export interface DatasetProps {
  id: string;
  projectId: string;
  name: string;
  fileName: string;
  columns: DatasetColumnProps[];
}

export class Dataset {
  private constructor(private readonly props: DatasetProps) {}

  static create(props: DatasetProps): Dataset {
    return new Dataset({ ...props, columns: [...props.columns] });
  }

  static columnKeys(count: number): string[] {
    return Array.from({ length: count }, (_, i) => stableColumnKey(i));
  }

  assertIngestible(): void {
    if (!isCsvFile(this.props.fileName)) {
      throw new Error(`Chi ho tro file .csv (nhan duoc: ${this.props.fileName})`);
    }
    if (this.props.columns.length > MAX_COLUMNS) {
      throw new Error(`So cot vuot qua gioi han ${MAX_COLUMNS}`);
    }
  }
}
