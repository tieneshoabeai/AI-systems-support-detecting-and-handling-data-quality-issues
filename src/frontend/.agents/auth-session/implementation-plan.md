# AuthProvider + session coordinator — Đặc tả, test và prompt v2

Ngày: 28/10/2026. Ngôn ngữ giải thích: tiếng Việt. Bản gốc lập plan auth; cập nhật theo xác nhận bổ sung và triển khai IndexedDB file upload + metadata tại mục 12. Không coi toàn bộ coordinator/provider/UI đã implement chỉ vì repository draft đã có. Các policy đã xác nhận và gate được phân biệt bên dưới.

## 1. Yêu cầu và bằng chứng hiện tại

Người dùng cần luồng đăng nhập thực, phục hồi phiên, gia hạn có consent và đăng xuất trong ứng dụng React. Coordinator sở hữu quyết định về phiên; AuthProvider đưa snapshot/callback an toàn vào React; router/guard/dialog/login UI sử dụng chúng. Mục tiêu là không mở nghiệp vụ khi phiên chưa đủ điều kiện, không refresh âm thầm và không commit response của account cũ.

Nguồn cần đọc cùng:

- [Handoff](../handoff/context.md), [Foundation](../frontend-delivery/foundation-spec.md), [foundation plan](../foundation/implementation-plan.md).
- [Screen flow](../frontend-delivery/screen-flow.md), [Shared UI](../frontend-delivery/shared-ui.md), [Auth](../frontend-delivery/modules/01-auth.md).
- [Brand guidelines](../brand/brand-guidelines.md).
- [Skill đặc tả/prompt/test](../skills/dac-ta-prompt-test/SKILL.md).

Source FE đã có `createAuthService().login/refresh/logout`, `createUsersService().getMe`, `createHealthService().check`, API config/client/error và session-storage. Batch mục 13 thêm coordinator/app-runtime nối DraftAccessPort; batch mục 14 đã ghép AuthProvider, QueryClient, timer/focus, router/guard, login/dialog và shell vào entry. `layout.tsx` hiện có caller ở route workspaces; không xóa file này như mã thừa.

Source backend: login trả user.id và token; me trả document có `_id`; refresh trả access token và expires_in, không rotate refresh token; logout dùng bearer. Service FE đã map/validate các boundary này. Kết quả lịch sử batch service: 161 test mô phỏng pass, lint/build đạt; không phải kết quả chạy lại trong lượt tài liệu hoặc bằng chứng browser/API thật.

## 2. Quyết định đã xác nhận

### 2.1 User và phiên

1. **Phương án 2:** sau login dùng user từ response login, không gọi thêm me. Sau reload và refresh phải gọi me, đúng account và `status: active` mới mở nghiệp vụ online.
2. Không bịa status/avatar cho user login. Model phân biệt nguồn `login` và `profile`; chỉ nhánh profile có CurrentUser đầy đủ.
3. Me trả 403, 404 hoặc payload sai: kết thúc phiên FE và báo lỗi tương ứng, không local-limited. Me sai account/blocked không được authenticated. Me 401 là phiên bị từ chối, không refresh tự động chỉ vì status 401.
4. Hết hạn tại `now >= exp * 1000`; không grace period/clock correction. Login/refresh response có token đã hết hạn không đủ điều kiện mở nghiệp vụ.
5. Expired → chặn nghiệp vụ → public health timeout 5 giây → MongoDB connected mới hỏi consent → đồng ý mới refresh. Neo4j disconnected không tự chặn auth.
6. Một flow health/consent/refresh trong mỗi tab; không đồng bộ login/logout đa tab. Refresh giữ refresh token cũ, kiểm tra account và hạn mới trước commit.
7. Logout/từ chối/refresh lỗi: kết thúc phiên FE, xóa access/refresh token, accountId, user/role runtime, cache phiên và return target cũ. Giữ draft IndexedDB theo mục 12 nhưng không đọc/render ở public route. Response cũ không được ghi lại dữ liệu sau cleanup. Lỗi clear storage phải báo, không khẳng định sạch khi xóa thất bại.
8. Token còn hạn, me network/timeout/5xx khi reload: local-limited theo Foundation, không dùng như quyền online hoặc tự cho action local chưa implement.

### 2.2 Điều hướng

- `/auth/login` trực tiếp → login thành công → `/workspaces`.
- Private URL khi anonymous: lưu return target nội bộ hợp lệ → login → quay lại target sau login thành công.
- Chỉ nhận route nội bộ đã khai báo; loại URL ngoài, route lạ, login URL và vòng redirect. Fallback `/workspaces`. Tại batch này private route thực chỉ có `/workspaces`; không dựng route nghiệp vụ giả để minh họa deep link.
- Return target không chứng minh quyền/account của tài nguyên; route đích vẫn phải xử lý permission/403/404. Không cache hoặc render dữ liệu account cũ theo target.
- Gia hạn cùng account thành công: giữ URL hiện tại. Logout chủ động: xóa target phiên cũ. Router sở hữu location/redirect; coordinator không import router hoặc gọi navigate.
- `/workspaces` là protected shell kiểm tra phiên, không danh sách workspace giả. Root chờ bootstrap rồi chọn login/shell; fallback not-found không tự tải tài nguyên private.

### 2.3 Dialog gia hạn

| Sự kiện | Hành vi đã chốt |
|---|---|
| Chờ lựa chọn | Hai nút **Tiếp tục phiên** và **Hủy** |
| Hủy hoặc Escape khi chờ | Từ chối gia hạn, không refresh, kết thúc phiên FE và về login |
| Click backdrop | Không đóng, không phát quyết định |
| Đang refresh/xác minh me | Khóa hai nút; Escape/backdrop không đóng; thông báo đang gia hạn |
| Thành công | Đúng account, token còn hạn, me active và lưu phiên đạt mới mở nghiệp vụ |
| Refresh/xác minh thất bại | Kết thúc phiên FE và báo lỗi, không retry ngầm |
| Không lựa chọn | Tiếp tục chặn nghiệp vụ; không tự accept hoặc thêm timeout consent |

“Hủy” là từ chối gia hạn, không có nghĩa hủy request đã đến server. Dialog có accessible name/description, giữ focus; ban đầu focus Hủy. Khi kết thúc phiên, focus chuyển sang login; không trả focus vào cây private đã unmount. Khi tiếp tục thành công, trả focus về trigger còn tồn tại hoặc vùng nội dung phù hợp.

### 2.4 Phạm vi sản phẩm

