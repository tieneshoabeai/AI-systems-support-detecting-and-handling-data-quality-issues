/**
 * MIGRATION - ep kieu du lieu `datasetrecords` theo schema, don project mo coi,
 * va don file R2 + dung luong workspace.
 *
 * Vi sao can:
 *  1. **Schema vs du lieu**: schema suy luan `dataType` tu CSV nhung du lieu nap
 *     vao luu **chuoi tho** -> cot `number` luu `"4"`. Loc/sap xep/thong ke
 *     sai (MongoDB so sanh theo BSON type).
 *  2. **Project mo coi**: truoc khi co cascade, xoa workspace khong xoa project
 *     -> project van `deleted_at: null` va van hien trong `GET /projects`.
 *  3. **Ro ri dung luong R2**: dataset da xoa nhung file CSV van con tren R2
 *     -> quota workspace cong don dung luong da dung.
 *
 * Cach dung:
 *   pnpm run db:migrate:coerce            # chay ca 3 phan
 *   pnpm run db:migrate:coerce -- --dry-run
 *   pnpm run db:migrate:coerce -- --only=coerce    # chi ep kieu
 *   pnpm run db:migrate:coerce -- --only=orphan    # chi don project mo coi
 *   pnpm run db:migrate:coerce -- --only=storage   # chi don file R2 + storage
 *
 * `--dry-run` chi bao cao, KHONG ghi gi.
 *
 * Luu y: Phan 3 se xoa file CSV tren R2 cua dataset da bi xoa (ke ca dataset
 * da soft-delete truoc do) va dong bo lai `storage_used_bytes` cua workspace.
 */
import './lib/load-env';
import mongoose from 'mongoose';
import { coerceValue } from '../src/modules/datasets/domain/value-objects/value-coercion.vo';
import type { ColumnDataType } from '../src/modules/datasets/domain/value-objects/column-type.vo';
import { storageKeyForDataset } from '../src/modules/datasets/domain/value-objects/dataset-limits.vo';
import { createCliStorage } from './lib/cli-storage';

/** `mongoose.Connection['db']` la `mongo.Db | undefined` -> NonNullable de loai undefined. */
type MongoDb = NonNullable<mongoose.Connection['db']>;

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const onlyArg = args.find((a) => a.startsWith('--only='));
const only = onlyArg ? onlyArg.slice('--only='.length) : 'all';

interface ColumnDoc {
  key: string;
  data_type?: ColumnDataType;
  dataType?: ColumnDataType;
}

interface DatasetDoc {
  _id: mongoose.Types.ObjectId;
  name: string;
  deleted_at: Date | null;
  columns?: ColumnDoc[];
}

interface RecordDoc {
  _id: mongoose.Types.ObjectId;
  dataset_id: mongoose.Types.ObjectId;
  row_index: number;
  props: Record<string, unknown>;
}

function resolveDataType(col: ColumnDoc): ColumnDataType {
  return (col.data_type ?? col.dataType ?? 'string') as ColumnDataType;
}

async function migrateCoercion(db: MongoDb): Promise<void> {
  const datasets = (await db
    .collection('datasets')
    .find({ deleted_at: null })
    .toArray()) as unknown as DatasetDoc[];
  console.log(`\n=== PHAN 1: ep kieu datasetrecords (${datasets.length} dataset dang hoat dong) ===`);

  let totalScanned = 0;
  let totalChanged = 0;
  let datasetsChanged = 0;

  for (const ds of datasets) {
    const columns = ds.columns ?? [];
    if (columns.length === 0) continue;

    // Ban do key cot -> kieu du lieu (chi cot khong phai `string` moi can ep).
    const typeByKey = new Map<string, ColumnDataType>();
    for (const c of columns) {
      const t = resolveDataType(c);
      if (t !== 'string') typeByKey.set(c.key, t);
    }
    if (typeByKey.size === 0) continue;

    const records = (await db
      .collection('datasetrecords')
      .find({ dataset_id: ds._id })
      .toArray()) as unknown as RecordDoc[];

    const bulkOps: Array<Record<string, unknown>> = [];

    for (const rec of records) {
      totalScanned++;
      let changed = false;
      const newProps: Record<string, unknown> = { ...rec.props };
      for (const [key, type] of typeByKey) {
        const before = rec.props[key];
        if (before === undefined || before === null) continue;
        // Da dung kieu -> bo qua.
        if (type === 'number' && typeof before === 'number') continue;
        if (type === 'boolean' && typeof before === 'boolean') continue;
        if (type === 'date' && before instanceof Date) continue;
        const after = coerceValue(before, type);
        if (after !== before) {
          newProps[key] = after;
          changed = true;
        }
      }
      if (changed) {
        totalChanged++;
        bulkOps.push({
          updateOne: {
            filter: { _id: rec._id },
            update: { $set: { props: newProps } },
          },
        });
      }
    }

    if (bulkOps.length > 0) {
      datasetsChanged++;
      console.log(
        `  [${ds.name}] ${records.length} dong -> ${bulkOps.length} dong can ep kieu`,
      );
      if (!dryRun) {
        await db.collection('datasetrecords').bulkWrite(bulkOps as never[], { ordered: false });
      }
    }
  }

  console.log(
    `\n  Tong: quet ${totalScanned} dong, doi ${totalChanged} dong tren ${datasetsChanged} dataset` +
      `${dryRun ? ' (DRY RUN - chua ghi gi)' : ''}`,
  );
}

