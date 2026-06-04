FROM node:20-alpine AS builder
WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

ARG NEXT_PUBLIC_API_URL=http://localhost:3001
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL

ARG NEXT_PUBLIC_BACKEND_URL=http://localhost:3001
ENV NEXT_PUBLIC_BACKEND_URL=$NEXT_PUBLIC_BACKEND_URL

# BACKEND_URL is used by next.config.ts rewrites — must be set at build time.
# In Docker this is http://backend:3001 (internal service name).
# Locally (npm run dev/build) it falls back to http://localhost:3001.
ARG BACKEND_URL=http://backend:3001
ENV BACKEND_URL=$BACKEND_URL

RUN mkdir -p public && npm run build

# ── Runner ────────────────────────────────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/public ./public

EXPOSE 3000
CMD ["npm", "start"]