Ghép coordinator, AuthProvider, QueryClient, router/guard, dialog và login UI trong plan. Bổ sung repository IndexedDB file upload + metadata theo mục 12; chưa thêm delete intent hoặc replay. Không thêm register/SSO/forgot-password/remember-me, backend, 3D hoặc module workspace. Ngoại lệ dependency đã duyệt: fake-indexeddb cho test, cài bằng Yarn; không đổi toolchain. Áp dụng brand xanh `#00A878`, đỏ `#DC2626`, nền `#F6F8F7`, chữ `#202A29`; token tương phản cần kiểm chứng.

## 3. Đặc tả sáu mục

| Mục | Quy định |
|---|---|
| Đầu vào | LoginRequestDto, StoredSession từ storage port, service ports, clock, lifecycle/focus/visibility, consent boolean, router location và cache cleanup port |
| Điều kiện | Runtime schema hợp lệ; account khớp sub; token còn hạn tại thời điểm commit; response thuộc generation hiện tại; profile active khi flow yêu cầu me |
| Xử lý | Restore/signIn → identity/expiry → state; expired → health/consent/refresh/me; signOut → khóa và cleanup; mọi commit kiểm tra generation/account |
| Đầu ra | Snapshot immutable cho UI, actions, lỗi chuẩn hóa và trạng thái cleanup/revoke; không credential trong public context |
| Xếp loại | Phase ở mục 4; lỗi mạng/timeout/5xx khác HTTP từ chối và malformed response; user login khác profile; revoke server khác logout FE |
| Thứ tự | Invalidate công việc cũ trước mở account mới; health trước consent; consent trước refresh; kiểm identity/hạn trước storage; storage đạt trước authenticated; cache cũ không được commit lại |

Không im lặng đổi error thành thành công. Storage read/write/remove lỗi: khóa runtime, báo lỗi rõ, không fallback localStorage/memory để giả persist thành công; clear lỗi thì không hứa credential đã bị xóa khỏi trình duyệt.

## 4. Thiết kế kỹ thuật đề xuất

```text
main → QueryClientProvider → AuthProvider → BrowserRouter → routes
                              ↓
                       Session coordinator
                 storage / auth / users / health / clock
                              ↓
                       API client hiện có
```

Đề xuất một coordinator ổn định cho mỗi app/tab; không singleton có tác dụng phụ ngay khi import. Coordinator độc lập React, inject dependency để test. Composition tạo client/coordinator và nối port, tránh vòng lib → React → service → lib. Query cache không retry ngầm; focus refetch không bypass gate.

Phase dự kiến: bootstrapping, anonymous, signing-in, authenticated, local-limited, checking-health, awaiting-consent, refreshing, signing-out. Snapshot chứa phase/accountId/generation, user theo nguồn, error an toàn; không token/password/raw response. Giữ union để trạng thái chờ/anonymous không vô tình mang user private.

API nội bộ đề xuất: `getSnapshot`, `subscribe`, `restore`, `signIn`, `signOut`, `confirmRenewal`, `checkSession`, `dispose`. Provider subscribe qua cơ chế external store phù hợp React, dùng snapshot ổn định; `useAuth` báo lỗi rõ khi thiếu provider. Không để context hook và provider trộn export gây Fast Refresh lỗi.

### Race và lifecycle

- Dùng generation/operation identity cho mỗi lượt login, logout và refresh. Kiểm tra cả generation/account/phiên được chụp trước commit, không chỉ so accountId: login lại cùng account cũng là phiên mới.
- Abort chỉ giảm request thừa; stale-result check mới ngăn commit. Abort không chứng minh server chưa tạo/revoke session.
- Logout phải gửi bằng credential của phiên cũ đã chụp trước cleanup; không đọc token account B vào request revoke A. Response logout A không được clear phiên B. Cần giải pháp binding credential ở composition, không bypass auth mode tùy tiện.
- StrictMode setup/cleanup/setup không nhân timer/listener/health/refresh; không tái sử dụng coordinator đã dispose vĩnh viễn. Xác định rõ start/stop/dispose và ownership khi triển khai.
- Timer tính theo exp; có xử lý giới hạn delay timer và tab ngủ. Kiểm tra lại clock trước action, khi timer chạy và focus/visibility; cleanup khi unmount.

### Gate private request và cache

Guard chỉ chặn render, không đủ chặn request. Đề xuất runtime cấp ApiClient có session gate cho feature service; raw client chỉ dùng nội bộ bootstrap/refresh/me/logout để không deadlock. Axios transport vẫn không chứa React, consent, refresh hoặc retry.

Gate kiểm tra phase/expiry trước transport; blocked action không tự replay sau refresh. Snapshot/generation phải theo response tới consumer/cache; consumer không được commit account cũ. Cancel/clear query cũ khi kết thúc/đổi phiên; query key có accountId. Không tuyên bố mọi service caller tương lai tự an toàn nếu không dùng boundary được cấp.

### UI tối thiểu

Login: email/password có label, hiện/ẩn password, pending chặn submit lặp, lỗi form/field chỉ khi có dữ liệu field thực. Không sửa/trim password. Login thành công dùng LoginResult.user và token exp; không gọi me. Không lưu password vào storage/query/log hoặc context; xóa input credential khi unmount.

Guard chờ bootstrap/health/consent/refresh không render private children. Anonymous → login; authenticated → shell; local-limited → thông báo giới hạn và logout, không dữ liệu/permission giả. Public-only guard không mở private chỉ vì storage có token chưa xác minh. Error config không làm UI crash: hiện lỗi vùng auth, không fallback server khác.

## 5. File dự kiến, tính từ frontend root

Danh sách là implementation plan, chưa phải source đã tạo. Nếu cần thêm file/đổi interface ngoài danh sách phải báo trước.

