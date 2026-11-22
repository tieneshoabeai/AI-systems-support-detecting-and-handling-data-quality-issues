# Danh mục trực quan hóa

Các `.mmd` là source Mermaid. Phase 5 đã đối chiếu tĩnh và 8 cặp bản nhúng/export khớp nội dung; chưa parser/render do không tìm thấy renderer phù hợp trong runtime đã kiểm tra. Không thay sơ đồ bằng ảnh trang trí. BE chỉ xuất hiện như API boundary.

| Yêu cầu trực quan | Nơi xem | Mức bằng chứng |
|---|---|---|
| Tech Stack Diagram | [tech-stack.mmd](tech-stack.mmd), chương I | Source/config |
| Design System Board | [Chương II, bảng token và component showcase](../02-design-system.md) | Giá trị CSS/props thực, không mock screenshot |
| Component Hierarchy | [component-hierarchy.mmd](component-hierarchy.mmd), chương IV | Provider/wrapper source; có gộp Route/Suspense |
| User Journey Flowchart | [user-flow.mmd](user-flow.mmd), chương III | Flow source, online/demo tách biệt |
| Project Folder Tree | [Chương IV, cây thư mục chọn lọc](../04-system-architecture.md) | Folder thực, không liệt kê mọi file |
| System Architecture | [system-architecture.mmd](system-architecture.mmd), chương IV | Layer FE; không vẽ nội bộ BE |
| Request–Response Sequence | [request-response.mmd](request-response.mmd), chương V | Create-project/upload source, không packet capture |
| Data Flow | [data-flow.mmd](data-flow.mmd), chương V | Unwrap/mapping/state/render + generated types gap |
| Testing Pyramid | [testing-pyramid.mmd](testing-pyramid.mmd), chương VI | Tầng bằng chứng, không tự đặt tỷ lệ |
| CI/CD Pipeline | [cicd-pipeline.mmd](cicd-pipeline.mmd), chương VII | **ĐỀ XUẤT**, pipeline thực NOT FOUND |
| Deployment Architecture | [deployment-architecture.mmd](deployment-architecture.mmd), chương VII | Build script có source; hosting live UNVERIFIED |
| Performance Dashboard | [Chương VIII, bảng metric](../08-security-performance.md) | Hiển thị rõ chưa đo; không tạo p95/FPS giả |

Screenshot giao diện thực, parser/render Mermaid và các metric production mới: **UNVERIFIED** khi hoàn tất Phase 5. Không cài thêm dependency hoặc gửi source ra ngoài để render; chưa tuyên bố visual QA hoàn tất. Chi tiết: [final-review.md](../audit/final-review.md).
