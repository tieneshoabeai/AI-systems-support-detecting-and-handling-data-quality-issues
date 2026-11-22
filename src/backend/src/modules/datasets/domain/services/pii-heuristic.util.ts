/**
 * Heuristic suy luan cot PII theo TEN COT (OPEN-04 — chot 2026-11-19).
 *
 * Nguyên tắc bất biến dữ liệu: hệ thống **chỉ nhận dataset và phân tích**.
 * Người dùng KHÔNG được bật/tắt cờ PII thủ công (route `PATCH
 * /datasets/:id/columns/pii` đã bị xoá). Thay vào đó, cờ PII được **tự động
 * suy luận** từ tên cột ngay khi nạp, và cột bị đánh dấu luôn được che trước
 * khi đưa vào prompt AI.
 *
 * Heuristic là **nhẹ, dựa trên từ khoá**, không dùng regex phức tạp — tránh cả
 * false-positive lớn (che mất dữ liệu cần phân tích) lẫn false-negative (lộ PII
 * vào prompt AI).
 */

/**
 * Chuẩn hoá tên cột về dạng so khớp: bỏ dấu tiếng Việt, chuyển `_`, `-`,
 * `.`, khoảng trắng thành dấu gạch dưới, gộp nhiều gạch, trim.
 */
export function normalizeColumnName(name: string): string {
  return name
    .replace(/[đĐ]/g, 'd') // `đ` không tách được bằng NFD → thay thẳng
    .normalize('NFD')
    // Loại bỏ dấu thanh/dấu phụ (U+0300 – U+036F)
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/_{2,}/g, '_')
    .replace(/^_|_$/g, '');
}

/** Từ khoá tiếng Việt / tiếng Anh chỉ dữ liệu định danh cá nhân (dạng thô). */
const RAW_PII_KEYWORDS: readonly string[] = [
  'email',
  'e-mail',
  'mail',
  'phone',
  'mobile',
  'tel',
  'sdt',
  'dien-thoai',
  'hoten',
  'ho-ten',
  'fullname',
  'full-name',
  'name',
  'ten',
  'cmnd',
  'cccd',
  'so-dinh-danh',
  'passport',
  'ho-chieu',
  'tax',
  'mst',
  'ma-so-thue',
  'birthday',
  'ngay-sinh',
  'dob',
  'address',
  'dia-chi',
  'gender',
  'gioi-tinh',
];

/**
 * Từ khoá PII đã chuẩn hoá (dùng gạch dưới) để so khớp với tên cột chuẩn hoá.
 *
 * Mỗi từ khoá nhiều từ (`hoten`) sinh thêm biến thể **bóp** dấu gạch (`hoten`)
 * để khớp được cả `Họ Tên` (`ho_ten`) lẫn `Hoten` (`hoten`).
 */
const PII_KEYWORDS: readonly string[] = Array.from(
  new Set(
    RAW_PII_KEYWORDS.flatMap((k) => {
      const n = normalizeColumnName(k);
      return n.includes('_') ? [n, n.replace(/_/g, '')] : [n];
    }),
  ),
);

/** Từ khoá phủ định — cột chứa từ khoá này KHÔNG phải PII dù có từ khoá PII. */
const RAW_NEGATIVE_KEYWORDS: readonly string[] = [
  'company',
  'cong_ty',
  'ten_cong_ty',
  'product',
  'san_pham',
  'file',
  'ten_file',
  'department',
  'phong_ban',
  'project',
  'du_an',
  'table',
  'bang',
  'city',
  'thanh_pho',
  'district',
  'quan',
  'province',
  'tinh',
  'class',
  'lop',
  'subject',
  'mon_hoc',
  'ten_mon',
  'group',
  'nhom',
  'brand',
  'thuong_hieu',
  'label',
  'nhan',
  'type',
  'loai',
  'status',
  'trang_thai',
  'role',
  'vai_tro',
];

