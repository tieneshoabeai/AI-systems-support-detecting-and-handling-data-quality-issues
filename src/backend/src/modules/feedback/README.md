# MODULE `feedback` - Phan hoi & Vong lap hoc lai

> **Module Specification & Documentation**

## 1. Thong tin Phien ban (Version Information)

- **Current Version:** v1.1.0
- **Last Updated:** 2026-11-21
- **Module Path:** `src/backend/src/modules/feedback` (21 file TypeScript)
- **Architecture Layer:** Clean Architecture 4 tang (`domain` -> `application` -> `infrastructure` -> `presentation`)
- **Layer Rules:** CA1-CA14 - xem [`../README.md`](../README.md)

## 2. Muc dich & Pham vi Nghiep vu (Scope & Responsibility)

Module hien thuc **vong lap Human-in-the-Loop**: nguoi dung danh gia ket qua AI, phan hoi duoc luu **bat bien** va dung lam **few-shot example** cho cac lan chay AI sau.

```text
AI Result ---> Nguoi dung danh gia ---> Feedback (bat bien) ---> RAG few-shot
                                                                        |
                                              prompt lan chay sau <----+
```

### 2.1. Tinh nang thuoc pham vi

| Chuc nang | Noi dung |
|---|---|
| Phan hoi muc finding | Danh gia **mot** phat hien cu the |
| Phan hoi muc lan chay | Danh gia **toan bo** ket qua mot lan phan tich |
| Quan ly phan hoi | Sua / xoa phan hoi **cua toi** |
| Chi so chat luong AI | Tinh ty le dung / sai / bo qua theo project |

### 2.2. Cau truc thu muc

