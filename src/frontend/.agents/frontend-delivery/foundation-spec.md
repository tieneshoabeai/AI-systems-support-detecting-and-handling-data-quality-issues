# Foundation — Interface, quy tắc kỹ thuật và prompt

Ngày: 26/10/2026. Đầu ra: đặc tả để 2 người FE dùng cùng nền tảng. **Chưa triển khai code**. Chính sách phiên/storage/health đã được người dùng duyệt; interface TypeScript dưới đây là thiết kế đề xuất cho batch code, không phải export đang tồn tại. Owner nền tảng FE A; FE B review và là bên tiêu thụ service/session/query boundary.

Đọc cùng [module Auth](modules/01-auth.md), [contract audit và kiểm kê DTO](modules/00-contract-audit.md), [screen flow](screen-flow.md), [shared UI](shared-ui.md), [foundation implementation plan](../foundation/implementation-plan.md).

## 1. Mục tiêu và hiện trạng

Hiện `index.html` → `src/app/main.tsx` → StrictMode → App hiển thị UI khởi động; `layout.tsx` chưa được ghép. Có constants/context/pages/private/pages/public/router và các tầng khác; router/auth/query/client chưa có implementation. `layout.tsx` hiện chưa có caller trong entry đã đọc: giữ làm khung theo yêu cầu, chưa xóa; nhắc lại khi batch ghép layout.

Yarn và dependency đã setup; không cài thêm thư viện trong đợt đặc tả. Không đưa policy riêng vào Axios/component/scene. Foundation phải cung cấp contract đủ rõ để FE B viết module mà không tạo client/provider/storage thứ hai.

## 2. Đặc tả sáu mục

| Mục | Quy định |
|---|---|
| Đầu vào | Cấu hình API công khai, payload theo DTO, sessionStorage đã duyệt, router URL và callback người dùng |
| Điều kiện | Config hợp lệ trước request; session gate trước private action; DTO và response mapper có nguồn; không hardcode server secret |
| Xử lý | Bootstrap → providers → session restoration → route guard → view/hook → service → API client → backend; local repositories/sync là đợt khác |
| Đầu ra | Typed session state, API payload/error, query keys và route/render state; không mock thành công khi contract thiếu |
| Xếp loại | Transport error khác HTTP/API error khác malformed response; anonymous khác bootstrapping/local-limited/awaiting-consent |
| Thứ tự | Identity phiên mới nhất trước cache commit; config trước network; health trước consent; consent trước refresh; ACK trước server success |

## 3. Nguồn DTO và response

Ưu tiên `modules/*/dto/` như người dùng yêu cầu; bảng đầy đủ nằm trong audit. Lineage có response schemas thực ở `lineage/dto/lineage.dto.ts`; các folder auth/users/workspaces/projects/datasets/data-view chủ yếu là request. `password-reset.dto.ts` có request types nhưng không tự tạo route vì file tồn tại.

Response Auth/User/Workspace/Project/Dataset đối chiếu service + schema; records dùng `shared/pagination/cursor-paginated.response.ts`; stats dùng `ColumnStatsResult` trong DataView service. Đây là nguồn static, không giả response schema Swagger đã được publish hoặc API nghiệp vụ đã test.

FE không import trực tiếp Nest/Mongoose hoặc backend config vào bundle. Types ở `src/types/<domain>/`, mapper ở service boundary; `types/api/` chỉ chứa envelope/error dùng chung. Không thêm Zod runtime FE khi chưa duyệt dependency: có thể viết kiểm tra shape tối thiểu bằng code sẵn có; lựa chọn validation implementation chốt trong batch.

## 4. Config và API client đề xuất

### 4.1 Config công khai

Tên biến **đề xuất chờ duyệt cho code**: `VITE_API_BASE_URL`; không đọc/ghi hoặc in nội dung file .env. Model `ApiConfig { baseUrl: string }`. Base URL bao gồm prefix API, không `/docs`; không default ngầm về localhost trong bản deploy. Kiểm tra URL/protocol, không chấp nhận embedded username/password/query/hash. Quy tắc deployment/proxy cụ thể chờ cấu hình môi trường được duyệt.

`src/configs/api.config.ts` đọc `import.meta.env` một nơi; Vite type augmentation ở file declaration riêng khi batch được duyệt. Thiếu/sai config phải báo cấu hình chưa hợp lệ, không rơi sang backend khác. UI khởi động thuần vẫn có thể render mà chưa gọi API; policy block toàn app hay chỉ vùng API cần quyết định trước implementation config.

Không env riêng cho refresh token, MongoDB, JWT secret hoặc queue data. Health timeout 5.000 ms là policy đã chốt; timeout API thường/upload chưa chốt, không áp 5 giây cho tất cả request.

