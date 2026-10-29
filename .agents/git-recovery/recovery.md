# Sao lưu trước khi phục hồi checkout

Ngày: 28/10/2026. Người dùng xác nhận sao lưu lockfile, bảo toàn log, giải phóng branch khỏi worktree và chuyển về checkout gốc. Không commit/reset hoặc force checkout.

- Bản lockfile untracked từ dev: `package-lock.dev-untracked.json`, chuyển bằng apply_patch; Git blob hash trước/sau: `b7f4a925ab56b4de138cbc1780e1c9381a31f9aa`.
- Giữ file sao lưu này; không tự ghi đè lockfile được theo dõi trên ThuongFEAI bằng bản từ dev.
- Bản log gốc dựa trên commit `540f2b1`; phần chưa commit được giữ trong `frontend-log.patch`, 29 dòng plan và 8 dòng handoff.
- Hash plan trước chuyển: `7665055c34d5c8077b9801adfa1f596226a21342`.
- Hash handoff trước chuyển: `6598ac33ef439e7e84a3b2cbfbd8ccc9ef606dad`.
- Các file source/log trong worktree tạm được giữ tới khi kiểm chứng nội dung đã chuyển đủ về checkout gốc.

Các backup nằm trong .agents/git-recovery, không được ứng dụng import hoặc xuất bản. Khi quay lại dev và muốn phục hồi npm lockfile, cần xác nhận đúng checkout rồi di chuyển bản backup bằng patch/edit; không ghi đè file hiện có một cách ngầm định.

## Kết quả phục hồi

- Checkout gốc đã chuyển sang ThuongFEAI; không tạo thêm worktree.
- Hai file log đã được đưa về đúng repository gốc và kiểm hash bằng bản gốc nêu trên trước khi cập nhật ghi chú checkout mới.
- Worktree tạm đã detached, bỏ phần log đã chuyển bằng apply_patch, kiểm sạch rồi git worktree remove không force. Hiện chỉ còn checkout gốc.
- Lockfile backend tracked trên ThuongFEAI không bị sửa; bản untracked từ dev vẫn nguyên hash và được giữ trong backup.
- Không git add/commit/reset/stash hoặc force checkout. Khi phát hiện bước cần làm ngoài quyền đã cấp phải hỏi trước; quyền đổi branch không bao gồm quyền tạo worktree.