/** Từ khoá phủ định đã chuẩn hoá. */
const NEGATIVE_KEYWORDS: readonly string[] = Array.from(
  new Set(RAW_NEGATIVE_KEYWORDS.map(normalizeColumnName)),
);

/**
 * Từ khoá "rộng" — chỉ tính PII khi đứng **cuối** tên cột.
 *
 * `name` / `ten` / `mail` xuất hiện trong rất nhiều tên cột không chứa PII
 * (`filename`, `ten_cong_ty`, `mail_type`…) nên cần hạn chế.
 */
const BROAD_KEYWORDS: ReadonlySet<string> = new Set(['name', 'ten', 'mail']);

/**
 * Kiểm tra tên cột có chứa từ khoá phủ định hay không (theo **ranh giới từ**).
 *
 * `company_name` → chứa `company` ✔
 * `ten_cong_ty`   → chứa `cong_ty` ✔
 * `nhien_vu_cua_toi` → không ✘
 */
function hasNegativeKeyword(normalized: string): boolean {
  return NEGATIVE_KEYWORDS.some(
    (neg) =>
      normalized === neg ||
      normalized.includes(`_${neg}_`) ||
      normalized.startsWith(`${neg}_`) ||
      normalized.endsWith(`_${neg}`),
  );
}

/**
 * Suy luận cột có phải PII hay không dựa trên tên cột.
 *
 * Quy tắc:
 *   1. Chuẩn hoá tên cột (`Họ Tên` → `ho_ten`).
 *   2. Nếu tên chuẩn hoá **chính xác** bằng một từ khoá PII → PII.
 *      (tránh chuỗi con trong từ không liên quan, ví dụ `filename` ≠ `name`)
 *   3. Nếu tên chuẩn hoá **chứa** một từ khoá PII làm tiền tố hoặc hậu tố
 *      (`user_email`, `email_cua_toi`) → PII.
 *   4. Từ khoá rộng (`name`/`ten`/`mail`) chỉ tính PII khi đứng **cuối** tên
 *      cột (`customer_name`, `ho_ten`) và tên cột **không** chứa từ khoá phủ
 *      định (`company_name`, `ten_cong_ty`, `product_name`, `file_name`).
 *
 * @param columnName Tên hiển thị (hoặc tên gốc) của cột.
 * @returns `true` nếu cột được coi là PII.
 */
export function isPiiColumnName(columnName: string): boolean {
  const normalized = normalizeColumnName(columnName);
  if (normalized.length === 0) return false;

  const negative = hasNegativeKeyword(normalized);

  // Trường hợp 1: khớp chính xác toàn bộ tên chuẩn hoá.
  if (PII_KEYWORDS.includes(normalized)) {
    if (BROAD_KEYWORDS.has(normalized) && negative) return false;
    return true;
  }

  // Trường hợp 2: khớp tiền tố/hậu tố — tên cột = <keyword>_<...> hoặc <...>_<keyword>
  for (const keyword of PII_KEYWORDS) {
    if (keyword === normalized) continue;
    if (normalized.startsWith(`${keyword}_`)) {
      if (BROAD_KEYWORDS.has(keyword) && negative) continue;
      return true;
    }
    if (normalized.endsWith(`_${keyword}`)) {
      if (BROAD_KEYWORDS.has(keyword) && negative) continue;
      return true;
    }
  }

  return false;
}

/**
 * Gán cờ PII cho toàn bộ cột theo heuristic tên cột.
 *
 * @param columns Danh sách cột (được trả về **mới**, không mutate input).
 */
export function inferPiiFlags<T extends { name: string; originalName?: string; isPii: boolean }>(
  columns: readonly T[],
): T[] {
  return columns.map((col) => {
    const source = col.originalName && col.originalName.length > 0 ? col.originalName : col.name;
    return { ...col, isPii: isPiiColumnName(source) };
  });
}