| File | Trách nhiệm |
|---|---|
| `src/types/auth/session-coordinator.types.ts` | Phase/snapshot/actions/dependency ports, user union theo nguồn |
| `src/services/auth/session-coordinator.ts` | Điều phối phiên không phụ thuộc React/router |
| `src/services/auth/session-api-client.ts` | Gate private API, bảo vệ response stale; không refresh/replay tự động |
| `src/app/context/auth-context.ts` | Context contract không token |
| `src/app/context/auth-provider.tsx` | Subscription, lifecycle, timer/focus/visibility |
| `src/hooks/auth/use-auth.ts` | Consumer hook |
| `src/hooks/auth/use-login.ts` | Form flow/pending/error, gọi coordinator |
| `src/lib/query-client.ts` | QueryClient factory, policy retry/cache phiên |
| `src/app/app-runtime.ts` | Composition ports/client/coordinator, credential binding logout |
| `src/app/app-providers.tsx` | Ghép QueryClient/AuthProvider/Router |
| `src/app/router/app-router.tsx` | Root/login/workspaces/not-found và return target validation |
| `src/app/router/return-target.ts` | Helper thuần validate registry URL, không export helper từ module React |
| `src/app/guards/protected-route.tsx` | Session gate cho render |
| `src/app/guards/public-only-route.tsx` | Public route theo phase |
| `src/app/layout.tsx` | Ghép shell có thật, logout/trạng thái kết nối, không workspace fake |
| `src/views/auth/login.view.tsx` | Form theo brand, không gọi API trực tiếp |
| `src/components/auth/session-renewal-dialog.tsx` | Consent/pending/focus/Escape/backdrop, chỉ callback |
| `src/app/design-tokens.css` | Token dùng chung có kiểm tra tương phản |
| `src/app/style.css` | Login/dialog/shell responsive, reduced motion |
| `src/app/App.tsx`, `src/app/main.tsx` | Ghép runtime/providers/routes; giữ entry trong app |
| `src/__tests__/auth/session-coordinator.test.ts` | State/race/storage/expiry |
| `src/__tests__/auth/auth-provider.test.tsx` | Ca dự kiến; thực tế gộp lifecycle/StrictMode vào auth-flow.test.tsx, không tạo test trùng |
| `src/__tests__/auth/session-api-client.test.ts` | Private gate/response stale |
| `src/__tests__/auth/auth-flow.test.tsx` | Login/router/dialog/cache integration |
| `src/__tests__/foundation/startup.test.tsx` | Cập nhật kỳ vọng startup theo app mới, giữ ca thiếu config |

Giữ service/types/login đã có trừ khi review chỉ ra thay đổi cần thiết và được xác nhận. Không đổi package/lockfile, không khôi phục root App mẫu. Asset/font mới và cập nhật tài liệu khác ngoài plan này cần phạm vi được duyệt.

## 6. Test case — viết trước source

| Mã | Nhóm | Input/sự kiện | Expected | Lý do |
|---|---|---|---|---|
| A01 | Thường | Storage empty | Anonymous, không private request | Bootstrap |
| A02 | Thường | Token còn hạn, me đúng account/active | Authenticated với profile | Restore |
| A03 | Thường | Login ACK hợp lệ | Dùng user login, persist rồi authenticated; không me | Phương án 2 |
| A04 | Biên | now = exp − 1 ms / exp / exp + 1 ms | Còn hạn / hết hạn / hết hạn | Không grace |
| A05 | Biên | Me response về sau exp | Không mở nghiệp vụ với token cũ; expiry flow | Thời gian chờ |
| A06 | Không hợp lệ | Corrupt/schema/sub sai | Clear riêng key, anonymous, không fake user | Identity |
| A07 | Không hợp lệ | Me 401/403/404/malformed | Kết thúc phiên, lỗi tương ứng, không outage | Policy |
| A08 | Không hợp lệ | Me account khác hoặc blocked | Không authenticated; kết thúc phiên | Cross-account |
| A09 | Đặc biệt | Reload me network/timeout/5xx, token còn hạn | Local-limited, không online/local action giả | Outage |
| A10 | Đặc biệt | Như A09 nhưng token đã hết hạn | Không local-limited, expiry flow | Biên lỗi |
| A11 | Đặc biệt | Nhiều caller phát hiện expired | Một health/consent/refresh flow/tab | Single flight |
| A12 | Thường | Health Mongo connected, Neo4j disconnected | Awaiting-consent, chưa refresh | Contract health |
| A13 | Không hợp lệ | Mongo disconnected/health timeout/HTTP/payload lỗi | Kết thúc phiên, không consent/refresh | Không giả khả dụng |
| A14 | Thường | Accept, refresh đúng account/còn hạn, me active | Giữ refresh token cũ, persist rồi resume | Gia hạn |
| A15 | Không hợp lệ | Refresh malformed/sai account/expired/network/HTTP | Kết thúc phiên, không retry | Boundary |
| A16 | Không hợp lệ | Refresh ACK rồi me lỗi/blocked/sai account | Kết thúc phiên, không mở nghiệp vụ | Xác minh sau refresh |
| A17 | Đặc biệt | Hủy hoặc Escape khi chờ | Không refresh, cleanup, login | Consent |
| A18 | Đặc biệt | Backdrop khi chờ | Vẫn chờ, không callback | Tránh click nhầm |
| A19 | Đặc biệt | Double accept / Escape/backdrop pending | Một refresh; pending không đóng | Concurrency UI |
| A20 | Không hợp lệ | Storage read/write/remove lỗi | Khóa runtime, lỗi rõ, không báo persist/clear thành công | Không silent failure |
| A21 | Đặc biệt | Logout A/login B, response A về sau | Không state/storage/cache commit A lên B | Race |
| A22 | Đặc biệt | Login cùng account hai lần, thứ tự response đảo | Chỉ operation hiện tại commit | AccountId chưa đủ |
| A23 | Đặc biệt | Logout request lỗi | FE kết thúc theo cleanup; revoke chưa xác nhận | Semantics |
| A24 | Đặc biệt | Token expired trước logout | Không refresh chỉ để logout; báo giới hạn revoke | Bearer hết hạn |
| A25 | Đặc biệt | Tab ngủ/focus/visibility | Recheck exp; không nhân listener | Lifecycle |
| A26 | Đặc biệt | StrictMode mount/cleanup/remount | Không coordinator chết, duplicate flow hoặc rò timer | React |
| A27 | Đặc biệt | Login 401/resource 403 | Không tự refresh/outage; 403 resource không tự xóa phiên | Error context |
| A28 | Đặc biệt | Gate trong bootstrap/consent/refresh | Private transport không chạy, mutation không replay | Gate |
| A29 | Đặc biệt | Response/query A về sau switch B | B không nhìn thấy/commit dữ liệu A | Cache |
| A30 | Thường | Login trực tiếp | /workspaces shell, không workspace API fake | Entry |
| A31 | Thường | Target private hợp lệ trong route registry | Sau login quay target, quyền vẫn kiểm riêng | Return target |
| A32 | Không hợp lệ | External/protocol-relative/login/unknown target | Fallback /workspaces, không loop | Redirect |
| A33 | Đặc biệt | Logout chủ động | Xóa target cũ | Navigation |
| A34 | Đặc biệt | Refresh thành công ở route hiện tại | Giữ URL, không replay mutation | Context |
| A35 | Đặc biệt | Tab/Shift+Tab/Escape, pending announcement | Focus trap, ban đầu Hủy, focus login khi kết thúc | Accessibility |
| A36 | Biên | Màn hẹp/zoom/text dài/reduced motion | Form/dialog thao tác được, không tràn ngang | UI |
| A37 | Không hợp lệ | Config thiếu/sai | Lỗi auth rõ, không crash/fallback server | Startup |
| A38 | Đặc biệt | Inspect context/error/log/query | Không credential/raw response | Privacy |
| A39 | Thường | Password chứa khoảng trắng | Gửi nguyên password, không normalize | Input |
| A40 | Đặc biệt | Dispose với request pending | Không commit stale, cleanup subscription/timer | Teardown |

