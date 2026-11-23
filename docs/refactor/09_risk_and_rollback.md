# 9. Rủi ro & kịch bản rollback

> Đọc file này **trước khi bắt đầu** và bất cứ lúc nào nào cảm thấy "đang trượt".

---

## 9.1. Bảng rủi ro tổng

| # | Rủi ro | Khả năng | Tác động | Phát hiện | Giảm thiểu | Kịch bản dự phòng |
|---|---|---|---|---|---|---|
| R1 | **Hết giờ giữa chừng** | Cao | 🔴 Cao | Tự thấy | Đường cắt định nghĩa sẵn | Cắt P5 → P4 → P3 |
| R2 | **Trough of sorrow** — muốn bỏ giữa chừng | Cao | 🔴 Cao | Cảm giác | Tag mỗi phase | Reset về tag, làm tiếp từ đó |
| R3 | **Cải thiện ngầm** (silent behavior drift) | Trung bình | 🔴 Rất cao | Test đỏ | Test cũ giữ nguyên | Revert ngay khi test đỏ |
| R4 | **Test đỏ không tìm ra nguyên nhân** | Trung bình | 🟡 TB | Test đỏ | Giới hạn 15 phút | Revert module, ghi TODO |
| R5 | **Phá cascade xóa dữ liệu** | Thấp | 🔴 Rất cao | Integration test | **Không đụng logic** (T3-1) | Revert `datasets`/`projects`/`workspaces` |
| R6 | **Hết RAM khi xử lý dataset lớn** | Thấp | 🟡 TB | `ai-worker.spec.ts` | Không đụng `ingest-dataset-stream` | Revert `datasets` |
| R7 | **Lỗi bảo mật trong `auth`** | Thấp | 🔴 Rất cao | `auth` tests | **Không đụng logic** (T3-1) | Revert `auth` |
| R8 | **Thêm nhầm route mới** | Trung bình | 🟡 TB | `arch:api-coverage` | Check sau mỗi commit | Xóa route, chạy lại coverage |
| R9 | **Mất dữ liệu test fixture** | Rất thấp | 🟡 TB | Test đỏ | Không đụng `test/fixtures/` | `git checkout test/fixtures/` |
| R10 | **Conflict khi merge nhánh** | Trung bình | 🟡 TB | `git merge` đỏ | **Làm 1 nhánh duy nhất** | `git rebase` hoặc bỏ nhánh |
| R11 | **Conflict với code đồ án khác** | Thấp | 🟡 TB | Module khác hỏng | Chỉ đổi trong `src/backend` | `git checkout` file đó |

---

## 9.2. R3 — "Cải thiện ngầm" là rủi ro nguy hiểm nhất

> **Đây là kiểu lỗi mà test viết lại sẽ không bắt được.**

### Nguyên nhân
Khi refactor, bạn *vô tình* thay đổi hành vi: đảo điều kiện, đổi thứ tự, bỏ `await`, thêm null check... và test cũ — nếu bạn sửa nó cho khớp — sẽ **xác nhận** cái sai.

### Phòng ngừa

| Quy tắc | Cách làm |
|---|---|
| **Không sửa assert** | Chỉ đổi import path. Assert sai = test sai = revert. |
| **So sánh output trước/sau** | Nếu nghi ngờ logic → viết 1 test tạm in ra output, chạy trên cả 2 phiên bản |
| **Đọc diff `git diff -M`** | `-M` phát hiện rename → diff gọn, dễ thấy thay đổi logic ẩn trong move |
| **Review "move-only"** | Với T3, diff phải **100% là rename**. Có dòng `+`/`-` thực chất → vi phạm T3-1 |

```bash
# Kiểm tra diff của 1 module có phải move-only không
git diff -M --stat HEAD~1 -- src/modules/analysis/
git diff -M HEAD~1 -- src/modules/analysis/ | grep -E '^\+[^+]|^-[^-]' | head -20
# → Nếu có output → đã sửa logic → cần review kỹ
```

---

## 9.3. Kịch bản rollback

### Kịch bản A — Test đỏ sau khi sửa 1 module

```
1. git status                          # xem đang sửa gì
2. git diff                            # đọc kỹ thay đổi
3. Sửa được trong 15 phút?  → Có: sửa, verify, commit
                        → Không: git checkout -- <file> hoặc git reset --hard <tag>
4. Ghi vào notes.md: "Module X: chưa flatten được — lý do: <...>"
5. Sang module tiếp theo
```

