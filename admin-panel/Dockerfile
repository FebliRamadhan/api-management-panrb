## ─── Stage 1: Build React client ──────────────────────
FROM node:18-alpine AS client-build
WORKDIR /build
# VITE_BASE: path prefix tempat admin panel di-serve oleh nginx.
#   Dev/standalone : '/'           (default)
#   Prod (di /wso2-admin/) : '/wso2-admin/'
# Set via build arg: docker compose build --build-arg VITE_BASE=/wso2-admin/
ARG VITE_BASE=/
ENV VITE_BASE=${VITE_BASE}
COPY client/package*.json ./
RUN npm ci
COPY client/ ./
RUN npm run build

## ─── Stage 2: Backend deps ────────────────────────────
FROM node:18-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev

## ─── Stage 2b: Dev image (devDeps + source, hot reload) ──
FROM node:18-alpine AS dev
RUN apk add --no-cache docker-cli curl
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
EXPOSE 3000
CMD ["npm", "run", "dev"]

## ─── Stage 3: Runtime ─────────────────────────────────
FROM node:18-alpine
RUN apk add --no-cache docker-cli curl wget
WORKDIR /app

# Copy backend
COPY --from=deps /app/node_modules ./node_modules
COPY package*.json ./
COPY server.js ./
COPY routes ./routes
COPY scripts ./scripts
COPY public ./public

# Copy built client
COPY --from=client-build /build/dist ./public/dist

# NOTE: Container run as root karena perlu akses /var/run/docker.sock untuk
# restart WSO2. Di production di-recommend: lepas docker.sock mount, restart
# pakai orchestrator (kubectl/compose dari host), dan jalankan sebagai non-root.
RUN mkdir -p /app/wso2-customization

EXPOSE 3000
CMD ["node", "server.js"]
