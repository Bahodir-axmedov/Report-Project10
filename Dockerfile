# YÜMI — production image for Railway (and any container host).
#
# Stage 1 installs dependencies and builds the static SPA into /app/dist.
# Stage 2 is a tiny runtime that serves that output with server.mjs, so the
# image ships no dependencies and no build tooling.

FROM node:22-alpine AS builder
WORKDIR /app
# install first so dependency layers are cached between builds
COPY package.json ./
RUN npm install --no-audit --no-fund
COPY . .
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
# Railway injects PORT; server.mjs honours it and binds 0.0.0.0
ENV PORT=3000
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/server.mjs ./server.mjs
USER node
EXPOSE 3000
CMD ["node", "server.mjs"]