### Kịch bản B — Hết giờ giữa chừng

```
1. git tag --list 'v1.2.0-*'          # xem đã tag đến đâu
2. git reset --hard v1.2.0-p3         # về trạng thái tốt nhất
3. Chuyển sang P6 (tài liệu) — luôn có giá trị
4. Báo cáo: "Đã flatten 6/13 module; 7 module giữ nguyên do khung thời gian"
```

### Kịch bản C — Cảm giác "trough of sorrow"

```
1. Dừng code 30 phút. Đi ăn. Không merge gì cả.
2. Chạy: pnpm exec jest --maxWorkers=2    # xem vẫn xanh không
3. Nếu xanh → hệ thống vẫn tốt → tiếp tục từ module nhỏ nhất
4. Nếu đỏ → reset về tag
5. Nhớ: 12 module còn lại = copy template. Không phải viết lại từ đầu.
```

### Kịch bản D — Phát hiện sai sót sau khi đã merge

```
1. git log --oneline v1.1.0-baseline..HEAD | head -30
2. Tìm commit nghi ngờ: git bisect start / git bisect bad <commit> / git bisect good v1.1.0-baseline
3. Hoặc đơn giản: git revert <commit>  (tạo commit đảo ngược)
```

> **Ưu tiên `revert` hơn `reset`** nếu đã push — giữ lịch sử, không ai mất công.

---

## 9.4. Bảng "reset point" — ghi vào notes.md

| Tag | Nội dung | Module đã flatten | Test | Route |
|---|---|---|---|---|
| `v1.1.0-baseline` | Trước refactor | 0/13 | 1 277 ✅ | 82 ✅ |
| `v1.2.0-p1` | Công cụ enforce | 0/13 | 1 277 ✅ | 82 ✅ |
| `v1.2.0-p2-pilot` | Pilot `audit` | 1/13 | 1 277 ✅ | 82 ✅ |
| `v1.2.0-p3` | Tier 1 xong | 6/13 | 1 277 ✅ | 82 ✅ |
| `v1.2.0-p4` | Tier 2 xong | 11/13 | 1 277 ✅ | 82 ✅ |
| `v1.2.0-p5` | Tier 3 xong | 13/13 | 1 277 ✅ | 82 ✅ |
| `v1.2.0-final` | Bàn giao | 13/13 | 1 277 ✅ | 82 ✅ |

> **Ghi cột "Test" và "Route" vào bảng sau MỖI lần tag.** Đây là bằng chứng bất biến.

---

## 9.5. Checklist an toàn — áp dụng trước MỖI commit

```
☐  pnpm type-check           → 0 lỗi
☐  pnpm lint                 → 0 cảnh báo
☐  pnpm exec jest --maxWorkers=2  → xanh
☐  pnpm arch:api-coverage    → 82 / 82 / 0 / 0 (§12.1)
☐  git diff --stat            → không có file lạ (untracked bất thường)
☐  grep -rn "<TênCũ>" src/ test/  → 0 kết quả
☐  Module này phẳng (không thư mục con)
☐  notes.md đã cập nhật
```

---

## 9.6. Rủi ro ngoài kỹ thuật

| Rủi ro | Dấu hiệu | Xử lý |
|---|---|---|
| **Deadline thay đổi** | Đồ án báo gia hạn | Ưu tiên P6 (tài liệu) — luôn có giá trị |
| **Người review hỏi "tại sao đổi?"** | Câu hỏi trong buổi bảo vệ | ADR đã viết sẵn — trả lời bằng số liệu |
| **Giảng vi nghi ngờ "chỉ đổi tên file"** | "Refactor này có ý nghĩa gì?" | Bảng số liệu trước/sau + giải thích "người mới" |
| **Không ai test được hệ thống** | — | Chạy `test-infra-up.sh` + integration + e2e trước buổi trình bày |
| **Bạn bị hỏi về microservices** | "Sao không tách service?" | ADR mục "Các lựa chọn đã cân nhắc" đã trả lời sẵn |

---

> **Ràng buộc phòng ngừa chi tiết:** mọi quy tắc TC/AC/FC/BC/PC + checklist khóa commit nằm ở [`13_refactor_constraints.md`](13_refactor_constraints.md). Vi phạm 1 ràng buộc là revert, không debug quá 15 phút.
