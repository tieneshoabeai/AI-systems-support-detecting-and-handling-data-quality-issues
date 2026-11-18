# Realtime, Audit và Overview

- Ngày lập: 2026-11-16.
- Loại: Checklist unit test và ca hồi quy.
- Nguồn (tương đối với `src/backend/src/`): modules/realtime; modules/audit; modules/overview; shared/utils/realtime-events.ts.
- Cô lập dependency: socket/transport, JWT/user/project/analysis ports, audit repository, overview repositories.
- Mỗi dòng là một nhóm ca; dấu `/` hoặc danh sách giá trị phải triển khai thành các ca riêng, không chỉ chọn một đại diện. Tất cả chưa thực thi.
- P0: quyền/dữ liệu/trạng thái cốt lõi; P1: logic và biên quan trọng. `RISK`/`GAP`/`OPEN` không phải khẳng định đã có lỗi được tái hiện.

## Các phần cần test

- [ ] **RTO-001 [P0]** Token từ auth.token và query token cùng có → ưu tiên auth; thiếu/rỗng/array sai → lỗi có chủ đích.
- [ ] **RTO-002 [P0]** Token sai/hết hạn/thiếu sub, user blocked/deleted → disconnect hoặc từ chối; không join room.
- [ ] **RTO-003 [P1]** Realtime disabled hoặc chưa gắn transport → không emit, không throw làm hỏng business flow.
- [ ] **RTO-004 [P0]** Connect hợp lệ → chỉ join room của chính user; không nhận userId tùy ý từ client.
- [ ] **RTO-005 [P0]** Join project hợp lệ/sai ID/ngoài quyền → chỉ join khi được phép, không lộ trạng thái nội bộ project khác.
- [ ] **RTO-006 [P0]** Join analysis có analysisId thuộc project khác với projectId được phép → từ chối; gateway hiện cần kiểm tra quan hệ run-project (RISK).
- [ ] **RTO-007 [P1]** Leave project/analysis hợp lệ/ID sai → rời đúng room, không rời toàn bộ room người khác.
- [ ] **RTO-008 [P0]** Payload realtime chứa email/reason/value/token hoặc dữ liệu ô → bộ lọc chặn; chỉ envelope được duyệt đi qua.
- [ ] **RTO-009 [P1]** Emit lifecycle → đúng tên event, project/run room và ID, timestamp, trạng thái; lỗi transport best-effort.
- [ ] **RTO-010 [P0]** Quyền bị thu hồi sau connect → yêu cầu cách ngắt room hoặc revalidate cần OPEN-08; không coi quyền lúc connect là vĩnh viễn.
- [ ] **RTO-011 [P1]** Audit log qua adapter/handler → đúng actor/action/resource/time, lưu một lần; field optional/null không crash.
- [ ] **RTO-012 [P0]** Audit payload có password/token/raw sensitive data → không ghi nguyên secret; chính sách fail-open/fail-closed khi audit lỗi cần OPEN-09.
- [ ] **RTO-013 [P1]** Overview user không có workspace/project → các count bằng 0 và response hợp lệ.
- [ ] **RTO-014 [P0]** Overview user/workspace → chỉ aggregate dữ liệu được phép, không tính deleted hoặc workspace khác ngoài contract.
- [ ] **RTO-015 [P1]** Workspace overview không tồn tại → NotFound; các count trạng thái/project/member/quota khớp fixture, không cộng trùng Owner.
- [ ] **RTO-016 [P1]** Repository overview/audit throw → mapping lỗi có chủ đích, không trả bộ số liệu 0 giả như thành công.
