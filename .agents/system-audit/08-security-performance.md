# Chương VIII. Security và Performance ở Frontend

## Cập nhật hiện hành — 19/11/2026

HEAD `f017663` + working tree, ghép TaiFE@48d1ba6. Health prefix finding đã xử lý; members cursor/lifecycle cancellation và guards đã tăng. Token vẫn JS-readable trong sessionStorage; không có bằng chứng dự án đang có XSS. Google callback xóa fragment, kiểm tra attempt và profile trước lưu. Xóa tài khoản thật chưa test; logout đã có E2E trước ghép chứng minh is_revoked, không khẳng định JWT cũ lập tức 401. Runtime/performance/authorization matrix chưa đo đầy đủ; build chunk warning không phải phép đo FPS/latency.

Nguồn hiện hành: [revalidation](audit/frontend-api-revalidation.md), [API inventory](audit/api-inventory.md), [testing](06-software-testing.md). **Các mục snapshot 17/11 dưới đây được giữ làm lịch sử; khi có khác biệt, mục cập nhật này và revalidation thay thế nhận định cũ.**


PASS bên dưới chỉ có nghĩa cơ chế FE được xác nhận trong phạm vi nêu, không chứng nhận hệ thống an toàn. Mọi kiểm tra quyền/validation ở server nằm ngoài nội dung báo cáo; browser guard không phải security boundary đầy đủ.

## 1. Security assessment

| Hạng mục | Trạng thái | Bằng chứng và ý nghĩa |
|---|---|---|
| Request auth explicit | PASS (source/mock) | Axios yêu cầu public/session, bearer chỉ gắn khi session |
| Account isolation của management token reader | PASS (mock) | Provider đối chiếu account; provider test thay token account khác trả null |
| Stale auth result | PASS (source/mock) | Coordinator generation + abort + current checks |
| Redirect/path safety | PASS trong scope test | return-target/path validation; không bảo đảm mọi browser/proxy path |
| Token storage | WARNING | Access và refresh token trong sessionStorage, đọc được bởi JS cùng origin |
| JWT verification ở FE | NOT VERIFIED / không phải responsibility FE | Payload decoder phục vụ expiry/account; không xác minh chữ ký |
| Authorization UI | WARNING | canManage/canUpload/role controls là UX, không đủ chứng minh quyền API |
| XSS tổng thể | NOT VERIFIED | Không thực hiện browser exploit/CSP audit; React text escaping không bảo vệ mọi sink |
| CSRF | NOT VERIFIED | Luồng đã đọc dùng Bearer, chưa kiểm tra cookie/proxy và deployment tổng thể |
| CORS/HTTPS thật | NOT VERIFIED | FE config cho HTTP/HTTPS; chưa quan sát headers/server/hosting |
| Upload preflight | PASS giới hạn source/mock | CSV .csv/nonempty/50 MiB; không phải xác thực nội dung đáng tin ở server |
| Error exposure | PASS giới hạn source | ApiError không giữ raw config/token; che 5xx message ở Axios HTTP mapper |
| Response validation | WARNING | Auth/users check fields; management dùng nhiều DTO generic chưa validate đủ |
| Empty 204 handling | PASS (source/mock) | Client trả undefined trước unwrap khi status 204; regression test API pass; live DELETE UNVERIFIED |
| Secrets/dependency vulnerabilities | NOT VERIFIED | Không đọc secret; không chạy vulnerability service/audit trên dependency tree |

Token trong sessionStorage giúp tách tab/lifetime so với localStorage nhưng không ngăn XSS đọc token. Đây là trade-off hiện trạng, không khuyến nghị thay auth storage tự động khi chưa xem contract server. Upload CSV parser/readFile toàn bộ ở browser cũng cần phân biệt UX với file-security trên API boundary.

Field error mapper đọc error.message dạng array; nếu contract trả details.fields, UI có thể mất lỗi từng field. Điều này ảnh hưởng khả năng sửa input, không đủ bằng chứng để gọi là khai thác bảo mật.

Chi tiết: [security-findings.md](audit/security-findings.md). Không đưa findings nội bộ BE từ phase cũ vào báo cáo này.

## 2. Performance: những gì có bằng chứng

| Mối quan tâm | Quan sát source | Kết luận có giới hạn |
|---|---|---|
| Startup | main skeleton + dynamic import bootstrap | Có tách tải; chưa đo LCP/TTI |
| Route splitting | React.lazy/Suspense ở workbench routes | Có lazy chunks; chưa đo cold navigation |
| Login graphics | Lazy scene, compact/WebGL fallback, timeout 10 giây | Có graceful degradation; chưa đo GPU/FPS |
| Management load | Vòng lặp await theo workspace/project | Có request waterfall; tăng theo tài nguyên |
| Reload sau write | mutate gọi load toàn bộ resource lists | Dễ nhất quán nhưng có thể tốn network lớn |
| Cache | QueryClient retry/refetch policy có cấu hình | Management dùng external store, không tự nhận query dedup/cache |
| CSV preview | arrayBuffer/TextDecoder + giữ parsed rows | Có nguy cơ nhiều bản sao dữ liệu trong memory; chưa đo heap |
| Theme/graphics rendering | Hooks reduced motion, scene callbacks | Không có FPS/performance trace mới |

Với một trang cho mỗi resource list, W workspace, P project và D project có dataset, resource load cần tối thiểu **1 + 2W + P + D** request: workspace list; mỗi workspace members và project list; mỗi project members; dataset khi có. Personal load thêm tối thiểu ba request profile/notification/issues. Đây là **công thức suy ra từ vòng lặp source**, không phải số request capture trong DevTools. Pagination tăng thêm request.

Members roster chưa lặp cursor; tối ưu bằng bỏ fetch không phải giải pháp nếu làm thiếu quyền/dữ liệu. Đề xuất trước hết định nghĩa contract paging và tải đủ đúng dữ liệu, rồi dùng bounded concurrency/query theo màn hình. Trade-off concurrency là tăng tải request và phải xử lý cancellation/stale result.

## 3. Performance dashboard — trạng thái đo

| Metric snapshot hiện tại | Giá trị |
|---|---|
| JS/CSS bundle size production | UNVERIFIED — chưa rebuild snapshot mới |
| LCP, INP, CLS | UNVERIFIED |
| FPS/WebGL frame budget | UNVERIFIED |
| API latency, p90/p95/p99 | UNVERIFIED |
| Browser heap / memory | UNVERIFIED |
| Request count live | UNVERIFIED; chỉ có công thức source ở trên |
| Current test duration scope | 32,41 giây / 315 test, không phải tốc độ app |

Lượt build lịch sử trước thay đổi từng có chunk R3F khoảng 912,51 kB, gzip 242,07 kB và ảnh nền lớn. Các số đó không đại diện bundle mới; chỉ là lý do nên đo lại. Không dùng thời gian test hoặc kích thước gzip để kết luận trải nghiệm người dùng nhanh/chậm.

## 4. Load testing và đề xuất đo

K6/API backend load testing nằm ngoài scope FE đã thống nhất; không chạy và không đưa số VU/throughput giả. Đo FE nên dùng production build đúng config trên môi trường cô lập, browser performance/network trace, Lighthouse/Web Vitals và WebGL frame inspection nếu có điều kiện. Đây là đề xuất, không tự cài tool hay tuyên bố đã đo.

Ưu tiên sau contract correctness: waterfall management, file parsing memory, ảnh/chunk theo route và graphics fallback. Không thay shader/geometry hoặc giảm chất lượng hình chỉ dựa trên suy đoán bottleneck.
