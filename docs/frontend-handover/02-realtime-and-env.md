# Realtime, Env, Tunnel & Loi thuong gap

## 1. Realtime (Socket.IO)

- Gateway: `WebSocketGateway({ path: '/api/v1/realtime', transports: ['websocket', 'polling'] })`.
- Ket noi (bat buoc co token):
  ```ts
  import { io } from 'socket.io-client';
  const socket = io(ORIGIN, {
    path: '/api/v1/realtime',
    transports: ['websocket', 'polling'],
    auth: { token: access_token },
    query: { token: access_token }, // gui ca 2 de chac chan
  });
  socket.on('connected', (p) => console.log('rooms', p.rooms)); // [user:<userId>]
  socket.on('error', (e) => console.error(e)); // { code: 4401 | 'SOCKET_DISABLED', message }
  ```
- Tham gia room co kiem quyen:
  ```ts
  socket.emit('joinProject', { projectId }, (ack) => {});
  socket.emit('joinAnalysis', { analysisId, projectId }, (ack) => {});
  socket.emit('leaveProject', { projectId });
  socket.emit('leaveAnalysis', { analysisId });
  ```
  `projectId/analysisId` phai la ObjectId 24 hex, sai -> `ack = { ok: false }`.
- Server tu join `user:<userId>` ngay khi handshake. Room: `user:<id>`, `project:<id>`, `analysis:<id>`.
- Su kien server day (chi `id + trang thai + so lieu`, khong bao gio co gia tri o/email/reason):
  `notification.created | ai.quality.updated | analysis.progress | analysis.completed | analysis.failed | ai.job.status | feedback.created`
  Envelope:
  ```json
  {
    "event": "analysis.progress",
    "occurredAt": "2026-11-10T02:00:00.000Z",
    "projectId": "...",
    "analysisId": "...",
    "status": "running",
    "progress": 45,
    "stage": "correlation",
    "notificationId": "...",
    "jobId": "..."
  }
  ```
- Neu `SOCKET_ENABLED=false` o backend, moi ket noi bi tu choi voi `SOCKET_DISABLED`.
- Goi y UI: man hinh Analysis subscribe `analysis.progress` de ve progress bar, `analysis.completed/failed` de reload result; chuong thong bao subscribe `notification.created` roi goi lai `GET /notifications/unread-count`.

## 2. Bien moi truong frontend (de xuat)

```bash
# Local
VITE_API_BASE_URL=http://localhost:3000/api/v1
VITE_SOCKET_ORIGIN=http://localhost:3000
VITE_SOCKET_PATH=/api/v1/realtime

# Tunnel / staging (URL thay moi lan restart quick tunnel)
VITE_API_BASE_URL=https://<tunnel-host>/api/v1
VITE_SOCKET_ORIGIN=https://<tunnel-host>
VITE_SOCKET_PATH=/api/v1/realtime
```

- Tuyet doi khong hardcode `http://localhost:3000` trong code. Nguoi mo qua tunnel ma frontend goi `localhost` thi chinh la may ho -> `Failed to fetch`.
- Axios mau:
  ```ts
  const api = axios.create({ baseURL: import.meta.env.VITE_API_BASE_URL });
  api.interceptors.request.use((c) => {
    const t = localStorage.getItem('access_token');
    if (t) c.headers.Authorization = `Bearer ${t}`;
    return c;
  });
  api.interceptors.response.use(
    (r) => r,
    async (err) => {
      const orig = err.config;
      if (err.response?.status === 401 && !orig._retried) {
        orig._retried = true;
        const rt = localStorage.getItem('refresh_token');
        const { data } = await axios.post(`${BASE}/auth/refresh`, { refresh_token: rt });
        localStorage.setItem('access_token', data.data.access_token);
        orig.headers.Authorization = `Bearer ${data.data.access_token}`;
        return api(orig);
      }
      throw err;
    }
  );
  // Doc du lieu: const inner = res.data.data;
  // Doc loi: err.response.data.error.message (mang field khi ZOD_VALIDATION_ERROR)
  ```
- Tai file bao cao:
  ```ts
  const res = await api.get(`/projects/${pid}/report/${rid}/file`, { responseType: 'blob', validateStatus: (s) => s === 200 || s === 202 });
  if (res.status === 202) { /* chua xong: res.data = meta */ }
  else { /* res.data la blob text */ }
  ```

## 3. Chay qua Cloudflare Tunnel (de nguoi khac vao duoc)

Backend giu nguyen `http://localhost:3000`, tunnel chi forward:

Terminal 1:
```bash
cd src/backend
pnpm run start:dev   # doi: Server is running at: http://localhost:3000/api/v1
```
Terminal 2 (terminal moi):
```bash
cloudflared tunnel --url http://localhost:3000
# duoc URL: https://xxx.trycloudflare.com
```
- Moi lan restart quick tunnel la URL doi -> URL cu chet han, phai gui URL moi.
- Nguoi xem mo docs bang URL tunnel moi + chon Servers = `Current origin`.
- Neu van `Failed to fetch`: 99% la backend tat (`cloudflared` log `dial tcp 127.0.0.1:3000: connection refused`) hoac frontend/Swagger con tro `localhost`.
- Backend `.env` khi demo:
  ```bash
  NODE_ENV=development
  CORS_ORIGIN=*
  CLOUDFLARE_TUNNEL_URL=https://<url-tunnel-hien-tai>
  ```
  Production moi siet `CORS_ORIGIN` ve domain that.

## 4. Loi thuong gap va cach xu ly o frontend

| Hien tuong | Nguyen nhan | Frontend lam gi |
|---|---|---|
| Swagger/axios `Failed to fetch`, `Request URL: http://localhost:3000/...` khi mo qua tunnel | Server trong Swagger dang chon `Local Development Server` hoac `VITE_API_BASE_URL` con `localhost` | Chon Servers = `Current origin`, sua env tro tunnel, rebuild |
| `502 / Bad Gateway` qua tunnel + log `Unable to reach the origin service` | Backend chua chay | Chay lai `start:dev` roi moi mo tunnel |
| `Blocked by CORS` (production) | Origin khong nam trong `CORS_ORIGIN` va khong phai `*.trycloudflare.com` | Bao backend them domain vao `CORS_ORIGIN` |
| `401` hang loat | `access_token` het han | Goi `/auth/refresh` 1 lan roi retry; het ca refresh thi da ve login |
| `403` o `/admin/issues*` | Tai khoan `analyst` | An menu admin voi `role !== 'admin'` |
| Upload CSV `400` | Sai dinh dang, qua 50MB, khong co file, hoac project da co dataset | Hien dung message server tra, khong cho upload file thu 2 khi da co dataset |
| `PATCH issue status` loi version | `expectedVersion` cu (optimistic locking) | Load lai detail lay version moi roi cho user thu lai |
| Socket `4401` | Thieu/sai token | Lay token moi roi `socket.auth.token = ...; socket.connect()` |
| `ZOD_VALIDATION_ERROR` | Body/query sai schema | `message` la mang `{ field, message }` -> map vao tung input |
