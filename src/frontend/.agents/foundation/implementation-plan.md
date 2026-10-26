# Đợt nền tảng frontend — Implementation Plan

Ngày: 26/10/2026. Trạng thái: ghi nhận quyết định và plan; **chưa triển khai chức năng**. Theo yêu cầu mới, tạm dừng batch code/login, đã setup folder .gitkeep và cài dependency cho cả nhóm. Theo [master plan](../frontend-delivery/master-plan.md) và [team workflow](../frontend-delivery/team-workflow.md) để phối hợp 2 người.

Tham chiếu: [Frontend Architecture Plan](../Structure/frontend-architecture-plan.md). Tài liệu này mô tả batch nền tảng; không thay thế bảng 9 module và gate backend trong architecture.

Đặc tả bổ sung: [Foundation interfaces](../frontend-delivery/foundation-spec.md), [Screen flow](../frontend-delivery/screen-flow.md), [Shared UI](../frontend-delivery/shared-ui.md). Đọc source DTO trước khi suy ra input/response: Lineage có response DTO, các module còn lại chủ yếu request; xem bảng trong [contract audit](../frontend-delivery/modules/00-contract-audit.md). Chưa code nhánh UX/UI có ID chờ xác nhận.

## 1. Mục tiêu và phạm vi đã duyệt

**Hiện trạng mới:** đã setup entry `src/app/main.tsx`, App.tsx/layout.tsx dạng một arrow function tối giản, style.css và các folder constants/context/pages/private/pages/public/router. index.html trỏ entry trong app. Chưa có router/providers/auth/feature; không coi bootstrap là foundation đã hoàn thành. File mẫu ở root src không được khôi phục.

Tạo khung React chạy được với router/layout/guard, QueryClientProvider, AuthProvider, session coordinator, API client và **form login tối giản gọi API thật**. Người dùng có thể học luồng từ input → hook → service → Axios → backend → phiên/UI.

Không triển khai 9 module đầy đủ, đăng ký UI, IndexedDB, queue/replay, scene 3D, export/transformation hoặc backend. Protected shell chỉ phục vụ kiểm tra phiên; không giả dashboard có dữ liệu thật. Nghiệp vụ cục bộ của architecture chưa hoạt động trong batch này vì repository/IndexedDB chưa được xây.

Chỉ được ghi code sau khi version dependency, các quyết định còn thiếu ở mục 7 và batch file cuối cùng được xác nhận. Việc duyệt tài liệu không mặc nhiên là duyệt cài đặt/code.

## 2. Công cụ và dependency

- **Yarn là công cụ chính**: cài đặt, dev, build và lint dùng Yarn.
- Giữ cả `yarn.lock` và `package-lock.json`; không xóa, không npm install xen kẽ, không tự cập nhật package-lock. Cần báo rõ package-lock có thể lệch khi dependency được cài bằng Yarn.
- Batch code nền tảng chỉ sử dụng React Router, Axios và TanStack Query. Theo xác nhận mới về setup chung cho người thứ hai, Three.js/Fiber/Dexie và bộ test cũng đã được cài trước; không đồng nghĩa đã có code dùng chúng.
- Kiểm tra phiên bản Yarn/Node hiện tại và peer compatibility với React/TypeScript/Vite đã có trước khi chốt lệnh cài. Không nâng React/Vite hoặc thay lockfile format ngầm.
- Đã chốt **Vitest + React Testing Library + jsdom**, test chính thức tại `src/__tests__/`. Testing Library cần peer `@testing-library/dom`; không tự tạo script kiểm thử AI trong src/scripts/public.
- Inspection ngày 26/10/2026: Node 26.7.0, Yarn 1.22.22, React/React DOM 19.3.1, Vite đang cài 8.3.5, TypeScript 6.0.3. Đã cài các version pin trong manifest, gồm @testing-library/dom 10.4.2. Yarn install, frozen/offline install trên cây hiện tại, build scaffold và lint đều đạt. Đây chưa phải kiểm thử tính năng hoặc clean install trên máy thứ hai. Không thay Node/Yarn/React/Vite ở đợt này.

## 3. Các nhóm file dự kiến

Các đường dẫn dưới đây tương đối với frontend root; tên và trách nhiệm là đề xuất cho batch code, không phải file đã tồn tại.

