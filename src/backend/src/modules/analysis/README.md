# MODULE `analysis` - Phan tich chat luong du lieu & AI

> **Module Specification & Documentation**

## 1. Thong tin Phien ban (Version Information)

- **Current Version:** v1.1.0
- **Last Updated:** 2026-11-21
- **Module Path:** `src/backend/src/modules/analysis` (56 file TypeScript)
- **Architecture Layer:** Clean Architecture 4 tang (`domain` -> `application` -> `infrastructure` -> `presentation`)
- **Layer Rules:** CA1-CA14 - xem [`../README.md`](../README.md)

## 2. Muc dich & Pham vi Nghiep vu (Scope & Responsibility)

Module loi cua he thong: chay **phan tich chat luong du lieu (DQ)** bang thong ke xac dinh, sau do giao cho **AI cuc bo** dien giai ket qua va sinh khuyen nghi.

```text
Dataset ---> Run Analysis ---> DQ Rules (deterministic) ---> AI Grounding ---> AI Inference
                  |                                                       |
                  `------------------> Analysis Result <---------------- AI Job (queued)
                                        |
                                        |---> Report (PDF)
                                        |---> Summary
                                        `---> Feedback (Human-in-the-Loop)
```

### 2.1. Tinh nang thuoc pham vi

| Chuc nang | Noi dung |
|---|---|
| Chay phan tich | Thong ke DQ, tuong quan, VIF, trung lap, ngoai le |
| AI job | Dua job vao hang doi, worker thuc thi, retry, lease, heartbeat |
| Ket qua | Luu & doc analysis run, cell evidence |
| Bao cao | Sinh PDF tu ket qua |
| Tong ket | Tao & doc summary |
| RAG few-shot | Thu thap phan hoi, chon vi du cho prompt toi lun |

### 2.2. Cau truc thu muc

```text
analysis/
|-- domain/                            # Toan bo thuat toan thuan, khong framework
|   |-- dq.util.ts                    # DQ-01/02: thieu, sai kieu, trung lap
|   |-- stats.util.ts                 # Thong ke mo ta
|   |-- correlation.util.ts           # Pearson, Spearman, Cramer's V, Eta^2
|   |-- vif.util.ts                   # VIF (da cung tuyen)
|   |-- column-role.util.ts           # Phan vai tro cot
|   |-- date-parse.util.ts            # Nhan dien thu tu ngay/thang
|   |-- impact.util.ts                # Muc do anh huong cua finding
|   |-- suspicion.util.ts             # Nghi van (rule dua tren pattern)
|   |-- ai-grounding.util.ts          # Chu bi grounding cho AI
|   |-- pii-mask.util.ts              # Che PII truoc khi gui AI
|   |-- top-n.util.ts                 # Top-N
|   |-- input-fingerprint.util.ts     # Fingerprint dau vao
|   |-- rag-few-shot.util.ts          # Chuan hoa & chon vi du few-shot
|   `-- ports/
|       |-- analysis.repository.port.ts
|       `-- rag-few-shot.port.ts
|-- application/
|   |-- commands/
|   |   |-- run-analysis.handler.ts          # Chay phan tich
|   |   |-- build-prompt-for-job.handler.ts  # Dung prompt
|   |   |-- ingest-ai-result.handler.ts      # Nap ket qua AI
|   |   |-- retry-job.handler.ts             # Thu lai job
|   |   |-- request-report.handler.ts        # Yeu cau bao cao
|   |   `-- create-summary.handler.ts        # Tao tong ket
|   |-- queries/                     # 5 query handler
|   |-- services/
|   |   |-- ai-worker.service.ts            # Worker AI
|   |   |-- rag-few-shot.service.ts
|   |   `-- report-worker.service.ts
|   |-- ports/
|   |   |-- ai-inference.port.ts             # Port suy luan AI
|   |   `-- resource-guard.port.ts           # Port bao ve tai nguyen
|   |-- report-content.util.ts               # Noi dung bao cao (muc PDF)
|   |-- pdf-builder.util.ts                  # Dung PDF
|   `-- policy-loaders/                     # 2 loader
|-- infrastructure/
|   |-- ai/
|   |   |-- local-inference.adapter.ts       # Ollama / vLLM
|   |   `-- system-resource-guard.adapter.ts # Doc /proc/meminfo
|   `-- persistence/                        # 7 schema
`-- presentation/
    |-- controllers/analysis.controller.ts
    |-- controllers/report.controller.ts
    |-- controllers/summary.controller.ts
    `-- dtos/run-analysis.dto.ts
```

## 3. Nhat ky Prompting & Quyet dinh Ky thuat (Prompting Log & Rationale)

