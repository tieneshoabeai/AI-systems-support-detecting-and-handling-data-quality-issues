# MODULE `notifications` - Thong bao & Tuy chon nguoi dung

> **Module Specification & Documentation**

## 1. Thong tin Phien ban (Version Information)

- **Current Version:** v1.1.0
- **Last Updated:** 2026-11-21
- **Module Path:** `src/backend/src/modules/notifications` (21 file TypeScript)
- **Architecture Layer:** Clean Architecture 4 tang (`domain` -> `application` -> `infrastructure` -> `presentation`)
- **Layer Rules:** CA1-CA14 - xem [`../README.md`](../README.md)

## 2. Muc dich & Pham vi Nghiep vu (Scope & Responsibility)

Module gui thong bao trong he thong: thong bao trong ung dung, push notification qua ntfy, va email.

### 2.1. Tinh nang thuoc pham vi

| Chuc nang | Noi dung |
|---|---|
| Dispatch | Nhan yeu cau gui, kiem tra tuy chon nguoi nhan, luu, day realtime, gui push/email |
| Hop thu | Liet ke, dem chua doc, doc chi tiet, danh dau da doc |
| Tuy chon | Nguoi dung bat/tat tung loai thong bao |

### 2.2. Cau truc thu muc

```text
notifications/
|-- domain/
|   |-- entities/notification.entity.ts
|   |-- value-objects/notification-type.vo.ts
|   |-- events/notification-events.ts
|   `-- ports/notification.repository.port.ts
|-- application/
|   |-- commands/
|   |   |-- dispatch.handler.ts
|   |   |-- mark-as-read.handler.ts
|   |   `-- update-preferences.handler.ts
|   |-- queries/
|   |   |-- list-for-user.handler.ts
|   |   |-- count-unread.handler.ts
|   |   `-- get-detail.handler.ts
|   |-- notification-email.mapper.ts
|   |-- notifications.types.ts
|   `-- notifications.utils.ts
|-- infrastructure/persistence/
|   |-- notification.schema.ts
|   |-- notifications.repository.ts
|   `-- notification.mapper.ts
`-- presentation/
    |-- controllers/notifications.controller.ts
    `-- dtos/list-notifications-query.dto.ts
