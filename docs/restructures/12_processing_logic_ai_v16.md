# 12. Logic xử lý dữ liệu và phạm vi AI

- **Version:** v16
- **Ngày tạo:** 2026-11-02
- **Cập nhật gần nhất:** 2026-11-24 (v16)
- **Thay đổi v16 (2026-11-24):** §3.24 sửa T1-3 / T1-5 — đồng thuận đếm theo **nhóm nhãn cùng ánh xạ một nhãn mẫu** (`correct` + `partially_correct` → mẫu "đúng"); sửa hồi quy v15 làm 1 nhận xét `partially_correct` hạ trust mẫu của nhiều người `correct`. Nguồn: rà soát bản audit các commit 2026-11-24 (Phần 7 v15 mục 3.25 VA-4).
- **Thay đổi v15 (2026-11-24):** §3.16.4 thêm ghi chú hiện thực + mục 3.24 — Hiện thực T1 theo đúng hợp đồng (mẫu theo khuôn, ngưỡng ≥ 3 người, đồng bộ khi sửa/xoá). Nguồn: rà soát module `feedback` 2026-11-24 (`docs/modules/feedback_plan.md` v1.0). Trạng thái: xem mục 3.24.
- **Thay đổi v14 (2026-11-24):** bổ sung mục 3.23 — Sửa lỗi đúng đắn trong phân tích sau merge (đợt K). Nguồn: đánh giá tính đúng đắn code sau merge `origin/backend` (`docs/modules/analysis_plan.md` v1.11 mục 7i). Trạng thái: Đã thực hiện 2026-11-24.
- **Thay đổi v13 (2026-11-18):** bổ sung mục 3.22 — Thuật toán Nghi vấn tự phát hiện mâu thuẫn (đợt I). Nguồn: file `local_VQD/MISSED_ERRORS*.md` sau đợt H (16 lỗi còn lại đều thuộc DQ-05) + `docs/modules/analysis_plan.md` v1.7. Trạng thái: Đã thực hiện 2026-11-18 (đợt I).
- **Thay đổi v12 (2026-11-18):** bổ sung mục 3.21 — Nhãn theo vai trò, thiếu ở cột chữ và thuật toán Nghi vấn mới (đợt H). Nguồn: bộ edge-cases `local_VQD/edge-cases` (11 file có bẫy dựng sẵn, file `MISSED_ERRORS_edge-cases.md`) + `docs/modules/analysis_plan.md` v1.6. Trạng thái: Đã thực hiện 2026-11-18 (đợt H).
- **Thay đổi v11 (2026-11-17):** bổ sung mục 3.20 — Cột ngày trong DQ, bộ đọc ngày chặt và Nghi vấn (đợt G). Nguồn: bộ test offline `local_VQD` (oracle độc lập + tiêm lỗi, file `MISSED_ERRORS.md`) + `docs/modules/analysis_plan.md` v1.5. Trạng thái: Đã thực hiện 2026-11-17 (đợt G).
- **Thay đổi v10 (2026-11-17):** bổ sung mục 3.19 — Vai trò cột, chính sách che mẫu và ma trận tam giác trên (đợt F). Nguồn: demo offline Titanic 2026-11-17 + `docs/modules/analysis_plan.md` v1.4. Trạng thái: Đã thực hiện 2026-11-17 (đợt F).
- **Thay đổi v9 (2026-11-17):** bổ sung mục 3.17 — Quy tắc trạng thái job AI corr-v1 (làm rõ). Nguồn: Kế hoạch hoàn thiện module `analysis` (`docs/modules/analysis_plan.md`). Trạng thái: đã thực hiện. **Bổ sung đợt D/E:** mục 3.18 — Mức ảnh hưởng và dữ liệu biểu đồ (đã thực hiện).
- **Trạng thái:** v4 thay Gemini API bằng **AI local (inference trên chính VPS)**; bổ sung cơ chế **nhận xét người dùng** và **vòng lặp học lại (T1 few-shot động qua RAG)**; thu hẹp đầu vào còn **chỉ `.csv`**. **v5 chuẩn hoá quy trình chọn model thành quyết định có số liệu:** 5 model ứng viên (**Qwen3-14B**, **Gemma-3-12B**, **Qwen3-8B**, **Llama-3.1-8B**, **Vistral-7B**), 9 chỉ số trên 5 nhóm, ngưỡng tuyệt đối + trọng số + kiểm định thống kê (McNemar/Wilcoxon) + đường Pareto; bỏ judge `Qwen3-32B` (vượt RAM) thay bằng **chấm chéo**; thêm kiến trúc **định tuyến hai tầng** để benchmark quyết định tầng nào chạy model nào. **v6 kích hoạt DQ-05 có điều kiện theo quy tắc được xác nhận + đặc tả AI đánh giá ma trận tương quan/VIF (theo Phần 2 v7).** **v8 chốt nhóm A (2026-11-07): Zod strict, PII regex+cột đánh dấu, làm tròn domain 4, ưu tiên mức ảnh hưởng→số ô→DQ, giữ toàn bộ phát hiện AI.**
- **Giai đoạn:** Logic/AI solution
- **Thứ tự thực hiện:** Phần 12; sử dụng kết quả đã xác nhận của các phần trước.

## 1. Mục tiêu

Làm rõ và thống nhất logic xử lý dữ liệu và phạm vi ai cho đợt tái cấu trúc backend.

## 2. Nội dung cần bàn luận

- Thuật toán và quy tắc xử lý cho từng use case đã chọn.
- Streaming/batch, chuẩn hóa schema, cleaning, versioning và integrity theo tính năng được duyệt.
- Vai trò AI trong backend nếu thuộc phạm vi; input/output, dữ liệu gửi ra ngoài, phê duyệt và fallback.
- Nếu AI không thuộc đợt này, ghi rõ xác nhận loại khỏi phạm vi; không tự mặc định triển khai.

## 3. Quyết định và thiết kế chi tiết

Đã ghi nhận hướng tích hợp từ thảo luận tính năng; v2 bổ sung nhà cung cấp, cơ chế chạy và ranh giới dữ liệu; **v4 thay nhà cung cấp bên ngoài bằng mô hình chạy nội bộ** và bổ sung vòng lặp học lại từ nhận xét người dùng.

> **Quyết định 2026-11-05 (v4):** Hệ thống **không gọi API mô hình bên ngoài**. AI được suy luận **cục bộ (local inference)** trên chính VPS bằng model mã nguồn mở, đặt sau một **port AI** để có thể thay adapter mà không đổi domain.
>
> **Lý do:** (1) dữ liệu nghiệp vụ **không rời khỏi hạ tầng** — không còn rủi ro xử lý ngoài EU/UK/EEA và không còn điều khoản dùng nội dung để huấn luyện của nhà cung cấp; (2) không phụ thuộc quota API bên ngoài; (3) **mở đường cho vòng lặp học lại** — nhận xét người dùng trở thành dữ liệu huấn luyện/đánh giá mà không bị ràng buộc bởi chính sách nhà cung cấp API.
>
> **Đánh đổi:** tốn **RAM và CPU của VPS** (mô hình nặng ~10 GB RAM cho Qwen3-14B ở định dạng Q4), suy luận **chậm hơn API** (vài giây đến hàng chục giây cho mỗi lượt trên CPU-only), và **tự phải quản lý vòng đời model** (tải, nạp, cập nhật, theo dõi bộ nhớ). Vì AI chạy **bất đồng bộ theo job** này không ảnh hưởng trải nghiệm người dùng.

- **Model AI chạy nội bộ — chưa chốt một model duy nhất.** Có **5 model ứng viên** phải benchmark trên cùng bộ mẫu: `Qwen3-14B`, `Gemma-3-12B`, `Qwen3-8B`, `Llama-3.1-8B`, `Vistral-7B` (mục 3.15.2). Kết quả benchmark chọn **cặp model** cho kiến trúc định tuyến hai tầng (mục 3.15.6). **Không** chốt trước model nào — kể cả `Qwen3-14B`. Định dạng lượng tử **Q4_K_M** (GGUF) để vừa RAM 15 GB. Chi tiết lựa chọn, benchmark, ngưỡng và phương án thay thế ở mục 3.15.
- **Model chấm điểm (LLM-as-judge):** **không dùng `Qwen3-32B`** — vượt RAM 15 GB. Thay bằng **chấm chéo** giữa model 8–14B **khác họ** với model đang được chấm, để tránh self-preference bias (mục 3.15.2).
- **Hạ tầng suy luận:** `vLLM` ở production (OpenAI-compatible API, batching, Prometheus metrics), `Ollama` ở môi trường dev, `llama.cpp` làm fallback khi không có GPU. Cả ba đều nằm sau **port AI** — domain không biết đang chạy engine nào.
- Backend tính toán các chỉ số và chuẩn bị kết quả/bằng chứng thống kê tổng hợp có cấu trúc; AI hỗ trợ Detection bổ sung, giải thích, nhận xét và đề xuất dựa trên thống kê được cung cấp. Backend kiểm tra phản hồi, đối chiếu số liệu và tham chiếu bằng chứng trước khi hiển thị; không chấp nhận kết luận lỗi từng ô/dòng không có bằng chứng.
- Gọi AI qua port, triển khai API nhà cung cấp ở adapter. Chưa chốt schema input/output, thuật toán kiểm chứng hoặc thư viện.
- Nội dung mỗi phát hiện AI đã chốt: vấn đề, cột liên quan, bằng chứng thống kê, mức độ ảnh hưởng, giải thích và đề xuất xử lý. Phân biệt nghi vấn cần kiểm tra thêm với vấn đề hệ thống đã xác nhận; AI không tự biến nghi vấn thành vấn đề đã xác nhận. Schema kỹ thuật sẽ được bàn sau.
- **Phạm vi dữ liệu đưa vào mô hình (v4):** thống kê tổng hợp **và tối đa 20 ô lỗi/cột đã che PII**. Không đưa file gốc, không đưa toàn bộ tập bản ghi, không đưa ảnh chụp màn hình lỗi. Vì mô hình chạy **cùng máy** nên dữ liệu không rời hệ thống — nhưng vẫn giữ nguyên quy tắc che PII bắt buộc, vì dữ liệu nằm trong prompt có thể bị ghi lại vào log và vào bộ nhớ đệm của engine suy luận. Chi tiết định danh cột và biểu diễn nhãn nhóm còn cần thiết kế, không mặc nhiên cho phép gửi giá trị gốc qua nhãn nhóm. Chi tiết ở mục 3.9 và 3.10.
- V2 bổ sung giới hạn đầu vào (số cột, số mẫu/cột, độ dài mô tả lỗi), chi phí (quota Free Tier), thời gian đáp ứng (timeout 60s) và khả năng bỏ sót khi chỉ gửi thống kê — việc gửi mẫu ô đã che PII làm giảm rủi ro bỏ sót loại lỗi không mô tả được bằng thống kê.
- Giữ các quy tắc tại phần 2: AI lỗi vẫn có Tổng kết từ kết quả hệ thống, không có giải thích/đề xuất AI; được thử lại riêng AI nếu đầu vào không đổi; AI không tự sửa dữ liệu.

### 3.1. Mức độ ảnh hưởng và kiểm chứng AI đã xác nhận

- Backend quyết định mức ảnh hưởng theo quy tắc tái lập được: **Thấp** (ảnh hưởng hạn chế), **Trung bình** (có khả năng làm sai lệch kết quả, cần kiểm tra), **Cao** (ảnh hưởng lớn đến độ tin cậy hoặc khiến một phép phân tích không thực hiện được). Đánh giá phải gắn với phép phân tích/phạm vi cụ thể, không suy rộng sang cả dataset.
- **Chưa đủ cơ sở** là trạng thái khi thiếu quy tắc hoặc ngữ cảnh đánh giá, không phải mức Thấp. Mỗi đánh giá cần lý do, phạm vi và quy tắc áp dụng. Chưa có ngữ cảnh nghiệp vụ nên chỉ đánh giá ảnh hưởng đến phân tích; ngưỡng theo từng loại vấn đề còn cần chốt, không áp dụng một ngưỡng chung.
- Trạng thái xác minh tách biệt mức ảnh hưởng: **Đã xác nhận bằng kiểm tra hệ thống** hoặc **Nghi vấn cần kiểm tra**. Phép tính xác nhận hiện tượng không tự xác nhận nguyên nhân hoặc lỗi nghiệp vụ; điểm vượt ngưỡng outlier chưa chắc là dữ liệu sai.
- Đối chiếu từng phát hiện với đúng kết quả của lần phân tích hiện tại, đúng sheet/cấu hình. Loại phát hiện sai số liệu hoặc tham chiếu bằng chứng không tồn tại. Suy diễn quá mức chỉ giữ dạng nghi vấn nếu có bằng chứng hỗ trợ; không chấp nhận như kết luận đã xác nhận. AI không được ghi đè mức ảnh hưởng backend xác định.
- Phản hồi hợp lệ một phần: giữ nhận xét hợp lệ, loại phần không đạt và báo phần nhận xét AI chưa đầy đủ tại Tổng kết. Phản hồi hỏng toàn bộ/không kiểm chứng được: chỉ dùng kết quả hệ thống và cho phép Thử lại AI theo điều kiện đã chốt.
- Đánh đổi: quy tắc backend giúp nhất quán và kiểm thử được nhưng cần xây dựng ngưỡng riêng, có thể bỏ sót ý nghĩa nghiệp vụ. Không chọn để AI tự quyết định toàn bộ mức ảnh hưởng vì khó tái lập và kiểm thử. Kiểm chứng cấu trúc/số liệu chưa bảo đảm mọi diễn giải đều đúng; thuật toán kiểm chứng và tiêu chí đánh giá chi tiết cần thiết kế sau.

### 3.2. Tiêu chí DQ-01/DQ-02 đã xác nhận

