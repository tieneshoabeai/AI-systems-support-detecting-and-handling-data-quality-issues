# Project Detail — dựng model theo từng đợt

Phạm vi là canvas của `/processing/projects/:projectId`. Bản trước dựng model trong một lần gọi đồng bộ. Bản thử công bố đế và lõi trước, thêm tháp và cube, sau đó hoàn thiện gauge, chi tiết, viền, picking và bloom. Camera cùng canvas tồn tại xuyên suốt. Nút tách model chỉ bật sau khi dữ liệu tương tác đầy đủ. Khi scene rời route, cleanup hủy lịch dựng còn lại và dispose phần model đã tạo.

[Scene](../../src/components/graphics/holographic-core/holographic-core.scene.tsx) · [Các đợt dựng model](../../src/graphics/holographic-core/holographic-core.model.ts) · [Baseline ban đầu](PROJECT_DETAIL_BASELINE.md)

## Cách đo

Hai production build chạy trên HTTPS loopback. Candidate dùng cổng 4184, baseline dùng cổng 4185. Playwright đăng nhập vào hai origin bằng tài khoản E2E đã cấu hình, chọn cùng project thật có dataset và chỉ thao tác đọc. Lighthouse dùng desktop profile trên cùng Chrome. Đảo thứ tự hai build ở cặp chẵn. Probe dùng MutationObserver ghi các mốc `core`, `towers`, `details`, `ready` từ canvas của candidate, sau đó lấy thêm trace chẩn đoán. Baseline không phát các mốc từng đợt.

Lưu ý rằng thời gian tới canvas xuất hiện và thời gian tới một vật thể đã vẽ là các mốc riêng. Trace và ảnh đầu khung hình dùng để xác nhận thứ tự hiển thị.

## Xác minh cấu trúc

Build pass và 160/160 test Dataset 3D pass. Sáu bài fingerprint giữ nguyên cấu trúc của model hoàn chỉnh. Fingerprint kiểm chứng cấu trúc, transform, material và thứ tự node theo fixture hiện có. So sánh ảnh và hành vi trình duyệt được ghi riêng trong báo cáo benchmark.

## Kết quả A/B

| Chỉ số trung vị, 5 lượt mỗi bản | Trước | Dựng theo đợt |
|---|---:|---:|
| Lighthouse Performance | 42/100 | 43/100 |
| LCP | 3,32 s | 3,19 s |
| TBT | 3,51 s | 6,92 s |
| Tên Project | 7,03 s | 4,94 s |
| Metadata và canvas hiển thị | 7,05 s | 5,86 s |
| Click Data View → hàng đầu | 847 ms | 848 ms |
| Click Trang tiếp → hàng mới | 1.492 ms | 1.623 ms |

Mốc lõi được ghi ở 4/5 lượt (4,33–4,92 s), mốc tháp ở 3/5 lượt và hoàn tất ở 5/5 lượt (trung vị 10,18 s). Một số mốc ngắn bị bỏ qua giữa hai lần lấy mẫu. Filmstrip trace cho thấy cụm chính đã nhìn thấy trước khi bốn cube, nhãn và phần hiệu ứng hoàn chỉnh xuất hiện. Hai ảnh trích từ cùng trace. Ảnh sớm đã có một số chi tiết tháp, nên không dùng nó để khẳng định chỉ có đế và lõi trong khung hình đó.

TBT chưa giảm trong đợt A/B. Mức CPU Lighthouse dao động mạnh ở hai bản (benchmark index baseline 77,5–487,5 và candidate 117–445,5). Kết quả chứng minh thứ tự hiển thị và ghi nhận chi phí runtime cần điều tra tiếp, chưa cô lập được mức tăng TBT do mỗi giai đoạn. Các bài thao tác mở Data View và chuyển trang pass 5/5 mỗi bản.

Playwright kiểm tra chuyển theme sáng/tối, tách/lắp model và điều hướng SPA ra khỏi Project tại mốc core. Bài test bổ sung xác nhận hủy model đang dựng giải phóng geometry đã gắn đúng một lần. Chọn vật thể được kiểm tra ở tầng test FE.

[Kết quả smoke](reports/project-detail/progressive-ab/candidate/smoke.json)

[Ảnh scene đang dựng](reports/project-detail/progressive-ab/candidate/stage-core.jpg) · [Ảnh scene hoàn chỉnh](reports/project-detail/progressive-ab/candidate/stage-ready.jpg)

[Lighthouse baseline PNG/HTML/JSON](reports/project-detail/progressive-ab/baseline) · [Lighthouse candidate PNG/HTML/JSON](reports/project-detail/progressive-ab/candidate) · [Trace candidate](reports/project-detail/progressive-ab/candidate/chrome-performance.trace.json) · [Timing candidate](reports/project-detail/progressive-ab/candidate/journey.json)