async function migrateOrphans(db: MongoDb): Promise<void> {
  console.log('\n=== PHAN 2: don project mo coi (workspace da xoa) ===');

  const deletedWs = (await db
    .collection('workspaces')
    .find({ deleted_at: { $ne: null } })
    .project<{ _id: mongoose.Types.ObjectId }>({ _id: 1 })
    .toArray()) as unknown as Array<{ _id: mongoose.Types.ObjectId }>;

  if (deletedWs.length === 0) {
    console.log('  Khong co workspace nao da bi xoa -> khong co project mo coi.');
    return;
  }
  const deletedWsIds = deletedWs.map((w) => w._id);

  const orphans = (await db
    .collection('projects')
    .find({ workspace_id: { $in: deletedWsIds }, deleted_at: null })
    .toArray()) as unknown as Array<{
    _id: mongoose.Types.ObjectId;
    name: string;
    workspace_id: mongoose.Types.ObjectId;
  }>;

  console.log(
    `  Tim thay ${orphans.length} project mo coi (thuoc ${deletedWs.length} workspace da xoa)`,
  );
  for (const p of orphans) {
    console.log(`    - "${p.name}" (${String(p._id)})`);
  }

  if (orphans.length === 0) return;

  const orphanIds = orphans.map((p) => p._id);

  // Dataset thuoc project mo coi -> soft-delete + xoa ban ghi.
  const datasets = (await db
    .collection('datasets')
    .find({ project_id: { $in: orphanIds }, deleted_at: null })
    .toArray()) as unknown as Array<{
    _id: mongoose.Types.ObjectId;
    name: string;
    file_size_bytes?: number;
  }>;

  console.log(`  -> ${datasets.length} dataset thuoc project mo coi se bi soft-delete`);
  for (const d of datasets) {
    console.log(`    - "${d.name}" (${String(d._id)})`);
  }

  if (dryRun) {
    console.log('\n  DRY RUN - chua ghi gi.');
    return;
  }

  if (datasets.length > 0) {
    const dsIds = datasets.map((d) => d._id);
    await db
      .collection('datasets')
      .updateMany({ _id: { $in: dsIds }, deleted_at: null }, { $set: { deleted_at: new Date() } });
    const recRes = await db.collection('datasetrecords').deleteMany({ dataset_id: { $in: dsIds } });
    console.log(`  -> da xoa ${recRes.deletedCount} datasetrecords`);
  }

  const prjRes = await db
    .collection('projects')
    .updateMany({ _id: { $in: orphanIds }, deleted_at: null }, { $set: { deleted_at: new Date() } });
  console.log(`  -> da soft-delete ${prjRes.modifiedCount} project`);

  // Don `has_dataset` cua project da xoa (khong con dataset song).
  await db
    .collection('projects')
    .updateMany({ _id: { $in: orphanIds } }, { $set: { has_dataset: false } });
}

/**
 * PHAN 3 — don file CSV tren R2 cho dataset da bi xoa + dong bo `storage_used_bytes`.
 *
 * Vì sao cần:
 * Cascade (`CascadeProjectDatasetsHandler`) xoa file R2 khi xoa dataset qua API.
 * Nhung du lieu cu (project/workspace bi xoa truoc khi co cascade) thi file CSV
 * van con tren R2 -> **ro ri dung luong** (R2 + quota workspace).
 *
 * Idempotent: chi xoa file khi `fileExists()` tra ve true; chay lai nhieu lan
 * cung an toàn.
 */
