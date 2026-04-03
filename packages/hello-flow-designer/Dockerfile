# hello-flow-designer — Visual voice agent flow builder service
# Build from monorepo root: docker build -f packages/hello-flow-designer/Dockerfile -t khal-os/hello-flow-designer .
FROM node:22-slim AS base
RUN corepack enable

WORKDIR /app

# Install dependencies (monorepo-aware)
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages/hello-flow-designer/package.json packages/hello-flow-designer/package.json
COPY packages/os-sdk/package.json packages/os-sdk/package.json
COPY packages/os-ui/package.json packages/os-ui/package.json
COPY packages/types/package.json packages/types/package.json

RUN pnpm install --frozen-lockfile --filter @khal-os/hello-flow-designer...

# Copy source
COPY packages/types/ packages/types/
COPY packages/os-sdk/ packages/os-sdk/
COPY packages/os-ui/ packages/os-ui/
COPY packages/hello-flow-designer/ packages/hello-flow-designer/

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s \
  CMD node -e "fetch('http://localhost:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

EXPOSE 3000

CMD ["pnpm", "exec", "tsx", "packages/hello-flow-designer/views/flow-designer/service/index.ts"]
