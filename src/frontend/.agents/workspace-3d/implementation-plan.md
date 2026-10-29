# Workspace 3D — Đặc tả, kế hoạch và prompt triển khai v1

Ngày: 28/10/2026. Trạng thái: **người dùng đã xác nhận gói batch 1–4; đã triển khai preview, chờ human review**. Kết quả và giới hạn thực tế ở mục 11. Những từ “đề xuất/chờ duyệt” trong bản đặc tả ban đầu bên dưới là lịch sử; quyết định được chốt bổ sung trong mục 11.

## 1. Yêu cầu và quyết định đã xác nhận

Người dùng muốn khám phá tài nguyên bằng bản đồ 3D trong lúc BE lỗi. Người dùng là sinh viên fresher/intern; khi triển khai phải giải thích từng batch, code trọng tâm, cách sử dụng và cách đọc lỗi.

- Chọn concept A: bản đồ phân cấp Workspace → Project → Dataset; các cấp có hình dạng khác nhau để dễ phân biệt.
- Đường nối là ống trong suốt, bên trong có vệt màu chạy liên tục theo hướng cha → con, tạo cảm giác truyền dữ liệu.
- Khung biểu diễn thống nhất nhưng bản đồ sinh từ dữ liệu: thêm tài nguyên thì thêm khối/đường nối và bố trí lại khi cần. Không dựng cứng từng đối tượng.
- Mỗi Dataset là một khối, không phụ thuộc số dòng hoặc lĩnh vực khách hàng/ngân hàng/bán hàng. Không tự phân loại nội dung file để đổi hình.
- Tên hiển thị tách khỏi ID: đổi tên không đổi quan hệ hay identity.
- Bản đầu là preview tách riêng, dữ liệu demo, chỉ chọn/khám phá/xem thông tin. Không upload, CRUD, lưu đổi tên hoặc tích hợp BE trong batch này.

Phân biệt: hiệu ứng trong ống **minh họa quan hệ**, không chứng minh upload, đồng bộ hay xử lý dữ liệu đang diễn ra. Bản đồ tài nguyên không phải biểu đồ từng record và không phải kết quả AI.

## 2. Context và nguồn hiện tại

- Đọc [handoff](../handoff/context.md), [architecture](../Structure/frontend-architecture-plan.md), [master plan](../frontend-delivery/master-plan.md), [team workflow](../frontend-delivery/team-workflow.md).
- Manifest hiện khai báo React ^19.3.1, TypeScript ~6.0.3, Vite ^8.3.4, Three 0.186.1, Fiber 9.8.2, React Router 8.5.0; dùng Yarn 1.22.22. Đây là dữ kiện manifest, không phải kết quả runtime mới.
- Router hiện có login, protected `/workspaces`, entry và 404; chưa có route preview. Source được kiểm tra chưa có scene 3D sản phẩm.
- Handoff gần nhất ưu tiên preview Workspace khi BE lỗi. Auth hiện có provider/coordinator; không dùng mô tả lịch sử “chưa có auth” làm hiện trạng.
- Giữ brand/token hiện tại, không tự thay font hoặc thiết kế lại toàn ứng dụng.

### Vai trò các skill

- `apple-design`: phản hồi ngay khi thao tác, chuyển động có thể ngắt, giữ định hướng không gian, reduced motion và giao diện dễ đọc.
- `animation-vocabulary`: thống nhất từ ngữ khi trao đổi hiệu ứng; không thay thế đặc tả kỹ thuật.
- `img2threejs`: đã đọc; chưa chạy reconstruction vì không có vật thể tham chiếu cần tái tạo. Các khối trừu tượng của bản đồ dùng Three/Fiber trực tiếp. Ảnh concept là minh họa, không phải cam kết tái tạo vật thể. Nếu bổ sung model từ ảnh, mở batch riêng với reference và các gate của skill.

## 3. Đặc tả hành vi

### Đầu vào

Đề xuất model trình bày nội bộ, **không phải schema API**:

```ts
type ResourceNode = {
  id: string
  kind: 'workspace' | 'project' | 'dataset'
  name: string
  parentId: string | null
}

type ResourceMapProps = {
  resources: readonly ResourceNode[]
  selectedId: string | null
  onSelect: (id: string | null) => void
}
```

Model chỉ giữ dữ liệu cần cho preview; không tự thêm số dòng, dung lượng, trạng thái sync hoặc metric chưa có nguồn. Nếu tích hợp thật sau này, adapter ánh xạ identity server sang model này; renderer không gọi API.

### Điều kiện hợp lệ — đề xuất kỹ thuật, chờ duyệt

- ID không rỗng và duy nhất trong bản đồ; tên không chỉ chứa khoảng trắng, tên trùng được phép.
- Workspace có parentId null; Project thuộc Workspace; Dataset thuộc Project; parent phải tồn tại. Không chấp nhận chu trình hoặc liên kết sai cấp.
- Input sai phải báo lỗi dữ liệu demo có thể đọc được, không âm thầm bỏ node hay tạo quan hệ thay thế.
- `resources=[]` là hợp lệ và hiển thị trạng thái rỗng.

### Xử lý

1. Kiểm tra cấu trúc và xây index theo ID ngoài frame loop.
2. Từ tài nguyên hợp lệ, tính vị trí bằng hàm thuần và sinh cạnh từ parentId.
3. Render khối, nhãn, ống và dòng màu; selection luôn dựa trên ID, không dùng index/tên.
4. Chọn một tài nguyên cập nhật đồng thời scene, danh sách HTML và panel. Khám phá cấp con giữ breadcrumb để quay lại.
5. Khi props thêm Dataset, tạo đúng một node và một cạnh tới Project; bố trí lại tránh chồng khối. Đổi name cùng ID chỉ đổi nhãn/panel, giữ selection.
6. Khi node đang chọn bị gỡ khỏi props, bỏ selection và đóng thông tin cũ; không hiển thị tài nguyên không còn tồn tại.
7. Preview không có form upload/đổi tên. Kiểm tra cập nhật dữ liệu qua fixture/test props, không qua thao tác ghi giả.

### Đầu ra

Scene tài nguyên cùng danh sách/breadcrumb/panel HTML. Trạng thái gồm dữ liệu hợp lệ, rỗng, dữ liệu lỗi và renderer không khả dụng. Không có API request nghiệp vụ hay ghi storage từ preview.

### Xếp loại

| Loại | Ý nghĩa | Hình dạng đề xuất, chưa chốt |
|---|---|---|
| workspace | Không gian chứa Project | Khối lục giác |
| project | Nhóm chứa Dataset | Hộp bo góc |
| dataset | Một bộ dữ liệu | Hình trụ |

Không áp dụng khoảng giá trị số/nhãn chất lượng vì scene này không tính chỉ số dữ liệu. Nhãn và icon đi cùng hình dạng; màu không là dấu hiệu duy nhất.

### Thứ tự — đề xuất kỹ thuật, chờ duyệt

Giữ thứ tự đầu vào trong từng nhóm anh em để layout xác định và không đổi do tên. Kiểm tra dữ liệu trước layout, layout trước render; reduced motion ưu tiên hơn chuyển động trang trí. Lỗi renderer không làm mất danh sách HTML.

## 4. Thiết kế và kiến trúc đề xuất — chưa coi là quyết định đã duyệt

- Route dev-only `/preview/workspaces-3d`, tách khỏi guard nghiệp vụ; build production không đăng ký route và không kéo fixture preview vào bundle. Không mở private route, tạo phiên giả hay đọc cache/draft riêng tư.
- Kiểm tra provider/runtime trước khi ghép route: chỉ thêm route ngoài ProtectedRoute chưa bảo đảm không gọi auth bootstrap. Preview phải mở được khi anonymous/BE lỗi; không tự tắt bảo vệ các route thật. Nếu cần sửa provider để cô lập side effect, báo rõ phạm vi trước code.
- Bố cục desktop: breadcrumb/nhãn Demo phía trên, scene chính, panel bên phải và danh sách HTML có thể truy cập. Màn hẹp xếp theo chiều dọc, không khóa cuộn toàn trang.
- Góc nhìn ban đầu kiểu isometric; chọn để xem panel, action riêng để vào cấp con; breadcrumb quay lại. Không phụ thuộc double-click. Có zoom, xoay và nút về tổng quan; thao tác camera không kích hoạt chọn nhầm node sau drag.
- Hệ tọa độ đề xuất Y-up, góc nội bộ radian; vector cho vị trí, quaternion cho quay khi cần. Không thêm số phức nếu không có bài toán cần dùng.
- Các ống dùng chung geometry/material khi phù hợp; vệt màu cập nhật bằng delta thời gian trong frame loop, không setState React mỗi frame. Không animate layout DOM mỗi frame. Dừng chuyển động khi tab ẩn và giải phóng tài nguyên khi unmount.
- Reduced motion tắt dòng chạy và camera tự chuyển; thao tác chọn vẫn có phản hồi màu/opacity. WebGL lỗi/context lost phải có thông báo và danh sách HTML dùng được; không tự hứa khôi phục GPU nếu chưa kiểm thử.
- Tách trách nhiệm: types/fixture → validation + layout thuần → graphics scene/camera/ống → view/hook selection và panel. Không thêm UI/state/motion library hoặc dependency mới mặc định.