| File/nhóm | Trách nhiệm |
|---|---|
| `src/app/main.tsx`, `src/app/App.tsx` | Entry/app root đã có bản tối giản; chỉ ghép provider/router sau khi duyệt batch chức năng |
| `src/app/app-providers.tsx` | Compose Router, QueryClient và AuthProvider |
| `src/app/router/app-router.tsx` | Route explicit, public/private và not-found |
| `src/app/guards/` | Protected/public-only guard; loading bootstrap; trạng thái phiên |
| `src/app/layouts/` | Public login layout; protected shell; logout và trạng thái kết nối |
| `src/app/providers/auth-provider.tsx` | Phiên runtime, bootstrap, login/logout, phối hợp coordinator |
| `src/hooks/auth/` | Login flow, session expiry/consent; không trùng lặp refresh giữa request |
| `src/components/auth/` | Dialog gia hạn; UI callback, không tự gọi API |
| `src/views/auth/login.view.tsx` | Email/password form tối giản, loading/error; không hardcode credential |
| `src/services/auth/` | Login, refresh, logout theo contract thực tế |
| `src/services/users/` | `GET /users/me` phục vụ bootstrap |
| `src/lib/api-client.ts` | Axios instance, bearer, network/API error boundary |
| `src/lib/query-client.ts` | QueryClient và quy tắc cache phiên |
| `src/configs/api.config.ts` | Base URL công khai; chỉ tên config, không secret |
| `src/types/auth/`, `src/types/api/` | DTO, session state, context contract, error model |
| `src/utils/auth/` | Kiểm tra cấu trúc/hạn token và storage boundary khi có trách nhiệm rõ |
| `src/app/style.css` | File style khung đã có, chưa thêm UI; không khôi phục App.css mẫu |
| `package.json`, `yarn.lock` | Chỉ cập nhật dependency/scripts đã được duyệt; giữ package-lock |

Ngoại lệ đã duyệt cho setup nhóm: các folder tầng/test có .gitkeep, không có placeholder component/service/hook. Nếu cần chia thêm file để giữ React Fast Refresh hoặc tách context/hook, trình bày trong batch file cuối cùng trước code. Không tự xóa asset scaffold nếu chưa duyệt cleanup.

## 4. Contract, router và luồng dữ liệu

### API thực tế phục vụ batch

| Hành động | Contract source hiện tại |
|---|---|
| Login | `POST /auth/login`, email/password; response `access_token`, `refresh_token`, `expires_in`, `user` trong envelope |
| User hiện tại | `GET /users/me`, bearer access token |
| Refresh | `POST /auth/refresh`, body `{ refresh_token }`; response access token mới và expires_in |
| Logout | `POST /auth/logout`, bearer access token; server thu hồi session hiện hành |

Prefix mặc định source `/api/v1`, phải xác nhận base URL môi trường test không qua đọc `.env`. Không dùng `/auth/refresh-token` hoặc trường camelCase của spec thay cho contract thực tế.

API client không giữ UI state, mở dialog, refresh ngầm hoặc retry mutation. Service xử lý shape nghiệp vụ; envelope `{ success, data }` chỉ unwrap ở biên đã định nghĩa, tránh unwrap lặp. Lỗi mạng/timeout khác với server từ chối credential; không đổi mọi `401` thành outage hoặc tự refresh.

Route nền tảng đề xuất: `/auth/login`, `/workspaces` cho protected shell và fallback not-found. Root chọn login/shell theo trạng thái phiên. Các route khác của architecture thêm khi feature được triển khai; không expose menu dẫn tới chức năng giả.

```text
Login view nhận email/password
  → login hook validate form và gọi auth service
  → Axios gửi request
  → kiểm tra response theo contract
  → ghi credential vào sessionStorage + cập nhật phiên runtime
  → mở protected shell
```

Không lưu password hoặc log token/payload login. Form tối giản có label, nút submit, trạng thái đang gửi và lỗi có thể hiểu; giao diện hoàn chỉnh làm sau.

## 5. Lưu phiên và gia hạn — quyết định đã xác nhận

Access token và refresh token lưu **sessionStorage**, bản runtime trong AuthProvider. Không dùng localStorage/IndexedDB/cookie để lưu token. JavaScript vẫn đọc được sessionStorage nên đây không phải giải pháp chống XSS.

