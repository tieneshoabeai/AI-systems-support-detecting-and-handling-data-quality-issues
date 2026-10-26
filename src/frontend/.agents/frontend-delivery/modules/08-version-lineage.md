# Module 08 — Version/Lineage và kiểm tra toàn vẹn

Trạng thái: plan; owner/reviewer chỉ định trước batch. FE B hỗ trợ graphics adapter, FE A review session/resource boundary; không tự gán thêm ownership. Nguồn: [audit](00-contract-audit.md), Swagger live, backend `modules/lineage/lineage.controller.ts`, `lineage.service.ts`, `dto/lineage.dto.ts`, `lineage-queries.cypher.ts`.

## 1. Yêu cầu và phạm vi

Xem graph dataset, chọn node để truy upstream/downstream và yêu cầu server verify integrity. Version history/rollback mục tiêu trong spec chưa có API: không tạo nút rollback hoạt động hoặc dùng graph để suy ra một contract history chính thức.

Graph là projection Neo4j, có thể chưa sẵn ngay sau ingestion ACK. FE hiển thị trạng thái tải/lỗi/chưa có graph riêng, không biến graph thiếu thành dataset bị mất. Không tự tính hash FE rồi gọi đó là kiểm tra toàn vẹn server.

## 2. Đặc tả sáu mục

| Mục | Nội dung |
|---|---|
| Đầu vào | datasetId cho graph/verify; node id backend cho upstream/downstream, khác display id của scene |
| Điều kiện | Phiên/quyền đọc Lineage theo server; resource tồn tại; Neo4j khả dụng; không cần quyền FE giả từ token cũ |
| Xử lý | Load graph → map giữ hướng cạnh/id → selection → trace; verify dùng GET hoặc POST đã xác nhận, một action không gửi cả hai |
| Đầu ra | DTO graph/trace/verify theo source; invalid chain khác request thất bại; không giả thêm version |
| Xếp loại | graph loading/ready/unavailable/error; trace loading/empty/error; verify checking/valid/invalid/unknown-error |
| Thứ tự | Dataset context trước graph; raw node identity trước trace; server ACK trước kết luận verify; response scope cũ không cập nhật view mới |

## 3. Năm operation và DTO static

| API sau `/api/v1` | T theo source/DTO |
|---|---|
| GET `/lineage/{dataset_id}` | dataset_id,dataset_name?,nodes,edges,total_nodes,total_edges |
| GET `/lineage/node/{id}/upstream` | node_id,root_version_id nullable,hops_to_root,upstream_versions,transformations |
| GET `/lineage/node/{id}/downstream` | node_id,downstream_count,downstream_versions,affected_models_count,affected_exports_count |
| GET `/lineage/verify-integrity/{dataset_id}` | dataset_id,is_valid,total_versions_checked,broken_version_number nullable,message |
| POST `/lineage/verify-integrity/{dataset_id}` | Cùng service verify và kiểu trên; OpenAPI runtime hiện mô tả 200 nhưng chưa có response schema |

Graph node `{ id,label,type,data,position? }`, type dataset/version/transformation; position là `{ x,y }` gợi ý 2D. Edge `{ id,source,target,type,label?,animated }`. `data` là record unknown; mapper chỉ dùng field đã xác nhận.

Source graph tạo display ids `dataset_…`, `version_…`, `trans_…` và giữ raw id trong node.data.id. Upstream/downstream phải đối chiếu Cypher/fixture để dùng **id node thực BE yêu cầu**, không gửi nguyên display prefix do renderer tạo. Không tự suy dataset node cũng có thể trace cùng kiểu version node.

DTO field verify là `is_valid` và `broken_version_number`, không phải isChainValid/brokenVersion trong spec. Source có default/empty branches; muốn kết luận 0 version valid hay unknown cần đọc semantic và fixture, không suy từ boolean đơn lẻ. HTTP status thực POST cần kiểm thử vì annotation response không thay HttpCode runtime.

## 4. UI/files/cache và graphics

- Route `/datasets/:datasetId/lineage`, entry dưới app/pages/private; domain views/components/hooks/services/types versions-lineage; test `src/__tests__/versions-lineage/`.
- Graph adapter ở graphics nhận model nodes/edges, không gọi HTTP; giữ source→target theo payload, không đảo để đồ thị trông đẹp. Selection callback trả identity cả display/raw khi cần.
- Trace panel phụ thuộc selected node; đổi node/dataset cancel/ignore result cũ. Không đòi React Flow chỉ vì source mô tả graph dạng React Flow; Three/Fiber đã duyệt, chọn presentation chi tiết trước code scene.
- Query keys account+dataset graph, account+raw-node+direction trace; verify là user-triggered action, cache timestamp hiển thị lần kiểm tra, không diễn giải cache cũ là verify mới.
- Sau upload/transformation tương lai: invalidate graph; 404 có thể chưa có projection, chỉ cho retry chủ động. Poll/backoff tự động và timeout budgets chưa được duyệt, không tự loop vô hạn.
- BE/Neo4j lỗi: giữ lỗi riêng, không green status giả; outage snapshot nếu được phép chỉ ghi kết quả cũ, không gọi verify offline.