### Phạm vi file dự kiến

- `src/types/workspace-3d/`: model trình bày; `src/math/workspace-3d/`: validation/layout thuần.
- `src/graphics/workspace-3d/`: scene, node, ống, camera và lifecycle.
- `src/views/workspace-3d/`, `src/hooks/workspace-3d/`, `src/components/workspace-3d/`: preview orchestration và HTML; chỉ tách hook/component khi có trách nhiệm rõ.
- `src/__tests__/workspace-3d/`: test chính thức cho hành vi. Router chung là điểm tích hợp cần review.
- Fixture phục vụ preview sản phẩm đặt trong module preview dev-only; không đặt script/tài liệu AI vào src. Artifact phân tích, ảnh kiểm tra và log nội bộ giữ trong `.agents/workspace-3d/` khi cần.

## 5. Kế hoạch theo batch

| Batch | Công việc | Tiêu chí trước khi chuyển bước |
|---|---|---|
| 0 — Chốt đặc tả | Review phần đã chốt và các đề xuất mục 3–4; chốt hình, navigation, route/provider, dataset mục tiêu và thiết bị test | Người dùng xác nhận phạm vi code và các lựa chọn còn mở |
| 1 — Dữ liệu và layout | Model, validation, fixture phân cấp, layout xác định, selection theo ID | Test quan hệ/input lỗi/rename/add đạt; chưa cần hiệu ứng |
| 2 — Scene và HTML | Ba loại hình, nhãn, camera, chọn và khám phá, breadcrumb/panel/list | Xem preview thật; quan hệ rõ, keyboard dùng được, drag không chọn nhầm |
| 3 — Ống và motion | Ống trong suốt, vệt màu liên tục, phản hồi chọn, reduced motion/visibility | Không gán ý nghĩa sync; không setState mỗi frame; kiểm tra đọc nhãn và hiệu năng |
| 4 — Review và bàn giao | Fallback/cleanup/responsive; test, lint/build, browser evidence và review diff | Báo rõ kết quả thực chạy, hạn chế và phần chưa tích hợp |

Không tự chuyển sang upload/BE vì preview đã đẹp. Owner dự kiến graphics/math: FE B, router/app: FE A theo team workflow; cần người dùng gán người thực hiện/reviewer nếu triển khai theo nhóm. Không tự spawn agent hay tạo worktree/branch.

## 6. Test case trước khi sinh mã

Các kỳ vọng thuộc quyết định đã chốt có thể dùng làm acceptance. Các kỳ vọng về validation/layout/navigation dưới đây là đề xuất và chỉ thành hợp đồng implementation sau khi duyệt mục 3–4.

| Mã | Nhóm | Đầu vào/thao tác | Kết quả mong đợi | Lý do |
|---|---|---|---|---|
| W01 | Thường | 1 Workspace, 2 Project, 3 Dataset hợp lệ | 6 node, 5 cạnh đúng cha–con | Đúng cấu trúc mẫu |
| W02 | Thường | Chọn Dataset | Panel và danh sách cùng identity | Tránh lệch selection |
| W03 | Thường | Thêm Dataset qua props fixture | Thêm 1 node/1 cạnh, bố trí cập nhật | Bản đồ động |
| W04 | Biên | Đổi tên, giữ ID | Đổi nhãn, giữ selection và quan hệ | Tên không là khóa |
| W05 | Biên | Tên dài, Unicode, tên trùng | Không che action; phân biệt theo ID/ngữ cảnh | Khả năng đọc |
| W06 | Không hợp lệ | ID trùng/rỗng, thiếu tên, kind sai, null thay danh sách | Báo dữ liệu lỗi; không crash hoặc bỏ node âm thầm | Validation đề xuất |
| W07 | Không hợp lệ | Parent thiếu/sai loại hoặc chu trình | Báo lỗi; không tính layout vô hạn | Quan hệ hợp lệ |
| W08 | Đặc biệt | Rỗng hoặc chỉ 1 Workspace | Empty state hoặc 1 node, không có ống thừa | Không ép có Dataset |
| W09 | Đặc biệt | Xóa node đang chọn khỏi props | Bỏ selection/panel cũ | Tránh trạng thái stale |
| W10 | Tương tác | Drag camera rồi nhả trên node | Không chọn nhầm; nút reset đưa về tổng quan | Tách drag và click |
| W11 | Accessibility | Bàn phím, reduced motion | HTML chọn được; không dòng chạy/camera tự chuyển | Không phụ thuộc motion |
| W12 | Failure | WebGL không có hoặc context lost | Thông báo và danh sách HTML dùng được | Graceful degradation |
| W13 | Lifecycle | Mount/unmount lặp trong StrictMode; tab ẩn | Không tăng tài nguyên/listener; dừng motion khi ẩn | Cleanup và hiệu năng |
| W14 | Boundary | Anonymous, BE không truy cập được | Preview vẫn dùng demo, không gọi private API/đọc private storage | Tách preview và auth |
| W15 | Production | Build production, truy cập URL preview | Route không đăng ký, fixture preview không vào bundle | Giới hạn dev-only đề xuất |
| W16 | Motion | Cùng thời gian thực ở nhịp frame khác nhau | Tốc độ vệt màu tương đương, không phụ thuộc FPS | Dùng delta thời gian |

Chưa có ngưỡng số node/FPS/thiết bị được duyệt: không tuyên bố “60 FPS mọi máy” hoặc tự lấy sampling để giấu node. Không áp dụng test phân tích CSV, thuật toán bất thường hoặc mapping X/Y/Z vì ngoài scope.

## 7. Pseudocode và dò vết

```text
NHẬN resources, selectedId và callback
KIỂM TRA schema, ID và parent theo bảng loại
NẾU sai: hiển thị lỗi dữ liệu; không chạy layout
NẾU rỗng: hiển thị empty state
NGƯỢC LẠI:
  TẠO index theo ID và danh sách con theo thứ tự đầu vào
  TÍNH layout xác định cho phạm vi đang khám phá
  SINH cạnh từ parentId; render scene và HTML từ cùng model
  NẾU selectedId không còn tồn tại: bỏ selection
KHI chọn: cập nhật ID, panel và highlight
KHI vào cấp con/quay lại: cập nhật scope và breadcrumb
MỖI FRAME hợp lệ:
  NẾU tab đang hiện và không reduced motion: cập nhật pha dòng màu bằng delta
KHI unmount/context lỗi: dọn lifecycle thuộc quyền sở hữu; giữ DOM fallback
```

Dò vết thủ công trên thiết kế: W01 có 1 root + 2 con + 3 cháu → 6 node; mỗi node ngoài root có một parent → 5 cạnh. W08 danh sách rỗng đi vào empty state trước layout → không sinh node/cạnh. Đây là kiểm tra logic tài liệu, chưa chạy code.

## 8. Prompt triển khai có thể sao chép

