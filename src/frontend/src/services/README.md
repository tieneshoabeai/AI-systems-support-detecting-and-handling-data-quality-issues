# services

## 1. Mục đích

Thực hiện lời gọi API auth/user/health, điều phối phiên, và cung cấp dữ liệu cùng thao tác giả lập cho preview. Dựng UI và lưu file draft thuộc tầng khác.

## 2. Vị trí & phụ thuộc

`app/app-runtime.ts` inject `ApiClient` và các port phiên. Preview view và hook dùng route helper và mock store. Service dùng type hợp đồng và `ApiError` từ lib.

## 3. Public API

- `createAuthService(api: ApiClient)` trả `login(input: LoginRequestDto, options?): Promise<LoginResult>`, `refresh(input: RefreshRequestDto, options?): Promise<RefreshResult>`, `logout(options?): Promise<void>`. `options` nhận `signal?: AbortSignal`.
- `createUsersService(api: ApiClient).getMe(options?): Promise<CurrentUser>` và `createHealthService(api: ApiClient).check(options?): Promise<AuthHealth>` nhận cùng dạng tùy chọn. Response sai contract ném `ApiError` loại `invalid-response`.
- `createSessionCoordinator(options: SessionCoordinatorOptions)` trả `getSnapshot(): SessionSnapshot`, `subscribe(listener): () => void`, `restore(): Promise<void>`, `checkSession(): Promise<void>`, `signIn(input: LoginRequestDto): Promise<void>`, `confirmRenewal(accepted: boolean): Promise<void>`, `signOut(): Promise<SignOutResult>`, `draftAccess` và `dispose(): void`.
- `parsePreviewRoute(source: string): PreviewRoute | null`, `is2DPreviewUrl(url: string): boolean`, `readPreviewRoute(): PreviewRoute`, `readPreviewSection(): PreviewSectionId`, `normalizePreviewHash(): void`, `previewHref(section, ids?): string`, `universeUrl(projectId?): string` cùng `twoDPreviewSections`, `universePath`, `previewNavigateEvent` mô tả điều hướng preview.
- Fixture exports gồm `people`, `currentUser`, `storageUsage`, các seed workspace/project/notification/report/profile/session/preferences, các bộ dữ liệu biên, `fixtureSets` và `isFixtureSetId(value: string | null)`.

### `previewMockStore`

Các ID, tên, vai trò và `personId` trong bảng là chuỗi. Các mutation trả `Promise<PreviewMutationResult>` với thông điệp và callback hoàn tác nếu có. Một số mutation reject khi đích vắng hoặc đầu vào không hợp lệ.

| Nhóm | Phương thức và đầu vào | Đầu ra |
| --- | --- | --- |
| Theo dõi | `getState()`, `subscribe(listener: () => void)` | `PreviewStoreState`, hàm hủy đăng ký |
| Phạm vi | `selectWorkspace(workspaceId)`, `selectProject(projectId)`, `clearProject()`, `touchWorkspace(id)` | `void` |
| Tài nguyên | `createWorkspace(input: NewWorkspaceInput)`, `createProject(input: NewProjectInput)`, `toggleFavorite(workspaceId)`, `updateWorkspace(id, edit: WorkspaceEdit)`, `rename(kind: PreviewResourceKind, id, name)`, `remove(kind: PreviewResourceKind, id)` | Kết quả mutation |
| Thành viên workspace | `addWorkspaceMember(input: NewWorkspaceMemberInput)`, `setWorkspaceMemberRole(workspaceId, personId, role)`, `removeWorkspaceMember(workspaceId, personId)` | Kết quả mutation |
| Thành viên project | `addProjectMember(input: NewProjectMemberInput)`, `setProjectMemberRole(projectId, personId, role)`, `removeProjectMember(projectId, personId)` | Kết quả mutation |
| Thông báo và báo cáo | `markNotificationsRead(ids: readonly string[])`, `removeNotifications(ids: readonly string[])`, `markAllNotificationsRead()`, `createReport(input: NewReportInput)` | Kết quả mutation |
| Cài đặt | `updateProfile(edit: ProfileEdit)`, `revokeSession(id)`, `revokeOtherSessions()`, `setNotificationPref(key: NotificationPrefKey, value: boolean)` | Kết quả mutation |
| Bộ dữ liệu | `getFixtureSet()`, `reset(set?: PreviewFixtureSetId)` | `PreviewFixtureSetId`, `PreviewMutationResult` đồng bộ |

