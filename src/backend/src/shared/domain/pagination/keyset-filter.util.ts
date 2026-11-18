/**
 * Dựng điều kiện keyset (cursor) cho truy vấn MongoDB.
 *
 * Nguyên tắc: với sort `{ field: dir, _id: dir }`, các bản ghi nằm SAU con trỏ
 * là những bản ghi thỏa một trong:
 *   1. `field` lệch theo chiều sort so với giá trị con trỏ
 *   2. `field` BẰNG giá trị con trỏ nhưng `_id` lệch theo chiều sort (tiebreaker)
 *
 * ── Xử lý trường kiểu ngày có thể `null` ───────────────────────────────────
 * Theo thứ tự so sánh BSON của MongoDB, `null` luôn ĐỨNG TRƯỚC mọi giá trị Date:
 *   - sort tăng dần : [null] → [date nhỏ nhất] → ... → [date lớn nhất]
 *   - sort giảm dần : [date lớn nhất] → ... → [date nhỏ nhất] → [null]
 * Vì vậy điều kiện phải phân biệt 2 trường hợp: con trỏ trỏ vào nhóm `null`
 * hay trỏ vào một giá trị ngày cụ thể.
 */

export interface KeysetSortSpec {
  /** Tên trường trong collection (snake_case). */
  field: string;
  /** 1 = tăng dần, -1 = giảm dần. */
  direction: 1 | -1;
  /** true nếu trường là kiểu Date (cần xử lý `null`). */
  isDate: boolean;
}

export interface KeysetCursorRef {
  /** Giá trị trường sắp xếp tại phần tử cuối (ISO-8601 nếu là ngày). */
  value: string;
  /** `true` nếu giá trị trường sắp xếp tại phần tử cuối là `null`. */
  isNull: boolean;
  /** `_id` hex của phần tử cuối. */
  id: string;
}

/**
 * Dựng fragment `$or` để AND vào filter chính.
 *
 * @param spec   Đặc tả trường + chiều sắp xếp
 * @param cursor Con trừ đã giải mã (giá trị + id)
 */
export function buildKeysetCondition(
  spec: KeysetSortSpec,
  cursor: KeysetCursorRef,
): Record<string, unknown> {
  const { field, direction } = spec;
  const idCmp = direction === 1 ? { $gt: cursor.id } : { $lt: cursor.id };

  // ── Trường ngày (có thể null) ───────────────────────────────────────────
  if (spec.isDate) {
    if (cursor.isNull) {
      // Con trỏ nằm trong nhóm `null`.
      if (direction === 1) {
        // Nhóm null đứng đầu → phần còn lại là toàn bộ các giá trị ngày.
        return { $or: [{ [field]: null, _id: idCmp }, { [field]: { $ne: null } }] };
      }
      // Nhóm null đứng cuối → chỉ còn các phần tử null có `_id` nhỏ hơn.
      return { [field]: null, _id: idCmp };
    }

    const cmp = new Date(cursor.value);
    if (direction === 1) {
      return {
        $or: [{ [field]: { $gt: cmp } }, { [field]: cmp, _id: idCmp }],
      };
    }
    // Giảm dần: các giá trị null nằm sau tất cả các giá trị ngày.
    return {
      $or: [
        { [field]: { $lt: cmp } },
        { [field]: cmp, _id: idCmp },
        { [field]: null },
      ],
    };
  }

  // ── Trường chuỗi ─────────────────────────────────────────────────────────
  if (direction === 1) {
    return {
      $or: [
        { [field]: { $gt: cursor.value } },
        { [field]: cursor.value, _id: idCmp },
      ],
    };
  }
  return {
    $or: [
      { [field]: { $lt: cursor.value } },
      { [field]: cursor.value, _id: idCmp },
    ],
  };
}

/**
 * Sort tương ứng với đặc tả (kèm tiebreaker `_id`).
 * Mongoose tự cast `_id` từ chuỗi hex sang ObjectId khi dựng truy vấn.
 */
export function buildKeysetSort(spec: KeysetSortSpec): Record<string, 1 | -1> {
  return { [spec.field]: spec.direction, _id: spec.direction };
}