A31 chỉ dùng route registry thực; không thêm feature route cho test. Array/số học không liên quan được bỏ qua; biên tập trung thời gian, input và concurrency. A36 cần browser/visual test ngoài jsdom. Không hứa integration thật khi chưa có môi trường/test account được phép.

## 7. Pseudocode và dò tay

```text
RESTORE
  capture operation/generation; block private work
  read storage; error → locked runtime + observable error
  empty/invalid → anonymous; expired → join EXPIRY
  valid → GET me
  response stale → discard
  expired now → join EXPIRY
  identity correct + active → authenticated(profile)
  network/timeout/5xx + still valid → local-limited
  other errors → END SESSION

SIGN IN
  invalidate old operations; block old private work/cache
  call login without altering password
  stale response → discard
  validate account/exp; persist approved session
  storage failure → block + error; never authenticated
  authenticated(login user); router consumes validated return target
  do not GET me

EXPIRY
  join existing flow if present; otherwise create one owner
  block work; public health 5 seconds
  stale → discard; unavailable/error → END SESSION
  awaiting-consent; no automatic acceptance
  Hủy/Escape → END SESSION; backdrop → no change
  accept once → refreshing; call refresh
  validate generation/account/exp; keep old refresh token
  GET me using candidate access token bound internally, not old expired token
  validate active/account/current operation and exp again
  persist session; authenticated(profile); preserve URL
  any failure → END SESSION

SIGN OUT / END SESSION
  capture old session for revoke where applicable
  invalidate old operations; block UI/private requests; cancel/clear old cache
  explicit logout: attempt revoke with captured old credential, no renewal
  clear only credential key; handle failure visibly
  anonymous/locked error state; router goes login; explicit logout clears target
  old revoke result cannot clear a newer session
```

Dò tay thường A03: login trả account A/token còn hạn → generation hiện tại → storage write đạt → user nguồn login → authenticated → target hợp lệ hoặc workspaces; số request me = 0.

Dò tay biên A04/A11/A17: now đúng exp, ba caller → một health → một awaiting-consent → Escape tương đương Hủy → clear/cache cleanup → login; số refresh = 0. Đây là dò tay đặc tả, không kết quả chạy test.

## 8. Trình tự implementation và validation

1. Review gate mục 10, exact interfaces/file list và xác nhận batch source cuối cùng.
2. Viết test coordinator/gate trước, dùng fake clock và deferred promises; không ghi secret thật.
3. Implement coordinator, session API gate và runtime composition; không mở rộng Axios thành coordinator.
4. QueryClient/AuthProvider/useAuth và lifecycle; test StrictMode/race/cache.
5. Router/guards/return-target, login hook/view, dialog và shell; dùng policy đã chốt ở mục 2.
6. Tokens/style có contrast checks; kiểm bàn phím, màn hẹp, zoom và reduced motion; không cắt board làm UI.
7. Self-review scope, errors, stale commits, storage failure, credential binding và dependency cycles.
8. Chạy Yarn test/lint/build, diff check; nếu formatter/build sửa thêm file phải báo. Không đổi lockfile. Build có thể nạp env theo Vite, không đọc/in nội dung env.
9. Browser/API integration khi có môi trường/tài khoản được phép. Tách kết quả mock/jsdom/build/browser/API thật. Không yêu cầu gửi password/token vào chat.
10. Mở review diff trong Codex, giải thích code trọng tâm/chức năng/caller/lỗi; không tự commit/reset/revert.

## 9. Prompt triển khai v2

```text
CONTEXT
React 19.3.1, TypeScript 6.0.3, Vite 8, Yarn 1.22.22, browser.
Router/Axios/TanStack Query/Vitest/Testing Library/jsdom đã có.
Đọc rules, handoff, brand và .agents/auth-session/implementation-plan.md.
Source service đã có; source App vẫn startup. Không lấy status trong plan cũ
thay cho kiểm tra source. Không đọc/in .env.

TASK
Chỉ sau khi batch source được duyệt: triển khai mục 5 theo thứ tự mục 8.
Coordinator độc lập React; Provider/context/hook; private API gate;
QueryClient; router/guard; dialog, login UI và shell tối thiểu.
Không tạo nghiệp vụ workspace, register, SSO, 3D hoặc backend.
IndexedDB chỉ trong phạm vi file upload + metadata của mục 12.

INPUT
DTO/service/storage/clock ports hiện có, login credentials chỉ trong action.
User nguồn login khác CurrentUser; không tự thêm status/avatar.
Consent boolean; event focus/visibility; validated internal return target.

CONSTRAINTS
Theo mục 2–4: login không me; reload/refresh có me đúng account/active.
Me 403/404/malformed kết thúc phiên; không coi mọi 401/403 là expired/outage.
Expiry now >= exp; health trước consent; consent trước single refresh/tab.
Giữ refresh token cũ. Me sau refresh dùng candidate token đúng phiên.
Generation/operation/account/expiry đúng trước mọi commit.
Không credential trong context/log/query. Logout bind token cũ, không clear B.
Storage lỗi không giả thành công/fallback. Private API và render đều có gate.
Không tự replay mutation/retry; cleanup StrictMode an toàn.
Dialog: Tiếp tục phiên/Hủy; Escape chờ = Hủy; backdrop không đóng;
pending khóa hai nút và Escape. Navigation theo mục 2.2.
Token/color từ brand; font/logo/illustration cần qua gate mục 10.
Không thêm dependency, không sửa code ngoài batch hoặc thay đổi có sẵn.

PSEUDOCODE
Tuân mục 7; không triển khai dựa trên decision còn pending ở mục 10.

EXAMPLES
Login A ACK valid → persist → authenticated(login user), không GET me.
Reload A valid → me active A → authenticated(profile).
now = exp → health đạt → Hủy → login, không refresh.
Refresh A về sau login B → discard, không storage/cache B thay đổi.
Me 404 hoặc malformed → kết thúc phiên, lỗi rõ, không local-limited.

OUTPUT
apply_patch đúng file được duyệt; code trọng tâm + ví dụ caller và lỗi.
Liệt kê giả định đã dùng; không tự tạo requirement từ giả định pending.
Mở review diff. Báo file phát sinh do tool và không tự commit.

CRITERIA
A01–A40 liên quan batch phải đạt; boundary cases không bỏ qua bằng mock rỗng.
Yarn test/lint/build và diff check; browser/a11y/API báo riêng.
Không dùng test service pass để tuyên bố toàn bộ auth runtime đúng.
```

