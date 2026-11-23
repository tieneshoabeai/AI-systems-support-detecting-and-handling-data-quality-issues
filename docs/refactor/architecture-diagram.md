# Sơ đồ kiến trúc trước / sau (P0.4)

## Trước: Clean Architecture 4 tầng (mỗi module lặp lại)

```mermaid
flowchart TD
    C[Controller<br/>presentation] --> H[Handler<br/>application/commands+queries]
    H --> E[Entity/VO<br/>domain]
    H --> P[Port<br/>domain/ports]
    A[Adapter<br/>infrastructure/adapters] --> P
    R[Repository<br/>infrastructure/persistence] --> P
    R --> M[(Mongo Model<br/>schema)]
    C --> G[Guard/Pipe/Filter<br/>shared/interfaces]
    H --> TX[TransactionPort<br/>shared]
```

> 1 request đi qua 4 thư mục: `presentation/` → `application/` → `domain/` → `infrastructure/`.

## Sau: Modular Monolith vertical slice (mỗi module 1 thư mục phẳng)

```mermaid
flowchart LR
    subgraph MOD ["modules/<ten>/ (phẳng)"]
        R1[*.routes.ts<br/>controller + DTO]
        S[*.service.ts<br/>nghiệp vụ]
        RP[*.repository.ts<br/>truy vấn DB]
        SC[*.schema.ts<br/>Mongoose model]
        T[*.types.ts<br/>type + port token]
    end
    R1 --> S --> RP --> SC
    S --> T
    MOD --> K[shared kernel<br/>guards/pipes/filters/tx/outbox/events/storage]
    K --- DB[(Mongo/Redis/MinIO)]
```

> 1 request chỉ đọc 1 thư mục module + shared kernel. Ranh giới module giữ nguyên, enforce bằng ESLint MM2 + arch test MM5/MM6.