- **User Prompt / Business Intent:** Dua **quyet dinh chat luong du lieu** ve phia may (thong ke xac dinh, lặp lai duoc, kiem chung duoc) va chi dung **AI** cho phan **dien giai** va **khuyen nghi** - noi may khong the lam duoc. Ngoai ra, he thong phai **an toan tai nguyen** khi suy luan AI, va **khong bao gio** gui du lieu PII ra ngoai.

- **Technical Reasoning & Decisions:**

1. **Tach phan xac dinh khoi phan dien giai.** Thong ke DQ, tuong quan, VIF la **deterministic** - chay lai cho ket qua giong het, kiem chung duoc, giai thich duoc. AI dien giai, vi du: "cot `tuoi` thieu 42% du lieu, day la nguyen nhan chinh". Tach hai tang nay tranh hien tuong AI bao ket qua sai ma van co ve.

2. **Cramér's V dang sparse (GĐ8).** Ma tran contingency **day** voi 2 cot phan loai 20 gia tri x 20 gia tri x 100.000 dong tao ma tran 4 trieu o - vua cham vua ton bo nho. Cong thuc Cramer's V chi can `chi-square = sum((O-E)^2/E)` va `V = sqrt(chi2/(n*(min(r,c)-1)))`. `correlation.util.ts` duyet mot lan qua cac cap gia tri da **nen** (dem so lan xuat hien), tinh truc tiep tong khong can bang. Ket qua **giong het** cong thuc goc nhung chi dung O(distinct) bo nho.

3. **VIF co canh bao mat mau.** VIF chi dung duoc tren cac dong du **du** du lieu cho tat ca cot. Neu chi 40% dong du, ket qua khong dang tin. Module tinh `commonNRate` va canh bao: >= 80% khong canh bao; 50-80% "can than trong"; < 50% canh bao nghiem trong. Ma tran ky hang (cot phu thuoc tuy bien) duoc danh dau `singular: true` va cac cot lien quan `computable: false` kem `reason`.

4. **Quy uoc so hoc thong nhat (OPEN-10).** Moi he so tuong quan dung **phan ky mau** (`sampleStandardDeviation`), khong phai phan ky tong.

5. **Vai tro cot dung chung cho ca hai tang (GD7).** `column-role.util.ts` phan loai cot thanh `identifier | category | measure | text | datetime`. Cot `identifier` (gia tri gan nhu duy nhat) va cot `text` bi **loai** khoi tuong quan va VIF. Cột do nguoi dung chi dinh co `source: 'user'`; cot do he thong suy luan co `source: 'system'` + `uncertain: true` + `reason`. `run-analysis.handler.ts` va `build-prompt-for-job.handler.ts` **cung** dung logic nay - cot bi loai khoi phan tich toan hoc cung bi loai khoi prompt AI, tranh viec AI lua ve cot khong lien quan.

6. **Fingerprint phat hien du lieu stale.** `FINGERPRINT_VERSION = 2` bam fingerprint cua `dataset.id + file_checksum + row_count + columns[{key,name,data_type,is_pii}]`. Khi dataset hoac cot **thay doi**, ket qua cu bi danh dau loi thoi thay vi hien thi nhu con hieu luc. Cot tham chieu bang **key bat bien** `c{i}` khong phai ten - nguoi dung co the doi ten cot bat ky luc nao.

7. **Guard tai nguyen chong OOM.** `SystemResourceGuardAdapter` doc `/proc/meminfo` + RSS tien trinh. Khi RAM con < `AI_MIN_RAM_GB` (4 GB) hoac RAM da dung > `AI_RAM_GUARD_PERCENT` (90%), worker **tu choi** job moi. Job bi tu choi **khong bi mat** - no o lai hang doi va duoc thu lai o vong poll sau.

8. **Gioi han so dong dua vao prompt.** `ANALYSIS_MAX_ROWS` (mac dinh 100 000) va `run-analysis.handler.ts` **don gian hoa ban sao trung gian** de giam dinh RAM.

9. **Che PII truoc khi gui AI.** `pii-mask.util.ts` che gia tri cua cot `is_pii` **truoc** khi gui sang mo hinh. Du mo hinh chay cuc bo, du lieu PII o dang ro cung khong nen duoc gui.

10. **RAG few-shot dong = AI hoc lai.** `rag-few-shot.util.ts` loc theo `trust_score` va `max_age_days`, chuan hoa, `stripIdentifiers` (loai dinh danh ca nhan), chon `top_k`. Day la co che hoc lai ma khong can huan luyen lai mo hinh.

11. **Bao cao PDF va tong ket dung chung bang noi dung.** `report-content.util.ts` dung cac muc bao cao; `pdf-builder.util.ts` render PDF. `create-summary.handler.ts` tao ban **Tong ket** dung chung bang noi dung voi bao cao - hai dau ra khong lech nhau.

- **Generated / Modified Artifacts:**

