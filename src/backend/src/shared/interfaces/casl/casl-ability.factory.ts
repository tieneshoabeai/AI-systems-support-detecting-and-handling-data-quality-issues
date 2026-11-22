import { Injectable } from '@nestjs/common';
import { AbilityBuilder, createMongoAbility, MongoAbility } from '@casl/ability';
import { Action } from '../../domain/security/action';
import type { AppSubjects } from '../../domain/security/subjects';
import type { CurrentUser } from '../../domain/security/current-user';

/**
 * `CurrentUser` được khai báo ở `shared/domain/security/current-user.ts`
 * (tầng Domain, thuần TypeScript) vì tầng Application của module cũng cần
 * dùng nó mà không được phụ thuộc vào `shared/interfaces/`.
 * Vẫn re-export tại đây để giữ public contract cũ của `casl-ability.factory`.
 */
export type { CurrentUser };

export type AppAbility = MongoAbility<[Action, AppSubjects]>;

/**
 * CASL ABAC — phân quyền theo thuộc tính thực thể (`workspace_id`, `project_id`).
 *
 * Nguyên tắc thiết kế:
 *   1. **Chỉ dùng `can` với điều kiện, KHÔNG dùng `cannot` có điều kiện.**
 *      Lý do: tầng static check của `PoliciesGuard` kiểm tra ở mức *type*
 *      (`can(Update, 'Workspace')`). Một rule `cannot(Update, 'Workspace',
 *      { id: { $in: [...] } })` làm type-level check trả `false` cho **mọi**
 *      workspace → chặn oan cả workspace user sở hữu.
 *      → Ràng buộc "chỉ được sửa workspace mình sở hữu" được thực thi ở
 *      **tầng động** (instance check) của `PoliciesGuard`.
 *   2. Mọi endpoint thao tác trên **một tài nguyên cụ thể** phải khai báo
 *      `@PolicyResource(...)` để guard nạp resource và kiểm tra instance.
 *      Nếu thiếu → chỉ có kiểm tra type → nguy cơ IDOR (đọc workspace của
 *      người khác).
 *   3. Rule `$in` với mảng RỖNG vẫn cho type-level check = `true` nhưng
 *      instance check = `false`. Đây là cơ chế cố ý: cho phép endpoint
 *      "liệt kê" chạy với user chưa có tài nguyên nào (trả danh sách rỗng)
 *      mà vẫn chặn truy cập vào tài nguyên cụ thể của người khác.
 *   4. **KHÔNG dùng mảng điều kiện** (`can(a, 'X', [{...}, {...}])`).
 *      CASL hiểu mảng điều kiện theo nghĩa **"khớp bất kỳ trường nào"**
 *      (any-field-match), KHÔNG phải OR giữa các điều kiện → dễ mở cổng.
 *      Muốn biểu đạt OR thì phải ghi **nhiều lệnh `can()` riêng biệt**
 *      (mỗi lệnh là một rule, CASL ghép các rule bằng OR).
 *   5. **Điều kiện luôn dùng tên trường đã chuẩn hoá snake_case**
 *      (`workspace_id`, `project_id`, `owner_id`) vì `buildSubject()` ánh xạ
 *      camelCase của domain record sang snake_case trước khi so khớp.
 *
 * Mô hình quyền 4 tầng (Phần 6 v7 §3.1 + ma trận quyền §3.5):
 *   - SYS-ADMIN   → toàn quyền (ngoại lệ: không đọc nội dung dữ liệu — quyết
 *                   định v3 mục 3.3; chưa hiện thực hoá ở guard này).
 *   - WS-OWNER    → toàn quyền trên mọi tài nguyên của workspace mình sở hữu
 *                   (kể cả tạu & xoá project — UC-05 / PROJ-05).
 *   - PROJ-OWNER  → toàn quyền trong project, trừ **xoá project** (chỉ
 *                   WS-OWNER được xoá project — PROJ-05 Phần 2 v11).
 *   - PROJ-MEMBER → ghi metadata cột, cấu hình & chạy phân tích, lưu trạng
 *                   thái project. KHÔNG được quản lý thành viên project,
 *                   KHÔNG được import dữ liệu (UC-08), KHÔNG được sửa
 *                   thông tin project.
 *   - PROJ-VIEWER / WS-MEMBER → chỉ đọc.
 */
