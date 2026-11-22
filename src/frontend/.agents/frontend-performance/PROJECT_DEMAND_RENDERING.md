# Thử render theo yêu cầu khi dựng Project 3D

## Chẩn đoán

Đối chiếu [benchmark dựng theo đợt](PROJECT_PROGRESSIVE_RENDERING.md) với Chrome trace. Trong khoảng từ mốc `loading` đến `ready`, trace có 8 callback animation trên 50 ms, dài nhất khoảng 1.812 ms, và 3 callback timer trên 50 ms, dài nhất khoảng 653 ms. Trace cho thấy cả hai loại công việc cần phân tích. Thời lượng callback chưa xác định riêng chi phí geometry, shader, postprocessing hoặc chờ GPU.

## Thí nghiệm

Trong [HolographicCoreCanvas](../../src/components/graphics/holographic-core/holographic-core.scene.tsx), Canvas dùng `frameloop="demand"` khi dựng model. Bộ dựng và điều khiển camera dùng các lời gọi `invalidate()` có sẵn để yêu cầu khung hình. Canvas chuyển về `always` khi scene báo sẵn sàng. Hai production build lấy từ cùng checkout trước và sau thay đổi này. Lighthouse desktop chạy xen kẽ 5 cặp trên cùng Chrome và cùng project có dataset.

| Chỉ số | Baseline trung vị (khoảng) | Candidate trung vị (khoảng) |
|---|---:|---:|
| Lighthouse Performance | 44 (42–45) | 41 (40–42) |
| Speed Index | 5,71 s (4,29–7,48) | 6,95 s (5,85–9,75) |
| LCP | 2,94 s (2,78–3,33) | 3,52 s (3,32–3,89) |
| TBT | 8,15 s (6,51–12,14) | 11,24 s (6,91–22,85) |

Cả 10 báo cáo xác định phần tử LCP là dòng tên dataset. SI và LCP tăng trong cả 5 cặp, TBT tăng trong 3/5 cặp. Benchmark index dao động từ 175,5 đến 442,5 ở baseline và từ 139,5 đến 323,5 ở candidate. Candidate chưa đạt tiêu chí cải thiện. Kết quả đo chưa cô lập được mức ảnh hưởng của lịch render khỏi dao động môi trường.

## Luồng thao tác và trace

Probe thực hiện đủ 5 lượt mỗi bản, gồm kéo Canvas, mở Data View và đợi hàng dữ liệu sau khi chuyển trang. Hành vi kéo được thực hiện bằng chuột và thu thời lượng frame. Probe chưa xác nhận góc camera bằng assertion.

| Mốc | Baseline | Candidate |
|---|---:|---:|
| `core` quan sát được | 4/5, trung vị 4,24 s | 4/5, trung vị 4,18 s |
| `ready` quan sát được | 5/5, trung vị 8,10 s | 5/5, trung vị 9,23 s |
| Kết quả Data View và chuyển trang | 5/5 | 5/5 |

Hai production build thành công. Vitest lần chạy với tối đa hai worker pass 161/161. Lần chạy đầu song song với build có một bài fail. Smoke trình duyệt xác nhận chuyển sáng/tối, tách/lắp mô hình và rời route lúc scene đang ở mốc `core`. [Smoke](reports/project-detail/demand-ab/candidate/smoke.json)

Trong hai trace thao tác, số callback animation trên thread chính từ `loading` đến `ready` giảm từ 74 xuống 52. Số callback animation trên 50 ms lần lượt là 8 và 9. Mỗi bản có một trace, nên số lượng callback dùng để định hướng điều tra. Cần gắn mốc bắt đầu/kết thúc cho mỗi lần `build.next()` và cho frame đầu khi thêm môi trường, vật thể và postprocessing. Với LCP, đối chiếu thời điểm nhận metadata từ API với thời điểm dòng tên dataset xuất hiện để tách thời gian chờ dữ liệu khỏi thời gian chờ vẽ.

## Bằng chứng từng lượt

[Baseline PNG, HTML và JSON](reports/project-detail/demand-ab/baseline) · [Candidate PNG, HTML và JSON](reports/project-detail/demand-ab/candidate)
