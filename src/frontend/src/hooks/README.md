# hooks

## Hook dùng chung

- `workbench/workbench-session-context.ts` cấp context cho Management và Processing.
- `management/use-management-store.ts` đọc store được cấp qua provider.
- `workbench/workbench-presentation.ts` chứa nhãn, formatter và selector.
- `resource/resource-card.ts` và `resource/resource-menu.ts` xử lý tương tác trên thẻ và menu tài nguyên.
- `ui/use-workbench-surface.ts` kết nối sự kiện điều hướng với `ui/use-surface.ts`.

## 1. Mục đích

Đưa state và thao tác auth, preview và motion vào React. Gọi HTTP, quyết định quyền và vẽ scene nằm ở tầng khác.

## 2. Vị trí & phụ thuộc

Login, guard và dialog dùng hook auth. `AuthProvider` cung cấp giá trị cho context khai báo tại `hooks/auth/`. Preview hooks dùng preview service để theo dõi store. View Workspace 3D dùng hook motion.

## 3. Public API

- `useAuth(): AuthContextValue` đọc context, ném `Error` ngoài provider. `useLogin()` trả input email/password, setters, `submit(): Promise<void>`, trạng thái pending/lỗi và `signOut`.
- `usePreviewSessionModel(routeIds: PreviewRouteIds, appearance: PreviewAppearance, navigateSection?: PreviewSectionNavigator): PreviewSessionModel` ghép trạng thái panel/dialog và thao tác workbench. `ApplicationFrame` giữ theme qua các nhánh data provider.
- `usePreviewStore(): PreviewStoreState` đăng ký snapshot. `findWorkspace(state, workspaceId): Workspace | null`, `findProject(state, projectId): Project | null` và `projectsOfWorkspace(state, workspaceId): Project[]` nhận store và ID chuỗi.
- `useSceneMotion(): { reducedMotion: boolean; tabHidden: boolean; moving: boolean }` theo dõi môi trường trình duyệt.

```tsx
import { useSceneMotion } from './hooks/workspace-3d/use-scene-motion'

export function MotionStatus() {
  const { moving } = useSceneMotion()
  return <output>{moving ? 'Đang chạy' : 'Tạm dừng'}</output>
}
```

Mount trong React ở trình duyệt. Tab đang hiển thị và tùy chọn giảm chuyển động tắt cho kết quả `Đang chạy`.

## 5. Cấu trúc thư mục

**Khi thêm code.** Đặt hook theo tính năng trong `auth/`, `management/`, `workbench/` hoặc `workspace-3d/`. Logic thuần dùng ngoài React đặt ở tầng sở hữu. Kiểu chỉ dùng trong một hook giữ cạnh hook.

- [auth/use-auth.ts](auth/use-auth.ts) — đọc AuthContext có kiểm tra provider.
- [auth/auth-context.ts](auth/auth-context.ts) — context dùng chung cho provider và hook.
- [auth/use-login.ts](auth/use-login.ts) — state biểu mẫu và xử lý submit.
- [workbench/use-management-session.ts](workbench/use-management-session.ts) — trạng thái tương tác của workbench.
- [management/use-management-store.ts](management/use-management-store.ts) — subscription và selector workspace/project.
- [workspace-3d/use-scene-motion.ts](workspace-3d/use-scene-motion.ts) — theo dõi giảm chuyển động và visibility.
- `.gitkeep` — giữ thư mục.

## 6. Luồng hoạt động

AuthProvider → `useAuth()` → `useLogin()` → submit → coordinator cập nhật snapshot. Hook preview theo dõi store do provider cấp bằng `useSyncExternalStore`. Motion nhận thay đổi media query hoặc visibility rồi cập nhật `moving`.

## 7. Cấu hình

| Tham số | Mặc định | Tác dụng |
| --- | --- | --- |
| Email/password ban đầu | Chuỗi rỗng | Giá trị form trước nhập |
| `moving` | Tính từ media query và visibility | Chỉ true khi cho phép motion và tab đang hiển thị |

## 8. Quy ước & bất biến

Gọi hook ở cấp trên cùng của function component hoặc hook. Hook không chứa JSX và không import `app`, `views` hoặc `components`. Đọc store qua subscription để React nhận thay đổi. Selector trả `null` nếu ID đã mất khỏi snapshot.

## 9. Test & debug

Chạy `yarn test src/__tests__/auth/auth-flow.test.tsx src/__tests__/management/management-interactions.test.tsx src/__tests__/workspace-3d/scene-lifecycle.test.tsx`. Có thể đổi Reduce Motion hoặc chuyển tab để kiểm tra thủ công.

## 10. Giới hạn & lưu ý

`use-management-session.ts` đọc snapshot từ store được cấp cho workbench. Store trực tuyến lấy dữ liệu qua service. Test cấp store giả từ `src/__tests__/support/`. [ManagementLoadingContext](management/management-loading-context.ts) chuyển trạng thái tải hoặc lỗi kèm callback thử lại từ provider tới từng vùng UI. Hook motion cần API trình duyệt hoặc stub thích hợp trong jsdom.

## 11. Hướng cải tiến

Đề xuất bổ sung kịch bản trình duyệt cho chuyển tab rồi quay lại nếu behavior animation hoặc lifecycle thay đổi.