@Injectable()
export class CaslAbilityFactory {
  createForUser(user: CurrentUser): AppAbility {
    const { can, build } = new AbilityBuilder<AppAbility>(createMongoAbility);

    // 1. Quản trị viên hệ thống (System Admin): Toàn quyền trên mọi thực thể
    if (user.role === 'admin') {
      can(Action.Manage, 'all');
      return build();
    }

    // 2. Quyền cá nhân: Xem/sửa profile của chính mình và quản lý sessions cá nhân
    can([Action.Read, Action.Update], 'User', { id: user.userId });
    can(Action.Read, 'Notification', { user_id: user.userId });
    can(Action.Update, 'Notification', { user_id: user.userId });
    can([Action.Create, Action.Read], 'IssueReport', { user_id: user.userId });
    can([Action.Read, Action.Delete], 'Session', { user_id: user.userId });

    // 3. Phân quyền theo vai trò trong các workspace user đang tham gia.
    const ownedIds = user.ownedWorkspaceIds ?? [];
    const memberIds = (user.workspaceIds ?? []).filter((id) => !ownedIds.includes(id));
    const allWorkspaceIds = [...ownedIds, ...memberIds];

    // 3a. WS-OWNER — quyền quản trị đầy đủ trong workspace mình sở hữu.
    //     Bao gồm `Create Project` trong workspace đó (UC-05: chỉ WS-OWNER
    //     tạo project) và `Delete Project` (PROJ-05: chỉ WS-OWNER xoá project).
    if (ownedIds.length > 0) {
      can(Action.Manage, 'Workspace', { id: { $in: ownedIds } });
      can(Action.Manage, 'Project', { workspace_id: { $in: ownedIds } });
      can(Action.Manage, 'Dataset', { workspace_id: { $in: ownedIds } });
      can(Action.Manage, 'DataRecord', { workspace_id: { $in: ownedIds } });
      can(Action.Manage, 'Analysis', { workspace_id: { $in: ownedIds } });
    }

    // 3b. Đọc workspace — chỉ workspace mình tham gia (owner hoặc member).
    //     Luôn khai báo (kể cả mảng rỗng) để endpoint "liệt kê workspace" chạy
    //     được với user chưa có workspace nào.
    can(Action.Read, 'Workspace', { id: { $in: allWorkspaceIds } });

    // 3c. WS-MEMBER — đọc tài nguyên bên trong workspace (PROJ-VIEWER mặc định).
    if (memberIds.length > 0) {
      can(Action.Read, 'Project', { workspace_id: { $in: memberIds } });
      can(Action.Read, 'Dataset', { workspace_id: { $in: memberIds } });
      can(Action.Read, 'DataRecord', { workspace_id: { $in: memberIds } });
      can(Action.Read, 'Analysis', { workspace_id: { $in: memberIds } });
    }

    // 4. Phân quyền tầng project (PROJ-OWNER / PROJ-MEMBER / PROJ-VIEWER).
    //
    //    Điều kiện dùng `project_id` cho Dataset/Analysis vì chúng thuộc project,
    //    còn `workspace_id` đã được xử lý ở mục 3.
    const projectRoles = user.projectRoles ?? {};

    const ownerProjects = Object.entries(projectRoles)
      .filter(([, role]) => role === 'owner')
      .map(([id]) => id);
    const memberProjects = Object.entries(projectRoles)
      .filter(([, role]) => role === 'member')
      .map(([id]) => id);
    const viewerProjects = Object.entries(projectRoles)
      .filter(([, role]) => role === 'viewer')
      .map(([id]) => id);
    const allProjects = [...ownerProjects, ...memberProjects, ...viewerProjects];

    // 4a. PROJ-OWNER — toàn quyền trong project (trừ xoá project: chỉ
    //     WS-OWNER được xoá project — PROJ-05 trong đặc tả Phần 2 v11).
    if (ownerProjects.length > 0) {
      can([Action.Read, Action.Update, Action.Execute], 'Project', { id: { $in: ownerProjects } });
      can(Action.Manage, 'Dataset', { project_id: { $in: ownerProjects } });
      can(Action.Read, 'DataRecord', { project_id: { $in: ownerProjects } });
      can(Action.Manage, 'Analysis', { project_id: { $in: ownerProjects } });
    }

    // 4b. PROJ-MEMBER — được thao tác dữ liệu, chạy phân tích và lưu
    //     (đặc tả Phần 2 v11: "Project Member được thao tác dữ liệu, chạy phân
    //     tích và lưu"). KHÔNG được quản lý thành viên project (chỉ PROJ-OWNER),
    //     KHÔNG được import dữ liệu (UC-08 — chỉ WS-OWNER/PROJ-OWNER),
    //     KHÔNG được sửa thông tin project (chỉ PROJ-OWNER/WS-OWNER).
    if (memberProjects.length > 0) {
      can([Action.Read, Action.Execute], 'Project', { id: { $in: memberProjects } });
      can([Action.Read, Action.Update], 'Dataset', { project_id: { $in: memberProjects } });
      can(Action.Read, 'DataRecord', { project_id: { $in: memberProjects } });
      can(
        [Action.Create, Action.Read, Action.Update, Action.Execute],
        'Analysis',
        { project_id: { $in: memberProjects } },
      );
    }

    // 4c. PROJ-VIEWER — chỉ đọc (không tạo/chạy lại kết quả, không thao tác dữ
    //     liệu, không lưu — đặc tả Phần 2 v11 mục 3.18).
    if (viewerProjects.length > 0) {
      can(Action.Read, 'Project', { id: { $in: viewerProjects } });
      can(Action.Read, 'Dataset', { project_id: { $in: viewerProjects } });
      can(Action.Read, 'DataRecord', { project_id: { $in: viewerProjects } });
      can(Action.Read, 'Analysis', { project_id: { $in: viewerProjects } });
    }

    // 4d. Luôn khai báo rule đọc Project (mảng có thể rỗng) → endpoint liệt kê
    //     project chạy được với user chưa có project nào.
    can(Action.Read, 'Project', { id: { $in: allProjects } });

    // 5. Tạo workspace — mọi user đã đăng nhập đều được phép (kể cả khi đã
    //    có workspace). Giới hạn số lượng tối đa được áp dụng ở tầng nghiệp vụ
    //    (`CreateWorkspaceHandler` → MAX_WORKSPACES_PER_USER).
    can(Action.Create, 'Workspace');

    return build();
  }
}