```text
CONTEXT
Bạn làm frontend tại AI-systems-support-detecting-and-handling-data-quality-issues/src/frontend.
Đọc AGENTS/rules áp dụng, handoff hiện tại và .agents/workspace-3d/implementation-plan.md.
React ^19.3.1, TS ~6.0.3, Vite ^8.3.4, Three 0.186.1, Fiber 9.8.2,
Router 8.5.0; dùng Yarn. Kiểm tra lại manifest/source trước khi sửa.

TASK
Triển khai đúng batch Workspace 3D preview đã được người dùng xác nhận.
Nếu chưa có xác nhận cho các đề xuất còn mở, chỉ phân tích và hỏi gộp câu hỏi cần thiết;
không coi việc người dùng yêu cầu lưu plan là quyền triển khai sản phẩm.

INPUT
ResourceNode { id, kind: workspace|project|dataset, name, parentId } và selection theo ID.
Dữ liệu demo rõ nhãn, không có thông tin account hoặc dữ liệu private.
Đọc model, validation và thứ tự tại mục 3; không coi model này là backend DTO.

CONSTRAINTS
1. Bản đồ phân cấp động; một Dataset = một khối, không phụ thuộc nội dung/số dòng file.
2. Các cấp khác hình; hình cụ thể theo quyết định đã duyệt. Nhãn/icon hỗ trợ phân biệt.
3. Đường nối là ống trong suốt có vệt màu chạy cha→con, chỉ minh họa quan hệ.
4. Chọn/khám phá/panel/breadcrumb, camera reset và danh sách HTML dùng cùng identity.
5. Không upload/CRUD/rename form, API nghiệp vụ, private storage, AI hoặc chart record.
6. Tách graphics khỏi validation/layout và orchestration. Không setState mỗi frame.
7. Reduced motion, tab visibility, GPU cleanup, WebGL fallback phải có bằng chứng.
8. Giữ auth guard thật; kiểm tra provider side effect trước khi tích hợp preview dev-only.
9. Không thêm dependency, không tự commit/reset/revert, không đọc/in .env.
10. Sửa bằng apply_patch/edit tích hợp; artifact AI chỉ ở .agents/workspace-3d/.

PSEUDOCODE
Theo mục 7 của plan, sau khi các đề xuất liên quan đã được duyệt.

EXAMPLES
Hợp lệ: Workspace Đồ án → Project Bán hàng → Dataset Đơn hàng.
Kết quả: 3 node, 2 ống; chọn Dataset hiện thông tin đúng parent.
Thêm Dataset Khách hàng vào cùng Project: 4 node, 3 ống, layout cập nhật.
Đổi name của Đơn hàng nhưng giữ ID: nhãn đổi, selection/quan hệ giữ nguyên.
Lỗi: Dataset trỏ parent không tồn tại → báo lỗi cấu trúc; không tự tạo Project giả.

OUTPUT
Trước code: nêu batch được phép sửa, file/interface, rủi ro và các quyết định còn thiếu.
Sau xác nhận: patch source thật, giải thích code trọng tâm và cách đọc lỗi cho fresher.
Báo mọi giả định/khác biệt, không tự bổ sung business logic bằng comment rồi triển khai.
Chạy test phù hợp, Yarn lint/build, diff check; mở review diff trong Codex.
Bàn giao kết quả thực chạy, bằng chứng browser, phần chưa làm và hạn chế.

CRITERIA
Đạt các case W01–W16 áp dụng cho batch đã duyệt trong mục 6.
Fixture không chứng minh API thật hoạt động. Build pass không chứng minh visual/motion đúng.
Không thêm mã thừa hoặc tự xử lý feature ngoài phạm vi.
```

## 9. Rủi ro, câu hỏi còn mở và nghiệm thu

- Chưa chốt hình cụ thể, toàn cây hay từng scope mặc định, chi tiết thao tác camera và mức độ trong suốt/tốc độ/màu dòng chảy. Các lựa chọn ở mục 4 là phương án đề xuất để review, chưa là yêu cầu chính thức.
- Chưa chốt kích thước tập tài nguyên và thiết bị/trình duyệt mục tiêu. Cần chốt trước nghiệm thu performance; không tự ẩn/lấy mẫu dữ liệu hoặc đặt FPS thành cam kết.
- Ống trong suốt có thể gặp lỗi thứ tự render, nhiều vệt màu có thể che nhãn và tốn GPU. Ưu tiên đọc được quan hệ, giới hạn hiệu ứng qua thiết kế được duyệt thay vì giảm số tài nguyên âm thầm.
- Bố trí lại có thể gây mất định hướng; phải giữ selection/breadcrumb và kiểm tra bằng preview thật. Layout xác định không bảo đảm không chồng nhãn ở mọi quy mô.
- Preview route có thể vẫn chịu auth side effect từ provider toàn cục; phải kiểm tra wiring thực tế trước khi chốt sửa file chung.
- Upload/rename thật là batch sau, cần đối chiếu API/quyền/validation; không suy ra đã hỗ trợ BE từ model preview.
- Chạy test hành vi, lint/build/diff check khi có source; xem preview bằng browser để kiểm tra hình/ống/camera/keyboard/resize/reduced motion/fallback. Mở diff Codex sau chỉnh sửa. Tài liệu hiện tại không ghi nhận test sản phẩm mới.

## 10. AI prompting log

| Bước | Trạng thái |
|---|---|
| 1. Yêu cầu | Ý tưởng và phạm vi preview đã được người dùng xác nhận; mục 1 |
| 2. Đặc tả | Mục 3–4; các đề xuất chi tiết chờ duyệt được đánh dấu |
| 3. Test case | W01–W16 tại mục 6; chưa thực thi |
| 4. Pseudocode | Mục 7; đã dò vết lý thuyết W01/W08 |
| 5. Prompt | v1 tại mục 8; chưa dùng để triển khai |
| 6. AI đề xuất mã | Đã triển khai batch 1–4 bằng apply_patch sau xác nhận gói lựa chọn |
| 7. Kiểm chứng implementation | Mục 11; không coi unit test là bằng chứng GPU/browser thật |
| 8. Quyết định code | Chờ người dùng review diff và preview |

Lưu tài liệu theo yêu cầu hiện tại không thay đổi auth plan/handoff có sẵn, không ghi nhận backend đã hoạt động và không cấp quyền sửa code sản phẩm.

## 11. Quyết định bổ sung và bàn giao implementation

**Lịch sử bản đầu:** hướng tạo hình và chính sách hiện tất cả nhãn ở mục này được thay bằng batch C tại mục 12. Các số liệu 265 test và ảnh `preview-*` là bằng chứng trước batch C.

### Phạm vi đã được duyệt sau khi lưu plan

Người dùng xác nhận gói: batch 1–4; Workspace lục giác, Project hộp bo góc, Dataset hình trụ; ban đầu toàn cây, chọn để xem panel, action Khám phá và breadcrumb; kéo xoay/cuộn zoom/reset; validation và giữ thứ tự đầu vào; preview dev-only `/preview/workspaces-3d`, tách khỏi khởi tạo runtime auth; ống trong suốt, vệt xanh brand/xanh lam; fixture 6/30 tài nguyên và kiểm tra desktop/màn hẹp. Không upload/CRUD/đổi tên qua form hoặc gọi BE.

### Source và cách dùng

- Mở `/preview/workspaces-3d` khi chạy `yarn dev`. Chọn khối hoặc nhãn/danh sách để xem panel. Chọn Workspace/Project rồi bấm Khám phá để xem nhánh; breadcrumb quay lại. Nút đổi fixture chỉ thay dữ liệu demo, không ghi storage.
- `src/app/main.tsx` quyết định nhánh dev preview trước dynamic import. `application-bootstrap.tsx` giữ composition app thật trước đây (Query/Auth/BrowserRouter/runtime/dispose); không đổi auth guard/service hay router thật. Loading và lỗi tải module có phản hồi HTML.
- Types trình bày ở `src/types/workspace-3d/`, validation/layout/flow ở `src/math/workspace-3d/`, renderer ở `src/graphics/workspace-3d/`, preference hook ở `src/hooks/workspace-3d/`, view/fixture/CSS ở `src/views/workspace-3d/`.
- Validation chạy trước layout. Layout bố trí nhánh thành cụm hàng/cột xác định thay vì kéo mọi Dataset thành một hàng dài. Đổi tên giữ ID và vị trí; node đang chọn bị gỡ sẽ clear selection để không tự chọn lại khi ID tái xuất hiện.
- Nhãn HTML được chiếu theo camera, tránh va chạm bằng slot và có đường dẫn tới đúng khối. Chỉ tính lại projection khi camera/layout/selection/size thay đổi; không setState mỗi frame. Dòng màu đi theo delta thời gian, dừng khi tab ẩn/reduced motion và bỏ delta tích lũy khi trở lại.
- Three/Fiber quản lý disposal declarative; geometry hộp bo góc tự dispose, OrbitControls/listener context lost được cleanup trong effect. Không coi cách tổ chức source là phép đo bộ nhớ GPU.