### 4.2 Interface HTTP/error nội bộ

Các mẫu này mô tả contract FE đề xuất, không thay wire schema backend:

```ts
type ApiEnvelope<T> = { success: true; data: T; meta?: Record<string, unknown> };

type AppError = {
  kind: 'network' | 'timeout' | 'http' | 'invalid-response' | 'config' | 'storage';
  message: string;
  status?: number;
  code?: string;
  fieldErrors?: Record<string, string[]>;
};

type RequestOptions = {
  auth: 'public' | 'session';
  signal?: AbortSignal;
};

type SessionSnapshot = {
  accountId: string;
  generation: number;
};

type TokenReader = () => string | null;
```

Không trả URL/token/raw Axios config trong AppError để UI log vô tình lộ dữ liệu. `fieldErrors` chỉ map được khi source message có field/message rõ; các lỗi khác giữ ở form/global error, không gán đoán cho password/name. Service trả T hoặc ném AppError đã chuẩn hóa; không lẫn vừa Result union vừa exception trong cùng boundary.

- `lib/api-client.ts`: Axios instance dùng baseUrl; bearer lấy qua TokenReader chỉ với request auth=session và đúng API origin. Public login/register/health/refresh không tự gắn bearer cũ; refresh secret chỉ trong body theo contract và sau consent.
- Service gọi relative endpoint đã kiểm kê; không nhận URL tùy ý từ form. JSON success unwrap envelope đúng một lần; T có `data` nghiệp vụ vẫn giữ nguyên. Binary Export tương lai có transport boundary riêng, chưa viết generic unwrap cho nó.
- Interceptor không import React/AuthContext/router, không mở dialog, không refresh hoặc retry ghi. Auth coordinator được inject các port/service cần thiết ở app composition, tránh circular dependency lib → provider → service → lib.
- 401 không luôn expired; chuyển error cho coordinator phân loại theo token/session context, không gọi refresh trên login sai. 403 là từ chối quyền; không coi outage để mở thao tác cục bộ rộng hơn.
- RequestOptions.signal để hook/query hủy request; abort không bảo đảm mutation chưa commit. Không hiển thị cancel transport là server đã hủy.

## 5. Session contract đề xuất và luồng đã chốt

```ts
type StoredSession = {
  schemaVersion: 1;
  accessToken: string;
  refreshToken: string;
  accountId: string;
};

type SessionPhase =
  | 'bootstrapping'
  | 'anonymous'
  | 'authenticated'
  | 'local-limited'
  | 'checking-health'
  | 'awaiting-consent'
  | 'refreshing';

type SessionView = {
  phase: SessionPhase;
  accountId: string | null;
  generation: number;
};

type AuthPort = {
  getSnapshot(): SessionView;
  restore(): Promise<void>;
  signIn(input: LoginInput): Promise<void>;
  signOut(): Promise<void>;
  confirmRenewal(accepted: boolean): Promise<void>;
};
```

`LoginInput` bám LoginDto, không tự thêm role. Các port là dự kiến; user profile được query qua users service, token không nằm trong public context mà component tùy ý đọc. FE B dùng state/callback/gate, không đọc sessionStorage trực tiếp. session generation tăng khi đổi/kết thúc phiên; response commit kiểm tra generation + account + resource còn đúng.

Chính sách bắt buộc:

1. Key `data-quality.auth.v1`, đúng StoredSession; parse/shape/schema/exp/identity sai → clear riêng phiên, login, giữ draft. accountId khớp sub chỉ là consistency, không xác minh chữ ký.
2. `Date.now() >= exp * 1000` là hết hạn, không grace/clock correction; kiểm ở action/timer/focus. Thiếu exp hợp lệ là phiên lỗi; expired nhưng exp hợp lệ đi flow gia hạn.
3. Reload còn hạn → me query. Me ACK hợp lệ → authenticated; me network/BE outage → local-limited; không xem 401/403 là outage hoặc dùng role cache để vượt quyền.
4. Expired → khóa nghiệp vụ, một health flow/tab, không bearer, timeout 5 giây; HTTP/payload hợp lệ + MongoDB connected mới hỏi consent. Neo4j disconnected không tự chặn auth.
5. Đồng ý → một refresh/tab. Response access token mới phải đúng account; giữ refresh token cũ theo source. Fail/reject/từ chối → clear credential/cache, login; giữ draft.
6. local-limited chỉ cho whitelist đã duyệt khi token còn hạn. Hiện storage/replay chưa triển khai, không mở nghiệp vụ giả để demo.
7. Mỗi tab auth riêng; không thêm BroadcastChannel logout. Queue lock multi-tab thuộc sync sau.