| Sự kiện | Kết quả |
|---|---|
| Reload, token còn hạn, BE hoạt động | Guard chờ bootstrap; gọi `/users/me`, lấy user mới rồi mở protected shell |
| Reload, token còn hạn, BE lỗi | Kiến trúc cho chế độ cục bộ giới hạn; batch nền tảng chỉ hiện trạng thái chưa có dữ liệu nghiệp vụ cục bộ |
| Token hết hạn, BE hoạt động | Dừng nghiệp vụ, hỏi có tiếp tục phiên |
| Đồng ý tiếp tục | Gọi refresh một lần; thành công mới mở lại flow |
| Từ chối tiếp tục | Xóa credential/ngữ cảnh phiên, dọn cache, về login |
| Token hết hạn, BE lỗi | Xóa credential/ngữ cảnh phiên, dọn cache, về login |
| Refresh rejected hoặc network/BE error | Token đã hết hạn: về login; không tự coi là refresh thành công |
| Logout | Kết thúc phiên FE; gọi revoke server khi có thể; không hứa server đã revoke nếu request lỗi |

Một coordinator sở hữu dialog và promise refresh chung. Khi chờ quyết định/refresh, request nghiệp vụ mới phải dừng; không replay mutation tự động. Query đọc chỉ được tải lại khi phiên hợp lệ. Pending response của phiên cũ không được ghi vào phiên mới.

Kiểm tra hạn ở action, timer và focus/visibility. Dùng exp thực tế khi scheduling; response expires_in source đang hardcode 900 nên không tự lấy thời gian outage làm mốc cấp token mới. Decode token phục vụ UI scheduling, không xác minh chữ ký hoặc quyền server.

### Hạn token và nhiều tab — đã xác nhận

- Hết hạn khi `Date.now() >= exp * 1000`; không cộng grace period, không tự gia hạn 15 phút và không tự hiệu chỉnh clock skew. `exp` là NumericDate số hữu hạn và quy đổi được sang thời gian hữu hạn; thiếu/sai kiểu/không hữu hạn thì xử lý phiên lỗi. Đồng hồ máy sai có thể khiến FE nhận định sai; server vẫn là bên xác nhận token khi request tới.
- Mỗi tab giữ phiên riêng; không đồng bộ login/logout qua BroadcastChannel/localStorage hoặc cơ chế khác trong batch này. Một health flow/dialog/refresh là cam kết **trong mỗi tab**, không phải toàn trình duyệt.
- Duplicate/new tab có thể được browser sao chép sessionStorage ban đầu; không hứa luôn tạo server session mới. Logout tab A không tự đổi UI tab B. Nếu cùng server session, refresh của B có thể bị từ chối sau revoke; không giả xác nhận trạng thái B khi chưa có response server.
- Lock một chủ gửi queue giữa nhiều tab vẫn phải được thiết kế ở batch sync, chưa triển khai ở batch nền tảng.

sessionStorage lỗi/corrupt/thiếu token: không mở private UI hoặc giả khôi phục thành công; xử lý lỗi rõ và về login nếu không đủ phiên.

### Schema sessionStorage đã xác nhận

Key: `data-quality.auth.v1`. Giá trị JSON theo model nội bộ FE (không phải payload API):

```ts
type StoredSession = {
  schemaVersion: 1;
  accessToken: string;
  refreshToken: string;
  accountId: string;
};
```

`accountId` phải khớp `sub` của access token; không dùng phép đối chiếu này như xác minh chữ ký hoặc quyền. Không lưu password/role/user snapshot; khi BE hoạt động lấy user qua `/users/me`, khi outage chỉ dùng account context cho phạm vi cục bộ đã duyệt.

JSON không parse được, trường thiếu/sai kiểu, schemaVersion không hỗ trợ, token không có exp hợp lệ hoặc accountId khác sub: xóa riêng key phiên lỗi, chuyển login, không xóa bản nháp. Token có exp hợp lệ nhưng đã hết hạn là trường hợp consent/refresh, không phải schema corrupt. Lưu token mới và refresh token được giữ theo contract trong một object, không để session mới mang accountId của phiên cũ.

IndexedDB tương lai không bị xóa khi logout/từ chối/hết hạn; chỉ cùng account đã xác thực mới truy cập/replay. Batch này không tự dựng queue placeholder rồi tuyên bố đạt resilience.

### Health trước consent — đã xác nhận

Bằng chứng static: `src/backend/src/app.controller.ts` khai báo public `GET /health`, AppModule mount controller. Dùng base URL/prefix đã cấu hình; mặc định là `/api/v1/health`.