### Kiểm chứng thực tế

- Full suite gần nhất: **265/265 test, 12 file**; gồm 27 test mới về model/layout, UI, entry boundary, preference/lifecycle và fallback. Lint và production build đạt; sẽ chạy lại phần liên quan nếu có sửa sau kết quả này.
- Kiểm tra production artifact không tìm thấy `demo-workspace`, `Bản đồ tài nguyên`, `OrbitControls`, `workspace-3d-preview`; build không emit chunk preview/Three. Unit test entry xác minh dev URL không import application bootstrap và production cùng URL đi về app thật.
- Browser tích hợp: scene render, chọn Dataset đồng bộ panel/danh sách, khám phá Project còn 3 node rồi quay về 6 node, kéo camera giữ selection, reset góc nhìn. Fixture 30: đo DOM có **30 nhãn hiển thị, 0 cặp nhãn giao nhau** ở góc desktop mặc định; không khẳng định mọi góc quay đều không giao nhau.
- Responsive với viewport override 1440×1000 và 390×844; ở màn hẹp đo clientWidth/scrollWidth cùng 375px (phần còn lại là scrollbar), không tràn ngang. Panel/danh sách nằm dưới scene.
- Bằng chứng ảnh: [desktop](preview-desktop.png), [màn hẹp](preview-mobile.png), [30 tài nguyên](preview-30-resources.png). Đây là ảnh trình duyệt từ source thật, không phải ảnh concept sinh bằng AI.
- Reduced-motion/visibility và listener cleanup được kiểm tra bằng unit test, gồm StrictMode. Fallback được kiểm tra qua lỗi renderer giả lập/không hỗ trợ WebGL; context lost dùng DOM event với OrbitControls thật. **Chưa chủ động gây mất GPU context trên browser thật, chưa đo GPU memory plateau, chưa benchmark FPS**.
- Công cụ phiên này chỉ có browser tích hợp, không có Chrome connector. Do đó chưa ghi nhận nghiệm thu Chrome riêng. Browser có cảnh báo deprecation `THREE.Clock` từ dependency Fiber/Three; không đổi dependency trong phạm vi này. Cảnh báo shadow map đã tránh bằng chọn PCF shadow rõ ràng.

### Code trọng tâm để học

```ts
const selected = validResources.find(node => node.id === selectedId) ?? null
```

Dòng trên lấy đúng đối tượng theo ID ổn định, không theo tên hoặc vị trí mảng. Layout sinh cạnh từ `parentId`; khi tên đổi nhưng ID giữ nguyên thì không đổi tài nguyên được chọn. Nếu dữ liệu thiếu cha/sai cấp, `validateResources` trả lỗi để UI hiển thị, không tạo cha giả.

```ts
if (import.meta.env.DEV && window.location.pathname === '/preview/workspaces-3d') {
  // Chỉ import preview, không khởi tạo auth runtime.
}
```

Đây là nhánh ở entry, không phải bypass ProtectedRoute. Quay về ứng dụng qua link sẽ tải lại nhánh app thật; production không có preview. Không có thay đổi dependency hoặc commit. Giữ nguyên thay đổi auth-plan/handoff có sẵn trước batch này.

## 12. Batch C — Data Hardware và nhãn tự động (28/10/2026)

### Quyết định đã duyệt

Người dùng chọn C rồi xác nhận triển khai: Workspace là hub tròn/lõi lục giác; Project là module đứng có khe; Dataset là cartridge ngang, góc cắt và cửa sổ kính/lõi màu. Giữ đường ống trong suốt, dữ liệu và identity hiện có. Đây là tạo hình procedural trừu tượng được đơn giản hóa theo concept, không phải tái tạo chính xác vật thể từ ảnh; không chạy pipeline reconstruction của img2threejs hoặc thêm model/texture từ nguồn ngoài.

Nhãn Dataset tự động ẩn khi **tổng số tài nguyên trong phạm vi đang xem** vượt 8 ở scene rộng hoặc vượt 4 ở scene hẹp. Tại đúng 8/4 vẫn được hiện. Scene hẹp dùng chiều rộng canvas < 640 CSS px, không suy từ loại thiết bị hay chiều rộng toàn browser. 640px là breakpoint trình bày của batch, không phải ngưỡng nghiệp vụ. Workspace/Project vẫn có tên; Dataset đang chọn, hover hoặc focus từ danh sách được ưu tiên hiện tên. Chỉ ẩn nhãn và leader tương ứng, không ẩn model, ống hoặc dữ liệu trong danh sách/panel.

Ngưỡng là lựa chọn UX ban đầu, không là giới hạn tài nguyên hoặc kết luận tối ưu trên mọi camera. Nếu riêng số Workspace/Project đã quá lớn thì vẫn có thể rối; chưa thêm clustering, filter hay giới hạn dữ liệu trong batch này.

### Bằng chứng dẫn đến thay đổi

Trước batch C, đo DOM leader của bản cũ: desktop scene 1024×600, fixture 6 node không nhãn nào cách anchor quá 40px; fixture 30 node có 17 nhãn cách quá 40px, xa nhất 233px. Khi vào 1 Project/7 Dataset trên desktop, cả 8 nhãn gần anchor; scene hẹp 341×380 có 3 nhãn bị đẩy xa. Số liệu này chứng minh độ rối của cách ép tất cả nhãn, không tự chứng minh ngưỡng 8/4 là tối ưu.

### Thay đổi kỹ thuật và code trọng tâm

- `src/graphics/workspace-3d/resource-hardware.tsx`: ghép các phần có vật liệu shell/edge/dark/signal/glass thành ba silhouette khác nhau; phần custom geometry tự dispose. Mỗi Dataset vẫn là một model, không tạo model theo từng record.
- `hardware-lighting.tsx`: môi trường phản xạ RoomEnvironment/PMREM tạo trong browser, không fetch HDRI. Dọn environment target và tài nguyên tạm khi unmount; không làm thay đổi auth/entry.
- `src/math/workspace-3d/resource-label-policy.ts`: ngân sách và điều kiện hiện nhãn là logic trình bày thuần, được test ở các biên. Renderer áp dụng cùng điều kiện cho nhãn, aria-hidden và leader. Thay đổi hover/focus đánh dấu projection cần tính lại, kể cả reduced motion/demand frame.
- View truyền focus theo ID từ danh sách vào scene, đổi legend theo hình mới và giải thích ngắn việc ẩn nhãn tự động. Không gọi API hoặc storage, không thêm dependency.

```ts
return resource.kind !== 'dataset'
  || resourceCount <= resourceLabelBudget(sceneWidth)
  || pinnedIds.includes(resource.id)
```

Đọc điều kiện theo thứ tự: Workspace/Project luôn giữ tên; khi scene ít tài nguyên thì Dataset có tên; khi đông thì chỉ Dataset tương tác được ghim tên. Các phần render và danh sách vẫn nhận đầy đủ resources.

### Kiểm chứng batch C

- Full suite: **277/277 test, 13 file**; 12 test bổ sung về ngân sách/biên 8→9 và 4→5, pins theo ID, nhãn/leader/aria-hidden thực tế từ controller, khôi phục nhãn khi vào Project và thay kích thước. Lint, build và diff check đạt.
- Browser desktop: 30 tài nguyên còn 5 nhãn (1 Workspace + 4 Project), danh sách vẫn 30 mục. Chọn Dataset hiện thêm tên; Tab focus Dataset khác hiện tên đó đồng thời giữ tên đang chọn. Vào Project 1 với 7 Dataset hiện 8 nhãn.
- Browser hẹp: viewport override 390×844, scene khoảng 341×380; Project/7 Dataset chỉ hiện tên Project khi chưa chọn Dataset; danh sách vẫn 8 mục. clientWidth = scrollWidth = 375px, không tràn ngang.
- Ảnh thực tế: [tổng quan C](hardware-overview.png), [Project C](hardware-project.png), [màn hẹp C](hardware-mobile.png). Giữ ảnh cũ để so sánh, không dùng chúng làm hình hiện trạng sau batch C.
- Browser hover trực tiếp chưa được tự động hóa bằng công cụ hiện có; logic hover pin được unit test và handler mesh/label được nối trong source. Keyboard focus và selection được kiểm tra browser thật.
- Chưa đo FPS/bộ nhớ GPU hoặc xác minh Chrome riêng. Model nhiều phần và môi trường phản xạ có chi phí cao hơn bản primitive; chưa coi build/test đạt là benchmark. Vật liệu kính là lớp trong suốt nhẹ, không hứa hiệu ứng khúc xạ giống ảnh concept.

