# syntax=docker/dockerfile:1
# Image backend NestJS — dùng chung cho E2E, k6 và demo.
# Build (context = src/backend):
#   docker build -f deploy/Dockerfile -t dq-backend .
# Chạy: xem deploy/docker-compose.e2e.yml

FROM node:22-bookworm-slim AS base
WORKDIR /app
# pnpm đúng phiên bản trong package.json (packageManager: pnpm@11.3.0)
RUN corepack enable

# ---- Cài toàn bộ dependency để build ----
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

# ---- Build TypeScript → dist/ ----
FROM deps AS build
COPY . .
RUN pnpm build

# ---- Chỉ dependency production (bcrypt cần chạy install script nên không --ignore-scripts) ----
FROM base AS prod-deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile --prod

# ---- Runtime ----
FROM node:22-bookworm-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
# nest build không copy font; pdf-builder đọc font tại dist/modules/analysis/assets/fonts
COPY --from=build /app/src/modules/analysis/assets ./dist/modules/analysis/assets
COPY package.json ./
# Lưu trữ cục bộ (khi không cấu hình S3) ghi vào /app/storage
RUN mkdir -p storage && chown -R node:node storage
USER node
EXPOSE 3000
HEALTHCHECK --interval=10s --timeout=5s --start-period=40s --retries=10 \
  CMD node -e "fetch('http://127.0.0.1:3000/health/ready').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "dist/main"]