## 5. Test case dự kiến

| Mã | Nhóm | Input/sự kiện | Kết quả mong đợi | Lý do |
|---|---|---|---|---|
| L01 | Thường | Graph dataset+version có cạnh | Map identity/hướng/counter đúng payload | Graph |
| L02 | Biên | Một node, không cạnh | Render node, không tạo edge giả | Minimal |
| L03 | Đặc biệt | 404 sau upload ACK | Graph unavailable, dataset không bị xóa | Async |
| L04 | Thường | Chọn version display id có raw id | Trace dùng id đã xác nhận, panel đúng selection | Identity |
| L05 | Đặc biệt | Upstream/downstream arrays [] | Empty trace, không lỗi graph | Empty |
| L06 | Thường | Verify is_valid true, versions_checked hợp lệ | Hiện kết quả và thời điểm server trả, không giả local crypto | Verify |
| L07 | Đặc biệt | Verify is_valid false, broken_version_number n | Hiện chain invalid/n, không coi HTTP lỗi | Semantic |
| L08 | Không hợp lệ | Verify timeout/500/Neo4j lỗi | Unknown/error, không valid hoặc invalid chắc chắn | Failure |
| L09 | Đặc biệt | Chọn node B trước trace A về | Không hiển thị A dưới B | Race |
| L10 | Không hợp lệ | 401/403/dataset sai | Auth/denied/error thật, không fallback graph demo | Permission |
| L11 | Đặc biệt | Duplicate node/edge id, dangling edge | Validation/hiển thị lỗi dữ liệu; không tạo node nghiệp vụ giả | Integrity of UI |
| L12 | Đặc biệt | History/rollback action | Không gọi API chưa có | Scope |
| L13 | Biên | Verify 0 version, nullable raw id, missing data.id | Contract gate, không tự suy trace/valid status | Missing semantic |
| L14 | Đặc biệt | Unmount/renderer lỗi/reduced motion | Cleanup/fallback theo architecture, không mất panel DOM | 3D lifecycle |

L13 cần fixture và semantic BE trước code; không tự điền expected HTTP hoặc graph nodes không có. Numeric floating-point không là đầu vào verify; chỉ test ở math layer khi scene motion được duyệt. Chưa thực thi các case.

## 6. Pseudocode và dò tay

```text
GET graph trong account+dataset scope
validate nodes/edges và giữ id/hướng → adapter → view
selection đổi:
  lấy raw id theo mapping đã xác nhận
  NẾU thiếu id: báo chưa trace được, không đoán
  GET upstream hoặc downstream; apply khi selection vẫn đúng
verify click:
  session gate; gửi một operation đã chọn
  ACK hợp lệ → render is_valid, versions_checked, broken_version_number
  lỗi/malformed → unknown/error, không kết luận chain
```

Dò tay thường: graph edge V1→V2 giữ hướng; chọn V2 lấy raw id → trace panel V2. Dò tay biên: verify network timeout → unknown, không tô valid. Dữ liệu minh họa là model flow, không kết quả API thật.

## 7. Batch/gate/nghiệm thu

1. Chỉ định owner; xác nhận fixture graph/node-id/trace và permission, DTO/mapper + DOM panel.
2. Graph presentation/selection sau visual/3D spec; upstream/downstream với raw id rõ.
3. Verify semantic gồm empty/invalid chain và error; chọn GET hoặc POST cho UI sau kiểm tra status/runtime, không gửi kép.
4. History/rollback chờ backend riêng; không xử lý mutation version qua query graph.

Reviewer xác minh không expose raw infrastructure trong error, không đảo edges, không dùng projection làm nguồn chính thức thay dataset/version. Không sửa Neo4j hoặc thêm React Flow trong batch này.

## 8. Prompt triển khai và log

```text
CONTEXT: React 19.3.1/TS 6.0.3/Vite 8/Yarn, Three/Fiber đã cài; module 08 và audit là nguồn.
TASK: Chỉ implement batch Lineage/verify đã được duyệt ở mục 7, owner được chỉ định; không history/rollback.
INPUT: Năm operation mục 3, graph/trace/verify fixture và raw-node mapping được xác nhận. Không có response schema trong OpenAPI nên không gen response DTO giả.
CONSTRAINTS: Giữ source/target/id; không tự local verify/hash, không offline verify, không graph demo fallback; graphics không gọi API; cache/selection account scoped.
PSEUDOCODE: Mục 6; unknown khi lỗi khác is_valid false.
EXAMPLES: is_valid false + broken n → chain invalid; timeout → chưa kiểm tra được; graph 404 sau upload không xóa dataset.
OUTPUT: Patch theo file duyệt, code trọng tâm/flow một node, diff, test/static/runtime evidence riêng.
CRITERIA: L01–L14 theo batch; gate node-id/empty semantic chưa đạt thì dừng phần tương ứng, không đoán.
```

Log 1–5 ở mục 1/2–3/5/6/8. Code/tests/API nghiệp vụ/quyết định chấp nhận code chưa thực hiện. Source DTO được đọc không có nghĩa response runtime đã xác nhận.