## 10. Gate còn mở, trade-off và giới hạn

Các mục này không thay đổi policy đã xác nhận, nhưng chưa được tự chọn business behavior hoặc asset mới trong source:

1. **Đã chốt login:** chỉ đăng nhập khi chưa có phiên; muốn đổi account phải logout trước. Không switch-account UI. A22 vẫn test response freshness; đăng nhập thất bại không được phục hồi dữ liệu account cũ đã logout.
2. **Đã chốt font/asset:** Plus Jakarta Sans variable và OFL đã tải từ Google Fonts vào `src/assets/fonts/plus-jakarta-sans/`, chưa nối CSS. Logo dùng file có sẵn `src/assets/8DA AI Network Logo.png`, giữ nguyên; không tạo logo mới. Người dùng chưa cần hình minh họa. Không đưa brand board vào bundle.
3. **Thông số UI và interface cuối:** token focus/hover/disabled/contrast, exact runtime ports và cách cấp candidate credential cần được trình bày trong batch code; mọi interface đổi service hiện có phải báo. Không coi màu trắng trên xanh brand mặc định đạt contrast.
4. **Cleanup khi về login:** người dùng yêu cầu login sạch như lần đầu. Khi kết thúc phiên, xóa target/thông tin account cũ, không thêm accountId vào return-target storage. Target mới khi anonymous truy cập private route vẫn phải hợp lệ theo registry; gia hạn thành công cùng phiên giữ URL. IndexedDB giữ file chưa đồng bộ nhưng không phải giữ phiên hoặc quyền cũ.
5. **Môi trường thật:** chưa xác minh API/CORS/runtime config trong batch plan; credentials không đưa vào chat. Không hoàn tất browser/API acceptance bằng fixture.

Coordinator độc lập + ports tăng số file nhưng giúp kiểm chứng race và React lifecycle. Gate client và raw auth client cần composition chặt để không deadlock hoặc tạo vòng import. Logout server lỗi không thể bảo đảm revoke; JWT claim đọc ở FE không xác minh chữ ký/quyền. Repository draft có thể triển khai độc lập nhưng local-limited/UI chỉ hoạt động khi auth runtime thực cấp access port; không tự giả authenticated. Login dùng user có sẵn giảm một request nhưng chưa có profile đầy đủ; không tự bịa field để lấp khoảng trống.

## 11. AI prompting log

| Bước | Trạng thái/nội dung |
|---|---|
| 1. Yêu cầu | Mục 1, tích hợp luồng auth thực và review được |
| 2. Đặc tả | Mục 2–5; policy đã chốt, technical/gate tách riêng |
| 3. Test case | A01–A40, mục 6, chưa thực thi |
| 4. Pseudocode | Mục 7; dò tay A03 và A04/A11/A17 |
| 5. Prompt | v2 mục 9, supersede bản nháp chat v1 cho policy đã xác nhận |
| 6. AI đề xuất mã | Repository/coordinator/runtime/provider/UI có source, xem mục 12–14 |
| 7. Kiểm chứng | Mục 12.7/13/14; UI browser đã xem, chưa login với backend thật |
| 8. Quyết định | Chờ review plan/gate và batch implementation; chưa chấp nhận source |

Các lựa chọn kỹ thuật còn chờ ở mục 10 không dùng làm expected behavior chính thức. Lịch sử implementation/test repository draft được ghi riêng tại mục 12.7; không ghi sẵn kết quả auth hoặc tạo nhật ký phụ ngoài vị trí đã xác nhận.

## 12. Mở rộng đã duyệt: IndexedDB file upload + metadata

### 12.1 Yêu cầu và ràng buộc

Người dùng xác nhận đưa lưu file/draft theo account vào phạm vi hiện tại, chỉ file upload + metadata trước. Khi BE xác nhận upload thành công phải tự xóa draft để giải phóng dung lượng. Không thêm lưu ý định xóa dataset. Không xóa credential đồng nghĩa xóa draft chưa đồng bộ.

| Giới hạn | Giá trị, biên được nhận |
|---|---|
| Mỗi file | `size <= 50 * 1024 * 1024` byte, file phải không rỗng |
| Tổng Blob theo account | Sau ghi `<= 200 * 1024 * 1024` byte |
| Tổng Blob mọi account trong DB ứng dụng | Sau ghi `<= 500 * 1024 * 1024` byte |

Đây là cap ứng dụng cho draft trên trình duyệt/profile/origin này, không phải quota server hay giới hạn tài khoản xuyên thiết bị. Metadata/index overhead vẫn tính vào quota thật của browser; tổng Blob không bảo đảm toàn DB chỉ chiếm đúng số byte đó. `navigator.storage.estimate()` chỉ preflight theo origin; quota/transaction thực có thể lỗi dù preflight đạt. Không tự xóa file pending của account khác khi hết chỗ. Browser/user vẫn có thể xóa dữ liệu, không hứa lưu vĩnh viễn hoặc mã hóa.

### 12.2 Đặc tả sáu mục

| Mục | Quy định |
|---|---|
| Đầu vào | File thật + projectId từ caller đã có context; access port do auth runtime cấp; confirmation hợp lệ từ upload caller |
| Điều kiện | Account đã xác thực, token còn hạn; account/generation vẫn đúng trước commit/return; không chấp nhận accountId từ form để truy cập tùy ý |
| Xử lý | Estimate → kiểm quota trong transaction → ghi Blob và metadata → chỉ resolve khi commit; list/read/remove luôn scope account |
| Đầu ra | UploadDraft metadata; Blob chỉ cho draft pending; lỗi ApiError storage/session; kết quả cleanup phân biệt true/false |
| Xếp loại | pending: chưa có ACK; uploaded: BE đã ACK, chỉ chờ cleanup nếu lỗi; không biến timeout thành ACK hoặc tự reupload |
| Thứ tự | Gate trước đọc/ghi; transaction cùng scope để serialize quota giữa tab; ghi ACK bền trước cleanup; account switch abort transaction đang chạy |

DB `data-quality.upload-drafts.v1`, version 1, hai table `drafts` và `files`, cùng transaction. Metadata: id/accountId/projectId/fileName/mimeType/sizeBytes/lastModified/createdAtMs/status/datasetId khi ACK. Không token/password/role. Blob tách table để list/tính quota không tải mọi file vào memory. Index accountId, accountId+projectId và accountId+status.

### 12.3 Cleanup, timeout và account