- Áp dụng tiêu chí nghiệp vụ tại [phần 2, mục 3.5.1–3.5.2](2_feature_catalog_v2.md#351-dq-01--tiêu-chí-dữ-liệu-thiếu-đã-xác-nhận). Đây là đầu vào thiết kế logic, chưa phải lựa chọn thư viện/thuật toán hoặc hoàn tất phần 12.
- Dữ liệu thiếu: ô không có giá trị, chuỗi rỗng/chỉ khoảng trắng; không tự coi `0`, `false` hoặc các chuỗi ký hiệu là thiếu. Lỗi chuyển kiểu thuộc DQ-03. Tính số lượng/tỷ lệ theo cột và số dòng thiếu một phần/toàn bộ trong phạm vi cột được chọn; không còn dòng thì báo không có dữ liệu, không trả tỷ lệ 0%.
- Dữ liệu trùng: so khớp chính xác giá trị và kiểu sau đọc file trên toàn bộ cột được chọn; không tự chuẩn hóa chữ/dấu/khoảng trắng. Loại dòng thiếu toàn bộ khỏi việc nhóm trùng; dòng thiếu một phần chỉ nhóm khi vị trí thiếu và giá trị còn lại giống nhau, kèm ghi chú có dữ liệu thiếu.
- Phân biệt số nhóm, số dòng trong nhóm và số dòng lặp ngoài một đại diện mỗi nhóm. Bằng chứng trong hệ thống giữ số dòng gốc, cột liên quan và giá trị ô; đầu vào AI là thống kê tổng hợp kèm tối đa 20 ô lỗi/cột đã che PII (mục 3.9, 3.10). Phát hiện thiếu/trùng không tự chứng minh lỗi nghiệp vụ và không tự xóa dữ liệu.
- Ngưỡng ảnh hưởng từng phép phân tích, trùng theo khóa nghiệp vụ, gần giống, ký hiệu thiếu tùy chỉnh và chi tiết đọc file còn cần bàn. So khớp chính xác dễ tái lập/kiểm thử nhưng chưa bao quát gần giống; không suy đoán khóa duy nhất.

### 3.3. Tiêu chí DQ-03 đã xác nhận

- Áp dụng tiêu chí tại phần 2, mục 3.5.3 và cấu hình Data Views tại mục 3.22. Tách kiểu dữ liệu khỏi vai trò phân tích và cột nhãn; lưu nguồn xác định kiểu/định dạng và thể hiện sự chưa chắc chắn của nhận diện. Chưa chọn thuật toán suy luận kiểu.
- Kiểm tra theo kiểu/định dạng đã chốt, phân biệt sai kiểu, sai định dạng và mơ hồ; không tính ô thiếu thành lỗi kiểu, không âm thầm chuyển lỗi thành thiếu. Cấu hình dấu thập phân/phân nhóm và định dạng ngày phải ngăn diễn giải mơ hồ; không tự bỏ đơn vị, chuẩn hóa văn bản hoặc gán múi giờ. Phân biệt giá trị ngày Excel với định dạng hiển thị. Tập giá trị boolean và chi tiết parser cần thiết kế sau theo phạm vi đã chốt.
- Báo số hợp lệ/không hợp lệ/mơ hồ và tỷ lệ không hợp lệ trên số giá trị không thiếu; mẫu số 0 báo không có dữ liệu để đánh giá. Bằng chứng nội bộ dùng lý do, giá trị ô và số dòng gốc; AI nhận thống kê tổng hợp kèm tối đa 20 ô lỗi/cột đã che PII (mục 3.9, 3.10).
- Cho phép các phân tích không bị ảnh hưởng tiếp tục. Phép tính cần số/ngày chỉ dùng giá trị hợp lệ và công bố số dùng/bị loại riêng cho phép tính, không xóa dữ liệu. Không đủ dữ liệu thì không tính, nêu lý do. Xử lý dòng cho tương quan/VIF tại mục 3.6; số lượng tối thiểu cần bàn riêng. Tổng kết phải nêu nguy cơ sai lệch do loại phần không hợp lệ.
- Thay đổi cấu hình kiểu/vai trò/định dạng tại Data Views yêu cầu phân tích lại; cấu hình được lưu/khôi phục và thay đổi cuối cùng còn hiệu lực xuất hiện trong Tổng kết/PDF. Đây là cấu hình diễn giải dữ liệu, không phải sửa file gốc.

### 3.4. Tiêu chí DQ-04 đã xác nhận

- Áp dụng phần 2, mục 3.5.4: tách miền nghiệp vụ khỏi outliers thống kê. Chưa có quy tắc miền thì báo chưa có quy tắc, không suy từ tên cột/min/max hoặc lời AI.
- Outliers từng cột định lượng được chọn: IQR mặc định với hàng rào 1,5 × IQR, có thể nhận diện thêm ngoài 3 × IQR; hỗ trợ Modified Z-score dùng trung vị/MAD, ngưỡng trị tuyệt đối > 3,5, hoặc chạy cả hai. Tách tập chỉ từng phương pháp phát hiện và phần giao, không cộng trùng.
- Chỉ dùng số hữu hạn hợp lệ, công bố số dùng/bị loại. IQR/MAD bằng 0 báo phương pháp tương ứng không đủ độ phân tán; không kết luận không có outlier. Số lượng quan sát tối thiểu, cách tính tứ phân vị và giới hạn tham số còn cần thiết kế. Không tự chuyển phương pháp, biến đổi hoặc chia nhóm ngoài cấu hình.
- Báo phương pháp, tham số, ngưỡng, số lượng/tỷ lệ, số quan sát và bằng chứng dòng gốc; AI nhận thống kê kèm tối đa 20 ô lỗi/cột đã che PII. Không tự loại outliers khỏi thống kê thông thường hoặc gán mức Cao từ độ xa thống kê/đồng thuận hai phương pháp. Box plot/histogram chỉ từng cột; đa biến và bất thường thời gian cần logic riêng.
- Cấu hình phương pháp/ngưỡng tại Data Views được lưu/khôi phục, thể hiện trong Tổng kết/PDF và thay đổi yêu cầu phân tích lại. Giới hạn: phân bố lệch/nhiều nhóm có thể gây nhiều cảnh báo; phát hiện vượt ngưỡng không chứng minh dữ liệu sai. Thiết kế chi tiết phần 12 chưa hoàn tất.

### 3.5. DQ-05 — Kích hoạt có điều kiện theo quy tắc được xác nhận (v6 — thay thế giới hạn hoãn tuyệt đối)

- Theo phần 2 v7, mục 3.5.5: DQ-05 mặc định `unassessed` (`no_rule_confirmed`) khi chưa có quy tắc quan hệ nào được xác nhận. Không báo đạt/không có mâu thuẫn khi chưa kiểm tra có cơ sở.
- Kích hoạt khi tồn tại ít nhất 01 quy tắc được xác nhận với đủ: `rule_id`, mô tả quan hệ, cột liên quan, biểu thức kiểm tra tái lập được, mức ảnh hưởng dự kiến, người + thời điểm xác nhận, phiên bản quy tắc. Áp checklist 5 điểm (diễn đạt thành kiểm tra từng dòng; cột tồn tại; hằng số có nguồn xác nhận; mức ảnh hưởng đã duyệt; phiên bản truy xuất được) — thiếu điểm nào giữ `unassessed`.
- Thực thi theo từng dòng trên tập dòng đủ giá trị hợp lệ ở cột của quy tắc; dòng không đủ điều kiện kiểm được báo riêng, không tự coi vi phạm/đạt. Kết quả: số vi phạm / số kiểm được, tỷ lệ, bằng chứng theo số dòng gốc, quy tắc + phiên bản áp dụng.
- Cấm suy quy tắc từ tên cột/đa số/tương quan-VIF/AI. Tương quan/VIF không tự chứng minh vi phạm DQ-05 và không tự sinh quy tắc. AI chỉ nhận xét trên kết quả kiểm tra + thống kê + tối đa 20 ô lỗi/cột đã che PII; nhận xét quy tắc (rule feedback) phục vụ hiệu chỉnh diễn đạt, không tự sửa quy tắc đang áp dụng.
- Nghiệm thu: `unassessed` kiểm tra trạng thái + lý do; `assessed` kiểm tra đúng quy tắc/phiên bản, số kiểm được/loại trừ, bằng chứng dòng gốc trong kết quả/Tổng kết.

### 3.6. Ma trận tương quan, VIF và AI đánh giá (v7 — theo Phần 2 v8 mục 3.23)

- Áp dụng Phần 2 v8 mục 3.23–3.23.3: backend tính số, AI diễn giải. Không đảo vai trò (AI không tính thay backend).
- **Ma trận tương quan:** backend dựng từ kết quả từng cặp (Pearson/Spearman số–số; Cramér’s V phân loại–phân loại; η² số–phân loại). Mỗi ô kèm `n` và trạng thái tính được/không tính được + lý do. **(v7)** Mỗi ô kèm thêm `totalScanned`, `missingAOnly`, `missingBOnly`, `missingBoth` với `n + missingAOnly + missingBOnly + missingBoth = totalScanned` — người đọc biết mất mẫu vì đâu. Kết quả kèm `excludedColumns[]` + `totalScanned`; cột `date` bị loại với lý do riêng `date_column_excluded_from_correlation_vif` và nêu trong `notes`. Trình bày bảng ma trận (không heatmap theo quyết định đã chốt). Ma trận là đầu vào bắt buộc cho AI.
- **VIF:** `VIF_i = 1 / (1 − R²_i)` qua `ml-matrix` (nghịch đảo ma trận tương quan); tập dòng hợp lệ chung; loại nhãn/định danh; cột hằng báo riêng. Ngưỡng: **VIF > 5 tham khảo cần kiểm tra, VIF > 10 đa cộng tuyến cao** — cả hai không tự thành lỗi, không tự gán Cao, không tự yêu cầu xóa cột. **(v7)** Kèm `totalScanned`, `commonNRate = commonN/totalScanned` và `lossWarning`: mất ≥ 20% thận trọng, mất ≥ 50% VIF kém tin (quy ước dự án). Vẫn tính khi `commonN ≥ k+1`, chỉ gắn nhãn độ tin. Bảng VIF là đầu vào bắt buộc cho AI.
- **AI đánh giá:** đầu vào = ma trận cấu trúc (kèm breakdown thiếu từng ô) + bảng VIF (kèm `commonNRate`/`lossWarning`) + `excludedColumns[]` + cột/kiểu/số dòng dùng-bị loại + tối đa 20 ô lỗi/cột đã che PII. Đầu ra cấu trúc: cặp đáng chú ý (A–B, hệ số, loại, `n`), cột VIF > 5/> 10, cảnh báo giới hạn (tập dòng khác nhau, nhóm thưa, outliers giữ nguyên, mất mẫu VIF), gợi ý bước tiếp theo cho người dùng tự xử lý ở nguồn. Cấm kết luận nhân quả, cấm kết luận vi phạm DQ-05, cấm yêu cầu xóa cột.
- **Ranh giới DQ-05:** tương quan/VIF cao không tự sinh quy tắc nghiệp vụ (mục 3.5). Kiểm chứng: loại nhận định trích số không tồn tại (dung sai |coef AI − coef hệ thống| ≤ 0.01); AI lỗi không chặn kết quả hệ thống.
- Ổn định số học: ma trận không khả nghịch → báo "phụ thuộc tuyến tính hoàn hảo — không tính được VIF"; Pearson với cột hằng (độ lệch chuẩn = 0) → "không tính được". Cộng tuyến hoàn hảo/gần hoàn hảo phát hiện qua `|r| ≥ 1−1e-12`, `|det| < 1e-12` hoặc `diag > 1e12` → `singular=true`, `reason=perfect_linear_dependency_no_vif`, không bịa VIF hữu hạn. Mọi `NaN`/`Infinity` bị chặn ở domain helper, không lọt lên tầng trên.
- Triển khai kiểm chứng: `corr-vif-ai.spec.ts` 12/12 (pairwise, VIF high/singular/hằng, grounding giữ/loại claim, breakdown thiếu, `lossWarning`, `notes` date); `tsc --noEmit` sạch; `nest build` OK; không vi phạm Zero Any trong `modules/analysis/`.

### 3.7. Mất cân bằng lớp đã xác nhận

- Áp dụng phần 2, mục 3.24: cần nhãn phân loại do người dùng chọn; phân biệt chưa chọn nhãn, nhãn liên tục không áp dụng, không có nhãn hợp lệ và chỉ quan sát một lớp. Không tự chia khoảng nhãn liên tục hoặc suy loại nhãn chỉ từ giá trị số nguyên.
- Với ít nhất hai lớp: thống kê số lượng/tỷ lệ từng lớp trên dòng nhãn hợp lệ, số lớp và các lớp lớn nhất/nhỏ nhất kể cả đồng hạng; IR = số mẫu lớn nhất / nhỏ nhất. Báo riêng nhãn thiếu/không hợp lệ, không biến thiếu thành lớp; thiếu đặc trưng khác không loại dòng. Giữ phạm vi toàn bộ sheet đang làm việc, không phụ thuộc lọc hiển thị và không tự gộp nhãn/xóa trùng.
- IR ≥ 3 là cảnh báo mặc định do dự án chọn, không phải ngưỡng chuẩn chung hoặc bằng chứng dữ liệu sai. Không tự gán ảnh hưởng Cao; xét cả số mẫu tuyệt đối và phân bố đầy đủ. Ngưỡng lớp ít mẫu còn mở.
- Bảng đủ lớp, biểu đồ cột có thể dùng Top N; Khác chỉ là hiển thị, mọi chỉ số tính trên lớp gốc. AI dùng thống kê kèm mẫu ô đã che PII và không tự kết luận hiệu năng mô hình. Không tự cân bằng/sinh/xóa mẫu hoặc huấn luyện mô hình.
- Nếu cho chỉnh ngưỡng, cấu hình phải ở Data Views và được lưu/thể hiện trong Tổng kết; khả năng chỉnh và giới hạn cụ thể chưa chốt. Chi tiết triển khai và kiểm thử sẽ thiết kế sau.

### 3.8. Phân tích thời gian đã xác nhận

- Áp dụng phần 2, mục 3.15. Trong các cột đã chọn phân tích, tự chọn khi chỉ có một cột thời gian phù hợp, yêu cầu chọn nếu nhiều cột; không có thì báo không áp dụng. Cấu hình tại Data Views: cột, mức ngày/tuần/tháng/năm (mặc định ngày, tuần từ thứ Hai), chỉ số, ngưỡng và múi giờ khi cần. Không tự gán múi giờ cho dữ liệu không có.
- Luôn có số bản ghi mỗi kỳ; cột số định lượng được chọn theo dõi mặc định trung vị, cho chọn trung bình/min/max và tổng theo lựa chọn chủ động. Công bố số hợp lệ/thiếu/không hợp lệ theo kỳ, giữ outliers. Ngày không hợp lệ/thiếu/mơ hồ không dùng tổng hợp, báo số lượng/lý do, không xóa dòng dataset (nay là quy tắc duy nhất — mục 3.13.2).
- Tạo kỳ trong khoảng thời gian hợp lệ quan sát được. Kỳ trống: số bản ghi 0, thống kê giá trị không có dữ liệu kể cả tổng, không nội suy/nối qua khoảng trống. Báo số kỳ, danh sách và chuỗi kỳ trống dài nhất; chưa có lịch kỳ vọng thì không gọi là mất dữ liệu. Bản ghi cùng thời điểm không tự coi là trùng lỗi.
- Tính chênh lệch tuyệt đối giữa kỳ liền trước khi hợp lệ; phần trăm chỉ khi giá trị kỳ trước dương. Không bỏ qua kỳ trống để so với kỳ xa hơn. IQR hệ số 1,5 trên chênh lệch kỳ liên tiếp hợp lệ để sàng lọc Biến động lớn cần kiểm tra; thiếu mẫu hoặc IQR = 0 báo chưa đủ điều kiện.
- Nêu giới hạn do mùa vụ, độ dài tháng, kỳ biên có thể chỉ quan sát một phần và số mẫu ít. Chưa phân rã xu hướng–mùa vụ hoặc dự báo. Giữ bảng/biểu đồ thời gian; cấu hình thay đổi yêu cầu chạy lại và được lưu/thể hiện trong Tổng kết/PDF. Số kỳ tối thiểu, biên kỳ, giới hạn tham số và xử lý múi giờ chi tiết cần thiết kế sau.

### 3.9. Cơ chế chạy AI (v4)

**Kiến trúc.** Gọi AI qua **port AI**; adapter suy luận cục bộ (`LocalInferenceAdapter`) gọi HTTP tới engine nội bộ (`vLLM`/`Ollama`) trên cùng VPS. Phần AI **không chạy đồng bộ** trong request phân tích: lần phân tích hệ thống hoàn tất và trả kết quả ngay, phần AI được giao một **job** chạy nền.

**Hàng đợi.** Job được đẩy vào **Kafka** (topic `ai.jobs`) qua cơ chế **transactional outbox** — không ghi trực tiếp vào Kafka trong transaction MongoDB (xem Phần 9 v3, mục 3.4). Consumer `ai-worker` đọc topic, gọi port AI, ghi kết quả. Kafka thay thế hoàn toàn job table MongoDB + polling của v2.

**Trạng thái job:** `pending` → `running` → `succeeded` | `failed` | `skipped`.

**(v7 — triển khai trong API process, đích Kafka giữ nguyên):** `AiWorkerService` poll `claimPendingJob` (`findOneAndUpdate` nguyên tử `pending → running`, sort `created_at`, concurrency 1), dựng prompt từ kết quả đã lưu (`buildPromptForJob`), gọi engine qua `AiInferencePort`/`LocalInferenceAdapter` (vLLM `POST {base}/v1/chat/completions` với `response_format json_object`; Ollama `POST {base}/api/generate` với `format json`; `temperature 0`; timeout `AI_JOB_TIMEOUT_MS` = 180000 qua `AbortController`; không log prompt, chỉ log độ dài + duration), tách JSON bằng `extractJsonObject`, rồi `ingestAiResult` để grounding (dung sai 0.01). Lỗi JSON → assessment `failed`. Lỗi tạm thời (timeout/HTTP 5xx/lỗi mạng) retry tối đa 2, hết lượt → `failed`. Tắt mặc định (`AI_WORKER_ENABLED=false`), poll `AI_WORKER_INTERVAL_MS` = 10000. Biến môi trường mới: `AI_ENGINE` (`vllm`/`ollama`), `AI_INFERENCE_BASE_URL`, `AI_INFERENCE_API_KEY`, `AI_MODEL_ID`. Bản Kafka topic `ai.jobs` + consumer riêng vẫn là đích đến theo Phần 9 v3 (chưa triển khai `heartbeat_at` quét job treo khi restart, chưa có test tích hợp engine thật). Job lưu: `analysis_id` (kết quả phân tích hệ thống được dùng làm đầu vào), `project_id`, `sheet_id`, `attempt`, `error`, `created_at`, `started_at`, `finished_at`, `model_id`, `prompt_version`. Job chỉ mang **tham chiếu** tới kết quả phân tích đã lưu, không mang theo bí mật hệ thống.

**Ghi `model_id` và `prompt_version` bắt buộc** — đây là tiền đề cho việc so sánh hiệu năng giữa các model (mục 3.15) và cho việc truy xuất ngược khi chất lượng AI giảm.

**Timeout và retry:** timeout mỗi lượt suy luận **180 giây** (CPU-only chậm hơn API rất nhiều; 60 giây như v2 sẽ fail gần như mọi lượt), tối đa **2 lần retry**. Retry chỉ áp dụng cho lỗi tạm thời (timeout, engine quá tải, 5xx); lỗi 4xx do payload không hợp lệ thì không retry. Vượt số lần retry thì job `failed`. **Hết hàng đợi định kỳ (quá 10 phút chờ) thì job chuyển `skipped`** kèm thông báo "hệ thống đang bận" — cơ chế chống nghẽn.

**Khôi phục khi restart:** job ở trạng thái `running` quá hạn (không cập nhật `heartbeat_at` quá 5 phút) phải được quét và chuyển về `pending` (đếm lại số lần retry) hoặc `failed` nếu đã hết lượt. Cơ chế quét dựa trên **consumer Kafka pause/rebalance** khi worker chết, không cần tiến trình polling riêng.

**Ranh giới hạn định lượng (đầu vào AI):**
- Tối đa **20 ô lỗi/cột** đã che PII.
- Số cột gửi tối đa: **10 cột** (chốt ở v4).
- Độ dài mỗi mô tả lỗi: cắt bớt (ví dụ 200 ký tự) để tránh vượt context.
- Tổng payload: **tối đa 8.000 token** cho phần đầu vào; vượt ngưỡng thì cắt bớt mẫu ô theo thứ tự giảm dần mức độ ảnh hưởng, không cắt thống kê tổng hợp. Ngưỡng này cũng là ranh giới an toàn để không vượt quá context window của `Qwen3-14B`.

**Xử lý lỗi:** AI lỗi **không chặn Tổng kết**. Tổng kết hiển thị kết quả hệ thống không có phần giải thích và đề xuất của AI, kèm thông báo lỗi có kiểm soát. Người có quyền phân tích được **Thử lại AI** khi dữ liệu và cấu hình phân tích không đổi (dùng lại `input_fingerprint` theo mục 3.13).

**Kiểm chứng phản hồi:** phản hồi AI được kiểm tra theo thứ tự — (1) đúng cấu trúc schema; (2) mức độ ảnh hưởng và trạng thái xác minh không vượt quyền backend (AI không được ghi đè); (3) mọi tham chiếu bằng chứng phải tồn tại trong bằng chứng đã lưu; (4) số liệu trích dẫn phải khớp thống kê đã gửi. Phát hiện không vượt kiểm chứng bị loại khỏi kết quả hiển thị.

**Ràng buộc đặc thù của mô hình cục bộ (v4):**
- Mô hình chạy trên **cùng máy** với API → **tài nguyên CPU/RAM dùng chung**. Khi suy luận đang chạy, API phải giữ độ trễ p95 trong ngưỡng; cơ chế: hàng đợi AI có **ưu tiên thấp hơn** các job người dùng chờ, và adapter suy luận giới hạn **số request đồng thời = 1** để không tranh chấp CPU.
- **Engine suy luận có thể không sẵn sàng** (chưa nạp model, hết RAM, container chết) → adapter phải **fail an toàn**: trả lỗi có kiểm soát, job `failed`, Tổng kết vẫn có kết quả hệ thống. API **không được** fail vì engine AI chưa sẵn sàng.
- **Mô hình phải được pin phiên bản** (ví dụ `Qwen3-14B-Q4_K_M` + mã commit của adapter) và **nạp sẵn** khi khởi động; nếu không nạp sẵn thì lượt suy luận đầu tiên mất thêm thời gian nạp model (vài phút) và sẽ vượt timeout.

### 3.10. Ranh giới dữ liệu đưa vào mô hình và che PII (v4)

- **Đầu vào đưa vào mô hình:** (a) thống kê tổng hợp theo cột và theo nhóm; (b) tối đa 20 ô lỗi/cột, **đã che PII**; (c) thông tin cấu hình phân tích liên quan (ngưỡng, phương pháp) để AI hiểu bối cảnh; (d) **mẫu nhận xét người dùng liên quan** lấy từ cơ chế học lại (mục 3.16).
- **Không đưa vào:** file gốc, toàn bộ tập bản ghi, ảnh chụp màn hình lỗi, thông tin người dùng (email, tên, tài khoản), khóa hay cấu hình hệ thống.
- **Che PII là bắt buộc**, không phải tuỳ chọn. Ô lỗi chứa dữ liệu nghiệp vụ (họ tên, định danh, email, số điện thoại) phải được che trước khi rời lớp domain. **Nếu không che được thì chỉ đưa thống kê tổng hợp thuần túy** — loại bỏ mẫu ô khỏi payload thay vì đưa giá trị thô.
- **Không còn điều khoản nhà cung cấp bên ngoài.** Với mô hình chạy nội bộ, **không có rủi ro dữ liệu bị xử lý ngoài EU/UK/EEA** và **không có điều khoản dùng nội dung để huấn luyện** của bên thứ ba. Đây là lợi ích chính của việc chuyển sang AI local và phải được ghi rõ trong tài liệu dữ liệu của hệ thống.
- **Vẫn phải che PII vì lý do kỹ thuật:** dữ liệu trong prompt có thể bị engine suy luận ghi vào log của nó (`vLLM` có request log), vào bộ nhớ đệm prompt, và vào trace khi bật. Che PII ở tầng domain vẫn là lớp phòng thủ đúng.
- **Log:** hệ thống không ghi nguyên giá trị ô lỗi chưa che; chỉ ghi định danh cột, số dòng gốc và mã lỗi. **Log của engine suy luận phải được tắt hoặc redact** (`vLLM`: tắt request log; `Ollama`: không bật `OLLAMA_DEBUG`).
- Đánh đổi: mẫu ô đã che cho phép AI chỉ ra dạng lỗi cụ thể mà thống kê không mô tả được (VD "cột Giới tính có `Nam` và `nam` không nhất quán"); đổi lại hệ thống phải có bước che PII bắt buộc trước khi gọi engine và không được đưa toàn bộ tập lỗi.
- Cơ chế phát hiện PII cụ thể (regex, từ khóa, cột đánh dấu) và dạng thay thế còn mở — xem mục 6.2.

### 3.11. Ngưỡng ảnh hưởng và số mẫu tối thiểu áp dụng (v2)

- Bảng ngưỡng và điều kiện số mẫu tối thiểu lấy nguyên văn từ phần 2, mục 3.29. Tóm tắt:
  - DQ-01 thiếu: Thấp < 1%, Trung bình 1–10%, Cao > 10%.
  - DQ-02 trùng: Thấp < 0,5%, Trung bình 0,5–5%, Cao > 5%.
  - DQ-03 sai kiểu/định dạng: Thấp < 1%, Trung bình 1–10%, Cao > 10%.
  - DQ-04 bất thường: Thấp vượt IQR 1,5×, Trung bình vượt IQR 3× hoặc Modified Z-score > 3,5, Cao khi cả hai phương pháp cùng đánh dấu.
  - DQ-05: luôn hiển thị "Chưa đánh giá".
- Tỷ lệ tính trên số dòng đang phân tích của cột tương ứng. Không có dòng nào thì báo "không có dữ liệu để đánh giá", không trả 0% và không áp ngưỡng.
- Số mẫu tối thiểu: Pearson/Spearman ≥ 3 quan sát hợp lệ chung; Cramér's V và η² ≥ 2 quan sát hợp lệ mỗi lớp có mặt; VIF ≥ (số cột số tham gia + 1) quan sát hợp lệ trên tập dòng chung; IQR/Modified Z-score ≥ 4 quan sát hợp lệ; mất cân bằng lớp ≥ 2 lớp quan sát được; sàng lọc biến động theo IQR trên chênh lệch kỳ ≥ 3 chênh lệch hợp lệ.
- Không đủ số mẫu: báo "không tính được" kèm lý do cụ thể, không thay kết quả bằng 0 và không coi là dữ liệu tốt.
- Mỗi mức ảnh hưởng phải kèm lý do, phạm vi bị ảnh hưởng và quy tắc áp dụng; ngưỡng là quy ước dự án, phải thể hiện trong Tổng kết và PDF.
- Ngưỡng cảnh báo "lớp có quá ít mẫu" và giới hạn tinh chỉnh tham số còn mở (mục 6.2 của phần 2).

### 3.12. Logic nhập file CSV (v4)

> **Quyết định 2026-11-05 (v4):** Hệ thống **chỉ làm việc với file `.csv`**. Toàn bộ logic đọc `.xlsx` (chọn sheet, sheet ẩn, ô công thức, ô gộp, file có mật khẩu, streaming giải nén ZIP) bị gỡ. Xem Phần 2 v5, mục 3.2 và 3.8.

- **Định dạng:** **chỉ `.csv`**. Mọi định dạng khác (`.xlsx`, `.xls`, `.ods`, `.json`) bị từ chối ở bước Import với thông báo rõ ràng yêu cầu người dùng xuất sang CSV.
- **Giới hạn dung lượng:** tối đa 50 MB mỗi file, 500 MB mỗi workspace (phần 2, mục 3.25).
- **CSV:** UTF-8, tự bỏ BOM; tự nhận diện delimiter trong `,` `;` `\t` `|`; không xác định được thì báo lỗi Import, không đoán. Hỗ trợ `\r\n` và `\n`.
- **Một file CSV = một bảng duy nhất.** Dòng đầi là tên cột. Không có khái niệm sheet, không có chọn sheet, không có sheet ẩn.
- **Không tự đoán locale số:** dấu thập phân và phân nhóm do người dùng cấu hình tại Data Views. Hệ thống không tự diễn giải `1,234` là `1234` hay `1.234`, không tự bỏ tiền tệ/phần trăm/đơn vị.
- **Dòng lệch số cột:** giữ theo vị trí; cột thiếu ở dòng đó là thiếu (DQ-01); cột thừa bị bỏ kèm cảnh báo. Ô trống bên phải cột cuối không tạo dòng dư thừa.
- **Cấu trúc bảng (phần 2, mục 3.26):** file rỗng hoàn toàn → mở kèm thông báo "không có dữ liệu"; file chỉ có header → hợp lệ, các phép phân tích báo "không có dữ liệu để đánh giá"; file có dữ liệu nhưng không xác định được header → lỗi Import, chưa gắn file vào project, cho nhập lại.
- **Kiểm tra tên cột:** kiểm tra trên **toàn bộ cột của file** (CSV chỉ có một bảng nên không còn khái niệm "kiểm tra tất cả sheet gồm sheet ẩn"). Tên rỗng/trùng là lỗi Import nhưng vẫn nhận file và gắn vào project; người dùng phải sửa tên trên hệ thống. **Chặn phân tích cho tới khi hết lỗi tên cột.**
- **Tên cột so sánh:** phân biệt hoa/thường và khoảng trắng, không tự trim hay đổi hoa/thường. Tên chỉ chứa khoảng trắng chỉ cảnh báo, không bắt buộc đổi.
- **Luồng ghi:** file gốc lưu qua port Storage (R2, local fallback) với extension `.csv`; bản ghi dữ liệu tách riêng vào cơ sở dữ liệu. Khi lỗi giữa chừng phải **dọn file tạm** trong bucket.
- Mỗi project chỉ có một file dữ liệu; không cho thay thế file, muốn đổi file phải tạo project mới.
- **Đọc CSV bằng streaming**, không nạp toàn bộ file vào RAM: đọc theo luồng, chèn lô 5.000 bản ghi (mục 3.13).

### 3.13. Bất biến dữ liệu và dấu vân tay đầu vào (v3)

> **Quyết định 2026-11-05:** Hệ thống **không ghi vào dữ liệu người dùng**. Xem Phần 2 mục 3.40.

#### 3.13.1. Nguyên tắc bất biến

- Dữ liệu tải lên là **bất biến**. Trong toàn bộ pipeline xử lý, dữ liệu chỉ được **đọc**.
- **Không còn khái niệm "dữ liệu làm việc"** khác với "dữ liệu gốc" — chúng luôn bằng nhau.
- Đường ghi duy nhất vào bản ghi dữ liệu là **Import** (bulk insert, lô 5.000, idempotent theo `{dataset_id, sheet_id, row_index}`).
- Bản ghi dữ liệu **không có** cờ xoá mềm — xoá dataset được thực hiện ở cấp `dataset`/`project`, không xoá bản ghi.

#### 3.13.2. Xử lý giá trị thiếu / không hợp lệ — quy tắc duy nhất

Trước đây có hai nhánh: "loại khỏi phép tính" và "loại khỏi dataset (xoá dòng)". Nay chỉ còn một:

| Tình huống | Xử lý |
|---|---|
| Giá trị thiếu / không hợp lệ trong một cột | **Loại khỏi phép tính của cột đó**; **không** loại khỏi dataset; **không** ghi vào bất kỳ đâu |
| Dòng thiếu ở cột A nhưng hợp lệ ở cột B | Dùng cho phép tính của B; không ảnh hưởng phép tính của A |
| Ngày thiếu / sai / mơ hồ | Không dùng cho tổng hợp thời gian; **báo số lượng + lý do**; không xoá dòng |
| Outlier | **Giữ nguyên**, chỉ đánh dấu và báo cáo |
| Cột thừa ở một dòng | Bỏ phần thừa ở **phép tính**, ghi cảnh báo; không sửa file |

Nguyên tắc chung: **mọi loại trừ đều được công bố** — số giá trị dùng / bị loại và lý do. Không có loại trừ nào "thầm lặng".

#### 3.13.3. Reset Dataset — thu hẹp

- **Tác vụ duy nhất:** khôi phục **tên cột** về tên gốc từ file gốc → hiển thị lại các cảnh báo tên cột rỗng/trùng.
- **Không** khôi phục dòng (không có dòng đã xoá) và **không** hoàn tác ô (không có ô đã sửa).
- Reset **không** thay đổi bản lưu hiện hành; chỉ lần Lưu thành công tiếp theo mới cập nhật.
- Reset **không** làm mất hiệu lực kết quả phân tích (fingerprint không chứa tên cột).

#### 3.13.4. Dấu vân tay đầu vào (`input_fingerprint`)

**Công thức (v3):**

```
input_fingerprint = SHA512(
    sheet_id
  | selected_column_keys (đã sắp xếp)
  | label_column_key
  | analysis_config (kiểu/định dạng cột, phương pháp tương quan, phương pháp outlier, mức tổng hợp thời gian, Top N)
  | config_version
)
```

**Thay đổi so với v2:**

| Thành phần | v2 | v3 |
|---|---|---|
| sheet đang làm việc | ✔ | ✔ |
| tập cột được chọn phân tích | ✔ | ✔ |
| cột nhãn nếu có | ✔ | ✔ |
| cấu hình phân tích | ✔ | ✔ |
| phiên bản cấu hình | ✔ | ✔ |
| ~~tập số dòng gốc đã xóa~~ | ✔ | **✘ bỏ** — không còn xóa dòng |
| ~~tên cột đã chỉnh sửa~~ | (không có) | **không thêm** — đổi tên cột không ảnh hưởng phép tính |

**Hành vi:**

- Fingerprint của yêu cầu hiện tại ≠ fingerprint của kết quả đã lưu → kết quả cũ đánh dấu **stale**; **không xoá khỏi database**.
- Mở Data Analysis & Detection với đầu vào đã đổi → yêu cầu chạy lại phân tích.
- Mở Tổng kết mà phân tích hệ thống chưa chạy lại với đầu vàu hiện tại → **từ chối** tạo Tổng kết mới.
- **Đơn giản hóa:** trước đây cơ chế `stale` phân biệt "sửa ô" (`keep` + `warn_only`) với "đổi cấu hình" (`stale`). Nay chỉ còn **một loại** — mọi thay đổi đầu vào đều gây `stale`. Không còn trạng thái "kết quả có thể không còn khớp".

#### 3.13.5. Vai trò của AI trong phạm vi chỉ đọc

- AI giữ nguyên 4 vai trò: phát hiện vấn đề bổ sung, giải thích, **đề xuất xử lý**, nhận xét chất lượng dữ liệu.
- **Không có đường dẫn thực thi**: không có endpoint "apply suggestion", không có job tự động sửa dữ liệu.
- Đề xuất trình bày dưới dạng **mô tả vấn đề + hướng xử lý gợi ý + tham chiếu bằng chứng** — không kèm giá trị đề xuất ghi thẳng.
- AI không được ghi đè mức ảnh hưởng và trạng thái xác minh do backend quyết định.
- Ranh giới dữ liệu gửi ra ngoài giữ nguyên: thống kê tổng hợp + tối đa 20 ô lỗi/cột đã che PII.

### 3.14. Thư viện triển khai phân tích (v2)

**Đã chốt:** dùng **`simple-statistics`** cho thống kê mô tả và **`ml-matrix`** cho tương quan, VIF và các phép tính ma trận. Không tự viết lại từng phép tính.

**Phân công cụ thể:**

| Nhóm phép tính | Thư viện |
|---|---|
| Trung bình, trung vị, độ lệch chuẩn, phương sai, tứ phân vị, IQR | `simple-statistics` (`mean`, `median`, `standardDeviation`, `variance`, `quantile`, `sampleQuantile`) |
| Modified Z-score (MAD) | `simple-statistics` (`medianAbsoluteDeviation`, `median`) |
| Tần suất giá trị | `simple-statistics` (`sampleCorrelation` không dùng; tự đếm tần suất trên tập hợp) — thư viện không có hàm tần suất chuyên dụng nên đếm trực tiếp |
| Pearson, Spearman | `ml-matrix` (`correlation`, `correlationPearson`) cho Pearson; Spearman tính trên thứ hạng của các cột |
| Cramér's V | `ml-matrix` để dựng bảng tần suất kết hợp, công bố chỉ số V từ bảng |
| Eta-squared (η²) | `ml-matrix` cho ma trận phân tích biến phân một yếu tố, hoặc tính trực tiếp từ tổng bình phương trong/ngoài nhóm |
| VIF | `ml-matrix` (`inverse` của ma trận tương quan) — VIF = đường chéo của nghịch đảo ma trận tương quan |
| Ma trận tương quan đầy đủ cho biểu đồ/thống kê | `ml-matrix` (`matrix`, `multiply`, `transpose`, `inverse`) |

**Quy tắc bắt buộc khi dùng thư viện:**
- Mọi phép tính phải bọc trong một **service/domain helper** của module `analysis`, không gọi trực tiếp thư viện từ controller hay application service. Lý do: giữ domain không phụ thuộc thư viện ngoài (đúng nguyên tắc domain không import framework), và cho phép đổi/kiểm thử phép tính tập trung.
- **Tiền điều kiện đầu vào phải kiểm tra trước khi gọi thư viện**: mọi phép tính cần số mẫu tối thiểu theo mục 3.11 phải được kiểm tra ở lớp trên; không giao mảng rỗng hoặc mảng chứa `NaN` cho thư viện.
- **Ma trận không khả nghịch** (VIF với phụ thuộc tuyến tính hoàn hảo): phải bắt lỗi của `ml-matrix` và báo rõ "phụ thuộc tuyến tính hoàn hảo — không tính được VIF" thay vì thay bằng số hữu hạn tùy ý (đã chốt ở mục 3.6).
- **Giá trị không hữu hạn** (`NaN`, `Infinity`) sinh ra từ phép tính phải được phát hiện và báo "không tính được" thay vì trả về giá trị hỏng cho tầng trên. Đặc biệt với Pearson khi một cột hằng (độ lệch chuẩn = 0).
- **Số mẫu tối thiểu và điều kiện tính** của mỗi phép tính vẫn do backend kiểm soát theo mục 3.11, không giao cho thư viện quyết định.
- Kết quả phải **làm tròn/giữ số thực đầy đủ** ở tầng domain; việc hiển thị làm tròn thuộc tầng trình bày (mục 3.29 và mục 3.16 của phần 2).
- **Kiểm thử:** mỗi helper phải có test với bộ dữ liệu có giá trị kỳ vọng tính tay (golden values) để đối chiếu kết quả thư viện. Không chỉ kiểm thử "không ném lỗi".

**Đánh đổi:** dùng thư viện giảm rủi ro sai số và rút ngắn thời gian triển khai, nhưng gắn thêm phụ thuộc ngoài và phải bọc lại để giữ ranh giới domain. `ml-matrix` không có sẵn hàm Cramér's V, Eta-squared hay VIF nên vẫn phải tự tính phần trên nền ma trận — phần này là nơi dễ sai số nhất và cần test kỹ nhất.

### 3.15. Lựa chọn model AI cục bộ và quy trình so sánh (v4)

#### 3.15.1. Yêu cầu phần cứng và bối cảnh

Hệ thống chạy trên **1 VPS, không có GPU**. Số liệu tham chiếu tại thời điểm chốt: **16 vCPU · 15 GB RAM · không GPU · 107 GB đĩa trống**.

Điều này quyết định toàn bộ: **chỉ chọn được model ≤ 16B tham số ở định dạng lượng tử Q4_K_M** (mỗi tham số ~0,6 byte → 14B ≈ 9–10 GB RAM). Model 30B+ sẽ **vượt RAM** và phải swap, làm sập cả API.

#### 3.15.2. Năm model được chọn để so sánh

Mỗi model đại diện cho **một giả thuyết khác nhau** về cái gì quyết định chất lượng. Chọn theo giả thuyết (không theo cảm tính) để kết quả benchmark **kiểm chứng được một kết luận**, không chỉ xếp hạng.

| Mã | Model | Tham số | Giả thuyết được kiểm chứng | Vì sao nằm trong danh sách |
|---|---|---|---|---|
| **M1** | `Qwen3-14B` (Q4_K_M) | 14B | *Quy mô + đa ngữ thắng* | Trần khả thi của RAM; tiếng Việt mạnh; structured output theo JSON Schema tốt; có `thinking` bật/tắt được |
| **M2** | `Gemma-3-12B-IT` (QAT Q4) | 12B | *Lượng tử QAT bù được phần thiếu tham số* | QAT giữ chất lượng tốt hơn Q4 thường ở cùng cỡ; context dài; RAM thấp hơn M1 ~2 GB → headroom tốt hơn |
| **M3** | `Qwen3-8B` (Q4_K_M) | 8B | *Một nửa tham số có đủ cho tác vụ có cấu trúc?* | Cùng họ M1 → nếu thắng, tái dùng tokenizer/embedding và tiết kiệm ~4 GB |
| **M4** | `Llama-3.1-8B-Instruct` (Q4_K_M) | 8B | *Baseline hệ sinh thái lớn* | Chuẩn so sánh ngành, không được vắng mặt; khác họ hoàn toàn với M1/M3 |
| **M5** | `Vistral-7B-Chat` (Viettel) | 7B | *Chuyên biệt tiếng Việt thắng quy mô?* | Model Việt bản địa — kiểm chứng giả định "Qwen3 giỏi tiếng Việt hơn model Việt" |

**Ứng viên bị loại trước khi benchmark (phải ghi rõ lý do):**

| Model | Lý do loại |
|---|---|
| `Qwen3-30B-A3B` | Q4 ≈ 18 GB > 15 GB RAM → bắt buộc swap, làm sập API process |
| `DeepSeek-R1-Distill-Qwen-14B` | Bật chain-of-thought dài gấp 3–5 lần token → p95 vượt 180 s; structured output yếu hơn Qwen3 |
| `Phi-4-mini` (3,8B) | Đủ cho phân loại nhưng không đủ viết giải thích 4–5 câu tiếng Việt đạt ngưỡng 4,0 |
| `PhoGPT-4B-Chat` | Quá nhỏ, instruction-following kém, không theo được JSON Schema phức tạp |

> **Ghi chú về model chấm điểm (LLM-as-judge).** `Qwen3-32B` **không khả thi** trên 15 GB RAM — phương án "dùng nếu đủ tài nguyên" trong v4 bị bỏ. Thay bằng **chấm chéo**: model 8–14B **khác họ** với model đang được chấm (ví dụ M2 chấm cho M1, M4 chấm cho M3). Bắt buộc chấm chéo để tránh **self-preference bias** — model tự chấm mình thường cho điểm cao hơn 0,3–0,6.

#### 3.15.3. Vì sao chọn Qwen3 làm hạt giống (chưa phải kết luận)

Đây là **giả thuyết ban đầu**, không phải kết quả. Benchmark ở mục 3.15.5 mới là thứ chốt.

- Qwen3 huấn luyện đa ngữ có tiếng Việt trong tập dữ liệu; thành phần tiếng Việt mạnh hơn đáng kể so với Llama 3.1 và Gemma 3.
- **Structured output** theo JSON Schema ở mức tốt → giảm tỉ lệ phản hồi sai schema (yêu cầu cứng của mục 3.9).
- Có **thinking mode** tách bạch → bật cho giải thích (cần suy luận), tắt cho phân loại (tiết kiệm token/thời gian).
- **Giấy phép Apache 2.0** → không vướng ràng buộc thương mại.

#### 3.15.4. Hạ tầng suy luận

| Môi trường | Engine | Lý do |
|---|---|---|
| Dev | **Ollama** | cài một lệnh, quản lý model dễ, phù hợp thử nghiệm |
| Production | **vLLM** | OpenAI-compatible API, batching, Prometheus metrics, hỗ trợ CPU (ARM/AVX512) |
| Fallback | **llama.cpp** | chạy GGUF trực tiếp khi container vLLM không khởi động được |

**Cả ba nằm sau `AiInferencePort`** — domain không biết engine nào đang chạy. Đổi engine = đổi adapter, không đổi logic.

**Vận hành bắt buộc:**
- **Pin phiên bản model**: ghi checksum SHA-256 của file weights trong `.env`/config. Không dùng thẻ `latest`.
- **Nạp sẵn (preload)** khi khởi động container; nạp model mất vài phút, **không tính vào timeout** của job.
- **Giới hạn đồng thời = 1** request suy luận; hàng đợi của engine xử lý phần còn lại.
- **Health check riêng** `/ready` của engine: API coi engine chưa sẵn sàng là **suy giảm chức năng**, không phải lỗi hệ thống — Tổng kết vẫn trả kết quả phần hệ thống.
- **Giám sát RAM**: nếu RSS của engine vượt 85% RAM máy thì **tạm dừng nhận job AI mới** để bảo vệ API.

#### 3.15.5. Quy trình benchmark 5 model và 9 chỉ số (bắt buộc)

> Không được chọn model bằng cảm tính. Quy trình dưới đây là **cổng nghiệm thu** cho quyết định model. Chạy **cả 5 model M1–M5** trên cùng bộ mẫu.

**Bước 1 — Xây bộ benchmark vàng.**
- Nguồn chính: **nhận xét người dùng** đã thu thập (mục 3.16) — ground truth thật của người dùng, không phải ý kiến đội phát triển.
- Bổ sung mẫu synthetic cho loại lỗi chưa gặp trong thực tế.
- Kích thước: **200 mẫu** (khoảng chấp nhận 150–300), phủ đủ **5 nhóm DQ-01…DQ-05 × 3 mức ảnh hưởng**, có cả `false_positive` và `missed_issue`.
- Mỗi mẫu: thống kê tổng hợp (đã che PII) + mẫu ô lỗi + **đáp án đúng** (có phát hiện không, mức ảnh hưởng, loại lỗi).
- **Chống rò rỉ đáp án:** mẫu trong bộ benchmark **không được** nằm trong kho few-shot `feedback_example` — kiểm tra tự động trước mỗi lần chạy.

**Bước 2 — Chạy 5 model trên cùng bộ, cùng điều kiện.**
- Cùng prompt template, cùng tham số: `temperature = 0.2`, `top_p = 0.9`, `seed` cố định, `max_tokens` cố định.
- Chạy **trên đúng phần cứng production** (CPU-only, cùng VPS). Chọn model trên máy có GPU rồi deploy lên CPU-only là sai lầm phổ biến và sẽ hỏng ngưỡng latency.
- Mỗi model chạy **3 lần** (model Q4 không tất định tuyệt đối dù cố định seed) → báo cáo **mean ± std**.
- Bỏ lượt **warm-up** khỏi phép đo latency (lượt đầu chịu chi phí nạp KV cache).

**Bước 3 — Chấm 9 chỉ số trên 5 nhóm.**

| # | Nhóm | Chỉ số | Cách đo | Ngưỡng tuyệt đối | Trọng số |
|---|---|---|---|---|---|
| 1 | Chất lượng | **F1 phát hiện** (micro) | `2PR/(P+R)` so với ground truth trên 200 mẫu | ≥ 0,75 | **30** |
| 2 | Chất lượng | **F1 macro theo DQ-01→DQ-05** | trung bình F1 của 5 lớp — chống model giỏi 1 lớp, dở 4 lớp | ≥ 0,70 | **10** |
| 3 | Tuân thủ | **Tỉ lệ JSON hợp lệ** | % phản hồi parse được ngay, không sửa | ≥ 98 % | **12** |
| 4 | Tuân thủ | **Tỉ lệ ảo giác (grounding)** | % số liệu AI trích dẫn **lệch** với thống kê đã gửi | ≤ 2 % | **10** |
| 5 | Ngôn ngữ | **Chất lượng giải thích tiếng Việt** | LLM-as-judge **chấm chéo** (model khác họ), thang 1–5 | trung bình ≥ 4,0 | **13** |
| 6 | Hiệu năng | **p95 latency / 1 job** | 3 lần chạy, bỏ warm-up | ≤ 180 s | **10** |
| 7 | Hiệu năng | **Throughput** | tok/s sinh, cùng prompt, cùng `max_tokens` | ≥ 4 tok/s | **5** |
| 8 | Tài nguyên | **RSS đỉnh** | `docker stats` trong lúc chạy benchmark | ≤ 11 GB | **5** |
| 9 | Vận hành | **Độ ổn định** | % job lỗi/phải retry trên 200 mẫu | ≤ 2 % | **5** |

Tổng trọng số = **100**.

**Công thức điểm tổng hợp.** Chuẩn hoá **min–max** từng chỉ số trên 5 model → nhân trọng số → cộng. Với chỉ số "càng thấp càng tốt" (#4, #6, #8, #9) thì đảo nghịch trước khi chuẩn hoá. **Rớt bất kỳ ngưỡng tuyệt đối nào → loại**, không cần tính điểm.

**Vì sao 30 điểm cho F1?** Vì đó là mục đích tồn tại của hệ thống. Nhưng nếu chênh lệch F1 giữa hai model **< 0,03** thì **không coi là khác biệt** — chuyển sang so chỉ số #3–#9 (model rẻ hơn, ổn định hơn thắng).

**Bước 4 — Kiểm định thống kê (bắt buộc trước khi tuyên bố thắng).**
- Cặp đúng/sai phát hiện giữa hai model → **McNemar test**.
- Điểm judge giữa hai model → **Wilcoxon signed-rank test**.
- Chỉ tuyên bố "tốt hơn" khi **ΔF1 ≥ 0,03 và p < 0,05**.

**Bước 5 — Vẽ đường Pareto.** Trục X = p95 latency, trục Y = F1, kích thước điểm = RSS. Chọn **điểm Pareto tốt nhất**, không chọn điểm chất lượng tuyệt đối cao nhất.

**Thứ tự ưu tiên khi hoà điểm:** giấy phép rõ ràng → headroom RAM → latency → tái dùng họ model (tiết kiệm embedding/tokenizer).

**Bước 6 — Chốt và ghi hồ sơ.** Ghi kết quả vào tài liệu bàn giao (Phần 15) kèm: model, phiên bản, checksum, định dạng lượng tử, tham số suy luận, điểm 9 chỉ số, giá trị p, và đường Pareto. Báo cáo lưu tại `docs/test-reports/benchmark-<model>-<ngày>.md`.

**Bước 7 — Cơ chế chạy lại.** Bộ benchmark **phải chạy lại** mỗi khi: đổi model, đổi phiên bản model, đổi prompt template, đổi engine suy luận, hoặc cập nhật kho few-shot. Đây là quy tắc kiểm thử bắt buộc trong Phần 13.

#### 3.15.6. Kiến trúc định tuyến hai tầng (kết quả benchmark quyết định tầng nào chạy model nào)

Benchmark không chỉ chọn **một** model — nó chọn **cặp model** cho hai tầng:

| Tầng | Loại tác vụ | Tiêu chí chọn |
|---|---|---|
| **Tầng nhanh** | Gợi ý nhãn cột, phân loại loại lỗi, sinh JSON ngắn | p95 thấp nhất trong 5 model **đạt** ngưỡng #3, #4 |
| **Tầng sâu** | Giải thích, gợi ý xử lý, nhận xét chất lượng | F1 + điểm giải thích cao nhất **đạt** ngưỡng #6, #8 |

**Định tuyến theo loại tác vụ** — không định tuyến ngẫu nhiên hay theo tải.

**Chuỗi dự phòng:** model sâu → model nhanh → **suy giảm có kiểm soát** (chỉ trả kết quả rule-based, gắn cờ `"ai_unavailable": true`). Không được im lặng trả kết quả thiếu.

#### 3.15.7. Đánh đổi đã chấp nhận

| Đánh đổi | Lý do chấp nhận |
|---|---|
| Chậm hơn API nhiều lần | AI chạy nền theo job, người dùng không chờ → không ảnh hưởng UX |
| Tốn ~10 GB RAM cho model lớn | Đổi lại: dữ liệu không rời hệ thống, không phụ thuộc quota, mở đường học lại |
| Phải tự quản lý model (tải, nạp, nâng cấp, giám sát RAM) | Đã ghi vào báo cáo công nghệ và quy trình vận hành (Phần 10 v5) |
| Model 14B không bằng model API tiên tiến nhất về suy luận | 4 vai trò AI là **phát hiện, giải thích, gợi ý, nhận xét** — tác vụ có cấu trúc, không cần suy luận sâu |
| Chấm chéo thay vì judge 32B | 32B vượt RAM; chấm chéo vẫn giảm self-preference bias, chỉ kém chính xác hơn judge mạnh |

### 3.16. Nhận xét người dùng và vòng lặp học lại (v4)

> **Quyết định 2026-11-05 (v4):** Mỗi kết quả mà hệ thống trả ra cho người dùng **đều kèm phần đánh giá để người dùng nhận xét**. Nhận xét được **lưu lại** và dùng làm vòng lặp học lại cho AI.

#### 3.16.1. Vị trí gắn nhận xét

Nhận xét gắn ở **cấp phát hiện (finding)**, không phải cấp tổng kết — vì đó là nơi người dùng thực sự có ý kiến ("cái này không phải lỗi", "thiếu quá nhiều, nên giảm ngưỡng"). Một phát hiện cụ thể có thể nhận nhiều nhận xét từ nhiều người; Tổng kết tổng hợp lại thành **chỉ số đánh giá** (ví dụ "42/50 phát hiện được người dùng xác nhận là đúng").

Ngoài ra hỗ trợ **nhận xét ở cấp phân tích** (đánh giá chung lần phân tích) để người dùng nói "lần này phát hiện nhiều quá / thiếu mấy loại lỗi".

#### 3.16.2. Cấu trúc nhận xét

| Thuộc tính | Quy tắc |
|---|---|
| Loại | `finding` (gắn phát hiện) hoặc `analysis` (gắn cả lần phân tích) |
| Nhãn | `correct` · `partially_correct` · `false_positive` · `missed_issue` · `other` |
| Nhãn bắt buộc | 1 trong 4 nhãn đầu; `other` phải có mô tả tự do |
| Bắt buộc có lý do | `false_positive`, `missed_issue`, `other` → bắt buộc có `reason` (tối đa 2.000 ký tự) |
| Tùy chọn | `suggested_severity` — người dùng gợi ý lại mức ảnh hưởng (`low`/`medium`/`high`/`critical`) |
| Minh bạch | lưu kèm `ai_confidence` và `ai_rationale` **tại thời điểm nhận xét** → dùng để đánh giá model nào đúng |
| Ẩn danh khi dùng làm mẫu học | nội dung tự do của nhận xét **không** dùng nguyên văn trong prompt; chỉ dùng cấu trúc + mẫu đã chuẩn hoá |
| Sửa / xóa | người đã nhận xét được sửa hoặc xoá nhận xét của chính mình. `PROJ-OWNER` được xoá nhận xét của thành viên khi vi phạm. Lý do: nhãn sai sẽ ô nhiễm dữ liệu học lại |

**Không cho phép AI tự tạo nhận xét** — nhận xét luôn do con người, có `user_id` và mốc thời gian.

#### 3.16.3. Ba tầng "học lại" — quyết định chọn T1

| Tầng | Cách làm | Chi phí | Trạng thái |
|---|---|---|---|
| **T1 — Few-shot động qua RAG** | Nhận xét được **chuẩn hoá** thành mẫu ngắn (mẫu đúng → mẫu sai) và **truy xuất theo ngữ cảnh** để chèn vào prompt khi gọi AI | Rất thấp | ✅ **Đã chọn — triển khai trong đợt này** |
| T2 — LoRA fine-tune | Huấn luyện adapter trên tập nhận xét | Cao (cần GPU) | ❌ Không triển khai — cần GPU và hàng nghìn feedback |
| T3 — Đánh giá (ground truth) | Nhận xét làm bộ chấm để so sánh model | Thấp | ✅ **Đã chọn — xây bộ benchmark (mục 3.15.5)** |

**Vì sao chỉ T1:** hệ thống có 1 VPS không GPU; LoRA cần GPU ≥ 24 GB. T1 cho hiệu quả ngay, tích luỹ dữ liệu dần, và **đường nâng cấp T2 luôn mở** khi có đủ dữ liệu + GPU. T3 chạy song song với T1 vì không tốn tài nguyên.

#### 3.16.4. Cơ chế T1 — RAG từ nhận xét

**Bước 1 — Chuẩn hoá (offline, chạy nền).**
- Mỗi nhận xét `correct`/`partially_correct` với lý do → tạo **mẫu đúng**: `{ loại lỗi, đặc điểm cột, phát hiện mà AI đã bỏ sót }`.
- Mỗi nhận xét `false_positive` với lý do → tạo **mẫu sai**: `{ loại lỗi, đặc điểm cột, phát hiện AI đã báo nhưng thực ra không phải lỗi }`.
- Nhận xét `missed_issue` → tạo **mẫu bỏ sót**: `{ loại lỗi, đặc điểm cột, mô tả vấn đề bị bỏ sót }`.
- Chuẩn hoá chuỗi: bỏ thông tin định danh cá nhân, số liệu cụ thể của dataset đó, tên khách hàng; giữ **đặc điểm nguyên tý** (VD: "cột trạng thái đơn hàng dùng 5 mã viết tắt khác nhau — không phải lỗi").
- **Chỉ dùng mẫu đã qua kiểm duyệt**: mẫu do người dùng viết phải được hệ thống kiểm tra không chứa PII trước khi vào kho mẫu.

**Bước 2 — Truy xuất (online, mỗi lượt gọi AI).**
- Truy vấn vector trên kho mẫu bằng **embedding chạy cục bộ** (`Qwen3-Embedding-0.6B` — ~1,2 GB RAM, hoặc dùng `bge-m3` nếu RAM dư; không dùng API embedding ngoài).
- Truy xuất **top-k = 5** mẫu, lọc theo **loại lỗi** đang phân tích và **ngôn ngữ** (tiếng Việt).
- Chèn vào prompt dưới dạng khối "Các trường hợp đã biết" — **không** chèn nhãn của bộ benchmark dùng để đánh giá (tránh rò rỉ đáp án).

**Bước 3 — Kiểm soát chất lượng mẫu.**
- Mỗi mẫu có **điểm tin cậy** = tỉ lệ phản hồi `correct`/`false_positive` đồng nhất từ ≥ 3 người khác nhau với nhãn giống nhau. Mẫu có điểm < 0,6 bị loại khỏi kho.
- Mẫu cũ hơn **180 ngày** được đánh giá lại (nghiệp vụ và cách phát hiện có thể đã đổi).
- **Tối đa 5 mẫu** mỗi lượt gọi để không làm vượt context.

> **v15 (2026-11-24):** hiện thực Bước 1 + Bước 3 đã được chỉnh cho đúng các quy tắc trên — xem mục 3.24.

#### 3.16.5. Vòng lặp cải thiện

```
Người dùng nhận xét
      ↓
Lưu vào collection `finding_feedback` (append-only)
      ↓
Chuẩn hoá → kho mẫu (vector store)          [T1]
      ↓
Truy xuất top-5 → chèn vào prompt khi gọi AI
      ↓
AI cải thiện → người dùng nhận xét tiếp        ↺
```

**Kết quả phải đo được**, nếu không thì vòng lặp không có ý nghĩa:
- Tỉ lệ `false_positive` của AI theo thời gian (mục tiêu: giảm dần).
- F1 trên bộ benchmark sau mỗi lần cập nhật kho mẫu.
- Số nhận xét tích luỹ.

#### 3.16.6. Ràng buộc

- Nhận xét **không sửa** kết quả phân tích đã lưu — dữ liệu bất biến (mục 3.13) áp dụng cho cả kết quả phân tích. Nhận xét chỉ là **lớp đánh giá** tách biệt.
- Nhận xét **không** được dùng để tự động điều chỉnh ngưỡng ảnh hưởng (mục 3.11) trong đợt này. Việc điều chỉnh ngưỡng tự động cần thêm cơ chế an toàn và để đợt sau.
- Không dùng nhận xét để **tự động huấn luyện lại model** — chỉ dùng để chèn mẫu vào prompt (T1) và chấm điểm (T3).
- Nhận xét có thể chứa dữ liệu nhạy cảm của doanh nghiệp → cùng mức bảo mật với `analysis_result`; quyền xem theo workspace/project.
- Khi xoá project hoặc workspace: nhận xét bị **xoá theo** (không giữ lại làm mẫu học) — trừ khi đã được **ẩn danh hoá** thành mẫu chuẩn hoá thì mới được giữ. Đây là quy tắc bắt buộc về quyền riêng tư.

### 3.17. Quy tắc trạng thái job AI corr-v1 (làm rõ) (v9)

- **Trạng thái:** Đã thực hiện 2026-11-17 — code + test xong (xem Phần 14 v8 mục 3.16).
- Lỗi có thể thử lại: timeout, HTTP 5xx, lỗi mạng, output không phải JSON. Hết `AI_MAX_RETRIES` (mặc định 2) → `failed`, `aiCorrelationAssessment.status = failed`; kết quả hệ thống không bị ảnh hưởng.
- Grounding loại bỏ toàn bộ claim → job `failed` với `AI_GROUNDING_FAILED` (retryable); không coi là thành công.
- Thử lại thủ công (AI-01) chỉ áp dụng khi `input_fingerprint` của job còn khớp kết quả hệ thống chưa stale; nếu stale phải chạy lại phân tích.

### 3.18. Mức ảnh hưởng và dữ liệu biểu đồ (đợt D/E)

- **Trạng thái:** Đã thực hiện 2026-11-17 (đợt D/E, ghi tiếp vào phiên bản của đợt A/B/C). Nguồn: rà soát sau đợt A/B/C, `docs/modules/analysis_plan.md` v1.2.

- **Mức ảnh hưởng (theo Phần 2 mục 3.29):** DQ-01 và DQ-03: < 1% thấp, 1–10% trung bình, > 10% cao; DQ-02: < 0,5% thấp, 0,5–5% trung bình, > 5% cao (tỷ lệ trên số dòng đang phân tích); DQ-04: chỉ vượt IQR 1,5× → thấp, vượt IQR 3× hoặc Modified Z > 3,5 → trung bình, cả hai phương pháp cùng đánh dấu → cao. Không có dòng → `no_data`, không áp ngưỡng. Biên chính xác (1%, 10%, 0,5%, 5%) thuộc mức trung bình.
- **Thứ tự ưu tiên:** cao → trung bình → thấp → no_data; cùng mức thì tỷ lệ giảm dần.
- **Histogram (quy ước tạm, spec 3.21 còn để ngỏ):** độ rộng bin Freedman–Diaconis `2·IQR·n^(-1/3)`; IQR = 0 → Sturges `⌈log2 n⌉ + 1`; tối đa 50 bin; chỉ dùng giá trị số hợp lệ.
- **Box plot:** râu tới giá trị xa nhất trong [Q1 − 1,5·IQR, Q3 + 1,5·IQR]; điểm ngoài râu chỉ là "có thể bất thường", không mặc định là lỗi.
- **Top N phân loại:** N = `chart_top_n` (1–20, mặc định 5); phần còn lại gộp "Khác".

### 3.19. Vai trò cột, chính sách che mẫu và ma trận tam giác trên (đợt F)

- **Trạng thái:** Đã thực hiện 2026-11-17 (đợt F). Nguồn: demo offline Titanic 2026-11-17 + `docs/modules/analysis_plan.md` v1.4.
- **Kết quả 2026-11-17:** tsc/nest build sạch; unit 208/208 (thêm 20 test cho đợt F), kiến trúc 3/3, e2e 52/52; demo Titanic: tương quan còn 8 cột / 28 cặp (loại PassengerId, Name, Ticket, Cabin), VIF chỉ Age/Fare, prompt có mẫu ô lỗi, cặp đường chéo bị loại, PDF 7 → 4 trang.
- **Nhận diện vai trò cột** (`domain/column-role.util.ts`, chuyển từ `inferRole` của dự án Quality - Structure):
- Đầu vào: kiểu cột đã chốt ở dataset (`number`/`string`/`boolean`/`date`) và **toàn bộ dòng** dùng phân tích. Đếm số giá trị khác nhau trên các ô không thiếu.
- Tên kiểu mã: tách tên cột theo `snake_case`, `camelCase`, khoảng trắng; có token `id`, `code`, `zip`, `phone` (ví dụ `PassengerId` → `passenger`, `id`).
- `date` → `datetime`; `boolean` → `category`; cột không có ô hợp lệ → `text`.
- `number`: là số nguyên + tên kiểu mã + khác nhau ≥ 95% → `identifier`; ≤ 20 giá trị khác nhau **và** khác nhau ≤ 50% số ô hợp lệ → `category`; còn lại → `measure`.
- `string`: tên kiểu mã + khác nhau ≥ 95% → `identifier`; khác nhau > 50% số ô hợp lệ → `text`; ≤ 20 giá trị khác nhau hoặc ≤ 5% số dòng → `category`; còn lại → `text`.
- **Không suy định danh chỉ từ tên cột** (yêu cầu DQ-03): luôn cần thêm điều kiện tỷ lệ khác nhau.
- Đánh dấu `uncertain = true` khi (a) tên kiểu mã nhưng không đạt điều kiện định danh, hoặc (b) cột số được xếp `category`. Kết quả ghi rõ nguồn `system`/`user`.
- Người dùng ghi đè qua `column_roles` trong cấu hình phân tích; `measure` chỉ hợp lệ với cột `number`, `datetime` chỉ với cột `date` (sai → 400 `invalid_column_role`).
- **Dùng vai trò:**

| Vai trò | Ý nghĩa | Tương quan | VIF | DQ-04 (ngoại lệ) |
|---|---|---|---|---|
| `measure` | Số định lượng | Pearson/Spearman (số–số), η² (với phân loại) | Có (trừ cột nhãn) | Có |
| `category` | Phân loại, kể cả số mã hóa ít giá trị (`Survived`, `Pclass`) | Cramér's V / η² | Không | Không |
| `identifier` | Mã định danh (`PassengerId`) | Loại — `identifier_column_excluded` | Không | Không |
| `text` | Văn bản tự do, gần như mỗi dòng một giá trị (`Name`, `Ticket`) | Loại — `free_text_column_excluded` | Không | Không |
| `datetime` | Cột ngày | Loại — `date_column_excluded_from_correlation_vif` (giữ như cũ) | Không | Không |

- **Che mẫu gửi AI** (`domain/pii-mask.util.ts` → `maskForAi`):
1. Cột người dùng đánh dấu PII (`is_pii = true`) → `***`.
2. Giá trị khớp mẫu email / số điện thoại / CCCD → `***`.
3. Cột vai trò `identifier` hoặc `text` → **dạng mẫu**: chữ thường → `a`, chữ hoa → `A`, chữ số → `d`, giữ dấu câu và khoảng trắng (`Braund, Mr. Owen Harris` → `Aaaaaa, Aa. Aaaa Aaaaaa`).
4. Các cột còn lại (`category`, `measure`, `datetime`) → giá trị thật.
- Mọi giá trị cắt ≤ 40 ký tự. Không còn trường hợp "không che được", nên bỏ cơ chế loại ô (`dropUnmaskable`).
- Mẫu gửi AI chỉ gồm **ô lỗi** của lần chạy: sai kiểu (DQ-03), ngoại lệ (DQ-04), dòng trùng (DQ-02); ô thiếu không có giá trị nên không gửi. Tối đa 20 ô/cột; cột không có ô lỗi thì không có mẫu.
- `cell_evidence.value_masked` dùng cùng chính sách (trước đây luôn là `***`).
- **Prompt corr-v1:** ma trận chỉ gửi các ô `colA < colB` theo thứ tự cột phân tích (tam giác trên, không đường chéo); kèm danh sách vai trò cột.
- **Grounding:** cặp `colA == colB` → `droppedClaims` ("cặp đường chéo"), không vào `notablePairs`.
- **Biểu đồ theo vai trò cột:** `measure` → histogram/box plot; `category` → Top N + "Khác"; `identifier`/`text`/`datetime` và cột `is_pii` → không vẽ Top N (không in giá trị định danh/họ tên ra Tổng kết/PDF).
- **PDF mục 4:** mỗi cặp không thứ tự in một lần, bỏ đường chéo, xếp theo |hệ số| giảm dần, cặp không tính được để cuối; dòng dẫn ghi số cặp và vai trò cột/cột bị loại.

### 3.20. Cột ngày trong DQ, bộ đọc ngày chặt và Nghi vấn (đợt G)

- **Trạng thái:** Đã thực hiện 2026-11-17 (đợt G). Nguồn: bộ test offline `local_VQD` (oracle độc lập + tiêm lỗi, file `MISSED_ERRORS.md`) + `docs/modules/analysis_plan.md` v1.5.
- **Kết quả 2026-11-17:** tsc/nest build sạch; unit 221/221 (thêm 13 test đợt G), kiến trúc 3/3, e2e 52/52; bộ test offline `local_VQD` (9 dataset): nhóm A (bỏ sót trong phạm vi DQ-01..04) 5 → 0, taxis hết FAIL phủ cột và báo trùng giả, tiêm lỗi vào cột ngày bắt 60/60, ký hiệu thiếu / hoa-thường / khoảng trắng ở cột chữ được báo ở nhóm Nghi vấn 106/106 mỗi loại; còn lại chỉ RC-01 (DQ-05, để đợt sau).
- **Chọn cột DQ:** cấu hình không chọn cột → mọi cột của dataset; tương quan/VIF lọc riêng theo vai trò (`datetime`, `identifier`, `text` bị loại kèm lý do). Fingerprint của lần chạy mới thay đổi do danh sách key có thêm cột ngày.
- **Bộ đọc ngày** (`analysis/domain/date-parse.util.ts`): `parseStrictDate(value, order)` và `detectDayMonthOrder(values)`; dùng cho DQ-03 cột ngày và phân tích thời gian.
- **Định dạng ngày hợp lệ (danh sách chặt):** `YYYY-MM-DD`, `YYYY/MM/DD`; ISO ngày–giờ (`YYYY-MM-DDTHH:mm[:ss[.SSS]][Z|±HH:mm]`, cho phép dấu cách thay `T`); `DD/MM/YYYY` hoặc `MM/DD/YYYY` (dấu `/`, `-` hoặc `.`), có thể kèm giờ `HH:mm[:ss]`. Ngày phải có thật trên lịch: `2019-02-30`, tháng 13, giờ 25 → sai (`nonexistent_date`); chuỗi không khớp định dạng nào (`March 5`, `2019-13-45 99:99:99` không phải ngày thật) → sai (`invalid_date_format` hoặc `nonexistent_date`).
- **Thứ tự ngày/tháng theo từng cột:** có giá trị phần đầu > 12 → DD/MM; có giá trị phần sau > 12 → MM/DD; không phân định được → chấp nhận nếu hợp lệ theo một trong hai cách và ghi nghi vấn `ambiguous_date_format`; mâu thuẫn (cả hai phía đều > 12 ở các dòng khác nhau) → giữ DD/MM theo mặc định, các ô không hợp lệ theo DD/MM là sai, kèm nghi vấn.
- **Danh sách ký hiệu thiếu dùng chung** (`src/shared/utils/missing-tokens.util.ts`): `na`, `n/a`, `null`, `none`, `-`, `--`, `?`, `nan`, `#n/a`, `undefined`, `unknown` (không phân biệt hoa/thường, bỏ khoảng trắng). Dùng chung cho suy kiểu cột, DQ-03 và tương quan. **Ảnh hưởng:** tương quan coi thêm `?`, `--`, `nan`, `#n/a`, `unknown` là ô thiếu khi ghép cặp.
- **Nghi vấn** (`analysis/domain/suspicion.util.ts`, `detectSuspicions`):

| Nghi vấn | Áp dụng cho | Điều kiện |
|---|---|---|
| `missing_token` | Cột chữ (`string`) | Giá trị (bỏ khoảng trắng, không phân biệt hoa/thường) thuộc danh sách ký hiệu thiếu dùng chung |
| `case_variant` | Cột chữ có vai trò `category`/`text`, ≤ 200 giá trị khác nhau | Gom theo chữ thường + gộp khoảng trắng; nhóm có ≥ 2 cách viết |
| `whitespace` | Cột chữ | Ô có khoảng trắng ở đầu hoặc cuối |
| `sentinel` | Cột số | Giá trị thuộc {-1, -9, -99, -999, -9999, 9999, 99999, 999999}, xuất hiện ≥ 2 lần và nằm ngoài hàng rào 3×IQR |
| `constant_column` | Mọi cột | ≥ 2 ô có giá trị và chỉ 1 giá trị khác nhau |
| `ambiguous_date_format` | Cột ngày | Không phân định được DD/MM hay MM/DD |

- Mỗi nghi vấn gồm loại, cột, số ô, tỷ lệ, tối đa 5 ví dụ (đã che theo chính sách che PII theo vai trò cột), mô tả và đề xuất "xác nhận với nguồn".
- Nghi vấn **không có mức ảnh hưởng**, không vào danh sách vấn đề/Top phát hiện, không tự sửa dữ liệu, không gửi AI. Chỉ hiển thị ở **Tổng kết** (`suspicions[]`) và **PDF** (mục "Cần xác nhận với nguồn"); không thêm vào API kết quả phân tích.

- **Năm/tháng:** `analyzeTime` khi không có cột ngày dò cột năm/tháng → `reason`, `timePartColumns`.
- **Vai trò số:** `inferColumnRole` chỉ cho số nguyên thành `category`.

### 3.21. Nhãn theo vai trò, thiếu ở cột chữ và thuật toán Nghi vấn mới (đợt H)

- **Trạng thái:** Đã thực hiện 2026-11-18 (đợt H). Nguồn: bộ edge-cases `local_VQD/edge-cases` (11 file có bẫy dựng sẵn, file `MISSED_ERRORS_edge-cases.md`) + `docs/modules/analysis_plan.md` v1.6.
- **Kết quả 2026-11-18:** tsc/nest build sạch; unit 238/238 (thêm 17 test đợt H), kiến trúc 3/3, e2e 52/52; bộ edge-cases `local_VQD/edge-cases` (11 file, 28 bẫy): 10 → 26 bẫy được báo đúng, chỉ còn E14/E15 (DQ-05, để đợt sau); bộ 9 dataset mẫu không đổi (chỉ còn RC-01), Nghi vấn mới không báo thừa trên dữ liệu mẫu.
- **Vai trò cho cột nhãn/giá trị:** vai trò được suy (`inferColumnRoles`, có ghi đè người dùng) cho hợp của cột được chọn, cột nhãn và cột giá trị, vì hai cột này có thể nằm ngoài danh sách chọn.
- **Mất cân bằng:** đánh giá khi kiểu cột là `string`/`boolean` hoặc vai trò `category`; lớp của cột số là chuỗi của số (`0`, `1`).
- **`toCategory(value, textColumn)`:** cột chữ → chỉ ô rỗng/khoảng trắng là thiếu; cột khác → thêm danh sách ký hiệu thiếu dùng chung. Dùng cho mất cân bằng, Cramér's V, η² và kiểm tra hợp lệ của cột phân loại.
- **Thuật toán Nghi vấn mới:**
  - `identifier_not_unique`: đếm giá trị đã bỏ khoảng trắng; `count` = số ô thuộc các giá trị xuất hiện ≥ 2 lần; ví dụ = giá trị (che theo vai trò) × số lần.
  - `duplicate_key`: cột khóa chọn theo token tên (`nameTokens`) và tỷ lệ giá trị khác nhau (đã chuẩn hóa) ≥ 80% số ô có dữ liệu; khóa dòng = nối giá trị chữ thường + gộp khoảng trắng của mọi cột khóa (bỏ dòng thiếu bất kỳ cột khóa); nhóm ≥ 2 dòng, bỏ nhóm mà mọi dòng giống hệt nhau trên toàn bộ cột. `count` = số dòng trong các nhóm.
  - `locale_number_format`: regex trên ô chuỗi không đọc được bằng `Number`: `^[+-]?\d{1,3}(\.\d{3})+(,\d+)?$`, `^[+-]?\d{1,3}( \d{3})+(,\d+)?$`, `^[+-]?\d+,\d+$`, `^[+-]?\d{1,3}(,\d{3})+(\.\d+)?$`, hoặc có ký hiệu tiền tệ `$ € £ ₫ đ` / mã `VND USD EUR` bao quanh một số.
  - `conditional_missing`: với cột X có tỷ lệ trống ≥ 10%, thử tối đa 10 cột phân loại C (≤ 20 giá trị); nhóm v của C "gần như luôn trống" khi có ≥ 5 dòng và tỷ lệ trống X ≥ 90%; báo khi các nhóm đó chứa ≥ 90% ô trống của X và có ít nhất một nhóm khác với tỷ lệ trống ≤ 10%. Chọn C có độ phủ cao nhất; mỗi X báo một lần.
  - `leading_zero_numeric`: tỷ lệ ô chuỗi khớp `^0\d+$` ≥ 30% trên ô có giá trị, và độ dài phổ biến nhất chiếm ≥ 90%.
  - Sentinel đơn lẻ: giá trị sentinel âm, đúng 1 lần, cột không có giá trị âm khác (không xét hàng rào IQR — với cột dải rộng, -999 có thể nằm trong hàng rào 3×IQR).
- **Độ lệch:** skewness mẫu (`simple-statistics.sampleSkewness`) trên giá trị hợp lệ của cột định lượng, ≥ 4 giá trị; ngưỡng cảnh báo |độ lệch| > 1 (quy ước dự án, chỉ dùng để giải thích).
- **Thứ tự ngày trong thời gian:** `detectDayMonthOrder` → `dateOrder` = `orderModeFor(...)`, `dateOrderAmbiguous` = `ambiguous` hoặc `conflict`.


### 3.22. Thuật toán Nghi vấn tự phát hiện mâu thuẫn (đợt I)

- **Trạng thái:** Đã thực hiện 2026-11-18 (đợt I). Nguồn: file `local_VQD/MISSED_ERRORS*.md` sau đợt H (16 lỗi còn lại đều thuộc DQ-05) + `docs/modules/analysis_plan.md` v1.7.
- **Kết quả 2026-11-18:** tsc/nest build sạch; unit 244/244 (thêm 6 test đợt I), kiến trúc 3/3, e2e 52/52; bộ test `local_VQD` chạy đầy đủ (9 CSV mẫu + tiêm lỗi, 11 CSV edge-cases, 0 FAIL): lỗi bỏ sót 16 → 5 (còn thứ tự hai cột ×2, tốc độ, x/y/z ≤ 12 mm, công thức depth — ngoài phạm vi); tiêm giá trị âm bắt 100%; 8 Nghi vấn mới trên dữ liệu sạch đều là lỗi thật, không báo thừa.
- **Dấu của cột định lượng** (`suspicion.util.ts`, cột số vai trò `measure` hoặc `category` — vd `passengers` 0–6 được suy là phân loại; không xét `identifier`; ≥ 20 giá trị số hợp lệ): bỏ các giá trị đã báo sentinel; `neg` = số giá trị < 0, `zero` = số giá trị = 0. `negative_in_positive` khi 0 < neg ≤ 5% số giá trị; `zero_in_positive` khi 0 < zero ≤ 3% và mọi giá trị còn lại (không tính giá trị âm đã báo) > 0. Hằng số: `SIGN_MIN_VALUES = 20`, `NEGATIVE_MAX_RATE = 0.05`, `ZERO_MAX_RATE = 0.03`.
- **`row_all_measures_missing`:** với ≥ 2 cột vai trò `measure`, đếm dòng mà mọi cột đó trống (`isMissingCell`); ví dụ = số dòng gốc (tối đa 5).
- **`missing_in_filled_group`:** trong `detectConditionalMissing`, khi chọn được cột phân loại C cho cột X, các nhóm v của C có ≥ 5 dòng và tỷ lệ trống X trong (0; 10%] được báo; `count` = tổng ô trống X ở các nhóm đó; ví dụ `C = v: k/n ô trống`.
- Không đổi DQ-05 (`unassessed / no_rule_confirmed`), không đổi fingerprint.


### 3.23. Sửa lỗi đúng đắn trong phân tích sau merge (đợt K) (v14)

- **Trạng thái:** Đã thực hiện 2026-11-24 (đợt K, sửa lỗi đúng đắn sau merge). Kết quả: unit 1106 pass (2 lỗi `/proc/meminfo` có từ mốc), `test:arch` 23/23, integration 139/142 (3 lỗi MinIO thiếu image, có từ mốc), `arch:api-coverage` 84/84, type-check + lint sạch; `local_VQD` bộ mẫu 0 FAIL / 0 bỏ sót, edge-cases 28/28 bẫy. Chi tiết lỗi và bằng chứng: `docs/modules/analysis_plan.md` mục 7i.
- **K2 — Cột ngày phải vào DQ-01..04.** Hiện trạng: `run-analysis.handler.ts` lọc cột đầu vào bằng `classifyColumn(dataType) !== "excluded"` (hàm dành cho tương quan) → cột `date` bị loại khỏi **mọi** nhóm DQ: ô ngày trống không vào DQ-01, hai dòng chỉ khác thời điểm bị DQ-02 báo **trùng giả**, nghi vấn trên cột ngày (`conditional_missing`…) mất.
  - **Quy tắc mới:** tập cột phân tích DQ = mọi cột kiểu `string` / `number` / `boolean` / `date`. Tương quan / VIF vẫn loại cột ngày kèm lý do `date_column_excluded_from_correlation_vif` (đã có sẵn trong code). Ngày giữ nguyên giá trị thô (OPEN-05) — DQ-03 chỉ đánh dấu ô không phải ngày hợp lệ.
- **K3 — Mức ảnh hưởng DQ-04 trong Tổng kết.** Hiện trạng: `create-summary.handler.ts` gọi `outlierSeverity({ iqr: outlierCount, iqrExtreme: 0, zscore: 0, both: 0 })` → DQ-04 **luôn "Thấp"** dù `dq_summary.columns[].outlierBreakdown` đã có phân rã.
  - **Quy tắc mới:** dùng `outlierBreakdown` của cột (ngưỡng `impact.util.ts`: cả IQR và Modified-Z → Cao; IQR 3× hoặc Z → Trung bình; chỉ IQR 1,5× → Thấp). Bản kết quả cũ không có phân rã → giữ cách cũ (Thấp).
- **K4 — Nhãn số vai trò phân loại.** Hiện trạng: hệ thống tự chọn cột nhãn là cột vai trò `category` (OPEN-06), kể cả cột số như `Survived`, `target` 0/1, `pclass` 1/2/3; nhưng `evaluateImbalance` thấy `dataType = number` thì trả `not_applicable_continuous` → **tự mâu thuẫn**, không bao giờ đánh giá mất cân bằng với nhãn số.
  - **Quy tắc mới:** `evaluateImbalance` nhận thêm vai trò cột; cột số vai trò `category` được đánh giá như nhãn phân loại (giá trị số là tên lớp). Cột số vai trò khác vẫn `not_applicable_continuous`; cột ngày không đổi.
- **Không đổi:** hợp đồng API, ngưỡng mức ảnh hưởng, cách tự suy cột nhãn/thời gian/giá trị (OPEN-06).
- **Ngoài phạm vi (ghi nhận, báo nhóm):** K6 — loại thông báo `analysis_completed` / `ai_analysis_ready` đã định nghĩa trong module notifications nhưng chưa nơi nào tạo; realtime `analysis.completed` vẫn chạy. Là tính năng chưa làm, không phải lỗi.


### 3.24. Hiện thực T1 — mẫu theo khuôn và ngưỡng đồng thuận (v15)

- **Trạng thái:** Đã thực hiện 2026-11-24 — `feedback.service.ts` (`syncFindingExample`, `columnTraitsFromFindingId`, `templateExampleDescription`), `analysis/domain/rag-few-shot.util.ts` (`computeTrustScore`, `isEligibleForStore`, `MIN_AGREEMENT_FOR_STORE`).
- **Lý do:** trước v15, mô tả mẫu = `reason` người dùng nhập (chỉ che email/SĐT) và được `renderFewShotBlock` chèn **nguyên văn** vào prompt AI của mọi lần phân tích trong workspace — trái §3.16.2 ("không dùng nguyên văn trong prompt"), Phần 6 v9 dòng 595 và tình huống #43, đồng thời mở đường cho **prompt injection** từ nhận xét của một người sang lượt AI của người khác. Ngưỡng vào kho cũng lệch: `computeTrustScore(2) = 0,65 ≥ 0,6` nên 2 người đã đủ.

| # | Quy tắc | Hiện thực |
|---|---|---|
| T1-1 | Mô tả mẫu | Sinh theo khuôn `"<cụm nhãn> — <loại lỗi> trên cột có đặc tính \"<đặc tính cột>\""`. Cụm nhãn: `correct`/`partially_correct` → "AI phát hiện đúng", `false_positive` → "AI báo nhầm, không phải lỗi", `missed_issue` → "AI bỏ sót vấn đề". **Không** dùng `reason` |
| T1-2 | Đặc tính cột | Phần sau dấu `:` của `findingId` (vd `DQ-01:age` → `age`); qua `stripIdentifiers`, bỏ ký tự điều khiển/xuống dòng, gộp khoảng trắng, tối đa 80 ký tự |
| T1-3 | Gom trùng | Cùng (workspace, loại lỗi, mô tả, nhãn mẫu) → **một** mẫu; người thứ 4, 5… chỉ cập nhật `agreement_count`/`trust_score`. **v16:** đồng thuận = số tác giả khác nhau trên **mọi nhãn nhận xét cùng ánh xạ nhãn mẫu đó** — `correct` + `partially_correct` → mẫu "đúng"; `false_positive` → mẫu "sai"; `missed_issue` → mẫu "bỏ sót" |
| T1-4 | Ngưỡng | `trust`: 0 người 0,4 · 1 người 0,5 · **2 người 0,55** · 3 người 0,8 · 4 người 0,9 · ≥ 5 người 0,95. Vào kho khi **≥ 3 người** và trust ≥ 0,6 |
| T1-5 | Sửa / xoá nhận xét | Đếm lại số người cho (finding, nhãn mẫu) bị ảnh hưởng — nhãn cũ khi đổi nhãn hoặc xoá, nhãn mới khi đổi nhãn (**v16:** chỉ đếm lại 2 lần khi nhãn mẫu khác nhau, vd `correct` ↔ `partially_correct` là cùng mẫu) — và cập nhật trust của mẫu. Tụt dưới 3 người → trust < 0,6 → bị loại khi truy xuất (`rankFewShot` lọc `minTrustScore`) |
| T1-6 | Lỗi RAG | Không chặn việc lưu nhận xét (chỉ ghi cảnh báo) |

**OPEN-FB-01:** mẫu đã lưu **trước** v15 trong `few_shot_examples` có thể chứa `reason` nguyên văn. Cần quét một lần trên môi trường đã có dữ liệu (xoá mềm mẫu có `description` không theo khuôn T1-1).

## 4. Đầu vào và đầu ra

- **Đầu vào:** Yêu cầu người dùng, kết quả các phần trước và mã nguồn/tài liệu hiện trạng liên quan.
- **Đầu ra:** Hoàn thiện kế hoạch lần đầu trong file v1, cập nhật v2; ghi rõ quyết định, lý do, phương án khác, trade-off, rủi ro, giới hạn và ảnh hưởng liên quan.

## 5. Điều kiện hoàn tất phần này

Logic, trường hợp biên và tiêu chí đánh giá được xác nhận; rà lại các thiết kế trước nếu có ảnh hưởng.

**Trạng thái v2:** logic phân tích (DQ-01..DQ-04, liên hệ/VIF, mất cân bằng, thời gian) và logic AI đã có đặc tả đủ để thiết kế ở phần 8–9. Các câu hỏi còn mở ở mục 6.2 cần chốt trước khi bắt đầu implementation.


### 3.6b. Quyết định chốt nhóm A — Logic & AI (v8, 2026-11-07)

1. **Schema port AI (Zod strict + grounding bắt buộc):** request/response port AI dùng **Zod strict** (chung `packages/contracts`). Trường bắt buộc của `corr-v1`: `notablePairs[{colA,colB,coef,kind,n}]`, `highVif[]`, `limits[]`, `nextSteps[]`, `modelId`, `promptVersion`. Grounding: mỗi claim phải khớp ô/VIF hệ thống với `|coef AI − coef hệ thống| ≤ 0.01`, thiếu trường hoặc sai số vượt ngưỡng → assessment `failed` + `reason`. Lỗi từng phần không trả nửa kết quả — trả `failed` kèm lý do để client thử lại (UC-22).
2. **Che PII:** kết hợp **regex theo loại** (email/phone/CMND/CCCD) **+ cột do user đánh dấu PII** tại Data Views. Phạm vi chỉ **20 ô lỗi/cột** gửi AI; giá trị thay bằng `***`. Ô không che được thì **loại khỏi prompt**, giữ thống kê tổng hợp, ghi log `pii_unmaskable_dropped` (không log giá trị).
3. **Làm tròn:** domain lưu `coef/VIF/commonNRate` **4 chữ số thập phân** (`commonNRate` đã `toFixed(4)`); chặn mọi `NaN/Infinity` ở domain helper. Hiển thị mặc định: `coef` 2, `VIF` 1, `rate` phần trăm 1 chữ số. PDF/Tổng kết tuân thủ cùng quy ước.
4. **Thứ tự ưu tiên & gom nhóm Tổng kết:** sắp theo **mức ảnh hưởng (Cao→Thấp)**, rồi **số ô lỗi giảm dần**, rồi **DQ-01→DQ-05**. Gom nhóm theo **cặp cột/cột** cho tương quan/VIF; **không gộp khác loại hệ số** (Pearson/Spearman/Cramér's V/η² trình bày riêng).
5. **Số phát hiện AI tối đa:** **giữ toàn bộ**, không cắt ở backend; **phân trang ở client** (cursor theo `|coef|/VIF`). Backend vẫn xếp sẵn theo `|coef|`/`VIF` giảm dần để client hiển thị đúng thứ tự ưu tiên.

### 3.6c. Trạng thái triển khai (v8, cập nhật 2026-11-07)

Đã hiện thực hoá trong `src/backend/src/modules/analysis/`:

| Quyết định | File hiện thực | Kiểm thử |
|---|---|---|
| Zod strict + grounding ±0.01 | `domain/ai-grounding.util.ts` (`CorrV1RawSchema.safeParse`) | `corr-vif-ai.spec.ts` → "thieu truong / sai kieu → failed invalid_corr_v1_shape" |
| Xếp sẵn `|coef|`/VIF giảm dần | `domain/ai-grounding.util.ts` (`notablePairs.sort`, `highVif.sort`) | "sap xep notablePairs theo \|coef\| giam dan" |
| Giữ toàn bộ `limits`/`nextSteps` | `domain/ai-grounding.util.ts` (bỏ cắt 20) | "giu toan bo limits/nextSteps, khong cat 20" |
| Che PII regex + cột đánh dấu PII | `domain/pii-mask.util.ts`, `datasets/schemas/dataset.schema.ts` (`is_pii`) | "v8: che PII (regex + cot danh dau PII)" |
| Ô không che được → loại khỏi prompt | `domain/pii-mask.util.ts` (`maskCell` → `dropped`) | "o khong che duoc → loai khoi prompt" |
| Làm tròn 4 chữ số, chặn NaN/Infinity | `domain/correlation.util.ts` (`round4`), `domain/vif.util.ts` | "lam tron domain 4 chu so, chan NaN/Infinity" |
| RAG few-shot — cosine thuần trong MongoDB, cap 50k FIFO | `domain/rag-few-shot.util.ts`, `ai/rag-few-shot.service.ts`, `schemas/few-shot-example.schema.ts` | "v8: RAG few-shot (cosine trong MongoDB, cap 50k FIFO)" |

## 6. Câu hỏi và phụ thuộc còn mở (v2)

### 6.1. Đã chốt

**Ở v5 (2026-11-06):**
- **5 model ứng viên** để benchmark: `Qwen3-14B`, `Gemma-3-12B`, `Qwen3-8B`, `Llama-3.1-8B`, `Vistral-7B` (mục 3.15.2). Loại trước benchmark: `Qwen3-30B-A3B` (vượt RAM), `DeepSeek-R1-Distill-Qwen-14B` (p95 quá cao), `Phi-4-mini`, `PhoGPT-4B` (quá nhỏ).
- **9 chỉ số trên 5 nhóm** với ngưỡng tuyệt đối và trọng số 100 điểm: F1 micro (30), F1 macro theo 5 loại DQ (10), JSON hợp lệ (12), ảo giác (10), chất lượng giải thích tiếng Việt (13), p95 latency (10), throughput (5), RSS (5), độ ổn định (5) — mục 3.15.5.
- **Kiểm định thống kê bắt buộc:** McNemar cho cặp đúng/sai, Wilcoxon signed-rank cho điểm judge; chỉ tuyên bố thắng khi **ΔF1 ≥ 0,03 và p < 0,05**.
- **Đường Pareto** (p95 latency × F1, kích thước = RSS) quyết định model; không chọn điểm chất lượng tuyệt đối cao nhất.
- **Chấm chéo** thay cho judge `Qwen3-32B` (vượt RAM) — model khác họ chấm để tránh self-preference bias.
- **Kiến trúc định tuyến hai tầng**: tầng nhanh (gợi ý nhãn, phân loại, JSON ngắn) + tầng sâu (giải thích, gợi ý, nhận xét); benchmark quyết định model nào chạy tầng nào (mục 3.15.6).
- **Benchmark chạy lại bắt buộc** mỗi khi đổi model / phiên bản / prompt template / engine / kho few-shot.

**Ở v4 (2026-11-05):**
- **AI chạy nội bộ, không gọi API bên ngoài** (mục 3.15).
- **Engine suy luận:** `vLLM` (prod) / `Ollama` (dev) / `llama.cpp` (fallback), đều sau `AiInferencePort` (mục 3.15.4).
- **Cơ chế chạy AI:** bất đồng bộ qua **Kafka** (`ai.jobs`), timeout 180s, retry 2 lần, hết hàng đợi 10 phút → `skipped` (mục 3.9).
- **Nhận xét người dùng** gắn cấp phát hiện và cấp phân tích; lưu vào `finding_feedback` (append-only) (mục 3.16).
- **Học lại:** T1 few-shot động qua RAG (kho mẫu chuẩn hoá + embedding cục bộ `Qwen3-Embedding-0.6B`, top-5) + T3 làm bộ benchmark (mục 3.16).
- **Định dạng đầu vào:** chỉ `.csv` (mục 3.12).

**Ở v2:**
- Phạm vi dữ liệu đưa vào mô hình: thống kê tổng hợp + tối đa 20 ô lỗi/cột đã che PII (mục 3.9, 3.10).
- Ngưỡng ảnh hưởng và số mẫu tối thiểu: theo bảng tại phần 2, mục 3.29 (mục 3.11 ở đây).
- Thư viện thống kê: `simple-statistics` + `ml-matrix` (mục 3.14).
- Logic nhập file/sheet, bất biến dữ liệu, dấu vân tay đầu vào: mục 3.12, 3.13.

**Đã bị thay thế ở v4:** Gemini API (mục 3.9 v2), job table MongoDB + polling nền (mục 3.9 v2), giới hạn định lượng chưa chốt (nay chốt ở mục 3.9 v4), điều khoản xử lý dữ liệu ngoài EU (mục 3.10 v2).

### 6.2. Đã chốt ở v8 (2026-11-07)

1. ~~**Schema kỹ thuật port AI:**~~ **Đã chốt v8 (Zod strict + grounding 0.01, failed khi thiếu/sai):** cấu trúc request/response chuẩn (JSON Schema hay Zod), trường bắt buộc, cách biểu diễn mức độ ảnh hưởng và trạng thái xác minh, cách AI tham chiếu bằng chứng (mã bằng chứng hay mô tả tự do), cấu trúc phản hồi khi lỗi từng phần.
2. ~~**Chi tiết che PII:**~~ **Đã chốt v8 (regex + cột đánh dấu, `***`, loại ô không che được):** cơ chế phát hiện PII (regex theo loại dữ liệu, từ khóa nghiệp vụ, hay chỉ dựa vào cột đã đánh dấu là PII), phạm vi áp dụng (chỉ ô lỗi hay cả thống kê), dạng thay thế (`***`, giữ trục giữa, hash), và quy tắc khi không che được.
3. ~~**Thư viện thống kê + làm tròn:**~~ **Đã chốt v8: domain 4 chữ số (`coef/VIF/commonNRate`), hiển thị coef 2 / VIF 1 / rate % 1, chặn NaN/Infinity ở domain (thư viện chốt từ v2: `simple-statistics` + `ml-matrix`, mục 3.14).**
4. ~~**Thứ tự ưu tiên phát hiện và cách gom nhóm phát hiện**~~ **Đã chốt v8 (mức ảnh hưởng→số ô→DQ, gom theo cặp cột, không gộp loại hệ số)** trong Tổng kết (tiêu chí chốt tại §3.6b).
5. ~~**Số phát hiện AI tối đa**~~ **Đã chốt v8 (giữ toàn bộ, phân trang client)** được giữ lại: **giữ toàn bộ, phân trang ở client** (§3.6b).
6. ~~**Giới hạn tinh chỉnh tham số**~~ **Đã chốt v8 (theo Phần 2 v9): IQR 1.0–3.0 (def 1.5); Z 2.5–4.5 (def 3.5); thiếu 0–0.5; IR 2–5 (def 3); VIF cố định.**
7. ~~**Quy tắc bố cục báo cáo PDF**~~ **Đã chốt v8 (theo Phần 2 v9): PDF FULL — top 50, bằng chứng phân trang, phụ lục đầy đủ.**

### 6.3. Phụ thuộc bên ngoài (v4)

**Không còn phụ thuộc API mô hình bên ngoài.** Điểm này là thay đổi lớn nhất về mặt vận hành: hệ thống **không còn cần khoá API, không còn bị giới hạn quota nhà cung cấp**, và không còn phụ thuộc mạng ra Internet cho phần AI.

- **Model files:** tải trước (`Qwen3-14B` Q4_K_M ~10 GB, `Qwen3-8B` ~6 GB, `Qwen3-Embedding-0.6B` ~1,2 GB) và lưu trong volume của VPS hoặc R2. **Phải có checksum SHA-256** để xác minh. Không tải lúc runtime — VPS có thể mất mạng và lượt suy luận sẽ fail.
- **Dung lượng đĩa:** tổng ~18 GB cho model + container image ~8 GB (vLLM) → cần **≥ 40 GB trống**, kiểm tra khi triển khai.
- **RAM:** `Qwen3-14B` (~10 GB) + API + worker + Kafka + MongoDB + Redis phải **dùng chung 15 GB**. Đây là nút thắt: phải đặt `Qwen3-8B` làm model chính nếu RAM thực tế thấp hơn 15 GB. Quy tắc kiểm tra lúc khởi động: **từ chối khởi động nếu RAM khả dụng < 12 GB** (mục 10 v4).
- **Kafka:** phụ thuộc broker nội bộ; nếu Kafka không sẵn sàng thì **job AI không chạy được** → adapter phải fail an toàn, Tổng kết vẫn có kết quả hệ thống.
- **MongoDB** là hạ tầng cho cả dữ liệu và kho nhận xét.
- **Vector store cho kho mẫu (T1):** chọn **MongoDB Atlas Vector Search** (đã dùng Atlas) hoặc `pgvector`/Qdrant. Với khối lượng mẫu nhỏ (vài nghìn), có thể dùng **tìm kiếm cosine thuần trong MongoDB** để tránh thêm hạ tầng — chốt sau khi đo khối lượng thực tế.
- **Nền tảng CPU:** engine suy luận cần hỗ trợ **AVX2/AVX512**. VPS hiện tại phải được kiểm tra; nếu thiếu AVX512 thì tốc độ giảm đáng kể và phải tính lại ngưỡng latency trong benchmark.

## 7. Prompting log và lịch sử thay đổi
- **Thực hiện v16 / 2026-11-24:** Hoàn tất — `FeedbackScope.labels`, `labelsForExampleLabel` (`feedback.service.ts`), `countDistinctAuthors` đếm `$in` nhóm nhãn / Người dùng duyệt plan.
- **Đề xuất v16 / 2026-11-24:** Sửa T1-3 / T1-5 — đồng thuận theo nhóm nhãn mẫu / Bản audit commit phát hiện hồi quy của v15 (`partially_correct` hạ trust mẫu `correct`) / Sửa bảng §3.24; docs trước code.
- **Thực hiện v15 / 2026-11-24:** Hoàn tất code + test mục 3.24 / Người dùng duyệt plan / Đổi trạng thái sang đã thực hiện; assert cũ `computeTrustScore(2) >= 0.6` và `isEligibleForStore` theo HOẶC trong `corr-vif-ai.spec.ts` đổi có chủ đích theo T1-4.
- **Đề xuất v15 / 2026-11-24:** Hiện thực T1 đúng hợp đồng (mục 3.24) / Rà soát module `feedback`: mẫu RAG chứa `reason` nguyên văn + ngưỡng 2 người; người dùng chọn mẫu theo khuôn + ≥ 3 người / Thêm mục 3.24 + ghi chú §3.16.4; docs trước code.
- **Thực hiện / 2026-11-24:** Hoàn tất code + test mục 3.23 (đợt K) / Người dùng duyệt đợt K / Đổi trạng thái sang đã thực hiện.
- **Đề xuất v14 / 2026-11-24:** Sửa lỗi đúng đắn trong phân tích sau merge (đợt K) / Lỗi K2–K4 phát hiện khi đánh giá code sau merge, người dùng duyệt sửa / Thêm mục 3.23; docs trước code.

- **Thực hiện đợt I / 2026-11-18:** Hoàn tất code + test / Người dùng duyệt plan đợt I / Đổi trạng thái sang đã thực hiện; điều chỉnh khi cài: kiểm tra dấu áp cho cả cột số vai trò phân loại (vd `passengers` 0–6), không chỉ cột định lượng.
- **Đề xuất v13 / 2026-11-18:** Thuật toán Nghi vấn tự phát hiện mâu thuẫn (đợt I) / Người dùng chọn tự phát hiện → Nghi vấn, không khai báo quy tắc (vá lỗi còn lại trong `local_VQD/MISSED_ERRORS*.md`) / Thêm mục 3.22; docs trước code.
- **Thực hiện đợt H / 2026-11-18:** Hoàn tất code + test / Người dùng duyệt plan đợt H / Đổi trạng thái sang đã thực hiện; điều chỉnh khi cài: sentinel đơn lẻ không xét hàng rào IQR, cột khóa của `duplicate_key` phải có ≥ 80% giá trị khác nhau, `dateOrder = null` khi cột chỉ có ngày ISO.
- **Đề xuất v12 / 2026-11-18:** Nhãn theo vai trò, thiếu ở cột chữ và thuật toán Nghi vấn mới (đợt H) / Người dùng vấn đáp nghiệp vụ và duyệt plan đợt H (vá lỗi bỏ sót trong `local_VQD/MISSED_ERRORS_edge-cases.md`) / Thêm mục 3.21; docs trước code.
- **Thực hiện đợt G / 2026-11-17:** Hoàn tất code + test / Người dùng duyệt plan đợt G / Đổi trạng thái sang đã thực hiện.
- **Đề xuất v11 / 2026-11-17:** Cột ngày trong DQ, bộ đọc ngày chặt và Nghi vấn (đợt G) / Người dùng vấn đáp nghiệp vụ và duyệt plan đợt G (sửa lỗi bỏ sót trong `local_VQD/MISSED_ERRORS.md`) / Thêm mục 3.20; docs trước code.
- **Thực hiện đợt F / 2026-11-17:** Hoàn tất code + test / Người dùng duyệt và yêu cầu thực thi đợt F / Đổi trạng thái sang đã thực hiện.
- **Đề xuất v10 / 2026-11-17:** Vai trò cột, chính sách che mẫu và ma trận tam giác trên (đợt F) / Người dùng duyệt plan đợt F (sửa 6 lỗi phát hiện khi demo Titanic) / Thêm mục 3.19; docs trước code.
- **Thực hiện đợt D/E / 2026-11-17:** Hoàn tất code + test cho mục 3.18 / Người dùng yêu cầu thực thi D, E (sau khi commit A/B/C) / Đổi trạng thái mục 3.18 sang đã thực hiện.
- **Đề xuất đợt D/E / 2026-11-17:** Mức ảnh hưởng và dữ liệu biểu đồ / Rà soát sau đợt A/B/C, người dùng yêu cầu ghi tiếp vào phiên bản hiện tại / Thêm mục 3.18; chờ duyệt trước khi sửa code.
- **Thực hiện / 2026-11-17:** Hoàn tất code + test cho mục 3.17 / Người dùng yêu cầu thực thi đợt A, B, C / Đổi trạng thái mục 3.17 sang đã thực hiện.
- **Đề xuất v9 / 2026-11-17:** Quy tắc trạng thái job AI corr-v1 (làm rõ) / Rà soát code module analysis theo yêu cầu người dùng / Thêm mục 3.17; chờ duyệt trước khi sửa code.
- **Xác nhận v5 / 2026-11-06:** Yêu cầu **5 model AI local để so sánh và chọn model tối ưu nhất**, kèm bàn luận về tiêu chí so sánh / Theo yêu cầu người dùng / Chọn 5 ứng viên theo *giả thuyết* (Qwen3-14B, Gemma-3-12B, Qwen3-8B, Llama-3.1-8B, Vistral-7B); loại trước benchmark 4 model vượt ràng buộc; thay 6 tiêu chí bằng **9 chỉ số / 5 nhóm** có ngưỡng tuyệt đối + trọng số 100; thêm kiểm định thống kê (McNemar, Wilcoxon), đường Pareto, và kiến trúc định tuyến hai tầng; **bỏ judge `Qwen3-32B`** (vượt RAM 15 GB) thay bằng chấm chéo; viết lại mục 3.15.2–3.15.7.
- **Xác nhận v4 / 2026-11-05:** AI chạy nội bộ bằng model cục bộ, không gọi API bên ngoài; chọn `Qwen3-14B` (chính) + `Qwen3-8B` (fast-path) / Theo lựa chọn người dùng / Bổ sung mục 3.15 với bảng ứng viên, hạ tầng suy luận, quy trình benchmark 6 tiêu chí; gỡ toàn bộ nội dung Gemini ở mục 3.9, 3.10, 6.1, 6.3. (Chọn model cụ thể bị thay thế bởi v5: v5 yêu cầu benchmark 5 model rồi mới chốt.)
- **Xác nhận v4 / 2026-11-05:** Thêm nhận xét người dùng ở cấp phát hiện và cấp phân tích; học lại bằng T1 few-shot động qua RAG + T3 làm bộ benchmark / Theo lựa chọn người dùng / Bổ sung mục 3.16 với cấu trúc nhận xét, quy trình chuẩn hoá, truy xuất và đo lường.
- **Xác nhận v4 / 2026-11-05:** Hệ thống chỉ làm việc với file `.csv`; gỡ toàn bộ logic đọc `.xlsx` / Theo yêu cầu người dùng / Viết lại mục 3.12; ảnh hưởng Phần 2, 3, 7, 8, 11, 13, 14.
- **Xác nhận v4 / 2026-11-05:** Job AI chuyển từ job table MongoDB + polling sang Kafka topic `ai.jobs`; timeout 180s; trạng thái `skipped` khi quá hạn hàng đợi / Theo lựa chọn người dùng (Kafka + Socket.IO) / Cập nhật mục 3.9, đồng bộ Phần 9 v3.

- **Xác nhận v2 / 2026-11-04:** Dùng `simple-statistics` cho thống kê mô tả + `ml-matrix` cho tương quan/VIF/ma trận / Theo lựa chọn người dùng / Bổ sung mục 3.14, bổ sung quy tắc bọc thư viện trong domain helper và kiểm thử golden values.
- **Xác nhận v2 / 2026-11-04:** Nhà cung cấp AI là Gemini API, model Flash miễn phí; chấp nhận dữ liệu dùng để train ngoài EU, ghi rõ trong tài liệu bàn giao / Theo lựa chọn `gemini` / Bổ sung mục 3.9 và 3.10.
- **Xác nhận v2 / 2026-11-04:** AI chạy bất đồng bộ nền, timeout 60s, retry 2 lần, lỗi AI không chặn Tổng kết / Theo lựa chọn `async_job` / Bổ sung mục 3.9 với trạng thái job và cơ chế khôi phục sau restart.
- **Xác nhận v2 / 2026-11-04:** Job table MongoDB + polling nền trong API process, không thêm Redis/BullMQ/Kafka / Theo lựa chọn `mongo_job` / Bổ sung mục 3.9, ghi rõ lý do không dùng hạ tầng event platform của hệ thống tham chiếu.
- **Xác nhận v2 / 2026-11-04:** Gửi tối đa 20 ô lỗi/cột cho AI, che PII bắt buộc; mọi nơi ghi "AI chỉ nhận thống kê tổng hợp" phải hiểu là không nhận toàn bộ mẫu dòng/giá trị ô / Theo lựa chọn `send_sample_masked` / Sửa mục 3.2, 3.3, 3.4, 3.6, 3.7 và bổ sung mục 3.10.
- **Xác nhận v2 / 2026-11-04:** Ngưỡng ảnh hưởng và số mẫu tối thiểu theo phương án đề xuất / Theo phương án được duyệt / Bổ sung mục 3.11, đồng bộ với phần 2 mục 3.29.
- **Xác nhận v2 / 2026-11-04:** ~~Quy tắc nhập file/sheet, xóa dòng, sửa ô (`keep` + `warn_only`) và dấu vân tay đầu vào~~ — **bị gỡ bởi quyết định 2026-11-05** (mục 3.13 viết lại). / Theo lựa chọn người dùng / Bổ sung mục 3.12 và 3.13.
- **Xác nhận v2 / 2026-11-04:** Bằng chứng ở mức ô lưu collection riêng / Theo lựa chọn `cell_level` + `separate_collection` / Ghi nhận ranh giới bằng chứng và tham chiếu bằng chứng trong kiểm chứng phản hồi AI ở mục 3.9.
- **Xác nhận v1 / 2026-11-03:** Ghi nhận tổng hợp thời gian, khoảng trống và sàng lọc IQR trên chênh lệch kỳ / Người dùng đồng ý đề xuất / Bổ sung mục 3.8 làm đầu vào thiết kế logic/kiểm thử, chưa triển khai backend.
- **Xác nhận v1 / 2026-11-03:** Ghi nhận đánh giá mất cân bằng lớp và ngưỡng IR ≥ 3 theo phần 2 / Người dùng đồng ý đề xuất / Bổ sung mục 3.7 làm đầu vào thiết kế logic và kiểm thử, chưa triển khai backend.
- **Xác nhận v1 / 2026-11-03:** Ghi nhận phương pháp liên hệ ba loại cặp và VIF theo phần 2 / Người dùng đồng ý đề xuất / Bổ sung mục 3.6 và đồng bộ xử lý dữ liệu không hợp lệ tại DQ-03, chưa triển khai backend.
- **Xác nhận v1 / 2026-11-03:** DQ-05 giữ hoãn cấu hình quy tắc và báo chưa đánh giá khi chưa có quy tắc xác nhận / Người dùng chọn giữ phạm vi hiện tại / Bổ sung mục 3.5, không mở rộng logic hoặc triển khai backend.
- **Xác nhận v1 / 2026-11-03:** Ghi nhận DQ-04 và phương pháp outliers từng cột theo phần 2 / Người dùng đồng ý đề xuất / Bổ sung mục 3.4 làm đầu vào logic và kiểm thử, chưa triển khai backend.
- **Xác nhận v1 / 2026-11-03:** Ghi nhận DQ-03 và cấu hình kiểu/định dạng, minh bạch phần dữ liệu hợp lệ dùng trong phân tích / Người dùng đồng ý đề xuất / Bổ sung mục 3.3 làm đầu vào thiết kế logic và kiểm thử, chưa triển khai backend.
- **Xác nhận v1 / 2026-11-03:** Ghi nhận tiêu chí DQ-01/DQ-02 đã được người dùng đồng ý tại phần 2 / Làm đầu vào cho logic xử lý và kiểm thử / Bổ sung mục 3.2, chưa triển khai backend hoặc chốt các tiêu chí còn mở.
- **Xác nhận v1 / 2026-11-03:** Backend xác định ba mức ảnh hưởng hoặc Chưa đủ cơ sở; tách trạng thái xác minh và xử lý mâu thuẫn từng phát hiện AI / Người dùng đồng ý phương án / Bổ sung mục 3.1 làm đầu vào thiết kế logic và kiểm thử sau, chưa triển khai backend.
- **Xác nhận v1 / 2026-11-03:** Chốt sáu nội dung mỗi phát hiện AI và phân biệt nghi vấn/vấn đề hệ thống đã xác nhận / Theo xác nhận người dùng / Làm đầu vào cho thiết kế phản hồi và kiểm chứng, chưa triển khai backend.
- **Xác nhận v1 / 2026-11-03:** AI chỉ nhận kết quả thống kê / Theo lựa chọn người dùng / Cập nhật phạm vi đầu vào và giới hạn bằng chứng; chưa triển khai hoặc gửi dữ liệu ra ngoài. (Bị thay thế bởi quyết định v2 ngày 2026-11-04: thống kê + tối đa 20 ô lỗi/cột đã che PII.)
- **Ghi nhận v1 / 2026-11-03:** Hướng dùng API mô hình ngoài và phân chia trách nhiệm backend/AI đã được đồng ý trong thảo luận tính năng / Theo xác nhận người dùng / Là đầu vào cho thiết kế chi tiết sau, chưa triển khai hoặc gửi dữ liệu ra ngoài.
- **Yêu cầu:** Người dùng yêu cầu liệt kê toàn bộ các phần theo thứ tự thực hiện, tạo sẵn file v1, lần lượt hoàn thiện vòng đầu rồi tạo v2 khi có thay đổi tiếp theo.
- **v1 / 2026-11-02:** Tạo khung phần 12 / Chuẩn bị thảo luận tuần tự / Chỉ tạo tài liệu, chưa thực thi thay đổi backend hoặc dữ liệu.

