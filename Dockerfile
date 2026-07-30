FROM node:24-alpine AS backend-build
WORKDIR /build/backend
COPY backend/package.json backend/package-lock.json ./
COPY backend/prisma ./prisma
RUN npm ci
COPY backend/tsconfig.json ./
COPY backend/src ./src
RUN npm run build

FROM node:24-alpine AS frontend-build
WORKDIR /build/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/index.html frontend/postcss.config.js frontend/tailwind.config.ts ./
COPY frontend/tsconfig.json frontend/vite.config.ts ./
COPY frontend/src ./src
RUN npm run build

FROM node:24-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    NODE_OPTIONS=--max-old-space-size=256 \
    PORT=8080 \
    COOKIE_SECURE=true \
    TRUST_PROXY_HOPS=1 \
    JELLYFIN_TLS_REJECT_UNAUTHORIZED=true \
    LOG_LEVEL=info
COPY backend/package.json backend/package-lock.json ./
RUN npm ci --omit=dev \
    && npm cache clean --force
COPY --from=backend-build --chown=node:node /build/backend/node_modules/.prisma ./node_modules/.prisma
COPY --from=backend-build --chown=node:node /build/backend/node_modules/@prisma ./node_modules/@prisma
COPY --from=backend-build --chown=node:node /build/backend/dist ./dist
COPY --from=frontend-build --chown=node:node /build/frontend/dist ./public
COPY --chown=node:node backend/prisma ./prisma
COPY --chown=node:node backend/docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh
USER node
EXPOSE 8080
ENTRYPOINT ["./docker-entrypoint.sh"]