## 6. Query, router và error boundaries

Query keys đề xuất là tuple có namespace và account/resource identity:

```ts
['users', accountId, 'me']
['workspaces', accountId, 'list']
['workspaces', accountId, workspaceId, 'detail']
['projects', accountId, workspaceId, 'list']
['projects', accountId, projectId, 'detail']
['datasets', accountId, projectId, 'by-project']
['datasets', accountId, datasetId, 'records', { limit }]
['datasets', accountId, datasetId, 'stats', columnName]
```

Records infinite-query đặt cursor ở pageParam, không nhân vô hạn cache key mỗi trang nếu dùng chung chain. Chọn query strategy cụ thể ở batch grid, không kết hợp hai mô hình khác nhau giữa hai người.

Query/mutation mặc định không retry ngầm trong foundation; quyết định retry GET sau này cần được ghi rõ, mutation replay chỉ sync coordinator sau gate. Health/refresh không retry tự động. Refetch on focus không được bypass auth check hoặc refresh âm thầm. Khi logout/đổi account: cancel/clear query phạm vi cũ; mutation in-flight không tuyên bố đã hủy server.

Router khai báo explicit ở `app/router/`, không tự copy file-glob routing của SGOD. Provider composition đề xuất: main → QueryClientProvider → AuthProvider → BrowserRouter → App routes; coordinator không cần useNavigate trong lib, redirect do route state/guard. StrictMode phải không tạo hai dialog/refresh cùng sự kiện.

Protected guard: bootstrapping/checking-health/refreshing/consent không render children nghiệp vụ; anonymous → login; authenticated → app shell; local-limited → shell giới hạn chỉ feature đã hỗ trợ local. Public-only guard không đưa vào private chỉ vì storage có token chưa kiểm tra. Error boundary UI không thay AppError nghiệp vụ; lỗi render 3D không làm mất form/bảng DOM.

## 7. Hợp đồng bàn giao và file dự kiến

FE A sở hữu app/router/context, lib client/query, config và auth cùng shared DTO batch. FE B review contract và sau đó dùng services/hooks theo domain; không tạo provider/client thứ hai. Routes/constants/context hiện có dùng đúng vị trí đã duyệt; không tạo thêm app/providers song song khi chưa cần.

File dự kiến: `src/configs/api.config.ts`, `src/types/api/`, `src/types/auth/`, `src/lib/api-client.ts`, `src/lib/query-client.ts`, `src/app/context/`, `src/app/router/`, guard/layout dưới app theo batch file được duyệt, services auth/users/health, tests dưới `src/__tests__/foundation/`. Không tạo file này trong đợt tài liệu.

Interface changes phải báo owner/reviewer và cập nhật ví dụ caller trong plan trước merge. BE DTO/source schema thay đổi thì ghi audit delta; không để service của hai người dùng hai casing/envelope khác nhau.

## 8. Test case dự kiến

| Mã | Nhóm | Input/sự kiện | Kết quả mong đợi | Lý do |
|---|---|---|---|---|
| F01 | Thường | Response envelope success chứa T có data riêng | Unwrap một lần, không mất data nghiệp vụ | Boundary |
| F02 | Không hợp lệ | Missing/invalid API config | Không gửi backend khác, lỗi config rõ; mức block app chờ xác nhận | Config |
| F03 | Thường | Session còn hạn, me ACK | authenticated đúng account | Bootstrap |
| F04 | Biên | now đúng exp | Dừng trước action, health flow | Expiry |
| F05 | Không hợp lệ | Storage corrupt/sub mismatch | Clear phiên/login; giữ draft | Storage |
| F06 | Đặc biệt | 5 request expired đồng thời + StrictMode | Một health/dialog/refresh mỗi tab | Concurrency |
| F07 | Đặc biệt | Health đạt, người dùng từ chối | Không refresh, clear phiên/login | Consent |
| F08 | Đặc biệt | Mongo disconnected/timeout 5 giây | Login, không giả auth thành công | Availability |
| F09 | Không hợp lệ | 401 login hoặc 403 resource | Không auto-refresh/outage fallback | Error source |
| F10 | Đặc biệt | Request A về sau login B | Không commit cache/session B | Identity |
| F11 | Đặc biệt | Mutation timeout | Không retry ghi; kết quả chưa rõ | Side effect |
| F12 | Không hợp lệ | Malformed success body | invalid-response, không user/resource giả | Runtime boundary |
| F13 | Đặc biệt | Public health/login request | Không gắn bearer cũ | Credential scope |
| F14 | Đặc biệt | Abort/duplicate tab/logout | Không hứa revoke/cancel server ngoài ACK | Semantics |
| F15 | Biên | False/0/null trong T | Giữ giá trị, không truthy fallback | Type fidelity |
| F16 | Đặc biệt | ForgotPasswordDto có nhưng không có route | Không sinh endpoint/page hoạt động | DTO ≠ capability |

