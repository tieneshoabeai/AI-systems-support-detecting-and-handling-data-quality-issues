# KẾ HOẠCH TRIỂN KHAI CHI TIẾT MODULE LINEAGE
**Dự án:** Nền tảng Full-stack Quản lý & Giám sát Chất lượng Dữ liệu có AI Hỗ trợ  
*(Full-Stack Data Management & Quality Assurance Platform with AI Assistance)*  
**Tập tin:** `docs/modules/lineage_plan.md`  
**Phiên bản:** v1.0  
**Giai đoạn:** Sprint B3 — Module 1: Đồ thị Phả hệ Neo4j AuraDB (`lineage`)  

---

## 1. Bối cảnh & 3 Câu hỏi Cốt lõi (Rule 1)
- **Đang làm gì?** Hiện thực hóa Module `lineage` (`src/backend/src/modules/lineage/`) gồm 4 RESTful endpoints: Get DAG Lineage (F8.1), Upstream Root-cause (F8.2), Downstream Impact (F8.3), và Verify Integrity (F8.4).
- **Cho ai?** Cho Kỹ sư Dữ liệu và Analyst cần quan sát chuỗi phả hệ dữ liệu dưới dạng đồ thị có hướng không chu trình (DAG).
- **Để làm gì?** 
  - Mô hình hóa các nút thực thể `Dataset`, `DatasetVersion`, `Transformation` và các cạnh quan hệ trên cơ sở dữ liệu đồ thị Neo4j AuraDB.
  - Hỗ trợ React Flow (`@xyflow/react`) hiển thị giao diện đồ thị phả hệ tương tác cao.
  - Phân tích nguyên nhân gốc rễ (Root-cause Analysis) và mức độ ảnh hưởng lan truyền (Downstream Impact).
  - Đối soát tính toàn vẹn (Integrity Verification) giữa chuỗi băm Merkle lưu trên Atlas và cấu trúc đồ thị Neo4j AuraDB.
  - Sử dụng Outbox Processor Worker để đồng bộ bất đồng bộ từ MongoDB Atlas sang Neo4j AuraDB, đảm bảo tính nhất quán cuối cùng (Eventual Consistency).

---

## 2. Đặc tả Hợp đồng API (API Contracts)

| Method | Endpoint | Quyền hạn CASL | Mô tả chức năng |
| :---: | :--- | :---: | :--- |
| `GET` | `/api/v1/datasets/:id/lineage` | `Action.Read` trên `Lineage` | F8.1: Xuất đồ thị DAG (Nodes, Edges) cho React Flow |
| `GET` | `/api/v1/datasets/:id/lineage/upstream` | `Action.Read` trên `Lineage` | F8.2: Phân tích nguyên nhân gốc rễ (Root-cause Analysis) |
| `GET` | `/api/v1/datasets/:id/lineage/downstream` | `Action.Read` trên `Lineage` | F8.3: Phân tích mức độ ảnh hưởng lan truyền (Impact Analysis) |
| `POST` | `/api/v1/datasets/:id/lineage/verify` | `Action.Read` trên `Lineage` | F8.4: Đối soát tính toàn vẹn chuỗi Merkle hash |

---

## 3. Cấu trúc Tệp & Nhiệm vụ Hiện thực hóa

### 3.1. Cấu trúc Thư mục Module
```
src/backend/src/modules/lineage/
├── dto/
│   └── lineage.dto.ts                  # Zod validation schemas & TypeScript types
├── services/
│   ├── lineage.service.ts              # Xử lý truy vấn DAG Cypher, Upstream, Downstream
│   └── outbox-processor.worker.ts      # Cron worker quét outbox_events đồng bộ sang AuraDB
├── lineage.controller.ts               # RESTful Controller tích hợp Jwt & PoliciesGuard
├── lineage.module.ts                   # Module definition và Dependency Injection
└── README.md                           # Tài liệu đặc tả kiến trúc chuẩn 6 phần
```

---

## 4. Ma trận Rủi ro & Giải pháp Phòng ngừa

| Rủi ro Kỹ thuật | Mức độ | Giải pháp phòng ngừa |
| :--- | :---: | :--- |
| **Mất kết nối Neo4j AuraDB làm gián đoạn API chính** | Cao | Sử dụng Outbox Pattern (ghi sự kiện vào MongoDB Atlas trước), worker đồng bộ sang AuraDB chạy nền độc lập với cơ chế retry tối đa 5 lần. |
| **Lỗ hổng Cypher Injection** | Nghiêm trọng | 100% câu lệnh Cypher sử dụng truy vấn tham số hóa (`$param`), cấm ghép chuỗi. |
| **Vi phạm Zero Any Policy (Rule 13)** | Nghiêm trọng | Ép kiểu dữ liệu an toàn từ kết quả bản ghi Cypher bằng Type Guards và Zod Schema. |