Batch chỉ sửa module Workspace 3D, test chính thức và plan này; các thay đổi auth-plan/handoff/main có từ trước được giữ nguyên. Không commit/reset/revert, không đọc hoặc in .env.

## 13. Reference matching bằng img2threejs — đang dừng, chưa hoàn thành

Người dùng cung cấp ảnh C cụ thể và xác nhận tăng độ giống theo ảnh. Đã thực hiện intake/spec và chỉnh một phần blockout của hub. Project/Dataset chưa vượt silhouette gate 0.85 sau 3 correction actions nên pipeline hard-stop theo skill. **Không coi batch này là hoàn thành hoặc giống ảnh.**

Chi tiết thay đổi thực tế, PNG, số liệu và việc chưa làm ở [reference-match/status.md](reference-match/status.md). Giữ chính sách nhãn và dữ liệu batch C. Chỉ người dùng mới quyết định cho thêm ngân sách sửa hoặc đổi chính sách review; không tự reset state/bỏ gate để tiếp tục.

## 14. Plan cổng nối riêng và camera focus/navigation — đã duyệt và triển khai

### Yêu cầu và hiện trạng đã kiểm tra

Người dùng yêu cầu lập implementation plan: các nhánh phải ra từ các đầu riêng để giảm chồng/chéo ống; click khối phải focus; camera phải di chuyển ngang và trước/sau được. Kế hoạch ban đầu chỉ sửa tài liệu. Sau đó người dùng trả lời “xác nhận”, cho phép triển khai gói mục 14; kết quả ở phần bàn giao cuối mục.

Đã kiểm tra manifest: React ^19.3.1, TS ~6.0.3, Vite ^8.3.4, Three 0.186.1, Fiber 9.8.2, Router 8.5.0; Yarn 1.22.22. Handoff auth và phạm vi dev-only vẫn áp dụng.

- `DataPipe` trong `resource-scene.tsx` tự tính curve từ tọa độ tâm. Các cạnh cùng cha có chung đầu `(sx, -0.3, sz + offset)`; không có port/lane riêng. Đổi màu hoặc offset ngẫu nhiên không giải quyết nguyên nhân này.
- `layoutResources` bố trí con thành lưới gần vuông. Con hàng sau có thể cần đường đi qua cụm hàng trước. Chỉ tách đầu ống không bảo đảm tránh xuyên node.
- `SceneController` đặt `enablePan = false`, giới hạn polar angle; `selectedId` chỉ phục vụ nhãn. Chưa có camera focus theo selection. `minDistance` theo span toàn cảnh có thể ngăn zoom gần một khối khi cây lớn.
- Controls hiện được tạo lại theo layout/reset/resize. Phải tách lifecycle controls khỏi cập nhật camera để resize không tự xóa góc nhìn người dùng.

### Hành vi đề xuất để người dùng xác nhận

1. Mỗi quan hệ cha→con có một cổng ra riêng trên cha và một cổng vào trên con. Workspace dùng vành cổng theo phía nhánh; Project dùng các cổng trên dải ở chân thân. Cổng không được đặt trùng, không xuyên vỏ; cùng dữ liệu/thứ tự cho cùng kết quả. Không tạo cổng cho cạnh ngoài scope.
2. Bỏ lưới con nhiều hàng trong cùng nhánh, chuyển sang dải subtree không chồng lấn: các nhánh con nằm ngang, cha ở giữa; dành khoảng trống định tuyến giữa các tầng. Khi đông con, tăng chiều rộng dải cổng/đế và khoảng cách cụm theo số cạnh, không chồng cổng vào thân cố định và không bỏ bớt tài nguyên. Phần thân model giữ kích thước. Đây là thay đổi bố cục và chân cổng cần duyệt.
3. Sắp cổng theo vị trí nhánh và thứ tự input khi hòa; đường đi theo lane riêng, có đoạn thoát theo pháp tuyến cổng và góc bo. Giữ khoảng cách lớn hơn đường kính ống cộng khoảng hở. Không dùng curve tự do có thể overshoot vào node. Luồng màu vẫn chạy cha→con trên chính đường ống đó.
4. Click khối, click nhãn hoặc kích hoạt mục HTML đều chọn cùng ID, cập nhật panel và đưa camera tới khối, giữ hướng nhìn hiện tại và đủ lề quanh model/cổng. Click lại khối đang chọn cũng focus lại. Không tự đổi scope; Khám phá/breadcrumb vẫn là thao tác riêng. Tab hoặc hover chỉ hiện nhãn, không kéo camera.
5. Focus dùng chuyển động khoảng 350 ms, ease-out, nội suy cả camera position và controls target. Thao tác camera mới hoặc chọn khối khác ngắt/chuyển tiếp từ vị trí hiện tại. Reduced motion chuyển ngay; tab ẩn dừng và hoàn tất đích hợp lệ khi hiện lại, không nhảy theo delta tích lũy. Bỏ chọn giữ góc hiện tại.
6. Chuột: kéo trái xoay, kéo phải hoặc Shift+kéo trái để pan, cuộn để tiến/lùi theo hướng nhìn (dolly). Touch: một ngón xoay, hai ngón pan/pinch. Pan đồng thời dịch camera và điểm nhìn; không chỉ xoay quanh tâm cũ.
7. Thêm nhóm nút HTML có tên truy cập: trái/phải, tiến/lùi trên mặt phẳng bản đồ, gần/xa theo hướng nhìn, và focus khối đang chọn. Các nút giúp người không dùng chuột phải/touch vẫn điều khiển được. Tiến/lùi trên mặt phẳng là dịch cả camera và target; khác với gần/xa là đổi khoảng cách nhìn. Không thêm chế độ bay tự do/WASD trong batch này.
8. Giữ giới hạn không xuyên sàn, nới góc đủ quan sát cạnh bên; pan giới hạn theo bounds scene cộng lề. Zoom gần dựa kích thước model, không dựa span toàn cây; zoom xa đủ thấy toàn scope. Đặt lại góc nhìn luôn fit toàn scope và giữ selection. Đổi scope fit scope mới; resize giữ target/hướng, chỉ sửa projection và khoảng cách nếu cần tránh cắt đối tượng.

### Phân tách file và interface dự kiến

Các tên mới dưới đây là đề xuất triển khai, chưa tồn tại. Không đổi ResourceNode, backend DTO, validation hay identity.

| File/module | Trách nhiệm |
|---|---|
| `types/workspace-3d/resource-map.types.ts` | Thêm kiểu trình bày ResourcePort, ResourceRoute và lệnh camera; cạnh tham chiếu port/route theo ID, không thêm vào ResourceNode |
| `math/workspace-3d/resource-layout.ts` | Bố trí subtree thành dải, tính bounds node/cụm và giữ thứ tự input |
| `math/workspace-3d/resource-routing.ts` (mới) | Hàm thuần cấp cổng/lane, trả endpoint, normal và các điểm điều khiển; kiểm khoảng hở với bounds/cạnh |
| `math/workspace-3d/resource-camera.ts` (mới) | Tính pose fit/focus/pan/dolly, clamp khoảng cách/giới hạn; không sở hữu controls hoặc React state |
| `graphics/workspace-3d/resource-hardware.tsx` | Nhận ports đã tính và vẽ socket/đế tương ứng; không tự tính quan hệ/layout |
| `graphics/workspace-3d/resource-scene.tsx` | DataPipe dùng route có sẵn cho cả mesh/vệt màu; truyền lệnh camera và preference |
| `graphics/workspace-3d/resource-camera-controller.tsx` (mới) | Sở hữu OrbitControls và transition refs, invalidate demand-frame, cleanup listener; tách khỏi chiếu nhãn |
| `views/workspace-3d/workspace-3d.view.tsx`, CSS | Phát lệnh focus có sequence để click lại cùng ID hoạt động; nút điều khiển và hướng dẫn; không tự dịch chuyển khi chỉ Tab |
| `__tests__/workspace-3d/` | Mở rộng test chính thức cho routing, camera và tương tác; helper/evidence AI vẫn chỉ ở `.agents/workspace-3d/` |