Các case trên chưa thực thi. Biên numeric/time áp dụng exp, dữ liệu mảng thuộc module grid/sessions; không ép NaN làm login password. Contract/UX pending không có expected business tự đặt.

## 9. Pseudocode và dò tay

```text
bootstrap:
  restore session schema
  NẾU không có/không hợp lệ: anonymous; DỪNG
  NẾU expired: join expiry flow; DỪNG
  capture generation; GET me
  NẾU identity thay đổi: bỏ response
  NẾU ACK shape đúng: authenticated
  NẾU network/BE outage và token vẫn còn hạn: local-limited
  NGƯỢC LẠI: xử lý denied/rejected, không cấp local quyền giả
expiry flow:
  chặn nghiệp vụ; public health 5 giây
  NẾU không đạt: clear/login; DỪNG
  hỏi consent; NẾU từ chối: clear/login; DỪNG
  refresh một lần; ACK identity đúng mới persist và resume read flow
```

Dò tay thường: T có `{ data: { x: 0 } }` sau envelope → service vẫn nhận T.data.x=0. Dò tay biên: now=exp, 3 callers → cùng flow, từ chối → không caller nào refresh. Đây là kiểm tra logic trên giấy, chưa chạy FE.

## 10. Prompt triển khai chi tiết

```text
CONTEXT
Bạn làm foundation cho nhóm 2 người FE. React 19.3.1, TypeScript 6.0.3, Vite 8, Yarn 1.22.22; React Router/Axios/TanStack Query và Vitest/Testing Library/jsdom đã cài. Entry src/app/main.tsx; source hiện chỉ có UI khởi động. Đọc foundation-spec.md, screen-flow.md, shared-ui.md và modules/00-contract-audit.md trước sửa.

TASK
Chỉ triển khai batch Foundation được người dùng duyệt: config/types/client trước, session/provider/router sau, login và consent theo batch riêng nếu cần. Không triển khai 9 module, 3D, Dexie/replay hoặc BE. Xác nhận danh sách file và interface trước code.

INPUT
Request schemas đọc từ backend modules/*/dto; Lineage response từ lineage.dto.ts. Các response chưa có DTO đọc service/schema và dùng fixture được xác nhận. API envelope/error theo audit. StoredSession và policy exp/health/consent ở mục 5. Thiếu API config/fixture thì hỏi, không đọc .env.

CONSTRAINTS
Một API client, một QueryClient, một coordinator/tab. Lib không import React/router/provider. Public request không bearer; không tự refresh hoặc mutation retry. Mapper không invent field hoặc unwrap lặp. Không log token/password/raw credential response; không thay library/toolchain ngoài batch. generation/account/resource kiểm tra trước state commit.

PSEUDOCODE
Theo mục 9 và module Auth. Read operation chỉ resume sau phiên hợp lệ; mutation không được replay tự động. Health thành công không chứng minh quyền hoặc BE write đã sẵn sàng.

EXAMPLES
Reload còn hạn → me ACK → authenticated → protected route; login 401 → lỗi form, không health/refresh. Đúng thời điểm exp → health đạt → từ chối → login, không refresh. Response success có data nghiệp vụ lồng bên trong → chỉ unwrap envelope một lần.

OUTPUT
Patch/edit tích hợp cho đúng file đã duyệt; nêu code trọng tâm, caller và flow. Mở review diff. Báo riêng build/lint, automated test, browser/API thật và chưa thực thi. Giả định chưa duyệt phải liệt kê; không coi chúng là requirements.

CRITERIA
F01–F16 liên quan batch và Auth cases phải được kiểm tra; không tạo passing test rỗng. Chưa được duyệt UX pending hoặc base URL không có thì không tự chọn để tích hợp. Giữ code người dùng và phạm vi người thứ hai.
```

## 11. Gate và log

Đã chốt: Yarn, sessionStorage schema, exp, health 5 giây, consent, auth riêng từng tab, layered architecture. Chờ duyệt trước code: config name/mode/failure presentation, exact file/interface exports của batch, ordinary-request/upload timeout, response fixtures/instance alignment và UX pending ở screen/shared UI. Không tự thêm retry constants, token encryption hoặc proxy.

Log 1–5: mục 1/2–7/8/9/10. Bước 6 mã AI, bước 7 test/runtime foundation, bước 8 chấp nhận code: chưa thực hiện. File này là đặc tả/prompt, không phải source hoặc bằng chứng feature đã tích hợp.
