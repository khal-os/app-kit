# genie-app — KhalOS agent mission control (requires tmux)
FROM node:22-slim
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends tmux && \
    rm -rf /var/lib/apt/lists/*

RUN corepack enable

COPY package.json pnpm-lock.yaml* ./
RUN pnpm install --prod --frozen-lockfile 2>/dev/null || pnpm install --prod 2>/dev/null || true

COPY . .

ENV NODE_ENV=production
ENV PORT=3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s \
  CMD node -e "fetch('http://localhost:3000/api/health').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

EXPOSE 3000
CMD ["node", "server.js"]
