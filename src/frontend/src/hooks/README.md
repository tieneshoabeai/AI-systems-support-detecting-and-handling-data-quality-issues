# hooks

## 1. Mục đích

Đưa state và thao tác auth, preview và motion vào React. Gọi HTTP, quyết định quyền và vẽ scene nằm ở tầng khác.

## 2. Vị trí & phụ thuộc

Login, guard và dialog dùng hook auth. `AuthProvider` cung cấp giá trị cho context khai báo tại `hooks/auth/`. Preview hooks dùng preview service để theo dõi store. View Workspace 3D dùng hook motion.

## 3. Public API

- `useAuth(): AuthContextValue` đọc context, ném `Error` ngoài provider. `useLogin()` trả input email/password, setters, `submit(): Promise<void>`, trạng thái pending/lỗi và `signOut`.
- `usePreviewSessionModel(routeIds: PreviewRouteIds, navigateUniverse?: PreviewUniverseNavigator): PreviewSessionModel` ghép trạng thái panel/dialog và thao tác preview. `statusLabels` là bảng nhãn trạng thái.
- `usePreviewStore(): PreviewStoreState` đăng ký snapshot. `findWorkspace(state, workspaceId): Workspace | null`, `findProject(state, projectId): Project | null` và `projectsOfWorkspace(state, workspaceId): Project[]` nhận store và ID chuỗi.
- `useSceneMotion(): { reducedMotion: boolean; tabHidden: boolean; moving: boolean }` theo dõi môi trường trình duyệt.

## 4. Cách dùng (ví dụ)

```tsx
import { useSceneMotion } from './hooks/workspace-3d/use-scene-motion'

export function MotionStatus() {
  const { moving } = useSceneMotion()
  return <output>{moving ? 'Đang chạy' : 'Tạm dừng'}</output>
}
```

Mount trong React ở trình duyệt. Tab đang hiển thị và tùy chọn giảm chuyển động tắt cho kết quả `Đang chạy`.

## 5. Cấu trúc thư mục

**Khi thêm code.** Đặt hook theo tính năng trong `auth/`, `preview/` hoặc `workspace-3d/`. Logic thuần dùng ngoài React đặt ở tầng sở hữu. Kiểu chỉ dùng trong một hook giữ cạnh hook.

- [auth/use-auth.ts](auth/use-auth.ts) — đọc AuthContext có kiểm tra provider.
- [auth/auth-context.ts](auth/auth-context.ts) — context dùng chung cho provider và hook.
- [auth/use-login.ts](auth/use-login.ts) — state biểu mẫu và xử lý submit.
- [preview/use-preview-session.ts](preview/use-preview-session.ts) — trạng thái tương tác và thao tác mock của preview.
- [preview/use-preview-store.ts](preview/use-preview-store.ts) — subscription và selector workspace/project.
- [workspace-3d/use-scene-motion.ts](workspace-3d/use-scene-motion.ts) — theo dõi giảm chuyển động và visibility.
- `.gitkeep` — giữ thư mục.

## 6. Luồng hoạt động

AuthProvider → `useAuth()` → `useLogin()` → submit → coordinator cập nhật snapshot. Preview nhận ID từ URL và theo dõi mock store bằng `useSyncExternalStore`. Motion nhận thay đổi media query hoặc visibility rồi cập nhật `moving`.

## 7. Cấu hình

| Tham số | Mặc định | Tác dụng |
| --- | --- | --- |
| Email/password ban đầu | Chuỗi rỗng | Giá trị form trước nhập |
| `navigateUniverse` | `defaultUniverseNavigator` | Điều hướng từ preview tới Universe |
| `moving` | Tính từ media query và visibility | Chỉ true khi cho phép motion và tab đang hiển thị |

## 8. Quy ước & bất biến

Gọi hook ở cấp trên cùng của function component hoặc hook. Hook không chứa JSX và không import `app`, `views` hoặc `components`. Đọc mock store qua subscription để React nhận thay đổi. Selector trả `null` nếu ID đã mất khỏi snapshot.

## 9. Test & debug

Chạy `yarn test src/__tests__/auth/auth-flow.test.tsx src/__tests__/preview/preview-interactions.test.tsx src/__tests__/workspace-3d/scene-lifecycle.test.tsx`. Có thể đổi Reduce Motion hoặc chuyển tab để kiểm tra thủ công.

## 10. Giới hạn & lưu ý

Preview hook chỉ thao tác fixture cục bộ. Hook motion cần API trình duyệt hoặc stub thích hợp trong jsdom.

## 11. Hướng cải tiến

Đề xuất bổ sung kịch bản trình duyệt cho chuyển tab rồi quay lại nếu behavior animation hoặc lifecycle thay đổi.