```text
feedback/
|-- domain/
|   |-- entities/
|   |   |-- feedback.entity.ts           # phan hoi muc lan chay
|   |   `-- finding-feedback.entity.ts   # phan hoi muc finding
|   |-- value-objects/feedback-label.vo.ts
|   |-- events/feedback-events.ts
|   `-- ports/feedback.repository.port.ts
|-- application/
|   |-- commands/                        # 5 command handler
|   |-- queries/                         # 2 query handler
|   |-- feedback.types.ts
|   `-- feedback.utils.ts
|-- infrastructure/persistence/
|   |-- feedback.schema.ts
|   |-- finding-feedback.schema.ts
|   |-- feedback.repository.ts
|   `-- feedback.mapper.ts
`-- presentation/controllers/feedback.controller.ts
```

## 3. Nhat ky Prompting & Quyet dinh Ky thuat (Prompting Log & Rationale)

- **User Prompt / Business Intent:** Dong lai vong lap giua nguoi dung va AI: moi phan hoi cua nguoi dung phai **bien dich** thanh vi du mau giup AI lam tot hon o lan sau, ma khong can huan luyen lai mo hinh.

- **Technical Reasoning & Decisions:**

1. **Hai cap phan hoi.** `FindingFeedback` (danh gia mot phat hien: "cot nay khong bi thieu") va `Feedback` (danh gia ca lan chay: "ket qua chung nhin on"). Ca hai dung chung bo nhan va muc do nghiem trong. Cap thao fine huu ich cho UI; cap tong hop huu ich cho bao cao.

2. **Nhan bat buoc co ly do.** `LABELS_REQUIRING_REASON = ['false_positive', 'missed_issue', 'other']`. `assertReasonForLabel` nem loi neu chon mot trong ba nhan nay ma khong ghi ly do. Ly do cu the moi giup AI hoc duoc; nhan khong kem ly do chi la tin hieu nho.

3. **Muc do nghiem trong cua nguoi danh gia tach khoi muc do nghiem trong do AI gan.** Hai khai niem khac nhau: "van de nay nghiem trong" (AI) vs " toi nghi van de nay nghiem trong" (nguoi dung). Muc do cua nguoi dung tinh `trust_score` cho RAG.

4. **`trust_score` chuan hoa ve [0, 1].** Dien gop theo nhan: `correct` +1.0, `partially_correct` +0.5, `false_positive` -1.0, `missed_issue` -0.5, `other` 0.0. Phan hoi diem thap bi **loc bo** khi xay dung prompt.

5. **Phan hoi bat bien ve nghiep vu.** `update-mine.handler.ts` chi cho phep sua **phan hoi cua chinh nguoi goi**. Lich su phan hoi duoc giu de truy vet - dung de tinh lai `trust_score` khi doi cong thuc.

6. **RAG loc theo `max_age_days`.** Phan hoi cu khong con dung mo hinh hien tai. Loc theo tuoi la chat luong du lieu, khong phai lam mat du lieu.

7. **`stripIdentifiers` loai dinh danh ca nhan khoi vi du.** Du mo hinh chay cuc bo, khong nen dua PII vao prompt.

- **Generated / Modified Artifacts:**

- `domain/value-objects/feedback-label.vo.ts` - `FEEDBACK_LABELS` (5 nhan), `FEEDBACK_SEVERITIES` (4 muc), `LABELS_REQUIRING_REASON`, `assertReasonForLabel`.
- `domain/entities/finding-feedback.entity.ts` - phan hoi muc finding.
- `domain/entities/feedback.entity.ts` - phan hoi muc lan chay.
- `application/commands/update-mine.handler.ts` - chi sua phan hoi cua toi.
- `application/commands/ai-quality-metrics.handler.ts` - chi so chat luong AI theo project.

## 4. Dac ta Giao tiep Ky thuat (Technical Contracts & API Specifications)

### 4.1. Endpoints

| Method | Path | Chinh sach | Mo ta |
|---|---|---|---|
| `POST` | `/api/v1/analyses/:analysisId/findings/:findingId/feedback` | `Action.Create` | Danh gia mot finding |
| `GET` | `/api/v1/analyses/:analysisId/findings/:findingId/feedback` | `Action.Read` | Doc danh gia cua finding |
| `POST` | `/api/v1/analyses/:analysisId/feedback` | `Action.Create` | Danh gia ca lan chay |
| `GET` | `/api/v1/analyses/:analysisId/feedback` | `Action.Read` | Danh sach danh gia cua lan chay |
| `PATCH` | `/api/v1/feedback/:id` | Chu phan hoi | Sua phan hoi cua toi |
| `DELETE` | `/api/v1/feedback/:id` | Chu phan hoi | Xoa phan hoi cua toi |
| `GET` | `/api/v1/projects/:projectId/ai-quality-metrics` | `Action.Read` | Chi so chat luong AI |

### 4.2. Interfaces / Providers duoc export ra ngoai

`src/backend/src/modules/feedback/index.ts` export public contract:

| Export | Vai tro |
|---|---|
| `FeedbackModule` | Nest module |
| `Feedback`, `FindingFeedback` entities | Domain contract |
| `FeedbackLabel`, `FeedbackSeverity` | Domain contract |
| `FEEDBACK_REPOSITORY_PORT` | Port truy van phan hoi |

### 4.3. Su kien domain phat ra

| Event | Khi nao | Muc dich |
|---|---|---|
| `feedback.created` | Tao phan hoi | Realtime + cap nhat chi so |
| `feedback.updated` | Sua phan hoi | Realtime |
| `feedback.deleted` | Xoa phan hoi | Realtime |
| `ai.quality.updated` | Chi so chat luong thay doi | Realtime |

## 5. Rang buoc & Tieu chuan Bat bien (Invariants & Security Rules)

### 5.1. Bat bien nghiep vu

| Nhan | Bat buoc co ly do |
|---|---|
| `correct` | Khong |
| `partially_correct` | Khong |
| `false_positive` | **Co** |
| `missed_issue` | **Co** |
| `other` | **Co** |

- Muc do nghiem trong phai thuoc `{ low, medium, high, critical }`.
- `trust_score` phai duoc chuan hoa ve khoang [0, 1].
- Chi sua / xoa **phan hoi cua chinh nguoi goi**.
- Phan hoi co `trust_score` duoi nguong hoac qua `max_age_days` **khong** duoc dung lam few-shot.
- Vi du dua vao prompt **phai** qua `stripIdentifiers`.
- Chi so chat luong AI phai tinh duoc tren **tap phan hoi da loc** cho project do.

### 5.2. Xoa mem (Soft Delete)

- **Chuan:** `deleted_at: Date | null` - truong nay **null** nghia la ban ghi dang hoat dong.
- **Quy tac truy van:** moi truy van mac dinh luon loc `deleted_at: null`. Repository base (`shared/infrastructure/database/base-mongo.repository.ts`) ap dung dieu nay tu dong.
- **Choi index Partial Unique:** `partialFilterExpression: { deleted_at: null }` - cho phep tai khoan / ten / email da xoa mem duoc tao lai.

### 5.3. Bao mat

| Van de | Cach xu ly |
|---|---|
| Sua phan hoi cua nguoi khac | Policy loader kiem tra `userId` khu vuc |
| Xoa phan hoi cua nguoi khac | Policy loader kiem tra `userId` khu vuc |
| PII lo qua vi du few-shot | `stripIdentifiers` loai dinh danh ca nhan |
| Manipulate `trust_score` de AI hoc sai | `trust_score` tinh o domain, client khong truyen truc tiep |
| Doc phan hoi cua project khac | Policy loader kiem tra `projectId` |

### 5.4. Phan quyen

| Route | Chinh sach |
|---|---|
| `POST /analyses/:analysisId/findings/:findingId/feedback` | `Action.Create` tren `FindingFeedback` |
| `GET /analyses/:analysisId/findings/:findingId/feedback` | `Action.Read` |
| `POST /analyses/:analysisId/feedback` | `Action.Create` |
| `GET /analyses/:analysisId/feedback` | `Action.Read` |
| `PATCH /feedback/:id`, `DELETE /feedback/:id` | Chu phan hoi (theo `userId` trong ban ghi) |
| `GET /projects/:projectId/ai-quality-metrics` | `Action.Read` tren `Project` |

## 6. Lich su Thay doi (Change Log & Version History)

### 2026-11-21
- **v1.1.0** / 2026-11-21 / Viet lai README module day du theo chuan 6 phan / Yeu cau tai doc / Tai lieu mau chuan

### 2026-11-XX
- **v1.0.0** / 2026-11-XX / Bo sung `ai-quality-metrics.handler.ts` va `GET /projects/:projectId/ai-quality-metrics` / Canh bao chat luong AI truoc khi dua vao su dung / `modules/feedback`
- **v0.8.0** / 2026-11-XX / Bo sung `RAG_FEW_SHOT_PORT` va `stripIdentifiers` / AI hoc lai ma khong lo PII / `modules/feedback`, `modules/analysis`
- **v0.5.0** / 2026-11-XX / Bo sung `LABELS_REQUIRING_REASON` va `assertReasonForLabel` / Chat luong du lieu phan hoi / `modules/feedback`
- **v0.3.0** / 2026-11-XX / Tach 2 cap phan hoi (finding / run) / Vuot qua nhu cau danh gia chi tiet va tong hop / `modules/feedback`
- **v0.1.0** / 2026-11-XX / Tao module / Vong lap Human-in-the-Loop / `modules/feedback`

- **Dinh dang:** `[Version] / [Ngay] / [Thay doi gi] / [Ly do] / [Anh huong den dau]`
