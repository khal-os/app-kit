# genie-app — Agent mission control service
# Build from monorepo root: docker build -f packages/genie-app/Dockerfile -t khal-os/genie-app .
FROM node:22-slim AS base
RUN corepack enable

WORKDIR /app

# Install dependencies (monorepo-aware)
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages/genie-app/package.json packages/genie-app/package.json
COPY packages/os-sdk/package.json packages/os-sdk/package.json
COPY packages/os-ui/package.json packages/os-ui/package.json
COPY packages/types/package.json packages/types/package.json

RUN pnpm install --frozen-lockfile --filter @khal-os/genie-app...

# Copy source
COPY packages/types/ packages/types/
COPY packages/os-sdk/ packages/os-sdk/
COPY packages/os-ui/ packages/os-ui/
COPY packages/genie-app/ packages/genie-app/

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s \
  CMD node -e "fetch('http://localhost:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

EXPOSE 3000

CMD ["pnpm", "exec", "tsx", "packages/genie-app/views/genie/service/index.ts"]
