# Batch 5 — Playwright setup

Ngày: 2026-11-17. Đây là bước setup riêng đã được Human xác nhận,
chưa phải hoàn thành hệ thống E2E.

## Đã chuẩn bị

- `@playwright/test` pin 1.61.1, Yarn cập nhật dependency/lockfile.
- Chromium (Chrome for Testing) 149.0.7827.55, revision 1228 đã tải thành công;
  executable tồn tại trong browser cache của máy. Installer cũng tải headless shell và FFmpeg.
- Ban đầu thử 1.65.1: runner cài được nhưng browser installer từ chối macOS 13.
  Máy hiện chạy macOS 13.5.2 x86_64. Chuyển sang 1.61.1 theo platform registry chính thức.
- `playwright.config.ts`: Chromium channel, 1280×900, scale factor 1, locale vi-VN,
  timezone Asia/Ho_Chi_Minh, dark scheme, 1 worker, không retry, forbidOnly.
- Artifacts: `.agents/testing-e2e/results/` và `report/`, được ignore bởi `.gitignore` cùng thư mục.
- `vite.e2e.config.ts`: dùng plugin app hiện tại và `envDir: false`, không thay Vite production config.
- `tsconfig.node.json` và ESLint nhận diện hai config mới.

## Server và script

Base URL cố định: `http://127.0.0.1:4173`.

```sh
yarn dev:e2e
yarn test:e2e
yarn test:e2e:headed
```

`dev:e2e` chạy chính xác:

```sh
vite --config vite.e2e.config.ts --host 127.0.0.1 --port 4173 --strictPort
```

Playwright webServer dùng `yarn dev:e2e`, readiness URL `/auth/login?demo=shopping`,
`reuseExistingServer: false` để không tự nối vào server không rõ nguồn gốc trên cổng đó.
Chưa khởi động server hoặc thực thi các lệnh test trên trong bước setup này.

## Shopping Demo và cô lập dữ liệu

Shopping Demo chỉ hoạt động trong DEV nên E2E dùng Vite dev, không dùng production preview.
Spec cần mở `/auth/login?demo=shopping` đầu tiên ở mỗi browser context để bật adapter demo.
URL readiness của webServer chỉ xác minh HTTP, không tự bật demo trong browser context.

Playwright Test mặc định cấp context mới cho mỗi test. Các spec tương lai phải giữ isolation,
không dùng profile thật/storage state của người dùng; storage mutation của demo nằm trong context
test và được bỏ khi đóng context. Không dựng backend hoặc mock server mới ở bước này.
Đăng nhập demo là kiểm tra adapter hiện có, không phải auth E2E với backend thật.

## Kiểm chứng đã thực hiện

- CLI runner hoạt động; version cuối 1.61.1.
- Browser installer thành công, Chromium executable tồn tại.
- Import/nạp `playwright.config.ts` và `vite.e2e.config.ts` thành công;
  kiểm tra baseURL, project, webServer và `envDir: false`, plugin app còn được giữ.
- TypeScript `tsc -b --pretty false` pass.
- ESLint hai config mới pass; cảnh báo rule stylistic deprecated từ cấu hình cũ vẫn còn.
- `git diff --check` pass.
- `playwright init-agents --help` xác nhận CLI hỗ trợ Codex, config và project flags.

Chưa launch browser, kiểm tra WebGL, chạy server, discovery/spec, scan, reviewer/debugger,
visual comparison hoặc backend thật. Không tạo spec/seed test, không cập nhật `.codex` hoặc trust.
Không rerun Vitest suite: bước này chỉ thay dependency/config E2E; kết quả 864/864 thuộc Batch 4.

## Bước Human cần làm để tiếp tục generator

Thực hiện trong Terminal, từ frontend (Node/Yarn/npx phải có trong PATH):

```sh
cd /Users/mac/Documents/JS-TS-AI/AI-systems-support-detecting-and-handling-data-quality-issues/src/frontend
npx --no-install playwright init-agents --loop=codex --config playwright.config.ts --project chromium
```

Lệnh này tạo agent definitions và có thể tạo seed/spec hỗ trợ; review diff sau khi chạy.
Sau đó đăng ký MCP server tên `playwright-test` trong cấu hình Codex tin cậy, với lệnh:

```sh
npx --no-install playwright run-test-mcp-server
```

MCP phải chạy với frontend là working directory để dùng runner/config vừa cài.
Khởi động lại Codex và phê duyệt MCP server. Cấu hình file đơn thuần chưa chứng minh server
đã đăng ký/được phê duyệt; phiên mới cần thấy `generator_write_test` và official planner/generator.
Không tự sửa host/global settings để bỏ qua bước này.

Hướng dẫn áp dụng:
`/Users/mac/.agents/skills/playwright-test-generator/setup-guide.md`.
Skill yêu cầu người dùng tự chạy phần đăng ký agents/MCP; setup runner vừa làm là task riêng
được duyệt. Generation, scan và execution còn NOT done.

## Công việc sau setup

Trình scenario + exact start/test commands để duyệt trước khi chạy theo generator skill.
Ưu tiên auth demo/guard, renderer startup/fallback, chọn khối/focus/reset,
records navigation và screenshot review. Không tự chấp nhận ảnh đầu tiên làm visual baseline.
Khi đổi OS/browser hoặc nâng Playwright, review ảnh chuẩn lại; không hứa baseline giống giữa GPU/OS.

Nguồn:
- [Playwright webServer](https://playwright.dev/docs/test-webserver).
- [Playwright configuration](https://playwright.dev/docs/test-configuration).
- [Platform registry 1.61.1 có Chromium mac13](https://github.com/microsoft/playwright/blob/v1.61.1/packages/playwright-core/src/server/registry/index.ts).
- [Browser versions 1.61.1](https://github.com/microsoft/playwright/blob/v1.61.1/packages/playwright-core/browsers.json).