```

## 3. Nhat ky Prompting & Quyet dinh Ky thuat (Prompting Log & Rationale)

- **User Prompt / Business Intent:** Dam bao nguoi dung **khong bo lo** thong bao quan trong, dong thoi **khong bi spam** thong bao khong can thiet.

- **Technical Reasoning & Decisions:**

1. **Hai loai thong bao BAT BUOC.** `MANDATORY_NOTIFICATION_TYPES = ['issue_needs_info', 'security_alert']`.
   - `issue_needs_info`: quan tri vien yeu cau bo sung thong tin - nguoi dung khong duoc "khong thay" yeu cau.
   - `security_alert`: canh bao bao mat (dang nhap la, thu hoi phien).

   Logic: `isMandatoryNotification(type, explicitFlag)` -> `explicitFlag === true` hoac loai thuoc danh sach; `shouldDispatch(enabled, mandatory)` -> chi bo qua khi `enabled === false` **va** khong bat buoc. Ket qua: nguoi dung tat `security_alert` van **luon** nhan duoc.

2. **Luu DB truoc, day realtime sau.** Neu day realtime loi, thong bao van con trong hop thu - nguoi dung khong bi mat thong tin. Thu tu nguoc lai se tao tinh trang "da gui nhung khong co trong hop thu".

3. **Sai loi realtime khong lam hong luong chinh.** `EventDispatcherService` (module `shared`) bat va ghi log loi - khong rollback transaction da commit.

4. **Tuy chon luu dung thuc** khi nguoi dung tat loai bat buoc: gia tri `false` duoc bo qua khi kiem tra nhung **van luu** de hien thi trung thuc trong UI - nguoi dung thay "khong the tat" thi nhan ro.

- **Generated / Modified Artifacts:**

- `domain/value-objects/notification-type.vo.ts` - `NOTIFICATION_TYPES` (10 loai), `MANDATORY_NOTIFICATION_TYPES`, `isMandatoryNotification`, `shouldDispatch`.
- `application/commands/dispatch.handler.ts` - luong gui: kiem tra tuy chon -> luu -> realtime -> push -> email.
- `application/notification-email.mapper.ts` - mapping loai thong bao -> noi dung email.
- `application/commands/update-preferences.handler.ts` - cap nhat tuy chon.

## 4. Dac ta Giao tiep Ky thuat (Technical Contracts & API Specifications)

### 4.1. Endpoints

| Method | Path | Chinh sach | Mo ta |
|---|---|---|---|
| `GET` | `/api/v1/notifications` | Chu thong bao | Hop thu (phan trang) |
| `GET` | `/api/v1/notifications/unread-count` | Chu thong bao | So chua doc |
| `GET` | `/api/v1/notifications/:id` | Chu thong bao | Chi tiet |
| `PATCH` | `/api/v1/notifications/:id/read` | Chu thong bao | Danh dau da doc |
| `PATCH` | `/api/v1/users/me/notification-preferences` | Chu nguoi dung | Cap nhat tuy chon |

**Query params `GET /notifications`:** `unreadOnly`, `type`, `limit`, `cursor`.

### 4.2. Interfaces / Providers duoc export ra ngoai

`src/backend/src/modules/notifications/index.ts` export public contract:

| Export | Vai tro |
|---|---|
| `NotificationsModule` | Nest module |
| `Notification` entity, `NotificationType` | Domain contract |
| `NOTIFICATION_REPOSITORY_PORT` | Port truy van thong bao |

### 4.3. Su kien domain phat ra

| Event | Khi nao | Muc dich |
|---|---|---|
| `notification.created` | Tao thong bao | Realtime den phong `user:${userId}` |
| `notification.read` | Danh dau da doc | Realtime |

## 5. Rang buoc & Tieu chuan Bat bien (Invariants & Security Rules)

### 5.1. Bat bien nghiep vu

| Loai | Bat buoc |
|---|---|
| `project_created` | Khong |
| `project_deleted` | Khong |
| `project_member_added` | Khong |
| `issue_needs_info` | **Co** |
| `issue_resolved` | Khong |
| `analysis_completed` | Khong |
| `analysis_failed` | Khong |
| `ai_analysis_ready` | Khong |
| `report_ready` | Khong |
| `security_alert` | **Co** |

- Thong bao **luon** duoc luu DB truoc khi day realtime / push / email.
- Loai bat buoc **duoc gui du** nguoi dung tat tuy chon.
- Chi nguoi dung **sau huu** duoc danh dau doc thong bao khac.
- Moi thong bao phai tro toi mot `entityType` + `entityId` de frontend dieu huong.

### 5.2. Xoa mem (Soft Delete)

- **Chuan:** `deleted_at: Date | null` - truong nay **null** nghia la ban ghi dang hoat dong.
- **Quy tac truy van:** moi truy van mac dinh luon loc `deleted_at: null`. Repository base (`shared/infrastructure/database/base-mongo.repository.ts`) ap dung dieu nay tu dong.
- **Choi index Partial Unique:** `partialFilterExpression: { deleted_at: null }` - cho phep tai khoan / ten / email da xoa mem duoc tao lai.

### 5.3. Bao mat

| Van de | Cach xu ly |
|---|---|
| Doc thong bao cua nguoi khac | Policy loader kiem tra `userId` khu vuc |
| Danh dau doc thong bao nguoi khac | Policy loader kiem tra `userId` khu vuc |
| Mat thong bao quan trong | Loai bat buoc khong the tat |
| Spam thong bao | Bo tan tuy chon + `security_alert` luon gui |
| Luu PII trong thong bao | Khong day gia tri o loi / nhận xet qua thong bao; chi day id + trang thai |
| Loi realtime lam mat thong bao | Luu DB truoc; loi realtime chi ghi log |

### 5.4. Phan quyen

| Route | Chinh sach |
|---|---|
| `GET /notifications` | Chu thong bao - loc theo `userId` hien tai |
| `GET /notifications/unread-count` | Chu thong bao |
| `GET /notifications/:id` | Chu thong bao |
| `PATCH /notifications/:id/read` | Chu thong bao |
| `PATCH /users/me/notification-preferences` | Chu nguoi dung |

## 6. Lich su Thay doi (Change Log & Version History)

### 2026-11-21
- **v1.1.0** / 2026-11-21 / Viet lai README module day du theo chuan 6 phan / Yeu cau tai doc / Tai lieu mau chuan

### 2026-11-XX
- **v1.0.0** / 2026-11-XX / Bo sung `security_alert` vao danh sach bat buoc + `shouldDispatch` / Canh bao bao mat khong the tat / `modules/notifications`
- **v0.9.0** / 2026-11-XX / Bo sung `issue_needs_info` vao danh sach bat buoc / Yeu cau bo sung thong tin phai duoc thay / `modules/notifications`, `modules/issues`
- **v0.6.0** / 2026-11-XX / Bo sung `update-preferences.handler.ts` va route `/users/me/notification-preferences` / Nguoi dung tu kiem soat / `modules/notifications`
- **v0.4.0** / 2026-11-XX / Tach `dispatch.handler.ts`: luu DB truoc, day realtime sau / Khong mat thong bao khi realtime loi / `modules/notifications`
- **v0.1.0** / 2026-11-XX / Tao module / Thong bao la kenh thong tin chinh / `modules/notifications`

- **Dinh dang:** `[Version] / [Ngay] / [Thay doi gi] / [Ly do] / [Anh huong den dau]`