Camera command dự kiến là `{ sequence, type, resourceId? }` với type hữu hạn cho focus/reset/pan/dolly; số bước do camera policy quyết định. `selectedId` vẫn là nguồn dữ liệu panel/highlight. `focusedId` hiện tại chỉ là keyboard focus để ghim nhãn, không dùng thay lệnh camera. Ports/route tính một lần khi layout đổi; không setState mỗi frame.

### Thứ tự implementation sau xác nhận

1. Tách math bounds/layout/routing, thêm test trước các case nhiều nhánh. Chốt khoảng hở theo kích thước mesh thực, không theo pixel ảnh.
2. Renderer dùng cùng ports/route, thêm socket và kiểm đầu ống trùng tâm socket/pháp tuyến; giữ lifecycle vật liệu/geometry và luồng thời gian hiện có.
3. Tách controls/controller khỏi label projection, thêm pose math và lệnh focus/reset. Tránh effect resize/layout vô tình ghi đè selection transition.
4. Nối selection từ mesh/label/HTML, thêm nút pan/dolly và hướng dẫn chuột/touch; chống click bị phát sau thao tác kéo bằng ngưỡng pointer movement.
5. Self-review, test phù hợp, Yarn lint/build, diff check; kiểm browser và lưu bằng chứng; mở review diff trong Codex. Không commit/reset/revert, không đọc .env, không thêm dependency.

### Tiêu chí nghiệm thu bổ sung

| Case | Kết quả cần chứng minh |
|---|---|
| P01 | Demo 6 node: 5 cạnh, các cổng ra cùng cha khác tọa độ; đầu ống khớp socket, chiều cha→con |
| P02 | Demo 30 và fixture 1 cha/12 con: không cổng trùng; ống không xuyên bounds node ngoài hai đầu; không giao/chồng thể tích giữa các lane theo kiểm tra hình học trong layout chuẩn |
| P03 | Các đoạn bo được kiểm tra toàn đường, không chỉ control points; finite coordinates, độ cong và khoảng hở hợp lệ, không ẩn cạnh để qua test |
| P04 | Rename giữ ID không đổi route/selection; thêm/xóa node cập nhật đủ cổng và cạnh; các cổng có thể bố trí lại khi số con đổi, không hứa giữ nguyên vị trí tuyệt đối |
| P05 | Mesh/label/HTML click cùng ID cho cùng target; click lại focus lại; Tab/hover không di chuyển; kéo camera không vô tình chọn |
| P06 | Focus node ở xa của demo 30: node nằm trong viewport với lề ở desktop/màn hẹp, panel đúng ID; không cần đổi scope |
| P07 | Pan chuột/nút/touch dịch cả position và target; dolly thay khoảng cách; reset fit scope và vẫn giữ selection |
| P08 | Transition bị ngắt đúng; reduced motion tức thời, hidden tab không chạy nền; demand frame vẫn hoàn tất focus khi hiệu ứng ống tắt |
| P09 | Resize giữ hướng/target hợp lệ; đổi scope/reset không bị lệnh focus cũ kéo camera trở lại; node mất/hết scope hủy lệnh cũ an toàn |
| P10 | StrictMode/unmount không rò controls/listener/frame; WebGL fallback và danh sách HTML còn dùng được; auth/production boundary không thay đổi |

W01–W16 trước đây chạy lại phần chịu tác động. Browser phải có ảnh/góc toàn cảnh và focus xa, trước/sau pan; không dùng build pass thay kiểm visual. Test hình học chỉ chứng minh layout/fixture và bounds kiểm tra, không bảo đảm các ống không đè hình chiếu 2D ở mọi góc orbit. Khi nhìn từ góc thấp, hai đường tách trong 3D vẫn có thể trùng hình chiếu; không hứa loại bỏ điều đó bằng tách port.

### Trade-off và phạm vi chưa làm

- Dải subtree dễ kiểm soát đường hơn lưới, nhưng bản đồ rộng hơn; focus/pan là phần đi cùng để người dùng khám phá. Chưa có giới hạn số node/benchmark được duyệt; không khẳng định tối ưu mọi quy mô.
- Socket/đế cổng động làm đổi phần chân hardware. Batch chỉ thay khu vực kết nối cần thiết; không tiếp tục lookdev/tái tạo Project/Dataset đang hard-stop ở mục 13, không reset ngân sách img2threejs.
- Không thêm upload/CRUD/API/storage/AI hoặc đổi chính sách nhãn. Không tự thêm minimap, auto-clustering, chế độ bay hay phụ thuộc thư viện camera mới.
- Gói layout dải + cổng riêng + focus + pan/nút điều khiển đã được người dùng xác nhận sau khi lưu plan. Các mô tả đề xuất ở trên được giữ để đối chiếu với implementation bên dưới.

### Bàn giao implementation mục 14 (28/10/2026)

Đã triển khai bằng apply_patch, không thêm dependency. Chỉ sửa module Workspace 3D, test chính thức và tài liệu này; không sửa auth/entry/handoff hoặc phần tái tạo vật liệu/model đang hard-stop ở mục 13. Riêng chân cổng/socket thay đổi đúng phạm vi đã duyệt.

**Ống và layout:** các subtree nằm trong dải ngang riêng. `tierGap = max(7.5, descendants.width * 0.4)` tạo chiều sâu đủ cho fan rộng; pitch cổng 1.1 đơn vị và radius ống 0.18. Đây là đơn vị scene, không phải kích thước dữ liệu. Ban đầu pitch 0.72 với khoảng tầng cố định gây khoảng cách giữa ống nhỏ hơn 0.41 trên fixture đông; test phát hiện và đã sửa cách bố trí, không giảm ngưỡng test. Workspace dùng thanh cổng ở phía trước vành; Project dùng thanh ở chân. Khi nhiều con, thanh dài thêm, thân giữ kích thước. Đây là phiên bản thanh cổng phía trước của phương án vành cổng/phía nhánh đã đề xuất, không phải các lỗ xuyên theo từng góc trên vành tròn.

`routeResources` là hàm thuần: sao chép positioned nodes, cấp cổng theo quan hệ thật và trả nodes/edges có route. Curve cubic Bézier có control points nằm trong hành lang, đầu/cuối theo pháp tuyến Z; không dùng Catmull-Rom tự overshoot. DataPipe và vệt màu dùng cùng curve. Geometry/model không tự phát sinh quan hệ.

**Camera:** controller riêng sở hữu OrbitControls, tách khỏi label projection. Pan đã mở, dùng mặt phẳng sàn; khoảng cách gần tối thiểu 4 đơn vị, góc polar 0.15 đến PI/2−0.06 để không đi dưới sàn. Fit/focus tính từ model và độ rộng thanh cổng, theo aspect. Lệnh focus có sequence nên click lại cùng ID vẫn chạy; Tab/hover không phát lệnh. Transition 350 ms ease-out cập nhật position và target qua refs, không setState mỗi frame. `start` của controls ngắt transition; hidden tab dừng, lúc trở lại hoàn tất đích; reduced motion chuyển ngay. Demand rendering được invalidate trong lúc chuyển.

Resize giữ hướng/target, khi aspect hẹp hơn thì tăng khoảng cách; không tạo lại controls. Scope/layout/reset fit lại scope, hủy lệnh cũ. Bỏ chọn giữ pose. Nút pan tiến/lùi dịch trên mặt phẳng; gần/xa đổi khoảng cách tới target. Controls/DOM listener cleanup được kiểm tra StrictMode.

**Cách dùng:** click khối/nhãn/mục HTML để chọn và focus. Kéo trái để xoay; kéo phải hoặc Shift+kéo trái để pan; cuộn để nhìn gần/xa. Có nút trái/phải/trước/sau/gần/xa và “Tới khối đã chọn”. “Đặt lại góc nhìn” fit toàn scope nhưng giữ selection. Khám phá và breadcrumb vẫn đổi scope riêng. Touch dùng cấu hình OrbitControls một ngón xoay, hai ngón dolly-pan; chưa nghiệm thu trên thiết bị cảm ứng thật.

**Kiểm chứng thực chạy:**