1. Token hết hạn: chặn nghiệp vụ và request refresh; một flow kiểm tra dùng chung cho các request đồng thời.
2. Gọi health không bearer, timeout **5.000 ms**; không gửi credential hoặc tự retry vòng lặp.
3. HTTP thành công + envelope/payload hợp lệ + `services.mongodb_atlas.status === 'connected'`: hỏi người dùng có tiếp tục phiên. Chỉ đồng ý mới gọi refresh.
4. Timeout, lỗi mạng, HTTP lỗi, payload thiếu/sai hoặc MongoDB disconnected: về login và giữ bản nháp theo chính sách. UI nói không thể xác nhận dịch vụ khả dụng, không khẳng định mọi lỗi đều do server sập.
5. Neo4j disconnected không tự coi auth hỏng; health đạt không bảo đảm refresh. Nếu refresh sau consent bị từ chối/lỗi mạng thì về login như bảng trên.

Service health chỉ trả model khả dụng tối thiểu, không đưa toàn bộ thông tin hạ tầng/bucket vào UI/log. Không dùng health thay kiểm tra phiên/quyền hoặc điều kiện replay. Danh sách file batch bổ sung service/type health tại tầng service/type tương ứng, không để component tự gọi.

## 6. Validation và nghiệm thu batch code tương lai

- Build: `yarn build`; lint: `yarn lint`. Chỉ chạy sau khi batch code và dependency được duyệt; nếu công cụ sửa thêm file phải báo.
- Kiểm thử logic: expiry, storage lỗi/corrupt, clear session, stale response khi account đổi và consent refresh concurrency.
- Kiểm thử flow: login đúng/sai, reload trước/sau expiry, BE lỗi khi token còn hạn/hết hạn, đồng ý/từ chối gia hạn, refresh rejected/network error.
- Nhiều request cùng hết hạn: một dialog/một refresh; không tự gửi lại mutation.
- Health: HTTP thành công nhưng MongoDB disconnected; MongoDB connected/Neo4j disconnected; timeout 5 giây; HTTP lỗi/payload lỗi; health đạt rồi refresh thất bại. Không refresh trước consent; không tạo nhiều health flow cho cùng sự kiện hết hạn.
- Cache: user A logout/user B login không thấy dữ liệu A; public route không hiện thông tin private trong lúc bootstrap.
- Expiry boundary: ngay trước/đúng/sau exp; thiếu/sai kiểu/không hữu hạn; tab ngủ qua exp rồi focus. Kiểm tra không cộng grace period và không refresh âm thầm.
- Multi-tab: login/logout không tự đồng bộ UI; duplicate tab không bị coi là server session mới; khi server từ chối phiên dùng chung thì xử lý theo response thực tế.
- Browser: submit form thật, redirect/guard, dialog focus/keyboard, reload, focus tab và thông báo lỗi. Chỉ thử thu hồi session/tài khoản trong dữ liệu test được phép.
- Báo riêng static/build/lint, automated tests và API/browser thực chạy; không dùng build thành công để kết luận auth/runtime đúng.
- Nếu chưa có backend/test account/base URL: báo rõ phần runtime chưa kiểm chứng, không fabricate response hoặc đăng nhập giả thành công.

Test chính thức đặt tại `src/__tests__/`, dùng Vitest + React Testing Library + jsdom. Đề xuất script `yarn test` chạy `vitest run`; chỉ thêm khi batch code được duyệt. Mock network trong automated test phải được phân biệt với API thật. File hỗ trợ AI chỉ trong `.agents/foundation/` nếu thật sự cần; dọn file tạm sau dùng. Không tự commit/reset/revert, không đọc `.env`.

## 7. Các quyết định còn thiếu trước batch code

1. Dependency đã pin/cài cho setup nhóm, gồm @testing-library/dom 10.4.2; trước batch code kiểm tra lại manifest/lock hiện tại và cấu hình test chưa có.
2. Base URL public dùng cho test và tài khoản test; không yêu cầu đưa password/token vào tài liệu hoặc chat.
3. Key/schema sessionStorage đã chốt ở mục 5; cần test malformed schema, identity mismatch, expired token hợp lệ và storage failure trước bàn giao code.
4. Health trước gia hạn đã chốt ở mục 5; kiểm tra thực tế base URL/CORS/response khi có môi trường test. Không dùng refresh để probe trước consent.
5. Hạn token và nhiều tab đã chốt ở mục 5: theo exp, không grace period/clock correction, auth riêng từng tab; kiểm thử giới hạn đã nêu ở mục 6.

Khi các mục trên được chốt: trình bày batch file/lệnh cài/kiểm tra cuối cùng → người dùng xác nhận → apply_patch/code → self-review → validation → mở diff. Hiện tài liệu chưa cấp phép tự chọn các nội dung còn thiếu hoặc bắt đầu implementation.