- Logout/hết phiên: runtime access port trả null và phát invalidation; repository từ chối đọc/ghi. Không DB.delete hoặc clear các table khi logout.
- B login không đọc/xóa/confirm draft A; A được xác thực lại mới truy cập được. Phân vùng FE không phải mã hóa hoặc ngăn DevTools.
- Confirmation cần đúng draft/account/project, datasetId không rỗng; caller chịu trách nhiệm validate ACK thật trước khi gọi. Gọi hàm này không phải chứng minh backend đã chạy.
- Commit metadata uploaded + datasetId trước, rồi xóa Blob + metadata trong transaction thứ hai. Thành công thì không giữ bản sao; lỗi cleanup trả cleaned=false, record uploaded không được đọc để upload lại. `cleanupUploaded()` chỉ dọn record uploaded của account hiện tại, giữ pending.
- Timeout/mất ACK: giữ pending để chờ đối soát; không gọi confirmUploaded và không tự gửi lại. Nếu ACK journal chưa ghi được thì báo lỗi; không có idempotency contract thì không được suy ra retry an toàn.
- Cleanup bị logout/account switch làm gián đoạn: không dùng phiên B dọn A; lần A đăng nhập lại dọn các record uploaded còn lại. Không tự bật timer retention hoặc TTL cho pending.

### 12.4 File và dependency đã duyệt

- `src/types/datasets/upload-draft.types.ts`: model, access port, confirmation/result.
- `src/configs/upload-draft.config.ts`: cap 50/200/500 MiB tập trung.
- `src/repositories/datasets/upload-draft.database.ts`: Dexie schema; composition sau này chỉ tạo một instance cho app.
- `src/repositories/datasets/upload-draft.repository.ts`: save/list/readFile/remove/confirmUploaded/cleanupUploaded.
- `src/__tests__/auth/upload-draft.repository.test.ts`: test IDB giao thoa auth/account; vị trí test chính thức.
- `fake-indexeddb` dev dependency được người dùng duyệt, cài Yarn và giữ package-lock nguyên trạng. Đây là runtime mô phỏng test, không vào product bundle.

### 12.5 Test cases trước nghiệm thu

| Mã | Nhóm | Ca | Expected |
|---|---|---|---|
| D01 | Thường | Save rồi close/open DB | Blob/metadata còn; chỉ báo saved sau commit |
| D02 | Đặc biệt | Logout rồi login B/A | Anonymous bị chặn; B không thấy A; A mở lại được |
| D03 | Biên | Token đúng exp | Chặn truy cập |
| D04 | Không hợp lệ | File rỗng hoặc >50 MiB | Không ghi |
| D05 | Biên | File =50 MiB, tổng account =200 MiB | Chấp nhận; thêm byte vượt cap bị từ chối |
| D06 | Biên | Tổng app =500 MiB rồi thêm | Từ chối, không lộ metadata account khác |
| D07 | Đặc biệt | Hai connection/tab cùng sát cap | Transaction serialize; không cùng vượt cap |
| D08 | Không hợp lệ | Blob write quota/abort | Rollback metadata, không record mồ côi |
| D09 | Đặc biệt | Estimate thiếu/lỗi hoặc đủ nhưng write fail | Không giả thành công; kết quả theo commit thật |
| D10 | Đặc biệt | Logout lúc estimate/transaction | Không commit/deliver dữ liệu qua account mới |
| D11 | Không hợp lệ | Confirmation sai account/project/dataset | Không cleanup |
| D12 | Thường | ACK hợp lệ | Xóa Blob + metadata |
| D13 | Đặc biệt | ACK journal đạt, cleanup fail | uploaded/cleaned=false; không readFile để reupload |
| D14 | Đặc biệt | Cleanup lại sau login | Chỉ xóa uploaded account hiện tại; pending giữ nguyên |

Pseudocode: gate → capture account/generation → preflight → transaction quota+Blob+metadata → recheck gate → resolve. Cleanup: validate ACK → commit uploaded → transaction xóa file+metadata → nếu storage lỗi thì trả cleanup pending, tuyệt đối không gửi lại file.

Prompt bổ sung cho mục 9: triển khai đúng repository/schema/cap ở mục 12; không backend/upload transport/auto replay, không lưu token. Viết test D01–D14 với fake-indexeddb; race kiểm deferred promise và hai DB connections. Report mock IDB khác browser thực, không tuyên bố server sync đã tích hợp khi chưa có consumer.

### 12.6 Điểm tích hợp chưa hoàn tất

Auth runtime ở mục 13 đã cấp DraftAccessPort từ coordinator và invalidate khi logout/đổi generation; read luôn kiểm tra exp. Timer/focus event đã được Provider ghép tại mục 14. Không cấp access port giả từ accountId nhập tay để demo. View upload cần project context/permission thật, service upload và ACK mapper trước khi gọi confirmUploaded. Backend replay/dedup/reconciliation gate vẫn giữ; chưa tự tạo endpoint hoặc tự gửi khi health phục hồi. Repository/runtime có test không đồng nghĩa người dùng đã có UI upload/sync end-to-end.

### 12.7 Kết quả batch repository, 28/10/2026

- Đã tạo config/types/Dexie database/repository và 18 test IndexedDB mới. Repository chỉ resolve sau commit; lưu lại ACK trước cleanup; không tự upload/replay và không dọn draft pending khi logout.
- Cài `fake-indexeddb@6.2.6` dev dependency theo xác nhận của người dùng; thay đổi package.json/yarn.lock, giữ package-lock.json nguyên trạng. Script test trong manifest là thay đổi có sẵn trước batch, không quy thành thay đổi mới.
- `yarn test`: 6 file, 179/179 pass (161 cũ + 18 mới); `yarn lint`, `yarn build` đạt. Test dùng fake-indexeddb và Node File cho Blob, không phải browser IndexedDB thật. Test cap dùng metadata seed để không cần ghi hàng trăm MiB cho mọi ca; riêng boundary file 50 MiB dùng file thật trong test.
- Đã sửa sau self-review: giữ subscription invalidation đến khi transaction settle; kiểm gate cả trước và sau commit/return; không chỉ kiểm account mà cả generation. Expiry không hữu hạn bị từ chối.
- Chưa ghép AuthProvider/access port thật, chưa có upload view/transport/ACK thật, chưa test browser/quota thiết bị. Các test mô phỏng không chứng minh draft đã hiện trên UI hoặc BE đã nhận file. Auth runtime/consumer vẫn là phần còn lại của plan.
- Không sửa backend, session-storage, auth service hoặc UI; không commit/reset/revert và không xóa thay đổi có sẵn.

## 13. Batch đã triển khai: coordinator + quyền draft từ phiên thật