- `domain/dq.util.ts` - `isMissingCell`, `isMissingToken`, quy tac DQ-01/02.
- `domain/correlation.util.ts` - 4 loai he so, Cramer's V sparse.
- `domain/vif.util.ts` - VIF qua `ml-matrix`, `commonNRate`, canh bao mat mau.
- `domain/column-role.util.ts` - 5 vai tro cot, nguon `user` / `system`.
- `domain/input-fingerprint.util.ts` - `FINGERPRINT_VERSION = 2`.
- `domain/pii-mask.util.ts` - che PII truoc khi gui AI.
- `domain/rag-few-shot.util.ts` - chon vi du few-shot.
- `infrastructure/ai/local-inference.adapter.ts` - Ollama / vLLM, `extractJsonObject`.
- `infrastructure/ai/system-resource-guard.adapter.ts` - doc `/proc/meminfo`.
- `application/services/ai-worker.service.ts` - vong doi job, lease, heartbeat, retry.

## 4. Dac ta Giao tiep Ky thuat (Technical Contracts & API Specifications)

### 4.1. Endpoints

| Method | Path | Chinh sach | Mo ta |
|---|---|---|---|
| `POST` | `/api/v1/projects/:projectId/analysis` | `Action.Execute` | Chay phan tich |
| `GET` | `/api/v1/projects/:projectId/analysis/result` | `Action.Read` | Ket qua gan nhat |
| `GET` | `/api/v1/analysis/jobs/:jobId` | `Action.Read` | Trang thai job AI |
| `POST` | `/api/v1/analysis/jobs/:jobId/retry` | `Action.Execute` | Thu lai job |
| `POST` | `/api/v1/analysis/jobs/:jobId/result` | Internal | Nap ket qua AI (worker) |
| `POST` | `/api/v1/projects/:projectId/report` | `Action.Create` | Yeu cau bao cao PDF |
| `GET` | `/api/v1/projects/:projectId/report/:reportId/file` | `Action.Read` | Tai bao cao |
| `POST` | `/api/v1/projects/:projectId/summary` | `Action.Create` | Tao tong ket |
| `GET` | `/api/v1/projects/:projectId/summary` | `Action.Read` | Doc tong ket |

### 4.2. Interfaces / Providers duoc export ra ngoai

`src/backend/src/modules/analysis/index.ts` export public contract:

| Export | Vai tro |
|---|---|
| `AnalysisModule` | Nest module |
| `Analysis` entity, `Finding`, `CellEvidence` | Domain contract |
| `ANALYSIS_REPOSITORY_PORT` | Port truy van ket qua |
| `RAG_FEW_SHOT_PORT` | Port lay vi du few-shot |

> **Khong co `AI_INFERENCE_PORT` hay `RESOURCE_GUARD_PORT` trong public contract.**
> - `AI_INFERENCE_PORT` **khong ton tai**: adapter suy luan AI (`LocalInferenceAdapter`)
>   doc cau hinh truc tiep qua `ConfigService` (`AI_INFERENCE_BASE_URL`,
>   `AI_INFERENCE_API_KEY`) va duoc inject noi bo trong `AnalysisModule`.
> - `RESOURCE_GUARD_PORT` la port **noi bo cua module** (`application/ports/resource-guard.port.ts`),
>   hiện thực bởi `SystemResourceGuardAdapter`. Khong re-export ra ngoài `index.ts`.

### 4.3. Su kien domain phat ra

| Event | Khi nao | Muc dich |
|---|---|---|
| `analysis.completed` | Phan tich xong | Thong bao + realtime |
| `analysis.failed` | Phan tich that bai | Thong bao + realtime |
| `ai.job.queued` | Job AI vao hang doi | Realtime |
| `ai.job.status` | Job doi trang thai | Realtime tiến độ |
| `ai.quality.updated` | Ket qua AI co nhan xet | Realtime |
| `report.ready` | Bao cao PDF san xong | Thong bao |

## 5. Rang buoc & Tieu chuan Bat bien (Invariants & Security Rules)

### 5.1. Bat bien nghiep vu

- Ket qua phan tich **phai** kem `input_fingerprint`; ket qua co fingerprint lech voi dataset hien tai bi danh dau **stale**.
- Cot bi loai khoi phan tich toan hoc **phai** bi loai khoi prompt AI (cung dung `column-role.util.ts`).
- Moi bao cao phan tich phai noi ro **bao nhiu dong thuc su duoc kiem tra** (`checkedRows`, `excludedRows`, `method`, `reason`).
- VIF khong duoc bao cao **khong kem** canh bao mat mau khi `commonNRate` < 80%.
- He so tuong quan dung **phan ky mau**, khong dung phan ky tong.
- Mot cot boolean **khong** duoc tinh histogram so.
- Gia tri null khi sap xep theo so / ngay **phai** nam o cuoi danh sach.
- Job AI **khong** duoc nhan khi `SystemResourceGuardAdapter` bao RAM khong du.
- Job AI het lease **phai** co the bi worker khac claim lai - khong de ket.
- `ANALYSIS_MAX_ROWS` **phai** duoc ton trong khi dung prompt.

