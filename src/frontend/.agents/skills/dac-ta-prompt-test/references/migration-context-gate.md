# Migration / Existing-system context gate

Dùng tài liệu này trước khi đặc tả code khi yêu cầu có source, prototype, review scene, demo, module cũ hoặc behavior cần giữ.

## 1. Chọn mode

| Mode | Khi dùng | Cách mô tả đúng |
|---|---|---|
| `port-fidelity` | Product mới phải giữ đúng geometry, interaction, logic hoặc behavior đã duyệt | “Port source-of-truth” |
| `approximation` | Chỉ cần cảm giác/hướng thiết kế tương tự, có khác biệt chấp nhận được | “Bản dựng lại có chủ đích” |
| `redesign` | Mục tiêu sản phẩm đổi, source cũ chỉ để tham khảo | “Thiết kế mới dựa trên mục tiêu” |

Không chọn `port-fidelity` nếu source hoặc acceptance criterion chưa tìm được. Không chọn `approximation` âm thầm khi người dùng yêu cầu giữ nguyên.

## 2. Source-of-truth map

| Nhóm | Path/source đã đọc | Trách nhiệm | Product destination | Evidence cần có | Trạng thái |
|---|---|---|---|---|---|
| Entry/route | | | | route test | |
| Model/factory hoặc business logic | | | | component/function map | |
| Config/material/asset | | | | parameter comparison | |
| Interaction/motion | | | | behavior test/video/screenshot | |
| Lifecycle/resource ownership | | | | cleanup/failure test | |
| Existing tests/evidence | | | | baseline result | |

`[CHƯA ĐỦ CONTEXT]` nếu một hàng load-bearing không có source hoặc contract. Nêu tối đa ba câu hỏi để lấy phần còn thiếu, không bù bằng giả định.

## 3. Migration mapping

| Source cũ | Product mới | Giữ nguyên | Chuyển đổi cần thiết | Không port | Test/evidence |
|---|---|---|---|---|---|
| | | ID, transform, material, validation hoặc API semantics | framework/lifecycle adapter | DOM review/export/mock | |

Mỗi source item phải có đúng một owner ở destination. Nếu product mới tự dựng lại thay vì dùng source, đánh dấu `approximation` và liệt kê delta.

## 4. Completion gate

Chỉ cho phép nói “end-to-end hoàn tất” khi có:

1. Static evidence: source build/type/lint/diff theo phạm vi.
2. Functional evidence: test các behavior giữ lại.
3. Runtime evidence: route, failure/fallback, lifecycle, cleanup trong môi trường phù hợp.
4. Fidelity evidence: so sánh với source qua screenshot, state, component IDs hoặc output contract.

Mỗi loại evidence phải ghi rõ pass, fail hoặc chưa chạy. Không nâng bằng chứng static thành runtime/fidelity.