Người dùng xác nhận bước 1–2: session coordinator và nối IndexedDB theo phiên. Batch này không ghép React/UI, QueryClient thật hoặc tự gửi lại upload.

### 13.1 File và interface thực tế

- `src/types/auth/session-coordinator.types.ts`: snapshot union readonly, user nguồn login/profile, storage/service/cache ports, SignOutResult.
- `src/services/auth/session-coordinator.ts`: restore/signIn/signOut/checkSession/confirmRenewal/getSnapshot/subscribe/draftAccess/dispose.
- `src/app/app-runtime.ts`: factory composition, không có side effect import; khởi tạo client/service/coordinator và một DB/repository. Không được component tạo runtime mới mỗi render.
- `src/__tests__/auth/session-coordinator.test.ts`: 41 ca mới, có integration qua service/Axios adapter mô phỏng và fake-indexeddb.
- Plan này cập nhật trạng thái; không sửa các service API/session-storage/UI có sẵn hoặc dependency/lockfile ở batch coordinator.

`createAppRuntime({ clearSessionCache, client?, storage?, database?, now? })` trả `{ coordinator, drafts, dispose }`. Callback clearSessionCache là port synchronous bắt buộc: invalidation/cancel/clear query sẽ được nối với QueryClient ở batch React sau. Không coi vi.fn port pass là QueryClient thật đã được kiểm chứng.

`bindSession(accessToken)` là port nội bộ, không đưa vào context. Runtime tạo client bound với token đã capture cho me/logout. Me sau refresh dùng candidate token chưa persist. Logout capture client A trước clear; login B trong lúc revoke pending không thay bearer request A và không bị response A xóa state.

### 13.2 State, lỗi và quyền truy cập

- Snapshot không chứa accessToken/refreshToken/password; user/error được copy và freeze. User nguồn login không được thêm status/avatar giả. Snapshot ổn định giữa các lần publish để Provider sau này subscribe.
- DraftAccessPort read chỉ cấp lease account/generation/exp trong authenticated hoặc local-limited, token còn hạn và cleanup không lỗi. Bootstrapping, consent, refresh, logout/dispose trả null; repository subscribe vào thay đổi coordinator để abort transaction stale. Không import React/router từ repository hoặc coordinator.
- `restore()` và `checkSession()` báo lỗi hoạt động qua snapshot; `signIn()` và `confirmRenewal(true)` reject ApiError khi thao tác hiện tại thất bại. Response stale được bỏ, không ghi lại lỗi lên phiên mới. Action không hợp lệ hoặc dùng instance disposed bị từ chối.
- `signOut()` khóa runtime và clear credential/cache ngay, rồi trả `{ serverRevoked, revokeError, cleanupError }`. Revoke lỗi không giữ credential FE. Nếu clear storage/cache lỗi, snapshot có cleanupError và không cho login mới cho tới khi cleanup retry thành công; không fallback memory/localStorage.
- Me 401/403/404 hoặc blocked/mismatch kết thúc phiên ngay cả nếu token vừa hết hạn trong lúc chờ response. Chỉ outage network/timeout/5xx mới được xét token còn hạn để local-limited hoặc vào expiry flow.
- Một health/consent/refresh flow trong instance/tab; login khi đã có phiên hoặc signing-in bị từ chối. generation tăng khi đổi/kết thúc flow để bỏ response cũ, kể cả login lại cùng account.
- `checkSession()` là entry để action/timer/focus kiểm tra hạn. Batch này chưa gắn timer/focus/visibility vào browser. DraftAccessPort tự chặn tại exp dù chưa có Provider gọi checkSession.
- `dispose()` abort/khóa instance, notify repository rồi clear subscriptions; không xóa storage hoặc DB. Instance mới có thể restore. Không tái sử dụng instance disposed trong StrictMode; lifecycle Provider phải được thiết kế/test riêng.

### 13.3 Kiểm chứng và giới hạn

Đây là snapshot khi kết thúc batch coordinator; phần đã ghép tiếp được cập nhật tại mục 14.

- Test cuối: **7 file, 220/220 pass**, gồm 179 ca trước và 41 ca coordinator/runtime mới. `yarn lint`, `yarn build` đạt. Test runtime dùng API adapter và fake-indexeddb, không request backend hoặc browser thật.
- Các ca mới bao gồm bootstrap, consent, exact exp, outage, explicit rejection tại exp, refresh sai identity, storage/cache lỗi, revoke thất bại, stale login/restore/refresh, dispose, draft A/B và logout abort transaction IndexedDB.
- Self-review sửa thứ tự phân loại me error để không biến HTTP từ chối thành flow gia hạn; test regression đi kèm. Sửa kiểu mock/tham số thừa để lint/typecheck đạt; không đổi cấu hình lint/TS để né lỗi.
- App entry chưa gọi runtime; người dùng vẫn thấy startup UI. Provider/QueryClient/router/guard/login/dialog, private API gate cho feature requests, timer/focus và browser/API acceptance là phần còn lại. Chưa khẳng định toàn app đã chặn mọi request hoặc dọn mọi query thật.

## 14. Batch đã triển khai: AuthProvider, timer/focus và giao diện login

### 14.1 Luồng đang render

```text
main.tsx (một QueryClient và runtime/tab)
  → AppProviders → QueryClientProvider → AuthProvider
    → BrowserRouter → AppRouter + SessionRenewalDialog
      → /auth/login: public-only + LoginView/useLogin
      → /workspaces: protected + layout shell
```

Không tạo client/provider trong view. Context chỉ có snapshot/config error/actions, không token hoặc database thô. Config/client khởi tạo lỗi vẫn render login với thông báo và submit disabled; không fallback backend hoặc fake đăng nhập.

Provider dùng useSyncExternalStore, gọi restore, đăng ký focus/pageshow/visibilitychange và timer theo exp. Hidden visibility không kích hoạt check; khi visible kiểm lại. Timer rearm với cap 2_147_483_647 ms để không overflow; cleanup timer/listener khi unmount. Runtime retain/release trì hoãn final dispose qua microtask: StrictMode cleanup/setup cùng turn không phá instance; unmount thật dispose nhưng không xóa credential/draft.

### 14.2 UI, điều hướng và cleanup

