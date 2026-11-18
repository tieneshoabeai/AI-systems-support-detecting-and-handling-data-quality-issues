/**
 * `PolicyResourceLoader` — hợp đồng nạp tài nguyên cho guard phân quyền
 * (thuần domain).
 *
 * Vì sao ở `shared/domain/security/`?
 *   Policy loader nằm ở tầng Application (`modules/<m>/application/policy-loaders/`)
 *   và hiện thực interface này. Interface phải nằm ở tầng mà Application
 *   được phép import → `shared/domain/`. Decorator `@PolicyResource` (gắn
 *   framework NestJS) vẫn ở `shared/interfaces/casl/` và import từ đây —
 *   chiều phụ thuộc hợp lệ (Interfaces → Domain).
 */
export interface PolicyResourceLoader {
  /**
   * Nạp tài nguyên theo id.
   *
   * @param id     giá trị của route param được khai báo trong `param`.
   * @param userId người dùng đang gọi (adapter có thể dùng để lọc theo quyền).
   */
  load(id: string, userId?: string): Promise<unknown>;
}