## 4. Cách dùng (ví dụ)

```ts
import { createHealthService } from './services/health/health.service'
import type { ApiClient } from './types/api/api.types'

const api: ApiClient = {
  request: async <T>() => ({ status: 'ok', services: { mongodb_atlas: { status: 'connected' } } }) as T,
}
console.log(await createHealthService(api).check()) // { available: true }
```

Chạy ở module TypeScript ESM dưới `src`. Adapter giả trả payload đã unwrap.

## 5. Cấu trúc thư mục

**Khi thêm code.** Đặt endpoint và validation response trong service theo nhóm nghiệp vụ. Quyết định chuyển pha phiên đặt trong `auth/session-coordinator.ts`. Fixture và thao tác giả lập đặt riêng ở `preview/`.

- [auth/auth.service.ts](auth/auth.service.ts) — login, refresh và logout qua API, kiểm response.
- [auth/session-coordinator.ts](auth/session-coordinator.ts) — vòng đời phiên, consent, generation và quyền draft.
- [health/health.service.ts](health/health.service.ts) — khả dụng auth dựa trên MongoDB Atlas.
- [users/users.service.ts](users/users.service.ts) — gọi `/users/me` và map hồ sơ.
- [preview/preview-fixtures.ts](preview/preview-fixtures.ts) — fixture demo.
- [preview/preview-worst-case.ts](preview/preview-worst-case.ts) — bộ rỗng, một mục, nhiều mục và dữ liệu biên.
- [preview/preview-mock.service.ts](preview/preview-mock.service.ts) — store và mutation cục bộ.
- [preview/preview-route.ts](preview/preview-route.ts) — parse, build và chuẩn hóa URL preview.
- `.gitkeep` — giữ thư mục.

## 6. Luồng hoạt động

Auth service gọi API → kiểm DTO → coordinator kiểm phiên/generation → lưu phiên và phát snapshot. Gia hạn đi qua health và xác nhận khi đủ điều kiện. Store preview lấy fixture theo URL → mutation cập nhật snapshot → subscriber render lại.

## 7. Cấu hình

| Tham số | Mặc định | Tác dụng |
| --- | --- | --- |
| `signal` | Không truyền | Cho phép caller hủy request |
| Health timeout | 5.000 ms | Hạn chờ `/health` |
| `?data=` (preview dev) | `demo` | Chọn `worst`, `empty`, `one`, `many` hoặc `demo` |

## 8. Quy ước & bất biến

Login/refresh dùng auth mode `public`, logout và getMe dùng `session`. Coordinator giữ quyền quyết định ghi phiên sau tác vụ bất đồng bộ. Fixture preview nằm ngoài luồng API thật.

## 9. Test & debug

Chạy `yarn test src/__tests__/auth src/__tests__/preview`. Để xem fixture khó, mở `/?data=worst#/preview/workspaces` trong dev.

## 10. Giới hạn & lưu ý

Mock store không chứng minh quyền hay API backend. Logout có kết quả dọn cục bộ và revoke server riêng. Backend không rotate refresh token trong contract hiện tại.

## 11. Hướng cải tiến

Hoàn tất kiểm thử đăng nhập, refresh và revoke với môi trường backend được phép. Khi triển khai tính năng production còn thiếu, đối chiếu DTO thay vì suy ra hợp đồng từ fixture.