- Full suite: **288/288 test, 14 file**. Sau đó bổ sung assertions vào test controller có sẵn cho ID không tồn tại/scope đổi và chạy lại file đó: **6/6 test đạt**; tổng số test không tăng. Yarn lint/build đạt; diff check đạt. Không dùng kết quả này để khẳng định GPU/performance hoặc BE hoạt động.
- Routing tests dùng demo 6/30, 1 Project/12 Dataset và 1 Workspace/12 Project: cổng duy nhất, tiếp tuyến hướng cha→con, tọa độ hữu hạn, samples không vào bounds node không liên quan và khoảng cách tâm ống > 0.41 (hai bán kính 0.18 cộng lề 0.05). So sánh mọi cặp 101 samples mỗi curve; **đây là kiểm tra rời rạc trên fixture, không phải chứng minh liên tục cho mọi quy mô**. Test rename/purity/idempotence, thêm/xóa/validation hiện có vẫn đạt.
- Tests camera dùng PerspectiveCamera/OrbitControls thật trong jsdom: focus xa, click lại, pan/dolly/reset, resize không tạo listener lại, ngắt bằng wheel, hidden/resume, reduced motion và demand frames; pointer events xác nhận kéo phải và Shift+kéo trái pan mà giữ hướng. UI tests kiểm activation từ mesh callback/HTML, Tab chỉ ghim nhãn. Không gọi jsdom là GPU browser.
- Browser tích hợp: click trực tiếp mesh Project Bán hàng chọn đúng panel và focus; chọn nhãn cũng focus; kéo xoay giữ selection; vào Project còn 3 node, về tổng quan 6 node. Demo 30 còn 5 nhãn ở overview; chọn Dataset 25 focus đúng khối và panel, không đổi scope. Pan trái làm tọa độ nhãn Dataset 25 dịch từ x=512.109 sang x=616.336 trên canvas rộng 1024.219px. Nút tiến hoạt động ở màn hẹp.
- Responsive 390×844: canvas 341×380; clientWidth=scrollWidth=375px, không tràn ngang. Focus Dataset xa vẫn nằm trong scene. Desktop kiểm ở 1440×1000. Browser error log không có error tại thời điểm kiểm.
- Production build 226 modules; không emit chunk preview/Three và không tìm thấy `demo-workspace`, `OrbitControls`, `Điều khiển camera`, `workspace-3d-preview` trong dist. Auth/preview boundary tests vẫn đạt.
- Ảnh browser: [6 tài nguyên](navigation-overview-6.png), [30 tài nguyên](navigation-overview-30.png), [cổng và focus Project](navigation-ports-focus.png), [focus Dataset xa](navigation-focus-30.png), [pan](navigation-pan-30.png), [màn hẹp](navigation-mobile-focus.png). Ảnh không phải concept AI.

**Cách đọc code/lỗi cho fresher:**

```ts
const selectAndFocus = (id: string) => { onSelect(id); issueCamera('focus', id) }
```

Một lần click làm hai việc riêng: chọn ID để panel/highlight đồng bộ, rồi phát lệnh camera. Tăng sequence giúp cùng ID vẫn có lệnh mới. `focusedId` của bàn phím chỉ dùng chính sách nhãn, không thay selectedId.

```ts
camera.position.lerpVectors(motion.from.position, motion.to.position, eased)
controls.target.lerpVectors(motion.from.target, motion.to.target, eased)
```

Di chuyển cả camera và điểm nó đang nhìn giúp khối vào trung tâm; chỉ đổi position thì vẫn có thể nhìn về tâm cây cũ. Các mutation này thuộc Three.js renderer, không phải sửa React state. Phần math tính pose được tách để test không cần GPU.

Nếu assertion khoảng hở báo `expected ... to be greater than 0.41`, hãy đọc stack về `resource-navigation.test.ts`: hai mẫu đường tâm đang gần hơn đường kính cộng lề; kiểm pitch/hành lang/curve trước, không giảm ngưỡng để test qua. Dữ liệu parent sai vẫn đọc thông báo validation chứa `parentId`; không tự tạo cha giả. Lệnh focus ID không còn trong layout bị hủy và giữ pose hiện tại; scope đổi dùng pose fit mới.

**Giới hạn:** cây dạng dải rộng hơn và các model nhỏ khi fit toàn cảnh đông tài nguyên; dùng focus/pan hoặc Khám phá. Không bảo đảm không trùng hình chiếu ở mọi góc orbit. Chưa benchmark FPS/GPU memory, chưa kiểm touch vật lý, Chrome riêng hoặc chủ động gây mất context GPU thật; reduced motion/visibility/context failure có bằng chứng test như trên. Không triển khai bay tự do, minimap hoặc lookdev phần mục 13. Build không chứng minh visual/motion tự đúng. Không commit/reset/revert, không đọc/in .env; formatter không được chạy và không có file phụ trợ mới ngoài `.agents/workspace-3d/`.

## 15. Change plan — bỏ thanh chia, cổng âm và socket ngắn (chờ xác nhận)

### Đối chiếu lại ảnh và nhận lỗi thiết kế

Người dùng chỉ ra thanh ngang và đầu đen nhô dài không đúng reference. Đã xem lại ảnh concept gốc (hub Đồ án, Project Bán hàng/Khảo sát và cartridge) và source hiện tại. Ảnh mới của người dùng thể hiện rõ socket Project nhô ra bên cạnh thân và thanh ở chân đang làm sai silhouette.

- Reference: Workspace có socket nằm trong mặt ngoài của vành tròn, miệng viền mỏng; không có thanh chia phía trước. Project có điểm nối gắn trực tiếp vùng hông/chân thân; không có một thanh phân phối riêng. Ảnh không chứng minh cấu tạo mặt sau, cũng không quy định cách chứa hàng chục cổng.
- Source: `ResourceHardware` hiện thêm RoundedPart thanh ngang theo `connectionWidth` và một khối đen nối thanh với thân. `routeResources` đặt đầu ra ngoài thân ở Z=2.15/1.3, nên chỉ xóa thanh sẽ khiến socket/ống treo ngoài vỏ.
- Socket hiện dùng cylinder đen dài 0.5 cho đầu vào và 0.2 cho đầu ra, radius 0.25. Torus quay theo mặt Z cố định; chưa dùng normal để xoay theo bề mặt. Đây là nguyên nhân vừa nhô dài vừa không phù hợp cổng bên hông.
- Mục 14 đã giải quyết tách luồng/camera nhưng thanh chia là cách triển khai lệch reference. Ghi nhận phần đó bị thay thế bởi mục 15 sau khi được duyệt; không dùng test pass để biện minh độ giống ảnh.

### Kết quả cần đạt

1. Bỏ hoàn toàn thanh ngang và khối đen chống/nối thanh. Không thay bằng thanh hoặc hộp chia khác.
2. Workspace: mỗi cạnh có socket âm trực tiếp vào vành, phân bố quanh vành theo phía nhánh; thân/vành không phình theo số con. Viền mỏng gần sát vỏ, ống bắt đầu ở mặt miệng cổng. Cổng âm phải có hốc/chiều sâu nhìn được ở góc xiên; không dán đĩa đen lên mặt kim loại kín rồi gọi là lỗ.
3. Project: các cổng ra nằm **trên cùng một bên hông** của thân, không trải sang thanh phía trước, không có ống chia chung. Mỗi quan hệ vẫn có một cổng riêng để giữ yêu cầu tách luồng trước đó. Cổng vào được đặt riêng để không trùng cổng ra; hướng hông nào và vị trí vào cần review bằng ảnh góc trước/hông.
4. Giảm phần đen lộ ra: đề xuất phần collar ngoài vỏ tối đa 0.06 đơn vị scene; phần còn lại nằm trong hốc. Đây là giá trị khởi điểm để review visual, không phải số đo lấy chính xác từ pixel ảnh. Giữ đủ lòng cổng cho ống radius 0.18; không thu socket nhỏ hơn ống hoặc chỉ đẩy cylinder vào khối đặc gây z-fighting.
5. Dataset giữ silhouette hiện tại; rút ngắn collar đầu vào theo cùng quy tắc nếu đang nhô dài. Giữ camera, ID, panel, breadcrumb, chính sách nhãn và luồng cha→con.

### Phương án kỹ thuật và file chịu tác động

