/**
 * Con trỏ phân trang (keyset cursor) ở dạng đã giải mã — thuần data, không phụ thuộc framework.
 *
 * Tầng `domain` chỉ được import từ `shared/utils` (hàm thuần) theo quy tắc CA11,
 * nên định nghĩa type này ở đây để các domain port dùng chung.
 */
export interface ListCursor {
  /**
   * Mã loại sắp xếp đã dùng để sinh ra con trỏ.
   * Dùng để phát hiện client tái sử dụng con trỏ cũ khi đổi tham số `sort`.
   */
  sortCode: string;
  /** Giá trị của trường sắp xếp tại phần tử cuối của trang trước (ISO-8601 nếu là ngày). */
  value: string;
  /** `true` nếu giá trị trường sắp xếp tại phần tử cuối là `null`. */
  isNull: boolean;
  /** `_id` (hex) của phần tử cuối — dùng làm tiebreaker. */
  id: string;
}

/** Kết quả một trang danh sách dùng keyset cursor. */
export interface ListPage<T> {
  /** Các phần tử của trang (tối đa `limit` phần tử). */
  items: T[];
  /** Con trỏ tới trang kế tiếp; `null` nếu đã hết dữ liệu. */
  nextCursor: string | null;
  /** `true` nếu còn dữ liệu phía sau. */
  hasMore: boolean;
}