- Form email/password native validation, autocomplete, hiện/ẩn password, pending disabled chống submit lặp. Không trim password, không role/status/avatar giả; login không gọi me.
- Public/private guard chờ bootstrap và khóa private children khi health/consent/refresh. Local-limited chỉ thông báo giới hạn, không danh sách workspace hoặc dữ liệu giả. Not-found có link về root; chỉ route registry thật được nhận return target.
- Snapshot thêm `sessionEnded` boolean runtime, không sửa schema sessionStorage: guard dùng để bỏ target cũ khi kết thúc phiên. Khi anonymous truy cập private route mới và chưa mang phiên cũ, return target nội bộ hợp lệ được giữ; login thành công thì navigate và xóa navigation state. Refresh giữ nguyên URL.
- Dialog có Tiếp tục phiên/Hủy; focus ban đầu Hủy, Tab/Shift+Tab/focusin giữ bên trong. Backdrop không đóng; Escape khi chờ tương đương Hủy; pending khóa nút/Escape. Lỗi operation đưa vào snapshot và hiển thị ở login.
- QueryClient tắt retry query/mutation, focus/reconnect refetch tự động. Cleanup port cancel và clear QueryClient thật khi kết thúc/đổi phiên. Feature consumer tương lai vẫn cần gate/generation trước commit; chưa có generic private feature API gate hoặc nghiệp vụ dataset/workspace.
- Logo PNG dùng nguyên bản, font variable self-host qua design-tokens.css + font-display swap. Không tạo hình minh họa; CSS thuần theo brand, reduced motion. `index.html` dùng lang vi. Không thêm dependency hoặc sửa lockfile ở batch UI.

### 14.3 Validation và giới hạn bằng chứng

- Test cuối: **8 file, 238/238 pass**, 18 ca UI/route/provider mới so với 220 trước; cập nhật startup test cho thiếu config. Lint/build đạt. Mock API adapter + jsdom/fake-indexeddb kiểm login/logout, StrictMode một me, exact expiry timer, focus/visible, long timer, consent/Escape/backdrop/pending, cleanup cache và target.
- Browser thực mở UI local tại địa chỉ Vite in ra; kiểm form màn hình hẹp, logo/font tiếng Việt và submit trống bị native validation chặn. Không nhập/gửi credential backend để thử login. Chưa kiểm đầy đủ matrix browser/viewport hoặc backend/CORS/revoke thật. Không coi test adapter là login production thành công.
- Đo tương phản từ token sRGB: trắng/action #007A57 = 5.36:1, muted/canvas = 5.67:1, danger ink/surface = 6.79:1, input border/canvas = 3.39:1. Màu brand vẫn #00A878, action dùng biến thể tối để đọc được chữ trắng.
- Chưa UI upload/workspace CRUD, tự replay, session đa tab hoặc private feature API gate. Draft chưa đồng bộ được giữ theo account, không render từ public login. Browser data có thể bị xóa bởi browser/user; không tuyên bố IndexedDB mã hóa.
- Đã có UI đăng nhập gọi service thật khi môi trường cấu hình hợp lệ; nghiệm thu login/refresh/logout backend thật cần tài khoản test được phép tại máy, không yêu cầu gửi password/token vào chat.

## 15. Decision log — tạm hoãn Auth integration, chuyển sang Workspace preview

Ngày: 28/10/2026. Nguồn: người dùng báo backend đang lỗi/chưa kết nối được và yêu cầu ghi log; sau đó xác nhận trang chính là **danh sách Workspace** và cách mở là **route preview riêng, không cần đăng nhập**.

### Quyết định đã chốt

1. Tạm hoãn nghiệm thu Auth với backend thật, không coi Auth đã được xác minh end-to-end. Chưa chẩn đoán nguyên nhân backend trong batch này.
2. Giữ code AuthProvider/coordinator/timer/focus/login/dialog đã triển khai. Không xóa Auth, không tạo token/user/role giả và không sửa backend để làm demo.
3. Chuyển ưu tiên công việc tiếp theo sang UI danh sách Workspace. Cho xem bằng route preview riêng, không bắt đăng nhập thành công để xem UI đó.
4. Route thật `/workspaces` và các private route vẫn giữ guard. Không tạm bỏ guard, không cấp quyền nghiệp vụ hoặc mở dữ liệu private qua preview.
5. Preview không đọc credential/cache/draft account cũ hoặc gọi API riêng tư. Nếu dùng dữ liệu mẫu khi lập UI, phải ghi rõ đó là dữ liệu mẫu, không mô tả như dữ liệu backend đã trả hoặc phiên đã xác thực.

### Đề xuất kỹ thuật cho plan Workspace kế tiếp

- Route dự kiến `/preview/workspaces`; đề xuất chỉ bật trong development, không thêm cờ env hoặc route public production một cách ngầm định.
- Tách Workspace view khỏi router/auth/API. Preview cấp dữ liệu trình bày; route thật dùng service → hook/query → view sau khi backend sẵn sàng.
- Trước implementation Workspace, đối chiếu module plan/backend/source và trình bày file/interface/UX/test để duyệt. Chưa chốt cấu trúc dữ liệu giả, các thao tác create/update/delete hoặc permission presentation chỉ từ quyết định mở preview.
- Giữ brand/logo/font đã có; chưa thêm dữ liệu, endpoint hoặc feature ngoài danh sách Workspace được xác nhận.

### Việc còn pending và điều kiện quay lại Auth

- Khi backend khả dụng, chạy checklist login đúng/sai, reload me, expiry, consent accept/Hủy, refresh, logout/revoke, CORS và error handling bằng tài khoản test được phép.
- Không công bố backend đã sửa hoặc API integration đạt chỉ vì preview render/test fixture pass. Kết quả 238 test/lint/build trước là lịch sử; lượt ghi log không chạy lại test sản phẩm vì chỉ sửa Markdown.
- Bản ghi này chỉ lưu quyết định và hướng tiếp theo; chưa tạo preview route hoặc sửa source UI trong lượt hiện tại.

### Vị trí checkout khi ghi log

Ban đầu checkout gốc ở `dev`, có `src/backend/package-lock.json` untracked chặn switch. AI đã tự tạo worktree ngoài quyền được cấp; người dùng nhắc rõ: quyền chuyển branch không bao gồm tạo worktree, mọi thay đổi cách xử lý ngoài phạm vi phải hỏi trước.

Sau khi người dùng xác nhận phương án phục hồi: lockfile dev được chuyển nguyên nội dung bằng patch/edit vào `.agents/git-recovery/package-lock.dev-untracked.json` (hash trước/sau khớp); diff log được bảo toàn tại `.agents/git-recovery/frontend-log.patch`. Hai file log đã chuyển về checkout gốc và đối chiếu hash trùng bản trong worktree trước khi cleanup. Worktree tạm đã được dọn sau khi sạch; checkout gốc hiện trên branch `ThuongFEAI`. Lockfile được theo dõi của branch này giữ nguyên, không chép đè bằng bản backup dev. Không commit/reset hoặc force checkout. Tiếp tục làm việc tại repository gốc; không dùng đường dẫn worktree tạm đã xóa.