### 5.2. Xoa mem (Soft Delete)

- **Chuan:** `deleted_at: Date | null` - truong nay **null** nghia la ban ghi dang hoat dong.
- **Quy tac truy van:** moi truy van mac dinh luon loc `deleted_at: null`. Repository base (`shared/infrastructure/database/base-mongo.repository.ts`) ap dung dieu nay tu dong.
- **Choi index Partial Unique:** `partialFilterExpression: { deleted_at: null }` - cho phep tai khoan / ten / email da xoa mem duoc tao lai.

### 5.3. Bao mat

| Van de | Cach xu ly |
|---|---|
| PII lo ra khi suy luan AI | `pii-mask.util.ts` che gia tri cot `is_pii` truoc khi gui |
| PII lo qua RAG few-shot | `stripIdentifiers` loai dinh danh ca nhan khoi vi du |
| OOM khi suy luan | `SystemResourceGuardAdapter` + `ANALYSIS_MAX_ROWS` + don gian hoa ban sao |
| Doc ket qua cua project khac | Policy loader kiem tra instance `projectId` |
| Report cua nguoi khac | Policy loader tren `projectId` |
| Ket qua AI gia mao | `ingest-ai-result.handler.ts` validate payload bang schema |
| Prompt injection tu du lieu | Chi dua du lieu da che PII vao prompt, dinh dang ro rang |

### 5.4. Phan quyen

| Route | Chinh sach |
|---|---|
| `POST /projects/:projectId/analysis` | `Action.Execute` tren `Analysis` - PROJ-MEMBER tro len |
| `GET /projects/:projectId/analysis/result` | `Action.Read` |
| `GET /analysis/jobs/:jobId` | `Action.Read` + policy loader kiem tra job thuoc project cua toi |
| `POST /analysis/jobs/:jobId/retry` | `Action.Execute` |
| `POST /analysis/jobs/:jobId/result` | **Noi bo** - chi worker, khong phai route cong khai cho client |
| `POST /projects/:projectId/report` | `Action.Create` |
| `GET /projects/:projectId/report/:reportId/file` | `Action.Read` + kiem tra report thuoc project |
| `POST/GET /projects/:projectId/summary` | `Action.Create` / `Action.Read` |

## 6. Lich su Thay doi (Change Log & Version History)

### 2026-11-21
- **v1.1.0** / 2026-11-21 / Viet lai README module day du theo chuan 6 phan / Yeu cau tai doc / Tai lieu mau chuan

### 2026-11-XX
- **v1.4.0** / 2026-11-XX / Bo sung `local-inference.adapter.ts` (Ollama / vLLM) va `system-resource-guard.adapter.ts` / Chuyen sang AI cuc bo, khong goi API ben ngoai; chong OOM / `modules/analysis`
- **v1.3.0** / 2026-11-XX / Bo sung `column-role.util.ts` va wire vao ca `run-analysis` va `build-prompt-for-job` (GD7) / Loai cot khong lien quan khoi ca phan tich toan hoc va prompt / `modules/analysis`
- **v1.2.0** / 2026-11-XX / Cramer's V dang sparse (GĐ8) + quy uoc so hoc OPEN-10 / Giam bo nho, chuan hoa phan ky mau / `modules/analysis`
- **v1.1.0** / 2026-11-XX / Bo sung `input-fingerprint.util.ts` (`FINGERPRINT_VERSION = 2`) / Phat hien ket qua stale / `modules/analysis`
- **v1.0.0** / 2026-11-XX / Bo sung VIF + canh bao mat mau + `ANALYSIS_MAX_ROWS` va don gian hoa ban sao (GĐ0) / Bao ve tai nguyen / `modules/analysis`
- **v0.9.0** / 2026-11-XX / Bo sung `rag-few-shot.util.ts` va RAG port / Vong lap Human-in-the-Loop / `modules/analysis`, `modules/feedback`
- **v0.8.0** / 2026-11-XX / Bo sung `report-content.util.ts` + `pdf-builder.util.ts` va report worker / Bao cao PDF, tong ket dung chung noi dung / `modules/analysis`
- **v0.1.0** / 2026-11-XX / Tao module, tach thanh `analysis-config` thanh command rieng / Bo endpoint `/analysis/config`, cau hinh chuyen vao body / `modules/analysis`

- **Dinh dang:** `[Version] / [Ngay] / [Thay doi gi] / [Ly do] / [Anh huong den dau]`