async function cleanupStorage(db: MongoDb): Promise<void> {
  const storage = createCliStorage();
  console.log(
    `\n=== PHAN 3: don file R2 cho dataset da xoa (storage mode: ${storage.mode}) ===`,
  );

  const deletedDatasets = (await db
    .collection('datasets')
    .find({ deleted_at: { $ne: null } })
    .toArray()) as unknown as Array<{
    _id: mongoose.Types.ObjectId;
    name: string;
    storage_key?: string;
    file_size_bytes?: number;
    workspace_id?: mongoose.Types.ObjectId;
  }>;

  if (deletedDatasets.length === 0) {
    console.log('  Khong co dataset da xoa -> khong can don file.');
    return;
  }

  let deletedFiles = 0;
  let freedBytes = 0;
  const missing: string[] = [];

  for (const d of deletedDatasets) {
    // Uu tien `storage_key` trong DB; fallback ve key chuan theo quy uoc.
    const key = d.storage_key || storageKeyForDataset(String(d._id));
    try {
      const exists = await storage.fileExists(key);
      if (!exists) {
        missing.push(key);
        continue;
      }
      if (!dryRun) {
        await storage.deleteFile(key);
      }
      deletedFiles++;
      freedBytes += d.file_size_bytes ?? 0;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`  [!] Khong xoa duoc file ${key}: ${msg}`);
    }
  }

  console.log(
    `  -> ${deletedFiles} file da bi xoa${dryRun ? ' (DRY RUN)' : ''}` +
      ` (giai phong ${freedBytes} bytes)`,
  );
  if (missing.length > 0) {
    console.log(`  -> ${missing.length} file da khong ton tai (bo qua)`);
  }

  // ── Dong bo `storage_used_bytes` cua workspace ────────────────────────────
  // Tinh lai tu dataset con song thay vi tru so am -> tu chua, idempotent.
  console.log('\n  -- Dong bo storage_used_bytes cua workspace --');
  const workspaces = (await db
    .collection('workspaces')
    .find({})
    .project<{ _id: mongoose.Types.ObjectId; storage_used_bytes?: number }>({
      _id: 1,
      storage_used_bytes: 1,
    })
    .toArray()) as unknown as Array<{
    _id: mongoose.Types.ObjectId;
    storage_used_bytes?: number;
  }>;

  let adjusted = 0;
  for (const ws of workspaces) {
    const agg = await db
      .collection('datasets')
      .aggregate<{ total: number }>([
        { $match: { workspace_id: ws._id, deleted_at: null } },
        { $group: { _id: null, total: { $sum: '$file_size_bytes' } } },
      ])
      .toArray();
    const actual = agg[0]?.total ?? 0;
    const current = ws.storage_used_bytes ?? 0;
    if (current === actual) continue;

    console.log(
      `    ${String(ws._id)}: ${current} -> ${actual} bytes (chinh lech ${actual - current})`,
    );
    adjusted++;
    if (!dryRun) {
      await db
        .collection('workspaces')
        .updateOne({ _id: ws._id }, { $set: { storage_used_bytes: actual } });
    }
  }
  console.log(
    `  -> ${adjusted} workspace duoc chinh lai dung luong${dryRun ? ' (DRY RUN)' : ''}`,
  );
}

async function main(): Promise<void> {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('MONGODB_URI chua duoc cau hinh trong .env');
  }
  console.log(dryRun ? '⚠ DRY RUN — khong ghi gi vao DB' : '⚡ Dang ghi vao DB');
  await mongoose.connect(uri);
  const db = mongoose.connection.db;
  if (!db) throw new Error('Khong ket noi duoc MongoDB');

  try {
    if (only === 'all' || only === 'coerce') await migrateCoercion(db);
    if (only === 'all' || only === 'orphan') await migrateOrphans(db);
    if (only === 'all' || only === 'storage') await cleanupStorage(db);
    console.log('\n✅ Hoan tat.');
  } finally {
    await mongoose.disconnect();
  }
}

void main().catch((err: unknown) => {
  console.error('❌ Loi:', err instanceof Error ? err.message : String(err));
  process.exit(1);
});