- Tạo `math/workspace-3d/resource-connection-profile.ts` làm nguồn chung cho kích thước bề mặt thân, vị trí cổng, radius/collar/recess và khoảng hở. Đây là hình học trình bày, không phải nghiệp vụ hay backend DTO. Không giữ hai bộ hằng số khác nhau ở renderer/routing.
- `resource-hardware.tsx`: gỡ thanh và connector đen; sửa riêng vùng panel/vành cần lỗ. Dùng mặt vỏ được dựng có cutout, inner sleeve và viền mỏng, tận dụng Shape/ExtrudeGeometry hoặc mesh bề mặt thủ tục; không thêm thư viện Boolean/CSG. Giữ trục local của socket thống nhất và xoay bằng `port.normal`, không cố định cả scene theo Z. Dispose geometry tự tạo.
- `resource-routing.ts`: tính điểm ra đúng trên vành/hông và điểm vào đúng trên vỏ; đoạn đầu/đoạn cuối theo pháp tuyến thực. Giữ source/target ID và cổng riêng theo edge. Không chỉ đổi tọa độ socket mà giữ curve cũ.
- `resource-map.types.ts`: nếu cubic đơn không đủ đi vòng thân, đổi route sang danh sách đoạn cubic liên tục. Renderer và flow cùng dùng đường ghép, không tự tính lại path khác.
- `resource-layout.ts`: điều chỉnh khoảng trống quanh hông và hành lang liên tầng để đường ra bên hông đi vòng ngoài thân rồi mới đi tới con. Cấp lane theo thứ tự nhánh; kiểm cả đoạn thoát hông lẫn phần fan. Không đặt nhiều cổng chung vị trí để giữ scene gọn.
- `resource-scene.tsx`: dùng route mới cho mesh và vệt màu. `resource-camera.ts`: bỏ bounds theo thanh `connectionWidth`, dùng bounds vỏ/socket thật để focus không chừa khoảng trống cho thanh đã xóa. Không đổi controller/UX camera nếu không phát hiện lỗi liên quan.
- Tests chính thức cập nhật theo geometry/routing mới; tài liệu và ảnh review chỉ lưu `.agents/workspace-3d/`. Không thêm dependency, không sửa auth/API/upload, không commit/reset/revert hoặc đọc .env.

### Điểm phải chốt trước implementation

Một mặt hông/vành cố định có diện tích hữu hạn. Không thể vừa giữ kích thước vỏ và đường kính ống cố định vừa chứa số cổng không giới hạn. Trước code cần duyệt chính sách khi vượt sức chứa, không tự chọn threshold/ẩn node/gộp cạnh.

Đề xuất: ưu tiên cổng âm trong vỏ cố định cho demo hiện có và case 12 con; cấp hàng/cột trên **cùng mặt hông** cho Project nếu đủ khoảng hở thực. Nếu vượt sức chứa tính từ kích thước vỏ/ống, phương án mở rộng là tăng chiều cao thân Project/vành Workspace theo hàng cổng, không thêm thanh ngoài. Phương án này làm đổi silhouette khi đông con, nên cần người dùng duyệt riêng; chưa mặc định triển khai. Sức chứa thực phải tính cùng profile, không coi 12 là giới hạn nghiệp vụ.

### Thứ tự và nghiệm thu

1. Chốt gói cổng âm + cùng một hông + collar ngắn, và chính sách vượt sức chứa. Đo/profile các bề mặt có thể đặt cổng; báo nếu case 12 không thể đặt vừa theo kích thước thật.
2. Làm vùng socket trên Workspace/Project, review close-up trước/hông và cùng ảnh tham chiếu; chưa chạy lookdev hay tự reset pipeline img2threejs đang dừng ở mục 13. Nếu cần tiếp tục reconstruction theo skill, phải xử lý hard-stop riêng, không đổi state/bỏ gate âm thầm.
3. Nối routing theo normal, kiểm đường đi đủ khoảng hở, rồi cập nhật camera bounds. Giữ các tính năng mục 14 khác.
4. Test 6/30 tài nguyên và case đông con được duyệt: số node/cạnh giữ nguyên; mỗi cổng đúng bề mặt, không trùng; phần collar ngoài không vượt profile; curve không xuyên vỏ/node và các ống không giao thể tích trong các fixture. Kiểm rename/selection/focus/reset/lifecycle/fallback như trước.
5. Browser góc trước, hông và thấp phải thấy không còn thanh, cổng có hốc thật, phần đen ngắn và ống gắn đúng miệng. Lưu ảnh cận socket, toàn cảnh và focus desktop/màn hẹp; không lấy unit/build thay visual review. Chạy Yarn test phù hợp, lint/build, diff check; mở Codex review diff.

Lượt lập change plan này chỉ sửa tài liệu. Chưa chỉnh source/geometry, chưa chạy lại test sản phẩm, chưa cấp thêm vòng sửa img2threejs.

### Quyết định và bàn giao sau ảnh concept — 29/10/2026

Người dùng sửa yêu cầu: **giảm cỡ ống đồng bộ, không tăng kích thước thân**; đã xem ảnh minh họa và xác nhận. Quyết định này thay phương án tăng chiều cao khi nhiều cổng ở phần plan trên. Sau đó người dùng nhận xét “oke tạm ổn” và yêu cầu lập plan upload thật; plan mới ở [upload-implementation-plan.md](upload-implementation-plan.md), chưa triển khai upload.

Đã bỏ thanh ngang và connector đen. `resource-connection-profile.ts` gom thông số cổng/ống: bán kính ống cơ sở **0.09**, giảm một nửa so với 0.18 trước đó; tất cả ống/socket/vệt màu dùng cùng gauge của toàn bộ cây, không đổi gauge khi chỉ chuyển scope. Với nhiều cổng, gauge toàn cây giảm theo diện tích vùng cổng cố định, không nới thân, không gộp/ẩn cạnh. Khi quá đông, cổng sẽ khó đọc hơn; chưa có cam kết hỗ trợ mọi số lượng node/thiết bị.

Workspace đặt cổng theo pháp tuyến xuyên tâm trên vành r=1.7. Project đặt cả inlet/outlet trên một mặt hông X=0.85, thành hàng dọc; không còn thanh chia. Socket là sleeve rỗng nằm trong hốc với viền ngoài chỉ khoảng 0.017 đơn vị ở gauge lớn nhất. Dataset rút ngắn đầu vào theo cùng profile. Giữ kích thước bao thân; thay riêng cấu tạo lớp vỏ để tạo hốc thật.

`connection-geometry.ts` dùng Shape có holes và ExtrudeGeometry cho panel hông/đuôi; mặt bao vành được cắt lỗ trong tọa độ trải phẳng rồi chia nhỏ và uốn về vành tròn. Đây là geometry có lỗ, không phải dán đĩa đen lên mặt kín. Geometry tự tạo được dispose; sleeve/back cap nằm trong thân. Các chi tiết vật liệu/lookdev tổng thể vẫn chưa tái tạo đầy đủ ảnh concept và không reset state img2threejs mục 13.

Route hiện gồm các đoạn cubic nối liên tục, thoát/đi vào theo normal của socket, đi qua hành lang ngoài thân. Renderer tube/vệt màu cùng dùng CurvePath. Bounds camera đã bỏ chiều rộng thanh cũ. Identity, focus/pan/reset, nhãn, auth và demo boundary giữ nguyên.

Kiểm chứng: **291/291 test, 15 file đạt**, Yarn lint/build đạt. Có 3 test bổ sung dùng raycast geometry thật để kiểm lỗ xuyên trên panel/vành và gauge/cổng cùng mặt hông. Routing tests 6/30, Project 12 Dataset và Workspace 12 Project đạt với radius mới, kiểm hướng pháp tuyến và khoảng hở hai bán kính cộng 0.015; thay đổi lề này đi cùng giảm kích thước ống, không dùng ngưỡng 0.41 của tube cũ cho tube mới. Một lượt full suite ban đầu timeout ở test kiểm đường vì quá nhiều assertion trong vòng lặp; đã giữ toàn bộ samples/cặp so sánh, gom kết quả và assert cuối nên full suite hoàn tất. Không tăng timeout hoặc bỏ kiểm tra.

Browser preview đã render, chọn Project và nhìn gần/hông: không còn thanh, ống nhỏ, cổng sát thân. Ảnh [Project](recessed-project-full.png) và [góc hông](recessed-project-side.png). Chưa đo GPU memory/FPS hoặc kiểm touch vật lý; test hình học không chứng minh không trùng hình chiếu ở mọi góc. Không có live upload/backend test trong batch này, không commit/reset/revert, không đọc/in .env.
